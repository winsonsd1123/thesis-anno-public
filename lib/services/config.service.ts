import { unstable_cache } from "next/cache";
import { revalidateTag } from "next/cache";
import type { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "app-config";

async function fetchFromStorage<T>(key: string): Promise<T> {
  const supabase = createAdminClient();
  const path = `${key}.json`;

  const { data, error } = await supabase.storage.from(BUCKET).download(path);

  if (error) {
    throw new Error(`ConfigService: Failed to fetch ${path}: ${error.message}`);
  }

  if (!data) {
    throw new Error(`ConfigService: Empty response for ${path}`);
  }

  const text = await data.text();
  return JSON.parse(text) as T;
}

export class ConfigService {
  static async get<T>(key: string, schema: z.ZodSchema<T>): Promise<T> {
    const cached = unstable_cache(
      async () => {
        const raw = await fetchFromStorage<unknown>(key);
        return schema.parse(raw) as T;
      },
      [`config-${key}`],
      { tags: [key], revalidate: 60 }
    );

    return cached();
  }

  static async update<T>(key: string, data: T): Promise<void> {
    const supabase = createAdminClient();
    const path = `${key}.json`;
    const body = JSON.stringify(data, null, 2);

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, body, { contentType: "application/json", upsert: true });

    if (error) {
      throw new Error(`ConfigService: Failed to update ${path}: ${error.message}`);
    }

    revalidateTag(key, { expire: 0 });
  }
}
