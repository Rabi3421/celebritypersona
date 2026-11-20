import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getStorage, type FirebaseStorage } from "firebase/storage";

/**
 * Firebase is used only as an image store. The web config below is public by
 * design; what protects the bucket is the Storage rules, which let exactly one
 * account read, list, write and delete: the uploader account this server signs
 * in as. Visitors never need the rules: every photo on the site is a download
 * URL carrying its own token, which Storage serves regardless of the rules.
 *
 * The browser never talks to Storage directly; uploads come through
 * /api/admin/upload, behind the admin session.
 */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function firebaseApp() {
  if (!config.storageBucket) {
    throw new Error("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is not set.");
  }
  return getApps().length ? getApp() : initializeApp(config);
}

/** One sign-in shared by every request that arrives while it is in flight. */
let signingIn: Promise<unknown> | undefined;

/**
 * Storage, signed in as the uploader account. Server-only: the credentials are
 * plain (not NEXT_PUBLIC_) environment variables, so they never reach a bundle.
 * The SDK keeps the session in memory and refreshes its token by itself, so a
 * warm server signs in once.
 */
export async function uploaderStorage(): Promise<FirebaseStorage> {
  const app = firebaseApp();
  const auth = getAuth(app);
  if (!auth.currentUser) {
    const email = process.env.FIREBASE_UPLOADER_EMAIL;
    const password = process.env.FIREBASE_UPLOADER_PASSWORD;
    if (!email || !password) {
      throw new Error("FIREBASE_UPLOADER_EMAIL and FIREBASE_UPLOADER_PASSWORD must be set.");
    }
    signingIn ??= signInWithEmailAndPassword(auth, email, password).finally(() => {
      signingIn = undefined;
    });
    await signingIn;
  }
  return getStorage(app);
}
