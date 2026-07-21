const STORAGE_KEY = "my-day-data-v1";
const DAYS_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const DAYS_ICS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

const state = {
  route: "today",
  data: loadData(),
  notified: new Set(),
};

const app = document.querySelector("#app");
const pageTitle = document.querySelector("#page-title");
const todayLabel = document.querySelector("#today-label");
const choiceDialog = document.querySelector("#choice-dialog");
const medicineDialog = document.querySelector("#medicine-dialog");
const meetingDialog = document.querySelector("#meeting-dialog");
const confirmDialog = document.querySelector("#confirm-dialog");
const medicineForm = document.querySelector("#medicine-form");
const meetingForm = document.querySelector("#meeting-form");
const timeList = document.querySelector("#medicine-times");
const quickAddButton = document.querySelector("#quick-add");

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      medicines: Array.isArray(saved?.medicines) ? saved.medicines : [],
      meetings: Array.isArray(saved?.meetings) ? saved.meetings : [],
      history: Array.isArray(saved?.history) ? saved.history : [],
    };
  } catch {
    return { medicines: [], meetings: [], history: [] };
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function uid() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function localDate(dateString) {
  if (!dateString) return null;
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatLongDate(date = new Date()) {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function esc(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function medicineIsActive(medicine, date) {
  const key = dateKey(date);
  return (
    medicine.days.map(Number).includes(date.getDay()) &&
    medicine.startDate <= key &&
    (!medicine.endDate || medicine.endDate >= key)
  );
}

function occurrenceKey(id, day, time) {
  return `${id}:${day}:${time}`;
}

function occurrenceStatus(id, day, time) {
  return state.data.history.find(
    (entry) => entry.occurrenceKey === occurrenceKey(id, day, time),
  );
}

function getItemsForDate(targetDate) {
  const day = dateKey(targetDate);
  const medicines = state.data.medicines
    .filter((medicine) => medicineIsActive(medicine, targetDate))
    .flatMap((medicine) =>
      medicine.times.map((time) => ({
        type: "medicine",
        id: medicine.id,
        occurrenceKey: occurrenceKey(medicine.id, day, time),
        time,
        title: medicine.name,
        meta: medicine.dose || "Лекарство",
        status: occurrenceStatus(medicine.id, day, time)?.status,
      })),
    );

  const meetings = state.data.meetings
    .filter((meeting) => meeting.dateTime.slice(0, 10) === day)
    .map((meeting) => ({
      type: "meeting",
      id: meeting.id,
      occurrenceKey: occurrenceKey(meeting.id, day, meeting.dateTime.slice(11, 16)),
      time: meeting.dateTime.slice(11, 16),
      title: meeting.title,
      meta: meeting.place || "Встреча",
      status: occurrenceStatus(meeting.id, day, meeting.dateTime.slice(11, 16))?.status,
    }));

  return [...medicines, ...meetings].sort((a, b) => a.time.localeCompare(b.time));
}

function getTodayItems() {
  return getItemsForDate(new Date());
}

function minutesFromNow(item) {
  const [hour, minute] = item.time.split(":").map(Number);
  const now = new Date();
  return hour * 60 + minute - (now.getHours() * 60 + now.getMinutes());
}

function durationLabel(minutes) {
  const absolute = Math.abs(minutes);
  if (absolute < 1) return "сейчас";
  if (absolute < 60) return `${absolute} мин`;
  const hours = Math.floor(absolute / 60);
  const rest = absolute % 60;
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
}

function timingLabel(item) {
  if (item.status) return item.type === "medicine" ? "Принято" : "Выполнено";
  const difference = minutesFromNow(item);
  if (difference > 0) return `Через ${durationLabel(difference)}`;
  if (difference === 0) return "Сейчас";
  return `Задержка ${durationLabel(difference)}`;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 6) return "Доброй ночи";
  if (hour < 12) return "Доброе утро";
  if (hour < 18) return "Добрый день";
  return "Добрый вечер";
}

function render() {
  const titles = {
    today: "Мой день",
    medicines: "Лекарства",
    meetings: "Встречи",
    more: "Ещё",
  };
  pageTitle.textContent = state.route === "today" ? greeting() : titles[state.route];
  todayLabel.textContent = state.route === "today" ? formatLongDate() : "Мой день";
  const quickAddLabels = {
    today: "Добавить лекарство или встречу",
    medicines: "Добавить лекарство",
    meetings: "Добавить встречу",
  };
  quickAddButton.classList.toggle("hidden", state.route === "more");
  quickAddButton.setAttribute("aria-label", quickAddLabels[state.route] || "Добавить");
  quickAddButton.title = quickAddLabels[state.route] || "Добавить";
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.route === state.route);
  });

  if (state.route === "today") renderToday();
  if (state.route === "medicines") renderMedicines();
  if (state.route === "meetings") renderMeetings();
  if (state.route === "more") renderMore();
}

