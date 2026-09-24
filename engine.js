import {skillForQuestion, SKILL_DEFINITIONS} from './skills.js';

export const SYMBOLS = Object.freeze({ tambah: '+', kurang: '−', kali: 'x', bagi: '÷', akar: '√' });
export const LIMITS = Object.freeze({ mudah: 10, sedang: 50, sulit: 100 });
export const MINIMUMS = Object.freeze({ mudah: 0, sedang: 11, sulit: 51 });
export const MAX_DIGITS = 5;

export function isSettingsValid(operation, difficulty) {
  return (operation === 'campuran' || Object.hasOwn(SYMBOLS, operation)) && Object.hasOwn(LIMITS, difficulty);
}

export function isDigitsValid(digits) {
  return digits === undefined || digits === null || (Number.isInteger(digits) && digits >= 1 && digits <= MAX_DIGITS);
}

export function digitsRange(digits) {
  if (digits === undefined || digits === null) return null;
  if (!Number.isInteger(digits) || digits < 1 || digits > MAX_DIGITS) throw new Error('Digit tidak valid.');
  return { min: digits === 1 ? 0 : 10 ** (digits - 1), max: 10 ** digits - 1 };
}

export function calculate({ a, b, c, operation, answer, variant }) {
  if (['iq','aimath'].includes(operation)) return answer;
  if (operation === 'campuran') {
    switch (variant) {
      case 'plus-minus': return a + b - c;
      case 'minus-plus': return a - b + c;
      case 'kali-plus': return a * b + c;
      case 'kali-minus': return a * b - c;
      case 'plus-kali': return a + b * c;
      case 'minus-kali': return a - b * c;
      case 'kurung-kali': return (a + b) * c;
      case 'kurung-kurang': return (a - b) * c;
      case 'kali-bagi': return a * b / c;
      case 'bagi-plus': return a / b + c;
      case 'bagi-minus': return a / b - c;
      case 'plus-bagi': return a + b / c;
      case 'minus-bagi': return a - b / c;
      case 'kurung-bagi': return (a + b) / c;
      default: throw new Error('Bentuk campuran tidak valid.');
    }
  }
  switch (operation) {
    case 'tambah': return a + b;
    case 'kurang': return a - b;
    case 'kali': return a * b;
    case 'bagi': return a / b;
    case 'akar': return Math.round(Math.sqrt(a));
    case 'kuadrat': return a * a;
    case 'kubik': return a * a * a;
    default: throw new Error('Operasi tidak valid.');
  }
}

export function isQuestionValid(q, operation, difficulty, history = [], digits) {
  if (!q || !isSettingsValid(operation, difficulty)) return false;
  const { a, b } = q;
  const ranged = operation === 'tambah' && digits != null;
  const range = ranged ? digitsRange(digits) : null;
  const min = range ? range.min : MINIMUMS[difficulty];
  const max = range ? range.max : LIMITS[difficulty];
  const bMin = ranged ? min : 0;
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < min || b < bMin || a > max || b > max) return false;
  if (operation === 'kurang' && a < b) return false;
  if (operation === 'bagi' && (b < 1 || a % b !== 0)) return false;
  const extra = ranged ? 'mudah' : difficulty;
  if (extra !== 'mudah') {
    if ((operation === 'kali' || operation === 'bagi') && b < 2) return false;
    if (operation === 'bagi' && a === b) return false;
    if ((operation === 'tambah' || operation === 'kurang') && b < (extra === 'sedang' ? 10 : 25)) return false;
    if (operation === 'kurang' && a === b) return false;
  }
  return !history.includes(`${a}:${b}`);
}

const pools = new Map();
export function generateChallenge({ operation, difficulty, history = [], previous = '', digits, skill }, random = Math.random) {
  if (!isSettingsValid(operation, difficulty)) throw new Error('Pilihan latihan tidak valid.');
  if (skill && (!Object.hasOwn(SKILL_DEFINITIONS,skill) || SKILL_DEFINITIONS[skill].operation !== operation)) throw new Error('Skill latihan tidak valid.');
  if (operation === 'campuran') {
    // Bentuk soal per level: mudah satu langkah, sedang masuk kali & bagi,
    // sulit urutan operasi penuh dengan tanda kurung dan pembagian.
    const resep = {
      mudah: {variants:['plus-minus','minus-plus'], bounds:{a:[1,9],b:[1,9],c:[1,9]}},
      sedang: {variants:['plus-minus','minus-plus','kali-plus','kali-minus','bagi-plus','bagi-minus'], bounds:{a:[11,50],b:[11,50],c:[11,50]}},
      sulit: {variants:['kali-plus','kali-minus','plus-kali','minus-kali','kurung-kali','kurung-kurang','kali-bagi','plus-bagi','minus-bagi','kurung-bagi'], bounds:{a:[2,100],b:[2,12],c:[2,100]}}
    }[difficulty];
    const int=(lo,hi)=>lo+Math.floor(random()*(hi-lo+1));
    // Soal pembagian dibangun dari pembagi × hasil supaya hasilnya selalu bulat.
    const bagi=(divisor,limit)=>int(2,Math.max(2,Math.min(12,Math.floor(limit/divisor))));
    const divBuilders={
      'kali-bagi':()=>{const c=int(2,12),m=bagi(c,100);return{a:int(2,12),b:c*m,c};},
      'bagi-plus':()=>{const b=int(2,12),q=bagi(b,100);return{a:b*q,b,c:int(2,100)};},
      'bagi-minus':()=>{const b=int(2,12),q=bagi(b,100);return{a:b*q,b,c:int(2,q)};},
      'plus-bagi':()=>{const c=int(2,12),q=bagi(c,100);return{a:int(2,100),b:c*q,c};},
      'minus-bagi':()=>{const c=int(2,12),q=bagi(c,100);return{a:int(q,100),b:c*q,c};},
      'kurung-bagi':()=>{const c=int(2,12),q=bagi(c,100);const a=int(2,c*q-2);return{a,b:c*q-a,c};}
    };
    for (let attempt = 0; attempt < 500; attempt++) {
      const variant=resep.variants[Math.floor(random()*resep.variants.length)];
      let a,b,c;
      if (divBuilders[variant]) ({a,b,c}=divBuilders[variant]());
      else {
        let [alo,ahi]=resep.bounds.a,[blo,bhi]=resep.bounds.b,[clo,chi]=resep.bounds.c;
        if (variant==='kali-plus'||variant==='kali-minus') { alo=2;ahi=12; }
        if (variant==='plus-kali'||variant==='minus-kali') { blo=2;bhi=12; }
        if (variant==='kurung-kurang') { alo=3;ahi=20; blo=2;bhi=10; clo=2;chi=20; }
        a=int(alo,ahi);b=int(blo,bhi);c=int(clo,chi);
        if (variant==='kurung-kurang' && a<=b) continue;
      }
      const answer=calculate({a,b,c,operation:'campuran',variant});
      if (answer<0 || answer>400) continue;
      const id=`${a}:${b}:${c}`;
      if (history.includes(id)||(previous&&previous===id)) continue;
      const display={
        'plus-minus':`${a} + ${b} − ${c}`,'minus-plus':`${a} − ${b} + ${c}`,
        'kali-plus':`${a} × ${b} + ${c}`,'kali-minus':`${a} × ${b} − ${c}`,
        'plus-kali':`${a} + ${b} × ${c}`,'minus-kali':`${a} − ${b} × ${c}`,
        'kurung-kali':`(${a} + ${b}) × ${c}`,'kurung-kurang':`(${a} − ${b}) × ${c}`,
        'kali-bagi':`${a} × ${b} ÷ ${c}`,'bagi-plus':`${a} ÷ ${b} + ${c}`,'bagi-minus':`${a} ÷ ${b} − ${c}`,
        'plus-bagi':`${a} + ${b} ÷ ${c}`,'minus-bagi':`${a} − ${b} ÷ ${c}`,'kurung-bagi':`(${a} + ${b}) ÷ ${c}`
      }[variant];
      return {id,operation:'campuran',variant,a,b,c,answer,display,source:'default'};
    }
    throw new Error('Semua soal campuran pada level ini telah selesai. Mulai sesi baru.');
  }
  if (operation === 'akar') {
    // Akar kuadrat sempurna 1–30: melatih ingatan tabel kuadrat, bukan hitung panjang.
    const [lo,hi] = { mudah:[1,12], sedang:[1,20], sulit:[1,30] }[difficulty];
    const excluded = new Set([...history, previous]);
    for (let attempt = 0; attempt < 500; attempt++) {
      const n = lo + Math.floor(random()*(hi-lo+1));
      const a = n*n;
      const id = `√${a}`;
      if (excluded.has(id)) continue;
      return { id, a, operation:'akar', symbol:'√', answer:n, source:'default' };
    }
    throw new Error('Semua soal akar pada level ini telah selesai. Mulai sesi baru.');
  }
  const ranged = operation === 'tambah' && digits != null;
  if (ranged) {
    // Random generation: digit ranges (up to 5 digits) are far too large to enumerate.
    const { min, max } = digitsRange(digits);
    const size = max - min + 1;
    const excluded = new Set(history);
    if (previous) excluded.add(previous);
    for (let attempt = 0; attempt < 500; attempt++) {
      const a = min + Math.floor(random() * size);
      const b = min + Math.floor(random() * size);
      if (!excluded.has(`${a}:${b}`) && (!skill || skillForQuestion({a,b,operation})===skill)) {
        const question = { a, b, operation, symbol: SYMBOLS[operation], source: 'default' };
        return {...question, skillId: skillForQuestion(question), strategyId: SKILL_DEFINITIONS[skillForQuestion(question)]?.strategyId};
      }
    }
    throw new Error('Semua soal pada digit ini telah selesai. Mulai sesi baru.');
  }
  const key = `${operation}:${difficulty}`;
  if (!pools.has(key)) {
    const pool = [];
    for (let a = MINIMUMS[difficulty]; a <= LIMITS[difficulty]; a++) {
      for (let b = 0; b <= LIMITS[difficulty]; b++) {
        if (isQuestionValid({ a, b }, operation, difficulty)) pool.push({ a, b });
      }
    }
    pools.set(key, pool);
  }
  const excluded = new Set([...history, previous]);
  const available = pools.get(key).filter(q => !excluded.has(`${q.a}:${q.b}`) && (!skill || skillForQuestion({...q,operation})===skill));
  if (!available.length) throw new Error('Semua soal pada level ini telah selesai. Mulai sesi baru.');
  const q = available[Math.min(available.length - 1, Math.max(0, Math.floor(random() * available.length)))];
  const question = { ...q, operation, symbol: SYMBOLS[operation], source: 'default' };
  return {...question, skillId: skillForQuestion(question), strategyId: SKILL_DEFINITIONS[skillForQuestion(question)]?.strategyId};
}

