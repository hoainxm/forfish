// Xuất video hướng dẫn: .webm (Playwright quay) → .mp4 xem được trên điện thoại.
//
// Vì sao cần bước này: Playwright chỉ ghi WebM ở đúng cỡ viewport (402×874) —
// Zalo/Facebook/iPhone nhiều máy không mở được WebM, và cỡ đó chiếu lên màn hình
// thật trông vỡ chữ. Ở đây phóng ĐÚNG 3× (1206×2622 = pixel vật lý của iPhone
// 6,3") + H.264 + faststart (mở là chạy, không phải tải hết file).
// Quay ở 3× ngay từ đầu thì canvas WebGL của bản đồ quá nặng → treo (đã dính).
//
// Chạy:  npm run e2e:export            (tất cả video vừa quay)
//        npm run e2e:export -- 06      (chỉ video có số 06)
// Cần: ffmpeg trong PATH (winget install Gyan.FFmpeg).
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const IN_DIR = "test-reports/triage/e2e-output";
const OUT_DIR = "test-reports/videos";
const SCALE = 3;

/** Tên file xuất ra — đặt theo số thứ tự video, không theo tên thư mục dài của
 *  Playwright (có dấu tiếng Việt + băm ngẫu nhiên, bà con không đọc được). */
const NAMES = [
  [/01-thoi-tiet/, "1-thoi-tiet-bien"],
  [/02-ngu-truong/, "2-ban-do-ngu-truong"],
  [/03-dan-duong/, "3-dan-duong-tiet-kiem-dau"],
  [/04-canh-bao-thuyen-vien/, "4-so-thuyen-vien"],
  [/05-giao-dich/, "5-gia-ca-mua-ban"],
  [/06-cai-ve-may-android/, "6-cai-ve-may-android"],
  [/07-them-vao-man-hinh-ios/, "7-them-vao-man-hinh-iphone"],
];

function outName(dir) {
  for (const [re, name] of NAMES) if (re.test(dir)) return name;
  return dir.replace(/[^a-zA-Z0-9-]+/g, "-").slice(0, 60);
}

if (!existsSync(IN_DIR)) {
  console.error(`Chưa có video nào ở ${IN_DIR} — chạy "npm run e2e:videos" trước.`);
  process.exit(1);
}
if (spawnSync("ffmpeg", ["-version"], { shell: true }).status !== 0) {
  console.error("Không thấy ffmpeg trong PATH — cài: winget install Gyan.FFmpeg");
  process.exit(1);
}
mkdirSync(OUT_DIR, { recursive: true });

const filter = process.argv[2];
let done = 0;

for (const dir of readdirSync(IN_DIR)) {
  const src = join(IN_DIR, dir, "video.webm");
  if (!existsSync(src) || !statSync(src).isFile()) continue;
  if (filter && !dir.includes(filter)) continue;

  const out = join(OUT_DIR, `${outName(dir)}.mp4`);
  console.log(`→ ${out}`);
  const r = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-i", src,
      // phóng 3× bằng lanczos (nét chữ), làm tròn về số CHẴN cho H.264
      "-vf", `scale=trunc(iw*${SCALE}/2)*2:trunc(ih*${SCALE}/2)*2:flags=lanczos`,
      "-r", "30",
      "-c:v", "libx264",
      "-profile:v", "high",
      "-pix_fmt", "yuv420p",
      "-crf", "20",
      "-movflags", "+faststart",
      "-an",
      out,
    ],
    { stdio: ["ignore", "ignore", "inherit"], shell: true },
  );
  if (r.status !== 0) {
    console.error(`  ✗ ffmpeg lỗi ở ${dir}`);
    process.exitCode = 1;
  } else done++;
}

console.log(done ? `\nXong ${done} video → ${OUT_DIR}/` : "\nKhông có video nào khớp.");