function renderToday() {
  const items = getTodayItems();
  const medicines = items.filter((item) => item.type === "medicine");
  const meetings = items.filter((item) => item.type === "meeting");
  const taken = medicines.filter((item) => item.status === "taken").length;
  const progress = medicines.length ? Math.round((taken / medicines.length) * 100) : 0;

  const pending = items.filter((item) => !item.status);
  const overdue = pending.filter((item) => minutesFromNow(item) < 0);
  const upcoming = pending.filter((item) => minutesFromNow(item) >= 0);
  const focusItem = overdue[overdue.length - 1] || upcoming[0];

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowItems = getItemsForDate(tomorrow);

  const list = items.length
    ? `<div class="timeline">${items.map(todayCard).join("")}</div>`
    : emptyState(
        "✓",
        "На сегодня всё свободно",
        "Добавьте первое лекарство или встречу — они появятся здесь.",
        "Добавить",
      );

  app.innerHTML = `
    ${focusCard(focusItem)}
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-top"><span class="stat-icon medicine-bg">✚</span><span>${progress}%</span></div>
        <strong>${taken} из ${medicines.length}</strong>
        <small>лекарств принято</small>
        <div class="progress-bar"><span style="width:${progress}%"></span></div>
      </div>
      <div class="stat-card">
        <div class="stat-top"><span class="stat-icon meeting-bg">□</span><span>Сегодня</span></div>
        <strong>${meetings.length}</strong>
        <small>${meetingWord(meetings.length)}</small>
        <div class="meeting-dots">${meetings.length ? meetings.slice(0, 5).map((meeting) => `<i class="${meeting.status ? "done" : ""}"></i>`).join("") : "<span>Свободный день</span>"}</div>
      </div>
    </div>
    <div class="quick-actions">
      <button data-empty-add="medicine"><span>✚</span>Лекарство</button>
      <button data-empty-add="meeting"><span>□</span>Встреча</button>
    </div>
    <div class="section-heading"><h2>Расписание</h2><span>${overdue.length ? `${overdue.length} требует внимания` : items.length ? `${items.length} на сегодня` : "Нет дел"}</span></div>
    ${list}
    ${tomorrowPreview(tomorrowItems)}
  `;
}

function meetingWord(count) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return "встреч на сегодня";
  if (last === 1) return "встреча на сегодня";
  if (last >= 2 && last <= 4) return "встречи на сегодня";
  return "встреч на сегодня";
}

function focusCard(item) {
  if (!item) {
    return `<section class="focus-card all-done">
      <div class="focus-check">✓</div>
      <div><p>Всё под контролем</p><h2>На сейчас дел нет</h2><span>Можно спокойно заниматься своими делами</span></div>
    </section>`;
  }
  const difference = minutesFromNow(item);
  const overdue = difference < 0;
  return `<section class="focus-card ${overdue ? "urgent" : ""}">
    <div class="focus-label"><span class="status-dot"></span>${overdue ? "Требует внимания" : "Ближайшее дело"}</div>
    <div class="focus-main">
      <div class="focus-time"><strong>${esc(item.time)}</strong><span>${esc(timingLabel(item))}</span></div>
      <div class="focus-copy">
        <span class="type-pill ${item.type}">${item.type === "medicine" ? "Лекарство" : "Встреча"}</span>
        <h2>${esc(item.title)}</h2>
        <p>${esc(item.meta)}</p>
      </div>
    </div>
    <div class="focus-actions">
      <button class="focus-complete" data-complete="${esc(item.occurrenceKey)}" data-type="${item.type}">${item.type === "medicine" ? "✓ Я принял" : "✓ Выполнено"}</button>
      ${item.type === "medicine" ? `<button class="focus-later" data-snooze="${esc(item.id)}">Через 10 мин</button>` : ""}
    </div>
  </section>`;
}

