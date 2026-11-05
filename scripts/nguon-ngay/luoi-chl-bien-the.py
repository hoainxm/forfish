#!/usr/bin/env python3
"""LƯỚI PHÙ DU BIẾN THỂ cho thí nghiệm "nguồn phù du mới có cộng thêm được gì cho dự báo cá" (2026-11-05,
anh Long: "cho chạy kiểm tra để làm cái dự báo cá theo các nguồn mới đánh giá phản biện tối ưu đi").

Đọc lưới DINEOF đang dùng để đo (`<grids>/chl-<ngày>.json` thô cách 3 ô, `chlFine-<ngày>.json` mịn 0,083° — bảng
ERDDAP do `scripts/fish-validate-run.mjs` tải), tải 4 nguồn L3 CHỤP THẬT cùng ngày (OLCI S3A/S3B, VIIRS N20/NPP — CoastWatch
ERDDAP), đưa về ĐÚNG ô mịn của DINEOF bằng trung bình log10 các điểm ảnh rơi vào ô (mỗi vệ tinh một trung bình, rồi
trung bình các vệ tinh — vệ tinh nhiều điểm ảnh không lấn), rồi ghi lại đúng định dạng bảng ERDDAP:
  v1 (ghép)   = trung bình L3 nếu có, ô không có ⇒ giá trị DINEOF   (đúng luật `chl-ghep` của quet.py, bỏ Copernicus)
  v2 (L3)     = chỉ trung bình L3, ô không có ⇒ null                (ảnh thật, không lấp)
Bản thô = lấy bản mịn tại đúng toạ độ của bản thô DINEOF (DINEOF thô cũng là lấy cách 3 ô, không trung bình).
Các trường khác (sst, sla, anom, sstFine, etopo) liên kết mềm sang thư mục gốc ⇒ CHỈ phù du khác nhau.

Copernicus L4 KHÔNG có trong thí nghiệm: kho thời gian thực trả 403 cho ngày trước validStartDate (~20/10/2026).

Dùng: luoi-chl-bien-the.py --grids <fc-full/grids> --out <thư mục> [--cache <thư mục .nc>] [--tu 2026-01-01] [--den 2026-10-17]
Ra:   <out>/v1/grids/…  <out>/v2/grids/…  <out>/phu.json (tỉ lệ ô biển có số theo ngày × biến thể)
"""
from __future__ import annotations

import json, os, sys, tempfile, time, urllib.error, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np

ERDDAP = "https://coastwatch.noaa.gov/erddap/griddap"
L3 = ["noaacwS3AOLCIchlaDaily", "noaacwS3BOLCIchlaDaily", "noaacwN20VIIRSchlaDaily", "noaacwNPPVIIRSchlaDaily"]
UA = {"User-Agent": "ForFish-thi-nghiem-phu-du/1"}
TRUONG_KHAC = ["sst", "sla", "anom", "sstFine"]


def arg(k, d=None):
    return sys.argv[sys.argv.index(f"--{k}") + 1] if f"--{k}" in sys.argv else d


def tai(url: str, tries=4) -> bytes | None:
    for lan in range(tries):
        if lan:
            time.sleep(4 * lan)
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (400, 404):
                return None  # ngày đó nguồn không có
        except Exception:
            pass
    return None


_giam: dict[str, bool] = {}


def vi_do_giam(ds: str) -> bool:
    if ds not in _giam:
        b = tai(f"{ERDDAP}/{ds}.csv?latitude%5B0:1:1%5D")
        v = [float(x) for x in b.decode().splitlines()[2:4]]
        _giam[ds] = v[0] > v[1]
    return _giam[ds]


_truc: dict[str, set[str]] = {}


def ngay_co(ds: str) -> set[str]:
    """Ngày nguồn CÓ thật. BẪY ERDDAP (đo 2026-11-05): xin `[(2026-08-01T12:00:00Z)]` mà ngày đó không có thì ERDDAP
    LẶNG LẼ trả ngày GẦN NHẤT (VIIRS N20 xin 01/08 nhận 24/08) ⇒ phải đối chiếu trục thời gian trước khi xin."""
    if ds not in _truc:
        b = tai(f"{ERDDAP}/{ds}.csv?" + urllib.parse.quote("time[(2025-12-01T00:00:00Z):1:(last)]", safe="():.,_"))
        _truc[ds] = {x[:10] for x in (b or b"").decode().splitlines()[2:] if x[:4].isdigit()}
    return _truc[ds]


def l3_nc(ds: str, ngay: str, cache: Path) -> Path | None:
    p = cache / f"{ds}-{ngay}.nc"
    if p.exists():
        return p if p.stat().st_size > 0 else None
    if ngay not in ngay_co(ds):
        p.write_bytes(b"")
        return None
    vi = "(22.2):(4.9)" if vi_do_giam(ds) else "(4.9):(22.2)"
    rang = f"chlor_a[({ngay}T12:00:00Z)][(0.0)][{vi}][(101.9):(118.1)]"
    b = tai(f"{ERDDAP}/{ds}.nc?{urllib.parse.quote(rang, safe='():.,_')}")
    p.write_bytes(b or b"")  # tệp rỗng = "ngày đó không có" ⇒ chạy lại khỏi hỏi
    if b and doc_l3(p)[3] != ngay:  # kiểm lần hai: ngày trong file phải đúng ngày xin
        p.write_bytes(b"")
        return None
    return p if b else None


