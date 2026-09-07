import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import {
  MIN_TAP,
  PERSONA,
  SHEET_SELECTOR,
  answerText,
  askUi,
  catSong,
  chipGroup,
  fab,
  findProductId,
  loginViaDevPage,
  openAssistant,
  replyBubbleText,
  seaCache,
  seedDevice,
  sheet,
  tapViolationsIn,
  tatMic,
  url,
} from "./helpers";

/*
  TẤM CHE + NÚT NỔI — 13 §9 AC-T27…T50.

  ⚠️ Bộ này chạy với NHẬN GIỌNG BỊ GỠ (`tatMic` trong `beforeEach`). Chromium
  của Playwright có `webkitSpeechRecognition` nhưng nó gọi dịch vụ của Google:
  trong sandbox test lượt gọi đó lỗi `network`/`not-allowed` tuỳ máy tuỳ mạng,
  và tấm che phản ứng khác nhau theo từng mã ⇒ ca nào cũng đứng trên cát.

  Gỡ hẳn = máy "không nghe được" (13 §5.4 dòng 2). Đó là ca THƯỜNG của bà con
  chứ không phải ca hiếm: 14 §0 chốt #4 — nhận giọng cần máy chủ Apple/Google,
  mất sóng ngoài biển là mic chết. Mic/TTS thật đo tay: nhóm E của
  `docs/test-cases/tro-ly-2026-09-06.md` + các `test.fixme` cuối file.
*/

/** Cảng nhà + bản lưu dự báo 2 giờ trước — để mọi ca offline có cái mà trả lời. */
async function seedNguDan(page: Page) {
  await seedDevice(page, {
    "forfish.home.v1": { portId: "quy-nhon", province: "Gia Lai" },
    ...seaCache("quy-nhon", 2 * 3600_000),
  });
}

/** Giỏ có món — đi đúng đường bà con: mở trang món rồi bấm nút chính của màn. */
async function themDaVaoGio(page: Page, request: APIRequestContext) {
  const id = await findProductId(request, "Đá cây 50kg");
  await page.goto(url(`/cho/sp/${id}`));
  await page.getByRole("button", { name: "Thêm vào giỏ" }).click();
  await expect(page.getByText(/Đã thêm .* vào giỏ/)).toBeVisible();
}

/**
 * CHỜ APP MỞ XONG rồi mới cắt sóng.
 *
 * `AssistantMount` được nạp bằng `next/dynamic({ssr:false})` ⇒ chunk của nó về
 * SAU hydrate. Cắt sóng ngay sau `goto` là cắt đúng lượt tải chunk đó, và ca
 * "mất sóng" biến thành ca "trợ lý chưa kịp có mặt" — đo nhầm thứ.
 *
 * Ca thật của bà con là: app đang mở sẵn trong tay thì tàu ra khỏi vùng sóng.
 * ⚠️ Câu hỏi cho ops (không kiểm được ở `next dev`, không có service worker):
 * chunk `assistant-sheet` có nằm trong bản precache của `public/sw.js` không —
 * nếu KHÔNG, bà con mở app lần đầu ngoài vùng sóng sẽ không có tấm che. Ghi ở
 * qa-offline-acceptance.
 */
async function moApp(page: Page) {
  await expect(fab(page), "nút nổi phải có mặt TRƯỚC khi cắt sóng").toBeVisible();
}

/** Cái gì đang nằm ở điểm (x,y) — để hỏi "bà con chạm vào đây thì trúng nút nào". */
function truPhuTai(page: Page, x: number, y: number) {
  return page.evaluate(
    ([px, py]) => {
      const el = document.elementFromPoint(px as number, py as number);
      if (!el) return "null";
      const nut = el.closest("button, a") ?? el;
      return `${nut.tagName}|${(nut.getAttribute("aria-label") ?? nut.textContent ?? "").trim().slice(0, 40)}`;
    },
    [x, y],
  );
}

test.beforeEach(async ({ page }) => {
  await tatMic(page);
  await loginViaDevPage(page, PERSONA.buyerBa);
  await seedNguDan(page);
});

// ── Nút nổi: có mặt, đủ to, không che nút chính (AC-T27, T28, T29, T31) ──────

