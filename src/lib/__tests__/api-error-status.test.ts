import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { API_CACHE_ALLOW } from "@/lib/sw-cache-policy";

/*  CỔNG CHẶN CẢ KHUÔN, KHÔNG VÁ TỪNG ĐIỂM (2026-08-02, audit K2).
    Khuôn lỗi: route trả `Response.json({ ok: false })` — mặc định HTTP **200** —
    khi nguồn hỏng. Service worker chỉ cất phản hồi `res.ok`, nên một lúc nguồn
    bảo trì trong khi tàu còn sóng ở cảng là ĐÈ MẤT bản tốt bà con đã tải. Với
    /api/fish-forecast thì bản trong kho service worker là bản DUY NHẤT (client
    chỉ lưu DẤU), nên đè là mất vĩnh viễn: ra khơi lớp cá trắng cả chuyến.
    Đã dính 3 lần ở 3 route khác nhau (storms 2026-07-31, rồi fish-forecast +
    sea-scalar 2026-08-02).

    ─── SIẾT LẠI 2026-08-02 (audit vòng 2, K2) ────────────────────────────────
    Cổng đời đầu soi bằng một regex `Response.json({… ok:false …})` và có BỐN
    ĐƯỜNG LÁCH, cái nào cũng làm nó xanh trong khi lỗi quay lại nguyên xi:
      (1) RÚT RA BIẾN — `const b = { ok:false }; return Response.json(b)`:
          không còn literal nào để regex bắt.
      (2) CA SỐNG — `sea-scalar/route.ts:22` đang viết
          `Response.json(data, data.ok ? undefined : { status: 503 })`. Ai
          "gọn hoá" thành `Response.json(data)` là mất sạch mã lỗi mà hai cổng
          vẫn xanh.
      (3) OBJECT LỒNG — `[^{}]*` không cho ngoặc nhọn bên trong, nên
          `{ ok:false, detail:{ src:"om" } }` TRƯỢT cổng (false-negative sẵn có).
      (4) KHÔNG QUÉT `NextResponse.json(` (salinity, nautical đang dùng) và
          `new Response(JSON.stringify(…))`.

    Nay đảo sang WHITELIST, không đoán nội dung nữa: với route nằm trong
    `API_CACHE_ALLOW`, MỌI lời gọi `Response.json(` / `NextResponse.json(` /
    `new Response(` **thiếu đối số thứ hai** đều bị tính là "trả 200 câm" —
    không cần biết body là literal, biến, hay ba tầng object. Muốn cho qua thì
    ghi rõ `// ok:200` trên cùng dòng (đường thoát cho chỗ 200 THẬT), hoặc nằm
    trong NGÂN SÁCH đã ghi bên dưới. Ngân sách là RATCHET: thêm một chỗ 200 câm
    mới ⇒ đỏ; bỏ bớt ⇒ cũng đỏ (bảng phải nói đúng hiện trạng).

    Chỉ soi route nằm trong `API_CACHE_ALLOW` — route không được cache thì trả
    200 kèm {ok:false} không gây mất dữ liệu (dù vẫn không đẹp).  */

const API_DIR = join(process.cwd(), "src", "app", "api");

/**
 * Xoá comment + RUỘT chuỗi (giữ nguyên số ký tự và số dòng) để đếm ngoặc/dấu
 * phẩy không bị URL, chú thích hay chuỗi có ngoặc đánh lừa.
 */
function blank(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === "/" && d === "/") {
      while (i < n && src[i] !== "\n") {
        out += " ";
        i++;
      }
      continue;
    }
    if (c === "/" && d === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end === -1 ? n : end + 2;
      for (; i < stop; i++) out += src[i] === "\n" ? "\n" : " ";
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      out += c;
      i++;
      while (i < n) {
        if (src[i] === "\\") {
          out += "  ";
          i += 2;
          continue;
        }
        if (src[i] === c) {
          out += c;
          i++;
          break;
        }
        // chuỗi thường không qua được xuống dòng — gặp là chuỗi hỏng, thoát ra
        if (src[i] === "\n" && c !== "`") break;
        out += src[i] === "\n" ? "\n" : " ";
        i++;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** Từ dấu `(` mở: có dấu phẩy ở MỨC NGOÀI CÙNG không (= có đối số thứ hai). */
function hasSecondArg(clean: string, openIdx: number): boolean {
  let depth = 0;
  let comma = false;
  for (let i = openIdx; i < clean.length; i++) {
    const c = clean[i];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") {
      depth--;
      if (depth === 0) return comma;
    } else if (c === "," && depth === 1) comma = true;
  }
  return comma;
}

export interface PlainJsonHit {
  line: number;
  snippet: string;
}

/**
 * Mọi chỗ dựng phản hồi JSON mà KHÔNG nói mã HTTP (⇒ 200 câm).
 * Bỏ qua dòng có ghi chú `// ok:200`.
 */
function scanPlainJsonResponses(src: string): PlainJsonHit[] {
  const okLines = new Set<number>();
  src.split("\n").forEach((l, idx) => {
    if (/\/\/\s*ok:200\b/.test(l)) okLines.add(idx + 1);
  });
  const clean = blank(src);
  const hits: PlainJsonHit[] = [];
  const CALL = /\b(?:Next)?Response\s*\.\s*json\s*\(|\bnew\s+Response\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = CALL.exec(clean)) !== null) {
    const open = clean.indexOf("(", m.index + m[0].length - 1);
    if (open < 0) continue;
    if (hasSecondArg(clean, open)) continue;
    const line = clean.slice(0, m.index).split("\n").length;
    if (okLines.has(line)) continue;
    hits.push({
      line,
      snippet: src.split("\n")[line - 1]?.trim().slice(0, 80) ?? "",
    });
  }
  return hits;
}

