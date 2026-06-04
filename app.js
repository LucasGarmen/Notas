const STORAGE_KEYS = {
  notes: "notas-locales-data-v1",
  theme: "notas-locales-theme-v1",
  language: "notas-locales-language-v1"
};

const LIST_MODES = {
  bullet: { marker: "\u2022 " },
  dash: { marker: "- " }
};

const STRIKE_MARK = "\u0335";
const STRIKE_MARK_REGEX = /[\u0335\u0336]/g;
const STRIKE_MARK_TEST_REGEX = /[\u0335\u0336]/;

const LANGUAGE_LOCALES = {
  es: "es",
  pt: "pt-BR",
  en: "en"
};

// Estado central de la aplicacion. La interfaz siempre se renderiza desde aqui.
const state = {
  notes: [],
  selectedId: null,
  isEditing: false,
  listMode: null,
  strikeMode: false,
  filter: "all",
  search: "",
  dateFrom: "",
  dateTo: "",
  language: "es",
  statusKey: "localSaved",
  statusValues: {},
  saveTimer: null
};

const els = {};

document.addEventListener("DOMContentLoaded", init);

function init() {
  cacheElements();
  loadLanguage();
  loadTheme();
  loadNotes();
  bindEvents();
  applyLanguage(state.language, { save: false, render: false });
  renderNotes();
  renderEditor();
  registerServiceWorker();
}

function cacheElements() {
  els.body = document.body;
  els.themeColorMeta = document.getElementById("themeColorMeta");
  els.saveStatus = document.getElementById("saveStatus");
  els.backButton = document.getElementById("backButton");
  els.newNoteButton = document.getElementById("newNoteButton");
  els.languageSelect = document.getElementById("languageSelect");
  els.themeToggle = document.getElementById("themeToggle");
  els.searchInput = document.getElementById("searchInput");
  els.filterButtons = Array.from(document.querySelectorAll(".filter-button"));
  els.dateFilter = document.getElementById("dateFilter");
  els.dateFromInput = document.getElementById("dateFromInput");
  els.dateToInput = document.getElementById("dateToInput");
  els.notesList = document.getElementById("notesList");
  els.noteForm = document.getElementById("noteForm");
  els.saveButton = document.getElementById("saveButton");
  els.favoriteButton = document.getElementById("favoriteButton");
  els.deleteButton = document.getElementById("deleteButton");
  els.listToolbar = document.getElementById("listToolbar");
  els.listButtons = Array.from(document.querySelectorAll(".list-mode-button[data-list-mode]"));
  els.strikeLineButton = document.getElementById("strikeLineButton");
  els.emojiButton = document.getElementById("emojiButton");
  els.emojiPalette = document.getElementById("emojiPalette");
  els.emojiButtons = Array.from(document.querySelectorAll(".emoji-option"));
  els.numberListChoice = document.getElementById("numberListChoice");
  els.continueNumberListButton = document.getElementById("continueNumberListButton");
  els.newNumberListButton = document.getElementById("newNumberListButton");
  els.titleInput = document.getElementById("titleInput");
  els.contentInput = document.getElementById("contentInput");
  els.updatedAtText = document.getElementById("updatedAtText");
}

