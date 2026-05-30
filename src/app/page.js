"use client";

import { useState, useEffect } from "react";

// Standard client fallback assets to prevent rendering blockages prior to DB synchronization
const SYSTEM_FALLBACK_MOVIES = [
  { id: 1, title: "Dune: Part Two", genre: "Sci-Fi / Adventure", rating: "PG-13", poster: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500&auto=format&fit=crop&q=60" },
  { id: 2, title: "Oppenheimer", genre: "Biography / Drama", rating: "R", poster: "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=500&auto=format&fit=crop&q=60" },
  { id: 3, title: "Inside Out 2", genre: "Animation / Family", rating: "G", poster: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=60" }
];

export default function CineStreamPage() {
  const API_GATEWAY = typeof window !== 'undefined'
    ? (window.location.port === '3000' ? 'http://localhost:5000' : '')
    : '';

  const [movies, setMovies] = useState(SYSTEM_FALLBACK_MOVIES);
  const [selectedMovie, setSelectedMovie] = useState(SYSTEM_FALLBACK_MOVIES[0]);
  const [seats, setSeats] = useState([]);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [promoCode, setPromoCode] = useState("");
  const [discountApplied, setDiscountApplied] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [checkoutName, setCheckoutName] = useState("");
  const [checkoutEmail, setCheckoutEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successReceipt, setSuccessReceipt] = useState("");

  const pullBackendPayloads = async () => {
    try {
      const movieStream = await fetch(`${API_GATEWAY}/api/movies`);
      if (movieStream.ok) {
        const payload = await movieStream.json();
        if (payload && payload.length > 0) {
          setMovies(payload);
          setSelectedMovie(prev => payload.find(m => m.id === prev.id) || payload[0]);
        }
      }

      const seatsStream = await fetch(`${API_GATEWAY}/api/seats`);
      if (seatsStream.ok) {
        const payload = await seatsStream.json();
        setSeats(payload);
      }
    } catch (err) {
      console.warn("Express connection status: inactive. Defaulting UI to static offline fallback.", err);
    }
  };

  useEffect(() => {
    pullBackendPayloads();
    const updaterInterval = setInterval(pullBackendPayloads, 5000);
    return () => clearInterval(updaterInterval);
  }, []);

  const fallbackSeatsMap = seats.length > 0 ? seats : (() => {
    const list = [];
    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    let incrementalId = 1;
    rows.forEach(row => {
      for (let number = 1; number <= 8; number++) {
        list.push({
          id: incrementalId++,
          rowName: row,
          seatNumber: number,
          status: 'AVAILABLE'
        });
      }
    });
    return list;
  })();

  const organizedGridRows = {};
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach(row => {
    organizedGridRows[row] = [];
  });
  fallbackSeatsMap.forEach(seat => {
    if (organizedGridRows[seat.rowName]) {
      organizedGridRows[seat.rowName].push(seat);
    }
  });

  const toggleSeatSelection = (seat) => {
    if (seat.status === 'RESERVED') return;
    const exists = selectedSeats.some(s => s.id === seat.id);
    if (exists) {
      setSelectedSeats(selectedSeats.filter(s => s.id !== seat.id));
    } else {
      setSelectedSeats([...selectedSeats, seat]);
    }
  };

  const calculateSubtotal = () => {
    return selectedSeats.reduce((total, seat) => {
      const isPremium = ['E', 'F', 'G', 'H'].includes(seat.rowName);
      return total + (isPremium ? 200 : 160);
    }, 0);
  };

  const subtotalPrice = calculateSubtotal();
  const discountedTotal = discountApplied ? subtotalPrice * 0.90 : subtotalPrice;

  const validateAndApplyPromo = () => {
    setPromoError("");
    if (promoCode.trim().toUpperCase() === "WS2026") {
      setDiscountApplied(true);
    } else {
      setPromoError("Invalid promo code format.");
      setDiscountApplied(false);
    }
  };

  const executeReservation = async (e) => {
    e.preventDefault();
    if (selectedSeats.length === 0) {
      setErrorMessage("Please select at least one seat row.");
      return;
    }
    if (!checkoutName || !checkoutEmail) {
      setErrorMessage("Complete booking name and contact email fields.");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    const dataPayload = {
      seatIds: selectedSeats.map(s => s.id),
      totalPrice: discountedTotal,
      discountApplied,
      movieId: selectedMovie.id
    };

    try {
      const response = await fetch(`${API_GATEWAY}/api/reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataPayload)
      });

      const responseJSON = await response.json();

      if (!response.ok) {
        throw new Error(responseJSON.error || "Database update lock anomaly.");
      }

      const receiptResponse = await fetch(`${API_GATEWAY}/api/ticket/${responseJSON.ticketId}`);
      if (receiptResponse.ok) {
        const receiptJSON = await receiptResponse.json();
        setSuccessReceipt(receiptJSON.receiptText);
      } else {
        setSuccessReceipt(`Reservation Successfully Written!\nTicket No: #${responseJSON.ticketId}\nPaid Total: ${discountedTotal.toFixed(2)} THB`);
      }

      setSelectedSeats([]);
      setIsDrawerOpen(false);
      setPromoCode("");
      setDiscountApplied(false);
      setCheckoutName("");
      setCheckoutEmail("");
      pullBackendPayloads();

    } catch (err) {
      setErrorMessage(err.message || "An expected error has corrupted client booking stream.");
    } finally {
      setIsLoading(false);
    }
  };

  const getBadgeStyling = (rating) => {
    switch (rating) {
      case 'G': return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/35';
      case 'PG-13': return 'bg-amber-500/15 text-amber-400 border border-amber-500/35';
      case 'R': return 'bg-rose-500/15 text-rose-400 border border-rose-500/35';
      default: return 'bg-zinc-500/15 text-zinc-400 border border-zinc-500/35';
    }
  };

  return (
    <main className="min-h-screen bg-black text-white selection:bg-rose-600 selection:text-white font-sans">
      
      {/* Cinematic Loop Trailer Hero */}
      <section className="relative h-[65vh] md:h-[80vh] w-full flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/80 z-10" />
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-50 z-0"
        >
          <source src="/trailer.mp4" type="video/mp4" />
        </video>
        <div className="relative z-20 text-center max-w-4xl px-4 animate-fade-in">
          <span className="text-xs uppercase tracking-widest text-rose-500 font-bold bg-rose-500/10 px-3 py-1.5 rounded-full border border-rose-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            Now Redefining Cinema & Stream
          </span>
          <h1 className="text-4xl md:text-7xl font-black mt-6 tracking-tight leading-none bg-clip-text text-transparent bg-gradient-to-r from-white via-neutral-100 to-neutral-400">
            CINESTREAM
          </h1>
          <p className="text-neutral-400 mt-4 text-base md:text-xl max-w-xl mx-auto font-light leading-relaxed">
            Acquire local premium theater seats and stream cinema blockbusters on any smart system. High concurrency, minimal latency.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a href="#catalog" className="px-8 py-3.5 bg-rose-600 hover:bg-rose-700 font-semibold rounded-lg shadow-lg hover:shadow-rose-600/20 transform hover:-translate-y-0.5 transition-all">
              Book Seat Tickets
            </a>
          </div>
        </div>
      </section>

      {/* Catalog Grid View */}
      <section id="catalog" className="py-20 px-4 max-w-7xl mx-auto relative z-20">
        <div className="border-b border-neutral-900 pb-6 mb-12 flex flex-col md:flex-row items-baseline justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight">Now Showing</h2>
            <p className="text-neutral-500 text-sm mt-1">Select a cinematic blockbuster to access reservations</p>
          </div>
          <div className="text-neutral-400 text-xs font-mono bg-neutral-950 px-4 py-2 rounded border border-neutral-900">
            Currently Reserved: {seats.filter(s => s.status === 'RESERVED').length} / 64 Seats
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {movies.map((movie) => {
            const isMovieActive = selectedMovie.id === movie.id;
            return (
              <div
                key={movie.id}
                onClick={() => setSelectedMovie(movie)}
                className={`relative rounded-2xl overflow-hidden cursor-pointer group bg-neutral-950 transition-all duration-300 transform hover:-translate-y-1 ${
                  isMovieActive 
                    ? "ring-2 ring-rose-600 shadow-[0_0_30px_rgba(220,38,38,0.15)] scale-[1.01]" 
                    : "border border-neutral-900 hover:border-neutral-800"
                }`}
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <img
                    src={movie.poster}
                    alt={movie.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/20 to-transparent" />
                  <span className={`absolute top-4 right-4 text-xs font-bold px-2.5 py-1 rounded shadow-md uppercase tracking-wider ${getBadgeStyling(movie.rating)}`}>
                    {movie.rating}
                  </span>
                </div>
                <div className="p-6">
                  <span className="text-xs text-rose-500 uppercase tracking-widest font-semibold">{movie.genre}</span>
                  <h3 className="text-xl font-bold mt-2 group-hover:text-rose-400 transition-colors">{movie.title}</h3>
                  <div className="mt-5 flex justify-between items-center">
                    <span className="text-neutral-500 text-xs">Standard & Premium layout active</span>
                    <button className={`px-4 py-2 rounded text-xs font-semibold transition-all ${
                      isMovieActive 
                        ? "bg-rose-600 text-white" 
                        : "bg-neutral-900 text-neutral-400 group-hover:bg-neutral-800 group-hover:text-white"
                    }`}>
                      {isMovieActive ? "Selected" : "Select Movie"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Interactive Theater Grid Container */}
      <section className="bg-neutral-950 border-t border-neutral-900 py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs uppercase tracking-wider text-neutral-400 font-semibold">Active Selection</span>
            <h2 className="text-3xl font-extrabold mt-1">Reserve: {selectedMovie.title}</h2>
          </div>

          {/* Dynamic Curved Projector Screen Visual */}
          <div className="flex flex-col items-center mb-16 px-4">
            <div className="w-full h-2 bg-gradient-to-r from-transparent via-rose-500 to-transparent rounded shadow-[0_0_20px_rgba(220,38,38,0.8)] mb-4" />
            <span className="text-xs text-rose-500/80 uppercase tracking-widest font-black text-[10px]">SCENIC SCREEN DIRECTION</span>
          </div>

          {/* Interactive Seat map structure */}
          <div className="flex flex-col gap-3 overflow-x-auto pb-4 max-w-full justify-center">
            {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((rowLetter) => {
              const seatsInRow = organizedGridRows[rowLetter] || [];
              const isPremiumRow = ['E', 'F', 'G', 'H'].includes(rowLetter);

              return (
                <div key={rowLetter} className="flex items-center justify-center gap-3 min-w-[500px] px-2">
                  <span className="w-6 text-right font-black text-xs text-neutral-600">{rowLetter}</span>
                  <div className="flex gap-2.5">
                    {seatsInRow.map((seat) => {
                      const isSelected = selectedSeats.some(s => s.id === seat.id);
                      const isReserved = seat.status === 'RESERVED';

                      let seatColorClass = "bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700 hover:border-neutral-600";
                      if (isReserved) {
                        seatColorClass = "bg-rose-950/40 border-rose-900/40 text-rose-500/40 cursor-not-allowed";
                      } else if (isSelected) {
                        seatColorClass = "bg-amber-500 border-amber-400 text-black font-semibold shadow-[0_0_15px_rgba(245,158,11,0.5)]";
                      }

                      return (
                        <button
                          key={seat.id}
                          disabled={isReserved}
                          onClick={() => toggleSeatSelection(seat)}
                          className={`w-9 h-9 rounded-t-lg border text-[11px] font-medium transition-all duration-150 flex items-center justify-center ${seatColorClass}`}
                          title={`Row ${seat.rowName} Seat ${seat.seatNumber} - ${isPremiumRow ? 'Premium (200 THB)' : 'Standard (160 THB)'}`}
                        >
                          {seat.seatNumber}
                        </button>
                      );
                    })}
                  </div>
                  <span className="w-6 text-left font-black text-xs text-neutral-600">{rowLetter}</span>
                </div>
              );
            })}
          </div>

          {/* Color Legend & Prices */}
          <div className="mt-12 flex flex-wrap gap-6 justify-center text-sm border-t border-neutral-900 pt-8">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-neutral-800 border border-neutral-700 block" />
              <span className="text-neutral-400">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-amber-500 border border-amber-400 block" />
              <span className="text-neutral-400">Selected</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-rose-950/40 border border-rose-900/40 block" />
              <span className="text-neutral-400">Reserved</span>
            </div>
            <span className="text-neutral-600">|</span>
            <div className="text-neutral-400">
              Rows A-D: <span className="text-white font-medium">Standard (160 THB)</span>
            </div>
            <div className="text-neutral-400">
              Rows E-H: <span className="text-white font-medium">Premium (200 THB)</span>
            </div>
          </div>
        </div>
      </section>

      {/* Persistent Dynamic Checkout Summary panel */}
      {selectedSeats.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-neutral-950 border-t border-neutral-800 z-40 px-6 py-5 shadow-[0_-10px_30px_rgba(0,0,0,0.8)] animate-slide-up">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <span className="text-xs text-rose-500 font-bold uppercase tracking-widest">{selectedMovie.title}</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-lg font-bold">{selectedSeats.length} Seats:</span>
                <span className="text-neutral-300 font-mono text-sm">
                  {selectedSeats.map(s => `${s.rowName}${s.seatNumber}`).join(", ")}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
              <div className="text-right">
                <span className="text-xs text-neutral-400 block">Subtotal Price</span>
                <span className="text-xl font-mono font-extrabold text-amber-400">{subtotalPrice} THB</span>
              </div>
              <button
                onClick={() => setIsDrawerOpen(true)}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-8 py-3.5 rounded-lg shadow-lg hover:shadow-rose-600/30 transition-all transform active:scale-95"
              >
                Proceed to Checkout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-out Overlay Drawer */}
      <div className={`fixed inset-0 z-50 overflow-hidden transition-all duration-300 ${isDrawerOpen ? "visible" : "invisible"}`}>
        <div
          className={`absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300 ${isDrawerOpen ? "opacity-100" : "opacity-0"}`}
          onClick={() => setIsDrawerOpen(false)}
        />
        <div className={`absolute inset-y-0 right-0 max-w-full flex pl-10 transform transition-transform duration-300 ${isDrawerOpen ? "translate-x-0" : "translate-x-full"}`}>
          <div className="w-screen max-w-md bg-neutral-950 border-l border-neutral-800 text-white p-8 flex flex-col justify-between shadow-2xl overflow-y-auto">
            
            {/* Drawer Header */}
            <div>
              <div className="flex items-center justify-between border-b border-neutral-900 pb-5">
                <h3 className="text-lg font-extrabold tracking-tight">Checkout Summary</h3>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 hover:bg-neutral-900 rounded text-neutral-400 hover:text-white transition-all"
                >
                  ✕
                </button>
              </div>

              {/* Order Specs */}
              <div className="mt-8 space-y-5">
                <div className="flex gap-4">
                  <img src={selectedMovie.poster} alt="" className="w-20 h-28 object-cover rounded-md border border-neutral-850" />
                  <div>
                    <span className="text-xs text-rose-500 uppercase tracking-widest font-black">{selectedMovie.genre}</span>
                    <h4 className="text-base font-bold text-white mt-1">{selectedMovie.title}</h4>
                    <span className="text-xs text-neutral-500 font-mono mt-2 block">Rating Profile: {selectedMovie.rating}</span>
                  </div>
                </div>

                <div className="bg-neutral-900/60 rounded-lg p-4 border border-neutral-900 space-y-3">
                  <div className="flex justify-between text-sm text-neutral-400">
                    <span>Selected Seats ({selectedSeats.length}):</span>
                    <span className="text-white font-mono">{selectedSeats.map(s => `${s.rowName}${s.seatNumber}`).join(", ")}</span>
                  </div>
                  <div className="flex justify-between text-sm text-neutral-400">
                    <span>Base Ticket Value:</span>
                    <span className="text-white font-mono">{subtotalPrice} THB</span>
                  </div>
                  {discountApplied && (
                    <div className="flex justify-between text-xs text-emerald-400 font-semibold bg-emerald-500/10 p-2.5 rounded border border-emerald-500/20">
                      <span>Promo (WS2026 - 10%):</span>
                      <span className="font-mono">-{subtotalPrice * 0.1} THB</span>
                    </div>
                  )}
                </div>

                {/* Promo application wrapper */}
                <div className="space-y-2">
                  <label className="text-xs text-neutral-400 font-bold block uppercase tracking-wide">Promo Code Input</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. WS2026"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      className="bg-neutral-900 border border-neutral-800 rounded px-4 py-2.5 text-sm w-full focus:outline-none focus:border-rose-600 text-white font-mono uppercase"
                    />
                    <button
                      type="button"
                      onClick={validateAndApplyPromo}
                      className="bg-neutral-800 hover:bg-neutral-700 text-white text-xs px-5 py-2.5 rounded font-bold transition-all"
                    >
                      Apply
                    </button>
                  </div>
                  {promoError && <p className="text-xs text-rose-500 font-semibold">{promoError}</p>}
                  {discountApplied && <p className="text-xs text-emerald-400 font-semibold">Promo valid! 10% discount applied to your final subtotal.</p>}
                </div>
              </div>
            </div>

            {/* Verification & Submission */}
            <form onSubmit={executeReservation} className="mt-8 pt-8 border-t border-neutral-900 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-neutral-400 font-bold block uppercase tracking-wide mb-1.5">Full Name</label>
                  <input
                    required
                    type="text"
                    value={checkoutName}
                    onChange={(e) => setCheckoutName(e.target.value)}
                    placeholder="Enter your full name"
                    className="bg-neutral-900 border border-neutral-800 rounded px-4 py-3 text-sm w-full focus:outline-none focus:border-rose-600 text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 font-bold block uppercase tracking-wide mb-1.5">Email Address</label>
                  <input
                    required
                    type="email"
                    value={checkoutEmail}
                    onChange={(e) => setCheckoutEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="bg-neutral-900 border border-neutral-800 rounded px-4 py-3 text-sm w-full focus:outline-none focus:border-rose-600 text-white"
                  />
                </div>
              </div>

              {errorMessage && (
                <div className="bg-rose-500/10 text-rose-400 border border-rose-500/25 rounded p-3 text-xs font-semibold leading-relaxed">
                  ⚠️ {errorMessage}
                </div>
              )}

              <div>
                <div className="flex justify-between items-baseline mb-4">
                  <span className="text-neutral-400 text-sm">Amount Due:</span>
                  <span className="text-2xl font-black font-mono text-amber-400">{discountedTotal.toFixed(2)} THB</span>
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-rose-600 hover:bg-rose-700 disabled:bg-neutral-850 disabled:text-neutral-500 text-white font-extrabold py-4 rounded-lg shadow-lg hover:shadow-rose-600/30 transition-all flex justify-center items-center gap-3 text-sm"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Locking Seats & Processing...
                    </>
                  ) : "Confirm Booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Simulated Thermal Printer Receipt Modal */}
      {successReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setSuccessReceipt("")} />
          <div className="relative bg-white text-black p-6 md:p-8 rounded-lg shadow-2xl max-w-md w-full animate-scale-up">
            <button
              onClick={() => setSuccessReceipt("")}
              className="absolute top-4 right-4 text-neutral-400 hover:text-black font-bold text-lg"
            >
              ✕
            </button>
            <div className="text-center mb-6">
              <span className="text-xs uppercase tracking-widest text-emerald-600 font-extrabold bg-emerald-100 px-3 py-1 rounded">
                Booking Completed
              </span>
            </div>
            <pre className="font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed text-black bg-neutral-100 p-4 rounded border border-neutral-300">
              {successReceipt}
            </pre>
            <div className="mt-6 flex flex-col gap-2">
              <button
                onClick={() => setSuccessReceipt("")}
                className="w-full bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold py-3 rounded transition-all"
              >
                Close Receipt Console
              </button>
              <p className="text-neutral-500 text-[10px] text-center mt-2">
                A hardcopy of this simulated thermal text has been filed inside the server directory at /storage/receipts/.
              </p>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
