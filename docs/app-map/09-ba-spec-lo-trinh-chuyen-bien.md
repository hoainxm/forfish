# 09 — ba-spec: Lộ trình chuyến biển nhiều ngày (route suggest)

> Load khi: task chạm đề xuất/lưu lộ trình chuyến biển, lớp cá cho chuyến dài (pha trộn dự báo × mùa vụ), nguồn dữ liệu cho tầm 16 ngày, hoặc so vị trí hiện tại với tuyến đã lưu.
covers: src/lib/fish-blend.ts, public/data/fish-climatology.v1.json, src/data/fish-blend-weights.json, scripts/collect-fish-climatology.mjs, scripts/fit-fish-blend-weights.mjs
last_verified: 2026-07-28
ttl_days: 90

<!-- re-verified: 2026-07-31 — fish-blend.ts THÊM `fishLeadDays(imageDateIso, viewDateIso, viewLead)` (thuần, có test): tầm ngày của lớp cá phải đếm từ NGÀY ẢNH, không phải từ hôm nay — mất sóng thì service worker trả lại bản đồ cá tải mấy ngày trước mà chip vẫn đứng "Hôm nay", tính theo hôm nay ra w=1 = tin trọn tấm ảnh cũ. Khớp định nghĩa của chính bộ số: scripts/fit-fish-blend-weights.mjs đo `target = addDays(T, d)` với T = ngày ẢNH. Tỷ lệ w(d), thang phân vị, blendFishCells KHÔNG đổi — §5d/§5e/§5f còn đúng nguyên. Chủ dự án 2026-07-31 chốt KHÔNG trừ độ trễ vệ tinh khỏi fishLead (giữ hành vi ngày thường). -->
> **Mục đích**: oracle HÀNH VI cho tính năng đề xuất lộ trình — bài toán là gì, nguồn dữ liệu phải đạt gì, pha trộn lớp cá theo tỷ lệ nào (số ĐO ĐƯỢC), lưu/đối chiếu tuyến ra sao. KHÔNG mô tả giao diện (việc của [07-design-spec](07-design-spec.md)).

> **Trạng thái: phần TÍNH NĂNG còn là ĐỀ XUẤT (chưa build); phần NỀN DỮ LIỆU lớp cá 16 ngày ĐÃ LÀM XONG — xem §5d.** Kết quả
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
- **Prize 16 ngày = lớp cá pha trộn** (user chốt): `blendFishCells()`/`blendScore()` với `blendWeight(d)` tối ưu từ backtest (`src/lib/fish-blend.ts` + `data/fish-blend-weights.json`)
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
| **Bản đồ cá — MỘT LỚP PHA TRỘN dùng cả 16 ngày** (user chốt 2026-07-28: KHÔNG phân biệt "cá 3 ngày" trong UI) — ✅ **ĐÃ LÀM XONG 2026-07-28**, xem §5d | Tĩnh 1 bản; `sst-tendency.ts` D+1..D+3 viết xong chưa nối | `blendScore = blendWeight(d)·fishForecast(ô) + (1−blendWeight(d))·climScoreAt(ô, tháng)` (impl `src/lib/fish-blend.ts`: `blendFishCells`/`blendScore`/`blendWeight`/`climScoreAt`). (a) Nối `frontSst` → thành phần dự báo D+1..D+3 thật *(còn lại — chưa làm)*; (b) ✅ **climatology mùa vụ** dựng xong từ 6 năm ERDDAP; (c) ✅ **w(d) đo bằng backtest**, không đặt tay; guard always-on-term PASS | (a) Dễ · (b) ✅ · (c) ✅ |
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
- **Kiểm chứng ĐỘC LẬP bằng địa lý** (bằng chứng bản đồ không phải số vô nghĩa): ô điểm cao nhất
  tháng 7 rơi đúng **vùng nước trồi Nam Trung Bộ** (12,3°N 109,3°E — Ninh Thuận/Khánh Hoà), đặc
  trưng gió mùa Tây Nam kinh điển trong tài liệu hải dương VN; tháng 1 chuyển về **cửa sông Mê Kông
  / thềm Đông Nam** (9–10°N, 106–107°E); tháng 12 lên **cửa vịnh Bắc Bộ** (17,8–18,3°N). Mô hình
  KHÔNG được "dạy" các vùng này — nó tự ra từ nhiệt + phù du nhiều năm.
- Script: `scripts/collect-fish-climatology.mjs` (chạy lại ~1 lần/năm là đủ).

**Tỷ lệ pha trộn w(d)** (`src/data/fish-blend-weights.json` ← `scripts/fit-fish-blend-weights.mjs`):
backtest **16 mốc gốc** (2022–2025 × 4 mùa) × 7 tầm ngày, **30–33 nghìn ô mỗi tầm**, kiểm chéo 4
nhóm **theo mốc gốc** (không trộn mẫu trong cùng một mốc — nếu trộn thì rò rỉ, gain sẽ đẹp giả).

