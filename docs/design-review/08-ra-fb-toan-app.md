# 08 — Rà UI/UX "trải nghiệm Facebook" TOÀN APP (2026-10-25)

> Anh Long 25/10: *"theo phương pháp rà soát ui ux trải nghiệm facebook, tổ chức rà soát lại toàn bộ app, không giới hạn trong Kairos, để tối ưu toàn bộ ui ux trải nghiệm"*.
> Phương pháp đã dùng 2 vòng cho Kairos (commit 539c6758 · 025c3eca): **so từng màn, từng tương tác với cách Facebook (và Zalo/Shopee/Google Maps khi sát hơn) làm** — FB đã dạy hàng tỉ người một bộ phản xạ; chỗ nào app làm khác mà không có lý do là một chỗ bà con phải học lại. Không phải "làm giống FB cho giống".
> Kết quả: **158 phát hiện** (27 CAO · 88 VỪA · 43 THẤP) trên 8 khu, mỗi phát hiện có `file:line` + ảnh đo thật 390×844. Lô sửa 1 (CAO + công S/M, không đụng nghiệp vụ) làm ngay trong đợt này; phần còn lại là backlog bên dưới. Bằng chứng thô (ảnh, script Playwright, log đo DOM) nằm ở thư mục tạm của phiên, không đưa vào repo.

## 0. Cách tổ chức

| Bước | Làm gì |
|---|---|
| 1 | Chụp 24 route ở 390×844 DPR2 bằng Playwright, đăng nhập acc test (`scripts/test-account.mjs cap`), khung đầu + cả trang. |
| 2 | Viết **12 trục so với FB** (bảng dưới) + thang CAO/VỪA/THẤP + khuôn phát hiện. |
| 3 | 8 agent rà song song 8 khu, mỗi agent tự viết Playwright để mở sheet/popover/gõ form/goBack và đo DOM; CHỈ rà, không sửa. Mỗi khu trả FINDINGS: cảm giác lần đầu mở · phát hiện · Top 5 · "Đã kiểm, ĐẠT" (để không ai sửa hỏng). |
| 4 | Điều phối gộp, tách **chủ đề xuyên app** (một lỗi gốc nhiều khu cùng thấy), chia lô: lô 1 = CAO + S/M + không cần quyết định nghiệp vụ; lô sau; câu hỏi cho chủ dự án. |
| 5 | 9 agent sửa song song theo khu, mỗi agent chỉ chạm danh sách file của khu mình (tránh đè nhau); doc cập nhật một lượt ở bước 6. |
| 6 | Test + tsc + eslint + pre-commit, cập nhật 07/03/02/14, commit một lần kèm câu trả lời offline. |

**12 trục so với Facebook**: (1) đầu màn · (2) thẻ/hàng · (3) hành động cạnh tay · (4) nạp & chờ (skeleton, kéo-làm-mới, lạc quan) · (5) trở lại đúng chỗ · (6) nhập liệu · (7) biên nhận trong 100 ms · (8) thông báo & số đếm · (9) ảnh/media · (10) chữ & nhãn · (11) nhất quán toàn app · (12) ngoài biển (riêng ForFish).

## 1. Chủ đề XUYÊN APP — một lỗi gốc, nhiều khu cùng thấy

