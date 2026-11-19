import { TAU, FX_STYLE, arc, circle, drawTrail, easeOut, fadeColor, halo, polygon, ribbon, unit } from './anime-fx.js';
import { drawHakaiOrb, drawHakiForks, drawRasenshuriken } from './anime-projectile-fx.js';

const progress = a => unit(a.time / a.duration);

function sweep(ctx, r, time, rgb, count, width, amount = 0.7) {
  for (let i = 0; i < count; i++) {
    ribbon(ctx, r * (0.83 + i * 0.16), r * width, time + i * TAU / count, 1.5 + (i % 2) * 0.41,
      fadeColor(rgb, amount * (1 - i * 0.12)), 12);
  }
}

function ticks(ctx, r, count, color, width, offset = 0) {
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const a = i * TAU / count + offset;
    const s = r * (i % 5 === 0 ? 0.91 : 0.965);
    ctx.moveTo(Math.cos(a) * s, Math.sin(a) * s);
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function gather(ctx, r, t, clock, skin, detail) {
  const count = detail > 0.6 ? 12 : 6;
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const f = (clock * 1.6 + 0.384 * i) % 1;
    const a = i * 2.39996 + clock * 1.15;
    const d = r * (1.15 + f * (1.69 - t * 0.61));
    const len = r * (0.08 + f * 0.17);
    const x = Math.cos(a), y = Math.sin(a);
    ctx.moveTo(x * d, y * d);
    ctx.lineTo(x * (d + len), y * (d + len));
  }
  ctx.strokeStyle = fadeColor(skin.rgb, 0.27 + 0.53 * t);
  ctx.lineWidth = Math.max(1, r * 0.042);
  ctx.stroke();
}

