/* Step 3: what the newsroom keeps. */
function openChecks() { return S.claims.map((c, i) => ({ c, i })).filter(x => x.c.status === 'open'); }
function checkers() { return [...new Set(S.claims.map(c => c.by).filter(Boolean))]; }

function paragraphs(mode, omitOpen) {
  // mode: 'clean' | 'changes' | 'text'
  const paras = [];
  const opens = openChecks().map(x => x.i);
  S.claims.forEach((c, i) => {
    const p = c.para || 0;
    (paras[p] = paras[p] || []);
    if (mode === 'changes') {
      if (c.status === 'cut') paras[p].push('<del>' + esc(c.original) + '</del>');
      else if (c.text !== c.original) paras[p].push(PT.diffWords(c.original, c.text).map(o => {
        const lead = o.s.startsWith(' ') ? ' ' : '', w = o.s.trimStart();
        return o.t === 'eq' ? esc(o.s) : lead + '<' + o.t + '>' + esc(w) + '</' + o.t + '>';
      }).join(''));
      else paras[p].push(esc(c.text));
      return;
    }
    if (c.status === 'cut') return;
    const n = opens.indexOf(i) + 1;
    if (c.status === 'open' && omitOpen) return;
    if (mode === 'text') paras[p].push(c.text + (c.status === 'open' ? ' [OPEN CHECK ' + n + ']' : ''));
    else paras[p].push(c.status === 'open' ? '<span class="held">' + esc(c.text) + '</span><span class="fn">' + n + '</span>' : esc(c.text));
  });
  return paras.filter(x => x && x.length);
}

function disclosureDraft() {
  const factual = S.claims.filter(c => c.status !== 'notclaim').length;
  const checked = S.claims.filter(c => ['supported', 'fixed', 'cut'].includes(c.status)).length;
  const corrected = S.claims.filter(c => c.status === 'fixed' || c.status === 'cut').length;
  const srcs = S.sources.filter(s => s.text.trim());
  const tool = S.aiTool.trim() || 'An AI tool';
  const who = checkers().length > 1 ? 'Our editors' : 'An editor';
  return `${tool.charAt(0).toUpperCase() + tool.slice(1)} was used to ${S.aiPurpose} for this story. ${who} checked ${checked === factual ? 'each of its ' + factual : checked + ' of its ' + factual} factual statements against ${srcs.length === 1 ? 'the source document' : 'the ' + srcs.length + ' source documents'} and corrected ${corrected} before publication.`;
}

