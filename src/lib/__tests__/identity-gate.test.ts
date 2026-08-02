import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/*  CỔNG THẬT CHO SỔ DANH TÍNH — chặn CẢ KHUÔN, không vá từng điểm
    (2026-08-02, audit K7). Nhân mẫu cách quét của api-error-status.test.ts.

    KHUÔN LỖI: `use-auth.ts` cố ý bất đối xứng — thấy user thì nhớ, thấy `null`
    thì KHÔNG đụng vào sổ danh tính. Đó là lá chắn của cả ba lỗi CHẶN: C-1 (hộp
    thư biến mất), C-7 (mất quyền premium giữa biển), C-8 (dấu hạng bị xoá).
    Nhưng đọc mã thì nó trông y hệt một chỗ viết thiếu vế `else`. Người sau
    "dọn dẹp" thành `u ? remember : forget` là ba lỗi sống lại CÙNG LÚC, mà
    `npm test` vẫn xanh 100% — vì mọi ca test đều gọi thẳng `rememberIdentity`,
    không ca nào đi qua hook.

    Nay luật nằm ở hàm thuần `identityAction` (có bảng chân trị trong
    offline-identity.test.ts) và test này canh cái dây nối: KHÔNG chỗ nào ngoài
    module danh tính được tự tay ghi/xoá sổ. */

const SRC = join(process.cwd(), "src");
/** Module chủ — chỗ DUY NHẤT được cầm hai hàm ghi/xoá trực tiếp */
const OWNER = join("src", "lib", "offline-identity.ts");

/*  DANH SÁCH NỢ NAY RỖNG (2026-08-02b): `/quan-tri` — món nợ cuối — đã dời sang
    `applyIdentityAction("user-signed-out", false)`. Giữ mảng lại làm CHỖ GHI NỢ
    có tên nếu sau này buộc phải hoãn một chỗ; ngưỡng dưới đã hạ về 0 nên thêm
    tên vào đây là ĐỎ TEST, không lặng lẽ trôi qua. Danh sách chỉ được ngắn đi. */
const DEBT: string[] = [];

/*  Hàm chỉ được GỌI bên trong module chủ.
    `clearTierMark` thêm 2026-08-02c: nó xoá QUYỀN, và trước đó
    `hero-account.tsx` gọi thẳng hai lần ("thừa một nhịp — cố ý") mà không cổng
    nào canh. Một đường ghi thứ hai là một đường để người sau đi lệch: cổng
    `applyIdentityAction` đã xoá dấu hạng rồi (forgetIdentity → clearTierMark,
    quan hệ đó có test riêng trong offline-identity.test.ts). */
