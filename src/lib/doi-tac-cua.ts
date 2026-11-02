import "server-only";
import { getConfigValue } from "@/lib/app-config";
import { docKhoaDoiTac, khopDoiTac, layBearer, TRAN_DOI_TAC, type KhoaDoiTac } from "@/lib/doi-tac";
import { allowRequest, type RateStore } from "@/lib/rate-limit";

/*  CỬA API ĐỐI TÁC (src/app/api/doi-tac/v1/*): Bearer ⇒ mục đối tác (tên + khu đã mua + gói), rồi trần lượt theo tên.
    Chưa cấu hình khoá nào ⇒ 503, KHÔNG BAO GIỜ mở. Không hỏi được app_config ⇒ 503 (không đoán).
    nợ: kho đếm trong bộ nhớ một instance (trần thật cao hơn khai vài lần), nâng khi có bảng đếm chung — như rate-limit.ts. */
const store: RateStore = new Map();

const loi = (status: number, code: string, extra?: HeadersInit) =>
  Response.json({ ok: false, code }, { status, headers: { "cache-control": "no-store", ...extra } });

export async function cuaDoiTac(req: Request): Promise<{ dt: KhoaDoiTac } | { res: Response }> {
  let cfg: string | null;
  try {
    cfg = await getConfigValue("doi_tac_ais");
  } catch (e) {
    console.error("[đối tác] đọc khoá hỏng:", (e as Error)?.message);
    return { res: loi(503, "not_configured") };
  }
  const ds = docKhoaDoiTac(cfg);
  if (!ds.length) return { res: loi(503, "not_configured") };
  const dt = khopDoiTac(layBearer(req.headers.get("authorization")), ds);
  if (!dt) return { res: loi(401, "unauthorized", { "www-authenticate": "Bearer" }) };
  if (!allowRequest(store, dt.ten, Date.now(), TRAN_DOI_TAC)) return { res: loi(429, "rate_limited", { "retry-after": "60" }) };
  return { dt };
}
