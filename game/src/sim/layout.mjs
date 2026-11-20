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
export const HUD_COL_SMALL_PX = 150;   // landscape phones (short viewports)
export const TOOLBAR_COL_SMALL_PX = 84;

export function computeLayout(vw, vh, fieldW, fieldH, insets = {}) {
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
    const hc = small ? HUD_COL_SMALL_PX : HUD_COL_PX;
    const tc = small ? TOOLBAR_COL_SMALL_PX : TOOLBAR_COL_PX;
    hud = { x: left, y: top, w: hc, h: vh - top - bottom };
    toolbar = { x: vw - right - tc, y: top, w: tc, h: vh - top - bottom };
    area = { x: hud.x + hud.w + pad, y: top + pad, w: toolbar.x - pad - (hud.x + hud.w + pad),
      h: vh - top - bottom - 2 * pad };
  }
  area.w = Math.max(1, area.w); area.h = Math.max(1, area.h);
  const cell = Math.min(area.w / fieldW, area.h / fieldH);
  const fw = cell * fieldW, fh = cell * fieldH;
  const field = { x: area.x + (area.w - fw) / 2, y: area.y + (area.h - fh) / 2, w: fw, h: fh };
  return {
    vw, vh, portrait, hud, toolbar, area, field, cell,
    shortSide: Math.min(fw, fh),
  };
}

export const LAYOUTS = Object.freeze({
  phone: Object.freeze({ vw: 390, vh: 844, pointerType: 'touch' }),
  desktop: Object.freeze({ vw: 1280, vh: 800, pointerType: 'mouse' }),
});
