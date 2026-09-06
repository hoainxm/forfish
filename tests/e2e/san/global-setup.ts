import { promises as fs } from "node:fs";
import net from "node:net";
import path from "node:path";

// KHO SẠCH MỖI LẦN CHẠY.
//
// `file-store.ts` chốt đường dẫn kho bằng `path.join(process.cwd(), ".local")` —
// KHÔNG có biến môi trường trỏ đường dẫn (đã đọc `devLocalDir()` 2026-09-06).
// Nên bộ test dọn tay: xoá `<SAN_APP_DIR>/.local/market-dev.json` + thư mục ảnh
// trước khi test chạy; server dev sẽ sinh lại seed ở request đầu tiên.
//
// ⚠️ Thứ tự của Playwright: webServer (plugin) lên TRƯỚC globalSetup. Không sao —
// `next dev` không chạm kho tới khi có request vào `/api/cho|ban-hang|dev`, mà
// request đầu tiên là của test. NHƯNG nếu server đã chạy sẵn từ trước
// (`reuseExistingServer`) VÀ đã phục vụ request thì nó giữ state trong RAM: xoá
// tệp không dọn được RAM, và lần ghi sau nó chép RAM đè lại. Ca đó ta CẢNH BÁO
// để người chạy tự khởi động lại server, không im lặng chạy trên kho bẩn.
async function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = net.connect({ port, host: "127.0.0.1" });
    const done = (v: boolean) => { sock.destroy(); resolve(v); };
    sock.setTimeout(1000);
    sock.on("connect", () => done(true));
    sock.on("error", () => done(false));
    sock.on("timeout", () => done(false));
  });
}

export default async function globalSetup(): Promise<void> {
  const appDir = process.env.SAN_APP_DIR ? path.resolve(process.env.SAN_APP_DIR) : process.cwd();
  const port = Number(process.env.SAN_PORT ?? 3031);
  const localDir = path.join(appDir, ".local");
  const storeFile = path.join(localDir, "market-dev.json");
  const uploadDir = path.join(localDir, "market-uploads");

  const existed = await fs
    .stat(storeFile)
    .then(() => true)
    .catch(() => false);

  await fs.rm(storeFile, { force: true });
  await fs.rm(uploadDir, { recursive: true, force: true });
  await fs.mkdir(localDir, { recursive: true });

  const serverUp = await isPortOpen(port);
  console.log(`[san] kho dev: ${storeFile} (${existed ? "đã xoá bản cũ" : "chưa có, sẽ seed"})`);
  if (serverUp && existed) {
    console.warn(
      "[san] CẢNH BÁO: cổng " + port + " đã có server chạy sẵn. Nếu server đó đã phục vụ " +
        "request của chợ thì state cũ còn trong RAM và sẽ ghi đè kho vừa xoá — khởi động lại " +
        "server rồi chạy lại bộ test nếu thấy kết quả lạ (ví dụ shop đăng ký lần 2 trả 409).",
    );
  }
}
