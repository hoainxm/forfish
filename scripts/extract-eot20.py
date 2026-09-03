# scripts/extract-eot20.py   (chạy: python scripts/extract-eot20.py <thư-mục-EOT20>)
# ─────────────────────────────────────────────────────────────────────────────
# TRÍCH hằng số điều hoà (biên độ + pha) từ mô hình triều EOT20 tại các ĐIỂM đã
# ghi trong scripts/eot20-points.json, rồi GHI ĐÈ lại chính file đó.
#
# ── VÌ SAO CÓ FILE NÀY (và vì sao KHÔNG chạy lúc build) ─────────────────────
# EOT20 là mô hình đại dương lưới 1/8° (~14 km). Nó KHÔNG thay được trạm đo, chỉ
# lấp các cửa lạch XA cả 4 trạm thật — nơi nội suy từ trạm thật lệch nhất. Gói
# EOT20 gốc nặng ~2,3 GB (netCDF), KHÔNG đưa vào repo và KHÔNG tải lúc build.
# File này chạy TAY, hiếm khi (chỉ khi EOT20 ra bản mới hoặc đổi điểm), kết quả
# đọng lại thành scripts/eot20-points.json (~9 KB) — đó mới là thứ generate-
# tides.mjs đọc. Quy đổi đơn vị (cm→m) và pha (sang quy ước V(t) của tides.ts)
# KHÔNG làm ở đây mà ở generate-tides.mjs, bằng cách hiệu chuẩn với 4 trạm thật.
#
# ── GIẤY PHÉP ───────────────────────────────────────────────────────────────
# EOT20 — Empirical Ocean Tide model, Hart-Davis et al. 2021, DGFI-TUM.
# SEANOE, CC-BY 4.0, doi:10.17882/79489. Dùng thương mại ĐƯỢC, chỉ cần ghi nguồn
# (đã ghi trong tide-stations.v1.json). Chỉ dùng cho LỚP BẢN ĐỒ/con nước miễn
# phí — không phải cho dự báo cá (premium). Tải: https://www.seanoe.org/data/00683/79489/
#
# ── LẤY EOT20 ───────────────────────────────────────────────────────────────
#   1. Tải & giải nén tới <thư-mục-EOT20>/ocean_tides/*.nc  (17 sóng)
#   2. python scripts/extract-eot20.py <thư-mục-EOT20>/ocean_tides
#   3. npx tsx scripts/generate-tides.mjs --add-model-only   (quy đổi + ghép trạm)
#   4. npm test
#
# Cần: python + numpy + netCDF4 (pip install netCDF4).
# ─────────────────────────────────────────────────────────────────────────────
import sys, os, glob, json, math
import numpy as np
from netCDF4 import Dataset

HERE = os.path.dirname(os.path.abspath(__file__))
POINTS = os.path.join(HERE, "eot20-points.json")


def constituent_name(path):
    base = os.path.basename(path).lower()
    tok = base.replace("ocean", " ").replace("eot20", " ").replace(".nc", " ")
    for sep in ("_", "-", "."):
        tok = tok.replace(sep, " ")
    parts = [p for p in tok.split() if p]
    return parts[0].upper() if parts else base.upper()


def load_grid(path):
    ds = Dataset(path)
    v = ds.variables
    lon = np.array(v.get("lon", v.get("longitude"))[:], dtype=float)
    lat = np.array(v.get("lat", v.get("latitude"))[:], dtype=float)

    def grab(*names):
        for n in names:
            if n in v:
                a = np.ma.masked_invalid(np.array(v[n][:], dtype=float))
                fv = getattr(v[n], "_FillValue", None)
                if fv is not None:
                    a = np.ma.masked_equal(a, float(fv))
                return a
        return None

    real, imag = grab("real", "re"), grab("imag", "im")
    amp, pha = grab("amplitude", "amp"), grab("phase", "pha")
    ds.close()
    if real is None or imag is None:
        if amp is None or pha is None:
            raise RuntimeError(f"{path}: thiếu real/imag lẫn amp/phase")
        g = np.deg2rad(pha)
        real, imag = amp * np.cos(g), amp * np.sin(g)
    return lon, lat, real, imag


def sample(lon, lat, real, imag, plat, plon):
    """Trung bình nghịch-đảo-khoảng-cách trên các ô ƯỚT quanh điểm (bỏ ô đất/NaN),
    nới bán kính tới khi gặp ô ướt — bờ biển hay rơi sát mép mặt nạ mô hình."""
    L = lon % 360
    plon %= 360
    ci = int(np.argmin(np.abs(lat - plat)))
    cj = int(np.argmin(np.abs(L - plon)))
    for rad in range(0, 6):
        nr = ni = w = 0.0
        for di in range(-rad, rad + 1):
            for dj in range(-rad, rad + 1):
                if rad > 0 and max(abs(di), abs(dj)) != rad:
                    continue
                i, j = ci + di, cj + dj
                if not (0 <= i < len(lat) and 0 <= j < len(L)):
                    continue
                r, m = real[i, j], imag[i, j]
                if np.ma.is_masked(r) or np.ma.is_masked(m) or not (np.isfinite(r) and np.isfinite(m)):
                    continue
                d = math.hypot(lat[i] - plat, (L[j] - plon + 180) % 360 - 180) + 1e-6
                nr += r / d; ni += m / d; w += 1.0 / d
        if w:
            return nr / w, ni / w, rad
    return None, None, None


def main(eot_dir):
    doc = json.load(open(POINTS, encoding="utf-8"))
    ncs = [f for f in glob.glob(os.path.join(eot_dir, "**", "*.nc"), recursive=True)
           if "load" not in os.path.basename(f).lower()]
    if not ncs:
        sys.exit(f"không thấy file .nc nào trong {eot_dir}")
    targets = [("calib", p) for p in doc["calib"]] + [("model", p) for p in doc["model"]]
    for _, p in targets:
        p["cons"] = {}
    for path in sorted(ncs):
        name = constituent_name(path)
        lon, lat, real, imag = load_grid(path)
        for _, p in targets:
            r, m, rad = sample(lon, lat, real, imag, p["lat"], p["lon"])
            if r is None:
                continue
            amp = math.hypot(r, m)
            G = (math.degrees(math.atan2(m, r)) + 360) % 360
            p["cons"][name] = {"amp_cm": round(amp, 4), "G_deg": round(G, 2)}
    doc["extractedAt"] = __import__("datetime").date.today().isoformat()
    json.dump(doc, open(POINTS, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for grp, p in targets:
        pid = p.get("id") or p.get("gaugeId")
        print(f"{grp:5s} {pid:12s} {len(p['cons'])} constituents")
    print(f"\nwrote {POINTS}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("dùng: python scripts/extract-eot20.py <thư-mục-EOT20-ocean_tides>")
    main(sys.argv[1])
