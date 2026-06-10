import { describe, expect, it } from "vitest";
import { inWatchRegion, parseStorms, stormKindLabel } from "../storms";

const NOW = new Date("2026-06-10T12:00:00Z");

function feature(over: {
  lon: number;
  lat: number;
  geomType?: string;
  iscurrent?: string;
  todate?: string;
  eventid?: number;
  eventname?: string;
  alertlevel?: string;
  severity?: number;
}) {
  return {
    geometry: {
      type: over.geomType ?? "Point",
      coordinates: [over.lon, over.lat],
    },
    properties: {
      eventid: over.eventid ?? 1,
      eventname: over.eventname ?? "WUTIP-26",
      alertlevel: over.alertlevel ?? "Green",
      iscurrent: over.iscurrent ?? "true",
      todate: over.todate ?? "2026-06-12T00:00:00",
      datemodified: "2026-06-10T06:00:00",
      severitydata: { severity: over.severity ?? 90 },
    },
  };
}

describe("inWatchRegion", () => {
  it("giữa Biển Đông → có; Đông Thái Bình Dương → không", () => {
    expect(inWatchRegion(14, 113)).toBe(true);
    expect(inWatchRegion(11.3, -136.3)).toBe(false); // ca thật từ nguồn
  });
});

describe("stormKindLabel", () => {
  it("phân loại theo gió mạnh nhất", () => {
    expect(stormKindLabel(50)).toBe("Áp thấp nhiệt đới");
    expect(stormKindLabel(90)).toBe("Bão");
    expect(stormKindLabel(150)).toBe("Bão mạnh");
    expect(stormKindLabel(200)).toBe("Siêu bão");
    expect(stormKindLabel(null)).toBe("Bão / áp thấp");
  });
});

describe("parseStorms", () => {
  it("giữ bão trong vùng, bỏ bão ngoài vùng", () => {
    const json = {
      features: [
        feature({ lon: 113, lat: 14, eventid: 1 }),
        feature({ lon: -136.3, lat: 11.3, eventid: 2 }),
      ],
    };
    const out = parseStorms(json, NOW);
    expect(out).toHaveLength(1);
    expect(out[0].lat).toBe(14);
  });

  it("bỏ polygon, chỉ lấy tâm điểm; khử trùng eventid", () => {
    const json = {
      features: [
        feature({ lon: 113, lat: 14, eventid: 7 }),
        feature({ lon: 113, lat: 14, eventid: 7 }),
        feature({ lon: 113, lat: 14, eventid: 7, geomType: "Polygon" }),
      ],
    };
    expect(parseStorms(json, NOW)).toHaveLength(1);
  });

  it("bỏ bão đã tan quá 48 giờ và bão iscurrent=false", () => {
    const json = {
      features: [
        feature({ lon: 113, lat: 14, eventid: 1, todate: "2026-06-01T00:00:00" }),
        feature({ lon: 114, lat: 15, eventid: 2, iscurrent: "false" }),
      ],
    };
    expect(parseStorms(json, NOW)).toHaveLength(0);
  });

  it("dịch alertlevel + cắt hậu tố năm khỏi tên", () => {
    const json = {
      features: [
        feature({ lon: 113, lat: 14, eventid: 1, alertlevel: "Orange", severity: 130 }),
      ],
    };
    const [s] = parseStorms(json, NOW);
    expect(s.alert).toBe("danger");
    expect(s.name).toBe("WUTIP");
    expect(s.kindLabel).toBe("Bão mạnh");
  });
});
