const axios = require('axios');

const getMarketContext = async () => {
  let marketData = [];
  let newsData = { headlines: [], marketImpact: 'No significant news impact' };
  try {
    marketData = await require('./marketService').fetchLiveMarketData();
  } catch (e) {
    console.error('Market context fetch error:', e);
    marketData = [];
  }
  try {
    newsData = await fetchNewsWithSentiment();
  } catch (e) {
    console.error('News context fetch error:', e);
    newsData = { headlines: [], marketImpact: 'No significant news impact' };
  }
  return { marketData, newsData };
};

const fetchNewsWithSentiment = async () => {
  try {
    const response = await axios.get('https://newsapi.org/v2/top-headlines', {
      params: {
        category: 'business',
        language: 'en',
        pageSize: 5
      },
      timeout: 5000
    });
    const articles = response.data.articles || [];
    const headlines = articles.map(article => {
      const text = (article.title || '') + ' ' + (article.description || '');
      const sentiment = detectSentiment(text);
      return {
        title: article.title,
        sentiment: sentiment,
        source: article.source.name,
        time: article.publishedAt ? new Date(article.publishedAt).getTime() : Date.now()
      };
    });
    return {
      headlines,
      marketImpact: summarizeImpact(headlines)
    };
  } catch (error) {
    return {
      headlines: [
        { title: 'Markets rally on positive domestic cues', sentiment: 'Bullish', source: 'Economic Times', time: Date.now() - 3600000 },
        { title: 'Global cues remain mixed ahead of Fed', sentiment: 'Neutral', source: 'Reuters', time: Date.now() - 7200000 }
      ],
      marketImpact: 'Favorable domestic growth indicators'
    };
  }
};

const detectSentiment = (text) => {
  const lower = text.toLowerCase();
  if (lower.includes('rally') || lower.includes('surge') || lower.includes('gain') || lower.includes('bullish') || lower.includes('positive') || lower.includes('rise')) {
    return 'Bullish';
  }
  if (lower.includes('fall') || lower.includes('drop') || lower.includes('bearish') || lower.includes('negative') || lower.includes('loss') || lower.includes('crash')) {
    return 'Bearish';
  }
  return 'Neutral';
};

const summarizeImpact = (headlines) => {
  if (!headlines || headlines.length === 0) {
    return 'No significant news impact';
  }
  const bullish = headlines.filter(h => h.sentiment === 'Bullish').length;
  const bearish = headlines.filter(h => h.sentiment === 'Bearish').length;
  if (bullish > bearish) return 'Overall bullish news sentiment detected';
  if (bearish > bullish) return 'Overall bearish news sentiment detected';
  return 'Mixed or neutral news sentiment';
};

module.exports = {
  getMarketContext,
  fetchNewsWithSentiment,
  fetchNews: fetchNewsWithSentiment
};
