import { Link, NavLink, Outlet, Route, Routes } from 'react-router-dom';
import toast from 'react-hot-toast';
import { RequireAuth } from './auth/RequireAuth';
import { useAuth } from './auth/AuthProvider';
import { AccessControlPage } from './pages/AccessControlPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { DashboardPage } from './pages/DashboardPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { MedicalRecordsPage } from './pages/MedicalRecordsPage';
import { SettingsPage } from './pages/SettingsPage';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<RequireAuth />}>
        <Route path="/" element={<Shell />}>
          <Route index element={<DashboardPage />} />
          <Route path="medical" element={<MedicalRecordsPage />} />
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
    { to: '/medical', label: 'Medical' },
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
              MedVault
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
              onClick={logout}
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
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm">{children}</div>
    </div>
  );
}

function LoginPage() {
  const { login } = useAuth();
  return (
    <AuthCard>
      <h1 className="text-xl font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-slate-600">Access your medical vault.</p>
      <form
        className="mt-6 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget as HTMLFormElement);
          try {
            await login(String(form.get('email') || ''), String(form.get('password') || ''));
          } catch (err: any) {
            toast.error(err?.message || 'Login failed');
          }
        }}
      >
        <div>
          <label className="text-sm font-medium">Email</label>
          <input
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Password</label>
          <input name="password" type="password" required className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
        </div>
        <button className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
          Sign in
        </button>
      </form>
      <div className="mt-4 text-sm text-slate-600">
        New here?{' '}
        <Link to="/register" className="font-medium text-slate-900 underline">
          Create an account
        </Link>
      </div>
    </AuthCard>
  );
}

function RegisterPage() {
  const { register } = useAuth();
  return (
    <AuthCard>
      <h1 className="text-xl font-semibold">Create account</h1>
      <p className="mt-1 text-sm text-slate-600">Get started in under a minute.</p>
      <form
        className="mt-6 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget as HTMLFormElement);
          try {
            await register(String(form.get('email') || ''), String(form.get('password') || ''));
          } catch (err: any) {
            toast.error(err?.message || 'Registration failed');
          }
        }}
      >
        <div>
          <label className="text-sm font-medium">Email</label>
          <input
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Password</label>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            placeholder="min 8 chars"
          />
          <div className="mt-1 text-xs text-slate-500">Bcrypt passwords are limited to 72 bytes.</div>
        </div>
        <button className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
          Create account
        </button>
      </form>
      <div className="mt-4 text-sm text-slate-600">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-slate-900 underline">
          Sign in
        </Link>
      </div>
    </AuthCard>
  );
}

export default App
