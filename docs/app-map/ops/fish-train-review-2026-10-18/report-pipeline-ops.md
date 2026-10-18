# Review VẬN HÀNH / TÁI LẬP — pipeline huấn luyện dự báo cá (18/10/2026)

Phát hiện thêm trên GPU: WSL ĐÃ bật `systemd=true` (`/etc/wsl.conf`), user-systemd có sẵn 5 timer (`forlife-gpu-lich` mỗi 5 phút, `forlife-dem` 00:30, `sen-bien-dem` 06:35...) trong `~/forlife` (repo AI-Assistant). Máy 16 nhân, 23 GB RAM. => hạ tầng lịch ĐÃ CÓ, chỉ thiếu một unit cho cá. `crontab` trống đúng như đã nêu.

## 1. Kiểm kê script (ngày = commit cuối)

Nhóm A — PIPELINE TRAIN (đang dùng, đều tháng 10/2026)
| Script | Mục đích | Vào -> Ra | Mạng | Thời gian | Sửa cuối | Doc |
|---|---|---|---|---|---|---|
| dl-collect | Tải DataLake qua API | API -> `~/sdfish-data/dl` | CÓ (đường hầm chết) | giờ | 10/10 | 1 (§9) — THAY BẰNG adapt-local |
| (ngoài repo) dl-adapt-local | Snapshot local -> shape dl-collect | `datalake-iuu/snapshots` -> `dl-all/` | không | ~7' | 14/10 | chỉ nhắc trong §11 |
| dl-build-labels | Nhãn ô 0,05° x ngày (giờ đánh, kg loài) | dl-all -> labels-<từ>/ (effort/catch.csv, report.json) | không | ~4' (5 cửa sổ) | 14/10 | 2 |
| fish-validate-run | Payload dự báo quá khứ + cache lưới vệ tinh | ERDDAP CoastWatch + ETOPO -> fc-full/grids, payload-* | CÓ | ~3,5'/61 ngày | 03/10 | 2 |
| build-fleet-effort-grid | Lưới giờ đánh đội tàu | VMS -> `src/data/fleet-effort-025.v1.json` (+ biến thể `--exclude-month`) | không | ~4' | 14/10 | 4 |
| build-species-catch-grid | Lưới kg/loài | labels -> `species-catch-025.v1.json` | không | <1' (est.) | 14/10 | 2 |
| dl-eval | AUCeff/AUCarea/Δdyn từng loài | payload + labels -> json/txt | không | vài phút | 10/10 | 3 |
| dl-eval-fleet | Kiểm kênh đội tàu, chống rò (giữ-tháng-ra) | lưới ex-tháng + grids + labels | không | vài phút | 14/10 | 3 |
| dl-fit-profiles | Dò tham số SpeciesProfile, gập tháng 8<->9 | grids + labels -> `fit-<loài>.json` | không | ~20'/loài, 17 loài ≈ 5,7 giờ tuần tự | 10/10 | 1 |
| build-model-params | Gộp blend-weights + skill -> `public/data/model-params.v1.json` | 2 json trong src/data | không | <1s | 18/09 | 1 + cổng test |

Nhóm B — THAM SỐ NỀN (chạy hiếm, cần mạng)
| fit-fish-blend-weights (587 dòng, 28/07) | w(d) pha trộn mùa vụ | clim + payload | CÓ | giờ | doc 3 |
| forecast-backtest (25/07) | bảng skill sóng/gió theo tầm | Open-Meteo/ERA5 | CÓ | 10–30' | doc 3 |
| collect-fish-climatology (03/10), collect-sst-climatology (03/10) | bản đồ mùa vụ nhiều năm | ERDDAP | CÓ | giờ | doc 3–4 |
| fish-corpus-build (28/07) | kho ngày dùng chung -> `.cache/fish-corpus` | ERDDAP | CÓ | giờ | doc 2 |
| fish-validate-positions (03/10) | Lift/AUC vs vị trí GFW/VMS | payload + CSV | không | vài phút | doc 6 |
| copernicus-skill-backtest (978 dòng, 26/07) | Copernicus vs persistence | S3 Copernicus + tài khoản | CÓ | dài | **doc 0** |

