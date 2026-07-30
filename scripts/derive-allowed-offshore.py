# Tach CUNG NGOAI KHOI cua "vung duoc phep danh bat" — user chot 2026-07-28:
# duong bien gioi moi = vien DO chi phia ngoai khoi, NOI LIEN tu cho giap dat
# lien (Ha Tien tay-nam) toi cho giap dat lien (Mong Cai bac).
#
# Cach lam (sua 2026-07-28: truoc cat theo nguong km lam CUT dau o Ha Tien):
# tren RING NGOAI cua polygon dat lien (nhieu diem nhat), tim 2 dinh gan 2 diem
# giap dat lien = 2 dau mut duong bien gioi 75 diem cu (Ha Tien, Mong Cai) ->
# tach vong thanh 2 cung -> GIU cung xa bo hon (ngoai khoi), lien mach toi ca 2
# dau mut. Ghi key "allowedOffshore" vao src/data/vms-zones.json + xuat SVG.
import json, math, os, re

REPO = r"C:\Code\ForFish"
ZONES = os.path.join(REPO, "src", "data", "vms-zones.json")
COAST = os.path.join(REPO, "public", "data", "vn-coast.v1.json")
BORDER = os.path.join(REPO, "src", "data", "vn-maritime-border.ts")
OUT_SVG = r"C:\Users\Envy\AppData\Local\Temp\claude\C--Code-ForFish\924eac57-faf0-48bf-b401-cb288880b0f3\scratchpad\allowed-offshore.svg"

def dist_km(a, b):
    kx = 111.32 * math.cos(math.radians((a[1] + b[1]) / 2))
    return math.hypot((a[0] - b[0]) * kx, (a[1] - b[1]) * 111.32)

# ── 2 diem giap dat lien = 2 dau mut duong bien gioi 75 diem ──
src = open(BORDER, encoding="utf-8").read()
arr = src.split("VN_MARITIME_BORDER: LngLat[] = [")[1].split("];")[0]
bpts = [(float(a), float(b)) for a, b in re.findall(r"\[\s*(-?\d+\.?\d*),\s*(-?\d+\.?\d*)\s*\]", arr)]
J_HATIEN, J_MONGCAI = bpts[0], bpts[-1]

# ── dat lien: ring nhieu diem nhat (luc dia VN) — de do khoang cach ra bo ──
coast = json.load(open(COAST, encoding="utf-8"))
cbest, cbn = None, 0
for ft in coast["features"]:
    g = ft["geometry"]
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    for poly in polys:
        if len(poly[0]) > cbn:
            cbn, cbest = len(poly[0]), poly[0]
coast_pts = cbest[:: max(1, len(cbest) // 1200)]
def dist_to_coast(p):
    return min(dist_km(p, q) for q in coast_pts)

# ── ring ngoai cua polygon duoc-phep nhieu diem nhat (bien luc dia) ──
zones = json.load(open(ZONES, encoding="utf-8"))
rbest, rbn = None, 0
for ft in zones["allowed"]["features"]:
    for poly in ft["geometry"]["coordinates"]:
        if len(poly[0]) > rbn:
            rbn, rbest = len(poly[0]), poly[0]
ring = rbest[:-1] if rbest[0] == rbest[-1] else rbest  # bo diem khep
n = len(ring)

def closest_idx(J):
    return min(range(n), key=lambda k: dist_km(ring[k], J))
i1, i2 = sorted((closest_idx(J_HATIEN), closest_idx(J_MONGCAI)))
print(f"tach tai #{i1}={ring[i1]} va #{i2}={ring[i2]}")

arcA = ring[i1 : i2 + 1]                    # mot phia
arcB = ring[i2:] + ring[: i1 + 1]           # phia con lai (vong qua diem khep)
def mean_coast(arc):
    s = arc[:: max(1, len(arc) // 60)]
    return sum(dist_to_coast(p) for p in s) / len(s)
mA, mB = mean_coast(arcA), mean_coast(arcB)
offshore = arcA if mA > mB else arcB
print(f"arcA {len(arcA)}d mean {mA:.0f}km · arcB {len(arcB)}d mean {mB:.0f}km -> giu {'A' if mA>mB else 'B'} ({len(offshore)}d)")

zones["allowedOffshore"] = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {"ten": "Ranh giới ngoài khơi (vùng được phép)"},
            "geometry": {"type": "LineString", "coordinates": offshore},
        }
    ],
}
with open(ZONES, "w", encoding="utf-8") as f:
    json.dump(zones, f, ensure_ascii=False, separators=(",", ":"))
print("cap nhat", ZONES, os.path.getsize(ZONES), "bytes")

# ── SVG kiem tra ──
W, H = 820, 1000
LON0, LON1, LAT0, LAT1 = 101.5, 119, 5, 22.5
X = lambda x: (x - LON0) / (LON1 - LON0) * W
Y = lambda y: H - (y - LAT0) / (LAT1 - LAT0) * H
P = lambda pts: "M" + " L".join(f"{X(x):.1f},{Y(y):.1f}" for x, y in pts)
svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" font-family="sans-serif">',
       f'<rect width="{W}" height="{H}" fill="#eef6fb"/>',
       f'<path d="{P(coast_pts)} Z" fill="#d9d0c3" stroke="#b0a894"/>',
       f'<path d="{P(ring)}" fill="none" stroke="#bbb" stroke-width="1"/>',
       f'<path d="{P(offshore)}" fill="none" stroke="#dc2626" stroke-width="2.5"/>']
for J, lab in ((J_HATIEN, "Hà Tiên"), (J_MONGCAI, "Móng Cái")):
    svg.append(f'<circle cx="{X(J[0]):.1f}" cy="{Y(J[1]):.1f}" r="5" fill="#1d4ed8"/>')
    svg.append(f'<text x="{X(J[0])+8:.1f}" y="{Y(J[1]):.1f}" font-size="15" fill="#1d4ed8">{lab}</text>')
svg.append(f'<text x="14" y="26" font-size="17" font-weight="bold">Đỏ = cung ngoài khơi nối 2 mốc giáp bờ · xám = ring đầy đủ</text>')
svg.append("</svg>")
open(OUT_SVG, "w", encoding="utf-8").write("\n".join(svg))
print("wrote", OUT_SVG)
