# Rà soát 35 thực thể chưa có tên Việt chắc chắn — 2026-10-22

Áp `scripts/dan-duong/ran-10m/LUAT-RA-SOAT-TEN.md`. Kết quả: `quyet-dinh-ten.json` cùng thư mục (35 dòng, `nguoiDuyet: agent-2026-10-22`).

## Tóm tắt

| Kết quả | Số dòng | Dòng |
|---|---|---|
| Tên riêng bậc **A** (bảng tra duyệt + ≤5 km + đúng loại) | **7** | Cồn Cát Tây · Đảo Nam · Đảo Quang Hòa · Đảo Loại Ta · Đảo Sơn Ca · Đảo Sinh Tồn Đông · Đảo Trường Sa Đông |
| Tên riêng bậc **B** (≥2 nguồn độc lập + ≤5 km) | **13** | Đảo Quang Hòa Tây · 5 đá cụm Ngũ Phương (Định Tường, Hội Đức, Ninh Cơ, Hoa, Triêm Đức) · Đá Sác Lốt ×2 (HHU24 + SCSBathy10 trùng thực thể) · Bãi Kiêu Ngựa · Cụm Loại Ta · Cụm Nam Yết · Cụm Sinh Tồn · Nhóm Lưỡi Liềm |
| **Tên chung** | **15** | nhóm An Vĩnh ×4 (Zhong Reef, Nan Reef, Dongxin, Xixin) · nhóm Lưỡi Liềm ×2 (Yinyuzi, Kuangzi) · cụm Song Tử ×4 (Beiwai, Dongnan, Dongbei, Southeast Shoal) · cụm Nam Yết ×1 (Zhong Bank) · cụm Sinh Tồn ×1 (Longxia) · cụm An Bang ×1 (Yuniao) · cụm Bình Nguyên ×1 (Rokong) · Hoàng Sa ×1 (East Island) |

Không dòng nào còn tên nước ngoài. Mọi `tenViet` bắt đầu bằng Đảo/Đá/Bãi/Cồn/Cụm — **trừ 1 dòng "Nhóm Lưỡi Liềm"** (xem mục cần anh Long chốt).

## Assumptions (lệch/khuyết so với luật — cần anh Long chốt)

1. **Cồn cát ↔ Đảo coi là cùng lớp "đất nổi"** khi nguồn đã xác định *đúng thực thể* (cùng chữ Hán, cùng toạ độ): `Chunqian/Dunqian Shazhou` = Đảo Sơn Ca, `Ranqing Shazhou` = Đảo Sinh Tồn Đông, `Central London Reef` = Đảo Trường Sa Đông (bảng tra `duyet: true`). Luật ghi "đảo ≠ đá ≠ bãi" là để chặn gán *theo khoảng cách* cho thực thể khác; ở đây không phải suy từ khoảng cách. Ngược lại `Zhong Reef`/`Nan Reef` (không nguồn nào nối "X Jiao" với Cồn Cát/Đảo) vẫn bị loại → tên chung.
2. **Thực thể là CẢ CỤM** (Tizard Bank, Union Banks, Daoming Reefs, Yongle Atoll): phép 5 km so với "tâm quy ước" của cụm vô nghĩa (cụm dài 30–70 km); tôi áp *hộp bao cụm* và đặt tên cụm (Cụm Nam Yết, Cụm Sinh Tồn, Cụm Loại Ta, Nhóm Lưỡi Liềm). Nếu anh Long không đồng ý thì 4 dòng này rơi về "Cụm đá chưa định danh (cụm X)" — nghe rất gượng vì chính nó là cụm X. Đề nghị ghi thêm 1 dòng vào LUAT §2: *"Nguồn là tên cả cụm → so hộp bao, không so 5 km."*
3. **Bãi Kiêu Ngựa** (Ardasier Bank): bãi dài 70 km, tâm Wikipedia VI lệch 7,2 km nhưng toạ độ Wikidata lệch 1,9 km; tên Việt chỉ có từ Wikipedia VI (2 bài) + Wikidata nhãn "Kiêu Ngựa". Nhận ở mức tin vừa; không có tên Việt cạnh tranh.
4. **Bước 5 (kiểm sau sinh)**: cần thêm "Nhóm" vào danh sách chữ đầu cho phép, hoặc đổi "Nhóm Lưỡi Liềm" → "Cụm Lưỡi Liềm" (Hoàng Sa quen gọi *nhóm*, Trường Sa gọi *cụm*).
5. Hai dòng **trùng thực thể**: `HHU24 123 Huanglu Reef` và `SCSBathy10 Royal Charlotte Reef` đều là Đá Sác Lốt; `HHU24 43 Dongnan Shoal` có lẽ = `SCSBathy10 Southeast Shoal` (cùng tên chung).

## Các ca khó và vì sao

