// server.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'your-very-secure-secret'; // In production, use environment variables!

// Enable CORS for frontend (e.g., Live Server on port 5500)
app.use(cors({
  origin: ['http://127.0.0.1:5500', 'http://localhost:5500'] // Adjust based on your frontend URL
}));

// Middleware to parse JSON
app.use(express.json());

//  In-memory "database" (replace with MongoDB later)
let users = [
  { id: 1, username: 'admin@example.com', password: 'UNHASHED', role: 'admin' },
  { id: 2, username: 'alice@example.com', password: 'UNHASHED', role: 'user' }
];

// Helper: Hash password (run once to generate hashes)
// console.log(bcrypt.hashSync('admin123', 10)); // Use this to generate real hashes
// Pre-hash known passwords for demo
if (!users[0].password.includes('$2a$')) {
  users[0].password = bcrypt.hashSync('admin123', 10);
  users[1].password = bcrypt.hashSync('user123', 10);
}

// 🚪 AUTH ROUTES

// POST /api/register
app.post('/api/register', async (req, res) => {
  const { username, password, role = 'user' } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  // Check if user exists
  const existing = users.find(u => u.username === username);
  if (existing) {
    return res.status(409).json({ error: 'User already exists' });
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = {
    id: users.length + 1,
    username,
    password: hashedPassword,
    role // Note: In real apps, role should NOT be set by client!
  };

  users.push(newUser);
  res.status(201).json({ message: 'User registered', username, role });
});

// POST /api/login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  const user = users.find(u => u.username === username);
  if (!user || !await bcrypt.compare(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Generate JWT token
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    SECRET_KEY,
    { expiresIn: '1h' }
  );

  res.json({ token, user: { username: user.username, role: user.role } });
});

// 🔒 PROTECTED ROUTE: Get user profile
app.get('/api/profile', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// 🛡️ ROLE-BASED PROTECTED ROUTE: Admin-only
app.get('/api/admin/dashboard', authenticateToken, authorizeRole('admin'), (req, res) => {
  res.json({ message: 'Welcome to admin dashboard!', data: 'Secret admin info' });
});

// 🌐 PUBLIC ROUTE: Guest content
app.get('/api/content/guest', (req, res) => {
  res.json({ message: 'Public content for all visitors' });
});

// 👥 ADMIN ROUTE: Get all users
app.get('/api/users', authenticateToken, authorizeRole('admin'), (req, res) => {
  const safeUsers = users.map(({ password, ...rest }) => rest); // exclude passwords
  res.json({ users: safeUsers });
});


// 📦 In-memory stores for employees, departments, requests
let employees = [];
let departments = [
  { id: 1, name: 'Engineering', description: 'Software devs' },
  { id: 2, name: 'HR', description: 'Human Resources' }
];
let requests = [];

// ─── EMPLOYEES ───────────────────────────────────────────
// GET all employees (admin only)
app.get('/api/employees', authenticateToken, authorizeRole('admin'), (req, res) => {
  res.json({ employees });
});

// POST add employee (admin only)
app.post('/api/employees', authenticateToken, authorizeRole('admin'), (req, res) => {
  const { id, email, position, dept, hireDate } = req.body;
  if (employees.find(e => e.id === id)) {
    return res.status(409).json({ error: 'Employee ID already exists' });
  }
  const newEmployee = { id, email, position, dept, hireDate };
  employees.push(newEmployee);
  res.status(201).json({ message: 'Employee created', employee: newEmployee });
});

// PUT update employee (admin only)
app.put('/api/employees/:id', authenticateToken, authorizeRole('admin'), (req, res) => {
  const index = employees.findIndex(e => e.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Employee not found' });
  employees[index] = { ...employees[index], ...req.body };
  res.json({ message: 'Employee updated', employee: employees[index] });
});

// DELETE employee (admin only)
app.delete('/api/employees/:id', authenticateToken, authorizeRole('admin'), (req, res) => {
  const index = employees.findIndex(e => e.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Employee not found' });
  employees.splice(index, 1);
  res.json({ message: 'Employee deleted' });
});

// ─── DEPARTMENTS ─────────────────────────────────────────
// GET all departments (any logged-in user)
app.get('/api/departments', authenticateToken, (req, res) => {
  res.json({ departments });
});

// POST add department (admin only)
app.post('/api/departments', authenticateToken, authorizeRole('admin'), (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Department name required' });
  const newDept = { id: Date.now(), name, description };
  departments.push(newDept);
  res.status(201).json({ message: 'Department created', department: newDept });
});

// PUT update department (admin only)
app.put('/api/departments/:id', authenticateToken, authorizeRole('admin'), (req, res) => {
  const dept = departments.find(d => d.id === Number(req.params.id));
  if (!dept) return res.status(404).json({ error: 'Department not found' });
  dept.name = req.body.name || dept.name;
  dept.description = req.body.description || dept.description;
  res.json({ message: 'Department updated', department: dept });
});

// DELETE department (admin only)
app.delete('/api/departments/:id', authenticateToken, authorizeRole('admin'), (req, res) => {
  const index = departments.findIndex(d => d.id === Number(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'Department not found' });
  departments.splice(index, 1);
  res.json({ message: 'Department deleted' });
});

// ─── REQUESTS ────────────────────────────────────────────
// GET requests — admin sees all, user sees only their own
app.get('/api/requests', authenticateToken, (req, res) => {
  if (req.user.role === 'admin') {
    res.json({ requests });
  } else {
    res.json({ requests: requests.filter(r => r.employeeEmail === req.user.username) });
  }
});

// POST add request (any logged-in user)
app.post('/api/requests', authenticateToken, (req, res) => {
  const { type, items, date } = req.body;
  const newRequest = {
    id: Date.now(),
    type,
    items,
    status: 'Pending',
    date,
    employeeEmail: req.user.username
  };
  requests.push(newRequest);
  res.status(201).json({ message: 'Request created', request: newRequest });
});

// PUT approve request (admin only)
app.put('/api/requests/:id/approve', authenticateToken, authorizeRole('admin'), (req, res) => {
  const req_ = requests.find(r => r.id === Number(req.params.id));
  if (!req_) return res.status(404).json({ error: 'Request not found' });
  req_.status = 'Approved';
  res.json({ message: 'Request approved', request: req_ });
});

// DELETE request (owner or admin)
app.delete('/api/requests/:id', authenticateToken, (req, res) => {
  const index = requests.findIndex(r => r.id === Number(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'Request not found' });
  const request = requests[index];
  if (req.user.role !== 'admin' && request.employeeEmail !== req.user.username) {
    return res.status(403).json({ error: 'Access denied' });
  }
  requests.splice(index, 1);
  res.json({ message: 'Request deleted' });
});

// 🗑️ ADMIN ROUTE: Delete a user
app.delete('/api/users/:username', authenticateToken, authorizeRole('admin'), (req, res) => {
  const index = users.findIndex(u => u.username === req.params.username);
  if (index === -1) return res.status(404).json({ error: 'User not found' });
  users.splice(index, 1);
  res.json({ message: 'User deleted' });
});

// 🧩 MIDDLEWARE

// Token authentication
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

// Role authorization
function authorizeRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: 'Access denied: insufficient permissions' });
    }
    next();
  };
}

// 🏁 Start server
app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
  console.log(`🔐 Try logging in with:`);
  console.log(`  - Admin: username=admin@example.com, password=admin123`);
  console.log(`  - User:  username=alice@example.com, password=user123`);
});