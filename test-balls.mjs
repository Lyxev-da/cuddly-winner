// Behaviour checks for the Ball VS Ball engine: the five newest balls, plus a
// crash check for every ball in the roster. Runs headless on a mocked canvas.
// Usage: node scripts/test-balls.mjs /absolute/path/to/src/game/engine.js
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const noop = () => {};
let rafCb = null;
let watchedLabels = null;

function makeCtx() {
  const grad = { addColorStop: noop };
  return new Proxy({}, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => grad;
      if (p === 'measureText') return () => ({ width: 42 });
      if (p === 'getLineDash') return () => [];
      if (p === 'fillText') return text => { watchedLabels?.add(text); };
      return () => undefined;
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}
function makeCanvas() {
  const listeners = {};
  const cls = new Set();
  const c = {
    width: 800, height: 600, style: {},
    classList: { toggle: (n, on) => (on ? cls.add(n) : cls.delete(n)), add: n => cls.add(n), remove: n => cls.delete(n), contains: n => cls.has(n) },
    addEventListener: (t, f) => { (listeners[t] ||= []).push(f); },
    removeEventListener: noop,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 }),
    setPointerCapture: noop, releasePointerCapture: noop,
    getContext: () => (c._ctx ||= makeCtx(c)),
    _listeners: listeners
  };
  return c;
}
const canvas = makeCanvas();
const win = {};
global.window = { addEventListener: (t, f) => { (win[t] ||= []).push(f); }, removeEventListener: noop, innerWidth: 800, innerHeight: 600, devicePixelRatio: 1 };
global.document = { getElementById: id => (id === 'c' ? canvas : null), createElement: () => makeCanvas(), addEventListener: noop, body: { appendChild: noop, style: {} }, documentElement: { style: {} } };
global.localStorage = { getItem: () => null, setItem: noop, removeItem: noop };
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = cb => { rafCb = cb; return 1; };
global.cancelAnimationFrame = noop;
global.devicePixelRatio = 1;
global.navigator = { userAgent: 'node' };

const file = process.argv[2];
const engine = await import(pathToFileURL(file).href);
const api = engine.initGame();
const { red, blue, test: T } = api;

let t = performance.now();
const frame = () => {
  t += 1000 / 60;
  const cb = rafCb;
  rafCb = null;
  if (!cb) throw new Error('no animation frame was requested');
  cb(t);
};
const run = n => { for (let i = 0; i < n; i++) frame(); };
const fire = (type, ev) => { (win[type] || []).forEach(f => f(ev)); (canvas._listeners[type] || []).forEach(f => f(ev)); };
const base = { clientX: 400, clientY: 300, pointerId: 1, pointerType: 'mouse', preventDefault: noop, stopPropagation: noop, button: 0, key: '', repeat: false };

run(60);
fire('pointerdown', { ...base, clientX: 400, clientY: 380 });
fire('pointerup', { ...base, clientX: 400, clientY: 380 }); // START
run(5);

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
  if (!ok) failures++;
};

function setup(redType, blueType) {
  T.resetRound();
  T.applyBallType(red, redType, false);
  T.applyBallType(blue, blueType, false);
  red.lives = 3;
  blue.lives = 3;
  T.shoot();
}

// 1. Chess Ball: 5 second cycle, invulnerability while it runs its pattern, and the dash hitting
setup('chess', 'classic');
const phases = new Set();
let invulnerable = null;
for (let i = 0; i < 9 * 60; i++) {
  frame();
  phases.add(red.chessPhase);
  if (red.chessPhase === 'warn' && invulnerable === null) {
    const hp = red.health;
    T.applyDamage(red, 40, red.x, red.y, 0, '#ffffff', 0, 0, false);
    invulnerable = red.health === hp;
  }
  if (red.chessPhase === 'dash' && blue.alive) { blue.x = red.x + 2; blue.y = red.y + 2; }
}
check('chess runs glide, warn, dash and idle', ['glide', 'warn', 'dash', 'idle'].every(p => phases.has(p)), [...phases].join(' > '));
check('chess is invulnerable while it runs its pattern', invulnerable === true);
check('chess dash hits an enemy in its path', red.fx.chessDash > 0, `hits=${red.fx.chessDash}`);