| tầm ngày | 1 | 2 | 3 | 5 | 8 | 11 | 16 |
|---|---|---|---|---|---|---|---|
| **w (tin ảnh vệ tinh)** | 0,823 | 0,767 | 0,722 | 0,672 | 0,635 | 0,605 | 0,547 |
| lợi RMSE vs persistence (CV) | +4,4 % | +6,2 % | +6,9 % | +9,0 % | +8,7 % | +8,5 % | +7,5 % |
| lợi RMSE vs mùa vụ thuần (CV) | +43,0 % | +34,5 % | +28,7 % | +24,9 % | +18,9 % | +15,7 % | +8,9 % |

- w **tự nhiên đơn điệu giảm** (không phải do ép) — đúng trực giác: ảnh cũ càng đi xa càng ít giá trị.
- **Pha trộn THẮNG persistence ở MỌI tầm** khi kiểm chéo, kể cả ngày 1. Đây là kết quả DƯƠNG, khác
  hẳn hai lần đo trước (advection phù du, front composite) đều âm.
- Guard **always-on-term PASS**: biên độ w = 0,276, không suy biến (test khoá `guard.degenerate === false`).
- **Caveat ghi thẳng trong file kết quả**: "sự thật" đối chiếu là *bản đồ cá tính từ ảnh ngày T+d*
  (chính sản phẩm app phục vụ), **KHÔNG PHẢI sản lượng cá thật**.
- Ổn định khi thêm dữ liệu: chạy 12 mốc gốc cho w = 0,793→0,493; 16 mốc gốc cho 0,823→0,547 — cùng
  hình dạng, cùng kết luận, chỉ dịch nhẹ. Bản 16 mốc là bản đang dùng.

**KẾT LUẬN ÂM (giữ lại để lần sau khỏi đo lại): KHÔNG nên tách w theo MÙA GIÓ.** Biển Đông có hai
mùa gió trái ngược nên câu hỏi tự nhiên là fit riêng Đông Bắc (T11–T3) và Tây Nam. Đo thật: w quả
thật khác nhau (wNE 0,456–0,771 vs wSW 0,577–0,839 — mùa Đông Bắc tin ảnh vệ tinh ÍT hơn, hợp lý
vì nhiều mây và xáo trộn hơn), **nhưng khi kiểm chéo thì bảng-theo-mùa THUA bảng chung ở CẢ 7 tầm
(−2,4 % đến −6,5 %)** — chia đôi dữ liệu để fit 2 tham số là overfit, không phải thêm thông tin.
⇒ Giữ MỘT bảng. Muốn tách mùa thì phải có nhiều năm mốc gốc hơn hẳn, không phải chỉnh code.
Kết luận này lưu trong chính `fish-blend-weights.json` (khoá `seasonSplit`).

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

**ĐÃ NỐI VÀO BẢN ĐỒ RA KHƠI (2026-07-28, user chốt "nối lớp cá xem thử")**: kéo thanh ngày thì lớp
cá đổi thật — ô màu, điểm nóng và số trong sheet đều lấy từ bản đã pha. Ngày 0 giữ nguyên hành vi cũ.
Đo trên dữ liệu thật (2135 ô): ngày 3 đổi mức 423 ô · ngày 8: 515 · ngày 16: 578; điểm TB 38,6 → 30,3.
Hệ quả cần theo dõi: ngày xa bản đồ THƯA và NHẠT hơn hẳn (gần hết hồng tâm ≥75) — trung thực nhưng nếu
muốn ngày xa vẫn "nói được gì" thì chỉnh NGƯỠNG HIỂN THỊ, KHÔNG chỉnh w (w là số đo, không phải nút vặn).

## 5e. v2 — CHUẨN HOÁ PHÂN VỊ, và câu trả lời thật cho "mùa vụ có đẻ ra vị trí mới không?"

Chủ dự án hỏi đúng chỗ đau (2026-07-28): *"thông tin mùa vụ nó không tạo ra các vị trí mới à?
thấy gần như chỉ giảm cái chỉ số của ảnh vệ tinh?"* — **ĐÚNG**. Đo bằng
`scripts/fish-blend-audit.mjs` rồi sửa; dưới đây là toàn bộ sự thật, kể cả phần không đẹp.

**Bản v1 sai ở đâu (2 lớp):**
1. Bản mùa vụ dựng trên nền nhiệt/phù du TRUNG BÌNH nhiều năm ⇒ các FRONT (ranh nước — thứ đẻ
   ra điểm cao) bị làm mượt mất ⇒ thang điểm BỊ NÉN (tháng 7: p90 40 / max 59 so với bản đồ
   ngày p90 44 / max 62).
2. Lưới cá chỉ chứa ô ≥25 điểm nên vòng lặp chạy trên DANH SÁCH Ô CỦA ẢNH — chỗ nào ảnh chê thì
   không có mặt để mà nâng.
⇒ Kết quả đo: **0 ô mới ở mọi tầm ngày**, và về toán học là không thể (muốn một ô mới chạm sàn
hiển thị 40 ở ngày 16 thì mùa vụ phải ≥88 điểm, trong khi cao nhất cả năm là 64).