| # | Chủ đề | Thấy ở | Gốc | Lô |
|---|---|---|---|---|
| X1 | **Back của máy/trình duyệt RỜI TRANG thay vì đóng lớp nổi** (sheet, popover, hộp xác nhận, ngăn gió sóng, bong bóng Sen Biển) — mất luôn chữ đang gõ; PWA Android back = thoát app | 7/8 khu đo thật (`goBack()` ⇒ `about:blank`) | `ui/bottom-sheet` · `confirm-dialog` · `popover` · `snap-sheet` · `sen-bien-sheet` không `pushState`/`popstate`; mẫu đúng duy nhất `kairos/xem-anh.tsx` | **1** — hook chung trong `lib/dialog-focus.ts` |
| X2 | **Icon Sen Biển nổi đè đúng cột nút/chevron của mọi danh sách** (nút "Thêm" bảo dưỡng, "Xem biểu đồ giá", ảnh món, "Đọc bài gốc") | Trang chủ · Tàu tôi · Chợ cá · Vật tư · Kairos | `lib/sen-bien/vi-tri.ts` để 96 px trên dock, trái spec 13 §5.1 (0.75 rem) | **1** — về đúng spec + chừa đáy; "nghỉ thì nép mép" lô sau |
| X3 | **Lỗi nhập liệu không ở dưới ô**: bong bóng tiếng Anh của trình duyệt, lỗi ở chân sheet, lỗi vẽ sau lưng ngăn, băng đỏ đầu thẻ cách ô 111 px | Auth · Tàu tôi · Chợ cá · Vật tư | `Field` (`ui/primitives`) chưa có `error`; mỗi form tự chế | **1** — `Field error` + `noValidate`; áp theo khu |
| X4 | **Quay lại mất chỗ**: cuộn về 0, tab/chip về mặc định, danh sách tải lại | `/cho` · shop · `/ban-hang/don` · `/tau↔/nguoi` · `/tien` chip · `/cho/don` tab | Chỉ `/cho/tim` (`list-state`) và Kairos (`giu-cho`) làm đúng | **1** (chợ, bán hàng, tàu, chip `/tien`) |
| X5 | **Thao tác câm**: ConfirmDialog ngồi im tới khi server trả lời, bấm đúp ra lỗi giả; xoá không "Hoàn tác"; đăng xong không "Đã đăng" | Vật tư đơn · Tàu tôi · Chợ cá | thiếu `busy` guard, thiếu toast chung | **1** (busy, "Đã đăng") · toast chung lô sau |
| X6 | **Hành động phá huỷ một chạm**: "Đăng xuất" đầu menu không hỏi mà `wipeOwnerDataFromDevice()`; "Xác nhận xóa" làm nhãn nút trên thẻ | Trang chủ · Chợ cá | — | **1** |
| X7 | **Modal/thẻ tự bật chặn màn**: "Đồ này của tàu nào?" khi mở `/tau`; ngăn địa chỉ tự bật ở yêu cầu đặt hàng | Tàu tôi · Vật tư | — | **1** |
| X8 | **Nhiều khuôn cho một việc**: 25 câu mất sóng, 5 khối offline/lỗi ở chợ, 4 khuôn bản ghi trên `/tau`, 2 hình nút cam, chip chọn còn màu `t3`, 3 kiểu khối trống, header 3 cỡ icon | mọi khu | thiếu component chung (`OfflineLine`, `Toast`, `ListSkeleton`) | 1 phần (chợ) · còn lại lô sau |
| X9 | **Chữ hướng dẫn / câu phụ** dưới tiêu đề, `RefNote` nền màu ở trạng thái yên, 3 khối chữ trước danh sách cảng | Auth · Kairos · Cảng · Đầu mối | — | 1 (auth, cảng, đầu mối) · Kairos câu phụ chờ anh |
| X10 | **Số đếm/badge không khớp**: "25 mới" mà không hàng nào có chấm; cùng cơn bão 6 hàng; dock không badge; chấm cam cố định trên logo Kairos | Trang chủ · dock · Kairos | `gomTinTrung` gom theo url có `lat/lon/t` | 1 (gom theo `bao=`) · badge dock + chấm logo chờ anh |

## 2. Mẫu Kairos đã đúng FB — nên LAN ra toàn app (từ khu Kairos vòng 3)

`lib/kairos/giu-cho.ts` (giữ chỗ 10 phút) → `/cho`, `/tien`, `/nguoi`, Thông báo · `keo-lam-moi.ts` → tách hook cho mọi danh sách · `post-skeleton.tsx` → `ui/list-skeleton` thay `animate-pulse` tự chế ở chợ · `use-vung-nhin.ts` → mọi thanh dính đáy (chat Sen Biển, ghi chú đặt hàng) · `xem-anh.tsx` → ảnh món/giấy tờ/đánh giá · `chu-xem-them.tsx` → mô tả món, tin mua/bán · toast `role=status` của `use-post-actions` → `ui/toast` chung · cặp `chonCamXuc/chotCamXuc` → theo dõi shop, lưu món, đã đọc · `composerGate` nghe sự kiện `online` → mọi form gửi · `saveDraft` + hộp Lưu nháp/Bỏ/Viết tiếp → mọi form dài · pill "Có N bài mới" → thông báo, chợ tin, đơn người bán · chuỗi offline chuẩn "Mất sóng — bài lưu lúc HH:mm dd/MM".

