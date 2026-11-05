#!/usr/bin/env python3
"""ĐO "LỚP NGÀY" Ở CẤP CHUYẾN (2026-11-05, README rà train §7.13; anh Long: "Đo cấp chuyến").

Vì sao: §7.8/§7.11/§7.12 đo ở cấp Ô và thua hết, mà nhãn chia đều kg theo giờ trong chuyến ⇒ mọi ô của một chuyến cùng
năng suất, phép đo ô không thể thấy tín hiệu ngày. Ở cấp CHUYẾN thì nhãn là thật: kg loài / giờ đánh của cả chuyến.

Câu hỏi: biết nghề, cỡ tàu, tháng, vùng, giờ đánh (= cái "nền" đã biết) rồi, thì dị thường vệ tinh + thời tiết TRUNG
BÌNH THEO GIỜ dọc các ô–ngày chuyến đã đánh có dự báo thêm được năng suất cả chuyến không?

  y      = log((kg loài đích + 1) / giờ đánh)   — trips.ndjson của dl-build-labels --v2 --trips (kg đã nhân tin cậy)
  NỀN    = nghề × lớp dài · tháng × vùng 2° (trọng tâm theo giờ; mức < 20 chuyến gộp "khác" theo tháng) · log giờ đánh
           · log độ dài chuyến
  ĐỘNG   = 6 dị thường chuẩn hoá (theo trung bình tháng của ô): SST, log phù du, front nhiệt |∇SST|, gió, sóng, mây
  Kiểm chéo: 5 nếp cặp tháng lịch, đệm 15 ngày (bỏ chuyến train có ngày giữa trong 15 ngày quanh nếp thử).
  Số đo: R² và Spearman ngoài nếp (trọng số = tin cậy chuyến); Δ = ĐỘNG − NỀN; bootstrap khối TUẦN (B lần) cho CI 90 %.
  ĐỐI CHỨNG ĐỘNG: cùng ô, dị thường lấy của ngày LỆCH ±15 ⇒ Δđộng = Δ thật − Δ lệch (chỉ phần "hôm nay").
  ĐỐI CHỨNG DƯƠNG (--oracle): thêm một đặc trưng = y + nhiễu (σ = 2·sd y) — phải thắng, nếu không là bộ đo hỏng.
  THẮNG = ΔSpearman ≥ +0,01, cận dưới CI Δ R² > 0, cận dưới CI Δđộng R² > 0.

Dùng: do-cap-chuyen.py --trips <thư mục chứa các khúc/*/trips.ndjson> --grids <fc-full/grids> --thoi-tiet <dir>
      [--species "ngừ vằn,…"] [--boot 500] [--out kq.json] [--oracle]
"""
from __future__ import annotations

import json, math, re, sys
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

import numpy as np

ASFIS = None  # đọc từ scripts/dl-eval.mjs (MỘT nguồn bảng mã loài)
TG_SHARE = 0.1  # = dl-eval.mjs TG_SHARE: nghề chiếm ≥ 10 % kg loài là nghề mục tiêu
LAT0, LON0, STEP, NLAT, NLON = 5.025, 102.025, 0.25, 69, 65
LAT = LAT0 + STEP * np.arange(NLAT)
LON = LON0 + STEP * np.arange(NLON)
KENH = ["sst", "logChl", "frontNhiệt", "gio", "song", "may"]
SHIFT = 15


def arg(k, d=None):
    return sys.argv[sys.argv.index(f"--{k}") + 1] if f"--{k}" in sys.argv else d


def doc_asfis(repo: Path) -> dict:
    s = (repo / "scripts/dl-eval.mjs").read_text()
    i = s.index("export const ASFIS_TO_SHORT = {")
    return dict(re.findall(r'([A-Z0-9]{3})\s*:\s*"([^"]+)"', s[i : s.index("};", i)]))


