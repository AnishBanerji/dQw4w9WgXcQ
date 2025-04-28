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

## Setup and Running Locally

1.  **Prerequisites:**
    *   Docker ([Install Docker](https://docs.docker.com/get-docker/))
    *   Docker Compose ([Install Docker Compose](https://docs.docker.com/compose/install/))
2.  **Clone the Repository:**
    ```bash
    git clone <your-repo-url>
    cd <your-repo-directory>
    ```
3.  **Create Environment File:**
    *   Create a file named `.env` in the root directory of the project. We did this for you!
    *   Add the MongoDB connection string for the Docker service. The default service name is `mongo`.
        ```dotenv
        # .env
        MONGO_URI=mongodb://mongo:27017/within_us_db
        ```
    *   **Important:** Do *not* commit your `.env` file to version control. Add `.env` to your `.gitignore` file if it's not already there. We bypassed this step for demo purposes for grading
4.  **Run with Docker Compose:**
    ```bash
    docker compose up --build
    ```
    *   The `--build` flag ensures the image is built if it doesn't exist or if the Dockerfile/context has changed. You can omit it for subsequent runs.
5.  **Access the App:**
    *   Open your web browser and navigate to `http://localhost:8080`.

## Game Instructions

*   **Movement:** Use `WASD` keys to move your character.
*   **Action (Space Bar):**
    *   **Crewmate:** Press `Space` near a task location (yellow highlight) to attempt completing it.
    *   **Killer:** Press `Space` near another player to attempt an elimination.

## Deployment

This application includes configuration for deployment:
*   The WebSocket connection automatically switches between `ws://` (local HTTP) and `wss://` (deployed HTTPS).
*   The `docker-compose.yml` file correctly avoids exposing the MongoDB port publicly.

**Deployed Application URL:**

https://unknown2.cse312.dev
