import sys, os, itertools
D_ = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(D_, "lib_cham.py"), encoding="utf-8").read()); exec(open(os.path.join(D_, "lib_moi.py"), encoding="utf-8").read())
STEP = int(os.environ.get("STEP", "4")); OFF = int(os.environ.get("OFF", "0"))
CF = {"cu": None}
CF["moi (Rp3 Rs5 S4)"] = (3, 4, 4, 6, 5, 0.5)
CF["datalake"] = "dl"; CF["lai: datalake + moi"] = "lai"
DL = {}
for r in A:
    if r[3] > 0 and r[4] > r[3]: DL.setdefault(int(r[0]), []).append((r[3], r[4]))
if os.environ.get("CF"): CF = {"cu": None, **{k: v for k, v in CF.items() if k in os.environ["CF"].split(",")}}
def lai(vi, t, pk, dth, kn):
    d = DL.get(vi, []); m = moi2(t, pk, dth, 3, 4, 4, 6, Rs=5, kn=kn)
    return d + [(a, b) for a, b in m if not any(min(b, y) - max(a, x) > 0 for x, y in d)]
TOT = {k: None for k in CF}; dung = 0
for vi in range(OFF, nV, STEP):
    if vi not in TH: continue
    a, b = vb[vi], vb[vi + 1]
    if b - a < 50: continue
    t = np.asarray(T[a:b]); pk = np.asarray(C["portkm"][a:b]); dth = np.asarray(C["dth"][a:b]); kn = np.asarray(C["kn"][a:b])
    dd = np.where(dth > 4, 0, dth); cs = np.r_[0, np.cumsum(dd)]
    tru = []
    for x, y in TH[vi]:
        L = (y - x) / 3600
        if not 6 <= L <= 1440: continue
        i0, i1 = np.searchsorted(t, x), np.searchsorted(t, y)
        if i1 - i0 < 5 or (cs[i1] - cs[i0]) / L < 0.6: continue
        tru.append((x, y))
    if not tru: continue
    dung += 1; lo_, hi_ = min(x for x, _ in tru), max(y for _, y in tru)
    for k, p in CF.items():
        pr = cu(t, pk, dth) if p is None else DL.get(vi, []) if p == "dl" else lai(vi, t, pk, dth, kn) if p == "lai" else moi2(t, pk, dth, *p[:4], Rs=p[4] if len(p) > 4 else 0, kn=kn, Vs=p[5] if len(p) > 5 else 0.5)
        r = cham(pr, tru, lo_, hi_)
        if TOT[k] is None: TOT[k] = r
        else:
            for kk in r: TOT[k][kk] += r[kk]
print(f"tàu {dung} · {time.time()-t0_:.0f}s")
rows = []
for k, r in TOT.items():
    n = r["n"]; f1 = 2 * (r["khop"] / n) * (r["pr_khop"] / max(1, r["pr"])) / max(1e-9, r["khop"] / n + r["pr_khop"] / max(1, r["pr"]))
    q = lambda L: "/".join(f"{v:.1f}" for v in np.percentile(L, [50, 90])) if L else "-"
    rows.append((f1, f"{k:22} {n:7d} khớp {100*r['khop']/n:5.1f} xé {100*r['xe']/n:5.1f} gộp {100*r['gop']/n:5.1f} trượt {100*r['truot']/n:5.1f} | đi {q(r['e_di']):>9} về {q(r['e_ve']):>9} | đoán {r['pr']:6d} đúng {100*r['pr_khop']/max(1,r['pr']):5.1f} | F {f1:.3f}"))
for f1, s in sorted(rows, reverse=True)[:12]: print(s)
print([s for f, s in rows if s.startswith("cu ")][0])
