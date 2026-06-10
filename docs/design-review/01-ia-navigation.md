# 01 — Đánh giá IA & Điều hướng / IA & Navigation Review

> **Lăng kính / Lens**: Kiến trúc thông tin & điều hướng. Người dùng đích: chủ tàu 40–60 tuổi, ít rành công nghệ, dùng điện thoại ngoài nắng tay ướt.
>
> **Vấn đề cốt lõi**: App khởi đầu là "4 lời hứa" (route = trục feature) nhưng đang chuyển định vị sang **"app quản lý toàn bộ con tàu"** (object model: tàu → chuyến biển → thuyền viên → tiền → giấy tờ — [06-jtbd-quan-ly-tau.md](../app-map/06-jtbd-quan-ly-tau.md) §1). IA hiện tại chưa theo kịp: feature sprawl trên 1 màn, 1 route mồ côi khỏi nav, "tiền nong" nằm rải 2 nơi.
>
> **READ-ONLY trên code** — tài liệu này chỉ đánh giá & đề xuất, không sửa src.

**Last updated**: 2026-06-10

---

## 1. Sơ đồ IA hiện tại (cây route → chức năng con) + chấm điểm

Ký hiệu mức độ vấn đề: 🔴 nặng · 🟡 vừa · 🟢 ổn.

```
ForFish (bottom nav = 5 tab)
│
├─ [TAB] / · Trang chủ ............................................ 🟢
│   ├─ Strip "Việc cần làm ngay" (giấy tờ sắp/đã hết hạn → /giay-to)
│   ├─ Lưới 4 thẻ lớn: Đánh bắt / Bán cá / Vật tư & máy / Giấy tờ
│   └─ Thẻ ngang "Thuyền viên" → /thuyen-vien   ← LỐI VÀO DUY NHẤT 🔴
│
├─ [TAB] /ngu-truong · "Đánh bắt" ................................. 🔴 QUÁ TẢI
│   (src/app/ngu-truong/page.tsx chỉ stack 3 block, nhưng block 3 chứa 4 chức năng lồng)
│   ├─ StormBanner — tin bão Biển Đông (an toàn, đúng chỗ) 🟢
│   ├─ SeaForecast — điểm đi biển 1–100 + dự báo 10 ngày 🟢  ← VIỆC CHÍNH
│   └─ FishingMap (lazy) → fishing-map-view.tsx, gói trong 1 bản đồ:
│        ├─ Lớp ảnh vệ tinh (nước nóng lạnh / mồi / mây) + nhãn chủ quyền
│        ├─ Chạm điểm → gió sóng tại điểm (marine-weather)
│        ├─ Geofence ranh giới biển VN (borderProximity)        🔴 chức năng nặng, ẩn trong map
│        │    fishing-map-view.tsx:42,269,372 — cảnh báo vượt ranh (chống IUU)
│        └─ RoutePlanner — dẫn đường tiết kiệm dầu              🔴 chức năng nặng, ẩn trong map
│             fishing-map-view.tsx:37-40,529 (RouteMapLayers:339) — form xuất phát + thông số tàu + thẻ kết quả
│   → 1 màn = 5 việc nhận thức khác nhau (an toàn / nên đi không / xem ngư trường / coi chừng ranh / tính tuyến dầu)
│
├─ [TAB] /gia-ca · "Bán cá" ....................................... 🟡
│   ├─ PriceBoard — giá cá tham khảo theo cảng 🟢  ← VIỆC CHÍNH (bán cá)
│   └─ TripLog — sổ lãi/lỗ chuyến biển 🔴 ĐẶT SAI CHỖ (là "tiền", không phải "bán")
│
├─ [TAB] /van-hanh · "Vật tư" ..................................... 🟢
│   ├─ MaintenanceReminders — nhắc bảo dưỡng
│   └─ SupplyCatalog — bảng giá vật tư
│   (gắn kết tốt: cùng là "giữ tàu chạy bền". Nhãn tab "Vật tư" hơi hẹp so với nội dung)
│
├─ [TAB] /giay-to · "Giấy tờ" ..................................... 🟢
│   ├─ DocumentVault — tủ giấy tờ + nhắc hạn 🟢  ← MVP mạnh nhất
│   └─ FinesLookup — tra mức phạt NĐ 38/2024 🟢 (tra cứu, bổ trợ giấy tờ — hợp lý)
│
└─ /thuyen-vien · "Thuyền viên" .................. 🔴 MỒ CÔI — KHÔNG có trong nav
    (vào được chỉ từ 1 thẻ trang chủ; rời màn này là mất đường quay lại trừ khi về home)
    ├─ CrewList — hồ sơ bạn thuyền + bảo hiểm/chứng chỉ hạn + sổ ứng tiền 🔴 (ứng tiền = "tiền")
    └─ TripSplit — máy tính chia tiền chuyến 🔴 (chia tiền = "tiền")
```

