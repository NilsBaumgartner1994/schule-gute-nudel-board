import { encodeGroups, decodeGroups, readCodeFromHash, groupsEqual, normalizeGroups, HASH_KEY } from './codec.js';
import { SHAPES, roundedPolygonPath, layoutNames } from './shapes.js';
import qrcode from '../vendor/qrcode.mjs';

// ---------- Speicher (nur lokal auf dem Gerät) ----------

const STORE_KEY = 'gnb:v1';

const EXAMPLE = [
  {
    name: 'Klasse 1a',
    kids: ['Anna', 'Ben', 'Can', 'Daria', 'Emil', 'Fatma', 'Greta', 'Hugo', 'Ida', 'Jonas', 'Lea', 'Mia'],
  },
  { name: 'Gruppe 2', kids: ['Noah', 'Ole', 'Paula', 'Quentin', 'Rosa', 'Sami'] },
];

function defaultState() {
  return {
    groups: EXAMPLE,
    current: EXAMPLE[0].name,
    star: {}, // Gruppenname -> Namen im Stern
    ampel: {}, // Gruppenname -> { Name: 'yellow' | 'orange' | 'red' } (fehlt = grün)
    settings: {
      mode: 'star', // 'star' oder 'ampel'
      animations: !matchMedia('(prefers-reduced-motion: reduce)').matches,
      shape: 'star',
      sidebarOpen: true,
    },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      const d = defaultState();
      return {
        groups: normalizeGroups(s.groups || []),
        current: s.current ?? null,
        star: s.star && typeof s.star === 'object' ? s.star : {},
        ampel: s.ampel && typeof s.ampel === 'object' ? s.ampel : {},
        settings: { ...d.settings, ...(s.settings || {}) },
        stored: true,
      };
    }
  } catch {
    /* privater Modus o. ä. */
  }
  return { ...defaultState(), stored: false };
}

function saveState() {
  try {
    const { groups, current, star, ampel, settings } = state;
    localStorage.setItem(STORE_KEY, JSON.stringify({ groups, current, star, ampel, settings }));
  } catch {
    /* ignorieren */
  }
}

const state = loadState();

// ---------- DOM ----------

const $ = (id) => document.getElementById(id);
const el = {
  shape: $('shape'),
  shapePath: $('shapePath'),
  shapeNames: $('shapeNames'),
  groupTabs: $('groupTabs'),
  kidList: $('kidList'),
  emptyHint: $('emptyHint'),
  groupTitle: $('groupTitle'),
  menu: $('menu'),
  menuBtn: $('menuBtn'),
  menuClose: $('menuClose'),
  menuBackdrop: $('menuBackdrop'),
  animToggle: $('animToggle'),
  editDialog: $('editDialog'),
  editGroupList: $('editGroupList'),
  editFields: $('editFields'),
  groupNameInput: $('groupNameInput'),
  kidsInput: $('kidsInput'),
  addGroupBtn: $('addGroupBtn'),
  deleteGroupBtn: $('deleteGroupBtn'),
  shareDialog: $('shareDialog'),
  qrBox: $('qrBox'),
  shareLink: $('shareLink'),
  copyLinkBtn: $('copyLinkBtn'),
  nativeShareBtn: $('nativeShareBtn'),
  importDialog: $('importDialog'),
  importText: $('importText'),
  clearBtn: $('clearBtn'),
  editBtn: $('editBtn'),
  toast: $('toast'),
  layout: document.querySelector('.layout'),
  sidebarToggle: $('sidebarToggle'),
  sidebarBody: $('sidebarBody'),
  ampel: $('ampel'),
  ampelTabs: $('ampelTabs'),
  ampelBoxes: $('ampelBoxes'),
  ampelResetBtn: $('ampelResetBtn'),
  menuClear: $('menuClear'),
};

// ---------- Hilfsfunktionen ----------

const currentGroup = () => state.groups.find((g) => g.name === state.current) || null;
const starNames = () => {
  const g = currentGroup();
  if (!g) return [];
  const list = state.star[g.name] || [];
  // Nur Namen, die es in der Gruppe noch gibt
  return list.filter((n) => g.kids.includes(n));
};
const animationsOn = () => state.settings.animations;
const isAmpel = () => state.settings.mode === 'ampel';

