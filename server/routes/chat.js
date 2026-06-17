const express = require('express');
const router = express.Router();
const db = require('../db');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "VOTRE_CLE_API");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

router.post('/', async (req, res) => {
  const { message, history } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  try {
    // 1. Fetch active listings from the database
    // We pass 100 as limit and 0 as offset to get a good chunk of recent active items
    const activeConcours = db.prepare('SELECT * FROM concours LIMIT ? OFFSET ?').all(100, 0);
    const activeEmplois = db.prepare('SELECT * FROM emplois LIMIT ? OFFSET ?').all(100, 0);

    // 2. Format listings for context
    const concoursContext = activeConcours.map(c => 
      `- Concours: ${c.titre} | Catégorie: ${c.categorie} | Date limite: ${c.date_limite || 'Non spécifiée'}`
    ).join('\n');

    const emploisContext = activeEmplois.map(e => 
      `- Emploi: ${e.titre} | Entreprise: ${e.entreprise} | Localisation: ${e.localisation} | Date limite: ${e.date_limite || e.deadline || 'Non spécifiée'}`
    ).join('\n');

    const dbContext = `
      Voici la liste des concours publics actuellement actifs:
      ${concoursContext || 'Aucun concours actif pour le moment.'}

      Voici la liste des offres d'emploi actuellement actives:
      ${emploisContext || 'Aucune offre d\'emploi active pour le moment.'}
    `;

    // 3. Construct the prompt
    const systemInstruction = `
      Tu es "ATLAS AI", l'assistant virtuel officiel et intelligent de la plateforme AtlasConcours.
      Ton rôle est d'aider les utilisateurs à trouver des informations sur les concours publics et les offres d'emploi au Maroc.
      Réponds toujours de manière polie, professionnelle et amicale.
      Tu dois utiliser STRICTEMENT les données fournies ci-dessous (listes actives) pour répondre aux questions concernant les offres ou concours. 
      Si un utilisateur te demande des informations sur un concours ou un emploi qui ne figure pas dans cette liste, dis-lui poliment que tu n'as pas d'informations à ce sujet pour le moment, ou que l'offre a probablement expiré.
      Tu dois être capable de répondre en Darija (arabe marocain), Français, ou Arabe classique, selon la langue utilisée par l'utilisateur.
      Garde tes réponses concises et bien structurées.
      
      DONNÉES ACTUELLES DE LA PLATEFORME (CONTEXTE) :
      ${dbContext}
    `;

    // Format chat history for Gemini
    const formattedHistory = (history || []).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    // Start a chat session
    const chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: systemInstruction }]
        },
        {
          role: "model",
          parts: [{ text: "Compris. Je suis ATLAS AI, prêt à aider les utilisateurs avec ces données." }]
        },
        ...formattedHistory
      ],
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7,
      },
    });

    // 4. Generate response
    const result = await chat.sendMessage(message);
    const response = await result.response;
    const text = response.text();

    res.json({ reply: text });
  } catch (error) {
    console.error("Chat API Error:", error);
    res.status(500).json({ error: "Une erreur s'est produite lors de la communication avec ATLAS AI." });
  }
});

module.exports = router;
