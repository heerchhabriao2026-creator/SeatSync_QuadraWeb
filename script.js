// ========================================== 
// SUPABASE CONNECTION & STATE MANAGEMENT
// ========================================== 

const SUPABASE_URL = "https://hmgcpesjtdlteeaxskzy.supabase.co"; 
const SUPABASE_KEY = "sb_publishable_qiYg_xu6SEJtyj-QQRh7uA_6qF2vylp"; 

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY); 

let allSeats = []; 
let selectedSeatId = null; 
let currentUser = null; 
let realtimeChannel = null;
let activeSessionStartTime = null;

let occupancyChartInstance = null;
let zoneChartInstance = null;

// DOM Elements
const studentTabBtn = document.getElementById("studentTabBtn"); 
const staffTabBtn = document.getElementById("staffTabBtn"); 
const analyticsTabBtn = document.getElementById("analyticsTabBtn");
const studentView = document.getElementById("studentView");
const staffView = document.getElementById("staffView");
const analyticsView = document.getElementById("analyticsView");
const showLoginBtn = document.getElementById("showLoginBtn"); 
const showSignupBtn = document.getElementById("showSignupBtn"); 
const loginForm = document.getElementById("loginForm"); 
const signupForm = document.getElementById("signupForm"); 
const sitDownModal = document.getElementById("sitDownModal");
const sitDownTitle = document.getElementById("sitDownTitle");
const sitDownRegInput = document.getElementById("sitDownRegInput");
const leaveChoiceModal = document.getElementById("leaveChoiceModal"); 
const leaveChoiceTitle = document.getElementById("leaveChoiceTitle"); 
const departureModal = document.getElementById("departureModal"); 
const timeInput = document.getElementById("returnTimeInput"); 
const seatSearchInput = document.getElementById("seatSearchInput");
const zoneFilterSelect = document.getElementById("zoneFilterSelect");
const staffSearchInput = document.getElementById("staffSearchInput");

// ========================================== 
// NAVIGATION
// ========================================== 

studentTabBtn.addEventListener("click", () => { 
    if (!currentUser) return; 
    setTabActive(studentTabBtn);
    showView(studentView);
}); 

analyticsTabBtn.addEventListener("click", () => { 
    if (!currentUser) return; 
    setTabActive(analyticsTabBtn);
    showView(analyticsView);
    renderAnalytics();
}); 

staffTabBtn.addEventListener("click", () => { 
    if (!currentUser) return; 
    const role = currentUser.user_metadata?.role || "student"; 
    if (role !== "staff") return; 

    setTabActive(staffTabBtn);
    showView(staffView);
}); 

function setTabActive(activeBtn) {
    [studentTabBtn, staffTabBtn, analyticsTabBtn].forEach(btn => btn.classList.remove("active"));
    activeBtn.classList.add("active");
}

function showView(targetView) {
    [studentView, staffView, analyticsView].forEach(view => view.classList.add("hidden"));
    targetView.classList.remove("hidden");
}

showLoginBtn.addEventListener("click", () => { 
    loginForm.classList.remove("hidden"); 
    signupForm.classList.add("hidden"); 
    showLoginBtn.classList.add("active"); 
    showSignupBtn.classList.remove("active"); 
}); 

showSignupBtn.addEventListener("click", () => { 
    signupForm.classList.remove("hidden"); 
    loginForm.classList.add("hidden"); 
    showSignupBtn.classList.add("active"); 
    showSignupBtn.classList.remove("active"); 
}); 

// Filters
if (seatSearchInput) seatSearchInput.addEventListener("input", renderStudentView);
if (zoneFilterSelect) zoneFilterSelect.addEventListener("change", renderStudentView);
if (staffSearchInput) staffSearchInput.addEventListener("input", renderStaffView);

// ========================================== 
// AUTHENTICATION
// ========================================== 

