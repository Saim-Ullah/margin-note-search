'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {note, tokens, index, pieces, snippet} = require('../search.js');
const names = hits => hits.map(h => h.doc.name);

test('Markdown heading or cleaned filename; BOM and CRLF normalized', () => {
  assert.deepEqual(note('a.md','\ufeff# Index cards\r\nHello'), {name:'a.md',title:'Index cards',text:'# Index cards\nHello'});
  assert.equal(note('my-first_note.txt', 'plain text').title,'my first note');
});
test('Unicode, NFC and code-language tokens', () => {
  assert.deepEqual(tokens('C++ C# c café cafe\u0301 کتاب'),['c++','c#','c','café','café','کتاب']);
});
test('rare terms rank above matches on a ubiquitous term', () => {
  const s=index([note('a.md','study rare'),note('b.md','study common'),note('c.md','study common')]);
  assert.equal(names(s.search('study rare'))[0],'a.md');
});
test('matching query terms combine, unknown tokens do not hide matches', () => {
  const s=index([note('a.md','rank index'),note('b.md','rank term'),note('c.md','index term')]);
  assert.equal(names(s.search('rank unrelated index'))[0],'a.md'); assert.equal(s.search('random').length,0);
});
test('title weighting and deterministic tiebreaks', () => {
  const a=note('a.txt','study unit'), b=note('unit.txt','study data');
  assert.equal(index([a,b]).search('unit')[0].doc.name,'unit.txt');
  const c=note('z.md','# Same\nmemo'), d=note('a.md','# Same\nmemo');
  assert.deepEqual(names(index([c,d]).search('memo')),['a.md','z.md']);
});
test('shorter equally relevant notes receive length normalization', () => {
  const s=index([note('a.txt','target concise'),note('b.txt','target '+ 'other '.repeat(100))]);
  assert.equal(s.search('target')[0].doc.name,'a.txt');
});
test('duplicate query terms count once; no substring matches', () => {
  const s=index([note('test.txt','C++ vector')]);
  assert.deepEqual(s.search('vector vector'),s.search('vector')); assert.deepEqual(s.search('vect'),[]);
  assert.deepEqual(s.search('c'),[]); assert.equal(s.search('C++').length,1);
});
test('browse is sorted; punctuation-only is not browse; empty indexes work', () => {
  const s=index([note('z.md','last'),note('a.md','first')]);
  assert.deepEqual(names(s.search('   ')),['a.md','z.md']); assert.deepEqual(s.search('---'),[]);
  assert.deepEqual(index([]).search('input'),[]); assert.deepEqual(index([]).search(''),[]);
});
test('excerpt centers a late match without showing the whole document', () => {
  const d=note('x.md','# Overview\n'+ 'intro '.repeat(100)+'ranking goal');
  const text=snippet(d,'ranking',100); assert.ok(text.startsWith('…')); assert.ok(text.includes('ranking'));assert.ok(text.length<=102);
});
test('highlighting preserves raw text and only marks whole words', () => {
  const raw='<draft> C++ and C#, vectorized vector.'; const p=pieces(raw,'c++ vector');
  assert.equal(p.map(x=>x.text).join(''),raw);assert.deepEqual(p.filter(x=>x.hit).map(x=>x.text),['C++','vector']);
});
test('terms that collide with object property names remain searchable', () => {
  assert.equal(index([note('a.txt','constructor toString')]).search('constructor').length,1);
});
