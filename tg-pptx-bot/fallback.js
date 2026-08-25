const { randomPick, randomInt, adjustColor } = require("./utils");

// ─── Fallback визуал типтері ───────────────────────────────────────────────────
const FALLBACK_TYPES = [
  "gradient_geometric",   // Градиент фон + геометриялық фигуралар
  "circle_burst",         // Шеңбер шоғыры
  "triangle_pattern",     // Үшбұрыш паттерні
  "diagonal_blocks",      // Диагональ блоктар
  "concentric_rings",     // Концентрлік сақиналар
  "dot_grid",             // Нүкте торы
  "wave_lines",           // Толқын сызықтар
  "abstract_polygons",    // Абстракт полигондар
];

// ─── Негізгі fallback функциясы ───────────────────────────────────────────────
// slide — pptxgenjs слайд объектісі
// area  — { x, y, w, h } визуал аймағы
// palette — түс палитрасы
// index — слайд нөмірі (әр жолы басқаша болу үшін)

function applyFallbackVisual(slide, area, palette, index) {
  const types = FALLBACK_TYPES;
  // Индекс бойынша таңдау → бір презентацияда әртүрлі fallback болады
  const type = types[index % types.length];

  switch (type) {
    case "gradient_geometric":
      drawGradientGeometric(slide, area, palette);
      break;
    case "circle_burst":
      drawCircleBurst(slide, area, palette);
      break;
    case "triangle_pattern":
      drawTrianglePattern(slide, area, palette);
      break;
    case "diagonal_blocks":
      drawDiagonalBlocks(slide, area, palette);
      break;
    case "concentric_rings":
      drawConcentricRings(slide, area, palette);
      break;
    case "dot_grid":
      drawDotGrid(slide, area, palette);
      break;
    case "wave_lines":
      drawWaveLines(slide, area, palette);
      break;
    case "abstract_polygons":
      drawAbstractPolygons(slide, area, palette);
      break;
    default:
      drawGradientGeometric(slide, area, palette);
  }
}

// ─── 1. Градиент фон + геометрия ─────────────────────────────────────────────
function drawGradientGeometric(slide, area, palette) {
  // Негізгі фон блогы
  slide.addShape("rect", {
    x: area.x, y: area.y, w: area.w, h: area.h,
    fill: { color: palette.primary },
    line: { color: palette.primary },
  });

  // Үлкен декоративті шеңбер (жоғары-оң)
  slide.addShape("ellipse", {
    x: area.x + area.w * 0.5,
    y: area.y - area.h * 0.2,
    w: area.w * 0.8,
    h: area.w * 0.8,
    fill: { color: palette.secondary, transparency: 30 },
    line: { color: palette.secondary, transparency: 30 },
  });

  // Кіші шеңбер (төмен-сол)
  slide.addShape("ellipse", {
    x: area.x - area.w * 0.1,
    y: area.y + area.h * 0.5,
    w: area.w * 0.5,
    h: area.w * 0.5,
    fill: { color: palette.accent, transparency: 50 },
    line: { color: palette.accent, transparency: 50 },
  });

  // Акцент нүктесі
  slide.addShape("ellipse", {
    x: area.x + area.w * 0.6,
    y: area.y + area.h * 0.6,
    w: area.w * 0.2,
    h: area.w * 0.2,
    fill: { color: palette.highlight, transparency: 40 },
    line: { color: palette.highlight, transparency: 40 },
  });
}

// ─── 2. Шеңбер шоғыры ────────────────────────────────────────────────────────
function drawCircleBurst(slide, area, palette) {
  slide.addShape("rect", {
    x: area.x, y: area.y, w: area.w, h: area.h,
    fill: { color: palette.secondary },
    line: { color: palette.secondary },
  });

  const cx = area.x + area.w / 2;
  const cy = area.y + area.h / 2;
  const sizes = [0.9, 0.7, 0.5, 0.3, 0.15];
  const transparencies = [70, 55, 40, 25, 10];

  sizes.forEach((ratio, i) => {
    const size = Math.min(area.w, area.h) * ratio;
    slide.addShape("ellipse", {
      x: cx - size / 2,
      y: cy - size / 2,
      w: size,
      h: size,
      fill: { color: palette.accent, transparency: transparencies[i] },
      line: { color: palette.highlight, transparency: transparencies[i] + 10, width: 0.5 },
    });
  });
}

