# 06 — Fine-tune LLM soạn gói (qwen3.5:9b · LoRA/QLoRA trên RTX 3060)

> **Load khi**: bạn đã cân nhắc fine-tune model "thầy" soạn nháp gói não ở trạm bờ, và cần
> biết *khi nào nên làm*, *làm bằng gì*, *quy trình gì*. **Đây là RUNBOOK + config sẵn-sàng —
> KHÔNG train lần này** (chưa đụng PC RTX 3060, chưa đủ dữ liệu duyệt). Mọi con số công cụ
> ghi kèm **ngày kiểm** — số nào chưa đo trên PC trạm thì ghi rõ "cần đo".
>
> Anh em: [00-tong-quan](00-tong-quan.md) (bức tranh trạm) · [03-vong-dem-soan-goi](03-vong-dem-soan-goi.md)
> (vòng đêm sinh ra *dữ liệu* cho fine-tune này) · [01-cai-local-llm](01-cai-local-llm.md) (Ollama + qwen3.5:9b base).
> STT fine-tune ở [07-fine-tune-stt-icefall](07-fine-tune-stt-icefall.md). Script: `scripts/tram-o-bo/fine-tune/qwen-lora/`.

---

## 0. TL;DR cho người vận hành

- **Chưa cần fine-tune ngay.** Base qwen3.5:9b Q4 + prompt tốt (xem [03](03-vong-dem-soan-goi.md)) đủ soạn nháp cho người duyệt. Fine-tune chỉ mở khi có **tín hiệu đo được** (mục 1).
- Khi có tín hiệu: **QLoRA bằng Unsloth**, model **qwen3.5:9b** (~6,6 GB base), chạy lọt RTX 3060 12 GB **dư đầu** (không còn ranh giới OOM như cỡ 14B).
- Dữ liệu train = **cặp (câu bà con hỏi → mục knowledge người duyệt đã CHỐT)** tích luỹ từ vòng đêm. Không có cặp đã duyệt thì **không train**.
- Kết quả không thay base thẳng: **giữ base làm dự phòng**, adapter/merge chỉ dùng khi tập eval do người chấm cho thấy nháp tốt hơn thật.

---

## 1. Khi nào NÊN fine-tune (điều kiện mở khoá)

Fine-tune là **"nợ có điều kiện"** — theo tinh thần ADR 0010 Option C (LLM chỉ mở khi có tín hiệu thật, không mở vì "nghe hay"). Model **thầy** ở bờ khác model trong máy bà con, nhưng nguyên tắc giữ nguyên: **không thêm một tầng phức tạp khi prompt đã đủ**.

**Chỉ mở khi CẢ hai nhóm sau đúng:**

**A. Tín hiệu chất lượng (base + prompt đang đuối):**
- Tỉ lệ nháp bị người duyệt **sửa nặng hoặc bỏ** ≥ **30%** trong ≥ 4 tuần liên tiếp (đo ở hàng đợi `/quan-tri`, xem [03](03-vong-dem-soan-goi.md) — cần cột "trạng thái duyệt" đếm được). Sửa nhẹ (câu chữ) **không tính**; tính khi nội dung/định dạng sai.
- Lỗi lặp **có hệ thống** (cùng một kiểu sai: bịa số liệu, sai giọng văn ngư dân, lệch khuôn JSON) mà **sửa prompt vài vòng vẫn không dứt**. Nếu sửa prompt là dứt → sửa prompt, đừng train.

**B. Đủ dữ liệu sạch để train:**
- ≥ **300 cặp đã duyệt** (câu hỏi thật → mục knowledge người CHỐT), phủ đủ chủ đề (bảo quản cá, máy/nhớt, lưới, giấy tờ, cảng, mùa vụ…). Dưới ~300 cặp: rủi ro overfit cao hơn lợi ích → **chưa train**, gom thêm.
- Cặp phải là bản **người duyệt đã sửa đúng**, không phải nháp thô của model (train trên nháp thô = học lại lỗi của chính mình).

