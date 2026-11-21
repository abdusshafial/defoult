"use strict";

const storageKey = "bachelor-life-planner-v1";
const get = (id) => document.getElementById(id);
const today = () => dayKey(new Date());
const selections = { daily: today(), weekly: monday(today()), expenses: today().slice(0, 7) };
const viewConfig = {
  daily: { unit: "দিন", now: "আজ", label: "দৈনিক রুটিন", add: "কাজ যোগ করুন",
    description: "সকাল থেকে রাত পর্যন্ত কাজগুলো টিক দিন। সময়সূচি নিজের মতো বদলে নিতে পারবেন।" },
  weekly: { unit: "সপ্তাহ", now: "এই সপ্তাহ", label: "সাপ্তাহিক কাজ", add: "কাজ যোগ করুন",
    description: "বাজার, কাপড় ধোয়া আর ঘর পরিষ্কারের মতো কাজগুলো গুছিয়ে রাখুন।" },
  expenses: { unit: "মাস", now: "এই মাস", label: "মাসিক খরচ", add: "খরচ যোগ করুন",
    description: "দৈনন্দিন খরচ লিখুন আর বাজেটে কত টাকা বাকি আছে দেখুন।" }
};
const forms = { daily: "task-fields", weekly: "weekly-fields", expenses: "expense-fields", budget: "budget-fields" };
const editor = get("editor");
const deletion = get("delete-dialog");
const tabs = [...document.querySelectorAll("[data-view]")];
let view = "daily";
let pendingEdit;
let pendingDelete;
let state;

try {
  state = readPlanner(localStorage.getItem(storageKey));
} catch {
  state = initialPlanner();
  get("storage-notice").hidden = false;
}

function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
    get("storage-notice").hidden = true;
  } catch {
    get("storage-notice").hidden = false;
  }
}

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function addOptions(id, options, numeric) {
  options.forEach((option, index) => {
    const row = node("option", option);
    row.value = numeric ? String(index) : option;
    get(id).append(row);
  });
}

function activeKey() {
  return selections[view];
}

function currentKey() {
  if (view === "weekly") return monday(today());
  return view === "expenses" ? today().slice(0, 7) : today();
}

function changePeriod(direction) {
  const key = activeKey();
  if (direction === 0) selections[view] = currentKey();
  else if (view === "expenses") selections[view] = changeMonth(key, direction);
  else selections[view] = changeDay(key, direction * (view === "weekly" ? 7 : 1));
  render();
}

function labelPeriod(key) {
  if (view === "weekly") return shortDate.format(dateFrom(key)) + " – " + shortDate.format(dateFrom(changeDay(key, 6)));
  if (view === "expenses") return monthDate.format(dateFrom(key + "-01"));
  return fullDate.format(dateFrom(key));
}

function render() {
  const config = viewConfig[view];
  get("period-label").textContent = labelPeriod(activeKey());
  get("page-title").textContent = view === "daily" && activeKey() === today() ? "আজকের রুটিন" : config.label;
  get("page-description").textContent = config.description;
  get("add-item").lastChild.textContent = " " + config.add;
  get("previous").textContent = "আগের " + config.unit;
  get("current").textContent = config.now;
  get("next").textContent = "পরের " + config.unit;
  tabs.forEach((tab) => tab.setAttribute("aria-pressed", String(tab.dataset.view === view)));
  renderEntries();
  renderSummary();
}

function makeEntry(item, type, key) {
  const row = get("entry-template").content.firstElementChild.cloneNode(true);
  const check = row.querySelector(".check");
  const title = row.querySelector("strong");
  const detail = row.querySelector("small");
  if (type === "expenses") {
    check.remove();
    title.textContent = moneyLabel(item.cents) + " · " + item.category;
    detail.textContent = shortDate.format(dateFrom(item.date)) + (item.note ? " · " + item.note : "");
  } else {
    title.textContent = item.title;
    detail.textContent = type === "daily" ? formatRoutineTime(item.time) : weekdays[item.day];
    check.checked = routineCheckList(state, type, key).includes(item.id);
    check.setAttribute("aria-label", item.title);
    row.classList.toggle("is-done", check.checked);
    check.addEventListener("change", () => {
      updateRoutineCheck(state, type, key, item.id, check.checked);
      row.classList.toggle("is-done", check.checked);
      save();
      renderSummary();
    });
  }
  const edit = row.querySelector(".edit");
  const remove = row.querySelector(".remove");
  edit.setAttribute("aria-label", title.textContent + " বদলান");
  remove.setAttribute("aria-label", title.textContent + " মুছুন");
  edit.addEventListener("click", () => openEditor(type, item));
  remove.addEventListener("click", () => openDelete(type, item));
  return row;
}

