import { v4 as uuidv4 } from 'uuid'

export const generateUUID = () => uuidv4()

export const generateClientId = () => `client_${uuidv4().replace(/-/g, '').slice(0, 16)}`

export const generateUsername = () => {
  const adjectives = ['Swift', 'Calm', 'Bright', 'Deep', 'Bold', 'Wise', 'Keen', 'Soft']
  const nouns = ['Reader', 'Thinker', 'Scholar', 'Mind', 'Sage', 'Seeker', 'Scribe']
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  const num = Math.floor(Math.random() * 9000) + 1000
  return `${adj}${noun}${num}`
}

export const generateRoomId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let id = ''
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)]
  }
  return `${id.slice(0, 4)}-${id.slice(4)}`
}

/**
 * Deterministic bookId based on filename + file size.
 * Two users uploading the exact same file will always get the same ID,
 * which is what enables room book-matching without a server.
 */
export const generateBookId = (filename, fileSize = 0) => {
  const base = filename.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)
  const sizeTag = fileSize ? fileSize.toString(36) : '0'
  return `book_${base}_${sizeTag}`
}

export const generateHighlightId = () => `hl_${uuidv4().slice(0, 8)}`

export const generateAnnotationId = () => `ann_${uuidv4().slice(0, 8)}`
