// ==========================================
// SUPABASE CONNECTION
// ==========================================

const SUPABASE_URL = "https://hmgcpesjtdlteeaxskzy.supabase.co";
const SUPABASE_KEY = "sb_publishable_qiYg_xu6SEJtyj-QQRh7uA_6qF2vylp";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let allSeats = [];
let selectedSeatId = null;
let currentUser = null;

const REMINDER_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// ==========================================
// STUDENT / STAFF TAB SWITCHING
// ==========================================

const studentTabBtn =
    document.getElementById("studentTabBtn");

const staffTabBtn =
    document.getElementById("staffTabBtn");

studentTabBtn.addEventListener("click", () => {

    // Only staff/student depending on role
    if (!currentUser) return;

    studentTabBtn.classList.add("active");
    staffTabBtn.classList.remove("active");

    studentView.classList.remove("hidden");
    staffView.classList.add("hidden");
});


staffTabBtn.addEventListener("click", () => {

    if (!currentUser) return;

    const role =
        currentUser.user_metadata?.role || "student";

    // STUDENTS ARE NOT ALLOWED
    if (role !== "staff") {
        return;
    }

    staffTabBtn.classList.add("active");
    studentTabBtn.classList.remove("active");

    staffView.classList.remove("hidden");
    studentView.classList.add("hidden");
});
// ==========================================
// LOGIN / CREATE ACCOUNT TABS
// ==========================================

const showLoginBtn = document.getElementById("showLoginBtn");
const showSignupBtn = document.getElementById("showSignupBtn");

const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");

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
    showLoginBtn.classList.remove("active");

});


// ==========================================
// CREATE ACCOUNT
// ==========================================

document.getElementById("signupBtn").addEventListener("click", async () => {

    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;
    const role = document.getElementById("signupRole").value;

    const errorBox = document.getElementById("signupError");

    errorBox.classList.add("hidden");
    errorBox.textContent = "";

    if (!email || !password) {
        errorBox.textContent = "Please enter email and password.";
        errorBox.classList.remove("hidden");
        return;
    }

    if (password.length < 6) {
        errorBox.textContent = "Password must be at least 6 characters.";
        errorBox.classList.remove("hidden");
        return;
    }

    const signupBtn = document.getElementById("signupBtn");

    signupBtn.disabled = true;
    signupBtn.textContent = "Creating...";

    try {

        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    role: role
                }
            }
        });

        if (error) {
            throw error;
        }

        console.log("Account created:", data);

        // Clear signup fields
        document.getElementById("signupEmail").value = "";
        document.getElementById("signupPassword").value = "";

        // Go to LOGIN tab
        document.getElementById("signupForm").classList.add("hidden");
        document.getElementById("loginForm").classList.remove("hidden");

        document.getElementById("showSignupBtn").classList.remove("active");
        document.getElementById("showLoginBtn").classList.add("active");

        // Put email into login automatically
        document.getElementById("loginEmail").value = email;

        alert("Account created! You can now log in. 🎉");

    } catch (error) {

        console.error("Signup error:", error);

        errorBox.textContent = error.message;
        errorBox.classList.remove("hidden");

    } finally {

        signupBtn.disabled = false;
        signupBtn.textContent = "Create Account";

    }

});

// ==========================================
// LOGIN
// ==========================================

document.getElementById("loginBtn").addEventListener("click", async () => {

    const email = document
        .getElementById("loginEmail")
        .value
        .trim();

    const password = document
        .getElementById("loginPassword")
        .value;

    const errorBox = document.getElementById("loginError");

    errorBox.classList.add("hidden");
    errorBox.textContent = "";

    // Check input
    if (!email || !password) {
        errorBox.textContent = "Please enter email and password.";
        errorBox.classList.remove("hidden");
        return;
    }

    const loginBtn = document.getElementById("loginBtn");

    loginBtn.disabled = true;
    loginBtn.textContent = "Logging in...";

    try {

        const { data, error } =
            await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

        if (error) {
            throw error;
        }

        console.log("Login successful:", data);

        currentUser = data.user;

        // Setup student/staff view
        setupRoleView(currentUser);

        // Hide login screen
        document
            .getElementById("authScreen")
            .classList.add("hidden");

        // Show main application
        document
            .getElementById("appContainer")
            .classList.remove("hidden");

        // Load seats
        await loadSeats();

    } catch (error) {

        console.error("Login error:", error);

        errorBox.textContent = error.message;
        errorBox.classList.remove("hidden");

    } finally {

        loginBtn.disabled = false;
        loginBtn.textContent = "Login";

    }

});
// ==========================================
// LOAD SEATS
// ==========================================

