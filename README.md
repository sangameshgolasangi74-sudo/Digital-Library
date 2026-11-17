# Digital Library

**Digital Library – Your Digital Library, Buying, Borrowing and Book Exchange Platform**

Digital Library is a platform designed to connect book readers, buyers, sellers and borrowers in one place.

## Features

- Browse and explore books
- Buy and sell books
- Borrow and return books
- Exchange books
- Digital library and reading
- Customer dashboard
- Owner dashboard
- Admin dashboard
- User registration and login
- Book management and order tracking

## Technology Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Express.js
- Node.js
- SQLite

## Run Locally

### Prerequisites
- Node.js
- npm

### Installation

```bash
npm install
```

### Start development server

Before the first run, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in your local `.env` file. Keep `.env` private and never commit credentials.

For password-reset email, configure `SMTP_USER` and `SMTP_PASS` in `.env`. Use a Google App Password, not your Gmail login password. For Render deployments, set these values in the service's Environment settings; a local `.env` file is not deployed automatically.

```bash
npm run dev
```

Open the local URL shown in your terminal.

### Build for production

```bash
npm run build
```

### Start production server

```bash
npm start
```

## Project Status

Digital Library is under development.

---

**Digital Library – Connecting People Through Books.**