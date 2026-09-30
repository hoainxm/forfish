# ADR 0010 — "Sen Biển" ĐỘC LẬP: trợ lý chạy trọn trong máy, 0 đồng/lượt, cập nhật bằng GÓI NÃO có phiên bản qua hạ tầng SDFish

**Status**: Proposed (v0.2 — **P0 bước 1 đo xong trên PC 2026-09-07** gồm cả hotwords; còn bước 2 đo 3 điện thoại thật mới xin Accepted. Chưa đụng `src/`.)
**Date**: 2026-09-07
**Deciders**: Long (chủ dự án — chốt 2026-09-07: *"không dùng cái tốn tiền; build một agent trợ lý độc lập; các agent ở các máy được update qua hệ thống của SDFish"*) · Lead trợ lý · Kiến trúc sư (ADR này)
**Quan hệ với ADR 0009**: **thay thế tầng MẠNG** (Claude qua `/api/tro-ly`) — tầng đó tắt mặc định, giữ code cho tới khi gói não phủ đủ câu mở rồi gỡ; **giữ nguyên** tầng máy (31 ý định), `AssistantReply`, `DeviceSnapshot`, UI tấm che, luật an toàn.

---

## Context / Bối cảnh

Trợ lý "Sen Biển" đã có (commit `30bce50`, 2026-09-07). Kiểm 2026-09-07 cho thấy nó gồm bốn mảnh, **một mảnh tốn tiền theo từng câu của từng người**:

| Mảnh | Đang dùng | Tiền | Cần sóng? |
|---|---|---|---|
| Nghe | Web Speech (`SpeechRecognition` của Chrome Android / Safari iOS) | 0 | **Có** — audio đi lên Google/Apple; WKWebView (bản iOS store) **không có** API này |
| Hiểu việc trong máy | 31 ý định, regex thuần TS (`lib/assistant/parse.ts`) | 0 | Không |
| Hiểu câu mở / không hiểu | `claude-opus-5` qua `/api/tro-ly` (effort low, ≤3 vòng tool, 30 câu/ngày/SĐT) | **5 USD/1M token vào, 25 USD/1M ra** → ước **0,01–0,03 USD/câu**; 1 000 ngư dân × 5 câu/ngày ≈ **50–150 USD/ngày** | Có |
| Đọc | `speechSynthesis` của máy | 0 | Không, nhưng Android hay thiếu giọng Việt |

Chủ dự án không muốn chi phí theo lượt, và muốn trợ lý là **một agent độc lập** sống trong máy ngư dân, được **cập nhật tập trung** qua hạ tầng SDFish (Vercel + Supabase + web `/quan-tri` đã có).

Ràng buộc KHÔNG được phá (CLAUDE.md 🟡 offline, ADR 0004/0009):

1. Không thêm request lúc mở app / chuyển màn / mở tấm che.
2. `public/sw.js`: nhánh asset tĩnh same-origin (~dòng 1632) là cache-first có đồng hồ `ASSET_NETWORK_MS` và cất vào **kho VỎ** có trần FIFO → file lớn đi qua đó sẽ 504 trên sóng yếu, bị bump vỏ xoá, bị FIFO đẩy. **Gói não không được đi qua SW.**
3. Dữ liệu bà con không mất/đè; kho riêng, đổi gói nguyên khối.
4. Không hứa số liệu mà nguồn không đảm bảo; không bịa (13 §6).

Khảo sát công cụ on-device 2026-09-07 (§References): hệ sinh thái **k2-fsa / sherpa-onnx** có VAD + nhận dạng + đọc tiếng Việt chạy offline, có bản **WebAssembly** chạy trong webview/PWA, Apache-2.0, model tiếng Việt 30M int8 (~25 MB), TTS piper tiếng Việt (~21 MB). LLM nhỏ trên máy (Gemma 4 E2B qua LiteRT-LM, Apple Foundation Models) chỉ chạy **native**, không chạy trong webview → không phải đường chính hôm nay.

## Decision / Quyết định

Dựng **"Sen Biển" độc lập = MÁY CHẠY (trong app) + GÓI NÃO (dữ liệu có phiên bản, tải riêng)**, mọi mảnh **0 đồng/lượt**:

