# SDFish 🐟

App đồng hành của ngư dân Việt Nam, do **SDVICO** đặt hàng. Thiết kế cho điện thoại trước, viết tiếng Việt đời thường, dễ dùng với người ít rành công nghệ. Sản phẩm xoay quanh **bốn lời hứa với bà con**: đánh bắt tốt hơn, bán được đắt hơn, vận hành rẻ hơn, tuân thủ dễ hơn.

> Tên app là **SDFish** (đọc "ét đê fish"; mã app `vn.sdvico.sdfish`, web `sdfish.sdvico.vn`). **ForFish** chỉ là tên repo; các định danh hạ tầng `forfish.*` giữ nguyên.
>
> README này viết lại ngày 2026-11-06 theo **code thật**, không chép từ doc cũ. Một team 4 agent đọc `src/` và chấm từng tính năng; bảng điểm ở dưới.

## Điều hướng theo vai

Thanh dưới (dock) **chỉ có biểu tượng**; tên mục nằm ở `aria-label`. Các ô thay đổi theo **vai** bà con chọn ở `/chon-vai` (`src/lib/dock-nav.ts`, `src/lib/vai.ts`):

| Vai | Dock |
|---|---|
| Chủ tàu / chưa chọn vai / khách | Trang chủ · Kairos · Bản đồ · Tàu tôi · Chợ cá · Vật tư |
| Đi bạn | Trang chủ · Kairos · [Bản đồ] · **Việc làm** · Chợ cá · Vật tư |
| Thu mua | Trang chủ · Kairos · [Bản đồ] · Chợ cá (mở thẳng tin mua bán) · Vật tư |
| Đại lý | Trang chủ · Kairos · [Bản đồ] · **Bán hàng** · Vật tư |

- `[Bản đồ]` nghĩa là ô này chỉ hiện khi tài khoản có gói dự báo.
- Bà con tự chọn được hai vai: Đi bạn và Chủ tàu. Vai Thu mua và Đại lý do nhân viên gán ở `/quan-tri`.
- Đã chọn vai thì không đổi được nữa.
- Trang chủ cũng khác nhau theo vai, xem `components/home-theo-vai.tsx`.

## Tính năng thật và mức độ hữu ích

**Cách chấm điểm:**
- **TI** (tiện ích) và **NC** (nhu cầu của ngư dân 40–60 tuổi) chấm thang 1–5.
- Gói: **Khách** = chưa đăng nhập. **Free** = tài khoản thường. **Gói** = gói dự báo (premium).
- Cột **Mất sóng**: tính năng có dùng được khi ra khơi không có sóng hay không.

### Biển và bản đồ (`/`, `/ngu-truong`, `/hai-do`, `/lo-trinh`, `/cang`)

| Tính năng | Gói | TI | NC | Mất sóng |
|---|---|---|---|---|
| Tin bão Biển Đông trên Trang chủ (GDACS). App không bao giờ báo "không bão" khi chưa hỏi được nguồn | Khách | 5 | 5 | ✔ bản lưu kèm tuổi tin |
| Biển hôm nay và Con nước ở cảng nhà (Open-Meteo, tính con nước trong máy). Tài khoản có máy S-Tracking được **tự gắn cảng nhà** theo số tàu | Khách | 5 | 5 | ✔ |
| Bản đồ nền, nhãn chủ quyền, phao đèn, độ sâu, chất đáy, cảnh báo sắp vượt ranh giới (có loa đọc) | Free | 5 | 5 | ✔ |
| Chạm vào biển để xem gió, sóng, con nước, trăng của hôm nay | Free | 5 | 5 | một phần |
| Ô "Đi đâu?" (tìm cảng / điểm lưu / toạ độ), giữ tay để lưu điểm | Free | 4 | 5 | ✔ |
| **Dự báo cá** (ảnh vệ tinh NOAA + bãi cá theo mùa, chọn nghề hoặc ≤3 loài) | Gói | 5 | 5 | ✔ bản lưu |
| **Dẫn đường tiết kiệm dầu** (tránh sóng gió, ước giờ chạy và lít dầu) | Gói | 5 | 4 | tuyến đã tính |
| Thời tiết nhiều ngày (tới 16 ngày), lớp gió/sóng/mưa/dông, chạy thử theo giờ | Gói (free chỉ xem hôm nay) | 4 | 4 | ✔ tự tải sẵn mỗi 6 giờ |
| Chuyến biển `/lo-trinh`: lộ trình nhiều ngày, lượng dầu, lúc nên về | Gói | 4 | 3 | ✔ |
| Lớp vệ tinh (nước nóng lạnh, vùng nhiều mồi), độ mặn, dòng chảy tầng sâu | Gói | 3–4 | 2–3 | chưa xác minh |
| Hải đồ kiểu máy `/hai-do` (đo, canh neo, người rơi xuống biển, vết tàu) | Free | 4 | 4 | ✔ |
| Danh bạ cảng `/cang` (đặt cảng nhà) | Khách | 3 | 3 | ✔ |
| Tàu AIS quanh mình, mật độ tàu | ẨN sau cờ | — | — | — |

