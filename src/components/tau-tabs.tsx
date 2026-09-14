"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BoatSwitcher } from "@/components/boat-switcher";
import { AnchorIcon, CartIcon, DocIcon } from "@/components/icons";
import { DocumentVault, loadDocs } from "@/components/document-vault";
import { VmsRenewal } from "@/components/vms-renewal";
import { BoatServices } from "@/components/boat-services";
import { BoatProducts } from "@/components/boat-products";
import { MarketHome } from "@/components/market/buyer/market-home";
import { MyMarketOrders } from "@/components/market/buyer/my-market-orders";
import { RequireLogin } from "@/components/require-login";
import { LoginGate } from "@/components/login-gate";
import {
  getDueStatus,
  loadEntries,
} from "@/components/maintenance-reminders";
import { getExpiryStatus } from "@/lib/documents";
import { getServiceDueStatus } from "@/lib/owned-assets";
import { useSdvicoAssets } from "@/lib/use-sdvico-assets";
import { useBoats } from "@/lib/boat-store";
import { useTodayVN } from "@/lib/use-today";

/*
  Cụm tab trang /tau. Tabs nhận deep-link ?tab= (nhắc việc từ trang chủ rơi
  đúng tab).

  BADGE TAB (T6/T7, audit thông báo 2026-08-18): một khoản nợ từng hiện 4 chỗ
  (dải khẩn · banner đỏ đầu /tau · chấm đỏ tab · thẻ trong tab). Nay còn 2:
  dải khẩn Trang chủ (khi quá hạn) + thẻ trong tab Dịch vụ. Banner đỏ đầu /tau
  đã bỏ; chấm đỏ tab chuyển thành:
  · Giấy tờ  — giấy QUÁ HẠN / SẮP HẾT của tàu đang chọn (trục 4 là lý do app
    tồn tại, trước đây tab này không có badge)
  · Dịch vụ  — nợ SDVICO quá hạn HOẶC bảo dưỡng tự ghi / kỳ dịch vụ SDVICO quá hạn
  Đọc lại mỗi lần đổi tab / đổi tàu / đổi ngày.
*/
/*  Mã tab CŨ vẫn còn trong trang chủ, chip trợ lý, tài liệu và liên kết bà con đã
    lưu. Giữ chúng chạy được thay vì đi sửa mọi nơi rồi bỏ sót một chỗ. */
const CU_SANG_MOI: Record<string, string> = {
  "giay-to": "tau-cua-toi",
  "dich-vu": "tau-cua-toi",
  "san-pham": "tau-cua-toi",
};

export function TauTabs() {
  return <Suspense fallback={<p role="status" className="p-4">Đang mở tàu cá…</p>}><TauTabsContent /></Suspense>;
}

