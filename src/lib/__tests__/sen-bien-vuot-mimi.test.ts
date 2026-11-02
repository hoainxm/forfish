import { describe, expect, it } from "vitest";

import { tachCauGoi } from "@/lib/sen-bien/goi-ranh-tay";
import { senBienReply } from "@/lib/sen-bien/hieu-y";
import { cauCuuNan, lenhChay, toaDoDoc } from "@/lib/sen-bien/lenh-chay";
import { catDoan } from "@/lib/sen-bien/nghe-may";
import { hieuCauNoi, NOI_TIEP_MS, type NhoTruoc } from "@/lib/sen-bien/noi-tiep";

const LOAI = ["cá ngừ vằn", "cá ngừ", "cá thu", "cá nục", "mực"];

describe("lenhChay — nhóm 'thông tin chuyến đi' + khẩn cấp của Mimi", () => {
  it("kêu cứu: nhận mọi lúc, kể cả khi không dẫn đường", () => {
    for (const c of ["cứu với", "tàu bị chìm rồi", "có người rơi xuống biển", "tàu mắc cạn", "nước vào tàu", "cứu nạn", "tàu bị cháy", "mayday mayday"])
      expect(lenhChay(c, false), c).toBe("cuu_nan");
  });
  it("kêu cứu: câu hỏi về xác tàu / luật / chuyện cũ không phải kêu cứu", () => {
    for (const c of ["tàu chìm gần nhất ở đâu", "xác tàu chìm", "luật cứu nạn thế nào", "tàu chạy mấy hải lý", "tàu vô cảng chưa"])
      expect(lenhChay(c, true), c).not.toBe("cuu_nan");
  });
  it("tốc độ tàu — không lẫn tốc độ gió / dòng chảy", () => {
    expect(lenhChay("tốc độ bao nhiêu", false)).toBe("toc_do");
    expect(lenhChay("tàu chạy mấy hải lý", true)).toBe("toc_do");
    expect(lenhChay("toc do bao nhieu", true)).toBe("toc_do");
    expect(lenhChay("tốc độ gió bao nhiêu", true)).toBeNull();
    expect(lenhChay("dòng chảy mấy hải lý giờ", true)).toBeNull();
  });
  it("hướng lái + tìm đường khác chỉ khi đang dẫn", () => {
    expect(lenhChay("đi hướng nào", true)).toBe("huong");
    expect(lenhChay("có đúng đường không", true)).toBe("huong");
    expect(lenhChay("lai sao day", true)).toBe("huong");
    expect(lenhChay("đi hướng nào", false)).toBeNull();
    expect(lenhChay("gió hướng nào", true)).toBeNull();
    expect(lenhChay("hướng nào nhiều cá", true)).toBeNull();
    expect(lenhChay("tìm đường khác", true)).toBe("ve_lai");
    expect(lenhChay("tính lại đường", true)).toBe("ve_lai");
    expect(lenhChay("tìm đường khác", false)).toBeNull();
  });
});

describe("cauCuuNan — toạ độ trước, rồi 112 + VHF 16", () => {
  it("có định vị", () => {
    const c = cauCuuNan({ lat: 14.5754, lon: 109.1 }, 30_000);
    expect(c.startsWith("Toạ độ tàu: 14 độ 34,5 phút Bắc, 109 độ 6 phút Đông.")).toBe(true);
    expect(c).toContain("một một hai");
    expect(c).toContain("kênh mười sáu");
    expect(c).not.toContain("cũ");
  });
  it("định vị cũ thì nói rõ cũ bao lâu; không có thì nói thật", () => {
    expect(cauCuuNan({ lat: 10, lon: 107 }, 12 * 60_000)).toContain("cũ 12 phút");
    expect(cauCuuNan(null, null).startsWith("Máy chưa có định vị")).toBe(true);
  });
  it("toaDoDoc làm tròn phút một số lẻ, không ra 60 phút", () => {
    expect(toaDoDoc(9.99999, "lat")).toBe("10 độ 0 phút Bắc");
    expect(toaDoDoc(-8.5, "lat")).toBe("8 độ 30 phút Nam");
  });
});