> Chưa đủ A **hoặc** chưa đủ B → **không train**. Đường rẻ hơn phải thử trước: chỉnh prompt hệ thống, thêm ví dụ few-shot trong prompt, tách nhỏ tác vụ (một lượt sinh `cauHoiMau`, một lượt sinh `traLoi`). Đây là bậc thang leo trước fine-tune.

**Ai quyết mở**: chủ dự án + lead trợ lý, dựa trên số A/B ở trên. Ghi ngày chốt vào History cuối file.

---

## 2. Công cụ — Unsloth QLoRA

**Kiểm 2026-09-11 (WebSearch + Unsloth docs); cập nhật 2026-09-12 (chốt qwen3.5:9b):**

- **Unsloth** hỗ trợ QLoRA cho họ **Qwen3.5** (tham chiếu: unsloth.ai/docs/models/qwen3.5/fine-tune) — **cùng recipe** như họ Qwen3 trước đó (các cỡ 0.6B / 1.7B / 4B / 8B / 14B / 30B-A3B / 32B). → **qwen3.5:9b nằm trong tầm QLoRA của Unsloth.**
- VRAM: QLoRA cỡ 7–9B thường **~8–10 GB**. → **qwen3.5:9b (~6,6 GB base) lọt 12 GB của 3060 CÓ DƯ ĐẦU** — không còn là "RANH GIỚI OOM" như cỡ 14B trước đây (9B < 14B), nên `max_seq_length`/rank có chỗ nới. **Vẫn đo lại trên PC trạm.**
- Tài liệu Unsloth **không nêu** giá trị cụ thể cho LoRA rank / batch / lr / số step → các số trong config dưới đây là **điểm khởi đầu an toàn theo thực hành QLoRA phổ biến**, phải **đo lại trên PC trạm**, không phải cam kết.

> ⚠️ **Ghi chú tên model (2026-09-12)**: chủ dự án **đã chốt `qwen3.5:9b`** — bản mới nhất có cỡ ~9B lọt 12GB (các series mới hơn Qwen3.6 27B/35B, Qwen3.8 lớn hơn — **không có** bản 9B). **Cùng recipe Unsloth QLoRA** như Qwen3 (nguồn: unsloth.ai/docs/models/qwen3.5/fine-tune), chỉ đổi tên base model và **đo lại VRAM/chất lượng** trên 3060.

### Tham số khả thi trên RTX 3060 12 GB (điểm khởi đầu — cần đo)

| Tham số | qwen3.5:9b (~6,6 GB base, QLoRA lọt 12GB dư) |
|---|---|
| `load_in_4bit` | `true` (QLoRA) |
| `max_seq_length` | 2048 (còn VRAM dư → nới lên được nếu cần) |
| LoRA `r` (rank) | 16 |
| LoRA `alpha` | 16 (= r, hoặc 2×r) |
| `target_modules` | q,k,v,o + gate,up,down proj |
| batch/thiết bị | 1–2 |
| `gradient_accumulation` | 8 (→ batch hiệu dụng 8–16) |
| `learning_rate` | 2e-4 |
| epoch | 2–3 (tập nhỏ dễ overfit) |
| optimizer | `adamw_8bit` |
| `gradient_checkpointing` | `"unsloth"` |

**Ước thời gian (chưa đo — dựa cấp độ phần cứng, phải đo thật):** ~300–800 cặp, seq 2048, 2–3 epoch, qwen3.5:9b QLoRA trên 3060: **ước cỡ 20–60 phút/epoch**. Ghi số thật vào History sau lần chạy đầu. **Đừng hứa con số này với ai trước khi đo.**

---

## 3. Dataset — lấy từ đâu, khuôn gì