let toastTimer;
function toast(msg) {
  el.toast.textContent = msg;
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.toast.hidden = true), 2200);
}

const measureCtx = document.createElement('canvas').getContext('2d');
function measure(name) {
  measureCtx.font = `700 100px ${getComputedStyle(document.body).fontFamily}`;
  // Breite bei Schriftgröße 1 plus etwas Innenabstand
  return measureCtx.measureText(name).width / 100 + 0.24;
}

// ---------- URL (Hash) aktuell halten ----------

let hashWrite = Promise.resolve();
function updateHash() {
  hashWrite = hashWrite.then(async () => {
    const code = await encodeGroups(state.groups);
    const url = new URL(location.href);
    url.hash = `${HASH_KEY}=${code}`;
    history.replaceState(null, '', url);
  });
  return hashWrite;
}

async function shareUrl() {
  await updateHash();
  return location.href;
}

// ---------- Rendern ----------

function renderShape() {
  const shape = SHAPES[state.settings.shape] || SHAPES.star;
  el.shapePath.setAttribute('d', roundedPolygonPath(shape.polygon, 3.2));
}

function renderTabs() {
  const tabs = () =>
    state.groups.map((g) => {
      const b = document.createElement('button');
      b.className = 'group-tab';
      b.type = 'button';
      b.role = 'tab';
      b.textContent = g.name;
      b.setAttribute('aria-selected', String(g.name === state.current));
      b.addEventListener('click', () => selectGroup(g.name));
      return b;
    });
  // Die Gruppen-Knöpfe stehen je nach Ansicht rechts (Stern) oder oben (Ampel)
  el.groupTabs.replaceChildren(...(isAmpel() ? [] : tabs()));
  el.ampelTabs.replaceChildren(...(isAmpel() ? tabs() : []));
  const g = currentGroup();
  el.groupTitle.textContent = g ? g.name : '';
}

function renderList() {
  const g = currentGroup();
  const inStar = new Set(starNames());
  el.kidList.replaceChildren(
    ...(g ? g.kids : []).map((name) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'kid-btn' + (inStar.has(name) ? ' in-star' : '');
      b.dataset.name = name;
      b.setAttribute('aria-pressed', String(inStar.has(name)));
      const label = document.createElement('span');
      label.textContent = name;
      const mark = document.createElement('span');
      mark.className = 'mark';
      mark.textContent = '★';
      mark.setAttribute('aria-hidden', 'true');
      b.append(label, mark);
      b.addEventListener('click', () => toggleKid(name, b));
      li.append(b);
      return li;
    }),
  );
  if (!state.groups.length) {
    el.emptyHint.hidden = false;
    el.emptyHint.textContent = 'Noch keine Gruppe angelegt. Tippe auf „Gruppen bearbeiten“.';
  } else if (g && !g.kids.length) {
    el.emptyHint.hidden = false;
    el.emptyHint.textContent = 'In dieser Gruppe sind noch keine Kinder. Tippe auf „Gruppen bearbeiten“.';
  } else {
    el.emptyHint.hidden = true;
  }
}

