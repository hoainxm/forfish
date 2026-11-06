# P1 — Trục "thông minh": đề xuất cho ForFish (06/11/2026)

> Nguồn số: r1 (DataLake), r2 (S-Tracking), r3 (DB 5 tháng), r4 (năng lực + luật), r5 (mkn-3). Xếp theo **giá trị thật × bằng chứng × khả thi 4–8 tuần**. Nhãn nút ≤2 chữ.

## Điều kiện tiên quyết (không tính vào danh sách)

1. **Kênh tới tay.** 10.180 tin giám sát gửi tới **0 máy** qua push. Chỉ 91/10.431 chủ tàu từng mở app (r2 §1.5), web push có ở 17 máy (r3). Native hoặc Zalo ZNS phải đi song song; mọi chỉ tiêu dưới đo **trên người nhận được tin**.
2. **Nền đo (S, 1 tuần).** (a) Bảng sự kiện tối thiểu: mở màn, mở lớp premium, hỏi Sen Biển, bấm nút nhắc. (r3 §4.6). (b) Giữ **lịch sử từng đợt mất kết nối**, vì hiện chỉ giữ đợt mới nhất (r2 §3.2). Không giữ từ nay thì 3 và 4 không bao giờ đủ nhãn. (c) Lọc 187/251 dòng `han_lich_su` bị lệch +1 ngày.

---

## 1. Lọc nhiễu cảnh báo, nhận ra SOS kẹt — S

- **Vấn đề:** "Không nguồn ngoài" chiếm 78% số dòng trong 7 ngày, và 78% trong số đó là tàu nằm bờ. SOS: **24 máy bắn ~55 lần/máy/ngày** (r2 §1.3). Báo động giả nhiều thì báo động thật mất tác dụng.
- **Người dùng thấy:** mỗi tàu một dòng trạng thái, chỉ đẩy tin khi có **chuyển trạng thái**. Nằm bờ thì gộp vào bản tin ngày ("2 tàu ổn, 1 tàu cần kiểm pin"). Nút: "Gọi thợ".
- **Thuật toán:** máy trạng thái theo (máy, loại). Chỉ đẩy khi vào trạng thái mới, sau đó im 24 giờ cho cùng loại.
  - "Nguồn ngoài": chỉ đẩy khi `trong_bo=false` **và** kéo dài ≥30 phút. Nằm bờ thì vào bản tin ngày.
  - **SOS: lần đầu LUÔN leo thang** (đẩy tin + CSKH). Gắn nhãn "nghi kẹt nút" khi ≥6 SOS/giờ, dịch chuyển <0,2 hải lý trong 2 giờ, và máy vẫn gửi vị trí bình thường. Nhãn này chuyển việc sang CSKH gọi xác nhận, **không tự đóng**. Gỡ nhãn ngay khi tàu dịch >0,5 hải lý hoặc có kèm mất GPS / vượt biên.
- **Đo:** chạy lại kho SQLite 7 ngày. Chỉ tiêu: tin đẩy/máy/ngày (gốc: 22.036 dòng nguồn ngoài/ngày, mục tiêu giảm ≥90%). Mọi đợt SOS phải có người liên hệ trong ≤15 phút (100%). Độ chính xác của nhãn "kẹt" theo CSKH xác nhận ≥90%.
- **Dữ liệu:** đã có (`stracking_canh_bao`, `muc-canh-bao.mjs`).
- **Offline:** server; app hiện bản tin đã lưu kèm giờ.
- **Luật/rủi ro:** nén nhầm SOS thật là lỗi an toàn → không nhánh nào tự đóng SOS.

## 2. Đồng hồ mốc phạt theo chiều dài tàu — S–M