**ĐÍNH CHÍNH cách đọc kết quả v1**: con số "+4–9 % RMSE thắng persistence" là THẬT nhưng bản
chất là **hiệu ứng hạ độ tự tin** (kéo mọi điểm về trung bình thì sai số bình phương giảm), KHÔNG
phải "tìm thêm được chỗ có cá". RMSE là thước đo sai cho câu hỏi này.

**v2 đã sửa** (`lib/fish-blend.ts`): `buildClimScaleMap` quy điểm mùa vụ về ĐÚNG thang phân bố
của bản đồ ngày bằng PHÂN VỊ (giữ nguyên thứ tự, chỉ kéo giãn biên độ); `blendFishCells` pha trên
HỢP hai tập ô, ô chỉ-có-ở-mùa-vụ lấy `ABSENT_PERSIST = 12` làm điểm ảnh (vắng mặt nghĩa là <25,
không phải =0). Thêm thước đo đúng: **top-100 hit** — trong 100 ô app cho điểm cao nhất, bao
nhiêu ô nằm trong 100 ô cao nhất THẬT của ngày đó.

| tầm ngày | 1 | 2 | 3 | 5 | 8 | 11 | 16 |
|---|---|---|---|---|---|---|---|
| **% mùa vụ gánh** (1−w) | 6 % | 9 % | 12 % | 15 % | 16 % | 18 % | **20 %** |
| top-100 hit — **pha** | 80,9 | 73,4 | **69,9** | 65,1 | **61,5** | **60,6** | **56,9** |
| top-100 hit — ảnh thuần | 81,7 | 73,4 | 69,6 | 65,2 | 60,1 | 59,0 | 54,9 |
| top-100 hit — mùa vụ thuần | 52,1 | 51,1 | 52,0 | 52,4 | 51,8 | 54,4 | 52,4 |

**Đọc bảng này cho đúng:**
- Pha trộn **CHỈ ĐÚNG CHỖ HƠN ảnh thuần ở ngày 3, 8, 11, 16** (+1,4 → +2,0 điểm phần trăm ở tầm
  xa). Ngày 1–2 thì hoà hoặc kém chút ⇒ đúng như thiết kế: gần thì đừng đụng vào ảnh.
- Tỷ lệ mùa vụ **TĂNG DẦN theo ngày** (6 % → 20 %) đúng yêu cầu chủ dự án; có test khoá.
- Mùa vụ thuần chỉ đạt ~52 % và **KHÔNG rữa theo ngày** — nó có thông tin thật, chỉ là ít.

**NHƯNG — vẫn KHÔNG có ô mới nào HIỆN RA** (đo trên lưới thật 2138 ô): mọi tầm ngày đều
**0 ô mới ≥40**. Lý do không phải lỗi code nữa mà là DỮ LIỆU NÓI THẾ: hồi quy chỉ cho mùa vụ
20 % trọng số ngay cả ở ngày 16, nên ô mới cao nhất cũng chỉ ~22 điểm, dưới sàn hiển thị 40.
Nói cách khác: **chỗ nào ảnh vệ tinh hôm nay chê thì thường là chê đúng** — tương quan hạng của
ảnh với sự thật vẫn 0,51 ở ngày 16, cao hơn mùa vụ (0,45). Ép mùa vụ nặng tay hơn sẽ làm kết quả
XẤU đi ở cả RMSE lẫn top-100.

⇒ **Kết luận trung thực**: mùa vụ KHÔNG đẻ ra ngư trường mới; giá trị thật của nó là **xếp lại
thứ tự** các chỗ đã có, đáng ~2 điểm phần trăm ở tầm xa. Bản v2 giữ lại vì tốt hơn v1 ở MỌI trục
đo (thang điểm đúng, bản đồ ngày xa bớt bị nhạt: ô ≥40 còn 681/748 thay vì tụt sâu, top-100 tốt
hơn). 48 ô mùa-vụ-sinh vẫn nằm trong payload dù chưa hiện — hữu ích cho màn lộ trình sau này
(chạm điểm ở chỗ ảnh không có vẫn ra được con số tham khảo).

**Nếu sau này muốn ngày xa thật sự gợi ý chỗ khác** thì đòn bẩy KHÔNG phải tăng w — mà là (a) hạ
sàn hiển thị riêng cho ngày xa, hoặc (b) làm bản mùa vụ tốt hơn (dựng front từ composite từng
ngày rồi mới trung bình, thay vì trung bình rồi mới tính front — chính chỗ làm mất front).

## 5f. v3 — MỨC MÙA VỤ DO CHỦ DỰ ÁN CHỌN (6 % → 56 %) + giãn lại phân bố

Chủ dự án chốt 2026-07-28: *"tăng theo ngày từ 6 % ngày 1 tới 56 % ngày 16 chứ 20 % thì ít quá"*.
Đây là **QUYẾT ĐỊNH SẢN PHẨM đè lên số đo** — ghi rõ để người sau khỏi tưởng là kết quả backtest.
Hằng số ở `PRODUCT_SHARE_FIRST/LAST` trong `lib/fish-blend.ts` (KHÔNG sửa file weights — file đó
là số đo thuần; `measuredWeight()` giữ nguyên để đối chiếu).

