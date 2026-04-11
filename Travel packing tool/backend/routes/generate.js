const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');

// Sanitize free-text itinerary field to prevent prompt injection
function sanitizeItinerary(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .slice(0, 2000)
    .replace(/\bignore\b.*?\binstructions?\b/gi, '[removed]')
    .replace(/\bforget\b.*?\babove\b/gi, '[removed]')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .trim();
}

// WMO weather code → human-readable description
const WMO_DESCRIPTIONS = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Icy fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Rain showers', 81: 'Showers', 82: 'Heavy showers',
  85: 'Snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm w/ hail', 99: 'Heavy thunderstorm',
};

function wmoToDesc(code) {
  return WMO_DESCRIPTIONS[code] || 'Variable conditions';
}

function mostCommonCode(codes) {
  if (!codes?.length) return 2;
  const counts = {};
  codes.forEach(c => { counts[c] = (counts[c] || 0) + 1; });
  return parseInt(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]);
}

// Use Open-Meteo archive API for historical per-day data (fallback for trips > 16 days out)
// Returns per-day data mapped from the same dates last year, so WeatherView can show daily cards.
async function getMonthlyAverage(lat, lon, city, departureDate, returnDate) {
  const depDate = new Date(departureDate + 'T12:00:00');
  const retDate = returnDate ? new Date(returnDate + 'T12:00:00') : depDate;
  const prevYear = depDate.getFullYear() - 1;
  const monthName = depDate.toLocaleDateString('en-US', { month: 'short' });

  // Fetch archive covering the trip range from last year
  const startMonth = depDate.getMonth() + 1;
  const endMonth = retDate.getMonth() + 1;
  const startStr = `${prevYear}-${String(startMonth).padStart(2, '0')}-01`;
  const endLastDay = new Date(prevYear, endMonth, 0).getDate();
  const endStr = `${prevYear}-${String(endMonth).padStart(2, '0')}-${endLastDay}`;

  try {
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
      `&start_date=${startStr}&end_date=${endStr}` +
      `&daily=temperature_2m_max,temperature_2m_min,weathercode&temperature_unit=fahrenheit&timezone=UTC`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.daily?.time?.length) throw new Error('No archive data');

    const archiveTimes = data.daily.time; // array of "YYYY-MM-DD" strings

    // Map each trip day to its corresponding last-year date
    const dailyData = [];
    for (let dt = new Date(depDate); dt <= retDate; dt.setDate(dt.getDate() + 1)) {
      const tripDate = dt.toISOString().slice(0, 10);
      const prevDate = `${prevYear}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      const idx = archiveTimes.indexOf(prevDate);
      if (idx >= 0 && data.daily.temperature_2m_max[idx] != null) {
        dailyData.push({
          date: tripDate,
          high: Math.round(data.daily.temperature_2m_max[idx]),
          low: Math.round(data.daily.temperature_2m_min[idx]),
          condition: wmoToDesc(data.daily.weathercode[idx]),
        });
      }
    }

    // Overall summary from the trip days
    const highs = dailyData.map(d => d.high);
    const lows = dailyData.map(d => d.low);
    const allHighs = data.daily.temperature_2m_max.filter(v => v != null);
    const allLows = data.daily.temperature_2m_min.filter(v => v != null);
    const avgHigh = highs.length ? Math.round(Math.max(...highs)) : Math.round(allHighs.reduce((a, b) => a + b, 0) / allHighs.length);
    const avgLow = lows.length ? Math.round(Math.min(...lows)) : Math.round(allLows.reduce((a, b) => a + b, 0) / allLows.length);
    const condition = wmoToDesc(mostCommonCode(data.daily.weathercode));

    return {
      summary: `${avgLow}–${avgHigh}°F, ${condition}`,
      location: city,
      isAverage: true,
      monthLabel: monthName,
      dailyData: dailyData.length > 0 ? dailyData : null,
    };
  } catch (err) {
    console.error('Archive weather error:', err.message);
    return { summary: null, location: city, isAverage: true, monthLabel: monthName };
  }
}

// Geocode a city name via Open-Meteo (no API key required).
// Tries progressively shorter forms to handle hotel names, neighborhoods, etc.
async function geocodeCity(city) {
  const tryGeocode = async (name) => {
    if (!name || name.length < 2) return null;
    const r = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`
    );
    const d = await r.json();
    return d.results?.[0] || null;
  };

  // 1. Full name as-is
  let result = await tryGeocode(city);
  if (result) return result;

  // 2. Strip state/country suffix: "Kahala, Oahu" → "Kahala"
  const beforeComma = city.split(',')[0].trim();
  if (beforeComma !== city) {
    result = await tryGeocode(beforeComma);
    if (result) return result;
  }

  // 3. Strip known non-geographic words (Hotel, Resort, &, at, near, etc.)
  const stripped = beforeComma
    .replace(/\b(hotel|resort|&|and|at|near|spa|suites?|inn|lodge|villa|club|estate|beach|ocean)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (stripped && stripped !== beforeComma) {
    result = await tryGeocode(stripped);
    if (result) return result;
  }

  // 4. First two words
  const words = (stripped || beforeComma).split(/\s+/);
  if (words.length > 2) {
    result = await tryGeocode(words.slice(0, 2).join(' '));
    if (result) return result;
  }

  // 5. First word only (last resort)
  if (words.length > 1) {
    result = await tryGeocode(words[0]);
    if (result) return result;
  }

  return null;
}

