import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { SDVICO_HOTLINE } from "@/data/sdvico-showcase";
import { answerOffline, limitSentences, onlineErrorReply, toSpeech, vndSpeech } from "@/lib/assistant/answer";
import { parseUtterance } from "@/lib/assistant/parse";
import type { AssistantAction, DeviceSnapshot, Intent, ParsedIntent } from "@/lib/assistant/types";
import { INTENTS } from "@/lib/assistant/types";

/*  CÂU TRẢ LỜI TẦNG MÁY (14 §4.3, 13 §3 cột "Thiếu dữ liệu", AC-T09…T25):
    mọi ý định có nhánh THIẾU dữ liệu nói thật; mọi số kèm mốc "lưu lúc"; bão và
    "đi được không" luôn nhắc đài duyên hải; speak ≤2 câu; action trong tập đóng.  */

const NOW = Date.parse("2026-09-06T05:00:00Z"); // 12:00 VN, hôm nay = 2026-09-06
const H = 3600_000;

function snap(over: Partial<DeviceSnapshot> = {}): DeviceSnapshot {
  return {
    takenAt: NOW, route: "/", online: true, premium: false,
    home: { portId: "quy-nhon", portName: "Quy Nhơn", province: "Gia Lai" },
    weather: null, storm: null, tide: null, boat: null, docs: [], maintenance: [], crew: null,
    cart: { lines: 0, titles: [] }, orders: null, fishPrices: null, fuel: null, inboxUnread: 0, placeNames: [],
    ...over,
  };
}

/** Snapshot RỖNG HOÀN TOÀN — máy mới chưa từng có sóng (13 §5.4 ca cực đoan). */
const EMPTY = snap({ home: null, docs: null, maintenance: null });

const CTX = { route: "/", awaitingConfirm: false, boatNames: ["BĐ 91234"], portNames: ["Quy Nhơn", "Sa Kỳ"], placeNames: ["Bãi mực"] };
const P = (say: string, ctx = CTX) => parseUtterance(say, ctx);
const A = (say: string, s: DeviceSnapshot, ctx = CTX) => answerOffline(P(say, ctx), s, NOW);

const day = (offset: number, level: "good" | "caution" | "bad" = "good", score = 82) => ({
  date: `2026-09-${String(6 + offset).padStart(2, "0")}`, score, level, waveMaxM: 0.8, waveEstimated: false,
  windMaxKmh: 25, gustMaxKmh: 34, precipMm: 0, wmoCode: 1,
});
const WEATHER = { portId: "quy-nhon", portName: "Quy Nhơn", savedAt: NOW - 2 * H, days: [day(0), day(1), day(2), day(3), day(4), day(5, "bad", 20)] };

const ALLOWED: AssistantAction["type"][] = ["navigate", "search", "addToCart", "call", "setHomePort", "setBoat", "mute"];

