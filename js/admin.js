// Админ-панель: CRUD услуг, управление всеми записями (realtime),
// пользователи и роли, модерация отзывов, базовая статистика.
import { initLayout } from "./layout.js";
import { requireAdmin } from "./firebase/auth.js";
import {
  createService, updateService, deleteService, fetchAllServicesLite, seedStarterServices
} from "./firebase/services.js";
import {
  subscribeAllBookings, confirmBooking, completeBooking, cancelBooking, fetchAllHistory
} from "./firebase/bookings.js";
import { fetchAllUsers, setUserRole } from "./firebase/users.js";
import {
  subscribeServiceReviews, deleteReviewByAdmin
} from "./firebase/reviews.js";
import { escapeHtml, formatPrice, STATUS_MAP, showAlert, renderStars, formatDate } from "./utils.js";

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

let allServicesCache = [];

// ==================== УСЛУГИ (CRUD) ====================
const serviceForm = document.getElementById("service-form");
const serviceIdInput = document.getElementById("service-id");
const serviceFormMode = document.getElementById("service-form-mode");
const cancelEditBtn = document.getElementById("service-cancel-edit");

function resetServiceForm() {
  serviceForm.reset();
  serviceIdInput.value = "";
  serviceFormMode.textContent = "Новая";
  cancelEditBtn.style.display = "none";
}

serviceForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = {
    name: document.getElementById("s-name").value.trim(),
    category: document.getElementById("s-category").value,
    basePrice: document.getElementById("s-price").value,
    imageEmoji: document.getElementById("s-emoji").value.trim() || "🎨",
    imageUrl: document.getElementById("s-image-url").value.trim(),
    description: document.getElementById("s-description").value.trim()
  };

  if (!data.name || !data.description || !data.basePrice) {
    showAlert(alertContainer, "Заполните название, описание и цену", "error");
    return;
  }

  try {
    if (serviceIdInput.value) {
      await updateService(serviceIdInput.value, data);
      showAlert(alertContainer, "Услуга обновлена", "success");
    } else {
      await createService(data);
      showAlert(alertContainer, "Услуга добавлена", "success");
    }
    resetServiceForm();
    await renderServicesList();
    await fillServicesDropdown();
  } catch (err) {
    showAlert(alertContainer, "Ошибка: " + err.message, "error");
  }
});

cancelEditBtn.addEventListener("click", resetServiceForm);

document.getElementById("seed-services").addEventListener("click", async () => {
  try {
    const result = await seedStarterServices();
    if (!result.created) {
      showAlert(alertContainer, "Каталог уже заполнен — стартовый набор не добавлен, чтобы не создавать дубликаты.", "error");
      return;
    }
    showAlert(alertContainer, `Добавлено услуг: ${result.created}`, "success");
    await renderServicesList();
    await fillServicesDropdown();
  } catch (err) {
    showAlert(alertContainer, "Не удалось добавить услуги: " + err.message, "error");
  }
});

