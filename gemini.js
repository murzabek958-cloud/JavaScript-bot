const { GoogleGenerativeAI } = require("@google/generative-ai");
const { getLanguageName, logError, clampSlideCount } = require("./utils");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─── 1-ҚАДАМ: Еркін хабарламаны парсинг ──────────────────────────────────────
async function parseUserMessage(message) {
  const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

  const prompt = `
You are a presentation request parser.
User message: "${message}"

Extract and return ONLY valid JSON:
{
  "topic": "main presentation topic",
  "slide_count": 8,
  "language": "kazakh|russian|english",
  "user_preferences": "style/mood/visual preferences or null",
  "visual_budget": "LOW|MEDIUM|HIGH"
}

Rules:
- topic: main subject
- slide_count: number mentioned, default 8, min 5 max 20
- language: detect from message language
- user_preferences: style wishes (dark, cinematic, minimal, historical etc) or null
- visual_budget: LOW=no preference, MEDIUM=some visuals, HIGH=lots of images
- Return ONLY JSON, no markdown
`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON жоқ");
    const parsed = JSON.parse(jsonMatch[0]);
    parsed.slide_count = clampSlideCount(parsed.slide_count);
    return parsed;
  } catch (err) {
    logError("parseUserMessage", err);
    return {
      topic: message,
      slide_count: 8,
      language: "kazakh",
      user_preferences: null,
      visual_budget: "MEDIUM",
    };
  }
}

// ─── 2-ҚАДАМ: Слайд жоспары ───────────────────────────────────────────────────
async function generateSlidesPlan(topic, slideCount, lang, userPreferences) {
  const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });
  const langName = getLanguageName(lang);

  const prefsBlock = userPreferences
    ? `\nUser style preferences: "${userPreferences}"`
    : "";

  const prompt = `
You are a professional presentation content writer and art director.
Topic: "${topic}"
Language for ALL text: ${langName}
Total slides: ${slideCount}${prefsBlock}

Create a complete slide plan. Return ONLY valid JSON array:
[
  {
    "index": 0,
    "type": "title",
    "title": "...",
    "subtitle": "...",
    "content": [],
    "style_hint": "dark cinematic, deep blue gradient, gold accent lines",
    "mood": "dramatic, powerful, futuristic",
    "text_position": "left"
  },
  {
    "index": 1,
    "type": "content",
    "title": "...",
    "subtitle": null,
    "content": ["point 1", "point 2", "point 3"],
    "style_hint": "minimal editorial, white space, strong typography",
    "mood": "clean, professional, modern",
    "text_position": "right"
  },
  {
    "index": 2,
    "type": "content",
    "title": "...",
    "subtitle": null,
    "content": ["point 1", "point 2"],
    "style_hint": "full bleed atmospheric photo, dark overlay",
    "mood": "immersive, visual-heavy",
    "text_position": "center"
  },
  {
    "index": ${slideCount - 1},
    "type": "end",
    "title": "...",
    "subtitle": "...",
    "content": [],
    "style_hint": "bold, memorable, brand closing",
    "mood": "confident, inspiring",
    "text_position": "center"
  }
]

Rules:
- First slide: type "title"
- Last slide: type "end"
- Middle slides: type "content", mix different style_hints
- style_hint: be specific and creative, varies per slide
- text_position: "left" | "right" | "center" — where text will sit on slide
- content: 3-5 bullet points for content slides
- Never repeat same style_hint twice
- Return ONLY JSON array, no markdown
`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("Слайд жоспары JSON жоқ");

  const slides = JSON.parse(jsonMatch[0]);
  return validateSlides(slides, slideCount, lang);
}

// ─── Валидация ────────────────────────────────────────────────────────────────
function validateSlides(slides, slideCount, lang) {
  if (!Array.isArray(slides) || slides.length === 0) {
    throw new Error("Слайдтар жоқ");
  }

  return slides.map((slide, i) => {
    if (!slide.type)       slide.type       = "content";
    if (!slide.title)      slide.title      = `Слайд ${i + 1}`;
    if (!slide.content)    slide.content    = [];
    if (!slide.style_hint) slide.style_hint = "modern minimal, clean gradient";
    if (!slide.mood)       slide.mood       = "professional";
    if (!slide.text_position) slide.text_position = "left";
    slide.index = i;
    slide.lang  = lang;
    return slide;
  });
}

module.exports = {
  parseUserMessage,
  generateSlidesPlan,
};
