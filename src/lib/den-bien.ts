/**
 * Trục 1 — LỚP ĐÈN BIỂN VIỆT NAM.
 *
 * File này giữ TYPE + GIẢI MÃ + CÂU MÔ TẢ (thuần, test được) cho dataset tĩnh
 * `public/data/den-bien.v1.json` (sinh bởi `scripts/generate-den-bien.mjs`).
 * Component render bằng lớp symbol của MapLibre — file này KHÔNG vẽ.
 *
 * ── VÌ SAO TÁCH KHỎI `vn-aids` / `seamarks` ───────────────────────────────
 * Phao TRÔI: bị dịch, bị thu hồi, đổi số hiệu hằng tháng theo tiến độ công
 * trình. Đèn biển ĐỨNG YÊN hàng chục năm — Long Châu 1894, Kê Gà 1898, Hòn
 * Khoai 1899 — có TÊN RIÊNG bà con nhớ được, và là thứ người ta định hướng
 * ban đêm khi mọi thứ khác tắt. Một cái đèn sai vị trí nguy hiểm hơn một cái
 * phao sai: người ta lái THEO nó chứ không chỉ tránh nó.
 *
 * Hai lớp vì thế có hai nhịp cập nhật và hai mức tin cậy khác nhau. Trộn
 * chung là để nhịp của phao kéo lùi độ tin của đèn.
 *
 * ── DÙNG LẠI, KHÔNG VIẾT LẠI ──────────────────────────────────────────────
 * Đặc tính đèn đi qua ĐÚNG `LightInfo` + `describeLight()` của
 * `src/lib/seamarks.ts` — bộ dịch mã hải đồ sang tiếng Việt DUY NHẤT của dự
 * án. Loại đèn (`light_major` / `light_minor`) cũng là khoá có sẵn của
 * `SEAMARK_LABEL` và `chartSymbolId()`, nên đèn biển ra được ký hiệu hải đồ
 * mà không thêm một nhánh nào.
 *
 * ── CHỦ QUYỀN ─────────────────────────────────────────────────────────────
 * Mọi tên trong dataset là TIẾNG VIỆT, lấy từ trang công bố của cơ quan quản
 * lý Việt Nam. Không một chuỗi nào chảy từ nguồn nước ngoài — kể cả các đèn
 * trên quần đảo Trường Sa (Song Tử Tây, Sinh Tồn, Nam Yết, An Bang, Tiên Nữ,
 * Đá Lát, Đá Tây, Trường Sa Lớn) và các nhà giàn DK1 (Ba Kè, Phúc Tần, Huyền
 * Trân, Quế Đường). `scripts/audit-names.mjs` canh lớp này như mọi lớp khác.
 *
 * ## Assumptions
 * - Chu kỳ đèn tính bằng GIÂY, tầm hiệu lực tính bằng HẢI LÝ, chiều cao tính
 *   bằng MÉT — đúng đơn vị nguồn công bố. Nguồn để trống rất nhiều trường nên
 *   MỌI trường ngoài tên và toạ độ đều tuỳ chọn.
 * - `-1` trong file nghĩa là NGUỒN KHÔNG CÔNG BỐ, không phải "bằng 0".
 */

import { timeoutSignal } from "@/lib/abort";
import type { Provenance } from "@/lib/provenance";
import {
  colourLabel,
  describeLight,
  type LightInfo,
  type Seamark,
} from "@/lib/seamarks";

/* ── KIỂU ────────────────────────────────────────────────────────────────── */

/**
 * Một đèn biển. Mở rộng `Seamark` chứ không thay nó: chín cột đầu của dataset
 * trùng khít khuôn `seamarks.v1.json`, nên `decodeSeamarks()` cũng đọc được
 * file này và mọi thứ ăn `Seamark` (ký hiệu hải đồ, ô chạm xem) chạy sẵn.
 */
