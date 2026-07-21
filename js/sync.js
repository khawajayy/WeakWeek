/* ==========================================================================
   Week Maxxing — cloud sync (Firebase Auth + Firestore)

   Local-first: app.js keeps saving to localStorage instantly. This module
   - signs the user in with Google,
   - pushes state to users/{uid}/data/current (debounced) after every save,
   - listens for remote changes and applies newer snapshots,
   - resolves conflicts by meta.lastModified (newest device wins).
   The Firebase web config below is a public identifier, not a secret;
   Firestore security rules are what protect the data.
   ========================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  onAuthStateChanged, signOut,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore, doc, onSnapshot, setDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDDJzRlt9DE2QrbfR3iY-GtwBBAwWvD_Ic",
  authDomain: "weekmaxxing.firebaseapp.com",
  projectId: "weekmaxxing",
  storageBucket: "weekmaxxing.firebasestorage.app",
  messagingSenderId: "151435276092",
  appId: "1:151435276092:web:11ed9fd93e848646e6b839",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// memory-only cache on purpose: localStorage (via app.js) is already the offline
// layer. Firestore's own persistent disk cache would let onSnapshot fire first
// with a stale prior-session snapshot before the real server state arrives —
// exactly the race that let one device's push clobber another's.
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const dot = document.getElementById("sync-dot");
const btn = document.getElementById("btn-auth");

let unsubscribe = null;
let pushTimer = null;
let lastSyncedJson = null;

/* ---------- status indicator ---------- */
const STATUS = {
  local:   { cls: "local",   title: "Not signed in — data stays on this device" },
  syncing: { cls: "syncing", title: "Syncing…" },
  synced:  { cls: "synced",  title: "Synced to cloud" },
  error:   { cls: "error",   title: "Sync error — changes are safe locally, will retry" },
};
function setStatus(key) {
  dot.className = "sync-dot " + STATUS[key].cls;
  dot.title = STATUS[key].title;
}

/* ---------- auth UI ---------- */
function renderAuthUi(user) {
  if (user) {
    const label = user.displayName ? user.displayName.split(" ")[0] : "Account";
    btn.innerHTML = user.photoURL
      ? `<img class="auth-avatar" src="${user.photoURL}" alt="" referrerpolicy="no-referrer"> ${label}`
      : `👤 ${label}`;
    btn.title = `Signed in as ${user.email} — click to sign out`;
  } else {
    btn.textContent = "Sign in";
    btn.title = "Sign in with Google to sync across devices";
  }
}

btn.addEventListener("click", async () => {
  if (auth.currentUser) {
    if (confirm(`Sign out of ${auth.currentUser.email}?\nYour data stays on this device and in the cloud.`)) {
      await signOut(auth);
    }
    return;
  }
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    // popups are often blocked on mobile — fall back to full-page redirect
    if (e && (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment"
        || e.code === "auth/cancelled-popup-request" || e.code === "auth/popup-closed-by-user")) {
      if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") {
        await signInWithRedirect(auth, provider);
      }
    } else {
      console.error("Sign-in failed:", e);
      setStatus("error");
    }
  }
});

/* ---------- sync engine ---------- */
function userDoc(user) {
  return doc(db, "users", user.uid, "data", "current");
}

async function pushNow() {
  const user = auth.currentUser;
  if (!user) return;
  const json = JSON.stringify(window.WeekMaxxing.getState());
  if (json === lastSyncedJson) { setStatus("synced"); return; }
  try {
    await setDoc(userDoc(user), { data: json, updatedAt: serverTimestamp() });
    lastSyncedJson = json;
    setStatus("synced");
  } catch (e) {
    console.error("Sync push failed:", e);
    setStatus("error");
  }
}

onAuthStateChanged(auth, (user) => {
  renderAuthUi(user);
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  if (!user) { setStatus("local"); return; }

  setStatus("syncing");
  unsubscribe = onSnapshot(userDoc(user), (snap) => {
    if (snap.metadata.hasPendingWrites) return; // our own write echoing back
    // never act on a snapshot that isn't confirmed by the server — a cache-only
    // read can be stale and must not be allowed to decide an overwrite
    if (snap.metadata.fromCache) return;
    if (!snap.exists()) { pushNow(); return; }  // first sign-in: upload local progress

    let remote;
    try { remote = JSON.parse(snap.data().data); } catch { setStatus("error"); return; }
    const remoteJson = JSON.stringify(remote);
    if (remoteJson === lastSyncedJson) { setStatus("synced"); return; }

    const local = window.WeekMaxxing.getState();
    if ((remote.meta?.lastModified || 0) >= (local.meta?.lastModified || 0)) {
      lastSyncedJson = remoteJson;
      window.WeekMaxxing.applyRemoteState(remote);
      setStatus("synced");
    } else {
      pushNow(); // local is newer — cloud catches up
    }
  }, (err) => {
    console.error("Sync listener error:", err);
    setStatus("error");
  });
});

// app.js fires this after every user-driven save (already debounced 150ms there)
window.addEventListener("weekmaxxing:saved", () => {
  if (!auth.currentUser) return;
  setStatus("syncing");
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushNow, 1200);
});

// flush pending changes when the tab is being closed/backgrounded
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && auth.currentUser) {
    clearTimeout(pushTimer);
    pushNow();
  }
});

setStatus("local");
