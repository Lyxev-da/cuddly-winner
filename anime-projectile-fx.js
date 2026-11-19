import { TAU, FX_STYLE, arc, circle, drawTrail, easeOut, fadeColor, halo, polygon, ribbon, unit } from './anime-fx.js';

const PROJECTILE_TYPE = { knife: 'dio', rasen: 'naruto', getsuga: 'ichigo', divine: 'shanks', hakai: 'vegeta' };

function knife(ctx, p, time) {
  const { r } = p;
  const skin = FX_STYLE.dio;
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  if (!p.launched) {
    const bloom = easeOut(p.age / 0.14);
    ctx.globalAlpha = bloom;
    halo(ctx, 0, 0, r * 2.35, skin.rgb, 0.37);
    arc(ctx, 0, 0, r * 1.6, -0.93, 0.93, fadeColor(skin.rgb, 0.61), 1.6);
    arc(ctx, 0, 0, r * 1.6, 2.23, 4.06, fadeColor(skin.rgb, 0.45), 1.4);
    const ping = (time * 2.1 + p.x * 0.012) % 1;
    arc(ctx, 0, 0, r * (1.62 + ping * 0.68), -0.70, 0.70, fadeColor(skin.second, 0.55 * (1 - ping)), 1);
  } else {
    const runner = ctx.createLinearGradient(-r * 5, 0, r * 0.7, 0);
    runner.addColorStop(0, fadeColor(skin.second, 0));
    runner.addColorStop(0.7, fadeColor(skin.rgb, 0.78));
    runner.addColorStop(1, skin.light);
    polygon(ctx, [[-r * 5, 0], [r, -r * 0.22], [r, r * 0.22]], runner);
  }
  ctx.scale(r, r);
  polygon(ctx, [[-1.14, -0.19], [-0.23, -0.21], [-0.23, 0.21], [-1.14, 0.19]], '#3c293a', '#d3a05a', 0.12);
  polygon(ctx, [[-0.37, -0.44], [-0.20, -0.36], [-0.20, 0.36], [-0.37, 0.44]], '#e1ae56', '#573647', 0.12);
  polygon(ctx, [[-0.22, -0.32], [0.49, -0.24], [1.40, 0], [-0.22, 0.31]], '#b2c0dc', '#32314e', 0.1);
  polygon(ctx, [[-0.16, -0.24], [0.51, -0.17], [1.40, 0], [-0.17, 0.055]], '#fff9df');
}

export function drawRasenshuriken(ctx, x, y, r, angle, alpha, detail) {
  const skin = FX_STYLE.naruto;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = alpha;
  halo(ctx, 0, 0, r * 1.72, skin.rgb, 0.55);
  if (detail > 0.55) arc(ctx, 0, 0, r * 1.07, 0.16, 2.81, fadeColor(skin.second, 0.66), Math.max(1.2, r * 0.06));
  ctx.scale(r, r);
  const metal = ctx.createLinearGradient(0.18, 0.2, 1.06, -0.2);
  metal.addColorStop(0, '#307cbf');
  metal.addColorStop(0.49, '#a2f0ff');
  metal.addColorStop(1, '#fbffff');
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(0, -0.12);
    ctx.bezierCurveTo(0.30, -0.49, 0.73, -0.42, 1.16, -0.07);
    ctx.bezierCurveTo(0.82, -0.14, 0.58, 0.32, 0.19, 0.27);
    ctx.quadraticCurveTo(0.0, 0.18, 0, -0.12);
    ctx.closePath();
    ctx.fillStyle = metal;
    ctx.fill();
    ctx.lineWidth = 0.03;
    ctx.strokeStyle = '#defdff';
    ctx.stroke();
    ctx.rotate(TAU * 0.25);
  }
  const core = ctx.createRadialGradient(-0.10, -0.11, 0.03, 0, 0, 0.41);
  core.addColorStop(0, '#ffffff');
  core.addColorStop(0.53, '#abfaff');
  core.addColorStop(0.72, '#3acafc');
  core.addColorStop(1, '#225ed2');
  circle(ctx, 0, 0, 0.39);
  ctx.fillStyle = core;
  ctx.fill();
  arc(ctx, 0, 0, 0.45, -0.62, 3.97, '#ffda88', 0.063);
  ctx.restore();
}

