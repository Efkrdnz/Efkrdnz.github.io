/*
 * Crop full-screen Minecraft captures down to their subject.
 *
 * UI screenshots float a small System panel in the middle of a dark frame.
 * Finding it by bounding box fails: scattered cyan HUD icons at the frame edges
 * drag the box back out to full width, and percentile clipping does not help
 * because those strays are a real fraction of all cyan pixels.
 *
 * So instead: build column and row histograms of cyan density, find the peak,
 * and grow outward only while density stays above a fraction of that peak. That
 * isolates the dense central panel and ignores sparse edge decoration.
 *
 * Frames where the resulting box is most of the screen are world shots, and get
 * a centred band that drops the hotbar instead.
 *
 * Panels keep their own aspect ratio. Padding them out to a wide rectangle just
 * moves the problem downstream: the page then has a tall GUI inside a wide image
 * and crops the top off it.
 *
 * Usage: node scripts/crop-shots.cjs <dir> [--dry]
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const DIR = process.argv[2];
const DRY = process.argv.includes('--dry');
const MIN_ASPECT = 1.5;
const OUT_W = 1280;
const DENSITY_FLOOR = 0.1; // stop growing below 10% of peak density
const GAP_TOLERANCE = 14; // sample columns of slack before giving up
const HUD_TOP = 0.2; // health, mana, fatigue AND the battle bar live above this
const HOTBAR_TOP = 0.9; // hotbar and chat live below this
const DARK_TARGET = 78; // mean luminance a world shot is lifted toward
const DARK_FLOOR = 62; // below this, a shot is too dark to read on the site

function smooth(a, r) {
  const out = new Array(a.length).fill(0);
  for (let i = 0; i < a.length; i++) {
    let s = 0, n = 0;
    for (let j = Math.max(0, i - r); j <= Math.min(a.length - 1, i + r); j++) { s += a[j]; n++; }
    out[i] = s / n;
  }
  return out;
}

/** Grow from the histogram peak while density holds up. */
function peakRun(hist) {
  const h = smooth(hist, 2);
  let peak = 0, pi = 0;
  h.forEach((v, i) => { if (v > peak) { peak = v; pi = i; } });
  if (peak <= 0) return null;
  const floor = peak * DENSITY_FLOOR;

  let lo = pi, gap = 0;
  for (let i = pi; i >= 0; i--) {
    if (h[i] >= floor) { lo = i; gap = 0; }
    else if (++gap > GAP_TOLERANCE) break;
  }
  let hi = pi; gap = 0;
  for (let i = pi; i < h.length; i++) {
    if (h[i] >= floor) { hi = i; gap = 0; }
    else if (++gap > GAP_TOLERANCE) break;
  }
  return { lo, hi, peak };
}

async function detect(file) {
  const { width: W, height: H } = await sharp(file).metadata();
  const S = 4;
  const sw = Math.floor(W / S);
  const sh = Math.floor(H / S);
  const { data } = await sharp(file).resize(sw, sh, { fit: 'fill' }).raw()
    .toBuffer({ resolveWithObject: true });

  const col = new Array(sw).fill(0);
  const row = new Array(sh).fill(0);
  let hits = 0;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const i = (y * sw + x) * 3;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (b > 120 && b - r > 55 && g > 80 && b - g > 10) { col[x]++; row[y]++; hits++; }
    }
  }
  if (hits < 80) return { W, H, isPanel: false };

  const cx = peakRun(col);
  const cy = peakRun(row);
  if (!cx || !cy) return { W, H, isPanel: false };

  const box = { left: cx.lo * S, right: cx.hi * S, top: cy.lo * S, bottom: cy.hi * S };
  const bw = box.right - box.left;
  const bh = box.bottom - box.top;
  const area = (bw * bh) / (W * H);

  /* Guards, each earned by a frame that fooled an earlier version:
     - too small: a lone cyan glow in a cave (cartenon) produced a 2% sliver
     - too thin:  snow glare across a red gate produced a 1920x139 letterbox
     - too big:   a full-screen UI overlay is not a floating panel, so the
                  centred band reads better than "cropping" to the whole frame */
  const isPanel =
    area > 0.03 && area < 0.75 && bw > W * 0.15 && bh > H * 0.15;
  return { W, H, isPanel, box, area };
}

