#!/usr/bin/env python3
"""Nạp kết quả trung-chuyen.mjs vào ais.db + đối chiếu nhãn tàu hậu cần eCDT + nhật ký đánh bắt. CHỈ backend GPU.
Anh Long 09/11: "tính cả thời gian trung chuyển, xem cả ecdt". Tài liệu: ~/fish-vet/docs/nhan-dien-tau-ais.md §5.

Bảng (ghi đè mỗi lần chạy):
  gap_nhau      một dòng / lần gặp: a, b, reg_a, reg_b, nguon_a/b (vms|ais), bat_dau, ket_thuc, gio, lat, lon, kc_min, kc_tb, le, loai
  tau_hau_can   theo tàu: số lượt nghi chuyển tải, tổng giờ, số bạn khác nhau, mức nghi (CAO/VỪA), nhãn eCDT is_logistics
  chuyen_tai_chuyen  theo chuyến eCDT có nhật ký: số lượt/giờ nghi chuyển tải trong chuyến, có gặp tàu hậu cần, sản lượng đánh/bốc dỡ
"""
import collections, glob, json, os, sqlite3, statistics as st, sys
from datetime import datetime

HOME = os.path.expanduser("~")
TC = f"{HOME}/fish-vet/trung-chuyen"
DB = f"{HOME}/fish-vet/ais/ais.db"
DL = f"{HOME}/fish-vet/datalake/moi-nhat"


