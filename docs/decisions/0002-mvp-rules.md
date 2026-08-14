# ADR 0002: MVP İş Kuralları

- Durum: Kabul edildi
- Tarih: 14 Ağustos 2026

## Kararlar

- Roller: Buyer, Seller ve Admin.
- İlanlar ortak ve sade bir form kullanır.
- Game alanı opsiyoneldir.
- `1 Coin = 1 TRY`; oran `SystemSettings` içinde tutulur.
- Wallet bakiyeleri `available_balance` ve `held_balance` olarak ayrılır.
- Deposit ve Withdrawal işlemleri simülasyondur.
- Sipariş tutarı tamamlanana kadar Held Balance olarak izlenir.
- Delivered işleminden sonra 24 saatlik onay süresi başlar.
- Bağlı Support Ticket siparişi `SupportPaused` durumuna alabilir.
- Mesajlaşma Polling ile başlar; Socket.IO opsiyoneldir.
- Medya ilk sürümde local uploads ile saklanır.

