# CLAUDE.md — SDFish

> App đồng hành của ngư dân Việt Nam (commissioned by SDVICO). Tên hiển thị **SDFish** (đổi từ ForFish 2026-06-16; GIỮ infra cũ: localStorage `forfish.*`, `forfish-gateway`, repo, Supabase ref — đổi sẽ phá tích hợp). Mobile-first, tiếng Việt đời thường, cho người dùng ít rành công nghệ. Sản phẩm xoay quanh **bốn lời hứa với bà con** — không phải feature, không phải nguồn dữ liệu.

## Bốn trục / The four promises

> **Lời hứa ≠ route**: nav hướng-đối-tượng (dock: Trang chủ · Ra khơi · Tàu cá · Bạn thuyền · Giao dịch), không 1 route/trục. Route cũ `/gia-ca` `/van-hanh` `/giay-to` `/thuyen-vien` = **redirect**. Nguồn đúng: [07-design-spec §4](docs/app-map/07-design-spec.md).

| Trục | Lời hứa | Ở đâu (route thật) | Trạng thái |
|---|---|---|---|
| 1 | Đánh bắt tốt hơn | `/ngu-truong` | **MVP**: điểm đi biển 1–100, dữ liệu thật Open-Meteo (sóng/gió/mưa/dông, 10 cảng) + bản đồ ngư trường vệ tinh (nhiệt độ/phù du/ảnh mây/độ sâu + phao đèn biển, nhãn chủ quyền VN, chạm xem gió sóng) + tin bão Biển Đông (`/api/storms`) + dẫn đường tiết kiệm dầu (tuyến né sóng gió theo giờ, ước tính lít dầu — tham khảo). ⚠️ **PREMIUM (2026-07-26)**: dự báo cá + thời tiết >3 ngày chỉ cho tài khoản premium (`customers.tier`, gán qua webhook SDWork / web quản trị `/quan-tri` — độc lập về giao diện, chung deploy/DB; luật ở `src/lib/tier.ts`, chặn thật ở middleware) |
| 2 | Bán được đắt hơn | `/tien` (khu Giao dịch, KHÔNG còn tab) | **MVP**: bảng giá tham khảo + chợ tin mua/bán (`market_listings`) + danh bạ chỗ bán. **XÓA HẲN 2026-07-27 (user chốt)**: sổ lãi lỗ, báo cáo năm, tính chuyến, chia tiền, công nợ — /tien gọn về đúng việc mua–bán |
| 3 | Vận hành rẻ hơn | `/tau` (tab Dịch vụ/Sản phẩm) | **MVP**: nhắc bảo dưỡng (localStorage) + danh mục vật tư tham khảo |
| 4 | Tuân thủ dễ hơn | `/tau` (tab Giấy tờ) + `/nguoi` | **MVP**: tủ giấy tờ + sổ thuyền viên (định danh CCCD + tra cảnh báo chéo premium — không dính tiền). **Bỏ 2026-07-27 (user không cần)**: tab Mức phạt (NĐ 38/2024) + Checklist xuất bến — file `fines-lookup.tsx`/`departure-checklist.tsx` giữ lại, chỉ gỡ khỏi tab; sổ ứng/chia tiền thuyền viên cũng gỡ hẳn |

Thứ tự build: **4 + 3 trước → 1 → 2**. Trục 4 làm trước vì không phụ thuộc dữ liệu bên ngoài. Chi tiết: [docs/app-map/01-product.md](docs/app-map/01-product.md). Đa tàu (hồ sơ cố-định/động): [08-ba-spec](docs/app-map/08-ba-spec-da-tau.md).

## Tech stack

