// api/analyse.js — Full regime with products, tools, morning/night routine
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY;
  const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN || "cchairandbeauty.myshopify.com";
  const SHOPIFY_TOKEN  = process.env.SHOPIFY_ADMIN_TOKEN;

  if (!ANTHROPIC_KEY) return res.status(500).json({ error: "Anthropic API key not configured" });

  const { ethnicity, hairType, concerns } = req.body;

  // ── Fetch ALL products from Shopify ───────────────────────────────────────
  let products = [];
  let shopifyError = null;

  if (!SHOPIFY_TOKEN) {
    shopifyError = "SHOPIFY_ADMIN_TOKEN not set in environment variables";
  } else {
    try {
      const shopRes = await fetch(
        `https://${SHOPIFY_DOMAIN}/admin/api/2025-04/products.json?limit=50&status=active`,
        { headers: { "X-Shopify-Access-Token": SHOPIFY_TOKEN, "Content-Type": "application/json" } }
      );
      const shopText = await shopRes.text();
      if (!shopRes.ok) {
        shopifyError = `Shopify returned ${shopRes.status}: ${shopText.substring(0, 200)}`;
      } else {
        const shopData = JSON.parse(shopText);
        products = (shopData.products || []).map(p => ({
          id:        p.id,
          title:     p.title,
          handle:    p.handle,
          price:     p.variants?.[0]?.price || "0.00",
          variantId: p.variants?.[0]?.id,
          image:     p.images?.[0]?.src || null,
          // Direct product URL — not a search string
          url:       `https://cchairandbeauty.com/products/${p.handle}`,
          tags:      (p.tags || "").toLowerCase(),
          type:      (p.product_type || "").toLowerCase(),
        }));
      }
    } catch (e) {
      shopifyError = `Shopify fetch exception: ${e.message}`;
    }
  }

  // ── Build product list for Claude ─────────────────────────────────────────
  const productList = products.length
    ? products.map(p => `- "${p.title}" | url: ${p.url} | price: GBP ${parseFloat(p.price).toFixed(2)}`).join("\n")
    : "- No products loaded. Recommend general hair care product types only.";

  // ── Run Claude AI analysis ────────────────────────────────────────────────
  const prompt = `You are a luxury hair expert for CC Hair & Beauty, a premium UK hair retailer in Leeds at cchairandbeauty.com.

Customer profile:
- Hair background: ${ethnicity}
- Hair type: ${hairType}
- Hair concerns: ${(concerns||[]).join(", ")}

REAL products available in the CC Hair & Beauty store RIGHT NOW:
${productList}

IMPORTANT RULES:
- Only recommend products from the list above
- Use the EXACT product title as written in the list
- If no suitable product exists in the list for a step, set product to null
- Never invent product names

Respond ONLY with this exact JSON, no markdown, no extra text:
{
  "diagnosis": "2-3 sentences diagnosing their specific hair issues and root causes",
  "morningRoutine": [
    {"step": "Step description", "product": "EXACT product title from list or null", "why": "why this product"}
  ],
  "washDayRoutine": [
    {"step": "Step description", "product": "EXACT product title from list or null", "why": "why this product"}
  ],
  "nightRoutine": [
    {"step": "Step description", "product": "EXACT product title from list or null", "why": "why this product"}
  ],
  "toolsAndAccessories": [
    {"category": "Brushes & Combs", "item": "EXACT product title from list or best recommendation", "why": "why"},
    {"category": "Electrical Tools", "item": "EXACT product title from list or best recommendation", "why": "why"},
    {"category": "Sleeping Protection", "item": "EXACT product title from list or best recommendation", "why": "why"},
    {"category": "Styling Accessories", "item": "EXACT product title from list or best recommendation", "why": "why"}
  ],
  "keyTip": "One powerful expert tip for their exact hair texture"
}`;

  try {
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const aiData   = await aiRes.json();
    const text     = aiData.content?.map(b => b.text || "").join("") || "{}";
    const clean    = text.replace(/```json|```/g, "").trim();
    const analysis = JSON.parse(clean);

    // Return everything including shopify debug info
    return res.status(200).json({
      ...analysis,
      products,
      _debug: {
        productCount: products.length,
        shopifyError: shopifyError || null,
        domain: SHOPIFY_DOMAIN,
        hasToken: !!SHOPIFY_TOKEN,
      }
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message,
      _debug: { shopifyError, productCount: products.length, hasToken: !!SHOPIFY_TOKEN }
    });
  }
}
