/**
 * main.js — Entry point.
 *
 * Canvas stack:
 *   bgCanvas  — clear mirrored camera (always redrawn)
 *   fogCanvas — blurred camera + tint, clipped to fog mask (via GlassEffect)
 */

import { setupCamera }                             from './camera.js';
import { initLandmarkers, detectFace, detectHand } from './tracking.js';
import { GlassEffect }                             from './glass.js';
import { setupUI }                                 from './ui.js';

const JAW_THRESHOLD  = 0.1;
const LERP           = 0.22;

async function main() {
  const video     = document.getElementById('video');
  const bgCanvas  = document.getElementById('bg-canvas');
  const fogCanvas = document.getElementById('fog-canvas');
  const bgCtx     = bgCanvas.getContext('2d');

  const glass = new GlassEffect(fogCanvas);

  let smoothX = null, smoothY = null;
  let prevX   = null, prevY   = null;
  let pointBuf = 0;  // hysteresis counter — butuh 2 frame berturut untuk aktif

  function resetFinger() { smoothX = smoothY = prevX = prevY = null; pointBuf = 0; }

  const ui = setupUI(() => { glass.reset(); resetFinger(); });

  function resize() {
    bgCanvas.width  = window.innerWidth;
    bgCanvas.height = window.innerHeight;
    glass.resize();
  }
  window.addEventListener('resize', resize);
  resize();

  ui.setStatus('Memulai kamera…');
  await setupCamera(video);

  const { faceLandmarker, handLandmarker } = await initLandmarkers(s => ui.setStatus(s));
  ui.setStatus('Siap!');
  ui.hideLoading();

  let lastTs = 0;

  function loop(now) {
    requestAnimationFrame(loop);
    const ts = Math.floor(now);
    if (ts <= lastTs) return;
    lastTs = ts;

    const W = window.innerWidth;
    const H = window.innerHeight;

    // 1. Clear camera on background (sharp, no blur)
    bgCtx.save();
    bgCtx.translate(W, 0);
    bgCtx.scale(-1, 1);
    bgCtx.drawImage(video, 0, 0, W, H);
    bgCtx.restore();

    // 2. Face → breath fog
    const { jawOpen, mouthCenter } = detectFace(faceLandmarker, video, ts);
    const isBreathing = jawOpen > JAW_THRESHOLD;
    ui.setBreathing(isBreathing, jawOpen);

    if (isBreathing && mouthCenter) {
      const cx = (1 - mouthCenter.x) * W;
      const cy = mouthCenter.y * H;
      const intensity = (jawOpen - JAW_THRESHOLD) / (1 - JAW_THRESHOLD);
      glass.breathe(cx, cy, intensity);
    }

    // 3. Hand → draw (reset hanya via tombol R / UI)
    const { indexTip, isPointing } = detectHand(handLandmarker, video, ts);

    // Hysteresis: aktif setelah 2 frame isPointing berturut, mati langsung saat berhenti
    if (isPointing) pointBuf = Math.min(pointBuf + 1, 3);
    else            pointBuf = 0;

    if (pointBuf >= 2 && indexTip) {
      const rawX = (1 - indexTip.x) * W;
      const rawY = indexTip.y * H;

      if (smoothX === null) { smoothX = rawX; smoothY = rawY; }
      else {
        smoothX += (rawX - smoothX) * LERP;
        smoothY += (rawY - smoothY) * LERP;
      }

      glass.drawStroke(smoothX, smoothY, prevX, prevY);
      prevX = smoothX;
      prevY = smoothY;
    } else {
      prevX = prevY = null;
      smoothX = smoothY = null;
    }

    // 4. Composite fog (blurred camera clipped to mask) onto fogCanvas
    glass.render(video, W, H);
  }

  requestAnimationFrame(loop);
}

main().catch(err => {
  console.error('[Embun] Fatal:', err);
  const el = document.getElementById('loading-text');
  if (el) el.textContent = `Error: ${err.message}`;
});
