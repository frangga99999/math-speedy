import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {generateChallenge, generateIQ, frameStory, isQuestionValid, isSettingsValid, isDigitsValid, digitsRange, SYMBOLS, LIMITS, MINIMUMS, GUIDE_TOPICS, localGuide, localChatReply, methodsFor, referencesFor, METHODS} from './engine.js';
import {skillForQuestion,SKILL_DEFINITIONS} from './skills.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const env = await fs.readFile(path.join(root, '.env'), 'utf8').catch(() => '');
for (const line of env.split('\n')) {
  const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
}
const port = Number(process.env.PORT || 3000);
const hostBind = process.env.HOST || '127.0.0.1';
// Daftar host yang boleh mengakses (dipisah koma) lewat ALLOWED_HOSTS.
// Di VPS wajib memuat mathspeedy.duckdns.org supaya Caddy tidak ditolak 403.
const allowedHosts = new Set((process.env.ALLOWED_HOSTS || 'localhost,127.0.0.1').split(',').map(x => x.trim().toLowerCase()).filter(Boolean));
const allowedFiles = new Set(['index.html','style.css','challenge.css','home.css','app.js','engine.js','progress.js','skills.js','mastery.js']);
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.ttf':'font/ttf'};
const keyFile = process.env.VPS_AI_KEY_FILE;
const vpsKey = keyFile ? (await fs.readFile(path.resolve(root, keyFile), 'utf8')).trim() : process.env.VPS_AI_API_KEY;
const accessKeyPath=path.join(root,'access-key-math.txt');
async function loadOwnerKey(){
  try{await fs.writeFile(accessKeyPath,randomBytes(32).toString('base64url'),{flag:'wx',mode:0o600});}
  catch(error){if(error.code!=='EEXIST')throw error;}
  await fs.chmod(accessKeyPath,0o600);
  const key=(await fs.readFile(accessKeyPath,'utf8')).trim();
  if(key.length<32)throw new Error('Kunci akses (access-key-math.txt) minimal 32 karakter.');
  return key;
}
const accessKey=await loadOwnerKey();
const sessionTTL=8*60*60*1000;

// Latensi model lewat tunnel terukur ~18-19 detik; 15 detik membuat semua
// permintaan AI selalu kehabisan waktu dan jatuh ke soal bawaan.
const AI_TIMEOUT=30000;
const AI_SYSTEM_PROMPT = 'Kamu guru matematika yang sabar dan ramah untuk orang dewasa yang baru memulai lagi belajar berhitung dari nol. Buat satu soal aritmetika yang menumbuhkan rasa percaya diri: angkanya wajar, tidak menakutkan. Balas HANYA JSON {"a":angka,"b":angka} tanpa teks lain, tanpa markdown, tanpa reasoning. Bilangan bulat non-negatif. Pengurangan hasilnya tidak negatif, pembagian hasilnya bulat dan penyebut bukan nol. Hindari pasangan angka yang sudah dipakai.';
const AI_STORY_PROMPT = 'Kamu guru matematika yang sabar dan ramah untuk orang dewasa yang belajar berhitung dari nol. Bingkai SATU soal aritmetika dalam cerita singkat yang SEGAR dan BERBEDA dari sebelumnya: konteks kehidupan sehari-hari Indonesia selalu berganti (pasar, bus, masak, laundry, kebun, tabungan, pesanan, gudang, kantin, dan lainnya), nama tokoh berbeda, angkanya wajar dan tidak menakutkan. Balas HANYA JSON {"a":angka,"b":angka,"story":"cerita 2-3 kalimat","question":"satu pertanyaan singkat"} tanpa teks lain, tanpa markdown, tanpa reasoning. Bilangan bulat non-negatif. Pengurangan hasilnya tidak negatif, pembagian hasilnya bulat dan penyebut bukan nol.';
const EXPLANATION_PROMPT = 'Kamu Asisten Belajar matematika. Jelaskan hanya soal yang diberikan, ringkas dan visual. Balas HANYA JSON: {"title":"maks 5 kata","summary":"maks 16 kata","steps":["maks 16 kata", "maks 16 kata", "maks 16 kata"],"insight":"maks 16 kata","visual":{"type":"number-line|groups|sequence|formula","values":[angka maksimal 8],"labels":["teks maksimal 12 karakter"]}}. Jangan gunakan markdown atau HTML.';
const IQ_PROMPT='Kamu generator latihan penalaran numerik adaptif. Buat satu soal baru, adil, dan memiliki tepat satu jawaban bilangan bulat. Pilih salah satu tipe: "sequence" (deret 4 angka, tebak angka berikutnya), "analogy" (analogi angka "a : b :: c : ?"), "oddone" (5 angka, satu yang tidak cocok), "matrix" (susunan 3x3 angka dengan satu kotak kosong "?"), atau "logic" (perbandingan/rasio, misal "a pekerja membuat x unit, berapa unit b pekerja?" atau soal umur). Balas HANYA JSON {"type":"tipe di atas","display":"teks soal yang ditampilkan pengguna","prompt":"pertanyaan singkat","answer":bilangan bulat non-negatif,"hint":"aturan singkat","sequence":[4 bilangan bulat] bila tipe sequence}. Jangan menyalin tes berhak cipta. Buat soal berbeda setiap kali dan hindari mengulang soal yang sudah dipakai.';
const GUIDE_PROMPT='Kamu guru matematika ramah untuk orang dewasa pemula. Jelaskan satu materi dengan bahasa Indonesia sederhana dan sehari-hari yang familiar, analogi kehidupan nyata, metode praktis, visual menarik, dan SATU SIMULASI langkah demi langkah yang menggambarkan cara kerjanya sampai ke jawaban. Balas HANYA JSON {"title":"maksimal 6 kata","intro":"pengertian singkat maksimal 45 kata","analogy":"analogi sehari-hari maksimal 45 kata","methods":[{"name":"nama metode maksimal 4 kata","how":"cara pakainya maksimal 25 kata"}],"steps":["langkah maksimal 20 kata","langkah","langkah","langkah"],"example":"contoh perhitungan singkat","tip":"tips praktis maksimal 35 kata","visual":{"type":"number-line|groups|sequence|formula","values":[angka maksimal 8],"labels":["maksimal 12 karakter"]},"simulation":{"title":"maksimal 6 kata","frames":[{"caption":"maksimal 8 kata","type":"number-line|groups|sequence|formula","values":[angka],"labels":["maksimal 12 karakter"]}]}} tanpa markdown, tanpa HTML, tanpa teks lain. Simulasi 2-5 frame berurutan; tiap frame satu keadaan visual yang berangsur menuju jawaban; angkanya konsisten antar frame.';

