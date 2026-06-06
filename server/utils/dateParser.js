function parseDateLimite(str) {
  if (!str) return Infinity; // No explicit deadline means it doesn't expire based on date
  
  str = String(str).toLowerCase().trim();
  
  // Clean up some common prefixes in the scraped string
  str = str.replace(/.*limite\s*:/i, '').trim();
  
  // match patterns like "15 Juin 2026" or "15 juin"
  const match = str.match(/(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s*(\d{4})?/);
  
  if (match) {
    const day = parseInt(match[1], 10);
    const monthStr = match[2];
    const months = {
      janvier: 0, février: 1, fevrier: 1, mars: 2, avril: 3, mai: 4, juin: 5,
      juillet: 6, août: 7, aout: 7, septembre: 8, octobre: 9, novembre: 10, décembre: 11, decembre: 11
    };
    const month = months[monthStr];
    const year = match[3] ? parseInt(match[3], 10) : new Date().getFullYear();
    // Return end of the day in ms
    return new Date(year, month, day, 23, 59, 59).getTime();
  }

  // Fallback
  const ts = Date.parse(str);
  if (!isNaN(ts)) return ts;
  
  return Infinity; 
}

function isExpired(dateLimite) {
  if (!dateLimite) return false;
  const ts = parseDateLimite(dateLimite);
  return ts < Date.now();
}

module.exports = { parseDateLimite, isExpired };