test("AC-T27 · /cho: nút nổi hiện, đủ sàn chạm, một chạm là mở tấm che", async ({ page }) => {
  await page.goto(url("/cho"));
  await expect(fab(page)).toBeVisible();

  const box = await fab(page).boundingBox();
  expect(box, "nút nổi phải đo được").toBeTruthy();
  expect(Math.round(box!.width), "sàn chạm 3.5rem").toBeGreaterThanOrEqual(MIN_TAP);
  expect(Math.round(box!.height), "sàn chạm 3.5rem").toBeGreaterThanOrEqual(MIN_TAP);

  // và chính giữa nút phải là nút — không có lớp nào phủ lên (13 §5.1 A11y)
  expect(await truPhuTai(page, box!.x + box!.width / 2, box!.y + box!.height / 2)).toContain("Trợ lý");

  const t0 = Date.now();
  await fab(page).click();
  await expect(sheet(page)).toBeVisible();
  // 13 §8: mở tấm che < 300 ms. Ở `next dev` lần lạnh phải biên dịch chunk nên
  // ngưỡng ở đây rộng hơn — số 300 ms đo trên bản build, ghi ở nhóm E.
  expect(Date.now() - t0, "mở tấm che không được có màn trung gian nào").toBeLessThan(5_000);
  await expect(fab(page), "tấm che mở thì nút nổi ẩn (13 §5.1)").toHaveCount(0);
});

test("AC-T27 · mở được từ mọi màn app ngư dân", async ({ page }) => {
  for (const path of ["/", "/tau", "/nguoi", "/tien", "/cho", "/cang"]) {
    await page.goto(url(path));
    await expect(fab(page), `nút nổi phải có ở ${path}`).toBeVisible();
  }
});

test("AC-T28 · nút nổi KHÔNG có ở màn quản trị / kỹ thuật / đăng nhập", async ({ page }) => {
  for (const path of ["/quan-tri", "/dev", "/login", "/dang-ky", "/quen-mat-khau", "/quyen-rieng-tu"]) {
    await page.goto(url(path));
    await page.waitForLoadState("domcontentloaded");
    await expect(fab(page), `nút nổi KHÔNG được có ở ${path}`).toHaveCount(0);
  }
});

test("AC-T31 · màn có thanh đáy dính (/cho/gio có món, /cho/sp): nút nổi NHƯỜNG CHỖ", async ({
  page,
  request,
}) => {
  /*  UI chọn cách "ẩn" trong hai cách 13 §5.1 cho phép (ẩn, hoặc chừa
      `padding-right` cho hàng nút) — lý do ghi ngay trong `assistant-fab.tsx`:
      ở `/cho/sp` vùng ngón cái ĐÃ LÀ hành động chính của màn, dời nút nổi lên
      trên thanh thì nó đè đúng nút "+" của bộ đếm.

      Ca này chốt cái QUAN TRỌNG với bà con: nút chính của thanh đáy phải nhận
      được chạm. Cách đạt (ẩn hay dịch) là việc của UI. */
  const id = await findProductId(request, "Đá cây 50kg");
  const man: [string, RegExp][] = [
    [`/cho/sp/${id}`, /^Thêm vào giỏ/],
    ["/cho/gio", /^Đặt hàng/],
  ];
  await themDaVaoGio(page, request);

  for (const [path, tenNut] of man) {
    await page.goto(url(path));
    const chinh = page.getByRole("button", { name: tenNut }).last();
    await expect(chinh, `nút chính của ${path}`).toBeVisible();
    const b = (await chinh.boundingBox())!;

    const tren = await truPhuTai(page, b.x + b.width / 2, b.y + b.height / 2);
    expect(tren, `${path}: nút nổi đè lên nút chính = bà con bấm hụt việc đang làm`).not.toContain(
      "Trợ lý",
    );

    // nếu UI vẫn hiện nút nổi ở màn này thì hai hình chữ nhật KHÔNG được chồng
    if ((await fab(page).count()) > 0) {
      const f = (await fab(page).boundingBox())!;
      const chongNhau =
        f.x < b.x + b.width && f.x + f.width > b.x && f.y < b.y + b.height && f.y + f.height > b.y;
      expect(chongNhau, `${path}: nút nổi ${JSON.stringify(f)} chồng thanh đáy ${JSON.stringify(b)}`).toBe(false);
    }
  }
});

test("AC-T31 · /cho/gio TRỐNG (không có thanh đáy) thì nút nổi vẫn còn", async ({ page }) => {
  await page.goto(url("/cho/gio"));
  await expect(
    fab(page),
    "ẩn theo dấu vết thanh dính, không theo danh sách route — giỏ trống thì không có thanh",
  ).toBeVisible();
});

