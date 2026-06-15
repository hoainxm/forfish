# 07 — DESIGN-SPEC: thang user, screen map, budget, trạng thái

> **Load khi**: task chạm UI / screen / component / flow / style. Đây là chốt chặn của pipeline ui-design-logic — sửa UI thì đọc file này TRƯỚC, đổi hành vi/cấu trúc UI thì cập nhật file này CÙNG COMMIT.

```
covers: src/app, src/components
last_verified: 2026-06-11
ttl_days: 90
gate: warn   # UI churn cao — cảnh báo thay vì chặn
```

Doc này authored bằng tay (reverse-engineer từ code 2026-06-11). Không trộn nội dung token (xem [03-design-system.md](03-design-system.md)) hay route map đầy đủ (xem [02-architecture.md](02-architecture.md)).

---

## 1. Người dùng & nhiệm vụ

- **User chính**: chủ tàu / ngư dân Việt 40–60 tuổi, ít rành công nghệ, đọc ngoài nắng, tay ướt. MỘT vai trò (B2C) — KHÔNG có admin/staff/role, nên không có biến thể theo role, chỉ biến thể theo VÒNG ĐỜI đăng nhập.
- **Job hằng ngày**: trước/trong/sau chuyến biển — coi gió sóng + dự báo cá, giữ giấy tờ khỏi quá hạn, ghi lãi lỗ & chia tiền bạn thuyền, hỏi/được SDVICO hỗ trợ.
- **Platform**: mobile-first tuyệt đối (cột ≤480px, dock nổi). Desktop = cùng cột mobile căn giữa, KHÔNG có layout desktop riêng.
- **Brand**: SDVICO (commissioned). ForFish là kênh CSKH + giá trị vượt trội cho bà con.

## 2. Thang người dùng (3 câu cho từng bậc)

| Bậc | Muốn thấy gì | Sản phẩm truyền tải | Thúc đẩy action tiếp |
|---|---|---|---|
| **Public / chưa đăng nhập** | Dùng được NGAY: giá cá, bản đồ gió sóng, tra phạt, sổ tay (localStorage) | "App này lo được việc của bà con, không cần đăng ký mới xài" | 1 lời mời đăng nhập bằng SĐT — KHÔNG chặn cửa |
| **Đã đăng nhập, chưa khớp đơn SDVICO** (`unlinked`) | Đồ tự ghi + lời mời "mua hàng là đồ tự hiện" | "Tài khoản đã sẵn, mua hàng SDVICO là nối luôn" | Gọi SDVICO tư vấn / mua |
| **Khách SDVICO đã đồng bộ** (`ok`) | Đồ đã mua, bảo hành sắp hết, dịch vụ, **nợ/cước** | "Mọi thứ bà con mua đều theo dõi giúp" | Gọi bảo hành/đóng cước, mua thêm vật tư |

**Quy tắc đã áp dụng:**
- Tối đa **1 nudge đăng nhập/màn**: chip hero "Đăng nhập", thẻ khóa dự báo cá (teaser), gate "Ai cần mua". KHÔNG spam.
- Tính năng KHÓA chỉ gồm: **dự báo cá chi tiết** (heatmap hiện cho mọi người làm mồi, chi tiết điểm mới gate) và **nhu cầu mua cá** (mở public chừng nào còn TIN MẪU). Còn lại public.
- Lỗi đồng bộ KHÔNG được hiện thành "đăng nhập đi" với người đã đăng nhập — `useSdvicoAssets` phân biệt `guest/unlinked/error/ok` (nấc `error` có nút Thử lại).

## 3. Object model

| Object | List | Detail | Form | Màn sinh ra |
|---|---|---|---|---|
| Chuyến biển | sổ lãi/lỗ + báo cáo năm + máy tính tổn | — | drawer (≤5 field) | trong /tien tab Hiệu quả (4 chip: Sổ lãi/lỗ · Báo cáo năm · Tính chuyến · Chia tiền) |
| Bạn thuyền | sổ thuyền viên | sổ ứng (sheet) | drawer | /nguoi |
| Giấy tờ tàu | list | — | drawer | /tau tab Giấy tờ |
| Sản phẩm/Dịch vụ SDVICO | list (sync read-only + tự ghi) | — | drawer (đồ tự ghi) | /tau tab Sản phẩm/Dịch vụ |
| Điểm ngư trường / của tôi | map + sheet | peek sheet | sheet | /ngu-truong |
| Giá cá / Nhu cầu mua | list | — | — | /tien tab Giao dịch |
| Mức phạt | searchable list | — | — | /tau tab Mức phạt |
| Công nợ (chủ nợ) | list theo chủ nợ | sổ vay/trả (sheet) | drawer | /tien tab Công nợ |

→ 8 object. Tạo/sửa đều ≤5 field nên dùng **drawer/bottom-sheet**, KHÔNG đẻ page riêng (quyết định đã chốt).

## 4. Nav model

- **Mobile bottom dock (5)**: Trang chủ · Ra khơi · Tàu · Bạn thuyền · Tiền — đúng trần M3 = 5, taxonomy MECE theo đối tượng. Item ≥3.75rem, icon + chữ.
- **Tab trong page**: /tau = 4 tab (Giấy tờ/Dịch vụ/Sản phẩm/Mức phạt); /tien = 3 tab (Giao dịch/Hiệu quả/Công nợ). Trong tab dùng `ChipRow` (≤3 tier: Tabs → chip1 → chip2). KHÔNG tab lồng tab.
- Route phụ (`/cang`, `/login`, `/dang-ky`, `/doi-mat-khau`) vào từ ngữ cảnh, không nằm trên dock. Route cũ (`/gia-ca`, `/giay-to`, `/van-hanh`, `/thuyen-vien`) = redirect 1 dòng sang trục mới.

