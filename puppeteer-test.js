const puppeteer = require('puppeteer');

(async () => {
  console.log("Starting Puppeteer...");
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('PAGE ERROR:', msg.text());
    } else {
      console.log('PAGE LOG:', msg.text());
    }
  });

  page.on('pageerror', error => {
    console.log('PAGE UNCAUGHT ERROR:', error.message);
  });

  page.on('requestfailed', request => {
    console.log('PAGE REQUEST FAILED:', request.url(), request.failure().errorText);
  });

  console.log("Navigating to http://localhost:3000/...");
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
  
  const content = await page.content();
  console.log("Root element content:");
  console.log(await page.evaluate(() => document.getElementById('root')?.innerHTML));

  await browser.close();
})();
