// Never log the phone, OTP, auth email, tokens, or the raw provider error.
export function logFamilyAccessFailure(stage: string, error: unknown) {
  const errorCode = error && typeof error === 'object' && 'code' in error
    && typeof error.code === 'string' ? error.code : 'unknown'
  console.error('[family-access]', { stage, errorCode })
}
