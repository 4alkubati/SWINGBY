import { useState, useEffect } from 'react'

export default function useOffline() {
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    function handleOnline() { setOffline(false) }
    function handleOffline() { setOffline(true) }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return offline
}
