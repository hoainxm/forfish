# Ops — KỊCH BẢN NGHIỆM THU OFFLINE (dành cho đội tester)

> **Load khi**: chuẩn bị phát hành bản có đụng service worker / PWA / dữ liệu tải sẵn, hoặc khi cần chứng minh "app chạy được ngoài biển".

covers: public/sw.js
last_verified: 2026-08-01
ttl_days: 120
gate: warn

> **Mục đích**: cho người TEST (không phải lập trình viên) một danh sách bấm-theo-là-làm-được, và cho người duyệt phát hành một tiêu chí ĐẠT/KHÔNG rõ ràng.
>
> **Vì sao cần**: mọi kết luận offline tới giờ đều là **đọc code**, chưa có máy thật. Ba thứ không đọc code nào thay được: hạn ngạch lưu trữ của iOS, luật xoá dữ liệu sau ~7 ngày của Safari, và app có thật sự mở được khi đang lênh đênh giữa biển hay không.

---

## 0. Chuẩn bị

### Máy cần có

| Mã | Máy | Cách mở app |
|---|---|---|
| **A** | iPhone (iOS 17 trở lên) | Safari — mở web bình thường |
| **B** | iPhone (cùng máy A hoặc máy khác) | **Đã "Thêm vào Màn hình chính"** (A2HS) |
| **C** | Android (Chrome) | Mở web bình thường |
| **D** | Android | **Đã bấm "Cài ứng dụng"** (PWA) |
| **E** | Android máy yếu/cũ (RAM ≤3 GB) nếu có | Đã cài |

> Máy B và D là hai máy QUAN TRỌNG NHẤT — đó là cách bà con thật sự dùng.

### Tài khoản cần có

- **TK-1**: premium còn hạn
- **TK-2**: tài khoản thường (chưa premium)
- **TK-3**: premium **đã hết hạn** (nhờ quản trị viên đặt hạn về quá khứ, hoặc hạ hạng sau khi đã tải dữ liệu)

### Cách xoá sạch để test lại từ đầu

- **iOS Safari**: Cài đặt → Safari → Nâng cao → Dữ liệu trang web → tìm `forfish` → Xoá.
- **iOS bản A2HS**: **xoá icon khỏi màn hình chính rồi thêm lại** (kho của bản cài TÁCH RIÊNG với Safari, xoá dữ liệu Safari không đụng tới nó).
- **Android Chrome**: Cài đặt → Ứng dụng → Chrome → Bộ nhớ → Quản lý dung lượng → xoá theo trang.
- **Android bản cài**: gỡ ứng dụng rồi cài lại.

### ⚠️ Cách giả lập mất sóng CHO ĐÚNG

| Tình huống | Làm thế nào | Ghi chú |
|---|---|---|
| **Mất sóng hẳn** (ngoài khơi xa) | Bật **Chế độ máy bay** | Đúng nhất |
| **Sóng "sống mà chết"** (gần bờ 40–60 hải lý — CA QUAN TRỌNG NHẤT) | Phát hotspot từ điện thoại thứ hai rồi **tắt dữ liệu di động của máy phát**. Máy test nối được wifi, có IP, nhưng không gói tin nào ra internet | Đây là ca làm app treo. **Phải test ca này.** |
| Mạng rất chậm | Đứng ở nơi 1 vạch sóng, hoặc bật giới hạn băng thông trên router | |

> **TUYỆT ĐỐI KHÔNG** dùng nút "Offline" trong DevTools của trình duyệt làm bằng chứng: nút đó khiến request **báo lỗi ngay lập tức** — đúng nhánh mà app vốn đã xử lý tốt. Nó bỏ sót đúng ca gây hại nhất.

### Ghi kết quả

Mỗi ca ghi: **mã ca · mã máy · ĐẠT/HỎNG · ảnh chụp màn hình · giờ**. Ca HỎNG ghi thêm: bấm gì trước đó, chờ bao lâu, màn hình hiện chữ gì (chụp nguyên màn, đừng cắt).

---

## 1. Bộ ca test

### TC-01 — Cài lần đầu ở nơi sóng TỐT
**Máy**: B, D · **Mục tiêu**: cài xong là đủ đồ đi biển.

