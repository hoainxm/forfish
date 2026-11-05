#!/usr/bin/env python3
"""LƯỚI THỜI TIẾT THEO NGÀY cho thí nghiệm "thời tiết có cộng thêm được gì cho dự báo cá" (2026-11-05, README rà train §7.12).

Lý do: §7.11 thấy tín hiệu dị thường ngày duy nhất là MẶT NẠ MÂY (thời tiết), không phải phù du ⇒ đo thời tiết TRỰC TIẾP.
Ba kênh trên ĐÚNG trục lưới cache đặc trưng (`<features>/manifest.json` axis) ⇒ `fish-2d-experiment.mjs --extra <out>`:
  gio   tốc độ gió TB ngày, m/s — NOAA NCEI Blended Winds 0,25° (noaacwBlendedWindsDaily; tháng chưa có ⇒ bản nrt)
  song  độ cao sóng có nghĩa TB 4 mốc 00/06/12/18 UTC, m — Copernicus GLOBAL_ANALYSISFORECAST_WAV_001_027 (ARCO)
  may   tỉ lệ ô mịn 0,083° KHÔNG có ảnh chụp thật (L3) trong ô 0,25°, trên ô có DINEOF (biển) — từ lưới v2/v0 của §7.11
Đây là thời tiết THỰC TẾ của ngày đánh (cận trên thông tin). Production chỉ có thời tiết DỰ BÁO — thắng ở đây mới đáng
đo tiếp bằng dự báo; thua ở đây thì dự báo cũng không cứu được.

Dùng: luoi-thoi-tiet.py --features ~/sdfish-l3/v0/features --l3 ~/sdfish-l3 --grids <fc-full/grids> --out ~/sdfish-l3/thoi-tiet
"""
from __future__ import annotations

import json, sys, tempfile, time, urllib.error, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np

ERDDAP = "https://coastwatch.noaa.gov/erddap/griddap"
WAV = ("https://s3.waw3-1.cloudferro.com/mdl-arco-time-015/arco/GLOBAL_ANALYSISFORECAST_WAV_001_027/"
       "cmems_mod_glo_wav_anfc_0.083deg_PT3H-i_202411/downsampled4.zarr")
UA = {"User-Agent": "ForFish-thi-nghiem-thoi-tiet/1"}


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
                return None
        except Exception:
            pass
    return None


def ve_truc(lat, lon, v, LAT, LON):
    """Lưới nguồn → trục cache bằng ô gần nhất, dung sai nửa bước nguồn (tối thiểu nửa bước cache)."""
    io, jo = np.argsort(lat), np.argsort(lon)
    lat, lon, v = lat[io], lon[jo], v[io][:, jo]
    ii = np.clip(np.searchsorted(lat, LAT), 1, len(lat) - 1)
    ii = np.where(np.abs(lat[ii - 1] - LAT) < np.abs(lat[ii] - LAT), ii - 1, ii)
    jj = np.clip(np.searchsorted(lon, LON), 1, len(lon) - 1)
    jj = np.where(np.abs(lon[jj - 1] - LON) < np.abs(lon[jj] - LON), jj - 1, jj)
    out = v[np.ix_(ii, jj)].astype(np.float64)
    tl = max(0.51 * float(np.median(np.diff(lat))), 0.13)
    tn = max(0.51 * float(np.median(np.diff(lon))), 0.13)
    out[(np.abs(lat[ii] - LAT)[:, None] > tl) | (np.abs(lon[jj] - LON)[None, :] > tn)] = np.nan
    return out


_truc: dict[str, set[str]] = {}


def ngay_co(ds):
    if ds not in _truc:
        b = tai(f"{ERDDAP}/{ds}.csv?" + urllib.parse.quote("time[(2025-12-01T00:00:00Z):1:(last)]", safe="():.,_"))
        _truc[ds] = {x[:10]: x.strip() for x in (b or b"").decode().splitlines()[2:] if x[:4].isdigit()}
    return _truc[ds]


def gio(ngay, LAT, LON):
    import xarray as xr

    for ds in ("noaacwBlendedWindsDaily", "noaacwBlendednrtWindsDaily"):  # chất lượng cao trước; ERDDAP trả ngày GẦN NHẤT nếu thiếu ⇒ chỉ xin ngày có
        nhan = ngay_co(ds).get(ngay)
        if not nhan:
            continue
        rang = f"windspeed[({nhan})][(10.0)][(4.8):(22.2)][(101.8):(118.2)]"
        b = tai(f"{ERDDAP}/{ds}.nc?{urllib.parse.quote(rang, safe='():.,_')}")
        if not b:
            continue
        with tempfile.NamedTemporaryFile(suffix=".nc") as f:
            f.write(b); f.flush()
            with xr.open_dataset(f.name, engine="scipy") as d:
                if str(d.time.values.ravel()[0])[:10] != ngay:
                    continue
                return ve_truc(d.latitude.values, d.longitude.values, d.windspeed.squeeze().values, LAT, LON)
    return None


