import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'
import DashboardLayout from './components/DashboardLayout'
import ProtectedRoute, { RoleRoute } from './components/ProtectedRoute'
import Spinner from './components/Spinner'
import { useUser } from './hooks/useUser'

const MAINTENANCE = import.meta.env.VITE_MAINTENANCE_MODE === 'true'

/* ── Marketing ────────────────────────────────────────────────────────────── */
const Home                  = lazy(() => import('./pages/Home'))
const HowItWorks            = lazy(() => import('./pages/HowItWorks'))
const HowItWorksClients     = lazy(() => import('./pages/HowItWorksClients'))
const HowItWorksBusinesses  = lazy(() => import('./pages/HowItWorksBusinesses'))
const ForClients            = lazy(() => import('./pages/ForClients'))
const ForBusinesses         = lazy(() => import('./pages/ForBusinesses'))
const Pricing               = lazy(() => import('./pages/Pricing'))
const Safety                = lazy(() => import('./pages/Safety'))
const CategoriesIndex       = lazy(() => import('./pages/CategoriesIndex'))
const CategoryPage          = lazy(() => import('./pages/CategoryPage'))
const CalgaryPage           = lazy(() => import('./pages/CalgaryPage'))
const LocationCategoryPage  = lazy(() => import('./pages/LocationCategoryPage'))
const About                 = lazy(() => import('./pages/About'))
const BlogIndex             = lazy(() => import('./pages/BlogIndex'))
const BlogPost              = lazy(() => import('./pages/BlogPost'))
const HelpCenter            = lazy(() => import('./pages/HelpCenter'))
const HelpArticle           = lazy(() => import('./pages/HelpArticle'))
const Careers               = lazy(() => import('./pages/Careers'))
const Press                 = lazy(() => import('./pages/Press'))
const Contact               = lazy(() => import('./pages/Contact'))

/* ── Legal ────────────────────────────────────────────────────────────────── */
const PrivacyPage           = lazy(() => import('./pages/PrivacyPage'))
const TermsPage             = lazy(() => import('./pages/TermsPage'))
const CookiesPage           = lazy(() => import('./pages/CookiesPage'))
const AccessibilityPage     = lazy(() => import('./pages/AccessibilityPage'))

/* ── Auth ─────────────────────────────────────────────────────────────────── */
const Login                 = lazy(() => import('./pages/Login'))
const Signup                = lazy(() => import('./pages/Signup'))
const ForgotPassword        = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword         = lazy(() => import('./pages/ResetPassword'))
const AuthCallback          = lazy(() => import('./pages/AuthCallback'))
const VerifyEmail           = lazy(() => import('./pages/VerifyEmail'))

/* ── App / shared ─────────────────────────────────────────────────────────── */
const AppRedirect           = lazy(() => import('./pages/app/AppRedirect'))
const Bookings              = lazy(() => import('./pages/app/Bookings'))
const BookingDetail         = lazy(() => import('./pages/app/BookingDetail'))
const Messages              = lazy(() => import('./pages/app/Messages'))
const MessageThread         = lazy(() => import('./pages/app/MessageThread'))
const Profile               = lazy(() => import('./pages/app/Profile'))
const AccountSettings       = lazy(() => import('./pages/app/AccountSettings'))
const NotificationSettings  = lazy(() => import('./pages/app/NotificationSettings'))
const PrivacySettings       = lazy(() => import('./pages/app/PrivacySettings'))
const PaymentMethods        = lazy(() => import('./pages/app/PaymentMethods'))

/* ── Client-only ──────────────────────────────────────────────────────────── */
const ClientDashboard       = lazy(() => import('./pages/app/ClientDashboard'))
const PostJob               = lazy(() => import('./pages/app/PostJob'))
const Favorites             = lazy(() => import('./pages/app/Favorites'))
const SavedSearches         = lazy(() => import('./pages/app/SavedSearches'))

/* ── Business-only ────────────────────────────────────────────────────────── */
const BizDashboard          = lazy(() => import('./pages/app/BizDashboard'))
const BusinessOnboarding    = lazy(() => import('./pages/app/BusinessOnboarding'))
const BusinessProfile       = lazy(() => import('./pages/app/BusinessProfile'))
const BusinessServices      = lazy(() => import('./pages/app/BusinessServices'))
const BusinessEmployees     = lazy(() => import('./pages/app/BusinessEmployees'))
const BusinessAnalytics     = lazy(() => import('./pages/app/BusinessAnalytics'))
const BusinessEarnings      = lazy(() => import('./pages/app/BusinessEarnings'))
const BusinessExports       = lazy(() => import('./pages/app/BusinessExports'))
const BusinessIntegrations  = lazy(() => import('./pages/app/BusinessIntegrations'))
const ApiKeys               = lazy(() => import('./pages/app/ApiKeys'))