signupForm.addEventListener("submit", async (e) => { 
    e.preventDefault();
    const email = document.getElementById("signupEmail").value.trim(); 
    const password = document.getElementById("signupPassword").value; 
    const role = document.getElementById("signupRole").value; 
    const errorBox = document.getElementById("signupError"); 

    errorBox.classList.add("hidden"); 

    if (password.length < 6) { 
        errorBox.textContent = "Password must be at least 6 characters."; 
        errorBox.classList.remove("hidden"); 
        return; 
    } 

    try { 
        const { error } = await supabaseClient.auth.signUp({ 
            email, password, options: { data: { role } } 
        }); 
        if (error) throw error; 

        alert("Account created! You can now log in."); 
        showLoginBtn.click();
    } catch (error) { 
        errorBox.textContent = error.message; 
        errorBox.classList.remove("hidden"); 
    } 
}); 

loginForm.addEventListener("submit", async (e) => { 
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim(); 
    const password = document.getElementById("loginPassword").value; 
    const errorBox = document.getElementById("loginError"); 

    errorBox.classList.add("hidden"); 

    try { 
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password }); 
        if (error) throw error; 

        currentUser = data.user; 
        setupRoleView(currentUser); 
        document.getElementById("authScreen").classList.add("hidden"); 
        document.getElementById("appContainer").classList.remove("hidden"); 

        await loadSeats(); 
        await loadStudentHabits();
        subscribeToRealtime();
    } catch (error) { 
        errorBox.textContent = error.message; 
        errorBox.classList.remove("hidden"); 
    } 
}); 

// ========================================== 
// DATA FETCHING & REALTIME
// ========================================== 

async function loadSeats() { 
    const { data, error } = await supabaseClient.from("seats").select("*").order("seat_number"); 
    if (error) return; 

    allSeats = data || []; 
    renderStudentView(); 
    renderStaffView(); 
} 

function subscribeToRealtime() {
    if (realtimeChannel) return;
    realtimeChannel = supabaseClient.channel('public:seats')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'seats' }, () => loadSeats())
        .subscribe();
}

// ========================================== 
// STUDENT HABITS & STATS
// ========================================== 

async function loadStudentHabits() {
    if (!currentUser) return;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: sessions, error } = await supabaseClient
        .from("study_sessions")
        .select("*")
        .eq("user_id", currentUser.id)
        .gte("created_at", sevenDaysAgo.toISOString());

    if (error || !sessions || sessions.length === 0) {
        document.getElementById("userWeeklyHours").textContent = "0.0 hrs";
        document.getElementById("userBreakCompliance").textContent = "100%";
        return;
    }

    const totalMinutes = sessions.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0);
    document.getElementById("userWeeklyHours").textContent = `${(totalMinutes / 60).toFixed(1)} hrs`;

    const breakSessions = sessions.filter(s => s.break_taken);
    if (breakSessions.length === 0) {
        document.getElementById("userBreakCompliance").textContent = "100%";
    } else {
        const onTimeBreaks = breakSessions.filter(s => s.break_on_time).length;
        document.getElementById("userBreakCompliance").textContent = `${Math.round((onTimeBreaks / breakSessions.length) * 100)}%`;
    }
}

async function logCompletedSession(seat, wasOverdue = false) {
    if (!currentUser || !activeSessionStartTime) return;

    const endTime = new Date();
    const durationMinutes = Math.max(1, Math.round((endTime - activeSessionStartTime) / (1000 * 60)));

    await supabaseClient.from("study_sessions").insert({
        user_id: currentUser.id,
        seat_number: seat.seat_number,
        zone: seat.zone || 'quiet',
        start_time: activeSessionStartTime.toISOString(),
        end_time: endTime.toISOString(),
        duration_minutes: durationMinutes,
        break_taken: seat.departure_stage !== null,
        break_on_time: !wasOverdue
    });

    activeSessionStartTime = null;
    loadStudentHabits();
}

// ========================================== 
// STUDENT VIEW RENDERING & INTERACTION
// ========================================== 

