# Gaming Marketplace

Oyuncuların dijital ürünlerini listeleyip satın alabileceği bağımsız bir
marketplace MVP projesi.

Bu proje sıfırdan geliştirilecektir. Mercur kaynak kodu projeye dahil
edilmeyecek; yalnızca kullanıcı akışları ve modüler marketplace yaklaşımı için
referans olarak kullanılacaktır.

## Ekip

- Muhammed - Full-Stack Developer
- Zeyad - Full-Stack Developer

## Takvim

- Başlangıç: 12 Ağustos 2026
- Nihai teslim: 5 Eylül 2026

## Teknoloji Yığını

### Frontend

- React, TypeScript ve Vite
- Tailwind CSS ve shadcn/ui
- React Router
- TanStack Query
- Zustand

### Backend

- Node.js ve TypeScript
- Fastify
- Prisma ORM
- PostgreSQL
- Redis ve BullMQ
- MVP mesajlaşması için Polling

### Geliştirme

- npm workspaces
- Docker Compose
- Local uploads
- Postman

## Proje Yapısı

```text
gaming-marketplace/
|-- apps/
|   |-- web/                 React + Vite
|   `-- api/                 Fastify + Prisma
|       |-- src/modules/
|       `-- prisma/
|-- uploads/                 Yerel medya dosyaları
|-- docs/                    Kararlar ve API dokümantasyonu
|-- docker-compose.yml
|-- .env.example
`-- package.json
```

## MVP Kapsamı

- Authentication ve Buyer/Seller/Admin rolleri
- Categories, Games ve Listings
- Cover image, galeri ve opsiyonel video
- Wallet, Coin, Available Balance ve Held Balance
- Order yaşam döngüsü ve 24 saatlik otomatik onay
- Basit mesajlaşma, Support Ticket, Rating ve Notifications
- Admin yönetimi

## Temel Kararlar

- Mercur yalnızca referanstır; runtime bağımlılığı değildir.
- Tek React uygulaması role-based route kullanacaktır.
- Frontend yalnızca Fastify REST API ile iletişim kuracaktır.
- `1 Coin = 1 TRY`; oran `SystemSettings` üzerinden okunacaktır.
- Deposit ve Withdrawal işlemleri MVP'de simülasyondur.
- Mesajlaşma Polling ile başlayacaktır; Socket.IO opsiyoneldir.
- Medya dosyaları ilk sürümde yerel diskte saklanacaktır.

## Yerel Servisler

Proje servisleri Mercur referans ortamıyla çakışmaması için farklı host portları
kullanır:

- Web: `http://localhost:5173`
- API: `http://localhost:4000`
- PostgreSQL: `localhost:5433`
- Redis: `localhost:6380`

Docker servislerini başlatmak için:

```powershell
Copy-Item .env.example .env
npm run db:up
```

Bağımlılıkları kurup web uygulamasını başlatmak için:

```powershell
npm install
npm run dev:web
```

Web kalite kontrolleri:

```powershell
npm run lint:web
npm run test:web
npm run build:web
```

## API Modülleri

- Auth
- Listings
- Wallet
- Orders
- Support
- Admin

Başlangıç Postman örnekleri `docs/postman`, Sprint 1 Auth response ve cookie
sözleşmesi `docs/api/auth-contract.md` altında bulunmaktadır.

## Mercur Referans Ortamı

- API: `http://localhost:9000`
- Admin: `http://localhost:7001`
- Vendor: `http://localhost:7002`
- Storefront: `http://localhost:3000`

Mercur kurulum dosyaları `Hazırlık/Template/mercur` altında ayrı tutulur ve bu
repository'ye kopyalanmaz.