// 2. Verity Ball: hits advance it through the stages
setup('verity', 'classic');
let guard = 0;
while (red.verityStage < 3 && guard++ < 5000) {
  red.health = 100;
  T.applyDamage(red, 1, red.x, red.y, 0, '#ffffff', 0, 0, false);
}
check('verity advances to the monster stage after enough hits', red.verityStage === 3, `stage ${red.verityStage} after ${guard} hits`);
check('verity counts its two transformations', red.fx.transform === 2, `transforms=${red.fx.transform}`);

// 3. Cactus Ball: first set at 3s, a new set every 4s, each cactus lasts 5s, and it hurts on contact
setup('cactus', 'classic');
run(3 * 60 + 5);
const early = api.snapshot();
check('cactus throws its first set of 3 at 3 seconds', red.fx.thrown === 1 && early.cacti === 3, `thrown=${red.fx.thrown} cacti=${early.cacti}`);
run(30);
const landed = T.cacti.find(c => c.grounded);
if (landed) { blue.x = landed.x; blue.y = landed.y; }
run(4);
check('a cactus hurts an enemy that stands on it', red.fx.cactus > 0, `hits=${red.fx.cactus}`);
run(Math.round((9.0 - 3.6) * 60));
const later = api.snapshot();
check('cacti last 5 seconds and the next set arrives every 4 seconds', red.fx.thrown === 2 && later.cacti === 3, `thrown=${red.fx.thrown} cacti=${later.cacti}`);

// 4. Range Ball: an enemy inside the aura takes hits, and the aura grows as it hurts
setup('range', 'classic');
run(30);
const r0 = red.rangeR;
for (let i = 0; i < 150; i++) {
  frame();
  if (blue.alive) { blue.x = red.x + red.rangeR * 0.4; blue.y = red.y; }
}
check('range aura hurts an enemy inside it', red.fx.aura > 0, `ticks=${red.fx.aura}`);
check('range aura grows each time it hurts', red.rangeR > r0, `${Math.round(r0)} -> ${Math.round(red.rangeR)}`);

// 5. Electro King: wall hits plant nodes, and an enemy on a line gets shocked
setup('electroking', 'classic');
T.electroWallHit(red, red.x - 150, red.y - 120);
T.electroWallHit(red, red.x + 150, red.y - 120);
T.electroWallHit(red, red.x, red.y + 150);
const nodes = T.electroNodes.filter(n => n.owner === red);
check('electro king plants a node per wall hit', nodes.length === 3, `nodes=${nodes.length}`);
for (let i = 0; i < 90; i++) {
  if (blue.alive) { blue.x = (nodes[0].x + nodes[1].x) / 2; blue.y = nodes[0].y; }
  frame();
}
check('an enemy touching the shock grid is shocked', red.fx.grid > 0, `shocks=${red.fx.grid}`);
setup('electroking', 'classic');
let maxNodes = 0;
for (let i = 0; i < 10 * 60; i++) { frame(); maxNodes = Math.max(maxNodes, red.fx.nodes); }
check('electro king plants nodes on its own wall hits', maxNodes > 0, `nodes placed=${maxNodes}`);

// 6. Acid Ball: a puddle every 2 seconds, it lands and stays, and poisons whoever stands in it
setup('acid', 'classic');
run(2 * 60 + 20);
check('acid throws a puddle every 2 seconds', red.fx.acid >= 1 && api.snapshot().acidPuddles >= 1,
  `thrown=${red.fx.acid} puddles=${api.snapshot().acidPuddles}`);
run(45);
const puddle = T.acidPuddles.find(p => p.landed);
check('acid puddles land and stay on the floor', !!puddle && puddle.r > 0,
  puddle ? `radius=${Math.round(puddle.r)}` : 'none landed');
if (puddle) {
  const hp0 = blue.health;
  let maxSlow = 0;
  for (let i = 0; i < 100; i++) {
    if (blue.alive) { blue.x = puddle.x; blue.y = puddle.y; blue.vx = 0; blue.vy = 0; }
    frame();
    maxSlow = Math.max(maxSlow, blue.slowTimer);
  }
  check('an enemy inside a puddle is slowed and poisoned', blue.acidStacks.length > 0 && maxSlow > 0.5 && hp0 - blue.health >= 2,
    `stacks=${blue.acidStacks.length} slow=${maxSlow.toFixed(2)} dmg=${hp0 - blue.health}`);
}

