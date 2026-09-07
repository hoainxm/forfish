import { describe, expect, it } from "vitest";
import { answerOffline, toSpeech } from "@/lib/assistant/answer";
import { CONFIDENCE_OFFLINE, parseUtterance } from "@/lib/assistant/parse";
import { ALL_PORT_NAMES } from "@/lib/assistant/ports";
import { rawSlot } from "@/lib/assistant/normalize";
import type { DeviceSnapshot, Intent, ParseContext, Slots } from "@/lib/assistant/types";

/*  VECTOR TỪ AUDIT "90% đơn giản" 2026-09-06 (`parse-dump.jsonl` 108 câu — chú
    Ba 55 tuổi) + 5 ca đỏ của QA. Câu hiểu SAI hồi đó được ghi kèm mã lỗi; câu
    hiểu đúng giữ lại làm hàng rào hồi quy. Danh sách cảng là DANH SÁCH THẬT.
    Tỉ lệ ≥95%, in số thật ra console.  */

const CTX: ParseContext = {
  route: "/",
  awaitingConfirm: false,
  boatNames: ["KH-91234", "KH-97777"],
  portNames: ALL_PORT_NAMES,
  placeNames: ["Bãi mực", "Hải đăng", "Rạn Hòn Cau"],
};

interface Case {
  say: string;
  intent: Intent;
  slots?: Partial<Slots>;
  followUp?: Intent;
  minConf?: number;
  /** mã lỗi audit (để tra ngược) */
  bug?: string;
}

