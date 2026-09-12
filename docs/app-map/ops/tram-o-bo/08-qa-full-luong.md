# 08 — QA full luồng gói não "Sen Biển"

> **Load khi**: bạn cần nghiệm thu (hoặc sửa) toàn bộ vòng đời gói não — từ "kéo câu bà con" ở trạm, qua đóng gói + cổng kiểm, tới máy bà con nhận gói và tiêu thụ offline. Đây là **bảng ca test full luồng**, chia theo *chạy được ở đâu*. KHÔNG định nghĩa lại shape gói (đó là [contract](../../../contracts/tro-ly-brain-pack.contract.md)) và KHÔNG thay runbook vòng đêm ([03](03-vong-dem-soan-goi.md)) hay quản trị/rollout ([02](02-quan-tri-va-update.md)) — chỉ nói *kiểm cái gì, ở đâu, kỳ vọng gì*.
>
> Vì sao có trạm + gói: [ADR 0010](../../../adr/0010-tro-ly-nghe-offline-wasm.md). Nghiệm thu offline (khuôn dùng chung): [../qa-offline-acceptance.md](../qa-offline-acceptance.md).

## 0. Ba nhóm ca — đọc trước khi chạy

Vòng đời gói não chạy trên **ba nơi khác nhau**, nên QA cũng chia ba nhóm theo *đang có gì trong tay*:

| Nhóm | Chạy được khi | Công cụ | Ai chạy |
|---|---|---|---|
| **A · Tự động** | máy nào có Node ≥ 20 (kể cả CI/dev) | `node scripts/tram-o-bo/test-full-flow.mjs` | bất kỳ, mỗi lần đụng gói/2 script |
| **B · Cần PC trạm** | có PC-ở-bờ (RTX 3060) với Ollama qwen3.5:9b + VieNeu | runbook [03](03-vong-dem-soan-goi.md) / [05](05-sen-bien-giong.md) / [06](06-fine-tune-qwen-lora.md) | người vận hành trạm |
| **C · Cần app-side P1** | app đã dựng reader gói (`brain-pack.ts`/`brain.ts` — [ADR 0010](../../../adr/0010-tro-ly-nghe-offline-wasm.md) §P4, **CHƯA build**) | thiết bị thật + [../qa-offline-acceptance.md](../qa-offline-acceptance.md) | QA app |

> Nhóm A **thay người** kiểm khuôn gói + cổng + toàn vẹn hash — chạy được ngay, không cần phần cứng. Nhóm B/C là chỗ nhóm A **mock/skip có ghi chú**: khi phần cứng/app sẵn sàng thì làm tay theo bảng dưới, đừng coi mock của nhóm A là đã nghiệm thu B/C.

---

## 1. Nhóm A — Tự động (chạy được ngay)

**Cách chạy toàn nhóm:** `node scripts/tram-o-bo/test-full-flow.mjs` (thêm `--keep` để giữ thư mục tạm mà soi, `--help` xem cờ). In bảng PASS/FAIL, **exit ≠ 0 nếu có FAIL**. Orchestrator dùng thư mục tạm `os.tmpdir`, dọn sau khi chạy — không để rác trong repo.

