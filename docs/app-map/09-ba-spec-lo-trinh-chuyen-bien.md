# 09 — ĐỀ XUẤT: Lộ trình chuyến biển nhiều ngày (route suggest)

> **Trạng thái: ĐỀ XUẤT — đã chốt 4 quyết định khung (2026-07-28), chưa build.** Kết quả
> nghiên cứu team-agent 2026-07-28 (3 hướng: kiểm kê repo · thuật toán · nghiệp vụ chuyến biển).
>
> **CHỦ DỰ ÁN CHỐT (2026-07-28):**
> 1. **Premium toàn phần** — dùng dữ liệu premium, tối đa **16 ngày** (khớp trần lưới d16 sẵn có).
> 2. **Rà nguồn dữ liệu** cho chuẩn 16 ngày — xem §5b (việc phải làm theo từng nguồn).
> 3. Tính xong **cho LƯU lộ trình** lại (theo tàu).
> 4. **Offline so VỊ TRÍ HIỆN TẠI với lộ trình** đã lưu (GPS máy chạy không cần mạng).

## 0. Một đoạn tóm tắt

Ngư dân nhập: **đi mấy ngày + (tùy chọn) điểm quen/chà muốn ghé** → app đề xuất **lịch chuyến
theo ngày** (chạy ra → đánh ở 2–3 vùng cá tốt → về), vẽ trên bản đồ, kèm 3 con số: **lít dầu ·
hải lý · ngày nên quay về**. Mục tiêu đo được: tăng xác suất có cá bằng cách dồn GIỜ-ĐÁNH vào
ô điểm cá cao (lưới 2237 ô 0–100 sẵn có) thay vì tối ưu đường ngắn nhất. Bài toán thuộc lớp
**Time-Dependent Orienteering có điểm bắt buộc** — giải bằng heuristic 5 bước chạy <2s
trên máy (Web Worker), không cần server. Số liệu đối chứng quốc tế (INCOIS PFZ Ấn Độ, hệ tương
đồng nhất): giảm 30–70% giờ tìm cá, CPUE gấp 2–4 lần vùng ngoài; weather routing tiết kiệm
~3–7% dầu. **Chưa app nào trên thế giới làm tuyến nhiều ngày hoàn chỉnh** (Laut Nusantara
Indonesia dừng ở điểm-gần-nhất + lít dầu; Ocean Eyes Nhật dẫn tới ngư trường) — SDFish làm
được là đi trước, nhưng phải hạ khiêm tốn: tuyến = **chuỗi điểm theo ngày**, không phải đường
vẽ liền tối ưu từng hải lý.

## 1. Bài toán — đặt tên cho đúng để khỏi giải sai

- Tên chuẩn: **single-vehicle Time-Dependent Orienteering Problem with Mandatory Visits +
  variable profits** (OP: Tsiligirides 1984, survey Vansteenwegen 2011; TDOP: Fomin & Lingas;
  variable profits: Erdoğan & Laporte 2013).
- Nghĩa đời thường: **không phải "đi qua hết các điểm bằng đường ngắn nhất" (TSP)** mà là
  "**chọn nên ghé vùng nào, ở lại bao lâu**, trong ngân sách D ngày, sao cho tổng điểm cá của
  các GIỜ-ĐÁNH cao nhất" — quãng đường/dầu là ràng buộc + tie-breaker, không phải mục tiêu.
  Một tuyến dài hơn 10% nhưng đánh vùng 90 điểm thay vì 60 điểm là tuyến TỐT HƠN.
- Hàm mục tiêu: `max Σ fishScore(ô) × w(ngày) × mask_giờ_hợp_lệ(nghề, sóng)` trên các giờ đánh;
  ràng buộc: `Σ giờ chạy + giờ đánh + giờ chờ ≤ D×24`, dầu ≤ két, né bão/VMS/ranh giới,
  về đúng cảng trước hạn. Diminishing returns theo ngày-tại-cụm (×0.9/ngày) để ép cân nhắc
  2–3 vùng thay vì cắm một chỗ.
- Quy mô thật NHỎ: 2237 ô cá gom cụm còn ~15–25 "vùng đánh" ứng viên; điểm bắt buộc ≤5;
  tuyến chỉ ghé 1–4 vùng → heuristic đạt ~90–95% optimal trong sub-second (kinh nghiệm
  literature tourist-trip-design).

