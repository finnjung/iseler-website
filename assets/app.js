// Teile-Anfrage: Fahrzeugschein-Formular baut eine vorausgefüllte E-Mail
(() => {
  const form = document.getElementById('anfrage');
  if (!form) return;
  const hint = form.querySelector('.schein-hint');
  const fin = form.elements.fin;
  const count = form.querySelector('.fin-count');

  fin.addEventListener('input', () => {
    fin.value = fin.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    count.textContent = `${fin.value.length} / 17`;
  });
  form.elements.hsn.addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, ''); });
  form.elements.tsn.addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const v = n => form.elements[n].value.trim();
    form.querySelectorAll('.feld').forEach(f => f.classList.remove('bad'));
    const hasCar = (v('hsn').length === 4 && v('tsn').length >= 3) || v('fin').length === 17;
    if (!hasCar || !v('teil')) {
      if (!hasCar) ['hsn', 'tsn', 'fin'].forEach(n => form.elements[n].closest('.feld').classList.add('bad'));
      if (!v('teil')) form.elements.teil.closest('.feld').classList.add('bad');
      hint.classList.remove('ok');
      hint.textContent = !hasCar
        ? 'Bitte HSN und TSN (Zeile 2.1 und 2.2) oder die vollständige 17-stellige FIN (Zeile E) eintragen.'
        : 'Bitte kurz beschreiben, welches Teil Sie brauchen.';
      return;
    }
    const lines = [
      'Hallo Team Iseler,', '', 'ich suche folgendes Teil:', v('teil'), '',
      `HSN (2.1): ${v('hsn') || '-'}`, `TSN (2.2): ${v('tsn') || '-'}`, `FIN (E): ${v('fin') || '-'}`, '',
      `Name: ${v('name') || '-'}`, `Rückruf: ${v('tel') || '-'}`
    ];
    const subject = `Teile-Anfrage: ${v('teil')}`;
    location.href = `mailto:info@iseler.de?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
    hint.classList.add('ok');
    hint.textContent = 'Ihr E-Mail-Programm öffnet sich mit der fertigen Anfrage. Nur noch auf Senden tippen.';
  });
})();

// Tourenplan: Live-Status der nächsten Werkstatt-Lieferung (Zeit in Europe/Berlin)
(() => {
  const status = document.getElementById('tour-status');
  if (!status) return;
  const clock = document.getElementById('tour-clock');
  const fill = document.getElementById('tour-fill');
  const mark = document.getElementById('tour-mark');
  const scale = document.querySelector('.tour-scale');
  const START = 7 * 60, END = 18 * 60;
  const pos = m => Math.min(100, Math.max(0, (m - START) / (END - START) * 100));

  scale.querySelectorAll('span').forEach(s => { s.style.left = pos(+s.textContent * 60) + '%'; });
  document.querySelectorAll('.tour-cut').forEach((c, i) => c.style.setProperty('--at', pos(i ? 12 * 60 + 30 : 8 * 60 + 45) + '%'));

  const fmt = n => String(n).padStart(2, '0');
  const left = mins => mins >= 60 ? `${Math.floor(mins / 60)} Std. ${mins % 60} Min.` : `${mins} Min.`;
  const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

  function tick() {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date()).map(p => [p.type, p.value]));
    const h = +parts.hour, m = +parts.minute;
    const wd = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'].indexOf(parts.weekday);
    const now = h * 60 + m;
    clock.textContent = `${fmt(h)}:${fmt(m)}`;
    const workday = wd >= 1 && wd <= 5;
    const nextDay = wd >= 5 || wd === 0 ? 'Montag' : 'morgen';

    let html;
    if (workday && now < 8 * 60 + 45) html = `Jetzt bestellen, <mark>heute Vormittag</mark> geliefert. Noch ${left(8 * 60 + 45 - now)}.`;
    else if (workday && now < 12 * 60 + 30) html = `Jetzt bestellen, <mark>heute Nachmittag</mark> geliefert. Noch ${left(12 * 60 + 30 - now)}.`;
    else html = `Heute sind beide Touren unterwegs. Nächste Lieferung <mark>${nextDay} Vormittag</mark>.`;
    if (!workday && wd !== -1) html = `${days[wd]}: keine Tour. Bestellungen gehen <mark>Montag Vormittag</mark> raus.`;
    status.innerHTML = html;

    const p = workday ? pos(now) : 0;
    fill.style.width = p + '%';
    mark.style.left = p + '%';
  }
  tick();
  setInterval(tick, 30000);
})();
