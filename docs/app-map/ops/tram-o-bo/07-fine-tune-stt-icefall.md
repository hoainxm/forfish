# 07 — Fine-tune STT nghe (zipformer-vi · icefall/k2)

> **Load khi**: giọng nghe của trợ lý kém ở một vùng miền và bạn đang cân nhắc fine-tune model
> STT `zipformer-vi-30M-int8`. **Đây là RUNBOOK + khung script — KHÔNG train lần này** (chưa đụng
> PC RTX 3060, **chưa đủ audio ĐỒNG THUẬN**). Số công cụ ghi kèm **ngày kiểm**; chưa đo thì ghi "cần đo".
>
> Anh em: [00-tong-quan](00-tong-quan.md) · [06-fine-tune-qwen-lora](06-fine-tune-qwen-lora.md) (LLM soạn gói).
> Bối cảnh STT trong máy + hotwords: **ADR 0010** (`docs/adr/0010-tro-ly-nghe-offline-wasm.md`) §P0.
> Script: `scripts/tram-o-bo/fine-tune/stt-icefall/`.

---

## 0. TL;DR

- **Leo thang trước:** thứ RẺ hơn fine-tune là **mở rộng hotwords + từ điển** (đã có sẵn, chở trong gói não). Thử hết đường đó **trước khi** đụng icefall. Xem mục 1.
- Fine-tune STT là **"nợ có điều kiện"** (ADR 0010): chỉ mở khi **có audio đồng thuận đủ** + intent-accuracy vùng miền dưới ngưỡng mà hotwords không cứu.
- Công cụ: **k2 + icefall + lhotse**, recipe **fine-tune zipformer từ checkpoint pretrained**. **icefall gần như bắt buộc Linux** → trên PC Windows đi qua **WSL2 hoặc Docker**.
- Xong thì **export ONNX int8** → nhét lại vào gói não WASM (sherpa-onnx) → **đo lại intent-accuracy trên bộ 50 câu P0 của ADR 0010, ngưỡng ≥85%**.

---

## 1. Bậc thang leo TRƯỚC khi fine-tune

Theo nguyên tắc 15 (leo thang, dừng ở bậc đủ dùng) và ADR 0010 §P0 (hotwords **đã đo có tác dụng thật**):

| Bậc | Việc | Chi phí | Khi nào đủ |
|---|---|---|---|
| 1 | **Thêm hotwords + từ điển** vào gói não (từ ngành: tên cảng, "nhớt", "Yanmar"…) | Rẻ (sửa file text trong gói) | Lỗi chủ yếu là **từ vựng ngành** bị nghe sai |
| 2 | Chỉnh `hotwordsScore` / luật trùng âm | Rẻ | (đã chốt 1,5 ở ADR — mỗi từ thêm phải chạy lại bộ 25 câu) |
| 3 | **Fine-tune zipformer** (doc này) | **Đắt**: cần audio đồng thuận, GPU, WSL2, người gán nhãn | Lỗi là **âm/giọng vùng miền**, không phải từ vựng; hotwords không kéo lên nổi |

> ⚠️ Hotwords **không cứu** nhóm lỗi ngoài từ vựng: đảo nghĩa ("mấy giờ"→"bây giờ"), từ gốc nước ngoài ("shop"→"cho"), số hiệu tàu thừa tiếng (ADR 0010 §P0d). **Chỉ những lỗi này, và chỉ khi lặp theo vùng miền, mới đáng fine-tune.** Nếu lỗi vẫn là từ vựng → quay lại bậc 1, đừng train.

**Điều kiện mở fine-tune (phải đủ CẢ ba):**
- (a) **Audio đồng thuận đủ**: xem mục 2 — không đủ đồng thuận thì **DỪNG**, không có ngoại lệ.
- (b) Intent-accuracy một vùng miền **< 85%** trên bộ 50 câu P0 (ADR 0010) **sau khi** đã áp hotwords.
- (c) Phân tích lỗi cho thấy sai **âm/giọng**, không phải từ vựng (từ vựng → bậc 1).

