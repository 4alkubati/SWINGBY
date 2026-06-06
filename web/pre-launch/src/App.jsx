import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import Layout from './components/Layout'
import PageTransition from './components/PageTransition'
import ErrorBoundary from './components/ErrorBoundary'
import PageSkeleton from './components/PageSkeleton'
import CookieBanner from './components/CookieBanner'
import ProtectedRoute, { RoleProtectedRoute } from './components/ProtectedRoute'
import OfflineBanner from './components/OfflineBanner'

/* Marketing pages */
const Home = lazy(() => import('./pages/Home'))
const HowItWorks = lazy(() => import('./pages/HowItWorks'))
const ForClients = lazy(() => import('./pages/ForClients'))
const ForBusinesses = lazy(() => import('./pages/ForBusinesses'))
const Pricing = lazy(() => import('./pages/Pricing'))
const CategoriesIndex = lazy(() => import('./pages/CategoriesIndex'))
const CategoryPage = lazy(() => import('./pages/CategoryPage'))
const CitiesIndex = lazy(() => import('./pages/CitiesIndex'))
const CalgaryPage = lazy(() => import('./pages/CalgaryPage'))
const Safety = lazy(() => import('./pages/Safety'))
const About = lazy(() => import('./pages/About'))
const Press = lazy(() => import('./pages/Press'))
const Careers = lazy(() => import('./pages/Careers'))
const Contact = lazy(() => import('./pages/Contact'))
const Download = lazy(() => import('./pages/Download'))

/* Help + Blog */
const HelpCenter = lazy(() => import('./pages/HelpCenter'))
const HelpArticle = lazy(() => import('./pages/HelpArticle'))
const BlogIndex = lazy(() => import('./pages/BlogIndex'))
const BlogPost = lazy(() => import('./pages/BlogPost'))

