/**
 * CỔNG CHỦ QUYỀN — không một chữ Hán, không một tên nước ngoài của thực thể
 * Việt Nam nào được lọt vào dữ liệu app phát cho bà con.
 *
 * Vì sao cổng này nằm ở tầng TEST chứ không chỉ trong script sinh dữ liệu:
 * mỗi `scripts/generate-*.mjs` đã tự kiểm CJK, nhưng cổng đó chỉ chạy KHI ai đó
 * chạy script — mà `public/data/vn-basemap.pmtiles` KHÔNG do script nào trong
 * repo sinh ra (tải sẵn từ Protomaps). Nó chưa từng qua cổng nào, và grep chữ
 * Hán trên nó trả về "sạch" GIẢ TẠO vì mỗi ô tile nén gzip. Cổng ở đây chạy mỗi
 * lần `npm test`, quét cả .pmtiles sau khi giải nén tile.
 *
 * Chạy bộ quét như MỘT TIẾN TRÌNH CON thay vì import hàm: `scripts/*.mjs` nằm
 * ngoài `src/`, import thẳng từ file .ts sẽ kéo nó vào diện type-check của
 * `tsc --noEmit` (allowJs: true) — sửa một cổng lại làm đỏ một cổng khác. Gọi
 * đúng công cụ mà người soát chạy tay cũng bảo đảm test và tay ra CÙNG kết quả.
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

type Finding = {
  file: string;
  where: string;
  rule: string;
  detail: string;
  sample: string;
};
type Report = {
  findings: Finding[];
  stats: { files: number; tiles: number; features: number };
};

const SCRIPT = path.join(process.cwd(), "scripts", "audit-names.mjs");

/** Chạy bộ quét; exit 1 (có vi phạm) là kết quả HỢP LỆ, không phải lỗi chạy. */
function audit(args: string[] = []): Report {
  try {
    const out = execFileSync(process.execPath, [SCRIPT, "--json", ...args], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    return JSON.parse(out) as Report;
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    if (err.status === 1 && err.stdout) return JSON.parse(err.stdout) as Report;
    throw new Error(`Bộ quét tên chạy hỏng: ${err.stderr || String(e)}`);
  }
}

/** Ghi một file tạm rồi quét đúng nó (dùng cho fixture chứng minh cổng). */
function auditText(name: string, body: string): Finding[] {
  const dir = mkdtempSync(path.join(tmpdir(), "sdfish-names-"));
  const file = path.join(dir, name);
  try {
    writeFileSync(file, body, "utf8");
    return audit(["--file", file]).findings;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Một lần quét đầy đủ dùng chung cho cả nhóm (mất ~1,5 s vì giải nén 982 ô tile).
const full = audit();

describe("cổng chủ quyền — dữ liệu phát cho bà con", () => {
  it("bộ quét THẬT SỰ mở được nền pmtiles (không âm thầm quét 0 ô)", () => {
    // Bảo hiểm quan trọng nhất của cổng: nếu thư viện pmtiles đổi API hay file
    // nền biến mất, `findings` rỗng nhìn y hệt "sạch". Chốt lại số ô tile và số
    // đối tượng để "sạch vì không quét gì" không bao giờ đi qua được.
    expect(full.stats.files).toBeGreaterThan(200);
    expect(full.stats.tiles).toBeGreaterThan(900);
    expect(full.stats.features).toBeGreaterThan(80_000);
  });

  it("KHÔNG file dữ liệu nào của dự án chứa chữ Hán hay tên nước ngoài", () => {
    // Mọi thứ TRỪ nền bản đồ mua ngoài: đây là phần dự án tự sinh và tự kiểm
    // soát được, nên yêu cầu là TUYỆT ĐỐI 0.
    const ours = full.findings.filter((f) => !f.file.endsWith(".pmtiles"));
    expect(
      ours.map((f) => `${f.file} · ${f.where} · [${f.rule}] ${f.sample}`),
    ).toEqual([]);
  });

  it("NỢ CHỦ QUYỀN: nền vn-basemap.pmtiles vẫn mang tên chữ Hán — không được phình thêm", () => {
    // nợ: nền bản đồ Protomaps mang 13.499 chuỗi Hán/tên tranh chấp (có "三沙市
    // / Tam Sa", "黄岩岛国家级自然保护区", "永乐群岛", "渚碧岛"…). Hôm nay app
    // KHÔNG vẽ nhãn nào từ nền (buildMapStyle lọc bỏ mọi lớp `symbol` +
    // `boundaries*`) nên màn hình sạch, nhưng dữ liệu vẫn nằm trong file 16,9 MB
    // gửi tới máy bà con. Nâng cấp khi: Lead chốt dựng lại file nền (lọc trường
    // name:*/ref:* lúc đóng gói) — lúc đó số này về 0 và XOÁ HẲN test nợ này.
    // Chi tiết + phương án: docs/research/ra-soat-ten-2026-08.md
    const BASELINE = 13_499;
    const basemap = full.findings.filter((f) => f.file.endsWith(".pmtiles"));
    expect(
      basemap.length,
      `Nền bản đồ có ${basemap.length} tên chữ Hán/tranh chấp (mốc đã ghi nhận: ${BASELINE}).` +
        " Tăng lên = vừa nạp một file nền BẨN HƠN; về 0 = đã dựng lại sạch, hãy xoá test nợ này.",
    ).toBeLessThanOrEqual(BASELINE);
  });
});

describe("cổng chủ quyền — bằng chứng cổng KHÔNG RỖNG", () => {
  // Không có nhóm test này thì cổng trên vô nghĩa: một bộ quét hỏng cũng trả về
  // "sạch". Mỗi ca dưới đây bơm một chuỗi BẨN vào file tạm và đòi cổng phải đỏ.

  it("bắt chữ Hán trong file dữ liệu", () => {
    const hits = auditText(
      "ban-do.json",
      JSON.stringify({ name: "三沙市", admin: "TP Đà Nẵng" }),
    );
    expect(hits.some((h) => h.rule === "CJK")).toBe(true);
  });

  it("bắt chữ Nhật (OSM có trường name:ja cho đúng các thực thể tranh chấp)", () => {
    const hits = auditText("ban-do.json", JSON.stringify({ name: "南シナ海" }));
    expect(hits.some((h) => h.rule === "CJK")).toBe(true);
  });

  it("bắt tên Anh của thực thể Việt Nam", () => {
    const hits = auditText(
      "ban-do.json",
      JSON.stringify([{ name: "Fiery Cross Reef" }, { name: "Vanguard Bank" }]),
    );
    expect(hits.map((h) => h.rule).sort()).toContain("Fiery Cross");
    expect(hits.map((h) => h.rule)).toContain("Vanguard Bank");
  });

  it("bắt tên Philippines của thực thể Việt Nam", () => {
    const hits = auditText("ban-do.json", JSON.stringify({ name: "Ayungin Shoal" }));
    expect(hits.map((h) => h.rule)).toContain("Ayungin");
  });

  it("bắt phiên âm Hán-Việt của tên Trung Quốc (trông như tiếng Việt)", () => {
    // Bẫy tinh vi nhất: đúng chính tả tiếng Việt nhưng là cách gọi theo Trung
    // Quốc. Nền bản đồ hiện tại đang gắn đúng chuỗi này ở trường name:vi.
    const hits = auditText(
      "ban-do.json",
      JSON.stringify([{ name: "Đảo Chử Bích" }, { name: "Thành phố Tam Sa" }]),
    );
    expect(hits.map((h) => h.rule)).toContain("Chử Bích");
    expect(hits.map((h) => h.rule)).toContain("Tam Sa");
  });

  it("bắt chuỗi hiển thị bẩn trong mã nguồn, nhưng KHÔNG kêu oan chú thích", () => {
    const hits = auditText(
      "man-hinh.ts",
      [
        '// Nền quốc tế hay ghi "Paracel Islands" — mình phải tránh.',
        'export const NHAN = "Quần đảo Paracel";',
      ].join("\n"),
    );
    // Đúng MỘT lần: chuỗi hiển thị. Dòng chú thích giải thích không bị tính.
    expect(hits.filter((h) => h.rule === "Paracel")).toHaveLength(1);
    expect(hits[0].sample).toContain("Quần đảo Paracel");
  });

  it("BẮT phiên âm Hán-Việt KHI nó đóng vai nhãn hải đồ", () => {
    // Mặt còn lại của ca trên: cùng cái tên, nhưng đi kèm từ chỉ thực thể trên
    // biển thì đó chính là nhãn sai chủ quyền — phải đỏ.
    const hits = auditText(
      "ban-do.json",
      JSON.stringify([
        { name: "Bãi Vạn An" },
        { name: "Đảo Vĩnh Hưng" },
        { name: "Quần đảo Nam Sa" },
      ]),
    );
    expect(hits.map((h) => h.rule).sort()).toEqual(["Nam Sa", "Vĩnh Hưng", "Vạn An"]);
  });

  it("KHÔNG kêu oan tên tiếng Việt đúng chuẩn", () => {
    const hits = auditText(
      "ban-do.json",
      JSON.stringify([
        { name: "Đá Xu Bi" },
        { name: "Bãi Tư Chính" },
        { name: "Quần đảo Hoàng Sa" },
        { name: "Quần đảo Trường Sa" },
        { name: "Công ty CP Nam Việt" }, // "Nam Vi" + "ệt" — bẫy ranh giới từ
        { name: "Huyện Nam Sách" }, // "Nam Sa" + "ch" — bẫy ranh giới từ
        // Địa danh THẬT trong đất liền, trùng phiên âm tên Trung Quốc trên biển.
        // Đây là bốn ca kêu oan có thật, đo trên nền bản đồ ngày 2026-08-29.
        { name: "Xã Vạn An", admin: "Nghệ An" },
        { name: "Huyện Vĩnh Hưng", admin: "Đồng Tháp" },
        { name: "Quận Nam Sa", admin: "Quảng Châu" },
        { name: "Sông Nam Vi", admin: "Lào" },
      ]),
    );
    expect(hits).toEqual([]);
  });
});
