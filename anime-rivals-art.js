import { drawPackArrow, drawPackAura, drawPackPortrait } from './anime-pack-art.js';

const TAU = Math.PI * 2;
const ORIGINAL = new Set(['goku', 'luffy', 'sukuna']);
const HAIR = [
  ['#485a7c', '#151e34', '#090c1a', '#6385ab'],
  ['#fff7c0', '#ffd452', '#ab561c', '#fff6ad'],
  ['#c6fdff', '#29d6f6', '#1653a1', '#9afeff'],
];

function gradient(c, x0, y0, x1, y1, stops) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  for (const [p, col] of stops) g.addColorStop(p, col);
  return g;
}

function polygon(c, points, fill, outline, thickness = 0.029) {
  c.beginPath();
  for (let i = 0; i < points.length; i++) {
    const [x, y] = points[i];
    if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
  }
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  if (outline) { c.lineWidth = thickness; c.strokeStyle = outline; c.stroke(); }
}

function oval(c, x, y, a, b, fill, tilt = 0) {
  c.beginPath();
  c.ellipse(x, y, a, b, tilt, 0, TAU);
  c.fillStyle = fill;
  c.fill();
}

function stroke(c, ctxPath, color, width) {
  c.beginPath();
  ctxPath(c);
  c.lineWidth = width;
  c.strokeStyle = color;
  c.stroke();
}

function drawSkin(c, type) {
  const skin = c.createRadialGradient(-0.37, -0.47, 0.17, 0, 0, 1.16);
  skin.addColorStop(0, type === 'luffy' ? '#fff1df' : '#ffe1bd');
  skin.addColorStop(0.55, type === 'sukuna' ? '#e8a48f' : '#f4b684');
  skin.addColorStop(0.81, '#d98261');
  skin.addColorStop(1, '#834659');
  c.beginPath();
  c.arc(0, 0, 1, 0, TAU);
  c.fillStyle = skin;
  c.fill();
  c.strokeStyle = '#171424';
  c.lineWidth = 0.048;
  c.stroke();

  // Costume color follows the lower curve of the sphere, without hiding the face.
  c.save();
  c.clip();
  c.beginPath();
  c.moveTo(-1.0, 0.46);
  c.quadraticCurveTo(-0.68, 0.55, -0.41, 0.69);
  c.quadraticCurveTo(0, 0.92, 0.41, 0.69);
  c.quadraticCurveTo(0.68, 0.55, 1, 0.46);
  c.lineTo(1, 1.05);
  c.lineTo(-1, 1.05);
  c.closePath();
  const cloth = type === 'goku' ? ['#ffad3d', '#cf4d24'] : type === 'luffy' ? ['#fff9ff', '#afa3d8'] : ['#3d1c36', '#1c1229'];
  c.fillStyle = gradient(c, 0, 0.53, 0, 1.03, [[0, cloth[0]], [1, cloth[1]]]);
  c.fill();
  c.strokeStyle = type === 'goku' ? '#213450' : type === 'luffy' ? '#9e8abd' : '#262138';
  c.lineWidth = 0.047;
  c.stroke();
  c.restore();
}

