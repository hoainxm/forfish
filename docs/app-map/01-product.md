# 01 — Sản phẩm / Product: bốn lời hứa với bà con

> **Mục đích / Purpose**: Định nghĩa canonical về sản phẩm ForFish — bốn lời hứa, thứ tự build, nguồn dữ liệu và quy tắc adapter, vòng lặp giá trị giữa các trục.

**Load khi / Load when**: cần hiểu scope một trục, quyết định feature thuộc trục nào, đụng tới data vendor (OceanByte, SDWork), hoặc viết copy/positioning.

---

## 1. ForFish là gì

App đồng hành của **ngư dân Việt Nam**, do **SDVICO** đặt hàng. Mobile-first, tiếng Việt đời thường.

**Người dùng**: ngư dân, phần lớn 40–60 tuổi, **ít rành công nghệ** (low tech literacy). Mọi quyết định sản phẩm phải qua filter: *"bác ngư dân 55 tuổi, tay ướt, đứng ngoài nắng có dùng được không?"* — chi tiết UI ở [03-design-system.md](03-design-system.md).

**Nguyên tắc số 1**: sản phẩm cấu trúc quanh **BỐN LỜI HỨA (bốn trục)** — KHÔNG phải quanh feature, KHÔNG phải quanh nguồn dữ liệu. Vendor có thể thay, lời hứa thì không.

## 2. Bốn trục / The four promises

