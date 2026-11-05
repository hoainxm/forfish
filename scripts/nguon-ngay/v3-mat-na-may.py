#!/usr/bin/env python3
"""ĐỐI CHỨNG v3 của thí nghiệm nguồn phù du (2026-11-05, README rà train §7.11): giá trị DINEOF nhưng che null đúng ô
ảnh thật (v2) null ⇒ tách "mặt nạ mây" khỏi "giá trị phù du". Đường dẫn cố định theo máy GPU (~/sdfish-l3)."""
import json, glob, os
L = "/home/long/sdfish-l3"
G0 = "/mnt/c/Users/admin/sdfish-data/fc-full/grids"
out = f"{L}/v3/grids"; os.makedirs(out, exist_ok=True)
for f in os.listdir(G0):
    if f == "etopo.json" or any(f.startswith(t + "-") for t in ("sst", "sla", "anom", "sstFine")):
        q = f"{out}/{f}"
        if not os.path.exists(q): os.symlink(f"{G0}/{f}", q)
n = 0
for p2 in sorted(glob.glob(f"{L}/v2/grids/chl*-2026-*.json")):
    b = os.path.basename(p2)
    t2 = json.load(open(p2))["table"]; t0 = json.load(open(f"{G0}/{b}"))["table"]
    assert len(t2["rows"]) == len(t0["rows"])
    rows = [[r0[0], r0[1], r0[2], r0[3], (r0[4] if r2[4] is not None else None)] for r0, r2 in zip(t0["rows"], t2["rows"])]
    json.dump({"table": {**t0, "rows": rows}}, open(f"{out}/{b}", "w"), separators=(",", ":")); n += 1
print("v3 tệp", n)