// Fetch weather using Open-Meteo (free, no API key required)
// - Within 16 days: real forecast filtered to trip dates
// - Beyond 16 days: historical monthly averages from same month last year
// Returns null summary on failure so callers can skip display gracefully
async function fetchWeather(destination) {
  const city = typeof destination === 'string' ? destination : destination.city;
  const departureDate = typeof destination === 'object' ? destination.departureDate : null;
  const returnDate = typeof destination === 'object' ? (destination.returnDate || departureDate) : null;

  try {
    const geoResult = await geocodeCity(city);
    if (!geoResult) {
      console.warn(`Weather: could not geocode "${city}"`);
      return { summary: null, location: city, isAverage: false };
    }
    const { latitude, longitude } = geoResult;

    const refDate = departureDate || new Date().toISOString().split('T')[0];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tripStart = new Date(refDate + 'T00:00:00');
    const daysUntilTrip = Math.round((tripStart - today) / (1000 * 60 * 60 * 24));

    if (daysUntilTrip <= 15) {
      // Use Open-Meteo 16-day forecast with hourly temps + precip
      const forecastRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
        `&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max` +
        `&hourly=temperature_2m,weathercode&temperature_unit=fahrenheit&timezone=auto&forecast_days=16`
      );
      const forecastData = await forecastRes.json();

      if (!forecastData.daily?.time?.length) throw new Error('Empty forecast response');

      const tripEnd = returnDate || refDate;
      const dailyTimes = forecastData.daily.time;
      const hourlyTemps = forecastData.hourly?.temperature_2m || [];
      const hourlyCodes = forecastData.hourly?.weathercode || [];

      console.log(`[weather] ${city}: ${dailyTimes.length} forecast days available`);

      // Show the full available forecast window — don't filter to trip dates only
      // so users can see what weather is coming regardless of exact plan timing
      const relevant = dailyTimes.map((date, i) => ({
        date,
        high: forecastData.daily.temperature_2m_max[i],
        low: forecastData.daily.temperature_2m_min[i],
        code: forecastData.daily.weathercode[i],
        precipProb: forecastData.daily.precipitation_probability_max?.[i] ?? null,
        morning:          hourlyTemps[i * 24 + 8]  != null ? Math.round(hourlyTemps[i * 24 + 8])  : null,
        afternoon:        hourlyTemps[i * 24 + 14] != null ? Math.round(hourlyTemps[i * 24 + 14]) : null,
        evening:          hourlyTemps[i * 24 + 20] != null ? Math.round(hourlyTemps[i * 24 + 20]) : null,
        morningCondition:   hourlyCodes[i * 24 + 8]  != null ? wmoToDesc(hourlyCodes[i * 24 + 8])  : null,
        afternoonCondition: hourlyCodes[i * 24 + 14] != null ? wmoToDesc(hourlyCodes[i * 24 + 14]) : null,
        eveningCondition:   hourlyCodes[i * 24 + 20] != null ? wmoToDesc(hourlyCodes[i * 24 + 20]) : null,
      }));

      if (!relevant.length) {
        return await getMonthlyAverage(latitude, longitude, city, refDate, returnDate);
      }

      const high = Math.round(Math.max(...relevant.map(d => d.high)));
      const low = Math.round(Math.min(...relevant.map(d => d.low)));
      const condition = wmoToDesc(mostCommonCode(relevant.map(d => d.code)));
      const dailyData = relevant.map(d => ({
        date: d.date,
        high: Math.round(d.high),
        low: Math.round(d.low),
        condition: wmoToDesc(d.code),
        precipProb: d.precipProb,
        morning: d.morning,
        afternoon: d.afternoon,
        evening: d.evening,
        morningCondition: d.morningCondition,
        afternoonCondition: d.afternoonCondition,
        eveningCondition: d.eveningCondition,
      }));

      return { summary: `${low}–${high}°F, ${condition}`, location: city, isAverage: false, dailyData };
    } else {
      return await getMonthlyAverage(latitude, longitude, city, refDate, returnDate);
    }
  } catch (err) {
    console.error('Weather fetch error:', err.message);
    return { summary: null, location: city, isAverage: false };
  }
}

