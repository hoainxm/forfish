import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { SPECIES_META } from "@/lib/fish-predict";
import { senBienReply } from "@/lib/sen-bien/hieu-y";
import { timLoaiCa } from "@/lib/sen-bien/hoi-ban-do";
import { cauDocSo, chiSoMoc, lenhLuat, lenhTuY, noiThoiDiem, tachLop, tachThoiDiem } from "@/lib/sen-bien/lenh-ban-do";
import { loadNgram } from "@/lib/sen-bien/ngram";

const LOAI = Object.keys(SPECIES_META);
const tim = (t: string) => timLoaiCa(t, LOAI);

describe("tachLop — giữ dấu để khỏi lẫn gió/giờ, mưa/mua", () => {
  it.each([
    ["xem bản đồ sóng", "song"],
    ["mở gió chiều mai", "gio"],
    ["coi dòng chảy mấy ngày tới", "dong_chay"],
    ["bật lớp mưa", "mua"],
    ["XEM NHIỆT ĐỘ NƯỚC", "nhiet_nuoc"],
    ["chuyển qua vùng nhiều mồi", "phu_du"],
    ["mở bản đồ cá", "ca"],
    ["xem ban do song", "song"],
    ["mo gio chieu mai", "gio"],
  ])("%s → %s", (c, l) => expect(tachLop(c)).toBe(l));
  it("'3 giờ chiều mai' KHÔNG phải lớp gió", () => {
    expect(tachLop("qua 3 giờ chiều mai")).toBeUndefined();
    expect(tachLop("qua 3 gio chieu mai")).toBeUndefined();
  });
  it("'mua nhớt' không dấu không phải lớp mưa", () => expect(tachLop("mua nhot")).toBeUndefined());
});

describe("tachThoiDiem", () => {
  it.each([
    ["chiều mai", { ngay: 1, gio: 15 }],
    ["3 giờ chiều mốt", { ngay: 2, gio: 15 }],
    ["BA GIỜ CHIỀU NGÀY MỐT", { ngay: 2, gio: 15 }],
    ["năm ngày nữa", { ngay: 5 }],
    ["10 giờ tối nay", { ngay: 0, gio: 22 }],
    ["sáng nay", { ngay: 0, gio: 6 }],
    ["ngày kia", { ngay: 2 }],
    ["chieu mot", { ngay: 2, gio: 15 }],
  ])("%s", (c, td) => expect(tachThoiDiem(c)).toEqual(td));
  it("'chỗ này' không phải 'hôm nay'", () => expect(tachThoiDiem("sóng chỗ này cao không")).toBeUndefined());
});

describe("lenhTuY — mô hình chọn việc, luật trích tham số", () => {
  it("mở lớp + thời điểm", () =>
    expect(lenhTuY("mo_lop", "xem sóng chiều mai", tim)).toEqual({ viec: "mo_lop", lop: "song", luc: { ngay: 1, gio: 15 } }));
  it("bản đồ cá + loài", () =>
    expect(lenhTuY("mo_lop", "xem bản đồ cá ngừ vằn", tim)).toMatchObject({ viec: "mo_lop", lop: "ca", loaiCa: { ds: ["ngừ vằn"] } }));
  it("nói loài không nói lớp ⇒ lớp cá", () => expect(lenhTuY("mo_lop", "cho xem mực ống", tim)).toMatchObject({ lop: "ca" }));
  it("tầng dòng chảy", () => expect(lenhTuY("mo_lop", "xem dòng chảy tầng 150 mét", tim)).toMatchObject({ lop: "dong_chay", tang: 150 }));
  it("mở lớp mà không rõ lớp ⇒ null (hỏi lại)", () => expect(lenhTuY("mo_lop", "mở cái đó lên", tim)).toBeNull());
  it("đọc giá trị", () =>
    expect(lenhTuY("doc_gia_tri", "sóng chỗ tàu ngày mốt bao nhiêu", tim)).toEqual({ viec: "doc_gia_tri", lop: "song", luc: { ngay: 2 } }));
  it("ý khác ⇒ null", () => expect(lenhTuY("gia_ca", "giá cá thu", tim)).toBeNull());
  it("luật lưới khi chưa có mô hình", () => {
    expect(lenhLuat("phóng to", tim)).toEqual({ viec: "phong_to" });
    expect(lenhLuat("xem gió chiều mai", tim)).toMatchObject({ viec: "mo_lop", lop: "gio" });
    expect(lenhLuat("dẫn về cảng Sa Huỳnh", tim)).toBeNull();
  });
});