function timeStop(ctx, b, a, helpers, time, detail) {
  const t = progress(a), wind = a.mode === 'windup', active = a.mode === 'active';
  const s = FX_STYLE.dio;
  const full = helpers.worldRadius();
  const r = wind ? b.r * (0.98 + t * 1.25) : active ? full * easeOut(a.time / 0.27) : full * (1 + t * 0.16);
  if (r < 1) return;
  const alpha = wind ? 0.25 + t * 0.63 : active ? 0.94 : (1 - t) * 0.66;
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.globalAlpha = alpha;
  const glass = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  glass.addColorStop(0, 'rgba(36,20,61,0.35)');
  glass.addColorStop(0.66, 'rgba(36,19,55,0.77)');
  glass.addColorStop(0.93, 'rgba(123,73,149,0.53)');
  glass.addColorStop(1, 'rgba(245,170,81,0.29)');
  circle(ctx, 0, 0, r);
  ctx.fillStyle = glass;
  ctx.fill();
  if (!wind) {
    ctx.save();
    ctx.clip();
    ctx.beginPath();
    for (let i = -1; i <= 1; i++) {
      ctx.moveTo(-r, i * r * 0.32);
      ctx.lineTo(r, i * r * 0.32);
      ctx.moveTo(i * r * 0.32, -r);
      ctx.lineTo(i * r * 0.32, r);
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = fadeColor(s.second, 0.16);
    ctx.stroke();
    const turn = -Math.PI * 0.19 + easeOut((a.time - 1.05) / 0.19) * 1.3;
    ctx.rotate(turn);
    polygon(ctx, [[0, -r * 0.74], [r * 0.023, -r * 0.12], [0, r * 0.16], [-r * 0.024, -r * 0.12]], fadeColor(s.rgb, 0.54));
    polygon(ctx, [[0, -r * 0.029], [r * 0.51, 0], [0, r * 0.032], [-r * 0.081, 0]], '#edc487');
    circle(ctx, 0, 0, r * 0.029);
    ctx.fillStyle = s.light;
    ctx.fill();
    ctx.restore();
  }
  arc(ctx, 0, 0, r, 0, TAU, fadeColor(s.rgb, 0.75), 2.5);
  arc(ctx, 0, 0, r * 1.04, 0, TAU, fadeColor(s.second, 0.33), 1.1);
  arc(ctx, 0, 0, r * 0.86, 0, TAU, fadeColor(s.rgb, 0.22), 1.15);
  ticks(ctx, r * 0.977, detail > 0.58 && !wind ? 60 : 12, fadeColor(s.rgb, 0.62), 1.3);
  if (!wind && r > 66) {
    ctx.font = `600 ${Math.min(17, r * 0.115)}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f6dba1';
    for (const [x, y, label] of [[0, -0.76, 'XII'], [0.76, 0, 'III'], [0, 0.76, 'VI'], [-0.76, 0, 'IX']]) {
      ctx.fillText(label, x * r, y * r);
    }
  }
  sweep(ctx, r * 1.012, wind ? time * 5 : -1.15, s.rgb, 2, 0.033, 0.8);
  ctx.restore();
}

function timeStopTarget(ctx, a, foe) {
  if (!a.fxCaught || a.mode !== 'active' || !foe?.alive || foe.freezeTimer <= 0 || a.time >= 1.05) return;
  const s = FX_STYLE.dio;
  const fade = easeOut(a.time / 0.14) * unit((1.05 - a.time) / 0.19);
  const r = foe.r * 1.35;
  ctx.save();
  ctx.translate(foe.x, foe.y);
  ctx.globalAlpha = fade;
  halo(ctx, 0, 0, r * 1.48, s.second, 0.63);
  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI * 0.5 + 0.32;
    arc(ctx, 0, 0, r, angle, angle + 0.91, s.light, 2);
    arc(ctx, 0, 0, r * 1.15, angle + 0.18, angle + 0.69, fadeColor(s.rgb, 0.66), 1.1);
  }
  ctx.restore();
}

function spiritArmor(ctx, b, a, time, detail) {
  const wind = a.mode === 'windup', active = a.mode === 'active', t = progress(a);
  const s = FX_STYLE.madara;
  const r = b.r * (wind ? 1.57 + easeOut(t) * 0.39 : 1.96);
  const alpha = wind ? easeOut(t) * 0.86 : active ? 0.95 : (1 - t) * 0.75;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.globalAlpha = alpha;
  halo(ctx, 0, -r * 0.22, r * 1.74, s.rgb, 0.62);
  ctx.scale(r, r);
  ctx.lineJoin = 'round';
  const shell = ctx.createLinearGradient(0, -1.47, 0, 1.08);
  shell.addColorStop(0, 'rgba(103,212,255,0.86)');
  shell.addColorStop(0.48, 'rgba(35,93,227,0.77)');
  shell.addColorStop(1, 'rgba(30,47,158,0.07)');
  polygon(ctx, [[-1.07, 0.88], [-1.34, 0.39], [-1.30, -0.12], [-0.86, -0.73],
    [-0.50, -0.83], [-0.44, -1.20], [-0.68, -1.51], [-0.24, -1.28], [0, -1.56], [0.24, -1.28],
    [0.68, -1.51], [0.44, -1.20], [0.50, -0.83], [0.86, -0.73], [1.30, -0.12], [1.34, 0.39], [1.07, 0.88],
    [0.54, 0.53], [0, 1.04], [-0.54, 0.53]], shell, '#68c5ff', 0.025);
  polygon(ctx, [[-0.43, -1.12], [-0.23, -1.24], [0, -1.42], [0.23, -1.24], [0.43, -1.12],
    [0.36, -0.78], [0.15, -0.64], [0, -0.59], [-0.15, -0.64], [-0.36, -0.78]], '#142c70', '#98e7ff', 0.018);
  polygon(ctx, [[0, -1.24], [0.079, -1.03], [0, -0.92], [-0.079, -1.03]], '#aaf7ff');
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side, 1);
    polygon(ctx, [[0.07, -0.99], [0.35, -1.075], [0.29, -0.935], [0.12, -0.929]], '#d5fdff');
    polygon(ctx, [[0.48, -0.66], [0.87, -0.68], [1.29, -0.16], [1.18, 0.05], [0.70, -0.32]],
      '#2354a8', '#82dbff', 0.022);
    polygon(ctx, [[0.53, -0.53], [0.85, -0.59], [1.12, -0.28], [0.76, -0.38]], '#69c4fa');
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const y = -0.35 + i * 0.215;
      ctx.moveTo(0.15, y + 0.37);
      ctx.bezierCurveTo(0.43, y + 0.42, 0.94, y + 0.46, 1.03 - i * 0.08, y + 0.1);
    }
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.066;
    ctx.strokeStyle = '#204fae';
    ctx.stroke();
    ctx.lineWidth = 0.019;
    ctx.strokeStyle = '#a8efff';
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  if (detail > 0.57) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.scale(1, 0.52);
    sweep(ctx, r * 1.35, time * 2, s.second, 3, 0.055, alpha * 0.71);
    ctx.restore();
  }
}

function bladeSweep(ctx, b, a, detail) {
  if (a.mode !== 'active' || !a.done || a.time >= 1.19) return;
  const t = unit((a.time - 0.65) / 0.54);
  const open = easeOut(t * 4.2);
  const radius = b.r * (2.40 + easeOut(t) * 0.91);
  const w = b.r * (0.75 - t * 0.57);
  const s = FX_STYLE.madara;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(a.angle);
  ctx.globalAlpha = (1 - t) ** 1.25;
  for (const side of [1, -1]) {
    ctx.save();
    ctx.scale(1, side);
    const from = -1.04 + 1.2 * open;
    const sweepLength = 0.36 + 1.37 * open;
    ribbon(ctx, radius + (side === 1 ? w * 0.27 : -w * 0.19), w * 1.57, from - sweepLength, sweepLength,
      fadeColor(s.rgb, 0.32), detail > 0.65 ? 20 : 12);
    ribbon(ctx, radius + (side === 1 ? w * 0.27 : -w * 0.19), w, from - sweepLength, sweepLength, '#419eff');
    ribbon(ctx, radius + w * 0.28, w * 0.31, from - sweepLength * 0.91, sweepLength * 0.91, '#d9fbff');
    ctx.restore();
  }
  ctx.restore();
}

function punchCone(ctx, b, a, helpers, time, detail) {
  if (a.mode === 'recover') return;
  const wind = a.mode === 'windup';
  const s = FX_STYLE.saitama;
  const t = wind ? progress(a) : unit((a.time - 0.10) / 0.32);
  const len = helpers.punchRange(), half = helpers.punchHalfAngle();
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(a.angle);
  if (wind || !a.done) {
    const beam = ctx.createLinearGradient(0, 0, len, 0);
    beam.addColorStop(0, fadeColor(s.rgb, 0.22 * t));
    beam.addColorStop(1, fadeColor(s.rgb, 0));
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(half) * len, -Math.sin(half) * len);
    ctx.lineTo(Math.cos(half) * len, Math.sin(half) * len);
    ctx.closePath();
    ctx.fillStyle = beam;
    ctx.fill();
    ctx.setLineDash([8, 8]);
    ctx.lineDashOffset = -time * 35;
    ctx.strokeStyle = fadeColor(s.rgb, 0.42 + t * 0.21);
    ctx.lineWidth = 1.35;
    ctx.stroke();
    ctx.setLineDash([]);
    gather(ctx, b.r, t, time, s, detail);
  } else {
    const envelope = (1 - t) ** 0.64;
    const front = len * (0.13 + 0.97 * easeOut(t * 1.36));
    const spread = Math.tan(half) * front * 0.83;
    const g = ctx.createLinearGradient(0, 0, front, 0);
    g.addColorStop(0, fadeColor(s.rgb, 0));
    g.addColorStop(0.25, fadeColor(s.rgb, envelope * 0.34));
    g.addColorStop(0.78, fadeColor(s.second, envelope * 0.56));
    g.addColorStop(1, fadeColor(s.rgb, 0));
    polygon(ctx, [[b.r * 0.42, 0], [front * 0.65, -spread * 0.72], [front, -spread], [front * 0.92, 0],
      [front, spread], [front * 0.66, spread * 0.72]], g);
    for (let j = 0; j < 3; j++) {
      const wave = front * (1 - j * 0.20);
      const yy = Math.tan(half) * wave;
      ctx.beginPath();
      ctx.moveTo(wave * 0.84, -yy);
      ctx.quadraticCurveTo(wave * 1.18, 0, wave * 0.84, yy);
      ctx.strokeStyle = j === 0 ? `rgba(255,239,208,${envelope * 0.91})` : fadeColor(s.rgb, envelope * (0.55 - j * 0.09));
      ctx.lineWidth = 4.5 - j;
      ctx.stroke();
    }
    const count = detail > 0.58 ? 11 : 5;
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const a = ((i + 0.5) / count - 0.5) * half * 1.96;
      const tail = front * (0.21 + (i % 3) * 0.10);
      const head = front * (0.74 + (i % 4) * 0.055);
      ctx.moveTo(Math.cos(a) * tail, Math.sin(a) * tail);
      ctx.lineTo(Math.cos(a) * head, Math.sin(a) * head);
    }
    ctx.strokeStyle = `rgba(255,242,212,${envelope * 0.76})`;
    ctx.lineWidth = 1.9;
    ctx.stroke();
    ctx.globalAlpha = envelope;
    const core = ctx.createLinearGradient(b.r, 0, front, 0);
    core.addColorStop(0, 'rgba(255,178,102,0)');
    core.addColorStop(0.22, 'rgba(255,219,153,0.57)');
    core.addColorStop(0.69, 'rgba(255,251,231,0.93)');
    core.addColorStop(1, 'rgba(255,223,174,0)');
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(1, side);
      polygon(ctx, [[b.r * 1.05, 0], [front * 0.37, spread * 0.26],
        [front * 0.81, spread * 0.57], [front * 0.52, spread * 0.31], [front * 0.63, spread * 0.37]], core);
      polygon(ctx, [[b.r * 1.64, 0.35 * b.r], [front * 0.52, spread * 0.52],
        [front * 0.96, spread * 0.91], [front * 0.61, spread * 0.56]], core);
      ctx.restore();
    }
  }
  ctx.restore();
}

function glove(ctx, b, a) {
  if (a.mode !== 'windup' && a.mode !== 'active') return;
  const wind = a.mode === 'windup';
  const t = progress(a);
  const punch = wind ? 0 : easeOut(a.time / 0.102);
  const alpha = wind ? easeOut(t) * 0.78 : unit(1 - (t - 0.32) / 0.67);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(b.x, b.y);
  ctx.rotate(a.angle);
  ctx.translate(b.r * (1.03 + punch * 1.07), 0);
  ctx.scale(b.r * (0.51 + punch * 0.47), b.r * (0.51 + punch * 0.47));
  halo(ctx, 0.28, 0, 1.46, FX_STYLE.saitama.rgb, punch * 0.39);
  ctx.beginPath();
  ctx.moveTo(-0.92, -0.30);
  ctx.lineTo(-0.57, -0.42);
  ctx.quadraticCurveTo(-0.47, -0.64, -0.22, -0.65);
  ctx.quadraticCurveTo(0.02, -0.87, 0.32, -0.73);
  ctx.quadraticCurveTo(0.58, -0.81, 0.72, -0.55);
  ctx.bezierCurveTo(1.15, -0.54, 1.18, 0.52, 0.71, 0.57);
  ctx.quadraticCurveTo(0.47, 0.79, 0.13, 0.68);
  ctx.quadraticCurveTo(-0.38, 0.74, -0.59, 0.41);
  ctx.lineTo(-0.92, 0.33);
  ctx.closePath();
  const leather = ctx.createRadialGradient(0.38, -0.38, 0.016, 0.25, 0, 1.27);
  leather.addColorStop(0, '#ffb7ac');
  leather.addColorStop(0.35, '#fa5a59');
  leather.addColorStop(0.65, '#b1213c');
  leather.addColorStop(1, '#370b25');
  ctx.fillStyle = leather;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 0.063;
  ctx.strokeStyle = '#471425';
  ctx.stroke();
  polygon(ctx, [[-0.93, -0.33], [-0.66, -0.43], [-0.63, 0.43], [-0.93, 0.34]], '#851b38', '#fcc0ac', 0.034);
  ctx.beginPath();
  ctx.moveTo(-0.16, -0.47);
  ctx.quadraticCurveTo(0.12, -0.59, 0.37, -0.48);
  ctx.moveTo(0.24, -0.24);
  ctx.quadraticCurveTo(0.64, -0.52, 0.86, -0.21);
  ctx.moveTo(0.32, 0.07);
  ctx.quadraticCurveTo(0.63, -0.08, 0.87, 0.07);
  ctx.moveTo(-0.29, 0.25);
  ctx.quadraticCurveTo(0.04, 0.14, 0.12, 0.45);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#ffbbab';
  ctx.lineWidth = 0.045;
  ctx.stroke();
  ctx.restore();
}

function chargeField(ctx, b, a, time, detail) {
  const s = FX_STYLE[b.type], t = progress(a);
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(a.angle);
  const r = b.r;
  halo(ctx, 0, 0, r * (2.04 + t * 0.55), s.rgb, 0.26 + t * 0.25);
  gather(ctx, r, t, time, s, detail);

  if (b.type === 'naruto') drawRasenshuriken(ctx, r * 1.56, 0, r * (0.23 + t * 0.52), time * 26, 0.46 + t * 0.54, detail);
  else if (b.type === 'vegeta') {
    drawHakaiOrb(ctx, r * 1.56, 0, r * (0.19 + t * 0.40), time, 0.4 + t * 0.6, detail);
    arc(ctx, r * 1.56, 0, r * (2.01 - t * 0.99), -1.68, 1.72, fadeColor(s.rgb, t * 0.5), 1.5);
  } else if (b.type === 'ichigo') {
    const angle = -1.18 + t * 1.2;
    ribbon(ctx, r * 1.96, r * 0.41, angle - 1.78, 1.78, '#1a0a23');
    ribbon(ctx, r * 2.10, r * 0.14, angle - 1.78, 1.78, fadeColor(s.rgb, 0.50 + t * 0.48));
    ribbon(ctx, r * 2.13, r * 0.05, angle - 0.65, 0.64, '#ffdae5');
  } else if (b.type === 'shanks') {
    arc(ctx, 0, 0, r * (1.45 + t * 1.44), 0, TAU, fadeColor(s.rgb, 0.24 + t * 0.44), 1.4);
    drawHakiForks(ctx, r * (1.04 + t * 0.74), time, detail, 0.58 + t * 0.31);
  } else if (b.type === 'broly' || b.type === 'gurren') {
    ctx.setLineDash([7, 7]);
    ctx.lineDashOffset = -time * 31;
    ctx.beginPath();
    ctx.moveTo(r * 1.2, 0);
    ctx.lineTo(r * 5.7, 0);
    ctx.strokeStyle = fadeColor(s.rgb, 0.41 + t * 0.36);
    ctx.lineWidth = 1.65;
    ctx.stroke();
    ctx.setLineDash([]);
    sweep(ctx, r * (1.7 - t * 0.31), time * 4.6, s.rgb, 3, 0.10);
  }
  ctx.restore();
}

function brolyRush(ctx, b, a, time, detail) {
  if (a.done) return;
  const s = FX_STYLE.broly;
  const r = b.r;
  ctx.save();
  drawTrail(ctx, b, s.second, r * 2.05, detail, 0.9);
  ctx.translate(b.x, b.y);
  ctx.rotate(a.angle);
  ctx.scale(r, r);
  const fire = ctx.createLinearGradient(-4.9, 0, 1.6, 0);
  fire.addColorStop(0, 'rgba(40,212,124,0)');
  fire.addColorStop(0.33, 'rgba(35,207,103,0.32)');
  fire.addColorStop(0.72, 'rgba(103,230,58,0.58)');
  fire.addColorStop(1, 'rgba(209,255,116,0.94)');
  const w = Math.sin(time * 25) * 0.14;
  ctx.beginPath();
  ctx.moveTo(-5, w);
  ctx.quadraticCurveTo(-1.46, -1.40 - w, -0.19, -1.16);
  ctx.bezierCurveTo(2.00, -1.35, 2.10, 1.35, -0.19, 1.15);
  ctx.quadraticCurveTo(-1.6, 1.19 + w, -5, w);
  ctx.fillStyle = fire;
  ctx.fill();
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(1, side);
    polygon(ctx, [[-5.5, w * 0.43], [-2.0, -0.23], [-3.38, -0.63], [-1.25, -0.78],
      [-1.91, -1.02], [-0.72, -1.05], [-1.47, -0.43], [-0.18, -0.63]], fire);
    ctx.restore();
  }
  ribbon(ctx, 1.28, 0.26, -1.30, 2.60, '#ddff92');
  ribbon(ctx, 1.42, 0.11, -0.93, 1.86, '#f3ffdf');
  if (detail > 0.6) ribbon(ctx, 1.57, 0.074, -0.67, 1.34, fadeColor(s.second, 0.77));
  ctx.restore();
}

function drill(ctx, b, a, detail, reduced) {
  const active = a.mode === 'active';
  const s = FX_STYLE.gurren;
  const t = active ? 1 : easeOut(progress(a));
  const spin = a.time * (reduced ? 8 : active ? 32 : 19);
  const r = b.r;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(a.angle);
  ctx.scale(r, r);
  ctx.globalAlpha = active ? 1 : 0.25 + t * 0.75;
  ctx.lineJoin = 'round';
  const root = 0.79, tip = root + (0.54 + 1.98 * t), w = 0.34 + t * 0.43;
  halo(ctx, tip, 0, 1.39, s.rgb, 0.44 * t);
  const body = ctx.createLinearGradient(0, -w, 0, w);
  body.addColorStop(0, '#bdc4ea');
  body.addColorStop(0.18, '#f0ffff');
  body.addColorStop(0.38, '#938cb6');
  body.addColorStop(0.63, '#42486a');
  body.addColorStop(0.81, '#282443');
  body.addColorStop(1, '#8073a2');
  polygon(ctx, [[root - 0.13, -w * 0.86], [root + 0.25, -w], [tip, 0], [root + 0.25, w], [root - 0.13, w * 0.86]],
    body, '#182037', 0.053);
  ctx.save();
  ctx.clip();
  const pitch = 0.47;
  for (let x = root - 0.61 + (spin * 0.061) % pitch; x <= tip + pitch; x += pitch) {
    ctx.beginPath();
    ctx.moveTo(x + 0.18, -w * 1.15);
    ctx.bezierCurveTo(x - 0.24, -w * 0.29, x + 0.42, w * 0.44, x + 0.26, w * 1.15);
    ctx.strokeStyle = '#2a2851';
    ctx.lineWidth = 0.19;
    ctx.stroke();
    ctx.strokeStyle = '#80ffd0';
    ctx.lineWidth = 0.065;
    ctx.stroke();
  }
  ctx.restore();
  polygon(ctx, [[root - 0.15, -w * 0.77], [root + 0.085, -w * 0.98], [root + 0.18, w * 0.98], [root - 0.15, w * 0.77]], '#354262', '#edfaff', 0.038);
  polygon(ctx, [[tip - 0.34, -0.15], [tip + 0.15, 0], [tip - 0.31, 0.12], [tip - 0.43, 0]], '#d6fff0');
  if (active) {
    const count = detail > 0.58 ? 8 : 4;
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const f = (a.time * 3.3 + i * 0.384) % 1;
      const x = tip - f * 2.91;
      const y = (0.1 + f * 0.72) * Math.sin(i * 2.63 + spin * 0.28);
      ctx.moveTo(x - 0.24 - f * 0.44, y + 0.14 * f);
      ctx.lineTo(x + 0.028, y);
    }
    ctx.strokeStyle = '#fff5b0';
    ctx.lineWidth = 0.047;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawEgoPips(ctx, b, a, time) {
  const r = b.r;
  ctx.save();
  ctx.translate(b.x, b.y);
  for (let i = 0; i < 5; i++) {
    const angle = 0.70 + i * 0.43;
    const x = Math.cos(angle) * r * 1.32;
    const y = Math.sin(angle) * r * 1.32;
    const d = r * 0.075;
    const on = i < a.ego;
    polygon(ctx, [[x - d, y], [x, y - d * 1.35], [x + d, y], [x, y + d * 1.35]],
      on ? fadeColor(FX_STYLE.vegeta.rgb, 0.85 + 0.14 * Math.sin(time * 6 - i)) : '#20172e', on ? '#ffc8ff' : '#50375e', 0.85);
  }
  ctx.restore();
}

export function drawPackFloor(ctx, b, a, helpers, time, detail, foe) {
  if (b.type === 'dio') {
    timeStop(ctx, b, a, helpers, time, detail);
    timeStopTarget(ctx, a, foe);
  } else if (b.type === 'madara') spiritArmor(ctx, b, a, time, detail);
  else if (b.type === 'saitama') punchCone(ctx, b, a, helpers, time, detail);
  else if (a.mode === 'windup') chargeField(ctx, b, a, time, detail);
  else if (a.mode === 'active' && b.type === 'broly') brolyRush(ctx, b, a, time, detail);
  else if (a.mode === 'active' && b.type === 'gurren') {
    ctx.save();
    drawTrail(ctx, b, FX_STYLE.gurren.rgb, b.r * 1.06, detail, 0.72);
    ctx.translate(b.x, b.y);
    sweep(ctx, b.r * 1.53, time * 12, FX_STYLE.gurren.rgb, 3, 0.086);
    ctx.restore();
  } else if (a.mode === 'active' && b.type === 'shanks') {
    const t = progress(a), s = FX_STYLE.shanks;
    ctx.save();
    ctx.translate(a.x, a.y);
    const reach = b.r * (1.15 + easeOut(t) * 2.07);
    arc(ctx, 0, 0, reach, 0, TAU, fadeColor(s.rgb, 0.83 * (1 - t)), 2.1);
    drawHakiForks(ctx, reach * 0.77, time, detail, 1 - t);
    ctx.restore();
  }
}

export function drawPackFront(ctx, b, a, detail, reduced) {
  if (b.type === 'saitama') glove(ctx, b, a);
  else if (b.type === 'gurren' && (a.mode === 'windup' || a.mode === 'active')) drill(ctx, b, a, detail, reduced);
  else if (b.type === 'madara') bladeSweep(ctx, b, a, detail);
}