### Trục 1 — Đánh bắt tốt hơn (`/ngu-truong`)
- **Hứa gì**: ra khơi trúng hơn, đỡ phí dầu phí công.
- **Gồm**: bản đồ ngư trường map-first (lớp hải đồ/vệ tinh + nhãn chủ quyền tiếng Việt), **dự báo vẽ động kiểu Windy** (lớp gió/sóng theo giờ 3 ngày, thanh thời gian + nút chạy), gió sóng theo điểm chạm 1–10 ngày, **lớp "Cá mùa này"** (vùng nào đang vụ cá gì — mùa vụ nhiều năm), dẫn đường tiết kiệm dầu.
- ⚠️ **TRIẾT LÝ (user chốt 2026-06-10): app KHÔNG phán "đi hay không đi"** — ngư dân có lịch chuyến của họ; đã bỏ điểm số 1–100 + lời khuyên ra khơi khỏi UI bản đồ. App mô tả ĐIỀU KIỆN ("Biển êm/Biển động nhẹ/Biển động mạnh" + sóng m + gió cấp), quyết là việc của thuyền trưởng. `scoreDay` trong `sea.ts` vẫn dùng nội bộ để tô màu mức.
- **Dữ liệu hiện chạy** (đều miễn phí, không cần key, qua adapter trong `src/lib/`):
  - Ảnh vệ tinh: chương trình mở của NASA (cập nhật hằng ngày, **trễ ~2 ngày** — UI ghi rõ "ảnh ngày X, chậm vài ngày"). Lớp dòng chảy mặt biển: chưa có nguồn tile miễn phí không-key → làm sau.
  - Dự báo vẽ trên bản đồ (kiểu Windy): lưới ~80 điểm Open-Meteo theo GIỜ, 3 ngày, mũi tên hướng + màu theo độ dữ (`src/lib/forecast-grid.ts`).
  - **DỰ BÁO CÁ (PFZ — tính năng đầu bảng)**: `src/lib/fish-predict.ts` + route `/api/fish-forecast` (cache 6h) — chấm điểm từng ô biển 0.25°: hợp-nhiệt từng loài (trapezoid SST) × habitat, với **habitat = trung bình có trọng số của 6 yếu tố tụ cá: mồi (chlorophyll) · front nhiệt · front mồi · rìa xoáy (SSHA) · nước trồi (dị thường nhiệt ÂM, Coral Reef Watch 0.05°, trễ ~1 ngày) · hội tụ dòng chảy mặt (u,v blended → convergence, nơi nước dồn gom mồi nổi)** — trọng số riêng từng loài (`SPECIES_PROFILES.w`), loài ưa nước trồi lạnh thì cộng cả độ lõm mực nước. SST + phù du BẮT BUỘC; 4 trường còn lại TUỲ CHỌN — thiếu trường nào thì loại + chia lại trọng số, không phạt oan. Lọc mùa vụ + vùng (`fish-seasons.ts`). Nguồn lưới NOAA ERDDAP công khai (coastwatch): SST blended không lỗ mây + phù du DINEOF vá mây + SSHA blended + `noaacrwsstanomalyDaily` + `noaacwBLENDEDNRTcurrentsDaily`. **Bộ loài rộng (39 loài, 2026-06-10) — để ~90% bà con tìm được loài mình đánh**: `SPECIES_PROFILES` phủ 6 nhóm `category` — cá nổi lớn (ngừ vây vàng/vằn/chù/ồ/chấm, thu, cờ, nục heo, ngân), cá nổi nhỏ (cơm, trích, nục, bạc má, tráo, sòng, chỉ vàng, lầm, đối), mực & bạch tuộc (ống, xà, lá, nang, bạch tuộc), cá đáy (mối, đổng, phèn, đù, khoai, chim, bơn, hố), cá rạn (hồng, mú, kẽm), giáp xác (tôm bạc, tôm sú, ghẹ xanh, cua biển, ruốc). SST/dải mồi/đặc tính từ FAO + FishBase + RIMF (agent khảo cứu, có nguồn). **TRUNG THỰC theo `surfaceSignal`**: cá nổi (high) dự báo điểm tin được; loài ĐÁY/RẠN/cửa sông (low) ảnh vệ tinh mặt biển ít giúp → habitat kéo về trung tính (`SURFACE_CONF`), KHÔNG vẽ điểm nóng giả, lớp "Mọi loài" chỉ tính loài định-vị-được, thẻ cá nói thẳng "đoán theo MÙA VỤ + ĐỘ SÂU". **Hiển thị kiểu PFZ chuẩn (tham khảo OceanFishMap)**: vùng mềm heatmap **mỗi loài MỘT MÀU** (`SPECIES_PROFILES.color` + `SPECIES_META`; Mọi loài = xanh lá), **hồng tâm** ≤8 điểm nóng nhất (≥75 điểm, cách ≥0.7°, chạm-là-tới, tô màu loài đang chọn); **chọn loài** bằng hàng chip có chấm màu — **loài đang vụ Ở VÙNG ĐANG XEM xếp lên đầu** (viền cam). **ƯU TIÊN GẦN MÌNH**: điểm nóng cộng điểm thưởng theo khoảng cách tới chỗ đang xem / cảng nhà / điểm ghim (≤+12, mờ tới 0 ở ~220 km — không bịa cá, chỉ xếp chỗ gần lên trước), thẻ cá có dòng "Điểm cá gần bạn nhất: ~N hải lý hướng X". Chạm điểm → "Chỗ này có khả năng TỐT/khá/vừa cho: [loài]" + **số môi trường tại ô (nước °C · mồi dày/vừa/loãng)** + ngày ảnh; sheet luôn kèm **tuần trăng đêm nay** (`lib/moon.ts`, tính offline — nghề đèn mực/cá cơm). LUÔN "tham khảo, không phải cam kết". Khẩu vị loài từ tài liệu sinh học công khai — KHÔNG đụng API/dữ liệu đối thủ. **Nâng cấp lớn còn lại (sprint riêng)**: thermocline/iso-26°C + độ mặn model từ HYCOM ESPC-D-V02 (`ncss.hycom.org`, 1/12°, 40 tầng, trễ ~1 ngày, không key — đã kiểm chứng sống 2026-06-10; cần adapter OPeNDAP riêng, decode Int16 `*0.001+20`).
  - **Cá mùa này** (fallback + ngữ cảnh): `src/data/fish-seasons.ts` — 7 vùng biển × **39 loài** × tháng (mở rộng 2026-06-10, mỗi loài 1+ dòng theo vùng/mùa), tổng hợp từ bản tin RIMF + FAO/FishBase + báo ngành (THAM KHẢO). `species` khớp ĐÚNG `SPECIES_PROFILES.species` (test ép phủ hai chiều). Nâng cấp tương lai: nối bản tin dự báo ngư trường RIMF theo kỳ.
  - **Nước dâng/xoáy (SSHA)**: `src/lib/sea-scalars.ts` + route `/api/sea-scalar` — dị thường mực nước (ERDDAP, tươi hằng ngày) vẽ ô màu 0.5°: nhô = xoáy ấm, lõm = xoáy lạnh gom mồi. **Độ mặn: TẠM RÚT khỏi UI** — SMOS bị nhiễu RFI che trắng Biển Đông, SMAP ngừng 2021–22 (code giữ, có nguồn sống bật lại 1 dòng trong `SEA_SCALAR_ORDER`). **Tầng nhiệt**: nguồn miễn phí (OHC/iso26C) ngừng 2024 — chưa làm, không dùng dữ liệu cũ giả làm mới.
  - Hải đồ: độ sâu đáy biển EMODnet/GEBCO (tĩnh, không đổi theo ngày — UI ghi rõ) + báo hiệu hàng hải (phao, đèn biển) OpenSeaMap, tự hiện khi zoom gần bờ. Lưu ý OpenSeaMap là dữ liệu cộng đồng, vùng VN còn thưa — chỉ là tham khảo thêm, không thay hải đồ giấy/máy định vị của tàu.
  - Gió/sóng + mưa/dông: Open-Meteo (mô hình quốc tế, cập nhật theo giờ) — UI luôn kèm lời dặn nghe đài duyên hải / biên phòng. Dông sét trừ 30 điểm đi biển và tô đỏ — nguy hiểm nhất với tàu nhỏ.
  - **Tầm dự báo chọn được**: tại điểm chạm trên bản đồ, bà con chọn xem trước 1–10 ngày (`FORECAST_MAX_DAYS = 10` — giới hạn theo nguồn sóng; gió mô hình cho xa hơn nhưng lấy mức cả hai cùng có). **Độ tin ghi rõ theo tầm xa** (`forecastConfidence`): 1–3 ngày khá sát · 4–7 ngày tham khảo · 8–10 ngày chỉ để liệu đường. Ảnh vệ tinh là ảnh ĐÃ CHỤP — không dự báo trước được, UI nói thẳng điều này cạnh bộ chọn ngày.
  - Dẫn đường tiết kiệm dầu: thuật toán theo mô hình nghiên cứu VISIR cho tàu nhỏ (xem [../research/06-weather-routing.md](../research/06-weather-routing.md)) — lưới phủ vùng + Dijkstra theo giờ dự báo Open-Meteo (72h: sóng + hướng, gió + hướng, **dòng chảy mặt biển** nguồn SMOC ~8 km gồm cả dòng triều — cộng vector vào tốc độ tàu, biết "đi nhờ nước"/né nước ngược), né bờ/rạn/bãi cạn bằng lưới độ sâu ETOPO 2022 đóng gói sẵn (chặn <4 m, cảnh báo 4–12 m; rạn Hoàng Sa/Trường Sa quét ở phân giải gốc). **Mô hình dầu là ƯỚC LƯỢNG THAM KHẢO** (sóng làm tàu chậm theo hướng sóng — hệ số Kwon 4 bậc; ngược gió ăn dầu hơn). **An toàn theo thang KTTV VN** (audit 2026-06-10, research/06 §3b): cấp 6/sóng 2–3 m phạt nhẹ "cẩn thận" · cấp 7/3–4 m cảnh báo đỏ "không nên đi" · cấp 8/≥4 m chặn cứng; sóng đuôi ngắn ≥2 m chỉ CẢNH BÁO giảm ga; **trần đường vòng 30%** — đường thẳng đi được mà tuyến vòng quá 30% thì trả đường thẳng + cảnh báo, không vẽ tuyến 4× rồi gọi là tiết kiệm. KHÔNG hứa con số lít chính xác; chưa biết đá ngầm nhỏ, luồng lạch; dòng nước sát bờ kém chính xác (nguồn ghi rõ "not suitable for coastal navigation") — UI bắt buộc dặn dò hải đồ + nghe đài trước khi chạy.
  - Tin bão/áp thấp: hệ cảnh báo thiên tai quốc tế GDACS (EU/UN, JSON công khai) qua proxy `/api/storms`, lọc vùng Biển Đông. **Quy tắc an toàn** (sửa sau audit 2026-06-10): nguồn fail → hiện rõ "Chưa kiểm tra được tin bão — nghe đài duyên hải" (KHÔNG BAO GIỜ nói "không có bão" khi chưa chắc; cũng không im lặng — người dùng không phân biệt được im lặng với "đã kiểm tra, không có"); dòng trấn an xanh chỉ hiện khi đã kiểm tra được thật. Nguồn quốc tế có thể lệch tên/cấp so với bản tin KTTV VN bà con nghe đài — nâng cấp lên nguồn chính thống VN khi có thỏa thuận.