const loginPage=`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SpeedyMath · Privat</title><style>body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#122632;color:#fff;font-family:system-ui}.card{width:min(82vw,340px);padding:30px;border:1px solid #ffffff24;border-radius:28px;background:linear-gradient(145deg,#ffffff10,#0b476150);box-shadow:0 24px 80px #0005}i{display:grid;place-items:center;width:58px;height:58px;border-radius:19px;background:#bdeacb18;color:#bdeacb;font-style:normal;font-size:26px}h1{font-size:25px;margin:25px 0 8px}p{color:#bad0d8;font-size:12px;line-height:1.7}input,button{box-sizing:border-box;width:100%;min-height:52px;border-radius:15px;font:inherit}input{margin:18px 0 10px;padding:0 16px;color:#fff;background:#061c2855;border:1px solid #c8e9ed30}button{border:0;background:#c5ead0;color:#173629;font-weight:700}.error{min-height:20px;color:#ffb8b8}</style></head><body><form class="card" id="login"><i>✦</i><h1>Ruang latihan pribadi</h1><p>Masukkan kunci dari <b>access-key-math.txt</b>.</p><input id="key" type="password" autocomplete="current-password" aria-label="Kunci akses" required><div class="error" role="alert"></div><button>Buka latihan</button></form><script>login.addEventListener('submit',async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;const r=await fetch('/api/access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:key.value})});if(r.ok)location.reload();else{document.querySelector('.error').textContent=(await r.json()).error;b.disabled=false}})</script></body></html>`;

function reply(res, status, body) {
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify(body));
}
async function readJSON(req, max = 8000) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > max) throw new Error('Request too large');
  }
  const value = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid request');
  return value;
}

async function generateAI(settings, config, story = false) {
  const {operation, difficulty, history = [], digits} = settings;
  const url = new URL(`${config.baseURL.replace(/\/$/, '')}/chat/completions`);
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid endpoint');
  const ranged = operation === 'tambah' && digits != null;
  const range = ranged ? digitsRange(digits) : null;
  const min = range ? range.min : MINIMUMS[difficulty];
  const max = range ? range.max : LIMITS[difficulty];
  const bMin = ranged ? range.min : 0;
  const bounds = ranged
    ? `Penjumlahan ${digits} digit: a dan b masing-masing antara ${min} dan ${max}.`
    : `a antara ${MINIMUMS[difficulty]} dan ${LIMITS[difficulty]}; b antara ${bMin} dan ${LIMITS[difficulty]}.${difficulty === 'mudah' ? '' : ` Kali/bagi: b >= 2. Bagi/kurang: a tidak sama dengan b. Tambah/kurang: b >= ${difficulty === 'sulit' ? 25 : 10}.`}`;
  // Variasi cerita dipaksa dari sisi server: konteks dan tokoh diundi setiap permintaan.
  const pick=(list)=>list[Math.floor(Math.random()*list.length)];
  const ideasi=['situasi pasar pagi','perjalanan bus kota','menakar bahan masakan','jasa laundry','menabung','pesanan kue','stok gudang','kantin sekolah','kebun tomat','penjualan minuman'];
  const nama=['Rina','Budi','Sari','Dedi','Maya','Andi','Fitri','Joko','Wulan','Nadia','Pak Hasan','Bu Wati'];
  const variasi=story ? ` Ide konteks: ${pick(ideasi)}. Tokoh: ${pick(nama)}.` : '';
  const response = await fetch(url, {
    method:'POST', signal:AbortSignal.timeout(AI_TIMEOUT), redirect:'error',
    headers:{'Content-Type':'application/json', ...(config.apiKey ? {Authorization:`Bearer ${config.apiKey}`} : {})},
    body:JSON.stringify({model:config.model, temperature:.7, max_tokens:story?700:400, stream:false, messages:[
      {role:'system', content:story?AI_STORY_PROMPT:AI_SYSTEM_PROMPT},
      {role:'user', content:`Operasi ${operation}. Level ${difficulty}. ${bounds}${variasi} Hindari: ${history.join(',') || 'belum ada'}.`}
    ]})
  });
  if (!response.ok) throw new Error('AI unavailable');
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('Invalid AI response');
  const question = JSON.parse(content.trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));
  if (!isQuestionValid(question, operation, difficulty, history, digits)) throw new Error('Invalid question');
  const result={a:question.a,b:question.b,operation,symbol:SYMBOLS[operation],source:'ai'};
  const skillId=skillForQuestion(result);
  const base={...result,skillId,strategyId:SKILL_DEFINITIONS[skillId]?.strategyId};
  if (!story) return base;
  if (typeof question.story!=='string'||question.story.length<20||question.story.length>400||typeof question.question!=='string'||question.question.length<5||question.question.length>140) throw new Error('Cerita tidak valid');
  return {...base,story:question.story,question:question.question};
}

