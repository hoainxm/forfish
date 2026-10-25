// KAIROS — LỖI GÕ NGẪU NHIÊN cho lời agent (16 §4 2e; anh Long 2026-10-25: "cho cả random sai lỗi chính tả"). THUẦN.
//
// Người gõ điện thoại ngoài bến hay sai: quên dấu một chữ, đặt nhầm dấu thanh, sót một chữ cái, hai phím liền nhau
// đảo chỗ, kéo dài chữ cuối khi cảm thán ("ghêee"). Lỗi theo KIỂU GÕ của từng agent (agent-doi.KIEU_GO): gõ tắt nhiều
// thì hay sai, gõ đủ chữ thì ít. Tối đa 2 lỗi một lời, phần lớn chỉ 0–1 — đọc vẫn hiểu.
//
// KHÔNG ĐỤNG: chữ có HOA (tên người, tên chỗ, "SDVICO", "Hoàng Sa", tên sản phẩm có hoa), chữ có số, đoạn "@Tên" (tag
// phải khớp đúng tên — nhac-ten), link. Máy chủ kiểm chữ (chủ quyền, chữ bậy, gợi ý SDVICO) chạy TRÊN lời đã gõ sai.

/** Xác suất một lời có lỗi gõ, theo kiểu gõ. */
export const TI_LE_SAI = { "du-chu": 0.1, "tat-vua": 0.25, "tat-nhieu": 0.45, "khong-dau": 0.3 };

const DAU = { "̀": 1, "́": 1, "̃": 1, "̉": 1, "̣": 1 };
const THANH = ["̀", "́", "̃", "̉", "̣"];

/** Chữ được phép làm sai: toàn chữ thường, có ≥3 ký tự, không số, không @, không phải link. */
const duocSai = (w) => w.length >= 3 && /^[\p{Ll}]+$/u.test(w);

/** Bỏ hết dấu thanh (giữ mũ/móc: "thiệt" ⇒ "thiêt") — kiểu quên bấm dấu. */
function boThanh(w) {
  return [...w.normalize("NFD")].filter((c) => !DAU[c]).join("").normalize("NFC");
}

/** Đổi dấu thanh sang dấu khác ("ghê" giữ, "thiệt" ⇒ "thiết"). Chữ không dấu thanh ⇒ thêm hỏi/sắc lên nguyên âm cuối. */
function nhamThanh(w, rnd) {
  const d = [...w.normalize("NFD")];
  const i = d.findIndex((c) => DAU[c]);
  if (i >= 0) {
    const khac = THANH.filter((t) => t !== d[i]);
    d[i] = khac[Math.floor(rnd() * khac.length) % khac.length];
    return d.join("").normalize("NFC");
  }
  return null;
}

/** Sót một chữ cái ở giữa ("không" ⇒ "khôg"). */
function sotChu(w, rnd) {
  const c = [...w];
  if (c.length < 4) return null;
  const i = 1 + (Math.floor(rnd() * (c.length - 2)) % (c.length - 2));
  c.splice(i, 1);
  return c.join("");
}

/** Hai chữ cái liền nhau đảo chỗ ("nghe" ⇒ "ngeh"). */
function daoChu(w, rnd) {
  const c = [...w];
  if (c.length < 4) return null;
  const i = 1 + (Math.floor(rnd() * (c.length - 2)) % (c.length - 2));
  [c[i], c[i + 1]] = [c[i + 1], c[i]];
  return c.join("");
}

/** Kéo dài chữ cuối ("ghê" ⇒ "ghêee") — kiểu cảm thán. */
function keoDai(w, rnd) {
  const c = [...w];
  const cuoi = c[c.length - 1];
  return w + cuoi.repeat(1 + (Math.floor(rnd() * 2) % 2));
}

/**
 * Lời agent ⇒ lời có (hoặc không) lỗi gõ. `kieu` = kiểu gõ của agent. Không bao giờ ném; lời rỗng trả nguyên.
 * @param {string} text
 * @param {string} kieu
 * @param {() => number} [rnd]
 * @returns {string}
 */
export function goSai(text, kieu, rnd = Math.random) {
  if (!text || rnd() >= (TI_LE_SAI[kieu] ?? 0.15)) return text;
  // tách giữ khoảng trắng + dấu câu; đánh dấu đoạn "@Tên Có Hoa" không được đụng
  const phan = text.split(/(\s+)/);
  const camChi = new Set();
  for (let i = 0; i < phan.length; i++) {
    if (!phan[i].startsWith("@")) continue;
    camChi.add(i);
    for (let k = i + 2; k < phan.length && /^\p{Lu}|^\d/u.test(phan[k]); k += 2) camChi.add(k);
  }
  const ung = [];
  for (let i = 0; i < phan.length; i += 2) {
    const m = /^([\p{L}]+)([^\p{L}]*)$/u.exec(phan[i]);
    if (m && !camChi.has(i) && duocSai(m[1]) && !/https?:|www\./i.test(phan[i])) ung.push({ i, w: m[1], duoi: m[2] });
  }
  if (!ung.length) return text;
  const soLoi = rnd() < 0.2 && ung.length > 3 ? 2 : 1;
  const daSai = new Set();
  // mỗi lỗi thử tối đa 4 lần (chữ ngắn không sót/đảo được, chữ không dấu không nhầm dấu được) ⇒ tỉ lệ sai ≈ TI_LE_SAI
  for (let n = 0, thu = 0; n < soLoi && thu < 4 * soLoi; thu++) {
    const u = ung[Math.floor(rnd() * ung.length) % ung.length];
    if (daSai.has(u.i)) continue;
    const coThanh = [...u.w.normalize("NFD")].some((c) => DAU[c]);
    const cach = [
      coThanh && kieu !== "khong-dau" ? () => boThanh(u.w) : null,
      coThanh && kieu !== "khong-dau" ? () => nhamThanh(u.w, rnd) : null,
      u.w.length >= 4 ? () => sotChu(u.w, rnd) : null,
      u.w.length >= 4 ? () => daoChu(u.w, rnd) : null,
      u.i === ung[ung.length - 1].i ? () => keoDai(u.w, rnd) : null,
    ].filter(Boolean);
    if (!cach.length) continue;
    const moi = cach[Math.floor(rnd() * cach.length) % cach.length]();
    if (!moi || moi === u.w) continue;
    phan[u.i] = moi + u.duoi;
    daSai.add(u.i);
    n++;
  }
  return phan.join("");
}