async function loadSeats() {

    const { data, error } = await supabaseClient
        .from("seats")
        .select("*")
        .order("id");

    if (error) {
        console.error("Supabase Error:", error);

        document.getElementById("seatContainer").innerHTML =
            "<p>❌ Unable to load seats.</p>";

        return;
    }

    allSeats = data;

    renderStudentView();
    renderStaffView();
}
// ==========================================
// STUDENT VIEW
// ==========================================

function renderStudentView() {
    const container = document.getElementById("seatContainer");
    container.innerHTML = "";

    let available = 0;
    let notAvailable = 0;

    allSeats.forEach(seat => {
        const btn = document.createElement("button");
        btn.classList.add("seat");

        if (seat.status === "available") {
            btn.classList.add("available");
            btn.innerHTML = `<strong>${seat.seat_number}</strong><span>🟢 Available</span>`;
            available++;
        } else if (seat.departure_stage === "overdue") {
            btn.classList.add("overdue");
            btn.innerHTML = `<strong>${seat.seat_number}</strong><span>🧳 Belongings kept aside</span>`;
            notAvailable++;
        } else if (seat.departure_stage === "reminder") {
            btn.classList.add("reminder");
            btn.innerHTML = `<strong>${seat.seat_number}</strong><span>⏰ 5 mins left!</span>`;
            notAvailable++;
        } else if (seat.departure_stage === "active") {
            btn.classList.add("reserved");
            btn.innerHTML = `<strong>${seat.seat_number}</strong><span>🚶 Back by ${formatTime(seat.return_time)}</span>`;
            notAvailable++;
        } else {
            btn.classList.add("occupied");
            btn.innerHTML = `<strong>${seat.seat_number}</strong><span>🔴 ${seat.reg_number ?? "Occupied"}</span>`;
            notAvailable++;
        }

        btn.addEventListener("click", () => handleSeatClick(seat));
        container.appendChild(btn);
    });

    document.getElementById("availableCount").textContent = available;
    document.getElementById("occupiedCount").textContent = notAvailable;
    document.getElementById("totalCount").textContent = allSeats.length;
}

// ==========================================
// SEAT CLICK ROUTER
// ==========================================

function handleSeatClick(seat) {
    if (seat.status === "available") {
        openSitDownModal(seat);
    } else if (seat.departure_stage === "overdue") {
        alert(`Seat ${seat.seat_number}'s belongings were kept aside. Please see library staff.`);
    } else if (seat.departure_stage === "active" || seat.departure_stage === "reminder") {
        handleImBack(seat);
    } else {
        // occupied, present, no departure stage
        openLeaveChoiceModal(seat);
    }
}

// ==========================================
// SIT DOWN MODAL (available -> occupied)
// ==========================================

const sitDownModal = document.getElementById("sitDownModal");
const sitDownTitle = document.getElementById("sitDownTitle");
const sitDownRegInput = document.getElementById("sitDownRegInput");

function openSitDownModal(seat) {
    selectedSeatId = seat.id;
    sitDownTitle.textContent = `Sit at Seat ${seat.seat_number}?`;
    sitDownRegInput.value = "";
    sitDownModal.classList.remove("hidden");
}

document.getElementById("cancelSitDownBtn").addEventListener("click", () => {
    sitDownModal.classList.add("hidden");
});

// ==========================================
// SIT DOWN
// ==========================================

document.getElementById("confirmSitDownBtn")
.addEventListener("click", async () => {

    const regNumber =
        sitDownRegInput.value.trim();

    if (!regNumber) {
        alert("Please enter your registration number.");
        return;
    }

    if (!currentUser) {
        alert("Please log in first.");
        return;
    }

    // Check whether this student already has a seat
    const { data: existingSeat, error: checkError } =
        await supabaseClient
            .from("seats")
            .select("id, seat_number")
            .eq("user_id", currentUser.id)
            .maybeSingle();

    if (checkError) {

        console.error(checkError);
        alert("Unable to check your current seat.");
        return;
    }

    if (existingSeat) {

        alert(
            `You are already sitting at Seat ${existingSeat.seat_number}.\n\n` +
            `You can only occupy ONE seat at a time.`
        );

        sitDownModal.classList.add("hidden");
        return;
    }

    // Assign this seat to the logged-in user
    const { error } =
        await supabaseClient
            .from("seats")
            .update({
                status: "occupied",
                reg_number: regNumber,
                user_id: currentUser.id,
                return_time: null,
                departure_stage: null
            })
            .eq("id", selectedSeatId)
            .eq("status", "available");

    if (error) {

        console.error(error);
        alert("Something went wrong. Try again.");
        return;
    }

    sitDownModal.classList.add("hidden");

    await loadSeats();
});
// ==========================================
// LEAVE CHOICE MODAL (occupied -> break OR done)
// ==========================================