function tomorrowPreview(items) {
  if (!items.length) return "";
  const preview = items.slice(0, 3);
  return `<section class="tomorrow-section">
    <div class="section-heading"><h2>Завтра</h2><span>${items.length} ${items.length === 1 ? "дело" : "дел"}</span></div>
    <div class="tomorrow-card">
      ${preview.map((item) => `<div class="tomorrow-row">
        <strong>${esc(item.time)}</strong>
        <span class="tomorrow-type ${item.type}">${item.type === "medicine" ? "✚" : "□"}</span>
        <span><b>${esc(item.title)}</b><small>${esc(item.meta)}</small></span>
      </div>`).join("")}
      ${items.length > preview.length ? `<p class="tomorrow-more">И ещё ${items.length - preview.length}</p>` : ""}
    </div>
  </section>`;
}

function todayCard(item) {
  const isDone = item.status === "taken" || item.status === "done";
  const isOverdue = !isDone && minutesFromNow(item) < 0;
  const label = item.type === "medicine" ? "Лекарство" : "Встреча";
  const pill = item.type === "medicine" ? "medicine" : "meeting";
  const doneLabel = item.type === "medicine" ? "Принято" : "Выполнено";
  return `<article class="timeline-card ${isDone ? "done" : ""} ${isOverdue ? "overdue" : ""}">
    <div class="time-column"><div class="time-badge">${esc(item.time)}</div><span>${esc(timingLabel(item))}</span></div>
    <div class="timeline-content">
      <span class="type-pill ${pill}">${label}</span>
      <h3>${esc(item.title)}</h3>
      <p class="meta">${esc(item.meta)}</p>
      <div class="card-actions">
        <button class="action-button" data-complete="${esc(item.occurrenceKey)}" data-type="${item.type}" ${isDone ? "disabled" : ""}>
          ${isDone ? `✓ ${doneLabel}` : item.type === "medicine" ? "✓ Принял" : "✓ Готово"}
        </button>
        ${item.type === "medicine" && !isDone ? `<button class="action-button secondary" data-snooze="${esc(item.id)}">Через 10 минут</button>` : ""}
      </div>
    </div>
  </article>`;
}

function renderMedicines() {
  const medicines = [...state.data.medicines].sort((a, b) => a.name.localeCompare(b.name, "ru"));
  if (!medicines.length) {
    app.innerHTML = emptyState("✚", "Лекарств пока нет", "Добавьте название, дозировку и удобное время приёма.", "Добавить лекарство", "medicine");
    return;
  }

  app.innerHTML = `<div class="card-list">${medicines
    .map((medicine) => {
      const days = medicine.days.length === 7
        ? "Каждый день"
        : medicine.days.map((day) => DAYS_SHORT[Number(day)]).join(", ");
      return `<button class="item-card" data-edit-medicine="${esc(medicine.id)}">
        <span class="item-icon medicine-bg">✚</span>
        <span><h3>${esc(medicine.name)}</h3><p class="meta">${esc(medicine.dose || "Без дозировки")} · ${esc(medicine.times.join(", "))}<br>${esc(days)}</p></span>
        <span class="chevron">›</span>
      </button>`;
    })
    .join("")}</div>`;
}

function renderMeetings() {
  const meetings = [...state.data.meetings].sort((a, b) => a.dateTime.localeCompare(b.dateTime));
  if (!meetings.length) {
    app.innerHTML = emptyState("□", "Встреч пока нет", "Добавьте встречу, место и время напоминания.", "Добавить встречу", "meeting");
    return;
  }

  app.innerHTML = `<div class="card-list">${meetings
    .map((meeting) => `<button class="item-card" data-edit-meeting="${esc(meeting.id)}">
      <span class="item-icon meeting-bg">□</span>
      <span><h3>${esc(meeting.title)}</h3><p class="meta">${esc(formatDateTime(meeting.dateTime))}${meeting.place ? `<br>${esc(meeting.place)}` : ""}</p></span>
      <span class="chevron">›</span>
    </button>`)
    .join("")}</div>`;
}

