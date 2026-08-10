import puppeteer from "puppeteer-core";
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await puppeteer.launch({
  executablePath: chrome, headless: "new",
  args: ["--no-sandbox","--disable-gpu","--window-size=1440,900"],
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("http://127.0.0.1:5318/", { waitUntil: "networkidle2", timeout: 60000 });
await page.waitForSelector(".brand-name");
await page.evaluate(() => {
  [...document.querySelectorAll("button.chip")].find((b) => b.textContent?.trim() === "8")?.click();
});
await new Promise((r) => setTimeout(r, 700));
await page.screenshot({ path: "docs/screenshots/agentgrid-grid-8.png", fullPage: false });
await page.evaluate(() => {
  [...document.querySelectorAll("button.chip")].find((b) => b.textContent?.trim() === "Board")?.click();
});
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: "docs/screenshots/agentgrid-board-dnd.png", fullPage: false });
await page.evaluate(() => {
  [...document.querySelectorAll("button.chip")].find((b) => b.textContent?.trim() === "Skills")?.click();
});
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: "docs/screenshots/agentgrid-skills-drag.png", fullPage: false });
console.log("parity shots ok");
await browser.close();
