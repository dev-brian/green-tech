import { db } from './firebase';
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  orderBy
} from 'firebase/firestore';

export interface PlantRequirements {
  tempMin: number;
  tempMax: number;
  humidity: number; // % Humedad Relativa
  soilMoisture: number; // % Humedad del sustrato
  lightHours: number; // Fotoperiodo (horas de luz)
}

export interface Plant {
  id: string;
  name: string;
  status: string;
  reqs: PlantRequirements;
  active: boolean;
  createdAt?: string;
}

export const plantsService = {
  getCollectionRef(workspaceId: string) {
    return collection(db, 'greenhouses', workspaceId, 'plants');
  },

  async getPlants(workspaceId: string): Promise<Plant[]> {
    const colRef = this.getCollectionRef(workspaceId);
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Plant[];
  },

  async addPlant(workspaceId: string, plantData: Omit<Plant, 'id'>): Promise<string> {
    const colRef = this.getCollectionRef(workspaceId);
    const dataWithTimestamp = {
      ...plantData,
      createdAt: new Date().toISOString()
    };
    const docRef = await addDoc(colRef, dataWithTimestamp);
    return docRef.id;
  },

  async updatePlant(workspaceId: string, plantId: string, data: Partial<Omit<Plant, 'id'>>): Promise<void> {
    const docRef = doc(db, 'greenhouses', workspaceId, 'plants', plantId);
    await updateDoc(docRef, data);
  },

  async deletePlant(workspaceId: string, plantId: string): Promise<void> {
    const docRef = doc(db, 'greenhouses', workspaceId, 'plants', plantId);
    await deleteDoc(docRef);
  },

  async setActivePlant(workspaceId: string, activePlantId: string, allPlantIds: string[]): Promise<void> {
    const batch = writeBatch(db);

    allPlantIds.forEach(id => {
      const docRef = doc(db, 'greenhouses', workspaceId, 'plants', id);
      batch.update(docRef, { active: id === activePlantId });
    });

    await batch.commit();
  }
};
