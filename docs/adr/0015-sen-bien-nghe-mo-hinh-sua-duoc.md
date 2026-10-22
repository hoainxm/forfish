# ADR 0015 — Sen Biển nghe: đổi sang mô hình MÌNH ĐƯỢC SỬA (zipformer 70.000 giờ, Apache-2.0) và tinh chỉnh bằng dữ liệu Sen Biển

**Status**: Accepted (2026-10-22) — chủ dự án: *"thay bản zipformer đi"*. Chọn đường (b) dưới §Hệ quả: thay ngay bằng bản **tinh chỉnh vòng 2** (`public/data/sen-bien-nghe.v2.bin`, 79 MB), commit mang dòng `data-budget:`; chưa thử giọng bà con thật trước khi thay (chủ dự án bỏ bước này) ⇒ theo dõi qua mẫu câu §23 và giữ đường (a) chưng cất.
**Date**: 2026-10-19
**Deciders**: chủ dự án (đề bài: "mạnh luôn", lớp nghe phải train thêm được cho quen giọng bà con)
**Liên quan**: [ADR 0011](0011-sen-bien-nghe-trong-may-zipformer-wasm.md) (đang dùng 30M, CC-BY-NC-ND)

---

## Khuyến nghị một câu

**Đổi sang zipformer 70.000 giờ (zzasdf, Apache-2.0) đã tinh chỉnh bằng câu Sen Biển + tiếng máy tàu**: nó hơn bản 30M đang dùng trên hai bộ giọng máy đọc (rõ nhất ở giọng miền Trung và tên Hoàng Sa, Trường Sa) và chỉ kém một chút trên người thật đọc rõ (sai chữ 12,6 % so với 12,0 %). Nó là bản mình được quyền sửa và train tiếp, cái giá là file 34 → 79 MB và chậm hơn khoảng 1,5 lần. Nên cho chủ dự án thử bằng giọng thật trước khi thay.

## Context / Bối cảnh

ADR 0011 chọn `zipformer-vi-30M-int8` (hynt). Mô hình này giấy phép **CC-BY-NC-ND 4.0**: ND = cấm sửa, nên **không được tinh chỉnh**. Vậy mà Sen Biển cần tinh chỉnh: tiếng máy tàu, giọng ba miền của người 40–60 tuổi, và vốn từ khoảng 2.000 câu hỏi. Luật dự án (CLAUDE.md, mục Nguồn dữ liệu): "phi thương mại" không chặn tính năng miễn phí, nhưng **ND thì chặn việc tinh chỉnh**. Nguồn nào bắt ghi tên Trung Quốc cho Biển Đông thì loại.

## Ứng viên và giấy phép

| Mô hình | Cỡ trong app | Giấy phép MÔ HÌNH | Dữ liệu train (giấy phép) | Sửa / train tiếp? |
|---|---|---|---|---|
| **30M** hynt (đang dùng) | 34 MB | CC-BY-NC-ND 4.0 | khoảng 6.000 giờ, thẻ mô hình không ghi nguồn | **Không** (ND) |
| **70.000 giờ** zzasdf `viet_iter3_pseudo_label` | 74 MB (tinh chỉnh: 79 MB) | **Apache-2.0** | thẻ mô hình để trống; tên gợi ý là nhãn giả (pseudo-label), nhiều khả năng từ GigaSpeech2-vi (dữ liệu chỉ cho nghiên cứu, nhưng trang GigaSpeech2 ghi giấy phép mô hình độc lập với dữ liệu) | **Được**. Có cả checkpoint `.pt` để train tiếp |
| Moonshine base-vi | 135 MB | Moonshine AI Community License | 94.200 giờ từ internet + bộ mở | Được, nhưng giấy phép **mất hiệu lực khi doanh thu > 1 triệu USD/năm**, phải đăng ký, và họ có quyền thu hồi |
| PhoWhisper tiny / base (VinAI) | 39M / 74M tham số | BSD-3 (HF) / Apache-2.0 (GitHub) | 844 giờ, có VIVOS (CC-BY-NC-SA) | Được |
| Dolphin base / small (DataoceanAI) | 100 / 239 MB | Apache-2.0 | có dữ liệu riêng của DataOcean | Được |
| Omnilingual 300M (Meta) | 349 MB | Apache-2.0 | corpus CC-BY-4.0 | Được |
| Parakeet-CTC 0.6B-vi (NVIDIA) | khoảng 600 MB | NVIDIA Open Model License (cho thương mại + sửa) | hơn 4.000 giờ | Được. **Không đo**: quá to cho điện thoại |
| Qwen3-ASR 0.6B, Cohere Transcribe, Fun-ASR-Nano | 0,8–1,6 GB | Apache-2.0 | — | Quá to cho app. Có thể làm **thầy** gán nhãn sau này |