function viewExport() {
  if (!S.claims.length) return '<div class="panel empty">Nothing to export yet. <button class="btn" type="button" data-step-go="setup">Add copy and sources</button></div>';
  const c = counts(), opens = openChecks(), holds = opens.filter(x => x.c.task && x.c.task.hold);
  const banner = c.unreviewed
    ? `<div class="banner hold">${ICON.hold}<span>${c.unreviewed} ${c.unreviewed === 1 ? 'claim hasn’t' : 'claims haven’t'} been checked yet. <button class="btn btn-sm" type="button" data-step-go="review">Back to checking</button></span></div>`
    : holds.length ? `<div class="banner hold">${ICON.hold}<span>${holds.length} open ${holds.length === 1 ? 'check is' : 'checks are'} holding publication.</span></div>`
    : `<div class="banner clear">${ICON.check}<span>Every claim has a decision. Nothing is holding publication.</span></div>`;
  const tab = ui.exportTab;
  const body = paragraphs(tab === 'changes' ? 'changes' : 'clean', ui.omitOpen).map(p => '<p>' + p.join(' ') + '</p>').join('');
  const disclosure = S.disclosureEdited ? S.disclosure : disclosureDraft();
  return `
  <div class="view-head">
    <div><h2 id="stepTitle" tabindex="-1">${esc(S.slug || 'Reviewed copy')}</h2>
    <p class="lede">The corrected copy, the checks still open, a note for readers and the claim-by-claim record. ${checkers().length ? 'Checked by ' + esc(checkers().join(', ')) + '.' : ''}</p></div>
  </div>
  <div class="stack">
    ${banner}
    <div class="export-grid">
      <section class="panel out" aria-labelledby="copyTitle">
        <div class="out-head"><h2 id="copyTitle">Reviewed copy</h2>
          <div class="tabs" role="tablist" aria-label="Copy view">
            <button type="button" role="tab" aria-selected="${tab === 'clean'}" data-tab="clean">Clean copy</button>
            <button type="button" role="tab" aria-selected="${tab === 'changes'}" data-tab="changes">Tracked changes</button>
          </div></div>
        <div class="article" role="tabpanel">${body || '<p class="hint">Every sentence was cut.</p>'}</div>
        <div class="actions">
          <button class="btn" type="button" data-act="copy-clean">Copy clean copy</button>
          ${opens.length ? `<label class="hint" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="omitOpen" ${ui.omitOpen ? 'checked' : ''}> Leave out sentences with open checks</label>` : ''}
        </div>
      </section>
      <div class="stack">
        <section class="panel out" aria-labelledby="openTitle">
          <div class="out-head"><h2 id="openTitle">Open checks (${opens.length})</h2>
            ${opens.length ? '<button class="btn btn-sm" type="button" data-act="copy-checks">Copy as a checklist</button>' : ''}</div>
          ${opens.length ? `<ul class="tasklist">${opens.map((x, k) => `<li>
            <strong>${k + 1}. ${esc(x.c.task ? x.c.task.what : 'Check this claim.')}</strong>
            <span class="meta">Claim ${x.i + 1}: “${esc(x.c.text)}”</span>
            <span class="meta">${esc([x.c.task && x.c.task.who, x.c.task && x.c.task.due].filter(Boolean).join(' · ') || 'No owner yet')}${x.c.task && x.c.task.hold ? ' · Holds publication' : ''}${x.c.task && x.c.task.second ? ' · Second editor' : ''}</span></li>`).join('')}</ul>`
          : '<p class="hint">None. Every claim is supported, fixed, cut or marked as not a claim.</p>'}
        </section>
        <section class="panel out" aria-labelledby="discTitle">
          <div class="out-head"><h2 id="discTitle">Note for readers</h2><button class="btn btn-sm" type="button" data-act="copy-disc">Copy</button></div>
          <label class="sr-only" for="disclosure">AI-use note for readers</label>
          <textarea id="disclosure" rows="5">${esc(disclosure)}</textarea>
          <p class="hint">A draft built from this review. Readers want to know what the AI did and how people checked it. Edit before publishing.${S.disclosureEdited ? ' <button class="btn btn-quiet btn-sm" type="button" data-act="disc-reset">Rebuild from the review</button>' : ''}</p>
        </section>
      </div>
    </div>
    <section class="panel out" aria-labelledby="logTitle">
      <div class="out-head"><h2 id="logTitle">Review record</h2>
        <div class="downloads">
          <button class="btn btn-sm" type="button" data-act="copy-md">Copy record as text</button>
          ${FRAMED ? '<button class="btn btn-sm" type="button" data-act="copy-csv">Copy as CSV</button>'
            : '<button class="btn btn-sm" type="button" data-act="dl-md">Download .md</button><button class="btn btn-sm" type="button" data-act="dl-csv">Download .csv</button><button class="btn btn-sm" type="button" data-act="dl-json">Download review file</button>'}
        </div></div>
      <div class="log-wrap"><table class="log">
        <thead><tr><th scope="col">#</th><th scope="col">Decision</th><th scope="col">Draft</th><th scope="col">Final</th><th scope="col">Source</th><th scope="col">Checked by</th></tr></thead>
        <tbody>${S.claims.map((cl, i) => {
          const r = result(cl);
          const src = r.evidence.map(id => IDX.byId.get(id)).filter(Boolean);
          return `<tr><td>${i + 1}</td><td>${pill(cl.status)}${cl.task ? '<div class="hint">' + esc(cl.task.what) + '</div>' : ''}${cl.note ? '<div class="hint">Note: ' + esc(cl.note) + '</div>' : ''}</td>
            <td class="c">${esc(cl.original)}</td><td class="c">${cl.status === 'cut' ? '<span class="hint">Cut</span>' : cl.text === cl.original ? '<span class="hint">Unchanged</span>' : esc(cl.text)}</td>
            <td>${src.map(s => '<div><span class="hint">' + esc(s.title) + ':</span> ' + esc(s.text) + '</div>').join('') || '<span class="hint">None</span>'}</td>
            <td>${esc(cl.by || '')}${cl.at ? '<div class="hint">' + new Date(cl.at).toLocaleDateString([], { dateStyle: 'medium' }) + '</div>' : ''}</td></tr>`;
        }).join('')}</tbody></table></div>
    </section>
  </div>`;
}