### Tàu tôi và tuân thủ (`/tau`, `/nguoi`, `/viec`, `/kairos`)

| Tính năng | Gói | TI | NC | Mất sóng |
|---|---|---|---|---|
| Hồ sơ nhiều tàu (thêm/sửa, nhập bằng giọng nói) | Free | 4 | 4 | ✔ |
| **Tủ giấy tờ**: nhập tay, **chụp giấy để máy GPU đọc hạn**, nhắc hạn (lúc mở app + thông báo đẩy) | Free | 5 | 5 | ✔ (chụp/đọc cần sóng) |
| **Xuất trình** giấy cho cán bộ: toàn màn hình, giữ sáng | Free | 5 | 5 | ✔ |
| **Giám sát hành trình S-Tracking**: hạn cước, mất tín hiệu, cảnh báo, nút "Nghe" để Sen Biển đọc | Free | 5 | 5 | ✔ bản lưu |
| Gia hạn cước S-Tracking trong app (mã QR) | Free, sau cờ máy chủ | 4 | 5 | ✘ |
| Sổ nhắc bảo dưỡng, đồ tự ghi, thiết bị mua ở SDVICO | Free | 3–4 | 3 | ✔ |
| Sổ bạn thuyền (căn cước, chứng chỉ, bảo hiểm) | Free | 4 | 4 | ✔ |
| Tra **cảnh báo chéo** bạn thuyền giữa các chủ tàu | Gói | 4 | 3 | ✘ |
| Việc làm `/viec`: tìm tàu, tìm người, hồ sơ tìm tàu, tuyển người, giấy tờ của tôi | Free | 3 | 3–4 | bản lưu |
| Kairos: dòng tin nghề cá, tab Chính sách (tin `.gov.vn`, lọc theo tỉnh, tra danh sách) | Free | 4 | 4 | bản lưu |
| Số khác của tôi (≤3 số mua hàng, nhân viên duyệt) và Dịch vụ SDVICO | Free | 3 | 3–4 | ✘ |

### Mua bán (`/tien`, `/cho`, `/ban-hang`)

| Tính năng | Gói | TI | NC | Mất sóng |
|---|---|---|---|---|
| Giá cá tại bến theo tuần (VASEP) kèm biểu đồ, giá dầu DO hôm nay | Khách | 4 | 5 | ✔ |
| Chợ tin mua/bán cá (`market_listings`, không còn tin mẫu) | Free | 3 | 4 | xem bản gần nhất |
| Đầu mối: nậu vựa, chợ sỉ, nhà máy, mối quen; nút gọi và nhắn Zalo | Free | 4 | 4 | ✔ |
| Vật tư `/cho`: sàn nhiều đại lý, giỏ hàng, trả tiền mặt hoặc chuyển khoản, đơn hàng (gộp cả đơn SDVICO), nhờ tìm món | Khách xem, Free đặt | 4 | 4 | một phần |
| Kênh người bán `/ban-hang` (vai Đại lý): mở gian hàng, quản lý món, xử lý đơn, báo giá | Free | 2 | 2 | ✘ |
| Hồ sơ vựa `/tien/vua` (vai Thu mua) | Free | 2 | 2 | ✘ |

### Nền tảng

| Tính năng | TI | NC | Ghi chú |
|---|---|---|---|
| **Sen Biển**: trợ lý nói và nhắn | 4 | 4 | Trả lời ngay trong máy trước; không trả lời được thì hỏi "máy nhà" (Gemma trên GPU) và đọc bằng giọng Mỹ Duyên |
| Đăng nhập bằng SĐT + mật khẩu | 4 | 5 | Sau đó máy giữ một **chuỗi thiết bị** vĩnh viễn. Mỗi số chỉ dùng trên một máy |
| Thông báo đẩy (bão, hạn giấy, đơn hàng, giám sát hành trình) | 5 | 5 | Web Push qua VAPID |
| Cài app về máy (PWA) và dùng khi mất sóng | 5 | 5 | Service worker `sdfish-v6`, tự tải sẵn dữ liệu đi biển |
| Cỡ giao diện: Gọn / Nút to / Theo máy | 4 | 4 | Trong Tài khoản › Cài đặt |
| Web quản trị `/quan-tri` | — | — | Cho nhân viên SDVICO |