## 3. Backlog theo khu (mã = FINDINGS của khu; ✅ = lô 1 đã sửa · ⏭ = lô sau · ❓ = cần anh Long/BA chốt)

Trạng thái cột cuối được cập nhật khi lô 1 commit (xem §5).

### 3.1 Vỏ app · dock · primitive · Sen Biển · đăng nhập (VO-APP, 17)
| Mã | Mức | Tóm tắt | Lô |
|---|---|---|---|
| 01 | CAO | Back không đóng lớp nổi (X1) | ✅ |
| 02 | CAO | Sen Biển nổi đè nút (X2) — vị trí 0.75rem trên dock + nâng theo thanh mua + rảnh 4 s nép mép | ✅ |
| 03 | VỪA | Dock không badge số (Kairos chưa đọc / giỏ) | ✅ lô 2 |
| 04 | VỪA | Lỗi auth đầu thẻ, không viền ô, 2 câu/1 lỗi | ✅ |
| 05 | VỪA | "Quên mật khẩu?" to như nút, "Đăng ký" bé — ngược FB | ✅ |
| 06 | VỪA | Dock hiện trên 5 màn auth/pháp lý trái 07 §5 | ✅ |
| 07 | VỪA | Header 3 khuôn: chip SĐT 177 px · Kairos 107 px + câu phụ + nút chữ · ‹ 56 vs icon 44 | ✅ lô 2 |
| 08 | VỪA | 25 biến thể câu mất sóng → `OfflineLine` chung | ✅ lô 2 |
| 09 | VỪA | `lockBodyScroll` chỉ `overflow:hidden` (iOS bỏ qua) | ✅ lô 2 |
| 10 | VỪA | UpdateNotice đè header, reload không kiểm form | ✅ |
| 11 | VỪA | Đăng xuất một chạm (= TC-03) | ✅ |
| 12–17 | THẤP | câu phụ auth · "Hiện/Ẩn" chữ · focus radius 4px · chạm lại tab cuộn lên · quên-mật-khẩu nhánh không ô · nhãn luật mật khẩu thường trực | 12/14/16/17 ✅ · 13 ❓ · 15 ⏭ |

### 3.2 Trang chủ (TC, 18)
| Mã | Mức | Tóm tắt | Lô |
|---|---|---|---|
| 01 | CAO | Cùng cơn bão 6 hàng — gom theo `bao=` | ✅ |
| 02 | CAO | 26/28 link `/ngu-truong?bao=` là ngõ cụt — bản đồ không đọc | ✅ (khu bản đồ) |
| 03 | CAO | Đăng xuất đầu menu, không hỏi, xoá sổ trong máy | ✅ |
| 04 | VỪA | Back không đóng popover (X1) | ✅ |
| 05 | VỪA | "25 mới" ≠ chưa đọc thật; đọc offline không tắt chấm | ✅ lô 2 |
| 06 | VỪA | "Tin cũ N giờ" vàng cho mọi tin, nói giờ hai lần | ✅ (chỉ tô cho bão ≤14 ngày) |
| 07 | VỪA | "Cài đặt khác" xoè Popover 708 px cuộn trong | ✅ lô 2 |
| 08 | VỪA | "Gọi SDVICO để mở…" không có nút | ✅ |
| 09 | VỪA | Bật push chôn 3 nấc | ✅ lô 2 |
| 10 | VỪA | 2 request lúc mở app chỉ để nuôi menu đóng | ✅ |
| 11 | VỪA | Chưa khai cảng nhà ⇒ Trang chủ trống, không mời | ✅ lô 2 |
| 12 | VỪA | "Xem thêm 25" xoè một lượt, Thu gọn nhảy | ✅ |
| 13–18 | THẤP | body=title in 2 lần · chevron › xoè tại chỗ · "theo dõi máy" · xưng hô · px-1 · ⋯ ẩn tin | 13–17 ✅ · 18 ⏭ |

