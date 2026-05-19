const puppeteer = require('puppeteer');

(async () => {
  console.log("Starting Puppeteer for Admin...");
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('PAGE ERROR:', msg.text());
  });

  page.on('pageerror', error => {
    console.log('PAGE UNCAUGHT ERROR:', error.message);
  });

  console.log("Navigating to http://localhost:3000/admin/dashboard...");
  await page.goto('http://localhost:3000/admin/dashboard', { waitUntil: 'networkidle2' });
  
  const content = await page.content();
  console.log("Admin Dashboard Root Content:");
  console.log(await page.evaluate(() => document.getElementById('root')?.innerHTML));

  await browser.close();
})();
