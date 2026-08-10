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
await new Promise((r) => setTimeout(r, 600));

for (const theme of ["Phosphor", "Amber", "Contrast"]) {
  await page.evaluate((label) => {
    const btns = [...document.querySelectorAll("button.chip")];
    const hit = btns.find((b) => (b.textContent || "").trim() === label);
    if (hit) hit.click();
  }, theme);
  await new Promise((r) => setTimeout(r, 700));
  const file = `docs/screenshots/agentgrid-theme-${theme.toLowerCase()}.png`;
  await page.screenshot({ path: file, fullPage: false });
  console.log("wrote", file);
}

await browser.close();
