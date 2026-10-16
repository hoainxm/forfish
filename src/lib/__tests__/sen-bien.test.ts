import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { foldVn, guessIntent, loadNgram, NGRAM_BYTES } from "@/lib/sen-bien/ngram";
import { findDests, senBienReply, type SenDest } from "@/lib/sen-bien/hieu-y";

const buf = readFileSync("public/data/sen-bien-ngram.v1.bin");
const model = loadNgram(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer)!;

const DESTS: SenDest[] = [
  { name: "Sa Huỳnh", lat: 14.67, lon: 109.07, kind: "cang" },
  { name: "Quy Nhơn", lat: 13.78, lon: 109.25, kind: "cang" },
  { name: "Hòn Mù", lat: 14.9, lon: 109.3, kind: "diem" },
  { name: "Bến nhà", lat: 14.6, lon: 109.0, kind: "nha" },
];

describe("ngram Sen Biển — chép y bản train (Forlife Assistant 0c7b771)", () => {
  it("file trọng số đúng cỡ, sai cỡ thì từ chối", () => {
    expect(buf.byteLength).toBe(NGRAM_BYTES);
    expect(loadNgram(new ArrayBuffer(10))).toBeNull();
  });
  it.each([
    ["dẫn tôi về cảng Sa Huỳnh", "dan_duong", 0.975],
    ["chạy ra Hòn Mù", "dan_duong", 0.98],
    ["mai sóng gió thế nào", "thoi_tiet", 0.999],
    ["có bão không", "bao", 0.999],
    ["giá cá ngừ hôm nay", "gia_ca", 0.998],
    ["tôi bị đau đầu uống thuốc gì", "ngoai_pham_vi", 0.976],
    ["dừng lại", "huy", 0.919],
  ])("%s → %s (đúng số của bản train)", (cau, y, conf) => {
    const g = guessIntent(model, cau);
    expect(g.y).toBe(y);
    expect(g.conf).toBeCloseTo(conf, 2);
  });
  it("fold bỏ dấu + đ", () => expect(foldVn("Đà Nẵng, Cảng!")).toBe("da nang cang"));
});

describe("senBienReply — chọn điểm đến bằng giọng", () => {
  it("nói tên cảng ⇒ đi tới đúng cảng", () => {
    const r = senBienReply("dẫn tôi về cảng Sa Huỳnh", model, DESTS, null);
    expect(r.kind).toBe("go");
    if (r.kind === "go") expect(r.dest.name).toBe("Sa Huỳnh");
  });
  it("điểm đã ghim cũng được", () => {
    const r = senBienReply("chạy ra Hòn Mù", model, DESTS, null);
    expect(r.kind === "go" && r.dest.name).toBe("Hòn Mù");
  });
  it("không có mô hình (chưa tải được) vẫn dẫn khi có tên chỗ", () => {
    const r = senBienReply("Quy Nhơn", null, DESTS, null);
    expect(r.kind === "go" && r.dest.name).toBe("Quy Nhơn");
  });
  it("về nhà ⇒ cảng nhà", () => {
    const r = senBienReply("dẫn về nhà", model, DESTS, null);
    expect(r.kind === "go" && r.dest.kind).toBe("nha");
  });
  it("tên không có ⇒ nói thật, không đoán toạ độ", () => {
    const r = senBienReply("dẫn tôi ra đảo Xyz", model, DESTS, null);
    expect(r.kind).toBe("say");
  });
  it("trùng tên ⇒ cho chọn", () => {
    const two = [...DESTS, { name: "Sa Huỳnh", lat: 15, lon: 108, kind: "diem" as const }];
    expect(findDests("về Sa Huỳnh", two)).toHaveLength(2);
    expect(senBienReply("về Sa Huỳnh", model, two, null).kind).toBe("pick");
  });
  it("hỏi sóng gió ⇒ đọc dòng chỗ đang xem", () => {
    const r = senBienReply("mai sóng gió thế nào", model, DESTS, "sóng 1 m, gió cấp 3");
    expect(r.say).toContain("sóng 1 m");
  });
  it("việc ngoài bản đồ ⇒ nói chưa làm", () => {
    expect(senBienReply("giá cá ngừ hôm nay", model, DESTS, null).say).toContain("chỉ giúp trên bản đồ");
  });
  it("câu rỗng ⇒ hỏi lại", () => {
    expect(senBienReply("  ", model, DESTS, null).kind).toBe("say");
  });
});