**Cách dựng**: giữ nguyên HÌNH DẠNG đường cong đo được (lên nhanh mấy ngày đầu rồi thoải) và kéo
giãn để hai đầu chạm đúng 6 % / 56 %. Kết quả: 6 % (d1) · 16 % (d2) · 24 % (d3) · 37 % (d5) ·
41 % (d8) · 46 % (d11) · **56 % (d16)**. Ngày 0 luôn 0 % (hôm nay không bao giờ pha).

**LỖI THỨ HAI phát hiện khi nâng lên 56 % — và đã sửa**: càng pha nhiều, bản đồ càng NGHÈO
(ô ≥40 tụt 785 → 603, hồng tâm 55 → 14). Đây là ARTIFACT của phép trung bình (trộn hai bản tương
quan nhau luôn co phương sai, mọi thứ dồn về giữa), KHÔNG phải điều dữ liệu muốn nói — và nó
ngược hẳn mục tiêu "ngày xa phải có nội dung". Chữa: dùng điểm pha để **XẾP HẠNG**, rồi ánh xạ
hạng đó trở lại **đúng phân bố điểm của bản đồ hôm nay**. Đo lại trên lưới thật 2138 ô:

| ngày | % mùa vụ | ô được tô (≥40) | hồng tâm (≥75) | **chỗ tô mà HÔM NAY không tô** |
|---|---|---|---|---|
| 0 | 0 % | 785 | 55 | — |
| 3 | 24 % | 803 | 56 | 117 |
| 8 | 41 % | 803 | 56 | 179 |
| 16 | 56 % | 803 | 56 | **224** |

⇒ Ngày 16 có **224/~800 ô được tô là chỗ bản đồ hôm nay KHÔNG chỉ tới** — đây mới đúng nghĩa
"vị trí mới" có ích cho bà con (§5e nói 0 ô mới là đúng với định nghĩa hẹp "ô do mùa vụ tự đẻ";
giá trị thật đến từ ĐỔI THỨ HẠNG, và nay nó đã hiện ra được trên bản đồ).

**CÁI GIÁ — đo bằng top-100 hit, không giấu:**

| tầm ngày | 1 | 2 | 3 | 5 | 8 | 11 | 16 |
|---|---|---|---|---|---|---|---|
| mức TỐI ƯU theo sai số (%) | 6 | 9 | 12 | 15 | 16 | 18 | 20 |
| **mức ĐANG DÙNG (%)** | 6 | 16 | 24 | 37 | 41 | 46 | **56** |
| top-100 ở mức tối ưu | 80,9 | 73,4 | 69,9 | 65,1 | 61,5 | 60,6 | 56,9 |
| **top-100 ở mức đang dùng** | 81,0 | 72,9 | 68,8 | 64,1 | **60,3** | **61,3** | **59,1** |
| top-100 ảnh thuần | 81,7 | 73,4 | 69,6 | 65,2 | 60,1 | 59,0 | 54,9 |

**Đọc cho đúng — trực giác của chủ dự án ĐÚNG ở tầm xa**: ở ngày 11 và 16, mức 56 % chẳng những
không mất gì mà còn **TỐT HƠN cả mức "tối ưu" 20 %** (61,3 vs 60,6 và 59,1 vs 56,9). Lý do: w
được fit để tối thiểu SAI SỐ (RMSE), mà RMSE thưởng cho việc đoán an toàn; còn thước đo "chỉ đúng
chỗ" thì thích nhiều mùa vụ hơn ở tầm xa. Cái giá nằm ở **ngày 2–5**: thua mức tối ưu ~0,5–1,1
điểm % và thua cả ảnh-thuần ~0,5–1,1 điểm %.

⇒ Việc còn lại: **dò ĐỘ CONG** (giữ nguyên hai đầu, đổi gamma) để ngày gần bám sát mức tối ưu mà
ngày xa vẫn 56 % — chạy `scripts/fit-fish-blend-weights.mjs`, xem bảng "DÒ ĐỘ CONG".

**Đánh đổi phải nhớ**: giãn lại phân bố ⇒ bản đồ ngày xa trông "chắc" ngang ngày gần (số ô mỗi
mức bằng nhau). Độ không chắc nay nói bằng **CHỮ** trong sheet, KHÔNG bằng cách làm nhạt bản đồ.
Quyết định có chủ ý: làm nhạt vốn là artifact, không phải thông tin.

## 5g. ĐÍNH CHÍNH + trần thật của lớp pha trộn (team-agent đo lại, 2026-07-28)

**ĐÍNH CHÍNH MỘT SỐ LIỆU TÔI ĐÃ CÔNG BỐ SAI.** Trong commit v3 và comment code có câu
*"gamma = 2,5 thắng: hơn ảnh-thuần 7,4 điểm % (gamma=1 chỉ 4,6), tốt hơn gamma=1 ở MỌI tầm"*.
Con số 4,6 **chưa từng được đọc** — dòng gamma=1 bị cắt khỏi màn hình lúc chạy, tôi suy ra rồi
viết vào như thể đã đo. Đo lại nghiêm túc (`scripts/fish-knee-probe.mjs`: 11 tầm ngày, ghép cặp
theo mốc gốc, có sai số chuẩn):

