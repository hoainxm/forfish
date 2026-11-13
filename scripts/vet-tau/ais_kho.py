#!/usr/bin/env python3
"""KHO NHẬN DIỆN TÀU AIS — chỉ ở gpu-desktop (anh Long 08/11/2026: "để trên gpu thôi, phục vụ cho train, theo dõi vết tàu,
tối ưu cái đánh bắt, thuật toán tìm đường, thời tiết"). Nghiên cứu gốc: ~/fish-vet/docs/nhan-dien-tau-ais.md.

Mỗi lần chạy (timer ais-kho, mỗi ngày; chạy lại bao nhiêu lần cũng được — chỉ đọc bản quét chưa có):
  1. Đọc bản quét AIS MỚI ở ~/.local/forlife/tau-ais/luu (mỗi giờ một bản) ⇒ bảng
       may      một dòng / máy phát (SHIP_ID — khoá thật; MMSI KHÔNG làm khoá: 610 MMSI cờ VN dùng chung nhiều máy)
       ten      lịch sử TÊN GỐC (đã bỏ đuôi pin của phao) của từng máy: từ · đến · số lần
       vet      điểm theo giờ (t = luc − ELAPSED) của máy cờ VN + mọi tàu cá (SHIPTYPE 2) mọi cờ + MỌI tàu khác có MMSI 9 số
                (anh Long 13/11: "lưu cả tàu buôn"). Máy không MMSI ngoài nhóm VN/tàu cá bỏ: MarineTraffic đặt SHIP_ID mới gần
                như mỗi lần thấy (đo 12/11: ~470 nghìn mã/ngày), không theo dõi được.
       Nhận diện số ĐK, dò phao, trung chuyển CHỈ xét NHÓM GỐC (cờ VN / MMSI 574 / SHIPTYPE 2 — SQL NHOM_GOC) như trước 13/11.
  2. Sổ tàu VN (Data Lake vessels.ndjson) ⇒ so_tau (số đăng ký, dài, nghề, tỉnh — KHÔNG lấy chủ tàu/SĐT).
  3. Nhận diện ⇒ nhan_dien (ship_id → số đăng ký). Vị trí TÍCH LUỸ THEO NGÀY (tau_ngay, bang_chung — §3b):
       cach='ten'    tên máy có số đăng ký khớp sổ (mọi máy)
       cach='vi_tri' máy đi sát vết có số đăng ký cùng giờ (vết: S-Tracking ~/fish-vet/raw/stracking-ais/*.ndjson,
                     Data Lake tracks nếu có tháng trùng kho AIS)
       vai: 'tren_tau' (đi sát vết) · 'phao' (máy là phao, tên mang số tàu) · 'mang_so' (tên mang số, chưa rõ vai) ·
            'nghi_di_doi' (hai máy cùng đi sát — cào đôi / hai máy trên một tàu / phao để trên boong)
  4. View cho train: v_may (máy + số đăng ký tốt nhất + nghề/dài từ sổ).

  python3 ais_kho.py            chạy đủ
  python3 ais_kho.py --chi-khop chỉ tính lại nhận diện
  python3 ais_kho.py --lam-lai  xoá bằng chứng ngày + nhận diện vị trí rồi tính lại từ đầu (đổi luật)
  python3 ais_kho.py --chi-khop --ds-cao <tệp> [--ngan-sach 2000]   + ghi danh sách IMEI ĐẾN HẠN cào (lịch thông minh §4)
  python3 ais_kho.py --bo-sung-tau-khac   đọc lại MỌI bản quét đã nạp, chỉ thêm máy NGOÀI nhóm gốc (chạy một lần sau 13/11; chạy lại
                                          bị chặn bởi bảng meta để không cộng đôi so_lan)
  TRA: SELECT * FROM v_tau_ais WHERE reg = 'BD-97xxx'  — máy AIS đang dùng + vị trí mới nhất theo AIS (không cần S-Tracking)
Mã thoát: 0 xong · 2 thiếu kho AIS.
"""
import bisect, collections, glob, gzip, json, math, os, re, sqlite3, sys, time
from datetime import datetime, timezone

HOME = os.path.expanduser("~")
LUU = f"{HOME}/.local/forlife/tau-ais/luu"
DB = f"{HOME}/fish-vet/ais/ais.db"
SO_TAU = "/mnt/c/Code/AI-Assistant/sdvico-data/data-local/datalake-iuu/vessels.ndjson"
DL_TRACKS = f"{HOME}/fish-vet/raw/dl-tracks"  # dl-keo-vet.py kéo tiếp từ Data Lake (kho cũ AI-Assistant chỉ tới 06/10)
ST_DIR = f"{HOME}/fish-vet/raw/stracking-ais"

# ---- luật (đo ở docs/research/nhan-dien-tau-ais-2026-11.md §3)
DT_MAX = 45 * 60          # lệch giờ tối đa khi không nội suy được
R_KM = 2.0                # bán kính "gặp"
MIN_GAP, MIN_TL, MIN_O, D_TV = 5, 0.8, 3, 2.5   # D_TV 1,6 → 2,5 (09/11, chinh_khop.py: nhiều tàu hơn, độ đúng giữ)
O = 0.05                  # ô chỉ mục (độ)

TINH = sorted(set("QN HP TB ND NB TH NA HT QB QT TTH H DNA DNG QNA QNG BD PY KH NT BTH BT BV BR TG BTR BTE TV ST BL CM KG HG LA DN SG DT AG".split()), key=len, reverse=True)
RE_SDK = re.compile(r"(?<![A-Z0-9])(?P<t>" + "|".join(TINH) + r")[\s\-\._]*(?P<so>\d{4,5})(?:[\s\-\._]*T\s*S)?(?![0-9])")
RE_DUOI = re.compile(r"^(?P<goc>.*?\D)\s*(?P<pin>\d{1,3})%?$")
RE_PHAO = re.compile(r"\b(L\s?GHE|LGHE|LRE|LXU|LXN|RAP|LUOI|LBAO|DL|P\d{1,2}|B\d+F\d+)\b")

log = lambda *a: print(time.strftime("%H:%M:%S"), *a, flush=True)

# nhóm máy dùng cho nhận diện số ĐK / phao / trung chuyển — đúng tập kho giữ trước 13/11 (cờ VN, MMSI 574, tàu cá mọi cờ)
# cờ nhom_goc ghi lúc nạp, giữ mãi (loai_ais theo bản quét mới nhất ⇒ máy từng là tàu cá có thể đổi loại; đo 13/11: 536 máy)
NHOM_GOC = "m.nhom_goc = 1"


