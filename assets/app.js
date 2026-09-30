// WhatsApp-Nummer des Iseler-Bots im internationalen Format ohne "+" und ohne Leerzeichen,
// z. B. '496104670700'. Solange sie leer ist, laufen die WhatsApp-Elemente im Vorschau-Modus:
// sichtbar, aber ein Klick erklärt nur, dass die Nummer noch folgt.
const WHATSAPP_NUMBER = '496104670700'; // ISY Hotline 06104 670700, laut QR-Code auf Iselers Karte

const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} }
};
const waLink = text => `https://wa.me/${WHATSAPP_NUMBER}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Design: dunkel als Standard, hell per Schalter
(() => {
  const root = document.documentElement;
  const btn = document.querySelector('[data-theme-toggle]');
  const meta = document.querySelector('meta[name="theme-color"]');
  const sync = () => {
    const dark = root.dataset.theme !== 'light';
    btn.setAttribute('aria-label', dark ? 'Helles Design einschalten' : 'Dunkles Design einschalten');
    meta.content = dark ? '#0a111e' : '#eef0f3';
  };
  btn.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
    store.set('iseler-theme', root.dataset.theme);
    sync();
  });
  sync();
})();

// WhatsApp-Button unten rechts
(() => {
  const box = document.querySelector('[data-wa]');
  const bubble = box.querySelector('.wa-bubble');
  if (!WHATSAPP_NUMBER) {
    bubble.querySelector('p').innerHTML = '<strong>Vorschau:</strong> Hier geht es bald direkt zum WhatsApp-Bot von Iseler. Die Nummer tragen wir noch ein.';
    document.querySelectorAll('a[data-wa-link]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); bubble.hidden = false; }));
    box.querySelector('.wa-close').addEventListener('click', () => { bubble.hidden = true; });
    setTimeout(() => box.classList.add('show'), reduceMotion ? 0 : 1200);
    return;
  }
  document.querySelectorAll('a[data-wa-link]').forEach(a => {
    a.href = waLink('Hallo ISY, ich suche ein Teil für mein Auto.');
    a.target = '_blank';
    a.rel = 'noopener';
  });
  const close = () => { bubble.hidden = true; store.set('iseler-wa-hint', '1'); };
  box.querySelector('.wa-close').addEventListener('click', close);
  box.querySelector('.wa-fab').addEventListener('click', close);
  setTimeout(() => box.classList.add('show'), reduceMotion ? 0 : 1200);
  if (!store.get('iseler-wa-hint')) {
    setTimeout(() => { bubble.hidden = false; }, 4500);
    setTimeout(() => { if (!bubble.hidden) bubble.hidden = true; }, 16000);
  }
})();

// Tourenplan: Status der nächsten Werkstatt-Lieferung, Zeit in Europe/Berlin
(() => {
  const status = document.getElementById('tour-status');
  const clock = document.getElementById('tour-clock');
  const mark = document.getElementById('tour-mark');
  const START = 7 * 60, END = 18 * 60, CUT1 = 8 * 60 + 45, CUT2 = 12 * 60 + 30;
  const pos = m => Math.min(100, Math.max(0, (m - START) / (END - START) * 100)) + '%';

  document.querySelectorAll('.tour-scale span').forEach(s => { s.style.left = pos(+s.textContent * 60); });
  document.querySelectorAll('.tour-cut').forEach(c => c.style.setProperty('--at', pos(+c.dataset.at)));

  const fmt = n => String(n).padStart(2, '0');
  const left = m => m >= 60 ? `${Math.floor(m / 60)} Std. ${m % 60} Min.` : `${m} Min.`;
  const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

  function tick() {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date()).map(x => [x.type, x.value]));
    const h = +p.hour, m = +p.minute, now = h * 60 + m;
    const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
    const workday = wd >= 1 && wd <= 5;
    clock.textContent = `${fmt(h)}:${fmt(m)}`;

    let html;
    if (!workday) html = `${days[wd]}: keine Tour. Bestellungen gehen <em>Montag Vormittag</em> raus.`;
    else if (now < CUT1) html = `Jetzt bestellen, <em>heute Vormittag</em> geliefert. Noch ${left(CUT1 - now)}.`;
    else if (now < CUT2) html = `Jetzt bestellen, <em>heute Nachmittag</em> geliefert. Noch ${left(CUT2 - now)}.`;
    else html = `Beide Touren sind unterwegs. Nächste Lieferung <em>${wd === 5 ? 'Montag' : 'morgen'} Vormittag</em>.`;
    status.innerHTML = html;
    mark.style.setProperty('--now', workday ? pos(now) : '0%');
  }
  tick();
  setInterval(tick, 30000);
})();
