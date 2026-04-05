import { useEffect, useState, type ReactNode } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import type { AuthUser, UserRole } from "@shared/contracts";
import { ToastProvider } from "./components/ToastProvider";
import { apiRequest } from "./lib/api";
import ActivateInvitePage from "./pages/ActivateInvitePage";
import DoctorReviewPage from "./pages/DoctorReviewPage";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import PatientPage from "./pages/PatientPage";
import SupportAccessPage from "./pages/SupportAccessPage";
import SupportPage from "./pages/SupportPage";

function getDefaultPath(user: Pick<AuthUser, "role"> | null) {
  if (user?.role === "patient") {
    return "/patient";
  }

  if (user?.role === "support") {
    return "/support";
  }

  return "/login";
}

function ProtectedRoute({
  user,
  isLoading,
  role,
  children,
}: {
  user: AuthUser | null;
  isLoading: boolean;
  role: UserRole;
  children: ReactNode;
}) {
  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== role) {
    return <Navigate to={getDefaultPath(user)} replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let isMounted = true;

    void apiRequest<AuthUser>("/api/auth/me")
      .then((nextUser) => {
        if (isMounted) {
          setUser(nextUser);
        }
      })
      .catch(() => {
        if (isMounted) {
          setUser(null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsAuthLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isAuthLoading && location.pathname === "/") {
      navigate(getDefaultPath(user), { replace: true });
    }
  }, [isAuthLoading, location.pathname, navigate, user]);

  const handleLogin = (nextUser: AuthUser) => {
    setUser(nextUser);
    navigate(getDefaultPath(nextUser), { replace: true });
  };

  const handleLogout = async () => {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } catch {
      // Clear the local user state even if the session is already gone.
    }

    setUser(null);
    navigate("/login", { replace: true });
  };

  return (
    <ToastProvider>
      <Routes>
        <Route
          path="/"
          element={
            isAuthLoading ? <LoadingScreen /> : <Navigate to={getDefaultPath(user)} replace />
          }
        />
        <Route
          path="/login"
          element={
            isAuthLoading ? (
              <LoadingScreen />
            ) : user ? (
              <Navigate to={getDefaultPath(user)} replace />
            ) : (
              <LoginPage onLogin={handleLogin} />
            )
          }
        />
        <Route
          path="/activate/:token"
          element={
            isAuthLoading ? (
              <LoadingScreen />
            ) : user ? (
              <Navigate to={getDefaultPath(user)} replace />
            ) : (
              <InviteActivationRoute onActivated={handleLogin} />
            )
          }
        />
        <Route
          path="/patient"
          element={
            <ProtectedRoute user={user} isLoading={isAuthLoading} role="patient">
              <PatientPage user={user as AuthUser} onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/support"
          element={
            <ProtectedRoute user={user} isLoading={isAuthLoading} role="support">
              <SupportPage user={user as AuthUser} onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/support/access"
          element={
            <ProtectedRoute user={user} isLoading={isAuthLoading} role="support">
              <SupportAccessPage
                user={user as AuthUser}
                onLogout={handleLogout}
                onBack={() => navigate("/support", { replace: true })}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/:patientId"
          element={
            <ProtectedRoute user={user} isLoading={isAuthLoading} role="support">
              <DoctorReviewPage user={user as AuthUser} onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="*"
          element={
            user ? (
              <NotFoundPage onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </ToastProvider>
  );
}

function InviteActivationRoute({
  onActivated,
}: {
  onActivated: (user: AuthUser) => void;
}) {
  const { token = "" } = useParams();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <ActivateInvitePage token={token} onActivated={onActivated} />;
}

function LoadingScreen() {
  return (
    <div className="page-shell">
      <div className="panel mx-auto max-w-xl p-10 text-center">
        <p className="mini-heading">Loading</p>
        <h1 className="hero-title mt-4">Checking your secure session...</h1>
        <p className="hero-text mt-4">
          L.A.M.B is reconnecting you to the right workspace.
        </p>
      </div>
    </div>
  );
}