| # | Ca | Tiền điều kiện | Bước (orchestrator làm) | Kỳ vọng |
|---|---|---|---|---|
| A1 | Kéo câu + gom cụm | `__fixtures__/unanswered-sample.json` | Đọc `unansweredHashes` (đếm để ưu tiên) + `outbox`, gom cụm theo chủ đề | ≥1 cụm; in số cụm + tổng đếm hash |
| A2 | LLM soạn nháp (**MOCK**) | cụm từ A1 | Hàm mock cố định sinh nháp knowledge từ cụm (KHÔNG gọi Ollama) | Nháp để `nguon` **trống** + `canNguoiTra` — không bịa nguồn (đúng prompt [03 §4.1](03-vong-dem-soan-goi.md)) |
| A3 | Người duyệt (mock) + gộp | nháp A2 | Điền `nguon`+`ngaySoat`, gộp vào bản sao fixture ở tmp | Mọi mục approved có nguồn+ngày; kho tăng số mục |
| A4 | Giọng VieNeu (**SKIP**) | — | Không sinh mp3 | In SKIP + ghi chú: trạm thật chạy `gen_pack.py`, mp3 theo đường `audio/<bac\|nam>/<intentId>.mp3` |
| A5 | Đóng gói | thư mục nội dung đã duyệt | Gọi thật `export-brain-pack.mjs --version …` | exit 0; `manifest` có `version`/`sha256`(64 hex)/`bytes`/`files` |
| A6 | Cổng kiểm | gói đã có manifest | Gọi thật `validate-brain-pack.mjs` | exit 0 (0 lỗi chặn) |
| A7 | Bump version + đổi 1 file | gói A5 | Sửa 1 mục knowledge, re-export version mới, so sha256 **từng file** | `manifest.version` đổi; **chỉ** file đã sửa đổi sha256; `models/*` + file khác **giữ** sha (app bỏ qua, không tải lại — [02 §5](02-quan-tri-va-update.md)) |
| A8 | App nhận gói — kiểm hash | gói A7 | Tự tính sha256 từng file, so manifest; rồi tráo hỏng 1 byte | Khớp hết → cho **đổi khối**; hỏng 1 byte → phát hiện lệch → **giữ gói cũ** |
| A9a | Ca âm — thiếu `nguon` | — | Xoá `nguon` 1 mục, re-export, validate | validate **FAIL** (`thiếu nguon`) |
| A9b | Ca âm — **số sống** | — | Nhét số sống ("… 90.000 đồng … 40 km/h") vào `traLoi`, validate | validate **CẢNH BÁO** `SỐ SỐNG` — theo thiết kế validator là **WARN, không hard-fail** (contract cấm số sống; validator để **người soát** quyết — [03 §4.2](03-vong-dem-soan-goi.md)). QA: WARN phải nổi lên; nếu muốn chặn cứng thì nâng validator (xem §4) |
| A9c | Ca âm — hỏng 1 byte | — | Lật 1 byte 1 file **sau** khi có manifest (không re-export), validate | validate **FAIL** (`Sai sha256`) |

> **Cổng phụ (chạy kèm khi sửa validator):** `node scripts/tram-o-bo/validate-brain-pack.mjs --self-test` (gói hợp lệ pass + gói lỗi fail đúng) và `node scripts/tram-o-bo/validate-brain-pack.mjs scripts/tram-o-bo/__fixtures__/brain-pack-sample` (fixture pass 0 cảnh báo). Fixture giữ sẵn `manifest.json` version 1 để validate trực tiếp được.

**Lưu ý ca âm (b):** contract ghi "không số sống" là luật **BẤT BIẾN**, nhưng `validate-brain-pack.mjs` cố ý để nó thành **WARN** (regex số-sống dễ báo nhầm → người soát tự quyết, không tự chặn phát hành). Orchestrator vì thế nghiệm thu (b) bằng "WARN có nổi lên", không phải "exit ≠ 0". Đây là ranh giới thật giữa contract (luật) và validator (công cụ) — đừng đọc nhầm thành lỗ hổng.

---

## 2. Nhóm B — Cần PC trạm (Ollama / VieNeu / fine-tune)

Chạy trên PC-ở-bờ theo [03](03-vong-dem-soan-goi.md) (vòng đêm) + [05](05-sen-bien-giong.md) (giọng). Đây là chỗ nhóm A **mock A2** và **skip A4**.

| # | Ca | Tiền điều kiện | Bước | Kỳ vọng |
|---|---|---|---|---|
| B1 | Ollama soạn nháp thật | Ollama + qwen3.5:9b Q4 chạy ([01](01-cai-local-llm.md)) | Gửi cụm câu qua prompt [03 §4.1](03-vong-dem-soan-goi.md) | Nháp đúng khuôn JSON contract; mục không chắc → `nguon` trống + `canNguoiTra` |
| B2 | Chống bịa tầng máy | nháp B1 | Chạy tiền-kiểm [03 §4.2](03-vong-dem-soan-goi.md) | Cắt cờ `traLoi` >4 câu / nghi số sống / thiếu nguồn trước khi vào hàng đợi duyệt |
| B3 | Ollama treo/timeout | trạm 24/7 | Ngắt Ollama giữa chừng | Timeout/bỏ cụm, ghi log, chạy tiếp — một cụm hỏng không kéo sập cả đêm ([03 §8.3](03-vong-dem-soan-goi.md)) |
| B4 | Sinh giọng VieNeu | model VieNeu ([05](05-sen-bien-giong.md)) | `gen_pack.py` sinh mp3 2 giọng `bac`/`nam` cho câu **cố định** trong `answers` | mp3 đúng đường `audio/<bac\|nam>/<intentId>.mp3`; câu có **số sống** KHÔNG pre-bake; nghe thử đọc đúng chữ |
| B5 | Đóng+kiểm gói thật (có models thật) | models thật ([contract §models](../../../contracts/tro-ly-brain-pack.contract.md)) | `export` + `validate` trên gói ~50–70 MB | Trong ngân sách; sha256 model thật khớp; `bytes` là số đo thật |
| B6 | Fine-tune (khi mở khoá) | điều kiện [06](06-fine-tune-qwen-lora.md)/[07](07-fine-tune-stt-icefall.md) | Chạy runbook fine-tune | Ngoài phạm vi nghiệm thu gói thường — **CHƯA train**, leo thang hotwords trước |

