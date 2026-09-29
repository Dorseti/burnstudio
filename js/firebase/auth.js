// Модуль авторизации: регистрация, вход, выход, восстановление пароля,
// хранение роли пользователя (user / admin) в коллекции users.
import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  doc, setDoc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// Регистрация нового пользователя + создание профиля в Firestore
export async function registerUser({ email, password, name, phone }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await setDoc(doc(db, "users", cred.user.uid), {
    name,
    phone,
    email,
    role: "user", // по умолчанию всегда обычный пользователь
    createdAt: Date.now()
  });
  return cred.user;
}

export async function loginUser(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export function logoutUser() {
  return signOut(auth);
}

export function resetPassword(email) {
  return sendPasswordResetEmail(auth, email);
}

// Подписка на изменение состояния авторизации
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

// Получить профиль пользователя (имя, телефон, роль) из Firestore
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function updateOwnProfile(uid, patch) {
  // setDoc(..., { merge: true }) работает и для существующего профиля, и
  // для аккаунта, созданного вручную в Firebase Auth без документа users.
  // Именно отсутствие такого документа раньше ломало кнопку «Сохранить».
  const cleanPatch = {
    name: String(patch.name || "").trim(),
    phone: String(patch.phone || "").trim()
  };
  const ref = doc(db, "users", uid);
  const existing = await getDoc(ref);
  // Роль задаётся только при восстановлении отсутствующего документа. Для
  // существующего профиля (включая профиль администратора) она не меняется.
  const profilePatch = existing.exists()
    ? { ...cleanPatch, updatedAt: serverTimestamp() }
    : { ...cleanPatch, role: "user", createdAt: Date.now(), updatedAt: serverTimestamp() };
  return setDoc(ref, profilePatch, { merge: true });
}

// Защита страницы: пускает дальше только авторизованных
export function requireAuth(redirectTo = "./login.html") {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      if (!user) {
        window.location.href = redirectTo;
      } else {
        resolve(user);
      }
    });
  });
}

// Защита страницы: пускает дальше только администраторов
export async function requireAdmin(redirectTo = "./index.html") {
  const user = await requireAuth();
  const profile = await getUserProfile(user.uid);
  if (!profile || profile.role !== "admin") {
    alert("Эта страница доступна только администратору");
    window.location.href = redirectTo;
    throw new Error("not-admin");
  }
  return { user, profile };
}
