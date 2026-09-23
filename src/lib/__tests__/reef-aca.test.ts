/**
 * BỘ RẠN VẼ LẠI TỪ NGUỒN ĐỘC LẬP — cổng nghiệm thu trên FILE THẬT.
 *
 * public/data/reef-shapes-aca.v1.bin do scripts/generate-reef-shapes-aca.mjs
 * sinh từ Allen Coral Atlas + UNEP-WCMC (cả hai CC BY 4.0), rồi
 * scripts/encode-reef-shapes.mjs đóng sang khuôn nhị phân delta+varint
 * (src/lib/reef-bin.mjs) để lọt trần 20 MB/file của hook. Lý do nó tồn tại là
 * để THAY được bộ OSM (ODbL, có share-alike, không bán licence được). Nên bốn
 * điều dưới đây không phải "kiểm tra cho đủ" mà là ĐỊNH NGHĨA của việc đó:
 *
 *   (1) không một chữ Hán, không một trường tên nào — chủ dự án cấm tuyệt đối;
 *   (2) toạ độ nằm trong khung biển VN;
 *   (3) MỌI đối tượng mang lý lịch nguồn HỢP LỆ và KHÔNG đối tượng nào ghi
 *       nguồn OSM — một đối tượng lọt nguồn ODbL là cả gói lại dính share-alike
 *       (xem `isCleanLicense` trong src/lib/provenance.ts);
 *   (4) phủ VEN BỜ phải ≥ bộ OSM — đây là chỗ bộ OSM mỏng nhất (đo 2026-08-29:
 *       vịnh Nha Trang OSM có 1 hình, WCMC có 7, và hình OSM đó cách rạn WCMC
 *       gần nhất 11,2 km). Vẽ lại mà vẫn thủng đúng chỗ đó thì vô nghĩa.
 *
 * Cổng chạy trên file thật, KHÔNG trên fixture: thứ gửi tới máy bà con là file
 * này, và script sinh nó chỉ chạy khi có người gọi tay.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { decodeReefShapes } from "@/lib/reef-bin.mjs";
import {
  validateProvenance,
  sourcesOf,
  isCleanLicense,
  type Provenance,
} from "@/lib/provenance";

type Ring = [number, number][];
type Feature = {
  properties: { kind?: string; prov?: Provenance } & Record<string, unknown>;
  geometry: { type: string; coordinates: Ring[][] | Ring[] | Ring };
};

const ACA_FILE = path.join(process.cwd(), "public/data/reef-shapes-aca.v1.bin");
const OSM_FILE = path.join(process.cwd(), "public/data/reef-shapes.v1.json");

const aca = decodeReefShapes(readFileSync(ACA_FILE)) as unknown as {
  properties: Record<string, unknown>;
  features: Feature[];
};
/*  Bản đã giải mã đem về CHỮ để quét chủ quyền + trường tên. Khuôn nhị phân chỉ
    chứa chữ ở header (properties + bảng kinds + bảng provs) — toạ độ là số
    thuần — nên chuỗi này phủ đúng bằng phần văn bản của file, không thiếu chỗ
    nào có thể giấu một cái tên. Quét thẳng byte của file .bin thì ngược lại:
    varint sẽ tình cờ ghép ra chuỗi vô nghĩa và cổng báo oan.  */
const rawAca = JSON.stringify(aca);

/** Khung biển VN dùng khi sinh dữ liệu (scripts/generate-reef-shapes-aca.mjs). */
const [W, S, E, N] = [102, 4, 118, 24];

/**
 * Ven bờ = kinh độ < 110°Đ: vùng biển ven bờ đất liền + vịnh Thái Lan, tách hẳn
 * khỏi Hoàng Sa (111–113°Đ) và Trường Sa (111,5–117,5°Đ). Ranh giới này là một
 * đường kinh tuyến chứ không phải khoảng cách tới bờ — cố ý: không có đường bờ
 * nào trong repo mà KHÔNG phải dữ liệu OSM, mà cổng này không được phụ thuộc
 * vào thứ nó đang tìm cách thay.
 */
const COASTAL_LON = 110;

/** Mảnh đa giác của một feature — bộ OSM 1 mảnh/feature, bộ mới gom MultiPolygon. */
function partsOf(g: Feature["geometry"]): Ring[][] {
  if (g.type === "MultiPolygon") return g.coordinates as Ring[][];
  if (g.type === "Polygon") return [g.coordinates as Ring[]];
  if (g.type === "LineString") return [[g.coordinates as Ring]];
  return [[[g.coordinates as unknown as [number, number]]]];
}

function partCentroid(part: Ring[]): [number, number] {
  let x = 0;
  let y = 0;
  let n = 0;
  for (const p of part[0]) {
    x += p[0];
    y += p[1];
    n++;
  }
  return [x / n, y / n];
}

function countCoastalParts(feats: Feature[]): number {
  let n = 0;
  for (const f of feats) {
    for (const part of partsOf(f.geometry)) {
      if (partCentroid(part)[0] < COASTAL_LON) n++;
    }
  }
  return n;
}