- **Vấn đề:** ngoài khơi có 59/62 máy đang mất tín hiệu đã qua mốc 6 giờ. Lời nhắc "sắp tới mốc" chỉ 46 lần, "đã quá" 282 lần, tức **chỉ 14% lời nhắc tới trước mốc** (r2 §1.4). Cục lập 3.510 biên bản, **99,35 tỷ đ**, trung bình ~28 triệu/biên bản (r5 §4). ForFish chưa có mốc theo chiều dài, chưa có nấc 8 ngày / 10 ngày, chưa đếm số lần mất trong chuyến (r5 §5).
- **Người dùng thấy:** trên thẻ tàu, "Còn 2 giờ 40 phút", và dòng nhỏ "Cục chốt lúc 21:10". Nằm bờ quá 48 giờ thì hiện nút "Tạm ngừng".
- **Thuật toán** (thuần `lib/`). T0 là vị trí cuối.
  - Mốc Cục mở sự vụ: T0 + 2 giờ (tàu ≥24 m) hoặc T0 + 3 giờ (<24 m). Lỡ kỳ 1 ở +6 giờ, chốt thêm 1 giờ, khai bù được 5 giờ. Như vậy **Cục chốt sớm nhất ≈ T0+9 giờ (≥24 m) hoặc T0+10 giờ (<24 m)**.
  - **Giữ nhắc sớm** ở T0+3 giờ và T0+5 giờ. Cơ sở: đã mất quá 3 giờ thì 55% sẽ quá 6 giờ; quá 5 giờ thì 86% sẽ quá 9 giờ (r5 §4). Ở T0+5 giờ thì gọi điện, đúng như r2 #5.
  - Thêm nấc 192 giờ và 240 giờ: "Đưa tàu về trước ngày …".
  - Nằm bờ: mốc 24 giờ. Sau 48 giờ gợi ý tạm ngừng, vì ở bờ đã quá 24 giờ thì 68% sẽ quá 10 ngày, và chỉ có 204 đơn tạm ngừng trên ~13,9 nghìn sự vụ nằm bờ.
  - Đếm số đợt mất trong chuyến (Đ5 k9 NĐ 246 coi là tình tiết tăng nặng).
  - **Thiếu chiều dài thì lấy mốc sớm nhất** (coi như ≥24 m).
- **Đo:** tỷ lệ lời nhắc đầu tiên tới **trước** T0+6 giờ, gốc 14%, mục tiêu ≥80%. Phụ: tỷ lệ đợt ngoài khơi có lại tín hiệu trước T0+9 giờ, so trước và sau khi có đồng hồ (đo trên lịch sử ở mục Nền đo b).
- **Dữ liệu:** S-Tracking có. Chiều dài lấy từ sổ tàu ForFish (10.353 sổ nhập 05/11, cần kiểm độ phủ của trường dài).
- **Offline:** đồng hồ tự đếm trên máy từ T0 đã lưu, không cần mạng. Người nhận chủ yếu là chủ tàu trên bờ.
- **Luật/rủi ro:** khung phạt NĐ 246 mới 1 khung xác nhận (`confirmed:false`, r5 §3), nên số tiền ghi "tham khảo", **không viết "tránh được phạt"** (r4 luật 7). Luật mốc lấy từ văn bản NĐ 41. **Không đưa bản cào mkn-3 vào sản phẩm** (r5 §6.8). Xác suất có điều kiện chỉ dùng nội bộ để đặt nấc. Cần anh Long chốt theo r5 §7.2: giữ nhắc sớm và hiện thêm "giờ Cục chốt".

## 3. Phân loại nguyên nhân mất kết nối kèm nút xử lý — M

- **Vấn đề:** 97,7% sự vụ khép lại do tự có tín hiệu lại. Nhưng **10% số tàu chiếm 60,6% sự vụ** (r5), 1.636 máy đồng bộ Tổng cục thất bại (Cục vẫn phạt dù máy có sóng), và 1.025 máy hết cước (r2). Mỗi nguyên nhân cần một việc khác nhau.
- **Người dùng thấy:** "Có thể do: hết cước", kèm đúng một nút: "Gia hạn" / "Gọi thợ" / "Tạm ngừng".
- **Thuật toán:** luật xét theo thứ tự, xác định trước.
  1. Hạn cước ≤ ngày mất → **Cước**.
  2. `dong_bo_tcts = Thất bại` → **Đồng bộ**.
  3. Trong 6 giờ trước khi mất có "không nguồn ngoài", rồi pin yếu → **Nguồn điện**.
  4. Mất GPS mà vẫn kết nối → **Ăng-ten**.
  5. Trong bờ, không có cảnh báo trước, lặp lại trong 17–23 giờ → **Tắt khi neo**, gợi ý tạm ngừng.
  6. Còn lại → **Mất sóng**. Đây là mặc định an toàn, vì 98,8% đợt dưới 6 giờ tự có lại.

  Đủ ~300 nhãn thì fit cây quyết định độ sâu ≤4.
