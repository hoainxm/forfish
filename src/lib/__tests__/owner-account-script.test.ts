import { describe, expect, it, vi } from "vitest";
import {
  feedKeys,
  normalizeOwnerLogin,
  ownerPasswordProblem,
  ownerPasswordProblems,
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

  it("chặn mật khẩu yếu — kể cả admin/admin — và nói HẾT lý do một lần", () => {
    const p = ownerPasswordProblems("admin", "admin");
    expect(p.join(" ")).toMatch(/12/);
    expect(p.join(" ")).toMatch(/tên đăng nhập/);
    expect(ownerPasswordProblem("Admin2026xyzq", "admin")).toMatch(/tên/);
    expect(ownerPasswordProblem("Sdvico2026xyz", "boss")).toMatch(/dễ đoán/);
    expect(ownerPasswordProblem("aaaaaaaaaaaa", "boss")).toBeTruthy();
    expect(ownerPasswordProblem("abcdefghijkl", "boss")).toMatch(/chữ lẫn số/);
  });

  it("NỚI 2026-10-02: không còn bắt 3/4 loại ký tự", () => {
    expect(ownerPasswordProblems("biendong2026xa", "admin")).toEqual([]);
    expect(ownerPasswordProblems("BienDong2026xa", "admin")).toEqual([]);
    // câu dài ≥16 ký tự chỉ chữ cũng được
    expect(ownerPasswordProblems("thuyen ra khoi som", "admin")).toEqual([]);
  });

  it("chặn ký tự có dấu (bộ gõ Telex/Unikey đang bật)", () => {
    expect(ownerPasswordProblem("Biểnđông2026x", "admin")).toMatch(/bộ gõ tiếng Việt/);
  });
});

describe("feedKeys — đọc bàn phím từng cục", () => {
  it("cục nhiều ký tự kèm Enter (gõ nhanh / dán) vẫn kết thúc — bản đầu treo ở đây", () => {
    expect(feedKeys("", "abc\r")).toMatchObject({ buf: "abc", done: true, echo: "•••" });
  });
  it("xoá lùi + bỏ phím mũi tên", () => {
    expect(feedKeys("ab", "\u007f\u001b[Dc")).toMatchObject({ buf: "ac", done: false, echo: "\b \b•" });
  });
  it("Ctrl+C = huỷ", () => {
    expect(feedKeys("ab", "\u0003").cancel).toBe(true);
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
