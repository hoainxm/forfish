"use client";

import { useMemo, useState } from "react";
import { Tabs } from "@/components/ui/tabs";
import { StatusBanner } from "@/components/ui/status-banner";
import { DocumentVault } from "@/components/document-vault";
import { DepartureChecklist } from "@/components/departure-checklist";
import { FinesLookup } from "@/components/fines-lookup";
import { BoatServices } from "@/components/boat-services";
import { BoatProducts } from "@/components/boat-products";
import { useSdvicoAssets } from "@/lib/use-sdvico-assets";
import { formatVnd } from "@/lib/format";

/*
  Cụm tab trang /tau — client wrapper để tiền nong KHÔNG nấp sau 2 chạm
  (roadmap hội đồng UX 2026-06-11): có nợ quá hạn bên SDVICO là banner đỏ
  hiện ngay dưới BoatSwitcher (chạm là nhảy vào tab Dịch vụ) + chấm đỏ trên
  tab. Tabs nhận deep-link ?tab= (nhắc việc từ trang chủ rơi đúng tab).
*/
export function TauTabs() {
  const { assets } = useSdvicoAssets();
  const [tab, setTab] = useState("giay-to");

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const overdue = useMemo(
    () =>
      (assets?.payments ?? []).filter((p) => p.dueOn != null && p.dueOn < todayIso),
    [assets, todayIso],
  );
  const overdueTotal = overdue.reduce((s, p) => s + p.amountVnd, 0);

  return (
    <div>
      {overdue.length > 0 && tab !== "dich-vu" && (
        <button
          type="button"
          onClick={() => setTab("dich-vu")}
          className="mx-4 mb-1 block w-[calc(100%-2rem)] overflow-hidden rounded-[1.25rem] text-left transition active:scale-[0.99]"
        >
          <StatusBanner level="danger">
            Có khoản nợ quá hạn {formatVnd(overdueTotal)} — chạm để xem
          </StatusBanner>
        </button>
      )}
      <Tabs
        ariaLabel="Mục quản lý tàu"
        paramKey="tab"
        value={tab}
        onChange={setTab}
        tabs={[
          {
            id: "giay-to",
            label: "Giấy tờ",
            content: (
              <>
                <DepartureChecklist />
                <DocumentVault />
              </>
            ),
          },
          {
            id: "dich-vu",
            label: "Dịch vụ",
            badge: overdue.length > 0,
            content: <BoatServices />,
          },
          { id: "san-pham", label: "Sản phẩm", content: <BoatProducts /> },
          { id: "muc-phat", label: "Mức phạt", content: <FinesLookup /> },
        ]}
      />
    </div>
  );
}
