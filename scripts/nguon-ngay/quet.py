#!/usr/bin/env python3
"""QUÉT ĐẦU VÀO VỆ TINH THEO NGÀY + SAO KHO DỰ PHÒNG — chạy trên gpu-desktop (timer `nguon-ngay-quet`).

Vì sao (2026-11-04, anh Long: "kiếm thêm nguồn phù du đi, chứ 1 nguồn ko ổn, cho gpu tổ chức quét hàng ngày để bổ
sung"; "lưu ở gpu cho back up"): cron dự báo cá chỉ xin `(last)` của MỘT nguồn phù du — nguồn đó trễ ~5 ngày, có ngày
trống, bản dự phòng đã dừng ⇒ kho lưu trùng một ảnh nhiều ngày và không bao giờ lấy được ngày nguồn đắp bù. Xem
`src/lib/nguon-ngay.ts` (định dạng gói, danh sách nguồn) và `docs/app-map/ops/runbook.md` › "Nguồn ngày từ máy GPU".

Mỗi lượt:
  1. SAO KHO: liệt kê `forecast-archive` trên máy chủ (`GET /api/collect/kho`), tải file mới/đổi cỡ về KHO_SAO.
  2. Hỏi máy chủ ngày nào đã có (`GET /api/collect/nguon-ngay`) trong cửa sổ CUA_SO ngày.
  3. Mỗi chuỗi: đọc trục thời gian của nguồn, tải NGÀY CÒN THIẾU, đưa về lưới chung 0,05° biển VN.
  4. Bản ghép phù du `chl-ghep` cho ngày nào vừa có thêm thành phần.
  5. Gửi gói (gzip) lên `POST /api/collect/nguon-ngay`, đồng thời ghi bản y hệt vào KHO_SAO.
Nguồn nào hỏng thì bỏ nguồn đó, lượt mai tự lấp — không hỏng cả lượt. Không bịa số.

Env (~/.config/forlife/nguon-ngay.env): API_BASE (https, không / cuối) · CRON_SECRET (= app_config.cron_secret).
Cờ: --thu (tải + in, KHÔNG gửi, KHÔNG sao kho) · --khong-sao (bỏ bước 1) · --cua-so N.
"""
from __future__ import annotations

import base64, gzip, json, os, sys, tempfile, time, urllib.error, urllib.parse, urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import numpy as np

NHA = Path.home()
KHO_SAO = NHA / ".local/forlife/kho-du-bao"  # bản sao kho máy chủ, cùng đường dẫn trong bucket
CUA_SO = 25
LAT = np.round(np.arange(5.0, 22.0 + 1e-9, 0.05), 3)  # vĩ độ TĂNG dần — đúng quy ước lib/nguon-ngay.ts
LON = np.round(np.arange(102.0, 118.0 + 1e-9, 0.05), 3)
KHONG_CO = -32768
ERDDAP = "https://coastwatch.noaa.gov/erddap/griddap"
UA = {"User-Agent": "ForFish-nguon-ngay/1 (gpu-desktop)"}
HET_GIO = 120

# id → (dataset, biến, kiểu giá trị). "log" = phù du lưu log10(mg/m³); "k" = kelvin ⇒ °C.
ERDDAP_CHUOI = {
    "chl-dineof": ("noaacwNPPN20VIIRSDINEOFDaily", "chlor_a", "log"),
    "chl-dineof-s3": ("noaacwNPPN20S3ASCIDINEOFDaily", "chlor_a", "log"),
    "chl-olci-s3a": ("noaacwS3AOLCIchlaDaily", "chlor_a", "log"),
    "chl-olci-s3b": ("noaacwS3BOLCIchlaDaily", "chlor_a", "log"),
    "chl-viirs-n20": ("noaacwN20VIIRSchlaDaily", "chlor_a", "log"),
    "chl-viirs-npp": ("noaacwNPPVIIRSchlaDaily", "chlor_a", "log"),
    "sst-blended": ("noaacwBLENDEDsstDaily", "analysed_sst", "k"),
    "sst-coraltemp": ("noaacrwsstDaily", "analysed_sst", "c"),
    "sst-anom": ("noaacrwsstanomalyDaily", "sea_surface_temperature_anomaly", "c"),
    "sla": ("noaacwBLENDEDsshDaily", "sla", "m"),
}
CMEMS_L4 = (
    "https://s3.waw3-1.cloudferro.com/mdl-arco-time-044/arco/OCEANCOLOUR_GLO_BGC_L4_NRT_009_102/"
    "cmems_obs-oc_glo_bgc-plankton_nrt_l4-gapfree-multi-4km_P1D_202311/timeChunked.zarr"
)
L3 = ["chl-olci-s3a", "chl-olci-s3b", "chl-viirs-n20", "chl-viirs-npp"]  # chụp thật, có lỗ mây
LAP = ["chl-dineof", "chl-dineof-s3", "chl-cmems-l4"]  # đã lấp mây, theo thứ tự ưu tiên
MA = {"log": ("log10(mg/m3)", 0.001, 0.0), "k": ("degC", 0.01, 0.0), "c": ("degC", 0.01, 0.0), "m": ("m", 0.001, 0.0)}


