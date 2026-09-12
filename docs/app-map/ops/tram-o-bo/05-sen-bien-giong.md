# 05 — Vận hành giọng "Sen Biển" (VieNeu-TTS)

> **Load khi / dùng khi**: câu cố định của trợ lý đổi và bạn cần sinh lại giọng đọc sẵn để nhét vào gói não.
> Công cụ đã có: [`scripts/tro-ly-giong/`](../../../../scripts/tro-ly-giong/README.md) (README + `gen_pack.py` + `catalog.json`).
> Doc này là phần **vận hành trong vòng đêm**; luồng đêm tổng thể: [03-vong-dem-soan-goi.md](03-vong-dem-soan-goi.md) §6.
> Đường dẫn/đóng gói: [contract gói não](../../../contracts/tro-ly-brain-pack.contract.md) (Agent B). Dung lượng: [04-toi-uu.md](04-toi-uu.md) §4.

## 1. VieNeu ĐÃ THAY OmniVoice (đừng lẫn)

- Quyết định thật (chốt **2026-09-08**): giọng "Sen Biển" = **VieNeu-TTS** ([github.com/pnnbao97/VieNeu-TTS](https://github.com/pnnbao97/VieNeu-TTS), Apache-2.0).
- ⚠️ [ADR 0010](../../../adr/0010-tro-ly-nghe-offline-wasm.md) §"Về OmniVoice" còn ghi **OmniVoice** — đó là **chữ CŨ/stale**,
  không phải quyết định hiện hành. Ai đọc ADR thấy "OmniVoice sinh giọng ở bờ" thì hiểu là **VieNeu** đã thay chỗ đó.
- **Hai giọng chốt**: `bac` = **Trúc Ly** (Bắc, dùng cho cả Bắc + Trung), `nam` = **Mỹ Duyên** (Nam).
- Đo 2026-09-08: `pip install vieneu` (ONNX CPU, **không cần torch**); model v3 Turbo ~282 MB (tải HF lần đầu);
  gói mp3 câu cố định 24kHz mono 64k ≈ **0,66 MB/giọng cho 23 câu**.

## 2. Chỗ giọng đứng trong hệ đọc của Sen Biển

Máy bà con đọc theo thứ tự (ADR 0010):

| Loại câu | Đọc bằng | Ở đâu | Vì sao |
|---|---|---|---|
| **Câu CỐ ĐỊNH** (chào, xác nhận, "chưa có trong máy", câu an toàn…) | **mp3 VieNeu sinh sẵn ở bờ** | trong gói não | giọng tự nhiên nhất, 0 tính toán trên máy, nghe ấm |
| **Câu có SỐ SỐNG** (giá cá, cấp gió, giờ con nước…) | **piper vi** trong máy (TTS offline) hoặc `speechSynthesis` của máy nếu có giọng vi | máy | số thay đổi từng lúc, không thể bake trước |
| Máy không có giọng vi + không piper | Web Speech (khi có sóng) | máy | độ lùi cuối |

**Luật**: chỉ bake câu **không** chứa số sống. Câu động **không** pre-bake (ADR 0010; [scripts/tro-ly-giong/README.md](../../../../scripts/tro-ly-giong/README.md) §Tối giản).

## 3. Vòng đêm: khi `answers` đổi câu cố định

1. Câu cố định của gói nằm trong `answers.json` (khuôn: [contract](../../../contracts/tro-ly-brain-pack.contract.md), Agent B).
   Nguồn SEED hiện tại: [`scripts/tro-ly-giong/catalog.json`](../../../../scripts/tro-ly-giong/catalog.json) (lấy từ `src/lib/assistant/answer.ts`, dạng ĐỌC).
2. Câu cố định **mới/đổi** (sau bước duyệt, [03](03-vong-dem-soan-goi.md) §5) → cập nhật `catalog.json` (hoặc
   nguồn câu cố định mà contract chốt) → chạy:
   ```bash
   venv/Scripts/python scripts/tro-ly-giong/gen_pack.py   # → out_pack/<giọng>/<id>.mp3 + manifest
   ```
3. `gen_pack.py` sinh **cả 2 giọng** (bac, nam), mp3 24kHz mono 64k, kèm `out_pack/manifest.json` (id, text, ms, bytes).
4. Nhét `out_pack/<giọng>/*.mp3` vào gói theo **đường dẫn contract** (Agent B). Đề xuất (chờ contract chốt):
   `audio/<voice>/<id>.mp3` với `<voice>` ∈ {`bac`,`nam`}. `id` khớp `answers` để máy tra được mp3 theo câu.
5. `out_pack/` và `venv/` + model VieNeu **KHÔNG commit** (nặng — CLAUDE.md §git; [README](../../../../scripts/tro-ly-giong/README.md) §KHÔNG commit).
   Chỉ commit **công cụ + catalog** (text). File mp3 đi vào **gói não trên bucket**, không vào repo.
6. Đóng gói + kiểm: [03](03-vong-dem-soan-goi.md) §6 (`export-brain-pack.mjs` tính sha256 mp3 luôn; `validate` kiểm khớp manifest).

## 4. SDVICO soát trước phát hành (checklist)

Máy đọc mp3 đúng y file — sai một chữ là **sai suốt gói** cho tới đợt sau. Nên soát tay trước khi phát:

- [ ] **Số khẩn**: "115" phải viết **"một một năm"** trong text để đọc từng số (đọc "một trăm mười lăm" là sai
      nghiêm trọng — ngư dân bấm nhầm). Kiểm cả các số hiệu/kênh đài duyên hải nếu có.
- [ ] **Tên riêng / tên cảng / hãng máy**: nghe lại từng câu có tên riêng (Yanmar, tên cảng, tên cá) — VieNeu
      có thể đọc lệch. Sai thì sửa **chính tả phiên đọc** trong text (viết theo cách đọc), không đổi luật máy.
- [ ] **Ngắt câu / ngữ điệu**: câu an toàn ("nghe thêm đài duyên hải") đọc rõ, không nuốt chữ.
- [ ] **Hai giọng đều nghe được**: mở thử vài mp3 `bac` và `nam`, không méo, không cụt đuôi.
- [ ] **Không câu số sống lọt vào** danh sách bake (giá/thời tiết) — thuộc piper, không bake.
- [ ] `out_pack/manifest.json` đủ số file = 2 × số câu; câu nào LỖI (in `[id] LỖI` khi chạy) phải sinh lại.

Soát xong mới đưa mp3 vào gói → đóng gói → đăng ([02-quan-tri-va-update.md](02-quan-tri-va-update.md), Agent B).

## 5. Máy chọn giọng bac/nam thế nào — **câu hỏi mở (cần quyết)**

Gói có **cả hai** giọng. Máy phát giọng nào cho một bà con thì **CHƯA chốt**. Vài đường có thể:
- Theo **vùng đăng ký của tàu/hồ sơ** (tỉnh) → bản đồ tỉnh→giọng (Bắc+Trung→`bac`, Nam→`nam`).
- Theo **bà con tự chọn** một lần trong cài đặt trợ lý (đơn giản, tôn trọng tai người nghe).
- Mặc định một giọng, cho đổi.

→ **Cần chủ dự án + đội UI quyết** (thuộc app-side P3, ADR 0010, ngoài phạm vi trạm). Ghi vào "cần quyết".
Trạm chỉ **sinh sẵn cả hai giọng**; chọn giọng là việc của máy, không phải của trạm. Vì gói mang cả hai nên
quyết muộn cũng không phải sinh lại.

## 6. Còn nợ / cần quyết

- **Cần quyết**: luật máy chọn giọng theo vùng (§5) — app-side, không phải trạm.
- **Nợ**: đường dẫn mp3 trong gói (`audio/<voice>/<id>.mp3`) là **đề xuất**; chốt theo [contract](../../../contracts/tro-ly-brain-pack.contract.md) (Agent B).
- **Nợ** (từ [README](../../../../scripts/tro-ly-giong/README.md)): nối `out_pack/` vào gói + contract chờ P1 ADR 0010; SDVICO soát catalog số khẩn/tên riêng.
