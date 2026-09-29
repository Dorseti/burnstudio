// Форма записи: требует авторизации, привязана к выбранной услуге,
// проверяет занятость слота через Firestore, создаёт/редактирует booking.
import { initLayout } from "./layout.js";
import { requireAuth, getUserProfile } from "./firebase/auth.js";
import { getService } from "./firebase/services.js";
import {
  createBooking, updateBooking, getBooking, fetchTakenSlots
} from "./firebase/bookings.js";
import { calculatePrice, showAlert, setMinDate } from "./utils.js";

initLayout();

const params = new URLSearchParams(window.location.search);
const serviceIdParam = params.get("service");
const editId = params.get("edit");

const form = document.getElementById("booking-form");
const priceEl = document.getElementById("price");
const alertContainer = document.getElementById("alert-container");
const dateInput = document.getElementById("date");
const noteEl = document.getElementById("selected-service-note");

let currentUser = null;
let currentProfile = null;
let selectedService = null;
let editingBooking = null;
let currentRenderId = 0; // Для защиты от задвоения слотов

function getTodayFormatted() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function bootstrap() {
  currentUser = await requireAuth("./login.html");
  currentProfile = await getUserProfile(currentUser.uid);

  document.getElementById("name").value = currentProfile?.name || "";
  document.getElementById("contact").value = currentProfile?.phone || "";

  if (serviceIdParam) {
    selectedService = await getService(serviceIdParam);
    if (selectedService) {
      document.getElementById("style").value = selectedService.category;
      noteEl.style.display = "block";
      noteEl.textContent = `Выбранная услуга: ${selectedService.name}`;
    }
  }

  setMinDate(dateInput);

  if (editId) {
    editingBooking = await getBooking(editId);
    if (editingBooking && editingBooking.userId === currentUser.uid) {
      document.getElementById("name").value = editingBooking.name;
      document.getElementById("contact").value = editingBooking.contact;
      document.getElementById("age").value = editingBooking.age;
      document.getElementById("style").value = editingBooking.style;
      document.getElementById("place").value = editingBooking.place;
      document.getElementById("date").value = editingBooking.date;
      document.getElementById("description").value = editingBooking.description || "";
      document.getElementById("consent").checked = true;
      if (editingBooking.size) {
        const sizeRadio = document.querySelector(`input[name="size"][value="${editingBooking.size}"]`);
        if (sizeRadio) sizeRadio.checked = true;
      }
      if (editingBooking.color) {
        const colorRadio = document.querySelector(`input[name="color"][value="${editingBooking.color}"]`);
        if (colorRadio) colorRadio.checked = true;
      }
      await renderSlots(editingBooking.time);
    }
  } else {
    dateInput.value = getTodayFormatted();
    await renderSlots();
  }

  updatePrice();
}

function updatePrice() {
  const size = document.querySelector('input[name="size"]:checked')?.value || "Small";
  const color = document.querySelector('input[name="color"]:checked')?.value || "Black&White";
  const price = calculatePrice(size, color);
  animatePrice(price);
  return price;
}

