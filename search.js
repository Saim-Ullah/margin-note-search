/* Margin | offline BM25 ranking. No network, dependencies or storage. */
((root, factory) => {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MarginSearch = factory();
})(globalThis, () => {
  'use strict';
  const WORDS = /[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:\+\+|#)?/gu;
  const normalize = word => word.normalize('NFC').toLowerCase();
  const tokens = text => Array.from(String(text).matchAll(WORDS), m => normalize(m[0]));
  const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

  function note(name, text) {
    text = String(text).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const heading = /^#[ \t]+([^\n]+)$/m.exec(text);
    const title = (heading?.[1] || '').trim() || name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || name;
    return {name, title, text};
  }

  function index(notes) {
    const postings = new Map(), lengths = [], documents = Array.from(notes);
    let collectionLength = 0;
    documents.forEach((doc, id) => {
      let length = 0;
      const freq = new Map();
      function count(text, weight) {
        for (const m of String(text).matchAll(WORDS)) {
          const term = normalize(m[0]);
          length += weight;
          freq.set(term, (freq.get(term) || 0) + weight);
        }
      }
      count(doc.title, 2); // two extra occurrences for each title token
      count(doc.text, 1);
      lengths.push(length);
      collectionLength += length;
      for (const [term, tf] of freq) {
        if (!postings.has(term)) postings.set(term, []);
        postings.get(term).push([id, tf]);
      }
    });
    const n = documents.length, average = n ? collectionLength / n || 1 : 1;
    return {
      search(query) {
        if (!query.trim()) return documents.map(doc => ({doc, score: 0})).sort((a,b) => compare(a.doc.title,b.doc.title) || compare(a.doc.name,b.doc.name));
        const terms = new Set(tokens(query)), scores = new Map();
        for (const term of terms) {
          const hits = postings.get(term);
          if (!hits) continue;
          const idf = Math.log(1 + (n - hits.length + 0.5) / (hits.length + 0.5));
          for (const [id, tf] of hits) {
            const k1 = 1.2, b = 0.75;
            const contribution = idf * tf * (k1 + 1) / (tf + k1 * (1 - b + b * lengths[id] / average));
            scores.set(id, (scores.get(id) || 0) + contribution);
          }
        }
        return [...scores].map(([id, score]) => ({doc: documents[id], score})).sort((a,b) =>
          b.score - a.score || compare(a.doc.title,b.doc.title) || compare(a.doc.name,b.doc.name));
      }
    };
  }

  function snippet(doc, query, limit = 168) {
    const body = doc.text.replace(/^#\s+[^\n]+\n?/, '').replace(/\s+/g, ' ').trim() || doc.title;
    const terms = new Set(tokens(query));
    let match = 0;
    if (terms.size) for (const m of body.matchAll(WORDS)) if (terms.has(normalize(m[0]))) { match = m.index; break; }
    let start = Math.max(0, match - 36);
    if (start > 0) {
      const nextSpace = body.indexOf(' ', start);
      if (nextSpace >= start && nextSpace < match) start = nextSpace + 1;
    }
    const end = Math.min(body.length, start + limit);
    return (start ? '…' : '') + body.slice(start, end).trim() + (end < body.length ? '…' : '');
  }

  // Return text segments rather than HTML. The UI inserts even highlighted text as text nodes.
  function pieces(text, query) {
    const terms = new Set(tokens(query));
    if (!terms.size) return [{text, hit: false}];
    const parts = []; let last = 0;
    for (const m of text.matchAll(WORDS)) {
      if (!terms.has(normalize(m[0]))) continue;
      if (m.index > last) parts.push({text: text.slice(last, m.index), hit: false});
      parts.push({text: m[0], hit: true}); last = m.index + m[0].length;
    }
    if (last < text.length) parts.push({text: text.slice(last), hit: false});
    return parts;
  }
  return {tokens, note, index, snippet, pieces};
});
