export const PLATFORM_NAME = 'MentorIA'

function cleanText(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function getSchoolOrPlatformName(schoolName?: string | null): string {
  return cleanText(schoolName) || PLATFORM_NAME
}

export function buildPortalBrandLine(schoolName?: string | null): string {
  const cleanSchoolName = cleanText(schoolName)
  return cleanSchoolName ? `${cleanSchoolName}, un colegio que usa ${PLATFORM_NAME}` : PLATFORM_NAME
}
