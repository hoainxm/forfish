#!/usr/bin/env python3
"""SINH reef-depth.v1 — độ sâu rạn Hoàng Sa/Trường Sa từ HHU24SWDSCS + SCSBathy10 (CC BY 4.0), CHỈ các thực thể đã
ghép được tên Việt (`ten-viet.json` trạng thái "khop"). Anh Long 2026-10-22: "Sinh reef-depth từ 142 dòng đã khớp trước,
35 dòng mơ hồ để lại, chưa phát hành" ⇒ file ra nằm NGOÀI repo (thư mục GPU), chưa vào public/data.

Khuôn dữ liệu (một lớp = một file, luật public/data): mỗi thực thể một lưới ~100 m, mỗi ô = ĐỘ SÂU NÔNG NHẤT trong ô
(lấy cái nguy hiểm hơn — cùng luật min-pool của depth-grid), mã uint8 theo DECIMET: 0–253 = 0,0–25,3 m, 254 = sâu hơn
25,3 m, 255 = không có số. Datum MSL (cả hai nguồn). Không ghi tên gốc Trung Quốc ở bất kỳ trường nào.

  geo/bin/python sinh-reef-depth.py <D>   (D = ~/.local/forlife/train/dan-duong/ran-10m, có goc/, ran-10m.index.json, ten-viet.json)
Ra: <D>/ra/reef-depth.v1.json · <D>/ra/reef-depth.tom-tat.json · <D>/ra/reef-depth.tom-tat.md
"""
import base64, glob, json, os, sys, time
import numpy as np
from netCDF4 import Dataset

D = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser("~/.local/forlife/train/dan-duong/ran-10m")
G, RA = os.path.join(D, "goc"), os.path.join(D, "ra")
os.makedirs(RA, exist_ok=True)
log = lambda *a: print(time.strftime("%H:%M:%S"), *a, flush=True)
STEP_M = 100.0
KM_LAT = 111.32
CAP_DM = 253  # 25,3 m

tv = json.load(open(os.path.join(D, "ten-viet.json")))
khop = {(r["bo"], str(r["id"])): r for r in tv["ran"] if r["trangThai"] == "khop"}
log("thực thể đã khớp tên:", len(khop))

def nhom_cua(lat, lon):
    if lat >= 14.5 and lon >= 116.5: return "scarborough"
    if lat >= 15.0: return "hoang-sa"
    return "truong-sa"

def luoi_tu_diem(lat, lon, dep):
    """điểm rời → lưới ~100 m, min độ sâu mỗi ô (dep dương xuống, m)"""
    la0, la1, lo0, lo1 = lat.min(), lat.max(), lon.min(), lon.max()
    dlat = STEP_M / 1000 / KM_LAT
    dlon = dlat / max(0.2, np.cos(np.radians((la0 + la1) / 2)))
    nla = int((la1 - la0) / dlat) + 1; nlo = int((lo1 - lo0) / dlon) + 1
    i = np.clip(((lat - la0) / dlat).astype(np.int64), 0, nla - 1); j = np.clip(((lon - lo0) / dlon).astype(np.int64), 0, nlo - 1)
    grid = np.full(nla * nlo, np.inf); np.minimum.at(grid, i * nlo + j, dep)
    return la0, lo0, dlat, dlon, nla, nlo, grid.reshape(nla, nlo)

def ma_hoa(grid):
    """float m (inf = không số) → uint8 dm + base64"""
    u = np.full(grid.shape, 255, np.uint8)
    co = np.isfinite(grid)
    dm = np.clip(np.round(grid[co] * 10), 0, 254).astype(np.uint8)
    dm[grid[co] * 10 > CAP_DM] = 254
    u[co] = dm
    return base64.b64encode(u.tobytes()).decode("ascii"), int(co.sum())

def feature(ten, nguon, la0, lo0, dlat, dlon, nla, nlo, grid):
    data, n = ma_hoa(grid)
    co = np.isfinite(grid)
    tam_lat, tam_lon = la0 + dlat * nla / 2, lo0 + dlon * nlo / 2
    return {
        "ten": ten, "nhom": nhom_cua(tam_lat, tam_lon), "nguon": nguon,
        "lat0": round(float(la0), 6), "lon0": round(float(lo0), 6), "dLat": round(float(dlat), 8), "dLon": round(float(dlon), 8),
        "nLat": int(nla), "nLon": int(nlo), "oCoSo": n,
        "nongNhatM": round(float(grid[co].min()), 1) if n else None, "trungViM": round(float(np.median(grid[co])), 1) if n else None,
        "data": data,
    }

fs = []
# ── HHU24: đám mây điểm, gán đảo theo tâm gần nhất (bỏ tâm hỏng NaN / tráo) ──────────────
try:
    ds = Dataset(os.path.join(G, "HHU24SWDSCS.nc"))
    ilat = np.asarray(ds["islandLat"][:], float); ilon = np.asarray(ds["islandLon"][:], float)
    trao = ilat > 30; ilat[trao], ilon[trao] = ilon[trao], ilat[trao]
    hop = np.isfinite(ilat) & np.isfinite(ilon)
    lat, lon, dep = (np.asarray(ds[v][:], float) for v in ("latitude", "longitude", "depth"))
    if np.nanmax(np.abs(lat)) > 30: lat, lon = lon, lat
    dep = np.abs(dep)  # nguồn ghi cao độ âm (0 → −48 m) ⇒ độ sâu dương
    log("HHU24", lat.size, "điểm, tâm hợp lệ", int(hop.sum()))
    ids_hop = np.where(hop)[0]
    idx = np.full(lat.size, -1, np.int64)
    for k in range(0, lat.size, 200_000):
        sl = slice(k, k + 200_000)
        d2 = (lat[sl, None] - ilat[None, ids_hop]) ** 2 + ((lon[sl, None] - ilon[None, ids_hop]) * np.cos(np.radians(ilat[None, ids_hop]))) ** 2
        idx[sl] = ids_hop[np.argmin(d2, axis=1)]
    for i in ids_hop:
        r = khop.get(("HHU24", str(int(i))))
        if not r: continue
        m = idx == i
        if m.sum() < 10: continue
        fs.append(feature(r["tenViet"], "HHU24SWDSCS", *luoi_tu_diem(lat[m], lon[m], dep[m])))
    log("HHU24 →", sum(1 for f in fs if f["nguon"] == "HHU24SWDSCS"), "thực thể")