### 3.3 Bản đồ `/ngu-truong` + Cảng `/cang` (BD, 19)
| Mã | Mức | Tóm tắt | Lô |
|---|---|---|---|
| 01 | CAO | `/cang` không có đường vào nào trên UI | ✅ |
| 02 | CAO | "Đi đâu?" = tường Premium / 2 ô toạ độ, không gõ tên cảng | ✅ lô 2 |
| 03 | CAO | Back văng về `/` khi mở ngăn/Lớp (X1) | ✅ |
| 04 | CAO | Thẻ cảng không chạm được, không hành động | ✅ |
| 05–06 | VỪA | 3 khối chữ trước cảng đầu (44 % màn) · câu trống trỏ nút không có | ✅ |
| 07 | VỪA | Panel Thời tiết 85 % màn, jargon, lặp tin bão | ✅ lô 2 |
| 08 | VỪA | ⚠ ba nghĩa trên một màn | ✅ lô 2 |
| 09–12 | VỪA | chip ngày 36 px nở theo chữ · pill ranh giới luôn đỏ · loa tự bật khi định vị chặn · bảng Lớp 2 nút đóng | ✅ |
| 13 | VỪA | Ngăn "Dữ liệu đã lưu" băng iPhone 4 dòng | ✅ |
| 14–19 | THẤP | dấu chấm thừa aria · pill bão 360 px · chip "Cảng loại II" · ô tìm không × · "Giữ mở" chưa vào labels · Esc không đóng ngăn | 14–17/19 ✅ · 18 ⏭ |

### 3.4 Tàu tôi `/tau` + `/nguoi` (TAU, 20)
| Mã | Mức | Tóm tắt | Lô |
|---|---|---|---|
| 01 | CAO | Back rời trang khi sheet mở (X1) | ✅ |
| 02 | CAO | Modal "Đồ này của tàu nào?" tự bật khi mở màn / sau Lưu | ✅ |
| 03 | CAO | Lỗi nhập 3 kiểu (bong bóng tiếng Anh, chân sheet, treo sau khi sửa) | ✅ |
| 04 | CAO | Sen Biển đè nút "Thêm" bảo dưỡng (X2) | ✅ |
| 05 | VỪA | 4 khuôn bản ghi trên một màn (bảo dưỡng/đồ tự ghi còn thẻ băng màu) | ✅ lô 2 |
| 06 | VỪA | Chip tàu "Chạm để ghi tên, mã tàu" dù đã có tên | ✅ |
| 07 | VỪA | Bấm "Hủy" sau khi gõ đóng thẳng (vuốt thì hỏi) | ✅ lô 2 |
| 08 | VỪA | PremiumLock chèn giữa form; nút "Cảnh báo" bật rồi mới rào | ✅ |
| 09 | VỪA | Người mới đỏ "Chưa có bảo hiểm · N kẹt giấy tờ" | ✅ lô 2 |
| 10 | VỪA | Chân sheet 5 kiểu, Xoá đỏ ngang Lưu, "Hủy/Xóa" lệch `NHAN` | ✅ lô 2 |
| 11 | VỪA | Lưu giấy trống tạo hàng rỗng trùng | ✅ |
| 12 | VỪA | Xoá im lặng, không Hoàn tác; "Xong" không biên nhận | ✅ lô 2 |
| 13 | VỪA | Focus ô đầu không chạy (effect lúc `mounted=false`) | ✅ |
| 14 | VỪA | Mất cuộn khi `/tau`↔`/nguoi` | ✅ |
| 15–16 | VỪA | 3 nút màu cạnh tranh · "Gia hạn" thêm ngăn trung gian | ✅ |
| 17–20 | THẤP | chip tàu 3 tín hiệu · tên giấy cắt "…" · 3 kiểu khối trống · vai "Bạn thuyền" gãy dòng | 18–20 ✅ · 17 ⏭ |

