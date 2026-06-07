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
 *   • Before every broadcast, the link is validated against the live Vercel API.
 *     If the API returns 404, the message is NOT sent.
 *
 * Environment variables (set in .env and Vercel dashboard):
 *   TELEGRAM_BOT_TOKEN   – Bot API token from @BotFather
 *   TELEGRAM_CHANNEL_ID  – Channel username e.g. @atlasconcours
 * ─────────────────────────────────────────────────────────────────────────────
 */

const axios = require('axios');
const db = require('../db');

const BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN  || '';
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || '@atlasconcours';
const BASE_URL   = `https://api.telegram.org/bot${BOT_TOKEN}`;
const SITE_URL   = 'https://atlasconcours.vercel.app';
const API_BASE   = `${SITE_URL}/api`;

// Disable broadcasting when token is missing (dev environments without .env)
function isConfigured() {
  return BOT_TOKEN.length > 10;
}

/**
 * Escape characters that have special meaning in Telegram HTML mode.
 */
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Format a date string into a human-readable French date.
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
 * Validate that a record with this identifier actually exists on the live site.
 * Hits the live Vercel API — if it returns 404, the record does not exist there.
 *
 * @param {'concours'|'emplois'} type
 * @param {string|number} identifier  - slug or numeric id
 * @returns {Promise<{ok: boolean, liveRecord: object|null}>}
 */
async function validateLiveRecord(type, identifier) {
  const apiUrl = `${API_BASE}/${type}/${identifier}`;
  console.log(`🔍 [Telegram] Validating live URL: ${apiUrl}`);
  try {
    const res = await axios.get(apiUrl, { timeout: 8000, validateStatus: () => true });
    if (res.status === 200 && res.data && res.data.id) {
      console.log(`  ✅ Record confirmed live (id: ${res.data.id}, slug: ${res.data.slug || 'N/A'})`);
      return { ok: true, liveRecord: res.data };
    }
    console.warn(`  ⚠️  Live API returned HTTP ${res.status} for identifier "${identifier}" — skipping broadcast.`);
    return { ok: false, liveRecord: null };
  } catch (err) {
    console.warn(`  ⚠️  Could not reach live API: ${err.message} — skipping broadcast.`);
    return { ok: false, liveRecord: null };
  }
}

/**
 * Build the Telegram HTML message for a new concours.
 * Always uses the exact object's properties for the link.
 */
function buildConcoursMessage(concours) {
  const titre     = escapeHtml(concours.titre     || 'Nouveau Concours');
  const organisme = escapeHtml(concours.organisme || 'Secteur Public');
  const deadline  = escapeHtml(formatDate(concours.date_limite));
  const identifier = concours.slug || concours._id || concours.id;
  const link      = `${SITE_URL}/concours/${identifier}`;

  return {
    text: [
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
    ].join('\n'),
    link
  };
}

/**
 * Build the Telegram HTML message for a new emploi.
 * Always uses the exact object's properties for the link.
 */
function buildEmploiMessage(emploi) {
  const titre        = escapeHtml(emploi.titre        || 'Nouvelle Offre d\'Emploi');
  const entreprise   = escapeHtml(emploi.entreprise   || emploi.organisme || 'Administration');
  const localisation = escapeHtml(emploi.localisation || emploi.ville     || 'Maroc');
  const deadline     = escapeHtml(formatDate(emploi.date_limite || emploi.deadline));
  const id           = emploi._id || emploi.id;
  const link         = `${SITE_URL}/jobs/${id}`;

  return {
    text: [
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
    ].join('\n'),
    link
  };
}

/**
 * Send a message to the Telegram channel via the Bot API.
 * Internal helper — always safe, never throws.
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
        disable_web_page_preview: false,
      },
      {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (response.data && response.data.ok) {
      console.log(`📣 [Telegram] Broadcast sent successfully (message_id: ${response.data.result?.message_id}).`);
    } else {
      console.warn('⚠️  [Telegram] API returned ok=false:', JSON.stringify(response.data));
    }
  } catch (err) {
    const status = err.response?.status;
    const apiErr = err.response?.data?.description || err.message;
    console.error(`❌ [Telegram] Broadcast failed (HTTP ${status || 'N/A'}): ${apiErr}`);
  }
}

/**
 * Broadcast a newly inserted concours to the Telegram channel.
 * Validates the record exists on the live site before sending.
 *
 * @param {object} inputItem The concours object to broadcast
 */
async function broadcastConcours(concours) {
  // Use the exact object passed to the function
  const identifier = concours.slug || concours._id || concours.id;
  if (!identifier) {
    console.warn('⚠️  [Telegram] Concours has no slug or id — skipping broadcast.');
    return;
  }

  const { ok } = await validateLiveRecord('concours', identifier);
  if (!ok) return;  // URL is broken on the live site — do NOT send

  const { text, link } = buildConcoursMessage(concours);
  
  const titleLog = concours.titre || concours.title || 'Unknown Title';
  console.log(`[TELEGRAM MATCH] Sending title: "${titleLog}" with URL: "${link}"`);

  
  await sendToChannel(text);
  await new Promise(resolve => setTimeout(resolve, 3000));
}

/**
 * Broadcast a newly inserted emploi to the Telegram channel.
 * Validates the record exists on the live site before sending.
 *
 * @param {object} inputItem The emploi object to broadcast
 */
async function broadcastEmploi(emploi) {
  // Use the exact object passed to the function
  const identifier = emploi._id || emploi.id;
  if (!identifier) {
    console.warn('⚠️  [Telegram] Emploi has no id — skipping broadcast.');
    return;
  }

  const { ok } = await validateLiveRecord('emplois', identifier);
  if (!ok) return;  // URL is broken on the live site — do NOT send

  const { text, link } = buildEmploiMessage(emploi);
  
  const titleLog = emploi.titre || emploi.title || 'Unknown Title';
  console.log(`[TELEGRAM MATCH] Sending title: "${titleLog}" with URL: "${link}"`);

  
  await sendToChannel(text);
  await new Promise(resolve => setTimeout(resolve, 3000));
}

module.exports = { broadcastConcours, broadcastEmploi };
