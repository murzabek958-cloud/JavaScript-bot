const { GoogleGenerativeAI } = require("@google/generative-ai");
const { logError }           = require("./utils");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY || null;

// ─── Есенов логосы — base64 (төменгі сол бұрыш) ─────────────────────────────
const YESSENOV_LOGO_B64 = "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";

function logoHTML() {
  return (
    `<div style="position:absolute;bottom:16px;left:20px;display:flex;align-items:center;` +
    `gap:9px;z-index:999;">` +
    `<img src="data:image/jpeg;base64,${YESSENOV_LOGO_B64}" ` +
    `style="width:36px;height:36px;border-radius:5px;object-fit:contain;` +
    `filter:drop-shadow(0 1px 4px rgba(0,0,0,0.6));opacity:0.93;"/>` +
    `<span style="color:rgba(255,255,255,0.82);font-size:10.5px;` +
    `font-family:Calibri,Arial,sans-serif;font-weight:600;` +
    `letter-spacing:0.4px;line-height:1.25;` +
    `text-shadow:0 1px 3px rgba(0,0,0,0.8);">Yessenov<br>University</span>` +
    `</div>`
  );
}

// ─── px → inches ─────────────────────────────────────────────────────────────
function pxToInch(px, axis) {
  return axis === "x" ? +(px / 133.3).toFixed(3) : +(px / 133.4).toFixed(3);
}

function convertLayout(layout) {
  if (!layout) return null;
  const out = {};
  for (const [zone, c] of Object.entries(layout)) {
    out[zone] = {
      x: pxToInch(c.x, "x"), y: pxToInch(c.y, "y"),
      w: pxToInch(c.w, "x"), h: pxToInch(c.h, "y"),
    };
  }
  return out;
}

// ─── Placeholder div ─────────────────────────────────────────────────────────
function buildPlaceholders(layout, type) {
  if (!layout) return "";
  const fields = (type === "title" || type === "end")
    ? ["title", "subtitle"] : ["title", "content"];
  return fields.filter((f) => layout[f]).map((f) => {
    const { x, y, w, h } = layout[f];
    const px = (v, a) => Math.round(v * (a === "x" ? 133.3 : 133.4));
    return `<div data-zone="${f}" style="position:absolute;left:${px(x,"x")}px;` +
      `top:${px(y,"y")}px;width:${px(w,"x")}px;height:${px(h,"y")}px;opacity:0"></div>`;
  }).join("");
}

// ─── Unsplash-тан сурет жүктеу → base64 ─────────────────────────────────────
async function fetchImageBase64(query) {
  if (!UNSPLASH_KEY) return null;
  try {
    const fetch = (await import("node-fetch")).default;
    const searchRes = await fetch(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&content_filter=high`,
      { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` }, timeout: 8000 }
    );
    if (!searchRes.ok) return null;
    const photo  = await searchRes.json();
    const imgUrl = photo?.urls?.regular;
    if (!imgUrl) return null;
    const imgRes = await fetch(imgUrl, { timeout: 15000 });
    if (!imgRes.ok) return null;
    const buffer   = await imgRes.buffer();
    const base64   = buffer.toString("base64");
    const mimeType = imgRes.headers.get("content-type") || "image/jpeg";
    console.log(`[htmlGen] 📷 Сурет жүктелді: "${query}"`);
    return `data:${mimeType};base64,${base64}`;
  } catch (err) {
    logError(`fetchImage:${query}`, err);
    return null;
  }
}

