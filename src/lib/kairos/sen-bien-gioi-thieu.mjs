// SEN BIỂN GIỚI THIỆU KAIROS + APP (anh Long 2026-10-24: "tổ chức cho con gpu thêm 1 task là cho sen biển giới thiệu về
// mạng xã hội dành riêng cho bà con, đọc báo, trợ lý ..."). THUẦN, dùng chung máy GPU (scripts/kairos-sen-bien.mjs) và
// route /api/kairos/sen-bien.
//
// Mỗi ngày Sen Biển (hồ sơ Chính thức `sen-bien:tro-ly`, seed 0068) đăng MỘT bài giới thiệu một tính năng. Nội dung CHỈ
// lấy từ DỮ KIỆN dưới đây — toàn tính năng ĐANG CÓ trong app (đừng thêm tính năng chưa làm: Nhắn tin, livestream…).
// Claude chỉ viết lại cho tự nhiên; hỏng/hết hạn mức ⇒ đăng bài MẪU viết sẵn. Xoay vòng, không lặp chủ đề trong
// KHONG_LAP_NGAY ngày.

import { chuQuyenFlag } from "./chu-quyen.mjs";

/** Chủ đề đã đăng trong chừng này ngày thì chưa đăng lại. */
export const KHONG_LAP_NGAY = 10;
/** Độ dài bài (ký tự). */
export const DAI_TOI_THIEU = 80;
export const DAI_TOI_DA = 900;

/**
 * @typedef {{ id: string, ten: string, duKien: string[], mau: string }} ChuDeGioiThieu
 * duKien: sự thật về tính năng (Claude chỉ được dùng những câu này); mau: bài viết sẵn khi không gọi được Claude.
 */

