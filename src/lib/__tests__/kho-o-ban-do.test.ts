// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, utimesSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  chonThuMucKho,
  chonTuKho,
  chonXoa,
  docGoiO,
  docKhoO,
  duoiAnh,
  ghiKhoO,
  thongKeKho,
  tranKhoBytes,
  xoaNganKho,
  type OKho,
} from "../kho-o-ban-do";
import { validateConfigValue } from "../app-config-keys";
import { TILE_PROXY } from "../tile-proxy";
import { GET } from "../../app/api/tiles/[src]/[z]/[x]/[y]/route";

const GIO = 3_600_000;
const NOW = Date.parse("2026-11-04T12:00:00Z");
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
const o = (ngan: OKho["ngan"], tuoiMs: number): OKho => ({ ngan, buf: new Uint8Array([ngan.length]), ctype: "image/png", luc: NOW - tuoiMs });

describe("chonTuKho — luật hạn + thứ tự", () => {
  it("ô song còn hạn ⇒ phát luôn; quá hạn ⇒ không tươi nhưng vẫn là dự phòng", () => {
    expect(chonTuKho("sst", [o("song", 1 * GIO)], NOW).tuoi?.ngan).toBe("song");
    const r = chonTuKho("sst", [o("song", 7 * GIO)], NOW);
    expect(r.tuoi).toBeNull();
    expect(r.duPhong.map((k) => k.ngan)).toEqual(["song"]);
  });

  it("cả hai còn tươi ⇒ ô máy nhà thắng (máy nhà đã chọn ngày mới nhất có ảnh cho cả vùng)", () => {
    expect(chonTuKho("chlorophyll", [o("song", GIO), o("may-nha", 20 * GIO)], NOW).tuoi?.ngan).toBe("may-nha");
  });

  it("ô máy nhà hết hạn riêng (30 giờ) ⇒ ô song tươi phát, máy nhà xuống dự phòng", () => {
    const r = chonTuKho("chlorophyll", [o("may-nha", 31 * GIO), o("song", GIO)], NOW);
    expect(r.tuoi?.ngan).toBe("song");
    expect(r.duPhong.map((k) => k.ngan)).toEqual(["may-nha"]);
  });

  it("dự phòng xếp MỚI NHẤT trước", () => {
    const r = chonTuKho("sst", [o("may-nha", 50 * GIO), o("song", 8 * GIO)], NOW);
    expect(r.duPhong.map((k) => k.ngan)).toEqual(["song", "may-nha"]);
  });

  it("phao đèn: máy nhà không đẩy (mayNhaMs 0) ⇒ ô may-nha không bao giờ tươi", () => {
    expect(TILE_PROXY.seamark.mayNhaMs).toBe(0);
    expect(chonTuKho("seamark", [o("may-nha", 1000)], NOW).tuoi).toBeNull();
  });

  it("hải đồ độ sâu giữ lâu: 20 ngày vẫn tươi", () => {
    expect(chonTuKho("chart", [o("song", 20 * 24 * GIO)], NOW).tuoi?.ngan).toBe("song");
  });

  it("đồng hồ lệch: ô 'ở tương lai' quá 1 phút không coi là tươi", () => {
    expect(chonTuKho("sst", [o("song", -10 * 60_000)], NOW).tuoi).toBeNull();
  });
});

describe("chonXoa — trần kho", () => {
  it("dưới trần ⇒ không xoá; vượt ⇒ xoá cũ nhất tới dưới 90% trần", () => {
    const f = [
      { f: "moi", size: 40, luc: 3 },
      { f: "cu", size: 40, luc: 1 },
      { f: "giua", size: 40, luc: 2 },
    ];
    expect(chonXoa(f, 200)).toEqual([]);
    expect(chonXoa(f, 100)).toEqual(["cu"]);
    expect(chonXoa(f, 50)).toEqual(["cu", "giua"]);
  });
});

describe("chonThuMucKho — tự chọn, không cần env", () => {
  // Hàm dựng đường dẫn theo dấu của máy đang chạy (IIS = `\`) ⇒ so bằng path.join, không viết cứng `/`
  // (viết cứng thì đỏ trên Windows: `\tmp\sdfish-kho-o` ≠ `/tmp/sdfish-kho-o`).
  const co = (ds: string[]) => (p: string) => ds.map((d) => path.join(d)).includes(path.join(p));
  it("deploy IIS (`<base>/current` + `<base>/shared`) ⇒ `<base>/shared/kho-o` — ngoài vùng robocopy /MIR", () => {
    expect(chonThuMucKho("/srv/FORFISH/current", co(["/srv/FORFISH/shared"]), "/tmp")).toBe(path.join("/srv/FORFISH/shared/kho-o"));
  });
  it("không đúng khuôn IIS ⇒ thư mục tạm (Vercel, máy dev)", () => {
    expect(chonThuMucKho("/srv/FORFISH/current", co([]), "/tmp")).toBe(path.join("/tmp/sdfish-kho-o"));
    expect(chonThuMucKho("/var/task", co(["/var/shared"]), "/tmp")).toBe(path.join("/tmp/sdfish-kho-o"));
  });
});

