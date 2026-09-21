import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes, createHash, timingSafeEqual} from 'node:crypto';

export async function ownerKey(root) {
  const file = path.join(root, '.private-access');
  try { await fs.writeFile(file, randomBytes(32).toString('base64url'), {flag:'wx', mode:0o600}); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  await fs.chmod(file, 0o600);
  const key = (await fs.readFile(file, 'utf8')).trim();
  if (key.length < 32) throw new Error('Kunci akses privat tidak valid.');
  return key;
}

export function sameKey(input, expected) {
  if (typeof input !== 'string' || input.length > 200) return false;
  const digest = value => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(input), digest(expected));
}

export const loginPage = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SpeedyMath · Akses privat</title><style>
*{box-sizing:border-box}body{margin:0;min-height:100dvh;display:grid;place-items:center;background:linear-gradient(155deg,#191d24,#12364b);color:#eef5fa;font:15px/1.6 system-ui,sans-serif;padding:24px}main{width:min(100%,360px)}header{text-align:center;font-size:22px;font-style:italic;font-weight:650;margin-bottom:52px}h1{font-size:28px;letter-spacing:-1px;margin:0 0 10px}p{color:#b9cbd7;font-size:13px}label{display:block;font-size:12px;margin:26px 0 8px}input,button{font:inherit;width:100%;min-height:52px;border-radius:14px;padding:12px 16px}input{background:#ffffff08;border:1px solid #c4d9e440;color:#fff}button{margin-top:14px;border:0;background:#c5ead0;color:#183d2a;font-weight:650;cursor:pointer}button:active{transform:scale(.98)}button:disabled{opacity:.6}small{display:block;color:#9fb7c6;font-size:11px;margin-top:22px}#message{min-height:24px;color:#ffb5b5}a{color:#c9efdc}input:focus-visible,button:focus-visible{outline:3px solid #a2dcb9;outline-offset:3px}</style></head><body><main><header>SpeedyMath</header><h1>Ruang latihan pribadi.</h1><p>Masukkan kunci akses pemilik untuk membuka aplikasi.</p><form id="login"><label for="key">Kunci akses</label><input id="key" name="key" type="password" autocomplete="current-password" required autofocus><button type="submit">Buka latihan</button><p id="message" role="status"></p></form><small>Kunci ada di file <b>.private-access</b> dalam folder proyek. Aplikasi hanya mendengarkan di komputer ini.</small></main><script>
document.querySelector('#login').addEventListener('submit',async event=>{event.preventDefault();const button=document.querySelector('button');button.disabled=true;button.textContent='Membuka…';try{const response=await fetch('/api/access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:document.querySelector('#key').value.trim()})});if(!response.ok)throw new Error(response.status===429?'Terlalu banyak percobaan. Tunggu satu menit.':'Kunci akses tidak sesuai.');location.reload();}catch(error){document.querySelector('#message').textContent=error.message;button.disabled=false;button.textContent='Buka latihan';}});
</script></body></html>`;
