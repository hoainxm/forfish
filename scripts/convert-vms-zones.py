# Chuyển 3 file GeoJSON VMS (Zalo 2026-07-28) -> src/data/vms-zones.json gọn
# - Douglas-Peucker tolerance 0.01 deg (~1.1km) cho ring lớn
# - Làm tròn 4 số lẻ (~11m)
# - Bỏ ring quá nhỏ sau giản lược (đảo li ti không thấy ở zoom toàn quốc)
# - Bỏ MultiLineString duong200hl (trùng ranh giới ngoài đã có trong app)
import json, math, os

SRC = r"D:\Zalo\Dữ liệu vùng biển VMS mới_280726"
OUT = r"C:\Code\ForFish\src\data\vms-zones.json"
TOL = 0.01          # deg, Douglas-Peucker
MIN_SPAN = 0.03     # deg, ring nhỏ hơn cỡ này cả 2 chiều thì bỏ
ROUND = 4

def dp(points, tol):
    """Douglas-Peucker, iterative."""
    if len(points) < 3:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        a, b = stack.pop()
        if b - a < 2:
            continue
        ax, ay = points[a]; bx, by = points[b]
        dx, dy = bx - ax, by - ay
        den = math.hypot(dx, dy)
        maxd, idx = -1.0, -1
        for i in range(a + 1, b):
            px, py = points[i]
            if den == 0:
                d = math.hypot(px - ax, py - ay)
            else:
                d = abs(dx * (ay - py) - dy * (ax - px)) / den
            if d > maxd:
                maxd, idx = d, i
        if maxd > tol:
            keep[idx] = True
            stack.append((a, idx))
            stack.append((idx, b))
    return [p for p, k in zip(points, keep) if k]

def clean_ring(ring):
    pts = [(round(x, ROUND), round(y, ROUND)) for x, y in ring]
    # bỏ điểm trùng liên tiếp
    dedup = [pts[0]]
    for p in pts[1:]:
        if p != dedup[-1]:
            dedup.append(p)
    # đảm bảo hở cuối để DP xử lý, rồi khép lại
    closed = dedup[0] == dedup[-1]
    if closed:
        dedup = dedup[:-1]
    if len(dedup) < 3:
        return None
    simp = dp(dedup + [dedup[0]], TOL)
    if simp[0] != simp[-1]:
        simp.append(simp[0])
    if len(simp) < 4:
        return None
    xs = [p[0] for p in simp]; ys = [p[1] for p in simp]
    if (max(xs) - min(xs)) < MIN_SPAN and (max(ys) - min(ys)) < MIN_SPAN:
        return None
    return [[p[0], p[1]] for p in simp]

def clean_multipolygon(coords):
    out = []
    for poly in coords:
        rings = []
        for i, ring in enumerate(poly):
            c = clean_ring(ring)
            if c is None:
                if i == 0:
                    rings = None
                    break
                continue  # lỗ nhỏ bỏ được
            rings.append(c)
        if rings:
            out.append(rings)
    return out

def load_zone(fname):
    d = json.load(open(os.path.join(SRC, fname), encoding="utf-8"))
    feats = []
    for ft in d["features"]:
        g = ft["geometry"]
        if g["type"] != "MultiPolygon":
            print(f"  bỏ {g['type']} ({ft['properties'].get('_layerType')})")
            continue
        coords = clean_multipolygon(g["coordinates"])
        if not coords:
            continue
        feats.append({
            "type": "Feature",
            "properties": {"ten": ft["properties"].get("Ten_goi") or ""},
            "geometry": {"type": "MultiPolygon", "coordinates": coords},
        })
    return {"type": "FeatureCollection", "features": feats}

zones = {
    "updated": "2026-07-28",
    "allowed": load_zone("vungduocphepdanhbat.geojson"),
    "caution": load_zone("vungchuydanhbat.geojson"),
    "bottomOnly": load_zone("vungchiduocdanhbatcaday.geojson"),
}

def npts(fc):
    return sum(
        len(r)
        for ft in fc["features"]
        for poly in ft["geometry"]["coordinates"]
        for r in poly
    )

for k in ("allowed", "caution", "bottomOnly"):
    fc = zones[k]
    polys = sum(len(ft["geometry"]["coordinates"]) for ft in fc["features"])
    print(k, "features:", len(fc["features"]), "polys:", polys, "pts:", npts(fc))

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(zones, f, ensure_ascii=False, separators=(",", ":"))
print("wrote", OUT, os.path.getsize(OUT), "bytes")
