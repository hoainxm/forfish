// Tổng hợp THAM KHẢO từ Nghị định 38/2024/NĐ-CP (hiệu lực 20/5/2024) — mức phạt CÁ NHÂN.
// Mức phạt với tổ chức thường GẤP ĐÔI mức cá nhân (Điều 5 Nghị định 38/2024/NĐ-CP).
// Lưu ý: Nghị định 301/2025/NĐ-CP (hiệu lực 17/11/2025) đã sửa đổi một số mức phạt —
// mục nào lấy theo mức sửa đổi sẽ ghi rõ trong note.
// Nguồn:
// - https://thuvienphapluat.vn/van-ban/Vi-pham-hanh-chinh/Nghi-dinh-38-2024-ND-CP-xu-phat-vi-pham-hanh-chinh-linh-vuc-thuy-san-605599.aspx
// - https://vanban.chinhphu.vn/?pageid=27160&docid=210051
// - https://thuysanvietnam.com.vn/khong-co-giay-phep-khi-khai-thac-thuy-san-tren-bien-co-the-bi-phat-toi-1-ty-dong/
// - https://xaydungchinhsach.chinhphu.vn/su-dung-chat-no-de-khai-thac-thuy-san-bi-phat-toi-70-trieu-dong-119240411094302738.htm
// - https://baochinhphu.vn/sua-doi-mot-so-quy-dinh-ve-xu-phat-vi-pham-hanh-chinh-trong-linh-vuc-thuy-san-10225111810313956.htm
// - https://hethongphapluat.com/nghi-dinh-38-2024-nd-cp-quy-dinh-ve-xu-phat-vi-pham-hanh-chinh-trong-linh-vuc-thuy-san.html
// Đây KHÔNG phải tư vấn pháp lý; mức phạt thật tùy hành vi cụ thể, tình tiết tăng nặng/giảm nhẹ.

export const FINES_SOURCE = "Nghị định 38/2024/NĐ-CP";
export const FINES_DATE = "2026-06-10";

export interface Fine {
  id: string;
  behavior: string;
  rangeVnd: string;
  article?: string;
  severity: "high" | "medium" | "low";
  note?: string;
}

