import { useUIStore } from '../../stores/uiStore.js';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-preact';

export default function Toast() {
  const { toast, hideToast } = useUIStore();
  if (!toast) return null;

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />,
    info: <Info className="w-5 h-5 text-blue-600 shrink-0" />
  };

  const borderColors = {
    success: 'border-emerald-500 bg-emerald-50 text-emerald-950',
    error: 'border-red-500 bg-red-50 text-red-950',
    info: 'border-blue-500 bg-blue-50 text-blue-950'
  };

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md w-full animate-slide-down">
      <div className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg ${borderColors[toast.type || 'success']}`}>
        {icons[toast.type || 'success']}
        <div className="flex-1 text-sm font-medium leading-relaxed">
          {toast.message}
        </div>
        <button
          onClick={hideToast}
          className="text-gray-400 hover:text-gray-700 p-1 rounded-md transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