### Nguồn
Từ **vòng đêm** ([03](03-vong-dem-soan-goi.md)): mỗi khi người duyệt CHỐT một mục knowledge trả lời cho một cụm câu hỏi thật của bà con, ta có một **cặp huấn luyện**:
- **input** = (các) câu bà con hỏi thật trong cụm (đã chuẩn hoá, **bỏ CCCD/SĐT/toạ độ** — vốn không được gửi lên server, ADR 0010).
- **output** = mục knowledge người duyệt đã chốt (`cauHoiMau`, `tuKhoa`, `traLoi ≤4 câu`, `nguon`, `ngaySoat`).

Nghĩa là dataset **tự sinh ra như sản phẩm phụ của việc duyệt** — không phải đi thu riêng. `prepare_dataset.mjs` đọc kho cặp-đã-duyệt và xuất JSONL.

### Khuôn JSONL (instruction tuning)
Một dòng = một mẫu; theo khuôn chat của qwen3.5:9b (system/user/assistant). File: `train.jsonl`:

```json
{"messages":[
  {"role":"system","content":"Bạn soạn mục kiến thức cho trợ lý ngư dân SDFish. Trả lời NGẮN (≤4 câu), tiếng Việt đời thường, KHÔNG bịa số liệu biến động (giá/thời tiết), luôn ghi nguồn. Xuất đúng JSON theo khuôn."},
  {"role":"user","content":"Bà con hỏi: \"cá ngừ câu về bảo quản sao cho tươi\" | \"ướp cá ngừ mấy độ\""},
  {"role":"assistant","content":"{\"cauHoiMau\":[\"bảo quản cá ngừ\",\"ướp cá ngừ bao nhiêu độ\"],\"tuKhoa\":[\"cá ngừ\",\"bảo quản\",\"ướp đá\"],\"traLoi\":\"Cá ngừ giữ lạnh 0–2°C, muối đá ngay sau khi bắt. Xả tiết, moi mang ruột trước khi ướp. Tỉ lệ đá:cá khoảng 1:1, thay đá khi tan. Tránh nắng, che khoang cá.\",\"nguon\":\"Tài liệu SDVICO — bảo quản hải sản\",\"ngaySoat\":\"2026-08\"}"}
]}
```

### Vệ sinh dữ liệu (bắt buộc)
1. **Bỏ dòng có PII lọt qua**: regex quét CCCD (9/12 số), SĐT (0/+84…), toạ độ — dòng nào dính thì **loại**, không "che" (an toàn hơn).
2. **Khử trùng lặp** câu input gần giống (chuẩn hoá `foldVn` + so trùng) — tránh một cụm phổ biến áp đảo tập.
3. **Bỏ mẫu output không hợp lệ**: JSON parse fail, `traLoi` > 4 câu, có số giá/thời tiết (luật nội dung ADR 0010 — số sống chỉ từ snapshot, không vào kho).
4. **Cân chủ đề**: đừng để 70% là "giấy tờ". Ghi phân bố chủ đề ra log.

### Tách train / eval — chống rò rỉ
- Tách **theo cụm chủ đề/câu gốc**, KHÔNG tách ngẫu nhiên theo dòng: một câu hỏi và biến thể của nó phải **cùng phía** (cùng train hoặc cùng eval), nếu không eval sẽ "thấy trước" → điểm ảo.
- Tỉ lệ gợi ý: **eval ~15–20%**, chọn phủ đủ chủ đề. Eval **do người chấm** (mục 5), không chấm bằng máy.
- Giữ một **tập giữ lại (holdout)** vài chục cặp *không bao giờ* đưa vào vòng lặp chỉnh tham số — để đo trung thực lần cuối.

---

## 4. Quy trình — chuẩn bị → train → nạp vào Ollama

```
[cặp đã duyệt]  --prepare_dataset.mjs-->  train.jsonl + eval.jsonl
      │
      ▼
[Unsloth QLoRA]  --train_config.yaml-->  adapter LoRA (safetensors)
      │
      ├── (A) merge → GGUF → Ollama Modelfile  (đường CHẮC CHẮN chạy)
      └── (B) adapter rời qua Ollama ADAPTER   (CẦN KIỂM — xem dưới)
      │
      ▼
[eval người chấm]  so nháp base vs nháp fine-tune trên eval.jsonl
```

