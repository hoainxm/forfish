// Thư mục dữ liệu train NGOÀI repo (luật dữ liệu: PII/số liệu thô không vào git, không rời PC GPU).
//   $SDFISH_DATA_DIR  (PC GPU WSL: /mnt/c/Users/admin/sdfish-data)  — mặc định ~/sdfish-data
// MỘT nguồn sự thật cho mọi script train (dl-*, build-*-grid, fish-base-*, fish-features-cache, train/run).
import { join } from "node:path";
import { homedir } from "node:os";

export const dataDir = () => (process.env.SDFISH_DATA_DIR ?? join(homedir(), "sdfish-data")).replace(/^~/, homedir());
/** Thư mục gốc DataLake thô (repo AI-Assistant, gitignored): --src / $SDVICO_DATALAKE_ROOT. */
export const datalakeRoot = () => (process.env.SDVICO_DATALAKE_ROOT ?? join(homedir(), "forlife", "sdvico-data", "data-local", "datalake-iuu")).replace(/^~/, homedir());
