const { GoogleGenerativeAI } = require("@google/generative-ai");
const { logError } = require("./utils");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─── Мәтін позициясына сай placeholder координаттары ─────────────────────────
function getZonesByPosition(position, type) {
  const zones = {
    left: {
      title:   { x: 50,  y: 120, w: 580, h: 130 },
      content: { x: 50,  y: 270, w: 580, h: 380 },
      subtitle:{ x: 50,  y: 260, w: 580, h: 80  },
    },
    right: {
      title:   { x: 700, y: 120, w: 580, h: 130 },
      content: { x: 700, y: 270, w: 580, h: 380 },
      subtitle:{ x: 700, y: 260, w: 580, h: 80  },
    },
    center: {
      title:   { x: 80,  y: 150, w: 1173, h: 150 },
      content: { x: 100, y: 320, w: 1133, h: 350 },
      subtitle:{ x: 80,  y: 310, w: 1173, h: 90  },
    },
  };
  return zones[position] || zones.left;
}

// ─── Placeholder HTML жасау ───────────────────────────────────────────────────
function buildPlaceholders(zones, type) {
  const fields = type === "title"
    ? ["title", "subtitle"]
    : type === "end"
    ? ["title", "subtitle"]
    : ["title", "content"];

  return fields.map((field) => {
    const z = zones[field];
    if (!z) return "";
    return `
  <div
    data-zone="${field}"
    data-x="${z.x}"
    data-y="${z.y}"
    data-w="${z.w}"
    data-h="${z.h}"
    style="
      position: absolute;
      left: ${z.x}px;
      top: ${z.y}px;
      width: ${z.w}px;
      height: ${z.h}px;
      opacity: 0;
      pointer-events: none;
    "
  ></div>`;
  }).join("\n");
}

// ─── Бір слайдқа HTML фон генерациялау ───────────────────────────────────────
async function generateSlideHTML(slide) {
  const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

  const zones = getZonesByPosition(slide.text_position || "left", slide.type);
  const placeholders = buildPlaceholders(zones, slide.type);

  const prompt = `
You are an expert HTML/CSS designer creating a stunning presentation slide background.

Slide info:
- Type: ${slide.type}
- Style: ${slide.style_hint}
- Mood: ${slide.mood}
- Text position: ${slide.text_position} (text will appear on this side, keep it CLEAR and DARK/READABLE)

CRITICAL RULES:
1. Canvas size: exactly 1333px × 750px
2. NO text content — only visual background elements
3. The ${slide.text_position} area must have sufficient contrast for white text
4. Use CSS only — no external images, no JS
5. Be creative: gradients, shapes, pseudo-elements, clip-path, patterns
6. Each slide must look UNIQUE and PROFESSIONAL
7. Return ONLY the complete HTML, nothing else

The area where text will appear:
${slide.text_position === "left"  ? "LEFT side (x: 0-650px) — keep dark/readable" : ""}
${slide.text_position === "right" ? "RIGHT side (x: 680-1333px) — keep dark/readable" : ""}
${slide.text_position === "center" ? "CENTER area — use dark overlay across full width" : ""}

Return this exact structure with your CSS inside:

<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { width: 1333px; height: 750px; overflow: hidden; }
.slide {
  width: 1333px;
  height: 750px;
  position: relative;
  overflow: hidden;
  /* YOUR BACKGROUND CSS HERE */
}
/* YOUR ADDITIONAL CSS HERE */
</style>
</head>
<body>
<div class="slide">
  <!-- YOUR VISUAL ELEMENTS HERE (shapes, decorations, NO TEXT) -->
${placeholders}
</div>
</body>
</html>
`;

  try {
    const result = await model.generateContent(prompt);
    const html = result.response.text();

    // HTML тазалау — markdown блоктарын алу
    const htmlMatch = html.match(/<!DOCTYPE[\s\S]*<\/html>/i);
    if (htmlMatch) return htmlMatch[0];

    // Тікелей HTML болса
    if (html.includes("<html")) return html;

    throw new Error("HTML форматы дұрыс емес");

  } catch (err) {
    logError(`htmlGen[${slide.index}]`, err);
    // Fallback — қарапайым gradient фон
    return buildFallbackHTML(slide, placeholders);
  }
}

// ─── Fallback HTML — Gemini сәтсіз болса ─────────────────────────────────────
function buildFallbackHTML(slide, placeholders) {
  const gradients = [
    "linear-gradient(135deg, #0D1B2A 0%, #1B4965 50%, #5FA8D3 100%)",
    "linear-gradient(135deg, #10002B 0%, #3C096C 50%, #9D4EDD 100%)",
    "linear-gradient(135deg, #1A0A00 0%, #6B2D0E 50%, #E85D04 100%)",
    "linear-gradient(135deg, #003333 0%, #005F5F 50%, #00A896 100%)",
    "linear-gradient(135deg, #0A0A0A 0%, #1C1C1C 60%, #F5A623 100%)",
  ];

  const gradient = gradients[slide.index % gradients.length];

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { width: 1333px; height: 750px; overflow: hidden; }
.slide {
  width: 1333px; height: 750px;
  position: relative; overflow: hidden;
  background: ${gradient};
}
.circle-1 {
  position: absolute;
  width: 600px; height: 600px;
  border-radius: 50%;
  background: rgba(255,255,255,0.05);
  top: -150px; right: -100px;
}
.circle-2 {
  position: absolute;
  width: 350px; height: 350px;
  border-radius: 50%;
  background: rgba(255,255,255,0.04);
  bottom: -80px; left: -80px;
}
.line {
  position: absolute;
  width: 2px; height: 100%;
  background: rgba(255,255,255,0.08);
  left: ${slide.text_position === "right" ? "660px" : "650px"};
}
</style>
</head>
<body>
<div class="slide">
  <div class="circle-1"></div>
  <div class="circle-2"></div>
  <div class="line"></div>
${placeholders}
</div>
</body>
</html>`;
}

// ─── Барлық слайдтарға HTML генерациялау (параллель) ─────────────────────────
async function generateAllHTML(slides) {
  console.log(`[htmlGen] ${slides.length} слайдқа HTML жасалуда...`);

  const results = await Promise.all(
    slides.map((slide) => generateSlideHTML(slide))
  );

  console.log(`[htmlGen] ✅ ${results.length} HTML дайын`);
  return results;
}

module.exports = {
  generateAllHTML,
  generateSlideHTML,
};
