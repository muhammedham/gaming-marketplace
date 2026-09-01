# Sprint 4 - Orders ve iletişim API sözleşmesi

Base: `/api/v1`. Başarı `{ "data": ... }`, hata `{ "error": { "code", "message", "details"? } }`.
Kimlik: mevcut HttpOnly `gm_session` cookie. Para iki ondalıklı **string**, tarihler UTC ISO-8601.
Public seller profili dışında oturum zorunludur. Roller veritabanından yeniden kontrol edilir.
Liste endpoint'leri `page=1&limit=20` kullanır; limit 1-50, cevap `items` ve
`pagination: { page, limit, total, totalPages }` içerir. Mesaj sayfaları en yeni
sayfadan başlayıp kendi içinde kronolojik gösterilir.

## Orders

| Endpoint | Yetki | Body / davranış |
| --- | --- | --- |
| `POST /orders` | Buyer | `{listingId, expectedPrice, idempotencyKey}`, 201 |
| `GET /orders` | Buyer/Seller; Admin tümü | Kendi alım/satımları |
| `GET /orders/:id` | Taraflar/Admin | Snapshot, status, timeline, teslim, serverTime, chat, review ve erişilebilen ticket'lar |
| `POST /orders/:id/deliver` | Order Seller | `{deliveryNote}`, 1-2000 karakter |
| `POST /orders/:id/confirm` | Order Buyer | Body yok; aynı Completed order için idempotent |
| `POST /orders/:id/cancel` | Taraflar/Admin | Body yok; sadece WaitingDelivery; tekrar Cancelled no-op |
| `POST /orders/:id/review` | Order Buyer | `{rating: 1..5, comment?: string}`, 201; yalnız Completed |

Satın alma örneği:

```json
{
  "listingId": "<UUID>",
  "expectedPrice": "40.00",
  "idempotencyKey": "purchase-unique-key-001"
}
```

`expectedPrice` güncel ilan fiyatıyla Decimal olarak karşılaştırılır. Fiyat
değişmişse `409 PRICE_CHANGED`; pasif/yok ilan `409 LISTING_UNAVAILABLE`;
yetersiz Available `409 INSUFFICIENT_FUNDS`. Hiçbirinde yarım order/ledger oluşmaz.
Key 8-100 karakter (`A-Z a-z 0-9 . _ -`), Buyer başına benzersizdir. Aynı key ve
aynı ilan/fiyat aynı order'ı döndürür; farklı payload `409 IDEMPOTENCY_KEY_REUSED`.
Yalnız Buyer satın alabilir; kendi ilanını satın alma yasaktır.

### Durum ve para kuralları

```text
Created -> Paid -> WaitingDelivery -> Delivered -> WaitingConfirmation -> Completed
                        |                              |
                        +------> SupportPaused <-------+
                                    |
                  Resume / Complete / Cancel (Admin)
```

- Created/Paid/WaitingDelivery tek purchase transaction'ında; Delivered/
  WaitingConfirmation tek delivery transaction'ında timeline'a ayrı olay olarak
  yazılır. Bu ara durumlar istemcide bekleyen yarım işlemler değildir.
- Order fiyatı ve başlığı satın alma anındaki snapshot'tır; ilan düzenlemek eski
  order fiyatını değiştirmez. Her geçiş UTC zaman, actorId, actorRole ve not içerir.
- WaitingDelivery: taraflar veya Admin iptal edip iade edebilir.
- Teslimden sonra taraflar doğrudan iptal edemez; Buyer bağlı destek açar.
- Completed ve Cancelled terminaldir. Genel status değiştirme endpoint'i yoktur.
- `HOLD`: Buyer Available -P, Held +P (1 ledger).
- `RELEASE` + `SALE`: Buyer Held -P, Seller Available +P (2 ledger).
- `REFUND`: Buyer Held -P, Available +P (1 ledger).
- Order row lock, deterministik wallet lock sırası, mevcut durum kontrolü ve
  `(orderId, type)` unique constraint çift aktarımı engeller. Tüm bakiye, event ve
  notification yazıları aynı PostgreSQL transaction'ındadır. Mevcut wallet ledger
  doğrulaması yeni hareketleri de denetler; UPDATE yasağı korunur.
- İlan stok/adet modeli Sprint 4'te yoktur. Aktif ilan birden fazla satın almaya
  açıktır. Tek kullanımlık hesap satan Seller satış sonrası ilanı pasifleştirmelidir.

### BullMQ / süre / kurtarma

`deliveredAt` ve `autoConfirmAt = deliveredAt + AUTO_CONFIRMATION_HOURS` saklanır.
Varsayılan 24 saat; yerel demo için `0.01` = 36 saniye. `npm run dev` / API `start`
worker'ı da başlatır (`ORDER_JOBS_ENABLED=true`). Ek ayrı terminal gerekmez.

Redis queue: `order-auto-confirm`. Job ID: `order-<UUID>-<deadline-ms>`, 5 deneme ve
exponential retry. Worker **veritabanında** kilit aldıktan sonra hem
WaitingConfirmation hem son tarihi kontrol eder. Eski/tekrarlı job; paused,
completed veya cancelled siparişte para hareketi yapmaz. Tam zamanında çalışma
garanti değildir; servis yükü veya kesinti nedeniyle son tarihten sonra çalışabilir.

