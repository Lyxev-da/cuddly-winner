// Vector portraits, dynamic auras, and custom aim arrows for the 9 additional
// Anime Ball vs Ball fighters (verified from Roblox place 94075854820030 icon,
// store thumbnails rbx0/rbx1/rbx3/rbx4/rbx5/rbx7, and preview video 71555087621325).

const TAU = Math.PI * 2;

function grad(c, x0, y0, x1, y1, stops) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  for (const [p, col] of stops) g.addColorStop(p, col);
  return g;
}

function rgrad(c, x0, y0, r0, x1, y1, r1, stops) {
  const g = c.createRadialGradient(x0, y0, r0, x1, y1, r1);
  for (const [p, col] of stops) g.addColorStop(p, col);
  return g;
}

function poly(c, pts, fill, strokeCol, lw = 0.03) {
  c.beginPath();
  for (let i = 0; i < pts.length; i++) {
    if (i === 0) c.moveTo(pts[i][0], pts[i][1]);
    else c.lineTo(pts[i][0], pts[i][1]);
  }
  c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (strokeCol) { c.strokeStyle = strokeCol; c.lineWidth = lw; c.stroke(); }
}

function oval(c, x, y, rx, ry, fill, rot = 0, strokeCol, lw = 0.025) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, TAU);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (strokeCol) { c.strokeStyle = strokeCol; c.lineWidth = lw; c.stroke(); }
}

function linePath(c, fn, color, lw) {
  c.beginPath();
  fn(c);
  c.strokeStyle = color;
  c.lineWidth = lw;
  c.stroke();
}

const HEAD_PALETTE = {
  dio:     { skin: ['#fff3da', '#f3c596', '#cf8e63', '#6b4252'], cloth: ['#2b2338', '#110d1b'], trim: '#f5c542' },
  madara:  { skin: ['#ffebd2', '#ebb38a', '#c97f5c', '#6e3b49'], cloth: ['#a81f33', '#4d0b18'], trim: '#221426' },
  naruto:  { skin: ['#fff0ce', '#f8be7e', '#da8748', '#7d4128'], cloth: ['#ffd247', '#df6b12'], trim: '#1d140e' },
  saitama: { skin: ['#fff4e4', '#f6c89d', '#d9936a', '#7c4c47'], cloth: ['#ffe24a', '#cf9312'], trim: '#f4f6fb' },
  ichigo:  { skin: ['#ffffff', '#eceaf3', '#c8c4d6', '#7b7691'], cloth: ['#252230', '#0c0b12'], trim: '#dc2626' },
  broly:   { skin: ['#f8d8b0', '#e39e6d', '#be6d42', '#6a352e'], cloth: ['#63d629', '#236e12'], trim: '#facc15' },
  vegeta:  { skin: ['#ffe5c4', '#efa97c', '#cc7652', '#6e374e'], cloth: ['#252238', '#0e0c1a'], trim: '#facc15' },
  shanks:  { skin: ['#ffdfc0', '#e9a679', '#c4754e', '#693939'], cloth: ['#23212c', '#0b0a10'], trim: '#b91c1c' },
};

function baseHead(c, type) {
  const p = HEAD_PALETTE[type];
  c.beginPath();
  c.arc(0, 0, 1, 0, TAU);
  c.fillStyle = rgrad(c, -0.36, -0.46, 0.14, 0, 0, 1.16, [
    [0, p.skin[0]], [0.52, p.skin[1]], [0.82, p.skin[2]], [1, p.skin[3]],
  ]);
  c.fill();
  c.strokeStyle = '#161322';
  c.lineWidth = 0.048;
  c.stroke();

  c.save();
  c.beginPath();
  c.arc(0, 0, 0.99, 0, TAU);
  c.clip();
  c.beginPath();
  c.moveTo(-1.02, 0.48);
  c.quadraticCurveTo(-0.56, 0.60, -0.34, 0.72);
  c.quadraticCurveTo(0, 0.90, 0.34, 0.72);
  c.quadraticCurveTo(0.56, 0.60, 1.02, 0.48);
  c.lineTo(1.02, 1.06);
  c.lineTo(-1.02, 1.06);
  c.closePath();
  c.fillStyle = grad(c, 0, 0.50, 0, 1.02, [[0, p.cloth[0]], [1, p.cloth[1]]]);
  c.fill();
  c.strokeStyle = p.trim;
  c.lineWidth = 0.052;
  c.stroke();
  c.restore();
}