- **Đo:** nhãn lấy từ **kết quả cuộc gọi CSKH** (dữ liệu của mình, không cần ai cho phép). Gốc so sánh: "mọi ca đều là mất sóng". Mục tiêu top-1 ≥70% trên ≥200 đợt có xác nhận. Lớp "Cước" và "Đồng bộ" phải đúng ~100%.
- **Dữ liệu:** cảnh báo và hạn cước đã có. **Lịch sử đợt chưa có** (Nền đo b). Ô ghi kết quả gọi CSKH cần thêm.
- **Offline:** tính ở server, app cache nhãn cuối kèm giờ.
- **Luật/rủi ro:** **cấm nhãn "tắt cố ý"** cho bà con xem, cấm bán cho cơ quan như một kết luận (r5 #4). `admin_result` của mkn-3 chỉ được dùng làm nhãn khi đã có thoả thuận với Cục. Câu chữ luôn là "có thể".

## 4. Kiểm máy (dự báo rủi ro mất kết nối) — M

- **Vấn đề:** hết cước giữa chuyến thì chắc chắn mất kết nối. Chuyến p90 dài 29 ngày, trong khi 2.294 máy hết hạn trong 30 ngày tới (r1, r2). Tái diễn là dấu hiệu mạnh nhất (10% tàu chiếm 61% sự vụ). Có 7.661 máy đời M2019/D2019, 122 máy pin yếu.
- **Người dùng thấy:** thẻ "Kiểm máy: 2 việc" (gia hạn trước khi đi; kiểm ắc-quy). Thẻ **chỉ hiện khi số liệu máy báo có việc**.
- **Thuật toán:** điểm cộng dồn trong 14 ngày tới.
  - Hạn cước < p90 độ dài chuyến theo nghề × cỡ (tiên nghiệm tổng hợp DataLake, ≥3 tàu): +3.
  - ≥3 đợt mất trong 30 ngày: +3.
  - Pin yếu lặp lại trong 7 ngày: +2.
  - Không nguồn ngoài lúc đang chạy: +2.
  - Đời máy 2019: +1.

  Điểm ≥3 thì hiện thẻ. Đủ 8 tuần nhãn thì fit logistic.
- **Đo:** AUC dự báo "đợt >6 giờ ngoài khơi trong 14 ngày", gốc là luật chỉ-tái-diễn. 8 tuần đầu chỉ đo độ chính xác **từng luật** (lịch sử mới 1,5 ngày).
- **Offline:** thẻ cache đọc được; không thêm request lúc mở app.
- **Luật/rủi ro:** r4 luật 5 (**không phán "đi hay không đi"**): chỉ nói việc cần làm với máy, không có từ "đừng đi". ⚠️ **Gần với Checklist xuất bến đã gỡ ngày 27/07** (r4 §4). Khác ở chỗ đây không phải danh sách tay, và chỉ hiện khi máy có lỗi đo được. Nếu anh Long coi hai cái là một thì gộp thẳng vào thẻ tàu của đề xuất 2.

## 5. Sen Biển: sửa 40% câu không hiểu — S–M

- **Vấn đề:** 157 câu từ ~10 người, **40% `khong_hieu`** (~63 câu). Trải nghiệm hỏng ngay lần hỏi đầu. Bốn ý được hỏi nhiều là cá ở đâu, thời tiết, bão, đường đi (r3). Sen Biển chưa có bộ kiểm vàng (r4 §5.8).
- **Người dùng thấy:** thay câu "không hiểu" bằng "Ý bác là…?" kèm 2 chip (hai ý gần nhất).
- **Thuật toán:**
  1. Gắn nhãn tay 63 câu thành ba nhóm: nhận giọng sai / ý đã có nhưng cách nói lạ / ý chưa có.
  2. Thêm cách nói lạ vào n-gram của 74 ý.
  3. Lượt khớp thứ hai: char n-gram (TF-IDF) với câu mẫu từng ý, để chịu lỗi nhận giọng.
  4. Luật biên: nếu điểm ý thứ nhất trừ ý thứ hai < δ thì hỏi lại bằng 2 chip.
  5. Ý chưa có thì trả câu đỡ, ghi nhận để làm sau.
- **Đo:** bộ vàng = 157 câu + ~100 câu nhân viên đọc giọng ba miền. **Tách theo người nói** để không rò. Hai chỉ tiêu đi cặp: tỷ lệ không hiểu 40% → <15%, và tỷ lệ **hiểu sai** ≤5%. Không được hạ chỉ tiêu thứ nhất bằng cách đẩy chỉ tiêu thứ hai lên.
- **Offline:** chạy hoàn toàn trên máy (zipformer + n-gram).
- **Rủi ro:** mẫu giọng chỉ lưu theo đồng ý (`dong_y_dieu_khoan`); 10 người nói còn quá nhỏ.

## 6. Hướng dẫn 14 ngày đầu — M

- **Vấn đề:** chỉ **30%** người đã qua 14 ngày còn dùng trong tuần. Qua được tháng đầu thì 57% ở lại (r3 §2). 153/522 người sẵn sàng offline. 91 premium chưa chọn vai. 9.597 chủ tàu bỏ trống tỉnh.
- **Người dùng thấy:** 4 bước, mỗi bước một nút: "Chọn cảng", "Tải về", "Bật tin", "Nối máy".
- **Thuật toán:**
  - Cảng nhà **gợi ý sẵn** từ vị trí cập bến gần nhất của máy S-Tracking (máy của chính chủ) hoặc GPS điện thoại. Từ đó bão và con nước đúng chỗ.
  - "Tải về" chỉ mời khi đang có wifi (`navigator.connection`).
  - Tối đa 1 lời nhắc/ngày, vào ngày 1, 2, 4, 7, 14, chỉ khi còn bước chưa làm. Làm xong thì dừng.
- **Đo:** giữ ngẫu nhiên 20% người mới làm nhóm đối chứng. Chỉ tiêu: tỷ lệ còn dùng sau 14 ngày, 30% → 45%. Phụ: tỷ lệ sẵn sàng offline ở ngày 7.
- **Offline:** các bước đọc từ máy.
- **Luật:** nhãn ≤2 chữ (r4 luật 15); không quảng cáo trong luồng này.

## 7. Vòng phản hồi Trúng / Trượt cho dự báo cá — M

- **Vấn đề:** cái bán duy nhất mới chứng minh được "bãi theo mùa" (AUCeff 0,810). Cả 4 thí nghiệm lớp ngày đều trượt. **Chưa có vòng trúng/trượt nào** (r4 §1, §5.1). Tháng 11–12 lớp cá rơi về `fleet-static` (r1 §2), tức đúng lúc này là lúc mô hình yếu nhất. Premium: 182 người, `premium_used` chỉ 1.
- **Người dùng thấy:** khi chuyến kết thúc (máy chuyển sang trong bờ, hoặc GPS về cảng), hiện thẻ hỏi "Bãi app gợi ý chuyến rồi?" với 4 chip: **Trúng / Thường / Trượt / Không đi**. Có thể chọn thêm khoảng sản lượng (xem đề xuất 9).
- **Thuật toán:**
  - Lúc xuất bến, chụp lại dự báo: các ô 0,25° bậc Cao/TB trong vùng đã xem.
  - Câu trả lời gắn với bản chụp đó.
  - Đo: tỷ lệ "Trúng" theo bậc. Lift Cao/TB so với đối chứng `fleet-static` (gốc 1,0). Hiệu chỉnh xác suất theo bậc.
- **Cỡ mẫu:** 59 premium dùng hằng tuần → 8 tuần ~100–200 câu, chỉ đủ thấy lift ≥~1,8. Chỉ tiêu chính giai đoạn này: **tỷ lệ trả lời ≥30% số chuyến**. Lợi phụ: bộ nhãn **riêng của ForFish**, bớt phụ thuộc DataLake (rủi ro pháp lý số 1, r1 §0.3).
- **Offline:** câu trả lời ghi vào sổ trên máy như sổ bảo dưỡng, đồng bộ khi có sóng qua đường `saveUserJson` hiện có, có báo lỗi, không nuốt. Đây không phải outbox đơn hàng hay tin đăng (r4 luật 14), nhưng nên xin anh Long xác nhận.
- **Luật/rủi ro:** không hỏi tiền, không hỏi chi phí, nên **không làm sống lại sổ lãi lỗ / tính chuyến** đã xoá (r4 §4). Bãi cá là bí mật nghề: chỉ lưu ô 0,25°, chỉ tổng hợp ≥3 tàu, không bao giờ hiện cho người khác.

## 8. Nhắc bảo dưỡng và vật tư theo ngày biển — M

- **Vấn đề:** hàng bán chạy thật là **lọc dầu SF50, túi lọc, lõi lọc, màng lọc, dây anten, niêm phong** (r3 §3), tức vật tư tiêu hao định kỳ. Có 328 chủ có `supplies`, 495 chủ có `devices`. Sổ nhắc bảo dưỡng hiện bắt người dùng tự đặt chu kỳ. Nhịp đi biển rất thất thường (CV quay vòng 1,38, r1), nên nhắc theo lịch cố định sẽ sai.
- **Người dùng thấy:** "Lọc dầu đã chạy ~410/500 giờ", nút "Đặt lại".
- **Thuật toán:**
  - Giờ máy ước = Σ ngày biển thật × giờ chạy/ngày (theo nghề).
  - Ngày biển thật lấy từ vị trí S-Tracking của **chính máy chủ tàu** (ngoài bờ, tốc độ >0,5 hải lý/giờ).
  - Không có máy thì dùng tiên nghiệm tổng hợp: ngày biển/tháng theo nghề × cỡ × mùa (DataLake, ≥3 tàu).
  - Mốc thay theo hãng. Nhắc ở 80% và 100% mốc. Ghi rõ "ước".
- **Đo:** giữ 20% làm nhóm đối chứng. Chỉ tiêu: tỷ lệ đặt lại trong 30 ngày sau nhắc so với nhóm không nhắc. Gốc so sánh là tỷ lệ mua lặp hiện tại trong `crm_orders`.
- **Offline:** đồng hồ giờ máy nằm trong sổ trên máy (như nhắc bảo dưỡng hiện nay). Nút "Đặt lại" chỉ chạy khi có mạng (r4 luật 3 và 14: COD, không outbox).
- **Luật/rủi ro:** r4 luật 4 cấm SDVICO có đặc quyền trong lõi sàn. Lời nhắc sinh từ **thiết bị chủ tàu đã mua** (dữ liệu SDWork của chính họ), mở trang sản phẩm qua đường "Gọi SDVICO" sẵn có, không thêm nhánh `if shop === SDVICO` trong sàn. Tin tiếp thị cần đồng ý (0083). Hiện chỉ 14 chủ thiết bị dùng app, nên giá trị chỉ tăng theo độ phủ.

## 9. Khoảng năng suất "tàu cùng loại" — S

- **Vấn đề:** trong cùng nghề × cỡ × tỉnh, tàu p75 làm **gấp 4,6 lần** tàu p25 (trung vị của 173 nhóm, r1 §1).
- **Người dùng thấy:** trong thẻ Trúng/Trượt, "Tàu cùng loại ở tỉnh anh: thường 90–420 kg mỗi ngày biển". Bà con chọn chip khoảng của mình (dưới / giữa / trên).
- **Thuật toán:**
  - Phân vị p25/p50/p75 theo nhóm, có trọng số tin cậy v2.
  - Chỉ nhóm ≥10 tàu. Nhóm nhỏ hơn thì lùi về nghề × cỡ toàn quốc.
  - **Chỉ tàu ≥12 m** (tàu <12 m chỉ khai 2,3% kg). Ghi chú 33% kg là "cá tạp/xô".
- **Đo:** tỷ lệ chọn chip; phân bố chip so với phân vị nhóm (kiểm lệch số khai).
- **Dữ liệu:** `profiles/classes.json` có sẵn, chỉ thêm p25/p75 và số tàu.
- **Offline:** bảng nhỏ đi theo SDF2.
- **Luật/rủi ro:**
  - L2: không xếp hạng tàu cụ thể, không hiện hồ sơ DataLake của chính tàu.
  - L3: không ghi nguồn.
  - **Dùng DataLake trong gói thu phí cần văn bản của Cục** (r1 §0.3). Chưa có văn bản thì để miễn phí, hoặc hoãn.

## 10. "Nhắn trạm": báo vị trí thay thế, giai đoạn 1 — S

- **Vấn đề:** 99,9% sự vụ MKN_6H không có kỳ nào được khai. Trong 155 nghìn sự vụ chỉ **27 sự vụ** khép bằng chủ tàu tự khai. SMS của Cục chỉ là giả lập (r5 §1, §4). ForFish hiện chỉ dặn "báo bằng liên lạc khác".
- **Người dùng thấy:** khi đồng hồ (đề xuất 2) còn ≤3 giờ, hiện nút "Nhắn trạm".
- **Thuật toán:**
  - Có sóng: soạn sẵn SMS (toạ độ GPS máy, giờ, số tàu) gửi số Chi cục/trạm bờ của tỉnh, mở bằng app tin nhắn của máy.
  - Không sóng: Sen Biển **đọc to toạ độ** để thuyền trưởng báo qua ICOM, chạy offline.
- **Đo:** số lần dùng. Tỷ lệ đợt có bản khai trước mốc, gốc ~0%.
- **Dữ liệu:** **thiếu danh bạ số Chi cục theo tỉnh**, phải thu thập.
- **Luật/rủi ro:** chỉ có giá trị pháp lý khi Cục chấp nhận kênh này (r5 #2). Không hứa gỡ phạt. Toạ độ chỉ dùng khi bà con bấm, không gửi lên server ForFish. Giai đoạn 2 (API khai báo mkn-3) là việc B2G, ngoài 8 tuần.

## 11. Thí nghiệm: kênh "bãi của nhóm năng suất cao" — L, không cam kết

- **Vấn đề:** cần một kênh mới cho lớp cá trả phí (r1 #5).
- **Thuật toán:**
  - Lấy tàu có `vsPeer` ≥ p75, tính giờ đánh VMS theo ô × tháng (≥3 tàu, thêm luật **không ô nào do một chủ chiếm >50%**).
  - Tính lift so với cả đội tàu.
  - Kiểm bằng AUCeff giữ-tháng-ra (`dl-eval-honest`). **Chỉ nối khi tăng ≥0,003 trong khoảng tin cậy.**
- **Rủi ro:** lẫn tay nghề với bãi ("thuyền giỏi", không phải "bãi tốt"). Vướng pháp lý DataLake như mục 9. Chỉ làm khi 1–8 đã chạy.

---

**Thứ tự 8 tuần:** T1 nền đo + 1 + 2 (lib) · T2–3 giao diện 2 + 5 + 10 · T3–5 3 + 6 + 7 · T5–8 4 + 8 + 9 · sau đó 11.

## KHÔNG nên làm (dù hấp dẫn)

1. **Thêm thí nghiệm lớp "cá hôm nay"**: đã trượt 4/4 (r4 §1). Chờ toạ độ mẻ (r1 §5.1) và nhãn Trúng/Trượt.
2. **Dự báo nguồn cung về cảng, khớp bên mua từ biên nhận/SC**: **luật 8 chặn** (r1 L1).
3. **Kg trên lít dầu theo nhóm:** không có số dầu thật, toàn bộ là mô hình (r1 #4, L5). Bắt bà con ghi dầu thì lại sát "tính chuyến" đã xoá.
4. **Nhãn "tắt cố ý"** cho bà con, hoặc bán phân loại cho cơ quan (r5 #4): mất niềm tin, xung đột lợi ích.
5. **Đưa bản cào mkn-3 hoặc `admin_result` vào sản phẩm** khi chưa có văn bản với Cục (r5 §6.8).
6. **Hiện hồ sơ DataLake của chính tàu**, kể cả cho chính chủ (r1 L2).
7. **Lớp "nơi nhiều tàu gần ranh"** và **ô tàu hậu cần**: dễ bị đọc thành khuyến khích. Ngưỡng chuyển tải quá rộng (19 nghìn tàu dính, r1 #8–9).
8. **Lịch mùa loài × cảng cập:** sát L1, phải hỏi anh Long trước (r1 #6).
9. **Mô hình ML** (rời bỏ gia hạn, dự báo hỏng máy) trước khi có 8 tuần nhãn. Lịch sử hiện chỉ 1,5 ngày (r2). Làm luật trước.
10. **Điểm rủi ro kèm lời "nên ở bờ"**: tái lập "điểm đi biển" và "ngày nào ra đánh" đã loại (r4 §4).
11. **Mở rộng Sen Biển sang ý mới** trước khi tỷ lệ không hiểu <15%.

*Không đề xuất nào làm sống lại ý tưởng ở r4 §4. Điểm cần anh Long xác nhận: đề xuất 4 (so với Checklist xuất bến đã gỡ) và đề xuất 7 (cơ chế đồng bộ câu trả lời).*
