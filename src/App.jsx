import { Route, Switch, Redirect } from 'wouter-preact';
import { useAuthStore } from './stores/authStore.js';

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
import Login from './pages/Login.jsx';

export default function App() {
  const { user } = useAuthStore();

  return (
    <Switch>
      <Route path="/login" component={Login} />

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
          <Route path="/settings" component={Settings} />
        </>
      )}

      {/* 404 Fallback */}
      <Route>
        <div className="min-h-screen flex items-center justify-center bg-[#FAFAF8] text-center p-4">
          <div>
            <h1 className="text-4xl font-extrabold text-gray-900 mb-2 font-heading">404</h1>
            <p className="text-sm text-gray-500 mb-4">Halaman tidak ditemukan.</p>
            <a href="/" className="px-4 py-2 bg-[#4A6FA5] text-white rounded-xl text-xs font-bold shadow-xs">
              Kembali ke Beranda
            </a>
          </div>
        </div>
      </Route>
    </Switch>
  );
}
