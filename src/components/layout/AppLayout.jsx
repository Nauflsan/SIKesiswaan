import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import BottomNav from './BottomNav.jsx';
import Toast from '../ui/Toast.jsx';

export default function AppLayout({ title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-[#FAFAF8] flex">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 md:pl-64 flex flex-col min-w-0 pb-16 md:pb-0">
        <Topbar title={title} subtitle={subtitle} />
        
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav />

      {/* Toast notifications */}
      <Toast />
    </div>
  );
}
