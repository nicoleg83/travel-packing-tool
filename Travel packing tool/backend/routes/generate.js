const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');

// Sanitize free-text itinerary field to prevent prompt injection
function sanitizeItinerary(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .slice(0, 500)
    .replace(/\bignore\b.*?\binstructions?\b/gi, '[removed]')
    .replace(/\bforget\b.*?\babove\b/gi, '[removed]')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .trim();
}

// Fetch weather from OpenWeatherMap
async function fetchWeather(destination) {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey) return { summary: 'Weather unavailable (no API key)', location: destination };

  try {
    const geoRes = await fetch(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(destination)}&limit=1&appid=${apiKey}`
    );
    const geoData = await geoRes.json();
    if (!geoData.length) return { summary: `Weather data unavailable for ${destination}`, location: destination };

    const { lat, lon } = geoData[0];
    const weatherRes = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=imperial&cnt=8&appid=${apiKey}`
    );
    const weatherData = await weatherRes.json();
    const temps = weatherData.list.map(i => i.main.temp);
    const low = Math.round(Math.min(...temps));
    const high = Math.round(Math.max(...temps));
    const condition = weatherData.list[0].weather[0].description;
    return { summary: `${low}–${high}°F, ${condition}`, location: destination };
  } catch (err) {
    console.error('Weather fetch error:', err.message);
    return { summary: 'Weather unavailable', location: destination };
  }
}

// Carry-on item limit scales with trip length
function carryOnLimit(totalDays) {
  if (totalDays <= 2) return 10
  if (totalDays <= 5) return 15
  if (totalDays <= 9) return 20
  return 25
}

// Count calendar days across all destinations
function countTripDays(destinations) {
  const allDates = new Set()
  for (const d of destinations) {
    const start = new Date(d.departureDate)
    const end = d.stopType === 'Day trip' ? start : new Date(d.returnDate)
    for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
      allDates.add(dt.toISOString().slice(0, 10))
    }
  }
  return allDates.size || 1
}

// Call Claude to generate the outfit plan
async function generateOutfits(tripData, weatherSummary, editInstruction = '') {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set in environment');

  const client = new Anthropic({ apiKey });

  const systemPrompt = `You are a personal travel stylist for MBA students. Given trip destinations, dates, weather, trip type, gender, and a rough itinerary, generate a day-by-day outfit plan and a consolidated packing list optimized for carry-on travel.

Rules:
- Generate realistic, specific outfit combinations appropriate for the specified gender
- Match outfit formality to the day's events (recruiting interview = conservative formal, networking dinner = smart casual, leisure = casual)
- For multi-destination trips, account for location changes in outfit choices
- For stops marked [DAY TRIP]: plan outfits only — no extra packing items needed for that stop, the traveler returns to their base
- For stops marked [OVERNIGHT]: pack minimally (1 outfit change max)
- TRAVEL DAY RULE (mandatory): For every date listed under "Transit dates", you MUST include a "Travel" outfit slot on that day. Use time: "Travel", type: "Transit". This outfit is worn once in-transit and gets dirty — it must appear as a separate entry in the packing list under a "Travel Day" category, never reused across other days. It should be comfortable and casual (joggers or dark jeans, soft layer, sneakers or slip-ons).
- Reuse items across non-travel days to minimize packing — the goal is carry-on only
- Keep the packing list to CLOTHING AND SHOES ONLY — no toiletries, tech, documents, or bags
- Return ONLY valid JSON — no prose, no markdown, no extra text

Required JSON schema:
{
  "days": [
    {
      "date": "YYYY-MM-DD",
      "label": "Mon, Jan 15",
      "events": "brief event summary",
      "temp": "temperature and condition",
      "outfits": [
        {
          "time": "Morning",
          "type": "Formal",
          "items": ["item 1", "item 2"]
        }
      ]
    }
  ],
  "packingList": [
    {
      "category": "Category Name",
      "items": [
        { "name": "item name", "qty": 1 }
      ]
    }
  ]
}`;

  const destinationDetails = weatherSummary.map(w => {
    const typeNote = w.stopType === 'Day trip'
      ? ' [DAY TRIP — no overnight, no extra packing for this stop]'
      : w.stopType === 'Overnight'
      ? ' [OVERNIGHT — one night only, pack light for this stop]'
      : ''
    return `  - ${w.city} (${w.dates})${typeNote}: ${w.weather}`
  }).join('\n');

  // Compute transit dates: departure date of each stop (traveling TO it) + return date of each stop (traveling FROM it)
  const transitDateSet = new Set()
  for (const d of tripData.destinations) {
    if (d.departureDate) transitDateSet.add(d.departureDate)
    if (d.returnDate && d.stopType !== 'Day trip') transitDateSet.add(d.returnDate)
    if (d.stopType === 'Day trip' && d.departureDate) transitDateSet.add(d.departureDate)
  }
  const transitDates = Array.from(transitDateSet).sort().join(', ')

  const totalDays = countTripDays(tripData.destinations)
  const baseLimit = carryOnLimit(totalDays)
  const checkedBag = tripData.bagType === 'Checked bag'
  const maxItems = checkedBag ? baseLimit * 2 : baseLimit
  const limitLine = checkedBag
    ? `Bag type: Checked bag — the traveler is checking a bag, so you can pack more freely. Aim for completeness rather than minimalism.`
    : `Packing list hard limit: ${maxItems} items total (clothing and shoes only). Count every qty. Stay under this number — every item must earn its place.`

  const userPrompt = `Destinations and weather:
${destinationDetails}
Transit dates (MUST include Travel outfit on each): ${transitDates}
${limitLine}
Trip type: ${tripData.tripType}
Gender: ${tripData.gender}
Itinerary: ${sanitizeItinerary(tripData.itinerary) || 'No specific itinerary provided'}
${editInstruction ? `Additional constraint: ${editInstruction}` : ''}`;

  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const raw = message.content[0].text;
      // Strip markdown code fences if Claude wraps the JSON (e.g. ```json ... ```)
      const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      const parsed = JSON.parse(text);

      if (!parsed.days || !Array.isArray(parsed.days) || !parsed.packingList || !Array.isArray(parsed.packingList)) {
        throw new Error('Response missing required fields');
      }

      const totalItems = parsed.packingList.reduce((sum, cat) => {
        return sum + cat.items.reduce((s, item) => s + (item.qty || 1), 0);
      }, 0);

      return {
        weather: weatherSummary,
        days: parsed.days,
        packingList: parsed.packingList,
        totalItems,
        carryOnLimit: maxItems,
        carryOnFeasible: totalItems <= maxItems,
      };
    } catch (err) {
      lastError = err;
      console.error(`Claude attempt ${attempt + 1} failed:`, err.message);
    }
  }

  throw new Error(`AI returned an unexpected response: ${lastError.message}`);
}

