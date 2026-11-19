// Anime Ball vs Ball roster & ability simulation (Roblox place 94075854820030).
// Sources: official game icon (Shanks), store artwork (Broly, Ultra Ego Vegeta,
// Gurren Lagann, Madara, Kurama Naruto, Saitama, Hollow Ichigo, Gear 5 Luffy,
// Sukuna), preview video 71555087621325 (DIO, Sukuna, Gear 5 Luffy), and public
// gameplay footage (Goku). Visuals & signature skills match the game; damage and
// cooldown numbers are tuned for balanced 1v1 & Battle Mode arena play.

import { makeAnimeEffects, remapTrail, sampleTrail } from './anime-fx.js';
import { drawEgoPips, drawPackFloor, drawPackFront } from './anime-pack-fx.js';
import { drawPackProjectiles } from './anime-projectile-fx.js';

const rgb = (r, g, b) => ({ r, g, b });
const GOKU_COLORS = [rgb(87, 201, 255), rgb(255, 219, 91), rgb(76, 226, 255)];
const HAKI = rgb(255, 112, 145);
const SHRINE = rgb(255, 58, 101);
const DIO_GOLD = rgb(250, 204, 21);
const SUSANOO_BLUE = rgb(56, 189, 248);
const KURAMA_GOLD = rgb(255, 188, 46);
const SAITAMA_RED = rgb(255, 82, 98);
const GETSUGA_RED = rgb(255, 56, 86);
const BROLY_GREEN = rgb(148, 242, 48);
const EGO_PURPLE = rgb(224, 96, 255);
const SPIRAL_GREEN = rgb(52, 235, 128);
const SHANKS_RED = rgb(239, 35, 60);

export const ANIME_NEW_IDS = [
  'ichigo', 'gurren', 'dio', 'naruto', 'broly', 'vegeta', 'madara', 'saitama', 'shanks',
];

export const ANIME_TYPES = {
  goku:    { id: 'goku',    maxHealth: 110, color: rgb(255, 138, 48),  dark: rgb(18, 30, 61),   accent: GOKU_COLORS[0], glow: rgb(80, 146, 255) },
  luffy:   { id: 'luffy',   maxHealth: 115, color: rgb(233, 224, 255), dark: rgb(96, 75, 133),  accent: HAKI,           glow: rgb(215, 194, 255) },
  sukuna:  { id: 'sukuna',  maxHealth: 115, color: rgb(223, 77, 98),   dark: rgb(63, 18, 43),   accent: SHRINE,         glow: rgb(235, 37, 82) },
  ichigo:  { id: 'ichigo',  maxHealth: 105, color: rgb(255, 126, 36),  dark: rgb(20, 16, 28),   accent: GETSUGA_RED,    glow: rgb(239, 52, 76) },
  gurren:  { id: 'gurren',  maxHealth: 110, color: rgb(235, 38, 48),   dark: rgb(42, 12, 20),   accent: SPIRAL_GREEN,   glow: rgb(52, 235, 128) },
  dio:     { id: 'dio',     maxHealth: 105, color: rgb(248, 202, 52),  dark: rgb(48, 30, 68),   accent: DIO_GOLD,       glow: rgb(250, 204, 21) },
  naruto:  { id: 'naruto',  maxHealth: 110, color: rgb(255, 176, 36),  dark: rgb(92, 38, 10),   accent: KURAMA_GOLD,    glow: rgb(255, 196, 62) },
  broly:   { id: 'broly',   maxHealth: 120, color: rgb(138, 232, 42),  dark: rgb(24, 68, 14),   accent: BROLY_GREEN,    glow: rgb(148, 242, 48) },
  vegeta:  { id: 'vegeta',  maxHealth: 110, color: rgb(168, 85, 247),  dark: rgb(32, 8, 58),    accent: EGO_PURPLE,     glow: rgb(217, 70, 239) },
  madara:  { id: 'madara',  maxHealth: 115, color: rgb(172, 32, 52),   dark: rgb(18, 22, 42),   accent: SUSANOO_BLUE,   glow: rgb(56, 189, 248) },
  saitama: { id: 'saitama', maxHealth: 115, color: rgb(255, 220, 66),  dark: rgb(120, 22, 32),  accent: SAITAMA_RED,    glow: rgb(255, 110, 110) },
  shanks:  { id: 'shanks',  maxHealth: 115, color: rgb(208, 28, 42),   dark: rgb(20, 14, 22),   accent: SHANKS_RED,     glow: rgb(239, 35, 60) },
};

