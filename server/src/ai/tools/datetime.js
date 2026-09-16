/**
 * Real-time clock and timezone tool for NexusMind.
 */

const TIMEZONE_MAP = {
  tokyo: 'Asia/Tokyo',
  japan: 'Asia/Tokyo',
  london: 'Europe/London',
  uk: 'Europe/London',
  'new york': 'America/New_York',
  ny: 'America/New_York',
  est: 'America/New_York',
  edt: 'America/New_York',
  california: 'America/Los_Angeles',
  la: 'America/Los_Angeles',
  pst: 'America/Los_Angeles',
  pdt: 'America/Los_Angeles',
  paris: 'Europe/Paris',
  berlin: 'Europe/Berlin',
  india: 'Asia/Kolkata',
  ist: 'Asia/Kolkata',
  delhi: 'Asia/Kolkata',
  sydney: 'Australia/Sydney',
  singapore: 'Asia/Singapore',
  utc: 'UTC',
  gmt: 'UTC'
};

function resolveTimezone(tz) {
  if (!tz) return 'UTC';
  const clean = tz.trim().toLowerCase();
  if (TIMEZONE_MAP[clean]) return TIMEZONE_MAP[clean];
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

const datetimeTool = {
  name: 'datetime',
  description: 'Get the exact current real-world date, time, day of the week, or convert times across timezones.',
  parameters: {
    type: 'object',
    properties: {
      timezone: {
        type: 'string',
        description: 'Optional timezone or city name, e.g. "Tokyo", "London", "America/New_York", "UTC"'
      },
      offsetHours: {
        type: 'number',
        description: 'Optional offset in hours to add or subtract from current time (e.g. +6, -3)'
      }
    }
  },
  execute: async ({ timezone = 'UTC', offsetHours = 0 } = {}) => {
    try {
      const targetTz = resolveTimezone(timezone);
      const now = new Date();

      if (offsetHours && typeof offsetHours === 'number') {
        now.setTime(now.getTime() + offsetHours * 60 * 60 * 1000);
      }

      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: targetTz,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZoneName: 'short'
      });

      const formatted = formatter.format(now);
      const iso = now.toISOString();

      return {
        iso,
        formatted,
        timezone: targetTz,
        offsetHoursApplied: offsetHours || 0,
        dayOfWeek: new Intl.DateTimeFormat('en-US', { timeZone: targetTz, weekday: 'long' }).format(now)
      };
    } catch (err) {
      return { error: err.message };
    }
  }
};

module.exports = {
  datetimeTool,
  resolveTimezone
};