function localExplanation(q) {
  const op = q.operation;
  const answer = Number(q.answer ?? (op==='tambah'?q.a+q.b:op==='kurang'?q.a-q.b:op==='kali'?q.a*q.b:op==='bagi'?q.a/q.b:0));
  if (op === 'iq') {
    if (q.type === 'analogy') return {title:'Analogi angka',summary:'Temukan hubungan pada pasangan kiri, lalu terapkan ke pasangan kanan.',steps:['Lihat hubungan dua angka pada pasangan pertama.','Kenali aturannya (tambah, kali, atau kuadrat).',`Terapkan aturan yang sama: hasilnya ${answer}.`],insight:q.hint||'Satu aturan untuk dua pasangan.',visual:{type:'formula',values:[answer],labels:[q.display||'Soal',String(answer)]},source:'lokal'};
    if (q.type === 'oddone') return {title:'Ganjil satu keluar',summary:'Temukan satu angka yang tidak masuk kelompok mayoritas.',steps:['Periksa satu sifat: genap/ganjil, kelipatan, atau prima.','Kenali sifat yang dimiliki kebanyakan angka.',`Angka yang tidak punya sifat itu adalah ${answer}.`],insight:q.hint||'Periksa satu sifat dulu, jangan semuanya sekaligus.',visual:{type:'formula',values:[answer],labels:[q.display||'Soal',String(answer)]},source:'lokal'};
    if (q.type === 'matrix') return {title:'Matriks angka',summary:'Isi kotak kosong mengikuti pola baris atau kolom.',steps:['Baca pola satu baris dari kiri ke kanan.','Pastikan aturannya sama untuk baris lain.',`Terapkan aturan itu untuk mengisi kotak kosong: ${answer}.`],insight:q.hint||'Bila baris tak jelas, coba baca per kolom ke bawah.',visual:{type:'formula',values:[answer],labels:[q.display||'Soal',String(answer)]},source:'lokal'};
    if (q.type === 'logic') return {title:'Logika & rasio',summary:'Hitung nilai per satu unit, lalu kalikan sesuai yang ditanya.',steps:['Pahami hubungan antar bilangan dalam soal.','Hitung nilai untuk satu unit atau satu orang.',`Kalikan sesuai jumlah yang ditanya: ${answer}.`],insight:q.hint||'Sederhanakan ke per satu unit, lalu kalikan.',visual:{type:'formula',values:[answer],labels:[q.display||'Soal',String(answer)]},source:'lokal'};
    return {title:'Temukan polanya',summary:'Bandingkan perubahan di setiap langkah.',steps:['Lihat selisih dua angka berurutan.','Uji aturan yang sama pada pasangan berikutnya.',`Terapkan aturan itu: hasilnya ${answer}.`],insight:q.hint||'Pola yang konsisten adalah kuncinya.',visual:{type:'sequence',values:[...(q.sequence||[]),answer].slice(0,8),labels:[]},source:'lokal'};
  }
  if (op === 'campuran') {
    // Jalur tetap KUKABATAKU untuk tiap bentuk soal, jadi alurnya selalu sama.
    const {a,b,c,variant}=q;
    const langkah={
      'plus-minus':[`Kerjakan dari kiri: ${a} + ${b} = ${a+b}.`,`Lanjut kurangi: ${a+b} − ${c} = ${answer}.`],
      'minus-plus':[`Kerjakan dari kiri: ${a} − ${b} = ${a-b}.`,`Lanjut tambah: ${a-b} + ${c} = ${answer}.`],
      'kali-plus':[`Kali dulu (KUKABATAKU): ${a} × ${b} = ${a*b}.`,`Lalu tambah: ${a*b} + ${c} = ${answer}.`],
      'kali-minus':[`Kali dulu (KUKABATAKU): ${a} × ${b} = ${a*b}.`,`Lalu kurang: ${a*b} − ${c} = ${answer}.`],
      'plus-kali':[`Kali lebih dulu walau ada di belakang: ${b} × ${c} = ${b*c}.`,`Lalu tambah: ${a} + ${b*c} = ${answer}.`],
      'minus-kali':[`Kali lebih dulu walau ada di belakang: ${b} × ${c} = ${b*c}.`,`Lalu kurang: ${a} − ${b*c} = ${answer}.`],
      'kurung-kali':[`Kerjakan isi kurung dulu: ${a} + ${b} = ${a+b}.`,`Lalu kalikan: ${a+b} × ${c} = ${answer}.`],
      'kurung-kurang':[`Kerjakan isi kurung dulu: ${a} − ${b} = ${a-b}.`,`Lalu kalikan: ${a-b} × ${c} = ${answer}.`],
      'kali-bagi':[`Kerjakan dari kiri: ${a} × ${b} = ${a*b}.`,`Lalu bagi: ${a*b} ÷ ${c} = ${answer}.`],
      'bagi-plus':[`Bagi dulu: ${a} ÷ ${b} = ${a/b}.`,`Lalu tambah: ${a/b} + ${c} = ${answer}.`],
      'bagi-minus':[`Bagi dulu: ${a} ÷ ${b} = ${a/b}.`,`Lalu kurang: ${a/b} − ${c} = ${answer}.`],
      'plus-bagi':[`Bagi lebih dulu walau di belakang: ${b} ÷ ${c} = ${b/c}.`,`Lalu tambah: ${a} + ${b/c} = ${answer}.`],
      'minus-bagi':[`Bagi lebih dulu walau di belakang: ${b} ÷ ${c} = ${b/c}.`,`Lalu kurang: ${a} − ${b/c} = ${answer}.`],
      'kurung-bagi':[`Kerjakan isi kurung dulu: ${a} + ${b} = ${a+b}.`,`Lalu bagi: ${a+b} ÷ ${c} = ${answer}.`]
    }[variant] || [`Tandai bagian perkalian atau kurung lebih dulu.`,`Lalu kerjakan tambah dan kurang: hasilnya ${answer}.`];
    return {title:'Urutan operasi',summary:'Kurung dan kali lebih dulu, baru tambah dan kurang.',steps:langkah,insight:'KUKABATAKU: Kurung, Kali, Bagi, Tambah, Kurang.',visual:{type:'formula',values:[answer],labels:[q.display||'Soal',String(answer)]},source:'lokal'};
  }
  if (op === 'akar') return {title:`Akar dari ${q.a}`,summary:'Cari angka yang jika dikuadratkan menjadi angka ini.',steps:[`Ingat tabel kuadrat: bilangan berapa yang kuadratnya ${q.a}?`,`${answer} × ${answer} = ${q.a}.`,`Jadi √${q.a} = ${answer}.`],insight:`√${q.a} = ${answer}`,visual:{type:'formula',values:[answer],labels:[`√${q.a}`,String(answer)]},source:'lokal'};
  if (op === 'kuadrat') return {title:`${q.a} kuadrat`,summary:'Kalikan bilangan dengan dirinya sendiri.',steps:[`Tulis ${q.a} dua kali.`,`Kalikan: ${q.a} × ${q.a}.`,`Hasilnya ${answer}.`],insight:`${q.a}² = ${answer}`,visual:{type:'formula',values:[answer],labels:[`${q.a}²`,String(answer)]},source:'lokal'};
  if (op === 'kubik') return {title:`${q.a} pangkat tiga`,summary:'Kalikan bilangan sebanyak tiga kali.',steps:[`Tulis ${q.a} tiga kali.`,`Kalikan: ${q.a} × ${q.a} × ${q.a}.`,`Hasilnya ${answer}.`],insight:`${q.a}³ = ${answer}`,visual:{type:'formula',values:[answer],labels:[`${q.a}³`,String(answer)]},source:'lokal'};
  const symbol=SYMBOLS[op];
  const types={tambah:'number-line',kurang:'number-line',kali:'groups',bagi:'groups'};
  const steps={
    tambah:[`Mulai dari ${q.a}.`,`Maju ${q.b} langkah.`,`Kamu tiba di ${answer}.`],
    kurang:[`Mulai dari ${q.a}.`,`Mundur ${q.b} langkah.`,`Kamu tiba di ${answer}.`],
    kali:[`Buat ${q.b} kelompok.`,`Isi tiap kelompok dengan ${q.a}.`,`Totalnya ${answer}.`],
    bagi:[`Siapkan ${q.a} benda.`,`Bagi rata ke ${q.b} kelompok.`,`Tiap kelompok berisi ${answer}.`]
  };
  return {title:`Pahami ${q.a} ${symbol} ${q.b}`,summary:'Lihat hubungan angkanya, lalu ikuti langkah.',steps:steps[op],insight:`${q.a} ${symbol} ${q.b} = ${answer}`,visual:{type:types[op],values:[q.a,q.b,answer],labels:[String(q.a),symbol,String(q.b),'=',String(answer)]},source:'lokal'};
}

