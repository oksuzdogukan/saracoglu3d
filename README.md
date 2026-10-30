# Saracoğlu Koltuktan Görünüm

Şükrü Saracoğlu Stadyumu'nda bir tribün, blok, sıra ve koltuk seçip sahayı o koltuktan nasıl göreceğini tarayıcıda 3B olarak gösteren uygulama.

> Resmi olmayan bir taraftar projesidir. Görünümler yaklaşıktır. Kulüp logosu ya da resmi marka öğesi kullanılmaz.

Stadyum hazır bir 3B modelden gelmez. Tek bir veri dosyasından, [`src/data/stadium.json`](src/data/stadium.json)'dan parametrik olarak üretilir. Tribün yüzeyleri, basamaklar, koridorlar ve koltuklar aynı veriden çıkar. Bir ölçüyü değiştirdiğinizde hepsi birlikte güncellenir ve koltuklar basamaklara her zaman tam oturur.

## Hızlı başlangıç

```bash
npm install
npm run dev        # http://localhost:3000
```

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Geliştirme sunucusu. `stadium.json`'u kaydedince sahne kendiliğinden yenilenir. |
| `npm run veri` | Veri dosyasını doğrular; tahmini değerleri ve koltuk sayılarını listeler. Hata varsa 1 koduyla çıkar. |
| `npm test` | Geometri, numaralandırma ve doğrulama testleri (vitest). |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript denetimi. |
| `npm run build` / `npm start` | Üretim derlemesi / sunucusu. |

## Nasıl çalışır

```
stadium.json ──zod──▶ şema (schema.ts) ──▶ hesaplanan model (layout.ts) ──▶ three.js geometrisi ──▶ sahne
                                           halka, blok, sıra, koltuk          basamak, koridor,      R3F
                                           (saf TypeScript, sunucuda da       koltuklar (Instanced)
                                            çalışır)
```

| Yol | İçerik |
|---|---|
| `src/data/stadium.json` | Tek doğruluk kaynağı |
| `src/lib/stadium/schema.ts` | Veri şeması (zod) ve tahmini değer sarmalayıcısı |
| `src/lib/stadium/ring.ts` | Kat halkası geometrisi (aşağıda anlatılıyor) |
| `src/lib/stadium/numbering.ts` | Sıra/koltuk numaralandırma dili |
| `src/lib/stadium/layout.ts` | Blok, sıra ve koltuk konumları; anlamsal kontroller |
| `src/lib/stadium/views.ts` | Kamera pozları (genel görünüm, blok, koltuk gözü) |
| `src/lib/stadium/roof.ts` | Çatı yüzeyi: iç kenardan dış kenara ışınlar, çatı kotu |
| `src/lib/stadium/structures.ts` | Yapıların (kulübe, tünel, ekran, kolon) yerleşimi |
| `src/lib/stadium/plan.ts` | 2D blok haritası (SVG verisi) |
| `src/lib/stadium/search.ts` | Koltuk arama: serbest metin ayrıştırıcı |
| `src/lib/stadium/seatPatterns.ts` | Koltuklarla yazılan yazılar (FENERBAHÇE) ve blok yazı tipi |
| `src/lib/stadium/share.ts` | Paylaşım linki ↔ koltuk dönüşümü, koltuk özeti |
| `src/app/koltuk/[tribun]/[blok]/[sira]/[koltuk]/` | Paylaşım linki sayfası ve önizleme görseli |
| `src/lib/three/*` | Tribün, koltuk ve saha geometrisi; vurgu shader'ı |
| `src/components/scene/*` | 3B sahne (React Three Fiber) |
| `src/components/ui/*` | Arayüz panelleri |
| `src/store/useViewer.ts` | Seçim ve kamera durumu (zustand) |
| `scripts/report.ts` | `npm run veri` raporu |

## Koordinat sistemi

- Birimler metre ve derece.
- Orijin saha merkezi, çim seviyesi. **+y** yukarı, **+x** Spor Toto'ya, **+z** Fenerium'a doğru. Maraton **−z** tarafında, Kuzey **−x** tarafında.
- Yukarıdan bakınca yerleşim Passo blok haritasıyla aynıdır: Maraton üstte, Spor Toto sağda, Fenerium altta, Kuzey solda.

### Kat halkası

Her kat (`alt`, `ust`), ön sırasının planda izlediği kapalı bir eğriyle tanımlanır (`tiers[].ring`):

