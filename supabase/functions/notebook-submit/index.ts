import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import {
  notebookDigest,
  readBoundedBody,
  validateNotebook,
} from "../_shared/notebook.ts";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  const allowed = (Deno.env.get("ACADEMY_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    Vary: "Origin",
    "X-Content-Type-Options": "nosniff",
  };
  if (origin && allowed.includes(origin))
    headers["Access-Control-Allow-Origin"] = origin;
  headers["Access-Control-Allow-Headers"] =
    "authorization,apikey,content-type,x-activity-id,x-request-id,x-filename,x-client-info";
  headers["Access-Control-Allow-Methods"] = "POST,OPTIONS";
  const reply = (status: number, error: string) =>
    new Response(JSON.stringify({ error }), { status, headers });
  if (origin && !allowed.includes(origin)) return reply(403, "Origin denied");
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return reply(405, "POST required");
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer "))
    return reply(401, "Authentication required");
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY");
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key || !secret) return reply(503, "Service unavailable");
  try {
    // Gateway legacy-JWT checking is disabled; Auth verifies the real user token here.
    const client = createClient(url, key, {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: identity, error: identityError } = await client.auth.getUser(
      auth.slice(7),
    );
    if (identityError || !identity.user?.email_confirmed_at)
      return reply(401, "Verified account required");
    const role = await client.rpc("current_academy_role");
    if (role.error || role.data !== "student")
      return reply(403, "Student required");
    if (Deno.env.get("ACADEMY_UPLOADS_ENABLED") !== "true")
      return reply(503, "Submissions closed");
    const capabilities = await client.rpc("academy_capabilities");
    if (capabilities.error || capabilities.data?.submissions !== true)
      return reply(503, "Submissions closed");
    const activity = request.headers.get("x-activity-id") ?? "";
    const id = request.headers.get("x-request-id") ?? "";
    if (!uuid.test(activity) || !uuid.test(id))
      return reply(400, "Invalid request");
    const admin = createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const budget = await admin.rpc("claim_submission_request", {
      p_student_id: identity.user.id,
    });
    if (budget.error)
      return reply(429, "Registration or request quota unavailable");
    let bytes: Uint8Array;
    let digest: string;
    try {
      bytes = await readBoundedBody(request);
      validateNotebook(
        bytes,
        decodeURIComponent(request.headers.get("x-filename") ?? ""),
      );
      digest = await notebookDigest(bytes);
    } catch {
      return reply(400, "Invalid notebook or size");
    }
    const reservation = await admin.rpc("reserve_notebook", {
      p_student_id: identity.user.id,
      p_activity_id: activity,
      p_request_id: id,
      p_sha256: digest,
      p_bytes: bytes.length,
    });
    if (reservation.error || !reservation.data)
      return reply(
        409,
        "Submission unavailable: check deadline, rubric, registration or attempt quota",
      );
    const row = reservation.data as {
      id: string;
      path: string;
      status: string;
    };
    if (row.status === "uploading") {
      const uploaded = await admin.storage
        .from("student-submissions")
        .upload(row.path, bytes, {
          contentType: "application/x-ipynb+json",
          upsert: false,
        });
      if (uploaded.error) {
        // Idempotent retry after a prior upload: verify existing bytes; never overwrite.
        const old = await admin.storage
          .from("student-submissions")
          .download(row.path);
        if (
          old.error ||
          (await notebookDigest(
            new Uint8Array(await old.data.arrayBuffer()),
          )) !== digest
        )
          return reply(
            503,
            "Upload incomplete; retry the same file and request",
          );
      }
      const finalized = await admin.rpc("finalize_notebook", {
        p_submission_id: row.id,
        p_sha256: digest,
      });
      if (finalized.error)
        return reply(
          503,
          "Finalization incomplete; retry the same file and request",
        );
    }
    // No notebook source, secret, contact field or internal error is logged/returned.
    return new Response(JSON.stringify({ id: row.id, status: "submitted" }), {
      status: 200,
      headers,
    });
  } catch {
    return reply(503, "Service unavailable");
  }
});
