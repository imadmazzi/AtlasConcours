const express = require('express');
const router = express.Router();
const db = require('../db');

// ─── Lazy Gemini Initialization ─────────────────────────────────────────────
let _model = null;

function getGeminiModel() {
  if (_model) return _model;

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'VOTRE_CLE_API') {
    throw new Error('GEMINI_API_KEY is missing or not configured in environment variables.');
  }

  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);

  _model = genAI.getGenerativeModel({
    model: 'gemini-pro',
    systemInstruction: `Tu es "ATLAS AI", l'assistant virtuel officiel de la plateforme AtlasConcours.
Ton rôle est d'aider les utilisateurs à trouver des informations sur les concours publics et les offres d'emploi au Maroc.
Réponds toujours de manière polie, professionnelle et amicale.
Utilise UNIQUEMENT les données fournies dans la conversation pour répondre aux questions.
Si un utilisateur demande un concours ou un emploi absent de la liste, dis-lui poliment que tu n'as pas d'informations à ce sujet.
Réponds en Darija, Français, ou Arabe classique selon la langue de l'utilisateur.
Garde tes réponses concises et bien structurées. N'invente jamais d'informations.`,
  });

  return _model;
}

// ─── Build compact DB context (no descriptions, max 40 items) ───────────────
function buildDbContext() {
  const MAX = 40;
  let activeConcours = [];
  let activeEmplois = [];

  try {
    activeConcours = db.prepare('SELECT * FROM concours LIMIT ? OFFSET ?').all(MAX, 0) || [];
  } catch (e) {
    console.warn('chat: failed to fetch concours from db:', e.message);
  }

  try {
    activeEmplois = db.prepare('SELECT * FROM emplois LIMIT ? OFFSET ?').all(MAX, 0) || [];
  } catch (e) {
    console.warn('chat: failed to fetch emplois from db:', e.message);
  }

  const concoursLines = activeConcours.map(c =>
    `• [Concours] ${c.titre} | Catégorie: ${c.categorie || 'N/A'} | Date limite: ${c.date_limite || 'Non précisée'}`
  ).join('\n');

  const emploisLines = activeEmplois.map(e =>
    `• [Emploi] ${e.titre} | Entreprise: ${e.entreprise || 'N/A'} | Lieu: ${e.localisation || 'Maroc'} | Date limite: ${e.date_limite || e.deadline || 'Non précisée'}`
  ).join('\n');

  return (
    `=== CONCOURS PUBLICS ACTIFS (${activeConcours.length}) ===\n` +
    (concoursLines || 'Aucun concours actif.') +
    `\n\n=== OFFRES D'EMPLOI ACTIVES (${activeEmplois.length}) ===\n` +
    (emploisLines || "Aucune offre d'emploi active.")
  );
}

// ─── GET /api/chat/test — Diagnostic endpoint ────────────────────────────────
// Call this endpoint directly in the browser to check env + SDK + Gemini connectivity.
router.get('/test', async (req, res) => {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  const diagnostics = {
    apiKeySet: !!apiKey && apiKey !== 'VOTRE_CLE_API',
    apiKeyPrefix: apiKey ? apiKey.substring(0, 8) + '...' : '(empty)',
    nodeEnv: process.env.NODE_ENV || 'not set',
    sdkVersion: (() => {
      try { return require('@google/generative-ai/package.json').version; } catch { return 'unknown'; }
    })(),
    dbRecords: {
      concours: db.data?.concours?.length || 0,
      emplois: db.data?.emplois?.length || 0,
    },
    geminiTest: null,
    error: null,
  };

  try {
    const model = getGeminiModel();
    const chat = model.startChat({ history: [] });
    const result = await chat.sendMessage('Réponds juste "OK" en un mot.');
    const text = (await result.response).text();
    diagnostics.geminiTest = text.trim();
  } catch (err) {
    diagnostics.error = {
      message: err.message,
      name: err.name,
      status: err.status || err.statusText || null,
      stack: err.stack?.split('\n').slice(0, 5),
    };
    // Reset cached model so next real request can retry
    _model = null;
  }

  res.json(diagnostics);
});

// ─── POST /api/chat ──────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { message, history } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Le champ "message" est requis.' });
  }

  try {
    const model = getGeminiModel();
    const dbContext = buildDbContext();

    // Seed the conversation with DB context as the first exchange
    const contextHistory = [
      {
        role: 'user',
        parts: [{ text: `Voici les données actuelles de AtlasConcours. Utilise-les pour répondre:\n\n${dbContext}` }],
      },
      {
        role: 'model',
        parts: [{ text: "Parfait, j'ai reçu les données. Je suis ATLAS AI, prêt à vous aider!" }],
      },
    ];

    const userHistory = (Array.isArray(history) ? history : []).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: String(msg.content || '') }],
    }));

    const chat = model.startChat({
      history: [...contextHistory, ...userHistory],
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
    // Always log the full error to Vercel/Railway server logs
    console.error('══════════════════════ ATLAS AI ERROR ══════════════════════');
    console.error('Message :', error.message);
    console.error('Name    :', error.name);
    console.error('Status  :', error.status || error.statusText || 'N/A');
    console.error('Stack   :', error.stack);
    console.error('════════════════════════════════════════════════════════════');

    // Reset the cached model so the next request gets a fresh attempt
    _model = null;

    // Return the real error in the response so the user can see it and report it
    return res.status(500).json({
      error: "Désolé, je rencontre des difficultés techniques. Veuillez réessayer plus tard.",
      debug_error: error.message,   // always visible — helps diagnose without needing log access
      debug_name: error.name,
      debug_status: error.status || error.statusText || null,
    });
  }
});

module.exports = router;
