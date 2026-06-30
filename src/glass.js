/**
 * glass.js — Fogged-glass effect.
 *
 * Architecture (3 canvas layers):
 *   bgCanvas      (caller)  — clear mirrored camera feed
 *   _maskCanvas   (hidden)  — fog shape: opaque where fog is, transparent where drawn
 *   fogCanvas     (visible) — per-frame composite: blurred camera clipped to mask + tint
 *
 * Result: background is sharp where no fog, blurred + tinted where fog exists.
 */

const FOG          = { r: 210, g: 220, b: 232 };
const BLUR         = '16px';
const TINT         = 0.42;
const BRUSH        = 12;
const MAX_DROPLETS = 5;
const DRIP_CHANCE  = 0.04;  // probability per drawStroke call to spawn a droplet

export class GlassEffect {
  constructor(fogCanvas) {
    this._fog  = fogCanvas;
    this._fCtx = fogCanvas.getContext('2d');

    this._mask  = document.createElement('canvas');
    this._mCtx  = this._mask.getContext('2d');

    this._blur  = document.createElement('canvas');
    this._bCtx  = this._blur.getContext('2d');

    this._droplets = [];

    this._sync();
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  resize() { this._sync(); this.reset(); }

  reset() {
    this._mCtx.clearRect(0, 0, this._mask.width, this._mask.height);
    this._droplets = [];
  }

  // ── Per-frame render ──────────────────────────────────────────────────────

  render(video, W, H) {
    // Animate droplets on mask before compositing
    this._tickDroplets();

    // 1. Blurred camera to offscreen
    const bCtx = this._bCtx;
    bCtx.filter = `blur(${BLUR}) brightness(0.92)`;
    bCtx.save();
    bCtx.translate(W, 0);
    bCtx.scale(-1, 1);
    bCtx.drawImage(video, 0, 0, W, H);
    bCtx.restore();
    bCtx.filter = 'none';

    // 2. Compose fogCanvas = (blurred camera + tint) clipped to fog mask
    const ctx = this._fCtx;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(this._blur, 0, 0);

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(${FOG.r}, ${FOG.g}, ${FOG.b}, ${TINT})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(this._mask, 0, 0);
    ctx.restore();
  }

  // ── Fog manipulation ──────────────────────────────────────────────────────

  breathe(cx, cy, intensity) {
    const ctx    = this._mCtx;
    const radius = 220 + intensity * 150;
    const alpha  = intensity * 0.52;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    g.addColorStop(0,    `rgba(255,255,255,${alpha})`);
    g.addColorStop(0.45, `rgba(255,255,255,${alpha * 0.4})`);
    g.addColorStop(1,    'rgba(255,255,255,0)');

    ctx.fillStyle = g;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.restore();
  }

  drawStroke(x, y, prevX, prevY, r = BRUSH) {
    const ctx = this._mCtx;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';

    if (prevX !== null && prevY !== null) {
      const dist  = Math.hypot(x - prevX, y - prevY);
      const steps = Math.max(1, Math.ceil(dist / (r * 0.35)));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        this._dot(ctx, prevX + (x - prevX) * t, prevY + (y - prevY) * t, r);
      }
    } else {
      this._dot(ctx, x, y, r);
    }

    ctx.restore();

    // Sesekali tumbuhkan tetesan air di posisi brush
    this._maybeSpawnDroplet(x, y);
  }

  // ── Private: droplet system ───────────────────────────────────────────────

  _maybeSpawnDroplet(x, y) {
    if (this._droplets.length >= MAX_DROPLETS) return;
    if (Math.random() > DRIP_CHANCE) return;

    this._droplets.push({
      x,
      y: y + BRUSH * 0.5,          // mulai sedikit di bawah brush
      vy: 0.5 + Math.random() * 0.7, // kecepatan jatuh awal
      vx: (Math.random() - 0.5) * 0.4,
      r:  3 + Math.random() * 9,   // ukuran bervariasi: tetes kecil s/d besar
      life: 1.0,
      trail: [],                    // rekam posisi sebelumnya untuk ekor
    });
  }

  _tickDroplets() {
    if (!this._droplets.length) return;

    const ctx = this._mCtx;
    const H   = this._mask.height;

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';

    this._droplets = this._droplets.filter(d => {
      // Gambar ekor — makin ke belakang makin tipis & transparan
      for (let i = 1; i < d.trail.length; i++) {
        const progress = i / d.trail.length;
        const tr = d.r * 0.15 * progress;  // ekor jauh lebih tipis dari kepala
        if (tr < 0.8) continue;
        ctx.globalAlpha = progress * d.life * 0.75;
        ctx.beginPath();
        ctx.arc(d.trail[i].x, d.trail[i].y, tr, 0, Math.PI * 2);
        ctx.fill();
      }

      // Gambar kepala tetes — soft circle seperti brush utama
      ctx.globalAlpha = d.life;
      const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r);
      g.addColorStop(0,   'rgba(0,0,0,1)');
      g.addColorStop(0.5, 'rgba(0,0,0,0.7)');
      g.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();

      // Simpan posisi untuk ekor, batasi panjang
      d.trail.push({ x: d.x, y: d.y });
      if (d.trail.length > 12) d.trail.shift();

      // Fisika: percepatan gravitasi, sedikit gesekan lateral
      d.y  += d.vy;
      d.x  += d.vx;
      d.vy  = Math.min(d.vy + 0.04, 2.5); // gravitasi lambat, max speed rendah
      d.vx *= 0.97;                         // redaman lateral
      d.life -= 0.018;                      // pudar cepat — jarak pendek

      return d.life > 0 && d.y < H + 40;
    });

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ── Private: drawing helpers ──────────────────────────────────────────────

  _sync() {
    const W = window.innerWidth, H = window.innerHeight;
    this._fog.width = W;  this._fog.height = H;
    this._mask.width = W; this._mask.height = H;
    this._blur.width = W; this._blur.height = H;
  }

  _dot(ctx, x, y, r) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0,    'rgba(0,0,0,1)');
    g.addColorStop(0.38, 'rgba(0,0,0,0.85)');
    g.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}
