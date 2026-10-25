// @vitest-environment jsdom
// SEN BIỂN THEO CƠ CẤU APP MỚI (2026-10-25, hợp đồng scratchpad SEN-BIEN-CO-CAU-MOI §A/§B): 9 ý mới ở CUỐI bảng n-gram v7
// (thứ tự KHOÁ — bin do agent train giao sau, test này không cần bin), màn mới cho `mo_man`, slot tỉnh, câu trả lời + hành
// động, công tắc Tạm nghỉ bán qua luật lệnh sàn.
import { describe, expect, it } from "vitest";

import { answerOffline } from "@/lib/assistant/answer";
import { SCREEN_LABEL } from "@/lib/assistant/intents";
import { parseUtterance, provinceIn } from "@/lib/assistant/parse";
import { INTENTS as APP_INTENTS, SCREEN_HREF, type DeviceSnapshot, type Intent, type ParseContext } from "@/lib/assistant/types";
import { COASTAL_PROVINCES } from "@/lib/region";
import { CAU_MAU_CHO, canXacNhan, hieuLenhCho, hoiLaiCho, Y_CHO } from "@/lib/sen-bien/lenh-cho";
import { INTENTS, NGRAM_BYTES, NGRAM_PATH } from "@/lib/sen-bien/ngram";

const NOW = Date.UTC(2026, 9, 25, 3);
const CTX: ParseContext = { route: "/", awaitingConfirm: false, boatNames: ["BĐ 91234"], portNames: ["Vũng Tàu", "Sa Kỳ", "Quy Nhơn", "Cà Mau"], placeNames: ["Bãi mực"] };
const P = (say: string, ctx: Partial<ParseContext> = {}) => parseUtterance(say, { ...CTX, ...ctx });
const snap = (over: Partial<DeviceSnapshot> = {}): DeviceSnapshot => ({
  takenAt: NOW, route: "/", online: true, premium: false,
  home: { portId: "quy-nhon", portName: "Quy Nhơn", province: "Gia Lai" },
  weather: null, storm: null, tide: null, boat: null, docs: [], maintenance: [], crew: null,
  cart: { lines: 0, titles: [] }, orders: null, fishPrices: null, fuel: null, inboxUnread: 0, placeNames: [],
  ...over,
});
const A = (intent: Intent, s: DeviceSnapshot, slots: Record<string, unknown> = {}) => answerOffline({ intent, confidence: 1, slots, normalized: "" }, s, NOW);

const MOI = ["chon_tinh", "nhan_zalo", "tai_bai", "bat_chuong", "dang_xuat", "chua_doc", "hoan_tac", "shop_tam_nghi", "shop_mo_ban"] as const;

describe("bảng ý v7 — 65 ý cũ giữ nguyên thứ tự + 9 ý mới ở cuối", () => {
  it("đường file v7, cỡ bin theo 74 ý + 5 lý do", () => {
    expect(NGRAM_PATH).toBe("/data/sen-bien-ngram.v7.bin");
    expect(INTENTS).toHaveLength(74);
    expect(NGRAM_BYTES).toBe(65536 * 79);
  });
  it("65 ý đầu đúng bản v6 (khoá vài mốc), 9 ý mới đúng thứ tự hợp đồng §B", () => {
    expect(INTENTS[0]).toBe("thoi_tiet");
    expect(INTENTS[30]).toBe("khong_hieu");
    expect(INTENTS[31]).toBe("hoi_dao_gan");
    expect(INTENTS[64]).toBe("san_bao_gia");
    expect(INTENTS.slice(65)).toEqual([...MOI]);
  });
  it("bảng Intent của trợ lý app có đủ 9 ý mới; mọi ý sàn (kể cả tạm nghỉ / mở bán) có trong bộ n-gram", () => {
    for (const y of MOI) expect(APP_INTENTS).toContain(y);
    for (const y of Y_CHO) expect(INTENTS).toContain(y);
  });
  it("màn mới có đường + nhãn; cai_dat không có URL", () => {
    expect(SCREEN_HREF.gia_ca).toBe("/tien?muc=gia");
    expect(SCREEN_HREF.mua_ban).toBe("/tien?muc=tin");
    expect(SCREEN_HREF.dau_moi).toBe("/tien?muc=dau-moi");
    expect(SCREEN_HREF.kairos).toBe("/kairos");
    expect(SCREEN_HREF.yeu_cau).toBe("/cho/yeu-cau");
    expect(SCREEN_HREF.cai_dat).toBe("");
    expect(SCREEN_HREF.giao_dich).toBe("/tien");
    for (const k of Object.keys(SCREEN_HREF)) expect(SCREEN_LABEL[k as keyof typeof SCREEN_LABEL]).toBeTruthy();
  });
});

