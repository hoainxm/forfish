// CÙNG SỰ KIỆN — hai báo đưa cùng một vụ với tiêu đề khác nhau (anh Long 2026-10-24: "đang bị trùng tin" —
// Thanh Niên "Công an tỉnh An Giang bắt nghi phạm giết người trên tàu cá" và VnExpress "Đâm đồng nghiệp tử vong
// sau vụ mất dụng cụ câu mực" cùng lên dòng tin). Chặn trùng link/tiêu đề (lien-ket.mjs) không bắt được ca này.
//
// Luật THUẦN, không cần mạng, không gọi Claude: so "vân tay" của tiêu đề + mô tả —
//   · TÊN RIÊNG: chuỗi ≥ 2 tiếng Viết Hoa liền nhau (người, nơi, tàu) — "Huỳnh Văn Đúng", "An Giang";
//   · CẶP TỪ: mọi cặp tiếng liền nhau (đã bỏ dấu) — "dung cu", "cau muc".
// Cùng sự kiện khi: chung một tên ≥ 3 tiếng (thường là tên người) và ≥ 15 % cặp từ, HOẶC chung ≥ 2 tên riêng và
// ≥ 20 % cặp từ, HOẶC ≥ 40 % cặp từ. Tỉ lệ tính trên bài NGẮN hơn (mô tả RSS dài ngắn khác nhau giữa các báo).
// Giữ bài thấy TRƯỚC (thứ tự nguồn trong kairos-nguon.json), bỏ bài sau.
// BÀI CHỈ CÓ TIÊU ĐỀ (Google News — mô tả bỏ, 2026-10-24): so riêng tiêu đề hai bên — chung một tên riêng
// (≥ 2 tiếng) và ≥ 25 % cặp từ tiêu đề, hoặc ≥ 50 % cặp từ tiêu đề. "Bắt ngư dân sát hại đồng nghiệp trên tàu cá
// ở An Giang" = "Công an tỉnh An Giang bắt nghi phạm giết người trên tàu cá"; hai bản tin bão Champi khác giờ
// (mạnh lên / suy yếu) KHÔNG gộp.

import { foldVi } from "./lien-ket.mjs";

/** Chỉ so với bài trong 48 giờ — tin cùng tên người tuần sau là chuyện khác (xử án, kỷ niệm…). */
export const SU_KIEN_CUA_SO_MS = 48 * 60 * 60 * 1000;
/** Sổ bài gần đây giữ tối đa chừng này mục (≈ 3 ngày tin của 27 nguồn). */
export const SO_GAN_DAY_TOI_DA = 3000;

const TEN_RE = /\p{Lu}[\p{Ll}\p{M}]*(?:\s+\p{Lu}[\p{Ll}\p{M}]*)+/gu;

/** Tên riêng (đã bỏ dấu, thường hoá) trong một đoạn chữ. */
export function tenRieng(text) {
  const out = new Set();
  for (const m of String(text ?? "").normalize("NFC").matchAll(TEN_RE)) {
    const f = foldVi(m[0]);
    if (f.split(" ").length >= 2) out.add(f);
  }
  return out;
}

/** Cặp tiếng liền nhau (đã bỏ dấu) của một đoạn chữ. */
export function capTu(text) {
  const w = foldVi(text).split(" ").filter(Boolean);
  const out = new Set();
  for (let i = 1; i < w.length; i++) out.add(`${w[i - 1]} ${w[i]}`);
  return out;
}

/** @param {{ title?: string, description?: string, summary?: string }} b */
export function vanTay(b) {
  const moTa = String(b.description ?? b.summary ?? "");
  const t = `${b.title ?? ""}. ${moTa}`;
  return {
    ten: tenRieng(t),
    cap: capTu(t),
    tenTd: tenRieng(b.title ?? ""),
    capTd: capTu(b.title ?? ""),
    chiTd: moTa.trim().length < 40,
  };
}

const chung = (a, b) => {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n;
};

/**
 * Hai vân tay có phải cùng một sự kiện không.
 * @param {{ ten: Set<string>, cap: Set<string> }} a
 * @param {{ ten: Set<string>, cap: Set<string> }} b
 */
export function cungSuKien(a, b) {
  if ((a.chiTd || b.chiTd) && a.capTd && b.capTd) {
    const nhoTd = Math.min(a.capTd.size, b.capTd.size);
    if (nhoTd < 4) return false;
    const tl = chung(a.capTd, b.capTd) / nhoTd;
    return tl >= 0.5 || (tl >= 0.25 && chung(a.tenTd, b.tenTd) >= 1);
  }
  const nho = Math.min(a.cap.size, b.cap.size);
  if (nho < 4) return false;
  const tiLe = chung(a.cap, b.cap) / nho;
  if (tiLe >= 0.4) return true;
  let tenDai = 0;
  let ten = 0;
  for (const x of a.ten) {
    if (!b.ten.has(x)) continue;
    ten++;
    if (x.split(" ").length >= 3) tenDai++;
  }
  return (tenDai >= 1 && tiLe >= 0.15) || (ten >= 2 && tiLe >= 0.2);
}

/**
 * Lọc bài cùng sự kiện: so với sổ gần đây (bài đã gửi lượt trước, trong SU_KIEN_CUA_SO_MS) và với nhau trong lượt.
 * Giữ bài đến trước theo thứ tự mảng.
 * @template {{ title?: string, description?: string }} T
 * @param {T[]} bai
 * @param {{ title: string, description: string, at: string }[]} ganDay
 * @param {number} now
 * @returns {{ giu: T[], trung: T[] }}
 */
export function locCungSuKien(bai, ganDay, now) {
  const da = [];
  for (const g of ganDay) {
    const t = Date.parse(g.at);
    if (Number.isFinite(t) && now - t <= SU_KIEN_CUA_SO_MS) da.push(vanTay(g));
  }
  const giu = [];
  const trung = [];
  for (const b of bai) {
    const v = vanTay(b);
    if (da.some((x) => cungSuKien(v, x))) trung.push(b);
    else {
      giu.push(b);
      da.push(v);
    }
  }
  return { giu, trung };
}

/**
 * Sổ gần đây sau lượt này: thêm bài vừa chọn, bỏ mục quá cửa sổ / hỏng, cắt về SO_GAN_DAY_TOI_DA (giữ mới nhất).
 * @param {unknown} raw
 * @param {{ title?: string, description?: string }[]} moi
 * @param {number} now
 */
export function ghiGanDay(raw, moi, now) {
  const cu = Array.isArray(raw) ? raw : [];
  const giu = cu.filter(
    (g) => g && typeof g.title === "string" && typeof g.at === "string" && now - Date.parse(g.at) <= SU_KIEN_CUA_SO_MS,
  );
  const iso = new Date(now).toISOString();
  for (const b of moi) giu.push({ title: String(b.title ?? ""), description: String(b.description ?? "").slice(0, 600), at: iso });
  return giu.slice(-SO_GAN_DAY_TOI_DA);
}