function bindEvents() {
  els.newNoteButton.addEventListener("click", createNote);
  els.backButton.addEventListener("click", showListView);
  els.languageSelect.addEventListener("change", () => {
    saveCurrentNote({ silent: true });
    applyLanguage(els.languageSelect.value);
  });
  els.themeToggle.addEventListener("click", toggleTheme);
  els.noteForm.addEventListener("submit", (event) => {
    event.preventDefault();
    handleEditSaveButton();
  });
  els.saveButton.addEventListener("click", handleEditSaveButton);
  els.favoriteButton.addEventListener("click", toggleFavorite);
  els.deleteButton.addEventListener("click", deleteCurrentNote);

  els.titleInput.addEventListener("input", scheduleAutoSave);
  els.contentInput.addEventListener("input", handleContentInput);
  els.contentInput.addEventListener("keydown", handleContentKeydown);
  els.contentInput.addEventListener("pointerup", handleContentPointerUp);
  els.contentInput.addEventListener("click", handleContentClick);
  els.contentInput.addEventListener("keyup", syncListModeWithCaret);

  els.listButtons.forEach((button) => {
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => toggleListMode(button.dataset.listMode));
  });

  els.strikeLineButton.addEventListener("mousedown", (event) => event.preventDefault());
  els.strikeLineButton.addEventListener("click", toggleStrikeMode);

  els.emojiButton.addEventListener("mousedown", (event) => event.preventDefault());
  els.emojiButton.addEventListener("click", toggleEmojiPalette);

  els.emojiButtons.forEach((button) => {
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => insertEmoji(button.dataset.emoji));
  });

  els.continueNumberListButton.addEventListener("mousedown", (event) => event.preventDefault());
  els.newNumberListButton.addEventListener("mousedown", (event) => event.preventDefault());
  els.continueNumberListButton.addEventListener("click", () => applyNumberListChoice("continue"));
  els.newNumberListButton.addEventListener("click", () => applyNumberListChoice("new"));

  document.addEventListener("click", (event) => {
    const clickedEditorTool =
      els.listToolbar.contains(event.target) ||
      els.emojiPalette.contains(event.target) ||
      els.numberListChoice.contains(event.target);

    if (!els.emojiPalette.hidden && !clickedEditorTool) {
      closeEmojiPalette();
    }

    if (!els.numberListChoice.hidden && !clickedEditorTool) {
      closeNumberListChoice();
    }
  });

  els.searchInput.addEventListener("input", () => {
    state.search = els.searchInput.value.trim().toLowerCase();
    renderNotes();
  });

  els.filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      renderFilterButtons();
      renderDateFilter();
      renderNotes();
    });
  });

  els.dateFromInput.addEventListener("input", () => {
    state.dateFrom = els.dateFromInput.value;
    renderNotes();
  });

  els.dateToInput.addEventListener("input", () => {
    state.dateTo = els.dateToInput.value;
    renderNotes();
  });

  window.addEventListener("beforeunload", () => saveCurrentNote({ silent: true }));

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      saveCurrentNote({ silent: true });
    }
  });
}

function loadLanguage() {
  const savedLanguage = localStorage.getItem(STORAGE_KEYS.language);
  state.language = getSupportedLanguage(savedLanguage);
}

function applyLanguage(language, options = {}) {
  state.language = getSupportedLanguage(language);
  document.documentElement.lang = state.language;

  if (els.languageSelect) {
    els.languageSelect.value = state.language;
  }

  if (options.save !== false) {
    localStorage.setItem(STORAGE_KEYS.language, state.language);
  }

  translateStaticText();
  renderStatus();
  applyTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");

  if (options.render !== false) {
    renderNotes();
    renderEditor();
  }
}

function translateStaticText() {
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.setAttribute("placeholder", t(element.dataset.i18nPlaceholder));
  });

  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  });

  document.querySelectorAll("[data-i18n-content]").forEach((element) => {
    element.setAttribute("content", t(element.dataset.i18nContent));
  });
}

function t(key, values = {}) {
  const translations = window.APP_TRANSLATIONS || {};
  const dictionary = translations[state.language] || translations.es || {};
  const fallback = translations.es || {};
  const template = dictionary[key] || fallback[key] || key;

  return template.replace(/\{(\w+)\}/g, (match, name) => {
    return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : match;
  });
}

function getSupportedLanguage(language) {
  const translations = window.APP_TRANSLATIONS || {};

  if (language && Object.prototype.hasOwnProperty.call(translations, language)) {
    return language;
  }

  return "es";
}

function loadNotes() {
  // localStorage mantiene todas las notas en el dispositivo, sin backend.
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.notes);
    const parsed = saved ? JSON.parse(saved) : [];
    state.notes = Array.isArray(parsed) ? parsed.map(normalizeNote) : [];
  } catch (error) {
    console.warn("No se pudieron cargar las notas.", error);
    state.notes = [];
  }
}

