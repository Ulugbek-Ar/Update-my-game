// Tashqi paketsiz oddiy ZIP yozuvchi (deflate, UTF-8 fayl nomlari) — Windows Explorer ochadi.
import { crc32, deflateRawSync } from "node:zlib";

/** @param {{ name: string, data: Buffer, date?: Date }[]} files */
export function makeZip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, "utf8");
    const raw = f.data;
    const packed = deflateRawSync(raw, { level: 9 });
    const crc = crc32(raw) >>> 0;
    const d = f.date ?? new Date();
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const head = (sig, central) => {
      const b = Buffer.alloc(central ? 46 : 30);
      let o = 0;
      b.writeUInt32LE(sig, o);
      o += 4;
      if (central) {
        b.writeUInt16LE(20, o); // yaratgan versiya
        o += 2;
      }
      b.writeUInt16LE(20, o); // kerakli versiya
      b.writeUInt16LE(0x0800, o + 2); // UTF-8 nomlar
      b.writeUInt16LE(8, o + 4); // deflate
      b.writeUInt16LE(time, o + 6);
      b.writeUInt16LE(date, o + 8);
      b.writeUInt32LE(crc, o + 10);
      b.writeUInt32LE(packed.length, o + 14);
      b.writeUInt32LE(raw.length, o + 18);
      b.writeUInt16LE(name.length, o + 22);
      if (central) b.writeUInt32LE(offset, o + 36); // qolganlari 0
      return b;
    };
    const local = Buffer.concat([head(0x04034b50, false), name, packed]);
    locals.push(local);
    centrals.push(Buffer.concat([head(0x02014b50, true), name]));
    offset += local.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}