def doc_l3(p: Path):
    import xarray as xr

    with xr.open_dataset(p, engine="scipy") as d:
        v = d["chlor_a"].squeeze().values.astype(np.float64)
        ngay = str(d["time"].values.ravel()[0])[:10]
        return d["latitude"].values.astype(np.float64), d["longitude"].values.astype(np.float64), v, ngay


def doc_bang(p: Path):
    t = json.loads(p.read_text())["table"]
    rows = t["rows"]
    lat = np.array([r[2] for r in rows], dtype=np.float64)
    lon = np.array([r[3] for r in rows], dtype=np.float64)
    val = np.array([np.nan if r[4] is None else r[4] for r in rows], dtype=np.float64)
    return t, rows, lat, lon, val


def ghi_bang(t: dict, rows: list, vals: np.ndarray, p: Path) -> None:
    moi = [[r[0], r[1], r[2], r[3], (None if not np.isfinite(x) else round(float(x), 5))] for r, x in zip(rows, vals)]
    p.write_text(json.dumps({"table": {**t, "rows": moi}}, separators=(",", ":")))


def mot_ngay(ngay: str, goc: Path, out: Path, cache: Path) -> dict | None:
    fp, cp = goc / f"chlFine-{ngay}.json", goc / f"chl-{ngay}.json"
    if not fp.exists() or not cp.exists():
        return None
    tf, rf, lat, lon, dineof = doc_bang(fp)
    # lưới mịn đều: suy chỉ số ô từ toạ độ
    ulat, ulon = np.unique(lat), np.unique(lon)
    dlat, dlon = float(np.median(np.diff(ulat))), float(np.median(np.diff(ulon)))
    nlat, nlon = len(ulat), len(ulon)
    idx_row = np.rint((lat - ulat[0]) / dlat).astype(int) * nlon + np.rint((lon - ulon[0]) / dlon).astype(int)
    tong = np.zeros(nlat * nlon)
    dem_vt = np.zeros(nlat * nlon)  # số vệ tinh có số ở ô
    for ds in L3:
        p = l3_nc(ds, ngay, cache)
        if not p:
            continue
        la, lo, v, _ = doc_l3(p)
        LA, LO = np.meshgrid(la, lo, indexing="ij")
        ok = np.isfinite(v) & (v > 0)
        i = np.rint((LA[ok] - ulat[0]) / dlat).astype(int)
        j = np.rint((LO[ok] - ulon[0]) / dlon).astype(int)
        trong = (i >= 0) & (i < nlat) & (j >= 0) & (j < nlon)
        k = i[trong] * nlon + j[trong]
        s = np.bincount(k, weights=np.log10(v[ok][trong]), minlength=nlat * nlon)
        n = np.bincount(k, minlength=nlat * nlon)
        co = n > 0
        tong[co] += s[co] / n[co]
        dem_vt[co] += 1
    l3 = np.where(dem_vt > 0, 10 ** (tong / np.where(dem_vt > 0, dem_vt, 1)), np.nan)[idx_row]
    v1 = np.where(np.isfinite(l3), l3, dineof)
    v2 = l3
    tc, rc, clat, clon, _ = doc_bang(cp)
    khoa = {(round(a, 4), round(b, 4)): q for q, (a, b) in enumerate(zip(lat, lon))}
    ic = np.array([khoa.get((round(a, 4), round(b, 4)), -1) for a, b in zip(clat, clon)])
    for ten, vals in (("v1", v1), ("v2", v2)):
        g = out / ten / "grids"
        ghi_bang(tf, rf, vals, g / f"chlFine-{ngay}.json")
        ghi_bang(tc, rc, np.where(ic >= 0, vals[np.clip(ic, 0, None)], np.nan), g / f"chl-{ngay}.json")
    bien = np.isfinite(dineof) | np.isfinite(l3)
    phu = lambda a: round(float(np.isfinite(a)[bien].mean()), 4) if bien.any() else 0.0  # noqa: E731
    return {"ngay": ngay, "dineof": phu(dineof), "v1": phu(v1), "v2": phu(v2)}


def main() -> int:
    goc = Path(arg("grids")).expanduser()
    out = Path(arg("out")).expanduser()
    cache = Path(arg("cache", str(out / "nc"))).expanduser()
    tu, den = arg("tu", "2026-01-01"), arg("den", "2026-10-17")
    cache.mkdir(parents=True, exist_ok=True)
    for ten in ("v1", "v2"):
        g = out / ten / "grids"
        g.mkdir(parents=True, exist_ok=True)
        for f in goc.iterdir():  # trường khác + etopo: liên kết mềm
            if f.name == "etopo.json" or any(f.name.startswith(t + "-") for t in TRUONG_KHAC):
                q = g / f.name
                if not q.exists():
                    q.symlink_to(f)
    ngay = sorted(f.name[4:14] for f in goc.glob("chl-*.json") if tu <= f.name[4:14] <= den)
    # tải trước song song (mạng là phần chậm), dựng sau
    with ThreadPoolExecutor(6) as ex:
        list(ex.map(lambda a: l3_nc(a[0], a[1], cache), [(ds, d) for d in ngay for ds in L3]))
    phu = [x for x in (mot_ngay(d, goc, out, cache) for d in ngay) if x]
    (out / "phu.json").write_text(json.dumps(phu, indent=1))
    tb = {k: round(float(np.mean([x[k] for x in phu])), 3) for k in ("dineof", "v1", "v2")}
    print(f"{len(phu)} ngày; phủ trung bình ô biển: {tb}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
