// api/analyse.js — Secure Claude AI analysis (runs on Vercel server)
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) {
    return res.status(500).json({ error: "Anthropic API key not configured" });
  }

  const { ethnicity, hairType, concerns, products } = req.body;

  const productList = products?.length
    ? products.map(p => `• ${p.title} – £${parseFloat(p.price).toFixed(2)}`).join("\n")
    : "• Products from cchairandbeauty.com";

  const prompt = `You are a luxury hair expert for CC Hair & Beauty, a premium UK hair and beauty brand.
Customer profile:
- Ethnicity/hair background: ${ethnicity}
- Hair type: ${hairType}
- Hair concerns: ${concerns.join(", ")}
Available CC Hair & Beauty products:
${productList}
Provide a JSON response ONLY (no markdown, no preamble):
{"diagnosis":"2-3 sentence expert diagnosis mentioning specific causes","regime":["Step 1: ...","Step 2: ...","Step 3: ...","Step 4: ...","Step 5: ...","Step 6: ..."],"recommendations":[{"name":"product name from list","reason":"why it suits them"},{"name":"product name","reason":"why"}],"keyTip":"one powerful tip specific to their texture"}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    const text = data.content?.map(b => b.text || "").join("") || "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    const analysis = JSON.parse(clean);
    return res.status(200).json(analysis);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
