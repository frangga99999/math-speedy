# ADR-001: Learning Intelligence lokal dan bertahap

**Status:** Accepted  
**Date:** 2026-09-22  
**Decider:** Owner SpeedyMath

## Context

SpeedyMath perlu mengenali pola kemampuan pengguna tanpa mengubah layar latihan yang sudah ada, menambah akun, database, atau ketergantungan AI untuk latihan dasar.

## Decision

Gunakan modul JavaScript kecil dan penyimpanan browser versi baru. Klasifikasi micro-skill penjumlahan bersifat deterministik. Mulai dengan tagging soal terlebih dahulu, lalu tambah attempt, insight, latihan fokus, mastery, dan review secara bertahap.

## Options considered

| Opsi | Kompleksitas | Privasi | Keandalan offline |
| --- | --- | --- | --- |
| Rule based + localStorage | Rendah | Tinggi | Tinggi |
| Klasifikasi AI | Sedang | Lebih rendah | Rendah |
| Database dan akun | Tinggi | Lebih rendah | Sedang |

## Consequences

- Penjumlahan dapat ditag secara konsisten tanpa VPS.
- UI dan sesi latihan saat ini tetap sama.
- Data lama `math-speedy.progress.v1` tetap digunakan tanpa perubahan.
- Tahap berikutnya perlu menangani data browser yang rusak secara defensif.

## Action plan

1. Selesai: taxonomy dan tagging micro-skill penjumlahan.
2. Selesai: attempt dan agregasi skill lokal.
3. Selesai: satu insight berbasis bukti pada hasil sesi.
4. Selesai: latihan fokus lima soal dengan Challenge yang sama.
5. Berikutnya: strategi hint bertingkat dan review terjadwal.
