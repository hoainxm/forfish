import { describe, expect, it } from "vitest";
import {
  bamToken,
  banGoiCanGhi,
  docKhoaDoiTac,
  docLocTau,
  khopDoiTac,
  layBearer,
  locTau,
  MUC_KHOA_DOI_TAC,
} from "@/lib/doi-tac";
import { khuVucCua } from "@/lib/doi-tac-khu-vuc";
import { validateConfigValue } from "@/lib/app-config-keys";
import type { TauAis, TauAisBan } from "@/lib/tau-ais";

const TOKEN = "ffp_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";
const muc = (ten: string, token: string, khu = "12345", goi = "60") => `${ten}:${bamToken(token)}:${khu}:${goi}`;

describe("khoá đối tác", () => {
  it("đọc mục hợp lệ, bỏ mục hỏng, khu sắp tăng không trùng", () => {
    const ds = docKhoaDoiTac(`${muc("doi-tac-1", TOKEN, "5311", "30")}, hong, x:${"a".repeat(64)}:6:60`);
    expect(ds).toEqual([{ ten: "doi-tac-1", bam: bamToken(TOKEN), khu: [1, 3, 5], goi: 30 }]);
    expect(docKhoaDoiTac(null)).toEqual([]);
  });

  it("Bearer: lấy token, thiếu/ngắn ⇒ null", () => {
    expect(layBearer(`Bearer ${TOKEN}`)).toBe(TOKEN);
    expect(layBearer(`bearer  ${TOKEN} `)).toBe(TOKEN);
    expect(layBearer("Bearer ngan")).toBeNull();
    expect(layBearer(TOKEN)).toBeNull();
    expect(layBearer(null)).toBeNull();
  });

  it("khớp đúng đối tác, token lạ ⇒ null", () => {
    const ds = docKhoaDoiTac([muc("aa", "ffp_token_cua_a_000000000000"), muc("bb", TOKEN, "2", "30")].join(","));
    expect(khopDoiTac(TOKEN, ds)).toMatchObject({ ten: "bb", khu: [2], goi: 30 });
    expect(khopDoiTac("ffp_khong_co_trong_danh_sach", ds)).toBeNull();
    expect(khopDoiTac(null, ds)).toBeNull();
  });

  it("ô app_config kiểm cùng khuôn với lib", () => {
    const tot = muc("doi-tac-1", TOKEN);
    expect(MUC_KHOA_DOI_TAC.test(tot)).toBe(true);
    expect(validateConfigValue("doi_tac_ais", `${tot},${muc("bb", "x".repeat(20), "4", "30")}`)).toBe(true);
    expect(validateConfigValue("doi_tac_ais", `doi-tac-1:${bamToken(TOKEN)}`)).toBe(false); // thiếu khu/gói
    expect(validateConfigValue("doi_tac_ais", `${tot.slice(0, -2)}15`)).toBe(false); // gói 15 không bán
  });
});

describe("5 khu vực theo báo giá", () => {
  it("điểm tiêu biểu rơi đúng khu", () => {
    expect(khuVucCua(20.0, 107.5)).toBe(1); // giữa vịnh Bắc Bộ
    expect(khuVucCua(15.0, 109.5)).toBe(2); // ngoài khơi Quảng Ngãi
    expect(khuVucCua(9.5, 108.0)).toBe(3); // ngoài khơi Vũng Tàu – Côn Sơn
    expect(khuVucCua(9.0, 104.0)).toBe(4); // vịnh Thái Lan phía VN
    expect(khuVucCua(16.5, 112.0)).toBe(5); // Hoàng Sa
    expect(khuVucCua(9.5, 114.0)).toBe(5); // Trường Sa
  });

  it("ngoài vùng biển VN ⇒ không thuộc khu nào", () => {
    expect(khuVucCua(14.5, 120.5)).toBeNull(); // vịnh Manila
    expect(khuVucCua(22.3, 114.2)).toBeNull(); // Hồng Kông
    expect(khuVucCua(5.5, 103.5)).toBeNull(); // bờ đông Malaysia
  });
});

const tau = (o: Partial<TauAis>): TauAis => ({
  id: "1", ten: "A", loai: 2, co: "VN", lat: 20, lon: 107.5, kn: 5, huong: 90, mui: 90, phut: 3, dai: 20, dich: null, ...o,
});
const BAN: TauAisBan = {
  v: 1,
  luc: "2026-11-02T03:00:00.000Z",
  soTau: 4,
  tau: [
    tau({ id: "1", mmsi: 574000001 }),
    tau({ id: "2", lat: 15, lon: 109.5, loai: 7 }),
    tau({ id: "3", lat: 16.5, lon: 112 }),
    tau({ id: "4", lat: 14.5, lon: 120.5 }),
  ],
};

describe("lọc tàu cho đối tác", () => {
  it("chỉ trả khu đã mua, gắn zone + last_seen", () => {
    const l = docLocTau(new URLSearchParams(), [1, 5]);
    if ("loi" in l) throw new Error(l.loi);
    const kq = locTau(BAN, l.loc);
    expect(kq.map((t) => [t.id, t.zone])).toEqual([["1", 1], ["3", 5]]);
    expect(kq[0]).toMatchObject({ mmsi: 574000001, type_name: "Tàu cá", track_available: true, last_seen: "2026-11-02T02:57:00.000Z" });
  });

  it("zone ngoài license ⇒ zone_not_licensed; tham số hỏng ⇒ mã lỗi", () => {
    expect(docLocTau(new URLSearchParams("zone=2"), [1])).toEqual({ loi: "zone_not_licensed" });
    expect(docLocTau(new URLSearchParams("zone=9"), [1])).toEqual({ loi: "bad_zone" });
    expect(docLocTau(new URLSearchParams("bbox=1,2,3"), [1])).toEqual({ loi: "bad_bbox" });
    expect(docLocTau(new URLSearchParams("type=10"), [1])).toEqual({ loi: "bad_type" });
    expect(docLocTau(new URLSearchParams("mmsi=123"), [1])).toEqual({ loi: "bad_mmsi" });
  });

  it("lọc type + mmsi + bbox trong khu đã mua", () => {
    const l = docLocTau(new URLSearchParams("type=7"), [1, 2, 3, 4, 5]);
    if ("loi" in l) throw new Error(l.loi);
    expect(locTau(BAN, l.loc).map((t) => t.id)).toEqual(["2"]);
    const m = docLocTau(new URLSearchParams("mmsi=574000001&bbox=107,19,108,21"), [1, 2, 3, 4, 5]);
    if ("loi" in m) throw new Error(m.loi);
    expect(locTau(BAN, m.loc).map((t) => t.id)).toEqual(["1"]);
  });

  it("bản hỏng ⇒ mảng rỗng", () => {
    expect(locTau({ ...BAN, luc: "hong" }, { khu: [1] })).toEqual([]);
  });
});

describe("nhịp bản theo gói", () => {
  const now = Date.parse("2026-11-02T03:00:00Z");
  it("ghi khi chưa có / đủ cũ (chu kỳ − 5 phút), giữ khi còn mới", () => {
    expect(banGoiCanGhi(null, now, 60)).toBe(true);
    expect(banGoiCanGhi("2026-11-02T02:05:00Z", now, 60)).toBe(true); // 55 phút
    expect(banGoiCanGhi("2026-11-02T02:10:00Z", now, 60)).toBe(false); // 50 phút
    expect(banGoiCanGhi("2026-11-02T02:35:00Z", now, 30)).toBe(true); // 25 phút
    expect(banGoiCanGhi("2026-11-02T02:40:00Z", now, 30)).toBe(false);
  });
});
