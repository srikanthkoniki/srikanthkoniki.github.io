const SCOPES =
"https://www.googleapis.com/auth/spreadsheets " +
"https://www.googleapis.com/auth/drive.file";

const SHEETS_DISCOVERY =
"https://sheets.googleapis.com/$discovery/rest?version=v4";

const DRIVE_DISCOVERY =
"https://www.googleapis.com/discovery/v1/apis/drive/v3/rest";

let tokenClient = null;
let accessToken = null;
let spreadsheetId = null;

let viewDate = new Date();
let selectedDate = new Date();

viewDate = new Date(
viewDate.getFullYear(),
viewDate.getMonth(),
1
);

/* --------------------------------------------------
BASIC HELPERS
-------------------------------------------------- */

function $(id) {
return document.getElementById(id);
}

function pad(number) {
return String(number).padStart(2, "0");
}

function dateKey(date) {
return (
date.getFullYear() +
"-" +
pad(date.getMonth() + 1) +
"-" +
pad(date.getDate())
);
}

function monthKey(date) {
return (
date.getFullYear() +
"-" +
pad(date.getMonth() + 1)
);
}

function prettyDate(date) {
return date.toLocaleDateString(undefined, {
day: "numeric",
month: "short",
year: "numeric"
});
}

function prettyMonth(date) {
return date.toLocaleDateString(undefined, {
month: "long",
year: "numeric"
});
}

