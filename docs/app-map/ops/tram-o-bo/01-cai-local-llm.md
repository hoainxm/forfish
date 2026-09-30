# Cài local LLM trên trạm (Ollama + qwen3.5:9b) — runbook Windows

> **Load khi / dùng khi**: đang ngồi trước **PC trạm** (Windows, RTX 3060 12GB) và cần cài
> Ollama + kéo model **qwen3.5:9b** để **soạn nháp** cho vòng đêm. Đọc tổng quan trước ở
> [`00-tong-quan.md`](00-tong-quan.md); vòng đêm dùng model này ở [`03-vong-dem-soan-goi.md`](03-vong-dem-soan-goi.md).

> **Đã kiểm nguồn 2026-09-11** (WebSearch/WebFetch: ollama.com, trang tags Qwen3, ghi chú phát hành Ollama,
> hướng dẫn cài Windows 2026); **cập nhật 2026-09-12** (ollama.com/library/qwen3.5 — chốt model `qwen3.5:9b`).
> Mọi **con số tốc độ/VRAM thực** đánh dấu **"đo trên PC thật"** — chưa chạy được
> ở phiên này (không đụng PC RTX 3060).

---

## 1. Kiểm GPU trước khi cài

RTX 3060 là kiến trúc **Ampere** (compute capability **8.6**) → Ollama CUDA nhận tốt, chỉ cần driver đủ mới.

```powershell
# 1. Xác nhận card + driver + VRAM
nvidia-smi
#   → phải thấy "NVIDIA GeForce RTX 3060", cột Memory 12288MiB, "Driver Version: 5xx.xx"
```

- **Driver tối thiểu**: NVIDIA **≥ 531** cho GPU compute ≥ 5.0 (RTX 3060 thoả). Nếu `nvidia-smi` không có hoặc
  driver cũ → cài/nâng driver NVIDIA (GeForce/Studio) rồi khởi động lại. (Kiểm 2026-09-11.)
- Nếu `nvidia-smi` chạy nhưng Ollama vẫn dùng CPU: xem §6 (sự cố GPU).

## 2. Cài Ollama (Windows)

Ollama có **installer Windows gốc** — không cần WSL, không Docker, không sửa PATH; chạy như app khay hệ thống + server nền.

1. Tải installer từ **ollama.com** (trang chủ, nút Download → Windows). *(Bản hiện hành khi kiểm 2026-09-11:
   dòng v0.32.x, phát hành ~7/2026; GPU CUDA nhận tự động.)*
   > ✅ **Đã cài trên trạm 2026-09-12**: Ollama **0.34.0** (winget `Ollama.Ollama`), server sống `127.0.0.1:11434`.
2. Chạy installer, để mặc định. Sau khi xong, mở PowerShell mới:

```powershell
ollama --version          # xác nhận đã cài
ollama serve              # nếu server nền chưa chạy (thường installer đã tự chạy dạng service)
```

3. Kiểm Ollama **thấy** GPU:

```powershell
# ở PowerShell khác, sau khi đã pull 1 model và chạy:
ollama ps                 # cột PROCESSOR phải ghi "GPU" (hoặc "100% GPU"), không phải "CPU"
```
Hoặc xem log server: dòng khởi tạo phải nhắc `CUDA` + "NVIDIA GeForce RTX 3060" + ~12GB. Nếu ghi "CPU" → §6.

## 3. Chọn model qwen3.5:9b cho RTX 3060 12GB

**Vì sao qwen3.5:9b**: đây là bản **mới nhất có cỡ ~9B** của họ Qwen (các series mới hơn — Qwen3.6 27B/35B,
Qwen3.8 lớn hơn nữa — **không có** bản 9B lọt 12GB). Model đa ngôn ngữ (có tiếng Việt), có **tool calling +
thinking + đa phương thức**; bản thân model **0 đồng**, chạy local hợp với "trạm ở bờ" (kiểm 2026-09-12).

**Tag Ollama thật** (trang `ollama.com/library/qwen3.5`, kiểm 2026-09-12):

| Tag | Mức lượng tử | Dung lượng tải | VRAM **trọng số** (Q4) | Ghi chú |
|---|---|---|---|---|
| `qwen3.5:9b` (= `qwen3.5:9b-q4_K_M`) | Q4_K_M | ~6,6 GB | ~6 GB | **mặc định**; 9,65B tham số; còn ~5 GB VRAM cho KV-cache → `num_ctx` lớn |
| `qwen3.5:4b` (= `qwen3.5:4b-q4_K_M`) | Q4_K_M | ~2,5 GB | ~2,5 GB | dự phòng cho máy yếu / cần thật nhanh (kiểm tag thật lúc cài) |

