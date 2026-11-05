/* Paper Trail app: state, practice story, helpers and the setup step. */
const STORE_KEY = 'papertrail.v1';
const NAME_KEY = 'papertrail.reviewer';
const COACH_KEY = 'papertrail.coach';
const $ = (sel, el = document) => el.querySelector(sel);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
const FRAMED = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();

const ICON = {
  check: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5"/></svg>',
  pencil: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M10.5 2.5l3 3L6 13H3v-3z"/><path d="M9 4l3 3"/></svg>',
  ask: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M6.3 6.3a1.8 1.8 0 113 1.4c-.7.4-1.3.8-1.3 1.6M8 11.3v.2"/></svg>',
  minus: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 8h8"/></svg>',
  lock: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 015 0v2"/></svg>',
  prev: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3.5L5.5 8l4.5 4.5"/></svg>',
  next: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3.5L10.5 8 6 12.5"/></svg>',
  arrow: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>'
};

const STATUS = {
  unreviewed: { label: 'Not checked', icon: '' },
  supported: { label: 'Supported', icon: ICON.check },
  fixed: { label: 'Fixed', icon: ICON.pencil },
  open: { label: 'Needs a check', icon: ICON.ask },
  cut: { label: 'Cut', icon: ICON.minus },
  notclaim: { label: 'Not a claim', icon: ICON.minus }
};

// Stored value is the phrase the reader note uses; the label reads inside "This draft was ___".
const PURPOSES = [
  { v: 'summarize source documents', l: 'summarized from its sources' },
  { v: 'draft parts of the text', l: 'partly drafted' },
  { v: 'translate source material', l: 'translated from its sources' },
  { v: 'suggest edits', l: 'edited' }
];

/* ---------- practice story (fictional) ---------- */
const DEMO = {
  slug: 'Millbrook small business grants',
  aiTool: 'a chatbot',
  aiPurpose: PURPOSES[0].v,
  draft: 'Millbrook will give all small businesses $5,000 grants starting April 7. The city has set aside $400,000 for the program, enough to fund 80 grants. Businesses must have been operating for at least two years to qualify. Applications will be reviewed in the order they are received. City council unanimously approved the program on March 2. Council member Dana Ruiz said the program “should help businesses that have not received other relief.” The program is expected to create 200 jobs. Grants can be used for rent, equipment or repairs.',
  sources: [
    { title: 'City of Millbrook news release, March 3', text: 'The City of Millbrook will open applications for the Small Business Recovery Grant on April 7. Eligible applicants may receive up to $5,000 to cover rent, equipment or repairs. To be eligible, a business must be located within city limits, have fewer than 20 employees, and have been operating for at least one year. The city has set aside $400,000 for the program, which is expected to fund about 80 grants. Applications will be reviewed in the order they are received until funds run out.' },
    { title: 'City council minutes, March 2', text: 'The program was approved by city council on March 2 by a 5-2 vote. Council member Dana Ruiz, who voted against it, said the program “should prioritize businesses that have not received other relief.” Council member Omar Bell said the grants “will help the businesses that were hit hardest.”' }
  ]
};
/* A finished review of the practice story, for "See a finished review". */
const DEMO_DONE = [
  { status: 'fixed', text: 'Eligible Millbrook businesses can apply for grants of up to $5,000 starting April 7.' },
  { status: 'fixed', text: 'The city has set aside $400,000 for the program, which it expects will fund about 80 grants.' },
  { status: 'fixed', text: 'Businesses must have been operating for at least one year to qualify.' },
  { status: 'fixed', text: 'Applications will be reviewed in the order they are received until funds run out.' },
  { status: 'fixed', text: 'City council approved the program 5-2 on March 2.' },
  { status: 'fixed', text: 'Council member Dana Ruiz, who voted against it, said the program “should prioritize businesses that have not received other relief.”' },
  { status: 'open', task: { what: 'Find the source for the 200-jobs estimate, or cut the sentence.', who: 'Reporter (J. Park)', due: 'Before publishing', hold: true, second: false } },
  { status: 'supported' }
];

/* ---------- state ---------- */
let S = blank();
let IDX = null;            // engine index over the current sources
let ui = { claim: 0, mode: null, exportTab: 'clean', picker: false, whole: false, omitOpen: false, pop: -1, thunk: false };

