/**
 * SocketService — Socket.io client wrapping all real-time communication.
 */
import { io } from 'socket.io-client'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

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
    this.socket     = null
    this._roomId    = null
    this._clientId  = null
    this._user      = null
    this._handlers  = new Map()
    this._connected = false
  }

  /* ── Connection lifecycle ──────────────────────────────────────── */

  /**
   * connect() — creates the socket if it doesn't exist yet.
   * Returns a Promise that resolves when the socket is connected.
   */
  connect() {
    // Already connected — resolve immediately
    if (this.socket?.connected) return Promise.resolve()

    // Socket is being created but not yet connected — wait for it
    if (this.socket) {
      return new Promise((resolve, reject) => {
        this.socket.once('connect', resolve)
        this.socket.once('connect_error', (e) => reject(new Error(e.message)))
      })
    }

    // First call — create the socket
    this.socket = io(BACKEND_URL, {
      transports:           ['websocket', 'polling'],
      reconnection:         true,
      reconnectionAttempts: Infinity,
      reconnectionDelay:    1000,
      reconnectionDelayMax: 5000,
      timeout:              10000,
    })

    this.socket.on('connect', () => {
      this._connected = true
      // Auto-rejoin if we have a saved room (handles page refresh)
      if (this._roomId && this._user) {
        this._doJoin(this._roomId, this._user).catch(console.warn)
      }
    })

    this.socket.on('disconnect', () => { this._connected = false })
    this.socket.on('connect_error', (e) => console.warn('Socket error:', e.message))

    SERVER_EVENTS.forEach(evt => {
      this.socket.on(evt, (data) => this._fire(evt, data))
    })

    // Return a promise that resolves once connected
    return new Promise((resolve, reject) => {
      const t = setTimeout(
        () => reject(new Error('Connection timeout — is the server running?')),
        12_000
      )
      this.socket.once('connect', () => { clearTimeout(t); resolve() })
      this.socket.once('connect_error', (e) => { clearTimeout(t); reject(new Error(e.message)) })
    })
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this._roomId    = null
    this._user      = null
    this._clientId  = null
    this._connected = false
  }

  /* ── Room ──────────────────────────────────────────────────────── */

  /**
   * joinRoom() — connects if needed, then joins the room.
   * Always awaits the socket connection before emitting.
   */
  async joinRoom(roomId, user) {
    this._roomId   = roomId
    this._user     = user
    this._clientId = user.clientId

    // Make sure we're connected first
    await this.connect()
    return this._doJoin(roomId, user)
  }

  /** Internal: emit room:join and await the ack */
  _doJoin(roomId, user) {
    return new Promise((resolve, reject) => {
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
  setBook(book)   { this._emit('book:set',         { book }) }
  confirmBook()   { this._emit('book:confirm',      {}) }
  forceStart()    { this._emit('book:force_start',  {}) }

  /* ── Sync events ───────────────────────────────────────────────── */
  sendScroll(scrollPosition)          { this._emit('sync:scroll',    { scrollPosition }) }
  sendPage(page)                      { this._emit('sync:page',      { page }) }
  sendHighlight(bookId, highlight)    { this._emit('sync:highlight', { bookId, highlight }) }

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
  get isConnected()  { return this._connected }
  get currentRoomId(){ return this._roomId }

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
