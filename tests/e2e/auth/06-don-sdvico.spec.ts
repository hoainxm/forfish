import { expect, test, type Page } from "@playwright/test";
import { installMocks, seedSession } from "../auth-mocks";

// ĐƠN SDVICO (mua qua CRM) ở `/cho/don` — ADR 0018. Build "auth" (Supabase giả):
// đăng nhập SĐT 0901234567 dựng sẵn; API /api/cho/don* MOCK ở trình duyệt với dữ
// liệu ĐÃ QUA webhook (crm_orders). Kiểm: thẻ vào đúng tab, chip đúng, KHÔNG có
// nút thao tác, chi tiết đọc được hàng + tổng, đơn huỷ hiện "Đã huỷ".

const ORDERS = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    code: "DH75901",
    status: "dang_chuan_bi",
    orderedAt: "2026-11-02T02:00:00Z",
    items: [{ name: "Máy định vị S-Tracking", qty: 1, unit: "cái", unitPriceVnd: 5500000, lineTotalVnd: 5500000 }],
    services: [{ name: "Lắp đặt", qty: 1, unitPriceVnd: 300000, lineTotalVnd: 300000 }],
    subtotalVnd: 5500000, discountVnd: 0, vatVnd: 440000, serviceVnd: 300000, totalVnd: 6240000,
    carrierName: null, trackingNumber: null, updatedAt: "2026-11-02T02:00:00Z",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    code: "DH75850",
    status: "dang_giao",
    orderedAt: "2026-10-30T02:00:00Z",
    items: [{ name: "Ắc quy 12V 100Ah", qty: 2, unit: "bình", unitPriceVnd: 2100000, lineTotalVnd: 4200000 }],
    services: [],
    subtotalVnd: 4200000, discountVnd: 0, vatVnd: 0, serviceVnd: 0, totalVnd: 4200000,
    carrierName: "Viettel Post", trackingNumber: "VTP123", updatedAt: "2026-11-01T02:00:00Z",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    code: "DH75700",
    status: "da_giao",
    orderedAt: "2026-10-20T02:00:00Z",
    items: [{ name: "Anten vệ tinh SF-50", qty: 1, unit: "cái", unitPriceVnd: 9900000, lineTotalVnd: 9900000 }],
    services: [],
    subtotalVnd: 9900000, discountVnd: 0, vatVnd: 0, serviceVnd: 0, totalVnd: 9900000,
    carrierName: null, trackingNumber: null, updatedAt: "2026-10-25T02:00:00Z",
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    code: "DH75600",
    status: "da_huy",
    orderedAt: "2026-10-15T02:00:00Z",
    items: [{ name: "Cáp đồng trục RG-58", qty: 10, unit: "m", unitPriceVnd: 15000, lineTotalVnd: 150000 }],
    services: [],
    subtotalVnd: 150000, discountVnd: 0, vatVnd: 0, serviceVnd: 0, totalVnd: 150000,
    carrierName: null, trackingNumber: null, updatedAt: "2026-10-16T02:00:00Z",
  },
];

async function mockDonApi(page: Page) {
  await page.context().route(/\/api\/cho\/don/, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/cho/don-sdvico") return route.fulfill({ json: { ok: true, items: ORDERS } });
    const m = path.match(/^\/api\/cho\/don-sdvico\/(.+)$/);
    if (m) {
      const order = ORDERS.find((o) => o.id === m[1]);
      return order
        ? route.fulfill({ json: { ok: true, order } })
        : route.fulfill({ status: 404, json: { ok: false, code: "not_found" } });
    }
    // đơn chợ: không có đơn nào — màn chỉ còn đơn SDVICO
    return route.fulfill({ json: { ok: true, items: [], total: 0 } });
  });
}

test.beforeEach(async ({ page, context, baseURL }) => {
  await seedSession(context, baseURL!);
  await installMocks(page);
  await mockDonApi(page);
});

test("đơn SDVICO: đúng tab, đúng chip, chỉ xem — rồi mở chi tiết", async ({ page }) => {
  await page.goto("/cho/don");
  const list = page.getByRole("list", { name: "Đơn SDVICO" });

  // Đang xử lý = chuẩn bị + đang giao
  await expect(list.getByText("DH75901")).toBeVisible({ timeout: 30_000 });
  await expect(list.getByText("DH75850")).toBeVisible();
  await expect(list.getByText("Chuẩn bị")).toBeVisible();
  await expect(list.getByText("Đang giao")).toBeVisible();
  await expect(list.getByText("DH75700")).toHaveCount(0);
  // CHỈ XEM — không nút thao tác của đơn chợ
  for (const nut of ["Huỷ đơn", "Đã nhận hàng", "Đã chuyển khoản"]) {
    await expect(page.getByRole("button", { name: nut })).toHaveCount(0);
  }
  await page.screenshot({ path: "test-reports/triage/e2e-output/sdvico-don-dang-xu-ly.png", fullPage: true });

  // Chờ nhận: không có đơn SDVICO
  await page.getByRole("button", { name: /Chờ nhận/ }).click();
  await expect(page.getByRole("list", { name: "Đơn SDVICO" })).toHaveCount(0);

  // Xong: đơn đã giao
  await page.getByRole("button", { name: /^Xong/ }).click();
  await expect(list.getByText("DH75700")).toBeVisible();
  await expect(list.getByText("Đã giao")).toBeVisible();

  // Đã huỷ
  await page.getByRole("button", { name: /^Đã huỷ/ }).click();
  await expect(list.getByText("DH75600")).toBeVisible();
  await expect(list.getByText("Đã huỷ", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-reports/triage/e2e-output/sdvico-don-da-huy.png", fullPage: true });

  // Chi tiết
  await page.getByRole("button", { name: /Đang xử lý/ }).click();
  await list.getByText("DH75901").click();
  await expect(page).toHaveURL(/\/cho\/don-sdvico\/11111111-/);
  await expect(page.getByText("Đang chuẩn bị hàng")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Ngày đặt: 02/11/2026")).toBeVisible(); // mốc giờ → ngày lịch VN
  await expect(page.getByText("Máy định vị S-Tracking")).toBeVisible();
  await expect(page.getByText("Lắp đặt")).toBeVisible();
  await expect(page.getByText("Thuế VAT")).toBeVisible();
  await expect(page.getByText("6.240.000", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Gọi SDVICO/ })).toBeVisible();
  for (const nut of ["Huỷ đơn", "Đã nhận hàng", "Mua lại"]) {
    await expect(page.getByRole("button", { name: nut })).toHaveCount(0);
  }
  await page.screenshot({ path: "test-reports/triage/e2e-output/sdvico-don-chi-tiet.png", fullPage: true });
});

test("đơn SDVICO của người khác / không có → Không tìm thấy", async ({ page }) => {
  await page.goto("/cho/don-sdvico/99999999-9999-4999-8999-999999999999");
  await expect(page.getByText("Không tìm thấy đơn này.")).toBeVisible({ timeout: 30_000 });
});