const leaveChoiceModal = document.getElementById("leaveChoiceModal");
const leaveChoiceTitle = document.getElementById("leaveChoiceTitle");

function openLeaveChoiceModal(seat) {
    selectedSeatId = seat.id;
    leaveChoiceTitle.textContent = `Leaving Seat ${seat.seat_number}?`;
    leaveChoiceModal.classList.remove("hidden");
}

document.getElementById("cancelLeaveChoiceBtn").addEventListener("click", () => {
    leaveChoiceModal.classList.add("hidden");
});

document.getElementById("takingBreakBtn").addEventListener("click", () => {
    leaveChoiceModal.classList.add("hidden");
    openDepartureModal();
});

document.getElementById("doneTodayBtn").addEventListener("click", async () => {
    const { error } = await supabaseClient
        .from("seats")
        .update({
    status: "available",
    reg_number: null,
    user_id: null,
    return_time: null,
    departure_stage: null
})
        .eq("id", selectedSeatId);

    if (error) {
        console.error(error);
        alert("Something went wrong. Try again.");
        return;
    }

    leaveChoiceModal.classList.add("hidden");
    loadSeats();
});

// ==========================================
// BREAK RETURN TIME MODAL
// ==========================================

const departureModal = document.getElementById("departureModal");
const timeInput = document.getElementById("returnTimeInput");

function openDepartureModal() {
    timeInput.value = "";
    departureModal.classList.remove("hidden");
}

document.getElementById("cancelDepartureBtn").addEventListener("click", () => {
    departureModal.classList.add("hidden");
});

document.getElementById("confirmDepartureBtn").addEventListener("click", async () => {
    const timeValue = timeInput.value; // "HH:MM"

    if (!timeValue) {
        alert("Please enter your expected return time.");
        return;
    }

    const returnDate = buildReturnDateTime(timeValue);

    const { error } = await supabaseClient
        .from("seats")
        .update({
            return_time: returnDate.toISOString(),
            departure_stage: "active"
        })
        .eq("id", selectedSeatId);

    if (error) {
        console.error(error);
        alert("Something went wrong. Try again.");
        return;
    }

    departureModal.classList.add("hidden");
    loadSeats();
});

// Converts a "HH:MM" input into a full Date object for today (or tomorrow if already past)
function buildReturnDateTime(timeValue) {
    const [hours, minutes] = timeValue.split(":").map(Number);
    const now = new Date();
    const result = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);

    if (result <= now) {
        result.setDate(result.getDate() + 1);
    }
    return result;
}