### 3.5 Chợ cá `/tien` (CC, 22)
| Mã | Mức | Tóm tắt | Lô |
|---|---|---|---|
| 01 | CAO | Back thoát trang khi sheet mở (X1) | ✅ |
| 02 | CAO | Lỗi "Nhập tên" về ô đang ẨN | ✅ |
| 03 | CAO | Nút trên thẻ ghi "Xác nhận xóa" (3 chữ, trùng nút hộp) | ✅ |
| 04–05 | VỪA | đang tải in "0 tin" · đăng xong không biên nhận | ✅ |
| 06 | VỪA | Chip không nhớ, không deep-link `?muc=` | ✅ |
| 07 | VỪA | Thẻ tin chưa có hình dáng Marketplace, không lọc nơi | ✅ lô 2 |
| 08 | VỪA | 4 `RefNote` nền màu ở trạng thái yên | ✅ |
| 09 | VỪA | Chưa khai cảng nhà phải sang Tàu tôi — chọn tỉnh tạm tại chỗ? | ✅ lô 2 |
| 10–13 | VỪA | Gọi chỉ số đầu · Chợ sỉ không Gọi · ô tìm chỉ ở Nhà máy · BuyerForm Lưu ở đầu | ✅ |
| 14 | VỪA | Hai "tuần mới nhất" lệch nhau | ✅ |
| 15 | VỪA | Thẻ tin mình: 2 nút chen pill | ✅ (⋯ Popover) |
| 16–17, 20–22 | THẤP | ô tìm không × · skeleton sheet · nhãn 3 chữ · bảng tĩnh nhảy · Mối quen im lặng | ✅ |
| 18–19 | THẤP | "Nhắn" Zalo · địa chỉ mở bản đồ | ✅ lô 2 |

### 3.6 Vật tư — người mua `/cho/**` (VT, 25)
| Mã | Mức | Tóm tắt | Lô |
|---|---|---|---|
| 01 | CAO | Lỗi địa chỉ vẽ SAU LƯNG ngăn | ✅ |
| 02 | CAO | Món báo giá + shop không SĐT ⇒ "gọi hỏi giá" không có số (100 % dữ liệu hiện có) | ✅ ("Nhờ báo giá") |
| 03 | CAO | `/cho` · shop mất cuộn/chip khi quay lại | ✅ |
| 04 | CAO | Biên nhận thêm giỏ lạc khỏi màn, header món không nút Giỏ | ✅ |
| 05 | CAO | ConfirmDialog huỷ/nhận không khoá, bấm đúp ra lỗi giả | ✅ |
| 06 | CAO | Back rời trang khi ngăn mở (X1) | ✅ |
| 07–10 | VỪA | gõ mỗi phím 1 request · mất sóng xoá kết quả · "N món" x=435 · ngăn form 1 nút không Huỷ | ✅ |
| 11 | VỪA | Yêu cầu: gõ rồi ‹ mất, lỗi trên nút Gửi | ✅ lô 2 |
| 12–13 | VỪA | textarea 44 px · "Không còn món mua được" khi giỏ trống | ✅ |
| 14 | VỪA | Tab đơn không giữ qua back, số đếm theo trang | ✅ lô 2 |
| 15–17 | VỪA | chip `t3` nâu · 2 hình nút cam · 5 khuôn offline | ✅ |
| 18 | VỪA | Không kéo-làm-mới | ✅ lô 2 |
| 19 | VỪA | Skeleton sai tỉ lệ ⇒ nhảy | ✅ |
| 20 | VỪA | Nút cam 3.75 rem + 2 dòng hướng dẫn + khối trống lặp | ✅ lô 2 |
| 21–25 | THẤP | ảnh không fallback · "Xem thêm" luôn hiện · "Đã bán 0" · control 56 px · undo mất khi giỏ trống | 21/23/24/25 ✅ · 22 ⏭ |

### 3.7 Kênh người bán `/ban-hang/**` (BH, 19)
| Mã | Mức | Tóm tắt | Lô |
|---|---|---|---|
| 01 | CAO | "Tạm nghỉ bán" là checkbox phải Lưu; quên Lưu shop vẫn nhận đơn | ✅ |
| 02 | CAO | Tồn mặc định 0 ⇒ món mới lên chợ "Hết hàng" | ✅ |
| 03 | CAO | Quay lại từ đơn bị ném về "Chờ xác nhận", mất tra/cuộn | ✅ |
| 04 | VỪA | "Chưa có gian hàng" 4 kiểu ở 6 chỗ, `/don` ngõ cụt "Thử lại" | ✅ |
| 05–06 | VỪA | Trước/Sau thay "Xem thêm" · sau Lưu không thấy món | ✅ |
| 07, 09, 12, 13, 18, 19 | VỪA/THẤP | chip kỳ đứng sai · băng không chạm · 2 lời nhắc 48/72h · checkbox thô · chip+ô chung state · 2 kiểu tìm | ✅ |
| 08 | VỪA | Ô "Báo đã CK" link sai tab | ✅ lô 2 |
| 10 | VỪA | Form trang gõ rồi ‹/back mất sạch | ✅ |
| 11 | VỪA | Sheet Tài khoản không badge đơn chờ | ✅ lô 2 |
| 14–17 | VỪA/THẤP | kéo-làm-mới · "mặt" gian hàng · đơn vị chip · làm bìa | ✅ lô 2 |

