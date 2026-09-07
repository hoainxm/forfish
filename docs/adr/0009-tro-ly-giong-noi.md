# ADR 0009 — Trợ lý giọng nói: HAI TẦNG OFFLINE-TRƯỚC, nghe/nói bằng nền tảng web, Claude qua SDK phía máy chủ, có chế độ giả lập cho dev

**Status**: Proposed (v1.1 — hợp nhất sau phản biện 2026-09-06b)
**Date**: 2026-09-06
**Deciders**: Long (chủ dự án) · Lead (tech lead, TROLY-BRIEF) · Kiến trúc sư (ADR này)

---

## Context / Bối cảnh

Chủ dự án muốn *"1 trợ lý của app, trợ lý AI, dùng 1 model nào có thể trao đổi bằng voice, click vào nói… loại online cho 1 số câu hỏi, offline cho cái nào đơn giản, logic hoá được, ngư dân trao đổi cho đỡ gõ vào hay chọn… đạt 90% về đơn giản"*. Người dùng là ngư dân 40–60 tuổi, tay ướt, nắng chói, **mất sóng nhiều ngày** — nên câu hỏi kiến trúc số một không phải "model nào thông minh nhất" mà là **cái gì còn chạy khi không có mạng, và cái gì nói thật khi không chạy được**.

Ràng buộc đã chốt trước đó, KHÔNG được phá (CLAUDE.md + ADR 0004/0007/0008):

- Định danh = **chuỗi cứng theo máy → SĐT** (`identityFromRequest`). Mọi route mới đi qua cổng đó; 503 khi hạ tầng hỏng, không bao giờ đội lốt 401.
- Offline là an toàn tính mạng: **không thêm request lúc mở app**, mọi fetch có `timeoutSignal`, không đụng `public/sw.js`/SHELL, dữ liệu đã tải không được mất/đè.
- Dữ liệu bà con **đã nằm trong máy** (thời tiết theo cảng, tin bão, giấy tờ + hạn, bảo dưỡng, giỏ/đơn chợ, giá cá/dầu…) — tức phần lớn câu hỏi hằng ngày trả lời được **không cần ai ở đầu dây bên kia**.
- Máy dev **không có** `ANTHROPIC_API_KEY`, không service key; phải test được toàn bộ UI/luồng mà không gọi vendor.
- Không hardcode secret; khoá đọc DB-trước-env-sau qua `app_config` (0015).
- `@anthropic-ai/sdk` **đã có trong working tree** (`package.json` ^0.124.0, `node_modules` 0.124.0 — chưa commit). Không phải thêm dep.

Rủi ro đặc thù của "trợ lý AI" trong app này: (1) nói sai chuyện bão/sóng là chuyện tính mạng — model **không được bịa số**; (2) prompt injection từ chính dữ liệu máy (tên món trong giỏ, ghi chú bảo dưỡng do người khác gõ); (3) chi phí + độ trễ mỗi lượt gọi ở tàu 3G chập chờn; (4) hành động phá huỷ (huỷ đơn, xoá sổ) không được kích bằng giọng.

## Decision / Quyết định

