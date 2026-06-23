const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  const html = await page.$eval('.navbar-container', el => el.outerHTML);
  console.log(html);
  await browser.close();
})();
