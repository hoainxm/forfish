import { describe, expect, it } from "vitest";
import { boatZone, departureCheck } from "@/lib/departure-check";
import type { BoatDocument } from "@/lib/documents";
import type { CrewMember } from "@/lib/crew";

const TODAY = new Date("2026-06-15T00:00:00Z");
const d = (offset: number) => {
  const t = new Date(TODAY);
  t.setUTCDate(t.getUTCDate() + offset);
  return t.toISOString().slice(0, 10);
};

const doc = (
  kind: BoatDocument["kind"],
  expiresOn?: string,
): BoatDocument => ({ id: kind, kind, label: kind, expiresOn });

const member = (hasInsurance: boolean): CrewMember => ({
  id: `m-${hasInsurance}`,
  name: "x",
  role: "thuyen_vien",
  shares: 1,
  hasInsurance,
  advances: [],
});

describe("boatZone", () => {
  it("phân vùng theo chiều dài", () => {
    expect(boatZone(8).zone).toBe("ven bờ");
    expect(boatZone(13).zone).toBe("lộng");
    expect(boatZone(15).zone).toBe("khơi");
    expect(boatZone(24).zone).toBe("khơi");
  });
});

describe("departureCheck — bộ giấy theo cỡ tàu", () => {
  it("tàu <12m: chỉ cần giấy phép khai thác (≥6m), không đăng kiểm/ATTP/VMS", () => {
    const r = departureCheck({
      lengthM: 8,
      documents: [doc("giay_phep_khai_thac", d(100))],
      crew: [],
      today: TODAY,
    });
    const ids = r.items.map((i) => i.id);
    expect(ids).toContain("giay_phep");
    expect(ids).not.toContain("dang_kiem");
    expect(ids).not.toContain("attp");
    expect(ids).not.toContain("vms");
  });

  it("tàu ≥15m: thêm đăng kiểm + ATTP + chứng chỉ + VMS + sổ danh bạ", () => {
    const r = departureCheck({
      lengthM: 18,
      documents: [],
      crew: [],
      today: TODAY,
    });
    const ids = r.items.map((i) => i.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "giay_phep",
        "dang_kiem",
        "attp",
        "chung_chi",
        "vms",
        "so_danh_ba",
      ]),
    );
    // VMS + sổ danh bạ là manual (app không gật đèn)
    expect(r.items.find((i) => i.id === "vms")!.auto).toBe(false);
  });
});

describe("departureCheck — đèn xanh/đỏ", () => {
  it("thiếu giấy bắt buộc → đỏ", () => {
    const r = departureCheck({
      lengthM: 18,
      documents: [], // thiếu hết
      crew: [],
      today: TODAY,
    });
    expect(r.readiness).toBe("red");
    expect(r.redCount).toBeGreaterThan(0);
  });

  it("giấy quá hạn → đỏ; sắp hết hạn → vàng", () => {
    const expired = departureCheck({
      lengthM: 8,
      documents: [doc("giay_phep_khai_thac", d(-5))],
      crew: [],
      today: TODAY,
    });
    expect(expired.readiness).toBe("red");

    const soon = departureCheck({
      lengthM: 8,
      documents: [doc("giay_phep_khai_thac", d(10))],
      crew: [],
      today: TODAY,
    });
    expect(soon.readiness).toBe("yellow");
  });

  it("đủ giấy còn hạn + bảo hiểm đủ → xanh; VMS manual không chặn đèn", () => {
    const r = departureCheck({
      lengthM: 18,
      documents: [
        doc("giay_phep_khai_thac", d(100)),
        doc("dang_kiem", d(100)),
        doc("an_toan_thuc_pham", d(100)),
        doc("chung_chi_thuyen_truong"), // vĩnh viễn
      ],
      crew: [member(true), member(true)],
      today: TODAY,
    });
    expect(r.readiness).toBe("green");
  });

  it("có người chưa bảo hiểm → đỏ", () => {
    const r = departureCheck({
      lengthM: 8,
      documents: [doc("giay_phep_khai_thac", d(100))],
      crew: [member(true), member(false)],
      today: TODAY,
    });
    expect(r.readiness).toBe("red");
    expect(r.items.find((i) => i.id === "bao_hiem_tv")!.status).toBe("missing");
  });
});
