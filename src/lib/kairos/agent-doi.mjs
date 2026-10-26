// ĐỘI 2000 AGENT TRI THỨC KAIROS (16-ba-spec-agent-kairos; anh Long 2026-10-24: "2000 account này đóng vai trò là agent
// khung, có kiến thức, tri thức, phong cách, dùng để truyền tải tri thức cho người đọc"; "tên theo bà con ngư dân để thân
// thiện … ví dụ Bảy Mực"; "2000 agent nhưng tần suất xuất hiện đan xen để tránh bị nhàm"). THUẦN, dùng chung route
// /api/kairos/agent và máy GPU (scripts/kairos-agent.mjs).
//
// Danh sách SINH CỐ ĐỊNH (không ngẫu nhiên theo lần chạy): thứ × biệt danh nghề × quê ⇒ trộn bằng hạt giống cố định ⇒
// 2000 agent đầu. `id` (và SĐT sentinel) lấy từ tổ hợp đó và GIỮ NGUYÊN mãi — đổi tên không đổi danh tính.
// TÊN HIỂN THỊ (anh Long 2026-10-24: "đặt tên random theo đúng mô hình mạng xã hội, tên bí danh, cái có nghề cái ko
// nghề, nó phải đúng như mạng xã hội"): trộn kiểu tên người Việt hay đặt trên Facebook — họ tên đầy đủ, tên kép, tên +
// năm sinh, tên + quê, gọi thân (Út/Bé), bí danh (Biển Xanh, Hải Âu…), tên không dấu, và một phần có nghề (Bảy Mực,
// Thợ Máy Hùng, Vựa Cá Lan…). Agent là tài khoản AI CÓ NHÃN (chấm "AI" cạnh tên — nhận biết qua SĐT sentinel
// `agent:<id>`), không giả làm người dùng thật.

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
// (2026-10-26) bỏ "hay nhắc an toàn", "hay nói theo tui biết", "so với ngày xưa" — chính prompt + lưới `laCauSao` cấm,
// nhãn tự mâu thuẫn làm Claude viết rồi bị bỏ (rà soát A3). Giữ đủ 6 phần tử: chỉ số PRNG không đổi.
const TINH_CACH = ["kể chuyện chậm rãi, có đầu có đuôi", "nói ngắn gọn, thẳng", "vui tính, hay đùa nhẹ", "kỹ tính, nói có lý có lẽ", "hay hỏi lại người khác", "khiêm tốn, ít khi khẳng định chắc"];

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
 * @typedef {{ id: string, phone: string, ten: string, gioi: "nam" | "nu", nhom: string, que: string, tinh: string, vung: string,
 *   giong: "bac" | "trung" | "nam", vai: "ke" | "hoi" | "giai-thich", tinhCach: string,
 *   tuoi: number, lopTuoi: "tre" | "trung-nien" | "lon-tuoi", giongDieu: string, quanTam: string[],
 *   kieuGo: "du-chu" | "tat-vua" | "tat-nhieu" | "khong-dau",
 *   viThe: string, kinhTe: string, hocVan: string, honNhan: string, coCon: boolean, chuyenNha: string[],
 *   tinNguong: string, gocNhin: string, kieuTraoDoi: string }} Agent
 */



// ───────── Chân dung: tuổi · giọng điệu · mối quan tâm · giờ hay online (anh Long 2026-10-24: "agent chia theo độ
// tuổi, già trẻ, giọng điệu, vùng miền, mối quan tâm") ─────────
/** Ba lớp tuổi; `ti` = tỉ lệ trong đội; `gio` = hệ số theo giờ VN (0–23) — trẻ hay lướt tối khuya, lớn tuổi dậy sớm. */
export const LOP_TUOI = {
  tre: { ten: "trẻ", tu: 19, den: 32, ti: 0.3,
    gio: [0.6, 0.4, 0.2, 0.1, 0.2, 0.4, 0.6, 0.7, 0.6, 0.6, 0.7, 1, 1, 0.8, 0.6, 0.6, 0.7, 0.9, 1, 1, 1, 1, 1, 0.9] },
  "trung-nien": { ten: "trung niên", tu: 33, den: 52, ti: 0.45,
    gio: [0.1, 0.05, 0.05, 0.2, 0.8, 1, 1, 0.8, 0.6, 0.5, 0.6, 1, 1, 0.8, 0.5, 0.5, 0.6, 0.8, 1, 1, 0.9, 0.7, 0.4, 0.2] },
  "lon-tuoi": { ten: "lớn tuổi", tu: 53, den: 72, ti: 0.25,
    gio: [0.05, 0.05, 0.1, 0.5, 1, 1, 1, 0.8, 0.6, 0.5, 0.6, 0.8, 0.6, 0.4, 0.4, 0.5, 0.7, 0.9, 1, 0.8, 0.5, 0.2, 0.1, 0.05] },
};
/** Giọng điệu theo tuổi — đưa vào prompt (cách nói, không phải giọng miền). */
export const GIONG_DIEU = {
  tre: ["sôi nổi, câu ngắn, hay dùng \"nha\", \"nè\", \"ok\"", "hài hước, hay trêu nhẹ, chịu khó hỏi", "nhanh nhẹn, hay rủ mọi người góp ý", "thẳng, gọn, hay chia sẻ mẹo dùng điện thoại, máy móc"],
  "trung-nien": ["thẳng thắn, thực tế, nói vào việc", "điềm đạm, rõ ràng, hay chỉ cách làm từng bước", "nhiệt tình, hay hỏi han bà con", "cẩn thận, nói chắc từng chữ"],
  "lon-tuoi": ["chậm rãi, hay đem chuyện cũ ra kể", "từ tốn, hay dặn dò lớp trẻ", "nghiêm, nói ít mà chắc", "hiền, khiêm tốn, ít khi cãi"],
};
/** Kiểu GÕ trên mạng (anh Long 2026-10-24: "văn đa dạng, social, kiểu ngôn ngữ việt nam, casual, ko AI, viết tắt
 *  theo đúng cái người hay dùng"). `ti` theo lớp tuổi — người trẻ gõ tắt, không dấu nhiều; người lớn tuổi gõ đủ chữ. */