function gokuHair(c, form) {
  const [light, mid, dark, gleam] = HAIR[form];
  const base = gradient(c, -0.36, -1.57, 0.3, -0.19, [[0, light], [0.58, mid], [1, dark]]);
  polygon(c, [
    [-0.84, 0.04], [-0.98, -0.22], [-1.27, -0.26], [-1.01, -0.49],
    [-1.47, -0.77], [-0.96, -0.79], [-1.16, -1.23], [-0.63, -1.07],
    [-0.61, -1.62], [-0.11, -1.26], [0.11, -1.64], [0.39, -1.19],
    [0.92, -1.5], [0.78, -1.03], [1.28, -1.13], [0.99, -0.65],
    [1.18, -0.65], [0.89, -0.31], [0.91, -0.01], [0.57, -0.36],
    [0.26, -0.27], [0.36, -0.66], [0.01, -0.36], [-0.46, -0.26],
    [-0.36, -0.53], [-0.69, -0.27],
  ], base, dark, 0.055);
  const shards = [
    [[-1.36, -0.75], [-0.81, -0.73], [-0.50, -0.42]],
    [[-1.10, -1.18], [-0.65, -1.01], [-0.28, -0.54]],
    [[-0.57, -1.52], [-0.21, -1.16], [-0.18, -0.60]],
    [[0.12, -1.55], [0.38, -1.10], [0.11, -0.62]],
    [[0.85, -1.38], [0.64, -0.96], [0.37, -0.62]],
    [[1.18, -1.06], [0.89, -0.66], [0.58, -0.49]],
  ];
  c.save();
  c.globalAlpha = form ? 0.64 : 0.32;
  for (const shard of shards) polygon(c, shard, gleam);
  c.restore();
}

function gokuFace(c, form, look) {
  // Angular eyes, dark brows, and an off-center half-smile.
  for (const s of [-1, 1]) {
    c.save();
    c.scale(s, 1);
    polygon(c, [[0.12, 0.005], [0.56, -0.117], [0.48, 0.13], [0.22, 0.13]], '#fff9f1', '#542938', 0.026);
    oval(c, 0.33 + look * s, 0.048, 0.047, 0.075, form ? '#145a69' : '#1a1828');
    polygon(c, [[0.10, -0.065], [0.57, -0.231], [0.58, -0.121], [0.15, 0.026]], HAIR[form][2]);
    c.restore();
  }
  stroke(c, p => { p.moveTo(-0.042, 0.25); p.lineTo(0.035, 0.286); p.lineTo(0.109, 0.251); }, '#ad6352', 0.024);
  stroke(c, p => { p.moveTo(-0.22, 0.419); p.quadraticCurveTo(0.028, 0.507, 0.26, 0.401); }, '#5d323d', 0.043);
}

function drawSaiyanAura(c, form, clock, quality) {
  if (!form) return;
  const col = form === 1 ? '255,192,55' : '68,213,255';
  const pulse = 0.90 + Math.sin(clock * 7) * 0.07;
  const g = c.createRadialGradient(0, -0.10, 0.60, 0, -0.10, 1.85);
  g.addColorStop(0, `rgba(${col},0.25)`);
  g.addColorStop(0.60, `rgba(${col},${0.30 * pulse})`);
  g.addColorStop(1, `rgba(${col},0)`);
  oval(c, 0, -0.10, 1.85, 1.85, g);
  if (quality < 0.58) return;
  const count = 10;
  c.beginPath();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU, d = 1.09 + 0.25 * Math.sin(clock * 9 + i * 2.7) ** 2;
    const xx = Math.cos(a) * d, yy = Math.sin(a) * d - 0.20;
    c.moveTo(xx, yy + 0.09);
    c.lineTo(xx + Math.cos(a) * 0.12, yy - 0.20);
  }
  c.strokeStyle = `rgba(${col},0.58)`;
  c.lineWidth = 0.042;
  c.stroke();
}

function drawSteam(c, clock, mini) {
  c.save();
  c.lineCap = 'round';
  for (let i = 0; i < 2; i++) {
    const shift = mini ? 0 : Math.sin(clock * 1.8 + i * Math.PI) * 0.11;
    const steamPath = p => {
      p.moveTo(-1.03, 0.51 + shift);
      p.bezierCurveTo(-1.42, 0.51, -1.49, -0.12, -1.16, -0.22);
      p.bezierCurveTo(-0.92, -0.27, -0.84, 0.01, -1.04, 0.01);
      p.moveTo(0.58, 0.68 - shift);
      p.bezierCurveTo(1.16, 0.84, 1.42, 0.37, 1.30, 0.03);
      p.bezierCurveTo(1.20, -0.24, 0.99, -0.23, 0.99, -0.07);
    };
    stroke(c, steamPath, i ? '#faf2ff' : '#b4a0d8', i ? 0.15 : 0.23);
  }
  c.restore();
}