export type DenBien = Seamark & {
  /**
   * Tên riêng tiếng Việt, KHÔNG kèm chữ "Đèn biển" ("Kê Gà", "Hòn Khoai").
   * CHUỖI RỖNG cho mục cố-ý-không-tên (xem `khongTen`) — nhãn bản đồ khi đó
   * không vẽ gì, thẻ chạm hiện "Đèn biển" trần qua `tenDayDu()`.
   */
  ten: string;
  /**
   * CỐ Ý không mang tên riêng — khác hẳn "thiếu tên do lỗi" (hàng lỗi bị
   * decode loại). Quyết định chủ dự án 2026-09-02 cho các đèn trên thực thể
   * VN bị nước khác chiếm đóng: dữ liệu chỉ lấy SỐ (toạ độ, đặc tính) từ
   * nguồn nước ngoài, không lấy một cái tên nào — "chỉ ghi gọn là đèn thôi".
   */
  khongTen?: true;
  /** nơi đặt, thường là tên tỉnh ("Bình Thuận") */
  noi?: string;
  /** chiều cao tháp đèn, mét */
  chieuCaoThap?: number;
  /** chiều cao tâm sáng so với số 0 hải đồ, mét */
  chieuCaoTamSang?: number;
  /** tầm nhìn BAN NGÀY (nhìn thấy tháp), hải lý */
  tamNgay?: number;
  /** năm thiết lập — chuỗi vì nguồn có ghi "Trước 1975" */
  namThietLap?: string;
  /** lý lịch nguồn của CHÍNH cái đèn này */
  prov: Provenance;
};

/** Dạng thô trong `public/data/den-bien.v1.json` — bảng tra + hàng số. */
export type DenBienFile = {
  v: number;
  nguon: string;
  /** nhãn "tham khảo, đối chiếu Thông báo hàng hải" — KHÔNG được bỏ */
  nhan: string;
  layNgay: string;
  giayPhep: { trangThai: string; giayPhepId: string; ghiChu: string };
  types: string[];
  chars: string[];
  groups: string[];
  colours: string[];
  names: string[];
  places: string[];
  years: string[];
  provs: Provenance[];
  /** đèn có tên trên nguồn mà CHƯA lấy được toạ độ — nói thẳng, không giấu */
  thieu: { ten: string; lyDo: string }[];
  lights: number[][];
};

/* ── CỔNG TOẠ ĐỘ ─────────────────────────────────────────────────────────── */

/**
 * Khung biển Việt Nam (Nam, Tây, Bắc, Đông) — GIỐNG bộ sinh dữ liệu và
 * `vn-aids`. Rộng tới 118°Đ để ôm trọn Trường Sa.
 */
export const KHUNG_BIEN_VN = { s: 4, w: 102, n: 24, e: 118 } as const;

/**
 * Điểm có nằm trong khung biển VN không.
 *
 * Đây là cổng chặn KIỂU SAI NGUY HIỂM NHẤT của dự án: **toạ độ bị tách chữ**.
 * Nguồn nhà nước ghi dấu độ bằng `<sup>o</sup>` (chữ cái o dựng cao), và bản
 * quét thì OCR đọc `°` thành `0`/`9`. Gỡ thẻ hoặc đọc ẩu một lần là
 * `105°16'12,7"` thành `10°50'16"` — một con số **đúng định dạng, đúng dải,
 * trông hoàn toàn hợp lệ** mà nằm cách chỗ thật hàng trăm km.
 *
 * Chữ số bị tách luôn đẩy một trong hai trục ra ngoài khung: `105` vỡ thành
 * `10 5` cho kinh độ 5,x°Đ (ngoài `102–118`), `10` vỡ thành `1 0` cho vĩ độ
 * 0,x°B (ngoài `4–24`). Nên cổng này bắt được đúng lớp lỗi đó.
 */
export function trongKhungBienVN(lon: number, lat: number): boolean {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return false;
  const { s, w, n, e } = KHUNG_BIEN_VN;
  return lat >= s && lat <= n && lon >= w && lon <= e;
}

/* ── CỔNG TÊN: ĐÈN BIỂN, KHÔNG PHẢI PHAO ─────────────────────────────────── */

/**
 * Tên này có phải TÊN MỘT ĐÈN BIỂN không.
 *
 * Đèn biển và phao đều là "báo hiệu hàng hải", nhưng khác nhau ở đúng chỗ lớp
 * này hứa: đèn biển là công trình cố định mang TÊN RIÊNG bà con nhớ và tra lại
 * được ("Kê Gà", "Hòn Khoai", "Song Tử Tây"); phao mang SỐ HIỆU đổi theo tiến
 * độ công trình ("Phao số 6", "NC1", "TC-02"). Để một số hiệu phao lọt vào lớp
 * đèn là hứa sai: bà con sẽ tìm một ngọn đèn ở chỗ chỉ có một cái phao.
 *
 * Cổng này CÙNG MỘT BẢN với cổng trong `scripts/generate-den-bien.mjs` —
 * bộ test nhập thẳng bản của script để hai bên không trôi khỏi nhau.
 */
