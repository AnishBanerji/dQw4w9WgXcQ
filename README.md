# Within Us (CSE 312 Project)

A real-time multiplayer game inspired by Among Us, built for CSE 312. Players join a room, move around a map, complete tasks (if Crew), or eliminate other players (if Killer), all updated in real-time using WebSockets.

## Features

*   **User Authentication:** Secure user registration and login system.
    *   Passwords salted and hashed using bcrypt.
    *   Session persistence using HttpOnly cookies with hashed tokens stored in the database.
*   **Real-time Multiplayer:** Multiple players can interact in the same game instance simultaneously.
*   **WebSocket Communication:** Player movements and game events are broadcast in real-time using Socket.IO.
*   **Game Mechanics:**
    *   Continuous player movement (WASD controls).
    *   Visible player characters and usernames.
    *   Task system for Crewmates.
    *   Killing mechanic for the designated Killer (Space bar).
    *   Clear win conditions (all tasks completed or Killer eliminates Crew).
*   **Dockerized:** Runs fully within Docker containers using Docker Compose.
*   **Logging:** Server requests (IP, method, path, timestamp) are logged to a file (`./logs/requests.log`).

## Tech Stack

*   **Backend:** Python, Flask, Flask-SocketIO, Flask-Limiter
*   **Database:** MongoDB (via pymongo)
*   **Frontend:** HTML, CSS, JavaScript, Socket.IO Client, Canvas API
*   **Containerization:** Docker, Docker Compose
*   **Password Hashing:** bcrypt
*   **Environment Variables:** python-dotenv

## Setup and Running

### Running Locally (for Development)

1.  **Prerequisites:**
    *   Docker ([Install Docker](https://docs.docker.com/get-docker/))
    *   Docker Compose ([Install Docker Compose](https://docs.docker.com/compose/install/))
2.  **Clone the Repository:**
    ```bash
    git clone <your-repo-url>
    cd <your-repo-directory>
    ```
3.  **Environment File:**
    *   Ensure a file named `.env` exists in the root directory (we created one for you).
    *   It should contain the MongoDB connection string using the service name `mongo`:
        ```dotenv
        # .env
        MONGO_URI=mongodb://mongo:27017/within_us_db
        FLASK_SECRET_KEY=your_very_secret_flask_key # Add a strong, random secret key here
        ```
    *   **Important:** Generate a strong, random `FLASK_SECRET_KEY`. Do *not* commit your `.env` file to version control. Add `.env` to your `.gitignore` file if it's not already there. We bypassed this step for demo purposes for grading
4.  **Run with Docker Compose (Local):**
    *   This uses `docker-compose.local.yml` which sets up an HTTP-only environment using a local Nginx configuration.
    ```bash
    docker compose -f docker-compose.local.yml up --build
    ```
    *   The `--build` flag ensures the image is built. Omit it for subsequent runs.
5.  **Access the App:**
    *   Open your web browser and navigate to `http://localhost`.

### Running in Production (Deployment)

1.  **Prerequisites:**
    *   Docker and Docker Compose installed on the server.
    *   A domain name pointing to your server's IP address.
    *   Nginx installed **on the host server** initially to obtain SSL certificates using Certbot (or your preferred method).
    *   Let's Encrypt (Certbot) or other SSL certificates obtained for your domain.
2.  **Server Configuration:**
    *   Ensure your Nginx configuration file for the site (e.g., `/etc/nginx/sites-available/your_domain.com`) exists on the server.
    *   This file **must** be configured for HTTPS, include the paths to your SSL certificates (e.g., `/etc/letsencrypt/live/your_domain.com/...`), and correctly proxy requests to the `myapp` service:
        ```nginx
        # Example snippet for the server block in /etc/nginx/sites-available/your_domain.com
        server {
            listen 80;
            server_name your_domain.com;
            # Redirect HTTP to HTTPS
            location / { 
                return 301 https://$host$request_uri;
            }
        }

        server {
            listen 443 ssl http2;
            server_name your_domain.com;

            ssl_certificate /etc/letsencrypt/live/your_domain.com/fullchain.pem; # Adjust path
            ssl_certificate_key /etc/letsencrypt/live/your_domain.com/privkey.pem; # Adjust path
            include /etc/letsencrypt/options-ssl-nginx.conf; # Certbot's recommended SSL options
            ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # Certbot's recommended DH params

            location / {
                proxy_pass http://myapp:8080; # Proxy to the Flask app service
                proxy_http_version 1.1;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header Connection "upgrade";
                proxy_set_header Host $host;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                proxy_set_header X-Forwarded-Proto $scheme;
                proxy_read_timeout 86400; # Optional: Increase timeout for long connections
            }
        }
        ```
    *   Ensure the Let's Encrypt certificates and dhparams file exist at the specified paths on the server.
3.  **Stop Host Nginx:**
    *   Since Docker Compose will run Nginx in a container using ports 80 and 443, you **must stop and disable** the Nginx service running directly on the host machine to avoid port conflicts.
    ```bash
    sudo systemctl stop nginx
    sudo systemctl disable nginx # Prevent it from starting on boot
    ```
4.  **Deploy Code:**
    *   Copy your entire project directory (including `docker-compose.yml` and `.env`) to your server.
5.  **Run with Docker Compose (Production):**
    *   Navigate to your project directory on the server.
    *   This uses the default `docker-compose.yml` file, which is configured for production (HTTPS, server paths for Nginx config/certs).
    ```bash
    docker compose up --build -d
    ```
    *   The `-d` flag runs the containers in detached mode (in the background).
6.  **Access the App:**
    *   Open your web browser and navigate to `https://unknown1.cse312.dev/`.

## Game Instructions

*   **Movement:** Use `

# ... potentially more instructions ...