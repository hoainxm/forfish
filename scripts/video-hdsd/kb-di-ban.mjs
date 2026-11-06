// VIDEO 3 — ĐI BẠN (0900000782, vai ngư dân đi bạn)
import { nut, hoiSen } from "./chung.mjs";
export default {
  ten: "3-di-ban",
  tieuDe: "Đi bạn — tìm tàu, giữ giấy tờ",
  vaiTen: "Đi bạn",
  phone: "0900000782",
  don: true,
  async chuanBi({ page, L }) {
    await L.den(page, "/", 5000);
    await L.boDongY(page);
  },
  canh: [
    {
      id: "chao",
      noi: [
        "Chào bà con! Video này dành cho bà con đi bạn, tức là người đi làm trên tàu của chủ khác.",
        "Trang chủ có tin bão, và các tàu đang tuyển người quanh cảng mình.",
      ],
      async lam({ page, L }) {
        await L.diChuot(page, 200, 250, 900);
        const bb = await page.getByText("Tàu đang tuyển người").first().boundingBox().catch(() => null);
        if (bb) await L.diChuot(page, bb.x + 90, bb.y + 10, 1000);
      },
    },
    {
      id: "viec",
      noi: [
        "Bấm Việc làm ở thanh dưới, hình cái cặp. Chọn nghề mình làm, chọn vị trí, app lọc ra tàu đang tuyển.",
        "Thấy tàu hợp thì bấm Gọi, nói chuyện thẳng với chủ tàu, không qua môi giới.",
      ],
      async lam({ page, L }) {
        await L.cham(page, L.dock(page, "Việc làm"), { sau: 1800 });
        const s = page.locator("select").filter({ visible: true });
        await L.cham(page, s.nth(0), { sau: 300 });
        await s.nth(0).selectOption({ label: "Câu mực" }).catch(() => {});
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(700);
        await L.cham(page, s.nth(1), { sau: 300 });
        await s.nth(1).selectOption({ label: "Thuyền viên" }).catch(() => {});
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(1200);
      },
    },
    {
      id: "hoso",
      noi: [
        "Chưa thấy tàu hợp, bà con bấm Hồ sơ để lập hồ sơ tìm tàu: chọn nghề đã làm, vị trí muốn làm, cảng muốn đi, rồi bấm Lưu.",
        "Chủ tàu đang cần người sẽ thấy hồ sơ và gọi cho mình.",
      ],
      async lam({ page, L }) {
        await L.cham(page, page.getByRole("link", { name: "Hồ sơ", exact: true }), { sau: 1800 });
        await L.cham(page, page.getByRole("checkbox", { name: "Câu mực" }).or(page.getByLabel("Câu mực")).first(), { sau: 500 });
        await L.cham(page, page.getByRole("checkbox", { name: "Thuyền viên" }).or(page.getByLabel("Thuyền viên")).first(), { sau: 500 });
        const sel = page.locator('select[aria-label="Thêm cảng"]');
        await L.cham(page, sel, { sau: 300 });
        await sel.selectOption({ label: "Quy Nhơn" }).catch(() => {});
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(600);
        await L.go(page, page.getByPlaceholder("Ví dụ: quen câu mực, đi được chuyến dài"), "Đi câu mực 5 năm, đi chuyến dài được", 40);
        const luu = nut(page, "Lưu");
        const bb = await luu.boundingBox().catch(() => null);
        if (bb) await L.diChuot(page, bb.x + bb.width / 2, bb.y + bb.height / 2, 800);
        await page.waitForTimeout(1200);
        await page.goBack().catch(() => {});
      },
    },
    {
      id: "giay",
      noi: [
        "Giấy tờ riêng của mình, như chứng chỉ thuyền viên, bà con cất trong mục Giấy tờ của tôi. Ghi ngày hết hạn để app nhắc trước.",
      ],
      async lam({ page, L }) {
        await L.den(page, "/viec/giay", 2500);
        await L.cham(page, nut(page, "Thêm"), { sau: 1000 });
        const sel = page.locator("select").filter({ visible: true }).first();
        await L.cham(page, sel, { sau: 300 });
        await sel.selectOption({ index: 1 }).catch(() => {});
        await page.keyboard.press("Escape").catch(() => {});
        const d = page.locator('input[type="date"]').first();
        await L.cham(page, d, { sau: 200 });
        await d.fill("2027-03-15");
        await page.waitForTimeout(400);
        await L.cham(page, nut(page, "Lưu"), { sau: 1800 });
      },
    },
    {
      id: "kairos",
      noi: [
        "Mục Kairos là nơi đọc tin nghề cá, xem chính sách hỗ trợ của nhà nước, và chia sẻ chuyện nghề với bà con khắp nơi.",
      ],
      async lam({ page, L }) {
        await L.cham(page, L.dock(page, "Kairos"), { sau: 2500 });
        await L.cuon(page, 700, 2000);
        await page.waitForTimeout(500);
        await L.cuon(page, -3000, 600);
        const cs = page.getByText("Chính sách", { exact: true });
        if (await cs.count()) await L.cham(page, cs.first(), { sau: 2500 });
      },
    },
    {
      id: "gia",
      noi: ["Bấm Chợ cá xem giá cá tại bến mỗi tuần, để biết ghe về bán được bao nhiêu."],
      async lam({ page, L }) {
        await L.cham(page, L.dock(page, "Chợ cá"), { sau: 1500 });
        await L.cuon(page, 800, 2000);
        await L.cuon(page, -2000, 700);
      },
    },
    {
      id: "sen",
      noi: ["Cần hỏi gì, bà con chạm vào em ở góc màn hình, em trả lời liền."],
      async lam({ page, L }) { await hoiSen(page, L, "giấy tờ gì sắp hết hạn"); },
    },
    {
      id: "ket",
      noi: ["Chúc bà con sớm tìm được tàu tốt, đi làm bình an!"],
      async lam({ page }) { await page.waitForTimeout(500); },
    },
  ],
};