function group(title, symbol, theme, items, type, key) {
  const section = node("section", "", "group panel " + theme);
  const heading = node("h2");
  const decoration = node("span", symbol);
  decoration.setAttribute("aria-hidden", "true");
  heading.append(decoration, title);
  const list = node("ul");
  list.append(...items.map((item) => makeEntry(item, type, key)));
  section.append(heading, list);
  return section;
}

function renderEntries() {
  const target = get("entries");
  const key = activeKey();
  target.replaceChildren();
  if (view === "expenses") {
    const items = monthExpenses(state, key);
    target.append(items.length ? group("খরচের তালিকা", "৳", "", items, view, key) :
      node("p", "এই মাসে কোনো খরচ যোগ করা হয়নি।", "panel empty"));
    return;
  }
  if (view === "weekly") {
    const items = [...state.weekly].sort((a, b) => a.day - b.day);
    target.append(items.length ? group("সপ্তাহের তালিকা", "✓", "", items, view, key) :
      node("p", "সাপ্তাহিক তালিকায় একটি কাজ যোগ করুন।", "panel empty"));
    return;
  }
  const ordered = [...state.daily].sort((a, b) => a.time.localeCompare(b.time));
  dayParts.forEach((part, index) => {
    const start = index === 0 ? "00:00" : dayParts[index - 1].end;
    const items = ordered.filter((item) => item.time >= start && item.time < part.end);
    if (items.length) target.append(group(part.name, part.symbol, part.theme, items, view, key));
  });
  if (!ordered.length) target.append(node("p", "দৈনিক তালিকায় একটি কাজ যোগ করুন।", "panel empty"));
}

function summaryAmount(label, value, className) {
  const row = node("div");
  row.append(node("dt", label), node("dd", value, className));
  return row;
}

function renderSummary() {
  const key = activeKey();
  const card = node("section", "", "panel");
  const target = get("summary");
  target.replaceChildren(card);
  if (view === "expenses") {
    const total = expenseTotal(monthExpenses(state, key));
    const budget = state.budgets[key];
    card.append(node("h2", "এই মাসে খরচ"), node("p", moneyLabel(total), "number"));
    if (budget !== undefined) {
      const balance = budget - total;
      const progress = node("progress");
      progress.max = budget;
      progress.value = Math.min(budget, total);
      progress.setAttribute("aria-label", "ব্যবহৃত বাজেট");
      const details = node("dl");
      details.append(summaryAmount("বাজেট", moneyLabel(budget)),
        summaryAmount(balance < 0 ? "বাজেটের বেশি" : "বাকি", moneyLabel(Math.abs(balance)), balance < 0 ? "over-budget" : ""));
      card.append(progress, details);
    } else {
      card.append(node("p", "একটা মাসিক বাজেট সেট করলে বাকি টাকা এখানে দেখাবে।"));
    }
    const editBudget = node("button", budget === undefined ? "বাজেট সেট করুন" : "বাজেট বদলান");
    editBudget.type = "button";
    editBudget.addEventListener("click", () => openEditor("budget"));
    card.append(editBudget);
    return;
  }
  const tasks = state[view];
  const checked = routineCheckList(state, view, key);
  const complete = tasks.filter((task) => checked.includes(task.id)).length;
  card.append(node("h2", "কাজের অগ্রগতি"), node("p", number.format(complete) + " / " + number.format(tasks.length), "number"));
  const progress = node("progress");
  progress.max = Math.max(1, tasks.length);
  progress.value = complete;
  progress.setAttribute("aria-label", "শেষ করা কাজের সংখ্যা");
  const remaining = tasks.length - complete;
  const hint = !tasks.length ? "তালিকায় কাজ যোগ করুন।" : remaining ? "আর " + number.format(remaining) + "টি কাজ বাকি।" : "সব কাজ শেষ হয়েছে।";
  card.append(progress, node("p", hint));
}

