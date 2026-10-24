// Cỗ máy phân phối dòng tin ở máy chủ (anh Long 2026-10-24: "nâng lên"; agent "đan xen để tránh nhàm").
import { describe, expect, it } from "vitest";
import {
  diemBai, docHat, giaiMaPP, guDoc, laBaiAgent, nhieu, NHIEU_XAO, laTinBien, maHoaPP, tacGiaCua, TRAN_KHONG_BIEN, TRAN_TAC_GIA, W_THICH, xepDongTin,
  type PPPost, type Reader, type ReadSignal,
} from "@/lib/kairos/phan-phoi";

const NOW = Date.parse("2026-10-24T08:00:00Z");
const h = (gio: number) => new Date(NOW - gio * 3_600_000).toISOString();

let n = 0;
function bai(o: Partial<PPPost> = {}): PPPost {
  n++;
  return {
    id: `p${n}`, kind: "bao", author_phone: null, outlet: "VnExpress", topic: "thoi-su",
    regions: [], provinces: [], ports: [], hay_count: 0, comment_count: 0,
    published_at: h(1), feed_at: h(1), ...o,
  };
}
const khach: Reader = { reads: [], follows: new Set(), home: { port: null, province: null, regions: [] } };
const doc = (p: PPPost, o: Partial<ReadSignal> = {}): ReadSignal => ({
  post_id: p.id, topic: p.topic, tacGia: tacGiaCua(p), seen_at: h(2), opened: false, dwell_ms: 0, ...o,
});
const ctx0 = { chuDe: new Map<string, number>(), tacGia: new Map<string, number>(), daXem: new Map<string, { opened: boolean }>() };

describe("guDoc — học gu từ bài đã xem/mở", () => {
  it("mở nhiều chủ đề nghề cá, lướt qua thể thao ⇒ nghề cá dương, thể thao âm", () => {
    const reads: ReadSignal[] = [];
    for (let i = 0; i < 6; i++) reads.push(doc(bai({ topic: "nghe-ca" }), { opened: true }));
    for (let i = 0; i < 6; i++) reads.push(doc(bai({ topic: "the-thao" })));
    const g = guDoc(reads, (r) => r.topic, NOW);
    expect(g.get("nghe-ca")!).toBeGreaterThan(0.3);
    expect(g.get("the-thao")!).toBeLessThan(-0.3);
  });
  it("đọc lâu (≥ 20 s) tính như mở bài", () => {
    const reads = [doc(bai({ topic: "nghe-ca" }), { dwell_ms: 25_000 }), doc(bai({ topic: "giai-tri" }))];
    const g = guDoc(reads, (r) => r.topic, NOW);
    expect(g.get("nghe-ca")!).toBeGreaterThan(g.get("giai-tri")!);
  });
  it("tín hiệu quá 30 ngày bị bỏ; chưa có gì ⇒ rỗng", () => {
    expect(guDoc([doc(bai(), { opened: true, seen_at: h(24 * 31) })], (r) => r.topic, NOW).size).toBe(0);
    expect(guDoc([], (r) => r.topic, NOW).size).toBe(0);
  });
});

