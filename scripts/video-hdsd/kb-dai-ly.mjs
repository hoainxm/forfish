// VIDEO 5 — ĐẠI LÝ (0900000784, vai đại lý — người bán vật tư)
import { nut, hoiSen } from "./chung.mjs";
export default {
  ten: "5-dai-ly",
  tieuDe: "Đại lý — mở gian hàng, bán vật tư",
  vaiTen: "Đại lý",
  phone: "0900000784",
  don: true,
  async chuanBi({ page, L }) {
    await L.den(page, "/", 5000);
    await L.boDongY(page);
  },
  canh: [
    {
      id: "chao",
      noi: [
        "Chào anh chị đại lý! Video này em chỉ cách mở gian hàng trên SDFish, để bán máy móc, ngư cụ, dầu nhớt thẳng cho tàu cá.",
      ],
      async lam({ page, L }) { await L.diChuot(page, 200, 300, 900); },
    },
    {
      id: "dangky",
      noi: [
        "Bấm Bán hàng ở thanh dưới, rồi bấm Đăng ký.",
        "Ghi tên gian hàng, số điện thoại để bà con gọi, tỉnh, địa chỉ lấy hàng, phí giao, và số tài khoản ngân hàng nếu muốn nhận chuyển khoản.",
        "Bấm Gửi đăng ký. SDVICO duyệt trong một đến hai ngày làm việc.",
      ],
      async lam({ page, L }) {
        await L.cham(page, L.dock(page, "Bán hàng"), { sau: 1800 });
        await L.cham(page, page.getByRole("link", { name: "Đăng ký", exact: true }), { sau: 1800 });
        await L.go(page, page.getByPlaceholder("Ví dụ: Đại lý Hải Đăng"), "Đại lý ngư cụ Bảy Võ", 40);
        const o = page.locator("input").filter({ visible: true });
        if ((await o.count()) > 1) await L.go(page, o.nth(1), "0900000784", 40);
        const sel = page.locator("select").filter({ visible: true }).first();
        await L.cham(page, sel, { sau: 300 });
        await sel.selectOption({ label: "Gia Lai" }).catch(() => {});
        await page.keyboard.press("Escape").catch(() => {});
        await L.cuon(page, 700, 1800);
        const gui = page.getByRole("button", { name: "Gửi đăng ký" });
        const bb = await gui.boundingBox().catch(() => null);
        if (bb) await L.diChuot(page, bb.x + bb.width / 2, bb.y + bb.height / 2, 900);
        await page.waitForTimeout(1500);
      },
    },
    {
      id: "sau",
      noi: [
        "Được duyệt rồi, trang Bán hàng có các ô: đơn chờ xác nhận, cần đi giao, đang giao, và báo đã chuyển khoản.",
        "Bấm Thêm món để đăng sản phẩm, có ảnh, giá và số lượng còn. Có đơn mới, app báo ngay.",
      ],
      async lam({ page, L }) {
        await page.goBack().catch(() => {});
        await page.waitForTimeout(1500);
        await L.diChuot(page, 200, 300, 1200);
        await page.waitForTimeout(2000);
      },
    },
    {
      id: "cho",
      noi: [
        "Hàng của anh chị hiện trong mục Vật tư, cạnh các món của SDVICO. Bà con tìm món, bỏ vào giỏ, chọn trả tiền mặt hay chuyển khoản, rồi đặt hàng.",
      ],
      async lam({ page, L }) {
        await L.cham(page, L.dock(page, "Vật tư"), { sau: 2000 });
        await L.cuon(page, 900, 2200);
        await page.waitForTimeout(700);
        await L.cuon(page, -2000, 800);
      },
    },
    {
      id: "nhotim",
      noi: ["Bà con cần món chợ chưa có thì bấm Nhờ tìm. Yêu cầu đó tới chủ sàn, anh chị có hàng thì báo giá và hẹn ngày giao."],
      async lam({ page, L }) {
        await L.cuon(page, 4000, 2000);
        const n = page.getByRole("link", { name: /Nhờ tìm/ }).or(page.getByRole("button", { name: /Nhờ tìm/ }));
        if (await n.count()) {
          const bb = await n.first().boundingBox().catch(() => null);
          if (bb) await L.diChuot(page, bb.x + bb.width / 2, bb.y + bb.height / 2, 900);
        }
        await page.waitForTimeout(1500);
      },
    },
    {
      id: "sen",
      noi: ["Cần hỏi gì, anh chị chạm vào em ở góc màn hình."],
      async lam({ page, L }) { await L.cuon(page, -4000, 600); await hoiSen(page, L, "giá mực"); },
    },
    {
      id: "ket",
      noi: ["Chúc anh chị buôn may bán đắt, phục vụ bà con tàu cá thật tốt!"],
      async lam({ page }) { await page.waitForTimeout(500); },
    },
  ],
};