- **Next.js 16** App Router + TypeScript (**Node ≥ 20**), **Tailwind v4** (tokens trong `src/app/globals.css` qua `@theme`)
- **Supabase** (Postgres + Auth, RLS owner-only) — app fallback về **demo mode** (localStorage) khi env chưa cấu hình
- **MapLibre GL** (bắt buộc lazy-load) — bản đồ ngư trường Trục 1 · **Vitest** — test logic `src/lib/`
- Deploy: **Vercel** (web) · **PWA cài được** (manifest/SW/icons) · **Capacitor-ready** (`lib/api-base` + `NEXT_PUBLIC_API_BASE`) — xem [docs/app-map/ops/native-deploy.md](docs/app-map/ops/native-deploy.md) · Repo: github.com/Long-Forfun/ForFish

## Đọc gì trước / Read first

1. **`docs/app-map/README.md`** — index + load strategy của hồ sơ (app-map docs)
2. Route context theo task: gọi **`/fl <mô tả task>`** → agent `context-router` trả về danh sách `.md` cần đọc + pre-flight flags. KHÔNG load cả app-map.

## Quy tắc viết code (nguyên tắc 15 — nội hoá 2026-08-14, chi tiết: methodology/15 của ai-simple)
1. **Leo thang trước khi viết**, dừng ở bậc đầu tiên đủ dùng: (1) việc này có cần tồn tại không — không có dòng nào trong spec đòi thì bỏ · (2) repo đã có helper/type/pattern chưa (lib/ + ui/primitives trước) · (3) thư viện chuẩn · (4) nền tảng có sẵn — trừ component đã chốt trong design-system (QtyStepper, BottomSheet, .surface... — chúng thắng bậc 4) · (5) dependency ĐÃ CÀI, cấm thêm dep mới cho việc vài dòng · (6) gói 1 dòng · (7) code tối thiểu chạy được. Không interface cho 1 implementation, không wrapper chỉ để gọi tiếp; "để mở rộng sau" không phải lý do. Leo thang SAU khi đã đọc code bị chạm.
2. Bậc 1 chỉ áp cho thứ AI tự nghĩ ra thêm. CẤM dùng nó cắt thứ ba-spec/AC/design-spec đã ghi — đó là định nghĩa duy nhất của "được yêu cầu tường minh".
3. Sửa bug = sửa gốc: grep MỌI caller trước, guard đặt ở hàm dùng chung. Thêm export mới: grep tên + grep việc nó làm — trùng nghĩa thì dùng lại (bài học thật: `haversineKm`, `nearestIndex` đang tồn tại 2 bản).
4. **KHÔNG cắt, dù thang bảo gì**: validate input ở ranh giới · error handling chống mất dữ liệu (án lệ `saveUserJson` 2026-07-31 — nuốt lỗi là mất sổ của bà con) · ĐỦ ma trận trạng thái TRONG CODE (trống/đang tải/lỗi/offline/cực đoan) · tap ≥56px · contrast cao cho nắng chói · focus ring không huỷ trắng · action → expectation.
5. Gặp hành vi chưa có trong spec: CẤM bỏ qua im lặng — mặc định an toàn nhất + `## Assumptions` + 1 dòng vào spec CÙNG COMMIT; nghiệp vụ → hỏi/BA; HOW-nhìn → design.
6. Vùng miễn test giữ đúng 3 ca (pure UI tweak / config-only / doc-only). "Sửa 1 dòng nên khỏi test" KHÔNG phải một ca.
7. Cắt góc có trần → `// nợ: <trần là gì>, <điều kiện nâng cấp>` (hook WARN marker thiếu vế 2). Không TODO trần.
8. Riêng ForFish: REM không px cho cỡ chữ/tap (kiến trúc data-mode); token màu qua `globals.css @theme`, cấm hex/rgba arbitrary (hook BLOCK); copy tiếng Việt đời thường, không jargon.

## Doc + Test sync — INVARIANT (không thoả hiệp)

Mọi thay đổi `src/` phải update doc app-map tương ứng **TRONG CÙNG COMMIT**:

