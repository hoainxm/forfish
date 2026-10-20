# ADR 0012 — Sen Biển hiểu ý: n-gram v2 chọn ý, Gemma 3 270M (LiteRT) tách tham số — giấy phép Gemma + cách phân phối

**Status**: Accepted (2026-10-17) — chủ dự án duyệt phân phối: Android qua Play Asset Delivery on-demand, web giữ n-gram + luật. Đã làm plugin + gói + CI (doc 15 §20, ops/native-deploy §3c); CHƯA commit, chờ chủ dự án test; release `sen-bien-gemma-v1` đã tạo trên cả hai repo (2026-10-17)
**Date**: 2026-10-16
**Deciders**: chủ dự án ("gemma ngon hơn thì dùng gemma đi, ko cần qwen nữa, focus vào cái chuẩn của google vì nó sẽ được dùng nhiều" — 2026-10-16)

---

## Context / Bối cảnh

Sen Biển phải hiểu mọi câu hỏi bản đồ kiểu Google Maps (doc 15 §18). Tới chiều 16/10: bộ n-gram 31 ý không có ý bản đồ, nên phần này chạy bằng **luật** `hoiGi`. Luật đúng trên câu nó được chỉnh theo, nhưng gặp câu giọng miền lạ ("tui đang ở mô rứa", "chỗ ni sâu nhiêu mét") thì để lọt: trên bộ kín 239 câu bản đồ, luật chỉ đúng tuyến 76,6 %.

Phần **tách tham số** (loài cá, hướng, "đi luôn", tên chỗ lệch giọng) là chỗ n-gram không làm được: n-gram chỉ chọn ý. Báo cáo 16/10 sáng (repo AI Assistant `train/reports/troly-2026-10-16-14-33.md`) cho thấy ghép n-gram với một LLM nhỏ nâng "trọn đúng" bộ B từ 68 % lên 81–85 %. Chủ dự án chốt dùng **Gemma** (bỏ Qwen) và theo **chuẩn on-device của Google**: LiteRT + MediaPipe LLM Inference.

## Decision / Quyết định

1. **N-gram v3** (đã làm): 52 ý = 31 ý cũ + 13 ý hỏi bản đồ (`hoi_dao_gan` … `hoi_ca`, `con_bao_xa`) + 8 ý thao tác bản đồ (`mo_lop` … `chay_thoi_gian`). Độ tin ≥ 0,5 thì theo n-gram, không thì luật làm lưới. File `public/data/sen-bien-ngram.v3.bin` 3,6 MB.
2. **Gemma 3 270M fine-tune toàn phần** cho cả ý lẫn tham số, trả một dòng JSON. Trong app, n-gram vẫn chọn ý; Gemma chỉ được dùng **tham số** khi nó đoán cùng ý. Câu vào Gemma phải **hạ chữ thường** (bộ nghe trả CHỮ HOA; không hạ thì Gemma tụt 95 → 61 %).
3. **Định dạng:** xuất LiteRT (`.task` cho MediaPipe LLM Inference web/Android, `.litertlm` cho LiteRT-LM). Script `train/tro-ly/litert.sh` (repo AI Assistant).
4. **Phân phối (ĐỀ XUẤT, chờ duyệt):** xem §Phân phối.

## Số đo (2026-10-16)

Bộ thử: A (230 câu người viết, parse.test.ts) · A-nhiễu (199) · B (556 câu Opus viết kín, 31 ý) · BĐ (239 câu bản đồ Opus viết kín) · BĐ-asr (cùng câu, CHỮ HOA + số bằng chữ + lệch tên như bộ nghe trả) · BĐ-tay (28 câu người viết trong `hoi-ban-do.test.ts`). Nhãn bộ B và BĐ do Opus gán, **chưa người duyệt**.

| Ứng viên | A ý / trọn | B ý / trọn · lọt chặn | BĐ tuyến / trọn | BĐ-asr trọn | Thao tác tuyến / trọn | Thao tác-asr trọn |
|---|---|---|---|---|---|---|
| n-gram v1 (31 ý, trước đây) + luật | 97 / 97 | 90,3 / 68,2 · 2/23 | luật 76,2 / 36,4 | luật 35,1 | luật 42,2 / 17,9 | luật 13,5 |
| **n-gram v3 (52 ý) + luật làm lưới** (đã vào app) | 97,8 / 97,8 | 90,3 / 68,5 · 1/23 | **96,7 / 80,3** | 78,2 | **93,3 / 81,2** | 67,7 |
| n-gram v3 + luật + **Gemma 270M tách tham số** | 97,8 / 94,8 | 90,3 / **82,4** · 1/23 | 96,7 / **90,4** | **88,7** | 93,3 / **86,1** | **74** |
| Gemma 270M một mình | 98,7 / 95,7 | 80 / 76,4 · 2/23 | 93,7 / 87 | 87,9 | 95,1 / 88,3 | 78,9 |

