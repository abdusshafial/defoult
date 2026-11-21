"use strict";

(() => {
  const byId = (key) => document.getElementById(key);
  const night = byId("night");
  const pull = byId("light-pull");
  const welcome = byId("welcome");
  const welcomeAction = byId("welcome-action");
  const panel = byId("login-panel");
  const form = byId("login-form");
  const profileName = byId("profile-name");
  const password = byId("profile-password");
  const submit = byId("login-submit");
  const back = byId("login-back");
  const signOut = byId("sign-out");
  const plannerShell = byId("planner-shell");
  const scene = initNightScene(byId("night-sky"));
  let pointer;
  let record;
  let busy = false;

  function lightLamp() {
    if (night.dataset.lit === "true") return;
    night.dataset.lit = "true";
    pull.setAttribute("aria-pressed", "true");
    byId("night-title").textContent = "আপনার রুটিনে ফিরুন।";
    byId("night-copy").textContent = "রুটিন, সাপ্তাহিক কাজ আর মাসিক খরচ এক জায়গায়।";
    welcomeAction.hidden = false;
    welcome.classList.add("entering");
    welcomeAction.focus({ preventScroll: true });
  }

  pull.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || !event.isPrimary) return;
    pointer = { id: event.pointerId, start: event.clientY, distance: 0 };
    pull.classList.add("dragging");
  });

  window.addEventListener("pointermove", (event) => {
    if (pointer?.id !== event.pointerId) return;
    pointer.distance = Math.max(0, event.clientY - pointer.start);
    pull.style.setProperty("--travel", Math.min(pointer.distance, 48) + "px");
  });

  function endPull(event) {
    if (pointer?.id !== event.pointerId) return;
    const distance = Math.max(pointer.distance, event.clientY - pointer.start);
    pointer = undefined;
    pull.classList.remove("dragging");
    pull.style.removeProperty("--travel");
    if (event.type === "pointerup" && distance >= 22) lightLamp();
  }

  window.addEventListener("pointerup", endPull);
  window.addEventListener("pointercancel", endPull);
  window.addEventListener("blur", () => {
    if (pointer) endPull({ pointerId: pointer.id, clientY: pointer.start, type: "pointercancel" });
  });
  pull.addEventListener("click", lightLamp);
  pull.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    lightLamp();
  });

  function message(text) {
    const error = byId("login-error");
    error.textContent = text;
    error.hidden = !text;
  }

  function openLogin() {
    welcome.hidden = true;
    panel.hidden = false;
    panel.classList.add("entering");
    message("");
    form.reset();
    submit.disabled = true;
    try {
      record = plannerVault.getRecord();
      const existing = Boolean(record);
      byId("login-title").textContent = existing ? "লগইন করুন" : "প্রোফাইল তৈরি করুন";
      byId("account-copy").textContent = existing ?
        "এই ব্রাউজারে সেভ করা রুটিন খুলতে পাসওয়ার্ড দিন।" :
        "এই ব্রাউজারের জন্য কমপক্ষে ৮ অক্ষরের একটি পাসওয়ার্ড দিন।";
      profileName.readOnly = existing;
      profileName.value = record?.data.name ?? "";
      password.autocomplete = existing ? "current-password" : "new-password";
      password.minLength = existing ? 1 : 8;
      byId("restore-label").hidden = existing || !plannerVault.hasLegacy();
      submit.textContent = existing ? "লগইন করুন" : "প্রোফাইল তৈরি করুন";
      if (!globalThis.crypto?.subtle) {
        message("লগইনের জন্য সাইটটি নিরাপদ HTTPS ঠিকানায় খুলুন।");
        return;
      }
      submit.disabled = false;
      (existing ? password : profileName).focus();
    } catch {
      byId("login-title").textContent = "প্রোফাইল খুলুন";
      message("এই ব্রাউজারের সেভ করা প্রোফাইল পড়া যাচ্ছে না।");
    }
  }

  back.addEventListener("click", () => {
    if (busy) return;
    form.reset();
    panel.hidden = true;
    panel.classList.remove("entering");
    welcome.hidden = false;
    welcomeAction.focus();
  });
  welcomeAction.addEventListener("click", openLogin);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || submit.disabled) return;
    const name = profileName.value.trim();
    const secret = password.value;
    if (!record && (name.length < 2 || secret.length < 8)) {
      message("অন্তত ২ অক্ষরের নাম এবং ৮ অক্ষরের পাসওয়ার্ড দিন।");
      return;
    }
    busy = true;
    submit.disabled = back.disabled = true;
    message("");
    try {
      const migrate = !byId("restore-label").hidden && byId("restore-data").checked;
      const access = record ? await plannerVault.unlock(record, secret) : await plannerVault.create(name, secret, migrate);
      beginPlannerSession(access);
      form.reset();
      night.hidden = true;
      scene.stop();
      plannerShell.hidden = false;
      byId("page-title").focus();
      window.scrollTo(0, 0);
    } catch (error) {
      message(record && error.name === "OperationError" ?
        "পাসওয়ার্ড মিলছে না। আবার চেষ্টা করুন।" :
        "প্রোফাইল খোলা যাচ্ছে না। এই ব্রাউজারে সাইটের তথ্য সেভ করা যাচ্ছে কি না দেখুন।");
      password.select();
    } finally {
      busy = false;
      submit.disabled = back.disabled = false;
    }
  });

  signOut.addEventListener("click", async () => {
    signOut.disabled = true;
    try {
      await endPlannerSession();
    } catch {
      byId("storage-notice").hidden = false;
      if (!window.confirm("শেষ পরিবর্তন সেভ হয়নি। তবুও লগআউট করবেন?")) {
        signOut.disabled = false;
        return;
      }
      clearPlannerSession();
    }
    plannerShell.hidden = true;
    panel.hidden = true;
    panel.classList.remove("entering");
    welcome.hidden = false;
    welcome.classList.remove("entering");
    welcomeAction.hidden = true;
    night.dataset.lit = "false";
    pull.setAttribute("aria-pressed", "false");
    byId("night-title").textContent = "ল্যাম্পটা জ্বালান।";
    byId("night-copy").textContent = "দড়ি ধরে নিচের দিকে টানুন বা দড়িতে ট্যাপ করুন।";
    night.hidden = false;
    scene.start();
    pull.focus({ preventScroll: true });
    window.scrollTo(0, 0);
    signOut.disabled = false;
  });

  scene.start();
})();