> VRAM thật = **trọng số + KV-cache (theo `num_ctx`) + đệm**. Với `qwen3.5:9b` (~6,6GB trọng số) trên 12GB còn
> **~5 GB** cho KV-cache/đệm → `num_ctx` **lớn** được. Trang model ghi ngữ cảnh tối đa tới **256K**, nhưng đó là
> trần lý thuyết — **đặt `num_ctx` thực dụng** (đủ 1 batch cụm) và **đo trần không tràn 12GB trên PC thật** (§5).

**Kéo model**:
```powershell
ollama pull qwen3.5:9b    # mặc định (khuyến nghị)
ollama pull qwen3.5:4b    # dự phòng cho máy yếu (tuỳ chọn)
```

### Khuyến nghị

- **Mặc định: `qwen3.5:9b` (Q4_K_M).** Vòng đêm là **batch, không cần độ trễ thấp** → ưu tiên **chất lượng nháp**.
  ~6,6 GB trọng số lọt 12GB **thoải mái**, còn nhiều VRAM cho `num_ctx`; VieNeu chạy **CPU** nên không tranh VRAM
  (xem [`00-tong-quan.md`](00-tong-quan.md) §5).
- **Dự phòng: `qwen3.5:4b` (Q4_K_M).** Chỉ khi máy yếu hơn 3060 / cần thật nhanh / phải chừa VRAM cho việc khác.
  Nháp từ bản 4B **kém hơn** → người duyệt để mắt kỹ hơn.

Căn cứ chọn = **bản Qwen mới nhất CÓ cỡ 9B lọt 12GB**: `qwen3.5:9b` (~6,6GB trọng số) là fit **an toàn, dư chỗ**
cho KV-cache trên 12GB — KHÔNG còn là "ranh giới OOM" như cỡ 14B trước đây. Không nhảy lên Qwen3.6/3.8 vì chúng
không có bản 9B và không lọt 12GB. **Đừng hứa** token/s cụ thể — đo ở §5.

## 4. Smoke test (thử 1 prompt tiếng Việt nghề cá)

```powershell
ollama run qwen3.5:9b
```
Rồi dán 1 prompt nghề cá, ví dụ:
> Ngư dân hỏi: "Mai ra khơi vùng Hoàng Sa có an toàn không?" Hãy viết 1 mục FAQ ngắn, tiếng Việt đời thường,
> dặn xem dự báo sóng/gió và tin bão, không hứa chắc chắn. Không cần suy nghĩ dài.

Kiểm mắt: câu trả lời **tiếng Việt tự nhiên**, không lẫn tiếng Trung/Anh, giọng **đời thường** (người dùng là
ngư dân 40–60 tuổi), **không bịa** độ chính xác. Gõ `/bye` để thoát.

**Đo token/s**:
- Cách nhanh: chạy `ollama run qwen3.5:9b --verbose "<prompt>"` → Ollama in **`eval rate: … tokens/s`** ở cuối. Đó là tốc độ sinh.
- Hoặc gọi API `POST http://localhost:11434/api/generate` với `"stream":false` → đọc `eval_count` / `eval_duration`
  (ns) → token/s = `eval_count / (eval_duration / 1e9)`.

> ✅ **ĐO THẬT trên PC trạm này (2026-09-12, Ollama 0.34.0, RTX 3060 12GB)**: prompt soạn FAQ nghề cá
> (có dấu, `think:false`, `num_ctx=4096`) → **53,8 token/s** sinh, 61 token vào / 111 token ra, tổng ~2,4 s.
> `ollama ps`: **`100% GPU`**, model 5,5 GB, KHÔNG tràn CPU. `nvidia-smi`: dùng ~8,7 GB / **còn trống ~3,4 GB**
> → lọt 12 GB thoải mái, còn dư nâng `num_ctx`. Câu trả lời đúng chủ đề, tiếng Việt tự nhiên, đúng ≤4 câu, không bịa số.
> ⚠️ Prompt phải **có dấu** — smoke test gõ không dấu ("ca ngu tuoi") làm model hiểu nhầm; vòng đêm luôn dùng tiếng Việt có dấu.