function TauTabsContent() {
  const { assets } = useSdvicoAssets();
  const { current, ready: boatReady } = useBoats();
  const { today, todayIso } = useTodayVN();
  /*  BA TAB (chủ dự án chốt 2026-09-07): "dịch vụ, sản phẩm, giấy tờ của tàu vào
      1 tab (là các sản phẩm, giấy tờ, dịch vụ tàu đang sử dụng), thêm tab Cửa hàng,
      tab Đơn" — mặc định mở **Cửa hàng**.

      Vì sao gộp: ba mục cũ đều trả lời CÙNG MỘT câu — "tàu tôi đang có gì, cái nào
      sắp phải lo". Tách ba tab bắt bà con nhớ giấy tờ nằm tab nào, bảo dưỡng tab nào.
      Còn mua đồ và xem đơn là việc KHÁC hẳn, nên chúng mới đáng một tab riêng —
      và nhúng THẲNG vào đây thay vì nhảy sang màn khác rồi bấm Quay lại.

      Deep-link cũ (?tab=giay-to · dich-vu · san-pham) từ trang chủ, chip trợ lý và
      tài liệu vẫn phải chạy: map hết về tab gộp, không để bà con bấm nhắc việc rồi
      rơi vào tab trống. */
  const params = useSearchParams();
  const wanted = params.get("tab") ?? "cua-hang";
  const mapped = CU_SANG_MOI[wanted] ?? wanted;
  const tab = ["tau-cua-toi", "cua-hang", "don"].includes(mapped) ? mapped : "cua-hang";
  const setTab = (id: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", id);
    window.history.pushState(null, "", url.pathname + url.search);
  };
  const [docsBadge, setDocsBadge] = useState(false);
  const [maintOverdue, setMaintOverdue] = useState(false);

  // Kho trên máy: giấy tờ + bảo dưỡng của tàu đang chọn (item chưa gắn tàu =
  // của tàu đang chọn, cùng luật với DocumentVault/MaintenanceReminders).
  useEffect(() => {
    if (!boatReady) return;
    const ofBoat = <T extends { boatId?: string }>(x: T) =>
      x.boatId === current?.id || x.boatId == null;

    const d = loadDocs();
    setDocsBadge(
      !d.readFailed &&
        d.docs.some((doc) => {
          if (!ofBoat(doc)) return false;
          const lv = getExpiryStatus(doc, today).level;
          return lv === "expired" || lv === "soon";
        }),
    );

    const m = loadEntries();
    setMaintOverdue(
      !m.readFailed &&
        m.entries.some(
          (e) => ofBoat(e) && getDueStatus(e, today).level === "overdue",
        ),
    );
    // đọc lại khi đổi tab (vừa sửa xong trong tab), đổi tàu, đổi ngày
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, current?.id, todayIso, boatReady]);

  const sdvicoOverdue = useMemo(() => {
    if (!assets) return false;
    if (assets.payments.some((p) => p.dueOn != null && p.dueOn < todayIso))
      return true;
    return assets.services.some(
      (s) => getServiceDueStatus(s, today).level === "overdue",
    );
  }, [assets, today, todayIso]);

  return (
    <div>
      <nav aria-label="Mục quản lý tàu" className="tau-nav sticky z-30 bg-background px-4 py-3">
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-field p-1">
          {[
            { id: "tau-cua-toi", label: "Tàu của tôi", icon: AnchorIcon },
            { id: "cua-hang", label: "Cửa hàng", icon: CartIcon },
            { id: "don", label: "Đơn hàng", icon: DocIcon },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" aria-current={tab === id ? "page" : undefined}
              onClick={() => setTab(id)}
              className={`relative flex min-h-[4rem] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[0.9375rem] font-bold ${tab === id ? "bg-navy text-white shadow-sm" : "text-navy"}`}>
              <Icon className="h-6 w-6" /><span>{label}</span>
              {id === "tau-cua-toi" && (docsBadge || sdvicoOverdue || maintOverdue) && <span aria-label="Có việc cần xem" className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger ring-2 ring-card" />}
            </button>
          ))}
        </div>
      </nav>
      {[
          {
            id: "tau-cua-toi",
            label: "Tàu của tôi",
            badge: docsBadge || sdvicoOverdue || maintOverdue,
            content: (
              <div className="tau-owned">
                <BoatSwitcher compact />
                <section aria-label="Giấy tờ tàu"><DocumentVault /></section>
                <LoginGate
                  feature="dịch vụ và nhắc bảo dưỡng"
                  blurb="Đăng nhập để theo dõi dịch vụ, công nợ SDVICO, lịch bảo dưỡng và đồ đã mua — dữ liệu riêng của bạn."
                  accent="t3"
                >
                  <section aria-label="Dịch vụ và bảo dưỡng" className="mt-6"><BoatServices /></section>
                  {/* Gia hạn VMS đặt NGAY SAU sổ nhắc bảo dưỡng (mục cuối của BoatServices) */}
                  <section aria-label="Giám sát hành trình" className="mx-4 mt-6 rounded-2xl bg-card p-4"><VmsRenewal /></section>
                  <section aria-label="Thiết bị đang dùng" className="mt-6"><div className="tau-section-title"><h2>Thiết bị đang dùng</h2></div><BoatProducts /></section>
                </LoginGate>
              </div>
            ),
          },
          {
            id: "cua-hang",
            label: "Cửa hàng",
            content: <MarketHome embedded />,
          },
          {
            id: "don",
            label: "Đơn",
            content: (
              <RequireLogin what="đơn hàng">
                <MyMarketOrders />
              </RequireLogin>
            ),
          },
        ].find((item) => item.id === tab)?.content}
    </div>
  );
}
