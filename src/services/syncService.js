/**
 * SyncService — dual-transport real-time sync engine
 *
 * Transport 1 — BroadcastChannel  (same browser, <1ms, zero network)
 * Transport 2 — MQTT over WSS     (cross-browser / cross-device, ~50ms)
 *
 * Both fire in parallel when dispatching.  Messages arriving on either
 * transport are de-duplicated by message-id so the handler runs only once.
 */
import mqtt from 'mqtt'

/* ── Config ── */
const CHANNEL_NAME  = 'syncread_room'
const LS_FALLBACK   = 'syncRead_broadcast'
const MQTT_BROKER   = 'wss://broker.hivemq.com:8884/mqtt'
const MQTT_BASE     = 'syncread/v1/room'

class SyncService {
  constructor() {
    this.channel       = null   // BroadcastChannel
    this.mqttClient    = null   // MQTT client
    this.listeners     = new Map()
    this.roomId        = null
    this.clientId      = null
    this._sendThrottle = new Map()
    this._lastSent     = new Map()
    this._useFallback  = !('BroadcastChannel' in window)
    this._lsHandler    = null
    this._topic        = null
    /** Dedup: track recently-seen message ids to ignore double-delivery */
    this._seen         = new Set()
  }

  /* ──────────────────────────────────────
     INIT
  ────────────────────────────────────── */
  init(roomId, clientId) {
    this.roomId   = roomId
    this.clientId = clientId
    this._topic   = `${MQTT_BASE}/${roomId}/events`
    this._seen.clear()

    // ── Transport 1: BroadcastChannel (same browser, ultra-low latency) ──
    if (!this._useFallback) {
      this.channel = new BroadcastChannel(`${CHANNEL_NAME}_${roomId}`)
      this.channel.onmessage      = (e) => this._handleMessage(e.data)
      this.channel.onmessageerror = (e) => console.warn('BC error:', e)
    } else {
      // localStorage fallback for browsers without BroadcastChannel
      this._lsHandler = (event) => {
        if (event.key === `${LS_FALLBACK}_${roomId}` && event.newValue) {
          try {
            const data = JSON.parse(event.newValue)
            if (data.clientId !== this.clientId) this._handleMessage(data)
          } catch {}
        }
      }
      window.addEventListener('storage', this._lsHandler)
    }

    // ── Transport 2: MQTT over WSS (cross-browser / cross-device) ──
    this._initMQTT()
  }

  _initMQTT() {
    const mqttClientId =
      `sr_${(this.clientId || '').slice(0, 10)}_${Math.random().toString(36).slice(2, 6)}`

    this.mqttClient = mqtt.connect(MQTT_BROKER, {
      clientId:        mqttClientId,
      clean:           true,
      connectTimeout:  10_000,
      reconnectPeriod: 4_000,
      keepalive:       30,
    })

    this.mqttClient.on('connect', () => {
      this.mqttClient.subscribe(this._topic, { qos: 0 }, (err) => {
        if (err) console.warn('MQTT subscribe error:', err)
      })
    })

    this.mqttClient.on('message', (_topic, payload) => {
      try {
        const data = JSON.parse(payload.toString())
        if (data.clientId !== this.clientId) this._handleMessage(data)
      } catch {}
    })

    this.mqttClient.on('error',       (err) => console.warn('MQTT error:',       err.message))
    this.mqttClient.on('offline',     ()    => console.info ('MQTT offline'))
    this.mqttClient.on('reconnect',   ()    => console.info ('MQTT reconnecting…'))
  }

