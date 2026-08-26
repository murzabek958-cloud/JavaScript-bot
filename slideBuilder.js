const PptxGenJS = require("pptxgenjs");
const { logError, formatDate } = require("./utils");

// ─── Мәтін түсі — фон әрқашан қараңғы болғандықтан ақ ───────────────────────
const TEXT_COLOR   = "FFFFFF";
const ACCENT_COLOR = "A8D8EA";
const DIM_COLOR    = "CCCCCC";

// ─── НЕГІЗГІ ФУНКЦИЯ ──────────────────────────────────────────────────────────
async function buildPresentation(slides, renderedList, outputPath) {
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_16x9";

  for (let i = 0; i < slides.length; i++) {
    const slide     = slides[i];
    const rendered  = renderedList[i];
    const pptSlide  = pres.addSlide();

    try {
      // 1) Фон скриншотты толық слайдқа сал
      if (rendered.imageBuffer && rendered.imageBuffer.length > 0) {
        const base64 = rendered.imageBuffer.toString("base64");
        pptSlide.addImage({
          data: `image/png;base64,${base64}`,
          x: 0, y: 0, w: 10, h: 5.63,
          sizing: { type: "cover", w: 10, h: 5.63 },
        });
      }

      // 2) Мәтін элементтерін zones бойынша сал
      const zones = rendered.zones || {};

      if (slide.type === "title") {
        buildTitleContent(pptSlide, slide, zones);
      } else if (slide.type === "end") {
        buildEndContent(pptSlide, slide, zones);
      } else {
        buildContentSlide(pptSlide, slide, zones);
      }

      // 3) Слайд нөмірі — төменгі оң бұрыш
      if (slide.type === "content") {
        pptSlide.addText(`${i + 1}`, {
          x: 9.5, y: 5.3, w: 0.4, h: 0.25,
          fontSize: 9,
          color: DIM_COLOR,
          align: "right",
          transparency: 30,
        });
      }

    } catch (err) {
      logError(`slideBuilder[${i}]`, err);
      buildSafeSlide(pptSlide, slide);
    }

    if (slide.speaker_notes) {
      pptSlide.addNotes(slide.speaker_notes);
    }
  }

  await pres.writeFile({ fileName: outputPath });
  console.log(`[slideBuilder] ✅ PPTX дайын: ${outputPath}`);
}

// ─── ТИТУЛ СЛАЙДЫ ─────────────────────────────────────────────────────────────
function buildTitleContent(slide, data, zones) {
  const titleZone   = zones.title   || defaultZone("title",   data.text_position);
  const subtitleZone= zones.subtitle|| defaultZone("subtitle", data.text_position);

  // Тақырып
  slide.addText(data.title || "", {
    x: titleZone.x, y: titleZone.y,
    w: titleZone.w, h: titleZone.h,
    fontSize: 40,
    bold: true,
    color: TEXT_COLOR,
    fontFace: "Calibri",
    align: alignByPosition(data.text_position),
    wrap: true,
    shadow: { type: "outer", color: "000000", opacity: 0.6, blur: 8, offset: 3, angle: 45 },
  });

  // Субтитр
  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: subtitleZone.x, y: subtitleZone.y,
      w: subtitleZone.w, h: subtitleZone.h,
      fontSize: 18,
      color: ACCENT_COLOR,
      fontFace: "Calibri",
      align: alignByPosition(data.text_position),
      wrap: true,
    });
  }

  // Күн
  slide.addText(`AI Generated  ·  ${formatDate()}`, {
    x: 0.4, y: 5.2, w: 9, h: 0.3,
    fontSize: 10,
    color: DIM_COLOR,
    transparency: 30,
    fontFace: "Calibri",
  });
}

