// NHỊP QUÉT NGUỒN TIN BÃO — quét theo MỨC ƯU TIÊN, không quét đều đều mãi.
//
// ═══ VÌ SAO (chủ dự án, 2026-08-18) ═══
//
//   *"quét theo mức độ ưu tiên, chứ không phải cứ quét 30 phút 1 lần mãi;
//   thường 1 ngày 1 lần định kỳ là ok, rồi khi có bão thì theo dõi diễn biến
//   mới tăng tần suất lên 1h/lần … tránh quét liên tục rồi bị treo lỗi và làm
//   tốn tài nguyên."*
//
// Bản đầu quét NCHMF 30 phút/lần bất kể trời yên hay bão: 48 lượt/ngày × 2 lượt
// tải HTML = 96 request/ngày vào một trang của cơ quan nhà nước, để phần lớn
// thời gian nhận về đúng cái bản tin đã có. Vừa phí, vừa là bề mặt hỏng thừa.
//
// ═══ NHỊP LẤY TỪ CHÍNH NGUỒN, KHÔNG CHÉP CỨNG ═══
//
// Mỗi bản tin NCHMF tự ghi *"Bản tin tiếp theo: 14h00 ngày 18/8"*. Đó là nhịp
// THẬT do cơ quan phát tin công bố, và nó tự đổi khi họ leo thang (QĐ 18/2021:
// 6 giờ/lần khi bão còn ngoài Biển Đông → 3 giờ/lần khi gần bờ → 1 giờ/lần khi
// khẩn cấp). Chép cứng bảng tần suất vào code thì sai đúng lúc nguy hiểm nhất;
// đọc con số nguồn tự ghi thì mọi nấc đều tự khớp. Xem `parseGioBanTinTiepTheo`.
//
// ═══ BA MỨC, PHÂN THEO PHẠM VI ═══
//
//   · `ngu`  — KHÔNG có cơn nào đang ra tin ⇒ **1 lần/ngày** (đổi ngày VN).
//   · `xa`   — có cơn, nhưng còn XA bà con (>500 km tới cảng gần nhất) ⇒ quét
//              ĐÚNG lúc nguồn hẹn bản tin kế; nguồn không hẹn thì 6 giờ.
//   · `gan`  — cơn đã vào tầm ảnh hưởng ngư dân (≤500 km tới một cảng) HOẶC
//              mạnh từ cấp 10 ⇒ **1 giờ/lần**, KHÔNG chờ mốc hẹn (lúc này NCHMF
//              phát thêm tin ngoài lịch, chờ đúng mốc là trễ mất một nhịp).
//
// ⚠️ MỨC `ngu` KHÔNG PHẢI LÀ CHỖ PHÁT HIỆN BÃO MỚI — đừng siết nó vì lo sót.
// Việc phát hiện nằm ở đường khác và đã chạy 30 phút/lần: `/api/cron/notify-storms`
// gọi `/api/storms` (NCHMF + GDACS) rồi đẩy thông báo. Cron kho này chỉ lo GHI
// LẠI ĐƯỜNG ĐI để vẽ. Hậu quả xấu nhất khi trời yên mà bão vừa hình thành: khúc
// đầu của đường vẽ bắt đầu trễ vài giờ — bà con VẪN được cảnh báo ngay.
//
// Mọi hàm THUẦN, không đọc đồng hồ trong thân hàm (`now` truyền vào) — test được.
import { PORTS } from "@/data/ports";
import { khoangCachKm } from "@/lib/storm-bulletin";
import { isoDateVN } from "@/lib/day-labels";

export type MucQuet = "ngu" | "xa" | "gan";

/** Bản tin mới nhất trong kho — vừa đủ để quyết định nhịp, không hơn */
export type BanTinCuoi = {
  issuedAt: number;
  /** giờ nguồn hẹn bản tin kế; null = bản tin không ghi */
  nextAt: number | null;
  lat: number;
  lon: number;
  cap: number | null;
};

export type TrangThaiQuet = {
  /** lần cuối THẬT SỰ hỏi nguồn (kể cả lượt không có bản tin mới). null = chưa bao giờ */
  quetLucNao: number | null;
  banTinCuoi: BanTinCuoi | null;
};

export type QuyetDinhQuet = {
  quet: boolean;
  muc: MucQuet;
  /** vì sao — đi thẳng vào log/phản hồi để soi lại nhịp thật, không phải đoán */
  vi: string;
  /** tâm bão cách cảng gần nhất bao nhiêu km; null khi không có cơn nào */
  cachCangKm: number | null;
};

/**
 * Bản tin cũ hơn ngần này giờ ⇒ coi như KHÔNG còn cơn nào đang ra tin.
 * Nhịp thưa nhất của NCHMF là 6 giờ/lần, nên 18 giờ im lặng là đã tan hoặc đã
 * có "tin cuối cùng". Đặt rộng gấp ba nhịp thưa nhất để một lượt phát trễ không
 * đá app về mức `ngu` giữa lúc còn bão.
 */
