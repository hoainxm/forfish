import { describe, expect, it, vi } from "vitest";
import {
  normalizeOwnerLogin,
  ownerPasswordProblem,
  setupOwner,
} from "../../../scripts/owner-account.mjs";
import { normalizeOwnerLogin as libNormalize } from "@/lib/admin";

/*  SCRIPT ADMIN TỔNG (2026-10-02): mật khẩu do chủ dự án tự gõ, script chặn
    mật khẩu yếu, đổi mật khẩu thì thu hồi chuỗi + ghi nhật ký. */

describe("owner-account.mjs — luật thuần", () => {
  it("khuôn tên khớp lib/admin (trừ luật SĐT nằm ở lib)", () => {
    for (const v of ["admin", " Admin ", "ad", "1x", "sd.vico-01", "a".repeat(33)])
      expect(normalizeOwnerLogin(v)).toBe(libNormalize(v));
  });

  it("chặn mật khẩu yếu — kể cả admin/admin", () => {
    expect(ownerPasswordProblem("admin", "admin")).toMatch(/12/);
    expect(ownerPasswordProblem("Admin@2026xyz!", "admin")).toMatch(/tên/);
    expect(ownerPasswordProblem("Sdvico@2026xyz", "boss")).toMatch(/dễ đoán/);
    expect(ownerPasswordProblem("aaaaaaaaaaaa", "boss")).toBeTruthy();
    expect(ownerPasswordProblem("abcdefghijkl", "boss")).toMatch(/3 trong 4/);
    expect(ownerPasswordProblem("Bien-Dong#2026", "boss")).toBeNull();
  });
});

describe("setupOwner — tạo / đổi + thu hồi + nhật ký", () => {
  function fakes(existing: { id: string } | null) {
    const auth = {
      findByEmail: vi.fn(async () => existing),
      create: vi.fn(async () => ({})),
      setPassword: vi.fn(async () => ({})),
    };
    const rest = {
      patch: vi.fn<(path: string, body: unknown) => Promise<unknown[]>>(async () => []),
      post: vi.fn<(path: string, body: unknown) => Promise<unknown[]>>(async () => []),
    };
    return { auth, rest };
  }

  it("chưa có → tạo admin@sdvico.local", async () => {
    const f = fakes(null);
    const r = await setupOwner({ ...f, login: "admin", password: "Bien-Dong#2026" });
    expect(r).toBe("created");
    expect(f.auth.findByEmail).toHaveBeenCalledWith("admin@sdvico.local");
    expect(f.auth.create).toHaveBeenCalledWith("admin@sdvico.local", "Bien-Dong#2026");
    expect(f.auth.setPassword).not.toHaveBeenCalled();
  });

  it("đã có → đổi mật khẩu, thu hồi chuỗi của 'admin', ghi nhật ký KHÔNG kèm mật khẩu", async () => {
    const f = fakes({ id: "u1" });
    const r = await setupOwner({ ...f, login: "admin", password: "Bien-Dong#2026" });
    expect(r).toBe("updated");
    expect(f.auth.setPassword).toHaveBeenCalledWith("u1", "Bien-Dong#2026");
    expect(f.rest.patch.mock.calls[0][0]).toMatch(/customer_phone=eq\.admin&revoked_at=is\.null/);
    const log = f.rest.post.mock.calls[0] as [string, Record<string, unknown>];
    expect(log[0]).toBe("admin_activity_log");
    expect(log[1]).toMatchObject({ action: "staff.owner-setup", target: "admin" });
    expect(JSON.stringify(log[1])).not.toContain("Bien-Dong");
  });
});
