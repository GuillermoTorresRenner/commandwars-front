import { Navigate, Route, Routes } from "react-router"
import { RequireAdmin } from "@/auth/require-admin"
import { RequireAuth } from "@/auth/require-auth"
import { AdminLayout } from "@/pages/admin/AdminLayout"
import { ContentAdminPage } from "@/pages/admin/ContentAdminPage"
import { MapCellsEditorPage } from "@/pages/admin/MapCellsEditorPage"
import { MapsAdminPage } from "@/pages/admin/MapsAdminPage"
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage"
import { HomePage } from "@/pages/HomePage"
import { LoginPage } from "@/pages/LoginPage"
import { RegisterPage } from "@/pages/RegisterPage"
import { ResetPasswordPage } from "@/pages/ResetPasswordPage"
import { RoomPage } from "@/pages/rooms/RoomPage"
import { RoomsPage } from "@/pages/rooms/RoomsPage"

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <HomePage />
          </RequireAuth>
        }
      />
      <Route
        path="/rooms"
        element={
          <RequireAuth>
            <RoomsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/rooms/:id"
        element={
          <RequireAuth>
            <RoomPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route index element={<Navigate to="content" replace />} />
        <Route path="content" element={<ContentAdminPage />} />
        <Route path="maps" element={<MapsAdminPage />} />
      </Route>
      <Route
        path="/admin/maps/:id/edit"
        element={
          <RequireAdmin>
            <MapCellsEditorPage />
          </RequireAdmin>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
