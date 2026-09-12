# 03 — Vòng đêm soạn gói não (runbook)

> **Load khi / dùng khi**: bạn vận hành trạm PC ở bờ và cần chạy (hoặc sửa) nhịp đêm
> "kéo câu bà con → LLM soạn nháp → người duyệt → đóng gói → sinh giọng → đăng".
> Đây là runbook thao tác. Bối cảnh vì sao có trạm: [ADR 0010](../../../adr/0010-tro-ly-nghe-offline-wasm.md)
> §"Trạm học ở bờ". Cài Ollama/qwen3.5:9b: [01-cai-local-llm.md](01-cai-local-llm.md) (Agent A).
> Đóng gói + tối ưu prompt/dung lượng: [04-toi-uu.md](04-toi-uu.md). Sinh giọng: [05-sen-bien-giong.md](05-sen-bien-giong.md).
> **Khuôn JSON của gói (manifest/knowledge/intents/answers) là của [contract gói não](../../../contracts/tro-ly-brain-pack.contract.md)** (Agent B) — doc này KHÔNG định nghĩa lại shape, chỉ mô tả luồng.

## 0. Một câu về nguyên tắc

Máy trong tay bà con **chỉ tìm + trích**, không sinh chữ → không bịa (ADR 0010).
Trạm ở bờ được phép dùng LLM, **nhưng LLM chỉ soạn NHÁP**. Không có nháp nào tự vào gói.
Mọi mục kiến thức phải qua **người duyệt** ở `/quan-tri` và phải có `nguon` + `ngaySoat`.
Đây là chỗ duy nhất trong hệ Sen Biển mà một model được viết chữ cho bà con đọc — nên nó bị
gác chặt nhất.

## 1. Toàn cảnh luồng một đêm

```
  [Supabase]                         [Trạm PC ở bờ, 24/7]                    [Web /quan-tri]        [Bucket]
  unansweredHashes  ─┐
  outbox (hộp sóng) ─┼─► 1.KÉO ─► 2.GOM CỤM ─► 3.qwen3.5:9b soạn NHÁP ─► 4.ĐẨY NHÁP ─►  HÀNG ĐỢI DUYỆT
                     │    (đọc)     (offline)     (Ollama, 0đ)        (upsert)      người bấm Duyệt/Sửa/Bỏ
                     │                                                                     │
                     │                                                          (mục đã duyệt: nguon+ngaySoat)
                     │                                                                     ▼
                     └───────────────────────────────  5.GỘP vào nội dung gói  ◄───────────┘
                                                          6.VieNeu sinh giọng câu cố định  (→ 05)
                                                          7.export-brain-pack.mjs → manifest + sha256
                                                          8.validate-brain-pack.mjs (cổng, --self-test đã xanh)
                                                          9.ĐĂNG: tab "Gói trợ lý" → bucket + đặt version + rollout
                                                                    (thao tác đăng: 02-quan-tri-va-update.md, Agent B)
```

Bước 1–8 chạy **tự động ban đêm** trên trạm. Bước 3→4 sinh nháp, **bước "người duyệt" nằm giữa 4 và 5
và KHÔNG tự động** — sáng hôm sau người của SDVICO mở `/quan-tri` duyệt tay. Bước 9 (đăng gói) cũng là
thao tác tay của người có quyền, có audit (ADR 0007). Trạm **không tự đẩy gói ra bà con**.

## 2. Bước 1 — Kéo dữ liệu từ Supabase

Nguồn (client đã đẩy lên theo nhịp `pretrip-auto`, xem ADR 0010 §hộp chờ sóng):

| Thứ | Ở đâu | Là gì | Lưu ý riêng tư |
|---|---|---|---|
| `unansweredHashes` | tổng hợp từ `forfish.assistant.v1` các máy (route thu ở app-side, P1) | `Record<hash, count>` — **mã băm** câu chuẩn hoá, KHÔNG nguyên văn | không có nguyên văn để đọc → xem mục 2.1 |
| `outbox` (hộp chờ sóng) | hàng đợi `/quan-tri` tab "Câu hỏi bà con" (ADR 0010) | câu bà con gõ/nói khi máy chịu thua, ≤20 câu/máy, **không kèm CCCD/SĐT/toạ độ** | đây là **nguyên văn có đồng thuận** (bà con chủ động bấm "gửi") → dùng làm nội dung soạn |

**Chốt nguồn nội dung để soạn**: chỉ `outbox` mới có chữ thật để đưa vào LLM. `unansweredHashes`
**không giải băm được** (một chiều, cố tình) → nó chỉ dùng để **xếp ưu tiên** (hash nào đếm cao = bà con
hỏi nhiều = đáng soạn trước), không phải để đọc nội dung. Cách bắc cầu hash↔chủ đề: xem [04-toi-uu.md](04-toi-uu.md)
§"Tối ưu nội dung".

