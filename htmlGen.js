const { GoogleGenerativeAI } = require("@google/generative-ai");
const { logError } = require("./utils");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─── Zone координаттары ───────────────────────────────────────────────────────
const ZONES = {
  left:   { title:{x:50,y:120,w:580,h:130}, content:{x:50,y:270,w:580,h:380},  subtitle:{x:50,y:260,w:580,h:80}   },
  right:  { title:{x:700,y:120,w:580,h:130},content:{x:700,y:270,w:580,h:380}, subtitle:{x:700,y:260,w:580,h:80}  },
  center: { title:{x:80,y:150,w:1173,h:150},content:{x:100,y:320,w:1133,h:350},subtitle:{x:80,y:310,w:1173,h:90}  },
};

function buildPlaceholders(pos, type) {
  const z      = ZONES[pos] || ZONES.left;
  const fields = (type === "title" || type === "end") ? ["title","subtitle"] : ["title","content"];
  return fields
    .filter((f) => z[f])
    .map((f) => {
      const { x, y, w, h } = z[f];
      return `<div data-zone="${f}" data-x="${x}" data-y="${y}" data-w="${w}" data-h="${h}" ` +
             `style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;opacity:0"></div>`;
    })
    .join("");
}

// ─── Барлық слайдтарға HTML — 1 API сұраныс ──────────────────────────────────
async function generateAllHTML(slides) {
  console.log(`[htmlGen] ${slides.length} слайдқа HTML — 1 API call...`);

  const model = genAI.getGenerativeModel({
    model: "gemini-3.6-flash",
    generationConfig: { maxOutputTokens: 800 * slides.length },
  });

  // Слайд тізімін compact форматта беру
  const slideList = slides
    .map((s) =>
      `SLIDE_${s.index}|type:${s.type}|pos:${s.text_position}|` +
      `style:"${s.style_hint}"|mood:"${s.mood}"`
    )
    .join("\n");

  const prompt =
    `Generate HTML/CSS backgrounds for ${slides.length} presentation slides.\n` +
    `Each: 1333×750px, CSS only, no text, no external images.\n` +
    `Keep text zone dark for white text: left→x:0-650, right→x:680-1333, center→full.\n\n` +
    `Slides:\n${slideList}\n\n` +
    `Output EXACTLY ${slides.length} blocks separated by "---SLIDE_N---" marker:\n\n` +
    `---SLIDE_0---\n` +
    `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>` +
    `*{margin:0;padding:0;box-sizing:border-box}` +
    `body{width:1333px;height:750px;overflow:hidden}` +
    `.slide{width:1333px;height:750px;position:relative;overflow:hidden;[CSS HERE]}` +
    `</style></head><body><div class="slide">[ELEMENTS][PLACEHOLDERS_0]</div></body></html>\n` +
    `---SLIDE_1---\n` +
    `...and so on for each slide. Make each design UNIQUE.`;

  try {
    const result = await model.generateContent(prompt);
    const raw    = result.response.text();

    // Маркер бойынша бөлу
    const htmlList = parseMultiHTML(raw, slides);

    console.log(`[htmlGen] ✅ ${htmlList.length} HTML дайын (1 API call)`);
    return htmlList;

  } catch (err) {
    logError("generateAllHTML", err);
    // Fallback: жекелеп жасау
    console.warn("[htmlGen] Batch сәтсіз, жекелеп жасалуда...");
    return generateAllHTMLFallback(slides);
  }
}

// ─── Batch response-ті бөлу ───────────────────────────────────────────────────
function parseMultiHTML(raw, slides) {
  const results = [];

  for (let i = 0; i < slides.length; i++) {
    const slide      = slides[i];
    const markerCurr = `---SLIDE_${i}---`;
    const markerNext = `---SLIDE_${i + 1}---`;

    const start = raw.indexOf(markerCurr);
    const end   = i + 1 < slides.length ? raw.indexOf(markerNext) : raw.length;

    if (start === -1) {
      // Маркер табылмаса — fallback
      results.push(buildFallbackHTML(slide));
      continue;
    }

    const chunk    = raw.slice(start + markerCurr.length, end === -1 ? undefined : end).trim();
    const htmlMatch = chunk.match(/<!DOCTYPE[\s\S]*?<\/html>/i);

    if (htmlMatch) {
      // Placeholder-ларды енгізу
      const placeholders = buildPlaceholders(slide.text_position, slide.type);
      results.push(htmlMatch[0].replace("[PLACEHOLDERS_" + i + "]", placeholders)
                                .replace(/\[PLACEHOLDERS_\d+\]/, placeholders));
    } else {
      results.push(buildFallbackHTML(slide));
    }
  }

  return results;
}

