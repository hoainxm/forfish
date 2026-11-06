// SEN BIỂN ĐỌC CẢNH BÁO GIÁM SÁT HÀNH TRÌNH — THUẦN (2026-11-06). Anh Long: "cho sen biển đọc cái cảnh báo".
//
// Soạn LỜI ĐỌC (giọng Sen Biển, lib/voice/tts ttsSpeak) từ đúng dữ liệu thẻ "Giám sát hành trình" đang hiện (GET
// /api/stracking/cua-toi hoặc bản lưu `forfish.stracking.v1` — đọc được cả khi mất sóng). Nút "Nghe" trên thẻ gọi
// `loiDocGiamSat(...)` rồi `ttsSpeak` TRONG handler chạm (iOS chỉ phát tiếng sau cử chỉ chạm thật — tts.ts ttsUnlock).
//
// Thứ tự = thứ tự nguy hiểm: mất tín hiệu (kèm giờ chót trước mốc phạt) ⇒ cảnh báo hôm nay (nặng trước) ⇒ cước sắp hết /
// quá hạn ⇒ không có gì thì nói một câu yên tâm. Câu ngắn, giờ đọc kiểu "9 giờ 53" cho giọng máy đọc tròn; tối đa vài
// câu mỗi tàu để không đọc dài lê thê.

import { homNayVn, trangThaiHan } from "./dong-bo.mjs";
import { mucCanhBao } from "./muc-canh-bao.mjs";

const GIO_MS = 3600_000;
/** Đọc tối đa ngần này cảnh báo mỗi tàu (nặng nhất trước). */
export const CANH_BAO_MOI_TAU = 2;

/** Viết thường chữ đầu cho câu đọc liền mạch, GIỮ chữ viết tắt in hoa (SOS, GPS) để giọng máy đọc đúng. */
function chuThuong(loai) {
  return String(loai).replace(/\S+/g, (w) => (/^[A-ZĐ]{2,}$/.test(w) ? w : w.toLowerCase()));
}

/** ISO ⇒ "9 giờ 53" (giờ VN); khác ngày hôm nay ⇒ thêm "ngày 7 tháng 11". */
export function gioDoc(iso, now = Date.now()) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const d = new Date(t + 7 * GIO_MS);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const gio = m ? `${h} giờ ${m}` : `${h} giờ`;
  return homNayVn(t) === homNayVn(now) ? gio : `${gio} ngày ${d.getUTCDate()} tháng ${d.getUTCMonth() + 1}`;
}

/**
 * Lời đọc cho các máy của bà con. `tau`: [{ tenTau, imei, hetHan, trongBo, matKetNoiTu }] · `canhBao`: [{ imei, loai, luc,
 * muc }] (trong ngày, chưa đóng). Trả MỘT chuỗi nhiều câu — bỏ thẳng vào ttsSpeak.
 * @param {{
 *   tau?: { tenTau?: string | null, imei?: string | null, hetHan?: string | null, trongBo?: boolean | null, matKetNoiTu?: string | null }[],
 *   canhBao?: { imei: string, loai: string, luc: string, muc?: string | null }[],
 *   now?: number,
 * }} vao
 * @returns {string}
 */
export function loiDocGiamSat({ tau = [], canhBao = [], now = Date.now() }) {
  if (!tau.length) return "Sen Biển chưa thấy máy giám sát hành trình nào đứng tên số điện thoại của bà con.";
  const homNay = homNayVn(now);
  const cau = [];
  let coViec = false;
  for (const t of tau) {
    const ten = t.tenTau || "tàu của bà con";
    // 1) Mất tín hiệu — kèm giờ chót trước mốc phạt (ngoài khơi 6 giờ, nằm bờ 1 ngày).
    if (t.matKetNoiTu && Number.isFinite(Date.parse(t.matKetNoiTu))) {
      coViec = true;
      const bo = t.trongBo === true;
      const moc = Date.parse(t.matKetNoiTu) + (bo ? 24 : 6) * GIO_MS;
      const truoc = now < moc ? ` Cần có tín hiệu lại trước ${gioDoc(new Date(moc).toISOString(), now)} để không bị phạt.` : " Đã quá mốc, bà con báo vị trí về bờ và gọi SDVICO kiểm tra máy nghen.";
      cau.push(`Tàu ${ten} đang mất tín hiệu giám sát hành trình từ ${gioDoc(t.matKetNoiTu, now)}.${truoc}`);
    }
    // 2) Cảnh báo hôm nay của máy này — bỏ loại "bỏ qua" khi nằm bờ, nặng nhất trước.
    const cb = canhBao
      .filter((c) => c.imei && c.imei === t.imei)
      .map((c) => ({ ...c, m: mucCanhBao({ loai: c.loai, muc: c.muc, trongBo: t.trongBo ?? null }) }))
      .filter((c) => c.m.bac !== "bo")
      .sort((a, b) => a.m.hang - b.m.hang || Date.parse(b.luc) - Date.parse(a.luc))
      .slice(0, CANH_BAO_MOI_TAU);
    for (const c of cb) {
      coViec = true;
      cau.push(`Tàu ${ten} có cảnh báo ${chuThuong(c.loai)} lúc ${gioDoc(c.luc, now)}.`);
    }
    // 3) Cước — chỉ nói khi còn ≤30 ngày hoặc đã quá hạn.
    const s = trangThaiHan(t.hetHan, homNay);
    if (s.loai === "het-han") {
      coViec = true;
      cau.push(`Cước giám sát hành trình tàu ${ten} đã quá hạn ${-s.soNgay} ngày, bà con gia hạn trong app nghen.`);
    } else if (s.loai === "sap-het") {
      coViec = true;
      cau.push(s.soNgay === 0 ? `Cước giám sát hành trình tàu ${ten} hết hạn hôm nay.` : `Cước giám sát hành trình tàu ${ten} còn ${s.soNgay} ngày.`);
    }
  }
  if (!coViec) {
    return tau.length === 1
      ? `Tàu ${tau[0].tenTau || "của bà con"} ổn, máy giám sát hành trình không có cảnh báo nào hôm nay.`
      : `${tau.length} tàu của bà con đều ổn, không có cảnh báo giám sát hành trình nào hôm nay.`;
  }
  return cau.join(" ");
}
