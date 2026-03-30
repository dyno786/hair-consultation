// api/analyse.js — Full A-Z regime with age awareness, ingredients, bundles
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

  const { ethnicity, hairType, concerns, ageGroup, ingredients } = req.body;

  // ── Fetch products ────────────────────────────────────────────────────────
  let products = [];
  let shopifyError = null;

  if (!SHOPIFY_TOKEN) {
    shopifyError = "SHOPIFY_ADMIN_TOKEN not set";
  } else {
    try {
      const shopRes = await fetch(
        `https://${SHOPIFY_DOMAIN}/admin/api/2025-04/products.json?limit=250&status=active`,
        { headers: { "X-Shopify-Access-Token": SHOPIFY_TOKEN } }
      );
      if (shopRes.ok) {
        const shopData = await shopRes.json();
        const allProds = shopData.products || [];

        const PRIORITY_BRANDS = [
          'cantu','shea moisture','palmer','creme of nature','mielle',
          'as i am','carol\'s daughter','african pride','dark and lovely',
          'ecostyler','eco styler','aunt jackie','design essentials',
          'jamaican black castor','keracare','motions','organic root',
          'africa\'s best','luster','tcb','ogx','giovanni','kinky curly',
          'olaplex','tresemme','dove','pantene','herbal essences',
          'batana','rosemary','argan','olive'
        ];

        // Accessories to include in tools section
        const ACCESSORY_KEYWORDS = [
          'bonnet','satin','silk','pillowcase','pillow case','scrunchie',
          'brush','comb','detangl','diffuser','dryer','steamer','hot comb',
          'flat iron','curling iron','wand','clip','pin','needle','thread',
          'spray bottle','hooded dryer','cap','wrap','scarf','durag',
          'applicator','sectioning'
        ];

        const isChild = ageGroup === 'child';

        const scored = allProds.map(p => {
          const title   = (p.title || '').toLowerCase();
          const type    = (p.product_type || '').toLowerCase();
          const tags    = (p.tags || '').toLowerCase();
          const vendor  = (p.vendor || '').toLowerCase();
          const body    = (p.body_html || '').toLowerCase().replace(/<[^>]+>/g,'');

          let score = 0;

          // Skip adult-only products for children
          if (isChild) {
            const adultOnly = ['relaxer','perm','colour','color','bleach','dye','chemical straighten','texturizer','keratin treatment'];
            if (adultOnly.some(w => title.includes(w) || tags.includes(w))) return { ...p, _score: -999 };
            // Boost kids products
            if (tags.includes('kids') || tags.includes('children') || title.includes('kids') || title.includes('child') || title.includes('baby')) score += 15;
            if (tags.includes('gentle') || title.includes('gentle') || title.includes('tear-free') || title.includes('mild')) score += 10;
          } else {
            // For adults, skip products tagged kids-only
            if ((tags.includes('kids only') || tags.includes('baby only')) && !tags.includes('adult')) score -= 5;
          }

          // Brand scoring
          PRIORITY_BRANDS.forEach(brand => {
            if (title.includes(brand) || vendor.includes(brand) || tags.includes(brand)) score += 10;
          });

          // Ingredient matching
          if (ingredients?.length) {
            ingredients.forEach(ing => {
              const i = ing.toLowerCase();
              if (title.includes(i) || tags.includes(i) || body.includes(i)) score += 8;
            });
          }

          // Hair care type scoring
          if (title.includes('shampoo')) score += 5;
          if (title.includes('condition')) score += 5;
          if (title.includes('mask') || title.includes('treatment')) score += 4;
          if (title.includes('leave-in') || title.includes('leave in')) score += 4;
          if (title.includes('curl') || title.includes('coil') || title.includes('twist')) score += 3;
          if (title.includes('moisture') || title.includes('hydrat')) score += 3;
          if (title.includes('scalp') || title.includes('growth')) score += 3;
          if (title.includes('protein') || title.includes('strengthen') || title.includes('repair')) score += 3;

          // Accessory scoring (for tools section)
          if (ACCESSORY_KEYWORDS.some(w => title.includes(w) || type.includes(w) || tags.includes(w))) score += 6;

          // Penalise plain unlabelled oils
          if (title.match(/^100%|^pure /i) && score < 5) score -= 3;

          return { ...p, _score: score };
        });

        scored.sort((a,b) => b._score - a._score);
        products = scored.filter(p => p._score > -999).slice(0, 100).map(p => ({
          id:        p.id,
          title:     p.title,
          handle:    p.handle,
          vendor:    p.vendor || 'CC Hair & Beauty',
          price:     p.variants?.[0]?.price || "0.00",
          variantId: p.variants?.[0]?.id,
          image:     p.images?.[0]?.src || null,
          url:       `https://cchairandbeauty.com/products/${p.handle}`,
          tags:      (p.tags || '').toLowerCase(),
          type:      (p.product_type || '').toLowerCase(),
          isAccessory: ['brush','comb','bonnet','satin','silk','pillowcase','diffuser',
            'dryer','steamer','flat iron','curling','scrunchie','clip','spray bottle',
            'cap','scarf','durag','wrap'].some(w => 
            p.title?.toLowerCase().includes(w) || 
            (p.product_type||'').toLowerCase().includes(w) ||
            (p.tags||'').toLowerCase().includes(w)
          )
        }));
      } else {
        shopifyError = `Shopify ${shopRes.status}`;
      }
    } catch(e) {
      shopifyError = e.message;
    }
  }

  const hairCareProducts   = products.filter(p => !p.isAccessory);
  const accessoryProducts  = products.filter(p => p.isAccessory);

  const hairCareList  = hairCareProducts.length
    ? hairCareProducts.map(p => `- "${p.title}" by ${p.vendor} | £${parseFloat(p.price).toFixed(2)}`).join("\n")
    : "- General branded hair care products";

  const accessoryList = accessoryProducts.length
    ? accessoryProducts.map(p => `- "${p.title}" | £${parseFloat(p.price).toFixed(2)}`).join("\n")
    : "- Satin bonnet, silk pillowcase, wide-tooth comb, detangling brush";

  const isChild     = ageGroup === 'child';
  const ageNote     = isChild
    ? "IMPORTANT: This is for a CHILD. Only recommend gentle, child-safe, chemical-free products. NO relaxers, perms, colour, bleach, heat tools or chemical treatments under any circumstances. Legal note: children must not use adult chemical hair treatments."
    : "This is for an ADULT. All products are appropriate.";

  const ingredientNote = ingredients?.length
    ? `Customer prefers these key ingredients: ${ingredients.join(', ')}. Recommend products containing these ingredients first, then suggest alternatives from different brands if the same ingredient appears in multiple products (to give variety).`
    : "";

  const prompt = `You are a luxury hair expert for CC Hair & Beauty, a premium UK hair retailer in Leeds.

Customer profile:
- Age group: ${ageGroup === 'child' ? 'CHILD (under 16)' : 'ADULT'}
- Hair background: ${ethnicity}
- Hair type: ${hairType}
- Hair concerns: ${(concerns||[]).join(', ')}
${ingredientNote ? `- Preferred ingredients: ${ingredients?.join(', ')}` : ''}

${ageNote}

HAIR CARE PRODUCTS available (for routine steps only — NOT for tools section):
${hairCareList}

ACCESSORIES available (for tools section ONLY):
${accessoryList}

CRITICAL RULES:
1. AGE SAFETY: ${isChild ? 'Child profile — ONLY gentle, natural, chemical-free products. Refuse any chemical treatments.' : 'Adult profile — all products appropriate.'}
2. BRANDED PRODUCTS FIRST: Always recommend Cantu, Shea Moisture, Palmer\'s, Creme of Nature, Mielle etc. over plain oils
3. INGREDIENT VARIETY: If multiple products share the same key ingredient, recommend products from DIFFERENT brands for variety
4. ROUTINE STEPS: Only use hair care products (shampoos, conditioners, treatments, stylers) in routine steps
5. TOOLS SECTION: ONLY accessories (brushes, combs, bonnets, silk pillowcases, diffusers, clips) — NEVER hair care products
6. ALWAYS include in tools: a brush/comb suitable for their hair type, a satin/silk bonnet for night, a silk pillowcase
7. BUNDLE: At the end list all recommended products for a bundle with 10% discount
8. Use EXACT product titles from the lists above

Respond ONLY with this exact JSON, no markdown:
{
  "diagnosis": "2-3 sentences diagnosing their specific hair issues and root causes",
  "keyIngredients": [
    {"ingredient": "ingredient name", "benefit": "what it does for their hair type", "products": ["product title from list"]}
  ],
  "morningRoutine": [
    {"step": "Step description", "product": "EXACT hair care product title or null", "why": "why this branded product"}
  ],
  "washDayRoutine": [
    {"step": "Step description", "product": "EXACT hair care product title or null", "why": "why this branded product"}
  ],
  "nightRoutine": [
    {"step": "Step description", "product": "EXACT hair care product title or null", "why": "why this product"}
  ],
  "toolsAndAccessories": [
    {"category": "Brushes & Combs", "item": "EXACT accessory from list", "why": "why for their texture"},
    {"category": "Silk Pillowcase", "item": "EXACT accessory from list", "why": "reduces friction and moisture loss"},
    {"category": "Night Protection", "item": "EXACT satin bonnet from list", "why": "protects curls overnight"},
    {"category": "Electrical Tools", "item": "EXACT accessory from list or null if child", "why": "why for their hair"}
  ],
  "bundle": {
    "products": ["list all recommended product titles"],
    "originalTotal": 0.00,
    "discountPercent": 10,
    "bundleTotal": 0.00,
    "saving": 0.00
  },
  "keyTip": "One powerful expert tip for their exact hair texture and age group"
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
        max_tokens: 2500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const aiData   = await aiRes.json();
    const text     = aiData.content?.map(b => b.text || "").join("") || "{}";
    const clean    = text.replace(/```json|```/g, "").trim();
    const analysis = JSON.parse(clean);

    // Calculate real bundle total from actual product prices
    if (analysis.bundle?.products?.length) {
      const bundleProds = analysis.bundle.products.map(name => 
        products.find(p => p.title?.toLowerCase() === name?.toLowerCase()) ||
        products.find(p => p.title?.toLowerCase().includes(name?.toLowerCase().split(' ')[0]))
      ).filter(Boolean);

      const originalTotal = bundleProds.reduce((sum, p) => sum + parseFloat(p.price || 0), 0);
      analysis.bundle.originalTotal = parseFloat(originalTotal.toFixed(2));
      analysis.bundle.discountPercent = 10;
      analysis.bundle.bundleTotal = parseFloat((originalTotal * 0.9).toFixed(2));
      analysis.bundle.saving = parseFloat((originalTotal * 0.1).toFixed(2));
      analysis.bundle.productDetails = bundleProds;
    }

    return res.status(200).json({
      ...analysis,
      products,
      ageGroup,
      _debug: {
        productCount: products.length,
        accessoryCount: accessoryProducts.length,
        hairCareCount: hairCareProducts.length,
        shopifyError: shopifyError || null,
        hasToken: !!SHOPIFY_TOKEN,
      }
    });

  } catch(error) {
    return res.status(500).json({ error: error.message });
  }
}