/* Auth */
const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const AuthCallback = lazy(() => import('./pages/AuthCallback'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'))

/* Onboarding */
const ClientOnboarding = lazy(() => import('./pages/ClientOnboarding'))
const BusinessOnboarding = lazy(() => import('./pages/BusinessOnboarding'))

/* Client dashboard */
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Bookings = lazy(() => import('./pages/Bookings'))
const BookingDetail = lazy(() => import('./pages/BookingDetail'))
const Messages = lazy(() => import('./pages/Messages'))
const MessageThread = lazy(() => import('./pages/MessageThread'))
const Profile = lazy(() => import('./pages/Profile'))
const Reviews = lazy(() => import('./pages/Reviews'))
const Favorites = lazy(() => import('./pages/Favorites'))
const SavedSearches = lazy(() => import('./pages/SavedSearches'))
const PaymentMethods = lazy(() => import('./pages/PaymentMethods'))
const AccountSettings = lazy(() => import('./pages/AccountSettings'))
const NotificationSettings = lazy(() => import('./pages/NotificationSettings'))
const PrivacySettings = lazy(() => import('./pages/PrivacySettings'))

/* Business dashboard */
const BusinessDashboard = lazy(() => import('./pages/BusinessDashboard'))
const BusinessEarnings = lazy(() => import('./pages/BusinessEarnings'))
const BusinessEmployees = lazy(() => import('./pages/BusinessEmployees'))
const BusinessServices = lazy(() => import('./pages/BusinessServices'))
const BusinessProfile = lazy(() => import('./pages/BusinessProfile'))

/* Legal */
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'))
const TermsPage = lazy(() => import('./pages/TermsPage'))
const CookiesPage = lazy(() => import('./pages/CookiesPage'))
const AccessibilityPage = lazy(() => import('./pages/AccessibilityPage'))
const Maintenance = lazy(() => import('./pages/Maintenance'))

/* Error */
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
const ServerError = lazy(() => import('./pages/ServerError'))

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <Layout>
      <AnimatePresence mode="wait">
        <Suspense fallback={<PageSkeleton />}>
          <Routes location={location} key={location.pathname}>
            {/* Marketing */}
            <Route path="/" element={<PageTransition><Home /></PageTransition>} />
            <Route path="/how-it-works" element={<PageTransition><HowItWorks /></PageTransition>} />
            <Route path="/for-clients" element={<PageTransition><ForClients /></PageTransition>} />
            <Route path="/for-businesses" element={<PageTransition><ForBusinesses /></PageTransition>} />
            <Route path="/pricing" element={<PageTransition><Pricing /></PageTransition>} />
            <Route path="/categories" element={<PageTransition><CategoriesIndex /></PageTransition>} />
            <Route path="/categories/:slug" element={<PageTransition><CategoryPage /></PageTransition>} />
            <Route path="/cities" element={<PageTransition><CitiesIndex /></PageTransition>} />
            <Route path="/cities/calgary" element={<PageTransition><CalgaryPage /></PageTransition>} />
            <Route path="/safety" element={<PageTransition><Safety /></PageTransition>} />
            <Route path="/about" element={<PageTransition><About /></PageTransition>} />
            <Route path="/press" element={<PageTransition><Press /></PageTransition>} />
            <Route path="/careers" element={<PageTransition><Careers /></PageTransition>} />
            <Route path="/contact" element={<PageTransition><Contact /></PageTransition>} />
            <Route path="/download" element={<PageTransition><Download /></PageTransition>} />

            {/* Help + Blog */}
            <Route path="/help" element={<PageTransition><HelpCenter /></PageTransition>} />
            <Route path="/help/:slug" element={<PageTransition><HelpArticle /></PageTransition>} />
            <Route path="/blog" element={<PageTransition><BlogIndex /></PageTransition>} />
            <Route path="/blog/:slug" element={<PageTransition><BlogPost /></PageTransition>} />

            {/* Auth */}
            <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
            <Route path="/signup" element={<PageTransition><Signup /></PageTransition>} />
            <Route path="/auth/callback" element={<PageTransition><AuthCallback /></PageTransition>} />
            <Route path="/forgot-password" element={<PageTransition><ForgotPassword /></PageTransition>} />
            <Route path="/reset-password" element={<PageTransition><ResetPassword /></PageTransition>} />
            <Route path="/verify-email" element={<PageTransition><VerifyEmail /></PageTransition>} />

            {/* Onboarding */}
            <Route path="/onboarding/client" element={<ProtectedRoute><PageTransition><ClientOnboarding /></PageTransition></ProtectedRoute>} />
            <Route path="/onboarding/business/*" element={<ProtectedRoute><PageTransition><BusinessOnboarding /></PageTransition></ProtectedRoute>} />

            {/* Client Dashboard */}
            <Route path="/dashboard" element={<ProtectedRoute><PageTransition><Dashboard /></PageTransition></ProtectedRoute>} />
            <Route path="/bookings" element={<ProtectedRoute><PageTransition><Bookings /></PageTransition></ProtectedRoute>} />
            <Route path="/bookings/:id" element={<ProtectedRoute><PageTransition><BookingDetail /></PageTransition></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute><PageTransition><Messages /></PageTransition></ProtectedRoute>} />
            <Route path="/messages/:bookingId" element={<ProtectedRoute><PageTransition><MessageThread /></PageTransition></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><PageTransition><Profile /></PageTransition></ProtectedRoute>} />
            <Route path="/reviews" element={<ProtectedRoute><PageTransition><Reviews /></PageTransition></ProtectedRoute>} />
            <Route path="/favorites" element={<ProtectedRoute><PageTransition><Favorites /></PageTransition></ProtectedRoute>} />
            <Route path="/searches" element={<ProtectedRoute><PageTransition><SavedSearches /></PageTransition></ProtectedRoute>} />
            <Route path="/payment-methods" element={<ProtectedRoute><PageTransition><PaymentMethods /></PageTransition></ProtectedRoute>} />
            <Route path="/account" element={<ProtectedRoute><PageTransition><AccountSettings /></PageTransition></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><PageTransition><NotificationSettings /></PageTransition></ProtectedRoute>} />
            <Route path="/privacy-settings" element={<ProtectedRoute><PageTransition><PrivacySettings /></PageTransition></ProtectedRoute>} />

            {/* Business Dashboard */}
            <Route path="/business/dashboard" element={<RoleProtectedRoute allowedRoles={['business_owner']}><PageTransition><BusinessDashboard /></PageTransition></RoleProtectedRoute>} />
            <Route path="/business/earnings" element={<RoleProtectedRoute allowedRoles={['business_owner']}><PageTransition><BusinessEarnings /></PageTransition></RoleProtectedRoute>} />
            <Route path="/business/employees" element={<RoleProtectedRoute allowedRoles={['business_owner']}><PageTransition><BusinessEmployees /></PageTransition></RoleProtectedRoute>} />
            <Route path="/business/services" element={<RoleProtectedRoute allowedRoles={['business_owner']}><PageTransition><BusinessServices /></PageTransition></RoleProtectedRoute>} />
            <Route path="/business/profile" element={<RoleProtectedRoute allowedRoles={['business_owner']}><PageTransition><BusinessProfile /></PageTransition></RoleProtectedRoute>} />

            {/* Legal */}
            <Route path="/privacy" element={<PageTransition><PrivacyPage /></PageTransition>} />
            <Route path="/terms" element={<PageTransition><TermsPage /></PageTransition>} />
            <Route path="/cookies" element={<PageTransition><CookiesPage /></PageTransition>} />
            <Route path="/accessibility" element={<PageTransition><AccessibilityPage /></PageTransition>} />
            <Route path="/maintenance" element={<PageTransition><Maintenance /></PageTransition>} />

            {/* Error */}
            <Route path="/500" element={<PageTransition><ServerError /></PageTransition>} />
            <Route path="*" element={<PageTransition><NotFoundPage /></PageTransition>} />
          </Routes>
        </Suspense>
      </AnimatePresence>
    </Layout>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <a href="#main-content" className="skip-to-content">Skip to content</a>
        <OfflineBanner />
        <ErrorBoundary>
          <AnimatedRoutes />
        </ErrorBoundary>
        <CookieBanner />
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: {
              background: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
            },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  )
}
