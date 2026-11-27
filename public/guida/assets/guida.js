/*
 * Guida CasaZen: comportamenti della guida (ricerca, indice su telefono, filtri, indice della pagina).
 * Scritto a mano, senza dipendenze; le pagine restano leggibili anche senza JavaScript.
 * L'indice di ricerca (guida-indice.js) viene caricato solo quando serve; la logica di ricerca è in guida-ricerca.js.
 */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* La logica della ricerca (normalizzazione, indice, punteggio) sta in guida-ricerca.js, caricato prima di questo file. */
  var R = window.GuidaRicerca;
  var fold = R ? R.fold : function (x) { return String(x || '').toLowerCase(); };

  /* ---------------- Indice laterale su telefono ---------------- */
  var body = document.body;
  var menuBtn = $('.gd-menubtn');
  var scrim = $('[data-scrim]');
  function setNav(open) {
    body.classList.toggle('gd-navopen', open);
    if (menuBtn) menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (scrim) scrim.hidden = !open;
  }
  if (menuBtn) {
    menuBtn.addEventListener('click', function () { setNav(!body.classList.contains('gd-navopen')); });
    if (scrim) scrim.addEventListener('click', function () { setNav(false); });
    $$('.gd-nav a').forEach(function (a) { a.addEventListener('click', function () { setNav(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setNav(false); });
  }
  var current = $('.gd-nav .is-current');
  if (current && current.scrollIntoView && window.matchMedia('(min-width: 981px)').matches) {
    var nav = $('.gd-nav');
    if (nav) nav.scrollTop = Math.max(0, current.offsetTop - nav.clientHeight / 3);
  }

  /* ---------------- Ricerca ---------------- */
  var TYPES = { pagina: 'Pagina', howto: 'Come fare', funzione: 'Funzionalità', faq: 'Domanda', flusso: 'Percorso', termine: 'Glossario' };
  var ready = null;

  /* Carica l'indice (guida-indice.js) solo alla prima ricerca e lo passa al motore. */
  function loadIndex() {
    if (ready) return ready;
    ready = new Promise(function (resolve, reject) {
      var fail = function (msg) { ready = null; reject(new Error(msg)); };
      if (!R) { fail('motore di ricerca non disponibile'); return; }
      if (window.GUIDA_INDICE) { R.prepara(window.GUIDA_INDICE); resolve(); return; }
      var s = document.createElement('script');
      s.src = 'guida-indice.js';
      s.onload = function () { R.prepara(window.GUIDA_INDICE); resolve(); };
      s.onerror = function () { fail('indice non disponibile'); };
      document.head.appendChild(s);
    });
    return ready;
  }
  function search(q, limit) { return R.cerca(q, limit); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  $$('[data-search-input]').forEach(function (input) {
    var form = input.closest('form');
    var box = $('[data-suggest]', form);
    var items = [];
    var active = -1;
    function close() { box.hidden = true; active = -1; items = []; }
    function render(results, q) {
      box.textContent = '';
      items = [];
      if (!results.length) {
        box.appendChild(el('div', 'gd-suggest__empty', 'Nessun risultato per «' + q + '». Prova con meno parole oppure apri «Inizia qui».'));
        box.hidden = false;
        return;
      }
      results.forEach(function (r) {
        var a = el('a');
        a.href = r.url;
        a.setAttribute('role', 'option');
        a.appendChild(el('span', 'gd-type', TYPES[r.t] || r.t));
        a.appendChild(el('span', 'gd-suggest__t', r.titolo));
        a.appendChild(el('span', 'gd-suggest__c', (r.ctx && r.ctx !== 'Pagina' ? r.ctx + ' · ' : '') + r.sezione));
        box.appendChild(a);
        items.push(a);
      });
      var all = el('a', 'gd-suggest__all', 'Mostra tutti i risultati');
      all.href = 'cerca.html?q=' + encodeURIComponent(q);
      box.appendChild(all);
      box.hidden = false;
    }
    var timer = null;
    input.addEventListener('input', function () {
      var q = input.value.trim();
      clearTimeout(timer);
      if (q.length < 2) { close(); return; }
      timer = setTimeout(function () {
        loadIndex().then(function () { render(search(q, 7), q); }).catch(function () { close(); });
      }, 90);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { close(); return; }
      if (box.hidden || !items.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items.forEach(function (a, i) { a.setAttribute('aria-selected', i === active ? 'true' : 'false'); });
        items[active].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && active >= 0) {
        e.preventDefault();
        window.location.href = items[active].href;
      }
    });
    document.addEventListener('click', function (e) { if (!form.contains(e.target)) close(); });
  });

  /* Pagina dei risultati */
  var results = $('[data-search-results]');
  if (results) {
    var q = new URLSearchParams(window.location.search).get('q') || '';
    var qInput = $('[data-search-input]');
    if (qInput) qInput.value = q;
    var title = $('[data-search-title]');
    var sub = $('[data-search-sub]');
    if (q.trim()) {
      if (title) title.textContent = 'Risultati per «' + q.trim() + '»';
      loadIndex().then(function () {
        var found = search(q, 60);
        results.textContent = '';
        if (sub) sub.textContent = found.length ? found.length + (found.length === 1 ? ' risultato' : ' risultati') : 'Nessun risultato. Prova con meno parole o con altre parole. Se non trovi risposta, apri la Guida nell’app: se c’è un indirizzo di assistenza, trovi «Scrivi all’assistenza».';
        if (!found.length) {
          var exits = el('p');
          [['inizia-qui.html', 'Inizia qui'], ['index.html', 'Sfoglia gli argomenti'], ['domande-frequenti.html', 'Domande frequenti']].forEach(function (l, i) {
            if (i) exits.appendChild(document.createTextNode(' · '));
            var a = el('a', '', l[1]);
            a.href = l[0];
            exits.appendChild(a);
          });
          results.appendChild(exits);
        }
        var order = [];
        found.forEach(function (r) { if (order.indexOf(r.t) < 0) order.push(r.t); });      // i gruppi seguono la classifica: prima quello della voce migliore
        order.forEach(function (t) {
          var list = found.filter(function (r) { return r.t === t; });
          if (!list.length) return;
          var h = el('h2', 'gd-h2', ({ howto: 'Come fare', funzione: 'Funzionalità', faq: 'Domande frequenti', flusso: 'Percorsi completi', pagina: 'Pagine', termine: 'Glossario' })[t]);
          results.appendChild(h);
          var ul = el('ul', 'gd-results');
          list.forEach(function (r) {
            var li = el('li', 'gd-result');
            var a = el('a');
            a.href = r.url;
            a.appendChild(el('div', 'gd-result__t', r.titolo));
            var c = el('div', 'gd-result__c');
            c.appendChild(el('span', 'gd-type', TYPES[r.t] || r.t));
            c.appendChild(el('span', '', (r.ctx && r.ctx !== 'Pagina' ? r.ctx + ' · ' : '') + r.sezione));
            a.appendChild(c);
            if (r.testo) a.appendChild(el('p', 'gd-result__x', r.testo));
            li.appendChild(a);
            ul.appendChild(li);
          });
          results.appendChild(ul);
        });
      }).catch(function () {
        results.textContent = 'La ricerca non è disponibile in questo momento. Puoi sfogliare gli argomenti dall\'indice.';
      });
    }
  }

  /* ---------------- Filtri (home, elenchi) ---------------- */
  var filterable = $$('[data-filterable]');
  if (filterable.length) {
    var state = { chi: '', sec: '', text: '' };
    var countEl = $('[data-filter-count]');
    var emptyEl = $('[data-empty]');
    var apply = function () {
      var shown = 0;
      var needle = fold(state.text);
      filterable.forEach(function (n) {
        var chi = (n.getAttribute('data-chi') || '').split(' ');
        var ok = (!state.chi || chi.indexOf(state.chi) >= 0 || !n.getAttribute('data-chi')) &&
          (!state.sec || n.getAttribute('data-sec') === state.sec) &&
          (!needle || fold(n.textContent).indexOf(needle) >= 0);
        n.hidden = !ok;
        if (ok) shown += 1;
      });
      $$('.gd-sec[data-group]').forEach(function (g) {
        g.hidden = !$$('[data-filterable]:not([hidden])', g).length;
      });
      if (countEl) countEl.textContent = shown + (shown === 1 ? ' elemento' : ' elementi');
      if (emptyEl) emptyEl.hidden = shown > 0;
    };
    $$('[data-filter-chi]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.chi = b.getAttribute('data-filter-chi');
        $$('[data-filter-chi]').forEach(function (x) { x.classList.toggle('is-on', x === b); });
        apply();
      });
    });
    $$('[data-filter-sec]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.sec = b.getAttribute('data-filter-sec');
        $$('[data-filter-sec]').forEach(function (x) { x.classList.toggle('is-on', x === b); });
        apply();
      });
    });
    var ft = $('[data-filter-text]');
    if (ft) ft.addEventListener('input', function () { state.text = ft.value; apply(); });
    apply();
  }

  /* ---------------- «In questa pagina»: voce attiva ---------------- */
  var tocLinks = $$('.gd-toc a');
  if (tocLinks.length && 'IntersectionObserver' in window) {
    var map = {};
    tocLinks.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && map[en.target.id]) {
          tocLinks.forEach(function (a) { a.classList.remove('is-active'); });
          map[en.target.id].classList.add('is-active');
        }
      });
    }, { rootMargin: '-80px 0px -70% 0px' });
    Object.keys(map).forEach(function (id) { var t = document.getElementById(id); if (t) obs.observe(t); });
  }

  /* Apre la domanda frequente indicata dall'indirizzo (#...). */
  if (window.location.hash) {
    var target = document.getElementById(window.location.hash.slice(1));
    if (target && target.tagName === 'DETAILS') target.open = true;
  }
})();
