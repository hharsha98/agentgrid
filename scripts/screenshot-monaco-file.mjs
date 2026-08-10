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
  [...document.querySelectorAll("button.chip")].find((b) => b.textContent?.trim() === "Files")?.click();
});
await new Promise((r) => setTimeout(r, 1000));
await page.evaluate(() => {
  const clickNamed = (name) => {
    const btn = [...document.querySelectorAll("button.files-item")].find((b) =>
      (b.textContent || "").includes(name),
    );
    btn?.click();
    return Boolean(btn);
  };
  clickNamed("agentgrid");
});
await new Promise((r) => setTimeout(r, 900));
await page.evaluate(() => {
  const clickNamed = (name) => {
    const btn = [...document.querySelectorAll("button.files-item")].find((b) =>
      (b.textContent || "").includes(name),
    );
    btn?.click();
    return Boolean(btn);
  };
  clickNamed("README.md") || clickNamed("package.json");
});
await new Promise((r) => setTimeout(r, 2200));
await page.screenshot({ path: "docs/screenshots/agentgrid-files-monaco.png", fullPage: false });
console.log("wrote monaco with file");
await browser.close();
