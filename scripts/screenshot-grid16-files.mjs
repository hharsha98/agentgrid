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

// Click layout 16
await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button.chip")];
  const hit = btns.find((b) => (b.textContent || "").trim() === "16");
  if (hit) hit.click();
});
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: "docs/screenshots/agentgrid-grid-16.png", fullPage: false });
console.log("wrote grid-16");

// Files view
await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button.chip")];
  const hit = btns.find((b) => (b.textContent || "").trim() === "Files");
  if (hit) hit.click();
});
await new Promise((r) => setTimeout(r, 1200));
// open first file if any
await page.evaluate(() => {
  const item = document.querySelector("button.files-item");
  if (item) item.click();
});
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: "docs/screenshots/agentgrid-files-monaco.png", fullPage: false });
console.log("wrote files-monaco");

await browser.close();
