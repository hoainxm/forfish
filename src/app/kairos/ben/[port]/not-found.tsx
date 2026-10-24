import Link from "next/link";
import { MarketHeader } from "@/components/market/shared/market-header";
import { EmptyState } from "@/components/ui/primitives";

// Bến mã lạ (14 §3.9, §10 "mã lạ ⇒ Không tìm thấy").
export default function BenNotFound() {
  return (
    <div>
      <MarketHeader title="Bến" fallback="/kairos" />
      <div className="px-4">
        <EmptyState>
          Không tìm thấy cảng này.{" "}
          <Link href="/kairos" className="font-semibold text-sea">
            Về Kairos
          </Link>
        </EmptyState>
      </div>
    </div>
  );
}
