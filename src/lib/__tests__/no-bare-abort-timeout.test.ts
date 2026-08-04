import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

/*  CỔNG CHẶN CẢ KHUÔN: **KHÔNG GỌI `AbortSignal.timeout(` TRẦN** trong `src/`.

    VÌ SAO CÓ (2026-08-02): `AbortSignal.timeout` là hàm tĩnh chỉ có từ
    Safari 16 / Chrome 103. iPhone của bà con còn kẹt iOS 15.8 (= Safari 15) và
    WebView Android đời cũ KHÔNG có nó ⇒ gọi thẳng là ném
    `TypeError: AbortSignal.timeout is not a function`.

    Chỗ chết người nhất đã bắt được: `lib/depth-grid.ts` — `fetchDepthGrid`
    KHÔNG phải hàm `async` nhưng trả `Promise`, nên cú ném bay ĐỒNG BỘ ra khỏi
    thân hàm TRƯỚC khi promise kịp tồn tại ⇒ `.catch` của chỗ gọi không với tới
    ⇒ cây React sập, bản đồ trắng cả chuyến biển. Ở những chỗ khác thì nhẹ hơn
    nhưng vẫn tệ: `TypeError` đội lốt "mất sóng", máy đó KHÔNG BAO GIỜ tải nổi
    dự báo mới mà chẳng ai hiểu vì sao (đã thấy ở `use-tier`: vòng thử lại 10
    phút vĩnh viễn).

    Bản vá đợt trước ĐÃ viết đúng hàm cần viết — `timeoutSignal(ms)` — rồi để
    nó nằm private trong một file (biên bản soát gọi là *"biết khuôn, viết ra
    khuôn, và không áp khuôn"*). Cổng này là chỗ áp khuôn: chỉ `src/lib/abort.ts`
    được nhắc tên `AbortSignal.timeout`, mọi nơi khác phải đi qua `timeoutSignal`
    (không bao giờ ném, có ĐƯỜNG LÙI THẬT bằng `AbortController`).

    Cổng quét-bằng-chữ mà không có CA ĐỐI CHỨNG thì không đo gì cả (bài học đã
    ghi trong biên bản soát): bộ dò hỏng, đường dẫn lệch, hay regex sai thì cổng
    vẫn "xanh" trong khi lỗi nằm nguyên đó. Nên bên dưới có đủ ba loại ca:
    (a) chuỗi mẫu CÓ lỗi ⇒ cổng phải BẮT ĐƯỢC;
    (b) chuỗi mẫu chỉ nhắc tên trong chú thích/chuỗi ⇒ cổng KHÔNG được báo;
    (c) số file quét được phải > 100 ⇒ cổng không quét nhầm thư mục rỗng.  */

const SRC = join(process.cwd(), "src");

/** File DUY NHẤT được phép nhắc `AbortSignal.timeout` — nơi định nghĩa. */
const ALLOW = new Set(["lib/abort.ts"]);

/**
 * Xoá comment + RUỘT chuỗi (giữ nguyên số ký tự và số dòng) để không báo động
 * vì một dòng chú thích hay một chuỗi có nhắc tên hàm.
 *
 * Bản sao NGUYÊN VĂN của `blank()` trong `api-error-status.test.ts` — đã chạy
 * thật ở cổng đó, cố ý KHÔNG viết lại bộ dò mới (import chéo giữa hai file test
 * sẽ kéo theo cả `describe` của file kia).
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

/** Cho khoảng trắng chen vào giữa (`AbortSignal . timeout (`) vẫn bị bắt. */
const BARE = /\bAbortSignal\s*\.\s*timeout\s*\(/g;

export interface BareHit {
  line: number;
  snippet: string;
}

/** Mọi lời gọi `AbortSignal.timeout(` TRẦN trong mã (đã bỏ chú thích + chuỗi). */
function scanBareTimeout(src: string): BareHit[] {
  const clean = blank(src);
  const hits: BareHit[] = [];
  BARE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BARE.exec(clean))) {
    const line = clean.slice(0, m.index).split("\n").length;
    hits.push({
      line,
      snippet: src.split("\n")[line - 1]?.trim().slice(0, 120) ?? "",
    });
  }
  return hits;
}