// ─── Style hint → Unsplash query ─────────────────────────────────────────────
function styleToQuery(styleHint, mood) {
  const hint = (styleHint + " " + mood).toLowerCase();
  if (hint.includes("histor") || hint.includes("тарих") || hint.includes("ancient"))
    return "ancient manuscript history texture";
  if (hint.includes("nature") || hint.includes("landscape") || hint.includes("дала"))
    return "steppe landscape nature dramatic";
  if (hint.includes("science") || hint.includes("ғылым") || hint.includes("tech"))
    return "science laboratory abstract";
  if (hint.includes("dark") || hint.includes("cinematic") || hint.includes("қара"))
    return "dark cinematic dramatic background";
  if (hint.includes("minimal") || hint.includes("clean"))
    return "minimal abstract texture elegant";
  if (hint.includes("gold") || hint.includes("алтын") || hint.includes("luxury"))
    return "gold luxury ornament texture dark";
  if (hint.includes("poet") || hint.includes("поэз") || hint.includes("literary"))
    return "old book manuscript poetry vintage";
  if (hint.includes("war") || hint.includes("соғыс") || hint.includes("battle"))
    return "dramatic sky dark moody landscape";
  return "dark academic texture elegant background";
}

// ─── Барлық слайдтарға HTML ───────────────────────────────────────────────────
async function generateAllHTML(slides) {
  console.log(`[htmlGen] ${slides.length} слайдқа HTML — 1 API call...`);

  const model = genAI.getGenerativeModel({
    model: "gemini-3.5-flash-lite",
    generationConfig: { responseMimeType: "application/json" },
  });

  const slideList = slides.map((s) =>
    `{"index":${s.index},"type":"${s.type}","style":"${s.style_hint}","mood":"${s.mood}"}`
  ).join(",\n");

  const CSS_TECHNIQUES = `
/* 1. Diagonal panel (left dark zone) */
.panel { position:absolute;top:0;left:0;width:580px;height:100%;background:rgba(8,15,40,0.88);clip-path:polygon(0 0,100% 0,82% 100%,0 100%); }
/* 2. Gradient band at bottom */
.band { position:absolute;bottom:0;left:0;width:100%;height:240px;background:linear-gradient(to top,rgba(5,10,30,0.95) 0%,transparent 100%); }
/* 3. Vertical side panel (right) */
.side { position:absolute;right:0;top:0;width:440px;height:100%;background:rgba(8,15,40,0.85);border-left:3px solid rgba(201,168,76,0.4); }
/* 4. Top header band */
.header-band { position:absolute;top:0;left:0;width:100%;height:200px;background:rgba(5,10,30,0.90); }
/* 5. Accent shapes */
.accent-line { position:absolute;width:3px;height:120px;background:#C9A84C; }
.diamond { position:absolute;width:100px;height:100px;border:2px solid rgba(201,168,76,0.65);transform:rotate(45deg); }
.dot-row { position:absolute;background-image:radial-gradient(circle,rgba(201,168,76,0.5) 2px,transparent 2px);background-size:18px 18px; }
/* 6. Corner frames */
.corner-tl { position:absolute;top:20px;left:20px;width:80px;height:80px;border-top:2px solid rgba(201,168,76,0.6);border-left:2px solid rgba(201,168,76,0.6); }
.corner-br { position:absolute;bottom:20px;right:20px;width:80px;height:80px;border-bottom:2px solid rgba(201,168,76,0.6);border-right:2px solid rgba(201,168,76,0.6); }
/* 7. Vignette */
.vignette { position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 25%,rgba(0,0,0,0.80) 100%); }
/* 8. Grid texture */
.grid-tex { position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px);background-size:60px 60px; }
/* 9. Diagonal stripe */
.stripe { position:absolute;top:0;width:5px;height:100%;background:rgba(201,168,76,0.35);transform:skewX(-8deg); }
/* 10. Centered dark box */
.center-box { position:absolute;background:rgba(5,10,30,0.88);border:1px solid rgba(201,168,76,0.3); }
`;

  const prompt =
    "You are a senior CSS designer. Generate unique slide backgrounds using ONLY the CSS classes below.\n" +
    "Canvas: 1333x750px. A real Unsplash photo will be injected into .bg-image via inline style.\n\n" +
    "CSS TOOLKIT (copy class names exactly, customize values freely):\n" +
    CSS_TECHNIQUES + "\n\n" +
    "COMPOSITION RULES:\n" +
    "- Pick 3-6 classes per slide, combine them in a UNIQUE way\n" +
    "- Vary which side the text goes: left panel, right panel, bottom band, top header, center box\n" +
    "- layout coordinates MUST match the actual dark zone where text will appear\n" +
    "- Text zone overlay must be rgba >= 0.80 for white text readability\n" +
    "- .bg-image: position:absolute;inset:0;width:100%;height:100%;background-size:cover;z-index:0\n" +
    "- All other divs: z-index:1 or higher\n" +
    "- NO two slides with same composition\n\n" +
    "Slides:\n[" + slideList + "]\n\n" +
    "Return JSON array, exactly " + slides.length + " objects:\n" +
    '[{"index":0,"image_query":"3-5 English words Unsplash",' +
    '"css":"/* override/extend classes with exact positions, sizes, colors */",' +
    '"elements":"<div class=\'bg-image\'></div><div class=\'panel\'></div><div class=\'accent-line\' style=\'top:90px;left:55px\'></div>",' +
    '"layout":{"title":{"x":70,"y":90,"w":510,"h":140},"subtitle":{"x":70,"y":240,"w":490,"h":80},"content":{"x":70,"y":300,"w":500,"h":370}}}]';

  try {
    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(result.response.text().trim());

    if (!Array.isArray(parsed) || parsed.length === 0)
      throw new Error("Жарамсыз JSON");

    console.log(`[htmlGen] 📷 Суреттер жүктелуде...`);
    const imageMap = {};
    await Promise.all(parsed.map(async (item) => {
      const slide = slides[item.index];
      const query = slide?.image_query || item.image_query ||
        styleToQuery(slide?.style_hint || "", slide?.mood || "");
      imageMap[item.index] = await fetchImageBase64(query);
    }));

    const htmlList = slides.map((slide) => {
      const item = parsed.find((p) => p.index === slide.index);
      if (!item || !item.css) {
        console.warn(`[htmlGen] Слайд ${slide.index} — fallback`);
        return { html: buildFallbackHTML(slide, imageMap[slide.index]), layout: null };
      }
      const layout = convertLayout(item.layout);
      const ph     = buildPlaceholders(item.layout, slide.type);
      let elements = item.elements || "";
      const b64    = imageMap[slide.index];
      if (b64) {
        elements = elements.replace(
          /class="bg-image"([^>]*)>/,
          `class="bg-image"$1 style="background-image:url('${b64}');background-size:cover;background-position:center">`
        );
      }
      return { html: buildHTML(item.css, elements, ph), layout };
    });

    console.log(`[htmlGen] ✅ ${htmlList.length} HTML дайын`);
    return htmlList;

  } catch (err) {
    logError("generateAllHTML:batch", err);
    console.warn("[htmlGen] Batch сәтсіз, жекелеп...");
    return generateAllHTMLFallback(slides);
  }
}