```
                 ┌──────────────── MÁY CHẠY (code app, đổi theo deploy) ────────────────┐
  mic ──► VAD+STT tiếng Việt (sherpa-onnx WASM, Worker) ──► parseUtterance (31 ý định + bảng từ GÓI)
                                                                   │ khớp ──► answerOffline(DeviceSnapshot)  ──► chữ TO + đọc
                                                                   │ câu mở ──► tìm trong KHO KIẾN THỨC của GÓI (BM25 trong máy) ──► trích đúng đoạn, ghi nguồn + ngày
                                                                   └ không có ──► nói thật "chưa có trong máy" + chip mở màn
  đọc ◄── speechSynthesis giọng vi của máy ◄── không có ──► TTS piper vi (sherpa-onnx WASM)
                 └──────────────────────────────────────────────────────────────────────┘
                 ┌──────────────── GÓI NÃO (Supabase Storage, manifest có phiên bản) ──────┐
                 │ models/: vad.onnx · stt-vi.{wasm,data} · tts-vi.{wasm,data}             │
                 │ brain/:  intents.v<N>.json (mẫu câu, từ đồng nghĩa, cụm tên màn)        │
                 │          answers.v<N>.json (câu trả lời theo ca, câu an toàn)           │
                 │          knowledge.v<N>.json (FAQ ngư dân: bảo quản cá, nhớt/máy, lưới, │
                 │          thủ tục giấy tờ, cảng, mùa vụ… — mỗi mục: câu hỏi mẫu,         │
                 │          từ khoá, đoạn trả lời ≤4 câu, nguồn, ngày soát)                 │
                 │ manifest.json: version · sha256 từng file · minAppVersion · ghi chú     │
                 └──────────────────────────────────────────────────────────────────────┘
```

Kênh cập nhật **dùng thứ đã có, không dựng dịch vụ mới**: đội SDVICO tải gói lên qua web `/quan-tri` (tab mới "Gói trợ lý": upload + đặt phiên bản + phần trăm máy nhận, ghi audit như ADR 0007); app kiểm `manifest.json` **theo nhịp 6 giờ của `pretrip-auto`** khi có sóng (không kiểm lúc mở app), tải nền vào kho riêng `sdfish-tro-ly-v1`, kiểm hash đủ mới đổi gói, gói cũ dùng tiếp tới lúc đó. Bản đầu tải khi bà con chạm chip mời ("Tải phần nghe không cần sóng") hoặc tự tải sau `pretrip-auto` khi có Wi-Fi.

**Không có trong máy thì "liên hệ" hoặc "xử lý khi có sóng"** (chủ dự án chốt 2026-09-07c): câu không khớp ý định và không có trong kho → trợ lý nói thật + hai chip: **"Gọi SDVICO"** (`SDVICO_HOTLINE`, chạm mới gọi) và **"Gửi câu này khi có sóng"** → câu vào **hộp chờ sóng** (`forfish.assistant.outbox.v1`, khoá mới trong `NEVER_BACKUP_PREFIXES`, ≤20 câu, không kèm CCCD/SĐT/toạ độ); khi có sóng (đúng nhịp `pretrip-auto`, không lúc mở app) `POST /api/tro-ly/hop-thu` với `identityFromRequest` → hàng đợi ở `/quan-tri` tab "Câu hỏi bà con" cho đội SDVICO trả lời tay (hoặc trạm học ở bờ soạn nháp, người duyệt) → trả lời về **hộp thư trong app** (`InboxSection`) + web-push đã có. Đây cũng là nguồn nội dung cho kho kiến thức đợt sau.

**Trạm học ở bờ (PC RTX 3060 12 GB, 32 GB RAM — kiểm 2026-09-07)**: chạy 24/7 nhưng **không phục vụ ngư dân trực tiếp** (IP nhà, không SLA, bề mặt tấn công). Việc của nó: (1) mỗi đêm kéo `unansweredHashes` + hộp chờ sóng từ Supabase, gom cụm, dùng LLM mở local (Qwen3 8–14B Q4 qua llama.cpp/Ollama, 0 đồng) **soạn nháp** mẫu câu ý định + mục FAQ → đẩy vào `/quan-tri` cho người duyệt → đóng gói não mới; (2) chạy OmniVoice (GPU ~4 GB) sinh giọng "Sen Biển" cho câu cố định; (3) sau này fine-tune STT trên audio **có đồng thuận** (icefall/Unsloth). "Học liên tục" = vòng đêm này, không phải model tự sửa mình trong máy bà con.

**Câu mở không còn đi Claude.** Kho kiến thức được **biên soạn ở bờ** bởi đội SDVICO (có thể dùng Claude/Kimi lúc soạn — chi phí một lần, không theo người dùng, và mọi đoạn phải có người duyệt + nguồn). Trong máy chỉ **tìm và trích**, không sinh chữ → không bịa. Câu hỏi không có trong kho → nói thật + chip gợi ý + **ghi câu vào `forfish.assistant.v1` (đếm theo mã băm câu chuẩn hoá, không lưu nguyên văn)** để đợt soát gói sau biết bà con hỏi gì nhiều.