describe("chiSoMoc — mốc trên thanh thời gian", () => {
  const times = ["2026-10-17T00:00", "2026-10-17T03:00", "2026-10-17T12:00", "2026-10-18T15:00", "2026-10-19T12:00"];
  it("chiều mai → mốc 15h ngày mai", () => expect(chiSoMoc(times, { ngay: 1, gio: 15 }, "2026-10-17", 9)).toBe(3));
  it("hôm nay không giờ → mốc gần giờ hiện tại", () => expect(chiSoMoc(times, { ngay: 0 }, "2026-10-17", 2)).toBe(1));
  it("vượt khung (miễn phí 3 ngày) ⇒ 'ngoai', không nhảy bừa", () => expect(chiSoMoc(times, { ngay: 5 }, "2026-10-17", 9)).toBe("ngoai"));
  it("lưới rỗng ⇒ null", () => expect(chiSoMoc([], { ngay: 1 }, "2026-10-17", 9)).toBeNull());
});

describe("đọc lại", () => {
  it("noiThoiDiem", () => {
    expect(noiThoiDiem({ ngay: 1, gio: 15 })).toBe("3 giờ chiều mai");
    expect(noiThoiDiem(undefined)).toBe("bây giờ");
    expect(noiThoiDiem({ ngay: 5 })).toBe("5 ngày nữa");
  });
  it("cauDocSo: thiếu số ⇒ null, KHÔNG nói 0", () => {
    expect(cauDocSo("song", {})).toBeNull();
    expect(cauDocSo("song", { waveM: 1.8 })).toBe("sóng cao 1,8 mét");
    expect(cauDocSo("gio", { windKmh: 30, windDirDeg: 45 })).toMatch(/^gió cấp 5, 30 km\/giờ, hướng/);
    expect(cauDocSo("dong_chay", { curKmh: 1.852, curDirDeg: 180 })).toMatch(/^dòng chảy 1 hải lý\/giờ, chảy về hướng/);
  });
});

describe("ca từng sai trên bộ kín (17/10)", () => {
  it("'dòng tầng 150 mét' là dòng chảy", () => expect(tachLop("dòng tầng 150 mét chảy mạnh hông")).toBe("dong_chay"));
  it("'hiện mưa lên hải đồ' là mưa", () => expect(tachLop("hiện mưa lên hải đồ coi tối nay")).toBe("mua"));
  it("câu nửa dấu: 'mo lop gio 4 gio chieu mai giùm'", () => expect(tachLop("mo lop gio 4 gio chieu mai giùm tui")).toBe("gio"));
  it("'nhay toi sang mai 7 gio' — 'tới' không phải buổi tối", () => expect(tachThoiDiem("nhay toi sang mai 7 gio")).toEqual({ ngay: 1, gio: 7 }));
  it("tầng không có chữ 'tầng'", () => expect(lenhTuY("mo_lop", "mở dòng chảy 50 mét ngày mốt", tim)).toMatchObject({ tang: 50 }));
});

// bin v7 (cơ cấu mới 2026-10-25) giao sau — chưa có thì khối cần trọng số skip có lý do
const BIN = "public/data/sen-bien-ngram.v7.bin";
const coBin = existsSync(BIN);
describe.skipIf(!coBin)("senBienReply với n-gram v3 ⇒ lệnh bản đồ", () => {
  // thân describe vẫn được gom khi skip ⇒ không đọc file lúc chưa có
  const buf = coBin ? readFileSync(BIN) : Buffer.alloc(0);
  const model = coBin ? loadNgram(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer)! : null;
  const r = (c: string) => senBienReply(c, model, [], null, { awaitingGo: false, running: false, loaiCa: LOAI });
  it.each([
    ["xem bản đồ sóng chiều mai", { kind: "map", lenh: { viec: "mo_lop", lop: "song", luc: { ngay: 1, gio: 15 } } }],
    ["MỞ BẢN ĐỒ CÁ NGỪ VẰN", { kind: "map", lenh: { viec: "mo_lop", lop: "ca" } }],
    ["tắt lớp gió đi", { kind: "map", lenh: { viec: "tat_lop" } }],
    ["phóng to", { kind: "map", lenh: { viec: "phong_to" } }],
    ["sóng chỗ tàu ngày mốt cao bao nhiêu", { kind: "map", lenh: { viec: "doc_gia_tri", lop: "song", luc: { ngay: 2 } } }],
  ])("%s", (c, k) => expect(r(c)).toMatchObject(k));
  it("vẫn dẫn đường khi nói tên chỗ", () =>
    expect(senBienReply("dẫn về cảng Sa Huỳnh", model, [{ name: "Sa Huỳnh", lat: 14.67, lon: 109.07, kind: "cang" }], null).kind).toBe("go"));
});
