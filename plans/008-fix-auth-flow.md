# 008 — Fix the auth flow (onboarding, gates, lock screen, tags)

Source: auth flow review on 2026-10-29 (code read, not device-tested). Findings
marked _runtime_ depend on render/mount ordering and should be reproduced on a
device before fixing.

Scope: `apps/mobile/app/_layout.tsx`, `apps/mobile/app/auth/*`,
`apps/mobile/app/onboarding/*`, `apps/mobile/lib/*-gate.tsx`,
`apps/mobile/lib/use-post-auth-navigate.ts`, `apps/mobile/lib/use-profile-sync.ts`,
`apps/api/src/routes/v1.ts` (auth routes), `packages/shared/src/finora-tag.ts`.

## Critical

1. **Onboarding runs twice; returning users get stuck on new devices.**
   Onboarding runs signed out, but `isUserStorageKeyWritable` blocks writes with
   no active user, so `completeOnboarding()` (`components/onboarding/OnboardingScreen.tsx:144`)
   persists nothing. After sign-in, boot reloads per-user state, sees
   `completed: false`, and redirects to `/onboarding`. `useProfileSync` later
   writes onboarding to storage (`lib/use-profile-sync.ts:69`) but never calls
   `markCompleted`, so the gate stays closed.

2. **Account type and Finora tag can be overwritten.** _runtime_
   - `useProfileSync` pushes the device-local account type to the server whenever
     they differ (`lib/use-profile-sync.ts:54`). Combined with (1), re-doing
     onboarding on a new device can flip business → personal server-side.
   - `usePostAuthNavigate` stores the tag flag but never calls `markTagConfigured`
     (`lib/use-post-auth-navigate.ts`). `_layout.tsx:206` then redirects
     phone-verified users without the in-memory flag to `/auth/choose-tag`, and
     `PATCH /auth/me` lets the tag change at any time, so a returning user can
     replace their payment handle.

3. **Passcode is not enforced server-side.** The passcode exists only on device
   (`lib/passcode-storage.ts`). `POST /approvals/:id/resolve` executes without
   PIN/biometric proof or an ownership check (mocked today, but the contract is
   wrong). Passcode recovery marks the challenge verified, but nothing checks
   that flag afterwards. **Overlaps plan 002** — fix there.

4. **Lock screen can be brute-forced and has no exit.** `app/auth/enter-passcode.tsx`
   has no attempt limit, no "Forgot passcode", and no "Sign out". Recovery is only
   wired into change-passcode and approval flows.

## High

5. **Dead ends.** Password sign-in shows "needs a sign-in step Finora does not
   support yet" for 2FA / new-device checks (`app/auth/login.tsx:51`). Google/Apple
   SSO silently does nothing when Clerk returns no session (`lib/use-google-auth.ts:25`,
   `lib/use-apple-auth.ts`).
6. **Tag availability is faked.** "@x is available" only checks a client reserved
   list (`lib/finora-tags.ts:146`). Reserved tags are not enforced in
   `FinoraTagSchema`, so the API accepts `@finora`, `@support`, etc.
7. **Phone OTP limits.** 5 wrong guesses per challenge, but each resend (every
   30 s, no daily cap) resets the counter (≈14k guesses/day/account). No
   per-number SMS budget (SMS pumping). OTP HMAC is keyed with
   `AGOO_SMS_API_KEY`, so rotating it voids in-flight codes.
8. **Phone verification only gates new users.** The gate runs only when no tag
   exists (`_layout.tsx:198`), and `usePostAuthNavigate` sends anyone with a tag
   to the passcode screen. Those users then fail passcode recovery with
   `verified_phone_required`.
9. **`GET /auth/me` writes on every read.** Each call makes a Clerk API call,
   syncs the avatar and upserts the profile, on every boot and every sign-in.
10. **Redirect races.** _runtime_ Six declarative `<Redirect>`s in `_layout.tsx:194-218`
    plus imperative `router.replace` calls. Correctness depends on mount timing,
    and the tree remounts on `userId` change while `postAuthNavigate` is still
    awaiting.

## Medium

11. Password login sets the pending display name to the email prefix
    (`app/auth/login.tsx:64`), overriding the real name for tag suggestions.
12. `signOutFinora` wipes local data before Clerk `signOut` (`lib/sign-out.ts`), so a
    failed sign-out leaves a signed-in session with no local data. Add-phone's
    "return to sign in" signs out without clearing local data.
13. After a password reset, the user must sign in again manually.
14. An interrupted sign-up (app closed before OTP) can't be resumed: sign-up says
    the email is taken and sign-in fails.
15. Forgot-password reveals which emails have accounts (`signIn.create` errors on
    unknown email).

## UI

16. Developer copy reaches users: "Make sure the API and LAN proxy are running",
    "Could not reach the local API…" (`app/auth/choose-tag.tsx:132`,
    `lib/profile-api.ts:65`).
17. Apple sign-in uses web OAuth instead of the native Apple sheet, and the Apple
    button is shown on Android.
18. The 15-character password rule appears only as placeholder text; the button
    stays disabled with no live hint or strength indicator.
19. The unlock screen gives no feedback after a failed attempt (no remaining
    attempts or lockout timer).
20. Phone entry is Ghana-only, and the UI doesn't say so up front.

## Suggested order

1. (1) + (2) together: hold the onboarding choice in memory until sign-in, make
   the server the source of truth, drive both gates from `/auth/me`, and make the
   tag immutable once set (or require an explicit change-tag flow).
2. (4): attempt limit, "Forgot passcode", and "Sign out" on the lock screen.
3. (3) via plan 002: server-verified approval token after PIN/biometric confirmation.
4. (5)–(10), then medium and UI items.
