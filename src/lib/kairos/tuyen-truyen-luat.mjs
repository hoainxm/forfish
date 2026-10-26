// SEN BIỂN TUYÊN TRUYỀN LUẬT — Nghị định 246/2026/NĐ-CP (anh Long 2026-10-26: "cho kairos chạy tuyên truyền các quy định
// liên quan luật và xử lý vi phạm hành chính mới theo nghị định mới"). THUẦN, dùng chung máy GPU (scripts/kairos-luat.mjs)
// và route /api/kairos/sen-bien (thân {body, luat}).
//
// Mỗi lượt Sen Biển (hồ sơ Chính thức `sen-bien:tro-ly`) đăng MỘT mục: vài câu giải thích đời thường + TRÍCH NGUYÊN VĂN
// điều khoản (trong ngoặc kép, đúng từng chữ theo văn bản) + dòng căn cứ "Điều N Nghị định 246/2026/NĐ-CP". Claude chỉ viết
// phần giải thích từ đúng trích đó; hỏng/hết hạn mức/bài không qua kiểm ⇒ đăng bài MẪU viết sẵn. Máy chủ kiểm bài PHẢI chứa
// nguyên văn trích của mục — không ai (kể cả Claude) sửa được số tiền.
//
// NGUỒN: toàn văn Nghị định 246/2026/NĐ-CP ngày 29/6/2026, hiệu lực 18/8/2026, thay Nghị định 38/2024 + 301/2025 (đối chiếu
// hai bản luatvietnam.vn + luatnguyen.vn 2026-10-26, khớp từng câu). Mức tiền trong Chương II là mức với CÁ NHÂN; tổ chức
// gấp 02 lần (Điều 5 khoản 2). ĐỪNG dẫn Nghị định 38/2024 hay 26/2019 nữa.
//
// Thứ tự mục = thứ tự đăng (đi từ chuyện bà con hay dính nhất); đăng hết vòng thì quay lại từ đầu; một mục không lặp trong
// KHONG_LAP_NGAY ngày.

import { chuQuyenFlag } from "./chu-quyen.mjs";

export const NGHI_DINH = "Nghị định 246/2026/NĐ-CP";
export const HIEU_LUC = "18/8/2026";
/** Mục đã đăng trong chừng này ngày thì chưa đăng lại. */
export const KHONG_LAP_NGAY = 45;
/** Độ dài phần GIẢI THÍCH (ký tự) — phần trích tính riêng. */
export const GIAI_THICH_TOI_THIEU = 60;
export const GIAI_THICH_TOI_DA = 700;
/** Độ dài CẢ BÀI (dưới trần LIMITS.postBody = 2000). */
export const BAI_TOI_DA = 1900;

/**
 * @typedef {{ id: string, dieu: number, ten: string, trich: string, mau: string, luuY?: string[] }} MucLuat
 * dieu: số Điều · trich: NGUYÊN VĂN (khoản + điểm, giữ số thứ tự a) b) như văn bản) · mau: giải thích viết sẵn
 * · luuY: ý phụ (hình phạt bổ sung, mức thuyền trưởng…) Claude được nhắc tới, cũng lấy từ văn bản.
 */

