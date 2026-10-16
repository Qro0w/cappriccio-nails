import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Btn, Shell } from './components/ui'
import Home from './pages/client/Home'
import Book from './pages/client/Book'
import MyBooking from './pages/client/MyBooking'
import Policies from './pages/client/Policies'
import ForgotCode from './pages/client/ForgotCode'
import Photos from './pages/admin/Photos'
import AdminLayout from './pages/admin/AdminLayout'
import Login from './pages/admin/Login'
import Dashboard from './pages/admin/Dashboard'
import BookingDetail from './pages/admin/BookingDetail'
import Schedule from './pages/admin/Schedule'
import Settings from './pages/admin/Settings'
import Earnings from './pages/admin/Earnings'
import NewBooking from './pages/admin/NewBooking'
import PolicyEditor from './pages/admin/PolicyEditor'
import Bebi from './pages/admin/Bebi'
import ErrorBoundary from './components/ErrorBoundary'

// Every page fades up gently when you open it
function NotFound() {
  return (
    <Shell>
      <div className="space-y-4 py-10 text-center">
        <h1 className="font-display text-3xl font-semibold">Page not found</h1>
        <p className="text-sm text-cream/75">This link doesn’t go anywhere. It may have been typed wrong.</p>
        <Btn as={Link} to="/" className="w-full">Go to the home page</Btn>
      </div>
    </Shell>
  )
}

function AnimatedRoutes() {
  const loc = useLocation()
  // nailtech pages share one layout (it animates its own content), so keep it mounted between tabs
  const inAdmin = loc.pathname.startsWith('/admin') && loc.pathname !== '/admin/login'
  return (
    <div key={inAdmin ? 'admin' : loc.pathname} className="page-in">
      <Routes location={loc}>
        <Route path="/" element={<Home />} />
        <Route path="/book" element={<Book />} />
        <Route path="/my-booking" element={<MyBooking />} />
        <Route path="/policies" element={<Policies />} />
        <Route path="/forgot-code" element={<ForgotCode />} />
        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="booking/:id" element={<BookingDetail />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="photos" element={<Photos />} />
          <Route path="settings" element={<Settings />} />
          <Route path="earnings" element={<Earnings />} />
          <Route path="new" element={<NewBooking />} />
          <Route path="policies" element={<PolicyEditor />} />
          <Route path="bebi" element={<Bebi />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AnimatedRoutes />
      </BrowserRouter>
    </ErrorBoundary>
  )
}