- **Xi Sand → Cồn Cát Tây (A)**, không phải "Đá Trương Nghĩa" như máy gợi ý — gợi ý đó đúng là lỗi "lấy tên gần nhất" luật cấm. West Sand 16,9775°B 112,2119°Đ cách 1,5 km, đúng loại.
- **Nan Island vs Nan Reef, Zhong Reef** (An Vĩnh): chỉ *Nan Island* = Đảo Nam (南岛). Hai dòng "Reef" không khớp bất kỳ 南礁/中礁 nào trong nhóm An Vĩnh; Cồn Cát Nam/Trung sát bên nhưng khác loại → tên chung. Nếu anh Long biết HHU24 dùng "Reef" cho nền rạn quanh cồn thì nâng tay.
- **Dongxin / Xixin / Kuangzi / Yinyuzi**: đều là địa danh Trung Quốc đặt cho cồn cát nhỏ; Wikipedia VI nói thẳng "không có tên Việt". EN Wikipedia có "Bãi Tiểu Xà Cừ" (Yinyu Zi) và "Đảo Sâm Cầm" (Kuangzai Shazhou) nhưng **chỉ 1 nguồn**, không nơi nào khác xác nhận → bậc C, ghi ứng viên.
- **Zhenhang / Guangjin** (16,45°B 111,70°Đ): Zhenhang = 琛航 Chenhang → Đảo Quang Hòa (A, 1,3 km). Guangjin = 广金岛 Palm Island → Đảo Quang Hòa Tây (B): EN Wikipedia + VI Wikipedia cùng tên, toạ độ 0,2 km, Wikidata Q13189055 xác nhận.
- **Cụm Ngũ Phương (Wufang ×5)**: VI Wikipedia (Bãi Hải Sâm) và zh Wikipedia (五方礁) cùng bảng tên Việt; EN danh sách cho toạ độ. Kiểm thứ tự bằng toạ độ: nam (10,460/115,781) Định Tường · vĩ (10,463/115,725) Hội Đức · tây (10,500/115,706) Ninh Cơ · bắc (10,535/115,731) Hoa · đầu (10,536/115,789) Triêm Đức — khớp hết với gợi ý máy, sai số ≤1,6 km.
- **Longxia / Bamford Reef**: toạ độ trùng bài VI "Đá Vị Khê" (0,4 km) và bài đó nói rõ = Bamford = Longxia; nhưng Wikidata + liên kết zh gán 龙虾礁 cho **"Đá Bia"**, còn bài VI Đá Bia lại đặt ở chỗ khác (4,3 km) và tự nhận "một số nguồn nhầm lẫn". Mâu thuẫn ⇒ tên chung, ứng viên mạnh nhất là Đá Vị Khê. Muốn chốt cần nguồn nhà nước (danh mục địa danh Cục Đo đạc/Bộ TN&MT).
- **5 tên không tra ra**: *Yuniao Island* — không nguồn nào; vị trí = đầu đông bắc Bãi Thuyền Chài (cụm An Bang) → "Đảo chưa định danh (cụm An Bang)". *Rokong Atoll* — không nguồn; nằm giữa Đảo Vĩnh Viễn và Đảo Bình Nguyên → "Cụm đá chưa định danh (cụm Bình Nguyên)". *Central Reef* = Central London Reef = Đảo Trường Sa Đông (A). *Daoming Reefs* = 道明群礁 = Cụm Loại Ta (B, luật hộp bao; tâm dữ liệu 10,896°B nằm trên trục ĐB–TN của bãi, cách tâm quy ước 18 km). *Tizard Bank* = Cụm Nam Yết (B, hộp bao).
- **East Island** (16,545°B 112,715°Đ): về tên = 东岛 = Đảo Linh Côn, nhưng Linh Côn cách 13,5 km (>5 km) → theo luật không nhận. Nghi polygon là cả rạn vòng Linh Côn (Hòn Tháp cùng rạn, 8,9 km). Linh Côn nằm ngoài nhóm An Vĩnh (EN: "eastern sub-group") nên tên chung là "(Hoàng Sa)". **Anh Long xem hình polygon**: nếu đúng là rạn Linh Côn thì nâng thành "Đảo Linh Côn".
- **Ardasier / Royal Charlotte** (phía nam): Royal Charlotte = Huanglu = Đá Sác Lốt (B, 0,1 km). Ardasier Bank = Bãi Kiêu Ngựa (B, xem Assumptions 3); **không** phải Đá Kiêu Ngựa (Ardasier Reef, cách 33 km, Malaysia đóng).
- **Cụm Song Tử ×4** (Beiwai, Dongnan, Dongbei, Southeast Shoal): Wikipedia VI cụm Song Tử chỉ có 6 thực thể, không có các bãi này; Đá Bắc là 贡士礁 — khác tên nguồn. Cấm dịch "Đông Nam/Đông Bắc" → tên chung.
- **Zhong Bank** (Nam Yết): 中滩 không có trong 12 thực thể cụm Nam Yết; Bãi Bàn Than là 中洲礁 — khác → tên chung.

## Nguồn đã dùng

Wikipedia VI (Quần đảo Hoàng Sa, Quần đảo Trường Sa, bài riêng: Bãi Hải Sâm, Đá Vị Khê, Đá Bia, Đá Sác Lốt, Đảo Quang Hòa, Kiêu Ngựa, Cụm Thám Hiểm, Cụm Song Tử/Nam Yết/Loại Ta/Sinh Tồn, Bãi Thuyền Chài) · Wikipedia EN (Paracel Islands, List of maritime features in the Spratly Islands, Loaita Bank, Ardasier Reef) · Wikipedia zh (五方礁, 龙虾礁) · Wikidata SPARQL (nhãn vi/en/zh + P625) · AMTI CSIS (Duncan Islands, Sand Cay). Trang UBND đặc khu / Bộ TN&MT không tìm được danh mục địa danh công khai có toạ độ qua tìm kiếm web lần này.