/** @type {readonly MucLuat[]} */
export const MUC = [
  {
    id: "d62-hieu-luc",
    dieu: 62,
    ten: "Nghị định mới có hiệu lực",
    trich:
      "1. Nghị định này có hiệu lực thi hành từ ngày 18 tháng 8 năm 2026.\n2. Nghị định này thay thế Nghị định số 38/2024/NĐ-CP ngày 05 tháng 4 năm 2024 của Chính phủ quy định xử phạt vi phạm hành chính trong lĩnh vực thủy sản và Nghị định số 301/2025/NĐ-CP ngày 17 tháng 11 năm 2025 của Chính phủ sửa đổi, bổ sung một số điều của Nghị định số 38/2024/NĐ-CP ngày 05 tháng 4 năm 2024 của Chính phủ quy định xử phạt vi phạm hành chính trong lĩnh vực thủy sản.",
    mau: "Bà con lưu ý: từ ngày 18/8/2026, xử phạt trong nghề cá theo Nghị định 246/2026/NĐ-CP, thay cho Nghị định 38/2024 trước đây. Nhiều mức phạt tăng mạnh, nhất là chuyện giấy phép, thiết bị giám sát hành trình và vượt ranh giới vùng biển. Sen Biển sẽ lần lượt đọc từng điều cho bà con nghe trên Kairos.",
  },
  {
    id: "d5-to-chuc-gap-doi",
    dieu: 5,
    ten: "Mức phạt tối đa, tổ chức gấp đôi",
    trich:
      "1. Mức phạt tiền tối đa đối với một hành vi vi phạm hành chính do cá nhân thực hiện trong lĩnh vực thủy sản là 1.000.000.000 đồng.\n2. Mức phạt tiền quy định tại Chương II Nghị định này được áp dụng đối với một hành vi vi phạm hành chính của cá nhân, trừ quy định tại các khoản 5, 6 và 8 Điều 37 Nghị định này. Trường hợp tổ chức có hành vi vi phạm thì mức phạt tiền bằng 02 lần mức phạt tiền đối với cá nhân.",
    mau: "Các mức tiền Sen Biển đọc trong loạt bài này là mức phạt với cá nhân, cao nhất tới 1 tỷ đồng cho một hành vi. Tàu đứng tên công ty, hợp tác xã thì phạt gấp đôi. Bà con đọc mức nào cũng nhớ nhân hai nếu tàu thuộc tổ chức nghen.",
  },
  {
    id: "d21-k2-a",
    dieu: 21,
    ten: "Tàu 15–24 m không giấy phép khai thác",
    trich:
      "2. Phạt tiền từ 300.000.000 đồng đến 500.000.000 đồng chủ tàu cá đối với một trong các hành vi vi phạm sau:\na) Sử dụng tàu cá có chiều dài lớn nhất từ 15 mét đến dưới 24 mét khai thác thủy sản trên biển không có Giấy phép khai thác thủy sản hoặc Giấy phép khai thác thủy sản đã hết hạn;",
    luuY: [
      "Thuyền trưởng bị phạt riêng từ 100.000.000 đồng đến 200.000.000 đồng (khoản 5 điểm b).",
      "Tái phạm hoặc vi phạm nhiều lần: chủ tàu từ 500.000.000 đồng đến 700.000.000 đồng (khoản 3 điểm a).",
      "Tịch thu thủy sản khai thác được (khoản 6 điểm a).",
    ],
    mau: "Tàu dài từ 15 m đến dưới 24 m mà đi biển không có giấy phép khai thác, hoặc giấy phép đã hết hạn, chủ tàu bị phạt từ 300 đến 500 triệu đồng. Thuyền trưởng bị phạt riêng từ 100 đến 200 triệu, cá trên tàu bị tịch thu. Lần sau còn dính nữa là 500 đến 700 triệu. Giấy phép sắp hết hạn thì đi gia hạn sớm, bà con cất trong tủ giấy tờ của app để được nhắc trước nghen.",
  },
  {
    id: "d21-k4-a",
    dieu: 21,
    ten: "Tàu từ 24 m không giấy phép khai thác",
    trich:
      "4. Phạt tiền từ 800.000.000 đồng đến 1.000.000.000 đồng chủ tàu cá đối với một trong các hành vi vi phạm sau:\na) Sử dụng tàu cá có chiều dài lớn nhất từ 24 mét trở lên khai thác thủy sản trên biển không có Giấy phép khai thác thủy sản hoặc Giấy phép khai thác thủy sản đã hết hạn;",
    luuY: [
      "Thuyền trưởng bị phạt riêng từ 300.000.000 đồng đến 500.000.000 đồng (khoản 5 điểm d).",
      "Tịch thu thủy sản khai thác được (khoản 6 điểm a).",
    ],
    mau: "Tàu lớn từ 24 m trở lên mà không có giấy phép khai thác hoặc giấy phép hết hạn là mức phạt cao nhất của nghị định: chủ tàu từ 800 triệu đến 1 tỷ đồng, thuyền trưởng từ 300 đến 500 triệu, cá bị tịch thu. Một chuyến biển không đủ bù. Bà con có tàu lớn coi lại ngày hết hạn giấy phép ngay hôm nay.",
  },
  {
    id: "d21-k2-d",
    dieu: 21,
    ten: "Tàu từ 15 m vượt ranh giới vùng biển",
    trich:
      "2. Phạt tiền từ 300.000.000 đồng đến 500.000.000 đồng chủ tàu cá đối với một trong các hành vi vi phạm sau:\nd) Sử dụng tàu cá có chiều dài lớn nhất từ 15 mét trở lên vượt qua ranh giới phía ngoài của vùng biển được phép khai thác, trừ trường hợp tàu cá được chấp thuận đi hoạt động tại vùng biển của quốc gia, vùng lãnh thổ khác hoặc được cấp phép đi hoạt động tại vùng biển thuộc quyền quản lý của tổ chức nghề cá khu vực;",
    luuY: [
      "Thuyền trưởng bị phạt riêng từ 100.000.000 đồng đến 200.000.000 đồng (khoản 5 điểm b).",
      "Tước quyền sử dụng Giấy phép khai thác thủy sản từ 06 tháng đến 12 tháng (khoản 6 điểm d).",
    ],
    mau: "Tàu từ 15 m trở lên chạy vượt ranh giới ngoài của vùng biển được phép khai thác là chủ tàu bị phạt từ 300 đến 500 triệu đồng, thuyền trưởng thêm 100 đến 200 triệu, giấy phép khai thác bị tước 6 đến 12 tháng. Trên bản đồ của app có vạch ranh giới, bà con mở coi trước khi thả lưới ở vùng giáp ranh nghen.",
  },
  {
    id: "d21-k4-b",
    dieu: 21,
    ten: "Khai thác ở vùng biển nước khác",
    trich:
      "4. Phạt tiền từ 800.000.000 đồng đến 1.000.000.000 đồng chủ tàu cá đối với một trong các hành vi vi phạm sau:\nb) Khai thác thủy sản tại vùng biển của quốc gia, vùng lãnh thổ khác hoặc vùng biển thuộc quyền quản lý của Tổ chức nghề cá khu vực mà không có Giấy phép khai thác thủy sản hoặc Giấy phép khai thác thủy sản hết hạn hoặc không có giấy chấp thuận hoặc giấy chấp thuận hết hạn;",
    luuY: [
      "Thuyền trưởng bị phạt bằng mức chủ tàu (khoản 5 điểm a).",
      "Tịch thu tàu cá (khoản 6 điểm b); tịch thu thủy sản (khoản 6 điểm a); tước Giấy phép khai thác thủy sản từ 12 tháng đến 16 tháng (khoản 6 điểm đ).",
    ],
    mau: "Đi đánh bắt ở vùng biển của nước khác mà không có giấy phép, giấy chấp thuận là nặng nhất: chủ tàu phạt từ 800 triệu đến 1 tỷ đồng, thuyền trưởng cũng phạt bằng mức đó, tàu bị tịch thu, giấy phép bị tước 12 đến 16 tháng. Đây là lỗi làm cả ngành bị thẻ vàng. Bà con tuyệt đối không qua ranh giới, có nghi ngờ thì mở bản đồ trong app kiểm tra vị trí.",
  },
  {
    id: "d21-k2-k",
    dieu: 21,
    ten: "Mất tín hiệu giám sát hành trình, không về bờ trong 10 ngày",
    trich:
      "2. Phạt tiền từ 300.000.000 đồng đến 500.000.000 đồng chủ tàu cá đối với một trong các hành vi vi phạm sau:\nk) Không đưa tàu cá về bờ trong thời hạn 10 ngày kể từ thời điểm tàu cá mất tín hiệu từ thiết bị giám sát hành trình;",
    luuY: [
      "Thuyền trưởng bị phạt bằng mức chủ tàu (khoản 5 điểm a).",
      "Tịch thu thủy sản khai thác được (khoản 6 điểm a); tước Giấy phép khai thác thủy sản từ 06 tháng đến 12 tháng (khoản 6 điểm d).",
    ],
    mau: "Thiết bị giám sát hành trình mất tín hiệu ngoài biển mà không sửa được thì trong 10 ngày phải đưa tàu về bờ. Quá 10 ngày là chủ tàu và thuyền trưởng mỗi người bị phạt từ 300 đến 500 triệu đồng, cá bị tịch thu, giấy phép bị tước 6 đến 12 tháng. Máy hỏng thì gọi báo vị trí về bờ đúng giờ rồi tính đường về sớm, đừng ráng thêm vài mẻ lưới.",
  },
  {
    id: "d21-k2-g-h-i",
    dieu: 21,
    ten: "Tàu từ 24 m tắt, không có, không truyền giám sát hành trình",
    trich:
      "2. Phạt tiền từ 300.000.000 đồng đến 500.000.000 đồng chủ tàu cá đối với một trong các hành vi vi phạm sau:\ng) Không duy trì việc truyền thông tin từ thiết bị giám sát hành trình tàu cá về Hệ thống giám sát hành trình tàu cá theo quy định khi hoạt động trên biển, đảo (nơi không có cảng cá) đối với tàu cá có chiều dài lớn nhất từ 24 mét trở lên;\nh) Vô hiệu hóa thiết bị giám sát hành trình tàu cá khi hoạt động trên biển, đảo (nơi không có cảng cá) đối với tàu cá có chiều dài lớn nhất từ 24 mét trở lên;\ni) Không có thiết bị giám sát hành trình tàu cá khi tàu cá trên biển hoặc đảo (nơi không có cảng cá) đối với tàu cá có chiều dài lớn nhất từ 24 mét trở lên;",
    luuY: [
      "Thuyền trưởng bị phạt bằng mức chủ tàu (khoản 5 điểm a).",
      "Tái phạm: từ 500.000.000 đồng đến 700.000.000 đồng (khoản 3 điểm d, đ, e).",
      "Tước Giấy phép khai thác thủy sản từ 06 tháng đến 12 tháng (khoản 6 điểm d).",
    ],
    mau: "Tàu từ 24 m trở lên ra biển mà không có thiết bị giám sát hành trình, tắt máy, hay để mất tín hiệu không truyền về hệ thống: chủ tàu và thuyền trưởng mỗi người bị phạt từ 300 đến 500 triệu đồng, tái phạm lên 500 đến 700 triệu, giấy phép bị tước 6 đến 12 tháng. Máy giám sát hành trình là cái bảo vệ bà con trước, bị phạt sau. Mở máy suốt chuyến, đừng tắt dù một phút.",
  },
  {
    id: "d37-k7",
    dieu: 37,
    ten: "Tàu 15–24 m tắt, không có, không truyền giám sát hành trình",
    trich:
      "7. Phạt tiền từ 100.000.000 đồng đến 300.000.000 đồng đối với thuyền trưởng và chủ tàu cá vi phạm một trong các hành vi sau:\na) Không thực hiện báo cáo vị trí tàu cá theo quy định đối với tàu cá có chiều dài lớn nhất từ 24 mét trở lên mất tín hiệu thiết bị giám sát hành trình trên biển hoặc đảo (nơi không có cảng cá);\nb) Không duy trì việc truyền thông tin từ thiết bị giám sát hành trình về Hệ thống giám sát hành trình tàu cá theo quy định khi tàu cá trên biển hoặc đảo (nơi không có cảng cá) đối với tàu cá có chiều dài lớn nhất từ 15 mét đến dưới 24 mét;\nc) Vô hiệu hóa thiết bị giám sát hành trình tàu cá trên biển hoặc đảo (nơi không có cảng cá) đối với tàu cá có chiều dài lớn nhất từ 15 mét đến dưới 24 mét;\nd) Không có thiết bị giám sát hành trình tàu cá khi tàu cá trên biển hoặc đảo (nơi không có cảng cá) đối với tàu cá có chiều dài lớn nhất từ 15 mét đến dưới 24 mét.",
    luuY: [
      "Tước văn bằng, chứng chỉ thuyền trưởng và tước Giấy phép khai thác thủy sản từ 06 tháng đến 12 tháng (khoản 9).",
      "Tàu 15–24 m tái phạm hoặc vi phạm nhiều lần: xử theo Điều 21 khoản 2, từ 300.000.000 đồng đến 500.000.000 đồng.",
    ],
    mau: "Tàu từ 15 m đến dưới 24 m ra biển mà không có thiết bị giám sát hành trình, tắt máy, hay không truyền tín hiệu về hệ thống: thuyền trưởng và chủ tàu bị phạt từ 100 đến 300 triệu đồng, tước bằng thuyền trưởng và giấy phép khai thác 6 đến 12 tháng. Tàu từ 24 m mất tín hiệu mà không báo vị trí cũng mức này. Dính lần hai là nhảy lên 300 đến 500 triệu. Máy giám sát hành trình phải mở suốt chuyến, bà con nhớ nghen.",
  },
  {
    id: "d37-k4",
    dieu: 37,
    ten: "Mất tín hiệu trên biển mà không báo vị trí",
    trich:
      "4. Phạt tiền từ 30.000.000 đồng đến 40.000.000 đồng đối với thuyền trưởng và chủ tàu cá có hành vi không thực hiện báo cáo vị trí theo quy định đối với tàu cá có chiều dài lớn nhất từ 15 mét đến dưới 24 mét mất tín hiệu thiết bị giám sát hành trình trên biển hoặc đảo (nơi không có cảng cá).",
    luuY: [
      "Tước văn bằng, chứng chỉ thuyền trưởng và tước Giấy phép khai thác thủy sản từ 06 tháng đến 12 tháng (khoản 9).",
      "Theo Nghị định 41/2026/NĐ-CP, khi mất kết nối trên biển phải dùng thiết bị liên lạc khác báo vị trí không quá 06 giờ một lần.",
    ],
    mau: "Tàu từ 15 m đến dưới 24 m đang ngoài biển mà thiết bị giám sát hành trình mất tín hiệu thì phải báo vị trí về bờ theo quy định, cứ không quá 6 giờ một lần bằng máy liên lạc khác. Không báo là thuyền trưởng và chủ tàu bị phạt từ 30 đến 40 triệu đồng, tước bằng và giấy phép 6 đến 12 tháng. Mất tín hiệu thì gọi liền, ghi lại giờ và tọa độ để nộp khi cập cảng.",
  },
  {
    id: "d37-k1",
    dieu: 37,
    ten: "Tàu nằm bờ mất tín hiệu cũng phải báo",
    trich:
      "1. Phạt tiền từ 1.000.000 đồng đến 3.000.000 đồng đối với chủ tàu cá có một trong các hành vi sau:\na) Không báo cáo vị trí tàu cá neo đậu tại bờ định kỳ 07 ngày/lần cho cơ quan quản lý nhà nước về thủy sản cấp tỉnh nơi đăng ký tàu cá trong trường hợp chủ tàu đã ngừng dịch vụ truyền dữ liệu thiết bị giám sát hành trình trong thời gian không đi khai thác từ 03 tháng trở lên;\nb) Không duy trì việc truyền thông tin từ thiết bị giám sát hành trình tàu cá về Hệ thống giám sát hành trình tàu cá và không báo cáo vị trí về cơ quan quản lý nhà nước về thủy sản cấp tỉnh (qua bộ phận trực, vận hành Hệ thống giám sát hành trình tàu cá) định kỳ 24 giờ/lần trong trường hợp tàu cá mất tín hiệu thiết bị giám sát hành trình tại bờ hoặc đảo (nơi có cảng cá).",
    mau: "Tàu đậu ở bờ cũng không được quên máy giám sát hành trình. Máy mất tín hiệu khi tàu ở bờ thì cứ 24 giờ phải báo vị trí về cơ quan thủy sản tỉnh. Tàu nghỉ từ 3 tháng trở lên đã ngừng dịch vụ truyền dữ liệu thì cứ 7 ngày báo một lần. Không báo, chủ tàu bị phạt từ 1 đến 3 triệu đồng. Tiền không lớn nhưng vào sổ vi phạm, lần sau dính lỗi khác là bị tính tăng nặng.",
  },
  {
    id: "d21-k1-d37-k3",
    dieu: 21,
    ten: "Tháo gỡ thiết bị giám sát hành trình, phá kẹp chì",
    trich:
      "1. Phạt tiền từ 50.000.000 đồng đến 100.000.000 đồng chủ tàu cá đối với hành vi tháo gỡ thiết bị giám sát hành trình tàu cá không được giám sát theo quy định mà chưa đến mức truy cứu trách nhiệm hình sự.",
    luuY: [
      "Thuyền trưởng bị phạt bằng mức chủ tàu, trừ khi tàu nằm bờ không đi khai thác (khoản 5 điểm a); tước Giấy phép khai thác thủy sản từ 06 tháng đến 12 tháng (khoản 6 điểm d).",
      "Điều 37 khoản 3 điểm b: tháo gỡ hoặc thay thế kẹp chì thiết bị giám sát hành trình mà không được giám sát, chủ tàu bị phạt từ 10.000.000 đồng đến 20.000.000 đồng.",
    ],
    mau: "Muốn tháo máy giám sát hành trình ra sửa hay thay phải có cơ quan chức năng giám sát. Tự tháo là chủ tàu bị phạt từ 50 đến 100 triệu đồng, giấy phép bị tước 6 đến 12 tháng, thuyền trưởng cũng bị phạt bằng mức đó nếu tàu đang đi khai thác. Tự tháo hay thay kẹp chì thì phạt từ 10 đến 20 triệu. Máy có vấn đề, bà con gọi đơn vị cung cấp và báo cơ quan thủy sản, đừng tự xử.",
  },
  {
    id: "d21-k2-dd-e",
    dieu: 21,
    ten: "Giữ hộ, gửi thiết bị giám sát hành trình của tàu khác",
    trich:
      "2. Phạt tiền từ 300.000.000 đồng đến 500.000.000 đồng chủ tàu cá đối với một trong các hành vi vi phạm sau:\nđ) Tàng trữ hoặc vận chuyển trái phép thiết bị giám sát hành trình của tàu cá khác mà chưa đến mức truy cứu trách nhiệm hình sự;\ne) Gửi trái phép thiết bị giám sát hành trình của tàu cá mà chưa đến mức truy cứu trách nhiệm hình sự;",
    luuY: [
      "Thuyền trưởng bị phạt bằng mức chủ tàu (khoản 5 điểm a).",
      "Tước Giấy phép khai thác thủy sản từ 06 tháng đến 12 tháng (khoản 6 điểm d).",
    ],
    mau: "Gửi máy giám sát hành trình của tàu mình sang tàu khác, hay chở giùm, giữ giùm máy của tàu khác, đều bị phạt từ 300 đến 500 triệu đồng với cả chủ tàu lẫn thuyền trưởng, giấy phép bị tước 6 đến 12 tháng. Nặng hơn có thể bị xử hình sự. Ai nhờ gửi máy, bà con dứt khoát từ chối.",
  },
  {
    id: "d21-k3-g",
    dieu: 21,
    ten: "Giấu, làm giả, hủy chứng cứ vi phạm",
    trich:
      "3. Phạt tiền từ 500.000.000 đồng đến 700.000.000 đồng chủ tàu cá đối với một trong các hành vi vi phạm sau:\ng) Che giấu, giả mạo hoặc hủy chứng cứ vi phạm quy định về khai thác, bảo vệ nguồn lợi thủy sản;",
    luuY: ["Thuyền trưởng bị phạt riêng từ 250.000.000 đồng đến 300.000.000 đồng (khoản 5 điểm c).", "Tái phạm: từ 800.000.000 đồng đến 1.000.000.000 đồng (khoản 4 điểm g)."],
    mau: "Lỡ vi phạm rồi mà còn giấu, làm giả hay hủy chứng cứ thì nặng thêm nhiều: chủ tàu bị phạt từ 500 đến 700 triệu đồng, thuyền trưởng từ 250 đến 300 triệu, tái phạm lên tới 1 tỷ. Có chuyện gì thì khai thật, nhận lỗi, phạt nhẹ hơn nhiều so với giấu.",
  },
  {
    id: "d22-tau-nho-ra-xa",
    dieu: 22,
    ten: "Tàu nhỏ ra vùng lộng, vùng khơi",
    trich:
      "1. Phạt tiền từ 20.000.000 đồng đến 30.000.000 đồng đối với thuyền trưởng có hành vi sử dụng tàu cá có chiều dài lớn nhất dưới 12 mét khai thác thủy sản hoặc chuyển tải thủy sản tại vùng lộng hoặc vùng khơi.\n2. Phạt tiền từ 30.000.000 đồng đến 40.000.000 đồng đối với thuyền trưởng có hành vi sử dụng tàu cá có chiều dài lớn nhất từ 12 mét đến dưới 15 mét khai thác thủy sản hoặc chuyển tải thủy sản tại vùng ven bờ hoặc vùng khơi.",
    luuY: ["Tước văn bằng, chứng chỉ thuyền trưởng tàu cá từ 03 tháng đến 06 tháng (khoản 5 điểm a)."],
    mau: "Tàu nào vùng nấy: tàu dưới 12 m chỉ được làm ở vùng ven bờ, tàu từ 12 m đến dưới 15 m ở vùng lộng. Tàu dưới 12 m ra vùng lộng hay vùng khơi, thuyền trưởng bị phạt từ 20 đến 30 triệu đồng; tàu 12 đến 15 m vào ven bờ hoặc ra khơi bị phạt từ 30 đến 40 triệu, kèm tước bằng thuyền trưởng 3 đến 6 tháng. Trên bản đồ của app có vạch ranh ven bờ, lộng, khơi, bà con mở coi khi chạy gần ranh.",
  },
  {
    id: "d22-tau-lon-vao-gan",
    dieu: 22,
    ten: "Tàu lớn vào vùng ven bờ, vùng lộng",
    trich:
      "3. Phạt tiền từ 50.000.000 đồng đến 70.000.000 đồng đối với thuyền trưởng và chủ tàu cá có hành vi sử dụng tàu cá có chiều dài lớn nhất từ 15 mét đến dưới 24 mét khai thác thủy sản hoặc chuyển tải thủy sản tại vùng ven bờ hoặc vùng lộng.\n4. Phạt tiền từ 80.000.000 đồng đến 100.000.000 đồng đối với thuyền trưởng và chủ tàu cá có hành vi sử dụng tàu cá có chiều dài lớn nhất từ 24 mét trở lên khai thác thủy sản hoặc chuyển tải thủy sản tại vùng ven bờ hoặc vùng lộng.",
    luuY: [
      "Tước văn bằng, chứng chỉ thuyền trưởng từ 03 tháng đến 06 tháng (tàu 15–24 m) hoặc 06 tháng đến 12 tháng (tàu từ 24 m); tước Giấy phép khai thác thủy sản từ 03 tháng đến 06 tháng (khoản 5).",
    ],
    mau: "Tàu từ 15 m trở lên là tàu vùng khơi, không được vào đánh bắt ở vùng ven bờ hay vùng lộng. Tàu 15 đến dưới 24 m vi phạm, thuyền trưởng và chủ tàu bị phạt từ 50 đến 70 triệu đồng; tàu từ 24 m là 80 đến 100 triệu, kèm tước bằng thuyền trưởng và tước giấy phép khai thác 3 đến 6 tháng. Vùng gần bờ để dành cho tàu nhỏ của bà con, mình tàu lớn ra ngoài khơi làm nghen.",
  },
  {
    id: "d24-khong-mang-giay-phep",
    dieu: 24,
    ten: "Không mang giấy phép theo tàu",
    trich:
      "1. Phạt tiền từ 5.000.000 đồng đến 10.000.000 đồng đối với thuyền trưởng và chủ tàu cá vi phạm một trong các hành vi sau:\na) Không mang bản chính hoặc bản sao chứng thực Giấy phép khai thác thủy sản khi tàu cá hoạt động khai thác thủy sản;",
    mau: "Có giấy phép nhưng để ở nhà, lúc kiểm tra không có bản chính hay bản sao chứng thực trên tàu thì thuyền trưởng và chủ tàu vẫn bị phạt từ 5 đến 10 triệu đồng. Giấy phép bỏ túi nilon cất trên tàu, chụp thêm một bản vào tủ giấy tờ trong app để lúc cần có sẵn.",
  },
  {
    id: "d24-tau-nho-khong-giay-phep",
    dieu: 24,
    ten: "Tàu dưới 15 m không giấy phép khai thác",
    trich:
      "2. Phạt tiền từ 20.000.000 đồng đến 30.000.000 đồng đối với thuyền trưởng và chủ tàu cá vi phạm một trong các hành vi sau:\na) Sử dụng tàu cá có chiều dài lớn nhất từ 06 mét đến dưới 12 mét khai thác thủy sản trong vùng biển Việt Nam mà không có Giấy phép khai thác thủy sản hoặc Giấy phép khai thác thủy sản đã hết hạn;\n3. Phạt tiền từ 30.000.000 đồng đến 50.000.000 đồng đối với thuyền trưởng và chủ tàu cá vi phạm một trong các hành vi vi phạm như sau:\na) Sử dụng tàu cá có chiều dài lớn nhất từ 12 mét đến dưới 15 mét khai thác thủy sản trong vùng biển Việt Nam mà không có Giấy phép khai thác thủy sản hoặc Giấy phép khai thác thủy sản đã hết hạn;",
    luuY: [
      "Tàu 12–15 m tái phạm hoặc vi phạm nhiều lần: từ 60.000.000 đồng đến 100.000.000 đồng (khoản 4).",
      "Tịch thu thủy sản khai thác; tước văn bằng, chứng chỉ thuyền trưởng từ 06 tháng đến 12 tháng (khoản 5).",
    ],
    mau: "Tàu nhỏ cũng phải có giấy phép khai thác. Tàu từ 6 m đến dưới 12 m không có giấy phép hoặc giấy phép hết hạn, thuyền trưởng và chủ tàu bị phạt từ 20 đến 30 triệu đồng; tàu 12 đến dưới 15 m là 30 đến 50 triệu, tái phạm lên 60 đến 100 triệu, cá bị tịch thu, bằng thuyền trưởng bị tước 6 đến 12 tháng. Giấy phép làm ở Sở Nông nghiệp và Môi trường tỉnh, bà con đi làm sớm cho yên tâm.",
  },
  {
    id: "d24-sai-nghe",
    dieu: 24,
    ten: "Làm không đúng nghề ghi trong giấy phép",
    trich:
      "3. Phạt tiền từ 30.000.000 đồng đến 50.000.000 đồng đối với thuyền trưởng và chủ tàu cá vi phạm một trong các hành vi vi phạm như sau:\nb) Sử dụng tàu cá có chiều dài lớn nhất từ 15 mét trở lên khai thác thủy sản không đúng nghề ghi trong Giấy phép khai thác thủy sản.",
    luuY: [
      "Tàu 12–15 m làm sai nghề: từ 20.000.000 đồng đến 30.000.000 đồng (khoản 2 điểm b); tàu 6–12 m: từ 5.000.000 đồng đến 10.000.000 đồng (khoản 1 điểm b).",
      "Tịch thu ngư cụ; tước Giấy phép khai thác thủy sản từ 06 tháng đến 12 tháng (khoản 5).",
    ],
    mau: "Giấy phép ghi nghề nào thì làm nghề đó. Tàu từ 15 m trở lên làm sai nghề ghi trong giấy phép, thuyền trưởng và chủ tàu bị phạt từ 30 đến 50 triệu đồng, ngư cụ bị tịch thu, giấy phép bị tước 6 đến 12 tháng. Tàu 12 đến 15 m phạt từ 20 đến 30 triệu, tàu 6 đến 12 m từ 5 đến 10 triệu. Muốn đổi nghề thì xin cấp lại giấy phép trước, đừng đổi lưới rồi mới tính.",
  },
  {
    id: "d26-khong-nhat-ky",
    dieu: 26,
    ten: "Không có, không ghi, không nộp nhật ký khai thác",
    trich:
      "2. Phạt tiền từ 3.000.000 đồng đến 5.000.000 đồng đối với thuyền trưởng tàu cá vi phạm một trong các hành vi sau:\na) Không có hoặc không ghi hoặc không nộp nhật ký khai thác thủy sản, nhật ký thu mua chuyển tải thủy sản theo quy định đối với tàu cá có chiều dài lớn nhất từ 12 mét đến dưới 15 mét;\n3. Phạt tiền từ 5.000.000 đồng đến 10.000.000 đồng đối với thuyền trưởng tàu cá vi phạm một trong các hành vi sau:\na) Không có hoặc không ghi hoặc không nộp nhật ký khai thác thủy sản, nhật ký thu mua chuyển tải thủy sản theo quy định đối với tàu cá có chiều dài lớn nhất từ 15 mét đến dưới 24 mét;",
    luuY: [
      "Tàu từ 24 m không có, không ghi, không nộp nhật ký: từ 20.000.000 đồng đến 30.000.000 đồng (khoản 4 điểm b); tái phạm xử theo Điều 21, từ 300.000.000 đồng đến 500.000.000 đồng.",
      "Tàu 15–24 m tái phạm: từ 20.000.000 đồng đến 30.000.000 đồng (khoản 4 điểm a).",
      "Tước văn bằng, chứng chỉ thuyền trưởng từ 03 tháng đến 06 tháng (khoản 5 điểm a).",
    ],
    mau: "Tàu từ 12 m trở lên phải ghi và nộp nhật ký khai thác mỗi chuyến. Không có, không ghi hay không nộp: tàu 12 đến dưới 15 m thuyền trưởng bị phạt từ 3 đến 5 triệu đồng, tàu 15 đến dưới 24 m từ 5 đến 10 triệu, tàu từ 24 m từ 20 đến 30 triệu, tái phạm nặng hơn nhiều và bị tước bằng thuyền trưởng 3 đến 6 tháng. Không có nhật ký còn khó bán cá cho vựa cần truy xuất nguồn gốc. Ghi mỗi mẻ lưới vài dòng, ghi giấy hay ghi điện tử đều được.",
  },
  {
    id: "d26-ghi-sai",
    dieu: 26,
    ten: "Ghi nhật ký không đúng, không đủ",
    trich:
      "1. Phạt tiền từ 2.000.000 đồng đến 3.000.000 đồng đối với thuyền trưởng tàu cá vi phạm một trong các hành vi sau:\na) Không nộp báo cáo khai thác thủy sản hoặc báo cáo không đầy đủ, không đúng theo quy định đối với tàu cá có chiều dài lớn nhất từ 06 mét đến dưới 12 mét;\nb) Ghi không đúng hoặc ghi không đầy đủ nhật ký khai thác thủy sản, nhật ký thu mua chuyển tải thủy sản theo quy định đối với tàu cá có chiều dài lớn nhất từ 12 mét đến dưới 15 mét.",
    luuY: [
      "Ghi không đúng, không đủ: tàu 15–24 m từ 3.000.000 đồng đến 5.000.000 đồng (khoản 2 điểm b); tàu từ 24 m từ 5.000.000 đồng đến 10.000.000 đồng (khoản 3 điểm b).",
      "Tước văn bằng, chứng chỉ thuyền trưởng từ 03 tháng đến 06 tháng (khoản 5 điểm a).",
    ],
    mau: "Có nhật ký mà ghi thiếu, ghi sai cũng bị phạt: tàu 12 đến dưới 15 m thuyền trưởng bị phạt từ 2 đến 3 triệu đồng, tàu 15 đến 24 m từ 3 đến 5 triệu, tàu từ 24 m từ 5 đến 10 triệu, kèm tước bằng 3 đến 6 tháng. Tàu 6 đến 12 m không nộp báo cáo khai thác cũng phạt từ 2 đến 3 triệu. Ghi đúng tọa độ, giờ thả, giờ kéo, loài và sản lượng từng mẻ, đừng về bờ mới ngồi nhớ lại.",
  },
  {
    id: "d36-khong-dang-ky",
    dieu: 36,
    ten: "Tàu hoạt động không có giấy đăng ký",
    trich:
      "5. Phạt tiền đối với thuyền trưởng tàu cá, tàu phục vụ nuôi trồng thủy sản đang hoạt động mà không có Giấy chứng nhận đăng ký với các mức phạt như sau:\na) Phạt tiền từ 10.000.000 đồng đến 30.000.000 đồng đối với tàu có chiều dài lớn nhất từ 06 mét đến dưới 12 mét;\nb) Phạt tiền từ 30.000.000 đồng đến 50.000.000 đồng đối với tàu có chiều dài lớn nhất từ 12 mét đến dưới 15 mét;\nc) Phạt tiền từ 100.000.000 đồng đến 200.000.000 đồng đối với tàu có chiều dài lớn nhất từ 15 mét đến dưới 24 mét;\nd) Phạt tiền từ 300.000.000 đồng đến 500.000.000 đồng đối với tàu có chiều dài lớn nhất từ 24 mét trở lên.",
    luuY: [
      "Buộc chuyển đổi mục đích sử dụng hoặc phá dỡ tàu cá (khoản 6).",
      "Không mang theo bản chính hoặc bản sao chứng thực Giấy chứng nhận đăng ký tàu khi hoạt động: thuyền trưởng từ 1.000.000 đồng đến 2.000.000 đồng (khoản 1).",
    ],
    mau: "Tàu chạy mà không có giấy chứng nhận đăng ký là bị phạt rất nặng, từ 10 đến 30 triệu đồng với tàu 6 đến 12 m, lên tới 300 đến 500 triệu với tàu từ 24 m, và còn bị buộc phá dỡ hoặc chuyển mục đích sử dụng. Có giấy mà không mang theo cũng bị phạt 1 đến 2 triệu. Tàu mua lại, tàu tự đóng, bà con đi đăng ký trước rồi mới ra biển.",
  },
  {
    id: "d36-sang-ten",
    dieu: 36,
    ten: "Mua tàu không sang tên đúng hạn",
    trich:
      "2. Phạt tiền đối với tổ chức, cá nhân có hành vi không thực hiện đăng ký sang tên tàu cá, tàu phục vụ nuôi trồng thủy sản quá hạn theo quy định đến dưới 60 ngày với các mức phạt sau:\na) Phạt tiền từ 6.000.000 đồng đến 8.000.000 đồng đối với tàu có chiều dài lớn nhất từ 06 mét đến dưới 12 mét;\nb) Phạt tiền từ 10.000.000 đồng đến 20.000.000 đồng đối với tàu có chiều dài lớn nhất từ 12 mét đến dưới 15 mét;\nc) Phạt tiền từ 20.000.000 đồng đến 30.000.000 đồng đối với tàu có chiều dài lớn nhất từ 15 mét đến dưới 24 mét;\nd) Phạt tiền từ 30.000.000 đồng đến 50.000.000 đồng đối với tàu có chiều dài lớn nhất từ 24 mét trở lên.",
    luuY: [
      "Quá hạn từ 60 đến dưới 120 ngày: từ 10.000.000 đồng đến 100.000.000 đồng tùy chiều dài tàu (khoản 3).",
      "Quá hạn từ 120 ngày trở lên: từ 20.000.000 đồng đến 200.000.000 đồng tùy chiều dài tàu (khoản 4).",
    ],
    mau: "Mua bán tàu xong phải đi sang tên đúng hạn. Trễ dưới 60 ngày đã bị phạt từ 6 đến 8 triệu đồng với tàu 6 đến 12 m, 20 đến 30 triệu với tàu 15 đến 24 m, 30 đến 50 triệu với tàu từ 24 m. Trễ càng lâu phạt càng nặng, quá 120 ngày tàu lớn có thể tới 200 triệu. Giấy tờ mua bán xong là đi làm sang tên liền, đừng để qua mùa.",
  },
  {
    id: "d38-k3-so-dang-ky",
    dieu: 38,
    ten: "Không viết hoặc viết sai số đăng ký tàu",
    trich:
      "3. Phạt tiền đối với thuyền trưởng và chủ tàu cá, tàu phục vụ nuôi trồng thủy sản có hành vi sử dụng tàu mà không viết hoặc viết không đúng số đăng ký của tàu như sau:\na) Phạt tiền từ 5.000.000 đồng đến 10.000.000 đồng đối với tàu có chiều dài lớn nhất từ 06 mét đến dưới 12 mét;\nb) Phạt tiền từ 20.000.000 đồng đến 40.000.000 đồng đối với tàu có chiều dài lớn nhất từ 12 mét đến dưới 15 mét;\nc) Phạt tiền từ 100.000.000 đồng đến 200.000.000 đồng đối với tàu có chiều dài lớn nhất từ 15 mét đến dưới 24 mét;\nd) Phạt tiền từ 200.000.000 đồng đến 300.000.000 đồng đối với tàu có chiều dài lớn nhất từ 24 mét trở lên.",
    luuY: [
      "Tước văn bằng, chứng chỉ thuyền trưởng và tước Giấy phép khai thác thủy sản từ 06 tháng đến 12 tháng (khoản 4).",
      "Viết số đăng ký, tên tàu sai vị trí, kích thước, hình thức: chủ tàu từ 2.000.000 đồng đến 20.000.000 đồng tùy chiều dài (khoản 2); không đánh dấu tàu hoặc đánh dấu sai: từ 3.000.000 đồng đến 20.000.000 đồng (khoản 1).",
    ],
    mau: "Số đăng ký trên mạn tàu phải viết đúng số, đúng chỗ, rõ ràng. Không viết hoặc viết sai số, thuyền trưởng và chủ tàu bị phạt từ 5 đến 10 triệu đồng với tàu nhỏ, tàu 15 đến 24 m tới 100 đến 200 triệu, tàu từ 24 m 200 đến 300 triệu, kèm tước bằng và giấy phép 6 đến 12 tháng. Viết đúng số mà sai cỡ chữ, sai vị trí hay thiếu vạch đánh dấu vùng cũng bị phạt vài triệu tới vài chục triệu. Sơn lại số cho rõ trước mỗi mùa, bà con nghen.",
  },
  {
    id: "d34-k3-an-toan-ky-thuat",
    dieu: 34,
    ten: "Giấy chứng nhận an toàn kỹ thuật hết hạn",
    trich:
      "3. Phạt tiền đối với thuyền trưởng tàu cá, tàu phục vụ nuôi trồng thủy sản có hành vi sử dụng Giấy chứng nhận an toàn kỹ thuật đã hết hạn hoặc không có Giấy chứng nhận an toàn kỹ thuật khi hoạt động theo các mức phạt sau:\na) Phạt tiền từ 10.000.000 đồng đến 20.000.000 đồng đối với tàu có chiều dài lớn nhất từ 12 mét đến dưới 15 mét;\nb) Phạt tiền từ 20.000.000 đồng đến 30.000.000 đồng đối với tàu có chiều dài lớn nhất từ 15 mét đến dưới 24 mét;\nc) Phạt tiền từ 30.000.000 đồng đến 40.000.000 đồng đối với tàu có chiều dài lớn nhất từ 24 mét trở lên.",
    luuY: [
      "Tước văn bằng, chứng chỉ thuyền trưởng từ 01 tháng đến 03 tháng (khoản 4).",
      "Không mang bản chính hoặc bản sao chứng thực Giấy chứng nhận an toàn kỹ thuật còn hạn: từ 1.000.000 đồng đến 2.000.000 đồng (khoản 1).",
    ],
    mau: "Giấy chứng nhận an toàn kỹ thuật, bà con hay gọi là giấy đăng kiểm, hết hạn mà vẫn chạy thì thuyền trưởng bị phạt từ 10 đến 20 triệu đồng với tàu 12 đến 15 m, 20 đến 30 triệu với tàu 15 đến 24 m, 30 đến 40 triệu với tàu từ 24 m, kèm tước bằng 1 đến 3 tháng. Có giấy mà không mang theo cũng phạt 1 đến 2 triệu. Nhập ngày hết hạn vào tủ giấy tờ trong app, app sẽ nhắc trước cả tháng.",
  },
  {
    id: "d34-k2-trang-bi-an-toan",
    dieu: 34,
    ten: "Thiếu trang thiết bị an toàn trên tàu",
    trich:
      "2. Phạt tiền đối với chủ tàu cá, tàu phục vụ nuôi trồng thủy sản có hành vi không trang bị hoặc trang bị không đầy đủ trang thiết bị an toàn tàu cá, tàu phục vụ nuôi trồng thủy sản theo các mức phạt sau:\na) Phạt tiền từ 300.000 đồng đến 500.000 đồng đối với tàu có chiều dài lớn nhất dưới 06 mét;\nb) Phạt tiền từ 1.000.000 đồng đến 2.000.000 đồng đối với tàu có chiều dài lớn nhất từ 06 mét đến dưới 12 mét;\nc) Phạt tiền từ 3.000.000 đồng đến 5.000.000 đồng đối với tàu có chiều dài lớn nhất từ 12 mét đến dưới 15 mét;\nd) Phạt tiền từ 5.000.000 đồng đến 10.000.000 đồng đối với tàu có chiều dài lớn nhất từ 15 mét đến dưới 24 mét;\nđ) Phạt tiền từ 10.000.000 đồng đến 20.000.000 đồng đối với tàu có chiều dài lớn nhất từ 24 mét trở lên.",
    mau: "Phao cứu sinh, bình chữa cháy, đèn hiệu, máy liên lạc là đồ giữ mạng, luật cũng bắt phải có đủ. Thiếu hay không đủ thì chủ tàu bị phạt từ 300 đến 500 nghìn đồng với tàu dưới 6 m, tới 10 đến 20 triệu với tàu từ 24 m. Trước mỗi chuyến đi, bà con đếm lại phao đủ cho từng người trên tàu, bình chữa cháy còn hạn chưa.",
  },
  {
    id: "d39-thuyen-vien-giay-to",
    dieu: 39,
    ten: "Thuyền viên không giấy tờ, không có tên trong sổ danh bạ",
    trich:
      "1. Phạt tiền đối với thuyền trưởng tàu cá từ 500.000 đồng đến 1.000.000 đồng đối với hành vi thuyền viên, người làm việc trên tàu không mang theo giấy tờ tùy thân.\n2. Phạt tiền từ 1.000.000 đồng đến 2.000.000 đồng đối với thuyền trưởng có một trong các hành vi vi phạm sau:\na) Thuyền viên trên tàu không có tên trong Sổ danh bạ thuyền viên tàu;\nb) Không có Sổ danh bạ thuyền viên tàu cá theo quy định;\nc) Không bố trí đủ chức danh, định biên an toàn tối thiểu trên tàu cá theo quy định.",
    luuY: ["Thuyền trưởng, máy trưởng, thuyền phó, thợ máy không có văn bằng, chứng chỉ: từ 2.000.000 đồng đến 10.000.000 đồng tùy chiều dài tàu (khoản 3)."],
    mau: "Bạn thuyền lên tàu phải mang theo căn cước và có tên trong sổ danh bạ thuyền viên. Người nào không mang giấy tờ, thuyền trưởng bị phạt từ 500 nghìn đến 1 triệu đồng; bạn không có tên trong sổ, không có sổ, hay thiếu chức danh định biên thì phạt từ 1 đến 2 triệu. Thuyền trưởng, máy trưởng không có bằng, chứng chỉ phạt thêm 2 đến 10 triệu. Sổ thuyền viên trong app có sẵn, bà con nhập bạn thuyền mỗi chuyến cho tiện.",
  },
  {
    id: "d39-k4-bao-hiem",
    dieu: 39,
    ten: "Không mua bảo hiểm cho thuyền viên",
    trich:
      "4. Phạt tiền đối với chủ tàu cá có hành vi không mua bảo hiểm theo quy định cho thuyền viên tàu cá theo các mức phạt sau:\na) Phạt tiền từ 5.000.000 đồng đến 7.000.000 đồng đối với trường hợp vi phạm dưới 03 thuyền viên làm việc trên tàu cá;\nb) Phạt tiền từ 7.000.000 đồng đến 10.000.000 đồng đối với trường hợp vi phạm từ 03 đến dưới 05 thuyền viên làm việc trên tàu cá;\nc) Phạt tiền từ 10.000.000 đồng đến 15.000.000 đồng đối với trường hợp vi phạm từ 05 đến dưới 10 thuyền viên làm việc trên tàu cá;\nd) Phạt tiền từ 15.000.000 đồng đến 20.000.000 đồng đối với trường hợp vi phạm từ 10 thuyền viên trở lên làm việc trên tàu cá.",
    mau: "Chủ tàu phải mua bảo hiểm cho bạn thuyền. Không mua là bị phạt từ 5 đến 7 triệu đồng nếu thiếu dưới 3 người, lên tới 15 đến 20 triệu nếu thiếu từ 10 người. Bảo hiểm vài trăm nghìn một người một năm, có chuyện ngoài biển thì gia đình bạn thuyền còn có chỗ dựa. Mua cho đủ người trước khi xuất bến, bà con nghen.",
  },
  {
    id: "d41-k5-khong-cap-cang",
    dieu: 41,
    ten: "Không cập cảng cá để bốc dỡ",
    trich:
      "5. Phạt tiền đối với thuyền trưởng có hành vi không cập cảng cá để bốc dỡ thủy sản theo quy định như sau:\na) Phạt tiền từ 500.000 đồng đến 1.000.000 đồng đối với tàu có chiều dài lớn nhất từ 06 mét đến dưới 12 mét;\nb) Phạt tiền từ 2.000.000 đồng đến 3.000.000 đồng đối với tàu có chiều dài lớn nhất từ 12 mét đến dưới 15 mét;\nc) Phạt tiền từ 20.000.000 đồng đến 30.000.000 đồng đối với tàu có chiều dài lớn nhất từ 15 mét trở lên.",
    luuY: ["Tàu từ 15 m: tước văn bằng, chứng chỉ thuyền trưởng từ 01 tháng đến 03 tháng (khoản 6)."],
    mau: "Tàu từ 6 m trở lên về phải vào cảng cá để bốc dỡ, không được cập bến tự do. Tàu từ 15 m không cập cảng là thuyền trưởng bị phạt từ 20 đến 30 triệu đồng, tước bằng 1 đến 3 tháng; tàu 12 đến 15 m phạt từ 2 đến 3 triệu, tàu nhỏ hơn từ 500 nghìn đến 1 triệu. Vào cảng còn được cấp giấy biên nhận bốc dỡ, cá mới bán được cho nhà máy xuất khẩu.",
  },
  {
    id: "d41-k1-bao-cang",
    dieu: 41,
    ten: "Không báo trước khi vào, rời cảng",
    trich:
      "1. Phạt tiền từ 2.000.000 đồng đến 5.000.000 đồng đối với thuyền trưởng tàu cá có một trong các hành vi sau:\na) Không thông báo hoặc thông báo không đầy đủ hoặc sai lệch thông tin theo quy định về thời gian cập cảng, sản lượng qua cảng cho tổ chức quản lý cảng cá trước khi vào hoặc thông tin rời cảng cá theo quy định;\nb) Không tuân thủ nội quy, sự điều động của tổ chức quản lý cảng cá, khu neo đậu tránh trú bão, trừ trường hợp bất khả kháng.",
    mau: "Trước khi vào cảng phải báo cho ban quản lý cảng giờ cập và sản lượng trên tàu, rời cảng cũng phải báo. Không báo, báo thiếu hay báo sai, thuyền trưởng bị phạt từ 2 đến 5 triệu đồng. Không nghe điều động của cảng, của khu neo đậu tránh bão cũng mức đó. Gọi cho cảng một cuộc trước khi vào, vừa đúng luật vừa có chỗ đậu sẵn.",
  },
  {
    id: "d28-k3-nghe-cam",
    dieu: 28,
    ten: "Dùng nghề cấm, ngư cụ cấm",
    trich:
      "3. Phạt tiền từ 30.000.000 đồng đến 50.000.000 đồng thuyền trưởng tàu cá có hành vi sử dụng nghề cấm, ngư cụ cấm để khai thác thủy sản mà chưa đến mức truy cứu trách nhiệm hình sự.",
    luuY: [
      "Tịch thu ngư cụ cấm; tước văn bằng, chứng chỉ thuyền trưởng từ 03 tháng đến 06 tháng (khoản 4).",
      "Không đánh dấu ngư cụ hoặc vứt bỏ ngư cụ xuống biển: từ 3.000.000 đồng đến 5.000.000 đồng (khoản 1); thả neo nơi có ngư cụ của người khác đang khai thác hợp pháp: từ 5.000.000 đồng đến 10.000.000 đồng (khoản 2).",
    ],
    mau: "Nghề cấm, ngư cụ cấm như giã cào bay, lưới mắt quá nhỏ ở vùng cấm, thuyền trưởng bị phạt từ 30 đến 50 triệu đồng, ngư cụ bị tịch thu, bằng bị tước 3 đến 6 tháng, nặng có thể xử hình sự. Lưới không đánh dấu hay vứt lưới hỏng xuống biển phạt 3 đến 5 triệu, thả neo trúng chỗ lưới người khác đang làm phạt 5 đến 10 triệu. Giữ biển còn cá cho con cháu, bà con mình cùng làm nghề cho sạch.",
  },
  {
    id: "d29-kich-dien",
    dieu: 29,
    ten: "Dùng kích điện, dòng điện bắt cá",
    trich:
      "2. Phạt tiền thuyền trưởng tàu cá đối với hành vi sử dụng công cụ kích điện hoặc sử dụng trực tiếp dòng điện từ máy phát điện trên tàu cá để khai thác thủy sản mà chưa đến mức truy cứu trách nhiệm hình sự theo các mức phạt sau:\na) Phạt tiền từ 5.000.000 đồng đến 10.000.000 đồng đối với trường hợp tàu cá có chiều dài lớn nhất dưới 06 mét;\nb) Phạt tiền từ 15.000.000 đồng đến 20.000.000 đồng đối với trường hợp tàu cá có chiều dài lớn nhất từ 06 mét đến dưới 12 mét;\nc) Phạt tiền từ 20.000.000 đồng đến 30.000.000 đồng đối với trường hợp tàu cá có chiều dài lớn nhất từ 12 mét đến dưới 15 mét;\nd) Phạt tiền từ 30.000.000 đồng đến 40.000.000 đồng đối với trường hợp tàu cá có chiều dài lớn nhất từ 15 mét trở lên.",
    luuY: [
      "Tịch thu công cụ kích điện, máy phát điện và ngư cụ; tịch thu thủy sản đã chết; tước văn bằng, chứng chỉ thuyền trưởng từ 03 tháng đến 06 tháng với tàu từ 06 mét (khoản 4).",
      "Kích điện không dùng tàu cá: từ 3.000.000 đồng đến 5.000.000 đồng (khoản 1); dùng điện lưới: từ 40.000.000 đồng đến 50.000.000 đồng (khoản 3).",
    ],
    mau: "Chích điện bắt cá là tận diệt, cá lớn cá bé chết hết. Thuyền trưởng dùng kích điện hay kéo điện từ máy phát trên tàu bị phạt từ 5 đến 10 triệu đồng với ghe dưới 6 m, tới 30 đến 40 triệu với tàu từ 15 m; bộ kích, máy phát, ngư cụ và cá bị tịch thu, bằng bị tước 3 đến 6 tháng. Thấy ai chích điện trên vùng biển nhà mình, bà con báo cho biên phòng hay kiểm ngư.",
  },
  {
    id: "d30-chat-no",
    dieu: 30,
    ten: "Dùng chất nổ, chất độc bắt cá",
    trich:
      "1. Phạt tiền thuyền trưởng tàu cá đối với hành vi sử dụng chất cấm, hóa chất cấm, chất độc, chất nổ để khai thác thủy sản mà chưa đến mức truy cứu trách nhiệm hình sự theo các mức phạt sau:\na) Phạt tiền từ 5.000.000 đồng đến 10.000.000 đồng đối với trường hợp tàu cá có chiều dài lớn nhất dưới 06 mét;\nb) Phạt tiền từ 10.000.000 đồng đến 20.000.000 đồng đối với trường hợp tàu cá có chiều dài lớn nhất từ 06 mét đến dưới 15 mét;\nc) Phạt tiền từ 20.000.000 đồng đến 30.000.000 đồng đối với trường hợp tàu cá có chiều dài lớn nhất từ 15 mét đến dưới 24 mét;\nd) Phạt tiền từ 30.000.000 đồng đến 50.000.000 đồng đối với trường hợp tàu cá có chiều dài lớn nhất từ 24 mét trở lên.",
    luuY: [
      "Tịch thu chất nổ; tước văn bằng, chứng chỉ thuyền trưởng và tước Giấy phép khai thác thủy sản từ 03 tháng đến 06 tháng với tàu từ 06 mét (khoản 2).",
      "Buộc tiêu hủy chất cấm và thủy sản khai thác được (khoản 3).",
    ],
    mau: "Đánh cá bằng thuốc nổ, thuốc độc vừa giết rạn san hô vừa nguy hiểm cho chính người trên tàu. Thuyền trưởng bị phạt từ 5 đến 10 triệu đồng với ghe nhỏ, tới 30 đến 50 triệu với tàu từ 24 m, tước bằng và giấy phép 3 đến 6 tháng, cá bắt được bị tiêu hủy, nặng là đi tù. Rạn hỏng rồi mười năm cá không về. Đừng ai làm, bà con nghen.",
  },
  {
    id: "d32-treo-co",
    dieu: 32,
    ten: "Không treo cờ Tổ quốc trên tàu",
    trich:
      "1. Phạt tiền từ 2.000.000 đồng đến 4.000.000 đồng đối với thuyền trưởng tàu cá có hành vi treo cờ không đúng quy định hoặc không treo cờ nước Cộng hòa xã hội chủ nghĩa Việt Nam trên tàu cá khi hoạt động.\n2. Phạt tiền từ 5.000.000 đồng đến 10.000.000 đồng đối với thuyền trưởng tàu cá có hành vi vi phạm quy định tại khoản 1 Điều này trong trường hợp tái phạm hoặc vi phạm hành chính nhiều lần.",
    mau: "Tàu ra biển phải treo cờ Tổ quốc, treo đúng chỗ, cờ còn lành. Không treo hay treo không đúng, thuyền trưởng bị phạt từ 2 đến 4 triệu đồng, tái phạm 5 đến 10 triệu. Lá cờ trên nóc tàu là chủ quyền của mình ngoài khơi, cờ bạc màu, rách thì thay cờ mới trước chuyến đi.",
  },
  {
    id: "d45-can-tro-kiem-tra",
    dieu: 45,
    ten: "Không chấp hành kiểm tra",
    trich:
      "1. Phạt tiền từ 5.000.000 đồng đến 10.000.000 đồng đối với hành vi không chấp hành hoặc xúi giục, lôi kéo người khác không chấp hành việc thanh tra, kiểm tra, giám sát của cơ quan nhà nước có thẩm quyền hoặc có lời nói, hành động đe dọa, lăng mạ, xúc phạm danh dự, nhân phẩm người thi hành công vụ.",
    mau: "Kiểm ngư, biên phòng, cảnh sát biển ra hiệu dừng tàu kiểm tra thì mình dừng, trình giấy tờ. Không chấp hành, bỏ chạy, hay rủ tàu khác không chấp hành, nói lời đe dọa, xúc phạm người thi hành công vụ là bị phạt từ 5 đến 10 triệu đồng, chưa kể lỗi đang bị kiểm tra. Giấy tờ đủ thì kiểm tra vài phút là xong, bà con bình tĩnh hợp tác.",
  },
  {
    id: "d5-k9-k10-tang-nang",
    dieu: 5,
    ten: "Mất kết nối nhiều lần là tăng nặng; chủ tàu kiêm thuyền trưởng",
    trich:
      "9. Trường hợp tàu cá mất kết nối tín hiệu giám sát hành trình nhiều lần trong cùng một chuyến biển mà chủ tàu, thuyền trưởng không thực hiện đúng quy định báo cáo vị trí theo quy định thì xử phạt hành chính tương ứng với hành vi vi phạm quy định tại Nghị định này và áp dụng tình tiết tăng nặng vi phạm hành chính nhiều lần.\n10. Việc xử phạt vi phạm hành chính đồng thời đối với thuyền trưởng và chủ tàu cá quy định tại Nghị định này được thực hiện như sau:\na) Trường hợp chủ tàu cá không đồng thời là thuyền trưởng tàu cá thì từng đối tượng vi phạm đều bị áp dụng các hình thức xử phạt, biện pháp khắc phục hậu quả quy định tương ứng đối với đối tượng và hành vi vi phạm hành chính đó;\nb) Trường hợp chủ tàu cá đồng thời là thuyền trưởng tàu cá thì chỉ áp dụng hình thức xử phạt chính, các hình thức xử phạt bổ sung và biện pháp khắc phục hậu quả quy định đối với hành vi vi phạm hành chính đó đối với chủ tàu cá.",
    mau: "Hai điều bà con hay hỏi Sen Biển. Một: trong cùng một chuyến mà máy giám sát hành trình mất kết nối nhiều lần, không báo vị trí đúng quy định, thì ngoài phạt còn bị tính tình tiết tăng nặng vì vi phạm nhiều lần. Hai: chủ tàu và thuyền trưởng là hai người khác nhau thì mỗi người bị phạt phần của mình; còn chủ tàu tự làm thuyền trưởng thì chỉ chịu một mức phạt của chủ tàu.",
  },
  {
    id: "d3-thoi-hieu",
    dieu: 3,
    ten: "Thời hiệu xử phạt 2 năm",
    trich: "Thời hiệu xử phạt vi phạm hành chính trong lĩnh vực thủy sản là 02 năm theo quy định tại điểm a khoản 1 Điều 6 Luật Xử lý vi phạm hành chính.",
    luuY: [
      "Điều 63: vi phạm xảy ra và kết thúc trước 18/8/2026 mà sau này mới bị phát hiện thì xử theo nghị định có hiệu lực lúc vi phạm; vi phạm bắt đầu trước nhưng còn kéo dài sau 18/8/2026 thì xử theo Nghị định 246/2026.",
    ],
    mau: "Vi phạm trong nghề cá có thời hiệu xử phạt 2 năm, nghĩa là chuyện làm từ hai năm trước vẫn có thể bị phạt nếu bị phát hiện. Lỗi làm xong trước ngày 18/8/2026 thì xử theo nghị định cũ lúc đó, còn lỗi kéo dài qua ngày 18/8/2026 thì theo nghị định mới. Dữ liệu giám sát hành trình lưu lâu, bà con đừng nghĩ qua chuyến là xong.",
  },
];