function walk(dir: string, hit: (f: string) => void): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, hit);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".d.ts")) hit(p);
  }
}

function sourceFiles(): string[] {
  const out: string[] = [];
  walk(SRC, (f) => out.push(f));
  return out;
}

const rel = (f: string) => relative(SRC, f).split(sep).join("/");

describe("bộ dò AbortSignal.timeout (ca đối chứng)", () => {
  it("BẮT ĐƯỢC lời gọi trần trong mã thật", () => {
    const sample = [
      "async function f() {",
      "  const r = await fetch(url, { signal: AbortSignal.timeout(5000) });",
      "  return r;",
      "}",
    ].join("\n");
    const hits = scanBareTimeout(sample);
    expect(hits).toHaveLength(1);
    expect(hits[0].line).toBe(2);
  });

  it("BẮT ĐƯỢC cả khi có khoảng trắng chen giữa", () => {
    expect(scanBareTimeout("const s = AbortSignal . timeout (1000);")).toHaveLength(
      1,
    );
  });

  it("KHÔNG báo khi tên chỉ nằm trong chú thích hoặc chuỗi", () => {
    const sample = [
      "// AbortSignal.timeout(5000) chưa có trên Safari 15",
      "/* dùng AbortSignal.timeout(1) là sai */",
      'const msg = "AbortSignal.timeout(2) không dùng được";',
      "const s = timeoutSignal(3000);",
    ].join("\n");
    expect(scanBareTimeout(sample)).toEqual([]);
  });
});

describe("mọi lời gọi mạng đi qua timeoutSignal", () => {
  const files = sourceFiles();

  it("quét được đủ file source (đường dẫn không lệch)", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("file định nghĩa vẫn còn và vẫn có đường lùi AbortController", () => {
    const abort = join(SRC, "lib", "abort.ts");
    expect(existsSync(abort)).toBe(true);
    const src = readFileSync(abort, "utf8");
    expect(src).toContain("export function timeoutSignal");
    // đường lùi THẬT — không được rút gọn thành `return undefined`
    expect(src).toContain("new AbortController()");
  });

  it("KHÔNG file nào ngoài lib/abort.ts gọi AbortSignal.timeout trần", () => {
    const bad: string[] = [];
    for (const f of files) {
      const r = rel(f);
      if (ALLOW.has(r)) continue;
      for (const h of scanBareTimeout(readFileSync(f, "utf8"))) {
        bad.push(`${r}:${h.line}  ${h.snippet}`);
      }
    }
    expect(
      bad,
      [
        "Gọi `AbortSignal.timeout(` trần — máy cũ (Safari 15 / WebView Android đời",
        "cũ) ném TypeError ngay tại dòng này. Dùng:",
        '  import { timeoutSignal } from "@/lib/abort";',
        "  fetch(url, { signal: timeoutSignal(MS) })",
        "Với Supabase (`.abortSignal()` không nhận undefined sạch):",
        "  const s = timeoutSignal(MS);",
        "  let q = supabase.from(...)...;",
        "  if (s) q = q.abortSignal(s);",
        "",
        bad.join("\n"),
      ].join("\n"),
    ).toEqual([]);
  });

  it("KHÔNG ai tự khai một `timeoutSignal` riêng (bản riêng hay mất đường lùi)", () => {
    // sea.ts từng có bản private chỉ trả `undefined` khi thiếu API ⇒ MẤT trần
    // thời gian trên đúng những máy cần nó nhất. Đã xoá, và chặn tái phát.
    const bad: string[] = [];
    for (const f of files) {
      const r = rel(f);
      if (ALLOW.has(r)) continue;
      const clean = blank(readFileSync(f, "utf8"));
      if (/\b(?:function|const|let|var)\s+timeoutSignal\b/.test(clean)) bad.push(r);
    }
    expect(
      bad,
      `Khai lại \`timeoutSignal\` cục bộ — import từ "@/lib/abort" thay vì viết bản riêng:\n${bad.join("\n")}`,
    ).toEqual([]);
  });
});
