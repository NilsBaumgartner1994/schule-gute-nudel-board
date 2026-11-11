// Formen für die Mitte. Jede Form liefert ein Polygon im Koordinatensystem
// 0..100 x 0..100 und einen Mittelpunkt, um den die Namen angeordnet werden.
// Später können hier weitere Formen (z. B. Kreis, Herz) ergänzt werden.

function starPolygon({ cx = 50, cy = 54.5, outer = 52, ratio = 0.56, points = 5 } = {}) {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : outer * ratio;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

export const SHAPES = {
  star: {
    label: 'Stern',
    polygon: starPolygon(),
    // vertikaler Schwerpunkt für den Namensblock
    centerY: 56.5,
  },
};

export function polygonPath(pts) {
  return 'M' + pts.map((p) => p.map((n) => n.toFixed(2)).join(',')).join('L') + 'Z';
}

/**
 * Abgerundeter Pfad (weiche Spitzen), damit der Stern freundlicher wirkt.
 * r = Rundungsradius in Einheiten des Koordinatensystems.
 */
export function roundedPolygonPath(pts, r = 3) {
  const n = pts.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const v1 = [p0[0] - p1[0], p0[1] - p1[1]];
    const v2 = [p2[0] - p1[0], p2[1] - p1[1]];
    const l1 = Math.hypot(...v1);
    const l2 = Math.hypot(...v2);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const a = [p1[0] + (v1[0] / l1) * rr, p1[1] + (v1[1] / l1) * rr];
    const b = [p1[0] + (v2[0] / l2) * rr, p1[1] + (v2[1] / l2) * rr];
    d += (i === 0 ? 'M' : 'L') + a.map((x) => x.toFixed(2)).join(',');
    d += 'Q' + p1.map((x) => x.toFixed(2)).join(',') + ' ' + b.map((x) => x.toFixed(2)).join(',');
  }
  return d + 'Z';
}

/** Horizontales Stück des Polygons auf Höhe y, das die Mitte cx enthält. */
export function spanAt(pts, y, cx = 50) {
  const xs = [];
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
      xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
    }
  }
  xs.sort((a, b) => a - b);
  for (let i = 0; i + 1 < xs.length; i += 2) {
    if (xs[i] <= cx && xs[i + 1] >= cx) return [xs[i], xs[i + 1]];
  }
  return null;
}

/** Alle Innen-Abschnitte des Polygons auf Höhe y, von links nach rechts. */
export function segmentsAt(pts, y) {
  const xs = [];
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
      xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
    }
  }
  xs.sort((a, b) => a - b);
  const segs = [];
  for (let i = 0; i + 1 < xs.length; i += 2) segs.push([xs[i], xs[i + 1]]);
  return segs;
}

function intersect(a, b) {
  const out = [];
  for (const [a0, a1] of a) {
    for (const [b0, b1] of b) {
      const l = Math.max(a0, b0);
      const r = Math.min(a1, b1);
      if (r > l) out.push([l, r]);
    }
  }
  return out;
}

/** Abschnitte, die über die ganze Zeilenhöhe innen liegen (mit Rand). */
function rowSegments(pts, y0, y1, margin) {
  // An den Rändern der Zeile und an allen Ecken dazwischen prüfen,
  // da die Kanten dazwischen gerade verlaufen.
  const ys = [y0, y1, ...pts.map((p) => p[1]).filter((y) => y > y0 && y < y1)];
  let segs = null;
  for (const y of ys) {
    const s = segmentsAt(pts, y);
    segs = segs ? intersect(segs, s) : s;
    if (!segs.length) return [];
  }
  return segs.map(([l, r]) => [l + margin, r - margin]).filter(([l, r]) => r > l);
}

/**
 * Verteilt Namen im Inneren der Form, so groß wie möglich.
 * Zeilen dürfen die ganze Höhe nutzen, auch die Spitze oben und die Arme.
 * measure(name) liefert die Textbreite bei Schriftgröße 1.
 * Ergebnis: { fontSize, items: [{ name, x, y }] } mit x/y = Mittelpunkt (0..100).
 */
