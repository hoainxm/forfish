// VIDEO 10 — GIÁM SÁT HÀNH TRÌNH (S-Tracking): thẻ máy, thông báo & cảnh báo, Sen Biển đọc, gia hạn.
// Tài khoản test 0900000780 GẮN TẠM số chủ tàu GL-99280-TS (sdt_khac, duyet_boi script:video-hdsd — anh Long 06/11 cho
// phép), quay xong gỡ. KHÔNG bấm "Tạo yêu cầu" (tạo yêu cầu gia hạn thật cho nhân viên SDVICO) — chỉ chỉ vào.
import { nut } from "./chung.mjs";
async function chiVao(page, L, loc, ms = 900) {
  const bb = await loc.first().boundingBox().catch(() => null);
  if (bb) await L.diChuot(page, bb.x + Math.min(bb.width / 2, 150), bb.y + bb.height / 2, ms);
}
export default {
  ten: "10-giam-sat-hanh-trinh",
  tieuDe: "Giám sát hành trình — cảnh báo, gia hạn",
  vaiTen: "Chủ tàu",
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
        "Chào bà con! Video này em hướng dẫn phần Giám sát hành trình: xem hạn cước và cảnh báo của máy S-Tracking trên tàu, và gia hạn ngay trong app.",
      ],
      async lam({ page, L }) { await L.diChuot(page, 200, 350, 1000); },
    },
    {
      id: "vao",
      noi: [
        "Bấm Tàu tôi, kéo xuống mục Giám sát hành trình. Máy giám sát đăng ký theo số điện thoại của bà con thì tự hiện ở đây, không phải nhập gì.",
      ],
      async lam({ page, L }) {
        await L.cham(page, L.dock(page, "Tàu tôi"), { sau: 2000 });
        const h = page.getByText("Giám sát hành trình", { exact: true }).first();
        for (let i = 0; i < 6; i++) {
          const bb = await h.boundingBox().catch(() => null);
          if (bb && bb.y < 420) break;
          await L.cuon(page, 320, 700);
        }
        await page.waitForTimeout(800);
        await chiVao(page, L, h, 900);
      },
    },
    {
      id: "the",
      noi: [
        "Mỗi máy một thẻ: số tàu, hạn cước tới ngày nào, đã đồng bộ Tổng cục Thủy sản chưa, tàu đang trong bờ hay ngoài khơi, và lần cuối có tín hiệu.",
        "Hạn cước có ba mức: còn hạn, sắp hết trong ba mươi ngày, và quá hạn.",
      ],
      async lam({ page, L }) {
        await chiVao(page, L, page.getByText(/^GL-99280-TS$/), 900);
        await page.waitForTimeout(1200);
        await chiVao(page, L, page.getByText(/Còn hạn tới|Sắp hết|Quá hạn/), 900);
        await page.waitForTimeout(1500);
        await chiVao(page, L, page.getByText(/Tổng cục/), 900);
        await page.waitForTimeout(1500);
      },
    },
    {
      id: "canhbao",
      noi: [
        "Khi máy có chuyện, như mất tín hiệu, pin dự phòng sắp hết, bấm SOS hay sắp vượt ranh giới, app hiện dòng cảnh báo ngay trong thẻ và gửi thông báo về điện thoại.",
        "Ra khơi mà mất kết nối, app báo trước khi chạm mốc sáu giờ. Nằm bờ thì báo trước khi chạm một ngày chưa báo vị trí. Sắp hết hạn cước hay chưa đồng bộ Tổng cục, app cũng nhắc.",
      ],
      async lam({ page, L }) {
        const bb = await page.getByText(/^GL-99280-TS$/).first().boundingBox().catch(() => null);
        if (bb) await L.diChuot(page, bb.x + 160, bb.y + 70, 1200);
        await page.waitForTimeout(3000);
      },
    },
    {
      id: "nghe",
      noi: ["Ngại đọc chữ thì bấm Nghe, Sen Biển đọc tình trạng các tàu cho bà con nghe."],
      async lam({ page, L }) {
        await L.cham(page, nut(page, "Nghe"), { sau: 3500 });
        const dung = nut(page, "Dừng");
        if (await dung.count()) await L.cham(page, dung, { sau: 800 });
      },
    },
    {
      id: "giahan",
      noi: [
        "Muốn gia hạn, bấm Gia hạn ở thẻ máy. Chọn ba tháng, sáu tháng hay một năm, app tính sẵn số tiền.",
      ],
      async lam({ page, L }) {
        await L.cham(page, page.getByRole("button", { name: /^Gia hạn/ }).first(), { sau: 2000 });
        await L.cham(page, nut(page, "1 năm"), { sau: 1600 });
        await L.cham(page, nut(page, "6 tháng"), { sau: 1400 });
      },
    },
    {
      id: "taoyc",
      noi: [
        "Bấm Tạo yêu cầu để gửi cho SDVICO, nhân viên gọi lại xác nhận và chỉ cách chuyển khoản. App không tự trừ tiền.",
        "Khi hạn trên hệ thống giám sát đổi sang ngày mới, app tự cập nhật. Cần hỏi ngay thì bấm Gọi SDVICO.",
      ],
      async lam({ page, L }) {
        await chiVao(page, L, page.getByText(/App không tự trừ tiền|không tự trừ tiền/), 900);
        await page.waitForTimeout(1500);
        await chiVao(page, L, nut(page, "Tạo yêu cầu"), 900);
        await page.waitForTimeout(2200);
        await chiVao(page, L, page.getByRole("link", { name: /Gọi SDVICO/ }).last(), 900);
        await page.waitForTimeout(1200);
        await L.cham(page, page.locator('button[aria-label="Đóng Gia hạn máy giám sát hành trình"]'), { sau: 1000 });
      },
    },
    {
      id: "yeucau",
      noi: ["Mục Yêu cầu bên dưới để xem các yêu cầu gia hạn đã gửi và đang tới đâu."],
      async lam({ page, L }) {
        const yc = nut(page, "Yêu cầu");
        if (await yc.count()) await L.cham(page, yc, { sau: 2500 });
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(600);
      },
    },
    {
      id: "thongbao",
      noi: [
        "Để không lỡ cảnh báo, bà con bật Thông báo: bấm vào hình đại diện ở Trang chủ, chọn Cài đặt, gạt công tắc Thông báo. Các tin cũng nằm trong mục Thông báo ở Trang chủ.",
      ],
      async lam({ page, L }) {
        await L.cham(page, L.dock(page, "Trang chủ"), { sau: 2000 });
        await L.cham(page, page.locator('button[aria-label^="Tài khoản"]'), { sau: 1300 });
        const cd = page.getByText("Cài đặt", { exact: true }).filter({ visible: true });
        if (await cd.count()) await L.cham(page, cd.first(), { sau: 1500 });
        const sw = page.getByRole("switch", { name: /Thông báo/ });
        if (await sw.count()) await chiVao(page, L, sw, 900);
        await page.waitForTimeout(2000);
        await page.keyboard.press("Escape").catch(() => {});
        await page.keyboard.press("Escape").catch(() => {});
      },
    },
    {
      id: "ket",
      noi: ["Giữ máy giám sát luôn có tín hiệu và còn hạn là giữ an toàn cho cả chuyến biển. Chúc bà con bình an!"],
      async lam({ page }) { await page.waitForTimeout(600); },
    },
  ],
};