### Bảng chấm điểm theo màn

| Màn | Số "việc" trên màn | Vấn đề chính | Mức |
|---|---|---|---|
| `/` Trang chủ | 1 (chọn việc) | Tốt, nhưng phải gánh vai trò router cho Thuyền viên vì nav thiếu | 🟢 |
| `/ngu-truong` | **5** | Quá tải: điểm đi biển + bản đồ + geofence + dẫn đường dầu chồng 1 màn/1 bản đồ. Vi phạm "một việc một màn" ([03-design-system.md](../app-map/03-design-system.md) §1) | 🔴 |
| `/gia-ca` | 2 | Sổ lãi/lỗ (tiền) bị nhét chung với bảng giá (bán) — lệch object model | 🟡 |
| `/van-hanh` | 2 | Gắn kết tốt; chỉ vướng nhãn tab "Vật tư" hẹp | 🟢 |
| `/giay-to` | 2 | Mạch lạc | 🟢 |
| `/thuyen-vien` | 2 | **Mồ côi** khỏi nav + chứa 2 chức năng "tiền" (ứng + chia) | 🔴 |

**Kết luận §1**: 3/6 màn có lỗi IA. "Tiền nong" — theo JTBD là 1 nhóm việc độc lập, lớn nhất, khoảng-trống-vàng-số-1 ([06](../app-map/06-jtbd-quan-ly-tau.md) §4) — hiện **vỡ làm 3 mảnh** ở 3 nơi: sổ lãi/lỗ (`/gia-ca`), sổ ứng tiền (`/thuyen-vien` → CrewList), máy tính chia tiền (`/thuyen-vien` → TripSplit). Người dùng không có một chỗ duy nhất để hỏi "chuyến này lời hay lỗ, ai nợ ai bao nhiêu".

---

## 2. Đánh giá điều hướng (lăng kính usability)

### a) 5 tab hiện tại còn đúng không? — KHÔNG hoàn toàn

| Tiêu chí (cho người ít rành CN) | Hiện trạng | Đạt? |
|---|---|---|
| Số tab 3–5 | 5 tab | 🟢 (đúng trần) |
| Tab map đúng object model "con tàu" | Map theo **trục feature cũ**, không theo tàu→chuyến→người→tiền→giấy | 🔴 |
| Mọi việc lớn đều có lối vào ổn định | "Thuyền viên" (nhóm việc lớn) **không có tab** | 🔴 |
| Nhãn nhất quán với nội dung | Tab "Đánh bắt" nhưng chứa cả dẫn đường+ranh giới; tab "Vật tư" thực ra là "Vật tư & máy" (home gọi vậy, tab gọi khác) | 🟡 |
| Active state rõ "tôi đang ở đâu" | Pill navy đậm, label bold — rất tốt | 🟢 |

→ Bottom nav (`bottom-nav.tsx:17-23`) hiện 1:1 với 4 trục + home. Nhãn tab ("Đánh bắt/Bán cá/Vật tư/Giấy tờ") **lệch** với nhãn thẻ home ("Đánh bắt/Bán cá/Vật tư & máy/Giấy tờ") — chi tiết nhỏ nhưng gây "cùng thứ hai tên" với người ít rành CN.

### b) Thuyền viên để đâu? — Phải lên nav