- **Dữ liệu tương lai**: feed thương mại (vd OceanByte) — **bắt buộc đi qua adapter có thể thay thế**.
  - ⚠️ OceanByte là bên thứ ba nước ngoài, có sản phẩm vessel-tracking cạnh tranh → **không bao giờ là core**, không hardcode vào domain logic.
  - ⚠️ Khuyến nghị ngư trường của họ chỉ cập nhật **2 lần/tuần** → KHÔNG hứa với người dùng độ chính xác hằng ngày cho phần khuyến nghị.
- ⚠️ Độ phân giải ảnh vệ tinh là **mức vùng (vài km)**, không phải tọa độ điểm — không hứa "chỉ đúng chỗ thả lưới". Lớp phù du bị mây che mất chỗ — UI giải thích "chỗ trống là mây che".

### Trục 2 — Bán được đắt hơn (`/gia-ca`)
- **Hứa gì**: cá về bờ bán được giá, không bị ép.
- **Cấu trúc TÁCH ĐÔI (user chốt 2026-06-10)**:
  1. **GIAO DỊCH** — thông tin được cấp để bán có LỢI THẾ: giá cá hôm nay · **"Ai cần mua"** (bảng yêu cầu loài + khối lượng + giá từ đầu nậu/vựa/nhà máy) · danh bạ chỗ bán.
  2. **HIỆU QUẢ** — phân tích chuyện làm ăn: thẻ nhìn nhanh (tổng lãi, bình quân/chuyến, % chuyến lãi, % tiền bán vào dầu — `lib/trip-insights.ts`) + sổ lãi/lỗ + máy chia tiền.
