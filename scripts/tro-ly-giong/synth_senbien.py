# -*- coding: utf-8 -*-
"""Sinh thử giọng "Sen Biển" bằng VieNeu-TTS trên các CÂU CỐ ĐỊNH thật của trợ lý
(lấy từ src/lib/assistant/answer.ts). Mục đích: nghe chất lượng trước khi chốt
VieNeu thay OmniVoice/piper làm máy sinh giọng ở bờ (ADR 0010).

Chạy: venv\\Scripts\\python.exe synth_senbien.py
"""
import time, sys, os, traceback

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")
os.makedirs(OUT, exist_ok=True)

# Câu ĐỌC (đã ở dạng lời — số thành chữ, đơn vị thành lời — như toSpeech() sinh ra).
# Đây đúng là các câu cố định VieNeu sẽ đọc sẵn nhét vào gói não.
CAU = [
    ("persona",      "Tôi là Sen Biển, trợ lý của bà con mình."),
    ("chao",         "Dạ, bác cần gì?"),
    ("an_toan_yte",  "Việc này tôi không trả lời được. Đau ốm thì gọi một một năm hoặc trạm y tế."),
    ("dai_duyen_hai","Bác nghe thêm đài duyên hải."),
    ("tro_giup",     "Bác hỏi tôi thời tiết, bão, giấy tờ, giá cá, hay bảo tôi mở màn, tìm món, gọi shop."),
    ("chua_co_gia",  "Máy chưa có bảng giá. Có sóng mở Giao dịch để tải."),
    ("cho_mat_song", "Chợ cần có sóng mới tìm được. Có sóng lại bác hỏi tôi tìm giúp nhé."),
    ("tat_tieng",    "Đã tắt tiếng, tôi chỉ hiện chữ."),
    # câu dài, nhiều từ nghề cá + số đọc thành chữ — thử chỗ khó
    ("bao_canh_bao", "Có bão số ba gần bờ, gió chín mươi cây số giờ, đừng ra khơi vùng ảnh hưởng. Bác nghe thêm đài duyên hải."),
    ("thoi_tiet",    "Hôm nay ở cảng Quy Nhơn điểm bảy hai trên một trăm, sóng một mét hai, gió hai lăm cây số giờ, biển êm đi được."),
    ("giay_to",      "Tàu bác có hai giấy cần lo, đăng kiểm còn mười ngày, giấy phép khai thác quá hạn ba ngày."),
]

# 2 câu mẫu để so vùng miền (chọn giọng "Sen Biển" theo vùng)
MAU_VUNG = [
    "Dạ, bác cần gì? Bác nghe thêm đài duyên hải.",
    "Hôm nay biển êm, đi được. Có bão thì tôi báo bác liền.",
]


def wav_ms(path):
    try:
        import wave
        with wave.open(path, "rb") as w:
            return round(w.getnframes() / float(w.getframerate()) * 1000)
    except Exception:
        return -1


def main():
    from vieneu import Vieneu
    print("== Đang nạp VieNeu (lần đầu tải model ~282MB, chờ chút) ==", flush=True)
    t0 = time.time()
    v = Vieneu()
    print(f"nạp xong trong {time.time()-t0:.1f}s", flush=True)

    try:
        voices = v.list_preset_voices()
        print("PRESET VOICES:", voices, flush=True)
    except Exception as e:
        voices = None
        print("list_preset_voices lỗi:", e, flush=True)

    # giọng chính cho "Sen Biển": để mặc định (Minh Quân, giọng Bắc) đọc trọn bộ câu
    main_voice = "Minh Quân"
    print(f"\n== Sinh {len(CAU)} câu cố định bằng giọng '{main_voice}' ==", flush=True)
    for name, text in CAU:
        t = time.time()
        try:
            audio = v.infer(text, voice=main_voice)
            p = os.path.join(OUT, f"{name}.wav")
            v.save(audio, p)
            dur = wav_ms(p)
            secs = time.time() - t
            rtf = (secs * 1000 / dur) if dur > 0 else float("nan")
            print(f"  [{name}] {dur}ms audio · {secs:.2f}s sinh · RTF {rtf:.2f} · {text[:38]}...", flush=True)
        except Exception as e:
            print(f"  [{name}] LỖI: {e}", flush=True)

    # so vùng miền: mỗi vùng 2 câu mẫu (tên giọng lấy theo list, fallback nếu khác)
    region_try = {
        "bac":   ["Minh Quân", "Phạm Tuyên"],
        "trung": ["Quang Sơn"],
        "nam":   ["Adam"],
    }
    print("\n== Mẫu so vùng miền ==", flush=True)
    for region, names in region_try.items():
        voice = None
        for n in names:
            if voices is None or n in (voices if isinstance(voices, (list, tuple)) else []):
                voice = n; break
        if voice is None:
            voice = names[0]
        for i, text in enumerate(MAU_VUNG):
            try:
                audio = v.infer(text, voice=voice)
                p = os.path.join(OUT, f"vung_{region}_{i+1}.wav")
                v.save(audio, p)
                print(f"  [{region}/{voice}] -> {os.path.basename(p)} ({wav_ms(p)}ms)", flush=True)
            except Exception as e:
                print(f"  [{region}/{voice}] LỖI: {e}", flush=True)

    print(f"\nXONG. File ở: {OUT}", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        sys.exit(1)