## 2. Đã có gì trong repo (kiểm kê 2026-07-28 — file:line trong báo cáo gốc)

**Viên gạch tái dùng NGAY** (không viết lại):

| Viên gạch | Ở đâu | Vai trò |
|---|---|---|
| `planRoute` 1 chặng + cost model sóng/gió/dòng/cạn theo giờ + ước lít dầu | `lib/route-plan.ts` (Dijkstra ≤7500 nút, Web Worker sẵn `route-plan-async.ts`) | Tính từng chặng của hành trình; đã có `departHourIdx` → chặng sau truyền giờ cộng dồn |
| Lưới cá 2237 ô 0,25°, điểm 0–100, theo loài, bands 40/60/75 | `lib/fish-predict.ts` + `/api/fish-forecast` (snapshot + cron 6h) | Prize của orienteering |
| Gió/sóng THEO GIỜ 16 ngày (80 điểm, bước 3h→6h→12h) + theo tuyến 72h (~0,35°) | `lib/forecast-grid.ts`, `lib/route-weather.ts` | Cost phụ thuộc thời điểm + mask giờ đánh |
| Cổng bão hành lang 200km + polygon GDACS | `lib/route-storm.ts` (`routeStormConflict`, `sampleRoute` 25km) | Gate an toàn — gọi 1 lần cho waypoints nối |
| `pointInRing`, `distToSegmentKm`, haversine/bearing | `lib/route-storm.ts`, `lib/route-plan.ts` | Point-in-polygon cho VMS/vùng lộng/ranh giới |
| Polygon VMS 3 vùng + vùng lộng + `borderProximity` 6/15nm + `boatZone(lengthM)` | `data/vms-zones.json`, `data/vn-fishing-zones.ts`, `lib/geofence.ts`, `lib/departure-check.ts` | Ràng buộc vùng hợp lệ |
| Độ tin theo tầm ngày (`horizonPrior` d0≈0,95→d14≈0,34, ensemble, skill backtest) | `lib/forecast-quality.ts`, `forecast-skill.json` | Nhãn tin cậy từng ngày của lịch chuyến |
| Pretrip offline (tải sẵn lưới 3/7/16 ngày + bản đồ cá trước khi rời bờ) | `lib/pretrip.ts` | Offline-first cho chuyến dài |
| Điểm đã lưu (`places.ts` home/spot), giá dầu (`fuel-price.ts`), premium gate middleware | — | Điểm quen · quy dầu ra tiền · gating |

**5 lỗ hổng chí mạng phải xử trong thiết kế:**

1. **Lưới cá KHÔNG có trục thời gian** — một bản cho mọi ngày; đã đo ổn định tới D+3
   (Jaccard 0,93–0,98) nhưng chuyến 7–15 ngày nằm NGOÀI mốc đã kiểm chứng.
   *Tin tốt:* `lib/sst-tendency.ts` (dự báo xu hướng nhiệt D+1..D+3, α cross-validated, có test)
   **đã viết xong nhưng chưa nối** vào `fish-forecast-run.ts` (tham số `frontSst` có sẵn chờ) —
   nối lại là việc rẻ nhất mở khóa nhiều nhất.
2. **Dự báo theo tuyến chỉ 72 giờ** (`route-weather.ts FORECAST_DAYS=3`) — quá 72h mô hình
   đóng băng giờ cuối; lối thoát hiện có là lưới Windy 16 ngày (thô 1,7°×2,1°, thiếu chu kỳ
   sóng + dòng chảy) qua `gridToWeatherField`.
3. **Chưa có multi-waypoint** — `PlanArgs` chỉ start→dest; không có chuỗi chặng, giờ dừng đánh,
   vòng về cảng.
4. **Chưa có code tối ưu thứ tự** (grep TSP/multi-waypoint = 0 kết quả) — phải viết mới
   (n≤10 → Held-Karp/greedy+2-opt là đủ).
5. **`MAX_DETOUR_RATIO=1,3` sẽ phản tác dụng** — tuyến đi TÌM CÁ bản chất là cố ý đi vòng;
   tái dùng `planRoute` phải có cờ tắt/nới trần cho chặng "đi tìm cá".

