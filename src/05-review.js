/* Step 2: check claims one at a time. */
function flagSummary(r) {
  const strong = r.flags.filter(f => f.sev === 'strong').length, soft = r.flags.length - strong;
  if (strong) return '<span class="pill fl-strong">' + ICON.flag + strong + (soft ? '+' + soft : '') + '</span>';
  if (soft) return '<span class="pill fl-soft">' + soft + ' careful</span>';
  return '<span class="pill st-unreviewed">No flags</span>';
}

function viewReview() {
  if (!S.claims.length) return '<div class="panel empty">No claims yet. <button class="btn" type="button" data-step-go="setup">Add copy and sources</button></div>';
  ui.claim = Math.min(ui.claim, S.claims.length - 1);
  const c = counts(), total = S.claims.length, done = total - c.unreviewed;
  const seg = (n, color) => n ? `<i style="width:${(100 * n / total).toFixed(2)}%;background:var(${color})"></i>` : '';
  const list = S.claims.map((cl, i) => ({ cl, i })).filter(({ cl }) =>
    ui.filter === 'all' || (ui.filter === 'todo' && cl.status === 'unreviewed') || (ui.filter === 'open' && cl.status === 'open'));
  return `
  ${S.practice ? `<div class="examples" style="margin-bottom:16px"><p><strong>Practice story.</strong> Millbrook and its grant program are fictional. Try the decisions below, then open Export to see what the newsroom keeps.</p><button class="btn" type="button" data-act="fresh">Start with your own copy</button></div>` : ''}
  <div class="panel summary" aria-label="Progress">
    <strong>${done} of ${total} checked</strong>
    <div class="meter" role="img" aria-label="${done} of ${total} claims have a decision">${seg(c.supported, '--ok')}${seg(c.fixed, '--pencil')}${seg(c.open, '--open')}${seg(c.cut + c.notclaim, '--cut')}</div>
    <div class="counts"><span><b>${c.supported}</b> supported</span><span><b>${c.fixed}</b> fixed</span><span><b>${c.open}</b> need a check</span><span><b>${c.cut + c.notclaim}</b> cut or not claims</span></div>
    <button class="btn btn-sm${done === total ? ' btn-primary' : ''}" type="button" data-step-go="export">Export</button>
  </div>
  <div class="review-grid">
    <nav class="panel galley" aria-label="Claims">
      <div class="galley-filter" role="group" aria-label="Show">
        ${[['all', 'All'], ['todo', 'Not checked'], ['open', 'Need a check']].map(([k, l]) => `<button class="btn btn-sm${ui.filter === k ? ' btn-primary' : ' btn-quiet'}" type="button" data-filter="${k}" aria-pressed="${ui.filter === k}">${l}</button>`).join('')}
      </div>
      <ol>${list.map(({ cl, i }) => `<li><button type="button" data-claim="${i}" aria-current="${i === ui.claim}">
        <span class="num">${i + 1}</span><span class="txt">${esc(cl.text || cl.original)}</span>
        ${cl.status === 'unreviewed' ? flagSummary(result(cl)) : pill(cl.status)}</button></li>`).join('') || '<li class="hint" style="padding:8px">Nothing here.</li>'}</ol>
    </nav>
    ${viewClaim(S.claims[ui.claim], ui.claim)}
  </div>`;
}

