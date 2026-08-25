const fs = require("fs");

// ─── Тіл анықтау ──────────────────────────────────────────────────────────────
function detectLanguage(text) {
  const kazakh = /[әіңғүұқөһ]/i;
  const russian = /[ёъыьэ]/i;
  if (kazakh.test(text)) return "kazakh";
  if (russian.test(text)) return "russian";
  return "english";
}

// ─── Тіл атауы (Gemini промпты үшін) ─────────────────────────────────────────
function getLanguageName(lang) {
  const names = {
    kazakh: "Kazakh (Қазақша)",
    russian: "Russian (Орысша)",
    english: "English",
  };
  return names[lang] || "English";
}

// ─── Уақытша файлды қауіпсіз өшіру ──────────────────────────────────────────
function safeDelete(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn(`[utils] Файл өшірілмеді: ${filePath}`, err.message);
  }
}

// ─── Қате логтау ─────────────────────────────────────────────────────────────
function logError(context, err) {
  console.error(`[${context}] ❌ ${err.message}`);
}

// ─── Кездейсоқ элемент таңдау ────────────────────────────────────────────────
function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Кездейсоқ сан (min-max аралығында) ──────────────────────────────────────
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── Hex түсін RGB-ге айналдыру ───────────────────────────────────────────────
function hexToRgb(hex) {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return { r, g, b };
}

// ─── Түсті ашықтандыру/қарайту ───────────────────────────────────────────────
function adjustColor(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  const clamp = (v) => Math.min(255, Math.max(0, v));
  const toHex = (v) => clamp(v + amount).toString(16).padStart(2, "0");
  return `${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// ─── Слайд санын тексеру ──────────────────────────────────────────────────────
function clampSlideCount(n) {
  return Math.min(Math.max(parseInt(n) || 8, 5), 20);
}

module.exports = {
  detectLanguage,
  getLanguageName,
  safeDelete,
  logError,
  randomPick,
  randomInt,
  hexToRgb,
  adjustColor,
  clampSlideCount,
};
