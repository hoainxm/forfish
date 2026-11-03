import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { senBienReply, type SenDest } from "@/lib/sen-bien/hieu-y";
import { loadNgram } from "@/lib/sen-bien/ngram";
import { parseSpokenCoordPair } from "@/lib/parse-coord";

/*  CÂU THẬT bà con nói với Sen Biển (bảng sen_bien_mau, 19/10–03/11/2026) mà máy đã làm SAI — rà 03/11 theo lời chê
    "chậm và không hiểu khách". Mỗi ca ở đây là một câu đã xảy ra thật; sửa luật thì ca phải xanh. */
const BIN = "public/data/sen-bien-ngram.v8.bin";
const coBin = existsSync(BIN);
const buf = coBin ? readFileSync(BIN) : Buffer.alloc(0);
const model = coBin ? loadNgram(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer) : null;

const DESTS: SenDest[] = [
  { name: "Lý Sơn", lat: 15.38, lon: 109.12, kind: "cang" },
  { name: "Thọ Quang", lat: 16.1, lon: 108.25, kind: "cang" },
  { name: "Cát Lở", lat: 10.4, lon: 107.1, kind: "cang" },
  { name: "Vũng Tàu", lat: 10.34, lon: 107.08, kind: "cang" },
  { name: "Bến nhà", lat: 14.6, lon: 109.0, kind: "nha" },
];

describe.skipIf(!coBin)("câu hỏi có tên cảng không phải lệnh đi", () => {
  it.each([
    "Dự báo thời tiết lý sơn hôm nay",
    "Tôi ở cảng cá Thọ Quang Đà Nẵng thời tiết hôm nay có đi biển được không",
    "ở biển cảng biển cát lở có đi biển được không",
    "tiết Vũng Tàu",
  ])("%s ⇒ không dẫn đi", (cau) => {
    const r = senBienReply(cau, model, DESTS, null);
    expect(r.kind).not.toBe("go");
    expect(r.kind).not.toBe("pick");
  });
  it("câu mở bằng động từ đi vẫn dẫn đi", () => {
    expect(senBienReply("đi Lý Sơn", model, DESTS, null).kind).toBe("go");
    expect(senBienReply("chạy về Thọ Quang", model, DESTS, null).kind).toBe("go");
    expect(senBienReply("dẫn tới Vũng Tàu chỗ sóng êm", model, DESTS, null).kind).toBe("go");
  });
});

// danh mục loài như màn bản đồ đưa vào (SEN_LOAI_CA) — đủ cho các câu dưới
const CTX = { awaitingGo: false, running: false, loaiCa: ["cá ngừ vằn", "cá ngừ", "cá chỉ vàng", "cá đổng", "cá thu", "mực"] };
const tom = (r: ReturnType<typeof senBienReply>): string =>
  r.kind === "say" ? `say:${r.y ?? ""}` : r.kind === "map" ? `map:${r.lenh.viec}${"lop" in r.lenh && r.lenh.lop ? `:${r.lenh.lop}` : ""}` : r.kind === "hoi" ? `hoi:${r.q.loai}` : r.kind;

describe.skipIf(!coBin)("câu thật máy từng không hiểu ⇒ nay đúng việc, trong máy (n-gram v8 + luật)", () => {
  it.each([
    ["Dòng chảy ở vị trí hiện tại", "map:doc_gia_tri:dong_chay"],
    ["Dòng chảy ở vị trí hiện tại là bao nhiêu hải lí", "map:doc_gia_tri:dong_chay"],
    ["Chỗ dây có đá hk", "hoi:ran_gan"],
    ["Chỗ dây có xác tàu hk", "hoi:xac_tau"],
    ["Cá ngừ", "hoi:ca"],
    ["Cá chỉ vàng", "hoi:ca"],
    ["đội của tôi cá đổng chỗ nào nhiều nhứt", "hoi:ca"],
    ["an toàn kỹ thuật chừng nào hết hạn", "say:giay_to"],
    ["cách lưu điểm", "say:hoi_mo"],
    ["tỉnh Gia Lai Khi nào hỗ trợ tiền dầu", "say:chinh_sach"],
    ["Dự báo thời tiết lý sơn hôm nay", "say:thoi_tiet"],
    ["còn bao sa", "howfar"],
    ["17.27.140.  106.47.620", "go"],
  ])("%s ⇒ %s", (cau, viec) => expect(tom(senBienReply(cau, model, DESTS, null, CTX))).toBe(viec));
  it.each(["con gà có mấy chân", "Con gà có mấy 100", "gà có mấy chân tao xin mày"])("đố mẹo '%s' ⇒ không làm việc gì (không đi, không mở lớp, không còn bao xa)", (cau) =>
    expect(tom(senBienReply(cau, model, DESTS, null))).toBe("say:khong_hieu"));
  it("câu nối không có câu trước ⇒ hỏi lại trong máy, không chờ máy nhà", () => {
    const r = senBienReply("Vùng nào zậy", model, DESTS, null);
    expect(r.kind === "say" && r.ask).toBe(true);
  });
});

describe("toạ độ bà con đọc / gõ kiểu máy định vị (độ.phút.phần nghìn phút)", () => {
  it("17.27.140 106.47.620 ⇒ 17°27,140′ Bắc · 106°47,620′ Đông", () => {
    const c = parseSpokenCoordPair("17.27.140.  106.47.620");
    expect(c).not.toBeNull();
    expect(c!.lat).toBeCloseTo(17 + 27.14 / 60, 4);
    expect(c!.lon).toBeCloseTo(106 + 47.62 / 60, 4);
  });
  it("chuỗi số rời không đủ hai toạ độ thì không đoán", () => {
    expect(parseSpokenCoordPair("30 50")).toBeNull();
    expect(parseSpokenCoordPair("17.27.140")).toBeNull();
  });
});
