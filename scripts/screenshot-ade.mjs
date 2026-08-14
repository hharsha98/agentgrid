import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";

const chrome =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!existsSync(chrome)) {
  console.log("skip screenshots: Chrome not found at", chrome);
  process.exit(0);
}

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--window-size=1440,900"],
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("http://127.0.0.1:5318/", { waitUntil: "networkidle2", timeout: 60000 });
await page.waitForSelector(".top-brand .brand-name");
await page.screenshot({ path: "docs/screenshots/agentgrid-overview.png", fullPage: false });

await page.evaluate(() => {
  [...document.querySelectorAll(".rail-btn")].find((b) => b.textContent?.includes("Board"))?.click();
});
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: "docs/screenshots/agentgrid-board.png", fullPage: false });

await page.evaluate(() => {
  [...document.querySelectorAll(".rail-btn")].find((b) => b.textContent?.includes("Swarm"))?.click();
});
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: "docs/screenshots/agentgrid-swarm.png", fullPage: false });

await page.evaluate(() => {
  [...document.querySelectorAll(".rail-btn")].find((b) => b.textContent?.includes("Browser"))?.click();
});
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: "docs/screenshots/agentgrid-browser.png", fullPage: false });

await page.evaluate(() => {
  [...document.querySelectorAll(".rail-btn")].find((b) => b.textContent?.includes("Grid"))?.click();
  [...document.querySelectorAll("button.chip")].find((b) => b.textContent?.trim() === "Dock")?.click();
});
await new Promise((r) => setTimeout(r, 700));
await page.screenshot({ path: "docs/screenshots/agentgrid-files.png", fullPage: false });

console.log("ADE screenshots ok");
await browser.close();
