import { LOCAL_BUILD_ID } from "@/lib/app-version";

/**
 * Mã bản ĐANG deploy — client so với mã nó nhúng lúc build để biết có bản mới
 * (lib/app-version.ts, components/update-notice.tsx). Công khai, không dữ liệu
 * gì ngoài mã commit rút gọn; KHÔNG gác (không phải route dữ liệu — xem
 * data-route-rules.test). `no-store` ở mọi tầng: CDN hay SW giữ bản cũ là báo sai.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { build: LOCAL_BUILD_ID },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
