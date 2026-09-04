// TẢI MỘT ĐỊA CHỈ, THỬ LẠI KHI NGUỒN HẮT HƠI — bộ dùng chung, KHÔNG dependency.
//
// ── VÌ SAO CÓ FILE NÀY ────────────────────────────────────────────────────
// Các trang nhà nước (vmsa.vn, nchmf.gov.vn, cảng vụ tỉnh) là web đời cũ chạy
// trên hạ tầng khiêm tốn: 502/503/đứt kết nối vài chục giây rồi tự sống lại là
// chuyện thường ngày, không phải sự cố. Bỏ cuộc ngay lần đầu nghĩa là một lượt
// cron mất trắng, mà lượt sau có khi cả tuần mới tới.
//
// Thử lại là LỊCH SỰ hơn bỏ cuộc rồi chạy lại cả đợt — nhưng có TRẦN và có
// NGHỈ TĂNG DẦN, không phải vòng lặp đập cửa. Nguồn đang quá tải mà mình gõ
// dồn là mình góp phần làm nó sập lâu hơn.
//
// ── nợ: `scripts/fetch-soundings.mjs` có một hàm `get()` sinh đôi với hàm này
//    (cùng ý: 3 lượt, nghỉ tăng dần, đồng hồ chặn). KHÔNG gộp ngay được vì file
//    đó đang có việc sửa dở của mạch khác; gộp khi mạch đó đã vào main — đổi
//    `get()` ở đó thành lời gọi `taiLai()` rồi xoá bản cũ.
//
// ── ẢNH HƯỞNG OFFLINE: KHÔNG ──────────────────────────────────────────────
// File này chỉ chạy trong script phát triển / GitHub Actions, KHÔNG nằm trong
// app của bà con. Không đụng `public/sw.js`, không đụng khoá `forfish.*`.

/** Khai tên thật để bên nguồn biết ai đang gõ cửa và chặn được nếu mình sai. */
export const UA_SDFISH =
  "SDFish/1.0 (ung dung ngu dan Viet Nam; +https://github.com/Long-Forfun/ForFish)";

const nghi = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Tải một địa chỉ, thử lại tối đa `lan` lượt với nghỉ tăng dần.
 *
 * @param {string} url
 * @param {object} [o]
 * @param {"text"|"buffer"} [o.as="text"]
 * @param {number} [o.lan=4]          số lượt TỐI ĐA (kể cả lượt đầu)
 * @param {number} [o.timeoutMs=25000] đồng hồ chặn cho MỖI lượt
 * @param {number[]} [o.nghiMs]       nghỉ giữa các lượt, ms
 * @param {(s:string)=>void} [o.log]  in tiến trình (mặc định: im)
 * @returns {Promise<string|Buffer>}
 * @throws lỗi của LƯỢT CUỐI khi hết lượt — người gọi tự quyết bỏ qua hay đỏ
 */
export async function taiLai(url, o = {}) {
  const {
    as = "text",
    lan = 4,
    timeoutMs = 25000,
    // 2s → 5s → 12s: đủ để một lần khởi động lại của web đời cũ trôi qua,
    // mà cả đợt vẫn dưới 45 giây nên không đội giờ job.
    nghiMs = [2000, 5000, 12000],
    log = () => {},
  } = o;

  let cuoi;
  for (let i = 0; i < lan; i++) {
    const ctl = new AbortController();
    const dongHo = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": UA_SDFISH },
        signal: ctl.signal,
        redirect: "follow",
      });
      /*  4xx KHÔNG thử lại: trang đổi địa chỉ hoặc bị gỡ thì gõ thêm ba lần
          nữa cũng vẫn 404, chỉ tốn thời gian và làm log khó đọc. Chỉ 408/429
          là ngoại lệ — đó là "bận, quay lại sau", không phải "không có". */
      if (!r.ok) {
        const thuLaiDuoc = r.status >= 500 || r.status === 408 || r.status === 429;
        const e = new Error(`HTTP ${r.status} — ${url}`);
        if (!thuLaiDuoc) throw Object.assign(e, { khongThuLai: true });
        throw e;
      }
      return as === "buffer" ? Buffer.from(await r.arrayBuffer()) : await r.text();
    } catch (e) {
      cuoi = e;
      if (e?.khongThuLai) break;
      const conLuot = i + 1 < lan;
      log(
        `  ✗ lượt ${i + 1}/${lan}: ${e?.message ?? e}` +
          (conLuot ? ` — nghỉ ${(nghiMs[i] ?? nghiMs.at(-1)) / 1000}s rồi thử lại` : ""),
      );
      if (conLuot) await nghi(nghiMs[i] ?? nghiMs.at(-1));
    } finally {
      clearTimeout(dongHo);
    }
  }
  throw cuoi;
}
