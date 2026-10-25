import { PageHeader } from "@/components/page-header";
import { SDVICO_HOTLINE, SDVICO_HOTLINE_DISPLAY } from "@/data/sdvico-showcase";

export const metadata = {
  title: "Chính sách quyền riêng tư — SDFish",
  description:
    "Chi tiết về việc ứng dụng SDFish (do SDVICO phát hành) thu thập, sử dụng và bảo mật thông tin của bà con.",
};

/*
  TRANG CHÍNH SÁCH QUYỀN RIÊNG TƯ — công khai, KHÔNG cần đăng nhập.

  Vì sao có trang này: App Store Guideline 5.1.1/5.1.2 (Data Use & Sharing)
  bắt buộc app có Privacy Policy TRUY CẬP ĐƯỢC, khai đúng dữ liệu thu thập +
  mục đích + không chia sẻ để tracking. Trước đây app KHÔNG có → reject.

  Nội dung PHẢI khớp thực tế (đối chiếu ops/native-deploy.md §5a + code):
   · Bài Tài trợ Kairos (2026-10-24, 14 §20) là nội dung SDVICO tự đăng — KHÔNG phải SDK/mạng quảng cáo.
   · Không SDK quảng cáo/analytics/attribution (AdMob/Firebase/FB/AppsFlyer/
     Adjust/Sentry/GA đều KHÔNG có) → không tracking theo định nghĩa Apple.
   · Sổ (hồ sơ tàu/giấy tờ/thuyền viên gồm CCCD/bảo dưỡng/vật tư) nằm localStorage
     forfish.* TRÊN MÁY VÀ ĐỒNG BỘ lên Supabase `user_docs` theo SĐT (2026-08-26,
     P2 — bảng RLS đóng hẳn, chỉ chủ SĐT đọc qua route service-role) để đổi/mất
     máy vẫn còn. Ngoài ra Supabase giữ tài khoản (SĐT/tên/uid).
   · Vị trí (getCurrentPosition ở route-planner + fishing-map-view) chỉ để canh
     bản đồ và hỏi gió sóng theo toạ độ — KHÔNG lưu DB, KHÔNG gắn tài khoản.
   · Nguồn thời tiết/hải văn ngoài nhận TOẠ ĐỘ TRẦN, không định danh.

  URL công khai để khai vào App Store Connect / Play Console:
   https://sdfish.sdvico.vn/quyen-rieng-tu   (khi domain đã trỏ Vercel + TLS)
   Tạm thời: https://forfish.vercel.app/quyen-rieng-tu

  Cập nhật nội dung ở ĐÂY thì đổi luôn "Cập nhật lần cuối" bên dưới.
*/

const UPDATED = "24/10/2026";

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
      <h2 className="display mb-2 text-[1.25rem] font-semibold text-navy">{title}</h2>
      <div className="space-y-2.5 text-[1rem] leading-relaxed text-foreground/85">
        {children}
      </div>
    </section>
  );
}

