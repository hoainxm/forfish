#!/usr/bin/env python3
"""KÉO VẾT VMS TỪ DATA LAKE — chỉ backend GPU (anh Long 08/11: "có datalake lại rồi lấy từ datalake cho nhanh, ko cần cào vị trí
vtl nữa"; "xem cái lịch sử lần kết nối trc lấy dữ liệu tới ngày nào thì lấy tiếp cho đủ tới nay"). Tài liệu: ~/fish-vet/docs/nhan-dien-tau-ais.md.

  · Khoá + link: ~/.config/forlife/datalake.env (DL_BASE, DL_KEY; quyền 600, NGOÀI mọi repo). Link trycloudflare đổi liên tục —
    đội Data Lake gửi link mới thì sửa DL_BASE (nhiều link: DL_BASE=a,b,c).
  · Lấy tiếp từ mốc đã có: mốc = điểm cuối trong kho cũ (AI-Assistant datalake-iuu/tracks, tới 06/10/2026 20:01) hoặc lần kéo
    trước (~/fish-vet/raw/dl-tracks/moc.json), lùi 1 ngày cho chắc; tới hôm nay. Chia khung theo tháng.
  · Danh sách tàu: vessels-last-position (tàu có VMS) của kho cũ ∪ tàu đã thấy ở lần kéo trước. 30 tàu/lời gọi (trần API).
  · Ra: ~/fish-vet/raw/dl-tracks/<từ>_<đến>.ndjson.gz — mỗi dòng {v, reg, from, to, n, pts:[[unixSec, lat, lng], …]} (khuôn
    kho cũ) ⇒ ais_kho.py đọc (nguon='vms'). Tiến độ từng lô: <tệp>.lo.json (đứt thì chạy lại, lô xong bỏ qua).
Mã thoát: 0 xong · 1 hỏng giữa chừng (chạy lại được) · 2 thiếu khoá/link hoặc link chết.
"""
import concurrent.futures as cf, datetime as dt, gzip, json, os, sys, time, urllib.request, urllib.error

HOME = os.path.expanduser("~")
ENV = f"{HOME}/.config/forlife/datalake.env"
OUT = f"{HOME}/fish-vet/raw/dl-tracks"
CU = "/mnt/c/Code/AI-Assistant/sdvico-data/data-local/datalake-iuu"
LO, CONC = 30, 3
MOC_CU = dt.date(2026, 10, 6)  # điểm cuối kho cũ: 06/10/2026 20:01 giờ VN (đo 08/11)
log = lambda *a: print(time.strftime("%H:%M:%S"), *a, flush=True)


def doc_env():
    e = {}
    try:
        for line in open(ENV, encoding="utf-8"):
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.strip().split("=", 1)
                e[k] = v.strip().strip('"')
    except OSError:
        pass
    e.update({k: v for k, v in os.environ.items() if k in ("DL_BASE", "DL_KEY")})
    return [b.rstrip("/") for b in e.get("DL_BASE", "").split(",") if b], e.get("DL_KEY")


BASES, KEY = doc_env()
bi = 0


def goi(duong, thu=8):
    global bi
    loi = None
    for lan in range(thu):
        base = BASES[bi % len(BASES)]
        try:
            rq = urllib.request.Request(base + duong, headers={"X-Api-Key": KEY, "Accept": "application/json"})
            with urllib.request.urlopen(rq, timeout=180) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code in (400, 401, 403):
                raise SystemExit(f"Data Lake trả {e.code} cho {duong.split('?')[0]} — khoá sai/hết quyền?")
            loi = e
        except (urllib.error.URLError, TimeoutError, ValueError, OSError) as e:
            loi = e
        bi += 1
        time.sleep(min(60, 3 * 2 ** lan))
    raise RuntimeError(f"{duong.split('?')[0]}: {loi}")


def ds_tau():
    ids = set()
    try:
        for line in open(f"{CU}/vessels-last-position.ndjson", encoding="utf-8"):
            x = json.loads(line)
            if (x.get("device") or {}).get("status") not in (None, "NO_VMS"):
                ids.add((x.get("vessel") or {}).get("id"))
    except OSError:
        log("không đọc được vessels-last-position kho cũ")
    moc = doc_moc()
    ids.update(moc.get("tau", []))
    return sorted(i for i in ids if i)


def doc_moc():
    try:
        return json.load(open(f"{OUT}/moc.json"))
    except (OSError, ValueError):
        return {}


def chuan_diem(p):
    """Điểm Data Lake ⇒ [unixSec, lat, lng]. Khuôn 11/10: [t, lat, lng]; khuôn 08/11: {at: ISO, lat, lng}."""
    try:
        if isinstance(p, dict):
            t = dt.datetime.fromisoformat(str(p["at"]).replace("Z", "+00:00")).timestamp()
            return [int(t), float(p["lat"]), float(p["lng"])]
        return [int(p[0]), float(p[1]), float(p[2])]
    except (KeyError, ValueError, TypeError, IndexError):
        return None