function drawDio(c) {
  baseHead(c, 'dio');
  // Wild golden spiky hair
  const hair = grad(c, -0.3, -1.52, 0.35, -0.15, [
    [0, '#fff9bd'], [0.42, '#f9cc38'], [0.82, '#c88312'], [1, '#6e3f08'],
  ]);
  poly(c, [
    [-0.95, 0.18], [-1.14, -0.10], [-1.02, -0.32], [-1.28, -0.58], [-0.98, -0.68],
    [-1.18, -1.08], [-0.74, -0.96], [-0.72, -1.46], [-0.32, -1.12], [-0.08, -1.58],
    [0.22, -1.16], [0.58, -1.48], [0.64, -1.02], [1.14, -1.14], [0.94, -0.72],
    [1.26, -0.54], [0.98, -0.30], [1.12, 0.14], [0.86, -0.12], [0.76, -0.44],
    [0.36, -0.48], [0, -0.44], [-0.36, -0.48], [-0.76, -0.44], [-0.86, -0.10],
  ], hair, '#5a3208', 0.048);
  // Forehead circlet + green heart emblem
  poly(c, [[-0.78, -0.43], [0, -0.31], [0.78, -0.43], [0.74, -0.27], [0, -0.14], [-0.74, -0.27]],
    grad(c, -0.7, -0.3, 0.7, -0.3, [[0, '#7c5310'], [0.5, '#f4c430'], [1, '#7c5310']]), '#2f1c06', 0.03);
  c.beginPath();
  c.moveTo(0, -0.07);
  c.bezierCurveTo(-0.22, -0.22, -0.20, -0.42, 0, -0.31);
  c.bezierCurveTo(0.20, -0.42, 0.22, -0.22, 0, -0.07);
  c.fillStyle = '#22c55e';
  c.fill();
  c.strokeStyle = '#14532d';
  c.lineWidth = 0.03;
  c.stroke();
  // Fierce vampire eyes & fanged smirk
  for (const s of [-1, 1]) {
    c.save(); c.scale(s, 1);
    poly(c, [[0.14, 0.06], [0.56, -0.06], [0.50, 0.14], [0.20, 0.15]], '#fffbeb', '#2e1520', 0.026);
    oval(c, 0.34, 0.06, 0.065, 0.075, '#dc2626');
    oval(c, 0.34, 0.06, 0.022, 0.052, '#140914');
    poly(c, [[0.12, -0.01], [0.58, -0.16], [0.60, -0.08], [0.16, 0.05]], '#78440a');
    c.restore();
  }
  linePath(c, p => { p.moveTo(-0.26, 0.42); p.quadraticCurveTo(0.06, 0.52, 0.34, 0.34); }, '#3b1524', 0.044);
  poly(c, [[0.16, 0.43], [0.24, 0.56], [0.29, 0.40]], '#ffffff', '#3b1524', 0.02);
}

function drawMadara(c) {
  baseHead(c, 'madara');
  // Crimson armor plate seams on collar
  linePath(c, p => {
    p.moveTo(-0.34, 0.68); p.lineTo(-0.38, 0.96);
    p.moveTo(0.34, 0.68); p.lineTo(0.38, 0.96);
  }, '#2b0610', 0.036);
  // Glowing violet Rinnegan eyes with concentric rings
  for (const s of [-1, 1]) {
    c.save(); c.scale(s, 1);
    poly(c, [[0.13, 0.03], [0.55, -0.07], [0.49, 0.14], [0.18, 0.14]], '#e9d5ff', '#1a1026', 0.028);
    oval(c, 0.34, 0.05, 0.11, 0.085, '#c084fc', 0, '#3b0764', 0.02);
    oval(c, 0.34, 0.05, 0.062, 0.05, null, 0, '#2e1065', 0.018);
    oval(c, 0.34, 0.05, 0.024, 0.024, '#140624');
    poly(c, [[0.11, -0.03], [0.57, -0.15], [0.56, -0.08], [0.14, 0.02]], '#0f1220');
    c.restore();
  }
  // Edo Tensei subtle cracks + stern warlord mouth
  linePath(c, p => {
    p.moveTo(-0.62, 0.16); p.lineTo(-0.48, 0.24); p.lineTo(-0.52, 0.34);
    p.moveTo(-0.20, 0.44); p.quadraticCurveTo(0, 0.40, 0.22, 0.44);
  }, '#4b2834', 0.034);
  // Towering jagged black Uchiha hair + signature center-right forelock
  const hair = grad(c, -0.2, -1.58, 0.2, 0.4, [
    [0, '#49557a'], [0.35, '#1c2238'], [0.78, '#0c0f1c'], [1, '#05060d'],
  ]);
  poly(c, [
    [-1.08, 0.46], [-1.26, 0.10], [-1.10, -0.18], [-1.34, -0.52], [-1.02, -0.68],
    [-1.22, -1.14], [-0.74, -0.98], [-0.66, -1.54], [-0.24, -1.16], [0.06, -1.60],
    [0.36, -1.14], [0.78, -1.48], [0.78, -0.98], [1.24, -1.08], [0.98, -0.64],
    [1.32, -0.44], [1.08, -0.12], [1.22, 0.44], [0.90, 0.20], [0.80, -0.28],
    [0.54, -0.42], [0.18, -0.34], [0.08, 0.20], [-0.04, -0.34],
    [-0.44, -0.46], [-0.78, -0.26], [-0.88, 0.22],
  ], hair, '#05060c', 0.044);
  poly(c, [[-0.58, -1.40], [-0.30, -1.05], [-0.34, -0.58]], 'rgba(130,152,210,0.28)');
  poly(c, [[0.07, -1.48], [0.28, -1.04], [0.08, -0.56]], 'rgba(130,152,210,0.28)');
}

