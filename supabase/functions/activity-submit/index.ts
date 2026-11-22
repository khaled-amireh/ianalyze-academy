import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import {
  readBoundedJsonObject,
  validateActivityFile,
} from "../_shared/activity-files.ts";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const bucket = "activity-submissions";
Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  const allowed = (Deno.env.get("ACADEMY_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    Vary: "Origin",
  };
  if (origin && allowed.includes(origin))
    headers["Access-Control-Allow-Origin"] = origin;
  headers["Access-Control-Allow-Headers"] =
    "authorization,apikey,content-type,x-client-info";
  headers["Access-Control-Allow-Methods"] = "POST,OPTIONS";
  const reply = (status: number, error: string) =>
    new Response(JSON.stringify({ error }), { status, headers });
  if (origin && !allowed.includes(origin)) return reply(403, "Origin denied");
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return reply(405, "POST required");
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer "))
    return reply(401, "Authentication required");
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey)
    return reply(503, "Submission service unavailable");

  try {
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const identityResult = await userClient.auth.getUser(
      authorization.slice(7),
    );
    const identity = identityResult.data.user;
    if (identityResult.error || !identity?.email_confirmed_at)
      return reply(401, "Verified account required");
    const role = await userClient.rpc("current_academy_role");
    if (role.error || role.data !== "student")
      return reply(403, "Student account required");

    let payload: Record<string, unknown>;
    try {
      payload = await readBoundedJsonObject(request);
    } catch {
      return reply(400, "Invalid request");
    }
    const submissionId =
      typeof payload.submissionId === "string" ? payload.submissionId : "";
    if (
      !uuid.test(submissionId) ||
      (payload.action !== undefined && payload.action !== "cancel")
    )
      return reply(400, "Invalid request");

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const submissionResult = await admin
      .from("submissions")
      .select("id,student_id,submission_mode,status")
      .eq("id", submissionId)
      .maybeSingle();
    const submission = submissionResult.data;
    if (
      submissionResult.error ||
      !submission ||
      submission.student_id !== identity.id ||
      submission.submission_mode !== "files"
    )
      return reply(404, "Submission not found");
    if (payload.action === "cancel") {
      if (submission.status !== "uploading")
        return reply(409, "Only an unfinished upload can be cancelled");
      const pending = await admin
        .from("activity_submission_files")
        .select("storage_path")
        .eq("submission_id", submissionId);
      if (pending.error) return reply(503, "Submission cleanup unavailable");
      const paths = (pending.data ?? []).map((x) => x.storage_path);
      if (paths.length) {
        const removed = await admin.storage.from(bucket).remove(paths);
        if (removed.error) return reply(503, "Submission cleanup incomplete");
      }
      const cancelled = await admin.rpc("cancel_activity_submission", {
        p_submission_id: submissionId,
      });
      if (cancelled.error) return reply(503, "Submission cleanup incomplete");
      return new Response(JSON.stringify({ status: "cancelled" }), {
        status: 200,
        headers,
      });
    }
    const capabilities = await userClient.rpc("academy_capabilities");
    if (
      capabilities.error ||
      capabilities.data?.submissions !== true ||
      capabilities.data?.activity_file_submissions !== true ||
      Deno.env.get("ACADEMY_ACTIVITY_UPLOADS_ENABLED") !== "true"
    )
      return reply(503, "Submissions are closed");
    if (submission.status === "submitted")
      return new Response(JSON.stringify({ status: "submitted" }), {
        status: 200,
        headers,
      });
    if (submission.status !== "uploading")
      return reply(409, "Submission is not pending");

    const manifestResult = await admin
      .from("activity_submission_files")
      .select(
        "id,original_name,content_type,size_bytes,storage_path,expected_sha256",
      )
      .eq("submission_id", submissionId)
      .order("position");
    if (
      manifestResult.error ||
      !manifestResult.data?.length ||
      manifestResult.data.length > 3
    )
      return reply(503, "Submission manifest unavailable");
    const verified: Array<{ id: string; sha256: string }> = [];
    for (const file of manifestResult.data) {
      const download = await admin.storage
        .from(bucket)
        .download(file.storage_path);
      if (
        download.error ||
        !download.data ||
        download.data.size !== file.size_bytes
      )
        return reply(409, "One or more files are not uploaded completely");
      const bytes = new Uint8Array(await download.data.arrayBuffer());
      try {
        try {
          validateActivityFile(bytes, file.original_name, file.content_type);
        } catch {
          const removed = await admin.storage
            .from(bucket)
            .remove(manifestResult.data.map((x) => x.storage_path));
          if (!removed.error)
            await admin.rpc("cancel_activity_submission", {
              p_submission_id: submissionId,
            });
          return reply(400, "A file did not pass content validation");
        }
        let digest: Uint8Array;
        try {
          digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
        } catch {
          return reply(
            503,
            "Submission verification did not complete; retry the same upload",
          );
        }
        try {
          const sha256 = Array.from(digest, (x) =>
            x.toString(16).padStart(2, "0"),
          ).join("");
          if (sha256 !== file.expected_sha256) {
            const removed = await admin.storage
              .from(bucket)
              .remove(manifestResult.data.map((x) => x.storage_path));
            if (!removed.error)
              await admin.rpc("cancel_activity_submission", {
                p_submission_id: submissionId,
              });
            return reply(
              400,
              "Uploaded content did not match the selected file",
            );
          }
          verified.push({ id: file.id, sha256 });
        } finally {
          digest.fill(0);
        }
      } finally {
        bytes.fill(0);
      }
    }
    const finalized = await admin.rpc("finalize_activity_submission", {
      p_submission_id: submissionId,
      p_files: verified,
    });
    if (finalized.error)
      return reply(
        503,
        "Submission verification did not complete; retry the same upload",
      );
    return new Response(JSON.stringify({ status: "submitted" }), {
      status: 200,
      headers,
    });
  } catch {
    return reply(503, "Submission service unavailable");
  }
});
