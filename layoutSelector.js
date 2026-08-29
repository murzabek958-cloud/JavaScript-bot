'use strict';

/**
 * layoutSelector.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Deterministic layout selection.  No API calls, no randomness.
 *
 * Public API:
 *   selectLayout(slideContext, history)  → { layoutId, zones, imageRequirements, rules }
 *   validateLayout(layout, slideContext) → { valid, errors[] }
 *
 * Scoring:
 *   Each layout accumulates positive points for semantic match, image
 *   compatibility, text capacity, and diversity; then loses points for
 *   recency, incompatibility, and structural mismatch.
 *   The highest scorer wins.  Ties broken deterministically by layout ID order.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { getAllLayouts, getLayout } = require('./layoutLibrary');

// ─── Recency penalty configuration ───────────────────────────────────────────
// A layout used N slides ago loses this many points
const RECENCY_PENALTIES = [
  999, // just used (same slide) — effectively blocks re-use
  40,  // 1 slide ago
  20,  // 2 slides ago
  10,  // 3 slides ago
  4,   // 4 slides ago
  0,   // 5+ slides ago — no penalty
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(val, min, max) { return Math.min(Math.max(val, min), max); }

/**
 * How many slides ago was this layout last used?
 * @param {string[]} history  Array of layoutIds, most-recent last
 * @param {string} layoutId
 * @returns {number}  0 = never used, 1 = used last slide, etc.
 */
function slidesAgo(history, layoutId) {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i] === layoutId) return history.length - i;
  }
  return 0; // never used
}

/**
 * Check whether a layout's image count min/max is compatible with available images.
 */
function imageCompatible(layout, imageCountAvailable) {
  return (
    imageCountAvailable >= layout.imageCount.min &&
    imageCountAvailable <= layout.imageCount.max
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * scoreLayout(layout, ctx, history)
 * Returns a numeric score.  Higher = better match.
 *
 * @param {object} layout
 * @param {SlideContext} ctx
 * @param {string[]} history
 */
function scoreLayout(layout, ctx, history) {
  let score = 0;
  const {
    slideType,
    textAmount,
    imageCountAvailable,
    preferredImageCount,
    contentStructure,
    isImageImportant,
  } = ctx;

  // ── 1. Recency penalty ─────────────────────────────────────────────────────
  const ago = slidesAgo(history, layout.id);
  const penalty = ago === 0
    ? 0
    : RECENCY_PENALTIES[clamp(ago - 1, 0, RECENCY_PENALTIES.length - 1)];
  score -= penalty;

  // ── 2. Hard incompatibility — image count ─────────────────────────────────
  if (!imageCompatible(layout, imageCountAvailable)) {
    score -= 200; // Still allow it through for fallback resolution, but heavily penalised
  }

  // ── 3. Hard incompatibility — contentStructure ────────────────────────────
  if (layout.contentStructure && !layout.contentStructure.includes(contentStructure)) {
    score -= 30;
  }

  // ── 4. slideType semantic match ───────────────────────────────────────────
  if (layout.bestFor.includes(slideType)) {
    score += 30;
  } else {
    score -= 10;
  }

  // ── 5. textAmount capacity ────────────────────────────────────────────────
  if (layout.textAmount && layout.textAmount.includes(textAmount)) {
    score += 15;
  } else {
    // long text in a short-text layout: penalise heavily
    if (textAmount === 'long' && layout.textAmount && !layout.textAmount.includes('long')) {
      score -= 25;
    }
  }

  // ── 6. Image count match ──────────────────────────────────────────────────
  const imgDiff = Math.abs((preferredImageCount || imageCountAvailable) - layout.imageCount.min);
  score += Math.max(0, 20 - imgDiff * 8);

  // ── 7. Image importance ───────────────────────────────────────────────────
  if (isImageImportant) {
    if (layout.imageCount.min >= 1) score += 15;
    else score -= 10;
  }

  // ── 8. Specific content-structure bonuses ─────────────────────────────────
  const structureBonus = {
    statistics: { LAYOUT_11: 25, LAYOUT_20: 20 },
    comparison:  { LAYOUT_12: 25, LAYOUT_17: 15 },
    quote:       { LAYOUT_19: 30, LAYOUT_05: 10, LAYOUT_10: 10 },
    gallery:     { LAYOUT_08: 20, LAYOUT_21: 20, LAYOUT_18: 20, LAYOUT_16: 15, LAYOUT_13: 15 },
    steps:       { LAYOUT_16: 20, LAYOUT_08: 15 },
    bullets:     { LAYOUT_02: 5,  LAYOUT_03: 5,  LAYOUT_14: 5 },
    paragraph:   { LAYOUT_15: 10, LAYOUT_22: 5 },
  };
  const bonusMap = structureBonus[contentStructure] || {};
  score += bonusMap[layout.id] || 0;

  // ── 9. slideType-specific bonuses ─────────────────────────────────────────
  const typeBonus = {
    title:      { LAYOUT_01: 20, LAYOUT_10: 15, LAYOUT_09: 10 },
    section:    { LAYOUT_25: 25, LAYOUT_01: 15 },
    data:       { LAYOUT_20: 25, LAYOUT_11: 20 },
    comparison: { LAYOUT_12: 25, LAYOUT_17: 15 },
    quote:      { LAYOUT_19: 30 },
    end:        { LAYOUT_24: 20, LAYOUT_10: 15, LAYOUT_22: 10 },
    content:    { LAYOUT_02: 5,  LAYOUT_03: 5,  LAYOUT_14: 5,
                  LAYOUT_15: 5,  LAYOUT_06: 5 },
  };
  const typeBonusMap = typeBonus[slideType] || {};
  score += typeBonusMap[layout.id] || 0;

  // ── 10. Diversity bonus — layouts not yet used score extra ─────────────────
  if (ago === 0) score += 8; // never used in this deck

  return score;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} SlideContext
 * @property {'title'|'content'|'section'|'comparison'|'data'|'quote'|'end'} slideType
 * @property {'short'|'medium'|'long'} textAmount
 * @property {number} imageCountAvailable   0–4
 * @property {number} [preferredImageCount] 0–4 (defaults to imageCountAvailable)
 * @property {'paragraph'|'bullets'|'comparison'|'statistics'|'steps'|'gallery'|'quote'|'mixed'} contentStructure
 * @property {string} [previousLayout]      LAYOUT_xx (convenience; history preferred)
 * @property {boolean} [isImageImportant]   default false
 */

/**
 * Select the best layout for this slide.
 *
 * @param {SlideContext} slideContext
 * @param {string[]} history  Ordered list of layoutIds used so far, most-recent last.
 *                             Can be derived from deck's slide array.
 * @returns {{ layoutId, layout, imageRequirements, rules }}
 */
function selectLayout(slideContext, history = []) {
  const ctx = {
    preferredImageCount: slideContext.imageCountAvailable,
    isImageImportant: false,
    ...slideContext,
  };

  const all = getAllLayouts();
  const scored = Object.values(all).map(layout => ({
    layout,
    score: scoreLayout(layout, ctx, history),
  }));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.layout.id.localeCompare(b.layout.id); // deterministic tie-break
  });

  // Pick top scorer; if it's image-incompatible use its declared fallback
  let chosen = scored[0].layout;

  if (!imageCompatible(chosen, ctx.imageCountAvailable)) {
    chosen = resolveFallback(chosen, ctx.imageCountAvailable, scored, history);
  }

  const { imagePlanner } = require('./imagePlanner');
  const imageRequirements = imagePlanner(chosen.id, ctx);

  return {
    layoutId:          chosen.id,
    layout:            chosen,
    imageRequirements,
    rules:             buildRules(chosen),
  };
}

