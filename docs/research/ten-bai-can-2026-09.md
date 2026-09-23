# Khai tên bãi cạn / bãi đá / đá / rạn / cồn ven mặt — 2026-09-03

> **Kết quả vòng này: +1.361 tên vào `coral-reefs.v1.json`** (13 → **1.374**),
> khai từ **Thông tư 33/2024/TT-BTNMT** (Bộ TN&MT), họ thực thể NỔI/rạn ven mặt
> (BÃI CẠN · BÃI ĐÁ · ĐÁ · RẠN/SAN HÔ · CỒN/BÃI) ở ba mục **A.I (ven bờ) + B
> (Hoàng Sa) + C (Trường Sa)**. Thước hạng mục #8 "0 rạn ven bờ có tên" — **đóng**.
>
> Đây chính là **khuyến nghị #2 của vòng trước** (xem §"Vòng trước" bên dưới):
> thêm tên bằng **điểm độc lập trong `coral-reefs.v1.json`** thay vì cố dán nhãn
> lên hình `reef-shapes` có sẵn. Nguồn tên lần này là danh mục nhà nước có toạ
> độ, không cần khớp vào polygon nào.

Sở hữu vòng này: `public/data/coral-reefs.v1.json` (mở rộng) ·
`scripts/generate-coral-reefs.mjs` (viết lại) · `src/lib/__tests__/reefs.test.ts`
(siết ngưỡng). KHÔNG đụng `fishing-map-view`/`ocean-map`/`sw` (Lead kiểm hiển thị)
và các file nhóm khác (`vn-islands.*`, `dia-danh-ngam.*`, `reef-shapes.*`, `tide-*`…).

---

## 1. Nguồn & pipeline (lặp lại đúng pipeline `dia-danh-ngam`)

- **Nguồn**: Thông tư 33/2024/TT-BTNMT, 15/12/2024 — "Danh mục địa danh các đảo,
  đá, bãi cạn, bãi ngầm và một số đối tượng địa lý khác trên vùng biển Việt Nam".
  PDF chính thức (144 trang, 4,3 MB), tải 2026-09-03:
  `https://mae.gov.vn/noidung/Lists/VBQPPL/Attachments/514/1_DanhMuc_TT_DiaDanh_BanHanh.pdf`
- **Bóc**: `pypdf` (giữ ĐÚNG dấu tiếng Việt — `pdftotext` mất dấu, đã ghi trong
  `dia-danh-ngam-2026-09.md`). Bảng gốc: `TT · Tên · Tỉnh/TP · Toạ độ VN-2000
  (Vĩ độ, Kinh độ — Độ Phút Giây)`.
- **Tách record**: regex toàn cục theo neo toạ độ DMS + danh sách tỉnh (xử lý
  tên tràn dòng và hàng liên tỉnh "Prov1 - Prov2"). Kiểm hoàn chỉnh bằng TT liên
  tục: A.I `1..5234` (5.234), B `1..50`, C `1..133` — không thiếu số nào.
- **DMS → thập phân**: `round(d + m/60 + s/3600, 5)`. Coi VN-2000 ≈ WGS84 ở tỉ lệ
  hiển thị (lệch dưới vài mét).
- **Chép nguồn vào `scripts/generate-coral-reefs.mjs`** (authored source, mỗi dòng
  `Tên|lat|lon|Mục|Tỉnh`) → tái lập KHÔNG cần PDF/Python/dep, KHÔNG tải lúc build
  (CLAUDE.md §chống phình quy tắc 3). Điều 15 Luật SHTT loại "văn bản hành chính"
  / "số liệu" khỏi bảo hộ — địa danh nhà nước công bố công khai.

## 2. Họ được lấy vs cố ý chừa

| Lấy (họ NỔI/rạn ven mặt) | Chừa |
|---|---|
| Tiền tố **Đá** → `da`; **Bãi/Bãi cạn/Bãi đá/Bãi ngầm** → `bai`; **Cồn** → `con`; **Rạn/San hô** → `ran` | **Hòn/Đảo/Cù Lao/Cụm/Quần đảo/Bán đảo** — thực thể NỔI lên được → `vn-islands.v1.json` (nhóm khác) |
| | **Mũi/Vụng/Vũng/Cửa/Vịnh/Ghềnh/Gành/Lạch/Đầm/Eo/Mỏm/Núi/Tùng/Chương…** — không thuộc họ rạn/bãi |
| | **A.II** (nhân tạo) và **A.III** (đối tượng NGẦM sâu) — A.III đã là `dia-danh-ngam.v1.json` (núi/đồi/hố/thung lũng ngầm). Không chồng lấn. |