---

## 2. Audio PHẢI có đồng thuận — quy trình thu

> Đây là ràng buộc **cứng**, không phải khuyến nghị. Giọng bà con là **dữ liệu cá nhân**. ADR 0010:
> STT fine-tune "trên audio **có đồng thuận**". Không có đồng thuận → không có tập train, chấm hết.

**Quy trình thu + đồng ý + ẩn danh:**
1. **Xin đồng thuận rõ ràng, bằng tiếng Việt đời thường**, TRƯỚC khi thu: nói rõ (a) thu giọng để "dạy máy nghe tiếng mình", (b) không kèm tên/CCCD/SĐT, (c) bà con **được từ chối / rút lại** bất cứ lúc nào, (d) audio lưu ở bờ, không đẩy lên máy khác. Ghi lại **bằng chứng đồng ý** (checkbox có dấu thời gian / bản ký / ghi âm câu đồng ý), lưu tách khỏi audio.
2. **Ẩn danh khi thu**: đặt mã ngẫu nhiên cho mỗi người (vd `sp-北-001`), **không** gắn danh tính vào tên file/manifest. Bảng ánh xạ mã↔người (nếu buộc phải có để rút lại) giữ **riêng, mã hoá, ngoài repo**.
3. **Nội dung đọc**: lấy từ **230 câu test vector + 108 câu "chú Ba"** đã có trong test (ADR 0010 §P0 mục 3), phủ **3 vùng** (Bắc / Trung / Nam), ≥ vài người mỗi vùng.
4. **Rút lại được**: nếu bà con rút, xoá audio + nhãn của mã đó khỏi tập, train lại. Ghi cơ chế này thành việc thật, không chỉ hứa.
5. **Không đưa audio vào git** (trần dữ liệu, CLAUDE.md §"Dữ liệu bản đồ trong git") — audio + manifest để **ngoài repo**, thư mục làm việc ở bờ.

**Chưa có bộ audio đồng thuận này → doc dừng ở đây, chỉ làm bậc 1 hotwords.**

---

## 3. Công cụ — k2 / icefall / lhotse

**Kiểm 2026-09-11 (WebSearch + icefall docs):**

- icefall có **recipe fine-tune zipformer transducer từ checkpoint pretrained** sẵn: `zipformer/finetune.py`, cờ chính `--do-finetune 1`, `--finetune-ckpt <pretrained.pt>`, `--base-lr` **nhỏ** (~1/10, tài liệu ví dụ 0.0045), `--use-mux` (trộn data gốc nếu có), `--num-epochs`, `--max-duration`, `--use-fp16 1`. (nguồn: k2-fsa.github.io/icefall — Finetune/from_supervised/finetune_zipformer)
- Về tiếng Việt: có **Zipformer-30M cho tiếng Việt** đã phát hành công khai (khớp model `zipformer-vi-30M-int8` app đang dùng) + nghiên cứu VietASR/VietSuperSpeech gần đây — **nhưng chưa xác nhận có recipe fine-tune tiếng Việt dựng sẵn end-to-end**. → coi checkpoint pretrained vi là điểm xuất phát, dùng **recipe fine-tune chung** ở trên, **cần xác minh trên PC trạm** đúng cấu hình model (tokens, bpe, kiến trúc encoder) khớp checkpoint.
- **icefall chạy trên Linux là chính** (k2/CUDA build cho Linux; Windows native gần như không có đường). → **trên PC Windows của trạm: dùng WSL2 (Ubuntu) + CUDA, hoặc Docker image k2/icefall.** Ghi rõ trong README script.
- **Export ONNX int8**: icefall có `zipformer/export-onnx.py`; model int8 ra dạng `encoder.int8.onnx` v.v. để nạp vào **sherpa-onnx** — trang fine-tune đã fetch **không kèm** bước export, nên bước này lấy từ trang "Export to ONNX" của icefall, **cần kiểm đúng script cho non-streaming zipformer + tham số quantize**.