## Alternatives considered / Phương án đã cân nhắc

### Option A: Giữ Claude, hạ chi phí (Sonnet/Haiku, cache, quota thấp hơn)
- ✅ Hiểu câu tự do tốt nhất, ít việc biên soạn.
- ❌ Vẫn **tốn theo lượt** và **cần sóng** — hai thứ chủ dự án loại. Không chọn.

### Option B: LLM mở tự host (Kimi K3 / MiniMax M3 / Qwen trên máy chủ riêng)
- ✅ Không trả tiền vendor theo token.
- ❌ Vẫn cần sóng; tốn tiền máy GPU/điện/vận hành (chỉ đổi dạng chi phí); thêm dịch vụ ngoài phải trực. Không chọn cho v1; có thể là **công cụ biên soạn gói** ở bờ.

### Option C: LLM nhỏ trên máy (Gemma 4 E2B/E4B qua LiteRT-LM, Apple Foundation Models, Cactus)
- ✅ 0 đồng/lượt, offline, tool calling đã có, Apple FM có tiếng Việt.
- ❌ **Chỉ native** (không chạy trong webview/PWA — đường cài chính hôm nay), 1–4 GB, nóng máy, và vẫn có thể bịa số về bão. **Nợ có điều kiện**: mở lại khi (a) bản native là đường chính, (b) ≥30% câu offline rơi vào `khong_hieu` theo đo ở `forfish.assistant.v1`, (c) kho kiến thức FAQ đã ≥500 mục mà vẫn thiếu.
- **Kiểm nguồn 2026-09-07 (đề xuất "thầy–trò" FunctionGemma 270M + Qwen3.5-9B)**: cả hai model **có thật**. FunctionGemma = Gemma 3 270M chuyên gọi hàm, INT8 **288 MB**, đỉnh RAM **549–551 MB**, token đầu **0,3 s** trên S25 Ultra, Apache-2.0, model card ghi rõ *"not intended for use as a direct dialogue model"*, fine-tune Mobile Actions 58% → 85%. Qwen3.5-9B Apache-2.0, 201 ngôn ngữ/phương ngữ, có tool calling — hợp làm model "thầy" trên RTX 3060. **Nhưng model card FunctionGemma ghi: *"our evaluations … included only English language prompts"*** → con số 85% là **tiếng Anh**, tiếng Việt chưa ai đo; đây là ẩn số phải tự đo trước khi hứa. Đường PWA vẫn khoá: LiteRT-LM JS còn **"early preview"**, chỉ nhận `gemma-4-E2B/E4B-it-web.litertlm` qua **WebGPU**, chưa có FunctionGemma; và LoRA sidecar lúc chạy còn lỗi mở (google-ai-edge/LiteRT-LM#3173, mở từ 2026-08-07) → chưa hứa cập nhật bằng file LoRA nhỏ.

### Option D: Plugin Capacitor SpeechRecognition (bộ nhận dạng của hệ điều hành)
- ❌ Chỉ native; Android offline cần bà con tự tải gói tiếng Việt trong Cài đặt Google; iOS tiếng Việt on-device chưa xác minh. Nợ dự phòng nếu WASM đo ra quá chậm trên Android rẻ.

### Option E: Máy chạy + gói não, mọi mảnh chạy trong máy, cập nhật qua hạ tầng SDFish ← chosen / đã chọn
- ✅ 0 đồng/lượt; chạy cả PWA lẫn native (kể cả WKWebView nơi Web Speech không có); mất sóng vẫn nghe–hiểu–đọc; không bịa (chỉ trích kho đã duyệt); đội SDVICO đổi não mà không phát hành app; cùng khuôn đã có (`route-plan.worker.ts`, kho ô bản đồ có trần, `/data/*.v1.json` versioned, `pretrip-auto` 6 giờ, `/quan-tri` + audit).
- ❌ (1) tải ~50–70 MB một lần (chủ dự án: chấp nhận); (2) câu mở trả lời **hẹp hơn Claude** — đúng bằng kho đã soạn; (3) chất lượng nghe giọng vùng miền **chưa đo**; (4) phải build WASM bằng Emscripten; (5) thêm việc **vận hành nội dung** (soát kho theo quý) — đây là chi phí người, không phải tiền theo lượt.

### Về OmniVoice / LiveKit Agents
- OmniVoice cần GPU ~4 GB, chưa ONNX/mobile → không cho máy; có thể dùng **ở bờ** để sinh giọng "Sen Biển" đọc sẵn các câu cố định trong `answers.json` (file mp3 nhỏ trong gói) nếu piper nghe không tự nhiên. LiveKit là máy chủ WebRTC — không dùng (ADR 0009 Option A).

## Cách thực hiện / Kế hoạch build

### P0 — ĐO TRƯỚC KHI HỨA (không đụng app)

1. Build WASM sherpa-onnx recipe **VAD + non-streaming ASR** (như Space `web-assembly-vad-asr-sherpa-onnx-ja-zipformer`) với `zipformer-vi-30M-int8`; build TTS `vits-piper-vi_VN-vais1000` int8. Ghi dung lượng thật.
2. Trang đo ở `scratch/tro-ly-wasm-bench/` (không vào bundle app).
3. Tập câu: **50 câu ghi âm thật** ≥3 người 3 vùng, nội dung từ 230 câu test vector + 108 câu "chú Ba" đã có trong test.
4. Đo trên 3 máy đích (iPhone 12 Safari A2HS · Android 6 GB tầm trung · Android ≤4 GB):

| Chỉ số | Ngưỡng chấp nhận |
|---|---|
| Intent accuracy (câu nghe ra → `parseUtterance` đúng mã) | ≥ 85%, không tệ hơn Web Speech quá 5 điểm trên cùng tập |
| Trễ hết nói → có chữ | ≤ 2 s p90 (Android tầm trung), ≤ 4 s (Android rẻ) |
| RTF | ≤ 0,5 |
| TTS piper: trễ tới âm đầu | ≤ 1,5 s (khớp 13 §4.1) |
| Nhiệt/pin sau 20 lượt | không cảnh báo nóng; pin ≤ 2% |
| Mic trong PWA cài iOS 16+ và trong WKWebView/Android WebView | `getUserMedia` mở được sau khi khai quyền |

Thua → thử `zipformer-vi-int8-2025-04-20` (57 MB) một lần; vẫn thua → Option D cho riêng native, ghi số vào ADR.

### P0 — KẾT QUẢ BƯỚC 1 (PC, 2026-09-07) — chi tiết: `scratch/tro-ly-wasm-bench/KET-QUA-P0-2026-09-07.md`

- **Không cần build Emscripten**: gói `sherpa_onnx_web` 1.13.7 (pub.dev, Apache-2.0) có `sherpa-onnx-wasm-web.wasm` 14,9 MB xuất đủ C API (offline recognizer + VAD + offline TTS) + wrapper JS; model nạp lúc chạy qua `FS.writeFile` từ bytes → khớp thiết kế "nạp từ Cache API, không qua SW". A2/A3 **đã kiểm**: wasm 14,9 MB (không phải ~10 MB).
- PC Chromium 148, 1 thread: nạp toàn bộ 3,0–3,4 s · STT **RTF 0,07** · VAD RTF 0,01 · TTS piper medium **RTF 0,35** · x_low nhanh gấp đôi nhưng phát âm kém (đọc→nghe đúng 1/25) → **loại x_low**.
- Đọc→nghe 25 câu nghề cá bằng giọng piper medium: giống **90,5%**, đúng nguyên câu 12/25; sai tập trung ở từ ngành "nhớt", "shop", "Yanmar" và tên cảng → đòn bẩy `hotwords` của sherpa-onnx (chở trong gói não).
- **Hotwords đã đo (2026-09-07, cùng một bộ 25 clip cho mọi nhánh)**: `modified_beam_search` + hotwords kéo từ ngành từ **8/15 lên 11–12/15**, câu đúng nguyên vẹn 11 → 14/25, trả giá ~14% thời gian giải mã. Release **không kèm `bpe.vocab`** (chỉ `bpe.model`) → phải sinh bằng `sentencepiece`, đã đưa vào `fetch-assets.sh`. ⚠️ **Điểm boost ≥3 đè nghĩa**: hotword "BIỂN ĐÔNG" biến "biển động cấp mấy" thành "BIỂN ĐÔNG CẤP MẤY" — hỏi sóng thành hỏi tên vùng biển. **Chốt: `hotwordsScore` 1,5 và không nhận hotword trùng âm với từ thường dùng**; mỗi từ thêm vào gói não phải chạy lại bộ 25 câu. Hotwords **không cứu** `Yanmar`→"EM", `shop`→"CHO" (từ gốc nước ngoài), và không đụng tới nhóm lỗi không phải từ vựng ("mấy giờ"→"BÂY GIỜ" đảo nghĩa, số hiệu tàu thừa một tiếng).
- **Cắt bộ chữ espeak còn tiếng Việt (2026-09-07, chủ dự án: "các ngôn ngữ khác thì xóa đi cho nhẹ máy")**: bộ `espeak-ng-data` đi kèm piper mang 113 ngôn ngữ (355 file, **18,0 MB**) mà giọng `vi_VN-vais1000` chỉ tra `vi_dict` + bảng âm vị lõi → xoá còn **9 file, 0,72 MB** (−17,3 MB, −96%); phần đọc của gói não còn **63,9 MB**. Kiểm bằng đọc→nghe 25 câu **ba lần mỗi bên** — không so được bằng sóng âm vì VITS có nhiễu ngẫu nhiên (cùng một câu đọc hai lần đã ra sóng khác nhau): bản gọn **90,8%** so với đầy đủ **90,1%**, tức không kém, và nạp nhanh hơn (2,4–2,6 s thay vì 3,0–5,5 s). Bộ lọc nằm trong `fetch-assets.sh` (đặt `ESPEAK_KEEP_ALL=1` để giữ hết mà đối chứng). **Còn nợ**: `phondata` 537 KB vẫn là bảng âm vị dùng chung mọi ngôn ngữ, cắt nữa phải biên dịch lại espeak-ng từ nguồn.
- **Rủi ro mới**: `INITIAL_MEMORY` 512 MB nằm **cứng trong .wasm** (max 2 GB), không chỉnh từ JS. Phone yếu lỗi ở bước nạp thì phải tự build wasm với bộ nhớ khởi đầu nhỏ — lúc đó mới cần Emscripten.
- Bước 2 (phone, 3 máy) **chưa đo**: trang đo chạy HTTPS LAN `https://192.168.1.174:8443` (chứng chỉ tự ký), cần người mở firewall cổng 8443 + bấm trên máy thật. Bộ đo nay **nằm trọn trong `scratch/tro-ly-wasm-bench/`** (assets 126 MB + `*.pem`, đều gitignore) — không còn treo vào thư mục tạm của phiên làm việc; đã chạy lại toàn bộ từ thư mục repo để kiểm.

### P1 — Core: gói não + kho riêng + Worker + nối vào `speech.ts`

**Nơi chứa gói — chọn để KHÔNG đụng `sw.js`**: bucket public **Supabase Storage** (đã là dependency; CORS `GET` cho origin app). SW bỏ qua request khác origin (dòng 1531) → không sửa SW. Ghi dòng mới vào `ops/external-services.md`, cột "khi nó chết": không tải được thì hành vi y như hôm nay, không hỏng gì. Dự phòng nếu không dùng bucket: `public/tro-ly/*` + **đúng 1 dòng** bypass cạnh nhánh `/api/admin/` (🟡 → chạy `ops/qa-offline-acceptance.md`).

| File mới (`src/lib/assistant/`) | Loại | Việc |
|---|---|---|
| `brain-pack.ts` | `"use client"` | Kho `caches.open("sdfish-tro-ly-v1")` do client quản (không phải kho vỏ/tiles/api của SW). `packState()`, `checkManifest()` (chỉ gọi từ `pretrip-auto`, có `timeoutSignal`), `downloadPack(onProgress, signal)` tải từng file, **kiểm sha256 đủ toàn bộ rồi mới đổi** (không gói nửa vời), `estimate()` + `requestPersistentStorage()` trước tải, `deletePack()`. Manifest có `minAppVersion` — app cũ hơn thì không tải gói mới |
| `brain.ts` | thuần | Đọc `intents/answers/knowledge` từ gói thành cấu trúc `parse.ts`/`answer.ts` dùng; **fallback = bảng đang compile trong code** khi chưa có gói (hành vi hôm nay không đổi). Kho kiến thức: chỉ mục từ khoá đã `foldVn` + BM25 nhỏ (không embedding, không thư viện mới — bậc 3/7 nguyên tắc 15) |
| `stt-offline.worker.ts` | Worker | Nạp `.wasm/.data` **từ Cache API dạng bytes** qua hook Emscripten `locateFile`/`instantiateWasm`/`getPreloadedPackage` (không fetch URL lúc chạy → offline thật, không qua SW); nhận PCM 16 kHz; VAD cắt câu → STT → `postMessage` |
| `tts-offline.worker.ts` | Worker | piper vi → PCM 24 kHz → main thread phát bằng `AudioContext`; chỉ dùng khi `vietnameseVoice() === null` |
| `stt-offline.ts` / `tts-offline.ts` | `"use client"` | Khuôn như `route-plan-async.ts`; **cùng chữ ký** `listenOnce`/`speak` của `speech.ts` |
| `speech.ts` (sửa) | | Bộ chọn nguồn: gói WASM (nếu có) → Web Speech (nếu có sóng và không có gói) → chip + gõ. Xoá nợ dòng 17 |
| `use-assistant.ts` (sửa) | | Nhánh `hoi_mo`/`khong_hieu`: thay gọi `/api/tro-ly` bằng `brain.searchKnowledge(text)`; **`/api/tro-ly` chỉ gọi khi `app_config.assistant_online_enabled === true`** (mặc định `false`) — tắt tiền ngay khi land, gỡ code sau khi kho phủ đủ |
| `history.ts` (sửa) | | `forfish.assistant.v1` thêm `micNetworkErrors`, `unansweredHashes: Record<hash, count>` (mã băm câu chuẩn hoá — không lưu nguyên văn, khoá đã trong `NEVER_BACKUP_PREFIXES`) |

Quyền mic native (cần cho mọi đường nghe trên bản store): `Info.plist` + `NSMicrophoneUsageDescription` tiếng Việt; `AndroidManifest.xml` + `RECORD_AUDIO` — kiểm trên máy thật (A1).

**Định dạng gói (contract, versioned như `docs/contracts/`)** — `docs/contracts/tro-ly-brain-pack.contract.md`: `manifest.json { version, createdAt, minAppVersion, files: [{path, sha256, bytes}], notes }`; `knowledge.json` mỗi mục `{ id, cauHoiMau: string[], tuKhoa: string[], traLoi (≤4 câu, không số liệu biến động), nguon, ngaySoat, chipMoMan? }`. Luật nội dung: không y tế/pháp lý/tiền cá nhân (INT-26 vẫn chặn trước), câu an toàn "nghe đài duyên hải" vẫn do `answer.ts` gắn, **không** đưa số giá/thời tiết vào kho (số sống chỉ từ snapshot).

### P2 — Web `/quan-tri`: tab "Gói trợ lý" (theo 10-ba-spec quản trị)

Upload gói (zip) → server tính sha256, sinh `manifest.json`, đẩy lên bucket, ghi `app_config.assistant_pack_version` + audit (ai, lúc nào, ghi chú). Có **phần trăm máy nhận** (rollout 10% → 100% theo băm SĐT) và nút **lùi về gói trước**. Không cần migration mới ngoài 2 khoá `app_config` (0015 đã có bảng).

### P3 — UI (13 §5.4 bổ sung, chữ không jargon)

- Mời tải đúng lúc: câu lỗi mic mất sóng + chip **"Tải phần nghe không cần sóng (60 MB, tải ở bờ)"**; sau `pretrip-auto` khi có Wi-Fi tự tải nền, thẻ nhỏ "Đã tải phần nghe không cần sóng".
- Tiến độ "Đang tải 12/60 MB — để máy có sóng"; đứt giữa chừng → xoá gói nửa vời, "Chưa tải xong, có sóng bác tải lại."
- Trạng thái mới: chưa tải · đang tải · lỗi · máy thiếu chỗ · gói mới đang tải nền (gói cũ vẫn dùng) · máy không SIMD (không mời, hành vi cũ).
- Câu mở có trong kho: chữ TO + dòng phụ "Theo tài liệu SDVICO soát {tháng/năm}" + chip mở màn nếu có. Không có: "Việc này tôi chưa có trong máy. Bác hỏi tôi thời tiết, bão, giấy tờ, giá cá, hay mở màn." (không còn câu "có sóng mới hỏi được" — vì không còn tầng mạng).

### P4 — QA offline (bắt buộc)

- e2e mock Worker → đủ luồng UI; `context.setOffline(true)` nói–hiểu–đọc không request nào (Network trống).
- Ca tay 3 máy P0: tải gói ở Wi-Fi → tắt mạng → mở từ icon → bấm Nói → 6 câu chip + 3 câu mở trong kho → đúng. Sau đó **deploy bản mới (bump vỏ)** → gói còn. Sau đó **đẩy gói v+1 ở `/quan-tri`** → máy có sóng nhận sau ≤6 giờ, gói cũ dùng tới lúc đổi, hash sai → không đổi.
- Cổng repo xanh: `server-client-boundary`, `offline-backup` (không khoá `forfish.*` mới), `no-bare-abort-timeout`, `safari-cu` (không lookbehind), `npm test`, `typecheck`, `lint`, `build`; e2e trợ lý hiện có vẫn xanh khi chưa có gói.

### Tiêu chí xong

1. Số P0 ghi vào ADR, Status → Accepted.
2. Tắt mạng hoàn toàn: nói "giấy nào sắp hết hạn" → trả lời ≤3 s; nói "cách bảo quản cá ngừ" → trích đúng mục kho, ghi nguồn.
3. **Hoá đơn Anthropic = 0** sau land (`assistant_online_enabled=false`); `external-services.md` đánh dấu Anthropic "tắt, chờ gỡ".
4. Chưa tải gói → hành vi y nguyên hôm nay.
5. Bump `SDFISH_CACHE_V` không xoá gói; đẩy gói mới không cần deploy app.
6. Commit trả lời 4 câu offline (CLAUDE.md 🟡): (a) không request lúc mở app — kiểm manifest chỉ theo nhịp `pretrip-auto`, tải chỉ khi chạm chip hoặc sau pretrip có Wi-Fi; (b) không đụng `sw.js`/SHELL/khoá mới; (c) kho riêng, đổi nguyên khối, xoá gói không đụng gì khác; (d) chính nó là nhánh mất sóng.

### Ownership

Core (`lib/assistant/**`, workers, `scripts/build-tro-ly-wasm.sh`, contract gói, docs 14 + external-services + ADR) → Admin (`/quan-tri` tab gói, `app_config` 2 khoá, audit) ∥ UI (`components/assistant/**`, 13 §5.4 + 07) ∥ QA. Nội dung kho kiến thức: đội SDVICO soạn + duyệt, Core chỉ định dạng và validator (`scripts/validate-brain-pack.mjs`, có `--self-test`).

## Consequences / Hệ quả

- **Tích cực**: 0 đồng/lượt; mất sóng vẫn nói–hiểu–đọc; bản iOS store có đường nghe; không bịa (chỉ trích kho đã duyệt); đội vận hành đổi não không cần phát hành; câu bà con hỏi mà máy chưa có được đếm để soát gói — vòng học nguyên tắc 12 chạy bằng dữ liệu thật, không cần model.
- **Đánh đổi**: câu mở hẹp bằng kho; thêm công việc vận hành nội dung theo quý; +50–70 MB trong máy; script build Emscripten phải bảo trì; Worker + AudioWorklet là bề mặt lỗi theo đời máy.
- **Trung tính**: `/api/tro-ly` + `server/claude.ts` giữ nguyên nhưng tắt bằng cờ; gỡ ở đợt sau khi `unansweredHashes` cho thấy kho đã phủ (ghi nợ: `// nợ: gỡ tầng mạng khi 3 tháng liên tiếp tỉ lệ câu mở không có trong kho < 10%`).

## Assumptions

- A1 (**kiểm máy thật ở P0**): bản native hiện không nghe được vì thiếu khai quyền mic và WKWebView không có `webkitSpeechRecognition` (grep 2026-09-07 không thấy `NSMicrophoneUsageDescription`/`RECORD_AUDIO`).
- A2: recipe VAD+ASR WASM build được với zipformer tiếng Việt (Space `ja-zipformer` là tiền lệ cùng kiến trúc); chưa có Space tiếng Việt dựng sẵn.
- A3: dung lượng `.wasm` ~10 MB lấy từ ví dụ docs (model khác) — đo lại. Nén khi truyền không đáng kể (trọng số int8 gần ngẫu nhiên).
- A4: WASM SIMD có trên Safari ≥ 16.4 và Chrome Android hiện hành; máy không SIMD giữ hành vi cũ.
- A5: bucket Supabase Storage public là nơi chứa gói; SW bỏ qua origin khác (dòng 1531). Chủ dự án không muốn bucket → nhánh dự phòng same-origin + 1 dòng bypass (🟡).
- A6: Apache-2.0 (sherpa-onnx, model zipformer-vi, piper vi) cho phép đóng gói thương mại; ghi nguồn ở NOTICE app khi land.
- A7: ước tiền Claude tính theo bảng giá `claude-opus-5` hiện hành (5/25 USD per 1M) và cấu hình trong `server/claude.ts` (effort low, `max_tokens` 700–1500, ≤3 vòng); chưa có số hoá đơn thật vì prod chưa cấu hình khoá.

## References

- Nợ đang trả: `src/lib/assistant/speech.ts:17`; ADR 0009 Option C/§"Về STT native Capacitor".
- App-map: `13-ba-spec-tro-ly-giong-noi.md` §5.4/§6/§7 · `14-kien-truc-tro-ly.md` §5.2/§6 · `10-ba-spec-quan-tri-van-hanh.md` (audit admin) · `ops/qa-offline-acceptance.md` · `ops/native-deploy.md` §3a (tiền lệ khai quyền native) · `ops/external-services.md` (dòng Anthropic) · `docs/contracts/` (khuôn contract versioned).
- Tiền lệ code: `lib/route-plan-async.ts` (Worker) · `lib/pretrip-auto.ts` (nhịp 6 giờ) · `lib/storage-persist.ts` · `lib/abort.ts` · `public/sw.js` kho `SDFISH_TILE_V` (kho riêng có trần) · `/data/*.v1.json` (dữ liệu versioned).
- sherpa-onnx: https://github.com/k2-fsa/sherpa-onnx · WASM build https://k2-fsa.github.io/sherpa/onnx/wasm/build.html · model vi https://k2-fsa.github.io/sherpa/onnx/pretrained_models/offline-transducer/zipformer-transducer-models.html · TTS vi https://k2-fsa.github.io/sherpa/onnx/tts/all/Vietnamese/supertonic-3-vi.html · Space cùng kiến trúc https://huggingface.co/spaces/k2-fsa/web-assembly-vad-asr-sherpa-onnx-ja-zipformer
- Đã loại/nợ: OmniVoice https://github.com/k2-fsa/OmniVoice/issues/151 · Gemma 4 on-device https://developers.google.com/edge/litert-lm/models/gemma-4 · Apple Foundation Models (iOS 26+, có tiếng Việt) · Capacitor speech-recognition · Bảng giá Claude (skill claude-api, cached 2026-06-24).

## History

- **2026-09-30**: P1 dựng **phần kho + giọng** theo lệnh chủ dự án "hoàn thiện hết" — `brain.ts` (BM25 có cổng bằng chứng) + `brain-pack.ts` (đổi khối sha256, kho `sdfish-tro-ly-v1`) + T1 trước online + tool `tra_kho` cho Qwen + mp3 VieNeu 84 file. **Lệch ADR có chủ ý**: gói ở `public/tro-ly` theo deploy ("local thôi"), KHÔNG Storage/`/quan-tri` (P2 bỏ); tầng mạng **BẬT** mặc định (`assistant_online_enabled`, doc 10 §4.2) thay vì tắt; SW thêm 2 dòng (giữ kho + bỏ qua `/tro-ly/`). **Chưa làm**: nghe/đọc WASM (P0 bước 2 đo phone vẫn chưa có → Status giữ Proposed), `intents.v1`, `unansweredHashes`. Kho phát hành đang rỗng — 20 mục nháp AI chờ SDVICO duyệt.
- **2026-09-07**: Proposed v0.1 — gói nghe offline WASM, giữ tầng mạng Claude.
- **2026-09-07c**: P0 bước 1 đo trên PC — chuỗi VAD→STT→TTS chạy trong trình duyệt bằng gói `sherpa_onnx_web` dựng sẵn; số ở §P0; x_low loại; rủi ro INITIAL_MEMORY 512 MB; chờ đo phone.
- **2026-09-07d**: Đo hotwords trên PC — có tác dụng thật (từ ngành 8/15 → 11–12/15) nhưng boost cao đè nghĩa ("biển động" → "Biển Đông"); chốt `hotwordsScore` 1,5 + luật không nhận hotword trùng âm. Sinh `bpe.vocab` từ `bpe.model`. Sửa 3 lỗi trên đường "dựng lại" (`sed` mất dấu gạch ngược, `curl` nuốt lỗi mạng + `| tail` che mã thoát, `openssl` thiếu `MSYS_NO_PATHCONV`) — đều lộ ra khi chạy thật. Bộ đo chuyển về nằm trọn trong repo, chạy lại full để kiểm.
- **2026-09-07b**: Proposed v0.2 — chủ dự án chốt *không tốn tiền theo lượt, agent độc lập, cập nhật qua hệ thống SDFish*: tắt tầng mạng bằng cờ, thêm GÓI NÃO (intents/answers/knowledge + models) có manifest, kênh cập nhật qua `pretrip-auto` + `/quan-tri`, câu mở = tìm trong kho đã duyệt. Chờ P0 đo.
