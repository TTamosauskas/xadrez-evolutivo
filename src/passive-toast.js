export function createPassiveEffectToastPresenter(
  doc,
  {
    setTimer = (...args) => setTimeout(...args),
    clearTimer = (id) => clearTimeout(id),
    duration = 2600,
    fadeDuration = 180,
    maxVisible = 2,
  } = {},
) {
  const region = doc.getElementById("passive-toasts"),
    queue = [],
    timers = new Map();

  const blocked = () => !!doc.querySelector("dialog[open]");

  function removeToast(toast) {
    const timer = timers.get(toast);
    if (timer !== undefined) clearTimer(timer);
    timers.delete(toast);
    toast.remove();
    flush();
  }

  function present(effect) {
    if (!region || !effect?.text) return;
    const toast = doc.createElement("div");
    toast.className = "passive-toast";
    toast.dataset.effectId = String(effect.id ?? "");
    toast.dataset.trait = effect.trait ?? "";
    toast.textContent = effect.text;
    region.append(toast);
    const timer = setTimer(() => {
      if (!toast.isConnected) return;
      toast.classList.add("leaving");
      const fadeTimer = setTimer(() => removeToast(toast), fadeDuration);
      timers.set(toast, fadeTimer);
    }, duration);
    timers.set(toast, timer);
  }

  function flush() {
    if (!region || blocked()) return;
    while (queue.length && region.children.length < maxVisible)
      present(queue.shift());
  }

  function show(effect) {
    if (!effect?.text) return;
    queue.push(effect);
    flush();
  }

  const dialogs = [...doc.querySelectorAll("dialog")],
    onDialogClose = () => flush();
  for (const dialog of dialogs)
    dialog.addEventListener("close", onDialogClose);

  return {
    show,
    flush,
    pendingCount: () => queue.length,
    destroy() {
      for (const dialog of dialogs)
        dialog.removeEventListener("close", onDialogClose);
      for (const timer of timers.values()) clearTimer(timer);
      timers.clear();
      queue.length = 0;
      region?.replaceChildren();
    },
  };
}
