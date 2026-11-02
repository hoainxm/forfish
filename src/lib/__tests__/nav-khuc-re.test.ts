import { describe, expect, it } from "vitest";
import {
  baoKhucRe,
  khucReKeTiep,
  mocKhucRe,
  nguongKm,
  KHUC_RE_TRUOC_SAN_KM,
  type KhucReNho,
} from "@/lib/nav-khuc-re";
import { distSpeech } from "@/lib/nav-voice/phrases";

// tuyến chữ L: đi Đông ~11 km rồi bẻ lên Bắc ~11 km (gần xích đạo cho dễ tính)
const L = [
  { lat: 10, lon: 107 },
  { lat: 10, lon: 107.1 },
  { lat: 10.1, lon: 107.1 },
];
const fmt = (km: number) => distSpeech(km, "nm");

describe("khucReKeTiep — chỉ khúc đổi hướng thật", () => {
  it("tìm khúc rẽ trái ở waypoint 1, đi tiếp về phía Bắc", () => {
    const kr = khucReKeTiep(L, 0)!;
    expect(kr.idx).toBe(1);
    expect(kr.huongVN).toBe("Bắc");
    expect(kr.gocDeg).toBeLessThan(-80); // Đông → Bắc là sang TRÁI
    expect(kr.km).toBeGreaterThan(10.5);
  });

  it("đã qua khúc rẽ ⇒ không còn khúc nào (điểm cuối là đích, không phải khúc rẽ)", () => {
    expect(khucReKeTiep(L, 12)).toBeNull();
  });

  it("bẻ vài độ không tính là khúc rẽ", () => {
    const thang = [
      { lat: 10, lon: 107 },
      { lat: 10.001, lon: 107.1 },
      { lat: 10.003, lon: 107.2 },
    ];
    expect(khucReKeTiep(thang, 0)).toBeNull();
  });

  it("khúc rẽ trùng chỗ ghé thì bỏ (chỗ ghé có câu riêng)", () => {
    expect(khucReKeTiep(L, 0, new Set([1]))).toBeNull();
  });

  it("tuyến ít hơn 3 điểm hoặc số hỏng ⇒ null", () => {
    expect(khucReKeTiep(L.slice(0, 2), 0)).toBeNull();
    expect(khucReKeTiep(L, Number.NaN)).toBeNull();
  });
});

describe("mốc theo thời gian chạy, có sàn", () => {
  it("chưa biết tốc độ ⇒ lấy sàn", () => {
    expect(nguongKm(5, KHUC_RE_TRUOC_SAN_KM, null)).toBe(1);
    expect(mocKhucRe(0.9, null)).toBe(1);
    expect(mocKhucRe(0.15, null)).toBe(2);
    expect(mocKhucRe(3, null)).toBe(0);
  });
  it("chạy nhanh ⇒ báo sớm hơn (24 km/h × 5 phút = 2 km)", () => {
    expect(mocKhucRe(1.9, 24)).toBe(1);
    expect(mocKhucRe(0.35, 24)).toBe(2);
  });
});

describe("baoKhucRe — mỗi khúc nói tối đa hai lần, chỉ khi tới gần hơn", () => {
  const kr = (km: number) => ({ ...khucReKeTiep(L, 0)!, km });

  it("xa ⇒ im; tới mốc trước ⇒ câu báo trước; tới nơi ⇒ câu bây giờ", () => {
    let nho: KhucReNho = null;
    let r = baoKhucRe(nho, kr(5), 12, fmt);
    expect(r.bao).toBeNull();
    nho = r.nho;
    r = baoKhucRe(nho, kr(0.9), 12, fmt);
    expect(r.bao?.text).toBe("Còn chừng 900 mét, rồi đi về phía Bắc, bên trái tàu.");
    nho = r.nho;
    r = baoKhucRe(nho, kr(0.8), 12, fmt);
    expect(r.bao).toBeNull(); // cùng mốc, không nói lại
    nho = r.nho;
    r = baoKhucRe(nho, kr(0.15), 12, fmt);
    expect(r.bao?.text).toBe("Bây giờ đi về phía Bắc, bên trái tàu.");
    nho = r.nho;
    r = baoKhucRe(nho, kr(0.5), 12, fmt);
    expect(r.bao).toBeNull(); // lùi xa ra cũng không nói lại mốc trước
  });

  it("khúc rẽ hiện ra khi đã sát ⇒ nói thẳng câu bây giờ, không nói câu trước sau đó", () => {
    const r = baoKhucRe(null, kr(0.1), 12, fmt);
    expect(r.bao?.step).toBe(2);
    expect(baoKhucRe(r.nho, kr(0.6), 12, fmt).bao).toBeNull();
  });

  it("key ổn định theo khúc + mốc để bộ phát ngôn đọc một lần", () => {
    expect(baoKhucRe(null, kr(0.9), 12, fmt).bao?.key).toBe("re:1:1");
  });

  it("không còn khúc rẽ ⇒ quên nhớ", () => {
    expect(baoKhucRe({ idx: 1, step: 2 }, null, 12, fmt)).toEqual({ nho: null, bao: null });
  });
});
