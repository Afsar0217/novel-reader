/**
 * SocketService — Socket.io client wrapping all real-time communication.
 *
 * Replaces the old BroadcastChannel + MQTT approach with a proper
 * server-side room engine. All room state lives on the server; clients
 * emit events and react to broadcasts.
 */
import { io } from 'socket.io-client'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

/* ── Server events we forward to internal handlers ─────────────── */
const SERVER_EVENTS = [
  'room:participants',
  'room:deleted',
  'book:requested',
  'book:confirm_status',
  'book:start',
  'sync:scroll',
  'sync:page',
  'sync:highlight',
  'sync:cursor',
  'chat:message',
  'role:update',
]

class SocketService {
  constructor() {
    this.socket      = null
    this._roomId     = null
    this._clientId   = null
    this._user       = null
    this._handlers   = new Map()   // event → Set<fn>
    this._connected  = false
  }

  /* ── Connection lifecycle ──────────────────────────────────────── */
  connect() {
    if (this.socket?.connected) return

    this.socket = io(BACKEND_URL, {
      transports:            ['websocket', 'polling'],
      reconnection:          true,
      reconnectionAttempts:  Infinity,
      reconnectionDelay:     1000,
      reconnectionDelayMax:  5000,
    })

    this.socket.on('connect', () => {
      this._connected = true
      // Auto-rejoin room on reconnect / page refresh
      if (this._roomId && this._user) {
        this.joinRoom(this._roomId, this._user).catch(console.warn)
      }
    })

    this.socket.on('disconnect', () => { this._connected = false })
    this.socket.on('connect_error', (e) => console.warn('Socket error:', e.message))

    // Route server events to registered handlers
    SERVER_EVENTS.forEach(evt => {
      this.socket.on(evt, (data) => this._fire(evt, data))
    })
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this._roomId   = null
    this._user     = null
    this._clientId = null
    this._connected = false
  }

  /* ── Room ──────────────────────────────────────────────────────── */
  /**
   * Join or rejoin a room.
   * Returns a Promise that resolves to { room } or rejects with { error }.
   */
  joinRoom(roomId, user) {
    this._roomId   = roomId
    this._user     = user
    this._clientId = user.clientId

    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        return reject(new Error('Socket not connected'))
      }
      const t = setTimeout(() => reject(new Error('Join timeout')), 12_000)
      this.socket.emit('room:join', {
        roomId,
        clientId:    user.clientId,
        username:    user.username,
        avatarColor: user.avatarColor,
      }, (res) => {
        clearTimeout(t)
        if (res?.error) reject(new Error(res.error))
        else            resolve(res)
      })
    })
  }

  leaveRoom() {
    if (!this._roomId || !this._clientId) return
    this.socket?.emit('room:leave', {
      roomId:   this._roomId,
      clientId: this._clientId,
    })
    this._roomId   = null
    this._user     = null
    this._clientId = null
  }

  deleteRoom() {
    if (!this._roomId || !this._clientId) return
    this.socket?.emit('room:delete', {
      roomId:   this._roomId,
      clientId: this._clientId,
    })
  }

  /* ── Book coordination ─────────────────────────────────────────── */
  setBook(book) {
    this._emit('book:set', { book })
  }

  confirmBook() {
    this._emit('book:confirm', {})
  }

  forceStart() {
    this._emit('book:force_start', {})
  }

  /* ── Sync events ───────────────────────────────────────────────── */
  sendScroll(scrollPosition) {
    this._emit('sync:scroll', { scrollPosition })
  }

  sendPage(page) {
    this._emit('sync:page', { page })
  }

  sendHighlight(bookId, highlight) {
    this._emit('sync:highlight', { bookId, highlight })
  }

  sendCursor(x, y, page) {
    if (!this._roomId) return
    this.socket?.emit('sync:cursor', { roomId: this._roomId, x, y, page })
  }

  /* ── Chat ──────────────────────────────────────────────────────── */
  sendChatMessage(message) {
    if (!this._roomId) return
    this.socket?.emit('chat:message', { roomId: this._roomId, message })
  }

  /* ── Role ──────────────────────────────────────────────────────── */
  transferControl(toClientId) {
    if (!this._roomId || !this._clientId) return
    this.socket?.emit('role:transfer', {
      roomId:       this._roomId,
      fromClientId: this._clientId,
      toClientId,
    })
  }

  /* ── Event subscription ────────────────────────────────────────── */
  on(event, handler) {
    if (!this._handlers.has(event)) this._handlers.set(event, new Set())
    this._handlers.get(event).add(handler)
    return () => this._handlers.get(event)?.delete(handler)
  }

  /* ── Getters ───────────────────────────────────────────────────── */
  get isConnected() { return this._connected }
  get currentRoomId() { return this._roomId }

  /* ── Private ───────────────────────────────────────────────────── */
  _emit(event, payload) {
    if (!this._roomId || !this._clientId) return
    this.socket?.emit(event, {
      roomId:   this._roomId,
      clientId: this._clientId,
      ...payload,
    })
  }

  _fire(event, data) {
    this._handlers.get(event)?.forEach(fn => fn(data))
  }
}

export const socketService = new SocketService()
