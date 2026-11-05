import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { SDVICO_HOTLINE, SDVICO_HOTLINE_DISPLAY } from "@/data/sdvico-showcase";
import { DIEU_KHOAN_BAN } from "@/lib/dieu-khoan";

export const metadata = {
  title: "Điều khoản sử dụng — SDFish",
  description: "Điều khoản sử dụng ứng dụng SDFish do Công ty SDVICO phát hành.",
};

/*
  ĐIỀU KHOẢN SỬ DỤNG — công khai, không cần đăng nhập (2026-11-05). Bà con đồng ý bằng MỘT cú bấm (tờ Đồng ý /
  ô tick ở /dang-ky — components/dong-y-dieu-khoan). Phần dữ liệu cá nhân nằm ở /quyen-rieng-tu, ở đây chỉ dẫn sang.

  Đổi nội dung theo hướng THÊM nghĩa vụ / THÊM mục đích ⇒ tăng DIEU_KHOAN_BAN (lib/dieu-khoan.ts) để hỏi lại mọi người.
  Lời đời thường, không văn phong hợp đồng — người đọc là ngư dân (CLAUDE.md "tiếng Việt đời thường").
*/

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-6">
      <h2 className="display mb-2 text-[1.25rem] font-semibold text-navy">{title}</h2>
      <div className="space-y-2.5 text-[1rem] leading-relaxed text-foreground/85">{children}</div>
    </section>
  );
}

function ngay(ban: string): string {
  const [y, m, d] = ban.split("-");
  return `${d}/${m}/${y}`;
}

export default function DieuKhoanPage() {
  return (
    <div>
      <PageHeader
        kicker="Thông tin pháp lý"
        title="Điều khoản sử dụng"
        sub="Những điều bà con và SDVICO cùng giữ khi dùng app (không cần đăng nhập để xem)."
        toColor="var(--sea)"
      />
      <div className="px-4 pt-5">
        <p className="mb-5 rounded-2xl bg-field px-4 py-3 text-[1rem] leading-relaxed text-foreground/80">
          <b>SDFish</b> do <b>Công ty SDVICO</b> phát hành. Bà con tạo tài khoản hoặc bấm <b>Đồng ý</b> trong app là đồng
          ý với điều khoản này và{" "}
          <Link href="/quyen-rieng-tu" className="font-semibold text-sea underline">
            Chính sách quyền riêng tư
          </Link>
          . <b>Bản ngày {ngay(DIEU_KHOAN_BAN)}.</b>
        </p>

        <Section id="tai-khoan" title="1. Tài khoản">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Mỗi số điện thoại một tài khoản. Bà con giữ mật khẩu, không đưa người khác.</li>
            <li>Một tài khoản dùng trên một máy: đăng nhập máy mới thì máy cũ tự đăng xuất.</li>
            <li>Thông tin bà con nhập (tàu, giấy tờ, thuyền viên) phải là thông tin thật của mình.</li>
          </ul>
        </Section>

        <Section id="thong-tin-nguoi-khac" title="2. Thông tin của người khác">
          <p>
            Khi ghi sổ thuyền viên (họ tên, số CCCD, ảnh giấy tờ), bà con là người đưa thông tin của người khác vào app.
            Bà con cần <b>báo cho thuyền viên biết và được họ đồng ý</b>. Thuyền viên muốn xoá thông tin của mình thì bà
            con xoá trong sổ, hoặc gọi SDVICO.
          </p>
        </Section>

        <Section id="tham-khao" title="3. Số liệu chỉ để tham khảo">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Thời tiết, sóng gió, tin bão, dự báo cá, giá cả, hải đồ, dẫn đường trong app <b>chỉ để tham khảo</b>. Không
              thay tin bão chính thức, hải đồ chính thức, Thông báo hàng hải và việc tự quan sát khi đi biển.
            </li>
            <li>Bà con tự quyết định ra khơi, chọn ngư trường, mua bán. SDVICO không chịu thiệt hại do dựa vào số liệu tham khảo.</li>
            <li>Mất sóng thì app dùng bản đã lưu trong máy — số liệu có thể cũ.</li>
          </ul>
        </Section>

        <Section id="khong-duoc" title="4. Không được làm">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Đăng tin sai, lừa đảo, xúc phạm người khác, hoặc nội dung trái pháp luật trên Kairos và Chợ.</li>
            <li>Sao chép, tải hàng loạt, bán lại dữ liệu bản đồ và số liệu của app.</li>
            <li>Phá, dò lỗi, vượt khoá để dùng tính năng gói khi chưa mua.</li>
          </ul>
          <p>Vi phạm thì SDVICO có thể gỡ bài, khoá tài khoản.</p>
        </Section>

        <Section id="mua-ban" title="5. Mua bán trên Chợ">
          <p>
            Tin mua bán, đơn hàng giữa bà con với người bán là thoả thuận của hai bên. SDVICO giúp kết nối; với hàng do
            chính SDVICO bán thì SDVICO chịu trách nhiệm như người bán.
          </p>
        </Section>

        <Section id="goi" title="6. Gói dịch vụ">
          <p>
            Một số tính năng (dự báo cá, lớp bản đồ có nguồn trả phí, dẫn đường) chỉ dành cho tài khoản có gói. Giá và hạn
            gói theo thoả thuận khi mua với SDVICO.
          </p>
        </Section>

        <Section id="sua-doi" title="7. Thay đổi điều khoản">
          <p>
            SDVICO có thể sửa điều khoản này. Khi thay đổi điều quan trọng (thêm loại dữ liệu, thêm mục đích dùng), app sẽ
            hỏi bà con đồng ý lại trước khi dùng tiếp.
          </p>
        </Section>

        <Section id="lien-he" title="8. Liên hệ">
          <p>
            Hỏi đáp, khiếu nại, xoá tài khoản: gọi SDVICO{" "}
            <a href={`tel:${SDVICO_HOTLINE}`} className="inline-flex min-h-[3.5rem] items-center font-semibold text-sea underline">
              {SDVICO_HOTLINE_DISPLAY}
            </a>
            . Tranh chấp giải quyết theo pháp luật Việt Nam.
          </p>
        </Section>
      </div>
    </div>
  );
}
