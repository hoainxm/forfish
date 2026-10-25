import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { DAU_KHO_PATH, loadDauKho, NY_KHO, sbn5Bytes, topK } from "@/lib/sen-bien/dau-kho";
import { CAU_CAN_KIEM, cauTraLoi, docKho, HOI_DAP_PATH, KHO_CHUA_DUYET, KHO_DA_DUYET } from "@/lib/sen-bien/hoi-dap";
import { LOC_BYTES, LOC_PATH, loadLoc, pHoi } from "@/lib/sen-bien/loc";

// Kho hỏi–đáp v2 (v5c ĐÃ DUYỆT, 2026-10-22) + đầu kho v5c + bộ lọc (2026-10-19). Chỉ câu đã duyệt mang câu trả lời.
const ab = (p: string) => {
  const b = readFileSync(`public${p}`);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const dk = loadDauKho(ab(DAU_KHO_PATH))!;
const raw = JSON.parse(readFileSync(`public${HOI_DAP_PATH}`, "utf8")) as {
  trangThai: string;
  q: string[];
  cauHoi: string[];
  dap: Record<string, string>;
  canKiem: string[];
};
const kho = docKho(raw, dk.nq)!;
const loc = loadLoc(ab(LOC_PATH))!;

describe("đầu kho v5c — tệp SBN5 (chỉ đọc đầu kho, đầu ý định bỏ)", () => {
  it("đúng đầu + đúng cỡ (H=64, 2297 câu)", () => {
    expect(dk.h).toBe(64);
    expect(dk.nq).toBe(2297);
    expect(ab(DAU_KHO_PATH).byteLength).toBe(sbn5Bytes(64, 2297));
  });
  it("bị cắt / sai magic / lệch số ý / bản v4 dày ⇒ null", () => {
    const b = ab(DAU_KHO_PATH);
    expect(loadDauKho(b.slice(0, b.byteLength - 4))).toBeNull();
    expect(loadDauKho(new ArrayBuffer((1 << 16) * 70))).toBeNull();
    const sai = b.slice(0);
    new DataView(sai).setUint8(3, 0x34);
    expect(loadDauKho(sai)).toBeNull();
    const lech = b.slice(0);
    new DataView(lech).setUint32(12, NY_KHO + 1, true);
    expect(loadDauKho(lech)).toBeNull();
  });
  it("topK giảm dần, tổng xác suất ≤ 1, đúng câu (số bản train — so topk.mjs 2.056 câu lệch 0)", () => {
    const t = topK(dk, "cách giữ cá ngừ tươi lâu trên tàu", {}, 12);
    expect(t).toHaveLength(12);
    for (let i = 1; i < t.length; i++) expect(t[i].p).toBeLessThanOrEqual(t[i - 1].p);
    expect(raw.q[t[0].i]).toBe("nghe_ca-005");
    expect(t[0].p).toBeGreaterThan(0.99);
  });
});

describe("bộ lọc câu hỏi / câu lệnh — tệp SBL1", () => {
  it("đúng cỡ, sai cỡ / sai magic ⇒ null", () => {
    expect(ab(LOC_PATH).byteLength).toBe(LOC_BYTES);
    expect(loadLoc(new ArrayBuffer(65536))).toBeNull();
    const sai = ab(LOC_PATH);
    new DataView(sai).setUint8(0, 0x41);
    expect(loadLoc(sai)).toBeNull();
  });
  it.each([
    ["máy tàu nóng quá phải làm sao", 1, 0.99],
    ["giấy phép khai thác hết hạn thì gia hạn ở đâu", 0.865, 0.01],
    ["dẫn tôi về cảng Sa Huỳnh", 0.025, 0.01],
    ["mai sóng gió thế nào", 0.01, 0.01],
  ])("%s ⇒ p ≈ %s (số bản train loc.mjs)", (cau, p, sai) => {
    expect(Math.abs(pHoi(loc, cau as string) - (p as number))).toBeLessThanOrEqual((sai as number) + 0.0005);
  });
});

describe("kho hỏi–đáp — GÁC duyệt (2026-10-22: chỉ câu chủ dự án đã duyệt mang câu trả lời)", () => {
  it("file kho ghi rõ trạng thái ĐÃ DUYỆT; chỉ nhận đúng hai trạng thái", () => {
    expect(raw.trangThai).toBe(KHO_DA_DUYET);
    expect(KHO_DA_DUYET).toBe("da-duyet");
    expect(docKho({ ...raw, trangThai: KHO_CHUA_DUYET }, dk.nq)).not.toBeNull();
    expect(docKho({ ...raw, trangThai: "duyet-roi" }, dk.nq)).toBeNull();
    expect(docKho({ ...raw, trangThai: undefined }, dk.nq)).toBeNull();
  });
  it("câu CẦN KIỂM (số liệu / luật) không mang câu trả lời nào trong file", () => {
    for (const id of raw.canKiem) expect(raw.dap[id]).toBeUndefined();
  });
  it("mỗi lớp có câu hỏi chuẩn + đúng một chỗ: câu trả lời HOẶC cần kiểm", () => {
    expect(raw.q.length).toBe(dk.nq);
    expect(raw.cauHoi.length).toBe(dk.nq);
    for (const id of raw.q) expect(id in raw.dap !== raw.canKiem.includes(id)).toBe(true);
    // v5c 2026-10-22: 1607 câu không cần kiểm đã duyệt (theo lệnh chủ dự án 20/10); 690 câu còn lại đọc câu an toàn
    expect(Object.keys(raw.dap).length).toBe(1607);
    expect(raw.canKiem.length).toBe(690);
  });
  it("file lẫn câu trả lời cho câu cần kiểm ⇒ docKho bỏ câu đó, vẫn đọc câu an toàn", () => {
    const id = raw.canKiem[0];
    const k = docKho({ ...raw, dap: { ...raw.dap, [id]: "Phạt 50 triệu." } }, dk.nq)!;
    expect(k.dap[id]).toBeUndefined();
    expect(cauTraLoi(k, id)).toBe(CAU_CAN_KIEM);
  });
  it("kho lệch mô hình (số câu khác) / hỏng / thiếu câu hỏi chuẩn ⇒ null", () => {
    expect(docKho(raw, dk.nq + 1)).toBeNull();
    expect(docKho(null, dk.nq)).toBeNull();
    expect(docKho({ ...raw, q: "x" }, dk.nq)).toBeNull();
    expect(docKho({ ...raw, cauHoi: raw.cauHoi.slice(1) }, dk.nq)).toBeNull();
    expect(docKho({ ...raw, dap: [] }, dk.nq)).toBeNull();
  });
  it("cauTraLoi: mã thường ⇒ câu có sẵn; mã lạ ⇒ null", () => {
    expect(cauTraLoi(kho, "nghe_ca-005")).toBe(raw.dap["nghe_ca-005"]);
    expect(cauTraLoi(kho, "khong-co")).toBeNull();
  });
});
