const { randomPick } = require("./utils");

// ─── Барлық қолжетімді макеттер ───────────────────────────────────────────────
// Gemini осы тізімнен таңдайды, әр слайдқа басқа макет беруге болады

const LAYOUTS = {

  // ── Титул слайды макеттері ────────────────────────────────────────────────
  title_layouts: [
    "title_centered",        // Ортада үлкен мәтін + геометрия
    "title_left_visual",     // Сол жақта мәтін, оң жақта визуал
    "title_full_image",      // Толық сурет фоны + мәтін үстінде
    "title_split",           // Жоғары жарты — визуал, төмен жарты — мәтін
    "title_diagonal",        // Диагональ бөліну
  ],

  // ── Мазмұн слайды макеттері ───────────────────────────────────────────────
  content_layouts: [
    "image_left_text_right",   // Сол: сурет 40%, Оң: мәтін 60%
    "image_right_text_left",   // Сол: мәтін 60%, Оң: сурет 40%
    "full_bleed_overlay",      // Толық сурет + мәтін үстінде (жартылай мөлдір фон)
    "text_only_bold",          // Сурет жоқ, керемет типография
    "top_image_bottom_text",   // Жоғары: сурет, Төмен: мәтін
    "grid_2x2",                // 4 блок тор (4 пункт үшін)
    "big_quote",               // Үлкен цитата стилі
    "icon_grid",               // Геометриялық иконкалар + мәтін
  ],

  // ── Қорытынды слайды макеттері ───────────────────────────────────────────
  end_layouts: [
    "thankyou_centered",       // Классикалық орталық
    "thankyou_split",          // Жарты визуал, жарты мәтін
    "thankyou_full_visual",    // Толық визуал + қысқа мәтін
  ],
};

// ─── Тақырыпқа сай түс палитралары ───────────────────────────────────────────
const COLOR_PALETTES = [
  {
    name: "ocean_depth",
    primary: "0D1B2A",
    secondary: "1B4965",
    accent: "5FA8D3",
    highlight: "CAE9FF",
    text_dark: "0D1B2A",
    text_light: "F0F8FF",
    bg: "F0F8FF",
  },
  {
    name: "forest_night",
    primary: "1B2D1E",
    secondary: "2D5A27",
    accent: "52B788",
    highlight: "B7E4C7",
    text_dark: "1B2D1E",
    text_light: "F1FAF3",
    bg: "F1FAF3",
  },
  {
    name: "volcanic",
    primary: "1A0A00",
    secondary: "6B2D0E",
    accent: "E85D04",
    highlight: "FFBA08",
    text_dark: "1A0A00",
    text_light: "FFF8F0",
    bg: "FFF8F0",
  },
  {
    name: "midnight_purple",
    primary: "10002B",
    secondary: "3C096C",
    accent: "9D4EDD",
    highlight: "E0AAFF",
    text_dark: "10002B",
    text_light: "F8F0FF",
    bg: "F8F0FF",
  },
  {
    name: "arctic",
    primary: "03045E",
    secondary: "0077B6",
    accent: "00B4D8",
    highlight: "90E0EF",
    text_dark: "03045E",
    text_light: "F0FBFF",
    bg: "F0FBFF",
  },
  {
    name: "rose_gold",
    primary: "3D0000",
    secondary: "7B2D2D",
    accent: "C9484A",
    highlight: "FFB8B8",
    text_dark: "3D0000",
    text_light: "FFF5F5",
    bg: "FFF5F5",
  },
  {
    name: "obsidian",
    primary: "0A0A0A",
    secondary: "1C1C1C",
    accent: "F5A623",
    highlight: "FFE082",
    text_dark: "0A0A0A",
    text_light: "FAFAFA",
    bg: "FAFAFA",
  },
  {
    name: "teal_wave",
    primary: "003333",
    secondary: "005F5F",
    accent: "00A896",
    highlight: "A8DADC",
    text_dark: "003333",
    text_light: "F0FAFA",
    bg: "F0FAFA",
  },
];

// ─── Тақырыпқа сай палитра таңдау (Gemini таңдайды, бірақ fallback бар) ──────
function getPaletteByName(name) {
  return COLOR_PALETTES.find((p) => p.name === name) || randomPick(COLOR_PALETTES);
}

