import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  demChu,
  NHAN,
  NHAN_CHIP_KAIROS,
  NHAN_LOAI_TIN,
  NHAN_TOI_DA_CHU,
  nhanHopLe,
} from "@/lib/labels";
import { CHIPS } from "@/lib/kairos/thoi-quen";

/*
  CỔNG NHÃN (2026-10-29 — trước đây chỉ hook pre-commit WARN nên nhãn dài vẫn lọt ≥25 chỗ).
  Quét CHỮ TRẦN (JsxText) nằm trực tiếp trong <button>/<Link>/<a>/<PrimaryButton> ở src/app +
  src/components:
    1. ≤2 chữ (demChu — số/dấu không tính, "Sen Biển" là một tên);
    2. phải TRÙNG một nhãn trong labels.ts (NHAN / NHAN_CHIP_KAIROS / NHAN_LOAI_TIN, không phân
       biệt hoa thường, bỏ số/dấu) — một chính tả, một tên: "Xóa"/"Hủy" lệch NHAN là đỏ.
  Bỏ qua liên kết NẰM GIỮA CÂU (cha có chữ trần khác) — đó là chữ đọc, không phải nhãn nút.
  Chữ đặt qua biểu thức ({NHAN.x}, {cond ? … : …}) không quét ở đây — dùng NHAN là đúng luật.
  Thêm (2026-10-29 đợt nốt nợ): NHÃN TRUYỀN QUA PROP của nút dùng chung (PROP_NHAN — prop
  hiện thành chữ trên nút, KHÔNG phải aria-label như CloseButton/IconNut): mọi chuỗi trần
  trong giá trị prop (kể cả hai nhánh `a ? "x" : "y"`) và giá trị MẶC ĐỊNH của prop ở chỗ
  khai component đều qua đúng hai luật trên.
*/
const SRC = join(process.cwd(), "src");
const THE_NUT = new Set(["button", "Link", "a", "PrimaryButton"]);

/** Khu/tệp miễn quét — có lý do. */
const MIEN_KHU: [RegExp, string][] = [
  [/^(components\/admin\/|app\/quan-tri\/|app\/dev\/)/, "khu quản trị/dev cho nhân viên trên máy tính, không phải màn bà con"],
  [/^components\/(departure-checklist|fines-lookup|my-orders|sea-forecast|supply-catalog)\.tsx$/, "tệp giữ lại nhưng không màn nào gắn (CLAUDE.md Trục 4 / rà C §19)"],
];

/** Từng nút ngoại lệ: tệp + đoạn chữ — không phải NHÃN mà là câu/số liệu chạm được. */
const NGOAI_LE: [string, string, string][] = [
  ["components/ban-do/che-do-ais.tsx", "Chưa tải được vị trí tàu", "băng lỗi chạm-để-thử-lại: chữ là câu báo, không phải nhãn"],
  ["components/ban-do/tau-quanh.tsx", "Chưa tải được vị trí tàu", "băng lỗi chạm-để-thử-lại (thẻ Tàu quanh đây)"],
  ["components/ra-khoi-controls.tsx", "Chưa tải được vị trí tàu", "băng lỗi chạm-để-thử-lại"],
  ["components/ra-khoi-controls.tsx", "Chưa tải được mật độ tàu", "băng lỗi chạm-để-thử-lại"],
  ["components/kairos/comment-thread.tsx", "Chưa tải được bình luận", "băng lỗi, nhãn hành động là {NHAN.thuLai}"],
  ["components/storm-early-banner.tsx", "chạm xem", "băng tin bão sớm: câu tin + gợi ý chạm"],
  ["components/kairos/user-profile.tsx", "người theo dõi", "số liệu \"N người theo dõi\" chạm mở danh sách (khuôn FB)"],
  ["components/kairos/user-profile.tsx", "đang theo dõi", "số liệu \"N đang theo dõi\" chạm mở danh sách"],
  ["components/kairos/user-profile.tsx", "Bà con muốn chia sẻ gì?", "ô viết giả (gợi ý như placeholder), không phải nhãn"],
  ["components/market/buyer/market-search.tsx", "Không thấy đúng món?", "hàng gợi ý cả câu kèm từ khoá đang tìm"],
  ["components/kairos/post-card.tsx", "Bến", "tên nơi chốn \"Bến X\" (tên riêng cảng)"],
];

/** Nút dùng chung: tên component → các prop hiện thành CHỮ trên nút. */
const PROP_NHAN: Record<string, string[]> = {
  CallButton: ["label"],
  SdvicoRequestButton: ["label"],
  RailBtn: ["label"],
  SheetActions: ["okLabel"],
};

