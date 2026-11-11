// Kodiert die Gruppen kompakt für die URL (Hash) und dekodiert sie wieder.
//
// Format (Version 1):
//   Klartext: Gruppen getrennt durch eine Leerzeile, erste Zeile = Gruppenname,
//   danach ein Kind pro Zeile. Dieser Text wird mit "deflate-raw" komprimiert
//   und als base64url geschrieben.
//   Präfix "1z" = Version 1, komprimiert. "1p" = Version 1, unkomprimiert
//   (Rückfall für Browser ohne CompressionStream).
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

/** Gruppen -> kurzer String für die URL */
export async function encodeGroups(groups) {
  const bytes = new TextEncoder().encode(groupsToText(groups));
  if (hasCompression) {
    try {
      const packed = await pipeThrough(bytes, new CompressionStream('deflate-raw'));
      return '1z' + bytesToBase64Url(packed);
    } catch {
      /* Rückfall unten */
    }
  }
  return '1p' + bytesToBase64Url(bytes);
}

/** String aus der URL -> Gruppen. Wirft einen Fehler bei ungültigen Daten. */
export async function decodeGroups(code) {
  const str = String(code || '').trim();
  const version = str.slice(0, 2);
  const payload = str.slice(2);
  let bytes = base64UrlToBytes(payload);
  if (version === '1z') {
    if (!hasCompression) throw new Error('Dieser Browser kann den Link nicht entpacken.');
    bytes = await pipeThrough(bytes, new DecompressionStream('deflate-raw'));
  } else if (version !== '1p') {
    throw new Error('Unbekanntes Link-Format.');
  }
  return textToGroups(new TextDecoder().decode(bytes));
}

/** Liest den Gruppen-Code aus einem location.hash wie "#g=1z..." */
export function readCodeFromHash(hash) {
  const params = new URLSearchParams(String(hash || '').replace(/^#/, ''));
  return params.get(HASH_KEY);
}

export function groupsEqual(a, b) {
  return groupsToText(a) === groupsToText(b);
}