Xây trợ lý **hai tầng, tầng máy chạy TRƯỚC và luôn chạy**: (1) **OFFLINE** — bộ hiểu ý thuần TypeScript trong `src/lib/assistant/` (chuẩn hoá tiếng Việt không dấu + đồng nghĩa + số đếm → khớp mẫu → điểm tự tin → **31 mã ý định**, một bảng dùng chung 13 §3.0 ↔ 14 §3.0; `ngoai_pham_vi` chặn tại máy, không bao giờ lên máy chủ) trả lời bằng **`DeviceSnapshot`** do client gom từ các lib có sẵn, kèm mốc "lưu lúc"; (2) **ONLINE** — chỉ khi tầng máy không đủ tự tin (câu dài, sau 1 lần hỏi lại) hoặc câu hỏi mở, `POST /api/tro-ly` (body = **1 câu** + snapshot ẩn danh + route, không lịch sử) gọi **Claude `claude-opus-5`** qua `@anthropic-ai/sdk` 0.124 **phía máy chủ** (`client.beta.messages.create`, `output_config.effort: "low"`, thinking mặc định adaptive — `max_tokens` 700 bao cả thinking, gặp `max_tokens` rỗng thì thử lại **giữ thinking** với 1500, không tắt thinking; `fallbacks: "default"` + beta `server-side-fallback-2026-07-01`; prompt caching breakpoint trên khối system cuối (cache tools + system, Opus 5 từ 512 token); tool `strict: true` sort theo tên; **vòng lặp tool thủ công ≤3 vòng, `maxRetries: 0`, tổng 20 s**); tool executor gọi **thẳng hàm lib server** (không HTTP nội bộ); tool thời tiết trả ≤3 ngày cho mọi hạng (v1). **Nghe = Web Speech API `SpeechRecognition` `vi-VN`** — **cần mạng** trên iOS/Android: mất sóng thì mic thử 1 lần, lỗi `network` → **chip gợi ý + ô gõ là hàng chính** (TROLY-BRIEF §4 #4); **nói = `speechSynthesis`** giọng vi-VN của máy (chạy offline; không có giọng Việt thì chỉ chữ). **Chế độ giả lập** (`ASSISTANT_MOCK=1`, hoặc thiếu khoá khi `NODE_ENV!=='production'`) trả lời kịch bản theo cùng bộ parse offline để dev/QA chạy đủ luồng không cần vendor (`reply.source:"mock"`). Hành động là tập đóng 7 loại (`navigate · search · addToCart · call · setHomePort · setBoat · mute`); **thêm giỏ = giỏ CHỢ, ONLINE**: client tìm `/api/cho/san-pham?q=` top 3 → **chạm thẻ = xác nhận** → `addMarketLine` (TROLY-BRIEF §4 #1); gọi = chạm "Gọi"; dẫn đường v1 = mở Ra khơi + đọc "bấm Điểm đã lưu rồi chọn <tên>" (3 chạm, nợ `?den=`); **không bao giờ** đặt hàng/huỷ đơn/xoá sổ bằng giọng. Hotline = `SDVICO_HOTLINE` có sẵn (`src/data/sdvico-showcase.ts`). Khoá API: env `ANTHROPIC_API_KEY` → `app_config.anthropic_api_key` (secret, thêm vào `CONFIG_KEYS`); hạn mức `assistant_daily_limit` mặc định 30/ngày/SĐT, đếm trong bộ nhớ instance (+ file khi `MARKET_STORE=file`).

Thiết kế chi tiết (type nguyên văn, system prompt, hợp đồng route, kế hoạch build): [`docs/app-map/14-kien-truc-tro-ly.md`](../app-map/14-kien-truc-tro-ly.md).

## Alternatives considered / Phương án đã cân nhắc

### Option A: Model voice-native qua streaming audio (Gemini Live / OpenAI Realtime)
- ✅ Ưu: nghe–nghĩ–nói trong một kết nối, độ trễ thấp, giọng tự nhiên; không phải ghép ba mảnh STT/LLM/TTS.
- ❌ Nhược: **khác vendor** với model đã chốt (`claude-opus-5`) — hai hợp đồng, hai khoá, hai cách tính tiền; **WebSocket/WebRTC audio hai chiều** trên 3G chập chờn ngoài khơi là thứ hỏng nhiều nhất trong app (mọi lời gọi hiện tại là request–response có `timeoutSignal`, SW đứng ngoài); **tính tiền theo giây audio**, đắt hơn nhiều so với vài trăm token chữ; và **mất sóng = mất cả tầng hiểu** (không có gì để hỏi "giấy tờ hết hạn chưa" lúc đang ở biển). Trả lời sai một câu về bão khi model nghe nhầm tiếng Việt vùng miền qua audio stream cũng khó soát hơn chữ đã nhận dạng hiện trên màn.

### Option B: STT phía máy chủ (Whisper / API nhận dạng)
- ✅ Ưu: nhận dạng tiếng Việt tốt hơn Web Speech trên vài máy Android rẻ; kiểm soát được chất lượng.
- ❌ Nhược: **đẩy file audio** (vài trăm KB/câu) qua mạng tàu — đúng chiều băng thông app đang tiết kiệm từng KB; thêm một nguồn ngoài nữa vào `external-services` với timeout/fallback riêng; và vẫn **không dùng được lúc mất sóng**, trong khi Web Speech trên iOS mới có nhận dạng ngay trên máy. Không thêm.

### Option C: LLM ngay trên máy (WebLLM / Gemini Nano / Prompt API)
- ✅ Ưu: chạy offline hoàn toàn, không tốn tiền vendor.
- ❌ Nhược: mô hình 1–4 GB tải xuống máy ngư dân đang **thiếu chỗ** (app đã phải xin `storage.persist()` và có bậc hy sinh cho dự báo); chạy trên iPhone 12/Android đời cũ **nóng máy, tụt pin, chậm hàng chục giây**; Prompt API chỉ có trên Chrome desktop/vài máy Android mới, iOS không có. Đổi lại được gì? Câu hỏi "trong máy" thì bộ hiểu ý thuần TS **đã trả lời được với 0 byte tải thêm**; câu hỏi mở thì model nhỏ trên máy trả lời kém và **vẫn bịa** — đúng thứ không được phép với chuyện bão. Loại.

### Option D: Hai tầng offline-trước + Claude phía máy chủ + STT/TTS nền tảng ← chosen / đã chọn
- ✅ Ưu: mọi việc thường ngày trả lời **tức thì, không mạng, không tốn tiền**, bằng chính dữ liệu bà con đã thấy trên màn (nhất quán, kèm mốc lưu); tầng online chỉ trả tiền cho câu đáng hỏi; SDK server-side giữ khoá ở đúng chỗ (không lộ ra client, không qua proxy thứ ba); tool executor gọi lib có sẵn nên **không đẻ nguồn ngoài mới** ngoài chính Anthropic; dev/QA chạy đủ luồng bằng mock; hai tầng có cùng `AssistantReply` nên UI một đường.
- ❌ Nhược: (1) **Web Speech `SpeechRecognition` trên Chrome Android (và Safari iOS) gửi audio lên máy chủ Google/Apple** — mất sóng thì mic báo lỗi `network`, còn **chip + gõ** (chip theo màn/giờ/việc phủ đủ 20 việc thường ngày để 0-gõ — 13 §10). Nói thật trên màn bằng câu chốt của lead, không hứa "nói được lúc mất sóng"; (2) hai bộ hiểu (regex + LLM) phải giữ **cùng danh sách ý định** — test vector ≥120 câu là dây neo; (3) giọng đọc `speechSynthesis` vi-VN phụ thuộc máy (iOS có "Linh", Android cần gói Google TTS tiếng Việt) — có nút tắt tiếng và chữ TO luôn hiện, giọng chỉ là lớp thêm; (4) quota/ngày đếm trong bộ nhớ instance là **trần mềm** (Vercel nhiều instance, restart là quên) — ghi nợ bảng `assistant_usage` khi có tiền thật đi qua.

### Về STT native Capacitor (plugin nhận dạng offline của hệ điều hành)
- Loại **đợt này**: thêm plugin native là thêm một bước build/ký app + một bề mặt lỗi trên từng đời Android; Web Speech đã phủ Chrome Android + iOS Safari/WebView đủ để đo xem bà con **có dùng** không. Ghi nợ: `// nợ: STT Web Speech cần mạng trên Android; nâng lên plugin Capacitor SpeechRecognition khi ≥30% lượt mic lỗi 'network' theo đo ở forfish.assistant.v1`.

### Về nơi đặt tầng hiểu online: tool runner của SDK vs vòng lặp thủ công
- Loại `client.beta.messages.toolRunner()` cho v1: runner tự lặp và tự thử lại, **không cho kiểm soát trần 20 s tổng** (SDK mặc định `maxRetries: 2`, mỗi lượt có thể vài giây); route serverless có `maxDuration`, quá là 504 câm. Vòng lặp thủ công ≤3 vòng + `timeoutSignal(còn lại)` từng lượt + `maxRetries: 0` là cách duy nhất để **luôn có câu trả lời (dù là "chưa hỏi được") trước khi client hết giờ**.

## Consequences / Hệ quả

- **Tích cực**: bà con ngoài biển vẫn hỏi được thời tiết/bão/giấy tờ/bảo dưỡng/giỏ/đơn bằng giọng hoặc gõ, câu trả lời **cùng số với màn hình** và có mốc "lưu lúc"; câu hỏi mở đi qua Claude với chi phí thấp (effort low, cache system+tools, ~600 token đầu ra); không có secret nào ở client; mọi thứ test được trên máy dev không khoá; không đụng `sw.js` (`/api/tro-ly` nằm ngoài `API_CACHE_ALLOW` theo cấu trúc allowlist, không phải sửa); không migration nào bắt buộc cho v1.
- **Đánh đổi**: (1) chất lượng mic phụ thuộc máy + sóng — khi mất sóng **chip là hàng chính**, ô gõ ngay dưới, mic là lớp thêm; (2) hai bộ hiểu phải khớp — mọi ý định mới thêm ở `types.ts` phải có mẫu ở `parse.ts`, câu ở `answer.ts`, và ≥4 câu test; (3) quota trần mềm (ghi nợ); (4) `DeviceSnapshot` là **dữ liệu, không phải lệnh** — system prompt nói rõ, server bọc trong khối riêng, chuỗi tự do cắt ≤40 ký tự + escape `<>`; vẫn là bề mặt injection nên **không gửi CCCD/STK/tên thuyền viên/tên tàu/số giấy tờ/toạ độ/lịch sử câu** lên máy chủ, chỉ gửi loại + hạn + số đếm, và route **từ chối** (400 `bad_snapshot`) body có trường nhạy cảm; action từ model bị kẹp (`navigate` ∈ danh sách route, `call` chỉ số từ tool cùng lượt); (5) thêm một dịch vụ ngoài (Anthropic API) vào `ops/external-services.md` với timeout 20 s tổng và cột "khi nó chết": nói thật "chưa hỏi được, bác hỏi việc trong máy".
- **Trung tính**: `assistant-fab.tsx` là phần tử nổi thứ hai trên dock (sau banner cài) — nằm dưới `z-30` của `BottomSheet` nên scrim che nó khi có sheet khác mở (không cần code phát hiện); trên `/ngu-truong` có thể chồng mép `SnapSheet` — QA đo, hỏng thì dời vào rail (Trục 1). Route cũ không đổi, dock 5 mục không đổi.

## References

- Thiết kế kỹ thuật: `docs/app-map/14-kien-truc-tro-ly.md`
- BA spec: `docs/app-map/13-ba-spec-tro-ly-giong-noi.md` (agent BA, song song)
- Khung lead: `TROLY-BRIEF.md` (scratchpad phiên 2026-09-06)
- App-map liên quan: `02-architecture.md` §3/§5, `04-data-model.md` (0015 `app_config`), `ops/external-services.md`, `ops/state-registry.md`, `03-design-system.md`
- ADR liên quan: 0004 (phạm vi offline), 0007 (bảo mật), 0008 (chợ — `MarketStore`, dev file-mode, `identityFromRequest` dev branch)
- Tài liệu SDK đã đối chiếu: `claude-api/typescript/claude-api/README.md` (thinking mặc định bật trên Opus 5, `max_tokens` bao cả thinking, `stop_reason` refusal/max_tokens, `fallbacks`), `tool-use.md` (vòng lặp thủ công, `strict`), `shared/prompt-caching.md` (breakpoint trên khối system cuối; Opus 5 cache từ 512 token; không nhét ngày/giờ vào system), `shared/model-migration.md` §Migrating to Claude Opus 5 (`fallbacks: "default"` + `server-side-fallback-2026-07-01`; effort `low` là đòn bẩy chi phí chính; thêm chỉ thị ngắn gọn vì Opus 5 viết dài)

## History

- **2026-09-06**: Proposed (Kiến trúc sư, Phase 1)
- **2026-09-06b**: v1.1 hợp nhất sau phản biện (`docs/app-map/_generated/phan-bien-tro-ly-2026-09-06.md`): đưa TROLY-BRIEF §4 vào Decision (giỏ chợ online + chạm thẻ xác nhận; dẫn đường v1 3 chạm; STT cần mạng → chip hàng chính; premium hai tầng; hotline `SDVICO_HOTLINE`; quota + file-mode); 31 mã ý định một bảng; `max_tokens` thử lại giữ thinking (F-03); `RateLimitError` → `upstream` (F-04); bỏ `history` khỏi request; `bad_snapshot`; khoá `forfish.assistant.` vào `NEVER_BACKUP_PREFIXES`
