// Kodiert die Gruppen kompakt für die URL (Hash) und dekodiert sie wieder.
//
// Format (Version 1):
//   Klartext: Gruppen getrennt durch eine Leerzeile, erste Zeile = Gruppenname,
//   danach ein Kind pro Zeile. Dieser Text wird mit "deflate-raw" komprimiert
//   und als base64url geschrieben.
//   Präfix "1z" = Version 1, komprimiert. "1p" = Version 1, unkomprimiert
//   (Rückfall für Browser ohne CompressionStream).
//
// Format (Version 2) – der ganze Stand der Seite, nicht nur die Gruppen:
//   JSON { g: Gruppen als Klartext (wie oben), c: aktuelle Gruppe,
//          s: Namen im Stern, a: Ampel-Farben, o: Einstellungen },
//   komprimiert wie oben. Präfix "2z" bzw. "2p".
//   Version-1-Links werden weiterhin gelesen.
//
// Läuft im Browser und in Node (für die Tests).

export const HASH_KEY = 'g';

/** Bereinigt Gruppen: Leerzeichen trimmen, leere Namen und Dubletten entfernen. */
export function normalizeGroups(groups) {
  const out = [];
  const usedGroupNames = new Set();
  for (const g of groups || []) {
    let name = cleanLine(g && g.name) || 'Gruppe';
    // Gruppennamen eindeutig machen
    let unique = name;
    let n = 2;
    while (usedGroupNames.has(unique)) unique = `${name} (${n++})`;
    usedGroupNames.add(unique);
    const seen = new Set();
    const kids = [];
    for (const k of (g && g.kids) || []) {
      const kid = cleanLine(k);
      if (kid && !seen.has(kid)) {
        seen.add(kid);
        kids.push(kid);
      }
    }
    out.push({ name: unique, kids });
  }
  return out;
}

function cleanLine(s) {
  return String(s ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function groupsToText(groups) {
  return normalizeGroups(groups)
    .map((g) => [g.name, ...g.kids].join('\n'))
    .join('\n\n');
}

export function textToGroups(text) {
  const blocks = String(text || '')
    .replace(/\r/g, '')
    .split(/\n{2,}/)
    .map((b) => b.split('\n'))
    .filter((lines) => lines.length && lines[0].trim());
  return normalizeGroups(blocks.map(([name, ...kids]) => ({ name, kids })));
}

// ---------- base64url ----------

function bytesToBase64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(str) {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function pipeThrough(bytes, stream) {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

const hasCompression =
  typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

// ---------- öffentliche API ----------

async function pack(version, text) {
  const bytes = new TextEncoder().encode(text);
  if (hasCompression) {
    try {
      const packed = await pipeThrough(bytes, new CompressionStream('deflate-raw'));
      return version + 'z' + bytesToBase64Url(packed);
    } catch {
      /* Rückfall unten */
    }
  }
  return version + 'p' + bytesToBase64Url(bytes);
}

/** Liefert { version: '1' | '2', text } */
async function unpack(code) {
  const str = String(code || '').trim();
  const version = str.slice(0, 1);
  const kind = str.slice(1, 2);
  if (!['1', '2'].includes(version) || !['z', 'p'].includes(kind)) throw new Error('Unbekanntes Link-Format.');
  let bytes = base64UrlToBytes(str.slice(2));
  if (kind === 'z') {
    if (!hasCompression) throw new Error('Dieser Browser kann den Link nicht entpacken.');
    bytes = await pipeThrough(bytes, new DecompressionStream('deflate-raw'));
  }
  return { version, text: new TextDecoder().decode(bytes) };
}

/** Gruppen -> kurzer String für die URL */
export async function encodeGroups(groups) {
  return pack('1', groupsToText(groups));
}

/** String aus der URL -> Gruppen. Wirft einen Fehler bei ungültigen Daten. */
export async function decodeGroups(code) {
  return (await decodeState(code)).groups;
}

const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);

/** Ganzer Stand -> String für die URL. Leere Einträge werden weggelassen. */
export async function encodeState({ groups, current, star, ampel, settings }) {
  const data = { g: groupsToText(groups) };
  if (current) data.c = current;
  const s = {};
  for (const [g, names] of Object.entries(star || {})) if (Array.isArray(names) && names.length) s[g] = names;
  if (Object.keys(s).length) data.s = s;
  const a = {};
  for (const [g, map] of Object.entries(ampel || {})) if (isObj(map) && Object.keys(map).length) a[g] = map;
  if (Object.keys(a).length) data.a = a;
  if (settings) data.o = settings;
  return pack('2', JSON.stringify(data));
}

/**
 * String aus der URL -> { groups, current, star, ampel, settings }.
 * Bei alten Links (Version 1) sind nur die Gruppen gefüllt.
 * Wirft einen Fehler bei ungültigen Daten.
 */
export async function decodeState(code) {
  const { version, text } = await unpack(code);
  if (version === '1') return { groups: textToGroups(text), current: null, star: {}, ampel: {}, settings: {} };
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Der Link ist beschädigt.');
  }
  if (!isObj(data)) throw new Error('Der Link ist beschädigt.');
  const groups = textToGroups(data.g);
  const names = new Map(groups.map((g) => [g.name, new Set(g.kids)]));
  const star = {};
  for (const [g, list] of Object.entries(isObj(data.s) ? data.s : {})) {
    if (names.has(g) && Array.isArray(list)) star[g] = list.filter((n) => names.get(g).has(n));
  }
  const ampel = {};
  for (const [g, map] of Object.entries(isObj(data.a) ? data.a : {})) {
    if (!names.has(g) || !isObj(map)) continue;
    ampel[g] = {};
    for (const [n, color] of Object.entries(map)) {
      if (names.get(g).has(n) && ['yellow', 'orange', 'red'].includes(color)) ampel[g][n] = color;
    }
  }
  return {
    groups,
    current: typeof data.c === 'string' && names.has(data.c) ? data.c : null,
    star,
    ampel,
    settings: isObj(data.o) ? data.o : {},
  };
}

/** Liest den Gruppen-Code aus einem location.hash wie "#g=1z..." */
export function readCodeFromHash(hash) {
  const params = new URLSearchParams(String(hash || '').replace(/^#/, ''));
  return params.get(HASH_KEY);
}

export function groupsEqual(a, b) {
  return groupsToText(a) === groupsToText(b);
}