| đường cong | top-100 TB | hơn ảnh-thuần |
|---|---|---|
| power γ=0,75 | 63,96 | +1,44 |
| power γ=1 (tăng đều) | 63,93 | +1,40 |
| power γ=1,5 | 63,95 | +1,43 |
| **ĐANG DÙNG (γ=2,5)** | **63,94** | **+1,41** |
| power γ=4 | 63,56 | +1,04 |
| ảnh THUẦN | 62,53 | 0 |
| mùa vụ THUẦN | 49,06 | −13,46 |

⇒ Sự thật: **HOÀ** — mọi độ cong từ 0,75 đến 3 chênh nhau dưới 0,2 điểm %, dưới ngưỡng đáng kể
0,5. Chỉ γ≥4 và logistic dốc là thua rõ. **Giữ γ=2,5 vì hoà với bản tốt nhất và khớp ý đồ sản
phẩm, KHÔNG phải vì nó thắng.**

**ĐIỂM GÃY X = 4 NGÀY — có thật, nhưng CHIỀU NGƯỢC với giả định.** Gãy khúc thắng hàm mũ đơn ở
cả ba chuỗi đo (R² 0,99 vs 0,94). Nhưng ảnh vệ tinh **rữa NHANH NHẤT trong 1–4 ngày đầu rồi mới
phẳng**, chứ không phải "consistent X ngày rồi rơi mạnh":

| tầm (ngày) | 1 | 2 | 3 | **4** | 6 | 8 | 12 | 16 |
|---|---|---|---|---|---|---|---|---|
| top-100 ảnh (%) | 80,1 | 72,2 | 69,4 | **65,6** | 62,4 | 58,8 | 54,3 | 52,0 |
| top-100 mùa vụ (%) | 48,6 | 47,6 | 48,1 | 48,3 | 49,7 | 48,7 | 50,2 | 50,6 |

Mất **14,5 điểm trong 3 ngày đầu**, rồi chỉ mất thêm 13,6 điểm trong **12 ngày sau** (dốc chậm
hơn 4,5×). Hệ quả cho thiết kế: đường cong "giữ thấp rồi vọt" (γ lớn) KHÔNG khớp vật lý — dạng
lõm (γ 0,75–1, đưa mùa vụ vào SỚM) mới hợp; nhưng vì đo ra hoà nên không đổi.

**TRẦN CỦA CẢ LỚP NÀY (con số quan trọng nhất):** pha trộn chỉ mua được **+1,4 điểm %** so với
ảnh thuần, và gần như toàn bộ nằm ở **d ≥ 10** (d10 +2,8 · d12 +3,1 · d14 +3,4 · d16 +2,9);
từ d1–d8 gần như bằng 0. **Mùa vụ thuần chỉ đạt 49,1 so với ảnh 62,5 và KHÔNG bao giờ vượt ảnh ở
bất kỳ tầm nào trong 16 ngày** (kể cả d16: 52,0 vs 50,6). ⇒ Muốn tầm xa khá hơn thì phải có
**NGUỒN TÍN HIỆU MỚI**, vặn đường cong hay tỷ lệ đều đã kịch trần.

## 5h. Hai KẾT LUẬN ÂM của team-agent — đừng làm lại (2026-07-28)

Hai hướng chủ dự án đề xuất đã đo đến nơi. Cả hai đều **KHÔNG đáng cài**. Ghi lại đầy đủ để lần
sau khỏi tốn công đo lại. Script để chạy lại: `scripts/fish-analog-year-eval.mjs`,
`scripts/fish-spread-probe.mjs` (đọc kho `.cache/fish-corpus`, dựng bằng `fish-corpus-build.mjs`).

### A. MÙA VỤ CÓ ĐIỀU KIỆN (chọn/nặng ký "năm tương tự") — CHƯA ĐỦ BẰNG CHỨNG

Ý tưởng: thay vì trung bình đều 6 năm, nặng ký những năm có trạng thái hải dương giống năm nay.

| Cách dựng (kiểm chéo bỏ-năm, 16 mốc × 5 tầm d8–d16) | top-100 | Δ vs trung bình đều |
|---|---|---|
| trần hậu nghiệm (biết trước năm nào tốt nhất) | 56,9 | +2,51 |
| nặng ký mềm `1/(0,1+d_z)` — tốt nhất trong 7 công thức | 55,8 | +1,46 |
| **trung bình ĐỀU (đang dùng)** | **54,4** | — |
| chọn cứng 1 năm giống nhất | 52,3 | **−2,05** |
| một năm bất kỳ | 50,0 | −4,33 |

**Ba lý do không cài:**
1. **Gộp nhiều năm đáng +4,3 điểm %, còn "chọn đúng năm" trần chỉ +2,5** — chọn cứng một năm
   LUÔN LỖ, vì mất ensemble nhiều hơn được nhờ chọn đúng.
