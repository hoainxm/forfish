import puppeteer from "puppeteer";
import path from "node:path";
import { pathToFileURL } from "node:url";

const htmlPath = path.resolve("public/huong-dan.html");
const out = process.argv[2] || path.resolve("docs/Huong-dan-su-dung-SDFish.pdf");

const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle0" });
// đảm bảo mọi ảnh webp đã decode xong
await page.evaluate(async () => {
  await Promise.all(
    Array.from(document.images).map((img) =>
      img.complete ? Promise.resolve() : new Promise((r) => { img.onload = img.onerror = r; }),
    ),
  );
});
await page.pdf({
  path: out,
  format: "A4",
  printBackground: true,
  margin: { top: "14mm", bottom: "16mm", left: "12mm", right: "12mm" },
  displayHeaderFooter: true,
  headerTemplate: "<span></span>",
  footerTemplate:
    '<div style="width:100%;font-size:8px;color:#5b6b78;padding:0 12mm;display:flex;justify-content:space-between;">' +
    '<span>Hướng dẫn dùng SDFish — nội bộ SDVICO</span>' +
    '<span>Trang <span class="pageNumber"></span>/<span class="totalPages"></span></span></div>',
});
await browser.close();
console.log("PDF:", out);
