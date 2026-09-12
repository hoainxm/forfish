# 04 — Tối ưu (LLM soạn · chất lượng nghe · dung lượng gói · nội dung)

> **Load khi / dùng khi**: gói chạy được rồi ([03-vong-dem-soan-goi.md](03-vong-dem-soan-goi.md)) và bạn
> muốn nó **rẻ hơn / nghe chuẩn hơn / nhẹ hơn / trúng câu bà con hỏi hơn**. Bốn đòn bẩy, mỗi cái đo được.
> Cài Ollama/qwen3.5:9b: [01-cai-local-llm.md](01-cai-local-llm.md). Số P0 gốc (RTF, hotwords, cắt espeak): [ADR 0010](../../../adr/0010-tro-ly-nghe-offline-wasm.md) §P0.
> Giọng: [05-sen-bien-giong.md](05-sen-bien-giong.md).

> Quy tắc chung: **đừng tối ưu thứ chưa đo.** Mọi con số PC ở đây đo 1 thread Chromium 148 (ADR 0010) hoặc
> tra tài liệu công cụ — ghi ngày cạnh mỗi khối. Thứ nào "cần đo trên PC/điện thoại thật" thì ghi rõ, không hứa.

## 1. Bảng đòn bẩy → đo gì → trần

| Đòn bẩy | Chỉnh ở đâu | Đo gì | Trần / luật |
|---|---|---|---|
| num_ctx Ollama | options gọi qwen3.5:9b | VRAM khi nạp; có tràn CPU không | vừa đủ 1 batch cụm, đừng để tràn 12 GB |
| Quant Q4/Q5/Q8 | tag model Ollama | VRAM; chất lượng nháp (người duyệt chấm) | Q4 mặc định; lên Q5 chỉ khi nháp kém rõ rệt |
| keep_alive | options / env | thời gian token đầu mỗi cụm | giữ nạp suốt đêm (`-1`) khi chạy loạt |
| batch nhiều cụm | script vòng đêm | tổng giờ chạy đêm | gộp tới khi gần đầy num_ctx |
| hotwords STT | gói não (`hotwords.txt`) | 25 câu đọc→nghe / 15 câu ngành | `hotwordsScore` **1,5**; mỗi từ thêm chạy lại 25 câu |
| cắt espeak | `fetch-assets.sh` (app-side) | dung lượng phần đọc | còn tiếng Việt: 63,9 MB (đã làm, −96%) |
| int8 model | chọn bản model | dung lượng | zipformer-vi-30M-int8 ~25 MB (không dùng fp32) |
| ngân sách gói | `export-brain-pack.mjs` | tổng MB gói | ~**50–70 MB**/gói (ADR 0010) |
| ưu tiên FAQ | xếp theo `unansweredHashes` | câu bà con hỏi mà máy thua | soạn mục đếm cao trước |

## 2. Tối ưu LLM soạn (Ollama, chạy ở bờ — 0đ nên tối ưu là để NHANH, không phải rẻ)

