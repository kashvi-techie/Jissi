import { Tool } from '../types';

// Real-time web search via Tavily (built for LLMs, generous free tier).
// Self-gates: until EXPO_PUBLIC_TAVILY_API_KEY is set the tool is hidden from the
// LLM, so the assistant simply answers from its own knowledge instead.
const API_KEY = process.env.EXPO_PUBLIC_TAVILY_API_KEY?.trim();

export const WebSearchTool: Tool = {
  name: 'web_search',
  description:
    'Search the live web for CURRENT or factual information the model may not know (recent events, prices, people, "look this up"). Returns a short answer plus top sources to summarize aloud.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query.' },
    },
    required: ['query'],
  },
  isAvailable: () => !!API_KEY,
  async execute(args) {
    if (!API_KEY) {
      return { success: false, humanReadable: 'Web search is not configured.', error: 'no_api_key' };
    }
    const query = String(args.query ?? '').trim();
    if (!query) {
      return { success: false, humanReadable: 'No search query provided.', error: 'empty_query' };
    }

    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: API_KEY,
        query,
        max_results: 5,
        include_answer: true,
        search_depth: 'basic',
      }),
    });

    if (!res.ok) {
      let body = '';
      try {
        body = await res.text();
      } catch {
        /* ignore */
      }
      return {
        success: false,
        humanReadable: "Couldn't search the web right now.",
        error: `http_${res.status}`,
        metadata: { body: body.slice(0, 200) },
      };
    }

    const d: any = await res.json();
    const answer = String(d?.answer ?? '').trim();
    const results: any[] = Array.isArray(d?.results) ? d.results : [];
    const sources = results.slice(0, 5).map((r) => ({
      title: String(r?.title ?? '').trim(),
      url: r?.url ?? '',
      content: String(r?.content ?? '').slice(0, 300),
    }));

    const summary =
      (answer ? `${answer}\n\n` : '') +
      sources.map((s, i) => `${i + 1}. ${s.title}: ${s.content}`).join('\n');

    return {
      success: true,
      data: { answer, sources },
      humanReadable: summary || `No results found for "${query}".`,
      cacheable: true,
      ttl: 300,
    };
  },
};
