/**
 * CRMNow DateTime & Date Utility Module
 *
 * Provides metadata-driven, timezone-safe date and datetime validation and formatting.
 * - Enforces separate validation contracts for 'date' and 'datetime'.
 * - Rejects nonexistent DST spring-forward local times (HTTP 400).
 * - Resolves ambiguous DST fall-back local times with explicit policy ('earlier' / 'later')
 *   or preserves floating wall-clock representation.
 * - Dynamic non-hour DST adaptability (supports 30-min transitions like Australia/Lord_Howe).
 * - Deterministic date format resolution (DD/MM/YYYY vs MM/DD/YYYY) rejecting ambiguous dates
 *   unless an explicit format preference is provided.
 * - Universal missing indicator / placeholder coercion (-, N/A, None -> null).
 * - Universal epoch millisecond and second timestamp parsing.
 * - Universal textual month name support (Oct 10, 2026, 10-Oct-2026).
 * - Zero dependency on Node.js host server clock.
 */

const PLACEHOLDERS = new Set(['', 'not found', 'n/a', 'na', 'none', 'null', '-', '--', 'undefined', 'nil', '?', 'n/d']);

function isPlaceholder(val) {
  if (val === null || val === undefined) return true;
  return PLACEHOLDERS.has(String(val).trim().toLowerCase());
}

const MONTH_NAMES = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12
};

/**
 * Checks whether a year is a leap year in the Gregorian calendar.
 */
function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Returns the number of days in a given month of a given year.
 */
function getDaysInMonth(year, month) {
  const daysPerMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return daysPerMonth[month - 1] || 0;
}

/**
 * Discovers all valid UTC epoch instants that format to the target local wall-clock components
 * in the supplied IANA timezone.
 *
 * Uses `hourCycle: 'h23'` to guarantee midnight is formatted as '00' rather than '24'.
 * Dynamic across 15-minute, 30-minute, 60-minute, or non-DST zones without hardcoding shifts.
 *
 * @param {Object} components - { year, month, day, hour, minute, second }
 * @param {string} timeZone - Valid IANA timezone identifier
 * @returns {number[]} Array of verified UTC epoch timestamps in milliseconds (sorted ascending)
 */
function discoverMatchingUtcInstants({ year, month, day, hour, minute, second }, timeZone) {
  const targetWallClockMs = Date.UTC(year, month - 1, day, hour, minute, second);

  function getZonedWallClockMs(epochMs) {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hourCycle: 'h23'
    });
    const parts = Object.fromEntries(dtf.formatToParts(new Date(epochMs)).map(p => [p.type, p.value]));
    return Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
  }

  // Probe active offsets across the calendar day (±24h window around local noon)
  const baseNoonMs = Date.UTC(year, month - 1, day, 12, 0, 0);
  const probeEpochs = [
    baseNoonMs - 86400000,
    baseNoonMs - 43200000,
    baseNoonMs,
    baseNoonMs + 43200000,
    baseNoonMs + 86400000
  ];

  const candidateOffsets = new Set();
  for (const ep of probeEpochs) {
    const zonedMs = getZonedWallClockMs(ep);
    candidateOffsets.add(zonedMs - ep);
  }

  const directZoned = getZonedWallClockMs(targetWallClockMs);
  candidateOffsets.add(directZoned - targetWallClockMs);

  const verifiedInstants = [];
  for (const offset of candidateOffsets) {
    const candidateUtc = targetWallClockMs - offset;
    const recheckWallClock = getZonedWallClockMs(candidateUtc);
    if (recheckWallClock === targetWallClockMs) {
      if (!verifiedInstants.includes(candidateUtc)) {
        verifiedInstants.push(candidateUtc);
      }
    }
  }

  verifiedInstants.sort((a, b) => a - b);
  return verifiedInstants;
}

/**
 * Converts wall-clock components in an IANA timezone to a UTC ISO string.
 * Enforces rejection of nonexistent spring-forward times and deterministic handling of fall-back overlaps.
 */
