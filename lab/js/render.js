// Sepia-ink renderer for the puzzle board (Canvas 2D). Shared by 2D mode and the VR easel texture.
import { submerged, fixtureWorldPoly } from './sim.js';
export const INK = '#3a2716', INK2 = '#5b4127', SEPIA = '#7a5530', BRASS = '#b88a2e', BRASS2 = '#e0b85a', WOOD = '#8b5a2b', WOOD2 = '#a8733d',
  RED = '#a0452a', WATER = 'rgba(64,110,140,0.38)', WATER2 = 'rgba(40,80,110,0.7)', PAPER = '#ecdcb6', PAPER2 = '#e2cd9e', GOLD = '#d4a017', GREEN = '#4f6b2e';
export const FONT = '"IM Fell English", "Palatino Linotype", Palatino, Georgia, serif';
export const BW = 1168, BH = 1000, S = 96, OX = 8, OY = 990;
export const X = x => OX + x * S, Y = y => OY - y * S;
export const toWorld = (px, py) => ({ x: (px - OX) / S, y: (OY - py) / S });

let _paper = null, _hatch = null, _hatchR = null;
export function paperTexture(w, h, seed = 7) {
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.75);
  grd.addColorStop(0, '#f1e3c0'); grd.addColorStop(0.7, '#e6d2a4'); grd.addColorStop(1, '#c9ab72');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < w * h / 90; i++) { g.fillStyle = `rgba(${90 + rnd() * 60},${60 + rnd() * 40},${20 + rnd() * 30},${rnd() * 0.06})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2.5, 1 + rnd() * 2.5); }
  for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(120,80,30,${0.02 + rnd() * 0.04})`; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 20 + rnd() * 90, 15 + rnd() * 60, rnd() * 3, 0, 7); g.fill(); }
  return c;
}
function hatch(ctx, color = 'rgba(58,39,22,0.35)', gap = 7) {
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(gap * 4, gap * 4) : Object.assign(document.createElement('canvas'), { width: gap * 4, height: gap * 4 });
  const g = c.getContext('2d'); g.strokeStyle = color; g.lineWidth = 1.2;
  for (let i = -4; i < 8; i++) { g.beginPath(); g.moveTo(i * gap, 0); g.lineTo(i * gap + gap * 4, gap * 4); g.stroke(); }
  return ctx.createPattern(c, 'repeat');
}
export function initPatterns(ctx) { _hatch = hatch(ctx); _hatchR = hatch(ctx, 'rgba(160,69,42,0.35)', 6); _paper = paperTexture(BW, BH); }
export function paper() { return _paper; }

export function text(ctx, s, x, y, o = {}) {
  ctx.font = `${o.italic ? 'italic ' : ''}${o.bold ? 'bold ' : ''}${o.size || 22}px ${FONT}`;
  ctx.fillStyle = o.color || INK; ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.base || 'alphabetic';
  if (o.max) { const words = String(s).split(' '); let line = '', yy = y; const lh = o.lh || (o.size || 22) * 1.2; let n = 0;
    for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > o.max && line) { ctx.fillText(line, x, yy); yy += lh; line = w; n++; } else line = t; }
    ctx.fillText(line, x, yy); return yy + lh; }
  ctx.fillText(s, x, y); return y + (o.size || 22) * 1.2;
}
function poly(ctx, pts, fill, stroke = INK, lw = 2.2) {
  ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y))); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(); }
}
function hatchPoly(ctx, pts, pat) { ctx.save(); ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y))); ctx.closePath(); ctx.fillStyle = pat || _hatch; ctx.fill(); ctx.restore(); }
function line(ctx, pts, color = INK, lw = 2, dash) { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]); }
function circ(ctx, x, y, r, fill, stroke = INK, lw = 2) { ctx.beginPath(); ctx.arc(X(x), Y(y), r * S, 0, 7); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); } }
function rope(ctx, pts) { line(ctx, pts, '#6b4f2a', 3); line(ctx, pts, 'rgba(240,220,170,0.5)', 1, [4, 5]); }

export function drawGear(ctx, x, y, r, N, ang, o = {}) {
  const px = X(x), py = Y(y), R = r * S, tooth = Math.max(5, Math.min(12, 2 * Math.PI * R / N * 0.42));
  ctx.save(); ctx.translate(px, py); ctx.rotate(-ang);
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    const a0 = i / N * Math.PI * 2, a1 = (i + 0.25) / N * Math.PI * 2, a2 = (i + 0.5) / N * Math.PI * 2, a3 = (i + 0.75) / N * Math.PI * 2;
    const ri = R - tooth * 0.55, ro = R + tooth * 0.55;
    ctx.lineTo(Math.cos(a0) * ri, Math.sin(a0) * ri); ctx.lineTo(Math.cos(a1) * ro, Math.sin(a1) * ro); ctx.lineTo(Math.cos(a2) * ro, Math.sin(a2) * ro); ctx.lineTo(Math.cos(a3) * ri, Math.sin(a3) * ri);
  }
  ctx.closePath(); ctx.fillStyle = o.fill || BRASS; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, R * 0.72, 0, 7); ctx.strokeStyle = 'rgba(58,39,22,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
  const spokes = N > 20 ? 6 : 4;
  for (let i = 0; i < spokes; i++) { const a = i / spokes * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * R * 0.15, Math.sin(a) * R * 0.15); ctx.lineTo(Math.cos(a) * R * 0.7, Math.sin(a) * R * 0.7); ctx.lineWidth = Math.max(3, R * 0.08); ctx.strokeStyle = 'rgba(90,60,20,0.8)'; ctx.stroke(); }
  ctx.beginPath(); ctx.arc(0, 0, Math.max(6, R * 0.14), 0, 7); ctx.fillStyle = WOOD; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
  if (o.hand) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(R * 0.95, 0); ctx.strokeStyle = RED; ctx.lineWidth = 6; ctx.stroke(); ctx.beginPath(); ctx.arc(R * 0.95, 0, 7, 0, 7); ctx.fillStyle = RED; ctx.fill(); }
  if (o.label) { ctx.rotate(ang); ctx.font = `bold ${Math.max(14, Math.min(22, R * 0.3))}px ${FONT}`; ctx.fillStyle = '#2a1a0c'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.label, 0, R * 0.42); }
  ctx.restore();
}
function weightShape(ctx, cx, cy, w, h, ang, label, mine) {
  ctx.save(); ctx.translate(X(cx), Y(cy)); ctx.rotate(-ang);
  const W = w * S, H = h * S;
  ctx.beginPath(); ctx.moveTo(-W * 0.38, -H / 2); ctx.lineTo(W * 0.38, -H / 2); ctx.lineTo(W / 2, H / 2); ctx.lineTo(-W / 2, H / 2); ctx.closePath();
  ctx.fillStyle = mine ? '#6d7b84' : '#5a5148'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -H / 2 - 6, 7, Math.PI, 0); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
  if (mine) { ctx.strokeStyle = GOLD; ctx.lineWidth = 3; ctx.strokeRect(-W / 2 + 3, -H / 2 + 3, W - 6, H - 6); }
  if (label) { ctx.font = `bold ${Math.max(13, Math.min(20, W * 0.32))}px ${FONT}`; ctx.fillStyle = '#f4e6c6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 0, 2); }
  ctx.restore();
}
function boxPts(b, fx) { return fixtureWorldPoly(b, fx); }