/*  NGÂN SÁCH 200-CÂM ĐANG CÓ — mỗi con số là một lời hứa "chỗ này CHẮC CHẮN là
    đường THÀNH CÔNG". Thêm chỗ mới ⇒ cổng đỏ, và người thêm phải hoặc kèm
    `{ status: … }`, hoặc ghi `// ok:200` để nói rõ mình đã nghĩ tới chuyện
    service worker sẽ cất phản hồi này. KHÔNG được nâng số cho xanh mà không
    đọc lại đúng nhánh đó.  */
const PLAIN_BUDGET: Record<string, number> = {
  "/api/fish-forecast": 3, // 3 nhánh trả snapshot/live ĐÃ qua cửa `.ok`
  "/api/storms": 1, // nhánh dựng bản tin bão thành công
  "/api/weather-snapshot": 0,
  "/api/salinity": 1, // `{ ok: true, ...data }`
  "/api/sea-scalar": 0, // đang dùng `data.ok ? undefined : { status: 503 }`
  "/api/currents-depth": 0,
  "/api/nautical": 0,
  "/api/port-prices": 1, // một nhánh `{ ok: true, … }` (bảng giá tuần)
  "/api/port-prices/history": 2, // hai nhánh `{ ok: true, … }` (db + vasep)
  "/api/fuel-price": 1, // `{ ok: true, fuel }`
};

function routeFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...routeFilesUnder(p));
    else if (name === "route.ts") out.push(p);
  }
  return out;
}

function apiPathOf(file: string): string {
  const rel = file
    .slice(API_DIR.length)
    .replace(/\\/g, "/")
    .replace(/\/route\.ts$/, "");
  return `/api${rel}`;
}

/** Route này có nằm dưới một tiền tố được service worker cache không */
function isCacheable(file: string): boolean {
  const pathname = apiPathOf(file);
  return API_CACHE_ALLOW.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

describe("route được cache không được trả 200 câm", () => {
  const files = routeFilesUnder(API_DIR).filter(isCacheable);

  it("có tìm thấy route để soi (đường dẫn không lệch)", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it("bảng ngân sách phủ ĐÚNG các route đang được cache", () => {
    expect(files.map(apiPathOf).sort()).toEqual(Object.keys(PLAIN_BUDGET).sort());
  });

  for (const file of files) {
    const pathname = apiPathOf(file);
    it(`${pathname} — nguồn hỏng phải trả mã lỗi thật`, () => {
      const hits = scanPlainJsonResponses(readFileSync(file, "utf8"));
      const detail = hits.map((h) => `dòng ${h.line}: ${h.snippet}`).join("\n");
      expect(
        hits.length,
        `chỗ trả JSON không kèm { status: … } (thêm status, hoặc ghi // ok:200 nếu đây CHẮC CHẮN là đường thành công):\n${detail}`,
      ).toBe(PLAIN_BUDGET[pathname] ?? 0);
    });
  }
});

/*  CHỐNG SUY BIẾN — cổng phải TỰ CHỨNG MINH nó còn đo được thứ cần đo. Không có
    khối này thì một hôm nào đó regex hỏng, mọi ca trên vẫn xanh vì không bắt
    được gì, và ai cũng tưởng repo sạch.  */
describe("cổng có thật sự bắt được khuôn lỗi không", () => {
  const cases: [string, string, number][] = [
    ["rút ra biến", `const b={ok:false};\nreturn Response.json(b)`, 1],
    [
      "object LỒNG (regex cũ trượt)",
      `return Response.json({ ok:false, detail:{ src:"om" } })`,
      1,
    ],
    ["NextResponse", `return NextResponse.json({ ok:false })`, 1],
    [
      "new Response(JSON.stringify(…))",
      `return new Response(JSON.stringify({ ok:false }))`,
      1,
    ],
    [
      "GỌN HOÁ sea-scalar (ca sống)",
      `return Response.json(data)`,
      1,
    ],
    // ĐƯỢC PHÉP: có mã lỗi thật, hoặc nói rõ đây là 200 thật
    ["có status", `return Response.json({ ok:false }, { status: 503 })`, 0],
    [
      "toán tử ba ngôi vẫn là đối số thứ hai",
      `return Response.json(data, data.ok ? undefined : { status: 503 })`,
      0,
    ],
    ["ghi chú ok:200", `return Response.json(payload) // ok:200`, 0],
    [
      "chuỗi có ngoặc/URL không đánh lừa được",
      `const u="https://x.y/a(b),c"; return Response.json({ ok:false })`,
      1,
    ],
  ];
  for (const [name, src, want] of cases) {
    it(name, () => {
      expect(scanPlainJsonResponses(src)).toHaveLength(want);
    });
  }
});
