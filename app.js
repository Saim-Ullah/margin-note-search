/* Margin UI: all files are read through the browser's local File API. */
(() => {
  'use strict';
  const {note, index, snippet, pieces} = window.MarginSearch;
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className=cls; if (text !== undefined) n.textContent=text; return n; };
  const samples = [
    ['vector-notes.md', '# A vector that grows\nA C++ vector stores elements contiguously. Use push_back to append an item. If you know how many items will arrive, reserve capacity first.\n\nExercise: read five numbers, keep them in a vector, and print them in reverse.'],
    ['search-ranking.md', '# Why rare words matter\nA search ranking should reward a distinctive term more than a word found in every note. BM25 weighs term frequency, rarity across documents, and document length.\n\nTry adding “vector” to a title and compare its ranking.'],
    ['pocket-budget.md', '# A pocket budget\nStart with one month and a simple budget. Record each expense in rupees and group it by category. Compare the total with the amount you planned to spend.\n\nA useful first question: which category had the largest total?'],
    ['money-and-integers.md', '# Keep money in integers\nIn C++, store rupees as integer paisa to avoid rounding drift. Ten paisa plus twenty paisa is exactly thirty paisa. Convert to a formatted decimal only when printing.'],
    ['retrieval-checklist.txt', 'Before comparing ranking methods, write down three queries and which notes you expect to find. Save this small set as a regression check. Exact-word retrieval does not understand synonyms automatically.'],
    ['study-rhythm.md', '# A short review loop\nAfter a study session, close the book and write one sentence from memory. Revisit it tomorrow. A small, focused note is easier to retrieve than a page of unrelated ideas.']
  ].map(([name, text]) => note(name, text));
  const MiB = 1024*1024, MAX_FILE = MiB, MAX_TOTAL = 4*MiB, MAX_NOTES = 80;
  let library = new Map(), inSamples = false, engine = index([]), busy = false;
  function highlighted(parent, text, query) {
    for (const p of pieces(text, query)) parent.append(p.hit ? el('mark', '', p.text) : document.createTextNode(p.text));
  }
  function read(doc) {
    $('reader-file').textContent = doc.name; $('reader-title').textContent = doc.title;
    $('reader-text').textContent = doc.text; $('reader').showModal();
  }
  function render() {
    const q = $('q').value.trim(), results = engine.search(q), list = $('list');
    $('mode').textContent = inSamples ? 'Sample shelf' : 'Your shelf';
    $('count').textContent = results.length + (q ? (results.length === 1 ? ' match' : ' matches') : (results.length === 1 ? ' note' : ' notes'));
    $('examples').hidden = !inSamples; $('reset').hidden = inSamples; $('clear').hidden = !library.size;
    const frag = document.createDocumentFragment();
    for (const {doc} of results) {
      const row = el('article', 'result'); row.append(el('p','file',doc.name));
      const heading = el('h2'), btn = el('button'); btn.type='button'; highlighted(btn,doc.title,q);
      btn.addEventListener('click', () => read(doc)); heading.append(btn); row.append(heading);
      const p = el('p','extract'); highlighted(p,snippet(doc,q),q); row.append(p); frag.append(row);
    }
    if (!results.length) {
      const box = el('div','empty');
      box.append(el('strong','',library.size ? 'No matching notes.' : 'Your shelf is empty.'));
      box.append(document.createTextNode(library.size ? 'Try a different word. Margin matches whole words, not synonyms.' : 'Choose a text file above or restore the sample notes.'));
      frag.append(box);
    }
    list.replaceChildren(frag);
  }
  function reindex() { engine = index(Array.from(library.values(), entry => entry.doc)); render(); }
  function reset() {
    if (busy) return; library = new Map(samples.map(doc => [doc.name,{doc,size:0}])); inSamples = true;
    $('notice').textContent=''; $('q').value=''; reindex();
  }
  function setBusy(value) {
    busy=value; for(const id of ['import','clear','reset']) $(id).disabled=value;
    $('drop').setAttribute('aria-busy',String(value));
  }
  async function importFiles(files) {
    if (busy || !files.length) return;
    setBusy(true); $('notice').textContent='Reading local files…';
    const next = inSamples ? new Map() : new Map(library);
    let total=Array.from(next.values()).reduce((n,f) => n+f.size,0), loaded=0, skipped=0, reason='';
    const reject = why => {skipped++; if (!reason) reason=why;};
    try {
      for (const file of files) {
        if (!/\.(md|markdown|txt)$/i.test(file.name)) {reject('unsupported extension'); continue;}
        if (file.size>MAX_FILE) {reject('file exceeds 1 MiB'); continue;}
        const old=next.get(file.name);
        if (!old && next.size>=MAX_NOTES) {reject('80-note limit'); continue;}
        const newTotal=total-(old?.size || 0)+file.size;
        if (newTotal>MAX_TOTAL) {reject('4 MiB shelf limit'); continue;}
        try {
          const text = new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());
          if (text.includes('\0') || !text.trim()) {reject('empty or binary file');continue;}
          next.set(file.name,{doc:note(file.name,text),size:file.size}); total=newTotal; loaded++;
        } catch {reject('unreadable file or invalid UTF-8');}
      }
      if (loaded) {library=next; inSamples=false; $('q').value=''; reindex();}
      $('notice').textContent = `Read ${loaded} ${loaded===1?'file':'files'}.` + (skipped ? ` Skipped ${skipped} (${reason}${skipped>1?' for at least one file':''}).` : ' Nothing was uploaded.');
    } finally {setBusy(false); $('files').value='';}
  }
  $('q').addEventListener('input',render);
  $('import').addEventListener('click',()=>$('files').click());
  $('files').addEventListener('change',e=>importFiles(Array.from(e.target.files)));
  for(const b of document.querySelectorAll('[data-query]')) b.addEventListener('click',()=>{$('q').value=b.dataset.query;render();$('q').focus();});
  $('clear').addEventListener('click',()=>{if(busy)return;library.clear();inSamples=false;$('q').value='';$('reader-text').textContent='';$('reader-file').textContent='';$('reader-title').textContent='';$('notice').textContent='Library cleared. Your files on disk are unchanged.';reindex();});
  $('reset').addEventListener('click',reset);
  $('close').addEventListener('click',()=>$('reader').close());
  $('reader').addEventListener('close',()=>{for(const id of ['reader-file','reader-title','reader-text']) $(id).textContent='';});
  const drop=$('drop');
  drop.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect=busy?'none':'copy';if(!busy)drop.classList.add('over');});
  drop.addEventListener('dragleave',()=>drop.classList.remove('over'));
  drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('over');importFiles(Array.from(e.dataTransfer.files));});
  // Outside the drop zone, don't navigate away from a shelf when a file is dropped by mistake.
  for(const evt of ['dragover','drop']) window.addEventListener(evt,e=>{if(e.dataTransfer?.types.includes('Files'))e.preventDefault();});
  document.addEventListener('keydown',e=>{
    if ($('reader').open || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    if (e.key==='/' && document.activeElement!==$('q')) {e.preventDefault();$('q').focus();}
    if (e.key==='Escape' && document.activeElement===$('q')) {$('q').value='';render();}
  });
  reset();
})();
