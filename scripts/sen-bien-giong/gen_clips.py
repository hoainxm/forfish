# -*- coding: utf-8 -*-
"""Máy sinh giọng nữ Sen Biển cho câu CỐ ĐỊNH của chế độ Đang chạy / Sen Biển.

Đọc src/data/giong-sen-bien.json, sinh BỐN bản mỗi câu (temperature 0.4–0.7) vào
thư mục tạm NGOÀI repo; `chon_clips.mjs` cho bộ nhận giọng trong máy nghe lại,
chép bản khớp chữ nhất vào public/giong/sen-bien/<id>.mp3. Chạy Ở BỜ (máy có
VieNeu-TTS), KHÔNG chạy trên máy bà con:

    ~/.local/forlife/tts-venv/bin/python scripts/sen-bien-giong/gen_clips.py [--all]
    node scripts/sen-bien-giong/chon_clips.mjs

MẢNH GHÉP (doc 15 §21 — câu có số/tên): danh mục src/data/giong-sen-bien-manh.json
(lập bằng lap_manh.mjs), file vào public/giong/sen-bien/m/:

    ~/.local/forlife/tts-venv/bin/python scripts/sen-bien-giong/gen_clips.py --manh [--nhom so,khung] [--ban 2]
    node scripts/sen-bien-giong/chon_clips.mjs --manh

Mảnh cắt lặng sát hơn câu (chừa 30 ms) để ghép nối liền.

CÂU MANG (doc 15 §21l — mảnh mang ngữ điệu giữa câu): đọc NGUYÊN CÂU rồi cắt mảnh
ra bằng cat_trong_cau.mjs. Danh sách câu mang = trường `mang` trong báo cáo của
src/lib/__tests__/sen-bien-kich-ban.test.ts:

    SEN_BIEN_CAND=~/sb-mang ~/.local/forlife/tts-venv/bin/python scripts/sen-bien-giong/gen_clips.py --mang kb.json

Mặc định chỉ sinh câu CHƯA có mp3 (git giữ vĩnh viễn từng bản file nhị phân —
CLAUDE.md "chống phình"): đổi câu thì xoá đúng file đó rồi chạy lại. --all = sinh
lại hết, chỉ dùng khi đổi giọng/nhịp có chủ ý.

Vì sao bốn bản: đo 2026-10-16 bằng nhận giọng ngược, một lần sinh hay nuốt chữ
đầu câu ngắn ("Sen", "Dừng") và mỗi nhiệt độ hỏng một kiểu — chọn bản tốt nhất
rẻ hơn nhiều so với chỉnh tay từng câu.
Nhịp (chủ dự án chê "máy móc"): chậm 10% bằng ffmpeg atempo (giữ cao độ) + cắt
lặng đầu/cuối để câu nối nhau không hụt hơi mà không mất phụ âm đầu.
Lượt "nói nhanh hơn" 2026-10-16 (NHANH-HON): cắt lặng ở -45 dB chừa 40 ms (trước
-50 dB/80 ms), và câu ĐÁP NGẮN (`"nhanh": true` trong danh mục — xác nhận, "Dạ",
"Bắt đầu dẫn đường"…) nhanh thêm 8% (atempo 0,9 × 1,08). Câu cảnh báo giữ 0,9.
Đo bằng nhận giọng ngược: chừa 40 ms ở ĐẦU câu nuốt phụ âm "S" của "Sen Biển"
ở vài câu — `chon_clips.mjs` chọn bản sai ít nhất nên tự loại bản hụt.
"""
import json, os, subprocess, sys, tempfile, time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MANH = "--manh" in sys.argv
CATALOG = os.path.join(ROOT, "src", "data", "giong-sen-bien-manh.json" if MANH else "giong-sen-bien.json")
CAND_DIR = os.environ.get("SEN_BIEN_CAND") or os.path.join(tempfile.gettempdir(), "sen-bien-giong-cand")
TEMPS = (0.4, 0.5, 0.6, 0.7)
# Nhịp: 2026-10-16 kéo chậm 10 % (chê "máy móc"); 2026-10-17 chủ dự án chốt BỎ
# ("giọng chưa tự nhiên" — chậm đều là một phần cái máy móc). Đặt lại bằng env.
ATEMPO = float(os.environ.get("SEN_BIEN_TEMPO", "1.0"))
# câu đáp ngắn ("nhanh": true) — doc 15 §11, lượt nói nhanh hơn 2026-10-16
ATEMPO_NHANH = 1.08

os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("HF_HOME", os.path.expanduser("~/.local/forlife/hf"))


