const PptxGenJS = require("pptxgenjs");
const { getLayoutMeta, getPaletteByName } = require("./layouts");
const { getSlideImage } = require("./imageGen");
const { applyFallbackVisual } = require("./fallback");
const { logError } = require("./utils");

// ─── Негізгі презентация жасаушы ─────────────────────────────────────────────
async function buildPresentation(data, outputPath) {
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_16x9";

  const palette = getPaletteByName(data.palette);

  for (let i = 0; i < data.slides.length; i++) {
    const slideData = data.slides[i];
    const slide = pres.addSlide();
    const layout = slideData.layout || "text_only_bold";
    const meta = getLayoutMeta(layout);

    try {
      if (slideData.type === "title") {
        await buildTitleSlide(slide, slideData, meta, palette, i);
      } else if (slideData.type === "end") {
        await buildEndSlide(slide, slideData, meta, palette, i);
      } else {
        await buildContentSlide(slide, slideData, meta, palette, i);
      }
    } catch (err) {
      // Слайд жасау қатесі → қарапайым fallback слайд
      logError(`buildSlide[${i}]`, err);
      buildSafeSlide(slide, slideData, palette);
    }

    if (slideData.speaker_notes) {
      slide.addNotes(slideData.speaker_notes);
    }
  }

  await pres.writeFile({ fileName: outputPath });
}

// ─── Визуал аймақты толтыру (сурет немесе fallback) ──────────────────────────
async function fillVisualArea(slide, imagePrompt, area, palette, index) {
  if (!area) return;

  let imageResult = { success: false };

  if (imagePrompt) {
    imageResult = await getSlideImage(imagePrompt);
  }

  if (imageResult.success) {
    slide.addImage({
      data: imageResult.imageData,
      x: area.x, y: area.y,
      w: area.w, h: area.h,
      sizing: { type: "cover", w: area.w, h: area.h },
    });
  } else {
    applyFallbackVisual(slide, area, palette, index);
  }
}

// ─── Оверлей стиль үшін қараңғы/ашық маска ───────────────────────────────────
function addOverlayMask(slide, palette, opacity = 55) {
  slide.addShape("rect", {
    x: 0, y: 0, w: 10, h: 5.63,
    fill: { color: palette.primary, transparency: opacity },
    line: { color: palette.primary, transparency: opacity },
  });
}

// ─── ТИТУЛ СЛАЙДЫ ─────────────────────────────────────────────────────────────
async function buildTitleSlide(slide, data, meta, palette, index) {
  const style = meta.style;

  if (style === "overlay") {
    // Толық сурет фоны
    await fillVisualArea(slide, data.image_prompt, meta.imageArea, palette, index);
    addOverlayMask(slide, palette, 45);
    addTitleText(slide, data, meta.textArea, palette, "light");

  } else if (style === "left") {
    // Сол мәтін, оң визуал
    slide.addShape("rect", {
      x: 0, y: 0, w: 10, h: 5.63,
      fill: { color: palette.primary },
      line: { color: palette.primary },
    });
    await fillVisualArea(slide, data.image_prompt, meta.imageArea, palette, index);
    addTitleText(slide, data, meta.textArea, palette, "light");

  } else if (style === "split_v") {
    // Жоғары визуал, төмен мәтін
    await fillVisualArea(slide, data.image_prompt, meta.imageArea, palette, index);
    slide.addShape("rect", {
      x: 0, y: meta.imageArea.h, w: 10, h: 5.63 - meta.imageArea.h,
      fill: { color: palette.primary },
      line: { color: palette.primary },
    });
    addTitleText(slide, data, meta.textArea, palette, "light");

  } else if (style === "diagonal") {
    // Диагональ бөліну
    slide.addShape("rect", {
      x: 0, y: 0, w: 10, h: 5.63,
      fill: { color: palette.bg },
      line: { color: palette.bg },
    });
    slide.addShape("rect", {
      x: 4.5, y: 0, w: 5.5, h: 5.63,
      fill: { color: palette.primary },
      line: { color: palette.primary },
    });
    slide.addShape("rect", {
      x: 3.8, y: 0, w: 1.5, h: 5.63,
      fill: { color: palette.accent, transparency: 30 },
      line: { color: palette.accent, transparency: 30 },
    });
    addTitleText(slide, data, meta.textArea, palette, "dark");

  } else {
    // title_centered — толық фон
    slide.addShape("rect", {
      x: 0, y: 0, w: 10, h: 5.63,
      fill: { color: palette.primary },
      line: { color: palette.primary },
    });
    decorateCentered(slide, palette);
    addTitleText(slide, data, meta.textArea, palette, "light");
  }

  // Күн + брендинг
  slide.addText(`AI Generated  ·  ${new Date().toLocaleDateString("kk-KZ")}`, {
    x: 0.5, y: 5.1, w: 9, h: 0.35,
    fontSize: 11,
    color: palette.text_light,
    align: style === "dark" ? "left" : "left",
    transparency: 35,
    fontFace: "Calibri",
  });
}

