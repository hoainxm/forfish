// NHẮC NHỞ GIÁM SÁT HÀNH TRÌNH — THUẦN (2026-11-05). Anh Long: "cái tình trạng đồng bộ tổng cục quan trọng, vì nếu ko đồng
// bộ, mkn >6h là họ sẽ bị phạt, những cảnh báo loại này sẽ cho sen biển nhắc nhở họ thêm" · "cần tổ chức logic nhắc nhở".
//
// Máy GPU (scripts/stracking-dong-bo.mjs) có ĐỦ dữ liệu để quyết nhắc: hồ sơ máy (hạn, đồng bộ Tổng cục, SĐT chủ tàu +
// thuyền trưởng — kho SQLite) + danh sách MẤT KẾT NỐI đang diễn ra (/getListDeviceDisconnect). Nó gọi `viecNhac`, chống lặp
// bằng `khoa` trong sổ "đã nhắc" của máy nhà, rồi gửi `nhac[]` (một dòng/tàu/người) lên POST /api/stracking/nhap; máy chủ
// gộp với cảnh báo tàu thành MỘT tin/SĐT/lượt vào hộp thư + đẩy lên máy (lib/stracking/thong-bao).
//
// Không viện dẫn mức tiền phạt cụ thể — chỉ các mốc giờ/ngày (6 giờ, 1 ngày, 10 ngày về bờ).
// GIỌNG (anh Long 05/11: "thông báo chọn ngôn ngữ để ngư dân thấy mình đang giúp họ"): mỗi câu = chuyện gì đang xảy ra
// + bà con làm gì + SDVICO giúp được gì. Không doạ, không chữ in hoa hét, không "bị phạt" đứng trơ — nói "để tránh bị phạt".

import { homNayVn, trangThaiHan } from "./dong-bo.mjs";
import { laMayDaBo } from "./may-da-bo.mjs";

/**
 * MẤT KẾT NỐI — BÁO TRƯỚC NHIỀU NẤC (anh Long 06/11: "phải báo trước khi tới ngưỡng bị phạt nhé, logic phải thông minh"):
 *   · NGOÀI KHƠI mốc phạt 6 giờ ⇒ báo khi CÒN 3 giờ và CÒN 1 giờ; tới mốc ⇒ "quá 6 giờ", nhắc lại mỗi 6 giờ trong đợt.
 *   · NẰM BỜ mốc 1 ngày (anh Long 06/11: "cái ở bờ tắt máy cũng bị phạt nếu 1 ngày ko báo cáo 1 vị trí đấy") ⇒ báo khi CÒN
 *     8 giờ và CÒN 3 giờ; tới mốc ⇒ "quá 1 ngày", nhắc lại mỗi 24 giờ. Máy đang TẠM NGƯNG (đã khai) ⇒ không nhắc.
 * Câu nói GIỜ CHÓT cụ thể ("trước 19:40 hôm nay"). Mỗi nấc đúng 1 lần (khoá serial + đợt + nấc); lỡ nấc thì chỉ gửi nấc
 * gần nhất, không dồn. Nấc rơi 22:00–05:00 ⇒ dời lên 21:00 tối trước (nếu vẫn sau lúc bắt đầu mất) — bà con ngủ, sáng ra
 * là quá mốc. Trừ TRE_DO_MS cho chu kỳ lượt kiểm (15 phút) — báo sớm một chút còn hơn trễ.
 *
 * Bổ sung 07/11 (anh Long "làm 2 tới 5", theo docs/research/chien-luoc-du-lieu-2026-11-06 r5-mkn3):
 *   · KHÔNG RÕ bờ/khơi ⇒ coi như NGOÀI KHƠI (mốc 6 giờ, sớm hơn) — nhầm sang bờ là trễ 18 giờ đúng chỗ phạt nặng.
 *   · Máy đang mất mà CƯỚC ĐÃ HẾT ⇒ câu nói thẳng nguyên nhân + gia hạn trong app (thay "kiểm tra nguồn, ăng-ten").
 *   · NẰM BỜ quá 2 ngày ⇒ thêm lối gỡ gốc: làm đơn TẠM NGỪNG (chỉ phải báo vị trí 7 ngày/lần), SDVICO làm hộ.
 *   · NGOÀI KHƠI nấc 8 ngày và 10 ngày (NĐ 41/2026: máy không khắc phục được thì tàu phải về bờ trong 10 ngày; Cục nhắc
 *     sớm ở giờ 192) ⇒ từ ngày 8 nhắc MỖI NGÀY một lần thay chu kỳ 6 giờ, nói hạn chót đưa tàu về.
 */
