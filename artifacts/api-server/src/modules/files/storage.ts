import { createHash } from "node:crypto";
import sharp from 'sharp';
import { mkdir, readFile, writeFile, rename, access } from 'node:fs/promises';
import { resolve, dirname, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { eq,sql } from "drizzle-orm";
import { files } from "@workspace/db/schema";
import type { Database } from "../catalog/repository";
import { StoreError } from "../../lib/management-store";

export interface ObjectStorage {
  put(key: string, bytes: Buffer, mime: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  ready(): Promise<void>;
}
let cached:
  | { signature: string; storage: ObjectStorage; destroy: () => void }
  | undefined;
export function closeObjectStorage() {
  cached?.destroy();
  cached = undefined;
}
export function s3Storage(): ObjectStorage {
  if (process.env.STORAGE_DRIVER === 'local') {
    const root = process.env.STORAGE_LOCAL_ROOT;
    if (!root || !isAbsolute(root)) throw new Error('Absolute STORAGE_LOCAL_ROOT required');
    const target = (key: string) => {
      if (!/^(public|private)\/[A-Za-z0-9_-]+\/[a-f0-9]{64}$/.test(key)) throw new Error('Invalid storage key');
      return resolve(root, key);
    };
    return {
      async put(key, bytes) {
        const file = target(key);
        await mkdir(dirname(file), { recursive: true, mode: 0o700 });
        const temp = file + '.' + randomUUID();
        await writeFile(temp, bytes, { mode: 0o600, flag: 'wx' });
        await rename(temp, file);
      },
      async get(key) { return readFile(target(key)); },
      async ready() { await access(root, 6); },
    };
  }
  const bucket = process.env.S3_BUCKET;
  if (
    !bucket ||
    !process.env.S3_ENDPOINT ||
    !process.env.S3_ACCESS_KEY_ID ||
    !process.env.S3_SECRET_ACCESS_KEY
  )
    throw new Error("S3 configuration required");
  const signature = [
    process.env.S3_ENDPOINT,
    process.env.S3_REGION,
    bucket,
    process.env.S3_ACCESS_KEY_ID,
    process.env.S3_SECRET_ACCESS_KEY,
  ].join("\0");
  if (cached?.signature === signature) return cached.storage;
  closeObjectStorage();
  const client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "us-east-1",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  const storage: ObjectStorage = {
    async put(key, bytes, mime) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: bytes,
          ContentType: mime,
        }),
        { abortSignal: AbortSignal.timeout(10000) },
      );
    },
    async get(key) {
      const result = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
        { abortSignal: AbortSignal.timeout(10000) },
      );
      if (!result.Body) throw new Error("Empty object");
      return Buffer.from(await result.Body.transformToByteArray());
    },
    async ready() {
      await client.send(new HeadBucketCommand({ Bucket: bucket }), {
        abortSignal: AbortSignal.timeout(10000),
      });
    },
  };
  cached = { signature, storage, destroy: () => client.destroy() };
  return storage;
}
export const digest = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
sharp.cache({memory:32,files:0,items:16});
sharp.concurrency(2);
let decoding=0;
export async function encodeUpload(data:string,mime:string) {
 const bytes=imageBytes(data,mime);
 if(decoding>=2)throw new StoreError('پردازش تصویر مشغول است؛ دوباره تلاش کنید.',429);
 decoding++;
 try {
  const image=sharp(bytes,{limitInputPixels:16000000,failOn:'warning',sequentialRead:true}).timeout({seconds:5});
  const meta=await image.metadata();
  const formats:Record<string,string>={'image/png':'png','image/jpeg':'jpeg','image/webp':'webp'};
  if(meta.format!==formats[mime] || !meta.width || !meta.height || meta.width>6000 || meta.height>6000 || (meta.pages??1)>1)throw new Error('invalid image');
  const clean=await image.rotate().webp({quality:85,effort:3}).toBuffer();
  if(clean.length>4*1024*1024)throw new Error('output too large');
  return {bytes:clean,mime:'image/webp'};
 }catch{throw new StoreError('تصویر معتبر PNG، JPG یا WebP با ابعاد حداکثر ۶۰۰۰ و ۱۶ میلیون پیکسل انتخاب کنید.');}
 finally{decoding--;}
}
export function imageBytes(data: string, mime: string) {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(data) || data.length % 4 !== 0)
    throw new StoreError("تصویر نامعتبر است.");
  const bytes = Buffer.from(data, "base64");
  const valid =
    (mime === "image/png" &&
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (mime === "image/jpeg" &&
      bytes[0] === 255 &&
      bytes[1] === 216 &&
      bytes[2] === 255) ||
    (mime === "image/webp" &&
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP");
  if (!valid || bytes.length < 12 || bytes.length > 4 * 1024 * 1024)
    throw new StoreError(
      "تصویر باید PNG، JPG یا WebP و حداکثر ۴ مگابایت باشد.",
    );
  return bytes;
}
export function fileService(database: Database, supplied?: ObjectStorage) {
  const storage = () => supplied ?? s3Storage();
  return {
    async save(
      id: string,
      bytes: Buffer,
      mime: string,
      ownerId: string | null = null,
    ) {
      const hash = digest(bytes),
        visibility = ownerId ? "private" : "public";
      const key = `${visibility}/${id}/${hash}`;
      // Reserve quota before any object write. One short database lock makes
      // account and global byte caps atomic across every API instance.
      await database.transaction(async raw=>{
        const tx=raw as unknown as Database;
        await tx.execute(sql`SELECT id FROM security_storage_lock WHERE id=1 FOR UPDATE`);
        const [old]=await tx.select().from(files).where(eq(files.id,id));
        if(old){if(old.sha256!==hash||old.ownerId!==ownerId)throw new Error('File mapping conflict');return;}
        const accountCap=Number(process.env.UPLOAD_ACCOUNT_BYTES??104857600),globalCap=Number(process.env.UPLOAD_TOTAL_BYTES??10737418240);
        if(!Number.isSafeInteger(accountCap)||accountCap<1||!Number.isSafeInteger(globalCap)||globalCap<1)throw new Error('Invalid upload quotas');
        const usage=(await tx.execute<{total:string;owned:string}>(sql`SELECT (COALESCE(SUM(size),0)+(SELECT COALESCE(SUM(size),0) FROM card_transfer_receipts))::text AS total,COALESCE(SUM(size) FILTER(WHERE owner_id IS NOT DISTINCT FROM ${ownerId}),0)::text AS owned FROM stored_files`)).rows[0];
        if(Number(usage.total)+bytes.length>globalCap || (ownerId && Number(usage.owned)+bytes.length>accountCap))throw new StoreError('سهمیهٔ فضای تصاویر تکمیل شده است.',413);
        await tx.insert(files).values({id,ownerId,visibility,objectKey:key,mime,size:bytes.length,sha256:hash});
      });
      const objectStore = storage();
      await objectStore.put(key, bytes, mime);
      if (digest(await objectStore.get(key)) !== hash)
        throw new Error("Object read-back checksum mismatch");
      // Deterministic key makes migration restart safe. Failed object writes keep
      // their reservation; an operator can reconcile these without oversubscription.
      const [record] = await database
        .insert(files)
        .values({
          id,
          ownerId,
          visibility,
          objectKey: key,
          mime,
          size: bytes.length,
          sha256: hash,
        })
        .onConflictDoNothing()
        .returning();
      if (!record) {
        const [old] = await database
          .select()
          .from(files)
          .where(eq(files.id, id));
        if (old.sha256 !== hash || old.ownerId !== ownerId)
          throw new Error("File mapping conflict");
      }
      return `/api/${ownerId ? "customer/" : ""}media/${id}`;
    },
    async read(id: string, ownerId?: string, admin = false) {
      const [f] = await database.select().from(files).where(eq(files.id, id));
      if (!f) return null;
      if (f.visibility === "private" && !admin && f.ownerId !== ownerId)
        throw new StoreError("فایل پیدا نشد.", 404);
      const bytes = await storage().get(f.objectKey);
      if (bytes.length !== f.size || digest(bytes) !== f.sha256)
        throw new Error("Object checksum mismatch");
      return { mime: f.mime, bytes };
    },
  };
}
