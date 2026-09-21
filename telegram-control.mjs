// Math Speedy — Telegram control bot.
// Kelola kunci akses + status aplikasi dari Telegram (hanya chat yang diizinkan).
// Env: TELEGRAM_BOT_TOKEN, ALLOWED_CHAT_IDS (pisah koma), APP_URL, SERVICE, KEY_FILE.
import fs from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED = new Set((process.env.ALLOWED_CHAT_IDS || '').split(',').map(s => Number(s.trim())).filter(Boolean));
const APP_DIR = process.env.APP_DIR || '/home/ubuntu/math-speedy';
const KEY_FILE = process.env.KEY_FILE || `${APP_DIR}/.private-access`;
const APP_URL = process.env.APP_URL || 'http://43.134.180.13:8788';
const SERVICE = process.env.SERVICE || 'mathspeedy.service';

if (!TOKEN) { console.error('TELEGRAM_BOT_TOKEN wajib diisi.'); process.exit(1); }

const API = `https://api.telegram.org/bot${TOKEN}`;

async function api(method, params = {}) {
  const res = await fetch(`${API}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
  return res.json();
}
const sendMessage = (chatId, text) => api('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true });
const readKey = async () => (await fs.readFile(KEY_FILE, 'utf8')).trim();
const rotateKey = async () => { const key = randomBytes(32).toString('base64url'); await fs.writeFile(KEY_FILE, key, { mode: 0o600 }); return key; };

async function restartService() {
  try { await execAsync(`systemctl --user restart ${SERVICE}`); return true; }
  catch { return false; }
}

async function handle(chatId, text) {
  const cmd = text.trim().split(/\s+/)[0].toLowerCase();
  if (cmd === '/start' || cmd === '/help') {
    return sendMessage(chatId, `🔐 <b>Kontrol Math Speedy</b>\n\n/kunci — lihat kunci akses\n/kuncibaru — ganti kunci (keluarkan semua sesi)\n/status — status aplikasi\n/url — alamat aplikasi`);
  }
  if (cmd === '/kunci') {
    const key = await readKey();
    return sendMessage(chatId, `🔑 Kunci akses kamu:\n\n<code>${key}</code>\n\nBuka ${APP_URL} lalu masukkan kunci ini.`);
  }
  if (cmd === '/kuncibaru') {
    const key = await rotateKey();
    const ok = await restartService();
    return sendMessage(chatId, `✅ Kunci baru dibuat, semua sesi keluar.\n\n<code>${key}</code>${ok ? '' : `\n\n⚠️ Gagal restart otomatis. Jalankan manual: systemctl --user restart ${SERVICE}`}`);
  }
  if (cmd === '/status') {
    let active = 'tidak diketahui';
    try { active = (await execAsync(`systemctl --user is-active ${SERVICE}`)).stdout.trim(); } catch {}
    return sendMessage(chatId, `📊 <b>Status</b>\nAplikasi: <b>${active}</b>\nURL: ${APP_URL}\nModel AI: VPS-Combo-gue`);
  }
  if (cmd === '/url') {
    return sendMessage(chatId, `🌐 ${APP_URL}`);
  }
  return sendMessage(chatId, 'Perintah tidak dikenal. Ketik /help.');
}

let offset = 0;
console.log(`Math Speedy control bot aktif. Chat diizinkan: ${[...ALLOWED].join(',') || '(semua)'}`);
while (true) {
  try {
    const updates = await api('getUpdates', { offset, timeout: 30, allowed_updates: ['message'] });
    if (updates.ok && Array.isArray(updates.result)) {
      for (const u of updates.result) {
        offset = u.update_id + 1;
        const msg = u.message;
        if (!msg || !msg.text) continue;
        if (ALLOWED.size && !ALLOWED.has(msg.chat.id)) {
          await sendMessage(msg.chat.id, 'Akses ditolak.').catch(() => {});
          continue;
        }
        try { await handle(msg.chat.id, msg.text); } catch (e) { console.error('handle error', e.message); }
      }
    }
  } catch (e) {
    console.error('poll error:', e.message);
    await new Promise(r => setTimeout(r, 3000));
  }
}
