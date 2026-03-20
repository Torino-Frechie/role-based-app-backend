let currentUser = null;

// Function: setAuthState(isAuth, user)
function setAuthState(isAuthenticated, user = null) {
    const body = document.body;
    const navName = document.getElementById('nav-display-name');
    
    if (isAuthenticated && user) {
        currentUser = user;
                navName.textContent = user.role === 'admin' ? 'Admin' : user.firstName;
        
        body.classList.remove('not-authenticated');
        body.classList.add('authenticated');
        body.classList.toggle('is-admin', user.role === 'admin');

        document.getElementById('profile-email').textContent = user.email;
        document.getElementById('profile-role').textContent = user.role.toUpperCase();

        const brand = document.querySelector('.navbar-brand');
        brand.textContent = `Full-Stack App (${user.firstName} ${user.lastName})`;

    } else {
        currentUser = null;
                body.classList.add('not-authenticated');
        body.classList.remove('authenticated');
        body.classList.remove('is-admin');
        
        const brand = document.querySelector('.navbar-brand');
        brand.textContent = `Full-Stack App`;
    }
    // handleRouting() removed — called externally after await checkSession()
}

async function renderRequests() {
    const tbody = document.getElementById('requests-table-body');
    const tableContainer = document.getElementById('requests-table-container');
    const emptyState = document.getElementById('requests-empty-state');
    if (!tbody) return;

    try {
        const response = await fetch('http://localhost:3000/api/requests', {
            headers: getAuthHeader()
        });
        if (!response.ok) return;
        const data = await response.json();
        const myRequests = data.requests;

        if (myRequests.length === 0) {
            tableContainer.classList.add('d-none');
            emptyState.classList.remove('d-none');
        } else {
            tableContainer.classList.remove('d-none');
            emptyState.classList.add('d-none');
            tbody.innerHTML = '';
            myRequests.forEach(req => {
                const itemsList = req.items.map(i => `${i.qty}x ${i.name}`).join(', ');
                let badgeClass = 'bg-warning text-dark';
                if (req.status === 'Approved') badgeClass = 'bg-success';
                tbody.innerHTML += `
                    <tr>
                        <td>${req.date}</td>
                        <td>${req.employeeEmail}</td>
                        <td><span class="badge bg-info text-dark">${req.type}</span></td>
                        <td>${itemsList}</td>
                        <td><span class="badge ${badgeClass}">${req.status}</span></td>
                        <td>
                            ${req.status === 'Pending' && currentUser.role === 'admin' ? `
                                <button class="btn btn-sm btn-success me-2" onclick="approveRequest(${req.id})">Approve</button>
                            ` : ''}
                            <button class="btn btn-sm btn-danger" onclick="deleteRequest(${req.id})">Delete</button>
                        </td>
                    </tr>
                `;
            });
        }
    } catch (err) {
        console.error('Failed to load requests', err);
    }
}

async function approveRequest(id) {
    try {
        const response = await fetch(`http://localhost:3000/api/requests/${id}/approve`, {
            method: 'PUT',
            headers: getAuthHeader()
        });
        if (response.ok) {
            showToast('Request Approved');
            renderRequests();
        }
    } catch (err) {
        showToast('Network error', 'error');
    }
}
// Logout
function logout() {
    sessionStorage.removeItem('authToken'); // ✅ clear the JWT so checkSession won't restore the session
    setAuthState(false);
    handleRouting(); // ✅ re-route now that currentUser is null
    window.location.hash = '#home';
}