// ─── МАЗМҰН СЛАЙДЫ ────────────────────────────────────────────────────────────
function buildContentSlide(slide, data, zones) {
  const titleZone   = zones.title   || defaultZone("title",   data.text_position);
  const contentZone = zones.content || defaultZone("content", data.text_position);

  // Тақырып
  slide.addText(data.title || "", {
    x: titleZone.x, y: titleZone.y,
    w: titleZone.w, h: titleZone.h,
    fontSize: 24,
    bold: true,
    color: TEXT_COLOR,
    fontFace: "Calibri",
    align: alignByPosition(data.text_position),
    wrap: true,
    shadow: { type: "outer", color: "000000", opacity: 0.5, blur: 6, offset: 2, angle: 45 },
  });

  // Буллеттер
  if (data.content && data.content.length > 0) {
    const items = data.content.map((point, idx) => ({
      text: point,
      options: {
        fontSize: 16,
        color: TEXT_COLOR,
        bullet: { type: "number" },
        paraSpaceAfter: 10,
        breakLine: idx < data.content.length - 1,
      },
    }));

    slide.addText(items, {
      x: contentZone.x, y: contentZone.y,
      w: contentZone.w, h: contentZone.h,
      fontFace: "Calibri",
      valign: "top",
      margin: [6, 6, 6, 6],
      shadow: { type: "outer", color: "000000", opacity: 0.4, blur: 4, offset: 1, angle: 45 },
    });
  }
}

// ─── ҚОРЫТЫНДЫ СЛАЙДЫ ─────────────────────────────────────────────────────────
function buildEndContent(slide, data, zones) {
  const titleZone    = zones.title    || defaultZone("title",    "center");
  const subtitleZone = zones.subtitle || defaultZone("subtitle", "center");

  slide.addText(data.title || "Назарларыңызға рахмет!", {
    x: titleZone.x, y: titleZone.y,
    w: titleZone.w, h: titleZone.h,
    fontSize: 38,
    bold: true,
    color: TEXT_COLOR,
    fontFace: "Calibri",
    align: "center",
    wrap: true,
    shadow: { type: "outer", color: "000000", opacity: 0.6, blur: 8, offset: 3, angle: 45 },
  });

  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: subtitleZone.x, y: subtitleZone.y,
      w: subtitleZone.w, h: subtitleZone.h,
      fontSize: 18,
      color: ACCENT_COLOR,
      fontFace: "Calibri",
      align: "center",
      wrap: true,
    });
  }
}

// ─── ҚАУІПСІЗ СЛАЙД — барлығы сәтсіз болса ───────────────────────────────────
function buildSafeSlide(slide, data) {
  slide.addShape("rect", {
    x: 0, y: 0, w: 10, h: 5.63,
    fill: { color: "0D1B2A" },
    line: { color: "0D1B2A" },
  });
  slide.addText(data.title || "...", {
    x: 0.5, y: 2.0, w: 9, h: 1.5,
    fontSize: 28, bold: true,
    color: TEXT_COLOR,
    align: "center",
    fontFace: "Calibri",
  });
}

// ─── КӨМЕКШІ ФУНКЦИЯЛАР ───────────────────────────────────────────────────────

// Позицияға сай text align
function alignByPosition(position) {
  if (position === "center") return "center";
  if (position === "right")  return "left";
  return "left";
}

// Zones алынбаса әдепкі координаттар
function defaultZone(field, position) {
  const zones = {
    left: {
      title:    { x: 0.38, y: 0.90, w: 4.35, h: 0.98 },
      subtitle: { x: 0.38, y: 1.95, w: 4.35, h: 0.60 },
      content:  { x: 0.38, y: 2.03, w: 4.35, h: 2.85 },
    },
    right: {
      title:    { x: 5.26, y: 0.90, w: 4.35, h: 0.98 },
      subtitle: { x: 5.26, y: 1.95, w: 4.35, h: 0.60 },
      content:  { x: 5.26, y: 2.03, w: 4.35, h: 2.85 },
    },
    center: {
      title:    { x: 0.60, y: 1.13, w: 8.80, h: 1.13 },
      subtitle: { x: 0.60, y: 2.33, w: 8.80, h: 0.68 },
      content:  { x: 0.75, y: 2.40, w: 8.50, h: 2.63 },
    },
  };
  return (zones[position] || zones.left)[field] || zones.left.title;
}

module.exports = { buildPresentation };