2. `+1,46` **không sống sót kiểm định đã trừ hái quả**: thử 7 công thức rồi lấy cái nhất ⇒
   p family-wise = 0,088; kiểm định dấu theo mốc gốc 10/16 (p = 0,45); trung vị chỉ +0,80 và
   MỘT mốc gốc đóng góp +10,0 (bỏ nó ra là hết).
3. Đất quá hẹp: bản đồ cùng tháng khác năm chỉ khác nhau rho 0,642 — **ngang mức bản đồ tự trôi
   trong 16 ngày** (0,625), còn xa mức khác-tháng (0,356).

**Lỗi kỹ thuật phát hiện kèm — cần nhớ**: `anomMean` và `sstMean` có `r = 1,0000` giữa các năm
(dị thường = nhiệt trừ nền khí hậu, mà nền giống nhau ở mọi năm cùng tháng) ⇒ dùng cả hai là
**tính nhiệt hai lần**. Chỉ có 2 chỉ số độc lập: nhiệt và phù du.

*Khi nào đo lại*: khi kho có ≥6 năm (bỏ-một-năm còn 5 năm để nặng ký). Công thức đáng thử:
`w(năm) = 1/(0,1 + d_z)`, `d_z = sqrt(mean((Δsst/0,379)², (Δchl/0,060)²))`, **bỏ anomMean**,
kernel phải THOẢI (sắc hơn hoặc chọn cứng đều tệ hơn).

### B. NỞ RỘNG VÙNG TÔ Ở NGÀY XA — KHÔNG ĐÁNG, THUA MỌI TẦM

Ý tưởng: ngày xa không biết chính xác điểm nên tô thành vùng rộng hơn (~30 %, dưới 40 %).

**Điểm nóng dịch chuyển bao nhiêu (số thật, ô 0,25° ≈ 27,8 km):**

| tầm | trung vị | p90 | km/ngày | trọng tâm ĐÁM dịch | **ô SỐ 1 lệch** |
|---|---|---|---|---|---|
| +1 | 0 km | 39 km | 14,4 | 62 km | **88 km** |
| +8 | 27 km | 114 km | 5,4 | 214 km | 352 km |
| +16 | 28 km | 193 km | 3,7 | 249 km | **507 km** |

Dịch chuyển tăng kiểu **khuếch tán (~√d)**, không tuyến tính — sai số bão hoà chứ không nổ.
Mốc so: ô ngẫu nhiên cách ô nóng gần nhất ~300 km ⇒ ảnh hôm nay thật sự biết chỗ.

**Nở điểm (dilation) THUA ở mọi tầm** — quét r ∈ {0..4} ô × {max, gauss, decay}:
F1 thì r=0 thắng cả 11 tầm; **phép so công bằng cùng diện tích tô: nở thắng 0/132 lần**.
Giá thật ở d16 nếu vẫn cài: +7,6 điểm % recall đổi lấy −17,4 precision và −14,2 "chỉ đúng chỗ".
Lý do: recall gốc đã 88–98 % — bản đồ **không thiếu độ phủ**, nó thiếu **độ sắc ở đỉnh**.

**"~30 %, <40 %" bằng số** (d16): +30 % diện tích ⇒ recall 88,3 → 91,9 %, precision 63,4 → 56,0 %.
Còn hạ ngưỡng 40 → 30 KHÔNG phải "30 %" mà làm vùng tô **gấp 2,85 lần** (+185 %), vượt xa trần
chủ dự án đặt. Nếu vẫn muốn +30 % diện tích thì làm bằng **hạ ngưỡng nhẹ (40 → ~37)**, KHÔNG
bằng nở — cùng diện tích mà hơn cả recall lẫn precision.

### ⇒ VIỆC ĐÁNG LÀM MÀ SỐ LIỆU CHỈ RA (khác cả hai đề xuất ban đầu)

Chỗ app "giả vờ chính xác" KHÔNG nằm ở độ rộng ô mà ở **THỨ HẠNG ĐỈNH**: ô số 1 lệch 400–500 km
từ ngày 12, trong khi **trọng tâm CỤM chỉ lệch 214–249 km** (ổn định gấp ~2 lần). ⇒ Từ tầm xa,
đừng chỉ "một ô tốt nhất" mà chỉ **CỤM rộng**. Đây là thay đổi rẻ, không đụng điểm số, không mất
precision — xem 5i.

## 5i. ĐÃ CÀI: hồng tâm nới rộng theo tầm ngày (2026-07-28)

Đây là việc DUY NHẤT trong đợt nghiên cứu này mà số liệu ủng hộ cài — và nó KHÁC cả hai đề xuất
ban đầu (mùa vụ có điều kiện, nở rộng vùng tô — cả hai đã loại ở §5h).

**Vấn đề thật**: app chỉ đích danh MỘT ô là "điểm nóng". Đo ra ô số 1 lệch **88 km ở ngày 1 nhưng
507 km từ ngày 16** — bà con chạy tới đó có thể sai nửa nghìn cây số. Trong khi **trọng tâm CỤM
chỉ lệch 62 → 249 km** (ổn định gấp ~2 lần).

