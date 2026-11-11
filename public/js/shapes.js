// Formen für die Mitte. Jede Form liefert ein Polygon im Koordinatensystem
// 0..100 x 0..100 und einen Mittelpunkt, um den die Namen angeordnet werden.
// Später können hier weitere Formen (z. B. Kreis, Herz) ergänzt werden.

function starPolygon({ cx = 50, cy = 53, outer = 49, ratio = 0.56, points = 5 } = {}) {
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
    centerY: 58,
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

/** Nutzbare Breite für eine Zeile zwischen y0 und y1 (mit Rand). */
function rowSpan(pts, y0, y1, margin) {
  let left = -Infinity;
  let right = Infinity;
  const steps = 4;
  for (let s = 0; s <= steps; s++) {
    const sp = spanAt(pts, y0 + ((y1 - y0) * s) / steps);
    if (!sp) return null;
    left = Math.max(left, sp[0]);
    right = Math.min(right, sp[1]);
  }
  left += margin;
  right -= margin;
  return right > left ? [left, right] : null;
}

/**
 * Verteilt Namen im Inneren der Form.
 * measure(name) liefert die Textbreite bei Schriftgröße 1.
 * Ergebnis: { fontSize, items: [{ name, x, y }] } mit x/y = Mittelpunkt (0..100).
 */
export function layoutNames(shape, names, measure, opts = {}) {
  const pts = shape.polygon;
  const maxFont = opts.maxFont ?? 11;
  const minFont = opts.minFont ?? 1.2;
  const lineHeight = opts.lineHeight ?? 1.3;
  const gap = opts.gap ?? 0.9; // Abstand zwischen Namen, relativ zur Schriftgröße
  if (!names.length) return { fontSize: maxFont, items: [] };

  const widths = names.map((n) => measure(n));

  const tryFit = (f) => {
    const rh = f * lineHeight;
    const margin = f * 0.35;
    const maxRows = Math.floor(90 / rh);
    for (let k = 1; k <= maxRows; k++) {
      const top = shape.centerY - (k * rh) / 2;
      const rows = [];
      let ok = true;
      for (let r = 0; r < k; r++) {
        const sp = rowSpan(pts, top + r * rh, top + (r + 1) * rh, margin);
        if (!sp) {
          ok = false;
          break;
        }
        rows.push({ span: sp, y: top + (r + 0.5) * rh, items: [], width: 0 });
      }
      if (!ok) continue;
      // Gleichmäßig auf die Zeilen verteilen: zuerst gierig füllen
      let ri = 0;
      let fits = true;
      for (let i = 0; i < names.length; i++) {
        const w = widths[i] * f;
        while (ri < rows.length) {
          const row = rows[ri];
          const avail = row.span[1] - row.span[0];
          const need = row.items.length ? row.width + gap * f + w : w;
          if (need <= avail) {
            row.items.push(i);
            row.width = need;
            break;
          }
          ri++;
        }
        if (ri >= rows.length) {
          fits = false;
          break;
        }
      }
      if (!fits) continue;
      // Leere Zeilen am Ende vermeiden: Block neu zentrieren
      const used = rows.filter((r) => r.items.length);
      if (used.length < rows.length) continue;
      const items = [];
      for (const row of rows) {
        const mid = (row.span[0] + row.span[1]) / 2;
        let x = mid - row.width / 2;
        for (const i of row.items) {
          const w = widths[i] * f;
          items.push({ name: names[i], x: x + w / 2, y: row.y });
          x += w + gap * f;
        }
      }
      return items;
    }
    return null;
  };

  // Binäre Suche nach der größten passenden Schrift
  let lo = minFont;
  let hi = maxFont;
  let best = tryFit(hi);
  if (best) return { fontSize: hi, items: best };
  best = tryFit(lo);
  if (!best) {
    // Passt nicht einmal klein: kleinste Größe trotzdem nutzen (überlappt ggf.)
    return { fontSize: lo, items: fallbackGrid(names, lo, shape) };
  }
  for (let iter = 0; iter < 18; iter++) {
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
