// VIDEO 1 — CHỦ TÀU · CƠ BẢN (tài khoản thường 0900000780, vai Chủ tàu)
import { nut, hoiSen, moBanDo } from "./chung.mjs";
export default {
  ten: "1-chu-tau-co-ban",
  tieuDe: "Chủ tàu — dùng cơ bản",
  vaiTen: "Chủ tàu",
  phone: "0900000780",
  don: true,
  async chuanBi({ page, L }) {
    await L.den(page, "/", 5000);
    await L.boDongY(page);
    await page.evaluate(() => { for (const k of ["forfish.places.v1", "forfish.home.v1", "forfish.boats.v1", "forfish.documents.v1", "forfish.cangnha.tudong.v1"]) localStorage.removeItem(k); });
    await L.den(page, "/ngu-truong", 9000); // làm nóng nền bản đồ
    await L.den(page, "/", 5000);
    await L.boDongY(page);
  },
  canh: [
    {
      id: "chao",
      noi: [
        "Chào bà con! Em là Sen Biển, trợ lý trong ứng dụng SDFish.",
        "Video này em chỉ bà con chủ tàu mấy việc cơ bản, làm một lần là quen tay.",
      ],
      async lam({ page, L }) { await L.diChuot(page, 200, 300, 900); },
    },
    {
      id: "bao",
      noi: ["Mở app lên, dòng trên cùng là tin bão trên Biển Đông. Lúc mất sóng, app vẫn giữ bản tin gần nhất cho mình xem."],
      async lam({ page, L }) {
        const bb = await page.getByText(/bão trên Biển Đông/).first().boundingBox().catch(() => null);
        if (bb) await L.diChuot(page, bb.x + 80, bb.y + 12, 900);
      },
    },
    {
      id: "cang",
      noi: [
        "Việc đầu tiên: bấm Chọn cảng nhà, gõ tên cảng của mình, chạm vào cảng đó, rồi bấm nút Cảng nhà.",
        "Quay về trang chủ, app hiện ngay biển hôm nay ở cảng mình: sóng cao bao nhiêu, gió cấp mấy.",
        "Muốn đổi cảng khác, bà con vào lại danh bạ cảng mà chọn.",
      ],
      async lam({ page, L }) {
        await L.cham(page, page.getByRole("link", { name: /Chọn cảng nhà/ }), { sau: 1500 });
        await L.go(page, page.getByPlaceholder("Tìm cảng theo tên…"), "Quy Nhơn", 90);
        await page.waitForTimeout(700);
        await L.cham(page, page.getByRole("button", { name: /^Quy Nhơn/ }), { sau: 1000 });
        await L.cham(page, page.getByText("Cảng nhà", { exact: true }), { sau: 1200 });
        await L.cham(page, L.dock(page, "Trang chủ"), { sau: 2500 });
        const bb = await page.locator('section[aria-label^="Biển hôm nay"]').boundingBox().catch(() => null);
        if (bb) await L.diChuot(page, bb.x + bb.width * 0.4, bb.y + bb.height / 2, 900);
      },
    },
    {
      id: "bando",
      noi: [
        "Bấm hình cái ghim ở thanh dưới để mở bản đồ biển. Bản đồ này bà con dùng miễn phí.",
        "Chạm vào vùng biển muốn đi, app ghim lại, cho biết cách bờ bao xa, và gió sóng hôm nay ở đó.",
      ],
      async lam({ page, L }) {
        await moBanDo(page, L);
        await L.chamXY(page, 175, 395, { sau: 4500 });
      },
    },
    {
      id: "tau",
      noi: [
        "Qua mục Tàu tôi, hình cái mỏ neo. Bấm Thêm tàu, ghi tên tàu, số đăng ký, chiều dài tàu, rồi bấm Lưu.",
        "Tàu có máy giám sát hành trình thì kéo xuống dưới, bà con thấy luôn hạn cước và cảnh báo của máy.",
      ],
      async lam({ page, L }) {
        await page.keyboard.press("Escape").catch(() => {});
        await L.cham(page, L.dock(page, "Tàu tôi"), { sau: 1500 });
        await L.cham(page, nut(page, "Thêm tàu"), { sau: 800 });
        await L.go(page, page.getByPlaceholder("VD: Tàu câu Bình Minh"), "Tàu Bình Minh", 45);
        await L.go(page, page.getByPlaceholder("VD: BV-1234-TS"), "BĐ-97989-TS", 45);
        await L.go(page, page.getByPlaceholder("VD: 18,00"), "15,5", 60);
        await L.cham(page, nut(page, "Lưu"), { sau: 1000 });
      },
    },
    {
      id: "giay",
      noi: [
        "Tiếp theo là Tủ giấy tờ. Bấm Thêm, chọn loại giấy, ghi ngày hết hạn, rồi bấm Lưu.",
        "Gần tới hạn, app nhắc trước cho mình, khỏi lo bị phạt.",
      ],
      async lam({ page, L }) {
        await L.cham(page, nut(page, "Thêm").first(), { sau: 1000 });
        const sel = page.locator("select").filter({ visible: true }).first();
        await L.cham(page, sel, { sau: 300 });
        await sel.selectOption({ index: 1 }).catch(() => {});
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(500);
        const d = page.locator('input[type="date"]').first();
        await L.cham(page, d, { sau: 200 });
        await d.fill("2026-12-20");
        await page.waitForTimeout(500);
        await L.cham(page, nut(page, "Lưu"), { sau: 1500 });
      },
    },
    {
      id: "xuattrinh",
      noi: ["Khi cán bộ kiểm tra, bà con bấm Xuất trình. Giấy tờ hiện to rõ cả màn hình, ngoài biển không có sóng vẫn mở được."],
      async lam({ page, L }) {
        await L.cham(page, page.getByRole("button", { name: /Xuất trình/ }), { sau: 3500 });
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(600);
      },
    },
    {
      id: "gia",
      noi: ["Muốn biết giá, bấm Chợ cá, hình con cá. Có giá tại bến từng loài cá, tôm, mực, cuối trang có cả giá dầu hôm nay."],
      async lam({ page, L }) {
        await L.cham(page, L.dock(page, "Chợ cá"), { sau: 1500 });
        await L.cuon(page, 900, 2200);
        await page.waitForTimeout(600);
        await L.cuon(page, 1400, 1800);
        await page.waitForTimeout(800);
        await L.cuon(page, -3000, 900);
      },
    },
    {
      id: "sen",
      noi: ["Chỗ nào chưa rõ, bà con chạm vào em ở góc màn hình, nói hoặc nhắn tin là em trả lời liền."],
      async lam({ page, L }) { await hoiSen(page, L, "giá mực"); },
    },
    {
      id: "ket",
      noi: ["Vậy là xong phần cơ bản. Chúc bà con ra khơi bình an, về bến đầy khoang!"],
      async lam({ page }) { await page.waitForTimeout(500); },
    },
  ],
};