// 7. Big Spike Ball: a permanent spike per wall touch, worth 6 damage
setup('bigspike', 'classic');
const spikes0 = T.bigSpikes.length;
T.bigSpikeWallHit(red, red.x - 200, red.y);
T.bigSpikeWallHit(red, red.x + 200, red.y);
check('big spike grows a spike on every wall touch', T.bigSpikes.length === spikes0 + 2,
  `${spikes0} -> ${T.bigSpikes.length}`);
const sp = T.bigSpikes[T.bigSpikes.length - 1];
const hp1 = blue.health;
for (let i = 0; i < 4; i++) {
  blue.x = sp.x + Math.cos(sp.angle) * sp.len * 0.7;
  blue.y = sp.y + Math.sin(sp.angle) * sp.len * 0.7;
  blue.vx = 0; blue.vy = 0;
  red.vx = 0; red.vy = 0;
  frame();
}
check('a spike deals 6 to an enemy that touches it', hp1 - blue.health === 6, `dmg=${hp1 - blue.health}`);

// 8. Cell Ball: 15 health, matures in 3 seconds, then divides instead of dying
setup('cell', 'classic');
blue.alive = false; // park the opponent so the cell can grow undisturbed
check('cell starts small with 15 health', red.health === 15 && red.cellScale < 0.8,
  `hp=${red.health} scale=${red.cellScale}`);
run(3 * 60 + 15);
check('cell reaches maturity after 3 seconds', red.cellMature && Math.abs(red.cellScale - 1) < 0.01,
  `scale=${red.cellScale}`);
const rMature = red.r;
T.applyDamage(red, 999, red.x, red.y, 0, { r: 255, g: 255, b: 255 }, 0, 0, true);
check('a mature cell divides instead of dying', red.alive && red.health === 15 && red.fx.divides === 1 && api.snapshot().cellOrbs === 2,
  `hp=${red.health} orbs=${api.snapshot().cellOrbs} divides=${red.fx.divides}`);
check('division drops it back to the small form', red.r < rMature, `${Math.round(rMature)} -> ${Math.round(red.r)}`);
run(3 * 60 + 15);
T.applyDamage(red, 999, red.x, red.y, 0, { r: 255, g: 255, b: 255 }, 0, 0, true);
check('it divides again while splits remain', red.alive && red.cellSplits === 0, `splits=${red.cellSplits}`);
run(3 * 60 + 15);
T.applyDamage(red, 999, red.x, red.y, 0, { r: 255, g: 255, b: 255 }, 0, 0, true);
check('with no splits left it dies for good', red.health <= 0, `hp=${red.health} alive=${red.alive}`);

// 9. WDC: a 3x3 grid after 3 seconds, and the cell number becomes its contact damage
setup('wdc', 'classic');
blue.alive = false; // its own grid numbers can be lethal, so park the opponent
check('wdc has no grid in the first 3 seconds', red.wdcOn === false);
run(3 * 60 + 20);
const cells = api.snapshot().wdcCells;
check('wdc lays a 3x3 grid after 3 seconds', red.wdcOn && cells.length === 9, `cells=${cells.length}`);
check('every cell holds a number from 1 to 100', cells.length === 9 && cells.every(n => n >= 1 && n <= 100), cells.join(','));
const cellNumber = T.wdcCellAt(red);
check('the number under it becomes its contact damage', T.contactDamageFor(red, 400) === cellNumber, `cell=${cellNumber}`);
run(6 * 60 + 30);
check('the grid disappears after 6 seconds', red.wdcOn === false);
run(3 * 60 + 20);
check('a fresh grid comes 3 seconds later', red.wdcOn === true);

// 10. Hook Ball: snags for 3 and flings the enemy, then repeats on its own
setup('hook', 'classic');
const hp3 = blue.health;
T.hookFire(red, blue);
const flung = Math.hypot(blue.vx, blue.vy);
run(2);
check('hook snags the enemy for 3 and flings it', hp3 - blue.health === 3 && flung > 600,
  `dmg=${hp3 - blue.health} speed=${Math.round(flung)}`);