export const ANIME_INFO = {
  goku:    { name: 'GOKU',             rarity: 'LEGENDARY', tag: 'SAIYAN',     desc: 'Charges and fires Kamehameha. As his HP falls, he turns Super Saiyan and then Super Saiyan Blue, strengthening the beam.' },
  luffy:   { name: 'GEAR 5 LUFFY',     rarity: 'MYTHIC',    tag: 'NIKA',       desc: 'Inflates a giant Haki fist and slams it into the marked area. Bajrang Gun hits once for 28 and knocks the enemy away.' },
  sukuna:  { name: 'SUKUNA',           rarity: 'MYTHIC',    tag: 'DOMAIN',     desc: 'Opens Malevolent Shrine. Rapid slashes deal 2 damage per hit inside the red domain, but opponents outside it are safe.' },
  ichigo:  { name: 'HOLLOW ICHIGO',    rarity: 'EPIC',      tag: 'GETSUGA',    desc: 'Donning his Hollow mask, he swings Tensa Zangetsu to launch a black-crimson Getsuga Tensho wave that slices for 18.' },
  gurren:  { name: 'GURREN LAGANN',    rarity: 'EPIC',      tag: 'SPIRAL',     desc: 'Forms a giant spinning Giga Drill and rockets forward, boring through rivals in its path for rapid 5-damage spiral hits.' },
  dio:     { name: 'DIO',              rarity: 'LEGENDARY', tag: 'TIME STOP',  desc: 'Expands The World to stop time inside his dome, rings the frozen foe with 5 knives, then snaps them all forward for 4 each.' },
  naruto:  { name: 'KURAMA NARUTO',    rarity: 'LEGENDARY', tag: 'NINE-TAILS', desc: 'Hurls a curving Rasenshuriken that rebounds once off walls and bursts into a chakra vortex dealing up to 4 hits of 5.' },
  broly:   { name: 'BROLY',            rarity: 'LEGENDARY', tag: 'BERSERKER',  desc: 'Roars in Legendary Super Saiyan form and charges in an emerald ki meteor, smashing for 16 up to 26 as his HP drops.' },
  vegeta:  { name: 'ULTRA EGO VEGETA', rarity: 'LEGENDARY', tag: 'HAKAI',      desc: 'Builds Ultra Ego stacks when hurt (up to 5), fueling a homing magenta Hakai sphere that implodes for 14 to 24 damage.' },
  madara:  { name: 'MADARA',           rarity: 'MYTHIC',    tag: 'SUSANOO',    desc: 'Awakens his blue Susanoo armor to halve incoming damage, then sweeps twin Susanoo blades across the front for 20.' },
  saitama: { name: 'SAITAMA',          rarity: 'MYTHIC',    tag: 'ONE PUNCH',  desc: 'Turns Serious and unleashes Serious Punch, tearing a supersonic V-shockwave across the arena for 30 damage and huge knockback.' },
  shanks:  { name: 'SHANKS',           rarity: 'MYTHIC',    tag: 'HAKI',       desc: 'Staggers nearby foes with a Conqueror Haki burst, then fires a blazing red-black Divine Departure slash wave for 20.' },
};

const CONFIG = {
  goku:    { first: 1.25, windup: 0.78, active: 0.72, recover: 0.22, rest: 2.60 },
  luffy:   { first: 2.15, windup: 1.02, active: 0.34, recover: 0.48, rest: 3.05 },
  sukuna:  { first: 2.35, windup: 0.62, active: 3.10, recover: 0.38, rest: 2.80 },
  ichigo:  { first: 1.40, windup: 0.50, active: 0.28, recover: 0.22, rest: 2.35 },
  gurren:  { first: 1.75, windup: 0.58, active: 0.86, recover: 0.28, rest: 2.60 },
  dio:     { first: 2.10, windup: 0.56, active: 1.25, recover: 0.28, rest: 3.05 },
  naruto:  { first: 1.60, windup: 0.58, active: 0.32, recover: 0.24, rest: 2.75 },
  broly:   { first: 1.70, windup: 0.56, active: 0.62, recover: 0.28, rest: 2.55 },
  vegeta:  { first: 1.65, windup: 0.58, active: 0.30, recover: 0.24, rest: 2.65 },
  madara:  { first: 1.85, windup: 0.52, active: 2.15, recover: 0.30, rest: 2.80 },
  saitama: { first: 2.20, windup: 0.88, active: 0.42, recover: 0.38, rest: 3.10 },
  shanks:  { first: 1.80, windup: 0.54, active: 0.38, recover: 0.26, rest: 2.70 },
};

