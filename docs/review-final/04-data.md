# Audit dữ liệu cuối — ForFish (`src/data/`)

Ngày audit: 2026-06-10 · Phạm vi: chỉ đọc, không sửa `src/`.
Bộ dữ liệu: `ports.ts` (10 cảng dự báo), `fishing-ports.ts` (173 cảng chính thức),
`port-prices.ts` (13 loài), `supplies.ts` (15), `fines.ts` (18), `seafood-buyers.ts` (35),
`market-channels.ts` (5 kênh + 7 chợ), `wholesalers/` (93 vựa gộp 6 nguồn).

---

## TÓM TẮT 5 Ý

1. **Kỷ luật trung thực: TỐT.** 93/93 vựa có URL nguồn; mọi bộ tham chiếu đều ghi "tham khảo"; không có SĐT/địa chỉ bịa (100% SĐT đúng định dạng VN, lấy từ Trang Vàng/ĐKKD/web DN). Chỗ nguồn mỏng đều ghi rõ "để trống" thay vì bịa.
2. **Toàn vẹn tọa độ: CÓ LỖI NẶNG.** `fishing-ports.ts` có **4/173 cảng tọa độ vỡ hẳn** (lat 84–86, ngoài bbox VN) và thêm **~7 cảng tọa độ lệch tỉnh nghiêm trọng** (>500 km) + 1 bản ghi rác `lach-hoi111`. Tổng **~12/173 (~7%) tọa độ nghi ngờ**, **31/173 thiếu tọa độ**.
3. **Tên tỉnh KHÔNG nhất quán giữa các bộ.** `ports.ts` dùng tên CŨ (trước sáp nhập), `wholesalers` trộn tên cũ + viết tắt (`TP.HCM`, `Đà Nẵng`, `Hải Phòng`), trong khi `fishing-ports`/`buyers` dùng tên MỚI đầy đủ. Join theo tỉnh giữa cảng ↔ vựa/buyer sẽ trật.
4. **`fishing-ports.ts` (173 cảng) CHƯA ĐƯỢC NỐI VÀO UI** — built-but-unwired. App chỉ dùng `ports.ts` (10 cảng). Đây là tài sản dữ liệu lớn nhất nhưng đang nằm chết.
5. **Khoảng trống loài/vùng vừa phải.** 6/13 loài trong `port-prices` không có nhà máy thu mua khớp; nhiều tỉnh ven biển trống vựa (Quảng Trị, Huế, Ninh Bình, Hưng Yên…).

### Số liệu then chốt
- **4/173** cảng tọa độ ngoài bbox VN (vỡ hẳn); **~12/173** tọa độ nghi ngờ (gồm lệch tỉnh); **31/173** thiếu tọa độ.
- **39/93** vựa thiếu SĐT (~42%). **0** dup tên+tỉnh (dedup chạy đúng nhưng chưa từng phải khử trùng thật).
- **6/13** loài không có buyer khớp; **4** giá trị tên tỉnh vựa sai chuẩn.
- Fines: **18** mục, **2** không có `article` (đều có lý do chính đáng).

### TOP-3 PHẢI SỬA
1. **Sửa 4 tọa độ vỡ + ~7 tọa độ lệch tỉnh trong `fishing-ports.ts`** (xem bảng dưới) và xóa bản ghi rác `lach-hoi111`.
2. **Chuẩn hóa tên tỉnh về MỘT chuẩn (sau sáp nhập 2025)** trên cả 3 bộ `ports.ts`, `wholesalers/*`, `seafood-buyers.ts` để join cảng↔vựa↔buyer hoạt động.
3. **Quyết định số phận `fishing-ports.ts`**: nối vào UI (bản đồ/chọn cảng) hay đánh dấu rõ là dữ liệu chưa dùng — hiện đang vô hình với người dùng.

---

## 1. Kỷ luật trung thực — ĐẠT

