import { Injectable, signal } from '@angular/core';
import { GoogleAuthProvider, User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth } from './firebase';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly user = signal<User | null>(null);
  /** false até o Firebase informar o estado inicial do login. */
  readonly pronto = signal(false);
  readonly erro = signal('');

  constructor() {
    onAuthStateChanged(auth, u => {
      this.user.set(u);
      this.pronto.set(true);
    });
  }

  async entrarComGoogle() {
    this.erro.set('');
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        this.erro.set(`Não foi possível entrar (${code ?? 'erro desconhecido'}). Tente novamente.`);
      }
    }
  }

  sair() {
    return signOut(auth);
  }
}