Dữ liệu dùng để tinh chỉnh: **VieNeu-TTS v3 Turbo** (Apache-2.0) đọc câu, **FLEURS vi** (CC-BY-4.0) cho giọng người thật. Không nguồn nào ở trên bắt ghi tên Trung Quốc cho Biển Đông.

## Bộ đo

1. **Bộ cũ (ADR 0011)**: 70 câu lệnh bản đồ, giọng máy macOS "Linh", 4 kiểu thu (sạch / nói nhanh / máy tàu 10 dB / 5 dB) = 280 câu. Chấm **đúng việc** bằng chính `senBienReply` (hieu-y.ts chụp từ HEAD ngày 19/10). Trần thật là **276/280**: câu "tới Cồn Cỏ đi em" đưa đúng chữ vào vẫn sai việc.
2. **Bộ ba miền (mới)**: cùng 70 câu, đọc bằng 5 giọng VieNeu **không dùng để train** (Bắc nữ Đoan Trang, Bắc nam Quốc Tuấn, Trung nam Quang Sơn, Nam nam Thái Sơn, Nam nữ Kim Thanh) × sạch / máy tàu 10 dB / 5 dB = 1.050 câu.
3. **FLEURS vi test**: 686 câu người thật đọc (bỏ câu có chữ số). Đo sai chữ, để biết mô hình có **quên** tiếng nói thường không.
4. **Chủ quyền**: 8 câu có Hoàng Sa, Trường Sa, Biển Đông, Song Tử Tây, Phú Quốc × 5 giọng = 40 câu. Đếm câu nghe đúng hết các tên đó.

Mọi mô hình đều giải mã bằng sherpa-onnx 1.13.8, CPU một luồng (giống WASM trong app). Mô hình transducer dùng tên ưu tiên (hotwords, điểm 2,5), như app. CTC, Moonshine và Whisper không có hotwords.

## Số đo (2026-10-19)

| Mô hình | Bộ cũ "Linh" đúng việc /280 | Bộ ba miền đúng việc | Sai chữ ba miền | FLEURS sai chữ | Chủ quyền /40 |
|---|---|---|---|---|---|
| **30M + tên ưu tiên (đang dùng)** | 268 | 84,8 % | 15,6 % | **12,0 %** | 27 |
| 70.000 giờ + tên ưu tiên (gốc) | 251 | 82,8 % | 15,2 % | 13,3 % | 31 |
| Moonshine base-vi | 201 | 62,0 % | 39,8 % | 84,6 % ⚠️ | — |
| PhoWhisper-base | 225 | 68,8 % | 31,4 % | — | — |
| PhoWhisper-tiny | 225 | 65,5 % | 31,2 % | — | — |
| Dolphin small / base | 172 / 157 | — | — | — | — |
| Omnilingual 300M | 140 | — | — | — | — |
| 70.000 giờ **tinh chỉnh vòng 1** (lượt 3) | 263 | 93,3 % | 3,9 % | 12,7 % | 37 |
| **70.000 giờ tinh chỉnh vòng 2 (lượt 3)** | **273** | **94,6 %** | **2,7 %** | 12,6 % | **39** |

Theo vùng giọng (bộ ba miền, mỗi giọng 210 câu), 30M → tinh chỉnh vòng 2: Bắc nữ 194 → 201 · Bắc nam 188 → 205 · **Trung nam 140 → 187** · Nam nam 169 → 196 · Nam nữ 199 → 204. Giọng miền Trung được nhiều nhất.

