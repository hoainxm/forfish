# -*- coding: utf-8 -*-
"""Sinh thử GIỌNG NỮ cho "Sen Biển" (VieNeu-TTS). Tái dùng câu của synth_senbien.py."""
import time, os, traceback
from synth_senbien import CAU, MAU_VUNG, wav_ms

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_nu")
os.makedirs(OUT, exist_ok=True)

# giọng nữ theo miền (tên đúng như list_preset_voices đã in)
FULL_VOICE = "Trúc Ly"          # Nữ · Bắc · tự nhiên — đọc trọn bộ để nghe chất lượng
REGION = [
    ("bac_trucly",   "Trúc Ly"),     # Nữ · Bắc · tự nhiên
    ("bac_ngochuyen","Ngọc Huyền"),  # Nữ · Bắc · tự nhiên (thay thế)
    ("trung_ngoctran","Ngọc Trân"),  # Nữ · Trung · tự nhiên
    ("nam_thuydung", "Thùy Dung"),   # Nữ · Nam · tin tức
    ("nam_myduyen",  "Mỹ Duyên"),    # Nữ · Nam · đọc truyện (thay thế)
]


def main():
    from vieneu import Vieneu
    print("== nạp VieNeu ==", flush=True)
    v = Vieneu()

    print(f"\n== trọn bộ {len(CAU)} câu, giọng '{FULL_VOICE}' ==", flush=True)
    for name, text in CAU:
        try:
            audio = v.infer(text, voice=FULL_VOICE)
            p = os.path.join(OUT, f"{name}.wav")
            v.save(audio, p)
            print(f"  [{name}] {wav_ms(p)}ms · {text[:36]}...", flush=True)
        except Exception as e:
            print(f"  [{name}] LỖI: {e}", flush=True)

    print("\n== mẫu so miền (giọng nữ) ==", flush=True)
    for tag, voice in REGION:
        for i, text in enumerate(MAU_VUNG):
            try:
                audio = v.infer(text, voice=voice)
                p = os.path.join(OUT, f"vung_{tag}_{i+1}.wav")
                v.save(audio, p)
                print(f"  [{tag}/{voice}] -> {os.path.basename(p)} ({wav_ms(p)}ms)", flush=True)
            except Exception as e:
                print(f"  [{tag}/{voice}] LỖI: {e}", flush=True)

    print(f"\nXONG. File ở: {OUT}", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
