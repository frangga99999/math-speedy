---
name: math-speedy-vps
description: Use when controlling Math Speedy (kunci/status/URL) via Telegram.
category: devops
tags: [math-speedy, mathspeedy, vps, systemd, telegram, access-key, caddy, duckdns, https]
---

# Math Speedy (latihan hitung privat + AI) di VPS

Aplikasi latihan aritmatika **privat** milik user. Node.js murni tanpa dependensi,
UI berbahasa Indonesia. Soal bisa dibuat mesin bawaan (`engine.js`) atau oleh AI
(`VPS-Combo-gue` lewat 9router lokal). Akses dilindungi **kunci akses pemilik**
(file `access-key-math.txt`) + cookie sesi `HttpOnly; SameSite=Strict`.

## Fakta kunci

| Hal | Nilai |
|---|---|
| Repo | `https://github.com/frangga99999/math-speedy` (publik) |
| Di VPS | `~/math-speedy` |
| Servis app | `systemctl --user mathspeedy.service` (aktif, autostart/linger) |
| Alamat app | `127.0.0.1:8791` (internal saja — TIDAK menghadap publik) |
| URL publik | `https://mathspeedy.duckdns.org:8788/` (tersimpan di `~/math-speedy/.public-url`) |
| HTTPS | Caddy (`systemctl --user caddy.service`), sertifikat Let's Encrypt via **DNS-01 DuckDNS**, auto-renew |
| Konfigurasi Caddy | `~/.config/caddy/Caddyfile`, token di `~/.config/caddy/caddy.env` |
| Kunci akses | `~/math-speedy/access-key-math.txt` |
| AI | 9router lokal `http://127.0.0.1:20128/v1`, model `VPS-Combo-gue`, **WAJIB `stream:false`**. Combo ini merotasi model (terlihat `gemini-3.1-flash-lite`/`3.5-flash-lite`) dan **mendukung gambar** lewat format vision OpenAI (`content:[{type:'image_url'}]`) |
| Log | `journalctl --user -u mathspeedy.service` (app) atau `-u caddy.service` (TLS) |
| Endpoint AI | `/api/challenge` (soal, opsi `story:true` untuk versi cerita), `/api/chat` (kolom chat, menerima `image` data URL untuk foto soal), `/api/explanation` (Asisten Belajar + visual), `/api/iq-test` (Tes penalaran adaptif), `/api/guide` (materi panduan) |
| Versi | **satu versi saja**: kode di `main`, deploy ke VPS, mirror GitHub Pages sudah dimatikan |

Arsitektur: pengunjung -> Caddy `:8788` (TLS) -> app `127.0.0.1:8791`.
Port 80/443 **tertutup** di security group Tencent, jadi sertifikat diambil lewat
DNS-01 (tanpa tantangan HTTP) dan HTTPS tetap disajikan di port 8788.

## Perintah kontrol (dipakai saat user minta lewat Telegram)

Skrip: `scripts/mathspeedy-ctl.sh` di dalam folder skill ini.

```bash
bash ~/.hermes/skills/devops/math-speedy-vps/scripts/mathspeedy-ctl.sh status
bash ~/.hermes/skills/devops/math-speedy-vps/scripts/mathspeedy-ctl.sh show-key
bash ~/.hermes/skills/devops/math-speedy-vps/scripts/mathspeedy-ctl.sh set-key "KUNCI_BARU_MIN_32_KARAKTER"
bash ~/.hermes/skills/devops/math-speedy-vps/scripts/mathspeedy-ctl.sh new-key
bash ~/.hermes/skills/devops/math-speedy-vps/scripts/mathspeedy-ctl.sh url
```

Peta permintaan user -> tindakan:

| User bilang | Jalankan |
|---|---|
| "kunci sekarang apa?" | `show-key` |
| "ganti kunci jadi XXX" | `set-key XXX` |
| "bikin kunci baru / acak" | `new-key` |
| "status aplikasi" | `status` |
| "link / url-nya?" | `url` |

Balas user dengan ringkas + kunci/URL hasilnya. Jangan pernah menulis kunci ke log,
commit, atau tempat lain.

## Jebakan

- **Ganti kunci = semua sesi login lama mati** (sesi disimpan di memori). Itu memang
  perilaku yang diinginkan.
- Kunci minimal 32 karakter; `set-key` menolak yang lebih pendek.
- **Jangan set `HOST=0.0.0.0`** — app harus tetap di `127.0.0.1` supaya hanya Caddy
  yang bisa menjangkaunya. `ALLOWED_HOSTS` wajib memuat `mathspeedy.duckdns.org`.
- Cek Origin di `server.js` membandingkan **host** (bukan skema) — jangan dibalikkan
  ke perbandingan `http://` atau login lewat HTTPS akan ditolak 403.
- Let's Encrypt menolak email berdomain contoh (`example.com`); Caddy didaftarkan
  **tanpa email** — biarkan begitu.
- Port **8790 dipakai NumQuest**; app Math Speedy memakai **8791**.
- Jangan taruh berkas log di dalam folder aplikasi.
- **`max_tokens` endpoint AI jangan diturunkan.** `VPS-Combo-gue` bisa memakai
  ~440 token untuk penalaran internal, jadi jatah 350 membuat isi balasan kosong
  (`Unexpected end of JSON input`). `/api/iq-test` memakai 900.
- **Timeout AI jangan diturunkan dari 30 detik** (`AI_TIMEOUT` di `server.js`).
  Latensi model lewat tunnel terukur ~18-19 detik walau untuk jawaban mini;
  timeout 15 detik membuat semua permintaan AI selalu kehabisan waktu dan
  diam-diam jatuh ke soal bawaan. Permintaan bergambar (`/api/chat` + foto)
  memakai 60 detik karena token gambarnya jauh lebih besar.
- `/api/chat` membaca badan permintaan sampai 1,6 MB agar data URL foto muat;
  endpoint lain tetap dibatasi 8 KB. Batas ini ada di `readJSON(req, max)`.
- Kegagalan model **tidak** boleh menghentikan sesi: `/api/iq-test` mengirim soal
  bawaan (`fallback:true`) dan UI memberi tahu pengguna. Pola yang sama dipakai
  `/api/challenge`.
- Kunci akses dibuat **otomatis** (mode 600) bila `access-key-math.txt` hilang.
  Kalau tiba-tiba kunci lama ditolak, cek dengan `show-key`.
- `HOST` dan `ALLOWED_HOSTS` dibaca dari `.env` — nilai di VPS:
  `HOST=127.0.0.1` dan `ALLOWED_HOSTS` memuat `mathspeedy.duckdns.org`.
- **Rahasia tidak pernah masuk repo**: `access-key-math.txt`, `.env`,
  `.vps-ai-key` ada di `.gitignore`. Kunci lokal Mac dan VPS harus sama.