export const MKN_PHAT_GIO = 6;
/** Ngoài khơi: Cục nhắc sớm ở giờ 192 (8 ngày), quá 240 giờ (10 ngày) phải đưa tàu về bờ. */
export const MKN_NHAC_VE_BO_GIO = 192;
export const MKN_VE_BO_GIO = 240;
/** Nằm bờ mất tín hiệu quá ngần này ⇒ gợi ý làm đơn tạm ngừng. */
export const MKN_BO_GOI_Y_TAM_NGUNG_GIO = 48;
export const MKN_BO_PHAT_GIO = 24;
export const NAC_KHOI_CON_GIO = [3, 1];
export const NAC_BO_CON_GIO = [8, 3];
export const TRE_DO_MS = 15 * 60_000;
/** Mốc nhắc hạn cước: còn N ngày (0 = hết hôm nay). */
export const MOC_CON_HAN = [15, 7, 3, 1, 0];
/** Mốc nhắc khi ĐÃ quá hạn: quá N ngày. */
export const MOC_QUA_HAN = [1, 7, 30];
/**
 * MỐC LẮP MÁY THEO NGHỊ ĐỊNH (anh Long 05/11: "rà soát các thuê bao mà thiết bị ko đạt nghị định 41 … thông báo liên hệ
 * sdvico để nâng cấp đáp ứng" → "theo năm, coi các mốc nghị định ấy, 26, 37, 41"). NĐ 37/2024 (sửa NĐ 26/2019) có hiệu lực
 * 19/5/2024; NĐ 41/2026 (thay NĐ 26/2019, ban hành 25/01/2026): tàu đã lắp thiết bị TRƯỚC 19/5/2024 mà chưa đáp ứng yêu cầu
 * kỹ thuật tại khoản 2 Điều 26 phải nâng cấp/thay (nguồn: tin An Giang hỗ trợ nâng cấp, thuysanvietnam.com.vn, 05/2026).
 * Ngày lắp = "Thời gian đăng ký" trên S-Tracking (thiếu thì "Ngày tạo"). Máy lắp trước mốc ⇒ nhắc liên hệ SDVICO kiểm tra,
 * nâng cấp — 1 lần/tuần (anh Long chọn); lần ĐẦU đẩy lên máy, các tuần sau chỉ hộp thư (máy GPU quyết `day`).
 */
export const MOC_LAP_ND37 = "2024-05-19";

/**
 * Đời máy CHẮC CHẮN phải nâng cấp theo NĐ 41/2026 — anh Long 05/11: "K2019 va D2019 là chắc chắn phải nâng cấp ND41".
 * Serial S-Tracking = "MTR" + THÁNG (2 số) + NĂM SẢN XUẤT (4 số) + chữ DÒNG MÁY + số máy (vd MTR032026D006069 = tháng
 * 03/2026, dòng D; đo kho 05/11: 15 851/15 853 serial có tháng 01–12). Đời = chữ dòng + năm, vd "D2019".
 * Đo 05/11: D2019 = 2 052 máy; K2019 = 0 (dòng K đời cũ là K2018 — 292 máy, CHƯA vào danh sách).
 * M2019 thêm 05/11 (anh Long: "ok bổ sung thêm m2019 đi") — 6 602 máy còn dùng có SĐT, ~61% đăng ký SAU mốc 19/5/2024 nên
 * luật mốc ngày không phủ. Tổng nhắc NĐ 41 sau khi thêm: ~7 700 máy / ~7 350 SĐT (trước: ~3 700).
 */
export const DOI_PHAI_NANG_CAP = ["K2019", "D2019", "M2019"];