**Cách chữa**: giữ nguyên điểm số và vùng tô, chỉ **nới khoảng cách tối thiểu giữa hai hồng tâm**
theo đúng mức lệch đo được, và bớt số hồng tâm cho khỏi chật màn. Mỗi hồng tâm khi đó đại diện
một VÙNG rộng bằng độ không chắc thật, thay vì một chấm giả vờ chính xác.

| tầm ngày | 0–1 | 3 | 5 | 8 | 12 | 16+ |
|---|---|---|---|---|---|---|
| hai hồng tâm cách nhau ≥ | 0,70° (78 km) | 1,07° (119 km) | 1,35° (150 km) | 1,93° (214 km) | 2,10° (233 km) | 2,24° (249 km) |
| tối đa mấy hồng tâm | 8 | 8 | 6 | 6 | 4 | 4 |

`hotspotSpacingDeg()` / `hotspotMaxCount()` trong `lib/fish-blend.ts` — thuần, có test khoá:
**ngày 0 giữ y như cũ** (không đổi gì đang chạy), không bao giờ hẹp lại theo ngày, khớp mức đo
(214 km ở d8 · 249 km ở d16), quá mốc đo cuối thì GIỮ chứ không ngoại suy.
`fishing-map-view.tsx` chỉ đổi 2 hằng số cứng (8 và 0,7) thành lời gọi hai hàm này.

KHÔNG đụng: điểm số ô, vùng tô, ngưỡng hiển thị, payload API. Nên không mất precision/top-100 —
khác hẳn phương án nở vùng tô đã loại.

## 5j. VÒNG GIẢ THUYẾT + PHẢN BIỆN (8 agent, 2026-07-28) — ĐỌC MỤC NÀY TRƯỚC

Chủ dự án yêu cầu: đẻ giả thuyết có cơ sở rồi kiểm chứng, để có "dự báo tương đối chính xác cho
16 ngày". Kết quả: **6/6 giả thuyết thất bại**, nhưng vòng phản biện đẻ ra ba thứ giá trị hơn cả
sáu giả thuyết cộng lại — trong đó có **một lỗi của chính đợt làm trước**.

### ⚠ (1) THƯỚC ĐO ĐANG PHÓNG ĐẠI SAI SỐ ~28 ĐIỂM % — phát hiện lớn nhất

top-100 hit tính theo **ĐÚNG Ô** là bộ dò rìa. Trường điểm cá không phải đốm nhiễu mà là
**RUY-BĂNG rộng 1–2 ô** men theo front (đo: **86,8 %** ô top-100 có ít nhất một ô top-100 kề,
trung bình 1,82/4 lân cận). Ruy-băng lệch **một ô = 28 km** là bị tính SAI HOÀN TOÀN — trong khi
với tàu cá 28 km chỉ là vài giờ chạy, không phải "chỉ sai chỗ".

Đo lại persistence với dung sai không gian:

| tầm ngày | đúng ô (đang dùng) | **±1 ô (28 km)** | ±2 ô (55 km) |
|---|---|---|---|
| 1 | 79,9 | **95,4** | 97,4 |
| 4 | 66,0 | 89,9 | 95,1 |
| 8 | 58,8 | 87,8 | 93,5 |
| **16** | **52,7** | **80,9** | 87,8 |

⇒ **Câu trả lời cho "16 ngày chính xác tới đâu" phụ thuộc hoàn toàn vào định nghĩa "chính xác":**
- trúng **đúng ô 28 km**: trần thực dụng ~59–62 ở d16, hiện 55,6 — gần kịch trần, hết đất.
- trúng **đúng VÙNG bán kính 28 km** (thứ ngư dân thật sự cần): **d16 ĐÃ ĐẠT 80,9 % ngay hôm nay
  bằng ảnh thuần**, ~88 % ở bán kính 55 km, trần ~96–97.

**Việc phải làm**: công bố kèm thước đo có dung sai, đừng mô tả sản phẩm bằng con số 52 %.

### ⚠ (2) RÒ RỈ DỮ LIỆU trong chính bản mùa vụ tôi đã dựng

`fish-climatology.v1.json` dựng từ **2020–2025**, mà backtest lại chạy trên **2022–2025** ⇒ bản
neo chứa sẵn dị thường của chính năm đang test (ρ ≈ 1/√6 ≈ 0,41 theo cấu tạo; chl là ảnh THÁNG
nên tháng đích đóng trọn 1/6 trọng số). Đo độ lớn thật:

| bản neo | hơn ảnh thuần (mọi tầm) | d≥10 |
|---|---|---|
| gồm cả năm test (= bản đã đo trước) | +3,42 | +7,02 |
| **bỏ hẳn năm test** | **+2,61** | **+5,51** |

⇒ **~22 % giá trị của bản neo ở d≥10 là rò rỉ tự-chứa.** SẢN PHẨM KHÔNG SAI (dùng mọi năm quá khứ
là hợp lệ) — cái sai là **PHÉP ĐO**: mọi con số "+1,4 điểm %" và mọi w "đo được" đều bị thổi lên.
**Không được sửa file weights theo số cũ.** Phải dựng bản neo bỏ-năm-test rồi fit lại.