describe("assistant-answer — thời tiết / bão", () => {
  it("AC-T09: có bản lưu → sóng/gió/điểm + 'lưu 2 giờ trước' + savedAt; speak ≤2 câu", () => {
    const r = A("thời tiết hôm nay", snap({ weather: WEATHER }));
    expect(r.text).toMatch(/sóng 0,8 m/);
    expect(r.text).toMatch(/gió 25 km\/h/);
    expect(r.text).toMatch(/82\/100/);
    expect(r.text).toContain("lưu 2 giờ trước");
    expect(r.savedAt).toBe(WEATHER.savedAt);
    expect(r.action).toEqual({ type: "navigate", href: "/ngu-truong" });
    expect((r.speak.match(/[.!?…]+/g) ?? []).length).toBeLessThanOrEqual(2);
    expect(r.speak).toContain("mét");
  });

  it("AC-T10: không cảng nhà → clarify hỏi cảng; có cảng nhà nhưng không bản lưu → 'chưa có' + navigate", () => {
    const a = A("thời tiết hôm nay", snap({ home: null }));
    expect(a.clarify?.question).toContain("cảng nào");
    const b = A("thời tiết hôm nay", snap());
    expect(b.text).toMatch(/chưa có dự báo cảng Quy Nhơn/);
    expect(b.action).toEqual({ type: "navigate", href: "/ngu-truong" });
  });

  it("AC-T11: day=5 hạng thường → 3 ngày + mời Premium khi online, ẩn khi offline; premium → đọc ngày 5", () => {
    const on = A("5 ngày tới sóng gió sao", snap({ weather: WEATHER }));
    expect(on.text).toMatch(/Ba ngày tới/);
    expect(on.text).toContain("Premium");
    const off = A("5 ngày tới sóng gió sao", snap({ weather: WEATHER, online: false }));
    expect(off.text).not.toContain("Premium");
    const prem = A("5 ngày tới sóng gió sao", snap({ weather: WEATHER, premium: true }));
    expect(prem.text).toMatch(/5 ngày tới/i);
    expect(prem.text).toContain("Không nên ra khơi");
  });

  it("AC-T13: 'đi được không' luôn có 'đài duyên hải' ở mọi nhánh", () => {
    const cases = [
      snap({ weather: WEATHER, storm: { savedAt: NOW - H, storms: [] } }),
      snap({ weather: { ...WEATHER, days: [day(0, "caution", 55)] } }),
      snap({ weather: { ...WEATHER, days: [day(0, "bad", 20)] } }),
      snap(),
      snap({ home: null, weather: null }),
      snap({ weather: { ...WEATHER, days: [{ ...day(0), date: "2026-09-01" }] } }),
    ];
    for (const s of cases) {
      const r = A("hôm nay đi được không", s);
      expect(`${r.text} ${r.speak}`, r.text).toMatch(/đài duyên hải/i);
    }
    const good = A("mai đi được không", snap({ weather: WEATHER, storm: { savedAt: NOW - H, storms: [] } }));
    expect(good.speak).toMatch(/đài duyên hải/);
    expect((good.speak.match(/[.!?…]+/g) ?? []).length).toBeLessThanOrEqual(2);
    expect(good.text).toContain("đi được");
  });

  it("AC-T12: tin bão cũ >12h KHÔNG nói 'không có bão'; ≤12h rỗng → 'chưa có bão' + đài duyên hải; có bão → tên + gió", () => {
    const old = A("có bão không", snap({ storm: { savedAt: NOW - 13 * H, storms: [] } }));
    expect(old.text).toMatch(/đã cũ/);
    expect(old.text).toContain("lưu 13 giờ trước");
    expect(old.text.toLowerCase()).not.toMatch(/chưa có bão|không có bão/);
    expect(old.text).toMatch(/đài duyên hải/i);
    const fresh = A("có bão không", snap({ storm: { savedAt: NOW - H, storms: [] } }));
    expect(fresh.text).toMatch(/chưa có bão/);
    expect(fresh.text).toMatch(/đài duyên hải/);
    const has = A("có bão không", snap({ storm: { savedAt: NOW - H, storms: [{ name: "WUTIP", kindLabel: "Bão", windKmh: 120, alert: "danger", lat: 15, lon: 112 }] } }));
    expect(has.text).toMatch(/Bão WUTIP, gió 120 km\/h/);
    expect(has.speak).toMatch(/đài duyên hải/);
    const none = A("có bão không", EMPTY);
    expect(none.text).toMatch(/chưa có tin bão/i);
    expect(none.text).toMatch(/đài duyên hải/i);
  });

  it("con nước: có bảng → giờ nước lớn/ròng + mốc; không → 'chưa tải bảng con nước'", () => {
    const tide = { stationName: "Quy Nhơn", savedAt: NOW - H, extremes: [{ at: NOW + 2 * H, kind: "high" as const, heightM: 2.1 }, { at: NOW + 8 * H, kind: "low" as const, heightM: 0.4 }] };
    const r = A("con nước hôm nay", snap({ tide }));
    expect(r.text).toMatch(/nước lớn 14 giờ \(2,1 m\)/);
    expect(r.text).toMatch(/nước ròng 20 giờ/);
    expect(A("con nước hôm nay", EMPTY).text).toMatch(/chưa tải bảng con nước/);
  });
});

