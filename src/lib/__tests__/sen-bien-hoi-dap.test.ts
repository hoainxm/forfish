import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { cauGoiY, doanHoiDap, dungKho, loadHoiDap, NGUONG_DAP, traLoiKho, type KhoHoiDap } from "@/lib/sen-bien/hoi-dap";
import { lamSachMau } from "@/lib/sen-bien/mau-hoc";

// File THẬT trong public/data (bản rõ trong git) — train ở AI Assistant train/tro-ly/ngram-ft.mjs, kho do chủ dự án duyệt.
const bin = readFileSync("public/data/sen-bien-hoi-dap.v1.bin");
const buf = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) as ArrayBuffer;
const kho = JSON.parse(readFileSync("public/data/sen-bien-hoi-dap.v1.json", "utf8")) as KhoHoiDap & { hoi?: Record<string, string> };
const hoiCua = (id: string) => kho.hoi?.[id] ?? kho.dap[id]?.hoi;

/** Kho giả: coi như mọi câu đã duyệt (để đo mô hình, không phụ thuộc tiến độ duyệt). */
const khoDu: KhoHoiDap = { q: kho.q, dap: Object.fromEntries(kho.q.map((id) => [id, { hoi: hoiCua(id) ?? id, dap: `đáp ${id}` }])) };
const mDu = loadHoiDap(buf, khoDu)!;

describe("Sen Biển kho hỏi–đáp v1 (SBN5)", () => {
  it("nạp đúng file thật; sai định dạng / lệch số câu / thiếu kho ⇒ null", () => {
    expect(mDu).not.toBeNull();
    expect(loadHoiDap(new ArrayBuffer(10), khoDu)).toBeNull();
    expect(loadHoiDap(buf, { q: kho.q.slice(1), dap: {} })).toBeNull();
    expect(loadHoiDap(buf, null)).toBeNull();
    const hong = buf.slice(0); new Uint8Array(hong)[0] = 0x41;
    expect(loadHoiDap(hong, khoDu)).toBeNull();
  });

  it("kho chỉ có mã câu (q) và câu đã duyệt (dap) — mọi câu đã duyệt đều có trong q", () => {
    for (const id of Object.keys(kho.dap)) expect(kho.q).toContain(id);
  });

  it("câu chuẩn của kho đoán ra đúng nó (đo trên 200 câu đầu)", () => {
    let dung = 0, n = 0;
    for (const id of kho.q.slice(0, 200)) {
      const h = hoiCua(id); if (!h) continue; n++;
      const d = doanHoiDap(mDu, h);
      if (d.laHoi && d.top[0].id === id) dung++;
    }
    expect(n).toBeGreaterThan(0);
    expect(dung / n).toBeGreaterThan(0.9);
  });

  it("n-gram v4 chắc về một LỆNH ⇒ kho không chen vào", () => {
    const h = hoiCua(kho.q[0])!;
    expect(traLoiKho(mDu, h, { y: "mo_lop", conf: 0.95 })).toBeNull();
    expect(traLoiKho(mDu, h, { y: "dan_duong", conf: 0.8 })).toBeNull();
  });

  it("v4 nhường (hoi_mo / khong_hieu / kém chắc) ⇒ kho trả lời câu đã duyệt", () => {
    const id = kho.q.find((x) => { const h = hoiCua(x); return h && doanHoiDap(mDu, h).top[0].p >= NGUONG_DAP && doanHoiDap(mDu, h).top[0].id === x; })!;
    const h = hoiCua(id)!;
    for (const v4 of [{ y: "hoi_mo", conf: 0.99 }, { y: "khong_hieu", conf: 0.9 }, { y: "gia_ca", conf: 0.3 }, null]) {
      const r = traLoiKho(mDu, h, v4);
      expect(r).toEqual({ loai: "dap", id, hoi: khoDu.dap[id].hoi, dap: `đáp ${id}` });
    }
  });

  it("câu CHƯA duyệt không bao giờ được đọc; kho trống ⇒ im", () => {
    const id = kho.q[0];
    const chiMot = loadHoiDap(buf, { q: kho.q, dap: {} })!;
    expect(traLoiKho(chiMot, hoiCua(id)!, { y: "hoi_mo", conf: 1 })).toBeNull();
    const khac = kho.q.find((x) => x !== id)!;
    const m2 = loadHoiDap(buf, { q: kho.q, dap: { [khac]: khoDu.dap[khac] } })!;
    const r = traLoiKho(m2, hoiCua(id)!, { y: "hoi_mo", conf: 1 });
    if (r?.loai === "dap") expect(r.id).toBe(khac);
    if (r?.loai === "goi_y") expect(r.cac.every((c) => c.id === khac)).toBe(true);
  });

  it("câu rỗng / chưa có mô hình ⇒ null", () => {
    expect(traLoiKho(mDu, "   ", null)).toBeNull();
    expect(traLoiKho(null, "thẻ vàng là gì", null)).toBeNull();
  });

  it("câu gợi ý đọc được bằng giọng", () => {
    expect(cauGoiY([{ hoi: "Thẻ vàng là gì?" }])).toBe("Có phải bà con hỏi: Thẻ vàng là gì?");
    expect(cauGoiY([{ hoi: "A?" }, { hoi: "B?" }])).toBe("Bà con hỏi câu nào: A, hay B?");
  });

  it("dựng kho: chỉ câu duyệt (ok) / sửa (sua) vào dap; bỏ / chưa duyệt / sửa rỗng thì không", () => {
    const dm = [
      { id: "a-001", hoi: "A?", dap: "gốc A" }, { id: "a-002", hoi: "B?", dap: "gốc B" },
      { id: "a-003", hoi: "C?", dap: "gốc C" }, { id: "a-004", hoi: "D?", dap: "gốc D" }, { id: "a-005", hoi: "E?", dap: "gốc E" },
    ];
    const k = dungKho(["a-001", "a-002", "a-003", "a-004", "a-005"], dm,
      { "a-001": { t: "ok" }, "a-002": { t: "sua", dap: "  sửa B  " }, "a-003": { t: "bo" }, "a-005": { t: "sua", dap: " " } });
    expect(k.dap).toEqual({ "a-001": { hoi: "A?", dap: "gốc A" }, "a-002": { hoi: "B?", dap: "sửa B" } });
    expect(Object.keys(k.hoi)).toHaveLength(5);
    expect(k.q).toHaveLength(5);
  });

  it("mẫu học nhận nhãn hd (câu kho trả lời / gợi ý)", () => {
    const m = { id: "x1", t: 1, phien: "p1", cau: "thẻ vàng là gì", tra: "hd", ct: "iuu_xuat_cap_ben-001", xn: false, chay: false, nen: "web", ban: "b" };
    expect(lamSachMau(m)?.tra).toBe("hd");
    expect(lamSachMau({ ...m, ct: "goi_y:3" })?.ct).toBe("goi_y:3");
  });
});