```
            ◀──────── 2 × halfX ────────▶
         ╭──────────────────────────────╮      chamfer: köşedeki pah (m)
       ╱                                  ╲    fillet:  pahın iki ucundaki
      │              saha                  │            yuvarlatma yarıçapı (m)
      │                                    │   ▲
      │                                    │   2 × halfZ
       ╲                                  ╱    ▼
         ╰──────────────────────────────╯
```

- `halfX` = 52,5 + ön sıranın kale çizgisinden uzaklığı, `halfZ` = 34 + ön sıranın yan çizgiden uzaklığı.
- Her sıra, bu eğrinin dışarı doğru ötelenmiş halidir. Düz kısımlarda sıralar düz kalır, köşelerde yelpaze gibi açılır.
- Koridorlar eğriye diktir. Köşe blokları bu sayede kendiliğinden kama şeklini alır.

### Blok sınırları (`from` / `to`)

Bir bloğun `from` ve `to` değerleri, **o katın ön eğrisi boyunca, tribünün orta noktasından ölçülen metredir**. Yön, yukarıdan bakınca saat yönüdür; blok harfleri de her tribünde bu yönde artar:

| Tribün | `+` yön | Örnek |
|---|---|---|
| Maraton | Spor Toto tarafı | Maraton Alt E: `-5.8 … 5.8` (ortada) |
| Spor Toto | Fenerium tarafı | |
| Fenerium | Kuzey tarafı | |
| Kuzey | Maraton tarafı | |

Değer köşeye doğru da devam eder: Maraton Alt I `45.4 … 58.2` köşenin yarısına kadar gider. İki blok arasındaki boşluk koridordur. Boşluk `defaults.maxAisleWidth`'ten küçükse yarım basamaklı koridor merdiveni çizilir, büyükse blok ucu kapatılır.

## stadium.json rehberi

### Tahmini değerler

Her sayı iki biçimde yazılabilir:

```jsonc
"tread": 0.8                                                       // doğrulanmış değer
"tread": { "value": 0.8, "estimate": true, "note": "Tipik basamak derinliği." }   // tahmini
```

Gerçek değeri bulunca sarmalayıcıyı düz sayıyla değiştirin. İsterseniz kaynağı da yazabilirsiniz: `{ "value": 0.78, "source": "Yerinde ölçüm, 2026-11" }`. `estimate` yoksa değer doğrulanmış sayılır.

Bloklarda `"estimate": true`, sınırların (`from`/`to`) ve koltuk düzeninin tahmini olduğunu belirtir. `npm run veri` bütün tahmini değerleri JSON yollarıyla listeler.

### Alan sözlüğü

| Alan | Anlamı |
|---|---|
| `meta.capacity` | Hedef kapasite (47.911). Rapor toplamı bununla karşılaştırır. |
| `meta.northAngle` | Gerçek kuzeyin sapması (ileride güneş/gölge için). |
| `colors.*` | Çim şeritleri, çizgi, zemin, beton, rıht ve gökyüzü renkleri. |
| `defaults.seatWidth` | Koltuk aralığı, merkezden merkeze (m). |
| `defaults.seatOffset` | Basamak ön kenarından koltuk oturağı merkezine (m). |
| `defaults.seatsFrom` | Varsayılan numara yönü: `left` / `right` (aşağıya bakın). |
| `defaults.align` | Sıra blok genişliğini doldurmuyorsa hizalama: `start` / `center` / `end`. |
| `defaults.maxAisleWidth` | Bundan dar blok arası boşluk koridor merdiveni olarak çizilir (m). |
| `defaults.eyeHeight` | Koltuk görünümünde göz yüksekliği, basamak zemininden (m). |
| `defaults.standingEyeHeight` | "Ayakta" seçeneği (m). |
| `pitch.length`, `pitch.width` | Saha ölçüsü (105 × 68). |
| `pitch.markings.*` | FIFA çizgi ölçüleri. |
| `pitch.goal.*` | Kale genişliği/yüksekliği, direk çapı, file derinliği (altta/üstte). |
| `pitch.adBoards.*` | Reklam panosu yüksekliği ve çizgilere uzaklığı. |
| `tiers[].ring` | Kat halkası: `halfX`, `halfZ`, `chamfer`, `fillet`. |
| `tiers[].profile.frontOffset` | Ön sıranın halkadan ek ötelemesi (m, genelde 0). |
| `tiers[].profile.frontHeight` | İlk sıra basamak zemininin çime göre yüksekliği (m). |
| `tiers[].profile.rows` | Fiziksel sıra sayısı. |
| `tiers[].profile.tread` | Basamak derinliği (m). |
| `tiers[].profile.riser.first` / `.last` | İlk ve son rıht yüksekliği (m). Arada doğrusal artar; parabolik eğimi yaklaşık verir. |
| `tiers[].structure.fasciaDepth` | Ön sıranın altına inen alın yüksekliği (alt katta çime kadar). |
| `tiers[].structure.railHeight` | Ön korkuluk yüksekliği. |
| `tiers[].structure.backWallTop` | Son sıranın arkasındaki duvarın üst kotu (mutlak, m). Alt katta loca cephesi. |
| `tiers[].structure.underside` | `true` ise katın altı kapatılır (üst katın alt yüzeyi). |
| `tiers[].structure.backWallBands` | Arka duvarın üstten aşağı renk bantları (loca camları, reklam bandı): `[{ "height", "color" }]`. |
| `stands[].side` | Tribünün plandaki tarafı: `top` (Maraton), `right`, `bottom`, `left`. |
| `stands[].tiers.<kat>.seatColor` / `aisleColor` | Koltuk ve koridor rengi. |
| `blocks[]` | Bloklar (aşağıda). |
| `roof` | Çatı (aşağıda). İsteğe bağlı. |
| `structures[]` | Görüşü etkileyen yapılar: kutu (`box`) ve kolon (`column`). Aşağıda. |

