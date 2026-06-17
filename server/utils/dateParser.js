const MONTHS_FR = {
  janvier: 0, février: 1, fevrier: 1, mars: 2, avril: 3, mai: 4, juin: 5,
  juillet: 6, août: 7, aout: 7, septembre: 8, octobre: 9, novembre: 10,
  décembre: 11, decembre: 11,
};

function parseDateLimite(str) {
  if (!str) return Infinity; // No explicit deadline → never expires by date

  str = String(str).trim();

  // Strip common prefixes:  "Date limite :" / "Limite :" / "Clôture :"
  str = str.replace(/^.*?(?:limite|clôture|cloture)\s*[:\-]\s*/i, '').trim();

  const s = str.toLowerCase();

  // 1. French month names — "15 juin 2026" or "15 juin"
  const frMatch = s.match(/(\d{1,2})\s+(janvier|f[eé]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre)\s*(\d{4})?/);
  if (frMatch) {
    const day   = parseInt(frMatch[1], 10);
    const month = MONTHS_FR[frMatch[2]] ?? MONTHS_FR[frMatch[2].normalize('NFD').replace(/[\u0300-\u036f]/g, '')];
    const year  = frMatch[3] ? parseInt(frMatch[3], 10) : new Date().getFullYear();
    if (month !== undefined) {
      return new Date(year, month, day, 23, 59, 59).getTime();
    }
  }

  // 2. DD/MM/YYYY  (e.g. "17/06/2026")
  const dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    const [, dd, mm, yyyy] = dmyMatch;
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd), 23, 59, 59).getTime();
  }

  // 3. DD-MM-YYYY  (e.g. "17-06-2026")
  const dmyDash = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmyDash) {
    const [, dd, mm, yyyy] = dmyDash;
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd), 23, 59, 59).getTime();
  }

  // 4. ISO-like YYYY-MM-DD  (native Date.parse handles this reliably)
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const ts = Date.parse(str);
    if (!isNaN(ts)) return ts;
  }

  // 5. Generic fallback (handles RFC 2822, etc.)
  const ts = Date.parse(str);
  if (!isNaN(ts)) return ts;

  return Infinity; // unparseable → treat as never-expiring
}

function isExpired(dateLimite) {
  if (!dateLimite) return false;
  const ts = parseDateLimite(dateLimite);
  if (ts === Infinity) return false;
  return ts < Date.now();
}

/**
 * Strip "[Expiré]" (or variants) baked into a titre string.
 */
function stripExpiredPrefix(titre) {
  return (titre || '').replace(/^\[Expir[eé]\]\s*/i, '').trim();
}

module.exports = { parseDateLimite, isExpired, stripExpiredPrefix };

