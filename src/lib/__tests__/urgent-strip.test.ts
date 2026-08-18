import { describe, expect, it } from "vitest";
import { byUrgencyOrder, sdvicoUrgent } from "@/components/urgent-strip";
import { getExpiryStatus } from "@/lib/documents";
import { crewIssue } from "@/lib/crew";
import type { OwnedAssets } from "@/lib/owned-assets";

/*
  S3 (audit 2026-08-18): dải khẩn từng gán crew danger `days=-9999`, warn
  `days=0` ⇒ thuyền viên "còn 29 ngày" xếp trên giấy tờ "còn 2 ngày". Nay mọi
  loại đều xếp theo NGÀY THẬT; "chưa có bảo hiểm" = -1.
  T5: hết hạn HÔM NAY = đỏ.
*/

const TODAY = new Date("2026-06-10T05:00:00Z"); // 12:00 trưa VN

describe("getExpiryStatus — hôm nay = đã hết hạn", () => {
  it("days 0 → expired 'Hết hạn hôm nay'", () => {
    const s = getExpiryStatus(
      { id: "d", kind: "dang_kiem", label: "ĐK", expiresOn: "2026-06-10" },
      TODAY,
    );
    expect(s).toEqual({ level: "expired", days: 0, label: "Hết hạn hôm nay" });
  });
  it("30 ngày vẫn soon; 31 là ok", () => {
    const at = (iso: string) =>
      getExpiryStatus({ id: "d", kind: "khac", label: "x", expiresOn: iso }, TODAY)
        .level;
    expect(at("2026-07-10")).toBe("soon");
    expect(at("2026-07-11")).toBe("ok");
  });
});

describe("byUrgencyOrder — đỏ trước vàng, trong cùng màu theo ngày thật", () => {
  const item = (id: string, tone: "danger" | "warn", days: number) => ({
    id,
    label: id,
    status: "",
    tone,
    pillar: "giay_to" as const,
    href: "/tau",
    days,
  });

  it("giấy quá hạn 200 ngày đứng trên 'chưa có bảo hiểm' (-1)", () => {
    const crewNoIns = crewIssue(
      { id: "c", name: "A", cccd: "", role: "thuyen_vien", hasInsurance: false },
      TODAY,
    );
    const sorted = [
      item("crew", "danger", crewNoIns.days ?? 0),
      item("doc-old", "danger", -200),
      item("doc-soon", "warn", 2),
      item("crew-warn", "warn", 29),
    ].sort(byUrgencyOrder);
    expect(sorted.map((x) => x.id)).toEqual([
      "doc-old",
      "crew",
      "doc-soon",
      "crew-warn",
    ]);
  });
});

describe("sdvicoUrgent — nợ chỉ vào dải khi QUÁ HẠN", () => {
  const boat = { multi: false, nameOf: () => undefined, assign: {} };
  const assets: OwnedAssets = {
    products: [],
    services: [],
    requests: [],
    payments: [
      { orderCode: "DH1", amountVnd: 1_000_000, dueOn: "2026-06-01" }, // quá hạn
      { orderCode: "DH2", amountVnd: 2_000_000, dueOn: "2026-06-10" }, // hôm nay
      { orderCode: "DH3", amountVnd: 3_000_000, dueOn: "2026-12-01" }, // chưa tới
      { orderCode: "DH4", amountVnd: 4_000_000 }, // không hạn
    ],
  };
  it("chỉ DH1 (quá hạn) — hôm nay/chưa tới/không hạn không băng màu", () => {
    const items = sdvicoUrgent(assets, TODAY, boat);
    expect(items.map((i) => i.id)).toEqual(["sdv-pay-DH1"]);
    expect(items[0].tone).toBe("danger");
    expect(items[0].days).toBe(-9);
  });
});