## 5. Cấu hình cho soạn-nháp offline, chạy 24/7

Ollama đọc **biến môi trường**. Trên Windows, đặt ở cấp **hệ thống** (để service nền thấy):
`Settings → System → About → Advanced system settings → Environment Variables` (hoặc `setx … /M` trong PowerShell **admin**).

| Biến | Giá trị khuyến nghị | Vì sao |
|---|---|---|
| `OLLAMA_HOST` | `127.0.0.1:11434` | **Chỉ nghe localhost** — không mở ra mạng (bảo mật, §bên dưới). Đây cũng là mặc định, đặt tường minh cho chắc. |
| `OLLAMA_KEEP_ALIVE` | `30m` (hoặc `-1` để giữ mãi) | vòng đêm gọi nhiều lần liên tiếp → giữ model trong VRAM đỡ nạp lại. `-1` = không bao giờ nhả (chỉ khi trạm chuyên chạy qwen3.5:9b). |
| `OLLAMA_MAX_LOADED_MODELS` | `1` | 12GB nên giữ 1 model cùng lúc; tránh Ollama nạp song song `qwen3.5:9b` + bản dự phòng gây tràn. |
| `OLLAMA_NUM_PARALLEL` | `1` | batch tuần tự ban đêm, không cần đa luồng; giữ VRAM ổn định. |

**`num_ctx` (độ dài ngữ cảnh)**: **KHÔNG** để mặc định thấp (Ollama mặc định **4096**). ✅ **ĐÃ ĐẶT 2026-09-30: env user `OLLAMA_CONTEXT_LENGTH=8192`** + khởi động lại Ollama — `ollama ps` báo `CONTEXT 8192`, `100% GPU`, 5,7 GB. Lý do: tầng mạng `/api/tro-ly` gọi qua endpoint **`/v1` chuẩn OpenAI, nơi Ollama KHÔNG nhận `num_ctx` theo request** — lời dặn + 7 tool + snapshot ≤8 KB vượt 4096 là bị CẮT NGẦM (trả lời sai mà không báo). Lời gọi `/api/chat` gốc (vòng đêm) vẫn đặt được per-request `"options":{"num_ctx": 8192}` hoặc trong Modelfile. Bắt đầu **8192**, tăng dần tới khi `ollama ps`
báo có phần **CPU** (tràn) thì lùi lại. **Đo trần `num_ctx` trên PC thật.**

**Lượng tử**: giữ **Q4_K_M** (tag mặc định ở trên) — cân bằng chất lượng/VRAM tốt nhất cho 12GB. Không tự ý lên Q8 (tràn).

**Chạy như service Windows 24/7**: installer Ollama đã đăng ký chạy nền khi đăng nhập. Để chạy **thật sự 24/7
không cần đăng nhập tay**, một trong hai:
- Bật **tự đăng nhập** + Ollama khởi động cùng user (đơn giản, hợp PC nhà chuyên dụng), **hoặc**
- Đăng ký `ollama serve` thành **Windows Service** bằng công cụ như **NSSM** (chạy dưới tài khoản có quyền GPU).
- Đặt **Power Options → Sleep = Never**, và tắt "USB selective suspend" nếu dùng ổ ngoài, để đêm không ngủ giữa chừng.

