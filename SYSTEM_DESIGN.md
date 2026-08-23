# 🎟️ TicketPulse – High-Concurrency Ticket Booking System

A full-stack ticket booking platform built with Next.js 15, PostgreSQL, and Prisma ORM. It features visual interactive seat mapping, atomic concurrency control to prevent double-booking, 10-minute seat hold TTL auto-release, QR code ticket generation with email delivery, and automated waitlist reallocation on cancellations.

---

## 🚀 Live Demo & Credentials
* **Hosted URL**: `https://ticket-booking-system.vercel.app` (replace with your live URL)
* **Default Customer**: `customer@ticket.com` / `password123`
* **Default Organiser**: `organiser@ticket.com` / `password123`

---

## 🛠️ Tech Stack
* **Framework**: Next.js 15 (App Router, React 19, TypeScript)
* **Database & ORM**: PostgreSQL (Neon Serverless) + Prisma ORM
* **Styling**: Tailwind CSS
* **Auth**: JWT with HTTP-only cookies and Role-Based Access Control (`CUSTOMER`, `ORGANISER`, `ADMIN`)
* **Email & QR**: Resend API + `qrcode`

---

## ⚙️ Environment Variables (.env.example)

```env
DATABASE_URL="postgresql://neondb_owner:password@ep-host.aws.neon.tech/neondb?sslmode=require"
JWT_SECRET="ticket-booking-jwt-secret-key-2026"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
RESEND_API_KEY="re_placeholder"
📦 Local Setup GuideClone the Repository & Install Dependencies:Bashgit clone <repo-url>
cd ticket-booking-system
npm install
Configure Database:Set your DATABASE_URL in .env, then run:Bashnpx prisma db push
npx tsx prisma/seed.ts
Start Development Server:Bashnpm run dev
Open http://localhost:3000 in your browser.🗄️ Database Schema SummaryUser: Role-based access for CUSTOMER, ORGANISER, and ADMIN.Venue: Row and column grid layout specifications.Event & EventPricing: Event details with per-category seat pricing (STANDARD, PREMIUM, VIP).Seat: Show-specific seat states (AVAILABLE, HELD, BOOKED).SeatHold: Seat reservation holds with TTL timestamps (expiresAt).Booking: Confirmed bookings with unique references, prices, and QR codes.Waitlist: FIFO queue tracking category waitlists and time-limited cancellation offers.📡 API ReferenceMethodEndpointAccessDescriptionPOST/api/authPublicRegister or login a user.GET/api/authPublicReturns the authenticated session user.GET/api/events/[id]/seatsPublicLive seat status grid with automatic hold cleanup.POST/api/seats/holdCustomerAtomically hold a seat (10m TTL) or release a hold.POST/api/bookingsCustomerConfirm booking, generate QR ticket, send email.GET/api/bookingsAllCustomer booking history or Organiser revenue metrics.DELETE/api/bookingsCustomerCancel a booking and cascade seat to waitlist queue.POST/api/waitlistCustomerJoin category waitlist for sold-out events.🧠 System Design Write-Up1. Seat Hold TTL & Auto-Release MechanismWhen a seat is selected, its status transitions to HELD and a SeatHold record is created with an expiresAt timestamp set to NOW() + 10 minutes. The system uses proactive lazy sweeping: before any seat read or hold mutation, all records where expiresAt <= NOW() are deleted, and their seats are reset to AVAILABLE if no other active hold exists. The client maintains a synchronized countdown timer that triggers local release and refreshes the grid upon reaching zero.2. Concurrency Protection for Simultaneous SelectionTo eliminate race conditions without distributed lock contention, seat reservation uses atomic conditional updates at the PostgreSQL level:SQLUPDATE "Seat" SET "status" = 'HELD' WHERE "id" = :id AND "status" = 'AVAILABLE';
PostgreSQL's row-level locks serialize simultaneous transactions. The first transaction updates the row and succeeds; concurrent requests find status != 'AVAILABLE', update 0 rows, and receive an immediate HTTP 409 Conflict error, preventing duplicate reservations.3. Waitlist Auto-Assignment & Time-Limited OffersWhen a booking is cancelled, the transaction marks the booking CANCELLED and checks the Waitlist table for the oldest record with status = 'WAITING' matching the event and category (ORDER BY createdAt ASC). If found, the seat is held exclusively for that user, the waitlist status is set to OFFERED with a 10-minute expiry, and an email notification with a direct claim link is dispatched. If the user does not complete checkout within the window, the hold expires and the seat is reallocated to the next person in line.4. Real-Time Seat Map Updates & QR DeliveryThe frontend utilizes a 3-second polling interval to reconcile seat map states across active browser sessions. Upon confirmed payment, a collision-resistant booking reference is generated, rendered into a high-density QR code via the qrcode engine, and sent via transactional email alongside confirmation metadata.