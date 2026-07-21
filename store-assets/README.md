# store-assets — đồ nộp store

Ảnh/tài liệu để upload lên **Google Play Console** và **App Store Connect**.
KHÔNG phải asset app chạy (asset chạy nằm ở `public/`, `android/.../res/`).

## Kéo file nào vào đâu

| Store | Slot | Thư mục | Cỡ |
|---|---|---|---|
| **Play** | App icon | `play/app-icon-512.png` | 512×512 |
| **Play** | Feature graphic | `play/feature-graphic.png` | 1024×500 |
| **Play** | Phone screenshots | `play/real-*.png` | 1080×1920 |
| **Play** | Tablet screenshots | `play/tablet-*.png` | 1440×2560 |
| **App Store** | iPhone 6.5" | `ios/6.5/*.png` | **1242×2688** |
| **App Store** | iPhone 6.7" | `ios/6.7/*.png` | **1284×2778** |
| **App Store** | iPad Pro 12.9" | `ios/ipad-12.9/*.png` | **2048×2732** |
| **App Store** | iPad 13" | `ios/ipad-13/*.png` | **2064×2752** |

⚠️ Apple bắt **đúng pixel**. Kéo nhầm file khác thư mục → lỗi "Screenshots dimensions should be…".
Mỗi slot chỉ dùng **một** cỡ, không trộn.

## Sinh lại

```bash
node scripts/generate-ios-screenshots.mjs   # -> ios/**  (nguồn: play/real-*, play/tablet-*)
```
Đổi tiêu đề / ảnh nguồn → sửa `SHOTS[]`; thêm cỡ mới → thêm vào `SIZES[]`.

Ảnh Play (9:16) **không** resize thẳng sang iPhone (9:19.5) / iPad (3:4) được — script đặt ảnh app vào khung marketing rồi render đúng pixel.

## Khác

- `privacy-policy.html` — bản chính sách riêng tư. **Cần host lên URL công khai** thì Apple/Google mới nhận (ô Privacy Policy URL bắt buộc).
- Nguồn logo thương hiệu: `../brand/`