describe("parse — mỗi ý mới ≥3 câu giọng bà con", () => {
  const CASES: [string, Intent, Record<string, unknown>?][] = [
    ["chọn tỉnh Khánh Hoà", "chon_tinh", { province: "Khánh Hòa" }],
    ["xem vựa ở Bình Định", "chon_tinh", { province: "Gia Lai" }],
    ["đổi sang Kiên Giang", "chon_tinh", { province: "An Giang" }],
    ["lọc theo tỉnh Cà Mau", "chon_tinh", { province: "Cà Mau" }],
    ["coi đầu mối Vũng Tàu", "chon_tinh", { province: "Thành phố Hồ Chí Minh" }],
    ["chon tinh khac", "chon_tinh", {}],
    ["nhắn Zalo cho vựa", "nhan_zalo"],
    ["nhắn cho chủ tin này", "nhan_zalo"],
    ["gửi tin Zalo cho ông Ba Hùng", "nhan_zalo"],
    ["nhan zalo cho shop", "nhan_zalo"],
    ["tải bài đọc trên biển", "tai_bai"],
    ["tải tin mang đi", "tai_bai"],
    ["lưu bài để ra khơi đọc", "tai_bai"],
    ["tai may bai kairos ve may", "tai_bai"],
    ["bật chuông báo bão", "bat_chuong"],
    ["bật thông báo", "bat_chuong"],
    ["cho máy reo khi có bão", "bat_chuong"],
    ["bat chuong di", "bat_chuong"],
    ["đăng xuất", "dang_xuat"],
    ["thoát tài khoản", "dang_xuat"],
    ["gỡ tài khoản khỏi máy", "dang_xuat"],
    ["có tin nào chưa đọc không", "chua_doc"],
    ["có ai nhắn gì không", "chua_doc"],
    ["mấy tin chưa đọc", "chua_doc"],
    ["bao nhiêu tin mới", "chua_doc"],
    ["hoàn tác", "hoan_tac"],
    ["lấy lại", "hoan_tac"],
    ["khoan, đừng xoá", "hoan_tac"],
    ["undo", "hoan_tac"],
    ["tạm nghỉ bán", "shop_tam_nghi"],
    ["nghỉ bán vài bữa", "shop_tam_nghi"],
    ["đóng gian hàng tạm", "shop_tam_nghi"],
    ["mở bán lại", "shop_mo_ban"],
    ["bán lại rồi", "shop_mo_ban"],
    ["hết nghỉ", "shop_mo_ban"],
  ];
  it.each(CASES)("%s → %s", (say, intent, slots) => {
    const p = P(say);
    expect(p.intent, `${say} → ${p.intent}`).toBe(intent);
    expect(p.confidence).toBeGreaterThanOrEqual(0.6);
    if (slots) expect(p.slots).toMatchObject(slots);
  });
  it("câu cũ không bị ý mới giành: thời tiết có tên cảng, đặt cảng nhà, tin bão, hộp thư, mở màn", () => {
    expect(P("coi thời tiết Vũng Tàu giùm").intent).toBe("thoi_tiet");
    expect(P("đổi cảng nhà Cà Mau").intent).toBe("dat_cang_nha");
    expect(P("có bão không").intent).toBe("bao");
    expect(P("có tin mới không").intent).toBe("hop_thu");
    expect(P("SDVICO nhắn gì").intent).toBe("hop_thu");
    expect(P("mở cửa hàng").intent).toBe("mo_man");
    expect(P("mở cửa hàng").slots.target).toBe("cho");
    expect(P("đã nhận hàng rồi").intent).toBe("khong_hieu"); // hành động có hậu quả — chỉ đường
  });
  it("mo_man theo màn mới: giá cá · mua bán · đầu mối · vựa · chợ sỉ · Kairos · đọc báo · yêu cầu · đơn hàng · kênh người bán · cảng · cài đặt", () => {
    const t = (say: string) => {
      const p = P(say);
      expect(p.intent, say).toBe("mo_man");
      return p.slots.target;
    };
    expect(t("mở giá cá")).toBe("gia_ca");
    expect(t("mở mua bán")).toBe("mua_ban");
    expect(t("mở đầu mối")).toBe("dau_moi");
    expect(t("mở vựa")).toBe("dau_moi");
    expect(t("mở chợ sỉ")).toBe("dau_moi");
    expect(t("mở Kairos")).toBe("kairos");
    expect(t("mở đọc báo")).toBe("kairos");
    expect(t("mở yêu cầu đặt món")).toBe("yeu_cau");
    expect(t("mở đơn hàng của tôi")).toBe("don_hang");
    expect(t("mở kênh người bán")).toBe("ban_hang");
    expect(t("mở danh bạ cảng")).toBe("cang_ca");
    expect(t("mở cài đặt")).toBe("cai_dat");
    expect(t("mở chợ cá")).toBe("giao_dich");
  });
  it("provinceIn: tên chuẩn, tên cũ sau sáp nhập, TP.HCM nhiều cách gọi; 22 tỉnh đều nhận", () => {
    for (const p of COASTAL_PROVINCES) expect(provinceIn(`chon tinh ${p.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d")}`)).toBe(p.name);
    expect(provinceIn("vua o sai gon")).toBe("Thành phố Hồ Chí Minh");
    expect(provinceIn("hue")).toBe("Thừa Thiên Huế");
    expect(provinceIn("quang ngai")).toBe("Quảng Ngãi");
    expect(provinceIn("cho nao ban luoi")).toBeUndefined();
  });
  it("route gợi ý: ở /tien, câu kém rõ nghiêng về chọn tỉnh / nhắn Zalo (không vượt 0,6)", () => {
    const p = P("tinh", { route: "/tien?muc=dau-moi" });
    expect(p.confidence).toBeLessThan(0.6);
  });
});

