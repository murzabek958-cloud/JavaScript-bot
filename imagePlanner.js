'use strict';

/**
 * imagePlanner.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Deterministic image planning layer.
 *
 * Given a layoutId and a SlideContext (which includes the slide's content
 * fields), this module returns structured image requirements — one entry per
 * image zone — telling the asset pipeline exactly what to fetch and how to
 * use each image.
 *
 * Gemini (or any LLM) is allowed to contribute ONLY the `queryIntent` field
 * by returning a short phrase describing the visual concept (e.g. "baobab tree
 * silhouette against sunset sky").  All other fields are determined here.
 *
 * Public API:
 *   imagePlanner(layoutId, slideContext)  → ImageRequirement[]
 *   imageFallbackPlan(layoutId, availableCount) → { resolvedLayoutId, drop[] }
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { getLayout } = require('./layoutLibrary');

// ─── Role definitions ──────────────────────────────────────────────────────────
// Each role carries rendering guidance that htmlGen.js uses.
const ROLES = {
  hero:       { label: 'hero',       importance: 'primary',   note: 'Dominant, full-attention image' },
  supporting: { label: 'supporting', importance: 'secondary', note: 'Context-setting visual' },
  detail:     { label: 'detail',     importance: 'secondary', note: 'Close-up or specific specimen' },
  portrait:   { label: 'portrait',   importance: 'primary',   note: 'Person or face, preferably circular crop' },
  texture:    { label: 'texture',    importance: 'secondary', note: 'Background texture or atmosphere' },
  chart:      { label: 'chart',      importance: 'primary',   note: 'Placeholder for data visualisation' },
};

// ─── Zone role map per layout ──────────────────────────────────────────────────
// Defines which role each image zone plays for each layout.
// The `queryHint` is a template string; slide content values should be
// interpolated before passing to the image search API.
const ZONE_ROLES = {
  LAYOUT_01: {
    image_1: { role: 'hero',   queryHint: 'cinematic wide-angle photograph of {topic}',
                position: 'center', crop: 'cover' },
  },
  LAYOUT_02: {
    image_1: { role: 'supporting', queryHint: 'editorial photograph of {topic}',
                position: 'center', crop: 'cover' },
  },
  LAYOUT_03: {
    image_1: { role: 'supporting', queryHint: 'editorial photograph of {topic}',
                position: 'center', crop: 'cover' },
  },
  LAYOUT_04: {
    image_1: { role: 'hero', queryHint: 'large-format artistic photograph of {topic}',
                position: 'center', crop: 'cover' },
  },
  LAYOUT_05: {
    image_1: { role: 'texture', queryHint: 'atmospheric background photograph of {topic}',
                position: 'center', crop: 'cover' },
  },
  LAYOUT_06: {
    image_1: { role: 'hero', queryHint: 'wide panoramic photograph of {topic}',
                position: 'top', crop: 'cover' },
  },
  LAYOUT_07: {
    image_1: { role: 'supporting', queryHint: 'landscape or establishing shot of {topic}',
                position: 'bottom', crop: 'cover' },
  },
  LAYOUT_08: {
    // Three DISTINCT visual concepts derived from the slide content — NOT duplicates
    image_1: { role: 'detail',     queryHint: '{imageQuery_1}', position: 'center', crop: 'cover' },
    image_2: { role: 'detail',     queryHint: '{imageQuery_2}', position: 'center', crop: 'cover' },
    image_3: { role: 'detail',     queryHint: '{imageQuery_3}', position: 'center', crop: 'cover' },
  },
  LAYOUT_09: {
    image_1: { role: 'hero', queryHint: 'clean product or concept photograph of {topic}',
                position: 'center', crop: 'cover' },
  },
  LAYOUT_13: {
    image_1: { role: 'detail', queryHint: '{imageQuery_1}', position: 'center', crop: 'cover' },
    image_2: { role: 'detail', queryHint: '{imageQuery_2}', position: 'center', crop: 'cover' },
    image_3: { role: 'detail', queryHint: '{imageQuery_3}', position: 'center', crop: 'cover' },
    image_4: { role: 'detail', queryHint: '{imageQuery_4}', position: 'center', crop: 'cover' },
  },
  LAYOUT_14: {
    image_1: { role: 'supporting', queryHint: 'contextual photograph for {topic}',
                position: 'center', crop: 'cover' },
  },
  LAYOUT_15: {
    image_1: { role: 'supporting', queryHint: 'editorial photograph of {topic}',
                position: 'center', crop: 'cover' },
  },
  LAYOUT_16: {
    image_1: { role: 'detail', queryHint: '{imageQuery_1}', position: 'center', crop: 'cover' },
    image_2: { role: 'detail', queryHint: '{imageQuery_2}', position: 'center', crop: 'cover' },
    image_3: { role: 'detail', queryHint: '{imageQuery_3}', position: 'center', crop: 'cover' },
  },
  LAYOUT_17: {
    image_1: { role: 'hero',       queryHint: '{imageQuery_1}', position: 'center', crop: 'cover' },
    image_2: { role: 'supporting', queryHint: '{imageQuery_2}', position: 'center', crop: 'cover' },
  },
  LAYOUT_18: {
    image_1: { role: 'detail', queryHint: '{imageQuery_1}', position: 'center', crop: 'cover' },
    image_2: { role: 'detail', queryHint: '{imageQuery_2}', position: 'center', crop: 'cover' },
    image_3: { role: 'detail', queryHint: '{imageQuery_3}', position: 'center', crop: 'cover' },
  },
  LAYOUT_19: {
    image_1: { role: 'portrait', queryHint: 'portrait photograph of {subject}',
                position: 'center', crop: 'cover' },
  },
  LAYOUT_20: {
    image_1: { role: 'chart', queryHint: null, // rendered by chartEngine, not fetched
                position: 'center', crop: 'contain' },
  },
  LAYOUT_21: {
    image_1: { role: 'hero',       queryHint: '{imageQuery_1}', position: 'center', crop: 'cover' },
    image_2: { role: 'supporting', queryHint: '{imageQuery_2}', position: 'center', crop: 'cover' },
    image_3: { role: 'detail',     queryHint: '{imageQuery_3}', position: 'center', crop: 'cover' },
  },
  LAYOUT_23: {
    image_1: { role: 'detail', queryHint: '{imageQuery_1}', position: 'center', crop: 'cover' },
    image_2: { role: 'detail', queryHint: '{imageQuery_2}', position: 'center', crop: 'cover' },
    image_3: { role: 'detail', queryHint: '{imageQuery_3}', position: 'center', crop: 'cover' },
    image_4: { role: 'detail', queryHint: '{imageQuery_4}', position: 'center', crop: 'cover' },
  },
  LAYOUT_24: {
    image_1: { role: 'hero', queryHint: 'evocative closing photograph for {topic}',
                position: 'center', crop: 'cover' },
  },
  LAYOUT_25: {
    image_1: { role: 'texture', queryHint: 'dark moody texture or landscape for {topic}',
                position: 'center', crop: 'cover' },
  },
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve template placeholders in a query hint.
 * Callers pass content.imageQueries[] from the slide content object.
 *
 * @param {string} hint
 * @param {object} ctx   SlideContext enriched with { topic, subject, imageQueries[] }
 */
