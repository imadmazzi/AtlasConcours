const cron = require('node-cron');
const { runScraper, runJobScraper, runAnapecScraper } = require('./scraper');

let isScrapingDaily = false;
let isScrapingAnapec = false;

/**
 * Initialise l'automatisation des tâches
 */
function initAutomation() {
  console.log("⏰ Initialisation du planificateur de tâches (Cron)...");

  // Planification quotidienne à 03h00 du matin
  cron.schedule('0 3 * * *', async () => {
    if (isScrapingDaily) {
      console.log("⚠️ Le scraping quotidien est déjà en cours. Ignoré.");
      return;
    }
    isScrapingDaily = true;
    try {
      console.log("📅 Tâche programmée: Lancement du scraping quotidien...");
      await runScraper();
      await runJobScraper();
    } finally {
      isScrapingDaily = false;
    }
  });

  // Planification horaire pour ANAPEC
  cron.schedule('0 * * * *', async () => {
    if (isScrapingAnapec) {
      console.log("⚠️ Le scraping ANAPEC horaire est déjà en cours. Ignoré.");
      return;
    }
    isScrapingAnapec = true;
    try {
      console.log("📅 Tâche programmée: Lancement du scraping ANAPEC horaire...");
      await runAnapecScraper();
    } finally {
      isScrapingAnapec = false;
    }
  });

  // Possibilité de lancer manuellement via une variable d'environnement pour le test
  if (process.env.RUN_SCRAPER_ON_START === 'true') {
    console.log("🔥 Lancement immédiat du scraper (RUN_SCRAPER_ON_START=true)...");
    runScraper();
    runJobScraper();
    runAnapecScraper();
  }
}

module.exports = { initAutomation };