test("AC-T29 · panel khác đang mở → nút nổi ẩn; đóng panel → hiện lại", async ({ page }) => {
  await page.goto(url("/tau?tab=giay-to"));
  await expect(fab(page)).toBeVisible();

  const moSheet = page.getByRole("button", { name: /Thêm giấy|Thêm loại giấy|^Thêm/ }).first();
  await expect(moSheet, "cần một nút mở BottomSheet ở tủ giấy tờ").toBeVisible();
  await moSheet.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    fab(page),
    "sheet khác mở thì nút nổi phải ẩn HẲN, không chỉ nằm dưới scrim (scrim đen 50% vẫn lộ nút cam)",
  ).toHaveCount(0);

  await page.keyboard.press("Escape");
  await expect(fab(page)).toBeVisible();
});

// ── Tấm che: chip, hỏi–đáp, đóng (AC-T26, T34, T37, T50) ────────────────────

test("AC-T26 · tấm che có 3–4 chip gợi ý, không trùng ý, đủ sàn chạm", async ({ page }) => {
  await page.goto(url("/cho"));
  await openAssistant(page);

  const chips = chipGroup(page).getByRole("button");
  const n = await chips.count();
  expect(n, "13 §5.3: 2 theo màn + 1 theo giờ + 1 theo việc, trần 4").toBeGreaterThanOrEqual(3);
  expect(n).toBeLessThanOrEqual(4);

  const nhan = await chips.allInnerTexts();
  expect(new Set(nhan.map((s) => s.trim())).size, `chip trùng ý: ${nhan.join(" · ")}`).toBe(n);
  for (let i = 0; i < n; i += 1) {
    const b = (await chips.nth(i).boundingBox())!;
    expect(Math.round(b.height), `chip "${nhan[i]}" phải ≥ ${MIN_TAP}px`).toBeGreaterThanOrEqual(MIN_TAP);
  }
});

test("AC-T34 · máy không nghe được → không có vòng mic, ô gõ + chip hiện SẴN", async ({ page }) => {
  await page.goto(url("/"));
  await openAssistant(page);

  await expect(
    sheet(page).getByRole("button", { name: /Bấm để nói|Đang nghe/ }),
    "13 §5.4: không có STT thì vòng mic không render",
  ).toHaveCount(0);
  await expect(sheet(page).getByLabel("Gõ câu muốn hỏi"), "ô gõ là hàng chính").toBeVisible();
  await expect(chipGroup(page).getByRole("button").first()).toBeVisible();
  await expect(
    sheet(page).getByText(/chưa nói được với tôi/i),
    "phải nói bằng tiếng người vì sao không nghe được — không im, không jargon",
  ).toBeVisible();
});

test("AC-T37 · gõ 'thời tiết hôm nay' → trả lời từ bản lưu, có mốc thời gian", async ({ page }) => {
  await page.goto(url("/"));
  await openAssistant(page);
  await askUi(page, "thời tiết hôm nay");

  const cauTraLoi = await replyBubbleText(page);
  expect(cauTraLoi, "phải có chữ trả lời, không chỉ 'Đang xem…'").toMatch(/sóng|gió|điểm/i);
  const canMoc = await answerText(page);
  expect(
    canMoc,
    "13 §3: số liệu từ bản lưu PHẢI kèm tuổi dữ liệu — không có mốc là hứa độ chính xác không có thật",
  ).toMatch(/lưu|trước/i);
});

test("AC-T50 · mọi ô chạm trong tấm che ≥56px, ô gõ ≥16px, chữ trả lời ≥1.25rem", async ({ page }) => {
  await page.goto(url("/"));
  await openAssistant(page);

  expect((await tapViolationsIn(page, SHEET_SELECTOR)).join("\n") || "OK", "trạng thái nghỉ/gõ").toBe("OK");

  const cỡChữÔGõ = await sheet(page)
    .getByLabel("Gõ câu muốn hỏi")
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(cỡChữÔGõ, "dưới 16px là iOS tự phóng to màn khi gõ").toBeGreaterThanOrEqual(16);

  await askUi(page, "giấy tờ nào sắp hết hạn");
  await answerText(page);
  expect((await tapViolationsIn(page, SHEET_SELECTOR)).join("\n") || "OK", "trạng thái đã trả lời").toBe("OK");

  const cỡChữTraLoi = await sheet(page)
    .locator("p.display")
    .first()
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(cỡChữTraLoi, "13 §5.2 #3: câu trả lời ≥1.25rem để đọc được ngoài nắng").toBeGreaterThanOrEqual(20);
});