> **Tra cứu công cụ (2026-09-11, WebSearch)** — ghi ngày để sau còn biết cũ:
> - Ollama bản hiện hành quanh **v0.33.x**; tham số truyền trong `options` của `/api/generate` & `/api/chat`.
>   ([docs.ollama.com/faq](https://docs.ollama.com/faq), [ollama/docs/api.md](https://github.com/ollama/ollama/blob/main/docs/api.md))
> - Họ **Qwen3** đã lên tới **Qwen3.8** (8/2026), có nhiều cỡ (4B, 30B-A3B MoE, 235B…). **Đã chốt `qwen3.5:9b`**
>   (2026-09-12) vì là bản mới nhất **CÓ cỡ ~9B lọt 12GB** (Qwen3.6 27B/35B, Qwen3.8 lớn hơn — không có bản 9B).
>   `ollama pull qwen3.5:9b` (kiểm tag thật lúc cài — [ollama.com/library/qwen3.5](https://ollama.com/library/qwen3.5)).
>   ⚠️ Con số benchmark trên web là **tiếng Anh / tác vụ code**, KHÔNG phải chất lượng soạn tiếng Việt đời
>   thường — **phải tự chấm bằng người duyệt**, đừng tin điểm quảng cáo.

- **num_ctx**: mặc định Ollama nhỏ (kê 2K–4K tuỳ bản). Soạn một loạt cụm cần ngữ cảnh vừa đủ chứa few-shot +
  đề bài; đặt num_ctx đủ 1 batch, KHÔNG kéo max — ctx càng lớn càng ăn VRAM và chậm. **Cần đo trên trạm thật**
  ngưỡng num_ctx còn vừa 12 GB VRAM với qwen3.5:9b Q4 (còn dư VRAM hơn cỡ 14B trước, vì trọng số chỉ ~6,6 GB).
- **Quant**: Q4 là điểm cân bằng cho qwen3.5:9b trên 3060 12 GB. Q5/Q8 chất lượng nhỉnh nhưng ăn VRAM và chậm —
  chỉ đổi khi **người duyệt** thấy nháp Q4 sai/khô rõ rệt. Đây là **đánh đổi VRAM ↔ chất lượng**, chấm bằng
  người, không bằng benchmark ngoài.
- **keep_alive**: mặc định **5 phút** rồi model bị đẩy khỏi RAM ([docs.ollama.com/faq](https://docs.ollama.com/faq)).
  Vòng đêm chạy nhiều cụm liên tục → đặt `keep_alive: -1` (hoặc `OLLAMA_KEEP_ALIVE=-1`) để **không** nạp lại
  giữa các cụm; **cuối đêm đặt lại `0`** (unload) để trả VRAM. Token đầu mỗi cụm khỏi đợi nạp.
- **Batch nhiều cụm 1 lượt**: gói vài cụm vào một prompt (few-shot + nhiều đề bài, yêu cầu trả mảng JSON) tới
  khi gần đầy num_ctx → ít lượt gọi, ít overhead. Đừng gộp tới mức model lẫn cụm — nếu chất lượng tụt thì giảm.
- **Prompt caching**: Ollama tái dùng KV-cache của **tiền tố chung** giữa các lần gọi khi model vẫn nạp
  (nhờ `keep_alive: -1`). Nên đặt phần **cố định** (system + few-shot) **đứng đầu**, phần thay đổi (đề bài
  cụm) ở cuối → tiền tố trùng được tái dùng. **Cần đo trên trạm** mức lợi thật; đừng hứa con số.
- Vì trạm 0đ/lượt, "tối ưu" ở đây = **rút ngắn giờ chạy đêm** để xong trước sáng, không phải cắt tiền.

## 3. Tối ưu chất lượng nghe (thuộc GÓI, chở tới máy bà con)

Nền tảng đã đo (ADR 0010 §P0, 2026-09-07): STT RTF 0,07; đọc→nghe 25 câu ngành giống ~90%; sai tập trung ở
từ ngành ("nhớt", "Yanmar", tên cảng). Đòn bẩy là **hotwords** của sherpa-onnx, chở trong gói (`hotwords.txt`).

**Luật hotwords đã chốt (ADR 0010 §P0d) — đừng phá:**
- `hotwordsScore` = **1,5**. Cao hơn (≥3) **đè nghĩa**: "biển động cấp mấy" bị kéo thành "Biển Đông cấp mấy" —
  hỏi sóng hoá hỏi tên vùng. Đây là án lệ thật, không phải giả định.
- **Không nhận hotword trùng âm với từ thường dùng.** "Biển Đông" trùng âm "biển động" → loại khỏi hotwords.
- **Mỗi từ thêm vào gói phải chạy lại bộ 25 câu** đọc→nghe (dùng `modified_beam_search`) và đối chiếu nhóm 15
  câu ngành. Thêm mù không kiểm = rủi ro đè nghĩa câu khác.
- Hotwords **không cứu** từ gốc nước ngoài ("Yanmar"→"EM", "shop"→"CHO") và không đụng lỗi không-từ-vựng
  ("mấy giờ"→"bây giờ"). Đừng nhồi hotwords để chữa những lỗi đó — sai đòn bẩy.

**Cách chọn hotwords theo ngành**: lấy từ hay sai trong log đọc→nghe (tên cảng, hãng máy, tên cá, vật tư),
loại từ trùng âm từ thường, thêm từng đợt nhỏ, chạy lại 25 câu, giữ từ nào **tăng** câu đúng mà **không** kéo
tụt câu khác. `bpe.vocab` phải sinh từ `bpe.model` bằng `sentencepiece` (release không kèm) — đã đưa vào
`fetch-assets.sh` (ADR 0010 §P0d).

## 4. Tối ưu dung lượng gói tải về máy (ngân sách ~50–70 MB, ADR 0010)

Bà con tải gói qua sóng yếu, tải **một lần** → mỗi MB là thật. Thành phần nặng:

| Phần | Cỡ | Đã tối ưu |
|---|---|---|
| Phần đọc (piper vi + espeak-ng-data) | **63,9 MB** | cắt espeak còn 9 file tiếng Việt (−17,3 MB, −96%); `phondata` 537 KB còn nợ (cắt nữa phải build espeak từ nguồn) |
| STT zipformer-vi | ~25 MB | dùng bản **int8** (không fp32) |
| .wasm sherpa | 14,9 MB | dùng gói dựng sẵn `sherpa_onnx_web` |
| TTS vi (piper) | ~21 MB | int8, x_low đã loại (phát âm kém) |
| intents/answers/knowledge JSON | nhỏ | text; đừng nhét mp3 câu động |
| mp3 câu cố định (VieNeu) | ~0,66 MB/giọng/23 câu | 24kHz mono 64k; chỉ câu CỐ ĐỊNH (xem 05) |

**Luật nội dung ↔ dung lượng:**
- **KHÔNG nhét số sống** (giá, thời tiết) vào `knowledge` — vừa sai luật chống bịa (ADR 0010) vừa vô ích
  (số sống từ snapshot của máy). `validate-brain-pack.mjs` cảnh báo số nghi sống.
- **Chỉ pre-bake mp3 câu CỐ ĐỊNH** (xem [05-sen-bien-giong.md](05-sen-bien-giong.md)). Câu có số → piper/Web
  Speech đọc trong máy, **0 byte gói**. Một câu mp3 hai giọng ≈ 2× cỡ; đừng bake câu động.
- **Một lớp = một file, đè không đẻ** `-v2` (CLAUDE.md §git): gói đổi nguyên khối theo `version` trong manifest,
  không cần tên file mang phiên bản.
- Đóng gói xong `export-brain-pack.mjs` **in tổng + cảnh báo nếu vượt** ngân sách. Vượt 70 MB → soát lại phần
  nào phình; hết đường thì đổi **định dạng lưu** JSON (delta/varint) trước khi nghĩ chuyện khác (CLAUDE.md §git).

## 5. Tối ưu nội dung (vòng học nguyên tắc 12 — chạy bằng dữ liệu THẬT, không bằng model)

`unansweredHashes` (ADR 0010) đếm **câu bà con hỏi mà máy thua**, theo mã băm chuẩn hoá. Đó là bản đồ "gói còn
thiếu gì" — soạn mục FAQ **đếm cao trước**, đừng soạn theo cảm tính.

- **Vấn đề**: hash **một chiều**, không đọc lại được nội dung. Nên hash chỉ xếp **ưu tiên tương đối** (đông = đáng
  soạn), còn **nội dung để soạn lấy từ `outbox`** (câu có đồng thuận, ADR 0010) — xem [03](03-vong-dem-soan-goi.md) §2.
- **Bắc cầu tạm**: dựng bảng tra `hash → chủ đề` bằng cách băm chính các câu trong `outbox`/tập test bằng **cùng
  hàm chuẩn hoá app dùng** (`foldVn`), rồi khớp ngược. Hash nào đông mà không khớp được câu nào → đánh dấu "chưa
  biết bà con hỏi gì", chờ `outbox` gom đủ mẫu.
- **Đo hiệu quả vòng học**: sau mỗi đợt phát gói, theo dõi tỉ lệ câu rơi `khong_hieu`/`hoi_mo` không-có-trong-kho.
  ADR 0010 ghi mốc gỡ tầng mạng: *"3 tháng liên tiếp tỉ lệ câu mở không có trong kho < 10%"*. Đó là thước đích của
  đòn bẩy này.
- **Trần**: đừng soạn mục cho hash lẻ tẻ (đếm 1–2) — nhiễu, tốn công duyệt. Đặt ngưỡng đếm tối thiểu, nâng dần.

## 6. Còn nợ / cần đo trên PC thật

- **Nợ đo**: num_ctx trần vừa 12 GB VRAM với qwen3.5:9b Q4 (dư hơn cỡ 14B); mức lợi prompt-caching thật của Ollama; giờ chạy đêm
  thực cho N cụm. Ghi số vào đây kèm ngày khi đo được trên trạm.
- **Nợ**: `phondata` 537 KB của espeak (cắt nữa phải build từ nguồn — ADR 0010 §P0).
- **Nợ**: bảng tra `hash → chủ đề` là cầu tạm; nâng cấp khi app-side P1 chốt shape gửi kèm hash.
