// api/analyse.js — Full regime with branded product recommendations
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

  // ── Fetch products from Shopify ───────────────────────────────────────────
  let products = [];
  let shopifyError = null;

  if (!SHOPIFY_TOKEN) {
    shopifyError = "SHOPIFY_ADMIN_TOKEN not set";
  } else {
    try {
      // Fetch more products and filter by relevant brands
      const shopRes = await fetch(
        `https://${SHOPIFY_DOMAIN}/admin/api/2025-04/products.json?limit=250&status=active`,
        { headers: { "X-Shopify-Access-Token": SHOPIFY_TOKEN } }
      );
      if (shopRes.ok) {
        const shopData = await shopRes.json();
        const allProds = shopData.products || [];

        // Key brands to prioritise
        const PRIORITY_BRANDS = [
          'cantu','shea moisture','she moisture','palmer','creme of nature',
          'argan','dark and lovely','african pride','ecostyler','mielle',
          'as i am','carol\'s daughter','tresemme','dove','pantene',
          'giovanni','kinky curly','aunt jackie','design essentials',
          'jamaican black castor','olaplex','keracare','motions',
          'organic root','tcb','luster','africa\'s best','olive'
        ];

        // Score products — prioritise branded hair care over plain oils
        const scored = allProds.map(p => {
          const title = (p.title || '').toLowerCase();
          const type  = (p.product_type || '').toLowerCase();
          const tags  = (p.tags || '').toLowerCase();
          const vendor = (p.vendor || '').toLowerCase();

          let score = 0;
          // Big boost for known brands
          PRIORITY_BRANDS.forEach(brand => {
            if(title.includes(brand) || vendor.includes(brand) || tags.includes(brand)) score += 10;
          });
          // Boost for hair care product types
          if(type.includes('shampoo') || title.includes('shampoo')) score += 5;
          if(type.includes('conditioner') || title.includes('condition')) score += 5;
          if(title.includes('mask') || title.includes('treatment')) score += 4;
          if(title.includes('leave-in') || title.includes('leave in')) score += 4;
          if(title.includes('curl') || title.includes('coil')) score += 3;
          if(title.includes('moisture') || title.includes('hydrat')) score += 3;
          if(title.includes('scalp')) score += 3;
          if(title.includes('growth') || title.includes('strengthen')) score += 2;
          if(title.includes('bonnet') || title.includes('satin') || title.includes('silk')) score += 4;
          if(title.includes('brush') || title.includes('comb') || title.includes('detangl')) score += 3;
          if(title.includes('diffuser') || title.includes('dryer') || title.includes('steamer')) score += 3;
          // Slight penalty for plain carrier oils with no brand
          if(title.match(/^100%|^pure /i) && score === 0) score -= 2;

          return { ...p, _score: score };
        });

        // Sort by score, take top 80
        scored.sort((a,b) => b._score - a._score);
        products = scored.slice(0, 80).map(p => ({
          id:        p.id,
          title:     p.title,
          handle:    p.handle,
          vendor:    p.vendor,
          price:     p.variants?.[0]?.price || "0.00",
          variantId: p.variants?.[0]?.id,
          image:     p.images?.[0]?.src || null,
          url:       `https://cchairandbeauty.com/products/${p.handle}`,
          tags:      (p.tags || '').toLowerCase(),
          type:      (p.product_type || '').toLowerCase(),
        }));
      } else {
        shopifyError = `Shopify ${shopRes.status}`;
      }
    } catch(e) {
      shopifyError = e.message;
    }
  }

  // ── Build product list for Claude ─────────────────────────────────────────
  const productList = products.length
    ? products.map(p => `- "${p.title}" by ${p.vendor||'CC Hair'} | £${parseFloat(p.price).toFixed(2)} | url:${p.url}`).join("\n")
    : "- No products loaded. Recommend by brand name only.";

  // ── Claude prompt ─────────────────────────────────────────────────────────
  const prompt = `You are a luxury hair expert for CC Hair & Beauty, a premium UK hair retailer in Leeds stocking top brands including Cantu, Shea Moisture, Palmer's, Creme of Nature, Mielle, As I Am, African Pride, Dark & Lovely, Eco Styler, Carol's Daughter, Jamaican Black Castor Oil, Design Essentials, Aunt Jackie's, OGX, and many more.

Customer profile:
- Hair background: ${ethnicity}
- Hair type: ${hairType}
- Hair concerns: ${(concerns||[]).join(', ')}

REAL products currently in stock at CC Hair & Beauty:
${productList}

CRITICAL RULES:
1. Recommend BRANDED products (Cantu, Shea Moisture, Palmer's, Creme of Nature etc.) — NOT plain oils
2. Use EXACT product titles from the list above
3. Match products to the routine step — shampoo for cleansing step, conditioner for conditioning step etc.
4. For tools/accessories recommend specific items from the list if available
5. Set product to null only if truly nothing suitable exists in the list
6. NEVER recommend a plain carrier oil (like "100% Pure Jojoba Oil") as a primary step product — only as an add-on

Respond ONLY with this exact JSON, no markdown:
{
  "diagnosis": "2-3 sentences diagnosing their specific hair issues and root causes",
  "morningRoutine": [
    {"step": "Step description", "product": "EXACT product title from list or null", "why": "why this branded product for this step"}
  ],
  "washDayRoutine": [
    {"step": "Step description", "product": "EXACT product title from list or null", "why": "why this branded product"}
  ],
  "nightRoutine": [
    {"step": "Step description", "product": "EXACT product title from list or null", "why": "why this product"}
  ],
  "toolsAndAccessories": [
    {"category": "Brushes & Combs", "item": "EXACT product from list or specific recommendation", "why": "why"},
    {"category": "Electrical Tools", "item": "EXACT product from list or specific recommendation", "why": "why"},
    {"category": "Sleeping Protection", "item": "EXACT product from list or specific recommendation", "why": "why"},
    {"category": "Styling Accessories", "item": "EXACT product from list or specific recommendation", "why": "why"}
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

  } catch(error) {
    return res.status(500).json({ error: error.message });
  }
}