const CASES: Case[] = [
  // ── hiểu SAI trong audit ──
  { say: "báo giá dầu", intent: "gia_dau", bug: "N4/P1-6" },
  { say: "giá dầu bao nhiêu", intent: "gia_dau", bug: "P1-6" },
  { say: "bao nhiêu tiền một lít dầu", intent: "gia_dau", bug: "Y43" },
  { say: "biển động không", intent: "thoi_tiet", slots: { aspect: "di_duoc" }, bug: "X21/P1-7" },
  { say: "biển động cấp mấy", intent: "thoi_tiet", slots: { aspect: "di_duoc" }, bug: "Y60/P1-7" },
  { say: "tui muốn gọi shop", intent: "goi_shop", bug: "N5/P1-9" },
  { say: "tôi cần gọi shop", intent: "goi_shop", bug: "P1-9" },
  { say: "gọi cho shop", intent: "goi_shop", bug: "P1-9" },
  { say: "tui muốn gọi SDVICO", intent: "goi_sdvico", bug: "P1-9" },
  { say: "gọi SDVICO", intent: "goi_sdvico", bug: "P1-9" },
  { say: "shop giao chưa", intent: "don_cua_toi", slots: { orderFilter: "dang_giao" }, bug: "Y15" },
  { say: "cho coi giá cá", intent: "gia_ca", bug: "Y10/P2-5" },
  { say: "đá cây bao nhiêu tiền", intent: "tim_mon", slots: { q: "da cay" }, bug: "Y14/P2-5" },
  { say: "nhớt castrol bao nhiêu", intent: "tim_mon", slots: { q: "dau nhot castrol" }, bug: "Y33/P2-5" },
  { say: "tàu tôi số gì", intent: "tau_cua_toi", bug: "Y21/P2-5" },
  { say: "mua đá 5 cây", intent: "tim_mon", slots: { q: "da", qty: 5, unit: "cay" }, bug: "N2/P2-4" },
  { say: "cảng nhà là Sa Kỳ", intent: "dat_cang_nha", slots: { placeName: "sa ky" }, minConf: 0.9, bug: "V9/P1-2" },
  { say: "đặt cảng nhà là Sa Kỳ", intent: "dat_cang_nha", slots: { placeName: "sa ky" }, minConf: 0.9, bug: "AC-T44" },
  { say: "đặt cảng nhà là cảng cá Sa Kỳ", intent: "dat_cang_nha", slots: { placeName: "sa ky" }, minConf: 0.9, bug: "P1-2" },
  { say: "đặt cảng nhà là Quy Nhơn", intent: "dat_cang_nha", slots: { placeName: "quy nhon" }, minConf: 0.9, bug: "Y6/P1-2" },
  { say: "cảng nhà là Hòn Rớ", intent: "dat_cang_nha", slots: { placeName: "hon ro" }, minConf: 0.9, bug: "Y7/P1-2" },
  { say: "tôi hay đi từ Sa Kỳ", intent: "dat_cang_nha", slots: { placeName: "sa ky" }, minConf: 0.9, bug: "Y8/P1-2" },
  { say: "cảng nhà là Tắc Cậu", intent: "dat_cang_nha", slots: { placeName: "tac cau" }, minConf: 0.9, bug: "M12" },
  { say: "đặt cảng nhà là Vũng Tàu", intent: "dat_cang_nha", slots: { placeName: "vung tau" }, minConf: 0.9, bug: "P1-2" },
  // ── hiểu ĐÚNG — hàng rào hồi quy ──
  { say: "nay đi được không", intent: "thoi_tiet", slots: { day: 0, aspect: "di_duoc" } },
  { say: "hôm nay ra khơi được không", intent: "thoi_tiet", slots: { day: 0, aspect: "di_duoc" } },
  { say: "mốt đi được không", intent: "thoi_tiet", slots: { day: 2, aspect: "di_duoc" } },
  { say: "mai đi được không", intent: "thoi_tiet", slots: { day: 1, aspect: "di_duoc" } },
  { say: "ra khơi được chưa", intent: "thoi_tiet", slots: { aspect: "di_duoc" } },
  { say: "mai sao", intent: "thoi_tiet", slots: { day: 1 } },
  { say: "5 ngày tới sao", intent: "thoi_tiet", slots: { day: 5 } },
  { say: "cho coi song gio bua nay", intent: "thoi_tiet", slots: { day: 0 } },
  { say: "nay có gió mùa không", intent: "thoi_tiet" },
  { say: "gió cấp mấy", intent: "thoi_tiet", slots: { aspect: "gio" } },
  { say: "bữa nay có dông không", intent: "thoi_tiet", slots: { aspect: "mua" } },
  { say: "mưa không", intent: "thoi_tiet", slots: { aspect: "mua" } },
  { say: "sóng lớn hông", intent: "thoi_tiet", slots: { aspect: "song" } },
  { say: "biển có êm không", intent: "thoi_tiet" },
  { say: "coi thời tiết Vũng Tàu giùm", intent: "thoi_tiet", slots: { portName: "vung tau" } },
  { say: "coi thời tiết rồi gọi SDVICO", intent: "thoi_tiet", followUp: "goi_sdvico" },
  { say: "có bão không", intent: "bao" },
  { say: "bão có không", intent: "bao" },
  { say: "biển đông có bão hông", intent: "bao" },
  { say: "coi bão", intent: "bao" },
  { say: "còn bão không", intent: "bao" },
  { say: "bão tan chưa", intent: "bao" },
  { say: "hết bão chưa", intent: "bao" },
  { say: "bão số mấy tới đâu rồi", intent: "bao" },
  { say: "báo cáo giấy tờ", intent: "giay_to" },
  { say: "con nước sao", intent: "con_nuoc" },
  { say: "nước lớn mấy giờ", intent: "con_nuoc" },
  { say: "giấy nào sắp hết", intent: "giay_to" },
  { say: "còn giấy tờ nào sắp hết", intent: "giay_to" },
  { say: "bảo hiểm tàu còn không", intent: "giay_to", slots: { docKind: "bao_hiem" } },
  { say: "hết hạn chưa", intent: "giay_to" },
  { say: "máy tới kỳ chưa", intent: "bao_duong" },
  { say: "thay nhớt chưa", intent: "bao_duong" },
  { say: "ai chưa có bảo hiểm", intent: "thuyen_vien" },
  { say: "tàu có mấy người", intent: "thuyen_vien" },
  { say: "tôi có mấy tàu", intent: "tau_cua_toi" },
  { say: "đổi sang tàu 97777", intent: "tau_cua_toi", slots: { boatName: "kh 97777" } },
  { say: "dẫn đường tới bãi mực", intent: "dan_duong", slots: { placeName: "bai muc" } },
  { say: "về cảng nhà", intent: "dan_duong", slots: { placeName: "cang nha" } },
  { say: "cần mua nhớt", intent: "tim_mon", slots: { q: "dau nhot" } },
  { say: "tôi muốn mua nhớt", intent: "tim_mon", slots: { q: "dau nhot" } },
  { say: "tui cần nhớt", intent: "tim_mon", slots: { q: "dau nhot" } },
  { say: "mua 5 cây đá", intent: "tim_mon", slots: { q: "da", qty: 5, unit: "cay" } },
  { say: "tìm lưới", intent: "tim_mon", slots: { q: "luoi" } },
  { say: "mua dầu", intent: "khong_hieu", slots: { q: "dau" } },
  { say: "bỏ 2 thùng nhớt vô giỏ", intent: "them_gio", slots: { q: "dau nhot", qty: 2, unit: "thung" } },
  { say: "bỏ 5 cây đá vô giỏ", intent: "them_gio", slots: { q: "da", qty: 5, unit: "cay" } },
  { say: "thêm đá vào giỏ", intent: "them_gio", slots: { q: "da", qty: 1 } },
  { say: "giỏ có gì", intent: "xem_gio" },
  { say: "đơn tới chưa", intent: "don_cua_toi", slots: { orderFilter: "dang_giao" } },
  { say: "đơn tui tới đâu rồi", intent: "don_cua_toi", slots: { orderFilter: "dang_giao" } },
  { say: "hàng tới chưa", intent: "don_cua_toi", slots: { orderFilter: "dang_giao" } },
  { say: "coi đơn", intent: "don_cua_toi", slots: { orderFilter: "tat_ca" } },
  { say: "gọi shop", intent: "goi_shop" },
  { say: "alo shop", intent: "goi_shop" },
  { say: "gọi tổng đài", intent: "goi_sdvico" },
  { say: "gọi anh Tâm", intent: "goi_shop", followUp: "thuyen_vien" },
  { say: "giá cá ngừ", intent: "gia_ca", slots: { species: "ca ngu" } },
  { say: "giá cá hôm nay", intent: "gia_ca" },
  { say: "cá ngừ bao nhiêu một ký", intent: "gia_ca", slots: { species: "ca ngu" } },
  { say: "giá dầu", intent: "gia_dau" },
  { say: "mở giấy tờ", intent: "mo_man", slots: { target: "giay_to" } },
  { say: "mở chợ", intent: "mo_man", slots: { target: "cho" } },
  { say: "mở bản đồ", intent: "mo_man", slots: { target: "ra_khoi" } },
  { say: "về trang chủ", intent: "mo_man", slots: { target: "trang_chu" } },
  { say: "kênh người bán", intent: "mo_man", slots: { target: "ban_hang" } },
  { say: "có tin gì mới", intent: "hop_thu" },
  { say: "hộp thư có gì", intent: "hop_thu" },
  { say: "giúp tôi với", intent: "tro_giup" },
  { say: "nói lại", intent: "lap_lai" },
  { say: "tắt loa", intent: "tat_tieng" },
  { say: "bật loa", intent: "bat_tieng" },
  { say: "đóng", intent: "huy" },
  { say: "thôi", intent: "huy" },
  { say: "nhớt nào tốt cho Yanmar", intent: "hoi_mo" },
  { say: "huỷ đơn", intent: "khong_hieu", followUp: "don_cua_toi" },
  { say: "đặt hàng luôn", intent: "khong_hieu", followUp: "xem_gio" },
  { say: "tra cccd 012345678901", intent: "ngoai_pham_vi" },
  { say: "uống thuốc gì cho hết say sóng", intent: "ngoai_pham_vi" },
  { say: "ừ", intent: "khong_hieu" },
  { say: "đổi lại", intent: "khong_hieu" }, // chip "Đổi lại" xử lý ở use-assistant (nói đúng chữ chip = chạm chip)
];

