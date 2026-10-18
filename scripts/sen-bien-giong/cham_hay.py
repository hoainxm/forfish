# -*- coding: utf-8 -*-
"""Chấm ĐỘ TỰ NHIÊN cho mọi mp3 trong một thư mục ứng viên (UTMOS22 strong).

Chạy Ở BỜ (gpu-desktop, venv của VieNeu có torch), sau gen_clips.py:

    ~/.local/forlife/tts-venv/bin/python scripts/sen-bien-giong/cham_hay.py <thư mục> [ra.json]

Ghi <thư mục>/hay.json = {tên file: điểm 1–5}; file đã chấm thì bỏ qua (chạy
tiếp được). chon_clips.mjs và cat_trong_cau.mjs đọc điểm này để chọn bản.

Vì sao (2026-10-17, chủ dự án "giọng chưa tự nhiên, train thêm"): trước đây chỉ
chọn bản theo ĐÚNG CHỮ (bộ nhận giọng). Đúng chữ chưa phải hay: đo UTMOS câu thu
nguyên "Chào bà con." 3,9 — câu ghép từ mảnh đứng riêng 1,9. UTMOS học trên giọng
tiếng Anh nên chỉ dùng để XẾP các bản của CÙNG một câu, không so giữa hai câu.
Mô hình: tarepan/SpeechMOS v1.2.0 (torch.hub, ~0,4 GB, tải một lần về
~/.cache/torch/hub) — công cụ ở bờ, không phải dependency của app.
"""
import json, os, subprocess, sys

import numpy as np
import torch


def nap(p):
    pcm = subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-i", p, "-f", "f32le", "-ac", "1", "-ar", "16000", "-"],
        capture_output=True, timeout=60,
    ).stdout
    return torch.from_numpy(np.frombuffer(pcm, dtype=np.float32).copy())


def main():
    d = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(d, "hay.json")
    diem = json.load(open(out)) if os.path.exists(out) else {}
    files = sorted(f for f in os.listdir(d) if f.endswith(".mp3") and not f.startswith(".") and f not in diem)
    if not files:
        print("đã chấm đủ", flush=True)
        return
    dev = "cuda" if torch.cuda.is_available() else "cpu"
    m = torch.hub.load("tarepan/SpeechMOS:v1.2.0", "utmos22_strong", trust_repo=True).to(dev).eval()
    for i, f in enumerate(files):
        try:
            w = nap(os.path.join(d, f))
            if w.numel() < 1600:  # dưới 0,1 s — bản hỏng
                diem[f] = 0.0
                continue
            with torch.no_grad():
                diem[f] = round(float(m(w.unsqueeze(0).to(dev), 16000).item()), 3)
        except Exception as e:  # bản hỏng không được làm sập cả lượt
            print(f"  bỏ {f}: {type(e).__name__}", flush=True)
            diem[f] = 0.0
        if i % 500 == 499:
            json.dump(diem, open(out, "w"))
            print(f"  {i + 1}/{len(files)}", flush=True)
    json.dump(diem, open(out, "w"))
    print(f"chấm {len(files)} bản → {out}", flush=True)


if __name__ == "__main__":
    main()