function drawNaruto(c) {
  baseHead(c, 'naruto');
  // Black Six-Paths magatama on Kurama cloak collar
  for (const xx of [-0.36, 0, 0.36]) oval(c, xx, 0.80, 0.048, 0.068, '#1a120b');
  // Blazing golden-orange Nine-Tails hair
  const hair = grad(c, 0, -1.56, 0, -0.2, [
    [0, '#fffde0'], [0.38, '#ffe047'], [0.78, '#ff9218'], [1, '#c2410c'],
  ]);
  poly(c, [
    [-0.94, -0.06], [-1.22, -0.34], [-0.98, -0.56], [-1.26, -0.92], [-0.82, -0.88],
    [-0.88, -1.36], [-0.46, -1.06], [-0.30, -1.56], [0, -1.16], [0.30, -1.56],
    [0.48, -1.06], [0.90, -1.36], [0.84, -0.88], [1.26, -0.90], [0.98, -0.54],
    [1.20, -0.32], [0.94, -0.06], [0.76, -0.34], [-0.76, -0.34],
  ], hair, '#9a3412', 0.046);
  // Konoha headband + metal plate + spiral emblem
  poly(c, [[-0.86, -0.44], [0.86, -0.44], [0.89, -0.15], [-0.89, -0.15]], '#1e293b', '#0f172a', 0.032);
  poly(c, [[-0.46, -0.40], [0.46, -0.40], [0.46, -0.18], [-0.46, -0.18]],
    grad(c, -0.4, -0.4, 0.4, -0.18, [[0, '#f8fafc'], [0.5, '#cbd5e1'], [1, '#94a3b8']]), '#334155', 0.025);
  linePath(c, p => {
    p.arc(0, -0.29, 0.072, 0, Math.PI * 1.65);
    p.lineTo(0.13, -0.29);
  }, '#1e293b', 0.028);
  // Kurama fox-slit amber eyes + 3 whiskers per cheek + bright grin
  for (const s of [-1, 1]) {
    c.save(); c.scale(s, 1);
    poly(c, [[0.14, 0.04], [0.54, -0.04], [0.50, 0.16], [0.18, 0.16]], '#fffef5', '#451a03', 0.026);
    oval(c, 0.33, 0.07, 0.085, 0.088, '#f59e0b');
    oval(c, 0.33, 0.07, 0.022, 0.072, '#1c0a00');
    poly(c, [[0.12, -0.04], [0.56, -0.12], [0.55, -0.05], [0.14, 0.02]], '#d97706');
    for (let w = 0; w < 3; w++) {
      const yy = 0.21 + w * 0.085;
      linePath(c, p => { p.moveTo(0.46, yy); p.lineTo(0.76, yy + (w - 1) * 0.03); }, '#78350f', 0.032);
    }
    c.restore();
  }
  c.beginPath();
  c.moveTo(-0.32, 0.38);
  c.quadraticCurveTo(0, 0.44, 0.32, 0.38);
  c.quadraticCurveTo(0, 0.62, -0.32, 0.38);
  c.fillStyle = '#ffffff';
  c.fill();
  c.strokeStyle = '#78350f';
  c.lineWidth = 0.03;
  c.stroke();
}

function drawSaitama(c, form) {
  // White hero cape shoulders behind the sphere
  poly(c, [
    [-0.98, 0.32], [-1.30, 0.82], [-0.62, 0.96], [0.62, 0.96], [1.30, 0.82], [0.98, 0.32],
  ], grad(c, 0, 0.3, 0, 1.0, [[0, '#ffffff'], [1, '#cbd5e1']]), '#64748b', 0.04);
  baseHead(c, 'saitama');
  // Glossy bald head specular shine
  oval(c, -0.34, -0.54, 0.26, 0.14, 'rgba(255,255,255,0.72)', -0.52);
  oval(c, -0.10, -0.70, 0.08, 0.045, 'rgba(255,255,255,0.62)', -0.3);
  // Two iconic red hero cape clasps
  for (const s of [-1, 1]) {
    oval(c, s * 0.52, 0.64, 0.12, 0.09, '#ef4444', 0, '#1e1b24', 0.032);
    oval(c, s * 0.52, 0.64, 0.045, 0.035, '#1e1b24');
  }
  if (form) {
    // Serious Mode (exact match to rbx5.png): dramatic shadow + blazing white eyes
    c.save();
    c.beginPath(); c.arc(0, 0, 0.98, 0, TAU); c.clip();
    c.fillStyle = grad(c, 0, -0.55, 0, 0.32, [[0, 'rgba(12,12,22,0.88)'], [0.7, 'rgba(12,12,22,0.68)'], [1, 'rgba(12,12,22,0)']]);
    c.fillRect(-1, -0.6, 2, 0.95);
    c.restore();
    for (const s of [-1, 1]) {
      c.save(); c.scale(s, 1);
      poly(c, [[0.12, 0.02], [0.56, -0.10], [0.48, 0.10], [0.18, 0.10]], '#ffffff', '#09090f', 0.03);
      linePath(c, p => { p.moveTo(0.08, -0.02); p.lineTo(0.60, -0.18); }, '#09090f', 0.06);
      c.restore();
    }
    linePath(c, p => { p.moveTo(-0.22, 0.40); p.lineTo(0.22, 0.40); }, '#2b1818', 0.044);
  } else {
    // Classic deadpan OK face
    for (const s of [-1, 1]) {
      oval(c, s * 0.31, -0.02, 0.16, 0.12, '#ffffff', 0, '#27232c', 0.028);
      oval(c, s * 0.31, -0.02, 0.032, 0.032, '#18181b');
      linePath(c, p => { p.moveTo(s * 0.16, -0.22); p.quadraticCurveTo(s * 0.31, -0.28, s * 0.46, -0.21); }, '#3f3430', 0.026);
    }
    linePath(c, p => { p.moveTo(-0.02, 0.12); p.lineTo(-0.05, 0.22); p.lineTo(0.03, 0.23); }, '#9a654c', 0.024);
    linePath(c, p => { p.moveTo(-0.18, 0.38); p.quadraticCurveTo(0, 0.40, 0.18, 0.38); }, '#4a2e28', 0.032);
  }
}