const GUARDED = /\b(rememberIdentity|forgetIdentity|clearTierMark)\s*\(/g;

/*  BÍ DANH LÀ CỬA SAU CỦA CỔNG QUÉT CHỮ. `use-tier.ts` từng có
    `export const clearCachedTier = clearTierMark;` — đổi tên một cái là lách
    qua GUARDED mà test vẫn xanh. Không file nào được đặt bí danh cho ba hàm
    trên nữa. */
const ALIAS = /=\s*(rememberIdentity|forgetIdentity|clearTierMark)\s*;/g;

/*  Bóc comment trước khi soi — mấy file này GIẢI THÍCH chính khuôn lỗi đó bằng
    lời (quy ước dự án: comment nói VÌ SAO), nên quét thô sẽ báo động oan đúng
    những chỗ đã sửa xong. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function sourceFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      // test là ORACLE, không phải mã chạy trên máy bà con — được gọi thẳng
      if (name === "__tests__") continue;
      out.push(...sourceFilesUnder(p));
    } else if (/\.tsx?$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

describe("sổ danh tính chỉ có MỘT người ghi (K7)", () => {
  const files = sourceFilesUnder(SRC);

  it("có tìm thấy mã nguồn để soi (đường dẫn không lệch)", () => {
    expect(files.length).toBeGreaterThan(50);
    expect(files.some((f) => f.endsWith(OWNER))).toBe(true);
  });

  it("ngoài offline-identity.ts, không file nào tự ghi/xoá danh tính", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const rel = file.slice(process.cwd().length + 1);
      if (rel === OWNER || DEBT.includes(rel)) continue;
      const hits = stripComments(readFileSync(file, "utf8")).match(GUARDED);
      if (hits) offenders.push(`${rel} → ${hits.join(" · ")}`);
    }
    expect(
      offenders,
      `phải đi qua applyIdentityAction (lib/offline-identity):\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("không file nào đặt BÍ DANH cho hàm bị canh (cửa sau của bộ dò)", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const rel = file.slice(process.cwd().length + 1);
      if (rel === OWNER) continue;
      const hits = stripComments(readFileSync(file, "utf8")).match(ALIAS);
      if (hits) offenders.push(`${rel} → ${hits.join(" · ")}`);
    }
    expect(offenders, `bí danh = lách cổng:\n${offenders.join("\n")}`).toEqual(
      [],
    );
  });

  /*  CA ĐỐI CHỨNG — CANH CHÍNH BỘ DÒ (thêm 2026-08-02c).
      Hai `it` bên trên khẳng định "không có ai vi phạm". Một regex viết hỏng
      (thiếu `\b`, sai tên hàm, quên `g`) cũng cho ra ĐÚNG kết quả đó — cổng
      xanh VĨNH VIỄN mà không canh gì cả. Nên phải có mẫu xấu để bộ dò chứng
      minh nó còn sống. */
  describe("bộ dò còn sống — mẫu xấu phải bị bắt", () => {
    const BAD = [
      'const p = applyIdentityAction(u ? event : "user-signed-out", !!u, null);\nif (!u) forgetIdentity();',
      "if (!u) { rememberIdentity(null); }",
      "clearTierMark(); // thừa một nhịp",
      "export const clearCachedTier = clearTierMark;",
    ];

    it("mỗi mẫu xấu đều bị GUARDED hoặc ALIAS bắt", () => {
      for (const bad of BAD) {
        const src = stripComments(bad);
        const caught = [...(src.match(GUARDED) ?? []), ...(src.match(ALIAS) ?? [])];
        expect(caught, `mẫu này lọt lưới: ${bad}`).not.toHaveLength(0);
      }
    });

    it("mẫu SẠCH không bị báo động oan (cổng không kêu bừa)", () => {
      const ok = [
        'applyIdentityAction("user-signed-out", false);',
        "import { offlineIdentityPhone } from '@/lib/offline-identity';",
        "// forgetIdentity() ở đây là giải thích, không phải mã chạy",
        "/* rememberIdentity() — chú thích VÌ SAO */",
      ];
      for (const good of ok) {
        const src = stripComments(good);
        expect(src.match(GUARDED), `báo động oan: ${good}`).toBeNull();
        expect(src.match(ALIAS), `báo động oan: ${good}`).toBeNull();
      }
    });

    it("stripComments không nuốt mã thật (bóc comment mà mù luôn thì hỏng)", () => {
      expect(stripComments("/* nói */ forgetIdentity();")).toContain(
        "forgetIdentity()",
      );
    });
  });

  it("use-auth truyền TÊN SỰ KIỆN vào cổng, không tự quyết", () => {
    const src = stripComments(
      readFileSync(join(SRC, "lib", "use-auth.ts"), "utf8"),
    );
    expect(src).toContain("applyIdentityAction(");
    // onAuthStateChange phải CHUYỂN TIẾP event, không được nuốt thành `_e`
    expect(src).toMatch(/onAuthStateChange\(\(event, session\)/);
    expect(src).toMatch(/remember\(String\(event\), u\)/);
  });

  it("hero-account chỉ quên bằng hai sự kiện CỦA BÀ CON", () => {
    const src = stripComments(
      readFileSync(join(SRC, "components", "hero-account.tsx"), "utf8"),
    );
    /*  ĐƯỜNG ĐĂNG XUẤT ĐI QUA `signOutLocal("user")` từ 2026-08-02f: nút đó nay
        phải xoá CẢ CHUỖI CỨNG (`forfish.token.v1`) chứ không chỉ sổ danh tính,
        và hai việc đó không được tách rời — xoá danh tính mà để chuỗi lại thì
        máy "không biết ai" nhưng vẫn gọi được mọi cửa server dưới tên người cũ.
        Gộp vào một hàm để mọi chỗ gọi đều đúng luật, khỏi phải nhớ gọi kèm —
        cùng lý do `forgetIdentity` đã gộp `clearTierMark`.
        Dây nối được canh ở ca ngay dưới, nên đây KHÔNG phải nới lỏng cổng. */
    expect(src).toContain('signOutLocal("user")');
    expect(src).toContain('applyIdentityAction("device-forget", false)');
  });

  it("`signOutLocal` THẬT SỰ đi qua cổng — dây nối không được đứt", () => {
    const src = stripComments(
      readFileSync(join(SRC, "lib", "device-token-store.ts"), "utf8"),
    );
    expect(src).toContain('applyIdentityAction("user-signed-out", false)');
  });

  /*  LUẬT CỦA CHỦ DỰ ÁN, 2026-08-02f: "máy nào tải rồi thì cứ dùng thôi, chứng
      tỏ đã là premium trước đó rồi."
      Ca thật: chủ tàu ở nhà đăng nhập máy mới, máy cũ đang TRÊN TÀU giữa biển
      với bạn thuyền. Máy trên tàu bị đá. Nếu "bị đá" cũng quên danh tính + xoá
      dấu hạng thì mấy người ngoài khơi mất bản đồ cá + dự báo đã tải, vì một
      thao tác của người ở bờ — mà chẳng ai được lợi: máy mới không dùng được
      file nằm trong máy cũ.
      BỊ ĐÁ = mất quyền lấy dữ liệu MỚI, KHÔNG phải mất dữ liệu ĐANG CÓ. */
  it("nhánh BỊ ĐÁ chỉ xoá chuỗi — KHÔNG quên danh tính, KHÔNG xoá dấu hạng", () => {
    const src = stripComments(
      readFileSync(join(SRC, "lib", "device-token-store.ts"), "utf8"),
    );
    const i = src.indexOf('reason === "kicked"');
    expect(i, "không tìm thấy nhánh kicked").toBeGreaterThan(-1);
    const nhanh = src.slice(i, i + 400);
    expect(nhanh).not.toMatch(/applyIdentityAction|forgetIdentity|clearTierMark/);
  });

  it("danh sách nợ chỉ được ngắn đi, không dài thêm", () => {
    expect(DEBT.length).toBeLessThanOrEqual(0);
  });
});