function renderMore() {
  const history = [...state.data.history]
    .filter((entry) => entry.status === "taken" || entry.status === "done")
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
    .slice(0, 20);
  const permission = "Notification" in window ? Notification.permission : "unsupported";
  const notificationLabel = permission === "granted"
    ? "Уведомления разрешены"
    : permission === "denied"
      ? "Уведомления выключены в настройках iPhone"
      : "Разрешить уведомления";
  const installed = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;

  app.innerHTML = `
    <section class="settings-card">
      <h2>${installed ? "✓ Приложение установлено" : "Установить на iPhone"}</h2>
      <p>${installed
        ? "«Мой день» запускается с домашнего экрана как отдельное приложение."
        : "Откройте эту страницу в Safari, нажмите «Поделиться» и выберите «На экран Домой»."}</p>
    </section>
    <section class="settings-card">
      <h2>Напоминания на iPhone</h2>
      <p>Добавьте расписание в системный календарь: тогда сигналы сработают, даже когда «Мой день» закрыт.</p>
      <div class="settings-actions">
        <button data-export-calendar>Добавить всё в календарь (.ics)</button>
        <button data-notifications>${esc(notificationLabel)}</button>
      </div>
    </section>
    <section class="settings-card">
      <h2>Резервная копия</h2>
      <p>Сохраните файл с расписанием, чтобы восстановить данные после смены телефона или очистки Safari.</p>
      <div class="settings-actions">
        <button data-backup>Скачать копию</button>
        <label class="file-button">Восстановить из файла<input type="file" accept="application/json,.json" data-restore /></label>
      </div>
    </section>
    <div class="section-heading"><h2>История</h2><span>${history.length}</span></div>
    ${history.length ? `<div class="history-list">${history.map(historyRow).join("")}</div>` : emptyState("✓", "История пока пуста", "Отмеченные лекарства и встречи появятся здесь.")}
  `;
}

function historyRow(entry) {
  const status = entry.status === "taken" ? "Принято" : "Выполнено";
  const completed = new Date(entry.completedAt);
  return `<div class="history-row">
    <span class="history-status">✓</span>
    <span><strong>${esc(entry.title)}</strong><small>${status} в ${pad(completed.getHours())}:${pad(completed.getMinutes())}</small></span>
    <span class="history-date">${esc(new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(localDate(entry.day)))}</span>
  </div>`;
}

function emptyState(icon, title, text, buttonText = "", form = "") {
  return `<div class="empty-card">
    <div class="empty-illustration">${icon}</div>
    <h2>${esc(title)}</h2>
    <p>${esc(text)}</p>
    ${buttonText ? `<button class="primary-button" data-empty-add="${form}">${esc(buttonText)}</button>` : ""}
  </div>`;
}

function addTimeInput(value = "09:00") {
  const row = document.createElement("div");
  row.className = "time-row";
  row.innerHTML = `<input type="time" name="times" value="${esc(value)}" required aria-label="Время приёма" />
    <button type="button" class="remove-time" aria-label="Удалить время">×</button>`;
  timeList.append(row);
  updateRemoveTimeButtons();
}

function updateRemoveTimeButtons() {
  const buttons = timeList.querySelectorAll(".remove-time");
  buttons.forEach((button) => button.classList.toggle("hidden", buttons.length === 1));
}

function openMedicineForm(id = "") {
  medicineForm.reset();
  medicineForm.elements.id.value = id;
  medicineForm.elements.startDate.value = dateKey();
  timeList.innerHTML = "";
  const medicine = state.data.medicines.find((item) => item.id === id);

  if (medicine) {
    document.querySelector("#medicine-form-title").textContent = "Лекарство";
    medicineForm.elements.name.value = medicine.name;
    medicineForm.elements.dose.value = medicine.dose;
    medicineForm.elements.startDate.value = medicine.startDate;
    medicineForm.elements.endDate.value = medicine.endDate || "";
    medicineForm.querySelectorAll('input[name="days"]').forEach((checkbox) => {
      checkbox.checked = medicine.days.map(Number).includes(Number(checkbox.value));
    });
    medicine.times.forEach(addTimeInput);
    document.querySelector("#delete-medicine").classList.remove("hidden");
  } else {
    document.querySelector("#medicine-form-title").textContent = "Новое лекарство";
    medicineForm.querySelectorAll('input[name="days"]').forEach((checkbox) => (checkbox.checked = true));
    addTimeInput("09:00");
    document.querySelector("#delete-medicine").classList.add("hidden");
  }
  medicineDialog.showModal();
}

