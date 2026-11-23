// Testet die echte Seite im Browser (Chromium über Playwright).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startServer } from '../scripts/serve.mjs';

let server, browser, base;

before(async () => {
  server = await startServer(0);
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  server?.close();
});

async function freshPage(url = base) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e));
  await page.goto(url);
  await page.waitForSelector('.kid-btn');
  return { context, page, errors };
}

const starNames = (page) => page.$$eval('.star-name:not(.leaving)', (n) => n.map((x) => x.textContent));

test('Name antippen fliegt in den Stern und bleibt nach Neuladen', async () => {
  const { context, page, errors } = await freshPage();
  await page.click('.kid-btn[data-name="Anna"]');
  await page.click('.kid-btn[data-name="Ben"]');
  await page.waitForTimeout(1100);
  assert.deepEqual(await starNames(page), ['Anna', 'Ben']);
  assert.equal(await page.locator('.kid-btn.in-star').count(), 2);
  assert.equal(await page.locator('.flyer').count(), 0);

  await page.reload();
  await page.waitForSelector('.star-name');
  assert.deepEqual(await starNames(page), ['Anna', 'Ben']);

  // erneut antippen nimmt den Namen wieder heraus
  await page.click('.kid-btn[data-name="Anna"]');
  await page.waitForTimeout(400);
  assert.deepEqual(await starNames(page), ['Ben']);
  assert.deepEqual(errors, []);
  await context.close();
});

test('Gruppen wechseln zeigt nur deren Kinder', async () => {
  const { context, page } = await freshPage();
  await page.click('.group-tab:has-text("Gruppe 2")');
  const names = await page.$$eval('.kid-btn', (n) => n.map((x) => x.dataset.name));
  assert.deepEqual(names, ['Noah', 'Ole', 'Paula', 'Quentin', 'Rosa', 'Sami']);
  await context.close();
});