/* ── Misc ─────────────────────────────────────────────────────────────────── */
const StatusPage            = lazy(() => import('./pages/StatusPage'))
const Maintenance           = lazy(() => import('./pages/Maintenance'))
const NotFound              = lazy(() => import('./pages/NotFound'))

function SmartDashboard() {
  const { data: user, isLoading } = useUser()
  if (isLoading) return <Spinner />
  if (user?.role === 'business_owner') return <BizDashboard />
  return <ClientDashboard />
}

function AppRoutes() {
  return (
    <Routes>
      {/* ── Marketing (public, with Layout) ─────────────────────────────── */}
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/how-it-works/clients" element={<HowItWorksClients />} />
        <Route path="/how-it-works/businesses" element={<HowItWorksBusinesses />} />
        <Route path="/for-clients" element={<ForClients />} />
        <Route path="/for-businesses" element={<ForBusinesses />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/safety" element={<Safety />} />
        <Route path="/categories" element={<CategoriesIndex />} />
        <Route path="/categories/:slug" element={<CategoryPage />} />
        <Route path="/calgary" element={<CalgaryPage />} />
        <Route path="/calgary/:neighbourhood/:category" element={<LocationCategoryPage />} />
        <Route path="/about" element={<About />} />
        <Route path="/blog" element={<BlogIndex />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="/help" element={<HelpCenter />} />
        <Route path="/help/:slug" element={<HelpArticle />} />
        <Route path="/careers" element={<Careers />} />
        <Route path="/press" element={<Press />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/cookies" element={<CookiesPage />} />
        <Route path="/accessibility" element={<AccessibilityPage />} />

        {/* Auth (public) */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
      </Route>

      {/* ── App (protected, with DashboardLayout) ───────────────────────── */}
      <Route path="/app" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route index element={<AppRedirect />} />
        <Route path="dashboard" element={<SmartDashboard />} />
        <Route path="bookings" element={<Bookings />} />
        <Route path="bookings/:id" element={<BookingDetail />} />
        <Route path="messages" element={<Messages />} />
        <Route path="messages/:bookingId" element={<MessageThread />} />
        <Route path="profile" element={<Profile />} />
        <Route path="settings/account" element={<AccountSettings />} />
        <Route path="settings/notifications" element={<NotificationSettings />} />
        <Route path="settings/privacy" element={<PrivacySettings />} />
        <Route path="settings/payment" element={<PaymentMethods />} />
        <Route path="settings/api-keys" element={<RoleRoute allowedRoles={['business_owner']}><ApiKeys /></RoleRoute>} />

        {/* Client-only */}
        <Route path="post" element={<RoleRoute allowedRoles={['client']}><PostJob /></RoleRoute>} />
        <Route path="favorites" element={<RoleRoute allowedRoles={['client']}><Favorites /></RoleRoute>} />
        <Route path="saved-searches" element={<RoleRoute allowedRoles={['client']}><SavedSearches /></RoleRoute>} />

        {/* Business-only */}
        <Route path="business/onboarding" element={<RoleRoute allowedRoles={['business_owner']}><BusinessOnboarding /></RoleRoute>} />
        <Route path="business/profile" element={<RoleRoute allowedRoles={['business_owner']}><BusinessProfile /></RoleRoute>} />
        <Route path="business/services" element={<RoleRoute allowedRoles={['business_owner']}><BusinessServices /></RoleRoute>} />
        <Route path="business/employees" element={<RoleRoute allowedRoles={['business_owner']}><BusinessEmployees /></RoleRoute>} />
        <Route path="business/analytics" element={<RoleRoute allowedRoles={['business_owner']}><BusinessAnalytics /></RoleRoute>} />
        <Route path="business/earnings" element={<RoleRoute allowedRoles={['business_owner']}><BusinessEarnings /></RoleRoute>} />
        <Route path="business/exports" element={<RoleRoute allowedRoles={['business_owner']}><BusinessExports /></RoleRoute>} />
        <Route path="business/integrations" element={<RoleRoute allowedRoles={['business_owner']}><BusinessIntegrations /></RoleRoute>} />
      </Route>

      {/* ── Misc ─────────────────────────────────────────────────────────── */}
      <Route path="/status" element={<StatusPage />} />
      <Route path="/maintenance" element={<Maintenance />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default function App() {
  if (MAINTENANCE) {
    return (
      <BrowserRouter>
        <Suspense fallback={<Spinner />}>
          <Routes>
            <Route path="/status" element={<StatusPage />} />
            <Route path="*" element={<Maintenance />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    )
  }

  return (
    <BrowserRouter>
      <a href="#main-content" className="skip-to-content">Skip to main content</a>
      <ErrorBoundary>
        <Suspense fallback={<Spinner />}>
          <AppRoutes />
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