/** Ordnet die Namen im Stern an. Gibt die DOM-Elemente nach Namen zurück. */
function renderStar({ arriving } = {}) {
  const shape = SHAPES[state.settings.shape] || SHAPES.star;
  const names = starNames();
  const { fontSize, items } = layoutNames(shape, names, measure);
  const px = el.shape.clientWidth / 100;
  const existing = new Map(
    [...el.shapeNames.children].filter((c) => !c.classList.contains('leaving')).map((c) => [c.dataset.name, c]),
  );
  const result = new Map();
  for (const it of items) {
    let node = existing.get(it.name);
    if (!node) {
      node = document.createElement('button');
      node.type = 'button';
      node.className = 'star-name';
      node.dataset.name = it.name;
      node.textContent = it.name;
      node.title = `${it.name} aus dem Stern nehmen`;
      node.addEventListener('click', () => removeFromStar(it.name));
      // neue Namen ohne Übergang an ihren Platz setzen
      node.style.transition = 'none';
      el.shapeNames.append(node);
    }
    existing.delete(it.name);
    node.style.left = `${it.x}%`;
    node.style.top = `${it.y}%`;
    node.style.fontSize = `${fontSize * px}px`;
    node.classList.toggle('arrive', inFlight.has(it.name) || it.name === arriving);
    result.set(it.name, node);
  }
  for (const node of existing.values()) node.remove();
  // Übergänge nach dem ersten Platzieren wieder erlauben
  requestAnimationFrame(() => {
    for (const node of result.values()) node.style.transition = '';
  });
  return { nodes: result, fontPx: fontSize * px };
}

function renderMode() {
  const ampel = isAmpel();
  document.body.classList.toggle('mode-ampel', ampel);
  el.ampel.hidden = !ampel;
  for (const b of el.menu.querySelectorAll('[data-mode]')) {
    b.setAttribute('aria-pressed', String(b.dataset.mode === state.settings.mode));
  }
  el.menuClear.textContent = ampel ? 'Alle auf Grün' : 'Stern leeren';
}

function renderAll() {
  renderMode();
  renderShape();
  renderTabs();
  renderList();
  renderStar();
  renderAmpel();
  el.animToggle.checked = animationsOn();
  document.documentElement.classList.toggle('no-anim', !animationsOn());
}

// ---------- Aktionen ----------

function selectGroup(name) {
  state.current = name;
  ampelSelected = null;
  saveState();
  renderTabs();
  renderList();
  renderStar();
  renderAmpel();
}

function setMode(mode) {
  state.settings.mode = mode === 'ampel' ? 'ampel' : 'star';
  ampelSelected = null;
  saveState();
  renderMode();
  renderTabs();
  renderAmpel();
  renderStar();
}

function toggleKid(name, sourceBtn) {
  if (starNames().includes(name)) removeFromStar(name);
  else addToStar(name, sourceBtn);
}

function addToStar(name, sourceBtn) {
  const g = currentGroup();
  if (!g) return;
  // Startpunkt merken, bevor die Liste neu gezeichnet wird
  const label = sourceBtn?.querySelector('span') || sourceBtn;
  const source = label && {
    rect: label.getBoundingClientRect(),
    font: parseFloat(getComputedStyle(label).fontSize) || 24,
  };
  state.star[g.name] = [...starNames(), name];
  saveState();
  renderList();
  const fly = animationsOn() && source && source.rect.width > 0;
  const { nodes, fontPx } = renderStar({ arriving: fly ? name : null });
  const target = nodes.get(name);
  if (fly && target) flyIn(name, source, target, fontPx);
  else bumpStar();
}

