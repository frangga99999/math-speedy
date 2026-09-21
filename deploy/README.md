# Deploy Math Speedy (VPS + HTTPS)

Rekaman konfigurasi infrastruktur yang benar-benar berjalan di VPS
`ubuntu@43.134.180.13`. Tujuannya: kalau VPS perlu dibangun ulang, tinggal
salin berkas di sini.

## Arsitektur

```
pengunjung --HTTPS:8788--> Caddy (TLS, Let's Encrypt DNS-01)
                              |
                              +--proxy--> Node app 127.0.0.1:8791
```

- App Node **tidak menghadap publik** (`HOST=127.0.0.1`), hanya Caddy yang bisa
  menjangkaunya.
- Port **80/443 tertutup** di security group Tencent Cloud, jadi sertifikat
  diambil lewat tantangan **DNS-01 DuckDNS** (tidak butuh port 80) dan HTTPS
  tetap disajikan di **8788**.
- Port **8790 sudah dipakai NumQuest**, jadi app ini memakai **8791**.

## Berkas di sini

| Berkas | Dipasang ke |
|---|---|
| `mathspeedy.service` | `~/.config/systemd/user/mathspeedy.service` |
| `caddy.service` | `~/.config/systemd/user/caddy.service` |
| `Caddyfile` | `~/.config/caddy/Caddyfile` |
| `duckdns-update.sh` | `~/.local/bin/duckdns-update.sh` |
| `duckdns-update.service` + `.timer` | `~/.config/systemd/user/` |
| `skill/math-speedy-vps/` | `~/.hermes/skills/devops/math-speedy-vps/` |

`duckdns-update.timer` memperbarui record A DuckDNS **setiap hari**. DuckDNS
menghapus domain yang tidak diperbarui (sekitar 30 hari), jadi timer ini yang
menjaga `mathspeedy.duckdns.org` — dan karenanya HTTPS — tetap hidup.

Rahasia **tidak** ada di repo ini:

| Rahasia | Lokasi |
|---|---|
| Kunci akses aplikasi | `~/math-speedy/.private-access` (mode 600) |
| Kunci API AI | ditunjuk `VPS_AI_KEY_FILE` di `~/math-speedy/.env` |
| Token DuckDNS | `~/.config/caddy/caddy.env` (`DUCKDNS_TOKEN=...`, mode 600) |

## Langkah pasang ulang

1. **Node app**
   ```bash
   rsync -a ./ ubuntu@43.134.180.13:~/math-speedy/ \
     --exclude .env --exclude .private-access --exclude .vps-ai-key --exclude .git
   ```
   Isi `~/math-speedy/.env`:
   ```env
   PORT=8791
   HOST=127.0.0.1
   ALLOWED_HOSTS=43.134.180.13,127.0.0.1,localhost,mathspeedy.duckdns.org
   VPS_AI_BASE_URL=http://127.0.0.1:20128/v1
   VPS_AI_MODEL=VPS-Combo-gue
   VPS_AI_KEY_FILE=.vps-ai-key
   ```
   Bikin `.private-access` (min. 32 karakter, mode 600) dan `.vps-ai-key`.

2. **Caddy** (biner wajib memuat modul DuckDNS):
   ```bash
   curl -fsSL -o /tmp/caddy \
     "https://caddyserver.com/api/download?os=linux&arch=amd64&p=github.com/caddy-dns/duckdns"
   sudo mv /tmp/caddy /usr/local/bin/caddy && sudo chmod +x /usr/local/bin/caddy
   sudo setcap cap_net_bind_service=+ep /usr/local/bin/caddy
   ```

3. **Servis**
   ```bash
   systemctl --user daemon-reload
   systemctl --user enable --now mathspeedy.service caddy.service
   ```

## Jebakan yang sudah pernah kena

- **Let's Encrypt menolak email `example.com`** (`invalidContact`). Daftarkan Caddy
  **tanpa** blok `email` di Caddyfile.
- Cek Origin di `server.js` dulu membandingkan `http://${host}` sehingga login
  lewat HTTPS ditolak `403`. Sekarang membandingkan **host**; jangan dibalikkan.
- `server.js` **menyentuh model sekali saat start** (warm-up) supaya
  `/api/ai/status` langsung melaporkan `connected:true`. Tanpa itu, tombol
  Asisten Belajar terlihat "belum tersambung" sampai ada satu permintaan AI
  yang berhasil — padahal modelnya sehat.
- Biner Caddy standar **tidak** punya provider DuckDNS — wajib unduh dengan
  parameter `p=github.com/caddy-dns/duckdns`.
- Bila `HOST` diubah ke `0.0.0.0`, port app bentrok dengan Caddy di 8788.
- `auto_https disable_redirects` dipakai supaya Caddy tidak mencoba membuka port 80
  (yang tertutup dari luar).

## Verifikasi cepat

```bash
curl -sI https://mathspeedy.duckdns.org:8788/            # dari luar: HTTP 200
curl -s  https://mathspeedy.duckdns.org:8788/ | head     # halaman login
bash ~/.hermes/skills/devops/math-speedy-vps/scripts/mathspeedy-ctl.sh status
```
