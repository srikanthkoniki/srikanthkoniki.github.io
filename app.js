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

let plannerData = {
days: {},
months: {}
};

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

/* ================================
GOOGLE CONFIGURATION
================================ */

function googleConfigured() {
return (
window.PLANNER_CONFIG &&
window.PLANNER_CONFIG.CLIENT_ID &&
!window.PLANNER_CONFIG.CLIENT_ID.includes(
"PASTE_YOUR_GOOGLE_CLIENT_ID_HERE"
)
);
}

function waitForGoogle() {
return new Promise(function (resolve) {

```
function check() {

  if (
    window.google &&
    window.google.accounts &&
    window.gapi
  ) {
    resolve();
  } else {
    setTimeout(check, 300);
  }
}

check();
```

});
}

/* ================================
GOOGLE INITIALIZATION
================================ */

async function initializeGoogle() {

if (!googleConfigured()) {

```
$("loginMessage").textContent =
  "Google Client ID is not configured.";

$("googleLoginBtn").disabled = true;

return;
```

}

try {

```
await waitForGoogle();

gapi.load("client", async function () {

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
              "Google sign-in failed.";

            return;
          }

          accessToken =
            response.access_token;

          gapi.client.setToken({
            access_token: accessToken
          });

          try {

            await startPlanner();

          } catch (error) {

            console.error(error);

            $("loginMessage").textContent =
              "Could not open your planner. " +
              "Please check Google permissions.";

          }
        }
      });

    $("googleLoginBtn").disabled = false;

    $("loginMessage").textContent = "";

  } catch (error) {

    console.error(error);

    $("loginMessage").textContent =
      "Google API initialization failed.";

  }

});
```

} catch (error) {

```
console.error(error);

$("loginMessage").textContent =
  "Google services could not be loaded.";
```

}
}

/* ================================
GOOGLE LOGIN BUTTON
================================ */

$("googleLoginBtn").disabled = true;

$("googleLoginBtn").addEventListener(
"click",
function () {

```
if (!tokenClient) {

  $("loginMessage").textContent =
    "Google sign-in is still loading.";

  return;
}

tokenClient.requestAccessToken({
  prompt: "consent"
});
```

}
);

/* ================================
START APPLICATION
================================ */

async function startPlanner() {

await findOrCreateSpreadsheet();

$("loginPage").classList.add("hidden");

$("appPage").classList.remove("hidden");

$("userName").textContent =
"Google account connected";

await renderAll();
}

/* ================================
FIND OR CREATE SPREADSHEET
================================ */

