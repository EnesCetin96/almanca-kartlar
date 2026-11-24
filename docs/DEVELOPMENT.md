# Geliştirme

## Çalıştırma

```bash
python -m http.server 8080      # sonra http://localhost:8080
```

Service worker yalnızca HTTPS ya da `localhost`'ta çalışır.

## Testler

| Komut | Ne sınar | Gereken |
|---|---|---|
| `npm test` | Birim testleri: SRS, alıştırma üretimi, içe aktarma, asistan, güvenlik kuralları, önbellek listesi | Node 20+ (ek paket yok) |
| `npm run smoke` | iPad Pro 11 profilinde uçtan uca akış, çevrimdışı açılış, kalem çizgisi | Playwright |
| `npm run layout` | Her kartı 288–1180 px genişliklerde taşma için tarar | Playwright |
| `npm run palettes` | Her palet × açık/koyu için yazı/zemin kontrastı (≥ 4,5:1) ve ekran görüntüsü | Playwright |
| `npm run assistant` | Asistan akışı, **sahte** Anthropic API'siyle (gerçek anahtar gerekmez) | Playwright |
| `npm run security` | CSP, çerçeve koruması, kötü niyetli deste rengi | Playwright |

Playwright'ı bir kez kur: `npm i -D playwright && npx playwright install webkit chromium`. Testler varsayılan olarak WebKit kullanır;
yüklü bir Chrome için `BROWSER=chromium BROWSER_PATH="<chrome yolu>"` ver. Ekran görüntüleri `test-output/` klasörüne yazılır.

## Yeni sürüm yayınlama

1. Değişikliği yap, `npm test` ve ilgili tarayıcı testlerini çalıştır.
2. `npm run bump` ile service worker önbellek sürümünü artır (yapmazsan cihazlar eski dosyaları kullanmaya devam eder).
3. Yeni dosya eklediysen `sw.js` içindeki `ASSETS` listesine de ekle; `npm test` eksikleri yakalar.
4. `main` dalına gönder. GitHub Actions testleri çalıştırır ve geçerse `dist/` klasörünü GitHub Pages'e yayınlar (`.github/workflows/ci.yml`).
5. Cihazda uygulamayı aç; "Yeni sürüm var. Yenile" bildirimine dokun.

`npm run dist` yayın klasörünü (`dist/`) yerelde üretir; yalnızca uygulama dosyalarını içerir.

## Gerçek cihaz kontrol listesi (iPad)

- [ ] **Ana ekrana ekleme:** Safari → Paylaş → Ana Ekrana Ekle; simgeden açınca adres çubuğu yok, tam ekran.
- [ ] **Çevrimdışı açılış:** Bir kez internetle aç, uçak moduna al, uygulamayı kapatıp tekrar aç; kartlar görünüyor.
- [ ] **Kalem basıncı:** Karta ✍️ Not ile yaz; hafif basınca ince, sert basınca kalın çizgi çıkıyor.
- [ ] **Avuç içi reddi:** "Sadece Apple Pencil ile çiz" açıkken avucun/parmağın çizmiyor; Pencil çiziyor.
- [ ] **Silgi, geri al, renk:** Silgi dokunduğun çizgiyi siliyor; geri al/yinele ve renk/kalınlık çalışıyor; uygulamayı kapatıp açınca not duruyor.
- [ ] **Scribble:** Kartın altındaki yazılı not alanına Pencil ile yazınca metne dönüşüyor.
- [ ] **Seslendirme:** 🔊 DE ve 🔊 EN çalışıyor. Ses yoksa iPadOS Ayarlar → Erişilebilirlik → Konuşulan İçerik → Sesler'den Almanca ses indir.
- [ ] **Yedek:** Ayarlar → Yedeği dışa aktar → Dosyalar'a Kaydet; sonra Yedekten geri yükle ile aynı dosyayı geri yükle.
- [ ] **Yatay/dikey ve Split View:** Cihazı çevir; yan yana pencerede de kartlar taşmıyor.
- [ ] **Koyu tema ve paletler:** Ayarlar'dan paleti ve temayı değiştir; renkler okunuyor.
- [ ] **Asistan:** Ayarlar'a anahtarını ekle, bir notu "Kontrol et" ile dene.

## Kart içeriği

`data/starter-decks.json` derlenmiş içeriktir. Her içerik güncellemesi yeni bir sürüm numarası taşır: uygulama yeni kartları ekler, kullanıcının
düzenlemediği hazır kartları günceller, düzenlediklerine ve ilerlemeye dokunmaz. İçeriği üreten araçlar bu depoda yer almaz.
CSV içe aktarma sütunları: `deck,de_article,de_word,de_plural,pos,en_word,tr,de_sentence,en_sentence,tr_sentence,level,tags`
(şablonu Ayarlar'dan indirebilirsin).