function drawIchigo(c) {
  baseHead(c, 'ichigo');
  // Crimson war-paint stripes across left half of the bone-white Hollow mask
  c.save();
  c.beginPath(); c.arc(0, 0, 0.96, 0, TAU); c.clip();
  for (const [x0, y0, x1, y1, w] of [
    [-0.64, -0.62, -0.52, 0.62, 0.11],
    [-0.36, -0.66, -0.28, 0.66, 0.095],
    [-0.10, -0.58, -0.08, -0.06, 0.075],
    [-0.84, -0.24, -0.72, 0.46, 0.085],
  ]) {
    linePath(c, p => { p.moveTo(x0, y0); p.quadraticCurveTo((x0 + x1) * 0.5 - 0.06, (y0 + y1) * 0.5, x1, y1); }, '#dc2626', w);
  }
  c.restore();
  // Wild bright-orange spiky hair (rbx7.png)
  const hair = grad(c, 0, -1.52, 0, -0.22, [
    [0, '#ffd48a'], [0.42, '#ff7b1c'], [0.85, '#c2410c'], [1, '#6c1e06'],
  ]);
  poly(c, [
    [-0.96, -0.06], [-1.26, -0.34], [-0.98, -0.54], [-1.32, -0.88], [-0.86, -0.84],
    [-0.96, -1.34], [-0.52, -1.04], [-0.32, -1.54], [0, -1.12], [0.28, -1.56],
    [0.50, -1.04], [0.96, -1.34], [0.86, -0.82], [1.30, -0.84], [0.96, -0.52],
    [1.22, -0.28], [0.94, -0.04], [0.68, -0.36], [0.34, -0.24], [0.06, -0.44],
    [-0.22, -0.24], [-0.56, -0.40],
  ], hair, '#5c1906', 0.046);
  // Black-sclera Hollow eyes with blazing golden irises
  for (const s of [-1, 1]) {
    c.save(); c.scale(s, 1);
    poly(c, [[0.12, 0.02], [0.58, -0.12], [0.52, 0.13], [0.18, 0.14]], '#0c0a14', '#2e293d', 0.028);
    oval(c, 0.34, 0.03, 0.068, 0.058, '#facc15');
    oval(c, 0.34, 0.03, 0.022, 0.026, '#09090b');
    c.restore();
  }
  // Sculpted grinning Hollow skull teeth
  c.beginPath();
  c.moveTo(-0.52, 0.30);
  c.quadraticCurveTo(0, 0.42, 0.52, 0.30);
  c.quadraticCurveTo(0.42, 0.62, 0, 0.62);
  c.quadraticCurveTo(-0.42, 0.62, -0.52, 0.30);
  c.fillStyle = '#f8fafc';
  c.fill();
  c.strokeStyle = '#1e1b2e';
  c.lineWidth = 0.035;
  c.stroke();
  linePath(c, p => {
    p.moveTo(-0.48, 0.44); p.quadraticCurveTo(0, 0.52, 0.48, 0.44);
    for (let i = -3; i <= 3; i++) {
      const tx = i * 0.12;
      p.moveTo(tx, 0.34); p.lineTo(tx, 0.58);
    }
  }, '#1e1b2e', 0.024);
}

function drawBroly(c) {
  baseHead(c, 'broly');
  // Massive Legendary Super Saiyan lime-green spiky hair (rbx0.png)
  const hair = grad(c, 0, -1.68, 0, -0.15, [
    [0, '#f4ffb0'], [0.38, '#9ef030'], [0.78, '#3da616'], [1, '#154408'],
  ]);
  poly(c, [
    [-0.96, 0.06], [-1.30, -0.22], [-1.04, -0.48], [-1.48, -0.82], [-0.98, -0.84],
    [-1.24, -1.32], [-0.72, -1.10], [-0.58, -1.66], [-0.14, -1.24], [0.10, -1.70],
    [0.38, -1.22], [0.88, -1.56], [0.80, -1.04], [1.34, -1.20], [1.00, -0.76],
    [1.42, -0.58], [1.02, -0.34], [1.18, 0.04], [0.78, -0.30], [0.42, -0.20],
    [0.16, -0.48], [-0.14, -0.22], [-0.48, -0.46], [-0.74, -0.24],
  ], hair, '#133b07', 0.05);
  for (const sh of [
    [[-0.54, -1.52], [-0.24, -1.12], [-0.28, -0.58]],
    [[0.10, -1.56], [0.32, -1.12], [0.06, -0.58]],
    [[0.80, -1.42], [0.64, -0.96], [0.36, -0.58]],
  ]) poly(c, sh, 'rgba(244,255,180,0.52)');
  // Blank white-green Berserker eyes, heavy green brows, cheek scar, roaring teeth
  for (const s of [-1, 1]) {
    c.save(); c.scale(s, 1);
    poly(c, [[0.11, 0.04], [0.56, -0.10], [0.50, 0.14], [0.18, 0.14]], '#f2ffd9', '#243b0b', 0.028);
    poly(c, [[0.08, -0.03], [0.60, -0.22], [0.62, -0.11], [0.14, 0.05]], '#2b7a12');
    c.restore();
  }
  linePath(c, p => { p.moveTo(0.46, 0.18); p.lineTo(0.66, 0.42); }, '#7c2d12', 0.032);
  poly(c, [[-0.36, 0.34], [0.36, 0.34], [0.42, 0.56], [-0.42, 0.56]], '#ffffff', '#451a03', 0.034);
  linePath(c, p => {
    p.moveTo(-0.38, 0.45); p.lineTo(0.38, 0.45);
    for (const tx of [-0.20, 0, 0.20]) { p.moveTo(tx, 0.35); p.lineTo(tx, 0.55); }
  }, '#451a03', 0.022);
}

