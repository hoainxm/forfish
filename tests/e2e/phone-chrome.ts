import type { Page } from "@playwright/test";

/**
 * VỎ MÁY GIẢ cho video hướng dẫn CÀI APP VỀ MÁY (Android + iPhone).
 *
 * Vì sao phải vẽ giả: thanh Chrome, hộp thoại "Cài đặt ứng dụng", khay Chia sẻ
 * của Safari và MÀN HÌNH CHÍNH là giao diện của HỆ ĐIỀU HÀNH — nằm NGOÀI trang
 * web nên trình quay (Playwright) không chụp được. Mà đó lại đúng chỗ bà con
 * phải tự bấm. Nên video vẽ lại đúng thứ tự bước + đúng chữ trên máy thật.
 *
 * Ranh giới THẬT / VẼ LẠI (giữ cho rõ, đừng nhập nhằng):
 *  · VẼ LẠI: thanh trình duyệt, hộp thoại cài của Chrome, khay Chia sẻ iOS,
 *    màn hình chính, chip "mất sóng".
 *  · THẬT 100%: thẻ nhắc "Cài SDFish về máy" trong app, bản đồ, dự báo, và
 *    đoạn cuối — tắt mạng thật (context.setOffline) rồi mở lại app.
 *
 * Mọi thứ vẽ ra nằm trong #__ph_root (z-index dưới con trỏ/phụ đề của
 * tutorial-helpers.ts) và bị xoá sạch khi gọi clearChrome().
 */

/** Địa chỉ web hiện trên thanh trình duyệt giả. Đổi khi có tên miền thật:
 *  `E2E_SITE_URL=sdfish.vn npm run e2e:videos` */
export const SITE_URL = process.env.E2E_SITE_URL || "sdfish.vercel.app";

type PhCall =
  | "androidBar"
  | "hideAndroidBar"
  | "chromeInstallDialog"
  | "androidHome"
  | "safariBar"
  | "hideSafariBar"
  | "safariShare"
  | "iosAddSheet"
  | "iosHome"
  | "fadeHome"
  | "noSignal"
  | "captionBottom"
  | "clear";

async function call(page: Page, name: PhCall, arg: unknown = null) {
  await page.evaluate(
    ({ n, a }) => {
      const ph = (window as unknown as { __ph?: Record<string, (x: unknown) => void> })
        .__ph;
      ph?.[n]?.(a);
    },
    { n: name, a: arg },
  );
}

