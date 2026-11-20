// share/flow.mjs -- how a share goes out (GAME_DESIGN.md "Screens", Share):
// Web Share with the scorecard picture, then Web Share with the text and
// link, then the clipboard (with a toast), then a download card. A share the
// player cancels (AbortError) stops there. No DOM of its own: the browser's
// pieces come in through `env`, so it runs (and is tested) anywhere.

export const SHARE_FILE_NAME = 'touch-grass-score.png';

const aborted = (e) => !!e && (e.name === 'AbortError');

// card: { blob (PNG) | null, title, text, url }
// env: { nav (navigator), File, toast(text), showDownload(card) }
// Returns 'file' | 'link' | 'copied' | 'download' | 'aborted'.
export async function runShare(card, env) {
  const nav = env.nav || {};
  const { title, text, url, blob } = card;
  if (typeof nav.share === 'function') {
    if (blob && typeof nav.canShare === 'function' && env.File) {
      let file = null;
      try { file = new env.File([blob], SHARE_FILE_NAME, { type: 'image/png' }); } catch { file = null; }
      let can = false;
      try { can = !!file && nav.canShare({ files: [file] }); } catch { can = false; }
      if (can) {
        try {
          await nav.share({ files: [file], title, text, url });
          return 'file';
        } catch (e) {
          if (aborted(e)) return 'aborted';
        }
      }
    }
    try {
      await nav.share({ title, text, url });
      return 'link';
    } catch (e) {
      if (aborted(e)) return 'aborted';
    }
  }
  if (nav.clipboard && typeof nav.clipboard.writeText === 'function') {
    try {
      await nav.clipboard.writeText(`${text} ${url}`);
      if (env.toast) env.toast('Link copied');
      return 'copied';
    } catch { /* blocked: fall through */ }
  }
  if (env.showDownload) env.showDownload(card);
  return 'download';
}