async function renderServicesList() {
  allServicesCache = await fetchAllServicesLite();
  const list = document.getElementById("admin-services-list");
  document.getElementById("services-count").textContent = allServicesCache.length;
  document.getElementById("stat-services").textContent = allServicesCache.length;
  list.innerHTML = "";

  if (allServicesCache.length === 0) {
    list.innerHTML = `<div class="card"><div class="empty-state"><p>Услуг пока нет — добавьте первую выше</p></div></div>`;
    return;
  }

  allServicesCache.forEach(s => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="service-photo" style="background-image:linear-gradient(180deg,transparent 35%,rgba(5,8,14,.88)),url('${escapeHtml(s.imageUrl || "")}')"><span>${escapeHtml(s.imageEmoji)}</span></div>
      <div class="card-title"><span>${escapeHtml(s.name)}</span><span class="badge">${formatPrice(s.basePrice)}</span></div>
      <p>${escapeHtml(s.description)}</p>
      <div class="row">
        <span class="pill pill-strong">${escapeHtml(s.category)}</span>
        ${renderStars(s.avgRating || 0)}
        <span class="pill">${s.reviewsCount || 0} отзывов</span>
      </div>
      <div class="card-footer">
        <button class="edit-btn">Редактировать</button>
        <button class="delete-btn">Удалить</button>
      </div>
    `;
    card.querySelector(".edit-btn").addEventListener("click", () => {
      serviceIdInput.value = s.id;
      document.getElementById("s-name").value = s.name;
      document.getElementById("s-category").value = s.category;
      document.getElementById("s-price").value = s.basePrice;
      document.getElementById("s-emoji").value = s.imageEmoji || "";
      document.getElementById("s-image-url").value = s.imageUrl || "";
      document.getElementById("s-description").value = s.description;
      serviceFormMode.textContent = "Редактирование";
      cancelEditBtn.style.display = "inline-block";
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    card.querySelector(".delete-btn").addEventListener("click", async () => {
      if (!confirm(`Удалить услугу "${s.name}"?`)) return;
      await deleteService(s.id);
      showAlert(alertContainer, "Услуга удалена", "success");
      await renderServicesList();
      await fillServicesDropdown();
    });
    list.appendChild(card);
  });
}

// ==================== ЗАПИСИ (realtime) ====================
function renderBookingsList(bookings) {
  const list = document.getElementById("admin-bookings-list");
  document.getElementById("bookings-count").textContent = bookings.length;
  document.getElementById("stat-active-bookings").textContent = bookings.length;

  const colorCount = bookings.filter(b => b.color === "Color").length;
  const bwCount = bookings.filter(b => b.color === "Black&White").length;
  document.getElementById("stat-color").textContent = colorCount;
  document.getElementById("stat-bw").textContent = bwCount;

  const sizes = { Small: 0, Medium: 0, Large: 0 };
  bookings.forEach(b => { if (sizes[b.size] !== undefined) sizes[b.size]++; });
  let popular = "—", max = 0;
  for (const k in sizes) if (sizes[k] > max) { max = sizes[k]; popular = k; }
  document.getElementById("stat-popular-size").textContent = popular;

  list.innerHTML = "";
  if (bookings.length === 0) {
    list.innerHTML = `<div class="card"><div class="empty-state"><p>Активных записей нет</p></div></div>`;
    return;
  }

  bookings.forEach(b => {
    const s = STATUS_MAP[b.status] || STATUS_MAP.pending;
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-title"><span>${escapeHtml(b.name)}</span><span class="badge">${formatPrice(b.price)}</span></div>
      <p>${escapeHtml(b.contact)} · ${b.date} · ${b.time}</p>
      <div class="row">
        <span class="pill pill-strong">${escapeHtml(b.style)}</span>
        <span class="pill">${escapeHtml(b.size)}</span>
        <span class="pill">${escapeHtml(b.color)}</span>
        <span class="pill">${escapeHtml(b.place)}</span>
      </div>
      ${b.description ? `<p style="margin-top:8px;">${escapeHtml(b.description)}</p>` : ""}
      <div class="card-footer">
        <span class="status-btn" style="border-color:${s.color};color:${s.color};cursor:default;">${s.label}</span>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          ${b.status === "pending" ? `<button class="btn-small" data-action="confirm">Подтвердить</button>` : ""}
          ${b.status !== "done" ? `<button class="btn-small" data-action="done">Завершить</button>` : ""}
          <button class="btn-small danger" data-action="cancel">Удалить</button>
        </div>
      </div>
    `;

    card.querySelector('[data-action="confirm"]')?.addEventListener("click", async () => {
      await confirmBooking(b.id);
      showAlert(alertContainer, "Запись подтверждена", "success");
    });
    card.querySelector('[data-action="done"]')?.addEventListener("click", async () => {
      await completeBooking(b);
      showAlert(alertContainer, "Запись перенесена в историю", "success");
      refreshHistoryStat();
    });
    card.querySelector('[data-action="cancel"]').addEventListener("click", async () => {
      if (!confirm("Удалить запись?")) return;
      await cancelBooking(b.id);
      showAlert(alertContainer, "Запись удалена", "success");
    });

    list.appendChild(card);
  });
}

