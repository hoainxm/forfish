# 09 — Giám sát trạm (monitoring / health-check)

> **Load khi / dùng khi**: bạn cần biết trạm PC-ở-bờ có đang khoẻ không — Ollama sống chưa,
> vòng đêm tối qua chạy xong hay lỗi, gói đã cũ tới mức nào, GPU/đĩa còn ổn — hoặc cần dựng
> lịch health-check + chỗ cắm cảnh báo. Đây là **thiết kế giám sát**. Vòng đêm sinh ra thứ để
> giám sát: [`03-vong-dem-soan-goi.md`](03-vong-dem-soan-goi.md). Triết lý "trạm chết → app vẫn
> chạy": [`00-tong-quan.md`](00-tong-quan.md) §6/§7. Không trùng QA gói: [`08-qa-full-luong.md`](08-qa-full-luong.md)
> kiểm *một gói có hợp lệ không*; doc này kiểm *trạm có đang soạn gói mới không*.

Công cụ: [`scripts/tram-o-bo/health-check.mjs`](../../../../scripts/tram-o-bo/health-check.mjs) (`--help`, `--json`, `--self-test`).

---

## 1. Triết lý cảnh báo — trạm chết KHÔNG phải cháy nhà

Đây là điều dễ làm sai nhất, nên đặt lên đầu. Theo [00 §6–§7](00-tong-quan.md): **app bà con không
bao giờ gọi vào trạm.** Trạm mất điện / mất mạng / hỏng ổ → bà con **không cảm nhận được gì**, máy
vẫn tìm-trích trên **gói cũ** đã tải, offline như thường. Hàng đợi câu hỏi nằm ở Supabase (không mất),
gói đã phát hành nằm ở Supabase Storage (không mất), chốt chặn ở `/quan-tri` (không nằm trên trạm).

Nên **cảnh báo trạm-chết = "gói đang cũ dần / cần soạn gói mới", KHÔNG phải "sự cố khẩn"**. Không có
SLA, không gọi ai dậy lúc 2 giờ sáng. Nếu một health-check gào lên như cháy nhà chỉ vì Ollama tắt một
đêm, nó đang hiểu sai kiến trúc.

**Mức được lái bởi hai trục chính** (GPU/đĩa/Ollama chỉ là tín hiệu phụ):

| Mức | Nghĩa | Khi nào | Việc |
|---|---|---|---|
| 🟢 **XANH** | Trạm khoẻ, gói mới, vòng đêm chạy đều | vòng đêm xong trong ~48h + gói còn tươi (≤15 ngày) + Ollama sống | không cần làm gì |
| 🟡 **VÀNG** | Cần để mắt — có thứ nên soạn gói / trạm hụt nhịp | vòng đêm lỡ vài đêm · marker thiếu · đêm gần nhất lỗi · gói cũ dần (15–30 ngày) · Ollama không trả lời · model tràn CPU · đĩa vơi dần | xem lúc rảnh; **không khẩn** — app vẫn chạy gói cũ |
| 🔴 **ĐỎ** | Gói đang mục / vòng đêm ngừng hẳn / đĩa đầy | vòng đêm ngừng > 1 tuần · gói quá cũ (>30 ngày) · đĩa < 2 GB | ra sửa trạm — **vẫn không phải sự cố app**, chỉ là gói không mới thêm |

> Mức tổng = mức cao nhất trong các dòng. Ngay cả 🔴 cũng chỉ nói "trạm cần người ra tay để gói lại
> được soạn mới", không phải "bà con đang gặp nguy". Giữ đúng khung này khi viết nội dung cảnh báo.

---

## 2. Cần theo dõi cái gì

`health-check.mjs` dò 5 nhóm sau. Ngưỡng nằm ngay đầu script (đổi có ghi lý do — nguyên tắc 15 §7).

