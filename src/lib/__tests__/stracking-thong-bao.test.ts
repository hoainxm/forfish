import { describe, expect, it } from "vitest";
import { CUA_SO_MS, TRAN_TIN_MOI_LUOT, gomTinTau } from "@/lib/stracking/thong-bao";

const NOW = Date.parse("2026-11-05T10:00:00Z"); // 17:00 giờ VN
const tau = [
  { imei: "1", serial: "S1", ten_tau: "BV-1234-TS", sdt_chu_tau: "0912345678", sdt_thuyen_truong: "0987654321" },
  { imei: "2", serial: "S2", ten_tau: "BV-5678-TS", sdt_chu_tau: "0912345678", sdt_thuyen_truong: null },
  { imei: "3", serial: "S3", ten_tau: null, sdt_chu_tau: "0911111111", sdt_thuyen_truong: "0911111111" },
];
const BD = "Báo động";
const CC = "Cảnh cáo";

describe("cảnh báo thông minh — gộp thông báo tàu", () => {
  it("một tin/SĐT, mỗi tàu một dòng, tàu nguy hiểm hơn trước; chủ tàu + thuyền trưởng cùng nhận", () => {
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
    const tt = tin.find((t) => t.phone === "0987654321")!;
    expect(tt.title).toBe("Cảnh báo tàu BV-1234-TS");
    expect(tin).toHaveLength(2);
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

  it("quá 3 tàu ⇒ 'và N tàu khác'", () => {
    const nhieu = ["a", "b", "c", "d", "e"].map((x) => ({ imei: x, serial: x, ten_tau: `T-${x}`, sdt_chu_tau: "0900000001", sdt_thuyen_truong: null }));
    const [t] = gomTinTau(nhieu.map((m) => ({ imei: m.imei, loai: "SOS", luc: "2026-11-05T09:00:00Z", muc: BD })), nhieu, NOW);
    expect(t.body.split("\n")).toHaveLength(4);
    expect(t.body.endsWith("và 2 tàu khác")).toBe(true);
  });
});
