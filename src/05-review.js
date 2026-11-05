/* Step 2: check. The whole draft is a live proof; one claim at a time is checked beside its source. */
function strongCount(r) { return r.flags.filter(f => f.sev === 'strong').length; }

function viewReview() {
  if (!S.claims.length) return '<div class="sheet empty">No claims yet. <button class="btn" type="button" data-step-go="setup">Add copy and sources</button></div>';
  ui.claim = Math.min(ui.claim, S.claims.length - 1);
  const results = S.claims.map(c => result(c));
  const c = counts(), total = S.claims.length, done = total - c.unreviewed;
  return `
  <div class="strip-bar">
    <div class="strip" role="group" aria-label="Claims">
      ${S.claims.map((cl, i) => {
        const st = cl.status === 'unreviewed' ? (strongCount(results[i]) ? 'flagged' : '') : cl.status;
        return `<button type="button" class="sq ${st}" data-claim="${i}" aria-current="${i === ui.claim}" aria-label="Claim ${i + 1}: ${esc(STATUS[cl.status].label)}${cl.status === 'unreviewed' && results[i].flags.length ? ', ' + results[i].flags.length + ' queries' : ''}">${i + 1}</button>`;
      }).join('')}
    </div>
    <span class="strip-count"><b>${done}</b> of ${total} checked${c.open ? ` · <b>${c.open}</b> ${c.open === 1 ? 'needs' : 'need'} a check` : ''}</span>
    <button class="btn btn-sm${done === total ? ' btn-primary' : ''}" type="button" data-step-go="export">Export ${ICON.arrow}</button>
  </div>
  <div class="review-grid">
    ${viewProof(results)}
    ${viewClaim(S.claims[ui.claim], ui.claim, results[ui.claim])}
  </div>`;
}

function viewProof(results) {
  const paras = [];
  S.claims.forEach((c, i) => {
    const r = results[i], st = c.status;
    const num = st !== 'unreviewed' ? st : strongCount(r) ? 'flagged' : r.flags.length ? 'soft' : '';
    const body = st === 'unreviewed' ? marked(c.text, r.claimMarks) : esc(st === 'cut' ? c.original : c.text);
    const html = `<span class="sent${st !== 'unreviewed' ? ' s-' + st : ''}${i === ui.claim ? ' on' : ''}" role="button" tabindex="0" data-claim="${i}">`
      + `<span class="cnum ${num}${ui.pop === i ? ' pop' : ''}" aria-hidden="true">${i + 1}</span><span class="sr-only">Claim ${i + 1}, ${esc(STATUS[st].label)}: </span>${body}</span>`;
    (paras[c.para || 0] = paras[c.para || 0] || []).push(html);
  });
  return `
  <section class="sheet proof-sheet" aria-label="The draft">
    <div class="proof-head"><span class="slug">${esc(S.slug || 'Untitled draft')}</span><span class="eyebrow">AI-assisted draft</span></div>
    <div class="article">${paras.filter(Boolean).map(p => '<p>' + p.join(' ') + '</p>').join('')}</div>
    <div class="legend" aria-hidden="true">
      <span><mark class="m-strong">wavy red</mark> likely overstated or wrong</span>
      <span><mark class="m-soft">highlighter</mark> the source is more careful</span>
    </div>
  </section>`;
}

function viewCoach() {
  if (!S.practice) return '';
  try { if (localStorage.getItem(COACH_KEY) === 'off') return ''; } catch (e) { /* show it */ }
  const done = S.claims.filter(c => c.status !== 'unreviewed').length, total = S.claims.length;
  const [n, body] = done === 0
    ? [1, '<strong>Start with claim 1.</strong> The draft says “all.” The source says “eligible,” “may” and “up to.” Point at a query to see the words it means, then choose <strong>Fix wording</strong>.']
    : done < total
      ? [2, '<strong>Keep going.</strong> Move with the numbered squares, or J and K. Claim 7 has no source at all, so try <strong>Needs a check</strong> on it.']
      : [3, '<strong>Every claim has a decision.</strong> Open <strong>Export</strong> to see the corrected copy, the open check and the record your newsroom keeps.'];
  return `<div class="coach" role="note">
    <span class="step">${n}/3</span><p>${body}</p>
    <button class="btn btn-quiet btn-sm" type="button" data-act="coach-off">Hide tips</button>
  </div>`;
}

function viewClips(r) {
  const groups = PT.context(IDX, r.evidence, ui.whole);
  if (!groups.length) return '<p class="hint">No source passage selected.</p>';
  return groups.map(g => {
    let prev = null;
    const lines = g.rows.map(row => {
      const gap = prev != null && row.n - prev > 1 ? '<div class="line ctx"><span class="gut">…</span><span class="txt"></span></div>' : '';
      prev = row.n;
      return gap + `<div class="line ${row.ev ? 'ev' : 'ctx'}"><span class="gut">${row.n}</span><span class="txt">${row.ev ? marked(row.text, r.evMarks.get(row.id)) : esc(row.text)}</span></div>`;
    }).join('');
    const which = g.rows.filter(x => x.ev).map(x => x.n);
    return `<div class="clip">
      <div class="clip-head"><span class="eyebrow">${esc(g.title)}</span><span class="eyebrow">${which.length === 1 ? 'Sentence ' + which[0] : 'Sentences ' + which.join(', ')} of ${g.total}</span></div>
      <div class="clip-body">${lines}</div>
    </div>`;
  }).join('');
}

