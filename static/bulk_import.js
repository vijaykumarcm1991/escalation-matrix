// Admin protection
if (!isAdminLoggedIn()) {
    window.location.href = "/static/admin_login.html";
}

let parsedData = [];

async function planBulkImport() {

    const fileInput = document.getElementById("excelFile");

    if (!fileInput.files.length) {
        showToast("Please select Excel file", "error");
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async function(e) {

        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });

        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);

        parsedData = convertRowsToJson(rows);

        const response = await apiFetch("/admin/bulk-import/", {
            method: "POST",
            body: JSON.stringify({
                mode: "plan",
                data: parsedData
            })
        });

        renderPlanResult(response);
    };

    reader.readAsArrayBuffer(file);
}

function convertRowsToJson(rows) {

    return rows.map(row => {

        const levels = [];

        Object.keys(row).forEach(key => {
            if (key.toLowerCase().startsWith("level")) {
                const levelNumber = parseInt(key.replace(/\D/g, ""));
                const user = row[key];

                if (user) {
                    levels.push({
                        level: levelNumber,
                        user: user
                    });
                }
            }
        });

        levels.sort((a, b) => a.level - b.level);

        return {
            unit: row["unit"],
            geography: row["geography"],
            infra_app: row["infra_app"],
            application: row["application"],
            affected_ci: row["affected_ci"] || "",
            levels: levels
        };
    });
}

function renderPlanResult(result) {

    const summaryDiv = document.getElementById("planSummary");
    const errorsDiv = document.getElementById("planErrors");
    const applyBtn = document.getElementById("applyBtn");

    summaryDiv.classList.remove("hidden");

    summaryDiv.innerHTML = `
        <h3>Plan Summary</h3>
        <div>Create: <strong>${result.summary.create}</strong></div>
        <div>Update: <strong>${result.summary.update}</strong></div>
        <div>Reactivate: <strong>${result.summary.reactivate}</strong></div>
        <div>No Change: <strong>${result.summary.no_change}</strong></div>
        <div>Errors: <strong>${result.summary.errors.length}</strong></div>
    `;

    if (result.summary.errors.length > 0) {

        applyBtn.disabled = true;

        errorsDiv.classList.remove("hidden");
        errorsDiv.innerHTML = `
            <h4>Error Details</h4>
            <pre>${JSON.stringify(result.summary.errors, null, 2)}</pre>
        `;

    } else {
        errorsDiv.classList.add("hidden");
        applyBtn.disabled = false;
    }
}

async function applyBulkImport() {

    if (!confirm("Are you sure you want to apply bulk import?")) return;

    const response = await apiFetch("/admin/bulk-import/", {
        method: "POST",
        body: JSON.stringify({
            mode: "apply",
            data: parsedData
        })
    });

    showToast("Bulk import applied successfully", "success");

    document.getElementById("applyBtn").disabled = true;
}