# Luật rà soát tên thực thể Hoàng Sa / Trường Sa cho lớp độ sâu rạn (2026-10-22)

> Anh Long: *"đưa 35 cái tổ chức 1 logic để rà soát đi, chọn đúng tên tiếng Việt cho nó, không thì dùng tên chung là rạn hay đảo thôi, đừng để tên"*. Luật này áp cho MỌI dòng `can-nguoi` của `ten-viet.mjs`, và là luật chung cho mọi lần thêm thực thể sau này. Sai một tên là sai chủ quyền; **không bao giờ** để tên nước ngoài (Anh, pinyin, Hán) lọt ra sản phẩm — kể cả trong ngoặc.

## Bước 1 — Xác định LOẠI từ hậu tố tên nguồn (chỉ để biết loại, không lấy tên)

| Hậu tố nguồn | Loại tiếng Việt | Dùng làm tên chung |
|---|---|---|
| Island, Islet, Dao, Yu | đảo | "Đảo" |
| Cay, Sand, Sand Cay, Shazhou | cồn cát | "Cồn cát" |
| Reef, Jiao, Rock | đá (rạn) | "Đá" |
| Shoal, Bank, Tan, Ansha | bãi (bãi cạn / bãi ngầm) | "Bãi" |
| Atoll, Reefs, Banks, Qunjiao | cụm / rạn vòng | "Cụm đá" |

## Bước 2 — Tìm TÊN RIÊNG tiếng Việt, theo bậc bằng chứng (dừng ở bậc đầu tiên đạt)

| Bậc | Điều kiện chấp nhận | Kết quả |
|---|---|---|
| A | Bảng tra `ten-ran-bien-dong.json` có dòng `duyet: true`, tên lõi khớp, **toạ độ ≤ 5 km**, **loại khớp** (đảo ≠ đá ≠ bãi) | tên riêng |
| B | ≥ 2 nguồn độc lập (Wikipedia VI bài riêng có toạ độ trong infobox · Wikipedia EN danh sách · Wikidata P625 · văn bản UBND/Bộ TN&MT/Hải quân) cùng cho MỘT tên Việt, toạ độ của ít nhất một nguồn ≤ 5 km tâm bộ dữ liệu, loại khớp | tên riêng |
| C | 1 nguồn, hoặc 2 nguồn nhưng toạ độ 5–20 km, hoặc loại không khớp (nguồn gọi "Island" nhưng tên Việt là "Đá …") | **KHÔNG nhận** → sang bước 3; ghi ứng viên vào `ghi` để người xem sau |
| — | Không nguồn nào | sang bước 3 |

Cấm: suy tên từ nghĩa chữ Hán (Bei = Bắc) rồi ghép "Đá Bắc" — đã có hai Đá Bắc cách nhau 600 km; cấm dịch tên tiếng Anh (Central Reef ≠ "Đá Trung"); cấm lấy tên thực thể gần nhất trong cụm (lỗi đã dính: Đảo Bắc → Đá Trương Nghĩa).

### Bổ sung sau lượt rà 35 dòng (agent 2026-10-22 — chờ anh Long xác nhận)
- **Thực thể là cả CỤM** (nguồn vẽ một polygon cho Tizard Bank, Union Banks, Loaita, Yongle): bậc A/B dùng **hộp bao của cụm** thay cho 5 km; tên = tên cụm tiếng Việt ("Cụm Nam Yết", "Cụm Sinh Tồn", "Cụm Loại Ta", "Nhóm Lưỡi Liềm"). Bước 5 cho phép chữ đầu "Nhóm".
- **Cồn cát ↔ đảo** coi là cùng lớp khi nguồn đã định đúng thực thể (Sơn Ca, Sinh Tồn Đông, Trường Sa Đông là cồn cát/đảo nhỏ, nguồn gọi "Sand"/"Reef").
- Kết quả lượt 2026-10-22: 7 A · 13 B · 15 tên chung — `quyet-dinh-ten.json`, lý do từng dòng ở `quyet-dinh-ten.ghi-chu.md`. 5 ca agent đề nghị anh xem: East Island (= Đảo Linh Côn về tên nhưng tâm cách 13,5 km — nghi polygon là cả rạn vòng), Longxia (Đá Vị Khê hay Đá Bia — mâu thuẫn nguồn), Yinyuzi/Kuangzi (1 nguồn), và hai bổ sung luật ở trên.

## Bước 3 — TÊN CHUNG (khi không có tên riêng đạt bậc A/B)

Khuôn: `<Loại> chưa định danh` + ngữ cảnh địa lý tiếng Việt đã chắc chắn, theo thứ tự ưu tiên:
1. **cụm/nhóm** đã có tên Việt nếu tâm nằm trong hộp bao của cụm (nhóm An Vĩnh, nhóm Lưỡi Liềm, cụm Song Tử, cụm Thị Tứ, cụm Loại Ta, cụm Nam Yết, cụm Sinh Tồn, cụm Trường Sa, cụm An Bang, cụm Bình Nguyên): `Đá chưa định danh (cụm Nam Yết)`;
2. không trong cụm nào: quần đảo: `Bãi chưa định danh (Trường Sa)`.
Toạ độ luôn đi kèm ở trường riêng, không nhét vào tên. Tên chung KHÔNG được chứa tên nguồn, không chứa toạ độ.

## Bước 4 — Hồ sơ quyết định

Mỗi dòng ghi vào `scripts/dan-duong/ran-10m/quyet-dinh-ten.json`: `{bo, id, loai, quyetDinh: "ten-rieng"|"ten-chung", tenViet, bac: "A"|"B"|"chung", bangChung: [url…], lyDo, nguoiDuyet: "agent-<ngày>" | "anh Long <ngày>"}`. `ten-viet.mjs` đọc file này TRƯỚC mọi phép ghép tự động; dòng `ten-chung` vẫn vào sản phẩm (có độ sâu, có vị trí, tên chung) — bà con cần biết chỗ đó cạn, không cần biết tên.

## Bước 5 — Kiểm sau khi sinh sản phẩm

`sinh-reef-depth.py` kiểm: không ký tự Hán; không hậu tố loại hình nước ngoài `/\b(Dao|Jiao|Ansha|Shazhou|Qunjiao|Reef|Island|Shoal|Bank|Atoll|Cay)\b/` trong `ten` (không bắt "Tan"/"Nan": Đá Tốc Tan, Đá Ken Nan là tên Việt thật); mọi `ten` bắt đầu bằng một trong {Đảo, Đá, Bãi, Cồn, Cụm, Hòn}. Vi phạm ⇒ dừng, không ghi file.
