import { useState } from 'react';
import { Link, NavLink, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { RequireAuth } from './auth/RequireAuth';
import { useAuth } from './auth/AuthProvider';
import { AccessControlPage } from './pages/AccessControlPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { DashboardPage } from './pages/DashboardPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { DataBrowserPage } from './pages/DataBrowserPage';
import { SettingsPage } from './pages/SettingsPage';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<RequireAuth />}>
        <Route path="/" element={<Shell />}>
          <Route index element={<DashboardPage />} />
          <Route path="data" element={<DataBrowserPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="access" element={<AccessControlPage />} />
          <Route path="audit" element={<AuditLogPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

function Shell() {
  const { user, logout } = useAuth();

  const navItems = [
    { to: '/', label: 'Dashboard' },
    { to: '/data', label: 'Data' },
    { to: '/documents', label: 'Documents' },
    { to: '/access', label: 'Access' },
    { to: '/audit', label: 'Audit' },
    { to: '/settings', label: 'Settings' },
  ];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="font-semibold text-slate-900">
              Civitas
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-md text-sm ${isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`
                  }
                  end={n.to === '/'}
                >
                  {n.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-sm text-slate-600">{user?.email}</div>
            <button
              onClick={() => logout()}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid place-items-center px-4 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-lg">{children}</div>
    </div>
  );
}

function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already authenticated
  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <AuthCard>
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Civitas</h1>
        <p className="mt-1 text-sm text-slate-600">Personal Data Sovereignty Platform</p>
      </div>
      <h2 className="text-xl font-semibold">Sign in</h2>
      <p className="mt-1 text-sm text-slate-600">Use your passkey to access your data vault.</p>
      <form
        className="mt-6 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (isLoading) return;
          const form = new FormData(e.currentTarget as HTMLFormElement);
          const email = String(form.get('email') || '').trim();
          if (!email) {
            toast.error('Please enter your email');
            return;
          }
          setIsLoading(true);
          try {
            await login(email);
            navigate('/', { replace: true });
          } catch (err: any) {
            console.error('Login error:', err);
            toast.error(err?.message || 'Login failed');
          } finally {
            setIsLoading(false);
          }
        }}
      >
        <div>
          <label className="text-sm font-medium text-slate-700">Email</label>
          <input
            name="email"
            type="email"
            required
            autoComplete="email webauthn"
            className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            placeholder="you@example.com"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Authenticating...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
              </svg>
              Sign in with Passkey
            </>
          )}
        </button>
      </form>
      <div className="mt-6 pt-6 border-t text-sm text-slate-600 text-center">
        New here?{' '}
        <Link to="/register" className="font-medium text-slate-900 hover:underline">
          Create an account
        </Link>
      </div>
    </AuthCard>
  );
}

function RegisterPage() {
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already authenticated
  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <AuthCard>
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Civitas</h1>
        <p className="mt-1 text-sm text-slate-600">Personal Data Sovereignty Platform</p>
      </div>
      <h2 className="text-xl font-semibold">Create account</h2>
      <p className="mt-1 text-sm text-slate-600">Set up passwordless access with a passkey.</p>
      <form
        className="mt-6 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (isLoading) return;
          const form = new FormData(e.currentTarget as HTMLFormElement);
          const email = String(form.get('email') || '').trim();
          if (!email) {
            toast.error('Please enter your email');
            return;
          }
          setIsLoading(true);
          try {
            await register(email);
            toast.success('Account created successfully!');
            navigate('/', { replace: true });
          } catch (err: any) {
            console.error('Registration error:', err);
            toast.error(err?.message || 'Registration failed');
          } finally {
            setIsLoading(false);
          }
        }}
      >
        <div>
          <label className="text-sm font-medium text-slate-700">Email</label>
          <input
            name="email"
            type="email"
            required
            autoComplete="email webauthn"
            className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            placeholder="you@example.com"
          />
        </div>
        <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
          <p className="text-xs text-blue-800">
            <strong>Passkey authentication</strong> uses your device's biometric (Face ID, Touch ID, Windows Hello) 
            or a hardware security key. No password to remember or leak.
          </p>
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Creating passkey...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
              </svg>
              Create Passkey
            </>
          )}
        </button>
      </form>
      <div className="mt-6 pt-6 border-t text-sm text-slate-600 text-center">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-slate-900 hover:underline">
          Sign in
        </Link>
      </div>
    </AuthCard>
  );
}

export default App;
