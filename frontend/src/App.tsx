import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import LandingPage from "./pages/LandingPage";
import ProtectedRoute from "./components/ProtectedRoute";
import ClassRouteGuard from "./components/ClassRouteGuard";
import AssignmentRouteGuard from "./components/AssignmentRouteGuard";
import RoleRouteGuard from "./components/RoleRouteGuard";
import Sidebar from "./components/Sidebar";
import { ThemeProvider } from "./context/ThemeContext";

import "./App.css";
import Profile from "./pages/Profile";
import CreateClass from "./pages/CreateClass";
import LoginPage from "./pages/LoginPage";
import ClassHome from "./pages/ClassHome";
import ClassMembers from "./pages/ClassMembers";
import Assignment from "./pages/Assignment";
import RegisterPage from "./pages/RegisterPage";
import ChangePassword from "./pages/ChangePassword";
// CreateTeacher removed in favor of AdminUsers
import AdminUsers from "./pages/AdminUsers";
import PeerReviews from "./pages/PeerReviews";
import ReviewSubmission from "./pages/ReviewSubmission";
import TeacherReviewDashboard from "./pages/TeacherReviewDashboard";
import ReceivedFeedback from "./pages/ReceivedFeedback";
import CreateAssignment from "./pages/CreateAssignment";
import AssignmentDetails from "./pages/AssignmentDetails";
import Groups from "./pages/Groups";
import Submissions from "./pages/Submissions";
import MyGroup from "./pages/MyGroup";

import { useEffect, useState } from "react";
import { getCurrentUser } from "./util/api_client/users";

const NO_SIDEBAR_PATHS = ["/", "/login", "/register"];

function AppContent() {
  const location = useLocation();
  const isPublicPath = NO_SIDEBAR_PATHS.includes(location.pathname);

  // Block rendering until user info is synced from backend
  const [userSyncDone, setUserSyncDone] = useState(false);

  useEffect(() => {
    (async () => {
      if (isPublicPath) {
        setUserSyncDone(true);
        return;
      }

      try {
        const user = await getCurrentUser();
        if (user && typeof user === "object") {
          localStorage.setItem("user", JSON.stringify(user));
        }
      } catch {
        // Not logged in or error, do nothing
      } finally {
        setUserSyncDone(true);
      }
    })();
  }, [isPublicPath, location.pathname]);

  if (!userSyncDone) {
    return <div className="Page"><p>Loading...</p></div>;
  }

  return (
    <div className="App">
      {!isPublicPath && <Sidebar />}
      <div className="inner">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
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

          <Route path="/home/teachers" element={
            <ProtectedRoute>
              <Navigate to="/admin/users" replace />
            </ProtectedRoute>
          } />

          {/* /admin/create-teacher removed; use /admin/users */}

          <Route path="/admin/users" element={
            <ProtectedRoute>
              <RoleRouteGuard allowedRoles={["admin"]}>
                <AdminUsers />
              </RoleRouteGuard>
            </ProtectedRoute>
          } />

          <Route path="/classes/create" element={
            <ProtectedRoute>
              <CreateClass />
            </ProtectedRoute>
          } />

          <Route path="/profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />

          <Route path="/profile/:id" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />

          <Route path="/classes/:id/home" element={
            <ProtectedRoute>
              <ClassRouteGuard>
                <ClassHome />
              </ClassRouteGuard>
            </ProtectedRoute>
          } />

          <Route path="/classes/:id/members" element={
            <ProtectedRoute>
              <ClassRouteGuard>
                <ClassMembers />
              </ClassRouteGuard>
            </ProtectedRoute>
          } />

          <Route path="/classes/:id/groups" element={
            <ProtectedRoute>
              <ClassRouteGuard>
                <Groups />
              </ClassRouteGuard>
            </ProtectedRoute>
          } />

          <Route path="/classes/:id/my-group" element={
            <ProtectedRoute>
              <ClassRouteGuard>
                <MyGroup />
              </ClassRouteGuard>
            </ProtectedRoute>
          } />


          <Route path="/classes/:id/create-assignment" element={
            <ProtectedRoute>
              <ClassRouteGuard requireTeacherOrAdmin>
                <CreateAssignment />
              </ClassRouteGuard>
            </ProtectedRoute>
          } />

          <Route path="/assignments/:id" element={
            <ProtectedRoute>
              <AssignmentRouteGuard>
                <Assignment />
              </AssignmentRouteGuard>
            </ProtectedRoute>
          } />

          <Route path="/assignment/:id" element={
            <ProtectedRoute>
              <AssignmentRouteGuard>
                <Assignment />
              </AssignmentRouteGuard>
            </ProtectedRoute>
          } />

          <Route path="/assignment/:id/details" element={
            <ProtectedRoute>
              <AssignmentRouteGuard>
                <AssignmentDetails />
              </AssignmentRouteGuard>
            </ProtectedRoute>
          } />

          <Route path="/assignment/:id/groups" element={
            <ProtectedRoute>
              <AssignmentRouteGuard>
                <Groups />
              </AssignmentRouteGuard>
            </ProtectedRoute>
          } />

          <Route path="/assignment/:id/submissions" element={
            <ProtectedRoute>
              <AssignmentRouteGuard requireTeacherOrAdmin>
                <Submissions />
              </AssignmentRouteGuard>
            </ProtectedRoute>
          } />

          <Route
            path="/assignment/:id/group-submissions"
            element={<Navigate to="../submissions" replace />}
          />

          <Route path="/assignment/:id/my-group" element={
            <ProtectedRoute>
              <AssignmentRouteGuard>
                <MyGroup />
              </AssignmentRouteGuard>
            </ProtectedRoute>
          } />

          <Route path="/assignment/:id/reviews" element={
            <ProtectedRoute>
              <AssignmentRouteGuard>
                <PeerReviews />
              </AssignmentRouteGuard>
            </ProtectedRoute>
          } />

          <Route path="/assignment/:id/teacher-reviews" element={
            <ProtectedRoute>
              <AssignmentRouteGuard requireTeacherOrAdmin>
                <TeacherReviewDashboard />
              </AssignmentRouteGuard>
            </ProtectedRoute>
          } />

          <Route path="/assignment/:assignmentId/review/:reviewId" element={
            <ProtectedRoute>
              <AssignmentRouteGuard paramName="assignmentId">
                <ReviewSubmission />
              </AssignmentRouteGuard>
            </ProtectedRoute>
          } />

          <Route path="/assignment/:id/feedback" element={
            <ProtectedRoute>
              <AssignmentRouteGuard>
                <ReceivedFeedback />
              </AssignmentRouteGuard>
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