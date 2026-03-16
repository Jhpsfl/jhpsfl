// write-debug.js - run from C:\websites\jhps to create debug-visual.js
const fs = require("fs");

const src = `require("dotenv").config();
const puppeteer = require("puppeteer-core");
const fs2 = require("fs");
const path = require("path");

const sleep = ms => new Promise(r => setTimeout(r, ms));

const CHROME = "C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe";
const COOKIES = path.join(__dirname, "yelp-cookies.json");
const BIZ_ID = "Nf0H0JSPqnptTgu6KLy_Lg";
const INBOX_URL = "https://biz.yelp.com/leads_center/" + BIZ_ID + "/leads";

(async () => {
  console.log("Launching visible browser...");
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: false,
    args: ["--no-sandbox", "--window-size=1400,900", "--disable-blink-features=AutomationControlled"],
    defaultViewport: null
  });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });
  const cookies = JSON.parse(fs2.readFileSync(COOKIES, "utf8"));
  await page.setCookie(...cookies);
  console.log("Loaded " + cookies.length + " cookies. Going to inbox...");
  await page.goto(INBOX_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(5000);
  const url = page.url();
  console.log("Landed: " + url);
  if (url.includes("/login") || url.includes("/signin")) {
    console.log("SESSION EXPIRED - need to re-login");
  } else {
    console.log("SUCCESS - logged in!");
  }
  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll("a"))
      .map(a => ({ h: a.href, t: a.innerText.trim().slice(0, 60) }))
      .filter(a => a.h.includes("yelp.com") && a.h.length > 30)
      .slice(0, 40)
  );
  console.log("\\nYELP LINKS (" + links.length + "):");
  links.forEach((l, i) => console.log("  [" + i + "] " + l.t.replace(/\\n/g, " ") + "\\n       " + l.h));
  const raw = await page.evaluate(() => document.body.innerText.slice(0, 3000));
  console.log("\\nPAGE TEXT:\\n" + raw);
  console.log("\\nBrowser open. Press ENTER here to close.");
  await new Promise(r => { process.stdin.resume(); process.stdin.once("data", r); });
  await browser.close();
  console.log("Done.");
})();
`;

fs.writeFileSync("C:/websites/yelp-agent/debug-visual.js", src);
console.log("Written: C:/websites/yelp-agent/debug-visual.js");
