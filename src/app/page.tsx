import { ManHeader } from "@/components/man-header";
import { HeroAccount, KickedNotice } from "@/components/hero-account";
import { StormBanner } from "@/components/storm-banner";
import { HomeTheoVai } from "@/components/home-theo-vai";

/*
  TRANG CHỦ — "hôm nay có gì cần biết, cần làm" (làm lại 2026-10-19, dock 5 mục
  Trang chủ · Bản đồ · Tàu tôi · Chợ cá · Vật tư; rà design Codex).
  Thứ tự = thứ tự quan trọng:
    1. TIN BÃO THƯỜNG TRỰC — có bão / không có bão + giờ hỏi / không hỏi được +
       tuổi tin; luôn một dòng, không bao giờ im (chủ dự án chốt).
    2. Việc cần làm (giấy tờ sắp hết hạn, bảo dưỡng, nợ…) + nhắc cài về máy.
    3. Thông báo — đọc được ngay, tin mới đánh dấu.
    4. Con nước cảng nhà.
  2026-10-22 (rà Taste "màn trả lời câu hỏi của nó bằng khối to nhất"): ngay dưới tin
  bão là thẻ BIỂN HÔM NAY ở cảng nhà (mô tả, không phán đi/không) — câu bà con hỏi
  mỗi sáng; chữ trạng thái 1.5rem là chữ to nhất màn, ngang tiêu đề.
  BỎ bốn thẻ nhóm việc (Ra khơi/Tàu cá/Bạn thuyền/Giao dịch): chúng nhắc lại đúng
  dock bên dưới. BỎ bộ chọn tàu: chọn tàu chỉ ở Tàu tôi › Hồ sơ tàu. Sen Biển là
  icon nổi (app-shell) — không có khối riêng ở đây.
  Tone: công cụ làm việc tin cậy — chữ đời thường, không emoji, không trang trí.
*/
/*
  Rà design Codex lần 2 (2026-10-19): header chỉ còn tiêu đề + MỘT chip nhãn cố
  định; thẻ "tài khoản đang dùng ở máy khác" ra khỏi header, đứng ngay dưới tin
  bão, nguyên bề ngang (trước bị ép vào hàng tiêu đề, vỡ 13 dòng).
*/
export default function Home() {
  return (
    <div>
      <ManHeader title="Chào bà con" right={<HeroAccount light />} />
      <div className="space-y-5 px-4 pt-1">
        {/*  PHẦN DƯỚI THEO VAI (spec 17 §4.2, 2026-11-03): chủ tàu / chưa chọn vai giữ nguyên khối cũ (Biển hôm nay ·
            Việc cần làm · Nhắc hạn giấy · Ưu đãi · Thông báo · Con nước · Bật chuông); đi bạn / thu mua / đại lý có
            bản riêng — xem components/home-theo-vai.tsx. Tin bão + thẻ máy khác đi vào `dau`: đứng đầu MỌI vai. */}
        <HomeTheoVai
          dau={
            <>
              {/* GIỮ CHỖ tin bão (review B-P2-1): "Đang hỏi tin bão…" cao 1 hàng, rồi nở thành hàng "Không có
                  tin bão · Hỏi lúc" 2 dòng ⇒ đẩy cả màn. Khung lưới cao bằng trạng thái yên (4rem), con kéo giãn
                  lấp đủ. Băng vàng "không hỏi được" cũng đúng HAI dòng một hàng mỗi dòng (2026-10-29, storm-banner)
                  ⇒ lọt khung, hết nở 1,4rem. Chỉ thẻ CÓ BÃO được nở — tin tính mạng, không giữ chỗ nổi. */}
              <div className="grid min-h-[4rem]">
                <StormBanner variant="page" always />
              </div>
              <KickedNotice />
            </>
          }
        />
      </div>
    </div>
  );
}