> **Đăng gói** (upload `/quan-tri` → bucket → rollout %) là thao tác tay có audit — nghiệm thu theo checklist [02 §7](02-quan-tri-va-update.md), không thuộc bảng tự động.

---

## 3. Nhóm C — Cần app-side P1 (STT WASM / nhận gói / offline)

App-side reader gói (`brain-pack.ts`/`brain.ts`) là **P4 của [ADR 0010](../../../adr/0010-tro-ly-nghe-offline-wasm.md) — CHƯA build**. Khi dựng xong, nghiệm thu bằng **khuôn offline dùng chung**: [../qa-offline-acceptance.md](../qa-offline-acceptance.md) (bộ bắt buộc khi đụng `sw.js`/SHELL/cache/khoá `forfish.*`).

| # | Ca | Tiền điều kiện | Bước | Kỳ vọng |
|---|---|---|---|---|
| C1 | Nhận gói `pretrip-auto` | app P1 + gói trên bucket | Đủ điều kiện lô rollout (băm SĐT), kiểm manifest theo nhịp 6h **khi có sóng** | Tải nền vào kho riêng `sdfish-tro-ly-v1`; **KHÔNG** kiểm lúc mở app ([02 §5](02-quan-tri-va-update.md)) |
| C2 | Đổi khối nguyên khối | C1 | Tải đủ mọi file + sha256 khớp toàn bộ | Chỉ đổi khi đủ; đứt giữa chừng/sha lệch → **huỷ, giữ gói cũ**; file trùng sha (models) → bỏ qua không tải lại |
| C3 | STT WASM nghe tiếng Việt | model `stt-vi.*` thật | Nói câu mẫu → nhận dạng | Khớp ý định; hotwords `score ≤ 1,5` không phá từ thường ([04](04-toi-uu.md)) |
| C4 | Tiêu thụ offline | gói đã đổi khối, **mất sóng** | Mở trợ lý ngoài biển, hỏi câu trong kho | Máy chỉ **tìm+trích** (BM25 trên `tuKhoa`/`cauHoiMau`), trả `traLoi`+nguồn, KHÔNG sinh chữ; số sống chèn từ `DeviceSnapshot` lúc chạy |
| C5 | Lùi gói | C2 + [02 §4](02-quan-tri-va-update.md) | Admin lùi version ở `/quan-tri` | Máy đã đổi sang gói lỗi tải lại gói cũ, đổi khối về |
| C6 | Offline bất biến | mọi thay đổi động tới app trợ lý | Chạy **bộ bắt buộc** [../qa-offline-acceptance.md](../qa-offline-acceptance.md) | Không thêm request lúc mở app; gói tải ở kho riêng KHÔNG qua `sw.js`; mất sóng có nhánh đọc bản đã lưu |

---

## 4. Còn nợ / cần chốt

- **Số sống: WARN hay FAIL?** Validator hiện để WARN (ca A9b). Contract coi là luật bất biến. *Cần chủ dự án quyết*: có nâng `validate-brain-pack.mjs` để số-sống thành **FAIL cứng** (chặn phát hành) không, hay giữ WARN + tin người duyệt? Nếu nâng: siết `LIVE_UNIT_RE` (giảm báo nhầm) rồi chuyển `warns`→`fails`, cập nhật `--self-test` + ca A9b.
- **Khoá knowledge `.muc`**: validator đã đọc `.muc` theo contract (cùng `.items`/`.knowledge`/mảng cho khuôn cũ). Fixture dùng `.muc` đúng contract.
- **Nhóm C chưa chạy được**: app-side P1/P4 chưa dựng — bảng §3 là *kế hoạch nghiệm thu*, kích hoạt khi có reader gói. Chốt mã ý định chéo `parse.ts` (contract §Còn nợ) trước khi khoá C3/C4.
- **Kiểm mã ý định trong gói**: validator chưa loại `intents[].id`/`answers[].intentId` lạ (chờ `brain/intent-ids.json` sinh lúc build app — contract §Còn nợ). Khi có, thêm ca A vào nhóm tự động.

---

**Last updated**: 2026-09-12