// ─── HTML құрастыру (лого автоматты) ─────────────────────────────────────────
function buildHTML(css, elements, placeholders) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>` +
    `*{margin:0;padding:0;box-sizing:border-box}` +
    `body{width:1333px;height:750px;overflow:hidden}` +
    `.slide{width:1333px;height:750px;position:relative;overflow:hidden}` +
    `${css}</style></head><body>` +
    `<div class="slide">${elements}${placeholders}${logoHTML()}</div>` +
    `</body></html>`;
}

// ─── Fallback: жекелеп жасау ─────────────────────────────────────────────────
async function generateAllHTMLFallback(slides) {
  const CONCURRENCY = 3;
  const results     = new Array(slides.length);
  for (let i = 0; i < slides.length; i += CONCURRENCY) {
    const batch = slides.slice(i, i + CONCURRENCY);
    const done  = await Promise.all(batch.map((s) => generateSlideHTMLSingle(s)));
    done.forEach((item, j) => { results[i + j] = item; });
  }
  return results;
}

async function generateSlideHTMLSingle(slide) {
  const model = genAI.getGenerativeModel({
    model: "gemini-3.5-flash-lite",
    generationConfig: { responseMimeType: "application/json" },
  });

  const prompt =
    `Dramatic presentation slide background. 1333x750px. CSS only.\n` +
    `Style:"${slide.style_hint}" Mood:"${slide.mood}"\n` +
    `Include .bg-image div for photo. Dark overlay for text readability.\n` +
    `Return ONE JSON: {"image_query":"...","css":"...","elements":"...","layout":` +
    `{"title":{"x":60,"y":80,"w":700,"h":150},"subtitle":{"x":60,"y":240,"w":650,"h":90},` +
    `"content":{"x":60,"y":290,"w":680,"h":380}}}`;

  try {
    const item   = JSON.parse((await model.generateContent(prompt)).response.text().trim());
    const b64    = await fetchImageBase64(slide.image_query || item.image_query || styleToQuery(slide.style_hint, slide.mood));
    let elements = item.elements || "";
    if (b64) {
      elements = elements.replace(
        /class="bg-image"([^>]*)>/,
        `class="bg-image"$1 style="background-image:url('${b64}');background-size:cover;background-position:center">`
      );
    }
    const layout = convertLayout(item.layout);
    const ph     = buildPlaceholders(item.layout, slide.type);
    return { html: buildHTML(item.css || "", elements, ph), layout };
  } catch (err) {
    logError(`htmlGen[${slide.index}]`, err);
    return { html: buildFallbackHTML(slide, null), layout: null };
  }
}

// ─── Fallback HTML (лого қосылды) ────────────────────────────────────────────
const ACADEMIC_GRADIENTS = [
  "linear-gradient(135deg,#0D1B3E,#1B3A6B)",
  "linear-gradient(135deg,#1A0A0A,#5C1A1A)",
  "linear-gradient(135deg,#0A1A0A,#1A4A1A)",
  "linear-gradient(135deg,#1A1A2E,#2D2D44)",
  "linear-gradient(135deg,#0D1B2A,#1B3A4B)",
];

function buildFallbackHTML(slide, imageBase64) {
  const g  = ACADEMIC_GRADIENTS[slide.index % ACADEMIC_GRADIENTS.length];
  const bg = imageBase64
    ? `background-image:url('${imageBase64}');background-size:cover;background-position:center`
    : `background:${g}`;

  const defaultLayout = {
    title:    { x: 60, y: 80,  w: 800, h: 150 },
    subtitle: { x: 60, y: 240, w: 700, h: 90  },
    content:  { x: 60, y: 290, w: 750, h: 370 },
  };
  const ph = buildPlaceholders(defaultLayout, slide.type);

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>` +
    `*{margin:0;padding:0;box-sizing:border-box}` +
    `body{width:1333px;height:750px;overflow:hidden}` +
    `.slide{width:1333px;height:750px;position:relative;overflow:hidden;${bg}}` +
    `.overlay{position:absolute;inset:0;background:rgba(0,0,0,.55)}` +
    `.corner{position:absolute;width:100px;height:100px;` +
    `border-top:2px solid rgba(201,168,76,.6);border-left:2px solid rgba(201,168,76,.6);top:25px;left:25px}` +
    `.corner2{position:absolute;width:100px;height:100px;` +
    `border-bottom:2px solid rgba(201,168,76,.6);border-right:2px solid rgba(201,168,76,.6);bottom:25px;right:25px}` +
    `.accent{position:absolute;width:3px;height:60%;background:rgba(201,168,76,.5);left:45px;top:20%}` +
    `</style></head><body>` +
    `<div class="slide"><div class="overlay"></div>` +
    `<div class="corner"></div><div class="corner2"></div><div class="accent"></div>` +
    `${ph}${logoHTML()}` +
    `</div></body></html>`;
}

module.exports = { generateAllHTML };
