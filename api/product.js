// api/products.js — Secure Shopify product fetch (runs on Vercel server, never exposes token)
export default async function handler(req, res) {
  // Allow requests from your store and localhost for testing
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { query = "hair" } = req.query;

  const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN;
  const SHOPIFY_TOKEN  = process.env.SHOPIFY_ADMIN_TOKEN;

  if (!SHOPIFY_DOMAIN || !SHOPIFY_TOKEN) {
    return res.status(500).json({ error: "Shopify credentials not configured" });
  }

  try {
    // Use Admin API to search products securely from the server
    const response = await fetch(
      `https://${SHOPIFY_DOMAIN}/admin/api/2025-04/products.json?limit=6&title=${encodeURIComponent(query)}`,
      {
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();

    // Return only what the frontend needs — no sensitive data
    const products = (data.products || []).map(p => ({
      id:    p.id,
      title: p.title,
      handle: p.handle,
      description: p.body_html?.replace(/<[^>]+>/g, "").slice(0, 120),
      price: p.variants?.[0]?.price || "0.00",
      currency: "GBP",
      image: p.images?.[0]?.src || null,
      url: `https://cchairandbeauty.com/products/${p.handle}`,
    }));

    return res.status(200).json({ products });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
