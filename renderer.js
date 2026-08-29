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

    // 1) HTML жүктеу
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 30000 });

    // 2) CSS background-image толық жүктелгенше күту
    // (document.images тек <img> тегтерін қарайды, background-image-ді қарамайды)
    await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll("*"));
      const loads = elements.map((el) => {
        const style = window.getComputedStyle(el);
        const bg    = style.backgroundImage;
        if (!bg || bg === "none") return Promise.resolve();

        // url(...) бар ма?
        const match = bg.match(/url\(["']?(.+?)["']?\)/);
        if (!match) return Promise.resolve();

        const url = match[1];
        // base64 болса бірден ready
        if (url.startsWith("data:")) return Promise.resolve();

        // Сыртқы URL — Image арқылы күтеміз
        return new Promise((resolve) => {
          const img = new Image();
          img.onload  = resolve;
          img.onerror = resolve;
          img.src     = url;
        });
      });
      return Promise.all(loads);
    });

    // 3) Paint cycle аяқталсын деп күту (рендер дайын болу үшін)
    await new Promise((r) => setTimeout(r, 600));

      console.log(`[renderer-debug] HTML length: ${html.length}`);
      console.log(`[renderer-debug] body children: ${await page.evaluate(() => document.body.children.length)}`);
      console.log(`[renderer-debug] slide exists: ${await page.evaluate(() => !!document.querySelector(".slide"))}`);
      console.log(`[renderer-debug] bg images: ${await page.evaluate(() => document.querySelectorAll(".bg-image").length)}`);
      console.log(`[renderer-debug] body text length: ${await page.evaluate(() => document.body.innerText.length)}`);
      console.log(`[renderer-debug] slide=${slideIndex + 1} html=${html.length}`);
      console.log(`[renderer-debug] slide=${slideIndex + 1} bodyChildren=${await page.evaluate(() => document.body.children.length)}`);
      console.log(`[renderer-debug] slide=${slideIndex + 1} slideExists=${await page.evaluate(() => !!document.querySelector(".slide"))}`);
      console.log(`[renderer-debug] slide=${slideIndex + 1} slideSize=${await page.evaluate(() => { const e=document.querySelector(".slide"); if(!e)return "NONE"; const r=e.getBoundingClientRect(); return `${r.width}x${r.height}`; })}`);
      console.log(`[renderer-debug] slide=${slideIndex + 1} bgImages=${await page.evaluate(() => document.querySelectorAll(".bg-image").length)}`);
      console.log(`[renderer-debug] slide=${slideIndex + 1} bgStyle=${await page.evaluate(() => document.querySelector(".bg-image")?.style.backgroundImage?.slice(0,80) || "NONE")}`);
      console.log(`[renderer-debug] slide=${slideIndex + 1} htmlImages=${await page.evaluate(() => document.images.length)}`);
      console.log(`[renderer-debug] slide=${slideIndex + 1} bodyText=${await page.evaluate(() => document.body.innerText.length)}`);
      console.log(`[renderer-debug] slide=${slideIndex + 1} bgColor=${await page.evaluate(() => getComputedStyle(document.querySelector(".slide") || document.body).backgroundColor)}`);
      console.log(`[renderer-debug] slide=${slideIndex + 1} bodyHTML=${await page.evaluate(() => document.body.innerHTML.length)}`);
      await page.screenshot({ path: `/data/data/com.termux/files/usr/tmp/debug_slide_${slideIndex + 1}.png`, type: "png", clip: { x: 0, y: 0, width: 1333, height: 750 } });
      console.log(`[renderer-debug] DEBUG PNG saved: /data/data/com.termux/files/usr/tmp/debug_slide_${slideIndex + 1}.png`);
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