Đây là lỗi nặng nhất về điều hướng. `/thuyen-vien` là wedge đang xây ([01-product.md](../app-map/01-product.md) §7 Đợt 1), là khoảng trống vàng, nhưng **chỉ vào được từ 1 thẻ trên trang chủ**. Hệ quả:
- Người dùng ở màn khác muốn xem thuyền viên → phải nhớ "về home trước". Vi phạm nguyên tắc lối vào ổn định.
- Nhành vi thực tế (theo JTBD nhóm D): chốt đủ người *trước ngày xuất bến*, ghi ứng tiền *tại bến* — đều là việc gấp, cần 1 chạm, không phải 2.
- `/thuyen-vien` không có gì đưa nó vào nav → mồ côi về mặt kiến trúc, không chỉ UX.

### c) "Tiền nong" có nên gom? — CÓ, dứt khoát

Sổ lãi/lỗ + sổ ứng tiền + chia tiền chuyến đang nằm rải 2 route. Theo object model, **TIỀN là một nhóm việc ngang hàng** với thuyền viên/giấy tờ ([06](../app-map/06-jtbd-quan-ly-tau.md) §3 nhóm C). Lý do gom:
- Cả 3 dùng chung 1 dữ liệu gốc: **chuyến biển** (trip). Lãi/lỗ = doanh thu − tổn − chia bạn; chia bạn lại trừ tiền ứng. Tách ra 2 nơi là cắt ngang một mạch tính tiền liền lạc.
- Người dùng hỏi "chuyến rồi lời lỗ sao" sẽ không đoán được là vào `/gia-ca` (Bán cá). Sai mental model.

### d) Bottom nav nên mấy tab?

3–5 là tối ưu cho người ít rành CN; **5 là trần, không nên vượt**. Hiện đã 5 nhưng phân bổ sai. Khuyến nghị: giữ **5 tab** nhưng **đổi tập hợp** — bỏ/gộp 1 trục để có chỗ cho 2 nhóm việc lớn đang thiếu (Thuyền viên, Tiền). Không thêm tab thứ 6.

---

## 3. ĐỀ XUẤT IA MỚI (khớp object model "con tàu")

Nguyên tắc nền: bottom nav phản ánh **5 nhóm việc quanh con tàu** (Đi biển · Bán cá · Tiền · Thuyền viên · Giấy tờ), không phản ánh 4 trục feature. "Vật tư & bảo dưỡng" tụt xuống cấp 2 (truy cập từ trang chủ / trong "Tàu của tôi") vì nó là động cơ doanh thu nhưng **không phải việc chủ tàu mở app hằng ngày** như tiền/giấy/đi biển.

### Phương án A — 5 tab theo nhóm việc (KHUYẾN NGHỊ)

```
[TAB] Đi biển     (/ngu-truong)   ← TÁCH NHỎ, xem §3.1
[TAB] Bán cá      (/gia-ca)        chỉ còn giá cá + (về sau) chào bán
[TAB] Tiền        (/so-tien) MỚI   gom: lãi/lỗ chuyến + công nợ + chia tiền
[TAB] Thuyền viên (/thuyen-vien)   LÊN NAV: hồ sơ + bảo hiểm/chứng chỉ + ứng tiền
[TAB] Giấy tờ     (/giay-to)        tủ giấy tờ + tra phạt + (về sau) checklist xuất bến
```

- **Trang chủ** chuyển từ tab thành **nút Home trên header** (hoặc logo bấm về) — vì 5 nhóm việc đã chiếm 5 tab. Trang chủ vẫn là nơi gom "việc cần làm ngay" + lối vào **Vận hành (Vật tư & máy)** dưới dạng thẻ.
- **Vật tư & máy** (`/van-hanh`) thành màn cấp 2: vào từ thẻ trang chủ + từ "Tàu của tôi". Vẫn là doanh thu nhưng không tranh slot tab với việc-hằng-ngày.
- **Chia tiền** dời từ `/thuyen-vien` sang tab **Tiền** (vì là phép tính tiền), nhưng giữ deep-link từ hồ sơ thuyền viên ("chia cho người này").

Đánh đổi: mất tab Home cố định — bù bằng nút Home rõ trên header mọi màn (≥56px, icon + chữ "Trang chủ"). Với người ít rành CN, mất Home-tab là rủi ro → **bắt buộc** header có nút về nhà nhất quán.

