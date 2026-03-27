const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');

// POST /api/parse — extract structured trip data from free-text input
router.post('/parse', async (req, res) => {
  const { input } = req.body;
  if (!input || !input.trim()) {
    return res.status(400).json({ error: 'input is required' });
  }
  if (input.length > 2000) {
    return res.status(400).json({ error: 'Input must be 2000 characters or fewer.' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const client = new Anthropic({ apiKey });

  const today = new Date().toISOString().split('T')[0];

  const prompt = `Extract structured trip data from the following natural language input.
Today's date is ${today}.

Return ONLY a JSON object with this exact shape:
{
  "destinations": [
    {
      "city": "City, ST",
      "stopType": "Stay" | "Overnight" | "Day trip",
      "departureDate": "YYYY-MM-DD",
      "returnDate": "YYYY-MM-DD"
    }
  ],
  "tripType": "Business" | "Casual" | "Leisure" | "Beach" | "Adventure" | "Wedding" | "Conference",
  "gender": "Male" | "Female" | "Non-binary",
  "itinerary": "any specific schedule or activities mentioned, or empty string"
}

Rules:
- If no gender is mentioned, default to "Male"
- If no tripType is clear, default to "Leisure"
- If no dates are mentioned, use the next Monday and next Friday as default departure/return
- For a Day trip, departureDate and returnDate must be identical
- Return exactly one destination if only one city is mentioned
- Do not include any text outside the JSON object

Input:
${input}`;

  const TIMEOUT_MS = 15000;
  try {
    const llmPromise = client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Parse request timed out')), TIMEOUT_MS)
    );
    const message = await Promise.race([llmPromise, timeoutPromise]);

    const raw = message.content[0].text.trim();

    // Strip markdown code fences if present
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return res.status(422).json({ error: 'Failed to parse trip data from input', raw });
    }

    // Basic shape validation
    if (!parsed.destinations || !Array.isArray(parsed.destinations) || parsed.destinations.length === 0) {
      return res.status(422).json({ error: 'Could not identify a destination from your input' });
    }

    return res.json(parsed);
  } catch (err) {
    console.error('Parse endpoint error:', err.message);
    return res.status(500).json({ error: 'Failed to parse trip data' });
  }
});

module.exports = router;
