# Trạm học ở bờ — mục lục

> **Load khi**: vận hành PC-ở-bờ để soạn / sinh giọng / phát hành **gói não** trợ lý "Sen Biển", hoặc bàn chuyện cài local LLM · quản trị/update gói · tối ưu · fine-tune. KHÔNG phải code app điện thoại (việc đó ở [ADR 0010](../../../adr/0010-tro-ly-nghe-offline-wasm.md) + [14-kien-truc-tro-ly](../../14-kien-truc-tro-ly.md)).

**Trạm ở bờ là gì**: một PC (RTX 3060 12 GB, i5-14400F, 32 GB, Windows) chạy 24/7 **ở nhà**, **KHÔNG phục vụ ngư dân trực tiếp** (IP nhà, không SLA). Việc của nó: mỗi đêm soạn nháp nội dung (qwen3.5:9b qua Ollama, 0đ) → người duyệt → đóng **gói não** có phiên bản → đăng qua `/quan-tri` → app nhận theo nhịp `pretrip-auto`. Câu mở của trợ lý **không còn đi Claude** — máy chỉ tìm+trích kho đã duyệt. Quyết định gốc: [ADR 0010](../../../adr/0010-tro-ly-nghe-offline-wasm.md).

## Đọc theo việc

| # | File | Việc |
|---|---|---|
| 00 | [00-tong-quan.md](00-tong-quan.md) | Trạm là gì / KHÔNG là gì, ranh giới bảo mật, sơ đồ vai trò (Trạm ↔ Supabase ↔ /quan-tri ↔ App), phân bổ GPU/CPU, "trạm chết → app vẫn chạy gói cũ" |
| 01 | [01-cai-local-llm.md](01-cai-local-llm.md) | Runbook cài **Ollama + qwen3.5:9b** trên Windows: kiểm GPU, chọn model/quant (qwen3.5:9b Q4 trên 12 GB, dự phòng 4B), smoke test tiếng Việt, chạy 24/7 chỉ-nghe-localhost |
| 02 | [02-quan-tri-va-update.md](02-quan-tri-va-update.md) | Phát hành gói qua `/quan-tri` (rollout %, lùi gói, audit ADR 0007), 2 khoá `app_config` (0022), nhịp máy khách nhận (`pretrip-auto` 6h), hàng đợi "Câu hỏi bà con". Khuôn gói: [contract](../../../contracts/tro-ly-brain-pack.contract.md) |
| 03 | [03-vong-dem-soan-goi.md](03-vong-dem-soan-goi.md) | **Vòng đêm**: kéo câu chưa trả lời → gom cụm → qwen3.5:9b soạn **nháp** (prompt ép không-bịa) → **người duyệt bắt buộc** → đóng gói + sinh giọng. Lịch Task Scheduler, xử lý treo |
| 04 | [04-toi-uu.md](04-toi-uu.md) | Tối ưu: LLM (num_ctx/quant/batch/keep_alive), hotwords (`score` 1,5, luật trùng âm), dung lượng gói (~50–70 MB), ưu tiên nội dung theo `unansweredHashes` |
| 05 | [05-sen-bien-giong.md](05-sen-bien-giong.md) | Giọng **VieNeu** (đã THAY OmniVoice): `bac`=Trúc Ly, `nam`=Mỹ Duyên; dùng `scripts/tro-ly-giong/gen_pack.py`; checklist SDVICO soát (số khẩn "115"→"một một năm") |
| 06 | [06-fine-tune-qwen-lora.md](06-fine-tune-qwen-lora.md) | **Runbook** fine-tune LLM qwen3.5:9b QLoRA/Unsloth trên 3060 — điều kiện mở khoá, dataset, merge→GGUF→Ollama. **CHƯA train** |
| 07 | [07-fine-tune-stt-icefall.md](07-fine-tune-stt-icefall.md) | **Runbook** fine-tune STT zipformer-vi (icefall/k2, cần WSL2/Docker) → export ONNX int8 vào gói. **CHƯA train**; leo thang hotwords trước |
| 08 | [08-qa-full-luong.md](08-qa-full-luong.md) | **QA full luồng** gói não: 3 nhóm ca (A tự động `test-full-flow.mjs` · B cần PC trạm Ollama/VieNeu · C cần app-side P1 → [qa-offline-acceptance](../qa-offline-acceptance.md)). Kéo câu → LLM nháp → duyệt → đóng gói → cổng kiểm → nhận gói/kiểm hash + ca âm |
| 09 | [09-giam-sat.md](09-giam-sat.md) | **Giám sát** trạm (`health-check.mjs`): triết lý "trạm chết KHÔNG khẩn" (00 §6), phân mức 🟢/🟡/🔴 theo *độ cũ gói* + *vòng đêm chạy chưa*; đo Ollama/marker `last-run.json`/GPU/đĩa; lịch Task Scheduler 15–30′, chỗ cắm notify, log ngoài repo |
| 10 | [10-kien-truc-sen-bien-ai.md](10-kien-truc-sen-bien-ai.md) | **RÀ SOÁT + THIẾT KẾ Sen Biển AI (Qwen)**: audit 3 tầng hiện tại · routing online↔offline thông minh (thác bậc T0→T1→T2) · Qwen server (hosting/vLLM, num_ctx 🔴, token, fine-tune) · đạt-mức-Claude bằng dữ liệu chuyên biệt (tool `tra_kho` 🔴) · test/giám sát/tối ưu · roadmap + quyết định cần chốt |

