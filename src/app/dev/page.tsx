import { PageHeader } from "@/components/page-header";
import { DevPanel } from "./dev-panel";

export const metadata = { title: "Dev — SDFish" };

// Trang dev CHỈ có tác dụng khi chạy `npm run dev:cho` (MARKET_STORE=file).
// Ở prod trang vẫn build được: client fetch /api/dev/personas → 404 → thông báo.
export default function DevPage() {
  return (
    <div>
      <PageHeader
        kicker="Dev"
        title="Persona thử Cửa hàng"
        sub="Chỉ dùng khi chạy MARKET_STORE=file npm run dev — dữ liệu nằm ở .local/market-dev.json."
        toColor="var(--t4)"
      />
      <DevPanel />
    </div>
  );
}
