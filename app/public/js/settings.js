let storedUserSettings;

async function fetchUserSettings() {
  try {
    const response = await fetch("/api/users/@me");

    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }

    if (!response.ok) {
      const errorText = await response.text();
      alertManager.newAlert(errorText, "error", 5000, "Settings Error");
      return;
    }

    const body = await response.json();
    storedUserSettings = body;

    if (body.username) {
      document.getElementById("username").value = body.username;
    }

    if (body.avatar_url) {
      document.getElementById("avatar-preview").src = body.avatar_url;
    }
  } catch {
    alertManager.newAlert(
      "Failed to fetch user settings. Please try again.",
      "error",
      5000,
      "Settings Error"
    );
  }
}

async function handleSubmit(event) {
  event.preventDefault();

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  const formData = new URLSearchParams();
  formData.append("username", username);
  formData.append("password", password);

  try {
    const response = await fetch("/api/users/settings", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      alertManager.newAlert(errorText, "error", 5000, "Settings Update Error");
      return;
    }

    window.location.reload();
  } catch {
    alertManager.newAlert(
      "Failed to update settings. Please try again.",
      "error",
      5000,
      "Settings Error"
    );
  }
}

/* 2FA Functionality - Commented out as HTML elements are missing
const dialog = document.getElementById("twoFactorDialog");
const enable2faBtn = document.getElementById("enable2fa");
const closeDialogBtn = document.getElementById("closeDialog");
const doneButton = document.getElementById("doneButton");
const qrCodeImg = document.getElementById("qrCode");
const secretCodeElement = document.getElementById("secretCode");

enable2faBtn.addEventListener("click", async () => {
  const response = await fetch("/api/totp/enable", { method: "POST" });
  const totpBody = await response.json();

  if (!response.ok || !totpBody.secret) {
    alertManager.newAlert(
      "Failed to enable 2FA. Either request failed, or no secret was returned",
      "error",
      10000,
      "2FA Enable Failed"
    );
    return;
  }

  if (!storedUserSettings || !storedUserSettings.username) {
    alertManager.newAlert(
      "Could not find username in user settings. Is your /api/users/@me endpoint working?",
      "error",
      10000,
      "2FA Enable Failed"
    );
    return;
  }

  const secret = totpBody.secret;
  const otpauthUrl = `otpauth://totp/312site:${encodeURIComponent(
    `${storedUserSettings.username}@312site.com`
  )}?secret=${secret}&issuer=YourApp`;

  qrCodeImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    otpauthUrl
  )}`;
  secretCodeElement.textContent = secret;

  dialog.classList.remove("hidden");
});

function closeDialog() {
  dialog.classList.add("hidden");
}

closeDialogBtn.addEventListener("click", closeDialog);
doneButton.addEventListener("click", closeDialog);
*/

document.getElementById("avatar-preview").addEventListener("click", () => {
  document.getElementById("avatar").click();
});

document.getElementById("avatar")?.addEventListener("change", function (event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      document.getElementById("avatar-preview").src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
});

lucide.createIcons();
fetchUserSettings();