/** "MTR032019D…" ⇒ "D2019"; không đúng dạng ⇒ null. */
export function doiMay(serial) {
  const m = /^MTR(\d{2})(\d{4})([A-Z])/.exec(String(serial ?? ""));
  return m && Number(m[1]) >= 1 && Number(m[1]) <= 12 ? `${m[3]}${m[2]}` : null;
}

const GIO_MS = 3600_000;

function gioPhutVn(ms) {
  const d = new Date(ms + 7 * GIO_MS);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())} ${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}`;
}
function ngayVn(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Một dòng JSON /getListDeviceDisconnect (content.data[].report) ⇒ đợt mất kết nối. Sai ⇒ null.
 * `viTri` = bộ lọc của lượt hỏi ("1" trong bờ / "2" ngoài khơi) — dùng khi dòng thiếu/lạ `inShore`. Cả hai cùng không rõ
 * ⇒ NGOÀI KHƠI (mặc định an toàn: mốc 6 giờ). Chỉ nhận chuỗi: gọi qua `.map(docMkn)` sẽ truyền chỉ số mảng (số) vào đây.
 */
export function docMkn(r, viTri) {
  const x = r?.report ?? r;
  if (!x || typeof x !== "object") return null;
  const serial = typeof x.serial === "string" ? x.serial.trim() : "";
  const batDau = Number(x.dateTracking);
  if (!serial || !Number.isFinite(batDau) || batDau < 1e12) return null;
  const ketThuc = x.dateOnline == null ? null : Number(x.dateOnline);
  return {
    serial,
    imei: typeof x.imei === "string" ? x.imei.trim() || null : null,
    tenTau: (typeof x.deviceName === "string" && x.deviceName.trim()) || (typeof x.vin === "string" && x.vin.trim()) || null,
    batDau: new Date(batDau).toISOString(),
    ketThuc: ketThuc != null && Number.isFinite(ketThuc) ? new Date(ketThuc).toISOString() : null,
    dangMat: ketThuc == null || !Number.isFinite(ketThuc),
    // inShore: 1 = trong bờ, 2 = ngoài khơi (khớp bộ lọc "Vị trí" của trang).
    ngoaiKhoi: laNgoaiKhoi(x.inShore, viTri),
  };
}

function laNgoaiKhoi(inShore, viTri) {
  const v = Number(inShore);
  if (inShore != null && inShore !== "" && (v === 1 || v === 2)) return v === 2;
  return viTri !== "1";
}

/**
 * TRẠNG THÁI KẾT NỐI hiện tại theo báo cáo mất kết nối (anh Long 06/11 "fix hết đi" — thẻ máy ghi "cập nhật 06:45" làm nhân
 * viên tưởng mất kết nối). Mỗi máy lấy ĐỢT MỚI NHẤT (bắt đầu muộn nhất): đang mất ⇒ { matTu, coLai: null }; đã có lại ⇒
 * { matTu: null, coLai }. Máy không có trong báo cáo (không đợt nào trong ~22 ngày khơi / ~9 ngày bờ) ⇒ không trả — máy chủ
 * không đụng. Gửi lên máy chủ dạng `ketNoi: [{ serial, matTu, coLai }]`.
 */
export function trangThaiKetNoi(mkn) {
  const moiNhat = new Map();
  for (const m of mkn) {
    if (!m?.serial) continue;
    const cu = moiNhat.get(m.serial);
    if (!cu || Date.parse(m.batDau) > Date.parse(cu.batDau)) moiNhat.set(m.serial, m);
  }
  return [...moiNhat.values()].map((m) => ({ serial: m.serial, matTu: m.dangMat ? m.batDau : null, coLai: m.dangMat ? null : m.ketThuc }));
}

/**
 * Người nhận nhắc = CHỈ CHỦ TÀU (anh Long 06/11: "chủ tàu mới xem giám sát, thuyền trưởng nếu có chỉ là trong hồ sơ lao
 * động thôi"). SĐT thuyền trưởng không nhận nhắc giám sát hành trình.
 */
function nguoiNhan(t) {
  return typeof t.sdtChuTau === "string" && /^0[1-9]\d{8}$/.test(t.sdtChuTau) ? [t.sdtChuTau] : [];
}

/**
 * Việc nhắc của MỘT lượt. `thietBi`: hồ sơ gộp (khoá camelCase như kho máy nhà: serial, tenTau, sdtChuTau, sdtThuyenTruong,
 * hetHan, dongBoTcts, trongBo). `mkn`: kết quả `docMkn` (chỉ đợt đang mất có nghĩa). Trả [{khoa, serial, tau, loai, day,
 * dong, nguoi[]}] — `khoa` cố định cho cùng một sự việc cùng mốc ⇒ máy nhà chống lặp; `day` = đẩy lên máy (còn lại chỉ hộp thư).
 * Kiểu khai rõ: thiếu thì TS suy `mkn = []` thành `never[]` ⇒ `next build` (type check cả test) hỏng — đã làm hỏng MỌI bản
 * deploy Vercel từ 9646e102 tới 3258fc6e (05/11).
 * @param {{ thietBi: any[], mkn?: (ReturnType<typeof docMkn>)[], now?: number }} p
 */
export function viecNhac({ thietBi, mkn = [], now = Date.now() }) {
  const homNay = homNayVn(now);
  // Máy ĐÃ HUỶ / THU HỒI (đại lý đổi tên DE…/Thu…, nhóm …DELETE — lib/stracking/may-da-bo) ⇒ không nhắc gì: nhiều máy
  // quá hạn từ 2023, nhắc là sai (báo thật từ nhóm Zalo 05/11).
  // Hồ sơ kho có sẵn capNhatNguon + hetHan ⇒ cũng loại máy BỎ ĐỌNG (>365 ngày không cập nhật và hết/không hạn).
  thietBi = thietBi.filter((t) => !laMayDaBo(t, now));
  const theoSerial = new Map(thietBi.map((t) => [t.serial, t]));
  const out = [];
  const them = (t, x) => {
    const nguoi = nguoiNhan(t);
    if (nguoi.length) out.push({ serial: t.serial, tau: t.tenTau ?? t.serial, nguoi, ...x });
  };

  // 1) MẤT KẾT NỐI đang diễn ra — báo trước nhiều nấc tới mốc phạt (ngoài khơi 6 giờ, nằm bờ 1 ngày), quá mốc nhắc lại.
  for (const m of mkn) {
    if (!m?.dangMat) continue;
    const t = theoSerial.get(m.serial);
    if (!t) continue;
    const bo = !m.ngoaiKhoi;
    if (bo && dangTamNgung(t, homNay)) continue;
    const bd = Date.parse(m.batDau);
    if (!Number.isFinite(bd)) continue;
    const mocGio = bo ? MKN_BO_PHAT_GIO : MKN_PHAT_GIO;
    const mocMs = bd + mocGio * GIO_MS;
    const tau = t.tenTau ?? m.tenTau ?? t.serial;
    const tu = gioPhutVn(bd);
    const daMat = Math.floor((now - bd) / GIO_MS);
    const noiMat = bo ? " khi tàu nằm bờ" : "";
    // Nguyên nhân CHẮC CHẮN: cước đã hết ⇒ máy ngừng truyền. Nói thẳng + gia hạn trong app (không bảo kiểm ăng-ten).
    const hetCuoc = trangThaiHan(t.hetHan, homNay).loai === "het-han";
    const caiCuoc = hetCuoc
      ? ` Máy ngừng truyền vì cước giám sát hành trình đã hết hạn từ ${ngayVn(t.hetHan)} — bà con gia hạn ngay trong app để máy truyền lại.`
      : "";
    if (now + TRE_DO_MS < mocMs) {
      const nac = nacBaoTruoc(bd, mocMs, bo ? NAC_BO_CON_GIO : NAC_KHOI_CON_GIO, now);
      if (!nac) continue;
      const han = hanChot(mocMs, now);
      const conLai = conLaiChu(mocMs - now);
      const dau = `${tau}: máy giám sát hành trình mất tín hiệu ${daMat} giờ${noiMat} (từ ${tu}).`;
      them(t, {
        khoa: `${bo ? "mkn-bo" : "mkn"}|${t.serial}|${m.batDau}|con${nac}`,
        loai: bo ? "mkn-bo-sap-1ngay" : "mkn-sap-6h",
        day: true,
        dong: hetCuoc
          ? `${dau} Còn ${conLai} — trước ${han} máy cần có tín hiệu lại để không bị phạt.${caiCuoc} Cần hỗ trợ cứ gọi SDVICO.`
          : bo
            ? `${dau} Còn ${conLai} — bà con bật máy để báo vị trí trước ${han}, tránh bị phạt. Cần hỗ trợ cứ gọi SDVICO.`
            : `${dau} Còn ${conLai} — trước ${han} máy cần có tín hiệu lại để không bị phạt. Bà con kiểm tra giúp nguồn điện, ăng-ten; cần hỗ trợ cứ gọi SDVICO.`,
      });
    } else if (!bo && now + TRE_DO_MS >= bd + MKN_NHAC_VE_BO_GIO * GIO_MS) {
      // NGOÀI KHƠI từ ngày thứ 8: nhắc MỖI NGÀY một lần (thay chu kỳ 6 giờ) hạn chót đưa tàu về bờ — mốc 10 ngày NĐ 41/2026.
      const ngay = Math.floor((now + TRE_DO_MS - bd) / (24 * GIO_MS));
      const quaVeBo = now >= bd + MKN_VE_BO_GIO * GIO_MS;
      const dau = `${tau}: máy giám sát hành trình mất tín hiệu ${ngay} ngày (từ ${tu}).`;
      them(t, {
        khoa: `mkn|${t.serial}|${m.batDau}|ngay${ngay}`,
        loai: quaVeBo ? "mkn-qua-10ngay" : "mkn-sap-10ngay",
        day: true,
        dong: quaVeBo
          ? `${dau}${caiCuoc} Đã quá 10 ngày — theo quy định tàu phải về bờ khi máy không khắc phục được. Bà con đưa tàu về sớm nhất có thể và gọi SDVICO để sửa máy khi cập bến.`
          : `${dau}${caiCuoc} Theo quy định, máy không khắc phục được thì tàu phải về bờ trong 10 ngày — tức trước ${hanChot(bd + MKN_VE_BO_GIO * GIO_MS, now)}. ${hetCuoc ? "Chưa gia hạn được thì bà con" : "Bà con"} sắp xếp đưa tàu về và gọi SDVICO để sửa máy khi cập bến.`,
      });
    } else {
      // Đã tới mốc phạt — nhắc lại mỗi chu kỳ mốc (6 giờ / 24 giờ) trong cùng đợt.
      const dot = Math.floor((now - bd) / (mocGio * GIO_MS));
      const thoiGian = daMat >= 48 ? `${Math.floor(daMat / 24)} ngày` : `${daMat} giờ`;
      // Nằm bờ lâu: lối gỡ GỐC là đơn tạm ngừng (đang tạm ngừng chỉ báo vị trí 7 ngày/lần) — cả ngành mới 204 đơn.
      const tamNgung =
        bo && daMat >= MKN_BO_GOI_Y_TAM_NGUNG_GIO
          ? " Tàu nằm bờ dài ngày thì nên làm đơn tạm ngừng giám sát hành trình — khi tạm ngừng chỉ phải báo vị trí 7 ngày một lần; SDVICO làm hộ, bà con cứ gọi."
          : "";
      them(t, {
        khoa: `${bo ? "mkn-bo" : "mkn"}|${t.serial}|${m.batDau}|${dot}`,
        loai: bo ? "mkn-bo-qua-1ngay" : "mkn-qua-6h",
        day: true,
        dong: bo
          ? `${tau}: máy giám sát hành trình mất tín hiệu ${thoiGian}${noiMat} (từ ${tu}).${caiCuoc} Để tránh bị phạt, bà con ${hetCuoc ? "" : "bật lại máy hoặc "}báo vị trí cho cơ quan quản lý mỗi ngày.${tamNgung || " SDVICO sẵn sàng kiểm tra máy giúp bà con."}`
          : `${tau}: máy giám sát hành trình mất tín hiệu ${thoiGian} (từ ${tu}).${caiCuoc} Để tránh bị phạt, bà con nhớ báo vị trí tàu cho cơ quan quản lý bằng liên lạc khác; SDVICO sẵn sàng kiểm tra máy giúp bà con.`,
      });
    }
  }

  for (const t of thietBi) {
    // 2) KHÔNG ĐỒNG BỘ TỔNG CỤC — dữ liệu không về Tổng cục Thủy sản. Ngoài khơi ⇒ đẩy; trong bờ ⇒ chỉ hộp thư. 1 lần/ngày.
    if (typeof t.dongBoTcts === "string" && /thất bại/i.test(t.dongBoTcts)) {
      const ngoai = t.trongBo === false;
      them(t, {
        khoa: `tcts|${t.serial}|${homNay}`,
        loai: "tcts-that-bai",
        day: ngoai,
        dong: `${t.tenTau ?? t.serial}: dữ liệu máy giám sát hành trình chưa đồng bộ được${ngoai ? " trong lúc tàu đang ngoài khơi" : ""}. Bà con gọi SDVICO, bên em kiểm tra giúp để tàu không bị tính mất kết nối.`,
      });
    }
    // 3) HẠN CƯỚC — nhắc đúng các mốc, hết hạn = máy ngừng truyền = mất kết nối.
    const s = trangThaiHan(t.hetHan, homNay);
    if (s.loai === "sap-het" && MOC_CON_HAN.includes(s.soNgay)) {
      them(t, {
        khoa: `han|${t.serial}|${t.hetHan}|con${s.soNgay}`,
        loai: "han-sap-het",
        day: s.soNgay <= 3,
        dong:
          s.soNgay === 0
            ? `${t.tenTau ?? t.serial}: cước giám sát hành trình hết hạn hôm nay. Bà con gia hạn ngay trong app để máy không ngừng truyền khi đi biển.`
            : `${t.tenTau ?? t.serial}: cước giám sát hành trình còn ${s.soNgay} ngày (hết ${ngayVn(t.hetHan)}). Bà con gia hạn sớm trong app để máy chạy liên tục, yên tâm ra khơi.`,
      });
    } else if (s.loai === "het-han" && MOC_QUA_HAN.includes(-s.soNgay)) {
      them(t, {
        khoa: `han|${t.serial}|${t.hetHan}|qua${-s.soNgay}`,
        loai: "han-qua-han",
        day: true,
        dong: `${t.tenTau ?? t.serial}: cước giám sát hành trình đã quá hạn ${-s.soNgay} ngày (từ ${ngayVn(t.hetHan)}), máy đang ngừng truyền. Bà con gia hạn trong app trước khi ra khơi, hoặc gọi SDVICO để được hỗ trợ.`,
      });
    }
    // 4) NGHỊ ĐỊNH 41/2026 — 1 lần/tuần (khoá theo tuần VN; một máy một dòng dù khớp cả hai luật):
    //    (a) đời máy CHẮC CHẮN phải nâng cấp (DOI_PHAI_NANG_CAP, theo serial) ⇒ nói chắc;
    //    (b) lắp TRƯỚC mốc 19/5/2024 (NĐ 37/2024) ⇒ máy lắp trước mốc chưa đáp ứng yêu cầu mới phải nâng cấp ⇒ mời kiểm tra.
    const doi = doiMay(t.serial);
    const ngayLap = t.dangKyLuc || (typeof t.taoLuc === "string" ? isoNgayVn(t.taoLuc) : null);
    const ten = t.tenTau ?? t.serial;
    let dongNd41 = null;
    if (doi && DOI_PHAI_NANG_CAP.includes(doi)) {
      dongNd41 = `${ten}: máy giám sát hành trình đời ${doi.slice(0, 1)} ${doi.slice(1)} cần nâng cấp để đáp ứng Nghị định 41/2026. Bà con gọi SDVICO, bên em tư vấn và nâng cấp giúp để tàu yên tâm ra khơi đúng quy định.`;
    } else if (ngayLap && /^\d{4}-\d{2}-\d{2}$/.test(ngayLap) && ngayLap < MOC_LAP_ND37) {
      dongNd41 = `${ten}: máy giám sát hành trình lắp từ ${ngayVn(ngayLap)}, trước mốc 19/5/2024. Theo Nghị định 41/2026, máy lắp trước mốc này cần đáp ứng yêu cầu kỹ thuật mới — bà con gọi SDVICO để bên em kiểm tra giúp, cần nâng cấp thì hỗ trợ luôn.`;
    }
    if (dongNd41) {
      them(t, { khoa: `nd41|${t.serial}|tuan${tuanVn(now)}`, loai: "nd41-nang-cap", day: false, dong: dongNd41 });
    }
  }
  return out;
}

/**
 * Nấc báo trước HIỆN HÀNH (số giờ còn lại tới mốc, vd 3 hoặc 1) — nấc gần mốc nhất đã tới giờ báo; chưa nấc nào tới ⇒ null.
 * Giờ báo của nấc = mốc − N giờ; rơi 22:00–05:00 giờ VN ⇒ dời về 21:00 tối trước nếu vẫn sau lúc bắt đầu mất.
 * `now` cộng TRE_DO_MS (lượt kiểm 15 phút/lần ⇒ báo sớm hơn chút, không trễ).
 */
export function nacBaoTruoc(batDauMs, mocMs, nacConGio, now) {
  let chon = null;
  for (const n of nacConGio) {
    const luc = doiKhoiDem(mocMs - n * GIO_MS, batDauMs);
    if (now + TRE_DO_MS >= luc && (chon == null || n < chon)) chon = n;
  }
  return chon;
}

/** Giờ báo rơi 22:00–05:00 (giờ VN) ⇒ 21:00 tối trước; không sớm hơn lúc bắt đầu mất. */
export function doiKhoiDem(lucMs, batDauMs) {
  const vn = new Date(lucMs + 7 * GIO_MS);
  const h = vn.getUTCHours();
  if (h >= 5 && h < 22) return lucMs;
  const ngay = new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()));
  if (h < 5) ngay.setUTCDate(ngay.getUTCDate() - 1);
  const muoiMot = ngay.getTime() + 21 * GIO_MS - 7 * GIO_MS; // 21:00 VN của ngày đó, đổi về UTC
  return muoiMot > batDauMs ? muoiMot : lucMs;
}

/** "19:40 hôm nay" / "07:10 sáng mai" / "13:40 ngày 08/11" (giờ VN). */
function hanChot(mocMs, now) {
  const d = new Date(mocMs + 7 * GIO_MS);
  const p = (n) => String(n).padStart(2, "0");
  const gio = `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
  const ngayMoc = homNayVn(mocMs);
  const homNay = homNayVn(now);
  const mai = homNayVn(now + 24 * GIO_MS);
  if (ngayMoc === homNay) return `${gio} hôm nay`;
  if (ngayMoc === mai) return `${gio} ${d.getUTCHours() < 12 ? "sáng mai" : "ngày mai"}`;
  return `${gio} ngày ${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}`;
}