/** @type {readonly ChuDeGioiThieu[]} */
export const CHU_DE = [
  {
    id: "vi-sao-kairos",
    ten: "Vì sao tên là Kairos",
    duKien: [
      "Kairos là chữ Hy Lạp cổ, nghĩa là \"đúng lúc\" — thời cơ, khoảnh khắc nên làm.",
      "Với nghề biển, đúng lúc là chuyện sống còn: ra khơi đúng con nước, về trước bão, bán cá lúc được giá.",
      "Kairos kết nối bà con đi biển với nhau: kể chuyện nghề, hỏi kinh nghiệm, gặp người cùng cảng ở Bến.",
      "Kairos kết nối bà con với tin cần biết: tin biển, tin bão, giá thủy sản được đưa lên trước, mất sóng vẫn đọc lại được.",
    ],
    mau: "Bà con có biết vì sao chỗ này tên là Kairos không? Kairos là chữ Hy Lạp cổ, nghĩa là \"đúng lúc\". Nghề biển mình sống nhờ đúng lúc: ra khơi đúng con nước, về trước bão, bán cá lúc được giá. Kairos kết nối bà con đi biển với nhau, và với tin cần biết như tin bão, tin biển, giá thủy sản, đến đúng lúc bà con cần.",
  },
  {
    id: "kairos-la-gi",
    ten: "Kairos là gì",
    duKien: [
      "Kairos là mạng xã hội riêng của bà con đi biển, nằm ngay trong app (ô thứ hai dưới đáy màn hình).",
      "Ở Kairos bà con đọc tin biển, kể chuyện nghề, hỏi kinh nghiệm, bình luận và bấm Hay.",
      "Đăng bài: chạm ô \"Bà con muốn chia sẻ gì?\", viết chữ, gắn tối đa 5 ảnh.",
    ],
    mau: "Chào bà con, Sen Biển đây! Kairos là chỗ của riêng bà con đi biển: đọc tin biển, kể chuyện nghề, hỏi nhau kinh nghiệm. Muốn đăng bài thì chạm ô \"Bà con muốn chia sẻ gì?\" ở đầu trang, viết vài dòng, gắn thêm ảnh nếu có (tối đa 5 ảnh). Chuyến này bà con đi đâu, cá mực ra sao, kể Sen Biển với bà con cùng nghe nghen.",
  },
  {
    id: "doc-bao",
    ten: "Đọc báo tóm tắt",
    duKien: [
      "Tin từ báo chính thống được tóm tắt ngắn để đọc nhanh trên điện thoại.",
      "Muốn đọc đủ thì bấm \"Đọc bài gốc\" để mở bài trên trang báo.",
      "Dòng tin ưu tiên chuyện biển: bão, gió sóng, nghề cá, cảng, giá thủy sản.",
      "Cùng một vụ việc nhiều báo đưa thì Kairos chỉ giữ một bài cho đỡ rối.",
    ],
    mau: "Bà con bận kéo lưới không có thời gian đọc báo? Ở Kairos, tin từ báo chính thống được tóm tắt ngắn gọn, đọc vài giây là nắm. Tin biển, bão, nghề cá được đưa lên trước. Bài nào muốn đọc kỹ thì bấm \"Đọc bài gốc\" là mở trang báo. Một vụ nhiều báo đưa thì Sen Biển chỉ giữ một bài cho bà con đỡ rối mắt.",
  },
  {
    id: "binh-luan",
    ten: "Bình luận và Hay",
    duKien: [
      "Bình luận ngay dưới bài, không phải chuyển trang: bấm Bình luận là mở ô viết.",
      "Có thể trả lời một bình luận, bấm Hay cho bài hoặc bình luận hay.",
      "Đang viết mà mất sóng thì chữ được giữ lại trong máy, có sóng thì bấm gửi.",
    ],
    mau: "Thấy bài nào hay, bà con bấm Hay cho người viết vui. Muốn nói thêm thì bấm Bình luận ngay dưới bài, ô viết mở ra liền, khỏi chuyển trang. Trả lời ai thì bấm Trả lời dưới bình luận của người đó. Ngoài khơi đang viết mà mất sóng cũng đừng lo, chữ được giữ trong máy, có sóng lại bấm gửi là xong.",
  },
  {
    id: "ben-cang",
    ten: "Bến theo cảng",
    duKien: [
      "Mỗi cảng cá có một Bến riêng trên Kairos.",
      "Bài nhắc tới cảng nào sẽ có nhãn \"Bến …\", chạm vào để xem chuyện của bà con cùng cảng.",
    ],
    mau: "Bà con để ý nhé: bài nào nhắc tới cảng sẽ có nhãn \"Bến …\" nhỏ ở dưới. Chạm vào là vào Bến của cảng đó, xem bà con cùng cảng đang nói chuyện gì: tàu nào vừa về, cá gì đang lên, cảng đông hay vắng. Đăng bài nhớ ghi tên cảng để bà con cùng bến dễ thấy.",
  },
  {
    id: "sen-bien-tro-ly",
    ten: "Hỏi Sen Biển",
    duKien: [
      "Chạm biểu tượng Sen Biển trong app để hỏi bằng giọng nói hoặc gõ chữ.",
      "Sen Biển trả lời về gió sóng, đường về, cảng gần, bản đồ và các việc trong app.",
      "Nhiều câu Sen Biển trả lời được ngay trong máy, cả khi mất sóng.",
    ],
    mau: "Sen Biển là trợ lý của bà con trong app. Chạm vào biểu tượng Sen Biển rồi nói như nói chuyện bình thường: \"gió sóng chiều nay sao\", \"đường về cảng gần nhất\", \"mở bản đồ\"... Không tiện nói thì gõ chữ cũng được. Nhiều câu Sen Biển trả lời được ngay trong máy, ra khơi mất sóng vẫn hỏi được.",
  },
  {
    id: "mat-song",
    ten: "Mất sóng vẫn đọc",
    duKien: [
      "Dòng tin Kairos được lưu trong máy: mất sóng vẫn đọc lại được những bài đã tải.",
      "Có sóng lại thì app tự tải tin mới.",
    ],
    mau: "Đi biển dài ngày mất sóng là chuyện thường. Bà con yên tâm: những bài Kairos đã tải được lưu trong máy, ra khơi mất sóng vẫn mở ra đọc lại được. Vào bờ có sóng, app tự tải tin mới. Trước khi ra khơi, bà con mở Kairos một lần cho máy tải sẵn tin nghen.",
  },
  {
    id: "ban-do",
    ten: "Bản đồ ngư trường",
    duKien: [
      "App có bản đồ ngư trường: nhiệt độ nước, phù du, độ sâu, phao đèn biển.",
      "Chạm vào một điểm trên bản đồ để xem gió sóng ở đó.",
      "Bản đồ có nhãn chủ quyền Hoàng Sa, Trường Sa của Việt Nam.",
    ],
    mau: "Bà con đã thử bản đồ ngư trường trong app chưa? Trên đó có nhiệt độ nước, phù du, độ sâu, phao đèn biển, lại có đủ Hoàng Sa, Trường Sa của Việt Nam. Chạm vào chỗ nào trên biển là xem được gió sóng ở chỗ đó. Ra khơi trước khi thả lưới, mở bản đồ coi một chút cho chắc ăn.",
  },
  {
    id: "tin-bao",
    ten: "Tin bão",
    duKien: [
      "App có tin bão Biển Đông, cập nhật theo bản tin chính thức.",
      "Kairos đưa lên trước các tin bão, áp thấp, sóng lớn trên biển.",
    ],
    mau: "Mùa này trời biển thất thường, bà con nhớ coi tin bão trước mỗi chuyến. App có tin bão Biển Đông theo bản tin chính thức, còn trên Kairos tin bão, áp thấp, sóng lớn luôn được đưa lên trước. Có tin bão là bà con báo nhau một tiếng, an toàn là trên hết.",
  },
  {
    id: "giay-to",
    ten: "Tủ giấy tờ",
    duKien: [
      "Trong mục Tàu tôi có tủ giấy tờ: lưu giấy tờ tàu và nhắc trước khi hết hạn.",
      "Có sổ thuyền viên để ghi bạn thuyền trên tàu.",
    ],
    mau: "Giấy tờ tàu hết hạn lúc nào bà con nhớ hết không? Trong mục Tàu tôi có tủ giấy tờ: lưu giấy tờ của tàu, gần hết hạn thì app nhắc trước. Có cả sổ thuyền viên để ghi bạn thuyền đi cùng chuyến. Bỏ chút thời gian nhập một lần, đỡ lo bị phạt vì quên.",
  },
  {
    id: "cho-ca",
    ten: "Chợ cá",
    duKien: [
      "Mục Chợ cá có bảng giá tham khảo và chỗ đăng tin mua bán.",
      "Giá trong app là giá tham khảo, không phải giá chốt.",
    ],
    mau: "Cá về bờ bán cho ai, giá bao nhiêu? Bà con vào mục Chợ cá trong app: có bảng giá tham khảo và chỗ đăng tin mua bán. Giá trong app là để tham khảo thôi nha, giá chốt vẫn do hai bên thỏa thuận. Có mối mua tốt thì chia sẻ cho bà con cùng bến với.",
  },
  {
    id: "theo-doi",
    ten: "Theo dõi, chặn, báo xấu",
    duKien: [
      "Bấm vào tên người viết để xem trang của người đó và bấm Theo dõi.",
      "Gặp bài nói bậy, lừa đảo thì bấm nút ba chấm để báo xấu hoặc chặn người đó.",
    ],
    mau: "Gặp người hay chia sẻ kinh nghiệm hay, bà con bấm vào tên họ rồi bấm Theo dõi để không bỏ lỡ bài. Còn gặp bài nói bậy, lừa đảo thì bấm nút ba chấm ở góc bài để báo xấu hoặc chặn người đó. Kairos là chỗ của bà con, mình cùng giữ cho sạch sẽ.",
  },
  {
    id: "noi-quy",
    ten: "Nội quy",
    duKien: [
      "Nội quy Kairos: nói thật, không bịa tin, không tung tin đồn.",
      "Không chửi bới, không lừa đảo, không quảng cáo trá hình.",
      "Gọi đúng tên Biển Đông, Hoàng Sa, Trường Sa của Việt Nam.",
    ],
    mau: "Sen Biển nhắc bà con mấy điều nhỏ để Kairos luôn vui: nói thật, không bịa tin, không tung tin đồn; không chửi bới, không lừa đảo, không quảng cáo trá hình; và gọi đúng tên Biển Đông, Hoàng Sa, Trường Sa của Việt Nam. Bài sai nội quy sẽ bị ẩn. Cảm ơn bà con đã cùng giữ Kairos sạch đẹp!",
  },
];

