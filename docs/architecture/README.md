# Mimari Tasarım

## Runtime Akışı

```text
Buyer / Seller / Admin
          |
          v
React + TypeScript + Vite
          |
          | REST API + Polling
          v
Fastify API
          |
          +-- Auth / Listings / Wallet / Orders / Support / Admin
          +-- Prisma ORM --> PostgreSQL
          +-- BullMQ --> Redis
          `-- Local Uploads
```

Mercur bu akışın parçası değildir. Yalnızca ekran organizasyonu ve modül
ayrımları için referans olarak incelenir.

## Sınırlar

- Browser doğrudan PostgreSQL, Redis veya uploads alanına erişmez.
- Kritik Wallet ve Order işlemleri backend transaction'ları içinde yürütülür.
- BullMQ, Redis kullanarak 24 saatlik otomatik onay işlerini planlar.
- MVP mesajlaşması HTTP Polling ile çalışır.

Excalidraw kaynağı ve PNG/PDF çıktıları `docs/wireframes` altında saklanabilir.

