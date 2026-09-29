import { onAuthChange, logoutUser, getUserProfile } from "./firebase/auth.js";
export function initLayout() {
  const slot = document.getElementById("auth-slot");
  if (!slot) return;

  onAuthChange(async (user) => {
    if (!user) {
      slot.innerHTML = `
        <a class="btn-ghost" href="./login.html" style="width:auto;margin-top:0;text-decoration:none;">Войти</a>
      `;
      return;
    }


    const profile = await getUserProfile(user.uid);
    const isAdmin = profile?.role === "admin";

    slot.innerHTML = `
      ${isAdmin ? '<a class="btn-ghost" href="./admin.html" style="width:auto;margin-top:0;text-decoration:none;">Админ</a>' : ""}
      <a class="btn-ghost" href="./my-bookings.html" style="width:auto;margin-top:0;text-decoration:none;">Мои записи</a>
      <a class="btn-ghost" href="./cabinet.html" style="width:auto;margin-top:0;text-decoration:none;">Кабинет</a>
      <button id="logout-btn" class="btn-ghost" style="width:auto;margin-top:0;">Выйти</button>
    `;

    document.getElementById("logout-btn")?.addEventListener("click", async () => {
      await logoutUser();
      window.location.href = "./index.html";
    });
  });
}
