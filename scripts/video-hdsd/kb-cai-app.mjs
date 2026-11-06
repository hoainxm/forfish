// VIDEO 7 — CÀI APP SDFISH VỀ MÁY (Android + iPhone) + PWA lưu dữ liệu thế nào. Màn app THẬT (giả UA máy) + màn
// trình duyệt MINH HOẠ (minh-hoa.html, góc trên ghi "MINH HOẠ") vì máy quay không có điện thoại thật.
import * as Lb from "./lib.mjs";
const MH = "file:///" + Lb.SRC + "minh-hoa.html";
const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
async function moTheCai(page, L) {
  // mục "Cài app" CỐ ĐỊNH trong menu Tài khoản (thẻ ở Trang chủ có trần số lần nhắc nên không phải lúc nào cũng hiện)
  await L.cham(page, page.locator('button[aria-label^="Tài khoản"]'), { sau: 1200 });
  await L.cham(page, page.getByText("Cài app", { exact: true }).filter({ visible: true }).last(), { sau: 1500 });
  const bb = await page.getByText(/^Trên (Android|iPhone)/).filter({ visible: true }).first().boundingBox().catch(() => null);
  if (bb) await L.diChuot(page, bb.x + bb.width * 0.5, bb.y + bb.height * 0.5, 1000);
}
export default {
  ten: "7-cai-app",
  tieuDe: "Cài SDFish về điện thoại",
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
        "Chào bà con! Video này em chỉ cách cài SDFish về điện thoại, máy Android hay iPhone đều được.",
        "Mở trình duyệt, gõ đúng địa chỉ sdfish.sdvico.vn.",
      ],
      async lam({ page, L }) {
        await page.goto(MH);
        await page.waitForTimeout(800);
        await page.evaluate(() => window.mh.go("sdfish.sdvico.vn"));
        await page.waitForTimeout(2600);
      },
    },
    {
      id: "pwa",
      noi: [
        "SDFish là ứng dụng web cài được, gọi là PWA. Cài ra màn hình chính thì mở như app thường, không cần vào CH Play hay App Store.",
        "App lưu dự báo, bản đồ, giấy tờ ngay trong máy, nên ra khơi mất sóng vẫn mở xem được.",
      ],
      async lam({ page, L }) {
        await L.den(page, "/", 3500);
        await L.boDongY(page);
        await L.diChuot(page, 200, 160, 900);
        await moTheCai(page, L);
      },
    },
    {
      id: "android",
      noi: [
        "Với máy Android: trong Chrome, bấm nút ba chấm ở góc trên bên phải, không phải nút chia sẻ.",
        "Chọn Thêm vào Màn hình chính, có máy ghi là Cài ứng dụng, rồi bấm Thêm. Biểu tượng SDFish hiện ngay ngoài màn hình.",
      ],
      async lam({ page, L }) {
        await page.goto(MH);
        await page.evaluate(() => { document.getElementById("u").textContent = "sdfish.sdvico.vn"; });
        await page.waitForTimeout(600);
        await L.cham(page, "#dots", { sau: 1200 });
        await L.cham(page, "#them", { sau: 1500 });
        await L.cham(page, "#cai", { sau: 1500 });
        await L.diChuot(page, 300, 220, 900);
      },
    },
    {
      id: "iphone",
      noi: [
        "Với iPhone: phải mở bằng Safari. App cũng tự hiện hướng dẫn đúng cho iPhone.",
        "Bấm nút Chia sẻ ở thanh dưới, kéo xuống chọn Thêm vào Màn hình chính, rồi bấm Thêm.",
        "Trên iPhone, app còn nhắc thêm một dòng chữ đỏ: cài xong thì mở app vừa cài ngay khi còn sóng.",
      ],
      async lam({ page, L }) {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send("Network.setUserAgentOverride", { userAgent: IPHONE_UA, platform: "iPhone" });
        await L.den(page, "/", 3500);
        await L.boDongY(page);
        await moTheCai(page, L);
        await page.waitForTimeout(1500);
        await page.goto(MH + "#ios");
        await page.waitForTimeout(700);
        await L.cham(page, "#share", { sau: 1300 });
        await L.cham(page, "#ithem", { sau: 1300 });
        await L.cham(page, "#ok", { sau: 1500 });
        await L.diChuot(page, 300, 220, 900);
      },
    },
    {
      id: "luu-y",
      noi: [
        "Lưu ý với iPhone: cài xong, mở ngay biểu tượng SDFish lúc còn sóng, để app tải dự báo về một lần. Nếu không cài, Safari có thể tự xoá dữ liệu sau vài ngày không mở.",
      ],
      async lam({ page, L }) {
        const bb = await page.locator("#hicon").boundingBox().catch(() => null);
        if (bb) await L.chamXY(page, bb.x + bb.width / 2, bb.y + bb.height / 2, { sau: 1200 });
        await L.den(page, "/ngu-truong", 7000);
        await L.boDongY(page);
      },
    },
    {
      id: "san-sang",
      noi: [
        "Mỗi lần mở bản đồ lúc có sóng, app tự tải sẵn dữ liệu đi biển. Nút nhỏ bên phải cho biết dữ liệu đã đủ chưa, chạm vào để xem.",
      ],
      async lam({ page, L }) {
        const d = page.locator('button[aria-label^="Dữ liệu đi biển"]').filter({ visible: true });
        if (await d.count()) await L.cham(page, d.first(), { sau: 3500 });
        else await page.waitForTimeout(3000);
        await page.keyboard.press("Escape").catch(() => {});
      },
    },
    {
      id: "ket",
      noi: ["Vậy là xong. Nhớ địa chỉ sdfish.sdvico.vn, cài một lần, dùng cả chuyến biển. Chúc bà con bình an!"],
      async lam({ page }) { await page.waitForTimeout(600); },
    },
  ],
};
