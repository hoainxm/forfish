// CỔNG BA ĐIỀU KIỆN cho kho file (dev). Sai một điều kiện là KHÔNG bao giờ file
// mode, kể cả ai đó đặt MARKET_STORE=file trên Vercel. Thuần để test được.
export function isDevFileModeEnv(env: Record<string, string | undefined>): boolean {
  return env.MARKET_STORE === "file" && !env.VERCEL && env.NODE_ENV !== "production";
}
export function isDevFileMode(): boolean {
  return isDevFileModeEnv(process.env as Record<string, string | undefined>);
}
/** file-store gọi lúc khởi tạo: điều kiện sai ⇒ ném, không bao giờ im lặng chạy file ở prod. */
export function assertDevFileMode(): void {
  if (!isDevFileMode()) {
    throw new Error("[market] file-store chỉ chạy khi MARKET_STORE=file, không VERCEL, NODE_ENV!=production");
  }
}
