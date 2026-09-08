# Máy sinh giọng "Sen Biển" ở bờ (VieNeu-TTS)

> Công cụ chạy **ở bờ** (trạm PC, không phải máy bà con) để sinh sẵn giọng đọc
> cho các **câu cố định** của trợ lý → nhét vào gói não offline (ADR 0010).
> KHÔNG chạy trên điện thoại khách, KHÔNG gọi mạng lúc app chạy.

## Quan hệ với ADR 0010

ADR 0010 (`docs/adr/0010-tro-ly-nghe-offline-wasm.md`): trợ lý chạy trọn trong máy
bà con; giọng đọc = giọng máy / piper offline, **hoặc mp3 sinh sẵn ở bờ** cho câu
cố định. Đây là bộ sinh mp3 đó — **VieNeu-TTS thay OmniVoice** (chốt 2026-09-08).

- **Giọng chốt**: `bac` = Trúc Ly (Bắc, dùng cho cả Bắc + Trung), `nam` = Mỹ Duyên (Nam).
- **Tối giản**: chỉ pre-bake câu CỐ ĐỊNH. Câu ngoài kịch bản → luồng "trao đổi khi
  có sóng" (hộp chờ sóng ADR 0010), KHÔNG sinh audio sẵn. Câu động (có số sống:
  thời tiết, giá) → đọc bằng piper/Web Speech trong máy, KHÔNG pre-bake.

## Chạy (ở bờ, cần Python 3.12 + venv ngoài repo)

```bash
python -m venv venv && venv/Scripts/pip install vieneu   # ONNX CPU, không cần torch
venv/Scripts/python gen_pack.py                           # đọc catalog.json → out_pack/<giọng>/<id>.mp3
```

- `catalog.json` — SEED câu cố định (id theo intent, dạng ĐỌC). Lấy từ
  `src/lib/assistant/answer.ts`. **Cần SDVICO soát** trước khi phát hành (nhất là
  số khẩn "115" viết "một một năm" để đọc từng số).
- `gen_pack.py` — sinh mp3 24kHz mono 64k cho cả 2 giọng + `manifest.json`.
- `synth_senbien.py`, `synth_nu.py` — script đo/so giọng lúc chọn (giữ để tra lại).

## KHÔNG commit vào repo

`venv/`, model VieNeu (~282 MB tải ở Hugging Face lần chạy đầu), và thư mục
`out_pack/*.mp3` — đều là artefact nặng, để NGOÀI repo (trần dữ liệu git, xem
CLAUDE.md §"Dữ liệu bản đồ trong git"). Chỉ commit **công cụ + catalog** (text).

## Còn nợ

- Nhét `out_pack/` vào gói não + contract `tro-ly-brain-pack` — chờ **P1 của ADR 0010**
  (chưa dựng). Lúc đó chốt: máy chọn giọng theo vùng (bac/nam) thế nào.
- Số khẩn / tên riêng / cách đọc: SDVICO soát catalog.