function blank() {
  return { v: 1, slug: '', aiTool: '', aiPurpose: PURPOSES[0].v, draft: '', sources: [{ id: uid(), title: '', text: '' }], claims: [], step: 'setup', analyzedAt: null };
}
function reviewer() { return ($('#reviewer').value || '').trim(); }

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* storage blocked: the session still works */ }
}
function load() {
  try { const raw = localStorage.getItem(STORE_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}

function analyzeAll(keepDecisions) {
  IDX = PT.buildIndex(S.sources);
  const sents = PT.splitSentences(S.draft);
  S.claims = sents.map((s, i) => {
    const prev = keepDecisions && S.claims[i] && S.claims[i].original === s.text ? S.claims[i] : null;
    const c = prev || { id: uid(), original: s.text, text: s.text, status: 'unreviewed', evidence: null, note: '', task: null, by: '', at: null };
    c.para = S.draft.slice(0, s.start).split(/\n\s*\n|\n/).length - 1;
    return c;
  });
  S.analyzedAt = new Date().toISOString();
  S.analyzedDraft = S.draft;
  S.sourcesSig = JSON.stringify(S.sources.map(s => s.text));
}
function result(c) {
  if (!IDX) IDX = PT.buildIndex(S.sources);
  return PT.analyze(c.text, IDX, c.evidence);
}

function loadDemo(done) {
  S = blank();
  S.practice = true;
  S.slug = DEMO.slug; S.aiTool = DEMO.aiTool; S.aiPurpose = DEMO.aiPurpose; S.draft = DEMO.draft;
  S.sources = DEMO.sources.map(s => ({ id: uid(), title: s.title, text: s.text }));
  analyzeAll(false);
  if (done) {
    const who = reviewer() || 'A. Editor';
    S.claims.forEach((c, i) => {
      const d = DEMO_DONE[i]; if (!d) return;
      c.status = d.status; if (d.text) c.text = d.text; if (d.task) c.task = Object.assign({}, d.task);
      c.by = who; c.at = new Date().toISOString();
    });
  }
  S.step = done ? 'export' : 'review';
  ui.claim = 0; ui.mode = null; ui.picker = false; ui.whole = false;
  save();
}

/* ---------- small UI helpers ---------- */
function say(msg) { $('#live').textContent = msg; toast(msg); }
let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}
function ask(title, body, okLabel) {
  return new Promise(resolve => {
    const m = $('#modal');
    $('#modalTitle').textContent = title; $('#modalBody').textContent = body; $('#modalOk').textContent = okLabel || 'Continue';
    m.hidden = false; $('#modalOk').focus();
    const done = v => { m.hidden = true; $('#modalOk').onclick = $('#modalCancel').onclick = null; document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = e => { if (e.key === 'Escape') done(false); };
    $('#modalOk').onclick = () => done(true); $('#modalCancel').onclick = () => done(false);
    document.addEventListener('keydown', onKey);
  });
}
async function copyText(text, what) {
  try { await navigator.clipboard.writeText(text); say(what + ' copied.'); }
  catch (e) {
    const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (x) { ok = false; }
    ta.remove(); say(ok ? what + ' copied.' : 'Copy was blocked. Select the text and copy it by hand.');
  }
}
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
}
function fileSlug() { return (S.slug || 'review').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'review'; }

/* Wrap [start, end, class, flagId] ranges of text in marks; a flag's marks carry its id for hover linking. */
function marked(text, ranges) {
  const rs = (ranges || []).filter(r => r[1] > r[0]).sort((a, b) => a[0] - b[0] || (b[1] - b[0]) - (a[1] - a[0]));
  const pri = c => (c === 'shared' ? 0 : c === 'm-soft' ? 1 : 2);
  const kept = [];
  rs.forEach(r => {
    const clash = kept.findIndex(k => r[0] < k[1] && r[1] > k[0]);
    if (clash < 0) kept.push(r);
    else if (pri(r[2]) > pri(kept[clash][2])) kept.splice(clash, 1, r);
  });
  kept.sort((a, b) => a[0] - b[0]);
  let out = '', pos = 0;
  kept.forEach(([s, e, c, f]) => {
    if (s < pos) return;
    out += esc(text.slice(pos, s));
    out += c === 'shared' ? '<span class="shared">' + esc(text.slice(s, e)) + '</span>'
      : '<mark class="' + c + '"' + (f != null ? ' data-f="' + f + '"' : '') + '>' + esc(text.slice(s, e)) + '</mark>';
    pos = e;
  });
  return out + esc(text.slice(pos));
}
function chip(status) { const s = STATUS[status]; return '<span class="chip ' + status + '">' + s.icon + esc(s.label) + '</span>'; }
function counts() {
  const c = { unreviewed: 0, supported: 0, fixed: 0, open: 0, cut: 0, notclaim: 0 };
  S.claims.forEach(x => { c[x.status]++; });
  return c;
}

/* ---------- step 1: copy and sources ---------- */
function viewSetup() {
  const ready = S.draft.trim() && S.sources.some(s => s.text.trim());
  return `
  <div class="setup">
    <div class="setup-intro">
      <h1 id="stepTitle" tabindex="-1">Check AI-assisted copy against its sources</h1>
      <p>Paste the draft an AI tool wrote or summarized, and the documents it came from. Paper Trail splits the draft into claims and shows each one beside the source passage that should back it up.</p>
    </div>
    <section class="practice" aria-label="Practice story">
      <span class="eyebrow">Practice</span>
      <p>A city grant story. A chatbot summarized two documents, and seven of its eight claims are off in ways that are easy to miss.</p>
      <div class="actions">
        <button class="btn" type="button" data-act="demo">Open the practice story</button>
        <button class="btn alt" type="button" data-act="demo-done">See a finished review</button>
      </div>
    </section>
    <div class="setup-grid">
      <section class="sheet manuscript" aria-label="AI-assisted draft">
        <div class="slug-row"><label class="eyebrow" for="slug">Slug</label><input id="slug" value="${esc(S.slug)}" placeholder="School board budget"></div>
        <label class="sr-only" for="draft">AI-assisted draft</label>
        <textarea id="draft" placeholder="Paste the AI-assisted draft here.">${esc(S.draft)}</textarea>
        <p class="madlib">This draft was
          <label class="sr-only" for="aiPurpose">How AI was used</label><select id="aiPurpose">${PURPOSES.map(p => `<option value="${esc(p.v)}"${p.v === S.aiPurpose ? ' selected' : ''}>${esc(p.l)}</option>`).join('')}</select>
          using <label class="sr-only" for="aiTool">AI tool</label><input id="aiTool" value="${esc(S.aiTool)}" placeholder="ChatGPT">.</p>
      </section>
      <section class="sources" aria-label="Sources">
        ${S.sources.map((s, i) => `
        <div class="sheet src-sheet" data-src="${s.id}">
          <div class="src-head">
            <span class="eyebrow">Source ${i + 1}</span>
            <label class="sr-only" for="st-${s.id}">Source ${i + 1} name</label>
            <input id="st-${s.id}" data-field="title" value="${esc(s.title)}" placeholder="Name and date, e.g. Council minutes, March 2">
            ${S.sources.length > 1 ? `<button class="btn btn-quiet btn-sm" type="button" data-act="rm-src" data-id="${s.id}" aria-label="Remove source ${i + 1}">Remove</button>` : ''}
          </div>
          <label class="sr-only" for="sx-${s.id}">Source ${i + 1} text</label>
          <textarea id="sx-${s.id}" data-field="text" placeholder="Paste the source text: a news release, minutes, a report.">${esc(s.text)}</textarea>
        </div>`).join('')}
        <div class="src-tools">
          <button class="btn btn-sm" type="button" data-act="add-src">Add a source</button>
          <label class="btn btn-quiet btn-sm" for="srcFile">Add a .txt file</label>
          <input type="file" id="srcFile" accept=".txt,.md,text/plain" hidden>
        </div>
      </section>
    </div>
    <div class="go-row">
      <button class="btn btn-primary" type="button" data-act="analyze" ${ready ? '' : 'disabled'}>Find the claims ${ICON.arrow}</button>
      <span class="privacy">${ICON.lock}<span>What you paste stays in this browser tab. Nothing is uploaded or sent to an AI service.</span></span>
      ${S.draft.trim() || S.claims.length ? '<button class="btn btn-quiet btn-sm" type="button" data-act="fresh">Clear and start over</button>' : ''}
    </div>
  </div>`;
}

function bindSetup() {
  const main = $('#main');
  const refreshReady = () => {
    const ready = S.draft.trim() && S.sources.some(s => s.text.trim());
    const b = $('[data-act="analyze"]', main); if (b) b.disabled = !ready;
  };
  main.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'slug') S.slug = t.value;
    else if (t.id === 'draft') S.draft = t.value;
    else if (t.id === 'aiTool') S.aiTool = t.value;
    else if (t.dataset.field) {
      const src = S.sources.find(s => s.id === t.closest('[data-src]').dataset.src);
      if (src) src[t.dataset.field] = t.value;
    }
    else return;
    refreshReady(); save();
  });
  main.addEventListener('change', e => {
    if (e.target.id === 'aiPurpose') { S.aiPurpose = e.target.value; save(); }
    if (e.target.id === 'srcFile' && e.target.files[0]) {
      const f = e.target.files[0];
      const r = new FileReader();
      r.onload = () => {
        const empty = S.sources.find(s => !s.text.trim());
        const src = empty || { id: uid(), title: '', text: '' };
        src.title = src.title || f.name.replace(/\.[^.]+$/, ''); src.text = String(r.result);
        if (!empty) S.sources.push(src);
        save(); render(); say('Added ' + f.name + '.');
      };
      r.readAsText(f);
    }
  });
}
