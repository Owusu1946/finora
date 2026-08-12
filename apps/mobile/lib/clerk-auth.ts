type ClerkFieldError = {
  message?: string;
  longMessage?: string;
};

type ClerkOperationError = {
  errors?: ClerkFieldError[];
  message?: string;
};

export function clerkErrorMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== 'object') return fallback;

  const candidate = error as ClerkOperationError;
  const first = candidate.errors?.[0];
  return first?.longMessage ?? first?.message ?? candidate.message ?? fallback;
}

export function clerkFieldErrorMessage(
  field: ClerkFieldError | null | undefined,
  fallback?: string,
) {
  return field?.longMessage ?? field?.message ?? fallback;
}
