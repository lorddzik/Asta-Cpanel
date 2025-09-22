// File: index.js (Lengkap dengan Userbot + Gambar + ID User)

require('./setting');
const express = require('express');
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const os = require('os');
const fs = require('fs');

const app = express();
const port = process.env.SERVER_PORT || 3000;

const adminDbPath = './db/admin.json';
const userDbPath = './db/user.json';
const ROLE_ORDER = ['tangan_kanan', 'owner', 'partner', 'admin_panel', 'reseller'];

// Inisialisasi Userbot Client
const client = new TelegramClient(new StringSession(global.session || ''), global.apiId, global.apiHash, {
  connectionRetries: 5,
});

(async () => {
    try {
        console.log("Menghubungkan ke userbot...");
        await client.connect();
        console.log("Userbot terhubung!");
    } catch (e) {
        console.error("Gagal menghubungkan userbot. Pastikan session string, apiId, dan apiHash valid.", e);
    }
})();

// Inisialisasi database
if (!fs.existsSync(adminDbPath)) fs.writeFileSync(adminDbPath, JSON.stringify({}, null, 2));
if (!fs.existsSync(userDbPath)) {
    const emptyRoles = ROLE_ORDER.reduce((acc, r) => ({ ...acc, [r]: {} }), {});
    fs.writeFileSync(userDbPath, JSON.stringify(emptyRoles, null, 2));
}

app.use(express.json());
app.use(express.static(__dirname));
app.use(express.static('public'));

// Routes HTML
app.get('/', (req, res) => res.sendFile(__dirname + '/public/index.html'));
app.get('/admin', (req, res) => res.sendFile(__dirname + '/public/admin.html'));
app.get('/panel', (req, res) => res.sendFile(__dirname + '/public/panel.html'));
app.get('/users', (req, res) => {
    res.sendFile(__dirname + '/public/users.html');
});
app.get('/edit-user', (req, res) => {
    res.sendFile(__dirname + '/public/edit-user.html');
});

// API Routes
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const admins = JSON.parse(fs.readFileSync(adminDbPath, 'utf8'));
    if (admins[username] && password === admins[username]) {
      return res.json({ status: true, message: 'Login Admin Berhasil', isAdmin: true, role: 'admin_website' });
    }
    const users = JSON.parse(fs.readFileSync(userDbPath, 'utf8'));
    for (const r of ROLE_ORDER) {
      if (users[r]?.[username] && password === users[r][username].password) {
        return res.json({ status: true, message: 'Login Berhasil', isAdmin: false, role: r, isReseller: r === 'reseller' });
      }
    }
    res.json({ status: false, message: 'Username atau password salah!' });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ status: false, message: 'Terjadi kesalahan server.' });
  }
});

