# Gaming Marketplace

Oyuncuların dijital ürünlerini listeleyip satın alabileceği bağımsız bir
marketplace MVP projesidir. Mercur kodu bu repository'ye dahil edilmez; yalnızca
kullanıcı akışları ve marketplace yaklaşımı için referans olarak kullanılır.

## Ekip ve Takvim

- Muhammed - Full-Stack Developer
- Zeyad - Full-Stack Developer
- Başlangıç: 12 Ağustos 2026
- Nihai teslim: 5 Eylül 2026

## Teknoloji Yığını

- Web: React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, Zustand
- API: Node.js, TypeScript, Fastify
- Veri: Prisma ORM, PostgreSQL, Redis
- Araçlar: npm workspaces, Docker Compose, Vitest, Postman

## Proje Yapısı

```text
gaming-marketplace/
|-- apps/
|   |-- web/                 React + Vite
|   `-- api/                 Fastify + Prisma
|       |-- prisma/          Şema, migration ve seed
|       `-- src/modules/     Auth ve diğer API modülleri
|-- docs/                    Kararlar ve API dokümantasyonu
|-- uploads/                 Yerel medya dosyaları
|-- docker-compose.yml
|-- .env.example
`-- package.json
```

## İlk Kurulum

Gereksinimler: Node.js 20 veya üzeri, npm ve çalışan Docker Desktop.

PowerShell'i repository klasöründe açıp şu komutları çalıştırın:

```powershell
Copy-Item .env.example .env
npm install
npm run db:up
npm run db:deploy
npm run db:generate
npm run db:seed
npm run dev
```

Final setup can be shortened after `npm install`:

```powershell
npm run setup:final
npm run dev
```

`npm run dev`, Web ve API geliştirme sunucularını aynı terminalde birlikte
başlatır. Ayrı ayrı çalıştırmak için `npm run dev:web` ve `npm run dev:api`
komutları kullanılabilir.

Yeni `.env.example`, ilan ekranlarını gerçek Fastify API'sine bağlayan
`VITE_LISTINGS_SOURCE=api` ayarıyla gelir. Daha önce oluşturulmuş bir `.env`
dosyasında bu değer `mock` ise Sprint 2 entegrasyonu için `api` olarak değiştirin.

## Yerel Adresler

- Web: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:4000`
- Health: `http://127.0.0.1:4000/health`
- PostgreSQL: `127.0.0.1:5433`
- Redis: `127.0.0.1:6380`

Mercur referans ortamının 3000, 7001, 7002 ve 9000 portlarıyla çakışmamak için
farklı host portları kullanılır.

## Demo Hesapları

`npm run db:seed` aşağıdaki hesapları ve her hesap için sıfır bakiyeli Wallet
kaydını oluşturur. Seed tekrar çalıştırılabilir.

| Rol | E-posta | Şifre |
| --- | --- | --- |
| Admin | `admin@gaming.local` | `Admin123!` |
| Buyer | `buyer@gaming.local` | `Buyer123!` |
| Seller | `seller@gaming.local` | `Seller123!` |

## Sprint 1 Auth Akışı

- Kayıt sırasında yalnızca Buyer veya Seller rolü seçilebilir.
- User ve sıfır bakiyeli Wallet aynı veritabanı transaction'ında oluşturulur.
- Login sonrası JWT, JavaScript tarafından okunamayan `gm_session` HttpOnly
  cookie'sine yazılır.
- `/api/v1/auth/me`, oturumdaki kullanıcıyı, rolünü ve Wallet bakiyelerini döner.
- `/api/v1/admin/session` yalnızca Admin rolüne izin verir.
- Logout cookie'yi temizler ve kullanıcıyı Login sayfasına yönlendirir.

Ayrıntılı response ve hata sözleşmesi [Auth API Contract](docs/api/auth-contract.md)
dosyasındadır.

## Sprint 2 Kategori, Oyun ve İlan Akışı

- Seed; Accounts, Game Currency, Items, Skins, Gift Cards ve Boosting
  kategorilerini, ayrıca dört demo oyunu tekrar çalıştırılabilir biçimde oluşturur.
- Public katalog yalnız `ACTIVE` ve Cover'ı olan ilanları döndürür. Arama;
  title/description, category, game, min-max price, sorting ve pagination'ı
  birlikte destekler.
- Seller, ilanını Cover ile tek multipart isteğinde oluşturur; kendi ilanlarını
  düzenleyebilir, pasifleştirebilir ve Gallery/Video ekleyebilir.
- Başka bir Seller update, deactivate veya media upload yaptığında `403
  FORBIDDEN` alır. Pasif ilan yalnız sahibinin oturumunda detaylandırılabilir.
- Upload dosya adı UUID ile yeniden üretilir. MIME, uzantı, dosya imzası, boyut,
  adet ve sahiplik backend tarafında doğrulanır; dosyalar yalnız `/uploads/`
  public path'inden sunulur.

