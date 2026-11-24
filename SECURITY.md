# Güvenlik politikası

## Güvenlik açığı bildirme

Bir açık bulduysan lütfen **herkese açık issue açma**. Bu depodaki
[**Security → Report a vulnerability**](https://github.com/EnesCetin96/almanca-kartlar/security/advisories/new) (GitHub özel güvenlik bildirimi) yolunu kullan.
Bildirimde şunları yaz: etkilenen ekran/dosya, adımlar ve beklenen/gerçek sonuç. Kişisel proje olduğu için kesin bir süre taahhüt edemem,
ama bildirimi okuyup yanıtlamaya çalışırım.

Desteklenen sürüm: `main` dalındaki son sürüm (canlı uygulama her zaman en yeni sürümdür).

## Tasarım gereği korumalar

| Alan | Önlem |
|---|---|
| Betik enjeksiyonu (XSS) | Kullanıcı ya da dosya verisi HTML olarak yorumlanmaz (`textContent`); `innerHTML`, `eval` kullanılmaz (CI taraması). Katı CSP: `script-src 'self'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`. |
| Dosya ile gelen saldırılar | CSV/JSON/yedek içe aktarma alan alan doğrulanır; deste rengi yalnızca hex değer olabilir (CSS enjeksiyonu engellenir); dosya boyutu en fazla 20 MB. |
| Clickjacking | Uygulama başka bir sitenin çerçevesi içinde çalışmayı reddeder. |
| Gizli bilgi | Depoda anahtar ya da parola yok. Asistan için kullanıcının kendi API anahtarı yalnızca cihazdaki `localStorage`'da ayrı bir girdide durur, yedeğe yazılmaz. GitHub gizli anahtar taraması ve push koruması açık. |
| Tedarik zinciri | Çalışma zamanı bağımlılığı yok. İş akışlarındaki GitHub Actions sürümleri commit kimliğiyle sabit; Dependabot güncellemeleri önerir. |
| Ağ | Uygulama yalnızca kendi kaynağına ve (asistan kullanılırsa) `api.anthropic.com` adresine bağlanır. HTTPS zorunlu. |

## Bilinen sınırlar

- **CSP bir `<meta>` etiketiyle uygulanır.** GitHub Pages yanıt başlığı gönderemediği için `frame-ancestors` gibi yalnızca başlıkla çalışan kurallar kullanılamaz; çerçeve koruması bunun yerine uygulama içinde yapılır.
- **`style-src 'unsafe-inline'`:** Arayüz bazı değerleri `style` özniteliğiyle verir. Betikler kısıtlı olduğundan bu, betik çalıştırmaya izin vermez; ama stil enjeksiyonuna karşı doğrulama (`safeColor`) şarttır.
- **API anahtarı `localStorage`'da durur.** Aynı alan adında (`*.github.io` altındaki aynı kullanıcı sayfası) başka bir sayfa yayınlanırsa o sayfa anahtarı okuyabilir. Anthropic konsolunda harcama limiti koy; sızdığından şüphelenirsen anahtarı oradan iptal et.
- **Cihaz erişimi:** Veriler şifrelenmeden cihazda durur; cihazına erişen biri notlarını ve anahtarı görebilir.
- Yapay zekâ asistanının cevapları yanlış olabilir; bunlar bir güvenlik değil doğruluk sınırıdır.