function resolveHint(hint, ctx) {
  if (!hint) return null;
  let out = hint;
  out = out.replace('{topic}',   ctx.topic   || ctx.slideTitle || 'the subject');
  out = out.replace('{subject}', ctx.subject || ctx.topic      || 'the person');
  // numbered image queries — supplied by LLM or content pipeline
  if (ctx.imageQueries && Array.isArray(ctx.imageQueries)) {
    ctx.imageQueries.forEach((q, i) => {
      out = out.replace(`{imageQuery_${i + 1}}`, q);
    });
  }
  return out;
}

/**
 * Build the ImageRequirement array for a given layout and context.
 *
 * @param {string} layoutId
 * @param {SlideContext & { topic?, subject?, imageQueries? }} ctx
 * @returns {ImageRequirement[]}
 */
function imagePlanner(layoutId, ctx) {
  const layout   = getLayout(layoutId);
  const zoneRoles = ZONE_ROLES[layoutId] || {};

  // Collect image zones from layout definition
  const imageZones = Object.entries(layout.zones)
    .filter(([, zone]) => zone.type === 'image')
    .map(([zoneName]) => zoneName);

  if (imageZones.length === 0) return [];

  return imageZones.map(zoneName => {
    const zoneConfig = zoneRoles[zoneName] || {};
    const role       = ROLES[zoneConfig.role || 'supporting'];
    const zone       = layout.zones[zoneName];

    return {
      zone:        zoneName,
      role:        role.label,
      importance:  role.importance,
      queryIntent: resolveHint(zoneConfig.queryHint, ctx),
      crop:        zoneConfig.crop  || zone.crop     || 'cover',
      position:    zoneConfig.position || zone.position || 'center',
      dimensions:  { w: zone.w, h: zone.h },
      borderRadius: zone.borderRadius,
      overlay:     zone.overlay,
      note:        role.note,
      // Special flag: this zone is rendered by the chart engine, not an image fetch
      isChartZone: zoneConfig.role === 'chart',
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// FALLBACK PLAN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Given a layout and an actual available image count, decide:
 *   - whether to keep the layout (if compatible)
 *   - which layout to switch to (if not compatible)
 *   - which image zones to drop (when switching to a layout needing fewer images)
 *
 * @param {string}  layoutId
 * @param {number}  availableCount  0–4
 * @returns {{ resolvedLayoutId: string, switchRequired: boolean, droppedZones: string[] }}
 */
function imageFallbackPlan(layoutId, availableCount) {
  const layout = getLayout(layoutId);
  const { min, max } = layout.imageCount;

  // Already compatible
  if (availableCount >= min && availableCount <= max) {
    return { resolvedLayoutId: layoutId, switchRequired: false, droppedZones: [] };
  }

  // Use declared fallback key
  const key = `ifImages${availableCount}`;
  if (layout.fallback && layout.fallback[key]) {
    return {
      resolvedLayoutId: layout.fallback[key],
      switchRequired:   true,
      droppedZones:     [],
    };
  }

  // Generic fallback matrix
  const matrix = {
    //  available → fallback
    0: ['LAYOUT_10', 'LAYOUT_11', 'LAYOUT_12', 'LAYOUT_22'],
    1: ['LAYOUT_01', 'LAYOUT_02', 'LAYOUT_03', 'LAYOUT_09', 'LAYOUT_07', 'LAYOUT_24'],
    2: ['LAYOUT_17'],
    3: ['LAYOUT_08', 'LAYOUT_16', 'LAYOUT_18', 'LAYOUT_21'],
    4: ['LAYOUT_13', 'LAYOUT_23'],
  };

  const candidates = matrix[availableCount] || ['LAYOUT_22'];

  return {
    resolvedLayoutId: candidates[0],
    switchRequired:   true,
    droppedZones:     [],
  };
}

module.exports = { imagePlanner, imageFallbackPlan, ROLES, ZONE_ROLES };