PostgreSQL kalıcı schedule kaynağıdır. Başlangıçta ve her
`ORDER_JOB_RECONCILE_MS=30000` aralıkta eksik işleri yeniden planlar; delivery ve
resume işlemleri ayrıca taramayı uyandırır. DB commit sonrası Redis hatası başarılı
delivery'yi geri almaz; sonraki tarama işi kurtarır. API/Redis kapalıysa aktarım
yapılmaz; servis dönünce uygun overdue işler tamamlanır. Graceful shutdown worker'ı
Prisma bağlantısından önce kapatır. Çoklu worker da aynı DB kilitlerini kullanır.

Uygulama kaynakları: [BullMQ delayed jobs](https://docs.bullmq.io/guide/jobs/delayed),
[job IDs](https://docs.bullmq.io/guide/jobs/job-ids),
[connections](https://docs.bullmq.io/guide/connections).

## Chat (metin + geçmiş)

| Endpoint | Body / sonuç |
| --- | --- |
| `POST /conversations` | Buyer `{listingId}`; aynı Buyer/ilan için tekrar aynı conversation |
| `GET /conversations` | Kullanıcının listing ve order konuşmaları |
| `GET /conversations/:id` | Taraflar/Admin okuyabilir |
| `GET /conversations/:id/messages` | Sayfalı geçmiş; taraflar/Admin |
| `POST /conversations/:id/messages` | Yalnız taraflar, `{body: "..."}`, 201 |

Order oluşturulurken ayrı order conversation otomatik oluşturulur. Listing
conversation satın almadan önce Message Seller içindir. `Conversation` tablosu
sabit katılımcı/bağlam ve sayfalı gelen kutusu için kullanılır; gizli metinlerden
alıcı tahmin edilmez. Gönderen oturumdan türetilir. Metin trim edilir, boş ve
2000 karakter üstü reddedilir. Eklenti, dosya, presence, typing, Socket.IO yoktur.

## Support

| Endpoint | Yetki / body |
| --- | --- |
| `POST /support/tickets` | `{subject, body, orderId?}`, 201 |
| `GET /support/tickets` | Sahibi kendi ticket'ları; Admin tümü |
| `GET /support/tickets/:id` | Yalnız sahibi/Admin |
| `GET /support/tickets/:id/messages` | Yalnız sahibi/Admin |
| `POST /support/tickets/:id/messages` | `{body}`; Admin cevabı Answered, sahibi cevabı Open |
| `PATCH /support/tickets/:id` | Admin `{status: Open|InProgress|Answered|Closed}` |
| `POST /support/tickets/:id/resolve` | Admin `{action: Resume|Complete|Cancel, body: "gerekçe"}` |

Subject 1-160, mesaj 1-2000, resolution gerekçesi 1-1900 karakter. Closed ticket
yeniden açılmaz/cevaplanmaz; gerekirse yeni ticket açılır. Admin status değişikliği
ve resolution gerekçesi cevap geçmişinde actor bilgisiyle saklanır.

Bağlı ticket yalnız Order Buyer tarafından WaitingDelivery veya süresi henüz
bitmemiş WaitingConfirmation için açılır. Order aynı transaction içinde
SupportPaused olur, eski durum ve kalan milisaniye saklanır, autoConfirmAt null
yapılır. Order başına tek aktif bağlı ticket vardır. Eski BullMQ job'ı kuyrukta
kalsa bile etkisizdir. Destek metni Seller'a açık değildir; Seller yalnız order'ın
durakladığını görür.

- Resume: eski WaitingDelivery'ye veya **kalan süreyle** WaitingConfirmation'a döner.
- Complete: Buyer Held -> Seller Available, order Completed.
- Cancel: Buyer Held -> Buyer Available, order Cancelled.
- Üç çözüm de ticket'ı kapatır. Paused order'ı çözmeden yalnız Closed yapmak
  `409 RESOLUTION_REQUIRED` döndürür. Yeni genel ticket bir order'ı durdurmaz.
- Süre dolduktan sonra bağlı ticket `409 CONFIRMATION_EXPIRED`; genel destek
  kanalı açık kalır. Tamamlanmış siparişin parasını genel ticket değiştirmez.

## Reviews, seller profile, notifications

`POST /orders/:id/review`: rating tam sayı 1-5, comment opsiyonel 0-1000. Buyer,
Seller ve Order ilişkileri backend'de türetilir. Order başına tek kayıt; tekrar
`409 REVIEW_EXISTS`, henüz tamamlanmamışsa `409 ORDER_NOT_COMPLETED`.

Public `GET /sellers/:id?page=1&limit=20`: isim/üyelik tarihi, DB'den hesaplanan
averageRating (yoksa null), reviewCount, completedSales, sayfalı kısa reviews ve
son 12 aktif ilan. Email, parola, teslimat notu ve order UUID'si public review
listesine verilmez. Profilde fotoğraf yükleme yerine mevcut isim avatarı kullanılır.

| Endpoint | İşlev |
| --- | --- |
| `GET /notifications` | Kendi sayfalı bildirimleri + toplam unreadCount |
| `POST /notifications/:id/read` | Kendi bildirimi; diğer kullanıcının ID'si 404 |
| `POST /notifications/read-all` | Yalnız mevcut kullanıcının tümünü okundu yapar |

Olaylar: purchase/hold, delivery+confirmation period, completion/release,
cancel/refund, pause/resume, yeni chat mesajı, support cevap/durum/çözüm, review,
simulated deposit/withdrawal. Read state tekrar işaretlenebilir; başka kullanıcının
bildirimine erişim yoktur. E-posta/SMS/push gönderilmez.
