# Dựng bộ "chuyến thật" để chấm: giờ rời/cập khai báo (biên phòng/eCDT) + cảng, theo chỉ số tàu của work/vessels.json
import gzip, json, glob, os, numpy as np
from datetime import datetime
H = os.path.expanduser("~/fish-vet")
vess = json.load(open(f"{H}/work/vessels.json")); vid = {x["id"]: i for i, x in enumerate(vess)}
cat = json.loads(gzip.open(f"{H}/raw/snap/catalog-ports.json.gz").read()); cat = cat.get("items", cat)
pc = {p.get("id") or p.get("_id"): (p.get("lat"), p.get("lng")) for p in cat}
iso = lambda s: int(datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()) if s else None
out, seen = [], set()
for f in sorted(glob.glob(f"{H}/raw/snap/trips-2026-*.ndjson.gz")):
    for l in gzip.open(f, "rb"):
        r = json.loads(l); c = r.get("code")
        if not c or c in seen: continue
        seen.add(c); k = (r.get("vessel") or {}).get("id")
        if k not in vid: continue
        d, a = r.get("departure") or {}, r.get("arrival") or {}
        t0, t1 = iso(d.get("at")), iso(a.get("at"))
        if not t0 or not t1 or t1 <= t0: continue
        vm = r.get("vms") or {}
        out.append((vid[k], t0, t1, (vm.get("label") or "-"), iso(vm.get("departedAt")) or 0, iso(vm.get("arrivedAt")) or 0,
                    *(pc.get(d.get("port")) or (np.nan, np.nan)), *(pc.get(a.get("port")) or (np.nan, np.nan))))
A = np.array([x[:3] + x[4:] for x in out], float); lab = np.array([x[3] for x in out])
np.savez(f"{H}/work/chuyen-that.npz", A=A, lab=lab)
print(len(A), "chuyến khai báo; có toạ độ cảng đi", np.isfinite(A[:, 5]).sum(), "; nhãn", {k: int((lab == k).sum()) for k in set(lab)})
h = (A[:, 2] - A[:, 1]) / 3600; print("giờ p10/50/90", np.percentile(h, [10, 50, 90]).round(1))
