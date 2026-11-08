import Link from "next/link";
import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "Nguồn dữ liệu — SDFish",
  description: "Ghi công các nguồn dữ liệu công khai mà SDFish dùng để dựng bản đồ, thời tiết biển và bảng giá tham khảo.",
};

/*
  TRANG NGUỒN DỮ LIỆU — MỘT CHỖ GHI CÔNG (2026-11-08, docs/app-map/ops/khong-lo-nguon.md nợ #15).

  Luật: tên nguồn KHÔNG nằm rải trong code chạy trên máy (chuỗi sống qua minify — cổng scripts/kiem-lo-bundle.mjs).
  Giấy phép ODbL / CC-BY / điều khoản dịch vụ lại BẮT ghi công ⇒ gom về đây (trang máy chủ dựng, không vào bundle JS),
  chú thích bản đồ chỉ còn © OpenStreetMap + OpenSeaMap (ODbL đòi ở cạnh bản đồ) + đường dẫn về trang này.

  ⚠️ CHỜ LUẬT SƯ: câu chữ ghi công từng nguồn (đủ chưa, có phải ghi ngay trên bản đồ không — nhất là Protomaps, EMODnet,
  Copernicus Marine, Allen Coral Atlas, Open-Meteo, điều khoản Gemma) CHƯA được luật sư duyệt. Không tự đổi dạng câu;
  luật sư chốt thì sửa ở đây và ở `ATTRIBUTION_BAN_DO` (lib/ocean-map.ts) cùng commit.
*/

const UPDATED = "08/11/2026";

type Nguon = { ten: string; dung: string; giayPhep: string };

const BAN_DO: Nguon[] = [
  { ten: "© OpenStreetMap contributors", dung: "nền bản đồ, đường bờ, tuyến hàng hải", giayPhep: "ODbL 1.0" },
  { ten: "OpenSeaMap", dung: "phao, đèn biển (lớp hải đồ)", giayPhep: "ODbL 1.0" },
  { ten: "Protomaps", dung: "đóng gói ô nền bản đồ từ OpenStreetMap", giayPhep: "dữ liệu ODbL (OpenStreetMap)" },
  { ten: "NASA GIBS", dung: "ảnh vệ tinh nhiệt độ nước, phù du", giayPhep: "dữ liệu công khai của NASA" },
  { ten: "NOAA NCEI ETOPO 2022 · GEBCO · EMODnet Bathymetry", dung: "độ sâu tham khảo, đường đẳng sâu", giayPhep: "công khai / CC BY 4.0" },
  { ten: "Allen Coral Atlas · UNEP-WCMC (WCMC-008)", dung: "hình rạn san hô, chất đáy", giayPhep: "CC BY 4.0" },
];

const BIEN: Nguon[] = [
  { ten: "Open-Meteo", dung: "gió, sóng, mưa, dông, mây theo giờ", giayPhep: "CC BY 4.0" },
  { ten: "Copernicus Marine Service", dung: "dòng chảy, độ mặn, nhiệt độ tầng nước", giayPhep: "giấy phép Copernicus Marine" },
  { ten: "NOAA CoastWatch / ERDDAP", dung: "nhiệt độ mặt nước, phù du, mực nước biển", giayPhep: "dữ liệu công khai của NOAA" },
  { ten: "EOT20 (DGFI-TUM) · UHSLC", dung: "hằng số thuỷ triều các trạm", giayPhep: "CC BY 4.0 / dữ liệu nghiên cứu công khai" },
  { ten: "GDACS", dung: "tin bão quốc tế (bổ sung tin trong nước)", giayPhep: "dữ liệu công khai" },
];

const VIET_NAM: Nguon[] = [
  { ten: "Trung tâm Dự báo khí tượng thuỷ văn quốc gia", dung: "tin bão, áp thấp nhiệt đới", giayPhep: "thông tin nhà nước công bố" },
  { ten: "Cục Hàng hải Việt Nam · Tổng công ty Bảo đảm an toàn hàng hải · các Cảng vụ hàng hải", dung: "báo hiệu, luồng, Thông báo hàng hải, xác tàu", giayPhep: "thông tin nhà nước công bố" },
  { ten: "Bộ Nông nghiệp và Môi trường", dung: "khu neo đậu tránh trú bão, khu bảo tồn biển, địa danh biển đảo", giayPhep: "thông tin nhà nước công bố" },
  { ten: "Hiệp hội Chế biến và Xuất khẩu thuỷ sản Việt Nam (VASEP)", dung: "giá nguyên liệu tại bến theo tuần (tham khảo)", giayPhep: "số liệu công bố công khai" },
];

const KHAC: Nguon[] = [
  { ten: "Gemma (Google)", dung: "mô hình ngôn ngữ của Sen Biển trên máy", giayPhep: "Điều khoản sử dụng Gemma" },
];

function Bang({ title, rows }: { title: string; rows: Nguon[] }) {
  return (
    <section className="mb-6">
      <h2 className="display mb-2 text-[1.25rem] font-semibold text-navy">{title}</h2>
      <ul className="surface divide-y divide-line">
        {rows.map((r) => (
          <li key={r.ten} className="px-4 py-3 text-[1rem] leading-snug">
            <p className="font-semibold text-foreground">{r.ten}</p>
            <p className="text-[0.875rem] text-foreground/70">
              {r.dung} · {r.giayPhep}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function NguonDuLieuPage() {
  return (
    <div>
      <PageHeader
        kicker="Thông tin pháp lý"
        title="Nguồn dữ liệu"
        sub="SDFish dựng bản đồ và thời tiết biển từ các nguồn công khai dưới đây (không cần đăng nhập)."
        toColor="var(--sea)"
      />
      <div className="px-4 pt-5">
        <p className="mb-5 rounded-2xl bg-field px-4 py-3 text-[1rem] leading-relaxed text-foreground/80">
          Mọi số trong app là <b>tham khảo</b>. Số độ sâu không thay hải đồ chính thức và Thông báo hàng hải. Máy của bà
          con chỉ hỏi máy chủ SDFish; máy chủ hỏi các nguồn bên dưới, không kèm thông tin nhận dạng của bà con.{" "}
          <b>Cập nhật lần cuối: {UPDATED}.</b>
        </p>
        <Bang title="Bản đồ" rows={BAN_DO} />
        <Bang title="Thời tiết, hải văn" rows={BIEN} />
        <Bang title="Cơ quan Việt Nam" rows={VIET_NAM} />
        <Bang title="Khác" rows={KHAC} />
        <p className="pb-6 text-[0.9375rem] text-muted">
          Xem thêm <Link href="/quyen-rieng-tu" className="font-semibold text-navy underline">Chính sách quyền riêng tư</Link>.
          Bộ dữ liệu bản đồ đã biên tập là tài sản của SDVICO; phần lấy từ OpenStreetMap được cung cấp lại theo ODbL khi có yêu
          cầu.
        </p>
      </div>
    </div>
  );
}
