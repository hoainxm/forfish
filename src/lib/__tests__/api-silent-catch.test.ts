import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/*  CỔNG CHẶN CẢ KHUÔN, KHÔNG VÁ TỪNG ĐIỂM (2026-08-02e, audit H6).
    Nhân mẫu `api-error-status.test.ts` — cổng đọc thẳng mã nguồn route.

    KHUÔN LỖI: `catch { }` KHÔNG có một dòng `console` nào. Máy chủ nuốt trọn
    lỗi ⇒ đường phát hiện duy nhất còn lại là "chủ dự án tình cờ mở /quan-tri
    thấy số liệu đứng hình". Đã trả giá thật hai lần:
      · `/api/me/heartbeat` ném 500 gần MỘT NGÀY (import module "use client"):
        0/717 khách ghi được mã máy, bảng `customer_devices` trống trơn;
      · cùng route đó `await admin.from("customer_devices").upsert(...)` vứt luôn
        `error` — mà supabase-js KHÔNG NÉM với lỗi Postgres/RLS, nó TRẢ VỀ
        `{ error }` — nên bảng chưa tồn tại / cột lạ / RLS chặn đều im lặng
        tuyệt đối. Cùng khuôn `logActivity nuốt lỗi` đã ghi trong memory.

    LUẬT: nuốt lỗi thì được (nhiều chỗ ĐÚNG là phải nuốt — sổ phụ hỏng không
    được làm hỏng việc chính), nhưng phải ĐỂ LẠI DẤU VẾT tra được.
    `catch { console.error(...) }` là đủ; `catch { }` thì không.

    NỢ CŨ: vài route có sẵn khuôn này từ trước và thuộc phạm vi người khác —
    liệt kê trong `LEGACY` để cổng ăn được NGAY cho mọi route mới/đã sửa, thay
    vì hoãn cổng lại tới lúc dọn xong. Danh sách này CHỈ ĐƯỢC NGẮN ĐI. */

const API_DIR = join(process.cwd(), "src", "app", "api");

/** Route còn NỢ khuôn này — dọn được thì xoá khỏi đây, KHÔNG được thêm vào. */
const LEGACY = new Set([
  "/admin/accounts",
  "/admin/health",
  "/cron/refresh-weather",
]);

function routeFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...routeFilesUnder(p));
    else if (name === "route.ts") out.push(p);
  }
  return out;
}

/** `/api/...` của một file route (để đối chiếu với LEGACY) */
function routePath(file: string): string {
  return file
    .slice(API_DIR.length)
    .replace(/\\/g, "/")
    .replace(/\/route\.ts$/, "");
}

/**
 * Các khối `catch` NUỐT CÂM trong một đoạn mã: thân rỗng, hoặc chỉ có chú thích.
 *
 * Cố ý KHÔNG bóc chú thích trước khi quét (khác `api-error-status.test.ts`):
 * ở đây chú thích CHÍNH LÀ thứ cần nhìn thấy — `catch { /* bỏ qua *\/ }` vẫn là
 * nuốt câm, lời giải thích không thay được một dòng log.
 */
export function silentCatches(src: string): string[] {
  const out: string[] = [];
  const re = /catch\s*(\([^)]*\))?\s*\{([\s\S]*?)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const body = m[2]
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "")
      .trim();
    if (body === "") out.push(m[0].replace(/\s+/g, " ").slice(0, 60));
  }
  return out;
}

describe("route API không được nuốt lỗi câm lặng", () => {
  const files = routeFilesUnder(API_DIR);

  it("có tìm thấy route để soi (đường dẫn không lệch)", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  /*  CA ĐỐI CHỨNG — để cổng không CHẾT CÂM. Bộ dò hỏng (đổi regex, đổi cách bóc
      chú thích) mà không ai biết thì cổng vẫn "xanh" trên mọi route và ta lại
      tưởng mình được gác. Hai ca dưới khoá cả hai chiều. */
  it("bộ dò BẮT được khuôn xấu (rỗng · chỉ có chú thích)", () => {
    expect(silentCatches("try { a(); } catch {}").length).toBe(1);
    expect(silentCatches("try { a(); } catch { /* bo qua */ }").length).toBe(1);
    expect(silentCatches("try { a(); } catch (e) {\n// thoi\n}").length).toBe(1);
  });

  it("bộ dò KHÔNG báo oan khi có dấu vết tra được", () => {
    expect(silentCatches("try { a(); } catch { console.error(e); }")).toEqual([]);
    expect(
      silentCatches("try { a(); } catch (e) { /* sổ phụ */ console.error(e); }"),
    ).toEqual([]);
  });

  for (const file of files) {
    const p = routePath(file);
    if (LEGACY.has(p)) continue;
    it(`/api${p} — lỗi phải để lại dấu vết (console), không nuốt câm`, () => {
      const hits = silentCatches(readFileSync(file, "utf8"));
      expect(
        hits,
        `catch nuốt câm — thêm console.error để còn tra được: ${hits.join(" · ")}`,
      ).toEqual([]);
    });
  }

  it("danh sách NỢ CŨ chỉ được ngắn đi, không được dài ra", () => {
    expect(LEGACY.size).toBeLessThanOrEqual(3);
    // và mọi đường dẫn trong danh sách phải còn tồn tại (không để rác)
    const all = new Set(files.map(routePath));
    for (const p of LEGACY) expect(all.has(p)).toBe(true);
  });
});
