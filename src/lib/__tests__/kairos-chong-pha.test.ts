// Chặn cứng nội dung chống phá Nhà nước (14 §5b, AC18b — anh Long 2026-10-26). Bắt ít mà chắc: mỗi cụm có ca dương
// lẫn ca âm (chữ lành, tin vụ án, góp ý chính sách, gõ không dấu trùng chữ lành).
import { describe, expect, it } from "vitest";
import { CAU_CHONG_PHA, chongPhaFlag } from "@/lib/kairos/chong-pha.mjs";

describe("chongPhaFlag — PHẢI chặn", () => {
  const CHAN = [
    "Đả đảo cộng sản!",
    "ĐẢ ĐẢO ĐẢNG CỘNG SẢN",
    "anh em ơi đả đảo chế độ này đi",
    "đ.ả đ.ả.o cộng sản", // chấm xen để lách
    "đả đảooo cộng sản", // kéo dài chữ
    "Đã đến lúc lật đổ chế độ rồi bà con",
    "phải lật đổ cộng sản mới sống nổi",
    "bọn cộng phỉ lại tăng giá dầu",
    "bè lũ cộng sản",
    "đảng bán nước, bán biển cho giặc",
    "Cộng sản bán nước!",
    "nhà nước độc tài",
    "VNCH muôn năm",
    "Việt Nam Cộng Hòa muôn năm",
    "ủng hộ Việt Tân đi bà con",
    "mai xuống đường chống chính quyền",
    "biểu tình lật đổ chế độ",
    "bọn nó phải lật đổ chế độ", // "bọn" không phải ngữ cảnh tin vụ án
    "da dao cong san",
    "lat do che do",
    "cong san ban nuoc",
    "vnch muon nam",
  ];
  for (const t of CHAN) it(`chặn: ${t}`, () => expect(chongPhaFlag(t)).not.toBeNull());
});

describe("chongPhaFlag — KHÔNG được chặn (chữ lành, tin vụ án, góp ý)", () => {
  const LANH = [
    "",
    "Giá dầu tăng quá, mong nhà nước hỗ trợ thêm cho ngư dân",
    "Chính quyền xã làm chậm giấy phép quá, bà con khổ",
    "Đề nghị nhà nước xem lại mức phạt IUU cho tàu nhỏ",
    "Đảng và Nhà nước luôn quan tâm ngư dân bám biển",
    // tin vụ án / phê phán kẻ chống phá — báo đưa, bà con chia sẻ
    "Bắt nhóm âm mưu lật đổ chính quyền nhân dân",
    "Xét xử bị cáo về tội lật đổ chính quyền",
    "Khởi tố đối tượng tham gia Việt Tân",
    "Bọn phản động ủng hộ Việt Tân bị bắt rồi",
    // lịch sử / nước khác
    "Hitler lập chế độ độc tài ở Đức",
    "nhà nước độc tài Bắc Triều Tiên",
    // gõ không dấu trùng chữ lành
    "cong phi sua may het 2 trieu", // công phí
    "dang ban nuoc da o cang", // đang bán nước đá
    "lat do ca len xe", // lật đồ / lật đổ cá — không có chế độ
    "chuyến này đả đảo con cá mập", // đả đảo không nhắm chế độ
    "tàu Cộng Hòa 01 vào cảng",
    "Việt Tân là tên tàu của chú Ba", // nhắc tên, không ủng hộ
  ];
  for (const t of LANH) it(`để yên: ${t || "(rỗng)"}`, () => expect(chongPhaFlag(t)).toBeNull());
});

describe("câu báo lỗi", () => {
  it("một câu đời thường, không mã kỹ thuật", () => {
    expect(CAU_CHONG_PHA).toMatch(/chống phá/);
    expect(CAU_CHONG_PHA).not.toMatch(/_/);
  });
});