## Công cụ (ngoài `src/`, chạy ở bờ)

- `scripts/tram-o-bo/export-brain-pack.mjs` — đóng gói cục bộ → `manifest.json` (sha256 + kiểm ngân sách). `--help`.
- `scripts/tram-o-bo/validate-brain-pack.mjs` — cổng kiểm gói theo contract. `--self-test` (đã chạy xanh).
- `scripts/tram-o-bo/test-full-flow.mjs` — test full luồng gói não (mock LLM/giọng): kéo câu → soạn nháp → duyệt → đóng gói → cổng kiểm → nhận gói/kiểm hash + ca âm. `--help`, `--llm=mock`, `--keep`. Fixture ở `__fixtures__/`. QA: [08](08-qa-full-luong.md).
- `scripts/tram-o-bo/health-check.mjs` — giám sát trạm: Ollama sống? vòng đêm chạy (marker `last-run.json`)? gói cũ chưa? GPU/đĩa? → bảng + mã thoát (0 xanh · 1 vàng · 2 đỏ). `--help`, `--json`, `--self-test` (xanh), `--run-marker`, `--pack-manifest`, `--notify`. Thiết kế: [09](09-giam-sat.md).
- `scripts/tram-o-bo/nightly-run.mjs` — **vòng đêm THẬT** (gọi Ollama `qwen3.5:9b` soạn nháp) → ghi drafts + `last-run.json`. CHƯA nối Supabase/CHƯA đăng gói (đầu vào fixture, đầu ra chờ người duyệt). Đã chạy thật trên trạm 2026-09-12 (3 nháp, 100% GPU). Setup 24/7: [01 §5](01-cai-local-llm.md), luồng: [03](03-vong-dem-soan-goi.md).
- `scripts/tram-o-bo/fine-tune/qwen-lora/` — `prepare_dataset.mjs` (`--self-test` xanh) + `train_config.yaml` + README. **CHƯA chạy train.**
- `scripts/tram-o-bo/fine-tune/stt-icefall/` — `prepare_manifest.py` + README. **CHƯA chạy train.**
- `scripts/tro-ly-giong/` (đã committed trước) — công cụ giọng VieNeu.

## Quan hệ tài liệu

- **Vì sao**: [ADR 0010](../../../adr/0010-tro-ly-nghe-offline-wasm.md) (Sen Biển độc lập, gói não) · [ADR 0009](../../../adr/0009-tro-ly-giong-noi.md) (trợ lý 2 tầng gốc).
- **Khuôn gói**: [contracts/tro-ly-brain-pack.contract.md](../../../contracts/tro-ly-brain-pack.contract.md).
- **App-side** (không thuộc trạm): [14-kien-truc-tro-ly](../../14-kien-truc-tro-ly.md) · [13-ba-spec-tro-ly](../../13-ba-spec-tro-ly-giong-noi.md).
- **Dịch vụ ngoài**: [ops/external-services.md](../external-services.md) (Supabase Storage gói trợ lý; Anthropic tắt-chờ-gỡ).

---

**Last updated**: 2026-09-12
