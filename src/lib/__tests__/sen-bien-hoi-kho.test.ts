// @vitest-environment jsdom
// Chuỗi trả lời câu hỏi kiến thức (lib/sen-bien/hoi-kho.ts, doc 15 §26, 2026-10-19): v4 hiểu lệnh → lọc → v5b 9 câu →
// Gemma (giả) chọn / ngưỡng n-gram → kho; trượt ⇒ máy nhà (fetch giả) / câu an toàn. ⚠ Kho chưa duyệt — bản test.
import { existsSync, readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DAU_KHO_PATH, loadDauKho } from "@/lib/sen-bien/dau-kho";
import { DEVICE_TOKEN_KEY } from "@/lib/device-token-store";
import { senBienReply, type SenDest, type SenReply } from "@/lib/sen-bien/hieu-y";
import { CAU_CAN_KIEM, docKho, HOI_DAP_PATH } from "@/lib/sen-bien/hoi-dap";
import { CAU_CHUA_CHAC, goLenhNgan, hoiKho, Q_CHAC, ungVien, vaoKho, type BoKho, type ChonFn } from "@/lib/sen-bien/hoi-kho";
import { hoiMayChu } from "@/lib/sen-bien/hoi-may-chu";
import { chonBuoc } from "@/lib/sen-bien/luong-tra-loi";
import { LOC_PATH, loadLoc } from "@/lib/sen-bien/loc";
import { loadNgram, NGRAM_PATH } from "@/lib/sen-bien/ngram";