describe("answer — câu + hành động đúng hợp đồng §B", () => {
  it("chon_tinh có tỉnh ⇒ setProvince + nói 'Đã chọn'; chưa rõ ⇒ hỏi lại ≤4 chip, chip đầu là tỉnh nhà", () => {
    const r = A("chon_tinh", snap(), { province: "Khánh Hòa" });
    expect(r.action).toEqual({ type: "setProvince", province: "Khánh Hòa" });
    expect(r.text).toMatch(/Đã chọn Khánh Hòa/);
    const h = A("chon_tinh", snap());
    expect(h.action).toBeUndefined();
    expect(h.clarify?.options.length).toBeLessThanOrEqual(4);
    expect(h.clarify?.options[0].label).toBe("Gia Lai");
  });
  it("nhan_zalo: đúng một số di động trên màn ⇒ mở zalo.me; không ⇒ hướng dẫn chạm Nhắn; mất sóng ⇒ cần sóng", () => {
    expect(A("nhan_zalo", snap({ soZaloDangMo: "0912345678" })).action).toEqual({ type: "zalo", href: "https://zalo.me/0912345678" });
    const k = A("nhan_zalo", snap());
    expect(k.action).toBeUndefined();
    expect(k.text).toMatch(/chạm nút Nhắn/);
    expect(A("nhan_zalo", snap({ online: false, soZaloDangMo: "0912345678" })).text).toMatch(/Cần sóng/);
    // số bàn / số rác không mở
    expect(A("nhan_zalo", snap({ soZaloDangMo: "02583812345" })).action).toBeUndefined();
  });
  it("tai_bai ⇒ /kairos?sen=tai; mất sóng ⇒ nói cần sóng, không nav", () => {
    expect(A("tai_bai", snap()).action).toEqual({ type: "navigate", href: "/kairos?sen=tai" });
    expect(A("tai_bai", snap({ online: false })).action).toBeUndefined();
  });
  it("bat_chuong ⇒ /?sen=chuong; đã bật ⇒ 'đang bật rồi' không nav", () => {
    expect(A("bat_chuong", snap()).action).toEqual({ type: "navigate", href: "/?sen=chuong" });
    const r = A("bat_chuong", snap({ chuongBat: true }));
    expect(r.action).toBeUndefined();
    expect(r.text).toMatch(/đang bật rồi/);
  });
  it("dang_xuat chỉ hướng dẫn (menu avatar › cuối › Đăng xuất), KHÔNG hành động", () => {
    const r = A("dang_xuat", snap());
    expect(r.action).toBeUndefined();
    expect(r.text).toMatch(/Đăng xuất/);
    expect(r.text).toMatch(/góc phải/);
  });
  it("chua_doc đếm hộp thư + Kairos, có tin ⇒ mở Trang chủ; không ⇒ 'Không có tin mới.'", () => {
    expect(A("chua_doc", snap({ inboxUnread: 3, kairosChuaDoc: 1 })).text).toBe("Có 3 tin chưa đọc, 1 tin Kairos. Bác kéo xuống Thông báo ở Trang chủ.");
    expect(A("chua_doc", snap({ inboxUnread: 3, kairosChuaDoc: 1 })).action).toEqual({ type: "navigate", href: "/" });
    expect(A("chua_doc", snap({ inboxUnread: 0, kairosChuaDoc: 2 })).text).toMatch(/^Có 2 tin Kairos\./);
    const k = A("chua_doc", snap());
    expect(k.text).toBe("Không có tin mới.");
    expect(k.action).toBeUndefined();
  });
  it("hoan_tac: toast có nút ⇒ action undo; không ⇒ 'Không có gì để hoàn tác.'", () => {
    expect(A("hoan_tac", snap({ coHoanTac: true })).action).toEqual({ type: "undo" });
    const k = A("hoan_tac", snap());
    expect(k.action).toBeUndefined();
    expect(k.text).toBe("Không có gì để hoàn tác.");
  });
  it("shop_tam_nghi / shop_mo_ban: action shopPaused LUÔN kèm confirm; mất sóng ⇒ cần sóng", () => {
    const n = A("shop_tam_nghi", snap());
    expect(n.action).toEqual({ type: "shopPaused", paused: true });
    expect(n.confirm?.question).toBeTruthy();
    const m = A("shop_mo_ban", snap());
    expect(m.action).toEqual({ type: "shopPaused", paused: false });
    expect(m.confirm?.question).toBeTruthy();
    expect(A("shop_tam_nghi", snap({ online: false })).action).toBeUndefined();
  });
  it("mo_man cai_dat ⇒ hướng dẫn, KHÔNG navigate; màn mới nav đúng đường", () => {
    const r = A("mo_man", snap(), { target: "cai_dat" });
    expect(r.action).toBeUndefined();
    expect(r.text).toMatch(/Cài đặt/);
    expect(A("mo_man", snap(), { target: "dau_moi" }).action).toEqual({ type: "navigate", href: "/tien?muc=dau-moi" });
    expect(A("mo_man", snap(), { target: "gia_ca" }).text).toBe("Mở Giá cá.");
  });
  it("mọi câu đọc ≤2 câu, 'Sen Biển' viết đầy đủ, không 'Sen' trần", () => {
    for (const y of MOI) {
      for (const s of [snap(), snap({ online: false, soZaloDangMo: "0912345678", coHoanTac: true, chuongBat: true, inboxUnread: 2 })]) {
        const r = A(y, s, { province: "Cà Mau" });
        expect(r.intent).toBe(y);
        expect((r.speak.match(/[.!?…]+/g) ?? []).length, `${y}: ${r.speak}`).toBeLessThanOrEqual(2);
        expect(r.text).not.toMatch(/\bSen\b(?! Biển)/);
      }
    }
  });
});

