// VIDEO 8 — TÀU QUANH ĐÂY (AIS) — giữ tay ~3 giây trên bản đồ ⇒ "Tàu quanh" ⇒ tàu trong vòng 6 hải lý, 6 giờ qua.
// Mở cho tài khoản có gói dự báo (fishing-map-view `tauQuanhAllowed`). Tài khoản 0900000781 (premium).
/** Giữ lâu trên bản đồ bằng chuột. Trên điện thoại nhấc ngón sau khi giữ lâu KHÔNG sinh "click"; chuột thì có, và cú
 *  click đó đóng menu ngay ⇒ nuốt đúng MỘT click sau lần nhả này cho giống tay thật. */
async function giuLau(page, L, x, y, ms = 2800) {
  await page.evaluate(() => {
    if (!window.__coNuot) {
      window.__coNuot = true;
      addEventListener("click", (e) => { if (window.__nuot) { window.__nuot = false; e.stopPropagation(); e.preventDefault(); } }, true);
    }
  });
  await L.diChuot(page, x, y, 700);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.evaluate(() => { window.__nuot = true; });
  await page.mouse.up();
  await page.waitForTimeout(700);
}
export default {
  ten: "8-tau-quanh-ais",
  tieuDe: "Tàu quanh đây (AIS)",
  vaiTen: "Gói dự báo",
  phone: "0900000781",
  don: false,
  async chuanBi({ page, L }) {
    await L.den(page, "/", 5000);
    await L.boDongY(page);
    await L.den(page, "/ngu-truong", 11000);
    await L.boDongY(page);
  },
  canh: [
    {
      id: "chao",
      noi: [
        "Chào bà con! Video này giới thiệu tính năng Tàu quanh đây: xem những tàu đang ở, hoặc vừa đi qua quanh một điểm trên biển, theo tín hiệu AIS.",
        "Tính năng này dành cho tài khoản có gói dự báo.",
      ],
      async lam({ page, L }) { await L.diChuot(page, 200, 420, 1200); },
    },
    {
      id: "giu",
      noi: [
        "Trên bản đồ, đặt ngón tay vào chỗ muốn xem rồi giữ yên chừng ba giây. Menu hiện ra, có thêm dòng Tàu quanh, bà con chạm vào đó.",
      ],
      async lam({ page, L }) {
        await giuLau(page, L, 152, 384);
        await L.cham(page, page.getByRole("button", { name: /Tàu quanh/ }).first(), { sau: 1500 });
      },
    },
    {
      id: "kq",
      noi: [
        "App vẽ một vòng tròn sáu hải lý quanh điểm đó, rồi liệt kê các tàu trong sáu giờ qua: tàu nào đang ở đây, tàu nào đã đi qua, và là loại tàu gì.",
      ],
      async lam({ page, L }) {
        await page.getByText("Đang tìm tàu quanh điểm này").waitFor({ state: "hidden", timeout: 25000 }).catch(() => {});
        await page.waitForTimeout(1200);
        const bb = await page.getByText("Tàu quanh đây", { exact: false }).first().boundingBox().catch(() => null);
        if (bb) await L.diChuot(page, bb.x + 120, bb.y + 140, 1200);
      },
    },
    {
      id: "loc",
      noi: [
        "Mấy ô số phía trên dùng để lọc: chỉ xem tàu đang ở, tàu đã qua, tàu hàng, hay tàu khác. Bấm lại lần nữa là bỏ lọc.",
      ],
      async lam({ page, L }) {
        const o = page.locator('button[aria-label^="Đang ở đây"]');
        if (await o.count()) {
          await L.cham(page, o.first(), { sau: 2000 });
          await L.cham(page, o.first(), { sau: 1200 });
        }
        const da = page.locator('button[aria-label^="Đã qua"]');
        if (await da.count()) {
          await L.cham(page, da.first(), { sau: 2000 });
          await L.cham(page, da.first(), { sau: 800 });
        }
      },
    },
    {
      id: "chitiet",
      noi: [
        "Chạm vào một tàu để xem nó cách điểm bao nhiêu hải lý, ở đó từ lúc nào, và chỗ gần nhất của nó. Trên bản đồ, tàu đó cũng được tô đậm.",
      ],
      async lam({ page, L }) {
        // dòng tàu đầu tiên trong danh sách (loại tàu đổi theo giờ — có lúc toàn "chưa rõ loại")
        const p = await page.evaluate(() => {
          const b = [...document.querySelectorAll("button")].find((e) => { const r = e.getBoundingClientRect(); return r.width > 150 && /^Tàu (?!quanh)/.test((e.innerText || "").trim()) && /(Đang ở|\d+ giờ)\s*$/.test(e.innerText || ""); });
          if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 3, y: r.y + r.height / 2 };
        });
        if (p) await L.chamXY(page, p.x, p.y, { sau: 4000 });
      },
    },
    {
      id: "luuy",
      noi: [
        "Số liệu lấy theo mốc mỗi giờ, nên có thể sót tàu chạy nhanh hoặc tàu tắt AIS. Bà con dùng để tham khảo, biết chỗ nào đông tàu mà đi cho an toàn.",
      ],
      async lam({ page, L }) {
        const bb = await page.getByText(/Mốc mỗi giờ/).first().boundingBox().catch(() => null);
        if (bb) await L.diChuot(page, bb.x + 100, bb.y + 8, 1200);
        await page.waitForTimeout(1500);
      },
    },
    {
      id: "ket",
      noi: ["Xem xong bấm dấu X để đóng. Chúc bà con đi biển bình an!"],
      async lam({ page, L }) {
        const x = page.locator('button[aria-label="Đóng danh sách tàu quanh đây"]');
        if (await x.count()) await L.cham(page, x.first(), { sau: 1500 });
      },
    },
  ],
};