def thuoc_nhom(mm, co, loai):
    """'goc' = cờ VN / MMSI 574 / tàu cá · 'khac' = tàu khác có MMSI 9 số · None = bỏ (không MMSI, SHIP_ID không bền)."""
    if co == "VN" or mm.startswith("574") or loai == 2:
        return "goc"
    return "khac" if len(mm) == 9 and mm.isdigit() else None


def chuan(s):
    return re.sub(r"\s+", " ", (s or "").strip().upper())


def goc(ten):
    """Bỏ đuôi pin: 'KH 9xxxx P1 83' ⇒ 'KH 9xxxx P1'. Tên chỉ toàn số thì giữ."""
    m = RE_DUOI.match(ten)
    return m.group("goc").strip() if m and m.group("goc").strip() else ten


def sua_so(s):
    return re.sub(r"(?<=\d)O|O(?=\d)", "0", s)


def khoa_reg(reg):
    m = re.match(r"([A-Z]+)-?(\d+)", (reg or "").upper().replace("Đ", "D"))
    return f"{m.group(1)}-{m.group(2)}" if m else None


def regs_trong_ten(ten):
    return {f"{m.group('t')}-{m.group('so')}" for m in RE_SDK.finditer(sua_so(ten).replace("Đ", "D"))}


def km(a1, o1, a2, o2):
    r = math.pi / 180
    return 6371 * math.hypot((o2 - o1) * r * math.cos((a1 + a2) * r / 2), (a2 - a1) * r)


def mo_db():
    os.makedirs(os.path.dirname(DB), exist_ok=True)
    c = sqlite3.connect(DB)
    c.executescript("""
    PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS ban_quet (luc TEXT PRIMARY KEY, so_tau INTEGER);
    CREATE TABLE IF NOT EXISTS may (
      ship_id TEXT PRIMARY KEY, mmsi TEXT, co TEXT, loai_ais INTEGER, dai_ais INTEGER,
      lan_dau TEXT, lan_cuoi TEXT, so_lan INTEGER DEFAULT 0, toc_max REAL DEFAULT 0, la_phao INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS ten (
      ship_id TEXT, ten_goc TEXT, ten_mau TEXT, tu TEXT, den TEXT, so_lan INTEGER,
      PRIMARY KEY (ship_id, ten_goc)) WITHOUT ROWID;
    CREATE TABLE IF NOT EXISTS vet (
      ship_id TEXT, t INTEGER, lat REAL, lon REAL, kn REAL, huong INTEGER,
      PRIMARY KEY (ship_id, t)) WITHOUT ROWID;
    CREATE INDEX IF NOT EXISTS vet_t ON vet (t);
    CREATE TABLE IF NOT EXISTS so_tau (reg_khoa TEXT PRIMARY KEY, reg TEXT, dai REAL, cv REAL, nghe TEXT, tinh TEXT, status TEXT);
    CREATE TABLE IF NOT EXISTS nhan_dien (
      ship_id TEXT, reg TEXT, cach TEXT, vai TEXT, diem REAL, gap INTEGER, d_tv REAL, tu TEXT, den TEXT, nguon TEXT, cap_nhat TEXT,
      PRIMARY KEY (ship_id, reg, cach, nguon)) WITHOUT ROWID;
    """)
    if "nhom_goc" not in {r[1] for r in c.execute("PRAGMA table_info(may)")}:
        # thêm 13/11. Kho có sẵn: máy nào có trong bản sao trước khi bổ sung (ais.db.truoc-1311) là nhóm gốc; kho mới tinh: rỗng
        c.execute("ALTER TABLE may ADD COLUMN nhom_goc INTEGER DEFAULT 0")
        cu = os.path.join(os.path.dirname(DB), "ais.db.truoc-1311")
        if os.path.exists(cu):
            c.execute("ATTACH DATABASE ? AS cu", (cu,))  # chỉ đọc bảng may
            c.execute("UPDATE may SET nhom_goc = 1 WHERE ship_id IN (SELECT ship_id FROM cu.may)")
            c.commit()
            c.execute("DETACH DATABASE cu")
        else:
            c.execute("UPDATE may SET nhom_goc = 1")
        c.commit()
    c.execute("DROP VIEW IF EXISTS v_may")
    c.execute("""CREATE VIEW v_may AS
      SELECT m.*, (SELECT ten_goc FROM ten WHERE ten.ship_id = m.ship_id ORDER BY den DESC LIMIT 1) AS ten_moi,
             (SELECT count(*) FROM ten WHERE ten.ship_id = m.ship_id) AS so_ten,
             n.reg, n.cach, n.vai, n.diem, s.dai AS dai_so, s.nghe, s.tinh
      FROM may m
      LEFT JOIN (SELECT * FROM nhan_dien ORDER BY (cach = 'vi_tri') DESC, diem DESC) n ON n.ship_id = m.ship_id
      LEFT JOIN so_tau s ON s.reg_khoa = n.reg
      GROUP BY m.ship_id""")
    return c


# ---------------------------------------------------------------- 1. nạp bản quét mới
def nap_ban_quet(c):
    da = {r[0] for r in c.execute("SELECT luc FROM ban_quet")}
    tep = sorted(glob.glob(f"{LUU}/20*/*.ndjson.gz"))
    if not tep:
        return -1
    moi = 0
    for f in tep:
        try:
            fh = gzip.open(f, "rt")
            lines = fh.readlines()
        except (OSError, EOFError):  # tệp ngày đang được ghi dở ⇒ đọc được phần nào hay phần đó
            try:
                fh = gzip.open(f, "rt"); lines = []
                for line in fh:
                    lines.append(line)
            except (OSError, EOFError):
                pass
        for line in lines:
            try:
                o = json.loads(line)
            except Exception:
                continue
            luc = o.get("luc")
            if not luc or luc in da:
                continue
            nap_mot(c, o)
            c.execute("INSERT OR IGNORE INTO ban_quet VALUES (?,?)", (luc, len(o.get("tho", []))))
            da.add(luc)
            moi += 1
        c.commit()
    return moi