**Không quay video và chưa nên quảng bá:**
- Nút "Hỏi mua" của `SdvicoCatalog`: component này không được gắn vào màn nào.
- Chế độ AIS toàn biển và "Mật độ tàu dự kiến": đang ẩn sau cờ.

## Video hướng dẫn

Chín video, mỗi video 1–2,5 phút:
- Giọng đọc **Mỹ Duyên** (VieNeu chạy trên máy GPU), có phụ đề cứng và kèm file `.srt`.
- Quay trên **màn hình và dữ liệu thật** của production, dùng các tài khoản test `0900000780`–`0900000784` (khai trong `scripts/test-accounts.json`).

| # | Video | Tài khoản |
|---|---|---|
| 1 | Chủ tàu — dùng cơ bản | thường, vai Chủ tàu |
| 2 | Chủ tàu — tính năng nâng cao | gói dự báo |
| 3 | Đi bạn — tìm tàu, giữ giấy tờ | vai Đi bạn |
| 4 | Thu mua — tìm cá, đăng giá mua | vai Thu mua |
| 5 | Đại lý — mở gian hàng, bán vật tư | vai Đại lý |
| 6 | Bản đồ có gói dự báo (nước nóng lạnh, vùng nhiều mồi, gió sóng, dự báo cá, dẫn đường, 16 ngày) | gói dự báo |
| 7 | Cài SDFish về điện thoại: **Android** (Chrome thật, giả lập Android 15) + **iPhone** (Safari thật, iOS Simulator 27, giao diện tiếng Việt), PWA lưu dữ liệu thế nào | khách |
| 8 | Tàu quanh đây (AIS): giữ tay ~3 giây trên bản đồ ⇒ tàu trong 6 hải lý, 6 giờ qua, lọc + chi tiết từng tàu | gói dự báo |
| 9 | Kairos: dòng tin, nghe Sen Biển đọc, tải bài mang ra biển, tab Chính sách (lọc tỉnh, loại tin), bài luật kèm hạn giấy | thường |

Nhạc nền **tự tổng hợp** (`scripts/video-hdsd/nhac.mjs`: pad + arpeggio + tiếng sóng, không dùng bài có bản quyền), tự hạ khi có lời. Mỗi video có thêm bản `-khong-nhac.mp4` (chỉ giọng đọc): muốn nhạc thịnh hành thì chọn "âm thanh" ngay trong TikTok lúc đăng — bản quyền nhạc TikTok chỉ áp trong TikTok. Công cụ quay: [`scripts/video-hdsd/`](scripts/video-hdsd/README.md).

## Tech stack

- **Next.js 16.4** (App Router), **React 19.3**, **TypeScript 5.9**, **Node 24 LTS** (`engines` 24.x).
- **Tailwind v4**: token màu đặt trong `src/app/globals.css` qua `@theme`.
- **Supabase** (Postgres + Auth, RLS chỉ cho chủ dữ liệu), migration tới `0087`. Chưa cấu hình env thì app chạy **demo mode** bằng localStorage.
- **MapLibre GL 5** + **PMTiles** / Protomaps: luôn lazy-load. Tính đường dẫn chạy trong Web Worker.
- **Web Push** (VAPID).
- **Capacitor 8.5** cho iOS/Android: `server.url` trỏ `sdfish.sdvico.vn`.
- Test: **Vitest** cho `src/lib/`, **Playwright** cho e2e và quay video.

## Bắt đầu

```bash
npm install
cp .env.local.example .env.local   # điền khoá Supabase + (tuỳ chọn) ADMIN_PHONES, VAPID
npm run dev                        # http://localhost:3000
```

Các lệnh hay dùng:
- `npm test`: Vitest, chạy qua `scripts/run-vitest.mjs`.
- `npm run typecheck`: kiểm kiểu.
- `npm run lint`.
- `npm run build`: chạy `encode-data` rồi `next build`. Dữ liệu chỉ được mã hoá khi có `VERCEL=1` hoặc `SDFISH_ENCODE_DATA=1`.
- `node scripts/test-account.mjs ds | tao | cap | thu`: quản lý tài khoản test.

