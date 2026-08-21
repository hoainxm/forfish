# Ops — KỊCH BẢN NGHIỆM THU OFFLINE (dành cho đội tester)

> **Load khi**: chuẩn bị phát hành bản có đụng service worker / PWA / dữ liệu tải sẵn, hoặc khi cần chứng minh "app chạy được ngoài biển".

covers: public/sw.js
last_verified: 2026-08-18
<!-- re-verified: 2026-08-18b — `public/sw.js` CÓ ĐỔI (gói F push server): CHỈ ở options của `showNotification` trong nhánh `push` — thêm `{tag: data.tag, renotify: true}` khi payload có `tag` (bão `bao-<khoá>`, đơn `don-<id>`; tin tay không tag → như cũ). KHÔNG chạm `SHELL`/`CRITICAL_SHELL`/tên kho/danh sách cache/allowlist `/api/*`/khoá `forfish.*` ⇒ bộ ca §1–§2 KHÔNG đổi. THÊM ca **N-8** (gom thông báo cùng `tag`) và ghi chú CHẠY LẠI **N-4** vì `/api/push/ack` + `/api/me/messages/read` nay BỎ QUA endpoint không có trong `push_subscriptions` (`counted:0`) — máy đã huỷ đăng ký/endpoint bịa không được đếm nữa. Delta gọi ca mới là "N-6" nhưng N-6/N-7 đã có (đặt hàng / chợ tin) → đánh số N-8. -->
<!-- re-verified: 2026-08-18 - doi chieu bo ca QA voi `public/sw.js` hien tai (ban doi lan cuoi 2026-08-07, mach nay KHONG dung sw.js): 5 kho + ten kho (`sdfish-v6`/`static-v1`/`rsc-v1`/`api-v1`/`tiles-v1`), `SHELL`/`CRITICAL_SHELL`, dau `/__sdfish-shell-ready`, allowlist 9 route `/api/*` va luat cuu 401/403 - tat ca van khop cau chu trong TC-01..TC-13. Them ba ca N-5 (ve tuyen khi chua hoi duoc tin bao) - N-6 (dat hang khi song chap chon, khong duoc ra hai don) - N-7 (cho tin khi mat song), va mot ghi chu dau N-7 tro ve ADR 0004 de lan sau khong ai mo rong ca nay thanh 'kiem co cache chua'. -->
ttl_days: 120
<!-- DOC-STATUS: SUSPECT (2026-08-21) — code 'public/sw.js' doi sau last_verified. DOI CHIEU VOI CODE truoc khi tin. May quan ly dong nay, dung sua tay. -->
gate: warn

<!-- re-verified: 2026-08-07 — sw.js CÓ ĐỔI Ở `CRITICAL_SHELL` (đụng danh sách cache ⇒ theo luật phải soi): THÊM 2 asset tĩnh `/data/vn-islands.v1.json` + `/data/vn-sea-lanes.v1.json` và 4 dải font (`Noto Sans Regular` + `Bold` × `256-511`, `7680-7935` — dấu tiếng Việt cho nhãn đảo/tuyến). KHÔNG bỏ URL nào, KHÔNG đổi tên kho, KHÔNG đổi hình dạng entry, KHÔNG đụng khoá `forfish.*` ⇒ **THÊM url, không cần bump** `SDFISH_CACHE_V` (giữ `sdfish-v6`); `c.add` lúc install tự nhét vào kho đang dùng. Bốn câu soi offline: (a) KHÔNG request runtime mới — hai asset cùng-origin, MapLibre nạp qua kho SW; (b) đụng SHELL nhưng chỉ THÊM (an toàn); (c) KHÔNG đè/xoá dữ liệu đã tải; (d) file tĩnh nằm sẵn trong máy như isobaths/coast, không cần nhánh đọc-bản-lưu riêng. **Ca cần chạy đợt tới**: TC-04 (đã thêm bước 5) — mất sóng, zoom Hoàng Sa/Trường Sa/ven bờ, tên đảo tiếng Việt phải hiện ĐỦ DẤU (không ô vuông); toggle "Tuyến tàu" bật/tắt được. Còn lại bộ bắt buộc §2 KHÔNG đổi hành vi. -->
<!-- re-verified: 2026-08-02k — sw.js CÓ ĐỔI, chỉ ở HÀM DỌN Ô BẢN ĐỒ; KHÔNG chạm `SHELL`, `CRITICAL_SHELL`, tên kho, danh sách cache hay khoá `forfish.*` ⇒ bộ ca offline dưới đây KHÔNG đổi. `trimTileCache` nay hỏi `self.navigator.storage.estimate()`: còn dưới 60 MB trống thì siết trần ô từ 600 xuống 120 (`tranOHienGio`). VÌ SAO: từ bản này payload dự báo nằm ở **IndexedDB** còn ô bản đồ ở Cache Storage — HAI KHO KHÁC NHAU nhưng **dùng chung một hạn ngạch theo origin**, nên trần-theo-SỐ-Ô không nói gì về BYTE: 600 ô nặng vài chục MB vẫn ăn hết chỗ lẽ ra dành cho gói 16 ngày, rồi lượt ghi dự báo kế tiếp hỏng trong khi trần ô "chưa chạm". Ô bản đồ có sóng là tải lại được, dự báo giữa biển thì không — nên khi chật thì hy sinh ô, đúng thứ tự chủ dự án chốt (*"xóa tile cũ trước, không xóa gói dự báo mới nhất"*). Hỏi hỏng / máy không có Storage API ⇒ giữ nguyên trần 600, KHÔNG đoán. CA CẦN THÊM cho đợt nghiệm thu tới: (a) máy còn <60 MB trống, kéo bản đồ nhiều vùng rồi mất sóng — ô cũ bị dọn là ĐÚNG, nhưng **gói dự báo phải còn nguyên** và popup "trong máy có gì" vẫn đủ lớp; (b) máy rộng chỗ — trần vẫn 600, không siết oan. -->

