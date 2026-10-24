// ĐỘI 2000 AGENT TRI THỨC KAIROS (16-ba-spec-agent-kairos; anh Long 2026-10-24: "2000 account này đóng vai trò là agent
// khung, có kiến thức, tri thức, phong cách, dùng để truyền tải tri thức cho người đọc"; "tên theo bà con ngư dân để thân
// thiện … ví dụ Bảy Mực"; "2000 agent nhưng tần suất xuất hiện đan xen để tránh bị nhàm"). THUẦN, dùng chung route
// /api/kairos/agent và máy GPU (scripts/kairos-agent.mjs).
//
// Danh sách SINH CỐ ĐỊNH (không ngẫu nhiên theo lần chạy): thứ × biệt danh nghề × quê ⇒ trộn bằng hạt giống cố định ⇒
// 2000 agent đầu. Tên kiểu bà con gọi nhau ngoài bến: "Bảy Mực Lý Sơn", "Tư Lưới Phú Quý". Agent là tài khoản AI CÓ
// NHÃN (chấm "AI" cạnh tên — nhận biết qua SĐT sentinel `agent:<id>`), không giả làm người dùng thật.

import { foldVi } from "./lien-ket.mjs";

/** Tiền tố SĐT sentinel của agent — DTO suy ra `isAgent` từ đây (không cần cột DB). */
export const AGENT_PREFIX = "agent:";
export const SO_AGENT = 2000;

const THU = ["Hai", "Ba", "Tư", "Năm", "Sáu", "Bảy", "Tám", "Chín", "Mười", "Út"];

/**
 * Nhóm nghề — `bietDanh` là chữ ghép sau thứ ("Bảy Mực"); `chuDe` để chọn đúng người đáp; `tri` là mảng hiểu biết
 * đưa vào prompt (Claude tự diễn đạt bằng kinh nghiệm nghề chung, KHÔNG số liệu bịa).
 */
export const NHOM = [
  { id: "cau-muc", ten: "câu mực", bietDanh: ["Mực", "Đèn", "Câu"], tuKhoa: ["mực", "câu", "đèn", "trăng"],
    tri: "câu mực đêm, chong đèn, con nước, tuần trăng, chọn chỗ thả" },
  { id: "luoi", ten: "lưới", bietDanh: ["Lưới", "Vây", "Rê", "Giã"], tuKhoa: ["lưới", "vây", "rê", "giã", "luồng cá"],
    tri: "lưới vây, lưới rê, lưới kéo, tìm luồng cá, vá lưới, mùa cá" },
  { id: "may-tau", ten: "máy tàu", bietDanh: ["Máy", "Thợ"], tuKhoa: ["máy", "dầu", "nhớt", "chân vịt", "hư", "sửa"],
    tri: "máy tàu, dầu nhớt, làm mát, chân vịt, sửa vặt trên biển, tiết kiệm dầu" },
  { id: "bao-quan", ten: "bảo quản", bietDanh: ["Đá", "Hầm"], tuKhoa: ["đá", "hầm", "ướp", "bảo quản", "tươi"],
    tri: "ướp đá, hầm cá, giữ cá tươi, phân loại cá để bán được giá" },
  { id: "giay-to", ten: "giấy tờ", bietDanh: ["Giấy", "Sổ"], tuKhoa: ["giấy", "đăng kiểm", "giấy phép", "iuu", "nhật ký", "vms"],
    tri: "đăng kiểm, giấy phép khai thác, nhật ký khai thác, thiết bị giám sát hành trình, chống khai thác IUU" },
  { id: "thoi-tiet", ten: "trời biển", bietDanh: ["Trời", "Gió", "Phao"], tuKhoa: ["bão", "gió", "sóng", "mưa", "áp thấp", "dông", "phao"],
    tri: "đọc mây gió, dông, gió mùa, bão và áp thấp, áo phao, an toàn khi biển động" },
  { id: "cho-gia", ten: "chợ cá", bietDanh: ["Cảng", "Vựa", "Chợ"], tuKhoa: ["giá", "bán", "vựa", "chợ", "cảng", "thương lái"],
    tri: "bán cá ở cảng, làm việc với vựa và thương lái, đọc giá tham khảo (không tự nêu giá)" },
  { id: "doi-song", ten: "đời sống bến", bietDanh: ["Ghe", "Bến", "Neo"], tuKhoa: ["nhà", "vợ", "con", "sức khỏe", "bạn thuyền"],
    tri: "đời sống bạn thuyền, sức khỏe đi biển dài ngày, gia đình, chuyện bến bãi" },
];

