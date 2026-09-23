import test from 'node:test';
import assert from 'node:assert/strict';
import { generateChallenge, generateTableChallenge, frameStory, isQuestionValid, isSettingsValid, calculate, SYMBOLS, LIMITS, MINIMUMS, digitsRange, isDigitsValid, simBersusunBagi, simBersusunKali } from '../engine.js';
import {ADDITION_SKILLS, classifyAdditionSkill} from '../skills.js';

for (const operation of Object.keys(SYMBOLS).filter(o => o !== 'akar')) {
  for (const difficulty of Object.keys(LIMITS)) {
    test(`${operation}/${difficulty}: ten valid, unique, solvable questions`, () => {
      for (let session = 0; session < 30; session++) {
        const history = [];
        for (let i = 0; i < 10; i++) {
          const q = generateChallenge({ operation, difficulty, history });
          assert.ok(isQuestionValid(q, operation, difficulty, history));
          assert.ok(q.a >= MINIMUMS[difficulty] && q.a <= LIMITS[difficulty]);
          const answer = calculate(q);
          assert.ok(Number.isInteger(answer) && answer >= 0 && answer <= 10000);
          if (difficulty !== 'mudah' && operation === 'bagi') assert.ok(q.b >= 2 && answer > 1);
          if (difficulty !== 'mudah' && operation === 'kali') assert.ok(q.b >= 2);
          assert.equal(q.source, 'default');
          history.push(`${q.a}:${q.b}`);
        }
        assert.equal(new Set(history).size, 10);
      }
    });
  }
}
test('akar: valid, unique, integer square roots within 1–30', () => {
  for (const difficulty of Object.keys(LIMITS)) {
    const history = [];
    for (let i = 0; i < 10; i++) {
      const q = generateChallenge({ operation: 'akar', difficulty, history });
      assert.equal(q.operation, 'akar');
      assert.equal(q.source, 'default');
      assert.ok(Number.isInteger(q.answer) && q.answer >= 1 && q.answer <= 30, `akar ${q.answer}`);
      assert.equal(calculate(q), q.answer);
      assert.equal(q.a, q.answer * q.answer);
      assert.ok(!history.includes(q.id));
      history.push(q.id);
    }
    assert.equal(new Set(history).size, 10);
  }
  assert.equal(isSettingsValid('akar', 'mudah'), true);
  assert.equal(isSettingsValid('akar', 'aneh'), false);
});

test('invalid operations and invalid AI answers are rejected', () => {
  assert.throws(() => generateChallenge({operation:'constructor',difficulty:'mudah'}));
  assert.throws(() => generateChallenge({operation:'kali',difficulty:'__proto__'}));
  assert.equal(isQuestionValid({a:5,b:0},'bagi','mudah'),false);
  assert.equal(isQuestionValid({a:5,b:2},'bagi','mudah'),false);
  assert.equal(isQuestionValid({a:3,b:5},'kurang','mudah'),false);
  assert.equal(isQuestionValid({a:Infinity,b:5},'kali','mudah'),false);
  assert.equal(isQuestionValid({a:3,b:5},'kali','sulit'),false);
});

test('tambah digit setting (1–5) generates correct-digit questions', () => {
  for (const digits of [1, 2, 3, 4, 5]) {
    const range = digitsRange(digits);
    const min = digits === 1 ? 0 : 10 ** (digits - 1);
    const max = 10 ** digits - 1;
    assert.equal(range.min, min);
    assert.equal(range.max, max);
    const history = [];
    for (let i = 0; i < 10; i++) {
      const q = generateChallenge({ operation: 'tambah', difficulty: 'mudah', digits, history });
      assert.ok(q.a >= min && q.a <= max, `a ${q.a} in [${min},${max}]`);
      assert.ok(q.b >= min && q.b <= max, `b ${q.b} in [${min},${max}]`);
      assert.equal(calculate(q), q.a + q.b);
      assert.equal(q.source, 'default');
      assert.ok(!history.includes(`${q.a}:${q.b}`));
      history.push(`${q.a}:${q.b}`);
    }
    assert.equal(new Set(history).size, 10);
  }
});

test('soal cerita membungkus soal dasar tanpa mengubah angkanya', () => {
  for (const operation of ['tambah','kurang','kali','bagi']) {
    for (const [a,b] of [[7,5],[23,14],[96,12],[48,6]]) {
      const framed=frameStory({a,b,operation});
      assert.ok(typeof framed.story==='string'&&framed.story.includes(String(a))&&framed.story.includes(String(b)),framed.story);
      assert.ok(typeof framed.question==='string'&&framed.question.length>5);
      // Angka asli tetap jadi kunci jawaban, bingkai hanya teks.
      assert.equal(calculate({...framed,a,b,operation}),calculate({a,b,operation}));
    }
  }
});

