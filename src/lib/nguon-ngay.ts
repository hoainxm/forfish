// ĐẦU VÀO VỆ TINH THEO NGÀY CỦA DỮ LIỆU (2026-11-04, anh Long: "kiếm thêm nguồn phù du đi, chứ 1 nguồn ko ổn,
// cho gpu tổ chức quét hàng ngày để bổ sung").
//
// VÌ SAO: cron dự báo cá xin `(last)` của mỗi nguồn ERDDAP — nguồn trễ 3–6 ngày và CÓ NGÀY TRỐNG (đo 04/11: phù du
// DINEOF thiếu 16–22/10 và 25/10, bản dự phòng dừng từ 24/10). Kết quả: `fish-inputs/` ngày 02, 03, 04/11 là CÙNG MỘT
// ẢNH 30/10, và ngày nguồn đắp bù về sau không bao giờ được lấy. Máy GPU (`scripts/nguon-ngay/quet.py`) quét mỗi ngày
// cửa sổ 25 ngày, chỉ tải ngày CÒN THIẾU, gửi lên `POST /api/collect/nguon-ngay` ⇒ kho `forecast-archive/nguon-ngay/
// <năm>/<NGÀY DỮ LIỆU>/<nguồn>.json.gz`. Bản ghép phù du `chl-ghep` = trung bình các vệ tinh chụp thật, ô mây che lấp
// bằng DINEOF rồi Copernicus L4.
//
// ĐỊNH DẠNG LƯỚI: mảng int16 little-endian (base64) theo hàng vĩ độ TĂNG dần, giá trị thật = n × tiLe + lech, -32768 = không
// có. Phù du lưu log10(mg/m³) (dải -3…2 vừa int16 ở tiLe 0,001). Gọn hơn JSON số ~5 lần, Python mã y hệt.
//
// Không route nào đọc kho này cho app — chỉ phục vụ fit/kiểm định (và GPU sao về làm bản dự phòng).

export const NGUON_NGAY = {
  // PHÙ DU — 7 nguồn + bản ghép
  "chl-cmems-l4": { nhom: "chl", moTa: "Copernicus GlobColour L4 lấp mây, nhiều vệ tinh, 4 km (OCEANCOLOUR_GLO_BGC_L4_NRT_009_102)" },
  "chl-dineof": { nhom: "chl", moTa: "NOAA VIIRS NPP+N20 DINEOF lấp mây (noaacwNPPN20VIIRSDINEOFDaily) — nguồn production" },
  "chl-dineof-s3": { nhom: "chl", moTa: "NOAA VIIRS + Sentinel-3 DINEOF (noaacwNPPN20S3ASCIDINEOFDaily)" },
  "chl-olci-s3a": { nhom: "chl", moTa: "Copernicus Sentinel-3A OLCI L3 (noaacwS3AOLCIchlaDaily)" },
  "chl-olci-s3b": { nhom: "chl", moTa: "Copernicus Sentinel-3B OLCI L3 (noaacwS3BOLCIchlaDaily)" },
  "chl-viirs-n20": { nhom: "chl", moTa: "NOAA-20 VIIRS L3 (noaacwN20VIIRSchlaDaily)" },
  "chl-viirs-npp": { nhom: "chl", moTa: "S-NPP VIIRS L3 (noaacwNPPVIIRSchlaDaily)" },
  "chl-ghep": { nhom: "chl", moTa: "Bản ghép: trung bình L3 chụp thật → DINEOF → Copernicus L4" },
  // NHIỆT / MỰC NƯỚC — cùng lỗi `(last)` của cron, đắp bù theo ngày dữ liệu
  "sst-blended": { nhom: "sst", moTa: "NOAA Blended SST (noaacwBLENDEDsstDaily)" },
  "sst-coraltemp": { nhom: "sst", moTa: "NOAA Coral Reef Watch CoralTemp (noaacrwsstDaily)" },
  "sst-anom": { nhom: "sst", moTa: "Dị thường nhiệt CRW (noaacrwsstanomalyDaily)" },
  "sla": { nhom: "sla", moTa: "Dị thường mực nước NOAA Blended (noaacwBLENDEDsshDaily)" },
} as const;
export type NguonNgayId = keyof typeof NGUON_NGAY;

export function laNguonNgay(s: unknown): s is NguonNgayId {
  return typeof s === "string" && Object.prototype.hasOwnProperty.call(NGUON_NGAY, s);
}

export const KHONG_CO = -32768;
/** Trần một lưới: biển VN 5–22°N × 102–118°E ở 0,05° là 341 × 321 — để dư gấp ~2 mỗi chiều. */
export const TRAN_O = 800;

export interface GoiNguonNgay {
  v: 1;
  nguon: NguonNgayId;
  /** NGÀY CỦA DỮ LIỆU (UTC, theo trục thời gian của nguồn), KHÔNG phải ngày chạy */
  ngay: string;
  dataset: string;
  bien: string;
  /** đơn vị của giá trị SAU khi giải mã: "log10(mg/m3)" · "degC" · "m" */
  donVi: string;
  luoi: { lat0: number; lon0: number; buoc: number; nlat: number; nlon: number };
  tiLe: number;
  lech: number;
  /** base64 int16 LE, nlat × nlon, hàng = vĩ độ tăng dần */
  du: string;
  /** tỉ lệ ô có số (0–1) — để lọc ngày mây phủ kín khi fit */
  phu: number;
  taiLuc: string;
  /** chỉ `chl-ghep`: số ô lấy từ mỗi thành phần */
  thanhPhan?: Record<string, number>;
}

