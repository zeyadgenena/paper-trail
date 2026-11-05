/* Rendering, events and start-up. */
function render(focus) {
  document.querySelectorAll('#steps button').forEach(b => {
    const st = b.dataset.step;
    b.setAttribute('aria-current', st === S.step ? 'step' : 'false');
    b.disabled = st !== 'setup' && !S.claims.length;
  });
  const main = $('#main');
  main.innerHTML = S.step === 'setup' ? viewSetup() : S.step === 'review' ? viewReview() : viewExport();
  const focusEl = {
    step: () => $('#stepTitle') || $('#claimTitle'),
    claim: () => $('#claimTitle'),
    fix: () => $('#fixText'),
    open: () => $('#tWhat'),
    picker: () => $('#pickSearch')
  }[focus];
  const el = focusEl && focusEl();
  if (el) {
    el.focus({ preventScroll: true });
    const r = el.getBoundingClientRect();
    if (r.top < 70 || r.bottom > window.innerHeight) el.scrollIntoView({ block: 'start' });
  }
  if (focus === 'step') window.scrollTo(0, 0);
}

function sourcesSig() { return JSON.stringify(S.sources.map(s => s.text)); }
function stale() { return S.draft !== S.analyzedDraft || sourcesSig() !== S.sourcesSig; }

async function runAnalyze() {
  if (S.claims.some(c => c.status !== 'unreviewed')) {
    const ok = await ask('Find claims again?', 'Decisions stay on sentences you haven’t changed. Sentences you edited in the draft start over.', 'Find claims');
    if (!ok) return;
  }
  const srcChanged = sourcesSig() !== S.sourcesSig;
  analyzeAll(true);
  if (srcChanged) S.claims.forEach(c => { c.evidence = null; });
  S.practice = S.draft === DEMO.draft;
  S.step = 'review';
  ui.claim = Math.max(0, S.claims.findIndex(c => c.status === 'unreviewed'));
  ui.mode = null; ui.picker = false; ui.filter = 'all';
  save(); render('step');
  say(S.claims.length + (S.claims.length === 1 ? ' claim' : ' claims') + ' found.');
}

async function go(step) {
  if (step === S.step) return;
  if (step !== 'setup' && S.step === 'setup' && S.claims.length && stale()) return runAnalyze();
  S.step = step; ui.mode = null; ui.picker = false;
  save(); render('step');
}

async function confirmReplace() {
  const busy = S.claims.some(c => c.status !== 'unreviewed') || (S.draft.trim() && S.draft !== DEMO.draft);
  return !busy || ask('Replace your current review?', 'Loading the practice story replaces what is on screen. Save a review file first if you want to keep it.', 'Replace');
}

document.addEventListener('click', async e => {
  const t = e.target;
  const stepBtn = t.closest('#steps [data-step]');
  if (stepBtn) { if (!stepBtn.disabled) go(stepBtn.dataset.step); return; }
  const goBtn = t.closest('[data-step-go]');
  if (goBtn) { go(goBtn.dataset.stepGo); return; }
  const claimBtn = t.closest('[data-claim]');
  if (claimBtn) { ui.claim = +claimBtn.dataset.claim; ui.mode = null; ui.picker = false; render('claim'); return; }
  const filterBtn = t.closest('[data-filter]');
  if (filterBtn) { ui.filter = filterBtn.dataset.filter; render(); return; }
  const tabBtn = t.closest('[data-tab]');
  if (tabBtn) { ui.exportTab = tabBtn.dataset.tab; render(); return; }
  const a = t.closest('[data-act]');
  if (!a || !$('#main').contains(a)) return;
  const act = a.dataset.act;
  switch (act) {
    case 'demo': case 'demo-done':
      if (await confirmReplace()) { loadDemo(act === 'demo-done'); render('step'); say(act === 'demo' ? 'Practice story loaded. 8 claims to check.' : 'Finished practice review loaded.'); }
      return;
    case 'fresh':
      if (!S.claims.some(c => c.status !== 'unreviewed') || await ask('Start with your own copy?', 'This clears the practice story and its decisions.', 'Start')) {
        S = blank(); IDX = null; ui = { claim: 0, mode: null, filter: 'all', exportTab: 'clean', picker: false }; save(); render('step');
      }
      return;
    case 'add-src':
      S.sources.push({ id: uid(), title: '', text: '' }); save(); render();
      $('#st-' + S.sources[S.sources.length - 1].id).focus(); return;
    case 'rm-src': {
      const src = S.sources.find(s => s.id === a.dataset.id);
      if (src && (!src.text.trim() || await ask('Remove this source?', '“' + (src.title || 'Untitled source') + '” and its text will be removed from this review.', 'Remove'))) {
        S.sources = S.sources.filter(s => s !== src); save(); render();
      }
      return;
    }
    case 'analyze': return runAnalyze();
  }
  if (S.step === 'review') return reviewAction(act, a);
  if (S.step === 'export') return exportAction(act);
});