/* ── MỘT CỬA DUY NHẤT ĐƯỢC KẾT LUẬN "MÁY BỊ ĐÁ" ────────────────────────────
   (2026-08-02f, chủ dự án hỏi đúng chỗ: "đã là token vĩnh viễn rồi mà?")

   Chuỗi vĩnh viễn nghĩa là nó KHÔNG TỰ CHẾT theo thời gian. Nhưng nó vẫn bị thu
   hồi được — bởi đúng MỘT sự kiện, là máy khác đăng nhập cùng SĐT. Máy phải học
   được điều đó, và cách duy nhất là gọi lên server rồi đọc câu trả lời.

   Câu hỏi còn lại không phải "có nên kết luận không" mà là "ĐOẠN MÃ NÀO được
   phép kết luận". Mỗi chỗ gọi được tự quyết là một chỗ có thể quyết SAI — mà
   quyết sai ở đây nghĩa là xoá chuỗi của người đang ngoài biển, tức dựng lại
   ĐÚNG con bug vừa diệt, chỉ khác hình dạng. Một cửa thì soát được một cửa.

   `authedFetch` là cửa đó. Mọi chỗ khác dùng `tokenHeader()` — gắn chuỗi, đọc
   kết quả, và khi 401 thì lùi về bản lưu trong máy y như lúc mất sóng. Máy bị đá
   vẫn được phát hiện đúng lúc vì nhịp tra hạng chạy đều. */