def nap_mot(c, o, chi_khac=False):
    luc = o["luc"]
    ts = datetime.fromisoformat(luc.replace("Z", "+00:00")).timestamp()
    may_rows, ten_rows, vet_rows = [], [], []
    for r in o.get("tho", []):
        sid = str(r.get("SHIP_ID") or "")
        if not sid:
            continue
        mm = str(r.get("MMSI") or "")
        co = r.get("FLAG") or ""
        try:
            loai = int(r.get("SHIPTYPE") or 0)
        except ValueError:
            loai = 0
        nhom = thuoc_nhom(mm, co, loai)
        if nhom is None or (chi_khac and nhom != "khac"):
            continue
        try:
            la, lo = float(r["LAT"]), float(r["LON"])
            kn = int(r.get("SPEED") or 0) / 10
            t = int(ts - 60 * int(r.get("ELAPSED") or 0))
        except (KeyError, ValueError, TypeError):
            continue
        try:
            huong = int(r.get("COURSE")) if r.get("COURSE") not in (None, "") else None
            dai = int(r.get("LENGTH")) if r.get("LENGTH") not in (None, "") else None
        except ValueError:
            huong, dai = None, None
        may_rows.append((sid, mm or None, co or None, loai, dai, luc, luc, kn, 1 if nhom == "goc" else 0))
        vet_rows.append((sid, t, la, lo, kn, huong))
        tt = chuan(r.get("SHIPNAME"))
        if tt and not re.fullmatch(r"\[.*\]", tt):
            ten_rows.append((sid, goc(tt), tt, luc, luc))
    c.executemany("""INSERT INTO may (ship_id, mmsi, co, loai_ais, dai_ais, lan_dau, lan_cuoi, so_lan, toc_max, nhom_goc) VALUES (?,?,?,?,?,?,?,1,?,?)
      ON CONFLICT(ship_id) DO UPDATE SET mmsi = coalesce(excluded.mmsi, mmsi), co = coalesce(excluded.co, co),
        loai_ais = excluded.loai_ais, dai_ais = coalesce(excluded.dai_ais, dai_ais),
        lan_dau = min(lan_dau, excluded.lan_dau), lan_cuoi = max(lan_cuoi, excluded.lan_cuoi),
        so_lan = so_lan + 1, toc_max = max(toc_max, excluded.toc_max), nhom_goc = max(nhom_goc, excluded.nhom_goc)""", may_rows)
    c.executemany("""INSERT INTO ten VALUES (?,?,?,?,?,1)
      ON CONFLICT(ship_id, ten_goc) DO UPDATE SET tu = min(tu, excluded.tu), den = max(den, excluded.den),
        ten_mau = CASE WHEN excluded.den > den THEN excluded.ten_mau ELSE ten_mau END, so_lan = so_lan + 1""", ten_rows)
    c.executemany("INSERT OR IGNORE INTO vet VALUES (?,?,?,?,?,?)", vet_rows)


# Nhóm đồ nghề đọc từ tên máy (anh Long 09/11: "phao cho nghề nào ? có rút vào đặc điểm ?"). Thứ tự = ưu tiên: "L GHE" là lưới
# ghẹ (lưới) chứ không phải lồng ghẹ. Đo 09/11: 7 280 phao VN — lưới ~1 800, P<số> ~1 700, chà ~490, rập/lồng ~480, câu ~280.
DO_NGHE = [
    ("luoi", re.compile(r"L\s?GHE|LUOI|L\.?\s?RUT|(?<![A-Z])LR(?![A-Z])|LRE|(?<![A-Z])LX|LNOI|XU(?![A-Z])|(?<![A-Z])NET(?![A-Z])")),
    ("cha", re.compile(r"(?<![A-Z])CHA(?![A-Z])|CHA\d|(?<![A-Z])RAO(?![A-Z])")),
    ("rap_long", re.compile(r"RAP|RXEP|(?<![A-Z])LONG(?![A-Z])|(?<![A-Z])LOP(?![A-Z])|(?<![A-Z])OC(?![A-Z])|GHE|(?<![A-Z])CUA(?![A-Z])")),
    ("cau", re.compile(r"(?<![A-Z])CAU(?![A-Z])|(?<![A-Z])DC(?![A-Z])|DAYCAU")),
    ("vay_chup", re.compile(r"(?<![A-Z])VAY(?![A-Z])|CHUP")),
    ("so_phao", re.compile(r"(?<![A-Z])P\d{1,2}(?!\d)|PHAO|BUOY")),
]


def nhom_do_nghe(tens):
    for nhom, r in DO_NGHE:
        if r.search(tens):
            return nhom
    return None


def danh_dau_phao(c):
    """Phao = máy gắn lưới/rập/chà, không phải máy trên tàu. Ba luật (một là đủ):
      (1) tên có từ đồ nghề/P<số> + không bao giờ quá 0,5 kn;
      (2) tên có đuôi pin (tên gốc ≠ tên mẫu) + không quá 1,5 kn;
      (3) BẢN 2 (09/11): tên đồ nghề HOẶC đuôi pin + < 3 % điểm chạy ≥ 3 kn (≥ 20 điểm). Phao từng được chở trên boong (lúc
          ra/vào) có toc_max cao nên luật (1)(2) lọt; nhưng tàu thật chạy ≥ 3 kn ~25 % thời gian (đo 09/11: p10 = 2 %).
    Máy tên đồ nghề mà CHẠY như tàu (~25 % ≥ 3 kn — đo 09/11 trên 349 máy) KHÔNG phải phao: bà con gắn máy phao lưới lên tàu
    làm máy AIS của tàu. Giữ là máy trên tàu, chỉ ghi nhóm đồ nghề (bảng do_nghe) làm đặc điểm.
    Ghi kèm bảng do_nghe(ship_id, nhom, la_phao) cho MỌI máy có tên đồ nghề."""
    c.execute("UPDATE may SET la_phao = 0")
    c.execute("CREATE TABLE IF NOT EXISTS do_nghe (ship_id TEXT PRIMARY KEY, nhom TEXT, la_phao INTEGER, ty_le_nhanh REAL)")
    c.execute("DELETE FROM do_nghe")
    nhanh = {sid: (f, n) for sid, f, n in c.execute(
        f"SELECT v.ship_id, avg(v.kn >= 3), count(*) FROM vet v JOIN may m USING (ship_id) WHERE {NHOM_GOC} GROUP BY v.ship_id")}
    # tàu buôn tên đuôi số đậu neo lâu ("SEA MEADOW 22", 0 kn) sẽ dính luật đuôi pin ⇒ chỉ xét nhóm gốc
    rows = c.execute(f"""SELECT m.ship_id, m.toc_max, group_concat(t.ten_goc, '|'), sum(t.ten_goc <> t.ten_mau)
                        FROM may m JOIN ten t USING (ship_id) WHERE {NHOM_GOC} GROUP BY m.ship_id""").fetchall()
    phao, dn = [], []
    for sid, toc, tens, co_duoi in rows:
        tens = tens or ""
        nhom = nhom_do_nghe(tens)
        f, n = nhanh.get(sid, (None, 0))
        la = (toc <= 0.5 and RE_PHAO.search(tens)) or (co_duoi and toc <= 1.5) \
            or ((nhom or co_duoi) and n >= 20 and f is not None and f < 0.03)
        if la:
            phao.append((sid,))
        if nhom:
            dn.append((sid, nhom, 1 if la else 0, round(f, 3) if f is not None else None))
    c.executemany("UPDATE may SET la_phao = 1 WHERE ship_id = ?", phao)
    c.executemany("INSERT INTO do_nghe VALUES (?,?,?,?)", dn)
    c.commit()
    return len(phao)


