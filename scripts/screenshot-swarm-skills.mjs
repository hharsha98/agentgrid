import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const chrome =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

mkdirSync("docs/screenshots", { recursive: true });

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--window-size=1440,900"],
  defaultViewport: { width: 1440, height: 900 },
});

const page = await browser.newPage();
await page.goto("http://127.0.0.1:5318/", { waitUntil: "networkidle2", timeout: 60000 });
await page.waitForSelector(".brand-name", { timeout: 15000 });
await new Promise((r) => setTimeout(r, 500));

async function clickLabel(re) {
  await page.evaluate((pattern) => {
    const re = new RegExp(pattern, "i");
    const els = [...document.querySelectorAll("button, .chip, a")];
    const hit = els.find((el) => re.test((el.textContent || "").trim()));
    if (hit) hit.click();
  }, re.source);
  await new Promise((r) => setTimeout(r, 1000));
}

await clickLabel(/swarm/);
await page.screenshot({ path: "docs/screenshots/agentgrid-swarm.png", fullPage: false });
console.log("wrote docs/screenshots/agentgrid-swarm.png");

await clickLabel(/skills/);
await page.screenshot({ path: "docs/screenshots/agentgrid-skills.png", fullPage: false });
console.log("wrote docs/screenshots/agentgrid-skills.png");

await browser.close();
