/**
 * LỚP BÁO HIỆU HÀNG HẢI VIỆT NAM — kiểm trên FILE THẬT.
 *
 * `public/data/vn-aids.v1.json` do `scripts/generate-vn-aids.mjs` kéo từ trang
 * công bố của Cục Hàng hải Việt Nam. Script đó có cổng tự kiểm, nhưng cổng chỉ
 * chạy KHI ai đó chạy script — mà file thì nằm trong repo và đi thẳng ra máy
 * bà con. Bộ test này chạy mỗi `npm test`, kiểm đúng cái file sắp phát:
 *
 *   1. không một ký tự Hán/CJK nào lọt (chủ quyền)
 *   2. mọi toạ độ nằm trong khung biển VN
 *   3. luồng Hải Phòng ≥ 100 báo hiệu (mốc nhà nước công bố: 120 phao + 45
 *      đăng tiêu — dưới 100 nghĩa là bóc hỏng, không phải "nguồn ít dữ liệu")
 *   4. mọi đối tượng có lý lịch nguồn hợp lệ theo `src/lib/provenance.ts`
 *   5. giải mã được bằng CHÍNH `decodeSeamarks()` của `src/lib/seamarks.ts` —
 *      đây là bằng chứng file khớp kiểu `Seamark` đang có, không đẻ kiểu mới
 *
 * Đọc file bằng `node:fs` chứ không `fetch`: test phải soi đúng byte trong
 * repo, không phụ thuộc server hay mạng.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  decodeSeamarks,
  describeSeamark,
  SEAMARK_LABEL,
  type Seamark,
  type SeamarkType,
} from "@/lib/seamarks";
import {
  LICENSES,
  SOURCES,
  validateProvenance,
  type LicenseId,
  type Provenance,
} from "@/lib/provenance";

/** Khung biển VN (Nam, Tây, Bắc, Đông) — GIỐNG script sinh file. */
const VN_BBOX = { s: 4, w: 102, n: 24, e: 118 };

/** Chữ Hán/CJK — cùng lớp ký tự với cổng trong `scripts/generate-*.mjs`. */
const CJK = /[⺀-⻿　-〿㐀-䶿一-鿿豈-﫿]/;

type Route = {
  /** số ID trang ENC (nguồn A) hoặc khoá `tbhh-<n>` (nguồn B) */
  id: number | string;
  ten: string;
  noi: string;
  so: number;
  /** chỉ nguồn B: LẬP · ĐỔI · NÊU · NGƯNG (xem generate-vn-aids.mjs) */
  tinhTrang?: string;
  prov: Provenance;
};

type AidFile = {
  v: number;
  nguon: string;
  nhan: string;
  layNgay: string;
  giayPhep: { trangThai: string; giayPhepId: string; ghiChu: string };
  types: string[];
  chars: string[];
  groups: string[];
  colours: string[];
  names: string[];
  purposes: string[];
  routes: Route[];
  thieuBang: { id: number; ten: string; lyDo: string }[];
  marks: number[][];
};

const FILE = path.join(process.cwd(), "public", "data", "vn-aids.v1.json");
const RAW = readFileSync(FILE, "utf8");
const DATA = JSON.parse(RAW) as AidFile;

/** Vị trí ba cột thêm ở cuối hàng (chín cột đầu là khuôn `seamarks.v1.json`). */
const COL_ROUTE = 9;
const COL_NAME = 10;
const COL_PURPOSE = 11;

describe("vn-aids: cổng chủ quyền", () => {
  it("không một ký tự Hán/CJK nào trong toàn bộ file", () => {
    const hit = RAW.match(new RegExp(CJK.source, "g"));
    expect(hit, `còn ký tự Hán: ${[...new Set(hit ?? [])].join("")}`).toBeNull();
  });

  it("cổng CJK của test này KHÔNG rỗng — nhận ra chữ Hán mẫu", () => {
    // Một regex viết hỏng vẫn "xanh" mọi lần và im lặng cho mọi thứ lọt. Ký tự
    // thử dựng từ mã điểm để bản thân file test không chứa chữ Hán.
    expect(CJK.test(String.fromCodePoint(0x6d77))).toBe(true);
    expect(CJK.test("Phao 5 · Tiêu HN1")).toBe(false);
  });
});