test('Gruppen bearbeiten, Link teilen und auf anderem Gerät öffnen', async () => {
  const { context, page } = await freshPage();
  await page.click('#editBtn');
  await page.click('#addGroupBtn');
  await page.fill('#groupNameInput', 'Klasse 3b');
  await page.fill('#kidsInput', 'Zoë\nÇelik\nŁukasz');
  await page.click('#editDialog button[value="done"]');
  assert.equal(await page.textContent('#groupTitle'), 'Klasse 3b');
  assert.deepEqual(await page.$$eval('.kid-btn', (n) => n.map((x) => x.dataset.name)), ['Zoë', 'Çelik', 'Łukasz']);

  await page.click('#menuBtn');
  await page.click('[data-action="share"]');
  await page.waitForSelector('#qrBox svg');
  const link = await page.inputValue('#shareLink');
  assert.match(link, /#g=1z/);
  await context.close();

  // "anderes Gerät": neuer Kontext ohne gespeicherte Daten
  const other = await freshPage(link);
  const tabs = await other.page.$$eval('.group-tab', (n) => n.map((x) => x.textContent));
  assert.deepEqual(tabs, ['Klasse 1a', 'Gruppe 2', 'Klasse 3b']);
  await other.context.close();
});

test('Viele Kinder passen alle in den Stern', async () => {
  const { context, page } = await freshPage();
  await page.click('#editBtn');
  await page.click('#addGroupBtn');
  const kids = Array.from({ length: 30 }, (_, i) => `Kind ${i + 1}`);
  await page.fill('#kidsInput', kids.join('\n'));
  await page.click('#editDialog button[value="done"]');
  await page.click('#menuBtn');
  await page.click('#animToggle + .switch');
  await page.click('#menuClose');
  for (const k of kids) await page.click(`.kid-btn[data-name="${k}"]`);
  assert.equal((await starNames(page)).length, 30);
  // alle Namen liegen innerhalb der Sternfläche
  const box = await page.locator('#shape').boundingBox();
  const rects = await page.$$eval('.star-name', (n) => n.map((x) => x.getBoundingClientRect().toJSON()));
  for (const r of rects) {
    assert.ok(r.left >= box.x && r.right <= box.x + box.width, 'Name ragt seitlich heraus');
  }
  await context.close();
});

test('Seite funktioniert offline', async () => {
  const { context, page } = await freshPage();
  await page.evaluate(() => navigator.serviceWorker.ready);
  // warten, bis der Service Worker die Seite kontrolliert
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector('.kid-btn');
  const font = await page.evaluate(async () => {
    await document.fonts.ready;
    return document.fonts.check('700 20px ABeeZee');
  });
  assert.ok(font, 'Schrift offline geladen');
  await context.close();
});

test('Namensleiste lässt sich ein- und aufklappen und bleibt so', async () => {
  const { context, page, errors } = await freshPage();
  const starWidth = () => page.$eval('.stage', (n) => n.clientWidth);
  const before = await starWidth();
  await page.click('#sidebarToggle');
  assert.equal(await page.isVisible('.kid-btn'), false);
  await page.waitForFunction((w) => document.querySelector('.stage').clientWidth > w, before);
  await page.reload();
  await page.waitForSelector('#sidebarToggle');
  assert.equal(await page.isVisible('.kid-btn'), false);
  await page.click('#sidebarToggle');
  assert.equal(await page.isVisible('.kid-btn'), true);
  assert.deepEqual(errors, []);
  await context.close();
});

test('Ampel: Name antippen, dann Farbe antippen verschiebt ihn', async () => {
  const { context, page, errors } = await freshPage();
  const inBox = (color) =>
    page.$$eval(`.ampel-${color} .ampel-name`, (n) => n.map((x) => x.dataset.name));

  await page.click('#menuBtn');
  await page.click('[data-mode="ampel"]');
  assert.ok(await page.isVisible('#ampel'));
  assert.ok(!(await page.isVisible('#shape')));
  assert.equal((await inBox('green')).length, 12);

  // Anna nach Gelb
  await page.click('.ampel-name[data-name="Anna"]');
  assert.equal(await page.locator('.ampel-name.selected').count(), 1);
  await page.click('.ampel-yellow');
  assert.deepEqual(await inBox('yellow'), ['Anna']);
  assert.ok(!(await inBox('green')).includes('Anna'));
  assert.equal(await page.locator('.ampel-name.selected').count(), 0);

  // Ben nach Rot, dann Anna nach Rot (durch Antippen eines Namens im roten Kasten)
  await page.click('.ampel-name[data-name="Ben"]');
  await page.click('.ampel-red');
  await page.click('.ampel-name[data-name="Anna"]');
  await page.click('.ampel-name[data-name="Ben"]');
  assert.deepEqual(await inBox('red'), ['Ben', 'Anna']);
  assert.deepEqual(await inBox('yellow'), []);

  // nochmal antippen wählt ab
  await page.click('.ampel-name[data-name="Can"]');
  await page.click('.ampel-name[data-name="Can"]');
  assert.equal(await page.locator('.ampel-name.selected').count(), 0);

  // bleibt nach Neuladen, inklusive Ansicht
  await page.reload();
  await page.waitForSelector('.ampel-name');
  assert.deepEqual(await inBox('red'), ['Ben', 'Anna']);

  // zurück nach Grün in alter Reihenfolge
  await page.click('.ampel-name[data-name="Anna"]');
  await page.click('.ampel-green');
  assert.deepEqual((await inBox('green')).slice(0, 2), ['Anna', 'Can']);

  await page.click('#ampelResetBtn');
  assert.equal((await inBox('green')).length, 12);

  // zurück zum Stern
  await page.click('#menuBtn');
  await page.click('[data-mode="star"]');
  assert.ok(await page.isVisible('#shape'));
  assert.ok(!(await page.isVisible('#ampel')));
  assert.deepEqual(errors, []);
  await context.close();
});

test('Ampel: viele Namen passen ohne Scrollen, auch im halben Fenster', async () => {
  const kids = Array.from({ length: 32 }, (_, i) => `Maximilian ${i + 1}`);
  const context = await browser.newContext({ viewport: { width: 960, height: 1080 } });
  const page = await context.newPage();
  await page.goto(base);
  await page.waitForSelector('.kid-btn');
  await page.evaluate((kids) => {
    localStorage.setItem(
      'gnb:v1',
      JSON.stringify({ groups: [{ name: '4a', kids }], current: '4a', settings: { mode: 'ampel', animations: false } }),
    );
  }, kids);
  await page.goto(`${base}?neu`);
  await page.waitForSelector('.ampel-name');
  const fits = () =>
    page.$$eval('.ampel-box', (boxes) =>
      boxes.every((b) => [...b.querySelectorAll('.ampel-name')].every((n) => n.offsetTop + n.offsetHeight <= b.clientHeight)),
    );
  const fontPx = () => page.$eval('.ampel-name', (n) => parseFloat(getComputedStyle(n).fontSize));
  assert.ok(await fits(), 'Namen ragen aus dem grünen Kasten');
  assert.ok((await fontPx()) < 27, 'Schrift wurde verkleinert');
  // im großen Fenster wieder volle Größe
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForFunction(() => parseFloat(getComputedStyle(document.querySelector('.ampel-name')).fontSize) === 27);
  assert.ok(await fits());
  await context.close();
});