const AIM_TYPES = new Set(['goku', 'luffy', 'ichigo', 'gurren', 'naruto', 'broly', 'vegeta', 'madara', 'saitama', 'shanks']);
const FRONT_ANIME_TYPES = new Set(['luffy', 'saitama', 'gurren', 'madara']);
const CAST_TITLE = {
  goku: 'KAMEHAMEHA!', luffy: 'BAJRANG GUN!', sukuna: 'MALEVOLENT SHRINE',
  dio: 'THE WORLD!', madara: 'SUSANOO!', naruto: 'RASENSHURIKEN!', saitama: 'SERIOUS PUNCH!',
  ichigo: 'GETSUGA TENSHO!', broly: 'GIGANTIC CHARGE!', vegeta: 'HAKAI!',
  gurren: 'GIGA DRILL BREAK!', shanks: 'DIVINE DEPARTURE!',
};

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const unit = n => clamp(n, 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;
const rgba = (c, alpha) => `rgba(${c.r},${c.g},${c.b},${alpha})`;
const TAU = Math.PI * 2;
const gokuForm = health => health <= 0.34 ? 2 : health <= 0.69 ? 1 : 0;

export function portraitFormFor(type, a) {
  if (!a) return 0;
  return (type === 'goku' || type === 'saitama') ? a.form : 0;
}

export function createAnimeState(type) {
  const config = CONFIG[type];
  return config ? {
    mode: 'rest', time: 0, duration: config.first, angle: 0, form: 0, ego: 0,
    x: 0, y: 0, tick: 0, casts: 0, hits: 0, done: false, hitFlash: 0,
  } : null;
}

function inCircle(x, y, r, b) {
  const dx = b.x - x, dy = b.y - y;
  return dx * dx + dy * dy <= (r + b.r) ** 2;
}

function segHit(x0, y0, x1, y1, width, foe) {
  const vx = x1 - x0, vy = y1 - y0;
  const lenSq = vx * vx + vy * vy || 1;
  const t = clamp(((foe.x - x0) * vx + (foe.y - y0) * vy) / lenSq, 0, 1);
  return (foe.x - (x0 + vx * t)) ** 2 + (foe.y - (y0 + vy * t)) ** 2 <= (foe.r + width) ** 2;
}

function blendAngle(from, to, weight) {
  return from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * weight;
}

export function createAnimeRivals({ arena, balls, foeOf, isPlaying, canPush, applyDamage, spawnSparks, spawnPopup, addShake,
  sfx, prefersReducedMotion = () => false }) {
  const shots = [];
  const effects = makeAnimeEffects(arena);
  const size = () => Math.min(arena.w, arena.h);
  const shrineRadius = a => size() * 0.48 * (a.mode === 'active' ? 0.26 + 0.74 * unit(a.time / 0.32) : 1);
  const fistRadius = () => size() * 0.175;
  const worldRadius = () => size() * 0.49;
  const punchRange = () => Math.hypot(arena.w, arena.h);
  const punchHalfAngle = () => 0.29;
  const fxHelpers = { worldRadius, punchRange, punchHalfAngle };

  function reset() {
    shots.length = 0;
    effects.reset();
    for (const b of balls) b.fxTrail = null;
  }

  function onDamaged(target, amount) {
    const a = target.anime;
    if (!a) return amount;
    if (target.type === 'madara' && a.mode === 'active') {
      const foe = foeOf(target);
      const angle = Math.atan2(foe.y - target.y, foe.x - target.x);
      effects.emit('madara', 'guard', target.x + Math.cos(angle) * target.r * 1.28,
        target.y + Math.sin(angle) * target.r * 1.28, target.r, angle);
      return amount * 0.5;
    }
    if (target.type === 'vegeta' && a.ego < 5) {
      a.ego += 1;
      a.form = a.ego;
      spawnPopup(target.x, target.y - target.r * 1.45, `EGO x${a.ego}`, EGO_PURPLE, 0, -44, false);
      effects.emit('vegeta', 'light', target.x, target.y + target.r * 0.25, target.r * 0.85, target.facing);
    }
    return amount;
  }

  function beamGeometry(b, a) {
    const dx = Math.cos(a.angle), dy = Math.sin(a.angle);
    const tx = Math.abs(dx) < 1e-6 ? Infinity : (arena.x + (dx > 0 ? arena.w : 0) - b.x) / dx;
    const ty = Math.abs(dy) < 1e-6 ? Infinity : (arena.y + (dy > 0 ? arena.h : 0) - b.y) / dy;
    const length = Math.max(0, Math.min(tx, ty));
    const start = Math.min(length, b.r * 0.69);
    return {
      dx, dy, start, length, width: b.r * (0.25 + a.form * 0.047),
      x0: b.x + dx * start, y0: b.y + dy * start, x1: b.x + dx * length, y1: b.y + dy * length,
    };
  }

  function aimAt(b, foe, a, s, dt) {
    const lead = foe.freezeTimer > 0 ? 0 : Math.min(0.14, Math.hypot(foe.x - b.x, foe.y - b.y) / 2300);
    const x = clamp(foe.x + foe.vx * s * lead, arena.x + foe.r, arena.x + arena.w - foe.r);
    const y = clamp(foe.y + foe.vy * s * lead, arena.y + foe.r, arena.y + arena.h - foe.r);
    const want = Math.atan2(y - b.y, x - b.x);
    a.angle = blendAngle(a.angle, want, unit(dt * 23));
    if (b.type === 'luffy') { a.x = x; a.y = y; }
  }

  function stage(a, mode, duration, carry = 0) {
    a.mode = mode;
    a.duration = duration;
    a.time = carry;
  }

  function hurt(owner, foe, amount, x, y, color, impulse = 0, big = false) {
    const dx = foe.x - x, dy = foe.y - y;
    const angle = Math.hypot(dx, dy) < 0.01 ? owner.facing : Math.atan2(dy, dx);
    const dealt = applyDamage(foe, amount, foe.x, foe.y - foe.r * 0.83, angle, color, Math.cos(angle) * 22, -76, big);
    if (!dealt) return 0;
    if (owner.anime) {
      owner.anime.hits++;
      owner.anime.hitFlash = 0.18;
    }
    effects.emit(owner.type, big ? 'heavy' : 'light', foe.x - Math.cos(angle) * foe.r * 0.43,
      foe.y - Math.sin(angle) * foe.r * 0.43, foe.r * (big ? 1.7 : 1.04), angle);
    if (foe.alive && impulse && canPush(foe)) {
      foe.vx += Math.cos(angle) * impulse;
      foe.vy += Math.sin(angle) * impulse;
    }
    spawnSparks(foe.x, foe.y, color, big ? 17 : 5, big ? 1.12 : 0.68);
    return dealt;
  }

  function spawnDioKnives(b, foe, trapped, s) {
    const speed = 680 * s;
    if (trapped) {
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * TAU - Math.PI * 0.5;
        const ring = foe.r * 2.55;
        const kx = clamp(foe.x + Math.cos(ang) * ring, arena.x + 10, arena.x + arena.w - 10);
        const ky = clamp(foe.y + Math.sin(ang) * ring, arena.y + 10, arena.y + arena.h - 10);
        const toFoe = Math.atan2(foe.y - ky, foe.x - kx);
        shots.push({
          kind: 'knife', owner: b, x: kx, y: ky, angle: toFoe, speed,
          vx: Math.cos(toFoe) * speed, vy: Math.sin(toFoe) * speed,
          r: Math.max(7, b.r * 0.28), hold: 0.62, launched: false, age: 0, life: 1.9,
        });
      }
    } else {
      const base = Math.atan2(foe.y - b.y, foe.x - b.x);
      for (const spread of [-0.24, 0, 0.24]) {
        const ang = base + spread;
        shots.push({
          kind: 'knife', owner: b,
          x: b.x + Math.cos(ang) * b.r * 1.2, y: b.y + Math.sin(ang) * b.r * 1.2,
          angle: ang, speed, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
          r: Math.max(7, b.r * 0.28), hold: 0.36, launched: false, age: 0, life: 1.7,
        });
      }
    }
  }

  function activate(b, foe, a, config, excess, s) {
    stage(a, 'active', config.active, excess);
    a.tick = 0;
    a.done = false;
    a.casts++;
    const cx = Math.cos(a.angle), sy = Math.sin(a.angle);
    effects.title(b.side, b.type, ANIME_INFO[b.type].name, CAST_TITLE[b.type]);
    effects.emit(b.type, b.type === 'dio' || b.type === 'madara' ? 'shift' : 'cast',
      b.x + cx * b.r * 0.67, b.y + sy * b.r * 0.67, b.r * 1.16, a.angle);

    if (b.type === 'goku') {
      sfx.laserZap();
      spawnSparks(b.x, b.y, GOKU_COLORS[0], 12, 1);
    } else if (b.type === 'luffy') {
      sfx.dash();
    } else if (b.type === 'sukuna') {
      a.x = b.x; a.y = b.y;
      sfx.trapSnap();
      addShake(4);
    } else if (b.type === 'dio') {
      a.x = b.x; a.y = b.y;
      sfx.trapSnap();
      addShake(5);
      const trapped = inCircle(a.x, a.y, worldRadius(), foe);
      a.fxCaught = trapped;
      if (trapped) {
        foe.freezeTimer = Math.max(foe.freezeTimer, 1.05);
        spawnPopup(foe.x, foe.y - foe.r * 1.35, 'TIME STOPPED!', DIO_GOLD, 0, -38, false);
      }
      spawnDioKnives(b, foe, trapped, s);
    } else if (b.type === 'madara') {
      sfx.forge();
      spawnSparks(b.x, b.y, SUSANOO_BLUE, 14, 0.95);
    } else if (b.type === 'naruto') {
      sfx.slash();
      const sp = 530 * s;
      shots.push({
        kind: 'rasen', owner: b,
        x: b.x + cx * b.r * 1.15, y: b.y + sy * b.r * 1.15,
        vx: cx * sp, vy: sy * sp, speed: sp, angle: a.angle,
        r: b.r * 0.56, bounces: 0, age: 0, life: 1.75,
        burst: false, burstAge: 0, burstLife: 0.56, burstR: b.r * 2.15, tick: 0, ticks: 0,
      });
    } else if (b.type === 'saitama') {
      sfx.dash();
    } else if (b.type === 'ichigo') {
      sfx.slash();
      const sp = 690 * s;
      shots.push({
        kind: 'getsuga', owner: b,
        x: b.x + cx * b.r * 1.1, y: b.y + sy * b.r * 1.1,
        vx: cx * sp, vy: sy * sp, angle: a.angle, r: b.r * 1.08, age: 0, life: 1.6, dmg: 18, impulse: 300,
      });
      spawnSparks(b.x + cx * b.r, b.y + sy * b.r, GETSUGA_RED, 12, 1);
    } else if (b.type === 'broly') {
      sfx.dash();
      addShake(4.5);
      if (b.freezeTimer <= 0) { b.vx = cx * 735; b.vy = sy * 735; }
      spawnSparks(b.x, b.y, BROLY_GREEN, 16, 1.2);
    } else if (b.type === 'vegeta') {
      sfx.laserZap();
      const sp = 390 * s;
      shots.push({
        kind: 'hakai', owner: b,
        x: b.x + cx * b.r * 1.15, y: b.y + sy * b.r * 1.15,
        vx: cx * sp, vy: sy * sp, speed: sp, angle: a.angle,
        r: b.r * 0.54, age: 0, life: 2.4, dmg: 14 + a.ego * 2,
      });
    } else if (b.type === 'gurren') {
      sfx.dash();
      addShake(4);
      if (b.freezeTimer <= 0) { b.vx = cx * 660; b.vy = sy * 660; }
    } else if (b.type === 'shanks') {
      a.x = b.x; a.y = b.y;
      sfx.slash();
      addShake(5.5);
      // Close-range Conqueror's Haki stagger burst before the slash tears across
      if (inCircle(b.x, b.y, b.r * 3.3, foe)) {
        foe.freezeTimer = Math.max(foe.freezeTimer, 0.38);
        hurt(b, foe, 4, b.x, b.y, SHANKS_RED, 0, false);
        if (!isPlaying()) return;
      }
      const sp = 740 * s;
      shots.push({
        kind: 'divine', owner: b,
        x: b.x + cx * b.r * 1.1, y: b.y + sy * b.r * 1.1,
        vx: cx * sp, vy: sy * sp, angle: a.angle, r: b.r * 1.22, age: 0, life: 1.6, dmg: 20, impulse: 390,
      });
      spawnSparks(b.x, b.y, SHANKS_RED, 15, 1.15);
    }
  }

  function resolveAttack(b, foe, a, dt, s) {
    if (b.type === 'luffy') {
      if (a.done || a.time < 0.16) return;
      a.done = true;
      sfx.boom();
      addShake(8);
      spawnSparks(a.x, a.y, HAKI, 20, 1.35);
      effects.emit('luffy', 'rupture', a.x, a.y, fistRadius() * 0.72, a.angle);
      if (inCircle(a.x, a.y, fistRadius(), foe)) hurt(b, foe, 28, a.x, a.y, HAKI, 380, true);
      return;
    }
    if (b.type === 'saitama') {
      if (a.done || a.time < 0.10) return;
      a.done = true;
      sfx.boom();
      addShake(10);
      const px = b.x + Math.cos(a.angle) * b.r * 1.8, py = b.y + Math.sin(a.angle) * b.r * 1.8;
      effects.emit('saitama', 'rupture', px, py, b.r * 2.05, a.angle);
      spawnSparks(px, py, SAITAMA_RED, 22, 1.45);
      const dx = foe.x - b.x, dy = foe.y - b.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= punchRange()) {
        const diff = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - a.angle), Math.cos(Math.atan2(dy, dx) - a.angle)));
        const pad = dist > 1 ? Math.atan2(foe.r * 0.85, dist) : Math.PI;
        if (diff <= punchHalfAngle() + pad) hurt(b, foe, 30, b.x, b.y, SAITAMA_RED, 520, true);
      }
      return;
    }
    if (b.type === 'madara') {
      if (!a.done) {
        aimAt(b, foe, a, s, dt * 0.45);
        if (a.time >= 0.65) {
          a.done = true;
          sfx.slash();
          addShake(5);
          const dx = foe.x - b.x, dy = foe.y - b.y;
          const dist = Math.hypot(dx, dy);
          const diff = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - a.angle), Math.cos(Math.atan2(dy, dx) - a.angle)));
          if (dist <= b.r * 3.6 + foe.r && diff <= 1.05) {
            hurt(b, foe, 20, b.x, b.y, SUSANOO_BLUE, 360, true);
          }
        }
      }
      return;
    }
    if (b.type === 'broly') {
      if (b.freezeTimer <= 0 && !a.done) {
        b.vx = Math.cos(a.angle) * 735;
        b.vy = Math.sin(a.angle) * 735;
        sampleTrail(b, dt);
      }
      if (!a.done && inCircle(b.x, b.y, b.r * 1.45, foe)) {
        a.done = true;
        const rage = 1 - clamp(b.health / b.maxHealth, 0, 1);
        const dmg = Math.round(16 + rage * 10);
        sfx.boom();
        addShake(7.5);
        hurt(b, foe, dmg, b.x, b.y, BROLY_GREEN, 420, true);
      }
      return;
    }
    if (b.type === 'gurren') {
      aimAt(b, foe, a, s, dt * 0.16);
      if (b.freezeTimer <= 0) {
        b.vx = Math.cos(a.angle) * 650;
        b.vy = Math.sin(a.angle) * 650;
        b.facing = a.angle;
        sampleTrail(b, dt);
      }
      a.tick -= dt;
      if (a.tick <= 0) {
        const dx = Math.cos(a.angle), dy = Math.sin(a.angle);
        if (segHit(b.x + dx * b.r * 0.5, b.y + dy * b.r * 0.5, b.x + dx * b.r * 3.25, b.y + dy * b.r * 3.25, b.r * 0.55, foe)) {
          a.tick = 0.14;
          sfx.knifeHit();
          hurt(b, foe, 5, b.x, b.y, SPIRAL_GREEN, 115, false);
        }
      }
      return;
    }

    a.tick -= dt;
    if (a.tick > 0) return;
    if (b.type === 'goku') {
      const beam = beamGeometry(b, a);
      const fx = foe.x - b.x, fy = foe.y - b.y;
      const along = clamp(fx * beam.dx + fy * beam.dy, beam.start, beam.length);
      const reach = foe.r + beam.width;
      if ((fx - along * beam.dx) ** 2 + (fy - along * beam.dy) ** 2 <= reach ** 2) {
        a.tick = 0.115;
        hurt(b, foe, 4 + a.form, b.x, b.y, GOKU_COLORS[0], 63);
      }
    } else if (b.type === 'sukuna' && inCircle(a.x, a.y, shrineRadius(a), foe)) {
      a.tick = 0.17;
      hurt(b, foe, 2, a.x, a.y, SHRINE);
    }
  }

  function updateProjectiles(dt) {
    for (let i = shots.length - 1; i >= 0; i--) {
      const p = shots[i];
      const foe = foeOf(p.owner);
      if (!p.owner.alive || !foe.alive) { shots.splice(i, 1); continue; }
      p.age += dt;

      if (p.kind === 'knife') {
        if (!p.launched) {
          p.hold -= dt;
          if (p.hold <= 0) {
            p.launched = true;
            effects.emit('dio', 'cast', p.x, p.y, p.r * 1.7, p.angle);
            sfx.knife();
          }
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        sampleTrail(p, dt);
        if (inCircle(p.x, p.y, p.r * 0.7, foe)) {
          sfx.knifeHit();
          hurt(p.owner, foe, 4, p.x, p.y, DIO_GOLD, 95, false);
          shots.splice(i, 1);
          if (!isPlaying()) return;
          continue;
        }
        if (p.age >= p.life || p.x < arena.x || p.x > arena.x + arena.w || p.y < arena.y || p.y > arena.y + arena.h) {
          shots.splice(i, 1);
        }
      } else if (p.kind === 'rasen') {
        if (p.burst) {
          p.burstAge += dt;
          p.tick -= dt;
          if (p.tick <= 0 && p.ticks < 4 && inCircle(p.x, p.y, p.burstR, foe)) {
            p.tick = 0.13;
            p.ticks++;
            hurt(p.owner, foe, 5, p.x, p.y, KURAMA_GOLD, p.ticks === 4 ? 280 : 40, p.ticks === 4);
            if (!isPlaying()) return;
          }
          if (p.burstAge >= p.burstLife) shots.splice(i, 1);
          continue;
        }
        const want = Math.atan2(foe.y - p.y, foe.x - p.x);
        p.angle = blendAngle(p.angle, want, unit(dt * 2.2));
        p.vx = Math.cos(p.angle) * p.speed;
        p.vy = Math.sin(p.angle) * p.speed;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        let bounced = false;
        if (p.x < arena.x + p.r) { p.x = arena.x + p.r; p.vx = Math.abs(p.vx); bounced = true; }
        else if (p.x > arena.x + arena.w - p.r) { p.x = arena.x + arena.w - p.r; p.vx = -Math.abs(p.vx); bounced = true; }
        if (p.y < arena.y + p.r) { p.y = arena.y + p.r; p.vy = Math.abs(p.vy); bounced = true; }
        else if (p.y > arena.y + arena.h - p.r) { p.y = arena.y + arena.h - p.r; p.vy = -Math.abs(p.vy); bounced = true; }
        if (bounced) {
          p.angle = Math.atan2(p.vy, p.vx); p.bounces++;
          effects.emit('naruto', 'cast', p.x, p.y, p.r * 1.58, p.angle);
        }
        sampleTrail(p, dt);
        if (inCircle(p.x, p.y, p.r, foe) || p.bounces > 1 || p.age >= p.life) {
          p.burst = true;
          p.tick = 0;
          effects.emit('naruto', 'rupture', p.x, p.y, p.burstR * 0.63, p.angle);
          sfx.boom();
          addShake(4.5);
        }
      } else if (p.kind === 'getsuga' || p.kind === 'divine') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        sampleTrail(p, dt);
        const col = p.kind === 'divine' ? SHANKS_RED : GETSUGA_RED;
        if (inCircle(p.x, p.y, p.r * 0.9, foe)) {
          sfx.slash();
          addShake(5.5);
          hurt(p.owner, foe, p.dmg, p.x, p.y, col, p.impulse, true);
          shots.splice(i, 1);
          if (!isPlaying()) return;
          continue;
        }
        if (p.age >= p.life || p.x < arena.x - p.r || p.x > arena.x + arena.w + p.r || p.y < arena.y - p.r || p.y > arena.y + arena.h + p.r) {
          shots.splice(i, 1);
        }
      } else if (p.kind === 'hakai') {
        const want = Math.atan2(foe.y - p.y, foe.x - p.x);
        p.angle = blendAngle(p.angle, want, unit(dt * 3.5));
        p.vx = Math.cos(p.angle) * p.speed;
        p.vy = Math.sin(p.angle) * p.speed;
        p.x = clamp(p.x + p.vx * dt, arena.x + p.r, arena.x + arena.w - p.r);
        p.y = clamp(p.y + p.vy * dt, arena.y + p.r, arena.y + arena.h - p.r);
        sampleTrail(p, dt);
        if (inCircle(p.x, p.y, p.r, foe)) {
          sfx.boom();
          addShake(6.5);
          spawnSparks(p.x, p.y, EGO_PURPLE, 18, 1.25);
          hurt(p.owner, foe, p.dmg, p.x, p.y, EGO_PURPLE, 320, true);
          shots.splice(i, 1);
          if (!isPlaying()) return;
          continue;
        }
        if (p.age >= p.life) {
          effects.emit('vegeta', 'shift', p.x, p.y, p.r * 1.6, p.angle);
          spawnSparks(p.x, p.y, EGO_PURPLE, 10, 0.8);
          shots.splice(i, 1);
        }
      }
    }
  }

  function update(dt, s) {
    if (!isPlaying()) return;
    for (const b of balls) {
      const a = b.anime;
      if (!a || !b.alive) continue;
      const foe = foeOf(b);
      if (!foe.alive) continue;
      const config = CONFIG[b.type];
      a.hitFlash = Math.max(0, a.hitFlash - dt);

      if (b.type === 'goku') {
        const next = gokuForm(b.health / b.maxHealth);
        if (next > a.form) {
          a.form = next;
          b.morphPulse = 1;
          spawnPopup(b.x, b.y - b.r * 1.7, next === 1 ? 'SUPER SAIYAN' : 'SUPER SAIYAN BLUE', GOKU_COLORS[next], 0, -51, true);
          spawnSparks(b.x, b.y, GOKU_COLORS[next], 16, 0.9);
          sfx.chargeFull();
        }
      } else if (b.type === 'broly') {
        const rage = 1 - b.health / b.maxHealth;
        a.form = rage >= 0.5 ? 2 : rage >= 0.2 ? 1 : 0;
      } else if (b.type === 'saitama') {
        a.form = (a.mode === 'windup' || a.mode === 'active') ? 1 : 0;
      }

      a.time += dt;
      if (a.mode === 'rest' && a.time >= a.duration && b.freezeTimer <= 0) {
        stage(a, 'windup', config.windup, 0);
        a.angle = Math.atan2(foe.y - b.y, foe.x - b.x);
        a.x = b.type === 'luffy' ? foe.x : b.x;
        a.y = b.type === 'luffy' ? foe.y : b.y;
        a.done = false;
        if (b.type === 'broly' || b.type === 'gurren') b.fxTrail = null;
        if (b.type === 'saitama') a.form = 1;
        sfx.chargeFull();
      }
      if (a.mode === 'windup') {
        if (b.type === 'dio' || b.type === 'sukuna') { a.x = b.x; a.y = b.y; }
        if (AIM_TYPES.has(b.type) && a.time < a.duration - 0.18) aimAt(b, foe, a, s, dt);
        if (a.time >= a.duration) {
          activate(b, foe, a, config, a.time - a.duration, s);
          if (!isPlaying()) return;
        }
      }
      if (a.mode === 'active') {
        if (b.type === 'goku' && a.time < 0.25) aimAt(b, foe, a, s, dt * 0.32);
        if (a.time < a.duration) resolveAttack(b, foe, a, dt, s);
        else stage(a, 'recover', config.recover, a.time - a.duration);
        if (!isPlaying()) return;
      }
      if (a.mode === 'recover' && a.time >= a.duration) stage(a, 'rest', config.rest, a.time - a.duration);
    }
    updateProjectiles(dt);
  }

  function remap(mapX, mapY) {
    for (const b of balls) {
      const a = b.anime;
      if (a && a.mode !== 'rest' && (b.type === 'luffy' || b.type === 'sukuna' || b.type === 'dio' || b.type === 'shanks')) {
        a.x = mapX(a.x);
        a.y = mapY(a.y);
      }
      remapTrail(b, mapX, mapY);
    }
    for (const p of shots) {
      p.x = mapX(p.x); p.y = mapY(p.y);
      remapTrail(p, mapX, mapY);
    }
    effects.remap(mapX, mapY);
  }

  function hasFrontEffects() {
    return effects.active || (isPlaying() && (shots.length > 0 || balls.some(b =>
      b.alive && FRONT_ANIME_TYPES.has(b.type) && b.anime.mode !== 'rest')));
  }

  function isTimeStopped(b) {
    const caster = foeOf(b);
    return isPlaying() && caster.alive && caster.type === 'dio' &&
      caster.anime.mode === 'active' && caster.anime.fxCaught && caster.anime.time < 1.05;
  }

  function draw(ctx, time, quality, front = false) {
    const reduced = prefersReducedMotion();
    const detail = reduced ? Math.min(quality, 0.49) : quality;
    const visualTime = reduced ? time * 0.23 : time;
    if (!isPlaying()) { effects.draw(ctx, detail, front); return; }
    if (front) {
      for (const b of balls) {
        const a = b.anime;
        if (!b.alive || !a || a.mode === 'rest') continue;
        if (b.type === 'luffy') drawBajrangStrike(ctx, b, a, fistRadius(), true);
        else drawPackFront(ctx, b, a, detail, reduced);
      }
      drawPackProjectiles(ctx, shots, visualTime, detail, true);
      effects.draw(ctx, detail, true);
      return;
    }
    for (const b of balls) {
      const a = b.anime;
      if (!b.alive || !a) continue;
      if (b.type === 'vegeta' && a.ego) drawEgoPips(ctx, b, a, visualTime);
      if (a.mode === 'rest') continue;
      if (b.type === 'goku') drawKamehameha(ctx, b, a, beamGeometry(b, a), visualTime, detail);
      else if (b.type === 'luffy') {
        const radius = fistRadius();
        drawBajrangTarget(ctx, a, radius, visualTime);
        drawBajrangStrike(ctx, b, a, radius, false);
      } else if (b.type === 'sukuna') {
        drawDomain(ctx, a, shrineRadius(a), b.r, visualTime, detail);
      } else {
        drawPackFloor(ctx, b, a, fxHelpers, visualTime, detail, b.type === 'dio' ? foeOf(b) : undefined);
      }
    }
    drawPackProjectiles(ctx, shots, visualTime, detail, false);
    effects.draw(ctx, detail, false);
  }

  return { update, remap, draw, reset, onDamaged, shots, hasFrontEffects, isTimeStopped, updateVisuals: effects.advance,
    drawTitles: ctx => { if (isPlaying()) effects.drawTitles(ctx, prefersReducedMotion()); } };
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, TAU);
}

