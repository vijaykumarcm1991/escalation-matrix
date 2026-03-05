let escalationData = [];
let filteredData = [];
let currentPage = 1;
let rowsPerPage = 10;
let currentSort = {
    column: null,
    asc: true
};
let auditData = [];
let filteredAuditData = [];
let currentAuditPage = 1;
const auditRowsPerPage = 10;

const API_BASE = "";

async function apiFetch(url, options = {}, { silent = false } = {}) {

    const token = localStorage.getItem("token");

    const defaultHeaders = {
        "Content-Type": "application/json"
    };

    if (token) {
        defaultHeaders["Authorization"] = "Bearer " + token;
    }

    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...(options.headers || {})
        }
    };

    const response = await fetch(url, config);

    // Handle 401 globally
    if (response.status === 401) {
        localStorage.removeItem("token");
        showToast("Session expired. Please login again.", "error");
        window.location.href = "/static/admin_login.html";
        return;
    }

    let data = null;
    const contentType = response.headers.get("content-type");

    if (contentType && contentType.includes("application/json")) {
        data = await response.json();
    }

    if (!response.ok) {
        const message = data?.detail || "Request failed";

        if (!silent) {
            showToast(message, "error");
        }

        throw new Error(message);
    }

    return data;
}

function formatToIST(utcString) {

    if (!utcString) return "";

    // Parse manually as UTC components
    const [datePart, timePart] = utcString.split("T");
    const [year, month, day] = datePart.split("-").map(Number);
    const [hour, minute, second] = timePart.split(":").map(Number);

    const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

    return utcDate.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
    });
}

async function login() {
    const azureId = document.getElementById("azureId").value;

    try {
        const data = await apiFetch(
            `/auth/login?azure_id=${azureId}`,
            { method: "POST" }
        );

        localStorage.setItem("token", data.access_token);
        window.location.href = "/static/escalations.html";

    } catch (err) {
        // apiFetch already showed toast
    }
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

    try {
        const data = await apiFetch("/escalations/list");
        escalationData = data;
        populateFilters(data);
        filteredData = data;
        currentPage = 1;
        renderPaginatedTable();
    } catch (err) {
        console.error("Escalations load error", err);
    }
}

