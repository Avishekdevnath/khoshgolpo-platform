"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// ── Canvas constants ──────────────────────────────────────────────────────────
const CW = 860;
const CH = 260;
const GROUND = CH - 46;   // ground line Y
const GRAVITY = 0.72;
const JUMP_V = -15.5;
const PX = 100;            // player fixed X
const PR = 15;             // player radius
const MAX_JUMPS = 2;
const BASE_SPEED = 4.2;

// ── Types ─────────────────────────────────────────────────────────────────────
type Phase = "idle" | "running" | "dead";

interface Star   { x: number; y: number; r: number; spd: number; a: number }
interface Nebula { x: number; y: number; r: number; hue: number; a: number }
interface Pillar { x: number; w: number; h: number; tip: boolean }
interface Dust   { x: number; y: number; vx: number; vy: number; life: number; hue: number; sz: number }
interface Trail  { x: number; y: number; r: number; a: number }

interface GS {
  phase: Phase;
  py: number; vy: number; jumps: number;
  tick: number; score: number; speed: number;
  nextPillar: number;
  gOff: number;
  stars: Star[]; nebulas: Nebula[];
  pillars: Pillar[];
  dusts: Dust[];
  trail: Trail[];
  raf: number;
  prevT: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function spawnDusts(dusts: Dust[], x: number, y: number, n: number, hue: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = Math.random() * 5 + 0.8;
    dusts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, life: 1, hue, sz: Math.random() * 5 + 1.5 });
  }
}

function aabbCircle(cx: number, cy: number, cr: number, rx: number, ry: number, rw: number, rh: number) {
  const nx = Math.max(rx, Math.min(cx, rx + rw));
  const ny = Math.max(ry, Math.min(cy, ry + rh));
  return (cx - nx) ** 2 + (cy - ny) ** 2 < cr * cr;
}

// ── Draw functions ────────────────────────────────────────────────────────────
function drawBg(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#07091f";
  ctx.fillRect(0, 0, CW, CH);
}