function drawBody(ctx, b, t) {
  const u = b.getUserData(); if (u.draw === false) return;
  const p = b.getPosition(), a = b.getAngle();
  const fx0 = b.getFixtureList();
  switch (u.kind) {
    case 'floor': { const pts = boxPts(b, fx0); poly(ctx, pts, WOOD, INK, 2); hatchPoly(ctx, pts); for (let x = 0.4; x < 12; x += 1.2) line(ctx, [[x, 0.3], [x, 0]], 'rgba(58,39,22,0.5)', 1.5); return; }
    case 'stand': case 'gantry': case 'pedestal': case 'table': { const pts = boxPts(b, fx0); poly(ctx, pts, u.kind === 'table' ? WOOD2 : WOOD, INK, 2); hatchPoly(ctx, pts); return; }
    case 'tankwall': { const pts = boxPts(b, fx0); poly(ctx, pts, '#9b8a70', INK, 2); return; }
    case 'bucketwall': case 'stopblock': { const pts = boxPts(b, fx0); poly(ctx, pts, u.kind === 'stopblock' ? RED : WOOD, INK, 2); return; }
    case 'rock': { const pts = boxPts(b, fx0); poly(ctx, pts, '#8d8270', INK, 2.5); hatchPoly(ctx, pts); return; }
    case 'bridge': { const pts = boxPts(b, fx0); poly(ctx, pts, '#b9a27a', INK, 2.5); for (let i = 0; i < 4; i++) line(ctx, [[p.x - 0.6 + i * 0.4, p.y - 0.25], [p.x - 0.6 + i * 0.4, p.y + 0.25]], INK2, 1.2); return; }
    case 'crown': {
      const pts = boxPts(b, fx0); poly(ctx, pts, GOLD, INK, 2.5);
      const w = u.w, h = u.h, top = p.y + h / 2, x0 = p.x - w / 2;
      const crown = [{ x: x0 + w * 0.1, y: top - h * 0.15 }, { x: x0 + w * 0.1, y: top + 0.25 }, { x: x0 + w * 0.3, y: top + 0.08 }, { x: x0 + w * 0.5, y: top + 0.32 }, { x: x0 + w * 0.7, y: top + 0.08 }, { x: x0 + w * 0.9, y: top + 0.25 }, { x: x0 + w * 0.9, y: top - h * 0.15 }];
      poly(ctx, crown, BRASS2, INK, 2); circ(ctx, p.x, top - h * 0.35, 0.08, RED, INK, 1.5);
      return;
    }
    case 'barge': {
      for (let fx = b.getFixtureList(); fx; fx = fx.getNext()) {
        const fu = fx.getUserData() || {}, pts = boxPts(b, fx);
        if (fu.kind === 'mast') { poly(ctx, pts, WOOD, INK, 2); const tp = pts.reduce((m, q) => q.y > m.y ? q : m, pts[0]); poly(ctx, [{ x: tp.x, y: tp.y - 0.15 }, { x: tp.x, y: tp.y - 1.0 }, { x: tp.x + 0.9, y: tp.y - 0.9 }], '#efe2c2', INK, 1.8); }
        else { const [p0, p1, p2, p3] = pts; poly(ctx, [p0, p1, { x: p2.x + 0.15, y: p2.y }, { x: p3.x - 0.15, y: p3.y }], WOOD, INK, 2.5); hatchPoly(ctx, [p0, p1, p2, p3]); }
      }
      if (u.cargo) { for (let i = 0; i < 3; i++) { const cx = p.x - 0.75 + i * 0.5; poly(ctx, [{ x: cx - 0.2, y: p.y + 0.43 }, { x: cx + 0.2, y: p.y + 0.43 }, { x: cx + 0.2, y: p.y + 0.8 }, { x: cx - 0.2, y: p.y + 0.8 }], '#c9a467', INK, 1.5); }
        text(ctx, u.cargo, X(p.x - 0.5), Y(p.y + 0.9), { size: 18, bold: true, align: 'center' }); }
      return;
    }
    case 'divingbell': {
      ctx.save(); ctx.translate(X(p.x), Y(p.y)); const s = S;
      ctx.beginPath(); ctx.moveTo(-0.5 * s, 0.5 * s); ctx.lineTo(-0.42 * s, -0.2 * s); ctx.quadraticCurveTo(-0.4 * s, -0.5 * s, 0, -0.5 * s); ctx.quadraticCurveTo(0.4 * s, -0.5 * s, 0.42 * s, -0.2 * s); ctx.lineTo(0.5 * s, 0.5 * s); ctx.closePath();
      ctx.fillStyle = BRASS; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -0.05 * s, 0.14 * s, 0, 7); ctx.fillStyle = 'rgba(200,230,240,0.8)'; ctx.fill(); ctx.stroke();
      if (u.ballast) { ctx.fillStyle = '#4a4440'; ctx.fillRect(-0.3 * s, 0.32 * s, 0.6 * s, 0.16 * s); ctx.font = `bold 16px ${FONT}`; ctx.fillStyle = '#f4e6c6'; ctx.textAlign = 'center'; ctx.fillText(u.ballast, 0, 0.45 * s); }
      ctx.restore(); return;
    }
    case 'fulcrum': { const pts = boxPts(b, fx0); poly(ctx, pts, '#9c8a6a', INK, 2.5); hatchPoly(ctx, pts); return; }
    case 'beam': {
      for (let fx = b.getFixtureList(); fx; fx = fx.getNext()) {
        const fu = fx.getUserData() || {}, pts = boxPts(b, fx);
        if (fu.kind === 'beam' || !fu.kind) { poly(ctx, pts, WOOD2, INK, 2.5); }
      }
      if (u.ticks) { const { step, n } = u.ticks, pv = b.getLocalPoint(u.pivot); for (let i = -n; i <= n; i++) { if (!i) continue; const w = b.getWorldPoint({ x: pv.x + i * step, y: -0.12 }), w2 = b.getWorldPoint({ x: pv.x + i * step, y: 0.04 }); line(ctx, [[w.x, w.y], [w2.x, w2.y]], INK, i % 2 ? 1.2 : 2.2); if (i % 2 === 0) text(ctx, `${Math.abs(i * step)}`, X(w.x), Y(w.y) + 18, { size: 15, align: 'center', color: INK2 }); } }
      for (let fx = b.getFixtureList(); fx; fx = fx.getNext()) {
        const fu = fx.getUserData() || {}; if (fu.kind === 'beam' || !fu.kind) continue;
        const c = b.getWorldPoint({ x: fu.cx, y: fu.cy });
        if (fu.kind === 'stone') { const pts = boxPts(b, fx); poly(ctx, pts, '#a49a88', INK, 2.5); hatchPoly(ctx, pts); text(ctx, fu.label, X(c.x), Y(c.y) + 6, { size: 18, bold: true, align: 'center' }); }
        else weightShape(ctx, c.x, c.y, fu.w, fu.h, a, fu.label, fu.kind === 'myweight');
      }
      return;
    }
    case 'load': case 'marble': case 'bellload': case 'stone': {
      const pts = boxPts(b, fx0); poly(ctx, pts, u.kind === 'bellload' ? BRASS : '#d8d0c0', INK, 2.5); if (u.kind !== 'bellload') hatchPoly(ctx, pts);
      if (u.label) { ctx.save(); ctx.translate(X(p.x), Y(p.y)); ctx.rotate(-a); text(ctx, u.label, 0, 7, { size: 19, bold: true, align: 'center' }); ctx.restore(); }
      return;
    }
    case 'myweight': weightShape(ctx, p.x, p.y, u.w, u.h, a, u.label, true); return;
    case 'bucket': { const w = u.w, h = u.h; poly(ctx, [{ x: p.x - w / 2, y: p.y + h / 2 }, { x: p.x + w / 2, y: p.y + h / 2 }, { x: p.x + w * 0.4, y: p.y - h / 2 }, { x: p.x - w * 0.4, y: p.y - h / 2 }], WOOD2, INK, 2.5);
      ctx.fillStyle = WATER2; ctx.fillRect(X(p.x - w * 0.45), Y(p.y + h * 0.4), w * 0.9 * S, 6); line(ctx, [[p.x - w / 2, p.y + h * 0.15], [p.x + w / 2, p.y + h * 0.15]], INK, 2); line(ctx, [[p.x - w / 2, p.y - h * 0.2], [p.x + w / 2, p.y - h * 0.2]], INK, 2); return; }
    case 'gear': {
      if (u.extra === 'millstone') { circ(ctx, p.x, p.y, u.r * 0.78, '#bdb6a8', INK, 2); }
      drawGear(ctx, p.x, p.y, u.r, u.teeth, a, { hand: u.extra === 'hand' || u.extra === 'millstone', label: `${u.teeth}` });
      if (u.style?.inner) drawGear(ctx, p.x, p.y, 0.025 * u.style.inner, u.style.inner, a, { fill: BRASS2 });
      if (u.drum) { circ(ctx, p.x, p.y, u.drum, WOOD, INK, 2.5); circ(ctx, p.x, p.y, u.drum * 0.8, null, 'rgba(58,39,22,0.5)', 1.5); }
      return;
    }
    case 'bob': { circ(ctx, p.x, p.y, 0.16, BRASS, INK, 2.5); circ(ctx, p.x - 0.05, p.y + 0.05, 0.05, BRASS2, null); return; }
    case 'ball': { const r = u.r; circ(ctx, p.x, p.y, r, '#5a5148', INK, 2); circ(ctx, p.x - r * 0.3, p.y + r * 0.3, r * 0.3, 'rgba(255,255,255,0.35)', null); return; }
    case 'cart': { poly(ctx, [{ x: p.x - 0.6, y: p.y - 0.06 }, { x: p.x + 0.6, y: p.y - 0.06 }, { x: p.x + 0.6, y: p.y + 0.45 }, { x: p.x - 0.6, y: p.y + 0.45 }], 'rgba(168,115,61,0.85)', INK, 2.5);
      for (const dx of [-0.38, 0.38]) { circ(ctx, p.x + dx, 0.3 + 0.13, 0.13, WOOD, INK, 2); const sp = -p.x / 0.13; line(ctx, [[p.x + dx - Math.cos(sp) * 0.12, 0.43 - Math.sin(sp) * 0.12], [p.x + dx + Math.cos(sp) * 0.12, 0.43 + Math.sin(sp) * 0.12]], INK, 1.5); } return; }
    case 'ramp': { const pts = boxPts(b, fx0); poly(ctx, pts, WOOD2, INK, 2.5); return; }
    case 'rampfill': { const pts = boxPts(b, fx0); poly(ctx, pts, 'rgba(139,90,43,0.35)', INK, 1.5); hatchPoly(ctx, pts); return; }
    case 'basket': {
      const bl = u.balloon, rd = bl.rd, cy = p.y + 0.35 + rd * 0.95;
      line(ctx, [[p.x - 0.3, p.y + 0.22], [p.x - rd * 0.55, cy - rd * 0.75]], INK2, 1.5); line(ctx, [[p.x + 0.3, p.y + 0.22], [p.x + rd * 0.55, cy - rd * 0.75]], INK2, 1.5);
      ctx.save(); ctx.translate(X(p.x), Y(cy)); ctx.beginPath(); ctx.moveTo(-rd * 0.35 * S, rd * 0.85 * S); ctx.bezierCurveTo(-rd * 1.15 * S, rd * 0.1 * S, -rd * 1.05 * S, -rd * 1.1 * S, 0, -rd * 1.05 * S); ctx.bezierCurveTo(rd * 1.05 * S, -rd * 1.1 * S, rd * 1.15 * S, rd * 0.1 * S, rd * 0.35 * S, rd * 0.85 * S); ctx.closePath();
      ctx.fillStyle = bl.kind === 'hydrogen' ? '#d9c79a' : '#c5543a'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(58,39,22,0.45)'; ctx.lineWidth = 1.5; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.ellipse(0, 0, Math.abs(i) * rd * 0.3 * S + 1, rd * 1.1 * S, 0, 0, 7); ctx.stroke(); }
      ctx.fillStyle = bl.kind === 'hydrogen' ? 'rgba(160,69,42,0.5)' : 'rgba(212,160,23,0.7)'; ctx.fillRect(-rd * S, -rd * 0.15 * S, rd * 2 * S, rd * 0.22 * S); ctx.restore();
      ctx.restore();
      if (bl.flame && bl.kind === 'hot') { const f = 0.18 + 0.05 * Math.sin(t * 20); ctx.beginPath(); ctx.moveTo(X(p.x - 0.1), Y(p.y + 0.3)); ctx.quadraticCurveTo(X(p.x), Y(p.y + 0.3 + f * 3), X(p.x + 0.1), Y(p.y + 0.3)); ctx.fillStyle = '#e8902a'; ctx.fill(); }
      const pts = boxPts(b, fx0); poly(ctx, pts, WOOD2, INK, 2); hatchPoly(ctx, pts);
      if (u.label) text(ctx, u.label, X(p.x), Y(p.y) + 30, { size: 17, bold: true, align: 'center' });
      return;
    }
    case 'diver': {
      ctx.save(); ctx.translate(X(p.x), Y(p.y)); const s = S;
      ctx.beginPath(); ctx.ellipse(0, -0.15 * s, 0.22 * s, 0.3 * s, 0, 0, 7); ctx.fillStyle = 'rgba(210,235,240,0.55)'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
      const bub = Math.max(0.05, Math.min(1.2, u.bubble || 1)); ctx.beginPath(); ctx.ellipse(0, -0.42 * s + 0.12 * s * bub, 0.2 * s, 0.14 * s * bub, 0, 0, 7); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0.2 * s, 0.1 * s, 0, 7); ctx.fillStyle = RED; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 0.3 * s); ctx.lineTo(0, 0.45 * s); ctx.moveTo(-0.12 * s, 0.38 * s); ctx.lineTo(0.12 * s, 0.38 * s); ctx.stroke();
      ctx.restore(); return;
    }
    default: { for (let fx = b.getFixtureList(); fx; fx = fx.getNext()) { const pts = boxPts(b, fx); if (pts) poly(ctx, pts, '#c9b48a', INK, 2); } }
  }
}