def ve_truc(lat, lon, v):
    io, jo = np.argsort(lat), np.argsort(lon)
    lat, lon, v = lat[io], lon[jo], v[io][:, jo]
    ii = np.clip(np.searchsorted(lat, LAT), 1, len(lat) - 1)
    ii = np.where(np.abs(lat[ii - 1] - LAT) < np.abs(lat[ii] - LAT), ii - 1, ii)
    jj = np.clip(np.searchsorted(lon, LON), 1, len(lon) - 1)
    jj = np.where(np.abs(lon[jj - 1] - LON) < np.abs(lon[jj] - LON), jj - 1, jj)
    out = v[np.ix_(ii, jj)].astype(np.float64)
    out[(np.abs(lat[ii] - LAT)[:, None] > 0.13) | (np.abs(lon[jj] - LON)[None, :] > 0.13)] = np.nan
    return out


def bang(p: Path):
    t = json.loads(p.read_text())["table"]
    rows = t["rows"]
    lat = np.array([r[-3] for r in rows], dtype=float)
    lon = np.array([r[-2] for r in rows], dtype=float)
    v = np.array([np.nan if r[-1] is None else r[-1] for r in rows], dtype=float)
    ul, uo = np.unique(lat), np.unique(lon)
    g = np.full((len(ul), len(uo)), np.nan)
    g[np.searchsorted(ul, lat), np.searchsorted(uo, lon)] = v
    return ul, uo, g


def luoi_ngay(grids: Path, tt: Path, days: list[str]) -> dict[str, np.ndarray]:
    """{ngày: [6 kênh, NLAT, NLON]} giá trị THÔ trên trục 0,25°."""
    out = {}
    for d in days:
        a = np.full((len(KENH), NLAT, NLON), np.nan)
        ps, pc, pw = grids / f"sst-{d}.json", grids / f"chl-{d}.json", tt / f"w-{d}.json"
        if ps.exists():
            ul, uo, g = bang(ps)
            if np.nanmedian(g) > 200:
                g = g - 273.15
            a[0] = ve_truc(ul, uo, g)
            gy, gx = np.gradient(a[0])  # front nhiệt: |∇SST| (°C mỗi ô 0,25°)
            a[2] = np.hypot(gy, gx)
        if pc.exists():
            ul, uo, g = bang(pc)
            a[1] = ve_truc(ul, uo, np.where(g > 0, np.log10(np.where(g > 0, g, 1)), np.nan))
        if pw.exists():
            vals = json.loads(pw.read_text())["values"]
            for k, ch in zip((3, 4, 5), vals):
                if ch is not None:
                    a[k] = np.array([np.nan if x is None else x for x in ch], dtype=float).reshape(NLAT, NLON)
        out[d] = a
    return out


def di_thuong(raw: dict[str, np.ndarray]) -> dict[str, np.ndarray]:
    """Dị thường theo trung bình THÁNG của chính ô, chuẩn hoá bằng độ lệch chuẩn toàn cục mỗi kênh, kẹp ±4."""
    by_m = defaultdict(list)
    for d, a in raw.items():
        by_m[d[:7]].append(a)
    mean = {}
    for m, xs in by_m.items():
        with np.errstate(all="ignore"), __import__("warnings").catch_warnings():
            __import__("warnings").simplefilter("ignore")
            mean[m] = np.nanmean(np.stack(xs), 0)
    an = {d: a - mean[d[:7]] for d, a in raw.items()}
    sd = np.array([np.nanstd(np.stack([an[d][k] for d in an])) for k in range(len(KENH))])
    sd = np.where(sd > 0, sd, 1)
    return {d: np.clip(a / sd[:, None, None], -4, 4) for d, a in an.items()}


def doc_chuyen(root: Path) -> list[dict]:
    out = []
    for f in sorted(root.glob("*/trips.ndjson")):
        for line in f.read_text().splitlines():
            if line.strip():
                out.append(json.loads(line))
    seen, uniq = set(), []
    for t in out:  # khúc cửa sổ chia theo ngày rời bến ⇒ không trùng, nhưng phòng hờ
        if t["id"] not in seen:
            seen.add(t["id"]); uniq.append(t)
    return uniq