### 3.8 Kairos — vòng 3 (K3, 18)
| Mã | Mức | Tóm tắt | Lô |
|---|---|---|---|
| 01 | CAO | Ô viết bình luận inline nằm DƯỚI dock, pill 128 px | ✅ |
| 02 | CAO | Tên báo cắt "Báo …" (35–50 px cho chữ 104–113) | ✅ |
| 03 | VỪA | Câu phụ 2 dòng + thẻ "Sắp ra khơi?" ⇒ bài đầu ở 254 px | ✅ lô 2 |
| 04 | VỪA | "Đọc bài gốc ↗" nút viền full-width, icon trùng Chia sẻ | ✅ (thẻ link preview) |
| 05 | VỪA | ⋯ mở ngăn đáy "Thêm việc" thay Popover (03 §6 mục 9) | ✅ |
| 06 | VỪA | Chuông: câu dẫn, tiêu đề lặp, không avatar | ✅ |
| 07 | VỪA | Không "Xem thêm bình luận" | ✅ |
| 08 | VỪA | Chấm cam cố định trên logo dock trông như badge | ✅ lô 2 |
| 09 | VỪA | "Trang tôi" nút chữ thay avatar | ✅ |
| 10 | VỪA | "Báo xấu" thường trực dưới mọi bình luận | ✅ |
| 11–13 | VỪA | Bến lặp tên 3 lần · tab "Giới thiệu" gãy dòng (`Tabs` chung) · hộp Bỏ bài có cả × lẫn "Viết tiếp" | ✅ |
| 14–17 | THẤP | viền focus ô soạn · 2 nhãn/thẻ báo · câu dẫn Tuỳ chọn · "✕ Ẩn" Cài app | ✅ |
| 18 | THẤP | Sen Biển đè chip (X2) | ✅ (khu vỏ) |

## 4. Câu hỏi treo — ĐÃ CHỐT 2026-10-25 bởi agent chuyên gia UX (anh Long: "tổ chức 1 agent chuyên gia để quyết rồi thực hiện hết")

Quyết định (đã thực hiện ở lô 2): (1) badge số đỏ CHỈ ô Kairos + Vật tư, logo dock bỏ chấm cam · (2) "Đi đâu?" = ô tìm miễn phí (đã lưu · cảng · toạ độ), chỉ Dẫn đường Premium · (3) chọn tỉnh tại chỗ bằng Popover, ghi vào tàu / phiên · (4) "N chưa đọc" thật + đã-thấy trong máy + tầng 5 ưu tiên Cảng nhà › Chuông › Cài app · (5) câu phụ Kairos chỉ khi trống/khách, thẻ Tải thành pill · (6) Nhắn Zalo cạnh Gọi · (7) bảo hiểm chưa khai = xám, kẹt = quá hạn · (8) icon mắt · (9) + J/K/L/M/N kỹ thuật (xem QUYET-DINH trong lịch sử phiên; tóm tắt đưa vào 07/03 re-verified 2026-10-25f). Danh sách câu hỏi gốc giữ dưới đây làm lịch sử.

### Câu hỏi gốc (lịch sử)

1. **Dock có badge số không?** (VO-03) — Kairos chưa đọc + số dòng giỏ. FB có; 03 §Trợ lý "chấm không số" là luật cho nút trợ lý, không phải dock. Kèm: chấm cam cố định trên logo Kairos (K3-08) bỏ hay chỉ hiện khi có mới?
2. **"Đi đâu?" trên bản đồ** (BD-02): khoá "đi tới toạ độ / điểm đã lưu" sau Premium không nằm trong luật `tier.ts` ("Premium mở: dự báo cá + thời tiết >3 ngày") — có cho ô tìm miễn phí (cảng · điểm đã lưu · toạ độ), chỉ dẫn đường mới cần hạng?
3. **Chọn tỉnh tạm tại chỗ** ở Đầu mối/Cảng (CC-09, BD-05) thay vì bắt sang Tàu tôi khai cảng nhà — đụng quyết định "xoá select tỉnh" 2026-08.
4. **Thông báo**: "N mới" = chưa đọc thật, đánh dấu "đã thấy" trong máy không cần sóng (TC-05); mời khai cảng nhà trên Trang chủ trống (TC-11); hàng "Bật chuông báo bão" tầng 5 (TC-09).
5. **Kairos câu phụ** "Kết nối bà con…" (anh chốt 24/10) — giữ thường trực hay chỉ lần đầu/trống? Thẻ "Sắp ra khơi? Tải" → pill hoặc tự tải khi Wi-Fi?
6. **"Nhắn" Zalo** cạnh Gọi ở Chợ cá (CC-18) — hành vi mới chưa có trong spec.
7. **Bảo hiểm bạn thuyền** chưa khai = đỏ "kẹt giấy tờ" hay xám trung tính (TAU-09)?
8. **"Hiện/Ẩn" mật khẩu** chữ hay icon mắt (VO-13)?

