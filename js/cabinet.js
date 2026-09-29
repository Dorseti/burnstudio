// Личный кабинет: редактирование профиля, история завершённых записей,
// управление своими отзывами.
import { initLayout } from "./layout.js";
import { requireAuth, getUserProfile, updateOwnProfile } from "./firebase/auth.js";
import { fetchUserHistory } from "./firebase/bookings.js";
import { fetchUserReviews, deleteReview, upsertReview } from "./firebase/reviews.js";
import { escapeHtml, formatPrice, formatDate, showAlert, renderStars } from "./utils.js";

initLayout();
const alertContainer = document.getElementById("alert-container");

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

async function init() {
  const user = await requireAuth("./login.html");
  const profile = await getUserProfile(user.uid);

  document.getElementById("profile-name").value = profile?.name || "";
  document.getElementById("profile-phone").value = profile?.phone || "";
  document.getElementById("profile-email").value = user.email;

  document.getElementById("profile-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await updateOwnProfile(user.uid, {
        name: document.getElementById("profile-name").value.trim(),
        phone: document.getElementById("profile-phone").value.trim()
      });
      showAlert(alertContainer, "Профиль обновлён", "success");
    } catch (err) {
      console.error("Ошибка сохранения профиля:", err);
      showAlert(alertContainer, "Не удалось сохранить: " + err.message, "error");
    }
  });

  // История
  const history = await fetchUserHistory(user.uid);
  const historyList = document.getElementById("history-list");
  if (history.length === 0) {
    historyList.innerHTML = `<div class="card"><div class="empty-state"><p>История пуста</p><p style="font-size:13px;">Здесь появятся завершённые визиты</p></div></div>`;
  } else {
    historyList.innerHTML = "";
    history.forEach(b => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="card-title"><span>${escapeHtml(b.serviceName || b.style)}</span><span class="badge">${formatPrice(b.price)}</span></div>
        <p>${b.date} · ${b.time}</p>
        <div class="row">
          <span class="pill pill-strong">${escapeHtml(b.style)}</span>
          <span class="pill">${escapeHtml(b.size)}</span>
          <span class="pill">${escapeHtml(b.color)}</span>
        </div>
        <p style="font-size:11px;color:var(--muted);margin-top:8px;">Завершено: ${formatDate(b.completedAt)}</p>
      `;
      historyList.appendChild(card);
    });
  }

  // Мои отзывы
  const reviews = await fetchUserReviews(user.uid);
  const reviewsList = document.getElementById("my-reviews-list");
  if (reviews.length === 0) {
    reviewsList.innerHTML = `<div class="card"><div class="empty-state"><p>Вы ещё не оставляли отзывов</p></div></div>`;
  } else {
    reviewsList.innerHTML = "";
    reviews.forEach(r => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="card-title">${renderStars(r.rating)}</div>
        <p>${escapeHtml(r.text)}</p>
        <div class="card-footer">
          <span style="font-size:11px;color:var(--muted);">${formatDate(r.createdAt)}</span>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="edit-btn">Редактировать</button>
            <button class="delete-btn">Удалить отзыв</button>
          </div>
        </div>
      `;
      card.querySelector(".edit-btn").addEventListener("click", async () => {
        const text = prompt("Измените текст отзыва:", r.text);
        if (text === null) return;
        const cleanText = text.trim();
        if (!cleanText) {
          showAlert(alertContainer, "Текст отзыва не может быть пустым", "error");
          return;
        }
        try {
          await upsertReview({
            serviceId: r.serviceId,
            userId: user.uid,
            userName: profile?.name || user.email,
            rating: r.rating,
            text: cleanText
          });
          card.querySelector("p").textContent = cleanText;
          showAlert(alertContainer, "Отзыв обновлён", "success");
        } catch (err) {
          showAlert(alertContainer, "Не удалось обновить отзыв: " + err.message, "error");
        }
      });
      card.querySelector(".delete-btn").addEventListener("click", async () => {
        if (!confirm("Удалить отзыв?")) return;
        await deleteReview(r.serviceId, user.uid);
        card.remove();
        showAlert(alertContainer, "Отзыв удалён", "success");
      });
      reviewsList.appendChild(card);
    });
  }
}

init();