<!-- re-verified: 2026-08-02h — sw.js CÓ ĐỔI, nhưng chỉ ở HÀM DỌN KHI HẾT QUOTA; KHÔNG chạm `SHELL`, `CRITICAL_SHELL`, danh sách cache, tên kho, hay khoá `forfish.*` ⇒ bộ ca offline dưới đây KHÔNG đổi.
(1) `reclaimRoom`: `Math.max(8, keys.length >> 2)` → `keys.length >> 1`. Cái SÀN 8 nuốt luôn cái trần — kho 4–7 mục thì `maxDrop > keys.length` ⇒ vòng lặp **xoá sạch kho** rồi còn chạy tiếp với `keys[i] === undefined`. Ca kích hoạt: máy gần đầy ở cảng, một lượt làm tươi bất kỳ là bay bản dự báo/chunk cuối cùng.
(2) `putWithRoom` thêm cổng `evictable = max != null || trimFn != null`. Kho KHÔNG trần KHÔNG trim = `precacheOne` = **lớp cố định** (vỏ app, nền bản đồ, đường bờ, độ sâu, font) ⇒ từ nay không đường dọn nào chạm tới. Đường dọn hợp lệ duy nhất của lớp này vẫn là đổi tên kho lúc deploy + `activate` xoá nguyên khối — nhánh đó không đổi.
THÊM CA CHO ĐỢT NGHIỆM THU TỚI: dựng máy gần đầy hạn ngạch (tải nhiều ô bản đồ) rồi mở app — phải KHÔNG mất vỏ app và KHÔNG mất bản dự báo đã tải; app hết chỗ thì báo thật, không im lặng xoá. Hai cổng test đọc thẳng `sw.js` khoá cả hai điều trên (`sw-timeouts.test.ts`). -->

<!-- re-verified: 2026-08-02 — sw.js ĐỔI NHIỀU (soát MECE offline, biên bản `audit-offline-2026-08-02.md`): kho tạm lúc cài `sdfish-stage-v1`, đồng hồ cho asset/ô bản đồ/api/điều hướng-nấc-hai/ack, `keepAlive` đưa mọi cú ghi kho vào `waitUntil`, `CRITICAL_SHELL` thêm font Bold, dấu "vỏ đã đủ" ghi kèm danh sách URL để client kiểm lại. ĐỤNG cả `SHELL` lẫn danh sách cache lẫn khoá `forfish.*` (khoá mới `identity.v1`, `inbox.v1`→`v2` có migrate) ⇒ chạy TRỌN bộ bắt buộc ở §2 + 6 ca mới ở §3b. Năm trong sáu ca mới CHỈ tái hiện được bằng hotspot-không-internet. -->

