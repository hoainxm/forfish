import { promises as fs } from "node:fs";
import path from "node:path";

// KHO SẠCH MỖI LẦN CHẠY — cùng lý lẽ với `tests/e2e/san/global-setup.ts`:
// `file-store.ts` đọc `MARKET_STORE_FILE` (đường dẫn TỆP; ảnh ở
// `<dirname>/market-uploads/`). Config trỏ vào `.local/e2e-troly/` — KHO RIÊNG
// của bộ trợ lý, không đụng kho bộ chợ (`.local/e2e/`) lẫn kho dev gõ tay
// (`.local/market-dev.json`).
//
// Bộ đếm lượt của trợ lý (14 §6.3) ở chế độ kho file ghi `assistant-quota.json`
// CÙNG thư mục kho ⇒ xoá luôn, nếu không ca quota sẽ thấy lượt của lần chạy trước.
export default async function globalSetup(): Promise<void> {
  const appDir = process.env.SAN_APP_DIR ? path.resolve(process.env.SAN_APP_DIR) : process.cwd();
  const storeFile = process.env.MARKET_STORE_FILE
    ? path.resolve(appDir, process.env.MARKET_STORE_FILE)
    : path.join(appDir, ".local", "e2e-troly", "market-dev.json");
  const localDir = path.dirname(storeFile);

  const existed = await fs.stat(storeFile).then(() => true).catch(() => false);

  await fs.rm(storeFile, { force: true });
  await fs.rm(path.join(localDir, "market-uploads"), { recursive: true, force: true });
  await fs.rm(path.join(localDir, "assistant-quota.json"), { force: true });
  await fs.mkdir(localDir, { recursive: true });

  console.log(`[troly] kho dev: ${storeFile} (${existed ? "đã xoá bản cũ" : "chưa có, sẽ seed"})`);

  /*  Vì sao KHÔNG kiểm cổng ở đây: Playwright dựng `webServer` TRƯỚC khi chạy
      `globalSetup`, nên lúc này cổng 3033 đã có server của chính bộ test —
      kiểm là tự chặn mình. Việc "cổng đang bận" đã có `reuseExistingServer:
      false` lo: Playwright báo thẳng và dừng.

      Điều còn lại mà hàm này phải bảo đảm: tệp `assistant-quota.json` bị xoá
      TRƯỚC lượt hỏi đầu tiên. Bộ đếm chỉ nạp từ tệp ở request đầu tiên vào
      `/api/tro-ly` (`hydrateQuotaFromFile`), mà request đó chỉ đến khi test
      chạy — tức là sau đây. Nên thứ tự vẫn đúng dù server đã bật sẵn. */
}
