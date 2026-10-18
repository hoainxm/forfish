#!/bin/sh
# Tải asset cho trang đo P0 (ADR 0010): sherpa-onnx WASM (gói Flutter web dựng sẵn, Apache-2.0),
# STT zipformer-vi-30M-int8, silero VAD, TTS piper vi_VN-vais1000-medium. Chạy trong Git Bash / sh.
# Dùng lại được để dựng GÓI NÃO sau này — cùng file, chỉ khác nơi đặt.
set -eu
cd "$(dirname "$0")"
V=1.13.7
mkdir -p assets/stt assets/tts assets/wav tmp
echo "[1/4] sherpa_onnx_web $V (wasm + wrapper JS)"
curl -fsSL --retry 5 --retry-delay 3 --retry-all-errors --connect-timeout 20 -o tmp/web.tar.gz "https://pub.dev/api/archives/sherpa_onnx_web-$V.tar.gz"
tar xzf tmp/web.tar.gz -C tmp
cp tmp/assets/sherpa-onnx-wasm-web.js tmp/assets/sherpa-onnx-wasm-web.wasm tmp/assets/sherpa-onnx-asr.js tmp/assets/sherpa-onnx-vad.js tmp/assets/sherpa-onnx-tts.js assets/
cp tmp/LICENSE assets/LICENSE-sherpa-onnx.txt
echo "[2/4] STT zipformer-vi-30M-int8 (26 MB)"
curl -fsSL --retry 5 --retry-delay 3 --retry-all-errors --connect-timeout 20 -o tmp/vi30.tar.bz2 "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-zipformer-vi-30M-int8-2026-02-09.tar.bz2"
tar xjf tmp/vi30.tar.bz2 -C tmp
cp tmp/sherpa-onnx-zipformer-vi-30M-int8-2026-02-09/encoder.int8.onnx tmp/sherpa-onnx-zipformer-vi-30M-int8-2026-02-09/decoder.onnx tmp/sherpa-onnx-zipformer-vi-30M-int8-2026-02-09/joiner.int8.onnx tmp/sherpa-onnx-zipformer-vi-30M-int8-2026-02-09/tokens.txt assets/stt/
cp tmp/sherpa-onnx-zipformer-vi-30M-int8-2026-02-09/test_wavs/*.wav assets/wav/
# hotwords cần bpe.vocab; release chỉ có bpe.model → sinh ra tại chỗ (pip install sentencepiece)
cp tmp/sherpa-onnx-zipformer-vi-30M-int8-2026-02-09/bpe.model assets/stt/
python -c "import sentencepiece as spm; sp=spm.SentencePieceProcessor(model_file='assets/stt/bpe.model'); open('assets/stt/bpe.vocab','w',encoding='utf-8').write(''.join('%s\t%s\n'%(sp.id_to_piece(i),sp.get_score(i)) for i in range(sp.get_piece_size())))"
echo "[3/4] silero VAD"
curl -fsSL --retry 5 --retry-delay 3 --retry-all-errors --connect-timeout 20 -o assets/silero_vad.onnx "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx"
echo "[4/4] TTS piper vi_VN-vais1000-medium (67 MB)"
curl -fsSL --retry 5 --retry-delay 3 --retry-all-errors --connect-timeout 20 -o tmp/piper.tar.bz2 "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-vi_VN-vais1000-medium.tar.bz2"
tar xjf tmp/piper.tar.bz2 -C tmp
cp tmp/vits-piper-vi_VN-vais1000-medium/vi_VN-vais1000-medium.onnx assets/tts/model.onnx
cp tmp/vits-piper-vi_VN-vais1000-medium/tokens.txt assets/tts/
rm -rf assets/tts/espeak-ng-data && cp -r tmp/vits-piper-vi_VN-vais1000-medium/espeak-ng-data assets/tts/
# CHỈ GIỮ TIẾNG VIỆT — bộ espeak đi kèm piper mang 113 ngôn ngữ (355 file, 18 MB) mà
# giọng vi_VN chỉ tra vi_dict + phần lõi dùng chung. Xoá 112 ngôn ngữ kia còn 9 file,
# 0,72 MB. Đo 2026-09-07 (đọc→nghe 25 câu nghề cá, 3 lần mỗi bên): 90,8% với bản gọn
# so với 90,1% bản đầy đủ — không kém. Đặt ESPEAK_KEEP_ALL=1 để giữ hết mà đối chứng.
# phondata/phontab/phonindex/intonations là bảng âm vị DÙNG CHUNG mọi ngôn ngữ: muốn
# cắt nữa phải biên dịch lại espeak-ng từ nguồn — chưa làm.
if [ "${ESPEAK_KEEP_ALL:-0}" != "1" ]; then
  ( cd assets/tts/espeak-ng-data \
    && find . -name "*_dict" ! -name "vi_dict" -delete \
    && rm -rf voices \
    && find lang -mindepth 1 -maxdepth 1 ! -name aav -exec rm -rf {} + \
    && find lang/aav -type f ! -name "vi*" -delete )
  echo "    espeak: giu tieng Viet, xoa cac ngon ngu khac ($(du -sh assets/tts/espeak-ng-data | cut -f1))"
fi
# trình duyệt không liệt kê được thư mục → manifest file espeak
( cd assets/tts && find espeak-ng-data -type f | python -c "import sys,json; json.dump([l.strip().replace(chr(92),'/') for l in sys.stdin], open('espeak-files.json','w'))" )
rm -rf tmp
du -sh assets
echo "Xong. Chạy: python serve-https.py 8443  (mic cần HTTPS)  hoặc  python -m http.server 8765"