Tốc độ (Node + WASM sherpa-onnx, Mac, một luồng, 30 câu máy tàu 5 dB): 30M nạp 0,7 s, **97 ms/câu**. 70.000 giờ gốc nạp 1,0 s, **142 ms/câu**, RAM tiến trình 508 MB so với 427 MB. Đo lại cả ba cùng một lúc (lúc Mac đang bận nên số chậm hơn): 30M 263–277 ms, 70.000 giờ gốc 373–379 ms, **bản tinh chỉnh 336–355 ms**. Vậy bản tinh chỉnh chạy nhanh như bản gốc, chậm hơn 30M khoảng 1,3–1,5 lần. Điện thoại tầm trung đoán khoảng 0,7–1 s/câu.

⚠️ Moonshine base-vi: sai chữ trên FLEURS 84,6 %, trái với số 13 % trong thẻ mô hình (bản tiny). Nhiều khả năng do bản chuyển sang sherpa (lặp chữ ở đuôi câu). Không đào sâu, vì giấy phép có trần doanh thu và không có hotwords.

### Đọc số cho thật thà

- **Bộ ba miền thổi phồng phần lợi của bản tinh chỉnh.** Giọng đo khác giọng train, nhưng **cùng máy đọc VieNeu**, nên mô hình đã quen kiểu phát âm của máy đó. Hai thước sạch hơn là **bộ "Linh"** (máy đọc khác hẳn: 268 → 273, gần trần 276) và **FLEURS** (người thật: 12,0 % so với 12,6 %, tức **kém 30M một chút**, nhưng tốt hơn bản 70.000 giờ gốc 13,3 %).
- Tiếng máy tàu trong dữ liệu train là bộ sinh **khác** bộ đo (tần số máy 14–40 Hz ngẫu nhiên, ồn hồng, sóng vỗ), để mô hình không học thuộc tiếng ồn của bộ đo. Câu đo không có trong dữ liệu train. Nhưng tên 25 cảng trong bộ đo **có** trong câu train, vì app vốn biết danh sách cảng.
- Chọn lượt cuối (lượt 3) đã chốt từ trước. Lượt 1 của vòng 2 đẹp hơn (276/280), nhưng không lấy, để khỏi chọn theo bộ đo.
- **Chưa có giọng bà con thật, chưa có tiếng máy tàu thật.** Đây vẫn là nợ lớn nhất, như ADR 0011.

## Đã làm gì để tinh chỉnh

- Dữ liệu (18,7 giờ, 20.479 mẫu): 3.544 câu (3.200 câu từ bộ hiểu ý `forfish-troly-v1` + lệnh cho 172 cảng) và 668 câu vòng 2 (toạ độ, số, lệnh ngắn). Mỗi câu đọc bằng 2–3 giọng trong 20 giọng VieNeu không dùng để đo, có bản sạch và bản trộn máy tàu (−2 đến 15 dB, đổi tốc độ 0,88–1,12). Cộng 2.295 câu FLEURS train để không quên giọng người.
- icefall zipformer, mở từ checkpoint `epoch-12-avg-8.pt`. ScaledAdam lr 0,002, SpecAugment, 3 lượt, khoảng 6–11 phút mỗi lượt trên RTX 3060, VRAM 3,8 GB. Xuất ONNX int8 bằng `export-onnx.py`, giống bản sherpa gốc.
- Vòng 1 lộ hai lỗ: thiếu câu đọc số ("mười hai độ" ra "hai độ") và từ ngắn bị kéo về tiếng miền ("không" ra "hông", "im đi" ra "kiếm đi"). Vòng 2 thêm câu số và lệnh ngắn, nên đã hết lỗi số. Còn lại: "Quy Nhơn" ra "Quảng Nhơn" (bản gốc vốn vậy), và "đi" ra "nì" ở 5 dB.
- Mọi thứ nằm trên gpu-desktop `~/.local/forlife/train/sen-bien-nghe/` (ft.py, vong2.sh, xuat.sh, cham.sh, models/ft-ft2-e3). Ngoài repo.

## Decision / Quyết định (đề xuất)

1. Thay `public/data/sen-bien-nghe.v1.bin` bằng bản **70.000 giờ tinh chỉnh vòng 2** (đóng gói bằng `scripts/build-sen-bien-nghe.mjs`, cùng định dạng, không phải dựng lại WASM). Giữ tên ưu tiên + khớp gần như cũ.
2. Từ nay lớp nghe là **của Sen Biển**: Apache-2.0 cho phép sửa và phân phối, chỉ cần giữ NOTICE + ghi nguồn zzasdf.
3. **Trước khi thay**: chủ dự án và vài bà con thử giọng thật trên máy (ghi lại bằng mẫu câu doc 15 §23). Nếu giọng thật kém 30M thì giữ 30M, và vòng sau train thêm bằng chính các mẫu giọng thật đó.