async function checkSession() {
    const token = sessionStorage.getItem('authToken');
    if (token) {
        try {
            // Send token to backend — let the server verify it
            const response = await fetch('http://localhost:3000/api/profile', {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();

                // Build user object from server response
                const user = {
                    firstName: data.user.username,
                    lastName: '',
                    email: data.user.username,
                    role: data.user.role,
                    verified: true
                };
                setAuthState(true, user);
            } else {
                // Token rejected by server (expired or invalid)
                sessionStorage.removeItem('authToken');
                setAuthState(false);
            }
        } catch (e) {
            // Network error — backend might be offline
            sessionStorage.removeItem('authToken');
            setAuthState(false);
        }
    } else {
        setAuthState(false);
    }
}

function handleRouting() {
    let hash = window.location.hash || '#home';

    const protectedRoutes = ['#profile', '#requests'];
    const adminRoutes = ['#employees', '#departments', '#accounts'];

    if ((protectedRoutes.includes(hash) || adminRoutes.includes(hash)) && !currentUser) {
        window.location.hash = '#login';
        return;
    }

    if (adminRoutes.includes(hash) && currentUser && currentUser.role !== 'admin') {
        window.location.hash = '#profile';
        return;
    }
    if (hash === '#login') {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.reset();
        }
    }

    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    
    const targetPage = document.querySelector(hash);
    if (targetPage) {
        targetPage.classList.add('active');
    } else {
        document.querySelector('#home').classList.add('active');
    }

    if (hash === '#requests') {
        renderRequests(); 
    }
    if (hash === '#accounts') {
        renderAccountsList();
    }
    if (hash === '#employees') {
        renderEmployeesTable();
    }
    if (hash === '#departments') {
        renderDepartmentsTable();
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await checkSession();
    handleRouting();

    window.addEventListener('hashchange', handleRouting);

    // Registration 
    const regForm = document.getElementById('register-form');
    if (regForm) {
        regForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const firstName = document.getElementById('reg-fname').value;
            const lastName = document.getElementById('reg-lname').value;
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;

            try {
                const response = await fetch('http://localhost:3000/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: email, password, role: 'user' })
                });

                const data = await response.json();

                if (response.ok) {
                    // Store email in sessionStorage for the verify screen
                    sessionStorage.setItem('unverified_email', email);
                    document.getElementById('verify-email-display').textContent = email;
                    regForm.reset();
                    window.location.hash = '#verify-email';
                } else {
                    alert('Registration failed: ' + data.error);
                }
            } catch (err) {
                alert('Network error. Is the backend running on port 3000?');
            }
        });
    }

    // Login Submit
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            try {
                const response = await fetch('http://localhost:3000/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (response.ok) {
                    sessionStorage.setItem('authToken', data.token);
                    // Build a user object compatible with the existing UI
                    const user = {
                        firstName: data.user.username,
                        lastName: '',
                        email: data.user.username,
                        role: data.user.role,
                        verified: true
                    };
                    setAuthState(true, user);
                    window.location.hash = '#profile';
                } else {
                    alert('Login failed: ' + data.error);
                }
            } catch (err) {
                alert('Network error. Is the backend running on port 3000?');
            }
        });
    }
});

// email simulation
function prepareVerifyModal() {
    // Modal is already set up, just show it
}

function confirmEmailVerification() {
    const email = sessionStorage.getItem('unverified_email');

    if (email) {
        showToast('Email Verified Successfully!');
        sessionStorage.removeItem('unverified_email');

        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('verifyEmailModal'));
        if (modal) modal.hide();

        // Redirect to login after short delay
        setTimeout(() => {
            window.location.hash = '#login';
        }, 1000);
    }
}

function simulateEmailVerification() {
    const email = sessionStorage.getItem('unverified_email');

    if (email) {
        showToast('Email Verified Successfully!');
        sessionStorage.removeItem('unverified_email');
        window.location.hash = '#login';
    }
}


// UTILITY: TOASTS 
function showToast(message, type = 'success') {
    const toastEl = document.getElementById('liveToast');
    document.getElementById('toast-message').textContent = message;
    document.getElementById('toast-header').className = `toast-header text-white ${type === 'success' ? 'bg-success' : 'bg-danger'}`;
    const toast = new bootstrap.Toast(toastEl);
    toast.show();
}

// Variable to track editing state
let currentEditingEmail = null;

async function renderAccountsList() {
    const tbody = document.getElementById('accounts-table-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Loading...</td></tr>';

    try {
        const response = await fetch('http://localhost:3000/api/users', {
            headers: getAuthHeader()
        });

        if (!response.ok) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Failed to load users.</td></tr>';
            return;
        }

        const data = await response.json();
        tbody.innerHTML = '';

        data.users.forEach(u => {
            tbody.innerHTML += `
                <tr>
                    <td>${u.username}</td>
                    <td>${u.username}</td>
                    <td><span class="badge ${u.role === 'admin' ? 'bg-danger' : 'bg-secondary'}">${u.role}</span></td>
                    <td><span class="badge bg-success">✅ Verified</span></td>
                    <td>
                        <button class="btn btn-sm btn-danger" onclick="prepareDeleteAccount('${u.username}')" data-bs-toggle="modal" data-bs-target="#deleteAccountModal">Delete</button>
                    </td>
                </tr>`;
        });
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Network error. Is the backend running?</td></tr>';
    }
}

function prepareAddAccount() {
    currentEditingEmail = null;
    document.getElementById('account-form').reset();
    document.getElementById('acc-email').disabled = false;
}

function prepareEditAccount(username) {
    // Account editing not supported via backend yet — use Register to add users
    showToast('Use the Register form to add new users', 'error');
}

