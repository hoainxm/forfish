# ADR 0011 — Sen Biển nghe TRONG MÁY: zipformer tiếng Việt chạy WASM, mô hình nằm trong git

**Status**: Accepted
**Date**: 2026-10-16
**Deciders**: chủ dự án ("hoàn thiện cái stt offline đi" · "để trong git, nới trần" · "30m nó mở cho free… làm tốt hơn bản gốc thì nó là bản của sen biển" — 2026-10-16)

---

## Context / Bối cảnh

Sen Biển (doc 15 §17) nghe bằng Web Speech API. Ba sự thật:

1. Chrome Android và Safari iOS gửi tiếng lên máy chủ Google/Apple. **Mất sóng là điếc**, mà ngoài biển mất sóng là chuyện thường.
2. **Android WebView (bản Capacitor) không có Web Speech.** Nhóm người dùng đông nhất không nói được với Sen Biển.
3. Bộ hiểu ý (n-gram 2,4 MB) và giọng đọc (mp3 + TTS máy) đã chạy offline. Chỉ còn cái **tai** phụ thuộc mạng.

## Decision / Quyết định

- **Mô hình:** `zipformer-vi-30M-int8-2026-02-09` (k2-fsa/sherpa-onnx, từ hynt/Zipformer-30M-RNNT-6000h, khoảng 6.000 giờ tiếng Việt). Gói thành **một file** `public/data/sen-bien-nghe.v1.bin` (34 MB: encoder int8 + decoder + joiner + tokens + bpe.vocab; script `scripts/build-sen-bien-nghe.mjs`). File đi qua cửa `fetchDataBytes`: mã hoá SDF2, có `dataGate`, kho SW cache-first.
- **Bộ chạy:** sherpa-onnx v1.13.8 dựng **riêng, chỉ phần nghe**, cho trình duyệt (`scripts/sen-bien-nghe-wasm/build.sh`, emsdk 4.0.23). Kết quả commit ở `public/sherpa-asr/1.13.8/` (wasm 14 MB, gzip khoảng 3,8 MB). Chạy trong Web Worker `public/sen-bien-nghe.worker.js`.
- **Hai tai:** đã nạp bộ nghe trong máy thì dùng nó trước. Chưa nạp (lần đầu, đang tải, máy bật tiết kiệm dữ liệu) thì quay về Web Speech như cũ, và mất sóng thì có ô gõ.
- **Nắn tên:** tên cảng + điểm đã ghim được đưa vào làm hotwords (`modified_beam_search`, điểm 2,5). Sau đó khớp gần theo âm ở `hieu-y.ts` ("Hòn Dớ" ra Hòn Rớ). Câu khớp gần **không tự chạy**: máy đọc lại tên rồi chờ bà con nói "đi".
- **Số đọc bằng chữ:** mô hình trả "mười bốn độ", nên `soBangChu` (parse-coord.ts) đổi ra số trước khi đọc toạ độ.

## Số đo (2026-10-16)

Bộ thử: 70 câu lệnh bản đồ × 4 kiểu thu (sạch / nói nhanh / máy tàu ồn 10 dB / 5 dB), giọng máy macOS "Linh". Chấm **đúng việc** = câu nghe ra dẫn tới đúng hành động trong `senBienReply`.

| Cấu hình | MB | Đúng việc | Sai chữ |
|---|---|---|---|
| 70.000 giờ int8 (Apache-2.0) | 74 | 59–62/70 | 9–13 % |
| 70.000 giờ + tên ưu tiên + khớp gần | 74 | 63–67/70 | 6–8,5 % |
| 30M | 34 | 62–67/70 | 9–15 % |
| **30M + tên ưu tiên + khớp gần** | **34** | **68–69/70** | 7,5–10 % |

WASM một luồng trên Mac: nạp 0,9 s, giải mã 0,09–0,13 s mỗi câu, dựng lại tên ưu tiên 0,5 s. Đoán trên điện thoại tầm trung: khoảng 0,5–0,7 s mỗi câu. Khớp gần đặt trên 1.421 câu không phải dẫn đường: 1 câu khớp nhầm.

## Giấy phép — ghi thật, chủ dự án đã chốt

- sherpa-onnx (mã + WASM): **Apache-2.0**.
- Mô hình 30M (hynt): **CC-BY-NC-ND 4.0**, tức **phi thương mại và cấm sửa**. Thẻ mô hình không ghi điều khoản nào khác ngoài lời xin ủng hộ tiền train. Ngày 2026-10-16 chủ dự án đã được báo rủi ro: Sen Biển nghe cả câu hỏi dự báo cá, là phần thu tiền, nên luật CLAUDE.md "phi thương mại chỉ không chặn lớp bản đồ miễn phí" không che được trường hợp này. Chủ dự án vẫn chốt dùng 30M.
- "Làm tốt hơn thì thành bản của Sen Biển": tinh chỉnh (fine-tune) một mô hình ND **vẫn là bản phái sinh** của hynt, không thành của mình. Đường sạch là: (a) xin hynt giấy phép thương mại, hoặc (b) fine-tune từ mô hình **Apache-2.0** (zzasdf/viet_iter3_pseudo_label, 70.000 giờ) bằng dữ liệu riêng của SDFish, hoặc chưng cất ra một mô hình nhỏ cỡ 30M từ chính nó. Bản đó mới là "của Sen Biển". Đường lùi đã đo sẵn ở bảng trên: đổi mô hình chỉ là chạy lại `build-sen-bien-nghe.mjs`, không phải dựng lại WASM.

## Alternatives considered / Phương án đã cân nhắc

- **Gói npm `sherpa-onnx` (WASM có sẵn):** dựng cho Node (NODERAWFS), tự ném lỗi trong trình duyệt. Đã thử. Loại.
- **Bản demo ASR của k2-fsa trên HuggingFace:** đóng cứng mô hình mẫu vào `.data` và chỉ xuất hàm online. Loại.
- **Plugin STT native (Android SpeechRecognizer / iOS SFSpeech):** phụ thuộc máy có gói tiếng Việt offline hay không, không có hotwords, iOS không chắc nghe offline được tiếng Việt. Để làm bậc sau cho bản native.
- **Whisper (transformers.js):** bản tiny/base tiếng Việt kém, bản đủ tốt thì 150 MB trở lên. Loại.
- **Tải mô hình từ HuggingFace lúc chạy (ngoài git):** chủ dự án chọn để trong git (luật "dữ liệu nằm trong code").

## Consequences / Hệ quả

- Git gánh thêm 34 MB (mô hình) + 14 MB (WASM), **giữ vĩnh viễn**. `public/data` lên khoảng 98 MB, vẫn dưới trần 120 MB. File 34 MB vượt trần 20 MB/file nên commit phải có dòng `data-budget:`.
- Máy bà con tải thêm khoảng 26 MB (mô hình sau gzip) + 3,8 MB (WASM) **một lần**, 8 giây sau khi mở bản đồ, sau bộ hiểu ý và giọng. Máy bật "tiết kiệm dữ liệu" thì không tự tải.
- RAM worker khoảng 150–250 MB lúc nghe. Máy yếu nạp hỏng thì quay về Web Speech hoặc gõ, không treo app.
- Nợ: chưa đo giọng bà con thật (giọng miền, gió); chưa có nghe nền khi khoá màn. Bản Android đã khai `RECORD_AUDIO` + `MODIFY_AUDIO_SETTINGS` trong manifest (Capacitor tự xin quyền lúc trang gọi mic), nhưng chưa thử trên máy thật.
