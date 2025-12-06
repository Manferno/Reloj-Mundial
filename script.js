const zoneSelect1 = document.getElementById('zone-1');
const zoneSelect2 = document.getElementById('zone-2');
const timeInput1 = document.getElementById('time-input-1');
const timeInput2 = document.getElementById('time-input-2');
const dateDisplay1 = document.getElementById('date-1');
const dateDisplay2 = document.getElementById('date-2');
const resetBtn = document.getElementById('reset-now-btn');

// Clock Hands
const hands1 = {
    hour: document.getElementById('hour-hand-1'),
    min: document.getElementById('min-hand-1'),
    second: document.getElementById('second-hand-1')
};
const hands2 = {
    hour: document.getElementById('hour-hand-2'),
    min: document.getElementById('min-hand-2'),
    second: document.getElementById('second-hand-2')
};

// State
let isLive = true;
let currentBaseTime = new Date(); // The source of truth
let updateInterval;

// Initialize
function init() {
    populateTimeZones();

    // Set defaults (User's local time + Jakarta as example)
    const userZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    zoneSelect1.value = userZone;
    zoneSelect2.value = "Asia/Jakarta";

    // If defaults aren't in the list (rare but possible), select first/last
    if (!zoneSelect1.value) zoneSelect1.selectedIndex = 0;
    if (!zoneSelect2.value) zoneSelect2.selectedIndex = zoneSelect2.options.length - 1;

    startClock();

    // Event Listeners
    zoneSelect1.addEventListener('change', () => updateDisplay(currentBaseTime));
    zoneSelect2.addEventListener('change', () => updateDisplay(currentBaseTime));

    timeInput1.addEventListener('input', (e) => handleManualInput(e.target.value, zoneSelect1.value));
    timeInput2.addEventListener('input', (e) => handleManualInput(e.target.value, zoneSelect2.value));

    resetBtn.addEventListener('click', () => {
        isLive = true;
        updateInterval = requestAnimationFrame(animate);
        resetBtn.style.display = 'none'; // Hide button when live
    });

    // Initially hide reset button as we are live
    resetBtn.style.display = 'none';
}

function populateTimeZones() {
    const timeZones = Intl.supportedValuesOf('timeZone');
    const fragment = document.createDocumentFragment();

    timeZones.forEach(zone => {
        const option = document.createElement('option');
        option.value = zone;
        option.textContent = zone.replace(/_/g, ' ');
        fragment.appendChild(option);
    });

    zoneSelect1.appendChild(fragment.cloneNode(true));
    zoneSelect2.appendChild(fragment);
}

function startClock() {
    function animate() {
        if (isLive) {
            currentBaseTime = new Date();
            updateDisplay(currentBaseTime);
            requestAnimationFrame(animate);
        }
    }
    animate();
}

function updateDisplay(baseDate) {
    const zone1 = zoneSelect1.value;
    const zone2 = zoneSelect2.value;

    updateClock(baseDate, zone1, hands1, timeInput1, dateDisplay1);
    updateClock(baseDate, zone2, hands2, timeInput2, dateDisplay2);
}