/** Nạp bộ vẽ vỏ máy (giữ qua mọi lần tải lại trang — dùng addInitScript). */
export async function installPhoneChrome(page: Page) {
  await page.addInitScript((site: string) => {
    const w = window as unknown as {
      __ph?: Record<string, (a: unknown) => void>;
      __phChoice?: () => void;
    };

    const root = () => {
      let r = document.getElementById("__ph_root");
      if (!r) {
        r = document.createElement("div");
        r.id = "__ph_root";
        r.style.cssText =
          "position:fixed;inset:0;z-index:2147483000;pointer-events:none;" +
          'font-family:-apple-system,system-ui,"Segoe UI",Roboto,sans-serif;';
        document.body.appendChild(r);
      }
      return r;
    };

    const add = (html: string) => {
      const box = document.createElement("div");
      box.innerHTML = html.trim();
      const node = box.firstElementChild as HTMLElement;
      root().appendChild(node);
      return node;
    };

    const gone = (id: string) => document.getElementById(id)?.remove();

    /* ── Android: thanh Chrome trên cùng ─────────────────────────────── */
    const androidBar = () => {
      gone("__ph_abar");
      add(`
        <div id="__ph_abar" style="position:absolute;top:0;left:0;right:0;height:54px;
          background:#f1f3f4;display:flex;align-items:center;gap:10px;padding:0 10px;
          box-shadow:0 2px 8px rgba(0,0,0,.22);">
          <div style="flex:1;display:flex;align-items:center;gap:8px;background:#fff;
            border-radius:999px;padding:8px 14px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5f6368"
              stroke-width="2.2"><rect x="4" y="10" width="16" height="11" rx="2"/>
              <path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
            <span style="font-size:14px;color:#202124;font-weight:600;">${site}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:3px;padding:0 6px;">
            <span style="width:4px;height:4px;border-radius:50%;background:#5f6368;"></span>
            <span style="width:4px;height:4px;border-radius:50%;background:#5f6368;"></span>
            <span style="width:4px;height:4px;border-radius:50%;background:#5f6368;"></span>
          </div>
        </div>`);
    };

    /* ── Android: hộp thoại "Cài đặt ứng dụng" của Chrome ────────────── */
    const chromeInstallDialog = () => {
      gone("__ph_dlg");
      const node = add(`
        <div id="__ph_dlg" style="position:absolute;inset:0;background:rgba(0,0,0,.45);
          display:flex;align-items:flex-end;pointer-events:auto;">
          <div id="__ph_dlg_sheet" style="width:100%;background:#fff;border-radius:22px 22px 0 0;
            padding:22px 18px 26px;transform:translateY(105%);transition:transform .38s ease-out;">
            <div style="display:flex;gap:13px;align-items:center;">
              <img src="/icons/icon-192.png" alt="" style="width:52px;height:52px;border-radius:13px;"/>
              <div>
                <div style="font-size:18px;font-weight:700;color:#202124;">Cài đặt ứng dụng</div>
                <div style="font-size:14px;color:#5f6368;margin-top:2px;">SDFish · ${site}</div>
              </div>
            </div>
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:24px;">
              <button id="__ph_install_cancel" style="border:0;background:transparent;color:#1a73e8;
                font-size:16px;font-weight:700;padding:12px 18px;border-radius:10px;">Huỷ</button>
              <button id="__ph_install_ok" style="border:0;background:#1a73e8;color:#fff;
                font-size:16px;font-weight:700;padding:12px 26px;border-radius:10px;">Cài đặt</button>
            </div>
          </div>
        </div>`);
      requestAnimationFrame(() => {
        const s = node.querySelector("#__ph_dlg_sheet") as HTMLElement | null;
        if (s) s.style.transform = "translateY(0)";
      });
      const close = () => gone("__ph_dlg");
      node.querySelector("#__ph_install_cancel")?.addEventListener("click", close);
      node.querySelector("#__ph_install_ok")?.addEventListener("click", () => {
        close();
        w.__phChoice?.(); // trả lời "đã cài" cho thẻ nhắc trong app
      });
    };

    /* ── Màn hình chính (Android / iOS) ──────────────────────────────── */
    const other = (label: string, radius: string) => `
      <div style="display:flex;flex-direction:column;align-items:center;gap:7px;">
        <div style="width:60px;height:60px;border-radius:${radius};background:rgba(255,255,255,.22);
          border:1px solid rgba(255,255,255,.25);"></div>
        <span style="font-size:12px;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.5);">${label}</span>
      </div>`;

    const homeScreen = (opts: { ios: boolean; appear: boolean }) => {
      gone("__ph_home");
      const radius = opts.ios ? "14px" : "50%";
      const iconRadius = opts.ios ? "14px" : "13px";
      const node = add(`
        <div id="__ph_home" style="position:absolute;inset:0;pointer-events:auto;opacity:0;
          transition:opacity .45s;background:linear-gradient(165deg,#0d2740 0%,#164b63 55%,#2c7f84 100%);">
          <div style="display:flex;justify-content:space-between;padding:14px 22px 0;color:#fff;
            font-size:14px;font-weight:700;">
            <span>6:12</span><span>${opts.ios ? "Không có sóng" : "4G"}</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:20px 10px;padding:46px 20px 0;">
            <div style="display:flex;flex-direction:column;align-items:center;gap:7px;">
              <div id="__ph_home_app" style="width:60px;height:60px;border-radius:${iconRadius};
                overflow:hidden;box-shadow:0 6px 18px rgba(0,0,0,.35);">
                <img src="/icons/icon-192.png" alt="" style="width:100%;height:100%;display:block;"/>
              </div>
              <span style="font-size:12px;font-weight:700;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.5);">SDFish</span>
            </div>
            ${other("Gọi", radius)}${other("Tin nhắn", radius)}${other("Ảnh", radius)}
          </div>
        </div>`);
      requestAnimationFrame(() => {
        node.style.opacity = "1";
      });
      if (opts.appear) {
        const icon = node.querySelector("#__ph_home_app") as HTMLElement | null;
        if (icon) {
          icon.style.transform = "scale(.2)";
          icon.style.transition = "transform .5s cubic-bezier(.2,1.4,.5,1)";
          icon.style.outline = "3px solid #ff7800";
          icon.style.outlineOffset = "4px";
          setTimeout(() => {
            icon.style.transform = "scale(1)";
          }, 500);
        }
      }
    };

    /* ── iOS: thanh Safari dưới cùng ─────────────────────────────────── */
    const safariIcon = (d: string, id?: string) => `
      <div ${id ? `id="${id}" style="pointer-events:auto;padding:2px 6px;"` : 'style="padding:2px 6px;"'}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#007aff"
          stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</svg>
      </div>`;

    const safariBar = () => {
      gone("__ph_sbar");
      add(`
        <div id="__ph_sbar" style="position:absolute;left:0;right:0;bottom:0;background:#f6f6f6f2;
          border-top:1px solid #d5d5da;padding:9px 12px 12px;box-shadow:0 -2px 10px rgba(0,0,0,.12);">
          <div style="display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #dcdce0;
            border-radius:12px;padding:9px 13px;">
            <span style="font-size:13px;color:#8e8e93;font-weight:800;">aA</span>
            <span style="flex:1;text-align:center;font-size:15px;color:#1c1c1e;font-weight:600;">${site}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1c1c1e" stroke-width="2"
              stroke-linecap="round"><path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/></svg>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:11px 12px 0;">
            ${safariIcon('<path d="M15 5l-7 7 7 7"/>')}
            ${safariIcon('<path d="M9 5l7 7-7 7"/>')}
            ${safariIcon('<path d="M12 16V4"/><path d="M8 8l4-4 4 4"/><path d="M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5"/>', "__ph_share")}
            ${safariIcon('<path d="M6 4h11a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z"/>')}
            ${safariIcon('<rect x="4" y="6" width="12" height="12" rx="2"/><path d="M8 4h10a2 2 0 0 1 2 2v10"/>')}
          </div>
        </div>`);
    };

    /* ── iOS: khay Chia sẻ ───────────────────────────────────────────── */
    const shareRow = (label: string, icon: string, id?: string, hot?: boolean) => `
      <div ${id ? `id="${id}"` : ""} style="display:flex;align-items:center;justify-content:space-between;
        padding:15px 16px;border-bottom:1px solid #e6e6ea;pointer-events:auto;
        ${hot ? "background:#fff4e6;" : ""}">
        <span style="font-size:16px;font-weight:${hot ? 800 : 600};color:#1c1c1e;">${label}</span>
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#1c1c1e" stroke-width="1.8"
          stroke-linecap="round" stroke-linejoin="round">${icon}</svg>
      </div>`;

    const safariShare = () => {
      gone("__ph_share_sheet");
      const node = add(`
        <div id="__ph_share_sheet" style="position:absolute;inset:0;background:rgba(0,0,0,.35);
          display:flex;align-items:flex-end;pointer-events:auto;">
          <div id="__ph_share_panel" style="width:100%;background:#f2f2f7;border-radius:16px 16px 0 0;
            padding-bottom:14px;transform:translateY(105%);transition:transform .4s ease-out;">
            <div style="display:flex;justify-content:center;padding:9px;">
              <span style="width:38px;height:5px;border-radius:3px;background:#c7c7cc;"></span>
            </div>
            <div style="display:flex;gap:12px;align-items:center;background:#fff;margin:0 10px;
              border-radius:13px;padding:13px;">
              <img src="/icons/icon-192.png" alt="" style="width:42px;height:42px;border-radius:9px;"/>
              <div style="min-width:0;">
                <div style="font-size:16px;font-weight:700;color:#1c1c1e;">SDFish</div>
                <div style="font-size:13px;color:#8e8e93;">${site}</div>
              </div>
            </div>
            <div style="background:#fff;margin:12px 10px 0;border-radius:13px;overflow:hidden;">
              ${shareRow("Sao chép", '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h9"/>')}
              ${shareRow("Thêm vào Danh sách đọc", '<path d="M4 5h16"/><path d="M4 12h16"/><path d="M4 19h10"/>')}
              ${shareRow("Thêm Dấu trang", '<path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1z"/>')}
              ${shareRow("Thêm vào Màn hình chính", '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 9v6"/><path d="M9 12h6"/>', "__ph_a2hs", true)}
            </div>
          </div>
        </div>`);
      requestAnimationFrame(() => {
        const p = node.querySelector("#__ph_share_panel") as HTMLElement | null;
        if (p) p.style.transform = "translateY(0)";
      });
      node.querySelector("#__ph_a2hs")?.addEventListener("click", () => {
        gone("__ph_share_sheet");
      });
    };

    /* ── iOS: bảng xác nhận "Thêm vào MH chính" ──────────────────────── */
    const iosAddSheet = () => {
      gone("__ph_add_sheet");
      const node = add(`
        <div id="__ph_add_sheet" style="position:absolute;inset:0;background:#f2f2f7;pointer-events:auto;
          opacity:0;transition:opacity .3s;">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 16px 12px;">
            <span style="font-size:16px;color:#007aff;font-weight:600;">Huỷ</span>
            <span style="font-size:16px;font-weight:800;color:#1c1c1e;">Thêm vào MH chính</span>
            <span id="__ph_add_ok" style="font-size:16px;color:#007aff;font-weight:800;
              pointer-events:auto;padding:4px 6px;">Thêm</span>
          </div>
          <div style="display:flex;gap:13px;align-items:center;background:#fff;margin:10px;
            border-radius:13px;padding:14px;">
            <img src="/icons/icon-192.png" alt="" style="width:52px;height:52px;border-radius:12px;"/>
            <div style="min-width:0;">
              <div style="font-size:17px;font-weight:700;color:#1c1c1e;">SDFish</div>
              <div style="font-size:13px;color:#8e8e93;margin-top:2px;">${site}</div>
            </div>
          </div>
          <p style="margin:6px 16px;font-size:14px;color:#8e8e93;line-height:1.4;">
            Biểu tượng sẽ nằm ở màn hình chính, mở ra dùng như một ứng dụng.
          </p>
        </div>`);
      requestAnimationFrame(() => {
        node.style.opacity = "1";
      });
      node.querySelector("#__ph_add_ok")?.addEventListener("click", () => gone("__ph_add_sheet"));
    };

    /* ── Chip "mất sóng" (đoạn cuối — mạng bị TẮT THẬT) ──────────────── */
    const noSignal = (on: unknown) => {
      gone("__ph_nosig");
      if (!on) return;
      add(`
        <div id="__ph_nosig" style="position:absolute;top:8px;left:50%;transform:translateX(-50%);
          display:flex;align-items:center;gap:7px;background:rgba(20,20,22,.9);color:#fff;
          padding:7px 14px;border-radius:999px;font-size:14px;font-weight:700;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"
            stroke-linecap="round"><path d="M3 3l18 18"/><path d="M5 20v-4"/><path d="M10 20V12"/>
            <path d="M15 20V9"/><path d="M20 20V5"/></svg>
          Không có sóng
        </div>`);
    };

    w.__ph = {
      androidBar,
      hideAndroidBar: () => gone("__ph_abar"),
      chromeInstallDialog,
      androidHome: (a: unknown) => homeScreen({ ios: false, appear: !!a }),
      safariBar,
      hideSafariBar: () => gone("__ph_sbar"),
      safariShare,
      iosAddSheet,
      iosHome: (a: unknown) => homeScreen({ ios: true, appear: !!a }),
      fadeHome: () => {
        const h = document.getElementById("__ph_home");
        if (!h) return;
        h.style.opacity = "0";
        setTimeout(() => h.remove(), 500);
      },
      noSignal,
      /* Phụ đề mặc định nằm cách đáy 96px — thanh Safari giả cao hơn thế, đẩy
         phụ đề lên cho khỏi bị che. */
      captionBottom: (a: unknown) => {
        const el = document.getElementById("__tut_caption");
        if (el) el.style.bottom = `${Number(a) || 96}px`;
      },
      clear: () => document.getElementById("__ph_root")?.remove(),
    };
  }, SITE_URL);
}

