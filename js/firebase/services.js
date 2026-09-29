// Модуль работы с каталогом услуг (основная сущность проекта):
// CRUD + реальный поиск + фильтрация + сортировка + пагинация + realtime.
import { db } from "./firebase-config.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs,
  query, where, orderBy, limit, startAfter, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const COL = "services";
export const PAGE_SIZE = 8;

// Разбиваем название и описание на слова для поиска через array-contains —
// это и есть "реальный поиск через запросы Firestore" по названию/описанию.
function buildSearchTokens(name, description) {
  const text = `${name} ${description}`.toLowerCase();
  return Array.from(new Set(text.split(/[^а-яёa-z0-9]+/i).filter(Boolean)));
}

export async function createService(data) {
  return addDoc(collection(db, COL), {
    name: data.name,
    description: data.description,
    category: data.category,
    basePrice: Number(data.basePrice),
    imageEmoji: data.imageEmoji || "🎨",
    imageUrl: data.imageUrl || "",
    searchTokens: buildSearchTokens(data.name, data.description),
    avgRating: 0,
    reviewsCount: 0,
    createdAt: Date.now()
  });
}

export async function updateService(id, data) {
  const patch = { ...data };
  if (data.basePrice !== undefined) patch.basePrice = Number(data.basePrice);
  if (data.name || data.description) {
    const current = await getDoc(doc(db, COL, id));
    const cur = current.data() || {};
    const name = data.name ?? cur.name;
    const description = data.description ?? cur.description;
    patch.searchTokens = buildSearchTokens(name, description);
  }
  return updateDoc(doc(db, COL, id), patch);
}

// Готовый набор услуг для первого запуска. Доступен только через админ-панель;
// повторный клик не создаёт дубликаты.
const STARTER_SERVICES = [
  { name: "Минимализм: тонкая линия", category: "Минимализм", basePrice: 18000, imageEmoji: "✦", imageUrl: "https://images.unsplash.com/photo-1562962230-16e4623d36e6?auto=format&fit=crop&w=1000&q=85", description: "Лаконичные тату с тонким контуром: символы, даты и небольшие персональные эскизы." },
  { name: "Графика и блэкворк", category: "Блэкворк", basePrice: 30000, imageEmoji: "◼", imageUrl: "https://images.unsplash.com/photo-1590246814883-57d1d95f7e9f?auto=format&fit=crop&w=1000&q=85", description: "Контрастная графика, плотный чёрный и выразительные композиции для заметного результата." },
  { name: "Аниме-персонаж", category: "Аниме", basePrice: 35000, imageEmoji: "◉", imageUrl: "https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?auto=format&fit=crop&w=1000&q=85", description: "Динамичные персонажи и узнаваемые детали любимых вселенных — по вашему референсу." },
  { name: "Реализм: портрет", category: "Реализм", basePrice: 50000, imageEmoji: "◌", imageUrl: "https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28?auto=format&fit=crop&w=1000&q=85", description: "Детальная работа со светом, объёмом и текстурой для эмоционального реалистичного образа." },
  { name: "Казахский орнамент", category: "Орнаментал", basePrice: 28000, imageEmoji: "❖", imageUrl: "https://images.unsplash.com/photo-1581804928342-4e3405e39c91?auto=format&fit=crop&w=1000&q=85", description: "Современная интерпретация ұлттық ою-өрнек: ритм линий, смысл и персональная композиция." },
  { name: "Индивидуальный эскиз", category: "Другое", basePrice: 25000, imageEmoji: "✎", imageUrl: "https://images.unsplash.com/photo-1611501275019-9b5cda994e8d?auto=format&fit=crop&w=1000&q=85", description: "Сначала обсуждаем идею и создаём уникальный эскиз, затем подбираем размер и расположение." }
];

export async function seedStarterServices() {
  const existing = await getDocs(collection(db, COL));
  if (!existing.empty) return { created: 0, reason: "not-empty" };
  await Promise.all(STARTER_SERVICES.map(createService));
  return { created: STARTER_SERVICES.length };
}

export function deleteService(id) {
  return deleteDoc(doc(db, COL, id));
}

export async function getService(id) {
  const snap = await getDoc(doc(db, COL, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function fetchAllServicesLite() {
  // для админки (выпадающие списки и т.п.) — без пагинации, только нужные поля
  const snap = await getDocs(query(collection(db, COL), orderBy("createdAt", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Главная функция каталога: фильтр + сортировка + поиск + пагинация
export async function fetchServicesPage({ category = "all", sortBy = "newest", searchWord = "", cursor = null } = {}) {
  const clauses = [];
  if (category !== "all") clauses.push(where("category", "==", category));
  if (searchWord) clauses.push(where("searchTokens", "array-contains", searchWord.toLowerCase()));

  let orderField = "createdAt", dir = "desc";
  if (sortBy === "oldest") { orderField = "createdAt"; dir = "asc"; }
  if (sortBy === "price-asc") { orderField = "basePrice"; dir = "asc"; }
  if (sortBy === "price-desc") { orderField = "basePrice"; dir = "desc"; }
  if (sortBy === "rating") { orderField = "avgRating"; dir = "desc"; }

  const baseClauses = [...clauses, orderBy(orderField, dir)];
  let q = cursor
    ? query(collection(db, COL), ...baseClauses, startAfter(cursor), limit(PAGE_SIZE))
    : query(collection(db, COL), ...baseClauses, limit(PAGE_SIZE));

  const snap = await getDocs(q);
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const nextCursor = snap.docs.length === PAGE_SIZE ? snap.docs[snap.docs.length - 1] : null;
  return { items, nextCursor };
}

export async function fetchRelatedServices(category, excludeId, take = 6) {
  const q = query(collection(db, COL), where("category", "==", category), limit(take + 1));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.id !== excludeId).slice(0, take);
}

// Realtime: первая страница каталога без фильтров обновляется сама,
// когда админ добавляет/меняет услугу — без перезагрузки страницы.
export function subscribeCatalogFirstPage(callback) {
  const q = query(collection(db, COL), orderBy("createdAt", "desc"), limit(PAGE_SIZE));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}
