import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { AuthCard, AuthNote } from "@/components/auth-form";
import { CallButton } from "@/components/ui/primitives";
import { SDVICO_HOTLINE } from "@/data/sdvico-showcase";

export const metadata = { title: "Đăng ký — SDFish" };

/*
  MÀN TỰ ĐĂNG KÝ ĐÃ KHOÁ (chủ dự án 2026-09-01: *"yêu cầu phải liên hệ SDVICO
  để cấp acc"*, chọn phương án "giữ màn nhưng khoá lại").

  VÌ SAO GIỮ MÀN CHỨ KHÔNG XOÁ ROUTE: đường `/dang-ky` đã phát ra ngoài — nằm
  trong tin nhắn nhân viên gửi khách, trong ảnh chụp màn, và ngay trong câu
  "Đăng nhập / Đăng ký" của các thẻ khoá cũ. Xoá route là bà con bấm vào ra 404
  giữa lúc đang cần tài khoản; giữ lại thì trang tự nói phải gọi ai.

  BIỂU MẪU CŨ GỠ HẲN, không ẩn đi: để lại form sống mà chặn ở server là hai
  đường cho cùng một việc, và là chỗ người sau tưởng còn dùng được. Lịch sử git
  giữ bản cũ nếu cần lấy lại.

  ⚠️ ĐÂY LÀ LỚP VỎ. Cửa thật vẫn là `/api/auth/*` + RLS — route tạo tài khoản
  phải TỰ chặn người ngoài, không dựa vào việc màn này biến mất.
*/
export default function DangKyPage() {
  return (
    <div>
      <PageHeader kicker="Tài khoản" title="Đăng ký" toColor="var(--sea)" />
      <AuthCard>
        {/*  Câu CẤP DỮ LIỆU: nói thẳng ai cấp và gọi số nào. Không có câu an
             ủi kiểu "rất tiếc" — bà con cần biết bước kế tiếp, không cần lời
             xin lỗi. */}
        <AuthNote>
          Tài khoản SDFish do SDVICO cấp, không tự đăng ký được. Bà con gọi
          SDVICO {SDVICO_HOTLINE} để được mở tài khoản.
        </AuthNote>
        <div className="mt-4 flex flex-col items-center gap-2">
          <CallButton phone={SDVICO_HOTLINE} label="Gọi SDVICO" />
          {/*  Đã có tài khoản rồi thì đây là đường về — nút chính DUY NHẤT của
               màn nên được phép full-width (03-design-system §Nút hành động
               mục 0). */}
          <Link
            href="/login"
            className="display flex min-h-[3.5rem] w-full max-w-[17.5rem] items-center justify-center rounded-full bg-trim text-[1.125rem] font-bold text-white shadow-trim-cta transition active:scale-[0.98]"
          >
            Đã có tài khoản — Đăng nhập
          </Link>
        </div>
      </AuthCard>
    </div>
  );
}
