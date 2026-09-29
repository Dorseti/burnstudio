// Модуль управления пользователями (для админ-панели)
import { db } from "./firebase-config.js";
import {
  collection, doc, getDocs, updateDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

export async function fetchAllUsers() {
  const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function setUserRole(uid, role) {
  return updateDoc(doc(db, "users", uid), { role });
}
