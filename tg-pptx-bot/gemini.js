const { GoogleGenerativeAI } = require("@google/generative-ai");
const { LAYOUTS, COLOR_PALETTES } = require("./layouts");
const { getLanguageName, logError } = require("./utils");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─── Қолжетімді макеттер тізімі (промпт үшін) ────────────────────────────────
const TITLE_LAYOUTS = LAYOUTS.title_layouts.join(", ");
const CONTENT_LAYOUTS = LAYOUTS.content_layouts.join(", ");
const END_LAYOUTS = LAYOUTS.end_layouts.join(", ");
const PALETTE_NAMES = COLOR_PALETTES.map((p) => p.name).join(", ");

// ─── Негізгі контент + композиция генерациясы ────────────────────────────────
async function generatePresentation(topic, slideCount, lang) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const langName = getLanguageName(lang);

  const prompt = `
You are a world-class presentation designer AND content writer.
Topic: "${topic}"
Language: ${langName} — write ALL text content in this language ONLY.
Total slides: ${slideCount}

Your job: create a UNIQUE, VISUALLY STUNNING presentation plan.
Every presentation must feel different — vary layouts, compositions, and visual approaches.

AVAILABLE TITLE LAYOUTS: ${TITLE_LAYOUTS}
AVAILABLE CONTENT LAYOUTS: ${CONTENT_LAYOUTS}
AVAILABLE END LAYOUTS: ${END_LAYOUTS}
AVAILABLE COLOR PALETTES: ${PALETTE_NAMES}

RULES:
1. Choose ONE color palette that fits the topic's mood
2. First slide: type "title", choose from title_layouts
3. Last slide: type "end", choose from end_layouts
4. Middle slides: type "content", MIX different layouts — never repeat same layout twice in a row
5. For slides with hasImage=true layouts, write a vivid English image_prompt (50-80 words, cinematic, detailed)
6. Content bullets: 3-5 points, concise, impactful
7. Vary slide purposes: some conceptual, some data-driven, some storytelling, some visual-heavy
8. Make it feel like a professional human designer made it

Return ONLY valid JSON, no markdown, no extra text:

{
  "presentation_title": "...",
  "subtitle": "...",
  "palette": "palette_name_here",
  "slides": [
    {
      "type": "title",
      "layout": "title_left_visual",
      "title": "...",
      "subtitle": "...",
      "image_prompt": "cinematic wide shot of ... ultra detailed, professional photography"
    },
    {
      "type": "content",
      "layout": "image_left_text_right",
      "title": "...",
      "content": ["point 1", "point 2", "point 3"],
      "speaker_notes": "...",
      "image_prompt": "detailed English prompt for this slide's image"
    },
    {
      "type": "content",
      "layout": "text_only_bold",
      "title": "...",
      "content": ["point 1", "point 2", "point 3", "point 4"],
      "speaker_notes": "..."
    },
    {
      "type": "end",
      "layout": "thankyou_centered",
      "title": "...",
      "subtitle": "..."
    }
  ]
}

Note: Only include "image_prompt" for slides that use image-based layouts.
text_only_bold, grid_2x2, big_quote, icon_grid, title_centered, title_diagonal do NOT need image_prompt.
`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  // JSON парсинг — мөлдір блоктарды тазалау
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Gemini JSON форматта жауап бермеді");

  const data = JSON.parse(jsonMatch[0]);
  validatePresentation(data, slideCount);
  return data;
}

// ─── Валидация: жетіспеген өрістерді толтыру ─────────────────────────────────
function validatePresentation(data, slideCount) {
  if (!data.presentation_title) data.presentation_title = "Презентация";
  if (!data.subtitle) data.subtitle = "";
  if (!data.palette) data.palette = "ocean_depth";
  if (!Array.isArray(data.slides) || data.slides.length === 0) {
    throw new Error("Слайдтар жоқ");
  }

  // Әр слайдтың міндетті өрістерін тексеру
  data.slides = data.slides.map((slide, i) => {
    if (!slide.type) slide.type = "content";
    if (!slide.title) slide.title = `Слайд ${i + 1}`;
    if (!slide.layout) {
      slide.layout = slide.type === "title"
        ? "title_centered"
        : slide.type === "end"
        ? "thankyou_centered"
        : "text_only_bold";
    }
    if (!slide.content) slide.content = [];
    return slide;
  });
}

// ─── Жеке сурет промпты генерациялау (қажет болса) ───────────────────────────
async function generateImagePrompt(slideTitle, topic, palette) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(
      `Write a vivid, cinematic image generation prompt (50-70 words) for a presentation slide.
Slide title: "${slideTitle}"
Presentation topic: "${topic}"
Color mood: ${palette}
Return ONLY the prompt text, nothing else.`
    );
    return result.response.text().trim();
  } catch (err) {
    logError("generateImagePrompt", err);
    return null;
  }
}

module.exports = {
  generatePresentation,
  generateImagePrompt,
};
