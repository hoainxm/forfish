import { describe, expect, it } from "vitest";
import {
  CUA_SO_MS,
  TRAN_NHAC_MOI_LUOT,
  TRAN_TIN_MOI_LUOT,
  ghepNhac,
  khoaXoa,
  khoaXoaTen,
  locNhacDaXoa,
  gomTinTau,
  tinHetCanhBao,
  type Nhac,
} from "@/lib/stracking/thong-bao";

const NOW = Date.parse("2026-11-05T10:00:00Z"); // 17:00 giờ VN
const tau = [
  { imei: "1", serial: "S1", ten_tau: "BV-1234-TS", sdt_chu_tau: "0912345678", sdt_thuyen_truong: "0987654321" },
  { imei: "2", serial: "S2", ten_tau: "BV-5678-TS", sdt_chu_tau: "0912345678", sdt_thuyen_truong: null },
  { imei: "3", serial: "S3", ten_tau: null, sdt_chu_tau: "0911111111", sdt_thuyen_truong: "0911111111" },
];
const BD = "Báo động";
const CC = "Cảnh cáo";

describe("cảnh báo thông minh — gộp thông báo tàu", () => {
  it("một tin/SĐT, mỗi tàu một dòng, tàu nguy hiểm hơn trước; CHỈ chủ tàu nhận (thuyền trưởng không — anh Long 06/11)", () => {
    const tin = gomTinTau(
      [
        { imei: "1", loai: "Mất GPS", luc: "2026-11-05T09:02:00Z", muc: BD },
        { imei: "1", loai: "SOS", luc: "2026-11-05T08:47:00Z", muc: BD },
        { imei: "2", loai: "Vượt biên", luc: "2026-11-05T09:30:00Z", muc: BD },
      ],
      tau,
      NOW,
    );
    const chu = tin.find((t) => t.phone === "0912345678")!;
    expect(chu.title).toBe("Cảnh báo 2 tàu của bạn");
    expect(chu.body.split("\n")).toEqual(["BV-1234-TS: SOS 15:47 · Mất GPS 16:02", "BV-5678-TS: Vượt biên 16:30"]);
    expect(chu).toMatchObject({ tag: "stracking-0912345678", day: true, url: "/tau" });
    expect(tin.find((t) => t.phone === "0987654321")).toBeUndefined(); // thuyền trưởng tàu 1
    expect(tin).toHaveLength(1);
  });

  it("Cảnh cáo ⇒ chỉ hộp thư (day=false); mức khác ⇒ bỏ", () => {
    const tin = gomTinTau(
      [
        { imei: "3", loai: "Vùng chú ý đánh bắt", luc: "2026-11-05T09:00:00Z", muc: CC },
        { imei: "2", loai: "x", luc: "2026-11-05T09:00:00Z", muc: "Bình thường" },
      ],
      tau,
      NOW,
    );
    expect(tin).toHaveLength(1);
    expect(tin[0]).toMatchObject({ phone: "0911111111", title: "Cảnh báo tàu S3", day: false });
  });

  it("chống lặp: cùng máy + loại đã báo trong 6 giờ ⇒ không báo; trong lượt chỉ giữ bản mới nhất", () => {
    const truoc = [{ imei: "2", loai: "SOS", luc: "2026-11-05T06:00:00Z", muc: BD }];
    expect(gomTinTau([{ imei: "2", loai: "SOS", luc: "2026-11-05T09:00:00Z", muc: BD }], tau, NOW, truoc)).toHaveLength(0);
    // cách hơn 6 giờ ⇒ báo lại
    const xa = [{ imei: "2", loai: "SOS", luc: "2026-11-05T02:00:00Z", muc: BD }];
    expect(gomTinTau([{ imei: "2", loai: "SOS", luc: "2026-11-05T09:00:00Z", muc: BD }], tau, NOW, xa)).toHaveLength(1);
    const [t] = gomTinTau(
      [
        { imei: "2", loai: "SOS", luc: "2026-11-05T08:00:00Z", muc: BD },
        { imei: "2", loai: "SOS", luc: "2026-11-05T09:00:00Z", muc: BD },
      ],
      tau,
      NOW,
    );
    expect(t.body).toBe("SOS 16:00".replace(/^/, "BV-5678-TS: "));
  });

  it("máy bà con đã XOÁ (0085) ⇒ SĐT đó không nhận cảnh báo / 'đã hết' / nhắc; máy khác vẫn báo", () => {
    const daXoa = new Set([khoaXoa("0912345678", "S1"), khoaXoaTen("0912345678", "BV-1234-TS")]);
    const sos = (imei: string) => ({ imei, loai: "SOS", luc: "2026-11-05T09:00:00Z", muc: BD });
    expect(gomTinTau([sos("1")], tau, NOW, [], daXoa)).toHaveLength(0);
    const conMay2 = gomTinTau([sos("1"), sos("2")], tau, NOW, [], daXoa); // máy 2 (chưa xoá) vẫn báo
    expect(conMay2.map((t) => t.body)).toEqual(["SOS 16:00".replace(/^/, "BV-5678-TS: ")]);
    const het = tinHetCanhBao([{ imei: "1", luc: "2026-11-05T09:30:00Z" }], tau, new Set(), new Set(["0912345678"]), daXoa);
    expect(het).toHaveLength(0);
    const nhac: Nhac[] = [
      { sdt: "0912345678", tau: "BV-1234-TS", loai: "han-sap-het", day: false, dong: "a", serial: "S1" },
      { sdt: "0912345678", tau: "BV-1234-TS", loai: "han-sap-het", day: false, dong: "b" }, // chưa có serial ⇒ khớp tên
      { sdt: "0912345678", tau: "BV-5678-TS", loai: "han-sap-het", day: false, dong: "c", serial: "S2" },
    ];
    expect(locNhacDaXoa(nhac, daXoa).map((n) => n.dong)).toEqual(["c"]);
  });

  it("máy đã huỷ / thu hồi (tên DE…) ⇒ không báo", () => {
    const deTau = [{ imei: "7", serial: "S7", ten_tau: "DEKG-93388-TS", sdt_chu_tau: "0912345678", sdt_thuyen_truong: null }];
    expect(gomTinTau([{ imei: "7", loai: "SOS", luc: "2026-11-05T09:00:00Z", muc: BD }], deTau, NOW)).toHaveLength(0);
  });

  it("cảnh báo cũ quá cửa sổ / imei lạ ⇒ không báo", () => {
    const cu = new Date(NOW - CUA_SO_MS - 60_000).toISOString();
    expect(
      gomTinTau(
        [
          { imei: "1", loai: "SOS", luc: cu, muc: BD },
          { imei: "9", loai: "SOS", luc: "2026-11-05T09:00:00Z", muc: BD },
        ],
        tau,
        NOW,
      ),
    ).toHaveLength(0);
  });

  it("trần tổng mỗi lượt — người có báo động được giữ trước", () => {
    const nhieu = Array.from({ length: TRAN_TIN_MOI_LUOT + 50 }, (_, i) => ({
      imei: `i${i}`, serial: `S${i}`, ten_tau: null, sdt_chu_tau: `09${String(i).padStart(8, "0")}`, sdt_thuyen_truong: null,
    }));
    const cuoi = TRAN_TIN_MOI_LUOT + 49;
    const cb = nhieu.map((t, i) => ({ imei: t.imei, loai: "x", luc: "2026-11-05T09:00:00Z", muc: i === cuoi ? BD : CC }));
    const tin = gomTinTau(cb, nhieu, NOW);
    expect(tin).toHaveLength(TRAN_TIN_MOI_LUOT);
    expect(tin[0]).toMatchObject({ phone: nhieu[cuoi].sdt_chu_tau, day: true });
  });

  it("đã hết cảnh báo: chỉ SĐT đã được báo hôm nay, và chỉ khi MỌI tàu của họ hết cảnh báo; cùng tag để đè", () => {
    const daBao = new Set(["0912345678", "0987654321"]);
    // tàu 1 hết, tàu 2 (cùng chủ) còn mở ⇒ chủ chưa đóng; thuyền trưởng tàu 1 KHÔNG nhận (chỉ chủ tàu)
    let tin = tinHetCanhBao([{ imei: "1", luc: "2026-11-05T09:30:00Z" }], tau, new Set(["2"]), daBao);
    expect(tin).toHaveLength(0);
    // chủ tàu 3 (chủ = thuyền trưởng) hết ⇒ nhận
    tin = tinHetCanhBao([{ imei: "3", luc: "2026-11-05T09:30:00Z" }], tau, new Set(), new Set(["0911111111"]));
    expect(tin[0]).toMatchObject({
      phone: "0911111111",
      title: "Tàu S3 đã hết cảnh báo",
      body: "Giám sát hành trình báo bình thường lúc 16:30.",
      tag: "stracking-0911111111",
      day: true,
    });
    // cả hai tàu hết ⇒ chủ nhận một tin gộp
    tin = tinHetCanhBao([{ imei: "1", luc: "2026-11-05T09:30:00Z" }, { imei: "2", luc: "2026-11-05T09:40:00Z" }], tau, new Set(), daBao);
    expect(tin.find((t) => t.phone === "0912345678")?.title).toBe("2 tàu của bạn đã hết cảnh báo");
    // chưa từng được báo ⇒ không làm phiền
    expect(tinHetCanhBao([{ imei: "3", luc: "2026-11-05T09:30:00Z" }], tau, new Set(), daBao)).toHaveLength(0);
  });

  it("ghép nhắc: SĐT có cảnh báo ⇒ mất kết nối đứng TRƯỚC dòng cảnh báo, việc khác sau; chỉ nhắc ⇒ tin riêng", () => {
    const [cb] = gomTinTau([{ imei: "2", loai: "SOS", luc: "2026-11-05T09:00:00Z", muc: CC }], tau, NOW); // cảnh cáo ⇒ không đẩy
    const r = ghepNhac(
      [cb],
      [
        { sdt: "0912345678", tau: "BV-5678-TS", loai: "han-sap-het", day: false, dong: "BV-5678-TS: còn 5 ngày hết cước." },
        { sdt: "0912345678", tau: "BV-5678-TS", loai: "mkn-qua-6h", day: true, dong: "BV-5678-TS: mất kết nối 7 giờ." },
        { sdt: "0900000002", tau: "KG-1-TS", loai: "tcts-that-bai", day: false, dong: "KG-1-TS: chưa đồng bộ Tổng cục." },
      ],
    );
    const a = r.tin.find((t) => t.phone === "0912345678")!;
    expect(a.title).toBe(cb.title);
    expect(a.body.split("\n")).toEqual(["BV-5678-TS: mất kết nối 7 giờ.", cb.body, "BV-5678-TS: còn 5 ngày hết cước."]);
    expect(a.day).toBe(true); // nhắc đẩy kéo cả tin lên máy
    const b = r.tin.find((t) => t.phone === "0900000002")!;
    expect(b).toMatchObject({ title: "Tàu KG-1-TS chưa đồng bộ Tổng cục", day: false, tag: "stracking-0900000002", url: "/tau" });
    expect(r.soDongNhac).toBe(3);
    expect(r.nhacSdt.sort()).toEqual(["0900000002", "0912345678"]);
    expect(r.nhacSdtBo).toEqual([]);
  });

  it("ghép nhắc: nhiều việc ⇒ 'Nhắc N việc', quá 4 dòng ⇒ 'và N việc khác'; quá trần ⇒ trả SĐT bị bỏ, người có nhắc đẩy giữ trước", () => {
    const ns = ["mkn-sap-6h", "tcts-that-bai", "han-sap-het", "han-qua-han", "tcts-that-bai"].map((loai, i) => ({
      sdt: "0900000001", tau: `T-${i}`, loai: loai as Nhac["loai"], day: false, dong: `dòng ${i}`,
    }));
    const [t] = ghepNhac([], ns).tin;
    expect(t.title).toBe("Nhắc 5 việc giám sát hành trình");
    expect(t.body.split("\n")).toHaveLength(5);
    expect(t.body.endsWith("và 1 việc khác")).toBe(true);
    const nhieu = Array.from({ length: TRAN_NHAC_MOI_LUOT + 2 }, (_, i) => ({
      sdt: `09${String(i).padStart(8, "0")}`, tau: "T", loai: "han-sap-het" as const, day: i === TRAN_NHAC_MOI_LUOT + 1, dong: "x",
    }));
    const r = ghepNhac([], nhieu);
    expect(r.tin).toHaveLength(TRAN_NHAC_MOI_LUOT);
    expect(r.nhacSdt[0]).toBe(nhieu[TRAN_NHAC_MOI_LUOT + 1].sdt);
    expect(r.nhacSdtBo).toHaveLength(2);
  });

  it("quá 3 tàu ⇒ 'và N tàu khác'", () => {
    const nhieu = ["a", "b", "c", "d", "e"].map((x) => ({ imei: x, serial: x, ten_tau: `T-${x}`, sdt_chu_tau: "0900000001", sdt_thuyen_truong: null }));
    const [t] = gomTinTau(nhieu.map((m) => ({ imei: m.imei, loai: "SOS", luc: "2026-11-05T09:00:00Z", muc: BD })), nhieu, NOW);
    expect(t.body.split("\n")).toHaveLength(4);
    expect(t.body.endsWith("và 2 tàu khác")).toBe(true);
  });
});
