# Địa danh ngầm Việt Nam — truy nguồn, lấy, verify (2026-09)

> Lỗ hạng mục #8 của hải đồ tự chủ (tên bãi/đá/rạn): trước đây chỉ 13 tên, TOÀN
> Trường Sa, 0 tên ven bờ. Một bản đồ tham khảo (Leaflet) hiển thị hàng trăm
> địa danh ngầm tiếng Việt ven bờ — núi ngầm, đồi ngầm, hố ngầm, thung lũng
> ngầm, vách đứng ngầm, bãi ven bờ ngầm. Việc: TRUY NGUỒN chính thống → LẤY kèm
> TOẠ ĐỘ → VERIFY → đóng gói cho Lead nối vào bản đồ.

## Kết quả một dòng

Tìm ra **nguồn chính thống có toạ độ**: **Thông tư 33/2024/TT-BTNMT** của Bộ Tài
nguyên và Môi trường, **Mục III — "Đối tượng ngầm dưới đáy biển"**, **184 địa
danh** đầy đủ toạ độ VN-2000. Đã bóc, kiểm và đóng gói vào
`public/data/dia-danh-ngam.v1.json`. Bản đồ tham khảo dùng đúng danh mục này —
9/9 tên mốc trong đề bài trùng khớp nguyên văn + vị trí.

## Phễu nguồn — tìm ở đâu, thấy gì

| # | Hướng tìm | Kết quả |
|---|---|---|
| 1 | "Danh mục địa danh biển đảo VN, Thông tư Bộ TN&MT" | **TRÚNG**: Thông tư **33/2024/TT-BTNMT** (15/12/2024) — "Danh mục địa danh các đảo, đá, bãi cạn, bãi ngầm và một số đối tượng địa lý khác trên vùng biển Việt Nam". Có bản PDF chính thức trên cổng Bộ + toàn văn trên Thư viện pháp luật. **Có toạ độ.** |
| 2 | Tên mốc "núi ngầm Phước Bửu", "đồi ngầm Phước Thuận"… | Không có trang rời; nhưng khi có PDF (1) thì mọi tên này nằm gọn trong **Mục III** của chính Thông tư → xác nhận bản đồ Leaflet lấy từ nguồn (1), không phải tên tự chế. |
| 3 | SCUFN/GEBCO undersea feature names do VN đề xuất | Không cần tới: nguồn (1) đã là danh mục nhà nước, đầy đủ và phủ đúng phần ven bờ đang thiếu. Ghi nhận để sau đối chiếu tên quốc tế nếu cần. |

**Nguồn đã lấy (PDF chính thức, tải 2026-09-03):**
`https://mae.gov.vn/noidung/Lists/VBQPPL/Attachments/514/1_DanhMuc_TT_DiaDanh_BanHanh.pdf`
(144 trang, 4,3 MB). Toàn văn Thông tư: Thư viện pháp luật, "Thông tư 33/2024/TT-BTNMT".

## Cấu trúc nguồn

Bảng gốc có các cột: **TT · Tên địa danh · Tên tỉnh/TP trực thuộc TW · Toạ độ
VN-2000 (Vĩ độ, Kinh độ — Độ Phút Giây)**. Ba khối lớn:

- **A. KHU VỰC VEN BỜ** — I. Đối tượng tự nhiên (hàng nghìn Hòn/Cồn/Bãi/Đá/Mũi
  ven bờ, có tỉnh) · II. Đối tượng nhân tạo · **III. Đối tượng ngầm dưới đáy
  biển** (184 mục — đây là phần lấy).
- **B. QUẦN ĐẢO HOÀNG SA** · **C. QUẦN ĐẢO TRƯỜNG SA**.

**Chỉ lấy Mục A.III** cho file này — đó chính là "địa danh ngầm" ven bờ đang
thiếu, tự khoanh vùng rõ ràng, và KHÔNG chồng lấn với lớp rạn/đảo (coral-reefs /
reef-shapes / vn-islands do agent khác giữ, chủ yếu Hoàng Sa/Trường Sa).

## Bóc dữ liệu — cách làm và bẫy đã gặp

