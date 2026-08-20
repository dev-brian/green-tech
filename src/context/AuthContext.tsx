/* eslint-disable react-refresh/only-export-components */
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
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  arrayUnion,
  arrayRemove,
  writeBatch
} from 'firebase/firestore';

export const LS_PRIVACY_ACCEPTED = 'gt_privacy_accepted';

export type UserRole = 'admin' | 'operador';

export interface Workspace {
  id: string;
  name: string;
  role: UserRole;
  inviteCode?: string;
}

export interface WorkspaceMember {
  uid: string;
  role: UserRole;
  joinedAt: string;
  email?: string;
  name?: string;
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
  currentRole: UserRole;
  isAdmin: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  setActiveWorkspace: (ws: Workspace | null) => void;
  refreshWorkspaces: () => Promise<void>;
  
  // Workspace & Member Management
  createWorkspace: (name: string) => Promise<string>;
  joinWorkspaceByCode: (code: string) => Promise<string>;
  regenerateInviteCode: (workspaceId: string) => Promise<string>;
  leaveWorkspace: (workspaceId: string) => Promise<void>;
  removeMember: (workspaceId: string, memberUid: string) => Promise<void>;
  getWorkspaceMembers: (workspaceId: string) => Promise<WorkspaceMember[]>;
  getWorkspaceInviteCode: (workspaceId: string) => Promise<string>;

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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al iniciar sesión con Google';
      setError(msg);
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

  // ─── Workspace & Member Management ──────────────────────────────────────────

  const createWorkspace = useCallback(async (name: string): Promise<string> => {
    if (!user) throw new Error('Debes estar autenticado para crear un invernadero.');
    const code = generateInviteCode();
    const batch = writeBatch(db);
    const greenhouseRef = doc(collection(db, 'greenhouses'));

    batch.set(greenhouseRef, {
      name: name.trim(),
      inviteCode: code,
      inviteCodeCreatedAt: new Date().toISOString(),
      memberIds: [user.uid],
      createdAt: new Date().toISOString()
    });

    const memberRef = doc(db, 'greenhouses', greenhouseRef.id, 'members', user.uid);
    batch.set(memberRef, {
      role: 'admin',
      email: user.email,
      name: user.name,
      joinedAt: new Date().toISOString()
    });

    await batch.commit();
    await fetchWorkspaces(user.uid);
    return greenhouseRef.id;
  }, [user, fetchWorkspaces]);

  const joinWorkspaceByCode = useCallback(async (code: string): Promise<string> => {
    if (!user) throw new Error('Debes estar autenticado para unirte a un invernadero.');
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) throw new Error('Ingresa un código de invitación válido.');

    try {
      const q = query(collection(db, 'greenhouses'), where('inviteCode', '==', cleanCode));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        throw new Error('Código de invitación no válido o inexistente. Verifica el código con tu administrador.');
      }

      const docSnap = snapshot.docs[0];
      const greenhouseId = docSnap.id;
      const greenhouseData = docSnap.data();

      if (greenhouseData.memberIds && greenhouseData.memberIds.includes(user.uid)) {
        throw new Error('Ya eres miembro de este invernadero.');
      }

      const batch = writeBatch(db);
      const greenhouseRef = doc(db, 'greenhouses', greenhouseId);
      batch.update(greenhouseRef, {
        memberIds: arrayUnion(user.uid)
      });

      const memberRef = doc(db, 'greenhouses', greenhouseId, 'members', user.uid);
      batch.set(memberRef, {
        role: 'operador',
        email: user.email,
        name: user.name,
        joinedAt: new Date().toISOString()
      });

      await batch.commit();
      await fetchWorkspaces(user.uid);
      return greenhouseId;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('insufficient permissions') || msg.includes('permission-denied')) {
        throw new Error('Permisos insuficientes en Firestore. Por favor, actualiza las Reglas de Seguridad (Rules) en tu Firebase Console.', { cause: err });
      }
      throw err;
    }
  }, [user, fetchWorkspaces]);

  const regenerateInviteCode = useCallback(async (workspaceId: string): Promise<string> => {
    if (!user) throw new Error('Debes estar autenticado.');
    const newCode = generateInviteCode();
    const greenhouseRef = doc(db, 'greenhouses', workspaceId);
    await updateDoc(greenhouseRef, {
      inviteCode: newCode,
      inviteCodeCreatedAt: new Date().toISOString()
    });
    return newCode;
  }, [user]);

  const leaveWorkspace = useCallback(async (workspaceId: string): Promise<void> => {
    if (!user) throw new Error('Debes estar autenticado.');
    const batch = writeBatch(db);
    const greenhouseRef = doc(db, 'greenhouses', workspaceId);
    batch.update(greenhouseRef, {
      memberIds: arrayRemove(user.uid)
    });
    const memberRef = doc(db, 'greenhouses', workspaceId, 'members', user.uid);
    batch.delete(memberRef);
    await batch.commit();
    await fetchWorkspaces(user.uid);
  }, [user, fetchWorkspaces]);

  const removeMember = useCallback(async (workspaceId: string, memberUid: string): Promise<void> => {
    if (!user) throw new Error('Debes estar autenticado.');
    const batch = writeBatch(db);
    const greenhouseRef = doc(db, 'greenhouses', workspaceId);
    batch.update(greenhouseRef, {
      memberIds: arrayRemove(memberUid)
    });
    const memberRef = doc(db, 'greenhouses', workspaceId, 'members', memberUid);
    batch.delete(memberRef);
    await batch.commit();
  }, [user]);

  const getWorkspaceMembers = useCallback(async (workspaceId: string): Promise<WorkspaceMember[]> => {
    const snapshot = await getDocs(collection(db, 'greenhouses', workspaceId, 'members'));
    const members: WorkspaceMember[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      members.push({
        uid: docSnap.id,
        role: (data.role as UserRole) || 'operador',
        joinedAt: data.joinedAt || '',
        email: data.email || '',
        name: data.name || 'Usuario'
      });
    });
    return members;
  }, []);

  const getWorkspaceInviteCode = useCallback(async (workspaceId: string): Promise<string> => {
    const docSnap = await getDoc(doc(db, 'greenhouses', workspaceId));
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.inviteCode) return data.inviteCode;
      
      const newCode = generateInviteCode();
      await updateDoc(doc(db, 'greenhouses', workspaceId), {
        inviteCode: newCode,
        inviteCodeCreatedAt: new Date().toISOString()
      });
      return newCode;
    }
    throw new Error('Invernadero no encontrado.');
  }, []);

  const currentRole: UserRole = activeWorkspace ? activeWorkspace.role : (user?.role || 'operador');
  const isAdmin = currentRole === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        currentRole,
        isAdmin,
        loginWithGoogle,
        logout,
        clearError,
        workspaces,
        activeWorkspace,
        setActiveWorkspace,
        refreshWorkspaces,
        createWorkspace,
        joinWorkspaceByCode,
        regenerateInviteCode,
        leaveWorkspace,
        removeMember,
        getWorkspaceMembers,
        getWorkspaceInviteCode,
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

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const randomValues = new Uint8Array(5);
  crypto.getRandomValues(randomValues);
  let code = 'GT-';
  for (let i = 0; i < 5; i++) {
    code += chars[randomValues[i] % chars.length];
  }
  return code;
}