describe("vn-aids: hình dạng file", () => {
  it("có đủ bảng tra và ít nhất một tuyến, một báo hiệu", () => {
    expect(DATA.v).toBe(1);
    for (const key of [
      "types", "chars", "groups", "colours", "names", "purposes", "marks", "routes",
    ] as const) {
      expect(Array.isArray(DATA[key]), `thiếu bảng ${key}`).toBe(true);
    }
    expect(DATA.marks.length).toBeGreaterThan(0);
    expect(DATA.routes.length).toBeGreaterThan(0);
  });

  it("mang nhãn 'tham khảo, đối chiếu Thông báo hàng hải'", () => {
    // Nguồn KHÔNG ghi ngày cập nhật. Bỏ nhãn này đi là app ngầm hứa một mức
    // chính xác mà nguồn không bảo đảm — điều dự án cấm.
    expect(DATA.nhan).toMatch(/tham khảo/i);
    expect(DATA.nhan).toMatch(/thông báo hàng hải/i);
  });

  it("ghi đúng giấy phép: số liệu nhà nước công bố công khai", () => {
    // Điều 15 Luật SHTT loại "văn bản hành chính" và "số liệu" khỏi bảo hộ
    // quyền tác giả. Không viết câu dè chừng cho nhóm này — nhưng PHẢI giữ
    // đúng mã giấy phép để `cleanPackage()` của provenance.ts đọc được.
    expect(DATA.giayPhep.giayPhepId).toBe("vn-official");
    expect(LICENSES[DATA.giayPhep.giayPhepId as LicenseId].redistributable).toBe(true);
    expect(DATA.giayPhep.ghiChu).toMatch(/tham khảo/i);
  });

  it("mỗi hàng có đủ 12 cột, chỉ số bảng tra đều nằm trong tầm", () => {
    for (const row of DATA.marks) {
      expect(row).toHaveLength(12);
      expect(DATA.types[row[2]]).toBeTypeOf("string");
      expect(DATA.routes[row[COL_ROUTE]]).toBeTruthy();
      expect(DATA.names[row[COL_NAME]]).toBeTypeOf("string");
      // Tác dụng có thể trống (-1); tên và loại thì KHÔNG.
      if (row[COL_PURPOSE] >= 0) {
        expect(DATA.purposes[row[COL_PURPOSE]]).toBeTypeOf("string");
      }
    }
  });
});

describe("vn-aids: toạ độ", () => {
  it("mọi toạ độ hữu hạn và nằm trong khung biển VN", () => {
    const bad = DATA.marks.filter(
      ([lon, lat]) =>
        !Number.isFinite(lon) ||
        !Number.isFinite(lat) ||
        lat < VN_BBOX.s ||
        lat > VN_BBOX.n ||
        lon < VN_BBOX.w ||
        lon > VN_BBOX.e,
    );
    expect(
      bad,
      `ngoài khung VN: ${bad.slice(0, 5).map((m) => `[${m[0]},${m[1]}]`).join(", ")}`,
    ).toHaveLength(0);
  });

  it("không có hai báo hiệu trùng khít toạ độ trong CÙNG một tuyến", () => {
    // Trùng khít trong cùng luồng = dấu hiệu bóc lặp dòng (bắt nhầm bảng bọc
    // ngoài), không phải dữ liệu thật: hai phao không thả chồng lên nhau.
    const seen = new Set<string>();
    const dup: string[] = [];
    for (const row of DATA.marks) {
      const key = `${row[COL_ROUTE]}:${row[0]},${row[1]}`;
      if (seen.has(key)) dup.push(key);
      seen.add(key);
    }
    expect(dup, `trùng: ${dup.slice(0, 5).join(" | ")}`).toHaveLength(0);
  });
});

describe("vn-aids: đủ dữ liệu ở luồng thật", () => {
  it("luồng Hải Phòng có ít nhất 100 báo hiệu", () => {
    const i = DATA.routes.findIndex((r) => /hải phòng/i.test(r.ten));
    expect(i, "không tìm thấy tuyến luồng Hải Phòng").toBeGreaterThanOrEqual(0);
    const count = DATA.marks.filter((m) => m[COL_ROUTE] === i).length;
    expect(count).toBeGreaterThanOrEqual(100);
    // `so` do script ghi phải khớp số hàng thật — lệch là file bị sửa tay.
    expect(DATA.routes[i].so).toBe(count);
  });

  it("phủ nhiều hơn một tỉnh — không dồn hết vào một cửa biển", () => {
    const lats = DATA.marks.map((m) => m[1]);
    expect(Math.max(...lats) - Math.min(...lats)).toBeGreaterThan(2);
  });
});

