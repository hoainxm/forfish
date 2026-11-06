// SINH TỪ CODE WEB (app-map 18 §5) — nhãn, vai, dock, SĐT, câu lỗi đăng nhập.
//
//   node native/scripts/sinh-vai-dock.mjs
//
// · commonMain/sinh/NhanSinh.kt — bảng NHAN (src/lib/labels.ts) + VAI (src/lib/vai.ts): native DÙNG THẲNG, không gõ lại
//   (luật "tên nhãn lấy từ labels.ts", CLAUDE.md nguyên tắc 8).
// · commonTest/sinh/GoldenVaiDock.kt — vector vào/ra của dockTheoVai, coBanDo, normalizeVnPhone, isValidVnPhone,
//   phoneToEmail, loginErrorMessage, tokenIssueErrorMessage: bản Kotlin phải ra y hệt.
// Đọc .ts bằng jiti (có sẵn trong node_modules) với alias "@" như vitest.config.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const goc = dirname(fileURLToPath(import.meta.url));
const repo = join(goc, "../..");
const jiti = createJiti(import.meta.url, { alias: { "@": join(repo, "src") } });

const { NHAN } = await jiti.import(join(repo, "src/lib/labels.ts"));
const { VAI, VAI_IDS, coBanDo } = await jiti.import(join(repo, "src/lib/vai.ts"));
const { dockTheoVai } = await jiti.import(join(repo, "src/lib/dock-nav.ts"));
const { normalizeVnPhone, isValidVnPhone, phoneToEmail } = await jiti.import(join(repo, "src/lib/phone.ts"));
const { loginErrorMessage, tokenIssueErrorMessage } = await jiti.import(join(repo, "src/lib/login-error.ts"));

const kt = (s) => JSON.stringify(s).replace(/\$/g, "\\$");
const DAU = "// SINH TỰ ĐỘNG bởi native/scripts/sinh-vai-dock.mjs từ code web — ĐỪNG SỬA TAY.\n";

// ── commonMain: nhãn + vai ──
const nhan = Object.entries(NHAN).map(([k, v]) => `        ${kt(k)} to ${kt(v)},`).join("\n");
const vai = VAI.map((v) => `        VaiThe(${kt(v.id)}, ${kt(v.ten)}, ${kt(v.phu)}),`).join("\n");
const main = `${DAU}package vn.sdvico.forfish.shared.sinh

/** = NHAN của src/lib/labels.ts. Lấy nhãn: \`NhanSinh.nhan("trangChu")\`. */
object NhanSinh {
    val NHAN: Map<String, String> = mapOf(
${nhan}
    )

    fun nhan(khoa: String): String = NHAN[khoa] ?: error("Không có nhãn \\"$khoa\\" trong labels.ts")

    /** = VAI của src/lib/vai.ts (thứ tự = thứ tự thẻ màn chọn vai). */
    val VAI: List<VaiThe> = listOf(
${vai}
    )
}

data class VaiThe(val id: String, val ten: String, val phu: String)
`;

// ── commonTest: vector ──
const vaiCo = [null, ...VAI_IDS];
const dock = [];
for (const v of vaiCo) for (const b of [true, false]) dock.push({ v, b, ra: dockTheoVai(v, b).map((m) => `${m.id}|${m.href}|${m.label}`) });
const banDo = [];
for (const v of vaiCo) for (const p of [true, false]) banDo.push({ v, p, ra: coBanDo(v, p) });
const sdt = ["0901234567", "84901234567", "+84 901 234 567", "901234567", "0123", "09012345678", "0101234567", ""].map((s) => ({
  s, chuan: normalizeVnPhone(s), hopLe: isValidVnPhone(s), email: phoneToEmail(s),
}));
const loi = [
  [{ code: "user_banned" }, null], [{ status: 429 }, true], [{ message: "Failed to fetch" }, null], [{ status: 502 }, null],
  [{ code: "invalid_credentials" }, false], [{ code: "invalid_credentials" }, true], [{ code: "invalid_credentials" }, null], [null, null],
].map(([e, x]) => ({ e, x, ra: loginErrorMessage(e, x) }));
const capLoi = ["login_required", "http_401", "revoke_failed", "issue_failed", "http_503", ""].map((c) => ({ c, ra: tokenIssueErrorMessage(c) }));

const opt = (v) => (v === null ? "null" : kt(v));
const test = `${DAU}package vn.sdvico.forfish.shared.sinh

internal object GoldenVaiDock {
    /** (vai, có bản đồ) → "id|href|label" theo thứ tự ô */
    val DOCK: List<Triple<String?, Boolean, List<String>>> = listOf(
${dock.map((d) => `        Triple(${opt(d.v)}, ${d.b}, listOf(${d.ra.map(kt).join(", ")})),`).join("\n")}
    )
    val CO_BAN_DO: List<Triple<String?, Boolean, Boolean>> = listOf(
${banDo.map((d) => `        Triple(${opt(d.v)}, ${d.p}, ${d.ra}),`).join("\n")}
    )
    /** (nhập, chuẩn hoá, hợp lệ, email) */
    val SDT: List<List<Any>> = listOf(
${sdt.map((d) => `        listOf(${kt(d.s)}, ${kt(d.chuan)}, ${d.hopLe}, ${kt(d.email)}),`).join("\n")}
    )
    /** (code, message, status, tồn tại?, câu) */
    val LOI_DANG_NHAP: List<List<Any?>> = listOf(
${loi.map((d) => `        listOf(${opt(d.e?.code ?? null)}, ${opt(d.e?.message ?? null)}, ${d.e?.status ?? "null"}, ${d.x === null ? "null" : d.x}, ${kt(d.ra)}),`).join("\n")}
    )
    val LOI_CAP_CHUOI: List<Pair<String, String>> = listOf(
${capLoi.map((d) => `        ${kt(d.c)} to ${kt(d.ra)},`).join("\n")}
    )
}
`;

const shared = join(goc, "../shared/src");
const raMain = join(shared, "commonMain/kotlin/vn/sdvico/forfish/shared/sinh/NhanSinh.kt");
const raTest = join(shared, "commonTest/kotlin/vn/sdvico/forfish/shared/sinh/GoldenVaiDock.kt");
for (const [p, s] of [[raMain, main], [raTest, test]]) {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, s);
  console.log(`[sinh-vai-dock] ${p}`);
}
