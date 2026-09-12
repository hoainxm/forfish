# -*- coding: utf-8 -*-
# CHƯA CHẠY THẬT (bước train) — khung sinh manifest lhotse cho fine-tune zipformer-vi.
# Doc: docs/app-map/ops/tram-o-bo/07-fine-tune-stt-icefall.md §4
#
# Quét thư mục audio (16kHz mono, CÓ ĐỒNG THUẬN) + file nhãn TSV -> manifest lhotse
# (recordings + supervisions), tách train/dev/test THEO SPEAKER (chống rò rỉ).
#
# Nhãn TSV mỗi dòng:   <ten_file.wav> \t <ma_speaker> \t <vung> \t <cau chu>
#   vd:                sp-bac-001_012.wav \t sp-bac-001 \t bac \t biển động cấp mấy
#
# Chạy:
#   python prepare_manifest.py --audio-dir /data/senbien-audio --labels /data/labels.tsv \
#       --out /data/manifests --split-by speaker
#   python prepare_manifest.py --labels /data/labels.tsv --dry-run   # thống kê, KHÔNG cần lhotse/audio
#
# ⚠️ Yêu cầu (bước thật): lhotse cài trong WSL2/Docker; audio phải có đồng thuận (doc §2).
# ⚠️ KHÔNG đưa audio/nhãn/manifest vào git — dữ liệu cá nhân + nặng.

import argparse
import os
import sys
from collections import defaultdict

# Windows console hay dùng cp1252 -> ép UTF-8 để in tiếng Việt không vỡ.
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8")
    except Exception:
        pass


def doc_nhan(path):
    """Đọc TSV -> list dict {file, speaker, vung, text}. Bỏ dòng thiếu cột / thiếu text."""
    rows = []
    bo = 0
    with open(path, "r", encoding="utf-8") as f:
        for ln in f:
            ln = ln.rstrip("\n")
            if not ln.strip() or ln.startswith("#"):
                continue
            cols = ln.split("\t")
            if len(cols) < 4 or not cols[3].strip():
                bo += 1
                continue
            rows.append({"file": cols[0].strip(), "speaker": cols[1].strip(),
                         "vung": cols[2].strip(), "text": cols[3].strip()})
    return rows, bo


def tach_theo_speaker(rows, dev=0.15, test=0.15):
    """Mỗi speaker nằm TRỌN 1 tập. Sắp theo tên speaker cho ổn định."""
    by_sp = defaultdict(list)
    for r in rows:
        by_sp[r["speaker"]].append(r)
    speakers = sorted(by_sp.keys())
    n = len(rows)
    muc_dev, muc_test = round(n * dev), round(n * test)
    test_set, dev_set, train_set = [], [], []
    da_test = da_dev = 0
    # ưu tiên speaker ít câu vào test/dev để phủ nhiều người, giữ train lớn
    theo_kt = sorted(speakers, key=lambda s: len(by_sp[s]))
    gan = {}
    for s in theo_kt:
        if da_test < muc_test and len(gan) < len(speakers) - 1:
            gan[s] = "test"; da_test += len(by_sp[s])
        elif da_dev < muc_dev and len(gan) < len(speakers) - 1:
            gan[s] = "dev"; da_dev += len(by_sp[s])
        else:
            gan[s] = "train"
    for s in speakers:
        tap = {"train": train_set, "dev": dev_set, "test": test_set}[gan[s]]
        tap.extend(by_sp[s])
    return train_set, dev_set, test_set, gan


def thong_ke(rows, gan=None):
    by_vung = defaultdict(int)
    by_sp = defaultdict(int)
    for r in rows:
        by_vung[r["vung"]] += 1
        by_sp[r["speaker"]] += 1
    print(f"  câu: {len(rows)} · speaker: {len(by_sp)} · vùng: {dict(by_vung)}")
    if gan:
        by_tap = defaultdict(int)
        for r in rows:
            by_tap[gan[r["speaker"]]] += 1
        print(f"  tách: {dict(by_tap)}")
    thieu = [v for v in ("bac", "trung", "nam") if v not in by_vung]
    if thieu:
        print(f"  ⚠️  thiếu vùng: {thieu} — doc §4 đòi phủ đủ 3 vùng ở train và test.")


def xuat_lhotse(train, dev, test, audio_dir, out_dir):
    """Cần lhotse. Xuất recordings/supervisions .jsonl.gz cho từng tập."""
    try:
        from lhotse import RecordingSet, SupervisionSet, Recording, SupervisionSegment
    except ImportError:
        print("✗ chưa cài lhotse — cài trong WSL2/Docker (doc §3). Dùng --dry-run để kiểm nhãn trước.",
              file=sys.stderr)
        sys.exit(3)
    os.makedirs(out_dir, exist_ok=True)
    for ten, rows in (("train", train), ("dev", dev), ("test", test)):
        recs, sups = [], []
        for i, r in enumerate(rows):
            wav = os.path.join(audio_dir, r["file"])
            if not os.path.exists(wav):
                print(f"  ! thiếu file: {wav} — bỏ", file=sys.stderr)
                continue
            rid = os.path.splitext(r["file"])[0]
            rec = Recording.from_file(wav, recording_id=rid)
            recs.append(rec)
            sups.append(SupervisionSegment(
                id=f"{rid}-0", recording_id=rid, start=0.0, duration=rec.duration,
                channel=0, language="Vietnamese", speaker=r["speaker"], text=r["text"],
                custom={"vung": r["vung"]},
            ))
        RecordingSet.from_recordings(recs).to_file(os.path.join(out_dir, f"recordings_{ten}.jsonl.gz"))
        SupervisionSet.from_segments(sups).to_file(os.path.join(out_dir, f"supervisions_{ten}.jsonl.gz"))
        print(f"  {ten}: {len(recs)} recording · {len(sups)} supervision -> {out_dir}")
    print("→ Bước tiếp: lhotse compute-fbank ... -> CutSet; rồi zipformer/finetune.py (README).")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--audio-dir", help="thư mục wav 16kHz mono (có đồng thuận)")
    ap.add_argument("--labels", required=True, help="TSV: file<TAB>speaker<TAB>vung<TAB>text")
    ap.add_argument("--out", help="thư mục xuất manifest")
    ap.add_argument("--split-by", default="speaker", choices=["speaker"],
                    help="chỉ hỗ trợ speaker (chống rò rỉ)")
    ap.add_argument("--dev", type=float, default=0.15)
    ap.add_argument("--test", type=float, default=0.15)
    ap.add_argument("--dry-run", action="store_true", help="chỉ in thống kê, không cần lhotse/audio")
    a = ap.parse_args()

    rows, bo = doc_nhan(a.labels)
    print(f"== đọc nhãn: {len(rows)} dòng hợp lệ (bỏ {bo} dòng thiếu cột/text) ==")
    train, dev, test, gan = tach_theo_speaker(rows, a.dev, a.test)
    thong_ke(rows, gan)
    if len(rows) < 50:
        print("  ⚠️  < 50 câu — quá ít để fine-tune có ý nghĩa (ADR 0010 đo trên bộ 50 câu P0).")

    if a.dry_run:
        print("(dry-run — chưa xuất manifest)")
        return
    if not a.audio_dir or not a.out:
        print("Cần --audio-dir và --out để xuất manifest (hoặc dùng --dry-run).", file=sys.stderr)
        sys.exit(2)
    xuat_lhotse(train, dev, test, a.audio_dir, a.out)


if __name__ == "__main__":
    main()