export const KIEU_GO = {
  "du-chu": { mo: "gõ đủ chữ, có dấu, câu ngắn gọn, ít dấu chấm câu, không viết hoa đầu câu cũng được", ti: { tre: 0.1, "trung-nien": 0.35, "lon-tuoi": 0.65 } },
  "tat-vua": { mo: "gõ tắt vừa phải như người thường: ko, k, đc, r, j, mn, ae, bn, nha, nhé, thui; hay bỏ dấu chấm cuối câu", ti: { tre: 0.35, "trung-nien": 0.45, "lon-tuoi": 0.3 } },
  "tat-nhieu": { mo: "gõ tắt nhiều kiểu người trẻ: k, ko, dc, r, j, z, vs, ntn, bt, ak, ạ, nma, ơi, kk, haha, =)), :v; câu cụt, không viết hoa, đôi khi sai chính tả nhẹ", ti: { tre: 0.4, "trung-nien": 0.15, "lon-tuoi": 0 } },
  "khong-dau": { mo: "gõ KHÔNG DẤU toàn bộ (vd \"ae di bien can than nha\"), có viết tắt", ti: { tre: 0.15, "trung-nien": 0.05, "lon-tuoi": 0.05 } },
};

/** Kiểu gõ đi theo NGƯỜI: tên không dấu ⇒ phần lớn gõ không dấu; tên gọi thân / tên + năm sinh ⇒ hay gõ tắt; còn lại
 *  theo tỉ lệ lớp tuổi. Một người MỘT kiểu gõ cho cả tên, bài, bình luận — mô phỏng 2000 con người, không phải 2000 giọng. */
function kieuGoCho(kieuTen, lop, r) {
  if (kieuTen === "khong-dau") return r() < 0.8 ? "khong-dau" : "tat-nhieu";
  const nghieng = kieuTen === "goi-than" || kieuTen === "nam-sinh" ? { "tat-nhieu": 2, "tat-vua": 1.3, "du-chu": 0.5 } : kieuTen === "ho-ten" || kieuTen === "thu-nghe" ? { "du-chu": 1.4 } : {};
  return chonTrongSo(Object.keys(KIEU_GO), (k) => KIEU_GO[k].ti[lop] * (nghieng[k] ?? 1), r);
}

/** Mối quan tâm ngoài nghề — `topic` khớp chủ đề dòng tin (bài báo cùng chủ đề ⇒ người quan tâm vào bàn). */
export const QUAN_TAM = [
  { id: "an-toan-bien", ten: "an toàn trên biển, thời tiết", topic: "nghe-ca", w: { tre: 1, "trung-nien": 2, "lon-tuoi": 2 } },
  { id: "gia-ca", ten: "giá cá, chợ, làm ăn", topic: "kinh-te", w: { tre: 1, "trung-nien": 2, "lon-tuoi": 1 } },
  { id: "thoi-su", ten: "thời sự trong nước", topic: "thoi-su", w: { tre: 1, "trung-nien": 2, "lon-tuoi": 2 } },
  { id: "luat-le", ten: "luật lệ, giấy tờ, chính sách cho ngư dân", topic: "phap-luat", w: { tre: 0.5, "trung-nien": 2, "lon-tuoi": 1 } },
  { id: "bong-da", ten: "bóng đá, thể thao", topic: "the-thao", w: { tre: 3, "trung-nien": 2, "lon-tuoi": 0.7 } },
  { id: "giai-tri", ten: "phim, ca nhạc, chuyện vui", topic: "giai-tri", w: { tre: 2.5, "trung-nien": 0.8, "lon-tuoi": 0.4 } },
  { id: "gia-dinh", ten: "con cái, học hành, gia đình", topic: "doi-song", w: { tre: 0.6, "trung-nien": 2.5, "lon-tuoi": 1.5 } },
  { id: "suc-khoe", ten: "sức khỏe, thuốc men", topic: "doi-song", w: { tre: 0.4, "trung-nien": 1, "lon-tuoi": 2.5 } },
  { id: "chuyen-xua", ten: "chuyện xưa, lễ hội làng chài, cúng Ông", topic: "doi-song", w: { tre: 0.3, "trung-nien": 0.8, "lon-tuoi": 2.5 } },
  { id: "cong-nghe", ten: "điện thoại, máy định vị, mạng", topic: null, w: { tre: 3, "trung-nien": 1, "lon-tuoi": 0.3 } },
  { id: "may-moc", ten: "máy móc, sửa chữa", topic: null, w: { tre: 1.5, "trung-nien": 1.5, "lon-tuoi": 0.8 } },
];
/** Chọn có trọng số. */
function chonTrongSo(xs, w, r) {
  const tong = xs.reduce((s, x) => s + w(x), 0);
  let k = r() * tong;
  for (const x of xs) if ((k -= w(x)) < 0) return x;
  return xs[xs.length - 1];
}
/** Lớp tuổi theo tỉ lệ đội; người trông vựa/đời sống bến nghiêng trung niên–lớn tuổi, máy tàu nghiêng trẻ. */
function lopTuoiCho(nhom, r) {
  const nghieng = { "may-tau": { tre: 1.6 }, "cho-gia": { "lon-tuoi": 1.3 }, "doi-song": { "lon-tuoi": 1.4 }, "giay-to": { "trung-nien": 1.3 } }[nhom] ?? {};
  return chonTrongSo(Object.keys(LOP_TUOI), (k) => LOP_TUOI[k].ti * (nghieng[k] ?? 1), r);
}
/** 2–3 mối quan tâm, không trùng, theo trọng số tuổi. */
function quanTamCho(lop, r) {
  const n = r() < 0.5 ? 2 : 3;
  const con = [...QUAN_TAM];
  const out = [];
  while (out.length < n && con.length) {
    const x = chonTrongSo(con, (q) => q.w[lop], r);
    out.push(x.id);
    con.splice(con.indexOf(x), 1);
  }
  return out;
}

