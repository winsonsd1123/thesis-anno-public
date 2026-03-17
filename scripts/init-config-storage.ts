/**
 * 初始化 app-config Storage Bucket 并上传默认配置。
 * 首次部署或新环境需执行: npm run init-config
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
config();
import * as fs from "fs";
import * as path from "path";

const BUCKET = "app-config";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === BUCKET);

  if (!exists) {
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: false,
    });
    if (error) {
      console.error("Failed to create bucket:", error.message);
      process.exit(1);
    }
    console.log(`Created bucket: ${BUCKET}`);
  } else {
    console.log(`Bucket ${BUCKET} already exists`);
  }

  const configDir = path.join(process.cwd(), "config");

  const files: { local: string; remote: string }[] = [
    { local: "prompts.default.json", remote: "prompts.json" },
    { local: "billing.config.json", remote: "billing.json" },
    { local: "system.default.json", remote: "system.json" },
  ];

  for (const { local, remote } of files) {
    const filePath = path.join(configDir, local);
    if (!fs.existsSync(filePath)) {
      console.warn(`Skip ${local}: file not found`);
      continue;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(remote, content, { contentType: "application/json", upsert: true });

    if (error) {
      console.error(`Failed to upload ${remote}:`, error.message);
      process.exit(1);
    }
    console.log(`Uploaded ${remote}`);
  }

  console.log("Done.");
}

main();
