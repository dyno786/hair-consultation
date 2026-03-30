// api/shopify-test.js — Visit /api/shopify-test in your browser to check connection
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN;
  const SHOPIFY_TOKEN  = process.env.SHOPIFY_ADMIN_TOKEN;
  const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY;

  // Step 1: Check all variables exist
  const checks = {
    ANTHROPIC_API_KEY:   !!ANTHROPIC_KEY   ? "✅ Set" : "❌ MISSING",
    SHOPIFY_DOMAIN:      !!SHOPIFY_DOMAIN  ? `✅ Set = ${SHOPIFY_DOMAIN}` : "❌ MISSING",
    SHOPIFY_ADMIN_TOKEN: !!SHOPIFY_TOKEN   ? `✅ Set (starts with: ${SHOPIFY_TOKEN.substring(0,10)}...)` : "❌ MISSING",
  };

  if (!SHOPIFY_TOKEN) {
    return res.status(200).json({
      status: "FAILED",
      message: "SHOPIFY_ADMIN_TOKEN is not set — redeploy Vercel after adding it",
      checks
    });
  }

  // Step 2: Try to connect to Shopify
  try {
    const r = await fetch(
      `https://${SHOPIFY_DOMAIN}/admin/api/2025-04/shop.json`,
      { headers: { "X-Shopify-Access-Token": SHOPIFY_TOKEN } }
    );

    if (r.status === 200) {
      const shop = await r.json();
      // Step 3: Count products
      const pr = await fetch(
        `https://${SHOPIFY_DOMAIN}/admin/api/2025-04/products/count.json`,
        { headers: { "X-Shopify-Access-Token": SHOPIFY_TOKEN } }
      );
      const pc = await pr.json();
      return res.status(200).json({
        status: "✅ SUCCESS",
        shop: shop.shop?.name,
        domain: shop.shop?.domain,
        productCount: pc.count,
        checks
      });
    }

    if (r.status === 401) return res.status(200).json({
      status: "❌ FAILED — 401 Unauthorized",
      message: "Token is wrong or expired. Regenerate it in Shopify.",
      checks
    });

    if (r.status === 403) return res.status(200).json({
      status: "❌ FAILED — 403 Forbidden",
      message: "Token exists but missing read_products permission.",
      checks
    });

    const text = await r.text();
    return res.status(200).json({
      status: `❌ FAILED — HTTP ${r.status}`,
      body: text.substring(0, 300),
      checks
    });

  } catch(e) {
    return res.status(200).json({
      status: "❌ EXCEPTION",
      error: e.message,
      checks
    });
  }
}
