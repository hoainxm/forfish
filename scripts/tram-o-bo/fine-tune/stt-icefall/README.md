# Fine-tune STT zipformer-vi (icefall) — khung ở bờ (CHƯA CHẠY)

> **CHƯA CHẠY — runbook/khung, cần PC trạm + AUDIO CÓ ĐỒNG THUẬN.**
> Runbook đầy đủ + điều kiện + quy trình đồng thuận: [`docs/app-map/ops/tram-o-bo/07-fine-tune-stt-icefall.md`](../../../../docs/app-map/ops/tram-o-bo/07-fine-tune-stt-icefall.md).
> Đây chỉ là **khung chuẩn bị manifest**. Không train lần này.

## Bậc thang leo TRƯỚC (doc §1) — làm cái này trước

Rẻ hơn fine-tune nhiều: **mở rộng hotwords + từ điển** trong gói não. Chỉ khi lỗi là **âm/giọng
vùng miền** (không phải từ vựng) và hotwords không cứu, mới đụng icefall.

## Tiền điều kiện (đủ CẢ mới train — doc §1,2)

- **Audio CÓ đồng thuận** (mục quan trọng nhất — doc §2): xin phép rõ, ẩn danh, rút-lại-được. **Thiếu đồng thuận = DỪNG.**
- Intent-accuracy một vùng **< 85%** trên bộ 50 câu P0 (ADR 0010) **sau** khi đã áp hotwords.
- **Hạ tầng**: icefall/k2 cần **Linux** → trên PC Windows dùng **WSL2 (Ubuntu + CUDA)** hoặc **Docker** image k2/icefall. CUDA khớp GPU 3060.
- Python 3.10+, cài `lhotse`, `k2`, `icefall` (ngoài repo).

## Quy trình (tóm tắt — chi tiết ở doc §5)

```bash
# 1) Thu audio 16kHz mono CÓ đồng thuận, gán nhãn (đặt trong <audio_dir>, ngoài repo)

# 2) Sinh manifest lhotse (khung — CHƯA chạy được trọn, cần lhotse cài)
python prepare_manifest.py --audio-dir /data/senbien-audio --labels /data/labels.tsv \
    --out /data/manifests --split-by speaker

# 3) Đặc trưng + CutSet (lhotse)
#    lhotse compute-fbank ...  -> cuts_train/dev/test.jsonl.gz

# 4) Fine-tune từ checkpoint pretrained vi (icefall, trong WSL2/Docker)
./zipformer/finetune.py \
    --do-finetune 1 \
    --finetune-ckpt exp/pretrained-vi.pt \
    --base-lr 0.0045 \            # nhỏ (~1/10) để không quên
    --use-mux 0 \                 # 1 nếu có data gốc để trộn
    --num-epochs 15 \
    --use-fp16 1 \
    --max-duration 600 \         # hạ nếu OOM trên 12GB
    --exp-dir zipformer/exp_vi_finetune

# 5) Export ONNX int8 (để nhét lại vào gói não sherpa-onnx WASM)
./zipformer/export-onnx.py --epoch <n> --avg <m> ...   # verify script non-streaming + quantize int8

# 6) Đo lại: bộ 50 câu P0 -> parseUtterance -> intent-accuracy >= 85%, không tụt vùng khác
#    (xem ADR 0010 §P0). Không đạt -> GIỮ model cũ.
```

## File trong thư mục

| File | Việc | Trạng thái |
|---|---|---|
| `prepare_manifest.py` | Quét audio + nhãn → manifest lhotse (`recordings`/`supervisions`), tách theo **speaker** | **Khung** — cần `lhotse`; có `--dry-run` in thống kê không cần lhotse |

## KHÔNG commit vào repo

- Audio, nhãn, manifest, checkpoint, ONNX — **tất cả để ngoài repo** (dữ liệu cá nhân + nặng).
  Bảng ánh xạ mã↔người (nếu có, để rút-lại) giữ **riêng, mã hoá**, không vào git.

## Còn nợ

- **Recipe fine-tune tiếng Việt end-to-end** chưa xác nhận dựng sẵn — dùng recipe chung + checkpoint vi, verify cấu hình khớp trên PC trạm.
- **Bước export ONNX int8** cần lấy đúng script/tham số từ trang icefall + thử load bằng sherpa-onnx.
- Số **GPU/thời gian** chưa đo trên 3060.
- Cơ chế **rút-lại đồng thuận** phải chạy thật (xoá audio+nhãn theo mã, train lại).
