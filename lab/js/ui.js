// Game controller: screens, panel UI, drag & drop, Start/Reset, adaptive flow. Draws onto two canvases
// (board + panel) so the same code drives 2D mode and the VR easel/lectern textures.
import { Sim, DT } from './sim.js';
import { PUZZLES } from './puzzles.js';
import { Tutor, CHAPTERS, TIER_NAMES, SKILLS } from './adaptive.js';
import { drawWorld, drawIcon, initPatterns, paper, paperTexture, text, X, Y, S, toWorld, BW, BH, INK, INK2, RED, BRASS, BRASS2, WOOD, WOOD2, GOLD, GREEN, FONT, SEPIA } from './render.js';
export const PW = 432, PH = 1000;
const fmtNum = (x, step) => { if (x == null || Number.isNaN(x)) return '?'; const d = step >= 1 ? 0 : step >= 0.1 ? 1 : 2; return (+x.toFixed(d)).toString(); };

export class Game {
  constructor(board, panel, o = {}) {
    this.bc = board; this.pc = panel; this.b = board.getContext('2d'); this.p = panel.getContext('2d');
    this.images = o.images || {}; this.credits = o.credits || [];
    this.tutor = new Tutor(PUZZLES, o.storage);
    initPatterns(this.b); this.panelPaper = paperTexture(PW, PH, 11);
    this.screen = 'title'; this.overlay = null; this.toastMsg = null; this.toastT = 0; this.t = 0;
    this.drag = null; this.hover = null; this.buttons = { board: [], panel: [] }; this.typing = null;
    this.galleryPage = 0; this.galleryOpen = null; this.dirty = true; this.audio = null; this.onEvent = o.onEvent || (() => { });
    this.sim = null;
  }
  // ---------- puzzle lifecycle ----------
  loadPuzzle(id, o = {}) {
    const P = PUZZLES.find(p => p.id === id); if (!P) return;
    this.P = P; this.v = o.variant || this.tutor.variant(id, o.tier);
    const q = this.v.q;
    this.answer = q.kind === 'number' || q.kind === 'angle' ? (o.answer ?? this.defaultAnswer(q)) : (o.answer ?? null);
    this.placed = new Set(); this.hintLevel = 0; this.hintsUsed = 0; this.result = null; this.adapt = null; this.diag = null;
    this.t0 = performance.now(); this.running = false; this.screen = 'puzzle';
    const st = this.tutor.p(id);
    this.overlay = st.seen <= 1 || o.concept ? 'concept' : null;
    this.typing = null; this.rebuild(); this.dirty = true; this.tutor.s.lastId = id; this.tutor.save();
  }
  defaultAnswer(q) { if (q.kind === 'angle') return 45; const a = Math.abs(q.ans || 1); const m = 10 ** Math.floor(Math.log10(a)); return q.step >= 1 || m >= 1 ? Math.max(q.step, m) : m; }
  rebuild() {
    this.sim = new Sim();
    const a = this.answer ?? 0;
    this.judge = this.P.build(this.sim, this.v, a, this.placed);
    this.running = false; this.dirty = true;
  }
  ready() {
    const req = this.P.bin(this.v).filter(b => b.req);
    for (const b of req) if (!this.placed.has(b.key)) return `Drag the ${b.label} from the parts bin first.`;
    if (this.v.q.kind === 'gear' && !this.answer) return 'Fit a gear onto the empty axle first.';
    if (this.answer == null) return 'Set your number first.';
    return null;
  }
  start() {
    if (this.running) return;
    const msg = this.ready(); if (msg) return this.toast(msg);
    this.commitTyping();
    this.rebuild(); this.running = true; this.runMs = performance.now() - this.t0; this.simAcc = 0; this.result = null; this.sfx('start');
    this.onEvent('start');
  }
  reset() { this.running = false; this.result = null; this.rebuild(); }
  finish(res) {
    this.running = false; this.result = res;
    const a = this.answer;
    this.diag = res.win ? null : (this.P.diagnose?.(this.v, a) || null);
    this.adapt = this.tutor.record(this.P.id, { win: res.win, ms: this.runMs, tier: this.v.tier, hints: this.hintsUsed, answer: a, diag: this.diag });
    if (!res.win) this.hintLevel = Math.max(this.hintLevel, Math.min(3, this.tutor.p(this.P.id).failRow));
    this.resultAt = this.t + 0.9; this.sfx(res.win ? 'win' : 'fail'); this.onEvent(res.win ? 'win' : 'fail');
  }
  update(dt) {
    this.t += dt;
    if (this.toastMsg && this.t > this.toastT) { this.toastMsg = null; this.dirty = true; }
    if (this.running && this.sim) {
      this.simAcc += Math.min(dt, 0.1); let n = 0;
      while (this.simAcc >= DT && n < 8 && this.running) {
        this.simAcc -= DT; n++; this.sim.step(DT);
        const r = this.judge(this.sim); const maxT = typeof this.P.maxT === 'function' ? this.P.maxT(this.v, this.answer) : this.P.maxT;
        if (r) this.finish(r); else if (this.sim.t > maxT) this.finish({ win: false, msg: 'Time ran out: the machine never reached the goal.' });
      }
      this.dirty = true;
    }
    if (this.result && !this.overlay && this.t >= this.resultAt) { this.overlay = 'result'; this.dirty = true; }
  }
  // fast headless run for tests
  runToEnd() { this.start(); let guard = 0; while (this.running && guard++ < 20000) this.update(DT); if (this.result) { this.overlay = 'result'; this.dirty = true; } return this.result; }
  toast(m) { this.toastMsg = m; this.toastT = this.t + 3; this.dirty = true; this.sfx('tap'); }
  setAnswer(a) {
    const q = this.v.q; if (a == null) { this.answer = null; this.rebuild(); return; }
    a = Math.max(q.min ?? -1e9, Math.min(q.max ?? 1e9, a)); a = Math.round(a / q.step) * q.step; a = +a.toFixed(4);
    this.answer = a;
    if (q.kind === 'place') { const bi = this.P.bin(this.v).find(b => b.rail); if (bi) this.placed.add(bi.key); }
    this.rebuild();
  }
  commitTyping() { if (this.typing != null) { const n = parseFloat(this.typing); this.typing = null; if (!Number.isNaN(n)) this.setAnswer(n); } }
  hint() { this.hintLevel = Math.min(3, this.hintLevel + 1); this.hintsUsed++; this.dirty = true; this.sfx('tap'); }
  // ---------- input ----------
  key(k) {
    if (this.screen !== 'puzzle' || this.overlay === 'concept' || this.overlay === 'result') { if (k === 'Enter' || k === ' ') { const b = this.buttons.board.find(x => x.primary) || this.buttons.panel.find(x => x.primary); if (b) b.fn(); } return; }
    if (this.v.q.kind === 'gear') return;
    if (/^[0-9.]$/.test(k)) { this.typing = (this.typing ?? '') + k; this.dirty = true; return; }
    if (k === '-' && !this.typing) { this.typing = '-'; this.dirty = true; return; }
    if (k === 'Backspace') { if (this.typing != null) { this.typing = this.typing.slice(0, -1); if (!this.typing) this.typing = null; this.dirty = true; } return; }
    if (k === 'Enter') { if (this.typing != null) this.commitTyping(); else this.start(); return; }
    if (k === 'Escape') { this.typing = null; this.dirty = true; return; }
    if (k === 'r' || k === 'R') this.reset(); if (k === 'h' || k === 'H') this.hint();
  }
  pointer(type, target, x, y) {
    this.ensureAudio();
    if (type === 'move') { this.hover = { target, x, y }; if (this.drag) { this.drag.target = target; this.drag.x = x; this.drag.y = y; this.dragMove(); } this.dirty = true; return; }
    if (type === 'down') {
      this.hover = { target, x, y };
      const btn = this.buttons[target].slice().reverse().find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h && !b.disabled);
      if (btn) { if (btn.drag) { this.drag = { ...btn.drag, target, x, y }; this.dirty = true; return; } btn.fn(); this.sfx('tap'); this.dirty = true; return; }
      if (this.screen === 'puzzle' && !this.overlay && target === 'board' && !this.running) this.boardGrab(x, y);
      return;
    }
    if (type === 'up') { if (this.drag) { this.dragDrop(); this.drag = null; this.dirty = true; } }
  }
  boardGrab(px, py) {
    const w = toWorld(px, py), bin = this.P.bin(this.v), q = this.v.q;
    const rot = this.P.rotate?.(this.v);
    if (rot && q.kind === 'angle') { const a = (this.answer ?? 45) * Math.PI / 180, hx = rot.x + rot.len * Math.cos(a), hy = rot.y + rot.len * Math.sin(a); if (Math.hypot(w.x - hx, w.y - hy) < 0.8) { this.drag = { kind: 'rotate', rot }; return; } }
    for (const it of bin) {
      if (!this.placed.has(it.key)) continue;
      if (it.rail) { const pos = it.rail.fromAns(this.answer ?? 0); const d = it.rail.axis === 'y' ? Math.hypot(w.x - it.rail.x, w.y - pos) : Math.hypot(w.x - pos, w.y - it.rail.y); if (d < 0.9) { this.drag = { kind: 'rail', item: it }; return; } }
      else if (it.snap && Math.hypot(w.x - it.snap.x, w.y - it.snap.y) < Math.max(0.9, it.snap.r * 0.6)) { this.placed.delete(it.key); if (it.group === 'gear') this.answer = null; this.drag = { kind: 'bin', item: it }; this.rebuild(); return; }
    }
  }
  dragMove() {
    const d = this.drag; if (!d || d.target !== 'board') return;
    const w = toWorld(d.x, d.y);
    if (d.kind === 'rail') { const r = d.item.rail; const pos = r.axis === 'y' ? Math.max(r.y0, Math.min(r.y1, w.y)) : Math.max(r.x0, Math.min(r.x1, w.x)); this.setAnswer(r.toAns(pos)); }
    if (d.kind === 'rotate') { let a = Math.atan2(w.y - d.rot.y, w.x - d.rot.x) * 180 / Math.PI; this.setAnswer(Math.round(a * 2) / 2); }
  }
  dragDrop() {
    const d = this.drag; if (d.kind !== 'bin') return;
    if (d.target !== 'board') return;
    const w = toWorld(d.x, d.y), it = d.item;
    if (it.rail) { const r = it.rail; const pos = r.axis === 'y' ? Math.max(r.y0, Math.min(r.y1, w.y)) : Math.max(r.x0, Math.min(r.x1, w.x)); this.placed.add(it.key); this.setAnswer(r.toAns(pos)); this.sfx('place'); this.onEvent('place'); return; }
    if (it.snap && Math.hypot(w.x - it.snap.x, w.y - it.snap.y) <= it.snap.r) {
      if (it.group) for (const o of this.P.bin(this.v)) if (o.group === it.group) this.placed.delete(o.key);
      this.placed.add(it.key); if (it.teeth) this.answer = it.teeth; this.rebuild(); this.sfx('place'); this.onEvent('place');
    } else this.toast('Not there. Drop it on the glowing spot.');
  }
  placeAll() { for (const it of this.P.bin(this.v)) if (it.req) this.placed.add(it.key); if (this.v.q.kind === 'gear' && this.answer) this.placed.add('g' + this.answer); this.rebuild(); }
  // ---------- audio ----------
  ensureAudio() { if (this.audio || typeof AudioContext === 'undefined') return; try { this.audio = new AudioContext(); } catch { this.audio = null; } }
  sfx(kind) {
    const A = this.audio; if (!A || A.state === 'suspended' && A.resume && (A.resume(), false)) return;
    const tone = (f, t0, d, type = 'sine', g = 0.15) => { const o = A.createOscillator(), G = A.createGain(); o.type = type; o.frequency.value = f; G.gain.setValueAtTime(g, A.currentTime + t0); G.gain.exponentialRampToValueAtTime(0.001, A.currentTime + t0 + d); o.connect(G).connect(A.destination); o.start(A.currentTime + t0); o.stop(A.currentTime + t0 + d); };
    if (kind === 'win') { tone(523, 0, 0.6); tone(659, 0.12, 0.6); tone(784, 0.24, 0.9); tone(1047, 0.36, 1.2, 'triangle', 0.08); }
    else if (kind === 'fail') { tone(196, 0, 0.5, 'triangle'); tone(165, 0.15, 0.6, 'triangle'); }
    else if (kind === 'place') tone(880, 0, 0.12, 'triangle', 0.1);
    else if (kind === 'start') { tone(440, 0, 0.15, 'square', 0.04); tone(660, 0.08, 0.2, 'square', 0.04); }
    else tone(1200, 0, 0.05, 'sine', 0.05);
  }
  // ---------- drawing ----------
  btn(target, x, y, w, h, label, fn, o = {}) {
    const c = target === 'board' ? this.b : this.p; const hov = this.hover && this.hover.target === target && this.hover.x >= x && this.hover.x <= x + w && this.hover.y >= y && this.hover.y <= y + h;
    c.save(); c.beginPath(); c.roundRect(x, y, w, h, o.r ?? 12);
    c.fillStyle = o.disabled ? 'rgba(120,100,70,0.25)' : o.primary ? (hov ? '#6d8a3e' : GREEN) : o.danger ? (hov ? '#b85a3a' : RED) : (hov ? '#c49a45' : (o.fill || '#a77c3a'));
    c.fill(); c.lineWidth = hov ? 4 : 2.5; c.strokeStyle = hov ? GOLD : INK; c.stroke();
    c.restore();
    text(c, label, x + w / 2, y + h / 2 + (o.size || 24) * 0.36, { size: o.size || 24, bold: true, align: 'center', color: o.disabled ? 'rgba(58,39,22,0.5)' : '#fbf1d6' });
    this.buttons[target].push({ x, y, w, h, fn, primary: o.primary, disabled: o.disabled, drag: o.drag, id: o.id || label });
  }
  img(c, key, x, y, w, h, o = {}) {
    const im = this.images[key]; c.save();
    if (im && im.complete && im.naturalWidth) { const s = Math.min(w / im.naturalWidth, h / im.naturalHeight) * (o.cover ? 0 : 1) || Math.max(w / im.naturalWidth, h / im.naturalHeight);
      const dw = im.naturalWidth * s, dh = im.naturalHeight * s; if (o.alpha != null) c.globalAlpha = o.alpha; if (o.sepia) c.filter = 'sepia(0.55) contrast(1.05)';
      c.beginPath(); c.rect(x, y, w, h); c.clip(); c.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); }
    else { c.fillStyle = 'rgba(122,85,48,0.15)'; c.fillRect(x, y, w, h); }
    c.restore();
    if (o.frame) { c.save(); c.strokeStyle = WOOD; c.lineWidth = 7; c.strokeRect(x - 3, y - 3, w + 6, h + 6); c.strokeStyle = GOLD; c.lineWidth = 2; c.strokeRect(x - 7, y - 7, w + 14, h + 14); c.restore(); }
  }
  card(c, x, y, w, h) { c.save(); c.shadowColor = 'rgba(40,20,5,0.45)'; c.shadowBlur = 24; c.fillStyle = '#efdfb9'; c.fillRect(x, y, w, h); c.restore(); c.drawImage(paper(), x, y, w, h, x, y, w, h); c.strokeStyle = WOOD; c.lineWidth = 4; c.strokeRect(x + 8, y + 8, w - 16, h - 16); c.strokeStyle = 'rgba(160,69,42,0.6)'; c.lineWidth = 1.5; c.strokeRect(x + 14, y + 14, w - 28, h - 28); }
  draw() {
    this.buttons = { board: [], panel: [] };
    const b = this.b, p = this.p;
    b.setTransform(this.bc.width / BW, 0, 0, this.bc.height / BH, 0, 0); p.setTransform(this.pc.width / PW, 0, 0, this.pc.height / PH, 0, 0);
    b.drawImage(paper(), 0, 0, BW, BH); p.drawImage(this.panelPaper, 0, 0, PW, PH);
    p.fillStyle = 'rgba(90,55,20,0.10)'; p.fillRect(0, 0, 6, PH);
    if (this.screen === 'title') this.drawTitle();
    else if (this.screen === 'codex') this.drawCodex();
    else if (this.screen === 'gallery') this.drawGallery();
    else this.drawPuzzle();
    if (this.drag && this.drag.kind === 'bin') { const c = this.drag.target === 'board' ? b : p; c.save(); c.globalAlpha = 0.85; drawIcon(c, this.drag.item.icon, this.drag.x, this.drag.y, 90, { teeth: this.drag.item.teeth }); c.restore(); }
    if (this.toastMsg) { b.save(); b.fillStyle = 'rgba(58,39,22,0.9)'; b.beginPath(); b.roundRect(BW / 2 - 330, 900, 660, 64, 14); b.fill(); b.restore(); text(b, this.toastMsg, BW / 2, 941, { size: 25, align: 'center', color: '#fbf1d6', bold: true }); }
    const hv = this.hover; for (const [tg, c] of [['board', b], ['panel', p]]) if (hv && hv.target === tg && this.vrCursor) { c.beginPath(); c.arc(hv.x, hv.y, 9, 0, 7); c.fillStyle = 'rgba(212,160,23,0.85)'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke(); }
    this.dirty = false;
  }
  drawTitle() {
    const b = this.b, keys = ['leonardo_flying_machine', 'archimedes_lever', 'galileo_moon', 'leonardo_gears', 'hero_aeolipile', 'montgolfier_balloon'];
    keys.forEach((k, i) => this.img(b, k, 40 + (i % 3) * 370, 150 + Math.floor(i / 3) * 330, 340, 300, { alpha: 0.32, sepia: true }));
    b.fillStyle = 'rgba(236,220,182,0.55)'; b.fillRect(60, 300, BW - 120, 420);
    text(b, 'Bottega di Ingegneria', BW / 2, 400, { size: 76, align: 'center', bold: true, color: INK });
    text(b, 'The Renaissance Engineering Lab', BW / 2, 456, { size: 34, align: 'center', italic: true, color: RED });
    const steps = ['1.  Read the goal.', '2.  Drag the part in. Set your number.', '3.  Press Start. The machine proves it.'];
    steps.forEach((s, i) => text(b, s, 300, 540 + i * 50, { size: 32, color: INK }));
    text(b, 'Archimedes · Hero · Leonardo · Galileo · Stevin · Torricelli · Boyle · Charles', BW / 2, 940, { size: 22, align: 'center', italic: true, color: INK2 });
    const rec = this.tutor.recommend(), P = PUZZLES.find(x => x.id === rec.id), p = this.p;
    this.img(p, 'leonardo_vitruvian', 66, 40, 300, 360, { frame: true, sepia: true });
    this.btn('panel', 36, 440, 360, 110, '▶  Play', () => this.loadPuzzle(rec.id), { primary: true, size: 40, id: 'play' });
    text(p, `${P.title}`, PW / 2, 585, { size: 22, align: 'center', italic: true });
    this.btn('panel', 36, 620, 360, 80, 'Codex', () => { this.screen = 'codex'; }, { size: 30, id: 'codex' });
    this.btn('panel', 36, 720, 360, 80, 'Gallery', () => { this.screen = 'gallery'; this.galleryOpen = null; }, { size: 30, id: 'gallery' });
    this.btn('panel', 36, 820, 360, 64, this.tutor.s.seated ? 'Seated mode: ON' : 'Seated mode: off', () => { this.tutor.s.seated = !this.tutor.s.seated; this.tutor.save(); this.onEvent('seated'); }, { size: 22, id: 'seated' });
    text(p, `${this.tutor.s.wins} machines proven`, PW / 2, 930, { size: 22, align: 'center', color: INK2 });
  }
  drawCodex() {
    const b = this.b, tu = this.tutor;
    text(b, 'The Codex', 40, 70, { size: 52, bold: true }); text(b, 'Each seal is a machine. Stars = level reached.', 330, 66, { size: 24, italic: true, color: INK2 });
    const rowH = 124;
    CHAPTERS.forEach((ch, ci) => {
      const y = 110 + ci * rowH, pr = tu.chapterProgress(ci);
      b.fillStyle = ci % 2 ? 'rgba(122,85,48,0.07)' : 'rgba(122,85,48,0.13)'; b.fillRect(24, y, BW - 48, rowH - 8);
      text(b, `${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][ci]}. ${ch.latin}`, 40, y + 40, { size: 27, bold: true, color: RED });
      text(b, ch.en, 40, y + 72, { size: 22 }); text(b, ch.who, 40, y + 100, { size: 17, italic: true, color: INK2 });
      PUZZLES.filter(p => p.ch === ci).forEach((P, k) => {
        const cx = 470 + k * 175, cy = y + 50, st = tu.p(P.id), un = tu.unlocked(P.id);
        b.beginPath(); b.arc(cx, cy, 36, 0, 7); b.fillStyle = !un ? 'rgba(120,100,70,0.3)' : st.wins ? RED : WOOD2; b.fill(); b.lineWidth = 3; b.strokeStyle = INK; b.stroke();
        text(b, un ? (st.wins ? '✓' : '?') : '·', cx, cy + 12, { size: 34, align: 'center', bold: true, color: '#fbf1d6' });
        for (let s = 0; s < 4; s++) text(b, s < st.stars ? '★' : '☆', cx - 33 + s * 22, cy + 58, { size: 20, color: s < st.stars ? GOLD : 'rgba(58,39,22,0.4)' });
        b.font = `16px ${FONT}`; b.fillStyle = INK; b.textAlign = 'center'; b.fillText(P.title.length > 20 ? P.title.slice(0, 19) + '…' : P.title, cx, cy - 42);
        if (un) this.buttons.board.push({ x: cx - 70, y: cy - 60, w: 140, h: 130, fn: () => this.loadPuzzle(P.id), id: 'seal-' + P.id });
      });
    });
    const p = this.p, rec = tu.recommend(), RP = PUZZLES.find(x => x.id === rec.id);
    text(p, 'Next up', 30, 60, { size: 30, bold: true });
    text(p, rec.why, 30, 96, { size: 21, italic: true, color: RED });
    this.btn('panel', 26, 116, 380, 90, `▶ ${RP.title}`, () => this.loadPuzzle(rec.id), { primary: true, size: 24, id: 'rec' });
    text(p, 'Weak spots', 30, 260, { size: 28, bold: true });
    const weak = tu.weakSkills().slice(0, 5);
    if (!weak.length) text(p, 'None yet. Keep building!', 30, 300, { size: 21, italic: true });
    weak.forEach((w, i) => { const y = 290 + i * 54; text(p, w.name, 30, y + 6, { size: 21 }); p.fillStyle = 'rgba(58,39,22,0.15)'; p.fillRect(30, y + 16, 370, 14); p.fillStyle = w.score < 0.5 ? RED : GREEN; p.fillRect(30, y + 16, 370 * w.score, 14); });
    this.btn('panel', 26, 580, 380, 70, tu.s.freeRoam ? 'Free roam: ON' : 'Free roam: off', () => { tu.s.freeRoam = !tu.s.freeRoam; tu.save(); }, { size: 22, id: 'freeroam' });
    this.btn('panel', 26, 665, 380, 70, 'Gallery', () => { this.screen = 'gallery'; this.galleryOpen = null; }, { size: 24, id: 'gallery' });
    this.btn('panel', 26, 750, 380, 70, 'Back', () => { this.screen = this.P ? 'puzzle' : 'title'; }, { size: 24, id: 'back' });
    this.btn('panel', 26, 900, 380, 56, this.confirmReset ? 'Tap again to erase all progress' : 'Reset progress', () => { if (this.confirmReset) { tu.reset(); this.confirmReset = false; } else this.confirmReset = true; }, { size: 20, danger: true, id: 'reset-progress' });
  }
  drawGallery() {
    const b = this.b, cr = this.credits, per = 12, pages = Math.ceil(cr.length / per);
    if (this.galleryOpen != null) {
      const c = cr[this.galleryOpen];
      this.img(b, c.key, 60, 70, BW - 120, 720, { frame: true });
      text(b, c.caption, BW / 2, 850, { size: 30, align: 'center', bold: true });
      text(b, `${c.credit_name}${c.date ? ' · ' + c.date.replace(/date QS.*$/, '').slice(0, 30) : ''} · Public domain (Wikimedia Commons)`, BW / 2, 890, { size: 20, align: 'center', italic: true, color: INK2 });
      this.buttons.board.push({ x: 0, y: 0, w: BW, h: BH, fn: () => { this.galleryOpen = null; }, id: 'close-art' });
    } else {
      text(b, 'Gallery of the Masters', 40, 70, { size: 48, bold: true });
      const start = this.galleryPage * per;
      cr.slice(start, start + per).forEach((c, i) => { const x = 40 + (i % 4) * 274, y = 110 + Math.floor(i / 4) * 290; this.img(b, c.key, x + 8, y + 8, 250, 220, { frame: true });
        text(b, c.caption.length > 30 ? c.caption.slice(0, 29) + '…' : c.caption, x + 133, y + 262, { size: 17, align: 'center' });
        this.buttons.board.push({ x, y, w: 266, h: 280, fn: () => { this.galleryOpen = start + i; }, id: 'art-' + c.key }); });
      text(b, `page ${this.galleryPage + 1} / ${pages}`, BW / 2, 985, { size: 20, align: 'center', italic: true });
    }
    const p = this.p;
    text(p, 'Gallery', 30, 64, { size: 34, bold: true }); text(p, 'Real drawings by the people', 30, 104, { size: 21, italic: true }); text(p, 'whose ideas run these machines.', 30, 132, { size: 21, italic: true });
    this.btn('panel', 26, 180, 180, 80, '◀ Prev', () => { this.galleryOpen = null; this.galleryPage = (this.galleryPage + pages - 1) % pages; }, { size: 24, id: 'prev' });
    this.btn('panel', 226, 180, 180, 80, 'Next ▶', () => { this.galleryOpen = null; this.galleryPage = (this.galleryPage + 1) % pages; }, { size: 24, id: 'next' });
    this.btn('panel', 26, 290, 380, 76, 'Codex', () => { this.screen = 'codex'; }, { size: 26, id: 'codex' });
    this.btn('panel', 26, 386, 380, 76, 'Back', () => { this.screen = this.P ? 'puzzle' : 'title'; }, { size: 26, id: 'back' });
    text(p, 'All images: public domain,', 30, 900, { size: 18, color: INK2 }); text(p, 'Wikimedia Commons. See CREDITS.md', 30, 924, { size: 18, color: INK2 });
  }
  drawPuzzle() {
    const b = this.b, P = this.P, v = this.v, q = v.q, st = this.tutor.p(P.id);
    this.img(b, P.img, BW - 470, 130, 440, 420, { alpha: 0.13, sepia: true });
    b.fillStyle = 'rgba(122,85,48,0.16)'; b.fillRect(0, 0, BW, 112); b.fillStyle = WOOD; b.fillRect(0, 110, BW, 4);
    text(b, `${CHAPTERS[P.ch].latin} · ${P.title}`, 24, 44, { size: 32, bold: true });
    text(b, (P.goal(v) || ''), 24, 90, { size: 28, color: RED, bold: true });
    text(b, `${TIER_NAMES[v.tier]}`, BW - 24, 40, { size: 22, align: 'right', italic: true });
    for (let s = 0; s < 4; s++) text(b, s < st.stars ? '★' : '☆', BW - 120 + s * 26, 76, { size: 24, color: s < st.stars ? GOLD : 'rgba(58,39,22,0.4)' });
    drawWorld(b, this.sim, this.t);
    // drop targets
    if (!this.running) for (const it of P.bin(v)) {
      const show = this.drag?.kind === 'bin' ? this.drag.item.key === it.key : !this.placed.has(it.key) && !(it.group && this.answer);
      if (!show) continue;
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 4);
      if (it.snap) { b.beginPath(); b.arc(X(it.snap.x), Y(it.snap.y), 40 + pulse * 8, 0, 7); b.setLineDash([8, 6]); b.strokeStyle = `rgba(212,160,23,${0.5 + pulse * 0.5})`; b.lineWidth = 4; b.stroke(); b.setLineDash([]); }
      if (it.rail) { const r = it.rail; b.setLineDash([8, 6]); b.strokeStyle = `rgba(212,160,23,${0.5 + pulse * 0.5})`; b.lineWidth = 5; b.beginPath(); if (r.axis === 'y') { b.moveTo(X(r.x), Y(r.y0)); b.lineTo(X(r.x), Y(r.y1)); } else { b.moveTo(X(r.x0), Y(r.y)); b.lineTo(X(r.x1), Y(r.y)); } b.stroke(); b.setLineDash([]); }
    }
    if (!this.running) for (const it of P.bin(v)) if (it.rail && this.placed.has(it.key)) { const r = it.rail, pos = r.fromAns(this.answer ?? 0); const hx = r.axis === 'y' ? r.x : pos, hy = r.axis === 'y' ? pos : r.y; b.beginPath(); b.arc(X(hx), Y(hy), 16, 0, 7); b.fillStyle = 'rgba(212,160,23,0.85)'; b.fill(); b.strokeStyle = INK; b.lineWidth = 2; b.stroke(); text(b, '⇔', X(hx), Y(hy) + 7, { size: 20, align: 'center', bold: true }); text(b, `${fmtNum(this.answer, q.step)} ${q.unit}`, X(hx), Y(hy) - 26, { size: 22, bold: true, align: 'center', color: RED }); }
    const rot = P.rotate?.(v);
    if (rot && q.kind === 'angle' && !this.running) { const a = (this.answer ?? 45) * Math.PI / 180, hx = rot.x + rot.len * Math.cos(a), hy = rot.y + rot.len * Math.sin(a); b.beginPath(); b.arc(X(hx), Y(hy), 18, 0, 7); b.fillStyle = 'rgba(212,160,23,0.85)'; b.fill(); b.strokeStyle = INK; b.lineWidth = 2; b.stroke(); text(b, '↻', X(hx), Y(hy) + 8, { size: 24, align: 'center', bold: true }); }
    if (this.running) text(b, `t = ${this.sim.t.toFixed(1)} s`, 24, 150, { size: 22, italic: true, color: INK2 });
    if (this.overlay === 'concept') this.drawConcept();
    if (this.overlay === 'result') this.drawResult();
    this.drawPanel();
  }
  drawConcept() {
    const b = this.b, P = this.P;
    b.fillStyle = 'rgba(30,18,6,0.45)'; b.fillRect(0, 0, BW, BH);
    this.card(b, 110, 140, BW - 220, 680);
    this.img(b, P.img, 150, 200, 330, 440, { frame: true });
    text(b, 'Concept', 520, 230, { size: 26, italic: true, color: RED });
    text(b, P.title, 520, 280, { size: 38, bold: true, max: 480 });
    let y = text(b, P.concept.line, 520, 350, { size: 30, max: 470, lh: 38 });
    b.fillStyle = 'rgba(160,69,42,0.1)'; b.fillRect(510, y, 500, 110);
    text(b, P.concept.formula, 760, y + 66, { size: P.concept.formula.length > 34 ? 22 : 30, align: 'center', bold: true, max: 480 });
    text(b, `"${P.quote}"`, 520, y + 160, { size: 22, italic: true, max: 470, color: INK2 });
    text(b, `— ${P.who}`, 1000, y + 228, { size: 20, align: 'right', italic: true });
    this.btn('board', BW / 2 - 150, 730, 300, 72, 'Got it ▶', () => { this.overlay = null; }, { primary: true, size: 30, id: 'gotit' });
  }
  drawResult() {
    const b = this.b, r = this.result, P = this.P;
    if (!r) { this.overlay = null; return; }
    b.fillStyle = 'rgba(30,18,6,0.35)'; b.fillRect(0, 0, BW, BH);
    this.card(b, 160, 170, BW - 320, 620);
    const cx = BW / 2;
    if (r.win) {
      b.save(); b.translate(cx, 300); b.rotate(-0.12); b.beginPath(); for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, rr = i % 2 ? 78 : 88; b.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } b.closePath(); b.fillStyle = '#9b2d20'; b.fill(); b.beginPath(); b.arc(0, 0, 62, 0, 7); b.strokeStyle = 'rgba(255,220,200,0.6)'; b.lineWidth = 3; b.stroke();
      text(b, 'PROBATUM', 0, -4, { size: 24, bold: true, align: 'center', color: '#fbe9d6' }); text(b, 'EST', 0, 26, { size: 24, bold: true, align: 'center', color: '#fbe9d6' }); b.restore();
      text(b, 'It is proven!', cx, 440, { size: 46, bold: true, align: 'center', color: GREEN });
      text(b, r.msg, cx, 495, { size: 27, align: 'center', max: 700 });
      if (this.adapt) text(b, this.adapt.text, cx, 560, { size: 25, align: 'center', italic: true, color: RED, max: 700 });
      const st = this.tutor.p(P.id); for (let s = 0; s < 4; s++) text(b, s < st.stars ? '★' : '☆', cx - 60 + s * 40, 625, { size: 36, color: s < st.stars ? GOLD : 'rgba(58,39,22,0.4)' });
      const nx = this.tutor.next(P.id);
      this.btn('board', cx - 330, 680, 300, 76, 'Next machine ▶', () => this.loadPuzzle(nx), { primary: true, size: 27, id: 'next' });
      this.btn('board', cx + 30, 680, 300, 76, 'Another one ↻', () => this.loadPuzzle(P.id), { size: 27, id: 'again' });
    } else {
      text(b, 'Not yet!', cx, 270, { size: 50, bold: true, align: 'center', color: RED });
      let y = text(b, r.msg, cx, 330, { size: 28, align: 'center', max: 720 });
      text(b, `You said ${fmtNum(this.answer, this.v.q.step)} ${this.v.q.unit}.`, cx, y + 10, { size: 22, align: 'center', italic: true });
      y += 70;
      if (this.diag) { b.fillStyle = 'rgba(160,69,42,0.12)'; b.fillRect(220, y - 36, BW - 440, 76); y = text(b, this.diag, cx, y + 10, { size: 25, align: 'center', color: RED, bold: true, max: 680 }) + 20; }
      const hl = Math.max(1, this.hintLevel), hints = P.hints(this.v);
      y = text(b, `Hint: ${hints[Math.min(hl, 3) - 1]}`, cx, y + 20, { size: 24, align: 'center', max: 700 });
      const k = this.adapt?.kind;
      if (k === 'easier' || k === 'worked') {
        if (k === 'worked') text(b, `Solution: ${hints[2]}`, cx, y + 20, { size: 23, align: 'center', max: 700, color: GREEN, bold: true });
        this.btn('board', cx - 330, 680, 300, 76, k === 'easier' ? 'Easier one ▶' : 'Fresh one ▶', () => this.loadPuzzle(P.id), { primary: true, size: 27, id: 'easier' });
        this.btn('board', cx + 30, 680, 300, 76, 'Try this again', () => { this.overlay = null; this.reset(); }, { size: 25, id: 'retry' });
      } else this.btn('board', cx - 160, 680, 320, 76, 'Try again ↻', () => { this.overlay = null; this.reset(); }, { primary: true, size: 28, id: 'retry' });
    }
  }
  drawPanel() {
    const p = this.p, P = this.P, v = this.v, q = v.q;
    this.img(p, P.img, 22, 22, 96, 110, { frame: true, sepia: true });
    text(p, P.who, 136, 44, { size: 22, bold: true, max: 280, lh: 24 });
    text(p, `"${P.quote}"`, 136, P.who.length > 22 ? 98 : 74, { size: 17, italic: true, max: 280, lh: 20, color: INK2 });
    p.fillStyle = 'rgba(122,85,48,0.12)'; p.fillRect(16, 150, PW - 32, 22 + v.given.length * 32);
    v.given.forEach((g, i) => text(p, g, 28, 180 + i * 32, { size: g.length > 34 ? 18 : 21 }));
    let y = 196 + v.given.length * 32;
    y = text(p, q.text, 24, y + 10, { size: 24, bold: true, max: PW - 48, lh: 28, color: RED });
    // value box
    const vy = y; p.fillStyle = '#f8eed3'; p.fillRect(24, vy, PW - 48, 70); p.strokeStyle = this.typing != null ? GOLD : INK; p.lineWidth = this.typing != null ? 4 : 2.5; p.strokeRect(24, vy, PW - 48, 70);
    const shown = this.typing != null ? this.typing + (Math.floor(this.t * 2) % 2 ? '|' : '') : fmtNum(this.answer, q.step);
    text(p, `${shown}  ${q.unit}`, PW / 2, vy + 50, { size: 40, bold: true, align: 'center' });
    y = vy + 82;
    const dis = this.running;
    if (q.kind === 'gear') {
      const ch = q.choices, i = ch.indexOf(this.answer);
      this.btn('panel', 24, y, 186, 60, '◀ fewer', () => { const nx = ch[Math.max(0, (i < 0 ? 1 : i) - 1)]; this.answer = nx; for (const c of ch) this.placed.delete('g' + c); this.placed.add('g' + nx); this.rebuild(); }, { size: 22, disabled: dis, id: 'dial-' });
      this.btn('panel', 222, y, 186, 60, 'more ▶', () => { const nx = ch[Math.min(ch.length - 1, i + 1)]; this.answer = nx; for (const c of ch) this.placed.delete('g' + c); this.placed.add('g' + nx); this.rebuild(); }, { size: 22, disabled: dis, id: 'dial+' });
    } else {
      const st = q.step, steps = st >= 1 ? [10, 1] : st >= 0.1 ? [1, 0.1] : [1, 0.1, 0.01];
      const all = [...steps.map(s => -s), ...steps.slice().reverse()], w = (PW - 48 - (all.length - 1) * 6) / all.length;
      all.forEach((d, k) => this.btn('panel', 24 + k * (w + 6), y, w, 60, `${d > 0 ? '+' : '−'}${+Math.abs(d).toFixed(2)}`, () => { this.typing = null; this.setAnswer((this.answer ?? 0) + d); }, { size: all.length > 4 ? 19 : 22, disabled: dis, id: `dial${d > 0 ? '+' : '-'}${Math.abs(d)}` }));
    }
    y += 76;
    this.btn('panel', 24, y, 214, 84, this.running ? 'Running…' : '▶ Start', () => this.start(), { primary: true, size: 32, disabled: this.running, id: 'start' });
    this.btn('panel', 248, y, 76, 84, '↺', () => { this.overlay = null; this.reset(); }, { size: 34, id: 'reset' });
    this.btn('panel', 332, y, 76, 84, '?', () => this.hint(), { size: 34, id: 'hint' });
    y += 100;
    if (this.hintLevel > 0) { const h = P.hints(v); p.fillStyle = 'rgba(160,69,42,0.1)'; p.fillRect(16, y - 6, PW - 32, 118); text(p, `Hint ${this.hintLevel}/3`, 26, y + 18, { size: 18, italic: true, color: RED }); text(p, h[this.hintLevel - 1], 26, y + 46, { size: 20, max: PW - 56, lh: 24, color: INK }); y += 124; }
    // parts bin
    const binY = Math.max(y, 700);
    text(p, 'Parts bin', 24, binY + 6, { size: 22, bold: true }); text(p, 'drag onto the board', 140, binY + 6, { size: 17, italic: true, color: INK2 });
    const items = P.bin(v), cols = items.length > 2 ? 3 : 2, tw = (PW - 48 - (cols - 1) * 8) / cols, th = 96;
    items.forEach((it, k) => {
      const x = 24 + (k % cols) * (tw + 8), yy = binY + 18 + Math.floor(k / cols) * (th + 8), used = this.placed.has(it.key);
      p.fillStyle = used ? 'rgba(79,107,46,0.18)' : 'rgba(168,115,61,0.25)'; p.fillRect(x, yy, tw, th); p.strokeStyle = used ? GREEN : INK; p.lineWidth = 2; p.strokeRect(x, yy, tw, th);
      drawIcon(p, it.icon, x + tw / 2, yy + 40, 64, { teeth: it.teeth });
      text(p, used ? '✓ ' + it.label : it.label, x + tw / 2, yy + th - 10, { size: 17, align: 'center', bold: used });
      if (!this.running) this.buttons.panel.push({ x, y: yy, w: tw, h: th, fn: () => { }, drag: { kind: 'bin', item: it }, id: 'bin-' + it.key });
    });
    const fy = PH - 70;
    this.btn('panel', 24, fy, 124, 54, 'Codex', () => { this.screen = 'codex'; }, { size: 21, id: 'codex' });
    this.btn('panel', 156, fy, 124, 54, 'Concept', () => { this.overlay = 'concept'; }, { size: 21, id: 'concept' });
    this.btn('panel', 288, fy, 120, 54, 'Gallery', () => { this.screen = 'gallery'; this.galleryOpen = null; }, { size: 21, id: 'gallery' });
  }
}