1. Xoá sạch dữ liệu (mục 0).
2. Mở web, đợi trang chủ hiện đủ.
3. Bấm banner cài đặt → làm theo hướng dẫn (iOS: Chia sẻ → Thêm vào Màn hình chính; Android: Cài ứng dụng).
4. **Mở app vừa cài từ icon**, đợi 30 giây ở màn Trang chủ.
5. Vào **Ra khơi**, đợi bản đồ vẽ xong, đợi popup/chip "dữ liệu đã lưu" chạy xong.

**ĐẠT**: bản đồ vẽ được, thấy đường bờ + đảo; thanh ngày hiện; chip dữ liệu đã lưu báo đã tải.
**HỎNG (chặn phát hành)**: bản đồ trống, hoặc app báo lỗi.

---

### TC-02 — Cài lần đầu khi sóng CHẬP CHỜN 🔴 ca mới sửa
**Máy**: B, D · **Mục tiêu**: app không được "cài xong" trong tình trạng rỗng ruột.

1. Xoá sạch dữ liệu.
2. Chuyển sang hotspot **không có internet** (mục 0) ngay khi vừa bấm cài.
3. Mở app vừa cài.
4. Bật lại mạng thật, đóng app, mở lại, đợi 1 phút.
5. Tắt mạng (máy bay), mở lại app.

**ĐẠT**: ở bước 3 app có thể báo lỗi/không đủ dữ liệu — **chấp nhận được**; nhưng sau bước 4–5 thì app mở được offline và bản đồ vẽ được.
**HỎNG (chặn)**: sau bước 4–5 vẫn trắng màn hoặc bản đồ trống.

---

### TC-03 — Cold start OFFLINE, đủ 6 màn 🔴 ca quan trọng nhất
**Máy**: A, B, C, D, E · **Mục tiêu**: giữa biển mở app là dùng được.

1. Làm xong TC-01 (máy đã có dữ liệu).
2. **Tắt hẳn app** (vuốt khỏi đa nhiệm), bật **Chế độ máy bay**.
3. Mở app từ icon.
4. Bấm lần lượt **cả 5 tab dock**: Trang chủ · Ra khơi · Tàu cá · Bạn thuyền · Giao dịch. Mỗi tab đợi tối đa 10 giây.
5. Trong **Tàu cá** → mở tủ giấy tờ. Trong **Bạn thuyền** → mở sổ thuyền viên. Trong **Giao dịch** → xem bảng giá.

**ĐẠT**: cả 5 tab mở được, KHÔNG trắng màn, KHÔNG kẹt xoay quá 10 giây; giấy tờ và thuyền viên đã nhập trước đó **hiện đúng**; bảng giá hiện kèm **tuần/ngày của bản tin**.
**HỎNG (chặn)**: bất kỳ tab nào trắng màn; hoặc tủ giấy tờ hiện **dữ liệu mẫu** trong khi máy đã có giấy tờ thật (báo gấp — đây là nói dối).

---

### TC-04 — Bản đồ ngư trường offline
**Máy**: B, D · **Mục tiêu**: màn quan trọng nhất phải vẽ được khi không có sóng.

1. Máy đã làm TC-01. Bật máy bay, mở app → **Ra khơi**.
2. Phóng to/thu nhỏ, kéo bản đồ.
3. Chạm một điểm bất kỳ trên biển → xem sheet số liệu.
4. Kéo thanh ngày sang ngày 2, ngày 3.

**ĐẠT**: thấy đường bờ, đảo, đường đẳng sâu **có số mét**; chạm điểm ra được số gió/sóng (có thể ghi "số liệu đã lưu"); kéo ngày đổi được.
**HỎNG (chặn)**: bản đồ xám/trắng hoàn toàn, hoặc mất hết chữ số trên đường đẳng sâu.

---

### TC-05 — Premium hết hạn giữa chuyến 🔴 luật mới
**Máy**: B, D · **Tài khoản**: TK-1 rồi chuyển thành TK-3.

1. Đăng nhập TK-1 (premium còn hạn), vào Ra khơi, bật lớp **Cá**, đợi tải xong. Kéo thanh ngày ra tới ngày 10–16.
2. Nhờ quản trị viên **hạ hạng / cho hết hạn** tài khoản này.
3. Bật máy bay. Mở lại app → Ra khơi → bật lớp Cá.
4. Bật lại mạng thật. Mở lại app → Ra khơi → bật lớp Cá.