### Phương án B — 5 tab giữ Home, gộp 2 trục (an toàn hơn về quán tính)

```
[TAB] Trang chủ   (/)              giữ nguyên — điểm tựa quen thuộc
[TAB] Đi biển     (/ngu-truong)    TÁCH NHỎ (§3.1)
[TAB] Thuyền viên (/thuyen-vien)   LÊN NAV
[TAB] Tiền        (/so-tien) MỚI   gom lãi/lỗ + ứng + chia + (về sau) công nợ
[TAB] Giấy tờ     (/giay-to)
```

- **Bán cá (`/gia-ca` — chỉ còn bảng giá)** và **Vật tư (`/van-hanh`)** rời bottom nav, gom vào trang chủ thành 2 thẻ lớn (như lưới hiện tại). Giá cá vốn là tra cứu nhanh, không cần ở tab; sổ lãi/lỗ tách khỏi đây sang Tiền.
- Giữ Home-tab = giữ "điểm về" quen thuộc cho bác 55 tuổi — ít rủi ro đổi thói quen hơn A.

### Khuyến nghị: **Phương án B** cho bước chuyển tiếp, tiến tới A sau

Lý do: nhóm người dùng ít rành CN bám rất chặt vào "nút Trang chủ". Bỏ Home-tab (A) đúng về lý thuyết object-model nhưng tạo cú sốc điều hướng giữa lúc đang đổi định vị. **B giữ Home, vẫn đạt được 2 mục tiêu quan trọng nhất** (Thuyền viên lên nav + gom Tiền), chỉ hạ Bán cá/Vật tư xuống thẻ home — hai thứ này vốn dùng thưa hơn. Khi người dùng quen object-model "con tàu" rồi mới tính nâng lên A.

### 3.1 Tách `/ngu-truong` thế nào (gỡ quá tải)

Vấn đề: 1 màn gánh 5 việc, 1 bản đồ gánh 4 lớp chức năng (ảnh vệ tinh + chạm gió sóng + geofence + dẫn đường dầu). Đề xuất **1 màn chính + 2 màn phụ** trong cùng tab Đi biển:

```
TAB Đi biển (/ngu-truong)
│
├─ MÀN CHÍNH = "Hôm nay đi biển được không?"  ← việc số 1, mở ra thấy ngay
│   ├─ StormBanner (giữ trên cùng — an toàn trước)
│   ├─ SeaForecast (điểm đi biển + 10 ngày)
│   └─ 2 nút lớn dẫn sang màn phụ:
│        [ Xem bản đồ ngư trường ]   [ Tính tuyến đi tiết kiệm dầu ]
│
├─ MÀN PHỤ 1: Bản đồ ngư trường (/ngu-truong/ban-do)
│   ├─ Lớp ảnh vệ tinh + nhãn chủ quyền + chạm xem gió sóng
│   └─ Geofence ranh giới hiện ở ĐÂY (đang xem bản đồ mới cần coi ranh)
│
└─ MÀN PHỤ 2: Tuyến đi tiết kiệm dầu (/ngu-truong/dan-duong)
    └─ RoutePlanner (form xuất phát + thông số tàu + kết quả) + lớp vẽ tuyến trên bản đồ
```

Vì sao: "nên đi hay nằm bờ" là câu hỏi mở-app-hằng-ngày → phải là thứ thấy đầu tiên, không bị bản đồ nặng (MapLibre lazy-load) làm chậm. Bản đồ ngư trường và dẫn đường dầu là việc **chủ động đi tìm**, hợp với màn phụ 1 chạm. Geofence ranh giới đi kèm bản đồ (cùng ngữ cảnh không gian), không nên là khái niệm thứ 5 trên màn chính.

> Lưu ý kỹ thuật (không phải nhiệm vụ sửa code ở đây): bản đồ đang lazy-load qua `next/dynamic ssr:false` ([02-architecture.md](../app-map/02-architecture.md) §1) — tách sang route con vừa đúng IA vừa giúp màn chính nhẹ hẳn vì không phải mount bản đồ khi chỉ muốn xem điểm đi biển.

### Cây tab khuyến nghị (gọn — để dán vào nav)

