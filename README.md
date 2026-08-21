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
npm run db:seed
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
| `POST /api/v1/listings/:listingId/media` | Owner Seller | Cover/Gallery/Video upload |

Ayrıntılı request, response, filtre ve upload sözleşmesi [Listings API
Contract](docs/api/listings-contract.md) dosyasındadır.

## Veritabanı Komutları

```powershell
npm run db:up        # PostgreSQL ve Redis'i başlatır
npm run db:deploy    # Repository'deki migration'ları uygular
npm run db:seed      # Demo kullanıcılarını oluşturur/günceller
npm run db:migrate   # Şema geliştirirken yeni migration üretir
npm run db:generate  # Prisma Client'ı yeniden üretir
npm run db:down      # Docker servislerini durdurur
```

## Kalite Kontrolleri

```powershell
npm run lint
npm run test
npm run build
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
