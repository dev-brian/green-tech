import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Leaf, Sprout, ArrowRight, Key, ShieldCheck, Wrench } from 'lucide-react';

type Mode = 'create' | 'join';

export default function OnboardingWizard() {
  const { user, createWorkspace, joinWorkspaceByCode } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>('create');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      await createWorkspace(name);
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear el espacio.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !code.trim()) return;

    setLoading(true);
    setError(null);

    try {
      await joinWorkspaceByCode(code);
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al unirte al espacio.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="w-full max-w-lg bg-slate-800/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 animate-fade-in">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.15)]">
            <Leaf className="text-emerald-400" size={28} />
          </div>
        </div>

        <h1 className="text-2xl font-extrabold text-white text-center mb-1">Bienvenido a GREEN TECH</h1>
        <p className="text-slate-400 text-center text-xs sm:text-sm mb-6">
          Selecciona una opción para comenzar a monitorear tu cultivo.
        </p>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900/80 rounded-2xl border border-white/5 mb-6">
          <button
            type="button"
            onClick={() => { setMode('create'); setError(null); }}
            className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              mode === 'create'
                ? 'bg-emerald-500 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck size={16} />
            Crear Invernadero
          </button>

          <button
            type="button"
            onClick={() => { setMode('join'); setError(null); }}
            className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              mode === 'join'
                ? 'bg-blue-500 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Wrench size={16} />
            Unirme con Código
          </button>
        </div>

        {error && (
          <div className="mb-5 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs text-center">
            {error}
          </div>
        )}

        {mode === 'create' ? (
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-xs">
              <strong>Rol de Administrador:</strong> Serás el propietario del espacio con control total de configuraciones, plantas y códigos de invitación.
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Nombre del Invernadero</label>
              <div className="relative">
                <Sprout className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Invernadero Hidropónico Norte"
                  className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all min-h-[46px]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-xl py-3 px-4 flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:pointer-events-none min-h-[48px] mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Crear Invernadero (Admin)
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoin} className="flex flex-col gap-4">
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-300 text-xs">
              <strong>Rol de Operador:</strong> Ingresa el código de 6 dígitos que te proporcionó tu administrador (ej. <code>GT-7K9M2</code>).
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Código de Invitación</label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Ej. GT-8X9B2"
                  className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white text-sm font-mono tracking-widest placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all min-h-[46px]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl py-3 px-4 flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:pointer-events-none min-h-[48px] mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Unirme como Operador
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