function rasenVortex(ctx, p, time, detail) {
  const skin = FX_STYLE.naruto;
  const t = unit(p.burstAge / p.burstLife);
  const r = p.burstR;
  const spread = 0.4 + 0.6 * easeOut(t * 3.8);
  const spin = time * 16;
  const rr = r * spread;
  ctx.translate(p.x, p.y);
  ctx.globalAlpha = (1 - t) ** 0.6;
  halo(ctx, 0, 0, rr * 1.34, skin.rgb, 0.56);
  circle(ctx, 0, 0, r);
  ctx.fillStyle = fadeColor(skin.rgb, 0.105);
  ctx.fill();
  ctx.strokeStyle = fadeColor(skin.rgb, 0.39);
  ctx.lineWidth = 1.25;
  ctx.stroke();
  ctx.rotate(spin);
  const layers = detail > 0.58 ? 5 : 3;
  for (let arm = 0; arm < layers; arm++) {
    ctx.beginPath();
    const offset = arm * TAU / layers;
    for (let j = 0; j <= 18; j++) {
      const s = j / 18;
      const a = offset + s * 2.38;
      const d = rr * (0.08 + s * 0.89);
      if (j === 0) ctx.moveTo(Math.cos(a) * d, Math.sin(a) * d);
      else ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d);
    }
    ctx.lineCap = 'round';
    ctx.strokeStyle = fadeColor(arm % 2 ? skin.second : skin.rgb, 0.46);
    ctx.lineWidth = Math.max(3.8, rr * 0.11);
    ctx.stroke();
    ctx.strokeStyle = arm % 2 ? '#ffe0a0' : '#dcfcff';
    ctx.lineWidth = Math.max(1, rr * 0.025);
    ctx.stroke();
  }
  for (let i = 0; i < 2; i++) ribbon(ctx, rr * (0.78 + i * 0.17), rr * 0.092, i * 2.89, 2.02,
    fadeColor(i === 0 ? skin.rgb : skin.second, 0.61));
  arc(ctx, 0, 0, rr * (0.96 + t * 0.25), 0.28, 4.17, '#c4f2ff', 2);
  halo(ctx, 0, 0, rr * 0.43, '221,250,255', 0.75);
}

function slashWave(ctx, p, time, detail) {
  const haki = p.kind === 'divine';
  const skin = FX_STYLE[haki ? 'shanks' : 'ichigo'];
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  const r = p.r;
  const grow = 0.68 + 0.32 * easeOut(p.age / 0.12);
  ctx.scale(r * grow, r * grow);
  const swept = haki ? 1.02 : 1.43;
  const head = haki ? 0.98 : 0.62;
  halo(ctx, 0.06, 0, 1.91, skin.rgb, haki ? 0.43 : 0.37);
  ctx.lineJoin = 'round';

  const layer = (x, spread, color, edge, width) => {
    ctx.beginPath();
    ctx.moveTo(-0.80 + x, -spread);
    ctx.bezierCurveTo(0.28 + x, -spread * 0.85, head + x, -0.63, head + x, 0);
    ctx.bezierCurveTo(head + x, 0.62, 0.05 + x, spread * 0.91, -0.90 + x, spread);
    ctx.quadraticCurveTo(-0.07 + x, 0.54, x - 0.124, 0.03);
    ctx.quadraticCurveTo(-0.10 + x, -0.61, -0.80 + x, -spread);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = width;
    ctx.strokeStyle = edge;
    ctx.stroke();
  };
  if (detail > 0.54) layer(-0.68, swept * 0.74, skin.ink, fadeColor(skin.second, 0.67), 0.037);
  layer(-0.27, swept * 0.89, skin.ink, fadeColor(skin.rgb, 0.57), 0.075);
  const bevel = ctx.createLinearGradient(-0.53, -swept, 0.55, swept);
  bevel.addColorStop(0, fadeColor(skin.second, 0.79));
  bevel.addColorStop(0.44, '#190a1c');
  bevel.addColorStop(0.67, haki ? '#330d1f' : '#200d2e');
  bevel.addColorStop(1, fadeColor(skin.rgb, 0.82));
  layer(0, swept, bevel, fadeColor(skin.rgb, 0.99), 0.079);
  ctx.beginPath();
  ctx.moveTo(-0.19, -swept * 0.75);
  ctx.bezierCurveTo(0.47, -swept * 0.58, head, -0.37, head, 0);
  ctx.bezierCurveTo(head, 0.58, 0.10, swept * 0.80, -0.56, swept * 0.92);
  ctx.strokeStyle = skin.light;
  ctx.lineWidth = 0.037;
  ctx.stroke();

  if (haki) drawHakiForks(ctx, 1, time, detail, 0.82);
  else {
    ctx.beginPath();
    for (let i = 0; i < (detail > 0.65 ? 7 : 4); i++) {
      const f = (time * (1.4 + (i % 3) * 0.29) + i * 0.378) % 1;
      const v = (i % 2 ? 1 : -1) * (0.22 + i * 0.155);
      ctx.moveTo(-0.48 - f * 1.28, v + f * 0.12);
      ctx.lineTo(-0.26 - f * 1.19, v - 0.08);
    }
    ctx.strokeStyle = fadeColor(skin.rgb, 0.78);
    ctx.lineWidth = 0.036;
    ctx.stroke();
  }
}

