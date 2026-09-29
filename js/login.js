// Логика страницы входа/регистрации + переключение вкладок + сброс пароля.
import { registerUser, loginUser, resetPassword, onAuthChange } from "./firebase/auth.js";
import { showAlert } from "./utils.js";

const alertContainer = document.getElementById("alert-container");

// Если уже авторизован — сразу отправляем в каталог
onAuthChange((user) => {
  if (user) window.location.href = "./index.html";
});

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  try {
    await loginUser(email, password);
    window.location.href = "./index.html";
  } catch (err) {
    showAlert(alertContainer, "Не удалось войти: проверьте email и пароль", "error");
  }
});

document.getElementById("register-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("reg-name").value.trim();
  const phone = document.getElementById("reg-phone").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;

  if (!name || !email || password.length < 6) {
    showAlert(alertContainer, "Заполните имя, email и пароль (минимум 6 символов)", "error");
    return;
  }

  try {
    await registerUser({ email, password, name, phone });
    window.location.href = "./index.html";
  } catch (err) {
    showAlert(alertContainer, "Не удалось зарегистрироваться: " + err.message, "error");
  }
});

document.getElementById("reset-password-link").addEventListener("click", async () => {
  const email = document.getElementById("login-email").value.trim();
  if (!email) {
    showAlert(alertContainer, "Введите email, на который выслать ссылку восстановления", "error");
    return;
  }
  try {
    await resetPassword(email);
    showAlert(alertContainer, "Письмо для сброса пароля отправлено на почту", "success");
  } catch (err) {
    showAlert(alertContainer, "Не удалось отправить письмо: " + err.message, "error");
  }
});
