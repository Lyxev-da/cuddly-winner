export const TAU = Math.PI * 2;
export const unit = n => Math.max(0, Math.min(n, 1));
export const easeOut = n => 1 - (1 - unit(n)) ** 3;
export const fadeColor = (rgb, alpha) => `rgba(${rgb},${unit(alpha)})`;

const style = (rgb, light, ink, shape, second = rgb) => ({ rgb, light, ink, shape, second });
export const FX_STYLE = {
  dio:     style('255,198,78', '#fff6cb', '#42213e', 'clock', '174,129,230'),
  madara:  style('54,147,255', '#d9faff', '#15224f', 'slice', '97,241,255'),
  naruto:  style('91,224,255', '#f2feff', '#15304a', 'vortex', '255,200,78'),
  saitama: style('255,95,76', '#fff2cf', '#541b2c', 'force', '255,210,117'),
  ichigo:  style('255,53,101', '#ffc2d1', '#190e22', 'slice', '136,82,223'),
  broly:   style('159,244,58', '#f0ffd2', '#132915', 'force', '51,212,108'),
  vegeta:  style('211,91,255', '#ffe5ff', '#1a0c32', 'collapse', '98,83,240'),
  gurren:  style('55,250,158', '#e3fff7', '#113435', 'vortex', '255,204,116'),
  shanks:  style('255,57,81', '#ffe5b5', '#240917', 'haki', '255,156,99'),
  goku:    style('68,185,255', '#e7fbff', '#111f52', 'force'),
  luffy:   style('244,112,175', '#fff2e7', '#321337', 'force', '197,155,255'),
  sukuna:  style('248,59,109', '#ffdeec', '#421028', 'slice'),
};

export function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, TAU);
}

export function arc(ctx, x, y, r, start, end, color, width) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), start, end);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

