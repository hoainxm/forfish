// VIDEO 6 — BẢN ĐỒ CÓ GÓI DỰ BÁO (0900000781 premium) — anh Long 06/11: "1 video hướng dẫn riêng về tính năng bản đồ premium"
import { nut, moBangSong } from "./chung.mjs";
async function moTab(page, L, tab) {
  const dong = page.locator('button[aria-label="Đóng lớp bản đồ"]').filter({ visible: true });
  if (!(await dong.count())) await L.cham(page, page.locator('button[aria-label="Mở lớp bản đồ"]'), { sau: 700 });
  const quay = page.getByRole("button", { name: "Quay lại", exact: true }).filter({ visible: true });
  if (await quay.count()) await L.cham(page, quay, { sau: 500 });
  await L.cham(page, nut(page, tab), { sau: 900 });
}
async function batDong(page, L, ten) {
  await L.cham(page, page.getByText(ten, { exact: true }).filter({ visible: true }).first(), { sau: 1200 });
}
export default {
  ten: "6-ban-do-goi-du-bao",
  tieuDe: "Bản đồ có gói dự báo",
  vaiTen: "Gói dự báo",
  phone: "0900000781",
  don: true,
  async chuanBi({ page, L }) {
    await L.den(page, "/", 5000);
    await L.boDongY(page);
    await L.den(page, "/ngu-truong", 10000);
    await L.boDongY(page);
  },
  canh: [
    {
      id: "chao",
      noi: [
        "Chào bà con! Video này em nói riêng về bản đồ khi có gói dự báo của SDVICO.",
        "Mọi lớp đều nằm trong nút Lớp ở góc trên bên phải.",
      ],
      async lam({ page, L }) {
        await L.diChuot(page, 220, 380, 900);
        const bb = await page.locator('button[aria-label="Mở lớp bản đồ"]').boundingBox().catch(() => null);
        if (bb) await L.diChuot(page, bb.x + bb.width / 2, bb.y + bb.height / 2, 900);
      },
    },
    {
      id: "nuoc",
      noi: [
        "Chọn Hải đồ, rồi Nước nóng lạnh. Đây là nhiệt độ mặt nước chụp từ vệ tinh, đổi theo ngày.",
        "Chỗ nước nóng gặp nước lạnh thường là nơi cá hay tụ lại.",
      ],
      async lam({ page, L }) {
        await moTab(page, L, "Hải đồ");
        await batDong(page, L, "Nước nóng lạnh");
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(3500);
        await L.diChuot(page, 260, 420, 1500);
      },
    },
    {
      id: "moi",
      noi: [
        "Lớp Vùng nhiều mồi cho thấy chỗ nước nhiều phù du, cá nhỏ kéo tới, cá lớn theo sau.",
      ],
      async lam({ page, L }) {
        await moTab(page, L, "Hải đồ");
        await batDong(page, L, "Vùng nhiều mồi");
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(3500);
        await moTab(page, L, "Hải đồ");
        await batDong(page, L, "Hải đồ độ sâu");
        await page.keyboard.press("Escape").catch(() => {});
      },
    },
    {
      id: "gio",
      noi: [
        "Qua mục Thời tiết, bật Gió để thấy luồng gió chạy trên bản đồ, bật Sóng để thấy chỗ sóng lớn.",
        "Có gói thì xem được nhiều ngày tới, không chỉ hôm nay.",
      ],
      async lam({ page, L }) {
        await moTab(page, L, "Thời tiết");
        await batDong(page, L, "Gió");
        await batDong(page, L, "Sóng");
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(1500);
        const chay = page.locator('button[aria-label="Chạy thử 3 ngày"]');
        if (await chay.count()) {
          await L.cham(page, chay, { sau: 7000 });
          const dung = page.locator('button[aria-label="Dừng chạy"]');
          if (await dung.count()) await L.cham(page, dung, { sau: 500 });
        } else await page.waitForTimeout(4000);
        await moTab(page, L, "Thời tiết");
        await batDong(page, L, "Gió");
        await batDong(page, L, "Sóng");
        await page.keyboard.press("Escape").catch(() => {});
      },
    },
    {
      id: "duBao",
      noi: [
        "Quan trọng nhất là Dự báo cá. Chọn Ngư trường, bật Dự báo cá, chọn nghề, ví dụ câu ngừ, rồi bấm Xong.",
        "Ô màu đỏ là khả năng có cá cao, vàng là trung bình, xanh là thấp. Vòng tròn là điểm đáng đi nhất.",
      ],
      async lam({ page, L }) {
        await moTab(page, L, "Ngư trường");
        await L.cham(page, page.getByRole("switch").first(), { sau: 2000 });
        await L.cham(page, nut(page, "Câu ngừ"), { sau: 700 });
        await L.cham(page, nut(page, "Xong"), { sau: 5000 });
        await page.keyboard.press("Escape").catch(() => {});
        await L.diChuot(page, 250, 420, 1500);
      },
    },
    {
      id: "dan",
      noi: [
        "Chạm vào một vòng tròn rồi bấm Dẫn đường tới đây. App vẽ tuyến né sóng gió, cho biết đường dài bao nhiêu hải lý, chạy mấy tiếng, tốn khoảng bao nhiêu lít dầu.",
      ],
      async lam({ page, L }) {
        // điểm cá GẦN TÀU nhất trong vùng nhìn (điểm xa có thể vướng đất liền ⇒ không ra tuyến)
        const p = await page.evaluate(() => {
          const ds = [...document.querySelectorAll('button[aria-label^="Điểm có khả năng nhiều cá"]')].map((e) => e.getBoundingClientRect())
            .filter((r) => r.width > 0 && r.x > 40 && r.x < 360 && r.y > 120 && r.y < 680)
            .map((r) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 }));
          ds.sort((a, b) => Math.hypot(a.x - 200, a.y - 400) - Math.hypot(b.x - 200, b.y - 400));
          return ds[0] || null;
        });
        if (p) await L.chamXY(page, p.x, p.y, { sau: 2000 });
        await L.cham(page, page.locator('button[aria-label="Dẫn đường tới đây"]'), { sau: 9000 });
      },
    },
    {
      id: "ngay",
      noi: [
        "Thoát dẫn đường, chạm vào biển để mở bảng gió sóng, rồi chọn Ngày mai hoặc ngày khác. Gói dự báo xem được tới mười sáu ngày.",
      ],
      async lam({ page, L }) {
        const thoat = page.locator('button[aria-label="Thoát chế độ dẫn đường"]');
        if (await thoat.count()) await L.cham(page, thoat, { sau: 1500 });
        await moBangSong(page);
        await L.cham(page, nut(page, "Ngày mai"), { sau: 2500 });
        const c = page.getByRole("button", { name: /^T\d \d+$/ }).filter({ visible: true }).first();
        if (await c.count()) await L.cham(page, c, { sau: 2500 });
      },
    },
    {
      id: "ket",
      noi: [
        "Dữ liệu bản đồ app tự tải sẵn khi có sóng, ra khơi mất sóng vẫn xem được bản đã lưu. Chúc bà con trúng mùa!",
      ],
      async lam({ page }) { await page.keyboard.press("Escape").catch(() => {}); await page.waitForTimeout(800); },
    },
  ],
};
