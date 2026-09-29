// Модуль отзывов: один отзыв на пользователя на услугу (id = serviceId_userId),
// рейтинг услуги пересчитывается транзакцией при добавлении/изменении/удалении.
import { db } from "./firebase-config.js";
import {
  collection, doc, deleteDoc, getDocs, query, where, orderBy,
  onSnapshot, runTransaction
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const COL = "reviews";
const SERVICES_COL = "services";

function reviewId(serviceId, userId) {
  return `${serviceId}_${userId}`;
}

export async function upsertReview({ serviceId, userId, userName, rating, text }) {
  const refReview = doc(db, COL, reviewId(serviceId, userId));
  const refService = doc(db, SERVICES_COL, serviceId);

  await runTransaction(db, async (tx) => {
    const serviceSnap = await tx.get(refService);
    const reviewSnap = await tx.get(refReview);
    const service = serviceSnap.data() || {};

    let avgRating = service.avgRating || 0;
    let reviewsCount = service.reviewsCount || 0;

    if (reviewSnap.exists()) {
      const oldRating = reviewSnap.data().rating;
      avgRating = reviewsCount > 0 ? (avgRating * reviewsCount - oldRating + rating) / reviewsCount : rating;
    } else {
      avgRating = (avgRating * reviewsCount + rating) / (reviewsCount + 1);
      reviewsCount += 1;
    }

    tx.set(refReview, { serviceId, userId, userName, rating, text, createdAt: Date.now() });
    tx.update(refService, { avgRating, reviewsCount });
  });
}

export async function deleteReview(serviceId, userId) {
  const refReview = doc(db, COL, reviewId(serviceId, userId));
  const refService = doc(db, SERVICES_COL, serviceId);

  await runTransaction(db, async (tx) => {
    const serviceSnap = await tx.get(refService);
    const reviewSnap = await tx.get(refReview);
    if (!reviewSnap.exists()) return;

    const { rating } = reviewSnap.data();
    const service = serviceSnap.data() || {};
    let reviewsCount = Math.max(0, (service.reviewsCount || 0) - 1);
    let avgRating = reviewsCount > 0
      ? ((service.avgRating || 0) * (reviewsCount + 1) - rating) / reviewsCount
      : 0;

    tx.delete(refReview);
    tx.update(refService, { avgRating, reviewsCount });
  });
}

// Realtime: новые отзывы на странице услуги появляются без перезагрузки
export function subscribeServiceReviews(serviceId, callback) {
  const q = query(collection(db, COL), where("serviceId", "==", serviceId), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export async function fetchUserReviews(userId) {
  const q = query(collection(db, COL), where("userId", "==", userId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function deleteReviewByAdmin(serviceId, userId) {
  return deleteReview(serviceId, userId);
}
