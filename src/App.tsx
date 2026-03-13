// ===============================
// src/App.tsx
// Bu route güncellemesi, katalog başlangıcını ve sohbet alt yolunu ayırır.
// ===============================
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Assets from './pages/Assets';
import Billing from './pages/Billing';
import Checkout from './pages/Checkout';
import Account from './pages/Account';
import UsageHistory from './pages/UsageHistory';
import CreditHistory from './pages/CreditHistory';
import Chat from './pages/AI/Chat';
import Chat1 from './pages/AI/Chat1';
import ImageGen from './pages/AI/ImageGen';
import VideoGen from './pages/AI/VideoGen';
import PhotoToVideo from './pages/AI/PhotoToVideo';
import TTS from './pages/AI/TTS';
import Music from './pages/AI/Music';
import AdminDashboard from './pages/Admin/AdminDashboard';
import AdminUsers from './pages/Admin/AdminUsers';
import AdminModels from './pages/Admin/AdminModels';
import AdminLogs from './pages/Admin/AdminLogs';
import AdminPayments from './pages/Admin/AdminPayments';
import AdminPricing from './pages/Admin/AdminPricing';

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" />
      <Router>
        <Routes>
          <Route path="/giris" element={<Login />} />
          <Route path="/kayit" element={<Register />} />
          <Route path="/sifremi-unuttum" element={<ForgotPassword />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="varliklar" element={<Assets />} />
            <Route path="odeme-paketleri" element={<Billing />} />
            <Route path="odeme-yap/:packageId" element={<Checkout />} />
            <Route path="hesap" element={<Account />} />
            <Route path="kullanim-gecmisi" element={<UsageHistory />} />
            <Route path="kredi-gecmisi" element={<CreditHistory />} />

            <Route path="sohbet" element={<Chat1 />} />
            <Route path="sohbet/konus" element={<Chat />} />
            <Route path="gorsel" element={<ImageGen />} />
            <Route path="video" element={<VideoGen />} />
            <Route path="fotograftan-video" element={<PhotoToVideo />} />
            <Route path="tts" element={<TTS />} />
            <Route path="muzik" element={<Music />} />

            <Route
              path="admin"
              element={
                <ProtectedRoute requireAdmin>
                  <Navigate to="/admin/ozet" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/ozet"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/kullanicilar"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminUsers />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/modeller"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminModels />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/fiyatlandirma"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminPricing />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/loglar"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminLogs />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/odeme-yonetimi"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminPayments />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}
