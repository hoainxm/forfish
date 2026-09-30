# 13 — ba-spec: Trợ lý giọng nói ("Trợ lý")

> Load khi: task chạm `src/lib/assistant/**`, `src/components/assistant/**`, `/api/tro-ly`, nút nổi mic trên app ngư dân, chip gợi ý theo màn, hoặc bất kỳ câu hỏi "bà con nói gì thì app hiểu gì, trả lời ra sao, làm gì, khi nào cần sóng".
covers: src/lib/assistant/, src/components/assistant/, src/app/api/tro-ly/
last_verified: 2026-09-06
ttl_days: 90
<!-- DOC-STATUS: SUSPECT (2026-09-08) — code 'src/app/api/tro-ly/' doi sau last_verified. DOI CHIEU VOI CODE truoc khi tin. May quan ly dong nay, dung sua tay. -->
version: v1.1 (2026-09-06) — hợp nhất sau phản biện ([_generated/phan-bien-tro-ly-2026-09-06](_generated/phan-bien-tro-ly-2026-09-06.md)); CHƯA build. **14-kien-truc = nguồn TÊN** (mã `Intent`, type, export, mã lỗi, khoá — bảng mã dùng chung ở 14 §3.0); **13 = nguồn HÀNH VI + câu chữ**; **TROLY-BRIEF §4 = luật cao nhất** (§0 dưới).

> **Mục đích**: ORACLE HÀNH VI cho agent build + QA — bà con nói câu gì thì app hiểu thành ý định nào, trả lời bằng dữ liệu nào, làm hành động gì, hỏi lại khi nào, và im/nói thật khi thiếu gì. Không mô tả pixel (việc của [07-design-spec](07-design-spec.md)); không mô tả prompt/SDK/tool schema (việc của 14-kien-truc + ADR 0009).
>
> **Vị trí trong bốn lời hứa**: không phải trục thứ năm. Trợ lý là **cách vào nhanh** cho cả bốn lời hứa — đỡ gõ, đỡ chọn. Nó không có dữ liệu riêng: mọi câu trả lời offline lấy từ thứ ĐÃ NẰM TRONG MÁY (CLAUDE.md 🟡 offline), mọi câu online đi qua `/api/tro-ly`.
>
> **Từ vựng UI (cấm jargon)**: "Trợ lý" (không "AI", không "chatbot", không "assistant") · "Nói" / "Bấm để nói" · "Đang nghe" · "Đang nghĩ" · "Gõ thay vì nói" · "Tắt tiếng" / "Bật tiếng" · "Có sóng mới hỏi được" (không "online/offline", không "kết nối"). Xưng **"tôi"**, gọi **"bác"** (LEAD §1). Không nói "mô hình", "máy chủ", "token", "lượt gọi API".

---

## 0. Chốt của lead sau phản biện (TROLY-BRIEF §4 — LUẬT CAO NHẤT, 2026-09-06)

| # | Chốt | Áp vào |
|---|---|---|
| 1 | Trợ lý CHỈ dùng **giỏ CHỢ** (`forfish.mcart.v1`), không đụng giỏ SDVICO. "Thêm N món X" = **ONLINE**: tìm `/api/cho/san-pham?q=` (top 3) → chạm xác nhận → `addMarketLine`. Mất sóng: nói thật "tìm món cần có sóng" + chip mở `/cho/tim?q=` | INT-13/14, §4.3, AC-T41/42, §11 #1 |
| 2 | Dẫn đường tới điểm đã lưu: **v1 = mở `/ngu-truong` + đọc "bấm Điểm đã lưu rồi chọn <tên>"** (3 chạm). Nợ có trần: `?den=<placeId>` khi đụng route-planner Trục 1 | INT-07, §4.3, AC-T17/40, §10 việc 8, §11 #2 |
| 4 | Web Speech STT **cần mạng** trên iOS/Android ⇒ khi `isDefinitelyOffline()`: mic vẫn thử 1 lần, lỗi `network` → tự chuyển sang **CHIP + ô gõ làm hàng chính**, câu *"Mất sóng nên tôi không nghe được, bác chạm câu bên dưới."* Native STT offline (Capacitor) = nợ có trần | §5.4, §11 #4 |
| 6 | Premium (>3 ngày, dự báo cá): **cả hai tầng** tôn trọng `lib/tier.ts`; offline chỉ đọc bản đã lưu (máy có là được xem); tool thời tiết máy chủ trả ≤3 ngày (v1: mọi hạng) | INT-02, AC-T11, §11 #6 |
| — | Hotline: `SDVICO_HOTLINE` / `SDVICO_HOTLINE_DISPLAY` từ `src/data/sdvico-showcase.ts` (đã có, **không lift thêm**). `/tien` không có param mục — chỉ mở `/tien`. Hạn mức **30 lượt/ngày/SĐT**: đếm trong bộ nhớ instance + file khi `MARKET_STORE=file`; nợ bảng. Mock: `ASSISTANT_MOCK=1` hoặc thiếu khoá khi không production | INT-21, AC-T23, §7.2, §11 #3/#7/#9 |

---

## 1. Người dùng & mục tiêu — "đỡ gõ, đỡ chọn"

| Persona | Là ai | Hoàn cảnh lúc dùng | Muốn gì từ Trợ lý | Sợ gì |
|---|---|---|---|---|
| **Chú Bảy — chủ tàu, 58 tuổi** (người dùng chính, [06 §2](06-jtbd-quan-ly-tau.md)) | Chủ tàu lưới vây Bình Định, tay to ngón thô, đọc chậm, gõ dấu không quen, hay nói giọng miền Trung nuốt âm | Sáng 4–5h ở cảng, nắng chưa lên nhưng tay ướt; giữa biển máy nổ ồn, sóng chập chờn, sóng điện thoại lúc có lúc không | Hỏi một câu là ra: "mai đi được không", "giấy tờ còn hạn không", "gọi thằng bán đá" — không phải mò tab | Bấm nhầm đặt hàng; app nói "không có bão" khi tin đã cũ; bị hỏi lại nhiều lần |
| **Anh Tâm — thuyền trưởng làm thuê, 44 tuổi** | Rành Zalo, Shopee ở mức cơ bản; cầm điện thoại chủ tàu hoặc máy riêng; quản 8–10 bạn thuyền | Trên ca-bin, một tay lái, một tay cầm máy; nắng chói qua kính; động cơ + bộ đàm ồn | Hỏi con nước, sóng gió theo giờ, dẫn đường tới điểm đã ghim; mua nhớt, lọc dầu cho chuyến sau | Trợ lý nghe sai tên cảng rồi đổi cảng nhà; đọc to số CCCD bạn thuyền trước mặt người khác |
| **Chị Hoa — vợ chủ tàu ở bờ, 50 tuổi** (người đại diện trên bờ — [06 §2](06-jtbd-quan-ly-tau.md), rất quan trọng) | Người thật sự thao tác app khi chồng ngoài khơi: theo dõi đơn vật tư, giấy tờ sắp hết hạn, tin bão | Ở nhà/ở chợ, có sóng, có thể ồn chợ; đọc được nhưng ngại gõ dài | "Đơn dầu tới chưa", "giấy phép hết hạn khi nào", "gọi shop"; hỏi kinh nghiệm ("mùa này cá gì được giá") | Trợ lý huỷ đơn/đặt đơn mà không hỏi; hết lượt online mà không biết vì sao |

**Mục tiêu sản phẩm (chủ dự án, LEAD §1)**: *"ngư dân trao đổi cho đỡ gõ vào hay chọn… đạt 90% về đơn giản"*. BA diễn thành 5 thước đo ở §2 và bộ 20 việc ở §10.

**Không phải mục tiêu**: trò chuyện cho vui, tra cứu kiến thức chung ngoài nghề biển, thay thế banner bão/dải khẩn (những thứ đó vẫn theo [07 §12](07-design-spec.md)).

---

## 2. Nguyên tắc đơn giản — đo được

| # | Nguyên tắc | Đo bằng | Ngưỡng đạt |
|---|---|---|---|
| P1 | **1 chạm để nói** | Từ bất kỳ màn nào của app ngư dân: số chạm để mic bắt đầu nghe | = 1 (chạm nút nổi là nghe ngay, không màn trung gian, không hỏi "bác muốn gì?") |
| P2 | **0 chạm để nghe** | Sau khi nói xong, số chạm để nghe câu trả lời | = 0 (tự đọc to trừ khi đã "Tắt tiếng"; chữ TO hiện cùng lúc) |
| P3 | **≤2 chạm cho việc thường ngày** | 20 việc ở §10: chạm nói + (nếu có hành động) chạm xác nhận | ≥18/20 việc ≤2 chạm khi mic dùng được; ≤3 chạm khi phải dùng chip/gõ |
| P4 | **Không thuật ngữ** | Rà mọi chuỗi UI + câu nói của trợ lý bằng danh sách cấm (§ Từ vựng) | 0 từ cấm trong `src/lib/assistant/**` + `src/components/assistant/**` (test chuỗi) |
| P5 | **Câu trả lời ≤2 câu + 1 hành động** | Đếm câu trong `speak`; đếm nút hành động trên tấm che | `speak` ≤2 câu, ≤ ~40 chữ; đúng 0 hoặc 1 nút hành động chính (chip gợi ý không tính) |
| P6 | **Không hỏi cái máy đã biết** | Câu hỏi lại chỉ được hỏi tham số máy KHÔNG suy ra được | Cảng = cảng nhà, ngày = hôm nay, tàu = tàu đang chọn — không hỏi lại ba thứ này |
| P7 | **Mất sóng vẫn có ích** | Số ý định offline / tổng ý định | ≥ 2/3 ý định chạy không cần sóng (§3 cột Tầng) |
| P8 | **Không bao giờ làm việc có hậu quả bằng giọng** | Danh sách hành động ghi | Đặt hàng · huỷ đơn · xoá bất kỳ thứ gì · gửi tin · đổi mật khẩu: **KHÔNG có ý định nào** — nói tới là chỉ đường tới màn, không làm |

Luật thiết kế kế thừa nguyên: tap ≥3.5rem ([03 §Nút hành động 5](03-design-system.md)), rem không px, contrast cao, chỉ bày cái KEY (03 §Khung nhập C1), X đóng = `CloseButton` (03 §X đóng), không toast (07 §12), mọi request có đồng hồ + `.catch` (CLAUDE.md 🟡).

---

## 3. Bảng ý định (INT-xx)

### 3.0 INT-xx ↔ mã `Intent` trong code (bảng mã dùng chung — bản gốc ở [14 §3.0](14-kien-truc-tro-ly.md))

INT-xx là **nhãn nghiệp vụ** (câu nói, câu trả lời, ma trận thiếu dữ liệu ở đây). Mã trong `types.ts`/prompt/test là cột phải; QA truy vết theo cả hai.

| INT | `Intent` | INT | `Intent` |
|---|---|---|---|
| 01/02/03 | `thoi_tiet` (slot `day`, `aspect` song/gio/mua, `portName`) | 15 | `xem_gio` |
| 04 | `bao` | 16 | `don_cua_toi` |
| 05 | `con_nuoc` | 17 | `gia_ca` |
| 06 | `thoi_tiet` với `aspect:"di_duoc"` | 18 | `gia_dau` |
| 07 | `dan_duong` | 19 | `tin_mua_ban` |
| 08 | `dat_cang_nha` | 20 | `mo_man` |
| 09 | `giay_to` | 21 | `goi_shop` · `goi_sdvico` |
| 10 | `bao_duong` | 22 | `hop_thu` |
| 11 | `thuyen_vien` | 23 | `tro_giup` |
| 12 | `tau_cua_toi` (slot `boatName` = đổi tàu) | 24 | `tat_tieng` · `bat_tieng` · `lap_lai` · `huy` (+`xac_nhan`/`tu_choi` khi đang chờ) |
| 13 | `tim_mon` | 25 | `hoi_mo` |
| 14 | `them_gio` | 26 | `ngoai_pham_vi` |
| — | — | 27 | `chao_hoi` · `khong_hieu` (`reason: qua_dai`) |

Hành động = `AssistantAction` 7 loại (14 §3.1): `navigate · search · addToCart · call · setHomePort · setBoat · mute`. Hỏi lại = `reply.clarify` (câu + chip ≤4). Ý thứ hai trong câu = `parsed.followUp`.

Quy ước cột:
- **Câu nói thật**: ≥5 biến thể — có không dấu, nói tắt, giọng miền (Bắc/Trung/Nam). Bộ hiểu chuẩn hoá bỏ dấu + đồng nghĩa (`normalize.ts`), nên "bao" = "bão" = "bao" đều phải khớp theo ngữ cảnh.
- **Tham số**: `[cảng]` mặc định cảng nhà (`loadHome().portId` → `PORTS`/`FISHING_PORTS`); `[ngày]` mặc định hôm nay (giờ VN, `lib/days.ts`); `[tàu]` mặc định tàu đang chọn (`boat-store`); `[số lượng]` số + đơn vị đếm ("2 cây đá", "một thùng nhớt", "chục lít"); `[món]` chuỗi tự do.
- **Tầng**: **OFF** = trả lời từ máy, không cần sóng · **ON** = cần `/api/tro-ly` · **OFF→ON** = máy trả lời trước, có sóng thì bổ sung/thay bằng bản mới.
- **Dữ liệu máy**: khoá/hàm đọc (client glue `device-snapshot.ts` gom, lib thuần không đọc localStorage).
- **Nói / Hiện**: `speak` (ngắn, đọc to) và `text` (hiện, kèm mốc lưu qua `savedAgoLabel`). Mọi số liệu dự báo kèm "lưu N phút/giờ trước" khi là bản lưu.
- **Xác nhận**: **Có** = phải chạm nút xác nhận trên tấm che trước khi làm; **Không** = làm ngay (chỉ cho hành động đảo được / chỉ điều hướng).
- **Thiếu dữ liệu**: câu nói khi máy không có gì để trả lời (không bịa, không nói "mạng yếu" — nói tuổi dữ liệu hoặc "chưa có").

### 3.1 Nhóm ĐI BIỂN (Trục 1)

