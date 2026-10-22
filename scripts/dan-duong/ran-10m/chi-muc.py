#!/usr/bin/env python3
"""Lập CHỈ MỤC 3 bộ độ sâu 10 m (sau tai.sh): mỗi đảo/rạn một dòng — bộ, id, tên gốc, tâm, bbox, số pixel/điểm,
độ sâu min/median/max, (LGMM) bất định trung vị. Ra: <D>/ran-10m.index.json + ran-10m.index.md.
Chạy: uv venv geo && uv pip install --python geo/bin/python netCDF4 numpy && geo/bin/python chi-muc.py <D>
Không ghi tên TQ ra sản phẩm — chỉ mục này là file làm việc để ten-viet.mjs ghép tên Việt theo toạ độ.
"""
import csv, glob, json, os, sys, time
import numpy as np
from netCDF4 import Dataset

D = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser("~/.local/forlife/train/dan-duong/ran-10m")
G = os.path.join(D, "goc")
rows = []
log = lambda *a: print(time.strftime("%H:%M:%S"), *a, flush=True)

def tom(z):
    z = z[np.isfinite(z)]
    if z.size == 0: return None
    return {"n": int(z.size), "min": round(float(np.nanmin(z)), 2), "med": round(float(np.nanmedian(z)), 2), "max": round(float(np.nanmax(z)), 2)}

# 1. HHU24 — đám mây điểm, gán điểm về đảo gần nhất theo islandLat/Lon (128 đảo)
try:
    ds = Dataset(os.path.join(G, "HHU24SWDSCS.nc"))
    ten = ["".join(x.decode("latin1") if isinstance(x, bytes) else str(x) for x in r).strip("\x00 \t") for r in ds["islandName"][:]]
    ilat, ilon = np.asarray(ds["islandLat"][:], float), np.asarray(ds["islandLon"][:], float)
    # bản ghi hỏng trong nguồn (báo cáo D: "Zhanhan Band\t16.42"): lat > 30 là tráo lat/lon; NaN giữ NaN → ten-viet bỏ qua
    trao = ilat > 30
    ilat[trao], ilon[trao] = ilon[trao], ilat[trao]
    lat, lon, dep = (np.asarray(ds[v][:], float) for v in ("latitude", "longitude", "depth"))
    # bẫy lat/lon (báo cáo A): nếu "latitude" nằm ngoài 0–25 thì hai biến bị tráo
    if np.nanmax(np.abs(lat)) > 30: lat, lon = lon, lat
    log("HHU24", len(ten), "đảo,", lat.size, "điểm")
    # gán theo ô lưới thô 0,05° quanh tâm đảo để không O(N×128) nặng: dùng khoảng cách tới tâm gần nhất theo khối
    idx = np.full(lat.size, -1, np.int32)
    for k in range(0, lat.size, 200_000):
        sl = slice(k, k + 200_000)
        d2 = (lat[sl, None] - ilat[None, :]) ** 2 + ((lon[sl, None] - ilon[None, :]) * np.cos(np.radians(ilat[None, :]))) ** 2
        idx[sl] = np.argmin(d2, axis=1)
    for i, t in enumerate(ten):
        m = idx == i
        if not m.any(): rows.append({"bo": "HHU24", "id": i, "tenGoc": t, "tamLat": float(ilat[i]), "tamLon": float(ilon[i]), "diem": 0}); continue
        rows.append({"bo": "HHU24", "id": i, "tenGoc": t, "tamLat": float(ilat[i]), "tamLon": float(ilon[i]),
                     "bbox": [round(float(lon[m].min()), 4), round(float(lat[m].min()), 4), round(float(lon[m].max()), 4), round(float(lat[m].max()), 4)],
                     "diem": int(m.sum()), "doSau": tom(dep[m])})
except Exception as e:
    log("HHU24 lỗi:", e)