export function hintFor(q) {
  if (q.operation === 'iq') return q.hint;
  if (q.operation === 'campuran') {
    if (q.variant?.includes('kurung')) return 'Kerjakan isi tanda kurung lebih dulu, baru sisanya.';
    if (q.variant?.includes('bagi')) return 'Bagi dikerjakan sebelum tambah atau kurang.';
    if (q.variant?.includes('kali')) return 'Kerjakan perkalian dulu, lalu tambah atau kurang.';
    return 'Kerjakan dari kiri ke kanan.';
  }
  if (q.operation === 'akar') return `Cari angka yang jika dipangkat dua hasilnya ${q.a}.`;
  if (q.operation === 'kuadrat') return `Kalikan ${q.a} dengan dirinya sendiri.`;
  if (q.operation === 'kubik') return `Kalikan ${q.a} sebanyak tiga kali.`;
  if (q.operation === 'tambah') return `Mulai dari ${q.a}, lalu tambah ${q.b}.`;
  if (q.operation === 'kurang') return `Mulai dari ${q.a}, lalu hitung mundur ${q.b}.`;
  if (q.operation === 'kali') return `Jumlahkan ${q.a} sebanyak ${q.b} kali.`;
  return `Cari angka yang jika dikali ${q.b}, hasilnya ${q.a}.`;
}

const IQ_ADVANCED_TOPICS = ['analogy','oddone','matrix','logic'];

export function generateIQ({difficulty, topic = 'mixed', history = [], previous = ''}, random = Math.random) {
  if (!Object.hasOwn(LIMITS, difficulty)) throw new Error('Level tidak valid.');
  const pool = IQ_ADVANCED_TOPICS.includes(topic) ? iqAdvancedPool(topic, difficulty, random) : iqSequencePool(topic, difficulty);
  const available = pool.filter(q => !history.includes(q.id) && q.id !== previous);
  if (!available.length) throw new Error('Mulai sesi baru untuk soal berikutnya.');
  return available[Math.min(available.length - 1, Math.max(0, Math.floor(random() * available.length)))];
}

function iqSequencePool(topic, difficulty) {
  const pool = [];
  const groups={basic:['add','subtract'],multiply:['multiply'],growing:['growing'],alternate:['alternate'],square:['square'],fibonacci:['fibonacci'],double:['double'],mixedops:['mixedops']};
  const types=topic==='mixed' ? (difficulty==='mudah'?['add','subtract']:difficulty==='sedang'?['multiply','growing']:['alternate','square']) : groups[topic];
  if (!types) throw new Error('Jenis IQ tidak valid.');
  for (let start = 1; start <= ({mudah:15,sedang:25,sulit:35}[difficulty]); start++) {
    for (let step = 2; step <= 7; step++) {
      for (const type of types) {
        let sequence, hint;
        if (type === 'add') { sequence=Array.from({length:5},(_,i)=>start+i*step); hint=`Selisih setiap angka tetap: tambah ${step}.`; }
        if (type === 'subtract') { sequence=Array.from({length:5},(_,i)=>start+(4-i)*step); hint=`Selisih setiap angka tetap: kurangi ${step}.`; }
        if (type === 'multiply') { const factor=step%2+2; sequence=Array.from({length:5},(_,i)=>start*factor**i); hint=`Kalikan angka sebelumnya dengan ${factor}.`; }
        if (type === 'growing') { sequence=Array.from({length:5},(_,i)=>start+i*step+i*(i-1)/2); hint=`Selisih dimulai dari ${step}, lalu bertambah 1 setiap langkah.`; }
        if (type === 'alternate') { sequence=[start,start+step,start+step+1,start+2*step+1,start+2*step+2]; hint=`Dua langkah bergantian: tambah ${step}, lalu tambah 1.`; }
        if (type === 'square') { sequence=Array.from({length:5},(_,i)=>(start+i)**2+step); hint=`Kuadrat bilangan berurutan, masing-masing ditambah ${step}.`; }
        if (type === 'fibonacci') { sequence=[start,step,start+step,start+2*step,2*start+3*step]; hint='Setiap angka adalah jumlah dua angka sebelumnya.'; }
        if (type === 'double') { sequence=Array.from({length:5},(_,i)=>start*2**i+(2**i-1)); hint='Kalikan dua, lalu tambah satu.'; }
        if (type === 'mixedops') { sequence=[start,start+step,(start+step)*2,(start+step)*2+step,((start+step)*2+step)*2]; hint=`Operasi bergantian: tambah ${step}, lalu kali 2.`; }
        const id=sequence.slice(0,4).join(':');
        if (!pool.some(q=>q.id===id)) pool.push({id,operation:'iq',sequence:sequence.slice(0,4),answer:sequence[4],hint,source:'default',type});
      }
    }
  }
  return pool;
}