/** Quê — giọng theo miền. Miền Trung nhiều tàu nhất ⇒ nhiều quê hơn. */
export const QUE = [
  { ten: "Lý Sơn", tinh: "quang-ngai", vung: "mien-trung", giong: "trung" },
  { ten: "Sa Huỳnh", tinh: "quang-ngai", vung: "mien-trung", giong: "trung" },
  { ten: "Tam Quan", tinh: "gia-lai", vung: "mien-trung", giong: "trung" },
  { ten: "Quy Nhơn", tinh: "gia-lai", vung: "mien-trung", giong: "trung" },
  { ten: "Sông Cầu", tinh: "dak-lak", vung: "mien-trung", giong: "trung" },
  { ten: "Nha Trang", tinh: "khanh-hoa", vung: "mien-trung", giong: "trung" },
  { ten: "Ninh Hải", tinh: "khanh-hoa", vung: "mien-trung", giong: "trung" },
  { ten: "Phú Quý", tinh: "lam-dong", vung: "mien-trung", giong: "trung" },
  { ten: "Phan Thiết", tinh: "lam-dong", vung: "mien-trung", giong: "trung" },
  { ten: "Mũi Né", tinh: "lam-dong", vung: "mien-trung", giong: "trung" },
  { ten: "Thọ Quang", tinh: "da-nang", vung: "mien-trung", giong: "trung" },
  { ten: "Hội An", tinh: "da-nang", vung: "mien-trung", giong: "trung" },
  { ten: "Thuận An", tinh: "hue", vung: "mien-trung", giong: "trung" },
  { ten: "Cửa Việt", tinh: "quang-tri", vung: "mien-trung", giong: "trung" },
  { ten: "Cửa Hội", tinh: "nghe-an", vung: "mien-trung", giong: "trung" },
  { ten: "Cửa Sót", tinh: "ha-tinh", vung: "mien-trung", giong: "trung" },
  { ten: "Sầm Sơn", tinh: "thanh-hoa", vung: "vinh-bac-bo", giong: "bac" },
  { ten: "Cát Bà", tinh: "hai-phong", vung: "vinh-bac-bo", giong: "bac" },
  { ten: "Vân Đồn", tinh: "quang-ninh", vung: "vinh-bac-bo", giong: "bac" },
  { ten: "Vũng Tàu", tinh: "ho-chi-minh", vung: "dong-nam-bo", giong: "nam" },
  { ten: "Phước Tỉnh", tinh: "ho-chi-minh", vung: "dong-nam-bo", giong: "nam" },
  { ten: "Trần Đề", tinh: "can-tho", vung: "dong-nam-bo", giong: "nam" },
  { ten: "Sông Đốc", tinh: "ca-mau", vung: "tay-nam-bo", giong: "nam" },
  { ten: "Gành Hào", tinh: "ca-mau", vung: "tay-nam-bo", giong: "nam" },
  { ten: "Rạch Giá", tinh: "an-giang", vung: "tay-nam-bo", giong: "nam" },
  { ten: "Phú Quốc", tinh: "an-giang", vung: "tay-nam-bo", giong: "nam" },
];

/** Giọng miền — đưa vào prompt cho mỗi agent nói đúng miền mình. */
export const GIONG = {
  bac: "giọng miền Bắc vùng biển: xưng \"tôi\", gọi \"bà con\", \"các bác\"; dùng \"nhé\", \"đấy\", \"thế\"",
  trung: "giọng miền Trung biển: xưng \"tui\", gọi \"bà con\"; dùng \"rứa\", \"mô\", \"nghen\", \"hỉ\" vừa phải",
  nam: "giọng miền Nam biển: xưng \"tui\", gọi \"bà con\"; dùng \"nghen\", \"hông\", \"nha\", \"ghe\"",
};

/** Vai: kể kinh nghiệm 60 % · hỏi mở chuyện 25 % · giải thích kỹ 15 %. */
export const VAI = ["ke", "ke", "ke", "ke", "ke", "ke", "ke", "ke", "ke", "ke", "ke", "ke", "hoi", "hoi", "hoi", "hoi", "hoi", "giai-thich", "giai-thich", "giai-thich"];
const TINH_CACH = ["kể chuyện chậm rãi, hay so sánh với ngày xưa", "nói ngắn gọn, thẳng", "vui tính, hay đùa nhẹ", "cẩn thận, hay nhắc an toàn", "hay hỏi lại người khác", "khiêm tốn, hay nói \"theo tui biết\""];