run(3 * 60);
check('hook fires on its own about every 2.6 seconds', red.fx.hooks >= 2, `hooks=${red.fx.hooks}`);

// 12. Gojo Ball: Blue then Red, Blue's pull, Red's blast, and Hollow Purple when they meet
setup('gojo', 'classic');
run(Math.round(1.5 * 60));
check('gojo casts Blue first', red.fx.gojoBlue === 1 && red.fx.gojoRed === 0, `blue=${red.fx.gojoBlue} red=${red.fx.gojoRed}`);
run(Math.round(0.75 * 60));
check('gojo follows Blue with Red', red.fx.gojoRed === 1, `red=${red.fx.gojoRed}`);

const A = api.arena;
function pullTrial(withOrb) {
  setup('gojo', 'classic');
  red.gojoCd = 99;
  red.x = A.x + red.r * 2; red.y = A.y + red.r * 2; red.vx = 0; red.vy = 400;
  blue.x = A.x + A.w * 0.6; blue.y = A.y + A.h * 0.3; blue.vx = 0; blue.vy = 400;
  if (withOrb) {
    T.gojoCast(red, blue, 'blue', 1);
    const bo = T.gojoOrbs[T.gojoOrbs.length - 1];
    bo.x = blue.x + red.r * 2.6; bo.y = blue.y + red.r * 1.2; bo.vx = 0; bo.vy = 0;
  }
  const ox = blue.x + red.r * 2.6, oy = blue.y + red.r * 1.2;
  run(12);
  return Math.hypot(blue.x - ox, blue.y - oy);
}
const free = pullTrial(false), pulled = pullTrial(true);
check("Blue's gravity drags the enemy toward it", pulled < free - 4, `with Blue ${Math.round(pulled)}px, without ${Math.round(free)}px`);

setup('gojo', 'classic');
red.gojoCd = 99;
T.gojoCast(red, blue, 'red', 1);
const ro = T.gojoOrbs[T.gojoOrbs.length - 1];
const hpR = blue.health;
ro.x = blue.x - blue.r * 0.5; ro.y = blue.y;
frame();
check('Red blasts the enemy for 10', hpR - blue.health === 10 && T.gojoOrbs.length === 0, `dmg=${hpR - blue.health}`);

setup('gojo', 'classic');
red.gojoCd = 99;
red.x = A.x + red.r * 1.5; red.y = A.y + red.r * 1.5; red.vx = red.vy = 0;
blue.x = A.x + A.w - blue.r * 1.5; blue.y = A.y + A.h - blue.r * 1.5; blue.vx = blue.vy = 0;
T.gojoCast(red, blue, 'blue', 1);
T.gojoCast(red, blue, 'red', 1);
const b1 = T.gojoOrbs.find(o => o.kind === 'blue'), r1 = T.gojoOrbs.find(o => o.kind === 'red');
b1.x = A.x + A.w * 0.3; b1.y = A.y + A.h * 0.3; b1.vx = b1.vy = 0;
r1.x = b1.x + 2; r1.y = b1.y; r1.vx = r1.vy = 0;
const hpP = blue.health;
const far = Math.hypot(blue.x - b1.x, blue.y - b1.y);
frame();
check('Red meeting Blue fuses into Hollow Purple', red.fx.purple === 1 && T.gojoOrbs.length === 0 && T.purpleFx.length === 1,
  `purple=${red.fx.purple} orbs=${T.gojoOrbs.length}`);
check('Hollow Purple hits the enemy for 28 from across the arena', hpP - blue.health >= 28,
  `dmg=${hpP - blue.health} at ${Math.round(far)}px away`);

// 13. Battle mode: draft, send out, the bot answers, KO pauses, the winner stays, the loser picks
const koBall = b => {
  for (let k = 0; k < 8 && api.phase === 'play' && b.alive; k++) {
    T.applyDamage(b, 9999, b.x, b.y, 0, { r: 255, g: 255, b: 255 }, 0, 0, true);
  }
};
const toPhase = (want, maxFrames) => { for (let i = 0; i < maxFrames && api.phase !== want; i++) frame(); };
const Bt = T.battle;
T.battleStart();
check('battle opens on the pick screen with 5 random balls a side', api.phase === 'bpick' && Bt.picking === 'red' &&
  Bt.teams.red.length === 5 && Bt.teams.blue.length === 5 && new Set(Bt.teams.red.map(m => m.type)).size === 5,
  Bt.teams.red.map(m => m.type).join(','));
