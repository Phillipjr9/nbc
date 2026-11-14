import { supabase, isSupabaseConfigured } from "./supabase";
import type { BankUserProfile } from "../banking/bankingTypes";

export type AuthState =
  | { status: "loading" }
  | { status: "authenticated"; user: { email: string; id: string } }
  | { status: "unauthenticated" };

/**
 * Get the current Supabase auth session.
 * Returns the user email and ID if authenticated, null otherwise.
 */
export async function getSupabaseSession() {
  if (!isSupabaseConfigured) {
    return null;
  }

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.warn("Supabase session error:", error.message);
    return null;
  }
  return session?.user ?? null;
}

/**
 * Get the current authenticated user.
 */
export async function getCurrentUser(): Promise<{ email: string; id: string } | null> {
  const session = await getSupabaseSession();
  if (!session) return null;
  return { email: session.email, id: session.id };
}

/**
 * Sign in with email and password using Supabase auth.
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ ok: boolean; error?: string; user?: { email: string; id: string } }> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: "Supabase is not configured" };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) {
    let errorMessage = error.message;
    if (error.code === "invalid_login") {
      errorMessage = "Invalid email or password.";
    } else if (error.code === "email_not_found") {
      errorMessage = "No account found with this email.";
    }
    return { ok: false, error: errorMessage };
  }

  if (!data.user) {
    return { ok: false, error: "Authentication failed." };
  }

  return {
    ok: true,
    user: { email: data.user.email!, id: data.user.id },
  };
}

/**
 * Sign up with email and password using Supabase auth.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  fullName: string
): Promise<{ ok: boolean; error?: string; user?: { email: string; id: string } }> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: "Supabase is not configured" };
  }

  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) {
    let errorMessage = error.message;
    if (error.code === "email_already_exists") {
      errorMessage = "An account with this email already exists.";
    } else if (error.code === "weak_password") {
      errorMessage = "Password is too weak. Please use at least 8 characters.";
    }
    return { ok: false, error: errorMessage };
  }

  if (!data.user) {
    return { ok: false, error: "Registration failed." };
  }

  return {
    ok: true,
    user: { email: data.user.email!, id: data.user.id },
  };
}

/**
 * Sign out the current user.
 */
export async function signOut(): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: "Supabase is not configured" };
  }

  const { error } = await supabase.auth.signOut();
  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

/**
 * Reset password for an email address.
 */
export async function resetPassword(email: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: "Supabase is not configured" };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: window.location.origin + "/reset-password",
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

/**
 * Update user password.
 */
export async function updatePassword(
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: "Supabase is not configured" };
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

/**
 * Get auth state change listener callback.
 * This can be used to react to auth state changes (login, logout, token refresh).
 */
export function onAuthStateChange(
  callback: (state: AuthState) => void
): () => void {
  if (!isSupabaseConfigured) {
    callback({ status: "unauthenticated" });
    return () => {};
  }

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
    if (session?.user) {
      callback({
        status: "authenticated",
        user: { email: session.user.email!, id: session.user.id },
      });
    } else {
      callback({ status: "unauthenticated" });
    }
  });

  // Initial state
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session?.user) {
      callback({
        status: "authenticated",
        user: { email: session.user.email!, id: session.user.id },
      });
    } else {
      callback({ status: "unauthenticated" });
    }
  });

  return () => subscription.unsubscribe();
}

/**
 * Check if there's a stored profile for the given Supabase user email.
 * This helps bridge Supabase auth with the local profile system.
 */
export async function findProfileBySupabaseUser(
  userEmail: string,
  profiles: Record<string, BankUserProfile>,
  customProfiles: BankUserProfile[]
): Promise<BankUserProfile | null> {
  const emailLower = userEmail.toLowerCase();

  // Check built-in profiles
  const builtInKeys = ["personal", "business", "wealth"] as const;
  for (const key of builtInKeys) {
    const profile = profiles[key];
    if (profile && profile.email.toLowerCase() === emailLower) {
      return profile;
    }
  }

  // Check custom profiles
  const customProfile = customProfiles.find(
    (p) => p.email.toLowerCase() === emailLower
  );
  if (customProfile) {
    return customProfile;
  }

  return null;
}