function luffyHair(c) {
  const cloud = gradient(c, -0.65, -1.45, 0.50, -0.19, [[0, '#ffffff'], [0.46, '#fffaff'], [1, '#c4b5e3']]);
  c.beginPath();
  c.moveTo(-0.96, -0.11);
  c.bezierCurveTo(-1.35, -0.10, -1.40, -0.55, -1.09, -0.63);
  c.bezierCurveTo(-1.29, -0.94, -0.98, -1.14, -0.76, -1.02);
  c.bezierCurveTo(-0.95, -1.42, -0.56, -1.34, -0.53, -1.44);
  c.quadraticCurveTo(-0.28, -1.78, -0.06, -1.38);
  c.bezierCurveTo(0.11, -1.74, 0.39, -1.51, 0.36, -1.29);
  c.bezierCurveTo(0.56, -1.57, 0.88, -1.30, 0.79, -1.06);
  c.bezierCurveTo(1.11, -1.19, 1.36, -0.87, 1.09, -0.64);
  c.bezierCurveTo(1.42, -0.56, 1.31, -0.06, 0.96, -0.12);
  c.bezierCurveTo(0.93, -0.34, 0.75, -0.48, 0.62, -0.37);
  c.bezierCurveTo(0.46, -0.16, 0.16, -0.17, 0.22, -0.49);
  c.bezierCurveTo(0.17, -0.08, -0.20, -0.14, -0.28, -0.39);
  c.bezierCurveTo(-0.46, -0.15, -0.67, -0.18, -0.66, -0.53);
  c.quadraticCurveTo(-0.88, -0.43, -0.96, -0.11);
  c.closePath();
  c.fillStyle = cloud;
  c.fill();
  c.strokeStyle = '#9f8ec6';
  c.lineWidth = 0.05;
  c.stroke();
  const curls = [[-0.89, -0.63, 0.18], [-0.53, -1.03, 0.22], [-0.12, -1.22, 0.21], [0.27, -0.90, 0.27], [0.73, -0.90, 0.18], [1.01, -0.51, 0.13]];
  c.strokeStyle = '#b3a2d5';
  c.lineWidth = 0.029;
  for (let i = 0; i < curls.length; i++) {
    const [x, y, rad] = curls[i];
    c.beginPath();
    c.arc(x, y, rad, (i % 2) * 0.7, 4.8 + i * 0.17);
    c.stroke();
  }
}

function luffyFace(c) {
  for (const s of [-1, 1]) {
    c.save(); c.scale(s, 1);
    oval(c, 0.32, 0.035, 0.19, 0.17, '#fff9f0', -0.19);
    oval(c, 0.30, 0.045, 0.075, 0.093, '#bc344a');
    oval(c, 0.295, 0.039, 0.028, 0.04, '#210f26');
    oval(c, 0.274, 0.01, 0.017, 0.02, '#fff5fc');
    stroke(c, p => { p.moveTo(0.13, -0.085); p.quadraticCurveTo(0.30, -0.24, 0.49, -0.12); }, '#fff7ff', 0.063);
    c.restore();
  }
  stroke(c, p => { p.moveTo(-0.52, 0.219); p.lineTo(-0.35, 0.25); p.moveTo(-0.468, 0.197); p.lineTo(-0.482, 0.263); }, '#9f4c58', 0.027);
  c.beginPath();
  c.moveTo(-0.49, 0.303);
  c.quadraticCurveTo(0.01, 0.435, 0.49, 0.283);
  c.bezierCurveTo(0.40, 0.67, -0.38, 0.74, -0.49, 0.303);
  c.fillStyle = '#492131'; c.fill();
  c.save(); c.clip();
  c.beginPath();
  c.moveTo(-0.5, 0.302);
  c.quadraticCurveTo(0.01, 0.415, 0.5, 0.277);
  c.lineTo(0.5, 0.415);
  c.quadraticCurveTo(0.02, 0.57, -0.48, 0.431);
  c.closePath(); c.fillStyle = '#fffaf4'; c.fill(); c.restore();
}