function renderStudentView() { 
    const container = document.getElementById("seatContainer"); 
    if (!container) return;
    container.innerHTML = ""; 

    let available = 0; 
    allSeats.forEach(s => { if (s.status === "available") available++; });

    const loadEl = document.getElementById("loadPercentage");
    if (loadEl) loadEl.textContent = `${Math.round(((allSeats.length - available) / allSeats.length) * 100)}%`;

    document.getElementById("availableCount").textContent = available; 
    document.getElementById("occupiedCount").textContent = allSeats.length - available; 
    document.getElementById("totalCount").textContent = allSeats.length; 

    const query = seatSearchInput ? seatSearchInput.value.toLowerCase().trim() : "";
    const selectedZone = zoneFilterSelect ? zoneFilterSelect.value : "all";

    const filteredSeats = allSeats.filter(seat => {
        const matchesQuery = seat.seat_number.toLowerCase().includes(query) || (seat.reg_number && seat.reg_number.toLowerCase().includes(query));
        const matchesZone = selectedZone === "all" || seat.zone === selectedZone;
        return matchesQuery && matchesZone;
    });

    filteredSeats.forEach(seat => { 
        const btn = document.createElement("button"); 
        btn.classList.add("seat"); 

        if (seat.status === "available") { 
            btn.classList.add("available"); 
            btn.innerHTML = `<strong>${seat.seat_number}</strong><span>🟢 Available</span>`; 
        } else if (seat.departure_stage === "overdue") { 
            btn.classList.add("overdue"); 
            btn.innerHTML = `<strong>${seat.seat_number}</strong><span>⚠️ OVERDUE</span>`; 
        } else if (seat.departure_stage === "reminder") { 
            btn.classList.add("reminder"); 
            btn.innerHTML = `<strong>${seat.seat_number}</strong><span>⏰ ${getMinutesLeft(seat.return_time)}</span>`; 
        } else if (seat.departure_stage === "active") { 
            btn.classList.add("reserved"); 
            btn.innerHTML = `<strong>${seat.seat_number}</strong><span>🚶 Back by ${formatTime(seat.return_time)}</span>`; 
        } else { 
            btn.classList.add("occupied"); 
            btn.innerHTML = `<strong>${seat.seat_number}</strong><span>🔴 ${seat.reg_number ?? "Occupied"}</span>`; 
        } 

        btn.addEventListener("click", () => handleSeatClick(seat)); 
        container.appendChild(btn); 
    }); 
} 

function handleSeatClick(seat) { 
    // Prevent sitting down if user already occupies another seat
    const alreadySeated = allSeats.find(s => s.user_id === (currentUser?.id) && s.status !== "available");

    if (seat.status === "available") { 
        if (alreadySeated) {
            alert(`You are already occupying Seat ${alreadySeated.seat_number}. Please release your current seat first!`);
            return;
        }
        selectedSeatId = seat.id; 
        sitDownTitle.textContent = `Sit at Seat ${seat.seat_number}?`; 
        sitDownRegInput.value = ""; 
        sitDownModal.classList.remove("hidden"); 
        return; 
    } 

    if (seat.departure_stage === "active" || seat.departure_stage === "reminder") { 
        if (seat.user_id !== currentUser?.id) return alert("This seat belongs to another student."); 
        handleImBack(seat); 
        return; 
    } 

    if (seat.status === "occupied") { 
        if (seat.user_id === currentUser?.id) { 
            selectedSeatId = seat.id; 
            leaveChoiceTitle.textContent = `Leaving Seat ${seat.seat_number}?`; 
            leaveChoiceModal.classList.remove("hidden"); 
        } else {
            alert("This seat is currently occupied by another user.");
        }
    } 
} 

// ==========================================
// CONFIRM SEAT FORM SUBMISSION (FIXED)
// ==========================================