Lỗ nặng khác: hồ sơ tàu thiếu **két dầu + loại nghề** (tốc độ/lít-giờ đang nằm localStorage
riêng không gắn boatId, mặc định 7kn/20L·h); VMS polygon **chỉ để vẽ** chưa ai kiểm ràng buộc;
kiểm bão không trục thời gian → chuyến 10 ngày mùa bão sẽ bị chặn gần hết Biển Đông (GDACS
không cho mốc giờ track — cần bổ sung nguồn nếu muốn nới); cost model chỉ tính giờ CHẠY máy,
chưa có dầu chế độ neo/trôi/chong đèn.

## 3. Phương án thuật toán (pipeline 5 bước, <2s, Web Worker)

```
INPUT: D ngày · mandatory[] (cảng đi/về + 0–5 điểm quen/chà) · boat{speedKn, litersPerHour,
       fuelCapacityL, gear} · fishGrid (tĩnh + w(ngày)) · seaScore[ô][giờ] 16 ngày ·
       vmsPolygons · storms

B0  Feasibility mask: loại ô trong vùng cấm VMS/ngoài ranh giới/hành lang bão + vùng lộng
    nếu tàu ≥15m (pointInRing sẵn có; O(2237×polygon) ≈ vài ms)
B1  Cluster ô cá ≥ p80 thành ~15–25 "vùng đánh" (flood-fill 8 hướng; prize=Σscore, peak, bán kính)
B2  Route skeleton (OP heuristic): khung = [cảng đi, mandatory theo nearest-neighbor, cảng về];
    greedy insertion vùng đánh theo prize/Δcost (Δcost = legCost time-dependent tra bảng),
    rồi 2-opt + thử THAY vùng trong tuyến bằng vùng ngoài
B3  Lịch giờ (điểm ăn tiền): mô phỏng tiến theo giờ — chạy khi seaScore đủ an toàn, biển động
    thì neo chờ/dời giờ; giờ đánh lọc theo nghề (câu ngừ/chụp mực = đêm; vây ngày = sáng) và
    con trăng (nghề đèn nghỉ trăng sáng); prize thật = Σ fishScore×w(ngày)×0.9^ngày-tại-cụm;
    tính lùi "giờ nhổ neo muộn nhất" để về đúng hạn; vượt budget → bỏ vùng ratio thấp (repair)
B4  GRASP vòng ngoài: 10–30 restart greedy-ngẫu-nhiên-top-3, giữ plan prize cao nhất, cắt 1,5s
B5  Hậu kiểm: routeStormConflict trên waypoints nối + kiểm két dầu (Σ lít × hệ số dự phòng
    1,3 ≤ két) + gắn nhãn tin cậy theo ngày (forecast-quality)
```

- **Thời tiết 2 tầng** (chuẩn voyage-optimization): per-leg time-dependent làm mặc định
  (bảng tra cụm↔cụm × mốc 3h, precompute ~100ms); chặng nào penalty sóng vượt ngưỡng mới chạy
  Dijkstra né sóng đầy đủ (chính là `planRoute` hiện có) CHỈ cho chặng đó. Không isochrone
  toàn cục (845k state — không cần).
- **Prize 16 ngày = lớp cá pha trộn** (user chốt): `fishBlend(ô, d)` với w(d) tối ưu từ backtest
  (§5b) — thuật toán TỰ ưu tiên vùng dự báo vào các ngày đầu, nghiêng dần về vùng mùa vụ +
  điểm quen ở nửa sau chuyến. **Cơ chế này NGẦM trong tính toán, KHÔNG lộ ra UI** — không nhãn
  "3 ngày đầu tin được", không vẽ mờ phần sau; lịch chuyến hiện là MỘT kế hoạch liền mạch.
- **Re-plan** (Phase 2): khi có bản đồ cá mới / bão đổi trạng thái, lấy vị trí hiện tại làm điểm
  đầu mới — pipeline <2s nên re-plan ngay trên máy, offline vẫn chạy với bản đã lưu (ghi rõ
  tuổi dữ liệu — bài học offline-16d).

## 4. Nghiệp vụ + UX (người dùng 40–60 tuổi, ít rành công nghệ)

**Mẫu chuyến theo nghề** (neo tham số mặc định):

