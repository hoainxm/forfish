// KAIROS — KIỂU DỮ LIỆU + TRẦN DÙNG CHUNG (14-ba-spec-kairos §6–§8). THUẦN.
//
// Kiểu ở đây là thứ RA CLIENT (DTO) — không có trường SĐT nào, kể cả tuỳ chọn. Hàng DB
// (có `*_phone`) chỉ sống ở máy chủ, đổi sang DTO qua `dto.ts`. Thêm trường vào DTO mà
// mang SĐT là phá AC21 — `kairos-dto.test.ts` soi điều đó.
//
// Mã (kind/topic/region/reason) khớp từng ký tự với check của 0065_kairos.sql.

/** SĐT sentinel của hồ sơ SDVICO (seed ở 0065) — bài Chính thức đứng tên hồ sơ này. MỘT chỗ. */
import type { CamXuc, DemCamXuc } from "./cam-xuc";

export const SDVICO_PHONE = "sdvico:chinh-thuc";
/** SĐT sentinel của hồ sơ SEN BIỂN — trợ lý của SDVICO, dấu Chính thức (seed ở 0068). Máy GPU đăng bài giới thiệu
 *  app/Kairos mỗi ngày qua /api/kairos/sen-bien (lib/kairos/sen-bien-gioi-thieu.mjs). */
export const SEN_BIEN_PHONE = "sen-bien:tro-ly";

export type { Topic as KairosTopic } from "./chu-de.mjs";

export const POST_KINDS = ["bao", "chinh-thuc", "ba-con"] as const;
export type KairosPostKind = (typeof POST_KINDS)[number];

/** Vùng biển (14 §4). "ca-nuoc" = không rõ khu vực. */
export const SEA_REGIONS = [
  "vinh-bac-bo",
  "mien-trung",
  "dong-nam-bo",
  "tay-nam-bo",
  "hoang-sa-truong-sa",
] as const;
export type SeaRegion = (typeof SEA_REGIONS)[number];
export type KairosRegion = SeaRegion | "ca-nuoc";

