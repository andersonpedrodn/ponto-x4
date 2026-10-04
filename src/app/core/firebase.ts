import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { firebaseConfig } from '../../environments/firebase.config';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// cache local: o app abre e registra batidas mesmo sem internet e sincroniza depois
export const firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
