// KÉO MẪU CÂU NÓI SEN BIỂN về kho huấn luyện (migration 0059, lib/sen-bien/mau-hoc.ts).
//
//   node scripts/sen-bien-keo-mau.mjs <ra.jsonl>
//
// Cần NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (env hoặc .env.local). Chạy lại là
// kéo TIẾP từ mốc lần trước (file <ra.jsonl>.moc), nối thêm vào cuối — không kéo trùng.
//
// Mỗi dòng JSONL = một mẫu, kèm hai trường suy ra để thầy chấm nhãn / huấn luyện dùng ngay:
//   · `noi_lai`  — câu kế tiếp CÙNG phiên, nói trong vòng 20 s sau một câu máy KHÔNG làm được
//                  việc (say/cancel/pick): nhiều khả năng bà con nói lại vì máy hiểu sai.
//   · `nghi_sai` — true khi có `noi_lai`. Không phải nhãn chắc chắn — là chỗ đáng chấm trước.
// Lô cuối của một lần kéo có thể cắt ngang một phiên: câu đầu phiên ở lần kéo sau thì
// không ghép được — chấp nhận, mất vài cặp không đáng một bước đọc lại.
//
// Dữ liệu ra là của bà con: để NGOÀI repo (kho huấn luyện, gpu-desktop), không commit.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { loadEnv, makeRest } from "./test-account.mjs";

const NOI_LAI_MS = 20_000;
const KHONG_XONG = new Set(["say", "cancel", "pick"]);
const TRANG = 1000;

/** Ghép câu nói lại trong cùng phiên. Thuần — `ds` đã xếp theo thời gian nói. */
export function ghepNoiLai(ds) {
  const theoPhien = new Map();
  for (const m of ds) {
    const a = theoPhien.get(m.phien) ?? [];
    a.push(m);
    theoPhien.set(m.phien, a);
  }
  const ra = [];
  for (const a of theoPhien.values()) {
    a.sort((x, y) => Date.parse(x.noi_luc) - Date.parse(y.noi_luc));
    a.forEach((m, i) => {
      const sau = a[i + 1];
      const lai =
        sau && KHONG_XONG.has(m.tra) && Date.parse(sau.noi_luc) - Date.parse(m.noi_luc) <= NOI_LAI_MS ? sau.cau : null;
      ra.push({ ...m, noi_lai: lai, nghi_sai: lai != null });
    });
  }
  return ra.sort((x, y) => Date.parse(x.nhan_luc) - Date.parse(y.nhan_luc) || x.id.localeCompare(y.id));
}

async function main() {
  const out = process.argv[2];
  if (!out) {
    console.error("Dùng: node scripts/sen-bien-keo-mau.mjs <ra.jsonl>");
    process.exit(1);
  }
  const rest = makeRest(loadEnv());
  const mocFile = `${out}.moc`;
  let moc = existsSync(mocFile) ? readFileSync(mocFile, "utf8").trim() : "1970-01-01T00:00:00Z";
  const cot = "id,noi_luc,nhan_luc,phien,cau,tra,ct,gemma,xn,chay,nen,ban,nguoi";
  let tong = 0;
  for (;;) {
    const ds = await rest.get(
      `sen_bien_mau?select=${cot}&nhan_luc=gt.${encodeURIComponent(moc)}&order=nhan_luc.asc,id.asc&limit=${TRANG}`,
    );
    if (!ds?.length) break;
    // nhan_luc cùng một lô trùng nhau ⇒ cắt trang ở ranh lô cuối, lô đó kéo ở vòng sau cho đủ
    const cuoi = ds[ds.length - 1].nhan_luc;
    const tron = ds.length === TRANG ? ds.filter((m) => m.nhan_luc !== cuoi) : ds;
    const lay = tron.length ? tron : ds; // cả trang một mốc: không xảy ra (một lô ≤ 100 mẫu)
    appendFileSync(out, ghepNoiLai(lay).map((m) => JSON.stringify(m)).join("\n") + "\n");
    moc = lay[lay.length - 1].nhan_luc;
    writeFileSync(mocFile, moc);
    tong += lay.length;
    if (ds.length < TRANG) break;
  }
  console.log(`Kéo ${tong} mẫu mới → ${out} (mốc ${moc})`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  });
}
