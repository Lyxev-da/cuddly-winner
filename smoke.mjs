// Headless play-test: boots the engine on a mocked canvas, starts a match,
// launches, and reports distinct damage popups. Usage: node scripts/smoke.mjs <engine.js> [frames]
const noop = () => {};
let rafCb = null;
const fills = [];
function makeCtx(canvas) {
  const grad = { addColorStop: noop };
  return new Proxy({}, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === 'canvas') return canvas;
      if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => grad;
      if (p === 'measureText') return () => ({ width: 42 });
      if (p === 'getLineDash') return () => [];
      if (p === 'fillText') return (txt) => { fills.push(String(txt)); };
      return () => undefined;
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}
function makeCanvas() {
  const listeners = {}; const cls = new Set();
  const c = {
    width: 800, height: 600, style: {},
    classList: { toggle: (n, on) => on ? cls.add(n) : cls.delete(n), add: n => cls.add(n), remove: n => cls.delete(n), contains: n => cls.has(n) },
    addEventListener: (t, f) => { (listeners[t] ||= []).push(f); }, removeEventListener: noop,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 }),
    setPointerCapture: noop, releasePointerCapture: noop,
    getContext: () => (c._ctx ||= makeCtx(c)), _listeners: listeners
  };
  return c;
}
const canvas = makeCanvas(); const win = {};
global.window = { addEventListener: (t, f) => { (win[t] ||= []).push(f); }, removeEventListener: noop, innerWidth: 800, innerHeight: 600, devicePixelRatio: 1 };
global.document = { getElementById: id => (id === 'c' ? canvas : null), createElement: () => makeCanvas(), addEventListener: noop, body: { appendChild: noop, style: {} }, documentElement: { style: {} } };
global.localStorage = { getItem: () => null, setItem: noop, removeItem: noop };
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = cb => { rafCb = cb; return 1; };
global.cancelAnimationFrame = noop; global.devicePixelRatio = 1; global.navigator = { userAgent: 'node' };

const file = process.argv[2];
const frames = parseInt(process.argv[3] || '2400', 10);
const mod = await import(file);
mod.initGame();
let t = performance.now();
const run = n => { for (let i = 0; i < n; i++) { t += 16.67; const cb = rafCb; rafCb = null; if (!cb) throw new Error('no raf'); cb(t); } };
const fire = (type, ev) => { (win[type] || []).forEach(f => f(ev)); (canvas._listeners[type] || []).forEach(f => f(ev)); };
const base = { clientX: 400, clientY: 300, pointerId: 1, pointerType: 'mouse', preventDefault: noop, stopPropagation: noop, button: 0, key: '', repeat: false };
run(60);
fire('pointerdown', { ...base, clientX: 400, clientY: 380 }); fire('pointerup', { ...base, clientX: 400, clientY: 380 }); // START
run(5);
for (let i = 0; i < 30; i++) fire('keydown', { ...base, key: 'd' });
run(20); fire('keyup', { ...base, key: 'd' });
fire('keydown', { ...base, key: ' ' }); run(600); fire('keyup', { ...base, key: ' ' });
run(frames);
const dmg = [...new Set(fills.filter(f => /^-\d+$/.test(f)))];
const lv = [...new Set(fills.filter(f => /^LV ?\d+$/.test(f)))];
console.log(file.split('/').pop(), '| damage popups:', dmg.join(',') || 'none', lv.length ? '| blade levels: ' + lv.join(',') : '');
