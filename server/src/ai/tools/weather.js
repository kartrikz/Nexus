/**
 * Weather tool — OpenWeatherMap integration.
 *
 * Requires OPENWEATHER_API_KEY in .env for live data.
 * If the key is missing or the API call fails, the tool returns a clear
 * error message instead of fabricated weather data.
 */

const weatherTool = {
  name: 'weather',
  description:
    'Get current weather conditions for a specific city. ' +
    'The user MUST provide a city name. If the user has not specified a city, ' +
    'do NOT call this tool — instead ask the user which city they want weather for.',
  parameters: {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description:
          'The city name to look up, e.g. "Coimbatore", "Chennai", "London". ' +
          'Use only the city name (optionally with country code like "Chennai,IN"). ' +
          'Do NOT pass vague regions — pass a specific city.'
      },
      units: {
        type: 'string',
        enum: ['metric', 'imperial'],
        description: 'Temperature units (metric for Celsius, imperial for Fahrenheit). Defaults to metric.'
      }
    },
    required: ['location']
  },

  execute: async ({ location, units = 'metric' }) => {
    // ── Guard: missing location ──────────────────────────────────────
    if (!location || !location.trim()) {
      return {
        error: true,
        message:
          'No location was provided. Please ask the user which city they want weather for before calling this tool.'
      };
    }

    const trimmedLocation = location.trim();

    // ── Guard: missing API key ───────────────────────────────────────
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey || !apiKey.trim()) {
      return {
        error: true,
        message:
          'Weather data is currently unavailable because the OPENWEATHER_API_KEY is not configured. ' +
          'Please ask the administrator to add a valid OpenWeatherMap API key to the server .env file.'
      };
    }

    // ── Call OpenWeatherMap API ───────────────────────────────────────
    const unitSymbol = units === 'imperial' ? '°F' : '°C';

    try {
      const url =
        `https://api.openweathermap.org/data/2.5/weather` +
        `?q=${encodeURIComponent(trimmedLocation)}` +
        `&units=${units}` +
        `&appid=${apiKey.trim()}`;

      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        // OpenWeatherMap returns { cod: "404", message: "city not found" } etc.
        const apiMsg = data?.message || `HTTP ${res.status}`;
        return {
          error: true,
          message:
            `Weather API error for "${trimmedLocation}": ${apiMsg}. ` +
            'The location may be misspelled or too vague. Try a specific city name (e.g. "Coimbatore" instead of "Tamil Nadu").'
        };
      }

      return {
        location: `${data.name}, ${data.sys?.country || ''}`.trim(),
        temperature: `${Math.round(data.main.temp)}${unitSymbol}`,
        feels_like: `${Math.round(data.main.feels_like)}${unitSymbol}`,
        condition: data.weather?.[0]?.description || 'Unknown',
        humidity: `${data.main.humidity}%`,
        wind_speed: `${data.wind.speed} ${units === 'imperial' ? 'mph' : 'm/s'}`,
        source: 'OpenWeatherMap (live)'
      };
    } catch (err) {
      return {
        error: true,
        message:
          `Failed to fetch weather for "${trimmedLocation}": ${err.message}. ` +
          'This may be a network issue. Please try again later.'
      };
    }
  }
};

module.exports = { weatherTool };