// ───────── ĐỜI TƯ + GÓC NHÌN NGHỀ (anh Long 2026-10-26: "tạo 1 sân chơi cho bà con vô, được nhìn ở các góc khác nhau
// giúp bà con thấu hiểu nghề và giúp họ sống tốt hơn, vừa có đời tư vừa có góc nhìn nghề … tổ chức tối thiểu 2000").
// Mỗi agent là một NHÂN VẬT AI trọn vẹn: chỗ đứng trong nghề, kinh tế, học vấn, gia cảnh + chuyện nhà, tín ngưỡng, góc
// nhìn về nghề, kiểu trao đổi. Sinh bằng PRNG RIÊNG (hạt khác) ⇒ tên, tuổi, kiểu gõ… của 2000 người cũ GIỮ NGUYÊN.
// Trục nào cũng phải đổi HÀNH VI (điều phối chọn ai nói, nói thế nào — agent-dieu-phoi), không chỉ là nhãn trong prompt.

/** Chỗ đứng trong cộng đồng nghề — mỗi chỗ một góc nhìn (chủ tàu lo vốn, bạn thuyền lo công, nậu lo giá…).
 *  `w(a)` trọng số theo nhóm nghề / tuổi / giới; `kt` nghiêng kinh tế. */
export const VI_THE = [
  { id: "chu-tau", ten: "chủ tàu xa bờ", lo: "vốn, tiền dầu, giữ bạn thuyền, chuyến lời hay lỗ", kt: { "kha-gia": 2, "no-nan": 1.5 },
    w: (a) => (a.gioi === "nu" ? 0.05 : a.lop === "tre" ? 0.2 : 1) * (["luoi", "cau-muc", "thoi-tiet", "giay-to"].includes(a.nhom) ? 1.5 : 0.5) },
  { id: "chu-ghe", ten: "chủ ghe nhỏ ven bờ", lo: "con nước, thời tiết từng ngày, đủ ăn qua mùa", kt: { "du-an": 2, "chat-vat": 1.5 },
    w: (a) => (a.gioi === "nu" ? 0.1 : 1) * (["cau-muc", "luoi", "doi-song"].includes(a.nhom) ? 1.5 : 0.6) },
  { id: "tai-cong", ten: "thuyền trưởng, tài công", lo: "an toàn cả tàu, đọc trời, tìm luồng cá", kt: { "du-an": 2, "kha-gia": 1 },
    w: (a) => (a.gioi === "nu" ? 0 : a.lop === "tre" ? 0.4 : 1) * (["thoi-tiet", "luoi", "cau-muc"].includes(a.nhom) ? 1.8 : 0.4) },
  { id: "ban-thuyen", ten: "bạn thuyền đi làm công, ăn chia", lo: "tiền công, chia phần, sức khỏe, xa nhà", kt: { "chat-vat": 2, "du-an": 1.5, "no-nan": 0.5 },
    w: (a) => (a.gioi === "nu" ? 0 : a.lop === "lon-tuoi" ? 0.4 : 1.4) * (["luoi", "cau-muc", "bao-quan", "doi-song"].includes(a.nhom) ? 1.5 : 0.6) },
  { id: "tho-may", ten: "thợ máy tàu", lo: "máy móc, phụ tùng, dầu nhớt, sửa trên biển", kt: { "du-an": 2 },
    w: (a) => (a.gioi === "nu" ? 0 : 1) * (a.nhom === "may-tau" ? 4 : 0.1) },
  { id: "nau-vua", ten: "nậu vựa, thương lái mua cá", lo: "giá, đầu ra, công nợ với tàu", kt: { "kha-gia": 1.5, "du-an": 1.5, "no-nan": 0.5 },
    w: (a) => (a.lop === "tre" ? 0.4 : 1) * (a.nhom === "cho-gia" ? 4 : a.nhom === "bao-quan" ? 1.2 : 0.05) },
  { id: "vo-ngu-dan", ten: "vợ ngư dân, buôn bán ở bến", lo: "chồng đi biển an toàn, chợ búa, tiền học con", kt: { "du-an": 2, "chat-vat": 1.5 },
    w: (a) => (a.gioi === "nu" ? 3 : 0) },
  { id: "con-ngu-dan", ten: "con nhà ngư dân, đi học hoặc đi làm xa", lo: "cha mẹ đi biển, chuyện học, chuyện việc làm", kt: { "du-an": 1.5, "chat-vat": 1.5 },
    w: (a) => (a.lop === "tre" ? (a.gioi === "nu" ? 2 : 0.8) : 0) },
  { id: "nghi-bien", ten: "ngư dân đã nghỉ biển", lo: "con cháu nối nghề, sức khỏe, chuyện cũ", kt: { "du-an": 2, "chat-vat": 1 },
    w: (a) => (a.lop === "lon-tuoi" ? 1.5 : 0) * (a.gioi === "nu" ? 0.2 : 1) },
  { id: "to-doan-ket", ten: "người trong tổ đoàn kết, hội nghề cá", lo: "giấy tờ, chính sách, bà con giúp nhau trên biển", kt: { "du-an": 2, "kha-gia": 1 },
    w: (a) => (a.lop === "tre" ? 0.1 : 1) * (a.nhom === "giay-to" ? 3 : 0.15) },
  { id: "tiem-nghe", ten: "chủ tiệm ngư cụ, xưởng sửa tàu", lo: "hàng hóa, khách quen, mùa vụ", kt: { "kha-gia": 1.5, "du-an": 1.5 },
    w: (a) => (a.lop === "tre" ? 0.3 : 1) * (["may-tau", "bao-quan", "luoi"].includes(a.nhom) ? 1 : 0.1) },
  { id: "nguoi-moi", ten: "mới vào nghề, đang học việc", lo: "học nghề, sợ sai, hỏi nhiều", kt: { "chat-vat": 2, "du-an": 1 },
    w: (a) => (a.lop === "tre" ? 1.2 : 0) * (a.gioi === "nu" ? 0.2 : 1) },
];

