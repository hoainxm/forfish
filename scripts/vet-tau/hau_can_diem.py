#!/usr/bin/env python3
"""CHẤM ĐIỂM TÀU HẬU CẦN — học từ nhãn eCDT (vessel.isLogistics, ~95 tàu). CHỈ backend GPU. Tài liệu: nhan-dien-tau-ais.md §5f.
Hồi quy logistic thuần Python (máy GPU không có numpy), đặc trưng chuẩn hoá z, kiểm chéo 5 phần (giấu nhãn từng phần rồi đoán).
Đặc trưng (theo tàu):
  nhật ký eCDT  : log bốc dỡ trung vị/chuyến · log số nhật ký · số loài trung vị · tỉ lệ nhật ký không ghi mẻ · chiều dài
  chuyến eCDT   : log giờ chuyến trung vị
  lượt gặp      : log số bạn nghi chuyển tải khác nhau · log giờ nghi chuyển tải · log lượt ghé ngắn · log số bạn MẤT CÁ
                  (bạn có chuyến bốc dỡ < 50 % sản lượng mà trong chuyến đó gặp tàu này)
Ghi: tau_hau_can.diem_hc (0–1) + muc_hc (CAO = top theo ngưỡng giữ ~50 % độ đúng khi kiểm chéo, VỪA = tới ~20 %)."""
import collections, json, math, os, random, sqlite3, statistics as st

HOME = os.path.expanduser("~")
DB = f"{HOME}/fish-vet/ais/ais.db"
DL = f"{HOME}/fish-vet/datalake/moi-nhat"
L1 = lambda x: math.log1p(max(0.0, x or 0))


def q(a, p):
    a = sorted(a)
    return a[int(p * (len(a) - 1))] if a else 0


def dac_trung(c):
    F = collections.defaultdict(lambda: collections.defaultdict(float))
    nk = collections.defaultdict(lambda: {"ld": [], "loai": [], "khong_me": 0, "n": 0, "dai": None})
    hc = set()
    for line in open(f"{DL}/logbooks-all.ndjson", encoding="utf-8"):
        x = json.loads(line); v = x.get("vessel") or {}; k = v.get("id")
        if not k:
            continue
        r = nk[k]; r["n"] += 1; r["dai"] = v.get("lengthM") or r["dai"]
        if v.get("isLogistics"):
            hc.add(k)
        if x.get("landedKg") is not None:
            r["ld"].append(x["landedKg"])
        r["loai"].append(len((x.get("species") or {}).get("landed") or []))
        if not x.get("haulCount"):
            r["khong_me"] += 1
    for k, r in nk.items():
        f = F[k]
        f["log_boc_do"] = L1(q(r["ld"], .5)); f["log_nhat_ky"] = L1(r["n"]); f["loai"] = q(r["loai"], .5)
        f["khong_me"] = r["khong_me"] / r["n"]; f["dai"] = r["dai"] or 0
    gio = collections.defaultdict(list)
    for v, d, a in c.execute("SELECT v, roi, cap FROM chuyen_tai_chuyen"):
        if a > d:
            gio[v].append((a - d) / 3600)
    for v, L in gio.items():
        F[v]["log_gio_chuyen"] = L1(q(L, .5))
    for v, so_ban, gio_ct in c.execute("SELECT v, so_ban, gio_ct FROM tau_hau_can"):
        F[v]["log_ban_ct"] = L1(so_ban); F[v]["log_gio_ct"] = L1(gio_ct)
    ngan = collections.Counter()
    for a, b in c.execute("SELECT a, b FROM gap_nhau WHERE loai = 'SHORT_MEETING'"):
        ngan[a] += 1; ngan[b] += 1
    for v, n in ngan.items():
        F[v]["log_ngan"] = L1(n)
    # bạn mất cá: chuyến bốc dỡ < 50 % có gặp tàu X ⇒ X được +1 (mỗi bạn một lần)
    mat = {(r[0]): (r[1], r[2]) for r in c.execute(
        "SELECT v, roi, cap FROM chuyen_tai_chuyen WHERE catch_kg > 0 AND landed_kg IS NOT NULL AND landed_kg < 0.5 * catch_kg AND luot_ct > 0")}
    ban_mat = collections.defaultdict(set)
    for v, (d, a) in mat.items():
        for x, y in c.execute("SELECT a, b FROM gap_nhau WHERE loai IN ('SUSPECTED_TRANSSHIPMENT','SHORT_MEETING') AND (a = ? OR b = ?) AND bat_dau BETWEEN ? AND ?", (v, v, d, a)):
            ban_mat[y if x == v else x].add(v)
    for v, s in ban_mat.items():
        F[v]["log_ban_mat_ca"] = L1(len(s))
    return F, hc