describe("assistant-answer — tàu / giấy tờ / người", () => {
  it("AC-T14: giấy sắp/đã hết hạn đọc theo thứ tự khẩn; readFailed → 'đọc không được', KHÔNG 'còn hạn'", () => {
    const docs = [
      { label: "Bảo hiểm tàu", expiresOn: "2026-09-06", daysLeft: 0, level: "expired" as const },
      { label: "Đăng kiểm", expiresOn: "2026-09-18", daysLeft: 12, level: "soon" as const },
      { label: "Giấy phép khai thác", expiresOn: "2026-12-10", daysLeft: 95, level: "ok" as const },
    ];
    const r = A("giấy tờ sắp hết hạn", snap({ docs, boat: { name: "BĐ 91234", count: 1, names: ["BĐ 91234"] } }));
    expect(r.text).toMatch(/2 giấy cần lo/);
    expect(r.text.indexOf("bảo hiểm")).toBeLessThan(r.text.indexOf("đăng kiểm"));
    expect(r.text).toContain("hết hạn hôm nay");
    expect(r.action).toEqual({ type: "navigate", href: "/tau?tab=giay-to" });
    const bad = A("giấy tờ sắp hết hạn", snap({ docs: null }));
    expect(bad.text).toMatch(/đọc không được/);
    expect(bad.text).not.toMatch(/còn hạn/);
    expect(A("giấy tờ sắp hết hạn", snap({ docs: [docs[2]] })).text).toMatch(/còn hạn cả/);
    expect(A("giấy tờ sắp hết hạn", snap()).text).toMatch(/còn trống/);
  });

  it("AC-T15: bảo dưỡng quá hạn đọc trước, sổ trống → câu trống, null → đọc không được", () => {
    const m = [
      { item: "Lọc dầu", dueOn: "2026-09-15", daysLeft: 9, level: "soon" as const },
      { item: "Thay nhớt máy chính", dueOn: "2026-08-31", daysLeft: -6, level: "overdue" as const },
    ];
    const r = A("bảo dưỡng gì tới hạn", snap({ maintenance: m }));
    expect(r.text).toMatch(/1 việc quá hạn: Thay nhớt máy chính, trễ 6 ngày/);
    expect(r.text).toMatch(/Lọc dầu còn 9 ngày/);
    expect(A("bảo dưỡng gì tới hạn", snap()).text).toMatch(/Chưa ghi việc bảo dưỡng/);
    expect(A("bảo dưỡng gì tới hạn", snap({ maintenance: null })).text).toMatch(/đọc không được/);
  });

  it("AC-T16: sổ thuyền viên chỉ đếm — không chuỗi 9–12 số", () => {
    const r = A("tàu có mấy người", snap({ crew: { count: 8, issues: 2 } }));
    expect(r.text).toMatch(/8 người/);
    expect(r.text).toMatch(/2 người có cảnh báo/);
    expect(`${r.text} ${r.speak}`).not.toMatch(/\d{9,12}/);
    expect(A("tàu có mấy người", EMPTY).text).toMatch(/đọc không được/);
  });

  it("tàu: đổi tàu khớp → setBoat không confirm; không khớp → clarify ≤4; 0 tàu → mở Tàu cá", () => {
    const boat = { name: "BĐ 91234", count: 2, names: ["BĐ 91234", "Ghe nhỏ"] };
    const r = A("đổi sang tàu BĐ 91234", snap({ boat }));
    expect(r.action?.type).toBe("setBoat");
    expect(r.confirm).toBeUndefined();
    const r2 = A("tàu đang chọn là tàu nào", snap({ boat }));
    expect(r2.text).toMatch(/Đang chọn tàu BĐ 91234/);
    expect(A("tàu đang chọn là tàu nào", EMPTY).action).toEqual({ type: "navigate", href: "/tau" });
  });
});