export function layoutNames(shape, names, measure, opts = {}) {
  const pts = shape.polygon;
  const maxFont = opts.maxFont ?? 14;
  const minFont = opts.minFont ?? 1.2;
  const lineHeight = opts.lineHeight ?? 1.18;
  const gap = opts.gap ?? 0.7; // Abstand zwischen Namen, relativ zur Schriftgröße
  if (!names.length) return { fontSize: maxFont, items: [] };

  const widths = names.map((n) => measure(n));
  const yMin = Math.min(...pts.map((p) => p[1]));
  const yMax = Math.max(...pts.map((p) => p[1]));
  const targetCenter = opts.centerY ?? shape.centerY;

  // Versucht eine Anordnung mit Schriftgröße f und Startversatz top.
  const place = (f, top) => {
    const rh = f * lineHeight;
    const margin = f * 0.3;
    const rows = [];
    let i = 0;
    for (let y = top; y + rh <= yMax && i < names.length; y += rh) {
      const segs = rowSegments(pts, y, y + rh, margin).map((sg) => ({ sg, items: [], width: 0 }));
      for (const seg of segs) {
        const avail = seg.sg[1] - seg.sg[0];
        while (i < names.length) {
          const w = widths[i] * f;
          const need = seg.items.length ? seg.width + gap * f + w : w;
          if (need > avail) break;
          seg.items.push(i);
          seg.width = need;
          i++;
        }
      }
      rows.push({ y: y + rh / 2, segs });
    }
    if (i < names.length) return null;
    while (rows.length && !rows[rows.length - 1].segs.some((s) => s.items.length)) rows.pop();
    while (rows.length && !rows[0].segs.some((s) => s.items.length)) rows.shift();
    return rows;
  };

  // Für eine Schriftgröße alle Startpositionen durchprobieren,
  // die Anordnung nehmen, deren Mitte am besten zur Form passt.
  const tryFit = (f) => {
    const rh = f * lineHeight;
    const step = rh / 6;
    let best = null;
    for (let top = yMin; top + rh <= yMax; top += step) {
      const rows = place(f, top);
      if (!rows || !rows.length) continue;
      const mid = (rows[0].y + rows[rows.length - 1].y) / 2;
      const score = Math.abs(mid - targetCenter);
      if (!best || score < best.score) best = { rows, score };
    }
    if (!best) return null;
    const items = [];
    for (const row of best.rows) {
      for (const seg of row.segs) {
        let x = (seg.sg[0] + seg.sg[1]) / 2 - seg.width / 2;
        for (const idx of seg.items) {
          const w = widths[idx] * f;
          items.push({ name: names[idx], x: x + w / 2, y: row.y });
          x += w + gap * f;
        }
      }
    }
    return items;
  };

  let lo = minFont;
  let hi = maxFont;
  let best = tryFit(hi);
  if (best) return { fontSize: hi, items: best };
  best = tryFit(lo);
  if (!best) return { fontSize: lo, items: fallbackGrid(names, lo, shape) };
  for (let iter = 0; iter < 14; iter++) {
    const mid = (lo + hi) / 2;
    const res = tryFit(mid);
    if (res) {
      lo = mid;
      best = res;
    } else {
      hi = mid;
    }
  }
  return { fontSize: lo, items: best };
}

function fallbackGrid(names, f, shape) {
  const cols = Math.ceil(Math.sqrt(names.length));
  const rows = Math.ceil(names.length / cols);
  const rh = f * 1.2;
  const top = shape.centerY - (rows * rh) / 2;
  return names.map((name, i) => ({
    name,
    x: 25 + ((i % cols) + 0.5) * (50 / cols),
    y: top + (Math.floor(i / cols) + 0.5) * rh,
  }));
}