async function refreshHistoryStat() {
  const history = await fetchAllHistory();
  document.getElementById("stat-history").textContent = history.length;
}

// ==================== ПОЛЬЗОВАТЕЛИ ====================
async function renderUsersList() {
  const users = await fetchAllUsers();
  document.getElementById("users-count").textContent = users.length;
  document.getElementById("stat-users").textContent = users.length;

  const list = document.getElementById("users-list");
  list.innerHTML = "";
  users.forEach(u => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-title">
        <span>${escapeHtml(u.name || "Без имени")}</span>
        <span class="role-badge ${u.role === "admin" ? "admin" : "user"}">${u.role === "admin" ? "ADMIN" : "USER"}</span>
      </div>
      <p>${escapeHtml(u.email)} · ${escapeHtml(u.phone || "—")}</p>
      <div class="card-footer">
        <span style="font-size:11px;color:var(--muted);">${formatDate(u.createdAt)}</span>
        <button class="btn-small" data-role="${u.role === "admin" ? "user" : "admin"}">
          ${u.role === "admin" ? "Убрать права админа" : "Назначить админом"}
        </button>
      </div>
    `;
    card.querySelector("button").addEventListener("click", async (e) => {
      const newRole = e.target.dataset.role;
      if (!confirm(`Изменить роль пользователя на "${newRole}"?`)) return;
      await setUserRole(u.id, newRole);
      showAlert(alertContainer, "Роль обновлена", "success");
      renderUsersList();
    });
    list.appendChild(card);
  });
}

// ==================== ОТЗЫВЫ (модерация) ====================
const reviewsSelect = document.getElementById("reviews-service-select");
let unsubscribeReviews = null;

async function fillServicesDropdown() {
  if (allServicesCache.length === 0) allServicesCache = await fetchAllServicesLite();
  reviewsSelect.innerHTML = allServicesCache.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
  if (allServicesCache.length > 0) loadReviewsFor(allServicesCache[0].id);
}

function loadReviewsFor(serviceId) {
  if (unsubscribeReviews) unsubscribeReviews();
  unsubscribeReviews = subscribeServiceReviews(serviceId, (reviews) => {
    document.getElementById("admin-reviews-count").textContent = reviews.length;
    const list = document.getElementById("admin-reviews-list");
    list.innerHTML = "";
    if (reviews.length === 0) {
      list.innerHTML = `<p class="center-note">Отзывов на эту услугу нет</p>`;
      return;
    }
    reviews.forEach(r => {
      const div = document.createElement("div");
      div.className = "review-item";
      div.innerHTML = `
        <div class="review-head"><strong>${escapeHtml(r.userName)}</strong>${renderStars(r.rating)}</div>
        <p>${escapeHtml(r.text)}</p>
        <button class="btn-small danger" style="margin-top:8px;">Удалить (модерация)</button>
      `;
      div.querySelector("button").addEventListener("click", async () => {
        if (!confirm("Удалить отзыв?")) return;
        await deleteReviewByAdmin(serviceId, r.userId);
        showAlert(alertContainer, "Отзыв удалён", "success");
      });
      list.appendChild(div);
    });
  });
}

reviewsSelect.addEventListener("change", () => loadReviewsFor(reviewsSelect.value));

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
async function init() {
  await requireAdmin("./index.html");

  await renderServicesList();
  await fillServicesDropdown();
  await renderUsersList();
  await refreshHistoryStat();

  subscribeAllBookings(renderBookingsList);
}

init();