## 5. Screen map + density budget

| # | Màn | Vào từ | User đến để | Step tiếp mong muốn | Primary | Density |
|---|---|---|---|---|---|---|
| 1 | Trang chủ `/` | dock, login | Coi việc cần làm ngay trong 5 giây | chạm việc khẩn / 1 trong 4 trục | (không — màn điều hướng) | M |
| 2 | Ra khơi `/ngu-truong` | dock | Coi gió sóng + dự báo cá chỗ định đi | dẫn đường / ghim điểm | "Dẫn đường tới chỗ này" | H (map ≥60%) |
| 3 | Tàu `/tau` | dock, nhắc `?tab=` | Coi **đủ điều kiện xuất bến chưa** (đèn xanh-đỏ + **mốc khai báo eCDT/NKKT** đầu tab Giấy tờ) + giữ giấy tờ + đồ SDVICO | xử việc đỏ (thiếu giấy/quá hạn/nợ) | theo tab | M |
| 4 | Bạn thuyền `/nguoi` | dock | Quản hồ sơ + sổ ứng | thêm bạn / gạch nợ | "Thêm bạn thuyền" | M |
| 5 | Tiền `/tien` | dock | Bán có lợi + lãi/lỗ rõ | ghi chuyến / chia tiền | "Ghi chuyến biển mới" | M |
| 6 | Cảng `/cang` | nút trên map | Tìm cảng chỉ định gần | gọi/chỉ đường | (đọc) | M |
| 7 | Đăng nhập `/login` | chip hero, gate | Vào bằng SĐT | (vào app) | "Đăng nhập" | L |

Mobile M = ≤3 khối/viewport. Home: dải khẩn + lưới 4 trục + tagline = đạt. /tien, /tau, /nguoi: 1 hàng chip/tab + list — đạt.

## 6. Ma trận trạng thái (đã hiện thực)

| Màn | Chưa login | Trống | Lỗi/mạng yếu | Đang tải |
|---|---|---|---|---|
| Ra khơi | dự báo cá teaser + mời; gió sóng public | điểm: "chạm biển để xem" | scalar/lưới/cá: nút **Thử lại** (không hỏng câm) | "Đang lấy dự báo…" |
| Tàu | tab Sản phẩm/Dịch vụ: `guest` mời đăng nhập | "Chưa có … bấm nút cam" | `error` → Thử lại; `unlinked` → giải thích | "Đang kiểm tra đồ SDVICO…" |
| Bạn thuyền | public; sổ MẪU tự xưng "sổ mẫu" | empty + nút cam | — | hydrate sau mount |
| Tiền (Chia) | public | chưa có bạn thuyền → EmptyState + link /nguoi | — | — |
| Đăng nhập | — | — | "Sai SĐT/mật khẩu"; gateway timeout 8s | nút "Đang vào…" |

## 7. Action → Expectation (đã hiện thực)

| Hành động | Thấy ngay sau đó |
|---|---|
| Ghi chuyến biển | sổ có dòng mới + thẻ "Nhìn nhanh" cập nhật tức thì (một nguồn `trips`) |
| Bấm "Chia tiền" trên thẻ chuyến | sang tab Chia tiền, số đã đổ sẵn (sửa được) |
| Xóa điểm ghim / chuyến / sản phẩm | xác nhận inline / ConfirmDialog (KHÔNG xóa 1 chạm) |
| Gạch nợ ứng | ConfirmDialog nêu rõ số tiền |
| Gửi yêu cầu SDVICO | "Đã gửi" + mục "Yêu cầu đã gửi" hiện ngay (optimistic) |
| Đổi điểm xem trên map khi đang có tuyến | tuyến CŨ giữ nguyên + dải nhắc "tới chỗ chạm trước" + Xóa tuyến |

## 8. Quyết định đã chốt (không hỏi lại)

- Tạo/sửa mọi object → **drawer/bottom-sheet**, không page riêng.
- Cỡ giao diện mặc định **theo máy** (rem); chỉnh tay ("Chữ to"/"Gọn") trong **sheet tài khoản**, không bày toggle ra hero.
- Ngôn ngữ status DUY NHẤT = `StatusBanner`; màu cam-đỏ ĐỘC QUYỀN cho ranh giới biển trên map.
- Demo/sổ mẫu KHÔNG ghi xuống máy, KHÔNG lọt vào dải nhắc khẩn.
- Visual "international" (font Plus Jakarta Sans + Archivo) nhưng COPY tiếng Việt đời thường.

## 9. Trạng thái audit ui-design-logic (2026-06-11)

- **Contrast AA**: đã quét computed-style 6 màn (home, /ngu-truong, /tau, /nguoi, /tien, /login, /cang) → **0 lỗi <4.5:1**. Sàn neutral text = `/65`; accent text/fill kiểm cả 2 chiều (t3 đậm về `#8f6010`).
- **`tabular-nums`**: đã phủ MỌI cột/figure số: giá cá, chia tiền (per-member), sổ lãi/lỗ, sổ ứng (lịch sử + tổng), nhìn nhanh, thẻ tổng quan bạn thuyền (3 ô), cột điểm + sóng/gió `sea-forecast`.
- Tên trục ở Home ("Tàu của tôi", "Sổ tiền") khác nhãn dock ("Tàu", "Tiền") — cố ý (dock cần ngắn), giữ nguyên.
- Lint `set-state-in-effect`: pattern hydrate-on-mount cố ý → rule đã tắt có chủ đích (commit 76acf4f).

---

**Last updated**: 2026-06-11
<!-- re-verified: 2026-06-11 — screen map khớp routes; contrast AA pass home/nguoi/tau (eval) -->