function defaultMeetingDateTime() {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  return `${dateKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function openMeetingForm(id = "") {
  meetingForm.reset();
  meetingForm.elements.id.value = id;
  const meeting = state.data.meetings.find((item) => item.id === id);
  if (meeting) {
    document.querySelector("#meeting-form-title").textContent = "Встреча";
    meetingForm.elements.title.value = meeting.title;
    meetingForm.elements.dateTime.value = meeting.dateTime;
    meetingForm.elements.place.value = meeting.place;
    meetingForm.elements.notes.value = meeting.notes;
    meetingForm.elements.reminderMinutes.value = meeting.reminderMinutes;
    document.querySelector("#delete-meeting").classList.remove("hidden");
  } else {
    document.querySelector("#meeting-form-title").textContent = "Новая встреча";
    meetingForm.elements.dateTime.value = defaultMeetingDateTime();
    document.querySelector("#delete-meeting").classList.add("hidden");
  }
  meetingDialog.showModal();
}

async function confirmDelete(title, text) {
  document.querySelector("#confirm-title").textContent = title;
  document.querySelector("#confirm-text").textContent = text;
  confirmDialog.showModal();
  return new Promise((resolve) => {
    confirmDialog.querySelectorAll("[data-confirm]").forEach((button) => {
      button.onclick = () => {
        confirmDialog.close();
        resolve(button.dataset.confirm === "yes");
      };
    });
  });
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function completeOccurrence(key, type) {
  const keyParts = key.split(":");
  const id = keyParts[0];
  const day = keyParts[1];
  const time = keyParts.slice(2).join(":");
  const source = type === "medicine"
    ? state.data.medicines.find((item) => item.id === id)
    : state.data.meetings.find((item) => item.id === id);
  state.data.history = state.data.history.filter((entry) => entry.occurrenceKey !== key);
  state.data.history.push({
    id: uid(),
    occurrenceKey: key,
    sourceId: id,
    type,
    title: type === "medicine" ? source?.name : source?.title,
    day,
    time,
    status: type === "medicine" ? "taken" : "done",
    completedAt: new Date().toISOString(),
  });
  saveData();
  render();
  showToast(type === "medicine" ? "Отмечено: лекарство принято" : "Встреча выполнена");
}

async function showNotification(title, body, tag = uid()) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const registration = await navigator.serviceWorker?.ready;
  if (registration) {
    registration.showNotification(title, { body, tag, icon: "icons/icon-192.png", badge: "icons/icon-192.png" });
  } else {
    new Notification(title, { body, tag });
  }
}

function snoozeMedicine(id) {
  const medicine = state.data.medicines.find((item) => item.id === id);
  if (!medicine) return;
  setTimeout(() => showNotification(`Пора принять: ${medicine.name}`, medicine.dose || "Откройте «Мой день»"), 10 * 60 * 1000);
  showToast("Напомним через 10 минут, пока приложение открыто");
}

function checkDueNotifications() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  for (const item of getTodayItems()) {
    if (item.status) continue;
    const [hour, minute] = item.time.split(":").map(Number);
    const difference = currentMinutes - (hour * 60 + minute);
    if (difference >= 0 && difference <= 1 && !state.notified.has(item.occurrenceKey)) {
      state.notified.add(item.occurrenceKey);
      showNotification(
        item.type === "medicine" ? `Пора принять: ${item.title}` : `Скоро: ${item.title}`,
        item.meta,
        item.occurrenceKey,
      );
    }
  }

  for (const meeting of state.data.meetings) {
    const notifyAt = new Date(meeting.dateTime).getTime() - Number(meeting.reminderMinutes) * 60_000;
    const difference = now.getTime() - notifyAt;
    const key = `meeting-reminder:${meeting.id}`;
    if (difference >= 0 && difference <= 90_000 && !state.notified.has(key)) {
      state.notified.add(key);
      showNotification(`Скоро встреча: ${meeting.title}`, meeting.place || formatDateTime(meeting.dateTime), key);
    }
  }
}

async function requestNotifications() {
  if (!("Notification" in window)) {
    showToast("Этот браузер не поддерживает уведомления");
    return;
  }
  if (/iPhone|iPad|iPod/.test(navigator.userAgent) && !window.navigator.standalone) {
    showToast("Сначала добавьте «Мой день» на экран Домой");
    return;
  }
  const permission = await Notification.requestPermission();
  showToast(permission === "granted" ? "Уведомления разрешены" : "Уведомления не разрешены");
  render();
}

function icsEscape(value = "") {
  return String(value).replaceAll("\\", "\\\\").replaceAll(";", "\\;").replaceAll(",", "\\,").replaceAll("\n", "\\n");
}

function icsLocalDateTime(datePart, timePart) {
  return `${datePart.replaceAll("-", "")}T${timePart.replace(":", "")}00`;
}

function addMinutesToLocal(datePart, timePart, minutes) {
  const date = new Date(`${datePart}T${timePart}:00`);
  date.setMinutes(date.getMinutes() + minutes);
  return `${dateKey(date).replaceAll("-", "")}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
}