function sukunaHair(c) {
  const ink = gradient(c, -0.30, -1.39, 0.38, -0.26, [[0, '#f78493'], [0.32, '#b24e69'], [0.65, '#5b263e'], [1, '#1d142a']]);
  polygon(c, [
    [-0.96, 0.11], [-1.03, -0.31], [-1.17, -0.55], [-0.98, -0.56],
    [-1.15, -0.90], [-0.88, -0.86], [-0.93, -1.15], [-0.64, -1.06],
    [-0.59, -1.34], [-0.37, -1.15], [-0.22, -1.43], [-0.06, -1.19],
    [0.10, -1.45], [0.23, -1.22], [0.54, -1.37], [0.54, -1.15],
    [0.94, -1.24], [0.79, -0.97], [1.11, -1.00], [0.98, -0.69],
    [1.15, -0.70], [0.98, -0.41], [0.99, 0.11], [0.81, -0.19],
    [0.72, -0.47], [0.41, -0.65], [0.10, -0.661], [-0.19, -0.55],
    [-0.38, -0.61], [-0.78, -0.32],
  ], ink, '#130e22', 0.049);
  const highlights = [[-0.87,-1.08,-0.55,-0.73], [-0.59,-1.25,-0.30,-0.82], [-0.20,-1.33,-0.08,-0.86], [0.10,-1.37,0.12,-0.95], [0.48,-1.26,0.30,-0.85], [0.84,-1.14,0.56,-0.77]];
  for (const [x, y, dstx, dsty] of highlights) {
    stroke(c, p => { p.moveTo(x, y); p.quadraticCurveTo(x - 0.02, dsty - 0.13, dstx, dsty); }, 'rgba(255,165,173,0.58)', 0.055);
  }
}

function sukunaFace(c, look) {
  const mark = '#261324';
  for (const s of [-1, 1]) {
    c.save(); c.scale(s, 1);
    polygon(c, [[0.13, -0.004], [0.56, -0.165], [0.48, 0.055], [0.24, 0.111]], '#fff0eb', mark);
    oval(c, 0.33 + look * s, 0.017, 0.048, 0.065, '#9e213d');
    oval(c, 0.33 + look * s, 0.019, 0.014, 0.04, '#1b1026');
    polygon(c, [[0.12, 0.022], [0.54, -0.21], [0.65, -0.162], [0.55, -0.112]], mark);
    stroke(c, p => { p.moveTo(0.71, -0.19); p.lineTo(0.67, 0.13); p.lineTo(0.59, 0.19); p.moveTo(0.67, 0.298); p.lineTo(0.60, 0.44); p.lineTo(0.53, 0.48); }, mark, 0.048);
    stroke(c, p => { p.moveTo(0.37, 0.183); p.quadraticCurveTo(0.45, 0.138, 0.53, 0.178); }, mark, 0.043);
    c.restore();
  }
  polygon(c, [[0, -0.52], [0.085, -0.36], [0, -0.256], [-0.085, -0.36]], mark);
  polygon(c, [[0, -0.458], [0.038, -0.367], [0, -0.304], [-0.038, -0.367]], '#e9a18a');
  stroke(c, p => { p.moveTo(-0.173, 0.233); p.quadraticCurveTo(0, 0.274, 0.175, 0.223); }, mark, 0.049);
  c.beginPath();
  c.moveTo(-0.22, 0.413);
  c.quadraticCurveTo(0.137, 0.46, 0.338, 0.329);
  c.quadraticCurveTo(0.14, 0.642, -0.22, 0.413);
  c.fillStyle = '#542036'; c.fill();
  stroke(c, p => { p.moveTo(-0.075, 0.443); p.quadraticCurveTo(0.12, 0.468, 0.265, 0.391); }, '#fff0ed', 0.030);
}

