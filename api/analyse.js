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

  // Fetch ALL products from Shopify
  let products = [];
  if (SHOPIFY_TOKEN) {
    try {
      const shopRes = await fetch(
        `https://${SHOPIFY_DOMAIN}/admin/api/2025-04/products.json?limit=50&status=active`,
        { headers: { "X-Shopify-Access-Token": SHOPIFY_TOKEN, "Content-Type": "application/json" } }
      );
      if (shopRes.ok) {
        const shopData = await shopRes.json();
        products = (shopData.products || []).map(p => ({
          id:        p.id,
          title:     p.title,
          handle:    p.handle,
          price:     p.variants?.[0]?.price || "0.00",
          variantId: p.variants?.[0]?.id,
          image:     p.images?.[0]?.src || null,
          url:       `https://cchairandbeauty.com/products/${p.handle}`,
          tags:      p.tags || "",
          type:      p.product_type || "",
        }));
      }
    } catch (e) { console.error("Shopify fetch error:", e.message); }
  }

  const productList = products.length
    ? products.map(p => `- ${p.title} | Type: ${p.type} | Tags: ${p.tags} | Price: GBP ${parseFloat(p.price).toFixed(2)}`).join("\n")
    : "- General hair care products available at cchairandbeauty.com";

  const prompt = `You are a luxury hair expert for CC Hair & Beauty, a premium UK hair and beauty retailer in Leeds.

Customer profile:
- Hair background: ${ethnicity}
- Hair type: ${hairType}
- Hair concerns: ${(concerns||[]).join(", ")}

Products available in our store:
${productList}

Create a COMPLETE A-Z hair care plan. Respond ONLY with this exact JSON, no markdown:
{
  "diagnosis": "2-3 sentences diagnosing their specific hair issues and root causes",
  "morningRoutine": [
    {"step": "Step description", "product": "exact product name from store or null if not in store", "why": "why this product for this step"}
  ],
  "washDayRoutine": [
    {"step": "Step description", "product": "exact product name from store or null", "why": "why this product"}
  ],
  "nightRoutine": [
    {"step": "Step description", "product": "exact product name from store or null", "why": "why this product"}
  ],
  "toolsAndAccessories": [
    {"category": "Brushes & Combs", "item": "product name from store or recommended type", "why": "why this tool for their hair type"},
    {"category": "Electrical Tools", "item": "product name from store or recommended type", "why": "why this tool"},
    {"category": "Sleeping Protection", "item": "product name from store or recommended type", "why": "why this for their hair"},
    {"category": "Styling Accessories", "item": "product name from store or recommended type", "why": "why this"}
  ],
  "keyTip": "One powerful expert tip specific to their exact hair texture and concerns"
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

    return res.status(200).json({ ...analysis, products });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