function formatTime(isoString) {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ==========================================
// "I'M BACK" (break/reminder -> present again)
// ==========================================

async function handleImBack(seat) {
    const confirmed = confirm(`Welcome back! Mark yourself as returned to Seat ${seat.seat_number}?`);
    if (!confirmed) return;

    const { error } = await supabaseClient
        .from("seats")
        .update({
            return_time: null,
            departure_stage: null
        })
        .eq("id", seat.id);

    if (error) {
        console.error(error);
        alert("Something went wrong. Try again.");
        return;
    }

    loadSeats();
}

// ==========================================
// STAFF VIEW
// ==========================================

function renderStaffView() {
    const tbody = document.getElementById("departuresBody");
    const noDepartures = document.getElementById("noDepartures");
    tbody.innerHTML = "";

    let available = 0;
    let overdue = 0;

    const departures = allSeats.filter(s => s.departure_stage);

    allSeats.forEach(seat => {
        if (seat.status === "available") available++;
        if (seat.departure_stage === "overdue") overdue++;
    });

    document.getElementById("staffAvailableCount").textContent = available;
    document.getElementById("staffOverdueCount").textContent = overdue;
    document.getElementById("staffTotalCount").textContent = allSeats.length;

    if (departures.length === 0) {
        noDepartures.classList.remove("hidden");
        return;
    }
    noDepartures.classList.add("hidden");

    departures.forEach(seat => {
        const row = document.createElement("tr");

        let statusLabel = "";
        let statusClass = "";

        if (seat.departure_stage === "active") {
            statusLabel = "On time";
            statusClass = "status-ontime";
        } else if (seat.departure_stage === "reminder") {
            statusLabel = "⏰ 5 min left";
            statusClass = "status-reminder";
        } else if (seat.departure_stage === "overdue") {
            statusLabel = "🧳 Overdue — belongings kept aside";
            statusClass = "status-overdue";
        }

        row.innerHTML = `
            <td>${seat.seat_number}</td>
            <td>${seat.reg_number ?? "-"}</td>
            <td>${formatTime(seat.return_time)}</td>
            <td class="${statusClass}">${statusLabel}</td>
            <td><button class="btn-secondary clear-btn" data-id="${seat.id}">Clear Seat</button></td>
        `;

        tbody.appendChild(row);
    });

    document.querySelectorAll(".clear-btn").forEach(btn => {
        btn.addEventListener("click", () => clearSeat(btn.dataset.id));
    });
}

async function clearSeat(seatId) {
    const { error } = await supabaseClient
        .from("seats")
        .update({
    status: "available",
    reg_number: null,
    user_id: null,
    return_time: null,
    departure_stage: null
})
        .eq("id", seatId);

    if (error) {
        console.error(error);
        alert("Couldn't clear the seat. Try again.");
        return;
    }
    loadSeats();
}

// ==========================================
// AUTO-CHECK REMINDERS & OVERDUE (every 15s)
// ==========================================

async function checkDepartures() {
    const now = new Date();

    for (const seat of allSeats) {
        if (!seat.departure_stage || !seat.return_time) continue;

        const returnTime = new Date(seat.return_time);
        const diff = returnTime - now;

        if (diff <= 0 && seat.departure_stage !== "overdue") {
            await supabaseClient
                .from("seats")
                .update({ departure_stage: "overdue" })
                .eq("id", seat.id);
        } else if (diff > 0 && diff <= REMINDER_WINDOW_MS && seat.departure_stage === "active") {
            await supabaseClient
                .from("seats")
                .update({ departure_stage: "reminder" })
                .eq("id", seat.id);
        }
    }

    loadSeats();
}

// ==========================================
// START
// ==========================================



// ==========================================
// SET USER ROLE / TAB VISIBILITY
// ==========================================

function setupRoleView(user) {

    currentUser = user;

    const role = user.user_metadata?.role || "student";

    const studentTabBtn = document.getElementById("studentTabBtn");
    const staffTabBtn = document.getElementById("staffTabBtn");

    if (role === "staff") {

        // Staff can see Staff section
        staffTabBtn.classList.remove("hidden");

        studentTabBtn.classList.remove("hidden");

        // Start on Staff view
        staffView.classList.remove("hidden");
        studentView.classList.add("hidden");

        staffTabBtn.classList.add("active");
        studentTabBtn.classList.remove("active");

    } else {

        // Student CANNOT see Staff section
        staffTabBtn.classList.add("hidden");

        // Student sees Student section
        studentTabBtn.classList.remove("hidden");

        studentView.classList.remove("hidden");
        staffView.classList.add("hidden");

        studentTabBtn.classList.add("active");
        staffTabBtn.classList.remove("active");
    }
}
// ==========================================
// LOGOUT
// ==========================================

document.getElementById("logoutBtn").addEventListener("click", async () => {

    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        console.error("Logout error:", error);
        alert("Unable to logout. Please try again.");
        return;
    }

    // Clear current user
    currentUser = null;

    // Hide app
    document.getElementById("appContainer")
        .classList.add("hidden");

    // Show login screen
    document.getElementById("authScreen")
        .classList.remove("hidden");

    // Reset views
    studentView.classList.add("hidden");
    staffView.classList.add("hidden");

    // Reset tabs
    document.getElementById("studentTabBtn")
        .classList.add("active");

    document.getElementById("staffTabBtn")
        .classList.remove("active");

    // Clear login password
    document.getElementById("loginPassword").value = "";

});

// ==========================================
// START APP
// ==========================================

async function startApp() {

    try {

        const {
            data: { session },
            error
        } = await supabaseClient.auth.getSession();

        if (error) {
            console.error("Session error:", error);
            return;
        }

        if (session) {

            currentUser = session.user;

            setupRoleView(currentUser);

            document
                .getElementById("authScreen")
                .classList.add("hidden");

            document
                .getElementById("appContainer")
                .classList.remove("hidden");

            await loadSeats();

        } else {

            document
                .getElementById("authScreen")
                .classList.remove("hidden");

            document
                .getElementById("appContainer")
                .classList.add("hidden");

        }

    } catch (error) {

        console.error("Startup error:", error);

    }

    // Check seats every 15 seconds
    setInterval(checkDepartures, 15000);
}


// ==========================================
// AUTH STATE CHANGE
// ==========================================

supabaseClient.auth.onAuthStateChange((event, session) => {

    console.log("Auth event:", event);

    if (event === "SIGNED_IN" && session) {
        currentUser = session.user;
    }

    if (event === "SIGNED_OUT") {
        currentUser = null;
    }

});


// ==========================================
// START
// ==========================================

startApp();