export function drawAnimeAura(c, x, y, r, type, form, clock, quality, isMini) {
  if (!ORIGINAL.has(type)) {
    if (isMini) return;
    c.save();
    c.translate(x, y);
    c.scale(r, r);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    drawPackAura(c, type, form, clock, quality, isMini);
    c.restore();
    return;
  }
  if (type !== 'luffy' && (type !== 'goku' || !form || isMini)) return;
  c.save();
  c.translate(x, y);
  c.scale(r, r);
  if (type === 'luffy') drawSteam(c, clock, isMini);
  else drawSaiyanAura(c, form, clock, quality);
  c.restore();
}

export function drawAnimePortrait(c, x, y, r, type, form) {
  c.save();
  c.translate(x, y);
  c.scale(r, r);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  if (!ORIGINAL.has(type)) {
    drawPackPortrait(c, type, form);
    c.restore();
    return;
  }
  drawSkin(c, type);
  if (type === 'goku') { gokuHair(c, form); gokuFace(c, form, 0); }
  else if (type === 'luffy') { luffyHair(c); luffyFace(c); }
  else sukunaFaceWithHair(c);
  c.restore();
}

function sukunaFaceWithHair(c) {
  sukunaHair(c);
  sukunaFace(c, 0);
}

function kiArrow(c, clock, form) {
  const ice = form === 1 ? '#ffe76d' : '#87f6ff';
  const mid = form === 1 ? '#e79330' : '#278efe';
  const navy = form === 1 ? '#55363b' : '#1b2a83';
  const g = gradient(c, 0, -0.25, 0.85, 0.25, [[0, navy], [0.43, mid], [0.80, ice], [1, '#ffffff']]);
  polygon(c, [[-0.15, -0.19], [0.13, -0.109], [0.45, -0.126], [0.39, -0.27], [0.72, -0.18], [1.04, 0], [0.72, 0.18], [0.38, 0.27], [0.46, 0.13], [0.13, 0.104], [-0.16, 0.17], [-0.065, 0]], g, navy, 0.027);
  polygon(c, [[-0.035, 0], [0.53, -0.064], [0.62, -0.14], [0.97, 0], [0.62, 0.14], [0.53, 0.064]], '#effcff');
  for (const s of [-1, 1]) {
    stroke(c, p => { p.moveTo(0.06, s * 0.172); p.lineTo(0.23, s * 0.212); p.lineTo(0.30, s * 0.178); }, ice, 0.022);
  }
  const pulse = ((clock * 1.9) % 1) * 0.45;
  oval(c, 0.09 + pulse, -0.115, 0.028, 0.014, '#ffffff');
}

function fistArrow(c) {
  const rubber = gradient(c, 0.3, -0.13, 0.3, 0.14, [[0, '#fff6e4'], [0.55, '#f8be99'], [1, '#99617c']]);
  polygon(c, [[-0.08, -0.070], [0.25, -0.035], [0.50, -0.112], [0.67, -0.091], [0.64, 0.11], [0.43, 0.112], [0.19, 0.086], [-0.08, 0.043]], rubber, '#61446b', 0.028);
  stroke(c, p => {
    p.moveTo(-0.13, 0.12); p.bezierCurveTo(0.019, 0.23, 0.24, 0.202, 0.34, 0.113);
    p.bezierCurveTo(0.41, 0.032, 0.29, 0.014, 0.27, 0.083);
    p.moveTo(-0.12, -0.15); p.bezierCurveTo(-0.05, -0.26, 0.15, -0.184, 0.23, -0.139);
  }, '#eee5ff', 0.067);
  polygon(c, [[0.70, -0.215], [1.05, 0], [0.72, 0.208], [0.83, 0]], '#ff819e', '#682f53');
  c.beginPath();
  c.moveTo(0.44, -0.086);
  c.quadraticCurveTo(0.42, -0.21, 0.55, -0.21);
  c.quadraticCurveTo(0.64, -0.27, 0.69, -0.212);
  c.quadraticCurveTo(0.78, -0.245, 0.82, -0.182);
  c.bezierCurveTo(0.995, -0.20, 0.99, 0.184, 0.79, 0.188);
  c.quadraticCurveTo(0.55, 0.244, 0.466, 0.105);
  c.closePath();
  c.fillStyle = gradient(c, 0.49, -0.22, 0.79, 0.26, [[0, '#8d688a'], [0.43, '#3b2845'], [1, '#130d1e']]);
  c.fill(); c.strokeStyle = '#ffd0eb'; c.lineWidth = 0.027; c.stroke();
  for (let i = 0; i < 3; i++) {
    const x = 0.576 + i * 0.102;
    stroke(c, p => { p.moveTo(x, -0.173); p.quadraticCurveTo(x + 0.061, -0.108, x + 0.046, -0.053); }, '#dc9db9', 0.021);
  }
}

