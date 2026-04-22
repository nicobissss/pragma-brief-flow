import { supabase } from "@/integrations/supabase/client";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Get a signed URL for a private file in client-assets bucket.
 * Returns a long-lived URL (1 year) suitable for storing in DB.
 */
export async function getClientAssetSignedUrl(path: string, expiresIn = ONE_YEAR_SECONDS): Promise<string> {
  const { data, error } = await supabase.storage
    .from("client-assets")
    .createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) {
    throw new Error(`Failed to create signed URL: ${error?.message || "unknown error"}`);
  }
  return data.signedUrl;
}

/**
 * Upload a file to client-assets and return a signed URL.
 */
export async function uploadClientAsset(path: string, file: File | Blob): Promise<string> {
  const { error: uploadErr } = await supabase.storage.from("client-assets").upload(path, file);
  if (uploadErr) throw uploadErr;
  return getClientAssetSignedUrl(path);
}
