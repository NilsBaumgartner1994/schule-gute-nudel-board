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

test('Ganzer Stand (Stern, Ampel, Einstellungen) übersteht Hin- und Rückweg', async () => {
  const { encodeState, decodeState } = await import('../public/js/codec.js');
  const state = {
    groups: sample,
    current: 'Gruppe 2',
    star: { 'Klasse 1a': ['Ben', 'Zoë'], 'Gruppe 2': [] },
    ampel: { 'Klasse 1a': { Anna: 'red', Çelik: 'yellow' } },
    settings: { mode: 'ampel', shape: 'star', animations: false, sidebarOpen: true },
  };
  const code = await encodeState(state);
  assert.match(code, /^2[zp][A-Za-z0-9_-]+$/);
  assert.deepEqual(await decodeState(code), { ...state, star: { 'Klasse 1a': ['Ben', 'Zoë'] } });
});

test('Alte Links (nur Gruppen) werden weiter gelesen', async () => {
  const { decodeState } = await import('../public/js/codec.js');
  const s = await decodeState(await encodeGroups(sample));
  assert.deepEqual(s.groups, sample);
  assert.deepEqual(s.star, {});
});

test('Unbekannte Namen und Farben im Link werden ignoriert', async () => {
  const { encodeState, decodeState } = await import('../public/js/codec.js');
  const code = await encodeState({
    groups: sample,
    current: 'Gibt es nicht',
    star: { 'Klasse 1a': ['Anna', 'Fremd'], Fremd: ['X'] },
    ampel: { 'Klasse 1a': { Ben: 'lila', Ole: 'red' } },
  });
  const s = await decodeState(code);
  assert.equal(s.current, null);
  assert.deepEqual(s.star, { 'Klasse 1a': ['Anna'] });
  assert.deepEqual(s.ampel, { 'Klasse 1a': {} });
});
