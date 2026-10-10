# Ops — Kiểm định dự báo cá bằng VỊ TRÍ ĐÁNH BẮT THẬT (C1)

> **Load khi**: muốn biết dự báo cá có **đúng chỗ tàu thật đi đánh** không (không chỉ "phân biệt được" nội bộ), khi chốt B1/B2 (AMM vs soft-OR vs weighted-sum) bằng số, khi cần dữ liệu vị trí tàu để đo, hoặc khi ai hỏi "giấy phép GFW có cản gì không".

covers: scripts/fish-validate-positions.mjs, scripts/gfw-fetch-day.mjs, scripts/dl-collect.mjs, scripts/dl-build-labels.mjs, scripts/dl-eval.mjs, scripts/dl-fit-profiles.mjs
last_verified: 2026-10-10
ttl_days: 180
gate: warn

Hồ sơ gốc: [fish-review-2026-10-03/report-algorithm.md](fish-review-2026-10-03/report-algorithm.md) mục **B8** (lỗ hổng: SDFish chỉ tự kiểm nội bộ) và **C1** (việc này). Chuẩn đo: Hsu et al. 2021 — % vị trí tàu nằm trong 5/50 km của ô HSI cao; không cần CPUE.

---

## 1. Đo cái gì

| Số đo | Nghĩa | Kỳ vọng |
|---|---|---|
| **Lift** | mật độ giờ đánh bắt trong ô điểm ≥ 50 ÷ mật độ nền (giờ/ô toàn lưới có điểm) | > 1,5 là có ích; ≈ 1 là không hơn ngẫu nhiên; < 1 là chỉ sai chỗ |
| **% ≤ 5 km / ≤ 50 km** | phần giờ (và phần vị trí) cách tâm một ô ≥ 50 không quá 5/50 km | Lưới 0,25° ≈ 27 km nên **≤ 5 km rất khắt** (chỉ vùng sát tâm ô); ≤ 50 km ≈ 2 ô — số chính để so với Hsu |
| **p hoán vị** | ≥ 200 lần. Nhiều ngày dự báo → hoán vị **cặp ngày** (vị trí ngày d chấm bằng lưới ngày d'). Chỉ 1 dự báo → hoán vị điểm giữa các ô (ghi rõ `[mode]` trong kết quả) | < 0,05 |
| Theo **nghề** | `all` = điểm `s` mọi loài; `target` = max điểm nhóm loài mục tiêu của nghề | so `target` với `all`: nếu `target` không cao hơn → bảng nghề→loài hoặc hồ sơ loài sai |
| Theo **loài** | giờ của các nghề nhắm loài đó, điểm `sp[loài]` | loài không có trong payload hôm đó → gộp vào dòng "(không có trong payload…)" |

Bảng nghề → loài mặc định (`DEFAULT_GEAR_MAP` trong script, đè bằng `--gear-map file.json`): vây ngừ → ngừ vằn/chù/ồ · vây khác → cá nổi nhỏ + ngừ vằn · câu vàng khơi → vây vàng/mắt to/cá cờ · câu tay → ngừ vằn · kéo → 8 loài đáy · câu mực → mực xà/ống. Nghề khác (`fishing`, `set_gillnets`, `fixed_gear`…) chỉ tính vào TỔNG.

## 2. Lấy dữ liệu vị trí

### 2a. Global Fishing Watch — LẤY ĐƯỢC THẬT, không cần tài khoản
- Bộ **fleet-daily-csvs-100-v3** (0,01° × ngày, cột `date,cell_ll_lat,cell_ll_lon,flag,geartype,hours,fishing_hours,mmsi_present`), 2012–2024, trên Zenodo record **14982712** (open access, không đăng nhập). Mỗi năm là một zip 0,1–3,35 GB; `scripts/gfw-fetch-day.mjs` dùng HTTP Range đọc mục lục zip rồi chỉ tải **đúng 1 ngày (~7 MB nén)**:
  ```bash
  node scripts/gfw-fetch-day.mjs --date 2024-10-01 --out /tmp/gfw-2024-10-01.csv   # mặc định hộp 5–22°N 102–118°E
  ```
  Đo thật 2026-10-03, ngày 2024-10-01 trong hộp: 59.425 dòng; **VNM 20.411 giờ đánh bắt / 14.278 ô** (CHN 12.778; UNKNOWN-VNM 1.226). VNM theo nghề: kéo 12.297 h · rê 2.249 · câu vàng khơi 1.984 · `fishing` 1.973 · câu đáy 974 · câu tay 320 · vây 214. Theo vĩ độ: 10–12°N nhiều nhất (8.041 h), 6–10°N 6.375 h, bắc 14°N thưa (≤ 1.245 h mỗi dải 2°).
- Năm 2024 là **tạm** (GFW ghi "provisional", phân loại tàu có thể đổi). Bản mới hơn 2024: qua API 4Wings (`public-global-fishing-effort:latest`, cần token tại globalfishingwatch.org/our-apis/tokens, miễn phí **chỉ phi thương mại**, trần 50.000 request/ngày, 1,5 triệu/tháng, ≤ 5 token/người) — chưa làm, chưa cần.
- Cột `hours` là giờ CÓ MẶT; script chỉ dùng `fishing_hours` (giờ bị mô hình GFW gán là đang đánh bắt). Giờ AIS **không phải sản lượng**: tàu đậu lâu ở chỗ ít cá cũng ra nhiều giờ.

### 2b. Nguồn Việt Nam — DataLake thủy sản (LẤY ĐƯỢC từ 2026-10-10, xem §9)
DataLake của Cục (bản thử, đường hầm trycloudflare đổi địa chỉ — hỏi đội DataLake qua cổng góp ý Giám sát MKN; khoá `DATALAKE_MCP_KEY` trong `.env.local` của repo IUU) có `logbooks` (nhật ký eCDT theo chuyến: sản lượng theo loài mã ASFIS, số mẻ, bốc dỡ có/không giám sát — **KHÔNG có toạ độ mẻ**, `fishingArea` trống 97 %), `trips` (giờ rời/cập), `vessels/{id}/track` (điểm VMS 1–2 h/điểm, ≤ 31 ngày/lần, lịch sử từ ~7/2026), `vessels` (nghề, chiều dài). Dùng để **huấn luyện** lớp cá (chủ dự án chốt 2026-10-10). API trả cả tên/SĐT chủ tàu — bộ tải BỎ ngay, dữ liệu ở `~/sdfish-data`, NGOÀI repo.

### 2c. Nguồn Việt Nam cũ — mục ghi trước khi có DataLake
- **VMS Cục Thuỷ sản** (~30.000 tàu ≥ 15 m, 97–100 % đã lắp theo báo chí 2024–2026): dữ liệu vận hành nhà nước, **không công khai**; GFW hỗ trợ VN từ 2019 nhưng không phát hành VMS VN. Đường đi: SDVICO xin qua Cục/Chi cục theo thoả thuận — việc kinh doanh, không phải việc code.
- **Nhật ký khai thác điện tử / eCDT**: hệ truy xuất nguồn gốc của cơ quan quản lý, không có API công khai.
- **Nhật ký chuyến trong app** (tự có, ít, nhưng là dữ liệu CÓ sản lượng): khi đủ vài trăm chuyến thì xuất CSV `lat,lon,hours,geartype,date` và chạy cùng script này — đó là nguồn duy nhất đo được "có cá" chứ không chỉ "có tàu".

## 3. Chạy

```bash
# 1 dự báo + 1 ngày vị trí (p theo hoán vị điểm giữa các ô)
node scripts/fish-validate-positions.mjs --forecast fc-2024-10-01.json --positions gfw-2024-10-01.csv --flag VNM --json out.json
# nhiều ngày (p theo hoán vị NGÀY — mạnh hơn): thư mục JSON, mỗi file có `date` khớp cột date của CSV
node scripts/fish-validate-positions.mjs --forecast ./fc-dir --positions gfw-many-days.csv --flag VNM --perm 500
# tự kiểm bằng dữ liệu giả (không đụng src/)
node scripts/fish-validate-positions.mjs --selftest
```
- `--forecast`: payload `buildFishForecast` (`{date, cells:[{lat,lon,s,sp}]}`), hoặc object có `forecast.cells`. **Sinh payload cho ngày quá khứ**: `npx tsx scripts/fish-validate-run.mjs --dates 2024-01-15,2024-07-15 --out <dir>` — tải SST CoralTemp · chl VIIRS-DINEOF · SLA · anomaly theo NGÀY từ CoastWatch + ETOPO (cache `<dir>/grids/`, chạy lại không tải lại), **không có HYCOM/Copernicus** (term thermo/bottom/deep/conv bị bỏ → payload thận trọng hơn production). Ra `<dir>/payload-<D>.json` (đúng production) và `<dir>/payload-fill/` (lấp ô biển bị KEEP_MIN cắt = 0, sp thiếu = 0 — để tàu đánh ở chỗ mô hình nói "lạnh" được tính vào nền; đọc cả hai). **Phải cùng ngày với vị trí** (ảnh vệ tinh ngày d, tàu ngày d).
- `--threshold 50` · `--perm 200` (tối thiểu 200) · `--radius 5,50` · `--min-hours 0` · `--seed 7` (lặp lại được).
- Vị trí ngoài lưới dự báo và vị trí có ngày không khớp bị bỏ và **đếm** ở dòng đầu kết quả — nếu "ngoài lưới" lớn thì hộp tải không khớp lưới, không phải dự báo kém.
- So AMM / soft-OR / weighted-sum: sinh 3 payload từ cùng lưới đầu vào, chạy 3 lần cùng CSV, so cột lift + p — chốt B1/B2.

## 4. Đọc kết quả — bẫy đã biết
- **Lift ≈ 1 với lưới ngẫu nhiên** là đúng (đã thử: 0,99, p 0,57 trên 14.278 ô VNM) — nếu dự báo thật cũng ≈ 1 thì dự báo không hơn ngẫu nhiên, không phải script hỏng.
- Nghề `trawlers` chiếm 60 % giờ VNM → TỔNG bị cá đáy kéo; đọc theo nghề/loài trước khi kết luận.
- Dự báo nhắm **cá nổi lớn xa bờ**; tàu kéo/rê đánh ven bờ 10–12°N — lift thấp ở nhóm đó không chứng minh hồ sơ ngừ sai.
- Tàu nhỏ < 15 m không có AIS lẫn VMS: vùng ven bờ miền Trung thưa dữ liệu không có nghĩa là không ai đánh.
- Một ngày = một mẫu. Kết luận cần ≥ 10 ngày rải 4 mùa (hoán vị ngày mới có nghĩa).

## 5. Giấy phép — kết luận
GFW v3 trên Zenodo và API đều **CC BY-NC 4.0** (README chính thức: "Non-Commercial Use Only"; GFW không bán giấy phép thương mại đại trà, liên hệ support@globalfishingwatch.org). Không phải CC BY-SA như bản v1/v2 cũ trên Earth Engine. Áp vào SDFish:
- **Kiểm định nội bộ** (chạy script, đọc số, chỉnh hồ sơ loài): dữ liệu không vào app, không vào kho dữ liệu phát ra, không được bán lại. Đây là vùng xám của NC ("private, internal uses that support a commercial product" — GFW nói giấy phép hiện tại *không đủ*). Quyết định: **dùng được cho nghiên cứu đối chiếu một lần, ghi nguồn; KHÔNG nhúng dữ liệu, KHÔNG dùng làm đầu vào huấn luyện tự động định kỳ, KHÔNG công bố số liệu GFW ra ngoài.** Muốn dùng lâu dài (lớp "tàu đang đánh ở đâu", fit trọng số mỗi tuần) → phải hỏi GFW bằng văn bản trước.
- Share-alike: **không có** trong BY-NC, nên không kéo mã/hồ sơ loài vào copyleft. Ràng buộc thật là NC, không phải SA.
- Ghi nguồn khi nhắc trong tài liệu: *Global Fishing Watch. 2025. Global AIS-based Apparent Fishing Effort Dataset, Version 3.0. doi:10.5281/zenodo.14982712*.

## 6. Nợ / việc mở
- Payload kiểm định thiếu HYCOM (D20/nhiệt đáy/250 m) + Copernicus (hội tụ): chưa đo được phần đó của production; có cube lịch sử thì thêm vào `extra` ở `fish-validate-run.mjs`.
- 8 ngày = 8 mẫu cho hoán vị NGÀY — chỉ phân biệt được hiệu ứng lớn; muốn p theo ngày có răng cần ≥ 20 ngày (~30 s GFW + ~5 s ERDDAP mỗi ngày).
- Rate limit Zenodo không công bố; script thử lại 3 lần, chưa có backoff dài.
- `% ≤ 5 km` với lưới 0,25° gần vô nghĩa; khi có lưới mịn hơn mới so trực tiếp với Hsu.

## 7. Chạy đầu 2026-10-03 — mô hình HEAD `fix/ngu-o-mua`, 8 ngày 2024 rải 4 mùa, tàu VNM
Ngày 01-15 · 02-15 · 04-15 · 05-15 · 07-15 · 08-15 · 10-01 · 11-15 (ERDDAP đủ, không đổi ngày). VNM 132.593 h / 90.686 ô-ngày trong lưới; trawlers 63 %, drifting_longlines 5.959 h, pole_and_line 1.071 h, other_purse_seines 655 h. Chi tiết + bảng theo ngày: `scratchpad/team2/result-c1b.md` (phiên 2026-10-03).

| Nhóm (gộp 8 ngày, hoán vị ngày 200) | lift prod | lift fill | p (ngày) |
|---|---|---|---|
| Tổng điểm s | 3,59 | 5,14 | ≈ 0,5 |
| trawlers → cá đáy | 1,75 | 9,35 | 0,36 |
| drifting_longlines → vây vàng/mắt to/cờ | **0,79** | 2,05 | 0,44 |
| other_purse_seines → cá nổi nhỏ | 2,16 | 5,53 | 0,50 |
| pole_and_line → ngừ vằn | **0,00** | 0,00 | 1 |
| Ngẫu nhiên (hoán vị ô) · chéo mùa (lưới +4 tháng) · nền đáy 20–200 m | 1,05 · **3,52** · — | — · — · 1,89 | — |

Đọc ra:
- Bản đồ "Mọi loài" đúng chỗ tàu đánh (mỗi ngày p 0,005 theo ô, thắng nền đáy thô) **nhưng gần hết là địa lý tĩnh**: lưới ngày cách 4 tháng cho 3,52 ≈ 3,59; p hoán vị ngày ≈ 0,5 ở mọi nhóm. Tín hiệu "hôm nay cá ở đâu" từ SST/chl/SLA/anom **chưa đo được** bằng vị trí tàu.
- Cá đáy đúng chiều (7/8 ngày > 1; 05-15 = 0,51). **Cá ngừ xa bờ đang chỉ sai chỗ**: lift 0,79, 3/8 ngày không giờ câu nào trong ô nóng (kể cả 10-01 với 1.896 h); vây vàng 0,30 · mắt to 0,66 · cá cờ 0,10. **Ngừ vằn 0 giờ trong ô ≥50 cả 8 ngày** (1.728 h).
- Vì sao có hai cột prod/fill: production bỏ ô s < 25 (KEEP_MIN) và sp < 25 → kiểm định đọc payload gốc coi giờ tàu ở ô bị bỏ là "ngoài lưới", mô hình không bị phạt khi tàu đánh ở chỗ nó cho là lạnh; `fill` lấp 0 để tính vào nền. Prod đo *xếp hạng trong vùng loài*, fill đo *vùng so với cả biển*; DL 0,79 vs 2,05 = đúng vùng, sai xếp hạng trong vùng.

**Cổng cho các nhánh thuật toán** (chạy cùng 8 ngày, lưới đã cache): **G1** `Δdyn = lift(cùng ngày) − lift(lưới +4 tháng)` theo nhóm — HEAD ≈ 0 (tổng +0,07 · TR +0,21 · DL +0,23); nhánh phải ≥ HEAD, không âm ở DL — lift tĩnh tăng mà Δdyn không tăng là chỉ tô thêm thềm lục địa. **G2** DL target prod ≥ 1,0; vây vàng/mắt to ≥ 0,66; ngừ vằn > 0. **G3** không lùi: trawlers target prod ≥ 1,66; tổng fill ≥ 4,9; ngẫu nhiên 1 ± 0,1; % ô ≥50 ≤ 14,7 % + 2 điểm. Đọc p hoán vị NGÀY, không phải hoán vị ô.

## 8. Chạy thứ hai 2026-10-03 — GỐC 11e3180 vs BẢN GỘP c78+c3+c2+c6 (+ sàn rạn), cùng 8 ngày, cùng CSV

Payload gốc: `--features base` trên worktree 11e3180; payload gộp: `--features full` (khí hậu vùng–tháng + lưới rạn + front mịn stride 2/1 tải thêm cho 8 ngày, ~1,6 + 2,7 MB mỗi ngày).

| Nhóm → loài mục tiêu | gốc prod | gộp prod | gốc fill | gộp fill |
|---|---|---|---|---|
| tổng | 3,59 (p 0,50) | 3,75 (p 0,76) | 5,14 | 5,26 |
| trawlers → cá đáy | 1,75 | **1,61** | 9,35 | **8,08** |
| drifting_longlines → vây vàng/mắt to | 0,79 | **0,66** | 2,05 | **1,67** |
| other_purse_seines → cá nổi nhỏ | 2,16 | 2,30 | 5,53 | 6,85 |
| pole_and_line → ngừ vằn | 0,00 | 0,28 | 0,00 | 1,74 |
| ngừ vây vàng (loài) | 0,30 | 0,36 | | |
| ngừ mắt to (loài) | 0,66 | 0,66 | | |
| cá cờ (loài) | 0,10 | 0,09 | | |
| mực xà (squid_jigger 56 h) | 0,00 | 0,00 | | |

Đọc: mọi p hoán vị ngày 0,24–0,96 — 8 ngày KHÔNG phân biệt được gốc/gộp. Chiều: cá nổi nhỏ và ngừ vằn lên, câu vàng khơi và lưới kéo xuống (cả hai cách giải thích đều hợp: lưới kéo giảm vì cổng rạn hạ cá hồng/kẽm trên thềm bùn — mà lưới kéo lại bắt chúng ở đó; câu vàng giảm vì ô nóng vây vàng tăng 3.129→3.927 làm loãng mật độ). G1 (Δdyn) chưa chạy lại cho bản gộp. Việc kế tiếp theo tiêu chí 2 (có số đo mới đổi): (1) ≥20 ngày + HYCOM lịch sử để p có răng; (2) soát hồ sơ cá ngừ khơi theo chính ô câu vàng thật (lift <1 cả trước và sau là lỗi hồ sơ, không phải thuật toán); (3) xem lại `REEF_ABSENT_FIT` bằng chính lift lưới kéo khi đủ ngày.

## 9. Huấn luyện + kiểm định bằng DataLake (2026-10-10) — 107.109 nhật ký × track VMS 27.578 tàu, 8–9/2026

**Chuỗi script** (offline, dữ liệu ngoài repo ở `~/sdfish-data`):
```bash
DATALAKE_BASE=https://<đường hầm>.trycloudflare.com node scripts/dl-collect.mjs --env ../IUU/.env.local --from 2026-08-01 --to 2026-09-30   # tải (nối tiếp được)
node --max-old-space-size=8192 scripts/dl-build-labels.mjs [--trust monitored]        # nhãn ô 0,05° × ngày
npx tsx scripts/fish-validate-run.mjs --dates <…> --out ~/sdfish-data/fc-full --features full   # payload + lưới cache
npx tsx scripts/dl-eval.mjs --payloads ~/sdfish-data/fc-full/payload-fill --perm 300            # kiểm định
npx tsx scripts/dl-fit-profiles.mjs --species "ngừ vằn"                                          # tối ưu 1 loài (~20 phút)
```
- **Vị trí đánh bắt KHÔNG lấy từ lời khai** — chỉ từ VMS: đoạn giữa hai điểm có tốc độ trong dải của nghề = đang đánh. Dải tốc độ tự chỉnh bằng tương quan Spearman giữa số đợt tìm được và `haulCount` (ưu tiên nhật ký điện tử): rê 0–1 kn ρ 0,60 · câu 0,3–1,5 ρ 0,56 · kéo 1,5–2 ρ 0,46 · vây 0,6–5 ρ 0,67 · lưới chụp 0,3–1 ρ 0,29.
- **Lời khai sai** (loài/kg): bốc dỡ không giám sát ×0,5 (10.202 chuyến) · sản lượng y hệt chuyến khác cùng tàu ×0,3 (288) · khai thác ≠ bốc dỡ > 2 lần ×0,7 (281) · khai có cá mà VMS không thấy đoạn đánh ⇒ loại (1.085) · kg/giờ > p99 nghề ⇒ kéo về p99 (257). Bản `--trust monitored` (chỉ chuyến có giám sát) cho cùng chiều kết luận.
- **Số đo chính — AUCeff**: P(ô của 1 kg cá loài s có điểm cao hơn ô của 1 giờ đánh của nhóm nghề bắt s). 0,5 = không hơn "chỗ tàu hay đi". Δdyn = AUCeff cùng ngày − AUCeff ghép dự báo ngày khác (hoán vị 300).

**Kết quả kiểm định** (31 ngày, 36.569 chuyến, 2,28 triệu giờ đánh):
- Bản đồ "Mọi loài": AUCarea 0,71 nhưng AUCeff **0,47** ⇒ chỉ đúng chỗ tàu hay đi, KHÔNG chỉ chỗ năng suất cao. Kéo xuống chủ yếu bởi cá nục (0,485, 11,6 nghìn t) và ngừ ồ (0,447, 3,4 nghìn t).
- Δdyn ≈ 0 ở đa số loài — tín hiệu "hôm nay" từ ảnh vệ tinh gần như chưa đo được; có nghĩa: ngừ vằn (HEAD +0,018 p 0,003), ngừ chấm, bạc má, cá phèn, cá chim.
- Bản WIP 2026-10-10 (soft-OR cá nổi lớn 0,6, trái vụ ×0,6) so HEAD: ngừ vằn 0,645→0,697, ngừ vây vàng 0,606→0,665, cá thu, mực ống, cá mối, nục heo tăng; ngừ chấm 0,524→0,490 giảm; Δdyn ngừ vằn mất (0,018→0,002).

**Tối ưu tham số hồ sơ** (`dl-fit-profiles`; gập tháng 8 ↔ 9, nhận khi cả hai chiều không tệ đi và TB tăng ≥ 0,01). Lượt 1 dò phù du tới −0,4, lượt 2 tới −1,0 (trên code WIP chưa commit) → 17 loài; KIỂM LẠI trên code `main` bằng `--cfg` (không dò lại) kèm LUẬT NGHIỆP VỤ: loài tầng mặt KHÔNG hạ phía nóng dải nhiệt (test "trần nhiệt", 2026-10-03), không dò `coastKm` đã khai riêng (ngừ vằn, nục heo) ⇒ **ĐÃ ÁP 15 loài vào `SPECIES_PROFILES` (2026-10-10)**, mỗi dòng có chú thích "fit DataLake" ghi AUCeff trước/sau từng tháng. Rơi khi kiểm trên `main`: mực ống (phần tăng chỉ có trên code WIP), cá sòng (toàn bộ phần tăng đến từ hạ trần nhiệt — cấm). Kết quả: `~/sdfish-data/fit-main2/fit-<loài>.json`.

| Loài | AUCeff trước → sau (cả kỳ) | Tháng 8 (đo) | Tháng 9 (đo) |
|---|---|---|---|
| ngừ ồ | 0,447 → 0,588 | 0,426 → 0,528 | 0,446 → 0,644 |
| cá nục | 0,485 → 0,552 | 0,497 → 0,565 | 0,469 → 0,536 |
| bạc má | 0,681 → 0,770 | 0,660 → 0,760 | 0,677 → 0,774 |
| cá cơm | 0,600 → 0,676 | 0,560 → 0,661 | 0,630 → 0,687 |
| cá đổng · cá tráo · cá trích · cá phèn · cá hố · bạch tuộc · ngừ chù · ngừ chấm · ngừ vằn · nục heo · mực nang | cả kỳ: cá đổng 0,523→0,595 · cá tráo 0,436→0,526 · cá trích 0,488→0,556 · cá phèn 0,603→0,639 · cá hố 0,497→0,520 · bạch tuộc 0,681→0,741 · ngừ chù 0,617→0,641 · ngừ chấm 0,524→0,562 · ngừ vằn 0,645→0,668 · nục heo 0,521→0,551 · mực nang 0,501→0,523 | | |

Test đổi kèm: `fish-predict.test.ts` "VIỆC 4" đổi chl mẫu 4,0 → 1,0 cho cá phèn (giá trị cũ vượt dải mồi mới — test cô lập nhiệt đáy, không khoá dải mồi).
- Dải phù du `chlLog` lệch cao có hệ thống (cùng nguồn VIIRS DINEOF với production nên không phải lệch nguồn): lượt 1 13/16 dừng ở mép −0,4; lượt 2 cá nục, cá đổng, cá tráo, cá phèn, cá hố vẫn dừng ở mép −1,0 ⇒ với nhóm này điều có ích nhiều khả năng là GIẢM ảnh hưởng phù du hẳn (việc mở: đo phương án tắt cổng mồi chung); 7/15 loài đã áp có `foodDependence` 0–0,5.
- Giữ nguyên nhưng hồ sơ dưới 0,5 (chỉ ngược): **cá chim 0,395** — cần soát tay; cá cờ 0,514 ngang ngẫu nhiên.
- Giới hạn: MỘT mùa (gió Tây Nam), tàu có VMS (chủ yếu ≥ 15 m), payload dựng lại thiếu HYCOM/Copernicus — từ 2026-10-10 kho `forecast-archive` (04 §0058) lưu lưới đầu vào production mỗi ngày để lần sau fit đúng bản thật.
