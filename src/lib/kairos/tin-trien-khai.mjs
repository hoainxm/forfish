// TIN TRIỂN KHAI SDVICO TRÊN KAIROS (2026-10-31, anh Long gửi ảnh nhóm Zalo "Triển Khai Kinh Doanh" — giao máy lọc nước lên tàu
// Quang Hải 27: "các tin này … quảng bá cho công ty theo hướng info công ty đã triển khai … cho zalo gpu lấy thêm ở nhóm sdvico
// sản xuất-dv" · "tự đăng luôn, liên quan tiền bạc hoặc chính sách hay nhạy cảm thì mới cần duyệt" · "đừng có kịch bản đều là
// bà con ơi ??? nó nhàm dở, direct vào").
//
// Nguồn: kho ảnh thực tế của AI Assistant trên gpu-desktop (`kho-anh-thuc-te/index.json`, ảnh hai nhóm `thu_anh`) + tin chữ
// cùng nhóm trong sổ trực Zalo (`zalo/db.json › msgs`). Script `scripts/kairos-trien-khai.mjs` gom ẢNH CÙNG ĐỢT (cùng nhóm,
// cùng người gửi, cách nhau ≤ CUA_SO_MS, đợt đã xong DOI_MS) ⇒ Claude viết MỘT bài SDVICO Chính thức ⇒ POST /api/kairos/sdvico-tin.
// Bài dính tiền / chính sách / nhạy cảm ⇒ KHÔNG tự đăng: chờ anh duyệt ảnh (trang_thai "duyet" cả đợt) rồi mới đăng.
// Thuần — không fs/mạng (script đọc file, route kiểm lại `loiTin`).

export const NHOM_TIN = Object.freeze(["Triển Khai Kinh Doanh", "SDVICO Sản xuất-DV Kỹ thuật"]);
export const CUA_SO_MS = 20 * 60 * 1000;
export const DOI_MS = 15 * 60 * 1000;
export const ANH_TOI_DA = 5;
/** Trần bài tin triển khai / 24 giờ (máy chủ đếm audit `sdvico_tin`). */
export const TRAN_TIN_NGAY = 3;
const BO_QUA_SAU_MS = 7 * 24 * 60 * 60 * 1000; // ảnh cũ hơn 7 ngày không đăng thành "tin" nữa

const chuan = (s) => String(s ?? "").normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");
const laNhomTin = (n) => NHOM_TIN.some((x) => chuan(x) === chuan(n));

/**
 * Gom ảnh thành đợt. `index` = kho ảnh; `daDang` = Set id ảnh đã thuộc bài đã đăng / đợt đã xử lý. Trả đợt CŨ TRƯỚC:
 * `{ key, nhom, nguoi, ids (≤5, rải đều), tatCa, tu, den, duyet (cả đợt đã duyệt), ghiChu[] }`.
 */
export function gomDot(index, daDang, now) {
  const ds = (Array.isArray(index?.anh) ? index.anh : [])
    .filter((a) => a && /^[0-9a-f]{16}$/.test(String(a.id)) && laNhomTin(a.nhom) && a.trang_thai !== "bo" && Number.isFinite(a.at))
    .filter((a) => !daDang.has(a.id) && now - a.at < BO_QUA_SAU_MS)
    .sort((x, y) => x.at - y.at);
  const dot = [];
  for (const a of ds) {
    const d = dot.find((x) => chuan(x.nhom) === chuan(a.nhom) && x.nguoi === a.nguoi && a.at - x.den <= CUA_SO_MS);
    if (d) {
      d.tatCa.push(a);
      d.den = a.at;
    } else dot.push({ nhom: a.nhom, nguoi: a.nguoi, tu: a.at, den: a.at, tatCa: [a] });
  }
  return dot
    .filter((d) => now - d.den >= DOI_MS)
    .map((d) => {
      const n = d.tatCa.length;
      const buoc = Math.max(1, n / ANH_TOI_DA);
      const ids = [];
      for (let i = 0; i < n && ids.length < ANH_TOI_DA; i += buoc) ids.push(d.tatCa[Math.floor(i)].id);
      return {
        key: d.tatCa[0].id,
        nhom: d.nhom,
        nguoi: d.nguoi,
        ids,
        tatCa: d.tatCa.map((a) => a.id),
        tu: d.tu,
        den: d.den,
        duyet: d.tatCa.every((a) => a.trang_thai === "duyet"),
        ghiChu: d.tatCa.map((a) => String(a.ghi_chu ?? a.chu ?? "").slice(0, 200)).filter(Boolean).slice(0, 6),
      };
    });
}

