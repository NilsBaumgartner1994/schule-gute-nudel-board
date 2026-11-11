import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeGroups, decodeGroups, readCodeFromHash, normalizeGroups, groupsEqual } from '../public/js/codec.js';

const sample = [
  { name: 'Klasse 1a', kids: ['Anna', 'Ben', 'Çelik', 'Łukasz', 'Zoë', 'Lena M.'] },
  { name: 'Gruppe 2', kids: ['Noah', 'Ole'] },
];

test('Gruppen überstehen Hin- und Rückweg', async () => {
  const code = await encodeGroups(sample);
  assert.match(code, /^1[zp][A-Za-z0-9_-]+$/);
  assert.deepEqual(await decodeGroups(code), sample);
});

test('Link bleibt auch bei einer ganzen Schule klein', async () => {
  const groups = Array.from({ length: 4 }, (_, i) => ({
    name: `Klasse ${i + 1}a`,
    kids: Array.from({ length: 25 }, (_, k) => `Kind${i}-${k}`),
  }));
  const code = await encodeGroups(groups);
  assert.ok(code.length < 1500, `Code ist ${code.length} Zeichen lang`);
  assert.deepEqual(await decodeGroups(code), groups);
});

test('Hash wird gelesen', () => {
  assert.equal(readCodeFromHash('#g=1zabc'), '1zabc');
  assert.equal(readCodeFromHash(''), null);
});

test('Leere Namen und Dubletten verschwinden, Gruppennamen werden eindeutig', () => {
  const out = normalizeGroups([
    { name: ' A ', kids: ['Mia', '', ' Mia ', 'Tom\n'] },
    { name: 'A', kids: [] },
  ]);
  assert.deepEqual(out, [
    { name: 'A', kids: ['Mia', 'Tom'] },
    { name: 'A (2)', kids: [] },
  ]);
});

test('Kaputte Links werfen einen Fehler', async () => {
  await assert.rejects(() => decodeGroups('9xyz'));
});

test('groupsEqual vergleicht inhaltlich', () => {
  assert.ok(groupsEqual(sample, structuredClone(sample)));
  assert.ok(!groupsEqual(sample, [sample[0]]));
});
