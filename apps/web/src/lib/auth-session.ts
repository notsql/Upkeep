interface SignInOptions {
  state: { returnTo: string };
}

interface SignOutOptions {
  returnTo: string;
}

let signOutInProgress = false;

export function startSignOut(
  signOut: (options: SignOutOptions) => void,
  returnTo: string
): void {
  signOutInProgress = true;

  try {
    signOut({ returnTo });
  } catch (error) {
    signOutInProgress = false;
    throw error;
  }
}

export function reauthenticateAfterRefreshFailure(
  signIn: (options: SignInOptions) => Promise<void>,
  returnTo: string
): void {
  if (signOutInProgress) {
    return;
  }

  signIn({ state: { returnTo } }).catch(() => undefined);
}
