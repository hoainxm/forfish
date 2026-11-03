import Link from "next/link";
import { CrewList } from "@/components/crew-list";
import { BriefcaseIcon, ChevronRightIcon } from "@/components/icons";
import { ManHeader } from "@/components/man-header";
import { TauToiNav } from "@/components/tau-toi-nav";
import { RequireLogin } from "@/components/require-login";
import { ToastHost } from "@/components/ui/toast";
import { NHAN } from "@/lib/labels";

export const metadata = { title: "Bạn thuyền — SDFish" };

// Trục NGƯỜI (lao động), cấu trúc 2026-07-27: hồ sơ thuyền viên (định danh
// CCCD) + chứng chỉ/bảo hiểm + tra cảnh báo chéo trước khi nhận người
// (premium). KHÔNG dính tiền — sổ ứng/chia tiền đã gỡ hẳn.
export default function NguoiPage() {
  return (
    <div>
      {/* TÀU TÔI › Bạn thuyền (dock 2026-10-19) — cùng đầu màn + thanh với /tau */}
      <ManHeader title="Tàu tôi" />
      <TauToiNav />
      {/*  ĐỔI `LoginGate` → `RequireLogin` (chủ dự án 2026-09-01): từ nay CẢ
           app cần tài khoản. Người ngoài tự đăng ký lại được (2026-09-23) —
           thẻ khoá mời TẠO tài khoản hoặc đăng nhập, không còn bắt gọi SDVICO. */}
      <RequireLogin what="sổ thuyền viên">
        {/* Bỏ BoatSwitcher (2026-10-19): sổ bạn thuyền là danh bạ CHUNG của chủ tàu, bộ chọn tàu ở đây làm tưởng danh sách bị lọc */}
        {/* VIỆC LÀM (spec 17 §6.3, §12.3): chủ tàu tìm người từ đây — Tin của tôi, đăng tin, xem hồ sơ tìm tàu */}
        <div className="px-4 pb-3">
          <Link
            href="/viec/cua-toi"
            className="surface flex min-h-(--h-row) items-center gap-3 px-4 text-[0.9375rem] font-semibold text-navy"
          >
            <BriefcaseIcon className="h-5 w-5 shrink-0 text-sea" />
            <span className="min-w-0 flex-1">
              {NHAN.tuyenNguoi}
              <span className="block text-[0.8125rem] font-normal text-muted">Đăng tin tìm bạn thuyền, gọi thẳng người tìm tàu</span>
            </span>
            <ChevronRightIcon className="h-5 w-5 shrink-0 text-muted" />
          </Link>
        </div>
        <CrewList />
      </RequireLogin>
      {/* biên nhận nổi (xoá có Hoàn tác) — dự phòng tới khi vỏ app gắn <ToastHost/>; host thứ hai tự im */}
      <ToastHost />
    </div>
  );
}