function updateClock(date, timeZone, hands, timeInput, dateDisplay) {
    // Get time in specific zone
    const options = {
        timeZone: timeZone,
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    };

    // We need to parse the locale string to get components for the analog clock
    // A more robust way is to use toLocaleString and parse, or create a date object shifted by offset.
    // Let's use the formatter to get the string, then parse it for the input.

    const formatter = new Intl.DateTimeFormat('en-US', {
        ...options,
        hour12: false
    });

    const parts = formatter.formatToParts(date);
    const getPart = (type) => parts.find(p => p.type === type).value;

    const h = parseInt(getPart('hour'));
    const m = parseInt(getPart('minute'));
    const s = parseInt(getPart('second'));

    // Update Analog Clock
    const secondsDegrees = ((s / 60) * 360);
    const minsDegrees = ((m / 60) * 360) + ((s / 60) * 6);
    const hourDegrees = ((h / 12) * 360) + ((m / 60) * 30);

    hands.second.style.transform = `translateX(-50%) rotate(${secondsDegrees}deg)`;
    hands.min.style.transform = `translateX(-50%) rotate(${minsDegrees}deg)`;
    hands.hour.style.transform = `translateX(-50%) rotate(${hourDegrees}deg)`;

    // Update Digital Input
    // Format: HH:mm
    const timeString = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

    // Only update value if it's not currently being focused/edited to avoid jumping cursor
    // But since we are syncing, we might need to. 
    // For "Live" mode, we always update. For manual mode, we update the *other* one.
    if (document.activeElement !== timeInput) {
        timeInput.value = timeString;
    }

    // Update Date Display
    // Use Spanish for display
    const dateString = new Intl.DateTimeFormat('es-ES', {
        timeZone: timeZone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(date);

    dateDisplay.textContent = dateString;
}

function handleManualInput(timeStr, sourceZone) {
    if (!timeStr) return;

    isLive = false;
    resetBtn.style.display = 'inline-flex';

    const [h, m] = timeStr.split(':').map(Number);

    // We need to construct a Date object that corresponds to this time in the sourceZone.
    // This is tricky because "Today" in sourceZone might be "Yesterday" or "Tomorrow" in UTC.
    // We will assume the date is the SAME date as the currently displayed date for that zone.

    // 1. Get current date components in sourceZone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: sourceZone,
        year: 'numeric', month: 'numeric', day: 'numeric'
    });
    const parts = formatter.formatToParts(now);
    const getPart = (type) => parts.find(p => p.type === type).value;

    const year = getPart('year');
    const month = getPart('month');
    const day = getPart('day');

    // 2. Create a string ISO-like that Date.parse might accept, or better:
    // Create a date in UTC, then adjust by the offset? No, offset changes.
    // Easiest way: Create a string "YYYY-MM-DDTHH:mm:00" and append the offset?
    // We don't know the offset easily without a library like moment-timezone or luxon.

    // Workaround using native Intl:
    // We iterate to find the UTC timestamp that results in this local time.
    // Or simpler: Set the UTC time to the input time, then subtract the offset.

    // Let's try a heuristic:
    // Construct a date assuming local browser time, then shift it.
    // Actually, let's just use the current baseTime, set its UTC hours/mins, and then correct it? No.

    // Let's use a robust method:
    // 1. Create a date string in the format "MM/DD/YYYY, HH:mm:ss"
    const dateStr = `${month}/${day}/${year}, ${h}:${m}:00`;

    // 2. We need to convert this "Wall Time" in `sourceZone` to a timestamp.
    // There is no direct native API for "Wall Time + Zone -> Timestamp".
    // Hack: We can use the fact that `new Date(string)` uses local browser zone.
    // We can't easily force it to parse as another zone.

    // Alternative:
    // We calculate the offset of the `currentBaseTime` for that zone.
    // Then apply the difference.

    // Get offset of currentBaseTime in sourceZone
    // This is complex to do purely natively without libraries for arbitrary zones.
    // BUT, we can just update the `currentBaseTime` to match the new hours/minutes roughly.

    // Let's try:
    // 1. Take currentBaseTime.
    // 2. Get its time in sourceZone.
    // 3. Calculate difference in minutes between "Input Time" and "Current Time in Zone".
    // 4. Add that difference to currentBaseTime.

    const currentInZone = new Intl.DateTimeFormat('en-US', {
        timeZone: sourceZone,
        hour: 'numeric', minute: 'numeric', hour12: false
    }).formatToParts(currentBaseTime);

    const curH = parseInt(currentInZone.find(p => p.type === 'hour').value);
    const curM = parseInt(currentInZone.find(p => p.type === 'minute').value);

    // Calculate difference in minutes
    let diffMinutes = (h * 60 + m) - (curH * 60 + curM);

    // Handle day wrap-around (e.g. changing from 23:59 to 00:01 is +2 mins, not -large)
    // Actually, the user just picked a time. We assume it's for the "current day" displayed.
    // So we just apply the linear difference.

    const newBaseTime = new Date(currentBaseTime.getTime() + diffMinutes * 60000);

    currentBaseTime = newBaseTime;
    updateDisplay(currentBaseTime);
}

init();
