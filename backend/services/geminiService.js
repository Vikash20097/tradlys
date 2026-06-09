const axios = require('axios');
const FormData = require('form-data');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

const MASTER_PROMPT = `You are Tradlys AI, an advanced trading chart analysis assistant.

Analyze the given chart screenshot, user question, live market data, and news context deeply.

Your job is to provide educational trading analysis, not financial advice.

Never guarantee profit.
Never say 100% sure.
Never say confirmed trade.
Never use fake accuracy percentage.

Analyze:
1. Market structure
2. Trend direction
3. Support zones
4. Resistance zones
5. Breakout zones
6. Fakeout possibility
7. Liquidity zones
8. Candlestick behavior
9. Volume clue if visible
10. Momentum
11. Risk level
12. Bullish scenario
13. Bearish scenario
14. Sideways scenario
15. Entry zone logic
16. Stop loss logic
17. Target zone logic
18. Invalid condition
19. News impact
20. Live price context

Return ONLY valid JSON. No markdown code block, no explanations, no text outside JSON.

JSON format:
{
  "marketName": "<market_name>",
  "timeframe": "<timeframe>",
  "overallBias": "Bullish / Bearish / Sideways / Unclear",
  "trend": "<trend_description>",
  "supportZones": ["<zone1>", "<zone2>"],
  "resistanceZones": ["<zone1>", "<zone2>"],
  "bullishScenario": "<scenario>",
  "bearishScenario": "<scenario>",
  "sidewaysScenario": "<scenario>",
  "entryZoneLogic": "<logic>",
  "stopLossLogic": "<logic>",
  "targetZones": ["<target1>", "<target2>"],
  "riskLevel": "Low / Medium / High",
  "confidence": "Low / Medium / High",
  "keyReasons": ["<reason1>", "<reason2>"],
  "newsImpact": "<news_impact>",
  "liveMarketContext": "<context>",
  "finalEducationalNote": "This is educational analysis only, not financial advice."
}`;

const isQuotaError = (error) => {
  if (!error) return false;
  const status = error?.response?.status;
  const body = error?.response?.data || {};
  const message = typeof body === 'string' ? body : JSON.stringify(body);
  return status === 429 || message.includes('RESOURCE_EXHAUSTED') || message.includes('quota exceeded');
};

const buildQuotaFallback = (marketContext) => {
  const ctx = marketContext || {};
  const marketName = ctx.marketName || 'Generic';
  const timeframe = ctx.timeframe || 'Daily';
  const price = ctx.price || getPrice(ctx);
  const change = ctx.change || 'N/A';
  const sentiment = ctx.sentiment || 'Neutral';

  return {
    marketName,
    timeframe,
    overallBias: 'Unclear',
    trend: `Market data indicates ${sentiment} sentiment with price ${price}. AI quota exhausted, presenting educational fallback.`,
    marketStructure: ctx.marketStructure || 'Structure unclear due to limited AI quota.',
    liquidityZones: Array.isArray(ctx.liquidityZones) ? ctx.liquidityZones.slice(0, 2) : [],
    invalidConditions: Array.isArray(ctx.invalidConditions) ? ctx.invalidConditions.slice(0, 2) : [
      'No clear confirmation candle',
      'Quota exhausted — manual review recommended'
    ],
    supportZones: Array.isArray(ctx.supportZones) ? ctx.supportZones.slice(0, 2) : [],
    resistanceZones: Array.isArray(ctx.resistanceZones) ? ctx.resistanceZones.slice(0, 2) : [],
    bullishScenario: 'Wait for clear bullish confirmation with volume and momentum before entering.',
    bearishScenario: 'Monitor for potential breakdown below nearest support.',
    sidewaysScenario: 'Range-bound action likely; limit aggressive directional trades.',
    entryZoneLogic: 'Enter only with clear confirmation candle, valid R:R, and aligned market structure.',
    stopLossLogic: 'Place stop beyond nearest opposing structure; do not risk more than 1-2% per trade.',
    targetZones: [],
    riskLevel: 'Medium',
    confidence: 'Low',
    keyReasons: [
      'Gemini quota exceeded',
      'Using safe fallback educational template',
      'Manual chart review recommended'
    ],
    newsImpact: ctx.newsImpact || 'Review latest news manually for impact.',
    liveMarketContext: ctx.liveMarketContext || `Live data fallback. Price: ${price}, Change: ${change}.`,
    finalEducationalNote: 'This is educational analysis only, not financial advice.',
    fallback: true,
    note: 'Gemini quota exhausted. Fallback analysis shown.'
  };
};

const getPrice = (ctx) => {
  if (!ctx || !Array.isArray(ctx.marketData)) return '₹22,045.00';
  const nifty = ctx.marketData.find(item => String(item.symbol || '').toUpperCase() === 'NIFTY 50');
  const candidate = nifty || ctx.marketData[0];
  if (!candidate) return '₹22,045.00';
  const ltp = candidate.ltp ?? candidate.price ?? candidate.ltpINR;
  return typeof ltp === 'number' ? `₹${ltp.toLocaleString('en-IN')}` : '₹22,045.00';
};

const analyzeImage = async (imagePath, userQuestion, marketContext) => {
  try {
    const fs = require('fs');
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');

    let promptText = MASTER_PROMPT;
    if (userQuestion) {
      promptText += `\n\nUser Question: ${userQuestion}`;
    }
    if (marketContext) {
      promptText += `\n\nLive Market Context: ${JSON.stringify(marketContext)}`;
    }

    const payload = {
      contents: [
        {
          parts: [
            { text: promptText },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: base64Image
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096
      }
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const response = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000
    });

    const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Empty response from Gemini');
    }

    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (!parsed.marketName || !parsed.overallBias || !Array.isArray(parsed.keyReasons)) {
      throw new Error('Invalid JSON structure from AI');
    }

    return parsed;
  } catch (error) {
    const safeCtx = marketContext || {};
    if (isQuotaError(error)) {
      console.error('Gemini quota exhausted in analyzeImage:', error.response?.status || error.message);
      return buildQuotaFallback(safeCtx);
    }
    console.error('Gemini image analysis error (fallback returned):', error.response?.data || error.message);
    return buildQuotaFallback(safeCtx);
  }
};

const analyzeText = async (userQuestion, marketContext) => {
  try {
    let promptText = MASTER_PROMPT;
    if (userQuestion) {
      promptText += `\n\nUser Question: ${userQuestion}`;
    }
    if (marketContext) {
      promptText += `\n\nLive Market Context: ${JSON.stringify(marketContext)}`;
    }

    const payload = {
      contents: [
        {
          parts: [
            { text: promptText }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096
      }
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const response = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000
    });

    const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Empty response from Gemini');
    }

    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (!parsed.marketName && !parsed.overallBias) {
      throw new Error('Invalid JSON structure from AI');
    }

    return parsed;
  } catch (error) {
    const safeCtx = marketContext || {};
    if (isQuotaError(error)) {
      console.error('Gemini quota exhausted in analyzeText:', error.response?.status || error.message);
      return buildQuotaFallback(safeCtx);
    }
    console.error('Gemini text analysis error (fallback returned):', error.response?.data || error.message);
    return buildQuotaFallback(safeCtx);
  }
};

module.exports = { analyzeImage, analyzeText, buildQuotaFallback };
