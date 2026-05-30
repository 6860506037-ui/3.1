const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

// Auto-Seeding Database on Startup
async function seedDatabase() {
  try {
    const movieCount = await prisma.movie.count();
    if (movieCount === 0) {
      await prisma.movie.createMany({
        data: [
          { id: 1, title: "Dune: Part Two", genre: "Sci-Fi / Adventure", rating: "PG-13", poster: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500&auto=format&fit=crop&q=60" },
          { id: 2, title: "Oppenheimer", genre: "Biography / Drama", rating: "R", poster: "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=500&auto=format&fit=crop&q=60" },
          { id: 3, title: "Inside Out 2", genre: "Animation / Family", rating: "G", poster: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=60" }
        ]
      });
      console.log("[CineStream Seed] Seeded movies database.");
    }

    const seatCount = await prisma.seat.count();
    if (seatCount === 0) {
      const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      const seatsData = [];
      rows.forEach(row => {
        for (let num = 1; num <= 8; num++) {
          seatsData.push({
            rowName: row,
            seatNumber: num,
            status: 'AVAILABLE'
          });
        }
      });
      await prisma.seat.createMany({
        data: seatsData
      });
      console.log("[CineStream Seed] Seeded 64 standard & premium seats.");
    }
  } catch (err) {
    console.error("[CineStream Seed Error]", err);
  }
}

seedDatabase().catch(err => console.error(err));

// API Endpoint: Get Movies
app.get('/api/movies', async (req, res) => {
  try {
    const movies = await prisma.movie.findMany();
    res.json(movies);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch movies" });
  }
});

// API Endpoint: Get Seats
app.get('/api/seats', async (req, res) => {
  try {
    const seats = await prisma.seat.findMany({
      orderBy: [
        { rowName: 'asc' },
        { seatNumber: 'asc' }
      ]
    });
    res.json(seats);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch seats" });
  }
});

// API Endpoint: Reserve seats using transactions and lock the rows
app.post('/api/reserve', async (req, res) => {
  const { seatIds, totalPrice, discountApplied, movieId } = req.body;

  if (!seatIds || !Array.isArray(seatIds) || seatIds.length === 0 || !movieId) {
    return res.status(400).json({ error: "Invalid reservation arguments." });
  }

  // Sanitize the inputs to protect against injection
  const sanitizedSeatIds = seatIds.map(id => Number(id)).filter(id => !isNaN(id));

  try {
    const resultTicket = await prisma.$transaction(async (tx) => {
      // 1. Lock rows with pessimistic write locks (FOR UPDATE)
      const seatIdsString = sanitizedSeatIds.join(',');
      const lockedSeats = await tx.$queryRawUnsafe(
        `SELECT id, status FROM Seat WHERE id IN (${seatIdsString}) FOR UPDATE`
      );

      // 2. Validate availability status
      const unavailableSeats = lockedSeats.filter(s => s.status === 'RESERVED');
      if (unavailableSeats.length > 0) {
        throw new Error("Seat already reserved to prevent data corruption.");
      }

      // 3. Flag seats as RESERVED
      await tx.seat.updateMany({
        where: { id: { in: sanitizedSeatIds } },
        data: { status: 'RESERVED' },
      });

      // 4. Create reservation ticket
      const ticket = await tx.ticket.create({
        data: {
          totalPrice: parseFloat(totalPrice),
          discountApplied: Boolean(discountApplied),
          movieId: parseInt(movieId)
        }
      });

      // 5. Build pivot ticket items
      const ticketItems = sanitizedSeatIds.map(seatId => ({
        ticketId: ticket.id,
        seatId: seatId
      }));

      await tx.ticketItem.createMany({
        data: ticketItems
      });

      return ticket;
    });

    res.status(201).json({ success: true, ticketId: resultTicket.id });
  } catch (err) {
    if (err.message === "Seat already reserved to prevent data corruption.") {
      res.status(422).json({ error: err.message });
    } else {
      console.error("[CineStream Reserve Error]", err);
      res.status(500).json({ error: "Booking execution failed due to an database anomaly." });
    }
  }
});

// API Endpoint: Fetch ticket summary and export simulated Thermal Receipt
app.get('/api/ticket/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Ticket index invalid." });
  }

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        movie: true,
        ticketItems: {
          include: {
            seat: true
          }
        }
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: "Ticket database trace not found." });
    }

    // Build thermal receipts simulated printer layout
    const formattedDate = new Date(ticket.createdAt).toLocaleString();
    const reservedSeatsStr = ticket.ticketItems
      .map(item => `Row ${item.seat.rowName} - Seat ${item.seat.seatNumber}`)
      .join('\n');

    const receiptContent = `========================================
               CINESTREAM               
          THEATER TICKETING SYSTEM       
========================================
Receipt ID:  #${ticket.id}
Timestamp:   ${formattedDate}
Movie:       ${ticket.movie.title}
Rating:      [${ticket.movie.rating}]

----------------------------------------
SEAT(S) SECURED:
${reservedSeatsStr}

----------------------------------------
Discount:    ${ticket.discountApplied ? "10% Instant Applied (WS2026)" : "None Applied"}
Total Price: ${ticket.totalPrice.toFixed(2)} THB

========================================
   THANK YOU FOR SELECTING CINESTREAM!   
    PRESENT THIS TICKET AT THE LOUNGE    
========================================`;

    // Save formatted text to local server directory
    const receiptsDirectory = path.join(__dirname, 'storage', 'receipts');
    fs.mkdirSync(receiptsDirectory, { recursive: true });
    
    const receiptPath = path.join(receiptsDirectory, `ticket_${ticket.id}.txt`);
    fs.writeFileSync(receiptPath, receiptContent, 'utf-8');

    res.json({ ticket, receiptPath, receiptText: receiptContent });
  } catch (err) {
    console.error("[CineStream Ticket Retrieve Error]", err);
    res.status(500).json({ error: "Failed to assemble thermal printer receipt." });
  }
});

// Static Middleware to host production built UI folder output from Next.js
const staticAssetsPath = path.join(__dirname, 'out');
app.use(express.static(staticAssetsPath));

// Direct any routing parameters back to NextJS static router
app.get('*', (req, res, next) => {
  if (req.url.startsWith('/api')) return next();
  res.sendFile(path.join(staticAssetsPath, 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`CineStream server executing on port: ${PORT}`);
});