async function findOrCreateSpreadsheet() {

const sheetName =
PLANNER_CONFIG.SHEET_NAME ||
"Srikanth Personal Planner";

const response =
await gapi.client.drive.files.list({

```
  q:
    "name = '" +
    sheetName.replace(/'/g, "\\'") +
    "' " +
    "and mimeType = 'application/vnd.google-apps.spreadsheet' " +
    "and trashed = false",

  spaces: "drive",

  fields:
    "files(id,name,modifiedTime)",

  pageSize: 10
});
```

const files =
response.result.files || [];

if (files.length > 0) {

```
spreadsheetId =
  files[0].id;

await ensurePlannerSheet();
```

} else {

```
await createSpreadsheet(sheetName);
```

}
}

/* ================================
CREATE GOOGLE SHEET
================================ */

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

/* ================================
ENSURE PLANNER SHEET EXISTS
================================ */

async function ensurePlannerSheet() {

const response =
await gapi.client.sheets.spreadsheets.get({
spreadsheetId: spreadsheetId
});

const sheets =
response.result.sheets || [];

const exists =
sheets.some(function (sheet) {

```
  return (
    sheet.properties &&
    sheet.properties.title === "Planner"
  );

});
```

if (!exists) {

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
const header =
  await gapi.client.sheets.spreadsheets.values.get({

    spreadsheetId: spreadsheetId,

    range: "Planner!A1:E1"

  });

if (
  !header.result.values ||
  header.result.values.length === 0
) {

  await initializePlannerSheet();

}
```

}
}

/* ================================
INITIALIZE HEADER
================================ */

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

/* ================================
LOAD DATA
================================ */

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

    } catch (error) {

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

/* ================================
SAVE ROW
================================ */

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

let existingRow = -1;

for (
let i = 1;
i < rows.length;
i++
) {

```
if (
  rows[i][0] === type &&
  rows[i][1] === key &&
  rows[i][2] === field
) {

  existingRow = i + 1;

  break;

}
```

}

const row = [

```
type,
key,
field,
String(value),
new Date().toISOString()
```

];

if (existingRow !== -1) {

```
await gapi.client.sheets.spreadsheets.values.update({

  spreadsheetId: spreadsheetId,

  range:
    "Planner!A" +
    existingRow +
    ":E" +
    existingRow,

  valueInputOption: "RAW",

  resource: {
    values: [row]
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
    values: [row]
  }

});
```

}
}

/* ================================
RENDER ALL
================================ */

async function renderAll() {

await loadPlannerData();

renderCalendar();

loadDay();

loadMonth();
}

/* ================================
CALENDAR
================================ */

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

weekdays.forEach(function (weekday) {

```
calendar.innerHTML +=
  '<div class="calendar-weekday">' +
  weekday +
  "</div>";
```

});

const firstDay =
new Date(
viewDate.getFullYear(),
viewDate.getMonth(),
1
).getDay();

const days =
new Date(
viewDate.getFullYear(),
viewDate.getMonth() + 1,
0
).getDate();

for (
let i = 0;
i < firstDay;
i++
) {

```
calendar.innerHTML +=
  "<div></div>";
```

}

for (
let number = 1;
number <= days;
number++
) {

```
const date =
  new Date(
    viewDate.getFullYear(),
    viewDate.getMonth(),
    number
  );

const key =
  dateKey(date);

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

let information = "";

if (tasks.length > 0) {

  const completed =
    tasks.filter(
      function (task) {
        return task.done;
      }
    ).length;

  information +=
    "✓ " +
    completed +
    "/" +
    tasks.length;

}

if (entry.goal) {

  information +=
    "<br>📝";

}

calendar.innerHTML +=

  '<div class="' +
  classes +
  '" data-date="' +
  key +
  '">' +

  '<div class="calendar-day-number">' +
  number +
  "</div>" +

  '<div class="calendar-info">' +
  information +
  "</div>" +

  "</div>";
```

}

calendar
.querySelectorAll(".calendar-day")
.forEach(function (day) {

```
  day.addEventListener(
    "click",
    function () {

      selectedDate =
        new Date(
          day.dataset.date +
          "T00:00:00"
        );

      loadDay();

      renderCalendar();

    }
  );

});
```

}

/* ================================
LOAD DAILY ENTRY
================================ */

function loadDay() {

const key =
dateKey(selectedDate);

const entry =
plannerData.days[key] || {

```
  goal: "",
  notes: "",
  tasks: []

};
```

$("dayTitle").textContent =
"Day-wise Entry — " +
prettyDate(selectedDate);

$("selectedDate").textContent =
prettyDate(selectedDate);

$("dailyGoal").value =
entry.goal || "";

$("dailyNotes").value =
entry.notes || "";

renderTasks(
entry.tasks || []
);
}

/* ================================
SAVE DAILY ENTRY
================================ */

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

/* ================================
TASK DISPLAY
================================ */

function renderTasks(tasks) {

$("taskCount").textContent =
tasks.length;

$("completedCount").textContent =
tasks.filter(
function (task) {
return task.done;
}
).length;

if (tasks.length === 0) {

```
$("tasks").innerHTML =
  '<p style="color:#64748b">' +
  "No tasks yet." +
  "</p>";

return;
```

}

$("tasks").innerHTML =
tasks.map(
function (task, index) {

```
    return (

      '<div class="task ' +
      (task.done ? "done" : "") +
      '">' +

      '<input type="checkbox" ' +
      'data-task-index="' +
      index +
      '"' +
      (task.done ? " checked" : "") +
      ">" +

      "<span>" +
      escapeHTML(task.text) +
      "</span>" +

      '<button ' +
      'class="delete-task" ' +
      'data-delete-task="' +
      index +
      '">' +
      "×" +
      "</button>" +

      "</div>"

    );

  }
).join("");
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

/* ================================
ADD TASK
================================ */

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

plannerData.days[key].tasks.push({

```
text: text,
done: false
```

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

/* ================================
MONTHLY PLAN
================================ */

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
    "Could not save monthly plan."
  );

}
```

}
);

/* ================================
MONTH NAVIGATION
================================ */

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

/* ================================
SAVED MESSAGE
================================ */

function showSaved(button) {

const oldText =
button.textContent;

button.textContent =
"Saved ✓";

setTimeout(
function () {

```
  button.textContent =
    oldText;

},
1500
```

);
}

/* ================================
LOGOUT
================================ */

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
```

}
);

/* ================================
START
================================ */

window.addEventListener(
"load",
initializeGoogle
);
