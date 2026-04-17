// Slug and date helpers.
//
// slugify() matches the Post Generator's existing implementation
// exactly so migrated tools produce the same URLs.

export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Parse either a `YYYY-MM-DD` string or a Date / ISO string into
// year/month/day components. The `YYYY-MM-DD` branch is important:
// `new Date('2026-04-17')` is interpreted as UTC midnight, and in
// timezones west of UTC, `getDate()` returns the previous day — posts
// would land in the wrong directory. Treat date-only strings as the
// user's calendar date, not a timestamp.
function parseDate(input) {
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split('-');
    return { year: y, month: m, day: d };
  }
  const d = input instanceof Date ? input : new Date(input);
  return {
    year: String(d.getFullYear()),
    month: String(d.getMonth() + 1).padStart(2, '0'),
    day: String(d.getDate()).padStart(2, '0'),
  };
}

export function formatDate(dateInput) {
  const { year, month, day } = parseDate(dateInput);
  // Use Date in UTC to avoid timezone shift on the formatted output
  const d = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

// Canonical post path: "YYYY/MM/DD/slug/"
// Note: trailing slash is intentional — Pages serves index.html from it.
export function postPath(dateInput, slug) {
  const { year, month, day } = parseDate(dateInput);
  return `${year}/${month}/${day}/${slug}/`;
}

export function postUrl(dateInput, slug) {
  return `/${postPath(dateInput, slug)}`;
}

export function isoDate(dateInput) {
  const { year, month, day } = parseDate(dateInput);
  return `${year}-${month}-${day}`;
}

export function yearMonth(dateInput) {
  const { year, month } = parseDate(dateInput);
  return { year: Number(year), month };
}