check('the plain classic ball is never drafted', ![...Bt.teams.red, ...Bt.teams.blue].some(m => m.type === 'classic'));
check('nothing is on the field before anyone picks', !red.alive && !blue.alive);
check("the bot's team starts hidden", Bt.teams.blue.every(m => !m.seen));

const rects = T.battleCardRects();
fire('pointerdown', { ...base, clientX: rects[2].x + rects[2].w / 2, clientY: rects[2].y + rects[2].h / 2 });
check('clicking a card sends that ball out', Bt.active.red === 2 && red.type === Bt.teams.red[2].type && red.alive && Bt.picking === 'blue',
  `active=${Bt.active.red} type=${red.type}`);
check('the bot has not picked yet while it thinks', Bt.active.blue === -1 && !blue.alive);
toPhase('aim', 240);
check('the bot answers and the battle resumes', api.phase === 'aim' && Bt.active.blue >= 0 && blue.alive &&
  blue.type === Bt.teams.blue[Bt.active.blue].type, `bot sent ${blue.type}`);
check('only the ball the bot sent out is revealed', Bt.teams.blue.filter(m => m.seen).length === 1 && Bt.teams.blue[Bt.active.blue].seen);

T.shoot();
run(20);
red.health = 37;
const keepPos = { x: red.x, y: red.y };
koBall(blue);
check('a KO pauses the battle', api.phase === 'roundover' && !blue.alive, `phase=${api.phase}`);
check('the fainted ball is marked on its team', Bt.teams.blue.filter(m => m.fainted).length === 1);
toPhase('bpick', 200);
check('the loser chooses next and the winner stays out', api.phase === 'bpick' && Bt.picking === 'blue' && red.alive);
check('the winner keeps its exact health and spot during the pause', red.health === 37 &&
  Math.hypot(red.x - keepPos.x, red.y - keepPos.y) < 0.5, `hp=${red.health} moved=${Math.hypot(red.x - keepPos.x, red.y - keepPos.y).toFixed(2)}`);
toPhase('aim', 240);
check('after the swap the winner still has the same health', api.phase === 'aim' && red.health === 37 && blue.alive &&
  blue.health === blue.maxHealth, `red=${red.health} newcomer=${blue.health}/${blue.maxHealth}`);

T.shoot();
run(10);
blue.health = 51;
koBall(red);
toPhase('bpick', 200);
check('when your ball faints you pick next', api.phase === 'bpick' && Bt.picking === 'red' && blue.alive && blue.health === 51,
  `picking=${Bt.picking} bot hp=${blue.health}`);
check('a fainted ball cannot be picked again', T.battleChoose('red', 2) === false);
fire('keydown', { ...base, key: '1' });
check('number keys pick a ball', Bt.active.red === 0 && red.alive, `active=${Bt.active.red}`);
toPhase('aim', 60);
check('your new ball comes in while the bot keeps its health', api.phase === 'aim' && blue.health === 51);

let rounds = 0;
while (api.phase !== 'bover' && rounds++ < 20) {
  toPhase('aim', 300);
  if (api.phase !== 'aim') break;
  T.shoot();
  run(4);
  koBall(blue);
  toPhase('bpick', 200);
  if (api.phase === 'bpick' && Bt.picking === 'red') fire('keydown', { ...base, key: 'Enter' });
  toPhase('bover', 1);
}
toPhase('bover', 200);
check('running out of balls ends the battle', api.phase === 'bover' && Bt.winner === 'red' && Bt.teams.blue.every(m => m.fainted),
  `phase=${api.phase} winner=${Bt.winner}`);
const ob = T.battleOverButtons();
fire('pointerdown', { ...base, clientX: ob.again.x + ob.again.w / 2, clientY: ob.again.y + ob.again.h / 2 });
check('BATTLE AGAIN drafts fresh teams', api.phase === 'bpick' && Bt.teams.red.every(m => !m.fainted) && Bt.turn === 0);
fire('keydown', { ...base, key: 'Escape' });
check('Esc leaves battle for the menu', api.phase === 'name' && !Bt.on);

