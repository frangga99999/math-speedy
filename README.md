# Math Speedy

Aplikasi latihan hitung pribadi: empat operasi, tiga tingkat kesulitan, 10 soal, 5 nyawa, dan waktu aktif 80 detik per sesi.

## Jalankan dan buka

```sh
npm start
```

Buka alamat lokal yang dicetak terminal dan masukkan kunci dari file `access-key-math.txt`. Ubah isi file melalui editor teks atau terminal, lalu restart server. File berizin `0600`, tidak dilayani melalui HTTP, dan diabaikan Git.

Aplikasi hanya mendengarkan di `127.0.0.1`, menolak host asing, membatasi percobaan login, dan memakai cookie sesi `HttpOnly; SameSite=Strict` selama delapan jam.

Jalankan lewat server ini, bukan membuka `index.html` langsung atau server statis lain. Untuk akses ponsel, diperlukan konfigurasi jaringan privat dan autentikasi yang sesuai; versi ini tetap localhost saja.

## Asisten Belajar dengan VPS opsional

Generator bawaan berjalan lokal tanpa jaringan. Koneksi OpenRouter telah diganti dengan endpoint VPS pribadi yang kompatibel dengan OpenAI Chat Completions.

Isi `.env` berdasarkan `.env.example`:

```dotenv
PORT=3000
VPS_AI_BASE_URL=https://alamat-vps-anda/v1
VPS_AI_MODEL=VPS-Combo-gue
VPS_AI_KEY_FILE=/lokasi/file-kunci-pribadi
```

Gunakan base URL persis seperti layanan model Anda; aplikasi menambahkan `/chat/completions`. Model bawaan adalah `VPS-Combo-gue`. Simpan kunci API di file lokal berizin `0600`. Restart server setelah mengubah konfigurasi, lalu buka **Asisten Belajar → Uji model**.

Permintaan memiliki timeout 30 detik (`AI_TIMEOUT`), dan 60 detik untuk permintaan bergambar: latensi model lewat tunnel terukur ~18–19 detik walau untuk jawaban singkat, sehingga timeout 15 detik membuat semua permintaan AI diam-diam jatuh ke soal bawaan. Soal AI harus memenuhi operasi, level, pembagian bulat, dan tidak mengulang pasangan angka. Respons gagal atau tidak valid dialihkan ke soal bawaan atau materi bawaan dengan pemberitahuan.

## Kolom chat Asisten Belajar

Menu **Asisten Belajar** membuka kolom chat, bukan lagi jalur materi. Pengguna bisa bertanya bebas soal tantangan, metode cepat, atau materi lain; enam saran pertanyaan tampil sejak awal dan tetap tersedia sebagai baris chip. Riwayat delapan pesan terakhir dikirim sebagai konteks.

Tombol kamera di samping kolom kirim memotret soal matematika (`capture="environment"`). Foto dikecilkan di perangkat ke maksimal 1024 px dan JPEG mutu 0,72 sebelum dikirim sebagai data URL; model membacanya sebagai pesan bergambar lalu menjelaskan konsepnya. Bila model tidak tersedia, jawaban cadangan dicocokkan dari katalog materi lokal (`localChatReply`).

## Operasi campuran dan variasi cerita

- **Operasi Campuran** (`campuran`) adalah tantangan baru di menu: satu langkah untuk Mudah, masuk perkalian untuk Sedang, dan urutan operasi penuh untuk Sulit (`2 + 3 × 4`, `(2 + 3) × 4`). Jawaban tetap bilangan bulat dan dibatasi 0–400.
- Sekitar sepertiga sesi penjumlahan/kurang/kali/bagi tampil sebagai **soal cerita**: angka soal sama, hanya bingkainya yang berubah. Mesin AI menulis ceritanya (opsi `story:true`), sedangkan mesin bawaan membungkus soal dengan templat lokal (`frameStory`). Sesi cerita memakai layar menulis, bukan keypad.
- Setiap dialog pengaturan tantangan memuat kartu lipat **Metode yang membantu**, dan tiap materi panduan memuat bagian **METODE YANG MEMBANTU** — termasuk PEMDAS/KUKABATAKU untuk operasi campuran. Katalognya ada di `METHODS` (`engine.js`), dipakai juga oleh jawaban Asisten Belajar dan penjelasan soal campuran.

## Halaman panduan

Tombol **Panduan lengkap** di beranda membuka halaman penuh (bukan modal) berisi daftar isi 21 materi dalam tiga kelompok: Dasar berhitung, Keterampilan, dan Materi lanjutan. Memilih materi menyusun isinya lewat `/api/guide`: pengertian, analogi, metode, langkah, contoh, tips, dan visual. Materi bawaan dari katalog yang sama dipakai bila AI tidak tersedia, dan tombol **Latih materi ini** membuka pengaturan tantangan terkait.

## Tampilan dan progres

- Home mengikuti panel melengkung, gradien biru, font lokal, dan tombol kaca dari Figma node `2004:164`, dengan empat operasi yang sudah berfungsi.
- Dashboard menampilkan target harian 10 soal, akurasi, jumlah jawaban, sesi tuntas, dan rentetan hari aktif.
- Bagian bawah berisi grafik tujuh hari, kartu Asisten Belajar (chat), tombol Panduan lengkap, serta tiga sesi terakhir yang dapat dipilih untuk mengulang latihan.
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

Menu **Tabel Perhitungan** di beranda memisahkan tabel dari dialog pengaturan menjadi fitur sendiri: penjumlahan, pengurangan, perkalian, pembagian, dan akar. Pilihan angka 1–30 mengubah tabel; pengurangan menjaga hasil non-negatif, pembagian memakai kelipatan dengan hasil bulat, dan akar menampilkan akar kuadrat sempurna (√1 sampai √900). Tombol **Mulai tantangan** membuka latihan 10 soal untuk menguji ingatan pada tabel yang baru dipelajari. Menu IQ memiliki **Panduan pola angka** berisi contoh dan aturan pola.

## Pilihan IQ, matematika AI, dan dashboard visual

- IQ: pilih Campuran, Tambah & kurang, Perkalian, Selisih bertingkat, Bergantian, atau Kuadrat dahulu, kemudian pilih level. Tombol Ganti jenis pola kembali ke pilihan jenis.
- Materi matematika dewasa (nilai tempat, pecahan, persen, uang, aljabar, peluang, gradien, estimasi, dan lainnya) kini disajikan sebagai materi panduan, bukan jalur tantangan terpisah.
- Tes penalaran meminta `VPS-Combo-gue` membuat soal unik untuk setiap langkah. Hasilnya adalah indeks latihan 0–100, bukan skor IQ klinis atau diagnosis.
- Dashboard: bola progres kaca, orbit, pantulan, dan simbol mengambang berjalan berulang. Tombol jeda mengontrol animasi; reduced motion mematikannya.

## Input challenge yang menyesuaikan konteks

Challenge aritmetika dasar dan operasi campuran tetap memakai keypad kaca karena sesi tersebut berfokus pada hitung cepat. Latihan IQ dan sesi versi cerita memakai lembar soal yang lebih luas dengan kolom jawaban native, sehingga angka panjang dan teks cerita muat dengan nyaman. Input menerima sampai 12 digit, membersihkan karakter selain angka, mendukung Enter untuk memeriksa, dan menyediakan tombol hapus, petunjuk, menyerah, serta keluar. Warna dan judul lembar berubah menurut konteks IQ atau cerita.
