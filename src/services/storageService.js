import { openDB } from 'idb'

const DB_NAME = 'syncread_db'
const DB_VERSION = 1
const PDF_STORE = 'pdf_files'

let db = null

const getDB = async () => {
  if (db) return db
  db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(PDF_STORE)) {
        database.createObjectStore(PDF_STORE)
      }
    },
  })
  return db
}

export const storePDF = async (bookId, arrayBuffer) => {
  try {
    const database = await getDB()
    await database.put(PDF_STORE, arrayBuffer, bookId)
    return true
  } catch (e) {
    console.warn('IndexedDB storage failed, using memory only:', e)
    return false
  }
}

export const retrievePDF = async (bookId) => {
  try {
    const database = await getDB()
    return await database.get(PDF_STORE, bookId)
  } catch (e) {
    console.warn('IndexedDB retrieval failed:', e)
    return null
  }
}

export const deletePDF = async (bookId) => {
  try {
    const database = await getDB()
    await database.delete(PDF_STORE, bookId)
    return true
  } catch (e) {
    return false
  }
}

export const listStoredPDFs = async () => {
  try {
    const database = await getDB()
    return await database.getAllKeys(PDF_STORE)
  } catch (e) {
    return []
  }
}

/* ── localStorage helpers ── */

export const lsSet = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.warn('localStorage write failed:', e)
  }
}

export const lsGet = (key, fallback = null) => {
  try {
    const raw = localStorage.getItem(key)
    return raw !== null ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export const lsDel = (key) => {
  try {
    localStorage.removeItem(key)
  } catch {}
}

/* ── Memory cache for PDF buffers ── */

const pdfBufferCache = new Map()

export const cachePDFBuffer = (bookId, buffer) => {
  pdfBufferCache.set(bookId, buffer)
}

export const getCachedPDFBuffer = (bookId) => {
  return pdfBufferCache.get(bookId) || null
}

export const clearPDFBuffer = (bookId) => {
  pdfBufferCache.delete(bookId)
}
