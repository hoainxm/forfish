import { describe, it, expect } from "vitest";
import { isSyncKind, invalidPut, SYNC_KINDS } from "@/lib/user-sync-core";

describe("user-sync-core — kiểm đầu vào đồng bộ (thuần)", () => {
  it("isSyncKind chỉ nhận 5 kind hợp lệ", () => {
    for (const k of SYNC_KINDS) expect(isSyncKind(k)).toBe(true);
    expect(isSyncKind("trips")).toBe(false);
    expect(isSyncKind("")).toBe(false);
    expect(isSyncKind(123)).toBe(false);
    expect(isSyncKind(null)).toBe(false);
  });

  it("SYNC_KINDS khớp check migration 0050 (boats/crew/documents/maintenance/materials)", () => {
    expect([...SYNC_KINDS].sort()).toEqual(
      ["boats", "crew", "documents", "maintenance", "materials"].sort(),
    );
  });

  it("invalidPut: body đúng → null (hợp lệ)", () => {
    expect(
      invalidPut({ kind: "boats", data: [{ id: "a" }], clientUpdatedAt: 1700000000000 }),
    ).toBeNull();
    // data rỗng vẫn hợp lệ (xoá hết là một trạng thái đúng)
    expect(invalidPut({ kind: "materials", data: [], clientUpdatedAt: 1 })).toBeNull();
  });

  it("invalidPut: bắt các ca sai với code rõ", () => {
    expect(invalidPut(null)).toBe("bad_body");
    expect(invalidPut("x")).toBe("bad_body");
    expect(invalidPut({ data: [], clientUpdatedAt: 1 })).toBe("bad_kind");
    expect(invalidPut({ kind: "trips", data: [], clientUpdatedAt: 1 })).toBe("bad_kind");
    expect(invalidPut({ kind: "boats", clientUpdatedAt: 1 })).toBe("no_data");
    expect(invalidPut({ kind: "boats", data: [] })).toBe("bad_updated_at");
    expect(invalidPut({ kind: "boats", data: [], clientUpdatedAt: "1" })).toBe(
      "bad_updated_at",
    );
    expect(invalidPut({ kind: "boats", data: [], clientUpdatedAt: NaN })).toBe(
      "bad_updated_at",
    );
  });
});