- **Nhãn "tham khảo":** mọi bộ tham chiếu đều có. Header `port-prices`, `supplies`, `fines`, `seafood-buyers`, `market-channels`, `wholesalers/types.ts` + `index.ts` đều nêu "THAM KHẢO, gọi xác minh trước khi giao dịch".
- **Nguồn/URL:** đầy đủ trong header mọi file; **93/93 vựa có field `source`**; `port-prices`/`supplies`/`fines` liệt kê URL bài báo/văn bản gốc.
- **Rủi ro SĐT/địa chỉ bịa: THẤP.** Spot-check toàn bộ 93 vựa: **100% SĐT đúng định dạng VN** (09/08/07/03/05 + di động, hoặc 02xx cố định) — không có số trông như bịa. Khi nguồn không có SĐT, file để trống và ghi "nguồn không nêu SĐT" / "danh bạ hiển thị dạng ảnh nên không đưa vào" (`bs-bac.ts`, `bs-trung.ts`) — đúng kỷ luật.
- **Lớp nậu vựa cá nhân:** `market-channels.ts:14-17` ghi rõ KHÔNG bịa tên nậu cá nhân, để người dùng tự thêm "Mối quen" (localStorage). Rất tốt.
- **Fines — số điều luật chỉ ghi nơi kiểm chứng được:** `fines.ts` 18 mục, **2 mục không có `article`** và đều hợp lý:
  - `vms-tau-15-24m` (fines.ts:82-88): cố ý bỏ điều, vì mức lấy theo **NĐ 301/2025 sửa đổi** — note ghi rõ.
  - `chat-no-chat-doc` (fines.ts:150-156): hành vi tổng quát, mức hành chính khi chưa đến hình sự.
  - Header (fines.ts:1-12) phân biệt rõ NĐ 38/2024 vs sửa đổi 301/2025, ghi "KHÔNG phải tư vấn pháp lý". Đạt.

## 2. Toàn vẹn dữ liệu

### 2a. Tọa độ `fishing-ports.ts` — LỖI (Cao)

Bbox VN dùng để soi: lon 102–118, lat 6–24.

**Vỡ hẳn — ngoài bbox (4/173):**
| id | name | tỉnh ghi | lat/lng hiện tại |
|----|------|----------|------------------|
| `dao-an-bang` | Đảo An Bang | Khánh Hòa | lat **86.45** / 111.92 |
| `dao-phan-vinh` | Đảo Phan Vinh | Khánh Hòa | lat **86.45** / 111.92 |
| `dao-da-thuyen-chai` | Đảo Đá Thuyền Chài | Khánh Hòa | lat **86.45** / 111.92 |
| `hon-khoai` | Hòn Khoai | Cà Mau | lat **84.37** / 104.83 |

(3 đảo Trường Sa bị gán **cùng một** lat 86.45/111.92 — rõ ràng lỗi copy/paste; Hòn Khoai phải ~8.5°N.)

**Trong bbox nhưng lệch tỉnh nghiêm trọng (>500 km so với tâm tỉnh) — gần như chắc sai:**
| id | name | tỉnh ghi | lat/lng | Ghi chú |
|----|------|----------|---------|---------|
| `ca-mau` | Cà Mau | Cà Mau | 13.96 / 108.67 | ~672 km lệch — đây là tọa độ Tây Nguyên, Cà Mau phải ~9°N |
| `song-tra-bong` | Sông Trà Bồng | Quảng Ngãi | 19.89 / 105.66 | ~635 km — đang nằm ở Thanh Hóa |
| `lach-bang` | Lạch Bạng | Thanh Hóa | 9.80 / 105.09 | ~1102 km — đang nằm ở Cà Mau/Kiên Giang |
| `da-bac` | Đá Bạc | Khánh Hòa | 8.86 / 104.81 | ~578 km — đang nằm ở mũi Cà Mau |

**Lệch vừa (180–350 km), cần rà:** `bai-dong` (An Giang, 10.65/107.25 — đang ở vùng Vũng Tàu), `phuong-6-thang-nhi` (Thắng Nhì/HCM, 12.25/109.20 — đang ở Nha Trang), `con-dao` (8.68/106.61 — đúng vị trí Côn Đảo nhưng xa tâm "TP.HCM" do tỉnh gán; chấp nhận được).

**Bản ghi rác:** `lach-hoi111` / "Lạch Hới111" — id và tên có hậu tố `111`, nghi là bản nháp/test còn sót → nên xóa hoặc sửa.

**Thiếu tọa độ: 31/173** (vd `cang-ca-sa-ky`, `song-gianh`, `dao-phu-quy`, `dao-nam-du`…). Header file đã thừa nhận "vài tọa độ còn sai lệch — cần rà". Với cảng đảo xa (Trường Sa/Hoàng Sa) thì thiếu/lệch còn chấp nhận; nhưng cảng đất liền lớn như Sa Kỳ, Sông Gianh, Phú Quý thiếu tọa độ là đáng kể.

