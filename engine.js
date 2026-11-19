import { ANIME_INFO, ANIME_NEW_IDS, ANIME_TYPES, createAnimeRivals, createAnimeState, portraitFormFor } from './anime-rivals.js';
import { drawAnimeArrow, drawAnimeAura, drawAnimePortrait } from './anime-rivals-art.js';

let __bvbStarted = false;

export function initGame(canvas = document.getElementById('c')) {
  if (__bvbStarted || !canvas) return;
  let ctx = canvas.getContext('2d');
  if (!ctx) return;
  __bvbStarted = true;

  /* ---------- baked layers, sprites and adaptive quality ----------
     Anything that does not change between frames is painted once into an
     offscreen canvas and blitted, instead of being re-shaded every frame.
     `quality` drops automatically when frames run long, so weak devices keep
     a smooth game instead of a pretty one. */

  let quality = 1;
  let frameMs = 10;
  let framesRun = 0;
  const ctxStack = [];
  const spriteCache = new Map();
  const layerCache = new Map();

  function withCanvas(c, fn) {
    ctxStack.push(ctx);
    ctx = c;
    try { fn(); } finally { ctx = ctxStack.pop(); }
  }

  function invalidateSprites() {
    spriteCache.clear();
    layerCache.clear();
  }

  function newCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }

  // Paints `paint` once per key and blits it, scaled, with padding for the aura
  function drawBaked(key, radius, cx, cy, scale, paint) {
    // Enough room for the aura and any weapon art (the widest mini renderer
    // reaches 1.7 radii) without caching canvases far larger than the ball
    const pad = Math.ceil(radius * 1.0) + 5;
    const size = Math.ceil(radius * 2 + pad * 2);
    const ck = `${key}|${size}|${dpr}`;
    let entry = spriteCache.get(ck);
    if (!entry) {
      const c = newCanvas(size * dpr, size * dpr);
      const g = c.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      withCanvas(g, () => paint(size / 2, size / 2, radius));
      entry = { canvas: c, size };
      spriteCache.set(ck, entry);
    }
    const w = entry.size * scale;
    ctx.drawImage(entry.canvas, cx - w / 2, cy - w / 2, w, w);
  }

  // Full-screen layer, re-baked only when its signature changes
  function bakeLayer(key, sig, w, h, paint) {
    let l = layerCache.get(key);
    if (!l) { l = { sig: '' }; layerCache.set(key, l); }
    if (l.sig === sig && l.canvas) return l.canvas;
    if (!l.canvas) l.canvas = newCanvas(w * dpr, h * dpr);
    else {
      l.canvas.width = Math.max(1, Math.round(w * dpr));
      l.canvas.height = Math.max(1, Math.round(h * dpr));
    }
    const g = l.canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    withCanvas(g, paint);
    l.sig = sig;
    return l.canvas;
  }

  // Picker, inventory and hover-card miniatures all share these baked balls
  function drawBallSprite(side, type, r, cx, cy, scale) {
    const pal = getPalette(type, side);
    drawBaked(`ball:${side}:${type}`, r * 1.3, cx, cy, (scale || 1) / 1.3, (mx, my, rr) => {
      drawBallModel({
        x: mx, y: my, r: rr, type,
        color: pal.color, dark: pal.dark, accent: pal.accent, glow: pal.glow,
        facing: -0.35, hit: 0, hitAngle: 0, healPulse: 0, morphPulse: 0,
        bladeCount: 2, bladeAngle: 0.6, side, isMini: true, isLatched: false,
        gunAngle: -0.55, ref: null
      });
    });
  }

  let W = 1, H = 1, dpr = 1;
  const arena = { x: 0, y: 0, w: 600, h: 480, r: 22 };
  const picker = { items: [], hover: -1 };

  const LAUNCH_SPEED = 515;
  const MIN_SPEED = 325;
  const MAX_SPEED = 740;
  const FADE_TIME = 0.3;
  const MAX_LIVES = 3;
  const RESET_DELAY = 1.65;
  const MATCH_RESET_DELAY = 2.35;

  // Grouped by rarity: common, rare, epic, legendary, mythic
  const BALL_ORDER = [
    'classic',
    'vampire', 'blade', 'electric', 'burst', 'machine', 'zone', 'spider', 'snake', 'thief', 'axe', 'charge', 'reforge', 'range', 'electroking', 'acid', 'bigspike', 'cell', 'hook',
    'laser', 'poison', 'fibonacci', 'bomb', 'cannon', 'dice', 'frost', 'apple', 'spear', 'cactus', 'wdc', 'ichigo', 'gurren',
    'glass', 'hive', 'harpoon', 'beam', 'chess', 'verity', 'goku', 'dio', 'naruto', 'broly', 'vegeta',
    'shackles', 'gojo', 'luffy', 'sukuna', 'madara', 'saitama', 'shanks'
  ];

  const TYPES = {
    ...ANIME_TYPES,
    classic: {
      id: 'classic',
      maxHealth: 100,
      player: {
        color: { r: 255, g: 92, b: 112 },
        dark: { r: 122, g: 12, b: 42 },
        accent: { r: 255, g: 215, b: 220 }
      },
      bot: {
        color: { r: 72, g: 182, b: 255 },
        dark: { r: 12, g: 52, b: 132 },
        accent: { r: 210, g: 242, b: 255 }
      }
    },
    vampire: {
      id: 'vampire',
      maxHealth: 100,
      color: { r: 207, g: 36, b: 44 },    // official #cf242c
      dark: { r: 74, g: 6, b: 18 },
      accent: { r: 252, g: 251, b: 252 }, // official #fcfbfc
      glow: { r: 255, g: 52, b: 78 }
    },
    blade: {
      id: 'blade',
      maxHealth: 100,
      color: { r: 135, g: 137, b: 142 },  // official #87898e / #626a7b
      dark: { r: 52, g: 58, b: 72 },
      accent: { r: 127, g: 250, b: 255 }, // official #7ffaff
      glow: { r: 122, g: 194, b: 237 }    // official #7ac2ed
    },
    laser: {
      id: 'laser',
      maxHealth: 100,
      color: { r: 121, g: 30, b: 211 },   // official #791ed3
      dark: { r: 42, g: 8, b: 86 },
      accent: { r: 254, g: 178, b: 255 }, // official #feb2ff
      glow: { r: 212, g: 96, b: 255 }
    },
    glass: {
      id: 'glass',
      maxHealth: 100,
      color: { r: 140, g: 232, b: 226 },
      dark: { r: 30, g: 92, b: 116 },
      accent: { r: 255, g: 255, b: 255 },
      glow: { r: 118, g: 244, b: 236 }
    },
    electric: {
      id: 'electric',
      maxHealth: 100,
      color: { r: 14, g: 146, b: 222 },
      dark: { r: 4, g: 65, b: 121 },
      accent: { r: 208, g: 255, b: 255 },
      glow: { r: 52, g: 201, b: 255 }
    },
    burst: {
      id: 'burst',
      maxHealth: 100,
      color: { r: 239, g: 119, b: 36 },   // official #ef7724
      dark: { r: 116, g: 40, b: 8 },
      accent: { r: 255, g: 237, b: 78 },  // official #ffed4e
      glow: { r: 255, g: 146, b: 44 }
    },
    poison: {
      id: 'poison',
      maxHealth: 100,
      color: { r: 126, g: 226, b: 74 },
      dark: { r: 24, g: 76, b: 24 },
      accent: { r: 214, g: 255, b: 140 },
      glow: { r: 132, g: 255, b: 84 }
    },
    shackles: {
      id: 'shackles',
      maxHealth: 100,
      color: { r: 150, g: 110, b: 255 },
      dark: { r: 40, g: 22, b: 96 },
      accent: { r: 226, g: 232, b: 245 },
      glow: { r: 170, g: 120, b: 255 }
    },
    machine: {
      id: 'machine',
      maxHealth: 100,
      color: { r: 128, g: 140, b: 96 },
      dark: { r: 40, g: 46, b: 28 },
      accent: { r: 255, g: 196, b: 80 },
      glow: { r: 255, g: 176, b: 72 }
    },
    fibonacci: {
      id: 'fibonacci',
      maxHealth: 100,
      color: { r: 88, g: 97, b: 153 },    // official #586199
      dark: { r: 37, g: 50, b: 115 },     // official #253273
      accent: { r: 239, g: 220, b: 125 }, // official #efdc7d
      glow: { r: 120, g: 136, b: 232 }
    },
    bomb: {
      id: 'bomb',
      maxHealth: 100,
      color: { r: 96, g: 62, b: 142 },
      dark: { r: 30, g: 14, b: 50 },
      accent: { r: 255, g: 170, b: 60 },
      glow: { r: 168, g: 100, b: 236 }
    },
    zone: {
      id: 'zone',
      maxHealth: 100,
      color: { r: 255, g: 52, b: 72 },
      dark: { r: 110, g: 8, b: 24 },
      accent: { r: 255, g: 196, b: 202 },
      glow: { r: 255, g: 64, b: 84 }
    },
    spider: {
      id: 'spider',
      maxHealth: 100,
      color: { r: 222, g: 40, b: 50 },
      dark: { r: 80, g: 6, b: 12 },
      accent: { r: 255, g: 255, b: 255 },
      glow: { r: 255, g: 72, b: 84 }
    },
    snake: {
      id: 'snake',
      maxHealth: 100,
      color: { r: 80, g: 190, b: 70 },
      dark: { r: 16, g: 70, b: 30 },
      accent: { r: 200, g: 255, b: 120 },
      glow: { r: 110, g: 230, b: 90 }
    },
    cannon: {
      id: 'cannon',
      maxHealth: 100,
      color: { r: 110, g: 114, b: 128 },
      dark: { r: 28, g: 30, b: 36 },
      accent: { r: 232, g: 180, b: 90 },
      glow: { r: 214, g: 176, b: 120 }
    },
    dice: {
      id: 'dice',
      maxHealth: 100,
      color: { r: 240, g: 236, b: 226 },
      dark: { r: 130, g: 122, b: 104 },
      accent: { r: 255, g: 74, b: 74 },
      glow: { r: 255, g: 238, b: 210 }
    },
    hive: {
      id: 'hive',
      maxHealth: 100,
      color: { r: 255, g: 190, b: 40 },
      dark: { r: 110, g: 58, b: 6 },
      accent: { r: 255, g: 230, b: 140 },
      glow: { r: 255, g: 200, b: 60 }
    },
    thief: {
      id: 'thief',
      maxHealth: 100,
      color: { r: 90, g: 97, b: 133 },
      dark: { r: 16, g: 18, b: 30 },
      accent: { r: 222, g: 228, b: 240 },
      glow: { r: 140, g: 150, b: 200 }
    },
    axe: {
      id: 'axe',
      maxHealth: 100,
      color: { r: 210, g: 58, b: 44 },
      dark: { r: 70, g: 12, b: 8 },
      accent: { r: 226, g: 232, b: 240 },
      glow: { r: 240, g: 90, b: 70 }
    },
    charge: {
      id: 'charge',
      maxHealth: 100,
      color: { r: 255, g: 79, b: 184 },
      dark: { r: 70, g: 6, b: 46 },
      accent: { r: 255, g: 230, b: 246 },
      glow: { r: 255, g: 90, b: 200 }
    },
    frost: {
      id: 'frost',
      maxHealth: 100,
      color: { r: 150, g: 214, b: 255 },
      dark: { r: 30, g: 84, b: 140 },
      accent: { r: 240, g: 250, b: 255 },
      glow: { r: 170, g: 226, b: 255 }
    },
    apple: {
      id: 'apple',
      maxHealth: 100,
      color: { r: 236, g: 40, b: 50 },
      dark: { r: 100, g: 4, b: 12 },
      accent: { r: 124, g: 207, b: 74 },
      glow: { r: 255, g: 80, b: 80 }
    },
    /* ---------- Harpoon Ball, added from the Roblox game Ball VS Ball ---------- */
    harpoon: {
      id: 'harpoon',
      maxHealth: 100,
      color: { r: 13, g: 79, b: 92 },      // dark teal, as in Ball VS Ball
      dark: { r: 4, g: 26, b: 34 },
      accent: { r: 210, g: 244, b: 255 },  // neon white-blueish marking
      glow: { r: 64, g: 196, b: 224 }
    },
    beam: {
      id: 'beam',
      maxHealth: 100,
      color: { r: 28, g: 168, b: 184 },    // wiki #1ca8b8 turquoise
      dark: { r: 42, g: 150, b: 156 },     // wiki #2a969c
      accent: { r: 47, g: 232, b: 234 },   // wiki #2fe8ea cyan glow
      glow: { r: 148, g: 245, b: 245 }     // wiki #94f5f5
    },
    spear: {
      id: 'spear',
      maxHealth: 100,
      color: { r: 105, g: 113, b: 130 },   // wiki #697182 metallic
      dark: { r: 58, g: 62, b: 74 },
      accent: { r: 148, g: 254, b: 3 },    // wiki #94fe03 neon-green stripe
      glow: { r: 216, g: 221, b: 230 }     // wiki #d8dde6 iron
    },
    reforge: {
      id: 'reforge',
      maxHealth: 100,
      color: { r: 236, g: 207, b: 33 },    // wiki #eccf21 yellow
      dark: { r: 109, g: 61, b: 40 },      // wiki #6d3d28 hammer handle
      accent: { r: 231, g: 235, b: 240 },  // wiki #e7ebf0 iron
      glow: { r: 255, g: 226, b: 90 }
    },
    /* ---------- five more balls from Ball VS Ball ---------- */
    chess: {
      id: 'chess',
      maxHealth: 100,
      color: { r: 24, g: 29, b: 38 },      // wiki #181d26
      dark: { r: 8, g: 10, b: 14 },
      accent: { r: 236, g: 239, b: 244 },  // wiki #eceff4
      glow: { r: 214, g: 222, b: 236 }
    },
    verity: {
      id: 'verity',
      maxHealth: 100,
      color: { r: 241, g: 243, b: 60 },    // wiki #f1f33c
      dark: { r: 21, g: 25, b: 35 },       // wiki #151923
      accent: { r: 255, g: 250, b: 170 },
      glow: { r: 255, g: 250, b: 140 }
    },
    cactus: {
      id: 'cactus',
      maxHealth: 100,
      color: { r: 151, g: 203, b: 70 },    // wiki #97cb46
      dark: { r: 62, g: 110, b: 36 },
      accent: { r: 238, g: 209, b: 40 },   // wiki #eed128 spines
      glow: { r: 230, g: 101, b: 241 }     // wiki #e665f1 flower
    },
    range: {
      id: 'range',
      maxHealth: 100,
      color: { r: 235, g: 207, b: 36 },    // wiki #ebcf24
      dark: { r: 160, g: 130, b: 40 },
      accent: { r: 242, g: 220, b: 88 },   // wiki #f2dc58
      glow: { r: 255, g: 232, b: 120 }
    },
    electroking: {
      id: 'electroking',
      maxHealth: 100,
      color: { r: 22, g: 46, b: 110 },     // dark blue, per the wiki overview
      dark: { r: 6, g: 14, b: 40 },
      accent: { r: 150, g: 240, b: 255 },  // bright light-blue lines
      glow: { r: 80, g: 210, b: 255 }
    },
    /* ---------- Acid, Big Spike, Cell, WDC and Hook, from Ball VS Ball ---------- */
    acid: {
      id: 'acid',
      maxHealth: 100,
      color: { r: 101, g: 203, b: 31 },
      dark: { r: 68, g: 160, b: 29 },
      accent: { r: 87, g: 178, b: 44 },
      glow: { r: 150, g: 235, b: 70 }
    },
    bigspike: {
      id: 'bigspike',
      maxHealth: 110,
      color: { r: 203, g: 209, b: 219 },
      dark: { r: 96, g: 104, b: 118 },
      accent: { r: 238, g: 242, b: 248 },
      glow: { r: 190, g: 200, b: 216 }
    },
    cell: {
      id: 'cell',
      maxHealth: 15,
      color: { r: 141, g: 214, b: 140 },
      dark: { r: 107, g: 179, b: 111 },
      accent: { r: 222, g: 236, b: 189 },
      glow: { r: 191, g: 224, b: 135 }
    },
    wdc: {
      id: 'wdc',
      maxHealth: 120,
      color: { r: 19, g: 73, b: 218 },
      dark: { r: 8, g: 32, b: 110 },
      accent: { r: 243, g: 245, b: 249 },
      glow: { r: 77, g: 119, b: 231 }
    },
    hook: {
      id: 'hook',
      maxHealth: 100,
      color: { r: 92, g: 104, b: 122 },
      dark: { r: 34, g: 40, b: 52 },
      accent: { r: 226, g: 206, b: 158 },
      glow: { r: 150, g: 168, b: 196 }
    },
    /* ---------- Gojo Ball ---------- */
    gojo: {
      id: 'gojo',
      maxHealth: 100,
      color: { r: 240, g: 214, b: 196 },   // pale skin
      dark: { r: 12, g: 12, b: 18 },       // black blindfold
      accent: { r: 176, g: 120, b: 255 },  // hollow purple
      glow: { r: 120, g: 190, b: 255 }     // infinity blue
    }
  };

  /* ---------- ball info: every ball is unlocked ---------- */

  const RARITY_COLORS = {
    COMMON: '#b8c0cc',
    RARE: '#3d9bff',
    EPIC: '#b45cff',
    LEGENDARY: '#ffc531',
    MYTHIC: '#ff4f8b'
  };

  // The most recently added batch shows a small NEW tag everywhere it appears
  const NEW_BALLS = new Set(ANIME_NEW_IDS);

  const BALL_INFO = {
    ...ANIME_INFO,
    classic:   { name: 'CLASSIC',      rarity: 'COMMON',    tag: 'BRAWLER',      desc: 'No gimmicks. Hits harder the faster it is moving when it connects.' },
    vampire:   { name: 'VAMPIRE',      rarity: 'RARE',      tag: 'SUSTAIN',      desc: 'Bites on contact and latches on, draining 12 HP over a second and healing itself the same amount.' },
    blade:     { name: 'BLADE',        rarity: 'RARE',      tag: 'MELEE',        desc: 'Spinning blades orbit it. It gains a new blade every 4 seconds, up to 5. Each slice deals 8.' },
    electric:  { name: 'ELECTRIC',     rarity: 'RARE',      tag: 'CONTROL',      desc: 'Contact shocks the enemy for 12 and freezes it in place for 1 second.' },
    burst:     { name: 'BURST',        rarity: 'RARE',      tag: 'BURST',        desc: 'Every few seconds it dashes: faster, tougher, and hits for 26. The ignition blasts nearby enemies away.' },
    machine:   { name: 'MACHINE GUN',  rarity: 'RARE',      tag: 'PROJECTILE',   desc: 'A turret barrel tracks the enemy and fires a steady stream of bullets that lead their target.' },
    zone:      { name: 'ZONE',         rarity: 'RARE',      tag: 'AREA DAMAGE',  desc: 'Leaves crimson zones behind it. Enemies inside a zone take rapid damage until they get out.' },
    laser:     { name: 'LASER',        rarity: 'EPIC',      tag: 'AREA CONTROL', desc: 'Every wall bounce links a laser to its last bounce point. Crossing a laser deals 4.' },
    poison:    { name: 'POISON SPIKE', rarity: 'EPIC',      tag: 'AREA CONTROL', desc: 'Wall bounces plant toxic thorns. Touching one deals 9 and poisons for 12 more.' },
    fibonacci: { name: 'FIBONACCI',    rarity: 'EPIC',      tag: 'SCALING',      desc: 'Each hit in a row deals more: 1, 2, 3, 5, 8, 13, 21, 34. The streak breaks after 5 seconds without a hit.' },
    bomb:      { name: 'BOMB',         rarity: 'EPIC',      tag: 'EXPLOSIVE',    desc: 'Drops a bomb every 1.25 seconds. Bombs blow up on contact or after 4 seconds for 15 damage and knockback.' },
    glass:     { name: 'GLASS',        rarity: 'LEGENDARY', tag: 'PROJECTILE',   desc: 'Every impact, with a wall or the enemy, sprays crystal shards that deal 7 each.' },
    shackles:  { name: 'SHACKLES',     rarity: 'MYTHIC',    tag: 'TRAPS',        desc: 'Lays shackle traps behind it. A trapped enemy is locked in place for a second and takes 14.' },
    spider:    { name: 'SPIDER',       rarity: 'RARE',      tag: 'WEBS',         desc: 'Every wall bounce spins a silk strand back to it. Touching a strand deals 3 and slows the enemy.' },
    snake:     { name: 'SNAKE',        rarity: 'RARE',      tag: 'MELEE',        desc: 'Its tail grows longer every couple of seconds. Hitting the tail deals 6 and knocks the enemy away.' },
    cannon:    { name: 'CANNON',       rarity: 'EPIC',      tag: 'TURRETS',      desc: 'Wall bounces build cannon turrets, up to 3. Each turret fires cannonballs at the enemy for 7.' },
    dice:      { name: 'DICE',         rarity: 'EPIC',      tag: 'HAZARDS',      desc: 'Drops dice that deal double the number rolled, from 2 to 12. A die rerolls every time it hits.' },
    hive:      { name: 'HIVE',         rarity: 'LEGENDARY', tag: 'HOMING',       desc: 'Releases bees that chase the enemy around the arena. Each sting deals 3 and poisons for 6 more.' },
    thief:     { name: 'THIEF',        rarity: 'RARE',      tag: 'PROJECTILE',   desc: 'Throws knives at the enemy. Each knife deals 4, and it throws faster the lower its HP gets.' },
    axe:       { name: 'AXE',          rarity: 'RARE',      tag: 'MELEE',        desc: 'A heavy axe orbits it and chops for 10. The axe spins faster the lower its HP gets.' },
    charge:    { name: 'CHARGE',       rarity: 'RARE',      tag: 'BURST',        desc: 'The longer it goes without a hit, the harder its next hit lands: from 4 up to 28 at full charge.' },
    frost:     { name: 'FROST',        rarity: 'EPIC',      tag: 'CONTROL',      desc: 'Leaves a trail of frost behind it. Touching frost deals 3 and freezes the enemy for half a second.' },
    apple:     { name: 'APPLE',        rarity: 'EPIC',      tag: 'SUSTAIN',      desc: 'Throws apples that bounce off walls. Each apple that lands deals 8 and heals it for 5.' },
    harpoon:   { name: 'HARPOON',      rarity: 'LEGENDARY', tag: 'GRAPPLE',      desc: 'Every 2.4 seconds it throws a harpoon that bounces off the walls until it hits the enemy, then drags them back along its path for 2 damage every 0.12 seconds. Contact deals no damage.' },
    beam:      { name: 'BEAM',         rarity: 'LEGENDARY', tag: 'TRACKING BEAM', desc: 'Charges for 2.5 seconds, then fires a tracking beam for 2 seconds that deals 3 per tick, up to 50 total. It turns very slowly while firing. Contact deals no damage.' },
    spear:     { name: 'SPEAR',        rarity: 'EPIC',      tag: 'SPEED',        desc: 'An iron spear is fixed to its side. It keeps gaining speed over time, and anything hit by the spear takes 10 and is knocked back. Contact deals no damage.' },
    reforge:   { name: 'REFORGE',      rarity: 'RARE',      tag: 'SUMMON',       desc: 'Its first wall touch spawns a Blade that deals 3 on contact. Every time the Blade touches Reforge it is reforged: it grows and gains 2 damage. Contact deals no damage.' },
    chess:      { name: 'CHESS',        rarity: 'LEGENDARY', tag: 'DASH',         desc: 'Every 5 seconds it turns invincible and glides to the center. A red line shows its pattern (Rook, Bishop or Knight), then it dashes along it and hits any enemy in the path for 7.' },
    verity:     { name: 'VERITY',       rarity: 'LEGENDARY', tag: 'TRANSFORM',    desc: 'Starts as a happy smiley. Each hit it takes has about a 10% chance to advance it to Displeased, then Monster. Its contact damage rises from 5 to 10 to 40.' },
    cactus:     { name: 'CACTUS',       rarity: 'EPIC',      tag: 'HAZARDS',      desc: 'Throws 3 cacti 3 seconds into the round, then a new set every 4 seconds. Cacti stand on the floor for 5 seconds and hit enemies for 6 with a knockback.' },
    range:      { name: 'RANGE',        rarity: 'RARE',      tag: 'AURA',         desc: 'A yellow damage aura surrounds it. An enemy inside takes 3 every 0.15 seconds, and the aura grows a little each time it hurts.' },
    electroking:{ name: 'ELECTRO KING', rarity: 'RARE',      tag: 'GRID',         desc: 'Each wall hit plants a shock node. Nodes link into a grid of electric lines, and an enemy that touches a line takes 2 damage.' },
    acid:       { name: 'ACID',         rarity: 'RARE',      tag: 'POISON',       desc: 'Every 2 seconds it throws an acid puddle that stays 12 seconds. An enemy inside is slowed and poisoned for 2 every 0.6 seconds, 6 ticks. Puddles stack.' },
    bigspike:   { name: 'BIG SPIKE',    rarity: 'RARE',      tag: 'WALL SPIKES',  desc: 'Every wall touch leaves a permanent spike. An enemy that hits a spike takes 6 and is pushed off. It has 110 health and is slightly bigger.' },
    cell:       { name: 'CELL',         rarity: 'RARE',      tag: 'MITOSIS',      desc: 'Only 15 health. It grows to maturity in 3 seconds, and if it dies while mature it divides into three small cells instead. Contact deals 5.' },
    wdc:        { name: 'WDC',          rarity: 'EPIC',      tag: 'GRID',         desc: 'After 3 seconds it lays a 3x3 grid over the arena for 6 seconds. Each cell holds a number from 1 to 100, and that number is its contact damage while it sits there.' },
    hook:       { name: 'HOOK',         rarity: 'RARE',      tag: 'FLING',        desc: 'Every 2.6 seconds it throws a hook that snags the enemy for 3 and flings it spinning into the nearest wall.' },
    gojo:       { name: 'GOJO',         rarity: 'MYTHIC',    tag: 'LIMITLESS',    desc: 'Casts Blue, a slow orb that drags the enemy (and Red) into it, then Red, a fast orb that blasts for 10. If Red meets Blue they fuse into Hollow Purple: 28 damage to the enemy anywhere on the field.' }
  };

  const savedState = (() => {
    try { return JSON.parse(localStorage.getItem('bvb-save') || 'null') || {}; } catch (_) { return {}; }
  })();
  const savedName = side => {
    const n = savedState.names && savedState.names[side];
    return typeof n === 'string' && n.trim() ? n.trim().toUpperCase().slice(0, 10) : null;
  };
  let mode = savedState.mode === '2p' ? '2p' : '1p';
  let gameMode = savedState.gameMode === 'battle' ? 'battle' : 'classic';

  // Battle mode state: two teams of five, which slot is out, whose turn it is to pick
  const battle = {
    on: false, over: false, winner: null,
    teams: { red: [], blue: [] },
    active: { red: -1, blue: -1 },
    fresh: { red: false, blue: false },
    queue: [], picking: null, hover: -1, focus: 0,
    botT: 0, botPick: -1, pickT: 0, anim: 0, turn: 0,
    koLines: [], koT: 0, lastLost: { red: null, blue: null },
    banner: '', bannerSub: '', bannerT: 0, overT: 0
  };
  const names = {
    red: savedName('red') || 'RED',
    blue: savedName('blue') || 'BLUE'
  };
  let nameFocus = 0;

  function persist() {
    try { localStorage.setItem('bvb-save', JSON.stringify({ names, mode, gameMode })); } catch (_) {}
  }

  function getPalette(typeId, side) {
    const def = TYPES[typeId];
    if (typeId === 'classic') {
      const p = side === 'red' ? def.player : def.bot;
      return { color: p.color, dark: p.dark, accent: p.accent, glow: p.color };
    }
    return { color: def.color, dark: def.dark, accent: def.accent, glow: def.glow };
  }

  /* ---------- subtle Web Audio synthesizer ---------- */

  let audioCtx = null;
  function ensureAudio() {
    try {
      if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) audioCtx = new AC();
      }
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    } catch (_) {}
  }

  function tone(freq, freqEnd, dur, type, vol, delay) {
    if (!audioCtx || audioCtx.state !== 'running') return;
    try {
      const t0 = audioCtx.currentTime + (delay || 0);
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(Math.max(40, freq), t0);
      if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), t0 + dur);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch (_) {}
  }

  const sfx = {
    select(i) { tone(360 + i * 90, 560 + i * 110, 0.11, 'triangle', 0.06); },
    launch() { tone(190, 440, 0.16, 'sine', 0.07); tone(310, 140, 0.14, 'triangle', 0.04, 0.02); },
    wall() { tone(155, 85, 0.07, 'sine', 0.045); },
    clash(power) {
      const p = clamp(power, 0.4, 1.4);
      tone(220 * p, 95, 0.12, 'triangle', 0.09);
      tone(580 * p, 240, 0.07, 'sine', 0.05);
    },
    bite() { tone(260, 120, 0.12, 'sawtooth', 0.055); tone(420, 580, 0.11, 'sine', 0.045, 0.03); },
    drain() { tone(330, 520, 0.12, 'sine', 0.05); },
    slash() { tone(980, 320, 0.11, 'sawtooth', 0.055); tone(1450, 650, 0.09, 'triangle', 0.045); },
    forge() { tone(520, 1040, 0.16, 'triangle', 0.055); },
    laserLock() { tone(440, 880, 0.11, 'sine', 0.04); },
    laserZap() { tone(1120, 290, 0.11, 'sawtooth', 0.05); },
    ko() {
      tone(280, 62, 0.42, 'sawtooth', 0.085);
      tone(420, 140, 0.36, 'triangle', 0.065, 0.04);
      tone(190, 55, 0.5, 'sine', 0.08, 0.08);
    },
    shatter() { tone(1500, 520, 0.12, 'triangle', 0.04); tone(2400, 980, 0.09, 'sine', 0.03); },
    shock() { tone(920, 130, 0.16, 'sawtooth', 0.045); tone(1480, 340, 0.12, 'triangle', 0.035); },
    dash() { tone(210, 640, 0.18, 'sawtooth', 0.04); tone(480, 980, 0.14, 'sine', 0.03); },
    poison() { tone(240, 150, 0.16, 'sine', 0.04); tone(330, 190, 0.18, 'triangle', 0.028, 0.04); },
    gun() { tone(1250, 420, 0.05, 'square', 0.016); },
    boom() { tone(150, 42, 0.38, 'sawtooth', 0.085); tone(95, 34, 0.5, 'sine', 0.1, 0.02); },
    bombDrop() { tone(320, 240, 0.06, 'triangle', 0.03); },
    trapSet() { tone(560, 420, 0.07, 'triangle', 0.03); },
    trapSnap() { tone(230, 115, 0.14, 'square', 0.04); tone(900, 450, 0.1, 'triangle', 0.04, 0.02); },
    zone() { tone(170, 250, 0.22, 'sine', 0.035); },
    fib(step) { const f = 330 * Math.pow(1.122, step); tone(f, f * 1.5, 0.12, 'triangle', 0.045); },
    web() { tone(1400, 900, 0.07, 'sine', 0.025); },
    buzz() { tone(220, 270, 0.2, 'sawtooth', 0.016); },
    sting() { tone(900, 480, 0.06, 'triangle', 0.03); },
    cannon() { tone(120, 48, 0.3, 'sawtooth', 0.065); tone(80, 38, 0.36, 'sine', 0.08, 0.02); },
    cannonBuild() { tone(300, 620, 0.12, 'square', 0.022); },
    hiss() { tone(2400, 1700, 0.14, 'sawtooth', 0.014); },
    diceRoll() { tone(700, 900, 0.04, 'triangle', 0.03); tone(820, 600, 0.04, 'triangle', 0.03, 0.06); },
    dice(v) { const f = 300 + v * 70; tone(f, f * 1.4, 0.14, 'triangle', 0.05); },
    knife() { tone(1600, 700, 0.07, 'triangle', 0.026); },
    knifeHit() { tone(1100, 420, 0.06, 'square', 0.022); },
    thunk() { tone(260, 140, 0.06, 'triangle', 0.03); },
    chop() { tone(520, 160, 0.13, 'sawtooth', 0.05); tone(180, 70, 0.16, 'sine', 0.06, 0.02); },
    chargeFull() { tone(600, 1200, 0.18, 'sine', 0.04); tone(900, 1800, 0.14, 'triangle', 0.025, 0.06); },
    chargeHit(c) { tone(200 + c * 300, 60, 0.3, 'sawtooth', 0.04 + c * 0.05); },
    frost() { tone(1800, 2600, 0.12, 'sine', 0.03); tone(2400, 1400, 0.16, 'triangle', 0.025, 0.03); },
    appleThrow() { tone(380, 520, 0.08, 'triangle', 0.025); },
    appleHit() { tone(240, 120, 0.12, 'sine', 0.06); tone(700, 300, 0.07, 'triangle', 0.03); },
    invOpen() { tone(420, 620, 0.09, 'triangle', 0.035); },
    invClose() { tone(560, 380, 0.08, 'triangle', 0.03); }
  };

  /* ---------- state ---------- */

  let phase = 'name'; // 'name' | 'aim' | 'play' | 'roundover'
  let sinceLaunch = 0;
  let clock = 0;
  let resetRemaining = 0;
  let entrance = 0;
  let impactCooldown = 0;
  let hitStop = 0;
  let activePointer = null;
  let matchOver = false;
  let latch = null;
  const shake = { mag: 0, x: 0, y: 0 };
  let hoverBall = null;
  let popupKey = '';
  let popupAnim = 0;
  let popupHold = 0;
  const inv = { open: false, anim: 0, side: 'red', scroll: 0, target: 0, filter: 'ALL', hover: -1, hoverUi: null, drag: null };
  const recent = { red: null, blue: null };

  // Every ability counter lives here, so a ball that switches type can never
  // inherit a missing key and start adding to undefined
  function freshFx() {
    return {
      chessDash: 0, cactus: 0, aura: 0, grid: 0, transform: 0, thrown: 0, nodes: 0,
      acid: 0, spikes: 0, divides: 0, orbs: 0, wdcHits: 0, hooks: 0,
      gojoBlue: 0, gojoRed: 0, purple: 0, gojoVoid: 0
    };
  }

  // Big Spike is slightly larger than a normal ball; Cell grows as it matures
  function radiusFor(b) {
    const base = b.baseR || 24;
    if (b.type === 'bigspike') return base * 1.08;
    if (b.type === 'cell') return base * (b.cellScale || 0.72);
    return base;
  }

  function createBall(side, typeId, defaultAngle) {
    const pal = getPalette(typeId, side);
    const maxHealth = TYPES[typeId].maxHealth;
    return {
      side,
      type: typeId,
      color: pal.color,
      dark: pal.dark,
      accent: pal.accent,
      glow: pal.glow,
      x: 0, y: 0, vx: 0, vy: 0, r: 30,
      angle: defaultAngle,
      facing: defaultAngle,
      lives: MAX_LIVES,
      maxHealth,
      health: maxHealth,
      shownHealth: maxHealth,
      alive: true,
      hit: 0,
      hitAngle: 0,
      healPulse: 0,
      morphPulse: 0,
      trail: [],
      // Vampire
      latchCooldown: 0,
      // Blade
      bladeCount: 1,
      bladeTimer: 0,
      bladeAngle: defaultAngle,
      bladeHits: [0, 0, 0, 0, 0],
      // Laser
      laserAnchor: null,
      lasers: [],
      tetherHitLock: false,
      tetherLockTimer: 0,
      // Glass
      shardCooldown: 0,
      // Electric
      shockCooldown: 0,
      freezeTimer: 0,
      // Burst
      dashTimer: 0,
      dashActive: false,
      // Poison Spike
      poisonTicks: 0,
      poisonTickTimer: 0,
      poisonColor: null,
      // Blade balance
      bladeGlobalCooldown: 0,
      // Shackles
      trapTimer: 0,
      shackledTimer: 0,
      // Machine Gun
      gunTimer: 0,
      gunAngle: defaultAngle,
      gunKick: 0,
      // Fibonacci
      fibStep: 0,
      fibIdle: 0,
      // Bomb
      bombTimer: 0,
      // Zone
      zoneTimer: 0,
      // Spider webs slow whoever they catch
      slowTimer: 0,
      // Snake
      tail: [],
      snakeLen: 5,
      snakeTimer: 0,
      tailHitCd: 0,
      // Cannon
      cannonCd: 0,
      // Dice
      diceTimer: 0,
      // Hive
      hiveTimer: 0,
      // Thief
      knifeTimer: 0,
      // Axe
      axeAngle: defaultAngle,
      axeHitCd: 0,
      // Charge
      chargeT: 0,
      // Frost
      frostTimer: 0,
      frostCd: 0,
      iceTimer: 0,
      // Apple
      appleTimer: 0,
      // Harpoon
      harpoonCd: 0.8,
      harpoonDrag: null,
      // Beam
      beamState: 'delay',
      beamT: 0,
      beamAngle: defaultAngle,
      beamTick: 0,
      beamDealt: 0,
      // Spear
      spearBoost: 0,
      spearHitCd: 0,
      // Reforge
      reforgeSpawned: false,
      // Chess
      chessCd: 5.0,
      chessPhase: 'idle',
      chessT: 0,
      chessPat: 'rook',
      chessFrom: null,
      chessPath: [],
      chessLen: 0,
      chessDist: 0,
      chessHitCd: 0,
      // Verity
      verityStage: 1,
      verityFlash: 0,
      // Cactus
      cactusCd: 3.0,
      // Range
      rangeR: 30,
      rangeT: 0,
      rangeFlash: 0,
      // Electro King
      nodeFlash: 0,
      gridTick: 0,
      // Acid
      acidCd: 2.0,
      acidStacks: [],
      // Big Spike
      spikeCd: 0,
      // Cell
      cellScale: 0.72,
      cellT: 0,
      cellMature: false,
      cellSplits: 2,
      baseR: 0,
      // WDC
      wdcT: 0,
      wdcOn: false,
      wdcAge: 0,
      wdcCells: [],
      wdcLast: 0,
      // Hook
      hookCd: 2.6,
      // Gojo
      gojoCd: 1.4,
      gojoRedT: -1,
      // Domain Expansion: Unlimited Void
      voidCd: 6.5, voidPhase: 'idle', voidT: 0, voidX: 0, voidY: 0, voidR: 0, voidTick: 0,
      anime: createAnimeState(typeId),
      // Counters, used by the test handle
      fx: freshFx()
    };
  }

  const red = createBall('red', 'classic', 0);
  const blue = createBall('blue', 'blade', Math.PI + 0.14);
  const balls = [red, blue];
  const animeMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const animeRivals = createAnimeRivals({
    arena, balls, foeOf, applyDamage, spawnSparks, spawnPopup, sfx,
    isPlaying: () => phase === 'play',
    canPush: b => !latch && b.freezeTimer <= 0,
    prefersReducedMotion: () => animeMotion?.matches ?? false,
    addShake: amount => { if (!animeMotion?.matches) addShake(amount); },
  });

  const damageNumbers = [];
  const sparks = [];
  const shards = [];
  const impactRings = [];
  const slashFx = [];
  const siphonMotes = [];
  const wallPulses = [];
  const heartFx = [];
  const pickerScales = {};
  const glassShards = [];
  const shockFx = [];
  const poisonPatches = [];
  const burstFx = [];
  const traps = [];
  const bullets = [];
  const bombs = [];
  const zones = [];
  const explosions = [];
  const webs = [];
  const bees = [];
  const turrets = [];
  const cannonballs = [];
  const dice = [];
  const knives = [];
  const apples = [];
  const frostPatches = [];
  const axeSlashes = [];
  const harpoonShots = [];
  const reforgeBlades = [];
  const cacti = [];
  const electroNodes = [];
  const acidPuddles = [];
  const bigSpikes = [];
  const cellOrbs = [];
  const hookShots = [];
  const gojoOrbs = [];
  const purpleFx = [];
  let gojoFlash = 0;
  let voidFlash = 0;

  let laserCanvas = null;
  let laserCtx = null;
  let laserCacheDirty = true;
  function invalidateLaserCache() { laserCacheDirty = true; }

  const bot = { target: Math.PI + 0.14, timer: 0, lastType: 'blade' };
  const keys = { left: false, right: false };
  const p2 = { left: false, right: false };

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const minDim = () => Math.min(W, H);
  const speedScale = () => clamp(Math.min(arena.w, arena.h) / 560, 0.58, 1.25);

  const rgba = (o, a) => `rgba(${o.r | 0},${o.g | 0},${o.b | 0},${a})`;
  const lighten = (o, n) => ({ r: Math.min(255, o.r + n), g: Math.min(255, o.g + n), b: Math.min(255, o.b + n) });
  const darken = (o, f) => ({ r: o.r * f, g: o.g * f, b: o.b * f });

  function applyBallType(b, typeId, withPulse) {
    const pal = getPalette(typeId, b.side);
    const def = TYPES[typeId];
    b.type = typeId;
    b.color = pal.color;
    b.dark = pal.dark;
    b.accent = pal.accent;
    b.glow = pal.glow;
    b.maxHealth = def.maxHealth;
    b.health = def.maxHealth;
    b.shownHealth = def.maxHealth;
    b.alive = true;
    b.latchCooldown = 0;
    b.bladeCount = 1;
    b.bladeTimer = 0;
    b.bladeAngle = b.angle;
    b.bladeHits.fill(0);
    b.laserAnchor = null;
    b.lasers.length = 0;
    b.tetherHitLock = false;
    b.tetherLockTimer = 0;
    b.trail.length = 0;
    b.shardCooldown = 0;
    b.shockCooldown = 0;
    b.freezeTimer = 0;
    b.dashTimer = 0;
    b.dashActive = false;
    b.poisonTicks = 0;
    b.poisonTickTimer = 0;
    b.poisonColor = null;
    b.bladeGlobalCooldown = 0;
    b.trapTimer = 0;
    b.shackledTimer = 0;
    b.gunTimer = 0;
    b.gunAngle = b.angle;
    b.gunKick = 0;
    b.fibStep = 0;
    b.fibIdle = 0;
    b.bombTimer = 0;
    b.zoneTimer = 0;
    b.slowTimer = 0;
    b.tail.length = 0;
    b.snakeLen = 5;
    b.snakeTimer = 0;
    b.tailHitCd = 0;
    b.cannonCd = 0;
    b.diceTimer = 0;
    b.hiveTimer = 0;
    b.knifeTimer = 0;
    b.axeAngle = b.angle;
    // Harpoon ability fields
    b.harpoonCd = 0.8;
    b.harpoonDrag = null;
    b.axeHitCd = 0;
    b.chargeT = 0;
    b.frostTimer = 0;
    b.frostCd = 0;
    b.iceTimer = 0;
    b.appleTimer = 0;
    b.harpoonCd = 0.8;
    b.harpoonDrag = null;
    b.beamState = 'delay';
    b.beamT = 0;
    b.beamAngle = b.angle;
    b.beamTick = 0;
    b.beamDealt = 0;
    b.spearBoost = 0;
    b.spearHitCd = 0;
    b.reforgeSpawned = false;
    b.chessCd = 5.0;
    b.chessPhase = 'idle';
    b.chessT = 0;
    b.chessPat = 'rook';
    b.chessFrom = null;
    b.chessPath = [];
    b.chessLen = 0;
    b.chessDist = 0;
    b.chessHitCd = 0;
    b.verityStage = 1;
    b.verityFlash = 0;
    b.cactusCd = 3.0;
    b.rangeR = b.r * 1.9;
    b.rangeT = 0;
    b.rangeFlash = 0;
    b.nodeFlash = 0;
    b.gridTick = 0;
    b.acidCd = 2.0;
    b.acidStacks.length = 0;
    b.spikeCd = 0;
    b.cellScale = 0.72;
    b.cellT = 0;
    b.cellMature = false;
    b.cellSplits = 2;
    b.wdcT = 0;
    b.wdcOn = false;
    b.wdcAge = 0;
    b.wdcCells = [];
    b.wdcLast = 0;
    b.hookCd = 2.6;
    b.gojoCd = 1.4;
    b.gojoRedT = -1;
    b.voidCd = 6.5; b.voidPhase = 'idle'; b.voidT = 0; b.voidX = 0; b.voidY = 0; b.voidR = 0; b.voidTick = 0;
    b.anime = createAnimeState(typeId);
    b.r = radiusFor(b);
    b.fx = freshFx();
    knives.length = 0;
    harpoonShots.length = 0;
    reforgeBlades.length = 0;
    cacti.length = 0;
    electroNodes.length = 0;
    acidPuddles.length = 0;
    bigSpikes.length = 0;
    cellOrbs.length = 0;
    hookShots.length = 0;
    gojoOrbs.length = 0;
    purpleFx.length = 0;
    gojoFlash = 0;
    voidFlash = 0;
    animeRivals.reset();
    apples.length = 0;
    frostPatches.length = 0;
    axeSlashes.length = 0;
    webs.length = 0;
    bees.length = 0;
    turrets.length = 0;
    cannonballs.length = 0;
    dice.length = 0;
    poisonPatches.length = 0;
    glassShards.length = 0;
    shockFx.length = 0;
    burstFx.length = 0;
    traps.length = 0;
    bullets.length = 0;
    bombs.length = 0;
    zones.length = 0;
    explosions.length = 0;
    invalidateLaserCache();
    if (withPulse) {
      b.morphPulse = 1;
      impactRings.push({ x: b.x, y: b.y, age: 0, life: 0.42, radius: b.r * 1.45, color: b.accent });
    }
  }

  function pickBotType(avoidType) {
    const pool = BALL_ORDER.filter(t => t !== avoidType);
    const fresh = pool.filter(t => t !== bot.lastType);
    const list = fresh.length ? fresh : pool;
    // Slightly favor the 3 special balls while still mixing in classic occasionally
    const weighted = [];
    for (const t of list) {
      weighted.push(t);
      if (t !== 'classic') weighted.push(t);
    }
    const chosen = weighted[Math.floor(Math.random() * weighted.length)];
    bot.lastType = chosen;
    return chosen;
  }

  /* ---------- responsive layout ---------- */

  function computeLayout(prevArena) {
    // Much larger court: thin margins, modest HUD bands, wide arena proportions
    const padX = clamp(W * 0.018, 7, 22);
    const topSpace = clamp(minDim() * 0.092, 48, 72);
    const bottomSpace = clamp(minDim() * 0.1, 46, 72);

    const availW = Math.max(180, W - padX * 2);
    const availH = Math.max(180, H - topSpace - bottomSpace);

    let aw = availW;
    let ah = availH;
    const maxAspect = 1.78;
    if (aw / ah > maxAspect) aw = ah * maxAspect;
    if (ah / aw > 1.5) ah = aw * 1.5;

    arena.w = aw;
    arena.h = ah;
    arena.x = (W - aw) * 0.5;
    arena.y = topSpace + (availH - ah) * 0.5;
    arena.r = clamp(Math.min(aw, ah) * 0.042, 14, 26);

    const r = clamp(Math.min(aw, ah) * 0.086, 18, 42);
    red.baseR = r;
    blue.baseR = r;
    red.r = radiusFor(red);
    blue.r = radiusFor(blue);

    if ((phase === 'aim' || phase === 'name') && !battle.on) {
      red.x = arena.x + arena.w * 0.25;
      red.y = arena.y + arena.h * 0.5;
      blue.x = arena.x + arena.w * 0.75;
      blue.y = arena.y + arena.h * 0.5;
    } else if (prevArena && prevArena.w > 0 && prevArena.h > 0) {
      const mapX = x => arena.x + ((x - prevArena.x) / prevArena.w) * arena.w;
      const mapY = y => arena.y + ((y - prevArena.y) / prevArena.h) * arena.h;
      for (const b of balls) {
        b.x = clamp(mapX(b.x), arena.x + b.r, arena.x + arena.w - b.r);
        b.y = clamp(mapY(b.y), arena.y + b.r, arena.y + arena.h - b.r);
        if (b.laserAnchor) {
          b.laserAnchor.x = mapX(b.laserAnchor.x);
          b.laserAnchor.y = mapY(b.laserAnchor.y);
        }
        for (const l of b.lasers) {
          l.x1 = mapX(l.x1); l.y1 = mapY(l.y1);
          l.x2 = mapX(l.x2); l.y2 = mapY(l.y2);
        }
      }
      remapHazards(mapX, mapY);
    }

    // Bottom quick row: as many balls as fit comfortably, plus an inventory button that lists every ball
    const py = clamp(arena.y + arena.h + (H - (arena.y + arena.h)) * 0.52,
      arena.y + arena.h + 16, H - 16);
    picker.items = [];
    picker.invBtns = [];
    const btnS = clamp(bottomSpace * 0.74, 36, 48);
    const minGap = 44;
    const buildRow = (side, x0, x1) => {
      const usable = x1 - x0 - btnS - 16;
      let gap = Math.min(bottomSpace * 0.8, usable / BALL_ORDER.length);
      let list;
      if (gap >= minGap) {
        list = BALL_ORDER.slice();
      } else {
        const cap = Math.max(1, Math.floor(usable / minGap));
        gap = Math.min(bottomSpace * 0.8, usable / cap);
        list = quickList(side, cap);
      }
      const slotR = clamp(gap * 0.34, 10, 22);
      const n = list.length;
      const totalW = (n - 1) * gap + slotR * 2.4 + 12 + btnS;
      const startX = (x0 + x1) / 2 - totalW / 2 + slotR;
      list.forEach((id, i) => {
        picker.items.push({ id, index: BALL_ORDER.indexOf(id), side, x: startX + i * gap, y: py, r: slotR });
      });
      const lastX = startX + (n - 1) * gap;
      picker.invBtns.push({ side, x: lastX + slotR * 1.4 + 12, y: py - btnS / 2, w: btnS, h: btnS });
    };
    if (mode === '2p') {
      buildRow('red', 12, W * 0.5 - 12);
      buildRow('blue', W * 0.5 + 12, W - 12);
    } else {
      buildRow('red', 18, W - 18);
    }
  }

  function resize() {
    const prev = { x: arena.x, y: arena.y, w: arena.w, h: arena.h };
    // Big screens cost a lot of fill rate, so they render at a lower backing scale
    const cssPx = Math.max(1, window.innerWidth || 1) * Math.max(1, window.innerHeight || 1);
    dpr = Math.min(window.devicePixelRatio || 1, cssPx > 1200000 ? 1.25 : 1.75);
    W = Math.max(1, window.innerWidth);
    H = Math.max(1, window.innerHeight);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    computeLayout(prev.w > 1 ? prev : null);
    invalidateLaserCache();
    invalidateSprites();
  }
  window.addEventListener('resize', resize);
  resize();

  /* ---------- round & match management ---------- */

  function resetRound() {
    phase = 'aim';
    sinceLaunch = 0;
    resetRemaining = 0;
    impactCooldown = 0;
    hitStop = 0;
    entrance = 0;
    activePointer = null;
    latch = null;
    keys.left = false;
    keys.right = false;

    red.angle = 0;
    red.facing = 0;
    blue.angle = Math.PI + (Math.random() * 2 - 1) * 0.28;
    blue.facing = blue.angle;
    bot.target = blue.angle;
    bot.timer = 0.25;

    applyBallType(red, red.type, false);
    if (mode === '1p') applyBallType(blue, pickBotType(red.type), false);
    else applyBallType(blue, blue.type, false);

    for (const b of balls) {
      b.vx = 0;
      b.vy = 0;
      b.hit = 0;
      b.healPulse = 0;
      b.morphPulse = 0;
    }

    damageNumbers.length = 0;
    sparks.length = 0;
    shards.length = 0;
    impactRings.length = 0;
    slashFx.length = 0;
    siphonMotes.length = 0;
    wallPulses.length = 0;
    canvas.classList.remove('playing');
    computeLayout();
  }

  function loseLife(ball) {
    if (ball.lives <= 0) return;
    ball.lives -= 1;
    heartFx.push({ ball, type: ball.type, index: ball.lives, age: 0, life: 0.95 });
    if (ball.lives <= 0) matchOver = true;
  }

  function resetMatch() {
    red.lives = MAX_LIVES;
    blue.lives = MAX_LIVES;
    matchOver = false;
    heartFx.length = 0;
    resetRound();
  }

  function selectPlayerBall(side, typeId) {
    if (phase !== 'aim') return;
    const ball = side === 'red' ? red : blue;
    if (ball.type === typeId) return;
    ensureAudio();
    sfx.select(BALL_ORDER.indexOf(typeId));
    applyBallType(ball, typeId, true);
    touchRecent(side, typeId);
    computeLayout();
    // In 1P the bot re-rolls if it was using the same ball; mirror matches are allowed in 2P
    if (side === 'red' && mode === '1p' && blue.type === typeId) {
      applyBallType(blue, pickBotType(typeId), true);
    }
  }

  /* ---------- input ---------- */

  function hitTestPicker(px, py) {
    if (phase !== 'aim' || inv.open || battle.on) return -1;
    for (let i = 0; i < picker.items.length; i++) {
      const it = picker.items[i];
      if (Math.hypot(px - it.x, py - it.y) <= it.r * 1.42) return i;
    }
    return -1;
  }

  function aimAt(px, py) {
    if (phase !== 'aim' || inv.open) return;
    const dx = px - red.x, dy = py - red.y;
    if (Math.hypot(dx, dy) < 6) return;
    red.angle = Math.atan2(dy, dx);
    red.facing = red.angle;
  }

  function shoot() {
    if (phase !== 'aim' || inv.open) return;
    ensureAudio();
    sfx.launch();
    for (const b of balls) {
      b.vx = Math.cos(b.angle) * LAUNCH_SPEED;
      b.vy = Math.sin(b.angle) * LAUNCH_SPEED;
      b.facing = b.angle;
      b.bladeAngle = b.angle;
    }
    phase = 'play';
    sinceLaunch = 0;
    picker.hover = -1;
    canvas.classList.remove('hover-pick');
    canvas.classList.add('playing');
  }

  canvas.addEventListener('pointermove', e => {
    if (inv.open) {
      invPointerMove(e);
      return;
    }
    if (battle.on && (phase === 'bpick' || phase === 'bover')) {
      battle.hover = battleHit(e.clientX, e.clientY);
      if (battle.hover >= 0) battle.focus = battle.hover;
      canvas.classList.toggle('hover-pick', battle.hover >= 0);
      return;
    }
    const hit = hitTestPicker(e.clientX, e.clientY);
    picker.hover = hit;
    picker.invHover = hitInvButton(e.clientX, e.clientY);
    // Resting the mouse on a ball in the arena also shows its info card
    hoverBall = null;
    if (hit < 0 && !picker.invHover && phase === 'aim' && activePointer === null && e.pointerType === 'mouse') {
      for (const b of balls) {
        if (b.alive && Math.hypot(e.clientX - b.x, e.clientY - b.y) <= b.r * 1.05) hoverBall = b;
      }
    }
    const overUi = hit >= 0 || !!picker.invHover;
    canvas.classList.toggle('hover-pick', phase === 'aim' && overUi);
    if (overUi && activePointer === null) return;
    if (e.pointerType === 'mouse' || e.pointerId === activePointer) aimAt(e.clientX, e.clientY);
  });

  canvas.addEventListener('pointerleave', () => {
    picker.hover = -1;
    picker.invHover = null;
    hoverBall = null;
    inv.hover = -1;
  });

  canvas.addEventListener('wheel', e => {
    if (!inv.open) return;
    e.preventDefault();
    const L = invLayout();
    inv.target = clamp(inv.target + e.deltaY, 0, L.max);
  }, { passive: false });

  canvas.addEventListener('pointerdown', e => {
    ensureAudio();
    if (phase === 'name') {
      nameClick(e.clientX, e.clientY);
      return;
    }
    if (battle.on && (phase === 'bpick' || phase === 'bover')) {
      battlePointer(e.clientX, e.clientY);
      return;
    }
    if (inv.open) {
      invPointerDown(e);
      return;
    }
    if (phase !== 'aim' || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const invSide = hitInvButton(e.clientX, e.clientY);
    if (invSide) {
      openInventory(invSide);
      return;
    }
    const hit = hitTestPicker(e.clientX, e.clientY);
    if (hit >= 0) {
      const it = picker.items[hit];
      selectPlayerBall(it.side, it.id);
      picker.hover = hit; // keeps the info card up on touch screens too
      return;
    }
    activePointer = e.pointerId;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    aimAt(e.clientX, e.clientY);
  });

  canvas.addEventListener('pointerup', e => {
    if (inv.drag && e.pointerId === inv.drag.id) {
      invPointerUp(e);
      return;
    }
    if (e.pointerId !== activePointer) return;
    activePointer = null;
    aimAt(e.clientX, e.clientY);
    shoot();
  });

  canvas.addEventListener('pointercancel', e => {
    if (e.pointerId === activePointer) activePointer = null;
  });
  canvas.addEventListener('lostpointercapture', e => {
    if (e.pointerId === activePointer) activePointer = null;
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  window.addEventListener('keydown', e => {
    const k = e.key;
    if (phase === 'name') {
      nameKey(e);
      return;
    }
    if (battle.on && battleKey(e)) return;

    if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown' || k === ' ') e.preventDefault();

    if (inv.open) {
      invKey(e);
      return;
    }
    if (phase === 'aim' && (k === 'i' || k === 'I') && !e.repeat) {
      openInventory('red');
      return;
    }

    if (phase === 'aim') {
      // P1 rotates with A/D (arrow keys also work in 1P mode)
      if (k === 'a' || k === 'A' || (mode === '1p' && k === 'ArrowLeft')) keys.left = true;
      if (k === 'd' || k === 'D' || (mode === '1p' && k === 'ArrowRight')) keys.right = true;
      // P2 rotates with the arrow keys in local 2P mode
      if (mode === '2p') {
        if (k === 'ArrowLeft') p2.left = true;
        if (k === 'ArrowRight') p2.right = true;
      }
      // First shot launches both balls
      if (k === 'w' || k === 'W' || k === ' ' || k === 'Enter') { if (!e.repeat) shoot(); }
      if (mode === '2p' && k === 'ArrowUp') { if (!e.repeat) shoot(); }
      // P1 ball pick from the row
      const num = parseInt(k, 10);
      if (num >= 1 && num <= BALL_ORDER.length) {
        const id = BALL_ORDER[num - 1];
        selectPlayerBall('red', id);
      }
      if (k === 'm' || k === 'M') setMode(mode === '1p' ? '2p' : '1p');
    }
  });
  window.addEventListener('keyup', e => {
    const k = e.key;
    if (k === 'a' || k === 'A' || (mode === '1p' && k === 'ArrowLeft')) keys.left = false;
    if (k === 'd' || k === 'D' || (mode === '1p' && k === 'ArrowRight')) keys.right = false;
    if (mode === '2p') {
      if (k === 'ArrowLeft') p2.left = false;
      if (k === 'ArrowRight') p2.right = false;
    }
  });
  window.addEventListener('blur', () => {
    keys.left = false;
    keys.right = false;
    p2.left = false;
    p2.right = false;
    activePointer = null;
  });

  /* ---------- names, mode & local 2P ---------- */

  function nameLayout() {
    const bw = clamp(W * 0.26, 150, 300);
    const bh = 46;
    const cy = H * 0.4;
    return {
      bw, bh, cy,
      red: { x: W * 0.5 - bw - 24, y: cy, w: bw, h: bh },
      blue: { x: W * 0.5 + 24, y: cy, w: bw, h: bh },
      mode1: { x: W * 0.5 - 76, y: cy + 68, w: 70, h: 32 },
      mode2: { x: W * 0.5 + 6, y: cy + 68, w: 70, h: 32 },
      classicBtn: { x: W * 0.5 - 106, y: cy + 124, w: 100, h: 32 },
      battleBtn: { x: W * 0.5 + 6, y: cy + 124, w: 100, h: 32 },
      start: { x: W * 0.5 - 82, y: cy + 186, w: 164, h: 44 }
    };
  }

  const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

  function setMode(m) {
    if (mode === m) return;
    mode = m;
    persist();
    computeLayout();
  }

  function startMatch() {
    names.red = (names.red.trim() || 'RED').toUpperCase().slice(0, 10);
    names.blue = (names.blue.trim() || 'BLUE').toUpperCase().slice(0, 10);
    persist();
    if (gameMode === 'battle') { battleStart(); return; }
    battle.on = false;
    resetMatch();
  }

  function nameKey(e) {
    const k = e.key;
    const field = nameFocus === 0 ? 'red' : 'blue';
    if (k === 'Backspace') {
      names[field] = names[field].slice(0, -1);
      e.preventDefault();
      return;
    }
    if (k === 'Enter' || k === 'Tab') {
      e.preventDefault();
      if (nameFocus === 0) nameFocus = 1;
      else startMatch();
      return;
    }
    if (k === 'Escape') {
      startMatch();
      return;
    }
    if (k.length === 1 && /[a-zA-Z0-9 \-_]/.test(k)) {
      if (names[field].length < 10) names[field] += k.toUpperCase();
    }
  }

  function nameClick(x, y) {
    const L = nameLayout();
    if (inRect(L.red, x, y)) { nameFocus = 0; return; }
    if (inRect(L.blue, x, y)) { nameFocus = 1; return; }
    if (inRect(L.mode1, x, y)) { setMode('1p'); return; }
    if (inRect(L.mode2, x, y)) { setMode('2p'); return; }
    if (inRect(L.classicBtn, x, y)) { gameMode = 'classic'; persist(); return; }
    if (inRect(L.battleBtn, x, y)) { gameMode = 'battle'; persist(); return; }
    if (inRect(L.start, x, y)) startMatch();
  }

  function drawNameBox(r, label, value, color, focused) {
    ctx.save();
    ctx.font = '800 12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = color;
    ctx.fillText(label, r.x, r.y - 6);

    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 14;
    roundedRect(r.x, r.y, r.w, r.h, 12);
    ctx.fillStyle = 'rgba(10,13,24,0.92)';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = focused ? color : 'rgba(255,255,255,0.22)';
    ctx.lineWidth = focused ? 2.4 : 1.4;
    ctx.stroke();

    ctx.font = '900 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f2f5fb';
    ctx.fillText(value || '...', r.x + r.w * 0.5, r.y + r.h * 0.54);

    if (focused && Math.sin(clock * 6) > -0.2) {
      const tw = ctx.measureText(value || '...').width;
      ctx.fillStyle = color;
      ctx.fillRect(r.x + r.w * 0.5 + tw * 0.5 + 5, r.y + r.h * 0.24, 2.4, r.h * 0.52);
    }
    ctx.restore();
  }

  function drawNameScreen() {
    const L = nameLayout();
    ctx.save();
    ctx.fillStyle = 'rgba(4,5,10,0.82)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${clamp(W * 0.028, 20, 34)}px system-ui, sans-serif`;
    ctx.fillStyle = '#ffc531';
    ctx.shadowColor = 'rgba(255,197,49,0.5)';
    ctx.shadowBlur = 18;
    ctx.fillText('BALL VS BALL', W * 0.5, H * 0.22);
    ctx.shadowBlur = 0;
    ctx.font = `800 ${clamp(W * 0.012, 9, 13)}px system-ui, sans-serif`;
    ctx.fillStyle = '#b8caff';
    ctx.fillText('ANIME RIVALS  /  50 BALLS UNLOCKED', W * 0.5, H * 0.22 + clamp(H * 0.053, 23, 34));

    drawNameBox(L.red, 'P1', names.red, '#ff6e7e', nameFocus === 0);
    drawNameBox(L.blue, 'P2', names.blue, '#5cc4ff', nameFocus === 1);

    ctx.font = '800 11px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText('MODE', W * 0.5, L.mode1.y - 12);

    const chip = (r, label, active) => {
      ctx.save();
      roundedRect(r.x, r.y, r.w, r.h, 10);
      ctx.fillStyle = active ? '#ffc531' : 'rgba(14,17,28,0.9)';
      ctx.fill();
      ctx.strokeStyle = active ? '#ffe9a8' : 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.font = '900 14px system-ui, sans-serif';
      ctx.fillStyle = active ? '#241300' : 'rgba(255,255,255,0.75)';
      ctx.fillText(label, r.x + r.w * 0.5, r.y + r.h * 0.54);
      ctx.restore();
    };
    chip(L.mode1, '1P', mode === '1p');
    chip(L.mode2, '2P', mode === '2p');

    ctx.font = '800 11px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText('GAME', W * 0.5, L.classicBtn.y - 12);
    chip(L.classicBtn, 'CLASSIC', gameMode !== 'battle');
    chip(L.battleBtn, 'BATTLE', gameMode === 'battle');
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.fillStyle = gameMode === 'battle' ? 'rgba(255,214,120,0.85)' : 'rgba(255,255,255,0.4)';
    ctx.fillText(gameMode === 'battle' ? '5 RANDOM BALLS EACH  -  VS THE BOT' : 'FIRST TO TAKE 3 HEARTS',
      W * 0.5, L.classicBtn.y + L.classicBtn.h + 13);

    const s = L.start;
    const g = ctx.createLinearGradient(0, s.y, 0, s.y + s.h);
    g.addColorStop(0, '#ffe27a');
    g.addColorStop(1, '#d68a0c');
    ctx.save();
    ctx.shadowColor = 'rgba(255,197,49,0.45)';
    ctx.shadowBlur = 16;
    roundedRect(s.x, s.y, s.w, s.h, 12);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
    roundedRect(s.x, s.y, s.w, s.h, 12);
    ctx.strokeStyle = 'rgba(255,248,210,0.9)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.font = '900 17px system-ui, sans-serif';
    ctx.fillStyle = '#241300';
    ctx.fillText('START', s.x + s.w * 0.5, s.y + s.h * 0.54);

    ctx.font = `700 ${clamp(W * 0.0105, 10, 13)}px system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('P1: A / D AIM - W SHOOT      P2: ARROW KEYS AIM - UP SHOOT', W * 0.5, L.start.y + 78);
    ctx.fillText('PICK A BALL AT THE BOTTOM OR OPEN THE INVENTORY (I) - HOVER A BALL TO SEE WHAT IT DOES', W * 0.5, L.start.y + 98);
    ctx.restore();
  }

  /* ---------- bot aiming ---------- */

  function updateBot(dt) {
    bot.timer -= dt;
    if (bot.timer <= 0) {
      const toRed = Math.atan2(red.y - blue.y, red.x - blue.x);
      // Laser ball prefers angled bank shots to lay grids fast; others aim tighter
      const spread = blue.type === 'laser' ? 0.72 : (blue.type === 'vampire' ? 0.22 : 0.38);
      let off = (Math.random() * 2 - 1) * spread;
      if (blue.type === 'laser' && Math.abs(off) < 0.22) off = (off < 0 ? -1 : 1) * 0.42;
      bot.target = toRed + off;
      bot.timer = 0.65 + Math.random() * 0.75;
    }
    const diff = Math.atan2(Math.sin(bot.target - blue.angle), Math.cos(bot.target - blue.angle));
    blue.angle += diff * Math.min(1, dt * 3.8);
    blue.facing = blue.angle;
  }

  /* ---------- combat & VFX helpers ---------- */

  function addShake(amount) {
    shake.mag = Math.min(14, Math.max(shake.mag, amount));
  }

  function spawnSparks(x, y, color, count, speedMul) {
    const cap = Math.round(90 + 100 * quality);
    if (sparks.length > cap) return;
    count = Math.max(1, Math.round(count * (0.55 + quality * 0.45)));
    const scale = clamp(red.r / 36, 0.7, 1.3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (65 + Math.random() * 170) * scale * (speedMul || 1);
      sparks.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        age: 0,
        life: 0.28 + Math.random() * 0.34,
        size: 1.5 + Math.random() * 2.2,
        color
      });
    }
  }

  function spawnPopup(x, y, text, color, vx, vy, big) {
    if (damageNumbers.length > 38) return;
    damageNumbers.push({
      x, y,
      vx: vx || (Math.random() * 2 - 1) * 26,
      vy: vy || -72,
      age: 0,
      life: big ? 1.25 : 1.05,
      text,
      color,
      big: !!big
    });
  }

  function shatterBall(b) {
    b.alive = false;
    impactRings.push({ x: b.x, y: b.y, age: 0, life: 0.62, radius: b.r * 2.8, color: b.accent });
    impactRings.push({ x: b.x, y: b.y, age: 0, life: 0.45, radius: b.r * 1.9, color: b.color });
    spawnSparks(b.x, b.y, b.accent, 22, 1.45);
    spawnSparks(b.x, b.y, b.color, 18, 1.15);
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      const sp = 95 + Math.random() * 260;
      shards.push({
        x: b.x + Math.cos(a) * b.r * 0.35,
        y: b.y + Math.sin(a) * b.r * 0.35,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() * 2 - 1) * 11,
        size: b.r * (0.16 + Math.random() * 0.22),
        color: i % 3 === 0 ? b.accent : b.color,
        dark: b.dark,
        age: 0,
        life: 0.75 + Math.random() * 0.45
      });
    }
  }

  function checkRoundEnd() {
    if (phase !== 'play') return;
    if (red.health > 0 && blue.health > 0) return;
    if (battle.on) { battleKO(); return; }

    latch = null;
    if (red.health <= 0 && red.alive) {
      shatterBall(red);
      loseLife(red);
    }
    if (blue.health <= 0 && blue.alive) {
      shatterBall(blue);
      loseLife(blue);
    }
    sfx.ko();
    hitStop = 0.065;
    addShake(11);
    phase = 'roundover';
    resetRemaining = matchOver ? MATCH_RESET_DELAY : RESET_DELAY;
  }

  function applyDamage(target, amount, hitX, hitY, hitAngle, popupColor, vx, vy, big) {
    if (phase !== 'play' || !target.alive || amount <= 0) return 0;
    if (target.type === 'chess' && target.chessPhase !== 'idle') return 0; // invulnerable during its pattern
    if (target.type === 'burst' && target.dashActive) amount *= 0.75; // Dash damage reduction
    if (target.anime) amount = animeRivals.onDamaged(target, amount);
    const dmg = Math.min(target.health, Math.max(1, Math.round(amount)));
    target.health -= dmg;
    target.hit = 1;
    target.hitAngle = hitAngle;
    if (target.type === 'verity') verityHit(target);
    spawnPopup(hitX, hitY, `-${dmg}`, popupColor || target.color, vx, vy, big);
    if (target.health <= 0) {
      if (target.type === 'cell' && cellDivide(target)) return dmg;
      checkRoundEnd();
    }
    return dmg;
  }

  function applyHeal(target, amount) {
    if (phase !== 'play' || !target.alive || amount <= 0) return;
    const gain = Math.min(target.maxHealth - target.health, Math.round(amount));
    if (gain <= 0) return;
    target.health += gain;
    target.shownHealth = Math.max(target.shownHealth, target.health);
    target.healPulse = 1;
    spawnPopup(
      target.x + (Math.random() * 2 - 1) * target.r * 0.3,
      target.y - target.r * 0.65,
      `+${gain}`,
      { r: 120, g: 255, b: 175 },
      (Math.random() * 2 - 1) * 18,
      -62,
      false
    );
  }

  /* ---------- new ball abilities ---------- */

  function spawnGlassShards(owner, target, hx, hy) {
    if (phase !== 'play' || owner.shardCooldown > 0) return;
    owner.shardCooldown = 0.3;
    const base = Math.atan2(target.y - hy, target.x - hx);
    sfx.shatter();
    for (let i = 0; i < 4; i++) {
      if (glassShards.length >= 32) break;
      const a = base + (i - 1.5) * 0.42 + (Math.random() - 0.5) * 0.26;
      const sp = 225 + Math.random() * 110;
      glassShards.push({
        owner, x: hx, y: hy,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() * 2 - 1) * 11,
        age: 0, life: 0.9, dead: false
      });
    }
    spawnSparks(hx, hy, TYPES.glass.accent, 8, 0.85);
  }

  function triggerShock(attacker, enemy) {
    if (phase !== 'play' || attacker.shockCooldown > 0) return;
    attacker.shockCooldown = 2.8;
    enemy.freezeTimer = 1.0;
    shockFx.push({ x: enemy.x, y: enemy.y, age: 0, life: 0.55, seed: Math.random() * 100 });
    sfx.shock();
    addShake(4.6);
    spawnSparks(enemy.x, enemy.y, attacker.accent, 16, 1.2);
    applyDamage(
      enemy, 12,
      enemy.x, enemy.y - enemy.r * 0.55,
      Math.random() * Math.PI * 2, attacker.accent,
      (Math.random() * 2 - 1) * 26, -78, false
    );
  }

  function updateGlassShards(dt, s) {
    for (let i = glassShards.length - 1; i >= 0; i--) {
      const sh = glassShards[i];
      if (sh.dead) { glassShards.splice(i, 1); continue; }
      sh.age += dt;
      sh.x += sh.vx * s * dt;
      sh.y += sh.vy * s * dt;
      sh.rot += sh.vrot * dt;

      const minX = arena.x + 4, maxX = arena.x + arena.w - 4;
      const minY = arena.y + 4, maxY = arena.y + arena.h - 4;
      if (sh.x < minX) { sh.x = minX + (minX - sh.x); sh.vx = Math.abs(sh.vx) * 0.68; }
      if (sh.x > maxX) { sh.x = maxX - (sh.x - maxX); sh.vx = -Math.abs(sh.vx) * 0.68; }
      if (sh.y < minY) { sh.y = minY + (minY - sh.y); sh.vy = Math.abs(sh.vy) * 0.68; }
      if (sh.y > maxY) { sh.y = maxY - (sh.y - maxY); sh.vy = -Math.abs(sh.vy) * 0.68; }

      if (phase !== 'play') return;
      const enemy = sh.owner.side === 'red' ? blue : red;
      if (enemy.alive && Math.hypot(sh.x - enemy.x, sh.y - enemy.y) <= enemy.r + 4) {
        sh.dead = true;
        sfx.shatter();
        spawnSparks(sh.x, sh.y, TYPES.glass.accent, 5, 0.7);
        applyDamage(
          enemy, 7, sh.x, sh.y - 4,
          Math.atan2(enemy.y - sh.y, enemy.x - sh.x), TYPES.glass.color,
          (Math.random() * 2 - 1) * 26, -74, true
        );
      }
      if (sh.age >= sh.life) glassShards.splice(i, 1);
    }
  }

  function updatePoisonEffects(dt) {
    if (phase !== 'play') return;

    // Poison damage over time (3 ticks of 2 after a thorn hit)
    for (const b of balls) {
      if (!b.alive || b.poisonTicks <= 0) continue;
      b.poisonTickTimer -= dt;
      if (b.poisonTickTimer <= 0) {
        b.poisonTicks--;
        b.poisonTickTimer = 0.4;
        spawnSparks(b.x, b.y, b.poisonColor || TYPES.poison.color, 5, 0.65);
        applyDamage(
          b, 3,
          b.x + (Math.random() * 2 - 1) * b.r * 0.3, b.y - b.r * 0.5,
          Math.random() * Math.PI * 2, b.poisonColor || TYPES.poison.color,
          0, -64, false
        );
        if (phase !== 'play') return;
      }
    }

    // Thorn patches trigger when the opponent touches the wall
    for (let i = poisonPatches.length - 1; i >= 0; i--) {
      const pt = poisonPatches[i];
      const victim = pt.owner.side === 'red' ? blue : red;
      if (!victim.alive) continue;
      if (Math.hypot(victim.x - pt.x, victim.y - pt.y) <= victim.r + 22) {
        poisonPatches.splice(i, 1);
        sfx.poison();
        spawnSparks(pt.x, pt.y, TYPES.poison.color, 14, 1.0);
        impactRings.push({ x: pt.x, y: pt.y, age: 0, life: 0.4, radius: victim.r * 1.1, color: TYPES.poison.color });
        applyDamage(
          victim, 9,
          victim.x, victim.y - victim.r * 0.4,
          Math.random() * Math.PI * 2, TYPES.poison.color,
          (Math.random() * 2 - 1) * 28, -76, true
        );
        if (phase !== 'play') return;
        victim.poisonTicks = 4;
        victim.poisonTickTimer = 0.4;
        victim.poisonColor = TYPES.poison.color;
      }
    }
  }

  /* ---------- Shackles, Machine Gun, Fibonacci, Bomb and Zone abilities ---------- */

  const FIB = [1, 2, 3, 5, 8, 13, 21, 34];
  const BOMB_ORANGE = { r: 255, g: 170, b: 60 };
  const ZONE_RED = { r: 255, g: 96, b: 116 };
  const TRAP_PURPLE = { r: 196, g: 156, b: 255 };
  const BRASS = { r: 255, g: 200, b: 90 };

  function foeOf(b) {
    return b === red ? blue : red;
  }

  function zoneRadius(z) {
    const grow = Math.min(1, z.age / 0.35);
    const ease = 1 - Math.pow(1 - grow, 3);
    const shrink = z.age > z.life - 0.5 ? Math.max(0, (z.life - z.age) / 0.5) : 1;
    return z.owner.r * 2.5 * ease * shrink;
  }

  function explodeBomb(bo) {
    const owner = bo.owner;
    const foe = foeOf(owner);
    const R = owner.r * 2.7;
    sfx.boom();
    addShake(7);
    explosions.push({ x: bo.x, y: bo.y, age: 0, life: 0.45, R });
    impactRings.push({ x: bo.x, y: bo.y, age: 0, life: 0.5, radius: R, color: BOMB_ORANGE });
    spawnSparks(bo.x, bo.y, BOMB_ORANGE, 14, 1.3);
    if (phase !== 'play' || !foe.alive) return;
    const d = Math.hypot(foe.x - bo.x, foe.y - bo.y);
    if (d > R + foe.r * 0.5) return;
    const ang = d > 0.01 ? Math.atan2(foe.y - bo.y, foe.x - bo.x) : Math.random() * Math.PI * 2;
    if (!latch) {
      foe.vx += Math.cos(ang) * 420;
      foe.vy += Math.sin(ang) * 420;
    }
    hitStop = Math.max(hitStop, 0.03);
    applyDamage(foe, 15, foe.x, foe.y - foe.r * 0.6, ang, BOMB_ORANGE, Math.cos(ang) * 40, -84, true);
  }

  function updateExtraAbilities(dt, s) {
    if (phase !== 'play') return;

    for (const b of balls) {
      if (b.shackledTimer > 0) b.shackledTimer = Math.max(0, b.shackledTimer - dt);
      b.gunKick = Math.max(0, b.gunKick - dt * 6);
      if (!b.alive) continue;
      const foe = foeOf(b);

      // Fibonacci: the streak breaks after 5 seconds without a hit
      if (b.type === 'fibonacci' && b.fibStep > 0) {
        b.fibIdle += dt;
        if (b.fibIdle >= 5) {
          b.fibStep = 0;
          b.fibIdle = 0;
          impactRings.push({ x: b.x, y: b.y, age: 0, life: 0.4, radius: b.r * 1.5, color: { r: 150, g: 160, b: 200 } });
        }
      }

      // Shackles: lays a trap behind itself every 2 seconds, up to 4
      if (b.type === 'shackles') {
        b.trapTimer += dt;
        if (b.trapTimer >= 2.0) {
          b.trapTimer = 0;
          const mine = traps.filter(t => t.owner === b);
          if (mine.length >= 4) traps.splice(traps.indexOf(mine[0]), 1);
          traps.push({ owner: b, x: b.x, y: b.y, age: 0, life: 10, seed: Math.random() * 10 });
          sfx.trapSet();
        }
      }

      // Machine Gun: barrel leads the target, fires a bullet every 0.45 seconds
      if (b.type === 'machine' && foe.alive) {
        const speed = 880 * s;
        const dist = Math.hypot(foe.x - b.x, foe.y - b.y);
        const lead = foe.freezeTimer > 0 ? 0 : dist / speed;
        const tx = foe.x + foe.vx * s * lead;
        const ty = foe.y + foe.vy * s * lead;
        const want = Math.atan2(ty - b.y, tx - b.x);
        const diff = Math.atan2(Math.sin(want - b.gunAngle), Math.cos(want - b.gunAngle));
        b.gunAngle += diff * Math.min(1, dt * 14);
        b.gunTimer += dt;
        if (b.gunTimer >= 0.45 && Math.abs(diff) < 0.5) {
          b.gunTimer = 0;
          const a = b.gunAngle + (Math.random() - 0.5) * 0.1;
          if (bullets.length < 30) {
            bullets.push({
              owner: b,
              x: b.x + Math.cos(a) * b.r * 1.55,
              y: b.y + Math.sin(a) * b.r * 1.55,
              vx: Math.cos(a) * speed,
              vy: Math.sin(a) * speed,
              age: 0
            });
          }
          b.gunKick = 1;
          sfx.gun();
        }
      }

      // Bomb: drops a bomb every 1.25 seconds, up to 4 at once
      if (b.type === 'bomb') {
        b.bombTimer += dt;
        if (b.bombTimer >= 1.25) {
          b.bombTimer = 0;
          const mine = bombs.filter(o => o.owner === b);
          if (mine.length >= 4) {
            bombs.splice(bombs.indexOf(mine[0]), 1);
            explodeBomb(mine[0]);
            if (phase !== 'play') return;
          }
          bombs.push({ owner: b, x: b.x, y: b.y, age: 0, fuse: 4 });
          sfx.bombDrop();
        }
      }

      // Zone: leaves a crimson zone every 2.4 seconds, up to 3 at once
      if (b.type === 'zone') {
        b.zoneTimer += dt;
        if (b.zoneTimer >= 2.4) {
          b.zoneTimer = 0;
          const mine = zones.filter(z => z.owner === b && z.life - z.age > 0.5);
          if (mine.length >= 3) mine[0].life = mine[0].age + 0.5;
          zones.push({ owner: b, x: b.x, y: b.y, age: 0, life: 7, tick: 0, pulse: 0, seed: Math.random() });
          sfx.zone();
        }
      }
    }

    // Shackle traps snap shut on the enemy
    for (let i = traps.length - 1; i >= 0; i--) {
      const t = traps[i];
      t.age += dt;
      if (t.age >= t.life) { traps.splice(i, 1); continue; }
      if (t.age < 0.5) continue;
      const foe = foeOf(t.owner);
      if (!foe.alive) continue;
      if (Math.hypot(foe.x - t.x, foe.y - t.y) > t.owner.r * 0.9 + foe.r * 0.6) continue;
      traps.splice(i, 1);
      foe.freezeTimer = Math.max(foe.freezeTimer, 1.1);
      foe.shackledTimer = 1.1;
      sfx.trapSnap();
      addShake(5);
      hitStop = Math.max(hitStop, 0.03);
      impactRings.push({ x: foe.x, y: foe.y, age: 0, life: 0.4, radius: foe.r * 1.6, color: TRAP_PURPLE });
      spawnSparks(foe.x, foe.y, TRAP_PURPLE, 12, 1.0);
      applyDamage(foe, 14, foe.x, foe.y - foe.r * 0.6, 0, TRAP_PURPLE, 0, -82, true);
      if (phase !== 'play') return;
    }

    // Bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const bu = bullets[i];
      bu.age += dt;
      const px = bu.x;
      const py = bu.y;
      bu.x += bu.vx * dt;
      bu.y += bu.vy * dt;
      const foe = foeOf(bu.owner);
      if (foe.alive) {
        const hit = closestPointOnSegment(foe.x, foe.y, px, py, bu.x, bu.y);
        if (hit.dist <= foe.r + 3) {
          bullets.splice(i, 1);
          spawnSparks(hit.x, hit.y, BRASS, 4, 0.6);
          applyDamage(foe, 3, hit.x, hit.y - 6, Math.atan2(bu.vy, bu.vx), BRASS, (Math.random() - 0.5) * 24, -66, false);
          if (phase !== 'play') return;
          continue;
        }
      }
      const out = bu.x < arena.x || bu.x > arena.x + arena.w || bu.y < arena.y || bu.y > arena.y + arena.h;
      if (out || bu.age > 1.5) {
        if (out) {
          spawnSparks(clamp(bu.x, arena.x, arena.x + arena.w), clamp(bu.y, arena.y, arena.y + arena.h), BRASS, 2, 0.4);
        }
        bullets.splice(i, 1);
      }
    }

    // Bombs blow up on contact (once armed) or when the fuse runs out
    for (let i = bombs.length - 1; i >= 0; i--) {
      const bo = bombs[i];
      bo.age += dt;
      const foe = foeOf(bo.owner);
      const near = foe.alive && bo.age > 0.6 && Math.hypot(foe.x - bo.x, foe.y - bo.y) <= foe.r + bo.owner.r * 0.55;
      if (bo.age >= bo.fuse || near) {
        bombs.splice(i, 1);
        explodeBomb(bo);
        if (phase !== 'play') return;
      }
    }

    // Zones tick damage on an enemy standing inside them
    for (let i = zones.length - 1; i >= 0; i--) {
      const z = zones[i];
      z.age += dt;
      if (z.age >= z.life) { zones.splice(i, 1); continue; }
      z.tick = Math.max(0, z.tick - dt);
      const foe = foeOf(z.owner);
      if (!foe.alive || z.tick > 0) continue;
      if (Math.hypot(foe.x - z.x, foe.y - z.y) <= zoneRadius(z) + foe.r * 0.3) {
        z.tick = 0.3;
        z.pulse = 1;
        applyDamage(foe, 4, foe.x + (Math.random() - 0.5) * foe.r * 0.6, foe.y - foe.r * 0.55, 0, ZONE_RED, (Math.random() - 0.5) * 20, -60, false);
        if (phase !== 'play') return;
      }
    }
  }

  function updateExtraVisuals(dt) {
    for (let i = explosions.length - 1; i >= 0; i--) {
      explosions[i].age += dt;
      if (explosions[i].age >= explosions[i].life) explosions.splice(i, 1);
    }
    for (const z of zones) z.pulse = Math.max(0, z.pulse - dt * 5);
  }

  function drawExtraFloor() {
    // Crimson zones
    for (const z of zones) {
      const R = zoneRadius(z);
      if (R <= 1) continue;
      const p = z.pulse;
      ctx.save();
      const g = ctx.createRadialGradient(z.x, z.y, R * 0.05, z.x, z.y, R);
      g.addColorStop(0, `rgba(255,70,90,${0.08 + p * 0.14})`);
      g.addColorStop(0.72, `rgba(255,44,72,${0.2 + p * 0.16})`);
      g.addColorStop(1, 'rgba(255,44,72,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(z.x, z.y, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,96,116,${0.7 + p * 0.3})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(z.x, z.y, R * 0.96, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([R * 0.16, R * 0.12]);
      ctx.lineDashOffset = -clock * 36;
      ctx.strokeStyle = 'rgba(255,176,186,0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(z.x, z.y, R * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      const ripple = (clock * 0.9 + z.seed) % 1;
      ctx.strokeStyle = `rgba(255,130,145,${(1 - ripple) * 0.45})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(z.x, z.y, R * (0.18 + ripple * 0.78), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Shackle traps
    for (const t of traps) {
      const tr = t.owner.r * 0.9;
      const arm = Math.min(1, t.age / 0.5);
      const fade = t.age > t.life - 0.6 ? Math.max(0, (t.life - t.age) / 0.6) : 1;
      const pop = 0.55 + (1 - Math.pow(1 - arm, 3)) * 0.45;
      ctx.save();
      ctx.globalAlpha = (0.45 + arm * 0.55) * fade;
      ctx.translate(t.x, t.y);
      ctx.scale(pop, pop);
      const glow = ctx.createRadialGradient(0, 0, tr * 0.5, 0, 0, tr * 1.55);
      glow.addColorStop(0, 'rgba(170,120,255,0)');
      glow.addColorStop(0.65, `rgba(170,120,255,${arm >= 1 ? 0.2 + Math.sin(clock * 5 + t.seed) * 0.07 : 0.1})`);
      glow.addColorStop(1, 'rgba(170,120,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, tr * 1.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(24,16,44,0.9)';
      ctx.lineWidth = tr * 0.26;
      ctx.beginPath();
      ctx.arc(0, 0, tr, 0, Math.PI * 2);
      ctx.stroke();
      const steel = ctx.createLinearGradient(-tr, -tr, tr, tr);
      steel.addColorStop(0, '#f6f8fc');
      steel.addColorStop(0.5, '#9ea7b9');
      steel.addColorStop(1, '#4a5162');
      ctx.strokeStyle = steel;
      ctx.lineWidth = tr * 0.15;
      ctx.stroke();
      ctx.fillStyle = '#e3e8f1';
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + 0.16;
        const c = Math.cos(a);
        const sn = Math.sin(a);
        ctx.beginPath();
        ctx.moveTo(c * tr * 0.9 - sn * tr * 0.09, sn * tr * 0.9 + c * tr * 0.09);
        ctx.lineTo(c * tr * 0.6, sn * tr * 0.6);
        ctx.lineTo(c * tr * 0.9 + sn * tr * 0.09, sn * tr * 0.9 - c * tr * 0.09);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = '#33255a';
      ctx.beginPath();
      ctx.arc(0, 0, tr * 0.24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = arm >= 1 ? `rgba(214,176,255,${0.7 + Math.sin(clock * 8 + t.seed) * 0.3})` : 'rgba(214,176,255,0.35)';
      ctx.beginPath();
      ctx.arc(0, 0, tr * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Bombs
    for (const bo of bombs) {
      const br = bo.owner.r * 0.4;
      const urgency = clamp(bo.age / bo.fuse, 0, 1);
      const blastR = bo.owner.r * 2.7;
      ctx.save();
      ctx.setLineDash([7, 7]);
      ctx.lineDashOffset = -clock * 28;
      ctx.strokeStyle = `rgba(255,150,60,${0.1 + urgency * 0.4})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(bo.x, bo.y, blastR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      const pop = Math.min(1, bo.age / 0.18);
      const wobble = urgency > 0.75 ? Math.sin(clock * 42) * 0.05 : 0;
      const sc = (0.55 + pop * 0.45) * (1 + wobble);
      ctx.translate(bo.x, bo.y);
      ctx.scale(sc, sc);

      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(br * 0.18, br * 0.9, br * 0.95, br * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();

      const body = ctx.createRadialGradient(-br * 0.35, -br * 0.4, br * 0.05, 0, 0, br);
      body.addColorStop(0, '#b597e6');
      body.addColorStop(0.4, '#5c3a8a');
      body.addColorStop(1, '#170a28');
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(0, 0, br, 0, Math.PI * 2);
      ctx.fill();

      // Warning light blinks faster as the fuse burns down
      const on = Math.sin(clock * (4 + urgency * 22)) > 0;
      if (on) {
        const lg = ctx.createRadialGradient(0, 0, 0, 0, 0, br * 0.9);
        lg.addColorStop(0, 'rgba(255,90,60,0.85)');
        lg.addColorStop(1, 'rgba(255,60,40,0)');
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.arc(0, 0, br * 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = on ? '#ffd2c4' : '#6a1a12';
      ctx.beginPath();
      ctx.arc(0, 0, br * 0.22, 0, Math.PI * 2);
      ctx.fill();

      // Cap, shortening fuse and spark
      ctx.fillStyle = '#2b2336';
      ctx.fillRect(-br * 0.2, -br * 1.14, br * 0.4, br * 0.3);
      const fuseLen = 1 - urgency * 0.75;
      const fx = br * 0.55 * fuseLen;
      const fy = -br * (1.1 + 0.4 * fuseLen);
      ctx.strokeStyle = '#8a6d48';
      ctx.lineWidth = Math.max(1.2, br * 0.16);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -br * 1.1);
      ctx.quadraticCurveTo(br * 0.1, -br * (1.1 + 0.45 * fuseLen), fx, fy);
      ctx.stroke();
      const flick = 0.75 + Math.sin(clock * 37 + bo.x) * 0.25;
      const sr = br * 0.5 * flick;
      const spark = ctx.createRadialGradient(fx, fy, 0, fx, fy, sr);
      spark.addColorStop(0, 'rgba(255,255,235,1)');
      spark.addColorStop(0.4, 'rgba(255,200,70,0.9)');
      spark.addColorStop(1, 'rgba(255,90,20,0)');
      ctx.fillStyle = spark;
      ctx.beginPath();
      ctx.arc(fx, fy, sr, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(-br * 0.35, -br * 0.42, br * 0.28, br * 0.16, -0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawExtraEffects() {
    // Bomb fireballs
    for (const ex of explosions) {
      const t = ex.age / ex.life;
      const R = ex.R * (0.35 + 0.65 * (1 - Math.pow(1 - t, 3)));
      const g = ctx.createRadialGradient(ex.x, ex.y, 0, ex.x, ex.y, R);
      g.addColorStop(0, `rgba(255,255,232,${(1 - t) * 0.95})`);
      g.addColorStop(0.3, `rgba(255,196,80,${(1 - t) * 0.85})`);
      g.addColorStop(0.7, `rgba(255,96,32,${(1 - t) * 0.5})`);
      g.addColorStop(1, 'rgba(120,30,10,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, R, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bullet tracers
    if (bullets.length) {
      ctx.save();
      ctx.lineCap = 'round';
      for (const bu of bullets) {
        const tx = bu.x - bu.vx * 0.03;
        const ty = bu.y - bu.vy * 0.03;
        ctx.strokeStyle = 'rgba(255,180,70,0.35)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(bu.x, bu.y);
        ctx.stroke();
        ctx.strokeStyle = '#fff4cc';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(bu.x, bu.y);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawShackledOverlay(b) {
    const t = b.shackledTimer;
    const snap = 1 + Math.max(0, t - 0.95) * 2.2;
    const R = b.r * 1.12 * snap;
    ctx.save();
    ctx.globalAlpha = Math.min(1, t / 0.2);
    const g = ctx.createRadialGradient(b.x, b.y, b.r * 0.9, b.x, b.y, b.r * 1.7);
    g.addColorStop(0, 'rgba(176,128,255,0.38)');
    g.addColorStop(1, 'rgba(176,128,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 1.7, 0, Math.PI * 2);
    ctx.fill();
    for (const rot of [0.55, -0.55]) {
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, R, R * 0.34, rot, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(18,12,34,0.88)';
      ctx.lineWidth = b.r * 0.22;
      ctx.stroke();
      const sg = ctx.createLinearGradient(b.x - R, b.y - R, b.x + R, b.y + R);
      sg.addColorStop(0, '#ffffff');
      sg.addColorStop(0.5, '#a7b0c3');
      sg.addColorStop(1, '#565e72');
      ctx.strokeStyle = sg;
      ctx.lineWidth = b.r * 0.12;
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------- Spider, Snake, Cannon, Dice and Hive abilities ---------- */

  const WEB_WHITE = { r: 245, g: 245, b: 255 };
  const HONEY = { r: 255, g: 196, b: 50 };
  const SNAKE_GREEN = { r: 130, g: 230, b: 100 };
  const SMOKE = { r: 190, g: 184, b: 172 };
  const DICE_RED = { r: 255, g: 96, b: 96 };
  const DICE_GOLD = { r: 255, g: 210, b: 80 };
  const PIP_LAYOUT = {
    1: [[0, 0]],
    2: [[-0.5, -0.5], [0.5, 0.5]],
    3: [[-0.5, -0.5], [0, 0], [0.5, 0.5]],
    4: [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]],
    5: [[-0.5, -0.5], [0.5, -0.5], [0, 0], [-0.5, 0.5], [0.5, 0.5]],
    6: [[-0.5, -0.56], [0.5, -0.56], [-0.5, 0], [0.5, 0], [-0.5, 0.56], [0.5, 0.56]]
  };

  function hexagon(cx, cy, s) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + i * Math.PI / 3;
      const px = cx + Math.cos(a) * s;
      const py = cy + Math.sin(a) * s;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function snakeSegR(b, i, n) {
    return b.r * (0.64 - 0.34 * (i / Math.max(1, n - 1)));
  }

  function remapHazards(mapX, mapY) {
    animeRivals.remap(mapX, mapY);
    const pts = [...traps, ...bombs, ...zones, ...bullets, ...bees, ...turrets, ...cannonballs, ...dice, ...knives, ...apples, ...frostPatches, ...reforgeBlades, ...harpoonShots, ...cacti, ...electroNodes, ...acidPuddles, ...bigSpikes, ...cellOrbs, ...hookShots, ...gojoOrbs];
    for (const p of pts) { p.x = mapX(p.x); p.y = mapY(p.y); }
    for (const w of webs) {
      w.x1 = mapX(w.x1); w.y1 = mapY(w.y1);
      w.x2 = mapX(w.x2); w.y2 = mapY(w.y2);
    }
    for (const b of balls) {
      for (const p of b.tail) { p.x = mapX(p.x); p.y = mapY(p.y); }
      for (const p of b.chessPath || []) { p.x = mapX(p.x); p.y = mapY(p.y); }
      if (b.chessFrom) { b.chessFrom.x = mapX(b.chessFrom.x); b.chessFrom.y = mapY(b.chessFrom.y); }
    }
  }

  function batch3WallHit(b, wx, wy) {
    if (phase !== 'play' || !b.alive) return;
    if (b.type === 'spider') {
      const mine = webs.filter(w => w.owner === b);
      if (mine.length >= 6) webs.splice(webs.indexOf(mine[0]), 1);
      webs.push({ owner: b, x1: wx, y1: wy, x2: b.x, y2: b.y, attached: 0.5, age: 0, life: 14, hitCd: 0, flash: 0, seed: Math.random() * 6 });
      sfx.web();
      spawnSparks(wx, wy, WEB_WHITE, 4, 0.5);
    } else if (b.type === 'cannon' && b.cannonCd <= 0) {
      b.cannonCd = 1.4;
      const mine = turrets.filter(t => t.owner === b);
      if (mine.length >= 3) turrets.splice(turrets.indexOf(mine[0]), 1);
      const inward = Math.atan2(arena.y + arena.h * 0.5 - wy, arena.x + arena.w * 0.5 - wx);
      const pad = b.r * 0.55;
      const tx = clamp(wx + Math.cos(inward) * pad, arena.x + pad, arena.x + arena.w - pad);
      const ty = clamp(wy + Math.sin(inward) * pad, arena.y + pad, arena.y + arena.h - pad);
      turrets.push({ owner: b, x: tx, y: ty, angle: inward, age: 0, life: 12, fire: 0.8, kick: 0 });
      sfx.cannonBuild();
      impactRings.push({ x: tx, y: ty, age: 0, life: 0.35, radius: b.r * 0.9, color: b.accent });
      spawnSparks(tx, ty, b.accent, 6, 0.7);
    }
  }

  function updateBatch3(dt, s) {
    if (phase !== 'play') return;

    for (const b of balls) {
      b.slowTimer = Math.max(0, b.slowTimer - dt);
      b.cannonCd = Math.max(0, b.cannonCd - dt);
      b.tailHitCd = Math.max(0, b.tailHitCd - dt);
      if (!b.alive) continue;
      const foe = foeOf(b);

      // Snake: the tail follows its path and grows one segment every 1.6 seconds
      if (b.type === 'snake') {
        b.snakeTimer += dt;
        if (b.snakeTimer >= 1.6 && b.snakeLen < 16) {
          b.snakeTimer = 0;
          b.snakeLen++;
        }
        const spacing = b.r * 0.42;
        if (!b.tail.length || Math.hypot(b.x - b.tail[0].x, b.y - b.tail[0].y) >= spacing) {
          b.tail.unshift({ x: b.x, y: b.y });
          while (b.tail.length > b.snakeLen) b.tail.pop();
        }
        if (foe.alive && b.tailHitCd <= 0) {
          for (let i = 2; i < b.tail.length; i++) {
            const p = b.tail[i];
            const sr = snakeSegR(b, i, b.snakeLen);
            const d = Math.hypot(foe.x - p.x, foe.y - p.y);
            if (d < foe.r + sr * 0.9) {
              b.tailHitCd = 0.55;
              const ang = d > 0.01 ? Math.atan2(foe.y - p.y, foe.x - p.x) : Math.random() * Math.PI * 2;
              if (!latch) {
                foe.vx += Math.cos(ang) * 260;
                foe.vy += Math.sin(ang) * 260;
              }
              sfx.hiss();
              addShake(3);
              spawnSparks(p.x, p.y, SNAKE_GREEN, 8, 0.9);
              applyDamage(foe, 6, foe.x, foe.y - foe.r * 0.55, ang, SNAKE_GREEN, Math.cos(ang) * 30, -76, false);
              if (phase !== 'play') return;
              break;
            }
          }
        }
      }

      // Hive: releases 2 bees every 2 seconds, up to 6
      if (b.type === 'hive') {
        b.hiveTimer += dt;
        if (b.hiveTimer >= 2.0) {
          b.hiveTimer = 0;
          const mine = bees.filter(e => e.owner === b).length;
          for (let k = 0; k < 2 && mine + k < 6; k++) {
            const a = Math.random() * Math.PI * 2;
            bees.push({
              owner: b,
              x: b.x + Math.cos(a) * b.r * 0.7,
              y: b.y + Math.sin(a) * b.r * 0.7,
              vx: Math.cos(a) * 260 * s,
              vy: Math.sin(a) * 260 * s,
              age: 0, life: 6, seed: Math.random() * 10
            });
          }
          sfx.buzz();
        }
      }

      // Dice: drops a die every 2 seconds, up to 4
      if (b.type === 'dice') {
        b.diceTimer += dt;
        if (b.diceTimer >= 2.0) {
          b.diceTimer = 0;
          const mine = dice.filter(d => d.owner === b);
          if (mine.length >= 4) dice.splice(dice.indexOf(mine[0]), 1);
          const v = 1 + Math.floor(Math.random() * 6);
          dice.push({ owner: b, x: b.x, y: b.y, value: v, shown: v, roll: 0.55, flick: 0, rot: Math.random() * Math.PI * 2, rest: Math.random() * 0.5 - 0.25, cd: 0.3, age: 0, life: 9, bump: 0 });
          sfx.diceRoll();
        }
      }
    }

    // Spider silk strands
    for (let i = webs.length - 1; i >= 0; i--) {
      const w = webs[i];
      w.age += dt;
      w.hitCd = Math.max(0, w.hitCd - dt);
      w.flash = Math.max(0, w.flash - dt * 4);
      if (w.attached > 0) {
        w.attached -= dt;
        if (w.owner.alive) { w.x2 = w.owner.x; w.y2 = w.owner.y; }
      }
      if (w.age >= w.life) { webs.splice(i, 1); continue; }
      const foe = foeOf(w.owner);
      if (!foe.alive || w.hitCd > 0 || w.age < 0.15) continue;
      const hit = closestPointOnSegment(foe.x, foe.y, w.x1, w.y1, w.x2, w.y2);
      if (hit.dist <= foe.r + 2) {
        w.hitCd = 0.8;
        w.flash = 1;
        foe.slowTimer = Math.max(foe.slowTimer, 0.9);
        sfx.web();
        spawnSparks(hit.x, hit.y, WEB_WHITE, 5, 0.6);
        applyDamage(foe, 3, hit.x, hit.y - 6, Math.atan2(foe.y - hit.y, foe.x - hit.x), WEB_WHITE, (Math.random() - 0.5) * 24, -66, false);
        if (phase !== 'play') return;
      }
    }

    // Homing bees
    for (let i = bees.length - 1; i >= 0; i--) {
      const e = bees[i];
      e.age += dt;
      if (e.age >= e.life) { bees.splice(i, 1); continue; }
      const foe = foeOf(e.owner);
      const speed = 330 * s;
      let ang = Math.atan2(e.vy, e.vx);
      if (foe.alive) {
        const want = Math.atan2(foe.y - e.y, foe.x - e.x);
        const diff = Math.atan2(Math.sin(want - ang), Math.cos(want - ang));
        ang += clamp(diff, -3.4 * dt, 3.4 * dt);
      }
      ang += Math.sin(clock * 9 + e.seed) * 1.6 * dt;
      e.vx = Math.cos(ang) * speed;
      e.vy = Math.sin(ang) * speed;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.x < arena.x + 4) { e.x = arena.x + 4; e.vx = Math.abs(e.vx); }
      if (e.x > arena.x + arena.w - 4) { e.x = arena.x + arena.w - 4; e.vx = -Math.abs(e.vx); }
      if (e.y < arena.y + 4) { e.y = arena.y + 4; e.vy = Math.abs(e.vy); }
      if (e.y > arena.y + arena.h - 4) { e.y = arena.y + arena.h - 4; e.vy = -Math.abs(e.vy); }
      if (foe.alive && Math.hypot(foe.x - e.x, foe.y - e.y) <= foe.r + e.owner.r * 0.16) {
        bees.splice(i, 1);
        if (foe.poisonTicks <= 0) foe.poisonTickTimer = 0.4;
        foe.poisonTicks = Math.max(foe.poisonTicks, 2);
        foe.poisonColor = HONEY;
        spawnSparks(e.x, e.y, HONEY, 5, 0.6);
        sfx.sting();
        applyDamage(foe, 3, e.x, e.y - 6, ang, HONEY, (Math.random() - 0.5) * 24, -66, false);
        if (phase !== 'play') return;
      }
    }

    // Cannon turrets track and fire
    for (let i = turrets.length - 1; i >= 0; i--) {
      const t = turrets[i];
      t.age += dt;
      t.kick = Math.max(0, t.kick - dt * 5);
      if (t.age >= t.life) { turrets.splice(i, 1); continue; }
      const foe = foeOf(t.owner);
      if (!foe.alive) continue;
      const want = Math.atan2(foe.y - t.y, foe.x - t.x);
      const diff = Math.atan2(Math.sin(want - t.angle), Math.cos(want - t.angle));
      t.angle += diff * Math.min(1, dt * 6);
      t.fire += dt;
      if (t.fire >= 1.8 && Math.abs(diff) < 0.25 && t.age > 0.4) {
        t.fire = 0;
        t.kick = 1;
        const sp = 520 * s;
        const br = t.owner.r;
        const mx = t.x + Math.cos(t.angle) * br * 0.85;
        const my = t.y + Math.sin(t.angle) * br * 0.85;
        cannonballs.push({ owner: t.owner, x: mx, y: my, vx: Math.cos(t.angle) * sp, vy: Math.sin(t.angle) * sp, age: 0, trail: [] });
        sfx.cannon();
        addShake(1.8);
        spawnSparks(mx, my, SMOKE, 6, 0.6);
      }
    }

    // Cannonballs
    for (let i = cannonballs.length - 1; i >= 0; i--) {
      const c = cannonballs[i];
      c.age += dt;
      c.trail.unshift({ x: c.x, y: c.y });
      if (c.trail.length > 7) c.trail.pop();
      const px = c.x;
      const py = c.y;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      const foe = foeOf(c.owner);
      const cr = c.owner.r * 0.22;
      if (foe.alive) {
        const hit = closestPointOnSegment(foe.x, foe.y, px, py, c.x, c.y);
        if (hit.dist <= foe.r + cr) {
          cannonballs.splice(i, 1);
          const ang = Math.atan2(c.vy, c.vx);
          if (!latch) {
            foe.vx += Math.cos(ang) * 170;
            foe.vy += Math.sin(ang) * 170;
          }
          addShake(3.5);
          impactRings.push({ x: hit.x, y: hit.y, age: 0, life: 0.35, radius: foe.r * 0.9, color: SMOKE });
          spawnSparks(hit.x, hit.y, c.owner.accent, 8, 0.9);
          applyDamage(foe, 7, hit.x, hit.y - 6, ang, c.owner.accent, Math.cos(ang) * 30, -78, true);
          if (phase !== 'play') return;
          continue;
        }
      }
      const out = c.x < arena.x || c.x > arena.x + arena.w || c.y < arena.y || c.y > arena.y + arena.h;
      if (out || c.age > 2.5) {
        if (out) spawnSparks(clamp(c.x, arena.x, arena.x + arena.w), clamp(c.y, arena.y, arena.y + arena.h), SMOKE, 5, 0.6);
        cannonballs.splice(i, 1);
      }
    }

    // Dice roll, then deal double their number on contact and reroll
    for (let i = dice.length - 1; i >= 0; i--) {
      const d = dice[i];
      d.age += dt;
      d.cd = Math.max(0, d.cd - dt);
      d.bump = Math.max(0, d.bump - dt * 4);
      if (d.roll > 0) {
        d.roll -= dt;
        d.rot += dt * 14;
        d.flick -= dt;
        if (d.flick <= 0) {
          d.flick = 0.06;
          d.shown = 1 + Math.floor(Math.random() * 6);
        }
        if (d.roll <= 0) d.shown = d.value;
      }
      if (d.age >= d.life) { dice.splice(i, 1); continue; }
      const foe = foeOf(d.owner);
      if (!foe.alive || d.roll > 0 || d.cd > 0) continue;
      if (Math.hypot(foe.x - d.x, foe.y - d.y) <= foe.r + d.owner.r * 0.38) {
        const dmg = d.value * 2;
        const big = d.value >= 5;
        const col = d.value === 6 ? DICE_GOLD : DICE_RED;
        d.cd = 1.0;
        d.bump = 1;
        sfx.dice(d.value);
        if (big) {
          addShake(4);
          hitStop = Math.max(hitStop, 0.03);
        }
        impactRings.push({ x: d.x, y: d.y, age: 0, life: 0.38, radius: d.owner.r * (0.8 + d.value * 0.12), color: col });
        spawnSparks(d.x, d.y, col, 4 + d.value * 2, 0.9);
        applyDamage(foe, dmg, d.x, d.y - d.owner.r * 0.6, 0, col, 0, -84, big);
        if (phase !== 'play') return;
        d.value = 1 + Math.floor(Math.random() * 6);
        d.roll = 0.55;
      }
    }
  }

  function drawDie(x, y, s, rot, value, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(s * 0.18, s * 0.92, s * 0.95, s * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(rot);
    // Side face gives the cube depth
    roundedRect(-s + s * 0.14, -s + s * 0.18, s * 2, s * 2, s * 0.42);
    ctx.fillStyle = '#9d947f';
    ctx.fill();

    roundedRect(-s, -s, s * 2, s * 2, s * 0.42);
    const face = ctx.createLinearGradient(-s, -s, s, s);
    face.addColorStop(0, '#ffffff');
    face.addColorStop(0.55, '#f1ece0');
    face.addColorStop(1, '#cfc6b2');
    ctx.fillStyle = face;
    ctx.fill();
    ctx.strokeStyle = 'rgba(70,62,46,0.55)';
    ctx.lineWidth = Math.max(1, s * 0.07);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    roundedRect(-s * 0.82, -s * 0.84, s * 1.1, s * 0.34, s * 0.17);
    ctx.fill();

    const pips = PIP_LAYOUT[value] || PIP_LAYOUT[1];
    const pr = value === 1 ? s * 0.3 : s * 0.19;
    for (const p of pips) {
      const px = p[0] * s * 1.18;
      const py = p[1] * s * 1.18;
      const g = ctx.createRadialGradient(px - pr * 0.3, py - pr * 0.3, 0, px, py, pr);
      if (value === 1) {
        g.addColorStop(0, '#ff8a8a');
        g.addColorStop(1, '#b8121e');
      } else {
        g.addColorStop(0, '#5a5650');
        g.addColorStop(1, '#141210');
      }
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBatch3Floor() {
    // Snake tails
    for (const b of balls) {
      if (b.type !== 'snake' || !b.alive || b.tail.length < 2) continue;
      const n = b.snakeLen;
      for (let i = b.tail.length - 1; i >= 1; i--) {
        const p = b.tail[i];
        const sr = snakeSegR(b, i, n);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(p.x + sr * 0.15, p.y + sr * 0.8, sr * 0.95, sr * 0.38, 0, 0, Math.PI * 2);
        ctx.fill();
        const g = ctx.createRadialGradient(p.x - sr * 0.35, p.y - sr * 0.4, sr * 0.05, p.x, p.y, sr);
        if (i % 3 === 0) {
          g.addColorStop(0, '#b6e98a');
          g.addColorStop(0.5, '#2f7d34');
          g.addColorStop(1, '#0b2c12');
        } else {
          g.addColorStop(0, '#d8f7a8');
          g.addColorStop(0.5, '#5fbf4a');
          g.addColorStop(1, '#174f22');
        }
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, sr, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(8,36,14,0.55)';
        ctx.lineWidth = Math.max(1, sr * 0.08);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.beginPath();
        ctx.ellipse(p.x - sr * 0.3, p.y - sr * 0.38, sr * 0.34, sr * 0.18, -0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Spider silk strands with a small anchor web where each one starts
    for (const w of webs) {
      const fade = Math.min(1, w.age / 0.15) * (w.age > w.life - 0.8 ? Math.max(0, (w.life - w.age) / 0.8) : 1);
      if (fade <= 0) continue;
      const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
      const cx = (w.x1 + w.x2) * 0.5;
      const cy = (w.y1 + w.y2) * 0.5 + len * 0.05;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(w.x1, w.y1);
      ctx.quadraticCurveTo(cx, cy, w.x2, w.y2);
      ctx.strokeStyle = `rgba(255,255,255,${0.12 + w.flash * 0.3})`;
      ctx.lineWidth = 5 + w.flash * 4;
      ctx.stroke();
      ctx.strokeStyle = w.flash > 0 ? '#ffffff' : 'rgba(236,238,248,0.9)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let k = 1; k < 4; k++) {
        const u = k / 4;
        const bx = (1 - u) * (1 - u) * w.x1 + 2 * (1 - u) * u * cx + u * u * w.x2;
        const by = (1 - u) * (1 - u) * w.y1 + 2 * (1 - u) * u * cy + u * u * w.y2;
        ctx.beginPath();
        ctx.arc(bx, by, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      const ar = w.owner.r * 0.6;
      ctx.strokeStyle = 'rgba(240,242,250,0.75)';
      ctx.lineWidth = 1;
      for (let k = 0; k < 8; k++) {
        const a = w.seed + k * Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(w.x1, w.y1);
        ctx.lineTo(w.x1 + Math.cos(a) * ar, w.y1 + Math.sin(a) * ar);
        ctx.stroke();
      }
      for (const rr of [0.4, 0.75]) {
        ctx.beginPath();
        for (let k = 0; k <= 8; k++) {
          const a = w.seed + k * Math.PI / 4;
          const px = w.x1 + Math.cos(a) * ar * rr;
          const py = w.y1 + Math.sin(a) * ar * rr;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    // Dice
    for (const d of dice) {
      const pop = Math.min(1, d.age / 0.2);
      const fade = d.age > d.life - 0.6 ? Math.max(0, (d.life - d.age) / 0.6) : 1;
      const s = d.owner.r * 0.36 * (0.6 + pop * 0.4) * (1 + d.bump * 0.18);
      const ready = d.roll <= 0 && d.cd <= 0;
      if (ready) {
        const glow = ctx.createRadialGradient(d.x, d.y, s * 0.6, d.x, d.y, s * 2.2);
        const col = d.value === 6 ? '255,210,80' : '255,255,255';
        glow.addColorStop(0, `rgba(${col},${0.16 + Math.sin(clock * 4 + d.x) * 0.06})`);
        glow.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(d.x, d.y, s * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      drawDie(d.x, d.y, s, d.roll > 0 ? d.rot : d.rest, d.shown, fade);
    }

    // Cannon turrets
    for (const t of turrets) {
      const tr = t.owner.r * 0.44;
      const pop = 1 - Math.pow(1 - Math.min(1, t.age / 0.25), 3);
      const fade = t.age > t.life - 0.6 ? Math.max(0, (t.life - t.age) / 0.6) : 1;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(t.x, t.y);
      ctx.scale(pop, pop);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(tr * 0.15, tr * 0.85, tr * 1.1, tr * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      const base = ctx.createRadialGradient(-tr * 0.35, -tr * 0.4, tr * 0.05, 0, 0, tr);
      base.addColorStop(0, '#a7abb8');
      base.addColorStop(0.55, '#565a66');
      base.addColorStop(1, '#1b1c22');
      ctx.fillStyle = base;
      ctx.beginPath();
      ctx.arc(0, 0, tr, 0, Math.PI * 2);
      ctx.fill();
      const brass = ctx.createLinearGradient(-tr, -tr, tr, tr);
      brass.addColorStop(0, '#ffe2a4');
      brass.addColorStop(0.5, '#c8902f');
      brass.addColorStop(1, '#6e4710');
      ctx.strokeStyle = brass;
      ctx.lineWidth = tr * 0.18;
      ctx.stroke();

      ctx.save();
      ctx.rotate(t.angle);
      const recoil = t.kick * tr * 0.3;
      const barrel = ctx.createLinearGradient(0, -tr * 0.34, 0, tr * 0.34);
      barrel.addColorStop(0, '#b9bdc8');
      barrel.addColorStop(0.45, '#4f535e');
      barrel.addColorStop(1, '#16171c');
      roundedRect(tr * 0.1 - recoil, -tr * 0.32, tr * 1.4, tr * 0.64, tr * 0.2);
      ctx.fillStyle = barrel;
      ctx.fill();
      ctx.strokeStyle = 'rgba(10,10,14,0.8)';
      ctx.lineWidth = 1;
      ctx.stroke();
      roundedRect(tr * 1.32 - recoil, -tr * 0.4, tr * 0.24, tr * 0.8, tr * 0.08);
      ctx.fillStyle = brass;
      ctx.fill();
      if (t.kick > 0.55) {
        const f = (t.kick - 0.55) / 0.45;
        const fx = tr * 1.75 - recoil;
        const fl = ctx.createRadialGradient(fx, 0, 0, fx, 0, tr * 0.9 * f);
        fl.addColorStop(0, 'rgba(255,250,220,1)');
        fl.addColorStop(0.4, 'rgba(255,190,80,0.85)');
        fl.addColorStop(1, 'rgba(255,110,30,0)');
        ctx.fillStyle = fl;
        ctx.beginPath();
        ctx.arc(fx, 0, tr * 0.9 * f, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      const cap = ctx.createRadialGradient(-tr * 0.15, -tr * 0.15, 0, 0, 0, tr * 0.44);
      cap.addColorStop(0, '#d8dbe3');
      cap.addColorStop(1, '#3a3d46');
      ctx.fillStyle = cap;
      ctx.beginPath();
      ctx.arc(0, 0, tr * 0.44, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = t.owner.side === 'red' ? '#ff7d8c' : '#6fc6ff';
      ctx.beginPath();
      ctx.arc(0, 0, tr * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawBatch3Effects() {
    // Cannonballs with smoke trails
    for (const c of cannonballs) {
      const cr = c.owner.r * 0.22;
      for (let k = c.trail.length - 1; k >= 1; k--) {
        const p = c.trail[k];
        const u = k / c.trail.length;
        ctx.fillStyle = `rgba(190,184,172,${(1 - u) * 0.32})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, cr * (0.6 + u * 0.7), 0, Math.PI * 2);
        ctx.fill();
      }
      const g = ctx.createRadialGradient(c.x - cr * 0.35, c.y - cr * 0.4, cr * 0.05, c.x, c.y, cr);
      g.addColorStop(0, '#9ea1ab');
      g.addColorStop(0.5, '#3b3d45');
      g.addColorStop(1, '#0c0c10');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(c.x, c.y, cr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.arc(c.x - cr * 0.35, c.y - cr * 0.38, cr * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bees with flapping wings and stripes
    for (const e of bees) {
      const ang = Math.atan2(e.vy, e.vx);
      const bs = e.owner.r * 0.17;
      const fade = Math.min(1, e.age / 0.2) * (e.age > e.life - 0.4 ? Math.max(0, (e.life - e.age) / 0.4) : 1);
      const wobX = Math.sin(clock * 22 + e.seed) * bs * 0.25;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(e.x, e.y + wobX);
      ctx.rotate(ang);
      const flap = 0.45 + Math.abs(Math.sin(clock * 60 + e.seed)) * 0.55;
      ctx.fillStyle = 'rgba(230,244,255,0.6)';
      for (const sgn of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(-bs * 0.1, sgn * bs * 0.75, bs * 0.7, bs * 0.45 * flap, sgn * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, 0, bs * 1.25, bs * 0.82, 0, 0, Math.PI * 2);
      const body = ctx.createLinearGradient(0, -bs, 0, bs);
      body.addColorStop(0, '#fff0a0');
      body.addColorStop(0.5, '#ffc21f');
      body.addColorStop(1, '#a86500');
      ctx.fillStyle = body;
      ctx.fill();
      ctx.clip();
      ctx.fillStyle = '#21140a';
      ctx.fillRect(-bs * 0.55, -bs, bs * 0.32, bs * 2);
      ctx.fillRect(bs * 0.05, -bs, bs * 0.32, bs * 2);
      ctx.restore();
      ctx.fillStyle = '#21140a';
      ctx.beginPath();
      ctx.arc(bs * 1.05, 0, bs * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-bs * 1.2, -bs * 0.2);
      ctx.lineTo(-bs * 1.75, 0);
      ctx.lineTo(-bs * 1.2, bs * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawWebbedOverlay(b) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, b.slowTimer / 0.25) * 0.85;
    ctx.strokeStyle = 'rgba(245,246,255,0.9)';
    ctx.lineWidth = Math.max(1, b.r * 0.045);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, b.r * 1.08, b.r * 0.42, i * 1.05 + 0.3, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 1.02, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* ---------- Thief, Axe, Charge, Frost and Apple abilities ---------- */

  const STEEL = { r: 220, g: 228, b: 240 };
  const PLAID_RED = { r: 240, g: 90, b: 70 };
  const CHARGE_PINK = { r: 255, g: 80, b: 190 };
  const ICE_BLUE = { r: 190, g: 232, b: 255 };
  const APPLE_RED = { r: 255, g: 74, b: 74 };

  function chargeRatio(b) {
    return clamp(b.chargeT / 4, 0, 1);
  }

  // Aims at where the enemy will be when the projectile arrives
  function leadAim(b, foe, speed) {
    const dist = Math.hypot(foe.x - b.x, foe.y - b.y);
    const t = foe.freezeTimer > 0 ? 0 : dist / speed;
    const s = speedScale();
    return Math.atan2(foe.y + foe.vy * s * t - b.y, foe.x + foe.vx * s * t - b.x);
  }

  // Hit area of the orbiting axe: a circle on the blade plus the handle
  function axeGeom(b) {
    const a = b.axeAngle;
    const dist = b.r * 1.62;
    const hr = b.r * 0.42;
    const tx = -Math.sin(a);
    const ty = Math.cos(a);
    return {
      a,
      hx: b.x + Math.cos(a) * dist + tx * hr * 0.6,
      hy: b.y + Math.sin(a) * dist + ty * hr * 0.6,
      hr: hr * 1.05,
      sx: b.x + Math.cos(a) * b.r * 0.9,
      sy: b.y + Math.sin(a) * b.r * 0.9,
      ex: b.x + Math.cos(a) * dist,
      ey: b.y + Math.sin(a) * dist
    };
  }

  function flakePath(cx, cy, R) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 - Math.PI / 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + c * R, cy + s * R);
      for (const t of [0.45, 0.72]) {
        const bx = cx + c * R * t;
        const by = cy + s * R * t;
        const bl = R * (t < 0.5 ? 0.3 : 0.22);
        for (const sg of [-1, 1]) {
          const ba = a + sg * 0.75;
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + Math.cos(ba) * bl, by + Math.sin(ba) * bl);
        }
      }
    }
  }

  function updateBatch4(dt, s) {
    if (phase !== 'play') return;

    for (const b of balls) {
      b.frostCd = Math.max(0, b.frostCd - dt);
      b.iceTimer = Math.max(0, b.iceTimer - dt);
      b.axeHitCd = Math.max(0, b.axeHitCd - dt);
      if (!b.alive) continue;
      const foe = foeOf(b);
      const hurt = 1 - clamp(b.health / b.maxHealth, 0, 1);

      // Thief: throws knives, faster as its HP drops (1.25s down to 0.45s)
      if (b.type === 'thief' && foe.alive) {
        b.knifeTimer += dt;
        if (b.knifeTimer >= 1.25 - 0.8 * hurt) {
          b.knifeTimer = 0;
          const speed = 640 * s;
          const a = leadAim(b, foe, speed) + (Math.random() - 0.5) * 0.08;
          const mine = knives.filter(k => k.owner === b);
          if (mine.length >= 10) knives.splice(knives.indexOf(mine[0]), 1);
          knives.push({
            owner: b,
            x: b.x + Math.cos(a) * b.r * 1.05,
            y: b.y + Math.sin(a) * b.r * 1.05,
            vx: Math.cos(a) * speed,
            vy: Math.sin(a) * speed,
            rot: a, age: 0, stuck: 0
          });
          sfx.knife();
        }
      }

      // Axe: the axe spins faster as its HP drops
      if (b.type === 'axe') {
        b.axeAngle += (3.2 + 4.2 * hurt) * dt;
        if (foe.alive && b.axeHitCd <= 0) {
          const g = axeGeom(b);
          const dHead = Math.hypot(foe.x - g.hx, foe.y - g.hy);
          const handle = closestPointOnSegment(foe.x, foe.y, g.sx, g.sy, g.ex, g.ey);
          if (dHead < foe.r + g.hr || handle.dist < foe.r + b.r * 0.08) {
            b.axeHitCd = 0.5;
            const tx = -Math.sin(g.a);
            const ty = Math.cos(g.a);
            const out = Math.atan2(foe.y - b.y, foe.x - b.x);
            if (!latch) {
              foe.vx += Math.cos(out) * 160 + tx * 200;
              foe.vy += Math.sin(out) * 160 + ty * 200;
            }
            sfx.chop();
            addShake(5);
            hitStop = Math.max(hitStop, 0.035);
            axeSlashes.push({ x: g.hx, y: g.hy, a: g.a, age: 0, life: 0.3, r: b.r });
            spawnSparks(g.hx, g.hy, STEEL, 10, 1.1);
            applyDamage(foe, 10, foe.x, foe.y - foe.r * 0.6, out, PLAID_RED, tx * 30, -82, true);
            if (phase !== 'play') return;
          }
        }
      }

      // Charge: builds up over 4 seconds without a hit
      if (b.type === 'charge') {
        const before = chargeRatio(b);
        b.chargeT = Math.min(4, b.chargeT + dt);
        if (before < 1 && chargeRatio(b) >= 1) {
          sfx.chargeFull();
          impactRings.push({ x: b.x, y: b.y, age: 0, life: 0.45, radius: b.r * 1.6, color: CHARGE_PINK });
        }
      }

      // Frost: leaves a trail of frost patches
      if (b.type === 'frost') {
        b.frostTimer += dt;
        if (b.frostTimer >= 0.28) {
          b.frostTimer = 0;
          const mine = frostPatches.filter(p => p.owner === b);
          if (mine.length >= 16) frostPatches.splice(frostPatches.indexOf(mine[0]), 1);
          frostPatches.push({ owner: b, x: b.x, y: b.y, age: 0, life: 3.6, rot: Math.random() * Math.PI });
        }
      }

      // Apple: throws a bouncing apple every 2.1 seconds
      if (b.type === 'apple' && foe.alive) {
        b.appleTimer += dt;
        if (b.appleTimer >= 2.1) {
          b.appleTimer = 0;
          const speed = 440 * s;
          const a = leadAim(b, foe, speed);
          if (apples.length < 8) {
            apples.push({
              owner: b,
              x: b.x + Math.cos(a) * b.r * 1.0,
              y: b.y + Math.sin(a) * b.r * 1.0,
              vx: Math.cos(a) * speed,
              vy: Math.sin(a) * speed,
              age: 0, rot: 0,
              spin: (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 4),
              bounces: 0
            });
          }
          sfx.appleThrow();
        }
      }
    }

    // Knives: hit the enemy, or stick into the wall for a moment
    for (let i = knives.length - 1; i >= 0; i--) {
      const k = knives[i];
      k.age += dt;
      if (k.stuck > 0) {
        k.stuck -= dt;
        if (k.stuck <= 0) knives.splice(i, 1);
        continue;
      }
      const px = k.x;
      const py = k.y;
      k.x += k.vx * dt;
      k.y += k.vy * dt;
      k.rot += 20 * dt;
      const foe = foeOf(k.owner);
      if (foe.alive) {
        const hit = closestPointOnSegment(foe.x, foe.y, px, py, k.x, k.y);
        if (hit.dist <= foe.r + 4) {
          knives.splice(i, 1);
          spawnSparks(hit.x, hit.y, STEEL, 5, 0.7);
          sfx.knifeHit();
          applyDamage(foe, 4, hit.x, hit.y - 6, Math.atan2(k.vy, k.vx), STEEL, (Math.random() - 0.5) * 24, -68, false);
          if (phase !== 'play') return;
          continue;
        }
      }
      const minX = arena.x + 3;
      const maxX = arena.x + arena.w - 3;
      const minY = arena.y + 3;
      const maxY = arena.y + arena.h - 3;
      if (k.x < minX || k.x > maxX || k.y < minY || k.y > maxY) {
        k.x = clamp(k.x, minX, maxX);
        k.y = clamp(k.y, minY, maxY);
        k.rot = Math.atan2(k.vy, k.vx);
        k.vx = 0;
        k.vy = 0;
        k.stuck = 0.8;
        spawnSparks(k.x, k.y, STEEL, 3, 0.4);
        sfx.thunk();
      } else if (k.age > 2) {
        knives.splice(i, 1);
      }
    }

    // Frost patches freeze the enemy, with a cooldown so it cannot be chain-frozen
    for (let i = frostPatches.length - 1; i >= 0; i--) {
      const p = frostPatches[i];
      p.age += dt;
      if (p.age >= p.life) { frostPatches.splice(i, 1); continue; }
      const foe = foeOf(p.owner);
      if (!foe.alive || foe.frostCd > 0 || p.age < 0.35) continue;
      if (Math.hypot(foe.x - p.x, foe.y - p.y) <= foe.r * 0.7 + p.owner.r * 0.45) {
        foe.frostCd = 1.6;
        foe.freezeTimer = Math.max(foe.freezeTimer, 0.55);
        foe.iceTimer = 0.55;
        sfx.frost();
        addShake(2.5);
        impactRings.push({ x: foe.x, y: foe.y, age: 0, life: 0.38, radius: foe.r * 1.4, color: ICE_BLUE });
        spawnSparks(foe.x, foe.y, ICE_BLUE, 10, 0.9);
        applyDamage(foe, 3, foe.x, foe.y - foe.r * 0.6, 0, ICE_BLUE, 0, -74, false);
        if (phase !== 'play') return;
      }
    }

    // Apples: bounce off walls up to twice, hurt the enemy and heal the thrower
    for (let i = apples.length - 1; i >= 0; i--) {
      const ap = apples[i];
      ap.age += dt;
      ap.rot += ap.spin * dt;
      ap.x += ap.vx * dt;
      ap.y += ap.vy * dt;
      const ar = ap.owner.r * 0.27;
      const foe = foeOf(ap.owner);
      if (foe.alive && Math.hypot(foe.x - ap.x, foe.y - ap.y) <= foe.r + ar) {
        apples.splice(i, 1);
        sfx.appleHit();
        addShake(2.5);
        spawnSparks(ap.x, ap.y, APPLE_RED, 10, 0.9);
        spawnSparks(ap.x, ap.y, { r: 255, g: 238, b: 200 }, 4, 0.6);
        applyDamage(foe, 8, ap.x, ap.y - 6, Math.atan2(ap.vy, ap.vx), APPLE_RED, (Math.random() - 0.5) * 24, -74, false);
        if (phase !== 'play') return;
        applyHeal(ap.owner, 5);
        continue;
      }
      if (ap.x < arena.x + ar) { ap.x = arena.x + ar; ap.vx = Math.abs(ap.vx) * 0.85; ap.bounces++; }
      if (ap.x > arena.x + arena.w - ar) { ap.x = arena.x + arena.w - ar; ap.vx = -Math.abs(ap.vx) * 0.85; ap.bounces++; }
      if (ap.y < arena.y + ar) { ap.y = arena.y + ar; ap.vy = Math.abs(ap.vy) * 0.85; ap.bounces++; }
      if (ap.y > arena.y + arena.h - ar) { ap.y = arena.y + arena.h - ar; ap.vy = -Math.abs(ap.vy) * 0.85; ap.bounces++; }
      if (ap.bounces > 2 || ap.age > 4) {
        spawnSparks(ap.x, ap.y, APPLE_RED, 6, 0.6);
        apples.splice(i, 1);
      }
    }
  }

  function updateBatch4Visuals(dt) {
    for (let i = axeSlashes.length - 1; i >= 0; i--) {
      axeSlashes[i].age += dt;
      if (axeSlashes[i].age >= axeSlashes[i].life) axeSlashes.splice(i, 1);
    }
  }



  function drawSpearWeapon(x, y, r, a, isMini, boost) {
    const len = r * (isMini ? 1.7 : 2.35);
    const headLen = r * 0.62;
    const sw = r * 0.09;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    // Speed streaks grow as Spear Ball accelerates
    if (!isMini && boost > 0.05) {
      ctx.strokeStyle = `rgba(148,254,3,${0.1 + boost * 0.3})`;
      ctx.lineWidth = r * 0.06;
      ctx.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.9, i * r * 0.45);
        ctx.lineTo(-r * (1.4 + boost * 1.4), i * r * 0.45);
        ctx.stroke();
      }
    }
    // Wooden shaft (wiki #855b48)
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = r * 0.2;
    const shaft = ctx.createLinearGradient(0, -sw, 0, sw);
    shaft.addColorStop(0, '#b0836a');
    shaft.addColorStop(0.5, '#855b48');
    shaft.addColorStop(1, '#4a2e22');
    ctx.fillStyle = shaft;
    roundedRect(-r * 0.3, -sw, len - headLen + r * 0.3, sw * 2, sw);
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,18,10,0.85)';
    ctx.lineWidth = Math.max(1, r * 0.03);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Neon-green binding where the head meets the shaft
    ctx.fillStyle = '#94fe03';
    ctx.fillRect(len - headLen - r * 0.16, -sw * 1.5, r * 0.12, sw * 3);
    // Iron leaf head (wiki #d8dde6)
    const head = ctx.createLinearGradient(0, -r * 0.2, 0, r * 0.2);
    head.addColorStop(0, '#ffffff');
    head.addColorStop(0.45, '#d8dde6');
    head.addColorStop(1, '#6a6e79');
    ctx.fillStyle = head;
    ctx.beginPath();
    ctx.moveTo(len - headLen, 0);
    ctx.lineTo(len - headLen * 0.62, -r * 0.2);
    ctx.lineTo(len, 0);
    ctx.lineTo(len - headLen * 0.62, r * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,34,44,0.9)';
    ctx.lineWidth = Math.max(1, r * 0.035);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = Math.max(0.8, r * 0.025);
    ctx.beginPath();
    ctx.moveTo(len - headLen * 0.9, 0);
    ctx.lineTo(len - r * 0.05, 0);
    ctx.stroke();
    ctx.restore();
  }

  function drawAxeWeapon(x, y, r, a, isMini) {
    const dist = r * (isMini ? 1.2 : 1.62);
    const hr = r * (isMini ? 0.36 : 0.42);
    const hw = r * 0.12;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);

    // Faint swing trail behind the head
    if (!isMini) {
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = hr * 1.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, dist + hr * 0.3, -0.95, -0.08);
      ctx.stroke();
    }

    // Wooden handle with a leather grip
    const wood = ctx.createLinearGradient(0, -hw, 0, hw);
    wood.addColorStop(0, '#e2ad74');
    wood.addColorStop(0.5, '#8f5c2c');
    wood.addColorStop(1, '#4a2c10');
    roundedRect(r * 0.55, -hw, dist - r * 0.55 + hr * 0.55, hw * 2, hw);
    ctx.fillStyle = wood;
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,16,4,0.75)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(40,20,8,0.75)';
    for (let i = 0; i < 3; i++) ctx.fillRect(r * 0.68 + i * r * 0.13, -hw, r * 0.05, hw * 2);

    // Steel blade with a curved cutting edge facing the swing direction
    ctx.beginPath();
    ctx.moveTo(dist - hr * 0.45, -hw * 1.1);
    ctx.lineTo(dist + hr * 0.45, -hw * 1.1);
    ctx.quadraticCurveTo(dist + hr * 0.95, hr * 0.5, dist + hr * 0.7, hr * 1.25);
    ctx.quadraticCurveTo(dist, hr * 1.7, dist - hr * 0.7, hr * 1.25);
    ctx.quadraticCurveTo(dist - hr * 0.95, hr * 0.5, dist - hr * 0.45, -hw * 1.1);
    ctx.closePath();
    const steel = ctx.createLinearGradient(dist - hr, -hw, dist + hr, hr * 1.4);
    steel.addColorStop(0, '#f4f7fb');
    steel.addColorStop(0.5, '#a7b0bd');
    steel.addColorStop(1, '#4d5562');
    ctx.fillStyle = steel;
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,24,32,0.85)';
    ctx.lineWidth = Math.max(1, r * 0.035);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(dist + hr * 0.68, hr * 1.2);
    ctx.quadraticCurveTo(dist, hr * 1.62, dist - hr * 0.68, hr * 1.2);
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = Math.max(1, r * 0.045);
    ctx.stroke();

    // Back spike
    roundedRect(dist - hr * 0.3, -hw * 1.1 - hr * 0.4, hr * 0.6, hr * 0.42, hr * 0.1);
    ctx.fillStyle = '#5d6572';
    ctx.fill();
    ctx.restore();
  }

  function drawKnife(x, y, rot, s, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(rot);
    const bl = s * 1.5;
    const bw = s * 0.3;
    ctx.beginPath();
    ctx.moveTo(0, -bw);
    ctx.lineTo(bl * 0.72, -bw * 0.85);
    ctx.lineTo(bl, 0);
    ctx.lineTo(bl * 0.7, bw * 0.6);
    ctx.lineTo(0, bw * 0.9);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -bw, 0, bw);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, '#b9c2d0');
    g.addColorStop(1, '#5a6476');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,24,34,0.8)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(90,100,118,0.7)';
    ctx.beginPath();
    ctx.moveTo(s * 0.15, -bw * 0.1);
    ctx.lineTo(bl * 0.7, -bw * 0.1);
    ctx.stroke();
    roundedRect(-s * 0.1, -bw * 1.8, s * 0.16, bw * 3.6, s * 0.05);
    ctx.fillStyle = '#c8902f';
    ctx.fill();
    roundedRect(-s * 0.72, -bw * 0.7, s * 0.62, bw * 1.4, bw * 0.5);
    ctx.fillStyle = '#5a3416';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,160,0.35)';
    for (let i = 0; i < 3; i++) {
      const hx = -s * 0.62 + i * s * 0.17;
      ctx.beginPath();
      ctx.moveTo(hx, -bw * 0.7);
      ctx.lineTo(hx + s * 0.08, bw * 0.7);
      ctx.stroke();
    }
    ctx.fillStyle = '#c8902f';
    ctx.beginPath();
    ctx.arc(-s * 0.78, 0, bw * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawApple(x, y, ar, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(ar * 0.15, ar * 0.95, ar * 0.9, ar * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(rot);
    const g = ctx.createRadialGradient(-ar * 0.35, -ar * 0.35, ar * 0.05, 0, 0, ar * 1.05);
    g.addColorStop(0, '#ffb0a0');
    g.addColorStop(0.4, '#ef2b34');
    g.addColorStop(1, '#5c0309');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -ar * 0.72);
    ctx.bezierCurveTo(ar * 0.5, -ar * 1.05, ar * 1.15, -ar * 0.6, ar * 0.98, ar * 0.12);
    ctx.bezierCurveTo(ar * 0.86, ar * 0.78, ar * 0.4, ar * 1.02, 0, ar * 0.86);
    ctx.bezierCurveTo(-ar * 0.4, ar * 1.02, -ar * 0.86, ar * 0.78, -ar * 0.98, ar * 0.12);
    ctx.bezierCurveTo(-ar * 1.15, -ar * 0.6, -ar * 0.5, -ar * 1.05, 0, -ar * 0.72);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,0,6,0.6)';
    ctx.lineWidth = Math.max(1, ar * 0.08);
    ctx.stroke();
    ctx.strokeStyle = '#6b3d16';
    ctx.lineWidth = Math.max(1.2, ar * 0.14);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -ar * 0.66);
    ctx.quadraticCurveTo(ar * 0.05, -ar * 1.0, ar * 0.2, -ar * 1.18);
    ctx.stroke();
    ctx.save();
    ctx.translate(ar * 0.22, -ar * 0.98);
    ctx.rotate(-0.5);
    const lg = ctx.createLinearGradient(0, -ar * 0.2, 0, ar * 0.2);
    lg.addColorStop(0, '#b8f07a');
    lg.addColorStop(1, '#3a8a20');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(ar * 0.3, -ar * 0.24, ar * 0.62, 0);
    ctx.quadraticCurveTo(ar * 0.3, ar * 0.24, 0, 0);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.ellipse(-ar * 0.4, -ar * 0.3, ar * 0.18, ar * 0.1, -0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBatch4Floor() {
    // Frost trail: icy discs with a snowflake etched in each
    for (const p of frostPatches) {
      const grow = Math.min(1, p.age / 0.25);
      const fade = p.age > p.life - 0.8 ? Math.max(0, (p.life - p.age) / 0.8) : 1;
      if (fade <= 0) continue;
      const R = p.owner.r * 0.62 * (0.5 + grow * 0.5);
      ctx.save();
      ctx.globalAlpha = fade;
      const glow = ctx.createRadialGradient(p.x, p.y, R * 0.2, p.x, p.y, R * 1.35);
      glow.addColorStop(0, 'rgba(210,240,255,0.32)');
      glow.addColorStop(1, 'rgba(210,240,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, R * 1.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(225,244,255,0.2)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.lineCap = 'round';
      flakePath(0, 0, R * 0.8);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawBatch4Effects() {
    for (const k of knives) {
      if (k.stuck <= 0) {
        ctx.strokeStyle = 'rgba(220,228,240,0.25)';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(k.x - k.vx * 0.035, k.y - k.vy * 0.035);
        ctx.lineTo(k.x, k.y);
        ctx.stroke();
      }
      const fade = k.stuck > 0 ? Math.min(1, k.stuck / 0.3) : 1;
      drawKnife(k.x, k.y, k.rot, k.owner.r * 0.3, fade);
    }
    for (const ap of apples) drawApple(ap.x, ap.y, ap.owner.r * 0.27, ap.rot);
    for (const sl of axeSlashes) {
      const t = sl.age / sl.life;
      ctx.save();
      ctx.globalAlpha = 1 - t;
      ctx.translate(sl.x, sl.y);
      ctx.rotate(sl.a);
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,170,150,0.55)';
      ctx.lineWidth = (1 - t) * 10 + 2;
      ctx.beginPath();
      ctx.arc(0, 0, sl.r * (0.55 + t * 0.4), 0.2, Math.PI - 0.2);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = (1 - t) * 4 + 1;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawIceOverlay(b) {
    const t = Math.min(1, b.iceTimer / 0.15);
    ctx.save();
    ctx.globalAlpha = t;
    const g = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.35, b.r * 0.1, b.x, b.y, b.r * 1.12);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.6, 'rgba(190,230,255,0.35)');
    g.addColorStop(1, 'rgba(120,190,240,0.55)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 1.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    for (let i = 0; i < 7; i++) {
      const a = i * Math.PI * 2 / 7 + 0.3;
      const len = b.r * (i % 2 ? 1.32 : 1.45);
      ctx.beginPath();
      ctx.moveTo(b.x + Math.cos(a - 0.14) * b.r, b.y + Math.sin(a - 0.14) * b.r);
      ctx.lineTo(b.x + Math.cos(a) * len, b.y + Math.sin(a) * len);
      ctx.lineTo(b.x + Math.cos(a + 0.14) * b.r, b.y + Math.sin(a + 0.14) * b.r);
      ctx.closePath();
      ctx.fillStyle = 'rgba(228,246,255,0.92)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(110,170,225,0.8)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.moveTo(b.x - b.r * 0.5, b.y - b.r * 0.2);
    ctx.lineTo(b.x - b.r * 0.1, b.y + b.r * 0.05);
    ctx.lineTo(b.x - b.r * 0.2, b.y + b.r * 0.45);
    ctx.moveTo(b.x - b.r * 0.1, b.y + b.r * 0.05);
    ctx.lineTo(b.x + b.r * 0.4, b.y - b.r * 0.1);
    ctx.stroke();
    ctx.restore();
  }

  /* ---------- geometry helpers ---------- */

  function roundedRect(x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function chamferRect(x, y, w, h, c) {
    const ch = Math.min(c, w * 0.35, h * 0.45);
    ctx.beginPath();
    ctx.moveTo(x + ch, y);
    ctx.lineTo(x + w - ch, y);
    ctx.lineTo(x + w, y + ch);
    ctx.lineTo(x + w, y + h - ch);
    ctx.lineTo(x + w - ch, y + h);
    ctx.lineTo(x + ch, y + h);
    ctx.lineTo(x, y + h - ch);
    ctx.lineTo(x, y + ch);
    ctx.closePath();
  }

  function closestPointOnSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 0.0001) return { x: x1, y: y1, dist: Math.hypot(px - x1, py - y1) };
    const t = clamp(((px - x1) * dx + (py - y1) * dy) / lenSq, 0, 1);
    const cx = x1 + dx * t;
    const cy = y1 + dy * t;
    return { x: cx, y: cy, dist: Math.hypot(px - cx, py - cy) };
  }

  /* ---------- arena & background drawing ---------- */

  // Static background: the deep gradient plus each side's ambient glow
  function paintArenaBg() {
    // Deep background with soft side ambient glows matching each player's chosen ball
    const bg = ctx.createRadialGradient(W * 0.5, H * 0.48, 20, W * 0.5, H * 0.5, Math.max(W, H) * 0.78);
    bg.addColorStop(0, '#14192a');
    bg.addColorStop(1, '#06070d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const sideR = Math.max(W, H) * 0.44;
    const leftAura = ctx.createRadialGradient(arena.x, arena.y + arena.h * 0.5, 10, arena.x, arena.y + arena.h * 0.5, sideR);
    leftAura.addColorStop(0, rgba(red.color, 0.14));
    leftAura.addColorStop(1, rgba(red.color, 0));
    ctx.fillStyle = leftAura;
    ctx.fillRect(0, 0, W, H);

    const rightAura = ctx.createRadialGradient(arena.x + arena.w, arena.y + arena.h * 0.5, 10, arena.x + arena.w, arena.y + arena.h * 0.5, sideR);
    rightAura.addColorStop(0, rgba(blue.color, 0.14));
    rightAura.addColorStop(1, rgba(blue.color, 0));
    ctx.fillStyle = rightAura;
    ctx.fillRect(0, 0, W, H);

  }

  // Static arena: recessed floor, tiles, markings, vignette and beveled border
  function paintArenaFloor() {
    // Outer recessed frame shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.75)';
    ctx.shadowBlur = 32;
    ctx.shadowOffsetY = 10;
    roundedRect(arena.x, arena.y, arena.w, arena.h, arena.r);
    const floor = ctx.createRadialGradient(
      arena.x + arena.w * 0.5, arena.y + arena.h * 0.45, 20,
      arena.x + arena.w * 0.5, arena.y + arena.h * 0.5, Math.max(arena.w, arena.h) * 0.75
    );
    floor.addColorStop(0, '#131829');
    floor.addColorStop(1, '#090b14');
    ctx.fillStyle = floor;
    ctx.fill();
    ctx.restore();

    // Arena floor tiles & court markings
    ctx.save();
    roundedRect(arena.x, arena.y, arena.w, arena.h, arena.r);
    ctx.clip();

    const step = clamp(Math.min(arena.w, arena.h) / 8, 36, 68);
    ctx.strokeStyle = 'rgba(255,255,255,0.032)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const cx = arena.x + arena.w * 0.5;
    const cy = arena.y + arena.h * 0.5;
    for (let x = cx % step; x < arena.x + arena.w; x += step) {
      if (x > arena.x) { ctx.moveTo(x, arena.y); ctx.lineTo(x, arena.y + arena.h); }
    }
    for (let y = cy % step; y < arena.y + arena.h; y += step) {
      if (y > arena.y) { ctx.moveTo(arena.x, y); ctx.lineTo(arena.x + arena.w, y); }
    }
    ctx.stroke();

    // Subtle center duel circle & divider
    ctx.strokeStyle = 'rgba(255,255,255,0.055)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, arena.y + 18);
    ctx.lineTo(cx, arena.y + arena.h - 18);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(arena.w, arena.h) * 0.16, 0, Math.PI * 2);
    ctx.stroke();

    // Inner vignette edge
    const innerEdge = ctx.createRadialGradient(cx, cy, Math.min(arena.w, arena.h) * 0.35, cx, cy, Math.max(arena.w, arena.h) * 0.72);
    innerEdge.addColorStop(0, 'rgba(0,0,0,0)');
    innerEdge.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = innerEdge;
    ctx.fillRect(arena.x, arena.y, arena.w, arena.h);

    ctx.restore();

    // Crisp beveled arena border
    const borderGrad = ctx.createLinearGradient(arena.x, arena.y, arena.x + arena.w, arena.y);
    borderGrad.addColorStop(0, rgba(red.color, 0.5));
    borderGrad.addColorStop(0.5, 'rgba(180,198,240,0.22)');
    borderGrad.addColorStop(1, rgba(blue.color, 0.5));
    roundedRect(arena.x, arena.y, arena.w, arena.h, arena.r);
    ctx.strokeStyle = borderGrad;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    roundedRect(arena.x + 2, arena.y + 2, arena.w - 4, arena.h - 4, Math.max(2, arena.r - 2));
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

  }

  function drawArena() {
    const sig = `${W}|${H}|${dpr}|${arena.x},${arena.y},${arena.w},${arena.h},${arena.r}`
      + `|${rgba(red.color, 1)}|${rgba(blue.color, 1)}`;
    ctx.drawImage(bakeLayer('bg', sig, W, H, paintArenaBg), 0, 0, W, H);

    ctx.save();
    ctx.translate(shake.x, shake.y);
    ctx.drawImage(bakeLayer('floor', sig, W, H, paintArenaFloor), 0, 0, W, H);

    // Wall impact ripple glows are the only part that changes every frame
    if (wallPulses.length) {
      ctx.save();
      roundedRect(arena.x, arena.y, arena.w, arena.h, arena.r);
      ctx.clip();
      if (quality > 0.7) {
    for (const wp of wallPulses) {
      const t = wp.age / wp.life;
      const rad = 24 + t * 95;
      const g = ctx.createRadialGradient(wp.x, wp.y, 0, wp.x, wp.y, rad);
      g.addColorStop(0, rgba(wp.color, (1 - t) * 0.65));
      g.addColorStop(1, rgba(wp.color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(wp.x - rad, wp.y - rad, rad * 2, rad * 2);
    }

      } else {
        for (const wp of wallPulses) {
          const t = wp.age / wp.life;
          ctx.beginPath();
          ctx.arc(wp.x, wp.y, 24 + t * 95, 0, Math.PI * 2);
          ctx.strokeStyle = rgba(wp.color, (1 - t) * 0.5);
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    ctx.restore();
  }

  /* ---------- persistent arena abilities (Laser grids, Vampire tether) ---------- */

  function drawLaserBeam(c, x1, y1, x2, y2, color, accent, alpha, flash, isLive) {
    if (alpha <= 0) return;
    c.save();
    c.lineCap = 'round';
    c.globalAlpha = alpha;

    // Single wide translucent stroke gives the neon bloom without per-beam blur cost
    c.strokeStyle = rgba(color, isLive ? 0.4 : 0.55);
    c.lineWidth = (isLive ? 11 : 15) + flash * 6;
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();

    c.strokeStyle = rgba(color, isLive ? 0.75 : 0.95);
    c.lineWidth = (isLive ? 5 : 7) + flash * 5;
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();

    c.strokeStyle = rgba(accent, 0.95);
    c.lineWidth = (isLive ? 2.4 : 3.4) + flash * 2.5;
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();

    c.strokeStyle = 'rgba(255,255,255,0.92)';
    c.lineWidth = 1.3 + flash * 1.4;
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();

    c.restore();
  }

  function drawLaserNode(c, x, y, color, accent, alpha) {
    if (alpha <= 0) return;
    c.save();
    c.globalAlpha = alpha;
    c.fillStyle = rgba(color, 1);
    c.beginPath();
    c.arc(x, y, 4.6, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(x, y, 2.1, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  // Persistent laser beams are expensive to shade every frame, so bake them
  // into an offscreen canvas and only rebuild when the grid actually changes.
  function rebuildLaserCache() {
    laserCacheDirty = false;
    const aw = Math.max(1, Math.round(arena.w));
    const ah = Math.max(1, Math.round(arena.h));
    if (!laserCanvas) {
      laserCanvas = document.createElement('canvas');
      laserCtx = laserCanvas.getContext('2d');
    }
    if (laserCanvas.width !== aw || laserCanvas.height !== ah) {
      laserCanvas.width = aw;
      laserCanvas.height = ah;
    }
    laserCtx.clearRect(0, 0, aw, ah);
    laserCtx.save();
    laserCtx.translate(-arena.x, -arena.y);
    let drawn = 0;
    for (const b of balls) {
      if (b.type !== 'laser') continue;
      for (const l of b.lasers) {
        if (l.fadeOut > 0) continue;
        drawLaserBeam(laserCtx, l.x1, l.y1, l.x2, l.y2, b.color, b.accent, 1, 0, false);
        drawLaserNode(laserCtx, l.x1, l.y1, b.color, b.accent, 1);
        drawLaserNode(laserCtx, l.x2, l.y2, b.color, b.accent, 1);
        drawn++;
      }
    }
    laserCtx.restore();
    laserCanvas._has = drawn > 0;
  }

  function drawArenaAbilities() {
    ctx.save();
    roundedRect(arena.x, arena.y, arena.w, arena.h, arena.r);
    ctx.clip();

    // Zones, shackle traps and bombs sit on the arena floor under everything else
    drawExtraFloor();
    drawBatch3Floor();
    drawBatch4Floor();
    drawHarpoon();
    drawBvbTrio();
    drawFiveBalls();
    drawBatchSix();
    animeRivals.draw(ctx, clock, quality);
    drawGojo();

    // Poison Spike wall thorns
    for (const patch of poisonPatches) {
      const fadeIn = Math.min(1, patch.age / 0.22);
      const fadeOut = Math.min(1, Math.max(0, patch.life - patch.age) / 0.45);
      const a = fadeIn * fadeOut;
      if (a <= 0) continue;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(patch.x, patch.y);
      ctx.rotate(patch.angle);

      const rad = 22 + Math.sin(clock * 3.2 + patch.seed) * 3;
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, rad);
      glow.addColorStop(0, 'rgba(140,255,90,0.34)');
      glow.addColorStop(1, 'rgba(140,255,90,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(-rad, -rad, rad * 2, rad * 2);

      for (let i = -1; i <= 1; i++) {
        const off = i * 6.5;
        const len = (i === 0 ? 25 : 18) + patch.seed % 4;
        ctx.beginPath();
        ctx.moveTo(-3, off - 4.5);
        ctx.quadraticCurveTo(len * 0.55, off - 2.4, len, off + i * 1.5);
        ctx.quadraticCurveTo(len * 0.5, off + 2.8, -3, off + 4.5);
        ctx.closePath();
        const blade = ctx.createLinearGradient(0, off, len, off);
        blade.addColorStop(0, '#1d4d1c');
        blade.addColorStop(0.55, '#63c94a');
        blade.addColorStop(1, '#d9ffae');
        ctx.fillStyle = blade;
        ctx.fill();
        ctx.strokeStyle = 'rgba(24,66,20,0.8)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(214,255,150,0.9)';
      ctx.beginPath();
      ctx.arc(2, 0, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Ability readiness rings make the cooldown kits readable at a glance
    for (const b of balls) {
      if (!b.alive || phase !== 'play') continue;
      let ratio = -1;
      let ringColor = rgba(b.accent, 1);
      if (b.type === 'electric') {
        ratio = 1 - clamp(b.shockCooldown / 2.8, 0, 1);
      } else if (b.type === 'burst') {
        ratio = b.dashActive ? 1 : clamp(b.dashTimer / 4.2, 0, 1);
        ringColor = '#ffed4e';
      }
      if (ratio < 0) continue;
      ctx.save();
      ctx.globalAlpha = ratio >= 1 ? 0.95 : 0.4 + ratio * 0.35;
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = Math.max(2, b.r * 0.07);
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 1.34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = ringColor;
      ctx.shadowColor = ringColor;
      ctx.shadowBlur = ratio >= 1 ? 10 : 0;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 1.34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
      ctx.stroke();
      ctx.restore();
    }

    // Laser Ball grids: baked into a lightweight offscreen layer
    if (laserCacheDirty) rebuildLaserCache();
    if (laserCanvas && laserCanvas._has) ctx.drawImage(laserCanvas, arena.x, arena.y);

    for (const b of balls) {
      if (b.type !== 'laser') continue;
      for (const l of b.lasers) {
        if (l.fadeOut > 0) {
          const a = Math.min(1, l.age / 0.14) * Math.max(0, 1 - l.fadeOut / 0.4);
          drawLaserBeam(ctx, l.x1, l.y1, l.x2, l.y2, b.color, b.accent, a, 0, false);
          drawLaserNode(ctx, l.x1, l.y1, b.color, b.accent, a);
          drawLaserNode(ctx, l.x2, l.y2, b.color, b.accent, a);
        }
      }
      if (b.alive && b.laserAnchor && phase === 'play') {
        const pulse = 0.7 + Math.sin(clock * 16) * 0.16;
        drawLaserBeam(ctx, b.laserAnchor.x, b.laserAnchor.y, b.x, b.y, b.color, b.accent, pulse, 0, true);
        drawLaserNode(ctx, b.laserAnchor.x, b.laserAnchor.y, b.color, b.accent, 0.95);
      }
    }

    // Motion trails behind moving balls
    for (const b of balls) {
      if (!b.alive || b.trail.length < 2) continue;
      for (let i = 1; i < b.trail.length; i++) {
        const p0 = b.trail[i - 1], p1 = b.trail[i];
        const t = i / b.trail.length;
        ctx.save();
        ctx.strokeStyle = rgba(b.type === 'blade' ? b.accent : b.color, t * 0.24);
        ctx.lineWidth = b.r * 1.15 * t;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Vampire Latch crimson siphon tether
    if (latch && latch.attacker.alive && latch.target.alive) {
      const a = latch.attacker, t = latch.target;
      const pulse = 0.75 + Math.sin(clock * 24) * 0.25;
      ctx.save();
      ctx.shadowColor = 'rgba(255,35,65,0.95)';
      ctx.shadowBlur = 18;
      ctx.strokeStyle = `rgba(207,36,44,${0.85 * pulse})`;
      ctx.lineWidth = a.r * 0.26;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(t.x, t.y);
      ctx.stroke();

      ctx.strokeStyle = `rgba(255,195,205,${0.9 * pulse})`;
      ctx.lineWidth = a.r * 0.09;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(t.x, t.y);
      ctx.stroke();
      ctx.restore();
    }

    // Siphon blood motes flying from target into Vampire
    for (const m of siphonMotes) {
      const u = clamp(m.age / m.life, 0, 1);
      const ease = u * u * (3 - 2 * u);
      const mx = m.sx + (m.target.x - m.sx) * ease + Math.sin(u * Math.PI) * m.arcX;
      const my = m.sy + (m.target.y - m.sy) * ease + Math.sin(u * Math.PI) * m.arcY;
      ctx.save();
      ctx.shadowColor = 'rgba(255,40,70,0.95)';
      ctx.shadowBlur = 10;
      ctx.fillStyle = u > 0.65 ? '#ffb5c2' : '#ff2e4c';
      ctx.beginPath();
      ctx.arc(mx, my, 3.2 + Math.sin(u * Math.PI) * 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  /* ---------- custom 3D ball renderers ---------- */

  /* ---------- polished renderers for the four newer balls ---------- */

  const FRESH_TYPES = new Set(['glass', 'electric', 'burst', 'poison', 'shackles', 'machine', 'fibonacci', 'bomb', 'zone', 'spider', 'snake', 'cannon', 'dice', 'hive', 'thief', 'axe', 'charge', 'frost', 'apple', 'harpoon', 'beam', 'spear', 'reforge', 'chess', 'verity', 'cactus', 'range', 'electroking', 'acid', 'bigspike', 'cell', 'wdc', 'hook', 'gojo']);

  function isFresh(type) {
    return FRESH_TYPES.has(type) || Object.hasOwn(ANIME_TYPES, type);
  }

  const FRESH_STOPS = {
    glass: ['#ffffff', '#d6fdf8', '#8adfda', '#1e6f80'],
    electric: ['#39c8ff', '#20aaf0', '#0c8bd7', '#075aa3'],
    burst: ['#fffad2', '#ffc63a', '#ef7724', '#7a2203'],
    poison: ['#f4ffd9', '#bff08a', '#5aa63b', '#143d13'],
    shackles: ['#efe6ff', '#a98bff', '#5b35c2', '#1b0d45'],
    machine: ['#eef0e2', '#9aa47c', '#525a3a', '#191d10'],
    fibonacci: ['#c9d0ff', '#6b76c4', '#2d3a86', '#0d1240'],
    bomb: ['#c6aef0', '#7552a8', '#3a1f60', '#12061f'],
    zone: ['#ffd4d8', '#ff6878', '#d1142e', '#4d0410'],
    spider: ['#ff8a8a', '#e3343d', '#a8121c', '#3d0408'],
    snake: ['#d8f7a8', '#5fbf4a', '#23743a', '#0a2a14'],
    cannon: ['#c9ccd6', '#6c7080', '#33363f', '#0b0c10'],
    dice: ['#ffffff', '#f6f2e8', '#d8d1c0', '#857c6a'],
    hive: ['#fff2b8', '#ffc83d', '#d9860b', '#5a2c02'],
    thief: ['#b9bfd8', '#5a6185', '#2a2f48', '#0b0d17'],
    axe: ['#ff9a8a', '#d23a2c', '#8a1810', '#2c0503'],
    charge: ['#ffd6f0', '#ff4fb8', '#a8126f', '#3a0426'],
    frost: ['#ffffff', '#cdeeff', '#7cbde8', '#1f5a8f'],
    apple: ['#ff9a8a', '#ef2b34', '#a3101c', '#3f0208'],
    harpoon: ['#e8fbff', '#7fd8e8', '#1a7a8f', '#04222e'],
    beam: ['#aaffff', '#2fe8ea', '#1ca8b8', '#1a5f66'],
    spear: ['#d8dde6', '#8c94a6', '#697182', '#2e323c'],
    reforge: ['#fff6b0', '#f5de48', '#eccf21', '#8a6a06'],
    chess: ['#eceff4', '#9aa3b2', '#2b3140', '#0b0d12'],
    verity: ['#fffbb0', '#f6f23f', '#c9c71f', '#6f7110'],
    cactus: ['#e6f9b8', '#97cb46', '#5e8f2a', '#2c4a12'],
    range: ['#fffbe0', '#f2dc58', '#d9b82a', '#8a6a10'],
    electroking: ['#5a7bd0', '#1f3c8c', '#122563', '#050c24'],
    acid: ['#e4ffb8', '#8ee63a', '#65cb1f', '#2c6a0c'],
    bigspike: ['#ffffff', '#d6dbe4', '#9aa2b0', '#4b5260'],
    cell: ['#f2ffe0', '#bfe087', '#8dd68c', '#3f7a45'],
    wdc: ['#8fb2ff', '#2f5fe0', '#1349da', '#061a5c'],
    hook: ['#e6ecf5', '#9aa6b8', '#5c687a', '#222834'],
    gojo: ['#fff4ea', '#f6dcc6', '#e3b897', '#7a4e36']
  };

  function freshStops(type) {
    return FRESH_STOPS[type] || FRESH_STOPS.poison;
  }

  const FRESH_ACCENT = {
    glass: '#eafffd', electric: '#d9ffff', burst: '#ffed4e', poison: '#d8ff9c',
    shackles: '#e2e8f5', machine: '#ffc450', fibonacci: '#efdc7d', bomb: '#ffaa3c', zone: '#ffd0d4',
    spider: '#ffffff', snake: '#c6ff7a', cannon: '#e8b45a', dice: '#ff4a4a', hive: '#ffd34d',
    thief: '#e8ecf5', axe: '#e6ecf2', charge: '#ffffff', frost: '#ffffff', apple: '#7ccf4a',
    harpoon: '#d2f4ff', beam: '#aaffff', spear: '#94fe03', reforge: '#e7ebf0',
    chess: '#eceff4', verity: '#f1f33c', cactus: '#eed128', range: '#f2dc58', electroking: '#96f0ff',
    acid: '#a8f04a', bigspike: '#eef2f8', cell: '#deecbd', wdc: '#f3f5f9', hook: '#e2ce9e', gojo: '#b478ff'
  };

  function freshAccent(type) {
    return FRESH_ACCENT[type] || '#ffffff';
  }

  function boltEmblemPath(x, y, s, squash) {
    ctx.beginPath();
    ctx.moveTo(x + s * 0.52, y - s * 0.79 * squash);
    ctx.lineTo(x - s * 0.38, y - s * 0.18 * squash);
    ctx.lineTo(x - s * 0.16, y + s * 0.01 * squash);
    ctx.lineTo(x - s * 0.55, y + s * 0.79 * squash);
    ctx.lineTo(x + s * 0.38, y + s * 0.08 * squash);
    ctx.lineTo(x + s * 0.12, y - s * 0.12 * squash);
    ctx.closePath();
  }

  function drawFreshBall(o) {
    const {
      x, y, r, type, color, dark, accent, glow,
      hit, hitAngle, healPulse, morphPulse,
      isMini, side, dashActive, frozen, health,
      gunAngle, gunKick, fibStep
    } = o;

    const haloR = r * (isMini ? 1.7 : 2.1);
    const aura = ctx.createRadialGradient(x, y, r * 0.3, x, y, haloR);
    aura.addColorStop(0, rgba(glow || color, (isMini ? 0.16 : 0.2) + (hit || 0) * 0.14));
    aura.addColorStop(1, rgba(glow || color, 0));
    ctx.fillStyle = aura;
    ctx.fillRect(x - haloR, y - haloR, haloR * 2, haloR * 2);

    if (!isMini && type !== 'electric') {
      ctx.save();
      ctx.strokeStyle = rgba(color, 0.3);
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(x, y, r * 1.18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(x, y);
    if (morphPulse > 0) {
      const ms = 1 + Math.sin(morphPulse * Math.PI) * 0.16;
      ctx.scale(ms, ms);
    }
    if (hit > 0) {
      ctx.rotate(hitAngle || 0);
      ctx.scale(1 - hit * 0.1, 1 + hit * 0.06);
      ctx.rotate(-(hitAngle || 0));
    }
    ctx.translate(-x, -y);

    // Ground shadow
    ctx.save();
    ctx.globalAlpha = isMini ? 0.28 : 0.36;
    const sh = ctx.createRadialGradient(x + r * 0.18, y + r * 0.95, r * 0.05, x + r * 0.18, y + r * 0.95, r * 1.1);
    sh.addColorStop(0, 'rgba(0,0,0,0.9)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh;
    ctx.beginPath();
    ctx.ellipse(x + r * 0.18, y + r * 0.95, r, r * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Machine Gun barrel sits behind the sphere and tracks the target
    if (type === 'machine') {
      const ga = gunAngle === undefined ? -0.6 : gunAngle;
      const kick = (gunKick || 0) * r * 0.16;
      const bw = r * 0.2;
      const bx0 = r * 0.3 - kick;
      const bx1 = r * 1.5 - kick;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ga);
      const barrel = ctx.createLinearGradient(0, -bw, 0, bw);
      barrel.addColorStop(0, '#d7dccb');
      barrel.addColorStop(0.45, '#6f775a');
      barrel.addColorStop(1, '#22261a');
      roundedRect(bx0, -bw, bx1 - bx0, bw * 2, bw * 0.6);
      ctx.fillStyle = barrel;
      ctx.fill();
      ctx.strokeStyle = 'rgba(12,14,8,0.85)';
      ctx.lineWidth = Math.max(1, r * 0.04);
      ctx.stroke();
      ctx.fillStyle = 'rgba(18,22,12,0.55)';
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(bx0 + (bx1 - bx0) * (0.5 + i * 0.13), -bw, Math.max(1, r * 0.05), bw * 2);
      }
      const muzzle = ctx.createLinearGradient(0, -bw * 1.25, 0, bw * 1.25);
      muzzle.addColorStop(0, '#fff2c4');
      muzzle.addColorStop(0.5, '#e6a536');
      muzzle.addColorStop(1, '#73470e');
      roundedRect(bx1 - r * 0.18, -bw * 1.22, r * 0.22, bw * 2.44, r * 0.05);
      ctx.fillStyle = muzzle;
      ctx.fill();
      ctx.restore();
    }

    // Axe orbits behind the sphere so the handle tucks under the ball
    if (type === 'axe') drawAxeWeapon(x, y, r, o.axeAngle === undefined ? -0.8 : o.axeAngle, isMini);

    // Spear Ball: an iron spear fixed to its side (wiki: iron spear attached to its right side)
    if (type === 'spear') drawSpearWeapon(x, y, r, o.facing === undefined ? -0.5 : o.facing, isMini, o.spearBoost || 0);

    if (Object.hasOwn(ANIME_TYPES, type)) {
      const aForm = o.ref?.anime?.form ?? 0;
      const pForm = portraitFormFor(type, o.ref?.anime);
      drawAnimeAura(ctx, x, y, r, type, aForm, clock, quality, isMini);
      if (isMini) drawAnimePortrait(ctx, x, y, r, type, pForm);
      else drawBaked(`rival:${type}:${pForm}`, r, x, y, 1,
        (cx, cy, rr) => drawAnimePortrait(ctx, cx, cy, rr, type, pForm));
    } else {
      // Clean glossy sphere
      const stops = freshStops(type);
      const g = type === 'electric'
        ? ctx.createRadialGradient(x - r * 0.08, y - r * 0.14, r * 0.04, x, y, r * 1.02)
        : ctx.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.04, x, y, r * 1.02);
      g.addColorStop(0, stops[0]);
      g.addColorStop(0.3, stops[1]);
      g.addColorStop(0.72, stops[2]);
      g.addColorStop(1, stops[3]);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Emblem / inner detail clipped to the sphere
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();

    if (type === 'glass') {
      // Soft crystal facets + sweeping glint
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.beginPath();
      ctx.moveTo(x - r * 0.92, y - r * 0.3);
      ctx.lineTo(x - r * 0.1, y - r * 0.92);
      ctx.lineTo(x + r * 0.2, y + r * 0.05);
      ctx.lineTo(x - r * 0.5, y + r * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.42)';
      ctx.lineWidth = Math.max(1, r * 0.035);
      ctx.beginPath();
      ctx.moveTo(x - r * 0.55, y + r * 0.55);
      ctx.lineTo(x + r * 0.1, y - r * 0.1);
      ctx.lineTo(x + r * 0.62, y - r * 0.24);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.moveTo(x - r * 0.1, y - r * 0.1);
      ctx.lineTo(x + r * 0.18, y - r * 0.52);
      ctx.lineTo(x + r * 0.3, y - r * 0.12);
      ctx.closePath();
      ctx.fill();
    } else if (type === 'electric') {
      // The reference uses a large white bolt glowing through a blue sphere.
      const charge = ctx.createRadialGradient(x, y, 0, x, y, r * 0.76);
      charge.addColorStop(0, 'rgba(120,250,255,0.4)');
      charge.addColorStop(1, 'rgba(24,178,248,0)');
      ctx.fillStyle = charge;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);

      ctx.save();
      ctx.shadowColor = 'rgba(125,248,255,0.95)';
      ctx.shadowBlur = r * 0.32;
      boltEmblemPath(x, y, r * 0.98, 1);
      const bolt = ctx.createLinearGradient(x - r * 0.5, y + r * 0.75, x + r * 0.5, y - r * 0.75);
      bolt.addColorStop(0, '#b3ffff');
      bolt.addColorStop(0.5, '#eaffff');
      bolt.addColorStop(1, '#ffffff');
      ctx.fillStyle = bolt;
      ctx.fill();
      ctx.restore();
    } else if (type === 'burst') {
      // Official yellow cross emblem
      ctx.save();
      ctx.shadowColor = 'rgba(255,237,78,0.85)';
      ctx.shadowBlur = r * 0.38;
      const bar = r * 0.46;
      const len = r * 0.74;
      const cg = ctx.createLinearGradient(x, y - len, x, y + len);
      cg.addColorStop(0, '#fffbd6');
      cg.addColorStop(0.5, '#ffed4e');
      cg.addColorStop(1, '#ffb01f');
      const half = bar * 0.5;
      ctx.beginPath();
      ctx.moveTo(x - half, y - len);
      ctx.lineTo(x + half, y - len);
      ctx.lineTo(x + half, y - half);
      ctx.lineTo(x + len, y - half);
      ctx.lineTo(x + len, y + half);
      ctx.lineTo(x + half, y + half);
      ctx.lineTo(x + half, y + len);
      ctx.lineTo(x - half, y + len);
      ctx.lineTo(x - half, y + half);
      ctx.lineTo(x - len, y + half);
      ctx.lineTo(x - len, y - half);
      ctx.lineTo(x - half, y - half);
      ctx.closePath();
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(122,34,3,0.5)';
      ctx.lineWidth = Math.max(1, r * 0.03);
      ctx.stroke();
      ctx.fillStyle = cg;
      ctx.fill();
      ctx.restore();
      // Warm core bloom
      const heat = ctx.createRadialGradient(x, y, 0, x, y, r);
      heat.addColorStop(0, 'rgba(255,246,180,0.34)');
      heat.addColorStop(1, 'rgba(239,119,36,0)');
      ctx.fillStyle = heat;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    } else if (type === 'poison') {
      // Glossy toxic bubbles
      for (let i = 0; i < 3; i++) {
        const bx = x + Math.cos(i * 2.4 + 0.4) * r * 0.42;
        const by = y + Math.sin(i * 2.4 + 0.4) * r * 0.38;
        const br = r * (0.2 - i * 0.03);
        const bub = ctx.createRadialGradient(bx - br * 0.3, by - br * 0.35, 0, bx, by, br);
        bub.addColorStop(0, 'rgba(240,255,200,0.75)');
        bub.addColorStop(0.6, 'rgba(120,200,70,0.32)');
        bub.addColorStop(1, 'rgba(26,74,24,0.45)');
        ctx.fillStyle = bub;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(216,255,156,0.32)';
      ctx.lineWidth = Math.max(1, r * 0.03);
      ctx.beginPath();
      ctx.arc(x, y, r * 0.82, 0.6, 2.3);
      ctx.stroke();
    } else if (type === 'shackles') {
      // Tilted steel cuff wrapped around the sphere
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.42);
      ctx.beginPath();
      ctx.ellipse(0, r * 0.08, r * 1.08, r * 0.36, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(18,10,40,0.8)';
      ctx.lineWidth = r * 0.42;
      ctx.stroke();
      const band = ctx.createLinearGradient(0, -r * 0.3, 0, r * 0.46);
      band.addColorStop(0, '#ffffff');
      band.addColorStop(0.45, '#b2bacb');
      band.addColorStop(1, '#4b5366');
      ctx.strokeStyle = band;
      ctx.lineWidth = r * 0.28;
      ctx.stroke();
      ctx.fillStyle = '#3b3156';
      for (const t of [-0.6, 0, 0.6]) {
        const a = Math.PI / 2 + t;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 1.08, r * 0.08 + Math.sin(a) * r * 0.36, r * 0.06, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      const core = ctx.createRadialGradient(x, y - r * 0.3, 0, x, y - r * 0.3, r * 0.62);
      core.addColorStop(0, 'rgba(226,200,255,0.42)');
      core.addColorStop(1, 'rgba(139,92,246,0)');
      ctx.fillStyle = core;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    } else if (type === 'machine') {
      // Armor plating and rivets
      ctx.strokeStyle = 'rgba(16,20,10,0.45)';
      ctx.lineWidth = Math.max(1, r * 0.045);
      ctx.beginPath();
      ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(236,240,220,0.8)';
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3 + 0.3;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * r * 0.79, y + Math.sin(a) * r * 0.79, r * 0.055, 0, Math.PI * 2);
        ctx.fill();
      }
      const core = ctx.createRadialGradient(x - r * 0.15, y - r * 0.15, 0, x, y, r * 0.55);
      core.addColorStop(0, 'rgba(255,224,150,0.42)');
      core.addColorStop(1, 'rgba(255,180,60,0)');
      ctx.fillStyle = core;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    } else if (type === 'fibonacci') {
      // Faint golden spiral behind the official golden phi
      ctx.strokeStyle = 'rgba(239,220,125,0.26)';
      ctx.lineWidth = Math.max(1, r * 0.035);
      ctx.beginPath();
      for (let i = 0; i <= 64; i++) {
        const th = (i / 64) * Math.PI * 3.6;
        const rr = r * 0.035 * Math.exp(0.30635 * th);
        const px = x + Math.cos(th + 2.2) * rr;
        const py = y + Math.sin(th + 2.2) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      const phi = () => {
        ctx.beginPath();
        ctx.ellipse(x, y, r * 0.31, r * 0.27, 0, 0, Math.PI * 2);
        ctx.moveTo(x, y - r * 0.62);
        ctx.lineTo(x, y + r * 0.62);
      };
      ctx.lineCap = 'round';
      phi();
      ctx.strokeStyle = 'rgba(8,12,40,0.6)';
      ctx.lineWidth = r * 0.18;
      ctx.stroke();
      const gold = ctx.createLinearGradient(x, y - r * 0.62, x, y + r * 0.62);
      gold.addColorStop(0, '#fff6c9');
      gold.addColorStop(0.5, '#efdc7d');
      gold.addColorStop(1, '#b38e2a');
      phi();
      ctx.strokeStyle = gold;
      ctx.lineWidth = r * 0.11;
      ctx.stroke();
    } else if (type === 'bomb') {
      // Official look: sharp triangular white eyes
      for (const sgn of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x + sgn * r * 0.62, y - r * 0.5);
        ctx.lineTo(x + sgn * r * 0.14, y - r * 0.26);
        ctx.lineTo(x + sgn * r * 0.5, y - r * 0.08);
        ctx.closePath();
        const eye = ctx.createLinearGradient(0, y - r * 0.5, 0, y - r * 0.08);
        eye.addColorStop(0, '#ffffff');
        eye.addColorStop(1, '#d8d0e8');
        ctx.fillStyle = eye;
        ctx.fill();
        ctx.strokeStyle = 'rgba(10,4,20,0.8)';
        ctx.lineWidth = Math.max(1, r * 0.04);
        ctx.stroke();
      }
    } else if (type === 'zone') {
      // Target rings with crosshair ticks
      const pulse = 0.5 + Math.sin(clock * 3) * 0.5;
      const core = ctx.createRadialGradient(x, y, 0, x, y, r * 0.55);
      core.addColorStop(0, 'rgba(255,206,210,0.45)');
      core.addColorStop(1, 'rgba(255,60,80,0)');
      ctx.fillStyle = core;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.strokeStyle = 'rgba(255,228,231,0.92)';
      ctx.lineWidth = Math.max(1.5, r * 0.07);
      ctx.beginPath();
      ctx.arc(x, y, r * 0.66, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * r * 0.74, y + Math.sin(a) * r * 0.74);
        ctx.lineTo(x + Math.cos(a) * r * 0.98, y + Math.sin(a) * r * 0.98);
        ctx.stroke();
      }
      ctx.strokeStyle = `rgba(255,228,231,${0.4 + pulse * 0.4})`;
      ctx.lineWidth = Math.max(1, r * 0.045);
      ctx.beginPath();
      ctx.arc(x, y, r * (0.4 + pulse * 0.06), 0, Math.PI * 2);
      ctx.stroke();
    } else if (type === 'spider') {
      // Official look: red ball covered in a white spiderweb
      const wx = x + r * 0.08;
      const wy = y - r * 0.06;
      ctx.strokeStyle = 'rgba(255,255,255,0.92)';
      ctx.lineWidth = Math.max(1, r * 0.045);
      ctx.lineCap = 'round';
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 + 0.2;
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.lineTo(wx + Math.cos(a) * r * 1.1, wy + Math.sin(a) * r * 1.1);
        ctx.stroke();
      }
      for (const rr of [0.26, 0.52, 0.8]) {
        ctx.beginPath();
        for (let i = 0; i <= 8; i++) {
          const a = i * Math.PI / 4 + 0.2;
          const a2 = (i + 0.5) * Math.PI / 4 + 0.2;
          const px = wx + Math.cos(a) * r * rr;
          const py = wy + Math.sin(a) * r * rr;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.quadraticCurveTo(wx + Math.cos(a2 - Math.PI / 8) * r * rr * 0.86, wy + Math.sin(a2 - Math.PI / 8) * r * rr * 0.86, px, py);
        }
        ctx.stroke();
      }
    } else if (type === 'snake') {
      // Overlapping scales and a pair of slit eyes facing forward
      ctx.strokeStyle = 'rgba(8,40,16,0.45)';
      ctx.lineWidth = Math.max(1, r * 0.035);
      const sc = r * 0.26;
      for (let row = -4; row <= 4; row++) {
        for (let col = -4; col <= 4; col++) {
          const sx = x + col * sc + (row % 2 ? sc * 0.5 : 0);
          const sy = y + row * sc * 0.62;
          ctx.beginPath();
          ctx.arc(sx, sy, sc * 0.55, 0.25, Math.PI - 0.25);
          ctx.stroke();
        }
      }
      const f = o.facing === undefined ? -0.4 : o.facing;
      const ex = x + Math.cos(f) * r * 0.42;
      const ey = y + Math.sin(f) * r * 0.42;
      for (const sgn of [-1, 1]) {
        const px = ex + Math.cos(f + Math.PI / 2) * r * 0.3 * sgn;
        const py = ey + Math.sin(f + Math.PI / 2) * r * 0.3 * sgn;
        const eg = ctx.createRadialGradient(px - r * 0.04, py - r * 0.05, 0, px, py, r * 0.17);
        eg.addColorStop(0, '#fffbd0');
        eg.addColorStop(1, '#e0c430');
        ctx.fillStyle = eg;
        ctx.beginPath();
        ctx.arc(px, py, r * 0.17, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(10,30,10,0.8)';
        ctx.lineWidth = Math.max(1, r * 0.03);
        ctx.stroke();
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(f);
        ctx.fillStyle = '#0d1408';
        ctx.beginPath();
        ctx.ellipse(r * 0.02, 0, r * 0.04, r * 0.13, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    } else if (type === 'cannon') {
      // Iron sphere with a brass band and an open bore
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.35);
      ctx.beginPath();
      ctx.ellipse(0, r * 0.05, r * 1.06, r * 0.3, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(10,10,14,0.7)';
      ctx.lineWidth = r * 0.3;
      ctx.stroke();
      const band = ctx.createLinearGradient(0, -r * 0.3, 0, r * 0.4);
      band.addColorStop(0, '#ffe2a4');
      band.addColorStop(0.5, '#c8902f');
      band.addColorStop(1, '#6e4710');
      ctx.strokeStyle = band;
      ctx.lineWidth = r * 0.18;
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = 'rgba(230,232,240,0.7)';
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3 + 0.5;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * r * 0.68, y + Math.sin(a) * r * 0.68, r * 0.05, 0, Math.PI * 2);
        ctx.fill();
      }
      const bore = ctx.createRadialGradient(x, y, 0, x, y, r * 0.32);
      bore.addColorStop(0, '#000000');
      bore.addColorStop(0.7, '#14151a');
      bore.addColorStop(1, '#3a3d46');
      ctx.fillStyle = bore;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#d9a347';
      ctx.lineWidth = Math.max(1.4, r * 0.07);
      ctx.stroke();
    } else if (type === 'dice') {
      // Ivory ball wearing a five-pip die face with a red center pip
      const face = r * 0.48;
      ctx.strokeStyle = 'rgba(120,108,84,0.35)';
      ctx.lineWidth = Math.max(1, r * 0.04);
      roundedRect(x - face, y - face, face * 2, face * 2, face * 0.42);
      ctx.stroke();
      for (const p of PIP_LAYOUT[5]) {
        const px = x + p[0] * face * 1.2;
        const py = y + p[1] * face * 1.2;
        const center = p[0] === 0 && p[1] === 0;
        const pr = r * (center ? 0.15 : 0.12);
        const g = ctx.createRadialGradient(px - pr * 0.3, py - pr * 0.3, 0, px, py, pr);
        if (center) {
          g.addColorStop(0, '#ff8a8a');
          g.addColorStop(1, '#b8121e');
        } else {
          g.addColorStop(0, '#5a5650');
          g.addColorStop(1, '#141210');
        }
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (type === 'hive') {
      // Honeycomb cells with darker filled combs
      const hs = r * 0.24;
      const hw = hs * Math.sqrt(3);
      for (let row = -4; row <= 4; row++) {
        for (let col = -4; col <= 4; col++) {
          const cx = x + col * hw + (row % 2 ? hw * 0.5 : 0);
          const cy = y + row * hs * 1.5;
          if (Math.hypot(cx - x, cy - y) > r * 1.15) continue;
          hexagon(cx, cy, hs * 0.92);
          if ((row * 7 + col * 3 + 40) % 4 === 0) {
            ctx.fillStyle = 'rgba(150,72,0,0.45)';
            ctx.fill();
          }
          ctx.strokeStyle = 'rgba(96,46,0,0.55)';
          ctx.lineWidth = Math.max(1, r * 0.035);
          ctx.stroke();
        }
      }
      const drip = ctx.createLinearGradient(x, y + r * 0.3, x, y + r);
      drip.addColorStop(0, 'rgba(255,170,20,0)');
      drip.addColorStop(1, 'rgba(255,150,0,0.4)');
      ctx.fillStyle = drip;
      ctx.fillRect(x - r, y + r * 0.3, r * 2, r * 0.7);
    } else if (type === 'thief') {
      // Bandit mask with eyes that look where it is heading
      const f = o.facing === undefined ? -0.4 : o.facing;
      const my = y - r * 0.12;
      ctx.fillStyle = '#0d0f17';
      ctx.beginPath();
      ctx.moveTo(x - r * 1.1, my - r * 0.2);
      ctx.quadraticCurveTo(x, my - r * 0.36, x + r * 1.1, my - r * 0.2);
      ctx.lineTo(x + r * 1.1, my + r * 0.2);
      ctx.quadraticCurveTo(x, my + r * 0.32, x - r * 1.1, my + r * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x - r, my - r * 0.24, r * 2, r * 0.05);
      for (const sgn of [-1, 1]) {
        const ex = x + sgn * r * 0.34;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(ex, my, r * 0.17, r * 0.11, sgn * -0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#10131c';
        ctx.beginPath();
        ctx.arc(ex + Math.cos(f) * r * 0.06, my + Math.sin(f) * r * 0.04, r * 0.065, 0, Math.PI * 2);
        ctx.fill();
      }
      // Sly grin
      ctx.strokeStyle = 'rgba(14,16,26,0.7)';
      ctx.lineWidth = Math.max(1, r * 0.05);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - r * 0.2, y + r * 0.4);
      ctx.quadraticCurveTo(x + r * 0.05, y + r * 0.55, x + r * 0.28, y + r * 0.36);
      ctx.stroke();
    } else if (type === 'axe') {
      // Lumberjack plaid
      ctx.fillStyle = 'rgba(30,6,6,0.42)';
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(x + i * r * 0.5 - r * 0.12, y - r, r * 0.24, r * 2);
        ctx.fillRect(x - r, y + i * r * 0.5 - r * 0.12, r * 2, r * 0.24);
      }
      ctx.fillStyle = 'rgba(255,214,190,0.13)';
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(x + i * r * 0.5 + r * 0.17, y - r, r * 0.04, r * 2);
        ctx.fillRect(x - r, y + i * r * 0.5 + r * 0.17, r * 2, r * 0.04);
      }
    } else if (type === 'charge') {
      // Glowing core and a battery that fills up with charge
      const c = o.charge === undefined ? 0.66 : o.charge;
      const pulse = c >= 1 ? 0.5 + Math.sin(clock * 10) * 0.5 : 0;
      const core = ctx.createRadialGradient(x, y, 0, x, y, r * (0.4 + c * 0.5));
      core.addColorStop(0, `rgba(255,255,255,${0.35 + c * 0.55})`);
      core.addColorStop(0.45, `rgba(255,90,200,${0.25 + c * 0.45 + pulse * 0.15})`);
      core.addColorStop(1, 'rgba(255,60,180,0)');
      ctx.fillStyle = core;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      const bw = r * 0.82;
      const bh = r * 0.46;
      const bx = x - bw / 2 - r * 0.04;
      const by = y - bh / 2;
      roundedRect(bx, by, bw, bh, r * 0.1);
      ctx.fillStyle = 'rgba(40,4,30,0.55)';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1.2, r * 0.07);
      ctx.stroke();
      roundedRect(bx + bw + r * 0.02, y - bh * 0.22, r * 0.09, bh * 0.44, r * 0.03);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      const lit = c > 0 ? Math.ceil(c * 3 - 0.001) : 0;
      const cw = (bw - r * 0.2) / 3;
      for (let i = 0; i < 3; i++) {
        roundedRect(bx + r * 0.08 + i * (cw + r * 0.02), by + r * 0.08, cw - r * 0.02, bh - r * 0.16, r * 0.04);
        ctx.fillStyle = i < lit ? (c >= 1 ? '#ffffff' : '#ff8fd6') : 'rgba(255,255,255,0.12)';
        ctx.fill();
      }
    } else if (type === 'frost') {
      // Frosted sheen with a snowflake emblem
      const sheen = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
      sheen.addColorStop(0, 'rgba(255,255,255,0.35)');
      sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
      sheen.addColorStop(1, 'rgba(255,255,255,0.18)');
      ctx.fillStyle = sheen;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      flakePath(x, y, r * 0.66);
      ctx.strokeStyle = 'rgba(30,80,140,0.55)';
      ctx.lineWidth = Math.max(2, r * 0.17);
      ctx.stroke();
      flakePath(x, y, r * 0.66);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1.2, r * 0.08);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < 7; i++) {
        const a = i * 2.4 + 0.5;
        const rr = r * (0.55 + (i % 3) * 0.13);
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr, r * 0.035, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (type === 'apple') {
      // Sunny blush, a top dimple and little skin speckles
      const blush = ctx.createRadialGradient(x + r * 0.4, y + r * 0.35, 0, x + r * 0.4, y + r * 0.35, r * 0.8);
      blush.addColorStop(0, 'rgba(255,200,70,0.32)');
      blush.addColorStop(1, 'rgba(255,200,70,0)');
      ctx.fillStyle = blush;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      const dimple = ctx.createRadialGradient(x, y - r * 0.86, 0, x, y - r * 0.86, r * 0.36);
      dimple.addColorStop(0, 'rgba(70,0,8,0.6)');
      dimple.addColorStop(1, 'rgba(70,0,8,0)');
      ctx.fillStyle = dimple;
      ctx.fillRect(x - r, y - r, r * 2, r * 0.8);
      ctx.fillStyle = 'rgba(255,225,190,0.35)';
      for (let i = 0; i < 8; i++) {
        const a = i * 2.1 + 0.4;
        const rr = r * (0.3 + (i % 3) * 0.2);
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr, r * 0.025, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Rim light
    const rim = ctx.createRadialGradient(x, y, r * 0.72, x, y, r);
    rim.addColorStop(0, 'rgba(255,255,255,0)');
    rim.addColorStop(1, rgba(type === 'electric' ? dark : type === 'burst' ? accent : color, 0.4));
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // Specular highlight
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const spec = ctx.createRadialGradient(x - r * 0.4, y - r * 0.44, 0, x - r * 0.4, y - r * 0.44, r * 0.46);
    spec.addColorStop(0, type === 'electric' ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.92)');
    spec.addColorStop(0.4, type === 'electric' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.3)');
    spec.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = spec;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (hit > 0) {
      ctx.fillStyle = `rgba(255,255,255,${hit * 0.34})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (healPulse > 0) {
      ctx.strokeStyle = `rgba(120,255,175,${healPulse * 0.85})`;
      ctx.lineWidth = r * 0.13;
      ctx.beginPath();
      ctx.arc(x, y, r * (1.02 + (1 - healPulse) * 0.24), 0, Math.PI * 2);
      ctx.stroke();
    }

    // Bomb fuse with a live spark
    if (type === 'bomb') {
      const cx0 = x + r * 0.16;
      const cy0 = y - r * 0.9;
      ctx.save();
      ctx.translate(cx0, cy0);
      ctx.rotate(0.3);
      const cap = ctx.createLinearGradient(-r * 0.17, 0, r * 0.17, 0);
      cap.addColorStop(0, '#62587a');
      cap.addColorStop(0.5, '#2e2640');
      cap.addColorStop(1, '#130f1c');
      roundedRect(-r * 0.17, -r * 0.2, r * 0.34, r * 0.26, r * 0.05);
      ctx.fillStyle = cap;
      ctx.fill();
      ctx.restore();
      const ex = x + r * 0.6;
      const ey = y - r * 1.36;
      ctx.strokeStyle = '#8c6f4a';
      ctx.lineWidth = Math.max(1.4, r * 0.09);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx0 + r * 0.06, cy0 - r * 0.14);
      ctx.quadraticCurveTo(x + r * 0.26, y - r * 1.52, ex, ey);
      ctx.stroke();
      const flick = 0.72 + Math.sin(clock * 37) * 0.16 + Math.sin(clock * 23) * 0.12;
      const sr = r * 0.27 * flick;
      const spark = ctx.createRadialGradient(ex, ey, 0, ex, ey, sr);
      spark.addColorStop(0, 'rgba(255,255,236,1)');
      spark.addColorStop(0.35, 'rgba(255,204,80,0.95)');
      spark.addColorStop(1, 'rgba(255,96,24,0)');
      ctx.fillStyle = spark;
      ctx.beginPath();
      ctx.arc(ex, ey, sr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,232,150,0.9)';
      ctx.lineWidth = Math.max(1, r * 0.03);
      for (let i = 0; i < 4; i++) {
        const a = clock * 9 + i * Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(ex + Math.cos(a) * sr * 0.45, ey + Math.sin(a) * sr * 0.45);
        ctx.lineTo(ex + Math.cos(a) * sr * 1.15, ey + Math.sin(a) * sr * 1.15);
        ctx.stroke();
      }
    }

    // Apple: stem and a leaf that sways a little
    if (type === 'apple') {
      ctx.save();
      ctx.strokeStyle = '#6b3d16';
      ctx.lineWidth = Math.max(1.4, r * 0.1);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y - r * 0.84);
      ctx.quadraticCurveTo(x + r * 0.04, y - r * 1.12, x + r * 0.16, y - r * 1.28);
      ctx.stroke();
      ctx.translate(x + r * 0.12, y - r * 1.1);
      ctx.rotate(-0.45 + Math.sin(clock * 2 + (side === 'blue' ? 1 : 0)) * 0.08);
      const lg = ctx.createLinearGradient(0, -r * 0.15, 0, r * 0.15);
      lg.addColorStop(0, '#b8f07a');
      lg.addColorStop(1, '#3a8a20');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(r * 0.24, -r * 0.22, r * 0.5, 0);
      ctx.quadraticCurveTo(r * 0.24, r * 0.22, 0, 0);
      ctx.fill();
      ctx.strokeStyle = 'rgba(30,80,20,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(r * 0.44, 0);
      ctx.stroke();
      ctx.restore();
    }

    // Thief: the mask ties off in two ribbons that flutter
    if (type === 'thief') {
      const tx0 = x - r * 0.96;
      const ty0 = y - r * 0.12;
      ctx.save();
      ctx.fillStyle = '#0d0f17';
      for (const k of [0, 1]) {
        const wave = Math.sin(clock * 6 + k * 1.3) * r * 0.06;
        ctx.beginPath();
        ctx.moveTo(tx0, ty0 - r * 0.06);
        ctx.quadraticCurveTo(tx0 - r * 0.25, ty0 + (k ? r * 0.18 : -r * 0.02) + wave, tx0 - r * (0.42 + k * 0.06), ty0 + (k ? r * 0.34 : r * 0.08) + wave);
        ctx.lineTo(tx0 - r * (0.34 + k * 0.06), ty0 + (k ? r * 0.42 : r * 0.18) + wave);
        ctx.quadraticCurveTo(tx0 - r * 0.15, ty0 + (k ? r * 0.24 : r * 0.08), tx0, ty0 + r * 0.08);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // Charge: a meter ring that fills over 4 seconds and glows when full
    if (type === 'charge' && !isMini) {
      const c = o.charge || 0;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(2, r * 0.08);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.arc(x, y, r * 1.2, 0, Math.PI * 2);
      ctx.stroke();
      if (c > 0) {
        if (c >= 1) {
          ctx.shadowColor = '#ff4fb8';
          ctx.shadowBlur = 12 + Math.sin(clock * 10) * 6;
        }
        ctx.strokeStyle = c >= 1 ? '#ffd6f0' : '#ff4fb8';
        ctx.beginPath();
        ctx.arc(x, y, r * 1.2, -Math.PI / 2, -Math.PI / 2 + c * Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Snake tongue flicks out every couple of seconds
    if (type === 'snake' && ((clock + (side === 'blue' ? 1.1 : 0)) % 2.2) < 0.28) {
      const f = o.facing === undefined ? -0.4 : o.facing;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(f);
      ctx.strokeStyle = '#ff3a5a';
      ctx.lineWidth = Math.max(1.4, r * 0.06);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(r * 0.92, 0);
      ctx.lineTo(r * 1.32, 0);
      ctx.lineTo(r * 1.48, -r * 0.12);
      ctx.moveTo(r * 1.32, 0);
      ctx.lineTo(r * 1.48, r * 0.12);
      ctx.stroke();
      ctx.restore();
    }

    // Bow: grip stripe and string
    // Harpoon Ball: dark teal sphere with a neon white-blueish harpoon marking
    // across its surface, exactly as in Ball VS Ball
    if (type === 'harpoon') {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.6 + Math.sin(clock * 0.7) * 0.12);
      const NEON = '#d2f4ff';
      const NEON_DK = '#8fd8ec';
      ctx.shadowColor = 'rgba(120,224,255,0.95)';
      ctx.shadowBlur = r * 0.3;
      // Shaft
      ctx.strokeStyle = NEON;
      ctx.lineWidth = Math.max(2, r * 0.13);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-r * 0.72, r * 0.42);
      ctx.lineTo(r * 0.42, -r * 0.42);
      ctx.stroke();
      // Toggle barb head
      ctx.beginPath();
      ctx.moveTo(r * 0.42, -r * 0.42);
      ctx.lineTo(r * 0.78, -r * 0.78);
      ctx.lineTo(r * 0.62, -r * 0.3);
      ctx.lineTo(r * 0.86, -r * 0.5);
      ctx.lineTo(r * 0.3, -r * 0.62);
      ctx.closePath();
      ctx.fillStyle = NEON;
      ctx.fill();
      ctx.shadowBlur = 0;
      // Rope curve trailing from the butt
      ctx.strokeStyle = NEON_DK;
      ctx.lineWidth = Math.max(1.4, r * 0.07);
      ctx.beginPath();
      ctx.moveTo(-r * 0.72, r * 0.42);
      ctx.quadraticCurveTo(-r * 0.9, r * 0.1, -r * 0.55, -r * 0.15);
      ctx.stroke();
      ctx.restore();
    }

    // Beam Ball (wiki): turquoise ball with a cyan glowing, zigzagging square
    // pattern running through its middle, and a white muzzle emitting the beam
    if (type === 'beam') {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.clip();
      const zz = () => {
        ctx.beginPath();
        const stepW = r * 0.34, amp = r * 0.2;
        let px = x - r * 1.1, up = true;
        ctx.moveTo(px, y + amp);
        while (px < x + r * 1.1) {
          px += stepW;
          ctx.lineTo(px, up ? y - amp : y + amp);
          ctx.lineTo(px, up ? y + amp : y - amp);
          up = !up;
        }
      };
      ctx.lineJoin = 'miter';
      ctx.lineCap = 'butt';
      ctx.shadowColor = 'rgba(47,232,234,0.95)';
      ctx.shadowBlur = r * 0.35;
      ctx.strokeStyle = 'rgba(42,150,156,0.9)';
      ctx.lineWidth = Math.max(2.2, r * 0.17);
      zz();
      ctx.stroke();
      const pulse = 0.78 + Math.sin(clock * 6) * 0.22;
      ctx.strokeStyle = `rgba(170,255,255,${pulse})`;
      ctx.lineWidth = Math.max(1.4, r * 0.09);
      zz();
      ctx.stroke();
      ctx.restore();
      // White muzzle on the rim, pointing where the beam fires
      if (!isMini) {
        const ba = o.beamAngle === undefined ? -0.5 : o.beamAngle;
        const charging = o.beamState === 'charge';
        const firing = o.beamState === 'fire';
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ba);
        const mw = r * 0.3, ml = r * 0.42;
        ctx.shadowColor = 'rgba(47,232,234,0.9)';
        ctx.shadowBlur = firing ? r * 0.6 : r * 0.25;
        roundedRect(r * 0.72, -mw, ml, mw * 2, mw * 0.4);
        const mg = ctx.createLinearGradient(0, -mw, 0, mw);
        mg.addColorStop(0, '#ffffff');
        mg.addColorStop(0.55, '#e6eaf0');
        mg.addColorStop(1, '#9aa4b2');
        ctx.fillStyle = mg;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(20,60,70,0.85)';
        ctx.lineWidth = Math.max(1, r * 0.04);
        ctx.stroke();
        // Bore glow: builds while charging, blazes while firing
        let glow = 0.25;
        if (charging) glow = 0.25 + 0.75 * clamp((o.beamT || 0) / 2.5, 0, 1);
        if (firing) glow = 1;
        ctx.fillStyle = `rgba(47,232,234,${glow})`;
        ctx.shadowColor = 'rgba(170,255,255,1)';
        ctx.shadowBlur = r * 0.4 * glow;
        ctx.beginPath();
        ctx.arc(r * 0.72 + ml, 0, mw * (0.55 + glow * 0.35), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Spear Ball (wiki): metallic ball with a neon-green stripe running around its middle
    if (type === 'spear') {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.translate(x, y);
      ctx.rotate(-0.28);
      const bandH = r * 0.26;
      ctx.shadowColor = 'rgba(148,254,3,0.9)';
      ctx.shadowBlur = r * 0.3;
      ctx.fillStyle = '#94fe03';
      ctx.fillRect(-r * 1.2, -bandH * 0.5, r * 2.4, bandH);
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(-r * 1.2, -bandH * 0.5, r * 2.4, bandH * 0.3);
      ctx.strokeStyle = 'rgba(30,34,44,0.75)';
      ctx.lineWidth = Math.max(1, r * 0.035);
      ctx.strokeRect(-r * 1.2, -bandH * 0.5, r * 2.4, bandH);
      ctx.restore();
    }

    // Reforge Ball (wiki): yellow ball with an iron hammer symbol; its summoned
    // Blade is a smaller yellow ball with a blade symbol
    if (type === 'reforge') {
      ctx.save();
      ctx.translate(x, y);
      if (o.reforgeBlade) {
        // Blade symbol
        ctx.rotate(-0.78);
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = r * 0.2;
        ctx.fillStyle = '#5c5e77';
        ctx.fillRect(-r * 0.09, r * 0.1, r * 0.18, r * 0.5);
        ctx.fillStyle = '#3d3f52';
        ctx.fillRect(-r * 0.3, r * 0.06, r * 0.6, r * 0.1);
        const bg = ctx.createLinearGradient(-r * 0.2, 0, r * 0.2, 0);
        bg.addColorStop(0, '#ffffff');
        bg.addColorStop(0.5, '#e7ebf0');
        bg.addColorStop(1, '#8b93a3');
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.moveTo(-r * 0.17, r * 0.06);
        ctx.lineTo(r * 0.17, r * 0.06);
        ctx.lineTo(r * 0.1, -r * 0.5);
        ctx.lineTo(0, -r * 0.72);
        ctx.lineTo(-r * 0.1, -r * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(40,40,50,0.8)';
        ctx.lineWidth = Math.max(1, r * 0.05);
        ctx.stroke();
      } else {
        // Iron hammer symbol
        ctx.rotate(0.62);
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = r * 0.2;
        ctx.fillStyle = '#6d3d28';
        roundedRect(-r * 0.09, -r * 0.1, r * 0.18, r * 0.78, r * 0.05);
        ctx.fill();
        ctx.strokeStyle = 'rgba(50,25,10,0.8)';
        ctx.lineWidth = Math.max(1, r * 0.035);
        ctx.stroke();
        const hg = ctx.createLinearGradient(0, -r * 0.5, 0, -r * 0.1);
        hg.addColorStop(0, '#ffffff');
        hg.addColorStop(0.5, '#e7ebf0');
        hg.addColorStop(1, '#8b93a3');
        ctx.fillStyle = hg;
        roundedRect(-r * 0.44, -r * 0.5, r * 0.88, r * 0.38, r * 0.08);
        ctx.fill();
        ctx.strokeStyle = 'rgba(40,40,50,0.85)';
        ctx.lineWidth = Math.max(1, r * 0.045);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillRect(-r * 0.4, -r * 0.47, r * 0.8, r * 0.07);
      }
      ctx.restore();
    }

    // Chess Ball (wiki): a black-and-white checkerboard across its surface
    if (type === 'chess') {
      const cs = r * 0.5;
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.clip();
      for (let i = -3; i < 3; i++) {
        for (let j = -3; j < 3; j++) {
          ctx.fillStyle = ((i + j) & 1) ? '#eceff4' : '#181d26';
          ctx.fillRect(x + i * cs, y + j * cs, cs, cs);
        }
      }
      const sh = ctx.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.05, x, y, r);
      sh.addColorStop(0, 'rgba(255,255,255,0.38)');
      sh.addColorStop(0.5, 'rgba(255,255,255,0)');
      sh.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = sh;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(6,8,12,0.85)';
      ctx.lineWidth = Math.max(1, r * 0.05);
      ctx.stroke();
    }

    // Verity Ball (wiki): a yellow smiley face that sours, then turns into a monster
    if (type === 'verity') {
      const stage = (o.ref && o.ref.verityStage) || 1;
      const ink = '#151923';
      const ex = r * 0.36;
      const ey = -r * 0.14;
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.clip();
      if (stage === 3) {
        const mg = ctx.createRadialGradient(x, y + r * 0.7, 0, x, y + r * 0.7, r * 1.1);
        mg.addColorStop(0, 'rgba(220,30,50,0.55)');
        mg.addColorStop(1, 'rgba(220,30,50,0)');
        ctx.fillStyle = mg;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      ctx.restore();
      ctx.save();
      ctx.translate(x, y);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.fillStyle = ink;
      ctx.strokeStyle = ink;
      if (stage === 1) {
        for (const sg of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(sg * ex, ey, r * 0.13, r * 0.2, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (stage === 2) {
        for (const sg of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(sg * ex, ey + r * 0.05, r * 0.12, r * 0.15, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.lineWidth = Math.max(1.5, r * 0.1);
          ctx.beginPath();
          ctx.moveTo(sg * (ex - r * 0.2), ey - r * 0.26);
          ctx.lineTo(sg * (ex + r * 0.14), ey - r * 0.16);
          ctx.stroke();
        }
      } else {
        for (const sg of [-1, 1]) {
          ctx.lineWidth = Math.max(2, r * 0.13);
          ctx.beginPath();
          ctx.moveTo(sg * (ex - r * 0.18), ey - r * 0.08);
          ctx.lineTo(sg * (ex + r * 0.16), ey + r * 0.06);
          ctx.stroke();
          ctx.fillStyle = '#ff3b4e';
          ctx.beginPath();
          ctx.arc(sg * ex, ey + r * 0.12, r * 0.05, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = ink;
        }
      }
      ctx.lineWidth = Math.max(2, r * 0.12);
      if (stage === 1) {
        ctx.beginPath();
        ctx.arc(0, r * 0.1, r * 0.46, 0.25, Math.PI - 0.25);
        ctx.stroke();
      } else if (stage === 2) {
        ctx.beginPath();
        ctx.arc(0, r * 0.78, r * 0.46, Math.PI + 0.35, Math.PI * 2 - 0.35);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#2a0408';
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, r * 0.2);
        ctx.lineTo(r * 0.5, r * 0.2);
        ctx.lineTo(r * 0.36, r * 0.5);
        ctx.lineTo(r * 0.2, r * 0.3);
        ctx.lineTo(0, r * 0.55);
        ctx.lineTo(-r * 0.2, r * 0.3);
        ctx.lineTo(-r * 0.36, r * 0.5);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // Cactus Ball (wiki): light green, covered in small yellow spikes, a pink flower on top
    if (type === 'cactus') {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.strokeStyle = 'rgba(238,209,40,0.95)';
      ctx.lineWidth = Math.max(1, r * 0.09);
      ctx.lineCap = 'round';
      for (let i = 0; i < 28; i++) {
        const a = i * 2.399963;
        const rr = r * 0.9 * Math.sqrt((i + 0.5) / 28);
        const px = x + Math.cos(a) * rr;
        const py = y + Math.sin(a) * rr;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(a) * r * 0.12, py + Math.sin(a) * r * 0.12);
        ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = '#eed128';
      ctx.strokeStyle = 'rgba(70,60,10,0.75)';
      ctx.lineWidth = Math.max(0.8, r * 0.03);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + 0.1;
        const ca = Math.cos(a), sa = Math.sin(a);
        const bx = x + ca * r * 0.92, by = y + sa * r * 0.92;
        const tx = x + ca * r * 1.18, ty = y + sa * r * 1.18;
        const px = -sa * r * 0.11, py = ca * r * 0.11;
        ctx.beginPath();
        ctx.moveTo(bx + px, by + py);
        ctx.lineTo(tx, ty);
        ctx.lineTo(bx - px, by - py);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.save();
      ctx.translate(x, y - r * 0.92);
      for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.rotate((i / 5) * Math.PI * 2);
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.2, r * 0.16, r * 0.2, 0, 0, Math.PI * 2);
        ctx.fillStyle = i % 2 ? '#e665f1' : '#f8adfc';
        ctx.fill();
        ctx.strokeStyle = 'rgba(120,30,130,0.7)';
        ctx.lineWidth = Math.max(0.8, r * 0.03);
        ctx.stroke();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2);
      ctx.fillStyle = '#a53bcf';
      ctx.fill();
      ctx.restore();
    }

    // Range Ball (wiki): a fully yellow ball with a yellowish aura
    if (type === 'range') {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.clip();
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.05, x, y, r);
      g.addColorStop(0, 'rgba(255,255,240,0.6)');
      g.addColorStop(0.5, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(110,80,8,0.4)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.strokeStyle = 'rgba(255,250,200,0.5)';
      ctx.lineWidth = Math.max(1, r * 0.05);
      ctx.beginPath();
      ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Electro King (wiki overview): a dark blue ball with bright light-blue lines around it
    if (type === 'electroking') {
      ctx.save();
      ctx.lineCap = 'round';
      const t = clock * 2.2;
      for (let k = 0; k < 2; k++) {
        const ang = k === 0 ? -0.55 + Math.sin(clock * 1.3) * 0.12 : 0.85 + Math.cos(clock * 1.1) * 0.12;
        ctx.beginPath();
        ctx.ellipse(x, y, r * 1.28, r * 0.42, ang, 0, Math.PI * 2);
        ctx.shadowColor = 'rgba(120,235,255,0.95)';
        ctx.shadowBlur = r * 0.35;
        ctx.strokeStyle = 'rgba(150,240,255,0.9)';
        ctx.lineWidth = Math.max(1.6, r * 0.07);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = Math.max(0.8, r * 0.025);
        ctx.stroke();
      }
      const a0 = -0.55 + Math.sin(clock * 1.3) * 0.12;
      const rx = r * 1.28, ry = r * 0.42;
      const ox = x + rx * Math.cos(t) * Math.cos(a0) - ry * Math.sin(t) * Math.sin(a0);
      const oy = y + rx * Math.cos(t) * Math.sin(a0) + ry * Math.sin(t) * Math.cos(a0);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(160,245,255,1)';
      ctx.shadowBlur = r * 0.4;
      ctx.beginPath();
      ctx.arc(ox, oy, Math.max(1.6, r * 0.09), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Acid Ball (wiki): bright green with darker spots, a wet sheen and drifting bubbles
    if (type === 'acid') {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.clip();
      const spots = [[-0.42, -0.3, 0.3], [0.34, -0.42, 0.22], [0.5, 0.2, 0.26],
        [-0.2, 0.48, 0.24], [-0.62, 0.16, 0.17], [0.08, -0.05, 0.15], [0.2, 0.62, 0.14]];
      for (const [ox, oy, orr] of spots) {
        const sx = x + ox * r, sy = y + oy * r, sr = orr * r;
        const g = ctx.createRadialGradient(sx - sr * 0.3, sy - sr * 0.35, sr * 0.1, sx, sy, sr);
        g.addColorStop(0, '#6fd42e');
        g.addColorStop(0.55, 'rgba(87,178,44,0.95)');
        g.addColorStop(1, 'rgba(44,106,12,0.85)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(235,255,200,0.5)';
        ctx.beginPath();
        ctx.arc(sx - sr * 0.3, sy - sr * 0.35, sr * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
      // Bubbles drifting up through the acid
      for (let i = 0; i < 3; i++) {
        const bx = x + Math.sin(clock * 1.3 + i * 2.1) * r * 0.5;
        const by = y + r * 0.6 - ((clock * r * 0.35 + i * r * 0.55) % (r * 1.2));
        ctx.beginPath();
        ctx.arc(bx, by, r * (0.05 + 0.02 * Math.sin(clock * 3 + i)), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(230,255,190,0.55)';
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(226,255,184,0.3)';
      ctx.beginPath();
      ctx.ellipse(x - r * 0.34, y - r * 0.44, r * 0.3, r * 0.18, -0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Big Spike Ball (wiki): a metallic grey sphere with panel seams, a center boss and rivets
    if (type === 'bigspike') {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = Math.max(1, r * 0.05);
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(x - r, y + i * r * 0.24);
        ctx.lineTo(x + r, y + i * r * 0.24 - r * 0.1);
        ctx.stroke();
      }
      // Panel seams
      ctx.strokeStyle = 'rgba(30,34,44,0.5)';
      ctx.lineWidth = Math.max(1, r * 0.04);
      ctx.beginPath();
      ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - r, y - r * 0.32);
      ctx.lineTo(x + r, y - r * 0.32);
      ctx.moveTo(x - r, y + r * 0.34);
      ctx.lineTo(x + r, y + r * 0.34);
      ctx.stroke();
      const sheen = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
      sheen.addColorStop(0, 'rgba(255,255,255,0.4)');
      sheen.addColorStop(0.42, 'rgba(255,255,255,0)');
      sheen.addColorStop(0.62, 'rgba(0,0,0,0.14)');
      sheen.addColorStop(1, 'rgba(0,0,0,0.34)');
      ctx.fillStyle = sheen;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.restore();
      // Center boss
      const bg = ctx.createRadialGradient(x - r * 0.1, y - r * 0.12, r * 0.02, x, y, r * 0.3);
      bg.addColorStop(0, '#ffffff');
      bg.addColorStop(0.6, '#c9cfd9');
      bg.addColorStop(1, '#5b6270');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(20,24,32,0.8)';
      ctx.lineWidth = Math.max(1, r * 0.045);
      ctx.stroke();
      // Riveted rim
      ctx.fillStyle = 'rgba(238,242,248,0.85)';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.2;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82, Math.max(1.2, r * 0.055), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(x, y, r * 0.95, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(40,46,58,0.55)';
      ctx.lineWidth = Math.max(1, r * 0.04);
      ctx.stroke();
    }

    // Cell Ball (wiki): translucent membrane, a darker outer ring, two orbiting
    // nuclei, and a seam that closes as it nears maturity
    if (type === 'cell') {
      const mature = o.ref ? clamp((o.ref.cellT || 0) / 3, 0, 1) : 1;
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = 'rgba(222,236,189,0.22)';
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      const t = clock * 0.9;
      for (let i = 0; i < 2; i++) {
        const a = t + i * Math.PI;
        const nx = x + Math.cos(a) * r * 0.28;
        const ny = y + Math.sin(a) * r * 0.24;
        const nr = r * 0.26;
        const g = ctx.createRadialGradient(nx - nr * 0.3, ny - nr * 0.35, nr * 0.1, nx, ny, nr);
        g.addColorStop(0, '#f4ffd8');
        g.addColorStop(0.6, '#bfe087');
        g.addColorStop(1, '#7fae52');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(nx, ny, nr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.arc(nx - nr * 0.3, ny - nr * 0.35, nr * 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      // Double membrane ring
      for (const [rr, col, lw] of [[0.94, '#6bb36f', 0.14], [0.78, 'rgba(107,179,111,0.45)', 0.05]]) {
        ctx.beginPath();
        ctx.arc(x, y, r * rr, 0, Math.PI * 2);
        ctx.strokeStyle = col;
        ctx.lineWidth = Math.max(1, r * lw);
        ctx.stroke();
      }
      // Maturity seam: an arc that closes as the cell matures
      if (o.ref && !o.ref.cellMature) {
        ctx.beginPath();
        ctx.arc(x, y, r * 0.62, -Math.PI * 0.8, -Math.PI * 0.8 + Math.PI * 1.6 * mature);
        ctx.strokeStyle = `rgba(63,122,69,${0.35 + mature * 0.45})`;
        ctx.lineWidth = Math.max(1.5, r * 0.06);
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    }

    // WDC (wiki): blue with a white 3x3 grid, corner bolts, and the live number on a plate
    if (type === 'wdc') {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.strokeStyle = 'rgba(243,245,249,0.92)';
      ctx.lineWidth = Math.max(1.4, r * 0.07);
      for (let i = 1; i < 3; i++) {
        const off = (i - 1.5) * (r * 0.62);
        ctx.beginPath();
        ctx.moveTo(x + off, y - r);
        ctx.lineTo(x + off, y + r);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - r, y + off);
        ctx.lineTo(x + r, y + off);
        ctx.stroke();
      }
      const gloss = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r);
      gloss.addColorStop(0, 'rgba(255,255,255,0.3)');
      gloss.addColorStop(0.5, 'rgba(255,255,255,0)');
      gloss.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = gloss;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.restore();
      // Corner bolts
      ctx.fillStyle = 'rgba(243,245,249,0.9)';
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + i * Math.PI / 2;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * r * 0.86, y + Math.sin(a) * r * 0.86, Math.max(1, r * 0.05), 0, Math.PI * 2);
        ctx.fill();
      }
      // Live cell number on a glowing plate
      if (!isMini && o.ref && o.ref.wdcOn && o.ref.wdcLast) {
        ctx.save();
        const pw = r * 0.95, ph = r * 0.62;
        ctx.shadowColor = 'rgba(120,170,255,0.9)';
        ctx.shadowBlur = r * 0.3;
        roundedRect(x - pw / 2, y - ph / 2, pw, ph, ph * 0.3);
        ctx.fillStyle = 'rgba(6,16,48,0.85)';
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(160,200,255,0.9)';
        ctx.lineWidth = Math.max(1, r * 0.035);
        ctx.stroke();
        ctx.font = `900 ${clamp(r * 0.5, 9, 22)}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(String(o.ref.wdcLast), x, y + r * 0.02);
        ctx.restore();
      }
    }

    // Hook Ball: rope coil backdrop, a chain link, and a bold anchor emblem
    // (the wiki documents its ability but not its colours, so this follows its Anchor basis)
    if (type === 'hook') {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.clip();
      // Rope coil
      ctx.strokeStyle = 'rgba(226,206,158,0.4)';
      ctx.lineWidth = Math.max(1.4, r * 0.08);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(x, y, r * (0.3 + i * 0.24), clock * 0.2 + i, clock * 0.2 + i + Math.PI * 1.4);
        ctx.stroke();
      }
      ctx.restore();
      // Chain link at the top
      ctx.save();
      ctx.translate(x, y - r * 0.52);
      ctx.rotate(0.3);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.2, r * 0.3, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#eef2f8';
      ctx.lineWidth = Math.max(1.6, r * 0.1);
      ctx.stroke();
      ctx.restore();
      // Anchor emblem
      ctx.save();
      ctx.translate(x, y + r * 0.06);
      ctx.strokeStyle = '#eef2f8';
      ctx.fillStyle = '#eef2f8';
      ctx.lineWidth = Math.max(1.8, r * 0.13);
      ctx.lineCap = 'round';
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = r * 0.15;
      ctx.beginPath();
      ctx.arc(0, -r * 0.4, r * 0.15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.25);
      ctx.lineTo(0, r * 0.36);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.3, -r * 0.02);
      ctx.lineTo(r * 0.3, -r * 0.02);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, r * 0.12, r * 0.4, 0.35, Math.PI - 0.35);
      ctx.stroke();
      for (const sg of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sg * r * 0.38, r * 0.26);
        ctx.lineTo(sg * r * 0.52, r * 0.02);
        ctx.lineTo(sg * r * 0.23, r * 0.13);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // Gojo Ball: pale skin, a black blindfold across the eyes, white spiky hair on top
    if (type === 'gojo') {
      // Infinity: a faint ring that nothing quite touches
      if (!isMini) {
        ctx.save();
        ctx.setLineDash([3, 6]);
        ctx.lineDashOffset = -clock * 10;
        ctx.beginPath();
        ctx.arc(x, y, r * 1.14, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(150,215,255,0.45)';
        ctx.lineWidth = Math.max(1, r * 0.04);
        ctx.stroke();
        ctx.restore();
      }
      // Blindfold, bowed so it reads as wrapped around the head
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.clip();
      const by0 = y - r * 0.42, by1 = y - r * 0.08;
      const band = () => {
        ctx.beginPath();
        ctx.moveTo(x - r * 1.1, by0 - r * 0.1);
        ctx.quadraticCurveTo(x, by0 + r * 0.1, x + r * 1.1, by0 - r * 0.1);
        ctx.lineTo(x + r * 1.1, by1 - r * 0.1);
        ctx.quadraticCurveTo(x, by1 + r * 0.12, x - r * 1.1, by1 - r * 0.1);
        ctx.closePath();
      };
      band();
      const bf = ctx.createLinearGradient(0, by0, 0, by1);
      bf.addColorStop(0, '#2c2c38');
      bf.addColorStop(0.45, '#0c0c12');
      bf.addColorStop(1, '#000000');
      ctx.fillStyle = bf;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = Math.max(1, r * 0.03);
      ctx.beginPath();
      ctx.moveTo(x - r * 0.9, by0 + r * 0.03);
      ctx.quadraticCurveTo(x, by0 + r * 0.18, x + r * 0.9, by0 + r * 0.03);
      ctx.stroke();
      // A confident smirk
      ctx.strokeStyle = 'rgba(120,60,50,0.85)';
      ctx.lineWidth = Math.max(1.2, r * 0.06);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - r * 0.18, y + r * 0.52);
      ctx.quadraticCurveTo(x + r * 0.05, y + r * 0.62, x + r * 0.27, y + r * 0.45);
      ctx.stroke();
      ctx.restore();
      // Blindfold knot tails fluttering off the right side
      ctx.save();
      ctx.fillStyle = '#0c0c12';
      const kx = x + r * 0.92, ky = y - r * 0.28;
      for (let i = 0; i < 2; i++) {
        const wav = Math.sin(clock * 6 + i * 1.3) * r * 0.08;
        const oy = i * r * 0.12;
        ctx.beginPath();
        ctx.moveTo(kx, ky - r * 0.05 + oy);
        ctx.quadraticCurveTo(kx + r * 0.3, ky + wav + oy, kx + r * (0.56 - i * 0.1), ky + r * 0.12 + oy + wav);
        ctx.lineTo(kx + r * (0.5 - i * 0.1), ky + r * 0.22 + oy + wav);
        ctx.quadraticCurveTo(kx + r * 0.22, ky + r * 0.14 + oy, kx - r * 0.02, ky + r * 0.07 + oy);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      // White spiky hair, swept up and to the right
      ctx.save();
      const spikes = 9;
      const a0 = Math.PI * 1.06, a1 = Math.PI * 1.94;
      const hair = () => {
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a0) * r, y + Math.sin(a0) * r);
        for (let i = 0; i < spikes; i++) {
          const am = a0 + (a1 - a0) * ((i + 0.5) / spikes);
          const ab = a0 + (a1 - a0) * ((i + 1) / spikes);
          const len = r * (1.3 + 0.14 * Math.sin(i * 2.3) + (i % 2 ? 0 : 0.1));
          ctx.lineTo(x + Math.cos(am + 0.12) * len, y + Math.sin(am + 0.12) * len);
          ctx.lineTo(x + Math.cos(ab) * r * 0.98, y + Math.sin(ab) * r * 0.98);
        }
        // Fringe falling back across the forehead, over the blindfold's top edge
        const fringe = [[0.8, -0.46], [0.56, -0.52], [0.4, -0.33], [0.18, -0.52], [0, -0.31],
          [-0.2, -0.52], [-0.4, -0.34], [-0.6, -0.52], [-0.82, -0.4]];
        for (const [fx, fy] of fringe) ctx.lineTo(x + r * fx, y + r * fy);
        ctx.closePath();
      };
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = r * 0.15;
      hair();
      const hg = ctx.createLinearGradient(0, y - r * 1.4, 0, y - r * 0.3);
      hg.addColorStop(0, '#ffffff');
      hg.addColorStop(0.6, '#eef2f8');
      hg.addColorStop(1, '#c9d2e0');
      ctx.fillStyle = hg;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(120,132,154,0.75)';
      ctx.lineWidth = Math.max(0.8, r * 0.03);
      ctx.stroke();
      // A few strands for texture
      ctx.strokeStyle = 'rgba(160,172,194,0.6)';
      for (let i = 0; i < 4; i++) {
        const am = a0 + (a1 - a0) * ((i * 2 + 1.5) / spikes);
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(am) * r * 0.62, y + Math.sin(am) * r * 0.62);
        ctx.lineTo(x + Math.cos(am + 0.1) * r * 1.08, y + Math.sin(am + 0.1) * r * 1.08);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Hive: a couple of bees idly circling the ball
    if (type === 'hive') {
      for (let i = 0; i < 2; i++) {
        const a = clock * 2.4 + i * Math.PI;
        const bx = x + Math.cos(a) * r * 1.3;
        const by = y + Math.sin(a) * r * 0.75 - r * 0.15;
        const bs = r * 0.11;
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(a + Math.PI / 2);
        ctx.fillStyle = 'rgba(230,244,255,0.6)';
        const flap = 0.4 + Math.abs(Math.sin(clock * 60 + i)) * 0.6;
        ctx.beginPath();
        ctx.ellipse(0, -bs * 0.7, bs * 0.6, bs * 0.4 * flap, 0, 0, Math.PI * 2);
        ctx.ellipse(0, bs * 0.7, bs * 0.6, bs * 0.4 * flap, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffc21f';
        ctx.beginPath();
        ctx.ellipse(0, 0, bs * 1.1, bs * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#21140a';
        ctx.fillRect(-bs * 0.3, -bs * 0.7, bs * 0.28, bs * 1.4);
        ctx.restore();
      }
    }

    // Fibonacci streak pips: one golden pip per hit in the current streak
    if (type === 'fibonacci' && !isMini && (fibStep || 0) > 0) {
      const n = Math.min(fibStep, FIB.length);
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i - (FIB.length - 1) / 2) * 0.27;
        const px = x + Math.cos(a) * r * 1.26;
        const py = y + Math.sin(a) * r * 1.26;
        const pr = r * (0.055 + i * 0.008);
        const pip = ctx.createRadialGradient(px - pr * 0.3, py - pr * 0.3, 0, px, py, pr);
        pip.addColorStop(0, '#fff7cf');
        pip.addColorStop(1, '#c9a43a');
        ctx.fillStyle = pip;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(40,30,4,0.7)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Machine Gun muzzle flash
    if (type === 'machine' && !isMini && (gunKick || 0) > 0.5) {
      const f = ((gunKick || 0) - 0.5) / 0.5;
      const mx = x + Math.cos(gunAngle) * r * 1.66;
      const my = y + Math.sin(gunAngle) * r * 1.66;
      const fr = r * 0.5 * f;
      const flash = ctx.createRadialGradient(mx, my, 0, mx, my, fr);
      flash.addColorStop(0, 'rgba(255,255,232,1)');
      flash.addColorStop(0.4, 'rgba(255,206,90,0.85)');
      flash.addColorStop(1, 'rgba(255,120,30,0)');
      ctx.fillStyle = flash;
      ctx.beginPath();
      ctx.arc(mx, my, fr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Burst dash halo
    if (dashActive && !isMini) {
      ctx.strokeStyle = 'rgba(255,237,78,0.65)';
      ctx.lineWidth = r * 0.1;
      ctx.beginPath();
      ctx.arc(x, y, r * 1.25, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Frozen cage (Electric hits)
    if (frozen) {
      ctx.strokeStyle = 'rgba(168,248,255,0.9)';
      ctx.lineWidth = Math.max(1.4, r * 0.05);
      ctx.lineJoin = 'round';
      for (let i = 0; i < 4; i++) {
        const a = i * (Math.PI / 2) + clock * 1.1;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.85);
        ctx.lineTo(x + Math.cos(a + 0.32) * r * 1.26, y + Math.sin(a + 0.32) * r * 1.26);
        ctx.stroke();
      }
    }

    if (!isMini && Number.isFinite(health)) {
      const text = String(Math.max(0, Math.round(health)));
      const portrait = Object.hasOwn(ANIME_TYPES, type);
      const fontSize = portrait ? clamp(r * 0.37, 10, 18) : clamp(r * 0.48, 13, 24);
      const labelY = portrait ? y + r * 0.86 : y + 1;
      ctx.save();
      ctx.font = `900 ${fontSize}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(3, fontSize * 0.22);
      ctx.strokeStyle = 'rgba(5,7,14,0.92)';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.72)';
      ctx.shadowBlur = Math.max(3, fontSize * 0.2);
      ctx.strokeText(text, x, labelY);
      ctx.fillText(text, x, labelY);
      ctx.restore();
    }

    ctx.restore();
  }

  function drawFreshArrow(b, alpha, push) {
    if (alpha <= 0) return;
    const type = b.type;
    const r = b.r;
    const bob = Math.sin(clock * 5.2) * r * 0.06;
    const x0 = r * 1.3 + bob + push;
    const reach = Math.min(r * 3.35, arena.w * 0.34, arena.h * 0.44);
    const k = clamp((reach - r * 1.3) / (r * 2.05), 0.52, 1);
    const shaftLen = r * 1.2 * k;
    const headLen = r * 0.98 * k;
    const thick = Math.sqrt(k);
    const sw = r * 0.23 * thick;
    const hw = r * 0.58 * thick;
    const x1 = x0 + shaftLen;
    const tip = x1 + headLen;

    const ARROW = {
      glass:     { fill: ['#f4ffff', '#b9f7f1', '#52b9b4'], accent: '#ffffff', glow: { r: 140, g: 240, b: 235 } },
      electric:  { fill: ['#b5f4ff', '#159fe5', '#07589e'], accent: '#d9ffff', glow: { r: 80, g: 222, b: 255 } },
      burst:     { fill: ['#fff3b0', '#f79b28', '#9c2c03'], accent: '#ffed4e', glow: { r: 255, g: 160, b: 50 } },
      poison:    { fill: ['#e9ffc4', '#8fdd55', '#2a6427'], accent: '#d8ff9c', glow: { r: 130, g: 220, b: 90 } },
      shackles:  { fill: ['#ece4ff', '#9070f0', '#36207a'], accent: '#eef2fa', glow: { r: 170, g: 130, b: 255 } },
      machine:   { fill: ['#e6e9d6', '#7f8962', '#30361f'], accent: '#ffc450', glow: { r: 255, g: 190, b: 80 } },
      fibonacci: { fill: ['#b6bdf0', '#4c58a4', '#1a2262'], accent: '#efdc7d', glow: { r: 239, g: 220, b: 125 } },
      bomb:      { fill: ['#c3a6ee', '#5f3d8f', '#22103b'], accent: '#ffaa3c', glow: { r: 255, g: 150, b: 60 } },
      zone:      { fill: ['#ffc4c9', '#ff3a4e', '#7a0716'], accent: '#ffd6da', glow: { r: 255, g: 70, b: 90 } },
      spider:    { fill: ['#ff9a9a', '#d8262f', '#5a060c'], accent: '#ffffff', glow: { r: 255, g: 80, b: 90 } },
      snake:     { fill: ['#cff59a', '#4caf3e', '#103d1a'], accent: '#ff4060', glow: { r: 120, g: 230, b: 90 } },
      cannon:    { fill: ['#d2d5de', '#5f6372', '#1a1c22'], accent: '#e8b45a', glow: { r: 230, g: 180, b: 100 } },
      dice:      { fill: ['#ffffff', '#ece6d6', '#a99e86'], accent: '#1a1a1a', glow: { r: 255, g: 240, b: 200 } },
      hive:      { fill: ['#fff0a8', '#f2a91e', '#6b3604'], accent: '#2a1604', glow: { r: 255, g: 200, b: 60 } },
      thief:     { fill: ['#ffffff', '#b9c2d0', '#4a5466'], accent: '#8a5a2b', glow: { r: 200, g: 210, b: 230 } },
      axe:       { fill: ['#f0c48e', '#a8692f', '#4a2a0e'], accent: '#dfe6ee', glow: { r: 230, g: 110, b: 80 } },
      charge:    { fill: ['#ffd6f0', '#ff3db5', '#5a0640'], accent: '#ffffff', glow: { r: 255, g: 80, b: 190 } },
      frost:     { fill: ['#ffffff', '#c4e8ff', '#4a90c8'], accent: '#ffffff', glow: { r: 170, g: 225, b: 255 } },
      apple:     { fill: ['#ffb0a8', '#e3202e', '#6a0410'], accent: '#7ccf4a', glow: { r: 255, g: 90, b: 90 } }
    }[type] || { fill: ['#e9ffc4', '#8fdd55', '#2a6427'], accent: '#d8ff9c', glow: { r: 130, g: 220, b: 90 } };
    const fills = ARROW.fill;
    const accent = ARROW.accent;

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.globalAlpha = alpha;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const shape = () => {
      ctx.beginPath();
      ctx.moveTo(x0, -sw * 0.88);
      ctx.lineTo(x1 - headLen * 0.12, -sw);
      ctx.lineTo(x1 - headLen * 0.12, -hw * 0.72);
      ctx.lineTo(tip, 0);
      ctx.lineTo(x1 - headLen * 0.12, hw * 0.72);
      ctx.lineTo(x1 - headLen * 0.12, sw);
      ctx.lineTo(x0, sw * 0.88);
      ctx.closePath();
    };

    // Soft outer glow
    ctx.save();
    shape();
    ctx.strokeStyle = rgba(ARROW.glow, 0.55);
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = r * 0.5;
    ctx.lineWidth = r * 0.2;
    ctx.stroke();
    ctx.restore();

    // Main bevel body
    shape();
    const bodyGrad = ctx.createLinearGradient(0, -hw, 0, hw);
    bodyGrad.addColorStop(0, fills[0]);
    bodyGrad.addColorStop(0.46, fills[1]);
    bodyGrad.addColorStop(1, fills[2]);
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(10,16,28,0.55)';
    ctx.lineWidth = Math.max(1.4, r * 0.05);
    ctx.stroke();

    // Glossy top edge
    ctx.save();
    shape();
    ctx.clip();
    const sheen = ctx.createLinearGradient(0, -hw, 0, 0);
    sheen.addColorStop(0, 'rgba(255,255,255,0.6)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(x0, -hw, shaftLen + headLen, hw);
    ctx.restore();

    // Type accent details
    if (type === 'electric') {
      ctx.save();
      ctx.shadowColor = accent;
      ctx.shadowBlur = r * 0.34;
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(2.4, r * 0.1);
      ctx.beginPath();
      ctx.moveTo(x0 + r * 0.1, 0);
      ctx.lineTo(x1 + headLen * 0.34, 0);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1.2, r * 0.04);
      ctx.stroke();
      ctx.restore();
      // Lightning chevrons near the head
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(2, r * 0.065);
      ctx.beginPath();
      ctx.moveTo(x1 - r * 0.04, -hw * 0.6);
      ctx.lineTo(x1 + r * 0.16, 0);
      ctx.lineTo(x1 - r * 0.04, hw * 0.6);
      ctx.stroke();
    } else if (type === 'burst') {
      ctx.save();
      ctx.clip();
      ctx.fillStyle = 'rgba(255,237,78,0.95)';
      ctx.fillRect(x1 + headLen * 0.2, -hw, tip, hw * 2);
      ctx.restore();
      // Two clean speed notches at the base
      ctx.strokeStyle = 'rgba(255,246,200,0.85)';
      ctx.lineWidth = Math.max(2, r * 0.06);
      for (let i = 0; i < 2; i++) {
        const bx = x0 + r * (0.22 + i * 0.2);
        ctx.beginPath();
        ctx.moveTo(bx, -sw * 0.55);
        ctx.lineTo(bx + r * 0.15, 0);
        ctx.lineTo(bx, sw * 0.55);
        ctx.stroke();
      }
    } else if (type === 'glass') {
      // Facet seams and a diamond glint
      ctx.strokeStyle = 'rgba(255,255,255,0.78)';
      ctx.lineWidth = Math.max(1, r * 0.035);
      ctx.beginPath();
      ctx.moveTo(x0 + shaftLen * 0.3, -sw * 0.9);
      ctx.lineTo(x1, 0);
      ctx.moveTo(x0 + shaftLen * 0.55, sw * 0.9);
      ctx.lineTo(x1, -hw * 0.2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.moveTo(tip + r * 0.1, 0);
      ctx.lineTo(x1 + headLen * 0.2, -hw * 0.34);
      ctx.lineTo(x1 + headLen * 0.05, 0);
      ctx.lineTo(x1 + headLen * 0.2, hw * 0.34);
      ctx.closePath();
      ctx.fill();
    } else if (type === 'poison') {
      // Poison: dark core vein + two clean barbs
      ctx.strokeStyle = 'rgba(22,64,20,0.55)';
      ctx.lineWidth = Math.max(2.4, r * 0.1);
      ctx.beginPath();
      ctx.moveTo(x0 + r * 0.08, 0);
      ctx.lineTo(x1, 0);
      ctx.stroke();
      ctx.fillStyle = '#a7ea6c';
      for (const sign of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x1 - headLen * 0.2, sign * hw * 0.5);
        ctx.lineTo(x1 - headLen * 0.52, sign * hw * 1.28);
        ctx.lineTo(x1 + headLen * 0.02, sign * hw * 0.82);
        ctx.closePath();
        ctx.fill();
      }
      ctx.save();
      ctx.shadowColor = accent;
      ctx.shadowBlur = r * 0.3;
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(tip + r * 0.06, 0, r * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (type === 'shackles') {
      // Steel chain links along the shaft
      for (let i = 0; i < 4; i++) {
        const cx = x0 + r * 0.24 + i * (shaftLen - r * 0.2) / 4;
        ctx.beginPath();
        if (i % 2) ctx.ellipse(cx, 0, r * 0.13, sw * 0.28, 0, 0, Math.PI * 2);
        else ctx.ellipse(cx, 0, r * 0.15, sw * 0.62, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(20,12,44,0.75)';
        ctx.lineWidth = Math.max(2.4, r * 0.09);
        ctx.stroke();
        ctx.strokeStyle = i % 2 ? '#c4cbd8' : '#f2f5fb';
        ctx.lineWidth = Math.max(1.4, r * 0.05);
        ctx.stroke();
      }
    } else if (type === 'machine') {
      // Ammo belt of brass rounds
      for (let i = 0; i < 3; i++) {
        const bx = x0 + r * 0.22 + i * (shaftLen - r * 0.25) / 3;
        const round = ctx.createLinearGradient(0, -sw * 0.65, 0, sw * 0.65);
        round.addColorStop(0, '#fff2c6');
        round.addColorStop(0.5, '#ffc450');
        round.addColorStop(1, '#9c6616');
        roundedRect(bx, -sw * 0.62, r * 0.22, sw * 1.24, sw * 0.6);
        ctx.fillStyle = round;
        ctx.fill();
        ctx.fillStyle = 'rgba(110,70,14,0.9)';
        ctx.fillRect(bx, -sw * 0.62, Math.max(1, r * 0.04), sw * 1.24);
      }
    } else if (type === 'fibonacci') {
      // Golden spine with golden-ratio notches
      ctx.save();
      shape();
      ctx.clip();
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(2, r * 0.07);
      ctx.beginPath();
      ctx.moveTo(x0 + r * 0.1, 0);
      ctx.lineTo(x1 + headLen * 0.4, 0);
      ctx.stroke();
      for (const f of [0.382, 0.618]) {
        const nx = x0 + shaftLen * f;
        ctx.beginPath();
        ctx.moveTo(nx, -sw * 0.85);
        ctx.lineTo(nx, sw * 0.85);
        ctx.stroke();
      }
      ctx.restore();
    } else if (type === 'bomb') {
      // Burning fuse spark at the tip
      ctx.strokeStyle = 'rgba(18,6,32,0.55)';
      ctx.lineWidth = Math.max(2, r * 0.08);
      ctx.beginPath();
      ctx.moveTo(x0 + r * 0.1, 0);
      ctx.lineTo(x1, 0);
      ctx.stroke();
      const flick = 0.75 + Math.sin(clock * 30) * 0.25;
      const sr = r * 0.34 * flick;
      const spark = ctx.createRadialGradient(tip, 0, 0, tip, 0, sr);
      spark.addColorStop(0, 'rgba(255,255,230,1)');
      spark.addColorStop(0.35, 'rgba(255,190,60,0.9)');
      spark.addColorStop(1, 'rgba(255,90,20,0)');
      ctx.fillStyle = spark;
      ctx.beginPath();
      ctx.arc(tip, 0, sr, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'zone') {
      // Concentric zone arcs
      ctx.save();
      shape();
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,224,228,0.85)';
      ctx.lineWidth = Math.max(1.6, r * 0.055);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(x0 + r * 0.05, 0, r * (0.3 + i * 0.24), -0.6, 0.6);
        ctx.stroke();
      }
      ctx.restore();
    } else if (type === 'spider') {
      // Silk web woven across the shaft
      ctx.save();
      shape();
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = Math.max(1, r * 0.035);
      const cx = x0 + shaftLen * 0.12;
      for (let i = 0; i < 7; i++) {
        const a = -1.3 + i * 0.43;
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx + Math.cos(a) * r * 2.4, Math.sin(a) * r * 2.4);
        ctx.stroke();
      }
      for (const rr of [0.4, 0.8, 1.25, 1.75]) {
        ctx.beginPath();
        for (let i = 0; i < 7; i++) {
          const a = -1.3 + i * 0.43;
          const px = cx + Math.cos(a) * r * rr;
          const py = Math.sin(a) * r * rr;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.restore();
      // A single silk thread trailing off the tip
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tip, 0);
      ctx.quadraticCurveTo(tip + r * 0.3, r * 0.25 + Math.sin(clock * 3) * r * 0.08, tip + r * 0.5, r * 0.55);
      ctx.stroke();
    } else if (type === 'snake') {
      // Scales along the body and a flicking forked tongue
      ctx.save();
      shape();
      ctx.clip();
      ctx.strokeStyle = 'rgba(10,40,16,0.5)';
      ctx.lineWidth = 1;
      const st = r * 0.16;
      let row = 0;
      for (let yy = -hw; yy <= hw; yy += st * 0.7, row++) {
        for (let xx = x0; xx < tip + st; xx += st) {
          ctx.beginPath();
          ctx.arc(xx + (row % 2 ? st * 0.5 : 0), yy, st * 0.55, 0.25, Math.PI - 0.25);
          ctx.stroke();
        }
      }
      ctx.restore();
      if (Math.sin(clock * 6) > 0.2) {
        ctx.strokeStyle = accent;
        ctx.lineWidth = Math.max(1.4, r * 0.05);
        ctx.beginPath();
        ctx.moveTo(tip, 0);
        ctx.lineTo(tip + r * 0.3, 0);
        ctx.lineTo(tip + r * 0.44, -r * 0.11);
        ctx.moveTo(tip + r * 0.3, 0);
        ctx.lineTo(tip + r * 0.44, r * 0.11);
        ctx.stroke();
      }
    } else if (type === 'cannon') {
      // Brass bands with a cannonball loaded on the tip
      ctx.save();
      shape();
      ctx.clip();
      const brass = ctx.createLinearGradient(0, -hw, 0, hw);
      brass.addColorStop(0, '#ffe2a4');
      brass.addColorStop(0.5, '#c8902f');
      brass.addColorStop(1, '#6e4710');
      ctx.fillStyle = brass;
      for (const f of [0.22, 0.68]) ctx.fillRect(x0 + shaftLen * f, -hw, r * 0.14, hw * 2);
      ctx.fillRect(x1 - headLen * 0.12, -hw, r * 0.12, hw * 2);
      ctx.restore();
      const cr = r * 0.24;
      const bx = tip + cr * 0.55;
      const cg = ctx.createRadialGradient(bx - cr * 0.35, -cr * 0.4, cr * 0.05, bx, 0, cr);
      cg.addColorStop(0, '#a7aab3');
      cg.addColorStop(0.5, '#3b3d45');
      cg.addColorStop(1, '#0c0c10');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(bx, 0, cr, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'dice') {
      // Pip groups showing 1, 2 and 3 along the shaft, red pip in the head
      const pr = Math.max(1.4, r * 0.055);
      const pip = (px, py) => {
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
      };
      const seg = shaftLen / 3;
      ctx.strokeStyle = 'rgba(120,108,84,0.45)';
      ctx.lineWidth = 1;
      for (let k = 1; k < 3; k++) {
        ctx.beginPath();
        ctx.moveTo(x0 + seg * k, -sw * 0.9);
        ctx.lineTo(x0 + seg * k, sw * 0.9);
        ctx.stroke();
      }
      ctx.fillStyle = '#1a1a1a';
      pip(x0 + seg * 0.5, 0);
      pip(x0 + seg * 1.32, -sw * 0.42);
      pip(x0 + seg * 1.68, sw * 0.42);
      pip(x0 + seg * 2.22, -sw * 0.48);
      pip(x0 + seg * 2.5, 0);
      pip(x0 + seg * 2.78, sw * 0.48);
      ctx.fillStyle = '#e8303a';
      ctx.beginPath();
      ctx.arc(x1 + headLen * 0.25, 0, pr * 1.6, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'hive') {
      // Honeycomb shaft and a striped stinger head
      ctx.save();
      shape();
      ctx.clip();
      const hs = r * 0.14;
      const hwid = hs * Math.sqrt(3);
      ctx.strokeStyle = 'rgba(96,46,0,0.5)';
      ctx.lineWidth = 1;
      for (let row = -3; row <= 3; row++) {
        for (let xx = x0; xx < x1; xx += hwid) {
          hexagon(xx + (row % 2 ? hwid * 0.5 : 0), row * hs * 1.5, hs * 0.92);
          ctx.stroke();
        }
      }
      ctx.fillStyle = 'rgba(30,16,4,0.88)';
      for (let k = 0; k < 2; k++) ctx.fillRect(x1 + headLen * (0.08 + k * 0.3), -hw, headLen * 0.13, hw * 2);
      ctx.restore();
    } else if (type === 'thief') {
      // Dagger: leather grip, brass crossguard, a fuller groove and a sliding gleam
      ctx.save();
      shape();
      ctx.clip();
      const gripEnd = x0 + shaftLen * 0.34;
      ctx.fillStyle = '#4a2a12';
      ctx.fillRect(x0 - 2, -hw, gripEnd - x0 + 2, hw * 2);
      ctx.strokeStyle = 'rgba(255,214,160,0.35)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const gx = x0 + i * shaftLen * 0.07;
        ctx.beginPath();
        ctx.moveTo(gx, -sw);
        ctx.lineTo(gx + shaftLen * 0.05, sw);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(60,70,88,0.6)';
      ctx.lineWidth = Math.max(1, r * 0.04);
      ctx.beginPath();
      ctx.moveTo(gripEnd + r * 0.12, 0);
      ctx.lineTo(x1 + headLen * 0.5, 0);
      ctx.stroke();
      const gp = gripEnd + ((clock * 0.7) % 1) * (tip - gripEnd);
      const gl = ctx.createLinearGradient(gp - r * 0.3, 0, gp + r * 0.3, 0);
      gl.addColorStop(0, 'rgba(255,255,255,0)');
      gl.addColorStop(0.5, 'rgba(255,255,255,0.75)');
      gl.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(Math.max(gripEnd, gp - r * 0.3), -hw, r * 0.6, hw * 2);
      ctx.restore();
      const guard = ctx.createLinearGradient(0, -sw * 1.9, 0, sw * 1.9);
      guard.addColorStop(0, '#ffe2a4');
      guard.addColorStop(0.5, '#c8902f');
      guard.addColorStop(1, '#6e4710');
      roundedRect(gripEnd, -sw * 1.9, r * 0.13, sw * 3.8, r * 0.05);
      ctx.fillStyle = guard;
      ctx.fill();
      ctx.strokeStyle = 'rgba(40,24,6,0.8)';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (type === 'axe') {
      // Wood grain shaft with a steel axe blade mounted on the head
      ctx.save();
      shape();
      ctx.clip();
      ctx.strokeStyle = 'rgba(60,32,10,0.45)';
      ctx.lineWidth = 1;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(x0, i * sw * 0.35);
        ctx.bezierCurveTo(x0 + shaftLen * 0.3, i * sw * 0.35 + sw * 0.2, x0 + shaftLen * 0.6, i * sw * 0.35 - sw * 0.2, tip, i * sw * 0.3);
        ctx.stroke();
      }
      ctx.restore();
      const ax = x1 - headLen * 0.05;
      ctx.beginPath();
      ctx.moveTo(ax - headLen * 0.12, -sw * 0.7);
      ctx.lineTo(ax + headLen * 0.5, -sw * 0.7);
      ctx.quadraticCurveTo(ax + headLen * 0.85, -hw * 0.9, ax + headLen * 0.62, -hw * 1.7);
      ctx.quadraticCurveTo(ax + headLen * 0.2, -hw * 2.05, ax - headLen * 0.25, -hw * 1.7);
      ctx.quadraticCurveTo(ax - headLen * 0.38, -hw * 0.95, ax - headLen * 0.12, -sw * 0.7);
      ctx.closePath();
      const steel = ctx.createLinearGradient(0, -hw * 1.9, 0, -sw);
      steel.addColorStop(0, '#f6f8fc');
      steel.addColorStop(0.5, '#a7b0bd');
      steel.addColorStop(1, '#4d5562');
      ctx.fillStyle = steel;
      ctx.fill();
      ctx.strokeStyle = 'rgba(20,24,32,0.85)';
      ctx.lineWidth = Math.max(1.2, r * 0.04);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ax + headLen * 0.62, -hw * 1.7);
      ctx.quadraticCurveTo(ax + headLen * 0.2, -hw * 2.05, ax - headLen * 0.25, -hw * 1.7);
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = Math.max(1, r * 0.04);
      ctx.stroke();
    } else if (type === 'charge') {
      // Battery cells that light up one after another, with a plus on the head
      const cells = 4;
      const cx0 = x0 + r * 0.14;
      const cw = (shaftLen - r * 0.3) / cells;
      const lit = Math.floor((clock * 4) % (cells + 2));
      for (let i = 0; i < cells; i++) {
        roundedRect(cx0 + i * cw, -sw * 0.55, cw - r * 0.05, sw * 1.1, r * 0.04);
        if (i < lit) {
          ctx.save();
          ctx.shadowColor = '#ff4fb8';
          ctx.shadowBlur = 8;
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.restore();
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          ctx.fill();
        }
      }
      const px = x1 + headLen * 0.28;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1.6, r * 0.07);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px - r * 0.11, 0);
      ctx.lineTo(px + r * 0.11, 0);
      ctx.moveTo(px, -r * 0.11);
      ctx.lineTo(px, r * 0.11);
      ctx.stroke();
    } else if (type === 'frost') {
      // Icicle: crystal facets, a snowflake at the base and icy spikes on the head
      ctx.save();
      shape();
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = Math.max(1, r * 0.03);
      ctx.beginPath();
      ctx.moveTo(x0 + shaftLen * 0.2, -sw);
      ctx.lineTo(x0 + shaftLen * 0.45, sw);
      ctx.moveTo(x0 + shaftLen * 0.55, -sw);
      ctx.lineTo(x0 + shaftLen * 0.8, sw);
      ctx.moveTo(x1, -hw * 0.5);
      ctx.lineTo(tip - headLen * 0.2, 0);
      ctx.stroke();
      ctx.restore();
      ctx.lineCap = 'round';
      flakePath(x0 + r * 0.32, 0, sw * 0.95);
      ctx.strokeStyle = 'rgba(40,100,160,0.6)';
      ctx.lineWidth = Math.max(2, r * 0.07);
      ctx.stroke();
      flakePath(x0 + r * 0.32, 0, sw * 0.95);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, r * 0.035);
      ctx.stroke();
      ctx.fillStyle = 'rgba(235,248,255,0.95)';
      for (const sgn of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x1 - headLen * 0.05, sgn * hw * 0.62);
        ctx.lineTo(x1 - headLen * 0.3, sgn * hw * 1.05);
        ctx.lineTo(x1 + headLen * 0.12, sgn * hw * 0.6);
        ctx.closePath();
        ctx.fill();
      }
      const tw = 0.5 + Math.sin(clock * 6) * 0.5;
      const sx = tip - headLen * 0.25;
      const sy = -hw * 0.25;
      ctx.strokeStyle = `rgba(255,255,255,${tw})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(sx - r * 0.1, sy);
      ctx.lineTo(sx + r * 0.1, sy);
      ctx.moveTo(sx, sy - r * 0.1);
      ctx.lineTo(sx, sy + r * 0.1);
      ctx.stroke();
    } else if (type === 'apple') {
      // Leaf fletching and a stem at the tail, with a shine along the skin
      for (const sgn of [-1, 1]) {
        ctx.save();
        ctx.translate(x0 + r * 0.22, sgn * sw * 0.7);
        ctx.rotate(Math.PI - sgn * 0.55);
        const lg = ctx.createLinearGradient(0, -r * 0.16, 0, r * 0.16);
        lg.addColorStop(0, '#b8f07a');
        lg.addColorStop(1, '#3a8a20');
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(r * 0.25, -r * 0.18, r * 0.52, 0);
        ctx.quadraticCurveTo(r * 0.25, r * 0.18, 0, 0);
        ctx.fill();
        ctx.strokeStyle = 'rgba(30,80,20,0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(r * 0.46, 0);
        ctx.stroke();
        ctx.restore();
      }
      ctx.strokeStyle = '#6b3d16';
      ctx.lineWidth = Math.max(1.4, r * 0.07);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x0, 0);
      ctx.quadraticCurveTo(x0 - r * 0.12, -r * 0.02, x0 - r * 0.24, -r * 0.12);
      ctx.stroke();
      ctx.save();
      shape();
      ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.32)';
      ctx.beginPath();
      ctx.ellipse(x0 + shaftLen * 0.55, -sw * 0.45, shaftLen * 0.38, sw * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Bright leading edge to the tip
    ctx.save();
    shape();
    ctx.clip();
    const lead = ctx.createLinearGradient(x1 - headLen * 0.4, 0, tip, 0);
    lead.addColorStop(0, 'rgba(255,255,255,0)');
    lead.addColorStop(1, 'rgba(255,255,255,0.55)');
    ctx.fillStyle = lead;
    ctx.fillRect(x0, -hw, shaftLen + headLen * 1.2, hw * 2);
    ctx.restore();

    ctx.restore();
  }

  function freshBarIcon(type, cx, cy, s, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(1.2, s * 0.26);
    ctx.lineJoin = 'round';
    if (type === 'glass') {
      ctx.beginPath();
      ctx.moveTo(cx, cy - s);
      ctx.lineTo(cx + s * 0.78, cy);
      ctx.lineTo(cx, cy + s);
      ctx.lineTo(cx - s * 0.78, cy);
      ctx.closePath();
      ctx.stroke();
    } else if (type === 'electric') {
      boltEmblemPath(cx, cy, s, 1);
      ctx.fill();
    } else if (type === 'burst') {
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.8, cy - s * 0.55);
      ctx.lineTo(cx + s * 0.1, cy - s * 0.55);
      ctx.lineTo(cx - s * 0.15, cy + s * 0.1);
      ctx.lineTo(cx + s * 0.8, cy + s * 0.1);
      ctx.lineTo(cx - s * 0.1, cy + s * 0.9);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(cx, cy - s);
      ctx.quadraticCurveTo(cx + s * 0.9, cy + s * 0.15, cx, cy + s);
      ctx.quadraticCurveTo(cx - s * 0.9, cy + s * 0.15, cx, cy - s);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFreshBar(b) {
    if (!b.alive) return;
    const type = b.type;
    const width = clamp(b.r * 2.3, 60, 96);
    const height = clamp(b.r * 0.27, 9, 12);
    const gap = Math.max(12, b.r * 0.34);
    const x = clamp(b.x - width * 0.5, arena.x + 14, arena.x + arena.w - width - 14);
    let y = b.y - b.r - gap - height;
    if (y < arena.y + 8) y = b.y + b.r + gap;
    y = clamp(y, arena.y + 8, arena.y + arena.h - height - 8);

    const hpFrac = clamp(b.health / b.maxHealth, 0, 1);
    const shownFrac = clamp(b.shownHealth / b.maxHealth, 0, 1);
    const accent = freshAccent(type);
    const theme = type === 'electric' ? { r: 90, g: 207, b: 255 }
      : type === 'burst' ? { r: 255, g: 152, b: 40 }
      : type === 'glass' ? { r: 140, g: 240, b: 234 }
      : { r: 140, g: 226, b: 92 };

    const iconW = height * 1.25;
    const bx = x + iconW;
    const bw = width - iconW * 1.1;
    const by = y + height * 0.5 - height * 0.32;
    const bh = height * 0.64;

    ctx.save();

    // Capsule track
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    roundedRect(x, y, width, height, height * 0.5);
    ctx.fillStyle = 'rgba(9,12,22,0.9)';
    ctx.fill();
    ctx.restore();

    // Icon badge
    ctx.save();
    roundedRect(x + 1, y + 1, iconW, height - 2, (height - 2) * 0.5);
    ctx.fillStyle = rgba(theme, 0.16);
    ctx.fill();
    ctx.restore();
    freshBarIcon(type, x + iconW * 0.52, y + height * 0.5, height * 0.28, accent);

    // Inner fill
    ctx.save();
    roundedRect(bx, by, bw, bh, bh * 0.5);
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = rgba(theme, 0.4);
    ctx.fillRect(bx, by, bw * shownFrac, bh);
    const fill = ctx.createLinearGradient(0, by, 0, by + bh);
    if (type === 'electric') {
      fill.addColorStop(0, '#e8ffff');
      fill.addColorStop(0.5, '#75ddff');
      fill.addColorStop(1, '#0789d6');
    } else if (type === 'burst') {
      fill.addColorStop(0, '#fff2a0');
      fill.addColorStop(0.5, '#ff9d24');
      fill.addColorStop(1, '#c34505');
    } else if (type === 'glass') {
      fill.addColorStop(0, '#ffffff');
      fill.addColorStop(0.5, '#a8f0ec');
      fill.addColorStop(1, '#3fa9ad');
    } else {
      fill.addColorStop(0, '#e9ffc0');
      fill.addColorStop(0.5, '#8fdd55');
      fill.addColorStop(1, '#3a7a2c');
    }
    ctx.fillStyle = fill;
    ctx.fillRect(bx, by, bw * hpFrac, bh);
    // Gloss stripe
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(bx, by, bw * hpFrac, Math.max(1.2, bh * 0.32));
    // Fine segment ticks
    ctx.strokeStyle = 'rgba(6,10,18,0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < 4; i++) {
      const tx = bx + (bw * i) / 4;
      ctx.moveTo(tx, by);
      ctx.lineTo(tx, by + bh);
    }
    ctx.stroke();
    ctx.restore();

    // Glowing leading edge
    if (hpFrac > 0.02) {
      const ex = bx + bw * hpFrac;
      ctx.save();
      ctx.shadowColor = accent;
      ctx.shadowBlur = 10;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(ex, by);
      ctx.lineTo(ex, by + bh);
      ctx.stroke();
      ctx.restore();
    }

    // Rim
    roundedRect(x + 0.5, y + 0.5, width - 1, height - 1, height * 0.5);
    ctx.strokeStyle = rgba(theme, 0.55);
    ctx.lineWidth = 1.1;
    ctx.stroke();

    ctx.restore();
  }

  function drawFreshHeart(x, y, size, type, side, filled, alpha, scale) {
    if (alpha <= 0) return;
    const pal = getPalette(type, side);
    const stops = freshStops(type);
    const accent = freshAccent(type);

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    ctx.lineJoin = 'round';

    if (!filled) {
      heartPath(size);
      ctx.fillStyle = 'rgba(8,11,19,0.85)';
      ctx.fill();
      heartPath(size);
      ctx.strokeStyle = rgba(pal.color, 0.3);
      ctx.lineWidth = Math.max(1, size * 0.05);
      ctx.stroke();
      ctx.restore();
      return;
    }

    // Outer glow
    ctx.save();
    heartPath(size);
    ctx.shadowColor = rgba(type === 'burst' ? { r: 255, g: 200, b: 70 } : pal.color, 0.65);
    ctx.shadowBlur = size * 0.4;
    ctx.shadowOffsetY = size * 0.1;
    const shell = ctx.createLinearGradient(0, -size * 0.6, 0, size * 0.44);
    shell.addColorStop(0, stops[1]);
    shell.addColorStop(0.5, stops[2]);
    shell.addColorStop(1, stops[3]);
    ctx.fillStyle = shell;
    ctx.fill();
    ctx.restore();

    // Inner 3D shading
    ctx.save();
    heartPath(size);
    ctx.clip();
    const body = ctx.createRadialGradient(-size * 0.22, -size * 0.32, 0, 0, size * 0.04, size * 0.74);
    body.addColorStop(0, 'rgba(255,255,255,0.75)');
    body.addColorStop(0.5, 'rgba(255,255,255,0.08)');
    body.addColorStop(1, 'rgba(0,0,0,0.34)');
    ctx.fillStyle = body;
    ctx.fillRect(-size * 0.7, -size * 0.75, size * 1.4, size * 1.35);

    if (type === 'glass') {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.moveTo(-size * 0.38, size * 0.02);
      ctx.lineTo(0, -size * 0.2);
      ctx.lineTo(-size * 0.1, size * 0.34);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = Math.max(0.9, size * 0.03);
      ctx.beginPath();
      ctx.moveTo(-size * 0.3, -size * 0.1);
      ctx.lineTo(size * 0.34, -size * 0.24);
      ctx.stroke();
    } else if (type === 'electric') {
      ctx.save();
      ctx.shadowColor = accent;
      ctx.shadowBlur = size * 0.24;
      boltEmblemPath(0, -size * 0.06, size * 0.3, 1);
      ctx.fillStyle = accent;
      ctx.fill();
      ctx.restore();
    } else if (type === 'burst') {
      ctx.save();
      ctx.shadowColor = accent;
      ctx.shadowBlur = size * 0.24;
      ctx.fillStyle = accent;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 - Math.PI / 2;
        const rad = i % 2 ? size * 0.06 : size * 0.17;
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad - size * 0.05;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(16,54,16,0.4)';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(-size * 0.12 + i * size * 0.12, size * 0.04 + (i % 2) * size * 0.1, size * 0.045, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(235,255,190,0.75)';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(-size * 0.14 + i * size * 0.12, size * 0.02 + (i % 2) * size * 0.1, size * 0.021, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Soft gloss
    const gloss = ctx.createRadialGradient(-size * 0.2, -size * 0.3, 0, -size * 0.2, -size * 0.3, size * 0.3);
    gloss.addColorStop(0, 'rgba(255,255,255,0.85)');
    gloss.addColorStop(0.4, 'rgba(255,255,255,0.22)');
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gloss;
    ctx.fillRect(-size * 0.6, -size * 0.65, size * 1.2, size * 1.2);
    ctx.restore();

    heartPath(size);
    ctx.strokeStyle = type === 'burst' ? 'rgba(255,220,90,0.8)' : 'rgba(255,255,255,0.5)';
    ctx.lineWidth = Math.max(1, size * 0.045);
    ctx.stroke();

    ctx.restore();
  }

  function drawSingleBlade(x, y, r, angle, alpha, isMini) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;

    const base = r * 0.88;
    const len = r * (isMini ? 0.72 : 1.05);
    const bw = r * (isMini ? 0.19 : 0.17);

    // Subtle curved motion-blur slash trail behind blade
    ctx.save();
    const trailGrad = ctx.createLinearGradient(base, -bw * 2.4, base + len, 0);
    trailGrad.addColorStop(0, 'rgba(127,250,255,0)');
    trailGrad.addColorStop(1, 'rgba(127,250,255,0.34)');
    ctx.fillStyle = trailGrad;
    ctx.beginPath();
    ctx.arc(0, 0, base + len * 0.98, -0.42, 0.01);
    ctx.arc(0, 0, base + len * 0.25, 0.01, -0.42, true);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Blade mount collar
    ctx.fillStyle = '#363c4b';
    ctx.strokeStyle = '#7ffaff';
    ctx.lineWidth = Math.max(1, r * 0.04);
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(base - r * 0.08, -bw * 1.05, r * 0.22, bw * 2.1, r * 0.06)
                  : ctx.rect(base - r * 0.08, -bw * 1.05, r * 0.22, bw * 2.1);
    ctx.fill();
    ctx.stroke();

    // Upper bright steel bevel
    ctx.save();
    ctx.shadowColor = 'rgba(127,250,255,0.7)';
    ctx.shadowBlur = r * 0.22;
    ctx.beginPath();
    ctx.moveTo(base + r * 0.08, -bw);
    ctx.lineTo(base + len * 0.72, -bw * 0.85);
    ctx.lineTo(base + len, 0);
    ctx.lineTo(base + r * 0.08, 0);
    ctx.closePath();
    const topSteel = ctx.createLinearGradient(base, -bw, base + len, 0);
    topSteel.addColorStop(0, '#c8ccd4');
    topSteel.addColorStop(0.65, '#f2f6ff');
    topSteel.addColorStop(1, '#ffffff');
    ctx.fillStyle = topSteel;
    ctx.fill();
    ctx.restore();

    // Lower darker gunmetal bevel
    ctx.beginPath();
    ctx.moveTo(base + r * 0.08, 0);
    ctx.lineTo(base + len, 0);
    ctx.lineTo(base + len * 0.72, bw * 0.85);
    ctx.lineTo(base + r * 0.08, bw);
    ctx.closePath();
    const botSteel = ctx.createLinearGradient(base, 0, base + len, bw);
    botSteel.addColorStop(0, '#4f5666');
    botSteel.addColorStop(0.7, '#7e8696');
    botSteel.addColorStop(1, '#c9d4e3');
    ctx.fillStyle = botSteel;
    ctx.fill();

    // Glowing cyan energy core spine
    ctx.strokeStyle = '#7ffaff';
    ctx.lineWidth = Math.max(1.2, r * 0.055);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(base + r * 0.14, 0);
    ctx.lineTo(base + len * 0.78, 0);
    ctx.stroke();

    // Crisp dark edge outline
    ctx.strokeStyle = 'rgba(20,26,38,0.85)';
    ctx.lineWidth = Math.max(1, r * 0.032);
    ctx.beginPath();
    ctx.moveTo(base + r * 0.08, -bw);
    ctx.lineTo(base + len * 0.72, -bw * 0.85);
    ctx.lineTo(base + len, 0);
    ctx.lineTo(base + len * 0.72, bw * 0.85);
    ctx.lineTo(base + r * 0.08, bw);
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
  }

  function drawVampireFangs(x, y, r, facing, biteAmount) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(facing);

    const fangLen = r * (0.48 - biteAmount * 0.1);
    const fangW = r * 0.16;
    const spread = r * 0.34;
    const baseX = r * 0.82;

    for (const sign of [-1, 1]) {
      ctx.save();
      ctx.translate(baseX, sign * spread);
      ctx.rotate(-sign * 0.14);

      // Soft shadow beneath fang
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = r * 0.16;
      ctx.shadowOffsetY = r * 0.05;

      // Sculpted conical ivory fang (#fcfbfc)
      const grad = ctx.createLinearGradient(0, -fangW, fangLen, fangW);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.55, '#f2edf2');
      grad.addColorStop(1, '#c9bdc8');

      ctx.beginPath();
      ctx.moveTo(-r * 0.12, -fangW);
      ctx.quadraticCurveTo(fangLen * 0.48, -fangW * 0.65, fangLen, 0);
      ctx.quadraticCurveTo(fangLen * 0.48, fangW * 0.65, -r * 0.12, fangW);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Subtle dark crimson root collar
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(72,6,18,0.85)';
      ctx.lineWidth = Math.max(1, r * 0.038);
      ctx.stroke();

      // Bright ridge gleam on tooth
      ctx.strokeStyle = 'rgba(255,255,255,0.92)';
      ctx.lineWidth = Math.max(1, r * 0.032);
      ctx.beginPath();
      ctx.moveTo(0, -fangW * 0.32);
      ctx.lineTo(fangLen * 0.72, -fangW * 0.08);
      ctx.stroke();

      ctx.restore();
    }
    ctx.restore();
  }

  function drawLaserRingHalf(x, y, r, tilt, front) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.scale(1, 0.34);

    const startA = front ? 0 : Math.PI;
    const endA = front ? Math.PI : Math.PI * 2;
    const ringR = r * 1.38;

    ctx.shadowColor = 'rgba(254,178,255,0.95)';
    ctx.shadowBlur = front ? 16 : 8;
    ctx.strokeStyle = front ? '#feb2ff' : 'rgba(182,82,255,0.62)';
    ctx.lineWidth = front ? Math.max(3, r * 0.14) : Math.max(2.2, r * 0.11);
    ctx.beginPath();
    ctx.arc(0, 0, ringR, startA, endA);
    ctx.stroke();

    if (front) {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = Math.max(1.2, r * 0.048);
      ctx.beginPath();
      ctx.arc(0, 0, ringR, startA + 0.1, endA - 0.1);
      ctx.stroke();
    }

    // Orbiting plasma bead on ring
    const orbA = (clock * 3.1) % (Math.PI * 2);
    const inFront = orbA >= 0 && orbA <= Math.PI;
    if (inFront === front) {
      const ox = Math.cos(orbA) * ringR;
      const oy = Math.sin(orbA) * ringR;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#feb2ff';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(ox, oy, r * 0.13, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawBallModel(opts) {
    const {
      x, y, r, type, color, dark, accent, glow,
      facing, hit, hitAngle, healPulse, morphPulse,
      bladeCount, bladeAngle, side, isMini, isLatched, dashActive, frozen, health
    } = opts;

    if (isFresh(type)) {
      drawFreshBall(opts);
      return;
    }

    const ringTilt = -0.35 + Math.sin(clock * 1.7 + (side === 'blue' ? 2 : 0)) * 0.22;

    // Soft ambient aura behind ball
    const auraR = r * (isMini ? 1.65 : 2.15);
    const aura = ctx.createRadialGradient(x, y, r * 0.25, x, y, auraR);
    aura.addColorStop(0, rgba(glow || color, (isMini ? 0.2 : 0.18) + (hit || 0) * 0.15));
    aura.addColorStop(1, rgba(glow || color, 0));
    ctx.fillStyle = aura;
    ctx.fillRect(x - auraR, y - auraR, auraR * 2, auraR * 2);

    // Subtle team floor ring on main arena balls so ownership is unmistakable
    if (!isMini) {
      const teamCol = side === 'red' ? { r: 255, g: 100, b: 120 } : { r: 80, g: 190, b: 255 };
      ctx.save();
      ctx.strokeStyle = rgba(teamCol, 0.28);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r * 1.15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Back half of Laser Ball's 3D tilted halo ring
    if (type === 'laser') {
      drawLaserRingHalf(x, y, r, ringTilt, false);
    }

    // Orbiting blades for Blade Ball (drawn behind/around sphere)
    if (type === 'blade') {
      const count = bladeCount || 1;
      // Subtle cyan orbit guide ring
      if (!isMini) {
        ctx.save();
        ctx.strokeStyle = 'rgba(127,250,255,0.16)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 6]);
        ctx.beginPath();
        ctx.arc(x, y, r * 1.38, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      for (let i = 0; i < count; i++) {
        const a = (bladeAngle || 0) + (i * Math.PI * 2) / count;
        drawSingleBlade(x, y, r, a, 1, isMini);
      }
    }

    ctx.save();
    ctx.translate(x, y);
    if (morphPulse > 0) {
      const s = 1 + Math.sin(morphPulse * Math.PI) * 0.18;
      ctx.scale(s, s);
    }
    if (hit > 0) {
      ctx.rotate(hitAngle || 0);
      ctx.scale(1 - hit * 0.12, 1 + hit * 0.07);
      ctx.rotate(-(hitAngle || 0));
    }
    ctx.translate(-x, -y);

    // Ground drop shadow
    ctx.save();
    ctx.globalAlpha = isMini ? 0.3 : 0.38;
    const sg = ctx.createRadialGradient(x + r * 0.2, y + r * 0.92, r * 0.08, x + r * 0.2, y + r * 0.92, r * 1.12);
    sg.addColorStop(0, 'rgba(0,0,0,0.92)');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.ellipse(x + r * 0.2, y + r * 0.92, r * 1.05, r * 0.46, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Base 3D sphere shading customized per ball type
    const body = ctx.createRadialGradient(x - r * 0.36, y - r * 0.38, r * 0.04, x, y, r);
    if (type === 'blade') {
      body.addColorStop(0, '#f4f7fc');
      body.addColorStop(0.28, '#b5b9c2');
      body.addColorStop(0.68, '#5f6778');
      body.addColorStop(1, '#232836');
    } else if (type === 'vampire') {
      body.addColorStop(0, '#ff6870');
      body.addColorStop(0.32, '#cf242c');
      body.addColorStop(0.78, '#660916');
      body.addColorStop(1, '#280208');
    } else if (type === 'laser') {
      body.addColorStop(0, '#ffe3ff');
      body.addColorStop(0.26, '#c14dff');
      body.addColorStop(0.68, '#791ed3');
      body.addColorStop(1, '#240548');
    } else if (type === 'glass') {
      body.addColorStop(0, '#ffffff');
      body.addColorStop(0.22, '#d4fbf7');
      body.addColorStop(0.55, '#7fd9d6');
      body.addColorStop(0.85, '#2f8398');
      body.addColorStop(1, '#0e3444');
    } else if (type === 'electric') {
      body.addColorStop(0, '#e4edff');
      body.addColorStop(0.24, '#7ba4ff');
      body.addColorStop(0.65, '#3d59d8');
      body.addColorStop(1, '#101a56');
    } else if (type === 'burst') {
      body.addColorStop(0, '#fff8cc');
      body.addColorStop(0.2, '#ffd63f');
      body.addColorStop(0.58, '#ef7724');
      body.addColorStop(1, '#7d2504');
    } else if (type === 'poison') {
      body.addColorStop(0, '#f2ffc9');
      body.addColorStop(0.22, '#b1ec6c');
      body.addColorStop(0.62, '#4d9f34');
      body.addColorStop(1, '#173f16');
    } else {
      body.addColorStop(0, rgba(lighten(color, 120), 1));
      body.addColorStop(0.35, rgba(color, 1));
      body.addColorStop(0.82, rgba(dark, 1));
      body.addColorStop(1, rgba(darken(dark, 0.42), 1));
    }
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // Type-specific surface details clipped to sphere
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();

    if (type === 'blade') {
      // Official neon-cyan stripe wrapping around metallic sphere
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((bladeAngle || 0) * 0.25);
      ctx.strokeStyle = 'rgba(18,24,36,0.75)';
      ctx.lineWidth = r * 0.32;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.05, r * 0.32, 0.25, 0, Math.PI * 2);
      ctx.stroke();

      ctx.shadowColor = '#7ffaff';
      ctx.shadowBlur = r * 0.35;
      ctx.strokeStyle = '#7ffaff';
      ctx.lineWidth = r * 0.14;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.05, r * 0.32, 0.25, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = r * 0.045;
      ctx.stroke();
      ctx.restore();
    } else if (type === 'vampire') {
      // Dark gothic inner sheen & faint crimson core pulse
      const pulse = 0.2 + Math.sin(clock * 4) * 0.08;
      const core = ctx.createRadialGradient(x, y + r * 0.15, 0, x, y + r * 0.15, r * 0.72);
      core.addColorStop(0, `rgba(255,40,70,${pulse})`);
      core.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = core;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    } else if (type === 'laser') {
      // Glowing white-pink plasma core lens inside sphere
      const lens = ctx.createRadialGradient(x, y, 0, x, y, r * 0.56);
      lens.addColorStop(0, 'rgba(255,255,255,0.82)');
      lens.addColorStop(0.35, 'rgba(254,178,255,0.45)');
      lens.addColorStop(1, 'rgba(121,30,211,0)');
      ctx.fillStyle = lens;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    } else if (type === 'glass') {
      // Faceted internal crystal panes
      const panes = [
        [-0.98, -0.5, 0.04, -0.98, 0.22, -0.05, -0.56, 0.22],
        [0.04, -0.98, 0.94, -0.44, 0.48, 0.12, 0.22, -0.05],
        [-0.62, 0.24, 0.24, 0.04, 0.44, 0.84, -0.22, 0.94]
      ];
      for (let i = 0; i < panes.length; i++) {
        const p = panes[i];
        ctx.beginPath();
        ctx.moveTo(x + p[0] * r, y + p[1] * r);
        ctx.lineTo(x + p[2] * r, y + p[3] * r);
        ctx.lineTo(x + p[4] * r, y + p[5] * r);
        ctx.lineTo(x + p[6] * r, y + p[7] * r);
        ctx.closePath();
        ctx.fillStyle = `rgba(255,255,255,${i === 1 ? 0.22 : 0.13})`;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = Math.max(1, r * 0.032);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = Math.max(1, r * 0.03);
      ctx.beginPath();
      ctx.moveTo(x - r * 0.55, y - r * 0.2);
      ctx.lineTo(x - r * 0.16, y + r * 0.05);
      ctx.lineTo(x - r * 0.3, y + r * 0.36);
      ctx.lineTo(x + r * 0.2, y + r * 0.6);
      ctx.stroke();
    } else if (type === 'electric') {
      // Cobalt shell with a charged yellow plasma core
      const core = ctx.createRadialGradient(x, y, 0, x, y, r * 0.46);
      core.addColorStop(0, 'rgba(255,255,225,0.95)');
      core.addColorStop(0.4, 'rgba(255,221,64,0.7)');
      core.addColorStop(1, 'rgba(255,221,64,0)');
      ctx.fillStyle = core;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);

      // Crackling lightning veins
      ctx.save();
      ctx.shadowColor = '#ffe45a';
      ctx.shadowBlur = r * 0.32;
      ctx.strokeStyle = 'rgba(255,235,120,0.95)';
      ctx.lineWidth = Math.max(1.4, r * 0.06);
      ctx.lineJoin = 'round';
      for (let i = 0; i < 3; i++) {
        const a0 = i * 2.1 + Math.sin(clock * 5 + i) * 0.25;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let j = 1; j <= 3; j++) {
          const rr = (r * 0.28 * j) + Math.sin(clock * 9 + i * 2 + j) * r * 0.08;
          const aa = a0 + j * 0.32;
          ctx.lineTo(x + Math.cos(aa) * rr, y + Math.sin(aa) * rr);
        }
        ctx.stroke();
      }
      ctx.restore();
    } else if (type === 'burst') {
      // Official yellow cross mark spanning the glowing orange core
      ctx.save();
      ctx.shadowColor = '#ffed4e';
      ctx.shadowBlur = r * 0.42;
      ctx.strokeStyle = 'rgba(120,38,4,0.7)';
      ctx.lineWidth = Math.max(2, r * 0.17);
      ctx.beginPath();
      ctx.moveTo(x - r * 0.62, y);
      ctx.lineTo(x + r * 0.62, y);
      ctx.moveTo(x, y - r * 0.62);
      ctx.lineTo(x, y + r * 0.62);
      ctx.stroke();
      ctx.strokeStyle = '#ffed4e';
      ctx.lineWidth = Math.max(1.5, r * 0.12);
      ctx.stroke();
      ctx.restore();

      // Inner heat bloom
      const heat = ctx.createRadialGradient(x, y, 0, x, y, r * 0.6);
      heat.addColorStop(0, `rgba(255,246,180,${0.55 + Math.sin(clock * 6) * 0.12})`);
      heat.addColorStop(1, 'rgba(255,237,78,0)');
      ctx.fillStyle = heat;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    } else if (type === 'poison') {
      // Toxic bubbling venom sacs under the surface
      ctx.save();
      for (let i = 0; i < 4; i++) {
        const a = i * 1.8 + Math.sin(clock * 1.4 + i) * 0.15;
        const rr = r * (0.24 + (i % 2) * 0.2);
        const bx = x + Math.cos(a) * rr;
        const by = y + Math.sin(a) * rr;
        ctx.fillStyle = 'rgba(14,54,14,0.5)';
        ctx.beginPath();
        ctx.arc(bx, by, r * (0.13 + (i % 3) * 0.035), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(205,255,160,0.5)';
        ctx.beginPath();
        ctx.arc(bx - r * 0.03, by - r * 0.035, r * 0.04, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.restore();

    // Rim light
    const rim = ctx.createRadialGradient(x, y, r * 0.74, x, y, r);
    rim.addColorStop(0, 'rgba(255,255,255,0)');
    rim.addColorStop(1, rgba(type === 'blade' ? accent : (type === 'laser' ? accent : color), 0.42));
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // Glossy 3D specular highlight
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const spec = ctx.createRadialGradient(x - r * 0.4, y - r * 0.44, 0, x - r * 0.4, y - r * 0.44, r * 0.48);
    spec.addColorStop(0, 'rgba(255,255,255,0.95)');
    spec.addColorStop(0.38, 'rgba(255,255,255,0.34)');
    spec.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = spec;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Hit / heal flash overlay
    if (hit > 0) {
      ctx.fillStyle = `rgba(255,255,255,${hit * 0.38})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (healPulse > 0) {
      ctx.strokeStyle = `rgba(120,255,175,${healPulse * 0.85})`;
      ctx.lineWidth = r * 0.14;
      ctx.beginPath();
      ctx.arc(x, y, r * (1.02 + (1 - healPulse) * 0.25), 0, Math.PI * 2);
      ctx.stroke();
    }

    // Vampire's iconic twin white fangs protruding forward
    if (type === 'vampire') {
      const bite = isLatched ? 0.5 + Math.sin(clock * 22) * 0.5 : 0;
      drawVampireFangs(x, y, r, facing || 0, bite);
    }

    // Poison Spike thorn crown
    if (type === 'poison') {
      for (let i = 0; i < 7; i++) {
        const a = i * (Math.PI * 2 / 7) + Math.sin(clock * 0.9) * 0.12;
        const len = r * (i % 2 ? 1.16 : 1.26);
        const half = 0.12;
        ctx.save();
        ctx.translate(x + Math.cos(a) * r * 0.93, y + Math.sin(a) * r * 0.93);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(-r * 0.05, -r * half);
        ctx.lineTo(len - r * 0.88, 0);
        ctx.lineTo(-r * 0.05, r * half);
        ctx.closePath();
        const thorn = ctx.createLinearGradient(0, 0, r * 0.35, 0);
        thorn.addColorStop(0, '#3c7a28');
        thorn.addColorStop(0.6, '#8fe05c');
        thorn.addColorStop(1, '#e6ffb8');
        ctx.fillStyle = thorn;
        ctx.fill();
        ctx.strokeStyle = 'rgba(20,58,18,0.75)';
        ctx.lineWidth = Math.max(1, r * 0.026);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Glass protruding crystal shards & sparkles
    if (type === 'glass') {
      for (const cfg of [[-2.35, 1.18], [-1.85, 1.05]]) {
        const a = cfg[0];
        const len = r * cfg[1];
        ctx.save();
        ctx.translate(x + Math.cos(a) * r * 0.88, y + Math.sin(a) * r * 0.88);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.16);
        ctx.lineTo(len - r * 0.85, -r * 0.05);
        ctx.lineTo(len - r * 0.85, r * 0.05);
        ctx.lineTo(0, r * 0.16);
        ctx.closePath();
        ctx.fillStyle = 'rgba(230,255,252,0.85)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = Math.max(0.8, r * 0.022);
        ctx.stroke();
        ctx.restore();
      }
      const twinkle = 0.55 + Math.sin(clock * 5) * 0.45;
      ctx.save();
      ctx.globalAlpha = twinkle;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, r * 0.028);
      ctx.beginPath();
      ctx.moveTo(x + r * 0.62, y - r * 1.14);
      ctx.lineTo(x + r * 0.62, y - r * 0.86);
      ctx.moveTo(x + r * 0.48, y - r * 1.0);
      ctx.lineTo(x + r * 0.76, y - r * 1.0);
      ctx.stroke();
      ctx.restore();
    }

    // Electric crackle shell
    if (type === 'electric') {
      ctx.save();
      ctx.shadowColor = '#ffe45a';
      ctx.shadowBlur = r * 0.3;
      ctx.strokeStyle = `rgba(255,235,110,${0.55 + Math.sin(clock * 11) * 0.3})`;
      ctx.lineWidth = Math.max(1.1, r * 0.04);
      ctx.beginPath();
      ctx.arc(x, y, r * 1.14, clock * 2.2, clock * 2.2 + 1.1);
      ctx.arc(x, y, r * 1.14, clock * 2.2 + 2.4, clock * 2.2 + 3.2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();

    // Burst dash afterburner aura
    if (type === 'burst' && dashActive) {
      ctx.save();
      for (let i = 0; i < 3; i++) {
        const a = (facing || 0) + Math.PI + (i - 1) * 0.34;
        const len = r * (1.35 + Math.sin(clock * 22 + i) * 0.16);
        const w = r * 0.22;
        const bx = x + Math.cos(a) * r * 0.72;
        const by = y + Math.sin(a) * r * 0.72;
        ctx.beginPath();
        ctx.moveTo(bx + Math.cos(a + Math.PI * 0.5) * w, by + Math.sin(a + Math.PI * 0.5) * w);
        ctx.lineTo(bx + Math.cos(a) * len, by + Math.sin(a) * len);
        ctx.lineTo(bx + Math.cos(a - Math.PI * 0.5) * w, by + Math.sin(a - Math.PI * 0.5) * w);
        ctx.closePath();
        const fg = ctx.createLinearGradient(bx, by, bx + Math.cos(a) * len, by + Math.sin(a) * len);
        fg.addColorStop(0, 'rgba(255,237,78,0.95)');
        fg.addColorStop(0.6, 'rgba(255,126,32,0.7)');
        fg.addColorStop(1, 'rgba(239,70,20,0)');
        ctx.fillStyle = fg;
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(255,237,78,0.7)';
      ctx.lineWidth = r * 0.09;
      ctx.beginPath();
      ctx.arc(x, y, r * 1.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Frozen target is caged in crackling energy (Electric Ball)
    if (frozen) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = '#a8e2ff';
      ctx.shadowColor = '#ffe45a';
      ctx.shadowBlur = 10;
      ctx.lineWidth = Math.max(1.4, r * 0.045);
      for (let i = 0; i < 4; i++) {
        const a = i * (Math.PI / 2) + clock * 0.8;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7);
        ctx.lineTo(x + Math.cos(a + 0.35) * r * 1.22, y + Math.sin(a + 0.35) * r * 1.22);
        ctx.lineTo(x + Math.cos(a + 0.1) * r * 1.42, y + Math.sin(a + 0.1) * r * 1.42);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Front half of Laser Ball's 3D tilted halo ring
    if (type === 'laser') {
      drawLaserRingHalf(x, y, r, ringTilt, true);
    }

    if (!isMini && Number.isFinite(health)) {
      const text = String(Math.max(0, Math.round(health)));
      const fontSize = clamp(r * 0.48, 13, 24);
      ctx.save();
      ctx.font = `900 ${fontSize}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(3, fontSize * 0.22);
      ctx.strokeStyle = 'rgba(5,7,14,0.92)';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.72)';
      ctx.shadowBlur = Math.max(3, fontSize * 0.2);
      ctx.strokeText(text, x, y + 1);
      ctx.fillText(text, x, y + 1);
      ctx.restore();
    }
  }

  function drawBall(b) {
    if (!b.alive) return;
    drawBallModel({
      x: b.x, y: b.y, r: b.r,
      type: b.type, color: b.color, dark: b.dark, accent: b.accent, glow: b.glow,
      facing: b.facing, hit: b.hit, hitAngle: b.hitAngle,
      healPulse: b.healPulse, morphPulse: b.morphPulse,
      bladeCount: b.bladeCount, bladeAngle: b.bladeAngle,
      side: b.side, isMini: false,
      dashActive: b.dashActive,
      frozen: b.freezeTimer > 0 && b.shackledTimer <= 0 && b.iceTimer <= 0 && !animeRivals.isTimeStopped(b),
      health: b.health,
      gunAngle: b.gunAngle,
      gunKick: b.gunKick,
      fibStep: b.fibStep,
      axeAngle: b.axeAngle,
      charge: b.type === 'charge' ? chargeRatio(b) : 0,
      beamAngle: b.beamAngle, beamState: b.beamState, beamT: b.beamT,
      spearBoost: b.spearBoost,
      ref: b,
      isLatched: latch && latch.attacker === b
    });
    if (b.shackledTimer > 0) drawShackledOverlay(b);
    if (b.slowTimer > 0) drawWebbedOverlay(b);
    if (b.iceTimer > 0) drawIceOverlay(b);
  }

  /* ---------- 4 custom thick arrow styles ---------- */

  function classicArrowPath(x0, shaftLen, headLen, sw, hw) {
    const x1 = x0 + shaftLen;
    ctx.beginPath();
    ctx.moveTo(x0, -sw);
    ctx.lineTo(x1, -sw);
    ctx.lineTo(x1 - headLen * 0.12, -hw);
    ctx.lineTo(x1 + headLen, 0);
    ctx.lineTo(x1 - headLen * 0.12, hw);
    ctx.lineTo(x1, sw);
    ctx.lineTo(x0, sw);
    ctx.closePath();
  }

  const SPECIAL_ARROWS = new Set(['harpoon', 'beam', 'spear', 'reforge', 'chess', 'verity', 'cactus', 'range', 'electroking', 'acid', 'bigspike', 'cell', 'wdc', 'hook', 'gojo']);

  function drawArrow(b, alpha, push) {
    if (alpha <= 0 || !b.alive) return;
    if (b.anime) {
      drawAnimeArrow(ctx, b, alpha, arrowFrame(b, push), clock);
      return;
    }
    if (SPECIAL_ARROWS.has(b.type)) {
      drawSpecialArrow(b, alpha, push);
      return;
    }
    if (isFresh(b.type)) {
      drawFreshArrow(b, alpha, push);
      return;
    }
    const r = b.r;
    const bob = Math.sin(clock * 5.2) * r * 0.065;
    const x0 = r * 1.24 + bob + push;
    const reach = Math.min(r * 3.35, arena.w * 0.34, arena.h * 0.44);
    const arrowScale = clamp((reach - r * 1.24) / (r * 2.12), 0.48, 1);
    const shaftLen = r * 1.18 * arrowScale;
    const headLen = r * 0.96 * arrowScale;
    const thick = Math.sqrt(arrowScale);
    const sw = r * 0.22 * thick;
    const hw = r * 0.56 * thick;
    const tip = x0 + shaftLen + headLen;

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.globalAlpha = alpha;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (b.type === 'vampire') {
      // CUSTOM VAMPIRE ARROW: Bat-winged gothic crimson spear with gleaming ivory fang tips
      const x1 = x0 + shaftLen;
      const bodyPath = () => {
        ctx.beginPath();
        // Swept bat-wing fins at base
        ctx.moveTo(x0 - r * 0.14, -sw * 2.05);
        ctx.quadraticCurveTo(x0 + shaftLen * 0.22, -sw * 1.65, x0 + shaftLen * 0.38, -sw * 0.95);
        ctx.lineTo(x1 - headLen * 0.08, -sw * 0.92);
        // Swept gothic barbed wings on arrowhead
        ctx.lineTo(x1 - headLen * 0.26, -hw * 1.12);
        ctx.quadraticCurveTo(x1 + headLen * 0.45, -hw * 0.55, tip, 0);
        ctx.quadraticCurveTo(x1 + headLen * 0.45, hw * 0.55, x1 - headLen * 0.26, hw * 1.12);
        ctx.lineTo(x1 - headLen * 0.08, sw * 0.92);
        ctx.lineTo(x0 + shaftLen * 0.38, sw * 0.95);
        ctx.quadraticCurveTo(x0 + shaftLen * 0.22, sw * 1.65, x0 - r * 0.14, sw * 2.05);
        ctx.quadraticCurveTo(x0 + r * 0.08, 0, x0 - r * 0.14, -sw * 2.05);
        ctx.closePath();
      };

      // Dark forged iron outline + shadow
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.65)';
      ctx.shadowBlur = r * 0.3;
      ctx.shadowOffsetY = r * 0.12;
      bodyPath();
      ctx.strokeStyle = '#1d0207';
      ctx.lineWidth = r * 0.15;
      ctx.stroke();
      ctx.restore();

      // Rich bevelled crimson fill
      const g = ctx.createLinearGradient(0, -hw, 0, hw);
      g.addColorStop(0, '#ff5966');
      g.addColorStop(0.45, '#cf242c');
      g.addColorStop(1, '#4c0512');
      bodyPath();
      ctx.save();
      ctx.shadowColor = 'rgba(255,36,68,0.82)';
      ctx.shadowBlur = r * 0.38;
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();

      // Glowing ruby spine vein
      ctx.strokeStyle = '#ff98a5';
      ctx.lineWidth = Math.max(2, sw * 0.32);
      ctx.beginPath();
      ctx.moveTo(x0 + r * 0.06, 0);
      ctx.lineTo(x1 + headLen * 0.55, 0);
      ctx.stroke();

      // Twin gleaming ivory-white fang edges on the arrowhead
      for (const sgn of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x1 - headLen * 0.16, sgn * hw * 0.96);
        ctx.quadraticCurveTo(x1 + headLen * 0.42, sgn * hw * 0.48, tip, 0);
        ctx.lineTo(x1 + headLen * 0.32, sgn * hw * 0.2);
        ctx.closePath();
        ctx.fillStyle = '#fcfbfc';
        ctx.fill();
      }
    } else if (b.type === 'blade') {
      // CUSTOM BLADE ARROW: Heavy 3D cyber-steel broadsword with glowing cyan plasma core
      const guardX = x0 + r * 0.16;
      const shoulderX = x0 + shaftLen + headLen * 0.18;

      // Crossguard hilt near ball
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.65)';
      ctx.shadowBlur = r * 0.25;
      ctx.fillStyle = '#333a49';
      ctx.strokeStyle = '#181c26';
      ctx.lineWidth = r * 0.09;
      ctx.beginPath();
      ctx.moveTo(x0 - r * 0.04, -hw * 0.96);
      ctx.lineTo(guardX + r * 0.1, -hw * 0.72);
      ctx.lineTo(guardX + r * 0.1, hw * 0.72);
      ctx.lineTo(x0 - r * 0.04, hw * 0.96);
      ctx.lineTo(x0 - r * 0.14, hw * 0.48);
      ctx.lineTo(x0 - r * 0.14, -hw * 0.48);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Sword blade silhouette
      const bladeShape = () => {
        ctx.beginPath();
        ctx.moveTo(guardX, -sw * 1.42);
        ctx.lineTo(shoulderX, -sw * 1.28);
        ctx.lineTo(tip + r * 0.12, 0);
        ctx.lineTo(shoulderX, sw * 1.28);
        ctx.lineTo(guardX, sw * 1.42);
        ctx.closePath();
      };

      ctx.save();
      ctx.shadowColor = 'rgba(127,250,255,0.55)';
      ctx.shadowBlur = r * 0.35;
      bladeShape();
      ctx.strokeStyle = '#171c26';
      ctx.lineWidth = r * 0.13;
      ctx.stroke();
      ctx.restore();

      // Upper bright silver bevel
      ctx.beginPath();
      ctx.moveTo(guardX, -sw * 1.42);
      ctx.lineTo(shoulderX, -sw * 1.28);
      ctx.lineTo(tip + r * 0.12, 0);
      ctx.lineTo(guardX, 0);
      ctx.closePath();
      const topG = ctx.createLinearGradient(guardX, -sw, tip, 0);
      topG.addColorStop(0, '#c2c7d1');
      topG.addColorStop(0.55, '#eef3fb');
      topG.addColorStop(1, '#ffffff');
      ctx.fillStyle = topG;
      ctx.fill();

      // Lower gunmetal bevel
      ctx.beginPath();
      ctx.moveTo(guardX, 0);
      ctx.lineTo(tip + r * 0.12, 0);
      ctx.lineTo(shoulderX, sw * 1.28);
      ctx.lineTo(guardX, sw * 1.42);
      ctx.closePath();
      const botG = ctx.createLinearGradient(guardX, 0, tip, sw);
      botG.addColorStop(0, '#4d5465');
      botG.addColorStop(0.6, '#7f8799');
      botG.addColorStop(1, '#cbd4e3');
      ctx.fillStyle = botG;
      ctx.fill();

      // Blazing cyan energy fuller down center
      ctx.save();
      ctx.shadowColor = '#7ffaff';
      ctx.shadowBlur = r * 0.32;
      ctx.strokeStyle = '#7ffaff';
      ctx.lineWidth = Math.max(3, sw * 0.56);
      ctx.beginPath();
      ctx.moveTo(guardX + r * 0.08, 0);
      ctx.lineTo(shoulderX + headLen * 0.25, 0);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1.4, sw * 0.22);
      ctx.stroke();
      ctx.restore();

      // Glowing cyan studs on crossguard
      ctx.fillStyle = '#7ffaff';
      ctx.beginPath();
      ctx.arc(x0 + r * 0.05, -hw * 0.58, r * 0.08, 0, Math.PI * 2);
      ctx.arc(x0 + r * 0.05, hw * 0.58, r * 0.08, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.type === 'laser') {
      // CUSTOM LASER ARROW: Twin-rail neon plasma emitter with pulsing rings & prism chevron tip
      const x1 = x0 + shaftLen;
      const railY = sw * 1.15;

      // Center plasma beam core
      ctx.save();
      ctx.shadowColor = '#c94dff';
      ctx.shadowBlur = r * 0.5;
      ctx.strokeStyle = '#8b24eb';
      ctx.lineWidth = sw * 1.8;
      ctx.beginPath();
      ctx.moveTo(x0, 0);
      ctx.lineTo(x1 + headLen * 0.72, 0);
      ctx.stroke();

      ctx.strokeStyle = '#feb2ff';
      ctx.lineWidth = sw * 0.92;
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = sw * 0.36;
      ctx.stroke();
      ctx.restore();

      // Twin floating neon purple guide rails
      for (const sgn of [-1, 1]) {
        ctx.save();
        ctx.shadowColor = 'rgba(254,178,255,0.85)';
        ctx.shadowBlur = r * 0.2;
        ctx.strokeStyle = '#330861';
        ctx.lineWidth = sw * 0.55;
        ctx.beginPath();
        ctx.moveTo(x0 + r * 0.06, sgn * railY);
        ctx.lineTo(x1 - r * 0.06, sgn * railY);
        ctx.stroke();

        ctx.strokeStyle = '#d470ff';
        ctx.lineWidth = sw * 0.28;
        ctx.stroke();
        ctx.restore();
      }

      // Pulsing energy rings traveling down the shaft
      for (let i = 0; i < 2; i++) {
        const u = (clock * 1.7 + i * 0.5) % 1;
        const rx = x0 + u * shaftLen;
        ctx.save();
        ctx.strokeStyle = `rgba(254,178,255,${Math.sin(u * Math.PI) * 0.95})`;
        ctx.lineWidth = Math.max(2, r * 0.065);
        ctx.beginPath();
        ctx.ellipse(rx, 0, r * 0.075, sw * 1.55, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Sharp glowing neon prism chevron head
      const headPath = () => {
        ctx.beginPath();
        ctx.moveTo(x1 - headLen * 0.16, -hw * 1.06);
        ctx.lineTo(tip + r * 0.08, 0);
        ctx.lineTo(x1 - headLen * 0.16, hw * 1.06);
        ctx.lineTo(x1 + headLen * 0.12, 0);
        ctx.closePath();
      };
      ctx.save();
      ctx.shadowColor = '#d254ff';
      ctx.shadowBlur = r * 0.45;
      headPath();
      ctx.strokeStyle = '#26064a';
      ctx.lineWidth = r * 0.14;
      ctx.stroke();

      const hg = ctx.createLinearGradient(x1, -hw, tip, hw);
      hg.addColorStop(0, '#feb2ff');
      hg.addColorStop(0.5, '#a138f5');
      hg.addColorStop(1, '#5811a8');
      ctx.fillStyle = hg;
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = r * 0.055;
      ctx.stroke();
      ctx.restore();
    } else if (b.type === 'glass') {
      // CUSTOM GLASS ARROW: Faceted crystal shard with a floating prism head
      const x1 = x0 + shaftLen;
      const shardBody = () => {
        ctx.beginPath();
        ctx.moveTo(x0, -sw * 0.5);
        ctx.lineTo(x1 - headLen * 0.2, -sw * 0.95);
        ctx.lineTo(x1 - headLen * 0.2, -hw * 1.02);
        ctx.lineTo(tip, 0);
        ctx.lineTo(x1 - headLen * 0.2, hw * 1.02);
        ctx.lineTo(x1 - headLen * 0.2, sw * 0.95);
        ctx.lineTo(x0, sw * 0.5);
        ctx.closePath();
      };
      ctx.save();
      ctx.shadowColor = 'rgba(140,245,238,0.75)';
      ctx.shadowBlur = r * 0.32;
      shardBody();
      const glassFill = ctx.createLinearGradient(0, -hw, 0, hw);
      glassFill.addColorStop(0, 'rgba(255,255,255,0.95)');
      glassFill.addColorStop(0.42, 'rgba(180,250,245,0.88)');
      glassFill.addColorStop(1, 'rgba(58,160,168,0.9)');
      ctx.fillStyle = glassFill;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = Math.max(1.4, r * 0.045);
      ctx.stroke();
      ctx.restore();

      // Internal facets
      ctx.save();
      shardBody();
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = Math.max(1, r * 0.028);
      ctx.beginPath();
      ctx.moveTo(x0 + shaftLen * 0.2, -sw * 0.9);
      ctx.lineTo(x1 - headLen * 0.2, 0);
      ctx.moveTo(x0 + shaftLen * 0.55, sw * 1.0);
      ctx.lineTo(x1 - headLen * 0.2, -hw * 0.4);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = 0.75 + Math.sin(clock * 6) * 0.25;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, r * 0.03);
      ctx.beginPath();
      ctx.moveTo(tip - headLen * 0.05, -hw * 0.25);
      ctx.lineTo(tip + headLen * 0.22, -hw * 0.55);
      ctx.moveTo(tip - headLen * 0.15, -hw * 0.32);
      ctx.lineTo(tip - headLen * 0.15, -hw * 0.75);
      ctx.stroke();
      ctx.restore();
    } else if (b.type === 'electric') {
      // CUSTOM ELECTRIC ARROW: Forked cobalt lightning bolt with a yellow plasma core
      const x1 = x0 + shaftLen;
      const zig = (amp, yOff) => {
        ctx.beginPath();
        ctx.moveTo(x0, -amp * 0.4 + yOff);
        ctx.lineTo(x0 + (x1 - x0) * 0.24, amp * 0.6 + yOff);
        ctx.lineTo(x0 + (x1 - x0) * 0.44, -amp + yOff);
        ctx.lineTo(x0 + (x1 - x0) * 0.66, amp * 0.75 + yOff);
        ctx.lineTo(x1, -amp * 0.15 + yOff);
        ctx.lineTo(tip, yOff);
      };
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.shadowColor = 'rgba(255,235,90,0.9)';
      ctx.shadowBlur = r * 0.38;
      zig(hw * 0.62, 0);
      ctx.strokeStyle = '#2a3ea8';
      ctx.lineWidth = r * 0.34;
      ctx.stroke();
      zig(hw * 0.62, 0);
      ctx.strokeStyle = '#ffdd40';
      ctx.lineWidth = r * 0.2;
      ctx.stroke();
      zig(hw * 0.62, 0);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = r * 0.07;
      ctx.stroke();

      // Forked branch at the tip
      ctx.strokeStyle = '#ffdd40';
      ctx.lineWidth = r * 0.12;
      ctx.beginPath();
      ctx.moveTo(x1, 0);
      ctx.lineTo(x1 + headLen * 0.36, -hw * 0.78);
      ctx.moveTo(x1, 0);
      ctx.lineTo(x1 + headLen * 0.36, hw * 0.78);
      ctx.stroke();
      ctx.restore();
    } else if (b.type === 'burst') {
      // CUSTOM BURST ARROW: Heavy rocket-headed arrow with yellow chevrons & afterburner flames
      const x1 = x0 + shaftLen;
      const burstBody = () => {
        ctx.beginPath();
        ctx.moveTo(x0, -hw * 0.95);
        ctx.lineTo(x1 - headLen * 0.1, -hw);
        ctx.lineTo(x1 - headLen * 0.1, -hw * 1.06);
        ctx.lineTo(tip, 0);
        ctx.lineTo(x1 - headLen * 0.1, hw * 1.06);
        ctx.lineTo(x1 - headLen * 0.1, hw);
        ctx.lineTo(x0, hw * 0.95);
        ctx.closePath();
      };
      ctx.save();
      ctx.shadowColor = 'rgba(255,146,44,0.8)';
      ctx.shadowBlur = r * 0.4;
      burstBody();
      const bg = ctx.createLinearGradient(0, -hw, 0, hw);
      bg.addColorStop(0, '#ffed4e');
      bg.addColorStop(0.38, '#ef7724');
      bg.addColorStop(1, '#8a2703');
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.strokeStyle = '#3f1102';
      ctx.lineWidth = Math.max(1.6, r * 0.055);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      burstBody();
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,247,180,0.95)';
      ctx.lineWidth = Math.max(2, r * 0.06);
      for (let i = 0; i < 3; i++) {
        const cx = x0 + shaftLen * (0.42 + i * 0.19);
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.12, -hw * 0.8);
        ctx.lineTo(cx + r * 0.16, 0);
        ctx.lineTo(cx - r * 0.12, hw * 0.8);
        ctx.stroke();
      }
      ctx.restore();

      // Flames licking off the base
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(x0, i * sw * 0.8);
        ctx.lineTo(x0 - r * (0.42 + Math.abs(i) * 0.12) - Math.sin(clock * 18 + i) * r * 0.07, i * sw * 1.15);
        ctx.lineTo(x0, i * sw * 0.2 + sw * 0.5);
        ctx.closePath();
        ctx.fillStyle = i === 0 ? '#ffed4e' : '#ff9f2e';
        ctx.fill();
      }
    } else if (b.type === 'poison') {
      // CUSTOM POISON ARROW: Barbed toxic thorn spear with a dripping venom tip
      const x1 = x0 + shaftLen;
      const thornBody = () => {
        ctx.beginPath();
        ctx.moveTo(x0, -sw * 0.65);
        ctx.lineTo(x1, -sw * 0.4);
        ctx.lineTo(tip - r * 0.12, -hw * 0.15);
        ctx.lineTo(tip, 0);
        ctx.lineTo(tip - r * 0.12, hw * 0.15);
        ctx.lineTo(x1, sw * 0.4);
        ctx.lineTo(x0, sw * 0.65);
        ctx.closePath();
      };
      ctx.save();
      ctx.shadowColor = 'rgba(132,255,84,0.75)';
      ctx.shadowBlur = r * 0.34;
      thornBody();
      const pg = ctx.createLinearGradient(0, -hw * 0.5, 0, hw * 0.5);
      pg.addColorStop(0, '#e6ffb8');
      pg.addColorStop(0.45, '#7fe04a');
      pg.addColorStop(1, '#245c22');
      ctx.fillStyle = pg;
      ctx.fill();
      ctx.strokeStyle = '#173f16';
      ctx.lineWidth = Math.max(1.4, r * 0.05);
      ctx.stroke();
      ctx.restore();

      // Reversed barbs along both edges
      ctx.save();
      ctx.fillStyle = '#b7f06c';
      ctx.strokeStyle = '#1c4d1a';
      ctx.lineWidth = Math.max(1, r * 0.028);
      for (const sgn of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const bx = x0 + shaftLen * (0.34 + i * 0.22);
          const by = sgn * sw * 0.55;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx - r * 0.22, by + sgn * hw * 0.62);
          ctx.lineTo(bx + r * 0.2, by + sgn * hw * 0.12);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }
      ctx.restore();

      // Glowing venom droplet at the tip
      ctx.save();
      ctx.shadowColor = '#9bff5c';
      ctx.shadowBlur = r * 0.3;
      ctx.fillStyle = '#d6ff96';
      ctx.beginPath();
      ctx.arc(tip + r * 0.1, r * 0.04, r * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      // CLASSIC ARROW: Glossy thick beveled arcade arrow
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = r * 0.3;
      ctx.shadowOffsetX = r * 0.08;
      ctx.shadowOffsetY = r * 0.14;
      classicArrowPath(x0, shaftLen, headLen, sw, hw);
      ctx.strokeStyle = rgba(darken(b.dark, 0.35), 1);
      ctx.lineWidth = r * 0.14;
      ctx.stroke();
      ctx.restore();

      const across = ctx.createLinearGradient(0, -hw, 0, hw);
      across.addColorStop(0, rgba(lighten(b.color, 110), 1));
      across.addColorStop(0.45, rgba(b.color, 1));
      across.addColorStop(1, rgba(b.dark, 1));
      classicArrowPath(x0, shaftLen, headLen, sw, hw);
      ctx.save();
      ctx.shadowColor = rgba(b.color, 0.8);
      ctx.shadowBlur = r * 0.35;
      ctx.fillStyle = across;
      ctx.fill();
      ctx.restore();

      const along = ctx.createLinearGradient(x0, 0, tip, 0);
      along.addColorStop(0, 'rgba(255,255,255,0)');
      along.addColorStop(1, 'rgba(255,255,255,0.5)');
      ctx.fillStyle = along;
      ctx.fill();

      ctx.save();
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = r * 0.07;
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  /* ---------- 4 custom health bar styles ---------- */

  function drawHealthBar(b) {
    if (!b.alive) return;
    if (isFresh(b.type)) {
      drawFreshBar(b);
      return;
    }
    const width = clamp(b.r * 2.25, 58, 96);
    const height = clamp(b.r * 0.28, 9, 13);
    const gap = Math.max(12, b.r * 0.34);
    const x = clamp(b.x - width * 0.5, arena.x + 14, arena.x + arena.w - width - 14);
    let y = b.y - b.r - gap - height;
    if (y < arena.y + 8) y = b.y + b.r + gap;
    y = clamp(y, arena.y + 8, arena.y + arena.h - height - 8);

    const hpFrac = clamp(b.health / b.maxHealth, 0, 1);
    const shownFrac = clamp(b.shownHealth / b.maxHealth, 0, 1);

    ctx.save();

    if (b.type === 'vampire') {
      // VAMPIRE BAR: Gothic crimson blood vial with miniature bat-wing endcaps & twin ivory fangs
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.72)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 3;

      // Pointed bat-wing brackets on left & right
      ctx.fillStyle = '#2d060e';
      ctx.strokeStyle = '#cf242c';
      ctx.lineWidth = 1.2;
      for (const sgn of [-1, 1]) {
        const bx = sgn < 0 ? x + 2 : x + width - 2;
        ctx.beginPath();
        ctx.moveTo(bx, y + height * 0.5);
        ctx.lineTo(bx + sgn * 8, y - 2);
        ctx.lineTo(bx + sgn * 5, y + height * 0.55);
        ctx.lineTo(bx + sgn * 7, y + height + 1);
        ctx.lineTo(bx, y + height * 0.88);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      roundedRect(x, y, width, height, height * 0.45);
      ctx.fillStyle = 'rgba(18,4,9,0.95)';
      ctx.fill();
      ctx.restore();

      const inset = 2;
      const iw = width - inset * 2, ih = height - inset * 2;
      ctx.save();
      roundedRect(x + inset, y + inset, iw, ih, ih * 0.45);
      ctx.clip();
      ctx.fillStyle = 'rgba(255,40,70,0.12)';
      ctx.fillRect(x + inset, y + inset, iw, ih);
      // Delayed drain trail
      ctx.fillStyle = 'rgba(255,155,170,0.45)';
      ctx.fillRect(x + inset, y + inset, iw * shownFrac, ih);
      // Shimmering blood-crimson fill
      const fill = ctx.createLinearGradient(0, y + inset, 0, y + height - inset);
      fill.addColorStop(0, '#ff5d6b');
      fill.addColorStop(0.5, '#cf242c');
      fill.addColorStop(1, '#610614');
      ctx.fillStyle = fill;
      ctx.fillRect(x + inset, y + inset, iw * hpFrac, ih);

      // Subtle glossy highlight strip
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(x + inset, y + inset, iw * hpFrac, Math.max(1.5, ih * 0.3));
      ctx.restore();

      // Crimson iron bezel
      roundedRect(x + 0.5, y + 0.5, width - 1, height - 1, height * 0.45);
      ctx.strokeStyle = 'rgba(255,95,112,0.5)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Twin miniature white fang notches at center top
      ctx.fillStyle = '#fcfbfc';
      for (const ox of [-4.5, 4.5]) {
        ctx.beginPath();
        ctx.moveTo(x + width * 0.5 + ox - 2, y + 1);
        ctx.lineTo(x + width * 0.5 + ox + 2, y + 1);
        ctx.lineTo(x + width * 0.5 + ox, y + 5.2);
        ctx.closePath();
        ctx.fill();
      }
    } else if (b.type === 'blade') {
      // BLADE BAR: Chamfered steel armor plate with 10 segmented neon-cyan energy cells
      const ch = height * 0.42;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.75)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 3;
      chamferRect(x, y, width, height, ch);
      const frameG = ctx.createLinearGradient(0, y, 0, y + height);
      frameG.addColorStop(0, '#2c3342');
      frameG.addColorStop(1, '#11151f');
      ctx.fillStyle = frameG;
      ctx.fill();
      ctx.restore();

      const inset = 2.2;
      const iw = width - inset * 2, ih = height - inset * 2;
      ctx.save();
      chamferRect(x + inset, y + inset, iw, ih, Math.max(1, ch - 1.5));
      ctx.clip();

      ctx.fillStyle = 'rgba(127,250,255,0.09)';
      ctx.fillRect(x + inset, y + inset, iw, ih);

      ctx.fillStyle = 'rgba(220,255,255,0.42)';
      ctx.fillRect(x + inset, y + inset, iw * shownFrac, ih);

      const fill = ctx.createLinearGradient(0, y + inset, 0, y + height - inset);
      fill.addColorStop(0, '#dcffff');
      fill.addColorStop(0.45, '#7ffaff');
      fill.addColorStop(1, '#3196c4');
      ctx.fillStyle = fill;
      ctx.fillRect(x + inset, y + inset, iw * hpFrac, ih);

      // Diagonal cyber segment cuts (10 cells)
      ctx.strokeStyle = 'rgba(14,18,28,0.85)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 1; i < 10; i++) {
        const sx = x + inset + (iw * i) / 10;
        ctx.moveTo(sx + 1.5, y);
        ctx.lineTo(sx - 1.5, y + height);
      }
      ctx.stroke();
      ctx.restore();

      // Brushed titanium outer rim
      chamferRect(x + 0.5, y + 0.5, width - 1, height - 1, ch);
      ctx.strokeStyle = 'rgba(205,220,238,0.65)';
      ctx.lineWidth = 1.3;
      ctx.stroke();

      // Glowing cyan end-rivets
      ctx.fillStyle = '#7ffaff';
      ctx.fillRect(x - 2, y + height * 0.5 - 1.5, 3, 3);
      ctx.fillRect(x + width - 1, y + height * 0.5 - 1.5, 3, 3);
    } else if (b.type === 'laser') {
      // LASER BAR: Holographic purple plasma conduit with glowing end-emitter orbs
      const barH = Math.max(7, height - 2);
      const by = y + (height - barH) * 0.5;

      ctx.save();
      ctx.shadowColor = 'rgba(162,48,255,0.55)';
      ctx.shadowBlur = 12;
      roundedRect(x, by, width, barH, barH * 0.5);
      ctx.fillStyle = 'rgba(18,5,36,0.9)';
      ctx.fill();
      ctx.restore();

      const inset = 1.8;
      const iw = width - inset * 2, ih = barH - inset * 2;
      ctx.save();
      roundedRect(x + inset, by + inset, iw, ih, ih * 0.5);
      ctx.clip();

      ctx.fillStyle = 'rgba(254,178,255,0.12)';
      ctx.fillRect(x + inset, by + inset, iw, ih);

      ctx.fillStyle = 'rgba(254,178,255,0.45)';
      ctx.fillRect(x + inset, by + inset, iw * shownFrac, ih);

      const fill = ctx.createLinearGradient(x, by, x + width, by);
      fill.addColorStop(0, '#791ed3');
      fill.addColorStop(0.65, '#c44dff');
      fill.addColorStop(1, '#feb2ff');
      ctx.fillStyle = fill;
      ctx.fillRect(x + inset, by + inset, iw * hpFrac, ih);

      // White-hot horizontal laser core line
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.fillRect(x + inset, by + barH * 0.5 - 0.9, iw * hpFrac, 1.8);
      ctx.restore();

      // Glowing magenta conduit frame
      roundedRect(x + 0.5, by + 0.5, width - 1, barH - 1, barH * 0.5);
      ctx.strokeStyle = 'rgba(254,178,255,0.62)';
      ctx.lineWidth = 1.1;
      ctx.stroke();

      // Left & right glowing emitter nodes
      for (const nx of [x, x + width]) {
        ctx.save();
        ctx.shadowColor = '#feb2ff';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#a036f5';
        ctx.beginPath();
        ctx.arc(nx, by + barH * 0.5, barH * 0.52, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(nx, by + barH * 0.5, barH * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    } else if (b.type === 'glass') {
      // GLASS BAR: Prismatic crystal strip with faceted segments
      const ch = height * 0.34;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.62)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 3;
      chamferRect(x, y, width, height, ch);
      ctx.fillStyle = 'rgba(12,30,38,0.9)';
      ctx.fill();
      ctx.restore();

      const inset = 2;
      const iw = width - inset * 2;
      const ih = height - inset * 2;
      ctx.save();
      chamferRect(x + inset, y + inset, iw, ih, Math.max(1, ch - 1));
      ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x + inset, y + inset, iw, ih);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(x + inset, y + inset, iw * shownFrac, ih);
      const fill = ctx.createLinearGradient(x, y, x + width, y + height);
      fill.addColorStop(0, '#7fe3dc');
      fill.addColorStop(0.45, '#e8fffd');
      fill.addColorStop(1, '#4fc0c6');
      ctx.fillStyle = fill;
      ctx.fillRect(x + inset, y + inset, iw * hpFrac, ih);
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fillRect(x + inset, y + inset, iw * hpFrac, Math.max(1.4, ih * 0.28));
      // Prism facet cuts
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (let i = 1; i < 6; i++) {
        const fx = x + inset + (iw * i) / 6;
        ctx.moveTo(fx - 2, y + inset);
        ctx.lineTo(fx + 3, y + height - inset);
      }
      ctx.stroke();
      ctx.restore();

      chamferRect(x + 0.5, y + 0.5, width - 1, height - 1, ch);
      ctx.strokeStyle = 'rgba(255,255,255,0.72)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      // Floating crystal chips at each end
      ctx.fillStyle = 'rgba(230,255,252,0.9)';
      ctx.beginPath();
      ctx.moveTo(x - 4, y + height * 0.5);
      ctx.lineTo(x, y + height * 0.2);
      ctx.lineTo(x + 3, y + height * 0.5);
      ctx.lineTo(x, y + height * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + width + 4, y + height * 0.5);
      ctx.lineTo(x + width, y + height * 0.2);
      ctx.lineTo(x + width - 3, y + height * 0.5);
      ctx.lineTo(x + width, y + height * 0.8);
      ctx.closePath();
      ctx.fill();
    } else if (b.type === 'electric') {
      // ELECTRIC BAR: Cobalt capacitor with a jagged yellow charge core
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 3;
      roundedRect(x, y, width, height, height * 0.32);
      ctx.fillStyle = 'rgba(9,16,44,0.94)';
      ctx.fill();
      ctx.restore();

      const inset = 2;
      const iw = width - inset * 2;
      const ih = height - inset * 2;
      ctx.save();
      roundedRect(x + inset, y + inset, iw, ih, ih * 0.32);
      ctx.clip();
      ctx.fillStyle = 'rgba(255,221,64,0.1)';
      ctx.fillRect(x + inset, y + inset, iw, ih);
      ctx.fillStyle = 'rgba(255,255,255,0.32)';
      ctx.fillRect(x + inset, y + inset, iw * shownFrac, ih);
      const fillW = iw * hpFrac;
      const fill = ctx.createLinearGradient(x, y, x + width, y + height);
      fill.addColorStop(0, '#ffe97a');
      fill.addColorStop(0.55, '#ffdd40');
      fill.addColorStop(1, '#ff9d1f');
      ctx.fillStyle = fill;
      ctx.fillRect(x + inset, y + inset, fillW, ih);
      // Charged sawtooth leading edge
      if (fillW > 4) {
        ctx.save();
        ctx.shadowColor = '#ffe45a';
        ctx.shadowBlur = 10;
        ctx.strokeStyle = '#fff6bd';
        ctx.lineWidth = Math.max(1.3, height * 0.13);
        ctx.beginPath();
        const edgeX = x + inset + fillW;
        ctx.moveTo(edgeX - 2, y + inset);
        ctx.lineTo(edgeX + 3, y + height * 0.35);
        ctx.lineTo(edgeX - 2, y + height * 0.55);
        ctx.lineTo(edgeX + 2, y + height - inset);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();

      roundedRect(x + 0.5, y + 0.5, width - 1, height - 1, height * 0.32);
      ctx.strokeStyle = 'rgba(255,221,64,0.6)';
      ctx.lineWidth = 1.3;
      ctx.stroke();

      // Lightning bolt caps
      for (const bx of [x - 1, x + width + 1]) {
        ctx.fillStyle = '#ffdd40';
        ctx.beginPath();
        ctx.moveTo(bx, y);
        ctx.lineTo(bx + 5, y + height * 0.35);
        ctx.lineTo(bx + 1, y + height * 0.42);
        ctx.lineTo(bx + 6, y + height * 0.85);
        ctx.lineTo(bx - 1, y + height * 0.55);
        ctx.lineTo(bx + 2, y + height * 0.42);
        ctx.closePath();
        ctx.fill();
      }
    } else if (b.type === 'burst') {
      // BURST BAR: Chevron-headed rocket gauge with flaming energy cells
      const point = height * 0.7;
      const frame = () => {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + width, y);
        ctx.lineTo(x + width + point, y + height * 0.5);
        ctx.lineTo(x + width, y + height);
        ctx.lineTo(x, y + height);
        ctx.closePath();
      };
      ctx.save();
      ctx.shadowColor = 'rgba(255,146,44,0.6)';
      ctx.shadowBlur = 12;
      frame();
      ctx.fillStyle = 'rgba(52,17,4,0.95)';
      ctx.fill();
      ctx.restore();

      const inset = 2;
      const iw = width - inset * 2;
      const ih = height - inset * 2;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x + inset, y + inset);
      ctx.lineTo(x + width - inset, y + inset);
      ctx.lineTo(x + width + point * 0.82 - inset, y + height * 0.5);
      ctx.lineTo(x + width - inset, y + height - inset);
      ctx.lineTo(x + inset, y + height - inset);
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = 'rgba(255,237,78,0.12)';
      ctx.fillRect(x, y, width + point, height);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(x + inset, y + inset, iw * shownFrac, ih);
      const fill = ctx.createLinearGradient(0, y, 0, y + height);
      fill.addColorStop(0, '#ffed4e');
      fill.addColorStop(0.5, '#ef7724');
      fill.addColorStop(1, '#a83205');
      ctx.fillStyle = fill;
      ctx.fillRect(x + inset, y + inset, iw * hpFrac, ih);
      ctx.strokeStyle = 'rgba(63,17,2,0.6)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 1; i < 7; i++) {
        const cx = x + inset + (iw * i) / 7;
        ctx.moveTo(cx - 2, y);
        ctx.lineTo(cx + 3, y + height);
      }
      ctx.stroke();
      ctx.restore();

      frame();
      ctx.strokeStyle = 'rgba(255,237,78,0.85)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      if (b.dashActive) {
        ctx.save();
        ctx.globalAlpha = 0.6 + Math.sin(clock * 18) * 0.25;
        ctx.strokeStyle = '#ffed4e';
        ctx.lineWidth = 2;
        frame();
        ctx.stroke();
        ctx.restore();
      }
    } else if (b.type === 'poison') {
      // POISON BAR: Toxic sac with thorns and a dripping venom bulb
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.62)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 3;
      roundedRect(x, y, width, height, height * 0.5);
      ctx.fillStyle = 'rgba(10,28,10,0.94)';
      ctx.fill();
      ctx.restore();

      const inset = 2;
      const iw = width - inset * 2;
      const ih = height - inset * 2;
      ctx.save();
      roundedRect(x + inset, y + inset, iw, ih, ih * 0.5);
      ctx.clip();
      ctx.fillStyle = 'rgba(132,255,84,0.1)';
      ctx.fillRect(x + inset, y + inset, iw, ih);
      ctx.fillStyle = 'rgba(214,255,140,0.4)';
      ctx.fillRect(x + inset, y + inset, iw * shownFrac, ih);
      const fill = ctx.createLinearGradient(0, y, 0, y + height);
      fill.addColorStop(0, '#dfff9f');
      fill.addColorStop(0.45, '#7fe04a');
      fill.addColorStop(1, '#2b6326');
      ctx.fillStyle = fill;
      ctx.fillRect(x + inset, y + inset, iw * hpFrac, ih);
      // Venom bubbles inside the sac
      ctx.fillStyle = 'rgba(255,255,255,0.32)';
      for (let i = 0; i < 4; i++) {
        const bx = x + inset + (iw * (i + 0.5)) / 4;
        ctx.beginPath();
        ctx.arc(bx, y + height * 0.5, Math.max(1.4, height * 0.18), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      roundedRect(x + 0.5, y + 0.5, width - 1, height - 1, height * 0.5);
      ctx.strokeStyle = 'rgba(190,255,120,0.55)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Thorn studs along the top edge
      for (let i = 1; i <= 5; i++) {
        const tx = x + (width * i) / 6;
        ctx.fillStyle = '#9bff5c';
        ctx.beginPath();
        ctx.moveTo(tx - 2.4, y + 1);
        ctx.lineTo(tx, y - 4.6);
        ctx.lineTo(tx + 2.4, y + 1);
        ctx.closePath();
        ctx.fill();
      }
      // Dripping venom bulb at the fill front
      const endX = x + inset + iw * hpFrac;
      ctx.fillStyle = 'rgba(132,255,84,0.9)';
      ctx.beginPath();
      ctx.arc(endX, y + height + 2.2, Math.max(2, height * 0.18), 0, Math.PI * 2);
      ctx.fill();
    } else {
      // CLASSIC BAR: Clean glossy rounded capsule
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.65)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 3;
      roundedRect(x, y, width, height, height * 0.5);
      ctx.fillStyle = 'rgba(6,8,15,0.92)';
      ctx.fill();
      ctx.restore();

      const inset = 2;
      const iw = width - inset * 2, ih = height - inset * 2;
      ctx.save();
      roundedRect(x + inset, y + inset, iw, ih, ih * 0.5);
      ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x + inset, y + inset, iw, ih);
      ctx.fillStyle = rgba(lighten(b.color, 80), 0.4);
      ctx.fillRect(x + inset, y + inset, iw * shownFrac, ih);
      const fill = ctx.createLinearGradient(0, y + inset, 0, y + height - inset);
      fill.addColorStop(0, rgba(lighten(b.color, 95), 1));
      fill.addColorStop(0.55, rgba(b.color, 1));
      fill.addColorStop(1, rgba(b.dark, 1));
      ctx.fillStyle = fill;
      ctx.fillRect(x + inset, y + inset, iw * hpFrac, ih);
      ctx.restore();

      roundedRect(x + 0.5, y + 0.5, width - 1, height - 1, height * 0.5);
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  }

  /* ---------- 4 custom 3D heart styles ---------- */

  function heartPath(size) {
    ctx.beginPath();
    ctx.moveTo(0, size * 0.42);
    ctx.bezierCurveTo(-size * 0.31, size * 0.15, -size * 0.57, -size * 0.06, -size * 0.51, -size * 0.33);
    ctx.bezierCurveTo(-size * 0.44, -size * 0.6, -size * 0.1, -size * 0.64, 0, -size * 0.35);
    ctx.bezierCurveTo(size * 0.1, -size * 0.64, size * 0.44, -size * 0.6, size * 0.51, -size * 0.33);
    ctx.bezierCurveTo(size * 0.57, -size * 0.06, size * 0.31, size * 0.15, 0, size * 0.42);
    ctx.closePath();
  }

  function facetedHeartPath(size) {
    // Sharp armored silhouette for Blade Ball
    ctx.beginPath();
    ctx.moveTo(0, size * 0.44);
    ctx.lineTo(-size * 0.48, -size * 0.04);
    ctx.lineTo(-size * 0.52, -size * 0.36);
    ctx.lineTo(-size * 0.25, -size * 0.56);
    ctx.lineTo(0, -size * 0.33);
    ctx.lineTo(size * 0.25, -size * 0.56);
    ctx.lineTo(size * 0.52, -size * 0.36);
    ctx.lineTo(size * 0.48, -size * 0.04);
    ctx.closePath();
  }

  function drawBatWing(size, sideSign, filled) {
    ctx.save();
    ctx.scale(sideSign, 1);
    ctx.beginPath();
    ctx.moveTo(size * 0.34, -size * 0.18);
    ctx.quadraticCurveTo(size * 0.58, -size * 0.44, size * 0.74, -size * 0.28);
    ctx.quadraticCurveTo(size * 0.62, -size * 0.14, size * 0.68, -size * 0.04);
    ctx.quadraticCurveTo(size * 0.55, -size * 0.04, size * 0.55, size * 0.08);
    ctx.quadraticCurveTo(size * 0.43, size * 0.02, size * 0.3, size * 0.06);
    ctx.closePath();
    if (filled) {
      const wg = ctx.createLinearGradient(size * 0.3, -size * 0.4, size * 0.85, size * 0.08);
      wg.addColorStop(0, '#851020');
      wg.addColorStop(1, '#26030a');
      ctx.fillStyle = wg;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,75,92,0.55)';
      ctx.lineWidth = Math.max(1, size * 0.038);
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(18,5,10,0.5)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(207,36,44,0.22)';
      ctx.lineWidth = Math.max(0.8, size * 0.032);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCustomHeart(x, y, size, type, side, filled, alpha, scale) {
    if (alpha <= 0) return;
    // Hearts are static art, so bake one per state and blit it with its alpha
    ctx.save();
    ctx.globalAlpha = alpha;
    drawBaked(`heart:${side}:${filled ? 1 : 0}:${size.toFixed(1)}`, size * 0.72, x, y, scale,
      (mx, my, rr) => drawRedHeart(mx, my, rr / 0.72, filled, 1, 1));
    ctx.restore();
  }

  function drawRedHeart(x, y, size, filled, alpha, scale) {
    if (alpha <= 0) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    ctx.lineJoin = 'round';

    if (!filled) {
      heartPath(size);
      ctx.fillStyle = 'rgba(8,10,18,0.85)';
      ctx.fill();
      heartPath(size);
      ctx.strokeStyle = 'rgba(255,105,120,0.3)';
      ctx.lineWidth = Math.max(1, size * 0.05);
      ctx.stroke();
      ctx.restore();
      return;
    }

    // Outer glow and 3D shell
    ctx.save();
    heartPath(size);
    ctx.shadowColor = 'rgba(255,42,70,0.65)';
    ctx.shadowBlur = size * 0.42;
    ctx.shadowOffsetY = size * 0.1;
    const shell = ctx.createLinearGradient(-size * 0.16, -size * 0.6, size * 0.16, size * 0.44);
    shell.addColorStop(0, '#ff8b96');
    shell.addColorStop(0.42, '#e91e35');
    shell.addColorStop(1, '#7f0618');
    ctx.fillStyle = shell;
    ctx.fill();
    ctx.restore();

    // Inner depth and gloss
    ctx.save();
    heartPath(size);
    ctx.clip();
    const body = ctx.createRadialGradient(-size * 0.22, -size * 0.32, 0, 0, size * 0.04, size * 0.74);
    body.addColorStop(0, 'rgba(255,255,255,0.78)');
    body.addColorStop(0.42, 'rgba(255,255,255,0.08)');
    body.addColorStop(1, 'rgba(0,0,0,0.34)');
    ctx.fillStyle = body;
    ctx.fillRect(-size * 0.7, -size * 0.75, size * 1.4, size * 1.35);

    const gloss = ctx.createRadialGradient(-size * 0.2, -size * 0.3, 0, -size * 0.2, -size * 0.3, size * 0.3);
    gloss.addColorStop(0, 'rgba(255,255,255,0.88)');
    gloss.addColorStop(0.4, 'rgba(255,255,255,0.22)');
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gloss;
    ctx.fillRect(-size * 0.6, -size * 0.65, size * 1.2, size * 1.2);
    ctx.restore();

    heartPath(size);
    ctx.strokeStyle = 'rgba(255,190,198,0.72)';
    ctx.lineWidth = Math.max(1, size * 0.045);
    ctx.stroke();

    ctx.restore();
  }

  function drawLegacyCustomHeart(x, y, size, type, side, filled, alpha, scale) {
    if (alpha <= 0) return;
    const pal = getPalette(type, side);

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    ctx.lineJoin = 'round';

    const shape = type === 'blade' ? facetedHeartPath : heartPath;

    // Back embellishments
    if (type === 'vampire') {
      drawBatWing(size, -1, filled);
      drawBatWing(size, 1, filled);
    } else if (type === 'laser' && filled) {
      // Back half of tiny orbiting halo ring
      ctx.save();
      ctx.rotate(-0.3);
      ctx.scale(1, 0.34);
      ctx.strokeStyle = 'rgba(195,95,255,0.55)';
      ctx.lineWidth = Math.max(1.8, size * 0.085);
      ctx.beginPath();
      ctx.arc(0, -size * 0.12, size * 0.66, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (!filled) {
      shape(size);
      ctx.fillStyle = 'rgba(8,10,18,0.85)';
      ctx.fill();
      const hollow = ctx.createRadialGradient(-size * 0.14, -size * 0.24, 0, 0, 0, size * 0.65);
      hollow.addColorStop(0, rgba(pal.accent, 0.14));
      hollow.addColorStop(1, rgba(pal.color, 0.03));
      shape(size);
      ctx.fillStyle = hollow;
      ctx.fill();
      // Empty-heart silhouettes stay type-specific
      if (type === 'burst') {
        ctx.strokeStyle = 'rgba(255,237,78,0.3)';
        ctx.lineWidth = Math.max(1, size * 0.045);
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4 + 0.2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * size * 0.45, Math.sin(a) * size * 0.4 - size * 0.08);
          ctx.lineTo(Math.cos(a) * size * 0.68, Math.sin(a) * size * 0.62 - size * 0.08);
          ctx.stroke();
        }
      } else if (type === 'poison') {
        ctx.strokeStyle = 'rgba(160,240,110,0.28)';
        ctx.lineWidth = Math.max(1, size * 0.045);
        for (let i = 0; i < 5; i++) {
          const a = -2.6 + i * 1.15;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * size * 0.42, Math.sin(a) * size * 0.4 - size * 0.08);
          ctx.lineTo(Math.cos(a) * size * 0.62, Math.sin(a) * size * 0.6 - size * 0.08);
          ctx.stroke();
        }
      }
      shape(size);
      ctx.strokeStyle = rgba(type === 'blade' || type === 'glass' ? pal.accent : pal.color, 0.28);
      ctx.lineWidth = Math.max(1, size * 0.048);
      ctx.stroke();
      ctx.restore();
      return;
    }

    // Type-specific silhouettes behind the 3D shell
    if (type === 'burst') {
      ctx.save();
      for (let i = 0; i < 10; i++) {
        const a = i * (Math.PI * 2 / 10) + 0.1;
        const outer = size * (i % 2 ? 0.72 : 0.86);
        const w = 0.1;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a - w) * size * 0.42, Math.sin(a - w) * size * 0.4 - size * 0.08);
        ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer - size * 0.08);
        ctx.lineTo(Math.cos(a + w) * size * 0.42, Math.sin(a + w) * size * 0.4 - size * 0.08);
        ctx.closePath();
        const ray = ctx.createLinearGradient(0, -size * 0.4, 0, size * 0.3);
        ray.addColorStop(0, 'rgba(255,240,120,0.85)');
        ray.addColorStop(1, 'rgba(239,119,36,0.15)');
        ctx.fillStyle = ray;
        ctx.fill();
      }
      ctx.restore();
    } else if (type === 'poison') {
      ctx.save();
      for (let i = 0; i < 7; i++) {
        const a = -2.5 + i * 0.95;
        const outer = size * 0.7;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a - 0.09) * size * 0.4, Math.sin(a - 0.09) * size * 0.4 - size * 0.08);
        ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer - size * 0.08);
        ctx.lineTo(Math.cos(a + 0.09) * size * 0.4, Math.sin(a + 0.09) * size * 0.4 - size * 0.08);
        ctx.closePath();
        ctx.fillStyle = i % 2 ? '#9ee86a' : '#5aa63a';
        ctx.fill();
        ctx.strokeStyle = 'rgba(22,64,20,0.8)';
        ctx.lineWidth = Math.max(0.8, size * 0.025);
        ctx.stroke();
      }
      ctx.restore();
    } else if (type === 'electric') {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,221,64,0.9)';
      ctx.lineWidth = Math.max(1.4, size * 0.06);
      ctx.lineJoin = 'round';
      for (const sgn of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sgn * size * 0.4, -size * 0.34);
        ctx.lineTo(sgn * size * 0.58, -size * 0.14);
        ctx.lineTo(sgn * size * 0.46, -size * 0.02);
        ctx.lineTo(sgn * size * 0.68, size * 0.12);
        ctx.stroke();
      }
      ctx.restore();
    } else if (type === 'glass') {
      ctx.save();
      for (let i = 0; i < 4; i++) {
        const a = -0.6 + i * 1.15;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * size * 0.4, Math.sin(a) * size * 0.4 - size * 0.08);
        ctx.lineTo(Math.cos(a + 0.12) * size * 0.65, Math.sin(a + 0.12) * size * 0.65 - size * 0.08);
        ctx.lineTo(Math.cos(a - 0.02) * size * 0.52, Math.sin(a - 0.02) * size * 0.52 - size * 0.08);
        ctx.closePath();
        ctx.fillStyle = 'rgba(220,255,252,0.6)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = Math.max(0.8, size * 0.022);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Outer glow & main 3D shell
    ctx.save();
    shape(size);
    ctx.shadowColor = rgba(type === 'blade' ? pal.accent : pal.glow, 0.62);
    ctx.shadowBlur = size * 0.42;
    ctx.shadowOffsetY = size * 0.1;

    const shell = ctx.createLinearGradient(-size * 0.15, -size * 0.56, size * 0.15, size * 0.42);
    if (type === 'blade') {
      shell.addColorStop(0, '#eef3fa');
      shell.addColorStop(0.45, '#8991a0');
      shell.addColorStop(1, '#313746');
    } else if (type === 'laser') {
      shell.addColorStop(0, '#ffe4ff');
      shell.addColorStop(0.42, '#9a36f5');
      shell.addColorStop(1, '#350a69');
    } else if (type === 'glass') {
      shell.addColorStop(0, '#ffffff');
      shell.addColorStop(0.42, '#a9f3ed');
      shell.addColorStop(1, '#2b7f96');
    } else if (type === 'electric') {
      shell.addColorStop(0, '#e2ebff');
      shell.addColorStop(0.42, '#4f6ee8');
      shell.addColorStop(1, '#131e5c');
    } else if (type === 'burst') {
      shell.addColorStop(0, '#fff5b0');
      shell.addColorStop(0.45, '#f7a12a');
      shell.addColorStop(1, '#8a2b05');
    } else if (type === 'poison') {
      shell.addColorStop(0, '#efffc4');
      shell.addColorStop(0.45, '#7acb48');
      shell.addColorStop(1, '#1c4a1a');
    } else {
      shell.addColorStop(0, rgba(lighten(pal.color, 105), 1));
      shell.addColorStop(0.45, rgba(pal.color, 1));
      shell.addColorStop(1, rgba(pal.dark, 1));
    }
    ctx.fillStyle = shell;
    ctx.fill();
    ctx.restore();

    // Inner 3D shading clipped to heart
    ctx.save();
    shape(size);
    ctx.clip();

    const body = ctx.createRadialGradient(-size * 0.2, -size * 0.3, 0, 0, size * 0.02, size * 0.72);
    if (type === 'blade') {
      body.addColorStop(0, 'rgba(255,255,255,0.75)');
      body.addColorStop(0.45, 'rgba(155,165,182,0.25)');
      body.addColorStop(1, 'rgba(22,28,40,0.75)');
    } else if (type === 'laser') {
      body.addColorStop(0, 'rgba(255,235,255,0.92)');
      body.addColorStop(0.45, 'rgba(175,70,255,0.45)');
      body.addColorStop(1, 'rgba(35,6,72,0.82)');
    } else if (type === 'glass') {
      body.addColorStop(0, 'rgba(255,255,255,0.96)');
      body.addColorStop(0.45, 'rgba(160,248,242,0.4)');
      body.addColorStop(1, 'rgba(18,72,92,0.7)');
    } else if (type === 'electric') {
      body.addColorStop(0, 'rgba(255,249,196,0.9)');
      body.addColorStop(0.4, 'rgba(94,126,245,0.4)');
      body.addColorStop(1, 'rgba(11,24,74,0.82)');
    } else if (type === 'burst') {
      body.addColorStop(0, 'rgba(255,250,190,0.95)');
      body.addColorStop(0.45, 'rgba(255,166,50,0.42)');
      body.addColorStop(1, 'rgba(92,22,4,0.82)');
    } else if (type === 'poison') {
      body.addColorStop(0, 'rgba(238,255,190,0.9)');
      body.addColorStop(0.45, 'rgba(123,220,76,0.42)');
      body.addColorStop(1, 'rgba(18,58,20,0.82)');
    } else {
      body.addColorStop(0, rgba(lighten(pal.color, 130), 0.92));
      body.addColorStop(0.42, rgba(lighten(pal.color, 30), 0.45));
      body.addColorStop(1, rgba(pal.dark, 0.78));
    }
    ctx.fillStyle = body;
    ctx.fillRect(-size * 0.65, -size * 0.7, size * 1.3, size * 1.25);

    if (type === 'blade') {
      // Glowing cyan plasma seam down the center of the armored heart
      ctx.save();
      ctx.shadowColor = '#7ffaff';
      ctx.shadowBlur = size * 0.28;
      ctx.strokeStyle = '#7ffaff';
      ctx.lineWidth = Math.max(2, size * 0.11);
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.35);
      ctx.lineTo(0, size * 0.42);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, size * 0.04);
      ctx.stroke();
      ctx.restore();

      // Faceted steel highlight plane on left lobe
      ctx.fillStyle = 'rgba(255,255,255,0.34)';
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.33);
      ctx.lineTo(-size * 0.25, -size * 0.56);
      ctx.lineTo(-size * 0.52, -size * 0.36);
      ctx.lineTo(-size * 0.15, -size * 0.05);
      ctx.closePath();
      ctx.fill();
    } else if (type === 'laser') {
      // Crystal facet reflections
      ctx.fillStyle = 'rgba(255,255,255,0.36)';
      ctx.beginPath();
      ctx.moveTo(-size * 0.24, -size * 0.52);
      ctx.lineTo(0, -size * 0.18);
      ctx.lineTo(-size * 0.42, -size * 0.18);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(254,178,255,0.45)';
      ctx.beginPath();
      ctx.moveTo(size * 0.22, -size * 0.48);
      ctx.lineTo(size * 0.4, -size * 0.15);
      ctx.lineTo(0, -size * 0.18);
      ctx.closePath();
      ctx.fill();
    }

    // Specular glass gloss on upper-left lobe
    const gloss = ctx.createRadialGradient(-size * 0.22, -size * 0.31, 0, -size * 0.22, -size * 0.31, size * 0.32);
    gloss.addColorStop(0, 'rgba(255,255,255,0.92)');
    gloss.addColorStop(0.32, 'rgba(255,255,255,0.38)');
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gloss;
    ctx.fillRect(-size * 0.6, -size * 0.7, size * 1.2, size * 1.2);

    ctx.restore();

    // Crisp rim outline
    shape(size);
    ctx.strokeStyle = type === 'blade' ? '#d4e2f4'
      : type === 'laser' ? '#feb2ff'
      : type === 'electric' ? 'rgba(255,221,64,0.9)'
      : type === 'glass' ? 'rgba(255,255,255,0.95)'
      : type === 'burst' ? 'rgba(255,237,78,0.9)'
      : type === 'poison' ? 'rgba(200,255,150,0.9)'
      : rgba(darken(pal.dark, 0.55), 1);
    ctx.lineWidth = Math.max(1.1, size * 0.055);
    ctx.stroke();

    // Front embellishments
    if (type === 'vampire') {
      // Twin gleaming mini ivory fangs peeking from lower cusp
      for (const sgn of [-1, 1]) {
        ctx.fillStyle = '#fcfbfc';
        ctx.strokeStyle = '#33040c';
        ctx.lineWidth = Math.max(0.8, size * 0.032);
        ctx.beginPath();
        ctx.moveTo(sgn * size * 0.12, size * 0.15);
        ctx.lineTo(sgn * size * 0.26, size * 0.08);
        ctx.lineTo(sgn * size * 0.2, size * 0.43);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    } else if (type === 'laser') {
      // Front half of orbiting glowing magenta halo ring
      ctx.save();
      ctx.rotate(-0.3);
      ctx.scale(1, 0.34);
      ctx.shadowColor = '#feb2ff';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#feb2ff';
      ctx.lineWidth = Math.max(2, size * 0.095);
      ctx.beginPath();
      ctx.arc(0, -size * 0.12, size * 0.66, 0, Math.PI);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, size * 0.036);
      ctx.stroke();
      ctx.restore();
    } else if (type === 'glass') {
      // Faceted crystal seams & prism sparkle
      ctx.save();
      shape(size);
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.72)';
      ctx.lineWidth = Math.max(1, size * 0.035);
      ctx.beginPath();
      ctx.moveTo(-size * 0.4, -size * 0.28);
      ctx.lineTo(0, -size * 0.02);
      ctx.lineTo(-size * 0.26, size * 0.28);
      ctx.lineTo(0, size * 0.44);
      ctx.moveTo(0, -size * 0.02);
      ctx.lineTo(size * 0.42, -size * 0.24);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.34)';
      ctx.beginPath();
      ctx.moveTo(-size * 0.47, -size * 0.36);
      ctx.lineTo(0, -size * 0.34);
      ctx.lineTo(-size * 0.18, -size * 0.06);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (type === 'electric') {
      // Charged yellow lightning bolt splitting the heart
      ctx.save();
      shape(size);
      ctx.clip();
      ctx.shadowColor = '#ffdd40';
      ctx.shadowBlur = size * 0.25;
      ctx.fillStyle = '#ffed72';
      ctx.beginPath();
      ctx.moveTo(size * 0.06, -size * 0.34);
      ctx.lineTo(-size * 0.18, size * 0.03);
      ctx.lineTo(size * 0.02, size * 0.03);
      ctx.lineTo(-size * 0.08, size * 0.4);
      ctx.lineTo(size * 0.2, -size * 0.02);
      ctx.lineTo(size * 0.01, -size * 0.02);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#fffbe0';
      ctx.lineWidth = Math.max(0.9, size * 0.028);
      ctx.stroke();
      ctx.restore();
    } else if (type === 'burst') {
      // Solar starburst core
      ctx.save();
      ctx.shadowColor = '#ffed4e';
      ctx.shadowBlur = size * 0.3;
      const pulse = 0.9 + Math.sin(clock * 5) * 0.1;
      ctx.fillStyle = '#ffed4e';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 - Math.PI / 2;
        const rad = (i % 2 ? size * 0.1 : size * 0.22) * pulse;
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad - size * 0.06;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(138,43,5,0.8)';
      ctx.lineWidth = Math.max(0.8, size * 0.022);
      ctx.stroke();
      ctx.restore();
    } else if (type === 'poison') {
      // Venom bubbles & dripping toxin
      ctx.save();
      shape(size);
      ctx.clip();
      ctx.fillStyle = 'rgba(20,66,20,0.45)';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(-size * 0.16 + i * size * 0.16, size * 0.02 + (i % 2) * size * 0.12, size * (0.052 + i * 0.012), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(220,255,170,0.75)';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(-size * 0.19 + i * size * 0.16, -size * 0.015 + (i % 2) * size * 0.12, size * 0.024, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      // Dripping droplet under the point
      ctx.fillStyle = 'rgba(150,255,100,0.9)';
      ctx.beginPath();
      ctx.ellipse(0, size * 0.5, size * 0.055, size * 0.085, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(30,80,26,0.8)';
      ctx.lineWidth = Math.max(0.7, size * 0.02);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawHearts() {
    if (battle.on) { drawBattleHud(); return; }
    const size = clamp(minDim() * 0.05, 19, 32);
    const gap = Math.min(size * 1.56, Math.max(size * 1.28, (arena.w * 0.4) / 2.3));
    const baseY = arena.y * 0.54;
    const leftStart = Math.max(size * 1.0, arena.x + size * 0.84);
    const rightStart = Math.min(W - size * 1.0, arena.x + arena.w - size * 0.84);

    for (let i = 0; i < MAX_LIVES; i++) {
      const bob = Math.sin(clock * 2.1 + i * 0.75) * size * 0.04;
      const y = baseY + bob;
      const rx = leftStart + i * gap;
      const bx = rightStart - i * gap;
      drawCustomHeart(rx, y, size, red.type, 'red', i < red.lives, 1, 1);
      drawCustomHeart(bx, y, size, blue.type, 'blue', i < blue.lives, 1, 1);
    }

    for (const fx of heartFx) {
      const t = clamp(fx.age / fx.life, 0, 1);
      const isRed = fx.ball === red;
      const hx = isRed ? leftStart + fx.index * gap : rightStart - fx.index * gap;
      drawCustomHeart(hx, baseY - t * size * 0.65, size, fx.type, fx.ball.side, true, 1 - t, 1 + t * 0.7);
    }

    // Player names beside each heart row
    ctx.save();
    ctx.font = `800 ${clamp(size * 0.55, 10, 15)}px system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,140,155,0.95)';
    ctx.fillText(names.red, leftStart + MAX_LIVES * gap + 8, baseY);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(130,205,255,0.95)';
    ctx.fillText(names.blue, rightStart - MAX_LIVES * gap - 8, baseY);
    ctx.restore();
  }

  /* ---------- visual-only 3D mini-ball selector ---------- */

  function drawPicker() {
    // Only render owned miniatures while aiming; combat stays as light as possible
    if (phase !== 'aim' || battle.on) return;
    ctx.save();

    for (let i = 0; i < picker.items.length; i++) {
      const it = picker.items[i];
      const owner = it.side === 'red' ? red : blue;
      const selected = owner.type === it.id;
      const hovered = picker.hover === i;
      const targetScale = selected ? 1.18 : (hovered ? 1.1 : 0.94);
      const sk = it.side + ':' + it.id;
      if (pickerScales[sk] === undefined) pickerScales[sk] = targetScale;
      pickerScales[sk] += (targetScale - pickerScales[sk]) * 0.22;
      const sc = pickerScales[sk];
      const pal = getPalette(it.id, it.side);
      const gemColor = RARITY_COLORS[(BALL_INFO[it.id] || {}).rarity] || '#b8c0cc';
      const bob = selected ? Math.sin(clock * 4) * 2.2 : 0;
      const ringCol = it.side === 'red' ? { r: 255, g: 110, b: 125 } : { r: 92, g: 190, b: 255 };

      // Pedestal ring in the owner's color, glowing when selected
      ctx.save();
      ctx.beginPath();
      ctx.arc(it.x, it.y + bob, it.r * sc * 1.32, 0, Math.PI * 2);
      ctx.fillStyle = selected ? 'rgba(255,255,255,0.08)' : 'rgba(12,15,26,0.72)';
      ctx.fill();
      ctx.strokeStyle = selected
        ? rgba(ringCol, 0.95)
        : (hovered ? 'rgba(255,255,255,0.45)' : rgba(ringCol, 0.35));
      ctx.globalAlpha = selected ? 1 : (hovered ? 0.85 : 0.6);
      ctx.lineWidth = selected ? 2.6 : 1.4;
      if (selected) {
        ctx.shadowColor = rgba(ringCol, 0.85);
        ctx.shadowBlur = 12;
      }
      ctx.stroke();
      ctx.restore();

      // Rarity gem set into the pedestal ring
      {
        const ringR = it.r * sc * 1.32;
        const gx = it.x + Math.cos(0.8) * ringR;
        const gy = it.y + bob + Math.sin(0.8) * ringR;
        const gs = clamp(it.r * 0.2, 3, 4.6);
        ctx.save();
        ctx.shadowColor = gemColor;
        ctx.shadowBlur = selected || hovered ? 8 : 3;
        ctx.beginPath();
        ctx.moveTo(gx, gy - gs * 1.3);
        ctx.lineTo(gx + gs, gy);
        ctx.lineTo(gx, gy + gs * 1.3);
        ctx.lineTo(gx - gs, gy);
        ctx.closePath();
        ctx.fillStyle = gemColor;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(8,10,18,0.85)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }

      // Baked miniature: the whole roster costs one blit per slot instead of
      // a few hundred shaded vector ops every frame
      drawBallSprite(it.side, it.id, it.r * 0.86, it.x, it.y + bob, sc);
    }

    // Tiny NEW tags on the newest balls
    for (const it of picker.items) {
      if (!NEW_BALLS.has(it.id)) continue;
      const sc = pickerScales[it.side + ':' + it.id] || 1;
      drawNewBadge(it.x + it.r * sc * 0.9, it.y - it.r * sc * 1.28, clamp(it.r * 0.42, 6.5, 8.5));
    }
    drawInvButtons();
    ctx.restore();
  }

  /* ---------- NEW tag, inventory button & inventory screen ---------- */

  const INV_FILTERS = ['ALL', 'COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'];

  function drawNewBadge(cx, cy, fs) {
    ctx.save();
    ctx.font = `900 ${fs}px system-ui, -apple-system, sans-serif`;
    const tw = ctx.measureText('NEW').width;
    const w = tw + fs * 0.9;
    const h = fs * 1.45;
    const x = cx - w / 2;
    const y = cy - h / 2;
    const pulse = 0.5 + Math.sin(clock * 4) * 0.5;
    ctx.shadowColor = `rgba(255,70,110,${0.45 + pulse * 0.35})`;
    ctx.shadowBlur = 6 + pulse * 4;
    roundedRect(x, y, w, h, h / 2);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#ff7a7a');
    g.addColorStop(1, '#e8174f');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NEW', cx, cy + fs * 0.05);
    ctx.restore();
  }

  // Recently picked balls fill the quick row when not every ball fits
  function getRecent(side) {
    if (!recent[side]) {
      const eq = side === 'red' ? red.type : blue.type;
      const list = [eq];
      for (const id of BALL_ORDER) if (NEW_BALLS.has(id) && !list.includes(id)) list.push(id);
      for (const id of BALL_ORDER) if (!list.includes(id)) list.push(id);
      recent[side] = list;
    }
    return recent[side];
  }

  function touchRecent(side, id) {
    recent[side] = [id, ...getRecent(side).filter(x => x !== id)];
  }

  function quickList(side, cap) {
    const eq = side === 'red' ? red.type : blue.type;
    const ordered = [eq, ...getRecent(side).filter(id => id !== eq)];
    return ordered.slice(0, cap).sort((a, b) => BALL_ORDER.indexOf(a) - BALL_ORDER.indexOf(b));
  }

  function hitInvButton(px, py) {
    if (phase !== 'aim' || inv.open || battle.on) return null;
    for (const b of picker.invBtns || []) {
      if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) return b.side;
    }
    return null;
  }

  function drawInvButtons() {
    for (const btn of picker.invBtns || []) {
      const hov = picker.invHover === btn.side;
      const sideCol = btn.side === 'red' ? '#ff6e7e' : '#5cc4ff';
      const { x, w, h } = btn;
      const y = btn.y - (hov ? 2 : 0);
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = hov ? 16 : 10;
      ctx.shadowOffsetY = 3;
      roundedRect(x, y, w, h, 11);
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, hov ? '#2c3348' : '#22283a');
      g.addColorStop(1, '#12151f');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.strokeStyle = hexA(sideCol, hov ? 0.95 : 0.5);
      ctx.lineWidth = hov ? 2 : 1.4;
      ctx.stroke();

      // 3x3 grid icon
      const cell = w * 0.13;
      const gap = w * 0.055;
      const gw = cell * 3 + gap * 2;
      const gx = x + (w - gw) / 2;
      const gy = y + h * 0.17;
      for (let rr = 0; rr < 3; rr++) {
        for (let cc = 0; cc < 3; cc++) {
          roundedRect(gx + cc * (cell + gap), gy + rr * (cell + gap), cell, cell, cell * 0.3);
          ctx.fillStyle = rr === 0 && cc === 0 ? sideCol : 'rgba(255,255,255,0.82)';
          ctx.fill();
        }
      }
      ctx.font = `800 ${clamp(w * 0.2, 8, 10)}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.62)';
      ctx.fillText(String(BALL_ORDER.length), x + w / 2, y + h * 0.84);

      // Red dot when a NEW ball is only reachable through the inventory
      const shown = new Set(picker.items.filter(it => it.side === btn.side).map(it => it.id));
      if ([...NEW_BALLS].some(id => !shown.has(id))) {
        ctx.fillStyle = '#ff3d6e';
        ctx.shadowColor = 'rgba(255,61,110,0.8)';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(x + w - 3, y + 3, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      if (hov) {
        const label = btn.side === 'red' ? 'INVENTORY  (I)' : 'INVENTORY';
        ctx.font = '800 10px system-ui, -apple-system, sans-serif';
        const tw = ctx.measureText(label).width + 16;
        const tx = clamp(x + w / 2 - tw / 2, 6, W - tw - 6);
        roundedRect(tx, y - 28, tw, 20, 10);
        ctx.fillStyle = 'rgba(10,12,22,0.95)';
        ctx.fill();
        ctx.strokeStyle = hexA(sideCol, 0.6);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#f2f5fb';
        ctx.fillText(label, tx + tw / 2, y - 18);
      }
      ctx.restore();
    }
  }

  function invLayout() {
    const pw = Math.min(W - 24, 800);
    const ph = Math.min(H - 24, 640);
    const px = (W - pw) / 2;
    const py = (H - ph) / 2;
    const pad = 22;
    const headerH = 66;
    const chipH = 28;
    const chipsY = py + headerH;
    const gx = px + pad;
    const gy = chipsY + chipH + 16;
    const gw = pw - pad * 2 - 14;
    const gh = Math.max(60, py + ph - 38 - gy);
    const gap = 12;
    const cols = Math.max(2, Math.floor((gw + gap) / (122 + gap)));
    const tw = (gw - gap * (cols - 1)) / cols;
    const th = Math.min(tw * 1.1, 156);
    const list = BALL_ORDER.filter(id => inv.filter === 'ALL' || BALL_INFO[id].rarity === inv.filter);
    const rows = Math.ceil(list.length / cols);
    const contentH = Math.max(0, rows * (th + gap) - gap);
    const close = { x: px + pw - 50, y: py + 17, w: 32, h: 32 };
    const tabs = [];
    if (mode === '2p') {
      const tw2 = pw < 600 ? 92 : 128;
      const tx0 = close.x - 12 - (tw2 * 2 + 8);
      tabs.push({ side: 'red', x: tx0, y: py + 19, w: tw2, h: 28 });
      tabs.push({ side: 'blue', x: tx0 + tw2 + 8, y: py + 19, w: tw2, h: 28 });
    }
    const chips = [];
    ctx.save();
    ctx.font = '800 10.5px system-ui, -apple-system, sans-serif';
    let cx = gx;
    for (const f of INV_FILTERS) {
      const count = f === 'ALL' ? BALL_ORDER.length : BALL_ORDER.filter(id => BALL_INFO[id].rarity === f).length;
      const w = ctx.measureText(f + ' ' + count).width + (f === 'ALL' ? 24 : 36);
      chips.push({ f, count, x: cx, y: chipsY, w, h: chipH });
      cx += w + 8;
    }
    ctx.restore();
    return { px, py, pw, ph, gx, gy, gw, gh, gap, cols, tw, th, list, contentH, max: Math.max(0, contentH - gh), close, tabs, chips };
  }

  function invTileAt(px, py, L) {
    if (px < L.gx || px > L.gx + L.gw || py < L.gy || py > L.gy + L.gh) return -1;
    const lx = px - L.gx;
    const ly = py - L.gy + inv.scroll;
    const col = Math.floor(lx / (L.tw + L.gap));
    const row = Math.floor(ly / (L.th + L.gap));
    if (col < 0 || col >= L.cols || row < 0) return -1;
    if (lx - col * (L.tw + L.gap) > L.tw || ly - row * (L.th + L.gap) > L.th) return -1;
    const i = row * L.cols + col;
    return i < L.list.length ? i : -1;
  }

  function invUiAt(x, y, L) {
    if (inRect(L.close, x, y)) return 'close';
    for (const t of L.tabs) if (inRect(t, x, y)) return 'tab:' + t.side;
    for (const c of L.chips) if (inRect(c, x, y)) return 'chip:' + c.f;
    return null;
  }

  function scrollInvToEquipped() {
    const L = invLayout();
    const eq = inv.side === 'red' ? red.type : blue.type;
    const idx = L.list.indexOf(eq);
    const row = idx >= 0 ? Math.floor(idx / L.cols) : 0;
    inv.target = clamp(row * (L.th + L.gap) - L.gh / 2 + L.th / 2, 0, L.max);
    inv.scroll = inv.target;
  }

  function openInventory(side) {
    if (phase !== 'aim') return;
    inv.open = true;
    inv.side = side;
    inv.hover = -1;
    inv.hoverUi = null;
    inv.drag = null;
    activePointer = null;
    keys.left = keys.right = false;
    p2.left = p2.right = false;
    picker.hover = -1;
    picker.invHover = null;
    hoverBall = null;
    scrollInvToEquipped();
    ensureAudio();
    sfx.invOpen();
  }

  function closeInventory() {
    if (!inv.open) return;
    inv.open = false;
    inv.hover = -1;
    inv.hoverUi = null;
    inv.drag = null;
    sfx.invClose();
  }

  function invPointerMove(e) {
    const L = invLayout();
    if (inv.drag && e.pointerId === inv.drag.id) {
      const dy = e.clientY - inv.drag.y;
      if (Math.abs(dy) > 6) inv.drag.moved = true;
      if (inv.drag.moved) {
        inv.target = clamp(inv.drag.scroll - dy, 0, L.max);
        inv.scroll = inv.target;
      }
    }
    inv.hover = inv.drag && inv.drag.moved ? -1 : invTileAt(e.clientX, e.clientY, L);
    inv.hoverUi = invUiAt(e.clientX, e.clientY, L);
    canvas.classList.toggle('hover-pick', inv.hover >= 0 || !!inv.hoverUi);
  }

  function invPointerDown(e) {
    const L = invLayout();
    const x = e.clientX;
    const y = e.clientY;
    const ui = invUiAt(x, y, L);
    if (ui === 'close') { closeInventory(); return; }
    if (ui && ui.startsWith('tab:')) {
      inv.side = ui.slice(4);
      scrollInvToEquipped();
      sfx.select(1);
      return;
    }
    if (ui && ui.startsWith('chip:')) {
      inv.filter = ui.slice(5);
      inv.target = 0;
      inv.scroll = 0;
      sfx.select(2);
      return;
    }
    if (!inRect({ x: L.px, y: L.py, w: L.pw, h: L.ph }, x, y)) {
      closeInventory();
      return;
    }
    if (x >= L.gx && x <= L.gx + L.gw + 14 && y >= L.gy && y <= L.gy + L.gh) {
      inv.drag = { id: e.pointerId, y, scroll: inv.target, moved: false };
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    }
  }

  function invPointerUp(e) {
    const d = inv.drag;
    inv.drag = null;
    if (!d || d.moved) return;
    const L = invLayout();
    const i = invTileAt(e.clientX, e.clientY, L);
    if (i >= 0) {
      const id = L.list[i];
      selectPlayerBall(inv.side, id);
      touchRecent(inv.side, id);
      computeLayout();
      closeInventory();
    }
  }

  function invKey(e) {
    const k = e.key;
    e.preventDefault();
    if (k === 'Escape' || k === 'i' || k === 'I') {
      closeInventory();
      return;
    }
    const L = invLayout();
    if (k === 'ArrowDown' || k === 's' || k === 'S') inv.target = clamp(inv.target + 90, 0, L.max);
    if (k === 'ArrowUp' || k === 'w' || k === 'W') inv.target = clamp(inv.target - 90, 0, L.max);
    if (k === 'Tab' && mode === '2p') {
      inv.side = inv.side === 'red' ? 'blue' : 'red';
      scrollInvToEquipped();
    }
  }

  function updateInventory(dt) {
    if (inv.open && phase !== 'aim') {
      inv.open = false;
      inv.drag = null;
    }
    inv.anim += ((inv.open ? 1 : 0) - inv.anim) * Math.min(1, dt * 14);
    if (inv.anim < 0.002) inv.anim = 0;
    if (inv.open) {
      const L = invLayout();
      inv.target = clamp(inv.target, 0, L.max);
    }
    inv.scroll += (inv.target - inv.scroll) * Math.min(1, dt * 16);
  }

  function drawInvTile(id, i, x, y, w, h, hov) {
    const info = BALL_INFO[id];
    const rc = RARITY_COLORS[info.rarity] || '#b8c0cc';
    const owner = inv.side === 'red' ? red : blue;
    const eq = owner.type === id;
    const sideCol = inv.side === 'red' ? '#ff6e7e' : '#5cc4ff';
    const yy = y - (hov ? 3 : 0);

    ctx.save();
    if (hov) {
      ctx.shadowColor = hexA(rc, 0.35);
      ctx.shadowBlur = 16;
    }
    roundedRect(x, yy, w, h, 14);
    const bg = ctx.createLinearGradient(0, yy, 0, yy + h);
    bg.addColorStop(0, hov ? '#242a3f' : '#1d2234');
    bg.addColorStop(1, '#111420');
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.restore();

    ctx.save();
    roundedRect(x, yy, w, h, 14);
    ctx.clip();
    const wash = ctx.createRadialGradient(x + w / 2, yy + h * 0.4, 0, x + w / 2, yy + h * 0.4, w * 0.62);
    wash.addColorStop(0, hexA(rc, hov ? 0.28 : 0.16));
    wash.addColorStop(1, hexA(rc, 0));
    ctx.fillStyle = wash;
    ctx.fillRect(x, yy, w, h);
    ctx.fillStyle = rc;
    ctx.fillRect(x, yy + h - 3, w, 3);
    ctx.restore();

    roundedRect(x + 0.5, yy + 0.5, w - 1, h - 1, 14);
    ctx.strokeStyle = eq ? sideCol : (hov ? hexA(rc, 0.85) : 'rgba(255,255,255,0.08)');
    ctx.lineWidth = eq ? 2 : (hov ? 1.5 : 1);
    ctx.stroke();

    const pal = getPalette(id, inv.side);
    drawBallSprite(inv.side, id, Math.min(w, h) * 0.19, x + w / 2, yy + h * 0.4, 1);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 11.5px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#f2f5fb';
    ctx.fillText(info.name, x + w / 2, yy + h * 0.76);
    ctx.font = '800 9px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = rc;
    ctx.fillText(info.rarity, x + w / 2, yy + h * 0.88);
    if (eq) {
      ctx.font = '900 8px system-ui, -apple-system, sans-serif';
      const ew = ctx.measureText('EQUIPPED').width + 10;
      roundedRect(x + 7, yy + 7, ew, 14, 7);
      ctx.fillStyle = hexA(sideCol, 0.2);
      ctx.fill();
      ctx.strokeStyle = sideCol;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = sideCol;
      ctx.fillText('EQUIPPED', x + 7 + ew / 2, yy + 14.5);
    }
    ctx.restore();
    if (NEW_BALLS.has(id)) drawNewBadge(x + w - 22, yy + 15, 8.5);
  }

  function drawInventory() {
    if (inv.anim <= 0.01) return;
    const a = inv.anim;
    const L = invLayout();
    const sideCol = inv.side === 'red' ? '#ff6e7e' : '#5cc4ff';

    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(4,5,10,0.74)';
    ctx.fillRect(0, 0, W, H);
    const sc = 0.95 + 0.05 * a;
    ctx.translate(W / 2, H / 2);
    ctx.scale(sc, sc);
    ctx.translate(-W / 2, -H / 2);

    // Panel
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 12;
    roundedRect(L.px, L.py, L.pw, L.ph, 20);
    const pg = ctx.createLinearGradient(0, L.py, 0, L.py + L.ph);
    pg.addColorStop(0, '#181c2c');
    pg.addColorStop(1, '#0b0d15');
    ctx.fillStyle = pg;
    ctx.fill();
    ctx.restore();
    ctx.save();
    roundedRect(L.px, L.py, L.pw, L.ph, 20);
    ctx.clip();
    const strip = ctx.createLinearGradient(L.px, 0, L.px + L.pw, 0);
    strip.addColorStop(0, hexA(sideCol, 0));
    strip.addColorStop(0.5, hexA(sideCol, 0.9));
    strip.addColorStop(1, hexA(sideCol, 0));
    ctx.fillStyle = strip;
    ctx.fillRect(L.px, L.py, L.pw, 3);
    ctx.restore();
    roundedRect(L.px + 0.5, L.py + 0.5, L.pw - 1, L.ph - 1, 20);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Header
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '900 20px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#f5f7fc';
    ctx.fillText('INVENTORY', L.px + 22, L.py + 28);
    ctx.font = '700 11px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(200,208,226,0.55)';
    ctx.fillText(mode === '2p' ? 'CHOOSING FOR ' + names[inv.side] : BALL_ORDER.length + ' BALLS - ALL UNLOCKED', L.px + 22, L.py + 48);

    for (const t of L.tabs) {
      const active = inv.side === t.side;
      const col = t.side === 'red' ? '#ff6e7e' : '#5cc4ff';
      const hov = inv.hoverUi === 'tab:' + t.side;
      roundedRect(t.x, t.y, t.w, t.h, 14);
      ctx.fillStyle = active ? hexA(col, 0.2) : (hov ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)');
      ctx.fill();
      ctx.strokeStyle = active ? col : 'rgba(255,255,255,0.14)';
      ctx.lineWidth = active ? 1.6 : 1;
      ctx.stroke();
      ctx.font = '800 11px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = active ? col : 'rgba(255,255,255,0.6)';
      ctx.fillText(names[t.side], t.x + t.w / 2, t.y + t.h / 2 + 0.5);
    }

    const cb = L.close;
    const cHov = inv.hoverUi === 'close';
    ctx.beginPath();
    ctx.arc(cb.x + cb.w / 2, cb.y + cb.h / 2, cb.w / 2, 0, Math.PI * 2);
    ctx.fillStyle = cHov ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)';
    ctx.fill();
    ctx.strokeStyle = cHov ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = '#f2f5fb';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    const cx0 = cb.x + cb.w / 2;
    const cy0 = cb.y + cb.h / 2;
    ctx.beginPath();
    ctx.moveTo(cx0 - 6, cy0 - 6);
    ctx.lineTo(cx0 + 6, cy0 + 6);
    ctx.moveTo(cx0 + 6, cy0 - 6);
    ctx.lineTo(cx0 - 6, cy0 + 6);
    ctx.stroke();

    // Rarity filter chips
    for (const c of L.chips) {
      const active = inv.filter === c.f;
      const hov = inv.hoverUi === 'chip:' + c.f;
      const col = c.f === 'ALL' ? '#f2f5fb' : RARITY_COLORS[c.f];
      roundedRect(c.x, c.y, c.w, c.h, 14);
      ctx.fillStyle = active ? hexA(col, 0.16) : (hov ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)');
      ctx.fill();
      ctx.strokeStyle = active ? hexA(col, 0.85) : 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.font = '800 10.5px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      let tx = c.x + 12;
      if (c.f !== 'ALL') {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(c.x + 15, c.y + c.h / 2, 4, 0, Math.PI * 2);
        ctx.fill();
        tx = c.x + 25;
      }
      ctx.fillStyle = active ? '#ffffff' : 'rgba(255,255,255,0.7)';
      ctx.fillText(c.f, tx, c.y + c.h / 2 + 0.5);
      const fw = ctx.measureText(c.f + ' ').width;
      ctx.fillStyle = 'rgba(255,255,255,0.38)';
      ctx.fillText(String(c.count), tx + fw, c.y + c.h / 2 + 0.5);
    }

    // Scrollable grid of balls
    ctx.save();
    ctx.beginPath();
    ctx.rect(L.gx - 8, L.gy - 6, L.gw + 16, L.gh + 6);
    ctx.clip();
    L.list.forEach((id, i) => {
      const col = i % L.cols;
      const row = Math.floor(i / L.cols);
      const tx = L.gx + col * (L.tw + L.gap);
      const ty = L.gy + row * (L.th + L.gap) - inv.scroll;
      if (ty > L.gy + L.gh || ty + L.th < L.gy - 6) return;
      drawInvTile(id, i, tx, ty, L.tw, L.th, i === inv.hover);
    });
    ctx.restore();

    // Soft fades at the scroll edges
    if (inv.scroll > 2) {
      const f = ctx.createLinearGradient(0, L.gy, 0, L.gy + 22);
      f.addColorStop(0, 'rgba(20,23,36,0.95)');
      f.addColorStop(1, 'rgba(20,23,36,0)');
      ctx.fillStyle = f;
      ctx.fillRect(L.gx - 8, L.gy, L.gw + 16, 22);
    }
    if (inv.scroll < L.max - 2) {
      const f = ctx.createLinearGradient(0, L.gy + L.gh - 26, 0, L.gy + L.gh);
      f.addColorStop(0, 'rgba(13,15,24,0)');
      f.addColorStop(1, 'rgba(13,15,24,0.95)');
      ctx.fillStyle = f;
      ctx.fillRect(L.gx - 8, L.gy + L.gh - 26, L.gw + 16, 26);
    }

    // Scrollbar
    if (L.max > 0) {
      const sx = L.gx + L.gw + 6;
      roundedRect(sx, L.gy, 5, L.gh, 2.5);
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fill();
      const thumbH = Math.max(32, L.gh * L.gh / (L.contentH || 1));
      const thumbY = L.gy + (L.gh - thumbH) * (inv.scroll / L.max);
      roundedRect(sx, thumbY, 5, thumbH, 2.5);
      ctx.fillStyle = hexA(sideCol, 0.75);
      ctx.fill();
    }

    ctx.font = '700 10.5px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('SCROLL OR DRAG TO BROWSE  -  CLICK A BALL TO EQUIP  -  ESC TO CLOSE', W / 2, L.py + L.ph - 17);
    ctx.restore();
  }

  /* ---------- hover info card ---------- */

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function wrapLines(text, maxW) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (line && ctx.measureText(test).width > maxW) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function currentHover() {
    if (phase !== 'aim') return null;
    if (inv.open) {
      if (inv.anim < 0.9 || inv.hover < 0 || (inv.drag && inv.drag.moved)) return null;
      const L = invLayout();
      const id = L.list[inv.hover];
      if (!id) return null;
      const col = inv.hover % L.cols;
      const row = Math.floor(inv.hover / L.cols);
      return {
        key: 'i' + inv.side + id, id, side: inv.side,
        x: L.gx + col * (L.tw + L.gap) + L.tw / 2,
        y: L.gy + row * (L.th + L.gap) - inv.scroll + L.th / 2,
        r: L.th / 2, fromPicker: true, fromInv: true
      };
    }
    if (picker.hover >= 0 && picker.items[picker.hover]) {
      const it = picker.items[picker.hover];
      return { key: 'p' + picker.hover + it.side + it.id, id: it.id, side: it.side, x: it.x, y: it.y, r: it.r * 1.45, fromPicker: true };
    }
    if (hoverBall && hoverBall.alive) {
      return { key: 'b' + hoverBall.side + hoverBall.type, id: hoverBall.type, side: hoverBall.side, x: hoverBall.x, y: hoverBall.y, r: hoverBall.r * 1.15, fromPicker: false };
    }
    return null;
  }

  function updatePopup(dt) {
    const h = currentHover();
    const key = h ? h.key : '';
    if (key !== popupKey) {
      popupKey = key;
      popupAnim = 0;
      popupHold = 0;
    }
    if (!h) {
      popupAnim = 0;
      return;
    }
    popupHold += dt;
    // Arena balls need a short rest so the card does not flicker while aiming
    const delay = h.fromInv ? 0.16 : (h.fromPicker ? 0.04 : 0.35);
    if (popupHold >= delay) popupAnim = Math.min(1, popupAnim + dt * 8);
  }

  function drawInfoPopup() {
    const h = currentHover();
    if (!h || popupAnim <= 0) return;
    const info = BALL_INFO[h.id];
    if (!info) return;
    const rc = RARITY_COLORS[info.rarity] || '#b8c0cc';
    const pal = getPalette(h.id, h.side);
    const owner = h.side === 'red' ? red : blue;

    const cardW = clamp(W * 0.22, 236, 292);
    const pad = 14;
    const iconR = 18;
    const headerH = 60;
    const lineH = 17;
    const footerH = 32;
    const top = '#191d2d';
    const bottom = '#0d0f18';

    ctx.save();
    ctx.font = '600 12.5px system-ui, -apple-system, sans-serif';
    const lines = wrapLines(info.desc, cardW - pad * 2);
    const cardH = headerH + lines.length * lineH + footerH;

    const x = clamp(h.x - cardW / 2, 10, Math.max(10, W - cardW - 10));
    let y = h.y - h.r - 14 - cardH;
    let below = false;
    if (y < 8) {
      y = h.y + h.r + 14;
      below = true;
    }
    const ease = 1 - Math.pow(1 - popupAnim, 3);
    ctx.globalAlpha = ease;
    ctx.translate(0, (1 - ease) * (below ? -10 : 10));

    // Card body
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    roundedRect(x, y, cardW, cardH, 14);
    const bg = ctx.createLinearGradient(0, y, 0, y + cardH);
    bg.addColorStop(0, top);
    bg.addColorStop(1, bottom);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.restore();

    // Rarity accent strip and soft glow behind the header
    ctx.save();
    roundedRect(x, y, cardW, cardH, 14);
    ctx.clip();
    const strip = ctx.createLinearGradient(x, 0, x + cardW, 0);
    strip.addColorStop(0, hexA(rc, 0));
    strip.addColorStop(0.5, hexA(rc, 0.95));
    strip.addColorStop(1, hexA(rc, 0));
    ctx.fillStyle = strip;
    ctx.fillRect(x, y, cardW, 3);
    const wash = ctx.createRadialGradient(x + pad + iconR, y + 31, 0, x + pad + iconR, y + 31, 110);
    wash.addColorStop(0, hexA(rc, 0.2));
    wash.addColorStop(1, hexA(rc, 0));
    ctx.fillStyle = wash;
    ctx.fillRect(x, y, cardW, headerH);
    ctx.restore();

    roundedRect(x + 0.5, y + 0.5, cardW - 1, cardH - 1, 14);
    ctx.strokeStyle = hexA(rc, 0.5);
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Pointer toward the hovered ball
    const px = clamp(h.x, x + 22, x + cardW - 22);
    ctx.beginPath();
    if (below) {
      ctx.moveTo(px - 9, y + 1);
      ctx.lineTo(px, y - 8);
      ctx.lineTo(px + 9, y + 1);
    } else {
      ctx.moveTo(px - 9, y + cardH - 1);
      ctx.lineTo(px, y + cardH + 8);
      ctx.lineTo(px + 9, y + cardH - 1);
    }
    ctx.fillStyle = below ? top : bottom;
    ctx.fill();
    ctx.strokeStyle = hexA(rc, 0.5);
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Ball icon
    drawBallSprite(h.side, h.id, iconR, x + pad + iconR, y + 31, 1);

    // Name, rarity pill and role
    const tx = x + pad + iconR * 2 + 12;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '900 16px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#f5f7fc';
    ctx.fillText(info.name, tx, y + 27);
    if (NEW_BALLS.has(h.id)) {
      drawNewBadge(tx + ctx.measureText(info.name).width + 20, y + 21, 9);
    }

    ctx.font = '800 9.5px system-ui, -apple-system, sans-serif';
    const pillW = ctx.measureText(info.rarity).width + 14;
    roundedRect(tx, y + 35, pillW, 16, 8);
    ctx.fillStyle = hexA(rc, 0.16);
    ctx.fill();
    ctx.strokeStyle = hexA(rc, 0.75);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textBaseline = 'middle';
    ctx.fillStyle = rc;
    ctx.fillText(info.rarity, tx + 7, y + 43.5);
    ctx.fillStyle = 'rgba(200,208,226,0.55)';
    ctx.fillText(info.tag, tx + pillW + 8, y + 43.5);

    // Description
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(x + pad, y + headerH - 2, cardW - pad * 2, 1);
    ctx.font = '600 12.5px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(216,222,236,0.92)';
    ctx.textBaseline = 'alphabetic';
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], x + pad, y + headerH + 14 + i * lineH);
    }

    // Footer: HP and equip state or owner
    const fy = y + cardH - 13;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(x + pad, y + cardH - footerH + 2, cardW - pad * 2, 1);
    ctx.font = '800 11px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.fillText('HP', x + pad, fy);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(TYPES[h.id].maxHealth), x + pad + 19, fy);
    ctx.textAlign = 'right';
    const sideCol = h.side === 'red' ? '#ff8c9b' : '#86cfff';
    let right;
    if (h.fromPicker) {
      right = owner.type === h.id ? 'EQUIPPED' : 'CLICK TO EQUIP';
      ctx.fillStyle = owner.type === h.id ? sideCol : 'rgba(255,255,255,0.55)';
    } else {
      right = mode === '1p' && h.side === 'blue' ? 'BOT' : names[h.side];
      ctx.fillStyle = sideCol;
    }
    ctx.fillText(right, x + cardW - pad, fy);
    ctx.restore();
  }

  /* ---------- VFX update & draw ---------- */

  function updateEffects(dt) {
    animeRivals.updateVisuals(dt);
    updateExtraVisuals(dt);
    updateBatch4Visuals(dt);
    updateHarpoonVisuals(dt);
    shake.mag = Math.max(0, shake.mag - dt * 36);
    if (shake.mag > 0.1) {
      shake.x = (Math.random() * 2 - 1) * shake.mag;
      shake.y = (Math.random() * 2 - 1) * shake.mag;
    } else {
      shake.x = 0;
      shake.y = 0;
    }

    for (const b of balls) {
      b.hit = Math.max(0, b.hit - dt * 4.5);
      b.healPulse = Math.max(0, b.healPulse - dt * 3.2);
      b.morphPulse = Math.max(0, b.morphPulse - dt * 4.2);
      b.shownHealth = Math.max(b.health, b.shownHealth - dt * 62);
      b.shockCooldown = Math.max(0, b.shockCooldown - dt);
      b.shardCooldown = Math.max(0, b.shardCooldown - dt);
      b.freezeTimer = Math.max(0, b.freezeTimer - dt);
      for (let i = b.lasers.length - 1; i >= 0; i--) {
        const l = b.lasers[i];
        l.age += dt;
        l.flash = Math.max(0, l.flash - dt * 4.2);
        if (l.fadeOut === 0 && l.age > 12) {
          l.fadeOut = 0.001;
          invalidateLaserCache();
        }
        if (l.fadeOut > 0) {
          l.fadeOut += dt;
          if (l.fadeOut >= 0.45) {
            b.lasers.splice(i, 1);
            invalidateLaserCache();
          }
        }
      }
    }

    for (let i = poisonPatches.length - 1; i >= 0; i--) {
      poisonPatches[i].age += dt;
      if (poisonPatches[i].age >= poisonPatches[i].life) poisonPatches.splice(i, 1);
    }
    for (let i = shockFx.length - 1; i >= 0; i--) {
      shockFx[i].age += dt;
      if (shockFx[i].age >= shockFx[i].life) shockFx.splice(i, 1);
    }
    for (let i = burstFx.length - 1; i >= 0; i--) {
      burstFx[i].age += dt;
      if (burstFx[i].age >= burstFx[i].life) burstFx.splice(i, 1);
    }
    for (let i = glassShards.length - 1; i >= 0; i--) {
      const sh = glassShards[i];
      sh.age += dt;
      if (sh.dead || sh.age >= sh.life) glassShards.splice(i, 1);
    }

    for (let i = heartFx.length - 1; i >= 0; i--) {
      heartFx[i].age += dt;
      if (heartFx[i].age >= heartFx[i].life) heartFx.splice(i, 1);
    }
    for (let i = damageNumbers.length - 1; i >= 0; i--) {
      const p = damageNumbers[i];
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 32 * dt;
      if (p.age >= p.life) damageNumbers.splice(i, 1);
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const drag = Math.exp(-2.8 * dt);
      p.vx *= drag;
      p.vy = p.vy * drag + 22 * dt;
      if (p.age >= p.life) sparks.splice(i, 1);
    }
    for (let i = shards.length - 1; i >= 0; i--) {
      const s = shards[i];
      s.age += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.rot += s.vrot * dt;
      const drag = Math.exp(-1.9 * dt);
      s.vx *= drag;
      s.vy = s.vy * drag + 45 * dt;
      if (s.age >= s.life) shards.splice(i, 1);
    }
    for (let i = impactRings.length - 1; i >= 0; i--) {
      impactRings[i].age += dt;
      if (impactRings[i].age >= impactRings[i].life) impactRings.splice(i, 1);
    }
    for (let i = slashFx.length - 1; i >= 0; i--) {
      slashFx[i].age += dt;
      if (slashFx[i].age >= slashFx[i].life) slashFx.splice(i, 1);
    }
    for (let i = siphonMotes.length - 1; i >= 0; i--) {
      siphonMotes[i].age += dt;
      if (siphonMotes[i].age >= siphonMotes[i].life) siphonMotes.splice(i, 1);
    }
    for (let i = wallPulses.length - 1; i >= 0; i--) {
      wallPulses[i].age += dt;
      if (wallPulses[i].age >= wallPulses[i].life) wallPulses.splice(i, 1);
    }
  }

  function drawEffects() {
    drawExtraEffects();
    drawBatch3Effects();
    drawBatch4Effects();
    // Glass shard projectiles
    for (const sh of glassShards) {
      if (sh.dead) continue;
      const t = sh.age / sh.life;
      ctx.save();
      ctx.translate(sh.x, sh.y);
      ctx.rotate(sh.rot);
      ctx.globalAlpha = Math.min(1, (1 - t) * 2.4);
      ctx.shadowColor = 'rgba(190,255,250,0.85)';
      ctx.shadowBlur = 9;
      ctx.beginPath();
      ctx.moveTo(6.5, 0);
      ctx.lineTo(-2.5, -5);
      ctx.lineTo(-5, 1.5);
      ctx.closePath();
      const sg = ctx.createLinearGradient(-5, -5, 6, 4);
      sg.addColorStop(0, '#ffffff');
      sg.addColorStop(0.5, '#bdf8f2');
      sg.addColorStop(1, '#4fc8c2');
      ctx.fillStyle = sg;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    // Electric shock arcs
    for (const fx of shockFx) {
      const t = fx.age / fx.life;
      ctx.save();
      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = '#d5ffff';
      ctx.shadowColor = '#5ddfff';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      for (let a = 0; a < 4; a++) {
        const base = fx.seed + a * 1.7 + clock * 10;
        ctx.beginPath();
        for (let j = 0; j <= 4; j++) {
          const ang = base + j * 0.28;
          const rad = 12 + j * (8 + (a % 2) * 4);
          const px = fx.x + Math.cos(ang) * rad;
          const py = fx.y + Math.sin(ang) * rad;
          if (j === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    // Burst dash activation rings
    for (const fx of burstFx) {
      const t = fx.age / fx.life;
      ctx.save();
      ctx.globalAlpha = (1 - t) * 0.8;
      ctx.strokeStyle = t < 0.4 ? '#ffed4e' : '#ef7724';
      ctx.lineWidth = (1 - t) * 5 + 1;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, fx.owner.r * (1.2 + t * 1.8), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const ring of impactRings) {
      const t = ring.age / ring.life;
      const col = ring.color || { r: 255, g: 255, b: 255 };
      ctx.save();
      ctx.strokeStyle = rgba(col, (1 - t) * 0.8);
      ctx.lineWidth = 1.2 + (1 - t) * 2.8;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, 4 + ring.radius * t, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Blade slash crescent arcs
    for (const sl of slashFx) {
      const t = sl.age / sl.life;
      ctx.save();
      ctx.translate(sl.x, sl.y);
      ctx.rotate(sl.angle);
      ctx.globalAlpha = 1 - t;
      ctx.shadowColor = '#7ffaff';
      ctx.shadowBlur = 14;
      ctx.strokeStyle = '#7ffaff';
      ctx.lineWidth = (1 - t) * 7 + 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, sl.radius * (0.9 + t * 0.25), -0.95, 0.95);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = (1 - t) * 2.5 + 0.8;
      ctx.stroke();
      ctx.restore();
    }

    // KO 3D-tinted shards
    for (const s of shards) {
      const a = Math.pow(1 - s.age / s.life, 1.3);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot);
      ctx.globalAlpha = a;
      ctx.fillStyle = rgba(s.color, 1);
      ctx.strokeStyle = rgba(s.dark, 0.9);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(s.size, 0);
      ctx.lineTo(-s.size * 0.65, -s.size * 0.72);
      ctx.lineTo(-s.size * 0.3, s.size * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Additive two-pass streaks give the same bloom as a per-spark shadowBlur
    // at a fraction of the cost, which matters when dozens are alive at once
    if (sparks.length) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (const p of sparks) {
        const a = Math.pow(1 - p.age / p.life, 1.45);
        const x0 = p.x - p.vx * 0.032, y0 = p.y - p.vy * 0.032;
        ctx.globalAlpha = a * 0.5;
        ctx.strokeStyle = rgba(p.color, 1);
        ctx.lineWidth = p.size * 2.6;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.globalAlpha = a;
        ctx.strokeStyle = rgba(lighten(p.color, 85), 1);
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Floating damage & heal numbers
    const baseSize = clamp(red.r * 0.56, 17, 27);
    for (const p of damageNumbers) {
      const t = p.age / p.life;
      const pop = t < 0.14 ? 0.65 + (t / 0.14) * 0.55 : (t < 0.28 ? 1.2 - ((t - 0.14) / 0.14) * 0.2 : 1);
      const alpha = Math.min(1, t * 11) * Math.pow(1 - t, 0.85);
      const size = baseSize * (p.big ? 1.18 : 1) * pop;
      const x = clamp(p.x, arena.x + size, arena.x + arena.w - size);
      const y = clamp(p.y, arena.y + size, arena.y + arena.h - size);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `900 ${size.toFixed(1)}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(3.5, size * 0.22);
      ctx.strokeStyle = 'rgba(6,7,14,0.94)';
      ctx.fillStyle = rgba(lighten(p.color, 95), 1);
      if (quality > 0.7) {
        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = 10;
      }
      ctx.strokeText(p.text, x, y);
      ctx.fillText(p.text, x, y);
      ctx.restore();
    }
  }

  /* ---------- physics & special abilities ---------- */

  function onWallHit(b, wx, wy) {
    sfx.wall();
    wallPulses.push({ x: wx, y: wy, age: 0, life: 0.42, color: b.type === 'blade' ? b.accent : b.color });

    // Classic gains a tiny kinetic charge boost off walls
    if (b.type === 'classic') {
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 0.1 && sp < MAX_SPEED * 0.92) {
        const boost = Math.min(MAX_SPEED * 0.92, sp * 1.05) / sp;
        b.vx *= boost; b.vy *= boost;
      }
    }

    // Laser Ball authentic ability: wall hits link persistent laser lines!
    if (b.type === 'laser' && b.alive && phase === 'play') {
      if (b.laserAnchor) {
        const d = Math.hypot(wx - b.laserAnchor.x, wy - b.laserAnchor.y);
        if (d > b.r * 1.6) {
          b.lasers.push({
            x1: b.laserAnchor.x, y1: b.laserAnchor.y,
            x2: wx, y2: wy,
            age: 0, fadeOut: 0, flash: 0.75,
            hitLock: false, unlockTimer: 0
          });
          sfx.laserLock();
          // Hard cap of 5 active beams keeps the arena readable and fast
          const active = b.lasers.filter(l => l.fadeOut === 0);
          if (active.length > 5) active[0].fadeOut = 0.001;
          invalidateLaserCache();
        }
      }
      b.laserAnchor = { x: wx, y: wy };
      b.tetherHitLock = false;
      spawnSparks(wx, wy, b.accent, 5, 0.7);
    }

    // Poison Spike authentic ability: wall impacts plant lingering toxic thorns
    if (b.type === 'poison' && b.alive && phase === 'play') {
      if (poisonPatches.length >= 8) poisonPatches.shift();
      const inward = Math.atan2((arena.y + arena.h * 0.5) - wy, (arena.x + arena.w * 0.5) - wx);
      poisonPatches.push({
        owner: b, x: wx, y: wy, angle: inward,
        age: 0, life: 16, seed: Math.random() * 10
      });
    }

    if (b.type === 'reforge' && b.alive && phase === 'play') reforgeWallHit(b, wx, wy);

    // Big Spike Ball: every wall touch grows a permanent spike
    if (b.type === 'bigspike' && b.alive && phase === 'play') bigSpikeWallHit(b, wx, wy);

    // Electro King: every wall hit plants a shock node on the wall
    if (b.type === 'electroking' && b.alive && phase === 'play') electroWallHit(b, wx, wy);

    batch3WallHit(b, wx, wy);

    // Glass Ball buff: wall impacts spray a crystal shard volley inward
    if (b.type === 'glass' && b.alive && phase === 'play' && b.shardCooldown <= 0) {
      b.shardCooldown = 0.34;
      sfx.shatter();
      const dir = Math.atan2((arena.y + arena.h * 0.5) - wy, (arena.x + arena.w * 0.5) - wx);
      for (let i = 0; i < 4; i++) {
        if (glassShards.length >= 32) break;
        const a = dir + (i - 1.5) * 0.4 + (Math.random() - 0.5) * 0.25;
        const sp = 220 + Math.random() * 110;
        glassShards.push({
          owner: b,
          x: clamp(wx, arena.x + 6, arena.x + arena.w - 6),
          y: clamp(wy, arena.y + 6, arena.y + arena.h - 6),
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() * 2 - 1) * 11,
          age: 0, life: 0.95, dead: false
        });
      }
      spawnSparks(wx, wy, TYPES.glass.accent, 6, 0.8);
    }
  }

  function keepInArena(b, triggerWall) {
    const left = arena.x + b.r;
    const right = arena.x + arena.w - b.r;
    const top = arena.y + b.r;
    const bottom = arena.y + arena.h - b.r;

    if (b.x < left) {
      b.x = left;
      if (b.vx < 0) { b.vx = Math.abs(b.vx); if (triggerWall) onWallHit(b, arena.x, b.y); }
    } else if (b.x > right) {
      b.x = right;
      if (b.vx > 0) { b.vx = -Math.abs(b.vx); if (triggerWall) onWallHit(b, arena.x + arena.w, b.y); }
    }
    if (b.y < top) {
      b.y = top;
      if (b.vy < 0) { b.vy = Math.abs(b.vy); if (triggerWall) onWallHit(b, b.x, arena.y); }
    } else if (b.y > bottom) {
      b.y = bottom;
      if (b.vy > 0) { b.vy = -Math.abs(b.vy); if (triggerWall) onWallHit(b, b.x, arena.y + arena.h); }
    }
  }

  function contactDamageFor(attacker, strikeSpeed) {
    if (attacker.type === 'classic') {
      // Velocity scaling kept mild so classic stays in line with ability balls
      return Math.round(9 + clamp(strikeSpeed / LAUNCH_SPEED, 0, 1.3) * 9 + Math.random() * 3);
    }
    if (attacker.type === 'vampire') return 4; // Official wiki contact damage
    if (attacker.type === 'blade') return 3;   // Main damage comes from orbiting blades (8 dmg)
    if (attacker.type === 'laser') return 3;   // Main damage comes from wall-linked lasers
    if (attacker.type === 'glass') return 7;   // Buffed: shards + solid contact
    if (attacker.type === 'electric') return 7;// Buffed: shock burst + contact
    if (attacker.type === 'burst') return attacker.dashActive ? 26 : 9; // Buffed dash
    if (attacker.type === 'poison') return 6;  // Buffed: thorns + solid contact
    if (attacker.type === 'fibonacci') {
      const stepIdx = Math.min(attacker.fibStep, FIB.length - 1);
      attacker.fibStep = Math.min(attacker.fibStep + 1, FIB.length);
      attacker.fibIdle = 0;
      sfx.fib(stepIdx);
      return FIB[stepIdx];
    }
    if (attacker.type === 'shackles') return 6;
    if (attacker.type === 'machine') return 4;
    if (attacker.type === 'bomb') return 5;
    if (attacker.type === 'zone') return 5;
    if (attacker.type === 'spider') return 4;
    if (attacker.type === 'snake') return 6;
    if (attacker.type === 'cannon') return 5;
    if (attacker.type === 'dice') return 2 + Math.floor(Math.random() * 6);
    if (attacker.type === 'hive') return 3;
    if (attacker.type === 'thief') return 4;
    if (attacker.type === 'axe') return 5;
    if (attacker.type === 'frost') return 5;
    if (attacker.type === 'apple') return 5;
    if (attacker.type === 'charge') {
      // Charge spends everything it has saved up on this hit
      const c = chargeRatio(attacker);
      attacker.chargeT = 0;
      if (c > 0.45) {
        sfx.chargeHit(c);
        addShake(2 + c * 5);
        if (c > 0.85) hitStop = Math.max(hitStop, 0.045);
        impactRings.push({ x: attacker.x, y: attacker.y, age: 0, life: 0.45, radius: attacker.r * (1.4 + c), color: CHARGE_PINK });
        spawnSparks(attacker.x, attacker.y, CHARGE_PINK, Math.round(6 + c * 14), 1 + c * 0.5);
      }
      return Math.round(4 + c * 24);
    }
    if (attacker.type === 'harpoon') return 0;    // Ball vs Ball: Harpoon Ball deals no contact damage
    if (attacker.type === 'beam') return 0;       // Ball vs Ball: Beam Ball deals no contact damage
    if (attacker.type === 'spear') return 0;      // Ball vs Ball: Spear Ball deals no contact damage
    if (attacker.type === 'reforge') return 0;    // Ball vs Ball: Reforge Ball deals no contact damage
    if (attacker.type === 'chess') return 7;      // Ball vs Ball: Chess Ball contact damage is 7
    if (attacker.type === 'verity') return [5, 10, 40][Math.min(2, Math.max(0, (attacker.verityStage || 1) - 1))];
    if (attacker.type === 'cactus') return 0;     // the cacti do the damage
    if (attacker.type === 'range') return 0;      // the aura does the damage
    if (attacker.type === 'electroking') return 0; // the shock grid does the damage
    if (attacker.type === 'acid') return 0;       // the puddles do the damage
    if (attacker.type === 'bigspike') return 0;   // the wall spikes do the damage
    if (attacker.type === 'cell') return 5;       // wiki: Cell Ball contact damage 5
    if (attacker.type === 'hook') return 0;       // the hook does the damage
    if (attacker.anime) return 5;                // signature moves do the heavy lifting
    if (attacker.type === 'wdc') {
      // wiki: the number in the cell WDC occupies becomes its contact damage
      const n = wdcCellAt(attacker);
      if (n > 0) { attacker.fx.wdcHits += 1; return n; }
      return 5;
    }
    return 5;
  }

  function startVampireLatch(attacker, target, nx, ny) {
    if (latch || attacker.latchCooldown > 0 || !attacker.alive || !target.alive) return false;
    latch = {
      attacker,
      target,
      timer: 0,
      ticksDone: 0,
      angle: Math.atan2(ny, nx),
      spinDir: (Math.random() < 0.5 ? -1 : 1)
    };
    sfx.bite();
    return true;
  }

  function updateLatch(dt, s) {
    if (!latch) return;
    const { attacker, target } = latch;
    if (!attacker.alive || !target.alive) { latch = null; return; }

    latch.timer += dt;
    latch.angle += latch.spinDir * 2.15 * dt;

    // Combined drift velocity
    let mvx = (attacker.vx + target.vx) * 0.5;
    let mvy = (attacker.vy + target.vy) * 0.5;
    const msp = Math.hypot(mvx, mvy);
    const desired = MIN_SPEED * 0.55;
    if (msp < desired && msp > 0.01) {
      mvx = (mvx / msp) * desired;
      mvy = (mvy / msp) * desired;
    }

    let cx = (attacker.x + target.x) * 0.5 + mvx * s * dt;
    let cy = (attacker.y + target.y) * 0.5 + mvy * s * dt;
    const sep = attacker.r + target.r + 3;
    const half = sep * 0.5;

    // Bounce tethered pair smoothly off arena walls
    const padX = Math.abs(Math.cos(latch.angle)) * half + attacker.r;
    const padY = Math.abs(Math.sin(latch.angle)) * half + attacker.r;
    if (cx - padX < arena.x) { cx = arena.x + padX; mvx = Math.abs(mvx); }
    if (cx + padX > arena.x + arena.w) { cx = arena.x + arena.w - padX; mvx = -Math.abs(mvx); }
    if (cy - padY < arena.y) { cy = arena.y + padY; mvy = Math.abs(mvy); }
    if (cy + padY > arena.y + arena.h) { cy = arena.y + arena.h - padY; mvy = -Math.abs(mvy); }

    attacker.x = cx - Math.cos(latch.angle) * half;
    attacker.y = cy - Math.sin(latch.angle) * half;
    target.x = cx + Math.cos(latch.angle) * half;
    target.y = cy + Math.sin(latch.angle) * half;
    attacker.vx = target.vx = mvx;
    attacker.vy = target.vy = mvy;
    attacker.facing = latch.angle;

    // Official Vampire Ball drain: 3 ticks of 4 damage + 4 heal!
    const nextTickAt = (latch.ticksDone + 1) * 0.33;
    if (latch.timer >= nextTickAt && latch.ticksDone < 3) {
      latch.ticksDone++;
      sfx.drain();
      addShake(3.2);

      // Crimson siphon particles zipping from victim to Vampire
      for (let i = 0; i < 6; i++) {
        siphonMotes.push({
          sx: target.x + (Math.random() - 0.5) * target.r * 0.8,
          sy: target.y + (Math.random() - 0.5) * target.r * 0.8,
          target: attacker,
          arcX: (Math.random() - 0.5) * 44,
          arcY: (Math.random() - 0.5) * 44,
          age: 0,
          life: 0.28 + Math.random() * 0.12
        });
      }

      const hitX = (attacker.x + target.x) * 0.5 + (Math.random() - 0.5) * 14;
      const hitY = (attacker.y + target.y) * 0.5 - 6;
      const dealt = applyDamage(target, 4, hitX, hitY, latch.angle, attacker.color, Math.cos(latch.angle) * 28, -68, false);
      if (dealt > 0 && phase === 'play') applyHeal(attacker, dealt);
    }

    // Automatically unlatch after 3rd tick
    if (latch && latch.ticksDone >= 3 && latch.timer >= 1.05) {
      const nx = Math.cos(latch.angle), ny = Math.sin(latch.angle);
      const tx = -ny, ty = nx;
      const kick = LAUNCH_SPEED * 0.92;
      const tang = (Math.random() * 2 - 1) * 150;
      attacker.vx = -nx * kick + tx * tang;
      attacker.vy = -ny * kick + ty * tang;
      target.vx = nx * kick - tx * tang;
      target.vy = ny * kick - ty * tang;
      attacker.latchCooldown = 2.6;
      impactCooldown = 0.22;
      impactRings.push({ x: cx, y: cy, age: 0, life: 0.38, radius: attacker.r * 1.15, color: attacker.color });
      latch = null;
    }
  }

  function updateBladeAbility(b, enemy, dt) {
    if (b.type !== 'blade' || !b.alive || !enemy.alive) return;

    b.bladeGlobalCooldown = Math.max(0, b.bladeGlobalCooldown - dt);
    // Spin clockwise & accelerate subtly as blades stack
    b.bladeAngle += (2.35 + b.bladeCount * 0.22) * dt;

    // Gain +1 blade every 4 seconds up to 5 (official wiki mechanic)
    if (b.bladeCount < 5) {
      b.bladeTimer += dt;
      if (b.bladeTimer >= 4.0) {
        b.bladeTimer -= 4.0;
        b.bladeCount++;
        sfx.forge();
        impactRings.push({ x: b.x, y: b.y, age: 0, life: 0.45, radius: b.r * 1.9, color: b.accent });
        spawnSparks(b.x, b.y, b.accent, 12, 1.05);
      }
    }

    for (let i = 0; i < b.bladeCount; i++) {
      b.bladeHits[i] = Math.max(0, b.bladeHits[i] - dt);
      if (b.bladeHits[i] > 0) continue;

      const a = b.bladeAngle + (i * Math.PI * 2) / b.bladeCount;
      const x1 = b.x + Math.cos(a) * b.r * 0.92;
      const y1 = b.y + Math.sin(a) * b.r * 0.92;
      const x2 = b.x + Math.cos(a) * b.r * 1.95;
      const y2 = b.y + Math.sin(a) * b.r * 1.95;

      const hit = closestPointOnSegment(enemy.x, enemy.y, x1, y1, x2, y2);
      if (hit.dist <= enemy.r + b.r * 0.14) {
        b.bladeHits[i] = 0.44;
        // One blade connection per short window keeps stacking balanced
        if (b.bladeGlobalCooldown > 0) continue;
        b.bladeGlobalCooldown = 0.36;
        sfx.slash();
        addShake(4.8);
        hitStop = Math.max(hitStop, 0.024);

        const hitAngle = Math.atan2(enemy.y - hit.y, enemy.x - hit.x);
        slashFx.push({ x: enemy.x, y: enemy.y, angle: a + 0.5, radius: enemy.r * 1.12, age: 0, life: 0.26 });
        spawnSparks(hit.x, hit.y, b.accent, 12, 1.15);

        // Tangential slice impulse
        if (!latch) {
          const tx = -Math.sin(a), ty = Math.cos(a);
          enemy.vx += (Math.cos(hitAngle) * 115 + tx * 95);
          enemy.vy += (Math.sin(hitAngle) * 115 + ty * 95);
        }

        // Official Blade Ball blade damage: 8!
        applyDamage(enemy, 8, hit.x, hit.y - 6, hitAngle, b.accent, Math.cos(hitAngle) * 34, -76, true);
        if (phase !== 'play') return;
        break;
      }
    }
  }

  function updateLaserAbility(b, enemy, dt) {
    if (b.type !== 'laser' || !enemy.alive) return;

    // Check permanent wall-to-wall laser beams
    for (const l of b.lasers) {
      if (l.fadeOut > 0 || l.age < 0.12) continue;
      const hit = closestPointOnSegment(enemy.x, enemy.y, l.x1, l.y1, l.x2, l.y2);
      const touching = hit.dist <= enemy.r + 3;
      if (touching && !l.hitLock) {
        l.hitLock = true;
        l.unlockTimer = 0.25;
        l.flash = 1;
        sfx.laserZap();
        addShake(2.6);
        spawnSparks(hit.x, hit.y, b.accent, 9, 0.95);
        impactRings.push({ x: hit.x, y: hit.y, age: 0, life: 0.3, radius: enemy.r * 0.72, color: b.accent });
        const ha = Math.atan2(enemy.y - hit.y, enemy.x - hit.x);
        applyDamage(enemy, 4, hit.x, hit.y - 6, ha, b.accent, (Math.random() - 0.5) * 28, -68, false);
        if (phase !== 'play') return;
      } else if (!touching && l.hitLock) {
        l.unlockTimer -= dt;
        if (l.unlockTimer <= 0) l.hitLock = false;
      }
    }

    // Check live wall-to-ball laser tether
    if (b.alive && b.laserAnchor) {
      const hit = closestPointOnSegment(enemy.x, enemy.y, b.laserAnchor.x, b.laserAnchor.y, b.x, b.y);
      const touching = hit.dist <= enemy.r + 2.5 && Math.hypot(hit.x - b.x, hit.y - b.y) > b.r * 1.15;
      if (touching && !b.tetherHitLock) {
        b.tetherHitLock = true;
        b.tetherLockTimer = 0.32;
        sfx.laserZap();
        spawnSparks(hit.x, hit.y, b.accent, 7, 0.85);
        const ha = Math.atan2(enemy.y - hit.y, enemy.x - hit.x);
        applyDamage(enemy, 4, hit.x, hit.y - 6, ha, b.accent, (Math.random() - 0.5) * 24, -66, false);
      } else if (!touching && b.tetherHitLock) {
        b.tetherLockTimer -= dt;
        if (b.tetherLockTimer <= 0) b.tetherHitLock = false;
      }
    }
  }

  function collideBalls(a, b) {
    if (!a.alive || !b.alive || latch) return;
    const dx = b.x - a.x, dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    const minD = a.r + b.r;
    if (dist >= minD) return;

    const relSp = Math.hypot(a.vx - b.vx, a.vy - b.vy);
    const nx = dist > 0.001 ? dx / dist : (relSp > 0 ? (a.vx - b.vx) / relSp : 1);
    const ny = dist > 0.001 ? dy / dist : (relSp > 0 ? (a.vy - b.vy) / relSp : 0);
    const overlap = minD - dist;
    a.x -= nx * overlap * 0.5;
    a.y -= ny * overlap * 0.5;
    b.x += nx * overlap * 0.5;
    b.y += ny * overlap * 0.5;

    const velN = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (velN >= 0) return;

    const hitX = (a.x + nx * a.r + b.x - nx * b.r) * 0.5;
    const hitY = (a.y + ny * a.r + b.y - ny * b.r) * 0.5;
    const hitAngle = Math.atan2(ny, nx);

    if (impactCooldown <= 0) {
      impactCooldown = 0.18;
      const aStrike = Math.max(0, a.vx * nx + a.vy * ny);
      const bStrike = Math.max(0, -(b.vx * nx + b.vy * ny));
      const dmgToB = contactDamageFor(a, aStrike);
      const dmgToA = contactDamageFor(b, bStrike);

      const spread = clamp(a.r * 0.34, 12, 22);
      const ox = nx * spread - ny * spread * 0.65;
      const oy = ny * spread + nx * spread * 0.12;

      applyDamage(a, dmgToA, hitX - ox, hitY - oy - 4, hitAngle, b.color, -nx * 30 + ny * 18, -70, dmgToA >= 14);
      applyDamage(b, dmgToB, hitX + ox, hitY + oy - 4, hitAngle, a.color, nx * 30 - ny * 18, -70, dmgToB >= 14);

      const impactPower = clamp((-velN) / (LAUNCH_SPEED * 1.15), 0.45, 1.35);
      sfx.clash(impactPower);
      addShake(3.2 + impactPower * 3.8);
      if (dmgToA >= 14 || dmgToB >= 14) hitStop = Math.max(hitStop, 0.032);

      impactRings.push({ x: hitX, y: hitY, age: 0, life: 0.44, radius: a.r * 1.1, color: { r: 255, g: 255, b: 255 } });
      spawnSparks(hitX, hitY, a.color, 7, impactPower);
      spawnSparks(hitX, hitY, b.color, 7, impactPower);

      if (phase !== 'play') return;

      // Ability triggers on contact
      if (a.type === 'glass') spawnGlassShards(a, b, hitX, hitY);
      if (b.type === 'glass') spawnGlassShards(b, a, hitX, hitY);
      if (a.type === 'electric') triggerShock(a, b);
      if (b.type === 'electric') triggerShock(b, a);

      // Trigger Vampire Latch on contact!
      if (a.type === 'vampire' && startVampireLatch(a, b, nx, ny)) return;
      if (b.type === 'vampire' && startVampireLatch(b, a, -nx, -ny)) return;

      // Harpoon Ball deals no contact damage; its thrown harpoon does the work
    }

    const e = 0.99;
    const j = -(1 + e) * velN * 0.5;
    a.vx -= j * nx; a.vy -= j * ny;
    b.vx += j * nx; b.vy += j * ny;
  }

  function step(dt) {
    const s = speedScale();
    const maxSpeed = Math.max(...balls.map(b => Math.hypot(b.vx, b.vy)));
    const substeps = clamp(Math.ceil((maxSpeed * s * dt) / Math.max(1, red.r * 0.42)), 1, 10);
    const tick = dt / substeps;

    // Burst Ball: authentic 5s cycle with 1.5s dash mode
    for (const b of balls) {
      if (b.type !== 'burst' || !b.alive) continue;
      const was = b.dashActive;
      b.dashTimer = (b.dashTimer + dt) % 4.2;
      b.dashActive = b.dashTimer < 2.2;
      if (b.dashActive && !was) {
        sfx.dash();
        addShake(4.2);
        burstFx.push({ owner: b, x: b.x, y: b.y, age: 0, life: 0.62 });
        spawnSparks(b.x, b.y, b.accent, 16, 1.25);
        // Dash ignition shockwave (buffed Burst Ball)
        const foe = b.side === 'red' ? blue : red;
        const dist = Math.hypot(foe.x - b.x, foe.y - b.y);
        if (phase === 'play' && foe.alive && dist < b.r * 2.8) {
          const ang = Math.atan2(foe.y - b.y, foe.x - b.x);
          foe.vx += Math.cos(ang) * 300;
          foe.vy += Math.sin(ang) * 300;
          applyDamage(
            foe, 10,
            (b.x + foe.x) * 0.5, (b.y + foe.y) * 0.5 - 6,
            ang, b.accent,
            Math.cos(ang) * 40, -84, true
          );
        }
      }
    }

    for (let i = 0; i < substeps && phase === 'play'; i++) {
      impactCooldown = Math.max(0, impactCooldown - tick);
      for (const b of balls) b.latchCooldown = Math.max(0, b.latchCooldown - tick);

      if (latch) {
        updateLatch(tick, s);
      } else {
        for (const b of balls) {
          if (!b.alive) continue;
          if (b.freezeTimer <= 0) {
            const dashMul = (b.type === 'burst' && b.dashActive ? 1.35 : 1) *
              (b.type === 'gojo' && b.voidPhase === 'active' ? VOID_SPEED_MUL : 1);
            const slowMul = b.slowTimer > 0 ? 0.55 : 1;
            b.x += b.vx * s * tick * dashMul * slowMul;
            b.y += b.vy * s * tick * dashMul * slowMul;
          }
          keepInArena(b, true);
        }
        collideBalls(red, blue);
      }

      // Special abilities tick every substep for accurate blade & laser hit detection
      if (phase === 'play') {
        updateBladeAbility(red, blue, tick);
        updateBladeAbility(blue, red, tick);
        updateLaserAbility(red, blue, tick);
        updateLaserAbility(blue, red, tick);
      }

      // Keep speeds healthy and update facing
      if (!latch) {
        for (const b of balls) {
          if (!b.alive) continue;
          const sp = Math.hypot(b.vx, b.vy);
          if (sp < MIN_SPEED) {
            if (sp < 0.001) {
              const a = Math.random() * Math.PI * 2;
              b.vx = Math.cos(a) * MIN_SPEED;
              b.vy = Math.sin(a) * MIN_SPEED;
            } else {
              const k = MIN_SPEED / sp;
              b.vx *= k; b.vy *= k;
            }
          }
          const speedCap = MAX_SPEED * (b.type === 'spear' ? 1 + b.spearBoost * 0.6 : 1) *
            (b.type === 'gojo' && b.voidPhase === 'active' ? 1.15 : 1);
          if (sp > speedCap) {
            const k = speedCap / sp;
            b.vx *= k; b.vy *= k;
          }
          // Smoothly orient Vampire fangs toward movement / opponent
          const targetFace = Math.atan2(b.vy, b.vx);
          const diff = Math.atan2(Math.sin(targetFace - b.facing), Math.cos(targetFace - b.facing));
          b.facing += diff * Math.min(1, tick * 14);
        }
      }
    }

    // Ability projectiles & lingering hazards resolve once per frame
    updateGlassShards(dt, s);
    updatePoisonEffects(dt);
    updateExtraAbilities(dt, s);
    updateBatch3(dt, s);
    updateBatch4(dt, s);
    updateHarpoon(dt, s);
    updateBvbTrio(dt, s);
    updateFiveBalls(dt, s);
    updateBatchSix(dt, s);
    updateGojo(dt, s);
    animeRivals.update(dt, s);

    // Record motion trail once per frame
    for (const b of balls) {
      if (!b.alive) continue;
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 10) b.trail.shift();
    }
  }


  /* ---------- Chess, Verity, Cactus, Range and Electro King (from Ball VS Ball) ----------
     Chess Ball: every 5 seconds it turns invincible, glides to the center and dashes
     along a Rook (plus), Bishop (cross) or Knight (zigzag) pattern, shown first by a red line.
     Verity Ball: each hit it takes may advance it through three stages.
     Cactus Ball: thrown cacti land and stay on the floor for 5 seconds.
     Range Ball: a damage aura that grows each time it hurts.
     Electro King: wall hits plant nodes that link into a shock grid. */

  const CHESS_GLIDE = 0.45;   // glides to the center, invulnerable
  const CHESS_WARN = 0.9;     // the red warning line shows the pattern
  const CHESS_DASH = 1.1;     // time to run the whole pattern
  const CHESS_PERIOD = 5.0;   // one cycle every 5 seconds
  const CHESS_DMG = 7;
  const CHESS_RED = { r: 255, g: 58, b: 66 };
  const CHESS_PATTERNS = ['rook', 'bishop', 'knight'];

  const VERITY_CHANCE = 0.1;  // chance per hit to advance a stage
  const VERITY_NAMES = ['', 'HAPPY', 'DISPLEASED', 'MONSTER'];

  const CACTUS_EVERY = 4.0;   // a new set of three cacti every 4 seconds
  const CACTUS_FLY = 0.45;    // time for a thrown cactus to land
  const CACTUS_LIFE = 5.0;    // cacti stay on the floor for 5 seconds
  const CACTUS_DMG = 6;

  const RANGE_TICK = 0.15;    // the aura hurts every 0.15 seconds
  const RANGE_DMG = 3;
  const RANGE_GROW = 0.02;    // growth per hit, as a fraction of the ball radius
  const RANGE_CAP = 3.2;      // the aura stops growing at 3.2 ball radii

  const ELECTRO_NODES_MAX = 5;
  const ELECTRO_DMG = 2;
  const ELECTRO_TICK = 0.3;
  const ELECTRO_BLUE = { r: 150, g: 240, b: 255 };

  function pathLength(path) {
    let L = 0;
    for (let i = 0; i < path.length - 1; i++) {
      L += Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y);
    }
    return L;
  }

  function pointOnPath(path, d) {
    let rem = Math.max(0, d);
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], c = path[i + 1];
      const seg = Math.hypot(c.x - a.x, c.y - a.y);
      if (rem <= seg || i === path.length - 2) {
        const t = seg > 0 ? clamp(rem / seg, 0, 1) : 0;
        return { x: a.x + (c.x - a.x) * t, y: a.y + (c.y - a.y) * t, dx: c.x - a.x, dy: c.y - a.y };
      }
      rem -= seg;
    }
    const last = path[path.length - 1];
    return { x: last.x, y: last.y, dx: 1, dy: 0 };
  }

  // Each pattern is the route the ball runs, out and back through the center
  function chessPathFor(b, pat) {
    const m = b.r * 1.05;
    const x0 = arena.x + m, x1 = arena.x + arena.w - m;
    const y0 = arena.y + m, y1 = arena.y + arena.h - m;
    const cx = arena.x + arena.w * 0.5, cy = arena.y + arena.h * 0.5;
    const P = (x, y) => ({ x, y });
    const C = () => P(cx, cy);
    if (pat === 'rook') return [C(), P(x0, cy), C(), P(x1, cy), C(), P(cx, y0), C(), P(cx, y1)];
    if (pat === 'bishop') return [C(), P(x0, y0), C(), P(x1, y1), C(), P(x1, y0), C(), P(x0, y1)];
    return [C(), P(x0, arena.y + arena.h * 0.2), P(x1, arena.y + arena.h * 0.42),
      P(x0, arena.y + arena.h * 0.64), P(x1, y1)];
  }

  function updateChess(b, foe, dt) {
    if (b.chessPhase === 'idle') {
      b.chessCd -= dt;
      if (b.chessCd > 0) return;
      b.chessPat = CHESS_PATTERNS[Math.floor(Math.random() * CHESS_PATTERNS.length)];
      b.chessPath = chessPathFor(b, b.chessPat);
      b.chessLen = pathLength(b.chessPath);
      b.chessFrom = { x: b.x, y: b.y };
      b.chessPhase = 'glide';
      b.chessT = 0;
      b.chessHitCd = 0;
      b.vx = 0;
      b.vy = 0;
      sfx.chargeFull();
      impactRings.push({ x: b.x, y: b.y, age: 0, life: 0.45, radius: b.r * 1.6, color: { r: 255, g: 255, b: 255 } });
      return;
    }
    b.chessT += dt;
    b.chessHitCd = Math.max(0, b.chessHitCd - dt);
    b.vx = 0;
    b.vy = 0;
    const center = b.chessPath[0];
    if (b.chessPhase === 'glide') {
      const u = clamp(b.chessT / CHESS_GLIDE, 0, 1);
      const e = 1 - Math.pow(1 - u, 3);
      b.x = b.chessFrom.x + (center.x - b.chessFrom.x) * e;
      b.y = b.chessFrom.y + (center.y - b.chessFrom.y) * e;
      if (u >= 1) { b.chessPhase = 'warn'; b.chessT = 0; }
      return;
    }
    if (b.chessPhase === 'warn') {
      b.x = center.x;
      b.y = center.y;
      if (b.chessT >= CHESS_WARN) {
        b.chessPhase = 'dash';
        b.chessT = 0;
        sfx.laserZap();
        addShake(4);
      }
      return;
    }
    // Dash: run the pattern at a steady pace, hitting any enemy in the way
    const d = Math.min(b.chessLen, (b.chessLen / CHESS_DASH) * b.chessT);
    const p = pointOnPath(b.chessPath, d);
    b.x = p.x;
    b.y = p.y;
    b.chessDist = d;
    if (foe.alive && b.chessHitCd <= 0 && Math.hypot(foe.x - b.x, foe.y - b.y) <= foe.r + b.r) {
      b.chessHitCd = 0.35;
      b.fx.chessDash += 1;
      const ang = Math.atan2(foe.y - b.y, foe.x - b.x);
      if (!latch) { foe.vx += Math.cos(ang) * 520; foe.vy += Math.sin(ang) * 520; }
      sfx.clash(0.9);
      addShake(4);
      spawnSparks(foe.x, foe.y, CHESS_RED, 10, 1.0);
      applyDamage(foe, CHESS_DMG, foe.x, foe.y - foe.r * 0.5, ang, CHESS_RED, Math.cos(ang) * 30, -70, false);
      if (phase !== 'play') return;
    }
    if (b.chessT >= CHESS_DASH) {
      // Pattern complete: invulnerability ends and the ball rejoins normal physics
      b.chessPhase = 'idle';
      b.chessCd = CHESS_PERIOD - (CHESS_GLIDE + CHESS_WARN + CHESS_DASH);
      const ang = Math.atan2(p.dy, p.dx);
      b.vx = Math.cos(ang) * LAUNCH_SPEED * 0.8;
      b.vy = Math.sin(ang) * LAUNCH_SPEED * 0.8;
    }
  }

  function verityHit(b) {
    if (!b.alive || b.verityStage >= 3 || Math.random() >= VERITY_CHANCE) return;
    b.verityStage += 1;
    b.verityFlash = 1;
    b.morphPulse = 1;
    b.fx.transform += 1;
    const col = b.verityStage === 3 ? { r: 230, g: 40, b: 60 } : { r: 255, g: 170, b: 60 };
    sfx.forge();
    addShake(5);
    hitStop = Math.max(hitStop, 0.03);
    spawnSparks(b.x, b.y, col, 16, 1.2);
    impactRings.push({ x: b.x, y: b.y, age: 0, life: 0.5, radius: b.r * 1.8, color: col });
    spawnPopup(b.x, b.y - b.r - 8, VERITY_NAMES[b.verityStage], col, 0, -60, true);
  }

  function throwCacti(b) {
    for (let i = 0; i < 3; i++) {
      const mine = cacti.filter(c => c.owner === b);
      if (mine.length >= 9) cacti.splice(cacti.indexOf(mine[0]), 1);
      const a = Math.random() * Math.PI * 2;
      const dist = arena.w * (0.16 + Math.random() * 0.2);
      cacti.push({
        owner: b,
        sx: b.x, sy: b.y,
        tx: clamp(b.x + Math.cos(a) * dist, arena.x + 14, arena.x + arena.w - 14),
        ty: clamp(b.y + Math.sin(a) * dist, arena.y + 14, arena.y + arena.h - 14),
        x: b.x, y: b.y,
        age: 0, grounded: false, hitCd: 0
      });
    }
    b.fx.thrown += 1;
    sfx.appleThrow();
    spawnSparks(b.x, b.y, TYPES.cactus.accent, 8, 0.8);
  }

  function updateCacti(dt) {
    for (let i = cacti.length - 1; i >= 0; i--) {
      const c = cacti[i];
      c.age += dt;
      if (!c.grounded) {
        const u = clamp(c.age / CACTUS_FLY, 0, 1);
        const e = 1 - Math.pow(1 - u, 2);
        c.x = c.sx + (c.tx - c.sx) * e;
        c.y = c.sy + (c.ty - c.sy) * e;
        if (u >= 1) {
          c.grounded = true;
          c.age = 0;
          c.x = c.tx;
          c.y = c.ty;
          spawnSparks(c.x, c.y, TYPES.cactus.accent, 4, 0.5);
        }
        continue;
      }
      if (c.age >= CACTUS_LIFE) { cacti.splice(i, 1); continue; }
      c.hitCd = Math.max(0, c.hitCd - dt);
      const foe = foeOf(c.owner);
      const cr = c.owner.r * 0.45;
      if (!foe.alive || c.hitCd > 0 || Math.hypot(foe.x - c.x, foe.y - c.y) > foe.r + cr) continue;
      c.hitCd = 0.6;
      c.owner.fx.cactus += 1;
      const ang = Math.atan2(foe.y - c.y, foe.x - c.x);
      if (!latch) { foe.vx += Math.cos(ang) * 320; foe.vy += Math.sin(ang) * 320; }
      sfx.knifeHit();
      spawnSparks(foe.x, foe.y, TYPES.cactus.accent, 10, 0.9);
      applyDamage(foe, CACTUS_DMG, foe.x, foe.y - foe.r * 0.5, ang, TYPES.cactus.accent, Math.cos(ang) * 30, -70, false);
      if (phase !== 'play') return;
    }
  }

  function updateRangeAura(b, foe, dt) {
    b.rangeFlash = Math.max(0, b.rangeFlash - dt * 3);
    const inside = foe.alive && Math.hypot(foe.x - b.x, foe.y - b.y) <= b.rangeR + foe.r;
    if (!inside) { b.rangeT = 0; return; }
    b.rangeT += dt;
    if (b.rangeT < RANGE_TICK) return;
    b.rangeT = 0;
    b.rangeFlash = 1;
    b.fx.aura += 1;
    b.rangeR = Math.min(b.r * RANGE_CAP, b.rangeR + b.r * RANGE_GROW);
    const ang = Math.atan2(foe.y - b.y, foe.x - b.x);
    spawnSparks(foe.x, foe.y, TYPES.range.accent, 3, 0.6);
    applyDamage(foe, RANGE_DMG, foe.x, foe.y - foe.r * 0.5, ang, TYPES.range.accent, 0, -50, false);
  }

  function electroWallHit(b, wx, wy) {
    const x = clamp(wx, arena.x + 8, arena.x + arena.w - 8);
    const y = clamp(wy, arena.y + 8, arena.y + arena.h - 8);
    const mine = electroNodes.filter(n => n.owner === b);
    if (mine.length >= ELECTRO_NODES_MAX) electroNodes.splice(electroNodes.indexOf(mine[0]), 1);
    electroNodes.push({ owner: b, x, y });
    b.nodeFlash = 1;
    b.fx.nodes += 1;
    sfx.shock();
    spawnSparks(x, y, ELECTRO_BLUE, 12, 0.9);
  }

  function updateElectro(b, foe, dt) {
    b.nodeFlash = Math.max(0, b.nodeFlash - dt * 2.5);
    b.gridTick = Math.max(0, b.gridTick - dt);
    if (!foe.alive || b.gridTick > 0) return;
    const nodes = electroNodes.filter(n => n.owner === b);
    let touch = null;
    for (let i = 0; i < nodes.length && !touch; i++) {
      for (let j = i + 1; j < nodes.length && !touch; j++) {
        const q = closestPointOnSegment(foe.x, foe.y, nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y);
        if (q.dist <= foe.r * 0.8 + 3) touch = q;
      }
    }
    if (!touch) return;
    b.gridTick = ELECTRO_TICK;
    b.fx.grid += 1;
    const ang = Math.atan2(foe.y - touch.y, foe.x - touch.x);
    spawnSparks(touch.x, touch.y, ELECTRO_BLUE, 8, 0.8);
    applyDamage(foe, ELECTRO_DMG, foe.x, foe.y - foe.r * 0.5, ang, TYPES.electroking.accent, 0, -50, false);
  }

  function updateFiveBalls(dt, s) {
    if (phase !== 'play') return;
    for (const b of balls) {
      if (!b.alive) continue;
      const foe = foeOf(b);
      if (b.type === 'chess') updateChess(b, foe, dt);
      else if (b.type === 'verity') b.verityFlash = Math.max(0, b.verityFlash - dt * 2);
      else if (b.type === 'cactus') {
        b.cactusCd -= dt;
        if (b.cactusCd <= 0) { throwCacti(b); b.cactusCd = CACTUS_EVERY; }
      } else if (b.type === 'range') updateRangeAura(b, foe, dt);
      else if (b.type === 'electroking') updateElectro(b, foe, dt);
      if (phase !== 'play') return;
    }
    updateCacti(dt);
  }

  // The pattern runs out and back along the same lines, so draw each line once
  function chessLegs(path) {
    const legs = [];
    const seen = new Set();
    const key = p => p.x.toFixed(1) + ',' + p.y.toFixed(1);
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], c = path[i + 1];
      const k1 = key(a) + '|' + key(c);
      const k2 = key(c) + '|' + key(a);
      if (seen.has(k1) || seen.has(k2)) continue;
      seen.add(k1);
      legs.push([a, c]);
    }
    return legs;
  }

  function strokePathUpTo(path, d) {
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    let rem = d;
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], c = path[i + 1];
      const seg = Math.hypot(c.x - a.x, c.y - a.y);
      if (rem >= seg) { ctx.lineTo(c.x, c.y); rem -= seg; continue; }
      const t = seg > 0 ? rem / seg : 0;
      ctx.lineTo(a.x + (c.x - a.x) * t, a.y + (c.y - a.y) * t);
      break;
    }
    ctx.stroke();
  }

  function drawCactusProp(x, y, s, alpha) {
    // A small cactus: green body, yellow spines, a pink flower on top
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    roundedRect(x - s * 0.32, y - s * 0.9, s * 0.64, s * 1.8, s * 0.3);
    const g = ctx.createLinearGradient(x - s * 0.3, 0, x + s * 0.3, 0);
    g.addColorStop(0, '#d2ef96');
    g.addColorStop(0.5, '#97cb46');
    g.addColorStop(1, '#3e6e1c');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,40,10,0.9)';
    ctx.lineWidth = Math.max(1, s * 0.07);
    ctx.stroke();
    ctx.strokeStyle = '#eed128';
    ctx.lineWidth = Math.max(1, s * 0.07);
    for (let i = 0; i < 6; i++) {
      const yy = y - s * 0.6 + i * s * 0.25;
      for (const sg of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x + sg * s * 0.26, yy);
        ctx.lineTo(x + sg * s * 0.46, yy - s * 0.1);
        ctx.stroke();
      }
    }
    const fy = y - s * 0.95;
    for (let i = 0; i < 5; i++) {
      ctx.save();
      ctx.translate(x, fy);
      ctx.rotate((i / 5) * Math.PI * 2);
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.22, s * 0.17, s * 0.23, 0, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 ? '#e665f1' : '#f8adfc';
      ctx.fill();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(x, fy, s * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = '#a53bcf';
    ctx.fill();
    ctx.restore();
  }

  function drawElectroArc(p, q, seed, r) {
    // A jagged, flickering electric line between two nodes
    const dx = q.x - p.x, dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const segs = Math.max(4, Math.floor(len / 24));
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      const jit = Math.sin(clock * 26 + seed * 1.7 + i * 2.3) * r * 0.12;
      ctx.lineTo(p.x + dx * t + nx * jit, p.y + dy * t + ny * jit);
    }
    ctx.lineTo(q.x, q.y);
    ctx.shadowColor = rgba(ELECTRO_BLUE, 0.95);
    ctx.shadowBlur = r * 0.35;
    ctx.strokeStyle = rgba(TYPES.electroking.accent, 0.85);
    ctx.lineWidth = Math.max(1.6, r * 0.07);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = Math.max(0.8, r * 0.025);
    ctx.stroke();
    ctx.restore();
  }

  function drawElectroNode(n, r) {
    const pulse = 0.7 + Math.sin(clock * 9 + n.x * 0.05 + n.y * 0.03) * 0.3;
    ctx.save();
    ctx.shadowColor = rgba(ELECTRO_BLUE, 1);
    ctx.shadowBlur = r * 0.5;
    ctx.beginPath();
    ctx.arc(n.x, n.y, r * 0.24, 0, Math.PI * 2);
    ctx.fillStyle = '#0a1a3a';
    ctx.fill();
    ctx.lineWidth = Math.max(1.2, r * 0.06);
    ctx.strokeStyle = rgba(TYPES.electroking.accent, pulse);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(n.x, n.y, r * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${pulse})`;
    ctx.fill();
    ctx.restore();
  }

  function drawFiveBalls() {
    // Range Ball: its damage aura, brighter while it is hitting something
    for (const b of balls) {
      if (!b.alive || b.type !== 'range') continue;
      const R = b.rangeR;
      const hot = b.rangeFlash;
      const grd = ctx.createRadialGradient(b.x, b.y, b.r * 0.5, b.x, b.y, R);
      grd.addColorStop(0, rgba(TYPES.range.glow, 0.02));
      grd.addColorStop(0.7, rgba(TYPES.range.accent, 0.12 + hot * 0.12));
      grd.addColorStop(1, rgba(TYPES.range.accent, 0.3 + hot * 0.3));
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(b.x, b.y, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.setLineDash([5, 7]);
      ctx.lineDashOffset = -clock * 12;
      ctx.beginPath();
      ctx.arc(b.x, b.y, R, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(TYPES.range.accent, 0.65 + hot * 0.3);
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.restore();
    }

    // Electro King: wall nodes and the shock grid they link into
    for (const b of balls) {
      if (!b.alive || b.type !== 'electroking') continue;
      const nodes = electroNodes.filter(n => n.owner === b);
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) drawElectroArc(nodes[i], nodes[j], i * 7 + j * 3, b.r);
      }
      for (const n of nodes) drawElectroNode(n, b.r);
    }

    // Chess Ball: red warning line, the trail of the dash, and its invulnerability shimmer
    for (const b of balls) {
      if (!b.alive || b.type !== 'chess' || b.chessPhase === 'idle') continue;
      const path = b.chessPath;
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      if (b.chessPhase === 'dash') {
        ctx.setLineDash([6, 8]);
        ctx.strokeStyle = rgba(CHESS_RED, 0.22);
        ctx.lineWidth = Math.max(1.5, b.r * 0.06);
        for (const [a, c] of chessLegs(path)) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(c.x, c.y);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.shadowColor = rgba(CHESS_RED, 0.9);
        ctx.shadowBlur = b.r * 0.4;
        ctx.strokeStyle = rgba(CHESS_RED, 0.9);
        ctx.lineWidth = Math.max(2.5, b.r * 0.14);
        strokePathUpTo(path, b.chessDist);
      } else {
        const pulse = b.chessPhase === 'warn' ? 0.75 + Math.sin(clock * 16) * 0.25 : 0.3;
        ctx.setLineDash([12, 9]);
        ctx.shadowColor = rgba(CHESS_RED, 0.8);
        ctx.shadowBlur = b.r * 0.35;
        ctx.strokeStyle = rgba(CHESS_RED, pulse);
        ctx.lineWidth = Math.max(2, b.r * 0.1);
        for (const [a, c] of chessLegs(path)) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(c.x, c.y);
          ctx.stroke();
        }
      }
      ctx.restore();
      const k = 0.5 + 0.5 * Math.sin(clock * 9);
      ctx.save();
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * (1.26 + k * 0.07), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${0.3 + k * 0.35})`;
      ctx.lineWidth = Math.max(1.4, b.r * 0.05);
      ctx.stroke();
      ctx.restore();
    }

    // Cactus Ball: thrown cacti, then cacti standing on the floor for 5 seconds
    for (const c of cacti) {
      const s = c.owner.r * 0.62;
      if (!c.grounded) {
        const u = clamp(c.age / CACTUS_FLY, 0, 1);
        ctx.save();
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.ellipse(c.x, c.y + s * 0.9, s * 0.45, s * 0.16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        drawCactusProp(c.x, c.y - Math.sin(u * Math.PI) * s * 1.2, s, 1);
      } else {
        const fade = clamp((CACTUS_LIFE - c.age) / 0.8, 0, 1);
        ctx.save();
        ctx.globalAlpha = 0.28 * fade;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.ellipse(c.x, c.y + s * 0.9, s * 0.45, s * 0.16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        drawCactusProp(c.x, c.y, s, fade);
      }
    }
  }

  /* ---------- Acid, Big Spike, Cell, WDC and Hook abilities (from Ball VS Ball) ----------
     Acid Ball: every 2 seconds it throws a puddle that lasts 12 seconds. An enemy inside is
     slowed and poisoned for 2 damage every 0.6 seconds, 6 ticks, and each puddle keeps its own timer.
     Big Spike Ball: every wall touch leaves a permanent spike worth 6 damage.
     Cell Ball: 15 health, grows to maturity in 3 seconds, and divides into three cells instead of dying.
     WDC: a 3x3 grid appears after 3 seconds for 6 seconds; the number in its cell is its contact damage.
     Hook Ball: a hook snags the enemy for 3 and flings it spinning into the nearest wall. */

  const ACID_GREEN = { r: 101, g: 203, b: 31 };
  const SPIKE_STEEL = { r: 203, g: 209, b: 219 };

  const ACID_EVERY = 2.0, ACID_LIFE = 12.0, ACID_FLY = 0.5;
  const ACID_TICK = 0.6, ACID_TICKS = 6, ACID_DMG = 2, ACID_MAX = 6;
  const SPIKE_DMG = 6, SPIKE_MAX = 26;
  const CELL_GROW = 3.0, CELL_SMALL = 0.72, CELL_HP = 15, CELL_DMG = 5, CELL_ORB_LIFE = 7;
  const WDC_FIRST = 3.0, WDC_LIFE = 6.0, WDC_GAP = 3.0;
  const HOOK_EVERY = 2.6, HOOK_DMG = 3;

  function throwAcid(b) {
    const mine = acidPuddles.filter(p => p.owner === b);
    if (mine.length >= ACID_MAX) acidPuddles.splice(acidPuddles.indexOf(mine[0]), 1);
    const tx = arena.x + arena.w * (0.12 + Math.random() * 0.76);
    const ty = arena.y + arena.h * (0.12 + Math.random() * 0.76);
    acidPuddles.push({
      owner: b, sx: b.x, sy: b.y, tx, ty, x: b.x, y: b.y,
      r: b.r * (0.8 + Math.random() * 0.7),
      age: 0, landed: false, inside: false, seed: Math.random() * 10, sizzle: 0
    });
    b.fx.acid += 1;
    sfx.poison();
    spawnSparks(b.x, b.y, ACID_GREEN, 6, 0.7);
  }

  function updateAcid(dt) {
    for (let i = acidPuddles.length - 1; i >= 0; i--) {
      const p = acidPuddles[i];
      p.age += dt;
      p.sizzle = Math.max(0, p.sizzle - dt * 2);
      if (!p.landed) {
        const u = clamp(p.age / ACID_FLY, 0, 1);
        const e = 1 - Math.pow(1 - u, 2);
        p.x = p.sx + (p.tx - p.sx) * e;
        p.y = p.sy + (p.ty - p.sy) * e;
        if (u >= 1) {
          p.landed = true;
          p.age = 0;
          p.x = p.tx;
          p.y = p.ty;
          spawnSparks(p.x, p.y, ACID_GREEN, 8, 0.7);
        }
        continue;
      }
      if (p.age >= ACID_LIFE) { acidPuddles.splice(i, 1); continue; }
      const foe = foeOf(p.owner);
      if (!foe.alive) continue;
      const inside = Math.hypot(foe.x - p.x, foe.y - p.y) <= p.r + foe.r * 0.6;
      if (inside && !p.inside) {
        p.inside = true;
        p.sizzle = 1;
        foe.slowTimer = Math.max(foe.slowTimer, 1.1);
        foe.acidStacks.push({ t: 0, ticks: ACID_TICKS, color: ACID_GREEN });
        spawnSparks(foe.x, foe.y, ACID_GREEN, 8, 0.8);
        sfx.poison();
      } else if (!inside) {
        p.inside = false;
      }
    }
    for (const b of balls) {
      if (!b.alive || !b.acidStacks.length) continue;
      for (let i = b.acidStacks.length - 1; i >= 0; i--) {
        const st = b.acidStacks[i];
        st.t += dt;
        if (st.t < ACID_TICK) continue;
        st.t -= ACID_TICK;
        st.ticks -= 1;
        spawnSparks(b.x, b.y, ACID_GREEN, 4, 0.6);
        applyDamage(b, ACID_DMG, b.x + (Math.random() * 2 - 1) * b.r * 0.4, b.y - b.r * 0.5,
          Math.random() * Math.PI * 2, ACID_GREEN, 0, -60, false);
        if (st.ticks <= 0) b.acidStacks.splice(i, 1);
        if (phase !== 'play') return;
      }
    }
  }

  function bigSpikeWallHit(b, wx, wy) {
    // One spike per distinct touch; the same touch never plants two
    for (const sp of bigSpikes) {
      if (sp.owner === b && Math.hypot(sp.x - wx, sp.y - wy) < 7) return;
    }
    if (bigSpikes.length >= SPIKE_MAX) bigSpikes.shift();
    const inward = Math.atan2((arena.y + arena.h * 0.5) - wy, (arena.x + arena.w * 0.5) - wx);
    bigSpikes.push({
      owner: b, x: wx, y: wy, angle: inward,
      len: b.r * (0.8 + Math.random() * 0.45),
      age: 0, cd: 0
    });
    b.fx.spikes += 1;
    sfx.forge();
    spawnSparks(wx, wy, SPIKE_STEEL, 7, 0.8);
  }

  function updateSpikes(dt) {
    for (const sp of bigSpikes) {
      sp.age += dt;
      sp.cd = Math.max(0, sp.cd - dt);
      const foe = foeOf(sp.owner);
      if (!foe.alive || sp.cd > 0) continue;
      const tipx = sp.x + Math.cos(sp.angle) * sp.len;
      const tipy = sp.y + Math.sin(sp.angle) * sp.len;
      const q = closestPointOnSegment(foe.x, foe.y, sp.x, sp.y, tipx, tipy);
      if (q.dist > foe.r * 0.85 + 3) continue;
      sp.cd = 0.8;
      if (!latch) {
        foe.vx += Math.cos(sp.angle) * 190;
        foe.vy += Math.sin(sp.angle) * 190;
      }
      sfx.thunk();
      addShake(2.5);
      spawnSparks(q.x, q.y, SPIKE_STEEL, 8, 0.85);
      applyDamage(foe, SPIKE_DMG, foe.x, foe.y - foe.r * 0.5, sp.angle, SPIKE_STEEL,
        Math.cos(sp.angle) * 22, -66, false);
      if (phase !== 'play') return;
    }
  }

  function updateCell(b, dt) {
    if (b.cellMature) return;
    b.cellT += dt;
    const u = clamp(b.cellT / CELL_GROW, 0, 1);
    b.cellScale = CELL_SMALL + (1 - CELL_SMALL) * u;
    b.r = radiusFor(b);
    if (u < 1) return;
    b.cellMature = true;
    b.morphPulse = 1;
    sfx.forge();
    impactRings.push({ x: b.x, y: b.y, age: 0, life: 0.45, radius: b.r * 1.6, color: TYPES.cell.accent });
  }

  function cellDivide(b) {
    if (!b.cellMature || b.cellSplits <= 0) return false;
    b.cellSplits -= 1;
    b.fx.divides += 1;
    b.cellMature = false;
    b.cellT = 0;
    b.cellScale = CELL_SMALL;
    b.r = radiusFor(b);
    b.health = CELL_HP;
    b.shownHealth = CELL_HP;
    b.morphPulse = 1;
    b.hit = 1;
    for (let i = 0; i < 2; i++) {
      const a = Math.random() * Math.PI * 2;
      const or = b.r * 0.62;
      cellOrbs.push({
        owner: b, r: or,
        x: clamp(b.x + Math.cos(a) * b.r * 1.3, arena.x + or, arena.x + arena.w - or),
        y: clamp(b.y + Math.sin(a) * b.r * 1.3, arena.y + or, arena.y + arena.h - or),
        vx: Math.cos(a) * LAUNCH_SPEED * 0.72,
        vy: Math.sin(a) * LAUNCH_SPEED * 0.72,
        age: 0, cd: 0, spin: Math.random() * Math.PI * 2
      });
      b.fx.orbs += 1;
    }
    sfx.shatter();
    addShake(5);
    spawnSparks(b.x, b.y, TYPES.cell.accent, 18, 1.2);
    impactRings.push({ x: b.x, y: b.y, age: 0, life: 0.55, radius: b.r * 2.2, color: TYPES.cell.accent });
    spawnPopup(b.x, b.y - b.r - 8, 'DIVIDE', TYPES.cell.accent, 0, -64, true);
    return true;
  }

  function updateCellOrbs(dt) {
    for (let i = cellOrbs.length - 1; i >= 0; i--) {
      const o = cellOrbs[i];
      o.age += dt;
      o.cd = Math.max(0, o.cd - dt);
      o.spin += dt * 1.6;
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      if (o.x < arena.x + o.r) { o.x = arena.x + o.r; o.vx = Math.abs(o.vx); }
      if (o.x > arena.x + arena.w - o.r) { o.x = arena.x + arena.w - o.r; o.vx = -Math.abs(o.vx); }
      if (o.y < arena.y + o.r) { o.y = arena.y + o.r; o.vy = Math.abs(o.vy); }
      if (o.y > arena.y + arena.h - o.r) { o.y = arena.y + arena.h - o.r; o.vy = -Math.abs(o.vy); }
      if (o.age >= CELL_ORB_LIFE) {
        spawnSparks(o.x, o.y, TYPES.cell.accent, 5, 0.5);
        cellOrbs.splice(i, 1);
        continue;
      }
      const foe = foeOf(o.owner);
      if (!foe.alive || o.cd > 0) continue;
      if (Math.hypot(foe.x - o.x, foe.y - o.y) > foe.r + o.r) continue;
      o.cd = 0.5;
      const ang = Math.atan2(foe.y - o.y, foe.x - o.x);
      if (!latch) { foe.vx += Math.cos(ang) * 120; foe.vy += Math.sin(ang) * 120; }
      sfx.slash();
      spawnSparks(foe.x, foe.y, TYPES.cell.accent, 7, 0.8);
      applyDamage(foe, CELL_DMG, foe.x, foe.y - foe.r * 0.5, ang, TYPES.cell.accent, Math.cos(ang) * 18, -66, false);
      if (phase !== 'play') return;
    }
  }

  function updateWdc(b, dt) {
    b.wdcT += dt;
    if (b.wdcOn) {
      if (b.wdcT >= WDC_LIFE) { b.wdcOn = false; b.wdcT = 0; }
      return;
    }
    if (b.wdcT < WDC_FIRST) return;
    b.wdcOn = true;
    b.wdcT = 0;
    b.wdcCells = [];
    for (let i = 0; i < 9; i++) b.wdcCells.push(1 + Math.floor(Math.random() * 100));
    sfx.diceRoll();
    impactRings.push({ x: b.x, y: b.y, age: 0, life: 0.5, radius: b.r * 2, color: TYPES.wdc.accent });
  }

  function wdcCellAt(b) {
    if (!b.wdcOn || b.wdcCells.length !== 9) return 0;
    const cw = arena.w / 3, ch = arena.h / 3;
    const cx = clamp(Math.floor((b.x - arena.x) / cw), 0, 2);
    const cy = clamp(Math.floor((b.y - arena.y) / ch), 0, 2);
    const n = b.wdcCells[cy * 3 + cx] || 0;
    b.wdcLast = n;
    return n;
  }

  function hookFire(b, foe) {
    b.hookCd = HOOK_EVERY;
    b.fx.hooks += 1;
    hookShots.push({ owner: b, sx: b.x, sy: b.y, tx: foe.x, ty: foe.y, age: 0, life: 0.55 });
    const dists = [
      { d: foe.x - arena.x, ax: -1, ay: 0 },
      { d: arena.x + arena.w - foe.x, ax: 1, ay: 0 },
      { d: foe.y - arena.y, ax: 0, ay: -1 },
      { d: arena.y + arena.h - foe.y, ax: 0, ay: 1 }
    ];
    let best = dists[0];
    for (const w of dists) if (w.d < best.d) best = w;
    const spin = Math.random() < 0.5 ? -1 : 1;
    const ang = Math.atan2(best.ay, best.ax) + spin * 0.5;
    if (!latch) {
      foe.vx = Math.cos(ang) * 720;
      foe.vy = Math.sin(ang) * 720;
    }
    foe.hit = 1;
    sfx.web();
    addShake(4);
    spawnSparks(foe.x, foe.y, TYPES.hook.accent, 12, 1.0);
    impactRings.push({ x: foe.x, y: foe.y, age: 0, life: 0.4, radius: foe.r * 1.4, color: TYPES.hook.accent });
    applyDamage(foe, HOOK_DMG, foe.x, foe.y - foe.r * 0.5, ang, TYPES.hook.accent, Math.cos(ang) * 26, -70, false);
  }

  function updateBatchSix(dt, s) {
    if (phase !== 'play') return;
    for (const b of balls) {
      b.spikeCd = Math.max(0, b.spikeCd - dt);
      if (!b.alive) continue;
      const foe = foeOf(b);
      if (b.type === 'acid') {
        b.acidCd -= dt;
        if (b.acidCd <= 0) { throwAcid(b); b.acidCd = ACID_EVERY; }
      } else if (b.type === 'cell') updateCell(b, dt);
      else if (b.type === 'wdc') updateWdc(b, dt);
      else if (b.type === 'hook') {
        b.hookCd -= dt;
        if (b.hookCd <= 0 && foe.alive) hookFire(b, foe);
      }
      if (phase !== 'play') return;
    }
    updateAcid(dt);
    if (phase !== 'play') return;
    updateSpikes(dt);
    if (phase !== 'play') return;
    updateCellOrbs(dt);
    for (let i = hookShots.length - 1; i >= 0; i--) {
      hookShots[i].age += dt;
      if (hookShots[i].age >= hookShots[i].life) hookShots.splice(i, 1);
    }
  }

  function drawBatchSix() {
    // WDC: the 3x3 grid, a scan sweep, and the live cell highlighted
    for (const b of balls) {
      if (!b.alive || b.type !== 'wdc' || !b.wdcOn) continue;
      const cw = arena.w / 3, ch = arena.h / 3;
      const fade = b.wdcT < 0.25 ? b.wdcT / 0.25 : (b.wdcT > WDC_LIFE - 0.5 ? (WDC_LIFE - b.wdcT) / 0.5 : 1);
      const here = clamp(Math.floor((b.x - arena.x) / cw), 0, 2) + clamp(Math.floor((b.y - arena.y) / ch), 0, 2) * 3;
      ctx.save();
      ctx.globalAlpha = clamp(fade, 0, 1);
      // Live cell wash
      const hx = (here % 3) * cw, hy = Math.floor(here / 3) * ch;
      ctx.fillStyle = 'rgba(120,170,255,0.16)';
      ctx.fillRect(arena.x + hx, arena.y + hy, cw, ch);
      // Sweeping scan line
      const sy = arena.y + ((clock * 160) % (arena.h + 80)) - 40;
      const sg = ctx.createLinearGradient(0, sy - 26, 0, sy + 26);
      sg.addColorStop(0, 'rgba(140,190,255,0)');
      sg.addColorStop(0.5, 'rgba(140,190,255,0.14)');
      sg.addColorStop(1, 'rgba(140,190,255,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(arena.x, sy - 26, arena.w, 52);
      ctx.strokeStyle = 'rgba(243,245,249,0.4)';
      ctx.lineWidth = 2;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(arena.x + cw * i, arena.y);
        ctx.lineTo(arena.x + cw * i, arena.y + arena.h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(arena.x, arena.y + ch * i);
        ctx.lineTo(arena.x + arena.w, arena.y + ch * i);
        ctx.stroke();
      }
      for (let i = 0; i < 9; i++) {
        const cx = arena.x + (i % 3) * cw + cw * 0.5;
        const cy = arena.y + Math.floor(i / 3) * ch + ch * 0.5;
        const on = i === here;
        ctx.font = `900 ${clamp(cw * (on ? 0.36 : 0.24), 14, 46)}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(3, cw * 0.035);
        ctx.strokeStyle = 'rgba(6,16,48,0.85)';
        ctx.strokeText(String(b.wdcCells[i]), cx, cy);
        ctx.fillStyle = on ? '#ffffff' : 'rgba(243,245,249,0.5)';
        if (on) { ctx.shadowColor = 'rgba(120,170,255,0.95)'; ctx.shadowBlur = 20; }
        ctx.fillText(String(b.wdcCells[i]), cx, cy);
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    }

    // Acid: puddles with a breathing rim, drifting bubbles and a sizzle ring on a fresh catch
    for (const p of acidPuddles) {
      const grow = p.landed ? clamp(p.age / 0.3, 0, 1) : clamp(p.age / ACID_FLY, 0, 1) * 0.5;
      const fade = p.landed && p.age > ACID_LIFE - 1.5 ? clamp((ACID_LIFE - p.age) / 1.5, 0, 1) : 1;
      const R = p.r * (0.5 + grow * 0.5);
      const breathe = 1 + Math.sin(clock * 3 + p.seed) * 0.03;
      ctx.save();
      ctx.globalAlpha = 0.85 * fade;
      const g = ctx.createRadialGradient(p.x, p.y, R * 0.1, p.x, p.y, R * breathe);
      g.addColorStop(0, 'rgba(190,255,120,0.55)');
      g.addColorStop(0.6, 'rgba(101,203,31,0.45)');
      g.addColorStop(1, 'rgba(44,106,12,0.08)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, R * breathe, R * 0.82 * breathe, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(180,255,110,${(0.45 + Math.sin(clock * 4 + p.seed) * 0.15) * fade})`;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      if (p.sizzle > 0) {
        const sr = R * (1.1 + (1 - p.sizzle) * 0.5);
        ctx.globalAlpha = p.sizzle * fade;
        ctx.strokeStyle = 'rgba(230,255,190,0.9)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, sr, sr * 0.82, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.85 * fade;
      }
      ctx.globalAlpha = fade;
      for (let i = 0; i < 4; i++) {
        const a = p.seed + i * 1.7 + clock * 0.6;
        const br = R * (0.1 + 0.06 * Math.sin(clock * 2.2 + i));
        ctx.beginPath();
        ctx.arc(p.x + Math.cos(a) * R * 0.5, p.y + Math.sin(a) * R * 0.4, Math.max(1.2, br), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(226,255,184,0.5)';
        ctx.fill();
      }
      ctx.restore();
    }

    // Big Spike: spikes seated in a bolted base collar, with a honed edge light
    for (const sp of bigSpikes) {
      const grow = clamp(sp.age / 0.18, 0, 1);
      const len = sp.len * grow;
      const w = sp.owner.r * 0.42;
      ctx.save();
      ctx.translate(sp.x, sp.y);
      ctx.rotate(sp.angle);
      // Base collar
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.5, w * 1.15, 0, 0, Math.PI * 2);
      const cg = ctx.createLinearGradient(0, -w, 0, w);
      cg.addColorStop(0, '#8b93a3');
      cg.addColorStop(0.5, '#3c4250');
      cg.addColorStop(1, '#14171e');
      ctx.fillStyle = cg;
      ctx.fill();
      ctx.strokeStyle = 'rgba(8,10,16,0.9)';
      ctx.lineWidth = Math.max(1, sp.owner.r * 0.04);
      ctx.stroke();
      for (const sg of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(0, sg * w * 0.72, Math.max(1, w * 0.12), 0, Math.PI * 2);
        ctx.fillStyle = '#eef2f8';
        ctx.fill();
      }
      // Spike blade
      ctx.beginPath();
      ctx.moveTo(w * 0.3, -w * 0.8);
      ctx.lineTo(len * 0.72, -w * 0.3);
      ctx.lineTo(len, 0);
      ctx.lineTo(len * 0.72, w * 0.3);
      ctx.lineTo(w * 0.3, w * 0.8);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, -w, 0, w);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.45, '#cbd1db');
      g.addColorStop(1, '#5b6270');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(8,10,16,0.9)';
      ctx.lineWidth = Math.max(1, sp.owner.r * 0.045);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = Math.max(1, sp.owner.r * 0.03);
      ctx.beginPath();
      ctx.moveTo(len * 0.16, -w * 0.34);
      ctx.lineTo(len * 0.88, -w * 0.05);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(20,24,32,0.5)';
      ctx.beginPath();
      ctx.moveTo(len * 0.16, w * 0.3);
      ctx.lineTo(len * 0.88, w * 0.05);
      ctx.stroke();
      ctx.restore();
    }

    // Cell: smaller cells with a breathing throb
    for (const o of cellOrbs) {
      const fade = o.age > CELL_ORB_LIFE - 1 ? clamp((CELL_ORB_LIFE - o.age), 0, 1) : 1;
      const throb = 1 + Math.sin(clock * 5 + o.spin) * 0.05;
      ctx.save();
      ctx.globalAlpha = 0.9 * fade;
      const g = ctx.createRadialGradient(o.x - o.r * 0.35, o.y - o.r * 0.4, o.r * 0.1, o.x, o.y, o.r * throb);
      g.addColorStop(0, 'rgba(242,255,224,0.95)');
      g.addColorStop(0.55, 'rgba(191,224,135,0.8)');
      g.addColorStop(1, 'rgba(107,179,111,0.55)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r * throb, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(63,122,69,0.9)';
      ctx.lineWidth = Math.max(1.4, o.r * 0.16);
      ctx.stroke();
      for (let i = 0; i < 2; i++) {
        const a = o.spin + i * Math.PI;
        ctx.beginPath();
        ctx.arc(o.x + Math.cos(a) * o.r * 0.3, o.y + Math.sin(a) * o.r * 0.3, o.r * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(222,236,189,0.95)';
        ctx.fill();
      }
      ctx.restore();
    }

    // Hook: a chain of links unreeling to the target, with the anchor head spinning out front
    for (const h of hookShots) {
      const u = clamp(h.age / h.life, 0, 1);
      const out = u < 0.4 ? u / 0.4 : 1 - (u - 0.4) / 0.6;
      const hx = h.sx + (h.tx - h.sx) * out;
      const hy = h.sy + (h.ty - h.sy) * out;
      ctx.save();
      ctx.globalAlpha = 1 - u * 0.35;
      ctx.lineCap = 'round';
      // Chain links along the rope
      const dx = hx - h.sx, dy = hy - h.sy;
      const len = Math.hypot(dx, dy) || 1;
      const links = Math.max(2, Math.floor(len / (h.owner.r * 0.34)));
      for (let i = 0; i <= links; i++) {
        const t = i / links;
        const lx = h.sx + dx * t, ly = h.sy + dy * t + Math.sin(clock * 22 + i) * 2;
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(Math.atan2(dy, dx) + Math.PI / 2);
        ctx.beginPath();
        ctx.ellipse(0, 0, h.owner.r * 0.09, h.owner.r * 0.14, 0, 0, Math.PI * 2);
        ctx.strokeStyle = i % 2 ? '#e2ce9e' : '#8a744e';
        ctx.lineWidth = Math.max(1.6, h.owner.r * 0.055);
        ctx.stroke();
        ctx.restore();
      }
      ctx.translate(hx, hy);
      ctx.rotate(Math.atan2(h.ty - h.sy, h.tx - h.sx) + u * 3);
      const ar = h.owner.r * 0.34;
      ctx.strokeStyle = '#dfe6ee';
      ctx.lineWidth = Math.max(2, ar * 0.34);
      ctx.beginPath();
      ctx.arc(0, 0, ar, 0.35, Math.PI - 0.35);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -ar * 1.1);
      ctx.lineTo(0, ar * 0.2);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* ---------- Gojo Ball ----------
     Casts Blue: a slow orb whose pull drags the enemy, and Red, toward it.
     Then casts Red: a fast orb that blasts the enemy back for 10.
     If Red reaches Blue the two fuse into Hollow Purple, which strikes the
     enemy for 28 wherever it is on the field. */

  const GOJO_EVERY = 4.6, GOJO_RED_DELAY = 0.6;
  const BLUE_SPEED = 290, RED_SPEED = 660;
  const BLUE_LIFE = 3.4, RED_LIFE = 2.6;
  const BLUE_DMG = 3, BLUE_TICK = 0.4, RED_DMG = 10, PURPLE_DMG = 28;
  const BLUE_PULL = 2100, BLUE_PULL_RED = 2800;
  const GOJO_BLUE = { r: 70, g: 160, b: 255 };
  const GOJO_RED = { r: 255, g: 50, b: 70 };
  const GOJO_PURPLE = { r: 176, g: 96, b: 255 };
  // Domain Expansion: Unlimited Void (Mugen Kū). After a long charge it opens a
  // pocket of the void at Gojo's position. The enemy inside is drowned in
  // "infinite information" (locked in place and drained) while Gojo is buffed.
  const VOID_EVERY = 11, VOID_WINDUP = 0.85, VOID_DUR = 2.4;
  const VOID_DMG = 3, VOID_TICK = 0.32;
  const VOID_DMG_MUL = 1.6, VOID_SPEED_MUL = 1.3;
  const VOID_INK = { r: 60, g: 30, b: 120 };

  function blueReach(o) { return o.owner.r * 4.8; }

  function voidRadius() { return Math.min(arena.w, arena.h) * 0.5; }
  function voidMul(b) { return b.voidPhase === 'active' ? VOID_DMG_MUL : 1; }

  function updateGojoVoid(b, foe, dt) {
    if (b.voidPhase === 'idle') {
      b.voidCd -= dt;
      if (b.voidCd <= 0 && b.freezeTimer <= 0) {
        b.voidPhase = 'windup';
        b.voidT = VOID_WINDUP;
        sfx.chargeFull();
      }
      return;
    }
    if (b.voidPhase === 'windup') {
      b.voidT -= dt;
      if (b.voidT <= 0) {
        b.voidPhase = 'active';
        b.voidT = VOID_DUR;
        b.voidX = b.x;
        b.voidY = b.y;
        b.voidR = voidRadius();
        b.voidTick = VOID_TICK * 0.6;
        b.fx.gojoVoid += 1;
        gojoFlash = Math.max(gojoFlash, 0.9);
        voidFlash = 1;
        sfx.boom();
        sfx.laserZap();
        addShake(14);
        hitStop = Math.max(hitStop, 0.1);
        spawnSparks(b.x, b.y, GOJO_PURPLE, 26, 1.6);
        spawnSparks(b.x, b.y, { r: 255, g: 255, b: 255 }, 14, 1.2);
      }
      return;
    }
    // active: drain the enemy locked inside the void, then close it
    b.voidT -= dt;
    if (foe.alive && Math.hypot(foe.x - b.voidX, foe.y - b.voidY) <= b.voidR) {
      // Drowned in infinite information: held perfectly in place
      foe.freezeTimer = Math.max(foe.freezeTimer, 0.14);
      b.voidTick -= dt;
      if (b.voidTick <= 0) {
        b.voidTick = VOID_TICK;
        spawnSparks(foe.x, foe.y, VOID_INK, 4, 0.6);
        applyDamage(foe, VOID_DMG, foe.x, foe.y - foe.r * 0.5, Math.random() * Math.PI * 2, GOJO_PURPLE, 0, -56, false);
        if (phase !== 'play') return;
      }
    }
    if (b.voidT <= 0) {
      b.voidPhase = 'idle';
      b.voidCd = VOID_EVERY;
    }
  }

  function gojoCast(b, foe, kind, s) {
    const isBlue = kind === 'blue';
    const speed = (isBlue ? BLUE_SPEED : RED_SPEED) * (s || 1);
    let a = leadAim(b, foe, speed);
    if (isBlue) {
      a += (Math.random() * 2 - 1) * 0.12;
    } else {
      // Red leans toward Blue while Blue is still out, so the two can meet
      const bo = gojoOrbs.find(o => o.owner === b && o.kind === 'blue' && !o.dead);
      if (bo) {
        const toBlue = Math.atan2(bo.y - b.y, bo.x - b.x);
        a += Math.atan2(Math.sin(toBlue - a), Math.cos(toBlue - a)) * 0.4;
      }
    }
    const x = b.x + Math.cos(a) * b.r * 1.15;
    const y = b.y + Math.sin(a) * b.r * 1.15;
    gojoOrbs.push({
      owner: b, kind,
      x: clamp(x, arena.x + 4, arena.x + arena.w - 4),
      y: clamp(y, arena.y + 4, arena.y + arena.h - 4),
      vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      r: b.r * (isBlue ? 0.44 : 0.34),
      age: 0, life: isBlue ? BLUE_LIFE : RED_LIFE,
      tick: 0, trail: [], spin: Math.random() * Math.PI * 2, dead: false
    });
    if (isBlue) { b.fx.gojoBlue += 1; sfx.shock(); } else { b.fx.gojoRed += 1; sfx.laserZap(); }
    impactRings.push({ x: b.x, y: b.y, age: 0, life: 0.35, radius: b.r * 1.5, color: isBlue ? GOJO_BLUE : GOJO_RED });
    spawnSparks(x, y, isBlue ? GOJO_BLUE : GOJO_RED, 8, 0.8);
  }

  function hollowPurple(owner, x, y) {
    owner.fx.purple += 1;
    purpleFx.push({ x, y, age: 0, life: 1.15 });
    gojoFlash = 1;
    sfx.boom();
    sfx.laserZap();
    addShake(16);
    hitStop = Math.max(hitStop, 0.12);
    spawnSparks(x, y, GOJO_PURPLE, 30, 1.8);
    spawnSparks(x, y, { r: 255, g: 255, b: 255 }, 12, 1.4);
    impactRings.push({ x, y, age: 0, life: 0.7, radius: Math.max(arena.w, arena.h) * 0.45, color: GOJO_PURPLE });
    const foe = foeOf(owner);
    if (!foe.alive) return;
    // Global: it lands on the enemy no matter where on the field it is
      const ang = Math.atan2(foe.y - y, foe.x - x);
    if (!latch) { foe.vx += Math.cos(ang) * 380; foe.vy += Math.sin(ang) * 380; }
    spawnSparks(foe.x, foe.y, GOJO_PURPLE, 18, 1.3);
    applyDamage(foe, PURPLE_DMG * voidMul(owner), foe.x, foe.y - foe.r * 0.6, ang, GOJO_PURPLE, 0, -96, true);
  }

  function updateGojo(dt, s) {
    gojoFlash = Math.max(0, gojoFlash - dt * 1.5);
    voidFlash = Math.max(0, voidFlash - dt * 0.9);
    for (let i = purpleFx.length - 1; i >= 0; i--) {
      purpleFx[i].age += dt;
      if (purpleFx[i].age >= purpleFx[i].life) purpleFx.splice(i, 1);
    }
    if (phase !== 'play') return;

    for (const b of balls) {
      if (!b.alive || b.type !== 'gojo') continue;
      const foe = foeOf(b);
      updateGojoVoid(b, foe, dt);
      if (!foe.alive) continue;
      b.gojoCd -= dt;
      if (b.gojoCd <= 0 && b.gojoRedT < 0) {
        gojoCast(b, foe, 'blue', s);
        b.gojoRedT = GOJO_RED_DELAY;
        b.gojoCd = GOJO_EVERY;
      }
      if (b.gojoRedT >= 0) {
        b.gojoRedT -= dt;
        if (b.gojoRedT < 0) gojoCast(b, foe, 'red', s);
      }
    }

    for (const o of gojoOrbs.slice()) {
      if (o.dead) continue;
      o.age += dt;
      o.spin += dt * (o.kind === 'blue' ? -7 : 9);
      const foe = foeOf(o.owner);

      // Blue drags Red into itself
      if (o.kind === 'red') {
        for (const bo of gojoOrbs) {
          if (bo.dead || bo.kind !== 'blue' || bo.owner !== o.owner) continue;
          const dx = bo.x - o.x, dy = bo.y - o.y;
          const d = Math.hypot(dx, dy) || 1;
          const R = o.owner.r * 5.5;
          if (d < R) {
            const f = BLUE_PULL_RED * (1 - d / R) * (s || 1) * dt;
            o.vx += (dx / d) * f;
            o.vy += (dy / d) * f;
          }
        }
        const sp = Math.hypot(o.vx, o.vy);
        const cap = RED_SPEED * (s || 1) * 1.35;
        if (sp > cap) { o.vx *= cap / sp; o.vy *= cap / sp; }
      }

      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.trail.push({ x: o.x, y: o.y });
      if (o.trail.length > 9) o.trail.shift();
      if (o.x < arena.x + o.r) { o.x = arena.x + o.r; o.vx = Math.abs(o.vx); }
      if (o.x > arena.x + arena.w - o.r) { o.x = arena.x + arena.w - o.r; o.vx = -Math.abs(o.vx); }
      if (o.y < arena.y + o.r) { o.y = arena.y + o.r; o.vy = Math.abs(o.vy); }
      if (o.y > arena.y + arena.h - o.r) { o.y = arena.y + arena.h - o.r; o.vy = -Math.abs(o.vy); }

      if (o.kind === 'blue') {
        o.tick = Math.max(0, o.tick - dt);
        if (foe.alive) {
          const dx = o.x - foe.x, dy = o.y - foe.y;
          const d = Math.hypot(dx, dy) || 1;
          const R = blueReach(o);
          // Gravity well: bends the enemy's path toward the orb
          if (d < R && !latch) {
            const f = BLUE_PULL * (1 - d / R) * (s || 1) * dt;
            foe.vx += (dx / d) * f;
            foe.vy += (dy / d) * f;
          }
          if (d <= foe.r + o.r && o.tick <= 0) {
            o.tick = BLUE_TICK;
            spawnSparks(foe.x, foe.y, GOJO_BLUE, 6, 0.7);
            applyDamage(foe, BLUE_DMG * voidMul(o.owner), foe.x, foe.y - foe.r * 0.5, Math.atan2(-dy, -dx), GOJO_BLUE, 0, -62, false);
            if (phase !== 'play') return;
          }
        }
      } else {
        // Red meets Blue: Hollow Purple
        const bo = gojoOrbs.find(q => !q.dead && q.kind === 'blue' && q.owner === o.owner &&
          Math.hypot(q.x - o.x, q.y - o.y) <= q.r + o.r);
        if (bo) {
          o.dead = true;
          bo.dead = true;
          hollowPurple(o.owner, (o.x + bo.x) / 2, (o.y + bo.y) / 2);
          if (phase !== 'play') break;
          continue;
        }
        if (foe.alive && Math.hypot(foe.x - o.x, foe.y - o.y) <= foe.r + o.r) {
          o.dead = true;
          const ang = Math.atan2(o.vy, o.vx);
          if (!latch) { foe.vx += Math.cos(ang) * 520; foe.vy += Math.sin(ang) * 520; }
          sfx.boom();
          addShake(6);
          impactRings.push({ x: o.x, y: o.y, age: 0, life: 0.4, radius: o.owner.r * 1.8, color: GOJO_RED });
          spawnSparks(o.x, o.y, GOJO_RED, 14, 1.2);
          applyDamage(foe, RED_DMG * voidMul(o.owner), foe.x, foe.y - foe.r * 0.55, ang, GOJO_RED, Math.cos(ang) * 30, -80, true);
          if (phase !== 'play') break;
          continue;
        }
      }

      if (o.age >= o.life) {
        o.dead = true;
        spawnSparks(o.x, o.y, o.kind === 'blue' ? GOJO_BLUE : GOJO_RED, 6, 0.5);
      }
    }
    for (let i = gojoOrbs.length - 1; i >= 0; i--) if (gojoOrbs[i].dead) gojoOrbs.splice(i, 1);
  }

  function drawGojoVoidField(b) {
    if (b.voidPhase !== 'active') return;
    const growIn = clamp((VOID_DUR - b.voidT) / 0.3, 0, 1);
    const open = clamp(b.voidT / VOID_DUR, 0, 1);
    const R = b.voidR * growIn;
    if (R <= 2) return;
    const cx = b.voidX, cy = b.voidY;
    // Deep void interior — a pocket of the universe
    const voidGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    voidGrad.addColorStop(0, 'rgba(30,10,60,0.5)');
    voidGrad.addColorStop(0.7, 'rgba(20,8,44,0.46)');
    voidGrad.addColorStop(0.92, 'rgba(74,32,144,0.34)');
    voidGrad.addColorStop(1, 'rgba(120,60,220,0)');
    ctx.fillStyle = voidGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
    // Starfield — the "infinite information" swirling inside
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.97, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate(clock * 0.24);
    const stars = 44;
    for (let i = 0; i < stars; i++) {
      const a = i * 2.39996;
      const rr = (i / stars) * R * 0.93;
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      const tw = 0.5 + 0.5 * Math.sin(clock * 3 + i * 1.7);
      const sr = (0.6 + tw) * (1.1 + (rr / R) * 1.6);
      ctx.fillStyle = `rgba(${i % 3 === 0 ? '210,170,255' : '234,240,255'},${0.3 + tw * 0.5})`;
      ctx.beginPath();
      ctx.arc(x, y, sr, 0, Math.PI * 2);
      ctx.fill();
    }
    // Faint orbit rings conveying the endless swirl
    ctx.strokeStyle = 'rgba(150,110,255,0.14)';
    ctx.lineWidth = 1.4;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.ellipse(0, 0, R * 0.9 * (i / 3), R * 0.9 * (i / 3), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    // Shimmering domain boundary
    ctx.save();
    ctx.shadowColor = 'rgba(150,80,255,0.9)';
    ctx.shadowBlur = 24;
    ctx.strokeStyle = `rgba(200,150,255,${0.45 + open * 0.4})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(240,222,255,${0.55 * open})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.985, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawGojoVoidWindup(b) {
    if (b.voidPhase !== 'windup') return;
    const t = clamp(1 - b.voidT / VOID_WINDUP, 0, 1);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const R = b.r * (1.2 + t * 2.6);
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, R);
    g.addColorStop(0, `rgba(255,255,255,${0.14 + t * 0.3})`);
    g.addColorStop(0.5, `rgba(150,80,255,${0.2 + t * 0.3})`);
    g.addColorStop(1, 'rgba(90,40,200,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, R, 0, Math.PI * 2);
    ctx.fill();
    // Converging charge particles
    for (let i = 0; i < 10; i++) {
      const a = clock * 4.5 + i * 0.628;
      const d = R * (1.5 - t * 0.95);
      ctx.fillStyle = `rgba(205,155,255,${t * 0.75})`;
      ctx.beginPath();
      ctx.arc(b.x + Math.cos(a) * d, b.y + Math.sin(a) * d, 1.6 + t * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Warning ring marking where the domain will open
    ctx.globalCompositeOperation = 'source-over';
    const warnR = voidRadius() * t;
    ctx.strokeStyle = `rgba(205,155,255,${0.3 + t * 0.5})`;
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(b.x, b.y, warnR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawGojo() {
    for (const b of balls) {
      if (!b.alive || b.type !== 'gojo') continue;
      drawGojoVoidField(b);
      drawGojoVoidWindup(b);
    }
    for (const o of gojoOrbs) {
      if (o.dead) continue;
      const isBlue = o.kind === 'blue';
      const C = isBlue ? GOJO_BLUE : GOJO_RED;
      const a = clamp(o.age / 0.15, 0, 1) * clamp((o.life - o.age) / 0.3, 0, 1);
      const R = o.r;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.globalCompositeOperation = 'lighter';
      // Trail
      for (let i = 1; i < o.trail.length; i++) {
        const t = i / o.trail.length;
        ctx.strokeStyle = rgba(C, 0.28 * t);
        ctx.lineWidth = R * 1.4 * t;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(o.trail[i - 1].x, o.trail[i - 1].y);
        ctx.lineTo(o.trail[i].x, o.trail[i].y);
        ctx.stroke();
      }
      // Glow
      const g = ctx.createRadialGradient(o.x, o.y, R * 0.3, o.x, o.y, R * 2.8);
      g.addColorStop(0, rgba(C, 0.55));
      g.addColorStop(1, rgba(C, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(o.x, o.y, R * 2.8, 0, Math.PI * 2);
      ctx.fill();
      if (isBlue) {
        // The pull: a ring collapsing inward and spiral arms winding in
        const reach = blueReach(o);
        const ph = (clock * 0.9 + o.spin * 0.05) % 1;
        ctx.strokeStyle = rgba(C, 0.22 * ph);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(o.x, o.y, reach * (1 - ph * 0.7), 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(180,225,255,0.65)';
        ctx.lineWidth = Math.max(1.2, R * 0.1);
        for (let k = 0; k < 4; k++) {
          ctx.beginPath();
          for (let j = 0; j <= 14; j++) {
            const t = j / 14;
            const ang = o.spin + k * Math.PI / 2 + t * 2.4;
            const rr = R * (2.3 - t * 1.5);
            const px = o.x + Math.cos(ang) * rr, py = o.y + Math.sin(ang) * rr;
            if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
      } else {
        // The push: spikes bursting outward
        ctx.strokeStyle = 'rgba(255,170,170,0.75)';
        ctx.lineWidth = Math.max(1.2, R * 0.12);
        ctx.lineCap = 'round';
        for (let k = 0; k < 8; k++) {
          const ang = o.spin + k * Math.PI / 4;
          const len = R * (1.55 + 0.35 * Math.sin(clock * 18 + k));
          ctx.beginPath();
          ctx.moveTo(o.x + Math.cos(ang) * R * 1.05, o.y + Math.sin(ang) * R * 1.05);
          ctx.lineTo(o.x + Math.cos(ang) * len, o.y + Math.sin(ang) * len);
          ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      // Core
      const core = ctx.createRadialGradient(o.x - R * 0.3, o.y - R * 0.3, R * 0.05, o.x, o.y, R);
      core.addColorStop(0, '#ffffff');
      core.addColorStop(0.35, isBlue ? '#9fe0ff' : '#ff9a9a');
      core.addColorStop(1, isBlue ? '#1a4fe0' : '#c00018');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(o.x, o.y, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isBlue ? 'rgba(200,235,255,0.9)' : 'rgba(255,210,210,0.9)';
      ctx.lineWidth = Math.max(1, R * 0.1);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Hollow Purple and its screen flash sit above the arena and the balls
  function drawGojoFlash() {
    if (!purpleFx.length && gojoFlash <= 0 && voidFlash <= 0) return;
    // The trapped enemy, swamped by swirling information inside the void
    for (const b of balls) {
      if (!b.alive || b.type !== 'gojo' || b.voidPhase !== 'active') continue;
      const foe = foeOf(b);
      if (!foe.alive) continue;
      if (Math.hypot(foe.x - b.voidX, foe.y - b.voidY) > b.voidR) continue;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(foe.x, foe.y);
      ctx.rotate(clock * 5);
      ctx.strokeStyle = 'rgba(205,155,255,0.55)';
      ctx.lineWidth = Math.max(1.4, foe.r * 0.06);
      ctx.lineCap = 'round';
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        for (let j = 0; j <= 16; j++) {
          const t = j / 16;
          const a = k * Math.PI / 2 + t * 2.6;
          const rr = foe.r * (1.8 - t * 1.2);
          const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
          if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.save();
    for (const p of purpleFx) {
      const t = clamp(p.age / p.life, 0, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      const R = Math.max(arena.w, arena.h) * (0.1 + 0.8 * ease);
      const a = 1 - t;
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R);
      g.addColorStop(0, `rgba(255,255,255,${0.9 * a})`);
      g.addColorStop(0.16, `rgba(220,170,255,${0.8 * a})`);
      g.addColorStop(0.55, `rgba(140,60,255,${0.42 * a})`);
      g.addColorStop(1, 'rgba(90,24,154,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      for (let k = 0; k < 2; k++) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, R * (0.55 + k * 0.42), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(232,205,255,${0.75 * a})`;
        ctx.lineWidth = 6 * (1 - t) + 1;
        ctx.stroke();
      }
      // The purple sphere itself, shrinking as it spends its energy
      const coreR = Math.min(arena.w, arena.h) * 0.13 * (1 - t * 0.7);
      const cg = ctx.createRadialGradient(p.x, p.y, coreR * 0.1, p.x, p.y, coreR);
      cg.addColorStop(0, `rgba(255,255,255,${a})`);
      cg.addColorStop(0.45, `rgba(190,120,255,${a})`);
      cg.addColorStop(1, `rgba(70,10,140,${0.6 * a})`);
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(p.x, p.y, coreR, 0, Math.PI * 2);
      ctx.fill();
    }
    if (gojoFlash > 0) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(110,30,210,${0.3 * gojoFlash})`;
      ctx.fillRect(0, 0, W, H);
      if (gojoFlash > 0.8) {
        ctx.fillStyle = `rgba(255,255,255,${(gojoFlash - 0.8) * 2.6})`;
        ctx.fillRect(0, 0, W, H);
      }
      const ta = clamp(gojoFlash * 1.5, 0, 1);
      const pop = 1 + (1 - clamp((1 - gojoFlash) * 6, 0, 1)) * 0.25;
      const fs = clamp(W * 0.062, 28, 74) * pop;
      ctx.globalAlpha = ta;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `900 ${fs}px system-ui, -apple-system, sans-serif`;
      ctx.lineJoin = 'round';
      ctx.lineWidth = fs * 0.12;
      ctx.strokeStyle = 'rgba(40,0,80,0.9)';
      ctx.strokeText('HOLLOW PURPLE', W * 0.5, H * 0.42);
      ctx.shadowColor = 'rgba(190,120,255,1)';
      ctx.shadowBlur = 30;
      ctx.fillStyle = '#f4e8ff';
      ctx.fillText('HOLLOW PURPLE', W * 0.5, H * 0.42);
      ctx.shadowBlur = 0;
      ctx.font = `800 ${clamp(fs * 0.24, 11, 18)}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = 'rgba(225,200,255,0.9)';
      ctx.fillText('IMAGINARY TECHNIQUE', W * 0.5, H * 0.42 + fs * 0.62);
    }
    if (voidFlash > 0) {
      // The domain opens: a white-violet flash and the Domain Expansion title
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(70,24,150,${0.28 * voidFlash})`;
      ctx.fillRect(0, 0, W, H);
      if (voidFlash > 0.8) {
        ctx.fillStyle = `rgba(255,255,255,${(voidFlash - 0.8) * 3})`;
        ctx.fillRect(0, 0, W, H);
      }
      const ta = clamp(voidFlash * 1.6, 0, 1);
      const pop = 1 + (1 - clamp((1 - voidFlash) * 6, 0, 1)) * 0.22;
      const fs = clamp(W * 0.066, 30, 78) * pop;
      ctx.globalAlpha = ta;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `900 ${fs}px system-ui, -apple-system, sans-serif`;
      ctx.lineJoin = 'round';
      ctx.lineWidth = fs * 0.12;
      ctx.strokeStyle = 'rgba(30,4,70,0.92)';
      ctx.strokeText('UNLIMITED VOID', W * 0.5, H * 0.42);
      ctx.shadowColor = 'rgba(150,90,255,1)';
      ctx.shadowBlur = 34;
      ctx.fillStyle = '#f2e9ff';
      ctx.fillText('UNLIMITED VOID', W * 0.5, H * 0.42);
      ctx.shadowBlur = 0;
      ctx.font = `800 ${clamp(fs * 0.24, 11, 18)}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = 'rgba(216,196,255,0.92)';
      ctx.fillText('DOMAIN EXPANSION', W * 0.5, H * 0.42 + fs * 0.62);
    }
    ctx.restore();
  }

  /* ---------- Harpoon Ball ability (from Ball VS Ball) ----------
     Every 2.4 seconds Harpoon Ball throws a harpoon that travels across the
     whole arena, bouncing off walls until it hits something. When it hits the
     enemy, the harpoon drags the enemy back toward Harpoon Ball along the
     path it traveled, dealing 2 damage every 0.10-0.15 seconds. The drag
     ends when the enemy reaches Harpoon Ball at the end of the line.
     Harpoon Ball deals no contact damage. */

  const HARPOON_CD = 2.4;        // seconds between throws
  const HARPOON_TICK = 0.12;     // damage tick (Ball vs Ball: every 0.10-0.15s)
  const HARPOON_DMG = 2;         // damage per tick
  const HARPOON_SPEED = 760;     // harpoon flight speed
  const HARPOON_DRAG_SPEED = 420; // how fast the enemy is reeled in

  function throwHarpoon(b, foe, s) {
    const speed = HARPOON_SPEED * s;
    const a = leadAim(b, foe, speed);
    const sx = b.x + Math.cos(a) * b.r * 1.1;
    const sy = b.y + Math.sin(a) * b.r * 1.1;
    if (harpoonShots.length >= 3) harpoonShots.shift();
    harpoonShots.push({
      owner: b,
      x: sx, y: sy,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      rot: a,
      age: 0,
      // The line: throw point, then every wall bounce, then the hit point
      path: [{ x: sx, y: sy }]
    });
    sfx.knife();
    spawnSparks(sx, sy, TYPES.harpoon.accent, 6, 0.7);
  }

  function startHarpoonDrag(owner, target, shot) {
    // The enemy is reeled back along the path the harpoon traveled, from the
    // hit point all the way to the throw point (the end of the line).
    const pts = shot.path.slice();
    pts.push({ x: target.x, y: target.y });
    owner.harpoonDrag = {
      target,
      // walk the path backwards: hit point -> bounces -> throw point
      pts: pts.reverse(),
      seg: 0,
      dist: 0,
      tickTimer: 0
    };
    sfx.web();
    addShake(3.5);
    spawnSparks(target.x, target.y, TYPES.harpoon.accent, 12, 1.0);
  }

  function updateHarpoon(dt, s) {
    if (phase !== 'play') return;

    for (const b of balls) {
      b.harpoonCd = Math.max(0, b.harpoonCd - dt);
      if (!b.alive) continue;
      const foe = foeOf(b);

      // Throw a harpoon every 2.4 seconds
      if (b.type === 'harpoon' && foe.alive && b.harpoonCd <= 0) {
        b.harpoonCd = HARPOON_CD;
        throwHarpoon(b, foe, s);
      }

      // Reel the enemy in along the line
      const drag = b.harpoonDrag;
      if (drag) {
        const target = drag.target;
        // The end of the line is Harpoon Ball itself, wherever it is now
        drag.pts[drag.pts.length - 1] = { x: b.x, y: b.y };
        if (!target.alive || !b.alive || drag.seg >= drag.pts.length - 1) {
          b.harpoonDrag = null;
        } else {
          // Damage ticks while being dragged
          drag.tickTimer += dt;
          if (drag.tickTimer >= HARPOON_TICK) {
            drag.tickTimer = 0;
            spawnSparks(target.x, target.y, TYPES.harpoon.accent, 3, 0.6);
            applyDamage(target, HARPOON_DMG, target.x, target.y - target.r * 0.5,
              Math.random() * Math.PI * 2, TYPES.harpoon.accent, 0, -60, false);
            if (phase !== 'play') return;
          }
          // Move the enemy along the path toward the throw point
          let budget = HARPOON_DRAG_SPEED * s * dt;
          while (budget > 0 && drag.seg < drag.pts.length - 1) {
            const from = drag.pts[drag.seg];
            const to = drag.pts[drag.seg + 1];
            const dx = to.x - from.x, dy = to.y - from.y;
            const segLen = Math.hypot(dx, dy) || 1;
            const remain = segLen - drag.dist;
            if (budget < remain) {
              drag.dist += budget;
              target.x = from.x + (dx / segLen) * drag.dist;
              target.y = from.y + (dy / segLen) * drag.dist;
              budget = 0;
            } else {
              budget -= remain;
              drag.seg++;
              drag.dist = 0;
              target.x = to.x;
              target.y = to.y;
            }
          }
          // The enemy rides the line: it has no free velocity while dragged
          target.vx *= 0.2;
          target.vy *= 0.2;
          keepInArena(target, false);
          if (drag.seg >= drag.pts.length - 1) b.harpoonDrag = null;
        }
      }
    }

    // Harpoons in flight: bounce off walls, recording the line, until they hit
    for (let i = harpoonShots.length - 1; i >= 0; i--) {
      const h = harpoonShots[i];
      h.age += dt;
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.rot = Math.atan2(h.vy, h.vx);
      const hr = h.owner.r * 0.34;

      // Wall bounces extend the line
      if (h.x < arena.x + hr) { h.x = arena.x + hr; h.vx = Math.abs(h.vx); h.path.push({ x: h.x, y: h.y }); sfx.thunk(); spawnSparks(h.x, h.y, TYPES.harpoon.accent, 3, 0.5); }
      if (h.x > arena.x + arena.w - hr) { h.x = arena.x + arena.w - hr; h.vx = -Math.abs(h.vx); h.path.push({ x: h.x, y: h.y }); sfx.thunk(); spawnSparks(h.x, h.y, TYPES.harpoon.accent, 3, 0.5); }
      if (h.y < arena.y + hr) { h.y = arena.y + hr; h.vy = Math.abs(h.vy); h.path.push({ x: h.x, y: h.y }); sfx.thunk(); spawnSparks(h.x, h.y, TYPES.harpoon.accent, 3, 0.5); }
      if (h.y > arena.y + arena.h - hr) { h.y = arena.y + arena.h - hr; h.vy = -Math.abs(h.vy); h.path.push({ x: h.x, y: h.y }); sfx.thunk(); spawnSparks(h.x, h.y, TYPES.harpoon.accent, 3, 0.5); }

      const foe = foeOf(h.owner);
      if (foe.alive && Math.hypot(foe.x - h.x, foe.y - h.y) <= foe.r + hr) {
        harpoonShots.splice(i, 1);
        startHarpoonDrag(h.owner, foe, h);
        continue;
      }
      // A harpoon that flies too long without a catch is reeled back in
      if (h.age > 5) {
        spawnSparks(h.x, h.y, TYPES.harpoon.accent, 4, 0.5);
        harpoonShots.splice(i, 1);
      }
    }
  }

  function updateHarpoonVisuals(dt) {
    // Harpoon shots age inside updateHarpoon; nothing extra to tick here
  }

  function drawHarpoon() {
    // Harpoons in flight, with the line trailing behind them
    for (const h of harpoonShots) {
      const L = h.owner.r * 0.95;
      const w = Math.max(2.4, h.owner.r * 0.15);
      const ux = Math.cos(h.rot), uy = Math.sin(h.rot);
      const nx = -uy, ny = ux;
      ctx.save();
      ctx.lineCap = 'round';
      // The line back to Harpoon Ball
      ctx.beginPath();
      ctx.moveTo(h.owner.x, h.owner.y);
      for (const pt of h.path) ctx.lineTo(pt.x, pt.y);
      ctx.lineTo(h.x, h.y);
      ctx.strokeStyle = 'rgba(210,244,255,0.4)';
      ctx.lineWidth = Math.max(1.4, h.owner.r * 0.06);
      ctx.stroke();
      // Shaft
      ctx.beginPath();
      ctx.moveTo(h.x - ux * L, h.y - uy * L);
      ctx.lineTo(h.x + ux * L * 0.55, h.y + uy * L * 0.55);
      ctx.strokeStyle = 'rgba(4,26,34,0.95)';
      ctx.lineWidth = w + 2.6;
      ctx.stroke();
      ctx.strokeStyle = '#d2f4ff';
      ctx.lineWidth = w;
      ctx.stroke();
      // Toggle barb head
      const tipx = h.x + ux * L * 1.05, tipy = h.y + uy * L * 1.05;
      ctx.beginPath();
      ctx.moveTo(tipx, tipy);
      ctx.lineTo(h.x + ux * L * 0.3 + nx * w * 2.4, h.y + uy * L * 0.3 + ny * w * 2.4);
      ctx.lineTo(h.x + ux * L * 0.52, h.y + uy * L * 0.52);
      ctx.lineTo(h.x + ux * L * 0.3 - nx * w * 2.4, h.y + uy * L * 0.3 - ny * w * 2.4);
      ctx.closePath();
      ctx.fillStyle = '#e8fbff';
      ctx.fill();
      ctx.strokeStyle = 'rgba(4,26,34,0.9)';
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.restore();
    }

    // The drag line: from Harpoon Ball to the enemy being reeled in
    for (const b of balls) {
      const drag = b.harpoonDrag;
      if (!drag || !drag.target.alive) continue;
      const t = drag.target;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      // follow the remaining path so the line hugs the route
      for (let i = drag.seg; i < drag.pts.length; i++) ctx.lineTo(drag.pts[i].x, drag.pts[i].y);
      ctx.lineTo(t.x, t.y);
      ctx.strokeStyle = 'rgba(210,244,255,0.55)';
      ctx.lineWidth = Math.max(2, b.r * 0.08);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = Math.max(1, b.r * 0.03);
      ctx.stroke();
      // Harpoon head buried in the enemy
      const ang = Math.atan2(t.y - b.y, t.x - b.x);
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(ang);
      ctx.fillStyle = '#e8fbff';
      ctx.shadowColor = 'rgba(120,224,255,0.9)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(t.r * 0.7, 0);
      ctx.lineTo(-t.r * 0.3, -t.r * 0.3);
      ctx.lineTo(-t.r * 0.1, 0);
      ctx.lineTo(-t.r * 0.3, t.r * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.restore();
    }
  }


  /* ---------- Beam / Spear / Reforge abilities (from Ball VS Ball) ---------- */

  // Beam Ball (wiki): 0.5s before it starts charging, charges 2.5s, fires a
  // tracking beam for 2s at 3 damage per tick (up to 50), then 0.6s before it
  // charges again. Its turning speed is drastically reduced while firing.
  const BEAM_DELAY = 0.5, BEAM_CHARGE = 2.5, BEAM_FIRE = 2.0, BEAM_REST = 0.6;
  const BEAM_TICK = 0.12, BEAM_DMG = 3, BEAM_MAX = 50;
  const BEAM_TURN_CHARGE = 7.0, BEAM_TURN_FIRE = 0.55;
  const BEAM_CYAN = { r: 47, g: 232, b: 234 };

  // Spear Ball (wiki): a permanent spear on its side; gradually gains speed;
  // the spear deals 10 to any ball it hits.
  const SPEAR_DMG = 10;

  // Reforge Ball (wiki): the first wall touch spawns Blade (level 1, 3 contact
  // damage). Each time Blade touches Reforge it levels up, grows a little and
  // gains 2 damage. Blade is unaffected by damage and debuffs.
  const BLADE_BASE_DMG = 3, BLADE_DMG_PER_LVL = 2;
  const REFORGE_GOLD = { r: 255, g: 226, b: 90 };

  function beamRayEnd(x, y, ang) {
    // Distance from (x,y) along ang to the arena boundary
    const dx = Math.cos(ang), dy = Math.sin(ang);
    let t = Infinity;
    if (dx > 1e-6) t = Math.min(t, (arena.x + arena.w - x) / dx);
    if (dx < -1e-6) t = Math.min(t, (arena.x - x) / dx);
    if (dy > 1e-6) t = Math.min(t, (arena.y + arena.h - y) / dy);
    if (dy < -1e-6) t = Math.min(t, (arena.y - y) / dy);
    if (!Number.isFinite(t)) t = Math.max(arena.w, arena.h);
    return { x: x + dx * t, y: y + dy * t, len: t };
  }

  function spearGeom(b) {
    const a = b.facing;
    const len = b.r * 2.35;
    return {
      a,
      sx: b.x + Math.cos(a) * b.r * 0.9,
      sy: b.y + Math.sin(a) * b.r * 0.9,
      ex: b.x + Math.cos(a) * len,
      ey: b.y + Math.sin(a) * len
    };
  }

  function bladeRadius(owner, level) {
    return owner.r * Math.min(0.78, 0.4 + (level - 1) * 0.022);
  }

  function reforgeWallHit(b, wx, wy) {
    if (b.reforgeSpawned) return;
    b.reforgeSpawned = true;
    const inward = Math.atan2((arena.y + arena.h * 0.5) - wy, (arena.x + arena.w * 0.5) - wx) + (Math.random() - 0.5) * 0.9;
    const r0 = bladeRadius(b, 1);
    const sp = LAUNCH_SPEED * 0.82;
    reforgeBlades.push({
      owner: b, level: 1, r: r0,
      x: clamp(wx + Math.cos(inward) * (r0 + 4), arena.x + r0, arena.x + arena.w - r0),
      y: clamp(wy + Math.sin(inward) * (r0 + 4), arena.y + r0, arena.y + arena.h - r0),
      vx: Math.cos(inward) * sp, vy: Math.sin(inward) * sp,
      hitCd: 0, forgeCd: 0.4, flash: 1, spin: Math.random() * Math.PI * 2
    });
    sfx.forge();
    addShake(2.5);
    spawnSparks(wx, wy, REFORGE_GOLD, 12, 1.0);
    impactRings.push({ x: wx, y: wy, age: 0, life: 0.4, radius: b.r * 1.2, color: REFORGE_GOLD });
  }

  function updateBvbTrio(dt, s) {
    if (phase !== 'play') return;

    for (const b of balls) {
      b.spearHitCd = Math.max(0, b.spearHitCd - dt);
      if (!b.alive) continue;
      const foe = foeOf(b);

      /* ---- Beam Ball ---- */
      if (b.type === 'beam') {
        const want = foe.alive ? Math.atan2(foe.y - b.y, foe.x - b.x) : b.beamAngle;
        const turn = b.beamState === 'fire' ? BEAM_TURN_FIRE : BEAM_TURN_CHARGE;
        const diff = Math.atan2(Math.sin(want - b.beamAngle), Math.cos(want - b.beamAngle));
        b.beamAngle += clamp(diff, -turn * dt, turn * dt);
        b.beamT += dt;
        if (b.beamState === 'delay' && b.beamT >= BEAM_DELAY) { b.beamState = 'charge'; b.beamT = 0; }
        else if (b.beamState === 'charge') {
          if (b.beamT >= BEAM_CHARGE) {
            b.beamState = 'fire'; b.beamT = 0; b.beamTick = 0; b.beamDealt = 0;
            sfx.laserZap();
            addShake(3);
          }
        } else if (b.beamState === 'fire') {
          if (b.beamT >= BEAM_FIRE) { b.beamState = 'rest'; b.beamT = 0; }
          else {
            b.beamTick += dt;
            if (b.beamTick >= BEAM_TICK && foe.alive && b.beamDealt < BEAM_MAX) {
              b.beamTick = 0;
              const mx = b.x + Math.cos(b.beamAngle) * b.r * 1.1;
              const my = b.y + Math.sin(b.beamAngle) * b.r * 1.1;
              const end = beamRayEnd(mx, my, b.beamAngle);
              const hit = closestPointOnSegment(foe.x, foe.y, mx, my, end.x, end.y);
              if (hit.dist <= foe.r + b.r * 0.16) {
                b.beamDealt += BEAM_DMG;
                spawnSparks(hit.x, hit.y, BEAM_CYAN, 3, 0.7);
                applyDamage(foe, BEAM_DMG, foe.x, foe.y - foe.r * 0.55, b.beamAngle, BEAM_CYAN, (Math.random() - 0.5) * 20, -62, false);
                if (phase !== 'play') return;
              }
            }
          }
        } else if (b.beamState === 'rest' && b.beamT >= BEAM_REST) { b.beamState = 'charge'; b.beamT = 0; }
      }

      /* ---- Spear Ball ---- */
      if (b.type === 'spear') {
        // Gradually gains speed over the round
        b.spearBoost = Math.min(1, b.spearBoost + dt / 14);
        const sp = Math.hypot(b.vx, b.vy);
        const floor = LAUNCH_SPEED * (0.85 + b.spearBoost * 0.75);
        if (sp > 0.01 && sp < floor && b.freezeTimer <= 0 && !latch) {
          const k = Math.min(floor / sp, 1 + dt * 1.6);
          b.vx *= k; b.vy *= k;
        }
        if (foe.alive && b.spearHitCd <= 0) {
          const g = spearGeom(b);
          const hit = closestPointOnSegment(foe.x, foe.y, g.sx, g.sy, g.ex, g.ey);
          if (hit.dist <= foe.r + b.r * 0.1) {
            b.spearHitCd = 0.55;
            if (!latch) {
              foe.vx += Math.cos(g.a) * 380;
              foe.vy += Math.sin(g.a) * 380;
            }
            sfx.knifeHit();
            addShake(5);
            hitStop = Math.max(hitStop, 0.03);
            spawnSparks(g.ex, g.ey, STEEL, 10, 1.1);
            spawnSparks(g.ex, g.ey, TYPES.spear.accent, 5, 0.9);
            impactRings.push({ x: g.ex, y: g.ey, age: 0, life: 0.35, radius: foe.r * 0.9, color: STEEL });
            applyDamage(foe, SPEAR_DMG, hit.x, hit.y - 6, g.a, TYPES.spear.accent, Math.cos(g.a) * 40, -80, true);
            if (phase !== 'play') return;
          }
        }
      }
    }

    /* ---- Reforge Blade ---- */
    for (const bl of reforgeBlades) {
      bl.hitCd = Math.max(0, bl.hitCd - dt);
      bl.forgeCd = Math.max(0, bl.forgeCd - dt);
      bl.flash = Math.max(0, bl.flash - dt * 2.5);
      bl.spin += dt * 3;
      bl.x += bl.vx * s * dt;
      bl.y += bl.vy * s * dt;
      // Bounce off the walls
      if (bl.x < arena.x + bl.r) { bl.x = arena.x + bl.r; bl.vx = Math.abs(bl.vx); }
      if (bl.x > arena.x + arena.w - bl.r) { bl.x = arena.x + arena.w - bl.r; bl.vx = -Math.abs(bl.vx); }
      if (bl.y < arena.y + bl.r) { bl.y = arena.y + bl.r; bl.vy = Math.abs(bl.vy); }
      if (bl.y > arena.y + arena.h - bl.r) { bl.y = arena.y + arena.h - bl.r; bl.vy = -Math.abs(bl.vy); }
      // Keep a steady pace
      const sp = Math.hypot(bl.vx, bl.vy) || 1;
      const want = LAUNCH_SPEED * 0.82;
      bl.vx *= want / sp; bl.vy *= want / sp;

      const owner = bl.owner;
      const foe = foeOf(owner);
      // Touching Reforge Ball: reforged, grows a little, +1 level
      if (owner.alive) {
        const d = Math.hypot(owner.x - bl.x, owner.y - bl.y);
        if (d <= owner.r + bl.r) {
          const nx = (bl.x - owner.x) / (d || 1), ny = (bl.y - owner.y) / (d || 1);
          bl.x = owner.x + nx * (owner.r + bl.r + 0.5);
          bl.y = owner.y + ny * (owner.r + bl.r + 0.5);
          const vn = bl.vx * nx + bl.vy * ny;
          if (vn < 0) { bl.vx -= 2 * vn * nx; bl.vy -= 2 * vn * ny; }
          if (bl.forgeCd <= 0) {
            bl.forgeCd = 0.45;
            bl.level += 1;
            bl.r = bladeRadius(owner, bl.level);
            bl.flash = 1;
            owner.morphPulse = 1;
            sfx.forge();
            addShake(2);
            spawnSparks(bl.x, bl.y, REFORGE_GOLD, 10, 0.9);
            spawnPopup(bl.x, bl.y - bl.r - 6, 'LV ' + bl.level, REFORGE_GOLD, 0, -58, false);
          }
        }
      }
      // Touching the enemy: contact damage 3 + 2 per level
      if (foe.alive) {
        const d = Math.hypot(foe.x - bl.x, foe.y - bl.y);
        if (d <= foe.r + bl.r) {
          const nx = (bl.x - foe.x) / (d || 1), ny = (bl.y - foe.y) / (d || 1);
          bl.x = foe.x + nx * (foe.r + bl.r + 0.5);
          bl.y = foe.y + ny * (foe.r + bl.r + 0.5);
          const vn = bl.vx * nx + bl.vy * ny;
          if (vn < 0) { bl.vx -= 2 * vn * nx; bl.vy -= 2 * vn * ny; }
          if (bl.hitCd <= 0) {
            bl.hitCd = 0.5;
            const dmg = BLADE_BASE_DMG + BLADE_DMG_PER_LVL * (bl.level - 1);
            if (!latch) { foe.vx -= nx * 140; foe.vy -= ny * 140; }
            sfx.slash();
            addShake(2 + Math.min(5, bl.level * 0.4));
            spawnSparks(bl.x - nx * bl.r, bl.y - ny * bl.r, STEEL, 8, 0.9);
            applyDamage(foe, dmg, foe.x, foe.y - foe.r * 0.55, Math.atan2(-ny, -nx), REFORGE_GOLD, -nx * 30, -74, dmg >= 11);
            if (phase !== 'play') return;
          }
        }
      }
    }
  }

  function drawBvbTrio() {
    // Beam Ball: charge glow and the firing beam
    for (const b of balls) {
      if (b.type !== 'beam' || !b.alive) continue;
      const mx = b.x + Math.cos(b.beamAngle) * b.r * 1.14;
      const my = b.y + Math.sin(b.beamAngle) * b.r * 1.14;
      if (b.beamState === 'charge' && phase === 'play') {
        const t = clamp(b.beamT / BEAM_CHARGE, 0, 1);
        // Faint targeting line that sharpens as the charge completes
        const end = beamRayEnd(mx, my, b.beamAngle);
        ctx.save();
        ctx.setLineDash([6, 10]);
        ctx.strokeStyle = `rgba(47,232,234,${0.08 + t * 0.3})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        ctx.setLineDash([]);
        // Gathering energy motes
        for (let i = 0; i < 6; i++) {
          const a = clock * 4 + i * 1.047;
          const rr = b.r * (0.9 - t * 0.55) * (0.6 + 0.4 * Math.sin(clock * 7 + i));
          ctx.fillStyle = `rgba(170,255,255,${0.3 + t * 0.6})`;
          ctx.beginPath();
          ctx.arc(mx + Math.cos(a) * rr, my + Math.sin(a) * rr, 1.6 + t * 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      if (b.beamState === 'fire' && phase === 'play') {
        const end = beamRayEnd(mx, my, b.beamAngle);
        const fade = b.beamT < 0.12 ? b.beamT / 0.12 : (b.beamT > BEAM_FIRE - 0.2 ? (BEAM_FIRE - b.beamT) / 0.2 : 1);
        const w = b.r * 0.34 * fade;
        const flick = 0.85 + Math.sin(clock * 40) * 0.15;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.shadowColor = 'rgba(47,232,234,0.95)';
        ctx.shadowBlur = b.r * 0.8;
        ctx.strokeStyle = `rgba(28,168,184,${0.55 * fade})`;
        ctx.lineWidth = w * 2.4 * flick;
        ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(end.x, end.y); ctx.stroke();
        ctx.strokeStyle = `rgba(47,232,234,${0.95 * fade})`;
        ctx.lineWidth = w * 1.4 * flick;
        ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(end.x, end.y); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = `rgba(239,255,255,${fade})`;
        ctx.lineWidth = w * 0.55;
        ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(end.x, end.y); ctx.stroke();
        // Impact bloom at the wall
        const bloom = ctx.createRadialGradient(end.x, end.y, 0, end.x, end.y, b.r * 0.9);
        bloom.addColorStop(0, `rgba(239,255,255,${0.9 * fade})`);
        bloom.addColorStop(0.4, `rgba(47,232,234,${0.5 * fade})`);
        bloom.addColorStop(1, 'rgba(47,232,234,0)');
        ctx.fillStyle = bloom;
        ctx.beginPath(); ctx.arc(end.x, end.y, b.r * 0.9, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }

    // Reforge Blade: a smaller yellow ball with a blade symbol and its level
    for (const bl of reforgeBlades) {
      drawBallModel({
        x: bl.x, y: bl.y, r: bl.r, type: 'reforge',
        color: TYPES.reforge.color, dark: TYPES.reforge.dark, accent: TYPES.reforge.accent, glow: TYPES.reforge.glow,
        facing: bl.spin, hit: bl.flash * 0.6, hitAngle: bl.spin, healPulse: 0, morphPulse: bl.flash,
        bladeCount: 0, bladeAngle: 0, side: bl.owner.side, isMini: true, isLatched: false,
        dashActive: false, frozen: false, health: undefined, reforgeBlade: true
      });
      const fs = clamp(bl.r * 0.6, 9, 14);
      ctx.save();
      ctx.font = `900 ${fs}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(2.5, fs * 0.22);
      ctx.strokeStyle = 'rgba(5,7,14,0.92)';
      ctx.fillStyle = '#fff6b0';
      const ly = bl.y - bl.r - fs * 0.75;
      ctx.strokeText('LV' + bl.level, bl.x, ly);
      ctx.fillText('LV' + bl.level, bl.x, ly);
      ctx.restore();
    }
  }

  /* ---------- unique aim arrows for Beam, Spear and Reforge ---------- */

  function arrowFrame(b, push) {
    const r = b.r;
    const bob = Math.sin(clock * 5.2) * r * 0.06;
    const x0 = r * 1.3 + bob + push;
    const reach = Math.min(r * 3.35, arena.w * 0.34, arena.h * 0.44);
    const k = clamp((reach - r * 1.3) / (r * 2.05), 0.52, 1);
    const shaftLen = r * 1.26 * k;
    const headLen = r * 1.0 * k;
    const thick = Math.sqrt(k);
    return { r, x0, shaftLen, headLen, sw: r * 0.2 * thick, hw: r * 0.58 * thick, x1: x0 + shaftLen, tip: x0 + shaftLen + headLen };
  }

  function drawBeamArrow(b, alpha, push) {
    // An energy emitter: boxy turquoise housing with the zig-zag cyan circuit,
    // a white muzzle, and a flaring beam-burst head
    const { r, x0, shaftLen, headLen, sw, hw, x1, tip } = arrowFrame(b, push);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.globalAlpha = alpha;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // Housing
    ctx.save();
    ctx.shadowColor = 'rgba(47,232,234,0.7)';
    ctx.shadowBlur = r * 0.45;
    roundedRect(x0, -sw * 1.7, shaftLen, sw * 3.4, sw * 0.6);
    const hg = ctx.createLinearGradient(0, -sw * 1.7, 0, sw * 1.7);
    hg.addColorStop(0, '#aaffff');
    hg.addColorStop(0.4, '#1ca8b8');
    hg.addColorStop(1, '#154f55');
    ctx.fillStyle = hg;
    ctx.fill();
    ctx.restore();
    roundedRect(x0, -sw * 1.7, shaftLen, sw * 3.4, sw * 0.6);
    ctx.strokeStyle = 'rgba(6,30,34,0.9)';
    ctx.lineWidth = Math.max(1.3, r * 0.05);
    ctx.stroke();
    // Zig-zag circuit along the housing
    ctx.save();
    ctx.lineJoin = 'miter';
    ctx.lineCap = 'butt';
    ctx.strokeStyle = `rgba(170,255,255,${0.75 + Math.sin(clock * 6) * 0.25})`;
    ctx.shadowColor = 'rgba(47,232,234,1)';
    ctx.shadowBlur = r * 0.25;
    ctx.lineWidth = Math.max(1.3, r * 0.06);
    ctx.beginPath();
    const n = 5, step = shaftLen / n, amp = sw * 0.75;
    ctx.moveTo(x0 + r * 0.04, amp);
    for (let i = 0; i < n; i++) {
      const px = x0 + step * (i + 0.5);
      ctx.lineTo(px, i % 2 ? amp : -amp);
      ctx.lineTo(px + step * 0.5, i % 2 ? amp : -amp);
    }
    ctx.stroke();
    ctx.restore();
    // White muzzle
    roundedRect(x1 - r * 0.06, -sw * 2.1, r * 0.3, sw * 4.2, sw * 0.5);
    const mg = ctx.createLinearGradient(0, -sw * 2, 0, sw * 2);
    mg.addColorStop(0, '#ffffff');
    mg.addColorStop(0.55, '#e6eaf0');
    mg.addColorStop(1, '#9aa4b2');
    ctx.fillStyle = mg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(6,30,34,0.9)';
    ctx.lineWidth = Math.max(1.2, r * 0.045);
    ctx.stroke();
    // Beam-burst head: cyan chevron with radiating rays
    ctx.save();
    ctx.shadowColor = 'rgba(170,255,255,0.95)';
    ctx.shadowBlur = r * 0.5;
    ctx.beginPath();
    ctx.moveTo(x1 + r * 0.2, -hw * 1.05);
    ctx.lineTo(tip, 0);
    ctx.lineTo(x1 + r * 0.2, hw * 1.05);
    ctx.lineTo(x1 + r * 0.2 + headLen * 0.3, 0);
    ctx.closePath();
    const bg = ctx.createLinearGradient(x1, 0, tip, 0);
    bg.addColorStop(0, '#2fe8ea');
    bg.addColorStop(1, '#efffff');
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(6,30,34,0.85)';
    ctx.lineWidth = Math.max(1.2, r * 0.045);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = `rgba(239,255,255,${0.6 + Math.sin(clock * 9) * 0.3})`;
    ctx.lineWidth = Math.max(1, r * 0.035);
    for (const d of [-0.5, 0, 0.5]) {
      ctx.beginPath();
      ctx.moveTo(tip + r * 0.05, d * hw * 0.35);
      ctx.lineTo(tip + r * 0.32, d * hw * 0.9);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSpearArrow(b, alpha, push) {
    // A long iron spear: wooden shaft, neon-green binding, leaf-shaped iron head
    const { r, x0, shaftLen, headLen, sw, hw, x1, tip } = arrowFrame(b, push);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.globalAlpha = alpha;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // Butt cap
    roundedRect(x0 - r * 0.12, -sw * 0.95, r * 0.16, sw * 1.9, sw * 0.3);
    ctx.fillStyle = '#6a6e79';
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,22,30,0.9)';
    ctx.lineWidth = Math.max(1, r * 0.04);
    ctx.stroke();
    // Wooden shaft
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = r * 0.25;
    roundedRect(x0, -sw * 0.72, shaftLen + r * 0.1, sw * 1.44, sw * 0.7);
    const wg = ctx.createLinearGradient(0, -sw, 0, sw);
    wg.addColorStop(0, '#b0836a');
    wg.addColorStop(0.5, '#855b48');
    wg.addColorStop(1, '#4a2e22');
    ctx.fillStyle = wg;
    ctx.fill();
    ctx.restore();
    roundedRect(x0, -sw * 0.72, shaftLen + r * 0.1, sw * 1.44, sw * 0.7);
    ctx.strokeStyle = 'rgba(30,18,10,0.9)';
    ctx.lineWidth = Math.max(1, r * 0.04);
    ctx.stroke();
    // Neon-green binding wraps
    ctx.save();
    ctx.shadowColor = 'rgba(148,254,3,0.9)';
    ctx.shadowBlur = r * 0.3;
    ctx.fillStyle = '#94fe03';
    for (let i = 0; i < 3; i++) ctx.fillRect(x1 - r * 0.34 + i * r * 0.11, -sw * 1.05, r * 0.065, sw * 2.1);
    ctx.restore();
    // Iron leaf head
    const head = () => {
      ctx.beginPath();
      ctx.moveTo(x1, 0);
      ctx.quadraticCurveTo(x1 + headLen * 0.3, -hw * 0.95, x1 + headLen * 0.55, -hw * 0.62);
      ctx.lineTo(tip + r * 0.08, 0);
      ctx.lineTo(x1 + headLen * 0.55, hw * 0.62);
      ctx.quadraticCurveTo(x1 + headLen * 0.3, hw * 0.95, x1, 0);
      ctx.closePath();
    };
    ctx.save();
    ctx.shadowColor = 'rgba(216,221,230,0.7)';
    ctx.shadowBlur = r * 0.35;
    head();
    const ig = ctx.createLinearGradient(0, -hw, 0, hw);
    ig.addColorStop(0, '#ffffff');
    ig.addColorStop(0.45, '#d8dde6');
    ig.addColorStop(1, '#4e525e');
    ctx.fillStyle = ig;
    ctx.fill();
    ctx.restore();
    head();
    ctx.strokeStyle = 'rgba(20,22,30,0.9)';
    ctx.lineWidth = Math.max(1.3, r * 0.05);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(1, r * 0.035);
    ctx.beginPath();
    ctx.moveTo(x1 + headLen * 0.1, 0);
    ctx.lineTo(tip, 0);
    ctx.stroke();
    ctx.restore();
  }

  function drawReforgeArrow(b, alpha, push) {
    // A smith's hammer: wooden handle, iron head with a golden spark,
    // and a forged blade tip pointing the way
    const { r, x0, shaftLen, headLen, sw, hw, x1, tip } = arrowFrame(b, push);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.globalAlpha = alpha;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // Handle
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = r * 0.25;
    roundedRect(x0, -sw * 0.8, shaftLen, sw * 1.6, sw * 0.6);
    const wg = ctx.createLinearGradient(0, -sw, 0, sw);
    wg.addColorStop(0, '#9c6a4e');
    wg.addColorStop(0.5, '#6d3d28');
    wg.addColorStop(1, '#3a1d12');
    ctx.fillStyle = wg;
    ctx.fill();
    ctx.restore();
    roundedRect(x0, -sw * 0.8, shaftLen, sw * 1.6, sw * 0.6);
    ctx.strokeStyle = 'rgba(30,14,6,0.9)';
    ctx.lineWidth = Math.max(1, r * 0.04);
    ctx.stroke();
    // Gold grip rings
    ctx.fillStyle = '#eccf21';
    for (let i = 0; i < 2; i++) ctx.fillRect(x0 + r * 0.16 + i * r * 0.18, -sw * 1.0, r * 0.07, sw * 2);
    // Iron hammer head (crosswise)
    const headW = r * 0.34, headH = hw * 2.3;
    ctx.save();
    ctx.shadowColor = 'rgba(236,207,33,0.6)';
    ctx.shadowBlur = r * 0.4;
    roundedRect(x1 - headW * 0.7, -headH * 0.5, headW, headH, r * 0.06);
    const ig = ctx.createLinearGradient(0, -headH * 0.5, 0, headH * 0.5);
    ig.addColorStop(0, '#ffffff');
    ig.addColorStop(0.45, '#e7ebf0');
    ig.addColorStop(1, '#5c5e77');
    ctx.fillStyle = ig;
    ctx.fill();
    ctx.restore();
    roundedRect(x1 - headW * 0.7, -headH * 0.5, headW, headH, r * 0.06);
    ctx.strokeStyle = 'rgba(20,22,30,0.9)';
    ctx.lineWidth = Math.max(1.3, r * 0.05);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(x1 - headW * 0.6, -headH * 0.46, headW * 0.8, headH * 0.1);
    // Forged blade tip
    const blade = () => {
      ctx.beginPath();
      ctx.moveTo(x1 + headW * 0.3, -hw * 0.42);
      ctx.lineTo(x1 + headW * 0.3 + headLen * 0.6, -hw * 0.3);
      ctx.lineTo(tip + r * 0.05, 0);
      ctx.lineTo(x1 + headW * 0.3 + headLen * 0.6, hw * 0.3);
      ctx.lineTo(x1 + headW * 0.3, hw * 0.42);
      ctx.closePath();
    };
    blade();
    const bg = ctx.createLinearGradient(0, -hw * 0.4, 0, hw * 0.4);
    bg.addColorStop(0, '#ffffff');
    bg.addColorStop(0.5, '#d8dde6');
    bg.addColorStop(1, '#5c5e77');
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,22,30,0.9)';
    ctx.lineWidth = Math.max(1.2, r * 0.045);
    ctx.stroke();
    // Golden forge sparks off the hammer face
    const sp = (clock * 3) % 1;
    ctx.fillStyle = `rgba(255,226,90,${1 - sp})`;
    for (let i = 0; i < 4; i++) {
      const a = -0.9 + i * 0.6;
      const d = r * (0.1 + sp * 0.5);
      ctx.beginPath();
      ctx.arc(x1 + headW * 0.3 + Math.cos(a) * d, Math.sin(a) * d * 1.4 - hw * 0.5, Math.max(1, r * 0.04), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ---------- unique aim arrows for Chess, Verity, Cactus, Range and Electro King ---------- */

  function drawChessArrow(b, alpha, push) {
    // Checkered shaft ending in a bishop's mitre with a diagonal slit
    const { r, x0, shaftLen, headLen, sw, hw, x1, tip } = arrowFrame(b, push);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.globalAlpha = alpha;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const sh = sw * 1.1;
    const cells = 6;
    const cw = shaftLen / cells;
    ctx.save();
    roundedRect(x0, -sh, shaftLen, sh * 2, sh * 0.4);
    ctx.clip();
    for (let i = 0; i < cells; i++) {
      for (let j = 0; j < 2; j++) {
        ctx.fillStyle = ((i + j) & 1) ? '#eceff4' : '#181d26';
        ctx.fillRect(x0 + i * cw, -sh + j * sh, cw + 0.5, sh + 0.5);
      }
    }
    ctx.restore();
    roundedRect(x0, -sh, shaftLen, sh * 2, sh * 0.4);
    ctx.strokeStyle = 'rgba(6,8,12,0.95)';
    ctx.lineWidth = Math.max(1.2, r * 0.05);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x1, -hw * 0.85);
    ctx.quadraticCurveTo(x1 + headLen * 0.55, -hw * 1.1, tip, 0);
    ctx.quadraticCurveTo(x1 + headLen * 0.55, hw * 1.1, x1, hw * 0.85);
    ctx.closePath();
    const hg = ctx.createLinearGradient(0, -hw, 0, hw);
    hg.addColorStop(0, '#ffffff');
    hg.addColorStop(0.5, '#eceff4');
    hg.addColorStop(1, '#4b5263');
    ctx.fillStyle = hg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(6,8,12,0.95)';
    ctx.lineWidth = Math.max(1.3, r * 0.05);
    ctx.stroke();
    ctx.strokeStyle = '#181d26';
    ctx.lineWidth = Math.max(1.4, r * 0.07);
    ctx.beginPath();
    ctx.moveTo(x1 + headLen * 0.2, -hw * 0.62);
    ctx.lineTo(x1 + headLen * 0.66, hw * 0.4);
    ctx.stroke();
    ctx.restore();
  }

  function drawVerityArrow(b, alpha, push) {
    // A chunky yellow shaft; the head changes colour and shape with each stage
    const { r, x0, shaftLen, headLen, sw, hw, x1, tip } = arrowFrame(b, push);
    const stage = b.verityStage || 1;
    const headCol = stage === 1 ? '#f1f33c' : stage === 2 ? '#ffb347' : '#e0263b';
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.globalAlpha = alpha;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    roundedRect(x0, -sw * 0.8, shaftLen, sw * 1.6, sw * 0.6);
    const sg = ctx.createLinearGradient(0, -sw, 0, sw);
    sg.addColorStop(0, '#ffffff');
    sg.addColorStop(0.35, '#f1f33c');
    sg.addColorStop(1, '#8f9318');
    ctx.fillStyle = sg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(21,25,35,0.95)';
    ctx.lineWidth = Math.max(1.3, r * 0.05);
    ctx.stroke();
    const pts = stage === 1
      ? [[x1, -hw], [tip, 0], [x1, hw]]
      : stage === 2
        ? [[x1, -hw], [x1 + headLen * 0.45, -hw * 0.75], [x1 + headLen * 0.55, -hw * 1.05], [tip, 0],
          [x1 + headLen * 0.55, hw * 1.05], [x1 + headLen * 0.45, hw * 0.75], [x1, hw]]
        : [[x1, -hw], [x1 + headLen * 0.3, -hw * 0.6], [x1 + headLen * 0.42, -hw * 0.98], [x1 + headLen * 0.6, -hw * 0.35],
          [tip, 0], [x1 + headLen * 0.6, hw * 0.35], [x1 + headLen * 0.42, hw * 0.98], [x1 + headLen * 0.3, hw * 0.6], [x1, hw]];
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    ctx.fillStyle = headCol;
    ctx.fill();
    ctx.strokeStyle = 'rgba(21,25,35,0.95)';
    ctx.lineWidth = Math.max(1.3, r * 0.05);
    ctx.stroke();
    ctx.restore();
  }

  function drawCactusArrow(b, alpha, push) {
    // A green cactus stalk with yellow spines, its head a pink flower
    const { r, x0, shaftLen, headLen, sw, hw, x1, tip } = arrowFrame(b, push);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.globalAlpha = alpha;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    roundedRect(x0, -sw * 0.9, shaftLen, sw * 1.8, sw * 0.9);
    const gg = ctx.createLinearGradient(0, -sw, 0, sw);
    gg.addColorStop(0, '#d8f5a0');
    gg.addColorStop(0.5, '#97cb46');
    gg.addColorStop(1, '#3e6e1c');
    ctx.fillStyle = gg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,40,10,0.95)';
    ctx.lineWidth = Math.max(1.2, r * 0.05);
    ctx.stroke();
    ctx.strokeStyle = '#eed128';
    ctx.lineWidth = Math.max(1.2, r * 0.05);
    for (let i = 0; i < 6; i++) {
      const px = x0 + shaftLen * (0.1 + i * 0.15);
      for (const sgn of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(px, sgn * sw * 0.85);
        ctx.lineTo(px + r * 0.05, sgn * sw * 1.5);
        ctx.stroke();
      }
    }
    const fcx = tip - headLen * 0.38;
    const pr = hw * 0.7;
    for (let i = 0; i < 5; i++) {
      ctx.save();
      ctx.translate(fcx, 0);
      ctx.rotate((i / 5) * Math.PI * 2 - Math.PI / 2);
      ctx.beginPath();
      ctx.ellipse(0, -pr * 0.55, pr * 0.42, pr * 0.6, 0, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 ? '#e665f1' : '#f8adfc';
      ctx.fill();
      ctx.strokeStyle = 'rgba(90,20,100,0.85)';
      ctx.lineWidth = Math.max(1, r * 0.035);
      ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(fcx, 0, pr * 0.32, 0, Math.PI * 2);
    ctx.fillStyle = '#a53bcf';
    ctx.fill();
    ctx.restore();
  }

  function drawRangeArrow(b, alpha, push) {
    // A thin yellow shaft ending in a rangefinder disc, with rings spreading out
    const { r, x0, shaftLen, headLen, sw, hw, x1, tip } = arrowFrame(b, push);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.globalAlpha = alpha;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    roundedRect(x0, -sw * 0.4, shaftLen, sw * 0.8, sw * 0.3);
    ctx.fillStyle = '#f2dc58';
    ctx.fill();
    ctx.strokeStyle = 'rgba(70,56,10,0.95)';
    ctx.lineWidth = Math.max(1, r * 0.04);
    ctx.stroke();
    const cx = tip - hw * 0.8;
    const ringR = hw * 0.95;
    for (let k = 0; k < 2; k++) {
      const ph = (clock * 1.3 + k * 0.5) % 1;
      ctx.beginPath();
      ctx.arc(cx, 0, ringR * (1 + ph * 0.9), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(242,220,88,${(1 - ph) * 0.7})`;
      ctx.lineWidth = Math.max(1, r * 0.045);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, 0, ringR, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(235,207,36,0.95)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(70,56,10,0.95)';
    ctx.lineWidth = Math.max(1.3, r * 0.05);
    ctx.stroke();
    ctx.strokeStyle = '#fff6c2';
    ctx.lineWidth = Math.max(1, r * 0.035);
    ctx.beginPath();
    ctx.moveTo(cx - ringR * 0.6, 0);
    ctx.lineTo(cx + ringR * 0.6, 0);
    ctx.moveTo(cx, -ringR * 0.6);
    ctx.lineTo(cx, ringR * 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, 0, ringR * 0.26, 0, Math.PI * 2);
    ctx.fillStyle = '#c7a45a';
    ctx.fill();
    ctx.restore();
  }

  function drawElectroArrow(b, alpha, push) {
    // A navy shaft crossed by two electric zigzags, ending in a jagged bolt
    const { r, x0, shaftLen, headLen, sw, hw, x1, tip } = arrowFrame(b, push);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.globalAlpha = alpha;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    roundedRect(x0, -sw * 0.8, shaftLen, sw * 1.6, sw * 0.5);
    const ng = ctx.createLinearGradient(0, -sw, 0, sw);
    ng.addColorStop(0, '#2c4a9a');
    ng.addColorStop(0.5, '#122563');
    ng.addColorStop(1, '#050c24');
    ctx.fillStyle = ng;
    ctx.fill();
    ctx.strokeStyle = 'rgba(2,6,18,0.95)';
    ctx.lineWidth = Math.max(1.2, r * 0.05);
    ctx.stroke();
    ctx.save();
    ctx.shadowColor = 'rgba(120,235,255,1)';
    ctx.shadowBlur = r * 0.3;
    ctx.strokeStyle = 'rgba(150,240,255,0.95)';
    ctx.lineWidth = Math.max(1.2, r * 0.05);
    ctx.lineJoin = 'miter';
    for (const off of [-1, 1]) {
      ctx.beginPath();
      const n = 6;
      for (let i = 0; i <= n; i++) {
        const xx = x0 + (shaftLen / n) * i;
        const yy = off * sw * (i % 2 ? 0.45 : -0.1) + Math.sin(clock * 20 + i * 1.7 + off) * sw * 0.05;
        if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
    }
    ctx.restore();
    const bolt = () => {
      ctx.beginPath();
      ctx.moveTo(x1, -hw);
      ctx.lineTo(x1 + headLen * 0.4, -hw * 0.45);
      ctx.lineTo(x1 + headLen * 0.26, -hw * 0.1);
      ctx.lineTo(tip, 0);
      ctx.lineTo(x1 + headLen * 0.26, hw * 0.1);
      ctx.lineTo(x1 + headLen * 0.4, hw * 0.45);
      ctx.lineTo(x1, hw);
      ctx.closePath();
    };
    ctx.save();
    ctx.shadowColor = 'rgba(120,235,255,0.95)';
    ctx.shadowBlur = r * 0.4;
    bolt();
    const bg = ctx.createLinearGradient(0, -hw, 0, hw);
    bg.addColorStop(0, '#ffffff');
    bg.addColorStop(0.45, '#7fe6ff');
    bg.addColorStop(1, '#1d5fbf');
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.restore();
    bolt();
    ctx.strokeStyle = 'rgba(2,6,18,0.95)';
    ctx.lineWidth = Math.max(1.3, r * 0.05);
    ctx.stroke();
    ctx.restore();
  }

  /* ---------- unique aim arrows for Acid, Big Spike, Cell, WDC and Hook (remade) ---------- */

  function drawAcidArrow(b, alpha, push) {
    // An Erlenmeyer flask: triangle body with bubbling green liquid, a narrow neck, a drip off the mouth
    const { r, x0, shaftLen, headLen, sw, hw, x1, tip } = arrowFrame(b, push);
    const neckL = shaftLen * 0.34;
    const bx = x0 + neckL;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.globalAlpha = alpha;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // Neck
    roundedRect(x0, -sw * 0.55, neckL, sw * 1.1, sw * 0.3);
    const ng = ctx.createLinearGradient(0, -sw, 0, sw);
    ng.addColorStop(0, 'rgba(228,255,184,0.95)');
    ng.addColorStop(1, 'rgba(101,203,31,0.75)');
    ctx.fillStyle = ng;
    ctx.fill();
    ctx.strokeStyle = 'rgba(10,32,4,0.9)';
    ctx.lineWidth = Math.max(1.2, r * 0.045);
    ctx.stroke();
    // Flask body
    const body = () => {
      ctx.beginPath();
      ctx.moveTo(bx, -sw * 0.55);
      ctx.lineTo(x1 + headLen * 0.1, -hw * 1.0);
      ctx.lineTo(x1 + headLen * 0.1, hw * 1.0);
      ctx.lineTo(bx, sw * 0.55);
      ctx.closePath();
    };
    ctx.save();
    ctx.shadowColor = 'rgba(150,235,70,0.7)';
    ctx.shadowBlur = r * 0.4;
    body();
    const fg = ctx.createLinearGradient(0, -hw, 0, hw);
    fg.addColorStop(0, 'rgba(228,255,184,0.9)');
    fg.addColorStop(0.5, 'rgba(142,230,58,0.85)');
    fg.addColorStop(1, 'rgba(44,106,12,0.9)');
    ctx.fillStyle = fg;
    ctx.fill();
    ctx.restore();
    body();
    ctx.strokeStyle = 'rgba(10,32,4,0.9)';
    ctx.lineWidth = Math.max(1.3, r * 0.05);
    ctx.stroke();
    // Liquid surface line with rising bubbles
    ctx.save();
    body();
    ctx.clip();
    ctx.strokeStyle = 'rgba(240,255,210,0.8)';
    ctx.lineWidth = Math.max(1.2, r * 0.05);
    ctx.beginPath();
    const ly = -hw * 0.25;
    ctx.moveTo(bx, ly);
    ctx.lineTo(x1 + headLen * 0.1, ly);
    ctx.stroke();
    ctx.fillStyle = 'rgba(240,255,210,0.7)';
    for (let i = 0; i < 4; i++) {
      const px = bx + shaftLen * (0.35 + i * 0.16);
      const py = hw * 0.7 - ((clock * r * 0.5 + i * r * 0.4) % (hw * 1.1));
      ctx.beginPath();
      ctx.arc(px, py, Math.max(1, r * 0.055), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Drip falling off the mouth
    const du = (clock * 1.6) % 1;
    ctx.fillStyle = `rgba(140,230,60,${1 - du})`;
    ctx.beginPath();
    ctx.ellipse(tip + r * 0.02, du * r * 0.7, r * 0.07, r * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBigSpikeArrow(b, alpha, push) {
    // A serrated spike behind a hazard-striped collar
    const { r, x0, shaftLen, headLen, sw, hw, x1, tip } = arrowFrame(b, push);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.globalAlpha = alpha;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // Collar with hazard stripes
    const cw = r * 0.42;
    roundedRect(x1 - cw, -sw * 1.3, cw, sw * 2.6, sw * 0.3);
    ctx.fillStyle = '#e6eaf0';
    ctx.fill();
    ctx.strokeStyle = 'rgba(8,10,16,0.92)';
    ctx.lineWidth = Math.max(1.2, r * 0.05);
    ctx.stroke();
    ctx.save();
    roundedRect(x1 - cw, -sw * 1.3, cw, sw * 2.6, sw * 0.3);
    ctx.clip();
    ctx.fillStyle = '#e8b10a';
    for (let i = -1; i < 4; i++) {
      const sx = x1 - cw + i * r * 0.22;
      ctx.beginPath();
      ctx.moveTo(sx, sw * 1.35);
      ctx.lineTo(sx + r * 0.11, sw * 1.35);
      ctx.lineTo(sx + r * 0.11 - sw * 0.9, -sw * 1.35);
      ctx.lineTo(sx - sw * 0.9, -sw * 1.35);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // Serrated spike head
    const teeth = 3;
    const head = () => {
      ctx.beginPath();
      ctx.moveTo(x1, -hw * 0.5);
      for (let i = 0; i < teeth; i++) {
        const t0 = i / teeth, t1 = (i + 0.5) / teeth;
        ctx.lineTo(x1 + headLen * t1, -hw * (0.5 + 0.55 * Math.sin(t1 * Math.PI)));
        ctx.lineTo(x1 + headLen * (t0 + 1 / teeth), -hw * 0.5);
      }
      ctx.lineTo(tip + r * 0.1, 0);
      for (let i = teeth - 1; i >= 0; i--) {
        const t0 = i / teeth, t1 = (i + 0.5) / teeth;
        ctx.lineTo(x1 + headLen * (t0 + 1 / teeth), hw * 0.5);
        ctx.lineTo(x1 + headLen * t1, hw * (0.5 + 0.55 * Math.sin(t1 * Math.PI)));
      }
      ctx.lineTo(x1, hw * 0.5);
      ctx.closePath();
    };
    ctx.save();
    ctx.shadowColor = 'rgba(220,230,245,0.65)';
    ctx.shadowBlur = r * 0.35;
    head();
    const hg = ctx.createLinearGradient(0, -hw, 0, hw);
    hg.addColorStop(0, '#ffffff');
    hg.addColorStop(0.5, '#d6dbe4');
    hg.addColorStop(1, '#5b6270');
    ctx.fillStyle = hg;
    ctx.fill();
    ctx.restore();
    head();
    ctx.strokeStyle = 'rgba(8,10,16,0.92)';
    ctx.lineWidth = Math.max(1.3, r * 0.05);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = Math.max(1, r * 0.04);
    ctx.beginPath();
    ctx.moveTo(x1 + headLen * 0.12, -hw * 0.3);
    ctx.lineTo(tip, 0);
    ctx.stroke();
    ctx.restore();
  }

  function drawCellArrow(b, alpha, push) {
    // A membrane pod with two nuclei and a division seam that tightens as it matures
    const { r, x0, shaftLen, headLen, sw, hw, x1, tip } = arrowFrame(b, push);
    const mat = b.cellMature ? 1 : clamp((b.cellT || 0) / 3, 0, 1);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.globalAlpha = alpha;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const pod = () => {
      ctx.beginPath();
      ctx.moveTo(x0, -sw * 1.05);
      ctx.quadraticCurveTo(x0 + shaftLen * 0.4, -sw * 1.6, x0 + shaftLen * 0.72, -sw * 0.9);
      ctx.quadraticCurveTo(x1 + headLen * 0.5, -sw * 0.4, tip + r * 0.06, 0);
      ctx.quadraticCurveTo(x1 + headLen * 0.5, sw * 0.4, x0 + shaftLen * 0.72, sw * 0.9);
      ctx.quadraticCurveTo(x0 + shaftLen * 0.4, sw * 1.6, x0, sw * 1.05);
      ctx.quadraticCurveTo(x0 - sw * 0.6, 0, x0, -sw * 1.05);
      ctx.closePath();
    };
    pod();
    const g = ctx.createLinearGradient(0, -hw, 0, hw);
    g.addColorStop(0, 'rgba(242,255,224,0.95)');
    g.addColorStop(0.5, 'rgba(191,224,135,0.9)');
    g.addColorStop(1, 'rgba(107,179,111,0.9)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#4e8f55';
    ctx.lineWidth = Math.max(2, r * 0.1);
    ctx.stroke();
    ctx.save();
    pod();
    ctx.clip();
    for (let i = 0; i < 2; i++) {
      const a = clock * 1.2 + i * Math.PI;
      const nx = x0 + shaftLen * 0.45 + Math.cos(a) * sw * 0.5;
      const ny = Math.sin(a) * sw * 0.55;
      ctx.beginPath();
      ctx.arc(nx, ny, Math.max(1.8, r * 0.12), 0, Math.PI * 2);
      ctx.fillStyle = '#deecbd';
      ctx.fill();
      ctx.strokeStyle = 'rgba(63,122,69,0.85)';
      ctx.lineWidth = Math.max(1, r * 0.03);
      ctx.stroke();
    }
    ctx.restore();
    // Division seam near the tip
    ctx.strokeStyle = `rgba(63,122,69,${0.4 + mat * 0.45})`;
    ctx.lineWidth = Math.max(1.4, r * 0.06);
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(x1 + headLen * (0.3 - mat * 0.12), -hw * 0.55);
    ctx.lineTo(x1 + headLen * (0.3 - mat * 0.12), hw * 0.55);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawWdcArrow(b, alpha, push) {
    // A circuit board with glowing traces, headed by the live cell-number tile
    const { r, x0, shaftLen, headLen, sw, hw, x1, tip } = arrowFrame(b, push);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.globalAlpha = alpha;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    roundedRect(x0, -sw * 1.15, shaftLen, sw * 2.3, sw * 0.4);
    const g = ctx.createLinearGradient(0, -sw * 1.2, 0, sw * 1.2);
    g.addColorStop(0, '#2c56c4');
    g.addColorStop(0.5, '#1349da');
    g.addColorStop(1, '#081d63');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(4,10,32,0.92)';
    ctx.lineWidth = Math.max(1.3, r * 0.05);
    ctx.stroke();
    // Traces with travelling pulses
    ctx.save();
    roundedRect(x0, -sw * 1.15, shaftLen, sw * 2.3, sw * 0.4);
    ctx.clip();
    ctx.strokeStyle = 'rgba(140,180,255,0.55)';
    ctx.lineWidth = Math.max(1, r * 0.04);
    for (const yy of [-0.6, 0, 0.6]) {
      ctx.beginPath();
      ctx.moveTo(x0, yy * sw);
      ctx.lineTo(x0 + shaftLen * 0.4, yy * sw);
      ctx.lineTo(x0 + shaftLen * 0.55, yy * sw * 0.3);
      ctx.lineTo(x1, yy * sw * 0.3);
      ctx.stroke();
      const pu = (clock * 0.9 + yy) % 1;
      ctx.fillStyle = 'rgba(220,235,255,0.95)';
      ctx.beginPath();
      ctx.arc(x0 + shaftLen * pu, yy * sw * (pu < 0.55 ? 1 : 0.3), Math.max(1.2, r * 0.05), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Number tile head
    const n = b.wdcOn && b.wdcLast ? String(b.wdcLast) : '?';
    const hx = x1 + headLen * 0.48;
    const hs = hw * 1.1;
    ctx.save();
    ctx.shadowColor = 'rgba(120,170,255,0.9)';
    ctx.shadowBlur = r * 0.4;
    roundedRect(hx - hs, -hs, hs * 2, hs * 2, hs * 0.3);
    ctx.fillStyle = '#f3f5f9';
    ctx.fill();
    ctx.restore();
    roundedRect(hx - hs, -hs, hs * 2, hs * 2, hs * 0.3);
    ctx.strokeStyle = 'rgba(4,10,32,0.92)';
    ctx.lineWidth = Math.max(1.3, r * 0.05);
    ctx.stroke();
    ctx.font = `900 ${clamp(hs * 1.05, 8, 20)}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1349da';
    ctx.fillText(n, hx, hs * 0.04);
    ctx.beginPath();
    ctx.moveTo(hx + hs, -hw * 0.45);
    ctx.lineTo(tip + r * 0.1, 0);
    ctx.lineTo(hx + hs, hw * 0.45);
    ctx.closePath();
    ctx.fillStyle = '#f3f5f9';
    ctx.fill();
    ctx.strokeStyle = 'rgba(4,10,32,0.92)';
    ctx.lineWidth = Math.max(1.2, r * 0.045);
    ctx.stroke();
    ctx.restore();
  }

  function drawHookArrow(b, alpha, push) {
    // Interlocking chain links ending in a broad anchor fluke
    const { r, x0, shaftLen, headLen, sw, hw, x1, tip } = arrowFrame(b, push);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.globalAlpha = alpha;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // Chain links
    const linkL = r * 0.3, linkW = sw * 1.15;
    const n = Math.max(3, Math.floor(shaftLen / (linkL * 0.8)));
    for (let i = 0; i < n; i++) {
      const lx = x0 + r * 0.05 + i * linkL * 0.8;
      ctx.save();
      ctx.translate(lx + linkL / 2, 0);
      ctx.rotate(i % 2 ? Math.PI / 2 : 0);
      ctx.beginPath();
      ctx.ellipse(0, 0, linkL * 0.62, linkW * 0.62, 0, 0, Math.PI * 2);
      ctx.strokeStyle = i % 2 ? '#8a744e' : '#e2ce9e';
      ctx.lineWidth = Math.max(1.8, r * 0.08);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(40,30,12,0.7)';
      ctx.lineWidth = Math.max(0.8, r * 0.03);
      ctx.stroke();
      ctx.restore();
    }
    // Anchor shank into the fluke
    roundedRect(x1 - r * 0.2, -sw * 0.5, r * 0.34, sw, sw * 0.25);
    ctx.fillStyle = '#dfe6ee';
    ctx.fill();
    ctx.strokeStyle = 'rgba(6,8,14,0.9)';
    ctx.lineWidth = Math.max(1.2, r * 0.045);
    ctx.stroke();
    // Broad fluke head
    const cxp = x1 + headLen * 0.3;
    const fluke = () => {
      ctx.beginPath();
      ctx.arc(cxp, 0, hw * 1.0, -Math.PI * 0.46, Math.PI * 0.46);
      ctx.arc(cxp + hw * 0.28, 0, hw * 0.62, Math.PI * 0.5, -Math.PI * 0.5, true);
      ctx.closePath();
    };
    ctx.save();
    ctx.shadowColor = 'rgba(220,230,245,0.6)';
    ctx.shadowBlur = r * 0.35;
    fluke();
    const fg = ctx.createLinearGradient(0, -hw, 0, hw);
    fg.addColorStop(0, '#ffffff');
    fg.addColorStop(0.5, '#dfe6ee');
    fg.addColorStop(1, '#5c687a');
    ctx.fillStyle = fg;
    ctx.fill();
    ctx.restore();
    fluke();
    ctx.strokeStyle = 'rgba(6,8,14,0.9)';
    ctx.lineWidth = Math.max(1.3, r * 0.05);
    ctx.stroke();
    for (const sg of [-1, 1]) {
      const a = sg * Math.PI * 0.46;
      const px = cxp + Math.cos(a) * hw;
      const py = Math.sin(a) * hw;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(a + sg * 1.2) * r * 0.32, py + Math.sin(a + sg * 1.2) * r * 0.32);
      ctx.lineTo(px + Math.cos(a) * r * 0.14, py + Math.sin(a) * r * 0.14);
      ctx.closePath();
      ctx.fillStyle = '#eef2f8';
      ctx.fill();
      ctx.strokeStyle = 'rgba(6,8,14,0.9)';
      ctx.lineWidth = Math.max(1, r * 0.04);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------- Gojo Ball's own unique aim arrow ----------
     A rippling black blindfold ribbon with white hair-spike fletching, ending in
     a Hollow Purple sphere with Blue and Red orbiting it. */

  function drawGojoArrow(b, alpha, push) {
    const { r, x0, shaftLen, headLen, sw, hw, x1, tip } = arrowFrame(b, push);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.globalAlpha = alpha;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // Blindfold ribbon
    const n = 12;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const yy = Math.sin(clock * 7 + t * 6) * sw * 0.25;
      if (i === 0) ctx.moveTo(x0 + shaftLen * t, yy - sw * 0.75);
      else ctx.lineTo(x0 + shaftLen * t, yy - sw * 0.75);
    }
    for (let i = n; i >= 0; i--) {
      const t = i / n;
      ctx.lineTo(x0 + shaftLen * t, Math.sin(clock * 7 + t * 6) * sw * 0.25 + sw * 0.75);
    }
    ctx.closePath();
    const rg = ctx.createLinearGradient(0, -sw, 0, sw);
    rg.addColorStop(0, '#34343f');
    rg.addColorStop(0.5, '#0d0d13');
    rg.addColorStop(1, '#000000');
    ctx.fillStyle = rg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = Math.max(1, r * 0.035);
    ctx.stroke();
    // White hair-spike fletching
    for (const sg of [-1, 0, 1]) {
      ctx.beginPath();
      ctx.moveTo(x0 + r * 0.08, sg * sw * 0.45 - sw * 0.25);
      ctx.lineTo(x0 - r * (sg === 0 ? 0.42 : 0.3), sg * sw * 0.45 + sg * r * 0.3);
      ctx.lineTo(x0 + r * 0.08, sg * sw * 0.45 + sw * 0.25);
      ctx.closePath();
      ctx.fillStyle = '#f4f7fb';
      ctx.fill();
      ctx.strokeStyle = 'rgba(110,120,140,0.85)';
      ctx.lineWidth = Math.max(0.8, r * 0.03);
      ctx.stroke();
    }
    // Hollow Purple head with Blue and Red in orbit
    const cx = x1 + headLen * 0.38;
    const R = hw * 0.6;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(cx, 0, R * 0.2, cx, 0, R * 2.4);
    glow.addColorStop(0, 'rgba(190,120,255,0.6)');
    glow.addColorStop(1, 'rgba(190,120,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, 0, R * 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Pointed purple tip
    ctx.beginPath();
    ctx.moveTo(cx + R * 0.55, -R * 0.62);
    ctx.lineTo(tip + r * 0.12, 0);
    ctx.lineTo(cx + R * 0.55, R * 0.62);
    ctx.closePath();
    ctx.fillStyle = '#9b5cff';
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,0,60,0.9)';
    ctx.lineWidth = Math.max(1, r * 0.04);
    ctx.stroke();
    const core = ctx.createRadialGradient(cx - R * 0.3, -R * 0.3, R * 0.05, cx, 0, R);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.4, '#c89bff');
    core.addColorStop(1, '#4b1290');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, 0, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(230,205,255,0.9)';
    ctx.lineWidth = Math.max(1, r * 0.04);
    ctx.stroke();
    for (let k = 0; k < 2; k++) {
      const ang = clock * 4 + k * Math.PI;
      const ox = cx + Math.cos(ang) * R * 1.35;
      const oy = Math.sin(ang) * R * 1.35 * 0.55;
      const orr = R * 0.38;
      const og = ctx.createRadialGradient(ox - orr * 0.3, oy - orr * 0.3, orr * 0.05, ox, oy, orr);
      og.addColorStop(0, '#ffffff');
      og.addColorStop(0.4, k ? '#ff8a8a' : '#8fd6ff');
      og.addColorStop(1, k ? '#c00018' : '#1a4fe0');
      ctx.fillStyle = og;
      ctx.beginPath();
      ctx.arc(ox, oy, orr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ---------- Harpoon Ball's own unique aim arrow ----------
     A harpoon: long steel shaft, a riveted collar, a toggle barb head and
     the rope trailing back to the ball. */

  function drawSpecialArrow(b, alpha, push) {
    if (alpha <= 0 || !b.alive) return;
    if (b.type === 'beam') { drawBeamArrow(b, alpha, push); return; }
    if (b.type === 'spear') { drawSpearArrow(b, alpha, push); return; }
    if (b.type === 'reforge') { drawReforgeArrow(b, alpha, push); return; }
    if (b.type === 'chess') { drawChessArrow(b, alpha, push); return; }
    if (b.type === 'verity') { drawVerityArrow(b, alpha, push); return; }
    if (b.type === 'cactus') { drawCactusArrow(b, alpha, push); return; }
    if (b.type === 'range') { drawRangeArrow(b, alpha, push); return; }
    if (b.type === 'electroking') { drawElectroArrow(b, alpha, push); return; }
    if (b.type === 'acid') { drawAcidArrow(b, alpha, push); return; }
    if (b.type === 'bigspike') { drawBigSpikeArrow(b, alpha, push); return; }
    if (b.type === 'cell') { drawCellArrow(b, alpha, push); return; }
    if (b.type === 'wdc') { drawWdcArrow(b, alpha, push); return; }
    if (b.type === 'hook') { drawHookArrow(b, alpha, push); return; }
    if (b.type === 'gojo') { drawGojoArrow(b, alpha, push); return; }
    const r = b.r;
    const bob = Math.sin(clock * 5.2) * r * 0.06;
    const x0 = r * 1.3 + bob + push;
    const reach = Math.min(r * 3.35, arena.w * 0.34, arena.h * 0.44);
    const k = clamp((reach - r * 1.3) / (r * 2.05), 0.52, 1);
    const shaftLen = r * 1.26 * k;
    const headLen = r * 1.0 * k;
    const thick = Math.sqrt(k);
    const sw = r * 0.2 * thick;
    const hw = r * 0.58 * thick;
    const x1 = x0 + shaftLen;
    const tip = x1 + headLen;

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.globalAlpha = alpha;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const halo = (path, c, w, blur) => {
      ctx.save();
      path();
      ctx.shadowColor = c;
      ctx.shadowBlur = blur;
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.stroke();
      ctx.restore();
    };
    const ink = (path, fill, lw) => {
      path();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      ctx.strokeStyle = 'rgba(4,26,34,0.9)';
      ctx.lineWidth = lw;
      ctx.stroke();
    };
    const steel = () => {
      const g = ctx.createLinearGradient(0, -hw, 0, hw);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.42, '#7fd8e8');
      g.addColorStop(1, '#04222e');
      return g;
    };

    // Shaft
    const shaft = () => {
      ctx.beginPath();
      ctx.moveTo(x0, -sw * 0.66);
      ctx.lineTo(x1 - r * 0.1, -sw * 1.05);
      ctx.lineTo(x1 - r * 0.1, sw * 1.05);
      ctx.lineTo(x0, sw * 0.66);
      ctx.closePath();
    };
    halo(shaft, 'rgba(120,224,255,0.5)', r * 0.15, r * 0.4);
    ink(shaft, steel(), Math.max(1.4, r * 0.05));

    // The rope trailing back toward the ball
    ctx.save();
    ctx.strokeStyle = 'rgba(210,244,255,0.9)';
    ctx.lineWidth = Math.max(2, r * 0.1);
    ctx.beginPath();
    ctx.moveTo(x0 + r * 0.1, sw * 0.4);
    ctx.quadraticCurveTo(x0 - r * 0.3, Math.sin(clock * 6.2) * r * 0.5 + sw * 0.4,
      x0 - r * 0.72, Math.sin(clock * 6.2 + 1.1) * r * 0.62 + sw * 0.3);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(4,26,34,0.65)';
    ctx.lineWidth = Math.max(0.8, r * 0.035);
    ctx.stroke();
    ctx.restore();

    // Riveted collar
    ctx.beginPath();
    roundedRect(x1 - r * 0.18, -sw * 1.35, r * 0.15, sw * 2.7, sw * 0.35);
    ctx.fillStyle = '#04222e';
    ctx.fill();
    ctx.strokeStyle = 'rgba(210,244,255,0.9)';
    ctx.lineWidth = Math.max(1, r * 0.035);
    ctx.stroke();
    ctx.fillStyle = 'rgba(210,244,255,0.95)';
    ctx.beginPath();
    ctx.arc(x1 - r * 0.105, -sw * 0.8, Math.max(1.2, r * 0.05), 0, Math.PI * 2);
    ctx.arc(x1 - r * 0.105, sw * 0.8, Math.max(1.2, r * 0.05), 0, Math.PI * 2);
    ctx.fill();

    // Toggle barb head
    const head = () => {
      ctx.beginPath();
      ctx.moveTo(x1, -hw * 0.32);
      ctx.lineTo(x1 + headLen * 0.3, -hw * 1.15);
      ctx.lineTo(x1 + headLen * 0.56, -hw * 0.34);
      ctx.lineTo(tip, 0);
      ctx.lineTo(x1 + headLen * 0.56, hw * 0.34);
      ctx.lineTo(x1 + headLen * 0.3, hw * 1.15);
      ctx.lineTo(x1, hw * 0.32);
      ctx.closePath();
    };
    halo(head, 'rgba(160,236,255,0.7)', r * 0.17, r * 0.5);
    ink(head, steel(), Math.max(1.4, r * 0.055));
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(1, r * 0.035);
    ctx.beginPath();
    ctx.moveTo(x1 + headLen * 0.1, -hw * 0.16);
    ctx.lineTo(tip - r * 0.06, 0);
    ctx.lineTo(x1 + headLen * 0.1, hw * 0.16);
    ctx.stroke();

    ctx.restore();
  }


  /* ---------- Battle mode ----------
     A Pokemon-style battle against the bot. Each side drafts 5 random balls. You
     send one out, then the bot answers. When a ball faints the game pauses: the
     winner stays exactly where it is with the health it had left, and the loser
     sends out its next ball. Whoever runs out of balls loses. */

  const BATTLE_TEAM = 5;
  const BOT_THINK = 0.9, BOT_REVEAL = 1.25;

  function ballName(type) {
    return (BALL_INFO[type] && BALL_INFO[type].name) || String(type).toUpperCase();
  }

  function hpColor(frac) {
    return frac > 0.5 ? '#5ee36a' : (frac > 0.2 ? '#ffd23f' : '#ff4d5e');
  }

  function makeBattleTeam() {
    const pool = BALL_ORDER.filter(t => t !== 'classic');
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    return pool.slice(0, BATTLE_TEAM).map(type => ({
      type, health: TYPES[type].maxHealth, max: TYPES[type].maxHealth, fainted: false, seen: false
    }));
  }

  function battleLeft(side) {
    return battle.teams[side].filter(m => !m.fainted).length;
  }

  function battleHome(side) {
    return { x: arena.x + arena.w * (side === 'red' ? 0.25 : 0.75), y: arena.y + arena.h * 0.5 };
  }

  function battleStart() {
    mode = '1p';
    gameMode = 'battle';
    persist();
    battle.on = true;
    battle.over = false;
    battle.winner = null;
    battle.teams = { red: makeBattleTeam(), blue: makeBattleTeam() };
    battle.active = { red: -1, blue: -1 };
    battle.fresh = { red: false, blue: false };
    battle.lastLost = { red: null, blue: null };
    battle.koLines = [];
    battle.bannerT = 0;
    battle.turn = 0;
    battle.focus = 0;
    resetRound();
    red.alive = false;
    blue.alive = false;
    matchOver = false;
    phase = 'bpick';
    battle.queue = ['red', 'blue'];
    battleNextPick();
  }

  function battleExit() {
    battle.on = false;
    battle.picking = null;
    battle.queue = [];
    resetRound();
    phase = 'name';
  }

  function battleNextPick() {
    battle.picking = battle.queue.shift() || null;
    battle.hover = -1;
    battle.botT = 0;
    battle.botPick = -1;
    battle.pickT = 0;
    if (battle.picking === 'red') {
      const open = battle.teams.red.findIndex(m => !m.fainted);
      battle.focus = Math.max(0, open);
    }
    if (!battle.picking) battleResume();
  }

  function battleChoose(side, idx) {
    if (phase !== 'bpick' || battle.picking !== side) return false;
    const m = battle.teams[side][idx];
    if (!m || m.fainted) return false;
    const b = side === 'red' ? red : blue;
    battle.active[side] = idx;
    m.seen = true;
    applyBallType(b, m.type, true);
    b.health = m.health;
    b.shownHealth = m.health;
    const h = battleHome(side);
    b.x = h.x;
    b.y = h.y;
    b.vx = 0;
    b.vy = 0;
    b.angle = side === 'red' ? 0 : Math.PI;
    b.facing = b.angle;
    b.alive = true;
    battle.fresh[side] = true;
    // Release burst where the ball lands
    impactRings.push({ x: b.x, y: b.y, age: 0, life: 0.55, radius: b.r * 2.4, color: { r: 255, g: 255, b: 255 } });
    impactRings.push({ x: b.x, y: b.y, age: 0, life: 0.4, radius: b.r * 1.5, color: b.color });
    spawnSparks(b.x, b.y, b.accent, 18, 1.2);
    sfx.select(Math.max(0, BALL_ORDER.indexOf(m.type)));
    battleNextPick();
    return true;
  }

  // A survivor keeps its spot and its health; only its ability state is rebuilt
  function battleRefresh(b) {
    const keep = { x: b.x, y: b.y, h: b.health, a: b.angle };
    applyBallType(b, b.type, false);
    b.x = keep.x;
    b.y = keep.y;
    b.health = keep.h;
    b.shownHealth = keep.h;
    b.angle = keep.a;
    b.facing = keep.a;
    b.vx = 0;
    b.vy = 0;
    b.alive = true;
  }

  function battleResume() {
    for (const b of balls) if (!battle.fresh[b.side] && b.alive) battleRefresh(b);
    // A survivor parked on the newcomer's spot steps back to its own side
    if (Math.hypot(red.x - blue.x, red.y - blue.y) < (red.r + blue.r) * 1.6) {
      const stay = battle.fresh.red ? blue : red;
      const h = battleHome(stay.side);
      stay.x = h.x;
      stay.y = h.y;
    }
    for (const b of balls) {
      b.x = clamp(b.x, arena.x + b.r, arena.x + arena.w - b.r);
      b.y = clamp(b.y, arena.y + b.r, arena.y + arena.h - b.r);
    }
    battle.fresh = { red: false, blue: false };
    battle.turn += 1;
    phase = 'aim';
    sinceLaunch = 0;
    impactCooldown = 0;
    latch = null;
    activePointer = null;
    keys.left = false;
    keys.right = false;
    bot.timer = 0.25;
    battle.banner = 'GO!';
    battle.bannerSub = `${ballName(red.type)}   VS   ${ballName(blue.type)}`;
    battle.bannerT = 1.7;
    canvas.classList.remove('playing');
  }

  function battleKO() {
    latch = null;
    const lost = [];
    for (const b of balls) {
      const idx = battle.active[b.side];
      const m = idx >= 0 ? battle.teams[b.side][idx] : null;
      if (b.health <= 0 && b.alive) {
        shatterBall(b);
        if (m) { m.health = 0; m.fainted = true; }
        battle.lastLost[b.side] = b.type;
        lost.push(b);
      } else if (m && b.alive) {
        m.health = Math.max(1, Math.round(b.health));
      }
    }
    if (!lost.length) return;
    sfx.ko();
    hitStop = 0.08;
    addShake(12);
    phase = 'roundover';
    battle.koT = 0;
    battle.koLines = lost.map(b => (b === red ? 'YOUR ' : "BOT'S ") + ballName(b.type) + ' FAINTED!');
    const rl = battleLeft('red'), bl = battleLeft('blue');
    if (rl === 0 || bl === 0) {
      battle.over = true;
      battle.winner = rl === 0 && bl === 0 ? 'draw' : (rl === 0 ? 'blue' : 'red');
      resetRemaining = 2.0;
    } else {
      battle.queue = ['red', 'blue'].filter(side => lost.some(b => b.side === side));
      resetRemaining = 1.6;
    }
  }

  function battleAfterKO() {
    battle.koLines = [];
    if (battle.over) {
      phase = 'bover';
      battle.overT = 0;
      battle.hover = -1;
      if (battle.winner === 'red') sfx.chargeFull();
      return;
    }
    phase = 'bpick';
    battleNextPick();
  }

  function battleTick(dt) {
    battle.anim += dt;
    battle.bannerT = Math.max(0, battle.bannerT - dt);
    if (phase === 'roundover') battle.koT += dt;
    if (phase === 'bover') battle.overT += dt;
    if (phase !== 'bpick') return;
    battle.pickT += dt;
    if (battle.picking !== 'blue') return;
    battle.botT += dt;
    if (battle.botT >= BOT_THINK && battle.botPick < 0) {
      const open = [];
      battle.teams.blue.forEach((m, i) => { if (!m.fainted) open.push(i); });
      battle.botPick = open[Math.floor(Math.random() * open.length)];
      sfx.dash();
    }
    if (battle.botPick >= 0 && battle.botT >= BOT_THINK + BOT_REVEAL) battleChoose('blue', battle.botPick);
  }

  /* ---------- battle input ---------- */

  function battleCardRects() {
    const n = BATTLE_TEAM;
    const gap = clamp(W * 0.012, 8, 16);
    let cols = n;
    let cw = Math.min(160, (W - 40 - gap * (n - 1)) / n);
    if (cw < 86) {
      cols = 3;
      cw = Math.min(150, (W - 40 - gap * 2) / 3);
    }
    const ch = cw * 1.36;
    const rows = Math.ceil(n / cols);
    const totalH = rows * ch + (rows - 1) * gap;
    const y0 = Math.max(130, Math.min(H * 0.53 - totalH * 0.5, H - totalH - 74));
    const rects = [];
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / cols), col = i % cols;
      const inRow = Math.min(cols, n - row * cols);
      const rowW = inRow * cw + (inRow - 1) * gap;
      rects.push({ x: (W - rowW) / 2 + col * (cw + gap), y: y0 + row * (ch + gap), w: cw, h: ch });
    }
    return rects;
  }

  function battleOverButtons() {
    const bw = clamp(W * 0.18, 130, 190), bh = 46;
    const y = Math.min(H - bh - 24, H * 0.8);
    return {
      again: { x: W * 0.5 - bw - 8, y, w: bw, h: bh },
      menu: { x: W * 0.5 + 8, y, w: bw, h: bh }
    };
  }

  function battleHit(px, py) {
    if (phase === 'bpick' && battle.picking === 'red') {
      const rects = battleCardRects();
      for (let i = 0; i < rects.length; i++) {
        if (!battle.teams.red[i].fainted && inRect(rects[i], px, py)) return i;
      }
      return -1;
    }
    if (phase === 'bover') {
      const btn = battleOverButtons();
      if (inRect(btn.again, px, py)) return 0;
      if (inRect(btn.menu, px, py)) return 1;
    }
    return -1;
  }

  function battlePointer(px, py) {
    const hit = battleHit(px, py);
    if (phase === 'bpick' && hit >= 0) battleChoose('red', hit);
    else if (phase === 'bover') {
      if (hit === 0) battleStart();
      else if (hit === 1) battleExit();
    }
  }

  function battleKey(e) {
    const k = e.key;
    if (k === 'Escape') { battleExit(); return true; }
    if (phase === 'bpick') {
      if (k === ' ' || k.startsWith('Arrow')) e.preventDefault();
      if (battle.picking === 'red') {
        const team = battle.teams.red;
        const n = parseInt(k, 10);
        if (n >= 1 && n <= BATTLE_TEAM) { battleChoose('red', n - 1); return true; }
        const step = (k === 'ArrowLeft' || k === 'a' || k === 'A') ? -1 : ((k === 'ArrowRight' || k === 'd' || k === 'D') ? 1 : 0);
        if (step) {
          for (let i = 1; i <= team.length; i++) {
            const j = (battle.focus + step * i + team.length * 2) % team.length;
            if (!team[j].fainted) { battle.focus = j; break; }
          }
        }
        if (k === 'Enter' || k === ' ') battleChoose('red', battle.focus);
      }
      return true;
    }
    if (phase === 'bover') {
      if (k === ' ') e.preventDefault();
      if (k === 'Enter' || k === ' ') battleStart();
      return true;
    }
    if (phase === 'roundover') return true;
    // Mid-battle there is no switching balls or modes from the classic shortcuts
    if (k === 'i' || k === 'I' || k === 'm' || k === 'M' || /^[0-9]$/.test(k)) return true;
    return false;
  }

  /* ---------- battle drawing ---------- */

  function bText(text, x, y, size, fill, glow, weight) {
    ctx.font = `${weight || 900} ${size}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, size * 0.16);
    ctx.strokeStyle = 'rgba(4,6,14,0.92)';
    ctx.strokeText(text, x, y);
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = size * 0.6; }
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 0;
  }

  function wrapLines(text, maxW) {
    const words = String(text).split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; }
      else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function hpBar(x, y, w, h, frac) {
    roundedRect(x, y, w, h, h / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fill();
    if (frac > 0) {
      roundedRect(x + 1, y + 1, Math.max(h - 2, (w - 2) * frac), h - 2, (h - 2) / 2);
      ctx.fillStyle = hpColor(frac);
      ctx.fill();
    }
  }

  // A small capsule icon, used for the bot's hidden team
  function drawCapsule(cx, cy, rr, filled) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, rr, Math.PI, 0);
    ctx.fillStyle = filled ? '#e8443a' : '#4a4f5c';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI);
    ctx.fillStyle = filled ? '#f4f6fa' : '#2c303a';
    ctx.fill();
    ctx.fillStyle = '#0b0d14';
    ctx.fillRect(cx - rr, cy - rr * 0.13, rr * 2, rr * 0.26);
    ctx.beginPath();
    ctx.arc(cx, cy, rr * 0.34, 0, Math.PI * 2);
    ctx.fillStyle = '#0b0d14';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, rr * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = filled ? '#ffffff' : '#5a5f6c';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineWidth = Math.max(1, rr * 0.12);
    ctx.stroke();
    ctx.restore();
  }

  // In-game HUD: each side's team in place of the hearts
  function drawBattleHud() {
    const pr = clamp(minDim() * 0.021, 9, 14);
    const gap = pr * 2.6;
    const y = Math.max(pr + 6, arena.y * 0.5);
    for (const side of ['red', 'blue']) {
      const team = battle.teams[side];
      const dir = side === 'red' ? 1 : -1;
      const x0 = side === 'red' ? arena.x + pr * 1.2 : arena.x + arena.w - pr * 1.2;
      for (let i = 0; i < team.length; i++) {
        const m = team[i];
        const cx = x0 + dir * i * gap;
        const active = battle.active[side] === i && !m.fainted;
        const live = active ? (side === 'red' ? red : blue) : null;
        const hp = live && live.alive ? live.health : m.health;
        if (active) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, y, pr * 1.42, 0, Math.PI * 2);
          ctx.strokeStyle = side === 'red' ? 'rgba(255,120,135,0.95)' : 'rgba(110,195,255,0.95)';
          ctx.lineWidth = 2;
          ctx.shadowColor = ctx.strokeStyle;
          ctx.shadowBlur = 8;
          ctx.stroke();
          ctx.restore();
        }
        const hidden = side === 'blue' && !m.seen && !m.fainted;
        if (hidden) {
          drawCapsule(cx, y, pr * 0.9, true);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = m.fainted ? 0.3 : 1;
        drawBallSprite(side, m.type, pr, cx, y, 1);
        ctx.restore();
        if (m.fainted) {
          ctx.save();
          ctx.strokeStyle = 'rgba(255,77,94,0.9)';
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(cx - pr * 0.6, y - pr * 0.6);
          ctx.lineTo(cx + pr * 0.6, y + pr * 0.6);
          ctx.moveTo(cx + pr * 0.6, y - pr * 0.6);
          ctx.lineTo(cx - pr * 0.6, y + pr * 0.6);
          ctx.stroke();
          ctx.restore();
        } else {
          hpBar(cx - pr, y + pr * 1.22, pr * 2, 4, clamp(hp / m.max, 0, 1));
        }
      }
      const label = `${side === 'red' ? names.red : 'BOT'}  ${battleLeft(side)}/${BATTLE_TEAM}`;
      ctx.save();
      ctx.font = `800 ${clamp(pr * 0.95, 10, 14)}px system-ui, sans-serif`;
      ctx.textAlign = side === 'red' ? 'left' : 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = side === 'red' ? '#ff9aa6' : '#8ad2ff';
      ctx.fillText(label, x0 + dir * (team.length * gap - pr * 0.4), y);
      ctx.restore();
    }
  }

  function drawBattleCard(m, R, idx, hov, focus) {
    const info = BALL_INFO[m.type] || { name: m.type, rarity: 'COMMON' };
    const rc = RARITY_COLORS[info.rarity] || '#b8c0cc';
    const lift = hov && !m.fainted ? -7 : 0;
    const x = R.x, y = R.y + lift, w = R.w, h = R.h;
    ctx.save();
    ctx.shadowColor = hov ? hexA(rc, 0.7) : 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = hov ? 24 : 12;
    ctx.shadowOffsetY = hov ? 0 : 4;
    roundedRect(x, y, w, h, w * 0.1);
    const bg = ctx.createLinearGradient(0, y, 0, y + h);
    bg.addColorStop(0, '#1d2440');
    bg.addColorStop(1, '#0b0e1a');
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.restore();
    // Rarity glow across the top
    ctx.save();
    roundedRect(x, y, w, h, w * 0.1);
    ctx.clip();
    const top = ctx.createLinearGradient(0, y, 0, y + h * 0.55);
    top.addColorStop(0, hexA(rc, hov ? 0.45 : 0.28));
    top.addColorStop(1, hexA(rc, 0));
    ctx.fillStyle = top;
    ctx.fillRect(x, y, w, h * 0.55);
    ctx.restore();
    roundedRect(x + 0.5, y + 0.5, w - 1, h - 1, w * 0.1);
    ctx.strokeStyle = hov || focus ? rc : hexA(rc, 0.5);
    ctx.lineWidth = hov || focus ? 2.2 : 1.2;
    ctx.stroke();
    // Key number
    ctx.save();
    ctx.font = `900 ${clamp(w * 0.09, 9, 13)}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(String(idx + 1), x + w * 0.08, y + w * 0.07);
    ctx.restore();
    // The ball
    const bob = hov && !m.fainted ? Math.sin(battle.anim * 5) * 2.5 : 0;
    drawBallSprite('red', m.type, w * 0.24, x + w / 2, y + h * 0.36 + bob, hov ? 1.08 : 1);
    bText(info.name, x + w / 2, y + h * 0.665, clamp(w * 0.11, 10, 16), '#ffffff');
    ctx.save();
    ctx.font = `800 ${clamp(w * 0.068, 8, 11)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = rc;
    ctx.fillText(info.rarity, x + w / 2, y + h * 0.75);
    ctx.restore();
    const frac = clamp(m.health / m.max, 0, 1);
    hpBar(x + w * 0.12, y + h * 0.82, w * 0.76, Math.max(5, h * 0.045), frac);
    ctx.save();
    ctx.font = `800 ${clamp(w * 0.065, 8, 11)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(`${Math.round(m.health)} / ${m.max} HP`, x + w / 2, y + h * 0.92);
    ctx.restore();
    if (m.fainted) {
      ctx.save();
      roundedRect(x, y, w, h, w * 0.1);
      ctx.fillStyle = 'rgba(6,8,14,0.7)';
      ctx.fill();
      ctx.translate(x + w / 2, y + h * 0.42);
      ctx.rotate(-0.28);
      const sw2 = w * 0.78, sh2 = clamp(w * 0.2, 18, 30);
      roundedRect(-sw2 / 2, -sh2 / 2, sw2, sh2, 6);
      ctx.strokeStyle = '#ff4d5e';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.font = `900 ${clamp(w * 0.12, 10, 17)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ff4d5e';
      ctx.fillText('FAINTED', 0, 1);
      ctx.restore();
    }
  }

  function drawPlayerPick() {
    const team = battle.teams.red;
    const rects = battleCardRects();
    const topY = rects[0].y;
    const first = battle.turn === 0;
    const enter = clamp(battle.pickT / 0.35, 0, 1);
    ctx.save();
    ctx.globalAlpha = enter;
    if (!first && battle.lastLost.red) {
      bText(`YOUR ${ballName(battle.lastLost.red)} FAINTED!`, W / 2, topY - 92, clamp(W * 0.026, 16, 26), '#ff6b7a', 'rgba(255,60,80,0.6)');
    }
    bText(first ? 'CHOOSE YOUR FIRST BALL' : 'CHOOSE YOUR NEXT BALL', W / 2, topY - 58, clamp(W * 0.034, 20, 36), '#ffd45a', 'rgba(255,190,40,0.55)');
    // What you are up against
    let vs;
    if (blue.alive) {
      const hp = Math.max(0, Math.round(blue.health));
      vs = `BOT'S ${ballName(blue.type)} IS WAITING WITH ${hp} / ${blue.maxHealth} HP`;
    } else {
      vs = `THE BOT HAS ${battleLeft('blue')} BALLS AND ANSWERS YOUR PICK`;
    }
    bText(vs, W / 2, topY - 26, clamp(W * 0.013, 11, 14), '#9fd4ff', null, 800);
    for (let i = 0; i < team.length; i++) {
      drawBattleCard(team[i], rects[i], i, battle.hover === i, battle.focus === i && battle.hover < 0);
    }
    // Description of the focused ball
    const fi = battle.hover >= 0 ? battle.hover : battle.focus;
    const fm = team[fi];
    if (fm && !fm.fainted) {
      const info = BALL_INFO[fm.type];
      const last = rects[rects.length - 1];
      const y0 = last.y + last.h + 22;
      ctx.save();
      ctx.font = '600 13px system-ui, -apple-system, sans-serif';
      const lines = wrapLines(info.desc, Math.min(560, W - 60));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(214,222,240,0.9)';
      lines.slice(0, 3).forEach((ln, i) => ctx.fillText(ln, W / 2, y0 + i * 17));
      ctx.restore();
    }
    ctx.save();
    ctx.font = '800 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText('CLICK A BALL OR PRESS 1-5   -   ARROWS + ENTER   -   ESC FOR MENU', W / 2, H - 18);
    ctx.restore();
    ctx.restore();
  }

  function drawBotPick() {
    const cy = H * 0.42;
    const team = battle.teams.blue;
    if (red.alive && battle.lastLost.blue) {
      bText(`BOT'S ${ballName(battle.lastLost.blue)} FAINTED!`, W / 2, cy - 120, clamp(W * 0.024, 15, 24), '#8ad2ff', 'rgba(80,170,255,0.6)');
      bText(`YOUR ${ballName(red.type)} STAYS IN WITH ${Math.max(0, Math.round(red.health))} HP`, W / 2, cy - 90, clamp(W * 0.013, 11, 14), '#ffb8c0', null, 800);
    }
    // The bot's team as capsules: you see how many it has left, not what they are
    const cr = clamp(minDim() * 0.02, 9, 13);
    const gap = cr * 2.8;
    const x0 = W / 2 - ((team.length - 1) * gap) / 2;
    team.forEach((m, i) => {
      const chosen = battle.botPick === i;
      drawCapsule(x0 + i * gap, cy - 50, cr * (chosen ? 1.2 : 1), !m.fainted);
    });
    if (battle.botPick < 0) {
      const dots = '.'.repeat(1 + (Math.floor(battle.botT * 4) % 3));
      bText(`BOT IS CHOOSING${dots}`, W / 2, cy + 10, clamp(W * 0.032, 20, 34), '#8ad2ff', 'rgba(80,170,255,0.55)');
      return;
    }
    const m = team[battle.botPick];
    const info = BALL_INFO[m.type];
    const t = clamp((battle.botT - BOT_THINK) / 0.45, 0, 1);
    const back = 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);   // ease-out-back
    const br = clamp(minDim() * 0.085, 30, 54);
    // Release flash
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const fl = ctx.createRadialGradient(W / 2, cy + 40, 0, W / 2, cy + 40, br * 3.4);
    fl.addColorStop(0, `rgba(255,255,255,${0.5 * (1 - t * 0.6)})`);
    fl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = fl;
    ctx.fillRect(W / 2 - br * 3.4, cy + 40 - br * 3.4, br * 6.8, br * 6.8);
    ctx.restore();
    drawBallSprite('blue', m.type, br, W / 2, cy + 40, Math.max(0.05, back));
    ctx.save();
    ctx.globalAlpha = t;
    bText(`BOT SENDS OUT ${info.name}!`, W / 2, cy + 40 + br * 1.9, clamp(W * 0.03, 18, 32), '#ffffff', 'rgba(110,190,255,0.7)');
    ctx.font = '800 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = RARITY_COLORS[info.rarity] || '#b8c0cc';
    ctx.fillText(info.rarity + '  -  ' + info.tag, W / 2, cy + 40 + br * 1.9 + 28);
    ctx.restore();
  }

  function drawBattleOver() {
    // Fully cover the field so the last ball standing never sits under the team rows
    ctx.fillStyle = 'rgba(4,6,14,0.95)';
    ctx.fillRect(0, 0, W, H);
    const win = battle.winner === 'red';
    const draw = battle.winner === 'draw';
    const t = clamp(battle.overT / 0.5, 0, 1);
    const pop = 0.6 + 0.4 * (1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2));
    // Confetti for a win
    if (win) {
      for (let i = 0; i < 46; i++) {
        const sx = ((i * 0.6180339) % 1) * W;
        const sy = ((battle.overT * (60 + (i % 7) * 18) + i * 53) % (H + 40)) - 20;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(battle.overT * 3 + i);
        ctx.fillStyle = ['#ffd45a', '#ff6b7a', '#5ee36a', '#8ad2ff', '#c89bff'][i % 5];
        ctx.fillRect(-4, -2, 8, 4);
        ctx.restore();
      }
    }
    const title = draw ? 'DRAW' : (win ? 'VICTORY!' : 'DEFEAT');
    const col = draw ? '#cfd6e4' : (win ? '#ffd45a' : '#ff5b6b');
    const glow = draw ? null : (win ? 'rgba(255,190,40,0.7)' : 'rgba(255,60,80,0.6)');
    ctx.save();
    ctx.translate(W / 2, H * 0.24);
    ctx.scale(pop, pop);
    bText(title, 0, 0, clamp(W * 0.075, 36, 84), col, glow);
    ctx.restore();
    const sub = draw ? 'BOTH TEAMS WENT DOWN TOGETHER'
      : (win ? `YOU WON WITH ${battleLeft('red')} BALL${battleLeft('red') === 1 ? '' : 'S'} LEFT`
        : `THE BOT WON WITH ${battleLeft('blue')} BALL${battleLeft('blue') === 1 ? '' : 'S'} LEFT`);
    bText(sub, W / 2, H * 0.24 + clamp(W * 0.05, 30, 56), clamp(W * 0.015, 12, 16), '#e6ebf5', null, 800);
    // Both teams' final state
    const pr = clamp(minDim() * 0.04, 16, 26);
    const gap = pr * 2.7;
    const rows = [['red', `${names.red}'S TEAM`, H * 0.48], ['blue', "BOT'S TEAM", H * 0.64]];
    for (const [side, label, ry] of rows) {
      const team = battle.teams[side];
      ctx.save();
      ctx.font = '800 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = side === 'red' ? '#ff9aa6' : '#8ad2ff';
      ctx.fillText(label, W / 2, ry - pr * 1.6);
      ctx.restore();
      const x0 = W / 2 - ((team.length - 1) * gap) / 2;
      team.forEach((m, i) => {
        const cx = x0 + i * gap;
        ctx.save();
        ctx.globalAlpha = m.fainted ? 0.28 : 1;
        drawBallSprite(side, m.type, pr, cx, ry, 1);
        ctx.restore();
        if (!m.fainted) hpBar(cx - pr, ry + pr * 1.25, pr * 2, 5, clamp(m.health / m.max, 0, 1));
      });
    }
    const btn = battleOverButtons();
    const button = (r, label, primary, hov) => {
      ctx.save();
      if (primary) {
        const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
        g.addColorStop(0, hov ? '#fff0a0' : '#ffe27a');
        g.addColorStop(1, '#d68a0c');
        ctx.shadowColor = 'rgba(255,197,49,0.5)';
        ctx.shadowBlur = hov ? 22 : 12;
        roundedRect(r.x, r.y, r.w, r.h, 12);
        ctx.fillStyle = g;
        ctx.fill();
      } else {
        roundedRect(r.x, r.y, r.w, r.h, 12);
        ctx.fillStyle = hov ? 'rgba(40,46,70,0.95)' : 'rgba(18,22,36,0.95)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.font = '900 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = primary ? '#241300' : 'rgba(255,255,255,0.85)';
      ctx.fillText(label, r.x + r.w / 2, r.y + r.h * 0.54);
      ctx.restore();
    };
    button(btn.again, 'BATTLE AGAIN', true, battle.hover === 0);
    button(btn.menu, 'MENU', false, battle.hover === 1);
  }

  function drawBattleOverlay() {
    if (phase === 'aim' || phase === 'play') {
      if (battle.bannerT > 0) {
        const a = clamp(battle.bannerT / 0.45, 0, 1);
        const t = clamp((1.7 - battle.bannerT) / 0.3, 0, 1);
        const pop = 1 + (1 - t) * 0.5;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(W / 2, arena.y + arena.h * 0.3);
        ctx.scale(pop, pop);
        bText(battle.banner, 0, 0, clamp(W * 0.07, 34, 78), '#ffd45a', 'rgba(255,190,40,0.7)');
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = a;
        bText(battle.bannerSub, W / 2, arena.y + arena.h * 0.3 + clamp(W * 0.05, 30, 54), clamp(W * 0.017, 12, 18), '#ffffff', null, 800);
        ctx.restore();
      }
      if (phase === 'aim') {
        ctx.save();
        ctx.font = '800 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        const by = arena.y + arena.h + (H - arena.y - arena.h) * 0.5;
        ctx.fillText('AIM WITH A / D OR THE MOUSE   -   SPACE OR CLICK TO LAUNCH   -   ESC FOR MENU', W / 2, by);
        ctx.restore();
      }
      return;
    }
    if (phase === 'roundover') {
      const t = clamp(battle.koT / 0.25, 0, 1);
      ctx.save();
      ctx.fillStyle = `rgba(4,6,14,${0.35 * t})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      battle.koLines.forEach((ln, i) => {
        ctx.save();
        ctx.globalAlpha = t;
        ctx.translate(W / 2, H * 0.4 + i * clamp(W * 0.05, 30, 52));
        const s = 1.4 - 0.4 * t;
        ctx.scale(s, s);
        const mine = ln.startsWith('YOUR');
        bText(ln, 0, 0, clamp(W * 0.042, 22, 46), mine ? '#ff6b7a' : '#8ad2ff', mine ? 'rgba(255,60,80,0.6)' : 'rgba(80,170,255,0.6)');
        ctx.restore();
      });
      return;
    }
    if (phase === 'bpick') {
      ctx.fillStyle = 'rgba(4,6,14,0.7)';
      ctx.fillRect(0, 0, W, H);
      if (battle.picking === 'red') drawPlayerPick();
      else if (battle.picking === 'blue') drawBotPick();
      return;
    }
    if (phase === 'bover') drawBattleOver();
  }

  /* ---------- main loop ---------- */

  let last = performance.now();
  function frame(now) {
    const frameStart = performance.now();
    const dt = clamp((now - last) / 1000, 0, 1 / 30);
    last = now;
    clock += dt;

    if (hitStop > 0) {
      hitStop = Math.max(0, hitStop - dt);
      updateEffects(dt * 0.28);
    } else {
      if (phase === 'aim') {
        if (keys.left) { red.angle -= 2.65 * dt; red.facing = red.angle; }
        if (keys.right) { red.angle += 2.65 * dt; red.facing = red.angle; }
        if (mode === '2p') {
          if (p2.left) { blue.angle -= 2.65 * dt; blue.facing = blue.angle; }
          if (p2.right) { blue.angle += 2.65 * dt; blue.facing = blue.angle; }
        } else {
          updateBot(dt);
        }
        // Idle spin on Blade Ball during aim so it looks alive; gun barrels follow the aim arrow
        for (const b of balls) {
          if (b.type === 'blade') b.bladeAngle += 1.45 * dt;
          if (b.type === 'machine') b.gunAngle = b.angle;
          if (b.type === 'axe') b.axeAngle += 1.6 * dt;
          if (b.type === 'beam') b.beamAngle = b.angle;
          if (b.type === 'spear') b.facing = b.angle;
        }
      } else if (phase === 'play') {
        sinceLaunch += dt;
        step(dt);
      } else if (phase === 'roundover') {
        resetRemaining -= dt;
        if (resetRemaining <= 0) {
          if (battle.on) battleAfterKO();
          else if (matchOver) resetMatch();
          else resetRound();
        }
      }
      updateEffects(dt);
    }

    if (battle.on) battleTick(dt);
    entrance = Math.min(1, entrance + dt * 4.2);
    updateInventory(dt);
    updatePopup(dt);
    canvas.classList.toggle('playing', phase !== 'aim' || inv.open);

    ctx.clearRect(0, 0, W, H);
    drawArena();

    ctx.save();
    ctx.translate(shake.x, shake.y);

    drawArenaAbilities();
    balls.forEach(drawBall);
    if (animeRivals.hasFrontEffects()) {
      ctx.save();
      roundedRect(arena.x, arena.y, arena.w, arena.h, arena.r);
      ctx.clip();
      animeRivals.draw(ctx, clock, quality, true);
      ctx.restore();
    }

    if (phase === 'aim') {
      drawArrow(red, 1, 0);
      drawArrow(blue, 1, 0);
    } else if (sinceLaunch < FADE_TIME) {
      const t = sinceLaunch / FADE_TIME;
      drawArrow(red, 1 - t, t * red.r * 1.45);
      drawArrow(blue, 1 - t, t * blue.r * 1.45);
    }

    drawEffects();
    ctx.restore();

    animeRivals.drawTitles(ctx);
    drawGojoFlash();
    drawHearts();
    drawPicker();

    let shade = 0;
    if (phase === 'roundover' && resetRemaining < 0.32 && !battle.on) shade = 1 - resetRemaining / 0.32;
    else if (entrance < 1) shade = 1 - entrance;
    if (shade > 0) {
      ctx.fillStyle = `rgba(6,7,13,${shade})`;
      ctx.fillRect(0, 0, W, H);
    }

    drawInventory();
    drawInfoPopup();
    if (battle.on) drawBattleOverlay();
    if (phase === 'name') drawNameScreen();

    // Adaptive quality: back off effects when the frame budget is missed, and
    // climb straight back once it is not. The first frames are skipped because
    // baking the sprite and arena caches is a one-off spike, not a real cost.
    framesRun += 1;
    if (framesRun > 45) {
      const cost = performance.now() - frameStart;
      frameMs += (cost - frameMs) * 0.08;
      if (frameMs > 16 && quality > 0.45) quality = Math.max(0.45, quality - 0.05);
      else if (frameMs < 9 && quality < 1) quality = Math.min(1, quality + 0.06);
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Test and debugging handle. It only reads or pokes state; the game itself never uses it.
  return {
    get phase() { return phase; },
    get quality() { return quality; },
    get frameMs() { return frameMs; },
    get spriteCount() { return spriteCache.size; },
    get arena() { return { x: arena.x, y: arena.y, w: arena.w, h: arena.h, r: arena.r }; },
    get pickerItems() { return picker.items.map(it => ({ x: it.x, y: it.y, r: it.r, id: it.id, side: it.side })); },
    red,
    blue,
    snapshot() {
      const pick = b => ({
        type: b.type, alive: b.alive, health: b.health,
        x: Math.round(b.x), y: Math.round(b.y), r: Math.round(b.r),
        chessPhase: b.chessPhase, verityStage: b.verityStage,
        rangeR: Math.round(b.rangeR), cellScale: +b.cellScale.toFixed(2),
        cellSplits: b.cellSplits, cellMature: b.cellMature, wdcOn: b.wdcOn,
        acidStacks: b.acidStacks.length, fx: { ...b.fx }
      });
      return {
        phase,
        red: pick(red),
        blue: pick(blue),
        cacti: cacti.length,
        cactiGrounded: cacti.filter(c => c.grounded).length,
        nodes: electroNodes.length,
        acidPuddles: acidPuddles.length,
        spikes: bigSpikes.length,
        cellOrbs: cellOrbs.length,
        cellSplits: red.cellSplits,
        cellScale: +red.cellScale.toFixed(2),
        wdcOn: red.wdcOn,
        wdcCells: red.wdcCells.slice(),
        hooks: hookShots.length,
        harpoons: harpoonShots.length,
        blades: reforgeBlades.map(bl => bl.level)
      };
    },
    test: { applyBallType, shoot, resetRound, applyDamage, electroWallHit, throwCacti, bigSpikeWallHit,
            wdcCellAt, contactDamageFor, throwAcid, hookFire,
            gojoCast, hollowPurple, gojoOrbs, purpleFx, animeRivals,
            battle, battleStart, battleChoose, battleExit, battleCardRects, battleOverButtons,
            cacti, electroNodes, acidPuddles, bigSpikes, cellOrbs, hookShots }
  };
}