function viewClaim(c, i, r) {
  const total = S.claims.length;
  const decided = c.status !== 'unreviewed';
  const press = s => `aria-pressed="${c.status === s}"`;
  return `
  <article class="sheet detail" aria-labelledby="claimTitle">
    <div class="claim-head">
      <h2 id="claimTitle" tabindex="-1">Claim ${i + 1} <span class="eyebrow">of ${total}</span></h2>
      ${chip(c.status)}
      <div class="nav">
        <button class="btn btn-quiet btn-sm" type="button" data-act="prev" ${i === 0 ? 'disabled' : ''} aria-label="Previous claim">${ICON.prev}</button>
        <button class="btn btn-quiet btn-sm" type="button" data-act="next" ${i === total - 1 ? 'disabled' : ''} aria-label="Next claim">${ICON.next}</button>
      </div>
    </div>
    ${viewCoach()}
    <section class="says" aria-label="The draft says">
      <span class="eyebrow">The draft says</span>
      <p class="draft-text">${c.status === 'cut' ? '<del>' + esc(c.original) + '</del>' : marked(c.text, r.claimMarks)}</p>
      ${c.text !== c.original && c.status !== 'cut' ? `<p class="was">Was: <del>${esc(c.original)}</del></p>` : ''}
    </section>
    <section class="says" aria-label="The source says">
      <span class="eyebrow">The source says</span>
      ${r.weak && r.evidence.length ? '<p class="weak">Weak match. This passage shares only a few words with the claim.</p>' : ''}
      ${viewClips(r)}
      <div class="clip-actions">
        ${r.evidence.length ? `<button class="btn btn-quiet btn-sm" type="button" data-act="whole">${ui.whole ? 'Show only the matched passage' : 'Show the whole source'}</button>` : ''}
        <button class="btn btn-quiet btn-sm" type="button" data-act="picker" aria-expanded="${ui.picker}">${ui.picker ? 'Close the passage list' : 'Pick a different passage'}</button>
      </div>
      ${ui.picker ? viewPicker(r) : ''}
    </section>
    <section aria-label="Queries">
      <span class="eyebrow">Queries</span>
      <ol class="queries" style="margin-top:8px">${r.flags.length ? r.flags.map((f, k) => `
        <li class="q q-${f.sev}" data-f="${f.id}" tabindex="0">
          <span class="q-id">Q${k + 1}</span>
          <div><p class="q-title">${esc(f.title)}</p><p class="q-why">${esc(f.why)}</p></div>
        </li>`).join('')
        : '<li class="q-none">No differences found. Read both, and confirm the source backs the claim.</li>'}</ol>
    </section>
    <section class="decide" aria-label="Decision">
      <button class="dbtn ok" type="button" data-act="supported" ${press('supported')}><span class="row">${ICON.check}Supported</span><small><kbd>S</kbd>The source backs it</small></button>
      <button class="dbtn fix" type="button" data-act="fix" ${press('fixed')}><span class="row">${ICON.pencil}Fix wording</span><small><kbd>F</kbd>Edit to match</small></button>
      <button class="dbtn open" type="button" data-act="open" ${press('open')}><span class="row">${ICON.ask}Needs a check</span><small><kbd>C</kbd>Assign a follow-up</small></button>
      <button class="dbtn not" type="button" data-act="notclaim" ${press('notclaim')}><span class="row">${ICON.minus}Not a claim</span><small><kbd>N</kbd>Opinion or transition</small></button>
    </section>
    ${ui.mode === 'fix' ? viewFix(c, r) : ''}
    ${ui.mode === 'open' ? viewTask(c, r) : ''}
    ${decided && !ui.mode ? `<p class="decided-note">${chip(c.status)}<span>${c.by ? 'by ' + esc(c.by) : 'No name given'}${c.at ? ', ' + new Date(c.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : ''}${c.task ? '. Check: ' + esc(c.task.what) + (c.task.who ? ' (' + esc(c.task.who) + ')' : '') : ''}</span><button class="btn btn-quiet btn-sm" type="button" data-act="clear">Clear decision</button></p>` : ''}
    <div class="field note-field"><label for="note">Note for the record</label><input class="input" id="note" value="${esc(c.note)}" placeholder="Optional. For example: confirmed by phone with the city clerk"></div>
  </article>`;
}

function viewFix(c, r) {
  return `<div class="editor">
    <label class="label" for="fixText">Corrected wording</label>
    <textarea id="fixText" rows="3">${esc(c.text)}</textarea>
    ${recheckLine(c.text, c)}
    <div class="actions">
      <button class="btn btn-primary" type="button" data-act="save-fix">Save the fix</button>
      ${r.evidence.length ? '<button class="btn" type="button" data-act="use-source">Start from the source wording</button>' : ''}
      <button class="btn btn-quiet" type="button" data-act="cut">Cut this sentence</button>
      <button class="btn btn-quiet" type="button" data-act="cancel">Cancel</button>
    </div>
  </div>`;
}

function recheckLine(text, c) {
  if (!text.trim()) return '<p class="recheck" id="fixCheck" aria-live="polite">Empty. Saving will cut the sentence.</p>';
  const r = PT.analyze(text, IDX, c.evidence || PT.analyze(c.text, IDX, c.evidence).evidence);
  if (!r.flags.length) return `<p class="recheck clean" id="fixCheck" aria-live="polite">${ICON.check.replace('<svg', '<svg width="14" height="14"')}No differences left against the source.</p>`;
  return `<p class="recheck" id="fixCheck" aria-live="polite">${r.flags.length} ${r.flags.length === 1 ? 'difference' : 'differences'} left: ${esc(r.flags.map(f => f.title).join(' '))}</p>`;
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
      <label><input type="checkbox" id="tHold" ${t.hold === false ? '' : 'checked'}> Hold publication until it's resolved</label>
      <label><input type="checkbox" id="tSecond" ${second ? 'checked' : ''}> Needs a second editor (quotes, names, allegations)</label>
    </div>
    <div class="actions">
      <button class="btn btn-primary" type="button" data-act="save-task">Save the check</button>
      <button class="btn btn-quiet" type="button" data-act="cancel">Cancel</button>
    </div>
  </div>`;
}

function viewPicker(r) {
  const chosen = new Set(r.evidence);
  return `<div class="picker">
    <label class="label" for="pickSearch">Pick the passages that back this claim</label>
    <input class="input" id="pickSearch" placeholder="Filter source sentences" autocomplete="off">
    <ul id="pickList">${IDX.sents.map(s => `<li data-text="${esc(s.text.toLowerCase())}"><label><input type="checkbox" value="${esc(s.id)}" ${chosen.has(s.id) ? 'checked' : ''}><span>${esc(s.text)}<small>${esc(s.title)}</small></span></label></li>`).join('')}</ul>
    <div class="actions">
      <button class="btn btn-primary btn-sm" type="button" data-act="pick-apply">Use these passages</button>
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

function select(i) {
  ui.claim = Math.max(0, Math.min(S.claims.length - 1, i));
  ui.mode = null; ui.picker = false; ui.whole = false;
  render('claim');
}

let nudged = false;
function decide(status, extra) {
  const i = ui.claim, c = S.claims[i];
  Object.assign(c, { status, by: reviewer(), at: new Date().toISOString() }, extra || {});
  if (status !== 'open') c.task = null;
  ui.mode = null; ui.picker = false; ui.whole = false; ui.pop = i;
  save();
  const allDone = S.claims.every(x => x.status !== 'unreviewed');
  ui.claim = allDone ? i : nextUnreviewed(i);
  render('claim');
  ui.pop = -1;
  if (!reviewer() && !nudged) { nudged = true; toast('Add your name at the top so the record shows who checked.'); }
  else say('Claim ' + (i + 1) + ' marked ' + STATUS[status].label.toLowerCase() + '.' + (allDone ? ' Every claim has a decision.' : ''));
}

function reviewAction(act) {
  const c = S.claims[ui.claim];
  switch (act) {
    case 'supported': return decide('supported');
    case 'notclaim': return decide('notclaim');
    case 'fix': ui.mode = ui.mode === 'fix' ? null : 'fix'; render('fix'); return;
    case 'open': ui.mode = ui.mode === 'open' ? null : 'open'; render('open'); return;
    case 'cancel': ui.mode = null; render('claim'); return;
    case 'clear': Object.assign(c, { status: 'unreviewed', text: c.original, task: null, by: '', at: null }); save(); render('claim'); say('Decision cleared.'); return;
    case 'cut': return decide('cut');
    case 'coach-off': try { localStorage.setItem(COACH_KEY, 'off'); } catch (e) { /* hide for this view only */ } S.practice = false; save(); render(); return;
    case 'whole': ui.whole = !ui.whole; render(); return;
    case 'use-source': {
      const r = result(c);
      const ta = $('#fixText'); ta.value = r.evidence.map(id => IDX.byId.get(id).text).join(' ');
      $('#fixCheck').outerHTML = recheckLine(ta.value, c); ta.focus(); return;
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
    case 'prev': if (ui.claim > 0) select(ui.claim - 1); return;
    case 'next': if (ui.claim < S.claims.length - 1) select(ui.claim + 1); return;
  }
}
