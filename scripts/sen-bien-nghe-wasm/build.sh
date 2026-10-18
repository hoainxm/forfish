#!/usr/bin/env bash
# Dựng bộ chạy WASM CHỈ-NGHE của sherpa-onnx cho Sen Biển (chạy ở Linux có mạng,
# KHÔNG chạy trong npm build — Vercel không có emscripten). Kết quả commit vào
# public/sherpa-asr/<bản>/ (~vài MB, đổi bản mới sinh lại).
#
# Khác bản dựng mẫu `build-wasm-simd-asr.sh` của k2-fsa ở ba chỗ:
#   1. KHÔNG --preload-file mô hình: mô hình nạp lúc chạy (đi qua cửa data-fetch,
#      mã hoá SDF2, kho SW) ⇒ đổi mô hình không phải dựng lại WASM.
#   2. Xuất đủ hàm OFFLINE (bản mẫu chỉ xuất online) + FS để ghi file mô hình.
#   3. ENVIRONMENT=web,worker — gói npm `sherpa-onnx` dựng cho Node (NODERAWFS),
#      tự ném lỗi khi chạy trong trình duyệt (đã thử 2026-10-16).
#
#   bash scripts/sen-bien-nghe-wasm/build.sh   # cần git, python3, ~3 GB đĩa
set -euo pipefail
BAN=1.13.8
EMSDK_BAN=4.0.23
W=${W:-$HOME/sen-bien-wasm}
OUT=$(cd "$(dirname "$0")/../.." && pwd)/public/sherpa-asr/$BAN
mkdir -p "$W" && cd "$W"

[ -d emsdk ] || git clone -q https://github.com/emscripten-core/emsdk.git
(cd emsdk && ./emsdk install $EMSDK_BAN >/dev/null && ./emsdk activate $EMSDK_BAN >/dev/null)
# shellcheck disable=SC1091
source emsdk/emsdk_env.sh >/dev/null
# cmake vào thư mục riêng (không cần python3-venv / sudo): uv nếu có, không thì pip
if [ ! -x pylib/bin/cmake ]; then
  if command -v uv >/dev/null || [ -x "$HOME/.local/bin/uv" ]; then
    "$(command -v uv || echo "$HOME/.local/bin/uv")" pip install -q --target pylib "cmake<4"
  else
    python3 -m pip -q install --target pylib "cmake<4"
  fi
fi
export PYTHONPATH=$W/pylib PATH=$W/pylib/bin:$PATH

[ -d src ] || git clone -q --depth 1 --branch v$BAN https://github.com/k2-fsa/sherpa-onnx.git src
cd src
python3 - <<'PY'
import re
p = "wasm/asr/CMakeLists.txt"
s = open(p).read()
s = re.sub(r'if\(NOT EXISTS "\$\{CMAKE_CURRENT_SOURCE_DIR\}/assets/encoder.onnx"\)\n.*?\nendif\(\)\n', "", s, flags=re.S)
fns = """SherpaOnnxCreateOfflineRecognizer SherpaOnnxDestroyOfflineRecognizer SherpaOnnxOfflineRecognizerSetConfig
SherpaOnnxCreateOfflineStream SherpaOnnxDestroyOfflineStream SherpaOnnxAcceptWaveformOffline
SherpaOnnxDecodeOfflineStream SherpaOnnxDestroyOfflineStreamResultJson""".split()
s = s.replace("  SherpaOnnxOfflineStreamSetOption\n", "  SherpaOnnxOfflineStreamSetOption\n" + "".join(f"  {f}\n" for f in fns), 1)
s = s.replace('string(APPEND MY_FLAGS "--preload-file ${CMAKE_CURRENT_SOURCE_DIR}/assets@. ")\n', "")
s = s.replace("'HEAPF64']", "'HEAPF64','FS']")
s = s.replace('-s ALLOW_MEMORY_GROWTH=1")', '-s ALLOW_MEMORY_GROWTH=1 -sENVIRONMENT=web,worker")')
s = s.replace("INITIAL_MEMORY=512MB", "INITIAL_MEMORY=128MB")
s = s.replace('    "$<TARGET_FILE_DIR:sherpa-onnx-wasm-main-asr>/sherpa-onnx-wasm-main-asr.data"\n', "")
open(p, "w").write(s)
PY
grep -q "AcceptWaveformOffline" wasm/asr/CMakeLists.txt
sed -i 's/^make -j2/make -j"$(nproc)"/' build-wasm-simd-asr.sh
bash build-wasm-simd-asr.sh > "$W/build.log" 2>&1 || { tail -40 "$W/build.log"; exit 1; }
mkdir -p "$OUT"
cp build-wasm-simd-asr/install/bin/wasm/asr/sherpa-onnx-wasm-main-asr.{js,wasm} wasm/asr/sherpa-onnx-asr.js LICENSE "$OUT/"
ls -la "$OUT"
