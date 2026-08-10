import puppeteer from "puppeteer-core";
import { writeFileSync, mkdirSync } from "node:fs";

const chrome =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

mkdirSync("/tmp/agentgrid-shots", { recursive: true });

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--window-size=1440,900"],
  defaultViewport: { width: 1440, height: 900 },
});

const page = await browser.newPage();
await page.goto("http://127.0.0.1:5318/", { waitUntil: "networkidle2", timeout: 60000 });
await page.waitForSelector(".brand-name", { timeout: 15000 });

// Prefer 2-pane layout for a BridgeSpace-like look
const layoutBtns = await page.$$(".chip");
if (layoutBtns[1]) await layoutBtns[1].click();
await new Promise((r) => setTimeout(r, 800));

const path1 = "/tmp/agentgrid-shots/agentgrid-overview.png";
await page.screenshot({ path: path1, fullPage: false });
console.log("wrote", path1);

// Click Launch pane once more if needed and capture with sessions
const launch = await page.$("button.primary");
if (launch) {
  // already have sessions from API; just wait for terminals
  await new Promise((r) => setTimeout(r, 1500));
}
const path2 = "/tmp/agentgrid-shots/agentgrid-grid-2.png";
await page.screenshot({ path: path2, fullPage: false });
console.log("wrote", path2);

await browser.close();
