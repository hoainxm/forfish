import { PageHeader } from "@/components/page-header";
import { SDVICO_HOTLINE, SDVICO_HOTLINE_DISPLAY } from "@/data/sdvico-showcase";

export const metadata = {
  title: "Chính sách quyền riêng tư — SDFish",
  description:
    "SDFish thu thập dữ liệu gì, dùng để làm gì, có chia sẻ với ai không. Chính sách quyền riêng tư của app đồng hành ngư dân do SDVICO phát hành.",
};

/*
  TRANG CHÍNH SÁCH QUYỀN RIÊNG TƯ — công khai, KHÔNG cần đăng nhập.

  Vì sao có trang này: App Store Guideline 5.1.1/5.1.2 (Data Use & Sharing)
  bắt buộc app có Privacy Policy TRUY CẬP ĐƯỢC, khai đúng dữ liệu thu thập +
  mục đích + không chia sẻ để tracking. Trước đây app KHÔNG có → reject.

  Nội dung PHẢI khớp thực tế (đối chiếu ops/native-deploy.md §5a + code):
   · Không SDK quảng cáo/analytics/attribution (AdMob/Firebase/FB/AppsFlyer/
     Adjust/Sentry/GA đều KHÔNG có) → không tracking theo định nghĩa Apple.
   · Sổ (chuyến/giấy tờ/thuyền viên) phần lớn nằm localStorage forfish.* TRÊN
     MÁY; Supabase chỉ giữ tài khoản (SĐT/tên/uid).
   · Vị trí (getCurrentPosition ở route-planner + fishing-map-view) chỉ để canh
     bản đồ và hỏi gió sóng theo toạ độ — KHÔNG lưu DB, KHÔNG gắn tài khoản.
   · Nguồn thời tiết/hải văn ngoài nhận TOẠ ĐỘ TRẦN, không định danh.

  URL công khai để khai vào App Store Connect / Play Console:
   https://sdfish.sdvico.vn/quyen-rieng-tu   (khi domain đã trỏ Vercel + TLS)
   Tạm thời: https://forfish.vercel.app/quyen-rieng-tu

  Cập nhật nội dung ở ĐÂY thì đổi luôn "Cập nhật lần cuối" bên dưới.
*/

const UPDATED = "27/07/2026";

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-6">
      <h2 className="display mb-2 text-[1.25rem] font-bold text-navy">{title}</h2>
      <div className="space-y-2.5 text-[1.0625rem] leading-relaxed text-foreground/85">
        {children}
      </div>
    </section>
  );
}