const CHAT_PROMPT='Kamu Asisten Belajar di aplikasi latihan hitung untuk orang dewasa yang belajar dari nol. Bicara seperti teman yang sabar: bahasa Indonesia sederhana dan sehari-hari, hindari istilah asing, dan bila perlu istilah baru, jelaskan dengan kata lain. Jawab mulai dari inti, lalu langkah kecil bernomor, satu analogi sehari-hari, dan tips singkat. Maksimal 120 kata. Pengguna adalah PEMBELAJAR VISUAL yang belajar dengan MATA, jadi SELALU sertakan visual kecil yang menggambarkan inti penjelasanmu — hanya hilangkan bila soal benar-benar mustahil digambarkan. Bila pengguna mengirim gambar, baca soal atau tulisan matematika pada gambar itu, lalu jelaskan konsepnya dengan sederhana dan lengkap. Bila pertanyaannya di luar matematika, arahkan kembali dengan singkat. Balas HANYA JSON {"reply":"jawabanmu","visual":{"type":"number-line|groups|sequence|formula","values":[angka maksimal 8],"labels":["maksimal 12 karakter"]}} tanpa markdown.';
// Metode dikirim lengkap (nama + cara) supaya jawaban Asisten tidak berbeda
// dari materi yang diajarkan aplikasi.
const METHOD_BRIEF=Object.entries(METHODS).map(([topic,list])=>`${topic}: ${list.map(m=>`${m.name} — ${m.how}`).join(' ')}`).join('\n');
const CHAT_MAX=1_600_000;

