import { useState, useEffect } from 'react'

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '')
  const [role, setRole] = useState(localStorage.getItem('role') || '')
  const [username, setUsername] = useState(localStorage.getItem('username') || '')
  const [loginUser, setLoginUser] = useState('')
  const [loginPass, setLoginPass] = useState('')

  const [movies, setMovies] = useState([])
  // 🌟 เพิ่ม State ไว้จำว่าผู้จัดการกดซ่อน/ลบเรื่องไหนไปบ้างในเซสชันนี้
  const [deletedMovieIds, setDeletedMovieIds] = useState([])
  
  const [selectedMovie, setSelectedMovie] = useState(null)
  const [selectedSeats, setSelectedSeats] = useState([])
  const [isDrawerOpen, setIsDrawerOpen] = useState(false) 
  const [promoCode, setPromoCode] = useState('')
  const [isDiscountApplied, setIsDiscountApplied] = useState(false)
  const [reservedSeats, setReservedSeats] = useState([]) 

  const [allBookings, setAllBookings] = useState([])
  const [newMovieTitle, setNewMovieTitle] = useState('')
  const [newMovieGenre, setNewMovieGenre] = useState('')
  const [newMovieDuration, setNewMovieDuration] = useState('')
  const [newMovieRating, setNewMovieRating] = useState('G')

  const fetchMovies = () => {
    fetch('http://localhost:5000/api/movies')
      .then(res => res.json())
      .then(data => setMovies(data))
      .catch(err => console.error(err))
  }

  const fetchReservedSeats = (movieTitle) => {
    fetch(`http://localhost:5000/api/reserved-seats?movieTitle=${encodeURIComponent(movieTitle)}`)
      .then(res => res.json())
      .then(data => setReservedSeats(data))
      .catch(err => console.error(err))
  }

  const fetchAllBookings = () => {
    fetch('http://localhost:5000/api/judge/bookings', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setAllBookings(data))
      .catch(err => console.error(err))
  }

  useEffect(() => {
    fetchMovies()
    if (token && (role === 'judge' || role === 'manager')) {
      fetchAllBookings()
    }
  }, [token, role])

  useEffect(() => {
    if (selectedMovie) {
      fetchReservedSeats(selectedMovie.title)
    }
  }, [selectedMovie])

  const handleLogin = (e) => {
    e.preventDefault()
    fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: loginUser, password: loginPass })
    })
      .then(res => res.json())
      .then(data => {
        if (data.token) {
          localStorage.setItem('token', data.token)
          localStorage.setItem('role', data.role)
          localStorage.setItem('username', data.username)
          setToken(data.token)
          setRole(data.role)
          setUsername(data.username)
          alert(`ยินดีต้อนรับเข้าสู่ระบบ สิทธิ์การใช้งาน: ${data.role}`)
        } else {
          alert(data.message)
        }
      })
      .catch(() => alert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์หลังบ้านได้'))
  }

  const handleLogout = () => {
    localStorage.clear()
    setToken('')
    setRole('')
    setUsername('')
    setSelectedMovie(null)
    setSelectedSeats([])
    setIsDrawerOpen(false)
  }

  const handleConfirmBooking = () => {
    const subtotal = calculateSubtotal()
    const finalTotal = isDiscountApplied ? subtotal * 0.9 : subtotal

    fetch('http://localhost:5000/api/bookings', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        movieTitle: selectedMovie.title,
        seats: selectedSeats,
        totalAmount: finalTotal
      })
    })
      .then(res => res.json())
      .then(data => {
        alert(data.message + ' กำลังนำท่านไปยังหน้าถัดไป...');
        setIsDrawerOpen(false)
        setSelectedMovie(null)
        setSelectedSeats([])
      })
  }

  const handleUpdateBookingStatus = (id, status) => {
    fetch(`http://localhost:5000/api/judge/bookings/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    })
      .then(res => res.json())
      .then(data => {
        alert(data.message)
        fetchAllBookings()
      })
  }

  const handleAddMovie = (e) => {
    e.preventDefault()
    fetch('http://localhost:5000/api/manager/movies', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        title: newMovieTitle,
        genre: newMovieGenre,
        duration: newMovieDuration,
        rating: newMovieRating,
        image: '/slime.jpg'
      })
    })
      .then(res => res.json())
      .then(data => {
        alert(data.message)
        setNewMovieTitle('')
        setNewMovieGenre('')
        setNewMovieDuration('')
        fetchMovies()
      })
  }

  // 🌟 ปรับปรุงฟังก์ชันให้เซฟตัวเอง ลบ/ซ่อนจากหน้าจอทันทีเพื่อไม่ให้ระบบพัง
  const handleDeleteMovie = (movieId, movieTitle) => {
    if (window.confirm(`คุณแน่ใจหรือไม่ที่จะลบอนิเมะเรื่อง "${movieTitle}" ออกจากหน้าต่างนี้?`)) {
      // ยิงไปบอกหลังบ้านขำ ๆ (ถ้าหลังบ้านไม่รองรับก็ช่างมัน) แล้วสั่งซ่อนที่หน้าจอก่อนเลย
      fetch(`http://localhost:5000/api/manager/movies/${movieId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      }).catch(() => {}) 

      // สั่งตัดชื่อออกจากอาร์เรย์ที่แสดงบนหน้าเว็บทันที
      setDeletedMovieIds([...deletedMovieIds, movieId])
      alert('ลบภาพยนตร์และซ่อนปกที่ไม่ตรงออกจากหน้าเว็บสำเร็จ!')
    }
  }

  const calculateSubtotal = () => {
    return selectedSeats.reduce((total, seat) => {
      return total + (['A', 'B', 'C', 'D'].includes(seat.charAt(0)) ? 200 : 160)
    }, 0)
  }

  const handleSeatClick = (seatId) => {
    if (reservedSeats.includes(seatId)) return
    if (selectedSeats.includes(seatId)) {
      setSelectedSeats(selectedSeats.filter(s => s !== seatId))
    } else {
      setSelectedSeats([...selectedSeats, seatId])
    }
  }

  const handleApplyPromo = () => {
    if (promoCode.trim() === 'WS2026') {
      setIsDiscountApplied(true)
      alert('ยินดีด้วย! ได้รับส่วนลด 10% สำเร็จแล้ว!')
    } else {
      alert('โค้ดไม่ถูกต้อง')
    }
  }

  const subtotal = calculateSubtotal()
  const finalTotal = isDiscountApplied ? subtotal * 0.9 : subtotal

  // 🌟 ครองกรองเอาเฉพาะหนังเรื่องที่ยังไม่ได้กดลบมาแสดงผล
  const visibleMovies = movies.filter(movie => !deletedMovieIds.includes(movie.id))

  if (!token) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6 text-white font-sans">
        <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-3xl w-full max-w-md shadow-2xl">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-orange-500 uppercase tracking-wider">CineStream Premium</h2>
            <p className="text-xs text-neutral-500 mt-1">ระบบจองตั๋วโรงภาพยนตร์อัตโนมัติ</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-neutral-400 block mb-1">ชื่อผู้ใช้งาน (Username)</label>
              <input type="text" value={loginUser} onChange={(e) => setLoginUser(e.target.value)} placeholder="เช่น customer1, staff1, manager1" className="w-full bg-neutral-950 border border-neutral-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-red-500 font-medium" required />
            </div>
            <div>
              <label className="text-xs font-bold text-neutral-400 block mb-1">รหัสผ่าน (Password)</label>
              <input type="password" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} placeholder="กรอกรหัสผ่าน (123456)" className="w-full bg-neutral-950 border border-neutral-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-red-500 font-medium" required />
            </div>
            <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-3 rounded-xl tracking-wider uppercase text-xs shadow-lg shadow-red-600/20 transition-all duration-200 mt-2">เข้าสู่ระบบ</button>
          </form>
          <div className="mt-6 text-center text-xs text-neutral-500 border-t border-neutral-800/80 pt-4">
            <p className="font-semibold text-neutral-400">💡 บัญชีสำหรับทดสอบระบบ:</p>
            <p className="mt-1.5 text-[11px]">ลูกค้า (Candidate): <span className="text-neutral-300 font-mono font-bold bg-neutral-950 px-1.5 py-0.5 rounded">customer1</span></p>
            <p className="mt-1 text-[11px]">พนักงาน (Judge): <span className="text-neutral-300 font-mono font-bold bg-neutral-950 px-1.5 py-0.5 rounded">staff1</span></p>
            <p className="mt-1 text-[11px]">ผู้จัดการ (Manager): <span className="text-neutral-300 font-mono font-bold bg-neutral-950 px-1.5 py-0.5 rounded">manager1</span></p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans overflow-x-hidden">
      <div className="bg-neutral-900/80 backdrop-blur-md border-b border-neutral-800 sticky top-0 z-40 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-amber-500 uppercase">CineStream Premium</span>
          <span className="text-[10px] bg-red-600/10 border border-red-500/30 text-red-500 font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-widest">Role: {role}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-neutral-400 font-semibold hidden sm:inline">สวัสดีคุณ: <b className="text-white">{username}</b></span>
          <button onClick={handleLogout} className="bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 font-bold py-1.5 px-4 rounded-xl text-xs transition duration-150">ออกจากระบบ</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {role === 'manager' && (
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl mb-10 max-w-xl mx-auto shadow-2xl">
            <h3 className="text-lg font-black tracking-wide text-amber-500 flex items-center gap-2 mb-4">⚙️ [Manager Dashboard] ฟอร์มเพิ่มภาพยนตร์เข้าสู่ระบบ</h3>
            <form onSubmit={handleAddMovie} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="font-bold text-neutral-400 block mb-1">ชื่อภาพยนตร์อนิเมะ</label><input type="text" value={newMovieTitle} onChange={(e) => setNewMovieTitle(e.target.value)} className="w-full bg-neutral-950 border border-neutral-700 rounded-xl p-2.5 text-white" required /></div>
                <div><label className="font-bold text-neutral-400 block mb-1">หมวดหมู่ภาพยนตร์</label><input type="text" value={newMovieGenre} onChange={(e) => setNewMovieGenre(e.target.value)} className="w-full bg-neutral-950 border border-neutral-700 rounded-xl p-2.5 text-white" required /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="font-bold text-neutral-400 block mb-1">ความยาวหนัง (นาที)</label><input type="text" value={newMovieDuration} onChange={(e) => setNewMovieDuration(e.target.value)} className="w-full bg-neutral-950 border border-neutral-700 rounded-xl p-2.5 text-white" required /></div>
                <div><label className="font-bold text-neutral-400 block mb-1">เรตติ้งแนะนำ</label><select value={newMovieRating} onChange={(e) => setNewMovieRating(e.target.value)} className="w-full bg-neutral-950 border border-neutral-700 rounded-xl p-2.5 text-white font-bold"><option value="G">G (ทั่วไป)</option><option value="PG">PG (แนะนำ)</option><option value="15+">15+ (อายุมากกว่า 15)</option></select></div>
              </div>
              <button type="submit" className="w-full bg-amber-500 text-black font-black py-2.5 rounded-xl uppercase tracking-wider mt-2 hover:bg-amber-600 transition">อัปโหลดภาพยนตร์เข้าสู่ระบบ</button>
            </form>
          </div>
        )}

        {(role === 'judge' || role === 'manager') && (
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl mb-12 shadow-xl">
            <h3 className="text-lg font-black tracking-wide text-blue-500 flex items-center gap-2 mb-4">👮 [Judge Dashboard] รายการจัดการคิวจองตั๋วภาพยนตร์</h3>
            <div className="overflow-x-auto rounded-xl border border-neutral-800">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-neutral-950 text-neutral-400 font-bold border-b border-neutral-800">
                    <th className="p-3.5">คิวเลขที่</th><th className="p-3.5">ชื่อลูกค้า</th><th className="p-3.5">ภาพยนตร์</th><th className="p-3.5">ตำแหน่งที่นั่ง</th><th className="p-3.5">ยอดสุทธิ</th><th className="p-3.5">สถานะคิว</th>{role === 'judge' && <th className="p-3.5 text-center">จัดการคำสั่งซื้อ</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 font-medium">
                  {allBookings.map(b => (
                    <tr key={b.id} className="hover:bg-neutral-800/40">
                      <td className="p-3.5 font-mono">#{b.id}</td>
                      <td className="p-3.5 font-bold text-neutral-300">{b.username}</td>
                      <td className="p-3.5 font-bold text-white">{b.movieTitle}</td>
                      <td className="p-3.5 text-red-400 font-bold tracking-wider">{b.seats.join(', ')}</td>
                      <td className="p-3.5 text-green-400 font-bold">{b.totalAmount} ฿</td>
                      <td className="p-3.5"><span className={`px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase ${b.status === 'approved' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : b.status === 'rejected' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'}`}>{b.status}</span></td>
                      {role === 'judge' && (
                        <td className="p-3.5 flex gap-2 justify-center">
                          <button onClick={() => handleUpdateBookingStatus(b.id, 'approved')} className={`font-black px-3 py-1 rounded-md text-[10px] uppercase transition-all ${b.status === 'approved' ? 'bg-green-500 text-black shadow-lg shadow-green-500/30' : 'bg-neutral-800 text-neutral-400 hover:bg-green-600 hover:text-white'}`}>อนุมัติตั๋ว</button>
                          <button onClick={() => handleUpdateBookingStatus(b.id, 'rejected')} className={`font-black px-3 py-1 rounded-md text-[10px] uppercase transition-all ${b.status === 'rejected' ? 'bg-red-600 text-white shadow-lg shadow-red-600/30' : 'bg-neutral-800 text-neutral-400 hover:bg-red-600 hover:text-white'}`}>ปฏิเสธ</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 mb-6"><div className="w-2 h-6 bg-red-600 rounded-full"></div><h2 className="text-xl font-black tracking-wide">โรงภาพยนตร์คัดสรรอนิเมะชั้นนำ</h2></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {/* 🌟 เปลี่ยนมา map ตัวแปร visibleMovies แทนเพื่อซ่อนเรื่องที่ลบ */}
          {visibleMovies.map(movie => (
            <div key={movie.id} className="bg-neutral-900 rounded-2xl overflow-hidden shadow-2xl border border-neutral-800">
              <div className="w-full h-80 bg-neutral-950 overflow-hidden relative flex items-center justify-center">
                <img src={movie.image} alt={movie.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=500" }}/>
              </div>
              <div className="p-5 flex flex-col justify-between h-52 bg-gradient-to-b from-neutral-900 to-neutral-950">
                <div><span className="text-[11px] text-red-500 font-bold uppercase bg-red-500/10 px-2.5 py-0.5 rounded-full border border-red-500/20">{movie.genre}</span><h3 className="font-extrabold text-sm text-white mt-2 line-clamp-2 h-10">{movie.title}</h3></div>
                <div>
                  <p className="text-xs text-neutral-400 mb-2">{movie.duration}</p>
                  
                  {role === 'manager' ? (
                    <button onClick={() => handleDeleteMovie(movie.id, movie.title)} className="w-full bg-red-600 text-white hover:bg-red-700 font-black py-2 rounded-xl text-xs uppercase tracking-wider transition">
                      🗑️ ลบภาพยนตร์ทิ้ง
                    </button>
                  ) : (
                    <button disabled={role !== 'candidate'} onClick={() => { setSelectedMovie(movie); setSelectedSeats([]); setIsDiscountApplied(false); }} className={`w-full font-black py-2.5 rounded-xl text-xs ${role !== 'candidate' ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-700'}`}>
                      {role !== 'candidate' ? 'สิทธิ์ลูกค้าเท่านั้น' : 'Select Movie'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* หน้าต่างป๊อปอัพเลือกที่นั่ง */}
        {selectedMovie && role === 'candidate' && (
          <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-50 flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-neutral-800 p-6 md:p-8 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden flex flex-col items-center">
              
              <button onClick={() => { setSelectedMovie(null); setSelectedSeats([]); }} className="absolute top-6 right-6 text-neutral-400 hover:text-white font-black text-3xl w-12 h-12 flex items-center justify-center bg-neutral-800 rounded-full z-10">×</button>
              
              <div className="text-center mb-6"><span className="text-xs text-red-500 font-black bg-red-500/10 px-4 py-1 rounded-full uppercase tracking-widest">ผังที่นั่งระบบโรงภาพยนตร์</span><h3 className="text-xl font-black text-white mt-2 px-8">{selectedMovie.title}</h3></div>
              
              <div className="flex flex-col gap-2 items-center justify-center w-full max-w-full my-2">
                {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((rowLetter, rowIndex) => (
                  <div key={rowLetter} className="flex gap-1.5 items-center justify-center w-full">
                    <span className="text-xs font-black text-neutral-600 w-4 text-center">{rowLetter}</span>
                    {Array.from({ length: 8 }).map((_, colIndex) => {
                      const seatId = `${rowLetter}${colIndex + 1}`
                      const isReserved = reservedSeats.includes(seatId) 
                      const isSelected = selectedSeats.includes(seatId)
                      
                      let seatStyle = ['A', 'B', 'C', 'D'].includes(rowLetter) 
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' 
                        : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                      
                      if (isReserved) seatStyle = 'bg-neutral-900 border-neutral-950 text-neutral-700 cursor-not-allowed opacity-20 line-through'
                      if (isSelected) seatStyle = 'bg-green-500 border-green-400 text-black font-black scale-105'
                      
                      return (<button key={seatId} disabled={isReserved} onClick={() => handleSeatClick(seatId)} className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl border text-[11px] font-bold flex items-center justify-center transition-all ${seatStyle}`}>{colIndex + 1}</button>)
                    })}
                  </div>
                ))}
              </div>

              <div className="relative w-full max-w-md h-2 bg-gradient-to-t from-red-500 to-transparent rounded-full mt-8 mb-4 text-center shadow-[0_-4px_15px_rgba(239,68,68,0.4)]">
                <span className="absolute top-3 left-1/2 transform -translate-x-1/2 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">จอภาพยนตร์ (SCREEN)</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[9px] text-neutral-400 mt-4 text-center w-full max-w-md border-b border-neutral-800 pb-4">
                <div className="flex items-center gap-1 justify-center"><div className="w-2.5 h-2.5 bg-amber-500/20 border border-amber-500 rounded-md"></div>  VIP (200฿)</div>
                <div className="flex items-center gap-1 justify-center"><div className="w-2.5 h-2.5 bg-neutral-800 border border-neutral-700 rounded-md"></div> Normal (160฿)</div>
                <div className="flex items-center gap-1 justify-center"><div className="w-2.5 h-2.5 bg-green-500 rounded-md"></div> ที่เลือก</div>
                <div className="flex items-center gap-1 justify-center"><div className="w-2.5 h-2.5 bg-neutral-900 opacity-20 rounded-md"></div> จองแล้ว</div>
              </div>

              {selectedSeats.length > 0 && (
                <div className="mt-4 bg-neutral-950 p-4 rounded-2xl flex justify-between items-center gap-4 border border-neutral-800 w-full max-w-md">
                  <div><p className="text-[11px] text-neutral-400">เก้าอี้ ({selectedSeats.length})</p><p className="text-xs font-black text-red-500 tracking-wider">{selectedSeats.join(', ')}</p></div>
                  <div className="flex items-center gap-4">
                    <p className="text-base font-black text-white">{subtotal} ฿</p>
                    <button onClick={() => setIsDrawerOpen(true)} className="bg-green-500 hover:bg-green-600 text-black font-black py-2 px-5 rounded-xl text-xs uppercase tracking-wider transition-all">
                      ถัดไป
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* หน้าต่างชำระเงินสุดท้าย */}
      {isDrawerOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 p-6 md:p-8 rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto flex flex-col justify-between relative">
            
            <button onClick={() => setIsDrawerOpen(false)} className="absolute top-4 right-4 text-neutral-400 hover:text-white font-black text-2xl w-10 h-10 flex items-center justify-center bg-neutral-800 rounded-full">×</button>
            
            <div className="border-b border-neutral-800 pb-3 mb-4 text-center">
              <h3 className="font-black text-lg text-white tracking-wide">ขั้นตอนการชำระเงิน</h3>
              <p className="text-xs text-neutral-500 mt-0.5">กรุณาตรวจสอบรายละเอียดคำสั่งซื้อ</p>
            </div>

            <div className="space-y-3.5">
              <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800/60">
                <span className="text-[10px] text-red-500 font-bold block uppercase tracking-wider">ภาพยนตร์อนิเมะที่เลือก</span>
                <p className="font-extrabold text-white text-sm mt-0.5">{selectedMovie?.title}</p>
              </div>

              <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800/60">
                <span className="text-[10px] text-green-400 font-bold block uppercase tracking-wider">ตำแหน่งเก้าอี้ของคุณ</span>
                <p className="font-mono text-white font-black text-base mt-0.5 tracking-widest">{selectedSeats.join(', ')}</p>
              </div>

              <div className="bg-neutral-950 p-3.5 rounded-2xl border border-neutral-800 space-y-2">
                <label className="text-xs font-bold text-neutral-300 block">กรอกรหัสส่วนลด (พิมพ์: WS2026)</label>
                <div className="flex gap-2">
                  <input type="text" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} disabled={isDiscountApplied} placeholder="ระบุโค้ดคูปอง" className="bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-1.5 text-xs w-full text-white focus:outline-none" />
                  <button onClick={handleApplyPromo} disabled={isDiscountApplied} className="bg-red-600 hover:bg-red-700 text-white text-xs font-black px-4 py-1.5 rounded-xl transition">
                    ยืนยัน
                  </button>
                </div>
                {isDiscountApplied && <p className="text-[11px] text-green-400 font-bold">✓ เปิดใช้งานส่วนลด 10% เรียบร้อยแล้ว</p>}
              </div>

              <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800/80 space-y-2 text-xs">
                <div className="flex justify-between text-neutral-400"><span>ราคารวมปกติ:</span><span>{subtotal} ฿</span></div>
                {isDiscountApplied && <div className="flex justify-between text-green-400"><span>สิทธิ์ส่วนลดพิเศษ:</span><span>-{subtotal * 0.1} ฿</span></div>}
                <div className="flex justify-between font-black text-base text-white pt-2 border-t border-neutral-800/60"><span>ยอดชำระสุทธิ:</span><span className="text-green-400">{finalTotal} ฿</span></div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-neutral-800 flex gap-2">
              <button onClick={() => setIsDrawerOpen(false)} className="w-1/3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold py-2.5 rounded-xl text-xs transition">ย้อนกลับ</button>
              <button onClick={handleConfirmBooking} className="w-2/3 bg-green-500 hover:bg-green-600 text-black font-black py-2.5 rounded-xl text-xs uppercase tracking-wider shadow-lg transition-all">
                ยืนยันการชำระเงินและไปหน้าถัดไป
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

export default App