function firstMedicineDate(medicine) {
  const date = localDate(medicine.startDate);
  for (let offset = 0; offset < 7; offset += 1) {
    if (medicine.days.map(Number).includes(date.getDay())) return dateKey(date);
    date.setDate(date.getDate() + 1);
  }
  return medicine.startDate;
}

function calendarContents() {
  const events = [];
  for (const medicine of state.data.medicines) {
    const firstDate = firstMedicineDate(medicine);
    for (const time of medicine.times) {
      const until = medicine.endDate ? `;UNTIL=${medicine.endDate.replaceAll("-", "")}T235959` : "";
      events.push([
        "BEGIN:VEVENT",
        `UID:medicine-${medicine.id}-${time.replace(":", "")}@my-day.local`,
        `DTSTAMP:${new Date().toISOString().replaceAll(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
        `DTSTART:${icsLocalDateTime(firstDate, time)}`,
        `DTEND:${addMinutesToLocal(firstDate, time, 15)}`,
        `RRULE:FREQ=WEEKLY;BYDAY=${medicine.days.map((day) => DAYS_ICS[Number(day)]).join(",")}${until}`,
        `SUMMARY:${icsEscape(`Принять: ${medicine.name}`)}`,
        `DESCRIPTION:${icsEscape(medicine.dose || "Лекарство")}`,
        "BEGIN:VALARM",
        "TRIGGER:PT0M",
        "ACTION:DISPLAY",
        `DESCRIPTION:${icsEscape(`Пора принять ${medicine.name}`)}`,
        "END:VALARM",
        "END:VEVENT",
      ].join("\r\n"));
    }
  }
  for (const meeting of state.data.meetings) {
    const [day, time] = meeting.dateTime.split("T");
    events.push([
      "BEGIN:VEVENT",
      `UID:meeting-${meeting.id}@my-day.local`,
      `DTSTAMP:${new Date().toISOString().replaceAll(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
      `DTSTART:${icsLocalDateTime(day, time)}`,
      `DTEND:${addMinutesToLocal(day, time, 60)}`,
      `SUMMARY:${icsEscape(meeting.title)}`,
      meeting.place ? `LOCATION:${icsEscape(meeting.place)}` : "",
      meeting.notes ? `DESCRIPTION:${icsEscape(meeting.notes)}` : "",
      "BEGIN:VALARM",
      `TRIGGER:-PT${Number(meeting.reminderMinutes)}M`,
      "ACTION:DISPLAY",
      `DESCRIPTION:${icsEscape(meeting.title)}`,
      "END:VALARM",
      "END:VEVENT",
    ].filter(Boolean).join("\r\n"));
  }
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Мой день//RU", "CALSCALE:GREGORIAN", ...events, "END:VCALENDAR"].join("\r\n");
}

function downloadFile(contents, name, type) {
  const blob = new Blob([contents], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function exportCalendar() {
  if (!state.data.medicines.length && !state.data.meetings.length) {
    showToast("Сначала добавьте лекарство или встречу");
    return;
  }
  downloadFile(calendarContents(), "moy-den.ics", "text/calendar;charset=utf-8");
  showToast("Откройте файл и добавьте события в календарь");
}

function exportBackup() {
  downloadFile(JSON.stringify(state.data, null, 2), `moy-den-${dateKey()}.json`, "application/json");
  showToast("Резервная копия сохранена");
}

async function restoreBackup(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.medicines) || !Array.isArray(data.meetings) || !Array.isArray(data.history)) throw new Error("bad format");
    state.data = data;
    saveData();
    render();
    showToast("Данные восстановлены");
  } catch {
    showToast("Не удалось прочитать резервную копию");
  }
}

quickAddButton.addEventListener("click", () => {
  if (state.route === "medicines") {
    openMedicineForm();
    return;
  }
  if (state.route === "meetings") {
    openMeetingForm();
    return;
  }
  choiceDialog.showModal();
});

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    state.route = button.dataset.route;
    render();
    app.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog").close());
});