async function handleAccountSubmit(e) {
    e.preventDefault();
    const username = document.getElementById('acc-email').value;
    const password = document.getElementById('acc-pass').value;
    const role = document.getElementById('acc-role').value;
    try {
        const response = await fetch('http://localhost:3000/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
            body: JSON.stringify({ username, password, role })
        });
        const data = await response.json();
        if (response.ok) {
            showToast('Account Created');
            renderAccountsList();
            const modal = bootstrap.Modal.getInstance(document.getElementById('accountModal'));
            if (modal) modal.hide();
        } else {
            alert(data.error || 'Failed to create account');
        }
    } catch (err) { showToast('Network error', 'error'); }
}

let currentResetEmail = null;
let currentDeleteEmail = null;

function prepareResetPassword(email) {
    currentResetEmail = email;
    document.getElementById('reset-email-display').value = email;
    document.getElementById('reset-new-password').value = '';
}

function confirmResetPassword(e) {
    e.preventDefault();
    // Password reset via backend not yet implemented
    showToast('Password reset not supported yet', 'error');
    const modal = bootstrap.Modal.getInstance(document.getElementById('resetPasswordModal'));
    if (modal) modal.hide();
}

function prepareDeleteAccount(email) {
    currentDeleteEmail = email;
    document.getElementById('delete-email-display').textContent = email;
}

async function confirmDeleteAccount() {
    if (!currentDeleteEmail) return;

    try {
        const response = await fetch(`http://localhost:3000/api/users/${encodeURIComponent(currentDeleteEmail)}`, {
            method: 'DELETE',
            headers: getAuthHeader()
        });

        if (response.ok) {
            showToast('Account Deleted');
            renderAccountsList();
        } else {
            const data = await response.json();
            showToast(data.error || 'Failed to delete account', 'error');
        }
    } catch (err) {
        showToast('Network error', 'error');
    }

    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('deleteAccountModal'));
    if (modal) modal.hide();
}

function addRequestItemRow() {
    const container = document.getElementById('req-items-container');
    const div = document.createElement('div');
    div.className = 'input-group mb-2 req-item-row';
    div.innerHTML = `
        <input type="text" class="form-control item-name" placeholder="Item Name" required>
        <input type="number" class="form-control item-qty" placeholder="Qty" style="max-width: 80px;" min="1" required>
        <button type="button" class="btn btn-outline-danger" onclick="this.parentElement.remove()">×</button>
    `;
    container.appendChild(div);
}

function prepareNewRequest() {
    document.getElementById('request-form').reset();
    document.getElementById('req-items-container').innerHTML = ''; // Clear previous items
    addRequestItemRow(); // Add one empty row to start
}

// Function to handle saving a new request
document.getElementById('request-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const itemRows = document.querySelectorAll('.req-item-row');
    const items = Array.from(itemRows).map(row => ({
        name: row.querySelector('.item-name').value,
        qty: row.querySelector('.item-qty').value
    }));
    if (items.length === 0) { alert("Please add at least one item."); return; }
    try {
        const response = await fetch('http://localhost:3000/api/requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
            body: JSON.stringify({
                type: document.getElementById('req-type').value,
                items,
                date: new Date().toLocaleDateString()
            })
        });
        if (response.ok) {
            showToast('Request Submitted');
            renderRequests();
            const modal = bootstrap.Modal.getInstance(document.getElementById('requestModal'));
            modal.hide();
        }
    } catch (err) { showToast('Network error', 'error'); }
});

async function deleteRequest(id) {
    if (confirm("Cancel this request?")) {
        try {
            const response = await fetch(`http://localhost:3000/api/requests/${id}`, {
                method: 'DELETE',
                headers: getAuthHeader()
            });
            if (response.ok) { renderRequests(); }
        } catch (err) { showToast('Network error', 'error'); }
    }
}

// EMPLOYEES LOGIC

let currentEditingEmployeeId = null;

async function prepareEmployeeModal() {
    currentEditingEmployeeId = null;
    document.getElementById('employee-form').reset();
    document.getElementById('emp-id').disabled = false;
    // Fill User Email dropdown from backend
    const userSelect = document.getElementById('emp-user-select');
    const deptSelect = document.getElementById('emp-dept-select');
    try {
        const [usersRes, deptsRes] = await Promise.all([
            fetch('http://localhost:3000/api/users', { headers: getAuthHeader() }),
            fetch('http://localhost:3000/api/departments', { headers: getAuthHeader() })
        ]);
        const usersData = await usersRes.json();
        const deptsData = await deptsRes.json();
        if (userSelect) userSelect.innerHTML = usersData.users.map(u => `<option value="${u.username}">${u.username}</option>`).join('');
        if (deptSelect) deptSelect.innerHTML = deptsData.departments.map(d => `<option value="${d.name}">${d.name}</option>`).join('');
    } catch (err) { console.error('Failed to load dropdowns', err); }
}

