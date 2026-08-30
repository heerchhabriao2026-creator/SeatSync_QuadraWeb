// ==========================================
// SUPABASE CONNECTION
// ==========================================

const SUPABASE_URL = "https://hmgcpesjtdlteeaxskzy.supabase.co";
const SUPABASE_KEY = "sb_publishable_qiYg_xu6SEJtyj-QQRh7uA_6qF2vylp";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let allSeats = [];
let selectedSeatId = null;

const REMINDER_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// ==========================================
// TAB SWITCHING
// ==========================================

const studentTabBtn = document.getElementById("studentTabBtn");
const staffTabBtn = document.getElementById("staffTabBtn");
const studentView = document.getElementById("studentView");
const staffView = document.getElementById("staffView");

studentTabBtn.addEventListener("click", () => {
    studentTabBtn.classList.add("active");
    staffTabBtn.classList.remove("active");
    studentView.classList.remove("hidden");
    staffView.classList.add("hidden");
});

staffTabBtn.addEventListener("click", () => {
    staffTabBtn.classList.add("active");
    studentTabBtn.classList.remove("active");
    staffView.classList.remove("hidden");
    studentView.classList.add("hidden");
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
            btn.innerHTML = `<strong>${seat.seat_number}</strong><span>⏰ Please return to your seat!</span>`;
            notAvailable++;
        } else if (seat.departure_stage === "active") {
            btn.classList.add("reserved");
            btn.innerHTML = `<strong>${seat.seat_number}</strong><span>🚶 Back by ${formatTime(seat.return_time)}</span>`;
            notAvailable++;
        } else {
            btn.classList.add("occupied");
            btn.innerHTML = `<strong>${seat.seat_number}</strong><span>🔴 Occupied</span>`;
            notAvailable++;
        }

        btn.addEventListener("click", () => handleSeatClick(seat));
        container.appendChild(btn);
    });

    document.getElementById("availableCount").textContent = available;
    document.getElementById("occupiedCount").textContent = notAvailable;
    document.getElementById("totalCount").textContent = allSeats.length;
}

function handleSeatClick(seat) {
    if (seat.status === "occupied" && !seat.departure_stage) {
        openDepartureModal(seat);
    } else if (seat.status === "available") {
        alert(`Seat ${seat.seat_number} is free — go ahead and sit!`);
    } else {
        alert(`Seat ${seat.seat_number} is already being tracked.`);
    }
}

// ==========================================
// DEPARTURE MODAL
// ==========================================

const modal = document.getElementById("departureModal");
const modalTitle = document.getElementById("modalSeatTitle");
const regInput = document.getElementById("regNumberInput");
const timeInput = document.getElementById("returnTimeInput");

function openDepartureModal(seat) {
    selectedSeatId = seat.id;
    modalTitle.textContent = `Leaving Seat ${seat.seat_number}?`;
    regInput.value = "";
    timeInput.value = "";
    modal.classList.remove("hidden");
}

document.getElementById("cancelDepartureBtn").addEventListener("click", () => {
    modal.classList.add("hidden");
});

document.getElementById("confirmDepartureBtn").addEventListener("click", async () => {
    const regNumber = regInput.value.trim();
    const timeValue = timeInput.value; // "HH:MM"

    if (!regNumber || !timeValue) {
        alert("Please enter both registration number and return time.");
        return;
    }

    const returnDate = buildReturnDateTime(timeValue);

    const { error } = await supabaseClient
        .from("seats")
        .update({
            reg_number: regNumber,
            return_time: returnDate.toISOString(),
            departure_stage: "active"
        })
        .eq("id", selectedSeatId);

    if (error) {
        console.error(error);
        alert("Something went wrong saving this. Try again.");
        return;
    }

    modal.classList.add("hidden");
    loadSeats();
});

// Converts a "HH:MM" input into a full Date object for today (or tomorrow if already past)
function buildReturnDateTime(timeValue) {
    const [hours, minutes] = timeValue.split(":").map(Number);
    const now = new Date();
    const result = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);

    if (result <= now) {
        result.setDate(result.getDate() + 1); // assume next day if time already passed
    }
    return result;
}

function formatTime(isoString) {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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

loadSeats();
setInterval(checkDepartures, 15000); // check every 15 seconds