export function laTenDenBien(ten: unknown): boolean {
  const t = String(ten ?? "").trim();
  if (t.length < 2 || t.length > 40) return false;
  if (/[°"'‘’“”]/.test(t)) return false; // mảnh toạ độ trôi vào cột tên
  if (/\d{3,}/.test(t)) return false; // chuỗi số dài = số hiệu hoặc toạ độ vỡ
  if (/^\d+([.,]\d+)?$/.test(t)) return false; // số trơn
  if (/\b(phao|ti[êe]u|đ[ăa]ng ti[êe]u)\b/i.test(t)) return false;
  if (/^[A-Z]{1,4}[-\s]?\d{1,3}$/i.test(t)) return false; // "NC1", "TC-02"
  if (!/[A-Za-zÀ-ỹ]/.test(t)) return false;
  if (t.split(/\s+/).length > 6) return false; // câu văn tràn sang cột tên
  return true;
}

/* ── GIẢI MÃ DATASET ─────────────────────────────────────────────────────── */

/** Vị trí các cột thêm — chín cột đầu là khuôn `seamarks.v1.json`. */
const COT = {
  lon: 0, lat: 1, type: 2, char: 3, group: 4, lightColour: 5,
  period: 6, range: 7, bodyColour: 8,
  ten: 9, noi: 10, hThap: 11, hTam: 12, rngNgay: 13, nam: 14, prov: 15,
  /** cột 17 (tuỳ chọn): `1` = mục cố-ý-không-tên. Hàng cũ 16 cột không có. */
  khongTen: 16,
} as const;

const tra = (bang: string[] | undefined, i: number | undefined): string | undefined =>
  Array.isArray(bang) && typeof i === "number" && i >= 0 && i < bang.length
    ? bang[i] || undefined
    : undefined;

/** Số dương thật sự; `-1` của file (= nguồn không công bố) trả `undefined`. */
const soDuong = (v: number | undefined): number | undefined =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined;

/**
 * Bảng tra + hàng số → danh sách đèn biển.
 *
 * BỎ QUA hàng hỏng thay vì ném: một dòng lỗi không được làm mất cả lớp đèn của
 * chuyến biển. Hàng bị bỏ khi thiếu toạ độ, RA NGOÀI KHUNG BIỂN VN, hoặc tên
 * không phải tên đèn biển — ba cổng này là lý do lớp tồn tại, không phải
 * trang trí.
 */
export function decodeDenBien(raw: unknown): DenBien[] {
  const f = raw as Partial<DenBienFile> | null;
  if (!f || !Array.isArray(f.lights)) return [];

  const out: DenBien[] = [];
  for (const row of f.lights) {
    if (!Array.isArray(row) || row.length < 10) continue;
    const lon = row[COT.lon];
    const lat = row[COT.lat];
    if (!trongKhungBienVN(lon, lat)) continue;

    // Cờ cố-ý-không-tên (cột 17) mở đường DUY NHẤT qua cổng tên: hàng mang cờ
    // được nhận với tên rỗng; hàng KHÔNG cờ mà thiếu tên/tên rác vẫn bị loại
    // như trước — cổng `laTenDenBien` không nới một li nào.
    const khongTen = row[COT.khongTen] === 1;
    const ten = khongTen ? "" : tra(f.names, row[COT.ten]);
    if (!khongTen && (!ten || !laTenDenBien(ten))) continue;

    const type = tra(f.types, row[COT.type]) ?? "light_major";

    const light: LightInfo = {};
    const character = tra(f.chars, row[COT.char]);
    if (character) light.character = character;
    const group = tra(f.groups, row[COT.group]);
    if (group) light.group = group;
    const lightColour = tra(f.colours, row[COT.lightColour]);
    if (lightColour) light.colour = lightColour;
    const period = soDuong(row[COT.period]);
    if (period) light.period = period;
    const range = soDuong(row[COT.range]);
    if (range) light.range = range;

    const prov = Array.isArray(f.provs) ? f.provs[row[COT.prov]] : undefined;
    const den: DenBien = {
      lon,
      lat,
      type,
      ten: ten ?? "",
      // Không có lý lịch thì vẫn giữ cái đèn (vị trí là thứ cứu người), nhưng
      // ghi rõ "chưa tra được" thay vì bịa một nguồn — `validateProvenance()`
      // và `isCleanLicense()` sẽ tự chặn nó khỏi gói bán.
      prov: prov ?? { origin: { source: "sdfish", at: f.layNgay ?? "" } },
    };
    if (khongTen) den.khongTen = true;
    if (Object.keys(light).length) den.light = light;

    const body = tra(f.colours, row[COT.bodyColour]);
    if (body) den.colour = body;
    const noi = tra(f.places, row[COT.noi]);
    if (noi) den.noi = noi;
    const hThap = soDuong(row[COT.hThap]);
    if (hThap) den.chieuCaoThap = hThap;
    const hTam = soDuong(row[COT.hTam]);
    if (hTam) den.chieuCaoTamSang = hTam;
    const rngNgay = soDuong(row[COT.rngNgay]);
    if (rngNgay) den.tamNgay = rngNgay;
    const nam = tra(f.years, row[COT.nam]);
    if (nam) den.namThietLap = nam;

    out.push(den);
  }
  return out;
}

/* ── CÂU CHO BÀ CON ĐỌC ──────────────────────────────────────────────────── */

/**
 * "Kê Gà" → "Đèn biển Kê Gà". Tên trong dataset cố ý KHÔNG mang tiền tố.
 * Mục cố-ý-không-tên (`ten` rỗng) → "Đèn biển" trần — không "Đèn biển
 * undefined", không ném: thẻ chạm vẫn phải mở được giữa biển.
 */
export function tenDayDu(den: Pick<DenBien, "ten">): string {
  return den.ten ? `Đèn biển ${den.ten}` : "Đèn biển";
}

/**
 * Một dòng cho ô "chạm xem".
 *
 *   "Đèn biển Kê Gà · Bình Thuận · Chớp 3 nhịp rồi 1 nhịp, ánh trắng, 20 giây
 *    một vòng, xa 22 hải lý · tháp trắng · cao 41 m, đèn ở độ cao 65 m"
 *
 * Thiếu phần nào thì BỎ phần đó — không bịa. Nguồn nhà nước để trống rất
 * nhiều ô, và hứa một mức chính xác nguồn không bảo đảm là điều dự án cấm.
 */
export function moTaDenBien(den: DenBien): string {
  const bits = [tenDayDu(den)];
  if (den.noi) bits.push(den.noi);

  const light = describeLight(den.light);
  if (light) bits.push(light);

  const than = colourLabel(den.colour);
  if (than) bits.push(`tháp ${than}`);

  const cao: string[] = [];
  if (den.chieuCaoThap) cao.push(`cao ${den.chieuCaoThap} m`);
  if (den.chieuCaoTamSang) cao.push(`đèn ở độ cao ${den.chieuCaoTamSang} m`);
  if (cao.length) bits.push(cao.join(", "));

  return bits.join(" · ");
}

/* Nhãn LOẠI ("Đèn biển lớn" / "Đèn báo hiệu nhỏ") lấy thẳng bằng
   `seamarkLabel(den.type)` của `seamarks.ts` — `light_major`/`light_minor` là
   khoá có sẵn ở đó. KHÔNG bọc thêm một hàm chỉ để gọi tiếp. */

/* ── TẢI ASSET TĨNH ──────────────────────────────────────────────────────── */

let cached: Promise<DenBien[]> | null = null;

/**
 * Tải lớp đèn biển (~30 KB, CÙNG ORIGIN nên service worker giữ được) — cache
 * cho cả phiên.
 *
 * `async` LÀ LÁ CHẮN THỨ HAI (cùng lý do đã ghi ở `fetchSeamarks`): nếu hàm
 * không `async` mà vẫn trả Promise thì cú ném ĐỒNG BỘ trong thân hàm (máy cũ
 * thiếu `AbortSignal.timeout`) bay ra ngoài trước khi promise kịp tồn tại ⇒
 * `.catch` của chỗ gọi không với tới ⇒ cây React sập, bản đồ trắng cả chuyến.
 * Lá chắn thứ nhất là `timeoutSignal` (không bao giờ ném).
 *
 * Hỏng thì XOÁ bộ nhớ đệm để lần sóng về sau thử lại — mất sóng ngoài khơi
 * không được khoá vĩnh viễn một lớp bản đồ.
 */
export async function fetchDenBien(): Promise<DenBien[]> {
  if (!cached) {
    cached = fetch("/data/den-bien.v1.json", { signal: timeoutSignal(20000) })
      .then((r) => {
        if (!r.ok) throw new Error(`den-bien ${r.status}`);
        return r.json();
      })
      .then(decodeDenBien)
      .catch((e) => {
        cached = null; // lần sau thử lại (mất sóng không khoá vĩnh viễn)
        throw e;
      });
  }
  return cached;
}
