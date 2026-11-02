# Registration and verified Leader handoff — 2026-11-02

**Ready for the owner's push. No push, merge or manual deployment was performed.** Branch: `codex/supabase-auth-integration`. Existing project: `ocihwiqtgqplwgyhpwjv`.

- The real owner account was created through Supabase Auth using a private browser-entered password. The owner received the email; Supabase recorded confirmation at **21:34:22 Asia/Amman**. The owner then completed a real password login. No password, token or confirmation link was read, logged or committed.
- The exact Auth UUID was verified against the confirmed account and later password-login timestamp. One existing Student role row was promoted to the existing `team` level in an atomic owner-authorized transaction. The role audit event and post-write permissions were verified. The owner confirmed Team access through their actual session. Leaders and Organizers use this same authorization level; they cannot self-assign it through profile metadata or public APIs.
- The Team Syllabus bucket is private and actual Team listing access passed, but the production bucket contains **no syllabus file**. No private teaching content was invented or uploaded. Management/private-directory authorization is verified locally and against the owner's database identity; the newly built management UI still needs the owner's live check after pushing.
- Production now has one confirmed owner/Team account, four unchanged migration-history rows, ten RLS application tables and zero Storage objects. The three database submission/upload/leaderboard gates remain false. Auth settings, SMTP, email confirmation, password length 12 and rate limits were preserved.

## Registration and feedback

The configured release opens Create Account and academy registration **after** a fresh read-only CI check confirms the exact owner's verified UUID still has Team permissions. New accounts remain Students by server-side trigger. Normal signup follows PKCE confirmation to the academy registration form; complete private details and consent are saved before dashboard content is shown. Registration is immediate without Leader approval. The database enforces unique Auth/profile associations and idempotent registration timestamps.

Auth, resend, recovery and profile forms now have localized field-level errors, red invalid borders, associated error descriptions, focused invalid fields, alert announcements and green confirmed-success feedback. Password confirmation and accessible show/hide controls are included. Synchronous in-flight guards block accidental duplicate requests; entered non-password values survive validation errors. Stable SDK error codes produce actionable email, password, network, rate-limit and expired-session messages without exposing server details or account existence. Server-returned resend errors are checked instead of being reported as success.

The bilingual privacy notice describes actual account/profile use, private contact visibility, providers and Team contact/request handling. Registration consent version remains `registration-v1`. Unrelated pages and branding are preserved.

## The misleading expired-link incident

The first email was consumed successfully at 21:34:22 Amman. Logs then showed a token-not-found event 21 seconds later; the configured expiry was one hour. No SMTP or rate-limit failure was observed in that window. The SMTP relay is Brevo, with a 60-second resend interval and 30 email requests/hour. Once an email is confirmed, Supabase accepts resend requests without issuing another confirmation email; this preserves account privacy. Provider-wide inbox delivery and a hosted password-recovery exchange were not tested.

The private bootstrap's legacy implicit callback returned to the older production frontend. The prepared callback now scrubs fragment credentials and gives clear login guidance instead of falsely declaring that return expired. It does not trust fragment tokens or create a session from them. Normal PKCE/token-hash confirmation and recovery remain supported. Actually invalid/expired links give recovery instructions. This fix goes live only after the owner's push.

## Verification

- Full `validate` passed: TypeScript, ESLint, formatting, **32 unit tests**, closed public production build/boundaries, design/source preservation, **21 embedded security tests**, and generated database type checks.
- **15 real local Supabase integration tests passed**, including Student isolation, Team/Organizer equivalence and revocation, real captured signup/recovery mail, Storage authorization and grading. No hosted test student was created.
- Real local browser acceptance passed signup, confirmation, resend, recovery, registration, session refresh/persistence, cross-tab logout and roles. It retained 20 public/Auth and 32 authenticated layout combinations and added **24 validation cases** across both languages, themes and mobile/desktop. Error contrast met **4.5:1**, success text used the green token, invalid fields had associated descriptions, and app exceptions were zero. Representative Arabic dark mobile feedback was visually inspected.
- The final configured production candidate passed build/artifact checks (**48 files**) and **56 navigation/layout/protection cases**, with public signup enabled in the candidate and no hosted user writes from that browser suite.
- The workflow passed actionlint. The read-only hosted release check rejected the owner while still Student and passed after verified, audited Team bootstrap. The check uses a private UUID, not an email-based promotion rule. Stale/wrong-project/unverified/gate-open proofs are covered by unit tests.
- A real card-typography specificity conflict initially made field errors gray; scoped styles fixed it. A local fixture suite was inadvertently started during browser fixtures; freshness guards rejected the overlap, and the suites passed when rerun sequentially. No assertion or security guard was relaxed.

## Push and live test

GitHub configuration now includes `ACADEMY_REGISTRATION_APPROVED=true` as a repository variable and `ACADEMY_LEADER_USER_ID` as an encrypted Actions secret. Existing Cloudflare/Supabase deployment secrets and target variables remain configured. The UUID and server credentials are never Vite inputs. A short-lived, non-sensitive readiness proof must be generated before the registration-enabled build. Registration/privacy become true; submissions, leaderboard and dev previews remain false. No migration runs in CI.

```powershell
git push -u origin codex/supabase-auth-integration
```

Wait for [Actions](https://github.com/khaled-amireh/ianalyze-academy/actions) to pass, then open <https://ianalyze-academy.pages.dev>. Log in with the verified owner account, open `/workspace`, check the empty student directory/private materials, then test student signup, confirmation/resend and profile completion with an account you control. Test password recovery from the live website using the same browser. The production website is **still on the previous release until this push**; public registration is prepared and approved, not already live.

Known limits: no actual Team Syllabus file exists; external password-recovery delivery/exchange and the new Actions run await live testing. SMTP acceptance is not a guarantee of every future inbox delivery. The unchanged inherited dev tooling has three low advisories and no runtime advisories; the configured main bundle has a non-blocking approximately 589 kB warning. The old verified logical backup predates the owner account; never restore it over production without a fresh backup and an approved recovery plan that preserves new user data.
