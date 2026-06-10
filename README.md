# ForFish 🐟

App đồng hành của ngư dân, cấu trúc quanh **bốn lời hứa với bà con**:

| Trục | Lời hứa | Trạng thái |
|------|---------|-----------|
| 1 · 🎯 Đánh bắt tốt hơn | Ra khơi trúng hơn, đỡ phí dầu phí công | Sắp ra mắt |
| 2 · 💰 Bán được đắt hơn | Cá về bờ bán được giá, không bị ép | Sắp ra mắt |
| 3 · ⚙️ Vận hành rẻ hơn | Giữ tàu chạy bền, tốn ít tiền hơn | Sắp ra mắt |
| 4 · 📋 Tuân thủ dễ hơn | Lo giấy tờ nhẹ đầu, tránh bị phạt oan | **Bản đầu (MVP)** |

> Mọi nguồn dữ liệu (OceanByte, SDWork, kho văn bản) chỉ là phương tiện. Lời hứa với bà con thì không đổi.

Trục 4 được làm trước vì không phụ thuộc dữ liệu bên ngoài — đúng theo thứ tự ưu tiên trong tài liệu định hướng sản phẩm.

## Tech stack

- **Next.js 16** (App Router, TypeScript) + **Tailwind CSS v4**
- **Supabase** (Postgres + Auth) — qua biến môi trường
- Deploy: **Vercel**
- Giao diện **mobile-first**, tiếng Việt

## Bắt đầu

```bash
npm install
cp .env.local.example .env.local   # rồi điền NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev                        # http://localhost:3000
```

Chưa cấu hình Supabase? App vẫn chạy ở **chế độ thử nghiệm** — Tủ giấy tờ lưu dữ liệu trên máy (localStorage) với dữ liệu mẫu, để xem và demo ngay.

## Cấu trúc

```
src/
  app/
    page.tsx            # Trang chủ — bốn trục + nhắc việc gấp
    giay-to/            # Trục 4 — Tủ giấy tờ (MVP có thật)
    ngu-truong/         # Trục 1 — placeholder
    gia-ca/             # Trục 2 — placeholder
    van-hanh/           # Trục 3 — placeholder
  components/
    bottom-nav.tsx      # Điều hướng dưới cùng (nút lớn cho tay ướt)
    page-header.tsx     # Header sóng biển dùng chung
    document-vault.tsx  # Tủ giấy tờ: thêm/sửa/xóa + trạng thái hạn
    coming-soon.tsx     # Khung trang "sắp ra mắt"
  lib/
    documents.ts        # Logic loại giấy tờ + tính trạng thái hết hạn
    supabase/           # client (browser) + server helpers
supabase/
  migrations/
    0001_init.sql       # boats + documents + RLS (đã áp lên project)
docs/
  app-map/              # Hồ sơ canonical cho người + AI (đọc README.md trong đó trước)
```

> **Thiết kế "Sơn thuyền"** cho ngư dân ít rành công nghệ: chữ cơ bản ≥18px, nút bấm ≥56px, nhãn = biểu tượng + 2-3 từ, màu trạng thái rõ (đỏ/vàng/xanh), font Baloo 2 + Be Vietnam Pro. Chi tiết: `docs/app-map/03-design-system.md`.

## Bước tiếp theo

- [x] Áp schema lên Supabase project (boats, documents, RLS)
- [ ] Đăng nhập bằng OTP số điện thoại (Supabase Auth)
- [ ] Chuyển Tủ giấy tờ từ localStorage sang Supabase
- [ ] Nhắc hạn qua thông báo đẩy / Zalo
- [ ] Trục 4: trợ lý hỏi đáp quy định (kho văn bản pháp luật)
- [ ] Trục 3: chợ vật tư nối SDWork