function wallClockToUtcInstant(components, timeZone, options = {}) {
  const { year, month, day, hour, minute, second } = components;
  const verifiedInstants = discoverMatchingUtcInstants(components, timeZone);

  // Case 1: Nonexistent Local Time (Spring-Forward Gap)
  if (verifiedInstants.length === 0) {
    const err = new Error(
      `Validation Error: '${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ` +
      `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}' ` +
      `does not exist in timezone '${timeZone}' due to the Daylight Saving Time spring-forward transition.`
    );
    err.code = 'DST_SPRING_FORWARD_GAP';
    err.statusCode = 400;
    throw err;
  }

  // Case 2: Ambiguous Local Time (Fall-Back Overlap)
  if (verifiedInstants.length > 1) {
    if (options.dstFallBackPolicy === 'earlier') {
      return new Date(verifiedInstants[0]).toISOString();
    } else if (options.dstFallBackPolicy === 'later') {
      return new Date(verifiedInstants[verifiedInstants.length - 1]).toISOString();
    } else {
      // Default policy: Preserve floating wall-clock without asserting UTC
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T` +
             `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
    }
  }

  // Case 3: Exactly One Valid Instant
  return new Date(verifiedInstants[0]).toISOString();
}

/**
 * Parses raw date tokens according to format preferences and unambiguous heuristics.
 */