test("Esc và nút X đều đóng được tấm che", async ({ page }) => {
  await page.goto(url("/"));
  await openAssistant(page);
  await page.keyboard.press("Escape");
  await expect(sheet(page)).toHaveCount(0);
  await expect(fab(page), "đóng tấm che thì nút nổi quay lại ngay").toBeVisible();

  await openAssistant(page);
  await sheet(page).getByRole("button", { name: /Đóng/i }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(fab(page)).toBeVisible();
});

// ── Hành động: tìm món, thêm giỏ, gọi, không phá huỷ (AC-T39, T41, T44, T45) ─

test("AC-T41 · 'bỏ 2 cây đá vô giỏ' → thẻ món → một chạm xác nhận → giỏ có dòng", async ({ page }) => {
  await page.goto(url("/cho"));
  const truoc = await page.evaluate(() => window.localStorage.getItem("forfish.mcart.v1"));
  await openAssistant(page);
  await askUi(page, "bỏ 2 cây đá vô giỏ");
  await answerText(page);

  // 13 §4.3 + 14 §7.2: chạm THẺ MÓN chính là xác nhận, không dựng cặp nút thứ hai
  const them = sheet(page).getByRole("button", { name: /^Thêm \d+ vào giỏ$|^Chọn loại$/ }).first();
  await expect(them, "thêm giỏ PHẢI có một chạm xác nhận trên thẻ món").toBeVisible({ timeout: 20_000 });
  if ((await them.innerText()).includes("Chọn loại")) {
    await them.click();
    await sheet(page).getByRole("button", { name: /^\S/ }).last().click();
  } else {
    await them.click();
  }

  await expect(sheet(page).getByText(/Đã thêm/), "làm xong phải nói đã làm gì").toBeVisible();
  const sau = await page.evaluate(() => window.localStorage.getItem("forfish.mcart.v1"));
  expect(sau, "giỏ chợ phải có dòng mới").toBeTruthy();
  expect(sau, "giỏ phải ĐỔI so với trước").not.toBe(truoc);
  // Số lượng bà con đã nói có được mang sang không — ca RIÊNG ngay bên dưới
  // (đang đỏ: thẻ món mở sẵn 1 dù nói 2). Ở đây chỉ chốt đường đi 2 chạm.
  expect(JSON.parse(sau!).items?.length, "giỏ phải có đúng dòng vừa thêm").toBeGreaterThan(0);
});

test("AC-T41 · BUG THẬT: nói '2 cây đá' mà thẻ món mở sẵn số 1", async ({ page }) => {
  /*  13 §5.2 #4 (và chính ghi chú trong `assistant-sheet.tsx`): "bà con nói '2
      thùng' thì phải THẤY số 2 trước khi chạm". Đúng khi chợ tìm ra ĐÚNG MỘT
      món — `fillCandidates` lúc đó mới dựng `action.addToCart` mang `qty`, và
      tấm che có cái để đọc (`useEffect ... setQty(reply.action.qty)`).

      Tìm ra 2–3 món thì `fillCandidates` chỉ trả `candidates`, KHÔNG có
      `action` ⇒ `qty` không có đường nào tới UI, đứng nguyên ở 1. "bỏ 2 cây đá
      vô giỏ" → q="da" khớp 6 món trên chợ seed ⇒ rơi đúng nhánh này.

      Hậu quả với bà con: nói hai, mua một. Hoặc phải bấm thêm nút "+" — việc 11
      của 13 §10 vọt từ 2 chạm lên 3. Sửa gốc: mang `qty` đã nói theo
      `candidates` (hoặc trả `qty` ở tầng reply) để UI mở sẵn đúng số. */
  await page.goto(url("/cho"));
  await openAssistant(page);
  await askUi(page, "bỏ 2 cây đá vô giỏ");
  await answerText(page);

  const them = sheet(page).getByRole("button", { name: /^Thêm \d+ vào giỏ$|^Chọn loại$/ }).first();
  await expect(them).toBeVisible({ timeout: 20_000 });
  const nhan = await them.innerText();
  test.skip(nhan.includes("Chọn loại"), "ca này chỉ đo nhánh thẻ món không có biến thể");
  expect(nhan, `13 §5.2 #4: nút phải mở sẵn đúng số đã nói — đang là "${nhan}"`).toContain("2");
});

test("tìm món: 'cần mua đá' → mở màn tìm, KHÔNG tự thêm giỏ", async ({ page }) => {
  await page.goto(url("/"));
  const gioTruoc = await page.evaluate(() => window.localStorage.getItem("forfish.mcart.v1"));
  await openAssistant(page);
  await askUi(page, "cần mua đá");
  await page.waitForURL(/\/cho\/tim\?q=/, { timeout: 20_000 });
  const gioSau = await page.evaluate(() => window.localStorage.getItem("forfish.mcart.v1"));
  expect(gioSau, "tìm món KHÔNG được đụng vào giỏ").toBe(gioTruoc);
});

test("AC-T39 · 'gọi SDVICO' → cặp Thôi/Gọi, chạm Thôi thì không gọi", async ({ page }) => {
  await page.goto(url("/"));
  await openAssistant(page);
  await askUi(page, "gọi SDVICO");
  await answerText(page);

  const goi = sheet(page).getByRole("button", { name: "Gọi", exact: true });
  await expect(goi, "gọi điện PHẢI có xác nhận bằng chạm (13 §4.3)").toBeVisible();
  const thoi = sheet(page).getByRole("button", { name: "Thôi", exact: true });
  await expect(thoi).toBeVisible();
  await thoi.click();
  await expect(sheet(page).getByText(/Đang gọi/)).toHaveCount(0);
});

test("AC-T45 · việc có hậu quả nói bằng giọng → chỉ đường, KHÔNG làm", async ({ page }) => {
  await page.goto(url("/"));
  await openAssistant(page);
  for (const cau of ["huỷ đơn SD260904M3RT", "đặt hàng luôn", "xoá giấy đăng kiểm"]) {
    await askUi(page, cau);
    const text = await answerText(page);
    await expect(
      sheet(page).getByRole("button", { name: /^(Đặt hàng|Huỷ đơn|Xoá)/ }),
      `"${cau}" không được đẻ ra nút làm việc đó`,
    ).toHaveCount(0);
    expect(text.length, `"${cau}" phải có câu trả lời`).toBeGreaterThan(0);
  }
});

test("AC-T44 · 'đặt cảng nhà là Sa Kỳ' → ghi ngay + có đường lùi 1 chạm", async ({ page }) => {
  await page.goto(url("/"));
  await openAssistant(page);
  await askUi(page, "đặt cảng nhà là Sa Kỳ");
  await answerText(page);
  await expect
    .poll(async () => page.evaluate(() => window.localStorage.getItem("forfish.home.v1")), {
      timeout: 10_000,
      message: "13 §4.3: việc ĐẢO ĐƯỢC thì làm ngay, không hỏi xác nhận",
    })
    .toContain("sa-ky");
  await expect(
    // Hai đường lùi cùng tồn tại sau vòng fix (nút "Không phải, chọn cảng khác" +
    // chip "Đổi lại" về cảng cũ) — chỉ cần ≥1 nút hiện là đủ, không bắt strict.
    sheet(page).getByRole("button", { name: /Không phải|Đổi lại|chọn cảng khác/i }).first(),
    "…nhưng phải có đường lùi một chạm",
  ).toBeVisible();
});

// ── Mất sóng (AC-T37, T42, 13 §5.4) ─────────────────────────────────────────

test("mất sóng: ô gõ nói MẤT SÓNG, chip + gõ vẫn trả lời việc trong máy, KHÔNG gọi mạng", async ({
  page,
  context,
}) => {
  await page.goto(url("/"));
  await moApp(page);
  await catSong(page, context, true);
  try {
    await openAssistant(page);
    const box = sheet(page).getByLabel("Gõ câu muốn hỏi");
    await expect(box, "mất sóng ⇒ ô gõ + chip là hàng chính, không đợi 8 giây").toBeVisible();
    await expect(box, "13 §5.4: câu nhắc phải nói MẤT SÓNG, không nói 'lỗi'").toHaveAttribute(
      "placeholder",
      /sóng/i,
    );
    await expect(chipGroup(page).getByRole("button").first()).toBeVisible();

    const reqs: string[] = [];
    page.on("request", (r) => reqs.push(r.url()));
    await askUi(page, "thời tiết hôm nay");
    const text = await replyBubbleText(page);
    expect(text, "bản lưu trong máy phải trả lời được khi mất sóng (13 P7)").toMatch(/sóng|gió|điểm/i);
    expect(
      reqs.filter((u) => u.includes("/api/tro-ly")),
      "mất sóng thì KHÔNG được gọi trợ lý mạng",
    ).toHaveLength(0);
  } finally {
    await catSong(page, context, false);
  }
});

test("mất sóng: chạm CHIP cũng trả lời được việc trong máy", async ({ page, context }) => {
  await page.goto(url("/"));
  await moApp(page);
  await catSong(page, context, true);
  try {
    await openAssistant(page);
    const chip = chipGroup(page).getByRole("button").first();
    const nhan = await chip.innerText();
    await chip.click();
    const text = await answerText(page);
    expect(text.length, `chip "${nhan}" phải trả lời được, không im`).toBeGreaterThan(nhan.length);
    await expect(sheet(page).locator("p.display").first()).toBeVisible();
  } finally {
    await catSong(page, context, false);
  }
});

test("AC-T42 · mất sóng + 'bỏ 2 cây đá vô giỏ' → nói thật, giỏ KHÔNG đổi", async ({ page, context }) => {
  await page.goto(url("/cho"));
  await moApp(page);
  const truoc = await page.evaluate(() => window.localStorage.getItem("forfish.mcart.v1"));
  await catSong(page, context, true);
  try {
    await openAssistant(page);
    await askUi(page, "bỏ 2 cây đá vô giỏ");
    const text = await answerText(page);
    expect(text, "chợ không cache danh mục ⇒ phải nói cần có sóng").toMatch(/sóng/i);
    const sau = await page.evaluate(() => window.localStorage.getItem("forfish.mcart.v1"));
    expect(sau, "mất sóng không được đụng giỏ").toBe(truoc);
  } finally {
    await catSong(page, context, false);
  }
});

test("13 §8 · mở app + chuyển màn + mở tấm che: trợ lý KHÔNG gọi mạng lần nào", async ({ page }) => {
  const reqs: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/tro-ly")) reqs.push(r.url());
  });
  await page.goto(url("/"));
  await page.goto(url("/tau"));
  await page.goto(url("/cho"));
  await openAssistant(page);
  await expect(sheet(page)).toBeVisible();
  expect(reqs, "CLAUDE.md 🟡 (a): không thêm request lúc mở app / chuyển màn / mở tấm che").toHaveLength(0);
});