### Yêu cầu GPU / thời gian (chưa đo)

- Fine-tune zipformer-30M từ checkpoint trên **vài chục giờ audio** thường **nhẹ hơn train từ đầu nhiều**. Trên RTX 3060 12 GB: khả thi cho model 30M với `--max-duration` vừa (giảm nếu OOM), `--use-fp16 1`.
- **Thời gian: chưa đo trên 3060** — phụ thuộc số giờ audio + epoch. **Đừng hứa con số**; đo lần chạy đầu, ghi History.
- Rủi ro VRAM: `--max-duration` là đòn điều chỉnh chính; OOM thì hạ.

---

## 4. Dataset — manifest lhotse

### Định dạng
icefall ăn **manifest lhotse**: cặp `recordings` (đường dẫn wav + thời lượng) và `supervisions` (đoạn có nhãn: start, duration, `text`, `language=Vietnamese`, `speaker=<mã ẩn danh>`). Xuất `.jsonl.gz` (recordings + supervisions) rồi `compute fbank` → CutSet.

### Bước
1. Thu wav 16 kHz mono (khớp pipeline), theo mục 2 (có đồng thuận).
2. **Gán nhãn**: chép đúng chữ bà con nói (chuẩn chính tả, giữ từ ngành). Người gán nhãn hiểu giọng vùng.
3. `prepare_manifest.py` (khung ở script) quét thư mục audio + file nhãn → `recordings.jsonl.gz` + `supervisions.jsonl.gz`.
4. `lhotse compute-fbank` → đặc trưng; tạo CutSet train/dev/test.
5. **Augment** (tuỳ chọn, giúp bền với sóng/gió/máy nổ nền): speed perturb (0.9/1.0/1.1), thêm nhiễu nền biển/máy tàu ở SNR vừa. Augment **chỉ trên train**, không trên dev/test.

### Tách train / dev / test — chống rò rỉ
- **Tách theo người nói (speaker)**: một người **chỉ ở một tập**. Nếu cùng người vừa train vừa test → điểm ảo, model học giọng người đó chứ không phải vùng.
- Giữ **test = một phần bộ 50 câu P0** (hoặc đọc lại nội dung đó bởi người **không** có trong train) để so thẳng với ngưỡng ADR 0010.
- Phủ đủ 3 vùng ở cả train và test.

---

## 5. Quy trình — chuẩn bị → fine-tune → export → đo lại

```
[wav có đồng thuận + nhãn]
      │ prepare_manifest.py + lhotse compute-fbank
      ▼
[CutSet train/dev/test]
      │ icefall zipformer/finetune.py --do-finetune 1 --finetune-ckpt <vi.pt> --base-lr 0.0045 ...
      ▼
[checkpoint fine-tune]
      │ zipformer/export-onnx.py  (+ quantize int8)
      ▼
[encoder/decoder/joiner .int8.onnx]  → thay trong GÓI NÃO (sherpa-onnx WASM)
      │
      ▼
[đo lại: bộ 50 câu P0 (ADR 0010) → parseUtterance → intent-accuracy ≥ 85% ?]
      ├─ đạt & không kém vùng khác → nhận, đóng gói phiên bản mới
      └─ không đạt → giữ model cũ, phân tích lỗi lại
```

### Đo lại — cổng nghiệm thu (theo ADR 0010 §P0)
- Chạy model mới qua **cùng bộ 50 câu ghi âm thật** (≥3 người 3 vùng) → `parseUtterance` → **intent-accuracy**.
- **Ngưỡng: ≥ 85%**, và **không tệ hơn** vùng/model cũ trên cùng tập. Kém → **không thay**, giữ `zipformer-vi-30M-int8` gốc.
- Đo cả RTF (≤ 0,5, ADR) và dung lượng (int8 để vừa gói ~25 MB). Model to hơn/chậm hơn mà chỉ nhích accuracy → cân nhắc bỏ.
- Kiểm **không tụt vùng khác**: fine-tune nặng một vùng có thể làm kém vùng còn lại — đo cả 3 vùng, không chỉ vùng đang sửa.

