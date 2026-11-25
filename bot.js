
(() => {
  if (window.__qw) { window.__qw.toggle(true); return; }
  const cal = document.querySelector('.day-queue-calendar-react');
  if (!cal || !cal.dataset.url) { alert('Слот-вочер: календарь слотов не найден'); return; }
  const API = cal.dataset.url;
  const token = () => document.querySelector('input[name=__RequestVerificationToken]')?.value || '';
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const isLaptop = innerWidth < 1400 || innerHeight < 800;
  const WIDTH = isLaptop ? 250 : 300;
  const FONT = isLaptop ? '11px' : '12px';

  const STEALTH = {
    minTypingDelay: 50, maxTypingDelay: 200, mouseMoveChance: 0.3,
    jitterPercent: 0.4, maxBurstRequests: 3, burstPauseMin: 2000,
    burstPauseMax: 5000, useReferer: true, simulateActivity: true,
  };

  const randomBetween = (min, max) => min + Math.random() * (max - min);
  const jitter = value => value * (1 + (Math.random() * 2 - 1) * STEALTH.jitterPercent);
  const humanDelay = () => randomBetween(STEALTH.minTypingDelay, STEALTH.maxTypingDelay);

  const getHeaders = () => {
    const headers = {
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      'X-Requested-With': 'XMLHttpRequest',
    };
    if (STEALTH.useReferer) headers['Referer'] = location.href;
    return headers;
  };

  const simulateMouseMove = () => {
    if (!STEALTH.simulateActivity || Math.random() > STEALTH.mouseMoveChance) return;
    try { document.dispatchEvent(new MouseEvent('mousemove', { clientX: Math.random() * innerWidth, clientY: Math.random() * innerHeight, bubbles: true })); } catch {}
  };
  const simulateClick = () => {
    if (!STEALTH.simulateActivity || Math.random() > 0.1) return;
    try { document.dispatchEvent(new MouseEvent('click', { clientX: Math.random() * innerWidth, clientY: Math.random() * innerHeight, bubbles: true })); } catch {}
  };

  const LS = 'qw_v5';
  const DEF = {
    cfg: { min: 20, max: 40, h1: 0, h2: 23, ahead: 5, sound: true, notify: true, tgToken: '', tgChat: '',
      autoClick: true, clickDelay: 300, confirmDelay: 1000, stealthMode: true, compactMode: isLaptop },
    dates: [], log: [], pos: null, tab: 'overview',
    stats: { freed: 0, missed: 0, autoBooked: 0, life: [], relHour: Array(24).fill(0), last: null, since: Date.now() },
  };
  let S; try { S = JSON.parse(localStorage.getItem(LS)); } catch {}
  S = Object.assign(structuredClone(DEF), S || {});
  S.cfg = Object.assign({}, DEF.cfg, S.cfg);
  S.stats = Object.assign(structuredClone(DEF.stats), S.stats);
  const persist = () => { try { S.log = S.log.slice(0, 300); localStorage.setItem(LS, JSON.stringify(S)); } catch {} };

  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const today = () => iso(new Date());
  const MON = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  const MONN = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  const WD = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
  const human = s => { const d = parse(s); return `${WD[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()].slice(0, 4)}`; };
  const fmt = s => `${human(s.date)} ${pad(s.hour)}:00`;
  const dur = ms => ms < 60e3 ? `${Math.round(ms / 1000)} с` : ms < 3600e3 ? `${Math.round(ms / 60e3)} мин` : `${(ms / 3600e3).toFixed(1)} ч`;
  const watched = () => { const t = today(), sel = S.dates.filter(d => d >= t).sort(); return sel.length ? sel : Array.from({ length: S.cfg.ahead }, (_, i) => addDays(t, i)); };
  const windows = dates => { const w = []; let end = ''; for (const d of dates) if (d > end) { w.push(d); end = addDays(d, 4); } return w; };

  let requestCount = 0;
  const stealthDelay = async () => {
    await sleep(randomBetween(800, 1500));
    requestCount++;
    if (requestCount >= STEALTH.maxBurstRequests) { await sleep(randomBetween(STEALTH.burstPauseMin, STEALTH.burstPauseMax)); requestCount = 0; }
    simulateMouseMove(); simulateClick();
  };

  const isFree = (h) => h.Available === true && !h.IsWaitlist && !h.Waitlist && !h.IsWaitingList;
  const isWaitlist = (h) => h.IsWaitlist || h.Waitlist || h.IsWaitingList;

  const fetchWindow = async from => {
    await stealthDelay();
    const q = new URLSearchParams({ DateFrom: from, DateTo: '', ViewType: 'Desktop', __RequestVerificationToken: token() });
    const r = await fetch(API + '?' + q, { credentials: 'include', cache: 'no-store', headers: getHeaders() });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    let j; try { j = await r.json(); } catch { throw new Error('сессия истекла'); }
    if (!j || !j.HourRows) throw new Error('неожиданный ответ');
    const out = [];
    j.HourRows.forEach(row => row.HourDates.forEach(h => {
      let st = 'taken';
      if (isFree(h)) st = 'free';
      else if (isWaitlist(h)) st = 'waitlist';
      else if (h.Blocked) st = 'na';
      out.push({ key: h.DateTime, date: h.DateTime.slice(0, 10), hour: +h.DateTime.slice(11, 13), st: st, isWaitlist: isWaitlist(h) });
    }));
    return out;
  };

  const findClickableElement = (slotEl) => {
    let el = slotEl;
    for (let i = 0; i < 5; i++) {
      if (!el) break;
      if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.onclick || el.getAttribute('role') === 'button') return el;
      const clickable = el.querySelector('button, a, [role="button"], [onclick]');
      if (clickable) return clickable;
      el = el.parentElement;
    }
    return slotEl;
  };
  const humanClick = (element) => {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width * randomBetween(0.3, 0.7);
    const y = rect.top + rect.height * randomBetween(0.3, 0.7);
    const mouseEvents = ['mousemove', 'mouseover', 'mousedown', 'mouseup', 'click'];
    mouseEvents.forEach((type, i) => setTimeout(() => element.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true, view: window })), i * humanDelay()));
    // Дополнительно вызываем .click() для надёжности
    setTimeout(() => { try { element.click(); } catch {} }, 5 * humanDelay());
  };

  const autoClickSlot = async (slot) => {
    if (!S.cfg.autoClick || slot.isWaitlist) return false;
    try {
      await goTo(slot.date, slot.hour);
      await sleep(S.cfg.clickDelay + randomBetween(100, 300));
      const cells = slotCells(), headers = getCalendarHeaders();
      if (cells.length > 0) {
        const idx = headers.findIndex(h => h === slot.date);
        if (idx >= 0) {
          const cellIdx = slot.hour * headers.length + idx;
          if (cellIdx < cells.length) {
            const target = cells[cellIdx];
            // Реально кликаем по слоту
            humanClick(target);
            console.log('🎯 Клик по слоту:', slot.date, slot.hour + ':00');
            document.querySelectorAll('.qw-hl').forEach(e => e.classList.remove('qw-hl'));
            target.classList.add('qw-hl');

            await sleep(S.cfg.confirmDelay + randomBetween(200, 500));

            // Нажимаем кнопку "Далее"
            const nextBtn = document.querySelector('#btnNext_formWizard');
            if (nextBtn && !nextBtn.disabled) {
              humanClick(nextBtn);
              console.log('✅ Нажата кнопка "Далее"');
              S.stats.autoBooked++; persist();
              return true;
            }
            // Запасной вариант: ищем кнопку по тексту
            const confirmBtns = document.querySelectorAll('button:not([disabled]), input[type=submit]:not([disabled])');
            for (const btn of confirmBtns) {
              const txt = (btn.value || btn.textContent || '').toLowerCase();
              if (txt.includes('далее') || txt.includes('подтвердить') || txt.includes('забронировать') || txt.includes('записаться') || txt.includes('сохранить')) {
                humanClick(btn);
                S.stats.autoBooked++; persist(); return true;
              }
            }
          }
        }
      }
      return false;
    } catch (e) { console.error('Ошибка клика:', e); return false; }
  };

  const slots = {};
  const days = {};
  let running = false, timer = null, nextAt = 0, busy = false, lastErr = '', lastCheck = null, checks = 0, note = '';
  const inHours = s => s.hour >= S.cfg.h1 && s.hour <= S.cfg.h2;
  const freeNow = () => watched().reduce((a, d) => a + (days[d]?.free || 0), 0);
  const addLog = (type, s, life) => S.log.unshift({ type, date: s.date, hour: s.hour, t: Date.now(), life });

  const check = async () => {
    if (busy) return; busy = true; render();
    const list = watched(), set = new Set(list), all = [];
    try {
      const ws = windows(list);
      for (let i = 0; i < ws.length; i++) { if (i) await sleep(randomBetween(1500, 3000)); all.push(...await fetchWindow(ws[i])); }
      lastErr = '';
    } catch (e) {
      lastErr = e.message; busy = false;
      if (/сессия/.test(e.message)) { stop(); alertUser('Слот-вочер остановлен', 'Сессия истекла'); }
      render(); schedule(); return;
    }
    checks++; lastCheck = Date.now();
    const now = Date.now(), released = [], initial = [];
    list.forEach(d => days[d] = { free: 0, taken: 0, na: 0, waitlist: 0 });
    for (const s of all) {
      if (!set.has(s.date)) continue;
      const ok = inHours(s);
      if (ok) days[s.date][s.st] = (days[s.date][s.st] || 0) + 1;
      const p = slots[s.key];
      if (s.st === 'free') {
        if (!p) { if (ok) initial.push(s); }
        else if (!p.free) { if (ok) released.push(s); }
        if (!p || !p.free) slots[s.key] = { free: true, since: now };
      } else {
        if (p && p.free && s.st === 'taken' && ok) { const life = now - p.since; S.stats.missed++; S.stats.life.push(life); S.stats.life = S.stats.life.slice(-200); addLog('miss', s, life); }
        slots[s.key] = { free: false };
      }
    }
    released.forEach(s => { S.stats.freed++; S.stats.relHour[new Date().getHours()]++; S.stats.last = now; addLog('free', s); });
    initial.forEach(s => addLog('now', s));
    if (released.length > 0 && S.cfg.autoClick) {
      const booked = await autoClickSlot(released[0]);
      if (booked) alertUser('Слот забронирован!', fmt(released[0]), released[0]);
      else alertUser('Слот освободился!', released.map(fmt).join(', '), released[0]);
    } else if (released.length) alertUser('Слот освободился!', released.map(fmt).join(', '), released[0]);
    else if (initial.length) alertUser('Есть свободные слоты', initial.map(fmt).join(', '), initial[0]);
    busy = false; persist(); render(); schedule();
  };

  const schedule = () => {
    clearTimeout(timer); if (!running) return;
    const baseSec = S.cfg.min + Math.random() * (S.cfg.max - S.cfg.min);
    const sec = S.cfg.stealthMode ? jitter(baseSec) : baseSec;
    nextAt = Date.now() + sec * 1000; timer = setTimeout(check, sec * 1000);
  };
  const start = () => { running = true; try { Notification.requestPermission(); } catch {} render(); check(); };
  const stop = () => { running = false; clearTimeout(timer); render(); };

  const origTitle = document.title; let blink = null;
  const beep = () => { try { const ctx = new AudioContext(); [0, .3, .6, 1.2, 1.5, 1.8].forEach(t => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = t < 1 ? 880 : 1175; g.gain.value = .25; o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + .2); }); } catch {} };
  const alertUser = (title, body, slot) => {
    if (S.cfg.sound) beep();
    if (S.cfg.notify) try { if (Notification.permission === 'granted') { const n = new Notification(title, { body, requireInteraction: true }); n.onclick = () => { focus(); if (slot) goTo(slot.date, slot.hour); n.close(); }; } } catch {}
    if (S.cfg.tgToken && S.cfg.tgChat) try { fetch(`https://api.telegram.org/bot${S.cfg.tgToken}/sendMessage?` + new URLSearchParams({ chat_id: S.cfg.tgChat, text: `${title}\n${body}` }), { mode: 'no-cors' }); } catch {}
    clearInterval(blink);
    blink = setInterval(() => document.title = document.title === origTitle ? '🔔 ' + title : origTitle, 800);
    const stopBlink = () => { clearInterval(blink); document.title = origTitle; };
    if (document.hasFocus()) setTimeout(stopBlink, 6000); else addEventListener('focus', stopBlink, { once: true });
    toggle(true);
  };

  const hlStyle = document.createElement('style');
  hlStyle.textContent = '.qw-hl{outline:3px solid #3ddc84!important;outline-offset:2px;animation:qwp 1s infinite}@keyframes qwp{50%{outline-color:transparent}}';
  document.head.appendChild(hlStyle);
  const getCalendarHeaders = () => {
    const leaves = [...cal.querySelectorAll('div,span')].filter(e => !e.children.length), out = [];
    for (let i = 0; i < leaves.length - 1; i++) {
      const n = leaves[i].textContent.trim(), m = MON.indexOf(leaves[i + 1].textContent.trim().toLowerCase());
      if (/^\d{1,2}$/.test(n) && m >= 0) { const t = new Date(); let y = t.getFullYear(); if (m < t.getMonth() - 6) y++; out.push(iso(new Date(y, m, +n))); }
    }
    return out;
  };
  const arrows = () => ({ prev: cal.querySelector('.dripicons-arrow-thin-left'), next: cal.querySelector('.dripicons-arrow-thin-right') });
  const slotCells = () => [...cal.querySelectorAll('.btn.d-block')].filter(e => !/dripicons-arrow/.test(e.className));
  const waitChange = async before => { for (let i = 0; i < 30; i++) { await sleep(randomBetween(100, 200)); const h = getCalendarHeaders(); if (h.length && h[0] !== before) return h; } return getCalendarHeaders(); };
  const goTo = async (date, hour) => {
    note = 'Перехожу к ' + human(date) + '…'; render();
    let refreshed = false;
    for (let i = 0; i < 90; i++) {
      const h = getCalendarHeaders(); if (!h.length) break;
      const { prev, next } = arrows(); if (!prev || !next) break;
      if (h[0] === date) {
        if (!refreshed) { next.click(); await waitChange(h[0]); prev.click(); await waitChange(addDays(date, 1)); refreshed = true; continue; }
        await sleep(randomBetween(200, 400));
        document.querySelectorAll('.qw-hl').forEach(e => e.classList.remove('qw-hl'));
        const cells = slotCells();
        const cell = hour != null && cells.length === 24 * h.length ? cells[hour * h.length] : null;
        (cell || cal).scrollIntoView({ block: 'center', behavior: 'smooth' });
        if (cell) cell.classList.add('qw-hl');
        note = ''; render(); return true;
      }
      (date < h[0] ? prev : next).click(); refreshed = true;
      await waitChange(h[0]);
    }
    note = `Откройте вручную: ${human(date)}${hour != null ? ' ' + pad(hour) + ':00' : ''}`; render();
    return false;
  };

  const host = document.createElement('div');
  host.style.cssText = `position:fixed;z-index:2147483647;opacity:0.85;`;
  const pos = S.pos || { x: innerWidth - WIDTH - 16, y: 16 };
  host.style.left = Math.min(pos.x, innerWidth - 120) + 'px'; host.style.top = Math.min(pos.y, innerHeight - 60) + 'px';
  const root = host.attachShadow({ mode: 'open' });
  document.body.appendChild(host);
  root.innerHTML = `<style>
    *{box-sizing:border-box}
    .w{width:${WIDTH}px;background:#1b1c21;color:#e6e6ea;font:${FONT}/1.4 system-ui,sans-serif;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.4);overflow:hidden}
    .h{display:flex;align-items:center;gap:6px;padding:6px 8px;background:#25272e;cursor:move;user-select:none}
    .dot{width:8px;height:8px;border-radius:50%;background:#666}.dot.on{background:#3ddc84;box-shadow:0 0 6px #3ddc84}.dot.busy{background:#f5c542}
    .h b{flex:1;font-size:${FONT};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .pill{background:#1f4d33;color:#7ef0ad;border-radius:8px;padding:1px 6px;font-size:10px}
    .h button{background:none;border:0;color:#999;cursor:pointer;font-size:13px;padding:0 2px}
    .tabs{display:flex;background:#202228}
    .tabs button{flex:1;background:none;border:0;color:#9a9ca5;padding:4px 0;cursor:pointer;border-bottom:2px solid transparent;font-size:10px}
    .tabs button.a{color:#fff;border-color:#3ddc84}
    .body{padding:7px;max-height:${isLaptop ? 320 : 400}px;overflow:auto}
    .tiles{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:7px}
    .tile{background:#25272e;border-radius:6px;padding:4px 6px}.tile .v{font-size:${isLaptop ? 14 : 16}px;font-weight:700}.tile .l{font-size:9px;color:#9a9ca5}
    .g{color:#3ddc84}.r{color:#ff6b6b}.y{color:#f5c542}.w{color:#f5c542}
    .sec{font-size:9px;color:#9a9ca5;text-transform:uppercase;letter-spacing:.04em;margin:5px 0 4px}
    .day{display:grid;grid-template-columns:65px 1fr 30px;gap:4px;align-items:center;padding:2px 0;cursor:pointer}
    .day:hover{background:#25272e;border-radius:4px}
    .bar{display:flex;height:6px;border-radius:3px;overflow:hidden;background:#33353d}.bar i{display:block}
    .hist{display:flex;align-items:flex-end;gap:2px;height:32px}.hist i{flex:1;background:#3ddc84;border-radius:2px 2px 0 0;min-height:1px;opacity:.85}
    .hl{display:flex;justify-content:space-between;font-size:8px;color:#777}
    .cal .nav{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}
    .cal .grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
    .cal .wd{text-align:center;font-size:9px;color:#777}
    .cd{position:relative;text-align:center;padding:4px 0 6px;border-radius:5px;background:#25272e;cursor:pointer;user-select:none;font-size:10px}
    .cd.past{opacity:.3;cursor:default}.cd.sel{background:#2e6b48;color:#fff}.cd.today{box-shadow:inset 0 0 0 1px #f5c542}
    .cd .bd{position:absolute;bottom:1px;left:0;right:0;font-size:7px;line-height:1}
    .btns{display:flex;gap:4px;flex-wrap:wrap;margin-top:5px}
    button.s{background:#2d2f37;color:#ddd;border:0;border-radius:5px;padding:3px 6px;cursor:pointer;font-size:10px}button.s:hover{background:#383a43}
    .log div{background:#25272e;border-radius:5px;padding:3px 5px;margin-bottom:3px;cursor:pointer;font-size:10px}
    .log .tm{color:#888;margin-right:5px}
    label.f{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:4px;font-size:10px}
    input[type=number],input[type=text]{background:#25272e;border:1px solid #393b44;color:#eee;border-radius:5px;padding:2px 5px;width:55px;font-size:10px}
    input.wide{width:130px}
    .hint{font-size:9px;color:#8a8c95;margin:3px 0 4px}
    .ft{padding:6px 8px;background:#202228;display:grid;gap:4px}
    .go{border:0;border-radius:6px;padding:5px;font-weight:700;cursor:pointer;background:#3ddc84;color:#111;font-size:11px}.go.stop{background:#ff5c5c;color:#fff}
    .st{font-size:9px;color:#9a9ca5}
    .w.min .tabs,.w.min .body,.w.min .ft{display:none}
    .legend{display:flex;gap:8px;font-size:9px;color:#9a9ca5;margin-top:4px}
    .legend i{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:2px;vertical-align:middle}
  </style>
  <div class="w">
    <div class="h"><span class="dot"></span><b>Слот-вочер</b><span class="pill"></span>
      <button data-a="min" title="Свернуть">–</button><button data-a="close" title="Закрыть">×</button></div>
    <div class="tabs"><button data-t="overview">Обзор</button><button data-t="cal">Даты</button><button data-t="log">Журнал</button><button data-t="cfg">Настройки</button></div>
    <div class="body"></div>
    <div class="ft"><button class="go"></button><div class="st"></div></div>
  </div>`;
  const $ = s => root.querySelector(s);
  const W = $('.w'), body = $('.body');
  let calMonth = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })();
  let lastClicked = null;

  const viewOverview = () => {
    const list = watched(), st = S.stats;
    const maxH = Math.max(1, ...st.relHour);
    return `<div class="tiles">
      <div class="tile"><div class="v g">${freeNow()}</div><div class="l">свободно сейчас</div></div>
      <div class="tile"><div class="v">${st.freed}</div><div class="l">освободилось всего</div></div>
      <div class="tile"><div class="v r">${st.missed}</div><div class="l">перехвачено другими</div></div>
      <div class="tile"><div class="v y">${st.autoBooked}</div><div class="l">забронировано авто</div></div>
    </div>
    <div class="sec">По дням ${S.dates.length ? '(выбранные)' : `(ближайшие ${S.cfg.ahead})`} · часы ${pad(S.cfg.h1)}–${pad(S.cfg.h2)}</div>
    ${list.map(d => { const x = days[d], tot = x ? x.free + x.taken + x.na + (x.waitlist||0) || 1 : 1;
      return `<div class="day" data-go="${d}"><span>${human(d)}</span>
        <span class="bar">${x ? `<i style="width:${x.free / tot * 100}%;background:#3ddc84"></i><i style="width:${(x.waitlist||0) / tot * 100}%;background:#f5c542"></i><i style="width:${x.taken / tot * 100}%;background:#ff6b6b"></i><i style="width:${x.na / tot * 100}%;background:#55575f"></i>` : ''}</span>
        <span class="${x?.free ? 'g' : ''}" style="text-align:right">${x ? x.free : '…'}</span></div>`; }).join('')}
    <div class="legend"><span><i style="background:#3ddc84"></i>своб.</span><span><i style="background:#f5c542"></i>лист</span><span><i style="background:#ff6b6b"></i>занято</span></div>
    <div class="sec">Когда освобождаются (время суток)</div>
    <div class="hist">${st.relHour.map((v, i) => `<i title="${pad(i)}:00 — ${v}" style="height:${v / maxH * 100}%"></i>`).join('')}</div>
    <div class="hl"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
    <div class="hint">Последнее: ${st.last ? new Date(st.last).toLocaleString() : '—'}</div>`;
  };

  const viewCal = () => {
    const y = calMonth.getFullYear(), m = calMonth.getMonth(), t = today();
    const first = (new Date(y, m, 1).getDay() + 6) % 7, n = new Date(y, m + 1, 0).getDate();
    let cells = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(w => `<div class="wd">${w}</div>`).join('');
    cells += '<div></div>'.repeat(first);
    for (let d = 1; d <= n; d++) {
      const s = iso(new Date(y, m, d)), x = days[s];
      const cls = ['cd', s < t && 'past', S.dates.includes(s) && 'sel', s === t && 'today'].filter(Boolean).join(' ');
      const bd = x ? `<span class="bd ${x.free ? 'g' : (x.waitlist ? 'w' : 'r')}">${x.free ? x.free + ' св' : x.waitlist ? 'лист' : 'занято'}</span>` : '';
      cells += `<div class="${cls}" data-d="${s}">${d}${bd}</div>`;
    }
    return `<div class="cal"><div class="nav"><button class="s" data-m="-1">‹</button><b>${MONN[m]} ${y}</b><button class="s" data-m="1">›</button></div>
      <div class="grid">${cells}</div>
      <div class="hint">Клик — выбрать/снять, Shift+клик — диапазон. ${S.dates.length ? `Выбрано: ${S.dates.length}` : `Ближайшие ${S.cfg.ahead} дн.`}</div>
      <div class="btns"><button class="s" data-q="clear">Очистить</button><button class="s" data-q="7">7 дней</button><button class="s" data-q="14">14 дней</button></div></div>`;
  };

  const viewLog = () => {
    const icon = { free: '🟢', miss: '🔴', now: '⚪', auto: '🤖' };
    const txt = e => e.type === 'free' ? 'освободился' : e.type === 'miss' ? `перехвачен через ≈${dur(e.life)}` : e.type === 'auto' ? 'авто-бронь' : 'свободен при проверке';
    return `<div class="btns" style="margin:0 0 6px"><button class="s" data-q="csv">Экспорт CSV</button><button class="s" data-q="reset">Сброс</button></div>
      <div class="log">${S.log.length ? S.log.slice(0, 100).map((e, i) => `<div data-l="${i}"><span class="tm">${new Date(e.t).toLocaleTimeString()}</span>${icon[e.type]} ${human(e.date)} ${pad(e.hour)}:00 — ${txt(e)}</div>`).join('') : '<div class="hint">Пусто</div>'}</div>`;
  };

  const viewCfg = () => `
    <label class="f">Интервал, сек <span><input type="number" data-k="min" min="5"> – <input type="number" data-k="max" min="5"></span></label>
    <label class="f">Часы <span><input type="number" data-k="h1" min="0" max="23"> – <input type="number" data-k="h2" min="0" max="23"></span></label>
    <label class="f">Дней вперёд <input type="number" data-k="ahead" min="1" max="30"></label>
    <label class="f">Звук <input type="checkbox" data-k="sound"></label>
    <label class="f">Уведомления <input type="checkbox" data-k="notify"></label>
    <label class="f">Компактный <input type="checkbox" data-k="compactMode"></label>
    <div class="sec">Авто-бронь</div>
    <label class="f">Авто-клик <input type="checkbox" data-k="autoClick"></label>
    <label class="f">Задержка клика, мс <input type="number" data-k="clickDelay" min="100" max="5000"></label>
    <label class="f">Подтверждение, мс <input type="number" data-k="confirmDelay" min="100" max="10000"></label>
    <div class="sec">Стелс-режим</div>
    <label class="f">Стелс <input type="checkbox" data-k="stealthMode"></label>
    <div class="sec">Telegram</div>
    <label class="f">Токен <input type="text" class="wide" data-k="tgToken" placeholder="123456:ABC…"></label>
    <label class="f">Chat ID <input type="text" class="wide" data-k="tgChat"></label>
    <div class="btns"><button class="s" data-q="test">Тест</button></div>
    <div class="hint">Автоклик: клик по слоту + кнопка "Далее". Лист ожидания не считается свободным.</div>`;

  const render = () => {
    W.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('a', b.dataset.t === S.tab));
    const dot = $('.dot'); dot.className = 'dot' + (busy ? ' busy' : running ? ' on' : '');
    const fn = freeNow(); $('.pill').textContent = fn ? `${fn} св.` : ''; $('.pill').style.display = fn ? '' : 'none';
    const go = $('.go'); go.textContent = running ? 'Стоп' : 'Старт'; go.classList.toggle('stop', running);
    updStatus();
    if (S.tab === 'cfg' && body.dataset.v === 'cfg') return;
    body.dataset.v = S.tab;
    body.innerHTML = S.tab === 'overview' ? viewOverview() : S.tab === 'cal' ? viewCal() : S.tab === 'log' ? viewLog() : viewCfg();
    if (S.tab === 'cfg') body.querySelectorAll('[data-k]').forEach(i => { const v = S.cfg[i.dataset.k]; i.type === 'checkbox' ? i.checked = v : i.value = v; });
  };
  const updStatus = () => {
    const parts = [];
    if (lastErr) parts.push('<span class="r">Ошибка: ' + lastErr + '</span>');
    if (note) parts.push('<span class="y">' + note + '</span>');
    if (busy) parts.push('Проверяю…');
    else if (running) parts.push(`Следующая через ${Math.max(0, Math.round((nextAt - Date.now()) / 1000))} с`);
    parts.push(`проверок: ${checks}`);
    $('.st').innerHTML = parts.join(' · ');
  };
  const tick = setInterval(() => running && !busy && updStatus(), 1000);

  const startDrag = (e) => {
    if (e.target.closest('button, input, select, textarea, a, label.f, .go, .tabs')) return;
    if (e.button !== 0) return;
    e.preventDefault();
    const dx = e.clientX - host.offsetLeft, dy = e.clientY - host.offsetTop;
    const mv = ev => { host.style.left = ev.clientX - dx + 'px'; host.style.top = ev.clientY - dy + 'px'; };
    const up = () => { S.pos = { x: host.offsetLeft, y: host.offsetTop }; persist(); removeEventListener('mousemove', mv); removeEventListener('mouseup', up); };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  };
  W.addEventListener('mousedown', startDrag);

  W.addEventListener('click', e => {
    const t = e.target.closest('[data-t],[data-a],[data-go],[data-d],[data-m],[data-q],[data-l],.go');
    if (!t) return;
    if (t.classList.contains('go')) return running ? stop() : start();
    if (t.dataset.t) { S.tab = t.dataset.t; body.dataset.v = ''; persist(); return render(); }
    if (t.dataset.a === 'min') return W.classList.toggle('min');
    if (t.dataset.a === 'close') return destroy();
    if (t.dataset.go) { const d = t.dataset.go; const f = Object.entries(slots).find(([k, v]) => v.free && k.startsWith(d)); return goTo(d, f ? +f[0].slice(11, 13) : null); }
    if (t.dataset.l) { const e2 = S.log[+t.dataset.l]; return goTo(e2.date, e2.hour); }
    if (t.dataset.m) { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + +t.dataset.m, 1); return render(); }
    if (t.dataset.d) {
      const d = t.dataset.d; if (d < today()) return;
      if (e.shiftKey && lastClicked) { let [a, b] = [lastClicked, d].sort(); for (let x = a; x <= b; x = addDays(x, 1)) if (!S.dates.includes(x)) S.dates.push(x); }
      else S.dates = S.dates.includes(d) ? S.dates.filter(x => x !== d) : [...S.dates, d];
      lastClicked = d; S.dates = S.dates.filter(x => x >= today()).sort(); persist(); render();
      if (running && !busy) { clearTimeout(timer); timer = setTimeout(check, 1500); }
      return;
    }
    const q = t.dataset.q, t0 = today();
    if (q === 'clear') S.dates = [];
    if (q === '7' || q === '14') S.dates = Array.from({ length: +q }, (_, i) => addDays(t0, i));
    if (q === 'test') alertUser('Тест', 'Так выглядит уведомление');
    if (q === 'reset' && confirmReset()) { S.stats = structuredClone(DEF.stats); S.log = []; }
    if (q === 'csv') {
      const rows = [['время', 'событие', 'дата', 'час', 'жил_сек']].concat(S.log.map(e => [new Date(e.t).toLocaleString(), e.type, e.date, e.hour, e.life ? Math.round(e.life / 1000) : '']));
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['﻿' + rows.map(r => r.join(';')).join('\n')], { type: 'text/csv' }));
      a.download = 'slot-watcher-log.csv'; a.click();
    }
    persist(); render();
  });
  let resetArmed = 0;
  const confirmReset = () => { if (Date.now() - resetArmed < 3000) return true; resetArmed = Date.now(); note = 'Нажмите ещё раз'; setTimeout(() => { note = ''; updStatus(); }, 3000); return false; };

  body.addEventListener('change', e => {
    const i = e.target, k = i.dataset.k; if (!k) return;
    let v = i.type === 'checkbox' ? i.checked : i.type === 'number' ? +i.value : i.value.trim();
    if (k === 'min' || k === 'max') v = Math.max(5, v || 5);
    if (k === 'h1' || k === 'h2') v = Math.min(23, Math.max(0, v || 0));
    if (k === 'ahead') v = Math.min(30, Math.max(1, v || 5));
    if (k === 'clickDelay') v = Math.min(5000, Math.max(100, v || 300));
    if (k === 'confirmDelay') v = Math.min(10000, Math.max(100, v || 1000));
    S.cfg[k] = v;
    if (S.cfg.max < S.cfg.min) S.cfg.max = S.cfg.min;
    if (S.cfg.h2 < S.cfg.h1) S.cfg.h2 = S.cfg.h1;
    if (k === 'notify' && v) try { Notification.requestPermission(); } catch {}
    persist(); body.dataset.v = ''; render();
  });

  const toggle = force => { host.style.display = (force ?? host.style.display === 'none') ? '' : 'none'; if (force) W.classList.remove('min'); };
  const hotkey = e => { if (e.altKey && e.code === 'KeyQ') toggle(); };
  addEventListener('keydown', hotkey);
  const destroy = () => { stop(); clearInterval(tick); clearInterval(blink); removeEventListener('keydown', hotkey); host.remove(); hlStyle.remove(); delete window.__qw; };

  window.__qw = { start, stop, toggle, goTo, state: () => ({ S, days, slots }) };
  render();
})();
