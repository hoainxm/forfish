import { describe, expect, it } from "vitest";

import { buildStatus, SNAPSHOT_STALE_H, tuoi } from "@/lib/status-report";

const NOW = Date.parse("2026-10-19T12:00:00Z");
const base = {
  build: "abc123", builtOn: "2026-10-19", fishBlendFittedAt: "2026-07-28T13:56:35Z", forecastSkillFittedAt: "2026-07-25T03:09:37Z",
  fishSnapshotAt: "2026-10-19T02:00:00Z", weatherSnapshotAt: "2026-10-19T02:30:00Z", dbOk: true, nowMs: NOW,
};

describe("status-report — tách 'server sống' khỏi 'dữ liệu còn mới'", () => {
  it("tuổi theo giờ, quá ngưỡng là cũ", () => {
    expect(tuoi("2026-10-19T02:00:00Z", NOW)).toEqual({ at: "2026-10-19T02:00:00.000Z", ageHours: 10, fresh: true });
    expect(tuoi("2026-10-17T12:00:00Z", NOW)?.fresh).toBe(false);
    expect(SNAPSHOT_STALE_H).toBe(36);
  });
  it("mốc hỏng / ở tương lai ⇒ null, không đoán", () => {
    expect(tuoi(null, NOW)).toBeNull();
    expect(tuoi("không phải ngày", NOW)).toBeNull();
    expect(tuoi("2026-10-20T00:00:00Z", NOW)).toBeNull();
  });
  it("cả hai bản tươi ⇒ 'tuoi'; một bản cũ hoặc chưa có ⇒ 'cu'", () => {
    expect(buildStatus(base).duLieu).toBe("tuoi");
    expect(buildStatus({ ...base, fishSnapshotAt: "2026-10-15T00:00:00Z" }).duLieu).toBe("cu");
    expect(buildStatus({ ...base, weatherSnapshotAt: null }).duLieu).toBe("cu");
  });
  it("DB không đọc được ⇒ 'khong-doc-duoc', không bịa tuổi; mã bản + tham số mô hình vẫn trả", () => {
    const s = buildStatus({ ...base, dbOk: false });
    expect(s.duLieu).toBe("khong-doc-duoc");
    expect(s.data).toBeNull();
    expect(s.build).toBe("abc123");
    expect(s.model.fishBlendFittedAt).toBe("2026-07-28T13:56:35Z");
  });
  it("máy dev (mã bản rỗng) ⇒ build null", () => expect(buildStatus({ ...base, build: "", builtOn: "" }).build).toBeNull());
});