// POST /api/generate
router.post('/generate', async (req, res) => {
  const { destinations, tripType, gender, itinerary, bagType } = req.body;

  if (!destinations?.length || !tripType) {
    return res.status(400).json({ error: 'Missing required fields: destinations, tripType' });
  }

  for (const d of destinations) {
    if (!d.city || !d.departureDate) {
      return res.status(400).json({ error: 'Each destination needs a city and departure date' });
    }
    if (d.stopType !== 'Day trip' && !d.returnDate) {
      return res.status(400).json({ error: 'Each stay needs a return date' });
    }
  }

  try {
    // Fetch weather for all destinations in parallel
    const weatherResults = await Promise.all(destinations.map(d => fetchWeather(d.city)));
    const weatherSummary = destinations.map((d, i) => ({
      city: d.city,
      dates: d.stopType === 'Day trip' ? d.departureDate : `${d.departureDate} to ${d.returnDate}`,
      stopType: d.stopType || 'Stay',
      weather: weatherResults[i].summary,
    }));

    const tripData = { destinations, tripType, gender: gender || 'Male', itinerary, bagType: bagType || 'Carry-on' };
    const result = await generateOutfits(tripData, weatherSummary);
    res.json(result);
  } catch (err) {
    console.error('Generate error:', err.message);
    res.status(500).json({ error: err.message || 'Something went wrong — please try again' });
  }
});

// POST /api/regenerate
router.post('/regenerate', async (req, res) => {
  const { originalRequest, editInstruction } = req.body;

  if (!originalRequest?.destinations?.length) {
    return res.status(400).json({ error: 'Missing originalRequest' });
  }

  try {
    const weatherResults = await Promise.all(originalRequest.destinations.map(d => fetchWeather(d.city)));
    const weatherSummary = originalRequest.destinations.map((d, i) => ({
      city: d.city,
      dates: d.stopType === 'Day trip' ? d.departureDate : `${d.departureDate} to ${d.returnDate}`,
      stopType: d.stopType || 'Stay',
      weather: weatherResults[i].summary,
    }));

    const result = await generateOutfits(originalRequest, weatherSummary, editInstruction || '');
    res.json(result);
  } catch (err) {
    console.error('Regenerate error:', err.message);
    res.status(500).json({ error: err.message || 'Something went wrong — please try again' });
  }
});

module.exports = router;