app.post('/cpanel', async (req, res) => {
  const { nama, ram, sandi, isAdmin, creatorRole, telegramId } = req.body;
  
  const allowedAdminRoles = ['tangan_kanan', 'owner', 'partner', 'admin_website'];
  if (isAdmin && !allowedAdminRoles.includes(creatorRole)) {
    return res.status(403).json({ status: false, message: 'Anda tidak diizinkan membuat akun administrator.' });
  }

  const packages = {
    "1gb": { memory: "1024", disk: "1024", cpu: "40" },
    "2gb": { memory: "2048", disk: "2048", cpu: "60" },
    "3gb": { memory: "3072", disk: "3072", cpu: "80" },
    "4gb": { memory: "4096", disk: "4096", cpu: "100" },
    "5gb": { memory: "5120", disk: "5120", cpu: "120" },
    "6gb": { memory: "6144", disk: "6144", cpu: "140" },
    "7gb": { memory: "7168", disk: "7168", cpu: "160" },
    "8gb": { memory: "8192", disk: "8192", cpu: "180" },
    "9gb": { memory: "9216", disk: "9216", cpu: "200" },
    "unli": { memory: "0", disk: "0", cpu: "0" }
  };
  
  const username = nama;
  const email = username + "@ASTA.PANEL";
  
  try {
    const userPayload = {
      email: email,
      username: username,
      first_name: username,
      last_name: telegramId,
      password: sandi,
      root_admin: isAdmin || false
    };

    const userResponse = await fetch(`${global.url}/api/application/users`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${global.ptla}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(userPayload)
    });
    const userData = await userResponse.json();
    if (userData.errors) return res.status(400).json({ status: false, message: userData.errors[0].detail });
    
    const userId = userData.attributes.id; //

    const eggResponse = await fetch(`${global.url}/api/application/nests/${global.nest}/eggs/${global.egg}`, {
        headers: { 'Authorization': `Bearer ${global.ptla}`, 'Accept': 'application/json' }
    });
    const eggData = await eggResponse.json();
    
    const serverPayload = {
      name: username,
      user: userId,
      egg: parseInt(global.egg),
      docker_image: "ghcr.io/parkervcp/yolks:nodejs_21",
      startup: eggData.attributes.startup,
      environment: { "INST": "npm", "USER_UPLOAD": "0", "AUTO_UPDATE": "0", "CMD_RUN": "npm start" },
      limits: { ...packages[ram], swap: 0, io: 500 },
      feature_limits: { databases: 5, backups: 5, allocations: 5 },
      deploy: { locations: [parseInt(global.loc)], dedicated_ip: false, port_range: [] }
    };

    const serverResponse = await fetch(`${global.url}/api/application/servers`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${global.ptla}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(serverPayload)
    });
    const serverData = await serverResponse.json();

    if (serverData.errors) {
      await fetch(`${global.url}/api/application/users/${userId}`, { 
        method: 'DELETE', 
        headers: { 'Authorization': `Bearer ${global.ptla}` } 
      });
      return res.status(400).json({ status: false, message: `Gagal membuat server: ${serverData.errors[0].detail}` });
    }
    
    const targetUser = isNaN(parseInt(telegramId)) ? telegramId.replace('@','') : `[${telegramId}](tg://user?id=${telegramId})`;

    //
    const messageText = `
Hai ${targetUser},
Berikut data akun panel anda:

🆔 **ID:** \`${userId}\`
👤 **USERNAME:** \`${username}\`
🔐 **PASSWORD:** \`${sandi}\`

🌐 **Domain:** \`${global.url}\`

📜 **Syarat Dan Ketentuan !!**
- Jaga data panel anda!!
- Jangan memakai script ddos
- Jangan sebar link panel
- Masa berlaku panel ini adalah 1 bulan

Gunakan panel anda dengan bijak.
    `;
    
    const photoUrl = 'https://files.catbox.moe/bzkzuc.jpg';

    await sendUserbotMessage(telegramId, messageText, photoUrl);
    res.json({ status: true, message: `Akun berhasil dibuat dan detail telah dikirim ke ${telegramId}!` });

  } catch (error) {
    console.error("Kesalahan CPanel:", error);
    res.status(500).json({ status: false, message: 'Terjadi kesalahan internal server.' });
  }
});

//
async function sendUserbotMessage(target, message, photoUrl = null) {
  try {
    if (!client.connected) {
      await client.connect();
    }
    
    const messageOptions = {
        message: message,
        parseMode: 'markdown'
    };

    if (photoUrl) {
        messageOptions.file = photoUrl;
    }

    const targetEntity = isNaN(parseInt(target)) ? target : parseInt(target);
    await client.sendMessage(targetEntity, messageOptions);
    console.log(`Pesan terkirim ke ${target}`);
  } catch (error) {
    console.error(`Gagal mengirim pesan ke ${target}:`, error.message);
  }
}

// Jalankan server
app.listen(port, '0.0.0.0', () => {
    const getIpAddress = () => {
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                // Skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
                if (iface.family === 'IPv4' && !iface.internal) {
                    return iface.address;
                }
            }
        }
        return '127.0.0.1'; // Fallback
    };
    const ip = getIpAddress();
    console.log(`Asta CPanel berjalan di http://${ip}:${port}`);
});

//
app.get('/api/users', (req, res) => {
    try {
        const usersData = fs.readFileSync(userDbPath, 'utf8');
        res.json({ status: true, usersByRole: JSON.parse(usersData) });
    } catch (error) {
        res.status(500).json({ status: false, message: 'Gagal memuat pengguna.' });
    }
});