function drawVegeta(c) {
  baseHead(c, 'vegeta');
  // Towering swept-up royal purple Ultra Ego spikes + deep widow's peak (rbx1.png)
  const hair = grad(c, 0, -1.68, 0, -0.15, [
    [0, '#f3d1ff'], [0.34, '#a855f7'], [0.74, '#581c87'], [1, '#1e0538'],
  ]);
  poly(c, [
    [-0.92, -0.12], [-1.22, -0.52], [-0.94, -0.72], [-1.18, -1.24], [-0.72, -1.04],
    [-0.58, -1.62], [-0.22, -1.22], [0, -1.70], [0.24, -1.22], [0.60, -1.62],
    [0.74, -1.04], [1.18, -1.22], [0.94, -0.70], [1.20, -0.50], [0.92, -0.12],
    [0.68, -0.46], [0.34, -0.52], [0, -0.14], [-0.34, -0.52], [-0.68, -0.46],
  ], hair, '#17032b', 0.05);
  for (const sh of [
    [[-0.52, -1.48], [-0.28, -1.06], [-0.32, -0.58]],
    [[0, -1.56], [0.18, -1.08], [0, -0.52]],
    [[0.54, -1.48], [0.36, -1.04], [0.32, -0.58]],
  ]) poly(c, sh, 'rgba(245,208,254,0.48)');
  // Golden Destroyer earring on left ear
  oval(c, -0.94, 0.18, 0.065, 0.09, '#facc15', 0, '#713f12', 0.024);
  // Heavy browless Ultra Ego ridge + glowing magenta eyes + arrogant smirk
  for (const s of [-1, 1]) {
    c.save(); c.scale(s, 1);
    linePath(c, p => { p.moveTo(0.09, -0.01); p.quadraticCurveTo(0.34, -0.16, 0.60, -0.12); }, '#9a523c', 0.055);
    poly(c, [[0.12, 0.04], [0.56, -0.08], [0.50, 0.14], [0.18, 0.14]], '#faf5ff', '#2e1065', 0.028);
    oval(c, 0.33, 0.05, 0.072, 0.078, '#d946ef');
    oval(c, 0.33, 0.05, 0.022, 0.048, '#1e0538');
    c.restore();
  }
  linePath(c, p => { p.moveTo(-0.18, 0.43); p.quadraticCurveTo(0.10, 0.46, 0.32, 0.34); }, '#4c1d3d', 0.042);
}

function drawGurren(c) {
  // Crimson-and-black Gunmen mecha head (rbx3.png & rbx4.png)
  c.beginPath();
  c.arc(0, 0, 1, 0, TAU);
  c.fillStyle = rgrad(c, -0.34, -0.44, 0.1, 0, 0, 1.14, [
    [0, '#ff867c'], [0.42, '#ef232c'], [0.80, '#990f19'], [1, '#3b050c'],
  ]);
  c.fill();
  c.strokeStyle = '#14080e';
  c.lineWidth = 0.052;
  c.stroke();
  // Dark metallic face mask + silver cheek armor + chin guard
  poly(c, [[-0.72, -0.16], [0.72, -0.16], [0.62, 0.56], [0, 0.78], [-0.62, 0.56]],
    grad(c, 0, -0.16, 0, 0.78, [[0, '#272a38'], [1, '#0c0e16']]), '#090a10', 0.038);
  for (const s of [-1, 1]) {
    poly(c, [[s * 0.88, -0.10], [s * 0.62, -0.02], [s * 0.54, 0.54], [s * 0.82, 0.44]],
      '#e2e8f0', '#1e293b', 0.032);
  }
  // Blazing neon-emerald Spiral Energy visor eyes
  for (const s of [-1, 1]) {
    c.save(); c.scale(s, 1);
    poly(c, [[0.08, 0.04], [0.58, -0.12], [0.52, 0.16], [0.14, 0.18]],
      grad(c, 0.1, -0.1, 0.5, 0.18, [[0, '#ecfccb'], [0.5, '#4ade80'], [1, '#15803d']]), '#052e16', 0.028);
    c.restore();
  }
  // Fierce mecha grille mouth
  poly(c, [[-0.36, 0.38], [0.36, 0.38], [0.28, 0.56], [-0.28, 0.56]], '#f8fafc', '#0f172a', 0.03);
  linePath(c, p => { p.moveTo(-0.32, 0.47); p.lineTo(0.32, 0.47); }, '#0f172a', 0.024);
  // Sweeping golden boomerang V-fin crest + emerald forehead core
  const gold = grad(c, 0, -1.22, 0, -0.05, [[0, '#fef9c3'], [0.48, '#facc15'], [1, '#b45309']]);
  poly(c, [
    [0, -0.04], [-0.62, -0.32], [-1.42, -1.16], [-1.14, -1.22], [-0.46, -0.54],
    [0, -0.34], [0.46, -0.54], [1.14, -1.22], [1.42, -1.16], [0.62, -0.32],
  ], gold, '#451a03', 0.046);
  oval(c, 0, -0.52, 0.14, 0.18, '#22c55e', 0, '#14532d', 0.035);
  oval(c, -0.04, -0.57, 0.05, 0.06, '#ecfccb');
}

