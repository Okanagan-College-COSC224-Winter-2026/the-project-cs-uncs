import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import ProtectedRoute from "./components/ProtectedRoute";
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

function AppContent() {
  const location = useLocation();
  const noSidebarPaths = ["/", "/login", "/register"];

  return (
    <div className="App">
      {!noSidebarPaths.includes(location.pathname) && <Sidebar />}
      <div className="inner">
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

          <Route path="/home/teachers" element={
            <ProtectedRoute>
              <Navigate to="/admin/users" replace />
            </ProtectedRoute>
          } />

          {/* /admin/create-teacher removed; use /admin/users */}

          <Route path="/admin/users" element={
            <ProtectedRoute>
              <AdminUsers />
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

          <Route path="/classes/:id/groups" element={
            <ProtectedRoute>
              <Groups />
            </ProtectedRoute>
          } />

          <Route path="/classes/:id/my-group" element={
            <ProtectedRoute>
              <MyGroup />
            </ProtectedRoute>
          } />


          <Route path="/classes/:id/create-assignment" element={
            <ProtectedRoute>
              <CreateAssignment />
            </ProtectedRoute>
          } />

          <Route path="/assignments/:id" element={
            <ProtectedRoute>
              <Assignment />
            </ProtectedRoute>
          } />

          <Route path="/assignment/:id" element={
            <ProtectedRoute>
              <Assignment />
            </ProtectedRoute>
          } />

          <Route path="/assignment/:id/details" element={
            <ProtectedRoute>
              <AssignmentDetails />
            </ProtectedRoute>
          } />

          <Route path="/assignment/:id/groups" element={
            <ProtectedRoute>
              <Groups />
            </ProtectedRoute>
          } />

          <Route path="/assignment/:id/submissions" element={
            <ProtectedRoute>
              <Submissions />
            </ProtectedRoute>
          } />

          <Route
            path="/assignment/:id/group-submissions"
            element={<Navigate to="../submissions" replace />}
          />

          <Route path="/assignment/:id/my-group" element={
            <ProtectedRoute>
              <MyGroup />
            </ProtectedRoute>
          } />

          <Route path="/assignment/:id/reviews" element={
            <ProtectedRoute>
              <PeerReviews />
            </ProtectedRoute>
          } />

          <Route path="/assignment/:id/teacher-reviews" element={
            <ProtectedRoute>
              <TeacherReviewDashboard />
            </ProtectedRoute>
          } />

          <Route path="/assignment/:assignmentId/review/:reviewId" element={
            <ProtectedRoute>
              <ReviewSubmission />
            </ProtectedRoute>
          } />

          <Route path="/assignment/:id/feedback" element={
            <ProtectedRoute>
              <ReceivedFeedback />
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