function parseDateTokens(strVal, dateFormatPreference) {
  const trimmed = String(strVal || '').trim();
  if (!trimmed || isPlaceholder(trimmed)) return null;

  // 1. Check Unix Epoch Milliseconds (11-14 digits) or Seconds (9-10 digits)
  if (/^\d{11,14}$/.test(trimmed)) {
    const ms = Number(trimmed);
    const d = new Date(ms);
    if (!isNaN(d.getTime())) {
      return {
        year: d.getUTCFullYear(),
        month: d.getUTCMonth() + 1,
        day: d.getUTCDate(),
        hour: d.getUTCHours(),
        minute: d.getUTCMinutes(),
        second: d.getUTCSeconds(),
        hasTime: true,
        tzPart: 'Z',
        rawDatePart: trimmed,
        rawTimePart: null
      };
    }
  }
  if (/^\d{9,10}$/.test(trimmed)) {
    const ms = Number(trimmed) * 1000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) {
      return {
        year: d.getUTCFullYear(),
        month: d.getUTCMonth() + 1,
        day: d.getUTCDate(),
        hour: d.getUTCHours(),
        minute: d.getUTCMinutes(),
        second: d.getUTCSeconds(),
        hasTime: true,
        tzPart: 'Z',
        rawDatePart: trimmed,
        rawTimePart: null
      };
    }
  }

  // 2. Check textual month formats (e.g. "10-Oct-2026", "Oct 10, 2026", "10 Oct 2026", "October 10, 2026")
  let datePart = null;
  let timePart = null;
  let tzPart = '';

  const textMonthMatch1 = trimmed.match(/^([A-Za-z]{3,9})[\s,.-]+(\d{1,2})[\s,.-]+(\d{2,4})(?:[T\s]+(\d{1,2}:\d{1,2}(?::\d{1,2}(?:\.\d{1,3})?)?)?(.*))?$/i);
  const textMonthMatch2 = trimmed.match(/^(\d{1,2})[\s,.-]+([A-Za-z]{3,9})[\s,.-]+(\d{2,4})(?:[T\s]+(\d{1,2}:\d{1,2}(?::\d{1,2}(?:\.\d{1,3})?)?)?(.*))?$/i);

  if (textMonthMatch1 || textMonthMatch2) {
    const m = textMonthMatch1 || textMonthMatch2;
    const monthStr = (textMonthMatch1 ? m[1] : m[2]).toLowerCase();
    const dayNum = Number(textMonthMatch1 ? m[2] : m[1]);
    let yearNum = Number(m[3]);
    if (yearNum < 100) yearNum += 2000;

    const monthNum = MONTH_NAMES[monthStr];
    if (monthNum) {
      timePart = m[4] || null;
      tzPart = (m[5] || '').trim();

      const maxDays = getDaysInMonth(yearNum, monthNum);
      if (dayNum < 1 || dayNum > maxDays) {
        const err = new Error(`Validation Error: Invalid day '${dayNum}' for month ${monthNum}/${yearNum} in date '${trimmed}'.`);
        err.statusCode = 400;
        throw err;
      }

      let hour = 0, minute = 0, second = 0;
      if (timePart) {
        const tp = timePart.split(':');
        hour = Number(tp[0]);
        minute = Number(tp[1]);
        second = tp[2] ? Math.floor(Number(tp[2])) : 0;
        if (tzPart && /pm/i.test(tzPart) && hour < 12) hour += 12;
        if (tzPart && /am/i.test(tzPart) && hour === 12) hour = 0;
      }

      return {
        year: yearNum,
        month: monthNum,
        day: dayNum,
        hour,
        minute,
        second,
        hasTime: Boolean(timePart),
        tzPart: /^[+-Z]/i.test(tzPart) ? tzPart : '',
        rawDatePart: trimmed,
        rawTimePart: timePart
      };
    }
  }

  // 3. Numeric segmented dates (YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY)
  const match = trimmed.match(/^([0-9]{1,4}[-/.][0-9]{1,4}[-/.][0-9]{1,4})(?:[T\s]([0-9]{1,2}:[0-9]{1,2}(?::[0-9]{1,2}(?:\.[0-9]{1,3})?)?)?(.*))?$/);
  if (!match) return null;

  datePart = match[1];
  timePart = match[2] || null;
  tzPart = (match[3] || '').trim();

  // Parse date segments
  const sep = datePart.includes('-') ? '-' : (datePart.includes('/') ? '/' : '.');
  const segments = datePart.split(sep).map(s => Number(s));
  if (segments.length !== 3 || segments.some(n => isNaN(n) || n <= 0)) {
    return null;
  }

  let year, month, day;

  // If first segment is 4 digits -> YYYY-MM-DD
  if (segments[0] > 999) {
    year = segments[0];
    month = segments[1];
    day = segments[2];
  } else if (segments[2] > 999) {
    year = segments[2];
    const tok1 = segments[0];
    const tok2 = segments[1];

    if (tok1 > 12 && tok2 <= 12) {
      // Unambiguously DD-MM-YYYY
      day = tok1;
      month = tok2;
    } else if (tok2 > 12 && tok1 <= 12) {
      // Unambiguously MM-DD-YYYY
      month = tok1;
      day = tok2;
    } else {
      // Ambiguous: both tok1 and tok2 <= 12
      const pref = String(dateFormatPreference || '').toUpperCase();
      if (pref.startsWith('DD')) {
        day = tok1;
        month = tok2;
      } else if (pref.startsWith('MM')) {
        month = tok1;
        day = tok2;
      } else {
        const err = new Error(
          `Validation Error: Date value '${datePart}' is ambiguous between DD/MM/YYYY and MM/DD/YYYY. Please select an explicit Date Format in import settings or supply ISO format (YYYY-MM-DD).`
        );
        err.code = 'AMBIGUOUS_DATE_FORMAT';
        err.statusCode = 400;
        throw err;
      }
    }
  } else {
    // 2-digit year (discouraged, treat as 20xx)
    year = 2000 + segments[2];
    day = segments[0];
    month = segments[1];
  }

  // Validate calendar bounds
  if (month < 1 || month > 12) {
    const err = new Error(`Validation Error: Invalid month '${month}' in date '${trimmed}'. Month must be between 1 and 12.`);
    err.statusCode = 400;
    throw err;
  }

  const maxDays = getDaysInMonth(year, month);
  if (day < 1 || day > maxDays) {
    const err = new Error(`Validation Error: Invalid day '${day}' for month ${month}/${year} in date '${trimmed}'.`);
    err.statusCode = 400;
    throw err;
  }

  // Parse time segments if present
  let hour = 0, minute = 0, second = 0;
  if (timePart) {
    const timePieces = timePart.split(':');
    hour = Number(timePieces[0]);
    minute = Number(timePieces[1]);
    second = timePieces[2] ? Math.floor(Number(timePieces[2])) : 0;

    if (tzPart && /pm/i.test(tzPart) && hour < 12) hour += 12;
    if (tzPart && /am/i.test(tzPart) && hour === 12) hour = 0;

    if (isNaN(hour) || hour < 0 || hour > 23 || isNaN(minute) || minute < 0 || minute > 59 || isNaN(second) || second < 0 || second > 59) {
      const err = new Error(`Validation Error: Invalid time '${timePart}' in timestamp '${trimmed}'. Hour must be 0-23, minute and second 0-59.`);
      err.statusCode = 400;
      throw err;
    }
  }

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    hasTime: Boolean(timePart),
    tzPart: /^[+-Z]/i.test(tzPart) ? tzPart : '',
    rawDatePart: datePart,
    rawTimePart: timePart
  };
}