**ĐẠT**: ở bước 3 **và** bước 4, bản đồ cá đã tải **vẫn hiện**, thanh ngày vẫn kéo được tới ngày xa. Không tải được **bản mới** là đúng.
**HỎNG (chặn)**: bản đồ cá biến mất, hoặc hiện màn mời nâng cấp đè lên dữ liệu đã tải.

---

### TC-06 — Đổi tài khoản trên máy dùng chung 🔴 riêng tư
**Máy**: B, D · **Tài khoản**: TK-1 rồi TK-2.

1. Đăng nhập TK-1, vào **Bạn thuyền** tra một CCCD, vào **Tàu cá** xem giấy tờ. Đợi 30 giây.
2. Đăng xuất. Đăng nhập TK-2 (tài khoản khác).
3. Xem **Bạn thuyền**, **Tàu cá**, và sheet Tài khoản.
4. Bật máy bay, xem lại các màn đó.

**ĐẠT**: TK-2 **không thấy** kết quả tra cứu, giấy tờ, hay tên/SĐT của TK-1 ở bất kỳ đâu — kể cả khi offline.
**HỎNG (chặn ngay, báo gấp)**: thấy bất kỳ dấu vết nào của TK-1.

---

### TC-07 — Có bản mới rồi ra khơi 🔴 ca từng làm trắng màn
**Máy**: B, D · **Mục tiêu**: cập nhật giữa chừng không được làm hỏng app.

1. Máy đã có dữ liệu (TC-01). Đội dev deploy một bản mới.
2. Mở app khi **còn sóng**, ở lại đúng **20 giây** rồi đóng app (mô phỏng ghé wifi cảng rồi nhổ neo).
3. Bật máy bay. Mở lại app, bấm đủ 5 tab, vào Ra khơi.

**ĐẠT**: mọi tab mở được, bản đồ vẫn vẽ.
**HỎNG (chặn)**: trắng màn, mất kiểu dáng (chữ xô lệch, mất màu), hoặc bản đồ trống.

Lặp lại bước 2 với **5 giây** thay vì 20 giây — ghi kết quả riêng.

---

### TC-08 — Máy gần đầy bộ nhớ
**Máy**: E (hoặc A/B) · **Mục tiêu**: hết chỗ phải NÓI, không được im.

1. Làm máy gần đầy (quay video/chụp ảnh cho tới khi còn <500 MB).
2. Mở app, vào Ra khơi, chạy tải sẵn dữ liệu đi biển.
3. Vào **Tàu cá** → thêm một giấy tờ mới. Vào **Bạn thuyền** → thêm một thuyền viên.

**ĐẠT**: nếu không lưu được thì app hiện **băng đỏ "Máy hết chỗ — CHƯA lưu được…"**.
**HỎNG (chặn)**: bấm lưu xong app im ru mà dữ liệu không có; hoặc tủ giấy tờ quay về **dữ liệu mẫu** mà không nói rõ đó là mẫu.

---

### TC-09 — Sóng "sống mà chết" 🔴 ca hay bị bỏ sót nhất
**Máy**: A, B, C, D · **Mục tiêu**: không được treo, phải dùng bản trong máy.

1. Máy đã có dữ liệu. Nối hotspot **không có internet** (mục 0).
2. Mở app. **Bấm đồng hồ đếm giây.**
3. Bấm lần lượt 5 tab dock.
4. Vào Ra khơi, chạm một điểm đã xem hôm trước.

**ĐẠT**: mỗi tab hiện nội dung trong vòng **5 giây**; Ra khơi vẽ bản đồ.
**HỎNG (chặn)**: bất kỳ màn nào xoay quá 15 giây, hoặc trắng màn.
**GHI RIÊNG (đã biết, không chặn)**: chạm điểm trên bản đồ có thể chờ 15–45 giây mới ra số — ghi lại thời gian đo được, đừng báo là lỗi mới.

---

### TC-10 — Tin bão nói thật 🔴 an toàn tính mạng
**Máy**: mọi máy · **Mục tiêu**: app KHÔNG được nói "không có bão" khi thực ra chưa hỏi được.

1. Bật máy bay. Mở app → Ra khơi, nhìn khu vực banner bão.
2. Nối hotspot không internet. Mở lại app, nhìn lại.
3. Có mạng thật: mở app, nhìn banner bão, **ghi lại giờ trên banner**.

