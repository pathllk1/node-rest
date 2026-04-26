/**
 * Date Formatter Utility
 * Handles date formatting and conversions
 * No DB dependency — identical logic to the SQLite version.
 */

/**
 * Format date to DD-MM-YYYY
 * @param {Date|string} date
 * @returns {string}
 */
export function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const day   = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year  = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Format date to YYYY-MM-DD (ISO / MongoDB-friendly)
 * @param {Date|string} date
 * @returns {string}
 */
export function toSQLDate(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day   = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse DD-MM-YYYY to Date object
 * @param {string} dateStr
 * @returns {Date|null}
 */
export function parseDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  const day   = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year  = parseInt(parts[2], 10);
  const date  = new Date(year, month, day);
  if (isNaN(date.getTime())) return null;
  return date;
}

/** @returns {string} Current date in DD-MM-YYYY */
export function getCurrentDate() {
  return formatDate(new Date());
}

/** @returns {string} Current date in YYYY-MM-DD */
export function getCurrentSQLDate() {
  return toSQLDate(new Date());
}

/**
 * Get financial year string for a given date (Indian FY: Apr–Mar)
 * @param {Date|string} date
 * @returns {string} e.g. "24-25"
 */
export function getFinancialYear(date) {
  const d     = date ? new Date(date) : new Date();
  const year  = d.getFullYear();
  const month = d.getMonth() + 1;
  if (month >= 4) {
    return `${String(year).slice(-2)}-${String(year + 1).slice(-2)}`;
  }
  return `${String(year - 1).slice(-2)}-${String(year).slice(-2)}`;
}

/**
 * Get FY start date in YYYY-MM-DD
 * @param {string} fy - e.g. "24-25"
 * @returns {string}
 */
export function getFYStartDate(fy) {
  const startYear = 2000 + parseInt(fy.split('-')[0], 10);
  return `${startYear}-04-01`;
}

/**
 * Get FY end date in YYYY-MM-DD
 * @param {string} fy - e.g. "24-25"
 * @returns {string}
 */
export function getFYEndDate(fy) {
  const endYear = 2000 + parseInt(fy.split('-')[1], 10);
  return `${endYear}-03-31`;
}

/**
 * Format date to readable format — e.g. "15 Jan 2024"
 * @param {Date|string} date
 * @returns {string}
 */
export function formatReadableDate(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Format date with time — e.g. "15-01-2024 14:30"
 * @param {Date|string} date
 * @returns {string}
 */
export function formatDateTime(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const hours   = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate(d)} ${hours}:${minutes}`;
}

/**
 * Check if a DD-MM-YYYY string is a valid date
 * @param {string} dateStr
 * @returns {boolean}
 */
export function isValidDate(dateStr) {
  return parseDate(dateStr) !== null;
}

/**
 * Get a {fromDate, toDate} range in YYYY-MM-DD for common named periods
 * @param {'today'|'yesterday'|'this_week'|'this_month'|'this_year'|'last_month'|'last_year'|'this_fy'} period
 * @returns {{ fromDate: string, toDate: string }}
 */
export function getDateRange(period) {
  const today = new Date();
  let fromDate, toDate;

  switch (period) {
    case 'today':
      fromDate = toDate = toSQLDate(today);
      break;

    case 'yesterday': {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      fromDate = toDate = toSQLDate(y);
      break;
    }

    case 'this_week': {
      const ws = new Date(today);
      ws.setDate(today.getDate() - today.getDay());
      fromDate = toSQLDate(ws);
      toDate   = toSQLDate(today);
      break;
    }

    case 'this_month':
      fromDate = toSQLDate(new Date(today.getFullYear(), today.getMonth(), 1));
      toDate   = toSQLDate(today);
      break;

    case 'this_year':
      fromDate = toSQLDate(new Date(today.getFullYear(), 0, 1));
      toDate   = toSQLDate(today);
      break;

    case 'last_month':
      fromDate = toSQLDate(new Date(today.getFullYear(), today.getMonth() - 1, 1));
      toDate   = toSQLDate(new Date(today.getFullYear(), today.getMonth(), 0));
      break;

    case 'last_year':
      fromDate = toSQLDate(new Date(today.getFullYear() - 1, 0, 1));
      toDate   = toSQLDate(new Date(today.getFullYear() - 1, 11, 31));
      break;

    case 'this_fy': {
      const fy = getFinancialYear(today);
      fromDate = getFYStartDate(fy);
      toDate   = toSQLDate(today);
      break;
    }

    default:
      fromDate = toDate = toSQLDate(today);
  }

  return { fromDate, toDate };
}