## 3. Đếm — thêm được bao nhiêu

Tổng **1.374** (13 cũ + 1.361 mới).

| Nhóm (`group`) | Số (gồm cũ) | Ghi chú |
|---|---:|---|
| ven-bo | 1.225 | A.I; `admin` = tên tỉnh nguồn (28 tỉnh/TP ven biển) |
| truong-sa | 106 | Mục C (7 cũ + 99 mới) · `admin` "tỉnh Khánh Hòa" |
| hoang-sa | 28 | Mục B (mới) · `admin` "TP Đà Nẵng" |
| them-luc-dia | 15 | cụm DK1 (6 cũ + 9 mới) · `admin` "Thềm lục địa phía Nam" |

| Loại (`type`) | Số |
|---|---:|
| bai (bãi cạn/bãi đá/bãi ngầm/bãi) | 650 |
| da (đá) | 390 |
| con (cồn) | 293 |
| ran (rạn/san hô) | 41 |

**ven-bo theo tỉnh (top)**: Quảng Ninh 334 · Kiên Giang 121 · Khánh Hòa 89 ·
Quảng Ngãi 68 · Bình Định 68 · Hải Phòng 58 · Bình Thuận 49 · Bà Rịa-Vũng Tàu 41…

**Mốc kiểm chéo (đề bài)**: Đá Chữ Thập, Đá Châu Viên, Bãi đá Tây, Đá Đông, Đá
Lát (Trường Sa) · Đá Ba Kè, Bãi Trường Tiền, Bãi Kim Phụng, Bãi Ngự Bình (DK1) ·
Bãi Ngự Bình (Hoàng Sa, một tên khác cùng chữ) — **tất cả có mặt, đúng nhóm**.

## 4. Nhóm DK1 / thềm lục địa nằm trong Mục A.I

Cụm nhà giàn DK1 (Tư Chính, Phúc Tần, Ba Kè, Vũng Mây, Ngự Bình, Kim Phụng,
Trường Tiền…) trong TT33 xếp ở **A.I** dưới tỉnh "Bà Rịa - Vũng Tàu", nhưng địa
lý ở thềm lục địa phía Nam (~7–8°B/109,7–111,8°Đ), KHÔNG thuộc quần đảo Trường
Sa. Tách `group=them-luc-dia` bằng **hộp toạ độ** (lat 6,5–8,75 / lon
109,3–112,3) để đồng bộ 6 mục DK1 cũ; ngoài hộp = `ven-bo`. Hộp không cắn nhầm
ven bờ Nam Bộ (kinh độ < 109,3).

## 5. Khử trùng — cái gì bỏ, vì sao

- **So 13 mục cũ** (cùng tên-lõi + cách < 1,5° ⇒ MỘT thực thể, GIỮ mục cũ, BỎ
  bản TT33): **11 mục bỏ** — Phúc Tần, Huyền Trân, Phúc Nguyên, Tư Chính, Quế
  Đường, Vũng Mây (DK1: cũ "Bãi X" ↔ TT33 "Bãi cạn X"); An Nhơn (TT33 "Đá An
  Nhơn" ↔ cũ "Bãi An Nhơn"); Ga Ven, Én Đất, Ken Nan, Ba Đầu (Trường Sa, trùng
  khít). "Đá An Nhơn Nam/Bắc" là thực thể KHÁC, GIỮ.
- **Nội bộ TT33** (trùng đúng-tên + cách < 2 km): **0 mục**.
- **So `dia-danh-ngam.v1.json`** (đối tượng ngầm, đúng-tên): **0 trùng**.
- **Thiếu toạ độ**: 0 — mọi dòng lấy đều có đủ DMS hợp lệ, 100% lọt khung biển VN.

### ⚠️ Nợ cho Lead — toạ độ "Bãi Vũng Mây" cũ lệch ~103 km

Mục cũ **"Bãi Vũng Mây" [7,758 / 110,691]** lệch **~103 km** so với toạ độ chính
thức TT33 **"Bãi cạn Vũng Mây" [7,897 / 111,607]** — nhiều khả năng toạ độ cũ
(nguồn Wikipedia) **SAI** (rơi gần Huyền Trân). Đã **giữ mục cũ** theo yêu cầu
"giữ 13", nhưng **đề nghị Lead sửa về toạ độ TT33**. Các cặp DK1 khác lệch
1–11 km (chấp nhận). Đây là tín hiệu: bộ 13 cũ (Wikipedia) nên rà lại theo TT33.

## 6. Cổng chủ quyền (đã chạy sạch)

