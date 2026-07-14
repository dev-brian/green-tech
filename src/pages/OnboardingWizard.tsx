import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Leaf, Sprout, ArrowRight } from 'lucide-react';

export default function OnboardingWizard() {
  const { user, refreshWorkspaces } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleComplete(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const batch = writeBatch(db);
      
      const greenhouseRef = doc(collection(db, 'greenhouses'));
      batch.set(greenhouseRef, {
        name: name.trim(),
        memberIds: [user.uid],
        createdAt: new Date().toISOString()
      });

      const memberRef = doc(db, 'greenhouses', greenhouseRef.id, 'members', user.uid);
      batch.set(memberRef, {
        role: 'admin',
        joinedAt: new Date().toISOString()
      });

      await batch.commit();
      
      await refreshWorkspaces(); // Refresh context
      navigate('/dashboard');
      
    } catch (err: any) {
      setError(err.message || 'Error al crear el espacio. Revisa tu conexión y reglas de Firebase.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="w-full max-w-md bg-slate-800/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative z-10">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.15)]">
            <Leaf className="text-emerald-400" size={32} />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white text-center mb-2">Bienvenido a GREEN TECH</h1>
        <p className="text-slate-400 text-center text-sm mb-8">
          Configura tu primer invernadero para comenzar a monitorear.
        </p>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleComplete} className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Nombre del Invernadero</label>
            <div className="relative">
              <Sprout className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Invernadero Norte"
                className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all min-h-[48px]"
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
                Comenzar
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
