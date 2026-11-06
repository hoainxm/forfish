// Thao tác dùng chung giữa các kịch bản.
import * as L from "./lib.mjs";
export const nut = (p, ten) => p.getByRole("button", { name: ten, exact: true });

/** Nút Sen Biển nổi góc phải dưới — lúc cuộn nó thu vào mép; chạm phần còn ló ra. */
/** Hộp toạ độ thật của phần tử theo aria-label (bỏ qua luật "visible" của Playwright — bong bóng Sen Biển có hiệu ứng CSS). */
async function hop(page, sel) {
  return page.evaluate((s) => {
    const e = [...document.querySelectorAll(s)].find((x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, sel);
}
export async function moSen(page) {
  for (let lan = 0; lan < 3; lan++) {
    if (await hop(page, '[aria-label="Nhắn chữ"], textarea[aria-label="Nhắn Sen Biển"]')) return;
    await moSen1(page);
  }
}
async function moSen1(page) {
  // dò điểm trên màn mà phần tử trên cùng nằm trong nút Sen Biển (nút có thể đang thu vào mép phải)
  const p = await page.evaluate((vw) => {
    for (let y = 860; y > 300; y -= 6)
      for (let x = vw - 6; x > vw - 70; x -= 6) {
        const e = document.elementFromPoint(x, y);
        const b = e && e.closest("button");
        if (b && /Sen Biển/.test(b.getAttribute("aria-label") || "")) return { x: x - 6, y: y - 20 };
      }
    return null;
  }, L.VW);
  await L.chamXY(page, p ? p.x : L.VW - 20, p ? p.y : 770, { sau: 1500 });
}
export async function hoiSen(page, L_, cau) {
  await moSen(page);
  let o = await hop(page, 'textarea[aria-label="Nhắn Sen Biển"]');
  if (!o) {
    const n = await hop(page, '[aria-label="Nhắn chữ"]');
    if (n) await L.chamXY(page, n.x, n.y, { sau: 800 });
    o = await hop(page, 'textarea[aria-label="Nhắn Sen Biển"]');
  }
  if (!o) throw new Error("không mở được ô nhắn Sen Biển");
  await L.chamXY(page, o.x, o.y, { sau: 300 });
  await page.locator('textarea[aria-label="Nhắn Sen Biển"]').first().focus().catch(() => {});
  await page.keyboard.type(cau, { delay: 60 });
  const g = await hop(page, 'button[aria-label="Gửi"]');
  if (g) await L.chamXY(page, g.x, g.y, { sau: 4500 }); else { await page.keyboard.press("Enter"); await page.waitForTimeout(4500); }
}
export async function moBanDo(page) {
  await L.cham(page, L.dock(page, "Bản đồ"), { sau: 500 });
  await page.waitForSelector("canvas", { timeout: 60000 }).catch(() => {});
  await page.getByText("Đang mở bản đồ").waitFor({ state: "hidden", timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3500);
}
/** Mở bảng gió sóng ở đáy bản đồ (thanh "Biển êm · Hôm nay") tới khi thấy chip "Ngày mai". */
export async function moBangSong(page) {
  await page.keyboard.press("Escape").catch(() => {});
  const x = page.getByRole("button", { name: "Đóng", exact: true }).filter({ visible: true });
  if (await x.count()) await L.cham(page, x.first(), { sau: 500 });
  for (let i = 0; i < 3; i++) {
    if (await page.getByRole("button", { name: "Ngày mai", exact: true }).filter({ visible: true }).count()) return;
    await L.cham(page, page.locator('button[aria-label^="Mở bảng gió sóng"]'), { sau: 1500 });
  }
}