function isImageData(value) {
  return typeof value==='string' && value.length<=CHAT_MAX && /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
}

// Skema visual yang sama dipakai chat, panduan, dan simulasi.
function validVisual(visual) {
  return Boolean(visual)&&['number-line','groups','sequence','formula'].includes(visual.type)&&Array.isArray(visual.values)&&visual.values.length<=8&&visual.values.every(Number.isFinite)&&(!visual.labels||(Array.isArray(visual.labels)&&visual.labels.length<=8&&visual.labels.every(l=>typeof l==='string'&&l.length<=24)));
}

async function generateChatReply(messages, image, config) {
  if(!config.baseURL||!config.model)throw new Error('Asisten Belajar belum terhubung.');
  const url=new URL(`${config.baseURL.replace(/\/$/,'')}/chat/completions`);
  const history=messages.map((message,index)=>{
    if(image && index===messages.length-1) return {role:'user',content:[
      {type:'text',text:message.content||'Jelaskan soal pada gambar ini.'},
      {type:'image_url',image_url:{url:image}}
    ]};
    return {role:message.role,content:message.content};
  });
  const response=await fetch(url,{method:'POST',signal:AbortSignal.timeout(image?60000:AI_TIMEOUT),redirect:'error',headers:{'Content-Type':'application/json',...(config.apiKey?{Authorization:`Bearer ${config.apiKey}`}:{})},body:JSON.stringify({model:config.model,temperature:.5,max_tokens:900,stream:false,messages:[{role:'system',content:`${CHAT_PROMPT}\n\nMetode yang diajarkan aplikasi ini (pakai ini, jangan versi lain):\n${METHOD_BRIEF}`},...history]})});
  if(!response.ok)throw new Error('Asisten belum dapat menjawab.');
  const raw=(await response.json()).choices?.[0]?.message?.content;
  if(typeof raw!=='string'||!raw.trim())throw new Error('Jawaban Asisten kosong.');
  // Model kadang menjawab teks polos walau diminta JSON — tetap terima sebagai jawaban.
  let value;
  try { value=JSON.parse(raw.trim().replace(/^```(?:json)?\s*|\s*```$/g,'')); }
  catch { value={reply:raw.trim().slice(0,3000)}; }
  const reply=typeof value.reply==='string'&&value.reply.trim()?value.reply.trim().slice(0,3000):(typeof value==='string'?value.slice(0,3000):null);
  if(!reply)throw new Error('Jawaban Asisten kosong.');
  const result={reply};
  if(validVisual(value.visual))result.visual=value.visual;
  return result;
}

function validExplanation(value) {
  const short=s=>typeof s==='string'&&s.length>0&&s.length<=140;
  return value&&short(value.title)&&short(value.summary)&&Array.isArray(value.steps)&&value.steps.length>=2&&value.steps.length<=4&&value.steps.every(short)&&short(value.insight)&&value.visual&&['number-line','groups','sequence','formula'].includes(value.visual.type)&&Array.isArray(value.visual.values)&&value.visual.values.length<=8&&value.visual.values.every(Number.isFinite)&&Array.isArray(value.visual.labels)&&value.visual.labels.length<=8&&value.visual.labels.every(short);
}