| Nghề | Chuyến | Đánh lúc | Đặc thù |
|---|---|---|---|
| Câu cá ngừ đại dương | 15–30 ngày, ngư trường >200 hải lý, chạy ra ~3 ngày | Đêm (thả chiều, thu rạng sáng) | Cá ngừ chuẩn sashimi phải về ≤7 ngày sau con cá ĐẦU TIÊN → "ngày nên quay về" tính từ lúc bắt đầu đánh |
| Lưới vây | 5–7 hoặc 20–25 ngày | Đêm (vây đèn) / ngày (vây đuổi) | — |
| Lưới rê khơi | 10–20 ngày | Thả chiều, trôi đêm, thu sáng | — |
| Chụp mực | 5–10 ngày | Đêm, **nghỉ kỳ trăng sáng** | Lịch chuyến bám con trăng âm lịch |

**Hình hài tính năng (user chốt 2026-07-28): MỘT tính năng "Đề xuất lộ trình"** — một form nhập
rồi bấm tính, không phải wizard nhiều màn:

| Ô nhập | Dạng | Ghi chú |
|---|---|---|
| **Chọn ngày** | ngày xuất bến + đi mấy ngày (chip 7/15/20/25, tự do tối đa 16 do trần dữ liệu) | chuyến khai >16 ngày vẫn tính được 16 ngày đầu + nói rõ |
| **Chọn nghề** | chọn hình: câu cá ngừ / lưới vây / lưới rê / chụp mực | **MVP tune cho CÂU CÁ NGỪ** (chuyến dài, giá trị cao, đúng tập premium); nghề khác dùng mẫu tham số tạm, tune sau |
| **Thông số liên quan** | cảng xuất bến (10 cảng sẵn) · tốc độ + lít dầu/giờ + két dầu (lấy từ hồ sơ tàu, sửa được tại chỗ) | lưu vào hồ sơ tàu theo boatId, lần sau chỉ xác nhận |
| (Tùy chọn) điểm quen/chà | chấm trên bản đồ hoặc chọn từ điểm đã lưu | 0–5 điểm |

**KHÔNG hỏi gì thêm** (user chốt: không hỏi hầm đá) — "ngày nên quay về" dùng **mặc định theo
nghề**: câu cá ngừ = về ≤7 ngày sau ngày đánh đầu tiên (chuẩn sashimi); nghề khác theo mẫu chuyến §4.
"Waypoint" gọi là **"điểm quen"** — là tài sản kinh nghiệm của thuyền trưởng, hạt nhân của
tuyến; điểm cá của app xếp QUANH điểm quen, không thay thế.

**Output** (nghiên cứu low-literacy: đồ họa 100% hoàn thành tác vụ vs text 0%):
- Tuyến trên **bản đồ** là chính: 1 đường + 2–3 vùng đánh đánh số 1-2-3.
- **Lịch chuyến theo ngày**, mỗi ngày 1 dòng chữ to: "Ngày 1–2: chạy ra vùng A (~36 giờ)" ·
  "Ngày 3–7: đánh vùng A" · "Ngày 8: sang vùng B"…
- **3 con số to**: ~lít dầu cả chuyến (quy ra tiền theo giá dầu) · ~hải lý · **ngày nên quay
  về** (theo đá lạnh/chất lượng cá — hầm tốt 15–20 ngày, cá ngừ ngon ≤7–14 ngày).
- Ranh giới đỏ luôn hiện; tuyến **không bao giờ vẽ vượt ranh** (vượt ranh = án hình sự 5 năm
  đã tuyên + phá nỗ lực gỡ thẻ vàng EC).
- Có bão trong kỳ → banner "Có bão — chưa nên đi / về bờ" **thay cho** lộ trình.
- Disclaimer cố định ngay trên màn (chuẩn "not for navigation" viết đời thường):
  **"Gợi ý tham khảo — thuyền trưởng quyết định. Luôn nghe dự báo chính thức và tin từ tàu bạn."**
  (bộ đàm tổ đội là kênh tin số 1 của ngư dân — app định vị là NGƯỜI PHỤ VIỆC.)

**Không hứa cá**: chỉ nói "vùng có điều kiện tốt" theo thang Được/Khá/Tốt sẵn có, không nói
"có cá", không phần trăm.

## 5. Ràng buộc trung thực + pháp lý (bất biến)

1. Lớp cá 16 ngày = pha trộn dự báo + mùa vụ với w(d) tối ưu từ backtest (§5b). **User chốt
   2026-07-28: KHÔNG đưa phân biệt "cá 3 ngày" hay nhãn độ tin theo ngày vào UI** — trung thực
   xử lý NGẦM bằng tỷ lệ pha trộn đã kiểm chứng số liệu + MỘT disclaimer chung cố định
   ("Gợi ý tham khảo — thuyền trưởng quyết định"). Đổi lại, w(d) BẮT BUỘC có backtest làm căn
   cứ (không đặt tay) — đó là chỗ giữ lời hứa "không hứa quá" thay cho nhãn UI.