> Đối chiếu: `ports.ts` (10 cảng dự báo) **tọa độ ĐÃ kiểm chứng qua Marine API** (mỗi dòng có wave_height) — đáng tin cho việc dự báo. Lỗi tọa độ chỉ ở `fishing-ports.ts`.

### 2b. Khử trùng vựa — ĐÚNG nhưng chưa bị thử

- `wholesalers/index.ts` gộp 6 nguồn = **93 mục**, khử theo key `norm(name)|norm(province)`.
- Regex `norm` (index.ts:25-30) **chạy đúng**: `normalize("NFD")` + strip dải dấu kết hợp → `"Hải sản Hiền Nhung"` → `haisanhiennhung`. Diacritics bị loại sạch.
- **Kết quả: 0 va chạm bị khử** — tức 93 mục đều khác tên+tỉnh. Dedup hoạt động nhưng thực tế chưa có dup nào để khử (3 đợt bổ sung `bs-*` chủ ý nhắm vùng/xã khác). Không có lỗi, nhưng cũng nghĩa là cơ chế dedup chưa được kiểm thử bằng dữ liệu trùng thật.
- **Lưu ý nhẹ:** dedup theo tên+tỉnh chuẩn hóa — nếu cùng một DN ghi 2 tên khác nhau (vd "Bidifisco" vs "Công ty CP Thủy sản Bình Định (BIDIFISCO)") sẽ KHÔNG bị nhận là trùng. Thực tế Bidifisco xuất hiện cả ở `seafood-buyers` (`bidifisco`) và `wholesalers/trung.ts` (`trung-bd-bidifisco`) — 2 bộ khác nhau nên không khử chéo (chấp nhận được vì khác mục đích).

### 2c. Tên tỉnh KHÔNG nhất quán — LỖI (Cao)

Ba cách viết tỉnh cùng tồn tại:

| Bộ | Kiểu tên tỉnh | Ví dụ |
|----|---------------|-------|
| `ports.ts` (10 cảng) | **TÊN CŨ trước sáp nhập** | `Bà Rịa – Vũng Tàu`, `Bình Thuận`, `Bình Định`, `Kiên Giang` |
| `fishing-ports.ts` | Tên mới đầy đủ | `Thành phố Hồ Chí Minh`, `Thành phố Hải Phòng`, `Thành phố Đà Nẵng`, `Lâm Đồng` |
| `seafood-buyers.ts` | Tên mới (gần đủ) | `Thành phố Hồ Chí Minh`, nhưng `Cần Thơ` (thiếu "Thành phố"), `Đồng Nai` |
| `wholesalers/*` | **Trộn cũ + viết tắt** | `TP.HCM`, `Đà Nẵng`, `Hải Phòng`, `Thái Bình`, `Quảng Ninh` |

**Hệ quả cụ thể:**
- `ports.ts` còn dùng tên tỉnh cũ hoàn toàn → header `seafood-buyers.ts` tự nhận "dùng tên SAU sáp nhập để khớp `fishing-ports.ts`", nhưng `ports.ts` (bộ đang thực sự chạy trong app) lại CHƯA đổi. Mâu thuẫn nội bộ.
- `wholesalers` dùng `TP.HCM`/`Đà Nẵng`/`Hải Phòng` còn `fishing-ports`/`buyers` dùng `Thành phố Hồ Chí Minh`/`Thành phố Đà Nẵng`/`Thành phố Hải Phòng` → **4 giá trị tỉnh vựa không khớp chuẩn**. `buyers` dùng `Cần Thơ` còn `fishing-ports` dùng `Thành phố Cần Thơ` → lệch.
- Hiện UI (`sell-guide.tsx`) **không join cảng→vựa theo tỉnh** (chip tỉnh tự sinh từ `provincesWithWholesalers()`), nên đây là **lỗi dữ liệu tiềm ẩn, không crash runtime**. Nhưng ngay khi ai đó viết `wholesalersByProvince(port.province)` thì sẽ trả rỗng cho HCM/ĐN/HP/Cần Thơ.

## 3. Khoảng trống phủ sóng

