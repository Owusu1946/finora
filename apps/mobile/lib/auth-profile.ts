export type PendingAuthProfile = {
  name: string;
  email: string;
};

let pendingAuthProfile: PendingAuthProfile | null = null;

export function setPendingAuthProfile(profile: PendingAuthProfile) {
  pendingAuthProfile = {
    name: profile.name.trim(),
    email: profile.email.trim().toLowerCase(),
  };
}

export function getPendingAuthProfile() {
  return pendingAuthProfile;
}

export function clearPendingAuthProfile() {
  pendingAuthProfile = null;
}