Nhóm C — THÍ NGHIỆM CŨ (đề xuất dời `scripts/_archive/`, KHÔNG xoá; kết luận đã nằm trong doc/commit)
- doc 0 nhắc: fish-front-calib-probe, fish-front-composite-val, fish-hypo-* (10 file: drift-vector, h6-seasonal-tendency, percell-trust, rank-blend, selfavg, wind-diag, wind-fetch, wind-forcing, wind-inverse, wind-null), fish-plankton-advection-backtest, fish-plankton-eval-verify, copernicus-skill-backtest. -> 17 file, dời ngay.
- doc 1–2 nhắc, ngày 25–29/07 (kết luận đã chốt): fish-3day-probe, fish-knee-probe, fish-spread-probe, fish-analog-year-eval, fish-blend-audit, fish-predict-viec2/3/4, fish-predict-wmax-calib, thermofit-diagnose, conv-copernicus-calib, copernicus-probe/salinity-probe/wav-probe/tendency-skill. -> dời nếu doc chỉ trích dẫn lịch sử (cần grep lại đường dẫn trong doc/test trước khi dời; vài doc 5 nhắc fish-3day-probe).
- Không script nào có mục trong package.json (`pkg:0` cho tất cả) => KHÔNG có điểm vào chuẩn. Đây là thiếu sót vận hành số 1.

## 2. DAG các bước train

```
[DataLake snapshot]--mạng, thủ công, đường hầm chết-->(ngoài repo, AI-Assistant, nhánh Data chưa push)
        |
   dl-adapt-local (tất định, RAM thấp, 7')  -- ngoài repo
        |
   dl-build-labels x5 cửa sổ (tất định, --max-old-space-size=9000, 4') ----+
        |                                                                   |
        +--> build-species-catch-grid (+ ex-2026-08, ex-2026-09)            |
        +--> build-fleet-effort-grid (RAM 8 GB, 4'; + ex-tháng x2)          |
fish-validate-run (MẠNG ERDDAP; cache theo ngày; ~3,5'/61 ngày) ------------+
        |                                                                   |
   dl-eval  /  dl-eval-fleet (cần lưới ex-tháng)  <------------------------+
        |
   dl-fit-profiles x17 loài (~20' mỗi loài, tsx; tất định nếu seed cố định)
        |
   *** TAY: đọc fit-<loài>.json, sửa SPECIES_PROFILES trong src/lib/fish-predict.ts ***
        |
   build-model-params -> npm test (cổng model-params.test.ts + test fish-predict)
```
- Cần MẠNG: chỉ `fish-validate-run` (ERDDAP) và nhóm B; khâu lấy snapshot DataLake (hiện chết).
- Cần RAM lớn: dl-build-labels (9 GB), build-fleet-effort-grid (8 GB). Máy 23 GB đủ, nhưng KHÔNG chạy 2 cái song song khi gpu-lich đang chiếm.
- Tất định: mọi bước còn lại. Cần xác nhận seed hoán vị (`--seed`) cố định trong dl-eval để lần chạy lại ra cùng số.
- TAY duy nhất trên đường chính: áp fit vào SPECIES_PROFILES. Phụ: dán đường hầm DataLake vào bases.txt; chọn ngày/cửa sổ (`dates30.txt`, `--window`) ở tools/ ngoài repo.

## 3. Tái lập — mất ổ C hôm nay còn dựng lại được gì

