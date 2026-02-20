const API_BASE = "";

async function login() {
    const azureId = document.getElementById("azureId").value;

    const response = await fetch(
        `/auth/login?azure_id=${azureId}`,
        { method: "POST" }
    );

    if (!response.ok) {
        alert("Login failed");
        return;
    }

    const data = await response.json();

    localStorage.setItem("token", data.access_token);

    window.location.href = "/static/escalations.html";
}

async function loadEscalations() {
    const token = localStorage.getItem("token");

    if (!token) {
        window.location.href = "/static/login.html";
        return;
    }

    const response = await fetch("/escalations/list", {
        headers: {
            "Authorization": "Bearer " + token
        }
    });

    if (!response.ok) {
        alert("Failed to fetch escalations");
        return;
    }

    const data = await response.json();

    const tableBody = document.getElementById("tableBody");
    tableBody.innerHTML = "";

    data.forEach(item => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${item.unit}</td>
            <td>${item.geography}</td>
            <td>${item.infra_app}</td>
            <td>${item.application}</td>
            <td>
                <button onclick="viewLevels(
                    ${item.unit_id},
                    ${item.geography_id},
                    ${item.infra_app_id},
                    ${item.application_id}
                )">View</button>

                <button onclick="deleteEscalation(
                    ${item.unit_id},
                    ${item.geography_id},
                    ${item.infra_app_id},
                    ${item.application_id}
                )">Delete</button>
            </td>
        `;

        tableBody.appendChild(row);
    });
}

async function viewLevels(unit_id, geography_id, infra_app_id, application_id) {
    const token = localStorage.getItem("token");

    const response = await fetch(
        `/escalations?unit_id=${unit_id}&geography_id=${geography_id}&infra_app_id=${infra_app_id}&application_id=${application_id}`,
        {
            headers: {
                "Authorization": "Bearer " + token
            }
        }
    );

    if (!response.ok) {
        alert("Escalation not found");
        return;
    }

    const data = await response.json();

    showLevelsModal(data.levels);
}

function showLevelsModal(levels) {

    let content = "<h3>Escalation Levels</h3>";
    content += "<table border='1'><tr><th>Level</th><th>Name</th><th>Mobile</th><th>Email</th></tr>";

    levels.forEach(level => {
        content += `
            <tr>
                <td>${level.level_number}</td>
                <td>${level.display_name}</td>
                <td>${level.mobile}</td>
                <td>${level.email}</td>
            </tr>
        `;
    });

    content += "</table><br>";
    content += "<button onclick='closeModal()'>Close</button>";

    const modal = document.createElement("div");
    modal.setAttribute("id", "levelsModal");
    modal.style.position = "fixed";
    modal.style.top = "20%";
    modal.style.left = "30%";
    modal.style.background = "white";
    modal.style.padding = "20px";
    modal.style.border = "2px solid black";

    modal.innerHTML = content;

    document.body.appendChild(modal);
}

function closeModal() {
    const modal = document.getElementById("levelsModal");
    if (modal) modal.remove();
}

async function loadAuditLogs() {
    const token = localStorage.getItem("token");

    if (!token) {
        window.location.href = "/static/login.html";
        return;
    }

    const response = await fetch("/audit-logs", {
        headers: {
            "Authorization": "Bearer " + token
        }
    });

    if (!response.ok) {
        alert("Failed to fetch audit logs");
        return;
    }

    const data = await response.json();

    const tableBody = document.getElementById("auditTableBody");
    tableBody.innerHTML = "";

    data.forEach(log => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${log.id}</td>
            <td>${log.action}</td>
            <td>${log.performed_by || "-"}</td>
            <td>${log.created_at}</td>
        `;

        tableBody.appendChild(row);
    });
}

function goToEscalations() {
    window.location.href = "/static/escalations.html";
}

function goToAudit() {
    window.location.href = "/static/audit_logs.html";
}

function goToCreate() {
    window.location.href = "/static/create_escalation.html";
}

let levelCount = 0;

function addLevel() {
    levelCount++;

    const container = document.getElementById("levelsContainer");

    const div = document.createElement("div");
    div.setAttribute("id", "level_" + levelCount);

    div.innerHTML = `
        <h4>Level ${levelCount}</h4>

        <label>User:</label><br>
        <select class="levelUser"></select><br>

        <label>Override Mobile (optional):</label><br>
        <input type="text" class="overrideMobile"><br>

        <label>Override Email (optional):</label><br>
        <input type="text" class="overrideEmail"><br><br>
    `;

    container.appendChild(div);

    loadUsersForLevel(div.querySelector(".levelUser"));
}

