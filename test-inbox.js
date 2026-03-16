require('dotenv').config();
const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-blink-features=AutomationControlled'],
    defaultViewport: { width: 1280, height: 900 }
  });

  const page = await browser.newPage();
  const cookies = JSON.parse(fs.readFileSync('C:/websites/yelp-agent/yelp-cookies.json','utf8'));
  await page.setCookie(...cookies);
  console.log('Cookies loaded:', cookies.length);

  const urls = [
    'https://biz.yelp.com/',
    'https://biz.yelp.com/messaging/inbox',
    'https://biz.yelp.com/leads',
    'https://biz.yelp.com/messages'
  ];

  for (const url of urls) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      const finalUrl = page.url();
      const title = await page.title();
      const snippet = await page.evaluate(() => document.body.innerText.slice(0, 200).replace(/\n/g, ' '));
      console.log('\n---');
      console.log('Tried   :', url);
      console.log('Landed  :', finalUrl);
      console.log('Title   :', title);
      console.log('Body    :', snippet.slice(0, 150));
    } catch(e) {
      console.log('TIMEOUT/ERROR for', url, ':', e.message);
    }
  }

  await browser.close();
  console.log('\nDone');
})().catch(e => console.error('FATAL:', e.message));