function drawNebulas(ctx: CanvasRenderingContext2D, nebulas: Nebula[]) {
  for (const n of nebulas) {
    const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
    g.addColorStop(0, `hsla(${n.hue},60%,45%,${n.a})`);
    g.addColorStop(1, `hsla(${n.hue},60%,45%,0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
  }
}

function drawStars(ctx: CanvasRenderingContext2D, stars: Star[], t: number) {
  for (const s of stars) {
    const tw = Math.sin(t * 0.016 + s.x * 0.25) * 0.3 + 0.7;
    ctx.fillStyle = `rgba(255,255,255,${s.a * tw})`;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
  }
}

function drawGround(ctx: CanvasRenderingContext2D, gOff: number) {
  const gy = GROUND + PR + 2;
  ctx.strokeStyle = "#1a1f38";
  ctx.lineWidth = 1; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(CW, gy); ctx.stroke();

  ctx.strokeStyle = "rgba(124,115,240,0.45)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, gy + 1); ctx.lineTo(CW, gy + 1); ctx.stroke();

  ctx.strokeStyle = "rgba(124,115,240,0.09)";
  ctx.lineWidth = 1;
  ctx.setLineDash([20, 14]);
  ctx.lineDashOffset = -gOff;
  ctx.beginPath(); ctx.moveTo(0, gy + 8); ctx.lineTo(CW, gy + 8); ctx.stroke();
  ctx.setLineDash([]);
}

function drawPillars(ctx: CanvasRenderingContext2D, pillars: Pillar[]) {
  for (const p of pillars) {
    const bx = p.x, by = GROUND + PR + 2 - p.h, bw = p.w, bh = p.h;
    const r = 4;

    // shadow
    ctx.fillStyle = "rgba(124,115,240,0.07)";
    ctx.fillRect(bx + 4, by + 4, bw, bh);

    // body
    ctx.fillStyle = "#0d1228";
    roundRect(ctx, bx, by, bw, bh, r); ctx.fill();

    // glowing border
    const grad = ctx.createLinearGradient(bx, by, bx, by + bh);
    grad.addColorStop(0, "rgba(157,151,240,0.9)");
    grad.addColorStop(1, "rgba(100,90,220,0.4)");
    ctx.strokeStyle = grad; ctx.lineWidth = 1.5;
    roundRect(ctx, bx, by, bw, bh, r); ctx.stroke();

    // inner highlight strip
    ctx.fillStyle = "rgba(157,151,240,0.13)";
    ctx.fillRect(bx + 5, by + 5, bw - 10, 3);

    if (p.tip) {
      ctx.fillStyle = "#b0aaf5";
      ctx.beginPath();
      ctx.moveTo(bx + bw / 2 - 6, by);
      ctx.lineTo(bx + bw / 2, by - 13);
      ctx.lineTo(bx + bw / 2 + 6, by);
      ctx.closePath(); ctx.fill();

      const sg = ctx.createRadialGradient(bx + bw / 2, by - 13, 0, bx + bw / 2, by - 5, 18);
      sg.addColorStop(0, "rgba(176,170,245,0.45)");
      sg.addColorStop(1, "rgba(176,170,245,0)");
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(bx + bw / 2, by - 5, 18, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, py: number, phase: Phase, t: number, trail: Trail[]) {
  // trail
  for (const tr of trail) {
    const tg = ctx.createRadialGradient(tr.x, tr.y, 0, tr.x, tr.y, tr.r);
    tg.addColorStop(0, `rgba(240,131,74,${tr.a * 0.45})`);
    tg.addColorStop(1, `rgba(240,131,74,0)`);
    ctx.fillStyle = tg;
    ctx.beginPath(); ctx.arc(tr.x, tr.y, tr.r, 0, Math.PI * 2); ctx.fill();
  }

  // outer glow
  const og = ctx.createRadialGradient(PX, py, 0, PX, py, PR * 3.2);
  og.addColorStop(0, "rgba(240,131,74,0.30)");
  og.addColorStop(1, "rgba(240,131,74,0)");
  ctx.fillStyle = og;
  ctx.beginPath(); ctx.arc(PX, py, PR * 3.2, 0, Math.PI * 2); ctx.fill();

  // body
  const bg = ctx.createRadialGradient(PX - 5, py - 5, 2, PX, py, PR);
  bg.addColorStop(0, "#ffc090");
  bg.addColorStop(1, "#f0834a");
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.arc(PX, py, PR, 0, Math.PI * 2); ctx.fill();

  // animated pulse ring
  const pulse = Math.sin(t * 0.065) * 0.5 + 0.5;
  ctx.strokeStyle = `rgba(240,131,74,${0.12 + pulse * 0.28})`;
  ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.arc(PX, py, PR + 6 + pulse * 6, 0, Math.PI * 2); ctx.stroke();

  // second faint ring
  ctx.strokeStyle = `rgba(240,131,74,${0.06 + pulse * 0.10})`;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(PX, py, PR + 13 + pulse * 4, 0, Math.PI * 2); ctx.stroke();

  if (phase !== "dead") {
    // white of eye
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(PX + 5, py - 3.5, 5, 0, Math.PI * 2); ctx.fill();
    // pupil
    ctx.fillStyle = "#1a0c00";
    ctx.beginPath(); ctx.arc(PX + 6, py - 3.5, 2.5, 0, Math.PI * 2); ctx.fill();
    // shine
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath(); ctx.arc(PX + 7.5, py - 5, 1.2, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2.2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(PX + 1, py - 7); ctx.lineTo(PX + 9, py - 0.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(PX + 9, py - 7); ctx.lineTo(PX + 1, py - 0.5); ctx.stroke();
    ctx.lineCap = "butt";
  }
}

function drawDusts(ctx: CanvasRenderingContext2D, dusts: Dust[]) {
  for (const d of dusts) {
    ctx.fillStyle = `hsla(${d.hue},88%,64%,${d.life * 0.9})`;
    ctx.beginPath(); ctx.arc(d.x, d.y, d.sz * d.life, 0, Math.PI * 2); ctx.fill();
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function NotFound() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gs = useRef<GS>({
    phase: "idle",
    py: GROUND - PR, vy: 0, jumps: 0,
    tick: 0, score: 0, speed: BASE_SPEED,
    nextPillar: 100, gOff: 0,
    stars: [], nebulas: [], pillars: [], dusts: [], trail: [],
    raf: 0, prevT: 0,
  });

  const [uiPhase, setUiPhase] = useState<Phase>("idle");
  const [uiScore, setUiScore] = useState(0);
  const [uiBest, setUiBest] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const loopCtx = ctx;
    const g = gs.current;

    // Init stars & nebulas
    g.stars = Array.from({ length: 110 }, () => ({
      x: Math.random() * CW,
      y: Math.random() * (GROUND - 20),
      r: Math.random() * 1.5 + 0.25,
      spd: Math.random() * 0.5 + 0.08,
      a: Math.random() * 0.6 + 0.15,
    }));
    g.nebulas = [
      { x: CW * 0.25, y: GROUND * 0.35, r: 120, hue: 260, a: 0.025 },
      { x: CW * 0.72, y: GROUND * 0.45, r: 100, hue: 240, a: 0.020 },
      { x: CW * 0.5,  y: GROUND * 0.2,  r: 90,  hue: 280, a: 0.018 },
    ];

    function resetGame() {
      g.py = GROUND - PR; g.vy = 0; g.jumps = 0;
      g.tick = 0; g.score = 0; g.speed = BASE_SPEED;
      g.nextPillar = 100; g.gOff = 0;
      g.pillars = []; g.dusts = []; g.trail = [];
      g.prevT = 0;
    }

    function doJump() {
      if (g.phase === "idle") {
        g.phase = "running"; setUiPhase("running"); resetGame(); return;
      }
      if (g.phase === "dead") {
        g.phase = "running"; setUiPhase("running"); resetGame(); setUiScore(0); return;
      }
      if (g.jumps < MAX_JUMPS) {
        g.vy = JUMP_V - g.jumps * 2;
        g.jumps++;
        spawnDusts(g.dusts, PX, g.py + PR, 9, 30);
      }
    }

    function loop(t: number) {
      // delta-time cap at 50ms to avoid spiral of death after tab hide
      const dt = g.prevT === 0 ? 16.67 : Math.min(t - g.prevT, 50);
      g.prevT = t;
      const dtFactor = dt / 16.67; // 1.0 at 60fps
      const ctx = loopCtx;

      loopCtx.clearRect(0, 0, CW, CH);
      drawBg(loopCtx);
      drawNebulas(loopCtx, g.nebulas);
      drawStars(loopCtx, g.stars, t);

      if (g.phase === "running") {
        g.tick++;
        g.score = Math.floor(g.tick / 6);
        g.speed = BASE_SPEED + g.tick / 280;
        g.gOff = (g.gOff + g.speed * dtFactor) % 34;

        // physics — delta-time scaled
        g.vy += GRAVITY * dtFactor;
        g.py += g.vy * dtFactor;

        if (g.py >= GROUND - PR) {
          g.py = GROUND - PR; g.vy = 0; g.jumps = 0;
          if (Math.abs(g.vy) > 2) spawnDusts(g.dusts, PX, GROUND + PR, 5, 28);
        }

        // trail
        if (g.tick % 2 === 0) {
          g.trail.push({ x: PX - 6, y: g.py, r: PR * 0.75, a: 0.7 });
          if (g.trail.length > 12) g.trail.shift();
        }
        for (const tr of g.trail) tr.a -= 0.055;
        g.trail = g.trail.filter(tr => tr.a > 0);

        // stars parallax
        const starDx = g.speed / BASE_SPEED;
        for (const s of g.stars) {
          s.x -= s.spd * starDx * dtFactor;
          if (s.x < 0) { s.x = CW; s.y = Math.random() * (GROUND - 20); }
        }
        // nebulas slow parallax
        for (const n of g.nebulas) {
          n.x -= 0.18 * dtFactor;
          if (n.x + n.r < 0) n.x = CW + n.r;
        }

        // spawn pillars
        g.nextPillar -= dtFactor;
        if (g.nextPillar <= 0) {
          const h = 32 + Math.random() * 58;
          const w = 18 + Math.random() * 18;
          g.pillars.push({ x: CW + 10, w, h, tip: Math.random() > 0.38 });
          const gap = 78 + Math.random() * 100 - Math.min(g.tick / 16, 42);
          g.nextPillar = Math.max(gap, 40);
        }
        for (const p of g.pillars) p.x -= g.speed * dtFactor;
        g.pillars = g.pillars.filter(p => p.x + p.w > -20);

        // collision
        for (const p of g.pillars) {
          const ry = GROUND + PR + 2 - p.h;
          if (aabbCircle(PX, g.py, PR - 3, p.x, ry, p.w, p.h)) {
            g.phase = "dead"; setUiPhase("dead");
            spawnDusts(g.dusts, PX, g.py, 28, 26);
            setUiBest(prev => Math.max(prev, g.score));
            setUiScore(g.score);
            break;
          }
        }

        // dusts
        for (const d of g.dusts) {
          d.x += d.vx * dtFactor; d.y += d.vy * dtFactor;
          d.vy += 0.14 * dtFactor; d.life -= 0.030 * dtFactor;
        }
        g.dusts = g.dusts.filter(d => d.life > 0);

        setUiScore(g.score);

      } else if (g.phase === "idle") {
        g.py = GROUND - PR + Math.sin(t * 0.036) * 6;
        for (const s of g.stars) { s.x -= s.spd * 0.22 * dtFactor; if (s.x < 0) s.x = CW; }
        for (const n of g.nebulas) { n.x -= 0.06 * dtFactor; if (n.x + n.r < 0) n.x = CW + n.r; }

      } else { // dead
        for (const d of g.dusts) {
          d.x += d.vx * dtFactor; d.y += d.vy * dtFactor;
          d.vy += 0.14 * dtFactor; d.life -= 0.024 * dtFactor;
        }
        g.dusts = g.dusts.filter(d => d.life > 0);
      }

      drawGround(loopCtx, g.gOff);
      drawPillars(loopCtx, g.pillars);
      drawDusts(loopCtx, g.dusts);
      if (g.phase !== "dead" || g.dusts.length > 0) drawPlayer(loopCtx, g.py, g.phase, t, g.trail);

      // ── Overlay messages ──
      if (g.phase === "idle") {
        loopCtx.fillStyle = "rgba(7,9,31,0.48)";
        loopCtx.fillRect(0, 0, CW, CH);

        loopCtx.font = "500 13px 'DM Sans', sans-serif";
        loopCtx.textAlign = "center";
        const hint = "SPACE  ·  click  ·  tap  to start";
        const tw = loopCtx.measureText(hint).width;

        loopCtx.fillStyle = "rgba(124,115,240,0.13)";
        roundRect(loopCtx, CW / 2 - tw / 2 - 18, CH / 2 - 15, tw + 36, 30, 9);
        loopCtx.fill();
        loopCtx.strokeStyle = "rgba(124,115,240,0.28)";
        loopCtx.lineWidth = 1;
        roundRect(loopCtx, CW / 2 - tw / 2 - 18, CH / 2 - 15, tw + 36, 30, 9);
        loopCtx.stroke();
        loopCtx.fillStyle = "rgba(176,170,245,0.88)";
        loopCtx.fillText(hint, CW / 2, CH / 2 + 5.5);
      }

      if (g.phase === "dead") {
        loopCtx.fillStyle = "rgba(7,9,31,0.30)";
        loopCtx.fillRect(0, 0, CW, CH);
        loopCtx.font = "600 13px 'DM Sans', sans-serif";
        loopCtx.textAlign = "center";
        loopCtx.fillStyle = "rgba(244,179,179,0.90)";
        ctx.fillText("Story interrupted — press SPACE or click to try again", CW / 2, CH / 2 + 5);
      }

      g.raf = requestAnimationFrame(loop);
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); doJump(); }
    };
    const onClick = () => doJump();
    const onTouch = (e: TouchEvent) => { e.preventDefault(); doJump(); };

    window.addEventListener("keydown", onKey);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("touchstart", onTouch, { passive: false });
    g.raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(g.raf);
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("touchstart", onTouch);
    };
  }, []);

  return (
    <div style={s.root}>
      {/* ── 404 heading ── */}
      <div style={s.heroWrap}>
        <div style={s.glowRing} />
        <span style={s.fourOhFour}>404</span>
        <div style={s.tagline}>
          <span style={s.taglineAccent}>Lost in the void</span>
          <span style={s.taglineSub}> — this story doesn&apos;t exist yet.</span>
        </div>
      </div>

      {/* ── Game card ── */}
      <div style={s.gameCard}>
        <div style={s.scoreBar}>
          <span style={s.scoreLabel}>
            <span style={dotStyle(uiPhase === "running")} />
            {uiPhase === "idle" ? "Story Runner" : uiPhase === "running" ? "Running…" : "Game over"}
          </span>
          <div style={s.scoreNumbers}>
            {(uiScore > 0 || uiPhase === "running") && (
              <span style={s.scoreNum}>{uiScore}</span>
            )}
            {uiBest > 0 && (
              <span style={s.bestNum}>
                <span style={s.bestLabel}>BEST</span>
                {uiBest}
              </span>
            )}
          </div>
        </div>

        <canvas
          ref={canvasRef}
          width={CW}
          height={CH}
          style={s.canvas}
          aria-label="Story Runner — press SPACE to jump over obstacles"
        />

        <div style={s.hint}>
          <kbd style={s.kbd}>SPACE</kbd> or <kbd style={s.kbd}>↑</kbd> to jump
          &nbsp;·&nbsp; double-jump supported
          &nbsp;·&nbsp; click / tap on mobile
        </div>
      </div>

      {/* ── Navigation ── */}
      <div style={s.nav}>
        <Link href="/" style={s.navPrimary}>← Back to KhoshGolpo</Link>
        <Link href="/threads" style={s.navSecondary}>Browse threads</Link>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    background: "#080a10",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 32,
    padding: "40px 24px",
    fontFamily: "var(--font-dm-sans), sans-serif",
  },
  heroWrap: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
  },
  glowRing: {
    position: "absolute",
    top: "50%", left: "50%",
    transform: "translate(-50%, -54%)",
    width: 280, height: 110,
    borderRadius: "50%",
    background: "radial-gradient(ellipse at center, rgba(124,115,240,0.16) 0%, transparent 70%)",
    pointerEvents: "none",
    filter: "blur(22px)",
  },
  fourOhFour: {
    fontFamily: "var(--font-dm-serif), serif",
    fontSize: "clamp(100px, 17vw, 148px)",
    fontWeight: 400,
    lineHeight: 1,
    background: "linear-gradient(135deg, #f0834a 0%, #c86aff 55%, #7c73f0 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    letterSpacing: "-2px",
    userSelect: "none",
  },
  tagline: { fontSize: 15, letterSpacing: "0.01em", textAlign: "center" },
  taglineAccent: { color: "#e4e8f4", fontWeight: 600 },
  taglineSub:    { color: "#636f8d", fontWeight: 400 },

  gameCard: {
    display: "flex",
    flexDirection: "column",
    background: "#10131d",
    border: "1px solid #1e2235",
    borderRadius: 18,
    overflow: "hidden",
    boxShadow: "0 0 0 1px rgba(124,115,240,0.07), 0 40px 80px rgba(0,0,0,0.55)",
    maxWidth: "100%",
    width: CW,
  },
  scoreBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 18px",
    borderBottom: "1px solid #1a1f32",
  },
  scoreLabel: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    fontSize: 11, fontWeight: 700,
    color: "#636f8d",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  scoreNumbers: { display: "flex", alignItems: "center", gap: 16 },
  scoreNum: {
    fontSize: 15, fontWeight: 700, color: "#e4e8f4",
    fontVariantNumeric: "tabular-nums",
    minWidth: 44, textAlign: "right",
  },
  bestNum: {
    display: "flex", alignItems: "center", gap: 5,
    fontSize: 14, fontWeight: 700, color: "#f0834a",
    fontVariantNumeric: "tabular-nums",
  },
  bestLabel: {
    fontSize: 9, fontWeight: 800, color: "#f0834a", opacity: 0.7,
    letterSpacing: "0.08em", textTransform: "uppercase",
    alignSelf: "center", paddingBottom: 1,
  },
  canvas: {
    display: "block",
    cursor: "pointer",
    touchAction: "none",
    userSelect: "none",
    width: "100%",
    height: "auto",
  },
  hint: {
    fontSize: 11, color: "#323959",
    textAlign: "center",
    padding: "8px 18px",
    borderTop: "1px solid #141828",
    letterSpacing: "0.02em",
  },
  kbd: {
    display: "inline-block",
    background: "#181e30",
    border: "1px solid #262e48",
    borderBottom: "2px solid #262e48",
    borderRadius: 4,
    padding: "1px 5px",
    fontSize: 10,
    fontFamily: "monospace",
    color: "#535f82",
    lineHeight: 1.7,
  },
  nav: {
    display: "flex", gap: 12,
    flexWrap: "wrap", justifyContent: "center",
  },
  navPrimary: {
    display: "inline-block", padding: "10px 24px",
    background: "rgba(240,131,74,0.09)",
    border: "1px solid rgba(240,131,74,0.28)",
    borderRadius: 11, color: "#f0834a",
    fontWeight: 600, fontSize: 13, textDecoration: "none",
  },
  navSecondary: {
    display: "inline-block", padding: "10px 24px",
    background: "rgba(124,115,240,0.07)",
    border: "1px solid rgba(124,115,240,0.20)",
    borderRadius: 11, color: "#9d97f0",
    fontWeight: 600, fontSize: 13, textDecoration: "none",
  },
};

const dotStyle = (active: boolean): React.CSSProperties => ({
  width: 6, height: 6, borderRadius: "50%",
  background: active ? "#3dd68c" : "#2b3654",
  boxShadow: active ? "0 0 7px #3dd68c" : "none",
  flexShrink: 0, transition: "background 0.3s",
});