function drawTank(ctx, tk, t) {
  const W = tk.x1 - tk.x0, n = 24, pts = [{ x: tk.x0, y: tk.y0 }];
  for (let i = 0; i <= n; i++) { const x = tk.x0 + W * i / n; pts.push({ x, y: tk.level + 0.025 * Math.sin(i * 1.3 + t * 3) }); }
  pts.push({ x: tk.x1, y: tk.y0 });
  poly(ctx, pts, WATER, null);
  line(ctx, pts.slice(1, -1).map(p => [p.x, p.y]), WATER2, 2);
  for (let y = tk.level - 0.25; y > tk.y0 + 0.1; y -= 0.35) line(ctx, [[tk.x0 + 0.2, y], [tk.x0 + 0.5, y]], 'rgba(40,80,110,0.35)', 1.2);
}

const DECOR = {
  marker(ctx, d) { line(ctx, [[d.x0, d.y], [d.x1, d.y]], d.faint ? 'rgba(160,69,42,0.5)' : RED, d.faint ? 1.5 : 3, [10, 7]); if (d.label) text(ctx, d.label, X(d.x1) + 6, Y(d.y) + 6, { size: 17, italic: true, color: RED }); },
  band(ctx, d) { ctx.fillStyle = 'rgba(160,69,42,0.07)'; ctx.fillRect(X(d.x0), Y(d.y1), (d.x1 - d.x0) * S, (d.y1 - d.y0) * S); },
  pillar(ctx, d) { for (const dx of [-0.45, 0.45]) { line(ctx, [[d.x + dx, d.y0], [d.x + dx, d.y1]], INK, 3, [7, 4]); } poly(ctx, [{ x: d.x - 1.1, y: d.y1 }, { x: d.x + 1.1, y: d.y1 }, { x: d.x + 1.1, y: d.y1 - 0.15 }, { x: d.x - 1.1, y: d.y1 - 0.15 }], WOOD, INK, 2); text(ctx, 'low drawbridge', X(d.x + 0.7), Y(d.y0 + 0.4), { size: 17, italic: true, color: INK2 }); },
  dock(ctx, d) { poly(ctx, [{ x: d.x, y: d.y - 0.1 }, { x: 11.8, y: d.y - 0.1 }, { x: 11.8, y: d.y + 0.5 }, { x: d.x, y: d.y + 0.5 }], WOOD, INK, 2); text(ctx, 'dock', X(d.x + 0.6), Y(d.y + 0.6), { size: 18, italic: true }); },
  wheel(ctx, d) { circ(ctx, d.x, d.y, d.r, BRASS, INK, 2.5); circ(ctx, d.x, d.y, d.r * 0.15, WOOD, INK, 2); line(ctx, [[d.x, d.y], [d.x, d.y + d.r + 0.4]], INK, 3); },
  well(ctx, d) { poly(ctx, [{ x: d.x - 0.8, y: d.y }, { x: d.x + 0.8, y: d.y }, { x: d.x + 0.8, y: d.y + 0.9 }, { x: d.x - 0.8, y: d.y + 0.9 }], '#b9a27a', INK, 2.5); for (let i = 0; i < 3; i++) line(ctx, [[d.x - 0.8, d.y + 0.3 * i], [d.x + 0.8, d.y + 0.3 * i]], INK2, 1.2); },
  rope(ctx, d) { rope(ctx, d.pts()); },
  ledge(ctx, d) { poly(ctx, [{ x: d.x - d.w / 2 - 0.6, y: d.y }, { x: d.x - d.w / 2 - 0.2, y: d.y }, { x: d.x - d.w / 2 - 0.2, y: d.y + 0.35 }, { x: d.x - d.w / 2 - 0.6, y: d.y + 0.35 }], '#b9a27a', INK, 2); },
  tackle(ctx, d) {
    const top = d.top, xL = d.xL, xE = d.xE, lp = d.load.getPosition(), lt = lp.y + d.hL / 2 + 0.15, n = d.n || 1;
    const bw = Math.min(1.3, 0.3 + n * 0.16);
    poly(ctx, [{ x: xL - bw / 2, y: top - 0.15 }, { x: xL + bw / 2, y: top - 0.15 }, { x: xL + bw / 2, y: top + 0.25 }, { x: xL - bw / 2, y: top + 0.25 }], BRASS, INK, 2);
    poly(ctx, [{ x: xL - bw / 2, y: lt - 0.1 }, { x: xL + bw / 2, y: lt - 0.1 }, { x: xL + bw / 2, y: lt + 0.25 }, { x: xL - bw / 2, y: lt + 0.25 }], BRASS, INK, 2);
    for (let i = 0; i < n; i++) { const x = xL - bw / 2 + bw * (i + 0.5) / n; rope(ctx, [[x, top - 0.15], [x, lt + 0.25]]); }
    line(ctx, [[xL, lt - 0.1], [xL, lp.y + d.hL / 2]], INK, 3);
    if (d.n2) text(ctx, `×${d.n2} hoist`, X(xL + bw / 2 + 0.1), Y(top - 0.5), { size: 17, italic: true, color: RED });
    circ(ctx, xE, top, 0.25, BRASS, INK, 2);
    if (d.eff) { const ep = d.eff.getPosition(); rope(ctx, [[xL + bw / 2, top + 0.05], [xE, top + 0.25], [xE + 0.0, ep.y + 0.3]]); }
    else rope(ctx, [[xL + bw / 2, top + 0.05], [xE, top + 0.25], [xE, top - 1.0]]);
    text(ctx, `${n} rope${n > 1 ? 's' : ''}`, X(xL - bw / 2 - 0.1), Y((top + lt) / 2), { size: 18, italic: true, align: 'right', color: RED });
  },
  waterwheel(ctx, d, t) { const a = d.body.getAngle(); ctx.save(); ctx.globalAlpha = 0.5; drawGear(ctx, d.x, d.y, d.r, 10, a * 0.999, { fill: 'rgba(139,90,43,0.5)' }); ctx.restore(); },
  metronome(ctx, d, t, sim) { const ph = Math.sin(Math.PI * 2 * sim.t / d.T) * 0.5; poly(ctx, [{ x: d.x - 0.5, y: d.y - 1.0 }, { x: d.x + 0.5, y: d.y - 1.0 }, { x: d.x + 0.25, y: d.y + 1.2 }, { x: d.x - 0.25, y: d.y + 1.2 }], WOOD, INK, 2);
    line(ctx, [[d.x, d.y - 0.7], [d.x + Math.sin(ph) * 1.4, d.y - 0.7 + Math.cos(ph) * 1.4]], BRASS2, 4); text(ctx, `T = ${+d.T.toFixed(3)} s`, X(d.x), Y(d.y - 1.0) + 24, { size: 18, align: 'center', bold: true }); },
  rod(ctx, d) { const p = d.body.getPosition(); line(ctx, [[d.x, d.y], [p.x, p.y]], INK, 2.5); circ(ctx, d.x, d.y, 0.08, BRASS, INK, 2); },
  bell(ctx, d, t, sim) { const ring = sim.events.some(e => e.type === 'tick' && sim.t - e.t < 0.25); ctx.save(); ctx.translate(X(d.x), Y(d.y)); ctx.rotate(ring ? 0.2 * Math.sin(sim.t * 40) : 0);
    ctx.beginPath(); ctx.moveTo(-18, 14); ctx.quadraticCurveTo(-16, -16, 0, -18); ctx.quadraticCurveTo(16, -16, 18, 14); ctx.closePath(); ctx.fillStyle = ring ? BRASS2 : BRASS; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); },
  ruler(ctx, d) { line(ctx, [[d.x0, d.y - 0.05], [d.x1, d.y - 0.05]], INK, 1.5); for (let x = 0; d.origin + x <= d.x1 + 1e-6; x += 0.25) { const big = Math.abs(x - Math.round(x)) < 1e-6; line(ctx, [[d.origin + x, d.y - 0.05], [d.origin + x, d.y - (big ? 0.2 : 0.12)]], INK, big ? 2 : 1); if (big) text(ctx, `${Math.round(x)}`, X(d.origin + x), Y(d.y - 0.22) + 16, { size: 15, align: 'center', color: '#f1e3c0' }); } },
  spring(ctx, d) { const pts = []; for (let i = 0; i <= 12; i++) pts.push([d.x + i * 0.1, d.y + (i % 2 ? 0.12 : -0.12)]); line(ctx, pts, INK, 2.5); },
  smallramp(ctx, d) { poly(ctx, [{ x: d.x, y: d.y }, { x: d.x + 1.5, y: d.y }, { x: d.x, y: d.y + 0.8 }], 'rgba(168,115,61,0.6)', INK, 2); },
  bucket(ctx, d) { const { x, y, w, h } = d; poly(ctx, [{ x: x - w / 2, y: y + h }, { x: x + w / 2, y: y + h }, { x: x + w * 0.4, y }, { x: x - w * 0.4, y }], d.sunk ? 'rgba(139,90,43,0.7)' : WOOD2, INK, 2.5); line(ctx, [[x - w * 0.47, y + h * 0.66], [x + w * 0.47, y + h * 0.66]], INK, 2); line(ctx, [[x - w * 0.43, y + h * 0.25], [x + w * 0.43, y + h * 0.25]], INK, 2); },
  bottle(ctx, d) { line(ctx, [[d.x0 - 0.1, d.y1 - 0.3], [d.x0 - 0.1, d.y0], [d.x1 + 0.1, d.y0], [d.x1 + 0.1, d.y1 - 0.3]], 'rgba(120,160,150,0.8)', 4); },
  gauge(ctx, d) { circ(ctx, d.x, d.y, 0.75, '#efe2c2', INK, 3); const a = Math.PI * 1.25 - Math.min(1.5, d.P / (d.unit === 'mmHg' ? 1500 : 200)) * Math.PI; line(ctx, [[d.x, d.y], [d.x + Math.cos(a) * 0.6, d.y + Math.sin(a) * 0.6]], RED, 3); text(ctx, `${d.P} ${d.unit}`, X(d.x), Y(d.y - 0.95), { size: 20, align: 'center', bold: true }); },
  flask(ctx, d) { ctx.beginPath(); ctx.moveTo(X(d.x - 0.15), Y(d.y + 1.3)); ctx.lineTo(X(d.x - 0.15), Y(d.y + 0.9)); ctx.lineTo(X(d.x - 0.7), Y(d.y)); ctx.lineTo(X(d.x + 0.7), Y(d.y)); ctx.lineTo(X(d.x + 0.15), Y(d.y + 0.9)); ctx.lineTo(X(d.x + 0.15), Y(d.y + 1.3)); ctx.fillStyle = 'rgba(190,220,210,0.5)'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke(); text(ctx, 'acid', X(d.x), Y(d.y + 0.25), { size: 16, align: 'center', italic: true }); },
  hose(ctx, d) { const p = d.body.getPosition(), u = d.body.getUserData(); const cy = p.y + 0.35 + u.balloon.rd * 0.15; ctx.beginPath(); ctx.moveTo(X(d.x0), Y(d.y0)); ctx.bezierCurveTo(X(d.x0), Y(d.y0 + 2), X(p.x - 1), Y(cy - 1.5), X(p.x), Y(cy)); ctx.strokeStyle = 'rgba(90,60,20,0.6)'; ctx.lineWidth = 4; ctx.setLineDash([6, 5]); ctx.stroke(); ctx.setLineDash([]); },
  tower(ctx, d) { const w = 1.3; poly(ctx, [{ x: d.x - w / 2, y: d.y }, { x: d.x + w / 2, y: d.y }, { x: d.x + w / 2 + 0.15, y: d.top }, { x: d.x - w / 2 + 0.15, y: d.top }], '#e8dcc0', INK, 2.5);
    for (let y = d.y + 0.6; y < d.top; y += 0.6) { line(ctx, [[d.x - w / 2 + (y - d.y) / (d.top - d.y) * 0.15, y], [d.x + w / 2 + (y - d.y) / (d.top - d.y) * 0.15, y]], INK2, 1.2); for (let k = -1; k <= 1; k++) line(ctx, [[d.x + k * 0.38 + (y - d.y) / (d.top - d.y) * 0.15, y - 0.45], [d.x + k * 0.38 + (y - d.y) / (d.top - d.y) * 0.15, y - 0.15]], INK2, 2); }
    line(ctx, [[d.x + 0.8, d.top], [1.7 + 1.2, d.top]], WOOD, 5); },
  screw(ctx, d, t, sim) {
    const dx = d.x1 - d.x0, dy = d.y1 - d.y0, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy, ny = ux, R = 0.32;
    poly(ctx, [{ x: d.x0 + nx * R, y: d.y0 + ny * R }, { x: d.x1 + nx * R, y: d.y1 + ny * R }, { x: d.x1 - nx * R, y: d.y1 - ny * R }, { x: d.x0 - nx * R, y: d.y0 - ny * R }], 'rgba(168,115,61,0.55)', INK, 2.5);
    const q = d.tank ? (d.tank.lastQ || 0) * 3 : 1, ph = (sim.t * (d.tank ? q : 2)) % 1;
    for (let s = -0.3; s < L; s += 0.36) { const s2 = s + ph * 0.36; if (s2 < 0 || s2 > L) continue; const cx = d.x0 + ux * s2, cy = d.y0 + uy * s2; line(ctx, [[cx + nx * R, cy + ny * R], [cx - nx * R + ux * 0.18, cy - ny * R + uy * 0.18]], INK, 2); }
    line(ctx, [[d.x0 - ux * 0.3, d.y0 - uy * 0.3], [d.x1 + ux * 0.3, d.y1 + uy * 0.3]], INK, 3);
    if (sim.t > 0 && (!d.tank || d.tank.inflow)) for (let i = 0; i < 4; i++) { const k = (sim.t * 3 + i / 4) % 1; circ(ctx, d.x1 + 0.25 + k * 0.1, d.y1 - k * 0.9, 0.05, WATER2, null); }
    text(ctx, 'Archimedes screw', X((d.x0 + d.x1) / 2) - 50, Y((d.y0 + d.y1) / 2) - 26, { size: 16, italic: true, color: INK2 });
  },
  hole(ctx, d) { circ(ctx, d.x, d.y, 0.07, '#1d140b', INK, 1.5); },
  qgraph(ctx, d, t, sim) {
    const x = X(d.x), y = Y(d.y), w = 300, h = 160, T = Math.max(1, d.T * 1.15), qmax = Math.max(d.a, d.a + d.b * T, 1) * 1.15;
    ctx.fillStyle = 'rgba(241,227,192,0.85)'; ctx.fillRect(x, y - h, w, h); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(x, y - h, w, h);
    const px = tt => x + 30 + (w - 40) * tt / T, py = q => y - 20 - (h - 34) * q / qmax;
    ctx.beginPath(); ctx.moveTo(px(0), py(0)); for (let i = 0; i <= 40; i++) { const tt = T * i / 40; ctx.lineTo(px(tt), py(Math.max(0, d.a + d.b * tt))); } ctx.lineTo(px(T), py(0)); ctx.closePath(); ctx.fillStyle = 'rgba(64,110,140,0.25)'; ctx.fill();
    ctx.beginPath(); for (let i = 0; i <= 40; i++) { const tt = T * i / 40; i ? ctx.lineTo(px(tt), py(Math.max(0, d.a + d.b * tt))) : ctx.moveTo(px(tt), py(Math.max(0, d.a + d.b * tt))); } ctx.strokeStyle = WATER2; ctx.lineWidth = 3; ctx.stroke();
    const tn = Math.min(sim.t, T); ctx.beginPath(); ctx.moveTo(px(tn), y - 20); ctx.lineTo(px(tn), y - h + 10); ctx.strokeStyle = RED; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px(0), y - h + 10); ctx.lineTo(px(0), y - 20); ctx.lineTo(x + w - 8, y - 20); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
    text(ctx, 'Q (L/s)', x + 34, y - h + 22, { size: 15, italic: true }); text(ctx, 't', x + w - 16, y - 26, { size: 15, italic: true }); text(ctx, 'area = volume', x + w - 12, y - h + 22, { size: 15, italic: true, align: 'right', color: WATER2 });
  },
  timer(ctx, d, t, sim) { const k = Math.min(1, sim.t / Math.max(0.1, d.T)); circ(ctx, d.x, d.y, 0.6, '#efe2c2', INK, 3); ctx.beginPath(); ctx.moveTo(X(d.x), Y(d.y)); ctx.arc(X(d.x), Y(d.y), 0.55 * S, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.closePath(); ctx.fillStyle = 'rgba(160,69,42,0.35)'; ctx.fill();
    text(ctx, `${d.T} s`, X(d.x), Y(d.y - 0.85), { size: 20, align: 'center', bold: true }); DECOR.bell(ctx, { x: d.x, y: d.y + 0.85 }, t, { events: sim.events.map(e => e.type === 'bell' ? { ...e, type: 'tick' } : e), t: sim.t }); },
  crossbow(ctx, d) { ctx.save(); ctx.translate(X(d.x), Y(d.y)); ctx.fillStyle = WOOD; ctx.fillRect(-20, 0, 40, (d.y - 0.3) * S); ctx.rotate(-d.ang); ctx.fillStyle = WOOD2; ctx.fillRect(-60, -8, 110, 16); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(-60, -8, 110, 16);
    ctx.beginPath(); ctx.moveTo(30, -55); ctx.quadraticCurveTo(55, 0, 30, 55); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke(); ctx.beginPath(); ctx.moveTo(30, -55); ctx.lineTo(-30, 0); ctx.lineTo(30, 55); ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
    text(ctx, `${(d.ang * 180 / Math.PI).toFixed(1)}°`, X(d.x) + 60, Y(d.y) - 40, { size: 20, bold: true, color: RED }); },
};

