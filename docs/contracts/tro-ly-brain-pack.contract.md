# Contract — Gói não trợ lý "Sen Biển" (brain pack)

> Load khi: đóng/mở gói não, viết validator gói, dựng tab "Gói trợ lý" ở `/quan-tri`, hay sửa reader gói trong app. Single source of truth cho **định dạng GÓI NÃO có phiên bản** mà **Trạm học ở bờ** (producer) đóng, đội **SDVICO** phát hành qua `/quan-tri`, và **máy bà con** (consumer) tải rời qua Supabase Storage rồi tìm–trích offline. Sửa shape ở ĐÂY, KHÔNG chép sang code/nơi khác.
>
> Kiến trúc + lý do: [ADR 0010](../adr/0010-tro-ly-nghe-offline-wasm.md). Vòng đêm soạn nội dung: [ops/tram-o-bo/03-vong-dem-soan-goi.md](../app-map/ops/tram-o-bo/03-vong-dem-soan-goi.md). Quản trị + rollout: [ops/tram-o-bo/02-quan-tri-va-update.md](../app-map/ops/tram-o-bo/02-quan-tri-va-update.md). Nơi chứa gói: [ops/external-services.md](../app-map/ops/external-services.md) (hàng "Supabase Storage — gói trợ lý").

**Version**: v1 — 2026-09-11

---

## Kiến trúc