### Blok alanları

```jsonc
{
  "stand": "maraton",         // stands[].id
  "tier": "alt",              // tiers[].id
  "id": "C",                  // blok harfi
  "from": -31.4, "to": -19.8, // ön eğri boyunca, tribün ortasından metre (yukarıya bakın)
  "estimate": true,           // sınırlar/düzen tahmini
  "seatsFrom": "left",        // isteğe bağlı; 1 numaralı koltuk sahaya bakarken solda
  "align": "center",          // isteğe bağlı
  "seatWidth": 0.55,          // isteğe bağlı (VIP vb.)
  "seatColor": "#1f2d63",     // isteğe bağlı
  "category": "misafir",      // isteğe bağlı: misafir, misafir-kismen, vip, basin ya da serbest metin
  "profile": { "tread": 1.0 },// isteğe bağlı: katın profilinden farklı alanlar
  "rows": [ { "rows": "1-24", "seats": "auto" } ]
}
```

Link ve kimlik biçimi: `tribün-kat/blok/sıra/koltuk`, örneğin `maraton-ust/A/12/7`.

`category` haritada ve panellerde gösterilir. `misafir` koyu, `misafir-kismen` gri boyanır; diğerleri yalnızca etiket olarak görünür.

### Koltuk yazıları (`seatPatterns`)

Üst kattaki sarı FENERBAHÇE yazısı gibi, koltuk renkleriyle yazılan metinler:

```json
{ "id": "maraton-yazi", "stand": "maraton", "tier": "ust", "text": "FENERBAHÇE", "color": "#efc416",
  "from": -42, "to": 42, "rows": "7-26" }
```

- Yazı, tribün boyunca `from`→`to` (tribün ortasından metre) ve `rows` fiziksel sıraları arasına yayılır. Karşı tribünden bakınca soldan sağa okunur.
- Fenerium'daki ortadaki basın kutusu için metin `"FENER  BAHÇE"` (iki boşluk) yazılır.
- Yazı tipi `seatPatterns.ts` içinde, 5×7 piksel. Yeni bir harf gerekirse `GLYPHS` tablosuna eklenir.

### Çatı (`roof`)

Çatı, iki halkanın arasında örülen bir yüzeydir. Halkalar katlardakiyle aynı biçimdedir (`halfX`, `halfZ`, `chamfer`, `fillet`):

| Alan | Anlamı |
|---|---|
| `inner` / `outer` | Çatının sahaya bakan ön kenarı ve dış kenarı. Dış kenar uydu görüntüsündeki gibi büyük pahlı (sekizgen) olabilir. |
| `innerHeight` / `outerHeight` | Ön ve dış kenarın kotu (m). Arada doğrusal değişir. |
| `edgeDepth` / `outerEdgeDepth` | Kenar alınlarının yüksekliği. |
| `ribs` | Membranın altındaki ışınsal kirişler: `spacing` (ön kenar boyunca aralık), `depth`, `width`, `color`. |
| `catwalk` | Ön kenarın altındaki ışık köprüsü: `offset` (kenardan içeri), `drop` (kenarın altına iniş), `size`. |
| `trusses[]` | Çatının üstündeki Warren kafes kirişler. `side` hangi kenara paralel olduğu; `distance` saha merkezinden eksene uzaklık; `from`/`to` kenar boyunca, tribün ortasından saat yönünde; `height` ve `panel` kiriş yüksekliği ve çapraz aralığı. |

