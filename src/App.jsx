import { useEffect } from 'preact/hooks';
import { Route, Switch, Redirect } from 'wouter-preact';
import { useAuthStore } from './stores/authStore.js';
import AppLayout from './components/layout/AppLayout.jsx';
import LoadError from './components/ui/LoadError.jsx';

// Pages
import Dashboard from './pages/Dashboard.jsx';
import Kasus from './pages/Kasus.jsx';
import KasusForm from './pages/KasusForm.jsx';
import Siswa from './pages/Siswa.jsx';
import SiswaDetail from './pages/SiswaDetail.jsx';
import Kategori from './pages/Kategori.jsx';
import ImportExcel from './pages/ImportExcel.jsx';
import Surat from './pages/Surat.jsx';
import Log from './pages/Log.jsx';
import Settings from './pages/Settings.jsx';
import Akun from './pages/Akun.jsx';
import Login from './pages/Login.jsx';

function FullScreenMessage({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAF8] text-center p-4">
      {children}
    </div>
  );
}

function Forbidden() {
  return (
    <AppLayout title="Akses Ditolak" subtitle="Halaman ini hanya untuk Administrator">
      <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Anda tidak memiliki akses ke halaman ini</h2>
        <p className="text-sm text-gray-500">Hubungi Administrator jika Anda memerlukan akses.</p>
      </div>
    </AppLayout>
  );
}

export default function App() {
  const { user, ready, sessionError, init } = useAuthStore();

  // Periksa sesi Firebase sekali saat aplikasi dibuka
  useEffect(() => {
    init();
  }, []);

  if (!ready) {
    return (
      <FullScreenMessage>
        <p className="text-sm text-gray-500">Memuat sesi...</p>
      </FullScreenMessage>
    );
  }

  if (sessionError) {
    return (
      <FullScreenMessage>
        <LoadError message={sessionError} onRetry={init} />
      </FullScreenMessage>
    );
  }

  // Membungkus halaman yang dibatasi role tertentu
  const only = (roles, Component) => (params) =>
    roles.includes(user.role) ? <Component params={params} /> : <Forbidden />;

  return (
    <Switch>
      <Route path="/login">{user ? <Redirect to="/" /> : <Login />}</Route>

      {/* Protected Routes */}
      {!user ? (
        <Route>
          <Redirect to="/login" />
        </Route>
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/kasus" component={Kasus} />
          <Route path="/kasus/tambah" component={KasusForm} />
          <Route path="/siswa" component={Siswa} />
          <Route path="/siswa/:id" component={SiswaDetail} />
          <Route path="/kategori" component={Kategori} />
          <Route path="/import" component={ImportExcel} />
          <Route path="/surat" component={Surat} />
          <Route path="/log" component={Log} />
          <Route path="/settings">{only(['admin'], Settings)}</Route>
          <Route path="/akun" component={Akun} />
        </>
      )}

      {/* 404 Fallback */}
      <Route>
        <FullScreenMessage>
          <div>
            <h1 className="text-4xl font-extrabold text-gray-900 mb-2 font-heading">404</h1>
            <p className="text-sm text-gray-500 mb-4">Halaman tidak ditemukan.</p>
            <a href="/" className="px-4 py-2 bg-[#4A6FA5] text-white rounded-xl text-xs font-bold shadow-xs">
              Kembali ke Beranda
            </a>
          </div>
        </FullScreenMessage>
      </Route>
    </Switch>
  );
}