function iqAdvancedPool(topic, difficulty, random) {
  const [lo, hi] = {mudah:[2,6], sedang:[3,9], sulit:[4,12]}[difficulty];
  const pool = [];
  if (topic === 'analogy') {
    for (let a=lo; a<=hi; a++) for (let b=lo; b<=hi; b++) for (const k of [2,3,4]) {
      pool.push(analogyQ(a, b, a*k, b*k, `× ${k}`, `${b} × ${k}`));
      pool.push(analogyQ(a, b, a+k, b+k, `+ ${k}`, `${b} + ${k}`));
      if (difficulty === 'sulit') pool.push(analogyQ(a, b, a*a, b*b, 'dikuadratkan', `${b}²`));
    }
  } else if (topic === 'oddone') {
    const specs = [
      {desc:'bilangan genap', match:n => n%2===0},
      {desc:'bilangan ganjil', match:n => n%2===1},
      {desc:'kelipatan 3', match:n => n%3===0},
      {desc:'kelipatan 5', match:n => n%5===0},
      {desc:'bilangan prima', match:isPrime},
      {desc:'bilangan kuadrat', match:n => Number.isInteger(Math.sqrt(n))},
    ];
    const ranges = {mudah:[[2,30],[30,60],[60,90]], sedang:[[3,60],[40,90],[80,130]], sulit:[[5,100],[80,150],[140,210]]}[difficulty];
    for (const spec of specs) for (const [rlo, rhi] of ranges) {
      const matches=[];
      for (let n=rlo; n<=rhi && matches.length<5; n++) if (spec.match(n)) matches.push(n);
      if (matches.length < 5) continue;
      let mismatch = rlo; while (spec.match(mismatch)) mismatch++;
      const nums = shuffle([...matches.slice(0,4), mismatch], random);
      pool.push({id:`oddone:${nums.join(':')}`, operation:'iq', type:'oddone', sequence:nums, answer:mismatch, hint:`Cari angka yang bukan ${spec.desc}.`, display:nums.join(', '), prompt:'Mana yang tidak cocok?', source:'default'});
    }
  } else if (topic === 'matrix') {
    for (let x=lo; x<=hi; x++) for (const k of [2,3]) {
      const rows = [[x,x*k,x*k*k],[x+1,(x+1)*k,(x+1)*k*k],[x+2,(x+2)*k,(x+2)*k*k]];
      const answer = rows[1][2];
      const flat = [rows[0][0],rows[0][1],rows[0][2],rows[1][0],rows[1][1],rows[2][0],rows[2][1],rows[2][2]];
      pool.push({id:`matrix:${flat.join(':')}`, operation:'iq', type:'matrix', sequence:flat, answer, hint:`Setiap baris dikali ${k} berurutan.`, display:`${rows[0][0]} · ${rows[0][1]} · ${rows[0][2]}\n${rows[1][0]} · ${rows[1][1]} · ?\n${rows[2][0]} · ${rows[2][1]} · ${rows[2][2]}`, prompt:'Isi kotak yang kosong.', source:'default'});
    }
  } else if (topic === 'logic') {
    // Rasio & logika sehari-hari: skala produksi dan perbandingan umur.
    for (let a=2; a<=4; a++) for (let c=2; c<=5; c++) {
      if (a === c) continue;
      const perWorker = a, totalMade = a*perWorker;
      pool.push({id:`logic:unit:${a}:${c}`, operation:'iq', type:'logic', sequence:[a,c], answer:c*perWorker, hint:`${a} pekerja membuat ${totalMade} unit → 1 pekerja membuat ${perWorker} unit.`, display:`${a} pekerja membuat ${totalMade} unit. Berapa unit yang dibuat ${c} pekerja?`, prompt:'Hitung skalanya.', source:'default'});
    }
    for (let y=2; y<=6; y++) {
      const budi = 3, ani = budi*y, total = budi+ani;
      pool.push({id:`logic:umur:${y}`, operation:'iq', type:'logic', sequence:[y,total], answer:ani, hint:`Misal umur Budi = x, maka Ani = ${y}x. Jumlahnya ${total}, jadi ${y+1}x = ${total}.`, display:`Umur Ani ${y} kali umur Budi. Jumlah umur keduanya ${total} tahun. Berapa umur Ani?`, prompt:'Hitung umurnya.', source:'default'});
    }
  }
  return pool;
}

function isPrime(n) { if (n < 2) return false; for (let i = 2; i*i <= n; i++) if (n % i === 0) return false; return true; }

function analogyQ(a, b, left, answer, relLabel, how) {
  return {id:`analogy:${a}:${left}:${b}`, operation:'iq', type:'analogy', sequence:[a,left,b], answer, hint:`${a} → ${left} (${relLabel}). Lakukan hal yang sama ke ${b}: ${how}.`, display:`${a} : ${left}  ::  ${b} : ?`, prompt:'Lengkapi analogi angkanya.', source:'default'};
}