/** Kinh tế — đổi cách nói (người chật vật hay than giá dầu, người khá giả bàn chuyện đầu tư). */
export const KINH_TE = {
  "kha-gia": "làm ăn khá, có của ăn của để",
  "du-an": "đủ ăn, không dư dả",
  "chat-vat": "chật vật, làm ngày nào biết ngày đó",
  "no-nan": "đang gánh nợ (vay đóng tàu, vay làm ăn)",
};

/** Học vấn — đổi vốn từ: ít học nói chữ đơn giản, quen tai; học cao dùng được vài từ mới nhưng vẫn đời thường. */
export const HOC_VAN = {
  "cap-1-2": { ten: "học hết cấp 1, cấp 2", mo: "câu đơn giản, chữ quen miệng, không dùng từ Hán Việt khó", w: { tre: 0.4, "trung-nien": 1.6, "lon-tuoi": 2.4 } },
  "cap-3": { ten: "học hết cấp 3", mo: "nói bình thường, rõ ý", w: { tre: 1.6, "trung-nien": 1, "lon-tuoi": 0.4 } },
  "nghe": { ten: "học trung cấp, học nghề", mo: "rành chữ chuyên môn của nghề mình, giải thích được", w: { tre: 0.8, "trung-nien": 0.5, "lon-tuoi": 0.15 } },
  "dai-hoc": { ten: "học cao đẳng, đại học", mo: "dùng được vài từ mới, hay tra cứu, nhưng vẫn nói kiểu người bến", w: { tre: 0.6, "trung-nien": 0.15, "lon-tuoi": 0.05 } },
};

/** Tình trạng gia đình theo tuổi. */
const HON_NHAN = {
  tre: [["doc-than", 3], ["moi-cuoi", 1.5], ["co-gia-dinh", 1]],
  "trung-nien": [["co-gia-dinh", 6], ["doc-than", 0.4], ["ly-hon", 0.4], ["goa", 0.2]],
  "lon-tuoi": [["co-gia-dinh", 5], ["goa", 1.2], ["ly-hon", 0.2]],
};
export const HON_NHAN_TEN = { "doc-than": "chưa vợ / chưa chồng", "moi-cuoi": "mới lập gia đình", "co-gia-dinh": "có gia đình", "ly-hon": "đã ly hôn", "goa": "vợ / chồng đã mất" };

/** Chuyện nhà — mỗi agent 2 chuyện hợp hồ sơ (`dk`), để kể đời tư nhất quán, không bịa trái hồ sơ. */
const CHUYEN_NHA = [
  { c: "con lớn đang học đại học trên thành phố, lo tiền học", dk: (a) => a.tuoi >= 42 && a.coCon },
  { c: "con nhỏ mới vào lớp 1", dk: (a) => a.tuoi >= 26 && a.tuoi <= 42 && a.coCon },
  { c: "có đứa con đi xuất khẩu lao động", dk: (a) => a.tuoi >= 45 && a.coCon },
  { c: "vừa có cháu nội, cháu ngoại", dk: (a) => a.tuoi >= 50 && a.coCon },
  { c: "lo con mải chơi điện thoại, lười học", dk: (a) => a.tuoi >= 32 && a.tuoi <= 55 && a.coCon },
  { c: "mẹ già ở nhà hay đau lưng, đau khớp", dk: (a) => a.tuoi <= 55 },
  { c: "nhà vừa sửa lại mái sau mùa bão", dk: () => true },
  { c: "anh em trong nhà đều theo nghề biển", dk: () => true },
  { c: "nuôi thêm mấy con heo, con gà cho có đồng ra đồng vào", dk: (a) => a.kinhTe !== "kha-gia" },
  { c: "đang trả nợ ngân hàng vay đóng tàu", dk: (a) => a.viThe === "chu-tau" && a.kinhTe === "no-nan" },
  { c: "đang dành dụm để mua chiếc ghe riêng", dk: (a) => ["ban-thuyen", "nguoi-moi", "tho-may"].includes(a.viThe) },
  { c: "từng đi làm khu công nghiệp rồi quay về biển", dk: (a) => a.tuoi <= 45 && a.viThe !== "vo-ngu-dan" },
  { c: "chồng đi biển dài ngày, ở nhà một mình lo con", dk: (a) => a.viThe === "vo-ngu-dan" && a.honNhan === "co-gia-dinh" },
  { c: "mới cưới, đang tính chuyện ra riêng", dk: (a) => a.honNhan === "moi-cuoi" },
  { c: "đang có bạn gái / bạn trai ở xóm bên", dk: (a) => a.honNhan === "doc-than" && a.tuoi <= 32 },
  { c: "nghỉ biển vì đau khớp, giờ ở nhà vá lưới phụ con", dk: (a) => a.viThe === "nghi-bien" },
  { c: "sống với con trai út từ ngày vợ / chồng mất", dk: (a) => a.honNhan === "goa" },
  { c: "nuôi con một mình sau khi ly hôn", dk: (a) => a.honNhan === "ly-hon" && a.coCon },
  { c: "bỏ được thuốc lá hơn nửa năm nay", dk: (a) => a.gioi === "nam" && a.tuoi >= 25 },
  { c: "mê nuôi chim, trồng cây kiểng lúc rảnh", dk: (a) => a.tuoi >= 45 },
  { c: "chiều nào rảnh cũng đá banh với anh em trong xóm", dk: (a) => a.tuoi <= 35 && a.gioi === "nam" },
  { c: "đang học thi bằng thuyền trưởng", dk: (a) => a.tuoi <= 40 && a.gioi === "nam" && ["ban-thuyen", "tai-cong", "nguoi-moi"].includes(a.viThe) },
  { c: "đang học đại học, hè về phụ cha mẹ", dk: (a) => a.viThe === "con-ngu-dan" && a.tuoi <= 24 },
  { c: "đi làm trên thành phố, lâu lâu mới về quê", dk: (a) => a.viThe === "con-ngu-dan" && a.tuoi > 22 },
  { c: "cả nhà sống nhờ cái vựa nhỏ ở bến", dk: (a) => a.viThe === "nau-vua" },
  { c: "bán cá ở chợ từ hồi con gái", dk: (a) => a.viThe === "vo-ngu-dan" && a.tuoi >= 35 },
  { c: "hay nấu cơm cho cả tàu mỗi chuyến", dk: (a) => a.viThe === "ban-thuyen" },
];