def keo_khung(tu, den, tau):
    ten = f"{OUT}/{tu}_{den}.ndjson.gz"
    tien = f"{ten}.lo.json"
    xong = set(json.load(open(tien))) if os.path.exists(tien) else set()
    lo = [tau[i:i + LO] for i in range(0, len(tau), LO)]
    todo = [i for i in range(len(lo)) if i not in xong]
    log(f"khung {tu} → {den}: {len(todo)}/{len(lo)} lô còn lại")
    diem = co_vet = 0
    moi_nhat = [0]

    def mot(i):
        j = goi(f"/api/dl-iuu-report/vessels/tracks?vessels={','.join(lo[i])}&from={tu}&to={den}")
        dong = []
        for it in j.get("items", []):
            pts = [chuan_diem(p) for p in (it.get("points") or [])]
            pts = [p for p in pts if p]
            if pts:
                moi_nhat[0] = max(moi_nhat[0], pts[-1][0])
                dong.append(json.dumps({"v": (it.get("vessel") or {}).get("id"), "reg": (it.get("vessel") or {}).get("regNo"),
                                        "from": tu, "to": den, "n": len(pts), "pts": pts}, ensure_ascii=False))
        return i, dong

    with cf.ThreadPoolExecutor(CONC) as ex:
        for k, (i, dong) in enumerate(ex.map(mot, todo)):
            if dong:
                with gzip.open(ten, "at", encoding="utf-8") as fh:  # mỗi lô một khối gzip — zcat/gzip đọc liền
                    fh.write("\n".join(dong) + "\n")
                co_vet += len(dong)
                diem += sum(json.loads(d)["n"] for d in dong)
            xong.add(i)
            if k % 20 == 0:
                json.dump(sorted(xong), open(tien, "w"))
                log(f"  {len(xong)}/{len(lo)} lô · {co_vet} tàu có vết · {diem} điểm")
    json.dump(sorted(xong), open(tien, "w"))
    return co_vet, diem, moi_nhat[0]


def main():
    if not BASES or not KEY:
        print(f"thiếu DL_BASE/DL_KEY trong {ENV}", file=sys.stderr)
        return 2
    os.makedirs(OUT, exist_ok=True)
    try:
        goi("/api/dl-iuu-report/provinces", thu=2)
    except (RuntimeError, SystemExit) as e:
        print(f"link Data Lake không sống: {e} — xin đội Data Lake link mới, sửa DL_BASE trong {ENV}", file=sys.stderr)
        return 2
    moc = doc_moc()
    tu = dt.date.fromisoformat(moc["den"]) - dt.timedelta(days=1) if moc.get("den") else MOC_CU
    den = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=7)).date()
    tau = ds_tau()
    log(f"tàu có VMS: {len(tau)} · lấy từ {tu} tới {den}")
    d = tu
    moi_nhat = 0
    while d <= den:
        cuoi_thang = (d.replace(day=28) + dt.timedelta(days=4)).replace(day=1) - dt.timedelta(days=1)
        k_den = min(cuoi_thang, den)
        # khung còn mở (tới hôm nay), HOẶC lần trước Data Lake chưa có dữ liệu tới cuối khung (09/11: khung 13→31/10 kéo lúc
        # dữ liệu mới tới 14/10 bị đánh dấu xong) ⇒ kéo lại từ đầu, không tin tiến độ cũ
        if k_den == den or (moc.get("den") and k_den > dt.date.fromisoformat(moc["den"])):
            for f in (f"{OUT}/{d.isoformat()}_{k_den.isoformat()}.ndjson.gz", f"{OUT}/{d.isoformat()}_{k_den.isoformat()}.ndjson.gz.lo.json"):
                if os.path.exists(f):
                    os.remove(f)
        n, p, mn = keo_khung(d.isoformat(), k_den.isoformat(), tau)
        moi_nhat = max(moi_nhat, mn)
        log(f"XONG {d} → {k_den}: {n} tàu có vết, {p} điểm")
        d = k_den + dt.timedelta(days=1)
    # mốc = ngày (VN) của điểm MỚI NHẤT thực có — Data Lake có thể trễ (08/11 mới tới 14/10); lần sau lấy tiếp từ đó
    den_that = dt.datetime.fromtimestamp(moi_nhat + 7 * 3600, dt.timezone.utc).date() if moi_nhat else tu
    log(f"điểm mới nhất Data Lake: {den_that}")
    json.dump({"den": max(den_that, tu).isoformat(), "luc": dt.datetime.now(dt.timezone.utc).isoformat(), "tau": tau}, open(f"{OUT}/moc.json", "w"))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except RuntimeError as e:
        log("hỏng giữa chừng:", e)
        sys.exit(1)
