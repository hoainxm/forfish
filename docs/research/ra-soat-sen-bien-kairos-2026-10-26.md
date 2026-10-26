# Báo cáo rà soát: làm Sen Biển, giao diện, Kairos và đội 2000 agent khôn hơn

*Gửi anh Long. Bốn mảng đã được rà, và mọi đề xuất đã qua một vòng phản biện. Những đề xuất bị phản biện kết luận "bỏ" đã được gạch khỏi bảng. Đề xuất nào phản biện yêu cầu sửa thì báo cáo ghi theo bản đã sửa.*

---

## 1. Tóm tắt

- **Hiện trạng.** Nền đã chắc và chạy được lúc mất sóng: Sen Biển trả lời qua nhiều tầng ngay trong máy, Kairos đọc bản lưu trước rồi mới gọi mạng, máy xếp dòng tin có test. Có hai chỗ yếu chung. Một là **không đo được mình đúng hay sai**. Hai là **phần minh bạch AI chưa theo kịp** khi agent được cố ý làm cho giống người.
- **Đòn bẩy 1: đo trước rồi mới làm cho khôn.** Gồm bộ kiểm vàng cho Sen Biển (SB-02), mẫu học ghi đường đi cuối cùng của câu trả lời (SB-03), sửa thước đo 85 % tin biển (K15), và vòng đo xem bà con có thật sự tương tác với agent không (A13). Chưa có mấy thứ này thì mọi lần "nâng cấp trí thông minh" chỉ là đoán.
- **Đòn bẩy 2: cổng an toàn và minh bạch AI.** Gồm hậu kiểm câu máy nhà trả về (SB-08), nhãn AI ở mọi kênh (UI-01), công tắc tắt AI tắt được thật (A14 + UI-02), chặn chuyện AI khen ăn theo SDVICO (A8), chặn tương tác của agent thổi điểm xếp bài, và chặn mẫu lừa "hỗ trợ tiền dầu" (K12). Phần lớn việc ở đây công S.
- **Đòn bẩy 3: dùng dữ liệu thật đang nằm sẵn.** Con nước đang có trong máy mà Sen Biển vẫn nói "chưa tải" (SB-05). Hay, bình luận, nghề và cảng nhà chưa được đưa vào máy xếp (K1, K2). Trích nguyên văn NĐ 246 đã có nhưng agent không được dùng để trả lời câu hỏi luật (A10).
- Đa số đề xuất **không cần migration**. Các việc 🔴 đều đã gom ở mục 5. Có một ranh giới anh cần chốt trước: **persona của agent là "góc nhìn nghề", không phải "đời tư bịa ra"**.

---

## 2. Từng mảng

### 2.1 Sen Biển — trí thông minh của trợ lý giọng nói

**Hiện trạng.** Sen Biển trả lời theo một chuỗi nhiều tầng: tai (bộ nghe zipformer trong máy hoặc Web Speech), n-gram v7 với 74 ý, luật lệnh sàn, luật tìm tin Kairos, kho hỏi–đáp 2.297 câu (1.607 câu đã duyệt), `traLoiApp` trả lời trên dữ liệu thật trong máy, và cuối cùng là máy nhà (Gemma 4 e2b) khi có sóng hoặc câu lảng khi mất sóng. Vòng học (ghi mẫu, kéo về, train trên GPU, qua cổng, anh duyệt) đã chạy được.

Còn sáu chỗ yếu:
1. Chuỗi điều phối bị chép ở hai nơi và hai bản đã lệch nhau: màn bản đồ không có nhánh Kairos.
2. Mỗi lượt nói độc lập, không nhớ lượt trước, và chip hỏi lại bị bỏ.
3. Câu máy nhà trả về được đọc nguyên văn, không có bước kiểm.
4. Bộ nghe trong máy chỉ được nạp ở màn bản đồ.
5. Hỏi con nước ở màn khác luôn nghe "chưa tải".
6. Mẫu học ghi kết quả trước khi câu được quyết đi đường nào, nên không đo được tỉ lệ hiểu thật. Hiện mới có khoảng 39 câu thật.

**Điểm mạnh**
- Luật an toàn đặt đúng chỗ: chặn câu ngoài phạm vi trước mọi tầng; việc có hậu quả phải chạm một lần để xác nhận; câu thời tiết luôn kèm "đài duyên hải"; tin bão cũ hơn 12 giờ thì cấm nói "không có bão".
- Phần lớn chạy được khi mất sóng: n-gram, kho hỏi–đáp, bộ nghe WASM, giọng Mỹ Duyên ghép mảnh, và các file /data đều đọc từ cache trước.
- Cổng "chắc" có số đo thật: `doTin` giảm khoảng một nửa số câu đoán sai.
- Vòng học khép kín và giữ riêng tư: chỉ ghi chữ, không thu tiếng, không lưu vị trí, SĐT chỉ lưu dạng băm có pepper.
- Kho hỏi–đáp có gác duyệt ngay trong code (`docKho` chỉ nhận câu `da-duyet`). Có chống chồng tiếng, chống lượt cũ về muộn, lọc tiếng đệm. Gửi ra máy nhà dùng mã thuê bao giả danh.

**Đề xuất (đã qua phản biện)**