// ─── МАЗМҰН СЛАЙДЫ ────────────────────────────────────────────────────────────
async function buildContentSlide(slide, data, meta, palette, index) {
  const style = meta.style;

  if (style === "overlay") {
    // Толық фон сурет + мөлдір маска + мәтін
    await fillVisualArea(slide, data.image_prompt, { x: 0, y: 0, w: 10, h: 5.63 }, palette, index);
    addOverlayMask(slide, palette, 50);
    addContentHeader(slide, data.title, palette, "light");
    addBullets(slide, data.content, meta.textArea, palette, "light");

  } else if (style === "split_h") {
    // Горизонталь бөліну (сол/оң)
    slide.addShape("rect", {
      x: 0, y: 0, w: 10, h: 5.63,
      fill: { color: palette.bg },
      line: { color: palette.bg },
    });
    // Хедер жолағы
    slide.addShape("rect", {
      x: 0, y: 0, w: 10, h: 0.9,
      fill: { color: palette.primary },
      line: { color: palette.primary },
    });
    await fillVisualArea(slide, data.image_prompt, meta.imageArea, palette, index);
    addContentHeader(slide, data.title, palette, "light");
    addBullets(slide, data.content, meta.textArea, palette, "dark");

  } else if (style === "split_v") {
    // Вертикаль бөліну (жоғары/төмен)
    await fillVisualArea(slide, data.image_prompt, meta.imageArea, palette, index);
    slide.addShape("rect", {
      x: 0, y: meta.imageArea.h, w: 10, h: 5.63 - meta.imageArea.h,
      fill: { color: palette.bg },
      line: { color: palette.bg },
    });
    slide.addShape("rect", {
      x: 0, y: meta.imageArea.h, w: 10, h: 0.7,
      fill: { color: palette.primary },
      line: { color: palette.primary },
    });
    addContentHeader(slide, data.title, palette, "light");
    addBullets(slide, data.content, meta.textArea, palette, "dark");

  } else if (style === "grid") {
    // 2x2 тор макеті
    buildGridSlide(slide, data, palette);

  } else if (style === "quote") {
    // Үлкен цитата стилі
    buildQuoteSlide(slide, data, palette);

  } else if (style === "icon_grid") {
    // Иконка + мәтін торы
    buildIconGridSlide(slide, data, palette);

  } else {
    // text_only_bold — таза типография
    buildTextBoldSlide(slide, data, palette);
  }

  // Слайд нөмірі (төменгі оң)
  slide.addText(`${index}`, {
    x: 9.3, y: 5.25, w: 0.5, h: 0.25,
    fontSize: 9,
    color: palette.primary,
    align: "right",
    transparency: 40,
  });
}

// ─── ҚОРЫТЫНДЫ СЛАЙДЫ ─────────────────────────────────────────────────────────
async function buildEndSlide(slide, data, meta, palette, index) {
  const style = meta.style;

  if (style === "overlay") {
    await fillVisualArea(slide, data.image_prompt, { x: 0, y: 0, w: 10, h: 5.63 }, palette, index);
    addOverlayMask(slide, palette, 40);
  } else if (style === "left") {
    slide.addShape("rect", {
      x: 0, y: 0, w: 10, h: 5.63,
      fill: { color: palette.primary },
      line: { color: palette.primary },
    });
    await fillVisualArea(slide, data.image_prompt, meta.imageArea, palette, index);
  } else {
    slide.addShape("rect", {
      x: 0, y: 0, w: 10, h: 5.63,
      fill: { color: palette.primary },
      line: { color: palette.primary },
    });
    decorateCentered(slide, palette);
  }

  slide.addText(data.title || "Назарларыңызға рахмет!", {
    x: 0.5, y: 1.6, w: 9, h: 1.4,
    fontSize: 42,
    bold: true,
    color: palette.text_light,
    align: "center",
    fontFace: "Calibri",
  });

  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: 0.5, y: 3.2, w: 9, h: 0.7,
      fontSize: 18,
      color: palette.accent,
      align: "center",
      fontFace: "Calibri",
    });
  }
}

