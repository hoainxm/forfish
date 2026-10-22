# 14 — Bước B: mồi và gió trước chuyến có giải thích được năng suất chuyến không? (đo 2026-10-22)

**Load khi / Load when**: trước khi nói bất cứ điều gì về "mồi nhiều thì cá nhiều", trước khi biến dự báo mồi (13) thành sản phẩm cho bà con, hoặc trước khi đầu tư thêm vào tầng "thềm → cá". Bảng số gốc: `14b-buoc-B-bang-so.md`.

> Chỉ đọc dữ liệu, không sửa nhãn, mô hình hay app. Chạy ở gpu-desktop (nhãn DataLake không rời máy đó). Nhãn: bảng chuyến v3(a) cả năm 2026 (tới 11/10), 18 269 chuyến có ≥ 60 % giờ đánh nằm trong một hộp: MKU 11 389 · SCU 3 735 · NCU 2 376 · OFU 769. Chl: Copernicus Marine bản lấp mây HẰNG NGÀY (1997 → 14/10/2026, `tai-chl-ngay.mjs`). Gió: CMEMS đã nối thêm bản gần thời gian thực tới 21/10/2026. Script `buoc-b-moi-ca.mjs`; bảng chuyến dùng chung `bang-chuyen.mjs` (bước 0 chạy lại sau khi tách: giống hệt).

## 0. Kết luận (đọc nếu chỉ có 1 phút)

**Bước B KHÔNG QUA.** Với một năm nhãn, chl và gió những ngày trước chuyến **không giải thích được năng suất chuyến theo cách đúng cơ chế và vững**:

1. **Phép kiểm giả "có tín hiệu" ngang hoặc hơn biến thật.** Dùng chl và gió của 30–38 ngày **sau** chuyến (tương lai, không thể là nguyên nhân) vẫn cho hệ số khác 0 ở nhiều ô, kể cả khi đã khử xu thế nửa tháng. Ví dụ MKU cá cơm: biến thật giải thích thêm 5,7 % phương sai, kiểm giả 8,0 %. Tức là phần lớn "tín hiệu" là xu thế mượt theo thời gian (đội tàu, giá, thời tiết…) trùng với xu thế của chl/gió, không phải mồi.
2. **Chiều ngược cơ chế ở cá nổi nhỏ.** Chl 0–8 ngày trước chuyến cao hơn thì sản lượng cá nổi nhỏ **thấp hơn**: MKU −0,06 / −0,04 (tháng / nửa tháng), SCU −0,00 / −0,05 log kg mỗi độ lệch chuẩn. Cơ chế "nhiều mồi → nhiều cá" dự đoán chiều dương.
3. **Độ lớn rất nhỏ.** Ba biến cộng lại giải thích thêm 0,1–0,2 % phương sai năng suất tổng ở SCU, MKU (sau khi khử tàu, nghề, thời gian, vùng, giờ đánh, trăng). Ngay cả khi thật, nó không đủ để bà con thấy khác.
4. **Một kết quả đúng chiều và đứng vững, nhưng chỉ là giả thuyết:** gió tây nam (ứng suất đông) 0–8 ngày trước chuyến mạnh hơn 1 độ lệch chuẩn thì sản lượng **mực ở SCU** cao hơn ~6–7 % (tháng: +0,069 [+0,018, +0,113]; nửa tháng: +0,060 [+0,010, +0,120]), kiểm giả gần 0. Nhưng đây là 1 trong ~70 phép thử; ở CI 90 % sẽ có vài kết quả như vậy do ngẫu nhiên. Phải kiểm lại trên năm nhãn sau, khoá trước.

**Hệ quả cho "Dòng Dẫn":**
- Dự báo mồi 1–3 tuần (13) **không được trình bày như dự báo cá**. Nếu làm, chỉ là thông tin môi trường ("nước có nhiều phù du / nước trồi") cho người tự đọc.
- Mắt xích mạnh nhất đã đo được (gió ↔ mồi giữa các năm, r 0,8) nằm ở **thang năm**, còn nhãn cá chỉ có **một năm**. Bước B chỉ kiểm được dao động **trong năm** — đúng chỗ tín hiệu yếu nhất. Câu hỏi "năm mồi kém thì năm cá kém?" **chưa kiểm được** và là câu đáng hỏi nhất. Nó cần sản lượng nhiều năm theo tỉnh × tháng (đã nêu ở README §5 và 11 mục 6) hoặc năm nhãn 2027.

## 1. Cách đo

- **Chuyến** (bảng chuyến v3(a), 0): gán vào hộp khi ≥ 60 % giờ đánh nằm trong hộp; mốc thời gian = trung bình giờ đánh trong hộp; pha trăng tính lại ở mốc đó.
- **Đích**: log kg của chuyến — tổng, và từng nhóm (cá cơm, cá nục, cá nổi nhỏ, mực, cá ngừ; mã gom theo tên loài).
- **Kiểm soát**: tàu cố định (chỉ tàu có ≥ 2 chuyến), nghề × lớp dài, **tháng × vùng 0,5°** (hoặc nửa tháng × vùng), log giờ đánh, log giờ chuyến, cos/sin pha trăng. Tầng tháng × vùng < 5 chuyến bị bỏ.
- **Biến thử** (dị thường so khí hậu ngày-trong-năm 1998–2025, trung bình hộp): chl 0–8 ngày trước, chl 9–16 ngày trước (phần dự báo mồi 1–3 tuần cho được), ứng suất gió đông 0–8 ngày trước.
- **Đo**: hệ số chuẩn hoá (log kg khi biến tăng 1 độ lệch chuẩn phần còn lại), CI 90 % bootstrap cụm tuần × vùng; R² thêm. **Kiểm giả**: cùng mô hình với chl, gió ở 30–38 ngày sau.