  /* ──────────────────────────────────────
     SUBSCRIBE
  ────────────────────────────────────── */
  on(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type).add(handler)
    return () => this.listeners.get(type)?.delete(handler)
  }

  /* ──────────────────────────────────────
     INTERNAL MESSAGE HANDLER (dedup)
  ────────────────────────────────────── */
  _handleMessage(data) {
    if (!data || data.roomId !== this.roomId) return
    if (data.clientId === this.clientId)      return

    // Deduplicate — same message may arrive on both transports
    const msgId = data._id || `${data.clientId}_${data.type}_${data.timestamp}`
    if (this._seen.has(msgId)) return
    this._seen.add(msgId)
    // Keep the dedup set from growing unboundedly
    if (this._seen.size > 400) {
      const oldest = [...this._seen].slice(0, 200)
      oldest.forEach(id => this._seen.delete(id))
    }

    const handlers    = this.listeners.get(data.type)
    const allHandlers = this.listeners.get('*')
    if (handlers)    handlers.forEach(fn => fn(data))
    if (allHandlers) allHandlers.forEach(fn => fn(data))
  }

  /* ──────────────────────────────────────
     SEND
  ────────────────────────────────────── */
  send(type, payload, options = {}) {
    const { throttle = 0 } = options
    if (!this.roomId) return

    const message = {
      _id:       `${this.clientId}_${type}_${Date.now()}`,
      type,
      roomId:    this.roomId,
      clientId:  this.clientId,
      timestamp: Date.now(),
      ...payload,
    }

    if (throttle > 0) {
      const key      = `${type}_throttle`
      const existing = this._sendThrottle.get(key)
      if (existing) clearTimeout(existing)
      const tid = setTimeout(() => {
        this._sendThrottle.delete(key)
        this._dispatch(message)
      }, throttle)
      this._sendThrottle.set(key, tid)
    } else {
      this._dispatch(message)
    }
  }

  _dispatch(message) {
    const json = JSON.stringify(message)

    // ── BroadcastChannel / localStorage (same browser) ──
    if (!this._useFallback && this.channel) {
      try { this.channel.postMessage(message) } catch (e) { this._lsFallback(message) }
    } else {
      this._lsFallback(message)
    }

    // ── MQTT (network — cross-browser / cross-device) ──
    if (this.mqttClient?.connected && this._topic) {
      try {
        this.mqttClient.publish(this._topic, json, { qos: 0 })
      } catch (e) {
        console.warn('MQTT publish error:', e)
      }
    }
  }

  _lsFallback(message) {
    try {
      const key = `${LS_FALLBACK}_${this.roomId}`
      localStorage.setItem(key, JSON.stringify(message))
      setTimeout(() => {
        const cur = localStorage.getItem(key)
        if (!cur) return
        try {
          const p = JSON.parse(cur)
          if (p.timestamp === message.timestamp) localStorage.removeItem(key)
        } catch {}
      }, 5000)
    } catch {}
  }

  /* ──────────────────────────────────────
     DESTROY
  ────────────────────────────────────── */
  destroy() {
    for (const [, tid] of this._sendThrottle) clearTimeout(tid)
    this._sendThrottle.clear()
    this._lastSent.clear()
    this.listeners.clear()
    this._seen.clear()

    if (this.channel) {
      this.channel.close()
      this.channel = null
    }
    if (this._lsHandler) {
      window.removeEventListener('storage', this._lsHandler)
      this._lsHandler = null
    }
    if (this.mqttClient) {
      this.mqttClient.end(true)
      this.mqttClient = null
    }

    this.roomId   = null
    this.clientId = null
    this._topic   = null
  }
}

export const syncService = new SyncService()

/* ── Message type constants ── */
export const SYNC_EVENTS = {
  SCROLL:           'scroll',
  PAGE_CHANGE:      'page_change',
  CURSOR:           'cursor',
  HIGHLIGHT_ADD:    'highlight_add',
  HIGHLIGHT_REMOVE: 'highlight_remove',
  USER_JOIN:        'user_join',
  USER_LEAVE:       'user_leave',
  HEARTBEAT:        'heartbeat',
  ROOM_STATE:       'room_state',
  ROLE_UPDATE:      'role_update',
  BOOK_SET:         'book_set',
  CHAT_MESSAGE:     'chat_message',
}