describe("bộ rạn vẽ lại (ACA + WCMC) — chủ quyền & sạch tên", () => {
  it("không một ký tự Hán/Nhật/Hàn nào trong file", () => {
    // Dùng thuộc tính Unicode thay vì dán dải ký tự vào mã nguồn: bộ quét tên
    // (scripts/audit-names.mjs) coi MỌI chữ Hán trong src/ là vi phạm, kể cả
    // trong chú thích — một cổng không được tự làm bẩn thứ nó canh.
    const m = rawAca.match(
      /\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}/u,
    );
    expect(m?.[0] ?? null).toBeNull();
  });

  it("không feature nào mang trường tên — chỉ `kind` + `prov`", () => {
    const bad = aca.features.filter((f) => {
      const keys = Object.keys(f.properties).sort();
      return keys.length !== 2 || keys[0] !== "kind" || keys[1] !== "prov";
    });
    expect(bad.map((f) => Object.keys(f.properties))).toEqual([]);
  });

  it("không chuỗi nào trong file trông như một trường tên", () => {
    // ACA có `class_name` (tiếng Anh), WCMC có `name`/`orig_name`/`species`.
    // Script chỉ kéo `objectid` và bỏ hết, nhưng cổng phải chặn cả khi ai đó
    // sửa script rồi quên — grep thô trên chuỗi đã ghi là cách kiểm rẻ nhất.
    const leaked = ['"name"', '"orig_name"', '"class_name"', '"species"'].filter((k) =>
      rawAca.includes(k),
    );
    expect(leaked).toEqual([]);
  });

  it("mỗi feature có kind hợp lệ và hình đa giác", () => {
    const bad = aca.features.filter(
      (f) =>
        !["reef", "shoal"].includes(f.properties.kind ?? "") ||
        !["Polygon", "MultiPolygon"].includes(f.geometry.type),
    );
    expect(bad.length).toBe(0);
    expect(aca.features.length).toBeGreaterThan(0);
  });
});

describe("bộ rạn vẽ lại — toạ độ nằm trong khung biển VN", () => {
  it("không một đỉnh nào ra ngoài khung", () => {
    let outside = 0;
    let verts = 0;
    for (const f of aca.features) {
      for (const part of partsOf(f.geometry)) {
        for (const ring of part) {
          for (const [x, y] of ring) {
            verts++;
            if (x < W || x > E || y < S || y > N) outside++;
          }
        }
      }
    }
    expect(outside).toBe(0);
    // Chốt sàn số đỉnh: một file rỗng/hỏng cũng cho outside=0.
    expect(verts).toBeGreaterThan(100_000);
  });
});

describe("bộ rạn vẽ lại — lý lịch nguồn sạch giấy phép", () => {
  it("mọi đối tượng có lý lịch HỢP LỆ", () => {
    const problems: string[] = [];
    aca.features.forEach((f, i) => {
      const errs = validateProvenance(f.properties.prov);
      if (errs.length) problems.push(`#${i}: ${errs.join("; ")}`);
    });
    expect(problems.slice(0, 10)).toEqual([]);
  });

  it("KHÔNG đối tượng nào ghi nguồn OSM", () => {
    const withOsm = aca.features.filter((f) =>
      sourcesOf(f.properties.prov as Provenance).includes("osm"),
    );
    expect(withOsm.length).toBe(0);
  });

  it("mọi đối tượng phát hành lại được (không dính share-alike)", () => {
    // Đây là lý do cả bộ tồn tại: `cleanPackage` phải giữ lại 100%.
    const dirty = aca.features.filter(
      (f) => !isCleanLicense(f.properties.prov as Provenance),
    );
    expect(dirty.length).toBe(0);
  });

  it("chỉ dùng hai nguồn đã khai: ACA và WCMC", () => {
    const seen = new Set<string>();
    for (const f of aca.features) {
      for (const s of sourcesOf(f.properties.prov as Provenance)) seen.add(s);
    }
    expect([...seen].sort()).toEqual(["aca", "wcmc"]);
  });
});

describe("bộ rạn vẽ lại — phủ ven bờ so bộ OSM", () => {
  it("ven bờ (<110°Đ) có ÍT NHẤT bằng số mảnh của bộ OSM", () => {
    const osm = JSON.parse(readFileSync(OSM_FILE, "utf8")) as { features: Feature[] };
    const osmShapes = osm.features.filter((f) =>
      ["reef", "shoal"].includes((f.properties.kind as string) ?? ""),
    );
    const osmCoastal = countCoastalParts(osmShapes);
    const acaCoastal = countCoastalParts(aca.features);
    expect(
      acaCoastal,
      `Bộ mới có ${acaCoastal} mảnh ven bờ, bộ OSM có ${osmCoastal}.` +
        " Ít hơn nghĩa là vẽ lại xong vẫn thủng đúng chỗ nguy hiểm nhất.",
    ).toBeGreaterThanOrEqual(osmCoastal);
  });
});