async function generateExplanation(question, config) {
  const fallback=localExplanation(question);
  if (!config.baseURL || !config.model) return fallback;
  try {
    const url=new URL(`${config.baseURL.replace(/\/$/, '')}/chat/completions`);
    if (!['http:','https:'].includes(url.protocol)||url.username||url.password) throw new Error();
    const response=await fetch(url,{method:'POST',signal:AbortSignal.timeout(AI_TIMEOUT),redirect:'error',headers:{'Content-Type':'application/json',...(config.apiKey?{Authorization:`Bearer ${config.apiKey}`}:{})},body:JSON.stringify({model:config.model,temperature:.35,max_tokens:700,stream:false,messages:[{role:'system',content:EXPLANATION_PROMPT},{role:'user',content:JSON.stringify(question)}]})});
    if(!response.ok) throw new Error();
    const raw=(await response.json()).choices?.[0]?.message?.content;
    const value=JSON.parse(raw.trim().replace(/^```(?:json)?\s*|\s*```$/g,''));
    if(!validExplanation(value)) throw new Error();
    return {...value,source:'asisten'};
  } catch { return fallback; }
}

async function generateIQAI(settings,config){
  if(!config.baseURL||!config.model)throw new Error('Asisten Belajar belum terhubung.');
  const url=new URL(`${config.baseURL.replace(/\/$/,'')}/chat/completions`);
  const response=await fetch(url,{method:'POST',signal:AbortSignal.timeout(AI_TIMEOUT),redirect:'error',headers:{'Content-Type':'application/json',...(config.apiKey?{Authorization:`Bearer ${config.apiKey}`}:{})},body:JSON.stringify({model:config.model,temperature:.9,max_tokens:900,stream:false,messages:[{role:'system',content:IQ_PROMPT},{role:'user',content:`Level ${settings.difficulty}. Hindari: ${(settings.history||[]).join(',')}.`} ]})});
  if(!response.ok)throw new Error('Model belum dapat membuat soal.');
  const raw=(await response.json()).choices?.[0]?.message?.content;
  const q=JSON.parse(raw.trim().replace(/^```(?:json)?\s*|\s*```$/g,''));
  const type=q.type==='sequence'?'sequence':['analogy','oddone','matrix','logic'].includes(q.type)?q.type:'sequence';
  const okSeq=Array.isArray(q.sequence)&&q.sequence.length===4&&q.sequence.every(n=>Number.isInteger(n)&&n>=0&&n<=100000);
  const okDisplay=typeof q.display==='string'&&q.display.length>0&&q.display.length<=400;
  const okAnswer=Number.isInteger(q.answer)&&q.answer>=0&&q.answer<=100000;
  const okHint=typeof q.hint==='string'&&q.hint.length>0&&q.hint.length<=160;
  if(!okAnswer||!okHint||(type==='sequence'?!okSeq:!okDisplay))throw new Error('Model menghasilkan soal yang tidak valid.');
  const prompt=typeof q.prompt==='string'&&q.prompt.length<=80?q.prompt:undefined;
  const id=type==='sequence'?q.sequence.join(':'):(q.display||'').replace(/\s+/g,' ').trim();
  if((settings.history||[]).includes(id))throw new Error('Model mengulang soal.');
  return {id,operation:'iq',sequence:type==='sequence'?q.sequence:undefined,answer:q.answer,hint:q.hint,type,display:q.display,prompt,source:'ai'};
}

function validGuide(value) {
  const cap=(s,max)=>typeof s==='string'&&s.length>0&&s.length<=max;
  const methodsOk = value.methods===undefined || (Array.isArray(value.methods)&&value.methods.length<=4&&value.methods.every(m=>m&&cap(m.name,40)&&cap(m.how,160)));
  const simOk = value.simulation===undefined || (value.simulation&&cap(value.simulation.title,60)&&Array.isArray(value.simulation.frames)&&value.simulation.frames.length>=2&&value.simulation.frames.length<=6&&value.simulation.frames.every(f=>f&&cap(f.caption,80)&&validVisual(f)));
  return value&&cap(value.title,60)&&cap(value.intro,300)&&cap(value.analogy,300)&&cap(value.example,200)&&cap(value.tip,250)&&
    Array.isArray(value.steps)&&value.steps.length>=2&&value.steps.length<=5&&value.steps.every(s=>cap(s,140))&&methodsOk&&simOk&&
    (!value.visual||validVisual(value.visual));
}

async function generateGuideAI(topic,config){
  if(!config.baseURL||!config.model)throw new Error('Asisten Belajar belum terhubung.');
  const url=new URL(`${config.baseURL.replace(/\/$/,'')}/chat/completions`);
  const metode=methodsFor(topic.id);
  const response=await fetch(url,{method:'POST',signal:AbortSignal.timeout(AI_TIMEOUT),redirect:'error',headers:{'Content-Type':'application/json',...(config.apiKey?{Authorization:`Bearer ${config.apiKey}`}:{})},body:JSON.stringify({model:config.model,temperature:.6,max_tokens:900,stream:false,messages:[{role:'system',content:GUIDE_PROMPT},{role:'user',content:`Materi: ${topic.title}. Inti materi: ${topic.brief}.${metode.length?` Metode yang biasa diajarkan aplikasi ini: ${metode.map(m=>`${m.name} (${m.how})`).join(' ')}. Boleh dipakai dan boleh tambah metode lain yang lebih membantu.`:''} Sasaran pembaca: orang dewasa yang belajar dari nol, gunakan contoh sehari-hari Indonesia.`}]})});
  if(!response.ok)throw new Error('Model belum dapat menyusun materi.');
  const raw=(await response.json()).choices?.[0]?.message?.content;
  const value=JSON.parse(raw.trim().replace(/^```(?:json)?\s*|\s*```$/g,''));
  if(!validGuide(value))throw new Error('Materi dari model tidak valid.');
  const hasil={...value,methods:value.methods?.length?value.methods:metode,references:referencesFor(topic.id),source:'asisten'};
  if(!validVisual(value.simulation?.frames?.[0]))delete hasil.simulation;
  return hasil;
}