- `node scripts/audit-names.mjs --file public/data/coral-reefs.v1.json` → **SẠCH**
  (0 CJK, 0 tên nước ngoài).
- Kiểm nội bộ khi sinh: 0 tên chứa Hán/CJK; 0 tên khớp regex `reef|bank|shoal|
  cay|island|thomas|vanguard|whitsun`; 0 chữ cái ngoài bảng tiếng Việt; 100%
  toạ độ trong khung biển VN (4–24°B / 102–118°Đ).

## 7. LƯU Ý HIỂN THỊ — Lead cân nhắc

Lớp nhảy **13 → 1.374 điểm** (1.225 ven bờ). Trong `fishing-map-view`:
- `reef-label` (symbol) tự né nhau (`text-allow-overlap:false`, `text-optional:
  true`) + `symbol-sort-key = rank` → nhãn offshore (rank 2) thắng ven-bờ (rank
  3) khi chật. **Ổn tự động.**
- `reef-dot` (circle) **KHÔNG có collision** → **mọi chấm đều vẽ ở mọi zoom**. Ở
  mức zoom cả nước, ~1.225 chấm ven bờ sẽ thành dải dày sát bờ.
- **Khuyến nghị**: đặt `minzoom` cho `reef-dot` (hoặc tách filter theo `rank`/
  `group`) để dải ven bờ chỉ hiện khi zoom sâu (vd z ≥ 8), giữ nhìn offshore
  gọn. Việc này thuộc `fishing-map-view` (Lead) — file dữ liệu đã sẵn.
- Cỡ file: **239 KB** (≤ trần 20 MB). Không ảnh hưởng ngân sách offline đáng kể.

## 8. Rank

- `ven-bo` → **rank 3** (chỉ ló khi zoom sâu / khi còn chỗ).
- `hoang-sa` · `truong-sa` · `them-luc-dia` → **rank 2** (ưu tiên hiện — tên chủ
  quyền offshore). 13 mục cũ giữ nguyên rank sẵn có (2/3).

---

## Vòng trước (2026-09-03, cùng ngày) — cách tiếp cận KHÁC, kết quả 0

Vòng trước thử **dán nhãn lên hình polygon có sẵn** trong `reef-shapes.v1.json`
(luật "một hình một tên, không khớp thì không thêm") → **0 tên thêm** vì bốn tên
xác minh được (Pernambuco, Gành Đá Đĩa, Hòn Tai, Hòn Dài) không có hình nào đủ
gần. Phát hiện phụ vẫn còn giá trị và KHÔNG bị vòng này thay thế:

- **`reef-shapes.v1.json` (Allen Coral Atlas/WCMC) vắng mặt ở đúng nơi san hô VN
  nổi tiếng** (Cù Lao Chàm — Hòn Tai/Hòn Dài không có hình trong bán kính 40 km).
- **"299 hình ven bờ" đo sai** — ~67% thuộc vùng biển Malaysia/Campuchia/Hải Nam;
  bất kỳ ai định khớp tên vào `reef-shapes` phải lọc theo đường bờ VN thật trước.
- **`vn-aids.names` không mang tên bãi** (toàn số hiệu tuyến luồng).
- Bốn tên xác minh (Pernambuco, Gành Đá Đĩa, Hòn Tai, Hòn Dài): vẫn nên thêm —
  nhưng chúng KHÔNG có trong TT33 A.I/B/C họ đang lấy (Pernambuco/Gành Đá Đĩa là
  tên trong Thông báo hàng hải; Hòn Tai/Hòn Dài là "Hòn" → đảo, thuộc vn-islands).
  Để lại cho vòng bổ sung riêng.

## 9. Khử trùng `vn-islands` ↔ `coral-reefs` (2026-09-03, review A.5 / A.8-6)

> Reviewer đếm **27 tên** có ở cả hai file → cùng một chỗ vừa **chấm navy + tên
> navy** (lớp đảo, không gate) vừa **chấm teal + tên teal** (lớp rạn, z7); nhãn
> nào thắng va chạm tuỳ zoom nên "Đá Lớn" đổi màu theo mức phóng.

**Luật chốt — theo BẢN CHẤT, không theo file nào có trước:**