def log(*a):
    print(datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), *a, flush=True)


def doc_env() -> dict:
    out = {}
    f = NHA / ".config/forlife/nguon-ngay.env"
    if f.exists():
        for dong in f.read_text().splitlines():
            if "=" in dong and not dong.lstrip().startswith("#"):
                k, v = dong.split("=", 1)
                out[k.strip().removeprefix("export ").strip()] = v.strip().strip("'\"")
    out.update({k: v for k, v in os.environ.items() if k in ("API_BASE", "CRON_SECRET")})
    return out


def tai(url: str, headers: dict | None = None, data: bytes | None = None, tries: int = 3) -> bytes:
    last: Exception | None = None
    for lan in range(tries):
        if lan:
            time.sleep(5 * lan)
        try:
            req = urllib.request.Request(url, data=data, headers={**UA, **(headers or {})})
            with urllib.request.urlopen(req, timeout=HET_GIO) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (400, 401, 403, 404):
                raise
            last = e
        except Exception as e:  # mạng chập / hết giờ
            last = e
    raise last  # type: ignore[misc]


class MayChu:
    def __init__(self, base: str, secret: str):
        self.base, self.h = base, {"authorization": f"Bearer {secret}"}

    def get(self, path: str, **q) -> dict:
        return json.loads(tai(f"{self.base}{path}?{urllib.parse.urlencode(q)}", self.h))

    def gui(self, goi: list[dict]) -> dict:
        body = gzip.compress(json.dumps({"goi": goi}).encode())
        h = {**self.h, "content-type": "application/json", "content-encoding": "gzip"}
        try:
            return json.loads(tai(f"{self.base}/api/collect/nguon-ngay", h, body))
        except urllib.error.HTTPError as e:
            return {"ok": False, "status": e.code, "body": e.read()[:300].decode("utf8", "replace")}