describe("assistant-answer — chợ / giá / gọi", () => {
  it("tìm món: có sóng → search; mất sóng → nói thật + chip mở chợ, KHÔNG action", () => {
    const on = A("cần mua đá", snap());
    expect(on.action).toEqual({ type: "search", q: "da" });
    const off = A("cần mua đá", snap({ online: false }));
    expect(off.text).toMatch(/cần có sóng/);
    expect(off.action).toBeUndefined();
    expect(off.clarify?.options.length).toBeGreaterThan(0);
  });

  it("thêm giỏ: answer thuần chỉ trả khung (không action, không candidates); mất sóng → nói thật", () => {
    const on = A("bỏ 2 thùng nhớt vô giỏ", snap());
    expect(on.intent).toBe("them_gio");
    expect(on.action).toBeUndefined();
    expect(on.candidates).toBeUndefined();
    expect(on.text, "chữ CÓ DẤU từ câu gốc, không phải khoá fold (audit P1-5)").toMatch(/2 thùng dầu nhớt/);
    expect(on.qty, "số đã nói đi theo reply để UI mở sẵn (14 §3.1)").toBe(2);
    const off = A("bỏ 2 thùng nhớt vô giỏ", snap({ online: false }));
    expect(off.text).toMatch(/cần có sóng/);
  });

  it("AC-T19: giỏ đếm dòng, không bịa tiền; giỏ rỗng → mời nói tên món", () => {
    const r = A("giỏ có gì", snap({ cart: { lines: 3, titles: ["Nhớt Castrol", "Đá cây", "Lưới"] } }));
    expect(r.text).toMatch(/Giỏ có 3 món: Nhớt Castrol, Đá cây, Lưới/);
    expect(r.text).not.toMatch(/đ\b/);
    expect(A("giỏ có gì", snap()).text).toMatch(/Giỏ chưa có gì/);
  });

  it("AC-T20: đơn theo bản lưu 40 phút + không action huỷ; null → nói thật theo sóng", () => {
    const orders = { savedAt: NOW - 40 * 60_000, items: [{ code: "SD260906ABCD", status: "dang_giao" as const, shopName: "Đại Phát", totalVnd: 1430000, shopPhone: "0909123456" }] };
    const r = A("đơn đang giao", snap({ orders }));
    expect(r.text).toMatch(/1 đơn đang giao: SD260906ABCD của Đại Phát, 1\.430\.000 đ/);
    expect(r.text).toContain("lưu 40 phút trước");
    expect(r.speak).toMatch(/1 triệu 430 ngàn/);
    expect(JSON.stringify(r)).not.toMatch(/cancel|huy_don|placeOrder/);
    expect(A("đơn của tôi", snap({ online: false })).text).toMatch(/không có sóng/);
    expect(A("đơn của tôi", snap()).text).toMatch(/Mở Đơn của tôi/);
  });

  it("AC-T21: giá cá khớp loài bỏ dấu + mốc tuần; không loài → nói không có; chưa tải → 'chưa có bảng giá'", () => {
    const fishPrices = { savedAt: NOW - 3 * H, week: "30/8 – 5/9", items: [{ species: "Cá ngừ đại dương", minVnd: 95000, maxVnd: 110000 }, { species: "Mực ống", minVnd: 150000, maxVnd: 200000 }] };
    const r = A("giá cá ngừ hôm nay", snap({ fishPrices }));
    expect(r.text).toMatch(/Cá ngừ đại dương 95\.000 đ – 110\.000 đ\/kg/);
    expect(r.text).toContain("tuần 30/8 – 5/9");
    expect(r.speak).toMatch(/95 ngàn/);
    expect(A("giá cá thu", snap({ fishPrices })).text).toMatch(/không có 'cá thu'/);
    expect(A("giá cá hôm nay", EMPTY).text).toMatch(/chưa có bảng giá/i);
  });

  it("giá dầu: có → đ/lít + kỳ + mốc; không → 'Chưa có giá dầu'", () => {
    const r = A("giá dầu", snap({ fuel: { savedAt: NOW - H, date: "2026-09-04", priceVnd: 19850 } }));
    expect(r.text).toMatch(/Dầu DO 19\.850 đ\/lít, kỳ 4\/9/);
    expect(r.speak).toMatch(/19 ngàn 850 đồng/);
    expect(A("giá dầu", EMPTY).text).toMatch(/Chưa có giá dầu/);
  });

  it("AC-T23: gọi SDVICO → call + confirm, số IMPORT từ sdvico-showcase; mã trợ lý không chép số '0939'", () => {
    const r = A("gọi SDVICO", snap());
    expect(r.action).toEqual({ type: "call", tel: SDVICO_HOTLINE, label: "SDVICO" });
    expect(r.confirm).toBeTruthy();
    const dir = join(process.cwd(), "src", "lib", "assistant");
    const files: string[] = [];
    const walk = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) walk(p);
        else files.push(p);
      }
    };
    walk(dir);
    for (const f of files) expect(readFileSync(f, "utf8"), f).not.toContain("0939");
  });

  it("gọi shop: đơn có SĐT shop → call + confirm; không đơn → mở đơn; gọi bạn thuyền → màn Bạn thuyền (F-30)", () => {
    const orders = { savedAt: NOW, items: [{ code: "SD1", status: "dang_giao" as const, shopName: "Đại Phát", totalVnd: 1, shopPhone: "0909123456" }] };
    const r = A("gọi shop", snap({ orders }));
    expect(r.action).toEqual({ type: "call", tel: "0909123456", label: "Đại Phát" });
    expect(r.confirm).toBeTruthy();
    expect(A("gọi shop", snap()).action).toEqual({ type: "navigate", href: "/cho/don" });
    const crew = A("gọi anh Tâm", snap({ orders }));
    expect(crew.action).toEqual({ type: "navigate", href: "/nguoi" });
    expect(crew.text).not.toMatch(/\d{9,}/);
  });
});