Çatı genel görünümde yarı saydam çizilir (bloklar yukarıdan görünsün diye); koltuk görünümünde tam görünür. `npm test`, çatının her bloğun arka duvarından en az 1 m yukarıda kaldığını denetler.

### Yapılar (`structures`)

Yedek kulübeleri, oyuncu tüneli, köşe ekranları ve kolonlar gibi görüşü etkileyen nesneler. Konum iki biçimde verilebilir:

```jsonc
// Bir kat halkasına bağlı: tribün ortasından u metre, ön eğriden d metre dışarı (negatif = sahaya doğru), y taban kotu.
// Eğriye göre kendiliğinden döner; tribün ölçüleri değişince onunla birlikte taşınır.
{ "id": "oyuncu-tuneli", "type": "box", "at": { "tier": "alt", "stand": "fenerium", "u": 0, "d": -1.9, "y": 0 },
  "size": [3.0, 2.6, 3.8], "color": "#2457b5" }

// Mutlak: taban merkezi [x, y, z], rotationY derece
{ "id": "kolon-1", "type": "column", "position": [70, 0, -60], "radius": 0.4, "height": 30, "color": "#9aa0a8" }
```

Kutularda `size` = [genişlik (eğri boyunca), yükseklik, derinlik (sahaya doğru)]; `frontColor` sahaya bakan yüzü boyar (ekranlar için).

### Numaralandırma dili

`rows` dizisi önden arkaya fiziksel sıraları tanımlar. Her kural ya bir sıra grubudur ya da koltuksuz bir boşluktur:

| Yazım | Anlamı |
|---|---|
| `{ "rows": "1-12", "seats": "1-22" }` | 1–12. sıraların her birinde 1–22 numaralı koltuklar |
| `{ "rows": "13", "seats": "1-10,_,_,11-22" }` | `_` koltuksuz fiziksel yer (kolon, kamera, merdiven); `_3` üç boş yer |
| `"seats": "24-1"` | Ters sıra: ilk fiziksel yer 24 numara |
| `"seats": "1-49/2"` | Adımlı: 1, 3, 5, … 49 |
| `"seats": "auto"` | Sığdığı kadar koltuk, 1'den başlayarak (temsili veri için) |
| `"rows": "A-F"`, `"rows": "1-10,12-20"` | Harfli sıralar, atlanan sıra numaraları |
| `"shift": -1` | Sırayı koltuk genişliği cinsinden kaydırır |
| `"align": "end"` | Sıraya özel hizalama |
| `{ "gap": 1 }` | Bir fiziksel sıra koltuksuz (ara geçit, vomitoryum) |

Koltuklar, numaralandırmanın başladığı uçtan dizilir. `seatsFrom: "left"`, sahaya bakarken 1 numaranın solda olduğu anlamına gelir. Sıra blok genişliğine sığmazsa koltuk aralığı sıkıştırılır ve `npm run veri` uyarı verir.

## Sık yapılan işler

### Bir ölçüyü düzeltmek

1. `npm run veri` ile tahmini değerler listesinden ilgili yolu bulun, örneğin `tiers[alt].profile.tread`.
2. `stadium.json`'da sarmalayıcıyı gerçek değerle değiştirin: `"tread": 0.78`.
3. `npm run veri` hata vermemeli. Dikkat: sıra sayısı ya da basamak değişirse `"auto"` bloklardaki koltuk sayıları da değişir.
4. `npm run dev` açıksa sahne kendiliğinden yenilenir. Koltuk görünümünden kontrol edin.

### Yeni blok eklemek

Örnek: Kuzey Üst F bloğunun misafir bölümüne ayrılan kısmını ayrı bir blok (`F2`) yapmak.

1. Tribünün ve katın tanımlı olduğundan emin olun (`stands[]` içinde `kuzey` ve `tiers.ust` var).
2. Yer açın: F'nin `to` değerini `23.1`'den `17.8`'e indirin. Kuzey'de `+` yön Maraton tarafıdır, misafir kısmı da o uçtadır.
3. `blocks` dizisine yeni bloğu ekleyin. Komşusuyla arasında koridor kadar (≈1,2 m) boşluk bırakın:
   ```json
   { "stand": "kuzey", "tier": "ust", "id": "F2", "from": 19.0, "to": 23.1, "estimate": true, "category": "misafir",
     "rows": [{ "rows": "1-29", "seats": "auto" }] }
   ```
