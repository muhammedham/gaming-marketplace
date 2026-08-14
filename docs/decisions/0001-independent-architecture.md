# ADR 0001: Bağımsız Uygulama Mimarisi

- Durum: Kabul edildi
- Tarih: 14 Ağustos 2026

## Bağlam

Mercur, Medusa tabanlı kapsamlı bir multi-vendor marketplace platformudur.
Projenin seçilen teknoloji yığını ise React/Vite ve Fastify/Prisma'dır.

## Karar

Gaming Marketplace sıfırdan ve bağımsız olarak geliştirilecektir. Mercur kodu,
paketleri, veri modeli veya runtime servisleri projeye dahil edilmeyecektir.
Mercur yalnızca kullanıcı akışları, panel ayrımları ve modüler mimari için
referans olarak kullanılacaktır.

## Sonuçlar

- Proje kapsamı doğrudan gaming marketplace MVP'sine göre şekillenir.
- Medusa ürün, inventory, shipping, tax ve offer modeli taşınmaz.
- Wallet, Held Balance, 24 saat ve SupportPaused kuralları bize ait olur.
- Mercur güncellemeleri uygulamanın çalışmasını etkilemez.

