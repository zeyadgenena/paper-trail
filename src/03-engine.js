/* Paper Trail engine: sentence splitting, claim-to-source matching and difference flags.
   Word-based and deterministic. It never judges truth; it points at differences. */
const PT = (() => {
  const STOP = new Set(('a an the and or but nor of to in on at by for with from as is are was were be been being has have had ' +
    'do does did will shall must should it its this that these those they them their there here he she his her him we our us ' +
    'you your i me my who whom which what when where why how than then so such into also up out more less fewer least than ' +
    'after before while during per via just very s each other another its own same too much many own via upon onto off ' +
    'program' /* generic in most source sets; kept low-weight by IDF anyway */).split(/\s+/));
  STOP.delete('program');

  const NUMWORDS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
    nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
    hundred: 100, thousand: 1000, dozen: 12 };

  const L = s => s.split('|').map(p => p.split(' '));
  const ABSOLUTE = L('all|every|everyone|everybody|everything|always|never|none|nobody|no one|nothing|only|entire|entirely|' +
    'completely|totally|fully|guaranteed|guarantees|guarantee|certainly|definitely|unanimous|unanimously|sole|solely|any|' +
    'whole|universal|automatically|immediately|first|largest|biggest|highest|lowest|record');
  const RESTRICT = L('eligible|qualifying|qualified|some|certain|selected|select|most|many|several|majority|few|part|partly|partially|limited');
  const HEDGE = L('may|might|could|would|possibly|potentially|likely|probably|expected|expects|estimated|estimates|projected|' +
    'proposed|planned|plans to|aims to|intends to|hopes to|preliminary|tentative|tentatively|considering|appears|suggests');
  const HEDGE_ANY = new Set(['can', 'may', 'might', 'could', 'would', 'possibly', 'potentially', 'likely', 'probably', 'expected',
    'expects', 'estimated', 'projected', 'proposed', 'planned', 'plans', 'aims', 'intends', 'hopes', 'preliminary', 'tentative']);
  const APPROX = L('about|around|approximately|roughly|nearly|almost|up to|as many as|as much as|as few as|at least|at most|' +
    'more than|less than|fewer than|over|under|an estimated|close to|upwards of|no more than|no less than|a maximum of|a minimum of');
  const CONDITION = L('until|unless|if|provided|as long as|subject to|only if|depending on|except|excluding|while funds last|while supplies last');
  const ATTRIB = L('said|says|say|according to|claimed|claims|alleged|alleges|allegedly|reported|reportedly|told|stated|states|' +
    'argued|argues|believes|announced|wrote|testified|estimated by');
  const NEG = new Set(['not', 'no', 'never', 'none', 'nobody', 'nothing', 'neither', 'nor', 'without', 'cannot']);
  const EXCLUDE = new Set([...STOP]);
  [ABSOLUTE, RESTRICT, HEDGE, APPROX, CONDITION, ATTRIB].forEach(list => list.forEach(p => p.forEach(w => EXCLUDE.add(w))));
  NEG.forEach(w => EXCLUDE.add(w));
  EXCLUDE.add('can');

  const ABBR = new Set(['mr', 'mrs', 'ms', 'dr', 'st', 'jr', 'sr', 'inc', 'ltd', 'co', 'corp', 'no', 'vs', 'etc', 'gov', 'sen', 'rep',
    'prof', 'gen', 'lt', 'col', 'sgt', 'ave', 'blvd', 'rd', 'mt', 'ft', 'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep',
    'sept', 'oct', 'nov', 'dec', 'a.m', 'p.m', 'e.g', 'i.e', 'u.s']);

  /* ---------- text basics ---------- */
  function splitSentences(text) {
    const out = [];
    const lineRe = /[^\n]+/g;
    let m;
    while ((m = lineRe.exec(text))) {
      const line = m[0], base = m.index;
      let segStart = 0;
      const endRe = /[.!?]+["”’)\]]*(?=\s+["“‘(]?[A-Z0-9$])/g;
      let e;
      while ((e = endRe.exec(line))) {
        const before = line.slice(0, e.index);
        const word = (before.match(/([A-Za-z.]+)$/) || [''])[0].toLowerCase();
        if (e[0][0] === '.' && (ABBR.has(word) || /^[a-z]$/.test(word) || /(^|\.)[a-z]\.[a-z]$/.test(word))) continue;
        pushSeg(segStart, e.index + e[0].length);
        segStart = e.index + e[0].length;
      }
      pushSeg(segStart, line.length);
      function pushSeg(s, en) {
        const raw = line.slice(s, en);
        const lead = raw.length - raw.trimStart().length;
        const t = raw.trim();
        if (t) out.push({ text: t, start: base + s + lead, end: base + s + lead + t.length });
      }
    }
    return out;
  }

  function stem(w) {
    if (w.length > 4 && w.endsWith('ies')) w = w.slice(0, -3) + 'y';
    else if (w.length > 4 && /(ss|x|z|ch|sh)es$/.test(w)) w = w.slice(0, -2);
    else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is')) w = w.slice(0, -1);
    if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
    else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);
    else if (w.length > 5 && w.endsWith('ly')) w = w.slice(0, -2);
    if (w.length > 3 && w.endsWith('e')) w = w.slice(0, -1);
    return w;
  }

  const TOKEN_RE = /\$?\d+(?:,\d{3})*(?:\.\d+)?%?(?:-\d+)?|[A-Za-zÀ-ÖØ-öø-ÿ]+(?:['’][A-Za-z]+)*(?:-[A-Za-z]+)*/g;
  function tokenize(text) {
    const toks = [];
    let m;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(text))) {
      const raw = m[0];
      let lower = raw.toLowerCase().replace(/’/g, "'").replace(/'s$/, '');
      const isDigit = /^\$?\d/.test(raw);
      const isNum = isDigit || Object.prototype.hasOwnProperty.call(NUMWORDS, lower);
      const val = isDigit ? raw.replace(/[$,]/g, '') : (isNum ? String(NUMWORDS[lower]) : null);
      const neg = NEG.has(lower) || /n't$/.test(lower);
      toks.push({ raw, lower, start: m.index, end: m.index + raw.length, isNum, val, money: raw[0] === '$', neg,
        cap: /^[A-Z]/.test(raw), first: toks.length === 0 });
    }
    toks.forEach((t, i) => {
      t.i = i;
      const next = toks[i + 1];
      t.name = !t.isNum && t.cap && !STOP.has(t.lower) && (!t.first || (next && next.cap && !next.isNum));
      // A number's unit is the word after it ("two years" -> year), so "2 years" never matches "March 2".
      t.unit = !t.isNum ? '' : (t.money || (next && /^dollars?$/.test(next.lower))) ? '$'
        : (next && !next.isNum && !STOP.has(next.lower) ? stem(next.lower) : '');
      t.term = t.isNum ? 'n:' + t.val + ':' + t.unit : (EXCLUDE.has(t.lower) || t.lower.length < 2 ? null : stem(t.lower));
    });
    return toks;
  }

  function quoteRanges(text) {
    const out = [];
    const re = /["“]([^"”]{3,}?)[,.!?]?["”]/g;
    let m;
    while ((m = re.exec(text))) out.push({ start: m.index, end: m.index + m[0].length, inner: m[1] });
    return out;
  }

  function findPhrases(toks, list) {
    const hits = [];
    for (let i = 0; i < toks.length; i++) {
      for (const p of list) {
        if (i + p.length > toks.length) continue;
        let ok = true;
        for (let k = 0; k < p.length; k++) if (toks[i + k].lower !== p[k]) { ok = false; break; }
        if (ok) hits.push({ i, j: i + p.length - 1, phrase: p.join(' ') });
      }
    }
    return hits;
  }

  /* ---------- index over source sentences ---------- */
  function buildIndex(sources) {
    const sents = [];
    sources.forEach((src, sIdx) => {
      splitSentences(src.text || '').forEach((s, k) => {
        sents.push({ id: src.id + ':' + k, srcId: src.id, srcIdx: sIdx, title: src.title || ('Source ' + (sIdx + 1)), text: s.text, toks: tokenize(s.text) });
      });
    });
    const df = new Map();
    sents.forEach(s => new Set(s.toks.map(t => t.term).filter(Boolean)).forEach(term => df.set(term, (df.get(term) || 0) + 1)));
    const byId = new Map(sents.map(s => [s.id, s]));
    const allText = norm(sources.map(s => s.text || '').join(' \n '));
    return { sents, df, N: Math.max(1, sents.length), byId, allText, sources };
  }

  function weights(toks, idx) {
    const w = new Map();
    toks.forEach(t => {
      if (!t.term) return;
      let v = Math.log(1 + idx.N / (1 + (idx.df.get(t.term) || 0)));
      if (t.isNum) v *= 2; else if (t.name) v *= 1.5;
      w.set(t.term, Math.max(w.get(t.term) || 0, v));
    });
    return w;
  }

  function match(toks, idx) {
    const w = weights(toks, idx);
    const total = [...w.values()].reduce((a, b) => a + b, 0) || 1;
    const uncovered = new Set(w.keys());
    const chosen = [];
    while (chosen.length < 3) {
      let best = null, bestGain = 0;
      for (const s of idx.sents) {
        if (chosen.includes(s)) continue;
        const terms = new Set(s.toks.map(t => t.term));
        let g = 0;
        uncovered.forEach(term => { if (terms.has(term)) g += w.get(term); });
        if (g > bestGain + 1e-9) { best = s; bestGain = g; }
      }
      if (!best || bestGain <= 0) break;
      const addsNumber = best.toks.some(t => t.isNum && uncovered.has(t.term));
      if (chosen.length && bestGain < 0.15 * total && !addsNumber) break;
      chosen.push(best);
      best.toks.forEach(t => uncovered.delete(t.term));
    }
    let left = 0; uncovered.forEach(term => { left += w.get(term); });
    const coverage = (total - left) / total;
    chosen.sort((a, b) => a.srcIdx - b.srcIdx || idx.sents.indexOf(a) - idx.sents.indexOf(b));
    return { ids: chosen.map(s => s.id), coverage, weak: !chosen.length || coverage < 0.35 };
  }

  function coverageOf(toks, idx, ids) {
    const w = weights(toks, idx);
    const total = [...w.values()].reduce((a, b) => a + b, 0) || 1;
    const terms = new Set();
    ids.forEach(id => { const s = idx.byId.get(id); if (s) s.toks.forEach(t => terms.add(t.term)); });
    let got = 0; w.forEach((v, term) => { if (terms.has(term)) got += v; });
    return got / total;
  }

  function norm(s) { return s.toLowerCase().replace(/[“”"‘’']/g, '').replace(/[^a-z0-9$%]+/g, ' ').trim(); }

  /* ---------- flags ---------- */
  function analyze(text, idx, evidenceIds) {
    const toks = tokenize(text);
    let m = evidenceIds ? { ids: evidenceIds.filter(id => idx.byId.has(id)), coverage: 0, weak: false } : match(toks, idx);
    if (evidenceIds) { m.coverage = coverageOf(toks, idx, m.ids); m.weak = !m.ids.length || m.coverage < 0.35; }
    const ev = m.ids.map(id => idx.byId.get(id));
    const flags = [];
    let nextId = 0;
    const newId = () => nextId++;
    // Marks are [start, end, class, flagId]; a flag and every word it points at share one id.
    const claimMarks = [];
    const evMarks = new Map(ev.map(s => [s.id, []]));
    const markEv = (s, a, b, cls, f) => evMarks.get(s.id).push([s.toks[a].start, s.toks[b].end, cls, f]);
    const flag = (f, id) => { f.id = id; flags.push(f); };
    const q = s => '“' + s + '”';

    const quotes = quoteRanges(text);
    const inQuote = t => quotes.some(r => t.start >= r.start && t.end <= r.end);
    const evQuotes = new Map(ev.map(s => [s.id, quoteRanges(s.text)]));
    const inEvQuote = (s, t) => evQuotes.get(s.id).some(r => t.start >= r.start && t.end <= r.end);

    const claimTerms = new Set(toks.map(t => t.term).filter(Boolean));
    const claimLower = new Set(toks.map(t => t.lower));
    const claimVals = new Set(toks.filter(t => t.isNum).map(t => t.val));
    const evLower = new Set(), evVals = new Set(), evTerms = new Set();
    ev.forEach(s => s.toks.forEach(t => { evLower.add(t.lower); evTerms.add(t.term); if (t.isNum) evVals.add(t.val); }));
    const shared = new Map(ev.map(s => [s.id, s.toks.filter(t => t.term && claimTerms.has(t.term)).map(t => t.i)]));
    ev.forEach(s => shared.get(s.id).forEach(i => markEv(s, i, i, 'shared')));
    const near = (s, h, W = 4) => shared.get(s.id).some(k => k >= h.i - W && k <= h.j + W);
    const elsewhere = pred => idx.sents.find(s => !m.ids.includes(s.id) && s.toks.some(pred));

    // Quotes must match a source word for word.
    quotes.forEach(r => {
      if (idx.allText.includes(norm(r.inner))) return;
      const id = newId();
      const best = closestQuote(r.inner, idx);
      claimMarks.push([r.start, r.end, 'm-strong', id]);
      if (best && evMarks.has(best.sentId)) evMarks.get(best.sentId).push([best.start, best.end, 'm-strong', id]);
      flag({ sev: 'strong', kind: 'quote', title: 'The quote doesn’t match the source word for word.',
        why: best ? 'Closest quote in ' + best.title + ': ' + q(best.text) : 'No quote in the sources is close to it.' }, id);
    });

    // Numbers.
    const pairedEvVals = new Set();
    toks.filter(t => t.isNum && !inQuote(t)).forEach(t => {
      if (evVals.has(t.val)) return;
      const id = newId();
      const differs = !m.weak && ev.flatMap(s => s.toks).find(e => e.isNum && e.unit && e.unit === t.unit && !claimVals.has(e.val));
      claimMarks.push([t.start, t.end, 'm-strong', id]);
      if (differs) {
        pairedEvVals.add(differs.val);
        const s = ev.find(x => x.toks.includes(differs));
        markEv(s, differs.i, Math.min(differs.i + 1, s.toks.length - 1), 'm-strong', id);
        flag({ sev: 'strong', kind: 'number', title: 'The draft says ' + q(phraseAt(toks, t)) + '. The source says ' + q(phraseAt(s.toks, differs)) + '.',
          why: 'A number changed between the source and the draft.' }, id);
        return;
      }
      const other = elsewhere(e => e.isNum && e.val === t.val);
      flag(other
        ? { sev: 'soft', kind: 'number', title: q(t.raw) + ' isn’t in the matched passage.', why: 'It appears in ' + other.title + ': ' + q(other.text) + ' Add that passage if it supports the claim.' }
        : { sev: 'strong', kind: 'number', title: q(t.raw) + ' doesn’t appear in any source.', why: 'Find where this number comes from, or cut it.' }, id);
    });

    // Names.
    toks.filter(t => t.name && !inQuote(t) && !evTerms.has(t.term)).forEach(t => {
      const id = newId();
      const other = elsewhere(e => e.term === t.term);
      claimMarks.push([t.start, t.end, other ? 'm-soft' : 'm-strong', id]);
      flag(other
        ? { sev: 'soft', kind: 'name', title: q(t.raw) + ' isn’t in the matched passage.', why: 'It appears in ' + other.title + '. Add that passage if it supports the claim.' }
        : { sev: 'strong', kind: 'name', title: q(t.raw) + ' doesn’t appear in any source.', why: 'Check the name against a source before it runs.' }, id);
    });

    if (m.weak) {
      flags.unshift({ id: newId(), sev: 'strong', kind: 'weak', title: 'No source passage clearly supports this.',
        why: ev.length ? 'The closest passage shares only a few words. Pick a passage by hand, add a source, or open a check.' : 'Add a source, pick a passage by hand, or open a check.' });
      return { evidence: m.ids, coverage: m.coverage, weak: true, flags, claimMarks, evMarks };
    }

    // Detail the source has that the draft drops (numbers next to shared words).
    const extras = [];
    ev.forEach(s => s.toks.forEach(e => {
      if (e.isNum && !claimVals.has(e.val) && !pairedEvVals.has(e.val) && near(s, { i: e.i, j: e.i })) extras.push({ s, e, close: near(s, { i: e.i, j: e.i }, 2) });
    }));

    // Absolutes the source doesn't use.
    findPhrases(toks, ABSOLUTE).forEach(h => {
      const t = toks[h.i];
      if (inQuote(t) || h.phrase.split(' ').every(w => evLower.has(w))) return;
      const id = newId();
      claimMarks.push([toks[h.i].start, toks[h.j].end, 'm-strong', id]);
      const counter = [];
      ev.forEach(s => findPhrases(s.toks, RESTRICT).forEach(r => {
        if (!claimLower.has(r.phrase)) { counter.push(r.phrase); markEv(s, r.i, r.j, 'm-soft', id); }
      }));
      extras.forEach(x => { counter.push(phraseAt(x.s.toks, x.e)); markEv(x.s, x.e.i, Math.min(x.e.i + 1, x.s.toks.length - 1), 'm-soft', id); });
      const uniq = [...new Set(counter)];
      flag({ sev: 'strong', kind: 'absolute', title: 'The draft says ' + q(h.phrase) + '. The source doesn’t.',
        why: (uniq.length ? 'The source says ' + uniq.map(q).join(', ') + '. ' : '') + 'Absolute words make a claim broader than its source.' }, id);
    });

    // Limits on numbers the draft drops ("about 80", "up to $5,000").
    ev.forEach(s => findPhrases(s.toks, APPROX).forEach(h => {
      const num = s.toks[h.j + 1];
      if (!num || !num.isNum || !claimVals.has(num.val)) return;
      const ct = toks.find(t => t.isNum && t.val === num.val);
      const before = toks.slice(Math.max(0, ct.i - 3), ct.i).map(t => t.lower).join(' ');
      if ((' ' + before + ' ').includes(' ' + h.phrase + ' ')) return;
      const id = newId();
      markEv(s, h.i, h.j + 1, 'm-soft', id);
      claimMarks.push([ct.start, ct.end, 'm-soft', id]);
      flag({ sev: 'soft', kind: 'approx', title: 'The source says ' + q(s.toks.slice(h.i, h.j + 2).map(t => t.raw).join(' ')) + '. The draft says ' + q(ct.raw) + '.',
        why: h.phrase === 'up to' || h.phrase === 'as much as' || h.phrase === 'as many as' ? 'Dropping ' + q(h.phrase) + ' turns a maximum into a promise.' : 'Dropping ' + q(h.phrase) + ' turns an estimate or a limit into an exact figure.' }, id);
    }));

    // Hedges the draft drops.
    if (!toks.some(t => HEDGE_ANY.has(t.lower))) {
      const seen = new Set(), id = newId();
      ev.forEach(s => findPhrases(s.toks, HEDGE).forEach(h => {
        if (!near(s, h) || seen.has(h.phrase)) return;
        seen.add(h.phrase); markEv(s, h.i, h.j, 'm-soft', id);
      }));
      if (seen.size) flag({ sev: 'soft', kind: 'hedge', title: 'The source is more careful: ' + [...seen].map(q).join(', ') + '.',
        why: 'The draft states as certain what the source qualifies.' }, id);
    }

    // Conditions the draft drops.
    ev.forEach(s => findPhrases(s.toks, CONDITION).forEach(h => {
      if (!near(s, h) || h.phrase.split(' ').every(w => claimLower.has(w))) return;
      let j = h.j;
      while (j + 1 < s.toks.length && j - h.i < 8 && !/[,;:.]/.test(s.text.slice(s.toks[j].end, s.toks[j + 1].start))) j++;
      const id = newId();
      markEv(s, h.i, j, 'm-soft', id);
      flag({ sev: 'soft', kind: 'condition', title: 'The source adds a condition: ' + q(s.text.slice(s.toks[h.i].start, s.toks[j].end)) + '.',
        why: 'The draft leaves it out.' }, id);
    }));

    // Attribution the draft drops.
    if (!findPhrases(toks, ATTRIB).length) {
      ev.forEach(s => findPhrases(s.toks, ATTRIB).forEach(h => {
        if (!near(s, h, 6)) return;
        const id = newId();
        markEv(s, h.i, h.j, 'm-soft', id);
        flag({ sev: 'soft', kind: 'attrib', title: 'The source attributes this: ' + q(h.phrase) + '.',
          why: 'The draft states it as fact. Keep the attribution or confirm it independently.' }, id);
      }));
    }

    // Negation differs.
    const claimNeg = toks.some(t => t.neg && !inQuote(t));
    const evNeg = ev.some(s => s.toks.some(t => t.neg && !inEvQuote(s, t) && near(s, { i: t.i, j: t.i })));
    if (claimNeg !== evNeg) flag({ sev: 'soft', kind: 'negation',
      title: claimNeg ? 'The draft has a “not” or “no” the source doesn’t.' : 'The source has a “not” or “no” here. The draft doesn’t.',
      why: 'Check that the meaning didn’t flip.' }, newId());

    // Leftover detail, when no absolute flag already showed it.
    const closeExtras = extras.filter(x => x.close);
    if (closeExtras.length && !flags.some(f => f.kind === 'absolute')) {
      const id = newId();
      closeExtras.forEach(x => markEv(x.s, x.e.i, Math.min(x.e.i + 1, x.s.toks.length - 1), 'm-soft', id));
      flag({ sev: 'soft', kind: 'detail', title: 'The source includes ' + [...new Set(closeExtras.map(x => q(phraseAt(x.s.toks, x.e))))].join(', ') + '. The draft leaves it out.',
        why: 'Check the draft hasn’t simplified away something that matters.' }, id);
    }

    flags.sort((a, b) => (a.sev === b.sev ? a.id - b.id : a.sev === 'strong' ? -1 : 1));
    return { evidence: m.ids, coverage: m.coverage, weak: false, flags, claimMarks, evMarks };
  }

  // Source sentences around the evidence, grouped by document, for the source clipping.
  function context(idx, ids, whole) {
    const bySrc = new Map();
    ids.forEach(id => {
      const s = idx.byId.get(id); if (!s) return;
      const k = Number(id.slice(id.lastIndexOf(':') + 1));
      if (!bySrc.has(s.srcId)) bySrc.set(s.srcId, { srcId: s.srcId, title: s.title, srcIdx: s.srcIdx, ev: new Set(), rows: new Set() });
      const g = bySrc.get(s.srcId);
      g.ev.add(k);
      [k - 1, k, k + 1].forEach(j => { if (idx.byId.has(s.srcId + ':' + j)) g.rows.add(j); });
    });
    return [...bySrc.values()].sort((a, b) => a.srcIdx - b.srcIdx).map(g => {
      const all = idx.sents.filter(s => s.srcId === g.srcId);
      const rows = whole ? all.map((s, j) => j) : [...g.rows].sort((a, b) => a - b);
      return { srcId: g.srcId, title: g.title, srcIdx: g.srcIdx, total: all.length,
        rows: rows.map(j => ({ id: g.srcId + ':' + j, n: j + 1, text: idx.byId.get(g.srcId + ':' + j).text, ev: g.ev.has(j) })) };
    });
  }

  function phraseAt(toks, t) {
    const next = toks[t.i + 1];
    return next && !next.isNum && t.unit && t.unit !== '$' ? t.raw + ' ' + next.raw : t.raw;
  }

  function closestQuote(inner, idx) {
    const target = new Set(norm(inner).split(' '));
    let best = null, score = 0;
    idx.sents.forEach(s => {
      const re = /["“]([^"”]{3,}?)[,.!?]?["”]/g;
      let m;
      while ((m = re.exec(s.text))) {
        const words = norm(m[1]).split(' ');
        const sc = words.filter(w => target.has(w)).length / Math.max(words.length, target.size);
        if (sc > score) { score = sc; best = { title: s.title, text: m[1], sentId: s.id, start: m.index, end: m.index + m[0].length }; }
      }
    });
    return score > 0.3 ? best : null;
  }

  /* ---------- word diff for tracked changes ---------- */
  // Word-level diff. Each changed stretch comes out as one deletion followed by one insertion,
  // so tracked changes read like an editor's markup instead of alternating single words.
  function diffWords(a, b) {
    const A = a.trim().split(/\s+/).filter(Boolean), B = b.trim().split(/\s+/).filter(Boolean);
    const n = A.length, m = B.length;
    const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const ops = [];
    let del = [], ins = [];
    const flush = () => {
      if (del.length) ops.push({ t: 'del', s: del.join(' ') });
      if (ins.length) ops.push({ t: 'ins', s: ins.join(' ') });
      del = []; ins = [];
    };
    let i = 0, j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && A[i] === B[j]) { flush(); ops.push({ t: 'eq', s: A[i] }); i++; j++; }
      else if (j >= m || (i < n && dp[i + 1][j] >= dp[i][j + 1])) del.push(A[i++]);
      else ins.push(B[j++]);
    }
    flush();
    // Join with single spaces: every op is a run of words.
    return ops.map((o, k) => ({ t: o.t, s: (k ? ' ' : '') + o.s }));
  }

  return { splitSentences, tokenize, buildIndex, analyze, context, diffWords };
})();