const chuan = (s: string) =>
  s.replace(/[0-9.,:;!?/()·—–+\-“”"…]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
const HOP_LE = new Set(
  [...Object.values(NHAN), ...Object.values(NHAN_CHIP_KAIROS), ...Object.values(NHAN_LOAI_TIN)].map(chuan),
);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

/** Chữ trần trong các nút của một tệp .tsx: [dòng, chữ]. */
function chuTranTrongNut(ten: string, src: string): [number, string][] {
  const sf = ts.createSourceFile(ten, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const ra: [number, string][] = [];
  const coChu = (n: ts.Node) => ts.isJsxText(n) && /\p{L}/u.test(n.getText(sf));
  const tham = (n: ts.Node) => {
    if (ts.isJsxElement(n) && THE_NUT.has(n.openingElement.tagName.getText(sf))) {
      const chu = n.children.filter(ts.isJsxText).map((c) => c.getText(sf)).join(" ").replace(/\s+/g, " ").trim();
      const cha = n.parent;
      const giuaCau = ts.isJsxElement(cha) && cha.children.some((c) => c !== n && coChu(c));
      if (chu && /\p{L}/u.test(chu) && !giuaCau) {
        ra.push([sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, chu]);
      }
    }
    ts.forEachChild(n, tham);
  };
  tham(sf);
  return ra;
}

/** Chuỗi trần trong một biểu thức (nhánh không phải chuỗi bỏ qua — {NHAN.x} là đúng luật). */
function chuoiTran(n: ts.Node): string[] {
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return [n.text];
  if (ts.isJsxExpression(n) || ts.isParenthesizedExpression(n)) return n.expression ? chuoiTran(n.expression) : [];
  if (ts.isConditionalExpression(n)) return [...chuoiTran(n.whenTrue), ...chuoiTran(n.whenFalse)];
  if (
    ts.isBinaryExpression(n) &&
    (n.operatorToken.kind === ts.SyntaxKind.BarBarToken || n.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
  )
    return [...chuoiTran(n.left), ...chuoiTran(n.right)];
  return [];
}

/** Nhãn qua prop của nút dùng chung + mặc định của prop ở chỗ khai: [dòng, chữ]. */
function nhanQuaProp(ten: string, src: string): [number, string][] {
  const sf = ts.createSourceFile(ten, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const ra: [number, string][] = [];
  const dong = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const tham = (n: ts.Node) => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const props = PROP_NHAN[n.tagName.getText(sf)];
      for (const a of props ? n.attributes.properties : []) {
        if (ts.isJsxAttribute(a) && a.initializer && props.includes(a.name.getText(sf))) {
          for (const c of chuoiTran(a.initializer)) ra.push([dong(a), c]);
        }
      }
    }
    if (ts.isFunctionDeclaration(n) && n.name && PROP_NHAN[n.name.text]) {
      const props = PROP_NHAN[n.name.text];
      const p0 = n.parameters[0];
      for (const e of p0 && ts.isObjectBindingPattern(p0.name) ? p0.name.elements : []) {
        if (e.initializer && props.includes((e.propertyName ?? e.name).getText(sf))) {
          for (const c of chuoiTran(e.initializer)) ra.push([dong(e), c]);
        }
      }
    }
    ts.forEachChild(n, tham);
  };
  tham(sf);
  return ra;
}

describe("labels — bảng nhãn chuẩn ≤2 chữ (anh Long 2026-10-19)", () => {
  it("mọi nhãn trong bảng ≤2 chữ, không rỗng, không trùng", () => {
    const vals = Object.values(NHAN);
    for (const v of vals) {
      expect(v.trim(), v).toBe(v);
      expect(demChu(v), `"${v}" quá ${NHAN_TOI_DA_CHU} chữ`).toBeLessThanOrEqual(NHAN_TOI_DA_CHU);
    }
    expect(new Set(vals).size).toBe(vals.length);
  });

  it("đếm chữ: số và dấu không tính, 'Sen Biển' là một tên", () => {
    expect(demChu("Xem thêm")).toBe(2);
    expect(demChu("Xem thêm 19")).toBe(2);
    expect(demChu("Tin mua/bán")).toBe(3);
    expect(demChu("Gọi Sen Biển")).toBe(2);
    expect(demChu("Yêu cầu gia hạn của tôi")).toBe(6);
    expect(nhanHopLe("Đăng nhập")).toBe(true);
    expect(nhanHopLe("Tạo tài khoản")).toBe(false);
  });

  it("chip Kairos: đủ mã chip, mỗi nhãn ≤2 chữ, không trùng (AC03)", () => {
    expect(Object.keys(NHAN_CHIP_KAIROS).sort()).toEqual([...CHIPS].sort());
    const vals = Object.values(NHAN_CHIP_KAIROS);
    for (const v of vals) expect(nhanHopLe(v), v).toBe(true);
    expect(new Set(vals).size).toBe(vals.length);
  });

  it("cổng: chữ trần trong nút ≤2 chữ và trùng một nhãn của labels.ts", () => {
    const loi: string[] = [];
    const daDung = new Set<number>();
    for (const f of walk(SRC)) {
      if (!f.endsWith(".tsx") || f.includes("__tests__")) continue;
      const rel = f.slice(SRC.length + 1).replace(/\\/g, "/");
      if (MIEN_KHU.some(([re]) => re.test(rel))) continue;
      for (const [dong, chu] of chuTranTrongNut(rel, readFileSync(f, "utf8"))) {
        const nl = NGOAI_LE.findIndex(([tep, doan]) => tep === rel && chu.includes(doan));
        if (nl >= 0) {
          daDung.add(nl);
          continue;
        }
        if (!nhanHopLe(chu)) loi.push(`${rel}:${dong} "${chu}" quá ${NHAN_TOI_DA_CHU} chữ`);
        else if (!HOP_LE.has(chuan(chu))) loi.push(`${rel}:${dong} "${chu}" chưa có trong NHAN (labels.ts)`);
      }
    }
    expect(loi, "đổi sang {NHAN.x} — 03 §Nhãn").toEqual([]);
    // ngoại lệ hết dùng thì gỡ — danh sách chỉ được co lại
    const thua = NGOAI_LE.filter((_, i) => !daDung.has(i)).map(([t, d]) => `${t} "${d}"`);
    expect(thua, "ngoại lệ không còn khớp chỗ nào — gỡ khỏi NGOAI_LE").toEqual([]);
  });

  it("cổng: nhãn truyền qua prop của nút dùng chung (CallButton label=…) ≤2 chữ và có trong NHAN", () => {
    const loi: string[] = [];
    for (const f of walk(SRC)) {
      if (!f.endsWith(".tsx") || f.includes("__tests__")) continue;
      const rel = f.slice(SRC.length + 1).replace(/\\/g, "/");
      if (MIEN_KHU.some(([re]) => re.test(rel))) continue;
      for (const [dong, chu] of nhanQuaProp(rel, readFileSync(f, "utf8"))) {
        if (!nhanHopLe(chu)) loi.push(`${rel}:${dong} "${chu}" quá ${NHAN_TOI_DA_CHU} chữ`);
        else if (!HOP_LE.has(chuan(chu))) loi.push(`${rel}:${dong} "${chu}" chưa có trong NHAN (labels.ts)`);
      }
    }
    expect(loi, "đổi sang label={NHAN.x} — 03 §Nhãn").toEqual([]);
  });

  it("bộ quét prop: chuỗi trần, hai nhánh điều kiện và mặc định bị bắt; {NHAN.x} và aria-label qua", () => {
    expect(nhanQuaProp("a.tsx", `const A = () => <CallButton phone="1" label="Gọi hỏi giá" />;`)).toEqual([[1, "Gọi hỏi giá"]]);
    expect(nhanQuaProp("a.tsx", `const A = () => <SheetActions okLabel={busy ? "Đang gửi…" : NHAN.gui} />;`)).toEqual([[1, "Đang gửi…"]]);
    expect(nhanQuaProp("a.tsx", `const A = () => <CallButton phone="1" label={NHAN.goi} />;`)).toEqual([]);
    expect(nhanQuaProp("a.tsx", `const A = () => <CloseButton label="Đóng chú giải dài" />;`)).toEqual([]);
    expect(nhanQuaProp("a.tsx", `export function CallButton({ label = "Gọi tổng đài" }) { return null; }`)).toEqual([[1, "Gọi tổng đài"]]);
  });

  it("bộ quét: nút có chữ trần bị bắt, liên kết giữa câu và {NHAN.x} thì qua", () => {
    expect(chuTranTrongNut("a.tsx", `const A = () => <button>Lưu ghi chú</button>;`)).toEqual([[1, "Lưu ghi chú"]]);
    expect(chuTranTrongNut("a.tsx", `const A = () => <button><X /> {NHAN.luu}</button>;`)).toEqual([]);
    expect(chuTranTrongNut("a.tsx", `const A = () => <p>Đồng ý với <Link href="/">Chính sách quyền riêng tư</Link>.</p>;`)).toEqual([]);
    expect(HOP_LE.has(chuan("Xem giỏ (3)"))).toBe(true);
    expect(HOP_LE.has(chuan("Xóa"))).toBe(false);
  });
});