// Anime Rivals: select from the real picker, then isolate each ability from body collisions.
fire('pointerdown', { ...base, clientX: 350, clientY: 380 }); // Classic game selection
fire('pointerdown', { ...base, clientX: 400, clientY: 447 }); // Start
for (const id of ['ichigo', 'gurren', 'dio', 'naruto', 'broly', 'vegeta', 'madara', 'saitama', 'shanks']) {
  const item = api.pickerItems.find(p => p.side === 'red' && p.id === id);
  if (item) fire('pointerdown', { ...base, clientX: item.x, clientY: item.y });
  check(`${id} can be equipped from the quick picker`, api.phase === 'aim' && !!item && red.type === id);
}

function animeSetup(type, foeX, foeY = 0.5) {
  setup(type, 'harpoon');
  blue.harpoonCd = Infinity;
  blue.freezeTimer = 30;
  const place = (b, xf, yf) => {
    b.x = A.x + A.w * xf;
    b.y = A.y + A.h * yf;
    b.vx = 0;
    b.vy = 0;
  };
  return (x = foeX, y = foeY) => {
    place(red, 0.25, 0.5);
    place(blue, x, y);
    frame();
  };
}

function animeWait(mode, tick, limit = 400) {
  for (let i = 0; i < limit && red.anime.mode !== mode && api.phase === 'play'; i++) tick();
  return red.anime.mode === mode;
}

let rivalFrame = animeSetup('goku', 0.79);
const gokuTell = animeWait('windup', rivalFrame);
check('Goku charges before doing any beam damage', gokuTell && blue.health === blue.maxHealth);
check('Goku releases Kamehameha after its charge', animeWait('active', rivalFrame) && red.anime.casts === 1);
for (let i = 0; i < 18; i++) rivalFrame();
check('Kamehameha damages an enemy in the beam', red.anime.hits > 1 && blue.health < blue.maxHealth);
red.health = Math.floor(red.maxHealth * 0.61);
rivalFrame();
const goldForm = red.anime.form;
red.health = Math.floor(red.maxHealth * 0.29);
rivalFrame();
check('Goku progresses from Super Saiyan to Super Saiyan Blue', goldForm === 1 && red.anime.form === 2);

rivalFrame = animeSetup('luffy', 0.78);
const smashReady = animeWait('active', rivalFrame);
const beforeSmash = blue.health;
for (let i = 0; i < 45; i++) rivalFrame();
check('Gear 5 Luffy lands one 28-damage Bajrang Gun impact', smashReady && beforeSmash - blue.health === 28 && red.anime.hits === 1,
  `damage=${beforeSmash - blue.health}`);
rivalFrame = animeSetup('luffy', 0.78);
animeWait('active', rivalFrame);
for (let i = 0; i < 37; i++) rivalFrame(0.78, 0.12);
check('Luffy misses if the enemy leaves the marked area', blue.health === blue.maxHealth && red.anime.hits === 0);

rivalFrame = animeSetup('sukuna', 0.455);
check('Sukuna opens Malevolent Shrine after a windup', animeWait('active', rivalFrame));
for (let i = 0; i < 42; i++) rivalFrame(0.90);
const outsideHp = blue.health;
for (let i = 0; i < 39; i++) rivalFrame();
check('Malevolent Shrine leaves enemies outside unharmed', outsideHp === blue.maxHealth);
check('Malevolent Shrine repeatedly hits only while in range', red.anime.hits >= 2 && outsideHp - blue.health === red.anime.hits * 2);
T.applyBallType(red, 'goku', false);
check('Equipping another anime fighter clears the previous attack and form', red.anime.mode === 'rest' && red.anime.casts === 0 && red.anime.form === 0);

// 9 New Anime Ball vs Ball Fighters: verify each signature mechanic and counterplay.
watchedLabels = new Set();
// 1. DIO: stops time inside The World dome, rings 5 knives, then snaps them all into the frozen foe
rivalFrame = animeSetup('dio', 0.44);
blue.freezeTimer = 0;
check('DIO opens The World and stops a foe inside the dome', animeWait('active', rivalFrame) && blue.freezeTimer >= 1.0 && T.animeRivals.shots.length === 5,
  `freeze=${blue.freezeTimer.toFixed(2)} knives=${T.animeRivals.shots.length}`);