| Ưu tiên | Đề xuất | Vì sao (bằng chứng) | Công sức | Rủi ro |
|---|---|---|---|---|
| **P0** | **SB-08 Hậu kiểm câu máy nhà và ngắt mạch.** Thêm `kiemCauDap` thuần vào `cong-ai-ky.ts`: chạy `chuQuyenFlag`; lọc SĐT/STK; thay các câu "chắc chắn có cá"; câu nói về sóng, gió, bão mà thiếu "đài duyên hải" thì nối thêm. Máy nhà lỗi 3 lần trong 2 phút thì 60 giây sau đó trả 503 ngay. | `hoi/route.ts:126-133` trả `j.text` gần nguyên văn. `chuQuyenFlag` chỉ đang dùng ở các route Kairos. `HAN_MS` = 9 s (route.ts:20) và chưa có ngắt mạch. Máy nhà từng sập ngày 24–26/10 (15 §29). | S | Regex chủ quyền có thể bắt oan, nên chỉ thay câu chứ không chặn cả lượt. Ngắt mạch tính riêng từng instance (ghi nợ). Không ảnh hưởng offline. |
| **P0** | **Nhãn nguồn câu trả lời** (phản biện bổ sung). SenHeard thêm trường `nguon: app\|kho\|may_nha`. Câu do máy nhà trả lời thì hiện một dòng nhỏ "Sen Biển hỏi máy nhà — tham khảo". Làm cùng SB-08. | SenHeard (`sen-bien-sheet.tsx` ~101-106) không có trường nguồn nào, nên bà con không phân biệt được số đọc từ máy, câu kho đã duyệt hay câu AI tự sinh. | S | Thấp. |
| **P0** | **Sửa chữ câu lảng lúc mất sóng** (phản biện bổ sung). Bỏ các câu "để dành", "xin khất tới lúc có sóng" cho tới khi SB-09 làm xong. | `cau-vui.CAU_LANG.mat_song` hứa sẽ để dành câu hỏi, nhưng `chonBuoc` nói xong là bỏ (`luong-tra-loi.ts:55`). Đây là lời hứa không có thật. | S | Không có. |
| **P0** | **SB-05 Vá chỗ thiếu dữ liệu thật** (bản sửa). (1) Tách hàm đọc trạm và tính cực trị con nước, hiện nằm trong tide-home-card và hoi-ban-do, ra một lib dùng chung. Nạp một lần lúc thẻ Sen Biển mở, chỉ qua `data-fetch` và cache SW. Máy chưa có file thì nói "Máy chưa có bảng con nước". Kèm caveat của mô hình và cảnh báo khi trạm xa hơn 120 km. (2) `answerWeather` đọc `loadForecast('sea', portId)` của cảng được hỏi, nếu có bản lưu thì đọc kèm mốc "số lưu…". Bỏ phần tên món trong giỏ. | `device-snapshot.ts:243` đặt `tide: null`, nên `answer.ts:309-310` **luôn** nói chưa tải, kể cả khi máy đã có file. Như vậy Sen Biển đang nói sai sự thật. `answer.ts:185-186` cũng bỏ qua cảng khác. | S | Chỉ đọc cache, không gọi mạng, không đụng sw.js. Không được hứa con nước chính xác. |
| **P0** | **SB-06a Chip hỏi lại.** SenHeard thêm `chip?: {nhan, cau}[]`, đổ `clarify.options` vào đó; thẻ vẽ tối đa 4 chip, chạm chip là nói câu đó. Gộp thêm phần phản biện bổ sung: khi Web Speech lỗi network mà máy chưa có bộ nghe, chip và ô gõ trở thành lối chính (13 §11 #4). | `answer.ts:179-181` trả chip "Bác hay đi từ cảng nào?", nhưng toàn app chỉ dùng `a.speak`/`a.text` (`sen-bien-toan-app.tsx:445`), nên chip bị mất. | S | Cần anh trả lời trước một câu: chip bị bỏ khỏi bong bóng là có chủ ý hay không (xem UI-03). Offline tốt. |
| **P0** | **SB-02 Bộ kiểm vàng tối thiểu** (bản sửa). Khoảng 150–200 câu, ưu tiên câu thật đã ẩn danh và câu người viết theo 3 giọng. Mỗi dòng ghi `duyet: <ai>`. Câu sinh từ persona để file riêng, báo số đo riêng. Test chạy trên chuỗi hàm lib đang có (chưa cần SB-01). Có file mốc, mỗi giọng không được tụt quá 1 điểm. | Các bộ kín nằm ngoài git (repo AI-Assistant), nhãn do Opus gán và chưa có người duyệt (15 §18e, §25, §26, §29). Trong ForFish chỉ có 3 câu ghim. Không test nào chạy trọn chuỗi. | M | Câu thật phải ẩn danh trước khi vào git. Câu persona là câu máy viết, không được gộp vào điểm chính. |
| **P0** | **SB-03 bước 1 Mẫu học ghi đường đi cuối** (không migration). Mở rộng tập `TRA` (`mau-hoc.ts:56`) thêm `kho\|app\|may_nha\|truot\|chan`; mã kho, lý do trượt và `doTin` ghi vào `ct`. Ghi một mẫu ở điểm quyết định cuối. Câu "sai rồi / không phải" ở lượt kế đánh dấu mẫu trước đó. Nút "Chưa đúng" là chạm phụ. Bước 2: tab Sen Biển ở /quan-tri. | `ghiMau(text, r)` được gọi **trước** khi kho, app hay máy nhà quyết (`sen-bien-toan-app.tsx:380`). /quan-tri chưa có gì về Sen Biển. Các ngưỡng 0,25 / 0,5 / 0,8 vẫn đang "chờ đo trên câu thật". | M | 🔴 Chỉ mở migration cho bảng 0059 khi thật sự cần cột riêng, và phải hỏi anh trước. Riêng tư và offline không đổi. |
| **P0** | **SB-01 Một bộ điều phối chung** (bản sửa, làm **sau** SB-02). Mở rộng `luong-tra-loi.ts` thành `dieuPhoi(text, ctx, taiNguyen) → {buoc, vet}`, gói đúng chuỗi toàn app đang chạy. Hai component chỉ còn thực thi hiệu ứng. `vet` ghi `{tang, ket_qua, p}` để SB-03 dùng. Không thêm tầng mới. | Chuỗi bị chép ở `sen-bien-toan-app.tsx:328-480` và `fishing-map-view.tsx` ~4226-4427. Màn bản đồ không gọi `hieuTimTinKairos` (đã grep xác nhận). | M | Rủi ro hồi quy ở luồng lõi, nên bắt buộc có bộ vàng trước. 🟡 cross-trục. Cập nhật 02 và 15 cùng commit. Offline không đổi. |
| P1 | **SB-04 Bộ nghe trong máy cho mọi màn** (bản sửa). Toàn app chỉ nạp khi file đã có trong cache SW (`caches.match`). Chưa có thì tải khi bà con mở thẻ lần đầu, lúc đang online và không bật saveData, kèm ngưỡng `deviceMemory`. Thêm `tenUuTienSen()` gồm tên tàu, loài và đảo, nhưng phải đo lại bộ 70 câu (ADR 0011) trước khi bật danh sách dài. | `napBoNghe` chỉ có ở `fishing-map-view.tsx:3095`. Mất sóng ở màn khác thì rơi về Web Speech, mà Web Speech cần mạng. | M | Không tải 79 MB lúc mở app. Máy Android yếu dễ nóng, phải ghi vào 15. |
| P1 | **SB-10 Phương ngữ miền Trung** (bản sửa). Thêm các cặp mô/răng/rứa/chừ/ni… theo khuôn vị trí, đặt ngay trong `normalize.ts`. Áp trước regex của lenh-cho và tim-tin. Xuất cùng bảng sang repo train. Phần nới `amKey` (cuối n↔ng) chỉ bật khi cột giọng Trung của SB-02 tăng mà cột tổng không tụt. | `SYNONYMS` (`normalize.ts:149-183`) không có chữ miền Trung nào, trong khi persona chính là chú Bảy ở Bình Định. | S | Dễ thay nhầm tên riêng ("chị Chi", "ni"), nên khuôn phải hẹp. |
| P1 | **SB-12 Cổng kiểm chéo `trungY`** cho câu kho trên mọi nền: đo độ trùng từ nội dung sau `foldVn` và yêu cầu trùng ít nhất 1 danh từ khoá. | Softmax đóng tự tin sai: câu "hôm qua ăn gì" vẫn ra p 0,999 (15 §26). | S–M | Độ phủ lúc mất sóng giảm, phải đo cả hai chiều. |
| P1 | **SB-11 Chip theo màn** từ `suggestionsFor` (≤4 chip dưới câu chào). Giấy sắp hết hạn chỉ hiện dưới dạng chip, không đọc to. | `suggestionsFor` đã có nhưng không tsx nào gọi. Câu chào cố định (`sen-bien-toan-app.tsx:50`). | S | Không đụng chốt 13 §11 #12. Làm chung với SB-06a và UI-03. |
| P1 | **SB-06b Nhớ ngữ cảnh câu cụt** bằng `ngu-canh.ts` thuần, luật hẹp ("còn mốt?", "ở Quy Nhơn thì sao"). Đo trên SB-02 trước khi bật. | Spec 13 §4.1 chốt mỗi lượt độc lập, trong khi Sen Biển giờ tự nghe tiếp sau mỗi câu trả lời (15 §24). | M | Ghép nhầm sẽ biến câu mới thành câu cũ. |
| P1 | **SB-09 Câu để dành** (bản sửa). Hàng đợi tối đa 10 câu, giữ 7 ngày; có sóng thì gửi kiểu bắn-rồi-quên, có trần thời gian và `.catch`. Lần mở thẻ sau báo nhẹ kèm ngày hỏi. Hai khoá mới vào `NEVER_BACKUP_PREFIXES` và auth-scope. Bỏ khớp gần: chỉ đọc lại câu đã cất khi khớp đúng câu, và chỉ sau khi có SB-08. | Lời hứa "để dành" hiện không có thật (`luong-tra-loi.ts:55`). | M | Thêm hai khoá `forfish.*`. Câu trả lời cũ có thể lỗi thời, nên loại hết các ý phụ thuộc thời gian. |
| P2 | **SB-06c Gửi 2 lượt trước cho máy nhà**, lọc số có từ 9 chữ số trở lên. | `hoi-may-chu.ts:57` chỉ gửi text, màn, cảng, hạng. | S | Đổi chốt 13 §7.3 và ADR 0016, cần anh duyệt. |
| P2 | **SB-07 Gửi máy nhà bản tóm tắt dữ liệu của bà con** (≤1 KB, whitelist khoá), chỉ làm sau SB-08 và SB-03, và chỉ khi số đo cho thấy nhóm câu tổng hợp là nhóm lớn. | `stripForServer` có sẵn (`device-snapshot.ts:285`) nhưng chưa được dùng. | M | Lần đầu dữ liệu bà con rời máy (sang một PC qua Tailscale Funnel), cần anh duyệt. Máy nhà có thể chế số. |
| P2 | **SB-11 phần 2: câu chào nêu việc gấp**, trần 1 lần/ngày. | Đảo chốt 13 §11 #12 (dòng 493). | S | Chờ anh duyệt đổi 13 và 07 §12. |
| P2 | **SB-12 phần 2: phát hành Gemma v2 và NOTICE**, nạp Gemma ở toàn app khi thẻ mở, `dongGemma` khi thẻ đóng quá 60 s. | `GEMMA_BIET_CHON = false` (`gemma.ts:223`). Khi Gemma đồng ý với câu nhất của v5b thì đúng 95,5 %. | M | Chờ anh chốt; còn vướng điều khoản Gemma; tốn khoảng 200 MB RAM. |
| P2 | **SB-13 Thí nghiệm truy hồi bằng vector** tầng ẩn, đặt cạnh bộ phân lớp. Chỉ thay khi điểm trên SB-02 bằng hoặc cao hơn. Câu mới luôn qua trang duyệt người. | `dau-kho.topK` là softmax đóng, mỗi lần thêm câu phải train lại cả file 4,6 MB. | L | Tầng ẩn không được train để so cosine. Chưa làm trước SB-02 và SB-03. |

**Thiếu sót đáng làm thêm**
- Kiểm xem kho đang phát ra production có trộn câu chưa duyệt không. Chú thích trong `sen-bien-toan-app.tsx` ghi "⚠ kho chưa duyệt, bản test", trong khi `docKho` chỉ nhận câu `da-duyet`. Kiểm xong thì sửa chú thích cho khớp.
- Thứ tự làm: SB-08 cùng nhãn nguồn → SB-05 → SB-02 → SB-03 bước 1 → SB-01 → chip → các việc còn lại.

---

### 2.2 UI/UX — Sen Biển, Kairos và khung app

**Hiện trạng.** Giao diện Kairos đã làm kỹ phần mất sóng: đọc bản lưu trước, giữ chỗ đang đọc 10 phút, có pill "Tải tin mang đi", ma trận trạng thái gần đủ 6 cột. Chỗ yếu nhất là **minh bạch bài AI**. Nhãn "AI" chỉ cỡ 0,6875rem, chạm trên điện thoại không ra gì. Dòng giới thiệu L1 không có trong src. Nút loa đọc "Bảy Mực viết: …" mà không nói đó là AI. Thông báo ghi "Có người trả lời bạn" kể cả khi là agent. Phía Sen Biển: bong bóng mới đã bỏ chip, câu chào giống nhau ở mọi màn, câu trả lời tự tắt sau 5 giây. Về tiếp cận: hơn 400 chỗ dùng chữ phụ dưới mức AA, và nhiều nút Kairos thấp hơn thang `--h-chip` của repo.

**Điểm mạnh**
- Dòng tin Kairos đọc bản lưu trước và không bao giờ xoá trắng khi lỗi. Giữ chỗ đọc 10 phút kiểu Facebook.
- Mỗi lỗi có câu thông báo riêng. Câu mất sóng gom về một component `OfflineLine`.
- Nút loa có đường lùi về giọng máy lúc mất sóng. Micro chỉ điền chữ vào ô, không gửi thẳng.
- Lượt hỏi Sen Biển chắc tay: có mã lượt, abort, lọc tiếng vọng, lọc câu đệm.
- Bảng nhãn `NHAN` tập trung và có test gác. Token màu nằm hết trong `@theme`.

**Đề xuất (đã qua phản biện)**

| Ưu tiên | Đề xuất | Vì sao (bằng chứng) | Công sức | Rủi ro |
|---|---|---|---|---|
| **P0** | **UI-01 Nhãn AI rõ ở mọi kênh.** (a) Component `NhanAI` viên 0,75rem nền đặc, chạm vào mở popover một câu, có `aria-label="Trợ lý AI"`. (b) Dòng L1 dưới tên agent. (c) `chuDeDoc` đọc "Trợ lý AI <tên> viết:"; bản sạch để đọc được lưu kèm lúc agent sinh bài (ở agent-dieu-phoi), không chuẩn hoá chữ ở máy khách. (d) Thông báo đổi thành "Trợ lý AI trả lời bạn". | Chip 0,6875rem chỉ có `title` (`post-card.tsx:235`, `user-profile.tsx:380-382`). Dòng L1 chỉ có trong spec 16 dòng 15. `de-dung.ts:38` ghép `${ten} viết:`. `notify-gop.ts:44,52` ghi "Có người…", và route agent gọi notify thật. | M | Không đụng offline, không tốn GPU. Cập nhật 14 §3.2, 16 §6b, 07 và 03 cùng commit. |
| **P0** | **UI-02 Công tắc "Hiện trợ lý AI" tắt đủ** (bản sửa, gộp với A14). (1) `ai=0` lọc bình luận agent ở route bình luận và ở `topComments`. Lúc mất sóng thì lọc trong bản lưu bằng `author.isAgent`. (2) Người đã tắt AI không nhận push do agent gây ra. (3) Đổi nhãn trong `labels.ts`. | `feed/route.ts:15,48` chỉ bỏ BÀI. Route bình luận không nhận tham số `ai`. `topComments` (`supabase-store.ts:252`) không lọc. Push đi qua `server.ts:303-367`, mà server không biết tuỳ chọn của người dùng. | M | Phải chọn: lưu tuỳ chọn `ai` ở server, hay chấp nhận chỉ lọc ở client. Dòng tin sẽ bớt "đông vui". |
| P1 | **UI-02 phần 2: tách số 👍 thành "người · trợ lý AI"**, chỉ hiện trong sheet chi tiết khi chạm, một query, không đụng `hay_count`. | Số Hay đang gộp khoảng 300 lượt Hay mỗi ngày của agent. | S | 🔴 Nếu muốn đổi con số trên thẻ thì phải đụng trigger/hay_count, tức là migration. |
| P1 | **UI-04 "Ý bà con là…?": 2 chip khi Sen Biển phân vân** (khi cách ý nhì < 0,25). Chạm chip thì ghi mẫu học có trường `chon`. Dùng lại khuôn hàng 2 nút xác nhận đang có. | `ngram.ts:128-153` đã tính sẵn ý nhì rồi bỏ đi. `hoiLaiCho` (`lenh-cho.ts:274`) chỉ hỏi lại cho nhóm ý chợ. | M | Ngưỡng conf ≥0,35 phải đo lại trên bộ 13 test. Trường `chon` phải đi qua `lamSachMau` và route /mau. |
| P1 | **UI-05 Bong bóng trả lời** (bản sửa). Thời gian giữ tính theo độ dài câu, có trần, chạm vào thì giữ mở. Lúc chờ máy nhà hiện câu giờ bằng chữ và nút "Thôi" (gọi abort). Thêm nút "Nghe lại" câu cuối. Bỏ phần lịch sử 3 lượt vì trái 07 §245. | `SEN_IM_MS = 5000` (`sen-bien-sheet.tsx:201,596`). Lúc chờ chỉ có ba chấm (dòng 803). | S | Phải giữ luật "không có nút ×". |
| P1 | **UI-03 Chip Sen Biển khi mất tai** (bản sửa). Bước 1 là hỏi anh chip bị bỏ có chủ ý không. Nếu có chủ ý thì chỉ sửa 07 §5d và 13 cho khớp code. Nếu không thì chỉ hiện ≤3 chip khi lỗi network, not-allowed hoặc máy không có bộ nghe. | `sen-bien-sheet.tsx:395` chỉ bảo "chạm ô chat để gõ". Spec 07 vẫn mô tả chip theo route. | M | 🟡 cross-trục. Câu chào là chữ anh đã chốt (`fishing-map-view.tsx:4421`), để sau. |
| P1 | **UI-08 Bình luận nhanh theo ngữ cảnh** (bản sửa). `goiYBinhLuan(post)` thuần, mọi nhãn ≤2 chữ lấy từ `labels.ts` (tin bão, tai nạn chỉ có "Cầu an", "Cảm ơn"). Chip cao `--h-chip`. Gửi chậm 4–5 s với toast "Đang gửi · Hoàn tác" thay vì gửi rồi xoá. | `BL_NHANH` cố định (`de-dung.ts:83`), nên dưới tin có người mất vẫn gợi "Hay quá". Chip chỉ h-9 (`comment-thread.tsx:647`). | S | Push đã gửi thì không rút lại được, vì vậy mới chọn cách gửi chậm. |
| P1 | **UI-09 Kéo nút Kairos về đúng thang vùng chạm** (`h-(--h-chip)`/`h-(--h-ctl)`). Hook WARN khi thấy h-8/h-9/h-10 trên button/Link trong `components/kairos`. **Gộp chung đợt với UI-01 và UI-08.** | `comment-thread.tsx:127`, `composer-sheet.tsx:297`, `kairos-feed.tsx:701,716`… so với `globals.css:342-343`. | S | Thuần giao diện. Sửa 03 cùng commit. |
| P1 | **UI-10 Token chữ phụ `--muted`** (bản sửa). Đạt ≥4,5:1 trên `--field`. Codemod `text-foreground/50–/65` chỉ cho chữ. Hook WARN khi chữ dưới 70 %. Bỏ chế độ "Nắng" ở đợt này. | /65 trên `--field` khoảng 3,9:1; các mức /50–/60 đều dưới AA. Hơn 400 chỗ dùng. | M | 🟡 cross-trục, đụng token toàn app, phải hỏi anh và chụp ảnh so sánh ở 390px. |
| P1 | **UI-11 Nháp dở hiện ra trên ô mời** ("Bài nháp lúc 14:20 — chạm viết tiếp"). Có sóng thì kèm nút mở khung soạn đã điền sẵn. Không tự gửi. | Ô mời cố định (`kairos-feed.tsx:687`). Nháp `forfish.kairos.nhap.v1` chỉ được đọc khi bà con tự mở khung soạn. | S | Ghi người đọc khoá này vào state-registry. |
| P1 | **UI-12 Micro trên ô mời**: chạm là mở khung soạn và nghe ngay, chữ vẫn điền vào ô để xem lại. Máy không có bộ nghe thì ẩn nút. | Hiện cần 4 chạm, trong khi 13 P3 đặt mục tiêu ≤2. | S | Bỏ câu đọc lại tóm tắt nếu máy không có giọng Việt. |
| P2 | **UI-06 "Nghe tin" đọc liền dòng tin** (bản sửa). Bản đầu chỉ dùng giọng máy trong máy, có Dừng/Tiếp, không lệnh giọng. Làm sau UI-01. | Chưa có trong code. | M | Pin và tiếng vọng. Không gọi Mỹ Duyên, nên không tốn GPU. |
| P2 | **UI-07 "Đọc bài này" / "ai viết bài này"** (bản sửa). Thêm biến `baiDangXem` (module, không lưu). Khi tác giả là agent thì trả lời thẳng "là trợ lý AI của Kairos". Bỏ Hay và bình luận bằng giọng. | Snapshot chưa biết bài đang xem. | S–M | Thấp. |

*Đã loại sau phản biện: UI-13 (ảnh bìa báo). Phần lớn đã có sẵn, phần còn lại vướng quyền tác giả ảnh báo chí và cần migration.*

**Thiếu sót đáng làm thêm**
- `user-profile.tsx:11` ghi hồ sơ agent "chưa bật". Cần kiểm hồ sơ agent có đang hiện cho bà con không. Nếu chưa thì dòng L1 phải nằm ở chỗ bà con thật sự thấy: thẻ bài, bình luận, popover `NhanAI`.
- Chưa có chỉ số tại chỗ (tỉ lệ "chưa hiểu", tỉ lệ chạm chip, thời gian chờ máy nhà) để biết UI-03/04/05 có làm Sen Biển khôn hơn thật không. Gắn vào khung `mau-hoc.ts`.
- **Khung app (dock, Trang chủ, bản đồ) chưa được rà.** Các mục "Chưa chốt (hỏi anh Long, 08 §4)" ở 07 dòng 28 (badge dock, câu phụ Kairos, chọn tỉnh tạm…) là backlog có sẵn, cần một lượt rà riêng.

---

### 2.3 Kairos — mạng xã hội nghề biển

**Hiện trạng.** Dòng tin được máy chủ xếp theo từng người: độ mới, gu chủ đề và gu tác giả, gần nhà, tương tác, theo dõi. Sau đó máy đan xen bài và giữ tỉ lệ 85 % tin biển. Bài người thật chưa mở trong 72 giờ luôn đứng đầu.

Máy chỉ học từ 3 tín hiệu: xem, mở, thời gian dừng đọc. Hay, bình luận, cột `views`, nghề và cảng nhà trong hồ sơ đều chưa được dùng. Máy thu có 74 nguồn nhưng chỉ 4 RSS báo tỉnh, và tin biển từ RSS chỉ khoảng 5 %. Kiểm duyệt chỉ đọc chữ: ảnh chỉ được đếm số lượng, bình luận được chấm mà không kèm bài gốc. Chống spam mới chỉ là đếm tần suất. Lúc mất sóng, bản lưu được xếp mà không phân biệt bài đã đọc hay chưa.

**Điểm mạnh**
- Máy xếp thuần, xác định, có test. Phân trang bằng con trỏ, không lặp bài. Luật đan xen nới dần nên dòng tin không bao giờ tắt ngang.
- Offline được nghĩ kỹ: bản lưu tách theo SĐT, có "Tải tin mang đi", hàng đợi tín hiệu giữ lại lúc mất sóng, không có request ngầm khi mở app.
- Chủ quyền được gác ở ba chỗ, và nghiêng về chặn nhầm hơn là bỏ lọt.
- Kiểm duyệt có điểm tin cậy: mô hình không chắc thì hạ xuống "nghi", người trực luôn thắng agent. Prompt coi bài là dữ liệu, cấm `claude -p` dùng công cụ.
- Tab Chính sách làm tốt: lọc theo tỉnh, phân loại tin, tra tên tàu trong PDF, che số CCCD.

**Đề xuất (đã qua phản biện)**

| Ưu tiên | Đề xuất | Vì sao (bằng chứng) | Công sức | Rủi ro |
|---|---|---|---|---|
| **P0** | **K15 phần 1: sửa thước 85 % tin biển.** `laTinBien` chỉ tính bài **agent** là tin biển khi chủ đề là nghe-ca/chinh-sach hoặc `laChuyenBien(body)` đúng. Bài người thật giữ như cũ. Có test ca agent nói chuyện bóng đá. | `laTinBien` trả true với mọi bài không phải báo (`phan-phoi.ts:34-35`). Agent đăng khoảng 60 bài mỗi ngày, có nhóm bài đời thường và bóng đá. | S | Chạm luật 85 % anh đã chốt, nên cần báo anh. Trang sẽ ít bài agent hơn, đúng ý đồ. |
| **P0** | **Đồng thuận giả trong máy xếp** (phản biện bổ sung). Điểm tương tác dùng để xếp chỉ đếm người thật, hoặc hạ trọng số agent thật mạnh. Với bài của agent thì bỏ thành phần `tt`, hoặc chỉ tính bình luận của người thật (xem A9). | `diemBai` cộng `hay_count` và `comment_count` (`phan-phoi.ts:179-181`), trong đó có khoảng 300 Hay và 200 bình luận agent mỗi ngày. Trigger 0065:259 đếm cả Hay của agent. | S | 🔴 Chỉ khi cần cột đếm riêng cho AI. Lọc trong phan-phoi hoặc feed-query thì không cần migration. |
| **P0** | **K1 GĐ1: học từ hành động thật** (bản sửa). `tinHieuCua` lấy thêm `views`. Đọc Hay và bình luận **của chính người đọc** trong 30 ngày (tối đa 300 dòng mỗi bảng), đưa vào `guDoc` (Hay ×2, bình luận ×3). Lướt qua mà không mở thì `thu += min(2, log2(views))`, chỉ áp cho chủ đề và tác giả. Ghi rõ ở /quyen-rieng-tu. | `ReadSignal` chỉ có opened và dwell (`phan-phoi.ts:77-84`). `tinHieuCua` không lấy `views` dù cột có trong 0066:19. | S | Không thêm request ở app. Không đưa Hay của agent vào gu của ai. |
| **P0** | **K12 Chống spam và lừa "hỗ trợ tiền dầu"** bằng hàm thuần ở route ghi. So 3-gram Jaccard, cùng nội dung từ ≥3 tài khoản thì cho vào `cho-kiem`. Tài khoản mới có link, STK hoặc SĐT đi kèm từ khoá tiền thì giữ lại chờ kiểm, người đăng vẫn thấy bài của mình. | `rate.ts:10-23` chỉ có trần theo ngày. Bài hiện ngay, agent xét sau (A17). Tab Chính sách và tính năng tra tên làm mẫu lừa này dễ tin hơn. | S | Phải kiểm có cột ngày tạo hồ sơ chưa. SĐT đứng một mình thì không giữ lại. |
| **P0** | **K14 Mất sóng: bài chưa đọc lên trước.** Khoá mới `forfish.kairos.daxem.v1` (≤500 id, khoảng 20 KB). `rankPage` đẩy bài đã xem xuống dưới. Có vạch "đã xem hết N bài mới". "Tải tin mang đi" đếm theo bài chưa xem. | `xep-bai.ts:32-58` không biết bài đã xem. Hàng đợi tín hiệu bị xả ngay sau khi gửi (`gui-tin-hieu.ts:50-66`). | S | Khoá `forfish.*` mới, nên bắt buộc chạy `qa-offline-acceptance`, ghi vào state-registry và xoá khi đăng xuất. |
| **P0** | **K2 Nghề và cảng nhà thành trục cá nhân hoá** (bản sửa). (1) Khi app không gửi nha/tinh thì feed lấy `home_port`/`que_tinh` từ hồ sơ, đọc cùng lúc với `tinHieuCua` bằng `Promise.all`. (2) `nghe-bai.mjs` dùng lại `tuKhoa` của agent-doi và khuôn so có dấu của `laChuyenBien`, có test âm (mực/mức). (3) `W.nghe = 0.5`. (4) Mời chọn nghề một lần. | Hồ sơ có `NGHE` (`ho-so.ts:11-22`) nhưng `diemBai` (`phan-phoi.ts:164-187`) không dùng. | M | Đổi lựa chọn "chỉ MÃ, không đọc hồ sơ" (`route.ts:9`), phải ghi Assumptions và cập nhật 14 §13. |
| P1 | **K3 Trần 2 bài mỗi tác giả** trong nhóm người thật đứng đầu, phần dư rơi về máy chấm điểm. Phần xếp theo mức liên quan chỉ bật khi số bài người thật trong 72 giờ vượt ngưỡng (ví dụ 40). | `phan-phoi.ts:208-220`: nhóm đứng đầu chỉ xếp theo giờ. | S | Luật anh chốt ngày 2026-10-24, nên hỏi trước phần xếp lại. |
| P1 | **K4 Câu hỏi của người thật tới đúng người** (bản sửa). Tách `laCauHoi` dùng chung với agent-dieu-phoi. Cộng `W_HOI` khi câu hỏi chưa có bình luận **của người thật**, dưới 24 giờ, và người đọc cùng cảng/tỉnh/nghề. | `agent-dieu-phoi.mjs:164` cho agent trả lời rất nhanh, nên điều kiện "0 bình luận" gần như không bao giờ đúng. | S | Chỉ cộng cho bài đã qua `contentFlag`. |
| P1 | **K5 Dòng dẫn sang tin bão chính thức** dưới bài có chữ "bão / áp thấp / cấm biển", đọc bản tin đã lưu kèm giờ cập nhật, không gọi mạng. Bước 2: feed đọc cache bão của máy chủ (đồng hồ 2 s), tắt suất tin nóng khi vùng ảnh hưởng chạm vùng của người đọc. | `phan-phoi.ts` không đọc gì về bão. | S rồi M | Chỉ dẫn bản tin NCHMF, không tự viết dự báo. |
| P1 | **K6 Nguồn báo tỉnh ven biển.** (1) RSS chuyên mục biển của các báo đã có trong `baoDuocPhep`, đặt `chiTinBien`. (2) Google News theo tên cảng, cho anh biết trước. | Chỉ 4 RSS báo tỉnh. 14:269 tự ghi tin biển từ RSS khoảng 5 %. | M | Điều khoản Google News cho sản phẩm thương mại còn "CHƯA RÕ" (14:29). Tốn thêm lượt `claude -p`. |
| P1 | **K10a Kiểm duyệt bình luận có ngữ cảnh** (bài gốc và bình luận cha, cắt ≤300 ký tự). | `luat-kiem-duyet.mjs:119-129` chỉ gửi phần thân bình luận. | S | Thấp. |
| P1 | **K10b OCR ảnh trên GPU nhà**, đưa chữ trong ảnh qua `chuQuyenFlag`, `chongPhaFlag`, `badWordHit`. Bộ phân loại ảnh chỉ đưa lên mức "nghi". | `kiem/route.ts:21` chỉ gửi số ảnh, nên ảnh bản đồ ghi "South China Sea" lọt qua. | L | Mô hình phải có giấy phép thương mại. Ảnh cá, máu cá là chuyện bình thường của nghề, nên chỉ để "nghi". |
| P1 | **K8 Tóm tắt có cấu trúc** (loại tin, tỉnh, từ ngày đến ngày, áp cho ai). Thử phân loại bằng từ khoá có sẵn trước, chỉ hỏi Haiku phần ngày và đối tượng. Ngày và tỉnh bắt buộc đối chiếu với chữ gốc. | `thu-core.mjs:556-569` trả chữ trơn. Đây là nền cho K9, K13 và Sen Biển. | M | 🔴 Cần cột `kairos_posts.su_kien`. Prompt dài hơn chút. |
| P1 | **K9 Báo khi tàu của bà con có tên trong danh sách hỗ trợ.** Câu báo kèm nguyên dòng, số trang và chữ "đối chiếu lại". Phần báo cấm biển làm sau K8. | Đã có `boatsOf` (`server.ts:175`) và `reg_norm` (0075). A105 (14:568) đang chờ anh chốt. | M | Chờ anh chốt A105. Đọc PDF sai thì báo nhầm. |
| P1 | **K13 bước 1: bảng đồng nghĩa nghề cá** (dầu ⇔ nhiên liệu, 48/2010…), xếp kết quả theo số cụm khớp × độ mới. | `tim-tin.ts:99-113` so chuỗi chứa rồi xếp theo giờ. | S | Chạy offline. |
| P1 | **K15 phần 2: script đo gộp hằng tuần**: tỉ lệ mở theo vị trí và loại bài, tỉ lệ tin biển thật ở trang đầu, % bài người thật có phản hồi từ người thật. | Mọi trọng số đang đặt tay. | M | Chỉ số gộp, cùng mục đích đã khai giữ 90 ngày. |
| P2 | **K7 Gom tin cùng sự kiện.** Bước 1 (S, không migration): chọn bản tốt nhất (báo chuyên ngành hoặc báo tỉnh, có mô tả, có ảnh). Bước 2: số "N báo cùng đưa", giữ `NGUON_NONG` song song. | `cung-su-kien.mjs:10` giữ bài đến trước, bỏ bài sau. | S/M | 🔴 Bước 2 cần `so_bao` và `cung_su_kien`. Đổi luật "Tin nổi bật" vừa chốt. |
| P2 | **K11 Vòng học của kiểm duyệt.** (1) Báo cáo tỉ lệ người trực đảo quyết định theo từng luật. (2) Script đề xuất khối ví dụ, người duyệt rồi mới bump `LUAT_PHIEN_BAN`. (3) Nút "Xin xem lại" một lần mỗi bài. | Bảng `overrides` chỉ được ghi mà không ai đọc lại. | M | 🔴 Có thể phải sửa check của `kairos_reports`. |
| P2 | **K1 GĐ2: Nghe, Lưu, Chia sẻ vào tín hiệu** (cột `acts`). | Các hành động này chưa được ghi lại. | S | 🔴 Migration `kairos_reads`. |
| P2 | **K13 bước 2: route `/api/kairos/tim`** dùng ilike trên 30 ngày, đồng hồ 5 s, gác bằng dataGate. Chỉ làm khi số câu "chưa có bài về X" đủ, đúng điều kiện nâng cấp của A88. | Nợ A88 đã ghi sẵn điều kiện. | M | Không cần pg_trgm. |
| P2 | **K15 phần 3: fit trọng số và A/B** khi đủ người dùng. | — | L | Quá sớm lúc này. |

**Thiếu sót đáng làm thêm**
- Agent trả lời câu hỏi của bà con quá nhanh, làm câu hỏi "trông như đã có người trả lời" nên người thật cùng cảng không vào nữa. Nên để agent chờ 30–60 phút không có người thật trả lời, hoặc chỉ trả lời câu hỏi kiến thức chung, không trả lời câu hỏi giá hay tình hình tại chỗ.
- Chặn tác giả hoặc báo xấu bài phải đưa vào tín hiệu xếp như một tín hiệu âm mạnh cho gu tác giả và gu chủ đề.

---

### 2.4 Đội 2000 agent — mô phỏng mạng xã hội

**Hiện trạng.** Đội 2000 agent hiện là một bộ sinh danh tính cố định cộng một bộ điều phối không có trí nhớ. Chỉ bốn trục thật sự làm đổi hành vi: lớp tuổi, vùng, nhóm nghề và mối quan tâm. Tính cách, giọng điệu và phần lớn các vai chỉ là nhãn nhét vào prompt. Vai "giai-thich" không được dùng ở đâu cả. Một lượt chỉ thấy 2 trang dòng tin và 2 bình luận nổi mỗi bài. Sổ trạng thái không nhớ agent đã nói gì. Toàn bộ chữ do **một** lần gọi `claude -p` haiku viết, trong khi spec ghi là Gemma.

Agent trả lời bà con không có căn cứ nào, dù repo đã có trích nguyên văn NĐ 246. Còn bốn lỗ:
1. Công tắc L6 chỉ bỏ bài agent ở dòng tin mặc định.
2. Hay và bình luận của agent được cộng vào điểm xếp bài.
3. Agent được trả lời bình luận gợi ý SDVICO của agent khác.
4. Chưa có vòng đo nào.

**Ranh giới cần nói thẳng.** Yêu cầu "mô phỏng đủ giai cấp, đời tư, hoàn cảnh" va trực tiếp với luật L1 (minh bạch) và L3 (cấm bịa trải nghiệm riêng) của spec 16. Ở quy mô 2000 tài khoản, ranh giới giữa "trợ lý AI có giọng" và **giả làm đám đông** nằm đúng ở chỗ này. Vì vậy các đề xuất dưới đây đi theo hướng **persona = góc nhìn nghề và tri thức**, không phải đời tư giả. Anh chốt ở mục 5.

**Điểm mạnh**
- Danh tính cố định (`agent:<id>`), tách khỏi tên hiển thị. Đây là nền tốt để gắn trí nhớ và quan hệ.
- Máy chủ không tin máy GPU: kiểm lại chữ, chủ quyền, chống phá, luật SDVICO, trần theo ngày.
- Luật SDVICO được kiểm bằng code: bắt buộc có chữ SDVICO, một bài một gợi ý, tối đa 6 lượt/ngày, bỏ tin có người chết.
- Nhắc tên người thật có luật cứng. Nhịp đăng theo giờ và tuổi, có trần đan xen.
- Lỗi thì an toàn: Claude hỏng thì agent im, chỉ còn bấm Hay. Có test thuần cho chân dung và kế hoạch lượt.

**Đề xuất (đã qua phản biện)**

| Ưu tiên | Đề xuất | Vì sao (bằng chứng) | Công sức | Rủi ro |
|---|---|---|---|---|
| **P0** | **A8 Chặn đồng thuận giả về thương mại và chính trị.** Bộ điều phối loại bình luận SDVICO hoặc Sen Biển khỏi hàng trả lời. Máy chủ: bình luận cha có SDVICO thì trả `khong_hua_theo_sdvico`; bài thời sự hoặc pháp luật đã có 1 bình luận agent thì trả `chinh_tri_mot_agent`. Dùng lại chuẩn hoá của `chongPhaFlag`. Test dương và âm cho cả ba nhánh. | `agent-dieu-phoi.mjs:131-133` không loại bình luận SDVICO. Route chỉ chặn khi **chính lời đó** có chữ sdvico, không xem bình luận cha. | S | Rất thấp. Phải làm trước mọi việc làm agent "sống" hơn. |
| **P0** | **A14 L6 đủ: tắt AI thì ẩn cả bình luận, ở mọi màn, cả bản lưu** (gộp với UI-02). Bỏ điều kiện `macDinh`. `topComments` và route bình luận nhận `ai=0`. Client lọc bản lưu theo `isAgent`. Test route. | `boAgent = macDinh && !tuyChon.ai` (`feed/route.ts:46-48`). `feed-client.ts` không lọc bản lưu, trong khi spec 16:79 hứa có lọc. | S | Đụng nhánh đọc bản lưu, nên chạy bộ QA offline. Không đổi khoá. |
| **P0** | **A7 đợt 1 Giao "thế" cho từng lời và chặn vòng AI–AI** (bản sửa). (a) Chuỗi agent trả lời agent chỉ bật khi bài có bình luận người thật trong 24 giờ, tối đa 2 lượt. (b) Bộ điều phối giao `the` tất định: dong-y ≤50 %, không 2 dong-y liền nhau, `phan-bien` chỉ nhắm lời của agent, **không bao giờ cãi bà con**. (c) Bài thời sự hoặc pháp luật chỉ được hỏi lại hoặc kể liên quan. | Chuỗi AI–AI bật 50 % trên mọi bình luận agent (dòng 133). Prompt để model tự chọn (dòng 250). | S | Thấp. |
| **P0** | **A3 Biến nhãn thành hành vi và gỡ nhãn tự mâu thuẫn.** `nguoiDap` nhận thêm `muc`: câu hỏi bà con ưu tiên vai giai-thich và người rành nghề. Viết lại TINH_CACH và GIONG_DIEU, kể cả "hay nhắc an toàn" đang đá với `DAN_AN_TOAN`. Test: không chuỗi nào khớp lưới cấm. Ghi tỉ lệ bị loại theo từng agent. | Vai giai-thich không được dùng (chỉ có vai "hoi", dòng 205). "Theo tui biết", "ngày xưa" (`agent-doi.mjs:83,122`) bị chính prompt và `MO_SAO` loại (dòng 247, 275). | S | Thấp, còn giảm lượt Claude bị phí. |
| **P0** | **A10 Trả lời câu hỏi luật có căn cứ, qua hồ sơ chính thức** (bản sửa). (1) GPU khớp từ khoá với MUC của NĐ 246 (`timCanCu` thuần). Khớp được thì **hồ sơ Sen Biển chính thức** trả lời bằng trích nguyên văn kèm "Điều N NĐ 246/2026"; mở rộng route sen-bien nhận postId và parentId, giữ cổng soát nguyên văn. (2) Persona chỉ trỏ "hỏi Sen Biển", trang Giá hoặc tin bão, **không nêu số**. (3) Kho v5c chỉ dùng sau khi rà sạch mức phạt của NĐ 38/2024. Không đưa dự báo cá vào căn cứ. | Câu hỏi bà con không kèm dữ liệu gì, prompt cấm nêu mức phạt (dòng 249). Trích NĐ 246 và cổng soát đã có (`tuyen-truyen-luat.mjs:1-12`). | M | Dẫn sai điều khoản là rủi ro pháp lý, nên chỉ dùng nguồn đã duyệt. Không đổi L3 cho persona. Sửa spec 16 L3 và §4. |
| P1 | **Trần thông báo do agent gây ra** (phản biện bổ sung), ví dụ 2 tin mỗi người mỗi ngày, đặt ở máy chủ. | Route agent gọi `notifyComment`/`notifyNhacTen` mỗi lần agent trả lời. | S | Thấp. Phải có trước khi tăng lượng hội thoại. |
| P1 | **A2 Hoạt động theo luật luỹ thừa** (bản sửa): khoảng 150 agent lõi, chọn có phân tầng (3 miền × 8 nghề × 3 lớp tuổi), nhân trọng số ở mọi bước chọn. **Giữ nguyên TRAN**, không thêm biến cấu hình. | `chonTheoGio` bốc đều, nên mỗi agent khoảng 33 ngày mới đăng một bài, không ai đủ quen mặt. | S | Agent lõi lộ mặt nhiều hơn, nhãn AI phải thật rõ (UI-01). |
| P1 | **A1 Chân dung v2 = góc nhìn tri thức** (bản sửa). Thêm `gocNhin` (chủ tàu xa bờ, bạn thuyền, thợ máy, nậu vựa…), viết theo kiểu "dân làm thuê hay lo…", không xưng "chồng tui", "nợ tui". Thêm `hocVan`/`doRanh` và `quanDiem` (tranh luận nghề, cấm chính trị và thương hiệu). Bỏ `kinhTe`, vợ ngư dân, con đi học, tín ngưỡng. Dùng PRNG riêng, test 2000 tên y hệt bản cũ. Không cần lưu DB. | Chân dung hiện chỉ có nghề, vùng, tuổi, giọng (`agent-doi.mjs:255-283`). Vai gia đình chính là bịa trải nghiệm riêng, trái L3 và luật prompt dòng 248. | M | **Cần anh chốt ranh giới persona trước.** |
| P1 | **A4 Bộ gõ tất định** (`bo-go.mjs`) chạy trước `goSai`. Câu trả lời bà con, gợi ý SDVICO và lời có căn cứ chỉ gõ tắt nhẹ, không bỏ dấu. Không đụng @Tên, SDVICO, Hoàng Sa, Trường Sa, Biển Đông. "Tật gõ" riêng áp với xác suất ≤40 %. | `kieuGo` chỉ được dặn trong prompt, `ghepViec` chỉ gọi `goSai` (dòng 316). | S | Test: lời đã qua bo-go vẫn qua mọi cổng của máy chủ. |
| P1 | **A9 Hay của agent phải có lý do** (bản sửa). Người bấm phải hợp nghề và đang online, tối đa 2 Hay agent mỗi mục, ưu tiên bài chưa ai đáp. Máy xếp bỏ `tt` với bài agent. Bỏ dòng "trong đó N trợ lý AI". | `agent-dieu-phoi.mjs:209-213` bốc ngẫu nhiên. `comment_count` được nhân đôi trong `tt` (`phan-phoi.ts:180`). | S–M | 🔴 Chỉ khi cần cột đếm AI cho bài người thật. |
| P1 | **A12 Chống lặp xuyên lượt** (bản sửa). `trungLap` shingle trên khoảng 1000 lời đã được nhận; ví dụ cảm thán trong prompt xoay vòng 5 câu từ kho 60–80 câu. Thêm chỉ số nội bộ (distinct-2, tỉ lệ bị bỏ theo lý do). **Bỏ** phần so với người thật và bài đoán kiểu Turing. | Chống sáo hiện chỉ là regex. Ví dụ cố định trong prompt (dòng 246) bị chép lại mỗi ngày. | M | Mục tiêu là đọc tự nhiên, không phải để giấu AI. |
| P1 | **A13 Vòng đo hằng ngày** (bản sửa), 4 số theo mục và theo lõi/đuôi: tỉ lệ lời agent có người thật đáp hoặc Hay trong 24 giờ; p50/p90 thời gian đáp so với mốc 30 phút; báo xấu trên 100 lời; tỉ lệ bị máy chủ từ chối. Chỉnh trọng số bằng tay; bandit để sau 4–6 tuần. | Log chỉ đếm số việc được nhận (`kairos-agent.mjs:69-73`). Mốc 30 phút (§4.2) và luật ≥2 báo xấu (§6) chưa có code đo. | M | Chỉ số gộp, không lập hồ sơ cá nhân. |
| P1 | **Bộ eval agent cố định** (phản biện bổ sung): khoảng 30 bài và bình luận mẫu, chạy `kairos-agent.mjs --thu`, chấm tự động tỉ lệ bị loại. Làm lưới hồi quy cho A3, A4, A7, A12. | Chưa có bộ eval trước khi đổi prompt. | S | Thấp. |
| P1 | **A5 Trí nhớ cho 150 agent lõi** (bản sửa, làm sau A2). Gồm `lapTruong` về nghề và 5 lời gần nhất (≤80 ký tự); mỗi việc đưa 2 lời cũ vào prompt làm mốc giọng. **Bỏ `nguoiThat`.** Test chặn các trường sanLuong, chuyen, gia. | Sổ chỉ nhớ đã làm gì và bỏ sau 3 ngày (dòng 48-56). | M | Prompt dài hơn, nhưng chỉ cho lõi. |
| P2 | **A6 Đồ thị bạn bè trong 150 lõi** (4–6 bạn quen, 1 "bạn hay cãi"), không thêm lượt AI–AI nào. Làm sau A2, A7 và A8. | `banCua` bốc ngẫu nhiên cùng vùng (dòng 87-91). | M | Dễ thành đồng thuận giả. |
| P2 | **A7 đợt 2**: lấy đủ luồng bình luận và giao thế "chot", chỉ khi A13 chứng minh luồng dài có người thật tham gia. | — | M–L | Thêm khoảng 10 request mỗi lượt. |
| P2 | **A15 Lịch âm và mùa nghề** (bản sửa). Đợt 1: truyền ngày âm, tuần trăng và con nước theo quê vào bài kể của nhóm câu mực và lưới. Đợt 2: dịp lễ theo tháng âm có nguồn công khai, không ghi ngày cụ thể, không nói "cúng thì trúng cá". | Prompt chỉ biết tháng dương (dòng 218-222), trong khi am-lich, moon và tides đã có. | S/M | Dễ bịa ngày và rập khuôn văn hoá. |
| P2 | **A11 Sinh chữ bằng mô hình cục bộ.** Hiện chỉ sửa spec 16 §4.3 và §7 cho khớp code. Chỉ thử Ollama cho các câu cảm thán ngắn khi log cho thấy Claude hỏng nhiều, và chỉ ngoài giờ train. | Spec ghi Gemma (16:69,86), code chạy haiku (`kairos-agent.mjs:54`). | S (doc) | Tranh GPU với việc train; tiếng địa phương và chủ quyền kém hơn. |

**Thiếu sót đáng làm thêm**
- Spec 16 lệch code ở nhiều chỗ: §4.3 so với §6; dòng 100 còn ghi "nhắc tin bão + áo phao" trong khi lưới đã cấm; dòng 79 hứa lọc bản lưu mà chưa làm. Phải sửa cùng commit với bất kỳ thay đổi nào ở mảng này.
- Thứ tự: các cổng (A8, A14, A7 đợt 1, A3) trước, rồi A2 → A5 → A6.

---

## 3. Liên mảng: chỗ các đề xuất nối nhau

**Một kho tri thức đã duyệt, dùng chung cho Sen Biển và agent.**
- Trích NĐ 246 và kho hỏi–đáp `da-duyet` là cùng một nguồn cho Sen Biển (kho trong máy, hậu kiểm máy nhà) và cho câu trả lời luật trên Kairos (A10, qua hồ sơ Sen Biển chính thức).
- Vì vậy việc **rà kho v5c theo NĐ 246** phải làm trước, và nó có lợi cho cả hai mảng.
- Về sau, vòng câu mới của SB-13 cũng có thể lấy từ Kairos, nhưng luôn đi qua trang duyệt người.

**Dùng lại hàm, không đẻ bảng thứ hai (nguyên tắc 15 bậc 2).**
- `chuQuyenFlag` dùng ở SB-08, K10b và mọi lời agent.
- `laChuyenBien` dùng cho K15 và K2.
- `laCauHoi` dùng chung cho K4 và agent-dieu-phoi.
- `tuKhoa` nghề của agent-doi dùng cho K2.
- Bảng phương ngữ (SB-10) và bảng đồng nghĩa nghề cá (K13) nên nằm cạnh nhau trong `normalize.ts`, để Sen Biển lẫn tìm tin Kairos cùng hưởng.

**Tín hiệu đọc Kairos nuôi điều phối agent.**
- K1 (Hay, bình luận, `views` của người thật) và A13 (tỉ lệ người thật đáp lời agent) là cùng một dòng dữ liệu nhìn từ hai phía.
- A13 cho biết mục nào của agent có ích để chỉnh tỉ lệ việc. K4 cùng ý "agent chờ 30–60 phút" bảo đảm agent chỉ lấp chỗ khi người thật không vào.
- K15 (thước 85 %), luật "tương tác agent không vào điểm xếp", A9 và K3 (trần tác giả) giữ cho dòng tin không bị agent làm loãng hay thổi phồng.

**Minh bạch AI là một chuẩn chung, không phải nhiều bản vá.**
- UI-01 (nhìn, chạm, nghe, thông báo), UI-02 + A14 (tắt được thật, kể cả push), nhãn nguồn câu trả lời của Sen Biển, trần thông báo do agent gây ra, và UI-07 ("ai viết bài này?").
- Nên viết thành một mục "chuẩn L1/L6" trong spec 16 rồi làm một lượt.

**Một vòng phản hồi chung và một chỗ xem.**
- Các nguồn: mẫu học Sen Biển ghi đường đi cuối và "Chưa đúng" (SB-03), chip chọn ý do chính bà con gán nhãn (UI-04), câu "chưa có bài về X" làm điều kiện cho K13 bước 2, A13, báo cáo tỉ lệ đảo kiểm duyệt (K11), và đo gộp dòng tin (K15).
- Tất cả nên về **một tab "Sức khoẻ AI" ở /quan-tri**, chỉ số gộp, không lập hồ sơ cá nhân.

**An toàn bão dùng một nguồn.** Chip việc gấp của Sen Biển (SB-11), dòng dẫn tin bão dưới bài Kairos (K5), và việc agent chỉ trỏ tới tin bão chứ không đọc số (A10) đều đọc **bản tin bão đã lưu trong máy**.

**Chip làm một lần.** SB-06a, SB-11 và UI-03 cùng là một chỗ trên thẻ Sen Biển. Nên gom thành một thiết kế, sau khi anh trả lời câu "chip bị bỏ có chủ ý không".

**Sen Biển và Kairos.**
- SB-01 tự động đưa nhánh tìm tin Kairos vào màn bản đồ.
- K8 (loại tin, tỉnh) giúp Sen Biển trả lời "tuần này có cấm biển ở Khánh Hòa không".
- K14 (đã xem) và UI-06/07 dùng chung bản lưu.

---

## 4. Lộ trình 3 đợt

### Đợt 1 — 2 tuần (chỉ việc P0)

*Tuần 1: cổng an toàn và minh bạch (hầu hết công S)*
- SB-08 hậu kiểm máy nhà và ngắt mạch, cùng nhãn nguồn câu trả lời.
- Sửa chữ câu lảng "để dành" trong `cau-vui`.
- UI-01 nhãn AI ở mọi kênh.
- A14 + UI-02 (P0) công tắc AI tắt đủ, kể cả push. Làm thành một việc.
- A8 chặn đồng thuận giả về thương mại và chính trị.
- A7 đợt 1 và A3 (bộ điều phối agent).
- K12 chống lừa "hỗ trợ dầu".
- K15 phần 1 cùng luật "tương tác agent không vào điểm xếp".

*Tuần 2: dữ liệu thật và đo*
- SB-05 con nước và thời tiết cảng khác.
- SB-06a chip hỏi lại và chip khi mất tai, sau khi anh trả lời câu về chip.
- SB-02 bộ vàng tối thiểu.
- SB-03 bước 1 mẫu học ghi đường đi cuối.
- K1 GĐ1 và K14.

*Các P0 công M (SB-01, K2, A10): làm cuối đợt 1 nếu kịp, không thì là việc đầu tiên của đợt 2.* SB-01 bắt buộc chạy sau SB-02. A10 bắt buộc chạy sau khi đã rà kho v5c theo NĐ 246.

### Đợt 2 — 1 tháng (P0 còn lại và P1 chọn lọc)

- **Sen Biển:** SB-04, SB-10, SB-11 phần chip, SB-12 `trungY`, SB-06b, SB-09, tab Sen Biển ở /quan-tri (SB-03 bước 2, không migration).
- **UI:** UI-04, UI-05; gộp UI-08 với UI-09 trong một đợt sửa file; UI-11, UI-12; UI-03 theo câu trả lời của anh; UI-10 khi anh duyệt token.
- **Kairos:** K3 (trần tác giả), K4, K5 bước 1, K6 phần 1, K10a, K13 bước 1, K15 phần 2.
- **Agent:** trần thông báo do agent gây ra, bộ eval cố định, A2, A4, A9, A12, A13; A1 và A5 sau khi anh chốt ranh giới persona.

### Đợt 3 — trong quý (P1 nặng và P2)

- **Kairos:** K8 🔴, K9 (khi A105 được chốt), K10b, K5 bước 2, K6 phần 2, K7, K11, K13 bước 2, K1 GĐ2 🔴, K15 phần 3.
- **Sen Biển:** SB-07, SB-06c, SB-11 phần 2, Gemma v2 (SB-12 phần 2), thí nghiệm SB-13.
- **UI:** UI-06, UI-07, cùng một lượt rà riêng cho khung app (dock, Trang chủ, bản đồ).
- **Agent:** A6, A7 đợt 2, A15, thử A11 nếu log cho thấy cần.

---

## 5. Rủi ro và ranh giới anh cần chốt

### 5.1 🔴 Migration: chỉ hỏi, không tự apply (project `znzgugvfhgmiszqgjulk`)

| Đề xuất | Đụng gì | Có đường né không |
|---|---|---|
| SB-03 bước 2 | thêm cột cho `sen_bien_mau` (0059) | Có: bước 1 dùng `TRA`/`ct` sẵn có. Chỉ mở khi thật cần. |
| UI-02 phần 2 / A9 / đồng thuận giả | `hay_count`, trigger, cột đếm AI | Có: lọc ở phan-phoi/feed-query, tách số trong sheet chi tiết. |
| K1 GĐ2 | `kairos_reads.acts` | Không. Để đợt 3. |
| K7 bước 2 | `kairos_posts.so_bao`, `cung_su_kien`, outcome trong `kairos_seen` | Bước 1 không cần. |
| K8 | `kairos_posts.su_kien jsonb` | Không. |
| K11 | check `target_type`/`status` của `kairos_reports` hoặc bảng nhỏ | Tuỳ cách làm. |
| K13 bước 2 | chỉ mục pg_trgm | Có: dùng ilike trên cửa sổ 30 ngày. |
| A1 | `kairos_profiles.agent_meta` | Có: chân dung tính lại tất định được. |
| K12 | cần biết ngày tạo hồ sơ | Kiểm cột có sẵn trước. |

### 5.2 Ranh giới persona của đội agent (quan trọng nhất)

- Yêu cầu mô phỏng đủ giai cấp, đời tư, hoàn cảnh kinh tế, tín ngưỡng va với L1 và L3. Đề xuất chốt: **"persona = góc nhìn nghề và tri thức, không phải đời tư giả"**, ghi vào L3 của spec 16 trước khi làm A1, A5, A6.
- Nếu anh muốn giữ vai gia đình (vợ ngư dân, con đi học…) thì cần một quyết định ghi rõ vào L3. Lúc đó nhãn AI ở UI-01 càng phải làm trước.
- Đi kèm: bỏ hẳn hướng "chấm độ người, mục tiêu khó phân biệt với người thật" (A12). Agent không được cãi bà con (A7).

### 5.3 Đổi các chốt cũ: cần anh đồng ý

- **K2:** feed đọc hồ sơ để lấy cảng nhà, đổi lựa chọn "chỉ MÃ" ở `route.ts:9`.
- **K3:** xếp lại nhóm "người thật đứng đầu" (chốt ngày 2026-10-24). Phần trần 2 bài/tác giả thì không trái ý anh.
- **K15:** sửa cách đếm 85 % tin biển.
- **K7:** thay dần `NGUON_NONG`.
- **UI-03 / SB-06a / SB-11:** chip có bị bỏ có chủ ý khỏi bong bóng ngày 2026-10-17 không? Câu chào là chữ anh đặt.
- **SB-11 phần 2:** đảo chốt 13 §11 #12 "không chủ động nói".
- **UI-10:** token màu chữ phụ toàn app (🟡 cross-trục).
- **A10:** hồ sơ Sen Biển chính thức trả lời luật dưới bài Kairos; route sen-bien nhận postId và parentId.
- **K9:** A105, báo khi tàu có tên trong danh sách hỗ trợ.
- **UI-02:** lưu tuỳ chọn "ẩn AI" ở server để chặn push, hay chấp nhận chỉ lọc ở client.

### 5.4 Chi phí GPU và Claude

- **Tăng lượt `claude -p`:** K6 (thêm nguồn), K8 (prompt dài hơn), A5 (khoảng +30 % prompt, đã thu lại chỉ cho 150 lõi), A10 nếu dùng model mạnh hơn (bản sửa không cần).
- **GPU nhà:** K10b (OCR và phân loại ảnh, cần giấy phép thương mại); A11 (Ollama 12B tranh GPU với việc train, đề xuất hoãn); SB-07 và SB-09 thêm câu cho máy nhà (mỗi người ≤10 câu).
- **Đã cố ý né chi phí:** UI-06 bản đầu không gọi Mỹ Duyên; UI-04 bớt lượt gọi máy nhà; SB-08 cắt thời gian chờ khi máy nhà sập.
- **Dữ liệu di động của bà con:** SB-04 không tự tải 79 MB lúc mở app.

### 5.5 Riêng tư: dữ liệu rời máy

- **SB-07 và SB-06c:** lần đầu dữ liệu của bà con (tóm tắt, lượt trước) rời máy sang máy nhà, một PC qua Tailscale Funnel. Phải đổi 13 §7.3 và ADR 0016, và làm sau SB-08.
- **SB-02:** câu thật vào git phải ẩn danh (bỏ tên người, bỏ số).
- **K1:** ghi thêm vào /quyen-rieng-tu rằng Hay và bình luận được dùng để xếp dòng tin cho chính người đó.
- **Đã cắt khỏi đề xuất:** `nguoiThat` trong trí nhớ agent (A5), lấy mẫu bình luận người thật về GPU (A12), đếm ẩn danh `ai=0` (A13).

### 5.6 Offline: câu hỏi phải trả lời ở mỗi commit

- **Khoá `forfish.*` mới:**
  - K14 (`daxem.v1`): bắt buộc chạy `qa-offline-acceptance`, ghi state-registry, xoá khi đăng xuất.
  - SB-09 (hai khoá): đưa vào `NEVER_BACKUP_PREFIXES` và auth-scope.
- **Đụng nhánh đọc bản lưu:** A14 / UI-02, cần chạy bộ QA offline.
- **Chỉ đọc cache, không gọi mạng:** SB-05, K5 bước 1, chip Sen Biển.
- **Có request nền:** SB-09 (có trần thời gian, có `.catch`, không chặn màn); SB-04 (chỉ nạp khi file đã có sẵn).
- **Ghi người đọc khoá:** UI-11 vào state-registry.

### 5.7 Pháp lý và nguồn

- **Kho hỏi–đáp v5c** được duyệt ngày 2026-10-22, trước khi NĐ 246 thay NĐ 38/2024 (2026-10-26). Phải rà lại mọi mức phạt trước khi dùng làm căn cứ, kể cả cho Sen Biển.
- **Google News** cho sản phẩm thương mại: điều khoản còn "CHƯA RÕ" (K6 phần 2).
- **Điều khoản Gemma** phải xong trước khi phát hành Gemma v2.
- **Ảnh bìa báo:** đã loại UI-13 vì quyền tác giả ảnh báo chí.

### Bốn câu cần anh trả lời để mở đợt 1
1. Chip trên bong bóng Sen Biển bị bỏ có chủ ý không?
2. Anh có chốt "persona agent = góc nhìn nghề, không đời tư" không?
3. Tuỳ chọn "ẩn trợ lý AI" lưu ở server (để chặn push) hay chỉ ở máy?
4. Anh có đồng ý sửa cách đếm 85 % tin biển (K15) và để hồ sơ Sen Biển chính thức trả lời luật trên Kairos (A10) không?