| Thực thể | Ở đâu | Vì sao |
|---|---|---|
| NGẦM / rạn / bãi cạn (tiền tố **Đá**, **Bãi**) | **chỉ `coral-reefs`** | toạ độ TT33 chính thức thắng Wikipedia; Lead vẽ icon theo `type` (da/bai/con/ran) |
| NỔI lên được (đảo, **Hòn**, **Cồn cát** nổi quanh năm) | **chỉ `vn-islands`** | bà con lên được, là "đảo" theo nghĩa đời thường |
| Hai vật khác cùng tên, cách > 2 km | giữ cả hai | đã kiểm: 4 cặp xa 670–1.136 km (Bãi Bình Sơn Ninh Thuận, Đá Bắc Trường Sa, Đá Lồi Cà Mau, Bãi Ngự Bình DK1) — đều **trong nội bộ `coral-reefs`**, không trùng file |

Ngưỡng "cùng thực thể": cùng tên (chuẩn NFC, không phân biệt hoa/thường) **và
< 2 km**; nới tới **≤ 2,8 km** khi cùng group + cùng tên và thực thể là rạn cỡ
km (Bông Bay ~15 km dài, Lồi, Đèn Pha) — chênh 2–3 km là sai số hai nguồn
(Wikipedia ↔ TT33), không phải hai rạn.

### 9.1 Bảng quyết định — 27 tên trùng đúng chữ

| # | Tên | islands (type/group) | reefs (type/group) | Cách | Quyết định |
|---|---|---|---|---|---|
| 1 | Đá Bông Bay | da/hoang-sa | da/hoang-sa | 2,3 km | rút khỏi islands |
| 2 | Cồn cát Nam | con/hoang-sa | con/hoang-sa | 0,6 km | **rút khỏi reefs** (cồn cát nổi) |
| 3 | Cồn cát Tây | con/hoang-sa | con/hoang-sa | 0,3 km | **rút khỏi reefs** (cồn cát nổi) |
| 4 | Bãi Bình Sơn | bai/hoang-sa | bai/hoang-sa | 1,2 km | rút khỏi islands |
| 5 | Bãi Châu Nhai | bai/hoang-sa | bai/hoang-sa | 0,9 km | rút khỏi islands |
| 6 | Bãi Quảng Nghĩa | bai/hoang-sa | bai/hoang-sa | 0,3 km | rút khỏi islands |
| 7 | Bãi Thủy Tề | bai/hoang-sa | bai/hoang-sa | 1,2 km | rút khỏi islands |
| 8 | Đá Bắc | da/hoang-sa | da/hoang-sa | 1,5 km | rút khỏi islands (Đá Bắc Trường Sa là vật khác, 698 km, giữ) |
| 9 | Đá Chim Én | da/hoang-sa | da/hoang-sa | 2,0 km | rút khỏi islands |
| 10 | Đá Hải Sâm | da/hoang-sa | da/hoang-sa | 0,6 km | rút khỏi islands |
| 11 | Đá Lồi | da/hoang-sa | da/hoang-sa | 2,3 km | rút khỏi islands (Đá Lồi Cà Mau là vật khác, 1.136 km, giữ) |
| 12 | Đá Trà Tây | da/hoang-sa | da/hoang-sa | 0,1 km | rút khỏi islands |
| 13 | Bãi Đèn Pha | bai/hoang-sa | bai/hoang-sa | 2,8 km | rút khỏi islands |
| 14 | Bãi Ngự Bình | bai/hoang-sa | bai/hoang-sa | 0,6 km | rút khỏi islands (Bãi Ngự Bình DK1 là vật khác, 977 km, giữ) |
| 15 | Bãi Xà Cừ | bai/hoang-sa | bai/hoang-sa | 0,7 km | rút khỏi islands |
| 16 | Đá Lát | da/truong-sa | da/truong-sa | 0,6 km | rút khỏi islands |
| 17 | Đá Đông | da/truong-sa | da/truong-sa | 0,0 km | rút khỏi islands |
| 18 | Đá Lớn | da/truong-sa | da/truong-sa | 0,0 km | rút khỏi islands |
| 19 | Đá Nam | da/truong-sa | da/truong-sa | 0,3 km | rút khỏi islands |
| 20 | Đá Núi Le | da/truong-sa | da/truong-sa | 0,0 km | rút khỏi islands |
| 21 | Đá Tiên Nữ | da/truong-sa | da/truong-sa | 0,0 km | rút khỏi islands |
| 22 | Đá Cô Lin | da/truong-sa | da/truong-sa | 0,3 km | rút khỏi islands |
| 23 | Đá Len Đao | da/truong-sa | da/truong-sa | 0,1 km | rút khỏi islands |
| 24 | Đá Chữ Thập | da/truong-sa | da/truong-sa | 0,4 km | rút khỏi islands |
| 25 | Đá Gạc Ma | da/truong-sa | da/truong-sa | 1,3 km | rút khỏi islands |
| 26 | Đá Xu Bi | da/truong-sa | da/truong-sa | 0,8 km | rút khỏi islands |
| 27 | Đá Vành Khăn | da/truong-sa | da/truong-sa | 0,3 km | rút khỏi islands |

