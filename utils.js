const fs = require("fs");

// ─── Тіл анықтау ──────────────────────────────────────────────────────────────
function detectLanguage(text) {
  const kazakh = /[әіңғүұқөһ]/i;
  const russian = /[ёъыьэ]/i;
  if (kazakh.test(text)) return "kazakh";
  if (russian.test(text)) return "russian";
  return "english";
}

function getLanguageName(lang) {
  const names = {
    kazakh: "Kazakh (Қазақша)",
    russian: "Russian (Орысша)",
    english: "English",
  };
  return names[lang] || "English";
}

// ─── Координат конвертация: px → PPTX inches ─────────────────────────────────
// HTML өлшемі: 1333 × 750px
// PPTX өлшемі: 10 × 5.63 inch

const HTML_W = 1333;
const HTML_H = 750;
const PPTX_W = 10;
const PPTX_H = 5.63;

function pxToInch(px, axis) {
  if (axis === "x" || axis === "w") return (px / HTML_W) * PPTX_W;
  if (axis === "y" || axis === "h") return (px / HTML_H) * PPTX_H;
  return px;
}

function zoneToInches(zone) {
  return {
    x: pxToInch(zone.x, "x"),
    y: pxToInch(zone.y, "y"),
    w: pxToInch(zone.w, "w"),
    h: pxToInch(zone.h, "h"),
  };
}

// ─── Файл операциялары ────────────────────────────────────────────────────────
function safeDelete(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn(`[utils] Файл өшірілмеді: ${filePath}`, err.message);
  }
}

function safeDeleteAll(filePaths) {
  (filePaths || []).forEach(safeDelete);
}

// ─── Қате логтау ─────────────────────────────────────────────────────────────
function logError(context, err) {
  console.error(`[${context}] ❌ ${err.message}`);
}

// ─── Кездейсоқ таңдау ─────────────────────────────────────────────────────────
function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── Слайд санын тексеру ──────────────────────────────────────────────────────
function clampSlideCount(n) {
  return Math.min(Math.max(parseInt(n) || 8, 5), 20);
}

// ─── Уақыт форматы ────────────────────────────────────────────────────────────
function formatDate() {
  return new Date().toLocaleDateString("kk-KZ");
}

module.exports = {
  detectLanguage,
  getLanguageName,
  pxToInch,
  zoneToInches,
  safeDelete,
  safeDeleteAll,
  logError,
  randomPick,
  randomInt,
  clampSlideCount,
  formatDate,
  HTML_W,
  HTML_H,
  PPTX_W,
  PPTX_H,
};
