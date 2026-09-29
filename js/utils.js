// Вспомогательные функции: цена, проверки, уведомления, звёзды рейтинга
export function calculatePrice(size, color) {
  let price = 0;

  if (size === "Small") price = 20000;
  if (size === "Medium") price = 40000;
  if (size === "Large") price = 70000;

  if (color === "Color") price += 10000;

  return price;
}

// показывает пользователю сообщение ошибка или успех
export function showAlert(container, msg, type) {
  const div = document.createElement("div");
  div.className = `alert alert-${type}`;
  div.textContent = msg;

  container.appendChild(div);

  setTimeout(() => div.remove(), 4000);
}

// проверка занято ли время (локальный шорткат, используется только в form.js
// вместе с реальной серверной проверкой через bookings.js)
export function isSlotTaken(bookings, date, time) {
  return bookings.some(b => b.date === date && b.time === time);
}

// санитайз защита ввода от html
export function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function setMinDate(input) {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  input.min = `${yyyy}-${mm}-${dd}`;
}

export function formatPrice(price) {
  return `${Number(price || 0).toLocaleString()} KZT`;
}

export function formatDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleDateString("ru-RU");
}

// Рисует звёзды рейтинга (только для отображения, 0..5, шаг 0.5 визуально не нужен)
export function renderStars(rating = 0) {
  const rounded = Math.round(rating);
  let html = '<span class="stars" aria-label="Рейтинг ' + rating.toFixed(1) + '">';
  for (let i = 1; i <= 5; i++) {
    html += `<span class="star ${i <= rounded ? "star-filled" : ""}">★</span>`;
  }
  html += "</span>";
  return html;
}

// Интерактивный выбор звёзд (форма отзыва). Возвращает текущее значение через колбэк.
export function mountStarPicker(container, initial, onChange) {
  let value = initial || 5;
  function draw() {
    container.innerHTML = "";
    for (let i = 1; i <= 5; i++) {
      const s = document.createElement("span");
      s.className = "star star-pick" + (i <= value ? " star-filled" : "");
      s.textContent = "★";
      s.addEventListener("click", () => {
        value = i;
        draw();
        onChange(value);
      });
      container.appendChild(s);
    }
  }
  draw();
  return { getValue: () => value };
}

export function debounce(fn, delay = 350) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export const STATUS_MAP = {
  pending:   { label: "Ожидает",      color: "rgba(102,230,255,0.7)" },
  confirmed: { label: "Подтверждено", color: "rgba(36,240,199,0.8)" },
  done:      { label: "Завершено",    color: "rgba(207,215,226,0.45)" }
};