// ─── Fallback: жекелеп жасау (batch сәтсіз болса) ────────────────────────────
async function generateAllHTMLFallback(slides) {
  const CONCURRENCY = 3;
  const results     = new Array(slides.length);

  for (let i = 0; i < slides.length; i += CONCURRENCY) {
    const batch = slides.slice(i, i + CONCURRENCY);
    const done  = await Promise.all(batch.map((s) => generateSlideHTMLSingle(s)));
    done.forEach((html, j) => { results[i + j] = html; });
  }
  return results;
}

// ─── Бір слайд (fallback үшін) ────────────────────────────────────────────────
async function generateSlideHTMLSingle(slide) {
  const model = genAI.getGenerativeModel({
    model: "gemini-3.6-flash",
    generationConfig: { maxOutputTokens: 800 },
  });

  const pos          = slide.text_position || "left";
  const placeholders = buildPlaceholders(pos, slide.type);
  const zoneHint     = pos === "center" ? "full width dark overlay"
                     : pos === "right"  ? "x:680-1333 dark"
                     :                    "x:0-650 dark";

  const prompt =
    `HTML/CSS slide bg. 1333×750px. CSS only, no text.\n` +
    `Style:"${slide.style_hint}" Mood:"${slide.mood}" TextZone:${zoneHint}\n` +
    `Output ONLY HTML:\n` +
    `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>` +
    `*{margin:0;padding:0;box-sizing:border-box}` +
    `body{width:1333px;height:750px;overflow:hidden}` +
    `.slide{width:1333px;height:750px;position:relative;overflow:hidden;[YOUR CSS]}` +
    `</style></head><body><div class="slide">[ELEMENTS]${placeholders}</div></body></html>`;

  try {
    const result   = await model.generateContent(prompt);
    const raw      = result.response.text().trim();
    const htmlMatch = raw.match(/<!DOCTYPE[\s\S]*<\/html>/i);
    return htmlMatch ? htmlMatch[0] : buildFallbackHTML(slide);
  } catch (err) {
    logError(`htmlGen[${slide.index}]`, err);
    return buildFallbackHTML(slide);
  }
}

// ─── Fallback HTML ────────────────────────────────────────────────────────────
const GRADIENTS = [
  "linear-gradient(135deg,#0D1B2A,#1B4965,#5FA8D3)",
  "linear-gradient(135deg,#10002B,#3C096C,#9D4EDD)",
  "linear-gradient(135deg,#1A0A00,#6B2D0E,#E85D04)",
  "linear-gradient(135deg,#003333,#005F5F,#00A896)",
  "linear-gradient(135deg,#0A0A0A,#1C1C1C,#F5A623)",
];

function buildFallbackHTML(slide) {
  const g    = GRADIENTS[slide.index % GRADIENTS.length];
  const divX = slide.text_position === "right" ? "660px" : "650px";
  const ph   = buildPlaceholders(slide.text_position || "left", slide.type);

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>` +
    `*{margin:0;padding:0;box-sizing:border-box}` +
    `body{width:1333px;height:750px;overflow:hidden}` +
    `.slide{width:1333px;height:750px;position:relative;overflow:hidden;background:${g}}` +
    `.c1{position:absolute;width:600px;height:600px;border-radius:50%;` +
         `background:rgba(255,255,255,.05);top:-150px;right:-100px}` +
    `.c2{position:absolute;width:350px;height:350px;border-radius:50%;` +
         `background:rgba(255,255,255,.04);bottom:-80px;left:-80px}` +
    `.ln{position:absolute;width:2px;height:100%;background:rgba(255,255,255,.08);left:${divX}}` +
    `</style></head><body>` +
    `<div class="slide"><div class="c1"></div><div class="c2"></div>` +
    `<div class="ln"></div>${ph}</div></body></html>`;
}

module.exports = { generateAllHTML };
