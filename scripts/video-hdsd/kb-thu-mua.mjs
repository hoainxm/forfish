// VIDEO 4 — THU MUA (0900000783, vai thu mua / vựa)
import { nut, hoiSen } from "./chung.mjs";
export default {
  ten: "4-thu-mua",
  tieuDe: "Thu mua — tìm cá, đăng giá mua",
  vaiTen: "Thu mua",
  phone: "0900000783",
  don: true,
  async chuanBi({ page, L }) {
    await L.den(page, "/", 5000);
    await L.boDongY(page);
  },
  canh: [
    {
      id: "chao",
      noi: [
        "Chào anh chị thu mua! Video này em chỉ cách dùng SDFish để tìm cá đang bán và đăng giá thu mua.",
        "Trang chủ của anh chị có cá đang bán gần cảng, giá tuần này từng loài, và tin mua của mình.",
      ],
      async lam({ page, L }) {
        for (const t of ["Cá đang bán gần cảng", "Giá tuần này", "Tin mua của tôi"]) {
          const bb = await page.getByText(t).first().boundingBox().catch(() => null);
          if (bb) await L.diChuot(page, bb.x + 80, bb.y + 10, 900);
          await page.waitForTimeout(900);
        }
      },
    },
    {
      id: "vua",
      noi: [
        "Việc đầu tiên: bấm Lập hồ sơ vựa. Ghi tên vựa, tỉnh, địa chỉ, những loài mình mua và số điện thoại, rồi bấm Gửi.",
        "SDVICO xem lại rồi đưa vựa của anh chị lên danh bạ, bà con ngư dân tìm thấy và gọi bán.",
      ],
      async lam({ page, L }) {
        await L.cham(page, page.getByRole("link", { name: /Lập hồ sơ vựa/ }), { sau: 1800 });
        const ten = page.locator("input").filter({ visible: true }).first();
        await L.go(page, ten, "Vựa cá Hai Lộc", 45);
        await L.cham(page, page.getByText("Vựa", { exact: true }).first(), { sau: 400 });
        const sel = page.locator("select").filter({ visible: true }).first();
        await L.cham(page, sel, { sau: 300 });
        await sel.selectOption({ label: "Gia Lai" }).catch(() => {});
        await page.keyboard.press("Escape").catch(() => {});
        await L.cuon(page, 500, 1200);
        const gui = nut(page, "Gửi");
        const bb = await gui.boundingBox().catch(() => null);
        if (bb) await L.diChuot(page, bb.x + bb.width / 2, bb.y + bb.height / 2, 800);
        await page.waitForTimeout(1200);
      },
    },
    {
      id: "muaban",
      noi: [
        "Qua Chợ cá, chọn Mua bán. Ở đây có tin bán cá của ngư dân và tin mua của các vựa. Lọc Tin bán để xem ai đang có hàng.",
        "Muốn đăng giá thu mua thì bấm Đăng tin, chọn Tin mua, ghi loài, giá, số lượng, rồi đăng.",
      ],
      async lam({ page, L }) {
        await L.cham(page, L.dock(page, "Chợ cá"), { sau: 1500 });
        await L.cham(page, nut(page, "Mua bán"), { sau: 1200 });
        await L.cham(page, nut(page, "Tin bán"), { sau: 1200 });
        await L.cham(page, nut(page, "Đăng tin"), { sau: 1500 });
        const mua = page.getByText("Tôi cần mua", { exact: true });
        if (await mua.count()) await L.cham(page, mua, { sau: 1200 });
        await L.cuon(page, 400, 1200);
        await page.waitForTimeout(1500);
        await page.keyboard.press("Escape").catch(() => {});
      },
    },
    {
      id: "daumoi",
      noi: ["Mục Đầu mối là danh bạ nậu vựa, chợ sỉ, nhà máy theo từng tỉnh, có nút gọi và nhắn Zalo ngay."],
      async lam({ page, L }) {
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(600);
        await L.cham(page, nut(page, "Đầu mối"), { sau: 2000 });
        await L.cuon(page, 600, 1600);
      },
    },
    {
      id: "gia",
      noi: ["Bấm Giá cá để xem giá tại bến cả tuần, kèm xu hướng đang tăng hay đang giảm, chạm vào từng loài xem biểu đồ giá."],
      async lam({ page, L }) {
        await L.cuon(page, -2000, 700);
        await L.cham(page, nut(page, "Giá cá"), { sau: 1500 });
        await L.cham(page, page.locator('button[aria-label^="Xem biểu đồ giá"]').nth(2), { sau: 3000 });
        await page.keyboard.press("Escape").catch(() => {});
      },
    },
    {
      id: "sen",
      noi: ["Có gì chưa rõ, anh chị chạm vào em ở góc màn hình mà hỏi."],
      async lam({ page, L }) { await hoiSen(page, L, "giá cá thu"); },
    },
    {
      id: "ket",
      noi: ["Chúc anh chị mua được hàng tốt, buôn bán thuận lợi!"],
      async lam({ page }) { await page.waitForTimeout(500); },
    },
  ],
};