def load_engine():
    import huggingface_hub.file_download as _fd
    _fd.are_symlinks_supported = lambda *a, **k: False
    from vieneu import Vieneu
    try:
        import torch
        if torch.cuda.is_available():
            return Vieneu(backend="pytorch", device="cuda")
    except Exception as e:  # không GPU ⇒ CPU, chậm hơn nhưng vẫn ra
        print(f"không nạp được GPU ({type(e).__name__}) — dùng CPU", flush=True)
    return Vieneu(backend="onnx")


def arg(name, default=None):
    if name in sys.argv:
        i = sys.argv.index(name)
        if i + 1 < len(sys.argv):
            return sys.argv[i + 1]
    return default


def items_of(cat):
    """Câu: cat["items"]. Mảnh: cat["nhom"] = {tên nhóm: [[id, chữ], …]} — theo thứ tự nhóm."""
    if not MANH:
        return cat["items"]
    only = arg("--nhom")
    keep = set(only.split(",")) if only else None
    return [{"id": i, "text": t} for k, ds in cat["nhom"].items() if keep is None or k in keep for i, t in ds]


def to_mp3(wav, mp3, nhanh=False):
    # câu: cắt lặng -45 dB chừa 40 ms (main, "mp3 gọn" 2026-10-16); mảnh ghép chừa 30 ms
    keep = "0.03" if MANH else "0.04"
    cut = f"silenceremove=start_periods=1:start_threshold=-45dB:start_silence={keep}"
    tempo = ATEMPO * (ATEMPO_NHANH if nhanh else 1)
    flt = f"{cut},areverse,{cut},areverse" + (f",atempo={tempo:.3f}" if abs(tempo - 1.0) > 1e-6 else "")
    # trần 60 s: bản sinh ra toàn im ⇒ silenceremove cắt hết, areverse gặp tiếng
    # rỗng và ffmpeg TREO mãi (dính thật 2026-10-17 ở "Bãi Nhà Phiếu")
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-af", flt,
         "-ac", "1", "-ar", "24000", "-b:a", "48k", mp3],
        check=True, timeout=60,
    )


def gen_mang(path):
    """Câu mang: mỗi câu 4 bản → CAND_DIR/<số câu>~<k>.mp3 (giữ 48 kbps — cắt ở bước sau)."""
    mang = json.load(open(path, encoding="utf-8"))["mang"]
    os.makedirs(CAND_DIR, exist_ok=True)
    done = {f.split("~")[0] for f in os.listdir(CAND_DIR) if f.endswith(".mp3")}
    engine = load_engine()
    for n, m in enumerate(mang):
        if str(n) in done:
            continue  # lượt bị ngắt: sinh tiếp, không làm lại
        t = time.time()
        for k, temp in enumerate(TEMPS):
            audio = engine.infer(m["tts"], voice="Mỹ Duyên", temperature=temp)
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tf:
                wav = tf.name
            engine.save(audio, wav)
            try:
                to_mp3(wav, os.path.join(CAND_DIR, f"{n}~{k}.mp3"))
            except (subprocess.SubprocessError, OSError) as e:
                print(f"  {n}~{k}: bỏ ({type(e).__name__})", flush=True)
            os.remove(wav)
        print(f"  câu {n}/{len(mang)}: {time.time() - t:.1f}s", flush=True)
    print("xong câu mang", flush=True)


def main():
    if arg("--mang"):
        return gen_mang(arg("--mang"))
    with open(CATALOG, encoding="utf-8") as f:
        cat = json.load(f)
    out_dir = os.path.join(ROOT, "public", cat["dir"].lstrip("/"))
    regen = "--all" in sys.argv
    temps = TEMPS[: int(arg("--ban", len(TEMPS)))]
    todo = [it for it in items_of(cat)
            if regen or not os.path.exists(os.path.join(out_dir, f"{it['id']}.mp3"))]
    os.makedirs(CAND_DIR, exist_ok=True)
    for f in os.listdir(CAND_DIR):
        os.remove(os.path.join(CAND_DIR, f))
    if not todo:
        print("đủ cả — không sinh gì", flush=True)
        return
    engine = load_engine()
    for it in todo:
        t = time.time()
        for k, temp in enumerate(temps):
            audio = engine.infer(it.get("doc") or it["text"], voice=cat["voice"], temperature=temp)
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tf:
                wav = tf.name
            engine.save(audio, wav)
            try:
                to_mp3(wav, os.path.join(CAND_DIR, f"{it['id']}~{k}.mp3"), bool(it.get("nhanh")))
            except (subprocess.SubprocessError, OSError) as e:  # bỏ bản hỏng, còn 3 bản kia
                print(f"  {it['id']}~{k}: bỏ ({type(e).__name__})", flush=True)
            os.remove(wav)
        print(f"  {it['id']}: {len(temps)} bản · {time.time() - t:.1f}s", flush=True)
    print(f"xong {len(todo)} câu → {CAND_DIR} — giờ chạy chon_clips.mjs", flush=True)


if __name__ == "__main__":
    main()