```
[Trang chủ] [Đi biển] [Thuyền viên] [Tiền] [Giấy tờ]
              │                       │       │
              ├ điểm đi biển (chính)  ├ lãi/lỗ chuyến   ├ tủ giấy tờ
              ├ bản đồ (phụ)          ├ công nợ          ├ tra phạt
              └ dẫn đường dầu (phụ)   └ chia tiền chuyến └ (checklist xuất bến)

Trang chủ chứa thẻ → [Bán cá: giá cá]  +  [Vật tư & máy: bảo dưỡng + chợ vật tư]
```

---

## 4. Quy tắc điều hướng cho người ít rành CN

Rút từ [03-design-system.md](../app-map/03-design-system.md) §1 ("một việc một màn", flow ≤2 chạm) + lăng kính usability:

1. **Độ sâu tối đa 2 cấp.** Home/tab (cấp 0) → màn việc (cấp 1) → tối đa 1 màn chi tiết (cấp 2, vd bản đồ, form chia tiền). Không bao giờ cấp 3. Mọi việc chính phải đạt được trong **≤2 chạm** từ khi mở app.
2. **Một việc một màn.** Không stack >2–3 block chức năng *khác loại nhận thức* trên 1 màn. `/ngu-truong` hiện vi phạm (5 việc) → tách như §3.1. Quy tắc tự kiểm: "nếu phải dùng >2 tiêu đề `<h2>` cho 2 việc không liên quan, cân nhắc tách màn."
3. **Lối vào ổn định cho mọi nhóm việc lớn.** Mỗi nhóm việc của con tàu phải có **một lối vào cố định** (tab hoặc thẻ home cố định), không phụ thuộc "nhớ đường". Cấm route mồ côi như `/thuyen-vien` hiện nay.
4. **Nhãn = từ đời thường, một tên duy nhất.** Mỗi màn có **đúng một tên** ở mọi nơi (tab, thẻ home, header). Sửa lệch hiện tại: tab "Vật tư" vs thẻ home "Vật tư & máy" → chọn 1. Nhãn nhóm việc dùng danh từ chủ tàu hay nói: "Tiền" / "Sổ tiền" (không "Tài chính"), "Thuyền viên" / "Bạn thuyền" (không "Nhân sự"), "Giấy tờ" (không "Hồ sơ pháp lý").
5. **Nút về Trang chủ luôn thấy** (nếu chọn Phương án A bỏ Home-tab): header mọi màn có nút Home ≥56px, icon + chữ. Nếu giữ Home-tab (Phương án B) thì miễn.
6. **Active state phải hét lên "bạn đang ở đây".** Giữ pill navy đậm hiện tại (`bottom-nav.tsx:45-57`) — đây là điểm làm tốt, áp dụng nhất quán cho cả màn phụ (breadcrumb/nút back rõ).
7. **Quay lại 1 chạm.** Mỗi màn phụ (cấp 2) có nút back to, rõ chữ ("← Đi biển"), không dựa vào cử chỉ vuốt hệ điều hành (bác lớn tuổi không quen).

---

## Phụ lục — Trích dẫn file:dòng các vấn đề cụ thể

| Vấn đề | Vị trí |
|---|---|
| Bottom nav 5 tab map 1:1 với 4 trục cũ | `src/components/bottom-nav.tsx:17-23` |
| Thuyền viên chỉ vào được từ thẻ home (mồ côi) | `src/app/page.tsx:149-169` |
| `/ngu-truong` stack điểm + bản đồ trên 1 page | `src/app/ngu-truong/page.tsx:18-31` |
| Geofence ranh giới ẩn trong map view | `src/components/fishing-map-view.tsx:42,269,372-383` |
| Dẫn đường dầu (RoutePlanner) ẩn trong map view | `src/components/fishing-map-view.tsx:37-40,339,529` |
| Sổ lãi/lỗ (tiền) đặt trong "Bán cá" | `src/app/gia-ca/page.tsx:25-30` (TripLog) |
| Ứng tiền + chia tiền (tiền) đặt trong Thuyền viên | `src/app/thuyen-vien/page.tsx:1-2,16-27` |
| Nhãn lệch: tab "Vật tư" vs home "Vật tư & máy" | `bottom-nav.tsx:21` vs `page.tsx:44` |
