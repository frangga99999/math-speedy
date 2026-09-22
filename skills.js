export const ADDITION_SKILLS = Object.freeze({
  BASIC: 'ADD_BASIC',
  BOND_10: 'ADD_BOND_10',
  CROSS_10: 'ADD_CROSS_10',
  TENS: 'ADD_TENS',
  TWO_DIGIT_NO_REGROUP: 'ADD_2D_NO_REGROUP',
  TWO_DIGIT_REGROUP: 'ADD_2D_REGROUP',
  LARGE: 'ADD_LARGE',
});

export const SKILL_DEFINITIONS = Object.freeze({
  [ADDITION_SKILLS.BASIC]: { operation: 'tambah', title: 'Penjumlahan dasar', strategyId: 'COUNT_ON' },
  [ADDITION_SKILLS.BOND_10]: { operation: 'tambah', title: 'Pasangan menuju 10', strategyId: 'MAKE_10' },
  [ADDITION_SKILLS.CROSS_10]: { operation: 'tambah', title: 'Penjumlahan lewat 10', strategyId: 'MAKE_10' },
  [ADDITION_SKILLS.TENS]: { operation: 'tambah', title: 'Penjumlahan puluhan', strategyId: 'DECOMPOSE_TENS' },
  [ADDITION_SKILLS.TWO_DIGIT_NO_REGROUP]: { operation: 'tambah', title: 'Dua digit tanpa simpan', strategyId: 'DECOMPOSE_TENS' },
  [ADDITION_SKILLS.TWO_DIGIT_REGROUP]: { operation: 'tambah', title: 'Dua digit dengan simpan', strategyId: 'DECOMPOSE_TENS' },
  [ADDITION_SKILLS.LARGE]: { operation: 'tambah', title: 'Penjumlahan angka besar', strategyId: 'PLACE_VALUE' },
});

export function classifyAdditionSkill(a, b) {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return null;
  const max = Math.max(a, b);
  if (max >= 100) return ADDITION_SKILLS.LARGE;
  if (a % 10 === 0 && b % 10 === 0) return ADDITION_SKILLS.TENS;
  if (a >= 10 && b >= 10) return (a % 10) + (b % 10) >= 10
    ? ADDITION_SKILLS.TWO_DIGIT_REGROUP
    : ADDITION_SKILLS.TWO_DIGIT_NO_REGROUP;
  if (a + b === 10) return ADDITION_SKILLS.BOND_10;
  if (a + b > 10) return ADDITION_SKILLS.CROSS_10;
  return ADDITION_SKILLS.BASIC;
}

export function skillForQuestion(question) {
  if (!question || question.operation !== 'tambah') return null;
  return classifyAdditionSkill(question.a, question.b);
}
