export function createPassiveEffectToastPresenter(
  doc,
  { toastify = globalThis.Toastify, duration = 6000, maxVisible = 2 } = {},
) {
  const queue = [],
    visible = new Set(),
    dialogs = [...doc.querySelectorAll("dialog")];
  let destroyed = false;

  if (typeof toastify !== "function")
    throw new Error("Toastify precisa estar carregado antes da aplicação.");

  const blocked = () => !!doc.querySelector("dialog[open]");

  function present(effect) {
    let toast;
    toast = toastify({
      text: effect.text,
      duration,
      close: true,
      gravity: "top",
      position: "center",
      stopOnFocus: true,
      escapeMarkup: true,
      ariaLive: "polite",
      className: `xe-passive-toast xe-passive-toast--${
        effect.owner === "amber" ? "black" : "white"
      }`,
      offset: {
        x: 0,
        y: "calc(env(safe-area-inset-top, 0px) + 8px)",
      },
      callback: () => {
        visible.delete(toast);
        if (!destroyed) flush();
      },
    }).showToast();

    visible.add(toast);
    if (toast.toastElement) {
      toast.toastElement.dataset.effectId = String(effect.id ?? "");
      toast.toastElement.dataset.trait = effect.trait ?? "";
      toast.toastElement.dataset.owner = effect.owner ?? "blue";
      toast.toastElement.setAttribute("role", "status");
      toast.toastElement
        .querySelector(".toast-close")
        ?.setAttribute("aria-label", "Fechar notificação");
    }
  }

  function flush() {
    if (destroyed || blocked()) return;
    while (queue.length && visible.size < maxVisible) present(queue.shift());
  }

  function show(effect) {
    if (destroyed || !effect?.text) return;
    queue.push(effect);
    flush();
  }

  const onDialogClose = () => flush();
  for (const dialog of dialogs) dialog.addEventListener("close", onDialogClose);

  return {
    show,
    flush,
    pendingCount: () => queue.length,
    visibleCount: () => visible.size,
    destroy() {
      destroyed = true;
      for (const dialog of dialogs)
        dialog.removeEventListener("close", onDialogClose);
      queue.length = 0;
      for (const toast of visible) toast.hideToast?.();
      visible.clear();
    },
  };
}
