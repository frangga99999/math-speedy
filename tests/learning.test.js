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
 for(const op of ['tambah','kurang','kali','bagi'])for(let n=1;n<=12;n++)for(const r of referenceRows(op,n)){assert.equal(r.answer,calculate({...r,operation:op}));assert.ok(Number.isInteger(r.answer)&&r.answer>=0);}
});

import {AI_LESSONS,generateAIMath} from '../engine.js';
test('every adult lesson and level supports ten unique integer-answer questions',()=>{
 for(const lesson of AI_LESSONS)for(const difficulty of ['mudah','sedang','sulit']){
  const history=[];
  for(let i=0;i<10;i++){
   const q=generateAIMath({topic:lesson.id,difficulty,history});assert.ok(!history.includes(q.id));history.push(q.id);
   assert.ok(Number.isInteger(q.answer)&&q.answer>=0);assert.equal(calculate(q),q.answer);
  }
 }
});
test('selected IQ type works at every difficulty',()=>{
 for(const topic of ['basic','multiply','growing','alternate','square','fibonacci','double','mixedops'])for(const difficulty of ['mudah','sedang','sulit']){const history=[];for(let i=0;i<10;i++){const q=generateIQ({topic,difficulty,history});assert.ok(topic==='basic'?['add','subtract'].includes(q.type):q.type===topic);history.push(q.id);}assert.equal(new Set(history).size,10);}
});