export default function QuyenRiengTuPage() {
  return (
    <div>
      <PageHeader
        kicker="Pháp lý"
        title="Chính sách quyền riêng tư"
        sub="SDFish thu thập dữ liệu gì, dùng để làm gì, và không chia sẻ với ai. Đọc không cần đăng nhập."
        toColor="var(--sea)"
      />

      <div className="px-5 pt-5">
        <p className="mb-5 rounded-2xl bg-field px-4 py-3 text-[1rem] leading-relaxed text-foreground/80">
          <b>SDFish</b> là app đồng hành của ngư dân do <b>Công ty SDVICO</b> phát
          hành. Chính sách này giải thích bằng lời dễ hiểu: app giữ những gì, để
          làm gì, ai được thấy. <b>Cập nhật lần cuối: {UPDATED}.</b>
        </p>

        <Section id="tom-tat" title="Tóm tắt nhanh">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Phần lớn sổ sách của bà con (chuyến biển, giấy tờ, thuyền viên,
              công nợ) nằm <b>ngay trong máy điện thoại</b>, không đẩy lên mạng.
            </li>
            <li>
              App <b>không có quảng cáo</b>, <b>không theo dõi</b> bà con, không
              bán dữ liệu cho ai.
            </li>
            <li>
              Vị trí GPS chỉ dùng để <b>canh bản đồ và xem gió sóng đúng chỗ</b> —
              không lưu lại, không gắn với tài khoản.
            </li>
            <li>Muốn xoá tài khoản: gọi SDVICO {SDVICO_HOTLINE_DISPLAY}.</li>
          </ul>
        </Section>

        <Section id="thu-thap" title="1. App thu thập dữ liệu gì">
          <p>Chỉ những thứ cần để app chạy đúng chức năng:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <b>Số điện thoại</b> — là tên đăng nhập của bà con. Bắt buộc để có
              tài khoản riêng, người khác cầm máy không xem được sổ.
            </li>
            <li>
              <b>Họ tên</b> — nếu bà con là khách đã mua hàng SDVICO, tên được
              đồng bộ từ hệ thống chăm sóc khách hàng của SDVICO để hiển thị trên
              thẻ tài khoản.
            </li>
            <li>
              <b>Mã tài khoản</b> — một dãy ký tự do hệ thống đăng nhập tạo ra để
              phân biệt tài khoản này với tài khoản khác.
            </li>
            <li>
              <b>Nội dung bà con tự nhập</b> — hồ sơ tàu, giấy tờ, thuyền viên,
              sổ lãi lỗ, công nợ. Những thứ này <b>lưu trong máy</b> (bộ nhớ
              trình duyệt/ứng dụng), không tự động gửi lên máy chủ.
            </li>
            <li>
              <b>Vị trí GPS</b> — chỉ khi bà con mở tính năng bản đồ hoặc dẫn
              đường và <b>bấm đồng ý</b> cho phép. Dùng ngay lúc đó để canh bản đồ
              về chỗ mình đứng và hỏi gió sóng theo toạ độ. <b>Không lưu lại,
              không gắn với tài khoản.</b>
            </li>
          </ul>
          <p>
            App <b>không</b> thu thập: danh bạ, ảnh, tin nhắn, lịch sử duyệt web,
            hay mã quảng cáo (IDFA/AAID).
          </p>
        </Section>

        <Section id="muc-dich" title="2. Dùng dữ liệu để làm gì">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Cho bà con đăng nhập và giữ sổ riêng của mình.</li>
            <li>Hiển thị bản đồ biển, gió sóng, dự báo theo đúng vùng bà con quan tâm.</li>
            <li>Nhắc hạn giấy tờ, bảo hiểm, bảo dưỡng.</li>
            <li>Kết nối bà con với dịch vụ hỗ trợ của SDVICO khi cần.</li>
          </ul>
          <p>
            <b>Không</b> dùng dữ liệu cho quảng cáo, không xây hồ sơ theo dõi hành
            vi, không dùng cho mục đích ngoài những điều nêu trên.
          </p>
        </Section>

        <Section id="chia-se" title="3. Chia sẻ với ai">
          <p>SDFish không bán, không cho thuê dữ liệu. Chỉ có vài bên kỹ thuật cần thiết:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <b>Nền tảng đăng nhập &amp; máy chủ (Supabase)</b> — giữ số điện
              thoại, họ tên, mã tài khoản để bà con đăng nhập được. Bảo vệ bằng
              luật truy cập: mỗi người chỉ đọc được dữ liệu của chính mình.
            </li>
            <li>
              <b>Hệ thống chăm sóc khách hàng của SDVICO (SDWork)</b> — đồng bộ
              tài khoản và dịch vụ cho khách đã mua hàng. Đây là hệ thống nội bộ
              của chính SDVICO.
            </li>
            <li>
              <b>Nguồn dữ liệu thời tiết &amp; hải văn công cộng</b> (ví dụ
              Open-Meteo, NOAA, Copernicus) — app gửi cho họ <b>toạ độ trần</b> để
              lấy gió sóng, <b>không kèm</b> tên, số điện thoại hay bất cứ thông
              tin nhận dạng nào.
            </li>
          </ul>
          <p>
            <b>Không có bên quảng cáo, không có bên phân tích hành vi</b> (không
            Google Analytics, Firebase, Facebook, AdMob, AppsFlyer, Adjust,
            Sentry…). App <b>không theo dõi</b> bà con qua các app/website khác.
          </p>
        </Section>

        <Section id="luu-tru" title="4. Giữ bao lâu, xoá thế nào">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Sổ trong máy: còn khi bà con còn giữ. <b>Đăng xuất là app tự dọn</b>{" "}
              dữ liệu riêng khỏi máy đó, người sau cầm máy không thấy.
            </li>
            <li>
              Tài khoản (số điện thoại, tên): giữ khi tài khoản còn hoạt động.
            </li>
            <li>
              <b>Muốn xoá hẳn tài khoản và dữ liệu trên máy chủ</b>: gọi SDVICO{" "}
              <a href={`tel:${SDVICO_HOTLINE}`} className="font-bold text-sea underline">
                {SDVICO_HOTLINE_DISPLAY}
              </a>{" "}
              — sẽ xoá trong thời gian hợp lý.
            </li>
          </ul>
        </Section>

        <Section id="quyen" title="5. Quyền của bà con">
          <p>
            Bà con có quyền xem, sửa, hoặc yêu cầu xoá dữ liệu của mình. Sửa trực
            tiếp trong app; xoá tài khoản thì gọi SDVICO. App dành cho người trưởng
            thành làm nghề biển, <b>không hướng tới trẻ em</b>.
          </p>
        </Section>

        <Section id="lien-he" title="6. Liên hệ">
          <p>
            Thắc mắc về quyền riêng tư, gọi tổng đài SDVICO{" "}
            <a href={`tel:${SDVICO_HOTLINE}`} className="font-bold text-sea underline">
              {SDVICO_HOTLINE_DISPLAY}
            </a>
            , hoặc qua website{" "}
            <a href="https://sdvico.vn" className="font-bold text-sea underline">
              sdvico.vn
            </a>
            .
          </p>
        </Section>

        <Section id="en-summary" title="Privacy Policy (English summary)">
          <p className="text-[1rem] text-foreground/75">
            SDFish is a companion app for Vietnamese fishermen, published by
            SDVICO. We collect only what the app needs to function: phone number
            (login), name and account ID (from SDVICO&apos;s own CRM), and
            content you enter (boat records, documents, crew, ledgers) which is
            stored <b>on your device</b>. Precise location is used only, with your
            permission, to center the map and fetch marine weather for that spot —
            it is <b>not stored and not linked to your account</b>. We do{" "}
            <b>not</b> track you, show ads, or sell data. No advertising or
            analytics SDKs are present. Data is shared only with Supabase (auth
            &amp; hosting), SDVICO&apos;s internal CRM, and public weather/marine
            APIs which receive <b>coordinates only</b>. To delete your account,
            call SDVICO {SDVICO_HOTLINE_DISPLAY}. Last updated: {UPDATED}.
          </p>
        </Section>

        <p className="pb-4 text-[0.9375rem] text-foreground/55">
          SDFish do SDVICO phát hành. Mọi số liệu giá cả, dự báo biển, mức phạt
          trong app đều là tham khảo.
        </p>
      </div>
    </div>
  );
}
