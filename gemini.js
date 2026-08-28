const { GoogleGenerativeAI } = require("@google/generative-ai");
const { getLanguageName, logError, clampSlideCount } = require("./utils");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─── Моделді конфигурациямен алу ─────────────────────────────────────────────
function getModel() {
  return genAI.getGenerativeModel({
    model: "gemini-3.5-flash-lite",
    generationConfig: {
      responseMimeType: "application/json",
    },
  });
}

// ─── 1-ҚАДАМ: Еркін хабарламаны парсинг (~200 token) ─────────────────────────
async function parseUserMessage(message) {
  const model  = getModel();
  const prompt =
    `Parse this presentation request. Return ONLY JSON, no markdown.\n` +
    `Input: "${message}"\n` +
    `{"topic":"...","slide_count":8,"language":"kazakh|russian|english",` +
    `"user_preferences":"style or null","visual_budget":"LOW|MEDIUM|HIGH"}\n` +
    `Rules: slide_count default 8 min 5 max 20, detect language from input.`;

  try {
    const result = await model.generateContent(prompt);
    const text   = result.response.text().trim();
    const parsed = JSON.parse(text);
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

// ─── 2-ҚАДАМ: Слайд жоспары (~600 token) ─────────────────────────────────────
async function generateSlidesPlan(topic, slideCount, lang, userPreferences) {
  const model    = getModel();
  const langName = getLanguageName(lang);
  const prefs    = userPreferences ? ` Style: "${userPreferences}".` : "";

  const prompt =
    `Presentation plan. Topic:"${topic}" Lang:${langName} Slides:${slideCount}.${prefs}\n` +
    `Return ONLY JSON array, no markdown:\n` +
    `[{"index":0,"type":"title","title":"...","subtitle":"...","content":[],` +
    `"style_hint":"...","mood":"...","text_position":"left|right|center",` +
    `"image_query":"3-5 English words for Unsplash photo matching this slide topic"},` +
    `{"index":1,"type":"content","title":"...","subtitle":null,"content":["pt1","pt2","pt3"],` +
    `"style_hint":"...","mood":"...","text_position":"left",` +
    `"image_query":"specific visual photo query related to slide content"},` +
    `...]\n` +
    `Rules: first=title, last=end, middle=content. ` +
    `style_hint unique per slide. content 3-5 bullets. All text in ${langName}.\n` +
    `image_query: English only, visual and specific to slide content, no abstract words.\n` +
    `Example image_queries: "ancient silk road desert caravan", "kazakh steppe sunset nomad", ` +
    `"old manuscript calligraphy book", "soviet era architecture dramatic sky".`;

  const result = await model.generateContent(prompt);
  const text   = result.response.text().trim();
  return validateSlides(JSON.parse(text), slideCount, lang);
}

// ─── Валидация ────────────────────────────────────────────────────────────────
function validateSlides(slides, slideCount, lang) {
  if (!Array.isArray(slides) || slides.length === 0)
    throw new Error("Слайдтар жоқ");

  return slides.map((s, i) => ({
    index:         i,
    lang,
    type:          s.type          || "content",
    title:         s.title         || `Слайд ${i + 1}`,
    subtitle:      s.subtitle      || null,
    content:       Array.isArray(s.content) ? s.content : [],
    style_hint:    s.style_hint    || "modern minimal, clean gradient",
    mood:          s.mood          || "professional",
    text_position: s.text_position || "left",
    image_query:   s.image_query   || null,
  }));
}

module.exports = { parseUserMessage, generateSlidesPlan };
