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
py -3.12 -m venv ~/sdfish-tram/vieneu-venv && ~/sdfish-tram/vieneu-venv/Scripts/pip install vieneu pydub   # ONNX CPU, không cần torch; cần ffmpeg trên PATH
~/sdfish-tram/vieneu-venv/Scripts/python gen_pack.py      # catalog.json → ~/sdfish-tram/giong-out/<giọng>/<id>.mp3 (đổi bằng SEN_BIEN_OUT)
node scripts/tram-o-bo/phat-hanh-local.mjs                # (ở gốc repo) đưa mp3 + kho đã duyệt vào public/tro-ly
```

- `catalog.json` — câu cố định. `text` = ĐÚNG NGUYÊN VĂN câu app đọc (khoá tra mp3 —
  test `src/lib/__tests__/assistant-voice-catalog.test.ts` chặn lệch với `answer.ts`);
  `doc` = cách ĐỌC khi chữ viết đọc sai (vd 115 → "một một năm"). **Cần SDVICO soát** trước khi phát hành (nhất là
  số khẩn "115" viết "một một năm" để đọc từng số).
- `gen_pack.py` — sinh mp3 24kHz mono 64k cho cả 2 giọng + `manifest.json`.
- `synth_senbien.py`, `synth_nu.py` — script đo/so giọng lúc chọn (giữ để tra lại).

## KHÔNG commit vào repo

`venv/`, model VieNeu (~282 MB tải ở Hugging Face lần chạy đầu), và thư mục
`out_pack/*.mp3` — đều là artefact nặng, để NGOÀI repo (trần dữ liệu git, xem
CLAUDE.md §"Dữ liệu bản đồ trong git"). Chỉ commit **công cụ + catalog** (text).

## Còn nợ

- ✅ 2026-09-30: 84 mp3 (42 câu × 2 giọng, 1,95 MB) đã vào gói `public/tro-ly/audio/`;
  máy chọn giọng theo tỉnh cảng nhà (Nam Bộ → `nam`, còn lại → `bac`).
- Số khẩn / tên riêng / cách đọc: SDVICO soát catalog.
