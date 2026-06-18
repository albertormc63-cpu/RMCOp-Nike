const monthNumbers = {
  ENE: 1,
  ENERO: 1,
  JAN: 1,
  JANUARY: 1,
  FEB: 2,
  FEBRERO: 2,
  FEBRUARY: 2,
  MAR: 3,
  MARZO: 3,
  MARCH: 3,
  ABR: 4,
  ABRIL: 4,
  APR: 4,
  APRIL: 4,
  MAY: 5,
  MAYO: 5,
  JUN: 6,
  JUNIO: 6,
  JUNE: 6,
  JUL: 7,
  JULIO: 7,
  JULY: 7,
  AGO: 8,
  AGOSTO: 8,
  AUG: 8,
  AUGUST: 8,
  SEP: 9,
  SEPT: 9,
  SEPTIEMBRE: 9,
  SET: 9,
  SETIEMBRE: 9,
  SEPTEMBER: 9,
  OCT: 10,
  OCTUBRE: 10,
  OCTOBER: 10,
  NOV: 11,
  NOVIEMBRE: 11,
  NOVEMBER: 11,
  DIC: 12,
  DICIEMBRE: 12,
  DEC: 12,
  DECEMBER: 12
};

function cleanDateText(value) {
  return String(value == null ? "" : value)
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function formatDayMonth(dayValue, monthValue) {
  const day = Number(dayValue);
  const month = Number(monthValue);
  const maxDays = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  if (!Number.isInteger(day) || !Number.isInteger(month) || month < 1 || month > 12 || day < 1 || day > maxDays[month]) {
    return "";
  }

  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
}

function normalizeShippingDate(value) {
  const originalText = String(value == null ? "" : value).trim();
  const text = cleanDateText(value).replace(/\./g, "");

  if (!text) return "";

  const isoMatch = text.match(/^\d{4}[-/]([0-9]{1,2})[-/]([0-9]{1,2})$/);
  if (isoMatch) return formatDayMonth(isoMatch[2], isoMatch[1]) || originalText;

  const numericMatch = text.match(/^([0-9]{1,2})[-/]([0-9]{1,2})(?:[-/]\d{2,4})?$/);
  if (numericMatch) return formatDayMonth(numericMatch[1], numericMatch[2]) || originalText;

  const wordMatch = text.match(/^([0-9]{1,2})[\s/-]+([A-Z]+)(?:[\s,/-]+\d{2,4})?$/);
  if (wordMatch && monthNumbers[wordMatch[2]]) {
    return formatDayMonth(wordMatch[1], monthNumbers[wordMatch[2]]) || originalText;
  }

  return originalText;
}

function extractShippingDate(value) {
  const text = cleanDateText(value).replace(/\./g, "");
  const monthNames = Object.keys(monthNumbers).sort(function (left, right) {
    return right.length - left.length;
  }).join("|");
  const match = text.match(new RegExp(`\\b([0-9]{1,2})[\\s/-]+(${monthNames})\\b`));

  if (match) {
    return formatDayMonth(match[1], monthNumbers[match[2]]);
  }

  const normalized = normalizeShippingDate(text);
  return /^\d{2}\/\d{2}$/.test(normalized) ? normalized : "";
}

module.exports = {
  extractShippingDate,
  normalizeShippingDate
};