async function submitEscalation() {
    const token = localStorage.getItem("token");

    const unit_id = parseInt(document.getElementById("unit").value);
    const geography_id = parseInt(document.getElementById("geography").value);
    const infra_app_id = parseInt(document.getElementById("infra_app").value);
    const application_id = parseInt(document.getElementById("application").value);

    const users = document.getElementsByClassName("levelUser");
    const overrideMobiles = document.getElementsByClassName("overrideMobile");
    const overrideEmails = document.getElementsByClassName("overrideEmail");

    const levels = [];

    for (let i = 0; i < users.length; i++) {
        levels.push({
            level_number: i + 1,
            user_id: parseInt(users[i].value),
            override_mobile: overrideMobiles[i].value || null,
            override_email: overrideEmails[i].value || null
        });
    }

    const payload = {
        unit_id,
        geography_id,
        infra_app_id,
        application_id,
        levels
    };

    const submitBtn = document.getElementById("submitButton");
    const mode = submitBtn.dataset.mode || "create";

    const url = "/escalations/";
    const method = mode === "update" ? "PUT" : "POST";
    console.log("Mode:", mode);

    const response = await fetch(url, {
        method: method,
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },
        body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
        alert(result.detail || "Failed to create escalation");
        return;
    }

    alert("Escalation created successfully");
    window.location.href = "/static/escalations.html";
}

async function loadDropdown(endpoint, elementId) {
    const token = localStorage.getItem("token");

    const response = await fetch(`/${endpoint}`, {
        headers: {
            "Authorization": "Bearer " + token
        }
    });

    if (!response.ok) {
        alert("Failed to load " + endpoint);
        return;
    }

    const data = await response.json();

    const select = document.getElementById(elementId);
    select.innerHTML = "";

    data.forEach(item => {
        const option = document.createElement("option");
        option.value = item.id;
        option.text = item.name;
        select.appendChild(option);
    });
}

function initializeLevels() {
    clearLevels();
    addLevel();  // always start with level 1
}

async function initializeCreatePage() {
    const token = localStorage.getItem("token");

    if (!token) {
        window.location.href = "/static/login.html";
        return;
    }

    await loadDropdown("applications", "application");
    await loadDropdown("geographies", "geography");
    await loadDropdown("units", "unit");
    await loadDropdown("infra-apps", "infra_app");

    initializeLevels();
    checkExistingEscalation();  // 🔥 ADD THIS LINE
}

async function loadUsersForLevel(selectElement) {
    const token = localStorage.getItem("token");

    const response = await fetch("/users", {
        headers: {
            "Authorization": "Bearer " + token
        }
    });

    if (!response.ok) {
        alert("Failed to load users");
        return;
    }

    const data = await response.json();

    data.forEach(user => {
        const option = document.createElement("option");
        option.value = user.id;  // IMPORTANT
        option.text = user.display_name;
        selectElement.appendChild(option);
    });
}

async function checkExistingEscalation() {

    const token = localStorage.getItem("token");

    const unit_id = document.getElementById("unit").value;
    const geography_id = document.getElementById("geography").value;
    const infra_app_id = document.getElementById("infra_app").value;
    const application_id = document.getElementById("application").value;

    if (!unit_id || !geography_id || !infra_app_id || !application_id) {
        return;
    }

    const response = await fetch(
        `/escalations?unit_id=${unit_id}&geography_id=${geography_id}&infra_app_id=${infra_app_id}&application_id=${application_id}`,
        {
            headers: {
                "Authorization": "Bearer " + token
            }
        }
    );

    const submitBtn = document.getElementById("submitButton");

    if (response.ok) {
        const data = await response.json();
        loadLevelsForUpdate(data.levels);
        submitBtn.innerText = "Update Escalation";
        submitBtn.dataset.mode = "update";
        console.log("Escalation exists → switching to UPDATE"); 
    } else {
        clearLevels();
        submitBtn.innerText = "Create Escalation";
        submitBtn.dataset.mode = "create";
        console.log("Escalation does NOT exist → switching to CREATE");
    }
}

function loadLevelsForUpdate(levels) {

    clearLevels();

    levelCount = 0;

    levels.forEach(level => {
        addLevel();

        const users = document.getElementsByClassName("levelUser");
        const overrideMobiles = document.getElementsByClassName("overrideMobile");
        const overrideEmails = document.getElementsByClassName("overrideEmail");

        const index = users.length - 1;

        users[index].value = level.user_id;
        overrideMobiles[index].value = level.mobile || "";
        overrideEmails[index].value = level.email || "";
    });
}

function clearLevels() {
    const container = document.getElementById("levelsContainer");
    container.innerHTML = "";
    levelCount = 0;
}

async function deleteEscalation(unit_id, geography_id, infra_app_id, application_id) {

    const confirmDelete = confirm("Are you sure you want to delete this escalation?");

    if (!confirmDelete) return;

    const token = localStorage.getItem("token");

    const response = await fetch(
        `/escalations/?unit_id=${unit_id}&geography_id=${geography_id}&infra_app_id=${infra_app_id}&application_id=${application_id}`,
        {
            method: "DELETE",
            headers: {
                "Authorization": "Bearer " + token
            }
        }
    );

    const result = await response.json();

    if (!response.ok) {
        alert(result.detail || "Failed to delete escalation");
        return;
    }

    alert("Escalation deleted successfully");

    loadEscalations(); // refresh table
}

function logout() {
    localStorage.removeItem("token");
    window.location.href = "/static/login.html";
}