export const androidBar = (p: Page) => call(p, "androidBar");
export const hideAndroidBar = (p: Page) => call(p, "hideAndroidBar");
export const androidHome = (p: Page, appear = true) => call(p, "androidHome", appear);
export const safariBar = (p: Page) => call(p, "safariBar");
export const hideSafariBar = (p: Page) => call(p, "hideSafariBar");
export const safariShare = (p: Page) => call(p, "safariShare");
export const iosAddSheet = (p: Page) => call(p, "iosAddSheet");
export const iosHome = (p: Page, appear = true) => call(p, "iosHome", appear);
export const fadeHome = (p: Page) => call(p, "fadeHome");
export const noSignal = (p: Page, on: boolean) => call(p, "noSignal", on);
export const captionBottom = (p: Page, px: number) => call(p, "captionBottom", px);
export const clearChrome = (p: Page) => call(p, "clear");

/**
 * Giả sự kiện `beforeinstallprompt` của Chrome/Android.
 *
 * Vì sao phải giả: Chrome chỉ bắn sự kiện này khi máy thật đủ điều kiện (đã ghé
 * vài lần, không phải cửa sổ tự động…) — trình duyệt lúc quay video KHÔNG bắn,
 * nên thẻ nhắc "Cài SDFish về máy" (components/install-prompt.tsx) sẽ không hiện.
 * Thẻ nhắc vẫn là THẬT: nó nghe sự kiện, và khi bà con bấm "Cài về máy" thì gọi
 * `prompt()` — ở đây `prompt()` mở hộp thoại VẼ LẠI của Chrome.
 */
export async function fakeInstallPrompt(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as {
      __ph: Record<string, () => void>;
      __phChoice?: () => void;
    };
    const e = new Event("beforeinstallprompt") as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string }>;
    };
    e.prompt = async () => {
      w.__ph.chromeInstallDialog();
    };
    e.userChoice = new Promise((resolve) => {
      w.__phChoice = () => {
        resolve({ outcome: "accepted" });
        window.dispatchEvent(new Event("appinstalled"));
      };
    });
    window.dispatchEvent(e);
  });
}