<!-- re-verified: 2026-08-01q — sw.js CÓ đổi (nhánh `notificationclick`): cú báo "đã đọc" trước đây đứng NGOÀI `event.waitUntil` nên trình duyệt được phép giết service worker ngay khi mở xong cửa sổ, cắt request đang bay; nay `waitUntil(Promise.all([focus, ack]))`. KHÔNG chạm `SHELL`, danh sách cache, hay khoá `forfish.*` cũ ⇒ bộ ca offline dưới đây KHÔNG đổi. THÊM một ca cho đợt nghiệm thu tới (xem §1, ca N-4). -->

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
5. 🆕 Zoom vào vùng Hoàng Sa / Trường Sa và ven bờ → đọc **tên đảo tiếng Việt** (vd đảo Phú Lâm, đảo Song Tử Tây, Lý Sơn). Bật/tắt "Tuyến tàu, luồng lạch" trong panel Hải đồ.

**ĐẠT**: thấy đường bờ, đảo, đường đẳng sâu **có số mét**; **tên đảo tiếng Việt hiện ĐỦ DẤU** (không ô vuông, không mất dấu — nhãn đảo dùng dải font 256-511 + 7680-7935 đã nằm trong CRITICAL_SHELL); chạm điểm ra được số gió/sóng (có thể ghi "số liệu đã lưu"); kéo ngày đổi được; tuyến tàu bật/tắt được.
**HỎNG (chặn)**: bản đồ xám/trắng hoàn toàn, mất hết chữ số trên đường đẳng sâu, hoặc **tên đảo ra ô vuông / rớt dấu tiếng Việt** khi mất sóng.

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

1. Chạm điểm trên bản đồ khi sóng yếu có thể chờ 15–45 giây mới ra số, dù số đó đã có trong máy (luật "mạng trước, máy sau" ở tầng dữ liệu — đang xếp hàng đảo lại). **Đã đảo cho dự báo theo CẢNG (2026-08-02); 5 lớp còn lại vẫn vậy.**
2. Sau 12 giờ ngoài biển, các lớp dữ liệu không dùng đường tắt trong máy nữa, mỗi lần bật lớp là một lần chờ mạng.
3. ~~Khi nguồn tin bão hỏng, nhịp hỏi lại của app giãn từ 60 giây thành 30 phút.~~ **ĐÃ SỬA 2026-08-02**: thang lùi 1 phút → 3 → 10 → 30, có TRẦN đúng bằng nhịp lúc khoẻ, và hết hỏng là về nấc đầu ngay.
4. Màn **dẫn đường** chưa nói "chưa kiểm được tin bão" — nếu không hỏi được, nó vẽ tuyến như trời quang.
5. ~~Các trang **ngoài** 6 màn dock (đăng nhập, quản trị) có thể treo lâu khi sóng "sống mà chết".~~ **ĐÃ SỬA 2026-08-02**: điều hướng có trần thứ hai 8 giây rồi lùi về vỏ app; các nút "Đang đăng nhập…"/"Đang lưu…" đều có đồng hồ.
6. Khu **quản trị** (`/quan-tri`) cố ý **không chạy offline** — luôn phải có mạng.

### 3b. Đợt vá 2026-08-02 — kiểm THÊM những gì (soát MECE, biên bản `audit-offline-2026-08-02.md`)

Đợt này đụng `sw.js` + `SHELL` + danh sách cache + khoá `forfish.*` ⇒ **chạy trọn bộ bắt buộc ở §2**, và thêm 6 điểm dưới đây. Năm điểm đầu **chỉ tái hiện được bằng hotspot-không-internet** (§0) — nút Offline của DevTools không dựng lại được ca "sóng sống mà chết".

| # | Kiểm gì | ĐẠT khi |
|---|---|---|
| N-5 | **Hộp thư sau hơn 1 giờ mất sóng.** Đăng nhập ở bờ, nhận vài tin, tắt sóng, để máy nghỉ >1 giờ (hoặc qua đêm), mở lại app | Mục Thông báo **vẫn hiện đủ tin cũ**. Trước đây tin biến mất sạch vì app coi bà con như đã đăng xuất |
| N-6 | **Dấu premium sau nhiều ngày.** Máy premium đã tải đủ, tắt sóng 3 ngày, mở app mỗi ngày | Lớp cá + dự báo >3 ngày **vẫn xem được**; sheet Tài khoản KHÔNG tụt về "Đăng nhập" |
| N-7 | **Bản đồ ở hotspot-không-internet.** Mở `/ngu-truong` khi máy nối wifi không ra được mạng | Trong ~9 giây **hiện hình bờ + đảo trong máy** (không phải mặt xanh trơn). Còn thấy Hoàng Sa, Trường Sa |
| N-8 | **Cài bản mới lúc sóng chập chờn** (bóp băng thông rồi mở app để nó tự cập nhật) | Cài hỏng cũng **KHÔNG làm hỏng bản đang chạy** — ra khơi vẫn mở được app như trước khi cập nhật |
| N-9 | **Lưới toạ độ offline.** Bật lớp lưới toạ độ khi mất sóng | Vẫn thấy **số độ vĩ/kinh** (trước đây mất hết số, im lặng) |
| N-10 | **Chip "đã lưu" nói thật.** Để máy có đủ dữ liệu rồi chờ qua ngày xa nhất của bản dự báo | Chip đổi sang **"Dự báo đã lưu hết hạn — chạm tải lại"**, KHÔNG còn xanh "Đã lưu đủ — tới ngày &lt;ngày đã qua&gt;" |

