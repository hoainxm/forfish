"use client";

import { useEffect, useMemo, useState } from "react";
import { Tabs } from "@/components/ui/tabs";
import { DocumentVault, loadDocs } from "@/components/document-vault";
import { VmsRenewal } from "@/components/vms-renewal";
import { BoatServices } from "@/components/boat-services";
import { BoatProducts } from "@/components/boat-products";
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
export function TauTabs() {
  const { assets } = useSdvicoAssets();
  const { current, ready: boatReady } = useBoats();
  const { today, todayIso } = useTodayVN();
  const [tab, setTab] = useState("giay-to");
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
      <Tabs
        ariaLabel="Mục quản lý tàu"
        paramKey="tab"
        value={tab}
        onChange={setTab}
        tabs={[
          {
            id: "giay-to",
            label: "Giấy tờ",
            badge: docsBadge,
            content: <DocumentVault />,
          },
          {
            id: "dich-vu",
            label: "Dịch vụ",
            badge: sdvicoOverdue || maintOverdue,
            content: (
              <LoginGate
                feature="dịch vụ và nhắc bảo dưỡng"
                blurb="Đăng nhập để theo dõi dịch vụ, công nợ SDVICO và lịch bảo dưỡng — dữ liệu riêng của bạn."
                accent="t3"
              >
                <BoatServices />
                {/* Gia hạn VMS đặt NGAY SAU sổ nhắc bảo dưỡng (mục cuối của BoatServices) */}
                <VmsRenewal />
              </LoginGate>
            ),
          },
          {
            id: "san-pham",
            label: "Sản phẩm",
            content: (
              <LoginGate
                feature="sản phẩm của tàu"
                blurb="Đăng nhập để quản lý đồ đã mua, bảo hành — dữ liệu riêng của bạn."
                accent="t3"
              >
                <BoatProducts />
              </LoginGate>
            ),
          },
        ]}
      />
    </div>
  );
}
