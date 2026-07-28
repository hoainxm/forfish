import { test, expect } from "@playwright/test";
import {
  installOverlay,
  caption,
  hideCaption,
  tap,
  typeSlow,
  scrollTo,
} from "../tutorial-helpers";
import { seedSession, installMocks } from "../auth-mocks";

// VIDEO 5 — GIAO DỊCH MUA BÁN: bảng giá cá + giá dầu, chợ tin mua/bán (xem,
// lọc, ĐĂNG TIN), danh bạ chỗ bán. (Tin trên chợ là dữ liệu DỰNG SẴN cho video.)
test("video 5 — giao dịch: giá cá, tin mua bán, chỗ bán", async ({ page, context, baseURL }) => {
  await seedSession(context, baseURL!);
  await installMocks(page);
  await installOverlay(page);

  await page.goto("/tien");
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);

  await caption(page, "SDFish — khu GIAO DỊCH: bán được giá hơn", 2800);

  // GIÁ CÁ
  await caption(page, "Mở màn là bảng GIÁ CÁ tham khảo + giá dầu hôm nay", 2800);
  const search = page.locator('input[placeholder="Tìm loại cá…"]').first();
  if (await search.count()) {
    await scrollTo(page, 'input[placeholder="Tìm loại cá…"]');
    await caption(page, "Gõ tên cá để lọc nhanh", 1600);
    await typeSlow(page, 'input[placeholder="Tìm loại cá…"]', "nục");
    await page.waitForTimeout(1800);
    await search.fill("");
    await page.waitForTimeout(600);
  }

  // TIN MUA/BÁN
  await caption(page, 'Qua mục "Tin mua/bán" — chợ tin của bà con', 1800);
  await tap(
    page,
    'div[role="group"][aria-label="Mục giao dịch"] button:has-text("Tin mua/bán")',
  );
  await page.waitForTimeout(2000);
  await caption(page, "Ai cần mua, ai cần bán — thấy hợp thì gọi thẳng, không qua cò", 3000);

  const filterBan = page.locator(
    'div[role="group"][aria-label="Lọc tin mua bán"] button:has-text("Tin mua")',
  );
  if (await filterBan.count()) {
    await tap(
      page,
      'div[role="group"][aria-label="Lọc tin mua bán"] button:has-text("Tin mua")',
    );
    await caption(page, 'Lọc "Tin mua" — xem ai đang cần mua cá mình có', 2500);
    await tap(
      page,
      'div[role="group"][aria-label="Lọc tin mua bán"] button:has-text("Tất cả")',
    );
  }

  // ĐĂNG TIN
  await caption(page, "Mình có cá cần bán? Đăng tin ngay", 1800);
  await tap(page, 'button:has-text("Đăng tin mua/bán")');
  await page.waitForTimeout(1200);
  await tap(page, 'button:has-text("Tôi cần bán")');
  await typeSlow(page, 'input[placeholder="VD: Tàu ông Bảy, Vựa cô Ba"]', "Tàu anh Long");
  await typeSlow(
    page,
    'input[placeholder="VD: cá ngừ đại dương, mực ống"]',
    "cá ngừ đại dương",
  );
  await typeSlow(page, 'input[placeholder="VD: ~1,2 tấn/chuyến, 500 kg"]', "1,2 tấn");
  await typeSlow(
    page,
    'input[placeholder="VD: 130 nghìn/kg trở lên, theo chợ"]',
    "130 nghìn/kg",
  );
  await typeSlow(page, 'input[placeholder="VD: Khánh Hòa"]', "Phú Yên");
  await caption(page, "Điền loài cá, khối lượng, giá mong muốn — rồi Đăng tin", 2200);
  await tap(page, 'button[type="submit"]:has-text("Đăng tin")');
  await page.waitForTimeout(2000);

  const mine = page.getByText("Tàu anh Long").first();
  if (await mine.count()) {
    await mine.scrollIntoViewIfNeeded().catch(() => {});
    await caption(page, "Tin của mình lên chợ liền — người mua thấy là gọi", 3000);
  }

  // BÁN Ở ĐÂU
  await caption(page, 'Cuối cùng: mục "Bán ở đâu" — danh bạ chỗ bán quanh vùng', 2200);
  await tap(
    page,
    'div[role="group"][aria-label="Mục giao dịch"] button:has-text("Bán ở đâu")',
  );
  await page.waitForTimeout(1500);
  const cho = page.locator(
    'div[role="group"][aria-label="Chỗ bán"] button:has-text("Chợ đầu mối")',
  );
  if (await cho.count()) {
    await tap(
      page,
      'div[role="group"][aria-label="Chỗ bán"] button:has-text("Chợ đầu mối")',
    );
    await caption(page, "Nậu vựa, chợ đầu mối, nhà máy — so chỗ nào được giá hơn", 3000);
  }

  await caption(page, "Biết giá, biết chỗ, biết người mua — bán được đắt hơn", 3000);
  await hideCaption(page);
  await page.waitForTimeout(800);
});