- **PDF dùng font nhúng không map Unicode chuẩn**: `pdftotext -layout` cho ra
  tiếng Việt MẤT DẤU ("Hòn Đá Lớn" → "H�n T Ln", "Quảng Ninh" → "Qung Ninh").
  KHÔNG dùng được. **`pypdf`** giải mã ĐÚNG Unicode ("Hòn Tổ Lợn", "Quảng
  Ninh") — dùng pypdf để bóc.
- **Bẫy lọc nhiễu**: dòng tiêu đề bảng có mảnh chữ "ương" (từ "trực thuộc trung
  ương" bị ngắt dòng). Lọc bằng `substring "ương"` sẽ NUỐT nhầm tên thật chứa
  "ương" (Lương Sơn, Vĩnh Lương, Xuân Phương, Vĩnh Phương → mất TT 17, 43, 74,
  81). Phải lọc **khớp cả dòng**, không substring. Sau khi sửa: đủ 184/184.
- **Tên ngắt dòng** ("Thung lũng ngầm Bình / Minh") được nối lại bằng cách gộp
  buffer cho tới khi thấy đủ cặp toạ độ.
- Bản chép nguyên văn 184 dòng đã kiểm được **nhúng thẳng vào**
  `scripts/generate-dia-danh-ngam.mjs` → tái lập không cần PDF, không cần
  Python, không thêm dep (nguồn = "authored", JSON = "generated"). Danh mục nhà
  nước đã đóng (ban hành 1 lần) nên KHÔNG tải lúc build (CLAUDE.md §chống phình,
  quy tắc 3).

## Verify vị trí

- **100% (184/184) toạ độ lọt khung biển VN** (`KHUNG_BIEN_VN` s4/w102/n24/e118).
  Dải thực tế: **6,79–16,23°N · 109,50–114,48°E** — đúng thềm/sườn lục địa và
  Biển Đông của Việt Nam.
- **0 toạ độ trùng nhau** (mỗi đối tượng một chỗ).
- **Đối chiếu với bản đồ tham khảo**: 9/9 tên mốc trong đề bài có mặt và trùng
  vị trí — Núi ngầm Phước Bửu (9,71°N/109,98°E), Đồi ngầm Phước Thuận, Núi ngầm
  Lộc An, Hố ngầm Hòa Bình, Thung lũng ngầm Việt Thắng, Vách đứng ngầm Long
  Điền, Bãi ven bờ ngầm Vĩnh Bình, Đồi ngầm Cam Đức, Núi ngầm Vạn Giã.

### ⚠️ Đính chính giả định "đặt tên theo xã ven bờ ⇒ nằm ngoài khơi xã đó"

Đề bài gợi ý dùng phép này để sàng lỗi vĩ độ. **Phép này KHÔNG đúng cho Mục
III.** Các đối tượng ĐƯỢC ĐẶT TÊN theo xã/phường ven bờ, nhưng nằm **sâu ngoài
khơi**, thường cách xã cùng tên **hàng trăm km**:

- "Núi ngầm Vạn Giã" ở **9,35°N**, còn xã Vạn Giã (Khánh Hoà) ở **~12,7°N** —
  lệch ~370 km về nam.
- "Núi ngầm Lộc An" ở **9,29°N/110,22°E**, còn xã Lộc An (BR-VT) ở ~10,45°N/107,4°E.

Đây là **hệ đặt tên** (mượn địa danh đất liền cho thực thể đáy biển), không phải
lỗi. Vì thế **KHÔNG nắn/loại theo vĩ độ xã**; toạ độ lấy NGUYÊN từ Thông tư,
verify bằng (a) lọt khung biển VN và (b) trùng khớp bản đồ tham khảo.

### Datum

Nguồn là **VN-2000** (Độ Phút Giây, độ phân giải ~1 giây ≈ 30 m). Bản đồ dùng
WGS84/EPSG:4326; sai khác VN-2000 ↔ WGS84 dưới vài mét ở tỉ lệ hiển thị →
**coi VN-2000 như WGS84**, không nắn lưới. Ghi trong `## Assumptions` của
`src/lib/dia-danh-ngam.ts`.

## Đếm — theo loại

Tổng **184**. Phân theo mã loại (`src/lib/dia-danh-ngam.ts`):

| Mã | Loại (nhãn) | Số |
|---|---|---:|
| doi | Đồi ngầm (gồm "Các đồi ngầm") | 85 |
| nui | Núi ngầm (gồm "Mũi núi ngầm") | 57 |
| song | Sống núi ngầm | 11 |
| hem | Hẻm núi ngầm (gồm "Các hẻm núi ngầm") | 7 |
| thunglung | Thung lũng ngầm | 6 |
| ho | Hố ngầm | 4 |
| day | Dãy / Chuỗi núi ngầm | 3 |
| guyot | Núi chóp phẳng ngầm | 3 |
| vach | Vách đứng ngầm | 3 |
| baivenbo | Bãi ven bờ ngầm | 2 |
| doc | Dốc ngầm | 1 |
| deo | Đèo ngầm | 1 |
| kenh | Kênh ngầm | 1 |

## Đếm — theo tỉnh

**Không gán tỉnh.** Mục III trong nguồn KHÔNG có cột tỉnh (khác Mục A.I ven bờ,
có tỉnh) — vì đây là thực thể **ngoài khơi sâu**, ngoài vùng nước hành chính của
tỉnh nào. Không suy tỉnh từ tên (xem đính chính ở trên: tên xã chỉ là cách đặt
tên, không phải vị trí). `tỉnh liên quan` = null cho toàn bộ.

## Cái gì bỏ + vì sao

- **Mục A.I (Hòn/Cồn/Bãi/Đá ven bờ, hàng nghìn mục)**: KHÔNG lấy vào file này —
  chúng là địa danh NỔI/ven bờ, không phải "ngầm". Là mỏ vàng riêng cho lỗ #8
  phần ven bờ NỔI; đề xuất tách file khác (vd `dia-danh-ven-bo`) nếu Lead cần.
- **Mục A.I có "Bãi ngầm"/"Bãi cạn"**: một số bãi chìm nằm lẫn trong A.I (có
  tỉnh). Không lấy đợt này để tránh phải lọc theo tiền tố tên giữa hàng nghìn
  mục và tránh chồng lấn coral-reefs; ghi nhận để mở rộng sau nếu cần.
- **Mục B (Hoàng Sa) + C (Trường Sa)**: KHÔNG lấy — chồng lấn lớp đảo/rạn của
  agent khác và Trường Sa đã có 13 tên. (Ghi nhận: đây là nguồn nhà nước TỐT
  cho tên Hoàng Sa/Trường Sa nếu muốn thay bộ 13 tên hiện tại bằng danh mục đầy
  đủ hơn — việc của Lead, cần đối chiếu ownership.)
- **0 dòng bị bỏ trong Mục III**: cả 184 đều có tên sạch (0 CJK), toạ độ hợp lệ,
  lọt khung biển VN.

## Schema file — để Lead nối lớp

`public/data/dia-danh-ngam.v1.json` (8,3 KB) — bảng tra loại + mảng số:

```json
{
  "v": 1,
  "vanBan": "Thông tư 33/2024/TT-BTNMT",
  "nguon": "Bộ TN&MT — Danh mục địa danh ... Mục III (Đối tượng ngầm dưới đáy biển)",
  "banHanh": "2024-12-15",
  "datum": "VN-2000",
  "layNgay": "2026-09-03",
  "loai": ["nui","doi","song","day","guyot","ho","thunglung","hem","vach","doc","deo","kenh","baivenbo"],
  "diaDanh": [ [lon, lat, loaiIndex, "Tên đầy đủ"], ... ]   // 184 hàng
}
```

Đọc bằng `fetchDiaDanhNgam()` / `decodeDiaDanhNgam()` trong
`src/lib/dia-danh-ngam.ts` → trả `DiaDanhNgam[]` `{ lon, lat, loai, ten }`. Nhãn
tiếng Việt loại: `DIA_DANH_NGAM_LABEL` / `nhanLoaiDiaDanhNgam()`. Decoder bỏ
hàng hỏng + lọc ngoài khung biển VN (cùng luật `decodeVnAids`), fetch có timeout
20s + xoá cache khi lỗi (an toàn offline).

**Việc còn lại của Lead** (ngoài phạm vi file này): nối lớp vào MapLibre (nhãn +
ký hiệu theo `loai`), thêm vào danh sách cache `public/sw.js` (offline), cập
nhật `docs/app-map/02-architecture.md` + `07-design-spec.md` + `04-data-model.md`
theo invariant doc-sync khi commit, và cập nhật bộ tự kiểm hải đồ (hạng mục #8).

## Nghiệm thu (đã chạy)

- `node scripts/generate-dia-danh-ngam.mjs` → 184 xuất, 0 bỏ, 8,3 KB.
- `npm test` (bộ đầy đủ): **185 file · 3215 test xanh** (12 test mới của lớp này).
- `npx tsc --noEmit`: sạch.
- `node scripts/audit-names.mjs --file public/data/dia-danh-ngam.v1.json`: **SẠCH**
  (0 CJK, 0 tên nước ngoài).
- `sh .githooks/pre-commit --self-test`: **PASS**.
- File 8,3 KB ≤ 20 MB. **KHÔNG git add/commit/push.**