/**
 * Apply fallback logic: if the top layout can't satisfy imageCountAvailable,
 * use declared fallback keys or find the next-best compatible layout.
 */
function resolveFallback(layout, imageCount, scoredList, history) {
  // 1. Check layout's own declared fallback map
  const fallbackKey = `ifImages${imageCount}`;
  const fallbackId  = layout.fallback && layout.fallback[fallbackKey];
  if (fallbackId) {
    try { return getLayout(fallbackId); } catch (_) { /* ignore bad id */ }
  }

  // 2. Walk scored list top-down until we find a compatible layout
  for (const { layout: candidate } of scoredList) {
    if (imageCompatible(candidate, imageCount)) return candidate;
  }

  // 3. Ultimate fallback: LAYOUT_22 (text-only, always works)
  return getLayout('LAYOUT_22');
}

/**
 * Validate that a layout can actually render the given context.
 *
 * @param {object} layout   Result from getLayout()
 * @param {SlideContext} ctx
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateLayout(layout, ctx) {
  const errors = [];

  if (!imageCompatible(layout, ctx.imageCountAvailable)) {
    errors.push(
      `Layout ${layout.id} requires ${layout.imageCount.min}–${layout.imageCount.max} images ` +
      `but ${ctx.imageCountAvailable} available`
    );
  }

  if (ctx.textAmount === 'long' && layout.textAmount && !layout.textAmount.includes('long')) {
    errors.push(
      `Layout ${layout.id} does not support long text (supported: ${layout.textAmount.join(', ')})`
    );
  }

  if (!layout.bestFor.includes(ctx.slideType)) {
    errors.push(
      `Layout ${layout.id} is not designed for slide type '${ctx.slideType}' ` +
      `(designed for: ${layout.bestFor.join(', ')})`
    );
  }

  return { valid: errors.length === 0, errors };
}

// ─── Rules builder ─────────────────────────────────────────────────────────────
function buildRules(layout) {
  return {
    noOverlapPolicy:      'zones are pre-validated non-overlapping; renderer must not move elements',
    overflowPolicy:       'truncate text at maxChars; add ellipsis; never scale font below 50%',
    scalingPolicy:        'scale all coordinates proportionally; maintain aspect ratio',
    imagePolicy:          `crop mode: ${[...new Set(
      Object.values(layout.zones)
        .filter(z => z.type === 'image')
        .map(z => z.crop)
    )].join('/')}; never stretch; never duplicate image to fill multiple zones`,
    textOverImagePolicy:  'text over image only in zones with explicit overlay defined',
    noListPolicy:         'use bullets only when contentStructure === "bullets"',
    responsiveBreakpoints: { '100%': 1.0, '75%': 0.75, '50%': 0.5 },
  };
}

module.exports = { selectLayout, validateLayout };