function slotErr(got: Slots, want?: Partial<Slots>): string | null {
  if (!want) return null;
  for (const [k, v] of Object.entries(want)) {
    if (got[k as keyof Slots] !== v) return `slot ${k}: chờ ${JSON.stringify(v)}, ra ${JSON.stringify(got[k as keyof Slots])}`;
  }
  return null;
}

describe("assistant-audit-vectors — 108 câu chú Ba (parse-dump 2026-09-06)", () => {
  it("≥30 vector từ câu hiểu sai + hồi quy; tỉ lệ đúng ≥95% (in số thật)", () => {
    expect(CASES.filter((c) => c.bug).length).toBeGreaterThanOrEqual(20);
    expect(CASES.length).toBeGreaterThanOrEqual(100);
    const fails: string[] = [];
    for (const c of CASES) {
      const p = parseUtterance(c.say, CTX);
      const errs: string[] = [];
      if (p.intent !== c.intent) errs.push(`intent chờ ${c.intent}, ra ${p.intent} (conf ${p.confidence})`);
      const se = slotErr(p.slots, c.slots);
      if (se) errs.push(se);
      if (c.followUp && p.followUp !== c.followUp) errs.push(`followUp chờ ${c.followUp}, ra ${p.followUp}`);
      const minConf = c.minConf ?? (c.intent === "khong_hieu" || c.intent === "hoi_mo" ? 0 : CONFIDENCE_OFFLINE);
      if (c.intent !== "khong_hieu" && p.confidence < minConf) errs.push(`conf ${p.confidence} < ${minConf}`);
      if (errs.length) fails.push(`"${c.say}"${c.bug ? ` [${c.bug}]` : ""} → ${errs.join("; ")} [norm: ${p.normalized}]`);
    }
    const rate = (CASES.length - fails.length) / CASES.length;
    console.log(`[assistant-audit-vectors] ${CASES.length - fails.length}/${CASES.length} đúng = ${(rate * 100).toFixed(1)}%`);
    if (fails.length) console.log(fails.join("\n"));
    expect(rate, fails.join("\n")).toBeGreaterThanOrEqual(0.95);
  });

  it("HARD: mọi câu đánh dấu bug đều phải đúng (không được trốn trong 5%)", () => {
    for (const c of CASES.filter((x) => x.bug)) {
      const p = parseUtterance(c.say, CTX);
      expect(p.intent, `"${c.say}" [${c.bug}]`).toBe(c.intent);
      expect(slotErr(p.slots, c.slots), `"${c.say}" [${c.bug}]`).toBeNull();
      if (c.minConf) expect(p.confidence, `"${c.say}" [${c.bug}]`).toBeGreaterThanOrEqual(c.minConf);
    }
  });

  it("chữ CÓ DẤU giữ theo câu gốc: qRaw / unitRaw / nameRaw (audit P1-5)", () => {
    const a = parseUtterance("bỏ 2 thùng nhớt vô giỏ", CTX);
    expect(a.slots).toMatchObject({ q: "dau nhot", qRaw: "dầu nhớt", unit: "thung", unitRaw: "thùng" });
    const b = parseUtterance("dẫn đường tới bãi mực", CTX);
    expect(b.slots.nameRaw).toBe("bãi mực");
    const c = parseUtterance("đặt cảng nhà là Sa Kỳ", CTX);
    expect(c.slots.nameRaw).toBe("Sa Kỳ");
    const d = parseUtterance("tìm dây thừng", CTX);
    expect(d.slots.qRaw).toBe("dây thừng");
    const e = parseUtterance("mua lọc dầu Yanmar", CTX);
    expect(e.slots.qRaw).toBe("lọc dầu Yanmar");
    expect(parseUtterance("gọi cửa hàng Hải Đăng", CTX).slots.nameRaw).toBe("Hải Đăng");
    // rawSlot: cụm liền trước; từng chữ sau; chữ máy tự thêm (đồng nghĩa) tra bảng, không bịa dấu chữ lạ
    expect(rawSlot("tôi đã mua đá", "da")).toBe("đá");
    expect(rawSlot("cần nhớt", "dau nhot castrol")).toBe("dầu nhớt castrol");
    expect(rawSlot("", "xyz")).toBe("xyz");
  });
});