/** Thời gian còn lại nói cho dễ hiểu: "khoảng 3 giờ" / "chưa tới 1 giờ". */
function conLaiChu(ms) {
  const gio = ms / GIO_MS;
  if (gio < 1) return "chưa tới 1 giờ";
  return `khoảng ${Math.round(gio)} giờ`;
}

/** Máy đang tạm ngưng dịch vụ (đã khai trên S-Tracking) vào ngày `homNay`. */
function dangTamNgung(t, homNay) {
  return typeof t.tamNgungTu === "string" && t.tamNgungTu <= homNay && (!t.tamNgungDen || t.tamNgungDen >= homNay);
}

/** ISO (UTC) ⇒ ngày lịch VN "yyyy-mm-dd". */
function isoNgayVn(iso) {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? homNayVn(t) : null;
}

/** Số tuần (tính từ thứ Hai, giờ VN) — khoá "1 lần/tuần". */
export function tuanVn(now = Date.now()) {
  const ngay = Math.floor(Date.parse(`${homNayVn(now)}T00:00:00Z`) / 86_400_000); // 1970-01-01 là thứ Năm
  return Math.floor((ngay + 3) / 7);
}

/** Bung việc nhắc ra từng người nhận — dạng gửi máy chủ `nhac: [{sdt, tau, loai, day, dong}]`. */
export function nhacTheoNguoi(viec) {
  const out = [];
  for (const v of viec) for (const sdt of v.nguoi) out.push({ sdt, serial: v.serial, tau: v.tau, loai: v.loai, day: v.day, dong: v.dong });
  return out;
}