| Endpoint | Erişim | Açıklama |
| --- | --- | --- |
| `GET /api/v1/categories` | Public | Kategori listesi |
| `GET /api/v1/games` | Public | Oyun listesi |
| `GET /api/v1/listings` | Public | Arama, filtre, sıralama ve pagination |
| `GET /api/v1/listings/:listingId` | Public/Owner | Aktif detay veya sahibine pasif detay |
| `GET /api/v1/listings/mine` | Seller | Aktif ve pasif kendi ilanları |
| `POST /api/v1/listings` | Seller | Cover zorunlu atomik multipart create |
| `PATCH /api/v1/listings/:listingId` | Owner Seller | İlan bilgilerini güncelleme |
| `POST /api/v1/listings/:listingId/deactivate` | Owner Seller | Pasifleştirme |
| `POST /api/v1/listings/:listingId/activate` | Owner Seller | Pasif ilanı yeniden aktifleştirme |
| `POST /api/v1/listings/:listingId/media` | Owner Seller | Cover/Gallery/Video upload |

Ayrıntılı request, response, filtre ve upload sözleşmesi [Listings API
Contract](docs/api/listings-contract.md) dosyasındadır.

## Wallet API

- `GET /api/v1/wallet` available/held Coin bakiyelerini ve Coin/TRY ile withdrawal fee simülasyon ayarlarını döner.
- `POST /api/v1/wallet/deposits/simulate` TRY tutarını rate üzerinden Coin'e çevirir ve atomik ledger kaydı oluşturur.
- `POST /api/v1/wallet/withdrawals/preview` ücret ve net TRY tutarını hesaplar; bakiye değiştirmez.
- `POST /api/v1/wallet/withdrawals/simulate` IBAN bilgisiyle simüle çekim yapar ve yalnızca maskelenmiş IBAN saklar.
- `GET /api/v1/wallet/transactions`, `/deposits` ve `/withdrawals` sayfalı geçmiş döner.
- Her bakiye değişimi açıklamalı tek bir `WalletTransaction` kaydıyla aynı transaction içinde tutulur; ledger satırları append-only'dir.
- Sprint 3 UI'sındaki Wallet sayfası simulation-only uyarısı, bakiye kartları, deposit formu, withdrawal preview/formu ve geçmişi içerir.

Ayrıntılı request ve response sözleşmesi [Wallet API Contract](docs/api/wallet-contract.md)
dosyasındadır.

## Sprint 4 - Order, 24 saat ve iletişim

Muhammed ve Zeyad kapsamları birlikte entegre edildi:

- Product Details: Buy Now, bakiye yetersizliği, Message Seller ve gerçek seller rating.
- Purchases/Sales Orders: status timeline, teslimat notu, onay, iptal/iade, sunucu
  zamanına göre sayaç ve order chat.
- Coin purchase sırasında Buyer Available'dan Held'e geçer. Onayda yalnız bir kez
  Seller Available'a aktarılır; iptalde Buyer Available'a geri döner.
- API ile birlikte çalışan BullMQ worker, varsayılan 24 saatte uygun siparişi
  tamamlar. DB taraması yeniden başlatma/Redis hatasında eksik işleri kurtarır.
- Support, ticket detail ve Admin support desk: cevap, durum, duraklatma,
  kalan süreyle devam, tamamlama veya iade. Genel Admin paneli Sprint 5 kapsamındadır.
- Text-only Messages, site içi read/unread Notifications, tek Completed-order
  review ve public Seller Profile. Mesaj/order/notification polling: 5 saniye.
- Wallet geçmişi HOLD/RELEASE/SALE/REFUND hareketlerini ve order bağlantısını gösterir.

Yeni migration'ları mevcut verileri silmeden uygulayın:

```powershell
npm install
npm run db:up
npm run db:deploy
npm run db:generate
npm run dev
```

Windows'ta Prisma generate `EPERM` verirse API geliştirme sunucusunu durdurun,
generate çalıştırın, sonra `npm run dev` ile yeniden başlatın. Veritabanını resetlemeyin.

`AUTO_CONFIRMATION_HOURS=24`, `ORDER_JOBS_ENABLED=true`,
`ORDER_JOB_RECONCILE_MS=30000` varsayılandır. Yerel hızlı demo için hours `0.01`
(36 saniye) olabilir; API yeniden başlatılmalı, önceki deadline'lar değiştirilmez.

İsteğe bağlı ayrı ve tekrar çalıştırılabilir demo verisi:

```powershell
npm run demo:sprint4
```

Bu komut `sprint4-buyer@gaming.local`, `sprint4-seller@gaming.local` ve
`sprint4-admin@gaming.local` hesaplarını (`Sprint4Demo123!`), tek 40 Coin demo ilanını
ve Buyer için tek seferlik 1000 TRY simulated deposit'i oluşturur. Mevcut kullanıcı,
ürün veya bakiyeyi resetlemez. Yalnız yerel geliştirme içindir.