/** Tin chữ cùng nhóm quanh đợt (±30 phút) từ sổ trực Zalo — bỏ "[ảnh]"/sticker, che SĐT, ≤ 12 dòng. */
export function nguCanh(msgs, dot) {
  const ds = [];
  for (const [k, arr] of Object.entries(msgs ?? {})) {
    if (chuan(k) !== chuan(dot.nhom) || !Array.isArray(arr)) continue;
    for (const m of arr) {
      const t = String(m?.text ?? "").trim();
      if (!t || /^\[(ảnh|hình|sticker|video|file)/i.test(t)) continue;
      if (!Number.isFinite(m.at) || m.at < dot.tu - 30 * 60_000 || m.at > dot.den + 30 * 60_000) continue;
      ds.push(`${String(m.sender ?? "").slice(0, 40)}: ${t.replace(/(?:\+?84|0)(?:[\s.-]?\d){8,10}/g, "[số ĐT]").slice(0, 300)}`);
    }
  }
  return ds.slice(-12);
}

/** Prompt cho Claude: một bài SDVICO Chính thức, vào thẳng, chỉ dữ kiện có trong tin/ảnh; tự gắn cờ nhạy cảm. */
export function promptTin(dot, dongTin) {
  return [
    "Bạn viết bài cho tài khoản SDVICO Chính thức trên Kairos — mạng xã hội của ngư dân Việt Nam trong app SDFish.",
    "Việc: báo một việc SDVICO VỪA TRIỂN KHAI (giao máy, lắp đặt tận tàu, xuất xưởng, bàn giao…) dựa trên ảnh đội hiện trường gửi.",
    `Nhóm nội bộ: ${dot.nhom}. Số ảnh: ${dot.tatCa.length}.`,
    `Mô tả ảnh (máy nhìn, có thể sai): ${dot.ghiChu.join(" | ") || "không có"}`,
    `Tin nhắn trong nhóm quanh lúc gửi ảnh: ${dongTin.length ? "\n- " + dongTin.join("\n- ") : "không có"}`,
    "Luật viết:",
    "- VÀO THẲNG việc đã làm. KHÔNG mở bằng 'Bà con ơi', 'Kính chào', 'Xin chào'. Câu đầu nói ngay SDVICO làm gì, ở đâu.",
    "- 2–4 câu, tiếng Việt đời thường, dưới 500 ký tự. Có thể kết bằng một câu ngắn mời bà con hỏi SDVICO.",
    "- CHỈ dùng dữ kiện có trong tin nhắn/ảnh. Không bịa số lượng, tên tàu, nơi chốn, sản phẩm nếu không thấy rõ.",
    "- KHÔNG ghi giá, số tiền, SĐT, số đăng ký tàu (kiểu BĐ-90123-TS), tên đầy đủ của khách hay nhân viên.",
    "- Không chê hàng khác, không hứa 'bảo đảm', 'tốt nhất'.",
    "- Viết ĐẦY ĐỦ, không viết tắt nội bộ: MLN = máy lọc nước biển, MLD = máy lọc dầu, GSHT = thiết bị giám sát hành trình,",
    "  KD = kinh doanh; '700L/1H' = 700 lít một giờ.",
    "Gắn nhay_cam = true nếu nội dung dính tới: tiền bạc / giá / thanh toán / nợ; chính sách, luật, cơ quan nhà nước, vi phạm, xử phạt;",
    "  tai nạn, sự cố, khiếu nại, tranh chấp; hoặc ảnh/tin không rõ là việc triển khai của SDVICO. Khi đó vẫn viết nháp.",
    "Gắn ro = false nếu KHÔNG nói được cụ thể SDVICO đã làm gì (sản phẩm nào / việc gì) — thà bỏ còn hơn đăng bài chung chung.",
    'Chỉ trả JSON: {"ro": true|false, "nhay_cam": true|false, "ly_do": "...", "bai": "..."}',
  ].join("\n");
}

const SDT = /(?:\+84|\b0)\d(?:[ .]?\d){8}\b/;
const SO_TAU = /\b[A-ZĐ][A-Za-zĐđ]{0,2}[ .-]?\d{4,6}[ .-]?TS\b/;
const TIEN = /\d[\d.,]*\s*(đ(?![\p{L}])|đồng|vnđ|vnd|triệu|tr(?![\p{L}])|nghìn|ngàn|k(?![\p{L}])|tỷ)|(^|[^\p{L}])giá(?![\p{L}])/iu;
const MO_NHAM = /^\s*(bà con ơi|kính chào|xin chào)/i;

/** Kiểm chữ bài tin triển khai (script + máy chủ). Đạt ⇒ null. Dính tiền ⇒ "co_tien" (phải qua duyệt, không tự đăng). */
export function loiTin(body) {
  const t = String(body ?? "").trim();
  if (t.length < 40 || t.length > 800) return "do_dai";
  if (SDT.test(t)) return "co_sdt";
  if (SO_TAU.test(t)) return "co_so_tau";
  if (TIEN.test(t)) return "co_tien";
  if (MO_NHAM.test(t)) return "mo_bai_nham";
  return null;
}