2. Quá 72h dự báo tuyến = lưới thô 16 ngày — nhãn tin cậy theo ngày (forecast-quality) hiện rõ.
3. Vùng tranh chấp (Hoàng Sa): **hiển thị, không đề xuất** — ngư dân tự chọn thì tôn trọng,
   app không chủ động chỉ vào.
4. Offline/dữ liệu cũ: ghi rõ "tin cũ N giờ", không giả vờ mới.
5. Tin bão đè mọi thứ — safety-of-life trên hết.

## 5b. Nguồn dữ liệu — việc phải làm cho chuẩn 16 NGÀY (chốt #2)

Nguyên tắc: tuyến tối đa 16 ngày = trần của lưới premium d16 sẵn có; KHÔNG thêm nguồn mới
nếu nguồn cũ với tham số khác là đủ.

| Nguồn / lớp | Hiện tại | Việc phải làm cho 16 ngày | Độ khó |
|---|---|---|---|
| **Gió + sóng theo TUYẾN** (`route-weather.ts`) | `FORECAST_DAYS=3` (72h), 0,35°, ≤120 điểm, kèm chu kỳ sóng + dòng chảy | CÙNG API với lưới d16 (Open-Meteo forecast + marine, sóng `ncep_gfswave025` đã chứng minh chạy 16 ngày ở `forecast-grid.ts:244-256`). Nâng `forecast_days=16` NHƯNG phải quản payload (120 điểm × 384h × 7 trường ≈ vài MB): **72h đầu giữ nguyên theo giờ; 72h–16d hạ bước 6h/12h + bớt trường** (bỏ chu kỳ sóng/dòng chảy ở xa) — đúng khuôn bước giờ 3h→6h→12h của `forecast-grid`. Fallback offline: lưới d16 đã lưu (`gridToWeatherField` sẵn có) | Vừa |
| **Dòng chảy theo tuyến** (marine API, 72h nay) | Có trong 72h | **ĐO THẬT trần `forecast_days` của `ocean_current_*` trên marine API** (chưa ai đo; có thể chỉ 5–10 ngày). Quá trần → bỏ dòng chảy khỏi cost các chặng xa (sai số nhỏ so với sóng/gió) + ghi chú trong plan. Viết probe script kiểu `fish-3day-probe.mjs` | Dễ (probe) |
| **Bản đồ cá — MỘT LỚP PHA TRỘN dùng cả 16 ngày** (user chốt 2026-07-28: KHÔNG phân biệt "cá 3 ngày" trong UI) — ✅ **ĐÃ LÀM XONG 2026-07-28**, xem §5d | Tĩnh 1 bản; `sst-tendency.ts` D+1..D+3 viết xong chưa nối | `fishBlend(ô, d) = w(d)·fishForecast(ô) + (1−w(d))·climatology(ô, tháng)`. (a) Nối `frontSst` → thành phần dự báo D+1..D+3 thật *(còn lại — chưa làm)*; (b) ✅ **climatology mùa vụ** dựng xong từ 6 năm ERDDAP; (c) ✅ **w(d) đo bằng backtest**, không đặt tay; guard always-on-term PASS | (a) Dễ · (b) ✅ · (c) ✅ |
| **Bão** | GDACS không mốc giờ track → gate bảo thủ 200km; chuyến 10+ ngày mùa bão sẽ bị chặn gần hết | Chấp nhận sự thật: **không nguồn nào dự báo bão 16 ngày**. Cách xử: gate cứng chỉ áp cho **cửa sổ 0–5 ngày** (tầm dự báo bão có thật); ngày 6+ không chặn theo bão mà gắn nhãn "mùa bão — sẽ tính lại khi có tin" + **re-plan là cơ chế phòng thủ chính**. Nâng cấp sau: thêm nguồn track CÓ MỐC GIỜ (JTWC/KTTV bulletin) để gate 0–5 ngày so được ETA từng chặng với vị trí bão theo giờ | Vừa (nguồn mới để sau) |
| **Điểm ngày/cảng** (`sea.ts` 16 ngày) + **độ tin** (`forecast-quality`, `forecast-skill`) | Đủ 16 ngày sẵn | Dùng nguyên cho nhãn tin cậy từng ngày của lịch chuyến — không làm gì thêm | — |
| **Premium gate** | Cá: middleware server-side; lưới >3 ngày: đang chặn client | Tính năng này ăn TRỌN dữ liệu premium (cá + lưới 16d) nên gate tự nhiên nằm ở API sẵn có; màn lộ trình check tier như bản đồ cá. **Việc phải làm: dời chặn lưới >3 ngày từ client về server** cho kín (lỗ hổng #13 của kiểm kê) | Dễ |

## 5d. ✅ ĐÃ LÀM: lớp cá 16 ngày (nhánh `feat/fish-climatology-blend`, 2026-07-28)

Nền dữ liệu của lộ trình 16 ngày đã dựng xong và **đo được số thật** — không còn là đề xuất.

**Bản đồ mùa vụ** (`public/data/fish-climatology.v1.json`, 71 KB, SW pre-cache `sdfish-v6`):
- 12 tháng × lưới 0,25° (69×65 = 4485 ô), 1 byte/ô mã base64.
- Nguồn: SST CoralTemp `noaacrwsstDaily` (**6 năm 2020–2025**, mỗi tháng ~18–24 lát ngày) + phù du
  `noaacwNPPVIIRSSQchlaMonthly` (ảnh THÁNG sẵn, 6 năm). Trung bình chl lấy **hình học** (log) vì
  phân bố lệch phải nặng.
- Chấm điểm bằng **ĐÚNG `buildFishForecast` của app** (cùng mùa vụ loài, cổng nhiệt, front) ⇒ điểm
  mùa vụ và điểm dự báo **so sánh được**, pha trộn mới có nghĩa.
- Mùa vụ hiện rõ trong số liệu: ô ≥50 đi từ **8 ô (tháng 10)** tới **123 ô (tháng 12)** — không phải
  một bản chép 12 lần (có test khoá điều này).
- Script: `scripts/collect-fish-climatology.mjs` (chạy lại ~1 lần/năm là đủ).

**Tỷ lệ pha trộn w(d)** (`src/data/fish-blend-weights.json` ← `scripts/fit-fish-blend-weights.mjs`):
backtest 12 mốc gốc (2022–2025, rải 4 mùa) × 7 tầm ngày, ~22–24 nghìn ô/mốc, kiểm chéo 4 nhóm
**theo mốc gốc** (không trộn trong cùng mốc).

| tầm ngày | 1 | 2 | 3 | 5 | 8 | 11 | 16 |
|---|---|---|---|---|---|---|---|
| **w (tin ảnh vệ tinh)** | 0,793 | 0,732 | 0,693 | 0,640 | 0,605 | 0,558 | 0,493 |
| lợi RMSE vs persistence (CV) | +4,8 % | +7,1 % | +7,5 % | +9,9 % | +9,3 % | +10,5 % | +9,9 % |
| lợi RMSE vs mùa vụ thuần (CV) | +38,5 % | +30,7 % | +25,5 % | +21,8 % | +15,9 % | +13,1 % | +7,0 % |

- w **tự nhiên đơn điệu giảm** (không phải do ép) — đúng trực giác: ảnh cũ càng đi xa càng ít giá trị.
- **Pha trộn THẮNG persistence ở MỌI tầm** khi kiểm chéo, kể cả ngày 1. Đây là kết quả DƯƠNG, khác
  hẳn hai lần đo trước (advection phù du, front composite) đều âm.
- Guard **always-on-term PASS**: biên độ w = 0,30, không suy biến (test khoá `guard.degenerate === false`).
- **Caveat ghi thẳng trong file kết quả**: "sự thật" đối chiếu là *bản đồ cá tính từ ảnh ngày T+d*
  (chính sản phẩm app phục vụ), **KHÔNG PHẢI sản lượng cá thật**.

**Code**: `src/lib/fish-blend.ts` — thuần, `blendWeight(d)` nội suy giữa các mốc đo (ngày 0 = 1;
quá mốc cuối GIỮ w cuối, không ngoại suy; bảng suy biến → 1 = giữ persistence), `blendScore`,
`climScoreAt`, `fetchClimatology` **không bao giờ ném** (thiếu → null → giữ nguyên bản dự báo,
bất biến monotonic). 23 test trong `__tests__/fish-blend.test.ts`.

**Offline** (kiểm chứng thật trên trình duyệt, không chỉ test đơn vị): bảng w **nhúng trong bundle**
(không bao giờ phải tải); bản mùa vụ nằm trong SHELL pre-cache của service worker + thêm một bước
"Bản đồ mùa vụ" cuối `pretrip.ts` (lưới an toàn cho máy cài từ bản cũ). Đã chạy Playwright: cắt mạng
hẳn → fetch mạng hỏng đúng như mong đợi nhưng **đọc từ kho vẫn ra đủ 12 tháng**.

**Chưa làm (còn lại của Phase 0)**: nối `sst-tendency.ts` vào `fish-forecast-run.ts` (thành phần dự
báo D+1..D+3 thật — hiện thành phần "dự báo" trong blend vẫn là persistence), probe trần
`forecast_days` của dòng chảy, ràng buộc VMS, dời chặn lưới >3 ngày về server.

## 5c. Lưu lộ trình + offline so vị trí (chốt #3, #4)

**Lưu lộ trình** (sau khi tính xong, 1 nút "Lưu chuyến này"):
- Key localStorage `forfish.routes.v1`, gắn `boatId` (khớp khuôn `forfish.boat.v1`, `forfish.places.v1`;
  GIỮ namespace forfish.* — luật CLAUDE.md). Chưa cần DB ở MVP (điểm quen cũng đang localStorage).
- Bản ghi: `{id, name, boatId, createdAt, dataAges{fish, grid, storm}, days, waypoints[] (toạ độ
  + loại: chạy/đánh/về), schedule[] (ngày → hành động, giờ dự kiến từng mốc), fuelL, distNm,
  returnByDay}` — **lưu cả tuổi dữ liệu lúc tính** để lúc mở lại nói thật "tính từ bản đồ cá N ngày trước".
- Lưu xong tự chạy **pretrip cho tuyến**: tải sẵn lưới d16 + bản đồ cá + gió sóng dọc bbox tuyến
  (tái dùng `pretrip.ts`, thêm các điểm dọc tuyến vào danh sách tải).

**Offline so vị trí hiện tại với lộ trình** (GPS chạy không cần mạng — cùng cơ chế nút "Tôi ở đâu"):
- Mở lộ trình đã lưu → nút "Tôi đang ở đâu so với tuyến": lấy GPS → tính
  `distToSegmentKm` tới polyline tuyến (hàm sẵn ở `route-storm.ts:39`) + đối chiếu lịch
  (giờ hiện tại → đáng lẽ đang ở chặng nào/vùng nào theo `schedule`).
- Hiện 2 dòng chữ to: **"Cách tuyến X hải lý"** + **"Theo kế hoạch: giờ này đang [chạy ra vùng A /
  đánh vùng B / trên đường về]"**; lệch >20 hải lý → thêm dòng trung tính "Đang đi khác kế hoạch —
  không sao, thuyền trưởng quyết" (app là người phụ việc, KHÔNG báo động kiểu sai-đúng).