function removeFromStar(name) {
  const g = currentGroup();
  if (!g) return;
  const node = el.shapeNames.querySelector(`[data-name="${CSS.escape(name)}"]`);
  state.star[g.name] = starNames().filter((n) => n !== name);
  saveState();
  renderList();
  if (node && animationsOn()) {
    // kurz ausblenden, dann neu anordnen
    node.classList.add('leaving');
    node.animate(
      [
        { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
        { opacity: 0, transform: 'translate(-50%, -50%) scale(0.4)' },
      ],
      { duration: 220, easing: 'ease-in' },
    ).onfinish = () => node.remove();
  }
  renderStar();
}

function clearStar() {
  const g = currentGroup();
  if (!g) return;
  state.star[g.name] = [];
  saveState();
  renderList();
  renderStar();
}

// ---------- Ampel ----------

const AMPEL = [
  { color: 'green', label: 'Grün' },
  { color: 'yellow', label: 'Gelb' },
  { color: 'orange', label: 'Orange' },
  { color: 'red', label: 'Rot' },
];
let ampelSelected = null; // angetippter Name, der gleich verschoben wird

function ampelMap() {
  const g = currentGroup();
  if (!g) return {};
  const map = state.ampel[g.name] || {};
  // nur Namen, die es noch gibt, und nur gültige Farben
  const clean = {};
  for (const [name, color] of Object.entries(map)) {
    if (g.kids.includes(name) && AMPEL.some((a) => a.color === color && color !== 'green')) clean[name] = color;
  }
  return clean;
}

/** Namen je Farbe. Grün behält die Reihenfolge der Gruppe, die anderen die Reihenfolge des Hineinlegens. */
function ampelColumns() {
  const g = currentGroup();
  const map = ampelMap();
  const cols = { green: [], yellow: [], orange: [], red: [] };
  for (const name of g ? g.kids : []) if (!map[name]) cols.green.push(name);
  for (const [name, color] of Object.entries(map)) cols[color].push(name);
  return cols;
}

function renderAmpel() {
  if (!isAmpel()) {
    el.ampelBoxes.replaceChildren();
    return new Map();
  }
  const cols = ampelColumns();
  const nodes = new Map();
  el.ampelBoxes.classList.toggle('choosing', !!ampelSelected);
  el.ampelBoxes.replaceChildren(
    ...AMPEL.map(({ color, label }) => {
      const box = document.createElement('div');
      box.className = `ampel-box ampel-${color}`;
      box.dataset.color = color;
      box.setAttribute('role', 'button');
      box.setAttribute('aria-label', `${label}: hierher verschieben`);
      box.addEventListener('click', () => moveSelectedTo(color));
      const list = document.createElement('div');
      list.className = 'ampel-names';
      for (const name of cols[color]) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'ampel-name' + (name === ampelSelected ? ' selected' : '');
        b.dataset.name = name;
        b.textContent = name;
        b.setAttribute('aria-pressed', String(name === ampelSelected));
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          tapAmpelName(name, color);
        });
        list.append(b);
        nodes.set(name, b);
      }
      box.append(list);
      return box;
    }),
  );
  if (!state.groups.length || !currentGroup()?.kids.length) {
    const hint = document.createElement('p');
    hint.className = 'empty-hint';
    hint.textContent = 'Noch keine Kinder da. Im Menü auf „Gruppen bearbeiten“ tippen.';
    el.ampelBoxes.firstChild.firstChild.append(hint);
  }
  return nodes;
}

function tapAmpelName(name, color) {
  if (ampelSelected === name) {
    ampelSelected = null; // nochmal antippen: abwählen
  } else if (ampelSelected && ampelColor(ampelSelected) !== color) {
    moveSelectedTo(color); // Name in einem anderen Kasten angetippt: dorthin verschieben
    return;
  } else {
    ampelSelected = name;
  }
  renderAmpel();
}

const ampelColor = (name) => ampelMap()[name] || 'green';

