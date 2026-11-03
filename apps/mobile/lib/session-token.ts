import { getClerkInstance } from '@clerk/expo';

/** How long to wait for Clerk to restore the session on a cold start. */
const SESSION_WAIT_MS = 10_000;

/**
 * The signed-in user's API token, for code outside React. Clerk restores the
 * session asynchronously after a cold start, so a screen that loads right away
 * would otherwise find no token.
 */
export async function sessionToken() {
  const clerk = getClerkInstance();
  if (!clerk.loaded) {
    await new Promise<void>((resolve) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let unsubscribe = () => {};
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        unsubscribe();
        resolve();
      };
      timer = setTimeout(finish, SESSION_WAIT_MS);
      unsubscribe = clerk.addListener(() => {
        if (clerk.loaded) finish();
      });
      if (clerk.loaded) finish();
    });
  }
  return (await clerk.session?.getToken()) ?? null;
}
