const express = require('express');
const router = express.Router();
const db = require('../db');

// ─── Lazy Gemini Initialization ─────────────────────────────────────────────
// We initialize inside the request handler (not at module load time) so that:
// 1. A missing/invalid API key doesn't crash the entire server on boot.
// 2. The key is read AFTER dotenv has loaded (module-level reads can race).
let _genAI = null;
let _model = null;

function getGeminiModel() {
  if (_model) return _model;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'VOTRE_CLE_API') {
    throw new Error('GEMINI_API_KEY is not configured in environment variables.');
  }

  const { GoogleGenerativeAI } = require('@google/generative-ai');
  _genAI = new GoogleGenerativeAI(apiKey);

  // Use gemini-1.5-flash — stable, fast, and well-supported in SDK v0.24.x
  // systemInstruction keeps the AI persona separate from the chat history
  _model = _genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: `Tu es "ATLAS AI", l'assistant virtuel officiel et intelligent de la plateforme AtlasConcours.
Ton rôle est d'aider les utilisateurs à trouver des informations sur les concours publics et les offres d'emploi au Maroc.
Réponds toujours de manière polie, professionnelle et amicale.
Tu dois utiliser STRICTEMENT les données fournies dans le premier message système pour répondre aux questions.
Si un utilisateur demande un concours ou un emploi absent de la liste, dis-lui poliment que tu n'as pas d'informations à ce sujet pour le moment, ou que l'offre a probablement expiré.
Tu dois répondre en Darija (arabe marocain), Français, ou Arabe classique selon la langue utilisée par l'utilisateur.
Garde tes réponses concises, utiles et bien structurées. N'invente jamais d'informations.`,
  });

  return _model;
}

// ─── Build a compact context string from DB ──────────────────────────────────
// We intentionally OMIT long description fields to stay well within token limits.
// Limit: 40 concours + 40 emplois = max ~80 items in context.
function buildDbContext() {
  const MAX_ITEMS = 40;

  // db.prepare respects isExpired filtering internally
  const activeConcours = db.prepare('SELECT * FROM concours LIMIT ? OFFSET ?').all(MAX_ITEMS, 0);
  const activeEmplois  = db.prepare('SELECT * FROM emplois  LIMIT ? OFFSET ?').all(MAX_ITEMS, 0);

  const concoursLines = activeConcours.map(c =>
    `• [Concours] ${c.titre} | Catégorie: ${c.categorie || 'N/A'} | Date limite: ${c.date_limite || 'Non précisée'} | Lien: ${c.lien_source || 'N/A'}`
  ).join('\n');

  const emploisLines = activeEmplois.map(e =>
    `• [Emploi] ${e.titre} | Entreprise: ${e.entreprise || 'N/A'} | Lieu: ${e.localisation || 'Maroc'} | Date limite: ${e.date_limite || e.deadline || 'Non précisée'}`
  ).join('\n');

  return (
    `=== CONCOURS PUBLICS ACTIFS (${activeConcours.length}) ===\n` +
    (concoursLines || 'Aucun concours actif pour le moment.') +
    `\n\n=== OFFRES D'EMPLOI ACTIVES (${activeEmplois.length}) ===\n` +
    (emploisLines || "Aucune offre d'emploi active pour le moment.")
  );
}

// ─── POST /api/chat ──────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { message, history } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Le champ "message" est requis.' });
  }

  try {
    const model = getGeminiModel();

    // Build compact DB context (no descriptions, max 40 items each)
    const dbContext = buildDbContext();

    // Format previous chat history for Gemini
    // The first exchange injects the DB context so the AI knows what's available
    const contextTurn = [
      {
        role: 'user',
        parts: [{ text: `Voici les données actuelles de la plateforme AtlasConcours. Utilise-les pour répondre aux questions:\n\n${dbContext}` }],
      },
      {
        role: 'model',
        parts: [{ text: "Parfait, j'ai bien reçu les données actuelles. Je suis ATLAS AI et je suis prêt à aider les utilisateurs avec ces informations." }],
      },
    ];

    // Append any previous turns from the frontend (skip the very first context exchange if resent)
    const userHistory = (history || []).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    const chat = model.startChat({
      history: [...contextTurn, ...userHistory],
      generationConfig: {
        maxOutputTokens: 800,
        temperature: 0.6,
      },
    });

    const result   = await chat.sendMessage(message.trim());
    const response = await result.response;
    const text     = response.text();

    return res.json({ reply: text });

  } catch (error) {
    // Log the full real error on the server so we can debug from Vercel logs
    console.error('═══════════════════════════════════════════════════');
    console.error('ATLAS AI /api/chat ERROR:', error.message);
    console.error('Error name:', error.name);
    console.error('Error status:', error.status || 'N/A');
    console.error('Stack:', error.stack);
    console.error('═══════════════════════════════════════════════════');

    // Return a readable error to the client for easier debugging
    const isDev = process.env.NODE_ENV !== 'production';
    return res.status(500).json({
      error: "Désolé, je rencontre des difficultés techniques. Veuillez réessayer plus tard.",
      ...(isDev && { debug: error.message }),
    });
  }
});

module.exports = router;