function setupHeaderVisibility() {

    const loginBtn = document.getElementById("loginBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    const auditBtn = document.getElementById("auditBtn");
    const createBtn = document.getElementById("createBtn");
    const loggedInUser = document.getElementById("loggedInUser");
    const exportBtn = document.getElementById("exportBtn");
    const dashboardBtn = document.getElementById("dashboardBtn");
    const bulkImportBtn = document.getElementById("bulkImportBtn");

    const user = getUserFromToken();

    if (!user || user.role?.toLowerCase() !== "admin") {
        if (loginBtn) loginBtn.style.display = "inline-block";
        if (logoutBtn) logoutBtn.style.display = "none";
        if (auditBtn) auditBtn.style.display = "none";
        if (createBtn) createBtn.style.display = "none";
        if (dashboardBtn) dashboardBtn.style.display = "none";
        if (loggedInUser) loggedInUser.innerText = "";
        if (exportBtn) exportBtn.style.display = "none";
        if (bulkImportBtn) bulkImportBtn.style.display = "none";
    } else {
        if (loginBtn) loginBtn.style.display = "none";
        if (logoutBtn) logoutBtn.style.display = "inline-block";
        if (auditBtn) auditBtn.style.display = "inline-block";
        if (createBtn) createBtn.style.display = "inline-block";
        if (dashboardBtn) dashboardBtn.style.display = "inline-block";
        if (loggedInUser) loggedInUser.innerText =
            `Welcome, ${user.sub}`;
        if (exportBtn) exportBtn.style.display = "inline-block";
        if (bulkImportBtn) {
            bulkImportBtn.style.display = "inline-block";
            bulkImportBtn.onclick = () => {
                window.location.href = "/static/bulk_import.html";
            };
        }
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
            <td>${item.affected_ci || ""}</td>
            <td>${item.location || ""}</td>
            <td>${item.group_id || ""}</td>
            <td>
                <button class="btn secondary" onclick="viewLevels(
                    ${item.unit_id},
                    ${item.geography_id},
                    ${item.infra_app_id},
                    ${item.application_id},
                    '${item.affected_ci || ""}',
                    '${item.location || ""}',
                    '${item.group_id || ""}'
                )">View</button>

                ${isAdminLoggedIn() ? `
                    <button class="btn primary" onclick="goToUpdate(
                        ${item.unit_id},
                        ${item.geography_id},
                        ${item.infra_app_id},
                        ${item.application_id},
                        '${item.affected_ci || ""}',
                        '${item.location || ""}',
                        '${item.group_id || ""}'
                    )">Update</button>

                    <button class="btn danger" onclick="deleteEscalation(
                        ${item.unit_id},
                        ${item.geography_id},
                        ${item.infra_app_id},
                        ${item.application_id},
                        '${item.affected_ci || ""}',
                        '${item.location || ""}',
                        '${item.group_id || ""}'
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

    try {
        
        const data = await apiFetch("/escalations/export");

        if (data.length === 0) {
            showToast("No data available to export", "error");
            return;
        }

        let csv = "Unit,Geography,Infra App,Application,Affected CI,Location,Group ID,Level,Name,Mobile,Email\n";

        data.forEach(row => {
            csv += `"${row.unit}","${row.geography}","${row.infra_app}","${row.application}","${row.affected_ci || ""}","${row.location || ""}","${row.group_id || ""}",` +
                    `"${row.level_number}","${row.display_name}","${row.mobile}","${row.email}"\n`;
        });

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = "escalations_export.csv";
        document.body.appendChild(link);
        link.click();

        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showToast("CSV exported successfully", "success");

    } catch (err) {
        console.error(err);
        showToast("Export failed", "error");
    }
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

function goToDashboard() {
    window.location.href = "/static/dashboard.html";
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
            (item.application || "").toLowerCase().includes(searchText) ||
            (item.affected_ci || "").toLowerCase().includes(searchText) ||
            (item.location || "").toLowerCase().includes(searchText) ||
            (item.group_id || "").toLowerCase().includes(searchText);

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

async function viewLevels(unit_id, geography_id, infra_app_id, application_id, affected_ci, location, group_id) {
    
    const data = await apiFetch(
        `/escalations?unit_id=${unit_id}&geography_id=${geography_id}&infra_app_id=${infra_app_id}&application_id=${application_id}&affected_ci=${encodeURIComponent(affected_ci)}&location=${encodeURIComponent(location)}&group_id=${encodeURIComponent(group_id)}`
    );

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
    overlay.style.opacity = "0";
    overlay.style.transition = "opacity 0.2s ease";

    // Close when clicking outside
    overlay.addEventListener("click", closeModal);

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
    modal.style.opacity = "0";
    modal.style.transition = "opacity 0.2s ease, transform 0.2s ease";
    modal.style.transform = "translate(-50%, -55%)";

    let content = "<h3>Escalation Details</h3>";

    if(levels.length > 0 && levels[0].group_id){
        content += `<p><b>Group ID:</b> ${levels[0].group_id}</p>`;
    }

    content += "<h4>Escalation Levels</h4>";
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

    // Disable background scroll
    document.body.style.overflow = "hidden";

    // Trigger fade animation
    setTimeout(() => {
        overlay.style.opacity = "1";
        modal.style.opacity = "1";
        modal.style.transform = "translate(-50%, -50%)";
    }, 10);
}

function closeModal() {
    const modal = document.getElementById("levelsModal");
    const overlay = document.getElementById("modalOverlay");

    if (!modal || !overlay) return;

    // Fade out
    overlay.style.opacity = "0";
    modal.style.opacity = "0";
    modal.style.transform = "translate(-50%, -55%)";

    setTimeout(() => {
        modal.remove();
        overlay.remove();

        // Restore scroll
        document.body.style.overflow = "";
    }, 200);
}

// Close escalation modal on ESC key
document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
        const modal = document.getElementById("levelsModal");
        if (modal) {
            closeModal();
        }
    }
});

async function loadAuditLogs() {
    
    const responseData = await apiFetch("/audit-logs");

    const logs = Array.isArray(responseData)
        ? responseData
        : (responseData.data || []);

    auditData = logs.sort((a, b) =>
    new Date(b.created_at) - new Date(a.created_at)
    );

    filteredAuditData = auditData;
    currentAuditPage = 1;

    renderAuditTable();
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

function goToUpdate(unit_id, geography_id, infra_app_id, application_id, affected_ci, location, group_id) {

    const ciParam = affected_ci ? encodeURIComponent(affected_ci) : "";
    const locationParam = location ? encodeURIComponent(location) : "";
    const groupParam = group_id ? encodeURIComponent(group_id) : "";

    const url = `/static/create_escalation.html?` +
        `unit_id=${unit_id}` +
        `&geography_id=${geography_id}` +
        `&infra_app_id=${infra_app_id}` +
        `&application_id=${application_id}` +
        `&affected_ci=${ciParam}` +
        `&location=${locationParam}` +
        `&group_id=${groupParam}` +
        `&mode=update`;

    window.location.href = url;
}

function goToAdminLogin() {
    window.location.href = "/static/admin_login.html";
}

let levelCount = 0;

function addLevel() {
    levelCount++;

    const container = document.getElementById("levelsContainer");

    const div = document.createElement("div");
    div.classList.add("level-card");
    div.setAttribute("id", "level_" + levelCount);

    div.innerHTML = `
        <h4>Level ${levelCount}</h4>

        <div class="form-group autocomplete-wrapper">
            <label>User</label>
            <div class="autocomplete-container">
                <input type="text" class="levelUserInput" placeholder="Type user name..." autocomplete="off">
                <span class="input-spinner hidden"></span>
                <input type="hidden" class="levelUserId">
                <div class="userSuggestions"></div>
            </div>
        </div>

        <div class="form-group">
            <label>Override Mobile (optional)</label>
            <input type="text" class="overrideMobile">
        </div>

        <div class="form-group">
            <label>Override Email (optional)</label>
            <input type="text" class="overrideEmail">
        </div>
    `;

    container.appendChild(div);

    attachUserAutocomplete(div);

    // loadUsersForLevel(div.querySelector(".levelUser"));
}

async function submitEscalation() {

    console.log("submitEscalation triggered");

    const unit_id = document.getElementById("unit").value;
    const geography_id = document.getElementById("geography").value;
    const infra_app_id = document.getElementById("infra_app").value;
    const application_id = document.getElementById("application").value;
    const affected_ci = document.getElementById("affected_ci").value || null;
    const location = document.getElementById("location").value || null;
    const group_id = document.getElementById("group_id").value || null;

    const users = document.getElementsByClassName("levelUserId");
    const overrideMobiles = document.getElementsByClassName("overrideMobile");
    const overrideEmails = document.getElementsByClassName("overrideEmail");

    const levels = [];

    for (let i = 0; i < users.length; i++) {

        let userId = users[i].value;

        if (!userId) {
            const inputField = document.getElementsByClassName("levelUserInput")[i];
            const enteredName = inputField.value.trim().toLowerCase();

            if (window._usersCache) {
                const matchedUser = window._usersCache.find(u =>
                    u.display_name.toLowerCase() === enteredName
                );

                if (matchedUser) {
                    userId = matchedUser.id;
                }
            }
        }

        if (!userId) {
            showToast(`Level ${i + 1} user not selected properly`, "error");
            return;
        }

        levels.push({
            level_number: i + 1,
            user_id: parseInt(userId),
            override_mobile: overrideMobiles[i].value || null,
            override_email: overrideEmails[i].value || null
        });
    }

    const payload = {
        unit_id,
        geography_id,
        infra_app_id,
        application_id,
        affected_ci,
        location,
        group_id,
        levels
    };

    try {

        const params = new URLSearchParams(window.location.search);
        const mode = params.get("mode");

        const method = mode === "update" ? "PUT" : "POST";

        let url = "/escalations/";

        if (mode === "update") {

            const old_unit_id = params.get("unit_id");
            const old_geo_id = params.get("geography_id");
            const old_infra_id = params.get("infra_app_id");
            const old_app_id = params.get("application_id");
            const old_ci = params.get("affected_ci") || "";
            const old_location = params.get("location") || "";

            url = `/escalations?unit_id=${old_unit_id}` +
                  `&geography_id=${old_geo_id}` +
                  `&infra_app_id=${old_infra_id}` +
                  `&application_id=${old_app_id}` +
                  `&affected_ci=${encodeURIComponent(old_ci)}` +
                  `&location=${encodeURIComponent(old_location)}`;
        }

        await apiFetch(url, {
            method: method,
            body: JSON.stringify(payload)
        });

        showToast("Escalation saved successfully", "success");

        setTimeout(() => {
            window.location.href = "/static/escalations.html";
        }, 2000);

    } catch (err) {
        console.error(err);
    }
}

async function loadDropdown(endpoint, elementId) {
    
    const data = await apiFetch(`/${endpoint}`);

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

    // ---- READ QUERY PARAMS ----
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");

    if (mode === "update") {

        const unit_id = params.get("unit_id");
        const geography_id = params.get("geography_id");
        const infra_app_id = params.get("infra_app_id");
        const application_id = params.get("application_id");
        const affected_ci = params.get("affected_ci") || "";
        const location = params.get("location") || "";

        // Prefill form fields
        document.getElementById("unit").value = unit_id;
        document.getElementById("geography").value = geography_id;
        document.getElementById("infra_app").value = infra_app_id;
        document.getElementById("application").value = application_id;
        document.getElementById("affected_ci").value = affected_ci;
        document.getElementById("location").value = location;
        document.getElementById("group_id").value = params.get("group_id") || "";

        try {

            const data = await apiFetch(
                `/escalations?unit_id=${unit_id}&geography_id=${geography_id}&infra_app_id=${infra_app_id}&application_id=${application_id}&affected_ci=${encodeURIComponent(affected_ci)}&location=${encodeURIComponent(location)}`
            );

            // Load escalation levels
            loadLevelsForUpdate(data.levels);

            const submitBtn = document.getElementById("submitButton");
            submitBtn.innerText = "Update Escalation";
            submitBtn.dataset.mode = "update";

        } catch (err) {
            console.error("Failed to load escalation for update", err);
            showToast("Unable to load escalation details", "error");
        }
    }
}

async function loadUsersForLevel(selectElement) {

    const data = await apiFetch("/users");

    data.forEach(user => {
        const option = document.createElement("option");
        option.value = user.id;  // IMPORTANT
        option.text = user.display_name;
        selectElement.appendChild(option);
    });
}

async function attachUserAutocomplete(containerDiv) {

    const input = containerDiv.querySelector(".levelUserInput");
    const hiddenInput = containerDiv.querySelector(".levelUserId");
    const suggestionBox = containerDiv.querySelector(".userSuggestions");
    const spinner = containerDiv.querySelector(".input-spinner");

    let usersCache = [];

    // Load users once (cached)
    if (!window._usersCache) {
        spinner.classList.remove("hidden");
        window._usersCache = await apiFetch("/users");
        spinner.classList.add("hidden");
    }

    usersCache = window._usersCache;

    let debounceTimer;

    input.addEventListener("input", function () {

        const value = this.value.toLowerCase();

        // Reset only if user is typing manually
        if (document.activeElement === input) {
            hiddenInput.value = "";
        }

        suggestionBox.innerHTML = "";

        clearTimeout(debounceTimer);

        debounceTimer = setTimeout(() => {

            if (!value) return;

            spinner.classList.remove("hidden");

            const filtered = usersCache.filter(user =>
                user.display_name.toLowerCase().includes(value)
            ).slice(0, 5);

            spinner.classList.add("hidden");

            if (filtered.length === 0) {
                suggestionBox.innerHTML = "<div class='no-result'>No users found</div>";
                return;
            }

            filtered.forEach(user => {
                const div = document.createElement("div");
                div.className = "suggestion-item";
                div.innerText = user.display_name;

                div.onclick = () => {
                    input.value = user.display_name;
                    hiddenInput.value = user.id;
                    suggestionBox.innerHTML = "";
                };

                suggestionBox.appendChild(div);
            });

        }, 300); // 300ms debounce
    });

    document.addEventListener("click", function (e) {
        if (!containerDiv.contains(e.target)) {
            suggestionBox.innerHTML = "";
        }
    });
}

async function checkExistingEscalation() {

    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");

    if (mode === "update") {
        return;
    }

    const unit_id = document.getElementById("unit").value;
    const geography_id = document.getElementById("geography").value;
    const infra_app_id = document.getElementById("infra_app").value;
    const application_id = document.getElementById("application").value;
    const affected_ci = document.getElementById("affected_ci").value || "";
    const location = document.getElementById("location").value || "";

    if (
        !unit_id ||
        !geography_id ||
        !infra_app_id ||
        !application_id
    ) {
        return;
    }

    const submitBtn = document.getElementById("submitButton");

    try {
        const data = await apiFetch(
            `/escalations?unit_id=${unit_id}&geography_id=${geography_id}&infra_app_id=${infra_app_id}&application_id=${application_id}&affected_ci=${encodeURIComponent(affected_ci)}&location=${encodeURIComponent(location)}`,
            {},
            { silent: true }   // 🔥 important
        );

        loadLevelsForUpdate(data.levels);
        submitBtn.innerText = "Update Escalation";
        submitBtn.dataset.mode = "update";

    } catch (err) {

        if (mode === "update") {
            return;
        }

        clearLevels();
        submitBtn.innerText = "Create Escalation";
        submitBtn.dataset.mode = "create";
    }
}

function loadLevelsForUpdate(levels) {

    clearLevels();
    levelCount = 0;

    levels.forEach(level => {

        addLevel();

        const levelCards = document.getElementsByClassName("level-card");
        const currentCard = levelCards[levelCards.length - 1];

        const input = currentCard.querySelector(".levelUserInput");
        const hiddenInput = currentCard.querySelector(".levelUserId");
        const overrideMobile = currentCard.querySelector(".overrideMobile");
        const overrideEmail = currentCard.querySelector(".overrideEmail");

        // Prefill visible name
        input.value = level.display_name || "";

        // Prefill hidden user_id
        hiddenInput.value = level.user_id;

        overrideMobile.value = level.mobile || "";
        overrideEmail.value = level.email || "";
    });
}

function clearLevels() {
    const container = document.getElementById("levelsContainer");
    container.innerHTML = "";
    levelCount = 0;
}

async function deleteEscalation(unit_id, geography_id, infra_app_id, application_id, affected_ci, location) {

    const confirmDelete = confirm("Are you sure you want to delete this escalation?");

    if (!confirmDelete) return;

    await apiFetch(`/escalations?unit_id=${unit_id}&geography_id=${geography_id}&infra_app_id=${infra_app_id}&application_id=${application_id}&affected_ci=${encodeURIComponent(affected_ci)}&location=${encodeURIComponent(location)}`, {
        method: "DELETE"
    });

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

        const data = await apiFetch("/dashboard/summary");

        document.getElementById("totalEscalations").innerText = data.total_escalations;
        document.getElementById("totalUnits").innerText = data.total_units;
        document.getElementById("totalGeographies").innerText = data.total_geographies;
        document.getElementById("totalApplications").innerText = data.total_applications;
        document.getElementById("totalLevels").innerText = data.total_levels;
        document.getElementById("auditCreate").innerText = data.audit_breakdown.CREATE || 0;
        document.getElementById("auditUpdate").innerText = data.audit_breakdown.UPDATE || 0;
        document.getElementById("auditDelete").innerText = data.audit_breakdown.DELETE || 0;

        const tbody = document.getElementById("recentActivity");
        tbody.innerHTML = "";

        data.recent_activity.forEach(a => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${a.action}</td>
                <td>${a.performed_by || "-"}</td>
                <td>${formatToIST(a.created_at)}</td>
            `;
            tbody.appendChild(row);
        });

    } catch (err) {
        console.error(err);
        showToast("Dashboard error", "error");
    }
}

