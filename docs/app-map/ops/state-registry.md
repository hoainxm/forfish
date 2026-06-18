# Ops — State Registry — ForFish

> Load khi: đọc/ghi/sửa state phía client, hoặc debug "dữ liệu mất / sai / không lưu". Mọi key `forfish.*` trong localStorage liệt kê ở đây.

covers: src/lib/boats.ts, src/lib/debts.ts, src/lib/region.ts, src/lib/places.ts, src/lib/sea.ts
last_verified: 2026-06-16
ttl_days: 180
gate: warn

> Registry CANONICAL cho state client (nguyên tắc 11 §state). **State không có trong bảng này = coi như không tồn tại — KHÔNG đoán schema.** ForFish chạy Vercel serverless + demo mode → "state nền" duy nhất là localStorage của trình duyệt (prefix `forfish.*`, GIỮ tên cũ — đổi sẽ mất dữ liệu user). Khi đã đăng nhập Supabase, nguồn sự thật là DB (xem [04-data-model](../04-data-model.md)); localStorage là fallback demo mode (xem [02-architecture §4](../02-architecture.md)).

**Last updated**: 2026-06-16

---

## Bảng localStorage `forfish.*`

| Key | Nội dung | Writer (module ghi) | Reader chính | Trục | Reset |
|---|---|---|---|---|---|
| `forfish.displaymode.v1` | Chế độ hiển thị (sáng/tối) | `components/hero-account.tsx` + boot script `app/layout.tsx` | `globals.css`, `layout.tsx` | chung | xoá key → về mặc định theo hệ |
| `forfish.boats.v1` | Danh sách tàu | `lib/boats.ts` | toàn app | chung | xoá → trống, tạo lại tàu |
| `forfish.currentBoat.v1` | Tàu đang chọn | `lib/boats.ts` | toàn app | chung | xoá → chọn tàu đầu |
| `forfish.boat.v1` | Tàu cho dẫn đường (route planner) — **khác `boats.v1`** | `components/route-planner.tsx` | route-planner | 1 | xoá → nhập lại thông số |
| `forfish.home.v1` | Vùng/quê nhà đã chọn | `lib/region.ts` | `ui/region-filter.tsx` | chung | xoá → hỏi lại vùng |
| `forfish.places.v1` | Địa điểm đã lưu | `lib/places.ts` | nơi dùng places | 1 | xoá → trống |
| `forfish.port.v1` | Cảng đang chọn (dự báo) | `components/sea-forecast.tsx` | sea-forecast | 1 | xoá → cảng mặc định |
| `forfish.maplayer.v1` | Lớp bản đồ đang bật | `components/fishing-map-view.tsx` | fishing-map-view | 1 | xoá → lớp mặc định |
| `forfish.sea.<port>` | **Cache** dự báo biển theo cảng (prefix) | `lib/sea.ts` | sea-forecast | 1 | xoá an toàn (chỉ cache, TTL 6h) |
| `forfish.products.v1` | Đồ/vật tư của tàu | `components/boat-products.tsx` | van-hanh | 3 | xoá → trống |
| `forfish.maintenance.v1` | Nhắc bảo dưỡng | `components/maintenance-reminders.tsx` | + `urgent-strip.tsx` | 3 | xoá → mất lịch nhắc |
| `forfish.crew.v1` | Danh sách thuyền viên | `components/crew-list.tsx` | + `urgent-strip.tsx` | 3 | xoá → trống |
| `forfish.debts.v1` | Sổ lãi lỗ chuyến biển | `components/debt-ledger.tsx` (+ `lib/debts.ts`) | gia-ca | 2 | xoá → **mất sổ — backup trước** |
| `forfish.buyers.v1` | Danh bạ thương lái | `components/sell-guide.tsx` | gia-ca | 2 | xoá → trống |
| `forfish.trips.v1` | Nhật ký chuyến biển | `components/trip-report.tsx`, `trip-log.tsx` | gia-ca, van-hanh | 2 | xoá → **mất nhật ký — backup trước** |
| `forfish.documents.v1` | Tủ giấy tờ (loại, hạn) | `components/document-vault.tsx` | + `urgent-strip.tsx` | 4 | xoá → **mất hồ sơ — backup trước** |

> `urgent-strip.tsx` là reader chéo: đọc `documents` + `maintenance` + `crew` để hiện cảnh báo gần đến hạn.

## Quy tắc (governance)

1. **Single writer** — mỗi key chỉ ghi qua module ở cột Writer, không `setItem` raw rải rác. Thêm chỗ ghi mới phải đi qua module đó.
2. **Versioned key** — đuôi `.v1`. Đổi schema không tương thích → **bump `.v2`** + viết migrate từ v1, KHÔNG ghi đè câm lên v1.
3. **GIỮ prefix `forfish.`** — hạ tầng cũ (xem [CLAUDE.md](../../../CLAUDE.md)); đổi `forfish.`→`sdfish.` sẽ làm user mất hết dữ liệu.
4. **Backup trước thao tác tay** với 4 key đánh dấu "backup trước" (debts/trips/documents) — đây là dữ liệu user gõ tay, không tái tạo được.
5. **Thêm state mới = thêm 1 dòng bảng này CÙNG COMMIT** với code (nguyên tắc 4 doc+test sync). State thiếu trong bảng = không tồn tại.

## Liên quan

- DB thật (khi đăng nhập): [04-data-model.md](../04-data-model.md)
- Demo mode fallback: [02-architecture.md](../02-architecture.md) §4
- Service ngoài (nguồn fill cache): [external-services.md](external-services.md)
