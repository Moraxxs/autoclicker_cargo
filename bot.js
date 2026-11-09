// Слот-вочер с авто-броней для cgr.qoldau.kz
(() => {
  if (window.__slotWatcher) { window.__slotWatcher.show(); return; }

  const BUSY = /Забронировано либо недоступно/i;
  const LS = 'slotWatcherCfg';
  const load = () => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } };
  const save = c => { try { localStorage.setItem(LS, JSON.stringify(c)); } catch {} };
  const cfg = Object.assign({ 
    min: 40, max: 70, filter: '', sound: true, x: null, y: null,
    autoClick: true, // Автоматический клик
    clickDelay: 500 // Задержка перед кликом (мс)
  }, load());

  // ---------- логика слотов ----------
  const attrText = el => [el.title, el.getAttribute('data-original-title'),
    el.getAttribute('aria-label'), el.getAttribute('data-bs-original-title')].join(' ');
  const isBusy = el => {
    for (let p = el, i = 0; p && i < 4; p = p.parentElement, i++) {
      if (BUSY.test(attrText(p))) return true;
      if (i === 0 && BUSY.test(p.textContent)) return true;
    }
    return false;
  };
  const context = el => (el.closest('tr')?.textContent || '').replace(/\s+/g, ' ').trim();
  const root = doc => doc.forms[0] || doc.querySelector('main') || doc.body;

  const scan = doc => {
    const seen = {}, out = [];
    root(doc).querySelectorAll('*').forEach(el => {
      if (el.children.length || el.closest('#slot-watcher')) return;
      const t = el.textContent.trim();
      if (!t || t.length > 40 || isBusy(el)) return;
      if (!/\d/.test(t)) return;
      seen[t] = (seen[t] || 0) + 1;
      out.push({ key: t + '#' + seen[t], text: t, ctx: context(el), el });
    });
    return out;
  };
  const matchFilter = s => {
    const f = cfg.filter.trim().toLowerCase();
    return !f || f.split(',').some(w => w.trim() && (s.text + ' ' + s.ctx).toLowerCase().includes(w.trim()));
  };

  // ---------- функция авто-клика ----------
  const findClickableElement = (slotEl) => {
    let el = slotEl;
    for (let i = 0; i < 5; i++) {
      if (!el) break;
      if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.onclick || el.getAttribute('role') === 'button') {
        return el;
      }
      const clickable = el.querySelector('button, a, [role="button"], [onclick]');
      if (clickable) return clickable;
      el = el.parentElement;
    }
    return slotEl;
  };

  const autoClickSlot = async (slot) => {
    if (!cfg.autoClick) return;
    
    await new Promise(r => setTimeout(r, cfg.clickDelay));
    
    const clickable = findClickableElement(slot.el);
    if (clickable) {
      console.log('🎯 Авто-клик на слот:', slot.text);
      clickable.click();
      
      document.querySelectorAll('.sw-hl').forEach(e => e.classList.remove('sw-hl'));
      slot.el.classList.add('sw-hl');
      
      // Ищем и нажимаем кнопку подтверждения
      setTimeout(() => {
        const confirmBtns = document.querySelectorAll('button:not([disabled])');
        for (const btn of confirmBtns) {
          const txt = btn.textContent.toLowerCase();
          if (txt.includes('подтвердить') || txt.includes('забронировать') || txt.includes('записаться')) {
            console.log('✅ Подтверждение брони:', btn.textContent);
            btn.click();
            break;
          }
        }
      }, 1000);
    }
  };

  let baseline = new Set(scan(document).map(s => s.key));
  let timer = null, running = false, checks = 0;

  // ---------- UI ----------
  const w = document.createElement('div');
  w.id = 'slot-watcher';
  w.innerHTML = `
  <style>
    #slot-watcher{position:fixed;z-index:2147483647;width:300px;background:#1e1f24;color:#e8e8ea;
      font:13px/1.4 system-ui,sans-serif;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.35);overflow:hidden}
    #slot-watcher .h{display:flex;align-items:center;gap:8px;padding:8px 10px;background:#2a2c33;cursor:move;user-select:none}
    #slot-watcher .dot{width:9px;height:9px;border-radius:50%;background:#777}
    #slot-watcher .dot.on{background:#3ddc84;box-shadow:0 0 6px #3ddc84}
    #slot-watcher .h b{flex:1}
    #slot-watcher .h button{background:none;border:0;color:#aaa;cursor:pointer;font-size:15px}
    #slot-watcher .b{padding:10px;display:grid;gap:8px}
    #slot-watcher input[type=number],#slot-watcher input[type=text]{background:#2a2c33;border:1px solid #3a3c44;
      color:#eee;border-radius:6px;padding:4px 6px;width:100%;box-sizing:border-box}
    #slot-watcher .row{display:flex;gap:6px;align-items:center}
    #slot-watcher .row input[type=number]{width:60px}
    #slot-watcher .go{border:0;border-radius:6px;padding:7px;font-weight:600;cursor:pointer;background:#3ddc84;color:#111}
    #slot-watcher .go.stop{background:#ff5c5c;color:#fff}
    #slot-watcher .st{color:#9a9ca5;font-size:12px}
    #slot-watcher .log{max-height:150px;overflow:auto;font-size:12px;display:grid;gap:4px}
    #slot-watcher .log div{background:#2a2c33;border-radius:5px;padding:4px 6px;cursor:pointer}
    #slot-watcher .log div.new{background:#1f4d33}
    #slot-watcher.min .b{display:none}
    .sw-hl{outline:3px solid #3ddc84!important;outline-offset:2px;animation:swp 1s infinite}
    @keyframes swp{50%{outline-color:transparent}}
  </style>
  <div class="h"><span class="dot"></span><b>Слот-вочер</b>
    <button data-a="min" title="Свернуть">–</button><button data-a="close" title="Закрыть">×</button></div>
  <div class="b">
    <div class="row">Интервал, сек: <input type="number" data-k="min" min="15"> – <input type="number" data-k="max" min="15"></div>
    <input type="text" data-k="filter" placeholder="Фильтр: дата/КПП/время, через запятую">
    <label class="row"><input type="checkbox" data-k="sound"> Звук</label>
    <label class="row"><input type="checkbox" data-k="autoClick"> Авто-бронь</label>
    <div class="row">Задержка клика, мс: <input type="number" data-k="clickDelay" min="100" max="5000"></div>
    <button class="go">Старт</button>
    <div class="st">Свободных сейчас: <span class="cnt">–</span> · проверок: <span class="chk">0</span><br>Последняя: <span class="last">–</span></div>
    <div class="log"></div>
  </div>`;
  document.body.appendChild(w);

  const $ = s => w.querySelector(s);
  w.style.left = (cfg.x ?? innerWidth - 320) + 'px';
  w.style.top = (cfg.y ?? 20) + 'px';
  w.querySelectorAll('[data-k]').forEach(i => {
    const k = i.dataset.k;
    if (i.type === 'checkbox') i.checked = cfg[k]; else i.value = cfg[k];
    i.addEventListener('change', () => {
      cfg[k] = i.type === 'checkbox' ? i.checked : i.type === 'number' ? Math.max(15, +i.value || 15) : i.value;
      if (cfg.max < cfg.min) cfg.max = cfg.min;
      save(cfg);
    });
  });

  // перетаскивание
  $('.h').addEventListener('mousedown', e => {
    if (e.target.tagName === 'BUTTON') return;
    const dx = e.clientX - w.offsetLeft, dy = e.clientY - w.offsetTop;
    const mv = ev => { w.style.left = ev.clientX - dx + 'px'; w.style.top = ev.clientY - dy + 'px'; };
    const up = () => { cfg.x = w.offsetLeft; cfg.y = w.offsetTop; save(cfg);
      removeEventListener('mousemove', mv); removeEventListener('mouseup', up); };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  });
  $('[data-a=min]').onclick = () => w.classList.toggle('min');
  $('[data-a=close]').onclick = () => { stop(); w.remove(); delete window.__slotWatcher; };

  const setCount = () => { $('.cnt').textContent = scan(document).filter(matchFilter).length; };
  setCount();

  // ---------- уведомления ----------
  const origTitle = document.title;
  let blink = null;
  const alertUser = list => {
    if (cfg.sound) try {
      const ctx = new AudioContext();
      [0, 0.35, 0.7].forEach(t => { const o = ctx.createOscillator(); o.frequency.value = 880;
        o.connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.25); });
    } catch {}
    try { if (Notification.permission === 'granted')
      new Notification('Слот освободился', { body: list.map(s => s.text).join(', ') }).onclick = () => focus(); } catch {}
    clearInterval(blink);
    blink = setInterval(() => document.title = document.title === origTitle ? '🔔 СЛОТ!' : origTitle, 800);
    addEventListener('focus', () => { clearInterval(blink); document.title = origTitle; }, { once: true });
    w.classList.remove('min');
  };

  const highlight = key => {
    document.querySelectorAll('.sw-hl').forEach(e => e.classList.remove('sw-hl'));
    const s = scan(document).find(x => x.key === key);
    if (s) { s.el.classList.add('sw-hl'); s.el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  };

  const addLog = list => {
    const t = new Date().toLocaleTimeString();
    $('.log').querySelectorAll('.new').forEach(e => e.classList.remove('new'));
    list.forEach(s => {
      const d = document.createElement('div');
      d.className = 'new';
      d.textContent = `${t} — ${s.text}${s.ctx ? ' · ' + s.ctx.slice(0, 50) : ''}${cfg.autoClick ? ' [АВТО-БРОНЬ]' : ''}`;
      d.onclick = () => highlight(s.key);
      $('.log').prepend(d);
    });
  };

  // ---------- цикл ----------
  const check = async () => {
    try {
      const html = await (await fetch(location.href, { credentials: 'include', cache: 'no-store' })).text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const now = scan(doc);
      const fresh = now.filter(s => !baseline.has(s.key) && matchFilter(s));
      baseline = new Set(now.map(s => s.key));
      checks++;
      $('.chk').textContent = checks;
      $('.last').textContent = new Date().toLocaleTimeString();
      if (fresh.length) {
        const cur = root(document), nw = root(doc);
        if (cur && nw && cur !== document.body) cur.innerHTML = nw.innerHTML;
        setCount();
        addLog(fresh);
        alertUser(fresh);
        highlight(fresh[0].key);
        
        // Автоматическая бронь первого свободного слота
        if (cfg.autoClick && fresh.length > 0) {
          await autoClickSlot(fresh[0]);
        }
      } else setCount();
    } catch (e) {
      $('.last').textContent = 'ошибка: ' + e.message;
    }
    if (running) timer = setTimeout(check, (cfg.min + Math.random() * (cfg.max - cfg.min)) * 1000);
  };

  const start = () => {
    running = true;
    try { Notification.requestPermission(); } catch {}
    baseline = new Set(scan(document).map(s => s.key));
    $('.dot').classList.add('on'); $('.go').textContent = 'Стоп'; $('.go').classList.add('stop');
    timer = setTimeout(check, 3000);
  };
  const stop = () => {
    running = false; clearTimeout(timer);
    $('.dot').classList.remove('on'); $('.go').textContent = 'Старт'; $('.go').classList.remove('stop');
  };
  $('.go').onclick = () => running ? stop() : start();

  window.__slotWatcher = { start, stop, show: () => w.classList.remove('min'), scan: () => scan(document) };
})();

