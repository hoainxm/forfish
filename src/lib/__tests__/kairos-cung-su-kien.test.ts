// Cùng sự kiện khác báo (anh Long 2026-10-24: "đang bị trùng tin") — mẫu lấy từ dòng tin thật.
import { describe, expect, it } from "vitest";
import { cungSuKien, ghiGanDay, locCungSuKien, SU_KIEN_CUA_SO_MS, tenRieng, vanTay } from "@/lib/kairos/cung-su-kien.mjs";

const TN = {
  title: "Công an tỉnh An Giang bắt nghi phạm giết người trên tàu cá",
  description:
    "Công an tỉnh An Giang đã khởi tố và bắt tạm giam Huỳnh Văn Đúng về hành vi giết người. Vụ việc xảy ra trên tàu cá sau khi nghi ngờ người cùng tàu ném dụng cụ câu mực xuống biển.",
};
const VNE = {
  title: "Đâm đồng nghiệp tử vong sau vụ mất dụng cụ câu mực",
  description:
    "Trên tàu cá, nghi đồng nghiệp ném dụng cụ câu mực xuống biển khiến Huỳnh Văn Đúng cự cãi rồi xô xát. Sau đó, Đúng dùng dao đâm khiến người này tử vong ngoài khơi.",
};
const MUI_NE_1 = {
  title: "4 người gặp nạn gần giàn khoan Sư Tử Trắng được cứu",
  description: "Bốn ngư dân Mũi Né mất tích sau vụ chìm tàu hôm 21/10 gần giàn khoan Sư Tử Trắng được tàu hậu cần nghề cá cứu sống, chuẩn bị cập cảng Trần Đề.",
};
const MUI_NE_2 = {
  title: "4 ngư dân Mũi Né gặp nạn gần mỏ Sư Tử Trắng đã về đến Cần Thơ an toàn",
  description: "Bốn ngư dân Mũi Né bị chìm tàu gần mỏ Sư Tử Trắng đã được đưa về Cần Thơ an toàn, sức khoẻ ổn định.",
};
const TOM = {
  title: "Hà Tĩnh: Phát triển nuôi tôm càng xanh theo hướng bền vững",
  description: "Từ chuyển đổi diện tích ruộng trũng trồng lúa kém hiệu quả đến nuôi bán thâm canh trong ao đạt tiêu chuẩn VietGAP, tôm càng xanh đang mở ra hướng phát triển mới.",
};
const RUOT = {
  title: "Bệnh đường ruột trên tôm và biện pháp xử lý triệt để",
  description: "Bệnh đường ruột ở tôm khá phổ biến với các biểu hiện bệnh như phân trắng, đứt khúc, trống ruột, phân loãng... kéo dài có thể dẫn đến hư gan tụy của tôm.",
};
const GIA_LAI = {
  title: "Gia Lai tạo động lực phát triển nuôi trồng thủy sản công nghệ cao",
  description: "Gia Lai hiện đang từng bước cơ cấu lại ngành nuôi trồng thủy sản theo hướng nâng cao năng suất, chất lượng và giá trị.",
};

describe("tenRieng", () => {
  it("bắt tên người, tên nơi viết hoa liền nhau; bỏ chữ hoa đứng một mình", () => {
    const t = tenRieng(VNE.description);
    expect(t.has("huynh van dung")).toBe(true);
    expect([...t].some((x) => x === "dung" || x === "tren")).toBe(false);
  });
});

describe("cungSuKien — hai báo cùng một vụ", () => {
  it("vụ đâm người trên tàu cá: Thanh Niên ↔ VnExpress (tiêu đề không chung chữ nào đáng kể)", () => {
    expect(cungSuKien(vanTay(TN), vanTay(VNE))).toBe(true);
  });
  it("4 ngư dân Mũi Né: hai bài khác giờ, khác báo", () => {
    expect(cungSuKien(vanTay(MUI_NE_1), vanTay(MUI_NE_2))).toBe(true);
  });
  it("hai tin nghề cá KHÁC nhau không bị gộp", () => {
    expect(cungSuKien(vanTay(TOM), vanTay(RUOT))).toBe(false);
    expect(cungSuKien(vanTay(TOM), vanTay(GIA_LAI))).toBe(false);
    expect(cungSuKien(vanTay(TN), vanTay(MUI_NE_1))).toBe(false);
  });
  it("bài quá ngắn (< 4 cặp từ) không bao giờ bị coi là trùng", () => {
    expect(cungSuKien(vanTay({ title: "Tin nhanh" }), vanTay({ title: "Tin nhanh" }))).toBe(false);
  });
});

describe("locCungSuKien — giữ bài thấy trước", () => {
  const now = Date.parse("2026-10-24T08:00:00Z");
  it("trong cùng lượt: bỏ bài sau", () => {
    const { giu, trung } = locCungSuKien([TN, TOM, VNE], [], now);
    expect(giu).toEqual([TN, TOM]);
    expect(trung).toEqual([VNE]);
  });
  it("so với sổ gần đây (lượt trước đã gửi) — trong 48 giờ thì bỏ, quá 48 giờ thì nhận", () => {
    const gan = [{ ...TN, at: new Date(now - 3600_000).toISOString() }];
    expect(locCungSuKien([VNE], gan, now).trung).toEqual([VNE]);
    const xa = [{ ...TN, at: new Date(now - SU_KIEN_CUA_SO_MS - 1).toISOString() }];
    expect(locCungSuKien([VNE], xa, now).giu).toEqual([VNE]);
  });
});

describe("ghiGanDay", () => {
  const now = Date.parse("2026-10-24T08:00:00Z");
  it("thêm bài mới, bỏ mục quá cửa sổ và mục hỏng, sổ hỏng thì bắt đầu lại", () => {
    const cu = [
      { title: "cũ", description: "", at: new Date(now - SU_KIEN_CUA_SO_MS - 5).toISOString() },
      { title: "còn", description: "", at: new Date(now - 1000).toISOString() },
      null,
      { title: 3 },
    ];
    const s = ghiGanDay(cu, [TN], now);
    expect(s.map((x) => x.title)).toEqual(["còn", TN.title]);
    expect(ghiGanDay("hỏng", [TN], now)).toHaveLength(1);
  });
});