## 5. Lô 1 — trạng thái (commit 2026-10-25, nhánh `feat/toi-uu-codex`)

- **Đã sửa ≈118 dòng việc** (một dòng có khi gộp 2–3 mã) trên 9 khu sửa (vỏ app 9 · auth 11 · trang chủ 12 · bản đồ 14 · tàu tôi 11 · chợ cá 16 · vật tư 19 · kênh người bán 14 · Kairos 12) + 2 việc ngoài danh sách (icon Sen Biển nâng theo thanh mua, nép mép khi rảnh; câu lỗi `login-error` theo nhãn nút mới). Còn lại: ⏭ 36 lô sau · ❓ 9 chờ anh chốt (§4).
- Kiểm: `tsc` 0 lỗi · `npm test` 386 file / 6236 test xanh · eslint 0 lỗi (25 warning có sẵn) · `pre-commit --self-test` PASS · Playwright 390×844 đo lại từng khu (ảnh trong thư mục tạm của phiên).
- **Chưa kiểm được ở dev** (phải chạy trên bản build/PWA thật): offline reload (dev không có service worker); back cứng Android + vuốt mép iOS với hook `useLichSuDong` (mới đo bằng `page.goBack()` Chromium); `touch-none` trên scrim iOS Safari.
- Doc sync cùng commit: 07 (re-verified 2026-10-25e), 03, 02, 14, 11, 13, ops/state-registry (mục sessionStorage mới).

### Lô sau (⏭) — gom theo gốc
1. `BottomSheet kieu="form"` tự vẽ chân Huỷ|Lưu từ `NHAN` ⇒ đóng TAU-07/TAU-10 + thống nhất chân sheet toàn app.
2. `ui/toast` chung (`role=status`, đáy trên dock, 5 s, Hoàn tác) từ `kairos/use-post-actions` ⇒ TAU-12, biên nhận xoá/Xong mọi khu.
3. `ui/offline-line` một câu mất sóng chuẩn ⇒ VO-08 (25 biến thể).
4. `useKeoLamMoi` tách từ Kairos ⇒ VT-18, BH-14, Thông báo, `/tien`, `/cang`.
5. Khuôn bản ghi hàng-bung cho bảo dưỡng + đồ tự ghi (TAU-05); "Cài đặt khác" thành BottomSheet (TC-07); panel Thời tiết ≤40 % (BD-07); thẻ tin Marketplace + lọc nơi (CC-07); header một cỡ icon (VO-07); yêu cầu đặt hàng giữ nháp + lỗi theo ô (VT-11); tab đơn qua URL + số đếm thật (VT-14); badge đơn chờ ở sheet Tài khoản (BH-11); "mặt" gian hàng (BH-15).

### Lô 2 — ĐÃ LÀM (cùng ngày, commit kế tiếp)
Mọi mục ⏭ ở §3 và 9 câu ❓ ở §4 đã đóng theo quyết định chuyên gia: mảnh dùng chung (toast · offline-line · kéo-làm-mới · chân sheet Huỷ|Lưu · 21 nhãn mới) + 8 khu (≈95 việc). Còn ghi nợ: kiểm iPhone thật cho khoá cuộn/back; `lib/tier.ts` không đổi luật, chỉ UI bỏ gác Đến điểm.

## History
- 2026-10-25: rà 8 khu, 158 phát hiện; lô 1 sửa theo §3 (commit f4d8fea2); lô 2 đóng toàn bộ backlog + 9 câu treo theo agent chuyên gia (commit kế tiếp).