/** Tín ngưỡng theo vùng (Phước Tỉnh làng Công giáo); thờ cá Ông phổ biến từ miền Trung vào Nam. */
const TIN_NGUONG = {
  "mien-trung": [["thờ cá Ông, đi lễ Cầu Ngư", 4], ["theo đạo Phật, thờ ông bà", 2], ["theo đạo Công giáo", 0.5], ["thờ ông bà, không theo đạo", 1.5]],
  "vinh-bac-bo": [["thờ ông bà, đi lễ đình làng", 3], ["theo đạo Phật", 1.5], ["theo đạo Công giáo", 0.7]],
  "dong-nam-bo": [["thờ cá Ông, đi lễ Nghinh Ông", 3], ["theo đạo Phật", 2], ["theo đạo Công giáo", 1.5], ["thờ ông bà, không theo đạo", 1]],
  "tay-nam-bo": [["thờ cá Ông, đi lễ Nghinh Ông", 3], ["theo đạo Phật", 2], ["thờ ông bà, không theo đạo", 1.5], ["theo đạo Cao Đài", 0.4]],
};

/** Góc nhìn về NGHỀ — chỗ các agent khác nhau một cách lành mạnh, để bà con thấy một chuyện từ nhiều phía. */
export const GOC_NHIN = [
  { id: "truyen-thong", ten: "tin kinh nghiệm, con nước, mắt nhìn hơn máy móc", w: { tre: 0.3, "trung-nien": 1, "lon-tuoi": 2.5 } },
  { id: "cong-nghe", ten: "mê công nghệ: định vị, máy dò cá, app trên điện thoại", w: { tre: 2.5, "trung-nien": 1, "lon-tuoi": 0.2 } },
  { id: "giu-nguon-loi", ten: "lo cá cạn dần, muốn giữ nguồn lợi, ghét đánh bắt tận diệt", w: { tre: 1, "trung-nien": 1, "lon-tuoi": 1.5 } },
  { id: "thuc-te", ten: "thực tế: đủ tiền dầu, đủ công bạn thuyền là trên hết", w: { tre: 0.8, "trung-nien": 2, "lon-tuoi": 1 } },
  { id: "ep-gia", ten: "bức xúc chuyện bị ép giá, mong bán thẳng, bán được giá", w: { tre: 0.8, "trung-nien": 1.5, "lon-tuoi": 1 } },
  { id: "an-toan", ten: "an toàn trên hết, thà nằm bờ còn hơn liều", w: { tre: 0.5, "trung-nien": 1.2, "lon-tuoi": 1.8 } },
  { id: "cho-con-hoc", ten: "muốn con cái học hành, khỏi khổ như mình", w: { tre: 0.2, "trung-nien": 2, "lon-tuoi": 1.5 } },
  { id: "tu-hao", ten: "tự hào nghề biển, bám biển là giữ biển", w: { tre: 1, "trung-nien": 1.2, "lon-tuoi": 1.5 } },
  { id: "chuyen-nghe", ten: "tính chuyện chuyển hướng: nuôi trồng, làm du lịch, làm dịch vụ", w: { tre: 1.5, "trung-nien": 0.8, "lon-tuoi": 0.2 } },
  { id: "dung-luat", ten: "làm đúng giấy tờ, đúng luật cho yên tâm, chống IUU là cho mình", w: { tre: 0.6, "trung-nien": 1.3, "lon-tuoi": 0.8 } },
];

/**
 * KIỂU TRAO ĐỔI — vai trên mạng xã hội, ĐỔI HÀNH VI: `noi` = hệ số được chọn viết (người ít nói chủ yếu bấm Hay),
 * `hay` = hệ số bấm Hay, `the` = trọng số THẾ khi bình luận (agent-dieu-phoi.theCho), `ru` = hệ số rủ bạn "@Tên".
 */