document.getElementById("sitDownForm").addEventListener("submit", async function(e) { 
    e.preventDefault(); 
    
    const regNumber = sitDownRegInput.value.trim(); 

    if (!selectedSeatId || !regNumber) {
        alert("Please enter a valid Registration Number.");
        return;
    }

    const activeUserId = currentUser ? currentUser.id : regNumber;

    try {
        const { data, error } = await supabaseClient
            .from("seats")
            .update({ 
                status: "occupied", 
                reg_number: regNumber, 
                user_id: activeUserId, 
                return_time: null, 
                departure_stage: null 
            })
            .eq("id", selectedSeatId)
            .select();

        if (error) throw error;

        if (!data || data.length === 0) {
            alert("Database Error: Update was blocked by database rules (RLS). Disable RLS or set an update policy in Supabase.");
            return;
        }

        activeSessionStartTime = new Date();
        sitDownModal.classList.add("hidden"); 
        await loadSeats(); 
    } catch (error) {
        if (error.message.includes("one_seat_per_user")) {
            alert("You already have an active seat! Release your existing seat first.");
        } else {
            alert("Failed to confirm seat: " + error.message);
        }
    }
}); 

document.getElementById("doneTodayBtn").addEventListener("click", async () => { 
    const targetSeat = allSeats.find(s => s.id === selectedSeatId);
    if (targetSeat) await logCompletedSession(targetSeat);

    await supabaseClient.from("seats").update({ 
        status: "available", reg_number: null, user_id: null, return_time: null, departure_stage: null 
    }).eq("id", selectedSeatId); 

    leaveChoiceModal.classList.add("hidden"); 
    loadSeats(); 
}); 

document.getElementById("takingBreakBtn").addEventListener("click", () => { 
    leaveChoiceModal.classList.add("hidden"); 
    departureModal.classList.remove("hidden"); 
}); 

document.getElementById("departureForm").addEventListener("submit", async (e) => { 
    e.preventDefault();
    const [hours, minutes] = timeInput.value.split(":").map(Number); 
    const returnDate = new Date(); 
    returnDate.setHours(hours, minutes, 0); 
    if (returnDate <= new Date()) returnDate.setDate(returnDate.getDate() + 1); 

    await supabaseClient.from("seats").update({ 
        return_time: returnDate.toISOString(), departure_stage: "active" 
    }).eq("id", selectedSeatId); 

    departureModal.classList.add("hidden"); 
    loadSeats(); 
}); 

async function handleImBack(seat) { 
    if (!confirm(`Mark yourself as returned to Seat ${seat.seat_number}?`)) return; 
    await supabaseClient.from("seats").update({ return_time: null, departure_stage: null }).eq("id", seat.id); 
    loadSeats(); 
} 

// ========================================== 
// STAFF VIEW & ANALYTICS
// ========================================== 

function renderStaffView() { 
    const tbody = document.getElementById("departuresBody"); 
    if (!tbody) return;
    tbody.innerHTML = ""; 

    let available = 0;
    let overdueCount = 0;

    allSeats.forEach(s => { 
        if (s.status === "available") available++; 
        if (s.departure_stage === "overdue") overdueCount++;
    });

    document.getElementById("staffAvailableCount").textContent = available;
    document.getElementById("staffOverdueCount").textContent = overdueCount;
    document.getElementById("staffTotalCount").textContent = allSeats.length;

    const query = staffSearchInput ? staffSearchInput.value.toLowerCase().trim() : "";

    const departures = allSeats.filter(s => {
        if (!s.departure_stage) return false;
        return s.seat_number.toLowerCase().includes(query) || (s.reg_number && s.reg_number.toLowerCase().includes(query));
    }); 

    document.getElementById("noDepartures").classList.toggle("hidden", departures.length > 0); 

    departures.forEach(seat => { 
        const row = document.createElement("tr"); 

        let statusClass = "status-ontime";
        let statusText = "On time";
        if (seat.departure_stage === "overdue") {
            statusClass = "status-overdue";
            statusText = "🧳 Overdue";
        } else if (seat.departure_stage === "reminder") {
            statusClass = "status-reminder";
            statusText = "⏰ Reminder";
        }

        row.innerHTML = ` 
            <td><strong>${seat.seat_number}</strong></td> 
            <td>${seat.reg_number ?? "-"}</td> 
            <td>${formatTime(seat.return_time)}</td> 
            <td class="${statusClass}">${statusText}</td> 
            <td><button class="btn-primary" onclick="clearSeat('${seat.id}')">Make Available</button></td>   
        `; 
        tbody.appendChild(row); 
    }); 
} 