4. `npm run veri`: çakışma varsa hangi blokla ve kaç metre çakıştığını söyler.
5. Sahnede ya da haritada bloğu seçip sıraları ve koltukları kontrol edin. Harita, arama ve 3B sahne yeni bloğu kendiliğinden tanır.

### Gerçek koltuk numaralarını girmek

`"auto"` yerine sıra sıra yazın. Aynı düzendeki sıraları gruplayabilirsiniz:

```json
"rows": [
  { "rows": "1-10", "seats": "1-22" },
  { "rows": "11", "seats": "1-9,_,_,10-20" },
  { "gap": 1 },
  { "rows": "12-24", "seats": "1-26", "align": "end" }
]
```

### Koltuk arama

Üst çubuktaki **Koltuk ara** hem serbest metni hem adım adım seçimi kabul eder. Serbest metin örnekleri:

| Yazılan | Sonuç |
|---|---|
| `Maraton Üst A 12 7` | Maraton Üst · A · Sıra 12 · Koltuk 7 |
| `kuzey alt k blok 12. sıra 7 numara` | Sıra ve koltuk sözcüklerin önünde ya da arkasında olabilir |
| `sportoto üst b 1 1`, `spor-toto ust b 1 1` | Türkçe karakter ve yazım farkları önemsizdir |
| `maraton-ust/A/12/7` | Link biçimi |
| `maraton a 12 7` | Kat yazılmazsa iki aday blok listelenir |

### Paylaşım linkleri

Her koltuğun kalıcı bir adresi var: `/koltuk/maraton-ust/E/1/16`.

- Koltuk görünümüne geçince adres çubuğu kendiliğinden bu adrese döner, genel görünüme dönünce `/` olur.
- Panelde "Bu koltuğun linkini paylaş" var: mobilde sistem paylaşımı, masaüstünde panoya kopyalama.
- Link açılınca sahne o koltuğa uçar. Olmayan bir koltuk 404 verir; küçük harf blok yazılırsa adres kanonik biçime çevrilir.
- Link önizlemesi (WhatsApp, X vb.) için `opengraph-image.tsx` stadyum planında koltuğun yerini ve bilgisini gösteren 1200×630 bir görsel üretir.

## Yayınlama (Vercel)

1. Projeyi bir Git deposuna koyup Vercel'de içe aktarın ya da `npx vercel` ile yükleyin. Ek ayar gerekmez.
2. Önizleme görsellerinin tam adresi üretimde `VERCEL_PROJECT_PRODUCTION_URL`'den alınır. Kendi alan adınızı kullanacaksanız `NEXT_PUBLIC_SITE_URL=https://alanadiniz` ortam değişkenini tanımlayın.
3. Yayın öncesi kontrol: `npm run veri && npm test && npm run build`.

### Sık karşılaşılan hatalar

| Mesaj | Çözüm |
|---|---|
| `Unrecognized key: "treed"` | Alan adı yanlış yazılmış; sözlükteki adı kullanın. |
| `… bloğuyla 0.80 m çakışıyor` | `from`/`to` değerlerini komşu blokla aralarında boşluk kalacak şekilde düzeltin. |
| `… m'ye sığmıyor; koltuk aralığı … sıkıştırıldı` | O sırada tanımlanan yer sayısı blok genişliğinden fazla; sınırları ya da numaraları kontrol edin. |
| `Numaralandırma N fiziksel sıra tanımlıyor, profilde M sıra var` | `rows` kuralları profildeki sıra sayısını aşıyor; `profile.rows`'u blokta ezin ya da kuralları düzeltin. |
| `fillet (…) bu chamfer (…) için çok büyük` | Köşe yuvarlatmasını küçültün ya da pahı büyütün. |
| `Yapı için ya "position" ya da "at" verin` | Bir yapıya iki konum birden verilmiş ya da hiç verilmemiş. |

## Yol haritası

- **Aşama 1:** iskelet, veri şeması, Maraton tribünü, saha, kaleler ve fileler, koltuktan görünüm.
- **Aşama 2:** dört tribün (68 blok, 47.759 koltuk); misafir, VIP ve basın bölümleri; çatı, kafes kirişler, ışık köprüsü; yedek kulübeleri, tünel, köşe ekranları; 2D blok haritası; koltuk arama.
- **Aşama 3 (bu sürüm):** tüm koltuklar lacivert, üst katlarda sarı FENERBAHÇE yazısı, katlanmış (boş) koltuklar; paylaşım linkleri ve önizleme görselleri; mobilde küçülen panel, düşük çözünürlük çarpanı, "hareketi azalt" desteği; Vercel'e hazır.
