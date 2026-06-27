const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const DB_PATH = path.join(__dirname, 'db.json');

const readDB = () => {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { members: [], exercises: {} };
  }
};

const writeDB = (data) => {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    return false;
  }
};

// ===== MEMBER ROUTES =====
app.get('/api/members', (req, res) => {
  const db = readDB();
  res.json(db.members);
});

app.post('/api/members', (req, res) => {
  const db = readDB();
  const newMember = req.body;
  let maxId = 100;
  db.members.forEach(m => {
    const num = parseInt(m.id.replace('M-', ''));
    if (num > maxId) maxId = num;
  });
  newMember.id = `M-${maxId + 1}`;
  newMember.createdAt = new Date().toISOString();
  db.members.push(newMember);
  db.exercises[newMember.id] = [];
  writeDB(db);
  res.status(201).json(newMember);
});

app.get('/api/members/:id', (req, res) => {
  const db = readDB();
  const member = db.members.find(m => m.id === req.params.id);
  if (!member) return res.status(404).json({ error: 'Not found' });
  res.json(member);
});

app.put('/api/members/:id', (req, res) => {
  const db = readDB();
  const index = db.members.findIndex(m => m.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Not found' });
  db.members[index] = { ...db.members[index], ...req.body };
  writeDB(db);
  res.json(db.members[index]);
});

app.delete('/api/members/:id', (req, res) => {
  const db = readDB();
  db.members = db.members.filter(m => m.id !== req.params.id);
  delete db.exercises[req.params.id];
  writeDB(db);
  res.json({ success: true });
});

// ===== EXERCISE ROUTES =====
app.get('/api/members/:id/exercises', (req, res) => {
  const db = readDB();
  res.json(db.exercises[req.params.id] || []);
});

app.post('/api/members/:id/exercises', (req, res) => {
  const db = readDB();
  const id = req.params.id;
  if (!db.exercises[id]) db.exercises[id] = [];
  const exercise = { ...req.body, assignedAt: new Date().toISOString() };
  db.exercises[id].push(exercise);
  writeDB(db);
  res.status(201).json(exercise);
});

app.put('/api/members/:id/exercises/:index', (req, res) => {
  const db = readDB();
  const id = req.params.id;
  const index = parseInt(req.params.index);
  if (!db.exercises[id] || index >= db.exercises[id].length) {
    return res.status(404).json({ error: 'Not found' });
  }
  db.exercises[id][index].completed = !db.exercises[id][index].completed;
  writeDB(db);
  res.json(db.exercises[id][index]);
});

// ===== ATTENDANCE ROUTES =====
app.put('/api/attendance/mark/:id', (req, res) => {
  const db = readDB();
  const member = db.members.find(m => m.id === req.params.id);
  if (!member) return res.status(404).json({ error: 'Not found' });
  if (member.attendanceStatus === 'pending' || member.attendanceStatus === 'approved') {
    return res.status(400).json({ error: 'Already marked' });
  }
  member.attendanceStatus = 'pending';
  writeDB(db);
  res.json(member);
});

app.put('/api/attendance/approve/:id', (req, res) => {
  const db = readDB();
  const member = db.members.find(m => m.id === req.params.id);
  if (!member) return res.status(404).json({ error: 'Not found' });
  if (member.attendanceStatus !== 'pending') {
    return res.status(400).json({ error: 'No pending attendance' });
  }
  member.attendanceStatus = 'approved';
  writeDB(db);
  res.json(member);
});

app.get('/api/attendance/pending', (req, res) => {
  const db = readDB();
  res.json(db.members.filter(m => m.attendanceStatus === 'pending'));
});

// ===== PAYMENT ROUTES =====
app.put('/api/payment/toggle/:id', (req, res) => {
  const db = readDB();
  const member = db.members.find(m => m.id === req.params.id);
  if (!member) return res.status(404).json({ error: 'Not found' });
  member.paid = !member.paid;
  writeDB(db);
  res.json(member);
});

app.get('/api/payment/stats', (req, res) => {
  const db = readDB();
  const total = db.members.length;
  const paid = db.members.filter(m => m.paid).length;
  let revenue = 0;
  db.members.forEach(m => {
    if (m.paid && m.status === 'active') {
      if (m.plan === 'Basic Membership') revenue += 1000;
      else if (m.plan === 'Pro Membership') revenue += 2000;
      else if (m.plan === 'Elite Membership') revenue += 3500;
    }
  });
  res.json({ total, paid, unpaid: total - paid, revenue });
});

app.get('/health', (req, res) => {
  const db = readDB();
  res.json({ status: 'ok', members: db.members.length });
});

app.listen(PORT, () => {
  console.log(`🏋️ SMD Gym Server running on http://localhost:${PORT}`);
});