| Code change | Doc bắt buộc update |
|---|---|
| Route / page / nav / component | [docs/app-map/02-architecture.md](docs/app-map/02-architecture.md) |
| Màn hình / flow / density / trạng thái / audit UI | [docs/app-map/07-design-spec.md](docs/app-map/07-design-spec.md) |
| `src/lib/documents.ts`, migration, RLS | [docs/app-map/04-data-model.md](docs/app-map/04-data-model.md) |
| Token màu / font / component pattern | [docs/app-map/03-design-system.md](docs/app-map/03-design-system.md) |
| Scope trục / lời hứa / data source | [docs/app-map/01-product.md](docs/app-map/01-product.md) |
| Quy trình team-agent | [docs/app-map/05-agents-team.md](docs/app-map/05-agents-team.md) |
| Shape đồ SDWork (CRM↔ForFish) | [docs/contracts/sdwork-assets.contract.md](docs/contracts/sdwork-assets.contract.md) — bump version nếu breaking |
| Nguồn dữ liệu ngoài (timeout/fallback) | [docs/app-map/ops/external-services.md](docs/app-map/ops/external-services.md) |

**Enforcement (nguyên tắc 8/12)**: pre-commit hook ở `.githooks/` (bật bằng `git config core.hooksPath .githooks`) chặn migration↔04 lệch, covers-gate, budget root, contract SDWork, spacing-px, BOM/mojibake. Verify: `sh .githooks/pre-commit --self-test`. Sức khoẻ doc: `sh scripts/doc-health-report.sh`. Audit định kỳ: `/audit`.

Test: **Vitest** (`npm test`, test tại `src/lib/__tests__/`) — thêm logic mới vào `src/lib/` thì viết test kèm cùng commit. **Node ≥ 20** (CI pin 20); script `test` = `node scripts/run-vitest.mjs` — file bọc CHỈ thêm cờ `--no-experimental-webstorage` khi Node ≥22 (để tắt localStorage native che localStorage của jsdom), còn Node 20 thì bỏ cờ (cờ chưa tồn tại → truyền qua NODE_OPTIONS sẽ làm Node exit 9). ⚠️ ĐỪNG quay lại `NODE_OPTIONS=--no-experimental-webstorage vitest run`: nó làm CI Node 20 đỏ (exit 9) và hỏng `npm test` trên Windows (cú pháp gán biến kiểu bash). Nhờ file bọc, `npm test` xanh trên CI (Node 20), máy dev (Node 22/26) và Windows. Skip chỉ cho phép với pure UI tweak / config-only / doc-only, note rõ trong commit message.

## Dữ liệu bản đồ trong git — CHỐNG PHÌNH (chốt 2026-08-29)

> Deploy **trên Vercel**, `public/data/` phát thẳng làm asset tĩnh. Nhưng git giữ **vĩnh viễn từng bản** của mọi file nhị phân/JSON lớn: sinh lại một file 42 MB là 42 MB nằm lại trong lịch sử **mãi mãi**, clone chậm cho cả team. Mốc hiện tại: `.git` **114 MB**, `public/data/` **96 MB**.

| # | Quy tắc | Vì sao |
|---|---|---|
| 1 | **Một lớp = MỘT file.** Đổi nội dung thì ĐÈ, không đẻ `-v2`/`-old`/`.bak`. Đường dẫn ổn định là điều kiện để service worker làm mới đúng (xem `precacheOne`) | Mỗi biến thể là một bản sao trọn vẹn trong lịch sử |
| 2 | **Chỉ commit mức CHI TIẾT nhất.** Các mức nhẹ hơn **sinh lúc build** — giản lược Douglas–Peucker là phép cục bộ, không cần mạng, chạy được trong `npm run build` trên Vercel | Repo gánh 76 MB thay vì 125 MB, và ba mức không bao giờ lệch nhau |
| 3 | **Sinh lại là hành động CÓ CHỦ Ý, không phải phản xạ.** Ghim ngày chốt nguồn trong chính file; chỉ sinh lại khi nguồn thật sự đổi, không phải khi sửa một dòng script | Mỗi lần chạy `generate-*.mjs` là một khoản nợ lịch sử không trả lại được |
| 4 | **Trần dung lượng, hook chặn**: một file `public/data/**` > **20 MB**, hoặc cả thư mục > **120 MB** → BLOCK. Muốn vượt thì ghi lý do vào commit message với dòng `data-budget: <lý do>` | Trần đặt ở chỗ còn kịp nghĩ lại, không phải lúc clone đã 500 MB |
| 5 | **CẤM file dữ liệu tạm trong cây làm việc.** Kết quả dò, mẫu API, bản nháp → để ngoài repo (thư mục tạm của phiên). Hook chặn `*.json`/`*.html` mới ở gốc repo | Đã dính thật 2026-08-29: agent để lại `da.json`, `hp.json`, `da2.json`, `enc_list.html` ở gốc |
| 6 | **Không dùng Git LFS mà chưa thử deploy trước.** Vercel không tài liệu hoá việc checkout object LFS; file thành con trỏ là bản đồ chết ngoài biển mà build vẫn xanh | Hỏng ở đúng chỗ không ai kiểm: production, offline |