/** Tên hiển thị của một mục, cho log máy GPU. */
export const tenMuc = (m) => `Điều ${m.dieu} — ${m.ten}`;

/** Dòng căn cứ cuối bài — máy chủ bắt bài phải có. */
export function canCu(m) {
  return `Điều ${m.dieu} ${NGHI_DINH}, hiệu lực từ ${HIEU_LUC}. Mức tiền là với cá nhân, tổ chức gấp đôi. Mức phạt cụ thể do cơ quan có thẩm quyền quyết định theo từng vụ việc.`;
}

/**
 * Ghép bài đăng: giải thích + trích nguyên văn (ngoặc kép) + căn cứ. Dùng ở máy GPU; máy chủ kiểm bằng loiBaiLuat.
 * @param {string} giaiThich
 * @param {MucLuat} m
 */
export function ghepBai(giaiThich, m) {
  return `${String(giaiThich).trim()}\n\nTrích ${NGHI_DINH}:\n“${m.trich}”\n\n${canCu(m)}`;
}

/**
 * Chọn mục cho lượt này: đi THEO THỨ TỰ kho (loạt bài có đầu có đuôi), bỏ mục đã đăng trong KHONG_LAP_NGAY ngày; hết
 * sạch thì lấy mục đăng LÂU NHẤT. Thuần.
 * @param {{ id: string, at: string }[]} daDung
 * @param {number} now
 * @returns {MucLuat}
 */
