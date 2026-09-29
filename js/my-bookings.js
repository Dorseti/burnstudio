// "Функциональная страница": активные записи пользователя, realtime-статусы,
// отмена и переход к редактированию.
import { initLayout } from "./layout.js";
import { requireAuth } from "./firebase/auth.js";
import { subscribeUserBookings, cancelBooking } from "./firebase/bookings.js";
import { escapeHtml, formatPrice, STATUS_MAP, showAlert } from "./utils.js";

initLayout();
const alertContainer = document.getElementById("alert-container");
const list = document.getElementById("my-bookings-list");
const countChip = document.getElementById("count-chip");

async function init() {
  const user = await requireAuth("./login.html");

  subscribeUserBookings(user.uid, (bookings) => {
    countChip.textContent = bookings.length;
    list.innerHTML = "";

    if (bookings.length === 0) {
      list.innerHTML = `
        <div class="card">
          <div class="empty-state">
            <p>Активных записей нет</p>
            <a href="./index.html" class="btn-add-first">Выбрать услугу</a>
          </div>
        </div>`;
      return;
    }

    bookings.forEach(b => {
      const s = STATUS_MAP[b.status] || STATUS_MAP.pending;
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="card-title">
          <span>${escapeHtml(b.serviceName || b.style)}</span>
          <span class="badge">${formatPrice(b.price)}</span>
        </div>
        <p>${b.date} · ${b.time}</p>
        <div class="row">
          <span class="pill pill-strong">${escapeHtml(b.style)}</span>
          <span class="pill">${escapeHtml(b.size)}</span>
          <span class="pill">${escapeHtml(b.color)}</span>
        </div>
        <div class="card-footer">
          <span class="status-btn" style="border-color:${s.color};color:${s.color};cursor:default;">${s.label}</span>
          <div style="display:flex; gap:8px;">
            ${b.status === "pending" ? `<button class="edit-btn" data-id="${b.id}">Изменить</button>` : ""}
            ${b.status !== "done" ? `<button class="delete-btn" data-id="${b.id}">Отменить</button>` : ""}
          </div>
        </div>
      `;

      card.querySelector(".edit-btn")?.addEventListener("click", () => {
        window.location.href = `./form.html?edit=${b.id}`;
      });

      card.querySelector(".delete-btn")?.addEventListener("click", async () => {
        if (!confirm("Отменить запись?")) return;
        await cancelBooking(b.id);
        showAlert(alertContainer, "Запись отменена", "success");
      });

      list.appendChild(card);
    });
  });
}

init();