export const FINES: Fine[] = [
  {
    id: "giay-phep-tau-24m",
    behavior:
      "Tàu từ 24 m đi đánh bắt trên biển không có giấy phép khai thác, hoặc giấy phép đã hết hạn",
    rangeVnd: "800 triệu – 1 tỷ đồng",
    article: "Điều 20 khoản 3",
    severity: "high",
    note: "Có thể bị tịch thu tàu, tước bằng thuyền trưởng 6 – 12 tháng.",
  },
  {
    id: "giay-phep-tau-15-24m",
    behavior:
      "Tàu từ 15 m đến dưới 24 m đi đánh bắt trên biển không có giấy phép khai thác, hoặc giấy phép đã hết hạn",
    rangeVnd: "300 – 500 triệu đồng",
    article: "Điều 20 khoản 1",
    severity: "high",
    note: "Tái phạm hoặc vi phạm nhiều lần: 500 – 700 triệu đồng.",
  },
  {
    id: "giay-phep-tau-12-15m",
    behavior:
      "Tàu từ 12 m đến dưới 15 m đi đánh bắt trên biển không có giấy phép khai thác",
    rangeVnd: "20 – 30 triệu đồng",
    article: "Điều 23 khoản 2",
    severity: "medium",
    note: "Tái phạm hoặc vi phạm nhiều lần có thể bị phạt 60 – 100 triệu đồng.",
  },
  {
    id: "khong-mang-giay-phep",
    behavior:
      "Có giấy phép khai thác nhưng không mang theo (bản chính hoặc bản sao có chứng thực) khi đi biển",
    rangeVnd: "5 – 10 triệu đồng",
    article: "Điều 23 khoản 1",
    severity: "low",
    note: "Trước khi đi biển nên kiểm tra lại túi giấy tờ trên tàu.",
  },
  {
    id: "vung-bien-nuoc-ngoai",
    behavior:
      "Đưa tàu sang vùng biển nước ngoài đánh bắt khi không được phép (vượt ranh giới cho phép trên biển)",
    rangeVnd: "800 triệu – 1 tỷ đồng",
    article: "Điều 20 khoản 3",
    severity: "high",
    note: "Lỗi IUU nặng nhất. Có thể bị tịch thu tàu, tịch thu hải sản, tước bằng thuyền trưởng; chủ tàu còn phải trả chi phí đưa thuyền viên bị nước ngoài bắt giữ về nước.",
  },
  {
    id: "vms-tau-24m",
    behavior:
      "Không có, không bật hoặc ngắt máy giám sát hành trình khi đi biển (tàu từ 24 m)",
    rangeVnd: "300 – 500 triệu đồng",
    article: "Điều 20 khoản 1",
    severity: "high",
    note: "Tái phạm hoặc vi phạm nhiều lần: 500 – 700 triệu đồng.",
  },
  {
    id: "vms-tau-15-24m",
    behavior:
      "Không lắp, không bật hoặc không duy trì máy giám sát hành trình khi đi biển (tàu từ 15 m đến dưới 24 m)",
    rangeVnd: "100 – 300 triệu đồng",
    severity: "high",
    note: "Mức theo quy định sửa đổi cuối 2025 (Nghị định 301/2025/NĐ-CP). Máy hỏng giữa biển phải báo vị trí về bờ 6 giờ một lần và đưa tàu về cảng trong 10 ngày.",
  },
  {
    id: "vms-gui-tau-khac",
    behavior:
      "Gửi máy giám sát hành trình của tàu mình sang tàu khác, hoặc giữ hộ máy của tàu khác đang đi biển",
    rangeVnd: "50 – 100 triệu đồng",
    article: "Điều 35 khoản 5",
    severity: "medium",
    note: "Đây là hành vi đối phó hay bị kiểm tra gắt, dễ bị xếp vào vi phạm IUU.",
  },
  {
    id: "nhat-ky-khai-thac",
    behavior:
      "Không có hoặc không ghi nhật ký khai thác mỗi chuyến biển (tàu từ 15 m đến dưới 24 m)",
    rangeVnd: "5 – 10 triệu đồng",
    article: "Điều 25 khoản 3",
    severity: "low",
    note: "Tàu 12 – 15 m: 3 – 5 triệu đồng. Tái phạm với tàu 15 – 24 m: 20 – 30 triệu đồng. Không có nhật ký còn khó bán cá cho vựa cần truy xuất nguồn gốc.",
  },
  {
    id: "khong-nop-nhat-ky",
    behavior:
      "Không nộp nhật ký khai thác hoặc báo cáo khai thác cho cảng cá đúng hạn sau chuyến biển",
    rangeVnd: "2 – 10 triệu đồng",
    article: "Điều 25",
    severity: "low",
    note: "Mức tùy chiều dài tàu; tàu nhỏ 6 – 12 m không nộp báo cáo: 2 – 3 triệu đồng.",
  },
  {
    id: "sai-vung-tau-nho",
    behavior:
      "Tàu dưới 12 m ra đánh bắt ở vùng lộng hoặc vùng khơi (vùng dành cho tàu lớn hơn)",
    rangeVnd: "10 – 15 triệu đồng",
    article: "Điều 21 khoản 2",
    severity: "low",
    note: "Tàu nhỏ chỉ được đánh ở vùng ven bờ theo giấy phép.",
  },
  {
    id: "sai-vung-tau-12-15m",
    behavior:
      "Tàu từ 12 m đến dưới 15 m đánh bắt sai vùng (vào sát bờ hoặc ra vùng khơi)",
    rangeVnd: "15 – 20 triệu đồng",
    article: "Điều 21 khoản 3",
    severity: "medium",
    note: "Tàu làm nghề lưới kéo vi phạm vùng ven bờ bị phạt gấp đôi.",
  },
  {
    id: "kich-dien",
    behavior: "Dùng kích điện, xung điện để bắt cá (chưa đến mức xử lý hình sự)",
    rangeVnd: "3 – 5 triệu đồng",
    article: "Điều 28",
    severity: "low",
    note: "Tàng trữ, mua bán công cụ kích điện: 10 – 15 triệu đồng. Bị tịch thu đồ nghề; nặng có thể bị xử lý hình sự.",
  },
  {
    id: "dien-may-phat",
    behavior: "Dùng dòng điện từ máy phát trên tàu để đánh cá",
    rangeVnd: "5 – 40 triệu đồng",
    article: "Điều 28",
    severity: "medium",
    note: "Mức tùy chiều dài tàu; tàu từ 15 m: 30 – 40 triệu đồng. Bị tịch thu máy phát và ngư cụ, có thể bị tước giấy phép khai thác 3 – 6 tháng.",
  },
  {
    id: "chat-no-chat-doc",
    behavior: "Dùng chất nổ, chất độc, hóa chất cấm để đánh bắt",
    rangeVnd: "50 – 70 triệu đồng",
    severity: "medium",
    note: "Mức phạt hành chính khi chưa đến mức xử lý hình sự; vụ nặng sẽ bị truy cứu hình sự. Tàng trữ chất cấm, chất nổ trên tàu cũng bị phạt 3 – 25 triệu đồng tùy cỡ tàu.",
  },
  {
    id: "loai-nguy-cap",
    behavior:
      "Bắt, giữ các loài nguy cấp, quý, hiếm bị cấm khai thác (rùa biển, cá heo, trai tai tượng...)",
    rangeVnd: "10 – 200 triệu đồng",
    article: "Điều 8",
    severity: "high",
    note: "Mức tùy nhóm loài và khối lượng. Vướng lưới thì thả ngay khi còn sống; vụ nặng có thể bị xử lý hình sự.",
  },
  {
    id: "danh-dau-tau",
    behavior:
      "Không kẻ số đăng ký, không sơn đánh dấu tàu theo quy định (tàu từ 6 m)",
    rangeVnd: "500 nghìn – 5 triệu đồng",
    article: "Điều 36",
    severity: "low",
    note: "Mức tùy chiều dài tàu; tàu từ 24 m: 3 – 5 triệu đồng.",
  },
  {
    id: "bang-thuyen-truong",
    behavior:
      "Thuyền trưởng, máy trưởng làm việc trên tàu mà không có văn bằng, chứng chỉ theo quy định",
    rangeVnd: "3 – 5 triệu đồng",
    article: "Điều 38 khoản 3",
    severity: "low",
    note: "Người đi bạn trên tàu không mang giấy tờ tùy thân: 300 – 500 nghìn đồng.",
  },
];