def dac_trung_chuyen(t: dict, Z: dict, shift: int) -> tuple[np.ndarray, int]:
    s = np.zeros(len(KENH)); w = np.zeros(len(KENH)); n = 0
    for d, la, lo, h in t["cells"]:
        if shift:
            dd = (date.fromisoformat(d) + timedelta(days=shift)).isoformat()
            if dd not in Z:
                dd = (date.fromisoformat(d) - timedelta(days=shift)).isoformat()
            d = dd
        z = Z.get(d)
        if z is None:
            continue
        i, j = int(round((la - LAT0) / STEP)), int(round((lo - LON0) / STEP))
        if not (0 <= i < NLAT and 0 <= j < NLON):
            continue
        v = z[:, i, j]
        ok = np.isfinite(v)
        s[ok] += v[ok] * h; w[ok] += h; n += 1
    return np.where(w > 0, s / np.where(w > 0, w, 1), 0.0), n


def pha_trang(d: str) -> float:
    """Pha trăng 0..1 (0 = non, 0,5 = rằm) lúc 20:00 giờ VN (13:00 UTC) — cùng mốc giờ đánh đèn của lib/fish-chain."""
    from datetime import datetime, timezone
    t = datetime.fromisoformat(f"{d}T13:00:00+00:00").timestamp()
    t0 = datetime(2000, 1, 6, 18, 14, tzinfo=timezone.utc).timestamp()  # trăng non chuẩn
    return ((t - t0) / 86400 / 29.530588853) % 1.0


def trang_chuyen(t: dict, shift: int) -> np.ndarray:
    """[cos 2πφ, sin 2πφ] trung bình theo giờ dọc các ngày đã đánh — dạng Δlog kg = c·cos + s·sin của production."""
    c = s_ = h = 0.0
    for d, _, _, hh in t["cells"]:
        if shift:
            d = (date.fromisoformat(d) + timedelta(days=shift)).isoformat()
        ph = 2 * math.pi * pha_trang(d)
        c += math.cos(ph) * hh; s_ += math.sin(ph) * hh; h += hh
    return np.array([c / h, s_ / h]) if h > 0 else np.zeros(2)


def ridge(X, y, w, lam=1e-2):
    W = w[:, None]
    A = X.T @ (X * W) + lam * np.diag([0] + [1] * (X.shape[1] - 1))
    return np.linalg.solve(A, X.T @ (w * y))


def rankdata(a):
    o = np.argsort(a, kind="mergesort"); r = np.empty(len(a)); r[o] = np.arange(len(a))
    # trung bình hạng khi hoà
    _, inv, cnt = np.unique(a, return_inverse=True, return_counts=True)
    sums = np.bincount(inv, weights=r); return (sums / cnt)[inv]


def r2(y, p, w):
    mu = np.average(y, weights=w)
    return 1 - np.sum(w * (y - p) ** 2) / np.sum(w * (y - mu) ** 2)


def spear(y, p, w):
    a, b = rankdata(y), rankdata(p)
    ma, mb = np.average(a, weights=w), np.average(b, weights=w)
    return np.sum(w * (a - ma) * (b - mb)) / math.sqrt(np.sum(w * (a - ma) ** 2) * np.sum(w * (b - mb) ** 2))