const laSo = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const laNgay = (s: unknown): s is string =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** Kiểm gói GPU gửi lên — ranh giới tin cậy: sai bất kỳ trường nào ⇒ lý do (chuỗi), đúng ⇒ null. */
export function loiGoi(g: unknown, homNay: string): string | null {
  if (!g || typeof g !== "object") return "không phải object";
  const o = g as Record<string, unknown>;
  if (o.v !== 1) return "sai phiên bản";
  if (!laNguonNgay(o.nguon)) return "nguồn lạ";
  if (!laNgay(o.ngay)) return "ngày sai định dạng";
  if ((o.ngay as string) > homNay) return "ngày ở tương lai";
  if ((o.ngay as string) < "2017-01-01") return "ngày quá cũ";
  for (const k of ["dataset", "bien", "donVi", "du", "taiLuc"] as const)
    if (typeof o[k] !== "string" || !(o[k] as string).length) return `thiếu ${k}`;
  if (!laSo(o.tiLe) || o.tiLe <= 0 || !laSo(o.lech)) return "tiLe/lech sai";
  if (!laSo(o.phu) || o.phu < 0 || o.phu > 1) return "phu sai";
  const l = o.luoi as Record<string, unknown> | undefined;
  if (!l || !laSo(l.lat0) || !laSo(l.lon0) || !laSo(l.buoc) || l.buoc <= 0) return "lưới sai";
  if (!Number.isInteger(l.nlat) || !Number.isInteger(l.nlon)) return "lưới sai";
  const nlat = l.nlat as number;
  const nlon = l.nlon as number;
  if (nlat < 1 || nlon < 1 || nlat > TRAN_O || nlon > TRAN_O) return "lưới quá cỡ";
  if (Math.abs(l.lat0 as number) > 90 || Math.abs(l.lon0 as number) > 360) return "toạ độ sai";
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(o.du as string)) return "du không phải base64";
  if (Buffer.from(o.du as string, "base64").length !== nlat * nlon * 2) return "du lệch cỡ lưới";
  if (o.thanhPhan !== undefined) {
    if (!o.thanhPhan || typeof o.thanhPhan !== "object") return "thanhPhan sai";
    for (const [k, v] of Object.entries(o.thanhPhan)) if (!laNguonNgay(k) || !Number.isInteger(v)) return "thanhPhan sai";
  }
  return null;
}

/** Giải lưới ra Float32Array (NaN = không có). Dùng cho script fit đọc kho. */
export function giaiMaLuoi(g: Pick<GoiNguonNgay, "du" | "tiLe" | "lech" | "luoi">): Float32Array {
  const b = Buffer.from(g.du, "base64");
  const out = new Float32Array(g.luoi.nlat * g.luoi.nlon);
  for (let i = 0; i < out.length; i++) {
    const n = b.readInt16LE(i * 2);
    out[i] = n === KHONG_CO ? Number.NaN : n * g.tiLe + g.lech;
  }
  return out;
}

/** Mã lưới (đối xứng với Python `ma_luoi`) — test + công cụ. Ngoài dải int16 ⇒ coi là không có, không cắt bừa. */
export function maHoaLuoi(values: ArrayLike<number>, tiLe: number, lech: number): string {
  const b = Buffer.alloc(values.length * 2);
  for (let i = 0; i < values.length; i++) {
    const x = values[i];
    const n = Number.isFinite(x) ? Math.round((x - lech) / tiLe) : KHONG_CO;
    b.writeInt16LE(n > KHONG_CO && n <= 32767 ? n : KHONG_CO, i * 2);
  }
  return b.toString("base64");
}

/** Danh sách ngày [tu, den] (YYYY-MM-DD, bao cả hai đầu), trần `tran` ngày — chặn hỏi kho quá rộng. */
export function dayNgay(tu: string, den: string, tran = 62): string[] | null {
  if (!laNgay(tu) || !laNgay(den) || tu > den) return null;
  const out: string[] = [];
  for (let t = Date.parse(`${tu}T00:00:00Z`); out.length <= tran; t += 86_400_000) {
    const d = new Date(t).toISOString().slice(0, 10);
    if (d > den) return out;
    out.push(d);
  }
  return null;
}

/** Đường dẫn hợp lệ của kho: <loại>/<YYYY>/<YYYY-MM-DD>/<tên>.json.gz — chặn `..`, chặn ra ngoài các loại đã biết. */
const DUONG_KHO = /^(weather|fish|fish-inputs|actual|drivers|storms|nguon-ngay)\/(\d{4})\/(\d{4})-\d{2}-\d{2}\/[a-z0-9_-][a-z0-9._-]*\.json\.gz$/;
export function laDuongKho(p: string): boolean {
  const m = DUONG_KHO.exec(p);
  return !!m && m[2] === m[3] && !p.includes("..");
}
