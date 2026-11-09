# Chấm cách tách chuyến từ vết VMS so với giờ rời/cập KHAI BÁO. Chạy: cham.py [bước lấy mẫu tàu]
import json, os, sys, time, numpy as np
H = os.path.expanduser("~/fish-vet"); W = f"{H}/work"; SD = f"{W}/seg"
t0_ = time.time()
STEP = int(sys.argv[1]) if len(sys.argv) > 1 else 4
V = np.load(f"{W}/p_v.npy", mmap_mode="r"); T = np.load(f"{W}/p_t.npy", mmap_mode="r")
C = {k: np.load(f"{SD}/{k}.npy", mmap_mode="r") for k in ("portkm", "dth", "kn")}
nV = len(json.load(open(f"{W}/vessels.json"))); vb = np.searchsorted(V, np.arange(nV + 1))
Z = np.load(f"{W}/chuyen-that.npz"); A = Z["A"]
TH = {}
for r in A:
    TH.setdefault(int(r[0]), []).append((r[1], r[2]))

def runs(m):
    if not len(m): return np.zeros(0, int), np.zeros(0, int)
    d = np.diff(np.r_[0, m.astype(np.int8), 0]); return np.flatnonzero(d == 1), np.flatnonzero(d == -1) - 1

def cu(t, pk, dth):
    """03_trips hiện tại: biển = cách cảng > 10 km; ngắt khi điểm trước trong 10 km hoặc mất tín hiệu > 24 h; ≥ 6 giờ"""
    sea = pk > 10; dd = np.where(dth > 4, 0, dth); out = []
    brk = np.ones(len(t), bool); brk[1:] = ~sea[:-1] | (dth[:-1] > 24)
    i = 0; n = len(t)
    idx = np.flatnonzero(sea)
    if not len(idx): return out
    grp = np.cumsum(brk)[idx]
    for g in np.unique(grp):
        s = idx[grp == g]
        if dd[s].sum() >= 6: out.append((t[s[0]], t[s[-1]] + dth[s[-1]] * 3600))
    return out

def moi(t, pk, dth, R=10, S=2, VKM=20):
    """ở cảng = chuỗi điểm trong R km kéo dài ≥ S giờ; mất tín hiệu chỉ ngắt khi ĐỦ GIỜ chạy vào cảng rồi ra lại"""
    n = len(t); inp = pk <= R
    pk1 = np.r_[pk[1:], pk[-1]]
    gapb = (dth > 4) & (dth * VKM >= pk + pk1 + VKM * S)   # đủ thời gian vào bờ, ở ≥ S giờ, ra lại
    B = gapb.copy()
    s_, e_ = runs(inp)
    for a, b in zip(s_, e_):
        dur = (t[min(b + 1, n - 1)] - t[a]) / 3600
        if dur >= S or a == 0 or b == n - 1: B[a:b + 1] = True
    out = []; dd = np.where(dth > 4, 0, dth)
    s_, e_ = runs(~B)
    for a, b in zip(s_, e_):
        while a <= b and inp[a]: a += 1
        while b >= a and inp[b]: b -= 1
        if a > b: continue
        if dd[a:b + 1][pk[a:b + 1] > R].sum() >= 6: out.append((t[a], t[b] + dth[b] * 3600))
    return out

def cham(PR, TRU, lo, hi):
    """PR, TRU: [(bd, kt)] của một tàu. Trả số đếm"""
    r = {"n": 0, "khop": 0, "xe": 0, "gop": 0, "truot": 0, "e_di": [], "e_ve": [], "pr": 0, "pr_khop": 0}
    P = np.array(PR, float).reshape(-1, 2)
    for a, b in TRU:
        L = b - a
        ov = np.clip(np.minimum(P[:, 1], b) - np.maximum(P[:, 0], a), 0, None) if len(P) else np.zeros(0)
        r["n"] += 1
        if not len(ov) or ov.max() <= 0: r["truot"] += 1; continue
        k = int(ov.argmax()); iou = ov[k] / (max(P[k, 1], b) - min(P[k, 0], a))
        if iou >= 0.7:
            r["khop"] += 1; r["e_di"].append(abs(P[k, 0] - a) / 3600); r["e_ve"].append(abs(P[k, 1] - b) / 3600)
        elif ((ov > 3600) & (ov < L)).sum() >= 2 and ov.sum() / L >= 0.5: r["xe"] += 1
        elif P[k, 1] - P[k, 0] > 1.4 * L: r["gop"] += 1
        else: r["truot"] += 1
    TT = np.array(TRU, float)
    for a, b in P:
        if a < lo or b > hi: continue
        r["pr"] += 1
        ov = np.clip(np.minimum(TT[:, 1], b) - np.maximum(TT[:, 0], a), 0, None)
        k = int(ov.argmax()); iou = ov[k] / (max(TT[k, 1], b) - min(TT[k, 0], a))
        if iou >= 0.5: r["pr_khop"] += 1
    return r

