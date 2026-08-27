const puppeteer = require("puppeteer-core");
const { zoneToInches, logError } = require("./utils");

let browser = null;

// ─── Браузерді бір рет іске қосу ─────────────────────────────────────────────
async function getBrowser() {
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
    executablePath: process.env.CHROMIUM_PATH || "/data/data/com.termux/files/usr/bin/chromium-browser",
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });
  }
  return browser;
}

// ─── Браузерді жабу ───────────────────────────────────────────────────────────
async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

// ─── Бір HTML → скриншот + координаттар ──────────────────────────────────────
async function renderSlide(html, slideIndex) {
  const br = await getBrowser();
  const page = await br.newPage();

  try {
    // Слайд өлшемі: 1333×750px (16:9), Retina сапа
    await page.setViewport({
      width: 1333,
      height: 750,
      deviceScaleFactor: 2,
    });

    await page.setContent(html, { waitUntil: "networkidle0" });

    // ── Скриншот алу ────────────────────────────────────────────────────────
    const imageBuffer = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: 1333, height: 750 },
      omitBackground: false,
    });

    // ── data-zone элементтерінен координаттарды алу ──────────────────────────
    const rawZones = await page.evaluate(() => {
      const zones = {};
      document.querySelectorAll("[data-zone]").forEach((el) => {
        const name = el.getAttribute("data-zone");
        zones[name] = {
          x: parseInt(el.getAttribute("data-x") || "0"),
          y: parseInt(el.getAttribute("data-y") || "0"),
          w: parseInt(el.getAttribute("data-w") || "500"),
          h: parseInt(el.getAttribute("data-h") || "200"),
        };
      });
      return zones;
    });

    // ── px → PPTX inches конвертация ─────────────────────────────────────────
    const zones = {};
    for (const [key, val] of Object.entries(rawZones)) {
      zones[key] = zoneToInches(val);
    }

    console.log(`[renderer] ✅ Слайд ${slideIndex + 1} скриншот дайын`);
    return { imageBuffer, zones };

  } catch (err) {
    logError(`renderer[${slideIndex}]`, err);
    // Fallback — бос қара фон
    return {
      imageBuffer: await buildFallbackImage(page),
      zones: getDefaultZones(),
    };
  } finally {
    await page.close();
  }
}

// ─── Барлық слайдтарды рендерлеу ─────────────────────────────────────────────
async function renderAllSlides(htmlList) {
  console.log(`[renderer] ${htmlList.length} слайд рендерленуде...`);

  const results = [];
  for (let i = 0; i < htmlList.length; i++) {
    const result = await renderSlide(htmlList[i], i);
    results.push(result);
  }

  console.log(`[renderer] ✅ Барлық слайдтар дайын`);
  return results;
}

// ─── Fallback сурет — рендер сәтсіз болса ────────────────────────────────────
async function buildFallbackImage(page) {
  try {
    await page.setContent(`
      <!DOCTYPE html><html><head><style>
      body { margin:0; width:1333px; height:750px;
             background: linear-gradient(135deg, #0D1B2A, #1B4965); }
      </style></head><body></body></html>
    `, { waitUntil: "domcontentloaded" });

    return await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: 1333, height: 750 },
    });
  } catch {
    return Buffer.alloc(0);
  }
}

// ─── Әдепкі координаттар — zones алынбаса ────────────────────────────────────
function getDefaultZones() {
  return {
    title: {
      x: zoneToInches({ x: 50,  y: 120, w: 580, h: 130 }).x,
      y: zoneToInches({ x: 50,  y: 120, w: 580, h: 130 }).y,
      w: zoneToInches({ x: 50,  y: 120, w: 580, h: 130 }).w,
      h: zoneToInches({ x: 50,  y: 120, w: 580, h: 130 }).h,
    },
    content: {
      x: zoneToInches({ x: 50,  y: 270, w: 580, h: 380 }).x,
      y: zoneToInches({ x: 50,  y: 270, w: 580, h: 380 }).y,
      w: zoneToInches({ x: 50,  y: 270, w: 580, h: 380 }).w,
      h: zoneToInches({ x: 50,  y: 270, w: 580, h: 380 }).h,
    },
  };
}

module.exports = {
  renderAllSlides,
  closeBrowser,
};