async function clearSeat(seatId) { 
    if (!confirm("Clear this seat and release belongings?")) return; 
    const seat = allSeats.find(s => s.id === seatId);
    if (seat) await logCompletedSession(seat, seat.departure_stage === "overdue");

    await supabaseClient.from("seats").update({ 
        status: "available", reg_number: null, user_id: null, return_time: null, departure_stage: null 
    }).eq("id", seatId); 

    loadSeats(); 
} 

function renderAnalytics() {
    if (occupancyChartInstance) occupancyChartInstance.destroy();
    if (zoneChartInstance) zoneChartInstance.destroy();

    const ctx1 = document.getElementById("occupancyChart").getContext("2d");
    occupancyChartInstance = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'],
            datasets: [{ label: 'Occupancy %', data: [15, 45, 78, 92, 85, 60, 30], borderColor: '#6a4fd6', fill: true, backgroundColor: 'rgba(106, 79, 214, 0.1)' }]
        }
    });

    const ctx2 = document.getElementById("zoneChart").getContext("2d");
    zoneChartInstance = new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: ['Quiet', 'Group', 'PC'],
            datasets: [{ data: [
                allSeats.filter(s => s.zone === 'quiet').length,
                allSeats.filter(s => s.zone === 'group').length,
                allSeats.filter(s => s.zone === 'pc').length
            ], backgroundColor: ['#8b7cf6', '#b07cff', '#4f46a5'] }]
        }
    });
}

// Helpers
function formatTime(iso) { return iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""; }
function getMinutesLeft(iso) { const diff = new Date(iso) - new Date(); return diff <= 0 ? "OVERDUE" : `${Math.ceil(diff / 60000)}m left`; }

document.getElementById("cancelSitDownBtn").onclick = () => sitDownModal.classList.add("hidden");
document.getElementById("cancelLeaveChoiceBtn").onclick = () => leaveChoiceModal.classList.add("hidden");
document.getElementById("cancelDepartureBtn").onclick = () => departureModal.classList.add("hidden");

function setupRoleView(user) { 
    const role = user.user_metadata?.role || "student"; 
    document.getElementById("welcomeText").innerHTML = `👋 <strong>${user.email}</strong> (${role.toUpperCase()})`; 
    staffTabBtn.classList.toggle("hidden", role !== "staff"); 
} 

document.getElementById("logoutBtn").onclick = async () => { 
    await supabaseClient.auth.signOut(); 
    location.reload(); 
}; 

async function checkDepartures() {
    const now = new Date();
    for (const seat of allSeats) {
        if (!seat.return_time) continue;
        const diff = new Date(seat.return_time) - now;
        if (diff <= 0 && seat.departure_stage !== "overdue") {
            await supabaseClient.from("seats").update({ departure_stage: "overdue" }).eq("id", seat.id);
        }
    }
}

async function startApp() { 
    const { data: { session } } = await supabaseClient.auth.getSession(); 
    if (session) { 
        currentUser = session.user; 
        setupRoleView(currentUser); 
        document.getElementById("authScreen").classList.add("hidden"); 
        document.getElementById("appContainer").classList.remove("hidden"); 
        await loadSeats(); 
        await loadStudentHabits();
        subscribeToRealtime(); 
    } 
    setInterval(checkDepartures, 15000); 
} 

startApp();