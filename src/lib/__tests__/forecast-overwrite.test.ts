import { describe, expect, it } from "vitest";

/*
  CỬA "BẢN MỚI CÓ TỐT BẰNG BẢN CŨ KHÔNG" (K4 / C-C4, 2026-08-02).

  Ca thật: tải đủ ở bờ (gió + sóng + dòng chảy). Ra cửa biển sóng còn vạch, app
  tự tải lại; nhánh sóng và dòng chảy trong fetchGridCore kết bằng `.catch(() =>
  null)` nên nguồn marine 429/timeout vẫn ra một lưới "hợp lệ" (đủ ô, đủ times)
  mà mọi waveM là null — rồi GHI ĐÈ THẲNG lên bản đầy đủ. Giữa biển bật lớp
  Sóng: 0 mũi tên, trống câm, không báo lỗi gì, chip vẫn nói "Đã lưu đủ dự báo".

  Hai hàm dưới là cửa THUẦN chặn đúng cú ghi đó, kèm TRẦN TUỔI để nguồn sóng
  chết dài ngày không khoá luôn bản gió mới.
*/

import {
  gridHasWave,
  gridHasCurrent,
  mergeGridCurrent,
  shouldOverwriteGrid,
  GRID_OVERWRITE_MAX_AGE_MS,
  type ForecastGrid,
  type GridHour,
} from "../forecast-grid";
import {
  scalarHasValues,
  shouldOverwriteScalar,
  SCALAR_OVERWRITE_MAX_AGE_MS,
  type ScalarGrid,
} from "../scalar-field";

const NOW = Date.parse("2026-08-02T03:00:00Z");

/** Lưới ĐÚNG ĐỊNH NGHĨA hiện hành (4 góc 1/98 → 24/123, ≥20 ô) — gridIsCurrent
    loại bản đời cũ, nên bản dựng để test phải phủ đúng khung. */
function grid(opts: { wave: boolean; current: boolean }): ForecastGrid {
  const h = (): GridHour => ({
    windKmh: 12,
    windDirDeg: 90,
    waveM: opts.wave ? 1.2 : null,
    waveDirDeg: opts.wave ? 90 : null,
    curKmh: opts.current ? 0.8 : null,
    curDirDeg: opts.current ? 45 : null,
  });
  const cells = [];
  for (let i = 0; i < 12; i++) {
    for (let j = 0; j < 13; j++) {
      cells.push({
        lat: Math.round((1 + (i * 23) / 11) * 100) / 100,
        lon: Math.round((98 + (j * 25) / 12) * 100) / 100,
        hours: [h(), h()],
      });
    }
  }
  return { cells, times: ["2026-08-02T00:00", "2026-08-02T03:00"] };
}

describe("gridHasWave / gridHasCurrent — soi TỪNG mặt hàng của lưới", () => {
  it("lưới đủ ô đủ times mà sóng toàn null vẫn bị coi là THIẾU sóng", () => {
    const g = grid({ wave: false, current: true });
    expect(g.times.length).toBeGreaterThan(0); // "hợp lệ" theo mắt cũ
    expect(gridHasWave(g)).toBe(false);
    expect(gridHasCurrent(g)).toBe(true);
  });

  it("lưới đầy đủ → có cả hai", () => {
    const g = grid({ wave: true, current: true });
    expect(gridHasWave(g)).toBe(true);
    expect(gridHasCurrent(g)).toBe(true);
  });
});

describe("shouldOverwriteGrid — đừng đè bản ĐẦY ĐỦ bằng bản THIẾU", () => {
  const full = { data: grid({ wave: true, current: true }), savedAt: NOW - 3600_000 };

  it("chưa có bản nào trong máy → cứ ghi", () => {
    expect(shouldOverwriteGrid(null, grid({ wave: false, current: false }), NOW)).toBe(
      true,
    );
  });

  it("nguồn SÓNG hỏng (lưới rỗng-sóng) → TỪ CHỐI ghi đè bản đầy đủ", () => {
    expect(
      shouldOverwriteGrid(full, grid({ wave: false, current: true }), NOW),
    ).toBe(false);
  });

  /* HỒI QUY DO CHÍNH BẢN VÁ GÂY RA (sửa 2026-08-02): bản đầu đặt `curKmh` NGANG
     HÀNG `waveM`. Dòng chảy là lớp "xem cho biết" và đến từ REQUEST RIÊNG —
     nguồn SMOC chết trong khi gió/sóng vẫn tươi là chuyện thường. Chặn ở đây là
     khoá luôn lưới GIÓ/SÓNG MỚI, máy ôm bản tới 23 giờ tuổi: đúng chỗ không
     được phép cũ, vì gió sóng mới là thứ dính an toàn tính mạng. */
  it("nguồn DÒNG CHẢY hỏng nhưng gió/sóng còn tươi → VẪN GHI (đừng khoá bản mới)", () => {
    expect(
      shouldOverwriteGrid(full, grid({ wave: true, current: false }), NOW),
    ).toBe(true);
  });

  it("bản mới ĐỦ như bản cũ → ghi bình thường (không kẹt ở bản cũ)", () => {
    expect(shouldOverwriteGrid(full, grid({ wave: true, current: true }), NOW)).toBe(
      true,
    );
  });

  it("bản cũ vốn đã thiếu sóng → bản mới thiếu sóng vẫn ghi được (không tệ hơn)", () => {
    const poor = { data: grid({ wave: false, current: true }), savedAt: NOW - 3600_000 };
    expect(
      shouldOverwriteGrid(poor, grid({ wave: false, current: true }), NOW),
    ).toBe(true);
  });

  it("bản cũ QUÁ 24 GIỜ → cho đè, đừng kẹt vĩnh viễn khi nguồn sóng chết dài ngày", () => {
    const old = {
      data: grid({ wave: true, current: true }),
      savedAt: NOW - GRID_OVERWRITE_MAX_AGE_MS,
    };
    expect(shouldOverwriteGrid(old, grid({ wave: false, current: false }), NOW)).toBe(
      true,
    );
  });

  it("bản cũ ĐỜI CŨ (vùng phủ nhỏ) → không tiếc, cứ đè", () => {
    const legacy = {
      data: { cells: grid({ wave: true, current: true }).cells.slice(0, 5), times: ["x"] },
      savedAt: NOW - 60_000,
    };
    expect(
      shouldOverwriteGrid(legacy, grid({ wave: false, current: false }), NOW),
    ).toBe(true);
  });
});

