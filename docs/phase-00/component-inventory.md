# Planned reusable React component inventory

Planning only. No React files or component dependencies are installed. Future components consume typed translation keys and semantic tokens, support both directions, and receive authorized data from their owning route. A component never confers authorization.

| Component | Inputs / responsibilities | States / accessibility |
| --- | --- | --- |
| PublicNavbar | Current route, links, language, joining availability | Mobile disclosure, `aria-current`, skip link |
| Footer | iTeam original logo, approved contact links, secondary routes | Explicit pending contact if absent |
| LanguageSwitcher | Locale and change callback, current route | AR/EN text, pressed state, preference fallback |
| PageHeader | Eyebrow, title, description, optional action | One page h1, wrapping actions |
| AcademyHero | Club statement, EDA CTA, illustrative learning journey | Static chart description; no performance claims |
| SectionCard | Heading, body, optional action | Semantic article; no nested card links |
| CourseModuleCard | Week, translated title, isolated technical term, synopsis | Optional native details/summary |
| VideoCard | Approved thumbnail/title/description/topic/URL/captions | Empty fallback, click-to-load embed, named frame |
| VideoLibraryFilters | Approved categories and selected filter | No-results state and reset |
| TeamMemberCard | Approved portrait, name, role, bio, optional links | Role placeholder without invented name/photo |
| RegistrationForm | Versioned fields and privacy notice | Pending, field/summary errors, duplicate-safe success |
| ActivityCard | Release/deadline, state, Late flag, action | Unreleased, closed, extension, reviewed |
| SubmissionInterface | File constraints, attempts, current status | Empty/uploading/confirmed/error, retry, accessible file input |
| SubmissionHistory | Own attempts, timestamps, status, published result | Empty and mobile labeled rows |
| RubricTable | Published criteria and caps, version | Read-only student view; linked headers |
| ProgressIndicator | Completion count, accessible label | Text + progressbar, unavailable state |
| Leaderboard | Authorized projection, opt-in explanation, personal rank | Ties, empty/no opt-in, pagination, private position |
| StudentSidebar | Authorized navigation and active item | Reading-edge layout; mobile wrapping nav |
| TeamSidebar | Organizer or Leader authorized items | Separate scopes; no generic unrestricted admin |
| ReviewPanel | Attempt, rubric version, editable draft, feedback | Assigned-only; save conflict, validation, submitted |
| ApplicationReviewPanel | Necessary applicant fields and decision | Leader-only, reason, confirmation, retry |
| ActivityEditor | Fixed-program activity details, deadline, rubric | Draft/published, permission denied; no course editor |
| AnnouncementCard / Editor | Bilingual body, audience, publication state | Draft restricted; translated missing-content warning |
| Badge / StatusIndicator | Text key, meaning, semantic token, optional icon | Never color-only |
| StatePanel | Empty/loading/success/error message + safe action | Status or alert semantics as appropriate |
| ConfirmDialog | Named consequential action, cancel/confirm | Focus containment, Escape, restore focus |
| NotificationRegion | Async event + persistent related result | Polite status for success, assertive only for errors |
| PrivateDocumentBoundary | Authorization state + server-issued document access | Forbidden/loading/error; no bundled private content |
| StatCard | Value, label, source/scope, demo marker | No misleading public counts; privacy-safe aggregation |

Future shared types: `Locale`, `Role`, `SubmissionState`, `LateFlag`, `RubricVersion`, `AuthorizedReview`, and `PublicLeaderboardEntry`. Avoid a general client-supplied `isAdmin` permission boolean. Map backend errors to localized safe messages. Dates, counts and pluralization use locale-aware formatting. Separate public content from private records at the data boundary, not only in components.
