# SDFish 🐟

App đồng hành của ngư dân Việt Nam (do **SDVICO** đặt hàng). Mobile-first, tiếng Việt đời thường, cho người dùng ít rành công nghệ. Sản phẩm xoay quanh **bốn lời hứa với bà con** — không phải feature, không phải nguồn dữ liệu.

> **Lời hứa ≠ route**: điều hướng theo đối tượng (dock: **Trang chủ · Ra khơi · Tàu cá · Bạn thuyền · Giao dịch**), không phải 1 route cho 1 trục.

| Trục | Lời hứa | Ở đâu | Có gì |
|---|---|---|---|
| 1 · 🎯 Đánh bắt tốt hơn | `/ngu-truong` | Bản đồ ngư trường vệ tinh (nhiệt độ/phù du/độ sâu/phao đèn) + gió sóng mưa dông Open-Meteo (10 cảng) + **tin bão Biển Đông** + **dẫn đường tiết kiệm dầu** (né sóng gió, ước tính lít dầu) + **lớp vùng biển VMS**. **Premium**: dự báo cá + thời tiết >3 ngày |
| 2 · 💰 Bán được đắt hơn | `/tien` (khu Giao dịch) | Bảng giá cá/dầu tham khảo + **chợ tin mua/bán** (`market_listings`) + danh bạ chỗ bán |
| 3 · ⚙️ Vận hành rẻ hơn | `/tau` (tab Dịch vụ / Sản phẩm) | Nhắc bảo dưỡng + **danh mục sản phẩm/vật tư** (admin quản lý trực tiếp, không cần build lại) |
| 4 · 📋 Tuân thủ dễ hơn | `/tau` (tab Giấy tờ) + `/nguoi` | Tủ giấy tờ số hóa + nhắc hạn + **sổ thuyền viên** (định danh **CCCD** + tra **cảnh báo chéo** giữa các chủ tàu, premium) |

> **Đã tinh gọn 2026-07-27/28**: `/tien` bỏ sổ lãi/lỗ, công nợ, chia tiền chuyến (về đúng việc mua–bán); `/tau` bỏ tab Mức phạt + Checklist xuất bến. Thuyền viên chuyển sang mô hình định danh CCCD (không dính tiền ứng/chia).

**Tính năng nền:**
- 🔔 **Thông báo (Web Push qua PWA)**: bà con tự bật ở sheet Tài khoản; admin gửi per-user hoặc broadcast — không cần cập nhật app store.
- 🛠️ **Web quản trị `/quan-tri`**: giao diện độc lập (desktop) — quản lý tài khoản, cấp/gia hạn **premium**, danh mục sản phẩm, gửi thông báo, kiểm duyệt cảnh báo thuyền viên. Xem [Đăng nhập quản trị](#web-quản-trị-quan-tri).
- 🔒 **Premium** (`customers.tier`): gán qua webhook SDWork hoặc `/quan-tri`; chặn thật ở middleware (`src/lib/tier.ts`).
- 📄 **Chính sách quyền riêng tư** công khai tại `/quyen-rieng-tu` (bắt buộc cho App Store).

## Tech stack

- **Next.js 16** App Router + TypeScript · **Tailwind v4** (tokens ở `src/app/globals.css` qua `@theme`)
- **Supabase** (Postgres + Auth, RLS owner-only) — không cấu hình env → **demo mode** (localStorage)
- **MapLibre GL** (lazy-load) — bản đồ ngư trường · **Web Worker** — Dijkstra dẫn đường né sóng gió ở luồng nền
- **Web Push** (VAPID) — thông báo PWA · **Vitest** — test logic `src/lib/`
- Deploy: **Vercel** · **PWA cài được** (manifest/SW/icons) · **Capacitor** (iOS/Android) — xem [ops/native-deploy.md](docs/app-map/ops/native-deploy.md) + [ops/build-publish-store.md](docs/app-map/ops/build-publish-store.md)

## Bắt đầu

```bash
npm install
cp .env.local.example .env.local   # điền khóa Supabase + (tùy chọn) ADMIN_PHONES, VAPID
npm run dev                        # http://localhost:3000
```

Chưa cấu hình Supabase? App vẫn chạy ở **demo mode** — dữ liệu lưu trên máy (localStorage `forfish.*`) với dữ liệu mẫu, xem/demo ngay.

## Cấu trúc thư mục chính

```
src/
  app/
    page.tsx            # Trang chủ — bốn trục + nhắc việc gấp
    ngu-truong/         # Trục 1 — bản đồ ngư trường, gió sóng, dẫn đường, VMS
    tien/               # Trục 2 — khu Giao dịch (giá + chợ mua/bán)
    tau/                # Trục 3 & 4 — tàu: Giấy tờ / Dịch vụ / Sản phẩm
    nguoi/              # Trục 4 — sổ thuyền viên (CCCD + cảnh báo chéo)
    quan-tri/           # Web quản trị (staff, giao diện độc lập)
    quyen-rieng-tu/     # Chính sách quyền riêng tư (công khai)
    login/ dang-ky/     # Đăng nhập bằng SĐT + mật khẩu
    api/                # Proxy nguồn ngoài + Supabase + admin + webhook SDWork
  components/           # UI (fishing-map, trade-hub, crew-list, hero-account…)
  lib/                  # Logic thuần (có test): tier, storms, route-plan, push-client…
supabase/migrations/    # Schema + RLS (0001…0018)
docs/app-map/           # Hồ sơ canonical cho người + AI — đọc README.md trong đó trước
```

> **Thiết kế cho ngư dân 40–60 tuổi**: chữ cơ bản ≥18px, nút bấm ≥56px, nhãn = biểu tượng + 2–3 từ, màu trạng thái rõ (đỏ/vàng/xanh). Chi tiết: [03-design-system.md](docs/app-map/03-design-system.md).

## Web quản trị `/quan-tri`

Giao diện **độc lập** (desktop, không dock, không link trong app — gõ URL trực tiếp `<domain>/quan-tri`).

**Đăng nhập** (không có form riêng — dùng chung phiên đăng nhập app):
1. Set env **`ADMIN_PHONES`** trên Vercel = SĐT admin (nhiều số ngăn bằng dấu phẩy), ví dụ `0909123456,0912345678`.
2. SĐT đó phải có tài khoản SDFish (tạo ở `/dang-ky` hoặc do SDWork cấp).
3. Vào `<domain>/login`, đăng nhập bằng **SĐT + mật khẩu**.
4. Mở `<domain>/quan-tri`.

**Hai nấc quyền** (`src/lib/admin-auth.ts`):
- **admin** — SĐT trong `ADMIN_PHONES`: toàn quyền (tạo/xóa tài khoản, cấp/hạ premium, danh mục sản phẩm, thông báo, duyệt cảnh báo).
- **quản lý** (`customers.role='manager'`, do admin gán): chỉ **cấp/gia hạn premium**.

Chưa set `ADMIN_PHONES` → không ai là admin (trang báo 403).

## Deploy & phát hành

- Web: push `main` → Vercel tự deploy (`forfish-alpha.vercel.app`; đang chuyển sang `sdfish.sdvico.vn`).
- iOS/Android: Capacitor wrap, `server.url` trỏ deploy sdvico. Runbook đầy đủ: [ops/build-publish-store.md](docs/app-map/ops/build-publish-store.md).

---

**Repo**: `sdvico/forfish` + `hoainxm/forfish` (đồng bộ tính năng từ upstream `Long-Forfun/ForFish`). Mọi số liệu giá cả, dự báo biển đều là **tham khảo**.