**ĐẠT**: khi không hỏi được, banner nói kiểu **"Chưa hỏi được tin bão — máy không có sóng. Nghe thêm đài duyên hải / Icom"**; khi hỏi được thì có ghi **giờ hỏi**.
**HỎNG (chặn ngay, báo gấp)**: bất kỳ chỗ nào ghi "không có bão" mà không kèm giờ hỏi được.

---

### TC-11 — Đi biển dài ngày
**Máy**: B, D · **Mục tiêu**: dữ liệu cũ phải tự nhận là cũ.

Ngày 0: tải đủ dữ liệu, bật máy bay và **giữ nguyên máy bay**.
Mở app vào **ngày 1, 3, 7** (và ngày 16 nếu theo được):

- Ra khơi: kéo thanh ngày, xem lớp Cá.
- Xem popup "dữ liệu đã lưu".
- Xem bảng giá ở Giao dịch.

**ĐẠT**: app vẫn mở được mọi ngày; số liệu cũ có ghi **lưu từ ngày nào / cũ bao lâu**; giá cá ghi **tuần của bản tin**.
**HỎNG (chặn)**: app không mở được; hoặc số liệu cũ hiện như số liệu hôm nay, không một chữ nào nói là cũ.

---

### TC-12 — iPhone bỏ không 7 ngày 🟡 chỉ iOS · HẠ ƯU TIÊN 2026-08-01
> **Chủ dự án xác nhận**: bà con đều được hướng dẫn **Thêm vào Màn hình chính**, không dùng tab Safari để đi biển. Luật xoá-sau-7-ngày của iOS **miễn cho bản A2HS**, nên ca này còn giá trị ĐO ĐẠC (biết Safari mất bao lâu, để tư vấn khi có người lỡ dùng Safari) chứ **không còn là ca chặn phát hành**. Nhánh **12c là nhánh phải chạy**; 12a/12b chạy nếu còn thời gian.

**Máy**: **BA cấu hình chạy song song** để tách được nguyên nhân:

| Nhánh | Máy | Ngày 1→7 |
|---|---|---|
| **12a** | A (tab Safari) | **Không mở** app lần nào |
| **12b** | A′ (tab Safari, máy/hồ sơ khác) | **Mở app mỗi ngày ~1 phút, GIỮ NGUYÊN chế độ máy bay** |
| **12c** | B (đã Thêm vào Màn hình chính) | Không mở app lần nào |

Ngày 0: tải đủ dữ liệu trên cả ba. Ngày 8: mở cả ba **khi đang bật máy bay**, xem còn dữ liệu không.

**ĐẠT (mong đợi)**: 12c còn đủ. 12a có thể mất — **luật iOS, không phải lỗi app** — nhưng app phải nói rõ là không có dữ liệu, KHÔNG được hiện dữ liệu mẫu như thật.

**12b là câu hỏi mở, chưa ai biết đáp án**: đồng hồ 7 ngày của iOS đếm theo **tương tác của người dùng**, không theo việc có mạng — nên mở app hằng ngày lúc đang máy bay *có thể* đủ để reset. Nếu 12b còn dữ liệu mà 12a mất, ta có một lời khuyên thật để dặn bà con ("mỗi ngày mở app một lần cho dù không có sóng"). Nếu cả hai đều mất thì luật iOS chặt hơn ta tưởng, và bản A2HS là con đường duy nhất.

**PHẢI GHI LẠI DÙ ĐẠT HAY HỎNG** — đây là một trong ba câu hỏi lớn chưa ai trả lời được bằng đọc code.

---

### TC-13 — Bản cài iOS bắt đầu từ kho trống 🔴🔴 CA IOS QUAN TRỌNG NHẤT
> **Nâng ưu tiên 2026-08-01**: vì bà con đều dùng bản Thêm-vào-Màn-hình-chính, đây là ca sát thực tế nhất và là cách MẤT SẠCH dữ liệu dễ xảy ra nhất — bà con làm đúng mọi bước mà vẫn trắng tay, chỉ vì kho của bản cài TÁCH RIÊNG với Safari.

**Máy**: B.

1. Trong **Safari**, tải đủ dữ liệu đi biển.
2. Thêm vào Màn hình chính. **Đừng mở icon vừa tạo.**
3. Bật máy bay. Mở icon.

4. Bật lại mạng, mở icon, đợi tải sẵn xong (chip/popup báo đã lưu).
5. Bật máy bay, mở lại icon, vào Ra khơi.