function saveNotes() {
  try {
    localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(state.notes));
  } catch (error) {
    console.warn("No se pudieron guardar las notas.", error);
    setStatus("saveFailed");
  }
}

function normalizeNote(note) {
  const now = new Date().toISOString();
  return {
    id: note.id || createId(),
    title: typeof note.title === "string" ? note.title : "",
    content: typeof note.content === "string" ? note.content : "",
    favorite: Boolean(note.favorite),
    archived: Boolean(note.archived),
    createdAt: note.createdAt || now,
    updatedAt: note.updatedAt || note.createdAt || now
  };
}

function createNote() {
  saveCurrentNote({ silent: true });

  const now = new Date().toISOString();
  const note = {
    id: createId(),
    title: "",
    content: "",
    favorite: false,
    archived: false,
    createdAt: now,
    updatedAt: now
  };

  state.notes.unshift(note);
  state.selectedId = note.id;
  state.isEditing = true;
  state.listMode = null;
  state.strikeMode = false;
  state.filter = "all";
  saveNotes();
  renderFilterButtons();
  renderDateFilter();
  renderNotes();
  renderEditor();
  showEditorView();
  setStatus("noteCreated");

  requestAnimationFrame(() => els.titleInput.focus());
}

function selectNote(id) {
  saveCurrentNote({ silent: true });
  state.selectedId = id;
  state.isEditing = false;
  state.listMode = null;
  state.strikeMode = false;
  renderNotes();
  renderEditor();
  showEditorView();
}

function saveCurrentNote(options = {}) {
  const note = getSelectedNote();
  if (!note || els.noteForm.hidden) {
    return false;
  }

  // Antes de cambiar de nota o cerrar la app, se guarda el texto visible.
  clearTimeout(state.saveTimer);
  const nextTitle = els.titleInput.value;
  const nextContent = els.contentInput.value;
  const changed = note.title !== nextTitle || note.content !== nextContent;

  if (!changed && !options.force && !options.touch) {
    return false;
  }

  if (changed) {
    note.title = nextTitle;
    note.content = nextContent;
  }

  if (changed || options.touch) {
    note.updatedAt = new Date().toISOString();
  }

  saveNotes();
  renderNotes();
  renderMeta(note);

  if (!options.silent) {
    setStatus(changed ? "saved" : "noChanges");
  }

  return true;
}

function saveAndReturnHome() {
  saveCurrentNote({ force: true, touch: true });
  state.selectedId = null;
  state.isEditing = false;
  state.listMode = null;
  state.strikeMode = false;
  showListView({ skipSave: true });
  renderEditor();
  setStatus("saved");
}

function handleEditSaveButton() {
  if (!state.isEditing) {
    startEditing();
    return;
  }

  saveAndReturnHome();
}

function startEditing() {
  if (!getSelectedNote()) {
    return;
  }

  state.isEditing = true;
  renderEditor();
  setStatus("editing");

  requestAnimationFrame(() => {
    if (els.titleInput.value.trim()) {
      els.contentInput.focus();
      return;
    }

    els.titleInput.focus();
  });
}

function scheduleAutoSave() {
  if (!state.isEditing) {
    return;
  }

  setStatus("editing");
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => {
    saveCurrentNote();
  }, 350);
}

function handleContentInput() {
  closeNumberListChoice();
  scheduleAutoSave();
  syncListModeWithCaret();
}

function handleContentPointerUp() {
  if (state.strikeMode) {
    requestAnimationFrame(() => {
      if (state.strikeMode) {
        toggleStrikeCurrentLine();
      }
    });
  }
}

function handleContentClick() {
  if (state.strikeMode) {
    return;
  }

  syncListModeWithCaret();
}

function handleContentKeydown(event) {
  if (!state.isEditing || event.key !== "Enter" || event.shiftKey || !state.listMode) {
    return;
  }

  continueListOnEnter(event);
}