def main() -> int:
    repo = Path(__file__).resolve().parents[2]
    asfis = doc_asfis(repo)
    trips = doc_chuyen(Path(arg("trips")).expanduser())
    grids, tt = Path(arg("grids")).expanduser(), Path(arg("thoi-tiet")).expanduser()
    species = [s.strip() for s in arg("species", "ngừ vằn,cá nục,bạc má,cá cơm,ngừ chù,cá trích,cá tráo").split(",")]
    B = int(arg("boot", 500)); oracle = "--oracle" in sys.argv
    rng = np.random.default_rng(7)

    days = sorted({c[0] for t in trips for c in t["cells"]} | {
        (date.fromisoformat(c[0]) + timedelta(days=k)).isoformat() for t in trips for c in t["cells"] for k in (SHIFT, -SHIFT)})
    days = [d for d in days if "2026-01-01" <= d <= "2026-10-16"]
    Z = di_thuong(luoi_ngay(grids, tt, days))
    print(f"{len(trips)} chuyến, {len(Z)} ngày lưới", flush=True)

    # đặc trưng chuyến (thật + lệch ±15) + nền. Chuyến mà mọi ô đều làm tròn về 0 giờ ⇒ bỏ (không có trọng số)
    trips = [t for t in trips if t["cells"] and sum(c[3] for c in t["cells"]) > 0]
    for t in trips:
        hs = np.array([c[3] for c in t["cells"]]); la = np.array([c[1] for c in t["cells"]]); lo = np.array([c[2] for c in t["cells"]])
        dn = np.array([date.fromisoformat(c[0]).toordinal() for c in t["cells"]], dtype=float)
        t["mid"] = date.fromordinal(int(round(np.average(dn, weights=hs)))).isoformat()
        t["reg"] = f"{int(np.average(la, weights=hs) // 2)}|{int(np.average(lo, weights=hs) // 2)}"
        t["z"], t["nz"] = dac_trung_chuyen(t, Z, 0)
        t["zs"], _ = dac_trung_chuyen(t, Z, SHIFT)
        # ĐỐI CHỨNG TRĂNG = XÁO PHA NGẪU NHIÊN TỪNG CHUYẾN (lệch 1–29 ngày, mỗi chuyến một số). Lệch CỐ ĐỊNH (15 ngày) chỉ
        # XOAY (cos, sin) — mô hình hệ số tự do xoay theo được nên khớp y hệt bản thật (đo 05/11: CI "hơn lệch" = 0).
        t["m"], t["ms"] = trang_chuyen(t, 0), trang_chuyen(t, int(rng.integers(1, 30)))

    folds = [("01", "02"), ("03", "04"), ("05", "06"), ("07", "08"), ("09", "10")]
    kq = {"builtAt": date.today().isoformat(), "kenh": KENH, "B": B, "species": {}}
    for sp in species:
        codes = {c for c, s in asfis.items() if s == sp}
        kgg = defaultdict(float)
        for t in trips:
            kgg[t["gear"]] += sum(v for c, v in t["sp"].items() if c in codes)
        tot = sum(kgg.values()) or 1
        tg = {g for g, v in kgg.items() if v / tot >= TG_SHARE}
        kg_of = lambda t: sum(v for c, v in t["sp"].items() if c in codes)  # noqa: E731
        T0 = [t for t in trips if t["gear"] in tg and t["H"] >= 6 and t["nz"] > 0 and "2026-01-01" <= t["mid"] <= "2026-10-11"]
        # CHỈ chuyến CÓ bắt loài (năng suất khi đã gặp). Bản đầu lấy cả chuyến kg = 0 ⇒ y = log(1/H), nền có log H nên
        # "đoán" trúng gần hết (ρ 0,96 vô nghĩa) và đối chứng dương hỏng (oracle ρ < nền) — đo 2026-11-05.
        T = [t for t in T0 if kg_of(t) > 0]
        if len(T) < 200:
            kq["species"][sp] = {"n": len(T), "note": "ít chuyến"}; continue
        y = np.array([math.log(kg_of(t) / t["H"]) for t in T])
        w = np.array([max(t["w"], 1e-3) for t in T])
        mo = [t["mid"][5:7] for t in T]
        # mức tháng × vùng: < 20 chuyến ⇒ "khác" của tháng đó
        mr = [f"{m}|{t['reg']}" for m, t in zip(mo, T)]
        cnt = defaultdict(int)
        for x in mr: cnt[x] += 1
        mr = [x if cnt[x] >= 20 else f"{x.split('|')[0]}|khác" for x in mr]
        gc = [f"{t['gear']}|{t['cls']}" for t in T]
        levels = sorted(set(mr)) + sorted(set(gc))
        li = {l: k for k, l in enumerate(levels)}
        Xb = np.zeros((len(T), 3 + len(levels)))
        Xb[:, 0] = 1; Xb[:, 1] = np.log([t["H"] for t in T]); Xb[:, 2] = np.log([max(t["tripH"], t["H"]) for t in T])
        for r, (a, b) in enumerate(zip(mr, gc)):
            Xb[r, 3 + li[a]] = 1; Xb[r, 3 + li[b]] = 1
        Zt = np.array([t["z"] for t in T]); Zs = np.array([t["zs"] for t in T])
        # NẾP = TUẦN XEN KẼ (tuần ISO mod 5), đệm ±1 tuần. Bản đầu giữ nguyên cặp tháng ⇒ hệ số tháng × vùng của tháng
        # thử không bao giờ học được (R² ngoài nếp ngừ vằn −0,105). Production cũng biết mùa vụ của tháng (lưới đội tàu /
        # sản lượng theo tháng) ⇒ nền ở đây được biết tháng × vùng từ các tuần khác; dị thường so trong tháng = "hôm nay".
        wk_all = np.array([date.fromisoformat(t["mid"]).isocalendar()[1] for t in T])

        def oof(X):
            p = np.full(len(T), np.nan)
            for f in range(5):
                te = wk_all % 5 == f
                tr = ~np.isin(wk_all, np.unique(np.concatenate([wk_all[te] - 1, wk_all[te], wk_all[te] + 1])))
                if te.sum() < 20 or tr.sum() < 100:
                    continue
                beta = ridge(X[tr], y[tr], w[tr])
                p[te] = X[te] @ beta
            return p

        Mt = np.array([t["m"] for t in T]); Ms = np.array([t["ms"] for t in T])
        P = {"nen": oof(Xb), "dong": oof(np.hstack([Xb, Zt])), "lech": oof(np.hstack([Xb, Zs])),
             "trang": oof(np.hstack([Xb, Mt])), "trangLech": oof(np.hstack([Xb, Ms]))}
        if oracle:  # ĐỐI CHỨNG DƯƠNG: phần dư THẬT của nền + nhiễu cùng cỡ ⇒ chắc chắn mang tín hiệu, phải thắng
            res = y - np.where(np.isfinite(P["nen"]), P["nen"], y.mean())
            P["oracle"] = oof(np.hstack([Xb, (res + rng.normal(0, res.std(), len(res)))[:, None]]))
            # oracle YẾU (nhiễu gấp 4): phản biện 05/11 — oracle mạnh chưa chứng minh bộ đo bắt được hiệu ứng nhỏ
            P["oracleYeu"] = oof(np.hstack([Xb, (res + rng.normal(0, 4 * res.std(), len(res)))[:, None]]))
        ok = np.all([np.isfinite(v) for v in P.values()], axis=0)
        wk = np.array([date.fromisoformat(t["mid"]).isocalendar()[1] for t in T])[ok]
        yy, ww = y[ok], w[ok]
        PP = {k: v[ok] for k, v in P.items()}

        def met(idx):
            m = {k: (r2(yy[idx], v[idx], ww[idx]), spear(yy[idx], v[idx], ww[idx])) for k, v in PP.items()}
            return m

        full = met(np.arange(len(yy)))
        blocks = np.unique(wk); bidx = {b: np.where(wk == b)[0] for b in blocks}
        bs = []
        for _ in range(B):
            sel = rng.choice(blocks, len(blocks)); idx = np.concatenate([bidx[b] for b in sel])
            m = met(idx)
            bs.append([m["dong"][0] - m["nen"][0], m["dong"][1] - m["nen"][1], (m["dong"][0] - m["nen"][0]) - (m["lech"][0] - m["nen"][0]),
                       m["trang"][0] - m["nen"][0], m["trang"][1] - m["nen"][1], m["trang"][0] - m["trangLech"][0]]
                      + ([m["oracle"][1] - m["nen"][1], m["oracleYeu"][1] - m["nen"][1]] if oracle else []))
        bs = np.array(bs)
        ci = lambda c: [float(np.quantile(bs[:, c], 0.05)), float(np.quantile(bs[:, c], 0.95))]  # noqa: E731
        beta_all = ridge(np.hstack([Xb, Zt])[ok], yy, ww)[-len(KENH):]
        dR2, dS, dDyn = full["dong"][0] - full["nen"][0], full["dong"][1] - full["nen"][1], (full["dong"][0] - full["nen"][0]) - (full["lech"][0] - full["nen"][0])
        # CỔNG SIẾT (phản biện 05/11): Δđộng dương khi bản LỆCH làm hại thì không phải tín hiệu ⇒ đòi bản THẬT hơn nền
        # (cận dưới ΔR² > 0) VÀ hơn bản lệch (cận dưới Δđộng > 0) VÀ Δρ ≥ +0,01
        thang = dS >= 0.01 and ci(0)[0] > 0 and ci(2)[0] > 0
        tR2, tS = full["trang"][0] - full["nen"][0], full["trang"][1] - full["nen"][1]
        thangTrang = bool(ci(3)[0] > 0 and ci(5)[0] > 0)
        kq["species"][sp] = {
            "n": int(ok.sum()), "gears": sorted(tg), "nen": {"r2": full["nen"][0], "spearman": full["nen"][1]},
            "dong": {"r2": full["dong"][0], "spearman": full["dong"][1]}, "lech": {"r2": full["lech"][0], "spearman": full["lech"][1]},
            "dR2": dR2, "dR2_ci": ci(0), "dSpearman": dS, "dSpearman_ci": ci(1), "dDongR2": dDyn, "dDongR2_ci": ci(2),
            "beta": dict(zip(KENH, map(float, beta_all))), "thang": bool(thang),
            "trang": {"dR2": tR2, "dR2_ci": ci(3), "dSpearman": tS, "dSpearman_ci": ci(4), "hon_lech_R2_ci": ci(5),
                      "beta_cos_sin": list(map(float, ridge(np.hstack([Xb, Mt])[ok], yy, ww)[-2:])), "qua": thangTrang},
            **({"oracle": {"spearman": full["oracle"][1], "dSpearman_ci": ci(6)}, "oracleYeu": {"spearman": full["oracleYeu"][1], "dSpearman_ci": ci(7)}} if oracle else {}),
        }
        o = kq["species"][sp]
        print(f"{sp:9s} n {o['n']:6d} | nền R² {o['nen']['r2']:.3f} ρ {o['nen']['spearman']:.3f} | ΔR² {dR2:+.4f} [{ci(0)[0]:+.4f},{ci(0)[1]:+.4f}] "
              f"Δρ {dS:+.4f} [{ci(1)[0]:+.4f},{ci(1)[1]:+.4f}] | Δđộng R² {dDyn:+.4f} [{ci(2)[0]:+.4f},{ci(2)[1]:+.4f}]"
              + f" | TRĂNG ΔR² {tR2:+.4f} [{ci(3)[0]:+.4f},{ci(3)[1]:+.4f}] hơn-lệch [{ci(5)[0]:+.4f},{ci(5)[1]:+.4f}] β {o['trang']['beta_cos_sin'][0]:+.3f}/{o['trang']['beta_cos_sin'][1]:+.3f} {'QUA' if thangTrang else 'không'}"
              + (f" | oracle ρ {o['oracle']['spearman']:.3f} yếu Δρ [{ci(7)[0]:+.4f},{ci(7)[1]:+.4f}]" if oracle else "") + f" | β {' '.join(f'{k}{v:+.3f}' for k, v in o['beta'].items())} {'THẮNG' if thang else 'thua'}", flush=True)
    Path(arg("out", "kq-cap-chuyen.json")).write_text(json.dumps(kq, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