# ---------------------------------------------------------------- 2. sổ tàu
def nap_so_tau(c):
    if not os.path.exists(SO_TAU):
        log("không thấy sổ tàu", SO_TAU, "— giữ bản cũ")
        return 0
    rows = []
    with open(SO_TAU, encoding="utf-8") as fh:
        for line in fh:
            try:
                v = json.loads(line)
            except Exception:
                continue
            k = khoa_reg(v.get("reg"))
            if k:
                rows.append((k, v.get("reg"), v.get("lengthM"), v.get("powerCv"), v.get("gear"), v.get("provinceName"), v.get("status")))
    c.execute("DELETE FROM so_tau")
    c.executemany("INSERT OR REPLACE INTO so_tau VALUES (?,?,?,?,?,?,?)", rows)
    c.commit()
    return len(rows)


# ---------------------------------------------------------------- 3a. nhận diện theo tên
def khop_ten(c, now):
    so = {r[0] for r in c.execute("SELECT reg_khoa FROM so_tau")}
    phao = {r[0] for r in c.execute("SELECT ship_id FROM may WHERE la_phao = 1")}
    c.execute("DELETE FROM nhan_dien WHERE cach = 'ten'")
    out = []
    for sid, ten_goc, tu, den in c.execute(f"SELECT t.ship_id, t.ten_goc, t.tu, t.den FROM ten t JOIN may m USING (ship_id) WHERE {NHOM_GOC}").fetchall():
        for k in regs_trong_ten(ten_goc):
            if k in so:
                out.append((sid, k, "ten", "phao" if sid in phao else "mang_so", 1.0, None, None, tu, den, "ten-ais", now))
    c.executemany("INSERT OR REPLACE INTO nhan_dien VALUES (?,?,?,?,?,?,?,?,?,?,?)", out)
    c.commit()
    return len(out)


# ---------------------------------------------------------------- 3b. nhận diện theo vị trí — TÍCH LUỸ THEO NGÀY
# Anh Long 08/11: "tàu tuần này đi biển tuần kia ko rồi các kiểu, tích luỹ theo thời gian mới so khớp đc".
#   · Mỗi (tàu, ngày giờ VN): chỉ điểm NGOÀI BIỂN (cách mọi cảng cá > CANG_KM) là bằng chứng — trong cảng tàu đậu sát nhau.
#     Ngày có ≥ 1 điểm ngoài biển = ngày đi biển (bảng tau_ngay). Ngày nằm bờ: ghi lại, không tạo bằng chứng.
#   · Ngày đi biển ⇒ mọi máy AIS cờ VN đi gần tàu hôm đó ⇒ bang_chung (gap, cung, trung vị, ô). Ngày đã tính thì KHÔNG tính
#     lại; chỉ tính ngày đã trọn (trước hôm nay, sau ngày đầu kho AIS).
#   · Cộng dồn MỌI ngày ⇒ nhan_dien cach='vi_tri': máy đạt khi tổng gap ≥ MIN_GAP, tỉ lệ ngày khớp ≥ MIN_TL_NGAY, ≥ MIN_O ô 0,1°,
#     trung vị ≤ D_TV; máy đạt khác TRÙNG khung ngày và điểm sát nút ⇒ 'nghi_di_doi'; KHÔNG trùng khung ⇒ cũng là máy của
#     tàu ở thời kỳ khác (tàu đổi máy / máy chuyển tàu — xem tu/den).
CANG_KM = 10.0
MIN_TL_NGAY = 0.5  # 0,7 → 0,5 (09/11, chinh_khop.py — đi kèm gán hai chiều)
CANG = "/mnt/c/Code/AI-Assistant/sdvico-data/data-local/datalake-iuu/catalog-ports.json"
VN_TZ = 7 * 3600


def ngay_vn(t):
    return datetime.fromtimestamp(t + VN_TZ, timezone.utc).strftime("%Y-%m-%d")


def doc_cang():
    try:
        d = json.load(open(CANG, encoding="utf-8"))
        return [(x["lat"], x["lng"]) for x in d.get("items", []) if x.get("lat") and x.get("lng") and not x.get("isTest")]
    except (OSError, ValueError, KeyError):
        log("không đọc được danh mục cảng — coi mọi điểm là ngoài biển (vẫn còn luật ≥ 3 ô)")
        return []


def mo_bang_ngay(c):
    c.executescript("""
    CREATE TABLE IF NOT EXISTS tau_ngay (reg TEXT, ngay TEXT, nguon TEXT, so_diem INTEGER, so_diem_bien INTEGER, di_bien INTEGER,
      PRIMARY KEY (reg, ngay, nguon)) WITHOUT ROWID;
    CREATE TABLE IF NOT EXISTS bang_chung (reg TEXT, ngay TEXT, ship_id TEXT, gap INTEGER, cung INTEGER, d_tv REAL, o TEXT,
      PRIMARY KEY (reg, ngay, ship_id)) WITHOUT ROWID;
    CREATE INDEX IF NOT EXISTS bang_chung_sid ON bang_chung (ship_id);
    """)


def doc_vet_co_so(da_tinh, hom_nay, ngay_dau):
    """{(reg_khoa, ngay, nguon): {t: (lat, lon)}} — chỉ ngày CHƯA tính, đã trọn, có kho AIS đủ."""
    out = collections.defaultdict(dict)

    def them(reg, nguon, t, la, lo):
        k = khoa_reg(reg)
        if not k or la is None or lo is None or (abs(la) < 0.1 and abs(lo) < 0.1):
            return
        d = ngay_vn(t)
        if d >= hom_nay or d <= ngay_dau or (k, d, nguon) in da_tinh:
            return
        out[(k, d, nguon)][int(t)] = (la, lo)

    for f in sorted(glob.glob(f"{ST_DIR}/*.ndjson")):
        for line in open(f, encoding="utf-8"):
            try:
                o = json.loads(line)
            except ValueError:
                continue
            for p in o.get("pts", []):
                them(o.get("ten"), "stracking", p[0], p[1], p[2])
    for f in sorted(glob.glob(f"{DL_TRACKS}/20*_20*.ndjson.gz")):
        den_tep = os.path.basename(f).split("_")[-1][:10]  # <từ>_<đến>.ndjson.gz
        if den_tep <= ngay_dau:
            continue  # khung Data Lake trước kho AIS — không có gì để so
        with gzip.open(f, "rt") as fh:
            for line in fh:
                try:
                    o = json.loads(line)
                except ValueError:
                    continue
                for p in o.get("pts", []):
                    them(o.get("reg"), "vms", p[0], p[1], p[2])
    return out


