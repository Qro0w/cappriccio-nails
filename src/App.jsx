import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
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
import ErrorBoundary from './components/ErrorBoundary'

// Every page fades up gently when you open it
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
        </Route>
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