describe("chỉ MỘT chỗ được kết luận 'bị đá'", () => {
  const files = sourceFilesUnder(SRC).filter(
    (f) => !f.endsWith(join("lib", "device-token-store.ts")),
  );

  /*  ĐỔI HỢP ĐỒNG 2026-08-02g (chủ dự án: "lúc gửi 1 trong các lệnh có token
      tới server mà phát hiện token này đã bị thằng khác thay thì báo về thôi,
      tại sao phải check riêng?"). Đúng — nhịp tra hạng riêng đã xoá, và việc
      phát hiện bị đá nay đi nhờ MỌI lệnh sẵn có: cái nào tới trước bắt trước.
      Nên bất biến không còn là "một chỗ GỌI" mà là "một chỗ HIỂU". */
  it("chỉ `device-token-store.ts` được xoá chuỗi vì bị đá", () => {
    const pham = files.filter((f) =>
      /signOutLocal\s*\(\s*["']kicked["']/.test(
        stripComments(readFileSync(f, "utf8")),
      ),
    );
    expect(
      pham.map((f) => f.replace(process.cwd(), "")),
      "mỗi nơi tự luận 401 là một nơi có thể luận SAI — và luận sai ở đây là xoá chuỗi của người đang ngoài biển",
    ).toEqual([]);
  });

  /*  Chỉ soi mã CHẠY TRÊN MÁY BÀ CON. Phía máy chủ (`api-identity.ts`,
      `device-token-server.ts`) và module định nghĩa kiểu (`device-token.ts`)
      đương nhiên phải nhắc tới hai mã này — chúng là nơi SINH ra mã. Nguy hiểm
      nằm ở phía client: một component tự đọc `code` rồi tự dọn kho. */
  it("không client nào tự luận mã thu hồi ngoài `noteResponse`", () => {
    const tuluan = files.filter((f) => {
      const raw = readFileSync(f, "utf8");
      if (!raw.startsWith('"use client"')) return false;
      return /token_revoked|unknown_token/.test(stripComments(raw));
    });
    expect(
      tuluan.map((f) => f.replace(process.cwd(), "")),
      "đọc thẳng mã thu hồi ngoài bộ não chung = một luật thứ hai, không ai soát",
    ).toEqual([]);
  });

  it("ngoài `device-token-store.ts`, không file nào tự xoá khoá chuỗi", () => {
    const cham = files.filter((f) =>
      /forfish\.token\.v1|DEVICE_TOKEN_KEY/.test(readFileSync(f, "utf8")),
    );
    expect(cham.map((f) => f.replace(process.cwd(), ""))).toEqual([]);
  });

  it("nhịp nền KHÔNG được đi qua cửa đó — heartbeat gắn chuỗi bằng tay", () => {
    /*  `sendHeartbeat` chạy 30 phút/lần không ai bấm. Cho nó quyền kết luận là
        một bản deploy lỡ trả 401 sẽ đá cả đội tàu trong im lặng. */
    const src = stripComments(
      readFileSync(join(SRC, "lib", "heartbeat.ts"), "utf8"),
    );
    expect(src).not.toMatch(/\bauthedFetch\s*\(/);
    expect(src).not.toMatch(/\bnoteResponse\s*\(/);
    expect(src).toContain("DEVICE_TOKEN_HEADER");
  });

  /*  NHỊP TRA HẠNG RIÊNG ĐÃ XOÁ (2026-08-02g) — chủ dự án: *"offline thì gọi
      hạng làm gì? token lúc đăng nhập đã biết hạng rồi thì cần gì check?"*.
      Cổng này chặn nó mọc lại. Hạng nay đi nhờ phản hồi `/api/me/heartbeat` —
      nhịp đã im lặng tuyệt đối khi mất sóng, nên offline = 0 lượt gọi. */
  it("KHÔNG có nhịp tra hạng riêng: use-tier không tự gọi mạng", () => {
    const src = stripComments(
      readFileSync(join(SRC, "lib", "use-tier.ts"), "utf8"),
    );
    expect(src, "use-tier đi hỏi mạng trở lại").not.toMatch(/fetch\s*\(/);
    expect(
      existsSync(join(SRC, "app", "api", "me", "tier")),
      "route tra hạng riêng mọc lại",
    ).toBe(false);
  });
});

/* ── R7: GỠ MÁY PHẢI GỠ CẢ ĐƯỜNG THÔNG BÁO ─────────────────────────────────
   `detachPushAccount()` là điểm gọi DUY NHẤT trong repo và không có đường bù
   nào (`syncPushAccount` chỉ chạy khi đã đăng nhập lại). Thiếu nó ở nhánh Gỡ
   khỏi máy thì endpoint push VĨNH VIỄN còn trỏ về chủ tàu ⇒ tin nhắm riêng
   nhảy lên màn khoá máy đang trong tay bạn thuyền. */
describe("gỡ tài khoản khỏi máy — cả hai đường đều gỡ push", () => {
  const src = readFileSync(
    join(SRC, "components", "hero-account.tsx"),
    "utf8",
  );

  function bodyOf(name: string): string {
    const i = src.indexOf(`function ${name}(`);
    expect(i, `không thấy hàm ${name}`).toBeGreaterThan(-1);
    // tới đầu hàm kế tiếp / cuối phần khai báo — đủ để soi thân hàm
    const rest = src.slice(i + 1);
    const j = rest.indexOf("\n  function ");
    const k = rest.indexOf("\n  useEffect(");
    const end = Math.min(...[j, k].filter((n) => n > -1).concat([rest.length]));
    return rest.slice(0, end);
  }

  it("doSignOut gỡ push (đã có từ trước — chống rơi lại)", () => {
    expect(bodyOf("doSignOut")).toContain("detachPushAccount()");
  });

  it("forgetThisDevice CŨNG gỡ push (bản trước quên — R7)", () => {
    expect(bodyOf("forgetThisDevice")).toContain("detachPushAccount()");
  });

  it("nút Gỡ mở SHEET XÁC NHẬN, không gọi thẳng (một chạm không hoàn tác)", () => {
    expect(src).toContain("onClick={() => setConfirmForget(true)}");
    // `forgetThisDevice` chỉ được nối vào ĐÚNG MỘT nút, và nút đó nằm TRONG
    // sheet xác nhận (sau tiêu đề sheet), không phải nút ngoài danh sách
    const wired = src.match(/onClick=\{forgetThisDevice\}/g) ?? [];
    expect(wired).toHaveLength(1);
    expect(src.indexOf("onClick={forgetThisDevice}")).toBeGreaterThan(
      src.indexOf("Xoá tài khoản khỏi máy này?"),
    );
    // câu chữ đã chốt: nói thẳng đăng nhập lại cần sóng
    expect(src).toContain("Xoá tài khoản khỏi máy này?");
    expect(src).toContain("đăng nhập lại — việc đó cần sóng");
    // CẶP NÚT MỘT KHUÔN: `Thôi` / `<động từ>` — cùng số chữ, không dài ngắn
    // lệch nhau giữa các sheet (luật nhãn cụm ngang hàng, 03-design-system)
    expect(src).toMatch(/>\s*Thôi\s*<\/button>/);
    expect(src).not.toContain("Thôi, để nguyên");
    expect(src).toMatch(/>\s*Xoá\s*<\/button>/);
    // và KHÔNG còn câu trấn an sai hoàn cảnh
    expect(src).not.toContain("đăng nhập lại là thấy");
  });

  /* R7b: câu về push phải nói ĐÚNG cái `detachPushAccount()` làm được.
     Nó bắn-rồi-quên, không có hàng đợi thử lại; đường bù duy nhất
     (`syncPushAccount`) chỉ chạy lúc ĐĂNG NHẬP. "Cho tới lần có sóng sau" là
     lời hứa app không giữ nổi. */
  it("câu về thông báo nhắm riêng nói đúng mốc (đăng nhập, không phải sóng)", () => {
    /* Bóc comment TRƯỚC (chú thích ngay trên câu đó TRÍCH LẠI câu cũ để giải
       thích vì sao nó sai — quét thô sẽ báo động oan), rồi gộp khoảng trắng:
       câu bị JSX ngắt dòng, và xuống dòng thì CRLF/LF tuỳ máy. */
    const flat = stripComments(src).replace(/\s+/g, " ");
    expect(flat).toContain("cho tới khi có người đăng nhập trên máy");
    expect(flat).not.toContain("cho tới lần có sóng sau");
  });

  /* Tap target ≥56px là LUẬT dự án (03-design-system, ngư dân 40-60 tuổi).
     Bản vá trước hạ hai nút xuống 3.25rem = 52px để "cho nó đừng to nhất
     sheet" — ý đúng, cách sai: phân vai bằng MÀU/NỀN, không bằng chiều cao. */
  it("không nút nào bị GỌT xuống dưới sàn 56px", () => {
    const heights = [...src.matchAll(/min-h-\[(\d+(?:\.\d+)?)rem\]/g)].map((m) =>
      Number(m[1]),
    );
    expect(heights.length).toBeGreaterThan(3); // regex còn khớp được thật
    /* 3–3.5rem = "định làm nút to, rồi gọt xuống dưới sàn cho bớt nổi" — đúng
       khuôn lỗi cần chặn. Chip nhỏ (<3rem) là thành phần khác, không đụng. */
    const shaved = heights.filter((h) => h >= 3 && h < 3.5);
    expect(shaved, `tap target bị gọt: ${shaved.join(" · ")}rem`).toEqual([]);
  });
});

/* ── "ĐÃ ĐĂNG NHẬP CHƯA" CHỈ CÓ MỘT CÂU TRẢ LỜI ───────────────────────────────
   (2026-08-02h — lỗi CHẶN, một gốc đẻ ra bốn triệu chứng.)

   `useAuthUser().user` là phiên Supabase, mà `/login` và `/dang-ky` cấp chuỗi
   cứng xong là `signOut()` ngay ⇒ `user` null VĨNH VIỄN trên mọi máy ngư dân.
   Mọi chỗ rẽ nhánh theo nó đối xử với người ĐANG đăng nhập như khách vãng lai:
     · sheet Tài khoản giấu nút Đăng xuất + Đổi mật khẩu — tức xoá mất đường ra
       hợp lệ DUY NHẤT của bà con;
     · nhịp "đã mở app" không chạy ⇒ hạng không bao giờ về ⇒ màn dự báo cá kẹt
       "đang kiểm tra" vĩnh viễn, khách trả tiền chỉ tải được 3 ngày;
     · `/tien` khoá nút đăng tin;
     · thông báo nhắm riêng không gắn được vào tài khoản.

   Câu trả lời đúng là `signedIn` (phiên HOẶC chuỗi cứng).

   ⚠️ QUÉT THEO DÒNG, KHÔNG QUÉT ĐA DÒNG. Bản đầu của cổng này dùng một regex
   trải nhiều dòng (`\{([^}]*)\}\s*=\s*useAuthUser\(`) và nó ĂN NHẦM dấu `}` của
   khối import phía trên ⇒ bắt trượt `use-tier.ts` mà vẫn XANH. Đúng khuôn "bộ dò
   chết mà cổng vẫn xanh" mà file này đã cảnh báo ở trên. Nay quét từng dòng, và
   có ca đối chứng bắt buộc bộ dò phải chứng minh nó còn sống. */
const DONG_LAY_USER = /^\s*const\s*\{[^}]*\buser\b[^}]*\}\s*=\s*useAuthUser\(/;

describe("chỉ MỘT câu trả lời cho 'đã đăng nhập chưa'", () => {
  /*  Ba chỗ CÒN ĐƯỢC cầm `user`, kèm lý do — thêm tên vào đây phải có lý do thật:
      · `use-auth.ts`      — chính nó dựng ra `signedIn`
      · `use-tier.ts`      — bắc cầu `hasUser = !!user || tokenPresent`
      · `doi-mat-khau`     — `auth.updateUser` BẮT BUỘC cần phiên thật
      · `quan-tri`         — web quản trị giữ nguyên phiên Supabase (cố ý)
      · `hero-account.tsx` — chỉ đọc `user_metadata.full_name` để hiện tên */
  const CO_LY_DO = [
    join("src", "lib", "use-auth.ts"),
    join("src", "lib", "use-tier.ts"),
    join("src", "app", "doi-mat-khau", "page.tsx"),
    join("src", "app", "quan-tri", "page.tsx"),
    join("src", "components", "hero-account.tsx"),
  ];

  it("bộ dò CÒN SỐNG — mẫu xấu phải bị bắt, mẫu sạch không báo oan", () => {
    expect(
      DONG_LAY_USER.test("  const { user, ready } = useAuthUser();"),
    ).toBe(true);
    expect(
      DONG_LAY_USER.test("  const { user, phone, ready, signedIn } = useAuthUser();"),
    ).toBe(true);
    expect(
      DONG_LAY_USER.test("  const { signedIn, ready } = useAuthUser();"),
    ).toBe(false);
    expect(DONG_LAY_USER.test("  const { phone, ready } = useAuthUser();")).toBe(
      false,
    );
  });

  it("không file nào ngoài danh sách có lý do được cầm `user`", () => {
    const pham: string[] = [];
    for (const file of sourceFilesUnder(SRC)) {
      const rel = file.slice(process.cwd().length + 1);
      if (CO_LY_DO.includes(rel)) continue;
      const lines = readFileSync(file, "utf8").split("\n");
      if (lines.some((l) => DONG_LAY_USER.test(l))) pham.push(rel);
    }
    expect(
      pham,
      `phải hỏi \`signedIn\` (phiên HOẶC chuỗi cứng), không hỏi \`user\`: ${pham.join(" · ")}`,
    ).toEqual([]);
  });

  it("`useAuthUser` thật sự tính `signedIn` từ CẢ chuỗi cứng", () => {
    const src = stripComments(
      readFileSync(join(SRC, "lib", "use-auth.ts"), "utf8"),
    );
    expect(src).toMatch(/signedIn:\s*!!user \|\| hasToken/);
    expect(
      src,
      "không nghe kho chuỗi đổi ⇒ đăng nhập xong màn không vẽ lại",
    ).toContain("TOKEN_STORE_EVENT");
  });
});