describe("trần kho — ô cấu hình kho_o_tran_mb", () => {
  it("rỗng/sai ⇒ 2048 MB; số hợp lệ ⇒ đúng số", () => {
    expect(tranKhoBytes(null)).toBe(2048 * 1024 * 1024);
    expect(tranKhoBytes("abc")).toBe(2048 * 1024 * 1024);
    expect(tranKhoBytes("500")).toBe(500 * 1024 * 1024);
  });
  it("quản trị chỉ lưu được số 100–100000", () => {
    expect(validateConfigValue("kho_o_tran_mb", "4096")).toBe(true);
    expect(validateConfigValue("kho_o_tran_mb", "50")).toBe(false);
    expect(validateConfigValue("kho_o_tran_mb", "2 GB")).toBe(false);
  });
});

describe("docGoiO — gói máy nhà", () => {
  const b64 = Buffer.from(png).toString("base64");
  it("nhận ô hợp lệ, đếm ô sai vào `loai` mà không hỏng cả gói", () => {
    const r = docGoiO({
      o: [
        { src: "chlorophyll", z: 5, x: 25, y: 14, png: b64 },
        { src: "seamark", z: 9, x: 400, y: 200, png: b64 }, // máy nhà không được đẩy phao đèn
        { src: "sst", z: 9, x: 1, y: 1, png: b64 }, // ngoài dải zoom
        { src: "chart", z: 3, x: 99, y: 1, png: b64 }, // x vượt 2^z
        { src: "chart", z: 3, x: 6, y: 3, png: Buffer.from("<html>").toString("base64") }, // không phải PNG
        { src: "../etc", z: 1, x: 0, y: 0, png: b64 },
      ],
    });
    expect(r?.o).toHaveLength(1);
    expect(r?.loai).toBe(5);
  });
  it("thân sai khuôn / rỗng ⇒ null", () => {
    expect(docGoiO(null)).toBeNull();
    expect(docGoiO({ o: [] })).toBeNull();
    expect(docGoiO({ o: "x" })).toBeNull();
  });
});

