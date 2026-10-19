/*  CỔNG ĐƯỜNG DẪN WINDOWS — runner deploy tự host chạy WINDOWS (IIS).
    Một file tên `con.mp3` (mảnh giọng "còn", 2026-10-18) làm git trên đó
    không checkout được ⇒ deploy đỏ ở bước Checkout, prod đứng 8 ngày mà máy
    dev macOS/Linux không hề thấy gì. Cổng này quét MỌI file git đang theo dõi.
    Luật Windows: tên thiết bị CON/PRN/AUX/NUL/COM1–9/LPT1–9 (bất kể đuôi,
    bất kể hoa thường), ký tự < > : " | ? *, và đoạn đường dẫn kết thúc bằng
    dấu chấm hay khoảng trắng. */
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";

const TEN_THIET_BI = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
const KY_TU_CAM = /[<>:"|?*\x00-\x1f]/;

export function loiDuongDanWindows(path: string): string | null {
  for (const doan of path.split("/")) {
    if (TEN_THIET_BI.test(doan)) return `"${doan}" là tên thiết bị của Windows`;
    if (KY_TU_CAM.test(doan)) return `"${doan}" có ký tự Windows cấm`;
    if (/[. ]$/.test(doan)) return `"${doan}" kết thúc bằng dấu chấm/khoảng trắng`;
  }
  return null;
}

describe("đường dẫn checkout được trên Windows", () => {
  it("luật bắt đúng ca thật và không bắt oan", () => {
    expect(loiDuongDanWindows("public/giong/sen-bien/m/con.mp3")).not.toBeNull();
    expect(loiDuongDanWindows("a/NUL")).not.toBeNull();
    expect(loiDuongDanWindows("a/Com1.txt")).not.toBeNull();
    expect(loiDuongDanWindows("a/b:c.json")).not.toBeNull();
    expect(loiDuongDanWindows("a/ten. ")).not.toBeNull();
    expect(loiDuongDanWindows("public/giong/sen-bien/m/con_.mp3")).toBeNull();
    expect(loiDuongDanWindows("public/giong/sen-bien/m/con_song.mp3")).toBeNull();
    expect(loiDuongDanWindows("src/lib/console.ts")).toBeNull();
    expect(loiDuongDanWindows("docs/com10.md")).toBeNull();
  });

  it("mọi file trong git đều hợp lệ trên Windows", () => {
    const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
      .split("\0")
      .filter(Boolean);
    expect(files.length).toBeGreaterThan(100);
    const sai = files.map((f) => [f, loiDuongDanWindows(f)]).filter(([, l]) => l);
    expect(sai, "file làm runner Windows không checkout được").toEqual([]);
  });
});