# ---------------------------------------------------------------------------- lưới chung + mã int16
def ve_luoi(lat: np.ndarray, lon: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Đưa lưới nguồn (bất kỳ chiều sắp xếp) về LAT×LON bằng ô gần nhất. Dung sai = nửa bước lưới NGUỒN (tối thiểu
    0,03°): lưới mực nước 0,25° với dung sai cố định 0,03° chỉ còn phủ 11% (đo 2026-11-04)."""
    io = np.argsort(lat)
    lat, v = lat[io], v[io, :]
    jo = np.argsort(lon)
    lon, v = lon[jo], v[:, jo]
    ii = np.clip(np.searchsorted(lat, LAT), 1, len(lat) - 1)
    ii = np.where(np.abs(lat[ii - 1] - LAT) < np.abs(lat[ii] - LAT), ii - 1, ii)
    jj = np.clip(np.searchsorted(lon, LON), 1, len(lon) - 1)
    jj = np.where(np.abs(lon[jj - 1] - LON) < np.abs(lon[jj] - LON), jj - 1, jj)
    out = v[np.ix_(ii, jj)].astype(np.float64)
    tl = max(0.03, 0.51 * float(np.median(np.diff(lat)))) if len(lat) > 1 else 0.03
    tn = max(0.03, 0.51 * float(np.median(np.diff(lon)))) if len(lon) > 1 else 0.03
    xa = (np.abs(lat[ii] - LAT)[:, None] > tl) | (np.abs(lon[jj] - LON)[None, :] > tn)
    out[xa] = np.nan
    return out


def ma_luoi(a: np.ndarray, ti_le: float, lech: float) -> str:
    n = np.where(np.isfinite(a), np.round((a - lech) / ti_le), KHONG_CO)
    n = np.where((n > KHONG_CO) & (n <= 32767), n, KHONG_CO).astype("<i2")
    return base64.b64encode(n.tobytes()).decode()


def giai_luoi(g: dict) -> np.ndarray:
    n = np.frombuffer(base64.b64decode(g["du"]), dtype="<i2").astype(np.float64)
    out = np.where(n == KHONG_CO, np.nan, n * g["tiLe"] + g["lech"])
    return out.reshape(g["luoi"]["nlat"], g["luoi"]["nlon"])


def dong_goi(nguon: str, ngay: str, dataset: str, bien: str, kieu: str, a: np.ndarray, thanh_phan=None) -> dict:
    don_vi, ti_le, lech = MA[kieu]
    g = {
        "v": 1, "nguon": nguon, "ngay": ngay, "dataset": dataset, "bien": bien, "donVi": don_vi,
        "luoi": {"lat0": float(LAT[0]), "lon0": float(LON[0]), "buoc": 0.05, "nlat": len(LAT), "nlon": len(LON)},
        "tiLe": ti_le, "lech": lech, "du": ma_luoi(a, ti_le, lech),
        "phu": round(float(np.isfinite(a).mean()), 4),
        "taiLuc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    if thanh_phan is not None:
        g["thanhPhan"] = thanh_phan
    return g


def duong_sao(ngay: str, nguon: str) -> Path:
    return KHO_SAO / "nguon-ngay" / ngay[:4] / ngay / f"{nguon}.json.gz"


def ghi_sao(g: dict) -> None:
    p = duong_sao(g["ngay"], g["nguon"])
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".tmp")
    tmp.write_bytes(gzip.compress(json.dumps(g).encode()))
    tmp.replace(p)


def doc_sao(ngay: str, nguon: str) -> np.ndarray | None:
    p = duong_sao(ngay, nguon)
    if not p.exists():
        return None
    try:
        return giai_luoi(json.loads(gzip.decompress(p.read_bytes())))
    except Exception:
        return None


# ---------------------------------------------------------------------------- nguồn ERDDAP
def erddap_ngay(ds: str, tu: str) -> dict[str, str]:
    """{YYYY-MM-DD: nhãn thời gian ERDDAP} các ngày nguồn CÓ trong [tu, last]."""
    raw = tai(f"{ERDDAP}/{ds}.csv?" + urllib.parse.quote(f"time[({tu}T00:00:00Z):1:(last)]", safe="():.,_")).decode()
    out = {}
    for dong in raw.splitlines()[2:]:
        if dong[:4].isdigit():
            out.setdefault(dong[:10], dong.strip())
    return out


_hinh: dict[str, tuple[bool, bool]] = {}


def erddap_hinh(ds: str) -> tuple[bool, bool]:
    """(có chiều altitude, vĩ độ GIẢM dần) — ERDDAP đòi khoảng vĩ độ đúng chiều lưu."""
    if ds not in _hinh:
        dds = tai(f"{ERDDAP}/{ds}.dds").decode()
        lat = tai(f"{ERDDAP}/{ds}.csv?latitude%5B0:1:1%5D").decode().splitlines()[2:4]  # hai vĩ độ đầu ⇒ chiều
        _hinh[ds] = ("altitude[" in dds, float(lat[0]) > float(lat[1]))
    return _hinh[ds]


def erddap_luoi(ds: str, bien: str, nhan: str, kieu: str) -> np.ndarray:
    import xarray as xr

    co_cao, giam = erddap_hinh(ds)
    vi = "(22.0):(5.0)" if giam else "(5.0):(22.0)"
    rang = f"{bien}[({nhan})]" + ("[(0.0)]" if co_cao else "") + f"[{vi}][(102.0):(118.0)]"
    url = f"{ERDDAP}/{ds}.nc?{urllib.parse.quote(rang, safe='():.,_')}"
    with tempfile.NamedTemporaryFile(suffix=".nc") as f:
        f.write(tai(url))
        f.flush()
        with xr.open_dataset(f.name, engine="scipy", mask_and_scale=True) as d:
            v = d[bien].squeeze().values.astype(np.float64)
            lat, lon = d["latitude"].values, d["longitude"].values
    a = ve_luoi(lat, lon, v)
    if kieu == "log":
        a = np.where(a > 0, np.log10(np.where(a > 0, a, 1)), np.nan)
    elif kieu == "k":
        a = a - 273.15 if np.nanmedian(a) > 200 else a
    return a


# ---------------------------------------------------------------------------- Copernicus L4 (zarr)
_cmems = None


def cmems() -> "object":
    global _cmems
    if _cmems is None:
        import xarray as xr

        _cmems = xr.open_zarr(CMEMS_L4, consolidated=True)
    return _cmems


def cmems_ngay(tu: str) -> list[str]:
    t = cmems().time.values
    return [str(x)[:10] for x in t if str(x)[:10] >= tu]


def cmems_luoi(ngay: str) -> np.ndarray:
    ds = cmems()
    lat = ds.latitude.values
    sub = ds.CHL.sel(time=ngay, latitude=slice(22.05, 4.95) if lat[0] > lat[-1] else slice(4.95, 22.05), longitude=slice(101.95, 118.05))
    a = ve_luoi(sub.latitude.values, sub.longitude.values, sub.values.astype(np.float64))
    return np.where(a > 0, np.log10(np.where(a > 0, a, 1)), np.nan)


# ---------------------------------------------------------------------------- bản ghép phù du
def ghep(ngay: str, moi: dict[tuple[str, str], np.ndarray]) -> tuple[np.ndarray, dict] | None:
    lay = lambda s: moi.get((ngay, s)) if (ngay, s) in moi else doc_sao(ngay, s)  # noqa: E731
    l3 = {s: a for s in L3 if (a := lay(s)) is not None}
    out = np.full((len(LAT), len(LON)), np.nan)
    tp: dict[str, int] = {}
    if l3:
        st = np.stack(list(l3.values()))
        dem = np.isfinite(st).sum(0)
        with np.errstate(invalid="ignore"):
            out = np.where(dem > 0, np.nansum(st, 0) / np.where(dem > 0, dem, 1), np.nan)
        for s, a in l3.items():  # số ô mỗi vệ tinh góp vào trung bình
            tp[s] = int(np.isfinite(a).sum())
    for s in LAP:
        a = lay(s)
        if a is None:
            continue
        lo = ~np.isfinite(out) & np.isfinite(a)
        if lo.any():
            out[lo] = a[lo]
            tp[s] = int(lo.sum())
    if not np.isfinite(out).any():
        return None
    return out, tp


# ---------------------------------------------------------------------------- chạy
def sao_kho(mc: MayChu) -> None:
    tu = date(2026, 10, 10)
    den = datetime.now(timezone.utc).date()
    moi = loi = 0
    while tu <= den:
        cuoi = min(tu + timedelta(days=30), den)
        try:
            muc = mc.get("/api/collect/kho", tu=tu.isoformat(), den=cuoi.isoformat())["muc"]
        except Exception as e:
            log(f"[sao kho] liệt kê {tu}…{cuoi} hỏng: {e} — để lượt sau")
            return
        for m in muc:
            p = KHO_SAO / m["path"]
            if p.exists() and p.stat().st_size == m["bytes"]:
                continue
            try:
                url = mc.get("/api/collect/kho", file=m["path"])["url"]
                b = tai(url)
                p.parent.mkdir(parents=True, exist_ok=True)
                p.with_suffix(".tmp").write_bytes(b)
                p.with_suffix(".tmp").replace(p)
                moi += 1
            except Exception as e:
                loi += 1
                log(f"[sao kho] {m['path']}: {e}")
        tu = cuoi + timedelta(days=1)
    log(f"[sao kho] tải mới {moi} file, hỏng {loi}")


def main() -> int:
    thu = "--thu" in sys.argv
    cua_so = int(sys.argv[sys.argv.index("--cua-so") + 1]) if "--cua-so" in sys.argv else CUA_SO
    env = doc_env()
    base, secret = env.get("API_BASE", "").rstrip("/"), env.get("CRON_SECRET", "")
    if not thu and (not base.startswith("https://") or not secret):
        log("[nguồn ngày] thiếu API_BASE (https) hoặc CRON_SECRET — dừng")
        return 1
    mc = MayChu(base, secret)
    if not thu and "--khong-sao" not in sys.argv:
        sao_kho(mc)

    hom_nay = datetime.now(timezone.utc).date()
    tu = (hom_nay - timedelta(days=cua_so)).isoformat()
    da_co: set[tuple[str, str]] = set()
    if not thu:
        try:
            da_co = {(x["ngay"], x["nguon"]) for x in mc.get("/api/collect/nguon-ngay", tu=tu, den=hom_nay.isoformat())["co"]}
        except Exception as e:
            log(f"[nguồn ngày] không hỏi được máy chủ ngày đã có: {e} — dừng (đừng tải lại cả cửa sổ)")
            return 1

    moi: dict[tuple[str, str], np.ndarray] = {}
    goi: list[dict] = []
    bao: dict[str, str] = {}
    for nguon, (ds, bien, kieu) in ERDDAP_CHUOI.items():
        try:
            ngay_co = erddap_ngay(ds, tu)
        except Exception as e:
            bao[nguon] = f"hỏng trục thời gian: {e}"
            continue
        thieu = [d for d in sorted(ngay_co) if (d, nguon) not in da_co]
        lay = 0
        for d in thieu:
            try:
                a = erddap_luoi(ds, bien, ngay_co[d], kieu)
            except Exception as e:
                log(f"[{nguon}] {d}: {e}")
                continue
            moi[(d, nguon)] = a
            goi.append(dong_goi(nguon, d, ds, bien, kieu, a))
            lay += 1
        bao[nguon] = f"nguồn có {len(ngay_co)} ngày (mới nhất {max(ngay_co) if ngay_co else '—'}), tải thêm {lay}/{len(thieu)}"
    try:
        thieu = [d for d in cmems_ngay(tu) if (d, "chl-cmems-l4") not in da_co]
        for d in thieu:
            try:
                a = cmems_luoi(d)
            except Exception as e:
                log(f"[chl-cmems-l4] {d}: {e}")
                continue
            moi[(d, "chl-cmems-l4")] = a
            goi.append(dong_goi("chl-cmems-l4", d, "cmems_obs-oc_glo_bgc-plankton_nrt_l4-gapfree-multi-4km_P1D", "CHL", "log", a))
        bao["chl-cmems-l4"] = f"tải thêm {len([1 for k in moi if k[1] == 'chl-cmems-l4'])}/{len(thieu)}"
    except Exception as e:
        bao["chl-cmems-l4"] = f"hỏng: {e}"

    # bản ghép: ngày nào vừa có thêm thành phần phù du, hoặc máy chủ chưa có bản ghép mà đã có thành phần
    ngay_ghep = {d for (d, s) in moi if s.startswith("chl-")} | {d for (d, s) in da_co if s.startswith("chl-") and (d, "chl-ghep") not in da_co}
    for d in sorted(ngay_ghep):
        kq = ghep(d, moi)
        if kq:
            goi.append(dong_goi("chl-ghep", d, "ghep:L3→DINEOF→CMEMS-L4", "chlor_a", "log", kq[0], kq[1]))

    for k, v in bao.items():
        log(f"[{k}] {v}")
    log(f"[nguồn ngày] {len(goi)} gói ({sum(len(g['du']) for g in goi) // 1024} KB base64)")
    if thu:
        for g in goi[:40]:
            log(f"  {g['ngay']} {g['nguon']:<15} phủ {g['phu']:.0%} {g.get('thanhPhan', '')}")
        return 0
    luu = 0
    for i in range(0, len(goi), 10):
        lo = goi[i : i + 10]
        kq = mc.gui(lo)
        luu += int(kq.get("luu", 0))
        if kq.get("hong"):
            log(f"[gửi] hỏng: {kq['hong'][:3]}")
        if not kq.get("ok"):
            log(f"[gửi] lô {i // 10} không lưu được: {kq}")
            continue
        hong = {(h.get("ngay"), h.get("nguon")) for h in kq.get("hong", [])}
        for g in lo:
            if (g["ngay"], g["nguon"]) not in hong:
                ghi_sao(g)
    log(f"[nguồn ngày] máy chủ lưu {luu}/{len(goi)}")
    return 0 if luu == len(goi) else 2


if __name__ == "__main__":
    sys.exit(main())
