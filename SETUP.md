# Kazakh Studio Booking — настройка и сдача проекта

Проект переведён с `localStorage` на **Firebase Firestore + Authentication**,
чтобы соответствовать требованиям ТЗ. Ниже — пошаговая настройка, схема БД
и то, как проект закрывает каждый пункт критериев.

---

## 1. Создание Firebase-проекта (10–15 минут)

1. Откройте https://console.firebase.google.com и нажмите **Add project**.
   Назовите проект как угодно (например `kazakh-studio-booking`), Google
   Analytics можно отключить — он не нужен.
2. В левом меню: **Build → Authentication → Get started**.
   Вкладка **Sign-in method → Email/Password → Enable → Save**.
3. В левом меню: **Build → Firestore Database → Create database**.
   Выберите **Start in production mode** и ближайший регион (например
   `eur3 (europe-west)`), нажмите **Enable**.
4. Значок шестерёнки рядом с "Project Overview" → **Project settings**.
   Внизу вкладки **General** — раздел **Your apps** → нажмите иконку `</>`
   (Web). Дайте название приложению, **Register app**. Вам покажут объект
   `firebaseConfig` — скопируйте его.
5. Откройте файл `js/firebase/firebase-config.js` в проекте и вставьте
   скопированные значения вместо `"ВАШ_..."`.
6. Вкладка **Firestore Database → Rules**. Полностью замените содержимое
   на файл `firestore.rules` из корня проекта и нажмите **Publish**.
7. Для готовой настройки составных индексов установите Firebase CLI, выполните
   `firebase login`, а затем в корне проекта `firebase use <ваш-project-id>` и
   `firebase deploy --only firestore:rules,firestore:indexes`. Файлы
   `firebase.json` и `firestore.indexes.json` уже включены в проект.
   Альтернатива: создать индексы вручную по списку ниже.

Проект готов к работе — открывайте `html/index.html` через Live Server
(как и раньше, порт уже настроен в `.vscode/settings.json`).

## 2. Как стать администратором

Ролью **admin** никто не наделяется автоматически — это осознанное решение
в целях безопасности (см. `firestore.rules`, никто не может назначить себе
роль сам). Порядок:

1. Зарегистрируйтесь в приложении обычным способом (`login.html` → вкладка
   «Регистрация»).
2. В консоли Firebase: **Firestore Database → Data → users** → найдите
   документ со своим `uid` (email виден в полях) → откройте его →
   поле `role` → измените значение с `"user"` на `"admin"` → Save.
3. Обновите страницу приложения — в шапке появится ссылка **Админ**.

Дальше новых админов можно назначать прямо из панели: вкладка
**Пользователи → Назначить админом**.

## 3. Составные индексы Firestore

Некоторые запросы каталога (фильтр по категории/поиску + сортировка)
требуют составных индексов. Firestore не создаёт их заранее — но **при
первом обращении к такому запросу консоль браузера покажет ошибку со
ссылкой** вида `https://console.firebase.google.com/.../firestore/indexes?create_composite=...`.
Просто откройте эту ссылку и нажмите **Create index** — через 1–2 минуты
индекс будет готов и запрос заработает. Это нормальная часть работы с
Firestore, отражена и в самом ТЗ (п. 5.2 «настройка индексов»).

Если хотите создать их заранее, понадобятся индексы для коллекции
`services`:
- `category` (Asc) + `createdAt` (Desc)
- `category` (Asc) + `basePrice` (Asc/Desc)
- `searchTokens` (Array) + `createdAt` (Desc)

---

## 4. Схема базы данных

### `users/{uid}`
| поле | тип | описание |
|---|---|---|
| name | string | имя пользователя |
| phone | string | телефон |
| email | string | email (дублируется из Auth для удобства чтения) |
| role | string | `"user"` \| `"admin"` |
| createdAt | number | timestamp регистрации |