**ĐẠT**: ở bước 3 app nói rõ **chưa có dữ liệu / cần mở lúc còn sóng** bằng tiếng Việt (banner cài đặt đã ghi câu này); sau bước 4–5 thì đầy đủ như máy Android đã cài.
**HỎNG (chặn)**: bước 3 ra trang lỗi trắng không một chữ tiếng Việt; hoặc sau bước 4–5 vẫn thiếu dữ liệu.

**Ghi thêm cho đội dev**: ở bước 3, lời nhắc "hãy tải dữ liệu" hiện to hay chỉ là chip nhỏ dễ lướt qua? Ghi lại ảnh — đây đang là câu chữ, chưa có gì ép, và là chỗ đội dev cân nhắc làm thẻ nhắc TO ở bản cài khi kho trống.

> Đây là **hạn chế của iOS**, không sửa được bằng code: bản cài dùng kho lưu trữ riêng với Safari. Việc của app là nói trước, không hứa suông.

---

### TC-14 — Toạ độ hiển thị (bản vừa đổi)
**Máy**: mọi máy · nhanh, 2 phút.

1. Ra khơi → chạm một điểm trên biển → xem toạ độ ở sheet.
2. Cài đặt (nút bánh răng ở rail) → mục **Hệ toạ độ**.

**ĐẠT**: mặc định hiện dạng **`8°30′00″N · 109°18′00″E`** — có giây, chữ **N/E** (không phải B/Đ); đổi sang Độ thập phân thì thành `8,50°N · 109,30°E`.

---

## 2. Tiêu chí phát hành

| Mức | Nghĩa | Xử lý |
|---|---|---|
| 🔴 **Chặn** | Bất kỳ ca nào ghi "HỎNG (chặn)" ở trên | Không phát hành cho tới khi sửa xong và test lại |
| 🟡 **Ghi nhận** | Chậm, xấu, khó hiểu nhưng vẫn dùng được | Vào backlog, không chặn |
| ⚪ **Đã biết** | Nằm trong mục 3 dưới đây | Không cần báo, trừ khi nặng hơn mô tả |

**Bắt buộc phải chạy trước mỗi lần phát hành có đụng service worker**: TC-02 · TC-03 · TC-06 · TC-07 · TC-10 · **TC-13** (iOS — bà con dùng bản Thêm-vào-Màn-hình-chính nên đây là ca sát thực tế nhất).

---

## 3. Đã biết, đang xếp hàng sửa — đừng báo trùng

1. Chạm điểm trên bản đồ khi sóng yếu có thể chờ 15–45 giây mới ra số, dù số đó đã có trong máy (luật "mạng trước, máy sau" ở tầng dữ liệu — đang xếp hàng đảo lại).
2. Sau 12 giờ ngoài biển, các lớp dữ liệu không dùng đường tắt trong máy nữa, mỗi lần bật lớp là một lần chờ mạng.
3. Khi nguồn tin bão hỏng, nhịp hỏi lại của app giãn từ 60 giây thành 30 phút.
4. Màn **dẫn đường** chưa nói "chưa kiểm được tin bão" — nếu không hỏi được, nó vẽ tuyến như trời quang.
5. Các trang **ngoài** 6 màn dock (đăng nhập, quản trị) có thể treo lâu khi sóng "sống mà chết".
6. Khu **quản trị** (`/quan-tri`) cố ý **không chạy offline** — luôn phải có mạng.

---

## 4. Ba câu hỏi lớn đợt test này phải trả lời

Đây là những thứ **không đọc code nào thay được**, xin ưu tiên làm và ghi kỹ:

1. **TC-13** — bản A2HS, sau khi chỉ mở đúng một lần lúc còn sóng, ra khơi có đủ dữ liệu không? (thay TC-12 làm câu hỏi số 1: bà con đều dùng bản A2HS, mà kho của nó tách riêng với Safari)
2. **TC-02 + TC-07** — trên máy Android yếu và iPhone, mẻ tải sẵn (~2,7 MB) có chạy trọn trong lúc cài không, hay bị cắt giữa chừng?
3. **TC-03 trên máy B** — bản cài iOS, sau khi chỉ mở đúng một lần lúc còn sóng, có mở được cả 6 màn khi máy bay không?

---

**Người soạn**: đội phát triển · **Bản**: 2026-08-01 · Có ca nào mô tả không khớp app thật thì báo lại để sửa tài liệu — tài liệu sai cũng là lỗi.