- Gói não = **một cây file bất biến** đặt ở **bucket public Supabase Storage** (CORS `GET`), **KHÔNG đi qua `public/sw.js`** (SW bỏ qua origin khác — [ADR 0010](../adr/0010-tro-ly-nghe-offline-wasm.md) §Context #2). App tải nền vào kho riêng `sdfish-tro-ly-v1` (client tự quản, không phải kho vỏ/tiles của SW).
- **Đổi gói NGUYÊN KHỐI**: app chỉ chuyển sang gói mới khi đã tải đủ MỌI file trong `manifest.json` và **kiểm sha256 khớp toàn bộ**; chưa đủ thì gói cũ dùng tiếp. Không có trạng thái "gói nửa vời".
- **Phiên bản có hai tầng, đừng lẫn**:
  1. `manifest.version` — số hiệu **cả gói**, tăng MỖI lần phát hành (kể cả chỉ sửa một câu). Đây là thứ `/quan-tri` ghi vào `app_config.assistant_pack_version` và app so để biết có gói mới.
  2. `vN` trong TÊN file (`intents.v1.json`) — số hiệu **shape** của riêng file đó, chỉ tăng khi cấu trúc đổi kiểu phá tương thích (xem §Compatibility). Nội dung đổi mà shape giữ nguyên thì tên file KHÔNG đổi.
- **`minAppVersion`**: app có version < mức này thì **không tải gói** (reader chưa hiểu shape mới) — gói cũ đang có vẫn chạy. Đây là van chặn để phát hành gói shape mới không làm hỏng app chưa cập nhật.

```
Trạm ở bờ  ── đóng gói (export-brain-pack.mjs) ──►  zip (manifest + brain/ + models/)
   │                                                    │ upload qua /quan-tri tab "Gói trợ lý"
   │                                                    ▼
   │                              server tính sha256 → sinh manifest → đẩy bucket
   │                                                    │ ghi app_config.assistant_pack_version + audit
   ▼                                                    ▼
   (nguồn nội dung: unansweredHashes + outbox)    Supabase Storage (public, CORS GET)
                                                        │ pretrip-auto 6h, có sóng
                                                        ▼
                                              máy bà con: tải nền → đủ hash → đổi khối
```

## Producer / Consumer

> Consumer/Producer mới: tự thêm dòng vào bảng này trong CÙNG đợt bắt đầu đọc/ghi.

| Hệ | Nơi | Vai trò |
|---|---|---|
| Trạm ở bờ (PC RTX 3060) | `scripts/tram-o-bo/export-brain-pack.mjs` | ĐÓNG gói: gom `brain/*.json` đã duyệt + `models/` → zip + tính sha256 |
| Trạm ở bờ | `scripts/tram-o-bo/validate-brain-pack.mjs` (có `--self-test`) | GÁC gói: kiểm shape theo contract này TRƯỚC khi cho phát hành |
| SDFish repo (bờ) | `scripts/tram-o-bo/phat-hanh-local.mjs` (2026-09-30) | PHÁT HÀNH LOCAL: mục kho có `duyet` + `scripts/tro-ly-giong/catalog.json` + mp3 → `public/tro-ly/` (dùng `buildManifest` + `validatePack` làm cổng) |
| SDFish `/quan-tri` (server) | tab "Gói trợ lý" + `POST /api/admin/assistant-pack` (P2 — **BỎ 2026-09-30**, gói local) | NHẬN zip → sinh `manifest.json` → đẩy bucket → ghi `app_config` + audit |
| SDFish app (client) | `src/lib/assistant/brain-pack.ts` ✅ | TẢI `/tro-ly/*` + kiểm sha256 + đổi khối (kho `sdfish-tro-ly-v1`); `BRAIN_READER_VERSION` so `minAppVersion` |
| SDFish app (client + server) | `src/lib/assistant/brain.ts` ✅ | ĐỌC `knowledge` (BM25 + cổng bằng chứng) + `answers` (map mp3). `intents` CHƯA đọc (bảng trong code vẫn là nguồn duy nhất) |
| SDFish máy chủ | `src/lib/assistant/server/tools.ts` tool `tra_kho` ✅ | ĐỌC `knowledge.v1.json` đã phát hành (nhúng lúc build) cho tầng mạng Qwen/Claude |

> **2026-09-30 — nơi chứa đổi thành `public/tro-ly/` đi theo bản deploy** (chủ dự án: "local thôi"), KHÔNG Supabase Storage. Mọi thứ khác trong contract giữ nguyên; §Trần dung lượng: gói hiện ~2,2 MB (không `models/`) — nếu sau này thêm `models/` (~50–70 MB) thì KHÔNG được để trong `public/` (hook trần 20 MB/file) → khi đó mới dựng Storage.

---

## Cây file trong gói

```
manifest.json                      # bảng kê + phiên bản (KHÔNG có phiên bản trong tên)
brain/
  intents.v1.json                  # mẫu câu + từ đồng nghĩa + cụm tên màn + hotwords STT
  answers.v1.json                  # câu trả lời cố định theo ý định + câu an toàn (+ mp3 tuỳ chọn)
  knowledge.v1.json                # kho FAQ ngư dân (tìm–trích BM25)
models/
  vad.onnx                         # cắt câu (Voice Activity Detection)
  stt-vi.wasm  stt-vi.data         # nghe tiếng Việt (sherpa-onnx zipformer-vi-30M-int8)
  tts-vi.wasm  tts-vi.data         # đọc dự phòng (piper vi, chỉ khi máy thiếu giọng Việt)
audio/                             # TUỲ CHỌN — mp3 giọng "Sen Biển" sinh sẵn (VieNeu)
  bac/<intentId>.mp3               #   giọng Bắc (Trúc Ly) — dùng cho cả Bắc + Trung
  nam/<intentId>.mp3               #   giọng Nam (Mỹ Duyên)
```

---

## `manifest.json`

```jsonc
{
  "version": "3",                  // BẮT BUỘC — số hiệu CẢ GÓI, tăng mỗi lần phát hành. Chuỗi số nguyên tăng dần
  "createdAt": "2026-09-11T02:00:00Z",   // ISO — lúc đóng gói ở trạm
  "minAppVersion": "1.8.0",        // BẮT BUỘC — app < mức này KHÔNG tải gói (semver, so theo số)
  "files": [                       // BẮT BUỘC — kê MỌI file (trừ chính manifest.json)
    { "path": "brain/intents.v1.json",   "sha256": "…64 hex…", "bytes": 18422 },
    { "path": "brain/answers.v1.json",   "sha256": "…",        "bytes": 20140 },
    { "path": "brain/knowledge.v1.json", "sha256": "…",        "bytes": 96311 },
    { "path": "models/vad.onnx",         "sha256": "…",        "bytes": 1836416 },
    { "path": "models/stt-vi.wasm",      "sha256": "…",        "bytes": 15623000 },
    { "path": "models/stt-vi.data",      "sha256": "…",        "bytes": 26214400 }
    // … đủ mọi file kể cả audio/*.mp3 nếu có
  ],
  "notes": "string?"               // ghi chú người-đọc: đổi gì so gói trước (không máy nào parse)
}
```

- `path` là đường **tương đối gốc gói**, dùng `/`, KHÔNG có `./` hay `../`, KHÔNG bắt đầu bằng `/`.
- `sha256` = băm THÔ của file (hex thường, 64 ký tự). App kiểm TỪNG file; **thiếu/lệch một file → HUỶ cả lượt tải, giữ gói cũ**.
- `bytes` = kích thước thật; client dùng để hiện tiến độ ("Đang tải 12/60 MB") và `estimate()` trước khi tải.
- App tính tổng `bytes` để quyết `requestPersistentStorage()`; tổng vượt chỗ trống máy → không tải, báo "máy thiếu chỗ".

## `brain/intents.v<N>.json`

Bồi cho bảng 31 ý định **đang compile trong code** (`src/lib/assistant/parse.ts`) — KHÔNG thay nó, chỉ THÊM mẫu câu / từ đồng nghĩa / cụm tên màn để khớp rộng hơn. Chưa có gói thì app chạy bằng bảng trong code (hành vi hôm nay không đổi).

```jsonc
{
  "version": "1",                  // khớp vN trong tên file
  "intents": [{
    "id": "hoi_thoi_tiet",         // BẮT BUỘC — PHẢI là một trong 31 mã ý định của parse.ts. Mã lạ → validator loại
    "mauCau": [                    // câu người ta hay nói cho ý định này (đã foldVn khi khớp)
      "thời tiết hôm nay thế nào", "mai ra khơi được không", "biển có động không"
    ],
    "tuDongNghia": [               // các nhóm từ coi như NHAU khi khớp (tuỳ chọn)
      ["sóng", "biển động"], ["gió", "trở gió"]
    ]
  }, {
    "id": "mo_man",                // ý định "mở màn X"
    "cumTenMan": [                 // cụm tên màn cho lệnh điều hướng (tuỳ chọn, chỉ ý định điều hướng)
      { "cum": ["ra khơi", "ngư trường", "đi biển"], "route": "/ngu-truong" },
      { "cum": ["giấy tờ", "tủ giấy"],                "route": "/tau?tab=giay-to" }
    ]
  }],
  "hotwords": [                    // TUỲ CHỌN — từ ngành đẩy điểm cho STT (sherpa-onnx)
    { "tu": "Yanmar", "score": 1.5 }, { "tu": "nhớt", "score": 1.5 }
    // ⚠️ LUẬT (ADR 0010 P0d): score ≤ 1,5; CẤM hotword TRÙNG ÂM với từ thường dùng
    //    ("Biển Đông" biến "biển động cấp mấy" → "Biển Đông cấp mấy"). Mỗi từ thêm PHẢI
    //    chạy lại bộ 25 câu đọc→nghe trước khi vào gói. Validator cảnh báo score > 1,5.
  ]
}
```

## `brain/answers.v<N>.json`

Câu trả lời **cố định** (không số sống) cho ý định máy đã hiểu, + các câu an toàn dùng chung.

```jsonc
{
  "version": "1",
  "answers": [{
    "intentId": "hoi_giay_to",     // BẮT BUỘC — mã ý định (31 mã của parse.ts)
    "text": "Bác vào Tàu cá › Giấy tờ để xem giấy nào sắp hết hạn.",  // ≤ vài câu, KHÔNG số biến động
    "mp3": {                       // TUỲ CHỌN — đường dẫn mp3 giọng sinh sẵn (VieNeu), tương đối gốc gói
      "bac": "audio/bac/hoi_giay_to.mp3",   // Trúc Ly (Bắc+Trung)
      "nam": "audio/nam/hoi_giay_to.mp3"    // Mỹ Duyên (Nam)
    }
  }],
  "cauAnToan": {                   // BẮT BUỘC — câu app gắn ở các nhánh chuẩn
    "khongHieu": "Việc này tôi chưa có trong máy. Bác hỏi tôi thời tiết, bão, giấy tờ, giá cá, hay mở màn.",
    "daiDuyenHai": "Bão gió thì bác nghe thêm đài duyên hải hoặc Icom cho chắc."
  }
}
```

**LUẬT nội dung (BẤT BIẾN):**
- **KHÔNG nhét SỐ SỐNG** (giá cá, giá dầu, cấp gió, độ cao sóng, giờ con nước…) vào `text`/`traLoi`. Số sống CHỈ đến từ **snapshot trong máy** (`DeviceSnapshot`) do `answer.ts` chèn lúc chạy. Gói chỉ chứa câu KHUNG.
- Câu an toàn "nghe đài duyên hải" là **`cauAnToan.daiDuyenHai`** — do `answer.ts` gắn vào câu bão/thời tiết, KHÔNG viết lẫn vào từng `answers[].text`.
- `mp3` chỉ cho câu **CỐ ĐỊNH đúng nguyên văn `text`**. Câu có số sống → đọc bằng piper/Web Speech lúc chạy, KHÔNG pre-bake. Đổi `text` thì PHẢI sinh lại mp3 (validator kiểm cặp text↔mp3 còn khớp bằng cờ, xem §Còn nợ).

## `brain/knowledge.v<N>.json`

Kho FAQ ngư dân để **tìm–trích** (BM25 nhỏ trên `tuKhoa`+`cauHoiMau` đã `foldVn`, không embedding, không thư viện mới). Máy KHÔNG sinh chữ — chỉ trả đúng `traLoi` + ghi nguồn.

```jsonc
{
  "version": "1",
  "muc": [{
    "id": "bao-quan-ca-ngu",       // BẮT BUỘC — slug ổn định (a-z 0-9 -), duy nhất trong file
    "cauHoiMau": [                 // BẮT BUỘC ≥1 — câu hỏi mẫu, dùng để khớp
      "cách bảo quản cá ngừ", "ướp cá ngừ sao cho tươi"
    ],
    "tuKhoa": ["bảo quản", "cá ngừ", "ướp đá"],  // BẮT BUỘC ≥1 — từ khoá cho BM25
    "traLoi": "Ướp đá ngay khi cá lên, tỉ lệ đá/cá tuỳ chuyến. Giữ hầm kín, tránh nắng. Cá lớn moi ruột trước khi ướp.",
    // BẮT BUỘC — ≤ 4 CÂU, KHÔNG số biến động (giá/thời tiết), giọng đời thường không jargon
    "nguon": "Trung tâm Khuyến nông Quốc gia — tài liệu bảo quản hải sản",  // BẮT BUỘC — nguồn THẬT
    "ngaySoat": "2026-09-01",      // BẮT BUỘC — ISO date người duyệt soát gần nhất
    "chipMoMan": "/ngu-truong"     // TUỲ CHỌN — route chip "mở màn liên quan" dưới câu trả lời
  }]
}
```

**LUẬT nội dung kho (BẤT BIẾN — gác ở validator, chặn phát hành):**
- **Mọi mục PHẢI có `nguon` + `ngaySoat`.** Không nguồn = không vào gói. Câu trả lời hiện kèm "Theo tài liệu SDVICO soát {tháng/năm}".
- **KHÔNG y tế, KHÔNG pháp lý, KHÔNG tiền bạc cá nhân** (INT-26 của `parse.ts` vẫn chặn trước; kho là hàng rào thứ hai). Cứu người/bệnh → chuyển "gọi 115 / gọi SDVICO", không tự khuyên.
- `traLoi` ≤ 4 câu; không số biến động; là **trích tài liệu đã duyệt**, không phải văn AI tự sinh (nội dung do người duyệt — xem [03-vong-dem-soan-goi.md](../app-map/ops/tram-o-bo/03-vong-dem-soan-goi.md)).

## `models/`

Phần NẶNG của gói — nhị phân sherpa-onnx + model. Kích thước dưới đây **đo P0 trên PC 2026-09-07** ([ADR 0010](../adr/0010-tro-ly-nghe-offline-wasm.md) §P0); **đo lại lúc đóng gói thật** rồi ghi vào `manifest.files[].bytes` (đừng chép số này làm số thật).

| File | Là gì | Dung lượng (đo P0, tham khảo) |
|---|---|---|
| `models/stt-vi.wasm` | WASM sherpa-onnx (offline recognizer + VAD + TTS C API) | **14,9 MB** (đo thật, không phải ~10 MB như docs) |
| `models/stt-vi.data` | Trọng số zipformer-vi-30M-int8 + `bpe.model` + `bpe.vocab` (sinh bằng `sentencepiece`) | ~25 MB |
| `models/vad.onnx` | Silero VAD cắt câu | ~1,8 MB |
| `models/tts-vi.wasm` / `.data` | piper `vi_VN-vais1000` int8 + `espeak-ng-data` ĐÃ CẮT còn tiếng Việt (9 file, 0,72 MB — bỏ 113 ngôn ngữ khác) | phần đọc **≈ 63,9 MB** tổng |

- **Đường lấy/build**: `scripts/build-tro-ly-wasm.sh` + `fetch-assets.sh` (P0, ADR 0010). Bộ lọc espeak nằm trong `fetch-assets.sh` (`ESPEAK_KEEP_ALL=1` để đối chứng).
- Model đổi rất chậm — **tách nhịp với `brain/`**: mỗi lần bump gói KHÔNG nhất thiết đổi `models/`; nếu 3 file model giữ nguyên sha256 thì app đã có sẵn, tải khối mới chỉ kéo phần `brain/` đổi. (Client so sha256 từng file, file trùng thì bỏ qua — xem [02-quan-tri-va-update.md](../app-map/ops/tram-o-bo/02-quan-tri-va-update.md) §Nhịp máy khách.)
- Giấy phép: sherpa-onnx / zipformer-vi / piper vi đều Apache-2.0 (đóng gói thương mại OK) — ghi ở NOTICE app khi land ([ADR 0010](../adr/0010-tro-ly-nghe-offline-wasm.md) A6).

## `audio/` — mp3 giọng "Sen Biển" (TUỲ CHỌN)

- Sinh ở bờ bằng **VieNeu-TTS** (`scripts/tro-ly-giong/`, [README](../../scripts/tro-ly-giong/README.md)) — thay OmniVoice, chốt 2026-09-08. Hai giọng: `bac` (Trúc Ly, Bắc+Trung), `nam` (Mỹ Duyên, Nam).
- Chỉ cho **câu CỐ ĐỊNH** trong `answers[].text`. Đo 2026-09-08: mp3 24kHz mono 64k ≈ **0,66 MB/giọng cho 23 câu** — nhẹ, nhưng vẫn tính vào tổng tải.
- **Có đưa mp3 vào gói hay không là quyết định phát hành, không phải luật contract**: gói KHÔNG có `audio/` thì app đọc bằng piper/Web Speech (vẫn chạy). Xem §Cần chủ dự án quyết.

---

## Compatibility rules

| Loại đổi | Ví dụ | Phải làm |
|---|---|---|
| **Nội dung** (không đổi shape) | thêm mục kho, sửa `traLoi`, thêm `mauCau`, thêm mp3 | **Chỉ bump `manifest.version`.** Tên file `vN` GIỮ NGUYÊN. Reader cũ đọc bình thường |
| **Non-breaking shape** | thêm field TUỲ CHỌN mới | Giữ `vN`. Reader cũ bỏ qua field lạ. Không bump `minAppVersion` |
| **Breaking shape** | đổi tên/xoá field bắt buộc, đổi type, đổi nghĩa `intents[].id`, đổi cách BM25 đọc `tuKhoa` | Bump **`vN`** của file đó (`intents.v1`→`intents.v2`) **+ bump `minAppVersion`** + sửa reader (`brain.ts`) CÙNG ĐỢT + cập nhật §Change log |

- `minAppVersion` là **van một chiều**: nâng khi shape phá tương thích; app cũ hơn không tải, gói cũ vẫn phục vụ tới lúc bà con cập nhật app. Đừng nâng `minAppVersion` cho đổi nội dung — sẽ khoá oan máy cũ khỏi bản kho mới.
- Reader gặp `manifest.version` mới nhưng file có `vN` reader CHƯA hiểu (lỗi phát hành sai `minAppVersion`) → **KHÔNG đổi gói, giữ gói cũ**, không crash. Validator + van `minAppVersion` để chuyện này không xảy ra.
- Thiếu file TUỲ CHỌN (`audio/`, `chipMoMan`, `mp3`) là HỢP LỆ — ẩn tính năng tương ứng, KHÔNG suy diễn.

## Trần dung lượng

- Gói ở **Supabase Storage**, KHÔNG chịu trần git của [CLAUDE.md §"Dữ liệu bản đồ trong git"](../../CLAUDE.md) (một file `public/data/**` > 20 MB / thư mục > 120 MB). Nhưng `models/stt-vi.data` (~25 MB) và tổng gói (~50–70 MB) VƯỢT các mốc đó — nếu ai lỡ để gói vào `public/data/` thì hook chặn đúng. **Gói phải ở Storage, không phải `public/`.**
- **Đo dung lượng TẢI VỀ MÁY bà con** vẫn là ràng buộc thật: chốt [ADR 0010](../adr/0010-tro-ly-nghe-offline-wasm.md) Option E — **~50–70 MB một lần, chấp nhận** (tải ở bờ/Wi-Fi, đổi khối). Vượt ngưỡng này đáng kể (vd model to hơn) → cân nhắc lại, ghi lý do vào `manifest.notes` + hỏi chủ dự án.
- Nén khi truyền không đáng kể cho `models/` (trọng số int8 gần ngẫu nhiên); `brain/*.json` thì Storage nén gzip sẵn.

---

## Còn nợ

- **Cờ text↔mp3 khớp**: validator hiện chỉ kiểm mp3 tồn tại đúng đường; chưa kiểm mp3 đọc ĐÚNG `text` hiện tại (đổi `text` quên sinh lại mp3 → giọng lệch chữ). *nợ: thêm băm `text` vào cạnh mp3 (`answers[].mp3.textHash`), validator so — nâng khi bật mp3 trong gói phát hành.*
- **Kiểm mã ý định chéo `parse.ts`**: validator cần danh sách 31 mã ý định để loại mã lạ trong `intents`/`answers`. *nợ: xuất danh sách mã từ `parse.ts` ra `brain/intent-ids.json` (sinh lúc build app), validator đọc — làm ở P1 khi `parse.ts` ổn định.*

## Cần chủ dự án quyết

1. **mp3 giọng trong gói hay tải rời**: đưa `audio/*.mp3` vào chính gói (đổi khối cùng `brain/`, tăng ~1,3 MB/23 câu × 2 giọng) hay tách gói giọng riêng (đổi độc lập)? Contract hỗ trợ CẢ HAI (mp3 tuỳ chọn); mặc định đề xuất **trong gói** cho đơn giản (một manifest, một lần đổi khối). Chờ chốt.
2. **Định dạng nén khi phát hành**: upload lên `/quan-tri` dạng **zip** (brief + P2 chốt zip). Server giải nén, tính sha256 từng file, đẩy bucket dạng file rời (client tải từng file để đổi khối theo sha256). Xác nhận: bucket giữ **file rời**, KHÔNG giữ nguyên zip (client cần tải chọn lọc file đổi).
3. **Số hiệu migration `app_config`**: brief/ADR ghi "0015 đã có bảng", nhưng bảng `app_config` thật ở **`supabase/migrations/0022_app_config.sql`** (0015 là `crew_reports_phone`). Hai khoá mới `assistant_pack_version` + `assistant_online_enabled` chỉ là **hàng dữ liệu**, KHÔNG cần migration mới (bảng đã có). Ghi đúng số 0022 ở đây để người sau khỏi tìm nhầm.

## Change log

| Ngày | Version | Thay đổi |
|---|---|---|
| 2026-09-30 | v1.1 (non-breaking) | Consumer đầu tiên land (`brain.ts`, `brain-pack.ts`, `tra_kho`). `answers[].id` TUỲ CHỌN (mã câu catalog — một ý định có nhiều câu cố định); `answers[].text` = ĐÚNG câu app đọc (`reply.speak`) vì là khoá tra mp3. Nơi chứa = `public/tro-ly/` (local). Không bump `vN`, không bump `minAppVersion` (reader 1.0.0). |
| 2026-09-11 | v1 | Khởi tạo contract: `manifest.json` + `intents.v1`/`answers.v1`/`knowledge.v1` + `models/` + `audio/` tuỳ chọn. Luật nội dung (không số sống / không y tế-pháp lý-tiền / đủ nguồn + ngày soát). Luật bump hai tầng (`manifest.version` mỗi phát hành, `vN` khi phá shape) + van `minAppVersion`. Chưa có consumer `src/` (P1/P2 ADR 0010 chưa dựng) — chốt shape trước. |