// ── Hỏi mạng ở chế độ giả lập (AC-T46, T47) + tự đóng (AC-T48) ──────────────

test("AC-T46 · câu hỏi mở → hỏi trợ lý mạng, có câu trả lời + dấu 'Đang trả lời thử'", async ({
  page,
}) => {
  const goiMang: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/tro-ly")) goiMang.push(r.url());
  });
  await page.goto(url("/"));
  await openAssistant(page);
  await askUi(page, "nhớt nào tốt cho máy Yanmar");
  const text = await answerText(page);
  expect(goiMang, "câu hỏi mở + có sóng + đã đăng nhập ⇒ phải đi hỏi mạng (13 §7.1)").toHaveLength(1);
  expect(text.length, "phải có câu trả lời, không kẹt ở 'Đang nghĩ…'").toBeGreaterThan(0);
  await expect(
    sheet(page).getByText("Đang trả lời thử"),
    "13 §5.4: ngoài production, chế độ giả lập phải nói rõ là đang trả lời thử",
  ).toBeVisible();
});

test("AC-T47 · chưa đăng nhập + câu hỏi mở → mời đăng nhập, KHÔNG gọi trợ lý mạng", async ({
  page,
}) => {
  await page.goto(url("/"));
  await page.evaluate(() => window.localStorage.removeItem("forfish.token.v1"));
  await page.reload();

  const reqs: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/tro-ly")) reqs.push(r.url());
  });
  await openAssistant(page);
  await askUi(page, "nhớt nào tốt cho máy Yanmar");
  const text = await answerText(page);
  expect(reqs, "chưa đăng nhập thì client KHÔNG được gửi lượt hỏi (13 §7.1c)").toHaveLength(0);
  expect(text, "phải nói lý do bằng tiếng người, không im lặng").toMatch(/đăng nhập|trong máy/i);
});

