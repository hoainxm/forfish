// @vitest-environment jsdom
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { napManhGiong, speechParts, splitSentences } from "@/lib/voice/tts";
import { KHUYEN_MAI } from "@/data/khuyen-mai";

/*
  RÀ SOÁT GIỌNG — câu nào Sen Biển đọc mà còn rơi về GIỌNG MÁY (anh Long 2026-11-06: "rà soát toàn bộ câu hỏi, các
  câu đã dùng, các cảnh báo, xây giọng đọc Mỹ Duyên cho nó hết đi, tránh phải dùng cái giọng máy nó lệch tông").

  KHÔNG phải cổng thường ngày (báo cáo, không đỏ): chạy khi rà lại giọng.

    RA_SOAT_GIONG=<thư mục tạm>/ra-soat.json npx vitest run src/lib/__tests__/ra-soat-giong.test.ts

  Quét chữ cố định trong các file DỰNG CÂU NÓI (cùng cách quét của scripts/sen-bien-giong/lap_manh.mjs) + kho hỏi–đáp
  đã duyệt, cho qua bộ ghép `speechParts`: khúc nào không có mảnh/câu mp3 = đọc giọng máy. Câu thật còn ghép thêm số/tên
  lúc chạy — cổng phủ từng câu nằm ở ghep-giong.test.ts.
*/
const OUT = process.env.RA_SOAT_GIONG;

/** Nguồn câu nói (file dựng câu Sen Biển đọc). Thêm nguồn mới ⇒ thêm vào NGUON của lap_manh.mjs rồi sinh mảnh. */
const NGUON = [
  "src/lib/sen-bien/nhap-giong.ts",
  "src/lib/stracking/doc-canh-bao.mjs",
  "src/lib/sen-bien/cau-vui.ts",
  "src/lib/sen-bien/hoi-dap.ts",
  "src/lib/sen-bien/hoi-kho.ts",
  "src/lib/sen-bien/hoi-san-pham.ts",
  "src/data/khuyen-mai.ts",
  "src/lib/sen-bien/lam-cho.ts",
  "src/lib/sen-bien/lenh-cho.ts",
  "src/lib/sen-bien/luong-tra-loi.ts",
  "src/lib/sen-bien/noi-tiep.ts",
  "src/lib/sen-bien/tra-loi-app.ts",
  "src/lib/sen-bien/goi-ranh-tay.ts",
  "src/lib/sen-bien/hieu-y.ts",
  "src/lib/sen-bien/hoi-ban-do.ts",
  "src/lib/sen-bien/lenh-ban-do.ts",
  "src/lib/sen-bien/lenh-chay.ts",
  "src/lib/nav-voice/events.ts",
  "src/lib/nav-voice/nav-storm.ts",
  "src/lib/nav-voice/opening.ts",
  "src/lib/nav-voice/phrases.ts",
  "src/lib/nav-voice/sea-now.ts",
  "src/lib/nav-voice/cau-dan-duong.ts",
  "src/lib/nav-hazards.ts",
  "src/lib/urgent.ts",
  "src/lib/assistant/answer.ts",
  "src/lib/assistant/chao.ts",
  "src/lib/kairos/tim-tin.ts",
  "src/components/sen-bien-toan-app.tsx",
  "src/components/sen-bien-sheet.tsx",
  "src/components/hoi-tung-cau.tsx",
];

/** Mọi phần chữ cố định của chuỗi '…' "…" `…` (bỏ chú thích) — bản rút gọn của chuoiTrong trong lap_manh.mjs. */
function chuoiTrong(src: string): string[] {
  const out: string[] = [];
  let i = 0;
  const quote = (q: string) => {
    let s = "";
    i++;
    while (i < src.length && src[i] !== q && src[i] !== "\n") {
      if (src[i] === "\\") {
        s += src[i + 1] === "n" ? " " : src[i + 1];
        i += 2;
      } else s += src[i++];
    }
    i++;
    out.push(s);
  };
  const tpl = () => {
    let s = "";
    i++;
    while (i < src.length && src[i] !== "`") {
      if (src[i] === "\\") {
        s += src[i + 1];
        i += 2;
      } else if (src[i] === "$" && src[i + 1] === "{") {
        out.push(s, "|");
        s = "";
        i += 2;
        code(1);
      } else s += src[i++];
    }
    i++;
    out.push(s);
  };
  function code(depth: number) {
    while (i < src.length) {
      const c = src[i];
      if (c === "/" && src[i + 1] === "/") while (i < src.length && src[i] !== "\n") i++;
      else if (c === "/" && src[i + 1] === "*") {
        const e = src.indexOf("*/", i + 2);
        i = e < 0 ? src.length : e + 2;
      } else if (c === '"' || c === "'") quote(c);
      else if (c === "`") tpl();
      else if (c === "{") {
        depth++;
        i++;
      } else if (c === "}") {
        i++;
        if (--depth === 0) return;
      } else i++;
    }
  }
  code(Number.POSITIVE_INFINITY);
  return out;
}