def ts(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()


def q(a, p):
    a = sorted(a)
    return a[int(p * (len(a) - 1))] if a else None


def main():
    c = sqlite3.connect(DB)
    c.executescript("""
    DROP TABLE IF EXISTS gap_nhau;
    CREATE TABLE gap_nhau (a TEXT, b TEXT, reg_a TEXT, reg_b TEXT, nguon_a TEXT, nguon_b TEXT, bat_dau INTEGER, ket_thuc INTEGER,
      gio INTEGER, lat REAL, lon REAL, kc_min REAL, kc_tb REAL, le REAL, loai TEXT);
    DROP TABLE IF EXISTS tau_hau_can;
    CREATE TABLE tau_hau_can (v TEXT PRIMARY KEY, reg TEXT, nguon TEXT, luot_ct INTEGER, gio_ct INTEGER, so_ban INTEGER, muc TEXT,
      di_cap INTEGER, theo_dam INTEGER, neo_cung INTEGER, ecdt_hau_can INTEGER);
    DROP TABLE IF EXISTS chuyen_tai_chuyen;
    CREATE TABLE chuyen_tai_chuyen (trip TEXT PRIMARY KEY, v TEXT, reg TEXT, roi INTEGER, cap INTEGER, luot_ct INTEGER, gio_ct INTEGER,
      gap_hau_can INTEGER, catch_kg REAL, landed_kg REAL);
    """)
    rows = []
    with open(f"{TC}/events.ndjson", encoding="utf-8") as fh:
        for line in fh:
            e = json.loads(line)
            rows.append((e["a"], e["b"], e["regA"], e["regB"], e.get("srcA"), e.get("srcB"), int(ts(e["start"])), int(ts(e["end"])), e["hours"],
                         e["lat"], e["lng"], e["distKmMin"], e["distKmAvg"], e["isolated"], e["kind"]))
            if len(rows) >= 200000:
                c.executemany("INSERT INTO gap_nhau VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", rows); rows = []
    c.executemany("INSERT INTO gap_nhau VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", rows)
    c.executescript("CREATE INDEX gap_a ON gap_nhau (a, bat_dau); CREATE INDEX gap_b ON gap_nhau (b, bat_dau); CREATE INDEX gap_loai ON gap_nhau (loai);")

    # nhãn hậu cần eCDT (vessel.isLogistics trong chuyến / nhật ký — /vessels gần như toàn false, đừng tra ở đó)
    hc, trips = set(), {}
    for f in [f"{DL}/trips.ndjson", f"{DL}/logbooks-all.ndjson"] + sorted(glob.glob(f"{DL}/trips-20*.ndjson")):
        if not os.path.exists(f):
            continue
        for line in open(f, encoding="utf-8"):
            x = json.loads(line)
            v = x.get("vessel") or {}
            if v.get("isLogistics"):
                hc.add(v.get("id"))
            if "departure" in x and x.get("code") and v.get("id"):
                d, a = (x.get("departure") or {}).get("at"), (x.get("arrival") or {}).get("at")
                if d and a:
                    trips[x["code"]] = (v["id"], v.get("regNo"), int(ts(d)), int(ts(a)))
    V = json.load(open(f"{TC}/vessels.json"))["vessels"]
    c.executemany("INSERT INTO tau_hau_can VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                  [(v, x["reg"], x["src"], x["suspectedTransshipments"], x["tsHours"], x["distinctPartners"], x["carrierLevel"],
                    x["pairedEncounters"], x["groupFishing"], x["mooredTogether"], 1 if v in hc else 0) for v, x in V.items()])
    c.commit()

    # ---- đối chiếu nhãn
    print("NHÃN eCDT: tàu hậu cần", len(hc), "· có lượt gặp", sum(1 for v in hc if v in V))
    for muc in ("CAO", "VỪA", None):
        L = [v for v, x in V.items() if x["carrierLevel"] == muc and x["src"] == "vms"]
        print(f"  mức {muc or '—':4s}: {len(L):6d} tàu VMS · trong đó hậu cần eCDT {sum(v in hc for v in L):4d} ({100 * sum(v in hc for v in L) / max(1, len(L)):.1f} %)")
    ban = [V[v]["distinctPartners"] for v in hc if v in V]
    khac = [x["distinctPartners"] for v, x in V.items() if v not in hc and x["src"] == "vms"]
    print("  số bạn nghi chuyển tải khác nhau — hậu cần: p50", q(ban, .5), "p90", q(ban, .9), "· tàu khác: p50", q(khac, .5), "p90", q(khac, .9), "p99", q(khac, .99))

    # ---- thời gian chuyển tải
    g = [r[0] for r in c.execute("SELECT gio FROM gap_nhau WHERE loai = 'SUSPECTED_TRANSSHIPMENT'")]
    g_hc = [r[0] for r in c.execute("SELECT gio FROM gap_nhau WHERE loai = 'SUSPECTED_TRANSSHIPMENT' AND (a IN (SELECT v FROM tau_hau_can WHERE ecdt_hau_can = 1) OR b IN (SELECT v FROM tau_hau_can WHERE ecdt_hau_can = 1))")]
    g_muc = [r[0] for r in c.execute("SELECT gio FROM gap_nhau WHERE loai = 'SUSPECTED_TRANSSHIPMENT' AND (a IN (SELECT v FROM tau_hau_can WHERE muc IS NOT NULL) OR b IN (SELECT v FROM tau_hau_can WHERE muc IS NOT NULL))")]
    for ten, L in (("mọi lượt nghi chuyển tải", g), ("có tàu hậu cần eCDT", g_hc), ("có tàu nghi hậu cần (CAO/VỪA)", g_muc)):
        print(f"THỜI GIAN {ten}: n={len(L)} · p25 {q(L, .25)} · p50 {q(L, .5)} · p75 {q(L, .75)} · p90 {q(L, .9)} giờ · tổng {sum(L)} giờ")
    tu_ais = c.execute("SELECT min(t) FROM vet").fetchone()[0] or 0
    for loai in ("SUSPECTED_TRANSSHIPMENT", "SHORT_MEETING"):
        L = [r[0] for r in c.execute("SELECT gio FROM gap_nhau WHERE loai = ? AND bat_dau >= ?", (loai, tu_ais))]
        print(f"TỪ KHO AIS (ô 10 phút) {loai}: n={len(L)} · p25 {q(L, .25)} · p50 {q(L, .5)} · p75 {q(L, .75)} · p90 {q(L, .9)} giờ")
    print("theo tháng:", c.execute("SELECT strftime('%Y-%m', bat_dau, 'unixepoch'), count(*), sum(gio) FROM gap_nhau WHERE loai='SUSPECTED_TRANSSHIPMENT' GROUP BY 1").fetchall())
    print("có máy AIS riêng (không VMS VN):", c.execute("SELECT count(*) FROM gap_nhau WHERE loai='SUSPECTED_TRANSSHIPMENT' AND (nguon_a='ais' OR nguon_b='ais')").fetchone())
    co = collections.Counter()
    for ra, rb, na, nb in c.execute("SELECT reg_a, reg_b, nguon_a, nguon_b FROM gap_nhau WHERE loai='SUSPECTED_TRANSSHIPMENT' AND (nguon_a='ais' OR nguon_b='ais')"):
        for r, n in ((ra, na), (rb, nb)):
            if n == "ais":
                co[(r or "").rsplit("[", 1)[-1].rstrip("]")] += 1
    print("  cờ máy AIS riêng:", co.most_common(10))

    # ---- TÀU HẬU CẦN THEO NHẬT KÝ (đo 09/11 trên 95 tàu có nhãn): lượt gặp KHÔNG tách được (VMS 1 giờ/điểm, tàu hậu cần ghé mỗi
    # tàu cá ngắn) — "≥ 8 bạn" chỉ trúng 6 %. Nhật ký tách rõ: hậu cần bốc dỡ trung vị ~20 t/chuyến (tàu khác ~0,2 t), 21 nhật ký
    # (tàu khác 7), 3 loài/chuyến (1). Xếp theo bốc dỡ trung vị: top 100 trúng 25. Mức: CAO ≥ 15 t, VỪA ≥ 8 t (≥ 3 nhật ký).
    nk = collections.defaultdict(lambda: {"n": 0, "ld": [], "loai": []})
    for line in open(f"{DL}/logbooks-all.ndjson", encoding="utf-8"):
        x = json.loads(line)
        v = (x.get("vessel") or {}).get("id")
        if not v:
            continue
        r = nk[v]; r["n"] += 1
        if x.get("landedKg") is not None:
            r["ld"].append(x["landedKg"])
        r["loai"].append(len((x.get("species") or {}).get("landed") or []))
    for col in ("so_nhat_ky INTEGER", "boc_do_p50 REAL", "loai_p50 REAL", "muc_nk TEXT"):
        c.execute(f"ALTER TABLE tau_hau_can ADD COLUMN {col}")
    up, them = [], []
    for v, r in nk.items():
        ld = q(r["ld"], .5) or 0
        muc = ("CAO" if ld >= 15000 else "VỪA" if ld >= 8000 else None) if r["n"] >= 3 else None
        up.append((r["n"], ld, q(r["loai"], .5), muc, v))
        if v not in V:
            them.append((v, None, "nk", 0, 0, 0, None, 0, 0, 0, 1 if v in hc else 0))
    c.executemany("""INSERT OR IGNORE INTO tau_hau_can (v, reg, nguon, luot_ct, gio_ct, so_ban, muc, di_cap, theo_dam, neo_cung, ecdt_hau_can)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?)""", them)
    c.executemany("UPDATE tau_hau_can SET so_nhat_ky = ?, boc_do_p50 = ?, loai_p50 = ?, muc_nk = ? WHERE v = ?", up)
    c.commit()
    for muc in ("CAO", "VỪA"):
        n, k = c.execute("SELECT count(*), sum(ecdt_hau_can) FROM tau_hau_can WHERE muc_nk = ?", (muc,)).fetchone()
        print(f"HẬU CẦN THEO NHẬT KÝ mức {muc}: {n} tàu · trúng nhãn eCDT {k} ({100 * (k or 0) / max(1, n):.0f} %)")
    n, k = c.execute("SELECT count(*), sum(ecdt_hau_can) FROM tau_hau_can WHERE muc_nk IS NOT NULL AND muc IS NOT NULL").fetchone()
    print(f"  cả hai (nhật ký + lượt gặp): {n} tàu · trúng nhãn {k}")

    # ---- nhật ký đánh bắt: chuyến có / không có lượt nghi chuyển tải
    if not trips:
        print("chưa có chuyến eCDT trong", DL); return
    ev = collections.defaultdict(list)
    for a, b, bd, kt, gio in c.execute("SELECT a, b, bat_dau, ket_thuc, gio FROM gap_nhau WHERE loai = 'SUSPECTED_TRANSSHIPMENT'"):
        ev[a].append((bd, gio, b)); ev[b].append((bd, gio, a))
    lb = {}
    f = f"{DL}/logbooks-all.ndjson"
    for line in open(f, encoding="utf-8"):
        x = json.loads(line)
        k = (x.get("trip") or {}).get("code")
        if k:
            lb[k] = (x.get("catchKg"), x.get("landedKg"))
    out = []
    for code, (v, reg, d, a) in trips.items():
        L = [e for e in ev.get(v, ()) if d <= e[0] <= a]
        ck, ld = lb.get(code, (None, None))
        out.append((code, v, reg, d, a, len(L), sum(e[1] for e in L), int(any(e[2] in hc for e in L)), ck, ld))
    c.executemany("INSERT OR REPLACE INTO chuyen_tai_chuyen VALUES (?,?,?,?,?,?,?,?,?,?)", out)
    c.commit()
    print("CHUYẾN eCDT:", len(out), "· có lượt nghi chuyển tải", sum(1 for r in out if r[5]), "· gặp tàu hậu cần eCDT", sum(r[7] for r in out))
    for ten, dk in (("có chuyển tải", lambda r: r[5] > 0), ("có gặp tàu hậu cần", lambda r: r[7] == 1), ("không", lambda r: r[5] == 0)):
        R = [r for r in out if dk(r) and r[8] and r[8] > 0 and r[9] is not None and r[2]]
        tl = [r[9] / r[8] for r in R]
        print(f"  nhật ký có sản lượng mẻ — {ten}: {len(R)} chuyến · bốc dỡ/đánh bắt p50 {q(tl, .5) and round(q(tl, .5), 2)} · bốc dỡ < 50 %: {sum(t < .5 for t in tl)}")
    c.close()


if __name__ == "__main__":
    sys.exit(main())
