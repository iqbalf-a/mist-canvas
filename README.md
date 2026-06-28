# Mist Canvas

Aplikasi web interaktif yang mensimulasikan **kaca berembun** — embun muncul saat kamu menghembuskan nafas ke kamera, dan bisa digambari dengan jari telunjuk.

![Mist Canvas Demo](https://github.com/iqbalf-a/mist-canvas/raw/master/src/assets/hero.png)

## Fitur

- **Embun dari nafas** — buka mulut ke arah kamera, embun terbentuk di area wajah
- **Gambar dengan telunjuk** — gestur menunjuk mengaktifkan brush yang menghapus embun
- **Efek kaca nyata** — area embun menampilkan kamera yang di-blur (frosted glass), area tanpa embun jernih
- **Tetesan air** — goresan meninggalkan tetes air kecil yang jatuh ke bawah
- **Reset** — tekan `R` atau klik tombol Reset

## Tech Stack

- [Vite](https://vitejs.dev/) — build tool & dev server
- [@mediapipe/tasks-vision](https://www.npmjs.com/package/@mediapipe/tasks-vision) — FaceLandmarker & HandLandmarker
- Canvas 2D API — efek embun, blur, dan tetesan air

## Struktur Proyek

```
src/
├── main.js        # Loop utama: kamera → deteksi → efek → HUD
├── camera.js      # Setup getUserMedia
├── tracking.js    # MediaPipe FaceLandmarker + HandLandmarker
├── glass.js       # Semua efek canvas (fog, blur, stroke, droplet)
├── ui.js          # Loading overlay, breath indicator, reset button
└── style.css      # Fullscreen dark UI
```

## Cara Kerja

```
bgCanvas   → kamera jernih (selalu tampil)
fogCanvas  → (blurred kamera + tint putih) dikliping ke fog mask
_maskCanvas → menyimpan bentuk embun (offscreen)
```

- `breathe()` menambah embun ke mask dengan gradien radial
- `drawStroke()` menghapus embun dari mask (`destination-out`)
- `render()` mengompositkan hasilnya setiap frame

## Instalasi & Menjalankan

```bash
npm install
npm run dev
```

Buka `https://localhost:5173` di browser dan izinkan akses kamera.

> Dev server menggunakan HTTPS (self-signed cert via `@vitejs/plugin-basic-ssl`). Browser akan menampilkan peringatan — klik **Advanced → Proceed** untuk melanjutkan.

### Tes di HP (jaringan yang sama)

```bash
npm run dev
```

Akses URL **Network** yang muncul di terminal (contoh: `https://192.168.1.x:5173`) dari HP. Pastikan PC dan HP terhubung ke WiFi yang sama.

## Cara Pakai

| Aksi | Efek |
|------|------|
| Buka mulut ke kamera | Embun terbentuk di area wajah |
| Tunjuk dengan telunjuk | Brush aktif, menghapus embun |
| Tutup / kepal tangan | Brush nonaktif |
| Tekan `R` / klik Reset | Hapus semua embun |

## Gesture Brush

Brush aktif saat **telunjuk terentang dan lebih tinggi dari jari tengah & manis** (Y-axis comparison). Kepalan tangan dan telapak terbuka tidak memicu brush.

## Lisensi

MIT
