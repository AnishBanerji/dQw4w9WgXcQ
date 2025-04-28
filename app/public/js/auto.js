document.addEventListener('DOMContentLoaded', function() {
    const userStatusDiv = document.getElementById('user-status');

    if (userStatusDiv) {
        fetch('/api/users/@me')
            .then(response => {
                if (response.ok) {
                    return response.json();
                } else {
                    // Not logged in or error
                    throw new Error('Not logged in');
                }
            })
            .then(data => {
                // User is logged in
                userStatusDiv.innerHTML = `
                    <span>Logged in as: <strong>${escapeHTML(data.username)}</strong></span>
                    <a href="/logout" class="auth-button">Logout</a>
                `;
            })
            .catch(error => {
                // User is not logged in
                userStatusDiv.innerHTML = `
                    <a href="/login" class="auth-button">Login</a>
                    <a href="/register" class="auth-button">Register</a>
                `;
                console.log('User not logged in or API error:', error.message);
            });
    }
});

// Simple HTML escaping function to prevent XSS
function escapeHTML(str) {
    return str.replace(/[&<>'"/]/g, function (s) {
        const entityMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
            '/': '&#x2F;'
        };
        return entityMap[s];
    });
}