| Thứ | Ở đâu | Mất ổ C thì |
|---|---|---|
| Code `scripts/*.mjs`, `src/lib/fish-predict.ts` | git (ForFish) | còn |
| Lưới `fleet-effort-025`, `species-catch-025`, `model-params` | git (đã sinh) | còn — app không ảnh hưởng |
| Snapshot DataLake 11/10 | `~/forlife/.../datalake-iuu` (đĩa Linux WSL, vhdx nằm trên ổ C hay D? cần xác minh) | nếu vhdx ở ổ C: MẤT, và đường hầm chết nên KHÔNG kéo lại được |
| `dl-adapt-local.mjs`, `labels-all.sh`, `dates30/31.txt` | `C:\Users\admin\sdfish-data\tools` | MẤT (không version) |
| Kết quả eval/fit (`eval31/61.json`, `catch-eval.json`, `fit-*.json`, `eval-final.txt`) | cùng ổ | MẤT; số đã trích vào doc §9–11 nhưng bảng đầy đủ thì không |
| Cache lưới vệ tinh `fc-full` (469 MB) | cùng ổ | dựng lại được (ERDDAP, ~3,5'/61 ngày) |
| `dl`, `dl-all`, `dl-trk0809` (5,7 GB) | cùng ổ | dựng lại được NẾU còn snapshot |

Phân định:
- CODE vào git: `dl-adapt-local.mjs` -> `ForFish/scripts/dl-adapt-local.mjs` (hiện cứng đường dẫn `C:/Code/AI Assistant/...`; đổi thành `--src` bắt buộc + `DL_SRC`); `labels-all.sh` thay bằng stage trong runner. Cặp `dl-collect` (mặc định `~/sdfish-data`) và thực tế (`/mnt/c/.../sdfish-data`) -> một biến `SDFISH_DATA_DIR` duy nhất.
- Script KÉO DataLake (6 commit nhánh `Data` chưa push, repo AI-Assistant): push ngay — đây là nguồn duy nhất của dữ liệu thô.
- DỮ LIỆU + KẾT QUẢ vào `$SDFISH_DATA_DIR/runs/<YYYY-MM-DD>-<gitsha>/` kèm `manifest.json` (snapshot nguồn, sha code, tham số, thời gian từng stage, hash đầu ra); eval/fit nhỏ (<1 MB) lưu cả vào `docs/app-map/ops/` dạng bảng. Sao lưu: rsync thư mục runs + snapshot sang ổ khác/NAS (hiện không có bản thứ hai).
- Cảnh báo CLAUDE.md "chống phình": mỗi lần sinh lại lưới đội tàu ~1 MB vào lịch sử git. Runner phải so hash với bản đang commit và KHÔNG ghi đè nếu nguồn (snapshot) không đổi.

## 4. Thiết kế "một lệnh" — `scripts/train/run.mjs`

```
node scripts/train/run.mjs --data $SDFISH_DATA_DIR [--from-stage fit] [--only labels,grids] [--species "ngừ vằn"]
```
- Stage khai báo `{id, deps, inputs[], outputs[], cmd, needsNet, memMB}`; khoá cache = sha256(code stage + argv + hash đầu vào + sha các file lib mà stage import). Trùng khoá và đầu ra còn đủ => `skip`. Ghi `runs/<id>/manifest.json` sau MỖI stage (nối tiếp được sau khi chết giữa chừng, `--resume`).
- Stage: `adapt -> labels(x5) -> catch-grid(+ex x2) , fleet-grid(+ex x2) , sat-grids(mạng) -> eval -> eval-fleet -> fit(x loài) -> propose -> params -> test -> pr`.
- Lịch: WSL đã có systemd user, dùng luôn: `~/.config/systemd/user/sdfish-train.{service,timer}` (`OnCalendar=Sun 02:00`, `Persistent=true`, `Nice=15`, `TimeoutStartSec=8h`, `ExecStart=~/.local/node/bin/node ~/ForFish/scripts/train/run.mjs`). Phải đi qua trọng tài `gpu-lich` (kiểm tra việc ngày–đêm của forlife, tránh tranh RAM/đĩa C §0b). Nếu WSL tắt: Task Scheduler Windows gọi `wsl.exe -d Ubuntu -- true` lúc 01:50 để đánh thức (hoặc `vmIdleTimeout`); `Persistent=true` chạy bù khi bật lại.
- Đầu vào mới: bước `fetch` CHỈ chạy khi có snapshot mới hơn manifest gần nhất (`latest.txt` của refresh.mjs); nếu DataLake không với tới => dừng êm "không có dữ liệu mới", KHÔNG báo đỏ.
- Đầu ra: nhánh `train/auto-<ngày>` từ `origin/main` mới nhất, commit gồm `model-params.v1.json`, `src/data/*-025.v1.json`, `fish-predict.ts` (phần hồ sơ do máy sinh) + bảng eval chèn vào doc §9–11 (giữa cặp marker `<!-- auto:eval -->`), mở PR bằng `gh pr create` (không merge). Commit message có dòng offline-impact + `data-budget:` nếu cần.
- CỔNG CHẶN (không mở PR, ghi `runs/<id>/REJECTED.md` kèm lý do):
  1. AUCeff trung bình mỗi loài KHÔNG tăng >= 0,01 so với bản đang chạy (chấm lại bản HEAD trên cùng nhãn, cùng seed), hoặc bất kỳ loài nào tụt > 0,02;
  2. gập tháng 8<->9 không cả hai chiều >= bản gốc (luật dl-fit-profiles hiện có);
  3. AUCeff của kênh đội tàu tụt so với "không kênh" (rò đã loại bằng ex-tháng);
  4. `npm test` + `tsc` đỏ; cổng `model-params.test.ts` lệch;
  5. file `public/data/**` > 20 MB hoặc thư mục > 120 MB (hook sẵn);
  6. thay đổi tham số vượt biên hợp lệ (dải nhiệt trong [min,max] sinh học, độ sâu cổng không âm...) — xem mục 5.

## 5. Bước nào không cần LLM / cần người

| Bước | Cần LLM/người? | Biến thành luật code |
|---|---|---|
| adapt, labels, grids, sat-grids, eval, eval-fleet, fit, build-params, test | KHÔNG | — |
| Áp `fit-<loài>.json` vào SPECIES_PROFILES | Hiện TAY | Tách bảng hồ sơ ra `src/data/species-profiles.fit.v1.json` (máy ghi, `fish-predict.ts` đọc); phần tay chỉ là tham số sinh học đóng băng. Luật `accepted` đã nằm trong file fit (cả hai chiều gập không tệ + TB >= 0,01) => máy áp khi `accepted:true`. |
| Kiểm luật nghiệp vụ (kết quả có hợp lý sinh học: nhiệt ngừ vằn, rạn, chủ quyền) | NGƯỜI/agent | Viết `profile-sanity.test.ts`: dải nhiệt trong [min,max] cứng theo loài, độ sâu cổng, không loài nào điểm tụt quá X trên ca vàng (ô thực địa 12°52'N 115°38'E đã ghi trong build-fleet-effort-grid, ngư trường tốt đã biết) — test đỏ => REJECTED. |
| Đọc diễn giải kết quả viết doc | agent tuỳ chọn | Bảng tự sinh; câu bình luận để người thêm sau, không chặn PR. |
| Duyệt PR + merge | NGƯỜI (anh Long) | giữ nguyên: chỉ merge thủ công. |
| Dán đường hầm DataLake | NGƯỜI | thay bằng token/URL ổn định phía Data Lake (ngoài tầm repo). |

## 6. Chi phí một lượt đầy đủ (tuần tự / có song song)

| Stage | Phút | Song song? |
|---|---|---|
| adapt | 7 | — (I/O nặng đĩa C) |
| labels x5 | 4 | có 2–3 cửa sổ (RAM 9 GB mỗi cái => tối đa 2) |
| sat-grids 61 ngày (mạng) | 4 | song song được với adapt+labels (mạng vs đĩa); lần sau cache => 0 |
| fleet-grid + ex x2 | 12 | 3 tiến trình độc lập (RAM 8 GB x3 = quá 23 GB => tối đa 2) |
| catch-grid + ex x2 | 3 | độc lập với fleet |
| eval + eval-fleet | 10 | độc lập nhau |
| fit 17 loài | ~340 | song song theo loài, 16 nhân: 4 tiến trình => ~85 phút |
| params + test | 3 | — |
| **Tổng** | **~380 tuần tự** (~6,5 giờ) | **~2–2,5 giờ** nếu song song 4 ở khâu fit |
Nếu chỉ nạp snapshot mới và chỉ fit loài có `accepted` thay đổi: cache giúp còn ~40 phút.

## 7. Năm việc đáng làm nhất (tác động x công)

1. **Push nhánh `Data` + đưa `dl-adapt-local.mjs` vào git** (AI-Assistant/ForFish). Công ~30', tác động rất cao: hiện nguồn duy nhất của dữ liệu thô và bộ chuyển đều không có bản dự phòng.
2. **Sao lưu snapshot DataLake + `sdfish-data/runs` sang chỗ thứ hai** (ổ khác/NAS), kèm kiểm tra vhdx WSL nằm ở ổ nào. Công ~1 giờ.
3. **`SDFISH_DATA_DIR` + `scripts/train/run.mjs` + manifest**, bắt đầu bằng stage tới `eval` (chưa đụng fit/PR). Công 1–2 ngày, tác động cao: tái lập một lệnh, hết chuỗi tay §9–11.
4. **Dời 17 script thí nghiệm doc-0 sang `scripts/_archive/`** + thêm mục `package.json` cho nhóm A (`npm run train:*`). Công ~1 giờ, dọn nợ và tạo điểm vào chuẩn.
5. **Tách bảng hồ sơ loài do máy ghi + `profile-sanity.test.ts`**, rồi mới bật timer systemd `sdfish-train` chạy tuần/đêm và mở PR có cổng. Công 2–3 ngày, tác động cuối: bỏ bước tay duy nhất. (Làm sau 3.)

Ghi chú rủi ro: README DataLake hứa "06:00 hằng ngày" nhưng không có lịch => dữ liệu đứng ở 11/10; cần xác định ai chịu trách nhiệm kéo snapshot (timer `refresh.mjs` cần đường hầm sống — phụ thuộc người dán link).