**Khi trần 120 MB thật sự chật**: chủ dự án chốt 2026-08-29 là **dữ liệu nằm trong code**, KHÔNG đưa ra Vercel Blob hay CDN ngoài. Lý do không phải sở thích: `public/data/` hôm nay đi theo deployment và phát qua CDN Vercel — nén Brotli sẵn, không tính tiền riêng; cho app tải thẳng từ Blob là biến **mỗi lượt bà con tải** thành băng thông CÓ ĐO ĐẾM (42–76 MB × vài trăm ngư dân = hàng chục GB/tháng). Đổi một vấn đề của người phát triển lấy một hoá đơn vận hành.

> Nên đường đi khi chật là **ĐỔI ĐỊNH DẠNG LƯU, không đổi chỗ lưu**. Đo thật: GeoJSON tốn **19,8 byte mỗi đỉnh toạ độ** vì lưu số thành chữ; delta + zigzag + varint (đúng thứ MVT dùng) cho ~4–5 byte/đỉnh — lớp rạn 76 MB xuống còn khoảng 17 MB, lọt dưới trần mà không mất một đỉnh nào. Hết đường đó rồi mới tính chuyện ra khỏi git.

## Nguồn dữ liệu — ĐỪNG TỰ GIỚI HẠN (chốt 2026-08-31)

> **Bản đồ là MIỄN PHÍ. Cái bán là DỰ BÁO CÁ.** `src/lib/tier.ts`: *"Premium mở: dự báo cá + thời tiết quá 3 ngày."* Độ sâu · phao đèn · rạn · đẳng sâu · nền bản đồ · thuỷ triều — tất cả cho không, mọi tài khoản.

Lỗi đã dính nhiều lần: agent đọc "SDFish là sản phẩm thương mại" rồi **loại thẳng** nguồn ghi *non-commercial*, dù nguồn đó chỉ dùng cho **lớp bản đồ miễn phí**. Ràng buộc bị áp sai chỗ, và mất nguồn tốt vì một lý do không tồn tại.

**Luật đúng — nó ngược với trực giác:**

| Nguồn dùng cho | Ràng buộc "phi thương mại" |
|---|---|
| Lớp **bản đồ** (miễn phí) | **KHÔNG chặn.** Không thu tiền ai để xem bản đồ |
| **Dự báo cá**, thời tiết >3 ngày (bán) | **CÓ chặn.** Đây mới là chỗ đồng tiền đi qua |

Nghĩa là ràng buộc cắn đúng chỗ có tiền, không cắn lớp bản đồ. Đừng gộp hai thứ.

**Vẫn là cổng chặn thật, đừng lẫn với điều trên:**
- **Copyleft phần mềm** (GPL của bộ ký hiệu OpenCPN, share-alike ODbL của OSM) — đây là ràng buộc lên **mã và cơ sở dữ liệu**, không phải chuyện thu tiền hay không. Vẫn phải tránh.
- **Cấm "adapted"** (IHO S-52) — cấm cả việc vẽ lại theo hình của họ, bất kể miễn phí.
- **Chủ quyền** — nguồn nào buộc ghi "South China Sea" hay tên Trung Quốc thì loại, dù giấy phép sạch tới đâu.

