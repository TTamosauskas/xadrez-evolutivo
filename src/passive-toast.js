export function createPassiveEffectToastPresenter(
  doc,
  {
    toastify = globalThis.Toastify,
    duration = -1,
    repeatMutationDuration = 5000,
    maxVisible = 4,
    onSelect = null,
  } = {},
) {
  const queue = [],
    visible = new Set(),
    dialogs = [...doc.querySelectorAll("dialog")];
  let destroyed = false;

  if (typeof toastify !== "function")
    throw new Error("Toastify precisa estar carregado antes da aplicação.");

  const blocked = () => !!doc.querySelector("dialog[open]");

  function enableSwipeDismiss(element, dismiss) {
    let drag = null;
    const baseTransform = element.style.transform || "",
      win = doc.defaultView ?? globalThis.window;

    const reset = () => {
      element.classList.remove("xe-passive-toast--dragging");
      element.style.transform = baseTransform;
      element.style.opacity = "";
    };

    const matchesPointer = (event) =>
      drag &&
      (drag.pointerId === undefined ||
        event.pointerId === undefined ||
        drag.pointerId === event.pointerId);

    element.addEventListener("pointerdown", (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      if (event.target?.closest?.("button, a")) return;
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        dx: 0,
      };
      element.setPointerCapture?.(event.pointerId);
    });

    element.addEventListener("pointermove", (event) => {
      if (!matchesPointer(event)) return;
      drag.dx = event.clientX - drag.startX;
      if (Math.abs(drag.dx) < 4) return;
      event.preventDefault();
      element.classList.add("xe-passive-toast--dragging");
      element.style.transform =
        `${baseTransform} translateX(${drag.dx}px)`.trim();
      const width =
        element.getBoundingClientRect?.().width || element.offsetWidth || 288;
      element.style.opacity = String(
        Math.max(0.35, 1 - Math.abs(drag.dx) / Math.max(width, 1)),
      );
    });

    const finish = (event, cancelled = false) => {
      if (!matchesPointer(event)) return;
      const dx = drag.dx,
        width =
          element.getBoundingClientRect?.().width || element.offsetWidth || 288,
        threshold = Math.max(64, Math.min(120, width * 0.25));
      element.releasePointerCapture?.(event.pointerId);
      drag = null;

      if (!cancelled && Math.abs(dx) >= threshold) {
        const direction = dx < 0 ? -1 : 1,
          viewport = win?.innerWidth || width,
          exitDistance = Math.max(viewport, width * 1.4);
        element.classList.remove("xe-passive-toast--dragging");
        element.style.transform =
          `${baseTransform} translateX(${direction * exitDistance}px)`.trim();
        element.style.opacity = "0";
        dismiss();
        return;
      }
      reset();
    };

    element.addEventListener("pointerup", (event) => finish(event));
    element.addEventListener("pointercancel", (event) => finish(event, true));
  }

  function present(effect) {
    let toast;
    const selectable = typeof onSelect === "function" && !!effect?.trait,
      timed =
        !!effect?.repeatedMutation &&
        Number.isFinite(repeatMutationDuration) &&
        repeatMutationDuration > 0,
      toastDuration = timed ? repeatMutationDuration : duration,
      dismiss = () => toast?.hideToast?.(),
      activate = () => {
        if (!selectable) return;
        onSelect(effect);
        dismiss();
      };

    toast = toastify({
      text: effect.text,
      duration: toastDuration,
      close: false,
      gravity: "top",
      position: "center",
      stopOnFocus: !timed,
      escapeMarkup: true,
      ariaLive: "polite",
      className: `xe-passive-toast xe-passive-toast--${
        effect.owner === "amber" ? "black" : "white"
      }${timed ? " xe-passive-toast--timed" : ""}`,
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
      const element = toast.toastElement;
      element.dataset.effectId = String(effect.id ?? "");
      element.dataset.trait = effect.trait ?? "";
      element.dataset.owner = effect.owner ?? "blue";
      element.dataset.repeatedMutation = timed ? "true" : "false";
      element.setAttribute("role", "status");

      const close = doc.createElement("button");
      close.type = "button";
      close.className = "toast-dismiss";
      close.setAttribute("aria-label", "Fechar notificação");
      close.addEventListener("click", (event) => {
        event.stopPropagation();
        dismiss();
      });
      element.insertAdjacentElement("afterbegin", close);

      if (selectable) {
        const more = doc.createElement("button");
        more.type = "button";
        more.className = "toast-more";
        more.textContent = "SAIBA MAIS";
        more.setAttribute(
          "aria-label",
          `Saiba mais sobre ${effect.trait}`,
        );
        more.addEventListener("click", (event) => {
          event.stopPropagation();
          activate();
        });
        element.append(more);
      }

      if (timed) {
        const progress = doc.createElement("span");
        progress.className = "toast-progress";
        progress.setAttribute("aria-hidden", "true");
        progress.style.setProperty(
          "--xe-toast-progress-duration",
          `${repeatMutationDuration}ms`,
        );
        element.append(progress);
      }

      enableSwipeDismiss(element, dismiss);
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
