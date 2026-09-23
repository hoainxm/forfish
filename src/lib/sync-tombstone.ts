// ĐÁNH DẤU "ĐÃ XOÁ" CHO SỔ ĐỒNG BỘ — thuần, test được (không mạng, không DB).
//
// Chủ dự án 2026-09-01: *"nó đơn thuần là thêm trạng thái của cái nhắc đó thôi,
// đã xoá thì xoá ở máy còn trên server vẫn có"*.
//
// Máy: xoá là mất khỏi sổ, y như cũ — bà con không phải nhìn lại thứ mình vừa bỏ.
// Server: bản ghi Ở LẠI trong chính cuốn sổ đó, chỉ thêm `deleted: true` +
// `deletedAt`. Không bảng mới, không migration: `user_docs.data` vốn là `jsonb`.
//
// Hai hàm này là toàn bộ luật:
//   · `keepDeleted(cu, moi, now)` — lúc client đẩy sổ lên, bản ghi nào BIẾN MẤT
//     so với bản trước thì giữ lại kèm cờ, thay vì để `upsert` đè cho mất hẳn.
//   · `stripDeleted(data)` — lúc client kéo về, bỏ hết bản đã đánh dấu. Máy bà
//     con KHÔNG BAO GIỜ thấy lại; phân tích thì đọc thẳng DB.

/** Bản ghi trong sổ — chỉ cần có `id` để so hai bản; còn lại giữ nguyên. */
type Item = Record<string, unknown> & { id?: unknown };

/** Cờ đánh dấu, đặt tên dài cho khỏi đụng khoá nghiệp vụ nào của sổ. */
export const DELETED_FLAG = "_deleted";
export const DELETED_AT = "_deletedAt";

function isItemArray(v: unknown): v is Item[] {
  return (
    Array.isArray(v) &&
    v.every(
      (x) =>
        !!x &&
        typeof x === "object" &&
        !Array.isArray(x) &&
        typeof (x as Item).id === "string",
    )
  );
}

/** Bản ghi này đã bị đánh dấu xoá chưa. */
export function isDeleted(x: unknown): boolean {
  return !!x && typeof x === "object" && (x as Item)[DELETED_FLAG] === true;
}

/**
 * Ghép bản MỚI (client đẩy lên) với bản CŨ trên server, GIỮ LẠI thứ đã biến mất.
 *
 * Luật:
 *  · id có ở bản mới ⇒ lấy bản mới (bà con vừa sửa gì thì theo cái đó).
 *  · id CHỈ có ở bản cũ ⇒ giữ lại, gắn `_deleted` + `_deletedAt` (nếu chưa có).
 *  · Bản cũ đã đánh dấu xoá rồi ⇒ giữ nguyên mốc xoá CŨ, không dập lại — mốc
 *    đầu tiên mới là lúc bà con thật sự bỏ nó.
 *  · Bản ghi đánh dấu xoá KHÔNG bao giờ "sống lại" chỉ vì vắng mặt; nhưng nếu
 *    id đó quay lại ở bản mới (bà con tạo lại đúng id) thì bản mới thắng.
 *
 * KHÔNG PHẢI MẢNG BẢN GHI CÓ `id` ⇒ trả thẳng bản mới, không đoán. Vài sổ có
 * thể là object hoặc mảng chuỗi; đoán bừa ở đó là làm hỏng dữ liệu thật.
 */
export function keepDeleted(
  cu: unknown,
  moi: unknown,
  nowIso: string,
): unknown {
  if (!isItemArray(cu) || !isItemArray(moi)) return moi;
  const conLai = new Set(moi.map((x) => String(x.id)));
  const daBo = cu
    .filter((x) => !conLai.has(String(x.id)))
    .map((x) =>
      isDeleted(x)
        ? x
        : { ...x, [DELETED_FLAG]: true, [DELETED_AT]: nowIso },
    );
  return [...moi, ...daBo];
}

/**
 * Bỏ mọi bản đã đánh dấu xoá — dùng khi TRẢ VỀ CHO MÁY.
 * Máy bà con không bao giờ nhận lại thứ mình đã bỏ; muốn phân tích thì đọc DB.
 */
export function stripDeleted(data: unknown): unknown {
  if (!Array.isArray(data)) return data;
  return data.filter((x) => !isDeleted(x));
}