**Thông tin nhà nước Việt Nam công bố công khai** (Thông báo hàng hải, tin bão, danh mục báo hiệu): doanh nghiệp hiện thực hoá thành ứng dụng cho bà con là việc bình thường. Điều 15 Luật SHTT loại "văn bản hành chính" và "số liệu" khỏi bảo hộ quyền tác giả. **Đừng viết câu dè chừng nào cho nhóm này.**

## Dữ liệu phát ra ngoài — MÃ HOÁ HAI NHÓM (chốt 2026-09-16, "PWA trước")

> `public/data/**` phát ra CDN là **bản mã**; trong git vẫn **bản RÕ** (test/script/hook đọc thẳng). `npm run build` = `node scripts/encode-data.mjs && next build` — chỉ mã tại chỗ khi `VERCEL=1`/`SDFISH_ENCODE_DATA=1`; lỡ chạy máy dev: `git checkout -- public/data`. Trần PWA: người CÓ tài khoản vẫn rút được khoá; đạt được là người KHÔNG tài khoản tải file là rác, lộ thì tra ra ai nhận khoá.

- **SDF1** (miễn phí/OSM: nền, bờ, đảo, rạn, tuyến, seamarks, tide-stations cho thẻ Trang chủ của khách): hoán vị byte, bảng trong bundle = khoá cửa. Giữ nén Brotli, giải được lát Range.
- **SDF2** (biên tập — danh sách `CURATED` ở `scripts/encode-data.mjs`): gzip + AES-256-CTR, khoá ở `app_config.data_key_current` (admin đổi ở `/quan-tri`; **build đầu tự sinh**; env `SDFISH_DATA_KEY` chỉ đè khi build tay). Đổi khoá ⇒ cũ trượt sang `data_key_prev`, route trả cả hai; deploy lại. App cất `forfish.datakey.v1`. Thêm lớp mới tốn công ⇒ thêm vào `CURATED`.
- Code: `src/lib/data-codec.mjs` · `data-crypt.ts` · `inflate.mjs` (iOS 15) · `data-fetch.ts` (một cửa đọc — **CẤM `fetch("/data/…")` trần**, cổng `data-codec.test.ts`) · `data-protocol.ts` (`sdfdata://`) · `pmtiles-protocol.ts` (`DecodingSource`) · `data-key.ts`/`data-key-server.ts`. Chi tiết: 02 re-verified 2026-09-16/16b.
- **Gác MỌI route dữ liệu** ("server mình là nguồn thì đều bảo vệ"): `middleware.ts` matcher 11 đường đích danh → `dataGate` (`lib/supabase/middleware.ts`): 401 không chuỗi thiết bị · 403 premium (dự báo cá; `grid:dN`/`scalar:*:dN` N>3) · 429 theo SĐT (fish 60 · data 600 · tiles 3000 / 10 phút); đệm danh tính 10 phút. Luật thuần `lib/data-route-rules.ts`, cổng `data-route-rules.test.ts` đỏ khi thêm route dữ liệu mà quên gác. Client gửi `tokenHeader()`; khách chưa đăng nhập hết tin bão/giá.
- **Tham số mô hình ra khỏi bundle**: `scripts/build-model-params.mjs` gộp `src/data/fish-blend-weights.json` + `forecast-skill.json` → `public/data/model-params.v1.json` (SDF2); app đọc qua `lib/model-params.ts`. **Fit/backtest xong phải chạy lại script** — cổng `model-params.test.ts` bắt lệch.
- Kèm: LICENSE độc quyền SDVICO (ODbL §4.6 lớp OSM vẫn đưa bản rõ khi có yêu cầu), rate limit `/api/fish-forecast` 60/10 phút (`rate-limit.ts`, per-instance — nợ đã ghi).

## Pre-flight risk flags — dừng lại hỏi user khi

