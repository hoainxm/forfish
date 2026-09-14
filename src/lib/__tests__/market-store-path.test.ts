import { afterEach, describe, it, expect, vi } from "vitest";
import path from "node:path";
import { DEV_FILE_NAME, DEV_UPLOAD_DIRNAME, devLocalDir, devStoreFile, devUploadDir } from "@/lib/market/file-store";

/*  ĐƯỜNG DẪN KHO DEV (12 §5.1): `MARKET_STORE_FILE` trỏ tệp JSON; ảnh tải lên
    nằm trong `market-uploads/` CẠNH tệp đó. Không đặt ⇒ `.local/` của repo. */

afterEach(() => vi.unstubAllEnvs());

describe("devStoreFile / devUploadDir", () => {
  it("không đặt env ⇒ .local/market-dev.json + .local/market-uploads", () => {
    vi.stubEnv("MARKET_STORE_FILE", "");
    expect(devStoreFile()).toBe(path.join(process.cwd(), ".local", DEV_FILE_NAME));
    expect(devLocalDir()).toBe(path.join(process.cwd(), ".local"));
    expect(devUploadDir()).toBe(path.join(process.cwd(), ".local", DEV_UPLOAD_DIRNAME));
  });
  it("env tuyệt đối ⇒ dùng nguyên; uploads nằm cạnh tệp", () => {
    // resolve chứ KHÔNG join: trên Windows `join(sep, …)` ra "\tmp\…" — đó là đường
    // dẫn tương đối theo Ổ ĐĨA, nên `path.resolve` trong impl thêm "C:" vào là đúng.
    // resolve ở đây cho ra cùng dạng tuyệt đối trên cả Windows lẫn POSIX.
    const abs = path.resolve(path.sep, "tmp", "san-e2e", "kho.json");
    vi.stubEnv("MARKET_STORE_FILE", abs);
    expect(devStoreFile()).toBe(abs);
    expect(devUploadDir()).toBe(path.resolve(path.sep, "tmp", "san-e2e", DEV_UPLOAD_DIRNAME));
  });
  it("env tương đối ⇒ tính từ cwd; khoảng trắng thừa bị cắt", () => {
    vi.stubEnv("MARKET_STORE_FILE", "  .tmp/e2e/kho.json  ");
    expect(devStoreFile()).toBe(path.join(process.cwd(), ".tmp", "e2e", "kho.json"));
    expect(devUploadDir()).toBe(path.join(process.cwd(), ".tmp", "e2e", DEV_UPLOAD_DIRNAME));
  });
  it("nhận env truyền thẳng (thuần, không đụng process.env)", () => {
    const abs = path.resolve(path.sep, "a", "b.json"); // xem chú thích resolve/join ở trên
    expect(devStoreFile({ MARKET_STORE_FILE: abs })).toBe(abs);
    expect(devStoreFile({})).toBe(path.join(process.cwd(), ".local", DEV_FILE_NAME));
  });
});