export function chonMuc(daDung, now) {
  const lanCuoi = new Map();
  for (const d of Array.isArray(daDung) ? daDung : []) {
    const t = Date.parse(d?.at);
    if (typeof d?.id === "string" && Number.isFinite(t)) lanCuoi.set(d.id, Math.max(lanCuoi.get(d.id) ?? 0, t));
  }
  const han = now - KHONG_LAP_NGAY * 86_400_000;
  const con = MUC.find((m) => (lanCuoi.get(m.id) ?? 0) < han);
  if (con) return con;
  return [...MUC].sort((a, b) => (lanCuoi.get(a.id) ?? 0) - (lanCuoi.get(b.id) ?? 0))[0];
}

/** Prompt cho Claude viết PHẦN GIẢI THÍCH — chỉ từ trích + lưu ý, không đổi số. */
export function promptLuat(m) {
  return [
    "Bạn là Sen Biển, trợ lý của một app dành cho ngư dân Việt Nam. Viết PHẦN GIẢI THÍCH ngắn cho một bài tuyên truyền pháp luật trên mạng xã hội Kairos trong app: giải thích cho bà con đi biển hiểu điều khoản dưới đây nói gì và nên làm gì để không bị phạt.",
    "Yêu cầu: 3–5 câu tiếng Việt đời thường, thân thiện, xưng \"Sen Biển\" khi cần, gọi \"bà con\"; được dùng chút giọng miền biển nhẹ (\"nghen\", \"nha\"). CHỈ dùng số tiền, chiều dài tàu, số tháng, số ngày có trong TRÍCH và LƯU Ý — viết số tiền kiểu \"300 đến 500 triệu đồng\"; không thêm mức phạt, điều luật, thủ tục, lời hứa nào khác; không nói \"theo tôi\", không bịa ví dụ có tên người. Không emoji, không hashtag, không đường link, không tiêu đề, không chép lại nguyên văn trích (phần trích app tự gắn sau).",
    "Gọi đúng tên Biển Đông, Hoàng Sa, Trường Sa của Việt Nam; không bao giờ dùng tên nước ngoài cho các vùng biển, đảo này.",
    "",
    `ĐIỀU KHOẢN: Điều ${m.dieu} ${NGHI_DINH} (hiệu lực ${HIEU_LUC}) — ${m.ten}`,
    "TRÍCH NGUYÊN VĂN:",
    m.trich,
    ...(m.luuY?.length ? ["LƯU Ý (cũng từ văn bản):", ...m.luuY.map((d) => `- ${d}`)] : []),
    "",
    'CHỈ trả về JSON đúng một dòng: {"giaiThich":"..."}',
  ].join("\n");
}