describe("diemBai", () => {
  it("bài mới hơn điểm cao hơn (cùng mọi thứ khác)", () => {
    expect(diemBai(bai({ feed_at: h(1) }), khach, NOW, ctx0)).toBeGreaterThan(diemBai(bai({ feed_at: h(30) }), khach, NOW, ctx0));
  });
  it("gần nhà: cảng > tỉnh > vùng > không", () => {
    const r: Reader = { ...khach, home: { port: "sa-huynh", province: "quang-ngai", regions: ["mien-trung"] } };
    const cang = diemBai(bai({ ports: ["sa-huynh"] }), r, NOW, ctx0);
    const tinh = diemBai(bai({ provinces: ["quang-ngai"] }), r, NOW, ctx0);
    const vung = diemBai(bai({ regions: ["mien-trung"] }), r, NOW, ctx0);
    const xa = diemBai(bai(), r, NOW, ctx0);
    expect(cang).toBeGreaterThan(tinh);
    expect(tinh).toBeGreaterThan(vung);
    expect(vung).toBeGreaterThan(xa);
  });
  it("nhiều bình luận/Hay đẩy lên; đang theo dõi tác giả đẩy lên", () => {
    expect(diemBai(bai({ comment_count: 10 }), khach, NOW, ctx0)).toBeGreaterThan(diemBai(bai(), khach, NOW, ctx0));
    const r: Reader = { ...khach, follows: new Set(["0901"]) };
    expect(diemBai(bai({ kind: "ba-con", author_phone: "0901" }), r, NOW, ctx0)).toBeGreaterThan(
      diemBai(bai({ kind: "ba-con", author_phone: "0902" }), r, NOW, ctx0),
    );
  });
  it("đã mở ⇒ xuống đáy; lướt qua ⇒ nửa điểm", () => {
    const p = bai();
    const goc = diemBai(p, khach, NOW, ctx0);
    expect(diemBai(p, khach, NOW, { ...ctx0, daXem: new Map([[p.id, { opened: false }]]) })).toBeCloseTo(goc * 0.5);
    expect(diemBai(p, khach, NOW, { ...ctx0, daXem: new Map([[p.id, { opened: true }]]) })).toBeLessThan(0);
  });
});

describe("xepDongTin — đan xen", () => {
  it("không bỏ, không lặp bài", () => {
    const ps = Array.from({ length: 60 }, (_, i) => bai({ outlet: ["A", "B", "C"][i % 3], topic: ["nghe-ca", "thoi-su"][i % 2] }));
    const out = xepDongTin(ps, khach, NOW);
    expect(out).toHaveLength(60);
    expect(new Set(out.map((p) => p.id)).size).toBe(60);
  });
  it("một người/agent tối đa 2 bài một trang và không đứng liền nhau", () => {
    const ps = [
      ...Array.from({ length: 10 }, () => bai({ kind: "ba-con", author_phone: "agent:bay-muc", topic: "nghe-ca", feed_at: h(0.1) })),
      ...Array.from({ length: 30 }, (_, i) => bai({ outlet: `Báo ${i % 5}`, feed_at: h(5) })),
    ];
    const trang1 = xepDongTin(ps, khach, NOW).slice(0, 20);
    expect(trang1.filter((p) => p.author_phone === "agent:bay-muc").length).toBe(TRAN_TAC_GIA.nguoi);
    for (let i = 1; i < trang1.length; i++) expect(tacGiaCua(trang1[i])).not.toBe(tacGiaCua(trang1[i - 1]));
  });
  it("không quá 3 bài cùng chủ đề liền nhau khi còn chủ đề khác", () => {
    const ps = [
      // bài bà con (đều là tin biển) — chỉ thử luật chủ đề, không dính luật 85 %
      ...Array.from({ length: 12 }, (_, i) => bai({ kind: "ba-con", author_phone: `b${i}`, topic: "doi-song", feed_at: h(0.5) })),
      ...Array.from({ length: 6 }, (_, i) => bai({ kind: "ba-con", author_phone: `c${i}`, topic: "nghe-ca", feed_at: h(10) })),
    ];
    const out = xepDongTin(ps, khach, NOW).slice(0, 14);
    for (let i = 3; i < out.length; i++) {
      const bon = out.slice(i - 3, i + 1).map((p) => p.topic);
      expect(new Set(bon).size).toBeGreaterThan(1);
    }
  });
  it("người đọc mê nghề cá thấy bài nghề cá lên trước bài thể thao cùng giờ", () => {
    const reads: ReadSignal[] = [];
    for (let i = 0; i < 8; i++) reads.push(doc(bai({ topic: "nghe-ca" }), { opened: true }));
    for (let i = 0; i < 8; i++) reads.push(doc(bai({ topic: "the-thao" })));
    const r: Reader = { ...khach, reads };
    const tt = bai({ topic: "the-thao", outlet: "X" });
    const nc = bai({ topic: "nghe-ca", outlet: "Y" });
    expect(xepDongTin([tt, nc], r, NOW)[0].id).toBe(nc.id);
  });
  it("xác định: cùng dữ liệu ⇒ cùng thứ tự (phân trang bằng vị trí không lặp)", () => {
    const ps = Array.from({ length: 30 }, (_, i) => bai({ outlet: `B${i % 4}` }));
    expect(xepDongTin(ps, khach, NOW).map((p) => p.id)).toEqual(xepDongTin(ps, khach, NOW).map((p) => p.id));
  });
});