/*
  GHÉP DÒNG CHẢY CŨ VÀO LƯỚI MỚI — vế đi kèm bắt buộc của việc bỏ chặn ở trên:
  cho ghi lưới thiếu dòng chảy thì phải giữ lại phần dòng chảy đã tải sẵn ở bờ,
  không thì lớp Dòng chảy giữa biển trống câm.
*/
describe("mergeGridCurrent — giữ dòng chảy cũ, thay gió/sóng mới", () => {
  const withCur = grid({ wave: true, current: true });
  const noCur = grid({ wave: true, current: false });

  it("bản mới thiếu dòng chảy + trục giờ KHỚP → ghép số dòng chảy cũ vào", () => {
    const out = mergeGridCurrent(withCur, noCur);
    expect(gridHasCurrent(out)).toBe(true);
    expect(out.cells[0].hours[0].curKmh).toBe(0.8);
    // gió/sóng vẫn là của bản MỚI, không bị bản cũ đè
    expect(out.cells[0].hours[0].waveM).toBe(noCur.cells[0].hours[0].waveM);
    // không sửa tại chỗ bản cũ
    expect(noCur.cells[0].hours[0].curKmh).toBeNull();
  });

  it("trục giờ LỆCH → trả bản mới NGUYÊN XI (thà mất lớp còn hơn dán số giờ khác)", () => {
    const shifted: ForecastGrid = { ...withCur, times: ["2026-08-01T00:00", "2026-08-01T03:00"] };
    expect(mergeGridCurrent(shifted, noCur)).toBe(noCur);
  });

  it("số ô lệch (bản đời cũ) → không ghép", () => {
    const fewer: ForecastGrid = { ...withCur, cells: withCur.cells.slice(0, 10) };
    expect(mergeGridCurrent(fewer, noCur)).toBe(noCur);
  });

  it("toạ độ ô lệch → không ghép", () => {
    const moved: ForecastGrid = {
      ...withCur,
      cells: withCur.cells.map((c, i) => (i === 0 ? { ...c, lat: c.lat + 1 } : c)),
    };
    expect(mergeGridCurrent(moved, noCur)).toBe(noCur);
  });

  it("bản mới ĐÃ CÓ dòng chảy / bản cũ không có → không đụng vào", () => {
    expect(mergeGridCurrent(withCur, withCur)).toBe(withCur);
    expect(mergeGridCurrent(noCur, noCur)).toBe(noCur);
    expect(mergeGridCurrent(null, noCur)).toBe(noCur);
  });
});

/* Lớp dải màu: fetchScalarFieldsLive ghi CẢ 5 lớp một lượt — nguồn thiếu MỘT
   biến (vd model không có CAPE) là lớp đó thành mảng null và đè bản đầy đủ. */
const scalar = (hasValues: boolean): ScalarGrid => ({
  kind: "storm",
  times: ["2026-08-02T00:00", "2026-08-02T03:00"],
  nLat: 2,
  nLon: 2,
  cells: [
    { lat: 1, lon: 98, values: hasValues ? [100, 200] : [null, null] },
    { lat: 1, lon: 123, values: hasValues ? [110, 210] : [null, null] },
    { lat: 24, lon: 98, values: hasValues ? [120, 220] : [null, null] },
    { lat: 24, lon: 123, values: hasValues ? [130, 230] : [null, null] },
  ],
});

describe("shouldOverwriteScalar — cùng khuôn cho lớp dải màu", () => {
  const full = { data: scalar(true), savedAt: NOW - 3600_000 };

  it("lớp toàn null bị coi là RỖNG dù đủ ô đủ mốc", () => {
    expect(scalarHasValues(scalar(false))).toBe(false);
    expect(scalarHasValues(scalar(true))).toBe(true);
  });

  it("bản rỗng KHÔNG được đè bản có số", () => {
    expect(shouldOverwriteScalar(full, scalar(false), NOW)).toBe(false);
  });

  it("bản có số → ghi bình thường", () => {
    expect(shouldOverwriteScalar(full, scalar(true), NOW)).toBe(true);
  });

  it("chưa có bản nào → cứ ghi", () => {
    expect(shouldOverwriteScalar(null, scalar(false), NOW)).toBe(true);
  });

  it("bản cũ quá 24 giờ → cho đè (không kẹt khi nguồn chết dài ngày)", () => {
    const old = { data: scalar(true), savedAt: NOW - SCALAR_OVERWRITE_MAX_AGE_MS };
    expect(shouldOverwriteScalar(old, scalar(false), NOW)).toBe(true);
  });
});