**Loài không có nhà máy thu mua khớp (6/13 trong `port-prices`):**
`Cá cơm`, `Cá chim trắng biển`, `Ghẹ xanh`, `Cá hố`, `Cá bạc má`, `Cá trích` — `buyersForSpecies()` sẽ trả rỗng.
(Cá cơm thực ra có vựa thu mua làm mắm trong `wholesalers` — Cà Ná, Tịnh Kỳ — nhưng tầng `buyers`/nhà máy không có. Ghẹ/cá hố/cá trích/bạc má hầu như chỉ bán nậu vựa/chợ, hợp lý vì không phải hàng XK.)

**Tỉnh ven biển TRỐNG vựa** (có trong `fishing-ports` nhưng 0 wholesaler): `Quảng Trị`, `Thừa Thiên Huế`, `Ninh Bình`, `Hưng Yên`, `Thành phố Cần Thơ`, `Vĩnh Long`. Vùng Bắc Trung Bộ giữa (Quảng Bình/Quảng Trị/Huế) là lỗ hổng rõ.

**Tỉnh MỎNG vựa (≤3):** `Nghệ An` (3), `Đắk Lắk` (3), `Thái Bình` (2). Header `trung.ts`/`bs-trung.ts` tự thừa nhận "vùng Quảng Ngãi/Ninh Thuận dữ liệu mỏng".

**Buyer mỏng:** chỉ `Gia Lai`, `Đắk Lắk`, `Thanh Hóa` mỗi tỉnh 1 nhà máy; cả dải Bắc Trung Bộ và miền Bắc (trừ Hải Phòng) gần như trắng nhà máy XK.

**Cảng không có vựa/chợ gần:** các cảng ở Quảng Trị, Huế, Ninh Bình, Hưng Yên, Vĩnh Long không có wholesaler cùng tỉnh; chợ đầu mối (`WHOLESALE_MARKETS`, 7 chợ) chỉ phủ HCM, ĐN, HN, Quảng Ninh, Cà Mau — miền Trung ngoài Thọ Quang là trống.

## 4. Nối vào UI (wiring)

| Bộ dữ liệu | Được import? | Ở đâu |
|------------|--------------|-------|
| `ports.ts` | ✅ | `sea.ts`, `fishing-map-view.tsx`, `sea-forecast.tsx`, `route-planner.tsx` |
| `port-prices.ts` | ✅ | `price-board.tsx` |
| `supplies.ts` | ✅ | `supply-catalog.tsx` |
| `fines.ts` | ✅ | `fines-lookup.tsx` |
| `seafood-buyers.ts` | ✅ | `sell-guide.tsx` (tab Nhà máy) |
| `market-channels.ts` | ✅ | `sell-guide.tsx` (tab Kênh/Chợ/Mối quen) |
| `wholesalers/` | ✅ | `sell-guide.tsx` (tab Nậu vựa) |
| **`fishing-ports.ts` (173 cảng)** | ❌ **KHÔNG** | chỉ tự tham chiếu — **BUILT-BUT-UNWIRED** |

- **`fishing-ports.ts` chưa nối vào bất kỳ component nào.** Grep `FISHING_PORTS` chỉ ra duy nhất chính file đó. Bộ 173 cảng chính thức (mã GSTC, loại I/II/III, QĐ công bố) đang nằm chết — người dùng chỉ thấy 10 cảng từ `ports.ts`.
- **sell-guide dùng đúng helper:** `provincesWithWholesalers()`, `wholesalersByProvince()`, `buyersForSpecies()`, `SELL_CHANNELS`, `WHOLESALE_MARKETS`, `SEAFOOD_BUYERS`, `WHOLESALER_KIND_LABEL` đều được dùng đúng. Tab Nậu vựa render SĐT (`tel:`), địa chỉ, nguồn; tab Nhà máy lọc theo loài; tab Chợ/Kênh liệt kê đủ. **Wiring tầng bán hàng đúng.** Không có port→buyer/wholesaler join nên lỗi tên tỉnh chưa lộ trên UI.

## 5. Nhất quán schema