- 🔴 **DB/migration**: đụng `supabase/migrations/`, RLS, schema (project ref `znzgugvfhgmiszqgjulk`) — KHÔNG tự apply lên remote
- 🔴 **Auth**: thêm/bỏ check quyền, bypass RLS
- 🟡 **Cross-trục**: thay đổi ảnh hưởng >1 trục (vd: bottom-nav, layout, design tokens)
- 🟡 **ẢNH HƯỞNG OFFLINE — HỎI MỌI THAY ĐỔI** (chủ dự án chốt 2026-08-01): trước khi commit BẤT KỲ thay đổi nào, tự trả lời *"cái này có làm hỏng việc dùng app ngoài biển không?"* và ghi câu trả lời vào commit message. Bốn câu hỏi soi: (a) có thêm **request mạng** nào chạy lúc mở app / chuyển màn không — có timeout chưa, mất sóng có treo không, có `.catch` chưa? (b) có đụng `public/sw.js`, `SHELL`, danh sách cache, hay khoá `forfish.*` không (đụng = chạy `docs/app-map/ops/qa-offline-acceptance.md` bộ bắt buộc)? (c) có làm **mất/đè** dữ liệu bà con đã tải (route trả 200-kèm-lỗi, xoá cache, bump phiên bản kho) không? (d) màn mới có **nhánh đọc bản đã lưu** khi mất sóng chưa, hay chỉ có nhánh mạng? Ngư dân mất sóng nhiều ngày — offline không phải tính năng phụ, hỏng nó là hỏng chuyện an toàn.
- 🟡 **Data vendor**: code dính OceanByte/SDWork phải đi qua adapter — KHÔNG hardcode vendor vào core (xem [01-product.md](docs/app-map/01-product.md))

## LOGIC vs REQUEST

- User hỏi "tại sao / có nên / kiểm tra giúp" → **LOGIC**: phân tích, trả lời, KHÔNG sửa code
- User ra lệnh rõ (thêm, sửa, fix, build, deploy) → **REQUEST**: làm
- Không chắc → hỏi 1 câu ngắn để lock scope. `/fl` sẽ classify giúp.

## KHÔNG ĐƯỢC / NEVER

- Hardcode secret / API key
- UI phức tạp, chữ nhỏ, jargon — người dùng là ngư dân 40-60 tuổi (font ≥18px, tap target ≥56px, xem [03-design-system.md](docs/app-map/03-design-system.md))
- Hứa độ chính xác dữ liệu mà nguồn không đảm bảo (vd: khuyến nghị ngư trường chỉ cập nhật 2 lần/tuần)
- Code mà không update doc cùng commit

## Git workflow — ĐỒNG BỘ TRƯỚC KHI LÀM (bắt buộc)

**Trước khi bắt đầu task/fix mới: `git fetch` + sync remote về TRƯỚC, rồi mới code.** Nhiều người/agent cùng đẩy lên repo → main đi rất nhanh; làm trên nền cũ sẽ phân kỳ (diverge), sau đó push bị chặn và phải rebase/gỡ xung đột ~chục file (đã dính 2026-06-23).

- Đầu phiên / trước mỗi mạch việc: `git fetch origin` rồi xem `git status -sb`; nếu nhánh sau remote thì `git pull --ff-only` (hoặc rebase nhánh lên `origin/main`) **trước khi** sửa.
- Nhánh tính năng: rebase/merge `origin/main` mới nhất vào **sớm và thường xuyên**, đừng để dồn.
- Push: chỉ **fast-forward**. KHÔNG `--force` lên nhánh chung (`main`) — sẽ xoá commit người khác. Diverge thì rebase lên `origin/main` rồi push.
- Push/commit chỉ khi user yêu cầu (xem cũng nhắc ở phần đầu). Đang ở nhánh mặc định → tách nhánh trước khi commit.

## Quick commands

```bash
npm run dev     # http://localhost:3000
npm run build
npm run lint
```

---

**Last updated**: 2026-07-27
