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

Permintaan memiliki timeout 15 detik. Soal AI harus memenuhi operasi, level, pembagian bulat, dan tidak mengulang pasangan angka. Respons gagal atau tidak valid dialihkan ke soal bawaan dengan pemberitahuan. Konfigurasi endpoint/model VPS nyata masih diperlukan sebelum integrasi langsung dapat diverifikasi.

## Tampilan dan progres

- Home mengikuti panel melengkung, gradien biru, font lokal, dan tombol kaca dari Figma node `2004:164`, dengan empat operasi yang sudah berfungsi.
- Dashboard menampilkan target harian 10 soal, akurasi, jumlah jawaban, sesi tuntas, dan rentetan hari aktif.
- Bagian bawah berisi grafik tujuh hari, akses Asisten Belajar, serta tiga sesi terakhir yang dapat dipilih untuk mengulang latihan.
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
- Jalur matematika dewasa mencakup nilai tempat, strategi hitung, pecahan, desimal, rasio, uang, ukuran, persen, aljabar, data, peluang, vektor, gradien, dan estimasi. Urutan dan penyajiannya memakai representasi visual, worked examples, strategi lentur, serta refleksi jawaban.
- Tes penalaran meminta `VPS-Combo-gue` membuat soal unik untuk setiap langkah. Hasilnya adalah indeks latihan 0–100, bukan skor IQ klinis atau diagnosis.
- Dashboard: bola progres kaca, orbit, pantulan, dan simbol mengambang berjalan berulang. Tombol jeda mengontrol animasi; reduced motion mematikannya.
- 24 tes otomatis; uji browser menyelesaikan materi Fungsi & bobot hingga status 1/5 tuntas.

## Input challenge yang menyesuaikan konteks

Challenge aritmetika dasar tetap memakai keypad kaca karena sesi tersebut berfokus pada hitung cepat. Latihan IQ dan Matematika AI memakai lembar soal yang lebih luas dengan kolom jawaban native, sehingga angka panjang dapat diketik melalui keyboard fisik atau keypad numerik ponsel. Input menerima sampai 12 digit, membersihkan karakter selain angka, mendukung Enter untuk memeriksa, dan menyediakan tombol hapus, petunjuk, menyerah, serta keluar. Warna dan judul lembar berubah menurut konteks IQ atau materi AI. Total pengujian otomatis saat ini 26.
