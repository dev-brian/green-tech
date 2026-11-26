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
import { getRedirectResult, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged } from 'firebase/auth';
import { clearIndexedDbPersistence, terminate } from 'firebase/firestore';
import { authErrorMessage, shouldFallBackToRedirect } from '../lib/authErrors';
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  arrayUnion,
  arrayRemove,
  updateDoc,
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
  setMemberRole: (workspaceId: string, memberUid: string, role: UserRole) => Promise<void>;
  deleteWorkspace: (workspaceId: string) => Promise<void>;
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

  // Auditoría A9: si el inicio de sesión cayó a signInWithRedirect, el error
  // (si lo hubo) solo llega aquí al volver de Google; sin esto se perdía.
  useEffect(() => {
    getRedirectResult(auth).catch((err: unknown) => {
      console.error('Error al volver del inicio de sesión con redirección:', err);
      setError(authErrorMessage(err));
    });
  }, []);

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
    } catch (popupErr: unknown) {
      console.error('Error al iniciar sesión con Google:', popupErr);
      let err = popupErr;
      // Auditoría A9: en la PWA instalada (sobre todo iOS) la ventana emergente
      // suele fallar; se intenta con redirección. onAuthStateChanged recoge el
      // resultado al volver.
      if (shouldFallBackToRedirect(popupErr)) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr) {
          console.error('Error al iniciar sesión con redirección:', redirectErr);
          err = redirectErr;
        }
      }
      setError(authErrorMessage(err));
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    // Dar de baja el token push antes de salir: después ya no hay permiso para borrarlo.
    const uid = auth.currentUser?.uid;
    if (uid) {
      // Import dinámico: Firebase Messaging no entra en el paquete inicial (auditoría A8).
      await import('../lib/pushService')
        .then((m) => m.disablePush(uid))
        .catch(() => undefined);
    }
    await signOut(auth);
    // Auditoría A9: en un celular compartido no deben quedar lecturas ni
    // alertas del invernadero en IndexedDB. Hay que cerrar Firestore antes de
    // borrar su caché, y después recargar porque `db` ya no se puede usar.
    // Si otra pestaña sigue abierta el borrado falla; se recarga igual.
    try {
      sessionStorage.clear();
      // El id del invernadero no debe quedar para la siguiente persona.
      localStorage.removeItem('gt_active_workspace');
    } catch {
      // Almacenamiento bloqueado: no hay nada que limpiar.
    }
    try {
      await terminate(db);
      await clearIndexedDbPersistence(db);
    } catch (err) {
      console.warn('No se pudo borrar la caché local de Firestore:', err);
    }
    // Cambiar solo el hash no recarga la página (y `db` ya está cerrado):
    // se fija la ruta y se recarga explícitamente.
    window.history.replaceState(null, '', `${import.meta.env.BASE_URL}#/login`);
    window.location.reload();
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

    const inviteRef = doc(db, 'greenhouse_invites', code);
    batch.set(inviteRef, {
      greenhouseId: greenhouseRef.id,
      createdAt: new Date().toISOString()
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
      // El código se resuelve solo en greenhouse_invites. Las reglas no dejan
      // buscar invernaderos por inviteCode, así que no hay consulta de respaldo.
      const inviteSnap = await getDoc(doc(db, 'greenhouse_invites', cleanCode));
      const greenhouseId = inviteSnap.exists() ? String(inviteSnap.data().greenhouseId || '') : '';

      if (!greenhouseId) {
        throw new Error('Código de invitación no válido o inexistente. Verifica el código con tu administrador.');
      }

      if (workspaces.some((w) => w.id === greenhouseId)) {
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
        joinedAt: new Date().toISOString(),
        inviteCode: cleanCode
      });

      await batch.commit();
      await fetchWorkspaces(user.uid);
      return greenhouseId;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('insufficient permissions') || msg.includes('permission-denied')) {
        // Las reglas rechazan la unión si el código ya no es el vigente del invernadero.
        throw new Error('Ese código ya no es válido. Pídele uno nuevo a tu administrador.', { cause: err });
      }
      throw err;
    }
  }, [user, workspaces, fetchWorkspaces]);

  const regenerateInviteCode = useCallback(async (workspaceId: string): Promise<string> => {
    if (!user) throw new Error('Debes estar autenticado.');
    const greenhouseRef = doc(db, 'greenhouses', workspaceId);
    const snap = await getDoc(greenhouseRef);
    const oldCode = snap.exists() ? String(snap.data().inviteCode || '') : '';
    return rotateInviteCode(workspaceId, oldCode);
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

  // Un admin cambia el rol de OTRO integrante (las reglas no dejan cambiarse
  // el propio, R1). Así se cede la administración antes de salir.
  const setMemberRole = useCallback(async (workspaceId: string, memberUid: string, role: UserRole): Promise<void> => {
    if (!user) throw new Error('Debes estar autenticado.');
    if (memberUid === user.uid) throw new Error('No puedes cambiar tu propio rol.');
    await updateDoc(doc(db, 'greenhouses', workspaceId, 'members', memberUid), { role });
  }, [user]);

  // Borra el invernadero y su código de invitación. Los integrantes dejan de
  // verlo de inmediato. Lecturas y alertas quedan huérfanas en Firestore (el
  // cliente no puede borrarlas) pero nadie las puede leer: las reglas exigen
  // estar en memberIds del documento, que ya no existe.
  const deleteWorkspace = useCallback(async (workspaceId: string): Promise<void> => {
    if (!user) throw new Error('Debes estar autenticado.');
    const greenhouseRef = doc(db, 'greenhouses', workspaceId);
    const snap = await getDoc(greenhouseRef);
    if (!snap.exists()) throw new Error('Invernadero no encontrado.');
    const code = String(snap.data().inviteCode || '');
    const batch = writeBatch(db);
    if (code) {
      const inviteRef = doc(db, 'greenhouse_invites', code);
      const inviteSnap = await getDoc(inviteRef);
      if (inviteSnap.exists() && inviteSnap.data().greenhouseId === workspaceId) batch.delete(inviteRef);
    }
    batch.delete(greenhouseRef);
    await batch.commit();
    try {
      if (localStorage.getItem('gt_active_workspace') === workspaceId) localStorage.removeItem('gt_active_workspace');
    } catch { /* sin almacenamiento */ }
    await fetchWorkspaces(user.uid);
  }, [user, fetchWorkspaces]);

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
      return rotateInviteCode(workspaceId, '');
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
        setMemberRole,
        deleteWorkspace,
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

// Cambia el código del invernadero y su índice greenhouse_invites en un solo
// batch. El documento del código anterior se borra para que deje de resolver
// al invernadero (auditoría C1).
async function rotateInviteCode(workspaceId: string, oldCode: string): Promise<string> {
  const newCode = generateInviteCode();
  const batch = writeBatch(db);
  batch.update(doc(db, 'greenhouses', workspaceId), {
    inviteCode: newCode,
    inviteCodeCreatedAt: new Date().toISOString()
  });
  batch.set(doc(db, 'greenhouse_invites', newCode), {
    greenhouseId: workspaceId,
    createdAt: new Date().toISOString()
  });
  if (oldCode && oldCode !== newCode) {
    const oldInviteRef = doc(db, 'greenhouse_invites', oldCode);
    const oldInvite = await getDoc(oldInviteRef);
    // Solo se borra si existe y apunta a este invernadero (las reglas lo exigen).
    if (oldInvite.exists() && oldInvite.data().greenhouseId === workspaceId) {
      batch.delete(oldInviteRef);
    }
  }
  await batch.commit();
  return newCode;
}

const INVITE_CODE_LENGTH = 8;

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  // 8 caracteres de 32 (≈ 1.1 billones de códigos): las reglas rechazan los
  // más cortos porque se podían adivinar probando (reauditoría R4).
  // 256 es múltiplo de 32, así que `% 32` no sesga ningún carácter.
  const randomValues = new Uint8Array(INVITE_CODE_LENGTH);
  crypto.getRandomValues(randomValues);
  let code = 'GT-';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += chars[randomValues[i] % chars.length];
  }
  return code;
}