Ayrıntılar:

- [Orders/Support API contract](docs/api/orders-support-contract.md): tüm endpoint,
  durum, para, yetki, polling ve worker sözleşmesi.
- [Sprint 4 teslim ve demo](docs/sprint-4/README.md): kişi bazlı kapsam, kabul
  matrisi, senaryolar, test kanıtı, sınırlamalar ve GitHub issue eşlemesi.
- [Sprint 4 Postman collection](docs/postman/Gaming_Marketplace_Sprint_4.postman_collection.json):
  auth, purchase, delivery, confirmation, messages, support, review, notifications örnekleri.

## Sprint 5 - Admin, entegrasyon ve final

- `/admin` Dashboard; kullanıcı, aktif katalog/ilan, order/support, Available/Held ve
  temsili withdrawal özetlerini gösterir. Son Wallet ledger ve Admin audit kayıtları
  aynı ekrandadır.
- `/admin/users`, `/categories`, `/games`, `/listings`, `/orders`, `/withdrawals`,
  `/support` ve `/settings` tarama odaklı, filtreli ve rol korumalı ekranlardır.
- Admin değişiklikleri veritabanı transaction'ı içinde `AdminAuditLog` kaydı üretir.
  Son aktif Admin kaldırılamaz; Admin kendi rolünü değiştiremez veya kendini askıya alamaz.
- Kategori/oyun pasifleştirmesi bağlı aktif ilanları atomik olarak gizler. Pasif
  taxonomy ile ilan yeniden yayınlanamaz.
- System Settings, Coin/TRY rate, withdrawal fee ve yeni teslimatlar için otomatik
  onay süresini yönetir. Eski deadline ve ledger kayıtları değiştirilmez.
- Withdrawal Admin ekranı dahil her yerde **Simulation only** olarak etiketlidir.

Final ve tekrar çalıştırılabilir kabul verisini hazırlamak için:

```powershell
npm run demo:final
```

Komut seed'i tekrar çalıştırır; bir Completed + review order, bir SupportPaused
order ve temsili withdrawal kaydı bırakır, ardından Admin kanıt özetini terminale
yazar. Gerçek ödeme veya banka transferi yapılmaz.

Sprint 5 teslim/demoda kişi bazlı kapsam ve kanıtlar
[Sprint 5 final delivery](docs/sprint-5/README.md), Admin sözleşmesi
[Admin API contract](docs/api/admin-contract.md), rapor uyumu
[Final report comparison](docs/final/report-comparison.md) ve kalan maddeler
[Known medium items](docs/final/known-medium.md) dosyalarındadır.

API testleri `gaming_marketplace_test` adlı ayrı PostgreSQL schema'sında migration
ve seed çalıştırır. Gerçek kullanıcıların bakiyelerine ve bildirimlerine dokunmaz.
Redis worker testi benzersiz test kuyruğu kullanır ve sadece fixture order'larını tarar.

## Veritabanı Komutları

```powershell
npm run db:up        # PostgreSQL ve Redis'i başlatır
npm run db:deploy    # Repository'deki migration'ları uygular
npm run db:seed      # Demo kullanıcılarını oluşturur/günceller
npm run db:migrate   # Şema geliştirirken yeni migration üretir
npm run db:generate  # Prisma Client'ı yeniden üretir
npm run db:down      # Docker servislerini durdurur
npm run db:reset     # DESTRUCTIVE: yapılandırılmış DB şemasını siler, migrate + seed yapar
```

## Kalite Kontrolleri

```powershell
npm run lint
npm run test
npm run build
npm run verify       # lint + tüm testler + tüm build'ler
```

Postman collection ve local environment dosyaları `docs/postman` altındadır.
Postman, Login response'undaki cookie'yi kendi cookie jar'ında saklar; Bearer token
girmek gerekmez. Seller işlemleri için önce `Login Demo Seller`, sonra Categories
ve Games isteklerini çalıştırıp Create Listing içindeki Cover dosyasını seçin.

## MVP Kapsamı

- Authentication ve Buyer/Seller/Admin rolleri
- Categories, Games ve Listings
- Cover image, galeri ve opsiyonel video
- Wallet, Coin, Available Balance ve Held Balance
- Order yaşam döngüsü ve 24 saatlik otomatik onay
- Basit mesajlaşma, Support Ticket, Rating ve Notifications
- Admin yönetimi

`1 Coin = 1 TRY` kabul edilir. Deposit ve Withdrawal Sprint 1 kapsamında değildir
ve MVP'de yalnızca simülasyon olarak uygulanacaktır. Mesajlaşma Polling ile
başlayacak, Socket.IO ise opsiyonel kalacaktır.
