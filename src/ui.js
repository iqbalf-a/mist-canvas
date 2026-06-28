/**
 * ui.js — Minimal HUD bindings: breath indicator, reset button, loading screen.
 */

export function setupUI(onReset) {
  const dot         = document.getElementById('breath-dot');
  const label       = document.getElementById('breath-label');
  const btn         = document.getElementById('reset-btn');
  const loadingEl   = document.getElementById('loading');
  const loadingText = document.getElementById('loading-text');

  btn.addEventListener('click', onReset);
  document.addEventListener('keydown', e => {
    if (e.key === 'r' || e.key === 'R') onReset();
  });

  return {
    /** Update loading overlay text. */
    setStatus(msg) {
      loadingText.textContent = msg;
    },

    /** Fade out and remove loading overlay. */
    hideLoading() {
      loadingEl.classList.add('hidden');
      setTimeout(() => { loadingEl.style.display = 'none'; }, 750);
    },

    /**
     * Toggle breath indicator.
     * @param {boolean} active
     * @param {number}  value  0–1 jaw-open score
     */
    setBreathing(active, value = 0) {
      if (active) {
        dot.classList.add('active');
        label.textContent = `Nafas: ${Math.round(value * 100)} %`;
      } else {
        dot.classList.remove('active');
        label.textContent = 'Hembuskan nafas ke kamera';
      }
    },
  };
}
