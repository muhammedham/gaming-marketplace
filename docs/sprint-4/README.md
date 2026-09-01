# Sprint 4 teslim, doğrulama ve demo

Tarih: 28 Ağustos 2026. Başlangıç: `codex/sprint-3-wallet` / `3039793`.
Kaynaklar: `05_Sprint_4_Order_24Saat_Basit_Chat_Support_Rating_Notification.pdf`
ve `Gaming_Marketplace_Nihai_Tasarim_Raporu_TR_REVIZE.pdf` (özellikle bölümler 6-11).
Sprint 4, sıfırdan sayılan takvimde beşinci sprinttir.

## Muhammed ve Zeyad kapsamı

| Sorumlu / GitHub işi | Uygulama | Kanıt |
| --- | --- | --- |
| Muhammed [#16](https://github.com/muhammedham/gaming-marketplace/issues/16) | Buy Now, insufficient balance, rol bazlı order detail, timeline, teslim, onay, sayaç | PurchasePanel, OrderDetailPage; UI ve API testleri |
| Muhammed [#17](https://github.com/muhammedham/gaming-marketplace/issues/17) | Text chat, inbox, support form/detail, notifications, tek review, 5 sn polling | MessagesPage, SupportPage, TicketDetailPage, NotificationsPage, ChatPanel |
| Zeyad [#18](https://github.com/muhammedham/gaming-marketplace/issues/18) | Sekiz order durumu; atomik hold/release/refund; sahiplik, snapshot ve çift işlem koruması | orders.service.ts, migration constraints, concurrency testleri |
| Zeyad [#19](https://github.com/muhammedham/gaming-marketplace/issues/19) | BullMQ auto-confirm, env süre, tekrar/yeniden başlatma koruması | orders.jobs.ts; gerçek Redis delayed job ve paused deadline testi |
| Zeyad [#20](https://github.com/muhammedham/gaming-marketplace/issues/20) | Conversation/messages, tickets/replies/status/resolution, review/profile, read/unread notification API | communication modülü; yetki/validation/tekillik testleri |
| Ortak [#21](https://github.com/muhammedham/gaming-marketplace/issues/21) | Normal completion ve SupportPaused/iade entegrasyonu, test ve demo | Otomatik testler + aşağıdaki tekrarlanabilir akış |

GitHub issue metinleri uygulama kapsamıyla karşılaştırıldı. Yukarıdaki tablo yerel
uygulama kanıtıdır; uzak issue kapatma veya branch push işleminin yapıldığı anlamına
gelmez. Uzak güncelleme ayrıca onaylanmalıdır.

## Kabul matrisi

- [x] Buy Now order oluşturur, Buyer Available azalır, Held artar.
- [x] Yetersiz bakiye/yarış durumunda kısmi order veya ledger kalmaz.
- [x] Seller tesliminde Delivered + WaitingConfirmation event'leri ve deadline oluşur.
- [x] Buyer confirm ve eşzamanlı worker/confirm yalnız bir kez Seller Available artırır.
- [x] Süresi gelmemiş, SupportPaused, Completed ve Cancelled order worker'da no-op.
- [x] Süre öncesi bağlı ticket aynı transaction'da order'ı SupportPaused yapar.
- [x] Admin cevap/status ve Resume/Complete/Cancel akışları çalışır.
- [x] Resume kalan süreyi korur; eski job yeni deadline'dan önce para aktaramaz.
- [x] Completed order için yalnız ilgili Buyer tek 1-5 review oluşturur.
- [x] Seller ortalaması/sayısı DB'den hesaplanır; public review'da özel order bilgisi yoktur.
- [x] Mesaj metni, geçmiş ve polling; boş/uzun/yetkisiz mesaj reddi.
- [x] Read/unread notifications kullanıcıya özeldir; wallet olayları da bildirim üretir.
- [x] Yeni ekranlarda loading, empty, error ve işlem sonrası güncel başarı durumu.
- [x] Normal sipariş ve bakiye işlemlerinde onay pencereleri; tutar/deadline backend'den.
- [x] Migration ve seed boş test schema'sında çalışır; eski veriler korunur.

## Çalıştırma

```powershell
npm install
npm run db:up
npm run db:deploy
npm run db:generate
npm run db:seed
npm run dev
```

API 4000, Web 5173, Postgres 5433, Redis 6380. Worker API sürecine dahildir;
`ORDER_JOBS_ENABLED=true` varsayılandır. Üretim varsayımı `AUTO_CONFIRMATION_HOURS=24`.
Windows'ta Prisma generate dosya kilidi varsa API'yi durdurup generate sonrası
yeniden başlatın. `db:reset` veya volume silmek gerekmez.

İzole yerel demo hesabı/ilanı hazırlamak için `npm run demo:sprint4`:

| Rol | E-posta | Şifre |
| --- | --- | --- |
| Buyer | sprint4-buyer@gaming.local | Sprint4Demo123! |
| Seller | sprint4-seller@gaming.local | Sprint4Demo123! |
| Admin | sprint4-admin@gaming.local | Sprint4Demo123! |

Komut 40 Coin fiyatlı **Sprint 4 Demo - Delivery practice** ilanı ve Buyer'a tek
seferlik 1000 TRY simulated deposit oluşturur; tekrar çağırmak bakiyeyi sıfırlamaz
ve yeni bakiye eklemez. Gerçek ürün/para yoktur. Diğer kullanıcıların kayıtları
değişmez. İlan resmi repository'deki demo artwork'ten yerel uploads'a kopyalanır.

## Demo A - normal completion

1. Buyer hesabıyla demo ilanını açın. Available ve seller rating'i kontrol edin.
2. Buy Now -> Confirm. 1000 Coin başlangıcında Available 960, Held 40 olmalı.
3. Order chat'e metin yazın. Seller hesabıyla Sales orders üzerinden aynı siparişi açın.
4. Mesajı görün, cevap yazın; Delivery details girip Mark delivered -> Confirm.
5. WaitingConfirmation, teslimat notu, timeline ve yaklaşık 24 saat sayaç görünür.
6. Buyer'a dönün. Yeni cevabı görün, Confirm receipt -> Confirm.
7. Completed: Buyer Held 0, Seller Available +40. Wallet geçmişinde Buyer HOLD ve
   RELEASE, Seller SALE; her kayıtta order bağlantısı görünür.
8. Buyer 1-5 review gönderir. Form yerini review'a bırakır. Seller profile'da ortalama,
   review count ve completed sales güncellenir. İkinci review API tarafından reddedilir.

## Demo B - SupportPaused ve iade

1. Yeni order satın alın. İsterseniz Seller ile teslim edin.
2. Buyer Order Details -> Open support ticket; süre dolmadan subject/message girip onaylayın.
3. Ticket Open, order SupportPaused, autoConfirmAt null; Coin Held kalır.
4. Admin Support desk -> ticket; InProgress seçin ve cevap yazın.
5. Buyer cevabı polling ile görür; ticket yalnız Buyer sahibi/Admin'e açıktır.
6. Admin resolution gerekçesiyle Cancel seçip onaylar: ticket Closed, order Cancelled,
   Held Buyer Available'a döner. Yeniden çözüm veya confirm para aktaramaz.
7. Alternatifler: Resume kalan süreyle devam eder; Complete Seller'a Coin'i aktarır.
   Her alternatif için yeni order/ticket kullanın.

## Demo C - kısa gerçek worker süresi

1. Yerel `.env` içinde `AUTO_CONFIRMATION_HOURS=0.01` ayarlayıp API'yi yeniden başlatın.
2. Yeni order satın alıp Seller ile teslim edin. Sayaç 36 saniyeden başlar.
3. Buyer onaylamadan bekleyin: worker Completed yapar, polling sonucu gösterir.
4. Başka yeni order'da süre dolmadan support açın. 36 saniye geçse de SupportPaused
   ve Held değişmez. Admin Resume yaparsa kalan süre kadar beklenir.
5. Deney sonunda ayarı 24'e döndürüp API'yi yeniden başlatın. Mevcut order
   deadline'ları ayar değişikliğinden etkilenmez.

## Otomatik doğrulama

`npm test`, `npm run lint`, `npm run build` komutları kullanılır.

- API: 31 test (17 önceki sprint + 14 yeni Sprint 4 entegrasyon testi).
- Web: 13 test (8 önceki sprint + 5 yeni sayaç/bakiye/error/polling/gönderme testi).
- Yeni testlerde gerçek PostgreSQL transaction'ları ve gerçek Redis/BullMQ kullanılır.
- Test başlangıcında migration + seed yalnız `gaming_marketplace_test` schema'sında
  çalışır. Kullanıcıların public schema'sına test hesabı/bildirim yazılmaz.
- Worker testleri benzersiz kuyruğu sadece fixture order ID'leriyle tarar ve temizler.
- Yarış testleri: aynı purchase key, farklı purchase'larda yetersiz bakiye,
  eşzamanlı buyer confirm/worker, duplicate review ve duplicate cancellation.
- Ledger UPDATE yasağı, fiyat snapshot'ı ve Held'den withdrawal yapılamaması doğrulanır.

### Yerel tarayıcı kontrolü (28 Ağustos 2026)

- Demo Buyer Buy Now + confirmation dialog: 40 Coin hold, yeni Order Details ve üç ilk event.
- Buyer/Seller arasında iki yönlü mesaj gönderimi ve geçmiş görünümü.
- Seller delivery: WaitingConfirmation ve 24 saat sayaç; Buyer confirm: Completed.
- Buyer review: form kapanır; public Seller Profile 5.0, 1 review, 1 completed sale gösterir.
- İkinci demo order: bağlı ticket -> SupportPaused; Admin InProgress, cevap,
  Cancel resolution -> ticket Closed, order Cancelled.
- Notifications: Mark all read sonrası unread count 0 ve header badge temizlenir.
- Support ekranı mobil viewport'ta kontrol edildi; yatay sayfa taşması yok.
- Ayrı test çalıştırmasında `AUTO_CONFIRMATION_HOURS=0.01` ile 14 order testi
  yeniden çalıştırıldı; delivery deadline hesaplaması kısaltılmış env ile de doğrulandı.

Postman Sprint 4 koleksiyonunda `listingId` ve `listingPrice` değerlerini demo
çıktısına göre ayarlayın. Response script'leri order/conversation/ticket/notification
ID'lerini collection'a ve seçilmişse environment'a kaydeder. Confirm, support ve
cancel alternatif yollardır; tüm koleksiyonu sırasıyla tek senaryo gibi çalıştırmayın.

## Eklenen/değiştirilen dokümantasyon tam listesi

1. `README.md`: Sprint 4 özellikleri, güncelleme/Prisma generate, worker/env,
   demo hesap komutu, test izolasyonu ve belge bağlantıları.
2. `docs/api/orders-support-contract.md`: tüm request/response alanları, endpoint ve
   yetkiler, state machine, Decimal/ledger, idempotency, hata kodları, worker
   recovery, support pause/resume politikası, review/profile ve notifications.
3. `docs/api/wallet-contract.md`: dört order hareketi, orderId ve wallet bildirimleri.
4. `docs/postman/Gaming_Marketplace_Sprint_4.postman_collection.json`: beş klasörde
   auth/wallet/orders/chat/support/review/notifications istekleri, otomatik ID yakalama.
5. Mevcut Postman collection/environment: eski future etiketleri ve artık geçersiz
   order/support payload'ları düzeltildi; listingPrice değişkeni eklendi.
6. Bu dosya: kişi/issue bazlı kapsam, kabul checklist'i, üç demo, test sonuçları,
   tasarım tercihleri, sınırlar ve son kontrol bilgisi.

## Bilinçli kapsam ve kalan sprint

- Socket.IO, attachments, presence, typing, e-posta/SMS/push eklenmedi; MVP metin/polling.
- Genel Admin kullanıcı/kategori/oyun/ilan/settings/withdrawals panelleri Sprint 5'tir.
  Sprint 4 Admin ekranları sadece order inceleme ve support çözümü içindir.
- Seller avatarı baş harflerden üretilir; profil fotoğrafı upload ayrı bir özellik değildir.
- Stok modeli tanımlanmadığı için aktif ilan tekrar satın alınabilir. Tek seferlik
  hesap ilanında Seller satış sonrası deactivate kullanmalıdır.
- Timer yalnız gösterimdir; ödeme kararı tarayıcı saatiyle verilmez.
- Gerçek ödeme/banka/otomatik ürün teslimi yoktur; bütün para hareketleri simülasyondur.
- `npm audit --omit=dev` mevcut Prisma 6 araç zincirinden gelen deepmerge-ts uyarısını
  üç high kayıt olarak raporlar; otomatik breaking Prisma downgrade yapılmadı.
  Bu sprintte eklenen BullMQ için bu taramada advisory bulunmadı.
- Vite tek büyük ana bundle uyarısı verebilir; build başarısızlığı değildir.