def tinh_ngay(c):
    """Tính bằng chứng cho mọi (tàu, ngày) mới. Trả (số tàu-ngày, số ngày đi biển, số dòng bằng chứng)."""
    mo_bang_ngay(c)
    hom_nay = datetime.fromtimestamp(time.time() + VN_TZ, timezone.utc).strftime("%Y-%m-%d")
    kho = c.execute("SELECT min(t) FROM vet").fetchone()
    if not kho or kho[0] is None:
        return 0, 0, 0
    da_tinh = {(r, d, n) for r, d, n in c.execute("SELECT reg, ngay, nguon FROM tau_ngay")}
    vets = doc_vet_co_so(da_tinh, hom_nay, ngay_vn(kho[0]))  # ngày đầu kho AIS chưa trọn ⇒ bỏ
    if not vets:
        return 0, 0, 0
    cang_o = collections.defaultdict(list)
    for a, b in doc_cang():
        cang_o[(int(a // 0.5), int(b // 0.5))].append((a, b))

    def xa_cang(la, lo):
        for da in (-1, 0, 1):
            for db in (-1, 0, 1):
                for a, b in cang_o.get((int(la // 0.5) + da, int(lo // 0.5) + db), ()):
                    if km(la, lo, a, b) <= CANG_KM:
                        return False
        return True

    ngays = sorted({k[1] for k in vets})
    t0 = datetime.fromisoformat(ngays[0] + "T00:00:00+00:00").timestamp() - VN_TZ - DT_MAX - 3 * 3600
    t1 = datetime.fromisoformat(ngays[-1] + "T00:00:00+00:00").timestamp() - VN_TZ + 86400 + DT_MAX + 3 * 3600
    # RÀ PHÍA AIS TRƯỚC (anh Long 08/11: "tàu cá việt nam hay đặt tên lung tung … rà soát phải thông minh trước với phía AIS"):
    # chỉ máy cờ VN, KHÔNG phải phao, có lúc chạy ≥ 2 kn (tàu thật) — khoá theo SHIP_ID nên tên lung tung không ảnh hưởng.
    vn = {r[0] for r in c.execute("SELECT ship_id FROM may WHERE (co = 'VN' OR mmsi LIKE '574%') AND la_phao = 0 AND toc_max >= 2")}
    ais = collections.defaultdict(list)
    for sid, t, la, lo, kn in c.execute("SELECT ship_id, t, lat, lon, kn FROM vet WHERE t BETWEEN ? AND ? ORDER BY ship_id, t", (t0, t1)):
        if sid in vn:
            ais[sid].append((t, la, lo, kn))
    ais_t = {sid: [p[0] for p in L] for sid, L in ais.items()}
    idx = collections.defaultdict(list)
    for sid, L in ais.items():
        for t, la, lo, kn in L:
            idx[(int(t // 3600), int(la // O), int(lo // O))].append(sid)

    def vi_tri(sid, t):
        T, L = ais_t[sid], ais[sid]
        i = bisect.bisect_left(T, t)
        if 0 < i < len(T) and T[i] - T[i - 1] <= 3 * 3600:
            a, b = L[i - 1], L[i]
            f = (t - a[0]) / (b[0] - a[0]) if b[0] > a[0] else 0
            return a[1] + f * (b[1] - a[1]), a[2] + f * (b[2] - a[2]), 0.5
        best = None
        for j in (i - 1, i):
            if 0 <= j < len(T) and abs(T[j] - t) <= DT_MAX and (best is None or abs(T[j] - t) < abs(best[0] - t)):
                best = L[j]
        if best is None:
            return None
        return best[1], best[2], 0.5 + max(best[3], 1) * 1.852 * abs(best[0] - t) / 3600

    tn_rows, bc_rows, so_bien = [], [], 0
    for (k, d, nguon), diem in vets.items():
        pts, last = [], -1e9
        for t in sorted(diem):
            if t - last < 600:  # cặp bản tin S-Tracking cách 1 phút ⇒ giữ một
                continue
            last = t
            pts.append((t, *diem[t]))
        bien = [p for p in pts if xa_cang(p[1], p[2])]
        tn_rows.append((k, d, nguon, len(pts), len(bien), 1 if bien else 0))
        if not bien:
            continue
        so_bien += 1
        ung = set()
        for t, la, lo in bien:
            h, ca, co = int(t // 3600), int(la // O), int(lo // O)
            for dh in (-2, -1, 0, 1, 2):
                for da in (-1, 0, 1):
                    for dc in (-1, 0, 1):
                        ung.update(idx.get((h + dh, ca + da, co + dc), ()))
        for sid in ung:
            gap = cung = 0
            dd, o_gap = [], set()
            for t, la, lo in bien:
                v = vi_tri(sid, t)
                if v is None:
                    continue
                cung += 1
                dk = km(la, lo, v[0], v[1])
                dd.append(dk)
                if dk <= R_KM + v[2]:
                    gap += 1
                    o_gap.add(f"{round(la, 1)},{round(lo, 1)}")
            if gap:
                dd.sort()
                bc_rows.append((k, d, sid, gap, cung, round(dd[len(dd) // 2], 3), ";".join(sorted(o_gap))))
    c.executemany("INSERT OR REPLACE INTO tau_ngay VALUES (?,?,?,?,?,?)", tn_rows)
    c.executemany("INSERT OR REPLACE INTO bang_chung VALUES (?,?,?,?,?,?,?)", bc_rows)
    c.commit()
    return len(tn_rows), so_bien, len(bc_rows)


def cong_don(c, now):
    """Cộng dồn bằng chứng MỌI ngày ⇒ nhan_dien cach='vi_tri'. Trả (số tàu có bằng chứng, số tàu nhận được máy)."""
    mo_bang_ngay(c)
    ten = collections.defaultdict(list)
    for sid, g in c.execute("SELECT ship_id, ten_goc FROM ten WHERE ship_id IN (SELECT DISTINCT ship_id FROM bang_chung)"):
        ten[sid].append(g)
    ngay_bien = dict(c.execute("SELECT reg, count(DISTINCT ngay) FROM tau_ngay WHERE di_bien = 1 GROUP BY reg"))
    gom = {}
    for reg, d, sid, gap, cung, dtv, o in c.execute("SELECT reg, ngay, ship_id, gap, cung, d_tv, o FROM bang_chung ORDER BY ngay"):
        g = gom.get((reg, sid))
        if g is None:
            g = gom[(reg, sid)] = {"gap": 0, "cung": 0, "ngay_khop": 0, "ngay": 0, "o": set(), "dtv": [], "tu": None, "den": None}
        g["gap"] += gap
        g["cung"] += cung
        g["ngay"] += 1
        g["o"].update(o.split(";") if o else ())
        g["dtv"].append(dtv)
        if cung and gap / cung >= 0.8 and dtv <= D_TV:
            g["ngay_khop"] += 1
            g["tu"] = g["tu"] or d
            g["den"] = d
    theo_reg = collections.defaultdict(list)
    for (reg, sid), g in gom.items():
        so5 = re.sub(r"\D", "", reg)[-5:]
        dtv = sorted(g["dtv"])[len(g["dtv"]) // 2]
        # tỉ lệ ngày khớp trên số ngày đi biển mà máy này CÓ MẶT gần tàu — máy tắt/khuất thì ngày đó không tính là trượt
        tl = g["ngay_khop"] / g["ngay"] if g["ngay"] else 0
        diem = g["gap"] * (g["gap"] / g["cung"] if g["cung"] else 0) / (0.3 + dtv)
        if len(so5) == 5 and any(so5 in n.replace(" ", "") for n in ten[sid]):
            diem *= 3  # tên mang số + đi sát = hai bằng chứng độc lập
        theo_reg[reg].append(dict(sid=sid, gap=g["gap"], tv=dtv, diem=diem, tu=g["tu"], den=g["den"], nk=g["ngay_khop"],
                                  dat=g["gap"] >= MIN_GAP and tl >= MIN_TL_NGAY and len(g["o"]) >= MIN_O and dtv <= D_TV and g["ngay_khop"] >= 1))
    c.execute("DELETE FROM nhan_dien WHERE cach = 'vi_tri'")
    # GÁN HAI CHIỀU (bản 3, 09/11 — chinh_khop.py): xếp MỌI cặp đạt theo điểm, cặp mạnh nhất trước. Một máy chỉ là máy trên tàu
    # của MỘT tàu trong một khung ngày (bản 2 cho mỗi tàu tự chọn ⇒ 359 máy bị gán cho 2 tàu cùng lúc — thường hai tàu đi đôi
    # cùng sát một máy). Tàu thua máy mà điểm ≥ 2/3 tàu thắng ⇒ cả hai 'nghi_di_doi' trên máy đó. Tàu được nhận thêm máy ở
    # khung ngày KHÔNG trùng (đổi máy / máy chuyển tàu). Đo: 2 239 → 3 039 tàu, trùng số 45,8 % → 47,5 %, xung đột 359 → 0.
    ung = sorted(((h, reg) for reg, hang in theo_reg.items() for h in hang if h["dat"]), key=lambda x: -x[0]["diem"])
    reg_ky, may_ky = collections.defaultdict(list), collections.defaultdict(list)
    out, nhan_reg = {}, set()
    cheo = lambda a, b, x, y: not (b < x or a > y)
    for h, reg in ung:
        if any(cheo(h["tu"], h["den"], x, y) for x, y in reg_ky[reg]):
            continue
        thang = [(x, y, r, d) for x, y, r, d in may_ky[h["sid"]] if cheo(h["tu"], h["den"], x, y)]
        if thang:
            for x, y, r, d in thang:
                if h["diem"] * 1.5 > d:
                    out[(h["sid"], reg)] = (h, reg, "nghi_di_doi")
                    k = (h["sid"], r)
                    out[k] = (out[k][0], r, "nghi_di_doi")
            continue
        reg_ky[reg].append((h["tu"], h["den"]))
        may_ky[h["sid"]].append((h["tu"], h["den"], reg, h["diem"]))
        out[(h["sid"], reg)] = (h, reg, "tren_tau")
        nhan_reg.add(reg)
    rows = [(h["sid"], reg, "vi_tri", vai, round(h["diem"], 2), h["gap"], round(h["tv"], 2), h["tu"], h["den"],
             f"ngay_khop={h['nk']}/ngay_bien={ngay_bien.get(reg, 0)}", now) for h, reg, vai in out.values()]
    c.executemany("INSERT OR REPLACE INTO nhan_dien VALUES (?,?,?,?,?,?,?,?,?,?,?)", rows)
    c.commit()
    nhan = len(nhan_reg)
    return len(theo_reg), nhan


# ---------------------------------------------------------------- 4. lịch cào THÔNG MINH + view tổng
# Anh Long 08/11: "toàn bộ cái so khớp cần tổ chức thông minh chứ ko nặng tải … mục tiêu là biết tàu đó đang dùng ais nào thì
# sau đó chỉ cần tra cái mã tàu Stracking nhưng ko cần lấy vị trí mà dựa vào ais để biết nó ở đâu thôi".
# ⇒ S-Tracking chỉ để HỌC máy AIS của tàu. Học xong thì vị trí lấy từ AIS (v_tau_ais), thôi gọi S-Tracking cho tàu đó.
# Mỗi lượt cào chọn tàu ĐẾN HẠN theo trạng thái, trong NGÂN SÁCH request:
#   chua_cao     chưa cào lần nào                                          ⇒ cào ngay (ưu tiên đầu)
#   da_nhan      đã nhận máy AIS (≥ NGAY_CHAC ngày khớp, không nghi đi đôi)   ⇒ chỉ cào lại khi máy AIS im > AIS_IM ngày
#                                                                            (có thể đổi máy) hoặc quá KIEM_LAI ngày
#   mo_ho        có bằng chứng nhưng chưa đủ / nghi đi đôi                    ⇒ 7 ngày
#   nam_bo       < 3 ngày đi biển tích luỹ, chưa bằng chứng                   ⇒ 14 ngày
#   khong_ais    ≥ 5 ngày đi biển mà không máy AIS nào đi cùng                ⇒ 60 ngày
#   may_im       mọi lần cào đều trả 0 điểm (máy hết hạn / không báo)          ⇒ 90 ngày
# VÀ CHỈ CÀO MÁY ĐANG NGOÀI KHƠI (anh Long 08/11: "cào thằng nào ở khơi thôi, ở bờ cào chi ?"; "mục tiêu so ais mà"):
#   trong_bo = 0 ở lần đồng bộ S-Tracking gần nhất (stracking-dong-bo, 4 lần/ngày). Tàu đang ở bờ: điểm trong cảng không
#   làm bằng chứng ⇒ cào phí; để lượt sau, khi nó ra khơi, tự được chọn (đến hạn vẫn giữ, chỉ chờ ra khơi).
NGAY_CHAC, AIS_IM, KIEM_LAI = 3, 7, 90
HAN = {"mo_ho": 7, "nam_bo": 14, "khong_ais": 60, "may_im": 90}
STRACKING_DB = f"{HOME}/.local/forlife/stracking/stracking.db"


def ds_may_stracking():
    """[(imei, ten_tau, trong_bo)] máy thật (trừ máy thử / đã xoá / nhà máy). KHÔNG lọc trong_bo — cột đó = đang trong bờ lúc đồng bộ."""
    s = sqlite3.connect(f"file:{STRACKING_DB}?mode=ro", uri=True)
    rows = s.execute("""SELECT imei, ten_tau, trong_bo FROM thiet_bi WHERE imei IS NOT NULL AND ten_tau IS NOT NULL
      AND coalesce(nhom, '') NOT LIKE '%DELETE%' AND coalesce(nhom, '') <> 'MANUFACTURE'
      AND ten_tau NOT LIKE 'RfSeq%' AND lower(ten_tau) NOT LIKE 'test%' ORDER BY imei""").fetchall()
    s.close()
    return rows


def cap_nhat_lich(c):
    """Bảng lich_cao: một dòng / IMEI — lần cào cuối (theo tệp vet-<ngày>.ndjson có IMEI đó), trạng thái, ngày đến hạn."""
    c.execute("DROP VIEW IF EXISTS v_imei_ais")
    c.execute("DROP TABLE IF EXISTS lich_cao")
    c.execute("""CREATE TABLE lich_cao (imei TEXT PRIMARY KEY, reg TEXT, lan_cao TEXT, so_lan INTEGER,
      ngay_bien INTEGER, trang_thai TEXT, den_han TEXT, ngoai_khoi INTEGER)""")
    lan = {}
    so_lan = collections.Counter()
    co_diem = set()
    for f in sorted(glob.glob(f"{ST_DIR}/vet-*.ndjson")):
        d = os.path.basename(f)[4:14]
        for line in open(f, encoding="utf-8"):
            m = re.search(r'"imei"\s*:\s*"([^"]+)"', line[:80])
            if m:
                lan[m.group(1)] = max(lan.get(m.group(1), ""), d)
                so_lan[m.group(1)] += 1
                if not re.search(r'"n"\s*:\s*0\s*,', line):
                    co_diem.add(m.group(1))
    ngay_bien = dict(c.execute("SELECT reg, count(DISTINCT ngay) FROM tau_ngay WHERE di_bien = 1 GROUP BY reg"))
    co_bc = {r[0] for r in c.execute("SELECT DISTINCT reg FROM bang_chung")}
    nhan = {}
    for reg, sid, vai, nguon in c.execute("SELECT reg, ship_id, vai, nguon FROM nhan_dien WHERE cach = 'vi_tri'"):
        nk = int(re.search(r"ngay_khop=(\d+)", nguon or "ngay_khop=0").group(1))
        if vai == "tren_tau" and nk >= NGAY_CHAC:
            nhan[reg] = sid
        elif reg not in nhan:
            nhan.setdefault(reg, None)
    thay_cuoi = dict(c.execute("SELECT ship_id, lan_cuoi FROM may WHERE ship_id IN (SELECT ship_id FROM nhan_dien WHERE cach='vi_tri')"))
    hom_nay = datetime.fromtimestamp(time.time() + VN_TZ, timezone.utc).date()
    cong = lambda d, n: (datetime.fromisoformat(d).date() + __import__("datetime").timedelta(days=n)).isoformat()
    rows = []
    for imei, ten, trong_bo in ds_may_stracking():
        k = khoa_reg(ten)
        lc = lan.get(imei)
        nb = ngay_bien.get(k, 0)
        if not lc:
            tt, han = "chua_cao", "0000-00-00"
        elif nhan.get(k):
            tt = "da_nhan"
            thay = (thay_cuoi.get(nhan[k]) or "")[:10]
            im = thay and (hom_nay - datetime.fromisoformat(thay).date()).days > AIS_IM
            han = hom_nay.isoformat() if im else cong(lc, KIEM_LAI)
        elif imei not in co_diem:
            tt, han = "may_im", cong(lc, HAN["may_im"])
        elif k in co_bc:
            tt, han = "mo_ho", cong(lc, HAN["mo_ho"])
        elif nb >= 5:
            tt, han = "khong_ais", cong(lc, HAN["khong_ais"])
        else:
            tt, han = "nam_bo", cong(lc, HAN["nam_bo"])
        rows.append((imei, ten, lc, so_lan.get(imei, 0), nb, tt, han, 1 if trong_bo == 0 else 0))
    c.executemany("INSERT INTO lich_cao VALUES (?,?,?,?,?,?,?,?)", rows)
    c.commit()
    dem = collections.Counter(r[5] for r in rows)
    dem["ngoai_khoi_den_han"] = sum(1 for r in rows if r[7] and r[6] <= hom_nay.isoformat())
    return dem


def ghi_ds_cao(c, tep, ngan_sach):
    """Danh sách IMEI đến hạn cho lượt cào này, ưu tiên: chua_cao › da_nhan (máy AIS im) › mo_ho › nam_bo › khong_ais."""
    hom_nay = datetime.fromtimestamp(time.time() + VN_TZ, timezone.utc).strftime("%Y-%m-%d")
    uu = {"chua_cao": 0, "da_nhan": 1, "mo_ho": 2, "nam_bo": 3, "khong_ais": 4, "may_im": 5}
    rows = [r for r in c.execute("SELECT imei, reg, trang_thai, den_han FROM lich_cao WHERE den_han <= ? AND ngoai_khoi = 1", (hom_nay,))]
    rows.sort(key=lambda r: (uu.get(r[2], 9), r[3], r[0]))
    rows = rows[:ngan_sach]
    with open(tep, "w", encoding="utf-8") as fh:
        fh.write("".join(f"{i}\t{reg}\t{tt}\n" for i, reg, tt, _ in rows))
    return len(rows)


def tao_view_tong(c):
    """v_tau_ais — TRA MỘT CHỖ: số đăng ký ⇒ máy AIS đang dùng + vị trí MỚI NHẤT theo AIS. Chọn máy: khớp vị trí 'tren_tau' khung
    ngày mới nhất; không có thì máy tên mang số (không phải phao). v_imei_ais: IMEI S-Tracking ⇒ cùng thông tin."""
    c.execute("DROP VIEW IF EXISTS v_tau_ais")
    c.execute("""CREATE VIEW v_tau_ais AS
      WITH ung AS (
        SELECT reg, ship_id, cach, vai, diem, tu, den, nguon,
               row_number() OVER (PARTITION BY reg ORDER BY (cach = 'vi_tri' AND vai = 'tren_tau') DESC, (cach = 'vi_tri') DESC,
                                  (vai = 'phao') ASC, den DESC, diem DESC) AS hang
        FROM nhan_dien)
      SELECT u.reg, u.ship_id, u.cach, u.vai, u.diem, u.tu AS khop_tu, u.den AS khop_den, u.nguon AS bang_chung,
             m.mmsi, m.lan_cuoi AS ais_thay_cuoi,
             (SELECT ten_mau FROM ten WHERE ten.ship_id = u.ship_id ORDER BY den DESC LIMIT 1) AS ten_ais_hien,
             (SELECT count(*) FROM ten WHERE ten.ship_id = u.ship_id) AS so_ten_da_dung,
             (SELECT t FROM vet WHERE vet.ship_id = u.ship_id ORDER BY t DESC LIMIT 1) AS vi_tri_t,
             (SELECT lat FROM vet WHERE vet.ship_id = u.ship_id ORDER BY t DESC LIMIT 1) AS lat,
             (SELECT lon FROM vet WHERE vet.ship_id = u.ship_id ORDER BY t DESC LIMIT 1) AS lon,
             (SELECT kn FROM vet WHERE vet.ship_id = u.ship_id ORDER BY t DESC LIMIT 1) AS kn,
             s.reg AS so_dang_ky, s.dai, s.cv, s.nghe, s.tinh,
             (SELECT count(*) FROM nhan_dien p WHERE p.reg = u.reg AND p.vai = 'phao') AS so_phao
      FROM ung u JOIN may m USING (ship_id) LEFT JOIN so_tau s ON s.reg_khoa = u.reg
      WHERE u.hang = 1""")
    c.execute("DROP VIEW IF EXISTS v_imei_ais")
    c.execute("""CREATE VIEW v_imei_ais AS
      SELECT l.imei, l.trang_thai AS lich_trang_thai, l.lan_cao, l.den_han, v.*
      FROM lich_cao l LEFT JOIN v_tau_ais v ON v.reg = (
        SELECT reg_khoa FROM so_tau WHERE upper(replace(so_tau.reg, 'Đ', 'D')) = upper(replace(l.reg, 'Đ', 'D')) LIMIT 1)""")
    c.commit()


def bo_sung_tau_khac(c):
    """Một lần: bản quét đã nạp trước 13/11 bị lọc chỉ nhóm gốc ⇒ đọc lại, thêm máy nhóm 'khac'. Không đụng dòng nhóm gốc."""
    c.execute("CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)")
    if c.execute("SELECT 1 FROM meta WHERE k = 'bo_sung_tau_khac'").fetchone():
        log("đã bổ sung tàu khác trước đó — bỏ qua")
        return 0
    da = {r[0] for r in c.execute("SELECT luc FROM ban_quet")}
    n = 0
    for f in sorted(glob.glob(f"{LUU}/20*/*.ndjson.gz")):
        try:
            fh = gzip.open(f, "rt")
            for line in fh:
                try:
                    o = json.loads(line)
                except Exception:
                    continue
                if o.get("luc") in da:
                    nap_mot(c, o, chi_khac=True)
                    n += 1
        except (OSError, EOFError):
            pass  # tệp ngày đang ghi dở: phần chưa nạp sẽ vào ở lượt thường
        c.commit()
        log("bổ sung", os.path.basename(f), "· bản quét", n)
    c.execute("INSERT INTO meta VALUES ('bo_sung_tau_khac', ?)", (datetime.now(timezone.utc).isoformat(),))
    c.commit()
    return n


def main():
    chi_khop = "--chi-khop" in sys.argv
    if "--lam-lai" in sys.argv:  # so khớp lại TỪ ĐẦU (đổi luật phao 09/11): xoá bằng chứng ngày + nhận diện theo vị trí
        c0 = mo_db(); mo_bang_ngay(c0)
        c0.executescript("DELETE FROM tau_ngay; DELETE FROM bang_chung; DELETE FROM nhan_dien WHERE cach = 'vi_tri';")
        c0.commit(); c0.close()
    if not os.path.isdir(LUU):
        print("không thấy kho AIS", LUU, file=sys.stderr)
        return 2
    c = mo_db()
    if "--bo-sung-tau-khac" in sys.argv:
        log("bổ sung tàu khác:", bo_sung_tau_khac(c), "bản quét")
        c.close()
        return 0
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M")
    if not chi_khop:
        n = nap_ban_quet(c)
        log("bản quét mới:", n)
        log("phao:", danh_dau_phao(c))
        log("sổ tàu:", nap_so_tau(c))
    log("khớp tên:", khop_ten(c, now))
    n_ngay, n_bien, n_bc = tinh_ngay(c)
    log("ngày mới: tàu-ngày", n_ngay, "· đi biển", n_bien, "· dòng bằng chứng", n_bc)
    n_tau, n_nhan = cong_don(c, now)
    log("cộng dồn: tàu có bằng chứng", n_tau, "· nhận được máy", n_nhan)
    log("lịch cào:", json.dumps(cap_nhat_lich(c)))
    tao_view_tong(c)
    if "--ds-cao" in sys.argv:
        tep = sys.argv[sys.argv.index("--ds-cao") + 1]
        ns = int(sys.argv[sys.argv.index("--ngan-sach") + 1]) if "--ngan-sach" in sys.argv else 2000
        log("ds cào lượt này:", ghi_ds_cao(c, tep, ns), "máy (ngân sách", ns, ")")
    tk = dict(c.execute("SELECT 'may', count(*) FROM may UNION ALL SELECT 'may_vn', count(*) FROM may WHERE co='VN' OR mmsi LIKE '574%' "
                        "UNION ALL SELECT 'phao', count(*) FROM may WHERE la_phao=1 UNION ALL SELECT 'diem_vet', count(*) FROM vet "
                        "UNION ALL SELECT 'may_co_so', count(DISTINCT ship_id) FROM nhan_dien "
                        "UNION ALL SELECT 'reg_co_may', count(DISTINCT reg) FROM nhan_dien").fetchall())
    log("tổng:", json.dumps(tk))
    c.execute("PRAGMA optimize")
    c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
