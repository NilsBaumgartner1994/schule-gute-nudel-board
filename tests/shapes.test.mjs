import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHAPES, layoutNames, spanAt } from '../public/js/shapes.js';

const measure = (name) => name.length * 0.55 + 0.24;

function inside(pts, x, y) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

test('Stern hat in der Mitte Platz', () => {
  const sp = spanAt(SHAPES.star.polygon, 55);
  assert.ok(sp && sp[1] - sp[0] > 30);
});

for (const count of [1, 5, 20, 40]) {
  test(`${count} Namen liegen alle im Stern`, () => {
    const names = Array.from({ length: count }, (_, i) => `Kind ${i + 1}`);
    const { fontSize, items } = layoutNames(SHAPES.star, names, measure);
    assert.equal(items.length, count);
    assert.ok(fontSize > 1);
    for (const it of items) {
      const half = (measure(it.name) * fontSize) / 2;
      assert.ok(inside(SHAPES.star.polygon, it.x - half, it.y), `${it.name} links außerhalb`);
      assert.ok(inside(SHAPES.star.polygon, it.x + half, it.y), `${it.name} rechts außerhalb`);
    }
  });
}

test('Mehr Namen bedeuten kleinere Schrift', () => {
  const few = layoutNames(SHAPES.star, ['Anna', 'Ben'], measure).fontSize;
  const many = layoutNames(SHAPES.star, Array.from({ length: 25 }, (_, i) => `Name${i}`), measure).fontSize;
  assert.ok(many < few);
});
