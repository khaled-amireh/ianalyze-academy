# Supabase email configuration handoff

Prepared on 3 November 2026 (Asia/Amman). The templates were loaded and tested on local Supabase. **No hosted settings were changed.** Apply the following only during a separately approved release.

## Exact templates

| Dashboard template | Subject                                                              | Body to paste in full                                           |
| ------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------- |
| Confirm sign up    | `Verify Email Address \| تأكيد البريد الإلكتروني — iAnalyze Academy` | [confirmation.html](../../supabase/templates/confirmation.html) |
| Reset password     | `Reset your password \| استعادة كلمة المرور — iAnalyze Academy`      | [recovery.html](../../supabase/templates/recovery.html)         |

The HTML files are the exact deliverables; copy their entire contents into the respective template editors. They contain bilingual buttons, explanatory text, a copyable primary link and the Supabase-generated fallback link. They contain no fixed credentials or tokens.

The confirmation button uses:

```html
<a
  href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&amp;type=email"
>
  Verify Email Address<br /><span lang="ar" dir="rtl"
    >تأكيد البريد الإلكتروني</span
  >
</a>
```

The recovery button uses:

```html
<a
  href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&amp;type=recovery"
>
  Set a new password<br /><span lang="ar" dir="rtl">تعيين كلمة مرور جديدة</span>
</a>
```

Both include this generated fallback:

```html
<a href="{{ .ConfirmationURL }}">{{ .ConfirmationURL }}</a>
```

`TokenHash` and `ConfirmationURL` are supplied by Supabase. The primary link is exchanged with `verifyOtp`, allowing a fresh browser without the original PKCE verifier. The fallback retains Supabase's normal verification URL and should be opened in the request browser when using PKCE. Supabase still controls token validity, expiration, single use and rate limits. See [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates) and [verifyOtp](https://supabase.com/docs/reference/javascript/auth-verifyotp).

## Hosted dashboard steps, after approval

1. Select the existing iAnalyze Supabase project. Confirm its project reference against the existing release configuration: `ocihwiqtgqplwgyhpwjv`. Do not create or link another project.
2. Under **Authentication → URL Configuration**, inspect the current configuration. The intended production Site URL is `https://ianalyze-academy.pages.dev`, with no trailing slash or callback path. If a different approved canonical domain is in use, use that domain consistently instead of guessing.
3. Retain the existing approved redirect allowlist. Confirm these exact production callback destinations are allowed:
   - `https://ianalyze-academy.pages.dev/auth/callback`
   - `https://ianalyze-academy.pages.dev/auth/callback?flow=recovery`
     Use the chosen canonical domain consistently if it differs. Do not add broad public wildcards.
4. Under **Authentication → Email → Templates** (the UI may also label this **Email Templates**), open **Confirm sign up**. Paste the subject above and the entire `confirmation.html` file. Preview both language blocks, then save during the approved release.
5. Open **Reset password**. Paste its subject and entire `recovery.html` file. Preview and save.
6. Keep **Confirm email** enabled. Preserve existing token expiration, password requirements, refresh-token rotation, secure password change and approved SMTP settings. Keep the hosted email limits appropriate for the configured provider. The local `config.toml` contains test-only SMTP/rate settings and must **not** be pushed wholesale to production.
7. If the SMTP provider rewrites authentication links for tracking, disable link tracking for these emails. Supabase documents this limitation in its [email template guidance](https://supabase.com/docs/guides/auth/auth-email-templates).
8. Coordinate the template change with the reviewed frontend and forward-only migration. The migration is `supabase/migrations/20261103000100_registration_validation.sql`. It has been applied locally only. Confirm hosted migration history and take the project's normal reviewed backup before applying that new migration through the approved release process. It does not rewrite existing rows or change RLS.
9. Do not run `supabase config push`, database reset commands or a local environment file against the hosted project.

## Release smoke checks

Use a designated test account, after approval and deployment:

1. Register, confirm receipt in inbox/spam and verify that the bilingual button and copyable fallback render in the actual mail client.
2. Open the primary button in the request browser. Expect `/student` for a normal Student, or `/workspace` for an existing authorized Team account. Expect no credential query/fragment to remain in the address bar.
3. Open a fresh verification email from a mobile mail app into a different browser. Expect the primary token-hash flow to establish the session and open the correct destination.
4. Complete the profile with `0797232936`; verify persisted `+962797232936`, years 1–5 and the retained session. Repeat an edit with `00962797232936`.
5. Reopen a used link and test a genuinely expired link. Expect readable recovery/resend actions, without a redirect loop.
6. Request resend twice. Expect the UI cooldown and actionable feedback for any server rate limit; do not raise hosted rate limits to bypass the test.
7. Request password recovery, including from a different browser. Set a compliant password, then verify login and intentional sign-out after reset.
8. Verify Leader and Organizer access to all participant columns, and deny those records to an unrelated Student and anonymous client.

Local Chrome emulation and captured-mail tests passed. Actual hosted mail delivery, inbox rendering and physical iOS/Android mail-app handoffs remain release checks.
