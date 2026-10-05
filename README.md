# 🎣 Olta Efsanesi — 3D Balıkçılık Oyunu

Tarayıcıda çalışan, gerçekçi-stilize 3D balıkçılık macerası. **TypeScript + Vite + Babylon.js** ile yazıldı.
Tüm modeller, dokular, müzik ve sesler **prosedürel** üretilir — harici varlık (asset) dosyası yoktur.

> At → Bekle & Salla → Çek → Yakala. Balık sat, olta yükselt, adaları keşfet, Balık Atlası'nı doldur.

**▶ Oyna: https://rodinyamert48.github.io/Fisch/**

## Hızlı başlangıç

```bash
npm install
npm run dev        # geliştirme sunucusu (http://localhost:5173)
npm run build      # tip kontrolü + üretim derlemesi (dist/)
npm run preview    # derlemeyi önizle
npm test           # oyun mantığı birim testleri (vitest)
```

WebGL2 destekli modern bir tarayıcı gerekir. İlerleme `localStorage`'a otomatik kaydedilir
(önceki sürümün kayıtları otomatik olarak yeni kimliklere taşınır).

### Yayınlama (GitHub Pages)
`.github/workflows/pages.yml` her push'ta testleri çalıştırır, oyunu derler ve `dist/` klasörünü `gh-pages` dalına yayınlar.
Vite `base: './'` kullandığı için alt dizinde (`/Fisch/`) sorunsuz çalışır.

## Kontroller

| Masaüstü | Mobil | Eylem |
| --- | --- | --- |
| `W A S D` / oklar, `Shift` koş, `Space` zıpla | Ekranın sol yarısına dokun-sürükle (yüzen joystick), ⤒ | Hareket |
| **Sol tık basılı tut → bırak** (veya `F`) | Büyük **AT** butonu | Atış: güç çubuğu dolar, yeşil alanda bırak = **Mükemmel!** |
| **SARS!** butonlarına tıkla | Butonlara dokun | Balığın oltaya gelmesini hızlandır |
| Sol tık basılı = sağa, bırak = sola | **Ekranın herhangi bir yerine** bas / bırak | Çekme mini oyunu |
| Sağ tık sürükle, tekerlek | Sağ yarıyı sürükle, iki parmak | Kamera |
| `E` | Beliren 💬 / ⛵ butonu | Konuş / tekneye bin-in |
| `T` | ⛵ | Tekne çağır (teknede `W/S` gaz, `A/D` dümen) |
| `I` `K` `J` `O` `H` | Üst menü | Envanter · Balık Atlası · Görevler · Ayarlar · Yardım |
| `U` | ⛶ | **Tam ekran** |
| `M` / `Esc` | | Ses aç/kapat / paneli kapat, oltayı topla |

## Mobil ve tam ekran
- **Tam ekran:** başlangıç ekranındaki "⛶ Tam Ekranda Oyna", menüdeki ⛶ butonu, Ayarlar veya `U` tuşu.
  Dokunmatik cihazlarda tam ekrana geçerken yatay yön kilitlenir (destekleyen tarayıcılarda).
- **iPhone/iPad:** Safari tam ekran API'sini desteklemediği için Paylaş → **Ana Ekrana Ekle** ile yükleyin;
  oyun ana ekrandan tam ekran açılır (PWA manifesti + `apple-mobile-web-app-capable`).
- **Rahat kontroller:** yüzen joystick, duruma göre değişen büyük eylem butonu (AT / BIRAK / BEKLE / ÇEK / DEVAM),
  yalnızca gerektiğinde beliren etkileşim butonu, çekerken ekranın her yerine basabilme, **nişan yardımı**
  (atış karaya düşecekse en yakın suya yönlendirilir), titreşimli geri bildirim, çentikli ekranlar için güvenli alan
  boşlukları ve dikey ekran düzeni.
- **Performans:** mobilde düşük kalite otomatik seçilir; kare hızı düşerse çözünürlük otomatik azaltılır.

## Görsel kalite
- **Yüksek kalite (masaüstü):** HDR işleme hattı — ACES ton eşleme, bloom, 4x MSAA, keskinleştirme, vinyet —
  ve oyuncuyu takip eden **kademeli gölgeler** (cascaded shadow maps).
- **Yumuşak gölgelendirilmiş arazi:** yükseklik/eğim tabanlı renkler, ortam kapatma (çukurlar koyu), prosedürel
  detay ve normal dokuları, ıslak kum bandı ve kıyı boyunca hareketli **köpük**.
- **Dokulu yapılar:** ahşap kaplama duvarlar, kiremit beşik çatılar, taş temeller, panjurlu ışıklı pencereler,
  çiçeklikler, çizgili tenteler; ahşap iskeleler ve tekneler.
- **Bitki örtüsü:** katmanlı çamlar (karlı uçlar), organik yaprak kümeli ağaçlar, sarkık yapraklı palmiyeler,
  çimen ve çiçekler, faset kayalar.
- **Karakterler:** orantılı, eklemli (dirsek/diz) insan modelleri; saç, yüz, şapka çeşitleri (kova şapka, kasket,
  bere, kaptan, hasır) ve sakal.
- Yansıma + kırılmalı su, özel gökyüzü shader'ı (güneş, ay, yıldızlar, bulutlar, kutup ışıkları), gündüz-gece döngüsü.

## Oyun sistemleri