_wav = None


def song(ngay, LAT, LON):
    import xarray as xr

    global _wav
    if _wav is None:
        _wav = xr.open_zarr(WAV, consolidated=True)
    lat = _wav.latitude.values
    sl = slice(4.8, 22.2) if lat[0] < lat[-1] else slice(22.2, 4.8)
    mau = []
    for h in ("00", "06", "12", "18"):
        try:
            a = _wav.VHM0.sel(time=f"{ngay}T{h}:00").sel(latitude=sl, longitude=slice(101.8, 118.2))
            mau.append(a.values.astype(np.float64))
        except Exception:
            pass
    if not mau:
        return None
    with np.errstate(all="ignore"), __import__("warnings").catch_warnings():
        __import__("warnings").simplefilter("ignore")
        v = np.nanmean(np.stack(mau), 0)
    return ve_truc(a.latitude.values, a.longitude.values, v, LAT, LON)


def bang(p: Path):
    rows = json.loads(p.read_text())["table"]["rows"]
    return (np.array([r[2] for r in rows]), np.array([r[3] for r in rows]),
            np.array([np.nan if r[4] is None else r[4] for r in rows], dtype=np.float64))


def may(ngay, l3: Path, grids: Path, LAT, LON, step):
    p2, p0 = l3 / "v2" / "grids" / f"chlFine-{ngay}.json", grids / f"chlFine-{ngay}.json"
    if not p2.exists() or not p0.exists():
        return None
    la, lo, v0 = bang(p0)
    _, _, v2 = bang(p2)
    bien = np.isfinite(v0)
    i = np.rint((la - LAT[0]) / step).astype(int)
    j = np.rint((lo - LON[0]) / step).astype(int)
    ok = bien & (i >= 0) & (i < len(LAT)) & (j >= 0) & (j < len(LON))
    k = i[ok] * len(LON) + j[ok]
    n = np.bincount(k, minlength=len(LAT) * len(LON))
    co = np.bincount(k, weights=np.isfinite(v2[ok]).astype(float), minlength=len(LAT) * len(LON))
    # ngày KHÔNG vệ tinh nào có ảnh (mất dữ liệu, ví dụ 01–02/08/2026) ≠ mây kín ⇒ để trống, đừng ghi "mây = 1"
    if co.sum() < 0.02 * n.sum():
        return None
    out = np.where(n > 0, 1 - co / np.where(n > 0, n, 1), np.nan)
    return out.reshape(len(LAT), len(LON))


def main():
    feat = Path(arg("features")).expanduser()
    out = Path(arg("out")).expanduser()
    l3, grids = Path(arg("l3")).expanduser(), Path(arg("grids")).expanduser()
    out.mkdir(parents=True, exist_ok=True)
    mf = json.loads((feat / "manifest.json").read_text())
    ax = mf["axis"]
    LAT = ax["lat0"] + ax["step"] * np.arange(ax["nLat"])
    LON = ax["lon0"] + ax["step"] * np.arange(ax["nLon"])
    names = ["gio", "song", "may"]
    (out / "manifest.json").write_text(json.dumps({"names": names, "axis": ax, "nguon": __doc__.split("\n")[5:8]}, ensure_ascii=False))
    days = [d for d in sorted(mf["days"]) if arg("tu", "0000") <= d <= arg("den", "9999")]

    def mot(d):
        p = out / f"w-{d}.json"
        if p.exists():
            return d, "có sẵn"
        ch = [gio(d, LAT, LON), None, may(d, l3, grids, LAT, LON, ax["step"])]
        return d, ch

    phu = {}
    with ThreadPoolExecutor(4) as ex:  # gió + mây song song; sóng (zarr) chạy tuần tự bên dưới
        kq = list(ex.map(mot, days))
    for d, ch in kq:
        if ch == "có sẵn":
            continue
        ch[1] = song(d, LAT, LON)
        vals = [None if a is None else [None if not np.isfinite(x) else round(float(x), 4) for x in a.ravel()] for a in ch]
        (out / f"w-{d}.json").write_text(json.dumps({"values": vals}))
        phu[d] = [None if a is None else round(float(np.isfinite(a).mean()), 3) for a in ch]
    thieu = {n: sum(1 for v in phu.values() if v[i] is None) for i, n in enumerate(names)}
    print(f"{len(days)} ngày, ngày thiếu theo kênh: {thieu}")


if __name__ == "__main__":
    main()
