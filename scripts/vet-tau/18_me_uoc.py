# Ước SỐ MẺ từ vết: thử nhiều cách đếm, chọn theo nghề trên tàu LẺ, chấm trên tàu CHẴN (tương quan hạng với số mẻ khai trong nhật ký)
import json, os, time, numpy as np
H = os.path.expanduser("~/fish-vet"); W = f"{H}/work"; SD = f"{W}/seg"; t0 = time.time()
COLS = ["kn", "dth", "portkm", "vnh", "gap", "g", "state"]
C = {k: np.load(f"{SD}/{k}.npy", mmap_mode="r") for k in COLS}
T = np.load(f"{W}/p_t.npy", mmap_mode="r"); V = np.load(f"{W}/p_v.npy", mmap_mode="r")
vess = json.load(open(f"{W}/vessels.json")); nV = len(vess); vb = np.searchsorted(V, np.arange(nV + 1))
LB = {}
for r in json.load(open(f"{W}/trips.json")):
    if r["h"]: LB.setdefault(r["v"], []).append(r)
GEARS = ["vay", "cau", "re", "keo", "chup", "khac", "?"]
def fishmask(g, ph, kn, atsea):
    f = np.zeros(len(g), bool)
    for gi, gn in enumerate(GEARS):
        s = (g == gi) & atsea
        if gn == "keo": f |= s & ((ph == 2) | ((ph == 3) & (kn >= 1.8) & (kn <= 4.2)))
        elif gn in ("vay", "chup", "cau"): f |= s & (ph >= 0) & (ph <= 2)
        else: f |= s & ((ph == 1) | (ph == 2))
    return f
def eps(fs, dd, tol, hmin):
    """chuỗi đánh, cho xen ≤ tol đoạn không đánh, ≥ hmin giờ"""
    idx = np.flatnonzero(fs)
    if not len(idx): return 0
    br = np.flatnonzero(np.diff(idx) > tol + 1); st = np.r_[idx[0], idx[br + 1]]; en = np.r_[idx[br], idx[-1]]
    cs = np.r_[0, np.cumsum(dd * fs)]; h = cs[en + 1] - cs[st]
    return int((h >= hmin).sum())
F = []  # gear, vi, haul, kg, tripH, fishH, d1, d2, d4, d6, e(1,1), e(1,0.5), e(2,1), e(4,1), e(2,2), e(8,2), dem (giờ đánh đêm)
for vi in range(nV):
    if vi not in LB: continue
    a, b = vb[vi], vb[vi + 1]
    if b - a < 10: continue
    t = np.asarray(T[a:b]); X = {k: np.asarray(C[k][a:b]) for k in COLS}
    ph = np.where(X["state"] >= 0, np.clip(X["state"], 0, 4), -1)
    atsea = (~X["gap"]) & (X["portkm"] > 10); fish = fishmask(X["g"], ph, X["kn"], atsea)
    dd = np.where(X["gap"], 0, X["dth"]).astype(np.float32)
    day = ((t + 7 * 3600) // 86400)
    night = (X["vnh"] >= 18) | (X["vnh"] < 6)
    for r in LB[vi]:
        i0, i1 = np.searchsorted(t, r["dep"]), np.searchsorted(t, r["arr"])
        if i1 - i0 < 5: continue
        L = (r["arr"] - r["dep"]) / 3600
        if dd[i0:i1].sum() / max(L, 1) < 0.6: continue
        fs = fish[i0:i1]; d_ = dd[i0:i1]; fh = d_ * fs
        dsum = np.bincount((day[i0:i1] - day[i0]).astype(int), weights=fh)
        F.append((int(X["g"][i0]), vi, r["h"], r["kg"] or np.nan, L, fh.sum(), *(int((dsum >= k).sum()) for k in (1, 2, 4, 6)),
                  eps(fs, d_, 1, 1), eps(fs, d_, 1, 0.5), eps(fs, d_, 2, 1), eps(fs, d_, 4, 1), eps(fs, d_, 2, 2), eps(fs, d_, 8, 2), float((fh * night[i0:i1]).sum())))
F = np.array(F, float); np.save(f"{W}/me-dac-trung.npy", F)
TEN = ["giờ chuyến", "giờ đánh", "ngày đánh≥1h", "ngày≥2h", "ngày≥4h", "ngày≥6h", "mẻ xen1 ≥1h (cũ)", "mẻ xen1 ≥0,5h", "mẻ xen2 ≥1h", "mẻ xen4 ≥1h", "mẻ xen2 ≥2h", "mẻ xen8 ≥2h", "giờ đánh đêm"]
rk = lambda a: np.argsort(np.argsort(a, kind="stable"), kind="stable")
sp = lambda x, y: float(np.corrcoef(rk(x), rk(y))[0, 1]) if len(x) > 30 and np.std(x) > 0 else np.nan
print(f"{len(F)} chuyến có nhật ký ghi số mẻ · {time.time()-t0:.0f}s")
CHON = {}
for gi, gn in enumerate(GEARS[:6]):
    m = (F[:, 0] == gi) & (F[:, 2] > 0)
    hoc = m & (F[:, 1] % 2 == 1); thu = m & (F[:, 1] % 2 == 0)
    s_hoc = [sp(F[hoc, 4 + j], F[hoc, 2]) for j in range(len(TEN))]
    j = int(np.nanargmax(s_hoc)); s_thu = sp(F[thu, 4 + j], F[thu, 2]); cu = sp(F[thu, 10], F[thu, 2])
    # hệ số: mẻ ≈ k × đặc trưng (trung vị tỉ số, trên tàu học)
    x = F[hoc, 4 + j]; ok = x > 0; k = float(np.median(F[hoc, 2][ok] / x[ok])) if ok.any() else np.nan
    err_moi = np.median(np.abs(k * F[thu, 4 + j] - F[thu, 2]) / F[thu, 2]); err_cu = np.median(np.abs(F[thu, 10] - F[thu, 2]) / F[thu, 2])
    CHON[gn] = {"dac_trung": TEN[j], "cot": 4 + j, "he_so": round(k, 3)}
    print(f"{gn:5} n={int(m.sum()):6d} chọn «{TEN[j]}» × {k:.2f} · tương quan hạng (tàu chấm) {s_thu:.2f} (cũ {cu:.2f}) · sai số tương đối p50 {err_moi:.0%} (cũ {err_cu:.0%})")
    print("      tất cả (học):", " · ".join(f"{t_} {s:.2f}" for t_, s in zip(TEN, s_hoc)))
json.dump(CHON, open(f"{H}/out/me-uoc.json", "w"), ensure_ascii=False, indent=1)
