import { useState, useEffect, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Sidebar from '@/components/Sidebar'
import ProtectedRoute from '@/components/ProtectedRoute'
import CommandPalette from '@/components/CommandPalette'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import UsersPage from '@/pages/UsersPage'
import BusinessesPage from '@/pages/BusinessesPage'
import BookingsPage from '@/pages/BookingsPage'
import AuditLogPage from '@/pages/AuditLogPage'

function AdminLayout() {
  const [paletteOpen, setPaletteOpen] = useState(false)

  const openPalette = useCallback(() => setPaletteOpen(true), [])
  const closePalette = useCallback(() => setPaletteOpen(false), [])

  useEffect(() => {
    function handleKeyDown(e) {
      const isK = e.key === 'k' || e.key === 'K'
      const withModifier = e.metaKey || e.ctrlKey
      if (isK && withModifier) {
        e.preventDefault()
        setPaletteOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="admin-layout">
      <Sidebar />
      <main className="admin-main" id="main-content">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/businesses" element={<BusinessesPage />} />
          <Route path="/bookings" element={<BookingsPage />} />
          <Route path="/audit-log" element={<AuditLogPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <CommandPalette open={paletteOpen} onClose={closePalette} />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <a href="#main-content" className="skip-to-content">Skip to content</a>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
