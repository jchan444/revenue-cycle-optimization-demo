# Revenue Cycle Optimization – Backend Setup

This project uses **Python + FastAPI** to build the backend API for the Revenue Cycle Optimization system.

The steps below will help you run the backend server locally.

---

# 1. Clone the Repository

Clone the project from GitHub:

git clone <REPO_URL>

Then navigate to the backend folder:

cd revenue-cycle-optimization/backend

---

# 2. Create a Python Virtual Environment

Create a virtual environment to isolate project dependencies:

python3 -m venv .venv

---

# 3. Activate the Virtual Environment

Mac / Linux:

source .venv/bin/activate

Windows:

.venv\Scripts\activate

After activating, your terminal should show:

(.venv)

---

# 4. Install Project Dependencies

Install the required Python packages:

pip install -r requirements.txt

---

# 5. Start the API Server

From the **backend directory**, run:

uvicorn app.main:app --reload

You should see something like:

Uvicorn running on http://127.0.0.1:8000

---

# 6. Open the API

Open a browser and visit:

http://127.0.0.1:8000

FastAPI also automatically generates API documentation:

http://127.0.0.1:8000/docs

---

# 7. Deactivate the Virtual Environment

When you are finished:

deactivate

---

# Notes

Always run the server from the **backend folder**:

cd backend
uvicorn app.main:app --reload

If you run the server from the wrong directory, Python may not be able to find the `app` module.
