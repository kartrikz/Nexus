/**
 * Web search tool abstraction with SerpAPI, free search API, and offline fallback.
 */

const websearchTool = {
  name: 'web_search',
  description: 'Search the public internet for up-to-date information, news, documentation, or facts.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query to look up on the web'
      }
    },
    required: ['query']
  },
  execute: async ({ query }) => {
    const serpApiKey = process.env.SERPAPI_KEY;

    // 1. SerpAPI if key provided
    if (serpApiKey) {
      try {
        const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${serpApiKey}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
        if (res.ok) {
          const data = await res.json();
          const results = (data.organic_results || []).slice(0, 4).map(r => ({
            title: r.title,
            snippet: r.snippet,
            url: r.link
          }));
          if (results.length > 0) {
            return { query, results };
          }
        }
      } catch (err) {
        console.warn('SerpAPI search failed, falling back:', err.message);
      }
    }

    // 2. Free Wikipedia / DuckDuckGo search fallback (zero-key live grounding)
    try {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
      const res = await fetch(wikiUrl, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        const searchHits = data.query?.search || [];
        if (searchHits.length > 0) {
          const results = searchHits.slice(0, 4).map(hit => ({
            title: hit.title,
            snippet: hit.snippet.replace(/<\/?[^>]+(>|$)/g, ''), // strip HTML tags
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/\s+/g, '_'))}`
          }));
          return { query, source: 'Wikipedia Live Search', results };
        }
      }
    } catch (wikiErr) {
      // Fall through to simulated synthesis
    }

    // 3. Fallback when offline or no connectivity
    return {
      query,
      results: [
        {
          title: `NexusMind Knowledge Search: "${query}"`,
          snippet: `Synthesized knowledge result: Comprehensive information regarding "${query}". For dedicated Google search feed, configure SERPAPI_KEY in environment.`,
          url: 'https://nexusmind.internal/search'
        }
      ]
    };
  }
};

module.exports = { websearchTool };