## Alternatives considered / Phương án đã cân nhắc

- **Giữ 30M:** nghe tốt nhất trên người thật đọc rõ (FLEURS 12,0 %), nhỏ và nhanh nhất, nhưng **không bao giờ train thêm được**. Trên giọng miền Trung chỉ đúng 140/210.
- **Xin hynt giấy phép thương mại + quyền sửa:** sạch nhất nếu hynt đồng ý, nhưng phụ thuộc người khác. Vẫn nên hỏi song song.
- **Moonshine / PhoWhisper / Dolphin / Omnilingual:** kém rõ trên mọi bộ đo, không có hotwords, Whisper giải mã từng chữ nên chậm trên WASM. Loại.
- **Parakeet 0.6B, Qwen3-ASR 0.6B:** quá to cho điện thoại. Giữ làm **thầy gán nhãn** cho vòng chưng cất (xem Hệ quả).

## Consequences / Hệ quả

- **Dung lượng git**: 79 MB thay 34 MB, `public/data` từ khoảng 100 MB lên khoảng 145 MB, **vượt trần 120 MB** (CLAUDE.md, mục chống phình). Bản 34 MB cũ vẫn nằm trong lịch sử git mãi mãi. Hai đường:
  (a) **chưng cất** bản tinh chỉnh xuống một zipformer cỡ 30M, train từ đầu bằng nhãn của nó trên dữ liệu được phép. Mất vài ngày GPU, nhưng ra mô hình nhỏ, nhanh và **của mình hoàn toàn**. Đây là đường nên đi tiếp.
  (b) thay ngay, ghi `data-budget:` trong commit, chấp nhận vượt trần tạm thời.
- **Máy bà con**: tải thêm khoảng 34 MB một lần (gzip: 60 MB so với 26 MB). Giải mã chậm hơn khoảng 1,5 lần, RAM worker tăng khoảng 80 MB.
- **Rủi ro giấy phép còn lại**: zzasdf không công bố dữ liệu train. Nếu đó là GigaSpeech2 (điều khoản dữ liệu: chỉ cho nghiên cứu) thì mô hình vẫn mang giấy phép Apache riêng, nhưng nguồn gốc dữ liệu chưa rõ. Rủi ro này thấp hơn hẳn ND (ND cấm sửa rõ ràng). Nên hỏi zzasdf.
- **Việc cho bộ hiểu ý** (phiên khác): bộ nghe có lúc trả "hông" thay "không", "nì" thay "đi". `hieu-y.ts` nên coi "hông" = "không".
- **Vòng train sau**: dữ liệu giọng thật từ mẫu câu §23 (khi bà con đồng ý) + tiếng máy tàu thu thật. Bộ đo cần thêm một bộ **giọng người thật**, không chỉ giọng máy đọc.

## Cập nhật 2026-10-22 — đã thay

- `scripts/build-sen-bien-nghe.mjs <thư mục> 2 <tên> <nguồn>` đóng gói `models/ft-ft2-e3` (gpu-desktop) thành `sen-bien-nghe.v2.bin` 79,1 MB; phần đầu JSON mang `model` + `nguon` (ghi công zzasdf, Apache-2.0) — test `nghe-may.test.ts` khoá. Bản v1 (30M, hynt) bị xoá khỏi cây (vẫn trong lịch sử git).
- Đổi TÊN bản (v1 → v2) vì service worker giữ `/data` cache-first: máy đã có v1 sẽ tải v2 khi mở Sen Biển lúc có sóng; chưa tải xong thì vẫn dùng Web Speech như cũ (không có máy nào "mất nghe").
- `public/data` 104,8 → ~148 MB (trần 120) — `data-budget:` trong commit. Tải thêm cho bà con: 79 MB một lần (gzip ~60 MB) thay 34 MB.
- Việc kèm còn mở: `hieu-y.ts` coi "hông" = "không" (bộ mới hay kéo về tiếng miền); chưng cất về cỡ 30M (đường a) để trả lại dung lượng.

