# Mercur Referansı

## Amaç

Mercur yalnızca marketplace kullanıcı akışlarını ve modüler yapı yaklaşımını
incelemek için çalıştırılır. Bu klasördeki bilgiler bizim runtime sistemimize ait
değildir.

## Yerel Adresler

- API: `http://localhost:9000`
- Admin: `http://localhost:7001`
- Vendor: `http://localhost:7002`
- Storefront: `http://localhost:3000`

## Çalıştırma

```powershell
Set-Location "C:\Users\hamad\Desktop\Gaming Marketplace\Hazırlık\Template\mercur"
bunx turbo run dev --filter=@acme/api --filter=@acme/admin --filter=@acme/vendor --filter=@mercurjs/storefront
```

## İncelenen Akış

1. Seller ürün oluşturur.
2. Ürün Admin tarafında Proposed olarak görünür.
3. Admin ürünü onaylar.
4. Ürün Storefront üzerinde görünür.

Bu onay akışı doğrudan MVP gereksinimi değildir. Bizim ilk sürümümüzde Admin,
aktif ilanı sonradan pasifleştirebilir.