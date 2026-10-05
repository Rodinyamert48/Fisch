# 🎣 Fisch Web — 3D Balıkçılık Oyunu

Roblox'taki **Fisch**'ten ilham alan, tarayıcıda çalışan düşük poligonlu 3D balıkçılık oyunu.
**TypeScript + Vite + Babylon.js** ile yazıldı. Tüm modeller, dokular, müzik ve sesler **prosedürel** üretilir —
harici varlık (asset) dosyası yoktur.

> At → Bekle & Sars → Çek → Yakala. Balık sat, olta yükselt, adaları keşfet, ansiklopediyi doldur.

## Hızlı başlangıç

```bash
npm install
npm run dev        # geliştirme sunucusu (http://localhost:5173)
npm run build      # tip kontrolü + üretim derlemesi (dist/)
npm run preview    # derlemeyi önizle
npm test           # oyun mantığı birim testleri (vitest)
```

WebGL2 destekli modern bir tarayıcı gerekir. İlerleme `localStorage`'a otomatik kaydedilir.

## Kontroller

| Masaüstü | Mobil | Eylem |
| --- | --- | --- |
| `W A S D` / oklar, `Shift` koş, `Space` zıpla | Sol joystick (sonuna kadar it: koş), ⤒ | Hareket |
| **Sol tık basılı tut → bırak** (veya `F`) | 🎣 butonu | Atış: güç çubuğu dolar, yeşil alanda bırak = **Mükemmel!** |
| **SARS!** butonlarına tıkla | Butonlara dokun | Balığın oltaya gelmesini hızlandır |
| Sol tık basılı = sağa, bırak = sola | 🎣 basılı / bırak | Çekme mini oyunu |
| Sağ tık sürükle, tekerlek | Ekranı sürükle, iki parmak | Kamera |
| `E` | E | Konuş / tekneye bin-in |
| `T` | ⛵ | Tekne çağır (teknede `W/S` gaz, `A/D` dümen) |
| `I` `K` `J` `O` `H` | Üst menü | Envanter · Ansiklopedi · Görevler · Ayarlar · Yardım |
| `M` / `Esc` | | Ses aç/kapat / paneli kapat, oltayı topla |

## Oyun sistemleri

### Dört aşamalı balık tutma
1. **Atış** — Güç çubuğu 0→1→0 gidip gelir. Bırakma anına göre mesafe ve derece: *Meh..* → *İyi* → *Mükemmel!*
   (küçük yeşil alan). Mükemmel atış o atış için +%20 yem hızı ve +%10 şans verir.
2. **Bekleme & Sarsma** — Yem suya düşünce balık zarı atılır. Rastgele beliren **SARS!** butonları bekleme süresini kısaltır.
   Nadir balıklar daha uzun bekler ama dokunuş sesleri, kabarcıklar ve şamandıra hareketi daha belirgindir.
3. **Çekme** — Mavi yol üzerinde hareket eden balık simgesini kontrol çubuğuyla kapsa. Kapsarsan ilerleme dolar,
   kaçarsa geriler. Balık hiç çubuktan çıkmazsa **Mükemmel Yakalama**: 1.5x XP + ekstra C$.
   Balık oltanın maks ağırlığını aşarsa ilerleme çok yavaş dolar.
4. **Sonuç** — Balığın 3D modeli döner; nadirlik, ağırlık, varyant ve değer gösterilir. Nadir+ balıklarda ışık sütunu,
   özel fanfar ve parçacık efektleri.

### Nadirlik ve varyantlar
10 nadirlik: Çöp, Yaygın, Alışılmadık, Sıradışı, Nadir, Efsanevi, Mitolojik, Egzotik, Gizli, İlahi Gizli.
Şans arttıkça nadir kademelerin ağırlığı artar, çöp azalır. **56 balık türü** × ağırlık × **9 varyant**:

| Varyant | Şans | Değer | Not |
| --- | --- | --- | --- |
| Parlak / Işıltılı / Albino | %3 / %2 / %1.2 | x1.85–x2 | Yaygın varyantlar |
| Altın / Hayalet | %0.5 / %0.2 | x3–x3.5 | Hayalet yalnızca gece |
| Göksel | %0.06 | x6 | Efsanevi varyant |
| Nükleer | %22 (olay sırasında) | x4 | Yalnızca **Nükleer Olay**'da |
| Batık | %15 | x3.5 | **Trident Oltası** pasifi |
| Prizmatik | %50 | x5 | **Ethereal Prism Oltası** pasifi |

