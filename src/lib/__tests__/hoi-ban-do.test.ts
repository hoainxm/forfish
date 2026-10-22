import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { SPECIES_META } from "@/lib/fish-predict";
import { senBienReply } from "@/lib/sen-bien/hieu-y";
import { hoiGi, traLoi, type KhoBanDo, type ViTri } from "@/lib/sen-bien/hoi-ban-do";
import { loadNgram } from "@/lib/sen-bien/ngram";

const LOAI = Object.keys(SPECIES_META);

describe("hoiGi — câu hỏi bản đồ kiểu Google Maps", () => {
  it.each([
    ["gần đảo nào nhất", "dao_gan"],
    ["tàu đang ở đâu vậy", "o_dau"],
    ["rạn gần nhất ở đâu", "ran_gan"],
    ["chỗ này sâu bao nhiêu", "do_sau"],
    ["phía trước có gì không", "phia_truoc"],
    ["đi hướng đông bắc có gì nguy hiểm", "phia_truoc"],
    ["đèn biển gần nhất", "den_bien"],
    ["có xác tàu nào gần đây không", "xac_tau"],
    ["chỗ tránh trú bão gần nhất", "tru_bao"],
    ["chỗ này có cấm đánh bắt không", "vung_cam"],
    ["nước ròng lúc mấy giờ", "con_nuoc"],
    ["triều cường không", "con_nuoc"],
    ["cảng nào gần nhất", "cang_gan"],
    ["chỗ nào nhiều cá ngừ vằn", "ca"],
    ["mực ống ở đâu nhiều", "ca"],
    ["phao gần nhất ở đâu", "phao"],
  ])("%s → %s", (cau, loai) => expect(hoiGi(cau, LOAI)?.loai).toBe(loai));

  it.each([
    "dẫn về cảng Sa Huỳnh",
    "dẫn đường tới Rạn Sừng",
    "giá cá thu bao nhiêu",
    "bán cá ở đâu được giá",
    "gọi cửa hàng Hải Đăng",
    "máy chạy bao lâu rồi chưa thay nhớt",
    "mua 15 lít áo phao",
    "kiểm thử hộp thư",
    "câu cá ngừ dùng mồi gì",
    "đánh bắt vùng cấm bị phạt nhiều tiền không",
  ])("'%s' KHÔNG phải câu hỏi bản đồ", (cau) => expect(hoiGi(cau, LOAI)).toBeNull());

  it("hỏi loài: khớp tên dài nhất, nhóm 'cá ngừ' = mọi loài ngừ", () => {
    expect(hoiGi("chỗ nào nhiều cá ngừ vằn", LOAI)?.loaiCa).toEqual({ ds: ["ngừ vằn"], ten: "cá ngừ vằn" });
    const nhom = hoiGi("cá ngừ ở đâu nhiều", LOAI)?.loaiCa;
    expect(nhom?.ten).toBe("cá ngừ");
    expect(nhom?.ds).toContain("ngừ vây vàng");
    expect(nhom?.ds).not.toContain("cá thu");
  });
  it("'dẫn tới chỗ trú bão gần nhất' ⇒ đi luôn; 'đi' cuối câu là tiếng đệm", () => {
    expect(hoiGi("dẫn tới chỗ tránh trú bão gần nhất")).toMatchObject({ loai: "tru_bao", muonDi: true });
    expect(hoiGi("cho hỏi nước lên hay xuống đi")).toMatchObject({ loai: "con_nuoc", muonDi: false });
  });
});

// kho nhỏ quanh Lý Sơn
const V: ViTri = { lat: 15.3, lon: 108.9, nguon: "tau", huongChay: 90 };
const KHO: KhoBanDo = {
  dao: [
    { lat: 15.38, lon: 109.12, ten: "đảo Lý Sơn" },
    { lat: 16.0, lon: 108.3, ten: "Cù Lao Chàm" },
  ],
  ran: [{ lat: 15.3, lon: 109.0, ten: "Rạn Thử" }],
  xacTau: [{ lat: 15.3, lon: 108.95, loai: "xac-tau", ten: "MINH KHÁNH 01", prov: {} as never }],
  truBao: [{ lat: 15.2, lon: 108.8, ten: "Sa Kỳ", tinh: "QUẢNG NGÃI", cap: "vung", sucChua: null, coTauM: null, ghiChu: null, tin: "cao", nguonToaDo: "" }],
  vung: [],
  vungCam: [{ ten: "Khu cấm vào", loai: "cam-vao", ring: [[108.8, 15.2], [109.0, 15.2], [109.0, 15.4], [108.8, 15.4], [108.8, 15.2]] }],
  cang: [{ name: "Sa Kỳ", lat: 15.2, lon: 108.83, kind: "cang" }],
};
const tl = (cau: string, kho: KhoBanDo = KHO, v: ViTri = V) => traLoi(hoiGi(cau, LOAI)!, kho, v, "nm", Date.UTC(2026, 9, 16, 3));