- Chạm-để-xem, KHÔNG theo dõi nền liên tục (đỡ pin + đỡ quyền; nâng cấp nền là việc Capacitor sau).
- Offline vẫn vẽ tuyến trên nền bờ biển offline sẵn có (`offline-basemap.ts`) — tuyến là dữ liệu
  local, không phụ thuộc ô bản đồ mạng; ghi rõ tuổi dữ liệu (luật offline-16d).

## 6. Lộ trình build đề xuất (thứ tự theo mở-khóa/chi-phí)

| Phase | Việc | Ghi chú |
|---|---|---|
| **0 — nền + nguồn 16 ngày (rẻ, mở khóa nhiều)** | (a) Nối `sst-tendency.ts` vào `fish-forecast-run.ts` (tham số `frontSst` chờ sẵn) → bản đồ cá D+1..D+3 THẬT; (b) thêm `gear` + `fuelCapacityL` + tốc độ/lít-giờ vào hồ sơ tàu theo boatId (thay localStorage rời); (c) hàm `isInsideAllowedZone` dùng VMS polygon + vùng lộng + boatZone (pointInRing sẵn có); (d) **probe trần `forecast_days` từng trường** route-weather (nhất là dòng chảy) — script kiểu fish-3day-probe; (e) **dời chặn lưới >3 ngày về server**; (f) **climatology mùa vụ + script tối ưu w(d)** → `fish-blend-weights.json` (§5b — nền của lớp cá 16 ngày) | Việc (a) có sẵn test; (c) biến VMS từ "chỉ để vẽ" thành ràng buộc; (d)(e)(f) là điều kiện của chuẩn premium 16 ngày |
| **1 — MVP lộ trình (premium, 16 ngày)** | Nâng route-weather lên 16 ngày (72h theo giờ + đuôi bước 6h/12h, §5b) + multi-leg trên `planRoute` (cờ nới MAX_DETOUR_RATIO cho chặng tìm cá) + cluster vùng cá + greedy insertion + 2-opt + lịch ngày (B0–B3, chưa GRASP) + màn hình mới (KHÔNG nhét vào fishing-map-view 2400 dòng) + 3 số to + disclaimer + storm gate cửa sổ 0–5 ngày + **LƯU lộ trình** (`forfish.routes.v1` theo boatId, kèm tuổi dữ liệu) + **offline so vị trí với tuyến** (§5c) + pretrip tải sẵn dữ liệu dọc tuyến | Premium toàn phần (chốt #1); gate ăn theo API cá + lưới 16d sẵn có |
| **2 — kế hoạch sống** | GRASP restart + re-plan giữa chuyến (vị trí hiện tại làm điểm đầu, D còn lại làm budget) + mask giờ theo nghề/con trăng + quy dầu ra tiền + nguồn bão có mốc giờ (JTWC/KTTV) + fit w(d) riêng 2 mùa gió khi đủ số liệu | — |
| **3 — đo hiệu quả** | Ghi lại tuyến đề xuất vs thực đi (GPS các lần "so vị trí" đã có sẵn từ §5c) + hỏi sản lượng → tự backtest "có tăng xác suất thật không" | Không có số này thì mãi mãi không chứng minh được lời hứa; dữ liệu so-vị-trí của Phase 1 chính là nguyên liệu |

## 7. Số liệu dùng cho pitch (có nguồn trong báo cáo gốc)

- INCOIS PFZ (Ấn Độ): giảm **30–70% thời gian tìm cá**/chuyến; CPUE vùng advisory **gấp 2–4×**;
  tỉ lệ trúng ~95% nghề tầng nổi. (Hệ giống fish layer SDFish nhất.)
- Weather routing: tiết kiệm dầu **3–7%** (nói dè: "vài phần trăm dầu + tránh ngày biển động").
- Dầu = 44–70% chi phí chuyến (chuyến Hoàng Sa ~2.000–2.500 lít) → mỗi % dầu tiết kiệm là tiền thật.

## 8. Câu hỏi chờ chủ dự án chốt trước khi sang design-spec

**ĐÃ CHỐT HẾT (2026-07-28)** — không còn câu hỏi mở:
1. ~~Premium hay free?~~ → **premium toàn phần**, dữ liệu premium, tối đa 16 ngày; lưu lộ trình;
   offline so vị trí với tuyến (đầu doc + §5b/§5c).
2. ~~Nghề nào trước?~~ → **câu cá ngừ** (nghề vẫn là ô chọn trong form; nghề khác dùng mẫu tạm).
3. ~~Hỏi hầm đá?~~ → **KHÔNG** — "ngày nên quay về" mặc định theo nghề.
4. Hình hài: **MỘT tính năng "Đề xuất lộ trình"** — form: chọn ngày · chọn nghề · thông số
   liên quan cho tính toán (§4). Re-plan giữa chuyến để Phase 2 (user không yêu cầu dồn lên MVP).
5. ~~UI có phân biệt cá 3 ngày?~~ → **KHÔNG** — lớp cá dùng liền mạch cả 16 ngày = pha trộn
   dự báo + bản đồ mùa vụ; **tỷ lệ pha trộn w(d) TÍNH TỐI ƯU từ backtest, không đặt tay**
   (§5b c); UI một kế hoạch liền mạch + một disclaimer chung.

→ Sẵn sàng chuyển bước: design-spec màn hình (ui-design-logic) + Phase 0 kỹ thuật.

---
*Nguồn chi tiết (file:line của kiểm kê repo, URL của mọi số liệu): transcript 3 agent nghiên cứu
phiên 2026-07-28. Doc này là ĐỀ XUẤT — chưa nằm trong invariant doc-sync cho tới khi được duyệt.*