except Exception as e:
    log("HHU24 lỗi:", e)

# ── SCSBathy10: lưới 10 m → gộp khối 10×10 lấy MIN (~90 m) ───────────────────────────────
try:
    files = [p for p in glob.glob(os.path.join(G, "scsbathy10", "**", "*.nc"), recursive=True) if not os.path.basename(p).startswith("._") and "__MACOSX" not in p]
    n_ok = 0
    for p in files:
        fid = os.path.splitext(os.path.basename(p))[0]
        r = khop.get(("SCSBathy10", fid))
        if not r: continue
        ds = Dataset(p)
        kla = "latitude" if "latitude" in ds.variables else "lat"; klo = "longitude" if "longitude" in ds.variables else "lon"
        la = np.asarray(ds[kla][:], float); lo = np.asarray(ds[klo][:], float)
        z = np.asarray(ds["depth_prediction"][:], float).squeeze(); z = np.where((np.abs(z) > 1e5) | ~np.isfinite(z), np.inf, np.abs(z))
        if z.shape != (la.size, lo.size): z = z.T
        if la[0] > la[-1]: la = la[::-1]; z = z[::-1, :]  # trục vĩ độ tăng dần như HHU24
        B = 10
        nla, nlo = z.shape[0] // B, z.shape[1] // B
        if nla == 0 or nlo == 0: continue
        g = z[: nla * B, : nlo * B].reshape(nla, B, nlo, B).min(axis=(1, 3))
        dlat = float(abs(la[1] - la[0])) * B; dlon = float(abs(lo[1] - lo[0])) * B
        fs.append(feature(r["tenViet"], "SCSBathy10", float(la[0]), float(lo[0]), dlat, dlon, nla, nlo, g)); n_ok += 1
    log("SCSBathy10 →", n_ok, "thực thể")
except Exception as e:
    log("SCSBathy10 lỗi:", e)

out = {
    "v": 1, "sinh": time.strftime("%Y-%m-%dT%H:%M:%S"), "datum": "MSL", "donVi": "dm (0–253; 254 = sâu hơn 25,3 m; 255 = không số)",
    "buocM": STEP_M, "quyUoc": "mỗi ô = độ sâu NÔNG NHẤT trong ô (min-pool) — lớp tham khảo, không thay hải đồ",
    "credit": [
        "HHU24SWDSCS — Hohai University, Earth Syst. Sci. Data 2025, doi:10.5194/essd-17-2463-2025, CC BY 4.0",
        "SCSBathy10 — Zenodo doi:10.5281/zenodo.19148819 (2026), CC BY 4.0",
        "Tên thực thể theo danh mục Việt Nam (scripts/dan-duong/ran-10m/ten-ran-bien-dong.json)",
    ],
    "features": fs,
}
p_out = os.path.join(RA, "reef-depth.v1.json")
json.dump(out, open(p_out, "w"), ensure_ascii=False, separators=(",", ":"))
size = os.path.getsize(p_out)
tom = {
    "sinh": out["sinh"], "soThucThe": len(fs), "theoNguon": {k: sum(1 for f in fs if f["nguon"] == k) for k in ("HHU24SWDSCS", "SCSBathy10")},
    "theoNhom": {k: sum(1 for f in fs if f["nhom"] == k) for k in ("hoang-sa", "truong-sa", "scarborough")},
    "tongOCoSo": int(sum(f["oCoSo"] for f in fs)), "kichThuocByte": size,
    "nongNhat": sorted(({"ten": f["ten"], "nguon": f["nguon"], "m": f["nongNhatM"]} for f in fs if f["nongNhatM"] is not None), key=lambda x: x["m"])[:15],
    "tenDuyNhat": sorted({f["ten"] for f in fs}),
}
json.dump(tom, open(os.path.join(RA, "reef-depth.tom-tat.json"), "w"), ensure_ascii=False, indent=1)
md = [f"# reef-depth.v1 — sinh {out['sinh']} (CHƯA PHÁT HÀNH, nằm ngoài repo)", "",
      f"- Thực thể: **{len(fs)}** ({tom['theoNguon']}) · nhóm {tom['theoNhom']} · tên duy nhất {len(tom['tenDuyNhat'])}",
      f"- Ô có số (~100 m): {tom['tongOCoSo']:,} · kích thước JSON: **{size/1e6:.2f} MB** (trần public/data 20 MB)",
      "- Datum MSL · mỗi ô = độ sâu nông nhất · uint8 dm · không có tên gốc nước ngoài trong file", "",
      "| Tên | Nguồn | Nông nhất (m) |", "|---|---|---|", *[f"| {x['ten']} | {x['nguon']} | {x['m']} |" for x in tom["nongNhat"]]]
open(os.path.join(RA, "reef-depth.tom-tat.md"), "w").write("\n".join(md) + "\n")
print("\n".join(md))
