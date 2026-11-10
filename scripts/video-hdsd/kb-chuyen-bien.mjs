// VIDEO 11 — CHUYẾN BIỂN `/lo-trinh` (0900000781 premium) — anh Long 10/11: "làm cái video hướng dẫn cho phần chuyến biển
// mới đi, tính toán chuyến biển ấy". Câu ngừ từ Quy Nhơn: nghề này ra đủ vùng trên dữ liệu thật (lưới vây 10/11 ra 0 vùng).
// Không đụng dữ liệu máy chủ: lộ trình + nhật ký chỉ ở localStorage của khung quay (bỏ khi đóng).
import { nut } from "./chung.mjs";

/** Chỉ con trỏ vào ô chọn rồi đặt giá trị — KHÔNG bấm mở (bảng chọn gốc của máy không hiện trong khung quay). */
async function chon(page, L, loc, giaTri) {
  const l = loc.first();
  await l.scrollIntoViewIfNeeded().catch(() => {});
  const bb = await l.boundingBox();
  if (bb) await L.diChuot(page, bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.waitForTimeout(400);
  await l.selectOption(giaTri);
  await page.waitForTimeout(700);
}
/** Cuộn cho phần tử lên gần đầu màn (mượt). */
async function cuonToi(page, L, loc, tren = 90) {
  const bb = await loc.first().boundingBox().catch(() => null);
  if (bb) await L.cuon(page, bb.y - tren, 1300);
  await page.waitForTimeout(500);
}
/** Mốc lộ trình đã lưu đầu tiên (cảng → vùng 1) để đặt GPS giả "đang trên đường ra vùng 1". */
async function giuaChangDau(page) {
  return page.evaluate(() => {
    try {
      const v = JSON.parse(localStorage.getItem("forfish.routes.v1") || "null");
      const ds = Array.isArray(v) ? v : v?.ds ?? v?.items ?? v?.routes ?? [];
      const m = ds[0]?.ketQua?.moc;
      if (!m || m.length < 2) return null;
      return { latitude: m[0].lat + (m[1].lat - m[0].lat) * 0.6, longitude: m[0].lon + (m[1].lon - m[0].lon) * 0.6 };
    } catch { return null; }
  });
}

export default {
  ten: "11-chuyen-bien",
  tieuDe: "Tính chuyến biển",
  vaiTen: "Gói dự báo",
  phone: "0900000781",
  don: true,
  async chuanBi({ page, L }) {
    await L.den(page, "/", 5000);
    await L.boDongY(page);
    await L.den(page, "/ngu-truong", 12000);
    await L.boDongY(page);
  },
  canh: [
    {
      id: "chao",
      noi: [
        "Chào bà con! Video này hướng dẫn tính chuyến biển: đi mấy ngày, đánh ở vùng nào, tốn khoảng bao nhiêu dầu, ngày nào nên về.",
        "Phần này nằm trong gói dự báo của SDVICO.",
      ],
      async lam({ page, L }) {
        await L.diChuot(page, 220, 420, 1200);
        const bb = await page.locator('button[aria-label^="Thêm việc"]').filter({ visible: true }).first().boundingBox().catch(() => null);
        if (bb) await L.diChuot(page, bb.x + bb.width / 2, bb.y + bb.height / 2, 1200);
      },
    },
    {
      id: "mo",
      noi: ["Trên bản đồ, bấm nút Thêm, rồi chọn Chuyến biển."],
      async lam({ page, L }) {
        await L.cham(page, page.locator('button[aria-label^="Thêm việc"]'), { sau: 900 });
        await L.cham(page, page.locator('button[aria-label^="Chuyến biển"]'), { sau: 400 });
        await page.getByRole("heading", { name: "Chuyến mới" }).waitFor({ timeout: 30000 }).catch(() => {});
        await page.waitForTimeout(800);
      },
    },
    {
      id: "ngay",
      noi: [
        "Đầu tiên chọn ngày đi, giờ ra cảng, và đi mấy ngày.",
        "Bấm nhanh bảy, mười lăm hay mười sáu ngày cũng được. Giờ đi app để sẵn theo nghề, muốn thì sửa lại.",
      ],
      async lam({ page, L }) {
        await L.diChuot(page, 110, 205, 900);
        await page.waitForTimeout(500);
        await L.cham(page, nut(page, "7 ngày"), { sau: 700 });
        await L.cham(page, nut(page, "15 ngày"), { sau: 700 });
      },
    },
    {
      id: "nghe",
      noi: [
        "Chọn nghề của tàu, ví dụ Câu ngừ.",
        "Rồi bấm ô Loài đánh, chọn tới ba loài tàu mình hay đánh, xong bấm Xong. Lộ trình chỉ chấm những chỗ có loài này.",
      ],
      async lam({ page, L }) {
        await L.cham(page, page.getByRole("group", { name: "Nghề" }).getByRole("button", { name: "Câu ngừ", exact: true }), { sau: 900 });
        await L.cham(page, page.getByText("Chọn loài…"), { sau: 1300 });
        await L.cham(page, page.getByRole("dialog").getByRole("button", { name: "Câu ngừ", exact: true }), { sau: 1500 });
        await L.cham(page, nut(page, "Xong"), { sau: 900 });
      },
    },
    {
      id: "cang",
      noi: [
        "Chọn cảng xuất bến, ở đây là cảng Quy Nhơn.",
        "Ô Tàu: tốc độ tàu bao nhiêu hải lý một giờ, két dầu chứa bao nhiêu lít. Chưa biết thì để trống, app nhớ cho lần sau.",
      ],
      async lam({ page, L }) {
        await cuonToi(page, L, page.getByText("Cảng xuất bến", { exact: true }), 260);
        await chon(page, L, page.locator("select").nth(1), { label: "Quy Nhơn — Bình Định" });
        await L.go(page, page.locator('input[placeholder="Tuỳ"]'), "12000", 110);
        await page.keyboard.press("Tab").catch(() => {});
      },
    },
    {
      id: "tinh",
      noi: [
        "Bấm Tính. App tìm các bãi được dự báo có cá, rồi chấm từng ngày theo con trăng và sóng gió lúc đánh.",
      ],
      async lam({ page, L }) {
        await L.cham(page, nut(page, "Tính"), { sau: 300 });
        await page.getByRole("heading", { name: /Lộ trình gợi ý/ }).waitFor({ timeout: 60000 }).catch(() => {});
        await page.waitForTimeout(1500);
        await cuonToi(page, L, page.getByRole("heading", { name: /Lộ trình gợi ý/ }), 40);
      },
    },
    {
      id: "so",
      noi: [
        "Kết quả có ba con số: dầu khoảng bao nhiêu lít, quãng đường bao nhiêu hải lý, và ngày nên về.",
        "Sơ đồ nhỏ bên dưới cho thấy thứ tự đi các vùng: chấm số một, số hai, số ba.",
      ],
      async lam({ page, L }) {
        const so = await page.locator('section[aria-label="Kết quả"] dl').boundingBox().catch(() => null);
        if (so) {
          await L.diChuot(page, so.x + so.width * 0.17, so.y + so.height / 2, 900); await page.waitForTimeout(900);
          await L.diChuot(page, so.x + so.width * 0.5, so.y + so.height / 2, 900); await page.waitForTimeout(900);
          await L.diChuot(page, so.x + so.width * 0.83, so.y + so.height / 2, 900); await page.waitForTimeout(1200);
        }
        await L.cuon(page, 260, 1500);
        await L.diChuot(page, 200, 520, 1200);
      },
    },
    {
      id: "lich",
      noi: [
        "Lịch theo ngày nói rõ ngày nào chạy ra, ngày nào đánh ở vùng nào, thả lúc nào, và mất bao lâu để về tới cảng.",
      ],
      async lam({ page, L }) {
        await cuonToi(page, L, page.getByText("Lịch theo ngày", { exact: true }), 80);
        await L.diChuot(page, 220, 300, 900);
        await L.diChuot(page, 220, 620, 2200);
      },
    },
    {
      id: "vung",
      noi: [
        "Phần Vùng đánh cho biết mỗi ngày đánh: cá thế nào, trăng bao nhiêu, sóng cao mấy mét, gió cấp mấy.",
        "Ngày biển động thì vùng đó bị trừ điểm, động mạnh thì app bỏ ngày đó.",
      ],
      async lam({ page, L }) {
        await cuonToi(page, L, page.getByText("Vùng đánh", { exact: true }), 80);
        await L.diChuot(page, 230, 260, 900);
        await L.diChuot(page, 230, 600, 2600);
      },
    },
    {
      id: "luu",
      noi: [
        "Bấm Lưu để giữ lộ trình trong máy. Ra khơi mất sóng vẫn mở lại được.",
      ],
      async lam({ page, L }) {
        await cuonToi(page, L, page.locator('section[aria-label="Kết quả"]').getByRole("button", { name: "Lưu", exact: true }), 420);
        await L.cham(page, page.locator('section[aria-label="Kết quả"]').getByRole("button", { name: "Lưu", exact: true }), { sau: 1200 });
      },
    },
    {
      id: "banDo",
      noi: [
        "Bấm Bản đồ, app nạp các vùng vào Dẫn đường. Mở nút Thêm, chọn Dẫn đường là thấy đường đi trên bản đồ.",
        "Đoạn nào sóng gió lớn, app báo đỏ ngay bên dưới để bà con cân nhắc.",
      ],
      async lam({ page, L }) {
        // nút nằm sát đáy thì thanh điều hướng che ⇒ cuộn lên giữa màn trước khi bấm
        await cuonToi(page, L, page.locator('button[aria-label^="Xem lộ trình trên bản đồ"]'), 420);
        await L.cham(page, page.locator('button[aria-label^="Xem lộ trình trên bản đồ"]'), { sau: 300 });
        const dongY = page.getByRole("button", { name: "Đồng ý", exact: true }).filter({ visible: true });
        if (await dongY.count()) await L.cham(page, dongY, { sau: 300 });
        await page.waitForSelector("canvas", { timeout: 60000 }).catch(() => {});
        await page.getByText("Đang mở bản đồ").waitFor({ state: "hidden", timeout: 30000 }).catch(() => {});
        await page.waitForTimeout(2500);
        await L.cham(page, page.locator('button[aria-label^="Thêm việc"]'), { sau: 900 });
        await L.cham(page, page.locator('button[aria-label^="Dẫn đường"]'), { sau: 7000 });
      },
    },
    {
      id: "viTri",
      noi: [
        "Đang đi biển, mở lại Chuyến biển, chạm lộ trình đã lưu, rồi bấm Vị trí. App cho biết tàu đang cách tuyến bao xa.",
        "Muốn đổi kế hoạch giữa chừng thì bấm Tính lại, app tính tiếp từ chỗ tàu đang đứng với số ngày còn lại. Không cần sóng điện thoại.",
      ],
      async lam({ page, L }) {
        const gps = await giuaChangDau(page);
        if (gps) await page.context().setGeolocation(gps);
        await L.den(page, "/lo-trinh", 3000);
        const hang = page.locator('section[aria-label="Lộ trình đã lưu"] li button').first();
        await L.cham(page, hang, { sau: 1500 });
        await cuonToi(page, L, page.locator('button[aria-label^="Tôi đang ở đâu"]'), 330);
        await L.cham(page, page.locator('button[aria-label^="Tôi đang ở đâu"]'), { sau: 2600 });
        const tinhLai = page.locator('button[aria-label^="Tính lại lộ trình"]');
        if (await tinhLai.count()) {
          await L.cham(page, tinhLai, { sau: 1500 });
          await cuonToi(page, L, page.getByRole("heading", { name: /Lộ trình gợi ý/ }), 40);
        }
      },
    },
    {
      id: "ket",
      noi: [
        "Lộ trình chỉ là gợi ý tham khảo, thuyền trưởng quyết định. Luôn nghe dự báo chính thức và tin từ tàu bạn.",
        "Chúc bà con chuyến biển bình an, trúng mùa!",
      ],
      async lam({ page, L }) { await L.diChuot(page, 200, 420, 1200); },
    },
  ],
};