### 9.2 Bổ sung — 6 cặp trùng thực thể nhưng KHÁC tiền tố (reviewer đếm đúng-chữ nên không thấy)

| Tên islands | Tên reefs (TT33) | Cách | Quyết định |
|---|---|---|---|
| Bãi Gò Nổi | Bãi cạn Gò Nổi | 0,6 km | rút khỏi islands |
| Bãi Ốc Tai Voi | Bãi ngầm Ốc Tai Voi | 2,2 km | rút khỏi islands |
| Đá Tây | Bãi đá Tây | 0,7 km | rút khỏi islands |
| Đá Thị | Đá Núi Thị | 0,2 km | rút khỏi islands |
| Đá Tốc Tan | Bãi đá Tốc Tan | 0,0 km | rút khỏi islands |
| Bãi Thuyền Chài | Bãi đá Thuyền Chài | 2,2 km | rút khỏi islands (rạn dài ~30 km) |

**Giữ nguyên, không phải trùng**: `Hòn Tháp` (islands, đá nổi ~5 m) ↔ `Đá Hòn
Tháp Bắc` (reefs, 2,2 km) — hai vật, tên khác; `Cồn cát Bắc`/`Cồn cát Trung`
(islands) ↔ `Bãi Cát Trung`/`Bãi Cát Nam` (reefs, bãi ngầm cạnh cồn, TT33 tách
tên) — hai vật, `type` khác (con vs bai).

### 9.3 Kết quả

| File | Trước | Sau | Ghi chú |
|---|---:|---:|---|
| `coral-reefs.v1.json` | 1.374 | **1.372** | −2 cồn cát nổi (`GIU_O_ISLANDS` trong generator; dòng TT33_RAW giữ nguyên văn). hoang-sa 28 → 26; con 293 → 291 |
| `vn-islands.v1.json` | 103 | **72** | −31 (25 đúng tên + 6 khác tiền tố). Còn: ven-bo 42 · hoang-sa 21 (16 đảo + 4 cồn cát + Hòn Tháp) · truong-sa 9 đảo nổi. `type`: dao 60 · quan-dao 7 · con 4 · da 1 |

Giao tên hai file sau khử: **0** (cổng test `reefs.test.ts`: đúng-chữ = 0 **và**
cùng tên-lõi trong 2,5 km với type da/bai = 0 → sinh lại file nào cũng bị bắt).

### ⚠️ Nợ cho Lead — `scripts/generate-islands.mjs` chưa biết danh sách rút

Teammate dữ liệu KHÔNG sở hữu `generate-islands.mjs` nên chỉ sửa file phát
`vn-islands.v1.json`. Chạy lại generator đó sẽ **tái sinh 31 mục** → test
`reefs.test.ts` đỏ ngay (đó là chủ ý). Việc cần làm (nhỏ): thêm vào generator
một `Set` loại trừ 31 tên ở §9.1 (trừ #2, #3) + §9.2 trước khi ghi file, giữ
dòng nguồn để truy nguồn. Ngưỡng `islands.test.ts` đã hạ theo (hoang-sa ≥18,
truong-sa ≥8, tổng ≥65).

## Assumptions

- VN-2000 ≈ WGS84 ở tỉ lệ hiển thị (không nắn lưới) — giống `dia-danh-ngam`.
- `Bãi đá X` xếp `type=bai` (không tách `da` riêng) — cùng ký hiệu chấm/nhãn với
  các "Bãi" khác; phân biệt tinh hơn không đổi cách bà con đọc bản đồ.
- Hộp DK1 (6,5–8,75°B / 109,3–112,3°Đ) chọn để phủ đúng cụm nhà giàn + đồng bộ
  6 mục cũ; nếu TT33 sau này thêm bãi thềm lục địa ngoài hộp, chỉnh hộp là đủ.
- Với 11 cặp trùng, GIỮ mục cũ (theo yêu cầu "giữ 13") kể cả khi tên TT33 chính
  thức hơn ("Bãi cạn X" vs "Bãi X") — trừ nợ Vũng Mây đã nêu ở §5.

## Cách chạy lại

```
node scripts/generate-coral-reefs.mjs                 # sinh lại từ nguồn đã chép
node scripts/audit-names.mjs --file public/data/coral-reefs.v1.json
npx vitest run src/lib/__tests__/reefs.test.ts
```

**Người thực hiện**: teammate "TÊN BÃI CẠN" · **Ngày**: 2026-09-03
