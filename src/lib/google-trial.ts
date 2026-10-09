/** Eligibility comes exclusively from the authentication registration hook. */
export function isGoogleTrialEligible(input: {
  providerId: string;
  emailVerified: boolean;
  isNewRegistration: boolean;
}): boolean {
  return (
    input.providerId === 'google' &&
    input.emailVerified === true &&
    input.isNewRegistration === true
  );
}
