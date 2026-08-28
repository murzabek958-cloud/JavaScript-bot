const puppeteer = require("puppeteer-core");
const { logError } = require("./utils");

let browser = null;

async function getBrowser() {
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
      executablePath: process.env.CHROMIUM_PATH || "/data/data/com.termux/files/usr/bin/chromium-browser",
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
  }
  return browser;
}

async function closeBrowser() {
  if (browser) { await browser.close(); browser = null; }
}

// ─── Бір HTML → скриншот ─────────────────────────────────────────────────────
async function renderSlide(htmlItem, slideIndex) {
  const html   = typeof htmlItem === "string" ? htmlItem : htmlItem.html;
  const layout = typeof htmlItem === "string" ? null     : htmlItem.layout;

  const br   = await getBrowser();
  const page = await br.newPage();

  try {
    await page.setViewport({ width: 1333, height: 750, deviceScaleFactor: 2 });

    // 1) HTML жүктеу — domcontentloaded жеткілікті (base64 network емес)
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 30000 });

    // 2) Барлық <img> суреттер толық жүктелгенше күту
    await page.evaluate(() => {
      return Promise.all(
        Array.from(document.images).map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.addEventListener("load",  resolve);
            img.addEventListener("error", resolve); // қате болса да өту
          });
        })
      );
    });

    // 3) CSS animations, background-image render үшін қысқа күту
    await new Promise((r) => setTimeout(r, 150));

    const imageBuffer = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: 1333, height: 750 },
      omitBackground: false,
    });

    console.log(`[renderer] ✅ Слайд ${slideIndex + 1} скриншот дайын`);
    return { imageBuffer, layout };

  } catch (err) {
    logError(`renderer[${slideIndex}]`, err);
    return { imageBuffer: await buildFallbackImage(page), layout: null };
  } finally {
    await page.close();
  }
}

// ─── Барлық слайдтарды рендерлеу ─────────────────────────────────────────────
async function renderAllSlides(htmlList) {
  console.log(`[renderer] ${htmlList.length} слайд рендерленуде...`);
  const results = [];
  for (let i = 0; i < htmlList.length; i++) {
    results.push(await renderSlide(htmlList[i], i));
  }
  console.log(`[renderer] ✅ Барлық слайдтар дайын`);
  return results;
}

// ─── Fallback скриншот ────────────────────────────────────────────────────────
async function buildFallbackImage(page) {
  try {
    await page.setContent(
      `<!DOCTYPE html><html><head><style>
        body{margin:0;width:1333px;height:750px;background:linear-gradient(135deg,#0D1B3E,#1B3A6B)}
      </style></head><body></body></html>`,
      { waitUntil: "domcontentloaded" }
    );
    return await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: 1333, height: 750 } });
  } catch { return Buffer.alloc(0); }
}

module.exports = { renderAllSlides, closeBrowser };
