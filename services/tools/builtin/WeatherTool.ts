import { Tool } from '../types';

const API_KEY = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY?.trim();

/** Live weather via OpenWeather. Self-gates on the API key being configured. */
export const WeatherTool: Tool = {
  name: 'get_weather',
  description:
    'Get the CURRENT weather for a city (real-time). Use whenever the user asks about weather, temperature, or conditions somewhere.',
  parameters: {
    type: 'object',
    properties: {
      city: { type: 'string', description: 'City name, e.g. "London" or "Mumbai"' },
      units: { type: 'string', enum: ['metric', 'imperial'], description: 'metric = °C, imperial = °F' },
    },
    required: ['city'],
  },
  isAvailable: () => !!API_KEY,
  async execute(args) {
    if (!API_KEY) {
      return { success: false, humanReadable: 'Weather is not configured.', error: 'no_api_key' };
    }
    const city = String(args.city ?? '').trim();
    const units = args.units === 'imperial' ? 'imperial' : 'metric';
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=${units}&appid=${API_KEY}`;

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
        humanReadable: `Couldn't get the weather for "${city}".`,
        error: `http_${res.status}`,
        metadata: { body: body.slice(0, 200) },
      };
    }

    const d: any = await res.json();
    const temp = d?.main?.temp;
    const desc = d?.weather?.[0]?.description;
    const unitLabel = units === 'imperial' ? '°F' : '°C';
    return {
      success: true,
      data: { city: d?.name, temp, description: desc, humidity: d?.main?.humidity, feelsLike: d?.main?.feels_like },
      humanReadable: `${d?.name}: ${Math.round(Number(temp))}${unitLabel}, ${desc}.`,
      cacheable: true,
      ttl: 600,
    };
  },
};