/**
 * Validates and normalizes date-only fields strictly to 'YYYY-MM-DD'.
 * Rejects impossible dates and ambiguous dates. Strips time if present.
 */
function validateAndFormatDate(value, fieldLabel = 'Field', options = {}) {
  if (value === undefined || value === null || isPlaceholder(value)) {
    return null;
  }

  const str = String(value).trim();
  const parsed = parseDateTokens(str, options.dateFormatPreference);
  if (!parsed) {
    const err = new Error(`Validation Error: '${fieldLabel}' value '${str}' must be a valid date.`);
    err.statusCode = 400;
    throw err;
  }

  const y = String(parsed.year).padStart(4, '0');
  const m = String(parsed.month).padStart(2, '0');
  const d = String(parsed.day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Validates and normalizes DateTime fields according to policy:
 * - Explicit UTC offset -> UTC ISO (YYYY-MM-DDTHH:mm:ss.sssZ)
 * - Source/Org timezone -> Zoned conversion (wallClockToUtcInstant)
 * - No timezone -> Floating wall-clock ISO (YYYY-MM-DDTHH:mm:ss)
 */
function validateAndFormatDateTime(value, fieldLabel = 'Field', options = {}) {
  if (value === undefined || value === null || isPlaceholder(value)) {
    return null;
  }

  const str = String(value).trim();

  // 1. Direct check for standard ISO with explicit UTC 'Z' or offset (+HH:mm / -HH:mm)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:?\d{2})$/i.test(str)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
  }

  // 2. Parse tokens
  const parsed = parseDateTokens(str, options.dateFormatPreference);
  if (!parsed) {
    const err = new Error(`Validation Error: '${fieldLabel}' value '${str}' must be a valid datetime.`);
    err.statusCode = 400;
    throw err;
  }

  // 3. If explicit offset was attached to the parsed string (e.g. +05:30 or Z)
  if (parsed.tzPart) {
    const combinedIso = `${parsed.year}-${String(parsed.month).padStart(2, '0')}-${String(parsed.day).padStart(2, '0')}T` +
      `${String(parsed.hour).padStart(2, '0')}:${String(parsed.minute).padStart(2, '0')}:${String(parsed.second).padStart(2, '0')}${parsed.tzPart}`;
    const d = new Date(combinedIso);
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
  }

  // 4. Resolve active timezone
  const targetTimezone = options.sourceTimezone || options.orgTimezone || options.clientTimezone || null;

  if (targetTimezone) {
    return wallClockToUtcInstant({
      year: parsed.year,
      month: parsed.month,
      day: parsed.day,
      hour: parsed.hour,
      minute: parsed.minute,
      second: parsed.second
    }, targetTimezone, {
      dstFallBackPolicy: options.dstFallBackPolicy
    });
  }

  // 5. No timezone available: Preserve floating wall-clock ISO without 'Z'
  return `${parsed.year}-${String(parsed.month).padStart(2, '0')}-${String(parsed.day).padStart(2, '0')}T` +
         `${String(parsed.hour).padStart(2, '0')}:${String(parsed.minute).padStart(2, '0')}:${String(parsed.second).padStart(2, '0')}`;
}

module.exports = {
  isPlaceholder,
  isLeapYear,
  getDaysInMonth,
  discoverMatchingUtcInstants,
  wallClockToUtcInstant,
  parseDateTokens,
  validateAndFormatDate,
  validateAndFormatDateTime
};