// Carry-on item limit scales with trip length
function carryOnLimit(totalDays) {
  if (totalDays <= 2) return 10;
  if (totalDays <= 5) return 15;
  if (totalDays <= 9) return 20;
  return 25;
}

// Fixed item limit for checked bags — consistent across all trip lengths
const CHECKED_BAG_LIMIT = 40;

// Count calendar days across all destinations
function countTripDays(destinations) {
  const allDates = new Set();
  for (const d of destinations) {
    const start = new Date(d.departureDate);
    const end = d.stopType === 'Day trip' ? start : new Date(d.returnDate);
    for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
      allDates.add(dt.toISOString().slice(0, 10));
    }
  }
  return allDates.size || 1;
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
- TRAVEL DAY RULE: ONLY add a "Travel" outfit slot when the day literally involves boarding a commercial flight or long-distance train (e.g. "Flight to Honolulu", "Train to Paris", "fly to NYC"). That's it. The ONLY triggers are the words "flight", "fly", "flying", "airport", "train to [city]", "Amtrak", or similar explicit long-haul transit. NEVER add a Travel outfit for: Uber/taxi/rideshare, local bus, hotel check-in, day trips, hikes, snorkeling, beach days, activities, excursions, sightseeing, or any local movement within a destination. If you are not 100% certain the person is boarding a plane or intercity train that day, do NOT add a Transit outfit. One Travel outfit per trip is typical — a 10-day Hawaii trip usually has exactly one (the outbound flight). Use time: "Travel", type: "Transit". For FEMALE travelers: comfortable and non-restrictive — leggings, soft joggers, or a flowy midi skirt. NEVER jeans for females. For MALE travelers: dark jeans or chinos are fine. Always casual: soft layer, sneakers or slip-ons.
- TRAVEL DAY ITEMS DO NOT COUNT toward the carry-on limit — these items are WORN not packed. The carry-on limit applies only to packed items. List travel day items in the packing list under "Travel Day" category but exclude them from your item total.
- WORKOUT SLOTS: When includeWorkouts is true, add workout slots intelligently — NOT on every day. Skip transit days and day trip days entirely. If the itinerary mentions a specific number of workouts, use exactly that number spread evenly. Otherwise, add workouts on roughly every other eligible day (e.g. for a 7-day trip with 5 eligible days: days 1, 3, 5). Use EXACTLY: { "time": "Workout", "type": "Activewear", "items": ["..."] }. The "type" field MUST be exactly "Activewear". When includeWorkouts is false, include ZERO workout slots.
- CLOTHING SPECIFICITY: Two tiers. (1) BASICS — underwear, bras, socks, activewear, swimwear, and simple tops: use plain generic names only. "Sports bra" not "moisture-wicking high-impact sports bra". "Leggings" not "high-waist compression leggings". "Swim shorts" not "quick-dry board shorts". "Tank top" not "ribbed fitted tank". Keep basics to 2 words maximum. (2) FEATURED OUTFITS — main daytime/evening looks: include one style or fabric descriptor to make it interesting (e.g. "linen wide-leg trousers", "flowy midi dress", "relaxed chino shorts", "fitted blazer", "wrap dress"). Never specify colors, brands, or performance features.
- DAY EVENTS: The "events" field must be very brief — 3–6 words maximum (e.g. "Business meetings", "Beach day", "Flight to NYC", "Hanauma Bay snorkeling"). No full sentences.
- FOOTWEAR & OUTERWEAR: Always include footwear appropriate for the weather and activities, even if not listed in individual outfit items. If rain is forecast, include a packable rain jacket. If cold or snowy, include a warm outer layer or puffer. If hiking is planned, include appropriate hiking footwear. These go in the packing list even when they span multiple outfits. Every outfit must reference its shoes and jacket/layer — do not leave footwear and outerwear out of outfit items.
- REWEARABILITY: Activewear (leggings, sports bras, shorts) can be reused 2-3 times with washing between uses — do not pack a fresh set for every workout. Swimwear can be rinsed and reused — 1-2 swimsuits maximum unless the itinerary has daily swimming over many days. Plan quantities to account for washing and drying time. If a 5-day trip has 3 workouts, 1-2 sets of activewear is sufficient.
- PACKING LIST CONSISTENCY (CRITICAL): The packing list MUST contain every item referenced across all outfit entries. Cross-check before outputting: every item mentioned in any outfit's "items" array must appear in the packing list with an appropriate quantity. Do not list items in outfits that do not appear in the packing list. The packing list is the source of truth for what the traveler will pack.
- Reuse items across non-travel days to minimize packing — the goal is carry-on only
- EXTRAS CATEGORIES: After the clothing/shoes categories, always include these non-clothing categories. These do NOT count toward the item limit.
  • "Undergarments" — underwear and bras in quantities matching the trip length (e.g. 5 days = 5 pairs underwear, 3-4 bras for women or none for men unless relevant). Keep names generic: "Underwear", "Bra", "Socks".
  • "Toiletries" — travel-sized essentials only: face wash, moisturizer, SPF, deodorant, toothbrush, toothpaste, razor, shampoo/conditioner (or dry shampoo). Add sunscreen if beach, outdoor, or tropical trip. Qty 1 each unless noted.
  • "Electronics" — always include: phone charger, headphones/earbuds, power bank. Add universal adapter if international travel. Add laptop/tablet only if explicitly mentioned in itinerary.
  • "Makeup & Beauty" — ONLY for female travelers. Keep it minimal: foundation/BB cream, mascara, lip color, eyebrow pencil, setting spray. Skip if the itinerary is casual/outdoor/beach-focused.
  • "Travel Essentials" — passport (if international), travel wallet, TSA lock, reusable water bottle, any trip-specific items (e.g. sunscreen already in toiletries can be skipped here). Skip obvious items the traveler always carries.
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
      : '';
    const weatherStr = w.weather || 'Weather data unavailable — pack for typical seasonal conditions';
    const weatherNote = w.isAverage && w.monthLabel
      ? ` (${w.monthLabel} historical average — plan for typical seasonal conditions)`
      : '';
    return `  - ${w.city} (${w.dates})${typeNote}: ${weatherStr}${weatherNote}`;
  }).join('\n');

  // Compute transit dates
  const transitDateSet = new Set();
  for (const d of tripData.destinations) {
    if (d.departureDate) transitDateSet.add(d.departureDate);
    if (d.returnDate && d.stopType !== 'Day trip') transitDateSet.add(d.returnDate);
    if (d.stopType === 'Day trip' && d.departureDate) transitDateSet.add(d.departureDate);
  }
  const transitDates = Array.from(transitDateSet).sort().join(', ');

  const totalDays = countTripDays(tripData.destinations);
  const checkedBag = tripData.bagType === 'Checked bag';
  const maxItems = checkedBag ? CHECKED_BAG_LIMIT : carryOnLimit(totalDays);
  const limitLine = checkedBag
    ? `Bag type: Checked bag. Hard item limit: ${CHECKED_BAG_LIMIT} items total (clothing and shoes only). Pack a complete, varied wardrobe — no need to minimize or aggressively reuse. Aim close to the ${CHECKED_BAG_LIMIT}-item limit so the traveler has full outfit flexibility.`
    : `Packing list hard limit: ${maxItems} items total (clothing and shoes only). Count every qty. Stay under this number — every item must earn its place.`;

  const userPrompt = `Destinations and weather:
${destinationDetails}
Transit dates (MUST include Travel outfit on each): ${transitDates}
${limitLine}
Trip type: ${tripData.tripType}
Gender: ${tripData.gender}
Include workouts: ${tripData.includeWorkouts !== false ? 'Yes — add WORKOUT slots for any fitness/exercise/run/gym/swim activities mentioned in the itinerary' : 'No — omit all workout outfit slots'}
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
      const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      const parsed = JSON.parse(text);

      if (!parsed.days || !Array.isArray(parsed.days) || !parsed.packingList || !Array.isArray(parsed.packingList)) {
        throw new Error('Response missing required fields');
      }

      // Travel day and extras categories don't count toward clothing carry-on limit
      const isExcluded = cat => /travel.?day|transit|toiletri|electron|tech|makeup|beauty|cosmetic|essential|document|undergar|underwear|lingerie/i.test(cat.category)
      const totalItems = parsed.packingList
        .filter(cat => !isExcluded(cat))
        .reduce((sum, cat) => sum + cat.items.reduce((s, item) => s + (item.qty || 1), 0), 0);

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
  const { destinations, tripType, gender, itinerary, bagType, includeWorkouts } = req.body;

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
    const weatherResults = await Promise.all(destinations.map(d => fetchWeather(d)));
    const weatherSummary = destinations.map((d, i) => ({
      city: d.city,
      dates: d.stopType === 'Day trip' ? d.departureDate : `${d.departureDate} to ${d.returnDate}`,
      stopType: d.stopType || 'Stay',
      weather: weatherResults[i].summary,
      isAverage: weatherResults[i].isAverage || false,
      monthLabel: weatherResults[i].monthLabel || null,
      dailyData: weatherResults[i].dailyData || null,
    }));

    const tripData = { destinations, tripType, gender: gender || 'Male', itinerary, bagType: bagType || 'Carry-on', includeWorkouts: includeWorkouts !== false };
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
    const weatherResults = await Promise.all(originalRequest.destinations.map(d => fetchWeather(d)));
    const weatherSummary = originalRequest.destinations.map((d, i) => ({
      city: d.city,
      dates: d.stopType === 'Day trip' ? d.departureDate : `${d.departureDate} to ${d.returnDate}`,
      stopType: d.stopType || 'Stay',
      weather: weatherResults[i].summary,
      isAverage: weatherResults[i].isAverage || false,
      monthLabel: weatherResults[i].monthLabel || null,
      dailyData: weatherResults[i].dailyData || null,
    }));

    const result = await generateOutfits(originalRequest, weatherSummary, editInstruction || '');
    res.json(result);
  } catch (err) {
    console.error('Regenerate error:', err.message);
    res.status(500).json({ error: err.message || 'Something went wrong — please try again' });
  }
});

module.exports = router;