/** Mọi số "N.NNN.NNN đồng" trong chữ ⇒ tập số triệu (300.000.000 ⇒ 300; 500.000 ⇒ 0.5). */
export function soTrieuTrong(text) {
  const out = new Set();
  for (const m of String(text ?? "").matchAll(/(\d{1,3}(?:\.\d{3})+)\s*đồng/g)) out.add(Number(m[1].replace(/\./g, "")) / 1_000_000);
  return out;
}

/** Số tiền kiểu đời thường trong giải thích: "300 đến 500 triệu", "1 tỷ", "500 nghìn" ⇒ tập số triệu. */
export function soTrieuDoiThuong(text) {
  const out = new Set();
  const t = String(text ?? "");
  for (const m of t.matchAll(/(\d+(?:[,.]\d+)?)\s*(?:đến|tới|-|–)?\s*(?:(\d+(?:[,.]\d+)?)\s*)?(triệu|tỷ|nghìn|ngàn)/g)) {
    const don = m[3] === "tỷ" ? 1000 : m[3] === "triệu" ? 1 : 0.001;
    for (const s of [m[1], m[2]]) if (s) out.add(Number(s.replace(",", ".")) * don);
  }
  return out;
}

/**
 * Kiểm phần GIẢI THÍCH (Claude hoặc mẫu): độ dài, không link/emoji/hashtag, chủ quyền, và MỌI số tiền nhắc tới phải có
 * trong trích + lưu ý của mục (chặn bịa mức phạt). Trả mã lỗi hoặc null.
 * @param {unknown} text
 * @param {MucLuat} m
 */