(async () => {
  const files = fs.readdirSync(DIR).filter((f) => /\.(png|jpe?g)$/i.test(f));
  for (const f of files) {
    const src = path.join(DIR, f);
    const d = await detect(src);
    let box;

    if (d.isPanel) {
      const pad = Math.round(Math.min(d.W, d.H) * 0.075);
      /* Minecraft centres its GUIs horizontally, so trust that over the
         detected centre: cyan bleed on one side (a glow, a HUD icon that
         survived the density floor) otherwise shifts the panel off-centre in
         the finished crop. Vertical extent still comes from detection, since
         panels are not vertically centred. */
      const half = Math.max(
        d.W / 2 - d.box.left,
        d.box.right - d.W / 2
      ) + pad;
      box = {
        left: Math.max(0, Math.round(d.W / 2 - half)),
        right: Math.min(d.W, Math.round(d.W / 2 + half)),
        top: Math.max(0, d.box.top - pad),
        bottom: Math.min(d.H, d.box.bottom + pad),
      };
    } else {
      /* Clear the HUD, not slice it. Starting the band at 8% cut the health and
         mana bars in half and left the stubs floating at the top edge, which
         reads as a broken image. Take the band between the HUD and the hotbar
         instead - losing a little sky is cheaper than showing half a meter. */
      const top = Math.round(d.H * HUD_TOP);
      const bottom = Math.round(d.H * HOTBAR_TOP);
      box = { left: 0, top, right: d.W, bottom };
    }

    let w = box.right - box.left;
    let h = box.bottom - box.top;

    if (!d.isPanel && w / h < MIN_ASPECT) {
      const want = Math.min(d.W, Math.round(h * MIN_ASPECT));
      const cx = (box.left + box.right) / 2;
      let l = Math.round(cx - want / 2), r = l + want;
      if (l < 0) { r -= l; l = 0; }
      if (r > d.W) { l -= r - d.W; r = d.W; }
      box.left = Math.max(0, l);
      box.right = Math.min(d.W, r);
      w = box.right - box.left;
    }

    const pctW = Math.round((w / d.W) * 100);
    console.log(
      `${f.padEnd(24)} ${d.isPanel ? 'panel' : 'world'}  -> ${w}x${h}  (${pctW}% of width` +
        `${d.area ? `, box ${(d.area * 100).toFixed(1)}% of frame` : ''})`
    );
    if (DRY) continue;

    let pipe = sharp(src)
      .extract({ left: box.left, top: box.top, width: w, height: h })
      .resize({ width: Math.min(OUT_W, w) });

    /* Cave and temple interiors come out near-black, which disappears against
       the site's own dark ground. Lift only what is genuinely too dark, and
       only toward a target - a flat boost would wash out the bright UI shots. */
    if (!d.isPanel) {
      const st = await sharp(src)
        .extract({ left: box.left, top: box.top, width: w, height: h })
        .greyscale()
        .stats();
      const mean = st.channels[0].mean;
      if (mean < DARK_FLOOR) {
        /* modulate(), not gamma(). sharp's gamma darkens pre-resize and
           re-brightens after - it exists to make resampling correct, not to
           lift shadows, and on a mean of 11 it came out darker than it went in.
           modulate() multiplies perceptual lightness, which is the actual job. */
        const factor = Math.min(2.8, DARK_TARGET / Math.max(mean, 1));
        pipe = pipe.modulate({ brightness: factor });
        console.log(`  ^ lifting mean ${mean.toFixed(1)} by x${factor.toFixed(2)}`);
      }
    }

    await pipe.png({ compressionLevel: 9 }).toFile(src + '.tmp');
    fs.renameSync(src + '.tmp', src);

    if (!d.isPanel) {
      const after = (await sharp(src).greyscale().stats()).channels[0].mean;
      if (after < 26) console.log(`  ! still dark after lift: mean ${after.toFixed(1)}`);
    }
  }
})();
