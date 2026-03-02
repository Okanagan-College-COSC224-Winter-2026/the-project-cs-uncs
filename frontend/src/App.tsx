import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import ProtectedRoute from "./components/ProtectedRoute";
import Sidebar from "./components/Sidebar";
import { ThemeProvider } from "./components/ThemeProvider";
import { ThemeToggle } from "./components/ThemeToggle";

import "./App.css";
import Profile from "./pages/Profile";
import CreateClass from "./pages/CreateClass";
import LoginPage from "./pages/LoginPage";
import ClassHome from "./pages/ClassHome";
import ClassMembers from "./pages/ClassMembers";
import Assignment from "./pages/Assignment";
import Group from "./pages/Group";
import RegisterPage from "./pages/RegisterPage";
import ChangePassword from "./pages/ChangePassword";
import CreateTeacher from "./pages/CreateTeacher";

function AppContent() {
  const location = useLocation();
  const noSidebarPaths = ["/", "/login", "/register"];
  const showThemeToggle = !noSidebarPaths.includes(location.pathname);

  return (
    <div className="App">
      {!noSidebarPaths.includes(location.pathname) && <Sidebar />}
      <div className="inner">
        {showThemeToggle && <div className="ThemeToggleContainer"><ThemeToggle /></div>}
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/change-password" element={
            <ProtectedRoute>
              <ChangePassword />
            </ProtectedRoute>
          } />

          <Route path="/home" element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          } />

          <Route path="/admin/create-teacher" element={
            <ProtectedRoute>
              <CreateTeacher />
            </ProtectedRoute>
          } />

          <Route path="/classes/create" element={
            <ProtectedRoute>
              <CreateClass />
            </ProtectedRoute>
          } />

          <Route path="/profile/:id" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />

          <Route path="/classes/:id/home" element={
            <ProtectedRoute>
              <ClassHome />
            </ProtectedRoute>
          } />

          <Route path="/classes/:id/members" element={
            <ProtectedRoute>
              <ClassMembers />
            </ProtectedRoute>
          } />

          <Route path="/assignments/:id" element={
            <ProtectedRoute>
              <Assignment />
            </ProtectedRoute>
          } />

          <Route path="/assignments/:id/group" element={
            <ProtectedRoute>
              <Group />
            </ProtectedRoute>
          } />
        </Routes>
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;