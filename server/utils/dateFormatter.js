/**
 * Date Formatter Utility
 * Handles date formatting and conversions
 */

/**
 * Format date to DD-MM-YYYY
 * @param {Date|string} date - Date object or ISO string
 * @returns {string} Formatted date
 */
function formatDate(date) {
  if (!date) return '';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  return `${day}-${month}-${year}`;
}

/**
 * Format date to YYYY-MM-DD (SQL format)
 * @param {Date|string} date - Date object or formatted string
 * @returns {string} SQL date format
 */
function toSQLDate(date) {
  if (!date) return '';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Parse DD-MM-YYYY to Date object
 * @param {string} dateStr - Date string in DD-MM-YYYY format
 * @returns {Date|null} Date object or null
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  
  const date = new Date(year, month, day);
  if (isNaN(date.getTime())) return null;
  
  return date;
}

/**
 * Get current date in DD-MM-YYYY format
 * @returns {string} Current date
 */
function getCurrentDate() {
  return formatDate(new Date());
}

/**
 * Get current date in YYYY-MM-DD format
 * @returns {string} Current SQL date
 */
function getCurrentSQLDate() {
  return toSQLDate(new Date());
}

/**
 * Get financial year for a date
 * @param {Date|string} date - Date object or string
 * @returns {string} Financial year (e.g., "24-25")
 */
function getFinancialYear(date) {
  const d = date ? new Date(date) : new Date();
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  
  if (month >= 4) {
    const startYear = year.toString().slice(-2);
    const endYear = (year + 1).toString().slice(-2);
    return `${startYear}-${endYear}`;
  } else {
    const startYear = (year - 1).toString().slice(-2);
    const endYear = year.toString().slice(-2);
    return `${startYear}-${endYear}`;
  }
}

/**
 * Get financial year start date
 * @param {string} fy - Financial year (e.g., "24-25")
 * @returns {string} Start date in YYYY-MM-DD format
 */
function getFYStartDate(fy) {
  const [startYY] = fy.split('-');
  const startYear = 2000 + parseInt(startYY, 10);
  return `${startYear}-04-01`;
}

/**
 * Get financial year end date
 * @param {string} fy - Financial year (e.g., "24-25")
 * @returns {string} End date in YYYY-MM-DD format
 */
function getFYEndDate(fy) {
  const [, endYY] = fy.split('-');
  const endYear = 2000 + parseInt(endYY, 10);
  return `${endYear}-03-31`;
}

/**
 * Format date to readable format (e.g., "15 Jan 2024")
 * @param {Date|string} date - Date object or string
 * @returns {string} Readable date
 */
function formatReadableDate(date) {
  if (!date) return '';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  
  return `${day} ${month} ${year}`;
}

/**
 * Format date with time (e.g., "15-01-2024 14:30")
 * @param {Date|string} date - Date object or string
 * @returns {string} Formatted date with time
 */
function formatDateTime(date) {
  if (!date) return '';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const dateStr = formatDate(d);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  
  return `${dateStr} ${hours}:${minutes}`;
}

/**
 * Check if date is valid
 * @param {string} dateStr - Date string
 * @returns {boolean} True if valid
 */
function isValidDate(dateStr) {
  const date = parseDate(dateStr);
  return date !== null;
}

/**
 * Get date range for period
 * @param {string} period - 'today', 'yesterday', 'this_week', 'this_month', 'this_year', 'last_month', 'last_year'
 * @returns {Object} {fromDate, toDate} in YYYY-MM-DD format
 */
function getDateRange(period) {
  const today = new Date();
  let fromDate, toDate;
  
  switch (period) {
    case 'today':
      fromDate = toDate = toSQLDate(today);
      break;
      
    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      fromDate = toDate = toSQLDate(yesterday);
      break;
      
    case 'this_week':
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      fromDate = toSQLDate(weekStart);
      toDate = toSQLDate(today);
      break;
      
    case 'this_month':
      fromDate = toSQLDate(new Date(today.getFullYear(), today.getMonth(), 1));
      toDate = toSQLDate(today);
      break;
      
    case 'this_year':
      fromDate = toSQLDate(new Date(today.getFullYear(), 0, 1));
      toDate = toSQLDate(today);
      break;
      
    case 'last_month':
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      fromDate = toSQLDate(lastMonth);
      toDate = toSQLDate(new Date(today.getFullYear(), today.getMonth(), 0));
      break;
      
    case 'last_year':
      fromDate = toSQLDate(new Date(today.getFullYear() - 1, 0, 1));
      toDate = toSQLDate(new Date(today.getFullYear() - 1, 11, 31));
      break;
      
    case 'this_fy':
      const fy = getFinancialYear(today);
      fromDate = getFYStartDate(fy);
      toDate = toSQLDate(today);
      break;
      
    default:
      fromDate = toDate = toSQLDate(today);
  }
  
  return { fromDate, toDate };
}

export {
  formatDate,
  toSQLDate,
  parseDate,
  getCurrentDate,
  getCurrentSQLDate,
  getFinancialYear,
  getFYStartDate,
  getFYEndDate,
  formatReadableDate,
  formatDateTime,
  isValidDate,
  getDateRange
};