// ─── АРНАЙЫ СЛАЙД СТИЛЬДЕРІ ───────────────────────────────────────────────────

function buildGridSlide(slide, data, palette) {
  slide.addShape("rect", {
    x: 0, y: 0, w: 10, h: 5.63,
    fill: { color: palette.bg },
    line: { color: palette.bg },
  });
  slide.addShape("rect", {
    x: 0, y: 0, w: 10, h: 0.85,
    fill: { color: palette.primary },
    line: { color: palette.primary },
  });
  slide.addText(data.title, {
    x: 0.4, y: 0.1, w: 9, h: 0.65,
    fontSize: 24, bold: true,
    color: palette.text_light,
    fontFace: "Calibri", margin: 0,
  });

  const items = (data.content || []).slice(0, 4);
  const positions = [
    { x: 0.3, y: 1.0, w: 4.5, h: 1.9 },
    { x: 5.2, y: 1.0, w: 4.5, h: 1.9 },
    { x: 0.3, y: 3.2, w: 4.5, h: 1.9 },
    { x: 5.2, y: 3.2, w: 4.5, h: 1.9 },
  ];
  const cardColors = [palette.primary, palette.secondary, palette.accent, palette.secondary];

  items.forEach((item, i) => {
    const pos = positions[i];
    const col = cardColors[i];
    slide.addShape("rect", {
      x: pos.x, y: pos.y, w: pos.w, h: pos.h,
      fill: { color: col, transparency: i === 2 ? 0 : 15 },
      line: { color: col },
      shadow: { type: "outer", color: "000000", opacity: 0.15, blur: 6, offset: 3, angle: 45 },
    });
    slide.addText(`${i + 1}`, {
      x: pos.x + 0.15, y: pos.y + 0.12, w: 0.5, h: 0.5,
      fontSize: 22, bold: true,
      color: palette.highlight, transparency: 20,
    });
    slide.addText(item, {
      x: pos.x + 0.15, y: pos.y + 0.55, w: pos.w - 0.3, h: pos.h - 0.7,
      fontSize: 14,
      color: palette.text_light,
      fontFace: "Calibri",
      wrap: true, valign: "top",
    });
  });
}

function buildQuoteSlide(slide, data, palette) {
  slide.addShape("rect", {
    x: 0, y: 0, w: 10, h: 5.63,
    fill: { color: palette.primary },
    line: { color: palette.primary },
  });
  // Үлкен тырнақша
  slide.addText("\u201C", {
    x: 0.3, y: -0.3, w: 2, h: 2,
    fontSize: 150,
    color: palette.accent,
    transparency: 30,
    fontFace: "Georgia",
  });
  slide.addText(data.title, {
    x: 0.8, y: 1.0, w: 8.4, h: 2.0,
    fontSize: 28, bold: true,
    color: palette.text_light,
    fontFace: "Calibri",
    align: "left",
    wrap: true,
  });
  if (data.content?.[0]) {
    slide.addText(data.content[0], {
      x: 0.8, y: 3.3, w: 8.4, h: 1.8,
      fontSize: 16,
      color: palette.accent,
      fontFace: "Calibri",
      wrap: true,
    });
  }
}

function buildIconGridSlide(slide, data, palette) {
  slide.addShape("rect", {
    x: 0, y: 0, w: 10, h: 5.63,
    fill: { color: palette.bg },
    line: { color: palette.bg },
  });
  slide.addShape("rect", {
    x: 0, y: 0, w: 10, h: 0.85,
    fill: { color: palette.primary },
    line: { color: palette.primary },
  });
  slide.addText(data.title, {
    x: 0.4, y: 0.1, w: 9, h: 0.65,
    fontSize: 24, bold: true,
    color: palette.text_light,
    fontFace: "Calibri", margin: 0,
  });

  const items = (data.content || []).slice(0, 5);
  const iconColors = [palette.primary, palette.accent, palette.secondary, palette.primary, palette.accent];
  const shapes = ["ellipse", "ellipse", "ellipse", "ellipse", "ellipse"];

  items.forEach((item, i) => {
    const x = 0.4 + i * 1.85;
    const y = 1.1;
    slide.addShape(shapes[i], {
      x, y, w: 1.0, h: 1.0,
      fill: { color: iconColors[i], transparency: 10 },
      line: { color: iconColors[i] },
    });
    slide.addText(`${i + 1}`, {
      x, y, w: 1.0, h: 1.0,
      fontSize: 22, bold: true,
      color: palette.text_light,
      align: "center", valign: "middle",
    });
    slide.addText(item, {
      x: x - 0.3, y: y + 1.1, w: 1.6, h: 2.8,
      fontSize: 12,
      color: palette.text_dark,
      fontFace: "Calibri",
      align: "center",
      wrap: true,
    });
  });
}

