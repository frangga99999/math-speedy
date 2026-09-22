import test from 'node:test';
import assert from 'node:assert/strict';
import {LEARNING_STORAGE_KEYS,findWeakSkill,readAttempts,readSkillProgress,saveAttempt,summarizeSkill} from '../mastery.js';

function memory() { const values=new Map(); return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}; }
function attempt(index,correct=true,sessionId='session-a') { return {sessionId,operation:'tambah',difficulty:'mudah',skillId:'ADD_CROSS_10',strategyId:'MAKE_10',a:8,b:7,userAnswer:correct?15:14,correctAnswer:15,correct,hintUsed:false,responseMs:1200+index,timestamp:new Date(2026,8,22,10,0,index).toISOString()}; }

test('attempts persist and update skill progress without touching old progress',()=>{
  const storage=memory();storage.setItem('math-speedy.progress.v1','[{"old":true}]');
  for(let i=0;i<8;i++)assert.equal(saveAttempt(storage,attempt(i,i!==0)),true);
  assert.equal(readAttempts(storage).length,8);
  const skill=readSkillProgress(storage).ADD_CROSS_10;
  assert.equal(skill.status,'STABLE');assert.equal(skill.recentAccuracy,88);
  assert.equal(storage.getItem('math-speedy.progress.v1'),'[{"old":true}]');
  assert.equal(LEARNING_STORAGE_KEYS.attempts,'math-speedy.attempts.v1');
});

test('mastery requires accuracy, enough attempts, and two sessions',()=>{
  const attempts=Array.from({length:15},(_,i)=>attempt(i,true,i<8?'session-a':'session-b'));
  assert.equal(summarizeSkill(attempts,'ADD_CROSS_10').status,'MASTERED');
  assert.equal(summarizeSkill(attempts.map(x=>({...x,sessionId:'one'})),'ADD_CROSS_10').status,'STABLE');
});

test('corrupt or unavailable learning storage fails safely',()=>{
  const storage=memory();storage.setItem(LEARNING_STORAGE_KEYS.attempts,'broken');storage.setItem(LEARNING_STORAGE_KEYS.skills,'[]');
  assert.deepEqual(readAttempts(storage),[]);assert.deepEqual(readSkillProgress(storage),{});
  assert.equal(saveAttempt({getItem(){throw Error();},setItem(){throw Error();}},attempt(1)),false);
  assert.equal(saveAttempt(storage,{skillId:'ADD_CROSS_10'}),false);
});

test('weak skill requires enough evidence and returns at most one recommendation',()=>{
  const tooLittle=[attempt(0,false),attempt(1,false)];
  assert.equal(findWeakSkill(tooLittle,'session-a'),null);
  const enough=[...tooLittle,attempt(2,true),attempt(3,false)];
  const insight=findWeakSkill(enough,'session-a');
  assert.equal(insight.skillId,'ADD_CROSS_10');assert.equal(insight.errors,3);assert.equal(insight.attempts,4);
});

test('one mistake does not create a weakness diagnosis',()=>{
  const history=Array.from({length:8},(_,i)=>attempt(i,i!==7));
  assert.equal(findWeakSkill(history,'session-a'),null);
});