describe("lệnh sàn — công tắc Tạm nghỉ bán theo khuôn shop_* (luật trước, n-gram làm lưới)", () => {
  it.each(["tạm nghỉ bán", "nghỉ bán vài bữa", "đóng gian hàng tạm", "shop tạm đóng cửa"])("%s ⇒ shop_tam_nghi", (c) =>
    expect(hieuLenhCho(c)).toEqual({ k: "shop_tam_nghi" }));
  it.each(["mở bán lại", "bán lại rồi", "hết nghỉ", "mở lại gian hàng"])("%s ⇒ shop_mo_ban", (c) =>
    expect(hieuLenhCho(c)).toEqual({ k: "shop_mo_ban" }));
  it("là việc ghi ⇒ phải xác nhận; câu mẫu luật hiểu đúng; n-gram chắc ⇒ hỏi lại kèm mẫu", () => {
    expect(canXacNhan({ k: "shop_tam_nghi" })).toBe(true);
    expect(canXacNhan({ k: "shop_mo_ban" })).toBe(true);
    expect(hieuLenhCho(CAU_MAU_CHO.shop_tam_nghi.mau)?.k).toBe("shop_tam_nghi");
    expect(hieuLenhCho(CAU_MAU_CHO.shop_mo_ban.mau)?.k).toBe("shop_mo_ban");
    expect(hoiLaiCho("shop_tam_nghi", 0.9)).toContain("tạm nghỉ bán");
  });
  it("'mở cửa hàng' / 'mở shop' KHÔNG phải mở bán lại (là mở màn)", () => {
    expect(hieuLenhCho("mở cửa hàng")).toBeNull();
    expect(hieuLenhCho("mở shop")).toBeNull();
  });
});
