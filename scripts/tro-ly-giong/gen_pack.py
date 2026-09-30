# -*- coding: utf-8 -*-
"""Máy sinh giọng "Sen Biển" ở bờ — sinh mp3 nhẹ cho MỌI câu cố định trong
catalog.json, cả 2 giọng (bac=Trúc Ly, nam=Mỹ Duyên). Xuất out_pack/<giọng>/<id>.mp3
+ manifest.json (id, text, bytes, ms). Nén 24kHz mono 64k.

Chạy: venv\\Scripts\\python.exe gen_pack.py
"""
import json, os, sys, time, tempfile, traceback

BASE = os.path.dirname(os.path.abspath(__file__))
# NGOÀI repo (trần dữ liệu git): SEN_BIEN_OUT hoặc tham số 1; mặc định ~/sdfish-tram/giong-out
OUT = os.environ.get("SEN_BIEN_OUT") or (sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.expanduser("~"), "sdfish-tram", "giong-out"))


def wav_ms(path):
    import wave
    with wave.open(path, "rb") as w:
        return round(w.getnframes() / float(w.getframerate()) * 1000)


# NHỊP (2026-09-30, chủ dự án chê "nhịp nói chưa tự nhiên"): mặc định VieNeu temp 0.8 đọc
# ~5,7 tiếng/giây — nhanh và ngữ điệu thất thường với tai người 40–60 tuổi. Chốt bản "E"
# của trang nghe thử: temp 0.5 (đều) + chậm 15% bằng ffmpeg atempo (giữ cao độ giọng).
TEMPERATURE = 0.5
ATEMPO = 0.85


def to_mp3(wav_path, mp3_path):
    from pydub import AudioSegment
    seg = AudioSegment.from_wav(wav_path).set_channels(1).set_frame_rate(24000)
    seg.export(mp3_path, format="mp3", bitrate="64k", parameters=["-filter:a", f"atempo={ATEMPO}"])


def main():
    with open(os.path.join(BASE, "catalog.json"), "r", encoding="utf-8") as f:
        cat = json.load(f)
    voices = cat["voices"]              # {"bac": "Trúc Ly", "nam": "Mỹ Duyên"}
    items = cat["items"]

    from vieneu import Vieneu
    print("== nạp VieNeu ==", flush=True)
    v = Vieneu()

    manifest = {"createdAt": time.strftime("%Y-%m-%dT%H:%M:%S"), "voices": voices, "files": []}
    total = 0
    for tag, voice in voices.items():
        vdir = os.path.join(OUT, tag)
        os.makedirs(vdir, exist_ok=True)
        print(f"\n== giọng {tag} = {voice} ==", flush=True)
        for it in items:
            iid, text = it["id"], it["text"]
            doc = it.get("doc") or text  # cách ĐỌC (vd 115 → "một một năm"); `text` là khoá app
            try:
                audio = v.infer(doc, voice=voice, temperature=TEMPERATURE)
                with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tf:
                    tmp = tf.name
                v.save(audio, tmp)
                ms = round(wav_ms(tmp) / ATEMPO)
                mp3 = os.path.join(vdir, f"{iid}.mp3")
                to_mp3(tmp, mp3)
                os.remove(tmp)
                b = os.path.getsize(mp3)
                total += b
                manifest["files"].append({"voice": tag, "id": iid, "intent": it.get("intent"), "ms": ms, "bytes": b, "text": text})
                print(f"  [{iid}] {ms}ms · {b//1024} KB", flush=True)
            except Exception as e:
                print(f"  [{iid}] LỖI: {e}", flush=True)

    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    n = len(items)
    print(f"\nXONG. {len(manifest['files'])}/{2*n} file · tổng {total//1024} KB ({total/1048576:.2f} MB) · {OUT}", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