export const REPORT_REASONS = ["lua-dao", "bay-ba", "sai-su-that", "xuc-pham", "quang-cao", "khac"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** Trần nội dung (14 §3.3, §3.4, §3.10, A2). Route và khung soạn dùng CHUNG số này. */
export const LIMITS = {
  postBody: 2000,
  commentBody: 1000,
  reportNote: 200,
  images: 5,
  imageBytes: 512 * 1024,
  pageSize: 20,
  commentPageSize: 30,
  topComments: 2,
  handleMin: 2,
  handleMax: 20,
} as const;

/** Mã lỗi route trả về (`{ error: code }`) — khung soạn đổi mã thành câu (14 §10). */
export type KairosErrorCode =
  | "bad_body"
  | "empty"
  | "too_long"
  | "too_many_images"
  | "bad_image"
  | "bad_topic"
  | "bad_port"
  | "bad_reason"
  | "bad_words"
  | "sovereignty"
  | "rate_limited"
  | "banned"
  | "rules"
  | "handle_short"
  | "handle_long"
  | "handle_chars"
  | "handle_reserved"
  | "handle_taken"
  | "handle_cooldown";

export type Checked<T> = { ok: true; value: T } | { ok: false; code: KairosErrorCode; term?: string };

/** Tác giả công khai — danh tính là `profileId` (uuid), KHÔNG BAO GIỜ SĐT. */
export interface KairosAuthor {
  profileId: string;
  handle: string;
  /** "Cảng Sa Huỳnh" / tên cơ sở bên mua / "" */
  subline: string;
  avatarUrl: string | null;
  official: boolean;
  /** chỉ có khi chủ bật "Hiện số hiệu tàu" */
  boatReg?: string;
  /** tài khoản AGENT tri thức (SĐT sentinel `agent:` — agent-doi.mjs) ⇒ chấm "AI" cạnh tên */
  isAgent?: boolean;
}

/**
 * Phần "Giới thiệu" + ảnh bìa của trang người dùng (0067). Mã, không tên: màn tra tên bằng
 * danh mục (ho-so.ts, fishing-ports.ts). Cột chưa có trên DB ⇒ mọi trường rỗng.
 */
export interface KairosAbout {
  coverUrl: string | null;
  /** mã tỉnh (khu-vuc.mjs PROVINCES) */
  queTinh: string | null;
  /** mã nghề (ho-so.ts NGHE) */
  nghe: string | null;
  /** ≤150 ký tự, "" = chưa viết */
  gioiThieu: string;
  /** mã cảng chủ tự chọn (fishing-ports.ts); null ⇒ cảng theo sổ tàu (nếu có) */
  homePort: string | null;
}

export type { NhacTen } from "./nhac-ten";
import type { NhacTen } from "./nhac-ten";

/** Đường dẫn NỘI BỘ của app ("/kairos/hoi-mua?…", ảnh "/sdvico/…") — thẻ do máy chủ tự dựng (SDVICO trực khách, 14 §3.14). */
export const laNoiBo = (u: string) => /^\/(?!\/)[\w\-./?=&%]*$/.test(u);

/** Thẻ xem trước link trong bình luận (0070, xem-truoc-link.ts). */
export interface LinkPreview {
  url: string;
  site: string;
  title: string;
  image: string | null;
}

export interface KairosComment {
  id: string;
  postId: string;
  parentId: string | null;
  author: KairosAuthor;
  body: string;
  hayCount: number;
  /** người đang xem đã bấm Hay chưa (khách ⇒ false) */
  hayByMe: boolean;
  /** cảm xúc của người xem (null = chưa bấm) + đếm theo loại, nhiều nhất trước — kiểu FB (0069) */
  myCamXuc?: CamXuc | null;
  camXuc?: DemCamXuc;
  createdAt: string;
  mine: boolean;
  /** ảnh kèm (một ảnh, URL công khai kairos-media) — 0070 */
  image?: string | null;
  /** thẻ xem trước link đầu tiên trong chữ — máy chủ đọc lúc ghi (0070) */
  link?: LinkPreview | null;
  /** người được nhắc tên "@Tên" trong chữ (0071) */
  mentions?: NhacTen[];
}

export interface KairosPost {
  id: string;
  kind: KairosPostKind;
  /** null với bài báo */
  author: KairosAuthor | null;
  /** bài báo: tên báo + link gốc */
  outlet: string | null;
  url: string | null;
  title: string | null;
  body: string;
  /** bài báo: tóm tắt 2–3 câu */
  summary: string | null;
  summaryBy: "ai" | "rss" | null;
  coverUrl: string | null;
  /** bài báo ĐANG NÓNG (vào qua nguồn Tin nổi bật — phan-phoi.NGUON_NONG) ⇒ thẻ có nhãn "Đang nóng" */
  nong?: boolean;
  /** URL công khai kho kairos-media (bản lưu offline: [] — chỉ chữ, xem imageCount) */
  images: string[];
  /** CHỈ ở bản lưu offline (cache.ts): bài có mấy ảnh, để thẻ ghi "Có N ảnh — cần sóng" */
  imageCount?: number;
  topic: string;
  regions: KairosRegion[];
  provinces: string[];
  ports: string[];
  /** thẻ bài gốc khi đăng lại — 1 tầng (A11); bài gốc không còn ⇒ null + reshareGone */
  reshareOf: KairosPost | null;
  reshareGone?: boolean;
  pinnedUntil: string | null;
  hayCount: number;
  commentCount: number;
  hayByMe: boolean;
  /** cảm xúc của người xem + đếm theo loại (0069) */
  myCamXuc?: CamXuc | null;
  camXuc?: DemCamXuc;
  topComments: KairosComment[];
  publishedAt: string;
  editedAt: string | null;
  mine: boolean;
  /** người được nhắc tên trong bài (0071) */
  mentions?: NhacTen[];
}
