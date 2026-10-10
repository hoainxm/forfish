import { describe, it, expect, vi } from "vitest";
import { gunzipSync } from "node:zlib";

vi.mock("server-only", () => ({}));
const { archivePath, encodeArchive, summarizePuts, putArchive } = await import("@/lib/forecast-archive");

describe("forecast-archive", () => {
  it("đường dẫn theo loại/năm/ngày, id snapshot có ':' thành '_'", () => {
    expect(archivePath("weather", "2026-10-10", "grid:d16")).toBe("weather/2026/2026-10-10/grid_d16.json.gz");
    expect(archivePath("weather", "2026-10-10", "curdepth:t50:d10")).toBe("weather/2026/2026-10-10/curdepth_t50_d10.json.gz");
    expect(archivePath("fish-inputs", "2026-01-02", "sstFine")).toBe("fish-inputs/2026/2026-01-02/sstfine.json.gz");
  });

  it("chặn ngày sai dạng và tên rỗng (không ghi lung tung vào kho)", () => {
    expect(() => archivePath("fish", "10/10/2026", "latest")).toThrow();
    expect(() => archivePath("fish", "2026-10-10", ":::")).toThrow();
    expect(() => archivePath("fish", "2026-10-10", "../x")).not.toThrow();
    expect(archivePath("fish", "2026-10-10", "../x")).toBe("fish/2026/2026-10-10/x.json.gz");
  });

  it("nén rồi giải lại ra đúng JSON; NaN thành null (lưới thiếu ô)", () => {
    const obj = { values: [[1.5, NaN], [Infinity, 2]], date: "2026-10-10" };
    const back = JSON.parse(gunzipSync(encodeArchive(obj)).toString("utf8"));
    expect(back).toEqual({ values: [[1.5, null], [null, 2]], date: "2026-10-10" });
  });

  it("gộp kết quả ghi: còn file nào ghi được là ok, nêu lỗi đầu tiên", () => {
    const s = summarizePuts([
      { path: "a", ok: true, bytes: 10 },
      { path: "b", ok: false, bytes: 0, error: "Bucket not found" },
    ]);
    expect(s).toMatchObject({ ok: true, files: 1, bytes: 10, failed: 1 });
    expect(s.note).toContain("Bucket not found");
    expect(summarizePuts([]).ok).toBe(false);
    expect(summarizePuts([{ path: "b", ok: false, bytes: 0, error: "x" }]).ok).toBe(false);
  });
});

describe("putArchive — thử lại khi mạng chập chờn", () => {
  /** client giả: `fails` lần đầu ném "fetch failed", sau đó thành công */
  const fakeAdmin = (fails: number) => {
    let n = 0;
    const upload = vi.fn(async () => {
      if (n++ < fails) throw new TypeError("fetch failed");
      return { error: null };
    });
    return { client: { storage: { from: () => ({ upload }) } } as never, upload };
  };

  it("rớt 2 lần rồi lên ⇒ ok, gọi 3 lần", async () => {
    vi.useFakeTimers();
    const { client, upload } = fakeAdmin(2);
    const p = putArchive(client, "fish/2026/2026-10-10/x.json.gz", { a: 1 });
    await vi.runAllTimersAsync();
    const r = await p;
    vi.useRealTimers();
    expect(r.ok).toBe(true);
    expect(r.bytes).toBeGreaterThan(0);
    expect(upload).toHaveBeenCalledTimes(3);
  });

  it("rớt mãi ⇒ không ném, báo lỗi kèm số lần", async () => {
    vi.useFakeTimers();
    const { client, upload } = fakeAdmin(99);
    const p = putArchive(client, "fish/2026/2026-10-10/x.json.gz", { a: 1 });
    await vi.runAllTimersAsync();
    const r = await p;
    vi.useRealTimers();
    expect(r).toMatchObject({ ok: false, bytes: 0 });
    expect(r.error).toContain("sau 3 lần");
    expect(upload).toHaveBeenCalledTimes(3);
  });
});
