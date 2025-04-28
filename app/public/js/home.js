import { alertManager } from '/static/alerts.js'

window.showAlert = (...args) => alertManager.newAlert(...args)

async function checkLogin() {
  try {
    const res = await fetch('/check_login')
    if (res.ok) {
      const data = await res.json()
      if (data.loggedIn) {
        document.getElementById('loginBtn').style.display = 'none'
        document.getElementById('registerBtn').style.display = 'none'
        document.getElementById('logoutBtn').style.display = 'inline-block'
      }
    }
  } catch (e) {
    console.error(e)
  }
}

async function logout() {
  try {
    const res = await fetch('/logout', { method: 'POST' })
    if (res.ok) {
      location.reload()
    } else {
      showAlert('Logout failed.', 'error')
    }
  } catch (e) {
    console.error(e)
    showAlert('Logout error.', 'error')
  }
}

checkLogin()
window.logout = logout