function shrineArrow(c) {
  const ink = gradient(c, 0, -0.31, 0.65, 0.20, [[0, '#a32e50'], [0.45, '#482038'], [1, '#190c25']]);
  polygon(c, [[-0.09, -0.135], [0.17, -0.082], [0.44, -0.116], [0.576, 0.019], [0.43, 0.133], [0.13, 0.086], [-0.09, 0.158]], ink, '#b24b6b');
  for (const [y, w] of [[-0.139, 0.14], [-0.044, 0.18]]) {
    c.beginPath();
    c.moveTo(0.22 - w, y - 0.055);
    c.quadraticCurveTo(0.22 - w * 0.7, y - 0.005, 0.22, y - 0.075);
    c.quadraticCurveTo(0.22 + w * 0.7, y - 0.005, 0.22 + w, y - 0.055);
    c.lineTo(0.22 + w * 0.7, y + 0.02);
    c.lineTo(0.22 - w * 0.7, y + 0.02);
    c.closePath(); c.fillStyle = '#ed8694'; c.fill();
  }
  c.fillStyle = '#c24e6b'; c.fillRect(0.14, -0.026, 0.026, 0.103); c.fillRect(0.27, -0.026, 0.026, 0.103);
  c.beginPath();
  c.moveTo(0.39, -0.198);
  c.quadraticCurveTo(0.66, -0.306, 1.07, -0.007);
  c.quadraticCurveTo(0.79, 0.005, 0.40, 0.23);
  c.quadraticCurveTo(0.59, -0.04, 0.39, -0.198);
  c.closePath();
  c.fillStyle = gradient(c, 0.59, -0.23, 0.64, 0.22, [[0, '#ffe1e6'], [0.32, '#ff517e'], [0.71, '#c71e4c'], [1, '#550a2e']]);
  c.fill(); c.strokeStyle = '#3d1032'; c.lineWidth = 0.023; c.stroke();
  stroke(c, p => { p.moveTo(0.56, -0.131); p.quadraticCurveTo(0.77, -0.14, 1.00, -0.015); }, '#ffe8ed', 0.029);
  stroke(c, p => { p.moveTo(0.34, 0.221); p.quadraticCurveTo(0.59, 0.228, 0.79, 0.102); }, '#f67398', 0.023);
}

export function drawAnimeArrow(c, b, alpha, layout, clock) {
  const length = layout.tip - layout.x0;
  if (length <= 0) return;
  c.save();
  c.translate(b.x, b.y);
  c.rotate(b.angle);
  c.translate(layout.x0, 0);
  c.scale(length, length);
  c.globalAlpha = alpha;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  if (b.type === 'goku') kiArrow(c, clock, b.anime?.form ?? 0);
  else if (b.type === 'luffy') fistArrow(c);
  else if (b.type === 'sukuna') shrineArrow(c);
  else drawPackArrow(c, b.type, clock);
  c.restore();
}