---

## 4. Ba câu hỏi lớn đợt test này phải trả lời

Đây là những thứ **không đọc code nào thay được**, xin ưu tiên làm và ghi kỹ:

1. **TC-13** — bản A2HS, sau khi chỉ mở đúng một lần lúc còn sóng, ra khơi có đủ dữ liệu không? (thay TC-12 làm câu hỏi số 1: bà con đều dùng bản A2HS, mà kho của nó tách riêng với Safari)
2. **TC-02 + TC-07** — trên máy Android yếu và iPhone, mẻ tải sẵn (~2,7 MB) có chạy trọn trong lúc cài không, hay bị cắt giữa chừng?
3. **TC-03 trên máy B** — bản cài iOS, sau khi chỉ mở đúng một lần lúc còn sóng, có mở được cả 6 màn khi máy bay không?

---

**Người soạn**: đội phát triển · **Bản**: 2026-08-02 · Có ca nào mô tả không khớp app thật thì báo lại để sửa tài liệu — tài liệu sai cũng là lỗi.

### N-4 · Bấm vào thông báo giữa biển thì trang quản trị có ghi nhận không (mới 2026-08-01q)

> **Vì sao có ca này**: cột "đọc" ở `/quan-tri` từng đứng yên ở 0 vĩnh viễn vì cú báo bị trình duyệt cắt giữa chừng. Lỗi chỉ lộ trên MÁY THẬT — chạy trên máy tính không bắt được, vì máy tính không giết service worker như iOS.

| Bước | Làm gì | ĐẠT khi |
|---|---|---|
| 1 | Máy **B** (iPhone đã Thêm vào Màn hình chính) và **D** (Android đã cài): đăng nhập, bật thông báo. **Đóng hẳn app** | |
| 2 | Quản trị viên gửi một tin thử tới đúng tài khoản đó | `/quan-tri` → tab Thông báo hiện dòng tin, cột **nhận** lên trong vài giây |
| 3 | Trên máy, **bấm vào banner thông báo** (đừng vuốt tắt) | App mở ra; sau ~5 giây tải lại `/quan-tri` thì cột **đọc** tăng |
| 4 | Vẫn máy đó, mở app, kéo tới mục **Thông báo** ở trang chủ, để tin hiện trên màn ~2 giây | Cột **đọc** **KHÔNG tăng thêm** — cùng một người, tính một lần |
| 5 | Máy **khác** của cùng người đó làm bước 4 | Cột **đọc** vẫn **KHÔNG tăng** (đếm theo NGƯỜI, không theo máy) |
| 6 | Bật **Chế độ máy bay**, mở app, để tin hiện trên màn | App không quay vòng, tin cũ vẫn đọc được. Cột **đọc** không đổi (chưa báo được) |
| 7 | Tắt chế độ máy bay, **mở lại app**, để tin hiện trên màn | Cột **đọc** lên — biên nhận hụt lúc mất sóng phải báo lại được, không mất luôn |

> **HỎNG** nếu: bước 3 bấm xong mà cột "đọc" không bao giờ lên (⇒ cú báo lại bị cắt — kiểm `waitUntil` trong `notificationclick`), hoặc bước 7 không bao giờ lên (⇒ bản lưu đã đánh dấu nhầm là "đã báo" dù máy chủ chưa xác nhận).