export const KIEU_TRAO_DOI = {
  "ke-chuyen": { ten: "hay kể chuyện", noi: 1.3, hay: 1, ru: 1, the: { ke: 4, "dong-y": 1, "hoi-lai": 1 } },
  "hay-hoi": { ten: "hay hỏi, tò mò", noi: 1.1, hay: 1, ru: 1, the: { "hoi-lai": 4, "dong-y": 1, ke: 1 } },
  "hay-cai": { ten: "hay cãi lý, thích nói ngược cho ra lẽ", noi: 1.2, hay: 0.6, ru: 0.6, the: { "phan-bien": 4, "hoi-lai": 1.5, ke: 1 } },
  "hoa-giai": { ten: "hay dàn hòa, gom ý hai bên", noi: 1, hay: 1.2, ru: 1, the: { "hoa-giai": 3, "dong-y": 1.5, ke: 1 } },
  "hay-dua": { ten: "hay đùa, chọc cười", noi: 1.2, hay: 1.3, ru: 1.5, the: { dua: 4, "dong-y": 1, "hoi-lai": 1 } },
  "dong-vien": { ten: "hay động viên, an ủi người khác", noi: 1, hay: 1.6, ru: 1, the: { "an-ui": 3, "dong-y": 2, ke: 1 } },
  "hay-than": { ten: "hay than thở chuyện làm ăn", noi: 1, hay: 0.8, ru: 0.7, the: { than: 3, "dong-y": 1.5, ke: 1 } },
  "it-noi": { ten: "ít nói, chủ yếu đọc và bấm Hay", noi: 0.25, hay: 3, ru: 0.3, the: { "dong-y": 3, "hoi-lai": 1 } },
  "ket-noi": { ten: "hay rủ rê, gọi tên người khác vào", noi: 1.1, hay: 1.2, ru: 3, the: { "dong-y": 1.5, "hoi-lai": 1.5, ke: 1.5 } },
};

/** Chọn [giá trị, trọng số] theo trọng số. */
const chonCap = (cap, r) => chonTrongSo(cap, (x) => x[1], r)[0];

/** Đời tư + góc nhìn của một agent (đã có nhom, lop, tuoi, gioi, vung) — `r` là PRNG riêng (không đụng PRNG tên). */
/** Tên mang nghề ("Năm Máy", "Vựa Cá Lan") ⇒ chỗ đứng khớp nghề trong tên, không làm "con đi học xa". */
const VI_THE_THEO_NGHE = { "may-tau": "tho-may", "cho-gia": "nau-vua", "giay-to": "to-doan-ket", "thoi-tiet": "tai-cong", "bao-quan": "tiem-nghe" };
const TEN_CO_NGHE = new Set(["thu-nghe", "nghe-ten", "ten-nghe"]);

function doiTuCho(a, r) {
  const vao = { nhom: a.nhom, lop: a.lopTuoi, gioi: a.gioi };
  const coNghe = TEN_CO_NGHE.has(a.kieuTen);
  const vt = chonTrongSo(VI_THE, (v) => v.w(vao) * (coNghe ? (v.id === "con-ngu-dan" ? 0 : v.id === VI_THE_THEO_NGHE[a.nhom] ? 6 : 1) : 1), r);
  const kinhTe = chonTrongSo(Object.keys(KINH_TE), (k) => vt.kt[k] ?? 0.2, r);
  const hocVan = chonTrongSo(Object.keys(HOC_VAN), (k) => HOC_VAN[k].w[a.lopTuoi] * (vt.id === "con-ngu-dan" && k === "dai-hoc" ? 4 : 1), r);
  const honNhan = vt.id === "con-ngu-dan" ? "doc-than" : vt.id === "vo-ngu-dan" && a.lopTuoi !== "lon-tuoi" ? "co-gia-dinh" : chonCap(HON_NHAN[a.lopTuoi], r);
  const coCon = honNhan !== "doc-than" && (honNhan !== "moi-cuoi" || r() < 0.3) && a.tuoi >= 22;
  const tam = { ...a, viThe: vt.id, kinhTe, honNhan, coCon };
  const hop = CHUYEN_NHA.filter((x) => x.dk(tam));
  const chuyenNha = [];
  while (chuyenNha.length < 2 && hop.length) chuyenNha.push(hop.splice(Math.floor(r() * hop.length), 1)[0].c);
  const tinNguong = a.que === "Phước Tỉnh" && r() < 0.8 ? "theo đạo Công giáo" : chonCap(TIN_NGUONG[a.vung], r);
  const gocNhin = chonTrongSo(GOC_NHIN, (g) => g.w[a.lopTuoi] * (g.id === "ep-gia" && vt.id === "nau-vua" ? 0 : 1), r).id;
  const kieuTraoDoi = chonTrongSo(Object.keys(KIEU_TRAO_DOI), (k) => (k === "it-noi" ? 1.6 : 1), r);
  return { viThe: vt.id, kinhTe, hocVan, honNhan, coCon, chuyenNha, tinNguong, gocNhin, kieuTraoDoi };
}

// ───────── Tên hiển thị kiểu mạng xã hội ─────────
const HO = ["Nguyễn", "Trần", "Lê", "Phạm", "Huỳnh", "Hoàng", "Võ", "Phan", "Vũ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý",
  "Đinh", "Trương", "Lâm", "Mai", "Cao", "Đoàn", "Tô", "Châu", "Lương", "Tạ", "Thái", "Quách"];
const DEM_NAM = ["Văn", "Hữu", "Minh", "Thanh", "Quốc", "Đức", "Công", "Ngọc", "Xuân", "Tấn", "Thành", "Hoàng", "Đình", "Bá"];
const DEM_NU = ["Thị", "Ngọc", "Thanh", "Thu", "Kim", "Mỹ", "Bích", "Hồng", "Diệu", "Thúy", "Phương", "Bảo"];
const TEN_NAM = ["Hùng", "Dũng", "Tuấn", "Hải", "Long", "Nam", "Phong", "Sơn", "Tâm", "Thắng", "Tài", "Lộc", "Phúc", "Hiếu",
  "Trung", "Hòa", "Bình", "Lợi", "Cường", "Toàn", "Khánh", "Vinh", "Quang", "Đạt", "Nhân", "Thịnh", "Tín", "Hậu", "Trí",
  "Duy", "Hưng", "Tú", "Kiên", "Lực", "Mạnh", "Nghĩa", "Phát", "Sang", "Thuận", "Tùng", "Vũ", "Khoa", "Luân", "Đông"];
