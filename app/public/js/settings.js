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

const avatarInput = document.getElementById("avatar");
const avatarPreview = document.getElementById("avatar-preview");

// Click to open file picker
avatarPreview.addEventListener("click", () => avatarInput.click());

// Show preview when a file is selected
avatarInput.addEventListener("change", () => {
  const file = avatarInput.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      avatarPreview.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
});

// Handle form submission
async function handleSubmit(event) {
  event.preventDefault();

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  const avatar = avatarInput.files[0];

  // First call: Send username/password via x-www-form-urlencoded
  const urlEncodedData = new URLSearchParams();
  urlEncodedData.append("username", username);
  if (password) urlEncodedData.append("password", password);

  try {
    const settingsResponse = await fetch("/api/user/settings", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: urlEncodedData,
    });

    if (!settingsResponse.ok) {
      const errorText = await settingsResponse.text();
      alertManager.newAlert(errorText, "error", 5000, "Settings Update Error");
      return;
    }
  } catch (err) {
    console.error("Error updating basic settings:", err);
    showAlert("Failed to update settings", "error");
    return;
  }

  // Second call: Send avatar (if present) via FormData
  if (avatar) {
    const formData = new FormData();
    formData.append("avatar", avatar);

    try {
      const avatarResponse = await fetch("/api/user/update", {
        method: "POST",
        body: formData,
      });

      const result = await avatarResponse.json();

      if (!avatarResponse.ok) {
        alertManager.newAlert(result.message || "Avatar update failed", "error", 5000, "Avatar Error");
        return;
      }

      showAlert(result.message || "Settings updated");
    } catch (err) {
      console.error("Error uploading avatar:", err);
      showAlert("Failed to upload avatar", "error");
    }
  } else {
    showAlert("Settings updated");
  }
}

document.getElementById("settings-form").addEventListener("submit", handleSubmit);

lucide.createIcons();
fetchUserSettings();
