const cheerio = require('cheerio');
const { isExpired } = require('../utils/dateParser');

const PUBLIC_BASE = 'https://www.emploi-public.ma';
const ANAPEC_BASE = 'https://www.anapec.org';

function positive(value, fallback) {
  return Number.isFinite(Number(value)) && Number(value) > 0 ? Math.floor(Number(value)) : fallback;
}

function createRunContext(options = {}) {
  const serverless = !!process.env.VERCEL;
  const duration = positive(options.maxDurationMs || process.env.SCRAPER_MAX_DURATION_MS, serverless ? 40000 : 30 * 60 * 1000);
  const deadline = Math.min(options.deadlineAt || Infinity, Date.now() + duration);
  return {
    serverless,
    maxItems: positive(options.maxItems || process.env.SCRAPER_ITEM_LIMIT, serverless ? 5 : 500),
    maxPages: positive(options.maxPages || process.env.SCRAPER_MAX_PAGES, serverless ? 5 : 30),
    remaining() {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        const error = new Error('Scraper time budget exhausted; remaining listings will be retried on the next run');
        error.code = 'SCRAPER_BUDGET_EXCEEDED';
        throw error;
      }
      return remaining;
    },
  };
}

function parseDeadline(text) {
  return String(text).replace(/\s+/g, ' ').match(/(?:limite(?: de dépôt)?|délai de dépôt des candidatures)\s*:?\s*(\d{1,2}\s+[^\s]+\s+\d{4}(?:\s*-\s*\d{1,2}:\d{2})?|\d{1,2}[/-]\d{1,2}[/-]\d{4})/i)?.[1] || '';
}

