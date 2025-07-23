// --- Firebase & SDK Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signOut
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// 🔧 Deine Firebase‑Config hier eintragen:
const firebaseConfig = {
  apiKey: "API_KEY",
  authDomain: "PROJECT_ID.firebaseapp.com",
  projectId: "PROJECT_ID",
  storageBucket: "PROJECT_ID.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};

// App initialisieren
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// Offline‑First aktivieren
enableIndexedDbPersistence(db).catch(err => console.warn("Offline-Persistenz:", err.code));

// UI‑Refs
const onboarding   = document.getElementById('onboarding');
const appContainer = document.getElementById('app');
const notesList    = document.getElementById('notesList');
const editor       = document.getElementById('editor');
const authForm     = document.getElementById('authForm');
const submitBtn    = document.getElementById('submitBtn');
const formTitle    = document.getElementById('formTitle');
const formSwitch   = document.getElementById('formSwitchText');

let isSignup = false;
let notes    = [];
let activeId = null;

// --- Auth State Listener ---
onAuthStateChanged(auth, user => {
  if (user) {
    onboarding.classList.add('hidden');
    appContainer.classList.remove('hidden');
    initNotesListener(user.uid);
  } else {
    onboarding.classList.remove('hidden');
    appContainer.classList.add('hidden');
  }
});

// --- Email/Password & Signup/Login ---
async function handleAuth(e) {
  e.preventDefault();
  const email = authForm.email.value;
  const pw    = authForm.password.value;
  try {
    if (isSignup) {
      await createUserWithEmailAndPassword(auth, email, pw);
    } else {
      await signInWithEmailAndPassword(auth, email, pw);
    }
  } catch(err) {
    alert(`Auth-Fehler: ${err.message}`);
  }
}
function toggleSignup() {
  isSignup = !isSignup;
  formTitle.textContent = isSignup ? 'Sign up' : 'Log in';
  submitBtn.textContent = isSignup ? 'Sign up' : 'Log in';
  formSwitch.innerHTML = isSignup
    ? 'Already have an account? <a href="#" onclick="toggleSignup()">Log in</a>'
    : 'Don’t have an account? <a href="#" onclick="toggleSignup()">Sign up</a>';
}
function forgotPassword() {
  const email = authForm.email.value;
  if (!email) return alert('Bitte E‑Mail eingeben!');
  sendPasswordResetEmail(auth, email)
    .then(() => alert('Password reset E‑Mail gesendet!'))
    .catch(err => alert(`Error: ${err.message}`));
}

// --- Google Login ---
function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  signInWithPopup(auth, provider)
    .catch(err => alert(`Google Login Error: ${err.message}`));
}

// --- Apple Login ---
async function signInWithApple() {
  try {
    const provider = new OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(auth, provider);
  } catch(err) {
    alert(`Apple Login Error: ${err.message}`);
  }
}

// --- Sign Out ---
function signOutUser() {
  signOut(auth);
}
window.signOut = signOutUser;

// --- Firestore: Realtime Listener & CRUD ---
function initNotesListener(uid) {
  const col = collection(db, `users/${uid}/notes`);
  onSnapshot(col, snap => {
    notes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderNotes();
  });
}

async function newNote() {
  const user = auth.currentUser;
  if (!user) return;
  await addDoc(collection(db, `users/${user.uid}/notes`), {
    content: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

function renderNotes() {
  notesList.innerHTML = '';
  notes
    .sort((a,b) => b.createdAt?.toMillis() - a.createdAt?.toMillis())
    .forEach(n => {
      const div = document.createElement('div');
      div.className = 'note-item' + (n.id === activeId ? ' active' : '');
      div.textContent = n.content.replace(/<[^>]+>/g, '').slice(0,20) || 'Neue Notiz';
      div.onclick = () => selectNote(n.id);
      notesList.appendChild(div);
    });
}

async function selectNote(id) {
  activeId = id;
  const note = notes.find(n => n.id === id);
  editor.innerHTML = note.content;
  renderNotes();
}

async function saveCurrent() {
  if (!activeId) return;
  const user = auth.currentUser;
  if (!user) return;
  const content = editor.innerHTML;
  await updateDoc(
    doc(db, `users/${user.uid}/notes/${activeId}`),
    { content, updatedAt: serverTimestamp() }
  );
}

// --- Rich-Text Controls ---
function format(cmd) {
  document.execCommand(cmd, false, null);
  saveCurrent();
}
function insertChecklist() {
  document.execCommand('insertHTML', false, '<div contenteditable="false">☐  </div>');
  saveCurrent();
}
function attachImage() {
  const url = prompt('Image URL');
  if (url) {
    document.execCommand('insertImage', false, url);
    saveCurrent();
  }
}

// Persist edit and search
editor.addEventListener('input', saveCurrent);
function searchNotes(q) {
  Array.from(notesList.children).forEach(item => {
    item.style.display = item.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
  });
}

// --- UI Helpers ---
function closeOnboarding() {
  onboarding.classList.add('hidden');
  appContainer.classList.remove('hidden');
}
function toggleTheme() {
  const html = document.documentElement;
  html.dataset.theme = html.dataset.theme === 'light' ? 'dark' : 'light';
}
function togglePassword() {
  const pw  = document.getElementById('password');
  const btn = document.querySelector('.pwd-toggle');
  if (pw.type === 'password') {
    pw.type = 'text'; btn.textContent = 'Hide';
  } else {
    pw.type = 'password'; btn.textContent = 'Show';
  }
}
