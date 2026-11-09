# 03_trips.py — từ pha từng đoạn (work/seg/*.npy) dựng chuyến, mẻ ước, vùng; đo độ đúng với nhật ký; curve nghề × cỡ;
# v3 09/11: ranh chuyến = Data Lake khi có + tự dò ở-cảng (chuyen_tau). backtest tham số lo-trinh (7 kn, 55 km, NGAY_NEN_VE, 1–4 chỗ ghé). THEO KHỐI TÀU (RAM thấp).
# Ra (KHÔNG mã tàu): ~/fish-vet/out/{report.json, curves-full.json, grounds-025.json}
import json, os, time, math
import numpy as np
from collections import defaultdict

W = os.path.expanduser("~/fish-vet/work"); SD = os.path.join(W, "seg"); O = os.path.expanduser("~/fish-vet/out"); os.makedirs(O, exist_ok=True)
t0 = time.time()
def log(*a): print(*a, f"{time.time()-t0:.0f}s", flush=True)
COLS = ["kn", "turn", "dth", "km", "portkm", "vnh", "lat", "lon", "gap", "g", "state"]
C = {k: np.load(os.path.join(SD, f"{k}.npy"), mmap_mode="r") for k in COLS}
T = np.load(os.path.join(W, "p_t.npy"), mmap_mode="r"); V = np.load(os.path.join(W, "p_v.npy"), mmap_mode="r")
hmm = json.load(open(os.path.join(W, "hmm.json")))
vess = json.load(open(os.path.join(W, "vessels.json"))); nV = len(vess)
GEARS = ["vay", "cau", "re", "keo", "chup", "khac", "?"]
LC = ["<12", "12-15", "15-24", ">=24", "?"]
lens = np.array([x.get("len") if isinstance(x.get("len"), (int, float)) else np.nan for x in vess], np.float32)
lc_v = np.array([4 if not np.isfinite(m) else (0 if m < 12 else 1 if m < 15 else 2 if m < 24 else 3) for m in lens], np.int8)
gear_of_v = np.array([GEARS.index(x.get("gear", "?")) if x.get("gear", "?") in GEARS else 6 for x in vess], np.int8)
vb = np.searchsorted(V, np.arange(nV + 1))
LB = defaultdict(list)
for r in json.load(open(os.path.join(W, "trips.json"))): LB[r["v"]].append(r)

# ── 5 pha CỐ ĐỊNH NGHĨA (02_phase.py, tiền nghiệm theo nghề): 0 đứng/neo · 1 trôi · 2 làm lưới · 3 dò · 4 chạy
PH = ["dung", "troi", "lam", "do", "chay"]
pmap = np.tile(np.arange(5, dtype=np.int8), (7, 1)); phase_map = {g_: PH for g_ in hmm}
BANDS = [(0.3, 1), (0.6, 5), (0.3, 2), (1, 2.5), (0.3, 1), (0.3, 2.5), (0.3, 2.5)]

def hav(a1, b1, a2, b2):
    r = math.pi / 180; x = np.sin((a2 - a1) * r / 2) ** 2 + np.cos(a1 * r) * np.cos(a2 * r) * np.sin((b2 - b1) * r / 2) ** 2
    return 2 * 6371 * np.arcsin(np.sqrt(np.clip(x, 0, 1)))

KB = np.arange(0, 25.01, 0.1)
HIST = defaultdict(lambda: np.zeros(len(KB) - 1))
FBH = defaultdict(lambda: np.zeros(24))
TR, GRD, LEG, ROWS, DAYD, SENS, SENSN = [], [], [], [], [], [], []
vmed = np.full(nV, np.nan)
GK = defaultdict(float); GV = defaultdict(int)
EPH = defaultdict(lambda: np.zeros(73)); EPS = defaultdict(lambda: np.zeros(24)); LAMH = defaultdict(lambda: np.zeros(73)); LAMS = defaultdict(lambda: np.zeros(24)); LAMK = defaultdict(lambda: np.zeros(250))