### `services/{id}` — основная сущность (каталог)
| поле | тип | описание |
|---|---|---|
| name | string | название стиля/услуги |
| description | string | описание |
| category | string | стиль (Минимализм, Блэкворк, ...) — используется и для фильтра |
| basePrice | number | базовая цена, KZT |
| imageEmoji | string | эмодзи-маркер на карточке |
| imageUrl | string | ссылка на фотографию услуги (необязательная) |
| searchTokens | array<string> | слова из name+description в нижнем регистре — для поиска |
| avgRating | number | средний рейтинг (пересчитывается транзакцией) |
| reviewsCount | number | количество отзывов |
| createdAt | number | timestamp |

### `bookings/{id}` — активные действия
| поле | тип | описание |
|---|---|---|
| userId | string | uid владельца записи |
| name, contact, age | — | контактные данные клиента |
| serviceId, serviceName | — | денормализовано из services (без лишнего чтения) |
| style, size, color, place, description | — | параметры тату |
| date, time | string | дата/время визита |
| price | number | посчитанная цена |
| status | string | `"pending"` → `"confirmed"` → (перенос в history) |
| createdAt | number | timestamp |

### `history/{id}` — завершённые действия (архив)
Те же поля, что в `bookings`, плюс `status: "done"` и `completedAt`.
Документ **перемещается** из `bookings` в `history` одной batch-операцией
(см. `completeBooking()` в `js/firebase/bookings.js`) — это и есть
разделение на «активные действия» и «историю», плюс демонстрирует
денормализацию данных для производительности (п. 5.2 ТЗ).

### `reviews/{serviceId_userId}`
| поле | тип | описание |
|---|---|---|
| serviceId, userId, userName | — | привязка |
| rating | number | 1–5 |
| text | string | текст отзыва |
| createdAt | number | timestamp |

ID документа составной (`serviceId_userId`), поэтому у пользователя
физически не может быть двух отзывов на одну услугу.

---

## 5. Как проект закрывает критерии ТЗ

| Критерий | Где реализовано |
|---|---|
| Аутентификация | `login.html` + `js/firebase/auth.js` (регистрация, вход, выход, сброс пароля, роли) |
| Каталог с пагинацией | `index.html` + `fetchServicesPage()` (limit/startAfter, кнопка «Показать ещё») |
| Поиск через Firestore | `searchTokens` + `array-contains` запрос в `fetchServicesPage()` |
| Фильтр и сортировка | селекты категории/сортировки на `index.html` |
| Realtime | `subscribeCatalogFirstPage`, `subscribeUserBookings`, `subscribeAllBookings`, `subscribeServiceReviews` (все на `onSnapshot`) |
| Детальная страница | `service.html`: инфо, отзывы, похожие услуги с пагинацией, кнопка «Записаться» |
| Личный кабинет | `cabinet.html`: профиль, история, редактирование и удаление своих отзывов |
| Функциональная страница | `my-bookings.html`: активные записи, отмена/изменение, realtime-статус |
| Админ-панель | `admin.html`: CRUD услуг, записи, пользователи/роли, модерация отзывов, статистика |
| Схема БД | этот файл, раздел 4 |
| Security Rules | `firestore.rules` |
| Оптимизация запросов | денормализация (`serviceName`, `userName` хранятся прямо в bookings/history/reviews — не нужны доп. чтения), limit()+startAfter пагинация, точечные `where`-запросы вместо полного сканирования |
| Качество кода | модульная структура: `js/firebase/*.js` — слой данных, `js/*.js` — только UI-логика страниц |

## 6. Быстрый первый запуск каталога

После назначения роли `admin` откройте `admin.html` и нажмите **«Добавить
стартовые услуги с фото»**. В каталог добавятся шесть подготовленных услуг
студии: минимализм, блэкворк, аниме, реализм, казахский орнамент и
индивидуальный эскиз. Кнопка намеренно работает только с пустым каталогом —
существующие данные не будут затронуты и дубликаты не появятся.

**Что изменилось по сравнению со старой версией:** страница `stats.html`
объединена с админ-панелью (вкладка «Статистика» в `admin.html`) — по ТЗ
статистика относится именно к разделу администратора (п. 3.5), а не
является отдельной публичной страницей.
