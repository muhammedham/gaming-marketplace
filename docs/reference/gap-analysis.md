# Mercur Gap Analysis

| Bölüm | Mercur'da Var mı? | Bizim Sistemde Gerekiyor mu? | Karar | Uygulama |
| --- | --- | --- | --- | --- |
| Product Listing | Var | Var | Adapt | Basit gaming listing modeline uyarlanacak. |
| Category | Var | Var | Adapt | Gaming kategorileri Home ve All Listings içinde kullanılacak. |
| Wallet / Coin | Kısmen | Var | Build | Payments/Payouts referans; Coin ve Held Balance sıfırdan yazılacak. |
| 24 Saat Onay | Yok | Var | Build | Order flow ve BullMQ işi olarak geliştirilecek. |
| Support Ticket | Görülmedi | Var | Build | Siparişe bağlanabilen basit ticket modülü yazılacak. |
| Rating | Kısmen | Var | Build | Completed order sonrası 1-5 yıldız sistemi uygulanacak. |
| Generic Commerce UI | Var | Kısmen | Adapt | Gaming marketplace ekranlarına dönüştürülecek. |
| Seller / Vendor Panel | Var | Var | Adapt | Ayrı mağaza yerine role-based Seller Dashboard sadeleştirilecek. |
| Authentication & Roles | Var | Var | Adapt | Buyer, Seller ve Admin rolleri uygulanacak. |
| Vendor Onboarding | Var | Kısmen | Ignore / Adapt | Karmaşık onboarding alınmayacak; basit Seller hesabı kullanılacak. |
| Admin Panel | Var | Var | Adapt | Sayfa organizasyonu ve tablo yaklaşımı referans alınacak. |
| Order Lifecycle | Var | Var | Adapt | Kendi order status modelimiz uygulanacak. |
| Product / Offer / Inventory | Var | Kısmen | Simplify | Product/offer yapısı tek Listing modeline indirgenecek. |
| Media Upload | Var | Var | Adapt | Cover, gallery ve opsiyonel video local uploads ile saklanacak. |
| Search & Filters | Var | Var | Adapt | Title, Category, Game, min-max price ve sorting uygulanacak. |
| Chat / Messages | Görülmedi | Var | Build | MVP'de HTTP Polling ile basit mesajlaşma yazılacak. |
| Notifications | Kısmen | Var | Build | Site içi okunmuş/okunmamış bildirimler yazılacak. |
| Shipping / Tax / Inventory | Var | Hayır | Ignore | Dijital ürün MVP'sine dahil edilmeyecek. |
| Promotions / Price Lists | Var | Hayır | Ignore | İlk sürüm kapsamı dışında tutulacak. |
| API / Modular Architecture | Var | Var | Take concept | Modül sınırları referans alınacak; kod kopyalanmayacak. |

## Karar Anahtarı

- `Take concept`: Fikir ve sınırları referans al.
- `Adapt`: Gaming Marketplace ihtiyacına göre sadeleştir.
- `Build`: Bağımsız olarak sıfırdan geliştir.
- `Ignore`: MVP kapsamına alma.