/**
 * Chọn chủ đề hôm nay: bỏ chủ đề đã đăng trong KHONG_LAP_NGAY ngày; còn nhiều thì lấy ngẫu nhiên; hết sạch thì lấy chủ
 * đề đăng LÂU NHẤT. Thuần (rnd truyền vào để test).
 * @param {{ id: string, at: string }[]} daDung
 * @param {number} now
 * @param {() => number} [rnd]
 * @returns {ChuDeGioiThieu}
 */
export function chonChuDe(daDung, now, rnd = Math.random) {
  const lanCuoi = new Map();
  for (const d of Array.isArray(daDung) ? daDung : []) {
    const t = Date.parse(d?.at);
    if (typeof d?.id === "string" && Number.isFinite(t)) lanCuoi.set(d.id, Math.max(lanCuoi.get(d.id) ?? 0, t));
  }
  const han = now - KHONG_LAP_NGAY * 86_400_000;
  const con = CHU_DE.filter((c) => (lanCuoi.get(c.id) ?? 0) < han);
  if (con.length) return con[Math.floor(rnd() * con.length) % con.length];
  return [...CHU_DE].sort((a, b) => (lanCuoi.get(a.id) ?? 0) - (lanCuoi.get(b.id) ?? 0))[0];
}

/** Prompt cho Claude viết lại bài giới thiệu — CHỈ được dùng dữ kiện. */
export function promptGioiThieu(c) {
  return [
    "Bạn là Sen Biển, trợ lý của một app dành cho ngư dân Việt Nam. Viết MỘT bài đăng ngắn trên mạng xã hội Kairos trong app để giới thiệu tính năng dưới đây cho bà con.",
    "Yêu cầu: 3–5 câu tiếng Việt đời thường, thân thiện, xưng \"Sen Biển\", gọi \"bà con\"; có thể dùng chút giọng miền biển nhẹ nhàng (\"nghen\", \"nha\"). CHỈ dùng các DỮ KIỆN cho sẵn — không thêm tính năng, con số, giá cả, lời hứa nào khác. Không emoji, không hashtag, không đường link, không tiêu đề.",
    "Gọi đúng tên Biển Đông, Hoàng Sa, Trường Sa của Việt Nam; không bao giờ dùng tên nước ngoài cho các vùng biển, đảo này.",
    "",
    `TÍNH NĂNG: ${c.ten}`,
    "DỮ KIỆN:",
    ...c.duKien.map((d) => `- ${d}`),
    "",
    'CHỈ trả về JSON đúng một dòng: {"bai":"..."}',
  ].join("\n");
}

/**
 * Kiểm bài trước khi đăng: độ dài, không link/emoji/hashtag, không trúng cờ chủ quyền. Trả lý do hỏng hoặc null.
 * @param {unknown} text
 * @returns {string | null}
 */
export function loiBai(text) {
  if (typeof text !== "string") return "khong_phai_chu";
  const t = text.trim();
  const n = [...t].length;
  if (n < DAI_TOI_THIEU) return "qua_ngan";
  if (n > DAI_TOI_DA) return "qua_dai";
  if (/https?:\/\/|www\./i.test(t)) return "co_link";
  if (/#\p{L}/u.test(t)) return "co_hashtag";
  if (/\p{Extended_Pictographic}/u.test(t)) return "co_emoji";
  if (chuQuyenFlag(t)) return "chu_quyen";
  return null;
}