function deleteCurrentNote() {
  const note = getSelectedNote();
  if (!note) {
    return;
  }

  const title = note.title.trim() || t("untitled");
  const confirmed = window.confirm(t("deleteConfirm", { title }));

  if (!confirmed) {
    return;
  }

  state.notes = state.notes.filter((item) => item.id !== note.id);
  state.selectedId = null;
  saveNotes();
  renderNotes();
  renderEditor();
  showListView();
  setStatus("noteDeleted");
}

function toggleFavorite() {
  const note = getSelectedNote();
  if (!note) {
    return;
  }

  saveCurrentNote({ silent: true });
  note.favorite = !note.favorite;
  note.updatedAt = new Date().toISOString();
  saveNotes();
  renderNotes();
  renderEditor();
  setStatus(note.favorite ? "favorited" : "unfavorited");
}

function renderNotes() {
  const notes = getVisibleNotes();
  els.notesList.replaceChildren();

  if (!notes.length) {
    const empty = document.createElement("div");
    empty.className = "empty-list";
    empty.textContent = getEmptyMessage();
    els.notesList.append(empty);
    return;
  }

  notes.forEach((note) => {
    els.notesList.append(createNoteCard(note));
  });
}

function createNoteCard(note) {
  const card = document.createElement("button");
  card.className = "note-card";
  card.type = "button";
  card.dataset.id = note.id;
  card.setAttribute("aria-label", t("openNote", { title: note.title.trim() || t("untitled") }));

  if (note.id === state.selectedId) {
    card.classList.add("is-active");
    card.setAttribute("aria-current", "true");
  }

  const title = document.createElement("h2");
  title.className = "note-card-title";
  title.textContent = note.title.trim() || t("untitled");

  const titleRow = document.createElement("div");
  titleRow.className = "card-title-row";
  titleRow.append(title);

  if (note.favorite) {
    const star = document.createElement("span");
    star.className = "card-star";
    star.textContent = "\u2605";
    star.setAttribute("aria-label", t("favorite"));
    titleRow.append(star);
  }

  const preview = document.createElement("p");
  preview.className = "note-card-preview";
  preview.textContent = note.content.trim() || t("noContent");

  const footer = document.createElement("div");
  footer.className = "card-footer";

  const date = document.createElement("span");
  date.className = "card-date";
  date.textContent = t("savedCard", { date: formatDate(note.updatedAt) });

  footer.append(date);
  card.append(titleRow, preview, footer);
  card.addEventListener("click", () => selectNote(note.id));

  return card;
}

function renderEditor() {
  const note = getSelectedNote();

  if (!note) {
    els.noteForm.hidden = true;
    return;
  }

  els.noteForm.hidden = false;
  els.titleInput.value = note.title;
  els.contentInput.value = note.content;
  setEditorMode(state.isEditing);
  renderMeta(note);

  els.saveButton.textContent = state.isEditing ? t("save") : t("edit");
  els.saveButton.classList.toggle("save-mode", state.isEditing);
  els.saveButton.setAttribute("aria-label", state.isEditing ? t("saveNote") : t("editNote"));
  els.favoriteButton.textContent = "\u2605";
  els.favoriteButton.classList.toggle("is-active", note.favorite);
  els.favoriteButton.setAttribute("aria-pressed", String(note.favorite));
  els.favoriteButton.setAttribute("aria-label", note.favorite ? t("removeFavorite") : t("markFavorite"));
  renderListButtons();
  renderStrikeButton();
}

function renderMeta(note) {
  els.updatedAtText.textContent = t("savedMeta", { date: formatDate(note.updatedAt) });
}

function setEditorMode(isEditing) {
  els.noteForm.classList.toggle("is-readonly", !isEditing);
  els.titleInput.readOnly = !isEditing;
  els.contentInput.readOnly = !isEditing;
  els.listToolbar.hidden = !isEditing;

  if (!isEditing) {
    state.listMode = null;
    state.strikeMode = false;
    closeEmojiPalette();
    closeNumberListChoice();
  }

  renderStrikeButton();
}