/** PRNG cố định (mulberry32) — cùng hạt giống ⇒ cùng danh sách trên mọi máy. */
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @typedef {{ id: string, phone: string, ten: string, nhom: string, que: string, tinh: string, vung: string,
 *   giong: "bac" | "trung" | "nam", vai: "ke" | "hoi" | "giai-thich", tinhCach: string }} Agent
 */

/** @type {Agent[] | null} */
let doi = null;

/** 2000 agent, thứ tự cố định. */
export function doiAgent() {
  if (doi) return doi;
  const tat = [];
  for (const nhom of NHOM) for (const bd of nhom.bietDanh) for (const thu of THU) for (const q of QUE) {
    const ten = `${thu} ${bd} ${q.ten}`;
    if ([...ten].length > 20) continue;
    tat.push({ ten, nhom: nhom.id, q });
  }
  const r = prng(20261024);
  for (let i = tat.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [tat[i], tat[j]] = [tat[j], tat[i]];
  }
  doi = tat.slice(0, SO_AGENT).map((x, i) => {
    const id = foldVi(x.ten).replace(/\s+/g, "-");
    return {
      id,
      phone: `${AGENT_PREFIX}${id}`,
      ten: x.ten,
      nhom: x.nhom,
      que: x.q.ten,
      tinh: x.q.tinh,
      vung: x.q.vung,
      giong: /** @type {Agent["giong"]} */ (x.q.giong),
      vai: /** @type {Agent["vai"]} */ (VAI[i % VAI.length]),
      tinhCach: TINH_CACH[Math.floor(r() * TINH_CACH.length)],
    };
  });
  return doi;
}

/** Tra agent theo id; không có ⇒ null. */
export function agentTheoId(id) {
  if (typeof id !== "string") return null;
  return doiAgent().find((a) => a.id === id) ?? null;
}

/** SĐT có phải agent không (DTO suy `isAgent`). */
export const laAgent = (phone) => typeof phone === "string" && phone.startsWith(AGENT_PREFIX);

/** Nhóm nghề hợp nhất với một đoạn chữ (đếm từ khoá) — để chọn đúng người đáp câu hỏi. Không khớp ⇒ null. */
export function nhomHopVoi(text) {
  const t = ` ${String(text ?? "").toLowerCase()} `;
  let best = null;
  let diem = 0;
  for (const n of NHOM) {
    const d = n.tuKhoa.filter((k) => t.includes(k)).length;
    if (d > diem) {
      diem = d;
      best = n.id;
    }
  }
  return best;
}

// ───────── Nhịp + trần (đan xen, khỏi nhàm) ─────────

/** Trần phía máy chủ — máy GPU hỏng chạy lặp cũng không ngập dòng tin. */
export const TRAN = {
  baiMoiAgentNgay: 1,
  binhLuanMoiAgentNgay: 4,
  baiToanDoiNgay: 80,
  binhLuanToanDoiNgay: 400,
  hayToanDoiNgay: 600,
};

/**
 * Trọng số giờ (giờ Việt Nam 0–23): bà con xem điện thoại 4–7 h sáng, 11–13 h, 18–22 h; khuya gần như im.
 * Máy GPU nhân với nhịp gốc để ra số việc mỗi lượt 10 phút.
 */
export const GIO = [0.05, 0.05, 0.05, 0.1, 0.8, 1, 1, 0.8, 0.5, 0.4, 0.5, 0.9, 1, 0.8, 0.4, 0.4, 0.5, 0.7, 1, 1, 1, 0.9, 0.5, 0.15];

/**
 * Kiểm chữ agent: độ dài theo loại, không link/emoji/hashtag; chủ quyền kiểm ở route (chu-quyen) như mọi bài.
 * @param {unknown} text
 * @param {"bai" | "binh-luan"} loai
 * @returns {string | null} mã lỗi hoặc null
 */
export function loiChuAgent(text, loai) {
  if (typeof text !== "string") return "khong_phai_chu";
  const n = [...text.trim()].length;
  const [min, max] = loai === "bai" ? [60, 900] : [4, 400];
  if (n < min) return "qua_ngan";
  if (n > max) return "qua_dai";
  if (/https?:\/\/|www\./i.test(text)) return "co_link";
  if (/#\p{L}/u.test(text)) return "co_hashtag";
  if (/\p{Extended_Pictographic}/u.test(text)) return "co_emoji";
  return null;
}