- **`wholesalers/*.ts` đều conform `Wholesaler`** (types.ts). Spot-check 93 mục: chỉ dùng các field `id/name/kind/province/address/phone/species/source/note`. `kind` luôn ∈ {`vua`,`co-so-thu-mua`,`dai-ly`,`nau-vua`} — khớp `WholesalerKind` và `WHOLESALER_KIND_LABEL`. Không thấy field lạ/dùng sai.
- **`phone` đôi khi chứa NHIỀU số** ngăn bằng `/` (vd `qn-hien-nhung`: 4 số). UI gọi `tel:${w.phone.replace(/\s/g,"")}` (sell-guide.tsx:173) → link `tel:` sẽ gồm cả chuỗi nhiều số + dấu `/`, **bấm gọi sẽ sai số**. Lỗi nhẹ trình bày/UX, không phải lỗi schema; nên tách số đầu cho nút Gọi.
- `seafood-buyers` & `market-channels` interface dùng nhất quán; `SavedBuyer` (mối quen) tách riêng, không lẫn dữ liệu công khai. OK.
- `fines`/`supplies`/`port-prices`: field khớp interface, `trend`/`severity`/`category` đúng union. OK.

---

## Punch list dọn dữ liệu (ưu tiên)

**Cao (chặn tin cậy để ship bản đồ cảng):**
1. Sửa 4 tọa độ vỡ: `dao-an-bang`, `dao-phan-vinh`, `dao-da-thuyen-chai` (đang trùng 86.45/111.92), `hon-khoai` (84.37/104.83).
2. Sửa 4 tọa độ lệch tỉnh >500 km: `ca-mau`, `song-tra-bong`, `lach-bang`, `da-bac`.
3. Xóa/sửa bản ghi rác `lach-hoi111`.
4. Chuẩn hóa tên tỉnh MỘT chuẩn (sau sáp nhập) trên `ports.ts`, `wholesalers/*`, `seafood-buyers.ts` (`TP.HCM`→`Thành phố Hồ Chí Minh`; `Đà Nẵng`→`Thành phố Đà Nẵng`; `Hải Phòng`→`Thành phố Hải Phòng`; `Cần Thơ`→`Thành phố Cần Thơ`; tên cũ ở `ports.ts` → mới).

**Trung bình:**
5. Quyết định nối `fishing-ports.ts` (173 cảng) vào UI hoặc đánh dấu rõ là dữ liệu chưa dùng.
6. Bổ tọa độ cho cảng đất liền lớn còn thiếu: Sa Kỳ, Sông Gianh, Đảo Phú Quý… (trong 31 cảng thiếu).
7. Nút "Gọi" (sell-guide.tsx:173): tách số điện thoại đầu khi `phone` chứa nhiều số `/`.

**Thấp (lấp dần, không chặn ship):**
8. Bổ vựa vùng trống: Quảng Trị, Huế, Ninh Bình, Hưng Yên; làm dày Nghệ An/Đắk Lắk/Thái Bình.
9. Bổ SĐT cho 39 vựa còn thiếu (đa số đã ghi lý do trống — chấp nhận, lấp khi xác minh được).
10. Cân nhắc thêm tầng buyer cho ghẹ/cá hố/cá trích (hoặc chấp nhận: các loài này chỉ bán nậu vựa/chợ).

## Phán quyết: độ tin cậy dữ liệu để SHIP

- **Tầng GIÁ / VẬT TƯ / PHẠT / KÊNH BÁN / CHỢ / VỰA / NHÀ MÁY: SHIP ĐƯỢC.** Kỷ luật trung thực vững (nhãn tham khảo + nguồn + không bịa), schema sạch, đã nối UI đúng. Đây là phần lõi giá trị cho bà con và đáng tin ở mức "tham khảo, gọi xác minh" như đã tuyên bố.
- **Tầng 10 cảng dự báo (`ports.ts`): SHIP ĐƯỢC** (tọa độ đã kiểm chứng Marine API), nhưng **phải đổi tên tỉnh sang chuẩn mới** trước khi cross-link với buyer/vựa.
- **Tầng 173 cảng chính thức (`fishing-ports.ts`): CHƯA SHIP-READY.** ~12 tọa độ sai + 31 thiếu + 1 bản ghi rác, và quan trọng nhất là **chưa nối UI** — không nên phơi lên bản đồ cho tới khi dọn tọa độ (punch #1–3) và chuẩn hóa tỉnh (#4).

**Kết luận:** Dữ liệu tổng thể TRUNG THỰC và dùng được cho mục tiêu "tham khảo + tự xác minh". Rào chắn ship duy nhất là **tọa độ `fishing-ports.ts`** và **tên tỉnh không nhất quán** — cả hai đều là dọn dẹp cơ học, không phải vấn đề nguồn/đạo đức dữ liệu.
