import { type NextRequest } from "next/server";
import { premiumGate } from "@/lib/supabase/middleware";

/**
 * CHỐT PREMIUM của /api/fish-forecast — và từ 2026-08-02 thì CHỈ CÓ THẾ.
 *
 * Bản cũ chạy trên gần như mọi đường dẫn với đúng một mục đích: gọi
 * `auth.getUser()` để @supabase/ssr làm tươi phiên. Việc đó nay KHÔNG CÒN CẦN —
 * app ngư dân không giữ phiên nữa, nó giữ một chuỗi cứng không hết hạn
 * (lib/device-token.ts). Và việc đó chính là thứ đang **đá bà con ra khỏi tài
 * khoản**: mỗi lần mở app là mấy request song song, mỗi request một edge instance
 * riêng cùng xoay một refresh token; ngoài biển chỉ cần một lượt xoay mà phản hồi
 * không về là phiên chết vĩnh viễn.
 *
 * Bỏ nó đi thì mất luôn cả một lớp chậm: mỗi lượt vào trang trước đây phải chờ
 * một vòng tới Supabase Auth ở edge, không timeout, không catch.
 */
export async function middleware(request: NextRequest) {
  return await premiumGate(request);
}

export const config = {
  /*  MỘT ĐƯỜNG DUY NHẤT. Không còn danh sách loại trừ dài dằng dặc (ô bản đồ,
      chunk js, font, ảnh…) vì không còn gì cần chạy trên các đường đó.
      ⚠️ THÊM CHỐT QUYỀN MỚI thì thêm đường vào đây VÀ vào
      `middleware-matcher.test.ts` — nó là cổng chặn khuôn, cố ý liệt kê từng
      đường dẫn để không ai nới chốt quyền mà không ai thấy. */
  matcher: ["/api/fish-forecast"],
};
