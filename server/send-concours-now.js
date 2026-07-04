/**
 * send-concours-now.js
 * Fetches the latest active concours from the LIVE Vercel API and broadcasts
 * them directly to the Telegram channel — no local DB, no validation mismatch.
 *
 * Usage:
 *   node server/send-concours-now.js           → sends latest 5 concours
 *   node server/send-concours-now.js 10        → sends latest 10 concours
 *   node server/send-concours-now.js 3 emplois → sends latest 3 emplois
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');

const BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN  || '';
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || '@atlasconcours';
const SITE_URL   = 'https://atlasconcours.vercel.app';
const BASE_URL   = `https://api.telegram.org/bot${BOT_TOKEN}`;

const limit = parseInt(process.argv[2], 10) || 5;
const type  = (process.argv[3] || 'concours').toLowerCase();

if (!BOT_TOKEN || BOT_TOKEN.length < 10) {
  console.error('❌ TELEGRAM_BOT_TOKEN is not set in .env');
  process.exit(1);
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function sanitizeDate(d) {
  if (!d) return null;
  return String(d).replace(/\s*-\s*\d{1,4}\s*$/, '').replace(/\s+/g, ' ').trim();
}

function formatDate(d) {
  const s = sanitizeDate(d);
  if (!s || s === 'N/A') return "Consulter l'annonce";
  try {
    const dt = new Date(s);
    if (!isNaN(dt)) return dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch (_) {}
  return s;
}

function buildConcoursMessage(c) {
  const titre      = escapeHtml(c.titre || 'Concours');
  const organisme  = escapeHtml(c.organisme || '');
  const deadline   = escapeHtml(formatDate(c.date_limite));
  const postes     = c.postes ? `\n📊 <b>Postes :</b> ${escapeHtml(String(c.postes))}` : '';
  const link       = `${SITE_URL}/concours/${c.slug || c.id}`;

  return `🎓 <b>Nouveau Concours</b>

📢 <b>${titre}</b>
${organisme ? `\n🏛️ <b>Organisme :</b> ${organisme}` : ''}${postes}
📅 <b>Date Limite :</b> <b>${deadline}</b>

🔗 <a href="${link}">Voir le concours et postuler</a>

━━━━━━━━━━━━━━━━━━━━
📌 Restez informés sur <a href="${SITE_URL}">AtlasConcours</a>
🔔 Abonnez-vous pour ne rien manquer !`;
}

function buildEmploiMessage(e) {
  const titre        = escapeHtml(e.titre || "Offre d'emploi");
  const entreprise   = escapeHtml(e.entreprise || e.organisme || 'Administration');
  const localisation = escapeHtml(e.localisation || e.ville || 'Maroc');
  const deadline     = escapeHtml(formatDate(e.date_limite || e.deadline));
  const link         = `${SITE_URL}/jobs/${e.id}`;

  return `💼 <b>Nouvelle Offre d'Emploi</b>

📢 <b>${titre}</b>

🏢 <b>Entreprise :</b> ${entreprise}
📍 <b>Localisation :</b> ${localisation}
📅 <b>Date Limite :</b> <b>${deadline}</b>

🔗 <a href="${link}">Voir l'offre complète et postuler</a>

━━━━━━━━━━━━━━━━━━━━
📌 Restez informés sur <a href="${SITE_URL}">AtlasConcours</a>
🔔 Abonnez-vous à notre canal pour ne rien manquer !`;
}

async function sendToChannel(text) {
  const res = await axios.post(`${BASE_URL}/sendMessage`, {
    chat_id:                  CHANNEL_ID,
    text,
    parse_mode:               'HTML',
    disable_web_page_preview: false,
  }, { timeout: 12000 });

  if (res.data?.ok) {
    console.log(`   ✅ Sent (message_id: ${res.data.result?.message_id})`);
    return true;
  } else {
    console.warn(`   ⚠️  API returned ok=false:`, res.data);
    return false;
  }
}

async function main() {
  const endpoint = type === 'emplois' ? 'emplois' : 'concours';
  const apiUrl   = `${SITE_URL}/api/${endpoint}?limit=${limit}&page=1`;

  console.log(`\n🚀 Fetching ${limit} latest ${endpoint} from live API...`);
  console.log(`   URL: ${apiUrl}\n`);

  let records;
  try {
    const res = await axios.get(apiUrl, { timeout: 15000 });
    records = res.data?.data || res.data || [];
    if (!Array.isArray(records)) {
      console.error('❌ Unexpected API response format:', typeof records);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Failed to fetch from Vercel API:', err.message);
    process.exit(1);
  }

  console.log(`📋 Got ${records.length} records. Broadcasting...\n`);

  let successCount = 0;
  let failCount    = 0;

  for (const record of records) {
    const title = record.titre || record.title || '(no title)';
    console.log(`▶ ${title.substring(0, 70)}`);

    try {
      const text = type === 'emplois'
        ? buildEmploiMessage(record)
        : buildConcoursMessage(record);

      await sendToChannel(text);
      successCount++;

      // 3 second delay between messages to avoid Telegram rate limits
      if (successCount < records.length) {
        await new Promise(r => setTimeout(r, 3000));
      }
    } catch (err) {
      const apiErr = err.response?.data?.description || err.message;
      console.error(`   ❌ Failed: ${apiErr}`);
      failCount++;
    }
  }

  console.log(`\n✅ Done! Sent: ${successCount}  |  Failed: ${failCount}`);
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