describe("traLoi — đọc từ kho lớp đã có trong máy", () => {
  it("đảo gần nhất: tên + hướng + quãng, nói rõ 'từ tàu', ghim chỗ", () => {
    const r = tl("gần đảo nào nhất");
    expect(r.say).toMatch(/^Gần tàu nhất là đảo Lý Sơn, hướng Đông, 14 hải lý\.$/);
    expect(r.cho?.ten).toBe("đảo Lý Sơn");
    expect(r.di).toBeUndefined();
  });
  it("chỗ đang xem (không GPS) thì nói 'chỗ đang xem'", () =>
    expect(tl("gần đảo nào nhất", KHO, { ...V, nguon: "ban-do" }).say).toMatch(/^Gần chỗ đang xem nhất/));
  it("phía trước theo hướng chạy: liệt kê gần trước, tối đa 3", () => {
    const r = tl("phía trước có gì");
    expect(r.say).toMatch(/^Phía trước trong .*: xác tàu chìm MINH KHÁNH 01, 2,9 hải lý; Rạn Thử, 5,8 hải lý\.$/);
  });
  it("chưa chạy, không nói hướng ⇒ hỏi lại hướng, không đoán", () =>
    expect(tl("phía trước có gì", KHO, { ...V, huongChay: null }).say).toMatch(/nói thêm hướng/));
  it("kho thiếu hải đồ ⇒ KHÔNG nói 'không có gì'", () => {
    const r = tl("đi hướng tây có gì", { dao: [] });
    expect(r.say).toMatch(/chưa có đủ hải đồ/);
    expect(r.say).not.toMatch(/không ghi gì/);
  });
  it("lớp chưa tải ⇒ nói thật máy chưa có", () => expect(tl("đèn biển gần nhất", {}).say).toMatch(/^Máy chưa có lớp đèn biển/));
  it("trong vùng cấm trên hải đồ", () => expect(tl("chỗ này có cấm đánh bắt không").say).toMatch(/đang trong Khu cấm vào/));
  it("'dẫn tới chỗ tránh trú bão gần nhất' ⇒ trả kèm điểm để đi luôn", () => {
    const r = tl("dẫn tới chỗ tránh trú bão gần nhất");
    expect(r.di).toMatchObject({ lat: 15.2, lon: 108.8 });
  });
  it("cảng gần nhất", () => expect(tl("cảng nào gần nhất").say).toMatch(/^Cảng gần nhất là Sa Kỳ/));
  it("cá: chưa premium ⇒ nói rõ, không lộ dữ liệu", () => {
    expect(tl("chỗ nào nhiều cá ngừ vằn", { ca: "premium" }).say).toMatch(/premium/);
    expect(tl("chỗ nào nhiều cá ngừ vằn", { ca: "dang-nhap" }).say).toMatch(/đăng nhập/);
  });
  it("cá: chọn ô điểm cao gần tàu, nói 'dự báo, không chắc chắn'", () => {
    const cell = (lat: number, lon: number, v: number) => ({ lat, lon, s: v, top: ["ngừ vằn"], sp: { "ngừ vằn": v }, t: 28, c: null });
    const r = tl("chỗ nào nhiều cá ngừ vằn", { ca: { cells: [cell(15.3, 109.2, 80), cell(10, 112, 99), cell(15.3, 108.95, 40)] } });
    expect(r.cho).toMatchObject({ lat: 15.3, lon: 109.2 });
    expect(r.say).toMatch(/cá ngừ vằn cao gần nhất: hướng Đông, .*dự báo, không chắc chắn/);
  });
});