| # | Chỉ số | Cách đo | Ngưỡng | Ý nghĩa |
|---|---|---|---|---|
| a | **Ollama sống?** | `GET http://127.0.0.1:11434/api/tags` (timeout 2,5 s); `ollama ps` để biết model nạp chưa | sống = 🟢; không trả lời = 🟡 | Ollama tắt ⇒ đêm nay không soạn được gói; app vẫn chạy gói cũ ([03 §8.3](03-vong-dem-soan-goi.md)) — **không khẩn** |
| b | **Vòng đêm tối qua** | đọc **marker `last-run.json`** (§3) do vòng đêm ghi | xong ≤48h = 🟢; lỡ 48h–7 ngày / lỗi / thiếu marker = 🟡; ngừng >7 ngày = 🔴 | **trục chính**: gói chỉ mới thêm khi vòng đêm chạy xong |
| c | **Độ cũ của gói** | `--pack-manifest <path>` → tính từ `manifest.createdAt` | ≤15 ngày = 🟢; 15–30 = 🟡; >30 = 🔴 | **trục chính**: độ trễ soạn gói. Gói cũ vẫn dùng được, chỉ là không mới |
| d | **GPU / VRAM** | `nvidia-smi --query-gpu=name,memory.used,memory.total,utilization.gpu,temperature.gpu --format=csv,noheader,nounits`; `ollama ps` cột PROCESSOR | thông tin (🟢); model **tràn CPU** = 🟡 | model không nằm trọn GPU ⇒ soạn nháp chậm; kiểm VRAM/quant ([04](04-toi-uu.md)) hoặc dùng `qwen3.5:4b` |
| e | **Đĩa trống** | `fs.statfsSync` trên `--disk-path` (mặc định thư mục hiện tại) | ≥10 GB = 🟢; 2–10 GB = 🟡; <2 GB = 🔴 | model + log + gói lớn dần; đĩa đầy ⇒ dừng trước bước đóng gói ([03 §8.3](03-vong-dem-soan-goi.md)) |

`nvidia-smi` / `ollama` không có trên máy đang chạy → in **`n/a`**, **không sập** (health-check phải
chạy được cả trên máy dev không GPU). Không truyền `--pack-manifest` → dòng gói là `n/a` mức 🟢
(không tự đẩy mức lên chỉ vì thiếu tham số).

---

## 3. Marker `last-run.json` — hợp đồng nhỏ với vòng đêm

Health-check **không tự đoán** vòng đêm chạy hay chưa — nó đọc một **marker file** mà **vòng đêm
([03](03-vong-dem-soan-goi.md)) ghi ra cuối mỗi lần chạy**. Đề xuất khuôn này để [03 §8.2](03-vong-dem-soan-goi.md)
ghi (ghi **ngoài repo**, cạnh log — xem §5):

```json
{
  "startedAt":  "2026-09-12T02:00:03.120Z",
  "finishedAt": "2026-09-12T02:41:55.882Z",
  "ok":         true,
  "drafts":     7,
  "error":      null
}
```

| Trường | Kiểu | Ý nghĩa |
|---|---|---|
| `startedAt` | ISO 8601 | lúc vòng đêm bắt đầu |
| `finishedAt` | ISO 8601 | lúc chạy xong (health-check tính độ trễ từ đây) |
| `ok` | boolean | `true` = chạy trọn; `false` = có lỗi kéo sập cả đêm (Ollama down, đĩa đầy…) |
| `drafts` | số | số nháp sinh ra đêm đó (0 cũng hợp lệ — không có câu mới) |
| `error` | chuỗi\|null | mô tả ngắn khi `ok:false` — **không** chứa nguyên văn có định danh ([03 §8.2](03-vong-dem-soan-goi.md)) |

**Vòng đêm nên ghi marker ngay cả khi lỗi** (`ok:false` + `error`), và ghi **finishedAt cuối cùng**
kể cả nửa chừng bỏ — nhờ vậy health-check phân biệt được "lỗi đêm qua" (🟡, soi log) với "ngừng hẳn
nhiều ngày" (🔴). Marker thiếu = "chưa từng chạy vòng đêm" (🟡) — hoặc vòng đêm chưa ghi marker, hoặc
để sai đường dẫn.

---

## 4. Cách chạy giám sát

**Thủ công** (soi nhanh khi nghi ngờ):

```bash
node scripts/tram-o-bo/health-check.mjs \
  --run-marker    D:\tram-o-bo\state\last-run.json \
  --pack-manifest D:\tram-o-bo\packs\latest\manifest.json \
  --disk-path     D:\
```

**Theo lịch** (Windows Task Scheduler, mỗi 15–30 phút — trạm chạy Windows, [03 §8.1](03-vong-dem-soan-goi.md)):

```bat
schtasks /Create /TN "SenBien-HealthCheck" /SC MINUTE /MO 30 /RL LIMITED ^
  /TR "node D:\ForFish\scripts\tram-o-bo\health-check.mjs --run-marker D:\tram-o-bo\state\last-run.json --pack-manifest D:\tram-o-bo\packs\latest\manifest.json --disk-path D: --json >> D:\tram-o-bo\logs\health.log 2>&1"
```

- Đường dẫn Node/repo/state chốt thật ở [01-cai-local-llm.md](01-cai-local-llm.md) cùng các đường khác của trạm.
- Có thể đặt qua **env** thay cờ: `TRAM_RUN_MARKER`, `TRAM_PACK_MANIFEST`, `TRAM_NOTIFY_CMD`.
- **Mã thoát** để cron/giám sát khác bắt: `0` XANH · `1` VÀNG · `2` ĐỎ.

