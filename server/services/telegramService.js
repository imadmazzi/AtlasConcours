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
 * Sanitize date_limite: strip trailing garbage like " - 16", extra whitespace, etc.
 */
function sanitizeDate(dateStr) {
  if (!dateStr || dateStr === 'N/A') return dateStr;
  // Remove trailing " - <digits>" patterns and trim
  return String(dateStr)
    .replace(/\s*-\s*\d{1,4}\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Format a date string into a human-readable French date.
 */
function formatDate(dateStr) {
  const cleaned = sanitizeDate(dateStr);
  if (!cleaned || cleaned === 'N/A') return 'Consulter l\'annonce';
  try {
    const d = new Date(cleaned);
    if (isNaN(d)) return cleaned;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch (_) {
    return cleaned;
  }
}

/**
 * Extract metadata from description HTML, using the SAME regex logic
 * as the frontend ConcoursDetailPage.jsx / JobDetailPage.jsx.
 * This ensures Telegram messages show the SAME info as the actual page.
 */
function extractMetaFromHtml(html) {
  if (!html) return {};
  const text = html.replace(/<[^>]*>/gm, ' ').replace(/\s+/g, ' ');

  const grab = (re) => {
    const m = text.match(re);
    return m ? m[1].trim() : null;
  };

  return {
    organisme:  grab(/(?:Minist[eè]re|Organisme|Administration|Établissement)[\s:–\-]*([^|<\n]{4,80}?)(?:\s*[\n|]|(?=\s{2,}))/i),
    postes:     grab(/(?:Nombre\s+de\s+postes?|Postes?\s+ouverts?)[\s:–\-]*(\d{1,4})/i),
    grade:      grab(/(?:Grade|Échelle|Echelon|Corps)[\s:–\-]*([A-Za-zÀ-ÿ0-9 \-éèêëàâùûü']{3,60}?)(?:\s*[\n|]|(?=\s{2,}))/i),
    entreprise: grab(/(?:Entreprise|Société|Employeur)[\s:–\-]*([^|<\n]{3,80}?)(?:\s*[\n|]|(?=\s{2,}))/i),
    contrat:    grab(/(?:Type de contrat|Contrat)[\s:–\-]*([^\n.<]{2,50})/i),
  };
}

/**
 * Detect if an "entreprise" value is actually an ANAPEC reference code
 * (e.g. "EL2205261124948", "AG2205261124954") rather than a real company name.
 */
function isAnapecCode(value) {
  if (!value) return false;
  return /^[A-Z]{2}\d{10,}$/.test(value.trim());
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
 * Uses the LIVE record from the API to guarantee title/URL/details are consistent.
 * Falls back to extracting organisme from description HTML (same as frontend).
 */
function buildConcoursMessage(liveRecord) {
  const titre     = escapeHtml(liveRecord.titre || 'Nouveau Concours');

  // Extract organisme from description HTML — same logic the frontend uses
  const meta      = extractMetaFromHtml(liveRecord.description);
  const organisme = escapeHtml(liveRecord.organisme || meta.organisme || liveRecord.categorie || '');
  const deadline  = escapeHtml(formatDate(liveRecord.date_limite));
  const identifier = liveRecord.slug || liveRecord.id;
  const link      = `${SITE_URL}/concours/${identifier}`;

  const lines = [
    `🎓 <b>Nouveau Concours Public</b>`,
    ``,
    `📢 <b>${titre}</b>`,
    ``,
  ];

  // Only show Organisme if we have a real value
  if (organisme) {
    lines.push(`🏛 <b>Organisme :</b> ${organisme}`);
  }

  // Show postes count if available
  if (meta.postes) {
    lines.push(`👥 <b>Postes :</b> ${escapeHtml(meta.postes)}`);
  }

  lines.push(
    `📅 <b>Date Limite :</b> <b>${deadline}</b>`,
    ``,
    `🔗 <a href="${link}">Voir les détails et postuler ici</a>`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━`,
    `📌 Restez informés sur <a href="${SITE_URL}">AtlasConcours.ma</a>`,
    `🔔 Abonnez-vous à notre canal pour ne rien manquer !`,
  );

  return {
    text: lines.join('\n'),
    link
  };
}

/**
 * Build the Telegram HTML message for a new emploi.
 * Uses the LIVE record from the API to guarantee title/URL/details are consistent.
 * Detects and replaces ANAPEC reference codes with a clean fallback.
 */
function buildEmploiMessage(liveRecord) {
  const titre = escapeHtml(liveRecord.titre || 'Nouvelle Offre d\'Emploi');

  // Extract metadata from HTML description (same as frontend)
  const meta = extractMetaFromHtml(liveRecord.description);

  // Use DB entreprise, but if it's an ANAPEC code, fall back to extracted or generic
  let rawEntreprise = liveRecord.entreprise || liveRecord.organisme || '';
  if (isAnapecCode(rawEntreprise)) {
    rawEntreprise = meta.entreprise || 'Secteur Public / Privé';
  }
  const entreprise   = escapeHtml(rawEntreprise || 'Administration');
  const localisation = escapeHtml(liveRecord.localisation || liveRecord.ville || 'Maroc');
  const deadline     = escapeHtml(formatDate(liveRecord.date_limite || liveRecord.deadline));
  const id           = liveRecord.id;
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
 * Uses the LIVE record from the API to build the message — this guarantees
 * the Telegram text matches exactly what the user sees on the page.
 *
 * @param {object} concours The concours object to broadcast
 */
async function broadcastConcours(concours) {
  // Use the exact object passed to the function
  const identifier = concours.slug || concours._id || concours.id;
  if (!identifier) {
    console.warn('⚠️  [Telegram] Concours has no slug or id — skipping broadcast.');
    return;
  }

  const { ok, liveRecord } = await validateLiveRecord('concours', identifier);
  if (!ok) return;  // URL is broken on the live site — do NOT send

  // CRITICAL: Build message from the LIVE API record, not the local object.
  // This guarantees the Telegram message text matches the page the user will see.
  const source = liveRecord || concours;
  const { text, link } = buildConcoursMessage(source);

  console.log(`[TELEGRAM MATCH] Sending title: "${source.titre}" with URL: "${link}"`);

  await sendToChannel(text);
  await new Promise(resolve => setTimeout(resolve, 3000));
}

/**
 * Broadcast a newly inserted emploi to the Telegram channel.
 * Validates the record exists on the live site before sending.
 * Uses the LIVE record from the API to build the message.
 *
 * @param {object} emploi The emploi object to broadcast
 */
async function broadcastEmploi(emploi) {
  // Use the exact object passed to the function
  const identifier = emploi._id || emploi.id;
  if (!identifier) {
    console.warn('⚠️  [Telegram] Emploi has no id — skipping broadcast.');
    return;
  }

  const { ok, liveRecord } = await validateLiveRecord('emplois', identifier);
  if (!ok) return;  // URL is broken on the live site — do NOT send

  // CRITICAL: Build message from the LIVE API record, not the local object.
  const source = liveRecord || emploi;
  const { text, link } = buildEmploiMessage(source);

  console.log(`[TELEGRAM MATCH] Sending title: "${source.titre}" with URL: "${link}"`);

  await sendToChannel(text);
  await new Promise(resolve => setTimeout(resolve, 3000));
}

module.exports = { broadcastConcours, broadcastEmploi };