### İlerleme
- **Oltalar:** Eğitim → Çelimsiz (500 C$) → Karbon → Sabit → Şampiyon / Trident → Fırtına → Cennet → Ethereal Prism (15.000.000 C$).
  Her biri Yem Hızı, Şans, Kontrol, Direnç, Maks Ağırlık ve bazılarında pasif yeteneğe sahip. Üst düzey oltalar farklı adalarda satılır;
  seviye ve **ansiklopedi tamamlanma oranı** şartı vardır.
- **Yemler:** Solucan, Karides, Balık Kafası, Kalamar, Işıltılı Yem (varyant x2), Efsane Solucanı.
- **Tekneler:** Kano, Sürat Teknesi, Balıkçı Teknesi (+%15 şans), Batiskaf (Derinlikler için gerekli).
- **Ansiklopedi:** Bölgelere göre; yakalama sayısı, rekor ağırlık, yakalanan varyantlar. Bölge tamamlanınca C$ + kalıcı şans ödülü.
- **Görevler:** Her adada 1–2 görev NPC'si (toplam 9 görev).

### Dünya
| Bölge | Ortam | Özellik |
| --- | --- | --- |
| **Moosewood** | Ilıman, çam ormanı, deniz feneri | Başlangıç adası, tüm temel dükkânlar |
| **Roslit Koyu** | Volkanik, palmiye ve mercanlar, lav krateri | Şampiyon & Trident oltaları |
| **Snowcap Adası** | Buzul, karlı dağ, buzdağları, kar yağışı | Fırtına & Cennet oltaları, kutup ışıkları balıkları |
| **Açık Deniz** | Adalar arası | Tekneden balık tutulur |
| **Derinlikler** | Karanlık çukur + Derin Deniz İstasyonu | Batiskaf gerekli, Ethereal Prism oltası |

**Çevre koşulları:** gündüz/gece döngüsü (1 gün = 12 dk), mevsimler (her biri 2 oyun günü), hava durumu
(açık / yağmurlu / sisli / kutup ışıkları) ve nadir **Nükleer Olay**. Balıkların bir kısmı belirli zaman, hava veya mevsime bağlıdır.

## Teknik yapı

```
src/
  core/            Saf oyun mantığı (Babylon'dan bağımsız, birim testli)
    data/          Balıklar, nadirlikler, varyantlar, oltalar, yemler, tekneler, adalar, görevler
    catchRoller    Bölge/koşul havuzu, şansa göre nadirlik, ağırlık ve varyant zarı
    castMeter      Atış güç çubuğu ve derecelendirme
    reelMinigame   Çekme mini oyunu simülasyonu
    environment    Zaman, mevsim, hava durumu, nükleer olay
    playerState    Ekonomi, envanter, ansiklopedi, görevler, kayıt/yükleme
    worldMap       Prosedürel arazi yükseklik fonksiyonu, iskeleler, bölge tespiti
  engine/          Babylon.js katmanı
    Game           Sahne, ışıklar, ana döngü, etkileşimler, çevre görselleri
    Sky            Özel shader: güneş, ay, yıldızlar, bulutlar, kutup ışıkları
    Water          WaterMaterial: yansıma + kırılma, prosedürel normal haritası
    WorldBuilder   Düşük poligonlu adalar, ağaçlar, binalar, iskeleler, istasyon
    FishModel      Şekle göre prosedürel balık modelleri + varyant efektleri
    FishingController  4 aşamalı akışın görsel/ses/arayüz entegrasyonu
    Player, Boat, Npcs, Character, CameraController, Effects, Input
  audio/           WebAudio ile prosedürel ses: vınlama, sıçrama, makara, fanfar, dalga, martı, üretken müzik
  ui/              DOM arayüzü: HUD, mini harita, mağazalar, ansiklopedi, görevler, mobil kontroller
tests/             Vitest birim testleri
```

**Performans:** Statik geometri ada başına tek köşe-renkli mesh'te birleştirilir (az çizim çağrısı), statik dünya matrisleri
dondurulur, uzak NPC'ler devre dışı kalır. Mobil/zayıf cihazlarda düşük kalite modu otomatik seçilir: daha düşük arazi çözünürlüğü,
256px su yansıması (iki karede bir güncellenir), daha az parçacık ve düşük çözünürlüklü render.

**Hata ayıklama:** Adrese `?debug` eklenirse `N` (gece/gündüz), `R` (hava), `U` (nükleer olay), `P` (mevsim atla),
`C` (+100.000 C$), `L` (seviye) tuşları etkinleşir.
