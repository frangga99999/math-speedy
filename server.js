import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {ownerKey, sameKey, loginPage} from './access.js';
import {generateChallenge, isQuestionValid, isSettingsValid, isDigitsValid, digitsRange, SYMBOLS, LIMITS, MINIMUMS} from './engine.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const env = await fs.readFile(path.join(root, '.env'), 'utf8').catch(() => '');
for (const line of env.split('\n')) {
  const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
}
const port = Number(process.env.PORT || 3000);
const hostBind = process.env.HOST || '127.0.0.1';
const allowedHosts = new Set((process.env.ALLOWED_HOSTS || 'localhost,127.0.0.1').split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
const allowedFiles = new Set(['index.html','style.css','challenge.css','home.css','app.js','engine.js','progress.js']);
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.ttf':'font/ttf'};
const sessionTTL = 8 * 60 * 60 * 1000;
const defaultOwnerKey = await ownerKey(root);
const keyFile = process.env.VPS_AI_KEY_FILE;
const vpsKey = keyFile ? (await fs.readFile(path.resolve(root, keyFile), 'utf8')).trim() : process.env.VPS_AI_API_KEY;

const AI_SYSTEM_PROMPT = 'Kamu guru matematika yang sabar dan ramah untuk orang dewasa yang baru memulai lagi belajar berhitung dari nol. Buat satu soal aritmetika yang menumbuhkan rasa percaya diri: angkanya wajar, tidak menakutkan. Balas HANYA JSON {"a":angka,"b":angka} tanpa teks lain, tanpa markdown, tanpa reasoning. Bilangan bulat non-negatif. Pengurangan hasilnya tidak negatif, pembagian hasilnya bulat dan penyebut bukan nol. Hindari pasangan angka yang sudah dipakai.';

function reply(res, status, body) {
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify(body));
}
async function readJSON(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 8000) throw new Error('Request too large');
  }
  const value = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid request');
  return value;
}

async function generateAI(settings, config) {
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
  const response = await fetch(url, {
    method:'POST', signal:AbortSignal.timeout(15000), redirect:'error',
    headers:{'Content-Type':'application/json', ...(config.apiKey ? {Authorization:`Bearer ${config.apiKey}`} : {})},
    body:JSON.stringify({model:config.model, temperature:.7, max_tokens:400, stream:false, messages:[
      {role:'system', content:AI_SYSTEM_PROMPT},
      {role:'user', content:`Operasi ${operation}. Level ${difficulty}. ${bounds} Hindari: ${history.join(',') || 'belum ada'}.`}
    ]})
  });
  if (!response.ok) throw new Error('AI unavailable');
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('Invalid AI response');
  const question = JSON.parse(content.trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));
  if (!isQuestionValid(question, operation, difficulty, history, digits)) throw new Error('Invalid question');
  return {a:question.a,b:question.b,operation,symbol:SYMBOLS[operation],source:'ai'};
}

export function createServer({accessKey = defaultOwnerKey, ai = {baseURL:process.env.VPS_AI_BASE_URL,model:process.env.VPS_AI_MODEL,apiKey:vpsKey}} = {}) {
  if (!accessKey || accessKey.length < 32) throw new Error('Owner access key required');
  const sessions = new Map();
  let failures = 0, failureWindow = 0, aiBusy = false, aiVerified = false;
  const configured = Boolean(ai.baseURL && ai.model);
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'");
    try {
      const host = req.headers.host || '';
      const hostname = (host.split(':')[0] || '').toLowerCase();
      // Reject unknown hosts and DNS rebinding; allowed hosts come from ALLOWED_HOSTS.
      if (!allowedHosts.has(hostname)) return reply(res,403,{error:'Akses hanya melalui host yang diizinkan.'});
      const url = new URL(req.url, `http://${host}`);
      // Bandingkan host Origin dengan host permintaan (bukan skema), supaya POST
      // tetap lolos di belakang reverse proxy HTTPS (Caddy) maupun HTTP langsung.
      if (req.method === 'POST' && req.headers.origin) {
        let originHost = '';
        try { originHost = new URL(req.headers.origin).host; } catch { return reply(res,403,{error:'Origin tidak diizinkan.'}); }
        if (originHost !== host) return reply(res,403,{error:'Origin tidak diizinkan.'});
      }
      for (const [key, expiry] of sessions) if (expiry <= Date.now()) sessions.delete(key);
      const cookie = req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('math_owner='))?.slice(11);
      const authorized = sessions.has(cookie);
      if (url.pathname === '/api/access' && req.method === 'POST') {
        if (Date.now() - failureWindow > 60000) { failures=0; failureWindow=Date.now(); }
        if (failures >= 10) return reply(res,429,{error:'Tunggu satu menit.'});
        let body;
        try { body=await readJSON(req); } catch { return reply(res,400,{error:'Permintaan tidak valid.'}); }
        if (!sameKey(body.key, accessKey)) { failures++; return reply(res,401,{error:'Kunci tidak sesuai.'}); }
        failures=0;
        const token = randomBytes(32).toString('base64url');
        sessions.set(token,Date.now()+sessionTTL);
        res.setHeader('Set-Cookie',`math_owner=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionTTL/1000}`);
        return reply(res,200,{authorized:true});
      }
      if (!authorized) {
        if (url.pathname === '/' && req.method === 'GET') {
          res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}); return res.end(loginPage);
        }
        return reply(res,401,{error:'Akses pemilik diperlukan.'});
      }
      if (url.pathname === '/api/access/logout' && req.method === 'POST') {
        sessions.delete(cookie);
        res.setHeader('Set-Cookie','math_owner=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
        return reply(res,200,{authorized:false});
      }
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
        if (body.history !== undefined && (!Array.isArray(body.history) || body.history.length>100 || body.history.some(x=>typeof x!=='string' || !/^\d{1,6}:\d{1,6}$/.test(x)))) return reply(res,400,{error:'Riwayat tidak valid.'});
        const digits = body.operation === 'tambah' && body.digits != null ? body.digits : undefined;
        const settings = {operation:body.operation,difficulty:body.difficulty,history:body.history || [], digits};
        if (body.engine !== 'ai') return reply(res,200,generateChallenge(settings));
        if (!configured) return reply(res,503,{error:'VPS belum dikonfigurasi.'});
        if (aiBusy) return reply(res,429,{error:'Tunggu sebentar.'});
        aiBusy=true;
        try { const question=await generateAI(settings,ai); aiVerified=true; return reply(res,200,question); }
        catch { aiVerified=false; return reply(res,200,{...generateChallenge(settings),fallback:true}); }
        finally { aiBusy=false; }
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
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createServer().listen(port,hostBind,()=>console.log(`Math Speedy privat: http://localhost:${port} — kunci akses di .private-access`));
}
