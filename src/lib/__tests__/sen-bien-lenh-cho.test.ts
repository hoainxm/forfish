import { describe, expect, it } from "vitest";
import { CAU_MAU_CHO, CHO_CHAC, canXacNhan, hieuLenhCho, hoiLaiCho, tachHen, tachMa, tachTien, Y_CHO } from "@/lib/sen-bien/lenh-cho";
import { INTENTS } from "@/lib/sen-bien/ngram";
import { normalizeUtterance } from "@/lib/assistant/normalize";
import { foldVn } from "@/lib/market/text";

const k = (s: string) => hieuLenhCho(s)?.k ?? null;

describe("tách tham số", () => {
  it("mã đơn / mã yêu cầu / 4 ký tự cuối", () => {
    expect(tachMa("xác nhận đơn SD261018UY3Y", "SD")).toBe("SD261018UY3Y");
    expect(tachMa("xác nhận đơn sd 261018 uy3y", "SD")).toBe("SD261018UY3Y");
    expect(tachMa("huỷ đơn UY3Y giúp", "SD")).toBe("UY3Y");
    expect(tachMa("đồng ý báo giá yêu cầu 8W33", "YC")).toBe("8W33");
    expect(tachMa("huỷ đơn mới nhất", "SD")).toBeUndefined();
    expect(tachMa("huỷ đơn kia", "SD")).toBeUndefined();
  });
  it("hẹn giao", () => {
    const h = (s: string) => tachHen(normalizeUtterance(s), foldVn(s));
    expect(h("giao hôm nay")).toEqual({ tu: 0, den: 0 });
    expect(h("giao ngày mai")).toEqual({ tu: 1, den: 1 });
    expect(h("mai giao")).toEqual({ tu: 1, den: 1 });
    expect(h("giao ngày kia")).toEqual({ tu: 2, den: 2 });
    expect(h("hai ba ngày nữa giao")).toEqual({ tu: 2, den: 3 });
    expect(h("2 đến 3 ngày")).toEqual({ tu: 2, den: 3 });
    expect(h("tuần sau")).toEqual({ tu: 5, den: 7 });
    expect(h("5 ngày nữa")).toEqual({ tu: 5, den: 5 });
    expect(h("xác nhận đơn")).toBeUndefined();
  });
  it("tiền nói miệng", () => {
    const t = (s: string) => tachTien(foldVn(s));
    expect(t("ba triệu sáu")).toBe(3_600_000);
    expect(t("3 triệu 6")).toBe(3_600_000);
    expect(t("3 triệu 650")).toBe(3_650_000);
    expect(t("một triệu rưỡi")).toBe(1_500_000);
    expect(t("năm mươi nghìn")).toBe(50_000);
    expect(t("50k")).toBe(50_000);
    expect(t("hai triệu ba trăm nghìn")).toBe(2_300_000);
    expect(t("không có số")).toBeUndefined();
  });
});

describe("chủ tàu", () => {
  it("giỏ, tìm, đặt", () => {
    expect(hieuLenhCho("thêm 2 thùng dầu nhớt vào giỏ")).toEqual({ k: "them_gio", q: "dầu nhớt", qty: 2 });
    expect(k("giỏ có gì")).toBe("xem_gio");
    expect(k("đặt hàng luôn")).toBe("dat_hang");
  });
  it("đơn: huỷ / đã nhận / chuyển khoản / tới đâu / gọi shop", () => {
    expect(hieuLenhCho("huỷ đơn SD261018UY3Y")).toMatchObject({ k: "don_huy", ma: "SD261018UY3Y", shop: false });
    expect(k("tôi đã nhận được hàng rồi")).toBe("da_nhan");
    expect(k("tôi đã chuyển khoản rồi")).toBe("bao_chuyen");
    expect(k("hàng tới đâu rồi")).toBe("don_xem");
    expect(k("khi nào giao")).toBe("don_xem");
    expect(k("gọi shop giúp tôi")).toBe("goi_shop");
  });
  it("đặt món chợ chưa có", () => {
    expect(hieuLenhCho("nhờ chủ sàn tìm 2 cái chân vịt inox 18 inch")).toEqual({ k: "yc_moi", q: "chân vịt inox 18 inch", qty: 2, unit: "cai" });
    expect(hieuLenhCho("đặt giúp tôi máy lọc nước biển")).toMatchObject({ k: "yc_moi", q: "máy lọc nước biển", qty: 1 });
    expect(hieuLenhCho("đặt món không có")).toEqual({ k: "yc_moi", q: "", qty: 1 });
    expect(k("có báo giá chưa")).toBe("yc_xem");
    expect(k("đồng ý báo giá")).toBe("yc_dong_y");
    expect(k("huỷ yêu cầu")).toBe("yc_huy");
  });
});