// ─── 3. Үшбұрыш паттерні ─────────────────────────────────────────────────────
function drawTrianglePattern(slide, area, palette) {
  slide.addShape("rect", {
    x: area.x, y: area.y, w: area.w, h: area.h,
    fill: { color: palette.primary },
    line: { color: palette.primary },
  });

  // Үлкен үшбұрыш (оң жақ)
  slide.addShape("triangle", {
    x: area.x + area.w * 0.3,
    y: area.y,
    w: area.w * 0.7,
    h: area.h,
    fill: { color: palette.secondary, transparency: 20 },
    line: { color: palette.secondary, transparency: 20 },
  });

  // Орта үшбұрыш
  slide.addShape("triangle", {
    x: area.x + area.w * 0.55,
    y: area.y + area.h * 0.2,
    w: area.w * 0.45,
    h: area.h * 0.6,
    fill: { color: palette.accent, transparency: 35 },
    line: { color: palette.accent, transparency: 35 },
  });

  // Кіші акцент үшбұрыш
  slide.addShape("triangle", {
    x: area.x + area.w * 0.1,
    y: area.y + area.h * 0.6,
    w: area.w * 0.25,
    h: area.h * 0.35,
    fill: { color: palette.highlight, transparency: 45 },
    line: { color: palette.highlight, transparency: 45 },
  });
}

// ─── 4. Диагональ блоктар ────────────────────────────────────────────────────
function drawDiagonalBlocks(slide, area, palette) {
  slide.addShape("rect", {
    x: area.x, y: area.y, w: area.w, h: area.h,
    fill: { color: palette.primary },
    line: { color: palette.primary },
  });

  // Диагональ жолақтар
  const stripeCount = 5;
  const stripeW = area.w / stripeCount;
  const colors = [
    palette.primary,
    palette.secondary,
    palette.accent,
    palette.secondary,
    palette.primary,
  ];
  const transparencies = [0, 20, 40, 20, 0];

  for (let i = 0; i < stripeCount; i++) {
    slide.addShape("parallelogram", {
      x: area.x + i * stripeW - area.h * 0.3,
      y: area.y,
      w: stripeW * 1.2,
      h: area.h,
      fill: { color: colors[i], transparency: transparencies[i] },
      line: { color: colors[i], transparency: transparencies[i] },
    }).catch?.(() => {
      // parallelogram жоқ болса rect қолданамыз
      slide.addShape("rect", {
        x: area.x + i * stripeW,
        y: area.y,
        w: stripeW,
        h: area.h,
        fill: { color: colors[i], transparency: transparencies[i] + 10 },
        line: { color: colors[i], transparency: transparencies[i] + 10 },
      });
    });
  }
}

// ─── 5. Концентрлік сақиналар ─────────────────────────────────────────────────
function drawConcentricRings(slide, area, palette) {
  slide.addShape("rect", {
    x: area.x, y: area.y, w: area.w, h: area.h,
    fill: { color: palette.primary },
    line: { color: palette.primary },
  });

  const cx = area.x + area.w * 0.65;
  const cy = area.y + area.h * 0.5;
  const ringCount = 5;

  for (let i = ringCount; i >= 1; i--) {
    const size = Math.min(area.w, area.h) * 0.18 * i;
    slide.addShape("ellipse", {
      x: cx - size / 2,
      y: cy - size / 2,
      w: size,
      h: size,
      fill: { color: palette.primary, transparency: 100 },
      line: { color: palette.accent, transparency: 20 + i * 10, width: 1.5 },
    });
  }

  // Орталық нүкте
  slide.addShape("ellipse", {
    x: cx - 0.15, y: cy - 0.15, w: 0.3, h: 0.3,
    fill: { color: palette.highlight, transparency: 0 },
    line: { color: palette.highlight },
  });
}