**Chỗ cắm cảnh báo (đừng hardcode dịch vụ)**: `--notify <lệnh>` (hoặc env `TRAM_NOTIFY_CMD`). Khi mức
≥ 🟡, health-check chạy `<lệnh>` và **đẩy JSON kết quả qua stdin**; lỗi notify **không** làm hỏng giám
sát. Muốn bắn Telegram/webhook/email thì viết lệnh nhỏ đọc stdin — health-check không biết và không
cần biết đó là gì. Ví dụ để dành:

```bash
node scripts/tram-o-bo/health-check.mjs --run-marker … --notify "node D:\tram-o-bo\notify.mjs"
# notify.mjs đọc JSON ở stdin, tự quyết gửi đi đâu (webhook localhost, ghi Event Log, v.v.)
```

> **KHÔNG mở cổng ra ngoài** (đồng bộ [00 §2](00-tong-quan.md)): health-check chỉ **đọc** Ollama ở
> `127.0.0.1`. Nó không mở port, không nhận kết nối. Kênh cảnh báo là **đi ra** (trạm chủ động bắn),
> không phải mở cổng cho ai gọi vào.

---

## 5. Log + marker — để NGOÀI repo

Giống log vòng đêm ([03 §8.2](03-vong-dem-soan-goi.md)): mọi thứ health-check ghi ra nằm **ngoài cây
làm việc git**. CLAUDE.md §"Dữ liệu bản đồ trong git" cấm để `*.json`/`*.html` tạm ở gốc repo, và §"CẤM
file dữ liệu tạm trong cây làm việc" cấm bản nháp/kết quả dò trong repo — marker `last-run.json`, file
log health-check, JSON dò được đều thuộc nhóm đó.

| Thứ | Để đâu (đề xuất) | Xoay vòng / giữ |
|---|---|---|
| `last-run.json` | `D:\tram-o-bo\state\` | 1 file, vòng đêm **đè** mỗi lần (không đẻ `-v2` — CLAUDE.md §1 chống phình) |
| log health-check | `D:\tram-o-bo\logs\health.log` | xoay theo ngày/kích cỡ; giữ **~30 ngày** rồi dọn (nhẹ hơn log vòng đêm 90 ngày vì chỉ là trạng thái tức thời) |

Log health-check **không** chứa định danh bà con (nó chỉ đo trạng thái máy trạm, không chạm dữ liệu câu hỏi).

---

## 6. Tự kiểm — `--self-test`

Theo lệ `--self-test` của repo (`validate-brain-pack.mjs`, hook `.githooks/pre-commit`):

```bash
node scripts/tram-o-bo/health-check.mjs --self-test   # phải xanh (exit 0)
```

`--self-test` dựng marker giả (ok / lỗi / thiếu) + manifest giả (tươi / quá cũ) trong `os.tmpdir`,
**mock** Ollama/GPU/đĩa (không đụng phần cứng thật), rồi khẳng định phân mức đúng — trong đó có ca
**"Ollama chết nhưng mọi thứ khác tốt = VÀNG, KHÔNG leo ĐỎ"** (chốt chặn cho triết lý §1). Dọn tmp sau
khi chạy, không để rác trong repo. Hàm `assess()` là **thuần** (nhận input đã dò, trả rows + mức) nên
kiểm được không cần trạm thật.

---

## 7. Còn nợ / cần chốt

- **Nợ**: vòng đêm ([03](03-vong-dem-soan-goi.md)) hiện **chưa ghi** `last-run.json` — §3 đề xuất khuôn,
  cần bổ sung một dòng ghi marker cuối script vòng đêm khi nó được dựng thật trên trạm.
- **Nợ**: `--pack-manifest` trỏ tới manifest gói **mới nhất đã soạn** (ở thư mục work của trạm). Đường
  dẫn "latest" ổn định là quy ước vận hành, chốt cùng [01](01-cai-local-llm.md) khi bố trí thư mục trạm.
- **Cần chủ dự án quyết**: kênh cảnh báo thật (Telegram? webhook nội bộ? chỉ ghi log?) và ai nhận. Mặc
  định an toàn hiện tại: **chỉ ghi log + mã thoát**, chưa bắn đi đâu (`--notify` để trống) — đúng tinh
  thần "không khẩn".
- **Cân nhắc**: đọc độ cũ gói **đang phát hành** (khoá `app_config.assistant_pack_version`, [02](02-quan-tri-va-update.md))
  để so với gói đang soạn — cần service-role key trên trạm; chưa làm để tránh thêm request/nới bề mặt.

---

**Last updated**: 2026-09-12
