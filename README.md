# Math Speedy

Aplikasi latihan hitung pribadi: empat operasi, tiga tingkat kesulitan, 10 soal, 5 nyawa, dan waktu aktif 80 detik per sesi.

## Jalankan dan buka

```sh
npm start
```

Buka **http://localhost:3000** dan masukkan kunci dari file `.private-access` dalam folder proyek. File tersebut dibuat otomatis dengan izin `0600`, tidak dilayani melalui HTTP, dan diabaikan Git. Jangan bagikan kunci ini. Server hanya mendengarkan di `127.0.0.1`, sehingga tidak tersedia langsung dari internet atau perangkat lain.

Aplikasi, aset, dan API memerlukan cookie pemilik `HttpOnly; SameSite=Strict`. Sesi berlaku maksimal delapan jam; restart server mengakhiri semua sesi. **Pengaturan AI VPS → Kunci aplikasi** mengakhiri sesi browser saat ini. Host selain localhost/127.0.0.1 dan POST dari origin berbeda ditolak. Percobaan kunci salah dibatasi. Orang yang memakai akun sistem operasi atau browser yang sudah terbuka tetap dapat mengaksesnya; ini bukan isolasi dari administrator komputer.

Jalankan lewat server ini, bukan membuka `index.html` langsung atau server statis lain. Untuk akses ponsel, diperlukan konfigurasi jaringan privat dan autentikasi yang sesuai; versi ini tetap localhost saja.

## AI VPS opsional

Generator bawaan berjalan lokal tanpa jaringan. Koneksi OpenRouter telah diganti dengan endpoint VPS pribadi yang kompatibel dengan OpenAI Chat Completions.

Isi `.env` berdasarkan `.env.example`:

```dotenv
PORT=3000
VPS_AI_BASE_URL=https://alamat-vps-anda/v1
VPS_AI_MODEL=nama-model-anda
VPS_AI_KEY_FILE=/lokasi/file-kunci-pribadi
```

Gunakan base URL persis seperti layanan model Anda; aplikasi menambahkan `/chat/completions`. Untuk layanan tanpa API key, kosongkan `VPS_AI_KEY_FILE`. Alternatifnya, berikan `VPS_AI_API_KEY` melalui environment. Simpan kunci dalam file lokal berizin `0600`. Restart server setelah mengubah konfigurasi, lalu buka **Pengaturan AI VPS → Uji koneksi VPS**. Tombol ini meminta satu soal sungguhan, memvalidasi hasil, dan menampilkan keberhasilan/kegagalan. Nama model ditampilkan, API key tidak dikirim ke browser.

Permintaan memiliki timeout 15 detik. Soal AI harus memenuhi operasi, level, pembagian bulat, dan tidak mengulang pasangan angka. Respons gagal atau tidak valid dialihkan ke soal bawaan dengan pemberitahuan. Konfigurasi endpoint/model VPS nyata masih diperlukan sebelum integrasi langsung dapat diverifikasi.

## Tampilan dan progres

- Home mengikuti panel melengkung, gradien biru, font lokal, dan tombol kaca dari Figma node `2004:164`, dengan empat operasi yang sudah berfungsi.
- Dashboard menampilkan target harian 10 soal, akurasi, jumlah jawaban, sesi tuntas, dan rentetan hari aktif.
- Bagian bawah berisi grafik tujuh hari, akses AI VPS, serta tiga sesi terakhir yang dapat dipilih untuk mengulang pengaturan latihan.
- Progres tersimpan di localStorage perangkat ini, maksimal 500 sesi. Sesi yang dihentikan tetap menghitung jawaban tetapi tidak dihitung sebagai sesi tuntas. Sesi tanpa jawaban tidak disimpan.
- Challenge memakai aset Figma lokal dari node `2002:2`, keypad interaktif, tombol tutup, dan konfirmasi sebelum menyerah/keluar. Timer berhenti saat dialog terbuka, AI menyiapkan soal, atau feedback ditampilkan.
- Sesi tuntas mendapat animasi medali, confetti, dan elemen hasil yang masuk bertahap. Preferensi reduced motion dihormati. Tidak ada font/analitik pihak ketiga pada halaman aplikasi.

## Pengujian

```sh
npm test
```

18 pengujian mencakup 3.600 soal dalam 12 kombinasi operasi/level, penyimpanan dan perhitungan progres, autentikasi pemilik, aset terlindungi, koneksi VPS tiruan, validasi AI, fallback, serta logout. Pengujian browser mencakup home mobile, popup AI, pembatalan menyerah, tombol keluar, satu sesi 10/10, dan progres yang bertahan setelah reload. Hasil sesi pengujian browser tersimpan seperti sesi biasa.

## Latihan IQ dan tabel referensi

Menu beranda berupa grid kartu kotak dengan simbol dan label ringkas. **Latihan IQ** menggunakan generator lokal untuk deret angka: tambah/kurang tetap (Mudah), perkalian/selisih bertingkat (Sedang), serta pola bergantian/kuadrat (Sulit). Ini latihan logika, bukan alat pengukuran skor IQ. Jawaban, bantuan, nyawa, hasil sesi, dan progres memakai alur latihan yang sama.

Pilih salah satu operasi lalu **Tabel penjumlahan/pengurangan/perkalian/pembagian** untuk membuka referensi. Pilihan angka 1–12 mengubah tabel; pengurangan menjaga hasil non-negatif dan pembagian memakai kelipatan dengan hasil bulat. Menu IQ memiliki **Panduan pola angka** berisi contoh dan aturan pola. Total pengujian otomatis sekarang 22.

## Pilihan IQ, matematika AI, dan dashboard visual

- IQ: pilih Campuran, Tambah & kurang, Perkalian, Selisih bertingkat, Bergantian, atau Kuadrat dahulu, kemudian pilih level. Tombol Ganti jenis pola kembali ke pilihan jenis.
- Matematika AI: lima materi berurutan (fungsi/bobot, vektor, rata-rata, peluang, gradien). Setiap materi memiliki penjelasan, rumus, contoh, pilihan level, dan sepuluh soal lokal. Sesi tuntas dengan minimal tujuh jawaban benar menandai materi selesai; progres materi disimpan bersama riwayat sesi. Materi dapat diulang atau dijelajahi langsung. Kursus ini tidak memerlukan model VPS.
- Dashboard: bola progres kaca, orbit, pantulan, dan simbol mengambang berjalan berulang. Tombol jeda mengontrol animasi; reduced motion mematikannya.
- 24 tes otomatis; uji browser menyelesaikan materi Fungsi & bobot hingga status 1/5 tuntas.

## Input challenge yang menyesuaikan konteks

Challenge aritmetika dasar tetap memakai keypad kaca karena sesi tersebut berfokus pada hitung cepat. Latihan IQ dan Matematika AI memakai lembar soal yang lebih luas dengan kolom jawaban native, sehingga angka panjang dapat diketik melalui keyboard fisik atau keypad numerik ponsel. Input menerima sampai 12 digit, membersihkan karakter selain angka, mendukung Enter untuk memeriksa, dan menyediakan tombol hapus, petunjuk, menyerah, serta keluar. Warna dan judul lembar berubah menurut konteks IQ atau materi AI. Total pengujian otomatis saat ini 26.