### 4a. Nạp vào Ollama — sự thật đã kiểm (2026-09-11)

Trạm dùng **Ollama** để phục vụ model soạn gói ([01](01-cai-local-llm.md)). Về nạp LoRA:

- **Ollama `ADAPTER` (adapter rời)**: Modelfile có chỉ thị `ADAPTER <path>` nạp LoRA lên base. **Nhưng** danh sách kiến trúc được hỗ trợ chính thức (kiểm 2026-09-11) nêu **Llama / Mistral / Gemma** — **Qwen chưa thấy ghi rõ được hỗ trợ cho ADAPTER**. Do đó **KHÔNG hứa** đường adapter-rời cho Qwen3.5. ⇒ coi (B) là "cần kiểm trên PC trạm", nếu không chạy thì đi đường (A).
- **Đường CHẮC CHẮN (A) — merge rồi tạo GGUF**: đây là đường mặc định của runbook.
  1. Unsloth `model.save_pretrained_merged(...)` (merge LoRA vào base, xuất 16-bit) — hoặc `save_pretrained_gguf(...)` xuất thẳng GGUF quantize (nếu môi trường build llama.cpp sẵn).
  2. Nếu chỉ có merged 16-bit: dùng `llama.cpp/convert_hf_to_gguf.py` → GGUF, rồi `llama-quantize` xuống Q4_K_M.
  3. `Modelfile`:
     ```
     FROM ./qwen3.5-9b-sdfish-Q4_K_M.gguf
     TEMPLATE """{{ .System }}...{{ .Prompt }}"""   # theo chat template qwen3.5
     PARAMETER temperature 0.3
     ```
  4. `ollama create qwen3-sdfish -f Modelfile` → vòng đêm trỏ sang model này.

> `save_pretrained_gguf` / cách merge cụ thể của Unsloth **không có trong trang tài liệu đã fetch 2026-09-11** — hàm tồn tại theo thực hành phổ biến nhưng **phải xác minh tên hàm/đối số trên phiên bản Unsloth cài ở PC trạm** trước khi tin. Ghi ra `// nợ:` trong script.

### 4b. Giữ base làm dự phòng
Model fine-tune **không đè** model base trong Ollama. Vòng đêm giữ biến `MODEL_SOAN` trỏ mặc định về **base**; chỉ chuyển sang `qwen3-sdfish` khi eval (mục 5) đạt. Nếu bản fine-tune sinh nháp tệ đi ở prod → đổi biến về base **tức thì**, không cần train lại.

---

## 5. Đánh giá — so nháp trước/sau, người chấm

- Chạy **base** và **fine-tune** trên cùng `eval.jsonl` → 2 tập nháp.
- **Người duyệt chấm mù** (không biết cái nào của bên nào) theo thang: (1) đúng khuôn JSON, (2) `traLoi` đúng & đủ & ≤4 câu, (3) không bịa số, (4) giọng văn hợp bà con, (5) `nguon`/`ngaySoat` hợp lý.
- **Chỉ nhận fine-tune khi**: tỉ lệ nháp "nhận thẳng không sửa" **cao hơn base rõ rệt** trên tập eval **và** không xuất hiện lỗi mới (nhất là bịa số). Hoà hoặc kém → **giữ base**, coi như dữ liệu chưa đủ tín hiệu.
- Kiểm **quên năng lực chung**: hỏi vài câu ngoài phạm vi cá (để chắc model không "chỉ còn biết mỗi khuôn JSON"). Nếu model thầy chỉ dùng đúng một việc (soạn gói) thì mất năng lực chung ít hại — nhưng vẫn ghi lại.

---

## 6. Còn nợ + rủi ro