describe("chủ shop", () => {
  it("đủ 7 việc", () => {
    expect(k("shop có đơn mới không")).toBe("shop_don_moi");
    expect(hieuLenhCho("xác nhận đơn SD261018UY3Y giao ngày mai")).toEqual({ k: "shop_xac_nhan", ma: "SD261018UY3Y", hen: { tu: 1, den: 1 } });
    expect(hieuLenhCho("bắt đầu giao, gửi xe Phương Trang")).toMatchObject({ k: "shop_giao", nhaXe: "Gửi xe Phương Trang" });
    expect(hieuLenhCho("đi giao đơn UY3Y tự giao")).toMatchObject({ k: "shop_giao", ma: "UY3Y", nhaXe: "Tự giao" });
    expect(k("đã giao xong rồi")).toBe("shop_da_giao");
    expect(hieuLenhCho("dời hẹn sang 3 đến 5 ngày")).toMatchObject({ k: "shop_doi_hen", hen: { tu: 3, den: 5 } });
    expect(hieuLenhCho("huỷ đơn của khách vì hết hàng")).toMatchObject({ k: "don_huy", shop: true, lyDo: "Hết hàng" });
    expect(k("đã nhận được tiền")).toBe("shop_nhan_tien");
  });
});

describe("chủ sàn", () => {
  it("yêu cầu mới / báo giá / không tìm được", () => {
    expect(k("có yêu cầu đặt hàng mới không")).toBe("san_yc_moi");
    expect(hieuLenhCho("báo giá yêu cầu 8W33 ba triệu sáu phí giao năm mươi nghìn giao hai ba ngày")).toEqual({
      k: "san_bao_gia", ma: "8W33", tienHang: 3_600_000, phiGiao: 50_000, hen: { tu: 2, den: 3 },
    });
    expect(hieuLenhCho("báo giá 1 triệu rưỡi miễn phí giao, giao ngày mai")).toMatchObject({ tienHang: 1_500_000, phiGiao: 0, hen: { tu: 1, den: 1 } });
    expect(hieuLenhCho("không tìm được hàng cho yêu cầu 8W33 vì hãng ngừng sản xuất")).toMatchObject({ k: "san_khong_tim_duoc", ma: "8W33", lyDo: "Hãng ngừng sản xuất" });
  });
});

describe("không phải việc sàn ⇒ null (để Sen Biển hiểu đường khác)", () => {
  it.each(["dẫn đường về cảng nhà", "mở bản đồ sóng", "thời tiết mai thế nào", "giấy tờ nào sắp hết hạn", "bão ở đâu"])("%s", (s) => {
    expect(hieuLenhCho(s)).toBeNull();
  });
  it("việc ghi có hậu quả thì phải bấm xác nhận", () => {
    expect(canXacNhan({ k: "don_huy", shop: false })).toBe(true);
    expect(canXacNhan({ k: "xem_gio" })).toBe(false);
    expect(canXacNhan({ k: "them_gio", q: "x", qty: 1 })).toBe(false);
  });
});

describe("cổng phụ n-gram v4 — luật hụt thì hỏi lại kèm câu mẫu", () => {
  it("mọi ý sàn đều có trong bộ n-gram", () => {
    for (const y of Y_CHO) expect(INTENTS).toContain(y);
  });
  it.each(Y_CHO.map((y) => [y]))("câu mẫu của %s luật hiểu đúng việc đó", (y) => {
    expect(k(CAU_MAU_CHO[y].mau)).toBe(y);
  });
  it("ý sàn đủ chắc ⇒ câu hỏi lại có câu mẫu", () => {
    expect(hoiLaiCho("don_huy", 0.9)).toBe('Bà con muốn huỷ đơn phải không? Nói rõ giúp, ví dụ: "huỷ đơn UY3Y vì đặt nhầm".');
    expect(hoiLaiCho("san_bao_gia", CHO_CHAC)).toContain("báo giá 3 triệu 6");
  });
  it("kém chắc hoặc không phải ý sàn ⇒ null", () => {
    expect(hoiLaiCho("don_huy", CHO_CHAC - 0.01)).toBeNull();
    expect(hoiLaiCho("thoi_tiet", 0.99)).toBeNull();
    expect(hoiLaiCho("don_cua_toi", 0.99)).toBeNull();
    expect(hoiLaiCho("", 1)).toBeNull();
  });
});