function shuffle(arr, random) {
  const a = arr.slice();
  for (let i=a.length-1; i>0; i--) { const j=Math.floor(random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}

// Bungkus soal aritmetika biasa menjadi soal cerita: angka tetap, bingkainya berganti.
export function frameStory({a,b,operation},random=Math.random) {
  const pick=(list)=>list[Math.floor(random()*list.length)];
  const names=['Rina','Budi','Sari','Dedi','Maya','Andi','Fitri','Joko','Wulan','Nadia','Pak Hasan','Bu Wati'];
  const n=pick(names);
  const frames={
    tambah:[
      [`${n} punya ${a} koin, lalu menemukan ${b} koin lagi di saku jaket.`,'Berapa jumlah koinnya sekarang?'],
      [`Sebuah bus membawa ${a} penumpang, lalu ${b} orang naik di halte berikutnya.`,'Berapa penumpang di bus sekarang?'],
      [`${n} menyiram ${a} bibit tomat, lalu ${b} bibit cabai pagi ini.`,'Berapa bibit yang disiram semuanya?'],
      [`Di kandang ada ${a} ayam, lalu ${b} anak ayam menetas.`,'Berapa jumlah ayamnya sekarang?']
    ],
    kurang:[
      [`${n} membawa ${a} koin, lalu ${b} koin terpakai untuk makan siang.`,'Berapa koin yang tersisa?'],
      [`Di rak ada ${a} buku, lalu ${b} buku dipinjam kakak.`,'Berapa buku yang tersisa di rak?'],
      [`${n} menimbang ${a} kg beras, lalu ${b} kg dimasak untuk acara.`,'Berapa kg beras yang tersisa?'],
      [`Tangki bensin berisi ${a} liter, lalu ${b} liter terpakai di perjalanan.`,'Berapa liter bensin yang tersisa?']
    ],
    kali:[
      [`${n} membeli ${b} kotak telur di pasar. Setiap kotak berisi ${a} butir telur.`,'Berapa jumlah seluruh telurnya?'],
      [`Ada ${b} rak buku di perpustakaan. Setiap rak berisi ${a} buku.`,'Berapa jumlah seluruh bukunya?'],
      [`${n} menanam ${b} baris pohon, tiap baris berisi ${a} pohon.`,'Berapa jumlah seluruh pohonnya?'],
      [`Sebungkus berisi ${a} permen, ada ${b} bungkus di toko.`,'Berapa jumlah seluruh permennya?']
    ],
    bagi:[
      [`${n} membuat ${a} kue ulang tahun, lalu membaginya rata kepada ${b} teman.`,'Berapa kue untuk setiap teman?'],
      [`Sebanyak ${a} kue dimasukkan rata ke dalam ${b} kotak.`,'Berapa isi setiap kotak?'],
      [`${n} punya ${a} kelereng, dibagi rata ke ${b} kaleng.`,'Berapa kelereng tiap kaleng?'],
      [`Ada ${a} lembar stiker dibagikan ke ${b} anak.`,'Berapa stiker tiap anak?']
    ]
  };
  const [story,question]=pick(frames[operation]||frames.tambah);
  return {story,question};
}

// Tantangan tabel: menguji baris yang persis sama dengan tabel yang baru dilihat.
// Berbeda dari soal operasi di beranda — angka acuan (perkalian berapa) tetap, lawannya 1..30.
export function generateTableChallenge({ operation, number, lo = 1, hi = 30, history = [], previous = '' }, random = Math.random) {
  const rows = referenceRows(operation, number).slice(lo - 1, hi);
  const excluded = new Set([...history, previous]);
  const available = rows.filter(row => !excluded.has(row.display || `${row.a}:${row.b}`));
  if (!available.length) throw new Error('Semua soal tabel ini sudah terpakai. Mulai sesi baru.');
  const q = available[Math.min(available.length - 1, Math.max(0, Math.floor(random() * available.length)))];
  return { id: q.display || `${q.a}:${q.b}`, operation, symbol: q.symbol, a: q.a, b: q.b, answer: q.answer, source: 'default' };
}

export function referenceRows(operation, number = 2) {
  if (operation === 'akar') {
    if (!Number.isInteger(number) || number<1 || number>30) throw new Error('Tabel tidak valid.');
    return Array.from({length:30},(_,i)=>{
      const n=i+1, a=n*n;
      return {a, answer:n, symbol:'√', display:`√${a}`};
    });
  }
  if (operation === 'kuadrat') return Array.from({length:30},(_,i)=>{ const n=i+1; return {a:n, answer:n*n, symbol:'²', display:`${n}²`}; });
  if (operation === 'kubik') return Array.from({length:30},(_,i)=>{ const n=i+1; return {a:n, answer:n*n*n, symbol:'³', display:`${n}³`}; });
  if (!Object.hasOwn(SYMBOLS,operation) || !Number.isInteger(number) || number<1 || number>30) throw new Error('Tabel tidak valid.');
  return Array.from({length:30},(_,i)=>{
    const n=i+1;
    const a=operation==='bagi' ? number*n : operation==='kurang' ? number+n : number;
    const b=operation==='bagi'||operation==='kurang' ? number : n;
    return {a,b,answer:calculate({a,b,operation}),symbol:SYMBOLS[operation]};
  });
}

export const AI_LESSONS = [
  {id:'place',title:'Nilai tempat',icon:'10',intro:'Mulai dari cara satuan, puluhan, dan ratusan membentuk sebuah angka.',formula:'347 = 300 + 40 + 7',example:'Digit 4 pada 347 bernilai 40.',hint:'Perhatikan posisi digit dari kanan.',source:'EEF · lintasan belajar'},
  {id:'mental',title:'Hitung lentur',icon:'±',intro:'Pecah angka menjadi bagian yang lebih mudah, lalu gabungkan kembali.',formula:'38 + 27 = 38 + 20 + 7',example:'38 + 20 = 58, lalu +7 = 65.',hint:'Pisahkan puluhan dan satuan.',source:'EEF · kefasihan strategi'},
  {id:'fractions',title:'Pecahan',icon:'½',intro:'Pecahan menunjukkan bagian dari satu keseluruhan yang dibagi sama besar.',formula:'½ dari n = n ÷ 2',example:'½ dari 12 = 6.',hint:'Bagi angka dengan penyebutnya.',source:'EEF · representasi'},
  {id:'decimals',title:'Desimal',icon:'0,1',intro:'Desimal adalah cara lain menulis persepuluhan dan perseratusan.',formula:'0,1 × n = n ÷ 10',example:'0,1 × 80 = 8.',hint:'Geser satu nilai tempat ke kanan.',source:'EEF · representasi'},
  {id:'ratio',title:'Rasio',icon:':',intro:'Rasio membandingkan dua jumlah dan menjaga hubungan keduanya.',formula:'a : b = ka : kb',example:'2 : 3, jika 2 menjadi 4 maka 3 menjadi 6.',hint:'Kalikan kedua sisi dengan angka yang sama.',source:'EEF · penalaran multiplikatif'},
  {id:'money',title:'Uang & diskon',icon:'Rp',intro:'Latih perkiraan harga, kembalian, dan diskon untuk keputusan sehari-hari.',formula:'harga akhir = harga − diskon',example:'Rp100 ribu diskon 20% menjadi Rp80 ribu.',hint:'Cari nilai diskon, lalu kurangkan.',source:'Adult numeracy · konteks nyata'},
  {id:'measurement',title:'Ukuran & waktu',icon:'↔',intro:'Gunakan satuan untuk membaca jarak, durasi, berat, dan kapasitas.',formula:'1 jam = 60 menit',example:'2 jam = 120 menit.',hint:'Kalikan jumlah jam dengan 60.',source:'Adult numeracy · konteks nyata'},
  {id:'basics',title:'Persen',icon:'%',intro:'Persen berarti per seratus dan membantu membaca diskon, bunga, serta data.',formula:'p% dari n = n × p ÷ 100',example:'20% dari 50 = 10.',hint:'Ubah persen menjadi bagian dari seratus.',source:'EEF · proporsi'},
  {id:'algebra',title:'Fungsi & bobot',icon:'ƒ',intro:'Model AI bekerja seperti mesin: menerima input, lalu memprosesnya menjadi prediksi. Bobot menentukan seberapa besar pengaruh tiap input.',formula:'y = w × x + b',example:'x = 3, w = 2, b = 1 → y = 7',hint:'Kalikan bobot dengan input, lalu tambah bias.'},
  {id:'vectors',title:'Vektor',icon:'→',intro:'Vektor menyimpan beberapa angka sekaligus. Dot product menggabungkan tiap fitur dengan bobotnya menjadi satu nilai.',formula:'[a, b] · [c, d] = a×c + b×d',example:'[2, 3] · [4, 1] = 8 + 3 = 11',hint:'Kalikan pasangan angka pada posisi yang sama, lalu jumlahkan.'},
  {id:'mean',title:'Rata-rata data',icon:'μ',intro:'Rata-rata merangkum pusat data. Ini cara AI "merasakan" kumpulan angka sebelum mulai belajar.',formula:'Rata-rata = jumlah nilai ÷ banyak nilai',example:'[2, 4, 6] → (2 + 4 + 6) ÷ 3 = 4',hint:'Jumlahkan semua nilai, lalu bagi dengan banyaknya nilai.'},
  {id:'probability',title:'Peluang',icon:'%',intro:'Peluang menyatakan seberapa mungkin suatu kejadian. AI menyajikan prediksi sebagai peluang, misalnya "80% yakin".',formula:'Peluang (%) = bagian ÷ total × 100',example:'3 dari 10 sampel → 30%',hint:'Bagi jumlah kejadian dengan total, lalu kalikan 100.'},
  {id:'gradient',title:'Gradien & belajar',icon:'∇',intro:'Gradien menunjukkan arah perubahan. Model belajar dengan bergerak berlawanan arah gradien untuk memperkecil kesalahan.',formula:'L(w) = w² → gradien = 2w',example:'w = 3 → gradien = 6.',hint:'Untuk fungsi kuadrat ini, gradien adalah dua kali bobot w.',source:'Matematika mesin'},
  {id:'estimation',title:'Estimasi',icon:'≈',intro:'Estimasi membantu memeriksa apakah jawaban masuk akal sebelum menghitung tepat.',formula:'47 × 21 ≈ 50 × 20',example:'50 × 20 = 1.000, jadi hasil tepat seharusnya dekat.',hint:'Bulatkan ke puluhan terdekat.',source:'EEF · metakognisi'},
  {id:'himpunan',title:'Himpunan bilangan',icon:'∈',intro:'Himpunan bilangan mengelompokkan angka berdasarkan sifatnya. Bilangan asli (ℕ) dipakai menghitung: 1, 2, 3, … Bilangan bulat (ℤ) menambah nol dan angka negatif. Bilangan rasional (ℚ) menambah pecahan. Bilangan riil (ℝ) menampung semuanya, termasuk akar dan π. Tiap himpunan bersarang di dalam himpunan berikutnya.',formula:'ℕ ⊂ ℤ ⊂ ℚ ⊂ ℝ',example:'−3 ∈ ℤ dan ℝ, tapi −3 ∉ ℕ · ½ ∈ ℚ dan ℝ, tapi ½ ∉ ℤ',hint:'Urutan bersarang dari kecil ke besar: Asli (ℕ) ⊂ Bulat (ℤ) ⊂ Rasional (ℚ) ⊂ Riil (ℝ).',source:'Matematika dasar',analogy:'Bayangkan himpunan bilangan seperti kotak bersarang ala boneka matryoshka. Kotak terkecil berisi bilangan asli, kotak berikutnya (bulat) membungkusnya, lalu kotak rasional, dan kotak terluar adalah bilangan riil. Bilangan 3 tinggal di kotak paling dalam, −3 hanya boleh tinggal di kotak yang lebih lebar, dan π hanya muat di kotak terluar.',visual:{type:'formula',values:[],labels:['ℕ ⊂ ℤ ⊂ ℚ ⊂ ℝ','bilangan riil']},simulation:{title:'Kotak bersarang',frames:[{caption:'Bilangan asli ℕ: 1, 2, 3, …',type:'formula',values:[],labels:['ℕ','1, 2, 3, …']},{caption:'Bulat ℤ menambah 0 dan negatif',type:'formula',values:[],labels:['ℤ','…, −2, −1, 0, 1, 2, …']},{caption:'Rasional ℚ menambah pecahan',type:'formula',values:[],labels:['ℚ','½, ⅓, 0,75, …']},{caption:'Riil ℝ menampung semuanya',type:'formula',values:[],labels:['ℝ','−3, ½, √2, π, …']},{caption:'Semua bersarang: ℕ ⊂ ℤ ⊂ ℚ ⊂ ℝ',type:'formula',values:[],labels:['urutan','ℕ ⊂ ℤ ⊂ ℚ ⊂ ℝ']}]}}
];

// Referensi pelengkap dari lembaga pendidikan/riset dunia: penjelasan punya
// rujukan yang bisa dicek pembaca, bukan sekadar klaim.
export const REFERENCES = Object.freeze({
  himpunan: [
    'MIT OpenCourseWare · 6.042J Mathematics for Computer Science — konsep himpunan & klasifikasi bilangan',
    'Stanford Encyclopedia of Philosophy · entri "Set Theory"',
    'Harvard Mathematics Department · materi pengantar bilangan & himpunan',
    'Oxford Mathematics · kuliah umum matematika dasar',
    'NCTM (National Council of Teachers of Mathematics) · standar Number & Operations'
  ],
  _umum: [
    'EEF (Education Endowment Foundation) · "Improving Mathematics in Key Stages 2 and 3"',
    'Khan Academy · kursus aritmetika dasar',
    'NCTM · Principles and Standards for School Mathematics',
    'MIT OpenCourseWare · 6.042J Mathematics for Computer Science — dasar bilangan & logika',
    'Stanford · youcubed (Jo Boaler) — riset pola pikir & kelancaran berhitung',
    'Harvard Mathematics Department · materi pengantar bilangan',
    'Oxford Mathematics · kuliah umum aritmetika & bilangan',
    'Columbia University · Department of Mathematics — aritmetika & aljabar dasar',
    'OSN (Olimpiade Sains Nasional Indonesia) · soal bilangan & penalaran',
    'Singapore Math / MOE Singapore · Primary Mathematics — strategi model & mental math',
    'CMO (Chinese Mathematical Olympiad) · soal bilangan & trik hitung cepat',
    'SASMO · Singapore & Asian Schools Math Olympiad — latihan berpikir cepat'
  ]
});
export function referencesFor(topicId) {
  return REFERENCES[topicId] || (METHODS[topicId] ? REFERENCES._umum : []);
}

// Metode praktis per materi: cara cepat yang diajarkan aplikasi, dipakai panduan,
// jawaban Asisten Belajar, dan penjelasan operasi campuran.
export const METHODS = Object.freeze({
  tambah:[
    {name:'Pasangan 10',how:'Cari pasangan yang jumlahnya 10 lebih dulu (7 + 3), lalu tambahkan sisanya.'},
    {name:'Pecah puluhan',how:'38 + 27 → 38 + 20 = 58, lalu + 7 = 65. Puluhan dulu, satuan kemudian.'},
    {name:'Hitung maju',how:'Mulai dari angka terbesar, lalu hitung maju sebanyak angka kedua.'},
    {name:'Komplemen 100',how:'Dekati angka bulat: 67 + 35 = 67 + 33 + 2 = 102. Cari pasangan ke puluhan/ratusan bulat.'},
    {name:'Tambah 9 & 11',how:'+9 = +10 lalu −1; +11 = +10 lalu +1: 45 + 9 = 54.'}
  ],
  kurang:[
    {name:'Hitung mundur',how:'Mulai dari angka pertama, hitung mundur sebanyak angka kedua.'},
    {name:'Hitung maju ke atas',how:'Cari selisih dengan maju dari angka kedua: 63 − 58 → 58 ke 60 ke 63 = 5.'},
    {name:'Kurang bertahap',how:'63 − 20 = 43, lalu 43 − 8 = 35. Pisahkan puluhan dan satuan.'},
    {name:'Kurang 9 & 11',how:'−9 = −10 lalu +1; −11 = −10 lalu −1: 63 − 9 = 54.'},
    {name:'Pembulatan ke atas',how:'Pecah pengurang: 83 − 27 = 83 − 30 + 3 = 56.'}
  ],
  kali:[
    {name:'Dobel bertingkat',how:'×2 dobel sekali, ×4 dobel dua kali, ×8 dobel tiga kali: 7 × 8 = 14 → 28 → 56.'},
    {name:'Kali 10 lalu geser',how:'×5 = setengah dari ×10; ×9 = ×10 kurang sekali angka: 9 × 7 = 70 − 7 = 63.'},
    {name:'Tukar urutan',how:'8 × 3 sama dengan 3 × 8 — pilih urutan yang paling kamu hafal.'},
    {name:'Kali 11 cepat',how:'Pisah dua digit, jumlahkan di tengah: 32 × 11 = 352.'},
    {name:'Kali dengan pembulatan',how:'9 × 46 = 10 × 46 − 46 = 414. Bulatkan ke angka mudah, lalu koreksi.'}
  ],
  bagi:[
    {name:'Kebalikan perkalian',how:'Tanya "penyebutnya dikali berapa supaya hasilnya angka ini?" 56 ÷ 8 → 8 × 7 = 56.'},
    {name:'Bagi bertahap',how:'Bagi dua berulang: 96 ÷ 8 = 48 ÷ 4 = 24 ÷ 2 = 12.'},
    {name:'Tabel perkalian',how:'Hafalkan tabel 1–10; pembagian jadi otomatis.'},
    {name:'Bagi dengan 5',how:'÷5 = kali 2 lalu bagi 10: 85 ÷ 5 = 170 ÷ 10 = 17.'},
    {name:'Faktor bersama',how:'Sederhanakan dulu: 48 ÷ 6 = 24 ÷ 3 = 8. Bagi kedua sisi dengan angka sama.'}
  ],
  'bagi-bersusun':[
    {name:'Bagi-Kali-Kurang-Turunkan',how:'Satu putaran: berapa kali pembagi muat → tulis di atas; kali; kurang; turunkan digit berikutnya. Ulangi sampai habis.'},
    {name:'Mulai dari kiri',how:'Kerjakan digit terdepan dulu: 864 ÷ 4 mulai dari 8, bukan dari 4.'},
    {name:'Sisa digandakan',how:'Sisa selalu digabung digit berikutnya: sisa 2 lalu turunkan 4 menjadi 24, bukan 2 dan 4 terpisah.'},
    {name:'Cek dengan kali balik',how:'Hasil × pembagi harus kembali ke angka awal: 216 × 4 = 864 berarti benar.'}
  ],
  'kali-bersusun':[
    {name:'Pecah per nilai tempat',how:'34 × 12 → (34 × 2) + (34 × 10) = 68 + 340 = 408. Satuan dulu, puluhan kemudian.'},
    {name:'Susun lalu turun',how:'Tulis 34 di atas 12, beri garis. Kalikan ke bawah per digit pengali, satu baris hasil sebagian per digit.'},
    {name:'Baris kedua bergeser',how:'Digit puluhan menghasilkan baris yang bergeser satu tempat ke kiri — sama saja dikali sepuluh.'},
    {name:'Cek dengan perkiraan',how:'34 × 12 ≈ 34 × 10 + 34 × 2 = 408. Perkiraan cepat menangkap salah geser tempat.'}
  ],
  campuran:[
    {name:'PEMDAS / KUKABATAKU',how:'Urutannya: Kurung → Eksponen (pangkat) → Kali dan Bagi (kiri ke kanan) → Tambah dan Kurang (kiri ke kanan).'},
    {name:'Tandai dulu, hitung kemudian',how:'Lingkari bagian perkalian lebih dulu, ganti dengan hasilnya, baru kerjakan tambah atau kurang.'},
    {name:'Satu langkah kecil',how:'Tulis hasil antara di kertas: 3 + 4 × 2 → 4 × 2 = 8 → 3 + 8 = 11.'}
  ],
  iq:[
    {name:'Cek selisih',how:'Hitung selisih antar angka. Selisih tetap berarti pola tambah atau kurang.'},
    {name:'Cek rasio',how:'Bagi angka kedua dengan angka pertama. Rasio tetap berarti pola kali.'},
    {name:'Cek selisih bertingkat',how:'Bila selisihnya berubah teratur (naik 1, 2, 3), polanya ada di lapisan kedua.'}
  ],
  analogy:[
    {name:'Temukan hubungan kiri',how:'Cari dulu hubungan antara angka pertama dan kedua (tambah, kali, atau kuadrat), lalu terapkan hubungan yang sama ke pasangan kanan.'},
    {name:'Uji tiap operasi',how:'Coba +, ×, atau kuadrat pada pasangan kiri. Pilih yang hasilnya cocok, lalu pakai untuk angka di sebelah kanan.'},
    {name:'Tulis sebagai rumus',how:'A : B dianggap A → B. Misal 3 : 9 berarti "dikali 3". Lalu pasangkan angka kiri bawah dengan aturan itu.'}
  ],
  oddone:[
    {name:'Kelompokkan ciri',how:'Periksa satu sifat: genap/ganjil, kelipatan, atau bilangan prima. Tandai yang tidak ikut kelompok mayoritas.'},
    {name:'Coret yang sama',how:'Buang angka-angka yang jelas sekelompok (misal semua genap). Sisanya satu angka adalah jawabannya.'},
    {name:'Cek satu per satu',how:'Tanya "angka ini masuk kelompok apa?" untuk tiap pilihan. Yang tidak masuk kelompok mana pun adalah ganjilnya.'}
  ],
  matrix:[
    {name:'Baca per baris',how:'Lihat pola dalam satu baris dari kiri ke kanan. Biasanya tiap baris mengikuti aturan yang sama.'},
    {name:'Cek antar kolom',how:'Bila barisnya tidak jelas, bandingkan angka ke bawah per kolom. Pola bisa juga menurun.'},
    {name:'Temukan faktor pengali',how:'Bila tiap langkah bertambah dengan kali yang sama, temukan pengalinya lalu terapkan ke kotak kosong.'}
  ],
  logic:[
    {name:'Cari nilai per satu',how:'Bagi total dengan jumlahnya untuk mendapat nilai satu unit, lalu kalikan sesuai yang ditanya.'},
    {name:'Pakai perbandingan',how:'Tulis perbandingan dua situasi sebagai pecahan. Gunakan aturan silang untuk mencari angka yang belum diketahui.'},
    {name:'Sederhanakan angka',how:'Pilih angka kecil dan mudah dibagi supaya rasionya bulat. Jawaban harus masuk akal dan bulat.'}
  ],
  story:[
    {name:'Tandai angka penting',how:'Garis bawahi angka dan satuannya, abaikan kalimat hiasan.'},
    {name:'Kata kunci operasi',how:'"total atau seluruhnya" → tambah/kali; "sisa atau terpakai" → kurang; "dibagi rata atau setiap" → bagi.'},
    {name:'Periksa kewajaran',how:'Estimasi kasar lebih dulu: jawaban yang masuk akal biasanya dekat dengan perkiraanmu.'}
  ]
});

// Pertanyaan pembuka di kolom chat: menyangkut tantangan yang ada di aplikasi.
export const CHAT_STARTERS = Object.freeze([
  'Jelaskan urutan operasi campuran (KUKABATAKU)',
  'Cara cepat menjumlahkan angka besar?',
  'Tips menghafal tabel perkalian',
  'Kapan soal cerita memakai pembagian?',
  'Cara menemukan pola angka berikutnya',
  'Bedanya pembagian dan pecahan?'
]);

// Daftar materi panduan: id dipakai AI, group untuk daftar isi, brief memberi konteks ke model.
export const GUIDE_TOPICS = [
  {id:'tambah',title:'Penjumlahan',icon:'+',group:'Dasar berhitung',brief:'menggabungkan dua kelompok menjadi satu total'},
  {id:'kurang',title:'Pengurangan',icon:'−',group:'Dasar berhitung',brief:'mengambil sebagian dari suatu bilangan'},
  {id:'kali',title:'Perkalian',icon:'×',group:'Dasar berhitung',brief:'penjumlahan berulang dari angka yang sama'},
  {id:'bagi',title:'Pembagian',icon:'÷',group:'Dasar berhitung',brief:'membagi bilangan menjadi bagian yang sama besar'},
  {id:'bagi-bersusun',title:'Pembagian bersusun',icon:'⟌',group:'Dasar berhitung',brief:'pembagian panjang bertahap: bagi, kali, kurang, lalu turunkan digit berikutnya sampai habis',local:true},
  {id:'kali-bersusun',title:'Perkalian bersusun',icon:'✕',group:'Dasar berhitung',brief:'mengalikan per nilai tempat: satuan dulu, lalu puluhan bergeser, lalu jumlahkan hasil sebagian',local:true},
  {id:'campuran',title:'Operasi campuran',icon:'±×',group:'Dasar berhitung',brief:'urutan operasi tambah, kurang, dan kali dalam satu soal; kali dulu baru tambah-kurang, tanda kurung dikerjakan lebih dulu'},
  {id:'story',title:'Soal cerita',icon:'✎',group:'Keterampilan',brief:'mengubah kejadian sehari-hari menjadi soal berhitung dengan menemukan angka pentingnya'},
  {id:'iq',title:'Pola angka',icon:'⋯',group:'Keterampilan',brief:'menemukan aturan di balik deretan angka lalu menerapkannya'},
  {id:'analogy',title:'Analogi angka',icon:'↔',group:'Keterampilan',brief:'menemukan hubungan antara sepasang angka lalu menerapkannya ke pasangan lain'},
  {id:'oddone',title:'Ganjil satu keluar',icon:'≠',group:'Keterampilan',brief:'menemukan satu angka yang tidak masuk kelompok di antara angka-angka lainnya'},
  {id:'matrix',title:'Matriks angka',icon:'▦',group:'Keterampilan',brief:'mengisi kotak kosong pada susunan angka berdasarkan pola baris atau kolom'},
  {id:'logic',title:'Logika & rasio',icon:'⚖',group:'Keterampilan',brief:'menghitung perbandingan dan proporsi untuk soal logika sehari-hari'},
  ...AI_LESSONS.map(l=>({id:l.id,title:l.title,icon:l.icon,group:'Materi lanjutan',brief:l.formula}))
];

// ---- Papan hitung bersusun: bingkai simulasi langkah demi langkah ----
// Tiap frame adalah satu keadaan papan yang digambar ulang app (kind 'bagi'|'kali').
export function simBersusunBagi(a, b) {
  const digits = [...String(a)];
  const qCols = Array.from({ length: digits.length }, () => '');
  const frames = [{ type: 'bersusun', kind: 'bagi', caption: `Kita bagi ${a} dengan ${b}. Mulai dari digit paling kiri.`, a: String(a), b, qCols: [...qCols], qActive: -1, dActive: 0, work: '', bring: null, answer: null }];
  let r = 0, wrote = false;
  digits.forEach((ch, i) => {
    const cur = r * 10 + Number(ch);
    const dig = Math.floor(cur / b);
    r = cur % b;
    if (dig > 0) wrote = true;
    if (wrote) qCols[i] = String(dig);
    const last = i === digits.length - 1;
    frames.push({
      type: 'bersusun', kind: 'bagi',
      caption: wrote
        ? `Berapa kali ${b} muat di ${cur}? ${cur} ÷ ${b} = ${dig}${r ? ` sisa ${r}` : ''} → tulis ${dig} di atas.`
        : `${cur} masih lebih kecil dari ${b} → gabungkan dengan digit berikutnya.`,
      a: String(a), b, qCols: [...qCols], qActive: wrote ? i : -1, dActive: i,
      work: wrote ? `${cur} ÷ ${b} = ${dig} · ${dig} × ${b} = ${dig * b} · ${cur} − ${dig * b} = ${r}` : '',
      bring: null, answer: null,
    });
    if (!last) frames.push({
      type: 'bersusun', kind: 'bagi',
      caption: `${dig} × ${b} = ${dig * b} → ${cur} − ${dig * b} = ${r}. Turunkan ${digits[i + 1]} di samping sisanya.`,
      a: String(a), b, qCols: [...qCols], qActive: wrote ? i : -1, dActive: i + 1,
      work: `${dig} × ${b} = ${dig * b} · ${cur} − ${dig * b} = ${r}`,
      bring: digits[i + 1], answer: null,
    });
  });
  const hasil = qCols.join('') || '0';
  frames.push({ type: 'bersusun', kind: 'bagi', caption: `Semua digit selesai, sisanya ${r}. Jadi ${a} ÷ ${b} = ${hasil}.`, a: String(a), b, qCols: [...qCols], qActive: -1, dActive: -1, work: `Cek: ${hasil} × ${b} = ${a}`, bring: null, answer: hasil });
  return frames;
}

export function simBersusunKali(a, b) {
  const A = String(a), B = String(b);
  const frames = [{ type: 'bersusun', kind: 'kali', caption: `Kita kalikan ${a} × ${b}. Tulis bersusun, kerjakan digit satuan pengali dulu.`, a: A, b: B, partials: [], answer: null }];
  const done = [];
  for (let i = B.length - 1; i >= 0; i--) {
    const d = Number(B[i]);
    const shift = B.length - 1 - i;
    const label = shift ? 'puluhan' : 'satuan';
    let carry = 0;
    const written = [];
    [...A].reverse().forEach(c => {
      const raw = d * Number(c) + carry;
      carry = Math.floor(raw / 10);
      written.unshift(String(raw % 10));
      frames.push({
        type: 'bersusun', kind: 'kali',
        caption: `Digit ${label}: ${d} × ${c}${carry ? ` + simpan ${carry}` : ''} = ${raw} → tulis ${raw % 10}.`,
        a: A, b: B, partials: [...done.map(p => ({ ...p })), { t: written.join(''), shift, active: true }], answer: null,
      });
    });
    if (carry) {
      written.unshift(String(carry));
      frames.push({ type: 'bersusun', kind: 'kali', caption: `Simpanan ${carry} ditulis di depan. Baris ${label} selesai.`, a: A, b: B, partials: [...done.map(p => ({ ...p })), { t: written.join(''), shift, active: true }], answer: null });
    }
    done.push({ t: written.join(''), shift });
    if (i > 0) frames.push({
      type: 'bersusun', kind: 'kali',
      caption: `Baris ${label} selesai: ${written.join('')}${'0'.repeat(shift)}. Lanjut ke digit ${label === 'satuan' ? 'puluhan' : 'berikutnya'}.`,
      a: A, b: B, partials: done.map(p => ({ ...p })), answer: null,
    });
  }
  const total = a * b;
  frames.push({ type: 'bersusun', kind: 'kali', caption: `Jumlahkan hasil sebagian: ${done.map(p => p.t + '0'.repeat(p.shift)).join(' + ')} = ${total}.`, a: A, b: B, partials: done.map(p => ({ ...p })), answer: null });
  frames.push({ type: 'bersusun', kind: 'kali', caption: `Jadi ${a} × ${b} = ${total}.`, a: A, b: B, partials: done.map(p => ({ ...p })), answer: String(total) });
  return frames;
}

const GUIDE_TEXTS = {
  'bagi-bersusun':{
    intro:'Pembagian bersusun (sering disebut bagi kocor) memecah pembagian besar menjadi langkah kecil yang berulang: bagi, kali, kurang, lalu turunkan digit berikutnya — diputar terus sampai semua digit selesai.',
    analogy:'Seperti membagi 864 kue ke 4 keranjang: isi bagian ratusan dulu, lanjut puluhan, terakhir satuan. Tiap keranjang diisi bertahap, bukan sekaligus.',
    steps:['Tulis pembagi di kiri dan angka yang dibagi di kanan, beri garis atap.','Lihat digit paling kiri: berapa kali pembagi muat? Tulis hasilnya di atas garis.','Kalikan hasil itu dengan pembagi, tulis di bawah, lalu kurangkan.','Turunkan digit berikutnya di samping sisa, lalu ulangi sampai habis.'],
    example:'864 ÷ 4 → 8 ÷ 4 = 2 · 2 × 4 = 8 · 8 − 8 = 0 → turunkan 6 · 6 ÷ 4 = 1 sisa 2 → turunkan 4 → 24 ÷ 4 = 6 · Jadi 864 ÷ 4 = 216.',
    tip:'Hafalkan mantranya: Bagi · Kali · Kurang · Turunkan. Kalau selesai, cek dengan mengalikan balik — 216 × 4 = 864 berarti jawabanmu benar.',
    visual:simBersusunBagi(864,4).at(-1),
    simulation:{title:'Bagi 864 ÷ 4 langkah demi langkah',frames:simBersusunBagi(864,4)}
  },
  'kali-bersusun':{
    intro:'Perkalian bersusun mengalikan angka besar per nilai tempat: kalikan digit satuan pengali dulu, lalu digit puluhan, tulis tiap hasil sebagian, lalu jumlahkan semuanya.',
    analogy:'Seperti menghitung belanjaan: bayar 2 bungkus dulu, lalu 10 bungkus, terakhir gabungkan totalnya — daripada menghitung 12 bungkus sekaligus.',
    steps:['Tulis angkanya bersusun (satuannya sejajar) dan beri garis di bawah.','Kalikan digit satuan pengali ke setiap digit atas, tulis hasil sebagian pertama.','Kalikan digit puluhan, tulis hasil sebagian kedua bergeser satu tempat ke kiri.','Jumlahkan kedua hasil sebagian — itulah jawaban akhirnya.'],
    example:'34 × 12 → 34 × 2 = 68 · 34 × 10 = 340 · 68 + 340 = 408.',
    tip:'Baris kedua selalu bergeser satu tempat karena pengalinya puluhan. Kalau ada simpanan (carry), tulis digitnya lalu simpan sisanya untuk kolom berikutnya.',
    visual:simBersusunKali(34,12).at(-1),
    simulation:{title:'Kalikan 34 × 12 bersusun',frames:simBersusunKali(34,12)}
  },
  tambah:{intro:'Penjumlahan menggabungkan dua bilangan menjadi satu total yang lebih besar.',analogy:'Seperti menuang air dari dua gelas ke satu teko. Jumlah airnya bertambah.',steps:['Mulai dari angka pertama.','Hitung maju sebanyak angka kedua.','Angka terakhir adalah jawaban.'],example:'7 + 5 → mulai dari 7, lalu hitung maju 5: 8, 9, 10, 11, 12. Jawabannya 12.',tip:'Untuk angka besar, jumlahkan puluhan dulu, baru satuannya.',visual:{type:'number-line',values:[7,5,12],labels:['7','+5','12']},simulation:{title:'Melangkah dari 7',frames:[{caption:'Mulai berdiri di angka 7',type:'number-line',values:[7,0,7],labels:['7','','7']},{caption:'Maju 5 langkah ke kanan',type:'number-line',values:[7,5,12],labels:['7','+5','12']},{caption:'Sampai di 12. Itu jawabannya',type:'formula',values:[12],labels:['7 + 5','12']}]}},
  kurang:{intro:'Pengurangan mengambil sebagian dari suatu bilangan. Yang tersisa makin sedikit.',analogy:'Seperti memakan kue dari toples. Isinya berkurang.',steps:['Mulai dari angka terbesar.','Hitung mundur sebanyak angka kedua.','Angka terakhir adalah sisanya.'],example:'9 − 4 → mulai dari 9, hitung mundur 4: 8, 7, 6, 5. Jawabannya 5.',tip:'Pengurangan adalah kebalikan dari penjumlahan.',visual:{type:'number-line',values:[9,4,5],labels:['9','−4','5']},simulation:{title:'Mundur dari 9',frames:[{caption:'Mulai berdiri di angka 9',type:'number-line',values:[9,0,9],labels:['9','','9']},{caption:'Mundur 4 langkah ke kiri',type:'number-line',values:[9,4,5],labels:['9','−4','5']},{caption:'Tersisa 5',type:'formula',values:[5],labels:['9 − 4','5']}]}},
  kali:{intro:'Perkalian menjumlahkan angka yang sama secara berulang.',analogy:'Seperti kotak telur: 6 baris, tiap baris 2 telur, jadi 12 telur.',steps:['Ambil angka pertama.','Jumlahkan angka itu sebanyak angka kedua kali.','Totalnya adalah jawaban.'],example:'4 × 3 = 4 + 4 + 4 = 12.',tip:'Hafalkan tabel perkalian kecil (1–10), ini jadi jauh lebih cepat.',visual:{type:'groups',values:[3,4],labels:['kelompok','isi']},simulation:{title:'Tumpuk 3 kelompok',frames:[{caption:'Kelompok pertama: 4',type:'sequence',values:[4]},{caption:'Kelompok kedua: 4 + 4 = 8',type:'sequence',values:[4,8]},{caption:'Kelompok ketiga: 4 + 4 + 4 = 12',type:'sequence',values:[4,8,12]},{caption:'Jadi 4 × 3 = 12',type:'groups',values:[3,4],labels:['kelompok','isi']},{caption:'Hasilnya 12',type:'formula',values:[12],labels:['4 × 3','12']}]}},
  bagi:{intro:'Pembagian membagi suatu bilangan menjadi beberapa bagian yang sama besar.',analogy:'Seperti membagi 12 kue ke 3 orang. Tiap orang dapat 4 kue.',steps:['Ambil bilangan yang dibagi.','Bagikan rata ke jumlah kelompok.','Tiap kelompok adalah jawaban.'],example:'12 ÷ 3 = 4, karena 4 × 3 = 12.',tip:'Pembagian adalah kebalikan dari perkalian.',visual:{type:'groups',values:[3,4],labels:['kelompok','isi']},simulation:{title:'Bagi 12 kue',frames:[{caption:'Siapkan 12 kue',type:'sequence',values:[12]},{caption:'Bagi rata ke 3 piring',type:'groups',values:[3,4],labels:['piring','isi']},{caption:'Tiap piring berisi 4',type:'formula',values:[4],labels:['12 ÷ 3','4']}]}},
  campuran:{intro:'Operasi campuran memakai lebih dari satu operasi dalam satu soal. Urutannya: tanda kurung, lalu kali/bagi, terakhir tambah/kurang.',analogy:'Seperti resep: siapkan adonan (kali) dulu, baru olesi dan hias (tambah/kurang).',steps:['Kerjakan bagian dalam tanda kurung lebih dulu.','Lalu hitung semua perkalian.','Terakhir, tambah dan kurang dari kiri ke kanan.'],example:'2 + 3 × 4 → kali dulu: 3 × 4 = 12 → 2 + 12 = 14.',tip:'Kerjakan satu langkah kecil pada satu waktu, tulis hasil antaranya.',visual:{type:'formula',values:[14],labels:['2 + 3 × 4','14']},simulation:{title:'KUKABATAKU 3 + 4 × 2',frames:[{caption:'Soalnya: 3 + 4 × 2',type:'formula',values:[],labels:['3 + 4 × 2','?']},{caption:'KUKABATAKU: kali dulu 4 × 2 = 8',type:'formula',values:[8],labels:['4 × 2','8']},{caption:'Sekarang tambah: 3 + 8',type:'formula',values:[],labels:['3 + 8','?']},{caption:'Hasilnya 11',type:'formula',values:[11],labels:['3 + 4 × 2','11']}]}},
  story:{intro:'Soal cerita menyembunyikan angka dan operasi di dalam cerita. Tugasnya menemukan keduanya.',analogy:'Seperti membaca struk belanja lalu menjawab "berapa totalnya?".',steps:['Baca ceritanya pelan-pelan.','Catat angka-angka pentingnya.','Tentukan operasi, lalu hitung jawabannya.'],example:'Membeli 4 kotak isi 6 telur → 4 × 6 = 24 telur.',tip:'Hubungan angkanya menentukan operasi: gabung (tambah), sisa (kurang), kelompok sama (kali), bagian sama (bagi).',visual:{type:'groups',values:[4,6],labels:['kotak','isi']},simulation:{title:'Telur Bu Rina',frames:[{caption:'Bu Rina beli 4 kotak telur',type:'groups',values:[4,6],labels:['kotak','isi']},{caption:'Angka penting: 4 kotak, isinya 6',type:'formula',values:[],labels:['4 kotak','6 butir']},{caption:'Hitung 4 × 6 = 24',type:'formula',values:[24],labels:['4 × 6','24']}]}},
  iq:{intro:'Pola angka meminta kamu menemukan aturan di balik deretan angka.',analogy:'Seperti menebak nada berikutnya dalam sebuah lagu.',steps:['Lihat selisih antar angka.','Temukan pola yang berulang.','Terapkan pola ke angka berikutnya.'],example:'2, 4, 6, 8, ? → setiap angka naik 2, jadi jawabannya 10.',tip:'Mulai dari selisih antar angka. Pola paling umum: tambah atau kali.',visual:{type:'sequence',values:[2,4,6,8,10],labels:[]},simulation:{title:'Naik 2 terus',frames:[{caption:'Deretnya: 2, 4, 6, 8',type:'sequence',values:[2,4,6,8]},{caption:'Selisih tiap angka selalu 2',type:'formula',values:[2],labels:['4 − 2','2']},{caption:'Lanjutkan: 8 + 2 = 10',type:'sequence',values:[2,4,6,8,10]}]}},
  analogy:{intro:'Analogi angka meminta kamu menemukan hubungan antara sepasang angka, lalu menerapkan hubungan yang sama ke pasangan lain.',analogy:'Seperti menerjemahkan: "3 : 9" artinya "dikali 3", maka "5 : ?" juga dikali 3.',steps:['Amati pasangan pertama dan cari hubungannya.','Tentukan aturannya (tambah, kali, atau kuadrat).','Terapkan aturan yang sama ke angka pasangan kedua.'],example:'3 : 9 :: 5 : ? → 3 dikali 3 jadi 9, maka 5 × 3 = 15.',tip:'Selalu pastikan aturannya cocok untuk pasangan pertama dulu, baru dipakai untuk pasangan kedua.',visual:{type:'formula',values:[15],labels:['3 : 9 = 5 : ?','15']},simulation:{title:'Analogi ×3',frames:[{caption:'Pasangan kiri: 3 : 9',type:'formula',values:[9],labels:['3 × 3','9']},{caption:'Aturannya dikali 3',type:'formula',values:[3],labels:['× 3','']},{caption:'Pasangan kanan: 5 × 3 = 15',type:'formula',values:[15],labels:['5 × 3','15']}]}},
  oddone:{intro:'Ganjil satu keluar meminta kamu menemukan satu angka yang tidak masuk kelompok mayoritas.',analogy:'Seperti menemukan satu apel di antara sekumpulan jeruk.',steps:['Lihat ciri tiap angka: genap, ganjil, kelipatan, atau prima.','Temukan sifat yang dimiliki kebanyakan angka.','Angka yang tidak punya sifat itu adalah jawabannya.'],example:'4, 8, 12, 7 → semua genap kecuali 7, jadi 7 yang tidak cocok.',tip:'Periksa satu sifat dulu (misal genap/ganjil) sebelum berpindah ke sifat lain.',visual:{type:'sequence',values:[4,8,12,7],labels:['genap','genap','genap','ganjil']},simulation:{title:'Cari yang ganjil',frames:[{caption:'Angkanya: 4, 8, 12, 7',type:'sequence',values:[4,8,12,7]},{caption:'4, 8, 12 semuanya genap',type:'formula',values:[],labels:['genap','']},{caption:'7 ganjil → tidak cocok',type:'formula',values:[7],labels:['ganjil','7']}]}},
  matrix:{intro:'Matriks angka meminta kamu mengisi kotak kosong berdasarkan pola pada baris atau kolom.',analogy:'Seperti melengkapi ubin yang rusak mengikuti motif lantai di sekitarnya.',steps:['Baca pola dalam satu baris dari kiri ke kanan.','Pastikan pola yang sama berlaku untuk baris lain.','Terapkan pola itu untuk mengisi kotak kosong.'],example:'Baris 2, 4, 8 dikali 2 berurutan; kotak kosong di tengah memakai aturan yang sama.',tip:'Bila baris tidak jelas, coba baca polanya ke bawah per kolom.',visual:{type:'sequence',values:[2,4,8],labels:['×2','×2','']},simulation:{title:'Kali 2 tiap langkah',frames:[{caption:'Baris pertama: 2, 4, 8',type:'sequence',values:[2,4,8]},{caption:'Tiap langkah dikali 2',type:'formula',values:[2],labels:['× 2','']},{caption:'Isi kotak kosong dengan aturan sama',type:'sequence',values:[2,4,8]}]}},
  logic:{intro:'Logika & rasio meminta kamu menghitung perbandingan dan proporsi dari situasi sehari-hari.',analogy:'Seperti menakar bahan: kalau 1 orang butuh 2 gelas, maka 3 orang butuh 6 gelas.',steps:['Pahami hubungan antar bilangan dalam soal.','Hitung nilai untuk satu unit atau satu orang.','Kalikan sesuai jumlah yang ditanyakan.'],example:'2 pekerja membuat 4 unit → 1 pekerja membuat 2 unit, maka 5 pekerja membuat 10 unit.',tip:'Sederhanakan dulu ke nilai per satu unit, lalu kalikan. Pastikan hasilnya bilangan bulat.',visual:{type:'formula',values:[10],labels:['5 pekerja','10 unit']},simulation:{title:'Rasio pekerja',frames:[{caption:'2 pekerja → 4 unit',type:'formula',values:[4],labels:['2 pekerja','4 unit']},{caption:'1 pekerja → 2 unit',type:'formula',values:[2],labels:['1 pekerja','2 unit']},{caption:'5 pekerja → 10 unit',type:'formula',values:[10],labels:['5 pekerja','10 unit']}]}}
};

// Materi bawaan saat AI belum tersedia: teks statis dari katalog di atas.
export function localGuide(topicId) {
  const lesson=AI_LESSONS.find(x=>x.id===topicId);
  const meta=GUIDE_TOPICS.find(x=>x.id===topicId);
  if (!meta) throw new Error('Materi tidak ditemukan.');
  if (lesson) return {title:lesson.title,intro:lesson.intro,analogy:lesson.analogy||'Bayangkan seperti resep masakan — ikuti langkahnya berurutan.',steps:['Baca pengertian dan rumusnya.',lesson.hint,`Contoh: ${lesson.example}`,'Kerjakan latihan terkait di menu Tantangan.'],example:`${lesson.formula} → ${lesson.example}`,tip:lesson.hint,visual:lesson.visual||{type:'formula',values:[],labels:[lesson.formula]},simulation:lesson.simulation,references:referencesFor(topicId)};
  return {title:meta.title,...GUIDE_TEXTS[topicId],steps:GUIDE_TEXTS[topicId].steps,methods:METHODS[topicId]||[],references:referencesFor(topicId)};
}

export function methodsFor(topicId) {
  return METHODS[topicId] || [];
}

// Jawaban Asisten Belajar saat model belum tersedia: cocokkan kata kunci ke
// materi bawaan, lengkap dengan visualnya (pengguna belajar dengan mata).
export function localChatReply(text='') {
  const t=String(text).toLowerCase();
  const aliases={tambah:['tambah','penjumlahan','jumlah'],kurang:['kurang','pengurangan','selisih'],kali:['kali','perkalian'],bagi:['bagi','pembagian'],'bagi-bersusun':['bersusun','kocor','pembagian bersusun'],'kali-bersusun':['kali bersusun','perkalian bersusun'],campuran:['campuran','pemdas','kukabataku','urutan operasi','tanda kurung'],story:['cerita'],iq:['pola','deret','barisan'],analogy:['analogi'],oddone:['ganjil','tidak cocok','berbeda'],matrix:['matriks','kotak kosong'],logic:['logika','rasio','perbandingan','proporsi']};
  const topic=(t.includes('bersusun')?GUIDE_TOPICS.find(x=>x.id===(t.includes('bagi')?'bagi-bersusun':'kali-bersusun')):null) ||
    GUIDE_TOPICS.find(item=>t.includes(item.title.toLowerCase())) ||
    GUIDE_TOPICS.find(item=>(aliases[item.id]||[]).some(word=>t.includes(word))) || null;
  if (!topic) return {text:'Asisten Belajar belum tersambung ke model, jadi belum bisa menjawab bebas. Coba lagi sebentar, atau buka menu Panduan lengkap untuk materi yang sudah tersusun.',visual:null};
  const data=localGuide(topic.id);
  const methods=methodsFor(topic.id).map(m=>`• ${m.name}: ${m.how}`).join('\n');
  return {text:`${data.intro}\n\nLangkahnya:\n${data.steps.map((s,i)=>`${i+1}. ${s}`).join('\n')}${methods?`\n\nMetode yang bisa dipakai:\n${methods}`:''}\n\nTips: ${data.tip}`,visual:data.visual||null};
}
