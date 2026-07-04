import { useEffect } from 'react'
import echo from '../echo'
import { useAuthStore } from '../store/useAuthStore'

// Tutti i canali sono ora privati (B-09). Entrambi gli hook usano echo.private()
// e chiamano echo.leave() al cleanup per liberare la subscription su Reverb.

export function useWebSocket(channel, eventName, callback) {
  const { token } = useAuthStore()

  useEffect(() => {
    if (!token) return
    const ch = echo.private(channel)
    ch.listen(eventName, callback)
    return () => {
      ch.stopListening(eventName)
      echo.leave(channel)
    }
  }, [token, channel, eventName])
}

export function usePrivateChannel(channel, eventName, callback) {
  const { token } = useAuthStore()

  useEffect(() => {
    if (!token) return
    const ch = echo.private(channel)
    ch.listen(eventName, callback)
    return () => {
      ch.stopListening(eventName)
      echo.leave(channel)
    }
  }, [token, channel, eventName])
}