function escapeHTML(value) {
return String(value).replace(/[&<>"']/g, function (char) {
return {
"&": "&",
"<": "<",
">": ">",
'"': """,
"'": "'"
}[char];
});
}

/* --------------------------------------------------
GOOGLE INITIALIZATION
-------------------------------------------------- */

function googleConfigured() {
return (
window.PLANNER_CONFIG &&
window.PLANNER_CONFIG.CLIENT_ID &&
!window.PLANNER_CONFIG.CLIENT_ID.includes(
"PASTE_YOUR_GOOGLE_WEB_CLIENT_ID_HERE"
)
);
}

async function waitForGoogle() {
return new Promise((resolve) => {
const check = () => {
if (
window.google &&
window.google.accounts &&
window.gapi
) {
resolve();
} else {
setTimeout(check, 300);
}
};

```
check();
```

});
}

async function initializeGoogle() {

if (!googleConfigured()) {

```
$("loginMessage").innerHTML =
  "Google login is not configured yet.<br>" +
  "Add your Client ID to <b>config.js</b>.";

$("googleLoginBtn").disabled = true;

return;
```

}

await waitForGoogle();

gapi.load("client", async function () {

```
try {

  await gapi.client.init({
    discoveryDocs: [
      SHEETS_DISCOVERY,
      DRIVE_DISCOVERY
    ]
  });

  tokenClient =
    google.accounts.oauth2.initTokenClient({

      client_id:
        PLANNER_CONFIG.CLIENT_ID,

      scope: SCOPES,

      callback: async function (response) {

        if (response.error) {

          console.error(response);

          $("loginMessage").textContent =
            "Google login was cancelled or failed.";

          return;
        }

        accessToken = response.access_token;

        gapi.client.setToken({
          access_token: accessToken
        });

        try {
          await startPlanner();
        } catch (error) {

          console.error(error);

          $("loginMessage").textContent =
            "Could not open your planner. " +
            "Please check your Google API settings.";
        }
      }
    });

  $("googleLoginBtn").disabled = false;

} catch (error) {

  console.error(error);

  $("loginMessage").textContent =
    "Google API could not be initialized.";
}
```

});
}

/* --------------------------------------------------
LOGIN
-------------------------------------------------- */

$("googleLoginBtn").disabled = true;

$("googleLoginBtn").addEventListener(
"click",
function () {

```
if (!tokenClient) {

  $("loginMessage").textContent =
    "Google is still loading. Please try again.";

  return;
}

tokenClient.requestAccessToken({
  prompt: "consent"
});
```

}
);

/* --------------------------------------------------
START PLANNER
-------------------------------------------------- */

async function startPlanner() {

await findOrCreateSpreadsheet();

$("loginPage").classList.add("hidden");
$("appPage").classList.remove("hidden");

$("userName").textContent =
"Google account connected";

await renderAll();
}

/* --------------------------------------------------
FIND EXISTING PLANNER SHEET
-------------------------------------------------- */

async function findOrCreateSpreadsheet() {

const sheetName =
PLANNER_CONFIG.SHEET_NAME ||
"Srikanth Personal Planner";

try {

```
const response =
  await gapi.client.drive.files.list({

    q:
      "name = '" +
      sheetName.replace(/'/g, "\\'") +
      "' " +
      "and mimeType = 'application/vnd.google-apps.spreadsheet' " +
      "and trashed = false",

    spaces: "drive",

    fields: "files(id,name,modifiedTime)",

    pageSize: 10
  });

const files =
  response.result.files || [];

if (files.length > 0) {

  spreadsheetId = files[0].id;

  await ensurePlannerSheet();

  return;
}

await createSpreadsheet(sheetName);
```

} catch (error) {

```
console.error(
  "Drive search failed:",
  error
);

throw error;
```

}
}

/* --------------------------------------------------
CREATE NEW GOOGLE SHEET
-------------------------------------------------- */

async function createSpreadsheet(name) {

const response =
await gapi.client.sheets.spreadsheets.create({

```
  resource: {

    properties: {
      title: name
    },

    sheets: [
      {
        properties: {
          title: "Planner"
        }
      }
    ]
  }
});
```

spreadsheetId =
response.result.spreadsheetId;

await initializePlannerSheet();
}

/* --------------------------------------------------
MAKE SURE PLANNER TAB EXISTS
-------------------------------------------------- */

async function ensurePlannerSheet() {

const response =
await gapi.client.sheets.spreadsheets.get({
spreadsheetId: spreadsheetId
});

const sheets =
response.result.sheets || [];

const plannerExists =
sheets.some(function (sheet) {

```
  return (
    sheet.properties &&
    sheet.properties.title === "Planner"
  );
});
```

if (!plannerExists) {

```
await gapi.client.sheets.spreadsheets.batchUpdate({

  spreadsheetId: spreadsheetId,

  resource: {

    requests: [

      {
        addSheet: {
          properties: {
            title: "Planner"
          }
        }
      }

    ]
  }
});

await initializePlannerSheet();
```

} else {

```
const headerCheck =
  await gapi.client.sheets.spreadsheets.values.get({

    spreadsheetId: spreadsheetId,

    range: "Planner!A1:E1"
  });

if (
  !headerCheck.result.values ||
  !headerCheck.result.values.length
) {
  await initializePlannerSheet();
}
```

}
}

/* --------------------------------------------------
INITIAL SHEET HEADER
-------------------------------------------------- */

async function initializePlannerSheet() {

await gapi.client.sheets.spreadsheets.values.update({

```
spreadsheetId: spreadsheetId,

range: "Planner!A1:E1",

valueInputOption: "RAW",

resource: {

  values: [
    [
      "Type",
      "Key",
      "Field",
      "Value",
      "Updated"
    ]
  ]
}
```

});
}

/* --------------------------------------------------
LOAD ALL PLANNER DATA
-------------------------------------------------- */

let plannerData = {
days: {},
months: {}
};

async function loadPlannerData() {

const response =
await gapi.client.sheets.spreadsheets.values.get({

```
  spreadsheetId: spreadsheetId,

  range: "Planner!A:E"
});
```

const rows =
response.result.values || [];

plannerData = {
days: {},
months: {}
};

rows.slice(1).forEach(function (row) {

```
const type = row[0];
const key = row[1];
const field = row[2];
const value = row[3] || "";

if (type === "day") {

  if (!plannerData.days[key]) {

    plannerData.days[key] = {
      goal: "",
      notes: "",
      tasks: []
    };
  }

  if (field === "goal") {
    plannerData.days[key].goal = value;
  }

  if (field === "notes") {
    plannerData.days[key].notes = value;
  }

  if (field === "tasks") {

    try {

      plannerData.days[key].tasks =
        JSON.parse(value || "[]");

    } catch {

      plannerData.days[key].tasks = [];
    }
  }
}

if (type === "month") {

  if (field === "plan") {

    plannerData.months[key] = value;
  }
}
```

});
}

/* --------------------------------------------------
SAVE / UPDATE A SINGLE ROW
-------------------------------------------------- */

async function saveRow(
type,
key,
field,
value
) {

const response =
await gapi.client.sheets.spreadsheets.values.get({

```
  spreadsheetId: spreadsheetId,

  range: "Planner!A:E"
});
```

const rows =
response.result.values || [];

const rowNumber =
rows.findIndex(function (row, index) {

```
  return (
    index > 0 &&
    row[0] === type &&
    row[1] === key &&
    row[2] === field
  );
});
```

const newRow = [
type,
key,
field,
String(value),
new Date().toISOString()
];

if (rowNumber > 0) {

```
await gapi.client.sheets.spreadsheets.values.update({

  spreadsheetId: spreadsheetId,

  range:
    "Planner!A" +
    (rowNumber + 1) +
    ":E" +
    (rowNumber + 1),

  valueInputOption: "RAW",

  resource: {
    values: [newRow]
  }
});
```

} else {

```
await gapi.client.sheets.spreadsheets.values.append({

  spreadsheetId: spreadsheetId,

  range: "Planner!A:E",

  valueInputOption: "RAW",

  insertDataOption: "INSERT_ROWS",

  resource: {
    values: [newRow]
  }
});
```

}
}

/* --------------------------------------------------
RENDER EVERYTHING
-------------------------------------------------- */

async function renderAll() {

await loadPlannerData();

renderCalendar();

loadDay();

loadMonth();
}

/* --------------------------------------------------
CALENDAR
-------------------------------------------------- */

function renderCalendar() {

$("calendarTitle").textContent =
prettyMonth(viewDate);

$("currentMonth").textContent =
prettyMonth(viewDate);

const calendar =
$("calendar");

calendar.innerHTML = "";

const weekdays = [
"Sun",
"Mon",
"Tue",
"Wed",
"Thu",
"Fri",
"Sat"
];

weekdays.forEach(function (day) {

```
calendar.innerHTML +=
  `<div class="calendar-weekday">
    ${day}
  </div>`;
```

});

const firstDay =
new Date(
viewDate.getFullYear(),
viewDate.getMonth(),
1
).getDay();

const numberOfDays =
new Date(
viewDate.getFullYear(),
viewDate.getMonth() + 1,
0
).getDate();

for (let i = 0; i < firstDay; i++) {

```
calendar.innerHTML +=
  "<div></div>";
```

}

for (
let number = 1;
number <= numberOfDays;
number++
) {

```
const date =
  new Date(
    viewDate.getFullYear(),
    viewDate.getMonth(),
    number
  );

const key = dateKey(date);

const entry =
  plannerData.days[key] || {
    goal: "",
    notes: "",
    tasks: []
  };

const tasks =
  entry.tasks || [];

let classes =
  "calendar-day";

if (
  key === dateKey(selectedDate)
) {
  classes += " selected";
}

if (
  key === dateKey(new Date())
) {
  classes += " today";
}

let info = "";

if (tasks.length > 0) {

  const completed =
    tasks.filter(
      function (task) {
        return task.done;
      }
    ).length;

  info +=
    `✓ ${completed}/${tasks.length}`;
}

if (entry.goal) {

  info +=
    "<br>📝";
}

calendar.innerHTML +=
  `<div
    class="${classes}"
    data-date="${key}"
  >
    <div class="calendar-day-number">
      ${number}
    </div>

    <div class="calendar-info">
      ${info}
    </div>
  </div>`;
```

}

calendar
.querySelectorAll(".calendar-day")
.forEach(function (element) {

```
  element.addEventListener(
    "click",
    function () {

      selectedDate =
        new Date(
          element.dataset.date +
          "T00:00:00"
        );

      loadDay();

      renderCalendar();
    }
  );
});
```

}

/* --------------------------------------------------
DAILY ENTRY
-------------------------------------------------- */

function loadDay() {

const key =
dateKey(selectedDate);

const entry =
plannerData.days[key] || {
goal: "",
notes: "",
tasks: []
};

$("dayTitle").textContent =
"Day-wise Entry — " +
prettyDate(selectedDate);

$("selectedDate").textContent =
prettyDate(selectedDate);

$("dailyGoal").value =
entry.goal || "";

$("dailyNotes").value =
entry.notes || "";

renderTasks(entry.tasks || []);
}

/* --------------------------------------------------
SAVE DAILY ENTRY
-------------------------------------------------- */

$("saveDayBtn").addEventListener(
"click",
async function () {

```
const key =
  dateKey(selectedDate);

const entry =
  plannerData.days[key] || {
    goal: "",
    notes: "",
    tasks: []
  };

entry.goal =
  $("dailyGoal").value;

entry.notes =
  $("dailyNotes").value;

plannerData.days[key] =
  entry;

try {

  await saveRow(
    "day",
    key,
    "goal",
    entry.goal
  );

  await saveRow(
    "day",
    key,
    "notes",
    entry.notes
  );

  showSaved(
    $("saveDayBtn")
  );

  renderCalendar();

} catch (error) {

  console.error(error);

  alert(
    "Could not save the day entry."
  );
}
```

}
);

/* --------------------------------------------------
TASKS
-------------------------------------------------- */

function renderTasks(tasks) {

$("taskCount").textContent =
tasks.length;

$("completedCount").textContent =
tasks.filter(
function (task) {
return task.done;
}
).length;

if (!tasks.length) {

```
$("tasks").innerHTML =
  `<p style="color:#64748b">
    No tasks yet.
  </p>`;

return;
```

}

$("tasks").innerHTML =
tasks.map(function (task, index) {

```
  return `
    <div class="task ${
      task.done ? "done" : ""
    }">

      <input
        type="checkbox"
        data-task-index="${index}"
        ${task.done ? "checked" : ""}
      >

      <span>
        ${escapeHTML(task.text)}
      </span>

      <button
        class="delete-task"
        data-delete-task="${index}"
      >
        ×
      </button>

    </div>
  `;

}).join("");
```

$("tasks")
.querySelectorAll(
"input[data-task-index]"
)
.forEach(function (checkbox) {

```
  checkbox.addEventListener(
    "change",
    async function () {

      const key =
        dateKey(selectedDate);

      const entry =
        plannerData.days[key];

      const index =
        Number(
          checkbox.dataset.taskIndex
        );

      entry.tasks[index].done =
        checkbox.checked;

      await saveRow(
        "day",
        key,
        "tasks",
        JSON.stringify(entry.tasks)
      );

      loadDay();

      renderCalendar();
    }
  );
});
```

$("tasks")
.querySelectorAll(
"[data-delete-task]"
)
.forEach(function (button) {

```
  button.addEventListener(
    "click",
    async function () {

      const key =
        dateKey(selectedDate);

      const entry =
        plannerData.days[key];

      const index =
        Number(
          button.dataset.deleteTask
        );

      entry.tasks.splice(
        index,
        1
      );

      await saveRow(
        "day",
        key,
        "tasks",
        JSON.stringify(entry.tasks)
      );

      loadDay();

      renderCalendar();
    }
  );
});
```

}

/* --------------------------------------------------
ADD TASK
-------------------------------------------------- */

async function addTask() {

const text =
$("taskInput").value.trim();

if (!text) {
return;
}

const key =
dateKey(selectedDate);

if (!plannerData.days[key]) {

```
plannerData.days[key] = {
  goal: "",
  notes: "",
  tasks: []
};
```

}

plannerData.days[key]
.tasks.push({
text: text,
done: false
});

await saveRow(
"day",
key,
"tasks",
JSON.stringify(
plannerData.days[key].tasks
)
);

$("taskInput").value = "";

loadDay();

renderCalendar();
}

$("addTaskBtn").addEventListener(
"click",
addTask
);

$("taskInput").addEventListener(
"keydown",
function (event) {

```
if (event.key === "Enter") {
  addTask();
}
```

}
);

/* --------------------------------------------------
MONTHLY PLAN
-------------------------------------------------- */

function loadMonth() {

$("monthlyPlanMonth").textContent =
prettyMonth(viewDate);

$("monthlyPlan").value =
plannerData.months[
monthKey(viewDate)
] || "";
}

$("saveMonthBtn").addEventListener(
"click",
async function () {

```
const key =
  monthKey(viewDate);

const plan =
  $("monthlyPlan").value;

plannerData.months[key] =
  plan;

try {

  await saveRow(
    "month",
    key,
    "plan",
    plan
  );

  showSaved(
    $("saveMonthBtn")
  );

} catch (error) {

  console.error(error);

  alert(
    "Could not save the monthly plan."
  );
}
```

}
);

/* --------------------------------------------------
CHANGE MONTH
-------------------------------------------------- */

$("previousMonth").addEventListener(
"click",
async function () {

```
viewDate =
  new Date(
    viewDate.getFullYear(),
    viewDate.getMonth() - 1,
    1
  );

selectedDate =
  new Date(viewDate);

await renderAll();
```

}
);

$("nextMonth").addEventListener(
"click",
async function () {

```
viewDate =
  new Date(
    viewDate.getFullYear(),
    viewDate.getMonth() + 1,
    1
  );

selectedDate =
  new Date(viewDate);

await renderAll();
```

}
);

/* --------------------------------------------------
SAVE FEEDBACK
-------------------------------------------------- */

function showSaved(button) {

const oldText =
button.textContent;

button.textContent =
"Saved ✓";

setTimeout(function () {

```
button.textContent =
  oldText;
```

}, 1500);
}

/* --------------------------------------------------
LOGOUT
-------------------------------------------------- */

$("logoutBtn").addEventListener(
"click",
function () {

```
if (
  accessToken &&
  window.google &&
  google.accounts &&
  google.accounts.oauth2
) {

  google.accounts.oauth2.revoke(
    accessToken,
    function () {}
  );
}

accessToken = null;

spreadsheetId = null;

$("appPage")
  .classList.add("hidden");

$("loginPage")
  .classList.remove("hidden");

$("loginMessage").textContent =
  "Signed out.";
```

}
);

/* --------------------------------------------------
START
-------------------------------------------------- */

window.addEventListener(
"load",
initializeGoogle
);