describe("tỉ lệ biển 85 %", () => {
  it("laTinBien: bài bà con/agent/SDVICO, bài báo Nghề cá, tin Hoàng Sa–Trường Sa", () => {
    expect(laTinBien(bai({ kind: "ba-con", author_phone: "x", topic: "doi-song" }))).toBe(true);
    expect(laTinBien(bai({ topic: "nghe-ca" }))).toBe(true);
    expect(laTinBien(bai({ topic: "thoi-su", regions: ["hoang-sa-truong-sa"] }))).toBe(true);
    expect(laTinBien(bai({ topic: "the-thao" }))).toBe(false);
  });
  it("tin chung mới hơn, nhiều Hay hơn vẫn chỉ được 3/20 bài khi còn tin biển", () => {
    const chung = Array.from({ length: 40 }, (_, i) => bai({ outlet: `B${i % 8}`, topic: ["the-thao", "thoi-su", "giai-tri"][i % 3], feed_at: h(0.2), hay_count: 30 }));
    const bien = Array.from({ length: 30 }, (_, i) => bai({ outlet: `T${i % 8}`, topic: "nghe-ca", feed_at: h(20) }));
    const trang1 = xepDongTin([...chung, ...bien], khach, NOW).slice(0, 20);
    expect(trang1.filter((p) => !laTinBien(p)).length).toBeLessThanOrEqual(TRAN_KHONG_BIEN);
  });
  it("hết tin biển thì dòng tin vẫn chạy tiếp bằng tin chung (không tắt ngang)", () => {
    const chung = Array.from({ length: 25 }, (_, i) => bai({ outlet: `B${i % 8}`, topic: "the-thao" }));
    expect(xepDongTin(chung, khach, NOW)).toHaveLength(25);
  });
});

describe("con trỏ pp", () => {
  it("mã hoá ↔ giải mã", () => {
    const c = { at: h(0.2), off: 40 };
    expect(giaiMaPP(maHoaPP(c), NOW)).toEqual(c);
  });
  it("lạ / quá cũ / tương lai / vị trí âm ⇒ null", () => {
    expect(giaiMaPP("abc", NOW)).toBeNull();
    expect(giaiMaPP(maHoaPP({ at: h(72), off: 0 }), NOW)).toBeNull();
    expect(giaiMaPP(maHoaPP({ at: new Date(NOW + 3_600_000).toISOString(), off: 0 }), NOW)).toBeNull();
    expect(giaiMaPP(`pp.${Buffer.from('{"a":"x","o":-1}').toString("base64url")}`, NOW)).toBeNull();
  });
});

