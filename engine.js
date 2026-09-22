export const SYMBOLS = Object.freeze({ tambah: '+', kurang: '−', kali: 'x', bagi: '÷' });
export const LIMITS = Object.freeze({ mudah: 10, sedang: 50, sulit: 100 });
export const MINIMUMS = Object.freeze({ mudah: 0, sedang: 11, sulit: 51 });
export const MAX_DIGITS = 5;

export function isSettingsValid(operation, difficulty) {
  return Object.hasOwn(SYMBOLS, operation) && Object.hasOwn(LIMITS, difficulty);
}

export function isDigitsValid(digits) {
  return digits === undefined || digits === null || (Number.isInteger(digits) && digits >= 1 && digits <= MAX_DIGITS);
}

export function digitsRange(digits) {
  if (digits === undefined || digits === null) return null;
  if (!Number.isInteger(digits) || digits < 1 || digits > MAX_DIGITS) throw new Error('Digit tidak valid.');
  return { min: digits === 1 ? 0 : 10 ** (digits - 1), max: 10 ** digits - 1 };
}

export function calculate({ a, b, operation, answer }) {
  if (['iq','aimath'].includes(operation)) return answer;
  switch (operation) {
    case 'tambah': return a + b;
    case 'kurang': return a - b;
    case 'kali': return a * b;
    case 'bagi': return a / b;
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
export function generateChallenge({ operation, difficulty, history = [], previous = '', digits }, random = Math.random) {
  if (!isSettingsValid(operation, difficulty)) throw new Error('Pilihan latihan tidak valid.');
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
      if (!excluded.has(`${a}:${b}`)) return { a, b, operation, symbol: SYMBOLS[operation], source: 'default' };
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
  const available = pools.get(key).filter(q => !excluded.has(`${q.a}:${q.b}`));
  if (!available.length) throw new Error('Semua soal pada level ini telah selesai. Mulai sesi baru.');
  const q = available[Math.min(available.length - 1, Math.max(0, Math.floor(random() * available.length)))];
  return { ...q, operation, symbol: SYMBOLS[operation], source: 'default' };
}

export function hintFor(q) {
  if (['iq','aimath'].includes(q.operation)) return q.hint;
  if (q.operation === 'tambah') return `Mulai dari ${q.a}, lalu tambah ${q.b}.`;
  if (q.operation === 'kurang') return `Mulai dari ${q.a}, lalu hitung mundur ${q.b}.`;
  if (q.operation === 'kali') return `Jumlahkan ${q.a} sebanyak ${q.b} kali.`;
  return `Cari angka yang jika dikali ${q.b}, hasilnya ${q.a}.`;
}

export function generateIQ({difficulty, topic = 'mixed', history = []}, random = Math.random) {
  if (!Object.hasOwn(LIMITS, difficulty)) throw new Error('Level tidak valid.');
  const pool = [];
  for (let start = 1; start <= ({mudah:15,sedang:25,sulit:35}[difficulty]); start++) {
    for (let step = 2; step <= 7; step++) {
      const groups={basic:['add','subtract'],multiply:['multiply'],growing:['growing'],alternate:['alternate'],square:['square'],fibonacci:['fibonacci'],double:['double'],mixedops:['mixedops']};
      const types=topic==='mixed' ? (difficulty==='mudah'?['add','subtract']:difficulty==='sedang'?['multiply','growing']:['alternate','square']) : groups[topic];
      if (!types) throw new Error('Jenis IQ tidak valid.');
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
        if (!history.includes(id) && !pool.some(q=>q.id===id)) pool.push({id,operation:'iq',sequence:sequence.slice(0,4),answer:sequence[4],hint,source:'default',type});
      }
    }
  }
  if (!pool.length) throw new Error('Mulai sesi baru untuk soal berikutnya.');
  return pool[Math.min(pool.length-1,Math.max(0,Math.floor(random()*pool.length)))];
}

export function referenceRows(operation, number = 2) {
  if (!Object.hasOwn(SYMBOLS,operation) || !Number.isInteger(number) || number<1 || number>12) throw new Error('Tabel tidak valid.');
  return Array.from({length:12},(_,i)=>{
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
  {id:'decimals',title:'Desimal',icon:'.',intro:'Desimal adalah cara lain menulis persepuluhan dan perseratusan.',formula:'0,1 × n = n ÷ 10',example:'0,1 × 80 = 8.',hint:'Geser satu nilai tempat ke kanan.',source:'EEF · representasi'},
  {id:'ratio',title:'Rasio',icon:':',intro:'Rasio membandingkan dua jumlah dan menjaga hubungan keduanya.',formula:'a : b = ka : kb',example:'2 : 3, jika 2 menjadi 4 maka 3 menjadi 6.',hint:'Kalikan kedua sisi dengan angka yang sama.',source:'EEF · penalaran multiplikatif'},
  {id:'money',title:'Uang & diskon',icon:'Rp',intro:'Latih perkiraan harga, kembalian, dan diskon untuk keputusan sehari-hari.',formula:'harga akhir = harga − diskon',example:'Rp100 ribu diskon 20% menjadi Rp80 ribu.',hint:'Cari nilai diskon, lalu kurangkan.',source:'Adult numeracy · konteks nyata'},
  {id:'measurement',title:'Ukuran & waktu',icon:'↔',intro:'Gunakan satuan untuk membaca jarak, durasi, berat, dan kapasitas.',formula:'1 jam = 60 menit',example:'2 jam = 120 menit.',hint:'Kalikan jumlah jam dengan 60.',source:'Adult numeracy · konteks nyata'},
  {id:'basics',title:'Persen',icon:'%',intro:'Persen berarti per seratus dan membantu membaca diskon, bunga, serta data.',formula:'p% dari n = n × p ÷ 100',example:'20% dari 50 = 10.',hint:'Ubah persen menjadi bagian dari seratus.',source:'EEF · proporsi'},
  {id:'algebra',title:'Fungsi & bobot',icon:'ƒ',intro:'Model AI bekerja seperti mesin: menerima input, lalu memprosesnya menjadi prediksi. Bobot menentukan seberapa besar pengaruh tiap input.',formula:'y = w × x + b',example:'x = 3, w = 2, b = 1 → y = 7',hint:'Kalikan bobot dengan input, lalu tambah bias.'},
  {id:'vectors',title:'Vektor',icon:'→',intro:'Vektor menyimpan beberapa angka sekaligus. Dot product menggabungkan tiap fitur dengan bobotnya menjadi satu nilai.',formula:'[a, b] · [c, d] = a×c + b×d',example:'[2, 3] · [4, 1] = 8 + 3 = 11',hint:'Kalikan pasangan angka pada posisi yang sama, lalu jumlahkan.'},
  {id:'mean',title:'Rata-rata data',icon:'μ',intro:'Rata-rata merangkum pusat data. Ini cara AI "merasakan" kumpulan angka sebelum mulai belajar.',formula:'Rata-rata = jumlah nilai ÷ banyak nilai',example:'[2, 4, 6] → (2 + 4 + 6) ÷ 3 = 4',hint:'Jumlahkan semua nilai, lalu bagi dengan banyaknya nilai.'},
  {id:'probability',title:'Peluang',icon:'%',intro:'Peluang menyatakan seberapa mungkin suatu kejadian. AI menyajikan prediksi sebagai peluang, misalnya "80% yakin".',formula:'Peluang (%) = bagian ÷ total × 100',example:'3 dari 10 sampel → 30%',hint:'Bagi jumlah kejadian dengan total, lalu kalikan 100.'},
  {id:'gradient',title:'Gradien & belajar',icon:'∇',intro:'Gradien menunjukkan arah perubahan. Model belajar dengan bergerak berlawanan arah gradien untuk memperkecil kesalahan.',formula:'L(w) = w² → gradien = 2w',example:'w = 3 → gradien = 6.',hint:'Untuk fungsi kuadrat ini, gradien adalah dua kali bobot w.',source:'Matematika mesin'},
  {id:'estimation',title:'Estimasi',icon:'≈',intro:'Estimasi membantu memeriksa apakah jawaban masuk akal sebelum menghitung tepat.',formula:'47 × 21 ≈ 50 × 20',example:'50 × 20 = 1.000, jadi hasil tepat seharusnya dekat.',hint:'Bulatkan ke puluhan terdekat.',source:'EEF · metakognisi'}
];

export function generateAIMath({topic='algebra',difficulty='mudah',history=[]},random=Math.random) {
  if (!AI_LESSONS.some(x=>x.id===topic) || !Object.hasOwn(LIMITS,difficulty)) throw new Error('Materi tidak valid.');
  const max={mudah:6,sedang:10,sulit:20}[difficulty], pool=[];
  for(let a=1;a<=max;a++) for(let b=1;b<=max;b++) {
    let display,answer,prompt;
    if(topic==='place'){display=`Nilai digit ${b%9+1} pada ${(a%9+1)*100+(b%9+1)*10+a%10}`;answer=(b%9+1)*10;prompt='Berapa nilai tempatnya?';}
    if(topic==='mental'){display=`${a*10+b} + ${b*10+a}`;answer=11*(a+b);prompt='Hitung dengan memecah angka';}
    if(topic==='fractions'){display=`½ dari ${2*a*b}`;answer=a*b;prompt='Berapa bagiannya?';}
    if(topic==='decimals'){display=`0,1 × ${a*b*10}`;answer=a*b;prompt='Berapa nilainya?';}
    if(topic==='ratio'){display=`${a} : ${b} = ${a*2} : ?`;answer=b*2;prompt='Lengkapi rasio';}
    if(topic==='money'){display=`Diskon ${a*10}% dari ${b*10000}`;answer=a*b*1000;prompt='Berapa nilai diskon?';}
    if(topic==='measurement'){display=`${a+b} jam = ? menit`;answer=(a+b)*60;prompt='Ubah ke menit';}
    if(topic==='basics'){display=`${a*10}% dari ${b*10}`;answer=a*b;prompt='Berapa nilainya?';}
    if(topic==='algebra'){display=`${a} × ${b} + ${a+1}`;answer=a*b+a+1;prompt='Hitung prediksi y';}
    if(topic==='vectors'){display=`[${a}, ${b}] · [2, 3]`;answer=a*2+b*3;prompt='Hitung dot product';}
    if(topic==='mean'){display=`${a} · ${a+b} · ${a+2*b}`;answer=a+b;prompt='Berapa rata-ratanya?';}
    if(topic==='probability'){const total=difficulty==='mudah'?10:difficulty==='sedang'?20:100;const count=(a+b-2)%total+1;display=`${count} dari ${total}`;answer=count/total*100;prompt='Berapa persen?';}
    if(topic==='gradient'){display=`w = ${a+b}`;answer=2*(a+b);prompt='Gradien L(w) = w²?';}
    if(topic==='estimation'){display=`Bulatkan ${a*10+b} ke puluhan`;answer=Math.round((a*10+b)/10)*10;prompt='Berapa estimasinya?';}
    const id=`${topic}:${display}`;
    if(!history.includes(id)&&!pool.some(q=>q.id===id))pool.push({id,operation:'aimath',display,prompt,answer:Math.round(answer),hint:AI_LESSONS.find(x=>x.id===topic).hint,source:'default'});
  }
  if(!pool.length)throw new Error('Semua soal selesai.');
  return pool[Math.min(pool.length-1,Math.max(0,Math.floor(random()*pool.length)))];
}