## Cấu trúc thư mục chính

```
src/
  app/
    page.tsx          # Trang chủ (theo vai)
    ngu-truong/       # Bản đồ: gió sóng, dự báo cá, dẫn đường
    hai-do/ lo-trinh/ cang/
    tau/ nguoi/       # Tàu tôi: giấy tờ, dịch vụ, giám sát hành trình, thiết bị · Bạn thuyền
    viec/             # Việc làm (đi bạn ↔ chủ tàu)
    kairos/ k/        # Tin tức, chính sách, cộng đồng
    tien/ gia-ca/     # Chợ cá: giá, mua bán, đầu mối (gia-ca chuyển hướng về tien)
    cho/ ban-hang/    # Vật tư (người mua) · Kênh người bán
    chon-vai/ login/ dang-ky/ quen-mat-khau/ doi-mat-khau/
    quan-tri/         # Web quản trị (desktop, độc lập)
    api/              # Proxy nguồn ngoài, me/*, stracking, admin, cron…
  components/         # UI
  lib/                # Logic thuần (có test): tier, vai, cang-nha, stracking, storms…
supabase/migrations/  # Schema + RLS (0001…0087)
docs/app-map/         # Hồ sơ dự án cho người và AI. Đọc README.md trong đó trước
```

> **Thiết kế**: mặc định là chế độ **Gọn**, bà con tự đổi sang "Nút to". Luật cũ "chữ ≥18px, nút ≥56px" đã bỏ từ 2026-10-19. Cỡ chữ theo thang Codex; nhãn nút tối đa 2 chữ, lấy từ `src/lib/labels.ts`. Xem [03-design-system.md](docs/app-map/03-design-system.md).

## Web quản trị `/quan-tri`

Giao diện **độc lập**: chạy trên desktop, không có dock, app không có link tới đây. Mở bằng cách gõ thẳng `<domain>/quan-tri`, rồi đăng nhập bằng phiên đăng nhập chung của app.

**Các khu chức năng:**
- Tổng quan
- Khách hàng: tài khoản, yêu cầu hỗ trợ, thông báo, việc làm
- Chợ vật tư: cửa hàng, sản phẩm, đơn
- Nội dung: điểm thu mua, thuyền viên, vùng biển, Kairos
- Nhân sự: phân quyền, nhật ký
- Hệ thống: dữ liệu, cấu hình, khoá máy thu S-Tracking

**Quyền** (`src/lib/admin-auth.ts`):
- **admin**: số nằm trong env `ADMIN_PHONES`, hoặc tài khoản trong `staff_accounts` có role admin.
- **quản lý**: dùng bảng quyền theo từng tab.

## Bản quyền & bảo vệ dữ liệu

**Bản quyền.** Phần mềm độc quyền của SDVICO, xem [LICENSE](LICENSE). Lớp dữ liệu OSM vẫn cấp bản rõ khi có người yêu cầu, theo ODbL §4.6.

**Dữ liệu phát ra ngoài.** Thư mục `public/data/` phát ra ngoài dưới dạng **bản mã**; trong git vẫn lưu bản rõ.
- **SDF1** (hoán vị byte): chỉ còn dùng cho `tide-stations`.
- **SDF2** (gzip + AES-256-CTR): mọi file khác. Khoá nằm ở `app_config`, app xin khoá qua `/api/data-key`.

**Cổng API** (`middleware.ts` → `dataGate`):
- Khách xem được tin bão, giá cá, giá dầu và thời tiết cảng **hôm nay**. Giới hạn theo IP.
- Lớp bản đồ cần tài khoản. Giới hạn theo SĐT.
- Cần gói dự báo: dự báo cá, thời tiết quá 1 ngày, dẫn đường, độ sâu EMODnet, độ mặn, dòng chảy tầng sâu.
- Với vai Đi bạn, Thu mua, Đại lý: cả bản đồ cũng cần gói.

## Deploy & phát hành

- **Web**: push `main` lên `sdvico/forfish` → CI xanh → `deploy.yml` (self-hosted runner) đưa lên `sdfish.sdvico.vn`. App Android/iOS cũng tải từ web này.
- **iOS/Android**: xem [ops/build-publish-store.md](docs/app-map/ops/build-publish-store.md).

---

**Repo**: `Long-Forfun/ForFish` (origin cá nhân) và `sdvico/forfish` (công ty). Mọi số liệu giá cả và dự báo biển đều chỉ để **tham khảo**.