### 2.1. Cổng kéo dữ liệu

- Trạm gọi Supabase bằng **service role key** (chỉ nằm trên trạm, trong biến môi trường, **không** trong repo).
  Cài đặt key: [01-cai-local-llm.md](01-cai-local-llm.md).
- Chỉ đọc (SELECT) hàng đợi câu hỏi; **không** đọc bảng nào có CCCD/SĐT/toạ độ. Nếu một query lỡ chạm cột
  định danh → dừng, sửa query, đây là 🔴 riêng tư.
- Lưu bản kéo về **thư mục làm việc của trạm NGOÀI repo** (vd `D:\tram-o-bo\work\<ngày>\`), không để trong
  cây git (CLAUDE.md §"CẤM file dữ liệu tạm trong cây làm việc").

## 3. Bước 2 — Gom cụm câu gần nghĩa

Mục tiêu: nhiều câu hỏi khác chữ nhưng cùng một việc ("cá ngừ để được mấy ngày", "bảo quản cá ngừ sao cho
tươi", "ướp đá cá ngừ thế nào") → **một** mục FAQ, không đẻ ba mục trùng.

- Chuẩn hoá `foldVn` (bỏ dấu, thường hoá — cùng hàm app dùng, đừng viết lại: nguyên tắc 15 §3) rồi gom bằng
  tương đồng đơn giản (chia sẻ từ khoá / khoảng cách chỉnh sửa). **Không cần embedding, không thêm dep**
  (bậc 3/5 nguyên tắc 15). Cụm nào < 3 câu thì để riêng, đừng ép gộp.
- Mỗi cụm ra một "đề bài" cho qwen3.5:9b: {chủ đề gợi ý, 3–8 câu hỏi mẫu đại diện}. Gộp nhiều cụm gửi 1 lượt để
  đỡ nạp model lại (xem [04-toi-uu.md](04-toi-uu.md) §batch).

## 4. Bước 3 — qwen3.5:9b (Ollama) soạn NHÁP

Model: **qwen3.5:9b (Q4) qua Ollama** (0đ), chạy trên RTX 3060 của trạm. Cài: [01-cai-local-llm.md](01-cai-local-llm.md).
Tinh chỉnh tham số (num_ctx, keep_alive, Q4/Q5): [04-toi-uu.md](04-toi-uu.md).

Nháp ra **hai loại**, đúng khuôn [contract](../../../contracts/tro-ly-brain-pack.contract.md):
1. **Mẫu câu ý định** (bổ sung `intents`): thêm cách nói/từ đồng nghĩa cho ý định đã có — thấp rủi ro, vì chỉ
   là biến thể câu hỏi, không phải câu trả lời.
2. **Mục FAQ** (`knowledge`): mỗi mục `{ id, cauHoiMau[], tuKhoa[], traLoi (≤4 câu), nguon, ngaySoat, chipMoMan? }`.

### 4.1. Prompt mẫu cho qwen3.5:9b (soạn mục knowledge)

> ⚠️ Prompt này **buộc model tự đánh dấu chỗ nó không chắc** và **để trống `nguon`** thay vì bịa nguồn.
> Ô `nguon` trống = tín hiệu cho người duyệt "phải tự tra nguồn", KHÔNG phải để phát hành.

**System:**
```
Bạn soạn NHÁP câu trả lời cho trợ lý của ngư dân Việt Nam. Nháp này sẽ được NGƯỜI DUYỆT, không phát trực tiếp.
Luật cứng, vi phạm là hỏng:
- KHÔNG bịa số. Không viết giá cá, giá dầu, tốc độ gió, cấp bão, nhiệt độ, ngày giờ cụ thể — những số đó thay
  đổi từng ngày và máy sẽ tự lấy từ dữ liệu thật, không lấy từ câu này.
- KHÔNG khuyên y tế, pháp lý, hay chuyện tiền bạc cá nhân. Gặp loại này, trả về traLoi rỗng và ghi lyDoBo.
- traLoi TỐI ĐA 4 câu, tiếng Việt đời thường, cho người 40–60 tuổi ít rành công nghệ. Không thuật ngữ.
- Nếu bạn KHÔNG chắc kiến thức này đúng, để "nguon" rỗng và đặt "canNguoiTra": true. Thà trống còn hơn sai.
- Chỉ trả JSON đúng khuôn, không giải thích thêm.
Khuôn mỗi mục:
{ "id": "<slug-khong-dau>", "cauHoiMau": ["..."], "tuKhoa": ["..."],
  "traLoi": "≤4 câu, hoặc rỗng", "nguon": "", "ngaySoat": "", "chipMoMan": null,
  "canNguoiTra": false, "lyDoBo": "" }
```

**Vài ví dụ (few-shot) — cho model bắt khuôn:**
```
NGƯỜI: chủ đề "bảo quản cá ngừ"; câu hỏi mẫu: ["cá ngừ để được mấy ngày","ướp đá cá ngừ sao"]
MODEL: {"id":"bao-quan-ca-ngu","cauHoiMau":["Cá ngừ ướp đá để được mấy ngày?","Bảo quản cá ngừ sao cho tươi?"],
  "tuKhoa":["cá ngừ","ướp đá","bảo quản","giữ tươi"],
  "traLoi":"Xả đông và ướp đá ngay sau khi đánh, giữ lớp đá phủ kín thân cá. Đá xay bám tốt hơn đá cây. Kiểm tra và bù đá mỗi ngày, chắt nước tan ra. Cá càng lạnh đều thì càng để được lâu.",
  "nguon":"","ngaySoat":"","chipMoMan":null,"canNguoiTra":true,"lyDoBo":""}

NGƯỜI: chủ đề "thuốc hạ sốt cho thuyền viên"; câu hỏi mẫu: ["đau bụng uống thuốc gì","sốt thì uống gì"]
MODEL: {"id":"","cauHoiMau":[],"tuKhoa":[],"traLoi":"","nguon":"","ngaySoat":"","chipMoMan":null,
  "canNguoiTra":false,"lyDoBo":"Chuyện y tế — ngoài phạm vi trợ lý (INT-26 chặn ở máy). Không soạn."}
```

- `canNguoiTra: true` và `nguon: ""` là **mặc định an toàn** khi model lưỡng lự → hàng đợi duyệt hiện cờ đỏ
  "cần người tra nguồn".
- `lyDoBo` khác rỗng → nháp bị bỏ tự động trước khi vào hàng đợi (đỡ mắt người duyệt).

### 4.2. Chống bịa ở tầng máy (không tin mình model)

Ngay sau khi qwen3.5:9b trả, **script kiểm sơ** trước khi đẩy nháp (đây là tiền-kiểm, cổng thật là người duyệt +
`validate-brain-pack.mjs` lúc đóng gói):
- `traLoi` > 4 câu → cắt cờ, đánh dấu "quá dài".
- `traLoi` chứa số nghi là số sống (đồng, nghìn, ₫, độ, cấp, km/h, m/s, %…) → cờ "nghi số sống".
- `nguon` rỗng → cờ "thiếu nguồn" (không chặn ở bước nháp, chặn ở lúc đóng gói).

## 5. Bước 4 — Đẩy nháp vào `/quan-tri` cho NGƯỜI DUYỆT

- Trạm `upsert` nháp vào hàng đợi duyệt (bảng do Agent B đặc tả ở [02-quan-tri-va-update.md](02-quan-tri-va-update.md));
  mỗi nháp mang các cờ ở §4.2 + số đếm hash (bà con hỏi bao nhiêu lần) để người duyệt xếp ưu tiên.
- **Người duyệt bắt buộc** làm ba việc trên mỗi mục trước khi Duyệt: (a) sửa chữ cho đúng và đời thường;
  (b) điền `nguon` thật (tài liệu SDVICO, thông báo hàng hải, kinh nghiệm đội đã kiểm…); (c) đặt `ngaySoat` = ngày duyệt.
- Mục không điền được `nguon` → **không Duyệt được** (cổng `validate` sẽ chặn lúc đóng gói, nhưng chặn sớm ở UI đỡ mất công).

## 6. Bước 5–8 — Gộp, sinh giọng, đóng gói, kiểm

1. **Gộp** (bước 5): các mục đã Duyệt gộp vào `intents/answers/knowledge` của gói. Đổi nội dung thì **đè**
   đúng file, không đẻ `-v2` (CLAUDE.md §git). Bump `version` gói.
2. **Sinh giọng** (bước 6): câu cố định mới/đổi trong `answers` → chạy VieNeu (`scripts/tro-ly-giong/gen_pack.py`)
   sinh mp3 hai giọng → xem [05-sen-bien-giong.md](05-sen-bien-giong.md). Câu có **số sống** (giá, thời tiết)
   KHÔNG pre-bake — máy đọc bằng piper/Web Speech.
3. **Đóng gói** (bước 7): chạy [`scripts/tram-o-bo/export-brain-pack.mjs`](../../../../scripts/tram-o-bo/export-brain-pack.mjs)
   `<thư-mục-nội-dung-đã-duyệt>` → sinh `manifest.json` (version, sha256 từng file, bytes) + in tổng dung lượng.
4. **Kiểm** (bước 8, cổng): chạy [`scripts/tram-o-bo/validate-brain-pack.mjs`](../../../../scripts/tram-o-bo/validate-brain-pack.mjs)
   `<thư-mục-gói>`. Đỏ → **dừng, không đăng**. Kiểm: manifest khớp file, sha256 đúng, mọi mục knowledge có
   `nguon`+`ngaySoat`, ≤4 câu, cảnh báo số sống. Ngân sách gói ~50–70 MB (ADR 0010) — vượt thì [04-toi-uu.md](04-toi-uu.md) §dung lượng.

## 7. Bước 9 — Đăng gói (tay, có người)

Người có quyền mở `/quan-tri` tab "Gói trợ lý" → upload gói đã kiểm → đặt version → rollout theo băm SĐT
(10% → 100%) → audit. **Thao tác chi tiết: [02-quan-tri-va-update.md](02-quan-tri-va-update.md) (Agent B).** Trạm
dừng ở "gói đã kiểm nằm sẵn"; việc đẩy ra bà con là quyết định của người, không phải của cron.

## 8. Lịch chạy + log + Ollama treo

### 8.1. Lịch (Windows Task Scheduler, trạm chạy Windows)

- Tạo task chạy **mỗi đêm** (vd 02:00) một script gói bước 1–8. Trạm là PC nhà, không SLA → nếu một đêm lỡ,
  đêm sau chạy bù, không ai chờ. Đây là điểm mạnh của kiến trúc "học ở bờ": bà con ngoài biển **không** phụ
  thuộc trạm (ADR 0010).
- `schtasks /Create /TN "SenBien-VongDem" /TR "..." /SC DAILY /ST 02:00 /RL LIMITED` (lệnh mẫu — chốt lệnh
  thật ở [01-cai-local-llm.md](01-cai-local-llm.md) cùng đường dẫn Node/Python của trạm).
- **Không** đặt lịch trùng giờ backup/cập nhật Windows để khỏi tranh VRAM/đĩa.

### 8.2. Log

- Mỗi lần chạy ghi 1 file log `D:\tram-o-bo\logs\<ngày>.log`: số câu kéo về, số cụm, số nháp sinh, số nháp bị
  bỏ tự động (`lyDoBo`), thời gian mỗi bước, lỗi. Log **ngoài repo**.
- Giữ log 90 ngày rồi dọn (câu hỏi này đã thành mục FAQ hoặc đã bỏ). Log **không** chứa nguyên văn có định danh.

### 8.3. Ollama treo / trạm sự cố (mất điện, sập nguồn ban đêm)

Trạm ở nhà, ban đêm không ai canh → phải tự chịu lỗi, không treo vô hạn:
- Mỗi lần gọi Ollama đặt **timeout** (vd 120 s/cụm) + số lần thử lại hữu hạn. Treo/hết giờ → **bỏ cụm đó**,
  ghi log, chạy tiếp cụm sau. Một cụm hỏng không được kéo sập cả đêm.
- Ollama không phản hồi `/api/tags` đầu phiên → thử `ollama serve` lại một lần; vẫn chết → **bỏ nguyên đêm**,
  ghi log "Ollama down", để đêm sau. Không có nháp mới chỉ nghĩa là "gói không đổi đêm nay" — vô hại.
- Mất điện giữa chừng → bản kéo/nháp nằm ở thư mục work ngoài repo, đêm sau chạy lại từ đầu ngày đó. **Không**
  đăng gói tự động, nên không có gói nửa vời nào ra bà con.
- Đĩa đầy → dừng trước bước đóng gói, ghi log; ngân sách gói + dọn work ở [04-toi-uu.md](04-toi-uu.md).

## 9. Còn nợ / cần chốt

- **Nợ**: đường bắc cầu `unansweredHashes` → chủ đề để ưu tiên (hash một chiều). Cách tạm ở [04-toi-uu.md](04-toi-uu.md)
  §nội dung; nâng cấp khi app-side P1 (ADR 0010) chốt có gửi kèm "nhãn ý định đoán được" cạnh hash hay không.
- **Nợ**: bảng hàng đợi duyệt + cột cờ nháp là của Agent B ([02-quan-tri-va-update.md](02-quan-tri-va-update.md));
  doc này giả định có `upsert` nháp + trạng thái Duyệt/Sửa/Bỏ. Khớp tên cột khi contract chốt.
- **Cần chủ dự án quyết**: ai là "người duyệt" (đội SDVICO nào), nhịp duyệt (mỗi sáng? mỗi tuần?). Gói chỉ đổi
  khi có người duyệt — nếu không ai duyệt thì trạm chạy không, vô hại nhưng không tiến.
