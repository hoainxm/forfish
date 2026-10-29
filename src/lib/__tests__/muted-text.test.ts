/*
  CỔNG CHỮ PHỤ (anh Long 2026-10-29: "chữ cho nhỏ đẹp chứ không phải cứ phóng to lên
  thô kệch") — chữ nhỏ gọn, tương phản sửa bằng MÀU. Mực `text-foreground/40…/60` chỉ
  đạt 2,3–3,9:1 (dưới AA 4,5:1) ⇒ chữ phải dùng token `text-muted` (globals.css
  `--muted`, mực 72%, ≥4,95:1 trên mọi nền sáng của app — 03 §0).

  Cổng quét src/ (.ts/.tsx): mọi `text-foreground/(40|45|50|55|60)` KHÔNG có tiền tố
  (placeholder:/hover:… là chuyện khác) phải nằm trên ICON — phần tử `<…Icon>`/`<svg>`,
  hoặc khung chỉ bọc đúng một icon. Còn lại là chữ ⇒ đỏ.
*/
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(process.cwd(), "src");
// không dùng lookbehind (safari-cu.test.ts) — nhóm 1 là ký tự đứng trước
const MO = /(^|[^\w:/-])text-foreground\/(40|45|50|55|60)(?![\w/])/g;

/** Ngoại lệ CÓ LÝ DO — đường dẫn tương đối từ src/. */
const NGOAI_LE: Record<string, string> = {
  // Nhóm F (đợt sửa 2026-10-29) đang sửa file này song song; chữ mờ trong đó do nhóm F đổi.
  // nợ: còn 9 chỗ chữ /50–/60, gỡ dòng này khi nhóm F gộp.
};

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

/** Vị trí `>` đóng thẻ mở bắt đầu ở `lt`, bỏ qua `>` trong `{…}` và chuỗi. */
function cuoiTheMo(s: string, lt: number): number {
  let sau = 0;
  let nhay: string | null = null;
  for (let i = lt + 1; i < s.length; i++) {
    const c = s[i];
    if (nhay) {
      if (c === nhay && s[i - 1] !== "\\") nhay = null;
      continue;
    }
    if (sau > 0 && (c === '"' || c === "'" || c === "`")) nhay = c;
    else if (c === "{") sau++;
    else if (c === "}") sau--;
    else if (c === ">" && sau === 0) return i;
  }
  return -1;
}

/** Các chỗ chữ mờ (không phải icon) trong một đoạn mã. */
function choChuMo(s: string): number[] {
  const dong: number[] = [];
  for (const m of s.matchAll(MO)) {
    const i = (m.index ?? 0) + m[1].length;
    const lt = s.lastIndexOf("<", i);
    const the = (s.slice(lt + 1).match(/^[A-Za-z0-9_.]+/) ?? [""])[0];
    if (/Icon$|^svg$|^path$/.test(the)) continue;
    const het = cuoiTheMo(s, lt);
    if (het > i && s[het - 1] !== "/") {
      const bocIcon = new RegExp(`^\\s*<[A-Z][A-Za-z0-9]*Icon\\b[^>]*/>\\s*</${the}>`);
      if (bocIcon.test(s.slice(het + 1, het + 400))) continue;
    }
    dong.push(s.slice(0, i).split("\n").length);
  }
  return dong;
}

describe("chữ phụ dùng token text-muted, không mực mờ /40–/60", () => {
  it("bộ nhận diện: chữ đỏ, icon và khung bọc icon qua", () => {
    expect(choChuMo(`<p className="text-foreground/55">Giờ</p>`)).toEqual([1]);
    expect(choChuMo(`<span className={\`a \${x ? "b" : "c"} text-foreground/60\`}>{t}</span>`)).toEqual([1]);
    expect(choChuMo(`<ChevronRightIcon className="h-4 w-4 text-foreground/50" />`)).toEqual([]);
    expect(choChuMo(`<span className="text-foreground/50" aria-hidden>\n  <ClockIcon className="h-4 w-4" />\n</span>`)).toEqual([]);
    expect(choChuMo(`<input className="placeholder:text-foreground/50" />`)).toEqual([]);
    expect(choChuMo(`<p className="text-foreground/65">ok</p>`)).toEqual([]);
  });

  it("không còn chữ /40–/60 trong src/ (ngoài danh sách ngoại lệ)", () => {
    const loi: string[] = [];
    for (const f of walk(SRC)) {
      if (!/\.tsx?$/.test(f) || f.includes("__tests__")) continue;
      const rel = f.slice(SRC.length + 1).replace(/\\/g, "/");
      if (NGOAI_LE[rel]) continue;
      for (const d of choChuMo(readFileSync(f, "utf8"))) loi.push(`${rel}:${d}`);
    }
    expect(loi, "đổi sang text-muted (03 §0)").toEqual([]);
  });

  it("token --muted khai ở globals.css và nối vào @theme", () => {
    const css = readFileSync(join(SRC, "app/globals.css"), "utf8");
    expect(css).toMatch(/--muted:\s*rgb\(var\(--foreground-rgb\)\s*\/\s*0\.72\)/);
    expect(css).toMatch(/--color-muted:\s*var\(--muted\)/);
  });
});
