// Tuỳ chọn dòng tin Kairos (14 §13, 2026-10-24): lưu trong máy, gửi `thich`/`ai=0`, máy chủ đọc không 400.
import { describe, expect, it } from "vitest";
import {
  chuanChuDe, docThamSo, doiThich, giongNhau, parseTuyChon, serializeTuyChon, themThamSo, tuyChonMacDinh, TUY_CHON_KEY,
} from "@/lib/kairos/tuy-chon";

describe("tuy-chon — lưu trong máy", () => {
  it("khoá đúng tên trong state-registry", () => {
    expect(TUY_CHON_KEY).toBe("forfish.kairos.tuychon.v1");
  });
  it("mặc định: không thích gì, hiện bài trợ lý AI", () => {
    expect(tuyChonMacDinh()).toEqual({ v: 1, thich: [], ai: true });
  });
  it("hỏng / lạ / phiên bản khác ⇒ mặc định", () => {
    for (const raw of [null, undefined, "", "{", "[]", '{"v":2,"thich":["kinh-te"]}', "x".repeat(5000)]) {
      expect(parseTuyChon(raw)).toEqual(tuyChonMacDinh());
    }
  });
  it("khứ hồi; mã lạ + trùng bỏ, giữ thứ tự TOPICS", () => {
    const t = parseTuyChon('{"v":1,"thich":["kinh-te","xxx","nghe-ca","kinh-te",3],"ai":false}');
    expect(t).toEqual({ v: 1, thich: ["nghe-ca", "kinh-te"], ai: false });
    expect(parseTuyChon(serializeTuyChon(t))).toEqual(t);
    expect(parseTuyChon('{"v":1,"thich":"nghe-ca"}')).toEqual(tuyChonMacDinh());
  });
  it("doiThich bật/tắt; giongNhau so nội dung", () => {
    const a = doiThich(tuyChonMacDinh(), "the-thao");
    expect(a.thich).toEqual(["the-thao"]);
    expect(doiThich(a, "the-thao").thich).toEqual([]);
    expect(giongNhau(doiThich(a, "the-thao"), tuyChonMacDinh())).toBe(true);
    expect(giongNhau(a, tuyChonMacDinh())).toBe(false);
  });
  it("chuanChuDe bỏ thứ không phải chuỗi", () => {
    expect(chuanChuDe([null, 1, "giai-tri", {}])).toEqual(["giai-tri"]);
  });
});

describe("tuy-chon — tham số request ↔ máy chủ", () => {
  it("mặc định không thêm tham số nào", () => {
    expect(themThamSo(new URLSearchParams("chip=moi"), tuyChonMacDinh()).toString()).toBe("chip=moi");
  });
  it("thich + ai=0; không sửa params gốc", () => {
    const goc = new URLSearchParams("chip=moi");
    const q = themThamSo(goc, { v: 1, thich: ["kinh-te", "nghe-ca"], ai: false });
    expect(q.get("thich")).toBe("nghe-ca,kinh-te");
    expect(q.get("ai")).toBe("0");
    expect(goc.has("thich")).toBe(false);
  });
  it("máy chủ: mã lạ bỏ qua, ai chỉ tắt khi đúng '0'", () => {
    const r = docThamSo(new URLSearchParams("thich=the-thao,bay,,nghe-ca&ai=0"));
    expect([...r.thich]).toEqual(["nghe-ca", "the-thao"]);
    expect(r.ai).toBe(false);
    expect(docThamSo(new URLSearchParams("ai=false")).ai).toBe(true);
    const rong = docThamSo(new URLSearchParams(""));
    expect(rong.thich.size).toBe(0);
    expect(rong.ai).toBe(true);
    expect(docThamSo(new URLSearchParams("thich=" + "nghe-ca,".repeat(100))).thich.size).toBe(1);
  });
});