Bộ "Thao tác" = 232 câu mở/tắt lớp, đổi thời điểm, đọc số, phóng/thu, về tàu (doc 15 §19), Opus viết qua **gói subscription** (`claude -p`, từ 17/10 thầy không còn đi API trả phí — sổ API dừng ở 26,44/50 USD). "Tuyến" = đúng loại câu hỏi bản đồ, hoặc đúng là không phải câu bản đồ. "Trọn" = thêm đúng tham số. Báo cáo đầy đủ: AI Assistant `train/reports/troly-2026-10-17-01-33.md` (v3, có Gemma); v2 ở `troly-2026-10-16-16-17.md` / `-16-44.md`.

Kích thước / độ trễ LiteRT: xem bảng ở §Phân phối (đo trên CPU gpu-desktop 4 luồng, gần điện thoại tầm trung).

## Giấy phép Gemma — đã đọc, dùng thương mại ĐƯỢC

Nguồn: [Gemma Terms of Use](https://ai.google.dev/gemma/terms) (sửa lần cuối 2026-04-01) + [Prohibited Use Policy](https://ai.google.dev/gemma/prohibited_use_policy). Không phải ý kiến luật sư.

- **Thương mại:** không có phí, không trần số người dùng. Được dùng, sửa, phân phối theo điều khoản.
- **Bản fine-tune là "Model Derivative"** (§1.1(e)). Khi phân phối (gói trong app là phân phối) phải (§3.1):
  1. đưa các hạn chế sử dụng §3.2 thành điều khoản **ràng buộc** trong điều khoản dùng app, và báo người dùng;
  2. đưa **bản sao Gemma Terms** cho người nhận;
  3. ghi rõ file đã bị sửa;
  4. kèm file **NOTICE**: *"Gemma is provided under and subject to the Gemma Terms of Use found at ai.google.dev/gemma/terms"*.
- **Đầu ra:** Google không giữ quyền gì (§3.3); trách nhiệm đầu ra là của mình.
- **Google có quyền hạn chế từ xa** việc dùng vi phạm (§3.2) và chấm dứt khi vi phạm (§4.5: phải xoá mọi bản). Luật California, toà Santa Clara.
- **Chính sách cấm dùng** liên quan SDFish: cấm "ra quyết định tự động trong lĩnh vực ảnh hưởng tới quyền lợi/sức khoẻ" và tư vấn y tế/pháp lý như chuyên gia. Thiết kế hiện tại hợp: Gemma **chỉ tách tham số** của câu hỏi; câu trả lời (độ sâu, rạn, vùng cấm…) đọc từ lớp hải đồ, kèm "chỉ để tham khảo, nhớ dò đáy"; câu y tế/pháp lý/tiền bị chặn (`ngoai_pham_vi`) trước khi tới đâu. Cảnh báo an toàn lúc chạy (nav-hazards) không đi qua Gemma.

**Việc phải làm trước khi phát hành bản có Gemma:** thêm điều khoản §3.2 vào điều khoản dùng app, thêm NOTICE + bản Gemma Terms vào màn "Giấy phép" và vào gói Android.

## Phân phối — ĐỀ XUẤT, chờ chủ dự án duyệt

### Nén (2026-10-17, chủ dự án: "nén bản gemma lại tối đa về dung lượng")

Đo bằng LiteRT-LM trên CPU gpu-desktop 4 luồng (gần điện thoại tầm trung), "trọn đúng" %:

| Bản | MB | BĐ tuyến / trọn | BĐ-asr | B | Thao tác | Thao tác-asr | ms/câu | RAM |
|---|---|---|---|---|---|---|---|---|
| int8 gốc của Google (262k token) | 273 | 95,8 / 87,0 (v2) | 84,1 (v2) | 85,6 (v2) | — | — | 328 | ~820 MB |
| int8, cắt từ vựng còn 23k token | 117 | 93,7 / 86,6 | 86,6 | 87,9 | 88,3 | 78,9 | 156 | 267 MB |
| **int4 khối 32 + huấn luyện có lượng tử + chưng cất, 13,7k token (CHỌN)** | **62** | **95,0 / 87,0** | **85,8** | **84,5** | **91,0** | **78,5** | **~207** | **205 MB** |
| như trên, từ vựng chỉ lấy từ dữ liệu (3,3k) | 58 | 95,0 / 85,8 | 83,7 | 84,4 | 89,2 | 77,6 | 258 | ~185 MB |

- **Cắt từ vựng không mất gì**: bảng nhúng chiếm ~170M/270M tham số; giữ token xuất hiện trong dữ liệu + một kho tiếng Việt rộng. Kiểm 306k chuỗi token hoá y hệt, logit lệch ≤ 1,7e-5.
- int4 thường làm hỏng vì **bảng nhúng**; int4 khối 32 + huấn luyện có lượng tử (1 vòng, ~10 phút GPU) + chưng cất từ bản fp32 thì về ngang int8. Bộ B tụt ~3,4 điểm so với int8 — vẫn hơn hẳn n-gram + luật (68,5).
- KV cache 256 (câu ≤ 200 token): bớt ~45 MB RAM, không đổi độ đúng; web `maxTokens` phải = 256.
- `.task` và `.litertlm` cho đầu ra y hệt (20/20); token trong file khớp HF 239/239.
- Quy trình lặp lại: AI Assistant `train/tro-ly/nen.sh <HF fine-tune> <dữ liệu> <tên>` (ghi chép: side-session-notes `gemma-nen.md`).

### Phân phối — ĐÃ DUYỆT 2026-10-17 (phương án 1 + 2 dưới đây)

62 MB **không vào git** được: vượt trần 20 MB/file và đẩy `public/data/` (đang ~99 MB) quá trần 120 MB (CLAUDE.md "Dữ liệu bản đồ trong git"). Đề xuất:

1. **Bản Android (Capacitor) trước** — chỗ hợp nhất: MediaPipe LLM Inference / LiteRT-LM có SDK Android chính thức chạy CPU/GPU ổn định. File `.task` 62 MB đi trong **gói tài nguyên Play Asset Delivery dạng on-demand** (không phình APK cài đặt; tải một lần qua Play, máy giữ vĩnh viễn, ngoài biển không cần mạng). Cần một plugin Capacitor nhỏ (Kotlin) gọi `LlmInference`.
2. **Bản web (PWA) giữ n-gram v3 + luật** (đã đạt tuyến 96,7 % / 93,3 %). WebGPU của MediaPipe chưa chạy được với file này; đường WASM CPU chạy được nhưng ~1,6 s/câu. Nếu sau này muốn Gemma trên web: tải theo yêu cầu từ kho ngoài git — đụng quyết định "dữ liệu nằm trong code, không ra CDN ngoài" (2026-08-29), phải chủ dự án chốt lại.
3. **Trong app**: n-gram vẫn chọn ý (nhanh, 0,04 ms); chỉ gọi Gemma khi câu là ý cần tham số (hỏi bản đồ, thao tác, dẫn đường) để lấy tham số; Gemma lỗi/chưa có ⇒ luật như hôm nay. Câu vào hạ chữ thường.
4. **Trước khi phát hành**: NOTICE + bản Gemma Terms trong màn Giấy phép, thêm hạn chế §3.2 vào điều khoản dùng app (xem trên).

**Chưa kiểm**: chạy trên điện thoại thật (độ trễ, RAM, nóng máy).

## Alternatives considered / Phương án đã cân nhắc

### Option A: Chỉ luật hỏi bản đồ (như chiều 16/10)
- ✅ 0 MB, đọc được, đúng trên câu đã biết
- ❌ Đúng tuyến 76,6 % trên câu giọng miền lạ; mỗi kiểu nói mới phải viết thêm luật

### Option B: N-gram v3 + luật làm lưới ← đã làm
- ✅ 3,6 MB, 0,04 ms/câu, chạy mọi nơi kể cả web; tuyến 96,7 % (hỏi) · 93,3 % (thao tác)
- ❌ Tham số vẫn do luật: trọn đúng 80,3 % / 81,2 %

### Option C: B + Gemma 270M LiteRT tách tham số ← đề xuất cho bản native
- ✅ Trọn đúng 90,4 % bộ BĐ, 86,1 % thao tác, 82,4 % bộ B; chuẩn Google (LiteRT), chạy được Android và web (WASM CPU; WebGPU chưa chạy được)
- ❌ 62 MB sau khi nén (từ 273 MB), vẫn không vào được git (trần 20 MB/file); cần plugin Android; phải giữ điều khoản Gemma

### Option D: Qwen3.5 0.8B
- ✅ Bộ B trọn đúng cao nhất sáng 16/10 (84,7 %)
- ❌ 426–836 MB; chủ dự án chốt bỏ Qwen

## Consequences / Hệ quả

- **Tích cực**: bà con hỏi bản đồ bằng giọng miền được hiểu đúng hơn hẳn mà không cần mạng.
- **Đánh đổi**: hai repo phải giữ khớp phần đoán n-gram (`ngram.mjs` ↔ `ngram.ts`); file mô hình đổi tên theo bản (v1 → v2) vì SW giữ `/data` cache-first.
- **Trung tính**: bộ kín do Opus viết; câu bà con thật chưa đo.

## References

- Doc 15 §18b · ADR 0011 (tai trong máy)
- Repo AI Assistant: `train/tro-ly/` (`chay-bd.sh`, `ft-nho.py`, `litert.sh`), `train/reports/troly-2026-10-16-16-*.md`

## History

- **2026-10-16**: Proposed — n-gram v2 làm xong, Gemma chờ duyệt phân phối
- **2026-10-17**: n-gram v3 (thao tác bản đồ); Gemma nén còn 62 MB; thầy Opus chuyển sang gói subscription
- **2026-10-17**: Accepted — plugin Android `SenBienGemma` (LiteRT-LM 0.18.0) + gói on-demand `senbiengemma`; chạy trên emulator (nạp 0,33 s, 0,43–0,6 s/câu)

## Cập nhật 2026-10-18 — Gemma v4 (65 ý, có 13 ý chợ) + giới hạn nén

Fine-tune lại trên dữ liệu v4 (gpu-desktop, cùng công thức nén int4 khối 32 + chưng cất, 62 MB). Chấm cùng cổng của vòng train hằng ngày (doc 15 §23 bước 4): chợ 86,5 % trọn đúng (v3 không biết ý chợ), câu người viết +0,9/+2,5, hỏi bản đồ +1,7/+0,8, nhưng **thao tác bản đồ −1,3** (ý chợ lấn: "lùi về bây giờ nè" ⇒ shop_doi_hen) ⇒ **không qua cổng, app GIỮ v3** (release `sen-bien-gemma-v1`). Thiệt hại nhỏ: Gemma chỉ được lấy tham số khi cùng ý với n-gram, lệnh sàn tách tham số bằng luật. Báo cáo: repo AI Assistant `train/reports/troly-v4-gemma-2026-10-18.md`.

**Nén dưới int4 không chạy được**: QAT 2-bit khối 64 xuất ra 35–39 MB nhưng LiteRT-LM (bộ chạy của plugin Android) lỗi ngay câu đầu ⇒ **62 MB int4 là bản nhỏ nhất chạy được trong app**. Bản ternary GGUF (29–36 MB) chỉ chạy trên llama.cpp — đổi runtime Android là quyết định riêng. N-gram: 4,6 MB nhưng 93,7 % trọng số = 0, phát dạng SDF2 (gzip) ⇒ tải về ~300 KB; lưới 4-bit làm tụt ~20 điểm ⇒ giữ int8.

## Cập nhật 2026-10-20 — Gemma cho bản WEB qua máy chủ (chủ dự án: "t muốn nó chạy pwa" → "nối gemma ở máy t")

Đo lại đường trong trình duyệt với đúng file đang phát (int4 k256, 64 MB): LiteRT-LM JS 0.18.1 WASM CPU đúng 5/5 câu nhưng **4,5–5,3 s/câu trên Mac**; bật cô lập nguồn gốc (COOP/COEP, đa luồng) không nhanh hơn; WebGPU lỗi nạp (0.18.0 lẫn 0.18.1). Điện thoại ước 10–20 s ⇒ vượt trần 2,5 s của app, tải 62 MB vô ích. Không đưa file vào git.

**Chọn**: Gemma web chạy trên **máy GPU của chủ dự án** (AI Assistant `train/tro-ly/gemma-may-chu.py`, systemd `sen-bien-gemma`, cùng `.litertlm`, ~0,2 s/câu), ra internet qua đường hầm; app → `POST /api/sen-bien/gemma` (đăng nhập + giới hạn lượt) → máy chủ. Khoá chỉ ở env máy chủ ForFish. Có sóng mới dùng; mất sóng như cũ (n-gram + luật). Đây là ngoại lệ có chủ ý của "Sen Biển chỉ chạy trong máy" — chỉ cho phần tách tham số, có đường lùi. Rủi ro đã chấp nhận: máy nhà tắt/mất mạng ⇒ mất Gemma web (không hỏng gì khác); máy nhà mở ra internet (chỉ một cổng, chỉ đường hầm, khoá dài 64 hex, chỉ nhận đúng khuôn Sen Biển).