async function prepareEditEmployee(id) {
    currentEditingEmployeeId = id;
    try {
        const [empsRes, usersRes, deptsRes] = await Promise.all([
            fetch('http://localhost:3000/api/employees', { headers: getAuthHeader() }),
            fetch('http://localhost:3000/api/users', { headers: getAuthHeader() }),
            fetch('http://localhost:3000/api/departments', { headers: getAuthHeader() })
        ]);
        const empsData = await empsRes.json();
        const usersData = await usersRes.json();
        const deptsData = await deptsRes.json();
        const emp = empsData.employees.find(e => e.id === id);
        if (!emp) return;
        const userSelect = document.getElementById('emp-user-select');
        const deptSelect = document.getElementById('emp-dept-select');
        if (userSelect) userSelect.innerHTML = usersData.users.map(u => `<option value="${u.username}" ${u.username === emp.email ? 'selected' : ''}>${u.username}</option>`).join('');
        if (deptSelect) deptSelect.innerHTML = deptsData.departments.map(d => `<option value="${d.name}" ${d.name === emp.dept ? 'selected' : ''}>${d.name}</option>`).join('');
        document.getElementById('emp-id').value = emp.id;
        document.getElementById('emp-id').disabled = true;
        document.getElementById('emp-user-select').value = emp.email;
        document.getElementById('emp-position').value = emp.position;
        document.getElementById('emp-dept-select').value = emp.dept;
        document.getElementById('emp-date').value = emp.hireDate;
    } catch (err) { console.error('Failed to load employee for edit', err); }
}

async function handleEmployeeSubmit(e) {
    e.preventDefault();
    const employeeData = {
        id: document.getElementById('emp-id').value,
        email: document.getElementById('emp-user-select').value,
        position: document.getElementById('emp-position').value,
        dept: document.getElementById('emp-dept-select').value,
        hireDate: document.getElementById('emp-date').value
    };
    try {
        const url = currentEditingEmployeeId
            ? `http://localhost:3000/api/employees/${currentEditingEmployeeId}`
            : 'http://localhost:3000/api/employees';
        const method = currentEditingEmployeeId ? 'PUT' : 'POST';
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
            body: JSON.stringify(employeeData)
        });
        const data = await response.json();
        if (response.ok) {
            showToast(currentEditingEmployeeId ? 'Employee Updated' : 'Employee Created');
            renderEmployeesTable();
            const modal = bootstrap.Modal.getInstance(document.getElementById('employeeModal'));
            if (modal) modal.hide();
        } else {
            alert(data.error || 'Failed to save employee');
        }
    } catch (err) { showToast('Network error', 'error'); }
}