describe("assistant-answer — điều hướng / điều khiển / an toàn", () => {
  it("AC-T22: mở màn → đúng URL cho 14 cụm; không khớp → hỏi + chip", () => {
    const table: [string, string][] = [
      ["mở ra khơi", "/ngu-truong"], ["mở bản đồ", "/ngu-truong"], ["vô tàu cá", "/tau"], ["mở giấy tờ", "/tau?tab=giay-to"],
      ["mở sổ bảo dưỡng", "/tau?tab=dich-vu"], ["mở sản phẩm", "/tau?tab=san-pham"], ["qua bạn thuyền", "/nguoi"],
      ["mở giao dịch", "/tien"], ["vào chợ", "/cho"], ["mở giỏ hàng", "/cho/gio"], ["mở đơn hàng", "/cho/don"],
      ["kênh người bán", "/ban-hang"], ["mở cảng", "/cang"], ["về trang chủ", "/"], ["mở hộp thư", "/"], ["mở hướng dẫn", "/huong-dan.html"],
    ];
    for (const [say, href] of table) {
      const r = A(say, snap());
      expect(r.action, say).toEqual({ type: "navigate", href });
      expect(r.confirm, say).toBeUndefined();
    }
    const r = answerOffline({ intent: "mo_man", confidence: 0.9, slots: {}, normalized: "mo" }, snap(), NOW);
    expect(r.clarify?.options.length).toBeGreaterThanOrEqual(4);
  });

  it("AC-T17: dẫn đường 1 điểm khớp → navigate /ngu-truong, không confirm, nói 'Điểm đã lưu' + tên; nhiều → clarify; 0 → chưa ghim", () => {
    const one = A("dẫn đường tới bãi mực", snap({ placeNames: ["Bãi mực"] }));
    expect(one.action).toEqual({ type: "navigate", href: "/ngu-truong" });
    expect(one.confirm).toBeUndefined();
    expect(one.text).toMatch(/Điểm đã lưu/);
    expect(one.text, "tên điểm có dấu tra từ máy").toMatch(/Bãi mực/);
    const ctx2 = { ...CTX, placeNames: ["Bãi mực 1", "Bãi mực 2"] };
    const many = A("dẫn đường tới bãi mực", snap({ placeNames: ctx2.placeNames }), ctx2);
    expect(many.clarify?.options.length).toBe(2);
    const zero = A("dẫn đường tới bãi mực", snap({ placeNames: [] }), { ...CTX, placeNames: [] });
    expect(zero.text).toMatch(/chưa ghim/);
  });

  it("AC-T18: đặt cảng nhà khớp rõ → setHomePort không confirm + chip lùi; không khớp → hỏi lại; chưa nói tên → hỏi", () => {
    const r = A("đặt cảng nhà là Quy Nhơn", snap({ home: null }));
    expect(r.action).toMatchObject({ type: "setHomePort", portId: "quy-nhon", portName: "Quy Nhơn", province: "Gia Lai" });
    expect(r.confirm).toBeUndefined();
    expect(r.clarify?.options[0].label).toBe("Chọn cảng khác");
    expect(A("đặt cảng nhà là Xyz", snap()).action).toBeUndefined();
    expect(A("đặt cảng nhà", snap()).clarify?.question).toMatch(/cảng nào/);
  });

  it("hộp thư / trợ giúp / điều khiển / chào", () => {
    expect(A("có tin mới không", snap({ inboxUnread: 2 })).text).toMatch(/2 tin chưa đọc/);
    expect(A("có tin mới không", snap()).text).toMatch(/Không có tin mới/);
    expect(A("bác nói được gì", snap()).clarify?.options.length).toBeGreaterThanOrEqual(2);
    expect(A("tắt tiếng", snap()).action).toEqual({ type: "mute", on: true });
    expect(A("bật tiếng", snap()).action).toEqual({ type: "mute", on: false });
    expect(A("alo", snap()).text).toBe("Dạ, bác cần gì?");
    expect(A("cảm ơn nha", snap()).text).toBe("Dạ.");
    expect(A("nói lại", snap()).intent).toBe("lap_lai");
  });

  it("ngoài phạm vi: câu chuẩn 13; y tế thêm 115; tra người → /nguoi", () => {
    const yte = A("uống thuốc gì cho hết say sóng", snap());
    expect(yte.text).toMatch(/không trả lời được/);
    expect(yte.text).toMatch(/115/);
    expect(yte.action).toBeUndefined();
    const tra = A("tra căn cước số 0123", snap());
    expect(tra.action).toEqual({ type: "navigate", href: "/nguoi" });
    expect(A("tôi nên vay ngân hàng nào", snap()).text).toMatch(/không trả lời được/);
  });

  it("không hiểu: quá dài → xin nói ngắn; hành động phá huỷ → chỉ đường + KHÔNG action ghi; 'mua dầu' → hỏi nhớt hay DO", () => {
    const dai = Array.from({ length: 45 }, (_, i) => `chữ${i}`).join(" ");
    expect(A(dai, snap()).text).toMatch(/nói ngắn/);
    const huy = A("huỷ đơn SD260906ABCD", snap());
    expect(huy.text).toMatch(/Việc đó bác làm trên màn Đơn hàng/);
    expect(huy.action).toEqual({ type: "navigate", href: "/cho/don" });
    const dau = A("mua dầu", snap());
    expect(dau.clarify?.options.map((o) => o.label)).toContain("Dầu nhớt");
    expect(A("asdf", snap()).text).toMatch(/chưa nghe rõ/);
  });

  it("hoi_mo offline: mất sóng → câu 13 'phải có sóng'; có sóng → chờ", () => {
    expect(A("nhớt nào tốt cho máy Yanmar", snap({ online: false })).text).toMatch(/phải có sóng/);
    expect(A("nhớt nào tốt cho máy Yanmar", snap()).intent).toBe("hoi_mo");
  });

  it("AC-T24: MỌI ý định × snapshot rỗng → action thuộc tập đóng, addToCart/call luôn kèm confirm, speak ≤2 câu, không ném", () => {
    for (const intent of INTENTS) {
      for (const s of [EMPTY, snap()]) {
        const p: ParsedIntent = { intent, confidence: 1, slots: intent === "mo_man" ? { target: "cho" } : { q: "da", qty: 2, placeName: "x", boatName: "y" }, normalized: "x" };
        const r = answerOffline(p, s, NOW);
        expect(r.intent, intent).toBe(intent);
        expect(r.source).toBe("offline");
        if (r.action) expect(ALLOWED, intent).toContain(r.action.type);
        if (r.action?.type === "call" || r.action?.type === "addToCart") expect(r.confirm, intent).toBeTruthy();
        expect((r.speak.match(/[.!?…]+/g) ?? []).length, `${intent}: ${r.speak}`).toBeLessThanOrEqual(2);
        expect(r.speak).not.toMatch(/\d\.\d{3}/);
      }
    }
  });

  it("onlineErrorReply: mọi mã có câu, mã đăng nhập kèm navigate /login", () => {
    for (const code of ["invalid", "bad_snapshot", "no_token", "unknown_token", "token_revoked", "quota", "no_key", "unavailable", "upstream", "timeout", "refused", "offline"] as const) {
      const r = onlineErrorReply(code, snap());
      expect(r.text.length, code).toBeGreaterThan(5);
      expect(r.source).toBe("offline");
    }
    expect(onlineErrorReply("no_token", snap()).action).toEqual({ type: "navigate", href: "/login" });
    expect(onlineErrorReply("quota", snap()).text).toMatch(/đủ 30 câu/);
    expect(onlineErrorReply("no_key", snap()).text).not.toMatch(/key|cấu hình/i);
  });

  it("AC-T25: không từ cấm (AI, chatbot, online, offline, kết nối, máy chủ, token, model, API) trong chuỗi UI của lib trợ lý", () => {
    const dir = join(process.cwd(), "src", "lib", "assistant");
    const banned = /(^|[^a-zA-Z_.])(AI|chatbot|online|offline|kết nối|máy chủ|token|model|API|lỗi 5xx)(?![a-zA-Z_])/;
    const literal = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g;
    const viPham: string[] = [];
    const walk = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) {
          if (n !== "server") walk(p);
          continue;
        }
        if (!/\.ts$/.test(n) || n === "types.ts") continue;
        const src = readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
        // chỉ soi CHUỖI LITERAL CÓ DẤU tiếng Việt (câu hiện cho bà con) — chuỗi kỹ thuật (mã, khoá, URL) không tính
        for (const m of src.match(literal) ?? []) {
          if (!/[àáảãạăâđèéẻẽẹêìíỉĩịòóỏõọôơùúủũụưỳýỷỹỵ]/i.test(m)) continue;
          if (banned.test(m)) viPham.push(`${n}: ${m.slice(0, 100)}`);
        }
      }
    };
    walk(dir);
    expect(viPham, viPham.join("\n")).toEqual([]);
  });

  it("toSpeech / vndSpeech / limitSentences", () => {
    expect(vndSpeech(1430000)).toBe("1 triệu 430 ngàn");
    expect(vndSpeech(19850)).toBe("19 ngàn 850");
    expect(vndSpeech(95000)).toBe("95 ngàn");
    expect(vndSpeech(500)).toBe("500");
    expect(toSpeech("điểm 82/100, sóng 0,8 m (ước), gió 25 km/h, 1.430.000 đ")).toBe("điểm 82 trên 100, sóng 0,8 mét ước, gió 25 cây số giờ, 1 triệu 430 ngàn đồng");
    expect(limitSentences("Một. Hai. Ba.", 2)).toBe("Một. Hai.");
    expect(limitSentences("Sóng 0,8 m. Gió 25.", 2)).toBe("Sóng 0,8 m. Gió 25.");
  });

  it("mọi Intent đều được answerOffline xử lý (không rơi default cho ý định đã biết)", () => {
    const missing: Intent[] = [];
    for (const intent of INTENTS) {
      const r = answerOffline({ intent, confidence: 1, slots: {}, normalized: "" }, snap(), NOW);
      if (r.intent !== intent) missing.push(intent);
    }
    expect(missing).toEqual([]);
  });
});