function animatePrice(targetPrice) {
  const duration = 500;
  const start = performance.now();
  const from = parseInt(priceEl.dataset.current || "0", 10);
  priceEl.dataset.current = targetPrice;
  priceEl.classList.remove("bump");
  void priceEl.offsetWidth;
  priceEl.classList.add("bump");
  setTimeout(() => priceEl.classList.remove("bump"), 400);

  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(from + (targetPrice - from) * ease);
    priceEl.textContent = `Примерная стоимость: ${current.toLocaleString()} KZT`;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

const SLOTS = ["10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00"];

async function renderSlots(preselect = null) {
  const grid = document.getElementById("slots-grid");
  const selectedDate = dateInput.value;
  const timeInput = document.getElementById("time");
  grid.innerHTML = "";
  timeInput.value = "";

  if (!selectedDate) {
    grid.innerHTML = `<p style="font-size:13px; color:var(--muted); grid-column: 1 / -1;">Выберите дату выше, чтобы увидеть доступные слоты времени</p>`;
    return;
  }

  const renderId = ++currentRenderId;
  let taken = [];

  try {
    taken = await fetchTakenSlots(selectedDate);
  } catch (err) {
    console.error("Ошибка при получении слотов:", err);
    grid.innerHTML = `<p style="font-size:13px; color:red; grid-column: 1 / -1;">Не удалось загрузить время. Проверьте подключение.</p>`;
    return;
  }

  if (renderId !== currentRenderId) return;
  grid.innerHTML = "";

  const now = new Date();
  const [year, month, day] = selectedDate.split("-").map(Number);

  SLOTS.forEach(slot => {
    const isTaken = taken.includes(slot) && !(editingBooking && editingBooking.date === selectedDate && editingBooking.time === slot);

    // Парсим дату вручную, чтобы мобильные браузеры (Safari) не выдавали Invalid Date
    const [hours, minutes] = slot.split(":").map(Number);
    const slotDateTime = new Date(year, month - 1, day, hours, minutes);
    const isPast = slotDateTime < now;
    const isDisabled = isTaken || isPast;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = slot;
    btn.className = "slot-btn" + (isDisabled ? " slot-taken" : " slot-free");
    btn.disabled = isDisabled;

    if (preselect === slot && !isDisabled) {
      btn.classList.add("slot-selected");
      timeInput.value = slot;
    }

    btn.addEventListener("click", () => {
      document.querySelectorAll(".slot-btn").forEach(b => b.classList.remove("slot-selected"));
      btn.classList.add("slot-selected");
      timeInput.value = slot;
    });

    grid.appendChild(btn);
  });
}

function validateForm(data) {
  if (!data.name || !data.contact || !data.age || !data.date || !data.time) {
    showAlert(alertContainer, "Заполни все обязательные поля", "error");
    return false;
  }
  if (data.age < 18) {
    showAlert(alertContainer, "Запись доступна только с 18 лет", "error");
    return false;
  }
  
  const [y, m, d] = data.date.split("-").map(Number);
  const [h, min] = data.time.split(":").map(Number);
  const selected = new Date(y, m - 1, d, h, min);
  const now = new Date();

  if (selected < now) {
    showAlert(alertContainer, "Нельзя выбрать прошедшую дату или время", "error");
    return false;
  }
  if (h < 10 || h >= 20) {
    showAlert(alertContainer, "Рабочие часы студии: 10:00–20:00", "error");
    return false;
  }
  if (!document.getElementById("consent").checked) {
    showAlert(alertContainer, "Нужно согласие на обработку данных", "error");
    return false;
  }
  return true;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const size = document.querySelector('input[name="size"]:checked')?.value || "Small";
  const color = document.querySelector('input[name="color"]:checked')?.value || "Black&White";
  const price = calculatePrice(size, color);

  const data = {
    userId: currentUser.uid,
    name: document.getElementById("name").value.trim(),
    contact: document.getElementById("contact").value.trim(),
    age: parseInt(document.getElementById("age").value, 10),
    serviceId: selectedService?.id || editingBooking?.serviceId || null,
    serviceName: selectedService?.name || editingBooking?.serviceName || null,
    style: document.getElementById("style").value,
    size,
    color,
    place: document.getElementById("place").value,
    date: document.getElementById("date").value,
    time: document.getElementById("time").value,
    description: document.getElementById("description").value.trim(),
    price
  };

  if (!validateForm(data)) return;

  const taken = await fetchTakenSlots(data.date);
  const conflictsWithOther = taken.includes(data.time) && !(editingBooking && editingBooking.date === data.date && editingBooking.time === data.time);
  if (conflictsWithOther) {
    showAlert(alertContainer, "Это время только что заняли — выберите другое", "error");
    renderSlots();
    return;
  }

  try {
    if (editingBooking) {
      await updateBooking(editingBooking.id, data);
      showAlert(alertContainer, "Запись успешно изменена!", "success");
    } else {
      await createBooking(data);
      showAlert(alertContainer, "Запись успешно создана!", "success");
    }
    setTimeout(() => { window.location.href = "./my-bookings.html"; }, 800);
  } catch (err) {
    showAlert(alertContainer, "Ошибка сохранения: " + err.message, "error");
  }
});

document.querySelectorAll('input[name="size"], input[name="color"]').forEach(el => {
  el.addEventListener("change", updatePrice);
});

const contactInput = document.getElementById('contact');
if (contactInput) {
  contactInput.addEventListener('input', () => {
    let numbers = contactInput.value.replace(/\D/g, '').substring(0, 11);
    let formatted = '';
    if (numbers.length > 0) formatted = numbers.substring(0, 1);
    if (numbers.length > 1) formatted += ' ' + numbers.substring(1, 4);
    if (numbers.length > 4) formatted += ' ' + numbers.substring(4, 7);
    if (numbers.length > 7) formatted += ' ' + numbers.substring(7, 11);
    contactInput.value = formatted;
  });
}

// Открытие календаря по нажатию в любую точку инпута на мобиле
if (dateInput) {
  dateInput.addEventListener("click", () => {
    if (typeof dateInput.showPicker === "function") {
      try { dateInput.showPicker(); } catch (e) {}
    }
  });
  dateInput.addEventListener("input", () => renderSlots());
  dateInput.addEventListener("change", () => renderSlots());
}

bootstrap();
