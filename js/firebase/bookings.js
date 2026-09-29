// Модуль записей (bookings) — "активные действия" + перевод в историю.
import { db, } from "./firebase-config.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs,
  query, where, orderBy, onSnapshot, writeBatch
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const COL = "bookings";
const HISTORY_COL = "history";

export async function getBooking(id) {
  const snap = await getDoc(doc(db, COL, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export function updateBooking(id, patch) {
  return updateDoc(doc(db, COL, id), patch);
}

export async function isSlotTaken(date, time) {
  const q = query(collection(db, COL), where("date", "==", date), where("time", "==", time));
  const snap = await getDocs(q);
  return !snap.empty;
}

export async function fetchTakenSlots(date) {
  const q = query(collection(db, COL), where("date", "==", date));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data().time);
}

export async function createBooking(data) {
  return addDoc(collection(db, COL), { ...data, status: "pending", createdAt: Date.now() });
}

// Realtime: активные записи текущего пользователя (личный кабинет / "Мои записи")
export function subscribeUserBookings(userId, callback) {
  const q = query(collection(db, COL), where("userId", "==", userId), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

// Realtime: все активные записи (для админ-панели)
export function subscribeAllBookings(callback) {
  const q = query(collection(db, COL), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export function cancelBooking(id) {
  return deleteDoc(doc(db, COL, id));
}

export function confirmBooking(id) {
  return updateDoc(doc(db, COL, id), { status: "confirmed" });
}

// Перевод записи в историю: одной атомарной операцией создаём запись
// в history и удаляем из активных bookings (только админ, см. security rules).
export async function completeBooking(booking) {
  const batch = writeBatch(db);
  const historyRef = doc(collection(db, HISTORY_COL));
  const { id, ...rest } = booking;
  batch.set(historyRef, { ...rest, status: "done", completedAt: Date.now() });
  batch.delete(doc(db, COL, id));
  return batch.commit();
}

export async function fetchUserHistory(userId) {
  const q = query(collection(db, HISTORY_COL), where("userId", "==", userId), orderBy("completedAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function fetchAllHistory() {
  const q = query(collection(db, HISTORY_COL), orderBy("completedAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