def episodes(fs, dd):
    """chuỗi đánh liền (cho xen ≤ 1 đoạn không đánh), ≥ 1 giờ → [(i, j, giờ)]"""
    out = []; i = 0; n = len(fs)
    while i < n:
        if not fs[i]: i += 1; continue
        j = i
        while j + 1 < n and (fs[j + 1] or (j + 2 < n and fs[j + 2])): j += 1
        h = float((dd[i:j + 1] * fs[i:j + 1]).sum())
        if h >= 1: out.append((i, j, h))
        i = j + 1
    return out

def _runs(m):
    d = np.diff(np.r_[0, m.astype(np.int8), 0]); return np.flatnonzero(d == 1), np.flatnonzero(d == -1) - 1

def tu_do(t, pk, dth, kn, Rp=3.0, Rs=5.0, Vs=0.5, S=4.0, Hmin=4.0, Rmin=6.0, VKM=20.0):
    """Tự dò chuyến từ vết (v3, 09/11). Ở cảng = trong Rp km tâm cảng, HOẶC đứng yên (< Vs kn) trong Rs km (bến lệch tâm cảng 3–5 km).
    Chuỗi ở cảng ≥ S giờ (hoặc dính mất tín hiệu) mới ngắt chuyến — ghé ngang cảng không xé chuyến. Mất tín hiệu ngoài biển chỉ ngắt
    khi đủ giờ chạy vào bờ, ở ≥ S giờ, ra lại (VKM km/h). Chuyến hợp lệ: ≥ Hmin giờ ngoài vùng cảng, ra xa ≥ Rmin km.
    Chấm với giờ rời/cập khai báo (tàu giữ riêng): khớp IoU≥0,7 51 % → 54 %, xé 14 → 9 %, trượt 25 → 19 %, chuyến đoán đúng 39 → 47 %."""
    n = len(t); inp = (pk <= Rp) | ((pk <= Rs) & (np.nan_to_num(kn, nan=0.0) < Vs))
    pk1 = np.r_[pk[1:], pk[-1]]
    B = (dth > 4) & (dth * VKM >= pk + pk1 + VKM * S)
    s_, e_ = _runs(inp)
    for a_, b_ in zip(s_, e_):
        if (t[min(b_ + 1, n - 1)] - t[a_]) / 3600 >= S or a_ == 0 or b_ == n - 1 or (dth[a_:b_ + 1] > 4).any(): B[a_:b_ + 1] = True
    dd = np.where(dth > 4, 0, dth); out = []
    s_, e_ = _runs(~B)
    for a_, b_ in zip(s_, e_):
        while a_ <= b_ and inp[a_]: a_ += 1
        while b_ >= a_ and inp[b_]: b_ -= 1
        if a_ <= b_ and dd[a_:b_ + 1][~inp[a_:b_ + 1]].sum() >= Hmin and pk[a_:b_ + 1].max() >= Rmin: out.append((a_, b_))
    return out

def chuyen_tau(t, pk, dth, kn, lb):
    """[(i0, i1, nguồn)] chỉ số đoạn đầu/cuối mỗi chuyến của MỘT tàu. nguồn 1 = giờ đi/về VMS Data Lake (khớp khai báo 76 %),
    0 = tự dò (tu_do) cho khoảng không có chuyến khai báo (chuyến không khai, tháng mới chưa có bản chuyến)."""
    dl = []
    for r in lb:
        i0 = int(np.searchsorted(t, r["dep"])); i1 = int(np.searchsorted(t, r["arr"])) - 1
        i0 = max(i0, 0); i1 = min(i1, len(t) - 1)
        if i1 > i0: dl.append((i0, i1, 1))
    dl.sort(); kq = []
    for x in dl:  # chuyến khai chồng nhau: giữ chuyến trước, cắt phần chồng
        if kq and x[0] <= kq[-1][1]:
            if x[1] > kq[-1][1]: kq.append((kq[-1][1] + 1, x[1], 1))
        else: kq.append(x)
    kq = [x for x in kq if x[1] > x[0]]
    for a_, b_ in tu_do(t, pk, dth, kn):
        if not any(min(b_, y) >= max(a_, x) for x, y, _ in kq): kq.append((a_, b_, 0))
    return sorted(kq)

