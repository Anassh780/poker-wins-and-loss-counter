import { useState, useEffect } from 'react';

export interface AppError {
  id: string;
  message: string;
  englishTranslation: string;
  details: string;
  time: Date;
  type: 'UI' | 'Logic' | 'Network' | 'Unknown';
}

interface ErrorSidebarProps {
  isAdmin: boolean;
}

const translateError = (msg: string) => {
  const m = msg.toLowerCase();
  if (m.includes('failed to fetch') || m.includes('network error')) return "Network Disconnected: The app cannot reach the server. Check your internet connection.";
  if (m.includes('missing or insufficient permissions')) return "Database Access Denied: Security rules blocked this action. Ensure Firebase is in test mode or your account has rights.";
  if (m.includes('not a function')) return "Code Bug: A function was called that doesn't exist in the system.";
  if (m.includes('undefined is not an object') || m.includes('cannot read properties of null') || m.includes('cannot read properties of undefined')) return "Data Missing: The app tried to process information that is currently empty or loading.";
  if (m.includes('cannot read property')) return "Data Missing: The app tried to display information that is currently empty.";
  if (m.includes('firebase')) return "Database Error: A problem occurred communicating with the database.";
  if (m.includes('user not found')) return "Authentication: The specified user account does not exist.";
  return "System encountered an unexpected issue.";
};

export const ErrorSidebar = ({ isAdmin }: ErrorSidebarProps) => {
  const [errors, setErrors] = useState<AppError[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;

    const handleError = (type: AppError['type'], originalMessage: string, details: string) => {
      setErrors(prev => {
        // Prevent duplicate spam within 2 seconds
        if (prev.length > 0 && prev[0].message === originalMessage && (Date.now() - prev[0].time.getTime() < 2000)) {
          return prev;
        }
        
        const newError: AppError = { 
          id: Date.now().toString() + Math.random(), 
          message: originalMessage, 
          englishTranslation: translateError(originalMessage),
          details, 
          time: new Date(), 
          type 
        };
        return [newError, ...prev].slice(0, 50); // keep last 50
      });
      setIsOpen(true);
    };

    // Global UI error listener
    const onWindowError = (e: ErrorEvent) => {
      handleError('UI', e.message, e.error?.stack || 'No stack trace available');
    };

    // Unhandled promise rejections (often logic/network)
    const onUnhandledRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      const message = typeof reason === 'string' ? reason : reason?.message || 'Unhandled Promise Rejection';
      const stack = reason?.stack || JSON.stringify(reason);
      const type = message.toLowerCase().includes('fetch') ? 'Network' : 'Logic';
      handleError(type, message, stack);
    };

    // Intercept console.error
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      originalConsoleError.apply(console, args);
      // Filter out some React dev warnings if desired, but we'll capture them
      const message = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      if (!message.includes('Warning:')) { // ignore react warnings
        handleError('Logic', message, 'Logged via console.error');
      }
    };

    window.addEventListener('error', onWindowError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      window.removeEventListener('error', onWindowError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      console.error = originalConsoleError;
    };
  }, [isAdmin]);

  if (!isAdmin || errors.length === 0) return null;

  return (
    <>
      {/* Floating Action Button when closed but errors exist */}
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-[200] bg-red-900/80 hover:bg-red-800 border border-red-500 text-white px-4 py-3 rounded-full font-cyber font-bold flex items-center gap-3 transition-smooth shadow-[0_0_20px_rgba(239,68,68,0.5)] animate-bounce"
        >
          <span className="text-xl">⚠️</span> 
          <span className="hidden sm:inline">System Diagnostics</span>
          <span className="bg-red-500 px-2 py-0.5 rounded-full text-xs">{errors.length}</span>
        </button>
      )}

      {/* Modern Sidebar UI */}
      <div className={`fixed top-0 right-0 h-full w-full sm:w-96 bg-black/90 backdrop-blur-xl border-l border-red-500/30 shadow-[-10px_0_40px_rgba(239,68,68,0.15)] z-[250] transform transition-transform duration-300 ease-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Header */}
        <div className="p-5 border-b border-red-500/20 flex justify-between items-center bg-gradient-to-r from-red-900/40 to-transparent">
          <div className="flex items-center gap-3">
            <span className="text-2xl animate-pulse">🚨</span>
            <div>
              <h2 className="font-cyber font-bold text-red-400 text-lg">Live Diagnostics</h2>
              <p className="text-xs text-red-500/70 uppercase tracking-widest">Admin Eyes Only</p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="w-8 h-8 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-white flex items-center justify-center transition-smooth">✕</button>
        </div>

        {/* Error List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {errors.map(err => (
            <div key={err.id} className="bg-black/60 border border-red-500/20 rounded-xl p-4 hover:border-red-500/40 transition-smooth group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-red-500 to-orange-500 opacity-50 group-hover:opacity-100 transition-smooth"></div>
              
              <div className="flex justify-between items-start mb-3">
                <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-md tracking-wider ${err.type === 'UI' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : err.type === 'Network' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'}`}>
                  {err.type}
                </span>
                <span className="text-[10px] text-gray-500 font-mono">{err.time.toLocaleTimeString()}</span>
              </div>
              
              {/* Plain English Translation */}
              <div className="mb-3">
                <h4 className="text-[10px] uppercase text-gray-500 font-bold mb-1">Plain English Diagnosis</h4>
                <p className="font-cyber text-sm text-white/90 bg-white/5 p-2.5 rounded-lg border border-white/10">
                  {err.englishTranslation}
                </p>
              </div>

              {/* Technical Details (Collapsible or just small) */}
              <div>
                <h4 className="text-[10px] uppercase text-gray-500 font-bold mb-1">Technical Logic</h4>
                <p className="text-xs text-red-400 mb-2 font-mono break-words">{err.message}</p>
                <div className="bg-black rounded-lg p-2.5 overflow-x-auto border border-white/5">
                  <pre className="text-[9px] text-gray-500 whitespace-pre-wrap font-mono">{err.details}</pre>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-red-500/20 bg-black/60 backdrop-blur-md">
          <button onClick={() => setErrors([])} className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 hover:text-white font-cyber font-bold rounded-xl transition-smooth flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.1)] hover:shadow-[0_0_20px_rgba(239,68,68,0.2)]">
            <span>🗑️</span> Clear Diagnostic Logs
          </button>
        </div>
      </div>
    </>
  );
};