/* ---------- report formats ---------- */
function reportMarkdown() {
  const opens = openChecks();
  const L = [];
  L.push('# Review record: ' + (S.slug || 'Untitled story'), '');
  L.push('Checked by ' + (checkers().join(', ') || 'no name given') + ' on ' + new Date().toLocaleDateString([], { dateStyle: 'long' }) + ' with Paper Trail.');
  L.push('AI use: ' + (S.aiTool || 'an AI tool') + ' was used to ' + S.aiPurpose + '.', '');
  L.push('Sources:', ...S.sources.filter(s => s.text.trim()).map((s, i) => (i + 1) + '. ' + (s.title || 'Source ' + (i + 1))), '');
  L.push('## Reviewed copy', '', ...paragraphs('text', false).map(p => p.join(' ') + '\n'));
  L.push('## Open checks', '');
  if (!opens.length) L.push('None.');
  opens.forEach((x, k) => L.push('- [ ] ' + (k + 1) + '. ' + (x.c.task ? x.c.task.what : 'Check this claim.') + (x.c.task && x.c.task.who ? ' Owner: ' + x.c.task.who + '.' : '') + (x.c.task && x.c.task.due ? ' Due: ' + x.c.task.due + '.' : '') + (x.c.task && x.c.task.hold ? ' Holds publication.' : '') + ' (Claim ' + (x.i + 1) + ')'));
  L.push('', '## Claim by claim', '');
  S.claims.forEach((c, i) => {
    const r = result(c);
    L.push((i + 1) + '. ' + STATUS[c.status].label + (c.by ? ' by ' + c.by : ''));
    L.push('   - Draft: ' + c.original);
    if (c.status === 'cut') L.push('   - Final: cut');
    else if (c.text !== c.original) L.push('   - Final: ' + c.text);
    r.evidence.forEach(id => { const s = IDX.byId.get(id); L.push('   - Source (' + s.title + '): ' + s.text); });
    if (c.status === 'unreviewed' && r.flags.length) L.push('   - Flags: ' + r.flags.map(f => f.title).join(' '));
    if (c.note) L.push('   - Note: ' + c.note);
  });
  L.push('', '## Note for readers (draft)', '', S.disclosureEdited ? S.disclosure : disclosureDraft(), '');
  return L.join('\n');
}
function reportCSV() {
  const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const rows = [['claim', 'decision', 'draft', 'final', 'sources', 'check', 'owner', 'due', 'holds_publication', 'checked_by', 'checked_at', 'note']];
  S.claims.forEach((c, i) => {
    const r = result(c);
    rows.push([i + 1, STATUS[c.status].label, c.original, c.status === 'cut' ? '' : c.text,
      r.evidence.map(id => { const s = IDX.byId.get(id); return s.title + ': ' + s.text; }).join(' | '),
      c.task ? c.task.what : '', c.task ? c.task.who : '', c.task ? c.task.due : '', c.task ? (c.task.hold ? 'yes' : 'no') : '', c.by, c.at || '', c.note]);
  });
  return rows.map(r => r.map(q).join(',')).join('\n');
}
function checklistText() {
  return openChecks().map((x, k) => '- [ ] ' + (x.c.task ? x.c.task.what : 'Check this claim.') + (x.c.task && x.c.task.who ? ' (' + x.c.task.who + ')' : '') + ' Claim ' + (x.i + 1) + ': "' + x.c.text + '"').join('\n');
}

function exportAction(act) {
  switch (act) {
    case 'copy-clean': return copyText(paragraphs('text', ui.omitOpen).map(p => p.join(' ')).join('\n\n'), 'Clean copy');
    case 'copy-checks': return copyText(checklistText(), 'Checklist');
    case 'copy-disc': return copyText($('#disclosure').value, 'Note for readers');
    case 'disc-reset': S.disclosureEdited = false; S.disclosure = ''; save(); render(); return;
    case 'copy-md': return copyText(reportMarkdown(), 'Review record');
    case 'copy-csv': return copyText(reportCSV(), 'CSV');
    case 'dl-md': return download(fileSlug() + '-review.md', reportMarkdown(), 'text/markdown');
    case 'dl-csv': return download(fileSlug() + '-review.csv', reportCSV(), 'text/csv');
    case 'dl-json': return download(fileSlug() + '.papertrail.json', JSON.stringify(S, null, 2), 'application/json');
  }
}