function moveSelectedTo(color) {
  const g = currentGroup();
  const name = ampelSelected;
  if (!g || !name) return;
  ampelSelected = null;
  if (ampelColor(name) === color) {
    renderAmpel();
    return;
  }
  const oldNode = el.ampelBoxes.querySelector(`.ampel-name[data-name="${CSS.escape(name)}"]`);
  const from = oldNode?.getBoundingClientRect();
  const map = ampelMap();
  delete map[name]; // neu einfügen, damit der Name hinten ankommt
  if (color !== 'green') map[name] = color;
  state.ampel[g.name] = map;
  saveState();
  const nodes = renderAmpel();
  const node = nodes.get(name);
  if (node && from && animationsOn()) {
    const to = node.getBoundingClientRect();
    node.animate(
      [
        { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(1.15)` },
        { transform: 'translate(0, 0) scale(1)' },
      ],
      { duration: 450, easing: 'cubic-bezier(.3,.7,.3,1)' },
    );
  }
}

function resetAmpel() {
  const g = currentGroup();
  if (!g) return;
  state.ampel[g.name] = {};
  ampelSelected = null;
  saveState();
  renderAmpel();
}

// ---------- Animationen ----------

const inFlight = new Set();

function flyIn(name, source, target, targetFontPx) {
  const from = source.rect;
  const srcFont = source.font;

  const flyer = document.createElement('div');
  flyer.className = 'flyer';
  flyer.textContent = name;
  flyer.style.fontSize = `${srcFont}px`;
  document.body.append(flyer);
  const fr = flyer.getBoundingClientRect();
  const to = target.getBoundingClientRect();

  const x0 = from.left + from.width / 2 - fr.width / 2;
  const y0 = from.top + from.height / 2 - fr.height / 2;
  const x1 = to.left + to.width / 2 - fr.width / 2;
  const y1 = to.top + to.height / 2 - fr.height / 2;
  const s1 = targetFontPx / srcFont;
  // Bogen nach oben
  const lift = Math.min(220, Math.abs(x1 - x0) * 0.35 + 80);
  const pt = (t) => {
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t - Math.sin(Math.PI * t) * lift;
    const s = 1 + (Math.max(s1, 1.4) - 1) * Math.sin(Math.PI * t) * 0.9 + (s1 - 1) * t * t;
    const r = -12 * Math.sin(Math.PI * t * 2) + 360 * t * t;
    const f = (n) => n.toFixed(3);
    return `translate(${f(x)}px, ${f(y)}px) scale(${f(s)}) rotate(${f(r)}deg)`;
  };
  const frames = [];
  const steps = 14;
  for (let i = 0; i <= steps; i++) frames.push({ transform: pt(i / steps), offset: i / steps });
  frames[steps].transform = `translate(${x1}px, ${y1}px) scale(${s1}) rotate(360deg)`;

  inFlight.add(name);
  const anim = flyer.animate(frames, { duration: 900, easing: 'cubic-bezier(.45,.05,.35,1)' });
  const done = () => {
    flyer.remove();
    inFlight.delete(name);
    if (target.isConnected) {
      target.classList.remove('arrive');
      target.classList.remove('pop');
      void target.offsetWidth;
      target.classList.add('pop');
      const r = target.getBoundingClientRect();
      sparkle(r.left + r.width / 2, r.top + r.height / 2);
    }
    bumpStar();
  };
  anim.onfinish = done;
  anim.oncancel = done;
}

function sparkle(cx, cy) {
  const chars = ['★', '✦', '✧', '★', '✦', '★', '✧', '✦'];
  chars.forEach((ch, i) => {
    const s = document.createElement('span');
    s.className = 'sparkle';
    s.textContent = ch;
    document.body.append(s);
    const a = (i / chars.length) * Math.PI * 2 + Math.random() * 0.5;
    const d = 50 + Math.random() * 40;
    s.animate(
      [
        { transform: `translate(${cx - 10}px, ${cy - 10}px) scale(0.4)`, opacity: 1 },
        {
          transform: `translate(${(cx - 10 + Math.cos(a) * d).toFixed(2)}px, ${(cy - 10 + Math.sin(a) * d).toFixed(2)}px) scale(1) rotate(90deg)`,
          opacity: 0,
        },
      ],
      { duration: 650 + Math.random() * 200, easing: 'cubic-bezier(.2,.8,.3,1)' },
    ).onfinish = () => s.remove();
  });
}

function bumpStar() {
  if (!animationsOn()) return;
  el.shape.classList.remove('bump');
  void el.shape.offsetWidth;
  el.shape.classList.add('bump');
}

// ---------- Menü ----------

function openMenu() {
  el.menu.hidden = false;
  el.menuBackdrop.hidden = false;
  el.menuBtn.setAttribute('aria-expanded', 'true');
  el.menuClose.focus();
}
function closeMenu() {
  el.menu.hidden = true;
  el.menuBackdrop.hidden = true;
  el.menuBtn.setAttribute('aria-expanded', 'false');
}

el.menuBtn.addEventListener('click', openMenu);
el.menuClose.addEventListener('click', closeMenu);
el.menuBackdrop.addEventListener('click', closeMenu);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !el.menu.hidden) closeMenu();
  else if (e.key === 'Escape' && ampelSelected) {
    ampelSelected = null;
    renderAmpel();
  }
});
el.menu.addEventListener('click', (e) => {
  const mode = e.target.closest('[data-mode]')?.dataset.mode;
  if (mode) {
    setMode(mode);
    closeMenu();
    return;
  }
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  closeMenu();
  if (action === 'edit') openEditor();
  if (action === 'share') openShare();
  if (action === 'clear') (isAmpel() ? resetAmpel : clearStar)();
});
el.animToggle.addEventListener('change', () => {
  state.settings.animations = el.animToggle.checked;
  saveState();
  document.documentElement.classList.toggle('no-anim', !animationsOn());
});
el.clearBtn.addEventListener('click', clearStar);

// ---------- Namensleiste ein- und ausklappen ----------

function applySidebar() {
  const open = state.settings.sidebarOpen !== false;
  el.layout.classList.toggle('sidebar-closed', !open);
  el.sidebarBody.hidden = !open;
  el.sidebarToggle.setAttribute('aria-expanded', String(open));
  const label = open ? 'Namen einklappen' : 'Namen aufklappen';
  el.sidebarToggle.setAttribute('aria-label', label);
  el.sidebarToggle.title = label;
}
el.sidebarToggle.addEventListener('click', () => {
  state.settings.sidebarOpen = state.settings.sidebarOpen === false;
  applySidebar();
  saveState();
});
applySidebar();
el.ampelResetBtn.addEventListener('click', resetAmpel);
el.editBtn.addEventListener('click', openEditor);

// ---------- Gruppen bearbeiten ----------

// Im Editor arbeiten wir mit eigenen Objekten, damit Umbenennen sauber klappt.
let draft = [];
let draftIndex = 0;

function openEditor() {
  draft = state.groups.map((g) => ({ name: g.name, kids: g.kids.join('\n'), orig: g.name }));
  draftIndex = Math.max(0, draft.findIndex((g) => g.orig === state.current));
  if (!draft.length) addDraftGroup();
  renderEditor();
  el.editDialog.showModal();
}

function addDraftGroup() {
  let n = draft.length + 1;
  while (draft.some((g) => g.name === `Gruppe ${n}`)) n++;
  draft.push({ name: `Gruppe ${n}`, kids: '', orig: null });
  draftIndex = draft.length - 1;
}

function renderEditor() {
  el.editGroupList.replaceChildren(
    ...draft.map((g, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'group-tab';
      b.role = 'option';
      b.textContent = g.name.trim() || 'Ohne Namen';
      b.setAttribute('aria-selected', String(i === draftIndex));
      b.addEventListener('click', () => {
        draftIndex = i;
        renderEditor();
      });
      return b;
    }),
  );
  const g = draft[draftIndex];
  el.editFields.hidden = !g;
  if (g) {
    el.groupNameInput.value = g.name;
    el.kidsInput.value = g.kids;
  }
}

el.groupNameInput.addEventListener('input', () => {
  const g = draft[draftIndex];
  if (!g) return;
  g.name = el.groupNameInput.value;
  el.editGroupList.children[draftIndex].textContent = g.name.trim() || 'Ohne Namen';
  commitDraft();
});
el.kidsInput.addEventListener('input', () => {
  const g = draft[draftIndex];
  if (!g) return;
  g.kids = el.kidsInput.value;
  commitDraft();
});
el.addGroupBtn.addEventListener('click', () => {
  addDraftGroup();
  renderEditor();
  commitDraft();
  el.groupNameInput.focus();
  el.groupNameInput.select();
});
el.deleteGroupBtn.addEventListener('click', () => {
  const g = draft[draftIndex];
  if (!g) return;
  if (!confirm(`Gruppe „${g.name}“ wirklich löschen?`)) return;
  draft.splice(draftIndex, 1);
  draftIndex = Math.max(0, draftIndex - 1);
  renderEditor();
  commitDraft();
});
el.editDialog.addEventListener('close', () => {
  commitDraft();
});

/** Übernimmt den Entwurf sofort in den Zustand (live speichern). */
function commitDraft() {
  const groups = normalizeGroups(draft.map((g) => ({ name: g.name, kids: g.kids.split('\n') })));
  // Sternzustand bei Umbenennung mitnehmen
  const star = {};
  const ampel = {};
  draft.forEach((g, i) => {
    const newName = groups[i].name;
    if (g.orig && state.star[g.orig]) star[newName] = state.star[g.orig];
    if (g.orig && state.ampel[g.orig]) ampel[newName] = state.ampel[g.orig];
    g.orig = newName;
  });
  const currentIdx = draftIndex;
  state.groups = groups;
  state.star = star;
  state.ampel = ampel;
  state.current = groups[currentIdx]?.name ?? groups[0]?.name ?? null;
  saveState();
  updateHash();
  renderTabs();
  renderList();
  renderStar();
  renderAmpel();
}

// ---------- Teilen ----------

async function openShare() {
  const url = await shareUrl();
  el.shareLink.value = url;
  el.qrBox.replaceChildren();
  try {
    const qr = qrcode(0, 'L');
    qr.addData(url, 'Byte');
    qr.make();
    el.qrBox.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
    el.qrBox.querySelector('svg')?.setAttribute('role', 'img');
    el.qrBox.querySelector('svg')?.setAttribute('aria-label', 'QR-Code mit dem Link');
  } catch {
    const p = document.createElement('p');
    p.textContent = 'Zu viele Namen für einen QR-Code. Bitte den Link kopieren.';
    el.qrBox.append(p);
  }
  el.nativeShareBtn.hidden = !navigator.share;
  el.shareDialog.showModal();
}

el.copyLinkBtn.addEventListener('click', async () => {
  const url = el.shareLink.value;
  try {
    await navigator.clipboard.writeText(url);
    toast('Link kopiert');
  } catch {
    el.shareLink.select();
    document.execCommand?.('copy');
    toast('Link markiert. Jetzt kopieren.');
  }
});
el.nativeShareBtn.addEventListener('click', () => {
  navigator.share({ title: 'Gute-Nudel-Board', url: el.shareLink.value }).catch(() => {});
});

// ---------- Link beim Start übernehmen ----------

function ask(dialog) {
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue), { once: true });
    dialog.showModal();
  });
}

async function importFromHash() {
  const code = readCodeFromHash(location.hash);
  if (!code) return;
  let groups;
  try {
    groups = await decodeGroups(code);
  } catch (err) {
    toast(err.message || 'Der Link konnte nicht gelesen werden.');
    return;
  }
  if (groupsEqual(groups, state.groups)) return;
  let take = true;
  if (state.stored && state.groups.length) {
    const kids = groups.reduce((n, g) => n + g.kids.length, 0);
    el.importText.textContent =
      `Der Link enthält ${groups.length} ${groups.length === 1 ? 'Gruppe' : 'Gruppen'} mit ${kids} Kindern ` +
      `(${groups.map((g) => g.name).join(', ')}). Deine bisherigen Gruppen auf diesem Gerät werden dabei ersetzt.`;
    take = (await ask(el.importDialog)) === 'import';
  }
  if (take) {
    const star = {};
    const ampel = {};
    for (const g of groups) {
      if (state.star[g.name]) star[g.name] = state.star[g.name];
      if (state.ampel[g.name]) ampel[g.name] = state.ampel[g.name];
    }
    state.groups = groups;
    state.star = star;
    state.ampel = ampel;
    if (!groups.some((g) => g.name === state.current)) state.current = groups[0]?.name ?? null;
    saveState();
    toast('Gruppen übernommen');
  }
}

// ---------- Start ----------

async function start() {
  await importFromHash();
  if (!state.groups.some((g) => g.name === state.current)) state.current = state.groups[0]?.name ?? null;
  saveState();
  renderAll();
  updateHash();
  // Nach dem Laden der Schrift neu messen
  document.fonts?.ready.then(() => renderStar());
  let rt;
  new ResizeObserver(() => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      if (!isAmpel()) renderStar();
    }, 60);
  }).observe(el.shape);
}

window.addEventListener('hashchange', async () => {
  await importFromHash();
  renderAll();
});

start();

// ---------- Offline (Service Worker) ----------

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