- **Lộ trình "Ai cần mua"**: sẽ có **app riêng cho bên thu mua** đăng yêu cầu (loài, khối lượng, giá) → tin chảy thẳng về mục Giao dịch, ngư dân gọi chào bán. Trong lúc chờ: `src/data/buy-requests.ts` chỉ chứa TIN MẪU (`demo: true`, UI ghi rõ từng thẻ, không SĐT) — KHÔNG bịa tin thật. Shape `BuyRequest` là hợp đồng cho app thu mua sau này.
- **Dữ liệu**: **tự thu thập** qua mạng lưới đại lý/cảng của SDVICO (moat riêng, không ai có), feed từ SDWork.

### Trục 3 — Vận hành rẻ hơn (`/van-hanh`)
- **Hứa gì**: giữ tàu chạy bền, tốn ít tiền hơn.
- **Gồm**: chợ vật tư in-app (dầu nhớt, lọc...), nhắc bảo dưỡng, yêu cầu bảo hành.
- **Dữ liệu/flow**: đơn hàng chảy vào **SDWork** (ERP công ty), thanh toán QR.
- **Đồng bộ ngược từ SDWork (2026-06-10, user chốt)**: khách mua hàng thì SDWork tạo account + đơn + dịch vụ nhưng **không cấp quyền vào SDWork** (app nội bộ/CTV/đại lý) — tài khoản đó tách thành tài khoản ForFish. ForFish tự kéo về (qua adapter, đọc-chỉ): **sản phẩm đã mua + hạn bảo hành, dịch vụ đang dùng + kỳ tới (bảo trì/cước), khoản chờ thanh toán** để nhắc bà con. Chi tiết chuỗi nối: [04-data-model.md](04-data-model.md) §6.
- **ForFish = kênh CSKH của SDVICO (2026-06-10, user chốt)**: tab Sản phẩm hiện danh mục hàng đang bán theo NHÓM (lọc nước biển / giám sát hành trình / wifi biển / lọc dầu / nhớt / sơn tàu / điện-lái) — nhóm ĐÃ MUA gắn nhãn "đang dùng", nhóm CHƯA MUA là gợi ý kèm nút **"Hỏi mua / tư vấn"**; tab Bảo dưỡng đổi thành **Dịch vụ** (sửa chữa + bảo dưỡng + cước + sổ nhắc tự ghi). Mọi nút "Gọi SDVICO" gửi yêu cầu thẳng vào hộp tư vấn của SDWork (kể cả khách chưa đăng nhập = mối bán hàng mới) — nhân viên gọi lại. Đây là vòng lặp cross-trục mục 4 chạy bằng dữ liệu thật.
- **Vai trò**: đây là **động cơ doanh thu** của công ty.

### Trục 4 — Tuân thủ dễ hơn (`/giay-to`) — **MVP hiện tại**
- **Hứa gì**: lo giấy tờ nhẹ đầu, tránh bị phạt oan.
- **Gồm**: tủ giấy tờ (document vault) + nhắc hạn, trợ lý hỏi đáp pháp luật thủy sản VN.
- **Dữ liệu**: KHÔNG phụ thuộc nguồn ngoài → được build **ĐẦU TIÊN**. Logic ở [04-data-model.md](04-data-model.md).

## 3. Thứ tự build / Build order

```
Trục 4 + 3  →  Trục 1  →  Trục 2
(không phụ      (feed       (mạng lưới
 thuộc ngoài)    ngoài)      tự thu thập)
```