export default function QuyenRiengTuPage() {
  /*  ĐƯỜNG QUAY LẠI (2026-08-29, luật D2 — hành động phải có đường lùi). Đo
      thật: toàn trang 4441px và TOÀN BỘ link là 2 hotline + sdvico.vn + 5 mục
      dock — KHÔNG có đường về /login. Bà con đang gõ dở SĐT + mật khẩu, chạm
      link "Chính sách quyền riêng tư" ở màn đăng nhập là mất sạch cái đã gõ:
      `manifest.ts` đặt display:"standalone" nên bản cài về màn hình chính KHÔNG
      có nút back của trình duyệt, mà chính màn login lại đang đẩy bà con đi cài
      bản đó. Nội dung trang KHÔNG cắt — đây là văn bản pháp lý bắt buộc. */
  return (
    <div>
      <PageHeader
        kicker="Thông tin pháp lý"
        title="Chính sách quyền riêng tư"
        sub="Xem chi tiết về việc ứng dụng thu thập và sử dụng dữ liệu của bà con (không cần đăng nhập)."
        toColor="var(--sea)"
      />
      {/* link "‹ Quay lại" riêng ĐÃ BỎ — đầu trang (thanh sáng chung) có nút ‹ (rà bố cục 2026-10-22) */}


      <div className="px-4 pt-5">
        <p className="mb-5 rounded-2xl bg-field px-4 py-3 text-[1rem] leading-relaxed text-foreground/80">
          <b>SDFish</b> là ứng dụng đồng hành cùng ngư dân do <b>Công ty SDVICO</b> phát
          hành. Chính sách này giải thích bằng lời dễ hiểu: app giữ những gì, để
          làm gì, ai được thấy. <b>Cập nhật lần cuối: {UPDATED}.</b>
        </p>

        <Section id="tom-tat" title="Tóm tắt thông tin">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Sổ sách của bà con (hồ sơ tàu, giấy tờ, thuyền viên, bảo dưỡng,
              vật tư) lưu <b>được lưu trữ trên máy</b> và <b>đồng bộ lên máy chủ theo tài
              khoản</b> — chỉ bà con (đăng nhập đúng số điện thoại của mình) xem
              được, đổi/mất máy vẫn còn.
            </li>
            <li>
              Kairos có <b>bài Tài trợ</b> do SDVICO tự đăng (luôn ghi chữ <b>Tài trợ</b> và tên nhà tài trợ; có
              thể là đường dẫn tiếp thị liên kết, ví dụ Shopee). Bài Tài trợ <b>không nhắm theo người đọc</b>, không
              đếm lượt xem hay lượt bấm — ai cũng thấy như nhau. App <b>không theo dõi người dùng</b> bà con, không
              bán dữ liệu cho ai. Bấm vào bài Tài trợ thì trang đích (của nhà tài trợ) áp dụng chính sách của họ.
            </li>
            <li>
              Vị trí GPS chỉ dùng để <b>tự động căn chỉnh bản đồ và cung cấp thông tin gió sóng đúng khu vực</b> —
              không lưu lại, không gắn với tài khoản.
            </li>
            <li>Muốn xoá tài khoản: gọi SDVICO {SDVICO_HOTLINE_DISPLAY}.</li>
          </ul>
        </Section>

        <Section id="thu-thap" title="1. Ứng dụng thu thập thông tin gì?">
          <p>Ứng dụng chỉ thu thập các thông tin cần thiết để phục vụ bà con:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <b>Số điện thoại liên hệ</b> — là tên đăng nhập của bà con. Bắt buộc để có
              tài khoản riêng, người khác cầm máy không xem được sổ.
            </li>
            <li>
              <b>Họ và tên</b> — nếu bà con là khách đã mua hàng SDVICO, tên được
              đồng bộ từ hệ thống chăm sóc khách hàng của SDVICO để hiển thị trên
              thẻ tài khoản.
            </li>
            <li>
              <b>Thông tin định danh tài khoản</b> — một dãy ký tự do hệ thống đăng nhập tạo ra để
              phân biệt tài khoản này với tài khoản khác.
            </li>
            <li>
              <b>Thông tin do bà con tự cung cấp</b> — hồ sơ tàu, giấy tờ (số giấy, hạn,
              và <b>hình ảnh giấy tờ</b> nếu bà con tự thêm), thuyền viên (gồm{" "}
              <b>thông tin CCCD</b>), lịch nhắc bảo dưỡng, dữ liệu vật tư. Những thông tin này <b>lưu trong
              máy</b> và <b>được đồng bộ và bảo mật trên máy chủ gắn liền với tài khoản của bà con</b> để đổi/mất
              máy vẫn còn — chỉ bà con (đăng nhập đúng số điện thoại) xem được,
              không chia cho ai khác.
            </li>
            <li>
              <b>Vị trí định vị GPS</b> — chỉ khi bà con mở tính năng bản đồ hoặc dẫn
              đường và <b>chọn đồng ý cung cấp</b> cho phép. Dùng ngay lúc đó để canh bản đồ
              về chỗ mình đứng và hỏi gió sóng theo toạ độ. <b>Không lưu lại,
              không gắn với tài khoản.</b>
            </li>
            <li>
              <b>Bài đã xem trên Kairos</b> — khi bà con đã đăng nhập: bài nào hiện trên màn, bài nào bà con
              mở đọc và đọc bao lâu. Chỉ dùng để <b>xếp dòng tin Kairos cho chính bà con</b> (đưa tin hợp với
              mình lên trước), giữ <b>90 ngày</b> rồi tự xoá, không chia cho ai khác. Khách chưa đăng nhập: không lưu.
            </li>
          </ul>
          <p>
            App <b>cam kết không</b> đọc kho ảnh, danh bạ, tin nhắn hay lịch sử duyệt web
            của bà con, và <b>tuyệt đối không</b> có mã quảng cáo (IDFA/AAID). Ảnh duy nhất
            app giữ là <b>hình ảnh giấy tờ do bà con chủ động tải lên</b> thêm vào tủ giấy tờ (nêu
            ở trên).
          </p>
        </Section>

        <Section id="muc-dich" title="2. Dữ liệu được sử dụng vào mục đích gì?">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Giúp bà con đăng nhập và lưu giữ thông tin hồ sơ của riêng mình.</li>
            <li>Hỗ trợ tự động hiển thị bản đồ biển, dự báo thời tiết tại đúng khu vực tàu đang hoạt động.</li>
            <li>Tính năng nhắc nhở khi đến hạn giấy tờ, bảo hiểm, bảo dưỡng định kỳ.</li>
            <li>Hỗ trợ kết nối bà con với đội ngũ chăm sóc khách hàng của SDVICO khi có yêu cầu.</li>
            <li>Xếp dòng tin Kairos theo bài bà con hay đọc và theo cảng nhà.</li>
          </ul>
          <p>
            <b>Không sử dụng</b> dùng dữ liệu cho quảng cáo, không xây hồ sơ theo dõi hành
            vi, không dùng cho mục đích ngoài những điều nêu trên.
          </p>
        </Section>

        <Section id="chia-se" title="3. Dữ liệu được chia sẻ với những đơn vị nào?">
          <p>Ứng dụng SDFish tuyệt đối không bán hoặc cho thuê dữ liệu của bà con. Dữ liệu chỉ được kết nối với các đối tác kỹ thuật nhằm đảm bảo ứng dụng hoạt động:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <b>Nền tảng xác thực đăng nhập &amp; lưu trữ (Supabase)</b> — giữ số điện
              thoại, họ tên, mã tài khoản để bà con đăng nhập được. Bảo vệ bằng
              luật truy cập: mỗi người chỉ đọc được dữ liệu của chính mình.
            </li>
            <li>
              <b>Hệ thống chăm sóc khách hàng nội bộ của SDVICO (SDWork)</b> — đồng bộ
              tài khoản và dịch vụ cho khách đã mua hàng. Đây là hệ thống nội bộ
              của chính SDVICO.
            </li>
            <li>
              <b>Hệ thống cung cấp dữ liệu thời tiết &amp; hải văn (dữ liệu công cộng)</b> (ví dụ
              Open-Meteo, NOAA, Copernicus) — app gửi cho họ <b>toạ độ lấy mẫu (không chứa định danh)</b> để
              lấy gió sóng, <b>đảm bảo không đi kèm</b> tên, số điện thoại hay bất cứ thông
              tin nhận dạng nào.
            </li>
          </ul>
          <p>
            <b>Không có sự can thiệp của các bên cung cấp quảng cáo hoặc công ty phân tích hành vi</b> (không
            Google Analytics, Firebase, Facebook, AdMob, AppsFlyer, Adjust,
            Sentry…). App <b>không theo dõi người dùng</b> bà con qua các app/website khác.
          </p>
        </Section>

        <Section id="luu-tru" title="4. Chính sách lưu trữ và yêu cầu xoá dữ liệu">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Sổ trong máy: còn khi bà con còn giữ. <b>Ứng dụng sẽ tự động dọn dẹp khi bà con đăng xuất</b>{" "}
              dữ liệu riêng khỏi máy đó, người sau cầm máy không thấy.
            </li>
            <li>
              Tài khoản (số điện thoại, tên): giữ khi tài khoản còn hoạt động.
            </li>
            {/*  KHAI THẲNG VIỆC GIỮ BẢN ĐÃ XOÁ (chủ dự án chốt 2026-09-01, kèm
                 quyết định "khai rõ trong /quyen-rieng-tu"). Đây là thứ luật và
                 kho ứng dụng bắt buộc nói ra: dữ liệu người dùng tưởng đã bỏ mà
                 công ty vẫn giữ thì phải cho họ biết, và cho đường xoá hẳn.
                 Nói bằng lời thường, không dùng chữ "tombstone"/"soft delete". */}
            <li>
              <b>Đối với các dữ liệu bà con đã xóa trên máy, hệ thống máy chủ sẽ vẫn lưu một bản sao lưu.</b> Khi bà con
              xoá một việc bảo dưỡng, một tờ giấy, hay một người trong sổ thuyền
              viên, máy chủ giữ lại bản trước đó để SDVICO xem cách bà con dùng
              app mà cải thiện. Bản này <b>ngừng hiển thị</b> trên máy bà con, và{" "}
              <b>cam kết không chia sẻ cho bên thứ ba</b> (mục 3). Muốn xoá hẳn cả những bản
              này thì gọi SDVICO ở dưới.
            </li>
            <li>
              <b>Hỗ trợ xoá vĩnh viễn tài khoản và dữ liệu hệ thống nếu bà con có yêu cầu</b>: gọi SDVICO{" "}
              <a href={`tel:${SDVICO_HOTLINE}`} className="inline-flex min-h-[3.5rem] items-center font-semibold text-sea underline">
                {SDVICO_HOTLINE_DISPLAY}
              </a>{" "}
              — sẽ xoá trong thời gian hợp lý.
            </li>
          </ul>
        </Section>

        <Section id="quyen" title="5. Quyền lợi của bà con">
          <p>
            Bà con có quyền xem, sửa, hoặc yêu cầu xoá dữ liệu của mình. Sửa trực
            tiếp trong app; xoá tài khoản thì gọi SDVICO. App dành cho người trưởng
            thành làm nghề biển, <b>sản phẩm không định hướng tới trẻ em</b>.
          </p>
        </Section>

        <Section id="lien-he" title="6. Thông tin liên hệ">
          <p>
            Thắc mắc về quyền riêng tư, gọi tổng đài SDVICO{" "}
            <a href={`tel:${SDVICO_HOTLINE}`} className="inline-flex min-h-[3.5rem] items-center font-semibold text-sea underline">
              {SDVICO_HOTLINE_DISPLAY}
            </a>
            , hoặc qua website{" "}
            <a href="https://sdvico.vn" className="inline-flex min-h-[3.5rem] items-center font-semibold text-sea underline">
              sdvico.vn
            </a>
            .
          </p>
        </Section>

        {/* GEMMA (ADR 0012): Gemma Terms §3.1 buộc kèm NOTICE + bản điều khoản + hạn chế sử dụng có hiệu lực
            khi phân phối bản sửa (Model Derivative) — bản Android có gói mô hình Sen Biển. */}
        <Section id="sen-bien-gemma" title="7. Trợ lý Sen Biển và mô hình Gemma">
          <p>
            Trợ lý giọng nói Sen Biển nghe và hiểu câu nói <b>ngay trên điện thoại</b> — không gửi tiếng nói
            hay câu chữ lên máy chủ để hiểu ý. Bản Android có thêm một mô hình ngôn ngữ nhỏ tải một lần
            qua Google Play (khoảng 62 MB) để hiểu tham số câu nói tốt hơn.
          </p>
          <p>
            Mô hình đó là bản SDVICO đã chỉnh sửa (huấn luyện thêm, thu gọn) từ Gemma của Google.{" "}
            <b>Gemma is provided under and subject to the Gemma Terms of Use found at{" "}
            <a href="https://ai.google.dev/gemma/terms" className="inline-flex min-h-[3.5rem] items-center font-semibold text-sea underline">
              ai.google.dev/gemma/terms
            </a>
            .</b>
          </p>
          <p>
            Khi dùng tính năng này, bà con đồng ý không dùng nó vào các việc bị cấm theo{" "}
            <a href="https://ai.google.dev/gemma/prohibited_use_policy" className="inline-flex min-h-[3.5rem] items-center font-semibold text-sea underline">
              Chính sách sử dụng bị cấm của Gemma
            </a>{" "}
            (Gemma Terms of Use, mục 3.2). Câu trả lời của Sen Biển chỉ để tham khảo, đọc từ dữ liệu bản đồ
            trong máy — không thay cho việc tự quan sát, dò đáy và nghe tin bão chính thức.
          </p>
        </Section>

        <Section id="en-summary" title="Privacy Policy (English summary)">
          <p className="text-[1rem] text-foreground/75">
            SDFish is a companion app for Vietnamese fishermen, published by
            SDVICO. We collect only what the app needs to function: phone number
            (login), name and account ID (from SDVICO&apos;s own CRM), and
            content you enter (boat records, documents, crew, maintenance) which is
            stored <b>on your device</b>. Precise location is used only, with your
            permission, to center the map and fetch marine weather for that spot —
            it is <b>not stored and not linked to your account</b>. We do{" "}
            <b>not</b> track you or sell data. Kairos shows clearly labelled <b>Sponsored</b> posts placed by SDVICO
            itself (may include affiliate links, e.g. Shopee) — not targeted, no view or click counting. No
            advertising or analytics SDKs are present. Data is shared only with Supabase (auth
            &amp; hosting), SDVICO&apos;s internal CRM, and public weather/marine
            APIs which receive <b>coordinates only</b>. To delete your account,
            call SDVICO {SDVICO_HOTLINE_DISPLAY}. Last updated: {UPDATED}.
          </p>
        </Section>

        <p className="pb-4 text-[0.9375rem] text-foreground/55">
          SDFish do SDVICO phát hành. Mọi số liệu giá cả, dự báo biển, mức phạt
          trong app đều là tham khảo. Bản quyền © 2026 Công ty SDVICO — phần
          mềm, giao diện và bộ dữ liệu bản đồ đã biên tập là tài sản độc quyền,
          không được sao chép hay dùng lại cho sản phẩm khác.
        </p>
      </div>
    </div>
  );
}