export function loiGiaiThich(text, m) {
  if (typeof text !== "string") return "khong_phai_chu";
  const t = text.trim();
  const n = [...t].length;
  if (n < GIAI_THICH_TOI_THIEU) return "qua_ngan";
  if (n > GIAI_THICH_TOI_DA) return "qua_dai";
  if (/https?:\/\/|www\./i.test(t)) return "co_link";
  if (/#\p{L}/u.test(t)) return "co_hashtag";
  if (/\p{Extended_Pictographic}/u.test(t)) return "co_emoji";
  if (chuQuyenFlag(t)) return "chu_quyen";
  const duoc = soTrieuTrong(`${m.trich}\n${(m.luuY ?? []).join("\n")}`);
  for (const s of soTrieuDoiThuong(t)) if (!duoc.has(s)) return "sai_so_tien";
  return null;
}

/**
 * Kiểm CẢ BÀI trước khi đăng (máy chủ): phải chứa nguyên văn trích + dòng căn cứ của đúng mục, giải thích đứng trước qua
 * loiGiaiThich, cả bài dưới trần. Trả mã lỗi hoặc null.
 * @param {unknown} body
 * @param {MucLuat} m
 */
export function loiBaiLuat(body, m) {
  if (typeof body !== "string") return "khong_phai_chu";
  const t = body.trim();
  if ([...t].length > BAI_TOI_DA) return "qua_dai";
  const i = t.indexOf(`“${m.trich}”`);
  if (i < 0) return "thieu_trich";
  if (!t.endsWith(canCu(m))) return "thieu_can_cu";
  const giaiThich = t.slice(0, i).replace(/\n*Trích [^\n]*:\s*$/u, "").trim();
  return loiGiaiThich(giaiThich, m);
}