# v3 (09/11): SỐ MẺ ƯỚC theo nghề — đặc trưng + hệ số chọn trên tàu lẻ, chấm trên tàu chẵn với số mẻ khai nhật ký (out/me-uoc.json, me.py).
# Tương quan hạng so với số mẻ khai: vây 0,20→0,35 · câu 0,03→0,26 · rê 0,29→0,41 · kéo 0,31→0,37 · chụp −0,12→0,10 · khác 0,30→0,45.
ME = json.load(open(os.path.join(O, "me-uoc.json")))
def me_uoc(gn, fs, d_, night_sl, day_sl):
    c = ME.get(gn)
    if not c: return np.nan
    fh = d_ * fs; dt_ = c["dac_trung"]
    if dt_ == "giờ đánh": x = float(fh.sum())
    elif dt_ == "giờ đánh đêm": x = float((fh * night_sl).sum())
    elif dt_.startswith("ngày≥"):
        k = float(dt_[5:-1].replace(",", ".")); x = float((np.bincount(day_sl - day_sl.min(), weights=fh) >= k).sum())
    elif dt_ == "mẻ xen8 ≥2h":
        idx = np.flatnonzero(fs)
        if not len(idx): x = 0.0
        else:
            br = np.flatnonzero(np.diff(idx) > 9); st_ = np.r_[idx[0], idx[br + 1]]; en_ = np.r_[idx[br], idx[-1]]
            cs_ = np.r_[0, np.cumsum(fh)]; x = float(((cs_[en_ + 1] - cs_[st_]) >= 2).sum())
    else: return np.nan
    return round(c["he_so"] * x, 2)