function viewClaim(c, i) {
  const r = result(c);
  const total = S.claims.length;
  const ev = r.evidence.map(id => IDX.byId.get(id)).filter(Boolean);
  const decided = c.status !== 'unreviewed';
  const press = s => `aria-pressed="${c.status === s}"`;
  return `
  <article class="panel claim" aria-labelledby="claimTitle">
    <div class="claim-head">
      <h2 id="claimTitle" tabindex="-1">Claim ${i + 1} of ${total}</h2>
      ${pill(c.status)}
    </div>
    <div class="pair">
      <section class="says draft">
        <h3>Draft says</h3>
        <p class="copy">${c.status === 'cut' ? '<del>' + esc(c.original) + '</del>' : marked(c.text, r.claimMarks)}</p>
        ${c.text !== c.original && c.status !== 'cut' ? `<p class="hint">Originally: ${esc(c.original)}</p>` : ''}
      </section>
      <section class="says source">
        <h3>Source says</h3>
        ${r.weak && ev.length ? '<p class="weak">Weak match. These share only a few words with the claim.</p>' : ''}
        ${ev.map(s => `<div class="passage"><div class="src-title">${esc(s.title)}</div><p class="copy small">${marked(s.text, r.evMarks.get(s.id) || [])}</p></div>`).join('') || '<p class="hint">No passage selected.</p>'}
        <div><button class="btn btn-quiet btn-sm" type="button" data-act="picker" aria-expanded="${ui.picker}">${ui.picker ? 'Close passage list' : 'Choose a different passage'}</button></div>
      </section>
    </div>
    ${ui.picker ? viewPicker(c, r) : ''}
    <section aria-labelledby="flagsTitle" style="display:grid;gap:10px">
      <h3 id="flagsTitle">What to check</h3>
      <ul class="flags">${r.flags.length ? r.flags.map(f => `<li>
        <span class="pill ${f.sev === 'strong' ? 'fl-strong' : 'fl-soft'}">${f.sev === 'strong' ? ICON.flag + 'Check' : 'Careful'}</span>
        <div><p><strong>${esc(f.title)}</strong></p><p class="why">${esc(f.why)}</p></div></li>`).join('')
        : '<li class="none"><p>No differences found. Read both and confirm the source supports the claim.</p></li>'}</ul>
    </section>
    <section class="decide" aria-label="Decision">
      <div class="decide-row">
        <button class="btn btn-ok" type="button" data-act="supported" ${press('supported')}>${ICON.check}Supported <kbd>S</kbd></button>
        <button class="btn btn-fix" type="button" data-act="fix" ${press('fixed')}>${ICON.pencil}Fix wording <kbd>F</kbd></button>
        <button class="btn btn-open" type="button" data-act="open" ${press('open')}>${ICON.ask}Needs a check <kbd>C</kbd></button>
        <button class="btn btn-cut" type="button" data-act="notclaim" ${press('notclaim')}>${ICON.minus}Not a claim <kbd>N</kbd></button>
      </div>
      ${ui.mode === 'fix' ? viewFix(c, r, ev) : ''}
      ${ui.mode === 'open' ? viewTask(c, r) : ''}
      ${decided && !ui.mode ? `<p class="decided-note">${esc(STATUS[c.status].label)}${c.by ? ' by ' + esc(c.by) : ''}${c.at ? ', ' + new Date(c.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : ''}.${c.task ? ' Check: ' + esc(c.task.what) + (c.task.who ? ' (' + esc(c.task.who) + ')' : '') + '.' : ''} <button class="btn btn-quiet btn-sm" type="button" data-act="clear">Clear decision</button></p>` : ''}
      <div class="field"><label for="note">Note for the record (optional)</label><input class="input" id="note" value="${esc(c.note)}" placeholder="For example: confirmed by phone with the city clerk"></div>
    </section>
    <div class="nav-row">
      <button class="btn" type="button" data-act="prev" ${i === 0 ? 'disabled' : ''}>Previous</button>
      <button class="btn" type="button" data-act="next" ${i === total - 1 ? 'disabled' : ''}>Next claim</button>
    </div>
  </article>`;
}

function viewFix(c, r, ev) {
  return `<div class="editor">
    <label class="label" for="fixText">Corrected wording</label>
    <textarea id="fixText" rows="3">${esc(c.text)}</textarea>
    <p class="hint" id="fixCheck" aria-live="polite">${recheckText(c.text, c)}</p>
    <div class="actions">
      <button class="btn btn-primary" type="button" data-act="save-fix">Save fix</button>
      ${ev.length ? '<button class="btn" type="button" data-act="use-source">Start from the source wording</button>' : ''}
      <button class="btn btn-quiet" type="button" data-act="cut">Cut this sentence</button>
      <button class="btn btn-quiet" type="button" data-act="cancel">Cancel</button>
    </div>
  </div>`;
}

function recheckText(text, c) {
  if (!text.trim()) return 'Empty. Saving will cut the sentence.';
  const r = PT.analyze(text, IDX, c.evidence || PT.analyze(c.text, IDX, c.evidence).evidence);
  if (!r.flags.length) return 'No differences left against the source.';
  return r.flags.length + (r.flags.length === 1 ? ' difference left: ' : ' differences left: ') + r.flags.map(f => f.title).join(' ');
}

function viewTask(c, r) {
  const t = c.task || {};
  const strong = r.flags.find(f => f.sev === 'strong');
  const what = t.what || (r.weak ? 'Find a source for this claim, or cut it.' : strong ? 'Confirm: ' + strong.title : 'Confirm this claim with a second source.');
  const second = t.second != null ? t.second : r.flags.some(f => f.kind === 'quote' || f.kind === 'name');
  return `<div class="editor">
    <div class="task-grid">
      <div class="field"><label for="tWhat">What needs checking?</label><input class="input" id="tWhat" value="${esc(what)}"></div>
      <div class="field"><label for="tWho">Who is checking?</label><input class="input" id="tWho" value="${esc(t.who || '')}" placeholder="Name or role"></div>
      <div class="field"><label for="tDue">By when?</label><input class="input" id="tDue" value="${esc(t.due || 'Before publishing')}"></div>
    </div>
    <div class="checks">
      <label><input type="checkbox" id="tHold" ${t.hold === false ? '' : 'checked'}> Hold publication until this is resolved</label>
      <label><input type="checkbox" id="tSecond" ${second ? 'checked' : ''}> Needs a second editor (quotes, names, allegations)</label>
    </div>
    <div class="actions">
      <button class="btn btn-primary" type="button" data-act="save-task">Save check</button>
      <button class="btn btn-quiet" type="button" data-act="cancel">Cancel</button>
    </div>
  </div>`;
}

function viewPicker(c, r) {
  const chosen = new Set(r.evidence);
  return `<div class="picker">
    <label class="label" for="pickSearch">Pick the passages that support this claim</label>
    <input class="input" id="pickSearch" placeholder="Filter source sentences" autocomplete="off">
    <ul id="pickList">${IDX.sents.map(s => `<li data-text="${esc(s.text.toLowerCase())}"><label><input type="checkbox" value="${esc(s.id)}" ${chosen.has(s.id) ? 'checked' : ''}><span>${esc(s.text)}<small>${esc(s.title)}</small></span></label></li>`).join('')}</ul>
    <div class="actions">
      <button class="btn btn-primary btn-sm" type="button" data-act="pick-apply">Use selected passages</button>
      <button class="btn btn-quiet btn-sm" type="button" data-act="pick-auto">Go back to the automatic match</button>
    </div>
  </div>`;
}

function nextUnreviewed(from) {
  for (let k = 1; k <= S.claims.length; k++) {
    const j = (from + k) % S.claims.length;
    if (S.claims[j].status === 'unreviewed') return j;
  }
  return Math.min(from + 1, S.claims.length - 1);
}

let nudged = false;
function decide(status, extra) {
  const i = ui.claim, c = S.claims[i];
  Object.assign(c, { status, by: reviewer(), at: new Date().toISOString() }, extra || {});
  if (status !== 'open') c.task = status === 'open' ? c.task : null;
  ui.mode = null; ui.picker = false;
  save();
  const label = STATUS[status].label.toLowerCase();
  const allDone = S.claims.every(x => x.status !== 'unreviewed');
  ui.claim = allDone ? i : nextUnreviewed(i);
  render('claim');
  if (!reviewer() && !nudged) { nudged = true; toast('Add your name at the top so the record shows who checked.'); }
  else say('Claim ' + (i + 1) + ' marked ' + label + '.' + (allDone ? ' Every claim has a decision.' : ''));
}

function reviewAction(act, el) {
  const c = S.claims[ui.claim];
  switch (act) {
    case 'supported': return decide('supported');
    case 'notclaim': return decide('notclaim');
    case 'fix': ui.mode = ui.mode === 'fix' ? null : 'fix'; render('fix'); return;
    case 'open': ui.mode = ui.mode === 'open' ? null : 'open'; render('open'); return;
    case 'cancel': ui.mode = null; render('claim'); return;
    case 'clear': Object.assign(c, { status: 'unreviewed', text: c.original, task: null, by: '', at: null }); save(); render('claim'); say('Decision cleared.'); return;
    case 'cut': return decide('cut');
    case 'use-source': {
      const r = result(c);
      const ta = $('#fixText'); ta.value = r.evidence.map(id => IDX.byId.get(id).text).join(' ');
      $('#fixCheck').textContent = recheckText(ta.value, c); ta.focus(); return;
    }
    case 'save-fix': {
      const v = $('#fixText').value.trim();
      if (!v) return decide('cut');
      if (v === c.text && c.text === c.original) { toast('The wording hasn’t changed. Mark it supported, or edit it first.'); return; }
      return decide('fixed', { text: v });
    }
    case 'save-task': {
      const task = { what: $('#tWhat').value.trim() || 'Check this claim.', who: $('#tWho').value.trim(), due: $('#tDue').value.trim(), hold: $('#tHold').checked, second: $('#tSecond').checked };
      return decide('open', { task });
    }
    case 'picker': ui.picker = !ui.picker; render(ui.picker ? 'picker' : 'claim'); return;
    case 'pick-apply': {
      const ids = [...document.querySelectorAll('#pickList input:checked')].map(x => x.value);
      c.evidence = ids; ui.picker = false; save(); render('claim'); say(ids.length ? 'Passages updated.' : 'No passage selected.'); return;
    }
    case 'pick-auto': c.evidence = null; ui.picker = false; save(); render('claim'); say('Back to the automatic match.'); return;
    case 'prev': if (ui.claim > 0) { ui.claim--; ui.mode = null; ui.picker = false; render('claim'); } return;
    case 'next': if (ui.claim < S.claims.length - 1) { ui.claim++; ui.mode = null; ui.picker = false; render('claim'); } return;
  }
}
