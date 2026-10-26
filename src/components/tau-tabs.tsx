"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BoatSwitcher } from "@/components/boat-switcher";
import { DocumentVault } from "@/components/document-vault";
import { VmsRenewal } from "@/components/vms-renewal";
import { BoatServices } from "@/components/boat-services";
import { BoatProducts } from "@/components/boat-products";
import { LoginGate } from "@/components/login-gate";
import { useBoats } from "@/lib/boat-store";
import { BOAT_URL_PARAM, boatFromParam } from "@/lib/boats";

/*
  HỒ SƠ TÀU — nội dung /tau (dock "Tàu tôi", 2026-10-19): giấy tờ, dịch vụ +
  bảo dưỡng, giám sát hành trình, thiết bị đang dùng của TÀU ĐANG CHỌN. Chọn tàu
  CHỈ ở đây (bỏ ở Chợ cá / Bạn thuyền).

  Trước 2026-10-19 là ba tab Tàu của tôi · Cửa hàng · Đơn (mặc định mở Cửa hàng)
  — vật tư nằm cả ở đây lẫn sau Giao dịch. Nay Cửa hàng + Đơn là mục dock Vật tư;
  chấm báo tab bỏ theo (việc quá hạn đã hiện ở dải "việc cần xử lý" Trang chủ và
  ngay trong từng thẻ bên dưới).

  Deep-link cũ vẫn phải chạy (nhắc việc, chip trợ lý, thông báo đẩy, link bà con
  đã lưu): ?tab=cua-hang ⇒ /cho, ?tab=don ⇒ /cho/don; giay-to · dich-vu ·
  san-pham · tau-cua-toi ⇒ ở lại đây. replace (không push) để nút Quay lại không
  vấp lại chính link chuyển.
*/
export function TauTabs() {
  return <Suspense fallback={<p role="status" className="p-4 text-[1rem]">Đang mở hồ sơ tàu…</p>}><HoSoTau /></Suspense>;
}

function HoSoTau() {
  const params = useSearchParams();
  const router = useRouter();
  const wanted = params.get("tab");
  const sangVatTu = wanted === "cua-hang" ? "/cho" : wanted === "don" ? "/cho/don" : null;
  useEffect(() => {
    if (sangVatTu) router.replace(sangVatTu);
  }, [sangVatTu, router]);
  /*  LỜI NHẮC MỞ ĐÚNG TÀU (O2, 2026-10-21): `?tau=<id>` từ dải khẩn / sheet
      nhắc hạn / thông báo điện thoại ⇒ ĐỔI LUÔN tàu đang chọn (như tự bấm chọn
      tàu), rồi gỡ tham số khỏi đường dẫn — tải lại trang không kéo bà con về
      tàu cũ sau khi họ tự đổi. Tàu đã xoá / tham số rác ⇒ giữ tàu đang chọn. */
  const { current, boats, ready: boatReady, setCurrent } = useBoats();
  const wantedBoat = params.get(BOAT_URL_PARAM);
  useEffect(() => {
    if (!boatReady || !wantedBoat) return;
    const target = boatFromParam(wantedBoat, boats, current?.id);
    if (target) setCurrent(target);
    const url = new URL(window.location.href);
    url.searchParams.delete(BOAT_URL_PARAM);
    window.history.replaceState(null, "", url.pathname + url.search);
  }, [boatReady, wantedBoat, boats, current?.id, setCurrent]);

  return (
    <div className="tau-owned">
      <BoatSwitcher compact />
      <section aria-label="Giấy tờ tàu"><DocumentVault /></section>
      <LoginGate
        feature="dịch vụ và nhắc bảo dưỡng"
        blurb="Đăng nhập để theo dõi dịch vụ, công nợ SDVICO, lịch bảo dưỡng và đồ đã mua — dữ liệu riêng của bà con."
        accent="t3"
      >
        <section aria-label="Dịch vụ và bảo dưỡng" className="mt-6"><BoatServices /></section>
        {/* Gia hạn VMS đặt NGAY SAU sổ nhắc bảo dưỡng (mục cuối của BoatServices) */}
        {/* PHẲNG như mọi mục khác của Tàu tôi (rà bố cục 2026-10-22): trước bọc thẻ trắng p-4 ⇒
            nội dung thụt 36px, lệch mép 16px của các mục; tiêu đề 1rem lệch bậc 1.125rem */}
        <section aria-label="Giám sát hành trình" className="mt-6 px-4"><VmsRenewal /></section>
        <section aria-label="Thiết bị đang dùng" className="mt-6"><div className="tau-section-title"><h2>Thiết bị đang dùng</h2></div><BoatProducts /></section>
      </LoginGate>
    </div>
  );
}
