'use strict';

/**
 * slideBuilder.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Builds the complete slide data model consumed by htmlGen.js / renderer.js.
 *
 * Responsibilities:
 *   1. Accept raw slide content (from Gemini output or a static content plan)
 *   2. Select a layout (via layoutSelector)
 *   3. Map content fields to layout zones
 *   4. Apply typography, overflow, and image rules
 *   5. Return a fully resolved SlideModel
 *
 * Gemini is allowed to produce:
 *   - slideType, textAmount, contentStructure
 *   - content strings (title, body, etc.)
 *   - imageQueries[] (short visual concept descriptions)
 *   - topic / subject
 *
 * Gemini must NOT produce:
 *   - pixel coordinates
 *   - CSS
 *   - HTML
 *   - layout decisions
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { selectLayout, validateLayout } = require('./layoutSelector');
const { getLayout, CANVAS }            = require('./layoutLibrary');

// ─── Content field map ─────────────────────────────────────────────────────────
// Maps SlideContent keys to layout zone keys.
// A zone that's missing in a layout is simply skipped.
const CONTENT_FIELD_MAP = {
  title:       ['title', 'title_main'],
  subtitle:    ['subtitle'],
  body:        ['body', 'body_left'],     // body_right filled from body2
  body2:       ['body_right'],
  label:       ['label', 'label_1'],
  label2:      ['label_2'],
  label3:      ['label_3'],
  statistic:   ['statistic'],
  quoteText:   ['quote_text'],
  attribution: ['attribution'],
  caption:     ['subtitle', 'attribution'], // fallback caption
  // Column content for 3-column and 4-card layouts:
  title1:      ['title_1'],
  title2:      ['title_2'],
  title3:      ['title_3'],
  body1:       ['body_1'],
  body2_col:   ['body_2'],
  body3:       ['body_3'],
  body4:       ['body_4'],
  // VS layout
  titleLeft:   ['title_left'],
  titleRight:  ['title_right'],
  bodyLeft:    ['body_left'],
  bodyRight:   ['body_right'],
  // Stat layout
  stat1:       ['stat_1'],
  stat2:       ['stat_2'],
};

// ─── Truncation ────────────────────────────────────────────────────────────────

function inferTextAmount(slide) {
  const totalChars =
    String(slide.title || '').length +
    String(slide.subtitle || '').length +
    (Array.isArray(slide.content)
      ? slide.content.join(' ').length
      : String(slide.content || '').length);

  if (totalChars > 700) return 'long';
  if (totalChars > 300) return 'medium';
  return 'short';
}

function inferContentStructure(slide) {
  const type = slide.type;

  if (type === 'comparison') return 'comparison';
  if (type === 'data') return 'statistics';
  if (type === 'quote') return 'quote';
  if (type === 'title') return 'paragraph';
  if (type === 'end') return 'paragraph';

  if (Array.isArray(slide.content) && slide.content.length >= 3) {
    return 'bullets';
  }

  return 'paragraph';
}

function normalizeGeminiSlide(slide, index) {
  const imageQueries = [];

  if (slide.image_query) {
    imageQueries.push(slide.image_query);
  }

  return {
    content: {
      title: slide.title || `Слайд ${index + 1}`,
      subtitle: slide.subtitle || null,
      body: Array.isArray(slide.content)
        ? slide.content.join('\n')
        : (slide.content || ''),
      topic: slide.topic || '',
      subject: slide.subject || '',
      imageQueries,
    },

    context: {
      slideType: slide.type || 'content',
      textAmount: inferTextAmount(slide),
      imageCountAvailable: slide.image_query ? 1 : 0,
      preferredImageCount: slide.image_query ? 1 : 0,
      contentStructure: inferContentStructure(slide),
      isImageImportant: Boolean(slide.image_query),
    },
  };
}

function truncate(str, maxChars) {
  if (!str || str.length <= maxChars) return str || '';
  return str.slice(0, maxChars - 1).trimEnd() + '…';
}

// ─── Zone content mapper ───────────────────────────────────────────────────────
/**
 * Given a layout and a SlideContent object, produce the `content` field for
 * each zone in the layout.
 *
 * @param {object} layout
 * @param {SlideContent} content
 * @returns {object}  { [zoneName]: string }
 */
