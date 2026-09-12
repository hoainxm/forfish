# Fine-tune qwen3.5:9b LoRA — khung ở bờ (CHƯA CHẠY)

> **CHƯA CHẠY — runbook/khung, cần PC trạm (RTX 3060 12GB) + dữ liệu đã-duyệt.**
> Runbook đầy đủ + điều kiện mở khoá: [`docs/app-map/ops/tram-o-bo/06-fine-tune-qwen-lora.md`](../../../../docs/app-map/ops/tram-o-bo/06-fine-tune-qwen-lora.md).
> Đây chỉ là **công cụ chuẩn bị dữ liệu + config**. Không train lần này.

## Tiền điều kiện (đủ MỚI train — doc §1)

- Nháp gói bị người duyệt **sửa nặng/bỏ ≥ 30%** trong ≥ 4 tuần **và** ≥ **300 cặp đã duyệt**.
- Chưa đủ → **chỉ chỉnh prompt + few-shot** (bậc rẻ hơn), đừng train.
- Máy: Windows + RTX 3060 12 GB, Python 3.10+, môi trường Unsloth **cài NGOÀI repo** (venv/conda).
  Unsloth cần CUDA + PyTorch; theo hướng dẫn cài trên unsloth.ai cho đúng phiên bản CUDA của máy.

## File trong thư mục

| File | Việc | Trạng thái |
|---|---|---|
| `prepare_dataset.mjs` | Đọc cặp-đã-duyệt → `train.jsonl` / `eval.jsonl` (vệ sinh PII, khử trùng, tách theo cụm) | **Chạy được** (Node ≥ 20), có `--self-test` |
| `train_config.yaml` | Tham số QLoRA (điểm khởi đầu, **cần đo lại**) | Khung — chưa có `train.py` gọi (cố ý) |

## Lệnh chạy mẫu

```bash
# 1) Chuẩn bị dữ liệu (chạy được ngay khi có file cặp-đã-duyệt)
node prepare_dataset.mjs --self-test                       # kiểm logic, không cần file
node prepare_dataset.mjs --in ./data/approved.jsonl --out ./data --eval-ratio 0.18

# 2) Train (CHƯA có script — viết theo notebook Unsloth Qwen3.5 khi chủ dự án chốt)
#    Nạp train_config.yaml, dùng FastLanguageModel của Unsloth, SFTTrainer.
#    Xem doc §2 (tham số) + §4 (export).

# 3) Export sang Ollama (đường CHẮC: merge -> GGUF -> Modelfile)
#    model.save_pretrained_merged(...)  ->  convert_hf_to_gguf.py  ->  llama-quantize q4_k_m
#    ollama create qwen3-sdfish -f Modelfile
```

## KHÔNG commit vào repo

- `data/*.jsonl` (chứa câu bà con — dữ liệu, để **ngoài repo**; trần dữ liệu git, CLAUDE.md).
- `out/`, checkpoint, adapter, GGUF (nặng). Chỉ commit **công cụ + config** (text).

## Còn nợ

- **`train.py` chưa viết** (cố ý — chưa train lần này). Điều kiện: chủ dự án chốt mở fine-tune.
- **Tên hàm export Unsloth** (`save_pretrained_merged`/`save_pretrained_gguf`) — verify trên bản thực cài.
- **Ollama nạp adapter Qwen** chưa chắc → mặc định merge→GGUF (doc §4a).
- Số VRAM/thời gian **chưa đo** trên 3060 — ghi vào doc §History sau lần chạy đầu.