- **Còn nợ (đường Ollama adapter rời cho Qwen)**: chưa xác nhận Ollama nạp được `ADAPTER` cho kiến trúc Qwen3.5. *Điều kiện nâng cấp*: kiểm trên PC trạm; nếu không được, cố định đường merge→GGUF và xoá nhánh (B) khỏi script.
- **Còn nợ (tên hàm export Unsloth)**: `save_pretrained_gguf`/`save_pretrained_merged` phải verify đúng chữ ký trên bản Unsloth thực cài. *Điều kiện*: chạy `help()` sau khi cài, cập nhật `train_config.yaml` + README.
- **Còn nợ (số VRAM/thời gian qwen3.5:9b)**: chưa đo trên 3060. *Điều kiện*: đo lần chạy đầu, ghi History; 9B (~6,6GB base) khó OOM, nhưng nếu chật thì hạ `max_seq_length`/rank trước.
- **Rủi ro overfit tập nhỏ**: ≤ vài trăm cặp rất dễ học vẹt. Chống bằng: rank thấp (8–16), epoch ít (2–3), eval tách theo cụm + holdout, và **luôn có base dự phòng**.
- **Rủi ro quên năng lực chung (catastrophic forgetting)**: LoRA nhẹ nên đỡ hơn full-finetune, nhưng vẫn kiểm ở mục 5.
- **Rủi ro "train trên nháp của chính mình"**: chỉ dùng cặp **người đã duyệt**, không dùng nháp thô — nếu không sẽ khuếch đại lỗi.
- **Không phá offline / app**: việc này **hoàn toàn ở bờ**, không đụng `src/`, không đụng máy bà con, không request mạng lúc app chạy. Sản phẩm ra là **model soạn nháp** cho người duyệt — chất lượng gói vẫn qua cổng người duyệt trước khi tới bà con.

---

## Cần chủ dự án / lead quyết

1. **Đã đủ tín hiệu để fine-tune chưa?** (mục 1 A+B). Nếu chưa → tạm chỉ **chỉnh prompt + few-shot**, đây là bậc rẻ hơn.

> Model base **đã chốt `qwen3.5:9b`** (2026-09-12) — bản Qwen mới nhất có cỡ ~9B lọt 12GB, dư chỗ QLoRA. Không còn câu hỏi "8B hay 14B" hay "có chuyển Qwen3.5 không".

## History

- **2026-09-11**: Tạo runbook + config (chưa train). Kiểm công cụ: Unsloth QLoRA hỗ trợ Qwen3 8B/14B (docs unsloth.ai); Ollama ADAPTER chính thức Llama/Mistral/Gemma, Qwen **chưa rõ** → mặc định đường merge→GGUF. Số VRAM/thời gian/hyperparam là điểm khởi đầu, **cần đo trên PC trạm**.
- **2026-09-12**: Chủ dự án chốt base **`qwen3.5:9b`** (bản mới nhất có cỡ ~9B lọt 12GB; Qwen3.6/3.8 không có bản 9B). Lật lập luận VRAM: 9B (~6,6GB base) là fit **dư đầu**, bỏ khung "14B ranh giới OOM". Cùng recipe Unsloth QLoRA (unsloth.ai/docs/models/qwen3.5/fine-tune). Gộp 2 cột hyperparam 8B/14B thành 1 cột qwen3.5:9b. Vẫn **CHƯA train**.

## Nguồn tra cứu (2026-09-11)

- Unsloth — Qwen3 how-to-run-and-fine-tune: https://unsloth.ai/docs/models/tutorials/qwen3-how-to-run-and-fine-tune
- Unsloth — Qwen3.5 fine-tune (họ mới, tham chiếu): https://unsloth.ai/docs/models/qwen3.5/fine-tune
- Ollama Modelfile `ADAPTER`: https://docs.ollama.com/modelfile · issue LoRA GGUF: https://github.com/ollama/ollama/issues/5788
- LoRA→GGUF cho Ollama (ví dụ cộng đồng): https://github.com/hrishi-008/LoRA-adapter-to-GGUF-for-Ollama-with-code