export const HET_CON_GIO = 18;
/** Tâm bão gần cảng hơn ngần này thì là chuyện của bà con, không còn là tin xa */
export const GAN_KM = 500;
/** …hoặc mạnh từ cấp này trở lên thì bám sát dù còn xa (bão mạnh đổi hướng nhanh) */
export const CAP_BAM_SAT = 10;
/** Trần cứng cho MỌI mức: không bao giờ hỏi nguồn dày hơn ngần này */
export const TOI_THIEU_PHUT = 55;
/** Mức `xa` mà bản tin không hẹn mốc kế thì tự quét lại sau ngần này giờ */
export const XA_TOI_DA_GIO = 6;

/** Khoảng cách từ tâm bão tới cảng cá VN gần nhất (km) */
export function cachCangGanNhatKm(lat: number, lon: number): number {
  let min = Infinity;
  for (const p of PORTS) {
    const d = khoangCachKm(lat, lon, p.lat, p.lon);
    if (d < min) min = d;
  }
  return min;
}

/** Còn cơn nào đang ra tin không (theo tuổi bản tin cuối) */
export function conDangRaTin(b: BanTinCuoi | null, now: number): boolean {
  if (!b || !Number.isFinite(b.issuedAt)) return false;
  return now - b.issuedAt <= HET_CON_GIO * 3600_000;
}

const gioLe = (ms: number) => Math.round(ms / 3600_000);
const phutLe = (ms: number) => Math.round(ms / 60_000);

/**
 * CÓ NÊN HỎI NGUỒN LƯỢT NÀY KHÔNG — chỗ DUY NHẤT phát biểu luật nhịp quét.
 *
 * Cron chạy nhịp cố định (1 giờ/lần) rồi hỏi hàm này; hàm nói "không" thì lượt
 * đó KHÔNG chạm mạng ngoài, chỉ tốn một câu đọc kho. Nhờ vậy nhịp thật của
 * request ra NCHMF là: **1 lần/ngày khi trời yên**, theo mốc nguồn hẹn khi bão
 * còn xa, **1 giờ/lần khi bão vào gần** — đúng thứ chủ dự án yêu cầu, mà lịch
 * cron ngoài GitHub Actions không tự đổi được.
 */
export function nhipQuet(st: TrangThaiQuet, now: number): QuyetDinhQuet {
  const b = st.banTinCuoi;
  const con = conDangRaTin(b, now);
  const cachCangKm = con && b ? Math.round(cachCangGanNhatKm(b.lat, b.lon)) : null;

  // ── TRỜI YÊN: một lần mỗi NGÀY VN. Đổi ngày là quét, không đếm giờ trôi —
  //    nhịp cố định, không trôi dần mỗi ngày một chút như phép "đủ 20 giờ".
  if (!con) {
    if (st.quetLucNao == null) {
      return { quet: true, muc: "ngu", vi: "chưa quét lần nào", cachCangKm: null };
    }
    const cu = isoDateVN(st.quetLucNao);
    const nay = isoDateVN(now);
    return cu === nay
      ? { quet: false, muc: "ngu", vi: `trời yên, hôm nay (${nay}) đã quét`, cachCangKm: null }
      : { quet: true, muc: "ngu", vi: `trời yên, quét định kỳ ngày ${nay}`, cachCangKm: null };
  }

  const bt = b as BanTinCuoi;
  const muc: MucQuet =
    (cachCangKm != null && cachCangKm <= GAN_KM) || (bt.cap ?? 0) >= CAP_BAM_SAT
      ? "gan"
      : "xa";

  /*  TRẦN CỨNG trước mọi luật khác: dù mức nào, dù mốc hẹn nói gì, không hỏi
      nguồn dày hơn ~1 giờ. Đây là cái chặn ca xấu nhất — mốc hẹn đọc trượt
      thành giờ quá khứ, hoặc nguồn phát trễ, khiến "tới giờ rồi" đúng ở MỌI
      lượt và app quay lại đúng cảnh quét liên tục. */
  const tu = st.quetLucNao == null ? Infinity : now - st.quetLucNao;
  if (tu < TOI_THIEU_PHUT * 60_000) {
    return {
      quet: false,
      muc,
      vi: `vừa quét ${phutLe(tu)} phút trước (trần ${TOI_THIEU_PHUT} phút)`,
      cachCangKm,
    };
  }

  if (muc === "gan") {
    return {
      quet: true,
      muc,
      vi:
        cachCangKm != null && cachCangKm <= GAN_KM
          ? `bão cách cảng ${cachCangKm} km — bám sát 1 giờ/lần`
          : `bão cấp ${bt.cap} — bám sát 1 giờ/lần`,
      cachCangKm,
    };
  }

  // ── CÒN XA: đi theo mốc NGUỒN TỰ HẸN
  if (bt.nextAt != null) {
    return now >= bt.nextAt
      ? { quet: true, muc, vi: "tới mốc nguồn hẹn bản tin kế", cachCangKm }
      : {
          quet: false,
          muc,
          vi: `bão còn xa (${cachCangKm} km), nguồn hẹn tin kế sau ${gioLe(bt.nextAt - now)} giờ`,
          cachCangKm,
        };
  }
  return tu >= XA_TOI_DA_GIO * 3600_000
    ? { quet: true, muc, vi: `bản tin không hẹn mốc kế — quét lại sau ${XA_TOI_DA_GIO} giờ`, cachCangKm }
    : {
        quet: false,
        muc,
        vi: `bão còn xa (${cachCangKm} km), quét cách đây ${gioLe(tu)} giờ`,
        cachCangKm,
      };
}
