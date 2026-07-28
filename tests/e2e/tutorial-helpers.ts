import type { Page } from "@playwright/test";

/**
 * Bộ helper quay VIDEO HƯỚNG DẪN: con trỏ giả + gợn sóng khi chạm + thanh phụ đề
 * từng bước ở đáy màn hình — để bà con xem video biết đang bấm vào đâu, làm gì.
 */

/** Rail lớp bản đồ (build 2026-07-28 mặc định THU GỌN) — mở nếu đang gọn. */
export async function openRail(page: Page) {
  const show = page.locator('button[aria-label="Hiện lớp bản đồ"]');
  if (await show.count()) {
    await show.first().hover();
    await page.waitForTimeout(400);
    await show.first().click();
    await page.waitForTimeout(900);
  }
}

/** Mock "/api/storms" = trời yên biển lặng — nguồn GDACS chập chờn sẽ làm
 *  video hướng dẫn dính banner "Chưa hỏi được tin bão" gây rối mắt. */
export async function mockNoStorms(page: Page) {
  await page.context().route(/\/api\/storms/, (r) =>
    r.fulfill({
      json: { ok: true, storms: [], checkedAt: new Date().toISOString() },
    }),
  );
}

export async function installOverlay(page: Page) {
  // E2E_DISPLAY_MODE=to|gon → ép cỡ giao diện (forfish.displaymode.v1) để quay
  // bộ video "Chữ to" / "Gọn" riêng; không set thì theo mặc định của app.
  const mode = process.env.E2E_DISPLAY_MODE;
  if (mode === "to" || mode === "gon") {
    await page.addInitScript((m) => {
      try {
        window.localStorage.setItem("forfish.displaymode.v1", m);
      } catch {}
    }, mode);
  }
  await page.addInitScript(() => {
    const setup = () => {
      if (document.getElementById("__tut_cursor")) return;
      const cursor = document.createElement("div");
      cursor.id = "__tut_cursor";
      cursor.style.cssText =
        "position:fixed;z-index:2147483647;width:26px;height:26px;border-radius:50%;" +
        "background:rgba(255,120,0,.45);border:2.5px solid #ff7800;pointer-events:none;" +
        "transform:translate(-50%,-50%);left:-50px;top:-50px;transition:left .12s,top .12s;";
      const cap = document.createElement("div");
      cap.id = "__tut_caption";
      cap.style.cssText =
        "position:fixed;z-index:2147483646;left:10px;right:10px;bottom:96px;" +
        "background:rgba(9,36,64,.92);color:#fff;font:600 17px/1.35 system-ui,sans-serif;" +
        "padding:12px 14px;border-radius:14px;text-align:center;pointer-events:none;" +
        "opacity:0;transition:opacity .25s;box-shadow:0 4px 16px rgba(0,0,0,.35);";
      document.body.appendChild(cursor);
      document.body.appendChild(cap);
      window.addEventListener(
        "mousemove",
        (e) => {
          cursor.style.left = e.clientX + "px";
          cursor.style.top = e.clientY + "px";
        },
        true,
      );
      window.addEventListener(
        "mousedown",
        (e) => {
          const r = document.createElement("div");
          r.style.cssText =
            "position:fixed;z-index:2147483647;width:14px;height:14px;border-radius:50%;" +
            "border:3px solid #ff7800;pointer-events:none;transform:translate(-50%,-50%);" +
            `left:${e.clientX}px;top:${e.clientY}px;transition:all .45s ease-out;opacity:1;`;
          document.body.appendChild(r);
          requestAnimationFrame(() => {
            r.style.width = "64px";
            r.style.height = "64px";
            r.style.opacity = "0";
          });
          setTimeout(() => r.remove(), 600);
        },
        true,
      );
    };
    if (document.readyState === "loading")
      document.addEventListener("DOMContentLoaded", setup);
    else setup();
  });
}

/** Hiện phụ đề bước hiện tại, dừng cho người xem đọc, rồi TỰ ẨN — phụ đề
 *  treo lâu sẽ đè chữ của app trong lúc thao tác (góp ý user 2026-07-28). */
export async function caption(page: Page, text: string, holdMs = 2200) {
  await page.evaluate((t) => {
    const el = document.getElementById("__tut_caption");
    if (el) {
      el.textContent = t;
      el.style.opacity = "1";
    }
  }, text);
  await page.waitForTimeout(holdMs);
  await hideCaption(page);
  await page.waitForTimeout(300);
}

export async function hideCaption(page: Page) {
  await page.evaluate(() => {
    const el = document.getElementById("__tut_caption");
    if (el) el.style.opacity = "0";
  });
}

/** Di chuột tới phần tử (thấy con trỏ bay tới), dừng nhẹ rồi chạm.
 *  Có timeout RIÊNG (không phải timeout()) — lớp khác đè lên (toast, nhãn tự
 *  động) làm hover() thử lại vô hạn tới khi hết giờ CẢ BÀI TEST nếu không
 *  chặn ở đây. Bị che thì bấm ép (force) để video không treo cứng. */
export async function tap(page: Page, selector: string, pauseMs = 700) {
  const el = page.locator(selector).first();
  await el.scrollIntoViewIfNeeded();
  try {
    await el.hover({ timeout: 6000 });
    await page.waitForTimeout(pauseMs);
    await el.click({ timeout: 6000 });
  } catch {
    await el.click({ force: true, timeout: 6000 });
  }
  await page.waitForTimeout(500);
}

/** Gõ chữ chậm rãi như người thật. */
export async function typeSlow(page: Page, selector: string, text: string) {
  const el = page.locator(selector).first();
  await el.scrollIntoViewIfNeeded();
  try {
    await el.hover({ timeout: 6000 });
    await page.waitForTimeout(400);
    await el.click({ timeout: 6000 });
  } catch {
    await el.click({ force: true, timeout: 6000 });
  }
  await el.pressSequentially(text, { delay: 110 });
  await page.waitForTimeout(400);
}

/** Cuộn mượt tới phần tử để người xem theo kịp. */
export async function scrollTo(page: Page, selector: string) {
  await page
    .locator(selector)
    .first()
    .evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "center" }));
  await page.waitForTimeout(900);
}
