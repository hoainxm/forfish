import "server-only";
import { identityFromRequest, premiumDenied } from "@/lib/api-identity";

/*
  CHỐT PREMIUM ở SERVER cho tính năng ngoài `/api/fish-forecast` (cái đó chặn ở
  middleware). Hiện dùng cho sổ cảnh báo thuyền viên.

  ⚠️ VIẾT LẠI 2026-08-16 (thẩm định P0 — DANH TÍNH TÁCH NÃO).

  Bản cũ hỏi `supabase.auth.getUser()`, tức đọc PHIÊN trong cookie. Từ 0026 app
  ngư dân KHÔNG CÒN GIỮ PHIÊN: `/login` cấp chuỗi cứng (device token) rồi
  `signOut()` ngay trong cùng một lượt (`src/app/login/page.tsx`). Nên `getUser()`
  trả rỗng trên MỌI máy bà con ⇒ guard này trả **401 login_required cho đúng
  những người đang đăng nhập**. Màn Bạn thuyền mở ô tra cảnh báo, gõ xong thì
  nhận "Cần đăng nhập" — trong khi họ đăng nhập rồi, và premium thì đã trả tiền.

  Chín route khác của app đã đi qua `identityFromRequest` từ 0026/0028; hai route
  crew-reports là chỗ bị bỏ quên. Nay dùng chung đúng hai hàm đó:
   · `identityFromRequest(req)` — ai đang gọi (chuỗi cứng, có đường lùi phiên cũ
     một nhịp phát hành, và KHÔNG BAO GIỜ trả 401 vì sự cố hạ tầng).
   · `premiumDenied(req)`       — hạng của người đó (admin env vẫn qua; tra hạng
     hỏng ⇒ 503 chứ không 403, đúng luật "không tra được ≠ chưa premium").

  KHÔNG viết lại logic hạng ở đây: một bản luật, một chỗ sửa.
*/

export async function requirePremiumUser(
  req: Request,
): Promise<
  { ok: true; phone: string } | { ok: false; status: number; code: string }
> {
  const denied = await premiumDenied(req);
  if (denied) return { ok: false, ...denied };

  /*  `premiumDenied` trả `null` ở hai ca: cho qua vì premium, và cho qua vì
      demo mode (chưa cấu hình Supabase). Route crew-reports cần SĐT người báo
      để ghi vào kho nên vẫn phải hỏi danh tính; demo mode không có DB thật thì
      `identityFromRequest` tự trả 401/503 đúng nghĩa. */
  const who = await identityFromRequest(req);
  if (!who.ok) {
    return { ok: false, status: who.res.status, code: "login_required" };
  }
  return { ok: true, phone: who.phone };
}