/* ───────── câu trả lời: bão ưu tiên, đài duyên hải, chữ đọc (P0-1, P1-1, AC-T56) ───────── */

const NOW = Date.parse("2026-09-06T05:00:00Z");
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
const day = (o: number, level: "good" | "caution" | "bad" = "good", score = 82) => ({
  date: `2026-09-${String(6 + o).padStart(2, "0")}`, score, level, waveMaxM: 0.8, waveEstimated: false,
  windMaxKmh: 25, gustMaxKmh: 34, precipMm: 0, wmoCode: 1,
});
const WEATHER = { portId: "quy-nhon", portName: "Quy Nhơn", savedAt: NOW - 2 * H, days: [day(0), day(1), day(2), day(3), day(4)] };
const BAO = { savedAt: NOW - H, storms: [{ name: "WUTIP", kindLabel: "Bão", windKmh: 120, alert: "danger" as const, lat: 15, lon: 112 }] };
const A = (say: string, s: DeviceSnapshot) => answerOffline(parseUtterance(say, CTX), s, NOW);
const soCau = (t: string) => (t.match(/[.!?…]+/g) ?? []).length;

describe("assistant-audit-vectors — câu trả lời an toàn", () => {
  it("P0-1: có bão trong máy → MỌI câu thời tiết/đi được MỞ ĐẦU bằng bão + 'đừng ra khơi', không kết luận 'đi được'", () => {
    for (const say of ["nay đi được không", "thời tiết hôm nay", "mai sóng sao", "gió hôm nay mạnh không", "5 ngày tới sao", "biển động không"]) {
      const r = A(say, snap({ weather: WEATHER, storm: BAO }));
      expect(r.text, say).toMatch(/^Có bão WUTIP, gió 120 km\/h — đừng ra khơi vùng ảnh hưởng\./);
      expect(r.speak, say).toMatch(/^Có bão WUTIP/);
      expect(r.text, say).not.toMatch(/đi được/);
      expect(r.speak, say).not.toMatch(/đi được/);
      expect(`${r.text} ${r.speak}`, say).toMatch(/đài duyên hải/);
      expect(soCau(r.speak), `${say}: ${r.speak}`).toBeLessThanOrEqual(2);
    }
    // bão nhưng máy chưa có dự báo: vẫn bão trước
    const r = A("nay đi được không", snap({ storm: BAO }));
    expect(r.text).toMatch(/^Có bão WUTIP/);
    expect(r.text).toMatch(/đài duyên hải/i);
    // tin bão đã cũ (>12 h) vẫn nói, kèm tuổi tin
    const cu = A("thời tiết hôm nay", snap({ weather: WEATHER, storm: { ...BAO, savedAt: NOW - 18 * H } }));
    expect(cu.text).toMatch(/^Có bão WUTIP.*tin đã cũ, lưu 18 giờ trước/);
  });

  it("không bão → 'đi được' như cũ; thời tiết thường KHÔNG nhắc bão trước", () => {
    const r = A("nay đi được không", snap({ weather: WEATHER, storm: { savedAt: NOW - H, storms: [] } }));
    expect(r.text).toMatch(/^Hôm nay ở Quy Nhơn: điểm 82\/100/);
    expect(r.text).toMatch(/biển êm — đi được/);
    expect(r.text).toMatch(/Không có tin bão \(lưu 1 giờ trước\)/);
  });

  it("AC-T56: MỌI câu thời tiết trong máy (sóng/gió/mưa/3 ngày/thiếu số/đã cũ) đều có 'đài duyên hải', speak ≤2 câu", () => {
    const cases: [string, DeviceSnapshot][] = [
      ["hôm nay sóng gió sao", snap({ weather: WEATHER })],
      ["mai sóng sao", snap({ weather: WEATHER })],
      ["gió hôm nay mạnh không", snap({ weather: WEATHER })],
      ["trời có mưa không", snap({ weather: WEATHER })],
      ["5 ngày tới sao", snap({ weather: WEATHER })],
      ["thời tiết hôm nay", snap()],
      ["thời tiết hôm nay", snap({ weather: { ...WEATHER, days: [{ ...day(0), date: "2026-09-01" }] } })],
      ["6 ngày tới sao", snap({ weather: WEATHER, premium: true })],
    ];
    for (const [say, s] of cases) {
      const r = A(say, s);
      expect(r.text, say).toMatch(/đài duyên hải/i);
      expect(r.speak, `${say}: ${r.speak}`).toMatch(/đài duyên hải/i);
      expect(soCau(r.speak), `${say}: ${r.speak}`).toBeLessThanOrEqual(2);
    }
  });

  it("P1-1: speak không 'métét'/'métón'; đơn vị chỉ đổi khi đứng riêng sau số; km/kg cũng vậy", () => {
    const r = A("mai đi được không", snap({ weather: WEATHER, storm: { savedAt: NOW - H, storms: [] } }));
    expect(r.speak).toMatch(/sóng 0,8 mét, gió 25 cây số giờ/);
    expect(r.speak).not.toMatch(/métét|giờgiờ|đồngđồng|trên 100 trên 100/);
    expect(A("giỏ có gì", snap({ cart: { lines: 1, titles: [] } })).speak).toBe("Giỏ có 1 món.");
    expect(toSpeech("1 món, 2 mét, 3 m, 4 m.")).toBe("1 món, 2 mét, 3 mét, 4 mét.");
    expect(toSpeech("cách 12 km, nặng 5 kg, 25 km/h, 90.000 đ/kg")).toBe("cách 12 cây số, nặng 5 ký, 25 cây số giờ, 90 ngàn đồng một ký");
    expect(toSpeech("1,2 mét")).toBe("1,2 mét");
  });

  it("P1-16: y tế — speak vẫn còn 'gọi 115' dù trần 2 câu", () => {
    const r = A("uống thuốc gì cho hết say sóng", snap());
    expect(r.text).toMatch(/115/);
    expect(r.speak).toMatch(/gọi 115/);
    expect(soCau(r.speak)).toBeLessThanOrEqual(2);
  });

  it("P1-2/P1-3/AC-T44: cảng nhà theo danh sách THẬT — tên có dấu + tỉnh đúng + id thật + chip 'Đổi lại' về cảng cũ", () => {
    const r = A("đặt cảng nhà là Sa Kỳ", snap());
    expect(r.action).toEqual({ type: "setHomePort", portId: "sa-ky", portName: "Sa Kỳ", province: "Quảng Ngãi" });
    expect(r.confirm).toBeUndefined();
    expect(r.text).toMatch(/^Đã đặt cảng nhà là Sa Kỳ, Quảng Ngãi\./);
    expect(r.text).not.toMatch(/sa ky/);
    // đường lùi 1 chạm: chip "Đổi lại" đặt lại cảng cũ (Quy Nhơn)
    const back = r.clarify?.options.find((o) => o.label === "Đổi lại");
    expect(back?.utterance).toBe("đặt cảng nhà là Quy Nhơn");
    const undo = A(back!.utterance, snap());
    expect(undo.action).toMatchObject({ type: "setHomePort", portId: "quy-nhon", province: "Gia Lai" });
    // Tắc Cậu: tỉnh An Giang (không giữ tỉnh cũ Gia Lai)
    expect(A("cảng nhà là Tắc Cậu", snap()).action).toMatchObject({ portId: "tac-cau", portName: "Tắc Cậu", province: "An Giang" });
    expect(A("cảng nhà là Hòn Rớ", snap()).action).toMatchObject({ portId: "hon-ro", portName: "Hòn Rớ", province: "Khánh Hòa" });
    // chưa có cảng nhà → chip "Chọn cảng khác" (khác chữ với chip "Đổi lại" — P2-N2)
    expect(A("đặt cảng nhà là Sa Kỳ", snap({ home: null })).clarify?.options[0].label).toBe("Chọn cảng khác");
  });

  it("P1-2: nhiều cảng cùng chữ → hỏi lại bằng chip ≤4 (chọn chip = đặt ngay); không có → nói tên có dấu bà con vừa nói", () => {
    const r = A("đặt cảng nhà là Hòn", snap());
    expect(r.action).toBeUndefined();
    expect(r.clarify?.options.length).toBeGreaterThan(1);
    expect(r.clarify?.options.length).toBeLessThanOrEqual(4);
    for (const o of r.clarify!.options) {
      expect(o.utterance).toMatch(/^đặt cảng nhà là /);
      expect(A(o.utterance, snap()).action?.type, o.utterance).toBe("setHomePort");
    }
    const none = A("đặt cảng nhà là Xyz Lạ Hoắc", snap());
    expect(none.action).toBeUndefined();
    expect(none.text).toMatch(/Không thấy cảng tên 'Xyz Lạ Hoắc'/);
  });

  it("P1-N2: 'Đà Nẵng' KHÔNG thành 'Bến Đá' — không có cảng tên đó, hỏi lại + gợi ý cảng cùng tỉnh", () => {
    for (const say of ["đặt cảng nhà Đà Nẵng", "cảng nhà là Đà Nẵng"]) {
      const r = A(say, snap());
      expect(r.action, say).toBeUndefined();
      expect(r.text, say).toMatch(/Không thấy cảng tên 'Đà Nẵng'/);
      // chip gợi ý: cảng THẬT trong tỉnh đó, chọn chip là đặt được ngay
      const goi = r.clarify!.options.filter((o) => o.label !== "Mở danh sách cảng");
      expect(goi.length, say).toBeGreaterThan(0);
      for (const o of goi) expect(A(o.utterance, snap()).action?.type, o.utterance).toBe("setHomePort");
      expect(goi.map((o) => o.label).join(" "), say).toMatch(/Đà Nẵng/);
      expect(goi.map((o) => o.label).join(" "), say).not.toMatch(/Bến Đá/);
    }
  });

  it("P1-N3: bão XA + watch → câu thời tiết bình thường, chỉ nhắc một câu phụ; bão gần hoặc danger vẫn dẫn đầu", () => {
    // Quy Nhơn (13,76N 109,27E) ↔ Okinawa (25,5N 128,2E) ≈ 2.200 km
    const XA = { savedAt: NOW - H, storms: [{ ...BAO.storms[0], name: "KROVANH", alert: "watch" as const, lat: 25.5, lon: 128.2, distanceKm: 2200 }] };
    const xa = A("nay đi được không", snap({ weather: WEATHER, storm: XA }));
    expect(xa.text).toMatch(/^Hôm nay ở Quy Nhơn/);
    expect(xa.text).toMatch(/biển êm — đi được/);
    expect(xa.text).toMatch(/Có bão KROVANH ở xa\./);
    expect(xa.text).toMatch(/đài duyên hải/i);
    expect(xa.speak).not.toMatch(/đừng ra khơi/);
    // câu hỏi hẹp (sóng/gió) cũng phải nhắc bão xa, không dẫn đầu
    const song = A("mai sóng sao", snap({ weather: WEATHER, storm: XA }));
    expect(song.text).toMatch(/Có bão KROVANH ở xa\./);
    expect(song.text).not.toMatch(/^Có bão/);
    expect(soCau(song.speak), song.speak).toBeLessThanOrEqual(2);
    // gần (≤500 km) → dẫn đầu như cũ
    const gan = A("nay đi được không", snap({ weather: WEATHER, storm: { ...XA, storms: [{ ...XA.storms[0], distanceKm: 300 }] } }));
    expect(gan.text).toMatch(/^Có bão KROVANH.*đừng ra khơi vùng ảnh hưởng\./);
    expect(gan.text).toMatch(/chưa nên đi/);
    // thiếu toạ độ (chưa đặt cảng nhà / bản tin thiếu) → COI NHƯ GẦN, nghiêng về an toàn
    const chuaBiet = A("nay đi được không", snap({ weather: WEATHER, storm: { ...XA, storms: [{ name: "KROVANH", kindLabel: "Bão", windKmh: 83, alert: "watch" as const }] } }));
    expect(chuaBiet.text).toMatch(/^Có bão KROVANH/);
    expect(chuaBiet.text).toMatch(/chưa nên đi/);
    // danger thì xa mấy cũng dẫn đầu
    const nguy = A("nay đi được không", snap({ weather: WEATHER, storm: { ...XA, storms: [{ ...XA.storms[0], alert: "danger" as const, distanceKm: 2200 }] } }));
    expect(nguy.text).toMatch(/^Có bão KROVANH/);
    expect(nguy.text).toMatch(/chưa nên đi/);
  });

  it("P2-N1 + P2-3: mã đơn không bị đọc thành 'mét'; 'lưu 0 phút trước' → 'lưu vừa xong'", () => {
    expect(toSpeech("đơn SD260904M3RT của SDVICO")).toBe("đơn SD260904M3RT của SDVICO");
    expect(toSpeech("mã 4M3 và 12 m và 5m")).toBe("mã 4M3 và 12 mét và 5 mét");
    expect(toSpeech("mưa 12 mm")).toBe("mưa 12 mm");
    const vua = A("giá dầu", snap({ fuel: { savedAt: NOW - 5_000, date: "2026-09-06", priceVnd: 27740 } }));
    expect(vua.text).toMatch(/Số lưu vừa xong\./);
    expect(vua.text).not.toMatch(/0 phút/);
  });

  it("P1-10: ý thứ hai trong câu → chip cho ý đó, không tự làm", () => {
    const r = A("coi thời tiết rồi gọi SDVICO", snap({ weather: WEATHER }));
    expect(r.intent).toBe("thoi_tiet");
    expect(r.action).toEqual({ type: "navigate", href: "/ngu-truong" });
    expect(r.clarify?.options.map((o) => o.label)).toContain("Gọi SDVICO");
  });

  it("P0-3: them_gio mang `qty` đã nói theo reply (UI mở sẵn bộ đếm)", () => {
    expect(A("bỏ 5 cây đá vô giỏ", snap()).qty).toBe(5);
    expect(A("thêm đá vào giỏ", snap()).qty).toBe(1);
  });

  it("đổi tàu: chip 'Đổi lại' đặt lại tàu đang chọn", () => {
    const r = A("đổi sang tàu 97777", snap({ boat: { name: "KH-91234", count: 2, names: ["KH-91234", "KH-97777"] } }));
    expect(r.action).toMatchObject({ type: "setBoat", boatName: "KH-97777" });
    expect(r.clarify?.options[0]).toEqual({ label: "Đổi lại", utterance: "đổi sang tàu KH-91234" });
  });
});
