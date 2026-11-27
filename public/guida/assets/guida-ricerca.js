/*
 * Guida CasaZen: motore di ricerca (un'unica copia della logica).
 * Lo usano guida.js (menu a tendina e pagina dei risultati) e le prove da riga di comando (scripts/guida-ricerca.test.mjs).
 * Scritto a mano, senza dipendenze, in ES5: non serve nessuna libreria.
 *
 *   window.GuidaRicerca = { fold, prepara(dati), cerca(domanda, limite) }
 *
 * dati = window.GUIDA_INDICE (generato da scripts/build-guida.mjs): { pagine: {id: parole chiave}, voci: [...] }.
 * Come cerca: normalizza (senza accenti, «e-mail» = «email», «wi-fi» = «wifi»), toglie le parole vuote, riduce ogni parola
 * alla radice (collego = collegare = collegamento, prenotazioni = prenotazione), aggiunge i sinonimi del mestiere,
 * tollera un errore di battitura nelle parole lunghe e completa l'ultima parola mentre la scrivi.
 * Ogni voce prende un punteggio per ogni parola trovata (titolo > parole chiave > testo), pesato su quanto la parola è rara
 * nel manuale; contano la copertura della domanda e le parole vicine nel titolo; una sola parola generica non basta.
 */
(function (global) {
  'use strict';

  /* ---------------- Normalizzazione ---------------- */
  function fold(s) {
    var t = String(s === undefined || s === null ? '' : s).toLowerCase();
    if (t.normalize) t = t.normalize('NFD');
    return t.replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/^ +| +$/g, '');
  }
  /* Parole scritte in più modi: «e-mail», «Wi-Fi», «check-in», «Booking.com» diventano una parola sola. */
  var UNISCI = [[/\bwi fi\b/g, 'wifi'], [/\be mail\b/g, 'email'], [/\bcheck (in|out)\b/g, 'check$1'], [/\bno show\b/g, 'noshow'], [/\bbooking com\b/g, 'booking'], [/\bf 24\b/g, 'f24'], [/\bmail\b/g, 'email']];
  function norma(s) {
    var t = fold(s);
    for (var i = 0; i < UNISCI.length; i += 1) t = t.replace(UNISCI[i][0], UNISCI[i][1]);
    return t;
  }

  /* ---------------- Parole vuote e radici ---------------- */
  var STOP = Object.create(null);
  ('a ad al allo alla alle ai agli all da dal dallo dalla dalle dai dagli dall di del dello della delle dei degli dell in nel nello nella nelle nei negli nell su sul sullo sulla sulle sui sugli sull per tra fra con col coi senza ' +
    'il lo la i gli le l un uno una e ed o od ma se che chi cui non ne ci si mi ti vi ' +
    'come cosa cose dove quando perche quale quali quanto quanti quanta quante cos com dov quest ' +
    'sono sei siamo siete era sia essere stato stata sto sta ho hai ha abbiamo hanno avere ' +
    'fare faccio fai fa facciamo fanno fatto posso puoi puo possiamo possono potere devo devi deve dobbiamo devono dovere voglio vuoi vuole vorrei vorrebbe volere ' +
    'mio mia miei mie tuo tua tuoi tue suo sua suoi sue nostro nostra loro lui lei io tu noi voi questo questa questi queste quello quella quelli quelle ' +
    'piu molto troppo tanto poco ogni ancora caso casi dato fatto fatta fatti ' +
    'uso usa usare usano trovo trovare riesco riuscire serve servono').split(' ').forEach(function (w) { STOP[w] = 1; });

  /* Parole che la regola generale confonderebbe con un'altra: «imposta» (la tassa) non è «impostare», «ricevuta» non è «ricevere». */
  var ECCEZIONI = {
    alloggiati: 'alloggiati', alloggiato: 'alloggiati', alloggati: 'alloggiati', imposta: 'tass', imposte: 'tass', partita: 'partita', partite: 'partita', ricevuta: 'ricevut', ricevute: 'ricevut',
    data: 'data', date: 'data', dati: 'dato', casa: 'casa', case: 'casa', perdita: 'perdita', perdite: 'perdita'
  };
  /* Radice grossolana: toglie un suffisso di verbo o di nome (collegare, collegamento, prenotazione, incassato) oppure la vocale finale. */
  function radice(w) {
    if (w.length < 4 || /^[0-9]+$/.test(w)) return w;
    if (ECCEZIONI[w]) return ECCEZIONI[w];
    var s = w;
    var m = /(azione|azioni|amento|amenti|imento|imenti|atore|atori|atrice|atrici|mente|abile|abili|ibile|ibili|ale|ali)$/.exec(w);
    if (m && w.length - m[1].length >= 4) {
      s = w.slice(0, -m[1].length);
    } else {
      m = /(iscono|isco|isci|isce|ando|endo|are|ere|ire|ato|ata|ati|ate|uto|uta|uti|ute|ito|ita|iti|ite|ano|ono)$/.exec(w);
      if (m && w.length - m[1].length >= 3) s = w.slice(0, -m[1].length);
      else if (/[aeiou]$/.test(w)) s = w.slice(0, -1);
    }
    s = s.replace(/([cg])h$/, '$1');
    if (s.length > 4 && /[^aeiou]i$/.test(s)) s = s.slice(0, -1);
    return s.length >= 3 ? s : w;
  }
  function parole(testo) {
    var t = norma(testo);
    if (!t) return [];
    var out = [];
    var tok = t.split(' ');
    for (var i = 0; i < tok.length; i += 1) if (tok[i].length > 1 && !STOP[tok[i]]) out.push(tok[i]);
    return out;
  }

  /* ---------------- Sinonimi del mestiere ----------------
   * «a b = c d»: tutte le parole sono equivalenti. «a b > c d»: chi scrive a o b cerca anche c e d (non il contrario).
   * Pesano meno della parola scritta. Valgono per ogni forma della parola (collega, collegare, collegamento). */
  var SIN_TESTO = [
    'inquilino conduttore locatario', 'cauzione deposito', 'disdetta recesso', 'prezzo tariffa listino',
    'cancellare annullare eliminare togliere rimuovere', 'mandare inviare spedire trasmettere', 'modificare cambiare correggere sistemare',
    'emergenza urgente urgenza', 'permessi ruoli',
    'casa appartamento alloggio abitazione struttura > immobile',
    'polizia > questura alloggiati', 'questura schedina > alloggiati',
    'soldi denaro > pagamento incasso', 'pagare > incasso versamento', 'costa costare costo costi > prezzo piano abbonamento',
    'fattura ricevuta scontrino > documento fiscale emettere', 'commercialista > pacchetto report',
    'airbnb booking expedia > portali canali calendario ical', 'portale ota > canali portali',
    'squadra collaboratore dipendente staff > team persone ruoli', 'iscrivermi iscrivo iscrizione registrarmi registrarsi registrazione > registrazione account',
    'login accedere password > accesso accedere', 'telefono cellulare smartphone iphone android > app mobile',
    'affitto > canone contratto locazione', 'mettere configurare settare > impostare', 'livello > piano',
    'cominciare iniziare partire avviare > iniziare primi passi', 'presentato presentarsi > arrivato noshow',
    'contanti > incasso', 'trattiene trattenere percentuale prende prendere > commissione provvigione',
    'vedere vedo guardare leggere consultare', 'tempo tempi > dura', 'istat > foi', 'entro > scadenza', 'zero > creare nuovo', 'settimana settimanale > lunghi soggiorno',
    'doppia doppie doppio overbooking > allineati calendari sincronizzare',
    'perdita guasto guasti rotto rottura riparazione riparare > intervento manutenzione fornitore',
    'idraulico elettricista fabbro imbianchino giardiniere muratore tecnico artigiano > fornitore marketplace'
  ];
  var SIN = Object.create(null);
  function aggiungiSin(da, a) {
    var r = radice(da);
    var lista = SIN[r] || (SIN[r] = []);
    var ra = radice(a);
    if (ra !== r && lista.indexOf(ra) < 0) lista.push(ra);
  }
  SIN_TESTO.forEach(function (riga) {
    var uguali = riga.indexOf(' = ') < 0 ? null : riga.split(' = ');
    var verso = riga.indexOf(' > ') < 0 ? null : riga.split(' > ');
    var i;
    var j;
    if (verso) {
      var lhs = verso[0].split(' ');
      var rhs = verso[1].split(' ');
      for (i = 0; i < lhs.length; i += 1) for (j = 0; j < rhs.length; j += 1) aggiungiSin(lhs[i], rhs[j]);
    } else {
      var w = (uguali ? uguali[0] : riga).split(' ');
      for (i = 0; i < w.length; i += 1) for (j = 0; j < w.length; j += 1) if (i !== j) aggiungiSin(w[i], w[j]);
    }
  });

  /* ---------------- Pesi (regolati su un banco di circa 180 domande reali: vedi scripts/guida-ricerca.test.mjs per le prove automatiche) ---------------- */
  var PESO = { t: 6, k: 3.5, p: 1.8, c: 1, x: 2.2 };      // titolo, parole chiave della voce, parole chiave della pagina, contesto, testo
  var TIPO = { howto: 1.1, faq: 1.05, funzione: 1, flusso: 0.95, pagina: 0.9, termine: 1 };
  var P_SIN = 0.65;       // peso di un sinonimo
  var P_PREFISSO = 0.8;   // peso di una parola completata
  var P_ERRORE = 0.7;     // peso di una parola corretta
  var GENERICA = 0.05;    // una parola presente in più del 5% delle voci è «generica»
  var COPERTURA = 0.5;    // quota minima delle parole della domanda che una voce deve contenere
  var PESO_MAX = 4.2;     // una parola rarissima non deve pesare più di tanto: spesso è solo il modo di dire dell'utente

  /* ---------------- Indice ---------------- */
  var pre = [];
  var df = Object.create(null);
  var sup = Object.create(null);
  var supChiavi = [];

  function campo(testo) {
    var arr = [];
    var set = Object.create(null);
    var w = parole(testo);
    for (var i = 0; i < w.length; i += 1) {
      var r = radice(w[i]);
      arr.push(r);
      set[r] = 1;
      sup[w[i]] = r;
    }
    return { arr: arr, set: set };
  }
  function prepara(dati) {
    var pk = (dati && dati.pagine) || {};
    var voci = (dati && dati.voci) || [];
    var perPagina = Object.create(null);
    pre = [];
    df = Object.create(null);
    sup = Object.create(null);
    for (var i = 0; i < voci.length; i += 1) {
      var e = voci[i];
      var pg = e.pg || String(e.url || '').split('#')[0].replace('.html', '');
      var fp = perPagina[pg] || (perPagina[pg] = campo(pk[pg]));
      var ft = campo(e.titolo);
      var fk = campo(e.kw);
      var fc = campo((e.ctx || '') + ' ' + (e.sezione || ''));
      var fx = campo(e.testo);
      pre.push({ e: e, tipo: e.t, tx: parole(e.titolo).join(' '), t: ft.set, ta: ft.arr, k: fk.set, p: fp.set, c: fc.set, x: fx.set, xa: fx.arr });
      var visti = Object.create(null);
      var gruppi = [ft.set, fk.set, fp.set, fc.set, fx.set];
      for (var g = 0; g < gruppi.length; g += 1) {
        for (var r in gruppi[g]) {
          if (!visti[r]) { visti[r] = 1; df[r] = (df[r] || 0) + 1; }
        }
      }
    }
    supChiavi = Object.keys(sup);
    return pre.length;
  }
  function idf(r) { return Math.min(PESO_MAX, Math.log(1 + pre.length / (df[r] || 1))); }

  /* ---------------- Domanda ---------------- */
  var DEF_INIZIO = /^(?:che cos e|che cosa e|cos e|cosa e|cosa sono|che cosa sono|cosa significa|che cosa significa|cosa vuol dire|che cosa vuol dire|cosa vuole dire|significato di|definizione di|cosa si intende per) /;
  var DEF_FINE = / (?:che cos e|che cosa e|cos e|cosa significa|che cosa significa|cosa vuol dire|che cosa vuol dire|significa|vuol dire)$/;

  function vicine(a, b) {
    var la = a.length;
    var lb = b.length;
    if (a === b || la - lb > 1 || lb - la > 1) return false;
    var i = 0;
    while (i < la && i < lb && a.charAt(i) === b.charAt(i)) i += 1;
    if (la === lb) {
      return a.slice(i + 1) === b.slice(i + 1) ||
        (a.charAt(i) === b.charAt(i + 1) && a.charAt(i + 1) === b.charAt(i) && a.slice(i + 2) === b.slice(i + 2));
    }
    return la > lb ? a.slice(i + 1) === b.slice(i) : b.slice(i + 1) === a.slice(i);
  }
  function aggiungi(alts, r, w) {
    if (!df[r]) return;
    for (var i = 0; i < alts.length; i += 1) {
      if (alts[i].r === r) { if (w > alts[i].w) alts[i].w = w; return; }
    }
    alts.push({ r: r, w: w });
  }
  function interpreta(domanda) {
    var q = norma(domanda);
    var def = false;
    var m = DEF_INIZIO.exec(q);
    if (m) { def = true; q = q.slice(m[0].length); }
    m = DEF_FINE.exec(q);
    if (m) { def = true; q = q.slice(0, q.length - m[0].length); }
    var tok = q ? q.split(' ') : [];
    var utili = [];
    var i;
    for (i = 0; i < tok.length; i += 1) if (tok[i].length > 1 && !STOP[tok[i]]) utili.push(i);
    if (utili.length > 1) {
      utili = utili.filter(function (k) { return !/^[0-9]{1,2}$/.test(tok[k]); });
    }
    var gruppi = [];
    var ultima = tok.length - 1;
    for (i = 0; i < utili.length; i += 1) {
      var t = tok[utili[i]];
      var r = radice(t);
      var alts = [];
      aggiungi(alts, r, 1);
      var sin = SIN[r] || [];
      for (var s = 0; s < sin.length; s += 1) aggiungi(alts, sin[s], P_SIN);
      if (utili[i] === ultima && t.length >= 4) {
        var n = 0;
        for (var k = 0; k < supChiavi.length && n < 12; k += 1) {
          if (supChiavi[k].indexOf(t) === 0 && supChiavi[k] !== t) { aggiungi(alts, sup[supChiavi[k]], P_PREFISSO); n += 1; }
        }
      }
      if (!alts.length && t.length >= 6) {
        var c = 0;
        for (var u = 0; u < supChiavi.length && c < 6; u += 1) {
          if (vicine(t, supChiavi[u])) { aggiungi(alts, sup[supChiavi[u]], P_ERRORE); c += 1; }
        }
      }
      if (!alts.length) continue;           // parola che il manuale non usa: non conta
      var primario = df[r] ? r : alts[0].r;
      gruppi.push({ alts: alts, idf: idf(primario), generica: (df[primario] || 0) / pre.length >= GENERICA });
    }
    return { gruppi: gruppi, n: utili.length, def: def, testo: utili.map(function (k) { return tok[k]; }).join(' ') };
  }

  /* ---------------- Punteggio ---------------- */
  function coppie(arr, qg) {
    var n = 0;
    for (var i = 0; i < arr.length - 1; i += 1) {
      var a = qg[arr[i]];
      var b = qg[arr[i + 1]];
      if (a !== undefined && b !== undefined && a !== b) n += 1;
    }
    return n;
  }
  function punteggio(p, q, qg, massa) {
    var G = q.gruppi;
    var forza = 0;
    var s = 0;
    var trovate = 0;
    var nonGenerica = false;
    var massaTitolo = 0;
    var inTitolo = 0;
    for (var i = 0; i < G.length; i += 1) {
      var ft = 0;
      var fk = 0;
      var fp = 0;
      var fc = 0;
      var fx = 0;
      var st = 0;
      var sk = 0;
      var sp = 0;
      var sc = 0;
      var sx = 0;
      var alts = G[i].alts;
      for (var a = 0; a < alts.length; a += 1) {
        var r = alts[a].r;
        var w = alts[a].w;
        if (p.t[r]) { st += w; if (w > ft) ft = w; }
        if (p.k[r]) { sk += w; if (w > fk) fk = w; }
        if (p.p[r]) { sp += w; if (w > fp) fp = w; }
        if (p.c[r]) { sc += w; if (w > fc) fc = w; }
        if (p.x[r]) { sx += w; if (w > fx) fx = w; }
      }
      // Più forme della stessa parola (la parola e i suoi sinonimi) nello stesso campo: un piccolo extra.
      var vt = (ft + 0.25 * (st - ft)) * PESO.t;
      var altri = [(fk + 0.25 * (sk - fk)) * PESO.k, (fp + 0.25 * (sp - fp)) * PESO.p, (fc + 0.25 * (sc - fc)) * PESO.c, (fx + 0.25 * (sx - fx)) * PESO.x];
      var somma = vt + altri[0] + altri[1] + altri[2] + altri[3];
      if (!somma) continue;
      var best = Math.max(vt, altri[0], altri[1], altri[2], altri[3]);
      s += G[i].idf * (best + 0.35 * (somma - best));
      forza += Math.min(1, best / PESO.k);          // una parola trovata solo nel testo vale meno di una nel titolo
      trovate += 1;
      if (!G[i].generica) nonGenerica = true;
      if (ft) { massaTitolo += G[i].idf; inTitolo += 1; }
    }
    if (!trovate || trovate < Math.ceil(G.length * COPERTURA - 1e-9)) return 0;
    if (G.length > 1 && trovate === 1 && !nonGenerica) return 0;      // una sola parola generica non basta
    s *= Math.pow(forza / G.length, 0.8);
    if (G.length > 1) {
      var pt = coppie(p.ta, qg) / (G.length - 1);
      var px = coppie(p.xa, qg) / (G.length - 1);
      s *= 1 + 0.5 * Math.min(1, pt) + 0.2 * Math.min(1, px);
    }
    // Titolo coperto dalla domanda: più è breve e tutto nella domanda, più la voce è «quella giusta».
    if (inTitolo) s *= 1 + 0.5 * (massaTitolo / massa) * (inTitolo / Math.max(p.ta.length, inTitolo));
    if (q.testo === p.tx) s *= 1.35;                                   // il titolo è proprio la domanda
    s *= TIPO[p.tipo] || 1;
    if (q.def && p.tipo === 'termine') s *= 1.8;
    return s;
  }

  function cerca(domanda, limite, dettaglio) {
    if (!pre.length) return [];
    var q = interpreta(domanda);
    if (!q.gruppi.length) return [];
    if (q.n > 1 && q.gruppi.length === 1 && q.gruppi[0].generica) return [];      // una sola parola generica non basta
    var massa = 0;
    var qg = Object.create(null);
    var i;
    for (i = 0; i < q.gruppi.length; i += 1) {
      massa += q.gruppi[i].idf;
      for (var a = 0; a < q.gruppi[i].alts.length; a += 1) if (qg[q.gruppi[i].alts[a].r] === undefined) qg[q.gruppi[i].alts[a].r] = i;
    }
    var out = [];
    for (i = 0; i < pre.length; i += 1) {
      var s = punteggio(pre[i], q, qg, massa);
      if (s > 0) out.push({ e: pre[i].e, s: s, n: i });
    }
    out.sort(function (x, y) { return (y.s - x.s) || (x.n - y.n); });
    // Una sola voce per indirizzo e tipo: se pagina e compito coincidono, tiene la più alta.
    var visti = Object.create(null);
    var res = [];
    for (i = 0; i < out.length && res.length < (limite || 8); i += 1) {
      var chiave = out[i].e.url + '|' + out[i].e.t;
      if (visti[chiave]) continue;
      visti[chiave] = 1;
      res.push(dettaglio ? { voce: out[i].e, punti: Math.round(out[i].s * 10) / 10 } : out[i].e);
    }
    return res;
  }

  global.GuidaRicerca = { fold: fold, prepara: prepara, cerca: cerca };
})(window);