function toggleListMode(mode) {
  if (!state.isEditing) {
    return;
  }

  state.strikeMode = false;
  closeEmojiPalette();
  renderStrikeButton();

  if (state.listMode === mode) {
    state.listMode = null;
    closeNumberListChoice();
    renderListButtons();
    els.contentInput.focus();
    return;
  }

  if (mode === "number" && shouldAskNumberListChoice()) {
    state.listMode = null;
    renderListButtons();
    openNumberListChoice();
    els.contentInput.focus();
    return;
  }

  state.listMode = mode;
  closeNumberListChoice();
  renderListButtons();
  applyListModeToCurrentLine(state.listMode);
}

function toggleStrikeMode() {
  if (!state.isEditing) {
    return;
  }

  state.strikeMode = !state.strikeMode;

  if (state.strikeMode) {
    state.listMode = null;
    closeEmojiPalette();
    closeNumberListChoice();
  }

  renderListButtons();
  renderStrikeButton();
  els.contentInput.focus();
}

function renderListButtons() {
  els.listButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.listMode === state.listMode);
    button.setAttribute("aria-pressed", String(button.dataset.listMode === state.listMode));
  });
}

function renderStrikeButton() {
  els.strikeLineButton.classList.toggle("is-active", state.strikeMode);
  els.strikeLineButton.setAttribute("aria-pressed", String(state.strikeMode));
}

function toggleEmojiPalette() {
  if (!state.isEditing) {
    return;
  }

  state.strikeMode = false;
  renderStrikeButton();
  closeNumberListChoice();
  const shouldOpen = els.emojiPalette.hidden;
  els.emojiPalette.hidden = !shouldOpen;
  els.emojiButton.classList.toggle("is-open", shouldOpen);
  els.emojiButton.setAttribute("aria-expanded", String(shouldOpen));
  els.contentInput.focus();
}

function closeEmojiPalette() {
  els.emojiPalette.hidden = true;
  els.emojiButton.classList.remove("is-open");
  els.emojiButton.setAttribute("aria-expanded", "false");
}

function openNumberListChoice() {
  closeEmojiPalette();
  els.numberListChoice.hidden = false;
}

function closeNumberListChoice() {
  els.numberListChoice.hidden = true;
}

function applyNumberListChoice(choice) {
  if (!state.isEditing) {
    return;
  }

  state.listMode = "number";
  closeNumberListChoice();
  renderListButtons();
  applyListModeToCurrentLine("number", { numberStart: choice });
}

function insertEmoji(emoji) {
  if (!state.isEditing || !emoji) {
    return;
  }

  replaceTextareaRange(els.contentInput, els.contentInput.selectionStart ?? els.contentInput.value.length, els.contentInput.selectionEnd ?? els.contentInput.value.length, emoji);
  closeEmojiPalette();
  closeNumberListChoice();
  els.contentInput.focus();
}

