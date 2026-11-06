// ĐỌC HẾT BẢNG THEO TRANG — PostgREST trả tối đa 1000 dòng mỗi câu (max-rows của
// Supabase) mà KHÔNG báo lỗi gì. Một `.select()` trần trên bảng > 1000 dòng là
// con số sai mà trông như đúng: tab Tài khoản /quan-tri từng hiện "1000 Đang xem,
// 2 Premium" trong khi bảng có 11 046 khách, 181 premium (2026-11-06).
// Dùng chung cho mọi route quản trị đếm/gộp trong bộ nhớ.

export const PAGE = 1000; // trần mỗi lượt select của PostgREST

export type ReadAll<T> = { rows: T[]; truncated: boolean } | null;

/**
 * Gọi `build(from, to)` lần lượt từng trang tới khi trang về thiếu.
 * `build` PHẢI có `.order(...)` theo cột duy nhất/ổn định — không thì hai trang
 * có thể trùng/sót dòng.
 * Lỗi ⇒ null (caller tự quyết lùi nấc hay báo hỏng, không ném).
 * Chạm `maxPages` ⇒ `truncated: true` để UI nói thật là chưa đủ.
 */
export async function readAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
  maxPages = 20,
): Promise<ReadAll<T>> {
  const rows: T[] = [];
  try {
    for (let p = 0; p < maxPages; p++) {
      const { data, error } = await build(p * PAGE, p * PAGE + PAGE - 1);
      if (error) return null;
      const batch = (data ?? []) as T[];
      rows.push(...batch);
      if (batch.length < PAGE) return { rows, truncated: false };
    }
    return { rows, truncated: true };
  } catch {
    return null;
  }
}

type AuthUser = { email?: string | null; created_at: string };
type ListUsers = (p: { page: number; perPage: number }) => PromiseLike<{
  data: { users: AuthUser[] };
  error: unknown;
}>;

export const AUTH_PER_PAGE = 1000; // GoTrue cho tối đa 1000/trang

/**
 * Duyệt auth.users theo trang, gọi `visit` từng user; `visit` trả true ⇒ dừng sớm.
 * Trả `truncated` khi chạm `maxPages`. Lỗi ném ra để caller chọn cách lùi.
 * Trần cũ 20 × 200 = 4 000 user — prod 2026-11-06 đã 13 392 ⇒ sót 2/3.
 */
export async function eachAuthUser(
  listUsers: ListUsers,
  visit: (u: AuthUser) => boolean | void,
  maxPages = 100,
): Promise<{ truncated: boolean; stopped: boolean }> {
  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await listUsers({ page, perPage: AUTH_PER_PAGE });
    if (error) throw error;
    for (const u of data.users) if (visit(u)) return { truncated: false, stopped: true };
    if (data.users.length < AUTH_PER_PAGE) return { truncated: false, stopped: false };
  }
  return { truncated: true, stopped: false };
}