describe("đĩa + route /api/tiles — kho → nguồn → ô cũ", () => {
  let goc = "";
  let dir = "";
  beforeAll(() => {
    // dựng đúng khuôn deploy IIS: <base>/current (cwd) + <base>/shared ⇒ kho tự nằm ở <base>/shared/kho-o
    goc = mkdtempSync(path.join(tmpdir(), "kho-o-test-"));
    mkdirSync(path.join(goc, "current"));
    mkdirSync(path.join(goc, "shared"));
    dir = path.join(goc, "shared", "kho-o");
    vi.spyOn(process, "cwd").mockReturnValue(path.join(goc, "current"));
  });
  afterAll(() => {
    vi.restoreAllMocks();
    rmSync(goc, { recursive: true, force: true });
  });
  afterEach(() => vi.unstubAllGlobals());

  const goi = (src: string, z: number, x: number, y: number) =>
    GET(new Request("http://x"), { params: Promise.resolve({ src, z: String(z), x: String(x), y: String(y) }) });

  it("duoiAnh chỉ nhận png/jpeg", () => {
    expect(duoiAnh("image/png")).toBe("png");
    expect(duoiAnh("image/jpeg; q=1")).toBe("jpg");
    expect(duoiAnh("text/html")).toBeNull();
  });

  it("ghiKhoO rồi docKhoO đọc lại đúng ngăn; ô vô lý không ghi", async () => {
    expect(await ghiKhoO("may-nha", "chart", 4, 12, 7, png, "image/png")).toBe(true);
    const k = await docKhoO("chart", 4, 12, 7);
    expect(k.map((x) => x.ngan)).toEqual(["may-nha"]);
    expect(Buffer.from(k[0].buf).equals(Buffer.from(png))).toBe(true);
    expect(await ghiKhoO("song", "chart", 4, 99, 7, png, "image/png")).toBe(false);
    expect(await ghiKhoO("song", "chart", 4, 1, 7, png, "text/html")).toBe(false);
    // không còn file tạm sau khi ghi
    expect(readdirSync(path.join(dir, "may-nha/chart/4/12"))).toEqual(["7.png"]);
  });

  it("trượt kho ⇒ hỏi nguồn, cất ngăn song; lượt sau phát từ kho KHÔNG gọi nguồn", async () => {
    const f = vi.fn(async () => new Response(png, { status: 200, headers: { "Content-Type": "image/png" } }));
    vi.stubGlobal("fetch", f);
    const r1 = await goi("chart", 5, 25, 14);
    expect(r1.status).toBe(200);
    expect(r1.headers.get("X-Kho-O")).toBe("nguon");
    expect(f).toHaveBeenCalledTimes(1);
    const r2 = await goi("chart", 5, 25, 14);
    expect(r2.headers.get("X-Kho-O")).toBe("kho-song");
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("ô kho quá hạn + nguồn sập ⇒ phát ô cũ (200, giữ 5 phút) thay vì 503", async () => {
    await ghiKhoO("song", "sst", 5, 25, 15, png, "image/png");
    const f = path.join(dir, "song/sst/5/25/15.png");
    const cu = new Date(Date.now() - 10 * GIO);
    utimesSync(f, cu, cu);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));
    const r = await goi("sst", 5, 25, 15);
    expect(r.status).toBe(200);
    expect(r.headers.get("X-Kho-O")).toBe("kho-song-cu");
    expect(r.headers.get("Cache-Control")).toBe("public, max-age=300");
  });

  it("ô máy nhà quá hạn vẫn cứu được khi nguồn sập", async () => {
    await ghiKhoO("may-nha", "chlorophyll", 6, 51, 29, png, "image/png");
    const f = path.join(dir, "may-nha/chlorophyll/6/51/29.png");
    const cu = new Date(Date.now() - 72 * GIO);
    utimesSync(f, cu, cu);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("mất mạng"); }));
    const r = await goi("chlorophyll", 6, 51, 29);
    expect(r.headers.get("X-Kho-O")).toBe("kho-may-nha-cu");
  });

  it("kho trống + nguồn sập ⇒ 503 như cũ; kho trống + mọi ngày 404 ⇒ 204", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("x", { status: 500 })));
    expect((await goi("chart", 6, 50, 28)).status).toBe(503);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("x", { status: 404 })));
    expect((await goi("chart", 6, 50, 29)).status).toBe(204);
  });

  it("ô GIẢ GIBS (etag 1000000000000) không bao giờ vào kho", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(png, { status: 200, headers: { "Content-Type": "image/png", ETag: '"1000000000000"' } })),
    );
    expect((await goi("sst", 4, 12, 6)).status).toBe(503);
    expect(await docKhoO("sst", 4, 12, 6)).toEqual([]);
  });

  it("thẻ quản trị: đếm theo ngăn × lớp, xoá một ngăn không đụng ngăn kia", async () => {
    const tk = await thongKeKho();
    expect(tk.thuMuc).toBe(dir);
    expect(tk.ghiDuoc).toBe(true);
    const may = tk.nhom.filter((n) => n.ngan === "may-nha").reduce((s, n) => s + n.so, 0);
    expect(may).toBeGreaterThan(0);
    await xoaNganKho("may-nha");
    const sau = await thongKeKho();
    expect(sau.nhom.filter((n) => n.ngan === "may-nha").every((n) => n.so === 0)).toBe(true);
    expect(sau.nhom.filter((n) => n.ngan === "song").some((n) => n.so > 0)).toBe(true);
  });
});

/*  CỔNG CHỐNG GOM CẢ DỰ ÁN VÀO GÓI DEPLOY (2026-11-05). Đường dẫn kho dựng lúc chạy từ `process.cwd()` (lên cả thư mục
    cha) ⇒ thiếu `turbopackIgnore` là Turbopack chép cả repo + `.git` vào `.next/standalone`, runner IIS hết đĩa (ENOSPC) —
    deploy aaf303dc/683edd74 chết thật. CI không chạy `next build` nên cổng nằm ở đây. */
describe("kho-o-ban-do — lệnh đĩa có turbopackIgnore", () => {
  const src = readFileSync(path.join(__dirname, "..", "kho-o-ban-do.ts"), "utf8").split("\n");
  const can = (l: string) =>
    /process\.cwd\(\)/.test(l) ||
    /\breadFile\(/.test(l) ||
    /\brm\(/.test(l) ||
    /path\.join\((thuMucKho\(\)|goc\b)/.test(l.replace(/\/\*turbopackIgnore: true\*\/ /g, ""));
  it("mọi dòng đọc/xoá theo thư mục kho đều mang chú thích", () => {
    const thieu = src.filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && can(l) && !l.includes("turbopackIgnore"));
    expect(thieu).toEqual([]);
  });
});
