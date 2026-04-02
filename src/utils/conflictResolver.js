/**
 * Resolves conflicts when multiple users try to control reading position.
 * Strategy: Priority-based (owner > reader > viewer), tie-break: latest timestamp
 */

export const ROLE_PRIORITY = { owner: 3, reader: 2, viewer: 1 }

export const resolveScrollConflict = (updates) => {
  if (!updates || updates.length === 0) return null
  if (updates.length === 1) return updates[0]

  return updates.reduce((winner, candidate) => {
    const wp = ROLE_PRIORITY[winner.role] || 0
    const cp = ROLE_PRIORITY[candidate.role] || 0
    if (cp > wp) return candidate
    if (cp === wp && candidate.timestamp > winner.timestamp) return candidate
    return winner
  })
}

export const mergeRoomState = (local, remote) => {
  if (!local) return remote
  if (!remote) return local

  return {
    ...local,
    ...remote,
    users: mergeUsers(local.users || [], remote.users || []),
    highlights: mergeHighlights(local.highlights || [], remote.highlights || []),
    cursors: { ...(local.cursors || {}), ...(remote.cursors || {}) },
  }
}

const mergeUsers = (localUsers, remoteUsers) => {
  const map = new Map()
  localUsers.forEach(u => map.set(u.clientId, u))
  remoteUsers.forEach(u => {
    const existing = map.get(u.clientId)
    if (!existing || u.lastSeen > existing.lastSeen) {
      map.set(u.clientId, u)
    }
  })
  return Array.from(map.values())
}

const mergeHighlights = (local, remote) => {
  const map = new Map()
  local.forEach(h => map.set(h.id, h))
  remote.forEach(h => {
    if (!map.has(h.id)) map.set(h.id, h)
  })
  return Array.from(map.values())
}

export const createDelta = (prev, next) => {
  const delta = {}
  for (const key of Object.keys(next)) {
    if (JSON.stringify(prev[key]) !== JSON.stringify(next[key])) {
      delta[key] = next[key]
    }
  }
  return Object.keys(delta).length > 0 ? delta : null
}

export const applyDelta = (state, delta) => {
  if (!delta) return state
  return { ...state, ...delta }
}