describe("Tuỳ chọn dòng tin — Thích đọc + ẩn bài trợ lý AI (14 §13)", () => {
  it("chủ đề Thích đọc được cộng đúng W_THICH; chủ đề khác không đổi", () => {
    const r: Reader = { ...khach, thich: new Set(["the-thao"]) };
    const tt = bai({ topic: "the-thao" });
    const ts = bai({ topic: "thoi-su" });
    expect(diemBai(tt, r, NOW, ctx0) - diemBai(tt, khach, NOW, ctx0)).toBeCloseTo(W_THICH);
    expect(diemBai(ts, r, NOW, ctx0)).toBeCloseTo(diemBai(ts, khach, NOW, ctx0));
  });
  it("ưu tiên, KHÔNG lọc: bài chủ đề thích lên trước bài cùng giờ, chủ đề khác vẫn còn đủ", () => {
    const ps = [
      ...Array.from({ length: 6 }, (_, i) => bai({ kind: "ba-con", author_phone: `a${i}`, topic: "doi-song", feed_at: h(2) })),
      ...Array.from({ length: 6 }, (_, i) => bai({ kind: "ba-con", author_phone: `b${i}`, topic: "kinh-te", feed_at: h(2) })),
    ];
    const r: Reader = { ...khach, thich: new Set(["kinh-te"]) };
    const out = xepDongTin(ps, r, NOW);
    expect(out).toHaveLength(12);
    expect(out.slice(0, 3).every((p) => p.topic === "kinh-te")).toBe(true);
  });
  it("không đè độ mới: bài vừa đăng vẫn trên bài chủ đề thích đã 2 ngày", () => {
    const r: Reader = { ...khach, thich: new Set(["the-thao"]) };
    const moi = bai({ kind: "ba-con", author_phone: "m", topic: "nghe-ca", feed_at: h(0) });
    const cu = bai({ kind: "ba-con", author_phone: "c", topic: "the-thao", feed_at: h(48) });
    expect(xepDongTin([cu, moi], r, NOW)[0].id).toBe(moi.id);
  });
  it("thích Thể thao KHÔNG phá trần tin biển 3/20", () => {
    const chung = Array.from({ length: 30 }, (_, i) => bai({ outlet: `B${i % 8}`, topic: "the-thao", feed_at: h(0.2) }));
    const bien = Array.from({ length: 30 }, (_, i) => bai({ outlet: `T${i % 8}`, topic: "nghe-ca", feed_at: h(20) }));
    const r: Reader = { ...khach, thich: new Set(["the-thao"]) };
    const trang1 = xepDongTin([...chung, ...bien], r, NOW).slice(0, 20);
    expect(trang1.filter((p) => !laTinBien(p)).length).toBeLessThanOrEqual(TRAN_KHONG_BIEN);
  });
  it("laBaiAgent: chỉ SĐT sentinel `agent:`", () => {
    expect(laBaiAgent(bai({ kind: "ba-con", author_phone: "agent:bay-muc" }))).toBe(true);
    expect(laBaiAgent(bai({ kind: "ba-con", author_phone: "0901234567" }))).toBe(false);
    expect(laBaiAgent(bai({ kind: "chinh-thuc", author_phone: "sdvico:chinh-thuc" }))).toBe(false);
    expect(laBaiAgent(bai())).toBe(false);
  });
});

describe("xáo mỗi lần làm mới (hạt)", () => {
  // 40 bài cùng giờ, cùng mọi thứ — chỉ khác id ⇒ thứ tự do hạt quyết định
  const ps = Array.from({ length: 40 }, (_, i) => bai({ kind: "ba-con", author_phone: `x${i}`, topic: "nghe-ca", feed_at: h(2) }));
  const thuTu = (hat?: number) => xepDongTin(ps, { ...khach, hat }, NOW).map((p) => p.id).join(",");
  it("cùng hạt ⇒ cùng thứ tự (phân trang không lặp); khác hạt ⇒ thứ tự khác", () => {
    expect(thuTu(7)).toBe(thuTu(7));
    expect(thuTu(7)).not.toBe(thuTu(8));
    expect(new Set(thuTu(9).split(",")).size).toBe(40);
  });
  it("nhiễu trong [0, 1), biên độ nhỏ hơn trọng số độ mới ⇒ bài mới hẳn vẫn ở trên", () => {
    for (let i = 0; i < 200; i++) {
      const u = nhieu(i, `id-${i}`);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
    }
    expect(NHIEU_XAO).toBeLessThan(1);
    const moiHan = bai({ kind: "ba-con", author_phone: "moi", topic: "nghe-ca", feed_at: h(0) });
    const cu = Array.from({ length: 10 }, (_, i) => bai({ kind: "ba-con", author_phone: `c${i}`, topic: "nghe-ca", feed_at: h(60) }));
    for (const hat of [1, 2, 3, 4, 5]) expect(xepDongTin([...cu, moiHan], { ...khach, hat }, NOW)[0].id).toBe(moiHan.id);
  });
  it("con trỏ mang hạt; docHat nhận số nguyên 0…2^31-1, lạ ⇒ undefined", () => {
    expect(giaiMaPP(maHoaPP({ at: h(0.2), off: 20, hat: 12345 }), NOW)).toEqual({ at: h(0.2), off: 20, hat: 12345 });
    expect(giaiMaPP(maHoaPP({ at: h(0.2), off: 20 }), NOW)).toEqual({ at: h(0.2), off: 20 });
    expect(docHat("42")).toBe(42);
    for (const x of ["-1", "abc", "99999999999", "1.5", null]) expect(docHat(x)).toBeUndefined();
  });
});
