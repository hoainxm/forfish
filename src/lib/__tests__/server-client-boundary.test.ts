import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

/*  CỔNG CHẶN KHUÔN: **MÃ CHẠY TRÊN MÁY CHỦ KHÔNG ĐƯỢC IMPORT MODULE "use client"**.

    VÌ SAO CÓ (2026-08-02c — lỗi thật, bắt được trên production, không phải giả
    định): `/api/me/heartbeat` import `isValidDeviceId` từ `lib/device-id.ts`,
    mà file đó mở đầu bằng `"use client"`. Next biến MỌI export của module
    "use client" thành `registerClientReference(() => { throw ... })` trong bản
    dựng server ⇒ route gọi hàm đó là **ném ngay**, HTTP 500, TRƯỚC cả dòng ghi
    đầu tiên.

    Hậu quả đo được trên máy chủ thật, gần một ngày không ai biết:
      · 0/717 khách có `device_id` — tính năng "đổi máy" chưa từng ghi một hàng
      · bảng `customer_devices` TRỐNG HOÀN TOÀN
      · máy khách dùng app hằng ngày mà /quan-tri đứng im ở mốc cũ ⇒ nhân viên
        nhìn vào tưởng khách đã bỏ app

    VÌ SAO KHÔNG CỔNG NÀO CŨ BẮT ĐƯỢC: `npm run build` XANH, `tsc` XANH, `lint`
    XANH. Đây là lỗi ranh giới client/server, **chỉ nổ lúc chạy**, và chỉ nổ ở
    nhánh đã đăng nhập (nhánh chưa đăng nhập trả về sớm hơn dòng lỗi) — tức là
    đúng nhánh mà máy dev hiếm khi chạm tới.

    Luật này repo đã biết từ trước và ghi ngay trong `src/lib/phone.ts`:
    *"Tách khỏi auth-form.tsx (use client) để server import không kéo client
    bundle"*. Có điều luật nằm trong một dòng chú thích thì không ai gác được.  */

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

/** File có chỉ thị "use client" ở ĐẦU không (bỏ qua comment/dòng trống) */
function isClientModule(file: string): boolean {
  const head = readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/[^\n]*$/gm, "")
    .trimStart();
  return /^["']use client["']/.test(head);
}

function walk(dir: string, hit: (f: string) => void): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, hit);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".d.ts")) hit(p);
  }
}

/** Mọi module `@/lib/...` mà file này import */
function libImports(file: string): string[] {
  const src = readFileSync(file, "utf8");
  const out: string[] = [];
  const re = /from\s+["']@\/lib\/([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.push(m[1]);
  return out;
}

function resolveLib(spec: string): string | null {
  for (const ext of [".ts", ".tsx"]) {
    const p = join(SRC, "lib", `${spec}${ext}`);
    if (existsSync(p)) return p;
  }
  const idx = join(SRC, "lib", spec, "index.ts");
  return existsSync(idx) ? idx : null;
}

/** File chạy trên MÁY CHỦ: route handler + middleware */
function serverEntries(): string[] {
  const out: string[] = [];
  walk(join(SRC, "app", "api"), (f) => {
    if (f.endsWith("route.ts")) out.push(f);
  });
  for (const mw of [join(ROOT, "middleware.ts"), join(SRC, "middleware.ts")]) {
    if (existsSync(mw)) out.push(mw);
  }
  return out;
}

describe("ranh giới client/server", () => {
  const entries = serverEntries();

  it("tìm thấy route để soi (đường dẫn không lệch)", () => {
    expect(entries.length).toBeGreaterThan(10);
  });

  it("có ít nhất một module 'use client' để đối chiếu (bộ dò chạy đúng)", () => {
    const clients: string[] = [];
    walk(join(SRC, "lib"), (f) => {
      if (isClientModule(f)) clients.push(f);
    });
    expect(clients.length).toBeGreaterThan(0);
  });

  it("KHÔNG route/middleware nào import module 'use client'", () => {
    const viPham: string[] = [];
    for (const entry of entries) {
      for (const spec of libImports(entry)) {
        const target = resolveLib(spec);
        if (target && isClientModule(target)) {
          viPham.push(
            `${entry.slice(ROOT.length + 1).replace(/\\/g, "/")} → @/lib/${spec}`,
          );
        }
      }
    }
    expect(
      viPham,
      `Gọi hàm của module "use client" trên máy chủ là NÉM NGAY (HTTP 500), mà build vẫn xanh.\n` +
        `Sửa: bỏ "use client" khỏi module thuần đó, hoặc tách phần thuần ra file dùng chung.\n` +
        viPham.join("\n"),
    ).toEqual([]);
  });
});
