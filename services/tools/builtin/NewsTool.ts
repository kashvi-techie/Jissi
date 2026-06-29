import { Tool } from '../types';

const API_KEY = process.env.EXPO_PUBLIC_NEWS_API_KEY?.trim();

const CATEGORIES = [
  'top',
  'technology',
  'business',
  'science',
  'sports',
  'health',
  'entertainment',
  'world',
  'politics',
] as const;

/**
 * Latest news headlines via NewsData.io (works on real devices, not just
 * localhost). Self-gates on the API key. The LLM turns the returned headlines
 * into a short spoken summary.
 */
export const NewsTool: Tool = {
  name: 'get_news',
  description:
    'Get CURRENT real-time news headlines. Use whenever the user asks about news, headlines, or "what is happening" in a topic (e.g. AI, technology, sports). Returns the latest headlines to summarize aloud.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Topic to search, e.g. "AI", "cricket", "elections". Optional.' },
      category: {
        type: 'string',
        enum: [...CATEGORIES],
        description: 'News category. Optional — use "top" for general headlines.',
      },
    },
    required: [],
  },
  isAvailable: () => !!API_KEY,
  async execute(args) {
    if (!API_KEY) {
      return { success: false, humanReadable: 'News is not configured.', error: 'no_api_key' };
    }
    const query = String(args.query ?? '').trim();
    const category = String(args.category ?? '').trim();

    const params = new URLSearchParams({ apikey: API_KEY, language: 'en' });
    if (query) params.set('q', query);
    if (category && category !== 'top') params.set('category', category);

    const url = `https://newsdata.io/api/1/latest?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      let body = '';
      try {
        body = await res.text();
      } catch {
        /* ignore */
      }
      return {
        success: false,
        humanReadable: "Couldn't fetch the news right now.",
        error: `http_${res.status}`,
        metadata: { body: body.slice(0, 200) },
      };
    }

    const d: any = await res.json();
    const results: any[] = Array.isArray(d?.results) ? d.results : [];
    const top = results.slice(0, 5).map((r) => ({
      title: String(r?.title ?? '').trim(),
      source: r?.source_id ?? r?.source_name ?? '',
    }));

    if (top.length === 0) {
      return { success: true, humanReadable: `No recent headlines found${query ? ` for "${query}"` : ''}.`, data: [] };
    }

    const lines = top.map((h, i) => `${i + 1}. ${h.title}${h.source ? ` (${h.source})` : ''}`).join('\n');
    const label = query ? `Top headlines for "${query}"` : category ? `Top ${category} headlines` : 'Top headlines';
    return {
      success: true,
      data: top,
      humanReadable: `${label}:\n${lines}`,
      cacheable: true,
      ttl: 300,
    };
  },
};
