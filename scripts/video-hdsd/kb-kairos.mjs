// VIDEO 9 — KAIROS: dòng tin nghề cá, nghe Sen Biển đọc, tải bài mang ra biển, tab Chính sách (lọc tỉnh, loại tin,
// bài luật kèm hạn giấy của mình). Tài khoản thường 0900000780. KHÔNG đăng bài / thả cảm xúc thật (công khai) — chỉ chỉ vào.
import { nut } from "./chung.mjs";
async function chiVao(page, L, loc, ms = 900) {
  const bb = await loc.first().boundingBox().catch(() => null);
  if (bb) await L.diChuot(page, bb.x + Math.min(bb.width / 2, 140), bb.y + bb.height / 2, ms);
}
export default {
  ten: "9-kairos",
  tieuDe: "Kairos — tin tức, chính sách",
  vaiTen: "Mọi người",
  phone: "0900000780",
  don: false,
  async chuanBi({ page, L }) {
    await L.den(page, "/", 5000);
    await L.boDongY(page);
  },
  canh: [
    {
      id: "chao",
      noi: [
        "Chào bà con! Video này em giới thiệu Kairos, mục tin tức của SDFish.",
        "Bấm hình con cá heo ở thanh dưới, ô thứ hai từ trái sang.",
      ],
      async lam({ page, L }) {
        await L.diChuot(page, 200, 400, 900);
        await L.cham(page, L.dock(page, "Kairos"), { sau: 2500 });
      },
    },
    {
      id: "dongtin",
      noi: [
        "Tab Dòng tin gom tin thời sự, tin nghề cá, bản tin giá thủy sản, và chuyện bà con khắp nơi chia sẻ. Kéo xuống để xem thêm.",
      ],
      async lam({ page, L }) {
        await L.cuon(page, 1100, 2200);
        await page.waitForTimeout(700);
        await L.cuon(page, 900, 1800);
        await page.waitForTimeout(500);
        await L.cuon(page, -4000, 900);
      },
    },
    {
      id: "doc",
      noi: [
        "Bài dài thì bấm Xem thêm để đọc hết. Ngại đọc chữ thì bấm hình cái loa, Sen Biển đọc cho bà con nghe.",
      ],
      async lam({ page, L }) {
        const xem = page.locator('button[aria-label="Xem thêm — đọc hết"]');
        if (await xem.count()) await L.cham(page, xem.first(), { sau: 1800 });
        const loa = page.locator('button[aria-label="Nghe bài này"]');
        if (await loa.count()) await chiVao(page, L, loa, 900);
        await page.waitForTimeout(1500);
      },
    },
    {
      id: "tai",
      noi: [
        "Trước khi ra khơi, bấm Tải ở dòng Tải bài đọc trên biển. App lưu sẵn bài vào máy, ngoài biển mất sóng vẫn mở ra đọc được.",
      ],
      async lam({ page, L }) {
        await L.cuon(page, -3000, 600);
        const tai = nut(page, "Tải");
        if (await tai.count()) await L.cham(page, tai, { sau: 3500 });
        else await page.waitForTimeout(2000);
      },
    },
    {
      id: "chinhsach",
      noi: [
        "Qua tab Chính sách: tin của các cơ quan nhà nước, và những bài Sen Biển nhắc luật cho bà con.",
        "App tự lọc theo tỉnh nơi máy đang ở. Muốn xem tỉnh khác thì bấm vào tên tỉnh mà đổi, hoặc lọc theo loại tin.",
      ],
      async lam({ page, L }) {
        await L.cham(page, page.getByText("Chính sách", { exact: true }).first(), { sau: 2500 });
        const tinh = page.locator('button[aria-label^="Chọn tỉnh"]');
        if (await tinh.count()) {
          await L.cham(page, tinh.first(), { sau: 2000 });
          await page.keyboard.press("Escape").catch(() => {});
          await page.waitForTimeout(600);
        }
        const loai = page.locator('button[aria-label^="Loại tin"]');
        if (await loai.count()) {
          await L.cham(page, loai.first(), { sau: 2000 });
          await page.keyboard.press("Escape").catch(() => {});
          await page.waitForTimeout(600);
        }
      },
    },
    {
      id: "giay",
      noi: [
        "Bài nhắc luật nào liên quan giấy tờ thì có thêm phần Giấy tờ của bà con, kèm nút Nhập. Bấm Nhập để ghi hạn giấy vào tủ giấy tờ, app nhắc trước khi hết hạn.",
      ],
      async lam({ page, L }) {
        const nhap = page.getByRole("link", { name: "Nhập", exact: true });
        if (await nhap.count()) {
          await nhap.first().scrollIntoViewIfNeeded().catch(() => {});
          await page.waitForTimeout(600);
          await chiVao(page, L, page.getByText("Giấy tờ của bà con").first(), 900);
          await chiVao(page, L, nhap, 900);
          await page.waitForTimeout(1200);
        } else await L.cuon(page, 700, 1500);
      },
    },
    {
      id: "chiase",
      noi: [
        "Muốn kể chuyện nghề, hỏi kinh nghiệm, bà con bấm ô Bà con muốn chia sẻ gì ở đầu Dòng tin. Bài đăng lên ai cũng thấy, nên đừng ghi số căn cước hay chuyện riêng tư nhé.",
      ],
      async lam({ page, L }) {
        await L.cham(page, page.getByText("Dòng tin", { exact: true }).first(), { sau: 1800 });
        await L.cuon(page, -3000, 500);
        await chiVao(page, L, page.getByText("Bà con muốn chia sẻ gì?"), 900);
        await page.waitForTimeout(2600);
      },
    },
    {
      id: "ket",
      noi: ["Vậy là xong phần Kairos. Chúc bà con đọc tin vui, đi biển bình an!"],
      async lam({ page }) { await page.waitForTimeout(600); },
    },
  ],
};