function createScraperRunners({ db, fetchPage, normalizeUrl, extractHtml, validateDetail, rewrite, insert }) {
  async function run(source, force = false, options = {}) {
    const context = createRunContext(options);
    const concours = source === 'concours';
    const official = source !== 'anapec';
    const type = concours ? 'concours' : 'job';
    const base = official ? PUBLIC_BASE : ANAPEC_BASE;
    const rows = concours ? db.data.concours : db.data.emplois;
    const existing = new Set((rows || []).map(row => {
      const url = concours ? row.lien_source : row.lien_candidature;
      return official ? normalizeUrl(url, type) || url : url;
    }));
    const seen = new Set();
    const signatures = new Set();
    const stats = { added: 0, errors: 0, parsed: 0, duplicates: 0, expired: 0, skipped: 0, pages: 0, validated: 0 };
    if (options.dryRun) stats.items = [];
    let attempted = 0;
    let pageUrl = official ? `${base}/fr/${concours ? 'concours' : 'emploi-sup'}-liste`
      : `${base}/sigec-app-rv/fr/chercheurs/resultat_recherche/tout:all`;

    const recordError = err => {
      if (err.code === 'SCRAPER_BUDGET_EXCEEDED') stats.timedOut = true;
      stats.errors++;
      stats.error = err.message;
      stats.partial = stats.added > 0 || stats.validated > 0;
      console.warn(`Scraper ${source}: ${err.message}`);
    };

    try {
      for (let page = 1; page <= context.maxPages && pageUrl && attempted < context.maxItems; page++) {
        context.remaining();
        console.log(`Scraper ${source}: page ${page} (${pageUrl})`);
        const response = await fetchPage(pageUrl, context);
        const $ = cheerio.load(response.data);
        stats.pages++;
        const items = [];

        if (official) {
          $('a.card.card-scale').each((i, el) => {
            const card = $(el);
            const url = ['href', 'data-href', 'data-url', 'data-link', 'onclick']
              .map(attr => normalizeUrl(card.attr(attr), type)).find(Boolean);
            if (!url) return;
            const image = card.find('img').attr('src');
            items.push({
              title: card.find('h2, .card-title').first().text().trim() || (concours ? 'Concours' : 'Emploi'),
              url, deadline: parseDeadline(card.text()),
              imageUrl: image ? new URL(image, base).href : '',
            });
          });
        } else {
          $('table tr').each((i, el) => {
            const row = $(el);
            const href = row.find('a.nyroModal').attr('href') || '';
            const id = href.match(/\/(\d{5,})(?:\/|$|\?)/)?.[1];
            if (!id) return;
            const cells = row.find('td');
            items.push({
              title: cells.eq(3).text().trim().replace(/\s+/g, ' ') || "Offre d'emploi ANAPEC",
              url: `${base}/sigec-app-rv/fr/entreprises/bloc_offre_home/${id}/resultat_recherche`,
              reference: cells.eq(1).text().trim(),
              location: cells.eq(6).text().trim() || 'Maroc',
              enterprise: 'ANAPEC',
            });
          });
        }

        if (!items.length) {
          const text = $('body').text().replace(/\s+/g, ' ');
          if (page === 1 && !/(?:aucun[e]? (?:offre|annonce|résultat)|0\s+résultat)/i.test(text)) {
            throw new Error(`${source}: no listing cards found; source may be unavailable or its markup has changed`);
          }
          break;
        }
        const signature = items.map(item => item.url).join('|');
        if (signatures.has(signature)) break;
        signatures.add(signature);
        stats.parsed += items.length;

        // Process each page immediately so a slow later page cannot discard
        // everything collected at the start of a serverless invocation.
        for (const item of items) {
          if (attempted >= context.maxItems) break;
          if (seen.has(item.url)) continue;
          seen.add(item.url);
          if (!force && existing.has(item.url)) { stats.duplicates++; continue; }
          if (isExpired(item.deadline)) { stats.expired++; continue; }
          context.remaining();
          attempted++;
          try {
            const detail = await fetchPage(item.url, context);
            if (official) {
              const check = validateDetail(detail, item.url);
              if (!check.ok) throw new Error(`${item.url}: ${check.reason}`);
            }
            const d = cheerio.load(detail.data);
            if (!official && !d('.bloc_offre_home, .offres-details, .detail-offre').length &&
                !/Description de (?:l'entreprise|poste)|Caractéristiques du poste/i.test(d('body').text())) {
              throw new Error(`${item.url}: missing ANAPEC offer details`);
            }
            item.description = extractHtml(d, item.url);
            item.deadline = item.deadline || parseDeadline(cheerio.load(item.description).text());
            if (isExpired(item.deadline)) { stats.expired++; continue; }
            stats.validated++;
            if (options.dryRun) {
              stats.items.push(item);
              continue;
            }
            const [processed] = await rewrite([item], type, context);
            if (insert(processed, type)) {
              // Persist before moving to the next network request.
              if (db.pendingSave) await db.pendingSave;
              stats.added++;
              existing.add(item.url);
            } else {
              throw new Error(`Could not insert ${item.url}`);
            }
          } catch (err) {
            stats.skipped++;
            recordError(err);
            if (err.code === 'SCRAPER_BUDGET_EXCEEDED') break;
          }
        }
        if (stats.timedOut) break;

        const next = official
          ? $('.pagination a.next, a[rel="next"]').first().attr('href')
          : $('a[rel="next"], .next a, a.next').first().attr('href');
        if (next) {
          const nextUrl = new URL(next, pageUrl);
          pageUrl = nextUrl.origin === base ? nextUrl.href : null;
        } else if (!official) {
          // Older ANAPEC pages have numbered links without a next class.
          const numbered = $('a[href]').map((i, el) => $(el).attr('href')).get()
            .find(href => new RegExp(`/page:${page + 1}(?:$|[/?])`).test(href));
          pageUrl = numbered ? new URL(numbered, base).href : null;
        } else {
          pageUrl = null;
        }
      }
    } catch (err) {
      recordError(err);
    }
    if (!stats.errors && !stats.validated) stats.reason = 'No new active listings';
    console.log(`Scraper ${source}: ${stats.added} saved, ${stats.validated} validated, ${stats.errors} errors`);
    return stats;
  }

  return {
    runScraper: (force, options) => run('concours', force, options),
    runJobScraper: (force, options) => run('jobs', force, options),
    runAnapecScraper: (force, options) => run('anapec', force, options),
  };
}

module.exports = { createScraperRunners, createRunContext };