> ⚠️ **CHẠY LẠI N-4 sau 2026-08-18 (gói F)**: `/api/push/ack` và `/api/me/messages/read` nay chỉ đếm khi `endpoint` CÓ trong `push_subscriptions` (không có → `ok:true, counted:0`, client thôi hỏi lại). Kịch bản trên KHÔNG đổi bước nào — máy B/D đang đăng ký thật nên vẫn phải lên. Thêm một kiểm: **tắt thông báo** trên máy D (huỷ đăng ký) rồi bấm banner cũ còn trên màn khoá → cột nhận/đọc **KHÔNG** lên (đúng luật mới), app vẫn mở bình thường.

---

### N-5 · Vẽ tuyến khi CHƯA hỏi được tin bão (mới 2026-08-16, thẩm định P0)

> **Vì sao có ca này**: `stormStatus` giữ đúng bốn trạng thái, nhưng màn bản đồ nén mọi thứ ≠ `co-bao` thành mảng rỗng và planner đọc mảng rỗng là "tuyến không cắt vùng bão nào" ⇒ **mất sóng và trời quang cho ra màn hình y hệt nhau**, ngay tại chỗ bà con quyết định có nhổ neo hay không. Chủ dự án chốt: VẪN vẽ tuyến (giữa biển mất sóng là thường xuyên), nhưng phải nói ra.

| Bước | Làm gì | ĐẠT khi |
|---|---|---|
| 1 | Máy có sóng thật: mở Ra khơi, chạm một điểm ngoài biển, tính tuyến | Khối kết quả **KHÔNG** có dải đỏ tin bão (máy hỏi được thật) |
| 2 | Nối **hotspot không internet** (đừng dùng nút Offline của DevTools — xem §0). Mở lại app, chạm điểm, tính tuyến | Tuyến **vẫn vẽ**; dải **ĐỎ ĐẦU TIÊN** trong khối kết quả nói "…CHƯA kiểm được tin bão… tuyến này KHÔNG đối chiếu bão. Nghe đài duyên hải trước khi đi." Có nêu tuổi bản tin cuối nếu máy từng tải được |
| 3 | Bật máy bay hẳn, xoá dữ liệu web rồi mở app (máy chưa từng có tin bão nào), tính tuyến | Dải đỏ nói "Máy chưa có tin bão nào…", KHÔNG bịa tuổi |
| 4 | Có mạng lại, tính tuyến mới | Dải đỏ biến mất |

> **HỎNG (chặn ngay)**: bước 2 hoặc 3 mà tuyến vẽ ra **không có** dải cảnh báo nào — nghĩa là app đang ngầm nói "đã đối chiếu bão" trong khi chưa hỏi được.

### N-6 · Đặt hàng khi sóng chập chờn — KHÔNG được ra hai đơn (mới 2026-08-16)

> **Vì sao có ca này**: POST đơn có thể ghi được ở máy chủ rồi phản hồi mới rơi mất; client hết 20 giây báo "chưa gửi được", bà con bấm lại ⇒ hai đơn thật, giao hai lần, thu tiền hai lần. Chỉ kiểm được đầy đủ **sau khi apply migration 0034**.

| Bước | Làm gì | ĐẠT khi |
|---|---|---|
| 1 | Thêm vài món vào giỏ ở tab Sản phẩm → Cửa hàng, mở giỏ, điền SĐT nhận hàng | |
| 2 | Bóp mạng (DevTools → Network → Slow 3G, hoặc hotspot yếu), bấm **Đặt hàng**, chờ tới khi hiện lỗi "Chưa gửi được…" | Nút trả về được, KHÔNG kẹt "Đang gửi…" |
| 3 | Có mạng lại, bấm **Đặt hàng** lần nữa | Hiện "Đã gửi đơn đặt hàng" |
| 4 | Mở "Đơn của tôi" và `/quan-tri` tab Đơn hàng | **ĐÚNG MỘT đơn** cho lần đặt đó |
| 5 | Đặt tiếp một đơn khác (giỏ mới) | Đơn thứ hai vào bình thường — mã giỏ mới, không bị coi là bản trùng |

> **HỎNG**: bước 4 ra hai đơn (⇒ `clientRef` không tới máy chủ hoặc unique index chưa apply), hoặc bước 5 không đặt được (⇒ mã giỏ không được làm mới sau khi giỏ xoá).

### N-7 · Chợ tin mua/bán khi mất sóng (mới 2026-08-16)

