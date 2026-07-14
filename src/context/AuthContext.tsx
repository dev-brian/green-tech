import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { auth, db, googleProvider } from '../lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';

export const LS_PRIVACY_ACCEPTED = 'gt_privacy_accepted';

export type UserRole = 'admin' | 'operador';

export interface Workspace {
  id: string;
  name: string;
  role: UserRole;
}

export interface AuthUser {
  uid: string;
  name: string;
  email: string;
  role: UserRole; // Rol primario o legacy
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  setActiveWorkspace: (ws: Workspace | null) => void;
  refreshWorkspaces: () => Promise<void>;
  
  // Legacy stubs para no romper la UI antigua inmediatamente si se usa
  login: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  lockoutSeconds: number;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);

  const fetchWorkspaces = useCallback(async (uid: string) => {
    try {
      const q = query(collection(db, 'greenhouses'), where('memberIds', 'array-contains', uid));
      const snapshot = await getDocs(q);
      const wsList: Workspace[] = [];
      
      for (const docSnap of snapshot.docs) {
        const greenhouseData = docSnap.data();
        
        // Fetch role from subcollection
        const memberRef = doc(db, 'greenhouses', docSnap.id, 'members', uid);
        const memberSnap = await getDoc(memberRef);
        
        let role: UserRole = 'operador';
        if (memberSnap.exists()) {
          role = memberSnap.data().role as UserRole;
        }
        
        wsList.push({
          id: docSnap.id,
          name: greenhouseData.name || 'Invernadero',
          role
        });
      }
      
      setWorkspaces(wsList);
      if (wsList.length > 0) {
        const savedWs = localStorage.getItem('gt_active_workspace');
        const found = wsList.find(w => w.id === savedWs);
        setActiveWorkspace(found || wsList[0]);
      } else {
        setActiveWorkspace(null);
      }
    } catch (err) {
      console.error("Error fetching workspaces:", err);
      throw err; // Propagate error so callers can handle it
    }
  }, []);

  const refreshWorkspaces = useCallback(async () => {
    if (user) {
      await fetchWorkspaces(user.uid);
    }
  }, [user, fetchWorkspaces]);

  // Auth State Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const authUser: AuthUser = {
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || 'Usuario',
          email: firebaseUser.email || '',
          role: 'operador', // Fallback, el rol real viene del workspace
        };
        setUser(authUser);
        await fetchWorkspaces(firebaseUser.uid);
      } else {
        setUser(null);
        setWorkspaces([]);
        setActiveWorkspace(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [fetchWorkspaces]);

  // Sync active workspace
  useEffect(() => {
    if (activeWorkspace) {
      localStorage.setItem('gt_active_workspace', activeWorkspace.id);
    } else {
      localStorage.removeItem('gt_active_workspace');
    }
  }, [activeWorkspace]);

  const loginWithGoogle = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión con Google');
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  // Legacy stubs
  const login = useCallback(async () => {
    setError('El inicio de sesión por correo está deshabilitado temporalmente.');
  }, []);
  
  const sendPasswordReset = useCallback(async () => {
    setError('La recuperación por correo está deshabilitada temporalmente.');
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        loginWithGoogle,
        logout,
        clearError,
        workspaces,
        activeWorkspace,
        setActiveWorkspace,
        refreshWorkspaces,
        login,
        sendPasswordReset,
        lockoutSeconds: 0
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
