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

const avatarInput = document.getElementById('avatar');
const avatarPreview = document.getElementById('avatar-preview');

// Click to open file picker
avatarPreview.addEventListener('click', () => avatarInput.click());

// Show preview when a file is selected
avatarInput.addEventListener('change', () => {
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

  const formData = new FormData();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const avatar = avatarInput.files[0];

  formData.append('username', username);
  if (password) formData.append('password', password);
  if (avatar) formData.append('avatar', avatar);

  try {
    const response = await fetch('/api/user/update', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    showAlert(result.message || 'Settings updated');
  } catch (err) {
    console.error('Error updating settings:', err);
    showAlert('Failed to update settings', 'error');
  }
}

document.getElementById("settings-form").addEventListener("submit", handleSubmit);


lucide.createIcons();
fetchUserSettings();