---

## 6. Còn nợ + rủi ro

- **Còn nợ (recipe vi end-to-end)**: chưa xác nhận icefall có recipe fine-tune **tiếng Việt** dựng sẵn; đang dựa recipe chung + checkpoint vi. *Điều kiện*: xác minh trên PC trạm cấu hình model khớp checkpoint (tokens/bpe/encoder) trước khi train.
- **Còn nợ (bước export ONNX int8)**: script/tham số quantize cho non-streaming zipformer cần lấy đúng từ trang icefall "Export to ONNX" và **thử load bằng sherpa-onnx** trước khi tin. *Điều kiện*: chạy thử 1 câu qua sherpa-onnx sau export.
- **Còn nợ (số GPU/thời gian)**: chưa đo trên 3060. Ghi History sau lần chạy đầu.
- **Rủi ro Windows**: icefall/k2 native Windows gần như không có → **phải WSL2 hoặc Docker**; build k2+CUDA đúng phiên bản là phần dễ vấp nhất, chừa thời gian.
- **Rủi ro đạo đức/pháp lý**: thiếu đồng thuận là **chặn cứng**. Cơ chế rút-lại phải chạy thật.
- **Rủi ro overfit vùng/người**: tập nhỏ + tách sai (không theo speaker) → điểm ảo. Chống bằng tách theo speaker + test người lạ.
- **Rủi ro thoái hoá vùng khác**: đo cả 3 vùng (mục 5).
- **Không phá offline/app**: việc ở bờ; sản phẩm ra là **file ONNX** thay trong gói não, đi qua kênh cập nhật gói bình thường (manifest có sha256, đổi nguyên khối — xem contract gói não). Không đụng `src/`, không request mạng lúc app chạy.

---

## Cần chủ dự án / lead quyết

1. **Có đủ audio đồng thuận chưa?** Nếu chưa → **chỉ làm bậc 1 (hotwords + từ điển)**, hoãn fine-tune. (Đây là khuyến nghị mặc định lúc này.)
2. Nếu đủ: **thu audio 3 vùng** cần người + quy trình đồng thuận — ai lo, khi nào.
3. Duyệt hạ tầng: WSL2 hay Docker cho icefall trên PC trạm.

## History

- **2026-09-11**: Tạo runbook + khung script (chưa train, chưa đủ audio đồng thuận). Kiểm công cụ: icefall có recipe fine-tune zipformer từ checkpoint (`finetune.py --do-finetune`); Zipformer-30M vi có công khai; icefall cần Linux → WSL2/Docker trên Windows; export ONNX int8 có script riêng (cần kiểm). Nhấn: leo thang hotwords TRƯỚC; audio phải có đồng thuận.

## Nguồn tra cứu (2026-09-11)

- icefall — Fine-tune zipformer từ checkpoint: https://k2-fsa.github.io/icefall/recipes/Finetune/from_supervised/finetune_zipformer.html · index: https://k2-fsa.github.io/icefall/recipes/Finetune/index.html
- icefall — Export to ONNX: https://k2-fsa.github.io/icefall/model-export/export-onnx.html
- sherpa-onnx: https://k2-fsa.github.io/sherpa/onnx/index.html · zipformer vi (ADR 0010 §References)
- k2/icefall repo: https://github.com/k2-fsa/icefall · lhotse: https://github.com/lhotse-speech/lhotse
- Bối cảnh vi ASR: VietASR (arxiv 2505.21527), VietSuperSpeech (arxiv 2603.01894)