> ⚓ **ĐỌC [ADR 0004](../../adr/0004-pham-vi-offline-chi-du-lieu-di-bien.md) TRƯỚC KHI MỞ RỘNG CA NÀY** (chủ dự án chốt 2026-08-17): chợ tin · đơn hàng · cửa hàng **KHÔNG nằm trong lời hứa offline**. Ca này KHÔNG kiểm "có cache hay chưa" — nó chỉ kiểm hai thứ: app **không treo/không sập**, và **nói đúng lý do**. Bước 2 dưới đây đòi "giữ nguyên danh sách" nghĩa là giữ bản **đang có trên màn**, không phải yêu cầu lưu thêm gì xuống máy.

| Bước | Làm gì | ĐẠT khi |
|---|---|---|
| 1 | Có mạng: vào Giao dịch → chợ tin, đăng một tin thử | Tin hiện trong danh sách, có nút "Đánh dấu đã xong" và "Xóa" |
| 2 | Hotspot không internet, mở lại mục chợ tin | Danh sách **giữ nguyên** bản vừa tải + dải vàng "Chưa tải được tin mới — máy đang không có sóng…". **KHÔNG** được nhảy sang TIN MẪU |
| 3 | Vẫn mất sóng: bấm "Đánh dấu đã xong" rồi bấm "Xóa" | Mỗi lần đều hiện câu đỏ "Chưa đổi được…/Chưa xoá được… cần có mạng". Tin **không** biến mất khỏi màn |
| 4 | Có mạng lại, làm lại hai thao tác đó | Ăn thật, danh sách cập nhật |

> **HỎNG**: bước 3 bấm xong im lặng không đổi gì (khuôn "nút bấm không được gì"), hoặc bước 2 màn hình đổi sang tin mẫu (bà con tưởng tin mình vừa mất).

### N-8 · Thông báo cùng một chuyện phải GOM, không xếp chồng (mới 2026-08-18, gói F)

> **Vì sao có ca này**: trước đây mỗi lần bão lên cấp hoặc đơn hàng đổi trạng thái là thêm một banner mới trên màn khoá — 4–5 dòng chồng nhau, dòng mới nhất (nguy hiểm nhất) lẫn giữa dòng cũ. Nay server gửi `tag` (`bao-<khoá>` cho bão, `don-<mã đơn>` cho đơn) và `public/sw.js` gọi `showNotification` với `{tag, renotify:true}` → tin mới cùng cơn/cùng đơn ĐÈ tin cũ, vẫn rung/kêu lần đè (bão lên cấp phải đánh thức được). Tin tay của quản trị viên KHÔNG có `tag` → mỗi tin một banner như cũ. Chỉ kiểm được trên MÁY THẬT (Android/iOS đã bật thông báo, app ĐÓNG).

| Bước | Làm gì | ĐẠT khi |
|---|---|---|
| 1 | Máy **B** (iPhone A2HS) và **D** (Android PWA): đăng nhập, bật thông báo, **đóng hẳn app** | |
| 2 | Quản trị viên đổi trạng thái MỘT đơn của tài khoản đó 2 lần liền: `dang_giao` → `da_giao` (tab Đơn hàng /quan-tri) | Màn khoá chỉ còn **1 banner** cho đơn đó — nội dung là bản MỚI ("đã giao"), máy có **rung/kêu lần 2** |
| 3 | Đổi thêm trạng thái `da_nhan` cho một đơn khác | **KHÔNG** có banner nào (đã-nhận chỉ vào hộp thư, không rung máy); mở app → mục Thông báo có tin |
| 4 | Quản trị viên gửi 2 tin TAY liên tiếp (tab Thông báo, "Tất cả") | **2 banner riêng** trên màn khoá (tin tay không gom) |
| 5 | (Nếu đang có bão thật hoặc dựng được tin bão thử) chờ cron `notify-storms` chạy 2 nhịp mà cơn bão lên cấp | Vẫn **1 banner** cho cơn đó, chữ là cấp mới, có rung lại; cơn KHÔNG đổi cấp → không thêm banner (khử trùng 48h) |
| 6 | Bấm banner đơn ở bước 2 | Mở đúng `/tau?tab=san-pham`; bấm banner bão → mở `/ngu-truong` (⚠️ chưa mở đúng thẻ bão theo `?bao=` — nợ đã ghi, không tính hỏng) |

> **HỎNG**: bước 2 ra 2 banner chồng nhau cho cùng một đơn (⇒ `tag` không tới sw.js hoặc `renotify` thiếu), hoặc bước 4 hai tin tay bị gom mất một (⇒ tin tay bị gắn tag nhầm), hoặc bước 3 máy rung cho `da_nhan`.
