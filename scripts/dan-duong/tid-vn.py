#!/usr/bin/env python3
"""Mặt nạ tin cậy GEBCO_2026 TID cho vùng biển Việt Nam (research/do-sau-day-bien-team-2026-10-22 §3 #1).

Đọc cửa sổ 102–118°Đ / 5–23°B của lưới TID (type identifier) GEBCO_2026 + lưới độ sâu, qua COG trên
source.coop (không login, không tải cả file). Ghi:
  <out>/tid-vn.stats.json   — % ô đo thật / nội suy theo vùng và theo dải độ sâu (số để đối chiếu §2)
  <out>/tid-vn.u8           — mã TID gốc từng ô (uint8, row-major, vĩ độ GIẢM từ 23°B — thứ tự ảnh)
  <out>/depth-tid-vn.1bit   — 1 bit/ô: 1 = đo thật (TID 10–17, 44), 0 = nội suy/khác — cùng khung, để
                              sau ghép vào lưới depth-grid.v1 (lat0 5°, lon0 102°, 15″) ở bước đóng gói
Chạy trên GPU trong venv: python3 -m venv geo && geo/bin/pip install rasterio numpy && geo/bin/python tid-vn.py --out ra
Nguồn: GEBCO Compilation Group (2026) GEBCO 2026 Grid — public domain; "should NOT be used for navigation".
"""
import json, sys, time
from pathlib import Path

import numpy as np
import rasterio
from rasterio.windows import from_bounds

BASE = "https://data.source.coop/giswqs/gebco-bathymetry/"
TID_URL = BASE + "gebco_2026_tid/gebco_2026_tid_n90.0_s0.0_w90.0_e180.0.tif"
Z_URL = BASE + "gebco_2026/gebco_2026_n90.0_s0.0_w90.0_e180.0.tif"
W, S, E, N = 102.0, 5.0, 118.0, 23.0
DO_THAT = {10, 11, 12, 13, 14, 15, 16, 17, 44}
VUNG = {
    "vinh_bac_bo": (105.5, 18.0, 108.0, 21.5),
    "trung_bo": (108.5, 11.0, 109.8, 16.0),
    "dnb_mekong": (104.5, 8.0, 107.5, 10.8),
    "tay_nam_phu_quoc": (103.5, 8.5, 105.0, 10.5),
    "hoang_sa": (111.0, 15.5, 113.0, 17.5),
    "truong_sa": (111.0, 7.0, 116.0, 12.0),
}


def arg(k, d):
    return sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d


out = Path(arg("--out", "ra"))
out.mkdir(parents=True, exist_ok=True)
t0 = time.time()
with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif"):
    with rasterio.open(TID_URL) as t, rasterio.open(Z_URL) as g:
        wt = from_bounds(W, S, E, N, t.transform)
        tid = t.read(1, window=wt).astype(np.uint8)
        z = g.read(1, window=from_bounds(W, S, E, N, g.transform)).astype(np.float32)
        tr = t.window_transform(wt)
print(f"đọc xong {tid.shape} sau {time.time()-t0:.0f}s", flush=True)
assert tid.shape == z.shape
sea = z < 0
dothat = np.isin(tid, list(DO_THAT))


def ti_le(mask):
    n = int(mask.sum())
    if n == 0:
        return {"o": 0}
    vals, cnt = np.unique(tid[mask], return_counts=True)
    top = sorted(zip(vals.tolist(), cnt.tolist()), key=lambda x: -x[1])[:6]
    return {"o": n, "do_that_pct": round(100 * float(dothat[mask].sum()) / n, 2), "tid_top": top}


def o_vung(b):
    w, s, e, n = b
    rows, cols = rasterio.transform.rowcol(tr, [w, e], [n, s])
    m = np.zeros_like(sea)
    m[rows[0]:rows[1], cols[0]:cols[1]] = True
    return m


stats = {
    "luc": time.strftime("%Y-%m-%dT%H:%M:%S"),
    "khung": [W, S, E, N],
    "shape": list(tid.shape),
    "toan_bo_bien": ti_le(sea),
    "bien_0_50m": ti_le(sea & (z >= -50)),
    "bien_0_20m": ti_le(sea & (z >= -20)),
    "vung_0_50m": {k: ti_le(sea & (z >= -50) & o_vung(b)) for k, b in VUNG.items()},
}
(out / "tid-vn.stats.json").write_text(json.dumps(stats, ensure_ascii=False, indent=1))
tid.tofile(out / "tid-vn.u8")
np.packbits(dothat.astype(np.uint8), axis=1).tofile(out / "depth-tid-vn.1bit")
print(json.dumps({k: v for k, v in stats.items() if k != "vung_0_50m"}, ensure_ascii=False))
for k, v in stats["vung_0_50m"].items():
    print(k, v.get("do_that_pct"), "% đo thật /", v.get("o"), "ô")