describe("vn-aids: lý lịch nguồn", () => {
  it("mọi đối tượng có lý lịch nguồn hợp lệ, KHÔNG trừ trường hợp nào", () => {
    // Cả `vinamarine` lẫn `tbhh` đã đăng ký trong `SOURCES`, nên ở đây không
    // còn ngoại lệ nào được bỏ qua: một lỗi là một lỗi.
    for (const row of DATA.marks) {
      const route = DATA.routes[row[COL_ROUTE]];
      const errs = validateProvenance(route.prov);
      expect(errs, `${route.ten}: ${errs.join(" · ")}`).toHaveLength(0);
    }
  });

  it("hai nguồn đều là số liệu nhà nước VN, phát hành lại được", () => {
    for (const route of DATA.routes) {
      const src = SOURCES[route.prov.origin.source];
      expect(src, `nguồn lạ: ${route.prov.origin.source}`).toBeTruthy();
      expect(LICENSES[src.license].redistributable).toBe(true);
      expect(route.prov.origin.at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("nguồn A: URL trỏ đúng ID trang tuyến luồng — tra lại được", () => {
    const enc = DATA.routes.filter((r) => r.prov.origin.source === "vinamarine");
    expect(enc.length).toBeGreaterThan(0);
    for (const route of enc) {
      expect(route.prov.origin.url).toBe(
        `https://enc.vinamarine.gov.vn/ChiTietTuyenLuong.aspx?ID=${route.id}`,
      );
    }
  });

  it("nguồn B: mỗi tin có SỐ HIỆU hoặc URL để tra lại tận gốc", () => {
    // Thông báo hàng hải là văn bản có số hiệu; mất số hiệu thì bà con (hay
    // cán bộ cảng vụ) không đối chiếu lại được, và cả lớp thành lời nói suông.
    const tb = DATA.routes.filter((r) => r.prov.origin.source === "tbhh");
    expect(tb.length).toBeGreaterThan(0);
    for (const route of tb) {
      const o = route.prov.origin as { version?: string; url?: string };
      expect(Boolean(o.version || o.url), `${route.ten}: không số hiệu, không URL`).toBe(
        true,
      );
      expect(["LẬP", "ĐỔI", "NÊU", "NGƯNG"]).toContain(route.tinhTrang);
    }
  });
});

describe("vn-aids: khớp kiểu Seamark của src/lib/seamarks.ts", () => {
  const marks: Seamark[] = decodeSeamarks(DATA);

  it("decodeSeamarks đọc được TRỌN file, không rơi hàng nào", () => {
    // `decodeSeamarks` bỏ qua hàng hỏng thay vì ném — nên số lượng bằng nhau
    // chính là bằng chứng mọi hàng đúng khuôn `Seamark`.
    expect(marks).toHaveLength(DATA.marks.length);
  });

  it("mọi loại báo hiệu đều có nhãn tiếng Việt sẵn (không rơi về nhãn chung)", () => {
    const unknown = [
      ...new Set(marks.map((m) => m.type).filter((t) => !(t in SEAMARK_LABEL))),
    ];
    expect(unknown, `loại chưa có nhãn: ${unknown.join(", ")}`).toHaveLength(0);
  });

  it("mọi báo hiệu mô tả được bằng tiếng Việt, không lộ chữ tiếng Anh thô", () => {
    for (const m of marks) {
      const line = describeSeamark(m);
      expect(line.startsWith(SEAMARK_LABEL[m.type as SeamarkType])).toBe(true);
      // Đặc tính đèn/màu là mã hải đồ tiếng Anh trong file; nếu chúng lọt
      // NGUYÊN VĂN ra câu mô tả nghĩa là bảng dịch không nhận ra mã đó.
      expect(line).not.toMatch(/\b(Fl|LFl|Iso|Oc|VQ|Mo)\b/);
      expect(line).not.toMatch(/\b(white|red|green|yellow)\b/i);
    }
  });

  it("đặc tính đèn bóc được đều dựng thành câu (không có mã đèn câm)", () => {
    const lit = marks.filter((m) => m.light?.character);
    expect(lit.length).toBeGreaterThan(0);
    for (const m of lit) {
      // Có mã đặc tính mà `describeLight` không nói được câu nào ⇒ mã nằm
      // ngoài bảng của seamarks.ts ⇒ script sinh file đang ghi từ vựng lạ.
      expect(describeSeamark(m).split(" · ").length).toBeGreaterThan(1);
    }
  });
});

describe("vn-aids: tuyến chưa có bảng báo hiệu", () => {
  it("ghi lại tuyến nguồn CÓ nhưng KHÔNG có bảng, để app không nói dối", () => {
    // Vẽ 0 phao ở luồng Định An trong khi nhà nước công bố 118 phao thì bà con
    // đọc thành "luồng này không có phao". Danh sách này để app nói đúng:
    // "chưa có dữ liệu", chứ không phải "không có báo hiệu".
    expect(Array.isArray(DATA.thieuBang)).toBe(true);
    expect(DATA.thieuBang.some((r) => /định an/i.test(r.ten))).toBe(true);
    const withTable = new Set(DATA.routes.map((r) => r.id));
    for (const r of DATA.thieuBang) expect(withTable.has(r.id)).toBe(false);
    // "Không có bảng" phải kèm LÝ DO cụ thể. Ghi trống là lần sau lại có người
    // đi dò lại từ đầu xem vì sao thiếu — đã mất công đúng vì chuyện đó.
    for (const r of DATA.thieuBang) {
      expect(r.lyDo, `${r.ten}: thiếu lý do`).toBeTruthy();
      expect(r.lyDo.length).toBeGreaterThan(20);
    }
  });
});

describe("vn-aids: miền Nam KHÔNG được rỗng", () => {
  /* Bản trước có 437 báo hiệu mà KHÔNG một cái nào dưới 15°B: cổng thông tin
     ENC của Cục Hàng hải mới nhập phần miền Bắc. Nửa nước có đội tàu đông nhất
     hiện ra trên bản đồ y hệt vùng "không có báo hiệu nào" — sai và nguy hiểm.
     Nguồn Thông báo hàng hải lấp chỗ đó; bộ test này giữ cho nó không tụt lại. */

  it("có báo hiệu ở phía nam 15°B", () => {
    // Sàn nâng 2026-09-02 (đợt phân xử trùng-tên: đo được 834 nam 15°B trên
    // tổng 1.447). Sàn là mốc KHÔNG ĐƯỢC TỤT — thấp hơn nghĩa là nguồn C
    // (sổ) rơi khỏi lần sinh lại, không phải dao động bình thường.
    const nam = DATA.marks.filter((m) => m[1] < 15);
    expect(nam.length).toBeGreaterThan(800);
  });

  it("phủ được cả cực nam (dưới 10°B)", () => {
    expect(DATA.marks.some((m) => m[1] < 10)).toBe(true);
  });

  it("có báo hiệu quanh cửa Vũng Tàu và ngoài khơi Cà Mau", () => {
    // Hai ô này chính là hai dòng `npm run kiem:ban-do` báo 0 trước khi sửa.
    const trong = (w: number, e: number, s: number, n: number) =>
      DATA.marks.filter((m) => m[0] > w && m[0] < e && m[1] > s && m[1] < n).length;
    expect(trong(107.01, 107.09, 10.28, 10.42), "cửa Vũng Tàu").toBeGreaterThan(0);
    expect(trong(105.26, 105.34, 8.63, 8.77), "ngoài khơi Cà Mau").toBeGreaterThan(0);
  });
});

describe("vn-aids: sổ AtoN 2016 là NỀN — có mặt, mang cờ tuổi, nhường nguồn mới", () => {
  /* Ba tầng của phương án gộp (docs/formaps/phuong-an-tu-chu-du-lieu.md §4-#2):
     sổ 2016 lấp 22 tuyến miền Nam mà cổng ENC chỉ công bố con số đếm, nhưng
     phao đổi theo nạo vét nên mọi tuyến gốc sổ PHẢI mang cờ tuổi — giao diện
     đọc cờ đó để nói "vị trí theo sổ 2016" thay vì hứa hơn cái sổ hứa. */
  type RouteSach = Route & { canhBaoTuoi?: string; encId?: number };
  const sach = (DATA.routes as RouteSach[]).filter(
    (r) => r.prov.origin.source === "vms-south-aton-list",
  );

  it("nguồn sổ có mặt và phủ các tuyến lớn miền Nam", () => {
    expect(sach.length).toBeGreaterThanOrEqual(20);
    for (const ten of [/định an/i, /soài rạp/i, /sài gòn/i, /quan chánh bố/i]) {
      expect(sach.some((r) => ten.test(r.ten)), `thiếu tuyến ${ten}`).toBe(true);
    }
  });

  it("MỌI tuyến gốc sổ mang cờ tuổi 'sổ 2016'", () => {
    for (const r of sach) {
      expect(r.canhBaoTuoi, `${r.ten}: thiếu canhBaoTuoi`).toBeTruthy();
      expect(r.canhBaoTuoi).toMatch(/sổ 2016/);
      expect(r.canhBaoTuoi).toMatch(/thông báo hàng hải/i);
    }
  });

  it("phân xử trùng-tên 2026-09-02 còn hiệu lực — số hiệu thật thay tên đợt", () => {
    /* Quyết định chủ dự án: "trùng tên thì verify từ nhiều nguồn, giữ 1 cái
       thôi" — thực thi từng ca (docs/research/gop-so-aton-2026-09.md §9):
       · 19 mục Đồng Nai mang tên đợt "QG151" tra RA số hiệu thật ở dòng kế
         của chính sổ (P002…, B004…) — tên phát hành phải mang mã đó, không
         còn hai mục cùng tên "Phao QG151" trần;
       · "Phao 1" Sông Dinh và "Phao 1" Sài Gòn – Vũng Tàu là HAI vật thật —
         cổng trùng-tên chỉ được chặn TRONG CÙNG TUYẾN. */
    expect(DATA.names.some((t) => /^Phao QG151 P\d/.test(t))).toBe(true);
    expect(DATA.names.some((t) => /^Tiêu QG151 B\d/.test(t))).toBe(true);
    expect(DATA.names.filter((t) => /QG151/.test(t) && !/QG151 [PB]\d/.test(t))).toEqual([]);
    // hai luồng Nha Trang của sổ (mục NORTH và SOUTH) là hai tuyến riêng
    const nhaTrang = sach.filter((r) => /nha trang/i.test(r.ten));
    expect(nhaTrang.length).toBe(2);
    // cặp cửa luồng hẹp được giữ CẢ HAI (án lệ Hà Tiên: Phao 1 và Phao 2
    // cách nhau ~141 m là hai phao hai mép luồng, không phải trùng lặp)
    const iHaTien = DATA.routes.findIndex(
      (r) => r.prov.origin.source === "vms-south-aton-list" && /hà tiên/i.test(r.ten),
    );
    const tenHaTien = DATA.marks
      .filter((m) => m[COL_ROUTE] === iHaTien)
      .map((m) => DATA.names[m[COL_NAME]]);
    expect(tenHaTien).toContain("Phao 1");
    expect(tenHaTien).toContain("Phao 2");
  });

  it("luồng Định An – Cần Thơ hết trắng: ≥100 báo hiệu (nhà nước công bố 118)", () => {
    // Đây đúng là ô "vài chục/118" mà việc gộp sổ phải lấp. Con số công bố
    // đọc từ ô "Số báo hiệu" trang ENC #33 (docs/research/san-so-dang-ky-2026-09.md §3).
    const iDinhAn = DATA.routes.findIndex(
      (r) => r.prov.origin.source === "vms-south-aton-list" && /định an/i.test(r.ten),
    );
    expect(iDinhAn).toBeGreaterThanOrEqual(0);
    const marks = DATA.marks.filter((m) => m[COL_ROUTE] === iDinhAn).length;
    // Cộng thêm phần Thông báo hàng hải đè quanh đó thì tổng vùng còn cao hơn;
    // sàn đặt trên riêng tuyến sổ: 111 đo được, chặn ở 100.
    expect(marks).toBeGreaterThanOrEqual(100);
  });

  it("sổ đã NHƯỜNG chỗ nguồn mới hơn — không có cặp sổ↔nguồn-khác chồng khít", () => {
    /* Luật gộp: sổ bỏ mọi điểm cách nguồn A/B dưới 150 m. Nếu một lần sinh
       lại làm mất luật đó thì bản đồ vẽ hai chấm chồng nhau — một 2016, một
       mới — và bà con không biết tin chấm nào. */
    const RAD = (d: number) => (d * Math.PI) / 180;
    const kmGiua = (aLo: number, aLa: number, bLo: number, bLa: number) => {
      const s =
        Math.sin(RAD(bLa - aLa) / 2) ** 2 +
        Math.cos(RAD(aLa)) * Math.cos(RAD(bLa)) * Math.sin(RAD(bLo - aLo) / 2) ** 2;
      return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(s)));
    };
    const sachIdx = new Set(
      DATA.routes
        .map((r, i) => [r, i] as const)
        .filter(([r]) => r.prov.origin.source === "vms-south-aton-list")
        .map(([, i]) => i),
    );
    const khac = DATA.marks.filter((m) => !sachIdx.has(m[COL_ROUTE]));
    const chong = DATA.marks
      .filter((m) => sachIdx.has(m[COL_ROUTE]))
      .filter((m) => khac.some((k) => kmGiua(k[0], k[1], m[0], m[1]) < 0.1));
    expect(
      chong.map((m) => `${DATA.names[m[COL_NAME]]} [${m[0]},${m[1]}]`),
    ).toEqual([]);
  });
});

describe("vn-aids: nguồn E — manh mối OSM đã XÁC MINH, chuỗi ODbL phải đứt", () => {
  /* Quy trình chốt 2026-09-02 (docs/formaps/phuong-an-tu-chu-du-lieu.md §1-#3,
     chạy lần đầu ở docs/research/osm-manh-moi-2026-09.md): OSM chỉ là MANH MỐI
     đi tìm; mục vào lớp phải có nguồn xác minh độc lập không-ODbL, và lý lịch
     ghi theo nguồn xác minh. OSM chỉ còn trong `crossChecks` — nếu nó xuất
     hiện ở `origin` thì cả lớp dính share-alike và `cleanPackage()` phải loại. */
  const xm = DATA.routes.filter((r) => String(r.id).startsWith("xm-"));

  it("có mặt — đường ống manh-mối-OSM còn được nối vào lần sinh", () => {
    // Vắng nghĩa là kho xac-minh.json rơi khỏi lần sinh lại (máy chưa chạy
    // scripts/osm-manh-moi.mjs) — cùng kiểu bệnh "nguồn rơi im lặng" mà cổng
    // chống-xoá-nhầm không bắt được vì lớp này còn nhỏ.
    expect(xm.length).toBeGreaterThanOrEqual(1);
  });

  it("KHÔNG một tuyến nào của cả lớp mang origin OSM/ODbL", () => {
    for (const r of DATA.routes) {
      expect(r.prov.origin.source, `${r.ten}: origin là OSM`).not.toBe("osm");
      const lic = LICENSES[SOURCES[r.prov.origin.source].license];
      expect(lic.shareAlike, `${r.ten}: origin dính share-alike`).toBe(false);
    }
  });

  it("mỗi tuyến xác minh mang crossCheck OSM đồng thuận vị trí, lệch trong bán kính dò", () => {
    for (const r of xm) {
      const cc = (r.prov.crossChecks ?? []).find((c) => c.source === "osm");
      expect(cc, `${r.ten}: thiếu crossCheck osm`).toBeTruthy();
      expect(cc!.agreed).toBe(true);
      // bán kính dò lớn nhất là 500 m (phao); lệch ghi phải nằm trong đó —
      // lớn hơn nghĩa là bộ so khớp hỏng chứ không phải "xác minh xa hơn".
      expect(cc!.offsetM).not.toBeNull();
      expect(cc!.offsetM!).toBeGreaterThanOrEqual(0);
      expect(cc!.offsetM!).toBeLessThanOrEqual(500);
    }
  });

  it("tuyến xác minh gốc sổ 2016 vẫn mang cờ tuổi, gốc TBHH vẫn mang trạng thái", () => {
    // Nghĩa vụ của nguồn xác minh đi theo mục được xác minh — không vì đi
    // đường manh mối mà một mục sổ 2016 thoát cờ "vị trí theo sổ 2016".
    for (const r of xm as (Route & { canhBaoTuoi?: string })[]) {
      if (r.prov.origin.source === "vms-south-aton-list") {
        expect(r.canhBaoTuoi, `${r.ten}: thiếu canhBaoTuoi`).toMatch(/sổ 2016/);
      }
      if (r.prov.origin.source === "tbhh") {
        expect(["LẬP", "ĐỔI", "NÊU", "NGƯNG"]).toContain(r.tinhTrang);
      }
    }
  });
});

describe("vn-aids: tên báo hiệu là ĐỊNH DANH, không phải mảnh toạ độ", () => {
  /* Bẫy đã cắn dự án một lần theo chiều ngược lại (`BL.1` đọc thành `81.1`).
     Ở nguồn Thông báo hàng hải, chiều nguy hiểm là một mảnh toạ độ vỡ trôi lên
     đầu dòng rồi hoá thành TÊN — "26A 1092649,8" dán lên bản đồ. */

  it("không tên nào chứa dấu độ hay chuỗi bốn chữ số liền", () => {
    const xau = DATA.names.filter((t) => /[°\u2032\u2033]/.test(t) || /\d{4}/.test(t));
    expect(xau, `tên hỏng: ${xau.slice(0, 5).join(" | ")}`).toHaveLength(0);
  });

  it("không tên nào là địa danh hành chính", () => {
    const xau = DATA.names.filter((t) =>
      /thành phố|^tỉnh |vùng biển|toạ độ|tọa độ/i.test(t),
    );
    expect(xau, `tên là địa danh: ${xau.slice(0, 5).join(" | ")}`).toHaveLength(0);
  });

  it("không đọc ra số hiệu thì NÓI THẲNG, không bịa", () => {
    // Im lặng gán một cái tên trông-như-thật là kiểu sai tệ nhất: bà con đối
    // chiếu với Thông báo hàng hải sẽ không tìm thấy và mất tin vào cả lớp.
    expect(DATA.names.some((t) => /chưa rõ số hiệu/i.test(t))).toBe(true);
  });
});

/*
  ĐÃ NỐI VÀO BẢN ĐỒ CHƯA (2026-09-02) — cổng cho lần TÁI PHÁT THỨ TƯ.

  774 báo hiệu nằm trong repo từ trước mà không dòng mã chạy nào đọc, sw.js
  không cache, bản đồ không vẽ — và bộ tự kiểm còn báo "sẽ thấy". Bốn lần cùng
  một bệnh thì không thể coi là tai nạn nữa: từ nay lớp dữ liệu nào vào repo
  cũng phải kèm cổng ba-mảnh này (component nạp · component vẽ · sw cache).
*/
import { readFileSync as _rf } from "node:fs";
import { join as _j } from "node:path";

describe("lớp báo hiệu chính thức phải được NỐI, không chỉ nằm trong repo", () => {
  const strip = (t: string) =>
    t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
  const doc = (p: string) => strip(_rf(_j(process.cwd(), p), "utf8"));

  it("component nạp và vẽ", () => {
    const v = doc("src/components/fishing-map-view.tsx");
    expect(v, "chưa gọi fetchVnAids").toContain("fetchVnAids(");
    expect(v, "chưa dựng nguồn geojson").toContain("vnAidGeo");
    expect(v, "chưa có lớp vẽ").toContain('id="vn-aid"');
  });

  it("chạm được — số hiệu và câu tác dụng của nhà nước phải tra được", () => {
    const v = doc("src/components/fishing-map-view.tsx");
    // từ 2026-09-03c lớp này có cluster nên push cả "vn-aid-cum" — chỉ canh phần đầu
    expect(v).toContain('ids.push("vn-aid"');
  });

  it("nằm trong vỏ SỐNG-CÒN — vào luồng ban đêm mất sóng vẫn thấy phao", () => {
    const sw = _rf(_j(process.cwd(), "public/sw.js"), "utf8");
    const critical = sw.slice(sw.indexOf("const CRITICAL_SHELL"), sw.indexOf("const SHELL"));
    expect(critical).toContain("/data/vn-aids.v1.json");
  });

  it("bộ giải mã đọc được file thật và giữ được phần nhà nước công bố", async () => {
    const { decodeVnAids } = await import("@/lib/vn-aids");
    const raw = JSON.parse(_rf(_j(process.cwd(), "public/data/vn-aids.v1.json"), "utf8"));
    const aids = decodeVnAids(raw);
    expect(aids.length).toBeGreaterThan(700);
    // phần mở rộng phải sống sót qua giải mã — thiếu nó thì thẻ chạm câm
    expect(aids.some((a) => a.ten)).toBe(true);
    expect(aids.some((a) => a.tacDung)).toBe(true);
    // -1 nghĩa là "nguồn không ghi" — không được tra ra phần tử bảng
    const { decodeVnAids: d2 } = await import("@/lib/vn-aids");
    const mot = d2({ v: 1, types: ["buoy_lateral"], marks: [[107, 10, 0, -1, -1, -1, 0, 0, -1, -1, -1, -1]] });
    expect(mot[0].light).toBeUndefined();
    expect(mot[0].ten).toBeNull();
  });
});
