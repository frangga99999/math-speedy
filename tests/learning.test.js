import test from 'node:test';
import assert from 'node:assert/strict';
import {generateIQ,calculate,referenceRows} from '../engine.js';
for(const difficulty of ['mudah','sedang','sulit']) test(`IQ ${difficulty}: unique sequences and correct next term`,()=>{
 const history=[];
 for(let i=0;i<100;i++) {
  const q=generateIQ({difficulty,history});history.push(q.id);
  const s=q.sequence;let expected;
  if(q.type==='add'||q.type==='subtract')expected=s[3]+s[1]-s[0];
  if(q.type==='multiply')expected=s[3]*(s[1]/s[0]);
  if(q.type==='growing'||q.type==='square')expected=s[3]+(s[3]-s[2])+(s[2]-2*s[1]+s[0]);
  if(q.type==='alternate')expected=s[3]+s[2]-s[1];
  assert.equal(calculate(q),expected);assert.ok(Number.isInteger(q.answer)&&q.answer>=0);
 }
 assert.equal(new Set(history).size,100);
});
test('all reference tables show correct nonnegative integer results',()=>{
 for(const op of ['tambah','kurang','kali','bagi'])for(let n=1;n<=30;n++)for(const r of referenceRows(op,n)){assert.equal(r.answer,calculate({...r,operation:op}));assert.ok(Number.isInteger(r.answer)&&r.answer>=0);}
 for(const r of referenceRows('akar',2)){assert.equal(r.answer,calculate({...r,operation:'akar'}));assert.ok(Number.isInteger(r.answer)&&r.answer>=0);}
});

import {AI_LESSONS,GUIDE_TOPICS,METHODS,localGuide,localChatReply,CHAT_STARTERS} from '../engine.js';
test('setiap materi panduan punya isi lengkap, metode, dan jawaban cadangan chat',()=>{
 for(const topic of GUIDE_TOPICS){
  const guide=localGuide(topic.id);
  assert.ok(guide.title&&guide.intro&&guide.analogy&&guide.example&&guide.tip,topic.id);
  assert.ok(Array.isArray(guide.steps)&&guide.steps.length>=2,topic.id);
  for(const lesson of AI_LESSONS.filter(l=>l.id===topic.id)) assert.ok(guide.steps.some(s=>s.includes(lesson.hint)));
 }
 // Metode praktis ada untuk materi inti, termasuk urutan operasi campuran.
 for(const id of ['tambah','kurang','kali','bagi','campuran','iq','story']){
  assert.ok(METHODS[id].length>=2,id);
  assert.ok(METHODS[id].every(m=>m.name&&m.how),id);
  assert.match(METHODS.campuran.map(m=>m.how).join(' '),/Kurung/);
 }
 // Jawaban cadangan mengenali pertanyaan tentang tantangan yang ada.
 assert.match(localChatReply('bagaimana urutan operasi campuran?').text,/KUKABATAKU|Kurung/);
 assert.match(localChatReply('tips menghafal perkalian').text,/kali|Perkalian/i);
 assert.match(localChatReply('apa itu pecahan').text,/Pecahan|bagian/i);
 assert.match(localChatReply('cuaca hari ini bagaimana').text,/Panduan lengkap/);
 assert.ok(CHAT_STARTERS.length>=4&&CHAT_STARTERS.every(s=>typeof s==='string'&&s.length>10));
});
test('selected IQ type works at every difficulty',()=>{
 for(const topic of ['basic','multiply','growing','alternate','square','fibonacci','double','mixedops'])for(const difficulty of ['mudah','sedang','sulit']){const history=[];for(let i=0;i<10;i++){const q=generateIQ({topic,difficulty,history});assert.ok(topic==='basic'?['add','subtract'].includes(q.type):q.type===topic);history.push(q.id);}assert.equal(new Set(history).size,10);}
});
test('advanced IQ types (analogy/oddone/matrix/logic) generate correct unique answers',()=>{
 for(const topic of ['analogy','oddone','matrix','logic'])for(const difficulty of ['mudah','sedang','sulit']){const history=[];for(let i=0;i<10;i++){const q=generateIQ({topic,difficulty,history});assert.equal(q.type,topic);assert.equal(calculate(q),q.answer);assert.ok(Number.isInteger(q.answer)&&q.answer>=0);assert.ok(typeof q.display==='string'&&q.display.length>0);history.push(q.id);}assert.equal(new Set(history).size,10,topic);}
});