test("AC-T48 · trả lời xong, 20 giây không ai đụng → tấm che tự đóng", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(url("/"));
  await openAssistant(page);
  await askUi(page, "thời tiết hôm nay");
  await answerText(page);
  await expect(sheet(page), "13 §4.1: tự đóng sau 20 s không tương tác").toHaveCount(0, {
    timeout: 45_000,
  });
  await expect(fab(page), "đóng rồi thì nút nổi phải quay lại").toBeVisible();
});

test("AC-T48 · đang chờ bà con CHẠM (thẻ món) thì KHÔNG được tự đóng", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(url("/cho"));
  await openAssistant(page);
  await askUi(page, "bỏ 2 cây đá vô giỏ");
  await answerText(page);
  await expect(sheet(page).getByRole("button", { name: /^Thêm \d+ vào giỏ$|^Chọn loại$/ }).first())
    .toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(25_000);
  await expect(
    sheet(page),
    "đóng ngay lúc bà con đang cân nhắc mua là cướp việc khỏi tay",
  ).toBeVisible();
});

test("AC-T49 · app vào nền lúc đang chờ → không kẹt, không nói tiếp", async ({ page }) => {
  await page.goto(url("/"));
  await openAssistant(page);
  await askUi(page, "thời tiết hôm nay");
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { get: () => "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(
    sheet(page).getByRole("status"),
    "14 §5.4: không nhánh nào được để state đứng ở 'đang nghĩ'",
  ).toHaveCount(0, { timeout: 15_000 });
  await expect(sheet(page), "vào nền không được tự đóng tấm che").toBeVisible();
});