> ✅ **ĐÃ DỰNG THẬT trên trạm (2026-09-12, quyền user — KHÔNG admin)**:
> - Ollama **auto-start** sẵn qua Startup folder (`Ollama.lnk`) — chạy khi đăng nhập.
> - Env user đã đặt (`setx`): `OLLAMA_KEEP_ALIVE=30m`, `OLLAMA_MAX_LOADED_MODELS=1`, `OLLAMA_NUM_PARALLEL=1`, `OLLAMA_HOST=127.0.0.1:11434`.
> - Power AC Sleep = **Never** (đã sẵn).
> - Thư mục trạm ổn định: `%LOCALAPPDATA%\SDFish-Tram\` (`bin\` chứa bản copy các script chạy được, `logs\`, `drafts\`, `last-run.json`).
> - **2 scheduled task (user-level)**: `SDFish-Tram-Nightly` (hằng ngày 02:00 → `nightly-run.mjs`) + `SDFish-Tram-HealthCheck` (mỗi 30′ → `health-check.mjs`), wrapper `.cmd` có `chcp 65001` cho log UTF-8. Giám sát: [`09-giam-sat.md`](09-giam-sat.md).
> - **Còn nợ (cần admin)**: chạy service không-cần-đăng-nhập (NSSM) — hiện dựa vào phiên đăng nhập; task "run whether logged on or not" cần lưu mật khẩu/quyền cao. Và **cập nhật `bin\` khi script trong repo đổi** (copy lại) — hoặc trỏ task vào checkout ổn định sau khi merge.

### Bảo mật — CHỐT

- **Chỉ nghe `127.0.0.1`** (`OLLAMA_HOST` như trên). **KHÔNG** đặt `0.0.0.0`, **KHÔNG** port-forward/NAT/tunnel
  cổng 11434 ra Internet. Trạm là PC nhà — mở cổng LLM ra ngoài là mời tấn công (xem ranh giới ở [`00-tong-quan.md`](00-tong-quan.md) §2).
- Nếu cần gọi Ollama từ script trên **cùng máy** → dùng `http://127.0.0.1:11434`. Không cần auth vì không lộ ra ngoài.
- Không cắm secret/API key của SDFish vào trạm này; trạm không cần khoá Supabase ghi-đè — chỉ cần khoá **đọc hàng đợi**
  và **ghi nháp** theo đúng phạm vi tối thiểu (chi tiết phạm vi ở [`02-quan-tri-va-update.md`](02-quan-tri-va-update.md)).

## 6. Sự cố GPU thường gặp

- **`ollama ps` ghi CPU / log không thấy CUDA**: driver < 531 → nâng driver; hoặc GPU đang bị app khác chiếm hết VRAM
  (đóng game/trình duyệt nặng); hoặc model + `num_ctx` **vượt 12GB** → Ollama tự đẩy phần thừa ra CPU (giảm `num_ctx`
  — với `qwen3.5:9b` khó xảy ra vì trọng số chỉ ~6,6GB — hoặc dùng `qwen3.5:4b`).
- **Nạp model chậm lần đầu**: bình thường (đọc ~6,6GB từ ổ); lần sau `OLLAMA_KEEP_ALIVE` giữ trong VRAM.
- **Tràn khi ngữ cảnh dài**: hạ `num_ctx`, hoặc chuyển `qwen3.5:4b`. Kiểm bằng `ollama ps` (tỉ lệ GPU/CPU).

## 7. Bảng cấu hình khuyến nghị (chốt)

| Vai | Model (tag) | Lượng tử | `num_ctx` khởi điểm | VRAM ước (trọng số) | Dùng cho |
|---|---|---|---|---|---|
| **Mặc định** | `qwen3.5:9b` | Q4_K_M | 8192 (đo: 4096 dùng ~8,7 GB, còn ~3,4 GB để nâng) | ~5,5 GB nạp (+KV) | soạn nháp FAQ/ý định chất lượng cao, batch đêm |
| **Dự phòng** | `qwen3.5:4b` | Q4_K_M | 8192–16384 | ~2,5 GB (+KV) | máy yếu / cần nhanh / phải chừa VRAM |

Biến môi trường: `OLLAMA_HOST=127.0.0.1:11434`, `OLLAMA_KEEP_ALIVE=30m`, `OLLAMA_MAX_LOADED_MODELS=1`, `OLLAMA_NUM_PARALLEL=1`.
Đã đo: `qwen3.5:9b` @ num_ctx 4096 → **100% GPU, 53,8 tok/s, còn ~3,4 GB VRAM** (2026-09-12) — xem §4.

---

**Đã đo/chốt trên PC trạm (2026-09-12)** — xem [`09-giam-sat.md`](09-giam-sat.md) cho theo dõi liên tục:
- ✅ Ollama **0.34.0** đã cài (§2), server sống ở `127.0.0.1:11434`.
- ✅ **token/s** `qwen3.5:9b` = 53,8 (num_ctx 4096, 100% GPU, còn ~3,4 GB) — §4/§7. Trần `num_ctx` cao hơn còn dư VRAM để nâng (đo tiếp khi gom cụm lớn).

**Còn nợ**
- Cách chạy service 24/7 đã chọn (NSSM vs auto-login) + tài khoản chạy (§5) — đang dựng.
- Kiểm chất lượng tiếng Việt nghề cá bằng **bộ prompt thật** của SDFish (không chỉ 1 câu smoke test) trước khi tin dùng cho vòng đêm.
- Đo trần `num_ctx` khi gom cụm nhiều câu (num_ctx lớn) — chưa chạm ngưỡng tràn ở 4096.