describe("hieuCauNoi — câu nối nhiều lượt (Mimi không có)", () => {
  const now = 1_000_000;
  const song: NhoTruoc = { kind: "map", lenh: { viec: "mo_lop", lop: "song", luc: { ngay: 0, gio: 15 } }, luc: now - 30_000 };
  it("'còn ngày mai thì sao' ⇒ cùng lớp, đổi ngày", () => {
    expect(hieuCauNoi("còn ngày mai thì sao", song, now)).toEqual({ kind: "map", lenh: { viec: "mo_lop", lop: "song", luc: { ngay: 1 } } });
  });
  it("'gió thì sao' ⇒ đổi lớp, giữ giờ", () => {
    expect(hieuCauNoi("gió thì sao", song, now)).toEqual({ kind: "map", lenh: { viec: "mo_lop", lop: "gio", luc: { ngay: 0, gio: 15 } } });
  });
  it("câu ngắn chỉ tham số: 'chiều mai?'", () => {
    expect(hieuCauNoi("chiều mai", song, now)).toEqual({ kind: "map", lenh: { viec: "mo_lop", lop: "song", luc: { ngay: 1, gio: 15 } } });
  });
  it("hỏi cá rồi 'còn cá thu?' ⇒ đổi loài", () => {
    const ca: NhoTruoc = { kind: "hoi", q: { loai: "ca", loaiCa: { ds: ["x"], ten: "cá ngừ" }, muonDi: false }, luc: now };
    const r = hieuCauNoi("còn cá thu", ca, now, LOAI);
    expect(r?.kind).toBe("hoi");
    expect(r?.kind === "hoi" && r.q.loaiCa?.ten).toBe("cá thu");
  });
  it("phía trước theo hướng: 'còn phía Bắc?'", () => {
    const pt: NhoTruoc = { kind: "hoi", q: { loai: "phia_truoc", huong: 90, muonDi: false }, luc: now };
    expect(hieuCauNoi("còn phía bắc thì sao", pt, now)).toEqual({ kind: "hoi", q: { loai: "phia_truoc", huong: 0, muonDi: false } });
  });
  it("hết hạn nhớ / câu đi đâu đó / câu không có tham số ⇒ không nối", () => {
    expect(hieuCauNoi("còn ngày mai thì sao", { ...song, luc: now - NOI_TIEP_MS - 1 }, now)).toBeNull();
    expect(hieuCauNoi("rồi dẫn về Sa Huỳnh chiều mai", song, now)).toBeNull();
    expect(hieuCauNoi("còn bao xa", song, now)).toBeNull();
    expect(hieuCauNoi("sóng ở Sa Huỳnh ra sao hôm qua kia", null, now)).toBeNull();
  });
  it("đi qua senBienReply: ngữ cảnh trước được dùng", () => {
    const r = senBienReply("thế còn ngày mốt", null, [], null, { awaitingGo: false, running: false, truoc: song, now });
    expect(r).toEqual({ kind: "map", lenh: { viec: "mo_lop", lop: "song", luc: { ngay: 2 } } });
  });
});

describe("tachCauGoi — 'Sen Biển ơi' (gọi rảnh tay)", () => {
  it("chỉ gọi tên ⇒ chuỗi rỗng", () => {
    expect(tachCauGoi("sen biển ơi")).toBe("");
    expect(tachCauGoi("Sen Biển")).toBe("");
    expect(tachCauGoi("ê sen biển ơi")).toBe("");
  });
  it("gọi kèm việc ⇒ trả phần việc còn dấu", () => {
    expect(tachCauGoi("sen biển ơi còn bao xa")).toBe("còn bao xa");
    expect(tachCauGoi("Sen Biển, dẫn về cảng Sa Huỳnh")).toBe("dẫn về cảng Sa Huỳnh");
    expect(tachCauGoi("xen biển ơi tốc độ bao nhiêu")).toBe("tốc độ bao nhiêu");
  });
  it("chữ 'biển' giữa câu chuyện không phải gọi", () => {
    expect(tachCauGoi("hôm nay biển êm")).toBeNull();
    expect(tachCauGoi("ra biển sen đi")).toBeNull();
    expect(tachCauGoi("sen đi chợ")).toBeNull();
    expect(tachCauGoi("")).toBeNull();
  });
});

describe("senBienReply — lệnh mới đi đúng ngả", () => {
  const ctx = { awaitingGo: false, running: true };
  it("kêu cứu thắng mọi thứ, kể cả lúc chờ 'đi'", () => {
    expect(senBienReply("cứu với tàu bị chìm", null, [], null, { awaitingGo: true, running: false })).toEqual({ kind: "chay", viec: "cuu_nan" });
  });
  it("mấy giờ tới ⇒ còn bao xa (câu đọc có giờ tới nơi)", () => {
    expect(senBienReply("mấy giờ tới", null, [], null, ctx).kind).toBe("howfar");
    expect(senBienReply("may gio den", null, [], null, ctx).kind).toBe("howfar");
    // bộ nghe trong máy lẫn s/x — bắt được khi thử Rảnh tay bằng giọng thật
    expect(senBienReply("còn bao sa", null, [], null, ctx).kind).toBe("howfar");
  });
  it("tốc độ / hướng / đường khác", () => {
    expect(senBienReply("tốc độ bao nhiêu", null, [], null, ctx)).toEqual({ kind: "chay", viec: "toc_do" });
    expect(senBienReply("đi hướng nào", null, [], null, ctx)).toEqual({ kind: "chay", viec: "huong" });
    expect(senBienReply("tìm đường khác", null, [], null, ctx)).toEqual({ kind: "chay", viec: "ve_lai" });
  });
});

describe("catDoan — lấy thêm 350 ms trước lúc có tiếng (chữ 'Sen' khỏi bị cắt)", () => {
  it("tính chỉ số mẫu, không âm", () => {
    expect(catDoan(1000, 16000)).toBe(Math.floor(0.65 * 16000));
    expect(catDoan(100, 16000)).toBe(0);
  });
});
