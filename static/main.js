let escalationData = [];
let filteredData = [];
let currentPage = 1;
let rowsPerPage = 10;
let currentSort = {
    column: null,
    asc: true
};

const API_BASE = "";

async function login() {
    const azureId = document.getElementById("azureId").value;

    const response = await fetch(
        `/auth/login?azure_id=${azureId}`,
        { method: "POST" }
    );

    if (!response.ok) {
        showToast("Login failed","error");
        return;
    }

    const data = await response.json();

    localStorage.setItem("token", data.access_token);

    window.location.href = "/static/escalations.html";
}

function isAdminLoggedIn() {
    const token = localStorage.getItem("token");
    if (!token) return false;

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.role === "admin";
    } catch (e) {
        return false;
    }
}

function getUserFromToken() {
    const token = localStorage.getItem("token");
    if (!token) return null;

    try {
        return JSON.parse(atob(token.split('.')[1]));
    } catch (e) {
        return null;
    }
}

function checkTokenExpiry() {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const currentTime = Math.floor(Date.now() / 1000);

        if (payload.exp && payload.exp < currentTime) {
            showToast("Session expired. Please login again.", "error");
            logout();
        }
    } catch (e) {
        logout();
    }
}

async function loadEscalations() {

    checkTokenExpiry();

    const response = await fetch("/escalations/list");

    if (!response.ok) {
        showToast("Failed to fetch escalations", "error");
        return;
    }

    const data = await response.json();

    escalationData = data;
    populateFilters(data);
    filteredData = data;
    currentPage = 1;
    renderPaginatedTable();

    const loginBtn = document.getElementById("loginBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    const auditBtn = document.getElementById("auditBtn");
    const createBtn = document.getElementById("createBtn");
    const loggedInUser = document.getElementById("loggedInUser");
    const exportBtn = document.getElementById("exportBtn");

    const user = getUserFromToken();

    if (!user || user.role !== "admin") {
        if (loginBtn) loginBtn.style.display = "inline-block";
        if (logoutBtn) logoutBtn.style.display = "none";
        if (auditBtn) auditBtn.style.display = "none";
        if (createBtn) createBtn.style.display = "none";
        if (loggedInUser) loggedInUser.innerText = "";
        if (exportBtn) exportBtn.style.display = "none";
    } else {
        if (loginBtn) loginBtn.style.display = "none";
        if (logoutBtn) logoutBtn.style.display = "inline-block";
        if (auditBtn) auditBtn.style.display = "inline-block";
        if (createBtn) createBtn.style.display = "inline-block";
        if (loggedInUser) loggedInUser.innerText =
            `Welcome, ${user.display_name || user.sub}`;
        if (exportBtn) exportBtn.style.display = "inline-block";
    }
}

function renderTable(data) {

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
                <button class="btn secondary" onclick="viewLevels(
                    ${item.unit_id},
                    ${item.geography_id},
                    ${item.infra_app_id},
                    ${item.application_id}
                )">View</button>

                ${isAdminLoggedIn() ? `
                    <button class="btn danger" onclick="deleteEscalation(
                        ${item.unit_id},
                        ${item.geography_id},
                        ${item.infra_app_id},
                        ${item.application_id}
                    )">Delete</button>
                ` : ""}
            </td>
        `;

        tableBody.appendChild(row);
    });
}

function populateFilters(data) {

    const units = [...new Set(data.map(d => d.unit))];
    const geos = [...new Set(data.map(d => d.geography))];
    const infras = [...new Set(data.map(d => d.infra_app))];
    const apps = [...new Set(data.map(d => d.application))];

    fillDropdown("unitFilter", units);
    fillDropdown("geoFilter", geos);
    fillDropdown("infraFilter", infras);
    fillDropdown("appFilter", apps);
}

function renderPaginatedTable() {

    const totalRows = filteredData.length;
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;

    const paginatedItems = filteredData.slice(start, end);

    renderTable(paginatedItems);

    // Result Info
    const resultInfo = document.getElementById("resultInfo");
    resultInfo.innerText = totalRows === 0
        ? "No results found"
        : `Showing ${start + 1}-${Math.min(end, totalRows)} of ${totalRows} results`;

    renderPageNumbers(totalRows);

    const totalPages = Math.ceil(filteredData.length / rowsPerPage);

    const prevBtn = document.querySelector("button[onclick='prevPage()']");
    const nextBtn = document.querySelector("button[onclick='nextPage()']");

    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage === totalPages || totalPages === 0;
}

function renderPageNumbers(totalRows) {

    const pageNumbers = document.getElementById("pageNumbers");
    pageNumbers.innerHTML = "";

    const totalPages = Math.ceil(totalRows / rowsPerPage);

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement("button");
        btn.innerText = i;
        btn.className = "page-btn";

        if (i === currentPage) {
            btn.classList.add("active");
        }

        btn.onclick = () => {
            currentPage = i;
            renderPaginatedTable();
        };

        pageNumbers.appendChild(btn);
    }
}

function sortTable(column) {

    if (currentSort.column === column) {
        currentSort.asc = !currentSort.asc;
    } else {
        currentSort.column = column;
        currentSort.asc = true;
    }

    filteredData.sort((a, b) => {

        const valA = (a[column] || "").toLowerCase();
        const valB = (b[column] || "").toLowerCase();

        if (valA < valB) return currentSort.asc ? -1 : 1;
        if (valA > valB) return currentSort.asc ? 1 : -1;
        return 0;
    });

    currentPage = 1;
    renderPaginatedTable();
}

async function exportCSV() {

    if (!isAdminLoggedIn()) {
        showToast("Unauthorized action", "error");
        return;
    }

    if (filteredData.length === 0) {
        showToast("No data available to export", "error");
        return;
    }

    showToast("Preparing export...", "success");

    let csv = "Unit,Geography,Infra App,Application,Level,Name,Mobile,Email\n";

    for (const config of filteredData) {

        try {
            const token = localStorage.getItem("token");

            const headers = token
                ? { "Authorization": "Bearer " + token }
                : {};

            const response = await fetch(
                `/escalations?unit_id=${config.unit_id}&geography_id=${config.geography_id}&infra_app_id=${config.infra_app_id}&application_id=${config.application_id}`,
                { headers }
            );

            if (!response.ok) continue;

            const data = await response.json();

            const levels = Array.isArray(data) 
                ? data 
                : (data.levels || []);

            levels.forEach(level => {
                csv += `"${config.unit || ""}","${config.geography || ""}","${config.infra_app || ""}","${config.application || ""}",` +
                    `"${level.level_number || ""}","${level.display_name || ""}","${level.mobile || ""}","${level.email || ""}"\n`;
            });

        } catch (err) {
            console.error("Export error:", err);
        }
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "escalations_with_levels.csv";
    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast("CSV exported with escalation levels", "success");
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderPaginatedTable();
    }
}

function nextPage() {
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderPaginatedTable();
    }
}

function changeRowsPerPage() {
    rowsPerPage = parseInt(document.getElementById("rowsPerPage").value);
    currentPage = 1;
    renderPaginatedTable();
}

function fillDropdown(id, values) {
    const select = document.getElementById(id);
    select.innerHTML = `<option value="">All</option>`;

    values.forEach(val => {
        const option = document.createElement("option");
        option.value = val;
        option.textContent = val;
        select.appendChild(option);
    });
}

function applyFilters() {

    const searchText = document.getElementById("searchInput").value.toLowerCase();
    const unit = document.getElementById("unitFilter").value;
    const geo = document.getElementById("geoFilter").value;
    const infra = document.getElementById("infraFilter").value;
    const app = document.getElementById("appFilter").value;

    const filtered = escalationData.filter(item => {

        const matchesSearch =
            (item.unit || "").toLowerCase().includes(searchText) ||
            (item.geography || "").toLowerCase().includes(searchText) ||
            (item.infra_app || "").toLowerCase().includes(searchText) ||
            (item.application || "").toLowerCase().includes(searchText);

        const matchesUnit = unit ? item.unit === unit : true;
        const matchesGeo = geo ? item.geography === geo : true;
        const matchesInfra = infra ? item.infra_app === infra : true;
        const matchesApp = app ? item.application === app : true;

        return matchesSearch && matchesUnit && matchesGeo && matchesInfra && matchesApp;
    });

    filteredData = filtered;
    currentPage = 1;
    renderPaginatedTable();
}

function clearFilters() {
    document.getElementById("searchInput").value = "";
    document.getElementById("unitFilter").value = "";
    document.getElementById("geoFilter").value = "";
    document.getElementById("infraFilter").value = "";
    document.getElementById("appFilter").value = "";

    renderTable(escalationData);
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
        showToast("Escalation not found", "error");
        return;
    }

    const data = await response.json();

    showLevelsModal(data.levels);
}

function showLevelsModal(levels) {

    // Create overlay
    const overlay = document.createElement("div");
    overlay.id = "modalOverlay";
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.background = "rgba(0,0,0,0.5)";
    overlay.style.zIndex = "1000";

    // Create modal
    const modal = document.createElement("div");
    modal.id = "levelsModal";

    modal.style.position = "fixed";
    modal.style.top = "50%";
    modal.style.left = "50%";
    modal.style.transform = "translate(-50%, -50%)";
    modal.style.background = "white";
    modal.style.padding = "25px";
    modal.style.borderRadius = "10px";
    modal.style.boxShadow = "0 10px 30px rgba(0,0,0,0.25)";
    modal.style.zIndex = "1001";
    modal.style.maxHeight = "75vh";
    modal.style.overflowY = "auto";
    modal.style.minWidth = "500px";

    let content = "<h3>Escalation Levels</h3>";
    content += "<table class='modern-table'>";
    content += "<tr><th>Level</th><th>Name</th><th>Mobile</th><th>Email</th></tr>";

    levels.forEach(level => {
        content += `
            <tr>
                <td>${level.level_number}</td>
                <td>${level.display_name || ""}</td>
                <td>${level.mobile || ""}</td>
                <td>${level.email || ""}</td>
            </tr>
        `;
    });

    content += "</table><br>";
    content += "<button class='btn primary' onclick='closeModal()'>Close</button>";

    modal.innerHTML = content;

    document.body.appendChild(overlay);
    document.body.appendChild(modal);
}

function closeModal() {
    const modal = document.getElementById("levelsModal");
    const overlay = document.getElementById("modalOverlay");

    if (modal) modal.remove();
    if (overlay) overlay.remove();
}

async function loadAuditLogs() {
    const token = localStorage.getItem("token");

    if (!token) {
        window.location.href = "/static/admin_login.html";
        return;
    }

    const response = await fetch("/audit-logs", {
        headers: {
            "Authorization": "Bearer " + token
        }
    });

    if (!response.ok) {
        showToast("Failed to fetch audit logs", "error");
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
            <td>${log.performed_by || log.user_azure_id || "-"}</td>
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

function goToAdminLogin() {
    window.location.href = "/static/admin_login.html";
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
        showToast(result.detail || "Failed to create escalation", "error");
        return;
    }

    showToast("Escalation created successfully", "success");
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
        showToast("Failed to load " + endpoint, "error");
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
        window.location.href = "/static/admin_login.html";
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
        showToast("Failed to load users", "error");
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
        showToast(result.detail || "Failed to delete escalation", "error");
        return;
    }

    showToast("Escalation deleted successfully", "success");

    loadEscalations(); // refresh table
}

function logout() {
    localStorage.removeItem("token");

    // Redirect to public escalations page
    window.location.href = "/static/escalations.html";

}

function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerText = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

async function loadDashboard() {

    if (!isAdminLoggedIn()) {
        showToast("Unauthorized access", "error");
        window.location.href = "/static/escalations.html";
        return;
    }

    try {

        // Get escalation configs
        const response = await fetch("/escalations/list");
        const configs = await response.json();

        document.getElementById("totalEscalations").innerText = configs.length;

        document.getElementById("totalUnits").innerText =
            new Set(configs.map(c => c.unit)).size;

        document.getElementById("totalGeographies").innerText =
            new Set(configs.map(c => c.geography)).size;

        document.getElementById("totalApplications").innerText =
            new Set(configs.map(c => c.application)).size;

        // Count total levels
        let totalLevels = 0;

        for (const config of configs) {
            const res = await fetch(
                `/escalations?unit_id=${config.unit_id}&geography_id=${config.geography_id}&infra_app_id=${config.infra_app_id}&application_id=${config.application_id}`
            );
            const data = await res.json();
            totalLevels += (data.levels || []).length;
        }

        document.getElementById("totalLevels").innerText = totalLevels;

        // Load recent audit activity
        const auditRes = await fetch("/audit/list");
        const audits = await auditRes.json();

        const recent = audits.slice(0, 5);

        const tbody = document.getElementById("recentActivity");
        tbody.innerHTML = "";

        recent.forEach(a => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${a.action}</td>
                <td>${a.performed_by || "-"}</td>
                <td>${new Date(a.created_at).toLocaleString()}</td>
            `;
            tbody.appendChild(row);
        });

    } catch (err) {
        console.error(err);
        showToast("Failed to load dashboard", "error");
    }
}

function goToEscalations() {
    window.location.href = "/static/escalations.html";
}