export function drawWorld(ctx, sim, t, o = {}) {
  for (const tk of sim.tanks) drawTank(ctx, tk, t);
  for (const d of sim.decor) if (d.type === 'band' || d.type === 'pillar' || d.type === 'qgraph') DECOR[d.type]?.(ctx, d, t, sim);
  for (const d of sim.decor) if (!['band', 'pillar', 'qgraph', 'marker'].includes(d.type)) DECOR[d.type]?.(ctx, d, t, sim);
  for (const b of sim.bodies) if (b.getUserData().kind === 'floor' || b.getUserData().kind === 'tankwall') drawBody(ctx, b, t);
  for (const b of sim.bodies) { const k = b.getUserData().kind; if (k !== 'floor' && k !== 'tankwall') drawBody(ctx, b, t); }
  for (const d of sim.decor) if (d.type === 'marker') DECOR.marker(ctx, d);
  for (const p of sim.particles) if (!p.dead) circ(ctx, p.x, p.y, 0.06, WATER2, null);
}

// Icons for parts-bin tiles, drawn in a w×h box centred at (cx, cy) in pixels.
export function drawIcon(ctx, icon, cx, cy, s, o = {}) {
  ctx.save(); ctx.translate(cx, cy); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  const P = (pts, fill) => { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x * s, y * s) : ctx.moveTo(x * s, y * s)); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } ctx.stroke(); };
  switch (icon) {
    case 'weight': case 'sack': P([[-0.3, -0.25], [0.3, -0.25], [0.42, 0.35], [-0.42, 0.35]], icon === 'sack' ? '#c9a467' : '#6d7b84'); ctx.beginPath(); ctx.arc(0, -0.33 * s, 0.1 * s, Math.PI, 0); ctx.stroke(); break;
    case 'crown': P([[-0.4, 0.3], [-0.4, -0.25], [-0.2, 0.0], [0, -0.35], [0.2, 0.0], [0.4, -0.25], [0.4, 0.3]], GOLD); break;
    case 'crate': P([[-0.35, -0.3], [0.35, -0.3], [0.35, 0.3], [-0.35, 0.3]], '#c9a467'); ctx.beginPath(); ctx.moveTo(-0.35 * s, -0.3 * s); ctx.lineTo(0.35 * s, 0.3 * s); ctx.moveTo(0.35 * s, -0.3 * s); ctx.lineTo(-0.35 * s, 0.3 * s); ctx.stroke(); break;
    case 'gear': { ctx.restore(); ctx.save(); const r = 0.42 * s * Math.min(1, 0.45 + (o.teeth || 20) / 60); const N = o.teeth || 20;
      ctx.translate(cx, cy); ctx.beginPath(); for (let i = 0; i < N; i++) { const a0 = i / N * Math.PI * 2, a1 = (i + 0.5) / N * Math.PI * 2; ctx.lineTo(Math.cos(a0) * r * 0.86, Math.sin(a0) * r * 0.86); ctx.lineTo(Math.cos(a0 + 0.05) * r, Math.sin(a0 + 0.05) * r); ctx.lineTo(Math.cos(a1 - 0.05) * r, Math.sin(a1 - 0.05) * r); ctx.lineTo(Math.cos(a1) * r * 0.86, Math.sin(a1) * r * 0.86); }
      ctx.closePath(); ctx.fillStyle = BRASS; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, r * 0.2, 0, 7); ctx.fillStyle = WOOD; ctx.fill(); ctx.stroke(); break; }
    case 'ball': ctx.beginPath(); ctx.arc(0, 0, 0.3 * s, 0, 7); ctx.fillStyle = BRASS; ctx.fill(); ctx.stroke(); break;
    case 'bucket': P([[-0.38, -0.3], [0.38, -0.3], [0.3, 0.32], [-0.3, 0.32]], WOOD2); break;
    case 'stop': P([[-0.4, -0.12], [0.4, -0.12], [0.4, 0.12], [-0.4, 0.12]], RED); break;
    case 'ramp': P([[-0.42, 0.3], [0.42, 0.3], [0.42, -0.3]], WOOD2); break;
    case 'flame': ctx.beginPath(); ctx.moveTo(-0.2 * s, 0.3 * s); ctx.quadraticCurveTo(-0.35 * s, -0.1 * s, 0, -0.4 * s); ctx.quadraticCurveTo(0.35 * s, -0.1 * s, 0.2 * s, 0.3 * s); ctx.closePath(); ctx.fillStyle = '#e8902a'; ctx.fill(); ctx.stroke(); break;
    case 'cap': P([[-0.3, -0.1], [0.3, -0.1], [0.3, 0.2], [-0.3, 0.2]], RED); ctx.beginPath(); ctx.moveTo(0, -0.1 * s); ctx.lineTo(0, -0.38 * s); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-0.15 * s, -0.38 * s); ctx.lineTo(0.15 * s, -0.38 * s); ctx.stroke(); break;
    case 'flask': P([[-0.08, -0.4], [0.08, -0.4], [0.08, -0.1], [0.35, 0.32], [-0.35, 0.32], [-0.08, -0.1]], 'rgba(190,220,210,0.8)'); break;
    case 'cart': P([[-0.42, -0.15], [0.42, -0.15], [0.42, 0.15], [-0.42, 0.15]], WOOD2); ctx.beginPath(); ctx.arc(-0.22 * s, 0.25 * s, 0.1 * s, 0, 7); ctx.arc(0.22 * s, 0.25 * s, 0.1 * s, 0, 7); ctx.fillStyle = WOOD; ctx.fill(); break;
    case 'drill': P([[-0.4, -0.08], [0.15, -0.08], [0.15, 0.08], [-0.4, 0.08]], WOOD); P([[0.15, -0.04], [0.42, 0], [0.15, 0.04]], '#888'); break;
    case 'bell': ctx.beginPath(); ctx.moveTo(-0.3 * s, 0.25 * s); ctx.quadraticCurveTo(-0.28 * s, -0.3 * s, 0, -0.32 * s); ctx.quadraticCurveTo(0.28 * s, -0.3 * s, 0.3 * s, 0.25 * s); ctx.closePath(); ctx.fillStyle = BRASS; ctx.fill(); ctx.stroke(); break;
  }
  ctx.restore();
}
