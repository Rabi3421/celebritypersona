import { getApp, getApps, initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";

/**
 * Firebase is used only as an image store. The web config below is public by
 * design; what protects the bucket is the Storage rules plus the fact that
 * uploads go through /api/admin/upload, which requires an admin session. The
 * browser never talks to Storage directly.
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

export const firebaseStorage = () => getStorage(firebaseApp());
