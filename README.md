# Riselab Dynamic QR Attendance

A secure, high-concurrency attendance system built with Node.js, Express, and SQLite. Features a dynamic QR code that prevents screenshot sharing by utilizing a claim-on-scan token architecture.

### Features
- **Dynamic QR Code**: Generates a fast-refreshing cryptographic token.
- **Pre-Claim Architecture**: Mobile devices silently claim the token the split-second the page loads, preventing anyone else from using that same QR instance (e.g. from a screenshot).
- **Admin Dashboard**: Live auto-updating datatable of attendees at `/admin.html`.
- **CSV Export**: Instantly download the SQLite database to a spreadsheet.

## Local Deployment

1. Install Node.js
2. Clone this repository
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run the server:
   ```bash
   node server.js
   ```

## Cloud Deployment (Render.com)

1. Fork or push this repository to your GitHub account.
2. Sign in to [Render.com](https://render.com) and create a new **Web Service**.
3. Connect your repository.
4. Set the Start Command to:
   ```bash
   node server.js
   ```
5. Render will provide a live URL (e.g., `https://riselab-attendance.onrender.com`).
6. **Note on Persistence**: Render's free tier spins down after inactivity. The SQLite database will reset on each redeploy on the free tier. For persistent storage on the free tier, consider upgrading Render or swapping SQLite for a free cloud Postgres database like Supabase.