# 2. SCSBathy10 — 66 file lưới + Island Name.csv (giải nén bằng zipfile: máy không có unzip)
try:
    import zipfile
    zdir = os.path.join(G, "scsbathy10")
    if not glob.glob(os.path.join(zdir, "**", "*.nc"), recursive=True) and os.path.exists(os.path.join(G, "Products.zip")):
        with zipfile.ZipFile(os.path.join(G, "Products.zip")) as zf: zf.extractall(zdir)
        log("giải nén SCSBathy10 bằng zipfile")
    names = {}
    for p in glob.glob(os.path.join(G, "scsbathy10", "**", "*.csv"), recursive=True):
        with open(p, encoding="utf-8-sig", errors="replace") as f:
            for r in csv.reader(f):
                if len(r) >= 2 and r[0].strip(): names[r[0].strip()] = r[1].strip()
    files = sorted(glob.glob(os.path.join(G, "scsbathy10", "**", "*.nc"), recursive=True))
    log("SCSBathy10", len(files), "file")
    for p in files:
        ds = Dataset(p); fid = os.path.splitext(os.path.basename(p))[0]
        v = next(k for k in ("depth_prediction", "depth") if k in ds.variables)
        z = np.asarray(ds[v][:], float).squeeze(); z = np.where(np.abs(z) > 1e5, np.nan, z)
        la, lo = np.asarray(ds["latitude"][:], float), np.asarray(ds["longitude"][:], float)
        ok = np.isfinite(z)
        if la.ndim == 1: LA, LO = np.meshgrid(la, lo, indexing="ij") if z.shape == (la.size, lo.size) else np.meshgrid(la, lo, indexing="xy")
        else: LA, LO = la, lo
        rows.append({"bo": "SCSBathy10", "id": fid, "tenGoc": names.get(fid, names.get(fid.split("_")[0], fid)),
                     "tamLat": round(float(LA[ok].mean()), 4) if ok.any() else None, "tamLon": round(float(LO[ok].mean()), 4) if ok.any() else None,
                     "bbox": [round(float(lo.min()), 4), round(float(la.min()), 4), round(float(lo.max()), 4), round(float(la.max()), 4)],
                     "diem": int(ok.sum()), "doSau": tom(z)})
except Exception as e:
    log("SCSBathy10 lỗi:", e)

# 3. LGMM — một file lớn, nhiều rạn: liệt kê biến/chiều rồi tách theo nhóm toạ độ (DBSCAN thô theo ô 0,25°)
try:
    p = os.path.join(G, "lgmm_depth_uncertainty.nc"); ds = Dataset(p)
    att = {k: str(ds.getncattr(k)) for k in ds.ncattrs()}
    log("LGMM root attrs:", att)
    # Đo 2026-10-22: 82 group Region_NNN, biến y/x là CHỈ SỐ PIXEL, không có lat/lon, không CRS ⇒ không định vị được
    # nếu Zenodo không kèm file toạ độ riêng. Ghi meta từng group để lead quyết; KHÔNG bịa toạ độ.
    for gname, g in ds.groups.items():
        z = g["bottom_elevation_msl"]
        rows.append({"bo": "LGMM", "id": gname, "tenGoc": None, "khongToaDo": True, "shape": list(z.shape),
                     "attrs": {k: str(g.getncattr(k)) for k in g.ncattrs()}})
    rows.append({"bo": "LGMM", "id": "meta", "tenGoc": None, "attrs": att, "soGroup": len(ds.groups)})
except Exception as e:
    log("LGMM lỗi:", e)

def sach(o):
    if isinstance(o, float): return None if not np.isfinite(o) else o
    if isinstance(o, dict): return {k: sach(v) for k, v in o.items()}
    if isinstance(o, list): return [sach(v) for v in o]
    return o
json.dump(sach({"luc": time.strftime("%Y-%m-%dT%H:%M:%S"), "n": len(rows), "ran": rows}), open(os.path.join(D, "ran-10m.index.json"), "w"), ensure_ascii=False, indent=1, allow_nan=False)
with open(os.path.join(D, "ran-10m.index.md"), "w") as f:
    f.write("| bộ | id | tên gốc | tâm | điểm/pixel | sâu min/med/max |\n|---|---|---|---|---|---|\n")
    for r in rows:
        if r.get("tenGoc") is None: continue
        d = r.get("doSau") or {}
        f.write(f"| {r['bo']} | {r['id']} | {r['tenGoc']} | {r.get('tamLat')},{r.get('tamLon')} | {r.get('diem')} | {d.get('min')}/{d.get('med')}/{d.get('max')} |\n")
log("xong", len(rows), "dòng →", os.path.join(D, "ran-10m.index.json"))