function getRandomPalette() {
  return randomPick(COLOR_PALETTES);
}

// ─── Макет метадеректері (slideBuilder үшін) ─────────────────────────────────
// Әр макет қай аймақта не орналасатынын сипаттайды

function getLayoutMeta(layoutName) {
  const meta = {
    // Титул
    title_centered: {
      hasImage: false, imageArea: null,
      textArea: { x: 0.8, y: 1.2, w: 8.4, h: 3.2 },
      style: "centered",
    },
    title_left_visual: {
      hasImage: true, imageArea: { x: 5.2, y: 0, w: 4.8, h: 5.63 },
      textArea: { x: 0.5, y: 1.0, w: 4.5, h: 3.5 },
      style: "left",
    },
    title_full_image: {
      hasImage: true, imageArea: { x: 0, y: 0, w: 10, h: 5.63 },
      textArea: { x: 0.6, y: 1.5, w: 8.5, h: 2.8 },
      style: "overlay",
    },
    title_split: {
      hasImage: true, imageArea: { x: 0, y: 0, w: 10, h: 2.8 },
      textArea: { x: 0.6, y: 3.0, w: 8.5, h: 2.3 },
      style: "split_v",
    },
    title_diagonal: {
      hasImage: false, imageArea: null,
      textArea: { x: 0.6, y: 1.3, w: 6.0, h: 3.0 },
      style: "diagonal",
    },

    // Мазмұн
    image_left_text_right: {
      hasImage: true, imageArea: { x: 0, y: 0, w: 4.0, h: 5.63 },
      textArea: { x: 4.3, y: 0.3, w: 5.4, h: 5.0 },
      style: "split_h",
    },
    image_right_text_left: {
      hasImage: true, imageArea: { x: 6.0, y: 0, w: 4.0, h: 5.63 },
      textArea: { x: 0.3, y: 0.3, w: 5.4, h: 5.0 },
      style: "split_h",
    },
    full_bleed_overlay: {
      hasImage: true, imageArea: { x: 0, y: 0, w: 10, h: 5.63 },
      textArea: { x: 0.5, y: 0.8, w: 9.0, h: 4.5 },
      style: "overlay",
    },
    text_only_bold: {
      hasImage: false, imageArea: null,
      textArea: { x: 0.6, y: 0.5, w: 8.8, h: 4.8 },
      style: "text_bold",
    },
    top_image_bottom_text: {
      hasImage: true, imageArea: { x: 0, y: 0, w: 10, h: 2.8 },
      textArea: { x: 0.5, y: 3.0, w: 9.0, h: 2.4 },
      style: "split_v",
    },
    grid_2x2: {
      hasImage: false, imageArea: null,
      textArea: { x: 0.3, y: 0.8, w: 9.4, h: 4.6 },
      style: "grid",
    },
    big_quote: {
      hasImage: false, imageArea: null,
      textArea: { x: 0.8, y: 1.0, w: 8.4, h: 3.5 },
      style: "quote",
    },
    icon_grid: {
      hasImage: false, imageArea: null,
      textArea: { x: 0.3, y: 0.8, w: 9.4, h: 4.6 },
      style: "icon_grid",
    },

    // Қорытынды
    thankyou_centered: {
      hasImage: false, imageArea: null,
      textArea: { x: 0.5, y: 1.5, w: 9.0, h: 2.5 },
      style: "centered",
    },
    thankyou_split: {
      hasImage: true, imageArea: { x: 5.5, y: 0, w: 4.5, h: 5.63 },
      textArea: { x: 0.5, y: 1.2, w: 4.8, h: 3.2 },
      style: "left",
    },
    thankyou_full_visual: {
      hasImage: true, imageArea: { x: 0, y: 0, w: 10, h: 5.63 },
      textArea: { x: 0.5, y: 2.0, w: 9.0, h: 1.8 },
      style: "overlay",
    },
  };

  return meta[layoutName] || meta["text_only_bold"];
}

module.exports = {
  LAYOUTS,
  COLOR_PALETTES,
  getPaletteByName,
  getRandomPalette,
  getLayoutMeta,
};
