// Transparent drawing layer laid over a card. Strokes are vectors; every finished
// gesture is reported through onChange(strokes) so the caller can persist it.
import { el } from "../ui.js";
import { LOGICAL_W, toLogical, pressureWidth, eraseAt } from "./strokes.js";

const ERASE_RADIUS = 14;
const HIGHLIGHT_ALPHA = 0.35;

function drawPen(ctx, s) {
  const p = s.points;
  ctx.strokeStyle = s.color;
  if (p.length === 1) {
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(p[0][0], p[0][1], pressureWidth(s.width, p[0][2]) / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  let prev = p[0];
  for (let i = 1; i < p.length; i++) {
    const cur = p[i];
    const next = p[i + 1];
    const mid = next ? [(cur[0] + next[0]) / 2, (cur[1] + next[1]) / 2] : cur;
    ctx.beginPath();
    ctx.moveTo(prev[0], prev[1]);
    ctx.quadraticCurveTo(cur[0], cur[1], mid[0], mid[1]);
    ctx.lineWidth = pressureWidth(s.width, cur[2]);
    ctx.stroke();
    prev = mid;
  }
}

// One path with constant width so the translucent colour does not double up at joints.
function drawHighlighter(ctx, s) {
  const p = s.points;
  ctx.save();
  ctx.globalAlpha = HIGHLIGHT_ALPHA;
  ctx.strokeStyle = s.color;
  ctx.lineWidth = s.width;
  ctx.beginPath();
  ctx.moveTo(p[0][0], p[0][1]);
  for (let i = 1; i < p.length - 1; i++) {
    ctx.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2);
  }
  ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
  ctx.stroke();
  ctx.restore();
}

export function createInkLayer({ penOnly, onChange }) {
  const canvas = el("canvas", { class: "ink-canvas", "aria-label": "El yazısı not katmanı" });
  const ctx = canvas.getContext("2d");
  let strokes = [];
  let past = [];
  let future = [];
  let current = null;
  let eraseBase = null;
  let pointerId = null;
  let brush = { tool: "pen", color: "#111827", width: 6 };

  function redraw() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = window.devicePixelRatio || 1;
    const scale = rect.width / LOGICAL_W;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of current ? [...strokes, current] : strokes) {
      if (s.tool === "highlighter") drawHighlighter(ctx, s); else drawPen(ctx, s);
    }
  }

  function fitCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    redraw();
  }
  new ResizeObserver(fitCanvas).observe(canvas);

  function commit(next) {
    past = [...past, strokes];
    future = [];
    strokes = next;
    redraw();
    onChange(strokes);
  }

  function samples(e) {
    const rect = canvas.getBoundingClientRect();
    const events = e.getCoalescedEvents?.();
    return (events?.length ? events : [e]).map((ev) => {
      const [x, y] = toLogical(ev.clientX, ev.clientY, rect);
      return [x, y, ev.pressure || 0.5];
    });
  }

  function down(e) {
    if (!canvas.classList.contains("active") || pointerId !== null) return;
    if (penOnly() && e.pointerType !== "pen") return; // palm rejection: fingers do not draw
    e.preventDefault();
    pointerId = e.pointerId;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // Capture is only a convenience (keeps the stroke going outside the canvas); drawing works without it.
    }
    const pts = samples(e);
    if (brush.tool === "eraser") {
      eraseBase = strokes;
      strokes = eraseAt(strokes, pts[0][0], pts[0][1], ERASE_RADIUS);
    } else {
      const width = brush.tool === "highlighter" ? brush.width * 4 : brush.width;
      current = { tool: brush.tool, color: brush.color, width, points: pts };
    }
    redraw();
  }

  function move(e) {
    if (e.pointerId !== pointerId) return;
    e.preventDefault();
    const pts = samples(e);
    if (brush.tool === "eraser") {
      for (const [x, y] of pts) strokes = eraseAt(strokes, x, y, ERASE_RADIUS);
    } else if (current) {
      current = { ...current, points: [...current.points, ...pts] }; // ponytail: full redraw per move, add dirty-rect if long notes lag
    }
    redraw();
  }

  function up(e) {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    if (eraseBase) {
      const after = strokes;
      strokes = eraseBase;
      eraseBase = null;
      if (after !== strokes) commit(after);
    } else if (current) {
      const done = current;
      current = null;
      commit([...strokes, done]);
    }
  }

  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  return {
    canvas,
    load(initial) { strokes = initial; past = []; future = []; redraw(); },
    setActive(on) { canvas.classList.toggle("active", on); },
    setBrush(next) { brush = { ...brush, ...next }; },
    undo() {
      if (!past.length) return;
      future = [...future, strokes];
      strokes = past[past.length - 1];
      past = past.slice(0, -1);
      redraw();
      onChange(strokes);
    },
    redo() {
      if (!future.length) return;
      past = [...past, strokes];
      strokes = future[future.length - 1];
      future = future.slice(0, -1);
      redraw();
      onChange(strokes);
    },
    clear() { if (strokes.length) commit([]); },
    status: () => ({ canUndo: past.length > 0, canRedo: future.length > 0, hasStrokes: strokes.length > 0 }),
  };
}