document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'reviewer') { try { localStorage.setItem(NAME_KEY, t.value); } catch (x) { /* name just isn't remembered */ } return; }
  if (t.id === 'note' && S.claims[ui.claim]) { S.claims[ui.claim].note = t.value; save(); return; }
  if (t.id === 'fixText') { $('#fixCheck').textContent = recheckText(t.value, S.claims[ui.claim]); return; }
  if (t.id === 'pickSearch') {
    const q = t.value.trim().toLowerCase();
    document.querySelectorAll('#pickList li').forEach(li => { li.hidden = !!q && !li.dataset.text.includes(q); });
    return;
  }
  if (t.id === 'disclosure') { S.disclosure = t.value; S.disclosureEdited = true; save(); }
});

document.addEventListener('change', e => {
  if (e.target.id === 'omitOpen') { ui.omitOpen = e.target.checked; render(); }
  if (e.target.id === 'fileInput' && e.target.files[0]) {
    const f = e.target.files[0], r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(String(r.result));
        if (data.v !== 1 || !Array.isArray(data.claims) || !Array.isArray(data.sources)) throw new Error('shape');
        S = data; IDX = null; ui.claim = 0; ui.mode = null; ui.picker = false;
        save(); render('step'); say('Opened ' + f.name + '.');
      } catch (x) { say('That file isn’t a Paper Trail review file.'); }
      e.target.value = '';
    };
    r.readAsText(f);
  }
});

document.addEventListener('keydown', e => {
  if (S.step !== 'review' || e.metaKey || e.ctrlKey || e.altKey || !$('#modal').hidden) return;
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
  const act = { s: 'supported', f: 'fix', c: 'open', n: 'notclaim', j: 'next', k: 'prev' }[e.key.toLowerCase()];
  if (act) { e.preventDefault(); reviewAction(act); }
});

$('#saveFile').addEventListener('click', () => {
  const json = JSON.stringify(S, null, 2);
  if (FRAMED) copyText(json, 'Review file'); else download(fileSlug() + '.papertrail.json', json, 'application/json');
});
$('#openFile').addEventListener('click', () => $('#fileInput').click());

(function init() {
  try { $('#reviewer').value = localStorage.getItem(NAME_KEY) || ''; } catch (e) { /* no stored name */ }
  if (FRAMED) $('#saveFile').textContent = 'Copy review file';
  bindSetup();
  const h = (location.hash || '').slice(1);
  const saved = load();
  if (h === 'practice') loadDemo(false);
  else if (h === 'finished') loadDemo(true);
  else if (h === 'practice-setup') { loadDemo(false); S.step = 'setup'; }
  else if (saved && saved.v === 1 && Array.isArray(saved.claims) && Array.isArray(saved.sources)) S = saved;
  else loadDemo(false);
  render();
})();