async function renderEmployeesTable() {
    const tbody = document.getElementById('employees-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Loading...</td></tr>';
    try {
        const response = await fetch('http://localhost:3000/api/employees', { headers: getAuthHeader() });
        if (!response.ok) { tbody.innerHTML = '<tr><td colspan="5" class="text-danger text-center">Failed to load employees.</td></tr>'; return; }
        const data = await response.json();
        tbody.innerHTML = '';
        data.employees.forEach(emp => {
            tbody.innerHTML += `
                <tr>
                    <td>${emp.id}</td>
                    <td>${emp.email}</td>
                    <td>${emp.position}</td>
                    <td>${emp.dept}</td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="prepareEditEmployee('${emp.id}')" data-bs-toggle="modal" data-bs-target="#employeeModal">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="prepareDeleteEmployee('${emp.id}')" data-bs-toggle="modal" data-bs-target="#deleteEmployeeModal">Delete</button>
                    </td>
                </tr>
            `;
        });
    } catch (err) { tbody.innerHTML = '<tr><td colspan="5" class="text-danger text-center">Network error.</td></tr>'; }
}

let currentDeleteEmployeeId = null;

function prepareDeleteEmployee(id) {
    currentDeleteEmployeeId = id;
    document.getElementById('delete-employee-display').textContent = id;
}

async function confirmDeleteEmployee() {
    if (!currentDeleteEmployeeId) return;
    try {
        const response = await fetch(`http://localhost:3000/api/employees/${currentDeleteEmployeeId}`, {
            method: 'DELETE',
            headers: getAuthHeader()
        });
        if (response.ok) {
            showToast('Employee Deleted');
            renderEmployeesTable();
        }
    } catch (err) { showToast('Network error', 'error'); }
    const modal = bootstrap.Modal.getInstance(document.getElementById('deleteEmployeeModal'));
    if (modal) modal.hide();
}

async function renderDepartmentsTable() {
    const tbody = document.getElementById('dept-table');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="3" class="text-center">Loading...</td></tr>';
    try {
        const response = await fetch('http://localhost:3000/api/departments', { headers: getAuthHeader() });
        if (!response.ok) { tbody.innerHTML = '<tr><td colspan="3" class="text-danger text-center">Failed to load departments.</td></tr>'; return; }
        const data = await response.json();
        tbody.innerHTML = '';
        data.departments.forEach(dept => {
            tbody.innerHTML += `
                <tr>
                    <td>${dept.name}</td>
                    <td>${dept.description}</td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="prepareEditDepartment(${dept.id})" data-bs-toggle="modal" data-bs-target="#departmentModal">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="prepareDeleteDepartment(${dept.id})" data-bs-toggle="modal" data-bs-target="#deleteDepartmentModal">Delete</button>
                    </td>
                </tr>
            `;
        });
    } catch (err) { tbody.innerHTML = '<tr><td colspan="3" class="text-danger text-center">Network error.</td></tr>'; }
}   

// Department modal-driven CRUD
let currentEditingDepartmentId = null;
let currentDeleteDepartmentId = null;

function prepareAddDepartment() {
    currentEditingDepartmentId = null;
    const form = document.getElementById('department-form');
    if (form) form.reset();
}

async function prepareEditDepartment(id) {
    currentEditingDepartmentId = id;
    try {
        const response = await fetch('http://localhost:3000/api/departments', { headers: getAuthHeader() });
        const data = await response.json();
        const dept = data.departments.find(d => d.id === id);
        if (!dept) return;
        document.getElementById('dept-name').value = dept.name;
        document.getElementById('dept-desc').value = dept.description || '';
    } catch (err) { console.error('Failed to load department', err); }
}

async function handleDepartmentSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('dept-name').value.trim();
    const desc = document.getElementById('dept-desc').value.trim();
    if (!name) { alert('Department name is required'); return; }
    try {
        const url = currentEditingDepartmentId
            ? `http://localhost:3000/api/departments/${currentEditingDepartmentId}`
            : 'http://localhost:3000/api/departments';
        const method = currentEditingDepartmentId ? 'PUT' : 'POST';
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
            body: JSON.stringify({ name, description: desc })
        });
        if (response.ok) {
            showToast(currentEditingDepartmentId ? 'Department Updated' : 'Department Created');
            renderDepartmentsTable();
            const modal = bootstrap.Modal.getInstance(document.getElementById('departmentModal'));
            if (modal) modal.hide();
        }
    } catch (err) { showToast('Network error', 'error'); }
}

async function prepareDeleteDepartment(id) {
    currentDeleteDepartmentId = id;
    try {
        const response = await fetch('http://localhost:3000/api/departments', { headers: getAuthHeader() });
        const data = await response.json();
        const dept = data.departments.find(d => d.id === id);
        if (dept) document.getElementById('delete-dept-display').textContent = dept.name;
    } catch (err) { console.error(err); }
}

async function confirmDeleteDepartment() {
    if (!currentDeleteDepartmentId) return;
    try {
        const response = await fetch(`http://localhost:3000/api/departments/${currentDeleteDepartmentId}`, {
            method: 'DELETE',
            headers: getAuthHeader()
        });
        if (response.ok) {
            showToast('Department Deleted');
            renderDepartmentsTable();
        }
    } catch (err) { showToast('Network error', 'error'); }
    const modal = bootstrap.Modal.getInstance(document.getElementById('deleteDepartmentModal'));
    if (modal) modal.hide();
}

async function login(username, password) {
  try {
    const response = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (response.ok) {
      // Save token in memory (or sessionStorage for page refresh)
      sessionStorage.setItem('authToken', data.token);
      showDashboard(data.user);
    } else {
      alert('Login failed: ' + data.error);
    }
  } catch (err) {
    alert('Network error');
  }
}

function getAuthHeader() {
  const token = sessionStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Example: Fetch admin data
async function loadAdminDashboard() {
  const res = await fetch('http://localhost:3000/api/admin/dashboard', {
    headers: getAuthHeader()
  });

  if (res.ok) {
    const data = await res.json();
    document.getElementById('content').innerText = data.message;
  } else {
    document.getElementById('content').innerText = 'Access denied!';
  }
}