| Mã | Tên | Câu nói thật (≥5) | Tham số | Tầng | Dữ liệu máy | Nói / Hiện | Hành động · Xác nhận | Thiếu dữ liệu |
|---|---|---|---|---|---|---|---|---|
| **INT-01** | Thời tiết hôm nay | "thời tiết hôm nay sao" · "hom nay bien the nao" · "nay sóng gió ra sao" · "trời hôm nay có êm không" · "bữa nay đi biển được không" · "coi thời tiết Vũng Tàu giùm" · "sóng ở Sa Kỳ bữa nay" | `[cảng]`, `[ngày]=hôm nay` | OFF→ON | `forfish.sea.<portId>.v3` qua `loadForecast("sea", portId)` → `ScoredSeaDay[]` (`scoreDay`, `levelOf`, `LEVEL_LABEL`); `weatherFromCode` cho mưa/dông; `savedAt` | Nói: "Hôm nay ở Hòn Rớ sóng cỡ 0,8 mét, gió 25 cây số giờ, điểm đi biển 82 — đi được." Hiện: 3 dòng sóng/gió/mưa-dông + "Số lưu 2 giờ trước" + chip "Xem bản đồ" | Chip → `/ngu-truong` · Không | Chưa có bản lưu cho cảng đó: "Máy chưa có số cho cảng Sa Kỳ. Mở Ra khơi lúc còn sóng để tải sẵn." + chip "Mở Ra khơi". Không có cảng nhà: hỏi lại 1 lần "Bác hay đi từ cảng nào?" (chip 4 cảng gần theo `loadHome().province`) |
| **INT-02** | Thời tiết ngày mai / N ngày tới | "ngày mai sao" · "mai đi được không" · "mot hai bua nua the nao" · "ba ngày tới sóng gió sao" · "cuối tuần biển êm không" · "mốt trời sao" · "tuần sau có đi được không" | `[cảng]`, `[ngày]` (mai/mốt/N ngày/thứ) | OFF→ON | như INT-01, chọn ngày; `lib/tier.ts` `effectivePremiumMark` (dấu hạng trong máy) | Nói: "Ngày mai sóng 1,2 mét, gió 35, có mưa dông — nên cân nhắc." Hiện: thẻ ngày + "Số lưu…" | Chip → `/ngu-truong` · Không | Ngày >3 ngày tới mà hạng thường (`snapshot.premium=false`): "Dự báo quá 3 ngày là phần Premium — gọi SDVICO để mở. Ba ngày tới thì: …" (nói luôn 3 ngày free; **mất sóng thì ẨN lời mời**, chỉ nói 3 ngày — 07 §12 tầng 5). Premium: đọc ngày đó **nếu bản lưu trong máy có** (lead §0 #6 — không gọi mạng thêm). Bản OFF→ON bổ sung / tool máy chủ chỉ ≤3 ngày (v1 mọi hạng). Không có bản lưu: như INT-01 |
| **INT-03** | Sóng / gió cụ thể | "sóng cao bao nhiêu" · "gió cấp mấy" · "gio manh khong" · "có dông không" · "mưa không" · "sóng lớn hông" · "gió giật bao nhiêu" | `[cảng]`, `[ngày]`, `[yếu tố]`=sóng/gió/mưa/dông | OFF→ON | như INT-01 (`waveMaxM`, `windMaxKmh`, `gustMaxKmh`, `precipMm`, `wmoCode`, cờ `waveEstimated`) | Nói: "Sóng hôm nay cỡ 0,8 mét, số ước từ gió." (khi `waveEstimated`) Hiện: 1 số to + đơn vị đời thường (mét; km/giờ kèm "cấp ~5" nếu lib có quy đổi, không thì chỉ km/giờ) | Chip → `/ngu-truong` · Không | như INT-01 |
| **INT-04** | Có bão không | "có bão không" · "co bao khong" · "áp thấp sao rồi" · "bão số mấy tới đâu rồi" · "biển đông có bão hông" · "tin bão mới nhất" · "bão vô chưa" | — | OFF→ON | `loadForecast(STORM_NS, STORM_ID)` → `StormCheck` + `checkedAt`; `stormStatus`, `stormNoticeText`, `stormAgeLabel`, `STORM_MAX_AGE_MS` | **Có bão**: Nói: "Có bão WUTIP, gió 120, tâm ở … — tin lúc 14 giờ. Đừng ra vùng ảnh hưởng, nghe đài duyên hải." Hiện: thẻ cơn + chip "Xem trên bản đồ". **Không có (tin ≤12h)**: "Không có tin bão, hỏi lúc 14 giờ ngày 6/9. Vẫn nghe đài duyên hải nhé." | Chip → `/ngu-truong?bao=<id>&cap=<alert>` · Không | Tin cũ >12h hoặc chưa có: **CẤM nói "không có bão"** — nói đúng `stormNoticeText`: "Tin bão trong máy đã cũ 18 giờ — nghe đài duyên hải / Icom." Có sóng thì tự hỏi lại `/api/storms` (28 s) rồi nói tiếp |
| **INT-05** | Con nước / thuỷ triều | "con nước hôm nay" · "nuoc len hay xuong" · "mấy giờ nước lớn" · "nước ròng lúc nào" · "triều cường không" · "bữa nay nước sao" · "nước rặc mấy giờ" | `[cảng]`, `[ngày]` | OFF | `lib/tides.ts`: trạm gần cảng nhà (`nearestTideStation`, file trạm đã tải qua `fetchTideStations` — SW giữ), `tideCardAt`, `tideUpcomingText`, `tideTrendText`, `tideModelCaveat` | Nói: "Nước đang lên, lớn nhất lúc 9 giờ 40 cỡ 2,1 mét, ròng lúc 16 giờ." Hiện: 2 mốc tới + dòng caveat mô hình nếu trạm là mô hình | Chip → `/ngu-truong` (lớp con nước) · Không | Chưa có file trạm trong máy: "Máy chưa tải bảng con nước. Mở Ra khơi lúc còn sóng." Trạm xa >120 km (`TIDE_FAR_KM`): nói kèm "trạm gần nhất cách X km, chỉ tham khảo" |
| **INT-06** | Đi được không / điểm đi biển | "mai đi được không" (khi câu có "được không" → ưu tiên INT-06 hơn INT-02) · "di duoc khong" · "hôm nay ra khơi ok không" · "điểm đi biển mấy" · "biển có êm không" · "có nên đi không" | `[cảng]`, `[ngày]` | OFF→ON | như INT-01 + INT-04 (điểm + bão gộp) | Nói theo `levelOf`: good → "Điểm 85, biển êm — đi được. Không có tin bão (hỏi lúc …)." caution → "Điểm 55, sóng gió vừa — bác cân nhắc." bad → "Điểm 20, sóng 2,5 mét — không nên đi." **Luôn thêm**: "Nghe thêm đài duyên hải." | Chip → `/ngu-truong` · Không | Không có số: "Máy chưa có dự báo để nói đi được hay không. Đừng đoán — nghe đài duyên hải." Tin bão cũ: nói tuổi tin trước, rồi điểm |
| **INT-07** | Dẫn đường tới điểm đã lưu | "dẫn đường tới bãi mực" · "chỉ đường ra điểm X" · "dan duong ve cang" · "đi tới chỗ hôm qua ghim" · "về cảng nhà" · "tới điểm số 2" · "chạy ra Hòn Cau" | `[điểm]` = tên điểm đã lưu (khớp mờ) hoặc "cảng nhà" | OFF | `loadPlaces()` (`forfish.places.v1`), `homeOf`, `sortedPlaces`; khớp tên bỏ dấu (snapshot chỉ mang **tên**, không toạ độ) | **v1 (lead §0 #2)** Nói: "Tôi mở Ra khơi. Bác bấm Điểm đã lưu rồi chọn Bãi mực Hoàng Sa nhé." Hiện: tên điểm + chip "Mở Ra khơi". Tấm che đóng, màn Ra khơi mở (bà con bấm Điểm đã lưu → chọn tên = 3 chạm) | Điều hướng `/ngu-truong` · **Không** (chỉ mở màn). `// nợ: ?den=<placeId> mở thẳng thẻ dẫn đường (2 chạm) — khi đụng route-planner Trục 1` | Không có điểm nào: "Bác chưa ghim điểm nào. Mở Ra khơi, chạm giữ trên biển để ghim." Nhiều điểm khớp: chip ≤4 tên để chọn (`clarify`). Không khớp: "Không thấy điểm tên đó. Bác có: A, B, C." (đọc tối đa 3 tên) |
| **INT-08** | Đặt cảng nhà | "đặt cảng nhà là Quy Nhơn" · "cang nha cua toi la Sa Ky" · "tôi hay đi từ Hòn Rớ" · "đổi cảng nhà sang Phan Thiết" · "cảng của tui là Tắc Cậu" | `[cảng]` (khớp mờ trong `FISHING_PORTS` 173 + `PORTS` 10) | OFF | `loadHome`/`saveHome` (`forfish.home.v1`); `places.ts` `makeHome` nếu cảng có toạ độ | Khớp rõ (1 kết quả, độ khớp cao): làm ngay. Nói: "Đã đặt cảng nhà là Quy Nhơn, Gia Lai. Không đúng thì chạm 'Đổi lại'." (tên CÓ DẤU + tỉnh tra từ danh sách; khớp bỏ tiền tố "cảng cá/cảng/bến", cùng cảng ở hai danh sách gộp làm một — `lib/assistant/ports.ts`). Hiện: chip "Đổi lại" (đặt lại cảng cũ; chưa có cảng cũ → "Không phải, chọn cảng khác") | Ghi `saveHome` · **Không** (đảo được — 03 §X đóng mục 7) nhưng **có đường lùi 1 chạm** | Khớp mờ/nhiều cảng: hỏi lại 1 lần với chip ≤4 cảng. Không khớp: "Không thấy cảng tên đó. Bác nói lại tên cảng, hoặc chọn trong danh sách." + chip "Mở danh sách cảng" (`/cang`). Ghi hỏng: băng đỏ `storageFullCopy("cảng nhà")`, không nói "đã đặt" |

### 3.2 Nhóm TÀU · GIẤY TỜ · BẠN THUYỀN (Trục 3 + 4)

| Mã | Tên | Câu nói thật (≥5) | Tham số | Tầng | Dữ liệu máy | Nói / Hiện | Hành động · Xác nhận | Thiếu dữ liệu |
|---|---|---|---|---|---|---|---|---|
| **INT-09** | Giấy tờ sắp hết hạn | "giấy tờ nào sắp hết hạn" · "giay phep con han khong" · "đăng kiểm tới khi nào" · "bảo hiểm tàu còn không" · "coi giấy tờ giùm" · "giấy gì hết hạn chưa" · "hạn giấy phép khai thác" | `[tàu]`, `[loại giấy]` tuỳ chọn (`DOCUMENT_KINDS`) | OFF | `forfish.documents.v1` qua `readUserList` (3 nhánh, đọc hỏng → nói thật), `getExpiryStatus(doc, todayVN)`, `byUrgency`, `SOON_DAYS_DOCS=30` | Nói: "Tàu BĐ-91234 có 2 giấy cần lo: đăng kiểm hết hạn 12 ngày nữa, bảo hiểm hết hạn hôm nay." (đọc tối đa 3, đỏ trước vàng). Hiện: danh sách ≤4 dòng + chip "Mở tủ giấy tờ" | Chip → `/tau?tab=giay-to` · Không | Không có giấy nào sắp/đã hết: "Giấy tờ tàu BĐ-91234 đều còn hạn, gần nhất là giấy phép còn 95 ngày." Tủ trống: "Tủ giấy tờ còn trống. Mở Tàu cá để thêm." Đọc hỏng: "Sổ giấy tờ trong máy đang đọc không được — mở Tàu cá xem giúp." (không nói "đều còn hạn") |
| **INT-10** | Bảo dưỡng tới hạn | "bảo dưỡng gì tới hạn" · "toi ky thay nhot chua" · "máy tới kỳ chưa" · "việc bảo dưỡng nào quá hạn" · "thay lọc dầu chưa" · "coi sổ bảo dưỡng" | `[tàu]`, `[hạng mục]` tuỳ chọn | OFF | `forfish.maintenance.v1` (`MaintenanceEntry`: `item`, `lastDone`, `intervalDays`, `boatId`), `daysUntil` giờ VN, `SOON_DAYS_SERVICE=14` | Nói: "Có 1 việc quá hạn: thay nhớt máy chính, trễ 6 ngày. Sắp tới: lọc dầu còn 9 ngày." Hiện: ≤4 dòng + chip "Mở sổ bảo dưỡng" | Chip → `/tau?tab=dich-vu` · Không | Sổ trống: "Chưa ghi việc bảo dưỡng nào. Mở Tàu cá, mục Dịch vụ để thêm." Không việc nào tới hạn: "Chưa có việc bảo dưỡng nào tới kỳ trong 2 tuần." |
| **INT-11** | Bạn thuyền — đủ người / ai thiếu giấy | "bạn thuyền thiếu gì" · "ai chua co bao hiem" · "tàu có mấy người" · "danh sách bạn thuyền" · "ai thiếu căn cước" · "bảo hiểm thuyền viên còn không" · "chứng chỉ máy trưởng hết chưa" | `[tàu]` | OFF | `forfish.crew.v1` qua `readUserList`, `crewIssue(m, today)` (`danger/warn/neutral/ok`), `ROLE_LABELS` | Nói: "Sổ có 8 người. 2 người cần lo: anh Tâm chưa có bảo hiểm, chú Năm chứng chỉ máy trưởng hết hạn 5 ngày nữa." **KHÔNG đọc số CCCD, SĐT** — chỉ tên + việc. Hiện: ≤4 dòng + chip "Mở Bạn thuyền" | Chip → `/nguoi` · Không | Sổ trống: "Chưa có ai trong sổ bạn thuyền." Ai cũng ok: "8 người, giấy tờ đủ cả." Đọc hỏng: nói thật như INT-09 |
| **INT-12** | Tàu của tôi / đổi tàu | "tàu đang chọn là tàu nào" · "doi sang tau BD 91234" · "tôi có mấy tàu" · "chuyển qua tàu kia" · "tàu này số gì" | `[tàu]` (khớp mờ số hiệu/tên) | OFF | `boat-store` (`forfish.boats.v1`, `forfish.currentBoat.v1`), `setCurrentBoat` | Nói: "Đang chọn tàu BĐ-91234. Bác có 2 tàu." Đổi tàu: "Đã chuyển sang tàu BĐ-97777." + chip "Đổi lại" | `setBoat` → `setCurrentBoat` · **Không** (đảo được, có chip lùi) | 0 tàu: "Chưa có tàu nào trong máy. Mở Tàu cá để thêm tàu." Không khớp: chip ≤4 tàu (`clarify`) |

### 3.3 Nhóm MUA BÁN (Trục 2 + 3 — chợ vật tư `/cho`, giá cá `/tien`)

| Mã | Tên | Câu nói thật (≥5) | Tham số | Tầng | Dữ liệu máy | Nói / Hiện | Hành động · Xác nhận | Thiếu dữ liệu |
|---|---|---|---|---|---|---|---|---|
| **INT-13** | Tìm / mua món | "tôi cần mua đá" · "tim nhot castrol" · "mua lọc dầu Yanmar" · "chỗ nào bán lưới" · "kiếm cái bơm nước biển" · "cần dầu DO" · "mua 2 thùng nhớt" (không có "vào giỏ" → INT-13, không phải INT-14) | `[món]`, `[số lượng]` tuỳ chọn | ON | Không có danh mục chợ trong máy (11 §9: chợ không cache). Có sóng: `/api/cho/san-pham?q=` | Nói: "Tìm được 6 món 'nhớt'. Bác coi rồi chọn nhé." Hiện: ≤3 món đầu (tên · giá · shop) + nút **"Xem hết"** | Điều hướng `/cho/tim?q=<món>` · **Không** (chỉ mở màn tìm) | Mất sóng: "Chợ cần có sóng mới tìm được. Có sóng lại bác hỏi tôi tìm 'nhớt' nhé." + chip "Mở chợ" (màn quy ước 11 §9). 0 kết quả: "Chợ chưa có món tên đó. Bác nói tên khác, hoặc mở chợ coi theo nhóm." |
| **INT-14** | Thêm N món X vào giỏ (**giỏ CHỢ, ONLINE — lead §0 #1**) | "thêm 2 thùng nhớt vào giỏ" · "bo 5 cay da vo gio" · "cho 1 cái lọc dầu vào giỏ" · "lấy 3 cái kẽm chống ăn mòn" · "thêm vô giỏ 1 can 20 lít" · "mua giùm 2 bao muối bỏ giỏ" | `[số lượng]` (mặc định 1, clamp 1..999), `[món]`, `[biến thể]` nếu nói ("20 lít") | ON | Tìm qua `/api/cho/san-pham?q=&pageSize=3` (`marketGet`, 12 s) — `use-assistant` gọi, lib thuần không; giỏ chợ `lib/market/cart.ts` (`addMarketLine`, `saveMarketCart`, ngăn SĐT; `CART_MAX_LINES=50`) | Tìm được ĐÚNG 1 món mua được (`isPurchasable`): Nói: "Thêm 2 Nhớt Castrol CRB 18 lít, shop Đại Phát, 1 triệu 430 một thùng vào giỏ nhé?" Hiện: thẻ món (ảnh · tên · giá · biến thể) + `QtyStepper` sẵn số 2 + nút **"Thêm vào giỏ"** / "Thôi". Sau khi thêm: "Đã thêm (n)" inline + chip "Xem giỏ" | `addMarketLine` → `saveMarketCart` · **Có** (chạm "Thêm vào giỏ" trên thẻ — không cặp Đồng ý/Thôi thứ hai) | Mất sóng: "Chợ cần có sóng mới tìm được. Có sóng lại bác hỏi tôi thêm 'nhớt' nhé." + chip `/cho/tim?q=` (không xếp hàng chờ, không outbox — 11 R14). Nhiều món khớp (top 3, `reply.candidates`): ≤3 thẻ, mỗi thẻ có nút "Thêm vào giỏ" (chạm = xác nhận). Món có biến thể mà bác không nói: chip biến thể ≤4 (`clarify`; chọn = bước xác nhận luôn, không thêm chạm). Giỏ đầy: câu `gio_day` của 11 §3.3. Ghi hỏng: băng đỏ "Máy hết chỗ — CHƯA lưu được giỏ", không nói "đã thêm". Chưa đăng nhập: giỏ theo ngăn khách của `cartBucket` vẫn thêm được (11 §3.3) |
| **INT-15** | Xem giỏ | "giỏ hàng của tôi" · "trong gio co gi" · "coi giỏ" · "giỏ có mấy món" · "mở giỏ hàng" | — | OFF | `loadMarketCart(phone)` + `loadMarketQuote` (bản tra gần nhất, `quote.at`) | Nói: "Giỏ có 3 món, 2 shop, tổng cỡ 2 triệu 150 theo giá lúc 9 giờ 20." Hiện: ≤3 dòng + chip "Mở giỏ" | Điều hướng `/cho/gio` · Không | Giỏ rỗng: "Giỏ chưa có gì. Bác nói tên món cần mua, tôi tìm giúp." Chưa có bản tra: chỉ đếm dòng, không nói tiền |
| **INT-16** | Đơn của tôi / đơn đang giao | "đơn của tôi sao rồi" · "don dau toi chua" · "hàng tới chưa" · "đơn đang giao" · "coi đơn hàng" · "shop xác nhận chưa" | `[trạng thái]` tuỳ chọn | OFF→ON | `loadCachedMarketOrders(phone)` (`forfish.morders.v1`, `savedAt`, ≤50 đơn); có sóng: `/api/cho/don` | Nói: "Có 1 đơn đang giao: dầu nhớt shop Đại Phát, mã SD260906ABCD — theo bản lưu 40 phút trước." Hiện: ≤3 thẻ đơn + chip "Mở đơn hàng" + (nếu có SĐT shop) chip "Gọi shop" | Điều hướng `/cho/don` · Không. **KHÔNG có ý định huỷ/đã nhận/đánh giá bằng giọng** — nói tới → "Việc đó bác làm trên màn đơn hàng nhé." + chip mở đơn | Chưa có bản lưu + mất sóng: "Máy chưa lưu đơn nào, và đang không có sóng." Không có đơn: "Bác chưa có đơn nào." |
| **INT-17** | Giá cá | "giá cá ngừ hôm nay" · "gia ca thu bao nhieu" · "cá cơm giá sao" · "mực bao nhiêu một ký" · "bảng giá cá" · "giá cá tuần này" · "cá nục ở Quy Nhơn bao nhiêu" | `[loài]` (khớp mờ `PortPrice.species`, `VASEP_RULES`), `[cảng/vùng]` tuỳ chọn | OFF→ON | `loadForecast(PRICE_NS, "port")` (`forfish.fc.price.port`, `savedAt`); tĩnh `src/data/port-prices.ts` khi chưa từng tải; có sóng: `/api/port-prices` | Nói: "Cá ngừ đại dương tuần này 95 tới 110 ngàn một ký, giá đang lên — bản tin tuần 1/9." Hiện: 1 dòng giá to + xu hướng + mốc tuần + chip "Xem bảng giá" | Điều hướng `/tien` · Không | Không có loài đó: "Bảng giá tuần này không có 'cá X'. Bác xem bảng giá đầy đủ nhé." Chưa từng tải: nói giá tham khảo tĩnh **kèm** "giá tham khảo tổng hợp ngày …, chưa phải giá tuần" (không bịa tuần) |
| **INT-18** | Giá dầu | "giá dầu hôm nay" · "dau DO bao nhieu" · "dầu lên hay xuống" · "một lít dầu bao nhiêu" · "giá dầu kỳ này" | — | OFF→ON | `loadForecast(PRICE_NS, "fuel")` (`forfish.fc.price.fuel`, `FuelPrice.do005Zone1/2`, `date`); có sóng: `/api/fuel-price` | Nói: "Dầu DO kỳ 4/9: 19.850 một lít vùng 1, vùng 2 cao hơn chút — 20.250." Hiện: 2 số + ngày kỳ + chip "Xem giá" | → `/tien` · Không | Chưa có: "Chưa lấy được giá dầu kỳ này." (không bịa, không đoán) |
| **INT-19** | Tin mua/bán · bán cá ở đâu | "ai mua cá ngừ" · "dang tin ban ca" · "bán cá ở đâu được giá" · "chỗ nào thu mua mực" · "tin mua bán hôm nay" · "vựa nào ở Sa Kỳ" | `[loài]`, `[cảng]` tuỳ chọn | OFF→ON | chợ tin `market_listings` (bản đã tải nếu có), danh bạ `sell-contacts`/`seafood-buyers` (tĩnh) | Nói: "Ở Sa Kỳ có 3 chỗ thu mua trong danh bạ. Mở Giao dịch để coi và gọi." Hiện: ≤3 dòng (tên · SĐT ẩn số giữa) + chip "Mở Giao dịch" | → `/tien` · Không | Không có: "Chưa có tin mua bán nào trong máy. Có sóng tôi coi lại giúp." **Đăng tin bằng giọng: KHÔNG** — chỉ mở màn |

### 3.4 Nhóm ĐIỀU HƯỚNG · GỌI · TIN

| Mã | Tên | Câu nói thật (≥5) | Tham số | Tầng | Dữ liệu máy | Nói / Hiện | Hành động · Xác nhận | Thiếu dữ liệu |
|---|---|---|---|---|---|---|---|---|
| **INT-20** | Mở màn | "mở ra khơi" · "mo ban do" · "vô tàu cá" · "qua bạn thuyền" · "mở giao dịch" · "vào chợ" · "kênh người bán" · "mở hộp thư" · "về trang chủ" · "mở giấy tờ" · "mở sổ bảo dưỡng" · "mở cảng" | `[màn]` (bảng đích cố định ↓) | OFF | Bảng: ra khơi/bản đồ → `/ngu-truong` · tàu/tàu cá → `/tau` · giấy tờ → `/tau?tab=giay-to` · dịch vụ/bảo dưỡng → `/tau?tab=dich-vu` · sản phẩm/đồ SDVICO → `/tau?tab=san-pham` · bạn thuyền → `/nguoi` · giao dịch/giá cá/tin mua bán → `/tien` · chợ/chợ vật tư → `/cho` · giỏ → `/cho/gio` · đơn → `/cho/don` · bán hàng/kênh người bán → `/ban-hang` · cảng → `/cang` · trang chủ/hộp thư → `/` · hướng dẫn → `/huong-dan.html` | Nói: "Mở Tàu cá." (1 câu, ≤4 chữ). Tấm che đóng, màn mở | Điều hướng · **Không** | Không khớp màn: "Tôi mở được: Ra khơi, Tàu cá, Bạn thuyền, Giao dịch, Chợ. Bác muốn mở cái nào?" + 5 chip |
| **INT-21** | Gọi shop / gọi SDVICO (`goi_shop` · `goi_sdvico`) | "gọi SDVICO" · "goi shop Dai Phat" · "gọi chỗ bán đá" · "gọi tổng đài" · "gọi shop đơn đang giao" · "alo SDVICO giúp" | `[ai]` = SDVICO · tên shop (từ đơn cache) · chỗ bán (`sell-contacts`) | OFF | Hotline: `SDVICO_HOTLINE` (tel) + `SDVICO_HOTLINE_DISPLAY` (đọc) từ `src/data/sdvico-showcase.ts` (lead §0 — một nguồn, không lift); `forfish.morders.v1` (SĐT shop đính kèm đơn, giữ ở client, **không gửi** máy chủ) | Nói: "Gọi SDVICO số 0939 243 222 nhé?" Hiện: tên + số + nút **"Gọi"** / "Thôi" | `tel:` · **Có** (chạm "Gọi" — luật 11 R14: `tel:` KHÔNG ẩn khi mất sóng) | Không có đơn: "Chưa có đơn nào để gọi shop. Mở đơn hàng để coi." **Gọi bạn thuyền ("gọi anh Tâm"): KHÔNG có trong v1** (snapshot không mang tên/SĐT thuyền viên — 14 luật 6) → "Số bạn thuyền ở màn Bạn thuyền." + chip `/nguoi`. Nhiều shop khớp: chip ≤4 |
| **INT-22** | Tin mới / hộp thư | "có tin gì mới không" · "co thong bao gi khong" · "SDVICO nhắn gì" · "đọc tin mới" · "hộp thư có gì" · "tin bão mới nhất" (→ INT-04) | — | OFF | `loadInbox(phone)` (`forfish.inbox.v2`), `forfish.inbox.read.v1` (chưa đọc), `staleWarningVN` cho tin >2h | Nói: "Có 2 tin chưa đọc. Mới nhất, 3 giờ trước: 'Lịch bảo dưỡng tháng 9…'." (đọc tiêu đề + 1 câu đầu của tin mới nhất, tối đa 1 tin). Hiện: ≤3 tin + chip "Mở hộp thư" | → `/` (hộp thư) · Không; **không đánh dấu đã đọc** bằng giọng | Trống: "Chưa có tin nào." |

### 3.5 Nhóm TRỢ LÝ · NGOÀI PHẠM VI · ONLINE

| Mã | Tên | Câu nói thật (≥5) | Tham số | Tầng | Dữ liệu máy | Nói / Hiện | Hành động · Xác nhận | Thiếu dữ liệu |
|---|---|---|---|---|---|---|---|---|
| **INT-23** | Trợ giúp | "bác nói được gì" · "may lam duoc gi" · "giúp tôi" · "hỏi gì được" · "hướng dẫn" · "chỉ tôi cách dùng" | — | OFF | `suggestions.ts` (chip theo màn + giờ) | Nói: "Bác hỏi tôi thời tiết, bão, giấy tờ, giá cá, hay bảo tôi mở màn, tìm món, gọi shop." Hiện: 6 chip ví dụ theo màn đang đứng | Không | — |
| **INT-24** | Điều khiển trợ lý | "tắt tiếng" · "bat tieng" · "nói lại" · "to hơn"(→ không làm, chỉ đường chỉnh máy) · "thôi" / "dừng" / "đóng" · "nghe lại" | — | OFF | `forfish.assistant.v1` (`muted`) | "tắt tiếng": ngừng đọc ngay + ghi `muted=true` + hiện "Đã tắt tiếng — tôi chỉ hiện chữ". "nói lại": đọc lại câu cuối. "thôi/dừng": đóng tấm che | Ghi cờ · Không | — |
| **INT-25** | Câu hỏi mở (kinh nghiệm, giải thích, so sánh) | "mùa này cá gì được giá" · "nhớt nào tốt cho máy Yanmar" · "sao giá dầu tăng" · "cách bảo quản cá ngừ" · "lưới rê với lưới vây khác gì" · "đá xay với đá cây nên mua loại nào" | câu tự do | ON | Client gửi kèm **tóm tắt máy** (§7.3): cảng nhà, tỉnh, điểm đi biển hôm nay, số giấy sắp hết (chỉ loại + ngày), số món trong giỏ | Nói: `speak` của máy chủ (≤2 câu). Hiện: `text` ≤4 câu + nguồn/tính chất ("theo kinh nghiệm chung, giá thật hỏi đại lý") + nếu có `action` → 1 nút xác nhận | `action` chỉ trong tập cho phép: điều hướng · tìm món (`/cho/tim?q=`) · gợi thêm giỏ (đi qua INT-14 xác nhận) · **Có** cho thêm giỏ, **Không** cho điều hướng | Mất sóng: "Câu này phải có sóng mới hỏi được. Có sóng lại bác hỏi nhé. Giờ tôi trả lời được: thời tiết, bão, giấy tờ, giá cá." Hết lượt: §7.2. Không key: §7.2 |
| **INT-26** | Ngoài phạm vi (y tế · pháp lý · tiền bạc cá nhân · chính trị · người khác) | "uống thuốc gì cho hết say sóng" · "bị phạt bao nhiêu nếu…" · "tôi nên vay ngân hàng nào" · "tra CCCD số …" · "chuyện chính trị" · "kể chuyện cười" | — | OFF (chặn TRƯỚC khi lên online — không gửi câu lên máy chủ) | danh sách từ khoá chặn trong `intents.ts` | Nói: "Việc này tôi không trả lời được. Bác hỏi tôi chuyện đi biển, tàu, giấy tờ, mua bán nhé." Y tế thêm: "Đau ốm thì gọi 115 hoặc trạm y tế." Tra người: "Tra cảnh báo bạn thuyền làm ở màn Bạn thuyền, cần CCCD gõ tay." + chip `/nguoi` | Không | — |
| **INT-27** | Chào hỏi · cảm ơn · không hiểu | "alo" · "chào" · "cảm ơn nha" · "ờ" · tiếng ồn/vô nghĩa · câu quá dài (>40 chữ) | — | OFF | — | Chào: "Dạ, bác cần gì?" Cảm ơn: "Dạ." Không hiểu lần 1: "Tôi chưa nghe rõ. Bác nói lại giúp." (mở mic lại). Lần 2: "Bác thử chọn một trong mấy cái này:" + 4 chip theo màn (không mở mic). Quá dài: "Bác nói ngắn từng việc một giúp." | Không | — |

**Ưu tiên khi một câu khớp nhiều ý định** (14 §4.2 cài đúng thứ tự này): (1) INT-26 `ngoai_pham_vi` chặn trước mọi thứ · (2) INT-24 điều khiển + INT-27 chào hỏi · (3) có "vào giỏ/bỏ giỏ/lấy N" → INT-14; có "mua/tìm/cần" không kèm giỏ → INT-13 (kể cả "mua 2 thùng nhớt") · (4) có "được không/nên đi" → INT-06 (`aspect:"di_duoc"`) thắng INT-01/02 · (5) có "bão/áp thấp" → INT-04 thắng INT-01 · (6) INT-20 chỉ khi có động từ mở/vô/qua/vào + tên màn · (7) còn lại theo điểm khớp; điểm < 0.6 → câu ngắn ≤6 chữ: INT-27 hỏi lại lần 1 trước; câu dài / có từ khoá hỏi mở → (có sóng, đã đăng nhập, còn lượt) INT-25 online.

**Nhiều ý trong một câu** ("coi thời tiết rồi gọi SDVICO"): làm ý **đầu tiên**, hiện chip cho ý thứ hai ("Gọi SDVICO") — không tự làm hai việc, không hỏi lại.

---

## 4. Luồng hội thoại

### 4.1 Máy trạng thái UI (`use-assistant.ts`)

```
nghỉ ──chạm nút nổi──► nghe ──có chữ (final)──► nghĩ ──► nói ──► xong ──► (đóng | nghe tiếp)
  ▲                       │                        │        │
  │                    im 8 s                   cần hỏi   chạm bất kỳ
  │                       ▼                        ▼        ▼
  │                  không nghe được ──lần 1──► hỏi lại (mở mic) ──lần 2──► chip gợi ý (không mở mic)
  │                       │
  │              lỗi mic / không quyền / không hỗ trợ
  │                       ▼
  └────────────────── ô gõ (bàn phím) ──gửi──► nghĩ
```

| Trạng thái | Vào khi | Màn hiện | Thoát khi | Đồng hồ |
|---|---|---|---|---|
| **nghỉ** | app mở | chỉ nút nổi | chạm nút | — |
| **nghe** | chạm nút nổi (P1) · nói "nói lại" · sau "hỏi lại" lần 1 | tấm che: vòng mic **đang nhịp**, chữ nghe được hiện dần (interim), chip gợi ý mờ | có kết quả `final` · im lặng **8 s** · chạm chip · chạm "Gõ" · chạm X | 8 s im lặng → "không nghe được"; trần cứng **20 s** một lượt nghe (chống mic treo) |
| **nghĩ** | có câu (từ mic/gõ/chip) | vòng mic ngừng nhịp, dòng "Đang nghĩ…" (chỉ hiện khi >300 ms — offline thường không kịp thấy) | có `answer` · lỗi · hết giờ online | offline: **≤500 ms** (§8); online: tổng **≤8 s** kèm "Đang nghĩ…" từ 300 ms, quá 8 s → chuyển "hơi lâu, bác chờ chút" tới trần client **25 s** (> 20 s máy chủ, để nhận 504 thật thay vì tự cắt — 14 §8) rồi lỗi |
| **nói** | có `answer` | chữ TO câu trả lời + (nếu có) 1 nút hành động + chip tiếp theo; TTS đọc `speak` (trừ `muted`) | TTS xong · chạm bất kỳ (dừng đọc) | TTS bắt đầu **≤1 s** sau khi có answer; nếu TTS không bắt đầu được sau 1,5 s → bỏ, chỉ chữ (không treo) |
| **hỏi lại** | thiếu tham số máy không suy được (INT-01 không cảng nhà, INT-07 nhiều điểm, INT-08 khớp mờ, INT-14 biến thể) · không hiểu lần 1 · **im lặng 8 s lần 1** (máy ĐỌC "Tôi chưa nghe rõ, bác nói lại giúp." rồi mới mở mic lại sau ~1,6 s — audit vòng 2 P1-18) | câu hỏi ngắn + **chip ≤4** lựa chọn + mic mở lại (chỉ lần 1) | chọn chip · nói · im 8 s → chip vẫn còn, mic tắt | **tối đa 1 lần hỏi lại/lượt**; lần 2 = chỉ chip |
| **xong** | nói xong | như "nói", mic tắt, nút nổi thành "Nói tiếp" trong tấm che | chạm "Nói tiếp" → nghe · chạm hành động → làm rồi đóng · chạm X/vuốt → nghỉ | tự đóng tấm che sau **20 s** không tương tác (giữ câu trả lời trong 10 câu gần nhất) |
| **ô gõ** | không hỗ trợ STT · từ chối quyền mic · lỗi mic · chạm "Gõ thay vì nói" | ô nhập ≥16px thực tế (03 §Nút hành động 4), nút "Gửi" inline cuối hàng, chip vẫn hiện | gửi · X | — |

**Bất biến**: mỗi lượt = đúng 1 câu vào → đúng 1 câu ra. Không có "hội thoại nhiều vòng" ngoài 1 lần hỏi lại. Không lưu ngữ cảnh giữa hai lượt trừ **tham số đã hỏi lại** trong cùng lượt (chọn chip cảng → trả lời ngay câu thời tiết đã hỏi, không bắt nói lại).

### 4.2 Luồng OFFLINE-trước, ONLINE-sau

1. Câu vào → `normalize` → `parseUtterance(text, ctx)` (ctx = route hiện tại, giờ VN, có cảng nhà không, có sóng không).
2. Khớp INT-01…24, 26, 27 → `answerOffline(parsed, snapshot, now)` → **trả lời ngay** (≤500 ms), `source: "offline"`. Kèm mốc lưu nếu là dữ liệu tải. Riêng INT-13/14 (ON): có sóng → `use-assistant` gọi `/api/cho/san-pham?q=` (top 3) rồi mới hiện; mất sóng → câu thật + chip `/cho/tim?q=`.
3. Với ý định **OFF→ON** (INT-01/02/03/04/06/16/17/18/19) và máy `navigator.onLine !== false`: **sau khi đã nói bản máy**, gọi nguồn tương ứng (đúng hàm/route sẵn có, đồng hồ sẵn có, `.catch`) → bản mới hơn thì **đổi chữ trên màn** + dòng "Vừa cập nhật" — **không đọc lại** (tránh nói hai lần). Mất sóng/timeout → im, giữ bản máy (07 §12 tầng 4: tuổi dữ liệu là tin, mất sóng không phải tin).
4. Không khớp (INT-27) **và** đủ điều kiện online (có sóng · đã đăng nhập · còn lượt · có key/mock) → `POST /api/tro-ly` với câu + tóm tắt máy (§7.3), trạng thái "nghĩ" có "Đang nghĩ…". Về → `nói`. Không đủ điều kiện → INT-27 "không hiểu" lần 1 (mở mic) kèm câu lý do ngắn nếu là mất sóng/hết lượt (§7.2).
5. INT-25 câu hỏi mở nhận diện được (từ khoá "sao/tại sao/nên/nào tốt/cách/khác gì") → thẳng bước 4, **không** qua "không hiểu".
6. INT-26 chặn ở bước 2, **không bao giờ** lên máy chủ.

### 4.3 Luồng xác nhận hành động

| Hành động | Xác nhận | Nút trên tấm che | Sau khi chạm |
|---|---|---|---|
| Điều hướng (INT-13/15/16/17/18/19/20/22, chip "Xem…") | Không | 1 nút hoặc chip | đóng tấm che → `router.push`. Nút "Mở …" **giữ việc treo** đến khi bà con chạm hoặc nói "ừ" (audit vòng 2 P1-N1: lời mời 'Bác nói "ừ"' phải đi thật). Riêng INT-18 "mở giấy tờ" — bà con đã nói rõ — đi NGAY, không hỏi lại |
| Dẫn đường (INT-07) — v1 | Không (chỉ mở màn) | chip "Mở Ra khơi" | đóng → `/ngu-truong`; bà con bấm Điểm đã lưu → chọn tên (3 chạm — lead §0 #2). Nợ `?den=<placeId>`: khi có, xác nhận "Dẫn đường"/"Thôi" quay lại và **KHÔNG** tự "Bắt đầu dẫn đường" (07 §10.7) |
| Thêm giỏ (INT-14, online) | **Có** | nút "Thêm vào giỏ" **trên thẻ món** (≤3 thẻ) + `QtyStepper`; không cặp Đồng ý/Thôi thứ hai | ghi giỏ → "Đã thêm (n)" inline + chip "Xem giỏ"; ghi hỏng → băng đỏ |
| Gọi (INT-21) | **Có** | "Gọi" / "Thôi" | `window.location.href = tel:` |
| Đặt cảng nhà / đổi tàu (INT-08/12 — `setHomePort` / `setBoat`) | Không (đảo được) | — ; sau khi làm có **hai đường lùi khác việc, khác chữ** (audit vòng 2 P2-N2): chip **"Đổi lại"** = đặt lại NGAY cảng cũ · nút băng **"Chọn cảng khác"** = mở `/cang` chọn tay | ghi ngay |
| Tắt/bật tiếng (INT-24) | Không | — | ghi `forfish.assistant.v1.muted` |
| **Đặt hàng · huỷ đơn · đã nhận · đánh giá · xoá giấy/bạn thuyền/tàu/điểm · đăng tin · gửi tin · đăng xuất · đổi mật khẩu** | **KHÔNG CÓ Ý ĐỊNH** | không có nút | nói tới → câu "Việc đó bác làm trên màn … nhé" + chip mở màn |

Xác nhận bằng **chạm** là đường chính. **Chốt lead P1-7 (2026-09-06)**: "ừ/dạ/đồng ý/ok/được" bằng giọng ĐƯỢC nhận cho việc **hoàn tác được** (thêm giỏ — giỏ sửa/xoá được; mở màn), vì không thêm chạm cho việc đã ≤2 chạm (P3); **gọi điện (`call`) vẫn PHẢI chạm** — máy trả lời "Gọi điện thì bác chạm nút Gọi giúp tôi." và giữ cặp Gọi/Thôi; "thôi/không" bằng giọng huỷ được mọi việc đang chờ. Nói đúng chữ trên chip ("Đổi lại", "Gọi SDVICO") = chạm chip đó.

---

## 5. Màn hình

### 5.1 Nút nổi "Sen Biển" (`assistant-fab.tsx` trên khuôn `ui/float-btn.tsx`)

> **Tên trợ lý = "Sen Biển"** (user chốt 2026-09-07): nhãn dưới icon, tiêu đề tấm che, `aria-label`, và câu tự giới thiệu của tầng mạng ("Tôi là Sen Biển"). Dấu hiệu riêng là mascot `public/icons/sen-bien.png`: **cá xanh + nụ sen cam + cụm sóng xanh dưới chân**, hai vây bên mở như đang lắng nghe. Nút trong suốt hoàn toàn, không nền trắng, viền hay huy hiệu; bóng chỉ bám silhouette mascot theo ngôn ngữ bot ngân hàng. Không robot, hình não, chat-bubble hay lấy mic làm nhận diện.

| Thuộc tính | Quyết định |
|---|---|
| Vị trí | **Mặc định** góc **dưới-phải**, ngay **trên dock** (`bottom: calc(var(--dock-total) + 0.75rem)`, cách mép cột app `1rem`, safe-area đã tính trong `--dock-total`) — cùng góc với rail phải Ra khơi nhưng **thấp hơn rail** để không chồng. Nút nằm **trong cột app 480px** (khung `fixed` căn giữa như `.dock-frame`), KHÔNG neo theo mép trình duyệt — màn rộng không còn bay ra ngoài khung (lỗi thật 2026-09-07) |
| **Kéo được** (2026-09-07) | Giữ và rê là nút đi theo ngón tay (ngưỡng 8px để phân biệt với chạm rung tay); **thả là nép về mép gần nhất** (trái/phải) và giữ độ cao vừa kéo, kẹp trong khung (không lên quá 24px dưới mép trên, không xuống dưới chỗ mặc định). Chạm không rê = bấm như thường. Nhớ theo máy `forfish.fab.v1` (mỗi nút một ngăn: `sen-bien`, `gio-hang`) |
| **Ẩn được** (2026-09-07) | Đẩy nút **sát ra ngoài mép** (tâm nút lọt vào 40% bề rộng nút sát mép) → nút **nép vào mép, chỉ ló 1,25rem và mờ 70%**; chạm mẩu ló ra = hiện lại (KHÔNG mở trợ lý). Không giấu hẳn: bà con giấu xong không biết mở lại ở đâu là mất luôn trợ lý. `aria-label` khi ẩn nối " — đang ẩn, chạm để hiện lại" |
| Không đè nút giỏ | Nút giỏ nổi ở Cửa hàng (`sdvico-catalog.tsx`) dùng **cùng khuôn** và mặc định xếp **ngay trên** Sen Biển (`5.5rem` trên dock) — trước đây hai nút cùng một toạ độ, đè nhau (ảnh thật 2026-09-07) |
| Kích thước | Vùng chạm tròn **4rem** (bằng nút giỏ; sàn 56px, chế độ gọn KHÔNG hạ — nút này là việc thường bấm, theo luật 03 §1b), mascot PNG 48px + nhãn **"Sen Biển"** dưới icon |
| Màu | Nền `bg-card` không viền + bóng mềm; sen/sóng `--navy` + `--sea`, tâm `--sun`, cá trắng (chỉ token `@theme`, cấm hex); trạng thái nghe: viền nhịp `--accent` |
| Có ở đâu | Mọi route app ngư dân (`AppShell` nhánh có dock). **KHÔNG** ở `/quan-tri`, `/dev`, `/login`, `/dang-ky`, `/doi-mat-khau`, `/quen-mat-khau`, `/huong-dan.html`, `/quyen-rieng-tu` |
| Ẩn khi | bàn phím mở (`visualViewport` co >150px) · `BottomSheet`/`SnapSheet`/`ConfirmDialog` bất kỳ đang mở · HUD dẫn đường live đang chạy (07 §10.7 — không che ranh giới/HUD) · sheet Ra khơi ở `half/full` · tấm che trợ lý đang mở (chính nó) |
| Không che | nút chính của màn: "Đặt hàng (n)" thanh đáy `/cho/gio`, "Thêm vào giỏ" `/cho/sp`, "Gọi shop" thanh đáy — các thanh đáy dính này **đẩy lên** bằng `padding-right` 4.5rem cho hàng nút, hoặc nút nổi **dịch lên** trên thanh dính (`bottom` cộng chiều cao thanh) — UI chọn một cách, đo thật 390×844 mọi màn có thanh dính (§9 AC-T31) |
| A11y | `aria-label="Sen Biển — bấm để nói"`, `role="button"`, focus ring không huỷ trắng; kéo bằng pointer events (`touch-action: none` trên nút), bàn phím vẫn bấm được qua `click` |
| Lần đầu | Không coach-mark (07 §12 đã gỡ tour). Nhãn "Sen Biển" + hình hoa sen là tên gọi thân quen; kéo/ẩn là cử chỉ quen từ nút nổi Zalo/Messenger, không cần dạy |

### 5.2 Sheet trợ lý (`assistant-sheet.tsx`) — chỉ bày cái KEY (03 §Khung nhập C1)

> **ĐỔI 2026-09-07 (chủ dự án: *"sao lại xổ ra 1 cái che hết toàn bộ app thế"*)**: KHÔNG còn tấm che toàn màn. Nay là **sheet neo đáy hai nấc** — mặc định **55%**, chạm tay nắm lên **92%** (không 100%), nền mờ **nhìn xuyên** 30%, ba đường đóng (✕ · vuốt · chạm nền). Tự lên nấc cao **chỉ khi bàn phím mở**. Hàng tiêu đề ghi **"Đang xem &lt;tên màn&gt;"**. Luật đầy đủ + nguồn khảo sát (Material 3 · Apple HIG · WCAG 2.2.2 · Intercom · NN/g): [03 §Trợ lý trong app](03-design-system.md).

Là **tấm che toàn màn** (LEAD §1 — `fixed inset-0`, `role="dialog" aria-modal`, Esc + X đóng, khoá cuộn nền; **không** phải `BottomSheet` — cần full-height cho vòng mic + chữ TO + thẻ hành động mà không tranh chỗ với khung nổi bản đồ). Thứ tự từ trên xuống:

| # | Khối | Key? | Chi tiết |
|---|---|---|---|
| 1 | Hàng tiêu đề: "Sen Biển" + `CloseButton` góc phải + nút **Tắt tiếng/Bật tiếng** (`SQ_BTN` icon loa, inline cuối hàng tiêu đề — 03 luật 3) | phụ | Không có nút Huỷ (03 §X đóng 2: panel đọc-xem → chỉ X) |
| 2 | **Vòng mic** to (≥5rem) giữa, nhịp khi nghe; dưới là **chữ nghe được** hiện dần (interim xám, final đậm) | **KEY** | Chạm vòng = nghe lại (cùng việc với nút nổi) |
| 3 | **Câu trả lời** chữ TO (≥1.25rem, `text-foreground`, không xám nhạt) — `text`; dòng phụ "Số lưu 2 giờ trước" 0.875rem `--muted` (đủ contrast) | **KEY** | Khi "nghĩ": "Đang nghĩ…" `role=status` |
| 4 | **Thẻ hành động** (0 hoặc 1): thẻ món + `QtyStepper` + cặp Thôi/Thêm vào giỏ · hoặc tên + số + Thôi/Gọi · hoặc điểm + Thôi/Dẫn đường — cặp nút `grid-cols-2`, primary **phải**, mỗi nút `min-h-[3.5rem]` | KEY khi có | Đây là chỗ DUY NHẤT có nút hành động |
| 5 | **Chip gợi ý** 3–4 (`ChipRow` tầng 1, `min-h-[3.5rem]`) theo màn + giờ (§5.3) | phụ | Chạm chip = gửi câu đó (không mở mic) |
| 6 | Hàng đáy: nút **"Gõ thay vì nói"** (text button) — chạm → ô gõ thay chỗ vòng mic; khi không có STT/quyền: ô gõ hiện **sẵn** thay vòng mic, không cần chạm | phụ/KEY tuỳ ca | Ô gõ ≥16px thực tế |

Không có: lịch sử hội thoại dài, avatar, bong bóng chat kiểu Messenger, cài đặt giọng, chọn model. 10 câu gần nhất chỉ dùng cho chip "Hỏi lại câu trước" (1 chip, tuỳ chọn, chỉ khi có).

### 5.3 Gợi ý theo màn + theo giờ (`suggestions.ts`)

Chip = câu nói sẵn; 4 chip = 2 theo màn + 1 theo giờ + 1 theo dữ liệu máy (chỉ khi có việc đỏ/vàng). Tổng ≤4, không trùng ý (07 §12 "trùng ý").

| Route | 2 chip theo màn |
|---|---|
| `/` | "Thời tiết hôm nay" · "Giấy tờ sắp hết hạn" |
| `/ngu-truong` | "Có bão không" · "Con nước hôm nay" |
| `/tau` (giay-to) | "Giấy nào sắp hết hạn" · "Mở sổ bảo dưỡng" |
| `/tau` (dich-vu) | "Bảo dưỡng gì tới hạn" · "Gọi SDVICO" |
| `/tau` (san-pham) | "Vào chợ vật tư" · "Đơn của tôi" |
| `/nguoi` | "Ai chưa có bảo hiểm" · "Tàu có mấy người" |
| `/tien` | "Giá cá ngừ hôm nay" · "Giá dầu hôm nay" |
| `/cho`, `/cho/tim` | "Tìm nhớt máy" · "Xem giỏ" |
| `/cho/sp/[id]` | "Gọi shop" · "Xem giỏ" (bỏ chip "Thêm món này vào giỏ" — trang đã có nút Thêm vào giỏ to, trợ lý không có dữ liệu món đang xem; F-27) |
| `/cho/gio` | "Giỏ có gì" · "Tìm thêm món" |
| `/cho/don*` | "Đơn đang giao" · "Gọi shop" |
| `/ban-hang/**` | "Mở đơn cần xác nhận" (→ `/ban-hang/don`) · "Về chợ" |
| `/cang` | "Đặt cảng nhà" · "Thời tiết ở cảng này" |

| Giờ VN | 1 chip theo giờ |
|---|---|
| 03:00–09:59 | "Hôm nay đi được không" |
| 10:00–14:59 | "Giá cá hôm nay" |
| 15:00–19:59 | "Ngày mai sao" |
| 20:00–02:59 | "Có bão không" |

| Dữ liệu máy | 1 chip theo việc (ưu tiên trên → dưới, lấy 1) |
|---|---|
| `stormStatus` có bão hoặc tin cũ >12h | "Tin bão" |
| giấy/bảo hiểm/chứng chỉ `expired`/`soon` | "Giấy tờ cần lo" |
| bảo dưỡng quá hạn | "Bảo dưỡng quá hạn" |
| đơn cache có `dang_giao` | "Đơn đang giao" |
| hộp thư có tin chưa đọc | "Tin mới" |

### 5.4 Ma trận trạng thái

| Tình huống | Phát hiện bằng | Trợ lý làm gì | Câu trên màn (không jargon) |
|---|---|---|---|
| Chưa cấp quyền mic (lần đầu) | `getUserMedia`/`SpeechRecognition.onerror not-allowed` | chạm nút nổi → trình duyệt hỏi quyền; từ chối → ô gõ + chip, **nhớ** `micDenied` trong `forfish.assistant.v1`; lần sau mở thẳng ô gõ + dòng "Bật mic trong cài đặt máy để nói" | "Máy chưa cho dùng mic. Bác gõ hoặc chọn bên dưới." |
| Không hỗ trợ STT (`SpeechRecognition` undefined — Firefox, WebView cũ) | feature-detect lúc mở tấm che | vòng mic ẩn, ô gõ + chip hiện sẵn; nút nổi vẫn là **"Sen Biển"** với mascot cá-sen để bà con luôn nhận đúng người trợ giúp | "Máy này chưa nói được với tôi — bác gõ hoặc chọn bên dưới." |
| Không hỗ trợ TTS / không có giọng `vi-VN` | `speechSynthesis.getVoices()` không có `vi*` (kể cả sau `voiceschanged`) | **không đọc bằng giọng khác** (giọng Anh đọc tiếng Việt = vô nghĩa); chỉ chữ; nút loa mờ + nhãn "Máy không có giọng Việt" | dòng phụ 1 lần: "Máy này không đọc được tiếng Việt, tôi hiện chữ thôi." |
| STT cần mạng mà mất sóng (Safari iOS/Chrome Android: nhận giọng chạy trên máy chủ Apple/Google — lead §0 #4) | `isDefinitelyOffline()` → mic vẫn thử **1 lần**; `onerror network` hoặc không có kết quả sau 3 s + `!navigator.onLine` | **CHIP làm hàng chính** (đứng trên), ô gõ dưới, ngay lập tức (không đợi 8 s); ý định OFF vẫn trả lời đầy đủ khi chip/gõ | "Mất sóng nên tôi không nghe được, bác chạm câu bên dưới." (câu chốt của lead; có thể nối: "Tôi vẫn trả lời được việc trong máy.") |
| Mất sóng, câu cần online | `!navigator.onLine` hoặc fetch fail | không gọi `/api/tro-ly`; nói phạm vi offline | "Câu này phải có sóng mới hỏi được. Giờ tôi trả lời được: thời tiết, bão, giấy tờ, giá cá, mở màn." |
| Hết lượt online trong ngày | `/api/tro-ly` 429 `{code:"quota"}` | nói thật + vẫn trả lời offline; **không** hiện đếm lượt thường trực | "Hôm nay bác đã hỏi đủ 30 câu cần sóng. Mai hỏi tiếp nhé — việc trong máy tôi vẫn trả lời." |
| Không có key (prod chưa cấu hình) | `/api/tro-ly` 503 `{code:"no_key"}` | như mất sóng nhưng KHÔNG đổ cho sóng | "Phần hỏi thêm chưa mở. Bác hỏi tôi việc trong máy nhé." (không nói "key", "cấu hình") |
| Chưa đăng nhập, câu cần online | `!phone` | offline đầy đủ; online → 1 dòng mời (tầng 5, **ẩn khi mất sóng**) | "Muốn hỏi thêm thì đăng nhập giúp." + chip "Đăng nhập" |
| Đang tải (online) | 300 ms sau gửi | "Đang nghĩ…" + vòng mic ngừng nhịp; >8 s đổi câu; 20 s → lỗi | "Đang nghĩ…" → "Hơi lâu, bác chờ chút…" |
| Lỗi máy chủ (5xx/timeout) | fetch/route lỗi | nói thật, chip "Hỏi lại" | "Chưa hỏi được lúc này. Bác thử lại sau, hoặc hỏi việc trong máy." |
| Chế độ giả lập (`ASSISTANT_MOCK=1`, hoặc thiếu khoá khi không production) | `reply.source === "mock"` (14 §6.6 — không header riêng) | dòng nhỏ **chỉ khi không phải production**: "Đang trả lời thử" | — |
| Câu quá dài (>40 chữ) hoặc nhiều ý | đếm chữ / parse ra ≥2 intent | làm ý đầu, chip ý sau; quá dài → xin nói ngắn | "Bác nói ngắn từng việc một giúp." |
| Đọc sổ trong máy hỏng (`readUserList` nhánh lỗi) | cờ `readFailed` trong snapshot | KHÔNG nói "trống"/"đều ổn"; nói đọc không được + chip mở màn có băng đỏ | "Sổ giấy tờ trong máy đang đọc không được — mở Tàu cá xem giúp." |
| Máy hết chỗ khi ghi (giỏ, cảng nhà, `forfish.assistant.v1`) | `saveUserJson` false | băng đỏ inline tầng 2 trong tấm che; không nói "đã …" | `storageFullCopy("giỏ hàng")` / "…cảng nhà" |
| Cực đoan: 0 dữ liệu gì trong máy (máy mới, chưa từng có sóng) | snapshot rỗng | vẫn mở được, mọi INT OFF nói "chưa có" đúng ca; chip đổi thành "Mở Ra khơi để tải sẵn" | — |
| App trong nền (iOS PWA đình chỉ timer) | `visibilitychange` | đang nghe → dừng nghe; đang nói → dừng TTS; quay lại → trạng thái "xong" với câu cuối | — |

---

## 6. Trả lời an toàn

| Chủ đề | Luật | Câu mẫu |
|---|---|---|
| Thời tiết / bão / đi được không | **Chỉ nói theo số liệu app** (bản lưu hoặc vừa tải) + **mốc thời gian** + **luôn** "nghe đài duyên hải" (giữ nguyên chữ — 03 §5b: dặn dò an toàn bắt buộc không cắt). Tin bão cũ >12h **cấm** "không có bão". Không dùng chữ "an toàn tuyệt đối", "chắc chắn" | "Điểm 85, biển êm — đi được. Không có tin bão, hỏi lúc 14 giờ. Nghe thêm đài duyên hải." |
| **Bão nào được nói TRƯỚC** (chốt BA 2026-09-06, audit vòng 2 P1-N3) | Bão dẫn đầu câu trả lời + kết luận "chưa nên đi" **chỉ khi** `alert === "danger"` **hoặc** tâm bão cách **cảng nhà ≤ 500 km** (`haversineKm`, client tính lúc gom). Bão `watch` ở xa hơn → câu thời tiết **bình thường** + một câu phụ "Có bão {tên} ở xa." (câu "nghe thêm đài duyên hải" vẫn còn). **Thiếu toạ độ** (bản tin thiếu / chưa đặt cảng nhà) → coi như GẦN. Vì sao có ngưỡng: bão ở Okinawa cách 1.500 km mà ngày nào cũng "đừng ra khơi" thì bà con bỏ ngoài tai cả lúc bão thật | "Hôm nay ở Quy Nhơn: điểm 82/100… — biển êm — đi được. Có bão KROVANH ở xa. Số lưu 2 giờ trước. Nghe thêm đài duyên hải." |
| Không bịa | Số nào không có trong snapshot/tool → nói "chưa có"; máy chủ **chỉ** được nói số từ tool, không từ trí nhớ mô hình (prompt + kiểm ở `answer` server: câu có số tiền/mét/km mà tool không trả → thay bằng câu chung) | "Chưa lấy được giá dầu kỳ này." |
| Y tế | Không khuyên thuốc/liều; chỉ số khẩn | "Đau ốm thì gọi 115 hoặc trạm y tế gần nhất." |
| Pháp lý / mức phạt | Không nêu số tiền phạt, không tư vấn "có bị phạt không"; chỉ đường tới giấy tờ + cơ quan | "Chuyện phạt hỏi cảng cá hoặc biên phòng giúp. Tôi coi được giấy tờ nào sắp hết hạn." |
| Tiền bạc cá nhân / vay / đầu tư | Từ chối; không gợi ngân hàng/lãi | INT-26 |
| Giá cả | Chỉ giá từ dữ liệu (bảng giá tuần, giá dầu, giá món trên chợ) + tính chất "tham khảo"; **không hứa giá** | "…giá thật hỏi đại lý." |
| Người khác (CCCD, SĐT, tra người) | Không đọc CCCD/SĐT thuyền viên; không gửi lên máy chủ; tra cảnh báo là việc gõ tay ở `/nguoi` | INT-11, INT-26 |
| Chủ quyền | Tên biển/đảo theo app (Hoàng Sa, Trường Sa, Biển Đông); máy chủ prompt cấm "South China Sea"/tên nước ngoài | — |
| Ngoài phạm vi | Nói phạm vi bằng 1 câu + chip | "Tôi giúp được chuyện đi biển, tàu, giấy tờ, mua bán." |
| Giọng | "tôi"/"bác", câu ngắn, không cảm thán, không emoji, không "xin lỗi" lặp | — |

---

## 7. Online (`/api/tro-ly`)

### 7.1 Khi nào gọi
- Chỉ khi **cả ba**: (a) bộ hiểu offline không khớp (câu dài >6 chữ, hoặc đã hỏi lại 1 lần) hoặc khớp INT-25; (b) `navigator.onLine !== false`; (c) đã đăng nhập (`useAuthUser().signedIn`) **và** còn lượt (client nhớ đếm ngày trong `forfish.assistant.v1` trường `quota{day,used}` — 14 §5.3 — để **không gửi** khi biết đã hết; máy chủ vẫn là nguồn chốt). INT-26 **không bao giờ** gửi.
- **Không bao giờ** gọi lúc mở app / chuyển màn / mở tấm che (CLAUDE.md 🟡 (a)). Chỉ gọi khi bà con vừa nói/gõ/chạm chip.
- OFF→ON bổ sung (§4.2 bước 3) dùng route sẵn có của từng nguồn, KHÔNG qua `/api/tro-ly`.
- `/api/tro-ly` **không** được SW cache (LEAD §2). Đồng hồ client **25 s** (`authedFetch`, > máy chủ), server tới Anthropic **20 s** tổng ([ops/external-services](ops/external-services.md) — Core ghi dòng). Vòng tool ≤3. Body = 1 câu + snapshot đã ẩn danh + route — **không** `history`.

### 7.2 Giới hạn & câu nói
| Ca | Mã route | Câu (`speak` = `text`) |
|---|---|---|
| Hết lượt | 429 `quota` (N mặc định **30/ngày/SĐT**, `app_config` key `assistant_daily_limit` — 14 §6.2) | "Hôm nay bác đã hỏi đủ 30 câu cần sóng. Mai hỏi tiếp nhé — việc trong máy tôi vẫn trả lời." |
| Body sai / quá dài | 400 `invalid` | "Câu dài quá, bác nói ngắn lại." |
| Body có trường nhạy cảm (lỗi client) | 400 `bad_snapshot` | "Chưa hỏi được lúc này…" (AC-T53 — không lặng lẽ bỏ) |
| Không key | 503 `no_key` | "Phần hỏi thêm chưa mở. Bác hỏi tôi việc trong máy nhé." |
| Chưa đăng nhập | 401 | client không gọi; mời đăng nhập (tầng 5, ẩn khi offline) |
| Mất sóng | fetch fail/timeout | "Câu này phải có sóng mới hỏi được…" (§5.4) |
| Máy chủ lỗi | 502 `upstream` · 503 `unavailable` | "Chưa hỏi được lúc này…" |
| Quá 20 s máy chủ | 504 `timeout` | "Sóng yếu, hỏi không kịp. Bác thử lại hoặc hỏi việc trong máy." |
| Mock | 200 `reply.source:"mock"` | trả lời kịch bản cố định theo ý định; dev thấy "Đang trả lời thử" |

Còn 5 lượt: câu trả lời thường có thêm 1 dòng nhỏ "Còn 5 câu cần sóng hôm nay." — chỉ ở mốc 5 và 1, không đếm thường trực (07 §12: không nhắc thứ đã biết).

### 7.3 Riêng tư — gửi gì lên máy chủ

| Gửi | Không gửi |
|---|---|
| Câu bà con vừa nói/gõ (1 câu, không kèm 10 câu trước) | 10 câu gần nhất |
| Route đang đứng (để trả lời đúng ngữ cảnh) | — |
| Tóm tắt máy **tối thiểu, đã ẩn danh**: tỉnh + tên cảng nhà · điểm đi biển hôm nay + ngày mai (số) · có bão/tin cũ (cờ + tuổi) · **số lượng** giấy tờ sắp/đã hết hạn kèm **loại + số ngày** (không số giấy, không tên tàu) · số việc bảo dưỡng quá hạn · số dòng giỏ · số đơn đang giao · hạng tài khoản (basic/premium) | **CCCD, tên, SĐT thuyền viên** · số giấy tờ, ảnh giấy tờ · số hiệu tàu · STK/ngân hàng · địa chỉ nhận hàng · nội dung hộp thư · toạ độ điểm đã lưu (chỉ gửi **số** điểm) · vị trí GPS hiện tại |
| Định danh: chuỗi cứng theo máy → SĐT ở server (`identityFromRequest`), chỉ để đếm lượt | SĐT trong body |

Server **không lưu** câu hỏi/câu trả lời vào DB (chỉ bộ đếm lượt `{phone, day, used}` trong bộ nhớ instance); log lỗi không chứa câu nói. Route **từ chối** body có trường nhạy cảm (400 `bad_snapshot`). `forfish.assistant.` ∈ `NEVER_BACKUP_PREFIXES` (`lib/offline-backup.ts`) + `FORBIDDEN` trong `offline-backup.test.ts` — khoá mang câu bà con nói (14 §5.3, state-registry — Core ghi).

---

## 8. Hiệu năng (đo thật trên máy tầm trung Android + iPhone 12)

| Chỉ số | Ngưỡng | Đo bằng |
|---|---|---|
| Mở tấm che sau chạm nút nổi | **< 300 ms** tới khi vòng mic hiện (component lazy `next/dynamic` phải **prefetch** khi nút nổi mount, không tải lúc chạm) | e2e `performance.now()` |
| Mic bắt đầu nghe | < 500 ms sau mở (quyền đã cấp) | `onstart` |
| Offline: câu vào → chữ trả lời | **< 500 ms** (parse + snapshot; snapshot gom **lười** theo ý định — không đọc `forfish.fc.*` lưới lớn, chỉ khoá nhỏ; `pretrip.ts` cảnh báo kho lưới ~7 MB) | unit + e2e |
| Online: tới khi có chữ | **< 8 s** p50 với "Đang nghĩ…" từ 300 ms; trần 20 s | e2e mock + đo prod tay |
| TTS bắt đầu | **< 1 s** sau có answer | `onstart` |
| Bộ hiểu offline | bundle `src/lib/assistant/` (thuần) ≤ 40 KB gzip; không import MapLibre/lưới | build size |
| Không thêm request lúc mở app | 0 request từ trợ lý cho tới khi bà con nói | network log e2e |

---

## 9. Acceptance Criteria — ORACLE (QA truy vết theo mã)

Mỗi AC 1 dòng kiểm được, **trong ngoặc = tầng · hàm/route chịu trách nhiệm**. Test: **U** = unit (`src/lib/__tests__/assistant-*.test.ts`), **E** = e2e (`tests/e2e/troly/**`, `ASSISTANT_MOCK=1`, persona `/dev`), **A** = API, **M** = đo tay.

> **CỔNG TRUY VẾT (2026-09-07)** — `src/lib/__tests__/assistant-ac-oracle.test.ts` chạy mỗi `npm test`: mọi mã ở §9 phải có **ca kiểm ĐANG CHẠY dẫn chiếu mã đó trong nhãn**, hoặc được khai trong bảng `CHUYEN_TAY` của chính tệp cổng (lý do + mã kịch bản trong [docs/test-cases/tro-ly-2026-09-06.md](../test-cases/tro-ly-2026-09-06.md) + điều kiện trả nợ). Ba luật cổng giữ: mã nằm trong ca `test.fixme`/`skip` **không** tính là phủ (giả xanh); nợ đã trả mà quên xoá khỏi bảng → đỏ; khai mã kịch bản không có thật → đỏ.
>
> Rà lần đầu bằng cổng này (2026-09-07): **9 AC không ai nhận** — T04/T05/T06/T07 đã kiểm nhưng thiếu nhãn mã, còn **T30/T32/T35/T38/T43 chỉ nằm trong ca bị hoãn** nên `grep` tưởng đã phủ. Nay: **46 tự động · 10 chuyển đo tay · 0 treo**. Vá kèm: AC-T05 kiểm thêm `qty`, AC-T06 thêm ca năm nhóm bị chặn (kèm ca đối chứng không chặn oan) và ca hook chứng minh ý định cấm **không gọi** `/api/tro-ly` (trước đó chỉ kiểm hằng số `NEVER_ONLINE`, đổi một dòng trong `use-assistant` là câu bệnh tật lên mạng mà test vẫn xanh).

**Hiểu ý (offline, thuần)**
- AC-T01 (U) Mọi câu ví dụ trong §3 (≥135 câu) parse ra đúng mã INT; sai ≤3% và **không** câu nào rơi vào INT-26 nhầm (OFF · `parseUtterance`).
- AC-T02 (U) Không dấu, viết tắt, giọng miền ("hôm nay/bữa nay/nay", "hông/không/hok", "vô/vào", "tui/tôi") cùng ra một INT (OFF · `normalize`).
- AC-T03 (U) Số tiếng Việt: "hai", "một chục", "nửa tá", "2", "02" → 2, 10, 6, 2, 2; đơn vị đếm "cây/thùng/can/bao/lít/cái/bộ" giữ lại làm `unit` (OFF · `normalize.parseQty`).
- AC-T04 (U) Tên cảng khớp mờ: "Quy Nhơn", "quy nhon", "Qui Nhơn" → `quy-nhon`; "Hòn Rớ"/"hon ro"/"Nha Trang" → `hon-ro`; 2 kết quả ngang điểm → `reply.clarify` với ≤4 lựa chọn (OFF · `matchPort`).
- AC-T05 (U) Ưu tiên §3: "mai đi được không" → INT-06 (`thoi_tiet` `aspect:"di_duoc"`, không INT-02); "có bão không" → `bao`; "mua 2 thùng nhớt" → `tim_mon` qty=2; "bỏ 2 thùng nhớt vô giỏ" → `them_gio` qty=2 (OFF · `parseUtterance`).
- AC-T06 (U) Câu chứa "CCCD/căn cước số…", "thuốc", "phạt bao nhiêu", "vay", "chính trị" → `ngoai_pham_vi` (INT-26); `use-assistant` **không** gọi `/api/tro-ly` với ý định đó (OFF · `intents.BLOCKLIST`, `NEVER_ONLINE`).
- AC-T07 (U) Câu >40 chữ → `khong_hieu` `reason:"qua_dai"`; câu có 2 ý ("coi thời tiết rồi gọi SDVICO") → `intent: thoi_tiet` + `followUp: goi_sdvico` (OFF · `parseUtterance`).
- AC-T08 (U) — **bỏ** (F-27: chip "Thêm 1 món này vào giỏ" ở `/cho/sp/[id]` không còn; trang đã có nút Thêm vào giỏ). Giữ số để không đánh lại mã.

**Trả lời (offline, thuần — snapshot giả)**
- AC-T09 (U) INT-01 với snapshot có `sea[quy-nhon]` `savedAt` 2h trước → `text` chứa sóng/gió/điểm + "lưu 2 giờ trước"; `speak` ≤2 câu ≤40 chữ (OFF · `answerOffline`, `savedAgoLabel`).
- AC-T10 (U) INT-01 không có cảng nhà → `reply.clarify` "Bác hay đi từ cảng nào?" + chip ≤4 theo `province`; có cảng nhà nhưng không có bản lưu → "Máy chưa có số cho cảng …" + action navigate `/ngu-truong` (OFF · `answerOffline`).
- AC-T11 (U) INT-02 `slots.day=5` với `snapshot.premium=false` → nói 3 ngày + dòng mời Premium khi `online=true`; `online=false` → **không** có dòng mời; `premium=true` và bản lưu có ngày 5 → đọc ngày 5 (OFF · `answerOffline`; `premium` gom từ `effectivePremiumMark` ở `device-snapshot`).
- AC-T12 (U) INT-04: `checkedAt` 13h trước → `text` = `stormNoticeText(...)` (chứa "cũ 13 giờ" + "đài duyên hải"), **không chứa** "không có bão"; ≤12h rỗng → "Không có tin bão, hỏi lúc HH:MM" (OFF · `answerOffline`, `stormStatus`).
- AC-T13 (U) INT-06 luôn chứa "đài duyên hải" ở mọi nhánh good/caution/bad/không-số (OFF · `answerOffline`).
- AC-T14 (U) INT-09: 1 doc `days=0` + 1 `days=12` + 1 `days=95` → speak đọc 2 (hôm nay trước), text ≤4 dòng, action `/tau?tab=giay-to`; `readFailed=true` → câu "đang đọc không được", **không** "đều còn hạn" (OFF · `answerOffline`, `getExpiryStatus`, `byUrgency`).
- AC-T15 (U) INT-10 dùng `SOON_DAYS_SERVICE=14`, quá hạn đọc trước; sổ trống → câu trống (OFF · `answerOffline`).
- AC-T16 (U) INT-11 `text`/`speak` **không chứa** chuỗi 12 số hoặc SĐT dù `CrewMember` có (OFF · `answerOffline` — test regex `\d{9,12}`).
- AC-T17 (U) INT-07 "dẫn đường tới bãi mực" với 1 điểm khớp → `action:{type:"navigate", href:"/ngu-truong"}`, **không** `confirm`, `text` chứa "Điểm đã lưu" + tên điểm (lead §0 #2); 2 điểm khớp → `clarify` chip; 0 điểm → câu "chưa ghim" (OFF · `answerOffline`).
- AC-T18 (U) INT-08 khớp rõ → `action:{type:"setHomePort", portId, portName}`, không `confirm`, kèm chip lùi "Không phải, chọn cảng khác"; khớp mờ → `clarify` (OFF · `answerOffline`).
- AC-T19 (U) INT-15 có `quote.at` → speak có tổng + "theo giá lúc HH:MM"; không quote → chỉ đếm dòng, không có số tiền (OFF · `answerOffline`).
- AC-T20 (U) INT-16 từ cache `savedAt` 40 phút → "theo bản lưu 40 phút trước"; đơn `dang_giao` có SĐT shop → chip gọi; **không** có action huỷ/đã nhận (OFF · `answerOffline`).
- AC-T21 (U) INT-17 "cá ngừ" khớp `species` bỏ dấu; bản lưu có `savedAt` → mốc tuần; chưa từng tải → câu "giá tham khảo tổng hợp ngày …" (OFF · `answerOffline`).
- AC-T22 (U) INT-20 bảng đích §3.4: 14 cụm từ → đúng URL; không khớp → câu 5 chip (OFF · `answerOffline`).
- AC-T23 (U) INT-21 "gọi SDVICO" → `action:{type:"call", tel:SDVICO_HOTLINE}` + `confirm`; `tel` === `SDVICO_HOTLINE` của `src/data/sdvico-showcase.ts` (import, không chép số; `src/lib/assistant/**` không chứa chuỗi "0939") (OFF · `answerOffline`).
- AC-T24 (U) Mọi `reply.action` thuộc tập `{navigate, search, addToCart, call, setHomePort, setBoat, mute}` (14 §3.1 union) — **không có** `placeOrder/cancel/delete/send`; `addToCart` và `call` luôn đi kèm `confirm` (OFF · `types.ts` union + test exhaustive).
- AC-T25 (U) Danh sách từ cấm (AI, chatbot, online, offline, kết nối, máy chủ, token, model, API, lỗi 5xx…) không xuất hiện trong bất kỳ chuỗi UI/`speak`/`text` nào của `src/lib/assistant/**` + `src/components/assistant/**` (OFF · test quét chuỗi).
- AC-T26 (U) `suggestions(route, hourVN, snapshot)` trả ≤4 chip, không trùng ý, có đúng 1 chip theo giờ đúng bảng §5.3, chip theo việc chỉ khi có việc (OFF · `suggestions.ts`).

**Luồng & UI (e2e, mock STT/TTS)**
- AC-T27 (E) Từ `/`, `/tau`, `/nguoi`, `/tien`, `/cho`, `/ngu-truong`: nút nổi hiện, 1 chạm → tấm che mở **<300 ms** và trạng thái `nghe` (mic mock `onstart`) — không màn trung gian (UI · `assistant-fab`, `use-assistant`).
- AC-T28 (E) Nút nổi **không** render ở `/quan-tri`, `/login`, `/dang-ky`, `/quen-mat-khau`, `/doi-mat-khau` (UI · `app-shell`).
- AC-T29 (E) Mở `BottomSheet` bất kỳ (vd form thêm giấy tờ) → nút nổi ẩn; đóng → hiện lại; bàn phím mở (giả lập `visualViewport` co) → ẩn (UI · `assistant-fab`).
- AC-T30 (E) Trên `/ngu-truong` khi HUD dẫn đường live đang chạy → nút nổi ẩn; kéo sheet lên half/full → ẩn (UI · `assistant-fab`).
- AC-T31 (M/E) Đo 390×844 ở `/cho/gio`, `/cho/sp/[id]`, `/cho/don/[id]`, `/ngu-truong` (thẻ dẫn đường): `elementFromPoint` tại tâm nút chính thanh đáy trả về đúng nút đó, **không** phải nút nổi (UI · `assistant-fab` offset).
- AC-T32 (E) Mock STT im 8 s → trạng thái "không nghe được" lần 1: câu "Tôi chưa nghe rõ…" + mic mở lại; im lần 2 → chip 4 cái, mic **không** mở (UI · `use-assistant`).
- AC-T33 (E) Mock STT `onerror not-allowed` → ô gõ hiện, `micDenied=true` ghi `forfish.assistant.v1`; reload → mở tấm che là ô gõ ngay + dòng "Bật mic trong cài đặt máy…" (UI · `speech.ts`, `use-assistant`).
- AC-T34 (E) `window.SpeechRecognition` undefined → vòng mic không render, ô gõ + chip hiện sẵn, câu "Máy này chưa nói được với tôi…" (UI · `speech.ts` feature-detect).
- AC-T35 (E) `speechSynthesis.getVoices()` không có `vi` → **không** gọi `speak()` với giọng khác; nút loa mờ + nhãn (UI · `speech.ts`).
- AC-T36 (E) Nói "tắt tiếng" → TTS `cancel()` ngay + `muted=true`; reload vẫn tắt; nói "bật tiếng" → bật (UI · INT-24, `forfish.assistant.v1`).
- AC-T37 (E) Chip "Thời tiết hôm nay" với bản lưu `forfish.sea.*` → chữ trả lời hiện **<500 ms**, TTS `onstart` **<1 s**, có "lưu N … trước"; `navigator.onLine=false` → không request nào (E · network log).
- AC-T38 (E) Cùng ca có sóng: sau khi hiện bản máy, `fetchSeaForecast` về → chữ đổi + "Vừa cập nhật", TTS **không** đọc lần 2 (UI · §4.2 bước 3).
- AC-T39 (E) "Gọi SDVICO" → thẻ tên+số + cặp Thôi/Gọi; chạm Gọi → `location.href` bắt đầu `tel:`; chạm Thôi → không; **offline vẫn có nút Gọi** (UI · INT-21).
- AC-T40 (E) "Dẫn đường tới bãi mực" (seed 1 điểm) → câu chứa "Điểm đã lưu" + "bãi mực", tấm che đóng, URL `/ngu-truong` (không query); **không** có nút Dẫn đường trong tấm che (UI · INT-07 v1 — lead §0 #2).
- AC-T41 (E) "Bỏ 2 thùng nhớt vô giỏ" (mock `/api/cho/san-pham?q=nhớt&pageSize=3` 1 món, có biến thể 18L/20L) → chip biến thể; chạm "18L" → thẻ món qty=2 + nút "Thêm vào giỏ" trên thẻ; chạm → `forfish.mcart.v1` có dòng `{productId, variantLabel:"18L", qty:2}` + "Đã thêm (n)" + chip Xem giỏ; tổng **2 chạm** (UI · INT-14, `addMarketLine`).
- AC-T42 (E) Cùng câu khi `navigator.onLine=false` → câu "Chợ cần có sóng…", giỏ **không đổi**, không request (UI · INT-14 offline).
- AC-T43 (E) Mock `localStorage.setItem` ném ở bước thêm giỏ → băng đỏ "Máy hết chỗ — CHƯA lưu được giỏ", **không** có "Đã thêm" (UI · `saveMarketCart` false).
- AC-T44 (E) "Đặt cảng nhà là Quy Nhơn" → `forfish.home.v1.portId="quy-nhon"` ngay, câu "Đã đặt…", chip "Không phải, chọn cảng khác" → mở `/cang` (UI · INT-08).
- AC-T45 (E) "Huỷ đơn SD…" / "đặt hàng luôn" / "xoá giấy đăng kiểm" → câu "Việc đó bác làm trên màn … nhé" + chip mở màn; **không** request ghi nào (UI · P8).
- AC-T46 (E) Câu hỏi mở "nhớt nào tốt cho máy Yanmar" với `ASSISTANT_MOCK=1`, đã đăng nhập → "Đang nghĩ…" (≥300 ms) → câu mock + dòng "Đang trả lời thử" (dev) (E · `/api/tro-ly` mock).
- AC-T47 (E) Cùng câu chưa đăng nhập → không gọi route; câu mời đăng nhập + chip; `navigator.onLine=false` → **không** có lời mời (UI · tầng 5 ẩn offline).
- AC-T48 (E) Tấm che "xong" 20 s không tương tác → tự đóng; mở lại → chip "Hỏi lại câu trước" có mặt (UI · `use-assistant`).
- AC-T49 (E) `visibilitychange` hidden khi đang nghe → mic dừng; đang nói → TTS dừng; visible → trạng thái "xong" (UI · `use-assistant`).
- AC-T50 (E) Mọi phần tử bấm được trong tấm che ≥3.5rem cao; chip `min-h-[3.5rem]`; ô gõ font-size thực tế ≥16px; chữ trả lời ≥1.25rem; contrast AA (UI · axe + đo).

**API**
- AC-T51 (A) `POST /api/tro-ly` không có định danh → 401 `no_token`; có định danh, thiếu key và `NODE_ENV=production` → 503 `no_key`; `ASSISTANT_MOCK=1` → 200 với `reply.source:"mock"`; body có `history` hoặc SĐT → 400 `invalid` (ON · `route.ts`).
- AC-T52 (A) Lượt thứ 31 trong ngày VN cùng SĐT → 429 `quota`, `used=30`; sang ngày mới (giờ VN) → reset (ON · `quota.ts`).
- AC-T53 (A) Body chứa `crew`, `cccd`, `docNumber`, `bank`, `address`, `lat/lon` → 400 `bad_snapshot` (route từ chối, không lặng lẽ bỏ) — chống client tương lai gửi nhầm (ON · `route.ts` schema).
- AC-T54 (A) Response `action` ngoài tập cho phép hoặc `speak` >2 câu → server chuẩn hoá (cắt câu, bỏ action) trước khi trả; test bằng mock trả action `placeOrder` → client nhận reply **không có** `action` (ON · `claude.ts` `finalize`).
- AC-T55 (A) Anthropic treo >20 s → route trả 504 `timeout` trong ≤21 s, không treo serverless (ON · `claude.ts` `timeoutSignal`).
- AC-T56 (A) Mọi `speak`/`text` do máy chủ trả về về chủ đề thời tiết/bão phải chứa "đài duyên hải" — kiểm ở post-process theo từ khoá chủ đề (ON · `claude.ts`).

---

## 10. Đo "90% đơn giản" — bộ 20 việc thường ngày

Đếm **chạm** từ màn bất kỳ, giả định mic hoạt động, quyền đã cấp. Cột "khi mất STT" = dùng chip/gõ (mất sóng ngoài biển: STT trình duyệt thường chết — §11 #4).

| # | Việc | Lời nói | Chạm (mic OK) | Chạm khi mất STT | Mục tiêu |
|---|---|---|---|---|---|
| 1 | Biết hôm nay đi được không | "nay đi được không" | 1 | 2 (mở + chip giờ sáng) | ≤2 |
| 2 | Biết sóng gió ngày mai | "mai sao" | 1 | 2 (chip chiều) / 3 (gõ) | ≤2 |
| 3 | Biết có bão không | "có bão không" | 1 | 2 (chip ở Ra khơi/khuya) | ≤2 |
| 4 | Con nước hôm nay | "con nước sao" | 1 | 2 (chip ở Ra khơi) | ≤2 |
| 5 | Giấy tờ sắp hết hạn | "giấy nào sắp hết" | 1 | 2 (chip ở / và /tau) | ≤2 |
| 6 | Bảo dưỡng tới hạn | "máy tới kỳ chưa" | 1 | 2 (chip /tau dịch vụ) | ≤2 |
| 7 | Ai chưa có bảo hiểm | "ai chưa có bảo hiểm" | 1 | 2 (chip /nguoi) | ≤2 |
| 8 | Dẫn đường tới điểm đã lưu | "dẫn đường tới bãi mực" | **3** (nói + Điểm đã lưu + chọn tên — v1 lead §0 #2; nợ `?den=` → 2) | 4 (chip Ra khơi + …) | ≤2 (nợ) |
| 9 | Đặt cảng nhà | "cảng nhà là Sa Kỳ" | 1 | 2 (chip ở /cang) | ≤2 |
| 10 | Tìm món để mua | "cần mua nhớt" | 1 (mở màn tìm) | 2 (chip /cho) | ≤2 |
| 11 | Thêm N món vào giỏ | "bỏ 2 thùng nhớt vô giỏ" | 2 (nói + Thêm) | 3 | ≤2 |
| 12 | Xem giỏ có gì | "giỏ có gì" | 1 | 2 (chip /cho) | ≤2 |
| 13 | Đơn tới đâu | "đơn tới chưa" | 1 | 2 (chip /tau sản phẩm, /cho) | ≤2 |
| 14 | Gọi shop đơn đang giao | "gọi shop" | 2 (nói + Gọi) | 3 | ≤2 |
| 15 | Gọi SDVICO | "gọi SDVICO" | 2 | 3 | ≤2 |
| 16 | Giá cá ngừ | "giá cá ngừ" | 1 | 2 (chip /tien, chip trưa) | ≤2 |
| 17 | Giá dầu | "giá dầu" | 1 | 2 (chip /tien) | ≤2 |
| 18 | Mở tủ giấy tờ | "mở giấy tờ" | 1 | 2 (dock — không cần trợ lý) | ≤2 |
| 19 | Đọc tin mới | "có tin gì mới" | 1 | 2 (chip theo việc) | ≤2 |
| 20 | Hỏi kinh nghiệm (online) | "nhớt nào tốt cho Yanmar" | 1 | 3 (gõ) | ≤2 |

**Tiêu chí đạt "90%"**: (a) mic OK: **≥18/20 việc ≤2 chạm** — bảng trên: **19/20** (việc 8 là 3 chạm cho tới khi trả nợ `?den=`); (b) mất STT: **≥16/20 việc ≤3 chạm** — bảng trên: 19/20 nhờ chip theo màn/giờ/việc; (c) 0 việc nào cần chọn trong menu >4 mục; (d) 0 thuật ngữ (AC-T25); (e) thử với **5 ngư dân thật** (Bình Định/Khánh Hoà, ≥45 tuổi) đọc 10 câu tự nhiên: ≥8/10 câu hiểu đúng lần đầu, ≤1 câu bị hiểu thành hành động sai (mức chốt trước khi phát hành — Audit P4 đo).

---

## 11. Phản biện với khung của lead (LEAD-BRIEF 2026-09-06)

| # | Vấn đề | Đề xuất | Mức |
|---|---|---|---|
| 1 | **"Thêm N món vào giỏ — tìm trong catalog đã tải"**: app có **HAI giỏ** (`forfish.cart.v1` đồ SDVICO ở `/tau` tab Sản phẩm; `forfish.mcart.v1` chợ vật tư ở `/cho`) và **chợ KHÔNG cache danh mục** offline (11 §9), chỉ catalog SDVICO có `forfish.catalog.v1`. "Tìm trong catalog đã tải" chỉ đúng với giỏ SDVICO | **LEAD CHỐT (§0 #1)**: một giỏ = chợ vật tư (`mcart`), INT-14 ONLINE tìm top 3 → chạm xác nhận → `addMarketLine`; mất sóng nói thật + chip `/cho/tim?q=`. Không cache danh mục chợ | **Cao** — đã chốt |
| 2 | Dẫn đường tới điểm đã lưu: `/ngu-truong` **chưa có** deep-link tới điểm (chỉ có `?bao=&cap=`) | **LEAD CHỐT (§0 #2)**: v1 mở `/ngu-truong` + đọc "bấm Điểm đã lưu rồi chọn <tên>" (3 chạm). `?den=<placeId>` = nợ có trần khi đụng route-planner Trục 1; khi làm: KHÔNG sessionStorage handoff, ghi 02/07 cùng lượt | **Cao** — đã chốt (nợ) |
| 3 | `/tien` không có param mục (Giá cá / Tin mua bán / Bán ở đâu) | Chấp nhận v1 mở `/tien` đầu trang (giá cá là chip đầu). Nợ: `?muc=` nếu QA thấy bà con phải cuộn | Thấp |
| 4 | **STT Web Speech API thực tế cần mạng**: Safari iOS gửi lên máy chủ Apple; Chrome Android dùng dịch vụ Google — mất sóng ngoài khơi là **mic chết**, đúng lúc "đỡ gõ" cần nhất. Brief gọi tầng 1 là "OFFLINE" — đúng cho **hiểu**, không đúng cho **nghe** | **LEAD CHỐT (§0 #4)**: `isDefinitelyOffline()` → mic thử 1 lần; lỗi `network` → chip + ô gõ làm hàng chính ngay, câu "Mất sóng nên tôi không nghe được, bác chạm câu bên dưới."; chip theo màn/giờ/việc phủ 20 việc §10 để **0-gõ**; nợ native STT (Capacitor) khi có bản native; copy không hứa "nói được khi mất sóng" | **Cao** — đã chốt |
| 5 | TTS `speechSynthesis` vi-VN: iOS có sẵn (Linh); Android phụ thuộc gói Google TTS tiếng Việt — nhiều máy rẻ không có | Không đọc bằng giọng khác; chữ TO là kênh chính, tiếng là phụ. Nút nổi vẫn hoạt động đầy đủ khi không TTS (§5.4) | Trung bình |
| 6 | **Premium qua giọng**: hỏi "tuần sau sao" là lối lách xem thời tiết >3 ngày | **LEAD CHỐT (§0 #6)**: cả hai tầng tôn trọng `lib/tier.ts` — tầng máy đọc `snapshot.premium` (từ `effectivePremiumMark`, không gọi mạng), basic chỉ 3 ngày + mời (ẩn khi offline); tool máy chủ trả ≤3 ngày (v1 mọi hạng — 14 §6.4, không tra hạng trong 20 s) | **Cao** — đã chốt |
| 7 | Quota "N lượt/ngày/SĐT — tài khoản đã đăng nhập": khách chưa đăng nhập không có online — OK; nhưng client phải **biết trước** đã hết để không gửi request thừa ngoài biển | Client nhớ `{day, used}` trong `forfish.assistant.v1`; server vẫn là nguồn chốt; câu "còn 5" chỉ ở mốc 5 và 1 | Thấp — chốt |
| 8 | `forfish.assistant.v1` giữ 10 câu gần nhất — câu có thể chứa tên người/số | Đã ∈ NEVER_BACKUP; **không** gửi 10 câu lên server (§7.3); xoá khi đăng xuất cùng `auth-scope` | Thấp — chốt |
| 9 | Hotline SDVICO `0939 243 222` hiện là hằng riêng trong `login-error.ts` (+ chữ trong `premium-gate`) | **LEAD CHỐT**: đã có `SDVICO_HOTLINE`/`SDVICO_HOTLINE_DISPLAY` ở `src/data/sdvico-showcase.ts` (đang dùng ở `dang-ky` + route chợ) — INT-21 import từ đó, **không lift thêm**, không đụng `login-error.ts` (bản trùng ở đó là nợ dọn riêng); AC-T23 khoá | Thấp — đã chốt |
| 10 | Nút nổi trên `/ngu-truong`: rail phải + sheet + banner bão + HUD đều ở góc/đáy; thêm một nút nữa dễ chồng (03 §Trần khung nổi 40%) | Vị trí góc dưới-phải **trên dock, dưới rail**; ẩn khi sheet half/full, HUD live, bất kỳ sheet nào; tấm che ≤40% trên bản đồ ở trạng thái nghỉ/xong. UI phải **đo thật** (AC-T31) | Trung bình |
| 11 | Đơn vị đếm vật tư ("cây đá", "thùng nhớt", "can 20 lít", "bao muối", "chục lít") — brief chỉ nói "số lượng" | `normalize.parseQty` trả `{n, unit}`; `unit` dùng để khớp biến thể ("20 lít" → variantLabel "20L") và để nói lại đúng đơn vị | Thấp |
| 12 | Trợ lý và chính sách thông báo 07 §12: có nên **chủ động nói** bão khi mở tấm che? | **Không** — trợ lý chỉ trả lời khi hỏi; bão đã có banner tầng 1. Chỉ 1 chip "Tin bão" theo việc (§5.3). Không thêm kênh thông báo mới | Thấp — chốt |
| 13 | Brief: online chỉ khi "offline không hiểu HOẶC câu hỏi mở" — câu **không hiểu do nghe sai** ("thời tiết hôm nay" nghe thành "thời tiếc hôm nay") sẽ lên online tốn lượt | Ngưỡng khớp mờ đủ rộng (Levenshtein theo âm tiết bỏ dấu) + INT-27 hỏi lại lần 1 **trước** khi lên online cho câu ngắn ≤6 chữ; chỉ câu dài/có từ khoá hỏi mở mới đi thẳng online — **đã đưa vào 14 §4.2 bậc 3** | Trung bình — đã chốt |
| 14 | Model/effort/max_tokens (brief §1) là việc Kiến trúc; BA chỉ đặt trần hành vi | `speak` ≤2 câu, `text` ≤4 câu, ≤3 vòng tool, 20 s — server post-process cắt (AC-T54) | — |
| 15 | Người đại diện trên bờ (06 §2) dùng máy khác chủ tàu — snapshot theo máy, không theo tàu | v1 chấp nhận: trợ lý nói theo dữ liệu **máy đang cầm**; câu trả lời không nói "tàu của bác" mà nói tên tàu/số hiệu đang chọn để chị Hoa biết đang coi tàu nào | Thấp |

---

## Assumptions (lead/chủ dự án bác thì sửa spec, không sửa code trước)

- **2026-09-30 (chủ dự án: "hoàn thiện hết")**: (a) câu hỏi mở tìm KHO KIẾN THỨC ĐÃ DUYỆT trong máy TRƯỚC khi hỏi mạng; kho không đủ bằng chứng thì không trả gần đúng; câu hỏi giá/tiền không bao giờ trả từ kho. (b) Tầng mạng (Qwen) mặc định BẬT, tắt được ở `/quan-tri` (`assistant_online_enabled`). (c) Từ chối mic KHÔNG khoá vĩnh viễn: mở tấm che hỏi lại quyền trình duyệt; có nút "Thử nói lại". (d) Câu cố định đọc mp3 giọng nữ Sen Biển; vùng giọng theo tỉnh cảng nhà (Nam Bộ → Mỹ Duyên, còn lại → Trúc Ly), chưa đặt cảng → Trúc Ly. (e) Kho do AI soạn là NHÁP — chỉ vào máy bà con sau khi SDVICO duyệt.
- **Chốt theo brief**: một nút nổi mic ở mọi màn app ngư dân; hai tầng hiểu; Web Speech API + `speechSynthesis`; không đặt hàng/huỷ/xoá bằng giọng; N=30 lượt/ngày; key qua env hoặc `app_config`; mock cho dev.
- Giỏ mà trợ lý thêm là **giỏ chợ vật tư** (`forfish.mcart.v1`), không phải giỏ SDVICO — lead đã chốt (§0 #1).
- Tấm che là **toàn màn** (LEAD §1), không `BottomSheet`; thứ tự khối KEY theo §5.2.
- Mỗi lượt gửi máy chủ = 1 câu + snapshot ẩn danh + route; **không** `history` (nợ: thêm ≤3 lượt khi đo thấy bà con nói tham chiếu "món kia").
- Tuổi dữ liệu nói bằng `savedAgoLabel` (phút/giờ/ngày) — không đẻ định dạng mới.
- "Hôm nay/ngày mai" theo giờ VN (`lib/days.ts`), không theo giờ máy.
- Cảng nhà là cảng mặc định của mọi câu thời tiết; nếu cảng nhà thuộc `FISHING_PORTS` (173) mà không thuộc `PORTS` (10 cảng có dự báo) → trả lời theo **cảng dự báo gần nhất** và nói rõ "số của cảng X, cách cảng nhà ~N km".
- Trợ lý **không** đánh dấu tin đã đọc, không đổi trạng thái đơn, không ghi gì ngoài: giỏ (có xác nhận), cảng nhà, tàu đang chọn, cờ tắt tiếng/quyền mic/quota/10 câu.
- Xác nhận luôn là chạm; không có "nói đồng ý".
- Ẩn danh snapshot online theo §7.3; route từ chối body có trường nhạy cảm (AC-T53).
- Không lưu câu hỏi/câu trả lời ở server.
- Hiệu năng §8 đo trên iPhone 12 + Android tầm trung; không đo trên desktop.
- Ngưỡng 8 s im lặng / 20 s trần nghe / 20 s tự đóng là giá trị khởi điểm — QA đo với ngư dân thật rồi chốt.

**Open**: không còn — §11 #1/#2/#4/#6/#9 lead đã chốt (§0). Còn lại là nợ có trần: `?den=<placeId>` (Trục 1), native STT (Capacitor), bảng `assistant_usage` (quota), `history` ≤3 lượt.

**Risk-tier (ai-simple #06)**: 🟡 — cross-trục (nút nổi + tấm che chạm mọi màn, `app-shell`), khoá localStorage mới `forfish.assistant.v1`, dep mới `@anthropic-ai/sdk`, route mới có gọi dịch vụ ngoài (timeout/fallback vào external-services), có thể thêm `app_config` key (04). Không đụng `sw.js`/SHELL; không migration bắt buộc ngoài (có thể) 1 key `app_config`.

## History

- v1.3 (2026-09-06, Core+UI sau audit vòng 2): §6 chốt ngưỡng bão xa (dẫn đầu chỉ khi `danger` hoặc ≤500 km tới cảng nhà; thiếu toạ độ = gần); §4.3 nút "Mở …" giữ việc treo cho tiếng "ừ" (P1-N1) và hai đường lùi cảng nhà khác chữ (P2-N2); §4.1 im lặng lần 1 phải ĐỌC "chưa nghe rõ" rồi mới nghe lại (P1-18); tên cảng khớp một phần không được nuốt cụm dài ("Đà Nẵng" ≠ "Bến Đá" — P1-N2), không thấy tên → gợi ý cảng cùng tỉnh.
- v1.4 (2026-09-07, học phương pháp): đối chiếu với `anthropics/commerce-agents` (Apache 2.0, 2026-09-02) — KHÔNG lấy phần gọi API, chỉ lấy cách đặt luật: lọc chữ bên thứ ba, cổng nguồn gốc cho hành động ghi, ba câu tách bạch mất sóng/máy chưa có/app không có, eval ca độc + ca hiền, gói não chia theo flow. Bảng việc P1–P3 ở [research/commerce-agents-hoc-phuong-phap-2026-09](../research/commerce-agents-hoc-phuong-phap-2026-09.md); ý định mới "chính sách chợ" chờ BA duyệt.
- v1.0 (2026-09-06): khởi tạo pha BA từ LEAD-BRIEF "Trợ lý" 2026-09-06; 27 ý định; 56 AC; 15 điểm phản biện; 4 điểm chờ chốt.
- v1.2 (2026-09-06, Core sau audit + QA): §4.3 chốt P1-7 (ừ bằng giọng cho việc hoàn tác được, gọi điện vẫn chạm; nói tên chip = chạm chip); INT-08 tên có dấu + tỉnh từ danh sách thật, chip "Đổi lại"; §6 áp cho MỌI câu thời tiết trong máy (đài duyên hải ở mọi nhánh — AC-T56) và bão trong máy → mở đầu câu + "đừng ra khơi vùng ảnh hưởng", không kết luận "đi được" (P0-1).
- v1.1 (2026-09-06): **hợp nhất sau phản biện** ([_generated/phan-bien-tro-ly-2026-09-06](_generated/phan-bien-tro-ly-2026-09-06.md)): §0 chốt lead (TROLY-BRIEF §4); §3.0 ánh xạ INT-xx ↔ mã `Intent` của 14 (nguồn tên); INT-07 v1 = mở Ra khơi 3 chạm, không confirm (nợ `?den=`); INT-14 giỏ chợ ONLINE top 3, chạm thẻ = xác nhận; INT-21 bỏ gọi bạn thuyền, hotline `SDVICO_HOTLINE`; INT-02 premium hai tầng; tấm che toàn màn; chip `/cho/sp` bỏ "Thêm món này"; STT `network` → chip hàng chính + câu chốt; client 25 s; mã lỗi +`invalid`/`bad_snapshot`/`upstream`/`timeout`; mock = `reply.source`; `forfish.assistant.` vào `NEVER_BACKUP_PREFIXES`; AC-T05/06/07/08/10/11/17/18/23/24/40/41/51/54 sửa theo type 14 §3.1; §10 việc 8 = 3 chạm (19/20 đạt); §11 #1/2/4/6/9/13 đánh dấu đã chốt; Open = rỗng.

---

**Last updated**: 2026-09-06 (v1.1, hợp nhất sau phản biện)

### UI Sen Biển — 2026-09-08

Nấc nghỉ tăng từ 55% lên 65%, nấc mở rộng giữ 92% của vùng trên dock. Mic thu còn 4rem, glyph 2rem, nhãn bên cạnh để dành chiều cao cho câu trả lời. Nút đổi nấc có chữ Mở rộng/Thu gọn; chip gợi ý phủ chiều ngang và câu trả lời có nền card. Không đổi vòng hội thoại, điều kiện xác nhận hay quyền hành động.