const TEN_NU = ["Mai", "Lan", "Hoa", "Hằng", "Hương", "Thảo", "Trang", "Nhung", "Hiền", "Liên", "Yến", "Thủy", "Ngân", "Linh",
  "Vy", "Hạnh", "Diễm", "Phượng", "Loan", "Oanh", "Tuyết", "Hồng", "Nga", "My", "Ly", "Thư", "Nhi", "Trinh", "Duyên", "Xuân"];
const TEN_KEP_NAM = ["Tuấn Anh", "Hoàng Long", "Quốc Bảo", "Đức Huy", "Gia Huy", "Minh Tâm", "Văn Tú", "Hải Đăng", "Thành Đạt",
  "Minh Quân", "Trọng Nghĩa", "Quang Vinh", "Hữu Phước", "Tấn Lộc", "Anh Khoa", "Hoài Nam", "Phúc Hậu", "Duy Khánh"];
const TEN_KEP_NU = ["Minh Châu", "Thanh Hằng", "Ngọc Ánh", "Bảo Ngọc", "Thu Hà", "Kim Ngân", "Mỹ Linh", "Hải Yến", "Phương Thảo",
  "Thanh Thúy", "Ngọc Hân", "Diễm My", "Bích Trâm", "Hồng Nhung", "Thu Trang", "Kiều Oanh", "Mỹ Duyên", "Cẩm Tú"];
const BI_DANH = ["Biển Xanh", "Gió Chướng", "Sóng Bạc Đầu", "Hải Âu", "Cánh Buồm Nâu", "Trăng Biển", "Mây Trắng", "Muối Mặn",
  "Cát Trắng", "Sao Biển", "Gió Nồm", "Nắng Chiều", "Bình Minh Biển", "Phố Biển", "Lãng Tử Biển", "Hạt Muối", "Con Nước",
  "Đèn Biển", "Mũi Thuyền", "Sóng Vỗ", "Gió Bấc", "Chân Trời", "Bọt Biển", "Hoàng Hôn", "Tàu Lạc", "Ngọn Hải Đăng",
  "Kẻ Đi Biển", "Dân Chài", "Người Miền Biển", "Gió Lộng"];
const GOI_THAN_NAM = ["Út", "Cu", "Tèo", "Bin", "Tí", "Bờm"];
const GOI_THAN_NU = ["Út", "Bé", "Mít", "Tí"];
// Có nghề: theo nhóm của agent (khớp kiến thức nó nói).
const NGHE_TIEN_TO = {
  "cau-muc": ["Câu Mực", "Mực Lý Sơn", "Ghe Mực"], luoi: ["Lưới Vây", "Lưới Rê", "Ghe Lưới"],
  "may-tau": ["Thợ Máy", "Máy Tàu"], "bao-quan": ["Đá Cây", "Hầm Đá"], "giay-to": ["Đăng Kiểm", "Sổ Tàu"],
  "thoi-tiet": ["Tài Công", "Thuyền Trưởng"], "cho-gia": ["Vựa Cá", "Nậu", "Cá Tươi"], "doi-song": ["Vợ Ghe", "Ghe Bến"],
};
const NGHE_NU = { "cho-gia": ["Vựa Cá", "Cá Tươi"], "doi-song": ["Vợ Ghe"], "bao-quan": ["Đá Cây"], "giay-to": ["Đăng Kiểm"] };
const NAM_NAY = 2026;
const KHONG_DAU = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");

/** Một tên hiển thị cho agent — r() là PRNG riêng của agent (cố định). Kiểu tên khớp tuổi: trẻ hay đặt bí danh,
 *  gọi thân, tên + năm sinh, không dấu; lớn tuổi hay để họ tên đầy đủ, thứ + nghề. Năm sinh trong tên = đúng tuổi. */
function sinhTen(r, a) {
  const chon = (xs) => xs[Math.floor(r() * xs.length)];
  const nu = r() < (a.nhom === "cho-gia" || a.nhom === "doi-song" ? 0.55 : 0.22);
  const ho = chon(HO), dem = chon(nu ? DEM_NU : DEM_NAM), ten = chon(nu ? TEN_NU : TEN_NAM), kep = chon(nu ? TEN_KEP_NU : TEN_KEP_NAM);
  const nam = String((NAM_NAY - a.tuoi) % 100).padStart(2, "0");
  /** [kiểu, trọng số trẻ, trung niên, lớn tuổi] */
  const KIEU = [["ho-ten", 1, 2.5, 3.5], ["kep", 1.6, 1.2, 0.6], ["nam-sinh", 1.6, 0.8, 0.2], ["que", 0.8, 1, 1.2], ["goi-than", 1.4, 0.3, 0],
    ["bi-danh", 1.6, 0.8, 0.3], ["khong-dau", 0.8, 0.4, 0.1], ["thu-nghe", 0.4, 1.2, 2.2], ["nghe-ten", 0.8, 1.4, 1], ["ten-nghe", 0.5, 0.6, 0.4]];
  const cot = { tre: 1, "trung-nien": 2, "lon-tuoi": 3 }[a.lop];
  let k = chonTrongSo(KIEU, (x) => x[cot], r)[0];
  // Nữ mà "thứ + nghề" chỉ hợp nghề phụ nữ hay làm ở bến (bà Tư chợ, chị Ba đá) — không "Mười Thợ", "Bảy Lưới" nữ.
  if (nu && (k === "thu-nghe" || k === "ten-nghe") && !["cho-gia", "doi-song", "bao-quan"].includes(a.nhom)) k = "ho-ten";
  let t;
  if (k === "ho-ten") t = `${ho} ${dem} ${ten}`;
  else if (k === "kep") t = kep;
  else if (k === "nam-sinh") t = `${chon([ten, kep])} ${nam}`;
  else if (k === "que") t = `${ten} ${a.que}`;
  else if (k === "goi-than") t = `${chon(nu ? GOI_THAN_NU : GOI_THAN_NAM)} ${ten}`;
  else if (k === "bi-danh") t = r() < 0.5 ? chon(BI_DANH) : `${chon(BI_DANH)} ${a.que}`;
  else if (k === "khong-dau") t = KHONG_DAU(r() < 0.5 ? `${ho} ${dem} ${ten}` : `${kep} ${nam}`);
  else if (k === "thu-nghe") t = `${chon(THU)} ${a.bietDanh}`;
  else if (k === "nghe-ten") t = `${chon(nu ? NGHE_NU[a.nhom] ?? ["Cá Tươi"] : NGHE_TIEN_TO[a.nhom])} ${ten}`;
  else t = `${ten} ${chon(NGHE_TIEN_TO[a.nhom])}`;
  return { ten: t, gioi: nu ? "nu" : "nam", kieuTen: k };
}