const ab = (p: string) => {
  const b = readFileSync(`public${p}`);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
// bin v7 (cơ cấu mới 2026-10-25) giao sau — chưa có thì các khối cần trọng số skip có lý do
const coBin = existsSync(`public${NGRAM_PATH}`);
const v4 = coBin ? loadNgram(ab(NGRAM_PATH))! : (null as unknown as NonNullable<ReturnType<typeof loadNgram>>);
const canBin = describe.skipIf(!coBin);
const dk = loadDauKho(ab(DAU_KHO_PATH))!;
const raw = JSON.parse(readFileSync(`public${HOI_DAP_PATH}`, "utf8"));
const kho = docKho(raw, dk.nq)!;
const loc = loadLoc(ab(LOC_PATH))!;
const BO: BoKho = { dk, kho, loc };
const DESTS: SenDest[] = [{ name: "Sa Huỳnh", lat: 14.67, lon: 109.07, kind: "cang" }];

const r4 = (cau: string) => senBienReply(cau, v4, DESTS, null);
/** Gemma giả: ghi lại lời gọi, trả số cho trước. */
const gia = (k: number | null | Error) => {
  const goi: { cau: string; hoi: readonly string[] }[] = [];
  const fn: ChonFn = async (cau, hoi) => {
    goi.push({ cau, hoi });
    if (k instanceof Error) throw k;
    return k;
  };
  return { fn, goi };
};
const hoi = (cau: string, chon: ChonFn | null, bo: BoKho | null = BO) => hoiKho(cau, r4(cau), bo, {}, chon);

canBin("(a) lệnh + câu trả lời thật của v4/luật KHÔNG vào kho", () => {
  it.each([
    "dẫn tôi về cảng Sa Huỳnh", // go
    "chạy ra táp cẩu", // tên lệch giọng, mở bằng động từ đi lại
    "mai sóng gió thế nào", // thoi_tiet, lọc thấp
    "hôm qua ăn gì", // khong_hieu nhưng lọc thấp — đầu kho tự tin 0,999 với câu ngoài kho, không được đọc
  ])("%s", async (cau) => {
    expect(vaoKho(cau, r4(cau), loc, {})).toBe(false);
    expect(await hoi(cau, gia(1).fn)).toEqual({ vao: false });
  });
  it("câu đã trả lời thật (daTraLoi) / ngoài phạm vi ⇒ không vào", () => {
    const r: SenReply = { kind: "say", say: "Chỗ đang xem: sóng 1 m.", y: "thoi_tiet", daTraLoi: true };
    expect(vaoKho("máy tàu nóng quá phải làm sao", r, loc, {})).toBe(false);
    expect(vaoKho("tôi bị đau đầu uống thuốc gì", r4("tôi bị đau đầu uống thuốc gì"), loc, {})).toBe(false);
  });
  it("4 câu tên chỗ lệch giọng vẫn là dẫn đường (v4 giữ — không tụt như v5b)", () => {
    const PORTS: SenDest[] = ["Hòn Rớ", "Quy Nhơn", "Tịnh Hòa", "Tắc Cậu"].map((name, i) => ({ name, lat: 10 + i, lon: 106 + i, kind: "cang" as const }));
    for (const [cau, ten] of [["cho tui về hòn dớ nha", "Hòn Rớ"], ["về bến quèo nhôn", "Quy Nhơn"], ["chạy ra tiền hòa", "Tịnh Hòa"], ["chạy ra táp cẩu", "Tắc Cậu"]]) {
      const r = senBienReply(cau, v4, PORTS, null);
      expect(r.kind === "go" && r.dest.name).toBe(ten);
    }
  });
});

canBin("(b) vào kho: v4 hoi_mo, hoặc bộ lọc ≥ LOC_NGUONG khi v4 lạc ý", () => {
  it("có Gemma thì LUÔN hỏi Gemma, kể cả khi câu nhất v5b rất chắc (bỏ lối tắt 0,9 — kiểm chéo)", async () => {
    const g = gia(1);
    const kq = await hoi("cách giữ cá ngừ tươi lâu trên tàu", g.fn);
    expect(kq).toEqual({ vao: true, dap: { id: "nghe_ca-005", say: raw.dap["nghe_ca-005"], cach: "gemma" } });
    expect(g.goi).toHaveLength(1);
  });
  // v6 (22/10, thêm câu ngoài nghề): câu này nay ra khong_hieu thay vì đoán lạc tau_cua_toi — lọc vẫn kéo vào kho
  it("lọc kéo câu hiểu ý không ra (khong_hieu) vào kho", async () => {
    expect(r4("máy tàu nóng quá phải làm sao")).toMatchObject({ kind: "say", y: "khong_hieu" });
    const kq = await hoi("máy tàu nóng quá phải làm sao", null);
    expect(kq.vao && kq.dap?.id).toBe("may_tau-011");
  });
  it("không có bộ lọc ⇒ chỉ ý hoi_mo vào", () => {
    expect(vaoKho("máy tàu nóng quá phải làm sao", r4("máy tàu nóng quá phải làm sao"), null, {})).toBe(false);
    expect(vaoKho("tại sao nhớt máy bị đen", r4("tại sao nhớt máy bị đen"), null, {})).toBe(true);
  });
  it("câu cần kiểm (số liệu / luật) ⇒ câu an toàn, KHÔNG đọc câu máy soạn", async () => {
    const kq = await hoi("giấy phép khai thác hết hạn thì gia hạn ở đâu", null);
    expect(kq.vao && kq.dap).toMatchObject({ id: "giay_to_tau-053", say: CAU_CAN_KIEM });
  });

  const CAU = "tại sao nhớt máy bị đen"; // hoi_mo · câu nhất may_tau-045 p≈0,62 (≥ Q_CHAC)
  it("Android, Gemma ĐỒNG Ý câu nhất v5b (chọn số 1) ⇒ đọc câu đó; prompt đúng 9 câu chuẩn", async () => {
    const g = gia(1);
    const uv = ungVien(BO, CAU, {});
    expect(uv).toHaveLength(9);
    expect(uv[0].p).toBeGreaterThanOrEqual(Q_CHAC);
    const kq = await hoi(CAU, g.fn);
    expect(kq.vao && kq.dap).toMatchObject({ id: uv[0].id, cach: "gemma" });
    expect(g.goi).toEqual([{ cau: CAU, hoi: uv.map((u) => u.hoi) }]);
    expect(uv[0].hoi).toBe(raw.cauHoi[raw.q.indexOf(uv[0].id)]);
  });
  it("Gemma chọn câu KHÁC câu nhất v5b (k = 2..9) ⇒ hai bên lệch ⇒ kho trượt, không đọc", async () => {
    for (const k of [2, 5, 9]) expect(await hoi(CAU, gia(k).fn)).toEqual({ vao: true, dap: null });
  });
  it("Gemma nói 0 ⇒ kho trượt (đi máy nhà / câu an toàn)", async () => {
    expect(await hoi(CAU, gia(0).fn)).toEqual({ vao: true, dap: null });
  });
  it("Gemma null (mô hình hiện tại trả JSON, quá giờ) / ném lỗi ⇒ như web: câu nhất p ≥ Q_CHAC", async () => {
    for (const g of [gia(null), gia(new Error("plugin"))]) {
      const kq = await hoi(CAU, g.fn);
      expect(kq.vao && kq.dap).toMatchObject({ id: "may_tau-045", cach: "ngram" });
    }
  });
  it("Gemma trả số ngoài 1..9 ⇒ bỏ, lùi ngưỡng n-gram", async () => {
    const kq = await hoi(CAU, gia(12).fn);
    expect(kq.vao && kq.dap?.cach).toBe("ngram");
  });
  it("web (không Gemma), câu nhất p < Q_CHAC ⇒ trượt", async () => {
    const cau = "tại sao đi biển phải có kinh nghiệm"; // v5c 22/10: v4 hoi_mo, câu nhất p ≈ 0,16 (câu v5b cũ nay v5c đã chắc)
    expect(ungVien(BO, cau, {})[0].p).toBeLessThan(Q_CHAC);
    expect(await hoi(cau, null)).toEqual({ vao: true, dap: null });
  });
  it("chưa tải được kho ⇒ vào mà trượt (không ném)", async () => {
    expect(await hoi(CAU, gia(1).fn, null)).toEqual({ vao: true, dap: null });
  });
});


canBin("lọc đè ĐÚNG hai luật lệnh ngắn bắt nhầm đuôi câu hỏi (chủ dự án 2026-10-19)", () => {
  const go = (cau: string, l = loc) => goLenhNgan(cau, r4(cau), l, {});
  it.each([
    ["nhớt máy thay bao lâu một lần", "howfar", "may_tau-004"],
    ["đăng kiểm tàu bao lâu một lần", "howfar", "giay_to_tau-012"],
  ])("%s (luật cũ: %s) ⇒ tới kho", async (cau, luat, id) => {
    expect(r4(cau).kind).toBe(luat);
    const r = go(cau);
    if (!id) return expect(r.kind).toBe(luat);
    expect(r).toEqual({ kind: "say", say: CAU_CHUA_CHAC, y: "hoi_mo" });
    const kq = await hoiKho(cau, r, BO, {}, null);
    expect(kq.vao && kq.dap?.id).toBe(id);
  });
  // 2026-10-24: luật "nhắc lại" chỉ còn bắt câu NGẮN (≤5 chữ) ⇒ "…là gì vậy" không bị bắt từ đầu, khỏi cần lọc gỡ
  it("câu hỏi dài đuôi 'là gì vậy' không còn là nhắc lại — đi thẳng tới kho / câu hỏi", async () => {
    const cau = "máy giám sát hành trình là gì vậy";
    expect(r4(cau).kind).not.toBe("repeat");
    const kq = await hoiKho(cau, go(cau), BO, {}, null);
    expect(kq.vao && kq.dap?.id).toBe("sdvico_thiet_bi-002");
    expect(r4("con nước rong là gì vậy").kind).not.toBe("repeat");
  });
  it("câu cần kiểm / chưa duyệt qua đường này vẫn ra câu an toàn", async () => {
    const cau = "giấy phép khai thác bao lâu phải gia hạn"; // v5c: giay_to_tau-017 cần kiểm, chưa duyệt
    const kq = await hoiKho(cau, go(cau), BO, {}, null);
    expect(kq.vao && kq.dap?.say).toBe(CAU_CAN_KIEM);
  });
  it.each(["nhắc lại", "nói lại đi", "nhắc lại coi", "nói gì vậy", "gì vậy"])("lệnh thật '%s' vẫn là nhắc lại", (cau) =>
    expect(go(cau).kind).toBe("repeat"));
  it.each(["còn bao xa", "còn bao xa nữa tới", "bao lâu nữa thì tới", "tới chưa"])("lệnh thật '%s' vẫn là còn bao xa", (cau) =>
    expect(go(cau).kind).toBe("howfar"));
  it("chưa có bộ lọc ⇒ luật cũ giữ nguyên", () => expect(go("nhớt máy thay bao lâu một lần", null as never).kind).toBe("howfar"));
  it("KHÔNG đè chặn ngoài phạm vi / câu hỏi bản đồ / dẫn đường", () => {
    for (const cau of ["tôi bị đau đầu uống thuốc gì", "gần đảo nào nhất", "dẫn tôi về cảng Sa Huỳnh"]) {
      const r = r4(cau);
      expect(goLenhNgan(cau, r, loc, {})).toBe(r);
    }
  });
});

canBin("(c) kho trượt ⇒ máy nhà nhận câu (daTraLoi vẫn false)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });
  it("câu hoi_mo trượt kho: chonBuoc hỏi máy nhà khi có chuỗi + có sóng; mất sóng thì không", () => {
    const r = r4("Mang mực với cá nục làm mồi đi xa, ướp kiểu nào để khỏi hư?");
    expect(r.kind === "say" && r.daTraLoi).toBeFalsy();
    const o = { r, conf: null, coApp: false, coChuoi: true, text: "Mang mực với cá nục" };
    expect(chonBuoc({ ...o, online: true }).buoc).toBe("may-nha");
    expect(chonBuoc({ ...o, online: false }).buoc).toBe("noi");
  });
  it("hoiMayChu gửi đúng câu tới /api/sen-bien/hoi (fetch giả) và trả chữ", async () => {
    localStorage.setItem(DEVICE_TOKEN_KEY, "sdf_" + "a".repeat(43));
    const f = vi.fn(async () => new Response(JSON.stringify({ ok: true, text: "Ướp đá muối.", speak: ["Ướp đá muối."] }), { status: 200 }));
    vi.stubGlobal("fetch", f);
    const dap = await hoiMayChu("Mang mực làm mồi ướp sao", "/ngu-truong", null);
    expect("text" in dap && dap.text).toBe("Ướp đá muối.");
    expect(String((f.mock.calls[0] as unknown[])[0])).toContain("/api/sen-bien/hoi");
  });
  // trượt phải mang LÝ DO để Sen Biển nói đúng (luong-tra-loi.cauTruot, 2026-10-22)
  it.each([
    [504, "het_gio"],
    [401, "chua_dang_nhap"],
    [502, "may_nha"],
  ] as const)("route trả %i ⇒ lý do %s", async (status, loi) => {
    localStorage.setItem(DEVICE_TOKEN_KEY, "sdf_" + "a".repeat(43));
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: false }), { status })));
    expect(await hoiMayChu("con gà có mấy chân", null, null)).toEqual({ loi });
  });
  it("chưa có chuỗi thiết bị ⇒ chua_dang_nhap, không gọi mạng", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(await hoiMayChu("con gà có mấy chân", null, null)).toEqual({ loi: "chua_dang_nhap" });
    expect(f).not.toHaveBeenCalled();
  });
  it("rớt mạng giữa chừng (fetch ném) ⇒ mat_song; quá giờ ⇒ het_gio", async () => {
    localStorage.setItem(DEVICE_TOKEN_KEY, "sdf_" + "a".repeat(43));
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    expect(await hoiMayChu("con gà có mấy chân", null, null)).toEqual({ loi: "mat_song" });
    vi.stubGlobal("fetch", vi.fn(async () => { throw Object.assign(new Error("t"), { name: "TimeoutError" }); }));
    expect(await hoiMayChu("con gà có mấy chân", null, null)).toEqual({ loi: "het_gio" });
  });
});