document.querySelectorAll("dialog.sheet").forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
});

document.querySelectorAll("[data-open-form]").forEach((button) => {
  button.addEventListener("click", () => {
    choiceDialog.close();
    button.dataset.openForm === "medicine" ? openMedicineForm() : openMeetingForm();
  });
});

document.querySelector("#add-time").addEventListener("click", () => addTimeInput("12:00"));
timeList.addEventListener("click", (event) => {
  const button = event.target.closest(".remove-time");
  if (!button) return;
  button.closest(".time-row").remove();
  updateRemoveTimeButtons();
});

medicineForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(medicineForm);
  const days = formData.getAll("days").map(Number);
  if (!days.length) {
    showToast("Выберите хотя бы один день недели");
    return;
  }
  if (formData.get("endDate") && formData.get("endDate") < formData.get("startDate")) {
    showToast("Дата окончания не может быть раньше начала");
    return;
  }
  const medicine = {
    id: formData.get("id") || uid(),
    name: formData.get("name").trim(),
    dose: formData.get("dose").trim(),
    times: [...new Set(formData.getAll("times"))].sort(),
    days,
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  };
  const index = state.data.medicines.findIndex((item) => item.id === medicine.id);
  if (index >= 0) state.data.medicines[index] = medicine;
  else state.data.medicines.push(medicine);
  saveData();
  medicineDialog.close();
  state.route = "medicines";
  render();
  showToast("Лекарство сохранено");
});

meetingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(meetingForm);
  const meeting = {
    id: formData.get("id") || uid(),
    title: formData.get("title").trim(),
    dateTime: formData.get("dateTime"),
    place: formData.get("place").trim(),
    notes: formData.get("notes").trim(),
    reminderMinutes: Number(formData.get("reminderMinutes")),
  };
  const index = state.data.meetings.findIndex((item) => item.id === meeting.id);
  if (index >= 0) state.data.meetings[index] = meeting;
  else state.data.meetings.push(meeting);
  saveData();
  meetingDialog.close();
  state.route = "meetings";
  render();
  showToast("Встреча сохранена");
});

document.querySelector("#delete-medicine").addEventListener("click", async () => {
  const id = medicineForm.elements.id.value;
  if (!id || !(await confirmDelete("Удалить лекарство?", "История уже отмеченных приёмов останется."))) return;
  state.data.medicines = state.data.medicines.filter((item) => item.id !== id);
  saveData();
  medicineDialog.close();
  render();
  showToast("Лекарство удалено");
});

document.querySelector("#delete-meeting").addEventListener("click", async () => {
  const id = meetingForm.elements.id.value;
  if (!id || !(await confirmDelete("Удалить встречу?", "Это действие нельзя отменить."))) return;
  state.data.meetings = state.data.meetings.filter((item) => item.id !== id);
  saveData();
  meetingDialog.close();
  render();
  showToast("Встреча удалена");
});

app.addEventListener("click", (event) => {
  const medicineButton = event.target.closest("[data-edit-medicine]");
  const meetingButton = event.target.closest("[data-edit-meeting]");
  const completeButton = event.target.closest("[data-complete]");
  const snoozeButton = event.target.closest("[data-snooze]");
  const emptyButton = event.target.closest("[data-empty-add]");

  if (medicineButton) openMedicineForm(medicineButton.dataset.editMedicine);
  if (meetingButton) openMeetingForm(meetingButton.dataset.editMeeting);
  if (completeButton) completeOccurrence(completeButton.dataset.complete, completeButton.dataset.type);
  if (snoozeButton) snoozeMedicine(snoozeButton.dataset.snooze);
  if (emptyButton) emptyButton.dataset.emptyAdd === "meeting" ? openMeetingForm() : emptyButton.dataset.emptyAdd === "medicine" ? openMedicineForm() : choiceDialog.showModal();
  if (event.target.closest("[data-export-calendar]")) exportCalendar();
  if (event.target.closest("[data-notifications]")) requestNotifications();
  if (event.target.closest("[data-backup]")) exportBackup();
});

app.addEventListener("change", (event) => {
  if (event.target.matches("[data-restore]") && event.target.files[0]) restoreBackup(event.target.files[0]);
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js"));
}

render();
checkDueNotifications();
setInterval(checkDueNotifications, 30_000);