def hoc(X, y, lap=300, lr=0.3, l2=1e-3):
    n, m = len(X), len(X[0])
    w = [0.0] * (m + 1)
    pos = sum(y); wp = (n - pos) / max(1, pos)  # cân lớp: nhãn dương rất hiếm
    for _ in range(lap):
        g = [0.0] * (m + 1)
        for xi, yi in zip(X, y):
            z = w[0] + sum(a * b for a, b in zip(w[1:], xi))
            p = 1 / (1 + math.exp(-max(-30, min(30, z))))
            e = (p - yi) * (wp if yi else 1)
            g[0] += e
            for j in range(m):
                g[j + 1] += e * xi[j]
        for j in range(m + 1):
            w[j] -= lr * (g[j] / n + (l2 * w[j] if j else 0))
    return w


def du(w, xi):
    z = w[0] + sum(a * b for a, b in zip(w[1:], xi))
    return 1 / (1 + math.exp(-max(-30, min(30, z))))


def main():
    c = sqlite3.connect(DB)
    cols = [r[1] for r in c.execute("PRAGMA table_info(tau_hau_can)")]
    for col in ("diem_hc REAL", "muc_hc TEXT"):
        if col.split()[0] not in cols:
            c.execute(f"ALTER TABLE tau_hau_can ADD COLUMN {col}")
    c.commit()
    F, hc = dac_trung(c)
    ten = ["log_boc_do", "log_nhat_ky", "loai", "khong_me", "dai", "log_gio_chuyen", "log_ban_ct", "log_gio_ct", "log_ngan", "log_ban_mat_ca"]
    ids = [v for v, f in F.items() if f.get("log_nhat_ky", 0) > 0]  # chỉ tàu có nhật ký — nhãn chỉ có ở đó
    raw = [[F[v].get(t, 0.0) for t in ten] for v in ids]
    mu = [st.mean(col) for col in zip(*raw)]; sd = [st.pstdev(col) or 1 for col in zip(*raw)]
    X = [[(a - m) / s for a, m, s in zip(r, mu, sd)] for r in raw]
    y = [1 if v in hc else 0 for v in ids]
    print("tàu có nhật ký", len(ids), "· nhãn hậu cần", sum(y))
    # kiểm chéo 5 phần
    random.seed(7)
    phan = [random.randrange(5) for _ in ids]
    diem_cv = [0.0] * len(ids)
    for k in range(5):
        tr = [i for i in range(len(ids)) if phan[i] != k]
        tr = [i for i in tr if y[i]] + random.sample([i for i in tr if not y[i]], min(6000, sum(1 for i in tr if not y[i])))  # bớt mẫu âm cho nhanh
        w = hoc([X[i] for i in tr], [y[i] for i in tr])
        for i in range(len(ids)):
            if phan[i] == k:
                diem_cv[i] = du(w, X[i])
    thu_tu = sorted(range(len(ids)), key=lambda i: -diem_cv[i])
    print("kiểm chéo — trúng nhãn trong top k:", {k: sum(y[i] for i in thu_tu[:k]) for k in (25, 50, 100, 200, 500, 1000)})
    # AUC
    pos = [diem_cv[i] for i in range(len(ids)) if y[i]]; neg = [diem_cv[i] for i in range(len(ids)) if not y[i]]
    random.shuffle(neg); neg = neg[:20000]
    auc = sum((p > n_) + 0.5 * (p == n_) for p in pos for n_ in neg) / (len(pos) * len(neg))
    print(f"AUC kiểm chéo {auc:.3f}")
    # ngưỡng theo độ đúng kiểm chéo
    def nguong(chinh_xac):
        tot, best = 0, None
        for r, i in enumerate(thu_tu, 1):
            tot += y[i]
            if tot / r >= chinh_xac:
                best = diem_cv[i]
        return best
    t_cao, t_vua = nguong(0.5), nguong(0.2)
    tat = [i for i in range(len(ids)) if y[i]] + random.sample([i for i in range(len(ids)) if not y[i]], min(8000, len(ids) - sum(y)))
    w = hoc([X[i] for i in tat], [y[i] for i in tat])
    print("trọng số (z):", {t: round(a, 2) for t, a in zip(ten, w[1:])})
    out = []
    for v, xi in zip(ids, X):
        d = du(w, xi)
        muc = "CAO" if t_cao is not None and d >= t_cao else "VỪA" if t_vua is not None and d >= t_vua else None
        out.append((round(d, 4), muc, v))
    c.executemany("INSERT OR IGNORE INTO tau_hau_can (v, nguon, ecdt_hau_can) VALUES (?, 'nk', 0)", [(v,) for _, _, v in out])
    c.executemany("UPDATE tau_hau_can SET diem_hc = ?, muc_hc = ? WHERE v = ?", out)
    c.commit()
    for muc in ("CAO", "VỪA"):
        n, k = c.execute("SELECT count(*), sum(ecdt_hau_can) FROM tau_hau_can WHERE muc_hc = ?", (muc,)).fetchone()
        print(f"muc_hc {muc}: {n} tàu · có nhãn {k} · chưa nhãn (nghi hậu cần chưa khai) {n - (k or 0)}")


if __name__ == "__main__":
    main()
