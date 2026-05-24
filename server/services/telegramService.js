'use strict';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * telegramService.js
 * Utility service: broadcast a new offer to the AtlasConcours Telegram channel.
 *
 * Integration points:
 *   • Called from scraper.js › insertItemNow() right after a successful INSERT.
 *   • ONLY fires for brand-new inserts (caller responsibility — no duplicates).
 *   • All errors are caught and logged; they NEVER propagate to the cron cycle.
 *
 * Environment variables (set in .env and Vercel dashboard):
 *   TELEGRAM_BOT_TOKEN   – Bot API token from @BotFather
 *   TELEGRAM_CHANNEL_ID  – Channel username e.g. @atlasconcours
 * ─────────────────────────────────────────────────────────────────────────────
 */

const axios = require('axios');

const BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN  || '';
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || '@atlasconcours';
const BASE_URL   = `https://api.telegram.org/bot${BOT_TOKEN}`;
const SITE_URL   = 'https://atlasconcours.vercel.app';

// Disable broadcasting when token is missing (dev environments without .env)
function isConfigured() {
  return BOT_TOKEN.length > 10;
}

/**
 * Escape characters that have special meaning in Telegram HTML mode.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Format a date string into a human-readable French date.
 * Falls back to the raw string if parsing fails.
 * @param {string} dateStr
 * @returns {string}
 */
function formatDate(dateStr) {
  if (!dateStr || dateStr === 'N/A') return 'Consulter l\'annonce';
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return String(dateStr).trim();
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch (_) {
    return String(dateStr).trim();
  }
}

/**
 * Build the Telegram HTML message for a new concours.
 *
 * @param {{ id: number, titre: string, organisme?: string, date_limite?: string }} concours
 * @returns {string} HTML-formatted Telegram message
 */
function buildConcoursMessage(concours) {
  const titre     = escapeHtml(concours.titre     || 'Nouveau Concours');
  const organisme = escapeHtml(concours.organisme || 'Secteur Public');
  const deadline  = escapeHtml(formatDate(concours.date_limite));
  const link      = `${SITE_URL}/concours/${concours.id}`;

  return [
    `🎓 <b>Nouveau Concours Public</b>`,
    ``,
    `📢 <b>${titre}</b>`,
    ``,
    `🏛 <b>Organisme :</b> ${organisme}`,
    `📅 <b>Date Limite :</b> <b>${deadline}</b>`,
    ``,
    `🔗 <a href="${link}">Voir les détails et postuler ici</a>`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━`,
    `📌 Restez informés sur <a href="${SITE_URL}">AtlasConcours.ma</a>`,
    `🔔 Abonnez-vous à notre canal pour ne rien manquer !`,
  ].join('\n');
}

/**
 * Build the Telegram HTML message for a new emploi (job offer).
 *
 * @param {{ id: number, titre: string, entreprise?: string, localisation?: string, date_limite?: string }} emploi
 * @returns {string} HTML-formatted Telegram message
 */
function buildEmploiMessage(emploi) {
  const titre       = escapeHtml(emploi.titre       || 'Nouvelle Offre d\'Emploi');
  const entreprise  = escapeHtml(emploi.entreprise  || emploi.organisme || 'Administration');
  const localisation = escapeHtml(emploi.localisation || emploi.ville || 'Maroc');
  const deadline    = escapeHtml(formatDate(emploi.date_limite || emploi.deadline));
  const link        = `${SITE_URL}/jobs/${emploi.id}`;

  return [
    `💼 <b>Nouvelle Offre d'Emploi</b>`,
    ``,
    `📢 <b>${titre}</b>`,
    ``,
    `🏢 <b>Entreprise :</b> ${entreprise}`,
    `📍 <b>Localisation :</b> ${localisation}`,
    `📅 <b>Date Limite :</b> <b>${deadline}</b>`,
    ``,
    `🔗 <a href="${link}">Voir l'offre complète et postuler</a>`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━`,
    `📌 Restez informés sur <a href="${SITE_URL}">AtlasConcours.ma</a>`,
    `🔔 Abonnez-vous à notre canal pour ne rien manquer !`,
  ].join('\n');
}

/**
 * Send a message to the Telegram channel via the Bot API.
 * Internal helper — always safe, never throws.
 *
 * @param {string} text   HTML-formatted message body
 * @returns {Promise<void>}
 */
async function sendToChannel(text) {
  if (!isConfigured()) {
    console.warn('⚠️  [Telegram] BOT_TOKEN not configured — skipping broadcast.');
    return;
  }

  try {
    const response = await axios.post(
      `${BASE_URL}/sendMessage`,
      {
        chat_id:                  CHANNEL_ID,
        text,
        parse_mode:               'HTML',
        disable_web_page_preview: false,   // show rich link preview
      },
      {
        timeout: 10000,   // 10 s — never block the scraper for longer
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (response.data && response.data.ok) {
      console.log(`📣 [Telegram] Broadcast sent successfully (message_id: ${response.data.result?.message_id}).`);
    } else {
      console.warn('⚠️  [Telegram] API returned ok=false:', JSON.stringify(response.data));
    }
  } catch (err) {
    // Network error, rate-limit, bad token — log but NEVER rethrow
    const status  = err.response?.status;
    const apiErr  = err.response?.data?.description || err.message;
    console.error(`❌ [Telegram] Broadcast failed (HTTP ${status || 'N/A'}): ${apiErr}`);
  }
}

/**
 * Broadcast a newly inserted concours to the Telegram channel.
 * Safe to call fire-and-forget — catches all errors internally.
 *
 * @param {{ id: number, titre: string, organisme?: string, date_limite?: string }} concours
 * @returns {Promise<void>}
 */
async function broadcastConcours(concours) {
  const text = buildConcoursMessage(concours);
  await sendToChannel(text);
}

/**
 * Broadcast a newly inserted emploi to the Telegram channel.
 * Safe to call fire-and-forget — catches all errors internally.
 *
 * @param {{ id: number, titre: string, entreprise?: string, localisation?: string, date_limite?: string }} emploi
 * @returns {Promise<void>}
 */
async function broadcastEmploi(emploi) {
  const text = buildEmploiMessage(emploi);
  await sendToChannel(text);
}

module.exports = { broadcastConcours, broadcastEmploi };
