import fs from 'fs';
import path from 'path';

const filesToFix = [
  'docs/app-map/02-architecture.md',
  'docs/app-map/07-design-spec.md',
  'docs/app-map/ops/external-services.md',
  'docs/integration/sdwork-sso-contract.md'
];

const win1252ToUnicode = {
  0x80: 0x20AC, 0x82: 0x201A, 0x83: 0x0192, 0x84: 0x201E,
  0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02C6,
  0x89: 0x2030, 0x8A: 0x0160, 0x8B: 0x2039, 0x8C: 0x0152,
  0x8E: 0x017D, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201C,
  0x94: 0x201D, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
  0x98: 0x02DC, 0x99: 0x2122, 0x9A: 0x0161, 0x9B: 0x203A,
  0x9C: 0x0153, 0x9E: 0x017E, 0x9F: 0x0178
};

const unicodeToWin1252 = {};
for (const [byte, uni] of Object.entries(win1252ToUnicode)) {
  unicodeToWin1252[uni] = parseInt(byte, 10);
}

function decodeMojibake(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (unicodeToWin1252[code] !== undefined) {
      bytes.push(unicodeToWin1252[code]);
    } else if (code < 256) {
      bytes.push(code);
    } else {
      const buf = Buffer.from(str[i], 'utf-8');
      for (const b of buf) {
        bytes.push(b);
      }
    }
  }
  return Buffer.from(bytes).toString('utf-8');
}

const baseDir = 'c:\\Users\\ACER\\ForFish';

for (const relPath of filesToFix) {
  const fullPath = path.join(baseDir, relPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`File not found: ${fullPath}`);
    continue;
  }

  console.log(`Processing ${relPath}...`);
  let buffer = fs.readFileSync(fullPath);
  
  // 1. Remove UTF-8 BOM if present (EF BB BF)
  if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    console.log(`- Removed UTF-8 BOM`);
    buffer = buffer.subarray(3);
  }

  // 2. Decode mojibake
  const rawString = buffer.toString('utf-8');
  const fixedString = decodeMojibake(rawString);

  // 3. Write back without BOM
  fs.writeFileSync(fullPath, Buffer.from(fixedString, 'utf-8'));
  console.log(`- Done fixing: ${relPath}`);
}

console.log('All files processed!');
