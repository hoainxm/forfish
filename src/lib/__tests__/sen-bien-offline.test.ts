import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*  RÀ SOÁT PROD 2026-10-16 (scripts/e2e-sen-bien.mjs) — hai lỗi chỉ lộ trên máy
    ĐÃ CÀI service worker, test đơn vị thường không thấy:
     1. Ảnh con cá Sen Biển không nằm trong vỏ sống-còn ⇒ mở app lần đầu rồi ra
        khơi là ảnh vỡ, nút nổi (chỉ có hình) thành trong suốt.
     2. Script worker tìm đường lấy từ kho SW mất phần `#params` ⇒ "Missing
        worker bootstrap config" ⇒ mọi lần tính tuyến chạy đồng bộ, đơ máy yếu. */

const root = process.cwd();
const SW = readFileSync(join(root, "public", "sw.js"), "utf8");
const CRITICAL = SW.slice(SW.indexOf("const CRITICAL_SHELL"), SW.indexOf("const SHELL"));

describe("ảnh trên màn bản đồ có trong vỏ sống-còn", () => {
  const files = ["src/components/fishing-map-view.tsx", "src/components/nav-mode.tsx", "src/components/sen-bien-sheet.tsx"];
  const icons = new Set<string>();
  for (const f of files) {
    const src = readFileSync(join(root, f), "utf8");
    for (const m of src.matchAll(/src="(\/icons\/[^"]+\.png)"/g)) icons.add(m[1]);
  }

  it("tìm thấy ảnh để kiểm (bộ dò không mù)", () => {
    expect(icons.has("/icons/sen-bien.png")).toBe(true);
  });

  it.each([...icons])("%s nằm trong CRITICAL_SHELL", (icon) => {
    expect(CRITICAL, `${icon} chưa vào vỏ — mất sóng là ảnh vỡ`).toContain(`"${icon}"`);
  });

  it("con cá Sen Biển nhẹ (≤ 40 KB) — vỏ sống-còn tải nguyên khối lúc cài", () => {
    expect(statSync(join(root, "public/icons/sen-bien.png")).size).toBeLessThanOrEqual(40 * 1024);
  });
});

describe("SW trả script worker dạng phản hồi tổng hợp (giữ #params)", () => {
  // tách đúng hàm trong sw.js ra chạy — sw.js là script SW thuần, không import được
  const start = SW.indexOf("function asWorkerScript(res)");
  const body = SW.slice(start, SW.indexOf("\n}\n", start) + 2);
  const asWorkerScript = new Function(`${body}; return asWorkerScript;`)() as (r: Response | undefined) => Response | undefined;

  it("nhánh asset tĩnh gói phản hồi khi destination là worker", () => {
    expect(SW).toMatch(/req\.destination === "worker" \? asWorkerScript\(res\) : res/);
  });

  it("phản hồi gói lại không mang URL riêng (worker lấy URL yêu cầu, còn #params)", async () => {
    const cached = await fetchLike("self.x = 1;", 200);
    expect(cached.url).not.toBe("");
    const out = asWorkerScript(cached)!;
    expect(out).not.toBe(cached);
    expect(out.url).toBe("");
    expect(out.status).toBe(200);
    expect(out.headers.get("content-type")).toBe("application/javascript");
    expect(await out.text()).toBe("self.x = 1;");
  });

  it("lỗi / không có thì trả nguyên (không nuốt 504)", async () => {
    const bad = await fetchLike("", 504);
    expect(asWorkerScript(bad)).toBe(bad);
    expect(asWorkerScript(undefined)).toBeUndefined();
  });
});

/** Response có `url` như bản lấy từ kho (Response dựng tay thì url rỗng) */
async function fetchLike(text: string, status: number): Promise<Response> {
  const r = new Response(status === 504 ? null : text, {
    status,
    headers: { "content-type": "application/javascript" },
  });
  Object.defineProperty(r, "url", { value: "https://sdfish.example/_next/static/chunks/turbopack-worker-x.js" });
  return r;
}