BLK = 1500
for va in range(0, nV, BLK):
    vbb = min(va + BLK, nV); a, b = vb[va], vb[vbb]
    if b <= a: continue
    X = {k: np.asarray(C[k][a:b]) for k in COLS}; t = np.asarray(T[a:b]); v = np.asarray(V[a:b])
    kn, dth, portkm, vnh, lat, lon, gap, g, st, km = X["kn"], X["dth"], X["portkm"], X["vnh"], X["lat"], X["lon"], X["gap"], X["g"], X["state"], X["km"]
    phase = np.where(st >= 0, pmap[g.astype(int), np.clip(st, 0, 4)], -1)
    night = (vnh >= 18) | (vnh < 6); atsea = (~gap) & (portkm > 10)
    fish = np.zeros(len(v), bool)
    for gi, gname in enumerate(GEARS):
        s = (g == gi) & atsea
        # v2: KHÔNG dùng giờ trong định nghĩa (phản biện: vòng lặp định nghĩa–kiểm định). Tỉ lệ đêm thành phép KIỂM thật.
        if gname == "keo": fish |= s & ((phase == 2) | ((phase == 3) & (kn >= 1.8) & (kn <= 4.2)))  # kéo vòng/quay đầu cuối mẻ
        elif gname in ("vay", "chup"): fish |= s & (phase >= 0) & (phase <= 2)  # đứng đèn/trôi neo dù/quây — đêm hay ngày do dữ liệu nói
        elif gname == "cau": fish |= s & (phase >= 0) & (phase <= 2)
        else: fish |= s & ((phase == 1) | (phase == 2))  # rê: ngâm trôi + thả/thu
    old = np.zeros(len(v), bool)
    for gi in range(7):
        lo_, hi_ = BANDS[gi]; s = (g == gi) & atsea
        old |= s & (kn >= lo_) & (kn <= hi_)
        if gi == 0: old |= s & night & (kn < lo_)
    dd = np.where(gap, 0, dth).astype(np.float32)
    lcs = lc_v[v]
    for kind, m in (("run", atsea & (phase == 4)), ("fish", fish), ("moving", atsea & (kn > 0.3))):
        for gi in range(6):
            for lc in range(5):
                mm = m & (g == gi) & (lcs == lc)
                if mm.any(): HIST[(gi, lc, kind)] += np.histogram(kn[mm], KB, weights=dd[mm])[0]
    for gi in range(6):
        for lc in range(5):
            mm = fish & (g == gi) & (lcs == lc)
            if mm.any(): FBH[(gi, lc)] += np.bincount(vnh[mm].astype(int) % 24, weights=dd[mm], minlength=24)
    for vi in range(va, vbb):
        s0, s1 = vb[vi] - a, vb[vi + 1] - a
        m = atsea[s0:s1] & (phase[s0:s1] == 4)
        if dd[s0:s1][m].sum() >= 20:
            vals = kn[s0:s1][m]; w = dd[s0:s1][m]; o = np.argsort(vals); c = np.cumsum(w[o]); vmed[vi] = vals[o][np.searchsorted(c, c[-1] / 2)]
    tmid = (t + np.where(gap, 0, dth) * 1800).astype(np.int64)  # trung điểm đoạn (phản biện B10)
    mon = tmid.astype("datetime64[s]").astype("datetime64[M]").astype(np.int64)
    cla = np.floor((lat - 5) / 0.25).astype(np.int64); clo = np.floor((lon - 102) / 0.25).astype(np.int64)
    okc = fish & (cla >= 0) & (cla < 72) & (clo >= 0) & (clo < 72)
    key = ((g[okc].astype(np.int64) * 1000 + mon[okc]) * 72 + cla[okc]) * 72 + clo[okc]
    if len(key):
        uk, inv = np.unique(key, return_inverse=True)
        for k_, h_ in zip(uk, np.bincount(inv, weights=dd[okc])): GK[int(k_)] += float(h_)
        for k_ in np.unique(np.stack([key, v[okc].astype(np.int64)], 1), axis=0)[:, 0]: GV[int(k_)] += 1
    # chuỗi liền của một mặt nạ (không gap), cùng tàu → (thời lượng giờ, giờ VN bắt đầu)
    def runs(mask):
        m = mask & ~gap
        st_ = np.flatnonzero(m & ~np.r_[False, m[:-1]]); en_ = np.flatnonzero(m & ~np.r_[m[1:], False])
        cs = np.r_[0, np.cumsum(dd)]
        return cs[en_ + 1] - cs[st_], vnh[st_], st_, en_
    for gi in range(6):
        h_, s_, _, _ = runs(fish & (g == gi))
        EPH[gi] += np.bincount(np.minimum(h_.astype(int), 72), minlength=73); EPS[gi] += np.bincount(s_.astype(int) % 24, minlength=24)
        h_, s_, _, _ = runs(atsea & (phase == 2) & (g == gi))
        LAMH[gi] += np.bincount(np.minimum(h_.astype(int), 72), minlength=73); LAMS[gi] += np.bincount(s_.astype(int) % 24, minlength=24)
        mm = atsea & (phase == 2) & (g == gi)
        if mm.any(): LAMK[gi] += np.histogram(kn[mm], KB, weights=dd[mm])[0]
    # v3 (09/11): ranh chuyến = giờ đi/về VMS Data Lake (đã khớp khai báo) khi có, ngoài ra tự dò theo ở-cảng (chuyen_tau)
    TRIPS = []
    for vi in range(va, vbb):
        s0, s1 = vb[vi] - a, vb[vi + 1] - a
        if s1 - s0 < 2: continue
        for i0, i1, ng in chuyen_tau(t[s0:s1], portkm[s0:s1], dth[s0:s1], kn[s0:s1], LB.get(vi, [])):
            TRIPS.append((s0 + i0, i1 - i0 + 1, ng))
    if TRIPS:
        for f0, n, nguon in TRIPS:
            sl = slice(f0, f0 + n); hrs = float(dd[sl].sum())
            if hrs < 6: continue
            vv = int(v[f0]); gi = int(g[f0]); lc = int(lc_v[vv])
            big_gap = int((dth[f0:f0 + n - 1] > 4).sum())
            fs = fish[sl]; ph = phase[sl]; d_ = dd[sl]
            eps = episodes(fs, d_)
            cen_eps = []
            for (i, j, h) in eps:
                w = d_[i:j + 1] * fs[i:j + 1] + 1e-9
                cen_eps.append((i, j, h, float(np.average(lat[f0 + i:f0 + j + 1], weights=w)), float(np.average(lon[f0 + i:f0 + j + 1], weights=w))))
            def gom(thr):
                """gom TOÀN CỤC: mẻ vào vùng có tâm gần nhất ≤ thr km (không chỉ vùng liền trước — phản biện B4)"""
                gs = []
                for (i, j, h, la_, lo_) in cen_eps:
                    best = None
                    if gs:
                        dist = [hav(G["la"], G["lo"], la_, lo_) for G in gs]; k = int(np.argmin(dist))
                        if dist[k] <= thr: best = gs[k]
                    if best is None: gs.append({"i": i, "j": j, "la": la_, "lo": lo_, "h": h, "n": 1, "eps": [(i, j)]})
                    else:
                        G = best; G["j"] = max(G["j"], j); G["h"] += h; G["la"] += (la_ - G["la"]) * h / G["h"]; G["lo"] += (lo_ - G["lo"]) * h / G["h"]; G["n"] += 1; G["eps"].append((i, j))
                return gs
            for thr in (10, 35, 55):
                gs = gom(thr)
                if big_gap == 0 and hrs >= 24: SENSN.append((gi, thr, len(gs)))
                for G in gs:
                    idx = np.concatenate([np.arange(a_, b_ + 1) for a_, b_ in G["eps"]]); idx = idx[fs[idx]]
                    r90 = float(np.percentile(hav(lat[f0 + idx], lon[f0 + idx], G["la"], G["lo"]), 90)) if len(idx) else np.nan
                    SENS.append((gi, thr, r90, len(gs)))
            grounds = gom(20)
            if big_gap == 0 and hrs >= 24: SENSN.append((gi, 20, len(grounds)))
            # chặng cần thứ tự thời gian: vùng theo lượt ghé (mỗi lần quay lại = một lượt ghé)
            visits = []
            for (i, j, h, la_, lo_) in cen_eps:
                if visits and hav(visits[-1]["la"], visits[-1]["lo"], la_, lo_) <= 20: visits[-1]["j"] = j
                else: visits.append({"i": i, "j": j, "la": la_, "lo": lo_})
            for G in grounds:
                idx = np.concatenate([np.arange(a_, b_ + 1) for a_, b_ in G["eps"]]); idx = idx[fs[idx]]
                dist = hav(lat[f0 + idx], lon[f0 + idx], G["la"], G["lo"])
                GRD.append((gi, lc, float(np.percentile(dist, 90)) if len(dist) else np.nan, float(d_[G["i"]:G["j"] + 1].sum()), G["h"], G["n"]))
            mon0 = int(mon[f0])
            if big_gap == 0 and grounds:
                # v2: chặng ĐIỂM–ĐIỂM (đoạn đánh cuối của vùng trước → đoạn đánh đầu của vùng sau; cảng = đoạn đầu/cuối chuyến),
                # km thẳng và giờ cùng hai đầu mút (trung điểm đoạn). Loại: 0 cảng→vùng · 1 vùng→vùng · 2 vùng→cảng
                ends = [(0, 0)] + [(G["i"], G["j"]) for G in visits] + [(n - 1, n - 1)]
                for k in range(len(ends) - 1):
                    e0 = ends[k][1]; s1 = ends[k + 1][0]
                    if s1 <= e0: continue
                    hh = float(0.5 * d_[e0] + d_[e0 + 1:s1].sum() + 0.5 * d_[s1])
                    kk = float(hav(lat[f0 + e0], lon[f0 + e0], lat[f0 + s1], lon[f0 + s1]))
                    path = float(0.5 * km[f0 + e0] + km[f0 + e0 + 1:f0 + s1].sum() + 0.5 * km[f0 + s1])
                    runh = float((d_[e0:s1 + 1] * (ph[e0:s1 + 1] == 4)).sum())
                    typ = 0 if k == 0 else (2 if k == len(ends) - 2 else 1)
                    if kk >= 15 and hh > 0.5: LEG.append((gi, lc, vv, mon0, kk, hh, path, runh, typ))
            # v2: dịch chuyển tâm đánh giữa hai NGÀY liền (không phụ thuộc ngưỡng gộp vùng 20 km)
            if big_gap == 0 and fs.any():
                day = ((tmid[sl] + 7 * 3600) // 86400).astype(np.int64)
                w = d_ * fs
                ud = np.unique(day[fs]); cen = []
                for dd0 in ud:
                    m = (day == dd0) & fs
                    if w[m].sum() >= 3: cen.append((dd0, float(np.average(lat[sl][m], weights=w[m])), float(np.average(lon[sl][m], weights=w[m]))))
                for x0, x1 in zip(cen[:-1], cen[1:]):
                    if x1[0] - x0[0] == 1: DAYD.append((gi, lc, float(hav(x0[1], x0[2], x1[1], x1[2]))))
            TR.append((vv, gi, lc, mon0, hrs, big_gap, float((d_ * fs).sum()), float((d_ * old[sl]).sum()), len(eps), len(grounds), float(portkm[sl].max()),
                       *[float((d_ * (ph == k)).sum()) for k in range(5)],
                       float(hav(lat[f0], lon[f0], grounds[0]["la"], grounds[0]["lo"])) if grounds else np.nan, len(visits), nguon,
                       float(t[f0]), float(t[f0 + n - 1] + dth[f0 + n - 1] * 3600),
                       me_uoc(GEARS[gi], fs, d_, night[sl], ((tmid[sl] + 7 * 3600) // 86400).astype(np.int64))))
    for vi in range(va, vbb):
        s0, s1 = vb[vi] - a, vb[vi + 1] - a
        if s1 - s0 < 5: continue
        tv = t[s0:s1]
        for r in LB.get(vi, []):
            i0 = s0 + np.searchsorted(tv, r["dep"]); i1 = s0 + np.searchsorted(tv, r["arr"])
            if i1 - i0 < 5: continue
            d_ = dd[i0:i1]; tripH = (r["arr"] - r["dep"]) / 3600
            if d_.sum() / max(tripH, 1) < 0.6: continue
            ROWS.append((int(g[i0]), tripH, float((d_ * fish[i0:i1]).sum()), float((d_ * old[i0:i1]).sum()), len(episodes(fish[i0:i1], d_)),
                         r["h"] if r["h"] is not None else np.nan, r["kg"] if r["kg"] is not None else np.nan, vi))
    log("khối", va // BLK, "chuyến", len(TR), "nhật ký", len(ROWS))
    del X

TR = np.array(TR, float); GRA = np.array(GRD, float); LEGA = np.array(LEG, float); R_ = np.array(ROWS, float)
np.save(os.path.join(W, "tr.npy"), TR); np.save(os.path.join(W, "legs.npy"), LEGA); np.save(os.path.join(W, "grd.npy"), GRA); np.save(os.path.join(W, "rows.npy"), R_)
np.save(os.path.join(W, "vmed.npy"), vmed); np.save(os.path.join(W, "dayd.npy"), np.array(DAYD, float)); np.save(os.path.join(W, "sens.npy"), np.array(SENS, float)); np.save(os.path.join(W, "sensn.npy"), np.array(SENSN, float))
import pickle
pickle.dump({"HIST": dict(HIST), "FBH": dict(FBH), "GK": dict(GK), "GV": dict(GV), "phase_map": phase_map, "EPH": dict(EPH), "EPS": dict(EPS), "LAMH": dict(LAMH), "LAMS": dict(LAMS), "LAMK": dict(LAMK)}, open(os.path.join(W, "agg.pkl"), "wb"))
log("chuyến", len(TR), "vùng", len(GRA), "chặng", len(LEGA), "nhật ký", len(R_))