## 2. Kết quả chính (SCU, MKU — hai vùng ưu tiên)

β = log kg mỗi độ lệch chuẩn; in đậm = CI 90 % loại 0 (CI đầy đủ ở 14b). Cột kiểm giả = R² thêm khi dùng chl/gió 30–38 ngày SAU chuyến.

| Vùng · nhóm (n chuyến) | chl 0–8 ngày trước | chl 9–16 ngày trước | gió 0–8 ngày trước | R² thêm | Kiểm giả R² |
|---|---|---|---|---|---|
| SCU tổng (3 050) | +0,016 | +0,016 | +0,001 | 0,002 | 0,002 |
| SCU cá nổi nhỏ (1 047) | −0,002 | −0,017 | −0,005 | 0,001 | 0,000 |
| SCU mực (471) | **−0,052** | +0,034 | **+0,069** | 0,021 | 0,001 |
| SCU cá ngừ (502) | **−0,080** | −0,013 | **−0,061** | 0,028 | 0,047 |
| MKU tổng (10 525) | **−0,021** | −0,006 | −0,005 | 0,001 | 0,007 |
| MKU cá cơm (770) | **−0,167** | **−0,189** | −0,048 | 0,057 | 0,080 |
| MKU cá nục (2 692) | **−0,041** | +0,011 | −0,024 | 0,006 | 0,001 |
| MKU cá nổi nhỏ (4 778) | **−0,060** | −0,013 | −0,008 | 0,006 | 0,012 |
| MKU mực (1 338) | **−0,033** | −0,005 | −0,004 | 0,003 | 0,008 |

Hiệu ứng thời gian tháng × vùng. Bảng nửa tháng × vùng ở 14b: chiều chl âm ở cá nổi nhỏ còn nguyên (MKU −0,042, SCU −0,047); kiểm giả gió MKU vẫn khác 0 (tổng −0,042, cá cơm −0,080).

**Biến thiên còn lại để học** sau khi khử (tỉ lệ phương sai): chl 0,10–0,58, gió 0,15–0,63 — không phải vì thiếu biến thiên mà không thấy tín hiệu (MKU còn ~50 %).

**OFU, NCU** (đối chứng): OFU cá ngừ có hệ số gió lớn (+0,08 / +0,11) nhưng kiểm giả còn lớn hơn và ngược dấu (−0,20 / −0,15), mẫu nhỏ (216–243 chuyến, 52–64 cụm) ⇒ không tin.

## 3. Giới hạn trung thực

- **Một năm nhãn (2026, năm El Niño đang lên)**: chỉ kiểm được dao động trong năm. Không kiểm được tầng liên năm — nơi gió ↔ mồi mạnh nhất.
- **Nhãn là cả chuyến** (trung vị 11 ngày): mốc thời gian là trung bình giờ đánh, làm nhoè dao động 8 ngày của chl.
- **Chl trung bình hộp** (2°–2,5°), không phải đúng chỗ tàu đánh; mồi theo không gian trong hộp không được đo.
- **Ngư dân tự chọn chỗ và lúc đánh**: khi mồi tốt, tàu có thể dàn ra hoặc đội tàu đông hơn, làm kg mỗi chuyến không tăng. Điều này có thể giải thích một phần chiều âm, nhưng không phân định được với dữ liệu này.
- **Chỉ tàu ≥ 15 m có VMS.** Tàu nhỏ ven bờ — nhóm phụ thuộc nước trồi nhất — không có trong nhãn.
- **Nhiều phép thử** (~70 hệ số): vài CI loại 0 là chuyện bình thường do ngẫu nhiên.

## 4. Đề nghị

1. **Dừng đầu tư vào "thềm → cá" ở thang ngày–tuần** với nhãn hiện có. Thêm biến, thêm mô hình sẽ chỉ khai thác thêm nhiễu (đã có kiểm giả chứng minh).
2. **Khoá trước một giả thuyết duy nhất** cho năm nhãn 2027: "gió tây nam 0–8 ngày trước chuyến ↔ sản lượng mực ở SCU, hệ số dương". Chạy đúng script này trên nhãn 2027, không đổi gì.
3. **Việc có giá trị nhất còn lại là xin sản lượng nhiều năm** (tỉnh × tháng, càng nhiều năm càng tốt — 11 mục 6). Với nó mới kiểm được câu "năm gió mùa yếu, mồi kém thì vụ cá cơm / cá nục kém", nơi mắt xích gió ↔ mồi mạnh nhất (r 0,8).
4. Nếu vẫn muốn đưa thông tin mồi cho bà con: trình bày như **bản tin môi trường** (nước trồi mạnh/yếu, nhiều/ít phù du so với mọi năm), **không** gắn chữ "cá".
