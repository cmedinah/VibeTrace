/** Same normalization as lists, grouping, and OpenCode directory headers */
export function normalizeSessionDirectory(dir: string | undefined): string {
  if (!dir || dir === 'Unknown') return ''
  return dir.replace(/\\/g, '/').replace(/\/+$/, '')
}

/**
 * Extract directory from a session object.
 * OpenCode v2 returns sessions with location.directory instead of directory directly.
 */
export function getSessionDirectory(session: { directory?: string; location?: { directory?: string } } | undefined): string {
  if (!session) return ''
  // v2 format: location.directory
  if (session.location?.directory) {
    return normalizeSessionDirectory(session.location.directory)
  }
  // v1 format: directory directly
  if (session.directory) {
    return normalizeSessionDirectory(session.directory)
  }
  return ''
}

export function folderDisplayName(normalizedDir: string): string {
  if (!normalizedDir) return 'Current workspace'
  const parts = normalizedDir.split('/').filter(Boolean)
  return parts[parts.length - 1] || normalizedDir
}

export function uniqueDirectoriesFromSessions(sessions: { directory?: string; location?: { directory?: string } }[]): string[] {
  const set = new Set<string>()
  for (const s of sessions) {
    const dir = getSessionDirectory(s)
    if (dir) set.add(dir)
  }
  return [...set].sort((a, b) => folderDisplayName(a).localeCompare(folderDisplayName(b), 'en'))
}