### Dört aşamalı balık tutma
1. **Atış** — Güç çubuğu gidip gelir; bırakma anına göre mesafe ve derece: *Meh..* → *İyi* → *Mükemmel!*
2. **Bekleme & Sallama** — Rastgele beliren **SARS!** butonları bekleme süresini kısaltır. Nadir balıklar daha uzun
   bekler ama dokunuş sesleri ve kabarcıklar daha belirgindir.
3. **Çekme** — Kontrol çubuğuyla balık simgesini kapsa; balık hiç çubuktan çıkmazsa **Kusursuz Yakalama**: 1.5x XP + ekstra akçe.
4. **Sonuç** — Balığın 3D modeli döner; nadirlik, ağırlık, varyant ve değer gösterilir. Nadir balıklarda ışık sütunu ve fanfar.

### Nadirlik ve varyantlar
10 nadirlik: **Çöp, Sıradan, Seçkin, Özel, Nadir, Efsanevi, Mitolojik, Destansı, Sır, Kozmik**.
**56 balık türü** × ağırlık × **9 varyant**:

| Varyant | Şans | Değer | Not |
| --- | --- | --- | --- |
| Sedef / Yıldızlı / Karbeyaz | %3 / %2 / %1.2 | x1.85–x2 | Yaygın varyantlar |
| Yaldızlı / Ruhani | %0.5 / %0.2 | x3–x3.5 | Ruhani yalnızca gece |
| Takımyıldız | %0.06 | x6 | Efsanevi varyant |
| Fosforlu | %22 (olay sırasında) | x4 | Yalnızca **Yeşil Şafak** olayında |
| Kabuklu | %15 | x3.5 | **Enkaz Oltası** pasifi |
| Tayf | %50 | x5 | **Tayf Oltası** pasifi |

### İlerleme
- **Oltalar:** Acemi → Kamış (500 akçe) → Bambu → Çapa → Martı / Enkaz → Poyraz → Yıldız Tozu → Tayf (15.000.000 akçe).
  Her biri Yem Hızı, Şans, Kontrol, Direnç, Maks Ağırlık ve bazılarında pasif yeteneğe sahip; üst düzey oltalar farklı
  adalarda satılır ve seviye + **Balık Atlası** tamamlanma şartı vardır.
- **Yemler:** Solucan, Karides, Balık Kafası, Kalamar, Işıltılı Yem (varyant x2), Efsane Solucanı.
- **Tekneler:** Kayık, Sürat Teknesi, Gırgır Teknesi (+%15 şans), Batiskaf (Abis Çukuru için gerekli).
- **Balık Atlası:** bölgelere göre yakalama sayısı, rekor ağırlık ve varyantlar; bölge tamamlanınca akçe + kalıcı şans.
- **Görevler:** her adada 1–2 görev NPC'si (toplam 9 görev).

### Dünya
| Bölge | Ortam | Özellik |
| --- | --- | --- |
| **Çamlıkoy** | Ilıman, çam ormanı, deniz feneri | Başlangıç adası, tüm temel dükkânlar |
| **Kızılkaya Adası** | Volkanik, palmiye ve mercanlar, lav krateri | Martı & Enkaz oltaları |
| **Ayazburun** | Buzul, karlı dağ, buzdağları, kar yağışı | Poyraz & Yıldız Tozu oltaları, kutup ışıkları balıkları |
| **Açık Deniz** | Adalar arası | Tekneden balık tutulur |
| **Abis Çukuru** | Karanlık çukur + Derinlik Üssü | Batiskaf gerekli, Tayf Oltası |

**Çevre:** gündüz/gece (1 gün = 12 dk), mevsimler, hava durumu (açık / yağmurlu / sisli / kutup ışıkları) ve nadir **Yeşil Şafak** olayı.

## Teknik yapı

```
src/
  core/            Saf oyun mantığı (Babylon'dan bağımsız, birim testli)
    data/          Balıklar, nadirlikler, varyantlar, oltalar, yemler, tekneler, adalar, görevler
    catchRoller    Bölge/koşul havuzu, şansa göre nadirlik, ağırlık ve varyant zarı
    castMeter      Atış güç çubuğu ve derecelendirme
    reelMinigame   Çekme mini oyunu simülasyonu
    environment    Zaman, mevsim, hava durumu, Yeşil Şafak
    playerState    Ekonomi, envanter, Balık Atlası, görevler, kayıt/yükleme ve eski kayıt taşıma
    worldMap       Prosedürel arazi yükseklik fonksiyonu, iskeleler, bölge tespiti
  engine/          Babylon.js katmanı
    Game           Sahne, ışıklar, ana döngü, etkileşimler, çevre görselleri
    Graphics       HDR işleme hattı, kademeli gölgeler, otomatik çözünürlük
    geometry       Yumuşak/düz gölgelendirme, UV'li prosedürel model birleştirici
    materials      Prosedürel dokular: detay gürültüsü, ahşap, kiremit, kaplama, taş, köpük (+ normal haritaları)
    WorldBuilder   Adalar, ağaçlar, çimen, binalar, iskeleler, istasyon, kıyı köpüğü
    Character      Eklemli insan modelleri ve animasyon
    Sky, Water, FishModel, FishingController, Player, Boat, Npcs, CameraController, Effects, Input
  audio/           WebAudio ile prosedürel ses ve üretken müzik
  ui/              DOM arayüzü, mobil kontroller, tam ekran yardımcıları
public/            PWA manifesti ve simgeler
tests/             Vitest birim testleri
```

**Hata ayıklama:** adrese `?debug` eklenirse `N` (gece/gündüz), `R` (hava), `Y` (Yeşil Şafak), `P` (mevsim atla),
`C` (+100.000 akçe), `L` (seviye) tuşları etkinleşir.