check('DIO uses the time-stop reticle for the caught foe only', T.animeRivals.isTimeStopped(blue) && !T.animeRivals.isTimeStopped(red));
const hpBeforeKnives = blue.health;
for (let i = 0; i < 65; i++) rivalFrame(0.44);
check('DIO time-stop knives launch after freezing and hit for 20 total', hpBeforeKnives - blue.health === 20 && red.anime.hits === 5,
  `dmg=${hpBeforeKnives - blue.health} hits=${red.anime.hits}`);

// 2. Madara: Susanoo halves incoming damage and sweeps for 20
rivalFrame = animeSetup('madara', 0.44);
check('Madara awakens Susanoo', animeWait('active', rivalFrame));
const madHp = red.health;
T.applyDamage(red, 20, red.x, red.y, 0, { r: 255, g: 255, b: 255 }, 0, 0, false);
check('Madara Susanoo halves incoming damage while active', madHp - red.health === 10, `dmg=${madHp - red.health}`);
const foeBeforeSusanoo = blue.health;
for (let i = 0; i < 55; i++) rivalFrame(0.44);
check('Madara Susanoo blade sweep strikes for 20', foeBeforeSusanoo - blue.health === 20, `dmg=${foeBeforeSusanoo - blue.health}`);

// 3. Kurama Naruto: Rasenshuriken flies and expands into a 4-hit chakra vortex
rivalFrame = animeSetup('naruto', 0.68);
check('Kurama Naruto throws Rasenshuriken', animeWait('active', rivalFrame) && T.animeRivals.shots.length === 1);
const foeBeforeRasen = blue.health;
for (let i = 0; i < 95; i++) rivalFrame(0.68);
check('Rasenshuriken bursts into a 4-hit (20 dmg) vortex', foeBeforeRasen - blue.health === 20 && red.anime.hits === 4,
  `dmg=${foeBeforeRasen - blue.health} hits=${red.anime.hits}`);

// 4. Saitama: Serious Mode face + 30-damage V-shockwave + off-cone dodge
rivalFrame = animeSetup('saitama', 0.78);
check('Saitama shifts into Serious Mode on windup', animeWait('windup', rivalFrame) && red.anime.form === 1);
animeWait('active', rivalFrame);
const foeBeforePunch = blue.health;
for (let i = 0; i < 20; i++) rivalFrame(0.78);
check('Saitama Serious Punch lands 30 damage inside its shockwave cone', foeBeforePunch - blue.health === 30, `dmg=${foeBeforePunch - blue.health}`);
rivalFrame = animeSetup('saitama', 0.78);
animeWait('active', rivalFrame);
for (let i = 0; i < 25; i++) rivalFrame(0.25, 0.12);
check('Saitama Serious Punch misses rivals outside its cone', blue.health === blue.maxHealth && red.anime.hits === 0);

// 5. Hollow Ichigo: Getsuga Tensho crescent slices for 18
rivalFrame = animeSetup('ichigo', 0.72);
animeWait('active', rivalFrame);
const foeBeforeGetsuga = blue.health;
for (let i = 0; i < 17; i++) rivalFrame(0.72);
const slashTrail = T.animeRivals.shots[0]?.fxTrail;
check('Getsuga leaves a bounded trail along its flight path', slashTrail?.length > 4 && slashTrail.length <= 11);
for (let i = 0; i < 43; i++) rivalFrame(0.72);
check('Hollow Ichigo Getsuga Tensho slices for 18', foeBeforeGetsuga - blue.health === 18 && red.anime.hits === 1, `dmg=${foeBeforeGetsuga - blue.health}`);

