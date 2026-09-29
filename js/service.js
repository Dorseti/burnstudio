// Логика страницы детального просмотра услуги: инфо, отзывы (realtime),
// похожие услуги с пагинацией, переход к записи.
import { initLayout } from "./layout.js";
import { onAuthChange, getUserProfile } from "./firebase/auth.js";
import { getService, fetchRelatedServices } from "./firebase/services.js";
import { subscribeServiceReviews, upsertReview, deleteReview } from "./firebase/reviews.js";
import { escapeHtml, formatPrice, renderStars, mountStarPicker, showAlert, formatDate } from "./utils.js";

initLayout();

const params = new URLSearchParams(window.location.search);
const serviceId = params.get("id");
const alertContainer = document.getElementById("alert-container");

let currentUser = null;
let currentProfile = null;

if (!serviceId) {
  window.location.href = "./index.html";
}

async function renderServiceInfo() {
  const service = await getService(serviceId);
  const box = document.getElementById("service-detail");

  if (!service) {
    box.innerHTML = `<p class="center-note">Услуга не найдена</p>`;
    return null;
  }

  box.innerHTML = `
    <div class="panel-top">
      <h2 class="panel-title">${escapeHtml(service.name)}</h2>
      <div class="panel-chip">${escapeHtml(service.category)}</div>
    </div>
    <div class="card">
      <div class="service-photo service-photo-large" style="background-image:linear-gradient(180deg,transparent 25%,rgba(5,8,14,.9)),url('${escapeHtml(service.imageUrl || "")}')"><span>${escapeHtml(service.imageEmoji || "🎨")}</span></div>
      <p style="line-height:1.7; color: var(--muted);">${escapeHtml(service.description)}</p>
      <div class="row" style="margin-top:12px;">
        <span class="pill pill-strong">${formatPrice(service.basePrice)} — базовая цена</span>
        ${renderStars(service.avgRating || 0)}
        <span class="pill">${service.reviewsCount || 0} отзывов</span>
      </div>
      <a class="btn-primary" style="display:inline-block; margin-top:16px; text-decoration:none;" href="./form.html?service=${service.id}">Записаться</a>
    </div>
  `;
  return service;
}

function reviewCard(r, service) {
  const canManage = currentUser && (currentUser.uid === r.userId || currentProfile?.role === "admin");
  const div = document.createElement("div");
  div.className = "review-item";
  div.innerHTML = `
    <div class="review-head">
      <strong>${escapeHtml(r.userName)}</strong>
      ${renderStars(r.rating)}
    </div>
    <p>${escapeHtml(r.text)}</p>
    <p style="font-size:11px; color: var(--muted); margin-top:4px;">${formatDate(r.createdAt)}</p>
    ${canManage ? `<button class="btn-small danger" data-uid="${r.userId}" style="margin-top:8px;">Удалить</button>` : ""}
  `;
  if (canManage) {
    div.querySelector("button").addEventListener("click", async () => {
      if (!confirm("Удалить отзыв?")) return;
      await deleteReview(service.id, r.userId);
      showAlert(alertContainer, "Отзыв удалён", "success");
    });
  }
  return div;
}

function mountReviewForm(service) {
  const wrap = document.getElementById("review-form-wrap");
  if (!currentUser) {
    wrap.innerHTML = `<p class="center-note"><a href="./login.html">Войдите</a>, чтобы оставить отзыв</p>`;
    return;
  }

  wrap.innerHTML = `
    <form id="review-form" class="form" style="margin-bottom: 16px;">
      <div class="field">
        <label>Ваша оценка</label>
        <div id="star-picker"></div>
      </div>
      <div class="field field-wide">
        <label for="review-text">Отзыв</label>
        <textarea id="review-text" rows="2" placeholder="Поделитесь впечатлением..."></textarea>
      </div>
      <div class="form-bottom">
        <div></div>
        <button type="submit" class="btn-primary">Отправить отзыв</button>
      </div>
    </form>
  `;

  const picker = mountStarPicker(document.getElementById("star-picker"), 5, () => {});

  document.getElementById("review-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = document.getElementById("review-text").value.trim();
    if (!text) {
      showAlert(alertContainer, "Напишите текст отзыва", "error");
      return;
    }
    await upsertReview({
      serviceId: service.id,
      userId: currentUser.uid,
      userName: currentProfile?.name || currentUser.email,
      rating: picker.getValue(),
      text
    });
    document.getElementById("review-text").value = "";
    showAlert(alertContainer, "Спасибо за отзыв!", "success");
  });
}

let relatedCursorIndex = 0;
let relatedAll = [];

async function renderRelated(service) {
  relatedAll = await fetchRelatedServices(service.category, service.id, 12);
  relatedCursorIndex = 0;
  const grid = document.getElementById("related-grid");
  const moreBtn = document.getElementById("related-more");
  grid.innerHTML = "";

  function showMore() {
    const chunk = relatedAll.slice(relatedCursorIndex, relatedCursorIndex + 4);
    chunk.forEach(s => {
      const card = document.createElement("div");
      card.className = "card service-card";
      card.style.flex = "1 1 220px";
      card.style.maxWidth = "280px";
      card.innerHTML = `
        <div class="service-photo" style="background-image:linear-gradient(180deg,transparent 35%,rgba(5,8,14,.88)),url('${escapeHtml(s.imageUrl || "")}')"><span>${escapeHtml(s.imageEmoji || "🎨")}</span></div>
        <div class="card-title"><span>${escapeHtml(s.name)}</span><span class="badge">${formatPrice(s.basePrice)}</span></div>
        ${renderStars(s.avgRating || 0)}
      `;
      card.addEventListener("click", () => window.location.href = `./service.html?id=${s.id}`);
      grid.appendChild(card);
    });
    relatedCursorIndex += 4;
    moreBtn.style.display = relatedCursorIndex < relatedAll.length ? "inline-block" : "none";
  }

  if (relatedAll.length === 0) {
    grid.innerHTML = `<p class="center-note">Похожих услуг пока нет</p>`;
    moreBtn.style.display = "none";
    return;
  }

  moreBtn.onclick = showMore;
  showMore();
}

async function init() {
  const service = await renderServiceInfo();
  if (!service) return;

  onAuthChange(async (user) => {
    currentUser = user;
    currentProfile = user ? await getUserProfile(user.uid) : null;
    mountReviewForm(service);
  });

  subscribeServiceReviews(service.id, (reviews) => {
    document.getElementById("reviews-count").textContent = reviews.length;
    const list = document.getElementById("reviews-list");
    list.innerHTML = "";
    if (reviews.length === 0) {
      list.innerHTML = `<p class="center-note">Отзывов пока нет — будьте первым</p>`;
      return;
    }
    reviews.forEach(r => list.appendChild(reviewCard(r, service)));
  });

  renderRelated(service);
}

init();