export function halo(ctx, x, y, r, rgb, power) {
  if (r <= 0 || power <= 0) return;
  const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
  glow.addColorStop(0, fadeColor(rgb, power));
  glow.addColorStop(0.42, fadeColor(rgb, power * 0.42));
  glow.addColorStop(1, fadeColor(rgb, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

export function polygon(ctx, points, fill, edge, width = 1) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (edge) { ctx.lineWidth = width; ctx.strokeStyle = edge; ctx.stroke(); }
}

export function ribbon(ctx, r, width, start, sweep, fill, detail = 15) {
  ctx.beginPath();
  for (const side of [1, -1]) {
    for (let i = 0; i <= detail; i++) {
      const p = side === 1 ? i / detail : 1 - i / detail;
      const angle = start + p * sweep;
      const rr = Math.max(0, r + Math.sin(p * Math.PI) ** 0.72 * width * side * 0.5);
      const x = Math.cos(angle) * rr, y = Math.sin(angle) * rr;
      if (i === 0 && side === 1) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

const TRAIL_SAMPLES = 11;

export function sampleTrail(shot, dt) {
  let h = shot.fxTrail;
  if (!h) shot.fxTrail = h = { points: new Float32Array(TRAIL_SAMPLES * 2), head: 0, length: 0, elapsed: 0 };
  h.elapsed += dt;
  if (h.length && h.elapsed < 0.021) return;
  h.elapsed %= 0.021;
  h.points[h.head * 2] = shot.x;
  h.points[h.head * 2 + 1] = shot.y;
  h.head = (h.head + 1) % TRAIL_SAMPLES;
  h.length = Math.min(TRAIL_SAMPLES, h.length + 1);
}

export function remapTrail(shot, mapX, mapY) {
  const h = shot.fxTrail;
  if (!h) return;
  for (let i = 0; i < h.length; i++) {
    h.points[i * 2] = mapX(h.points[i * 2]);
    h.points[i * 2 + 1] = mapY(h.points[i * 2 + 1]);
  }
}

export function drawTrail(ctx, shot, rgb, width, detail, alpha = 1) {
  const h = shot.fxTrail;
  if (!h) return;
  ctx.lineCap = 'round';
  let x = shot.x, y = shot.y;
  const count = Math.min(h.length, detail > 0.65 ? TRAIL_SAMPLES : 5);
  for (let i = 0; i < count; i++) {
    const j = ((h.head + TRAIL_SAMPLES - i - 1) % TRAIL_SAMPLES) * 2;
    const dx = h.points[j], dy = h.points[j + 1];
    const p = (1 - i / count) * (0.4 + h.length / TRAIL_SAMPLES * 0.6);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(dx, dy);
    ctx.lineWidth = width * p;
    ctx.strokeStyle = fadeColor(rgb, p * 0.54 * alpha);
    ctx.stroke();
    x = dx; y = dy;
  }
}

const LIFETIME = { cast: 0.30, light: 0.24, heavy: 0.56, guard: 0.32, rupture: 0.58, shift: 0.49 };
const CAP = 16;
const TITLE_LIFE = 1.08;

export function makeAnimeEffects(arena) {
  const bursts = [];
  const titles = { red: null, blue: null };
  let seq = 0;

  function emit(type, kind, x, y, r, angle = 0) {
    const skin = FX_STYLE[type];
    if (!skin || r <= 0) return;
    // Multi-hit knives and drill ticks can share a contact without piling up flashes.
    if (kind === 'light' && bursts.some(e => e.kind === kind && e.skin === skin && e.age < 0.065 &&
      Math.hypot(e.x - x, e.y - y) < r * 0.55)) return;
    if (bursts.length >= CAP) bursts.shift();
    bursts.push({ skin, kind, x, y, r, angle, age: 0, life: LIFETIME[kind], seed: ++seq * 2.39 });
  }

  function title(side, type, name, label) {
    titles[side] = { skin: FX_STYLE[type], name, label, age: 0 };
  }

  function advance(dt) {
    for (let i = bursts.length - 1; i >= 0; i--) {
      bursts[i].age += dt;
      if (bursts[i].age >= bursts[i].life) bursts.splice(i, 1);
    }
    for (const side of ['red', 'blue']) {
      const t = titles[side];
      if (t && (t.age += dt) >= TITLE_LIFE) titles[side] = null;
    }
  }

  function draw(ctx, detail, front) {
    for (const e of bursts) {
      if (front) drawAccent(ctx, e, detail);
      else drawBloom(ctx, e);
    }
  }

  function drawTitles(ctx, reduced) {
    if (!titles.red && !titles.blue) return;
    const split = titles.red && titles.blue;
    const y = arena.y + Math.min(42, Math.max(27, arena.h * 0.09));
    const width = arena.w * (split ? 0.43 : 0.75);
    ctx.save();
    for (const side of ['red', 'blue']) {
      const t = titles[side];
      if (!t) continue;
      const x = arena.x + arena.w * (split ? (side === 'red' ? 0.25 : 0.75) : 0.5);
      drawTitle(ctx, x, y, width, t, reduced);
    }
    ctx.restore();
  }

  return {
    emit, title, advance, draw, drawTitles,
    get active() { return bursts.length > 0; },
    reset() { bursts.length = 0; titles.red = titles.blue = null; },
    remap(mapX, mapY) {
      const scale = Math.min(mapX(1) - mapX(0), mapY(1) - mapY(0));
      for (const e of bursts) { e.x = mapX(e.x); e.y = mapY(e.y); e.r *= scale; }
    },
  };
}

function drawTitle(ctx, x, y, maxWidth, t, reduced) {
  const intro = easeOut(t.age / 0.15);
  const out = unit((TITLE_LIFE - t.age) / 0.28);
  const skin = t.skin;
  ctx.save();
  ctx.translate(x, y - (reduced ? 0 : (1 - intro) * 5));
  ctx.globalAlpha = intro * out;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const titleSize = Math.min(33, 15 + maxWidth * 0.029);
  ctx.font = `italic 900 ${titleSize}px system-ui, sans-serif`;
  const width = Math.min(maxWidth, Math.max(90, ctx.measureText(t.label).width + 29));
  const w = width / 2;
  const h = titleSize * 0.94;
  const back = ctx.createLinearGradient(-w, 0, w, 0);
  back.addColorStop(0, 'rgba(5,7,16,0)');
  back.addColorStop(0.21, 'rgba(5,7,16,0.88)');
  back.addColorStop(0.79, 'rgba(5,7,16,0.88)');
  back.addColorStop(1, 'rgba(5,7,16,0)');
  ctx.fillStyle = back;
  ctx.fillRect(-w - 10, -h, width + 20, h * 2);
  const edge = ctx.createLinearGradient(-w, 0, w, 0);
  edge.addColorStop(0, fadeColor(skin.rgb, 0));
  edge.addColorStop(0.23, fadeColor(skin.rgb, 0.81));
  edge.addColorStop(0.72, skin.light);
  edge.addColorStop(1, fadeColor(skin.rgb, 0));
  ctx.fillStyle = edge;
  ctx.fillRect(-w * intro, h - 2, width * intro, 1.5);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#070912';
  ctx.strokeText(t.label, 0, titleSize * 0.15, width - 14);
  ctx.fillStyle = skin.light;
  ctx.fillText(t.label, 0, titleSize * 0.15, width - 14);
  ctx.font = `800 ${Math.min(11, titleSize * 0.44)}px system-ui, sans-serif`;
  ctx.fillStyle = fadeColor(skin.rgb, 0.94);
  ctx.fillText(t.name, 0, -titleSize * 0.82, width * 0.8);
  ctx.restore();
}

function drawBloom(ctx, e) {
  const t = unit(e.age / e.life);
  const fine = e.kind === 'light' || e.kind === 'cast';
  const power = (1 - t) ** 1.6 * (fine ? 0.24 : 0.49);
  const r = e.r * (0.45 + easeOut(t) * (fine ? 0.64 : 1.19));
  halo(ctx, e.x, e.y, r, e.skin.rgb, power);
  if (!fine && e.kind !== 'guard') {
    arc(ctx, e.x, e.y, r * 0.8, 0, TAU, fadeColor(e.skin.second, (1 - t) * 0.3), 1.3);
  }
}

function hitFlare(ctx, r, spin, alpha, skin) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.rotate(spin);
  ctx.globalAlpha *= alpha;
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = i * TAU / 12;
    const d = r * (i % 2 ? 0.15 : i % 3 === 0 ? 0.87 : 0.54);
    const x = Math.cos(a) * d, y = Math.sin(a) * d;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.strokeStyle = fadeColor(skin.rgb, 0.61);
  ctx.lineWidth = Math.max(2, r * 0.075);
  ctx.stroke();
  ctx.fillStyle = skin.light;
  ctx.fill();
  ctx.restore();
}

function drawAccent(ctx, e, detail) {
  const t = unit(e.age / e.life);
  const fade = (1 - t) ** 1.35;
  if (fade <= 0) return;
  const { skin, kind } = e;
  const light = kind === 'light' || kind === 'cast';
  const r = e.r * (light ? 0.66 : 1.14);
  const reach = r * (0.37 + 0.84 * easeOut(t));
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle);
  ctx.globalAlpha = fade;
  ctx.lineCap = 'round';
  if (kind === 'guard') {
    const pts = Array.from({ length: 6 }, (_, i) => {
      const a = i * TAU / 6;
      return [Math.cos(a) * reach, Math.sin(a) * reach];
    });
    polygon(ctx, pts, fadeColor(skin.rgb, 0.12), skin.light, 1.75);
    arc(ctx, 0, 0, reach * 1.12, -1.35, 1.35, fadeColor(skin.rgb, 0.65), 2.5);
  } else if (skin.shape === 'collapse' && !light) {
    const rr = r * (t < 0.33 ? 1.1 - t * 2.6 : 0.23 + easeOut((t - 0.33) / 0.67) * 1.05);
    circle(ctx, 0, 0, rr * 0.72);
    ctx.fillStyle = skin.ink;
    ctx.fill();
    for (let i = 0; i < 3; i++) arc(ctx, 0, 0, rr * (0.94 + i * 0.19), i * 2.1 + t * 2, i * 2.1 + t * 2 + 1.65,
      i === 0 ? skin.light : fadeColor(skin.rgb, 0.66 - i * 0.13), 3.2 - i * 0.7);
    const flecks = detail > 0.62 ? 10 : 5;
    for (let i = 0; i < flecks; i++) {
      const a = e.seed + i * TAU / flecks + t * 4, d = rr * (1.35 + (i % 3) * 0.14);
      const x = Math.cos(a) * d, y = Math.sin(a) * d, w = r * (0.076 - t * 0.04);
      polygon(ctx, [[x - w * 0.65, y - w * 0.92], [x + w, y], [x, y + w * 1.20]],
        i % 2 ? '#e9b2ff' : '#a276ff');
    }
    hitFlare(ctx, r * 0.64, 0.13, unit(1 - Math.abs(t - 0.38) * 7), skin);
  } else if (skin.shape === 'slice' || skin.shape === 'haki') {
    ctx.rotate(-0.46 + t * 0.13);
    const edge = ctx.createLinearGradient(-reach, 0, reach, 0);
    edge.addColorStop(0, fadeColor(skin.rgb, 0));
    edge.addColorStop(0.32, fadeColor(skin.rgb, 0.9));
    edge.addColorStop(0.52, skin.light);
    edge.addColorStop(1, fadeColor(skin.rgb, 0));
    polygon(ctx, [[-reach * 1.16, reach * 0.19], [-reach * 0.36, -r * 0.12], [reach * 1.35, -reach * 0.21],
      [reach * 0.13, r * 0.055]], edge);
    if (!light) arc(ctx, 0, 0, reach * 0.9, -1.5, 0.72, fadeColor(skin.rgb, 0.65), 2);
    if (!light && skin.shape === 'haki') {
      polygon(ctx, [[-reach * 0.79, -reach * 0.55], [reach * 0.06, -reach * 0.09],
        [reach * 0.83, reach * 0.55], [reach * 0.09, 0]], edge);
    }
  } else if (skin.shape === 'clock' || skin.shape === 'vortex') {
    const offset = skin.shape === 'clock' ? 0 : t * 4.3;
    for (let i = 0; i < 3; i++) ribbon(ctx, reach * (0.66 + i * 0.18), r * (0.13 - i * 0.025),
      offset + i * 2.08, 1.22, i === 1 ? skin.light : fadeColor(skin.rgb, 0.72), 10);
  } else {
    const half = skin.shape === 'force' && kind === 'heavy' ? 0.40 : 0.65;
    for (let i = 0; i < 3; i++) arc(ctx, -r * 0.18, 0, reach * (0.52 + i * 0.22), -half - i * 0.28, half + i * 0.28,
      i === 0 ? skin.light : fadeColor(skin.second, 0.63 - i * 0.12), 3.2 - i * 0.77);
  }

  if (!light && kind !== 'guard' && skin.shape !== 'collapse') {
    hitFlare(ctx, r * (0.55 + 0.65 * easeOut(t * 2)), e.seed, unit(1 - t * 4.7) * 0.86, skin);
  }
  const count = detail > 0.62 ? (light ? 5 : 12) : (light ? 2 : 5);
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const a = e.seed + i * 2.39996;
    const d = reach * (0.44 + (i % 5) * 0.17);
    const len = r * (0.12 + (i % 3) * 0.042) * (1 - t * 0.82);
    const dx = Math.cos(a), dy = Math.sin(a);
    ctx.moveTo(dx * d, dy * d);
    ctx.lineTo(dx * (d + len), dy * (d + len));
  }
  ctx.strokeStyle = skin.light;
  ctx.lineWidth = Math.max(1, e.r * 0.028);
  ctx.stroke();
  ctx.restore();
}