export function drawHakiForks(ctx, r, time, detail, opacity) {
  const phase = Math.floor(time * 13);
  const count = detail > 0.62 ? 6 : 3;
  ctx.save();
  ctx.scale(r, r);
  ctx.globalAlpha *= opacity;
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const a = i * TAU / count + phase * 0.21;
    const x = Math.cos(a), y = Math.sin(a);
    const t = (i % 2 ? 1 : -1) * 0.34;
    ctx.moveTo(x * 0.31, y * 0.31);
    ctx.lineTo(x * 0.74 - y * t, y * 0.74 + x * t);
    ctx.lineTo(x * 0.93 + y * t * 0.27, y * 0.93 - x * t * 0.27);
    ctx.lineTo(x * 1.65 - y * t * 0.58, y * 1.65 + x * t * 0.58);
  }
  ctx.strokeStyle = '#16060f';
  ctx.lineWidth = 0.13;
  ctx.stroke();
  ctx.strokeStyle = '#fa3a56';
  ctx.lineWidth = 0.049;
  ctx.stroke();
  if (detail > 0.62) {
    ctx.strokeStyle = 'rgba(255,211,158,0.78)';
    ctx.lineWidth = 0.014;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawHakaiOrb(ctx, x, y, r, time, alpha, detail) {
  const skin = FX_STYLE.vegeta;
  const pulse = 0.94 + 0.06 * Math.sin(time * 14);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(r * pulse, r * pulse);
  halo(ctx, 0, 0, 2.25, skin.rgb, 0.64);
  const disk = ctx.createRadialGradient(-0.25, -0.28, 0.12, 0, 0, 1.08);
  disk.addColorStop(0, '#120924');
  disk.addColorStop(0.65, '#190e31');
  disk.addColorStop(0.81, '#4d2279');
  disk.addColorStop(0.93, '#ce54f4');
  disk.addColorStop(1, '#ffcaff');
  circle(ctx, 0, 0, 1.04);
  ctx.fillStyle = disk;
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.rotate(time * (i % 2 ? -4.2 : 4.2) + i * 1.03);
    ctx.scale(1, 0.48 + i * 0.19);
    ribbon(ctx, 1.15 + i * 0.13, 0.18 - i * 0.034, 0.35 + i, 2.56,
      i === 0 ? '#f8c6ff' : fadeColor(i === 1 ? skin.second : skin.rgb, 0.81), 13);
    ctx.restore();
  }
  if (detail > 0.55) {
    for (let i = 0; i < 6; i++) {
      const a = time * -6.0 + i * 2.399;
      const d = 1.25 + (i % 3) * 0.24;
      const xx = Math.cos(a) * d, yy = Math.sin(a) * d;
      polygon(ctx, [[xx - 0.094, yy + 0.06], [xx + 0.04, yy - 0.11], [xx + 0.085, yy + 0.038]],
        i % 2 ? '#b47dfa' : '#ffe5ff');
    }
  }
  ctx.restore();
}

export function drawPackProjectiles(ctx, shots, time, detail, front) {
  for (const p of shots) {
    const skin = FX_STYLE[PROJECTILE_TYPE[p.kind]];
    ctx.save();
    if (!front) {
      if (p.burst) rasenVortex(ctx, p, time, detail);
      else if (p.kind === 'knife' && !p.launched) {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        const end = p.r * 4.5;
        const tracer = ctx.createLinearGradient(0, 0, end, 0);
        tracer.addColorStop(0, fadeColor(skin.rgb, 0.72 * easeOut(p.age / 0.18)));
        tracer.addColorStop(1, fadeColor(skin.second, 0));
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.moveTo(p.r, 0);
        ctx.lineTo(end, 0);
        ctx.strokeStyle = tracer;
        ctx.lineWidth = 1.15;
        ctx.stroke();
      }
      else drawTrail(ctx, p, skin.rgb, p.r * (p.kind === 'knife' ? 0.45 : 1.32), detail);
    } else if (p.kind === 'knife') knife(ctx, p, time);
    else if (p.kind === 'rasen' && !p.burst) drawRasenshuriken(ctx, p.x, p.y, p.r * 1.32, time * 23, 1, detail);
    else if (p.kind === 'hakai') drawHakaiOrb(ctx, p.x, p.y, p.r, time, 1, detail);
    else if (p.kind === 'getsuga' || p.kind === 'divine') slashWave(ctx, p, time, detail);
    ctx.restore();
  }
}