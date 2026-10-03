# Brief chung — Team nghiên cứu hồ sơ loài cho dự báo cá SDFish (2026-10-03)

**Load khi / Load when**: đề bài giao cho team agent rà loài — load khi tổ chức đợt rà kế tiếp.

## Bối cảnh
SDFish (app cho ngư dân VN) chấm điểm từng ô biển 0,25° cho 40 loài:
`fit = cổng nhiệt (trapezoid SST [a,b,c,d]) × mồi (chl-a, log10, dải [lo,hi]) × soft-OR cơ chế gom cá (front nhiệt, front mồi, rìa xoáy SSHA, nước trồi, hội tụ dòng, dị thường tầng nhiệt D20) × cổng độ sâu (offshore [a,b] m / inshore [a,b] m) × cổng cách bờ (cá khơi, 20→50 km) × mùa vụ (theo tháng, theo vùng)`.
Hồ sơ hiện tại: `profiles-current.json` (cùng thư mục). Trường quan trọng mỗi loài: `species`, `short`, `sst` (4 mốc °C), `chlLog` (2 mốc log10 mg/m³), `w` (trọng số cơ chế), `thermoBand`, `coldCore`, `offshore`/`inshore` (m), `tempSource` (surface/bottom/deep), `surfaceSignal` (high/medium/low), `seasons[]` (months 1–12 + regions: vinh-bac-bo, trung-bo, nam-trung-bo, dong-nam-bo, tay-nam-bo, hoang-sa, truong-sa-dk1).

Lỗi đã bắt được hôm nay (để biết KIỂU lỗi cần tìm):
- Ngừ ồ: trần nhiệt 29 °C trong khi nước ven bờ mùa rộ 29,5–30,5 ⇒ loài tắt ngúm đúng mùa.
- Cá khơi (ngừ vây vàng, nục heo…) hiện sát bờ vì chỉ lọc độ sâu, thềm miền Trung dốc.
- Cá rạn/đáy (cá hồng, kẽm, mú) có hàng trăm ô điểm cao trên nước sâu >1000 m vì KHÔNG có cổng độ sâu.
- Cá thu, ngừ chấm: trần nhiệt thấp hơn nước VN cuối hè ⇒ 0 ô.
- Mùa khai NGƯỢC (ngừ ồ cũ 11–5, thực tế 3–9).

## Việc của mỗi agent
Với TỪNG loài trong nhóm được giao:
1. **Định danh**: tên khoa học (ưu tiên theo Nghị định 37/2024/NĐ-CP Phụ lục V và tên gọi ngư dân VN; nêu nếu tên tiếng Việt gộp nhiều loài).
2. **Nhiệt độ**: dải SST ưa thích & chịu đựng (°C) — nguồn FishBase/AquaMaps envelope, SEAFDEC, bài báo CPUE–SST ở Biển Đông/VN. Ghi rõ là nhiệt MẶT hay nhiệt tầng sống.
3. **Độ sâu & khoảng cách bờ**: tầng nước (m), độ sâu đáy nơi đánh bắt (m), ven bờ/thềm/khơi; cá khơi có bám đảo xa không.
4. **Mồi/chl-a**: loài có liên hệ với nước giàu chl hay nước trong; mức lệ thuộc (ăn plankton / săn cá nhỏ).
5. **Cơ chế gom cá**: front nhiệt, nước trồi, xoáy, tầng nhiệt nhô/chìm, vật nổi (FADs), chà, đáy rạn — cái nào có bằng chứng cho loài này.
6. **Mùa vụ ở VN theo vùng** (Vịnh Bắc Bộ, Trung Bộ, Nam Trung Bộ, Đông Nam Bộ, Tây Nam Bộ, Hoàng Sa, Trường Sa–DK1): tháng rộ, nguồn (Viện Nghiên cứu Hải sản RIMF, Tổng cục Thủy sản, SEAFDEC, báo địa phương về vụ cá, luận văn).
7. **Đối chiếu hồ sơ hiện tại** → bảng `trường | hiện tại | đề xuất | lý do | nguồn | độ tin (cao/vừa/thấp)`. CHỈ đề xuất khi có nguồn; không có nguồn thì ghi "giữ" và nói rõ không tìm được.

## Luật
- KHÔNG sửa code. Chỉ nghiên cứu + viết báo cáo vào ĐÚNG file đầu ra được giao (markdown, tiếng Việt).
- Mọi con số phải kèm nguồn (URL hoặc trích dẫn đủ tra). Không bịa. Nguồn mâu thuẫn thì ghi cả hai.
- Ưu tiên nguồn: (1) nghiên cứu/khảo sát ở vùng biển VN và Biển Đông; (2) SEAFDEC/WCPFC/IOTC/FAO; (3) FishBase/AquaMaps; (4) báo chí VN về mùa vụ (chỉ dùng cho tháng rộ, ghi rõ là báo).
- Chủ quyền: viết "Biển Đông", "Hoàng Sa", "Trường Sa". Nguồn ép tên khác thì vẫn dùng số liệu, nhưng tự ghi tên Việt.
- Dùng WebSearch mode "extended" khi kết quả thường mỏng. Ngân sách: tối đa ~25 lượt tìm mỗi agent; nếu hết mà còn loài thì ghi "chưa tra".
- Cuối báo cáo: mục **"Top 5 sửa đáng làm nhất của nhóm"** xếp theo tác động × độ tin, và mục **"Điều KHÔNG tìm được"**.
