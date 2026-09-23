# Rà soát toàn bộ GitHub Actions — repo công ty `sdvico/forfish` (2026-09-04)

> Phạm vi: 7 workflow trong `.github/workflows/`. Cùng một bộ file nằm ở CẢ HAI
> repo (`sdvico/forfish` và `Long-Forfun/ForFish`) vì hai main giữ bằng nhau.
> Bằng chứng chạy thật lấy từ trang Actions của repo công ty ngày 04/09 (637
> lượt) — không đọc được log chi tiết (repo riêng tư, phiên này không có
> connector GitHub), nên chỗ nào là suy luận từ code thì ghi rõ là suy luận.

## 1. Bảng tổng

| Workflow | Kích hoạt | Việc | Phút/tháng (ước, làm tròn LÊN 1 phút/job) | Tình trạng 04/09 |
|---|---|---|---|---|
| `storms` | mỗi giờ (`5 * * * *`) | ghi kho bão NCHMF + đẩy push, gõ 2 deploy | 24 × 30 = **720** | xanh mọi lượt (#207–210, 18–20 s) |
| `refresh-weather` | 4 lần/ngày | precompute thời tiết Open-Meteo | 120 | **đỏ mọi lượt** (#137–139, 7–16 s) → đã vá `9867e64` |
| `refresh-fish` | 4 lần/ngày | precompute dự báo cá | 120 | **đỏ mọi lượt** (#149–150, 8 s) → đã vá |
| `refresh-currents-depth` | 2 lần/ngày | precompute dòng chảy Copernicus | 60 | **đỏ mọi lượt** (#72–73, 9–10 s) → đã vá |
| `cap-nhat-hai-do` | T2 + T5 | canh bản tin hải đồ vmsa.vn, ghi sổ | ~9 | chưa chạy lượt nào; chờ bật quyền ghi |
| `ci` | mỗi push main + PR | lint · typecheck · test | **7–9 phút × số push** (04/09: 4 push ≈ 32 phút) | xanh (#62–65) |
| `android-release` | bấm tay / tag `v*` | build AAB ký + đẩy CH Play | ~10–15 phút × lần phát hành | không có lượt gần đây |

Cộng cron ≈ **1.030 phút/tháng**; `ci` thêm ~500–900 tuỳ nhịp push. Repo riêng tư
gói Free có 2.000 phút miễn phí — **đang ở mép**, vượt là tính tiền. Hai chỗ ăn
nhiều nhất là `storms` (720) và `ci`.

## 2. Phát hiện — xếp theo mức nguy

### 🔴 A. `android-release`: `versionCode = 10000 + run_number` sẽ tự khoá cửa CH Play

`GITHUB_RUN_NUMBER` là **bộ đếm riêng của từng workflow trong từng repo**. Cùng
file này nằm ở hai repo ⇒ hai bộ đếm độc lập. Kịch bản thật:

1. Repo công ty phát hành lượt #12 → versionCode 10012, lên Play.
2. Ai đó bấm ở repo Long, lượt #30 → 10030, lên Play.
3. Repo công ty phát hành tiếp #13 → 10013 **< 10030** → Play từ chối
   ("version code đã dùng / nhỏ hơn"). Từ đó mọi lượt ở repo công ty đều
   hỏng cho tới khi ai đó vượt được 10030 bằng tay.

Cũng bộ đếm đó **về 0 nếu đổi tên file workflow** — mọi upload sau đó bị từ
chối, và không dòng log nào nói tại sao.

**Hướng sửa (chọn một):**
- *Tốt nhất*: plugin `play-publisher` đã có sẵn trong `android/build.gradle`
  hỗ trợ `resolutionStrategy = AUTO` — tự hỏi Play "số hiện tại là bao nhiêu"
  rồi +1. Không bộ đếm nào của mình cả, không phụ thuộc repo.
- *Rẻ*: `versionCode = $(date -u +%y%m%d%H)` (vd `26090417`) — đơn điệu tăng,
  giống nhau ở mọi repo, lớn hơn mọi số cũ (10xxx). Không dùng tới phút vì
  `%y%m%d%H%M` = 2,6 tỷ **tràn int32** (trần Play 2.100.000.000).
- Và dù chọn gì: **chỉ cho phát hành từ MỘT repo** (xem B).

### 🔴 B. Mọi cron và cả `android-release` chạy ở CẢ HAI repo — không có cổng

Chỉ `cap-nhat-hai-do` có `if: github.repository == 'sdvico/forfish'` (chủ dự
án chốt hôm nay). Sáu workflow còn lại không có. Hôm nay repo Long im vì hết
hạn mức, nhưng đó là im do **hết tiền**, không phải do thiết kế — nạp lại hạn
mức là:

- `storms` gõ NCHMF **2 lần/giờ** thay vì 1; `notify-storms` chạy đôi (sổ 48 h
  chặn được gửi trùng, nhưng vẫn là hai job/giờ vô ích).
- ba `refresh-*` tải Open-Meteo/Copernicus gấp đôi.
- `android-release` từ hai nơi ⇒ đúng cái bẫy A.

**Sửa**: cùng một dòng `if:` cho 5 workflow còn lại (`ci` thì NGƯỢC LẠI — nên
chạy ở cả hai, vì nó gác code chứ không gõ nguồn ngoài).

### 🟡 C. Không workflow nào có `timeout-minutes`

Mặc định GitHub là **360 phút**. Một `npm ci` treo, một gradle kẹt, một
`next build` chờ mạng — tính đủ 6 giờ = **360 phút = 18 % hạn mức tháng trong
một lần**. Với `ci` 7–9 phút thật, đặt 20; `android-release` đặt 40; cron
đặt 10 (curl đã có `-m 90/120`, cộng khởi động runner vẫn dưới 5 phút).

### 🟡 D. `permissions` trống ở `ci`, `storms`, ba `refresh-*` — và sắp thành lỗ hổng thật

Không khai `permissions:` thì `GITHUB_TOKEN` nhận **mặc định của repo**. Mặc
định đó sắp bị đổi thành *Read and write* để `cap-nhat-hai-do` đẩy được sổ.
Ngay lúc đổi, **năm workflow kia cũng có quyền ghi** dù không cần — một
`actions/*` bị chiếm hoặc một script bị tiêm là có thể push thẳng vào main.

**Sửa**: `permissions: { contents: read }` cho `ci` + bốn cron (chúng chỉ
checkout, thậm chí cron còn không checkout). `android-release` đã có
`contents: read` ✓. `cap-nhat-hai-do` cần `write` — đúng, giữ.

### 🟡 E. `ci` là khoản chi lớn nhất, và một nửa số phút là chờ

7–9 phút mỗi push, trong đó `npm test` (3.700 ca, ~27 s trên máy dev nhưng
~50 s+ trên runner 2 vCPU) và `next`/`tsc` chiếm phần lớn. Hôm nay 4 push =
32 phút; nhịp 3 push/ngày là **~800 phút/tháng**. Hai đường rẻ:

- Tách thành 2 job song song: `lint + typecheck` (~2 phút) và `test` (~5 phút)
  — tổng phút tính tiền KHÔNG giảm (vẫn ~7), nhưng thời gian chờ giảm một nửa
  và commit lỗi lint đỏ sau 2 phút thay vì 8.
- Cache `.next/cache` và cache vitest (`--cache`) — giảm thật 1–2 phút/lượt.
- ĐỪNG bỏ gác trên push main (đó là cổng chặn duy nhất chạy tự động, xem
  chú thích đầu file).

### 🟡 F. `https://forfish.vercel.app` gõ cứng ở 4 file

`storms` từ trước, nay thêm ba `refresh-*` (vá hôm nay chép đúng khuôn đó). URL
đổi là sửa 4 chỗ, quên 1 là một cron âm thầm gõ vào deploy chết. Nên là biến
repo `APP_BASE_URL_2` (cùng chỗ với `APP_BASE_URL`), cả 4 file đọc từ đó.

**Và lệch cấu hình gốc vẫn còn**: `secrets.CRON_SECRET` của repo không khớp env
của deploy mà `vars.APP_BASE_URL` trỏ tới (chẩn đoán ở `external-services.md`
mục 2026-09-04). Vá hôm nay chỉ làm việc precompute chạy được và in warning;
sửa gốc là việc trên Vercel / Settings của repo, ngoài tầm code.

### 🟡 G. `uses:` ghim theo tag lớn (`@v4`), không ghim SHA

`actions/checkout@v4`, `setup-node@v4`, `setup-java@v4`, `upload-artifact@v4`.
Tag `v4` là con trỏ di động — chủ action (hoặc kẻ chiếm tài khoản) đẩy bản
mới là mọi repo dùng ngay, không ai review. Chuẩn cứng hoá là ghim SHA 40 ký
tự kèm comment tag (`actions/checkout@<sha> # v4.2.2`) và để Dependabot
nâng. Mức độ: vừa — bốn action này đều của GitHub, nhưng `android-release`
cầm **keystore ký app + service account Play**, là nơi đáng ghim nhất.

### 🟢 H. Những chỗ ĐÚNG, giữ nguyên

- `storms` gộp hai việc một job, hạ về 1 giờ/lần, giải thích tiền nong ngay
  đầu file — đây là khuôn mẫu cho mọi cron khác.
- `storms` bước 2 `if: always()` là cố ý và có ghi lý do (đẩy cảnh báo không
  được chết theo ghi kho).
- `ci` `concurrency` huỷ lượt cũ CHỈ với PR, giữ từng commit trên main — đúng.
- `android-release` không chạy mỗi push (chế độ `server.url`), `permissions`
  chỉ `read`, `concurrency` không huỷ giữa chừng, `if-no-files-found: error`.
- Cả ba `refresh-*` và `cap-nhat-hai-do` đều **nói ra** khi thiếu cấu hình
  thay vì đỏ câm — nhưng xem I.

### 🟢 I. Một nếp cần cân nhắc: "thiếu secret → exit 0"

Ba `refresh-*` và (trước đây) cả bốn cron coi "thiếu `CRON_SECRET`" là
best-effort, **xanh** kèm warning. Ý tốt: fork chưa cấu hình không đỏ oan.
Mặt trái: ở repo THẬT, secret bị xoá nhầm là job vẫn xanh hàng tháng trong
khi không precompute gì — chính là "sân khấu, không phải cổng" mà chú thích
`ci.yml` cảnh báo. Khi đã có cổng repo (B), nếp này hết lý do tồn tại ở repo
công ty: **thiếu secret ⇒ đỏ**.

## 3. Việc `cap-nhat-hai-do` (của tôi) — tự soi cùng thước

- Có cổng repo ✓, `permissions` tối thiểu cần ✓, `concurrency` ✓, thử lại ba
  lớp ✓, không commit khi sổ không đổi ✓.
- Thiếu `timeout-minutes` (C) — cùng lỗi với các file khác.
- Chưa có lượt chạy nào; **quyền ghi của `GITHUB_TOKEN` chưa bật** nên lượt
  đầu sẽ đỏ ở bước đẩy sổ.
- Giá trị hiện tại thấp: sổ không ai đọc. Đang chờ chủ dự án chốt xoá / nối
  vào app / giữ làm tripwire.

## 4. Thứ tự làm đề xuất

> **ĐÃ LÀM cùng ngày (chủ dự án: "fix đi")**: việc 1, 2, 3, 4 và mục I — một commit,
> thuần cấu hình. Việc 4 chọn phương án **ngày-giờ** `date -u +%y%j%H%M` (năm · ngày
> trong năm · giờ · phút, vd `262471125`): không cần `PLAY_SERVICE_ACCOUNT_JSON` lúc
> chỉ build, không tràn int32 (max 993652359), đơn điệu tăng ở mọi repo. Hai lần
> phát hành trong cùng một phút thì lần sau bị Play từ chối — chấp nhận, lỗi đó
> nói thẳng lý do. `resolutionStrategy = AUTO` để dành làm nâng cấp. Cron nay dùng
> `permissions: {}` (chỉ curl, không checkout); `ci` `contents: read`. Còn lại:
> 5 (`APP_BASE_URL_2`), 6 (ngoài repo), 7 (tách `ci`), 8 (ghim SHA).

| # | Việc | Rủi ro nếu bỏ | Công |
|---|---|---|---|
| 1 | Cổng repo cho 5 workflow còn lại (B) | double-hit nguồn, bẫy versionCode | 5 dòng |
| 2 | `permissions: contents: read` cho ci + 4 cron (D) | quyền ghi rơi vào job không cần, NGAY khi bật Read-and-write | 5 dòng |
| 3 | `timeout-minutes` cả 7 file (C) | một lần treo = 18 % hạn mức tháng | 7 dòng |
| 4 | versionCode: `resolutionStrategy AUTO` hoặc theo ngày-giờ (A) | khoá cửa Play, khó gỡ | ~10 dòng gradle hoặc 1 dòng bash |
| 5 | `APP_BASE_URL_2` thay URL gõ cứng (F) | đổi domain quên một chỗ | 4 file |
| 6 | Sửa gốc `CRON_SECRET`/`APP_BASE_URL` trên Vercel + Settings (F) | precompute chỉ chạy nhờ đích dự phòng | ngoài repo |
| 7 | Tách `ci` 2 job + cache (E) | chỉ là chờ lâu + tiền | ~30 dòng |
| 8 | Ghim SHA (G) | supply-chain, thấp nhưng có keystore | 4 dòng + Dependabot |

Việc 1–3 là đổi cấu hình thuần, không đụng hành vi app, không ảnh hưởng
offline — làm được trong một commit. Việc 4 cần chủ dự án chọn chiến lược.