function buildTextBoldSlide(slide, data, palette) {
  slide.addShape("rect", {
    x: 0, y: 0, w: 10, h: 5.63,
    fill: { color: palette.bg },
    line: { color: palette.bg },
  });
  // Сол жақ акцент жолағы
  slide.addShape("rect", {
    x: 0, y: 0, w: 0.18, h: 5.63,
    fill: { color: palette.accent },
    line: { color: palette.accent },
  });
  slide.addShape("rect", {
    x: 0, y: 0, w: 10, h: 0.85,
    fill: { color: palette.primary },
    line: { color: palette.primary },
  });
  slide.addText(data.title, {
    x: 0.4, y: 0.1, w: 9.2, h: 0.65,
    fontSize: 24, bold: true,
    color: palette.text_light,
    fontFace: "Calibri", margin: 0,
  });
  addBullets(slide, data.content, { x: 0.6, y: 1.1, w: 9.0, h: 4.2 }, palette, "dark");
}

// ─── КӨМЕКШІ ФУНКЦИЯЛАР ───────────────────────────────────────────────────────

function addTitleText(slide, data, area, palette, mode) {
  const textColor = mode === "light" ? palette.text_light : palette.text_dark;
  slide.addText(data.title, {
    x: area.x, y: area.y, w: area.w, h: area.h * 0.55,
    fontSize: 40, bold: true,
    color: textColor,
    fontFace: "Calibri",
    align: "left",
    wrap: true,
  });
  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: area.x, y: area.y + area.h * 0.58, w: area.w, h: area.h * 0.35,
      fontSize: 18,
      color: palette.accent,
      fontFace: "Calibri",
      align: "left",
      wrap: true,
    });
  }
}

function addContentHeader(slide, title, palette, mode) {
  const textColor = mode === "light" ? palette.text_light : palette.text_dark;
  slide.addText(title, {
    x: 0.4, y: 0.12, w: 9.0, h: 0.65,
    fontSize: 24, bold: true,
    color: textColor,
    fontFace: "Calibri", margin: 0,
  });
}

function addBullets(slide, content, area, palette, mode) {
  if (!content || content.length === 0) return;
  const textColor = mode === "light" ? palette.text_light : palette.text_dark;

  const items = content.map((point, idx) => ({
    text: point,
    options: {
      fontSize: 16,
      color: textColor,
      bullet: { type: "number" },
      paraSpaceAfter: 10,
      breakLine: idx < content.length - 1,
    },
  }));

  slide.addText(items, {
    x: area.x, y: area.y, w: area.w, h: area.h,
    fontFace: "Calibri",
    valign: "top",
    margin: [8, 8, 8, 8],
  });
}

function decorateCentered(slide, palette) {
  slide.addShape("ellipse", {
    x: 7.2, y: -1.0, w: 4.5, h: 4.5,
    fill: { color: palette.secondary, transparency: 30 },
    line: { color: palette.secondary, transparency: 30 },
  });
  slide.addShape("ellipse", {
    x: -0.5, y: 3.5, w: 3.0, h: 3.0,
    fill: { color: palette.accent, transparency: 55 },
    line: { color: palette.accent, transparency: 55 },
  });
}

function buildSafeSlide(slide, data, palette) {
  slide.addShape("rect", {
    x: 0, y: 0, w: 10, h: 5.63,
    fill: { color: palette.primary },
    line: { color: palette.primary },
  });
  slide.addText(data.title || "...", {
    x: 0.5, y: 1.5, w: 9, h: 2.5,
    fontSize: 28, bold: true,
    color: palette.text_light,
    align: "center",
    fontFace: "Calibri",
  });
}

module.exports = { buildPresentation };
