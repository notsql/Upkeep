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

export async function reauthenticateAfterRefreshFailure(
  signIn: (options: SignInOptions) => Promise<void>,
  returnTo: string,
  onFailure: (error: unknown) => void
): Promise<void> {
  if (signOutInProgress) {
    return;
  }

  try {
    await signIn({ state: { returnTo } });
  } catch (error) {
    onFailure(error);
  }
}