function goToEscalations() {
    window.location.href = "/static/escalations.html";
}

function applyAuditFilters() {

    const action = document.getElementById("actionFilter").value;
    const search = document.getElementById("auditSearch").value.toLowerCase();
    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;

    filteredAuditData = auditData.filter(log => {

        const matchesAction =
            action === "ALL" || log.action === action;

        const matchesSearch =
            log.performed_by &&
            log.performed_by.toLowerCase().includes(search);

        const logDate = new Date(log.created_at);

        const matchesStart =
            !startDate || logDate >= new Date(startDate);

        const matchesEnd =
            !endDate || logDate <= new Date(endDate + "T23:59:59");

        return matchesAction &&
               matchesSearch &&
               matchesStart &&
               matchesEnd;
    });

    currentAuditPage = 1;
    renderAuditTable();
}

function renderAuditTable() {

    const tbody = document.getElementById("auditTableBody");
    tbody.innerHTML = "";

    const start = (currentAuditPage - 1) * auditRowsPerPage;
    const end = start + auditRowsPerPage;
    const pageData = filteredAuditData.slice(start, end);

    pageData.forEach(log => {

        const row = document.createElement("tr");

        let badgeClass = "";
        if (log.action === "CREATE") badgeClass = "badge-create";
        if (log.action === "UPDATE") badgeClass = "badge-update";
        if (log.action === "DELETE") badgeClass = "badge-delete";

        row.innerHTML = `
            <td>${log.id}</td>
            <td><span class="badge ${badgeClass}">${log.action}</span></td>
            <td>${log.performed_by || "-"}</td>
            <td>${formatToIST(log.created_at)}</td>
        `;

        tbody.appendChild(row);
    });

    document.getElementById("auditResultCount").innerText =
        `Showing ${filteredAuditData.length} results`;

    renderAuditPagination();
}

function renderAuditPagination() {

    const totalPages =
        Math.ceil(filteredAuditData.length / auditRowsPerPage);

    const container =
        document.getElementById("auditPageNumbers");

    container.innerHTML = "";

    for (let i = 1; i <= totalPages; i++) {

        const btn = document.createElement("button");
        btn.className =
            "page-btn" + (i === currentAuditPage ? " active" : "");
        btn.innerText = i;

        btn.onclick = () => {
            currentAuditPage = i;
            renderAuditTable();
        };

        container.appendChild(btn);
    }
}

function prevAuditPage() {
    if (currentAuditPage > 1) {
        currentAuditPage--;
        renderAuditTable();
    }
}

function nextAuditPage() {
    const totalPages =
        Math.ceil(filteredAuditData.length / auditRowsPerPage);

    if (currentAuditPage < totalPages) {
        currentAuditPage++;
        renderAuditTable();
    }
}