function applyListModeToCurrentLine(mode, options = {}) {
  const input = els.contentInput;
  const value = input.value;
  const selectionStart = input.selectionStart ?? value.length;
  const selectionEnd = input.selectionEnd ?? selectionStart;
  const line = getCurrentLineInfo(value, selectionStart);
  const existingMarker = getLineMarkerInfo(line.text);

  if (existingMarker && existingMarker.mode === mode) {
    input.focus();
    return;
  }

  const marker = getMarkerForMode(mode, line.start, value, options);
  const replaceStart = line.start;
  const replaceEnd = existingMarker ? line.start + existingMarker.marker.length : line.start;
  const delta = marker.length - (replaceEnd - replaceStart);
  const nextValue = value.slice(0, replaceStart) + marker + value.slice(replaceEnd);

  input.value = nextValue;
  input.setSelectionRange(adjustOffset(selectionStart, replaceStart, replaceEnd, delta, marker), adjustOffset(selectionEnd, replaceStart, replaceEnd, delta, marker));
  input.focus();
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function continueListOnEnter(event) {
  const input = event.currentTarget;

  if (input.selectionStart !== input.selectionEnd) {
    return;
  }

  const line = getCurrentLineInfo(input.value, input.selectionStart);
  const marker = getLineMarkerInfo(line.text);

  if (!marker || marker.mode !== state.listMode) {
    clearListMode();
    return;
  }

  event.preventDefault();

  if (line.text.slice(marker.marker.length).trim() === "") {
    replaceTextareaRange(input, line.start, line.start + marker.marker.length, "");
    clearListMode();
    return;
  }

  const nextMarker = state.listMode === "number" ? `${marker.number + 1}. ` : LIST_MODES[state.listMode].marker;
  replaceTextareaRange(input, input.selectionStart, input.selectionEnd, `\n${nextMarker}`);
}

function syncListModeWithCaret() {
  if (!state.isEditing || document.activeElement !== els.contentInput) {
    return;
  }

  const line = getCurrentLineInfo(els.contentInput.value, els.contentInput.selectionStart ?? 0);
  const marker = getLineMarkerInfo(line.text);
  const nextMode = marker ? marker.mode : null;

  if (state.listMode !== nextMode) {
    state.listMode = nextMode;
    renderListButtons();
  }
}

function clearListMode() {
  state.listMode = null;
  renderListButtons();
}

function toggleStrikeCurrentLine() {
  if (!state.isEditing) {
    return;
  }

  const input = els.contentInput;
  const value = input.value;
  const caret = input.selectionStart ?? value.length;
  const line = getCurrentLineInfo(value, caret);

  if (!line.text.length) {
    return;
  }

  const plainLine = removeStrikeMarks(line.text);
  const nextLine = hasStrikeMarks(line.text) ? plainLine : addStrikeMarks(plainLine);

  input.value = value.slice(0, line.start) + nextLine + value.slice(line.end);
  input.setSelectionRange(line.start + nextLine.length, line.start + nextLine.length);
  input.focus();
  input.dispatchEvent(new Event("input", { bubbles: true }));
  state.listMode = null;
  renderListButtons();
  renderStrikeButton();
}

function addStrikeMarks(text) {
  return Array.from(text).map((character) => character + STRIKE_MARK).join("");
}

function hasStrikeMarks(text) {
  return STRIKE_MARK_TEST_REGEX.test(text);
}

function removeStrikeMarks(text) {
  return text.replace(STRIKE_MARK_REGEX, "");
}

function shouldAskNumberListChoice() {
  const input = els.contentInput;
  const caret = input.selectionStart ?? input.value.length;
  const line = getCurrentLineInfo(input.value, caret);
  const marker = getLineMarkerInfo(line.text);

  if (marker && marker.mode === "number") {
    return false;
  }

  return getPreviousListNumber(line.start, input.value) > 0;
}

function getCurrentLineInfo(value, caret) {
  const start = value.lastIndexOf("\n", Math.max(0, caret - 1)) + 1;
  const nextBreak = value.indexOf("\n", caret);
  const end = nextBreak === -1 ? value.length : nextBreak;

  return {
    start,
    end,
    text: value.slice(start, end)
  };
}

function getLineMarkerInfo(line) {
  const numberMatch = line.match(/^(\d+)\.\s+/);

  if (numberMatch) {
    return {
      mode: "number",
      marker: numberMatch[0],
      number: Number(numberMatch[1])
    };
  }

  if (line.startsWith(LIST_MODES.bullet.marker)) {
    return { mode: "bullet", marker: LIST_MODES.bullet.marker };
  }

  if (line.startsWith(LIST_MODES.dash.marker)) {
    return { mode: "dash", marker: LIST_MODES.dash.marker };
  }

  return null;
}

function getMarkerForMode(mode, lineStart, value, options = {}) {
  if (mode === "number") {
    const previousNumber = options.numberStart === "new" ? 0 : getPreviousListNumber(lineStart, value);
    return `${previousNumber + 1}. `;
  }

  return LIST_MODES[mode].marker;
}

function getPreviousListNumber(lineStart, value) {
  const lines = value.slice(0, lineStart).split("\n");

  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const match = lines[i].match(/^(\d+)\.\s+/);

    if (match) {
      return Number(match[1]);
    }
  }

  return 0;
}

