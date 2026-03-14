import { StrictMode } from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"

import AppShell from "./components/AppShell"
import ProtectedRoute from "./components/ProtectedRoute"
import { AuthProvider } from "./context/AuthContext"
import Dashboard from "./pages/Dashboard"
import DatasetDetail from "./pages/DatasetDetail"
import Explore from "./pages/Explore"
import Login from "./pages/Login"
import Marketplace from "./pages/Marketplace"
import PublicTools from "./pages/PublicTools"
import Profile from "./pages/Profile"
import Register from "./pages/Register"
import UserProfile from "./pages/UserProfile"
import "./index.css"

ReactDOM.createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="explore" element={<Explore />} />
            <Route path="marketplace" element={<Marketplace />} />
            <Route path="public" element={<PublicTools />} />
            <Route path="dataset/:id" element={<DatasetDetail />} />
            <Route path="user/:username" element={<UserProfile />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route
              path="profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
          </Route>
          <Route path="*" element={<Navigate replace to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>
)
