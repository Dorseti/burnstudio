import { initLayout } from "./layout.js";
import {
  fetchServicesPage, subscribeCatalogFirstPage
} from "./firebase/services.js";
import { escapeHtml, formatPrice, renderStars, debounce } from "./utils.js";

initLayout();

const grid = document.getElementById("services-grid");
const countChip = document.getElementById("count-chip");
const loadMoreBtn = document.getElementById("load-more");
const realtimeNote = document.getElementById("realtime-note");
const searchInput = document.getElementById("search-input");
const categorySelect = document.getElementById("filter-category");
const sortSelect = document.getElementById("sort-by");

let cursor = null;
let allLoaded = [];
let unsubscribeRealtime = null;

function isDefaultView() {
  return categorySelect.value === "all" && sortSelect.value === "newest" && !searchInput.value.trim();
}

function renderGrid(items, { append = false } = {}) {
  if (!append) grid.innerHTML = "";

  if (items.length === 0 && !append) {
    grid.innerHTML = `
      <div class="card" style="width:100%;">
        <div class="empty-state">
          <p>Услуг пока нет</p>
          <p style="font-size:13px;">Загляните позже — администратор скоро наполнит каталог</p>
        </div>
      </div>`;
    countChip.textContent = "0";
    return;
  }

  items.forEach(s => {
    const card = document.createElement("div");
    card.className = "card service-card";
    card.style.flex = "1 1 260px";
    card.style.maxWidth = "320px";
    card.innerHTML = `
      <div class="service-photo" style="background-image:linear-gradient(180deg,transparent 35%,rgba(5,8,14,.88)),url('${escapeHtml(s.imageUrl || "")}')">
        <span>${escapeHtml(s.imageEmoji || "🎨")}</span>
      </div>
      <div class="card-title"><span>${escapeHtml(s.name)}</span><span class="badge">${formatPrice(s.basePrice)}</span></div>
      <p>${escapeHtml((s.description || "").slice(0, 110))}${(s.description || "").length > 110 ? "…" : ""}</p>
      <div class="row">
        <span class="pill pill-strong">${escapeHtml(s.category)}</span>
        ${renderStars(s.avgRating || 0)}
        <span class="pill">${s.reviewsCount || 0} отзывов</span>
      </div>
    `;
    card.addEventListener("click", () => {
      window.location.href = `./service.html?id=${s.id}`;
    });
    grid.appendChild(card);
  });

  countChip.textContent = grid.children.length;
}

async function loadFirstPage() {
  if (unsubscribeRealtime) { unsubscribeRealtime(); unsubscribeRealtime = null; }
  cursor = null;

  if (isDefaultView()) {
    // realtime-режим: каталог сам обновляется, когда админ что-то меняет
    realtimeNote.style.display = "block";
    unsubscribeRealtime = subscribeCatalogFirstPage((items) => {
      allLoaded = items;
      renderGrid(items);
      loadMoreBtn.style.display = items.length >= 8 ? "inline-block" : "none";
    });
    return;
  }

  realtimeNote.style.display = "none";
  const { items, nextCursor } = await fetchServicesPage({
    category: categorySelect.value,
    sortBy: sortSelect.value,
    searchWord: searchInput.value.trim()
  });
  allLoaded = items;
  cursor = nextCursor;
  renderGrid(items);
  loadMoreBtn.style.display = nextCursor ? "inline-block" : "none";
}

loadMoreBtn.addEventListener("click", async () => {
  if (unsubscribeRealtime) { unsubscribeRealtime(); unsubscribeRealtime = null; }
  realtimeNote.style.display = "none";

  const { items, nextCursor } = await fetchServicesPage({
    category: categorySelect.value,
    sortBy: sortSelect.value,
    searchWord: searchInput.value.trim(),
    cursor
  });
  cursor = nextCursor;
  allLoaded = allLoaded.concat(items);
  renderGrid(items, { append: true });
  loadMoreBtn.style.display = nextCursor ? "inline-block" : "none";
});

categorySelect.addEventListener("change", loadFirstPage);
sortSelect.addEventListener("change", loadFirstPage);
searchInput.addEventListener("input", debounce(loadFirstPage, 400));

loadFirstPage();