function mapContentToZones(layout, content) {
  const zoneContent = {};

  // Walk content fields → zone targets
  for (const [contentKey, zoneTargets] of Object.entries(CONTENT_FIELD_MAP)) {
    const value = content[contentKey];
    if (!value) continue;
    for (const zoneName of zoneTargets) {
      if (layout.zones[zoneName]) {
        const maxChars = layout.zones[zoneName].maxChars || 9999;
        zoneContent[zoneName] = truncate(String(value), maxChars);
      }
    }
  }

  return zoneContent;
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE MODEL BUILDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} SlideContent
 * @property {string}  [title]
 * @property {string}  [subtitle]
 * @property {string}  [body]
 * @property {string}  [body2]
 * @property {string}  [label]
 * @property {string}  [label2]
 * @property {string}  [label3]
 * @property {string}  [statistic]      For LAYOUT_11
 * @property {string}  [quoteText]      For LAYOUT_19
 * @property {string}  [attribution]    For LAYOUT_19
 * @property {string}  [caption]
 * @property {string}  [title1]         For 3-column layouts
 * @property {string}  [title2]
 * @property {string}  [title3]
 * @property {string}  [body1]
 * @property {string}  [body2_col]
 * @property {string}  [body3]
 * @property {string}  [body4]
 * @property {string}  [titleLeft]      For VS layout
 * @property {string}  [titleRight]
 * @property {string}  [bodyLeft]
 * @property {string}  [bodyRight]
 * @property {string}  [stat1]          For dashboard layout
 * @property {string}  [stat2]
 * @property {string}  [topic]          Used by imagePlanner for query resolution
 * @property {string}  [subject]        Used by imagePlanner for portrait query
 * @property {string[]} [imageQueries]  Specific visual concepts per image zone
 */

/**
 * @typedef {Object} SlideModel
 * @property {string}   slideId
 * @property {string}   layoutId
 * @property {{ w, h }} canvas
 * @property {object}   zones         Zone definitions from layout + resolved content
 * @property {object[]} imageRequirements
 * @property {object[]} layers        Z-index order
 * @property {object}   background
 * @property {object}   rules
 * @property {object}   meta
 */

/**
 * Build a single slide model.
 *
 * @param {object} opts
 * @param {string}       opts.slideId
 * @param {SlideContent} opts.content
 * @param {object}       opts.context   SlideContext fields (slideType, textAmount, etc.)
 * @param {string[]}     opts.history   layoutIds used so far
 * @param {string}       [opts.forceLayoutId]  Override layout selection (testing)
 * @returns {SlideModel}
 */
function buildSlide({ slideId, content, context, history = [], forceLayoutId = null }) {
  // 1. Select layout
  let layoutId, layout, imageRequirements, rules;

  if (forceLayoutId) {
    layoutId          = forceLayoutId;
    layout            = getLayout(forceLayoutId);
    const { imagePlanner } = require('./imagePlanner');
    imageRequirements = imagePlanner(layoutId, { ...context, ...content });
    const { validateLayout: vl } = require('./layoutSelector');
    ({ rules } = { rules: {} });
  } else {
    const selected    = selectLayout(context, history);
    layoutId          = selected.layoutId;
    layout            = selected.layout;
    imageRequirements = selected.imageRequirements;
    rules             = selected.rules;
  }

  // 2. Validate
  const { errors } = validateLayout(layout, context);
  if (errors.length > 0) {
    console.warn(`[slideBuilder] Slide ${slideId} layout warnings:`, errors);
  }

  // 3. Map content to zones
  const zoneContent = mapContentToZones(layout, content);

  // 4. Merge zone definitions with content
  const resolvedZones = {};
  for (const [zoneName, zoneDef] of Object.entries(layout.zones)) {
    resolvedZones[zoneName] = {
      ...zoneDef,
      content: zoneContent[zoneName] || null,
    };
  }

  // 5. Resolve image requirements with content-derived query intents
  const { imagePlanner } = require('./imagePlanner');
  const enrichedImageRequirements = imagePlanner(layoutId, {
    ...context,
    ...content,
  });

  return {
    slideId,
    layoutId,
    canvas:            CANVAS,
    zones:             resolvedZones,
    imageRequirements: enrichedImageRequirements,
    layers:            layout.layers,
    background:        layout.background,
    rules,
    meta: {
      layoutName:       layout.name,
      distinctiveId:    layout.distinctiveIdentity,
      slideType:        context.slideType,
      contentStructure: context.contentStructure,
      textAmount:       context.textAmount,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DECK BUILDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build all slides in a presentation, tracking layout history to enforce
 * visual diversity.
 *
 * @param {Array<{ content: SlideContent, context: SlideContext }>} slides
 * @returns {SlideModel[]}
 */
function buildDeck(slides) {
  const history = [];

  return slides.map((rawSlide, index) => {
    const normalized = rawSlide.content && rawSlide.context
      ? rawSlide
      : normalizeGeminiSlide(rawSlide, index);

    const model = buildSlide({
      slideId: `slide_${index + 1}`,
      content: normalized.content,
      context: normalized.context,
      history,
    });

    history.push(model.layoutId);

    return model;
  });
}

module.exports = {
  buildSlide,
  buildDeck,
  mapContentToZones,
  truncate,
  normalizeGeminiSlide,
};
