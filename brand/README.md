# brand — nguồn thương hiệu SDFish

Logo gốc. Mọi icon/ảnh khác trong repo **sinh ra từ đây**, đừng sửa tay file output.

| File | Là gì | Ai dùng |
|---|---|---|
| `logo-sdfish.png` | Logo gốc (mark cá+la bàn + chữ SDFish, nền giấy) | `npm run icons` → `public/icons/*`, `src/app/icon.png`, Android `mipmap-*` |
| `logo-clean.png` | Bản đã xử lý: nền trắng tinh, vuông 1:1, canh giữa | Tài liệu HDSD/Flow (`docs/reports/_src/*.html`) |
| `brand-sheet.png` | Brand sheet gốc 1024² (mark + wordmark + evolution + màu) | Tham chiếu thiết kế; nguồn crop ra `logo-clean.png` |

## Sinh lại icon app

```bash
npm run icons    # brand/logo-sdfish.png -> public/icons + src/app + android mipmap
```

⚠️ Sau `npx cap add android` **phải** chạy lại — nếu không launcher giữ icon Capacitor mặc định (chữ X), lệch store listing → Google flag "Misleading Claims".
