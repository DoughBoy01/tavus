import { useAtom } from "jotai";
import { screenAtom } from "./store/screens";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { Routes, Route, Navigate } from 'react-router-dom';
import {
  IntroLoading,
  Outage,
  OutOfMinutes,
  Intro,
  Instructions,
  Conversation,
  FinalScreen,
  Settings,
} from "./screens";

// Admin dashboard imports
import { Dashboard } from "./screens/admin/Dashboard";
import { LawFirmDashboard } from "./screens/admin/LawFirmDashboard";
import { LeadsManagement } from "./screens/admin/LeadsManagement";
import { ConversationsManagement } from "./screens/admin/ConversationsManagement";
import { MatchesView } from "./screens/admin/MatchesView";
import { ProfileManagement } from "./screens/admin/ProfileManagement";
import { SystemAdminDashboard } from "./screens/admin/SystemAdminDashboard";
import { UserManagementPage } from "./screens/admin/UserManagementPage";

// New lead management components
import { FirmDashboard } from "./screens/admin/FirmDashboard";
import { FirmSettings } from "./screens/admin/FirmSettings";
import { LeadDistributionDashboard } from "./screens/admin/LeadDistributionDashboard";

// Auth components
import { Login } from "./screens/auth/Login";
import { Register } from "./screens/auth/Register";
import { PublicLayout } from "./components/layouts/PublicLayout";
import { AdminLayout } from "./components/layouts/AdminLayout";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { LegalAdminRoute } from "./components/auth/LegalAdminRoute";
import { SystemAdminRoute } from "./components/auth/SystemAdminRoute";

function App() {
  const [{ currentScreen }] = useAtom(screenAtom);

  const renderPublicScreen = () => {
    switch (currentScreen) {
      case "introLoading":
        return <IntroLoading />;
      case "outage":
        return <Outage />;
      case "outOfMinutes":
        return <OutOfMinutes />;
      case "intro":
        return <Intro />;
      case "settings":
        return <Settings />;
      case "instructions":
        return <Instructions />;
      case "conversation":
        return <Conversation />;
      case "finalScreen":
        return <FinalScreen />;
      default:
        return <IntroLoading />;
    }
  };

  return (
    <Routes>
      {/* Public Routes - Tavus Conversation Interface */}
      <Route 
        path="/" 
        element={
          <PublicLayout>
            <Header />
            {renderPublicScreen()}
            <Footer />
          </PublicLayout>
        } 
      />

      {/* Auth Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Protected Admin Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout>
              <Dashboard />
            </AdminLayout>
          </ProtectedRoute>
        }
      />

      {/* Legal Admin Routes - Enhanced for Lead Management */}
      <Route
        path="/admin/firm-dashboard"
        element={
          <LegalAdminRoute>
            <AdminLayout>
              <FirmDashboard />
            </AdminLayout>
          </LegalAdminRoute>
        }
      />
      <Route
        path="/admin/firm-settings"
        element={
          <LegalAdminRoute>
            <AdminLayout>
              <FirmSettings />
            </AdminLayout>
          </LegalAdminRoute>
        }
      />
      <Route
        path="/admin/leads"
        element={
          <LegalAdminRoute>
            <AdminLayout>
              <LeadsManagement />
            </AdminLayout>
          </LegalAdminRoute>
        }
      />
      <Route
        path="/admin/matches"
        element={
          <LegalAdminRoute>
            <AdminLayout>
              <MatchesView />
            </AdminLayout>
          </LegalAdminRoute>
        }
      />
      <Route
        path="/admin/profile"
        element={
          <LegalAdminRoute>
            <AdminLayout>
              <ProfileManagement />
            </AdminLayout>
          </LegalAdminRoute>
        }
      />

      {/* System Admin Routes - Enhanced for Lead Distribution */}
      <Route
        path="/admin/system"
        element={
          <SystemAdminRoute>
            <AdminLayout>
              <SystemAdminDashboard />
            </AdminLayout>
          </SystemAdminRoute>
        }
      />
      <Route
        path="/admin/lead-distribution"
        element={
          <SystemAdminRoute>
            <AdminLayout>
              <LeadDistributionDashboard />
            </AdminLayout>
          </SystemAdminRoute>
        }
      />
      <Route
        path="/admin/law-firms"
        element={
          <SystemAdminRoute>
            <AdminLayout>
              <LawFirmDashboard />
            </AdminLayout>
          </SystemAdminRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <SystemAdminRoute>
            <AdminLayout>
              <UserManagementPage />
            </AdminLayout>
          </SystemAdminRoute>
        }
      />
      <Route
        path="/admin/conversations"
        element={
          <SystemAdminRoute>
            <AdminLayout>
              <ConversationsManagement />
            </AdminLayout>
          </SystemAdminRoute>
        }
      />

      {/* Fallback route */}
      <Route path="*" element={<Navigate to="/\" replace />} />
    </Routes>
  );
}

export default App;