describe("senBienReply nối hỏi đáp", () => {
  it("câu hỏi bản đồ ⇒ kind hoi (trước dò tên chỗ)", () =>
    expect(senBienReply("gần đảo nào nhất", null, [], null).kind).toBe("hoi"));
  it("'dẫn tới đó' sau câu trả lời ⇒ đi tới chỗ vừa nói", () => {
    const cho = { name: "Rạn Thử", lat: 15.3, lon: 109, kind: "diem" as const };
    const r = senBienReply("dẫn tới đó", null, [], null, { awaitingGo: false, running: false, choVuaNoi: cho });
    expect(r).toMatchObject({ kind: "go", dest: cho });
  });
});

describe("tên loài giữ dấu", () => {
  it("'cá ngừ ở đâu' KHÔNG phải loài 'ngừ ồ'", () => expect(hoiGi("cá ngừ ở đâu nhiều", LOAI)?.loaiCa?.ten).toBe("cá ngừ"));
  it("'cá ngừ ồ ở đâu' vẫn là ngừ ồ", () => expect(hoiGi("cá ngừ ồ ở đâu nhiều", LOAI)?.loaiCa?.ds).toEqual(["ngừ ồ"]));
  it("gõ không dấu vẫn nhận", () => expect(hoiGi("cho nao nhieu ca ngu van", LOAI)?.loaiCa?.ds).toEqual(["ngừ vằn"]));
});

describe("n-gram v2 chọn loại câu hỏi, luật làm lưới (2026-10-16)", () => {
  const buf = readFileSync("public/data/sen-bien-ngram.v6.bin");
  const model = loadNgram(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer)!;
  const hoi = (cau: string) => {
    const r = senBienReply(cau, model, [], null, { awaitingGo: false, running: false, loaiCa: LOAI });
    return r.kind === "hoi" ? r.q : r.kind;
  };
  // câu giọng miền trong bộ kín (Opus viết) mà LUẬT để lọt — mô hình bắt được
  it.each([
    ["bác ơi gần đây có đảo hông", "dao_gan"],
    ["tui đang ở mô rứa", "o_dau"],
    ["chỗ ni sâu nhiêu mét", "do_sau"],
    ["gan day co chiec nao dam khong bac", "xac_tau"],
    ["CHỖ NÀY THẢ LƯỚI ĐƯỢC HÔNG HAY BỊ CẤM", "vung_cam"],
  ])("%s → %s", (cau, loai) => {
    expect(hoiGi(cau, LOAI)).toBeNull();
    expect(hoi(cau)).toMatchObject({ loai });
  });
  it("hỏi BÁN cá không thành câu hỏi bản đồ (luật từng bắt 'chỗ nào nhiều cá')", () =>
    expect(hoi("bán cá ngừ ở đâu được giá")).not.toMatchObject({ loai: "ca" }));
  it("tham số vẫn do luật trích: loài + hướng + đi luôn", () => {
    expect(hoi("dẫn tới chỗ nhiều cá ngừ vằn")).toMatchObject({ loai: "ca", muonDi: true, loaiCa: { ds: ["ngừ vằn"] } });
    expect(hoi("chạy hướng đông bắc có đụng gì không")).toMatchObject({ loai: "phia_truoc", huong: 45 });
  });
  it("'còn mấy hải lý nữa tới' ⇒ còn bao xa", () => expect(hoi("còn mấy hải lý nữa tới")).toBe("howfar"));
  // anh Long 2026-10-22: "hỏi con gà có mấy chân mà ko chạy được" — v4 đoán con_bao_xa 0,31 vì "có mấy"
  it.each(["con gà có mấy chân", "con gà mấy chân", "con mèo mấy chân"])("'%s' KHÔNG thành lệnh còn bao xa (không chữ chỉ quãng đường)", (cau) =>
    expect(senBienReply(cau, model, [], null).kind).not.toBe("howfar"));
  it.each(["tới cảng chưa", "còn bao xa nữa", "còn mấy hải lý", "còn bao lâu nữa tới"])("'%s' vẫn là còn bao xa", (cau) =>
    expect(senBienReply(cau, model, [], null).kind).toBe("howfar"));
  it("câu có TÊN chỗ + động từ đi ⇒ dẫn đi, không thành câu hỏi", () => {
    const d = { name: "Hòn Mù", lat: 14.9, lon: 109.3, kind: "diem" as const };
    expect(senBienReply("chạy ra Hòn Mù", model, [d], null).kind).toBe("go");
  });
  it("không có mô hình (chưa tải) ⇒ luật vẫn trả lời", () =>
    expect(senBienReply("gần đảo nào nhất", null, [], null).kind).toBe("hoi"));
});