// ── Không tự động hoá được trong chromium headless ──────────────────────────

test.fixme(
  "AC-T32/T33 · mic im 8 giây, từ chối quyền mic — cần SpeechRecognition thật",
  async () => {
    /*  Chromium của Playwright CÓ `webkitSpeechRecognition`, nhưng nó gọi dịch
        vụ nhận giọng của Google: trong sandbox test lượt gọi trả `network` hay
        `not-allowed` tuỳ máy tuỳ mạng, không tất định. Nhét một
        `window.SpeechRecognition` GIẢ thì chỉ kiểm được code giả của chính
        mình, không kiểm được đường bà con đi.
        Chạy TAY: docs/test-cases/tro-ly-2026-09-06.md TC-T32, TC-T33, TC-TD01,
        TC-TD05 (iPhone Safari + Android Chrome, có/không mạng). */
  },
);

test.fixme("AC-T35/T36 · TTS tiếng Việt, tắt/bật tiếng — cần giọng vi-VN thật", async () => {
  /*  `speechSynthesis.getVoices()` trong chromium headless trả mảng rỗng ⇒
      `hasVietnameseVoice()` luôn false: ca "không đọc bằng giọng khác" xanh một
      cách vô nghĩa (không có giọng nào để đọc sai), còn ca "đọc đúng giọng
      Việt" và ca "cử chỉ chạm mở khoá loa iOS" thì không chạy được.
      Đo tay trên iPhone 12 (giọng Linh) và Android có/không gói giọng Việt:
      TC-T35, TC-T36, TC-TD02, TC-TD06. */
});

test.fixme("AC-T30 · ẩn nút nổi khi sheet Ra khơi half/full hoặc HUD dẫn đường live", async () => {
  /*  Trục 1 chưa export trạng thái `SnapSheet`/HUD (nợ ghi trong
      `assistant-fab.tsx`). Khi có export thì mở lại ca này; tới lúc đó đo tay
      theo TC-T30. */
});

test.fixme("AC-T38 · bản máy trả lời trước, có sóng thì đổi chữ + 'Vừa cập nhật'", async () => {
  /*  Cần nguồn dự báo THẬT trả về bản mới hơn bản lưu — bộ này chạy kho file,
      không gọi Open-Meteo. Đo tay theo TC-T38. */
});

test.fixme("AC-T43 · máy hết chỗ lúc ghi giỏ → băng đỏ, KHÔNG nói 'đã thêm'", async () => {
  /*  Cần ép `localStorage.setItem` ném `QuotaExceededError` ĐÚNG một lần ở
      bước ghi giỏ. Đè `Storage.prototype.setItem` từ initScript làm hỏng cả
      lượt đăng nhập và bản lưu dự báo (cùng đi qua hàm đó) ⇒ ca không còn đo
      cái nó nói. Đo tay theo TC-T43 (Safari chế độ riêng tư, quota 0). */
});