// 6. Broly: Gigantic Charge scales higher at low HP
setup('broly', 'harpoon');
blue.harpoonCd = Infinity; blue.freezeTimer = 30;
red.health = 24; // 80% missing HP -> Berserker rage boosts charge above 22
red.x = A.x + A.w * 0.25; red.y = A.y + A.h * 0.5;
blue.x = A.x + A.w * 0.62; blue.y = A.y + A.h * 0.5; blue.vx = blue.vy = 0;
for (let i = 0; i < 220 && red.anime.mode !== 'active'; i++) {
  red.x = A.x + A.w * 0.25; red.y = A.y + A.h * 0.5; red.vx = red.vy = 0;
  blue.x = A.x + A.w * 0.62; blue.y = A.y + A.h * 0.5; frame();
}
const foeBeforeBroly = blue.health;
for (let i = 0; i < 40 && !red.anime.done; i++) { blue.x = A.x + A.w * 0.62; blue.y = A.y + A.h * 0.5; frame(); }
check('Broly Gigantic Charge scales up with Berserker rage at low HP', red.anime.done && foeBeforeBroly - blue.health >= 23,
  `dmg=${foeBeforeBroly - blue.health} form=${red.anime.form}`);

// 7. Ultra Ego Vegeta: taking damage builds Ego stacks and empowers Hakai (14 + 2*5 = 24)
rivalFrame = animeSetup('vegeta', 0.68);
for (let i = 0; i < 5; i++) T.applyDamage(red, 2, red.x, red.y, 0, { r: 255, g: 255, b: 255 }, 0, 0, false);
check('Ultra Ego Vegeta builds 5 Ego stacks when hit', red.anime.ego === 5);
animeWait('active', rivalFrame);
const foeBeforeHakai = blue.health;
for (let i = 0; i < 95; i++) rivalFrame(0.68);
check('Empowered Hakai sphere tracks and implodes for 24', foeBeforeHakai - blue.health === 24, `dmg=${foeBeforeHakai - blue.health}`);

// 8. Gurren Lagann: Giga Drill Break bores rapidly for 5-damage spiral ticks
rivalFrame = animeSetup('gurren', 0.42);
const foeBeforeDrill = blue.health;
animeWait('active', rivalFrame);
for (let i = 0; i < 42; i++) rivalFrame(0.42);
check('Gurren Lagann Giga Drill Break lands rapid 5-damage spiral hits', red.anime.hits >= 3 && foeBeforeDrill - blue.health === red.anime.hits * 5,
  `hits=${red.anime.hits} dmg=${foeBeforeDrill - blue.health}`);

// 9. Shanks: close Conqueror Haki stagger (4) + Divine Departure crescent (20)
rivalFrame = animeSetup('shanks', 0.43);
blue.freezeTimer = 0;
const foeBeforeShanks = blue.health;
animeWait('active', rivalFrame);
const hakiStun = blue.freezeTimer;
for (let i = 0; i < 45; i++) rivalFrame(0.43);
check('Shanks staggers with Conqueror Haki (4) and lands Divine Departure (20)', hakiStun >= 0.3 && foeBeforeShanks - blue.health === 24,
  `stun=${hakiStun.toFixed(2)} dmg=${foeBeforeShanks - blue.health}`);

const titles = ['THE WORLD!', 'SUSANOO!', 'RASENSHURIKEN!', 'SERIOUS PUNCH!', 'GETSUGA TENSHO!', 'GIGANTIC CHARGE!',
  'HAKAI!', 'GIGA DRILL BREAK!', 'DIVINE DEPARTURE!'];
check('each of the nine reworked moves draws a distinct cast title', titles.every(title => watchedLabels.has(title)));
watchedLabels = null;
rivalFrame = animeSetup('naruto', 0.68);
animeWait('active', rivalFrame);
check('the visual front layer is enabled for a live Rasenshuriken', T.animeRivals.hasFrontEffects());
T.resetRound();
check('round reset clears anime projectiles and lingering impact effects', !T.animeRivals.hasFrontEffects() && T.animeRivals.shots.length === 0);

// Every ball in the roster plays a few seconds without throwing.
const src = readFileSync(file, 'utf8');
const order = [...src.match(/const BALL_ORDER = \[([\s\S]*?)\];/)[1].matchAll(/'([a-z]+)'/g)].map(m => m[1]);
let crashed = null;
try {
  for (let i = 0; i < order.length; i++) {
    setup(order[i], order[(i + 7) % order.length]);
    run(4 * 60);
  }
} catch (e) {
  crashed = e;
}
check(`all ${order.length} unique balls play a round without errors`, !crashed && order.length === 50 && new Set(order).size === 50,
  crashed ? String(crashed.stack || crashed).split('\n').slice(0, 3).join(' | ') : '');

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