function replaceTextareaRange(input, start, end, text) {
  input.value = input.value.slice(0, start) + text + input.value.slice(end);
  const nextCaret = start + text.length;
  input.setSelectionRange(nextCaret, nextCaret);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function adjustOffset(offset, replaceStart, replaceEnd, delta, marker) {
  if (offset < replaceStart) {
    return offset;
  }

  if (offset <= replaceEnd) {
    return replaceStart + marker.length;
  }

  return offset + delta;
}

function renderFilterButtons() {
  els.filterButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.filter === state.filter);
  });
}

function renderDateFilter() {
  els.dateFilter.hidden = state.filter !== "date";
}

function getVisibleNotes() {
  return state.notes
    .filter(matchesFilter)
    .filter(matchesSearch)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function matchesFilter(note) {
  if (state.filter === "favorites") {
    return note.favorite;
  }

  if (state.filter === "date") {
    return matchesDateRange(note);
  }

  return true;
}

function matchesSearch(note) {
  if (!state.search) {
    return true;
  }

  return `${note.title} ${note.content}`.toLowerCase().includes(state.search);
}

function getEmptyMessage() {
  if (state.search) {
    return t("emptySearch");
  }

  if (state.filter === "favorites") {
    return t("emptyFavorites");
  }

  if (state.filter === "date") {
    return t("emptyDate");
  }

  return t("emptyAll");
}

function getSelectedNote() {
  return state.notes.find((note) => note.id === state.selectedId) || null;
}

function showEditorView() {
  els.body.dataset.view = "editor";
}

function showListView(options = {}) {
  if (!options.skipSave) {
    saveCurrentNote({ silent: true });
  }

  state.isEditing = false;
  state.listMode = null;
  state.strikeMode = false;
  els.body.dataset.view = "list";
  renderNotes();
}

function matchesDateRange(note) {
  const noteDate = toDateInputValue(new Date(note.updatedAt));

  if (!noteDate) {
    return false;
  }

  if (state.dateFrom && noteDate < state.dateFrom) {
    return false;
  }

  if (state.dateTo && noteDate > state.dateTo) {
    return false;
  }

  return true;
}

function toDateInputValue(date) {
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function loadTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.theme);
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  applyTheme(savedTheme || systemTheme);
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  applyTheme(current === "dark" ? "light" : "dark");
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEYS.theme, theme);
  els.themeToggle.setAttribute("aria-checked", String(theme === "dark"));
  els.themeToggle.setAttribute("aria-label", theme === "dark" ? t("lightTheme") : t("darkTheme"));
  els.themeToggle.title = theme === "dark" ? t("lightTheme") : t("darkTheme");
  els.themeColorMeta.setAttribute("content", theme === "dark" ? "#141414" : "#2563eb");
}

function setStatus(key, values = {}) {
  state.statusKey = key;
  state.statusValues = values;
  renderStatus();
}

function renderStatus() {
  if (!els.saveStatus) {
    return;
  }

  els.saveStatus.textContent = t(state.statusKey, state.statusValues);
}

function formatDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return t("dateUnavailable");
  }

  return new Intl.DateTimeFormat(LANGUAGE_LOCALES[state.language] || "es", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function registerServiceWorker() {
  // Los navegadores no permiten service workers al abrir index.html con file://.
  if (!("serviceWorker" in navigator) || window.location.protocol === "file:") {
    return;
  }

  navigator.serviceWorker
    .register("./service-worker.js")
    .then(() => setStatus("offlineReady"))
    .catch((error) => console.warn("No se pudo registrar el service worker.", error));
}
