"use strict";

const weekdays = ["সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার", "রবিবার"];
const categories = ["বাজার", "খাবার", "বাসাভাড়া", "বিল", "যাতায়াত", "ঘর ও ব্যক্তিগত", "অন্যান্য"];
const dayParts = [
  { name: "সকাল", symbol: "☀", theme: "morning", end: "12:00" },
  { name: "দুপুর", symbol: "◒", theme: "midday", end: "16:00" },
  { name: "বিকেল", symbol: "◐", theme: "afternoon", end: "19:00" },
  { name: "রাত", symbol: "☾", theme: "night", end: "24:00" }
];
const sampleDay = [
  ["07:00", "ঘুম থেকে উঠে পানি পান ও ফ্রেশ হওয়া"],
  ["07:15", "বিছানা গুছিয়ে একটু হাঁটা বা ব্যায়াম"],
  ["07:45", "নাশতা তৈরি করে খাওয়া"],
  ["08:20", "কাজ, পড়াশোনা বা চাকরির আবেদনের প্রস্তুতি"],
  ["12:45", "দুপুরের খাবার খাওয়া"],
  ["13:10", "থালাবাসন ধুয়ে একটু বিরতি"],
  ["17:30", "হাঁটা, বিশ্রাম বা পরিবারের সঙ্গে কথা বলা"],
  ["18:30", "চাল-ডাল, ডিম বা সবজির মজুত দেখা"],
  ["19:45", "রাতের রান্না ও খাবার"],
  ["20:30", "রান্নাঘর পরিষ্কার ও ময়লা ফেলা"],
  ["21:45", "আগামীকালের কাজ ও পোশাক গুছিয়ে রাখা"],
  ["22:45", "ঘুমের প্রস্তুতি ও বিছানায় যাওয়া"]
];
const sampleWeek = [
  [0, "সপ্তাহের খাবারের পরিকল্পনা করা"],
  [2, "কাপড় ধোয়া ও শুকাতে দেওয়া"],
  [4, "বাজার করা ও রান্নার উপকরণ প্রস্তুত করা"],
  [4, "বাথরুম ও ঘর পরিষ্কার করা"],
  [5, "বিছানার চাদর ও তোয়ালে বদলানো"],
  [6, "খরচ, বাসাভাড়া ও বিলের তারিখ দেখা"]
];
const number = new Intl.NumberFormat("bn-BD");
const amount = new Intl.NumberFormat("bn-BD", { maximumFractionDigits: 2 });
const fullDate = new Intl.DateTimeFormat("bn-BD", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const shortDate = new Intl.DateTimeFormat("bn-BD", { day: "numeric", month: "short" });
const monthDate = new Intl.DateTimeFormat("bn-BD", { month: "long", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("bn-BD", { hour: "numeric", minute: "2-digit", hour12: true });
const moneyLabel = (cents) => "৳" + amount.format(cents / 100);
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const monthPattern = /^\d{4}-\d{2}$/;
const maxAmount = 9999999999;

function dayKey(date) {
  return [String(date.getFullYear()).padStart(4, "0"), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function dateFrom(key) {
  return new Date(key + "T12:00:00");
}

function validDate(key) {
  return typeof key === "string" && datePattern.test(key) && dayKey(dateFrom(key)) === key;
}

function changeDay(key, delta) {
  const date = dateFrom(key);
  date.setDate(date.getDate() + delta);
  return dayKey(date);
}

function monday(key) {
  const offset = (dateFrom(key).getDay() + 6) % 7;
  return changeDay(key, -offset);
}

function changeMonth(key, delta) {
  const date = dateFrom(key + "-01");
  date.setMonth(date.getMonth() + delta);
  return dayKey(date).slice(0, 7);
}

function parseMoney(input) {
  const normalized = input.trim().replace(/[০-৯]/g, (digit) => String("০১২৩৪৫৬৭৮৯".indexOf(digit))).replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fractional = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(fractional.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 && cents <= maxAmount ? cents : null;
}

function formatRoutineTime(time) {
  return timeFormat.format(new Date("2000-01-01T" + time + ":00"));
}

function initialPlanner() {
  return {
    version: 1,
    daily: sampleDay.map(([time, title], index) => ({ id: "daily-" + index, time, title })),
    weekly: sampleWeek.map(([day, title], index) => ({ id: "weekly-" + index, day, title })),
    completed: { daily: {}, weekly: {} },
    expenses: [],
    budgets: {}
  };
}

function monthExpenses(state, key) {
  return state.expenses.filter((entry) => entry.date.slice(0, 7) === key).sort((a, b) => b.date.localeCompare(a.date));
}

function expenseTotal(expenses) {
  return expenses.reduce((total, entry) => total + entry.cents, 0);
}

function routineCheckList(state, type, key) {
  return state.completed[type][key] ?? [];
}

function updateRoutineCheck(state, type, key, id, checked) {
  const previous = routineCheckList(state, type, key);
  const updated = checked ? [...new Set([...previous, id])] : previous.filter((item) => item !== id);
  if (updated.length) {
    state.completed[type][key] = updated;
  } else {
    delete state.completed[type][key];
  }
}

function readPlanner(raw) {
  const fallback = initialPlanner();
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1) return fallback;
    function hasContent(item) {
      return item && typeof item.id === "string" && typeof item.title === "string";
    }
    function validChecks(table) {
      return Object.fromEntries(Object.entries(table ?? {}).filter(([key, ids]) => datePattern.test(key) && Array.isArray(ids)));
    }
    return {
      version: 1,
      daily: Array.isArray(parsed.daily) ? parsed.daily.filter((item) => hasContent(item) && timePattern.test(item.time)) : fallback.daily,
      weekly: Array.isArray(parsed.weekly) ? parsed.weekly.filter((item) => hasContent(item) && Number.isInteger(item.day) && item.day >= 0 && item.day < weekdays.length) : fallback.weekly,
      completed: { daily: validChecks(parsed.completed?.daily), weekly: validChecks(parsed.completed?.weekly) },
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses.filter((item) => item && typeof item.id === "string" &&
        validDate(item.date) && categories.includes(item.category) && typeof item.note === "string" &&
        Number.isSafeInteger(item.cents) && item.cents > 0 && item.cents <= maxAmount) : [],
      budgets: Object.fromEntries(Object.entries(parsed.budgets ?? {}).filter(([key, cents]) =>
        monthPattern.test(key) && Number.isSafeInteger(cents) && cents > 0 && cents <= maxAmount))
    };
  } catch {
    return fallback;
  }
}