/** @type {Agent[] | null} */
let doi = null;

/** 2000 agent, thứ tự cố định. */
export function doiAgent() {
  if (doi) return doi;
  const tat = [];
  for (const nhom of NHOM) for (const bd of nhom.bietDanh) for (const thu of THU) for (const q of QUE) {
    const ten = `${thu} ${bd} ${q.ten}`;
    if ([...ten].length > 20) continue;
    tat.push({ ten, nhom: nhom.id, bietDanh: bd, q });
  }
  const r = prng(20261024);
  for (let i = tat.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [tat[i], tat[j]] = [tat[j], tat[i]];
  }
  const daCo = new Set();
  doi = tat.slice(0, SO_AGENT).map((x, i) => {
    // id + SĐT từ tổ hợp gốc ("bay-muc-ly-son") — GIỮ NGUYÊN, hồ sơ/bài cũ vẫn gắn đúng agent.
    const id = foldVi(x.ten).replace(/\s+/g, "-");
    const rt = prng(20261024 ^ (i * 2654435761));
    const lop = lopTuoiCho(x.nhom, rt);
    const tuoi = LOP_TUOI[lop].tu + Math.floor(rt() * (LOP_TUOI[lop].den - LOP_TUOI[lop].tu + 1));
    const vao = { nhom: x.nhom, bietDanh: x.bietDanh, que: x.q.ten, lop, tuoi };
    let t = sinhTen(rt, vao);
    for (let k = 0; k < 40 && ([...t.ten].length > 20 || daCo.has(foldVi(t.ten))); k++) t = sinhTen(rt, vao);
    if ([...t.ten].length > 20 || daCo.has(foldVi(t.ten))) t = { ten: `${t.ten.slice(0, 14)} ${i}`.replace(/\s+/g, " ").trim(), gioi: t.gioi };
    daCo.add(foldVi(t.ten));
    const giongDieu = GIONG_DIEU[lop][Math.floor(rt() * GIONG_DIEU[lop].length)];
    const quanTam = quanTamCho(lop, rt);
    const kieuGo = kieuGoCho(t.kieuTen, lop, rt);
    // đời tư + góc nhìn: PRNG riêng, chạy SAU mọi bước cũ ⇒ không đổi tên/tuổi/kiểu gõ đã có
    const doiTu = doiTuCho({ nhom: x.nhom, lopTuoi: lop, tuoi, gioi: t.gioi, vung: x.q.vung, que: x.q.ten, kieuTen: t.kieuTen }, prng(20261026 ^ (i * 2246822519)));
    return {
      id,
      phone: `${AGENT_PREFIX}${id}`,
      ten: t.ten,
      gioi: /** @type {"nam" | "nu"} */ (t.gioi),
      nhom: x.nhom,
      que: x.q.ten,
      tinh: x.q.tinh,
      vung: x.q.vung,
      giong: /** @type {Agent["giong"]} */ (x.q.giong),
      vai: /** @type {Agent["vai"]} */ (VAI[i % VAI.length]),
      tinhCach: TINH_CACH[Math.floor(r() * TINH_CACH.length)],
      tuoi,
      lopTuoi: /** @type {Agent["lopTuoi"]} */ (lop),
      giongDieu,
      quanTam,
      kieuGo: /** @type {Agent["kieuGo"]} */ (kieuGo),
      ...doiTu,
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

/** Trần phía máy chủ — máy GPU hỏng chạy lặp cũng không ngập dòng tin. Nâng 2026-10-26 (anh Long: "tối thiểu 2000"):
 *  đủ để CẢ 2000 người có mặt mỗi ngày (mục tiêu ở agent-dieu-phoi.MUC_TIEU_NGAY), còn ~25 % khoảng thở trên mục tiêu. */
export const TRAN = {
  baiMoiAgentNgay: 1,
  binhLuanMoiAgentNgay: 4,
  baiToanDoiNgay: 100,
  binhLuanToanDoiNgay: 500,
  hayToanDoiNgay: 2000,
};

/**
 * Trọng số giờ (giờ Việt Nam 0–23): bà con xem điện thoại 4–7 h sáng, 11–13 h, 18–22 h; khuya gần như im.
 * Máy GPU nhân với nhịp gốc để ra số việc mỗi lượt 10 phút.
 */
/** Hệ số online của MỘT agent lúc giờ VN `gio` (theo lớp tuổi). */
export const gioCua = (a, gio) => LOP_TUOI[a.lopTuoi]?.gio[gio] ?? 1;

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
  // bài trên mạng phần lớn NGẮN ("Biển êm quá ae") — sàn 15 ký tự, không bắt bài dài kiểu bài văn
  const [min, max] = loai === "bai" ? [15, 900] : [3, 400];
  if (n < min) return "qua_ngan";
  if (n > max) return "qua_dai";
  if (/https?:\/\/|www\./i.test(text)) return "co_link";
  if (/#\p{L}/u.test(text)) return "co_hashtag";
  if (/\p{Extended_Pictographic}/u.test(text)) return "co_emoji";
  return null;
}