// ─── 6. Нүкте торы ───────────────────────────────────────────────────────────
function drawDotGrid(slide, area, palette) {
  slide.addShape("rect", {
    x: area.x, y: area.y, w: area.w, h: area.h,
    fill: { color: palette.secondary },
    line: { color: palette.secondary },
  });

  const cols = 8;
  const rows = 6;
  const dotW = area.w / (cols + 1);
  const dotH = area.h / (rows + 1);
  const dotR = Math.min(dotW, dotH) * 0.2;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const dist = Math.sqrt(
        Math.pow(c - cols / 2, 2) + Math.pow(r - rows / 2, 2)
      );
      const maxDist = Math.sqrt(Math.pow(cols / 2, 2) + Math.pow(rows / 2, 2));
      const transparency = Math.round((dist / maxDist) * 70);

      slide.addShape("ellipse", {
        x: area.x + dotW * (c + 0.8),
        y: area.y + dotH * (r + 0.8),
        w: dotR * 2,
        h: dotR * 2,
        fill: { color: palette.accent, transparency },
        line: { color: palette.accent, transparency },
      });
    }
  }
}

// ─── 7. Толқын сызықтар ──────────────────────────────────────────────────────
function drawWaveLines(slide, area, palette) {
  slide.addShape("rect", {
    x: area.x, y: area.y, w: area.w, h: area.h,
    fill: { color: palette.primary },
    line: { color: palette.primary },
  });

  const lineCount = 8;
  const step = area.h / (lineCount + 1);
  const colors = [palette.accent, palette.highlight, palette.secondary];

  for (let i = 0; i < lineCount; i++) {
    const y = area.y + step * (i + 1);
    const thickness = i % 3 === 0 ? 2.5 : 1;
    const transparency = 20 + i * 8;
    const color = colors[i % colors.length];

    slide.addShape("rect", {
      x: area.x,
      y: y - thickness / 72,
      w: area.w,
      h: thickness / 36,
      fill: { color, transparency },
      line: { color, transparency },
    });
  }

  // Акцент блогы
  slide.addShape("rect", {
    x: area.x + area.w * 0.6,
    y: area.y,
    w: area.w * 0.4,
    h: area.h,
    fill: { color: palette.secondary, transparency: 60 },
    line: { color: palette.secondary, transparency: 60 },
  });
}

// ─── 8. Абстракт полигондар ───────────────────────────────────────────────────
function drawAbstractPolygons(slide, area, palette) {
  slide.addShape("rect", {
    x: area.x, y: area.y, w: area.w, h: area.h,
    fill: { color: palette.primary },
    line: { color: palette.primary },
  });

  // Үлкен ромб
  slide.addShape("diamond", {
    x: area.x + area.w * 0.3,
    y: area.y + area.h * 0.1,
    w: area.w * 0.6,
    h: area.h * 0.8,
    fill: { color: palette.secondary, transparency: 25 },
    line: { color: palette.accent, transparency: 40, width: 1 },
  });

  // Кіші ромб
  slide.addShape("diamond", {
    x: area.x + area.w * 0.05,
    y: area.y + area.h * 0.3,
    w: area.w * 0.3,
    h: area.h * 0.4,
    fill: { color: palette.accent, transparency: 45 },
    line: { color: palette.highlight, transparency: 30, width: 0.75 },
  });

  // Акцент шеңбер
  slide.addShape("ellipse", {
    x: area.x + area.w * 0.65,
    y: area.y + area.h * 0.55,
    w: area.w * 0.25,
    h: area.w * 0.25,
    fill: { color: palette.highlight, transparency: 35 },
    line: { color: palette.highlight, transparency: 20 },
  });
}

module.exports = {
  applyFallbackVisual,
};
