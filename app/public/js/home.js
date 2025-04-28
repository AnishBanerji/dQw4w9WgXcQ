import { AlertManager } from '/public/js/alerts.js'

// Initialize AlertManager and showAlert after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const alertContainer = document.getElementById("alert-container");
  if (alertContainer) {
    // Create instance and attach to window if needed globally
    window.alertManager = new AlertManager(alertContainer);
    // Define showAlert globally
    window.showAlert = (...args) => window.alertManager.newAlert(...args);
    // console.log("AlertManager initialized from home.js."); // Removed unwanted log
  } else {
    console.error("Alert container element not found!");
  }
});

// showAlert will be defined in the HTML after DOMContentLoaded
// window.showAlert = (...args) => alertManager.newAlert(...args)

async function checkLogin() {
  try {
    const res = await fetch('/check_login')
    // We should rely on auto.js and /api/users/@me for login status
    // Remove this function or update endpoint if it's actually needed.
    // For now, commenting out the logic that depends on it.
    /*
    if (res.ok) {
      const data = await res.json()
      if (data.loggedIn) {
        // This logic is now handled by auto.js
        // document.getElementById('loginBtn').style.display = 'none'
        // document.getElementById('registerBtn').style.display = 'none'
        // document.getElementById('logoutBtn').style.display = 'inline-block'
      }
    }
    */
  } catch (e) {
    console.error('Error checking login:', e)
  }
}

// Logout function is defined in home.html now
/*
async function logout() {
  try {
    const res = await fetch('/logout', { method: 'POST' })
    if (res.ok) {
      location.reload()
    } else {
      // Use the globally defined showAlert if available
      if (window.showAlert) window.showAlert('Logout failed.', 'error')
      else alert('Logout failed.')
    }
  } catch (e) {
    console.error(e)
    if (window.showAlert) window.showAlert('Logout error.', 'error')
    else alert('Logout error.')
  }
}
*/

// Remove checkLogin call - rely on auto.js
// checkLogin()
// Remove logout assignment - handled in HTML
// window.logout = logout