const DAU = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
/** Chuỗi có dáng câu nói (có dấu tiếng Việt, ≥2 chữ, không phải mã/đường dẫn). */
const laCau = (s: string) => DAU.test(s) && s.trim().split(/\s+/).length >= 2 && !/[=<>{}\\]|https?:|^\//.test(s);

type Muc = { nguon: string; cau: string; thieu: string[] };

beforeAll(() => napManhGiong());

describe.skipIf(!OUT)("rà soát giọng — câu còn đọc giọng máy", () => {
  it("quét nguồn + kho, ghi báo cáo", { timeout: 300_000 }, () => {
    const muc: Muc[] = [];
    const xet = (nguon: string, cau: string) => {
      const thieu = speechParts(cau).filter((p) => !p.clips).map((p) => p.text);
      muc.push({ nguon, cau, thieu });
    };
    for (const f of NGUON) {
      const thay = new Set<string>();
      for (const s of chuoiTrong(readFileSync(join(process.cwd(), f), "utf8")))
        for (const c of s.split("|").map((x) => x.replace(/\s+/g, " ").trim()))
          if (laCau(c) && !thay.has(c)) {
            thay.add(c);
            xet(f, c);
          }
    }
    // đọc bằng fs, KHÔNG import JSON từ public/data (cổng data-codec: build Vercel parse bản đã mã)
    const kho = JSON.parse(readFileSync(join(process.cwd(), "public/data/sen-bien-hoi-dap.v2.json"), "utf8")) as { dap: Record<string, string> };
    const dap = Object.values(kho.dap);
    for (const c of dap) xet("kho-hoi-dap", c);

    const tong = new Map<string, { cau: number; thieu: number; amTiet: number }>();
    for (const m of muc) {
      const t = tong.get(m.nguon) ?? { cau: 0, thieu: 0, amTiet: 0 };
      t.cau++;
      if (m.thieu.length) {
        t.thieu++;
        t.amTiet += m.cau.split(/\s+/).length;
      }
      tong.set(m.nguon, t);
    }
    /*  ĐỀ XUẤT CÂU NGUYÊN (thu trọn câu — tự nhiên hơn ghép mảnh): câu cố định trọn vẹn (mở bằng chữ hoa, kết bằng
        . ? !) còn đọc giọng máy, kể cả câu đáp hàng SDVICO. Câu có chỗ trống `${…}` không vào đây — đi đường mảnh. */
    const deXuat = new Map<string, string>();
    const nhan = (nguon: string, chuoi: string) => {
      for (const c of splitSentences(chuoi)) {
        const t = c.trim();
        const dau = t.replace(/^["“]/, "")[0] ?? "";
        const hoa = dau !== dau.toLowerCase() && dau === dau.toUpperCase(); // À-Ỹ của Unicode xen cả chữ thường
        if (!hoa || !/[.?!]$/.test(t) || t.split(/\s+/).length < 2) continue;
        if (speechParts(t).every((p) => p.clips)) continue;
        if (!deXuat.has(t)) deXuat.set(t, nguon);
      }
    };
    for (const m of muc) if (m.nguon !== "kho-hoi-dap" && m.nguon !== "src/data/khuyen-mai.ts") nhan(m.nguon, m.cau);
    for (const k of KHUYEN_MAI) for (const h of k.hoiDap ?? []) nhan("src/data/khuyen-mai.ts", h.dap);

    writeFileSync(
      OUT!,
      JSON.stringify(
        {
          tong: Object.fromEntries(tong),
          cauNguyen: [...deXuat].map(([text, nguon]) => ({ text, nguon })),
          thieu: muc.filter((m) => m.thieu.length),
        },
        null,
        1,
      ),
    );
    expect(muc.length).toBeGreaterThan(0);
  });
});
