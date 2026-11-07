"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";

/**
 * The room behind every page: a globe of points turning slowly, and every
 * second or so an arc from a green point to a pink one.
 *
 * That arc is the venue's own mechanism drawn large. On DreamDEX two opposite
 * buyers cross by minting a fresh pair — somebody saying UP and somebody saying
 * DOWN on the same window *is* the liquidity — so the background shows
 * disagreement connecting people rather than a generic network.
 *
 * Three layers that move differently with the pointer and the scroll: a far
 * wash of up/down light, the canvas globe, and a few near sparks. Full on the
 * feed, quiet on the board, profiles and receipts. The canvas stops with the
 * tab hidden and draws one still frame under reduced motion.
 */

const readVar = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function hexToRgb(hex: string, fallback: string) {
  const m = hex.replace("#", "").match(/^([0-9a-f]{6})/i);
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return mobile;
}

type Arc = { a: number; b: number; born: number };

function Globe({
  reduce,
  full,
  mobile,
  px,
}: {
  reduce: boolean;
  full: boolean;
  mobile: boolean;
  px: MotionValue<number>;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const n = mobile ? 280 : full ? 650 : 420;

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, s: SceneState) => {
      if (s.frame++ % 45 === 0) {
        s.up = hexToRgb(readVar("--up"), s.up);
        s.down = hexToRgb(readVar("--down"), s.down);
        s.dot = hexToRgb(readVar("--muted"), s.dot);
        s.strength = parseFloat(readVar("--amb-strength")) || 1;
      }
      const R = mobile ? w * 0.62 : Math.min(w, h) * 0.38;
      const cx = mobile ? w * 0.5 : w * 0.82;
      const cy = mobile ? h * 0.2 : h * 0.4;
      const rot = t * (full ? 0.09 : 0.05) + px.get() * 0.5;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      const tilt = 0.32;
      const ct = Math.cos(tilt);
      const st = Math.sin(tilt);

      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < s.pts.length; i++) {
        const [x0, y0, z0] = s.pts[i];
        const x1 = x0 * cos - z0 * sin;
        const z1 = x0 * sin + z0 * cos;
        const y2 = y0 * ct - z1 * st;
        const z2 = y0 * st + z1 * ct;
        const k = 600 / (600 + z2 * R * 0.6);
        s.proj[i * 3] = cx + x1 * R * k;
        s.proj[i * 3 + 1] = cy + y2 * R * k;
        s.proj[i * 3 + 2] = z2;
        const front = z2 < 0 ? 1 : 0.25;
        const alpha = (0.18 + 0.5 * front) * s.strength;
        ctx.fillStyle = `rgba(${s.dot}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(s.proj[i * 3], s.proj[i * 3 + 1], front ? 1.5 : 1, 0, Math.PI * 2);
        ctx.fill();
      }

      // A new crossing every so often, between two points on the visible face.
      const every = full ? 1.2 : 2.4;
      const max = full ? 4 : 2;
      if (!reduce && t - s.lastArc > every && s.arcs.length < max) {
        const a = Math.floor(Math.random() * s.pts.length);
        const b = Math.floor(Math.random() * s.pts.length);
        if (a !== b) s.arcs.push({ a, b, born: t });
        s.lastArc = t;
      }
      if (reduce && s.arcs.length === 0) {
        s.arcs.push({ a: 3, b: Math.floor(s.pts.length / 2), born: -0.8 });
      }

      const life = 2.4;
      s.arcs = s.arcs.filter((arc) => t - arc.born < life || reduce);
      for (const arc of s.arcs) {
        const ax = s.proj[arc.a * 3], ay = s.proj[arc.a * 3 + 1], az = s.proj[arc.a * 3 + 2];
        const bx = s.proj[arc.b * 3], by = s.proj[arc.b * 3 + 1], bz = s.proj[arc.b * 3 + 2];
        if (az > 0.2 || bz > 0.2) continue; // only across the face we can see
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        const qx = cx + (mx - cx) * 1.45, qy = cy + (my - cy) * 1.45;
        const p = reduce ? 0.6 : Math.min(1, (t - arc.born) / 1.4);
        const fade = reduce ? 1 : 1 - Math.max(0, (t - arc.born - 1.4) / (life - 1.4));
        const grad = ctx.createLinearGradient(ax, ay, bx, by);
        grad.addColorStop(0, `rgba(${s.up}, ${0.75 * fade * s.strength})`);
        grad.addColorStop(1, `rgba(${s.down}, ${0.75 * fade * s.strength})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        const steps = 24;
        for (let k2 = 0; k2 <= steps * p; k2++) {
          const u = k2 / steps;
          const x = (1 - u) * (1 - u) * ax + 2 * (1 - u) * u * qx + u * u * bx;
          const y = (1 - u) * (1 - u) * ay + 2 * (1 - u) * u * qy + u * u * by;
          if (k2) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.stroke();
        // the comet head, where the two sides meet
        const u = p;
        const hx = (1 - u) * (1 - u) * ax + 2 * (1 - u) * u * qx + u * u * bx;
        const hy = (1 - u) * (1 - u) * ay + 2 * (1 - u) * u * qy + u * u * by;
        ctx.fillStyle = `rgba(${u < 0.5 ? s.up : s.down}, ${fade * s.strength})`;
        ctx.beginPath();
        ctx.arc(hx, hy, 2.6, 0, Math.PI * 2);
        ctx.fill();
        // endpoints: one UP, one DOWN
        ctx.fillStyle = `rgba(${s.up}, ${0.9 * fade * s.strength})`;
        ctx.beginPath(); ctx.arc(ax, ay, 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(${s.down}, ${0.9 * fade * s.strength})`;
        ctx.beginPath(); ctx.arc(bx, by, 2.4, 0, Math.PI * 2); ctx.fill();
      }
    },
    [full, mobile, px, reduce],
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    // Fibonacci sphere: an even spread of points with no clumping at the poles
    const pts = Array.from({ length: n }, (_, i) => {
      const y = 1 - (i / (n - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = Math.PI * (3 - Math.sqrt(5)) * i;
      return [Math.cos(th) * r, y, Math.sin(th) * r] as [number, number, number];
    });
    const state: SceneState = {
      pts, proj: new Float32Array(n * 3), arcs: [], lastArc: 0, frame: 0,
      up: "53, 227, 155", down: "255, 93, 125", dot: "164, 155, 187", strength: 1,
    };
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0, raf = 0;
    const resize = () => {
      w = el.clientWidth; h = el.clientHeight;
      el.width = w * dpr; el.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reduce) draw(ctx, w, h, 0, state);
    };
    resize();
    window.addEventListener("resize", resize);
    if (reduce) return () => window.removeEventListener("resize", resize);
    const loop = (ms: number) => { draw(ctx, w, h, ms / 1000, state); raf = requestAnimationFrame(loop); };
    const onVis = () => { cancelAnimationFrame(raf); if (!document.hidden) raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [n, reduce, draw]);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />;
}

type SceneState = {
  pts: [number, number, number][];
  proj: Float32Array;
  arcs: Arc[];
  lastArc: number;
  frame: number;
  up: string;
  down: string;
  dot: string;
  strength: number;
};

const SPARKS = [
  { x: "8%", y: "30%", size: 10, depth: 1, tone: "up", mobile: false },
  { x: "18%", y: "78%", size: 6, depth: 0.6, tone: "down", mobile: false },
  { x: "62%", y: "88%", size: 8, depth: 0.8, tone: "gold", mobile: true },
  { x: "92%", y: "82%", size: 5, depth: 0.5, tone: "up", mobile: true },
] as const;

function Spark({ s, reduce, px, py, scroll }: {
  s: (typeof SPARKS)[number];
  reduce: boolean;
  px: MotionValue<number>;
  py: MotionValue<number>;
  scroll: MotionValue<number>;
}) {
  const x = useTransform(px, (v) => (reduce ? 0 : v * 40 * s.depth));
  const y = useTransform([py, scroll] as MotionValue<number>[], ([p, sc]: number[]) =>
    reduce ? 0 : p * 26 * s.depth - sc * 260 * s.depth,
  );
  return (
    <motion.div className={`amb-spark amb-spark-${s.tone}`} style={{ left: s.x, top: s.y, width: s.size, height: s.size, x, y }}>
      <motion.i
        animate={reduce ? undefined : { scale: [1, 1.6, 1], opacity: [0.9, 0.35, 0.9] }}
        transition={{ duration: 3 + s.depth * 2, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.div>
  );
}

export function AmbientBackground() {
  const pathname = usePathname();
  const full = pathname === "/";
  const reduce = useReducedMotion() ?? false;
  const mobile = useIsMobile();

  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const px = useSpring(rx, { stiffness: 40, damping: 18 });
  const py = useSpring(ry, { stiffness: 40, damping: 18 });
  useEffect(() => {
    if (reduce || !window.matchMedia("(pointer: fine)").matches) return;
    const onMove = (e: PointerEvent) => {
      rx.set((e.clientX / window.innerWidth - 0.5) * 2);
      ry.set((e.clientY / window.innerHeight - 0.5) * 2);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduce, rx, ry]);

  const { scrollYProgress } = useScroll();
  const scroll = useSpring(scrollYProgress, { stiffness: 60, damping: 20 });
  const farY = useTransform(scroll, (v) => (reduce ? 0 : v * -30));
  const midY = useTransform(scroll, (v) => (reduce ? 0 : v * -120));
  const farX = useTransform(px, (v) => (reduce ? 0 : v * -12));
  const midX = useTransform(px, (v) => (reduce ? 0 : v * -20));

  const sparks = SPARKS.filter((s) => (mobile ? s.mobile : true) && (full || s.depth === 1));

  return (
    <div aria-hidden className={`amb-root ${full ? "amb-full" : "amb-calm"}`}>
      <motion.div className="amb-layer amb-far" style={{ y: farY, x: farX }} />
      <motion.div className="amb-layer amb-mid" style={{ y: midY, x: midX }}>
        <Globe reduce={reduce} full={full} mobile={mobile} px={px} />
      </motion.div>
      <div className="amb-vignette" />
      <div className="amb-layer">
        {sparks.map((s) => (
          <Spark key={`${s.x}${s.y}`} s={s} reduce={reduce} px={px} py={py} scroll={scroll} />
        ))}
      </div>
    </div>
  );
}