function openEditor(type, item) {
  const key = activeKey();
  pendingEdit = { type, item, key };
  const fields = {
    daily: { "task-title": item?.title ?? "", "task-time": item?.time ?? "08:00" },
    weekly: { "weekly-title": item?.title ?? "", "weekly-day": String(item?.day ?? 0) },
    expenses: {
      "expense-date": item?.date ?? (key === today().slice(0, 7) ? today() : key + "-01"),
      "expense-category": item?.category ?? categories[0],
      "expense-amount": item?.cents ? String(item.cents / 100) : "",
      "expense-note": item?.note ?? ""
    },
    budget: { "budget-amount": state.budgets[key] === undefined ? "" : String(state.budgets[key] / 100) }
  };
  Object.entries(forms).forEach(([name, id]) => {
    get(id).disabled = name !== type;
    get(id).hidden = name !== type;
  });
  Object.entries(fields[type]).forEach(([id, value]) => { get(id).value = value; });
  get("editor-title").textContent = type === "budget" ? "মাসিক বাজেট" : type === "expenses" ?
    (item ? "খরচ বদলান" : "নতুন খরচ") : (item ? "কাজ বদলান" : "নতুন কাজ");
  get("form-error").hidden = true;
  editor.showModal();
  get(forms[type]).querySelector("input").focus();
}

function showError(message) {
  get("form-error").textContent = message;
  get("form-error").hidden = false;
}

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
}

function storeItem(type, item, value) {
  if (item) {
    const index = state[type].findIndex((entry) => entry.id === item.id);
    if (index !== -1) state[type][index] = { ...value, id: item.id };
  } else {
    state[type].unshift({ ...value, id: newId() });
  }
}

get("edit-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const { type, item, key } = pendingEdit;
  if (type === "daily" || type === "weekly") {
    const title = get(type === "daily" ? "task-title" : "weekly-title").value.trim();
    const time = get("task-time").value;
    if (!title) return showError("কাজের নাম লিখুন।");
    if (type === "daily" && !timePattern.test(time)) return showError("কাজের সময় বেছে নিন।");
    storeItem(type, item, type === "daily" ? { title, time } : { title, day: Number(get("weekly-day").value) });
  } else {
    const cents = parseMoney(get(type === "budget" ? "budget-amount" : "expense-amount").value);
    if (cents === null) return showError("শূন্যের বেশি একটি বৈধ টাকার পরিমাণ লিখুন।");
    if (type === "budget") {
      state.budgets[key] = cents;
    } else {
      const date = get("expense-date").value;
      if (!validDate(date)) return showError("খরচের তারিখ বেছে নিন।");
      storeItem(type, item, { cents, date, category: get("expense-category").value, note: get("expense-note").value.trim() });
      selections.expenses = date.slice(0, 7);
    }
  }
  save();
  editor.close();
  render();
  get("add-item").focus();
});

function openDelete(type, item) {
  pendingDelete = { type, item };
  get("delete-copy").textContent = type === "expenses" ? moneyLabel(item.cents) + " এর এই খরচটি হিসাব থেকে সরবে।" :
    "“" + item.title + "” কাজটি নিয়মিত তালিকা থেকে সরবে।";
  deletion.returnValue = "";
  deletion.showModal();
}

deletion.addEventListener("close", () => {
  if (deletion.returnValue !== "delete") return;
  const { type, item } = pendingDelete;
  state[type] = state[type].filter((entry) => entry.id !== item.id);
  save();
  render();
  get("add-item").focus();
});

addOptions("weekly-day", weekdays, true);
addOptions("expense-category", categories, false);
tabs.forEach((tab) => tab.addEventListener("click", () => {
  view = tab.dataset.view;
  render();
}));
get("add-item").addEventListener("click", () => openEditor(view));
get("cancel-edit").addEventListener("click", () => editor.close());
get("previous").addEventListener("click", () => changePeriod(-1));
get("current").addEventListener("click", () => changePeriod(0));
get("next").addEventListener("click", () => changePeriod(1));
render();