### ⚠ (3) THIẾT KẾ MẪU KHÔNG ĐỦ SỨC PHÂN GIẢI NGƯỠNG CỦA CHÍNH NÓ

16 mốc gốc ⇒ sai số chuẩn 0,38–1,03 ⇒ hiệu ứng nhỏ nhất phát hiện được ở lực 80 % là **1,1–2,9
điểm %**. Ngưỡng "đáng kể 0,5" **nằm DƯỚI sàn phân giải**. Nên mọi phán quyết "HOÀ" ở mức
0,01–0,40 phải đọc là **"không đo được"**, KHÔNG phải "không có hiệu ứng". Thêm: cả 16 mốc đều là
ngày 10 của tháng 1/4/7/10 ⇒ tháng chuyển mùa (3, 9, 11) CHƯA HỀ được thử.

### Sáu giả thuyết — tất cả trượt

| giả thuyết | kết quả | ghi chú |
|---|---|---|
| Trung bình động của chính mình (5–7 ngày) | **THUA −1,8** | cơ chế THẬT (triệt nhiễu đáng 3,2–3,6 ngày tầm) nhưng cửa sổ chỉ-nhìn-lùi tốn đúng ngần ấy ⇒ triệt tiêu nhau |
| Độ tin theo TỪNG Ô thay vì w toàn cục | hoà +0,01 | gợi ý đóng của nó ("chỗ ăn điểm ở CHẤT LƯỢNG BẢN NEO") lại là gợi ý đúng nhất |
| **Gió/sóng 16 ngày** (thông tin tương lai thật) | hoà +0,11 | xem dưới — nhánh này ĐÃ BỊ ĐÓNG |
| Fit trọng số theo đúng thước đo top-100 | hoà +0,08 | |
| Dịch cả trường theo vectơ đo được | THUA 0 | trần oracle của tịnh tiến cứng = 0 |
| Cộng xu hướng mùa (anomaly-persistence) | hoà +0,4 | biến thể mùa vụ nội suy theo NGÀY đáng làm vì lý do SẢN PHẨM (xoá cú nhảy bậc thang khi qua tháng), KHÔNG phải vì chính xác |

**NHÁNH GIÓ/SÓNG ĐÃ ĐÓNG — đừng đề xuất lại.** Chính số liệu của giả thuyết gió bác nó: cho biết
**HOÀN HẢO** thành phần 1° của phần dư cũng chỉ mua được **+9–10 điểm %** trên ~40 điểm còn thiếu
(trần cứng cho MỌI trường thô 1°, gồm gió/sóng Open-Meteo). Gió thật hiện thực hoá **1,2 %** của
trần đó. Bốn trong sáu báo cáo chuyền tay nhau khuyến nghị "ưu tiên khai thác gió" — nó đã bị
chính dữ liệu của họ bác.

### Nhánh DUY NHẤT còn tín hiệu: bản neo NHIỀU NĂM HƠN

Thay bản mùa vụ đang ship bằng bản neo dựng từ corpus **loại hẳn năm test**, giữ nguyên công thức
pha, **0 tham số fit**: +2,41 ± 0,38 vs ảnh thuần (dương **16/16** mốc, p < 0,0001) và
**+1,10 ± 0,39 vs bản đang ship** (p = 0,013, bỏ-1-mốc [0,91; 1,23]). Thắng CẢ HAI mốc, vượt
ngưỡng, bền, không có gì để hái quả.

**NHƯNG** bản đó dùng cả năm SAU mốc gốc — không nhân quả. Bản chỉ-dùng-năm-TRƯỚC:
**+0,68 ± 0,47, dương 7/12, p = 0,19** — ngay tại ngưỡng, **CHƯA CHỨNG MINH**. Xu hướng 1→3 năm
neo cho thấy nhiều năm hơn sẽ khá lên.

**Phép đo tiếp theo đáng làm (chốt trước ngưỡng):** dựng bản neo từ **5–8 năm TRƯỚC 2022**, đủ 12
tháng (~570 ngày-bản-đồ, chạy nền theo lô 1–2 ngày máy, mở rộng `fish-corpus-build.mjs`), đo lại
LOYO nhân quả. **≥ +0,7 vs bản đang ship ⇒ cài. < +0,4 ⇒ đóng vĩnh viễn nhánh "pha với quá khứ".**

### ĐÍNH CHÍNH nội bộ hồ sơ

Con số **"trần 79,6–84,9 ⇒ còn 17–19 điểm % đất trống"** trong báo cáo giả thuyết #1 **KHÔNG DÙNG
ĐƯỢC**: nó dùng ngày SAU ngày đích và phẳng theo tầm ngày *theo cấu tạo*, nên đo "trường sự thật
trơn tới mức nào" chứ không đo "dự báo được bao nhiêu". Trần đúng cho bài toán nhân quả là mục (1)
ở trên.

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