app.post('/api/adduser', async (req, res) => {
    const { username, password, role, creatorRole, telegramId } = req.body;
    if (!username || !password || !role || !telegramId) {
        return res.status(400).json({ status: false, message: 'Data tidak lengkap. Username, password, role, dan ID Telegram wajib diisi.' });
    }
    if (creatorRole !== 'admin_website') {
      const idxCreator = ROLE_ORDER.indexOf(creatorRole);
      const idxTarget = ROLE_ORDER.indexOf(role);
      if (idxCreator === -1 || idxTarget === -1 || idxTarget <= idxCreator) {
          return res.status(403).json({ status: false, message: `Peran Anda tidak diizinkan membuat peran ${role}.` });
      }
    }
    try {
        const users = JSON.parse(fs.readFileSync(userDbPath, 'utf8'));
        for (const r of ROLE_ORDER) {
            if (users[r]?.[username]) {
                return res.status(409).json({ status: false, message: 'Username sudah ada.' });
            }
        }
        if (!users[role]) users[role] = {};
        
        users[role][username] = {
            password: password,
            createdAt: new Date().toISOString()
        };

        fs.writeFileSync(userDbPath, JSON.stringify(users, null, 2));
        
        // Kirim notifikasi setelah berhasil menyimpan
        const messageText = `
✅ **Akun Baru Telah Dibuat**
Sebuah akun baru telah berhasil dibuat oleh Admin Website.

Berikut adalah detailnya:
- **Username:** \`${username}\`
- **Password:** \`${password}\`
- **Role:** \`${role.replace(/_/g, ' ')}\`

Silakan login dan gunakan dengan bijak.
        `;
        await sendUserbotMessage(telegramId, messageText);

        res.json({ status: true, message: `Pengguna ${username} berhasil ditambahkan.` });
    } catch (error) {
        console.error("Add User Error:", error);
        res.status(500).json({ status: false, message: 'Terjadi kesalahan server.' });
    }
});

app.post('/api/edituser', async (req, res) => {
    const { username, role, newRole, newPassword, telegramId } = req.body;
    if (!username || !role || !newRole) {
        return res.status(400).json({ status: false, message: 'Data tidak lengkap.' });
    }

    try {
        const users = JSON.parse(fs.readFileSync(userDbPath, 'utf8'));

        if (!users[role]?.[username]) {
            return res.status(404).json({ status: false, message: 'Pengguna tidak ditemukan di peran aslinya.' });
        }

        const userData = { ...users[role][username] }; // Salin data pengguna

        // 1. Perbarui password jika ada yang baru
        if (newPassword && newPassword.trim() !== '') {
            userData.password = newPassword;
        }

        // 2. Pindahkan atau perbarui data pengguna
        if (role !== newRole) {
            delete users[role][username]; // Hapus dari role lama
            if (!users[newRole]) users[newRole] = {}; // Buat objek role baru jika belum ada
            users[newRole][username] = userData; // Tambahkan ke role baru
        } else {
            users[role][username] = userData; // Perbarui di role yang sama
        }

        fs.writeFileSync(userDbPath, JSON.stringify(users, null, 2));

        // 3. Kirim notifikasi jika ID Telegram diisi
        if (telegramId && telegramId.trim() !== '') {
            let changes = [];
            if (role !== newRole) {
                changes.push(`- **Role Diubah:** dari \`${role.replace(/_/g, ' ')}\` menjadi \`${newRole.replace(/_/g, ' ')}\``);
            }
            if (newPassword && newPassword.trim() !== '') {
                // Gunakan password baru jika ada, jika tidak, gunakan yang lama
                changes.push(`- **Password Baru:** \`${newPassword}\``);
            }

            if (changes.length > 0) {
                 const messageText = `
⚙️ **Akun Telah Diperbarui**
Detail untuk akun **${username}** telah diubah oleh Admin Website.

Perubahan:
${changes.join('\n')}

Harap periksa kembali detail akun Anda.
                `;
                await sendUserbotMessage(telegramId, messageText);
            }
        }

        res.json({ status: true, message: `Pengguna ${username} berhasil diperbarui.` });

    } catch (error) {
        console.error("Edit User Error:", error);
        res.status(500).json({ status: false, message: 'Terjadi kesalahan server.' });
    }
});

app.post('/api/deleteuser', (req, res) => {
    const { username, role } = req.body;
    try {
        const users = JSON.parse(fs.readFileSync(userDbPath, 'utf8'));
        if (users[role]?.[username]) {
            delete users[role][username];
            fs.writeFileSync(userDbPath, JSON.stringify(users, null, 2));
            res.json({ status: true, message: `Pengguna ${username} berhasil dihapus.` });
        } else {
            res.status(404).json({ status: false, message: 'Pengguna tidak ditemukan.' });
        }
    } catch (error) {
        res.status(500).json({ status: false, message: 'Terjadi kesalahan server.' });
    }
});