// sim/layout.mjs -- where the HUD strip, toolbar and field go in a viewport.
// Pure (numbers in, numbers out) so the headless solver uses the same layout
// as the browser.
//
// Portrait (h >= w): a slim HUD strip across the top and the toolbar across the
// bottom. Landscape: a HUD column on the left and the toolbar on the right.
// Then the field's bounding box is fitted into what's left, centred, with
// square cells. The toolbar's space is reserved from milestone 1 so pacing
// doesn't change when moves arrive.

export const HUD_STRIP_PX = 72;        // portrait: top strip height
export const TOOLBAR_STRIP_PX = 84;    // portrait: bottom toolbar height
export const HUD_COL_PX = 200;         // landscape: left column width
export const TOOLBAR_COL_PX = 100;     // landscape: right column width
export const HUD_COL_SMALL_PX = 150;   // landscape phones (short viewports): at least...
export const HUD_COL_SMALL_MAX_PX = 210; // ...and up to this, from width the field can't use
export const TOOLBAR_COL_SMALL_PX = 84;
export const TOP_PAD_SHARE = 1.6;      // landscape: of the 2 x pad round the field, this much goes on top

// bounds: the shape's real extent in cells ({ x0, y0, x1, y1 }, from
// shapeBounds() in levels.mjs). The cells are sized and centred on it, so a
// shape that doesn't fill its grid (field 14's islands) isn't fitted to empty
// rows. Defaults to the whole fieldW x fieldH grid.
export function computeLayout(vw, vh, fieldW, fieldH, insets = {}, bounds = null) {
  const top = insets.top || 0, right = insets.right || 0;
  const bottom = insets.bottom || 0, left = insets.left || 0;
  const portrait = vh >= vw;
  const small = Math.min(vw, vh) < 500;
  const pad = small ? 12 : 24;
  let hud, toolbar, area;
  if (portrait) {
    hud = { x: left, y: top, w: vw - left - right, h: HUD_STRIP_PX };
    toolbar = { x: left, y: vh - bottom - TOOLBAR_STRIP_PX, w: vw - left - right, h: TOOLBAR_STRIP_PX };
    area = { x: left + pad, y: hud.y + hud.h + pad, w: vw - left - right - 2 * pad,
      h: toolbar.y - pad - (hud.y + hud.h + pad) };
  } else {
    const tc = small ? TOOLBAR_COL_SMALL_PX : TOOLBAR_COL_PX;
    // A phone on its side: the HUD column takes the width the field can't
    // use (a field is about as wide as it's tall), so the name and meter read.
    const bw0 = bounds ? bounds.x1 - bounds.x0 : fieldW, bh0 = bounds ? bounds.y1 - bounds.y0 : fieldH;
    const fieldNeedW = (vh - top - bottom - 2 * pad) * (bw0 / bh0);
    const hc = small
      ? Math.round(Math.max(HUD_COL_SMALL_PX, Math.min(HUD_COL_SMALL_MAX_PX, vw - left - right - tc - 2 * pad - fieldNeedW)))
      : HUD_COL_PX;
    hud = { x: left, y: top, w: hc, h: vh - top - bottom };
    toolbar = { x: vw - right - tc, y: top, w: tc, h: vh - top - bottom };
    // The top row's tufts spill up out of the field (tall grass by about a
    // cell) and nothing spills down: more of the padding goes above the field
    // than below, so the tufts aren't cut by the window's top. The area's
    // height (and so the cell size) is the same.
    area = { x: hud.x + hud.w + pad, y: top + pad * TOP_PAD_SHARE, w: toolbar.x - pad - (hud.x + hud.w + pad),
      h: vh - top - bottom - 2 * pad };
  }
  area.w = Math.max(1, area.w); area.h = Math.max(1, area.h);
  const b = bounds || { x0: 0, y0: 0, x1: fieldW, y1: fieldH };
  const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
  const cell = Math.min(area.w / bw, area.h / bh);
  const fw = cell * fieldW, fh = cell * fieldH;
  // The grid's origin, placed so the shape's bounds are centred in the area.
  const field = {
    x: area.x + (area.w - bw * cell) / 2 - b.x0 * cell,
    y: area.y + (area.h - bh * cell) / 2 - b.y0 * cell,
    w: fw, h: fh,
  };
  return {
    vw, vh, portrait, hud, toolbar, area, field, cell,
    shortSide: Math.min(fw, fh),
    bounds: b,
  };
}

export const LAYOUTS = Object.freeze({
  phone: Object.freeze({ vw: 390, vh: 844, pointerType: 'touch' }),
  desktop: Object.freeze({ vw: 1280, vh: 800, pointerType: 'mouse' }),
});