function drawShanks(c) {
  // Gryphon saber hilt peeking diagonally behind upper-left shoulder (exact ABVB icon.png!)
  c.save();
  c.translate(-0.78, -0.68);
  c.rotate(-0.68);
  poly(c, [[-0.11, -0.58], [0.11, -0.58], [0.11, 0.12], [-0.11, 0.12]], '#15803d', '#052e16', 0.032);
  for (let i = 0; i < 3; i++) poly(c, [[0, -0.48 + i * 0.18], [0.07, -0.40 + i * 0.18], [0, -0.32 + i * 0.18], [-0.07, -0.40 + i * 0.18]], '#facc15');
  oval(c, 0, -0.60, 0.13, 0.06, '#facc15', 0, '#713f12', 0.028);
  oval(c, 0, 0.14, 0.24, 0.075, '#facc15', 0, '#713f12', 0.03);
  c.restore();

  baseHead(c, 'shanks');
  // Triple diagonal claw scars over viewer's right (Shanks' left) eye!
  for (const dx of [0.22, 0.34, 0.46]) {
    linePath(c, p => { p.moveTo(dx - 0.06, -0.34); p.lineTo(dx + 0.12, 0.34); }, '#991b1b', 0.034);
  }
  // Fierce eyes with crimson Conqueror's Haki glint + furrowed brows
  for (const s of [-1, 1]) {
    c.save(); c.scale(s, 1);
    poly(c, [[0.13, 0.02], [0.54, -0.05], [0.50, 0.12], [0.17, 0.12]], '#fff8f5', '#271216', 0.026);
    oval(c, 0.32, 0.04, 0.062, 0.062, '#dc2626');
    oval(c, 0.32, 0.04, 0.024, 0.028, '#110609');
    oval(c, 0.30, 0.02, 0.018, 0.018, '#ff9aa2');
    poly(c, [[0.09, -0.02], [0.58, -0.14], [0.58, -0.07], [0.13, 0.03]], '#261014');
    c.restore();
  }
  // Resolute scowl + jaw stubble (icon.png)
  linePath(c, p => { p.moveTo(-0.24, 0.40); p.quadraticCurveTo(0, 0.35, 0.24, 0.40); }, '#3f1d1d', 0.038);
  linePath(c, p => { p.arc(0, 0.34, 0.36, 0.35, Math.PI - 0.35); }, 'rgba(68,36,32,0.45)', 0.032);
  // Rich crimson parted hair flowing down both sides
  const hair = grad(c, 0, -1.36, 0, 0.35, [
    [0, '#ff636d'], [0.38, '#cc1825'], [0.80, '#7f0d18'], [1, '#3b050b'],
  ]);
  poly(c, [
    [-1.02, 0.36], [-1.18, -0.04], [-1.08, -0.46], [-1.16, -0.78], [-0.84, -1.08],
    [-0.42, -1.32], [0.02, -1.26], [0.46, -1.34], [0.88, -1.06], [1.16, -0.74],
    [1.10, -0.40], [1.18, 0.02], [1.00, 0.36], [0.80, 0.02], [0.72, -0.38],
    [0.36, -0.52], [0.06, -0.24], [-0.04, -0.56], [-0.36, -0.48], [-0.72, -0.34], [-0.80, 0.04],
  ], hair, '#2d0409', 0.046);
  linePath(c, p => {
    p.moveTo(-0.56, -1.06); p.quadraticCurveTo(-0.76, -0.62, -0.84, -0.18);
    p.moveTo(0.48, -1.10); p.quadraticCurveTo(0.74, -0.64, 0.84, -0.18);
  }, 'rgba(255,148,156,0.45)', 0.046);
}

export function drawPackPortrait(c, type, form) {
  if (type === 'dio') drawDio(c);
  else if (type === 'madara') drawMadara(c);
  else if (type === 'naruto') drawNaruto(c);
  else if (type === 'saitama') drawSaitama(c, form);
  else if (type === 'ichigo') drawIchigo(c);
  else if (type === 'broly') drawBroly(c);
  else if (type === 'vegeta') drawVegeta(c);
  else if (type === 'gurren') drawGurren(c);
  else if (type === 'shanks') drawShanks(c);
}

const AURA_RGB = {
  dio: '250,204,21',
  madara: '56,189,248',
  naruto: '255,180,36',
  saitama: '255,90,90',
  ichigo: '239,68,68',
  broly: '132,238,40',
  vegeta: '192,68,255',
  gurren: '52,235,120',
  shanks: '239,35,60',
};

export function drawPackAura(c, type, form, clock, quality, isMini) {
  if (isMini) return;
  const col = AURA_RGB[type];
  if (!col) return;
  if (type === 'saitama' && !form) return;
  const amp = 0.20 + Math.min(0.24, form * 0.06) + Math.sin(clock * 6.5) * 0.04;
  oval(c, 0, -0.04, 1.56, 1.56, rgrad(c, 0, -0.04, 0.65, 0, -0.04, 1.56, [
    [0, `rgba(${col},${amp})`], [0.65, `rgba(${col},${amp * 0.65})`], [1, `rgba(${col},0)`],
  ]));
  if (quality < 0.6) return;
  if (type === 'gurren') {
    // Signature green spiral-flame wisps rising from Gurren's visor eyes
    for (const s of [-1, 1]) {
      const fl = Math.sin(clock * 11 + s) * 0.08;
      linePath(c, p => {
        p.moveTo(s * 0.48, -0.08);
        p.quadraticCurveTo(s * (0.86 + fl), -0.44, s * 0.72, -0.88 + fl);
      }, 'rgba(74,245,135,0.72)', 0.065);
    }
  } else if (type === 'shanks' || type === 'ichigo') {
    // Crackling dark-crimson lightning / Hollow reiatsu arcs
    for (let i = 0; i < 3; i++) {
      const a = clock * 4.5 + i * 2.1;
      const x0 = Math.cos(a) * 1.04, y0 = Math.sin(a) * 1.04;
      const x1 = Math.cos(a + 0.45) * 1.34, y1 = Math.sin(a + 0.45) * 1.34;
      linePath(c, p => { p.moveTo(x0, y0); p.lineTo((x0 + x1) * 0.52, (y0 + y1) * 0.42); p.lineTo(x1, y1); }, '#14050b', 0.065);
      linePath(c, p => { p.moveTo(x0, y0); p.lineTo((x0 + x1) * 0.52, (y0 + y1) * 0.42); p.lineTo(x1, y1); }, '#ff3b5c', 0.03);
    }
  } else if (type === 'naruto' || type === 'broly' || type === 'vegeta') {
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + clock * 1.6;
      const d = 1.06 + 0.22 * Math.sin(clock * 8 + i * 1.9) ** 2;
      c.moveTo(Math.cos(a) * d, Math.sin(a) * d + 0.06);
      c.lineTo(Math.cos(a) * (d + 0.14), Math.sin(a) * d - 0.18);
    }
    c.strokeStyle = `rgba(${col},0.58)`;
    c.lineWidth = 0.04;
    c.stroke();
  }
}

