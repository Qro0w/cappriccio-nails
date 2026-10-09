import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Home from './pages/client/Home'
import Book from './pages/client/Book'
import MyBooking from './pages/client/MyBooking'
import AdminLayout from './pages/admin/AdminLayout'
import Login from './pages/admin/Login'
import Dashboard from './pages/admin/Dashboard'
import BookingDetail from './pages/admin/BookingDetail'
import Schedule from './pages/admin/Schedule'
import Settings from './pages/admin/Settings'
import ErrorBoundary from './components/ErrorBoundary'

export default function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/book" element={<Book />} />
        <Route path="/my-booking" element={<MyBooking />} />
        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="booking/:id" element={<BookingDetail />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  )
}
