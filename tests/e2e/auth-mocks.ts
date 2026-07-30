import type { BrowserContext, Page } from "@playwright/test";

/**
 * Mock Supabase GIẢ cho build "auth" (e2edemo.supabase.co) — tạo trạng thái
 * "đã đăng nhập, hạng premium" hoàn toàn trong trình duyệt để quay video
 * hướng dẫn. KHÔNG có request nào rời máy: mọi call Supabase + API cảnh báo
 * đều bị chặn và trả dữ liệu dựng sẵn.
 */

export const FAKE_HOST = "e2edemo.supabase.co";
const UID = "e2e00000-0000-4000-8000-000000000001";
const PHONE = "0901234567";

const fakeUser = {
  id: UID,
  aud: "authenticated",
  role: "authenticated",
  email: `${PHONE}@sdfish.local`,
  email_confirmed_at: "2026-01-01T00:00:00Z",
  phone: "",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function b64url(s: string): string {
  return Buffer.from(s, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Gieo cookie phiên đăng nhập theo định dạng @supabase/ssr ("base64-…"). */
export async function seedSession(context: BrowserContext, origin: string) {
  const session = {
    access_token: "e2e-access-token",
    token_type: "bearer",
    expires_in: 31536000,
    expires_at: Math.floor(Date.now() / 1000) + 31536000,
    refresh_token: "e2e-refresh-token",
    user: fakeUser,
  };
  const u = new URL(origin);
  await context.addCookies([
    {
      name: "sb-e2edemo-auth-token",
      value: "base64-" + b64url(JSON.stringify(session)),
      domain: u.hostname,
      path: "/",
      expires: Math.floor(Date.now() / 1000) + 31536000,
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);
}

export interface ListingRow {
  id: string;
  owner_id: string;
  side: "ban" | "mua";
  poster_kind: string;
  poster_name: string;
  species: string;
  quantity: string | null;
  price_text: string | null;
  province: string | null;
  phone: string | null;
  note: string | null;
  status: "open" | "closed";
  created_at: string;
}

const today = new Date().toISOString();
const seedListings: ListingRow[] = [
  {
    id: "l1",
    owner_id: "other-1",
    side: "mua",
    poster_kind: "nha-may",
    poster_name: "Nhà máy chế biến Bình Định",
    species: "cá ngừ sọc dưa",
    quantity: "3 tấn/ngày",
    price_text: "28.000đ/kg",
    province: "Bình Định",
    phone: "0905000111",
    note: "Nhận hàng tại cảng Quy Nhơn, cân điện tử.",
    status: "open",
    created_at: today,
  },
  {
    id: "l2",
    owner_id: "other-2",
    side: "ban",
    poster_kind: "ngu-dan",
    poster_name: "Tàu anh Tám Phú Yên",
    species: "cá ngừ đại dương",
    quantity: "1,5 tấn",
    price_text: "Thỏa thuận",
    province: "Phú Yên",
    phone: "0905000222",
    note: "Cập cảng Đông Tác sáng mai.",
    status: "open",
    created_at: today,
  },
  {
    id: "l3",
    owner_id: "other-3",
    side: "mua",
    poster_kind: "vua",
    poster_name: "Vựa hải sản cô Sáu",
    species: "mực ống",
    quantity: "500 kg",
    price_text: "120.000đ/kg",
    province: "Khánh Hòa",
    phone: "0905000333",
    note: null,
    status: "open",
    created_at: today,
  },
];

/** CCCD sẽ trả CÓ cảnh báo trong video (mọi CCCD khác: sạch). */
export const WARN_CCCD = "079088999777";

const warnReports = [
  {
    id: "r1",
    category: "bo_tau",
    detail: "Bỏ tàu ở đảo giữa chuyến, không báo trước.",
    reporterBoat: "Tàu BĐ 97531 TS",
    createdAt: "2026-05-12T08:00:00Z",
    subjectResponse: null,
    subjectRespondedAt: null,
  },
  {
    id: "r2",
    category: "no_ung",
    detail: "Ứng 5 triệu trước chuyến rồi không xuống tàu.",
    reporterBoat: "Tàu PY 90124 TS",
    createdAt: "2026-03-02T08:00:00Z",
    subjectResponse: null,
    subjectRespondedAt: null,
  },
];

/**
 * Cài toàn bộ mock cho một page của build "auth":
 * · e2edemo.supabase.co/auth/v1/user → user giả (đăng nhập)
 * · rest/v1/customers → premium
 * · rest/v1/market_listings → tin dựng sẵn (POST thì thêm vào đầu danh sách)
 * · /api/crew-reports/lookup → sạch, riêng WARN_CCCD có 2 cảnh báo
 * · /api/crew-reports (POST) → ok
 * · chặn /sw.js để Service Worker không xen vào mock
 */
export async function installMocks(page: Page) {
  const listings: ListingRow[] = [...seedListings];
  let nextId = 100;

  await page.context().route(/\/sw\.js/, (r) =>
    r.fulfill({ status: 404, body: "" }),
  );

  await page.context().route(new RegExp(FAKE_HOST.replace(/\./g, "\\.")), async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;

    if (path.startsWith("/auth/v1/user"))
      return route.fulfill({ json: fakeUser });
    if (path.startsWith("/auth/v1/token"))
      return route.fulfill({
        json: {
          access_token: "e2e-access-token",
          token_type: "bearer",
          expires_in: 31536000,
          expires_at: Math.floor(Date.now() / 1000) + 31536000,
          refresh_token: "e2e-refresh-token",
          user: fakeUser,
        },
      });
    if (path.startsWith("/auth/v1/logout"))
      return route.fulfill({ status: 204, body: "" });

    if (path.startsWith("/rest/v1/customers"))
      return route.fulfill({ json: { tier: "premium", premium_until: null } });

    if (path.startsWith("/rest/v1/market_listings")) {
      if (req.method() === "POST") {
        const body = req.postDataJSON() as Partial<ListingRow>;
        listings.unshift({
          id: `new-${nextId++}`,
          owner_id: UID,
          side: (body.side as "ban" | "mua") ?? "ban",
          poster_kind: body.poster_kind ?? "ngu-dan",
          poster_name: body.poster_name ?? "",
          species: body.species ?? "",
          quantity: body.quantity ?? null,
          price_text: body.price_text ?? null,
          province: body.province ?? null,
          phone: body.phone ?? null,
          note: body.note ?? null,
          status: "open",
          created_at: new Date().toISOString(),
        });
        return route.fulfill({ status: 201, json: [] });
      }
      return route.fulfill({ json: listings });
    }

    // bảng/endpoint khác chưa cần cho video → rỗng
    if (path.startsWith("/rest/v1/"))
      return route.fulfill({ json: [] });
    return route.fulfill({ status: 404, body: "" });
  });

  // Đăng ký trên CONTEXT bằng regex — phủ mọi nguồn phát request của page
  await page.context().route(/\/api\/crew-reports/, (route) => {
    const req = route.request();
    if (req.method() === "POST")
      return route.fulfill({ json: { ok: true } });
    const url = new URL(req.url());
    const cccd = url.searchParams.get("cccd") ?? "";
    if (cccd === WARN_CCCD)
      return route.fulfill({
        json: { ok: true, count: warnReports.length, reports: warnReports },
      });
    return route.fulfill({ json: { ok: true, count: 0, reports: [] } });
  });
}
