// VIDEO 2 — CHỦ TÀU · NÂNG CAO (tài khoản có gói dự báo 0900000781)
import { nut, moBangSong, moBanDo } from "./chung.mjs";
export default {
  ten: "2-chu-tau-nang-cao",
  tieuDe: "Chủ tàu — tính năng nâng cao",
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
        "Chào bà con! Video này em chỉ những tính năng nâng cao, dành cho tài khoản có gói dự báo.",
        "Bà con muốn mở gói thì gọi cho SDVICO nhé.",
      ],
      async lam({ page, L }) { await L.diChuot(page, 200, 380, 900); },
    },
    {
      id: "duBao",
      noi: [
        "Trên bản đồ, bấm nút Lớp ở góc trên, chọn Ngư trường, rồi bật Dự báo cá.",
        "Chọn nghề của mình, ví dụ câu ngừ, rồi bấm Xong.",
        "Bản đồ tô màu theo khả năng có cá: xanh là thấp, vàng là trung bình, đỏ là cao. Dự báo tính từ ảnh vệ tinh, cập nhật theo ngày.",
      ],
      async lam({ page, L }) {
        await L.cham(page, page.locator('button[aria-label="Mở lớp bản đồ"]'), { sau: 700 });
        await L.cham(page, nut(page, "Ngư trường"), { sau: 700 });
        await L.cham(page, page.getByRole("switch").first(), { sau: 2200 });
        await L.cham(page, nut(page, "Câu ngừ"), { sau: 700 });
        await L.cham(page, nut(page, "Xong"), { sau: 5000 });
        await page.keyboard.press("Escape").catch(() => {});
        await L.diChuot(page, 250, 400, 1500);
      },
    },
    {
      id: "dan",
      noi: [
        "Chạm vào vòng tròn điểm cá, rồi bấm Dẫn đường tới đây.",
        "App vẽ tuyến đi né chỗ sóng to gió lớn, tính luôn mấy tiếng thì tới và tốn khoảng bao nhiêu lít dầu.",
      ],
      async lam({ page, L }) {
        const d = page.locator('button[aria-label^="Điểm có khả năng nhiều cá"]').filter({ visible: true });
        const n = await d.count();
        await L.cham(page, d.nth(Math.min(3, Math.max(0, n - 1))), { sau: 2200 });
        await L.cham(page, page.locator('button[aria-label="Dẫn đường tới đây"]'), { sau: 9000 });
      },
    },
    {
      id: "ngay",
      noi: [
        "Muốn xem thời tiết mấy ngày tới, mở bảng gió sóng ở dưới, chọn Ngày mai hoặc ngày khác. Gói dự báo xem được tới mười sáu ngày.",
      ],
      async lam({ page, L }) {
        const thoat = page.locator('button[aria-label="Thoát chế độ dẫn đường"]');
        if (await thoat.count()) await L.cham(page, thoat, { sau: 1500 });
        await moBangSong(page);
        await L.cham(page, nut(page, "Ngày mai"), { sau: 2000 });
        const c = page.getByRole("button", { name: /^CN \d+$/ }).first();
        if (await c.count()) await L.cham(page, c, { sau: 2000 });
        await page.keyboard.press("Escape").catch(() => {});
      },
    },
    {
      id: "chuyen",
      noi: [
        "Đi chuyến dài ngày thì bấm Thêm, chọn Chuyến biển. Ghi ngày đi, số ngày, nghề, cảng xuất bến, rồi bấm Tính.",
        "App đề xuất lộ trình từng ngày, nhắc lúc nào nên về, và ước lượng dầu cho cả chuyến.",
        "Lộ trình chỉ là gợi ý tham khảo, thuyền trưởng vẫn là người quyết định.",
      ],
      async lam({ page, L }) {
        await L.cham(page, page.locator('button[aria-label^="Thêm việc"]'), { sau: 800 });
        await L.cham(page, page.locator('button[aria-label^="Chuyến biển"]'), { sau: 3000 });
        await L.cham(page, nut(page, "7 ngày"), { sau: 600 });
        await L.cham(page, nut(page, "Câu ngừ"), { sau: 600 });
        const sel = page.locator("select").filter({ visible: true }).first();
        await L.cham(page, sel, { sau: 300 });
        await sel.selectOption({ label: /Quy Nhơn/ }).catch(async () => {
          const o = await sel.locator("option").allInnerTexts();
          const i = o.findIndex((x) => /Quy Nhơn/.test(x));
          if (i > 0) await sel.selectOption({ index: i });
        });
        await page.keyboard.press("Escape").catch(() => {});
        await L.cham(page, nut(page, "Tính"), { sau: 7000 });
        await L.cuon(page, 500, 1500);
      },
    },
    {
      id: "ban",
      noi: [
        "Qua Tàu tôi, mục Bạn thuyền. Bấm Thêm, ghi họ tên và số căn cước của người đi bạn, rồi Lưu.",
        "Với gói dự báo, bà con bấm Cảnh báo để tra xem người này có bị chủ tàu khác báo xấu hay không, trước khi nhận đi chuyến.",
      ],
      async lam({ page, L }) {
        await L.cham(page, L.dock(page, "Tàu tôi"), { sau: 1500 });
        await L.cham(page, page.getByRole("link", { name: "Bạn thuyền", exact: true }), { sau: 1500 });
        await L.cham(page, nut(page, "Thêm"), { sau: 900 });
        await L.go(page, page.getByPlaceholder("VD: Nguyễn Văn Hai"), "Đặng Văn Hùng", 45);
        const cc = page.getByPlaceholder("VD: 079090001234");
        await L.go(page, cc, "052090007788", 45);
        if (!(await cc.inputValue().catch(() => ""))) await cc.fill("052090007788");
        await L.cham(page, nut(page, "Lưu"), { sau: 1500 });
        const cb = page.getByRole("button", { name: /Cảnh báo/ }).filter({ visible: true });
        if (await cb.count()) await L.cham(page, cb.first(), { sau: 2000 });
        const tra = page.getByRole("button", { name: /Tra cảnh báo/ }).filter({ visible: true });
        if (await tra.count()) await L.cham(page, tra.first(), { sau: 3500 });
      },
    },
    {
      id: "ket",
      noi: ["Vậy là xong phần nâng cao. Chúc bà con đánh bắt trúng mùa, đi an toàn, về an toàn!"],
      async lam({ page }) { await page.keyboard.press("Escape").catch(() => {}); await page.waitForTimeout(500); },
    },
  ],
};