Hiện trạng (2026-06-10): cả 4 trục đều có MVP chạy được — Trục 1: điểm đi biển dữ liệu thật Open-Meteo + bản đồ ngư trường ảnh vệ tinh (nhiệt độ/phù du/ảnh mây, nhãn chủ quyền VN, chạm xem gió sóng); Trục 2: bảng giá tham khảo + sổ lãi lỗ; Trục 3: nhắc bảo dưỡng + danh mục vật tư; Trục 4: tủ giấy tờ + tra mức phạt NĐ 38/2024. Dữ liệu giá/vật tư/mức phạt là bản tổng hợp THAM KHẢO từ nguồn công khai — bước tiếp: thay bằng nguồn tự thu qua mạng đại lý.

## 4. Vòng lặp cross-trục / Cross-pillar loop

```
Trục 1 + 4 (điểm biển, nhắc hạn) → mở app hằng ngày
        ↓
  thấy Trục 3 (chợ vật tư) → doanh thu SDVICO
        ↓
Trục 2 tăng thu nhập → mua nhiều hơn từ Trục 3
        ↓
  mọi lượt dùng → làm giàu hồ sơ tàu (boat profile) trong SDWork
```

## 5. Quy tắc adapter / Adapter rule (invariant)

1. Nguồn dữ liệu ngoài (OceanByte, SDWork, kho văn bản luật) chỉ là **phương tiện** — code phải tách qua adapter layer để thay vendor mà không đổi domain logic.
2. Không để tên vendor lọt vào UI copy hay domain types.
3. Không hứa với người dùng điều mà nguồn dữ liệu không đảm bảo (tần suất, độ chính xác).

## 7. Lộ trình: từ 4 lời hứa → app quản lý toàn bộ tàu cá

Định vị mở rộng (2026-06): bốn lời hứa vẫn là **ngôn ngữ giá trị**, nhưng object model của app chuyển sang **CON TÀU** (tàu → chuyến biển → thuyền viên → tiền → giấy tờ). Căn cứ JTBD + chân dung người dùng + mốc pháp lý: xem [06-jtbd-quan-ly-tau.md](06-jtbd-quan-ly-tau.md).

> **Quyết định phạm vi (2026-06-10, từ user)**: khai báo **eCDT / nhật ký khai thác điện tử (NKKT)** là nghiệp vụ với hệ thống NHÀ NƯỚC — **ngoài phạm vi ForFish** (hệ sinh thái đã có sản phẩm NKKT riêng phụ trách mảng này). ForFish chỉ dừng ở: NHẮC mốc nghĩa vụ, checklist trước chuyến, giải thích quy định bằng lời thường. KHÔNG xây wizard khai hộ, KHÔNG tích hợp/đồng bộ hệ thống khai báo nhà nước.

1. **Đợt 1 — Thuyền viên + sổ tiền (wedge)** *(đang xây)*: crew module `/thuyen-vien` (hồ sơ + chứng chỉ/bảo hiểm + sổ ứng tiền + máy tính chia tiền) và sổ tiền của tàu trên nền trip-log. Đây là khoảng trống vàng số 1 — chưa app nào ở VN đụng tới phần "tiền"; không phụ thuộc nguồn ngoài, đúng triết lý build order ở mục 3.
2. **Đợt 2 — Checklist xuất bến + nhắc tuân thủ**: checklist xuất bến tự sinh theo Lmax (đèn xanh-đỏ "đủ điều kiện xuất bến": giấy tàu, chứng chỉ, bảo hiểm thuyền viên, sổ danh bạ) + cảnh báo hạn giấy tờ cho cả người nhà trên bờ + NHẮC mốc nghĩa vụ khai báo (không khai hộ — xem quyết định phạm vi ở trên).
3. **Đợt 3 — Công nợ nậu + hồ sơ chuyến QR**: sổ công nợ đa đối tượng (đại lý dầu, nậu, ngân hàng — minh bạch hóa trước, thay thế nậu sau) + gói hồ sơ chuyến biển PDF/QR chứng minh truy xuất cho người mua.
4. **Đợt 4 — Kết nối SDWork/marketplace**: hồ sơ kinh nghiệm thuyền viên thành "chợ lao động đi biển", kênh bán/chào giá nối mạng đại lý SDVICO, đơn vật tư chảy sâu hơn vào SDWork — chỉ sau khi dữ liệu từ đợt 1–3 đủ dày.

## 8. Cross-references

- Kiến trúc routes/components: [02-architecture.md](02-architecture.md)
- Thiết kế cho ngư dân: [03-design-system.md](03-design-system.md)
- Schema + logic Trục 4: [04-data-model.md](04-data-model.md)
- Cách team agent chia việc: [05-agents-team.md](05-agents-team.md)
- JTBD + map nhóm việc → module (quản lý toàn bộ tàu cá): [06-jtbd-quan-ly-tau.md](06-jtbd-quan-ly-tau.md)

---

**Last updated**: 2026-06-10
