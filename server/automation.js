const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const { runScraper, runJobScraper, runAnapecScraper } = require('./scraper');

const LOG_DIR = process.env.CRON_LOG_DIR || path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'cron-automation.log');
const SCRAPER_SOURCES = {
  anapec: runAnapecScraper,
  jobs: runJobScraper,
  concours: runScraper,
};
const LOCAL_HOURLY_CRON = process.env.LOCAL_HOURLY_CRON_SCHEDULE || '0 * * * *';
const DAILY_CRON = process.env.DAILY_CRON_SCHEDULE || '0 0 * * *';

let activePipeline = null;
let activePipelineStartedAt = null;

function timestamp() {
  return new Date().toISOString();
}

function logAutomation(message, level = 'log') {
  const line = `[CRON AUTOMATION] ${message}`;
  const output = `${timestamp()} ${line}`;

  if (level === 'error') {
    console.error(output);
  } else if (level === 'warn') {
    console.warn(output);
  } else {
    console.log(output);
  }

  fs.promises.mkdir(LOG_DIR, { recursive: true })
    .then(() => fs.promises.appendFile(LOG_FILE, `${output}\n`))
    .catch((err) => {
      console.warn(`[CRON AUTOMATION] File logging unavailable: ${err.message}`);
    });
}

function normalizeSources(sources) {
  const requested = Array.isArray(sources) && sources.length > 0
    ? sources
    : ['anapec', 'jobs', 'concours'];

  return requested.filter((source) => {
    if (SCRAPER_SOURCES[source]) return true;
    logAutomation(`Unknown scraper source "${source}" ignored.`, 'warn');
    return false;
  });
}

async function runAutomatedScraperPipeline({ trigger = 'manual', sources, force = false } = {}) {
  const selectedSources = normalizeSources(sources);
  const startedAt = Date.now();
  const results = {};

  logAutomation(`Triggering automated scraper pipeline at ${timestamp()} (trigger=${trigger}, sources=${selectedSources.join(',')}, force=${force})`);

  for (const source of selectedSources) {
    const sourceStartedAt = Date.now();
    try {
      logAutomation(`Starting ${source} scraper.`);
      results[source] = await SCRAPER_SOURCES[source](force);
      logAutomation(`Finished ${source} scraper in ${Date.now() - sourceStartedAt}ms: ${JSON.stringify(results[source])}`);
    } catch (err) {
      results[source] = { added: 0, errors: 1, error: err.message };
      logAutomation(`${source} scraper failed but automation will continue: ${err.stack || err.message}`, 'error');
    }
  }

  try {
    if (typeof db.flush === 'function') {
      await db.flush();
    } else if (typeof db.save === 'function') {
      await db.save();
    }
  } catch (err) {
    results.flush = { error: err.message };
    logAutomation(`Database flush failed after scraper pipeline: ${err.stack || err.message}`, 'error');
  }

  logAutomation(`Automated scraper pipeline completed in ${Date.now() - startedAt}ms.`);
  return results;
}

function triggerAutomatedScraperPipeline(options = {}) {
  if (activePipeline) {
    logAutomation(`Skipping ${options.trigger || 'manual'} trigger because a pipeline started at ${activePipelineStartedAt} is still running.`, 'warn');
    return Promise.resolve({
      skipped: true,
      reason: 'scraper pipeline already running',
      activePipelineStartedAt,
    });
  }

  activePipelineStartedAt = timestamp();
  activePipeline = runAutomatedScraperPipeline(options)
    .catch((err) => {
      logAutomation(`Unexpected pipeline failure: ${err.stack || err.message}`, 'error');
      return { error: err.message };
    })
    .finally(() => {
      activePipeline = null;
      activePipelineStartedAt = null;
    });

  return activePipeline;
}

function initAutomation() {
  try {
    logAutomation('Initializing cron scheduler.');

    cron.schedule(LOCAL_HOURLY_CRON, () => {
      logAutomation(`Hourly cron woke up at ${timestamp()}.`);
      triggerAutomatedScraperPipeline({
        trigger: 'hourly-cron',
        sources: ['anapec', 'jobs', 'concours'],
      });
    });

    cron.schedule(DAILY_CRON, () => {
      logAutomation(`Daily safety cron woke up at ${timestamp()}.`);
      triggerAutomatedScraperPipeline({
        trigger: 'daily-safety-cron',
        sources: ['anapec', 'jobs', 'concours'],
      });
    });

    if (process.env.RUN_SCRAPER_ON_START === 'true') {
      logAutomation('RUN_SCRAPER_ON_START=true; launching startup scraper pipeline.');
      triggerAutomatedScraperPipeline({
        trigger: 'startup',
        sources: ['anapec', 'jobs', 'concours'],
      });
    }

    logAutomation(`Cron scheduler registered: local hourly pipeline at ${LOCAL_HOURLY_CRON}, daily safety pipeline at ${DAILY_CRON}. Vercel production uses vercel.json only.`);
  } catch (err) {
    logAutomation(`Cron scheduler failed to initialize: ${err.stack || err.message}`, 'error');
  }
}

module.exports = {
  initAutomation,
  triggerAutomatedScraperPipeline,
  runAutomatedScraperPipeline,
  logAutomation,
};
