async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) {
    throw new Error("Copy failed");
  }
}

function announceCopyStatus(message) {
  const status = document.getElementById("copy-status");
  if (!status || !message) return;

  // Clear first so repeated actions with the same text are announced.
  status.textContent = "";
  window.setTimeout(() => {
    status.textContent = message;
  }, 0);
}

function getPromptCode(element) {
  return element.closest(".prompt-card")?.querySelector("code") ?? null;
}

function getCopiedLabel(element) {
  return element.closest(".prompt-card")?.querySelector(".copy-button")?.dataset.copiedLabel || "Copied";
}

function getCopyFailedLabel() {
  return document.getElementById("copy-status")?.dataset.copyFailedLabel || "Copy failed";
}

function shouldSkipAiServiceNotice(container) {
  const key = container.dataset.storageKey;
  if (!key) return false;

  try {
    return window.localStorage.getItem(key) === "true";
  } catch (error) {
    console.warn("Could not read AI service notice preference", error);
    return false;
  }
}

function saveSkipAiServiceNotice(container) {
  const key = container.dataset.storageKey;
  if (!key) return;

  try {
    window.localStorage.setItem(key, "true");
  } catch (error) {
    console.warn("Could not save AI service notice preference", error);
  }
}

function resetAiServiceNotice(container) {
  const notice = container.querySelector("[data-ai-service-notice]");
  if (notice) notice.hidden = true;

  container.querySelectorAll("[data-ai-service-button]").forEach((button) => {
    button.setAttribute("aria-expanded", "false");
  });

  delete container.dataset.selectedServiceUrl;
  delete container.dataset.selectedServiceLabel;
}

function showAiServiceNotice(container, serviceButton) {
  const notice = container.querySelector("[data-ai-service-notice]");
  const confirmButton = container.querySelector("[data-ai-service-confirm]");
  const skipCheckbox = container.querySelector("[data-ai-service-skip]");
  if (!notice || !confirmButton) return;

  container.querySelectorAll("[data-ai-service-button]").forEach((button) => {
    button.setAttribute("aria-expanded", button === serviceButton ? "true" : "false");
  });

  const serviceLabel = serviceButton.dataset.serviceLabel || "";
  container.dataset.selectedServiceUrl = serviceButton.dataset.serviceUrl || "";
  container.dataset.selectedServiceLabel = serviceLabel;

  const template = container.dataset.continueTemplate || "Continue to {service}";
  confirmButton.textContent = template.replace("{service}", serviceLabel);
  if (skipCheckbox) skipCheckbox.checked = false;

  notice.hidden = false;
  confirmButton.focus();
}

function openServiceWindow(url) {
  const serviceWindow = window.open("about:blank", "_blank");
  if (!serviceWindow) return null;

  serviceWindow.opener = null;
  serviceWindow.location.replace(url);
  return serviceWindow;
}

async function handleDirectAiServiceOpen(container, serviceButton) {
  // Open synchronously while the browser still considers this a user gesture.
  const serviceWindow = window.open("about:blank", "_blank");
  if (!serviceWindow) {
    announceCopyStatus(container.dataset.openFailedLabel || "Could not open service");
    return;
  }
  serviceWindow.opener = null;

  const code = getPromptCode(serviceButton);
  if (!code) {
    serviceWindow.close();
    return;
  }

  try {
    await copyText(code.textContent ?? "");
    announceCopyStatus(getCopiedLabel(serviceButton));
    serviceWindow.location.replace(serviceButton.dataset.serviceUrl || "about:blank");
  } catch (error) {
    serviceWindow.close();
    console.error("Could not copy prompt", error);
    announceCopyStatus(getCopyFailedLabel());
  }
}

document.addEventListener("click", async (event) => {
  const copyButton = event.target.closest(".copy-button");
  if (copyButton) {
    const code = getPromptCode(copyButton);
    if (!code) return;

    try {
      await copyText(code.textContent ?? "");
      const copiedLabel = copyButton.dataset.copiedLabel || "Copied";
      copyButton.textContent = copiedLabel;
      announceCopyStatus(copiedLabel);

      window.setTimeout(() => {
        copyButton.textContent = copyButton.dataset.copyLabel || "Copy";
      }, 2000);
    } catch (error) {
      console.error("Could not copy prompt", error);
      announceCopyStatus(getCopyFailedLabel());
    }
    return;
  }

  const serviceButton = event.target.closest("[data-ai-service-button]");
  if (serviceButton) {
    const container = serviceButton.closest("[data-ai-service-container]");
    const code = getPromptCode(serviceButton);
    if (!container || !code) return;

    if (shouldSkipAiServiceNotice(container)) {
      await handleDirectAiServiceOpen(container, serviceButton);
      return;
    }

    try {
      await copyText(code.textContent ?? "");
      announceCopyStatus(getCopiedLabel(serviceButton));
      showAiServiceNotice(container, serviceButton);
    } catch (error) {
      console.error("Could not copy prompt", error);
      announceCopyStatus(getCopyFailedLabel());
    }
    return;
  }

  const confirmButton = event.target.closest("[data-ai-service-confirm]");
  if (confirmButton) {
    const container = confirmButton.closest("[data-ai-service-container]");
    if (!container) return;

    const url = container.dataset.selectedServiceUrl;
    if (!url) return;

    const skipCheckbox = container.querySelector("[data-ai-service-skip]");
    if (skipCheckbox?.checked) {
      saveSkipAiServiceNotice(container);
    }

    const opened = openServiceWindow(url);
    if (!opened) {
      announceCopyStatus(container.dataset.openFailedLabel || "Could not open service");
      return;
    }

    resetAiServiceNotice(container);
  }
});

function updateFixedFooterSpace() {
  const footer = document.querySelector(".site-footer");
  if (!footer) return;
  document.documentElement.style.setProperty(
    "--fixed-footer-height",
    `${Math.ceil(footer.getBoundingClientRect().height)}px`
  );
}

window.addEventListener("load", updateFixedFooterSpace);
window.addEventListener("resize", updateFixedFooterSpace);

if ("ResizeObserver" in window) {
  const footer = document.querySelector(".site-footer");
  if (footer) {
    new ResizeObserver(updateFixedFooterSpace).observe(footer);
  }
}