test('operasi campuran: valid, urutan operasi benar, dan bervariasi', () => {
  assert.equal(isSettingsValid('campuran','sedang'),true);
  assert.equal(isSettingsValid('campuran','aneh'),false);
  for (const difficulty of ['mudah','sedang','sulit']) {
    const history=[];
    for (let i=0;i<30;i++) {
      const q=generateChallenge({operation:'campuran',difficulty,history});
      assert.equal(q.operation,'campuran');
      assert.ok(typeof q.display==='string'&&/[+\-×]/.test(q.display),q.display);
      assert.ok(Number.isInteger(q.answer)&&q.answer>=0&&q.answer<=400,`jawaban ${q.answer} wajar`);
      assert.equal(calculate(q),q.answer,'display dan jawaban konsisten');
      assert.ok(!history.includes(q.id));
      history.push(q.id);
    }
    assert.ok(new Set(history).size>10,'soal campuran harus bervariasi');
  }
  assert.equal(calculate({a:2,b:3,c:4,operation:'campuran',variant:'plus-kali'}),14);
  assert.equal(calculate({a:2,b:3,c:4,operation:'campuran',variant:'kurung-kali'}),20);
  assert.throws(()=>generateChallenge({operation:'campuran',difficulty:'aneh'}));
});

test('digit validation rejects invalid values', () => {
  assert.equal(isDigitsValid(3), true);
  assert.equal(isDigitsValid(0), false);
  assert.equal(isDigitsValid(6), false);
  assert.equal(isDigitsValid(1.5), false);
  assert.equal(isDigitsValid(null), true);
  assert.equal(isDigitsValid(undefined), true);
  assert.throws(() => digitsRange(6));
  assert.throws(() => digitsRange(0));
});

test('addition questions are tagged with deterministic micro-skills', () => {
  assert.equal(classifyAdditionSkill(3, 4), ADDITION_SKILLS.BASIC);
  assert.equal(classifyAdditionSkill(8, 2), ADDITION_SKILLS.BOND_10);
  assert.equal(classifyAdditionSkill(8, 7), ADDITION_SKILLS.CROSS_10);
  assert.equal(classifyAdditionSkill(20, 30), ADDITION_SKILLS.TENS);
  assert.equal(classifyAdditionSkill(21, 34), ADDITION_SKILLS.TWO_DIGIT_NO_REGROUP);
  assert.equal(classifyAdditionSkill(48, 37), ADDITION_SKILLS.TWO_DIGIT_REGROUP);
  assert.equal(classifyAdditionSkill(125, 25), ADDITION_SKILLS.LARGE);
  for (let i = 0; i < 200; i++) {
    const question = generateChallenge({operation:'tambah', difficulty:'sedang'});
    assert.ok(Object.values(ADDITION_SKILLS).includes(question.skillId));
    assert.ok(question.strategyId);
  }
});

test('targeted addition generation stays inside the requested micro-skill', () => {
  const levels={
    [ADDITION_SKILLS.BASIC]:'mudah',[ADDITION_SKILLS.BOND_10]:'mudah',[ADDITION_SKILLS.CROSS_10]:'mudah',
    [ADDITION_SKILLS.TENS]:'sedang',[ADDITION_SKILLS.TWO_DIGIT_NO_REGROUP]:'sedang',[ADDITION_SKILLS.TWO_DIGIT_REGROUP]:'sedang',[ADDITION_SKILLS.LARGE]:'sulit'
  };
  for(const [skill,difficulty] of Object.entries(levels))for(let i=0;i<1000;i++){
    const question=generateChallenge({operation:'tambah',difficulty,skill});
    assert.equal(question.skillId,skill);
    assert.equal(classifyAdditionSkill(question.a,question.b),skill);
  }
  assert.throws(()=>generateChallenge({operation:'tambah',difficulty:'mudah',skill:'UNKNOWN'}));
});

test('table challenge drills only the chosen multiplication table', () => {
  // Tabel 7, baris 1–10: soalnya harus selalu "7 × n" dan unik.
  const history = [];
  for (let i = 0; i < 10; i++) {
    const q = generateTableChallenge({ operation: 'kali', number: 7, lo: 1, hi: 10, history });
    assert.equal(q.operation, 'kali');
    assert.equal(q.a, 7);
    assert.ok(q.b >= 1 && q.b <= 10);
    assert.equal(calculate(q), 7 * q.b);
    assert.ok(!history.includes(q.id));
    history.push(q.id);
  }
  assert.equal(new Set(history).size, 10);
  // Habis 10 baris, tidak ada lagi yang bisa diambil.
  assert.throws(() => generateTableChallenge({ operation: 'kali', number: 7, lo: 1, hi: 10, history }));
  // Berbeda dari soal kali beranda: angka acuan (a) berubah-ubah, bukan tetap 7.
  const home = generateChallenge({ operation: 'kali', difficulty: 'mudah' });
  assert.ok(home.a !== undefined);
});

test('kuadrat & kubik tables give exact squares and cubes', () => {
  for (const [op, fn] of [['kuadrat', n => n * n], ['kubik', n => n * n * n]]) {
    const history = [];
    for (let i = 0; i < 10; i++) {
      const q = generateTableChallenge({ operation: op, number: 1, lo: 1, hi: 10, history });
      assert.equal(q.operation, op);
      assert.equal(q.a * q.a * (op === 'kubik' ? q.a : 1), fn(q.a));
      assert.equal(calculate(q), fn(q.a));
      assert.ok(!history.includes(q.id));
      history.push(q.id);
    }
    assert.equal(new Set(history).size, 10);
  }
});