export function createServer({ownerKey=accessKey,hosts=allowedHosts,ai = {baseURL:process.env.VPS_AI_BASE_URL,model:process.env.VPS_AI_MODEL||'VPS-Combo-gue',apiKey:vpsKey}} = {}) {
  let aiBusy = false, aiVerified = false;
  const sessions=new Map(); let failures=0,failureWindow=0;
  const configured = Boolean(ai.baseURL && ai.model);
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'");
    try {
      const host = req.headers.host || '';
      const hostname = (host.split(':')[0] || '').toLowerCase();
      // Reject unknown hosts and DNS rebinding; allowed hosts come from ALLOWED_HOSTS.
      if (!hosts.has(hostname)) return reply(res,403,{error:'Akses hanya melalui host yang diizinkan.'});
      const url = new URL(req.url, `http://${host}`);
      // Bandingkan host Origin dengan host permintaan (bukan skema), supaya POST
      // tetap lolos di belakang reverse proxy HTTPS (Caddy) maupun HTTP langsung.
      if (req.method === 'POST' && req.headers.origin) {
        let originHost = '';
        try { originHost = new URL(req.headers.origin).host; } catch { return reply(res,403,{error:'Origin tidak diizinkan.'}); }
        if (originHost !== host) return reply(res,403,{error:'Origin tidak diizinkan.'});
      }
      for(const [token,expiry] of sessions)if(expiry<=Date.now())sessions.delete(token);
      const cookie=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('math_owner='))?.slice(11);
      if(url.pathname==='/api/access'&&req.method==='POST'){
        if(Date.now()-failureWindow>60000){failures=0;failureWindow=Date.now();}
        if(failures>=10)return reply(res,429,{error:'Tunggu satu menit.'});
        let body;try{body=await readJSON(req);}catch{return reply(res,400,{error:'Permintaan tidak valid.'});}
        const a=Buffer.from(String(body.key||'')),b=Buffer.from(ownerKey);const same=a.length===b.length&&timingSafeEqual(a,b);
        if(!same){failures++;return reply(res,401,{error:'Kunci tidak sesuai.'});}
        failures=0;const token=randomBytes(32).toString('base64url');sessions.set(token,Date.now()+sessionTTL);res.setHeader('Set-Cookie',`math_owner=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionTTL/1000}`);return reply(res,200,{authorized:true});
      }
      if(!sessions.has(cookie)){
        if(url.pathname==='/'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(loginPage);}
        return reply(res,401,{error:'Kunci akses diperlukan.'});
      }
      if(url.pathname==='/api/access/logout'&&req.method==='POST'){sessions.delete(cookie);res.setHeader('Set-Cookie','math_owner=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return reply(res,200,{authorized:false});}
      if (url.pathname === '/api/ai/status' && req.method === 'GET') return reply(res,200,{configured,connected:aiVerified,provider:'VPS',model:configured ? ai.model : null});
      if (url.pathname === '/api/ai/test' && req.method === 'POST') {
        if (!configured) return reply(res,503,{error:'Endpoint dan model VPS belum dikonfigurasi.'});
        if (aiBusy) return reply(res,429,{error:'AI sedang menyiapkan soal.'});
        aiBusy=true;
        try { await generateAI({operation:'tambah',difficulty:'mudah'},ai); aiVerified=true; return reply(res,200,{connected:true}); }
        catch { aiVerified=false; return reply(res,502,{error:'VPS belum menghasilkan soal valid. Periksa endpoint, model, dan autentikasi.'}); }
        finally { aiBusy=false; }
      }
      if (url.pathname === '/api/challenge' && req.method === 'POST') {
        let body;
        try { body=await readJSON(req); } catch { return reply(res,400,{error:'Permintaan tidak valid.'}); }
        if (!isSettingsValid(body.operation,body.difficulty) || (body.engine && !['default','ai'].includes(body.engine))) return reply(res,400,{error:'Pilihan latihan tidak valid.'});
        if (body.digits !== undefined && body.digits !== null && !isDigitsValid(body.digits)) return reply(res,400,{error:'Digit tidak valid.'});
        if (body.digits != null && body.operation !== 'tambah') return reply(res,400,{error:'Digit hanya untuk penjumlahan.'});
        if (body.history !== undefined && (!Array.isArray(body.history) || body.history.length>100 || body.history.some(x=>typeof x!=='string' || !/^\d{1,6}:\d{1,6}(?::\d{1,6})?$/.test(x)))) return reply(res,400,{error:'Riwayat tidak valid.'});
        const digits = body.operation === 'tambah' && body.digits != null ? body.digits : undefined;
        const settings = {operation:body.operation,difficulty:body.difficulty,history:body.history || [], digits};
        if (body.engine !== 'ai' || body.operation === 'campuran') return reply(res,200,generateChallenge(settings));
        if (!configured) return reply(res,503,{error:'VPS belum dikonfigurasi.'});
        if (aiBusy) return reply(res,429,{error:'Tunggu sebentar.'});
        aiBusy=true;
        try { const question=await generateAI(settings,ai,body.story===true); aiVerified=true; return reply(res,200,question); }
        catch { aiVerified=false; return reply(res,200,{...generateChallenge(settings),fallback:true}); }
        finally { aiBusy=false; }
      }
      if(url.pathname==='/api/guide'&&req.method==='POST'){
        let body;try{body=await readJSON(req);}catch{return reply(res,400,{error:'Permintaan tidak valid.'});}
        const topic=GUIDE_TOPICS.find(x=>x.id===body.topic);
        if(!topic)return reply(res,400,{error:'Materi tidak ditemukan.'});
        try{return reply(res,200,await generateGuideAI(topic,ai));}
        catch{return reply(res,200,{...localGuide(body.topic),fallback:true});}
      }
      if(url.pathname==='/api/chat'&&req.method==='POST'){
        let body;try{body=await readJSON(req,CHAT_MAX);}catch{return reply(res,400,{error:'Pesan tidak valid.'});}
        const messages=Array.isArray(body.messages)?body.messages.slice(-8):null;
        if(!messages||!messages.length||messages.some(m=>!m||!['user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>1200))return reply(res,400,{error:'Pesan tidak valid.'});
        if(body.image!==undefined&&body.image!==null&&!isImageData(body.image))return reply(res,400,{error:'Gambar tidak valid.'});
        const last=messages.at(-1);
        if(last.role!=='user')return reply(res,400,{error:'Pesan terakhir harus dari pengguna.'});
        try{return reply(res,200,{...await generateChatReply(messages,body.image||null,ai)});}
        catch{const local=localChatReply(last.content);return reply(res,200,{reply:local.text,visual:local.visual,fallback:true});}
      }
      if (url.pathname === '/api/explanation' && req.method === 'POST') {
        let body;
        try { body=await readJSON(req); } catch { return reply(res,400,{error:'Soal tidak valid.'}); }
        if (!body.question || typeof body.question!=='object' || !['tambah','kurang','kali','bagi','campuran','iq','akar'].includes(body.question.operation)) return reply(res,400,{error:'Soal tidak valid.'});
        return reply(res,200,await generateExplanation(body.question,ai));
      }
      if(url.pathname==='/api/iq-test'&&req.method==='POST'){
        let body;try{body=await readJSON(req);}catch{return reply(res,400,{error:'Permintaan tidak valid.'});}
        if(!['mudah','sedang','sulit'].includes(body.difficulty)||!Array.isArray(body.history)||body.history.length>40)return reply(res,400,{error:'Pilihan tes tidak valid.'});
        try{return reply(res,200,await generateIQAI(body,ai));}
        catch{
          // Model kadang memakai seluruh jatah token untuk penalaran internal lalu
          // mengirim isi kosong. Daripada sesi tes langsung berhenti, pakai soal
          // bawaan yang setara dan tandai fallback supaya UI memberi tahu pengguna.
          try{return reply(res,200,{...generateIQ({difficulty:body.difficulty,topic:'mixed',history:body.history}),fallback:true});}
          catch{return reply(res,503,{error:'Asisten Belajar belum tersedia.'});}
        }
      }
      if (req.method !== 'GET') return reply(res,405,{error:'Metode tidak didukung.'});
      const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      if (!allowedFiles.has(file) && !/^assets\/[a-zA-Z0-9_-]+\.(svg|png|woff2|ttf)$/.test(file)) return reply(res,404,{error:'Halaman tidak ditemukan.'});
      try {
        const content = await fs.readFile(path.join(root,file));
        res.writeHead(200,{'Content-Type':mime[path.extname(file)]});res.end(content);
      } catch { reply(res,404,{error:'Halaman tidak ditemukan.'}); }
    } catch { reply(res,500,{error:'Permintaan belum dapat diproses.'}); }
  });
  // Sentuh model sekali saat start supaya /api/ai/status langsung melaporkan
  // "terhubung". Tanpa ini status baru berubah setelah ada satu permintaan AI
  // yang berhasil, sehingga tombol Asisten Belajar terlihat belum tersambung.
  if (configured) {
    generateAI({operation:'tambah',difficulty:'mudah'}, ai)
      .then(() => { aiVerified = true; })
      .catch(() => {});
  }
  return server;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createServer().listen(port,hostBind,()=>console.log(`Math Speedy privat: http://localhost:${port} · model ${process.env.VPS_AI_MODEL||'VPS-Combo-gue'}`));
}