export function drawPackArrow(c, type, clock) {
  if (type === 'dio') {
    // The World clock-dial hilt + gleaming silver throwing knife
    poly(c, [[-0.08, -0.09], [0.42, -0.07], [0.42, 0.07], [-0.08, 0.09]],
      grad(c, 0, -0.1, 0, 0.1, [[0, '#fde047'], [0.5, '#b45309'], [1, '#291805']]), '#1c1206', 0.025);
    oval(c, 0.24, 0, 0.14, 0.14, '#fef08a', 0, '#713f12', 0.028);
    linePath(c, p => {
      p.moveTo(0.24, 0); p.lineTo(0.24 + Math.cos(clock * 6) * 0.09, Math.sin(clock * 6) * 0.09);
      p.moveTo(0.24, 0); p.lineTo(0.32, 0);
    }, '#1c1917', 0.022);
    oval(c, 0.24, 0, 0.045, 0.045, '#22c55e', 0, '#14532d', 0.018);
    poly(c, [[0.38, -0.20], [0.46, -0.20], [0.46, 0.20], [0.38, 0.20]], '#facc15', '#451a03', 0.024);
    poly(c, [[0.45, -0.13], [0.78, -0.11], [1.06, 0], [0.78, 0.11], [0.45, 0.13]],
      grad(c, 0.5, -0.13, 0.9, 0.13, [[0, '#ffffff'], [0.5, '#cbd5e1'], [1, '#64748b']]), '#1e1b4b', 0.026);
    linePath(c, p => { p.moveTo(0.50, 0); p.lineTo(0.96, 0); }, '#c084fc', 0.024);
  } else if (type === 'madara') {
    // Uchiha Rinnegan guard + ribbed glowing cyan Susanoo katana
    oval(c, 0.06, 0, 0.13, 0.16, '#c084fc', 0, '#2e1065', 0.028);
    oval(c, 0.06, 0, 0.065, 0.08, null, 0, '#2e1065', 0.02);
    poly(c, [[0.18, -0.09], [0.56, -0.12], [0.56, 0.12], [0.18, 0.09]],
      grad(c, 0, -0.12, 0, 0.12, [[0, '#7dd3fc'], [0.5, '#0284c7'], [1, '#1e3a8a']]), '#0c4a6e', 0.024);
    for (const rx of [0.26, 0.38, 0.50]) {
      linePath(c, p => { p.moveTo(rx, -0.17); p.quadraticCurveTo(rx + 0.05, 0, rx, 0.17); }, '#bae6fd', 0.028);
    }
    poly(c, [[0.52, -0.22], [0.82, -0.14], [1.07, -0.01], [0.78, 0.18], [0.52, 0.14]],
      grad(c, 0.5, -0.22, 1.0, 0.18, [[0, '#f0f9ff'], [0.4, '#38bdf8'], [1, '#1d4ed8']]), '#0f172a', 0.026);
  } else if (type === 'naruto') {
    // Golden Kurama chakra tail with magatama + spinning 4-blade Rasenshuriken
    poly(c, [[-0.08, -0.08], [0.56, -0.10], [0.56, 0.10], [-0.08, 0.08]],
      grad(c, 0, -0.1, 0, 0.1, [[0, '#fef08a'], [0.5, '#f59e0b'], [1, '#b45309']]), '#78350f', 0.025);
    for (const mx of [0.08, 0.24, 0.40]) oval(c, mx, 0, 0.032, 0.045, '#1c1917');
    c.save();
    c.translate(0.76, 0);
    c.rotate(clock * 11);
    for (let i = 0; i < 4; i++) {
      c.rotate(Math.PI / 2);
      poly(c, [[0, -0.05], [0.22, -0.12], [0.31, 0], [0.16, 0.07]], '#e0f2fe', '#0284c7', 0.02);
    }
    c.restore();
    oval(c, 0.76, 0, 0.12, 0.12, rgrad(c, 0.73, -0.03, 0.01, 0.76, 0, 0.12, [
      [0, '#ffffff'], [0.55, '#38bdf8'], [1, '#0369a1'],
    ]), 0, '#fef08a', 0.024);
  } else if (type === 'saitama') {
    // Flowing white hero cape + red clasp + glossy crimson Serious Punch glove + V-shockwave
    poly(c, [[-0.08, -0.13], [0.48, -0.08], [0.48, 0.08], [-0.08, 0.13]],
      grad(c, 0, -0.13, 0, 0.13, [[0, '#ffffff'], [1, '#cbd5e1']]), '#475569', 0.024);
    oval(c, 0.06, 0, 0.065, 0.065, '#ef4444', 0, '#18181b', 0.022);
    linePath(c, p => { p.moveTo(0.78, -0.26); p.lineTo(1.07, 0); p.lineTo(0.78, 0.26); }, '#ffffff', 0.035);
    c.beginPath();
    c.moveTo(0.44, -0.11);
    c.quadraticCurveTo(0.48, -0.23, 0.68, -0.22);
    c.bezierCurveTo(0.98, -0.22, 0.98, 0.22, 0.68, 0.22);
    c.quadraticCurveTo(0.48, 0.23, 0.44, 0.11);
    c.closePath();
    c.fillStyle = rgrad(c, 0.64, -0.09, 0.02, 0.68, 0, 0.28, [
      [0, '#ff9aa2'], [0.42, '#ef233c'], [0.85, '#99091d'], [1, '#4c0512'],
    ]);
    c.fill();
    c.strokeStyle = '#1f0810';
    c.lineWidth = 0.028;
    c.stroke();
    oval(c, 0.66, -0.09, 0.09, 0.045, 'rgba(255,255,255,0.65)', -0.2);
  } else if (type === 'ichigo') {
    // White-wrapped hilt + black Tensa Zangetsu cleaver + crimson Getsuga edge
    poly(c, [[-0.10, -0.055], [0.22, -0.055], [0.22, 0.055], [-0.10, 0.055]], '#f8fafc', '#1e293b', 0.024);
    for (const wx of [-0.02, 0.06, 0.14]) linePath(c, p => { p.moveTo(wx, -0.055); p.lineTo(wx + 0.03, 0.055); }, '#334155', 0.02);
    poly(c, [[0.20, -0.21], [0.28, -0.21], [0.28, 0.21], [0.20, 0.21]], '#0f172a', '#ef4444', 0.022);
    poly(c, [[0.27, -0.13], [0.76, -0.17], [1.07, 0.02], [0.68, 0.12], [0.27, 0.09]],
      grad(c, 0.3, -0.17, 1.0, 0.12, [[0, '#27272a'], [0.6, '#09090b'], [1, '#7f1d1d']]), '#ff2e4d', 0.032);
    linePath(c, p => { p.moveTo(0.32, -0.13); p.lineTo(0.76, -0.16); p.lineTo(1.03, 0.01); }, '#ffb3be', 0.022);
  } else if (type === 'broly') {
    // Saiyan gold bracer + roaring lime-green Omega Berserker ki spear
    poly(c, [[-0.06, -0.14], [0.14, -0.14], [0.14, 0.14], [-0.06, 0.14]], '#facc15', '#422006', 0.026);
    poly(c, [
      [0.12, -0.10], [0.42, -0.22], [0.36, -0.11], [0.66, -0.27], [1.07, 0],
      [0.66, 0.27], [0.36, 0.11], [0.42, 0.22], [0.12, 0.10],
    ], grad(c, 0.1, -0.24, 1.0, 0.24, [[0, '#166534'], [0.45, '#84cc16'], [0.85, '#ecfccb'], [1, '#ffffff']]), '#14532d', 0.028);
    poly(c, [[0.22, 0], [0.68, -0.11], [0.97, 0], [0.68, 0.11]], '#f7fee7');
  } else if (type === 'vegeta') {
    // Royal gold-black armor shaft + swirling dark-core Hakai orb + magenta lance
    poly(c, [[-0.08, -0.09], [0.46, -0.07], [0.46, 0.07], [-0.08, 0.09]],
      grad(c, 0, -0.09, 0, 0.09, [[0, '#facc15'], [0.4, '#312e81'], [1, '#0f0722']]), '#1e1b4b', 0.024);
    poly(c, [[0.64, -0.16], [1.07, 0], [0.64, 0.16]], '#e879f9', '#3b0764', 0.026);
    oval(c, 0.62, 0, 0.20, 0.20, rgrad(c, 0.62, 0, 0.03, 0.62, 0, 0.20, [
      [0, '#090214'], [0.55, '#581c87'], [0.82, '#e879f9'], [1, 'rgba(232,121,249,0)'],
    ]));
    oval(c, 0.62, 0, 0.14, 0.14, '#140326', 0, '#f0abfc', 0.03);
  } else if (type === 'gurren') {
    // Crimson-gold V-fin collar + spinning fluted silver-emerald Giga Drill
    poly(c, [[-0.06, -0.22], [0.16, -0.14], [0.16, 0.14], [-0.06, 0.22], [0.02, 0]], '#facc15', '#78350f', 0.026);
    poly(c, [[0.14, -0.24], [1.08, 0], [0.14, 0.24]],
      grad(c, 0.2, -0.22, 0.2, 0.22, [[0, '#f8fafc'], [0.45, '#cbd5e1'], [0.8, '#64748b'], [1, '#334155']]), '#0f172a', 0.028);
    c.save();
    c.beginPath(); c.moveTo(0.14, -0.23); c.lineTo(1.06, 0); c.lineTo(0.14, 0.23); c.closePath(); c.clip();
    const shift = (clock * 1.8) % 0.18;
    for (let x = 0.10 + shift; x < 1.02; x += 0.18) {
      linePath(c, p => { p.moveTo(x - 0.06, -0.25); p.lineTo(x + 0.06, 0.25); }, '#22c55e', 0.036);
    }
    c.restore();
  } else if (type === 'shanks') {
    // Gryphon saber: green diamond-wrapped grip, curved gold guard, steel blade + red-black Haki lightning
    poly(c, [[-0.10, -0.06], [0.22, -0.06], [0.22, 0.06], [-0.10, 0.06]], '#15803d', '#052e16', 0.024);
    for (const dx of [-0.01, 0.09, 0.17]) poly(c, [[dx, -0.04], [dx + 0.035, 0], [dx, 0.04], [dx - 0.035, 0]], '#facc15');
    linePath(c, p => { p.moveTo(0.22, 0.18); p.quadraticCurveTo(0.32, 0, 0.22, -0.18); p.quadraticCurveTo(0.06, -0.22, -0.08, -0.10); }, '#facc15', 0.044);
    poly(c, [[0.24, -0.09], [0.82, -0.12], [1.08, -0.02], [0.84, 0.09], [0.24, 0.08]],
      grad(c, 0.3, -0.12, 0.9, 0.1, [[0, '#ffffff'], [0.55, '#e2e8f0'], [1, '#64748b']]), '#7f1d1d', 0.026);
    linePath(c, p => { p.moveTo(0.32, 0.02); p.lineTo(0.54, -0.14); p.lineTo(0.74, 0.11); p.lineTo(1.02, -0.02); }, '#14040a', 0.042);
    linePath(c, p => { p.moveTo(0.32, 0.02); p.lineTo(0.54, -0.14); p.lineTo(0.74, 0.11); p.lineTo(1.02, -0.02); }, '#ff2442', 0.022);
  }
}