function line(ctx, x0, y0, x1, y1) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
}

function drawKamehameha(ctx, b, a, g, time, quality) {
  if (a.mode === 'recover') return;
  const blue = GOKU_COLORS[0];
  const charged = a.mode === 'windup';
  const progress = unit(a.time / a.duration);
  ctx.save();
  ctx.lineCap = 'round';
  if (charged) {
    ctx.setLineDash([5, 8]);
    ctx.lineDashOffset = -time * 35;
    ctx.strokeStyle = rgba(blue, 0.16 + 0.4 * progress);
    ctx.lineWidth = 1.25;
    line(ctx, g.x0, g.y0, g.x1, g.y1);
    ctx.stroke();
    ctx.setLineDash([]);
    const radius = b.r * (0.14 + progress * 0.44);
    const glow = ctx.createRadialGradient(g.x0, g.y0, 0, g.x0, g.y0, radius * 2.2);
    glow.addColorStop(0, '#ffffff');
    glow.addColorStop(0.37, '#b6fbff');
    glow.addColorStop(0.53, '#3caeff');
    glow.addColorStop(1, 'rgba(30,110,255,0)');
    ctx.fillStyle = glow;
    circle(ctx, g.x0, g.y0, radius * 2.2);
    ctx.fill();
    ctx.strokeStyle = '#b0edff';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(g.x0, g.y0, radius * 1.26, radius * 0.69, time * 3, 0.4, 4.65);
    ctx.stroke();
  } else {
    const taper = 0.64 + Math.sin(progress * Math.PI) * 0.36;
    ctx.globalAlpha = unit((1 - progress) * 5);
    line(ctx, g.x0, g.y0, g.x1, g.y1);
    ctx.lineWidth = 4.9 * g.width * taper;
    ctx.strokeStyle = 'rgba(31,103,255,0.19)';
    ctx.stroke();
    ctx.lineWidth = 3.2 * g.width * taper;
    ctx.strokeStyle = 'rgba(29,132,255,0.56)';
    ctx.stroke();
    ctx.lineWidth = 2 * g.width * taper;
    ctx.strokeStyle = '#58d9ff';
    ctx.stroke();
    ctx.lineWidth = 0.85 * g.width * taper;
    ctx.strokeStyle = '#f1fdff';
    ctx.stroke();
    if (quality > 0.55) {
      ctx.strokeStyle = 'rgba(163,239,255,0.76)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i <= 16; i++) {
        const t = i / 16, amp = Math.sin(time * 36 - i * 3) * g.width * 1.52 * Math.sin(t * Math.PI);
        const x = lerp(g.x0, g.x1, t) - g.dy * amp;
        const y = lerp(g.y0, g.y1, t) + g.dx * amp;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.fillStyle = '#dbfcff';
    circle(ctx, g.x0, g.y0, g.width * 1.09);
    ctx.fill();
  }
  ctx.restore();
}

function drawBajrangTarget(ctx, a, radius, time) {
  const t = unit(a.time / a.duration);
  const preparing = a.mode === 'windup';
  const alpha = preparing ? 0.85 : a.mode === 'recover' ? 1 - t : 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = preparing ? 'rgba(255,77,115,0.11)' : 'rgba(255,87,126,0.2)';
  circle(ctx, a.x, a.y, radius);
  ctx.fill();
  ctx.setLineDash(preparing ? [7, 6] : []);
  ctx.lineDashOffset = -time * 38;
  ctx.lineWidth = 2;
  ctx.strokeStyle = preparing ? '#f586ac' : '#ffd0dc';
  ctx.stroke();
  ctx.setLineDash([]);
  if (a.done) {
    const blast = a.mode === 'active' ? unit((a.time - 0.16) / 0.18) * 0.7 : 0.7 + t * 0.3;
    circle(ctx, a.x, a.y, radius * (0.25 + blast * 1.22));
    ctx.strokeStyle = `rgba(255,210,237,${1 - blast})`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.restore();
}

function drawBajrangStrike(ctx, b, a, radius, fist) {
  const t = unit(a.time / a.duration);
  const prepare = a.mode === 'windup';
  const recede = a.mode === 'recover';
  const scale = prepare ? (0.28 + 0.72 * t) : recede ? 1 - 0.66 * t : 1;
  const z = prepare ? (0.4 + 0.6 * t) : recede ? t * 0.78 : 1 - unit(a.time / 0.16);
  const x = a.x + radius * 0.25 * z;
  const y = a.y - radius * 1.02 * z;
  ctx.save();
  ctx.globalAlpha = recede ? 1 - t : 1;
  if (!fist) {
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + b.r * 0.46);
    ctx.quadraticCurveTo(lerp(b.x, x, 0.42), lerp(b.y, y, 0.3) + b.r * 0.62 - radius * z, x, y);
    ctx.strokeStyle = '#42334d';
    ctx.lineWidth = Math.max(6, b.r * 0.54);
    ctx.stroke();
    ctx.strokeStyle = '#ffc99f';
    ctx.lineWidth *= 0.76;
    ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.translate(x, y);
  ctx.rotate(-0.28 + z * 0.45);
  const r = scale * radius;
  ctx.scale(r, r);
  ctx.beginPath();
  ctx.moveTo(-0.71, 0.68);
  ctx.bezierCurveTo(-1.18, 0.26, -1.06, -0.48, -0.78, -0.76);
  ctx.quadraticCurveTo(-0.49, -1.05, -0.24, -0.84);
  ctx.quadraticCurveTo(0.02, -1.14, 0.27, -0.89);
  ctx.quadraticCurveTo(0.57, -1.02, 0.70, -0.70);
  ctx.bezierCurveTo(1.09, -0.69, 1.12, 0.0, 0.88, 0.45);
  ctx.quadraticCurveTo(0.52, 1.10, -0.36, 0.9);
  ctx.closePath();
  const skin = ctx.createRadialGradient(-0.34, -0.47, 0.02, 0, 0, 1.16);
  skin.addColorStop(0, '#997194');
  skin.addColorStop(0.33, '#43344b');
  skin.addColorStop(0.65, '#201724');
  skin.addColorStop(1, '#0d0b19');
  ctx.fillStyle = skin;
  ctx.fill();
  ctx.strokeStyle = '#ef719f';
  ctx.lineWidth = 0.038;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(243,206,227,0.47)';
  ctx.lineWidth = 0.035;
  for (let i = 0; i < 3; i++) {
    const xx = -0.58 + i * 0.4;
    ctx.beginPath();
    ctx.moveTo(xx, -0.69);
    ctx.quadraticCurveTo(xx + 0.13, -0.45, xx + 0.1, -0.23);
    ctx.stroke();
  }
  ctx.restore();
}

function drawShrine(ctx, x, y, r, open) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(r, r);
  ctx.fillStyle = '#2d0d1f';
  ctx.fillRect(-0.92, -0.48, 1.84, 1.43);
  ctx.fillStyle = '#8b1e39';
  ctx.fillRect(-0.94, -0.27, 0.22, 1.15);
  ctx.fillRect(0.72, -0.27, 0.22, 1.15);
  ctx.fillStyle = '#100914';
  ctx.beginPath();
  ctx.ellipse(0, 0.35, 0.61, 0.45 * open + 0.11, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#f3a69d';
  for (let i = -2; i <= 2; i++) {
    ctx.fillRect(i * 0.18 - 0.051, 0.29 - 0.33 * open, 0.10, 0.12);
  }
  ctx.lineWidth = 0.047;
  for (const [yy, w] of [[-0.39, 1.32], [-0.93, 1.02]]) {
    ctx.beginPath();
    ctx.moveTo(-w, yy - 0.34);
    ctx.quadraticCurveTo(-w * 0.79, yy - 0.08, -w * 0.34, yy - 0.32);
    ctx.lineTo(0, yy - 0.56);
    ctx.lineTo(w * 0.34, yy - 0.32);
    ctx.quadraticCurveTo(w * 0.79, yy - 0.08, w, yy - 0.34);
    ctx.quadraticCurveTo(w * 0.93, yy + 0.07, w * 0.64, yy + 0.12);
    ctx.lineTo(-w * 0.64, yy + 0.12);
    ctx.quadraticCurveTo(-w * 0.93, yy + 0.07, -w, yy - 0.34);
    ctx.fillStyle = '#29111e';
    ctx.fill();
    ctx.strokeStyle = '#fd7087';
    ctx.stroke();
  }
  ctx.restore();
}

function drawDomain(ctx, a, radius, ballRadius, time, quality) {
  const t = unit(a.time / a.duration);
  const warmup = a.mode === 'windup';
  const active = a.mode === 'active';
  const r = warmup ? radius * (0.5 + 0.5 * t) : a.mode === 'recover' ? radius * 0.74 : radius;
  ctx.save();
  ctx.globalAlpha = warmup ? 0.35 + 0.45 * t : active ? 0.92 : 1 - t;
  const ink = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, r);
  ink.addColorStop(0, 'rgba(183,18,49,0.34)');
  ink.addColorStop(0.8, 'rgba(175,8,47,0.26)');
  ink.addColorStop(1, 'rgba(235,41,86,0.43)');
  ctx.fillStyle = ink;
  circle(ctx, a.x, a.y, r);
  ctx.fill();
  ctx.lineWidth = active ? 2.8 : 1.6;
  ctx.strokeStyle = '#f04c71';
  if (warmup) ctx.setLineDash([7, 7]);
  ctx.stroke();
  ctx.setLineDash([]);
  if (active) {
    ctx.strokeStyle = 'rgba(255,171,189,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 24; i++) {
      const an = i * TAU / 24;
      ctx.moveTo(a.x + Math.cos(an) * r * 0.95, a.y + Math.sin(an) * r * 0.95);
      ctx.lineTo(a.x + Math.cos(an) * r * 0.983, a.y + Math.sin(an) * r * 0.983);
    }
    ctx.stroke();
    ctx.save();
    circle(ctx, a.x, a.y, r);
    ctx.clip();
    const flash = unit(a.hitFlash / 0.18);
    const count = quality > 0.6 ? 6 : 3;
    for (let i = 0; i < count; i++) {
      const an = i * 2.4 + Math.floor(time * 8) * 0.63;
      const d = r * (0.19 + i * 0.115);
      const x = a.x + Math.cos(an) * d, y = a.y + Math.sin(an) * d;
      const span = r * (0.12 + (i % 3) * 0.06);
      ctx.strokeStyle = `rgba(255,193,207,${0.18 + 0.5 * flash})`;
      ctx.lineWidth = 1 + flash * 1.35;
      line(ctx, x - span, y + span * 0.62, x + span, y - span * 0.62);
      ctx.stroke();
    }
    ctx.restore();
  }
  drawShrine(ctx, a.x, a.y + ballRadius * 0.4, Math.min(ballRadius * 1.13, r * 0.43), active ? 1 : 0.45);
  ctx.restore();
}
