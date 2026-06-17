const express = require('express');
const router = express.Router();
const db = require('../db');

// ─── Lazy Gemini Initialization ─────────────────────────────────────────────
let _genAI = null;
let _model = null;

function getGenAI() {
  if (_genAI) return _genAI;
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'VOTRE_CLE_API') {
    throw new Error('GEMINI_API_KEY is missing or not configured.');
  }
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  _genAI = new GoogleGenerativeAI(apiKey);
  return _genAI;
}

function getModel() {
  if (_model) return _model;
  
  _model = getGenAI().getGenerativeModel({
    model: 'gemini-3.5-flash',
    systemInstruction: `Tu es "ATLAS AI", l'assistant virtuel officiel de AtlasConcours.
Réponds en Darija, Français ou Arabe classique selon l'utilisateur.
Utilise UNIQUEMENT les données fournies par l'utilisateur pour répondre.
N'invente jamais d'informations. Garde tes réponses concises.`
  });
  
  return _model;
}

// ─── Build compact DB context (no descriptions, max 40 items) ───────────────
function buildDbContext() {
  const MAX = 40;
  let activeConcours = [];
  let activeEmplois  = [];

  try {
    activeConcours = db.prepare('SELECT * FROM concours LIMIT ? OFFSET ?').all(MAX, 0) || [];
  } catch (e) {
    console.warn('chat: failed to fetch concours:', e.message);
  }

  try {
    activeEmplois = db.prepare('SELECT * FROM emplois LIMIT ? OFFSET ?').all(MAX, 0) || [];
  } catch (e) {
    console.warn('chat: failed to fetch emplois:', e.message);
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

// ─── GET /api/chat/test ──────────────────────────────────────────────────────
router.get('/test', async (req, res) => {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  const diagnostics = {
    apiKeySet: !!apiKey && apiKey !== 'VOTRE_CLE_API',
    apiKeyPrefix: apiKey ? apiKey.substring(0, 8) + '...' : '(empty)',
    nodeEnv: process.env.NODE_ENV || 'not set',
    model: 'gemini-3.5-flash',
    sdkVersion: (() => {
      try { return require('@google/generative-ai/package.json').version; } catch { return 'unknown'; }
    })(),
    dbRecords: {
      concours: db.data?.concours?.length || 0,
      emplois:  db.data?.emplois?.length  || 0,
    },
    geminiTest: null,
    error: null,
  };

  try {
    // 1. Fetch available models for this specific API key
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (listRes.ok) {
      const data = await listRes.json();
      diagnostics.availableModels = (data.models || [])
        .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
        .map(m => m.name.replace('models/', ''));
    } else {
      diagnostics.availableModels = `Failed to fetch: ${listRes.status} ${listRes.statusText}`;
    }

    // 2. Try testing the requested model
    const model = getModel();
    const chat  = model.startChat({ history: [] });
    const result = await chat.sendMessage('Réponds juste "OK" en un seul mot.');
    diagnostics.geminiTest = (await result.response).text().trim();
  } catch (err) {
    diagnostics.error = {
      message: err.message,
      name:    err.name,
      status:  err.status || null,
      stack:   err.stack?.split('\n').slice(0, 5),
    };
    _genAI = null; // reset so next request retries
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
    const model      = getModel();
    const dbContext  = buildDbContext();

    const systemTurn = [
      {
        role: 'user',
        parts: [{
          text: `Voici les données actuelles de AtlasConcours. Utilise-les pour répondre aux questions de l'utilisateur.\n\n${dbContext}`
        }],
      },
      {
        role: 'model',
        parts: [{ text: "Compris. Je suis ATLAS AI, prêt à vous aider avec ces informations." }],
      },
    ];

    const userHistory = (Array.isArray(history) ? history : []).map(msg => ({
      role:  msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: String(msg.content || '') }],
    }));

    const chat = model.startChat({
      history: [...systemTurn, ...userHistory],
      generationConfig: {
        maxOutputTokens: 800,
        temperature:     0.6,
      },
    });

    const result   = await chat.sendMessage(message.trim());
    const response = await result.response;
    const text     = response.text();

    return res.json({ reply: text });

  } catch (error) {
    console.error('══════════════ ATLAS AI /api/chat ERROR ══════════════');
    console.error('Message:', error.message);
    console.error('Name   :', error.name);
    console.error('Status :', error.status || 'N/A');
    console.error('Stack  :', error.stack);
    console.error('═══════════════════════════════════════════════════════');

    _genAI = null; // reset so next request retries cleanly
    _model = null;

    return res.status(500).json({
      error:        "Désolé, je rencontre des difficultés techniques. Veuillez réessayer plus tard.",
      debug_error:  error.message,
      debug_name:   error.name,
      debug_status: error.status || null,
    });
  }
});

module.exports = router;
