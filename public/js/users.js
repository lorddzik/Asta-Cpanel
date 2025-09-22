document.addEventListener('DOMContentLoaded', () => {
    // Pastikan hanya admin website yang bisa mengakses halaman ini
    if (sessionStorage.getItem('creatorRole') !== 'admin_website') {
        window.location.href = '/admin'; // Alihkan jika bukan admin website
        return; // Hentikan eksekusi skrip lebih lanjut
    }

    // --- LOGIKA TEMA ---
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    const themeToggleBtn = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');

    function applyThemeUI(theme) {
        const isDark = theme === 'dark';
        themeToggleBtn.setAttribute('aria-pressed', String(isDark));
        themeIcon.textContent = isDark ? '☀️' : '🌙';
        if (metaTheme) metaTheme.setAttribute('content', isDark ? '#0b1220' : '#e6f0ff');
    }

    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        try { localStorage.setItem('theme', theme); } catch (e) { }
        applyThemeUI(theme);
    }

    themeToggleBtn.addEventListener('click', function () {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(nextTheme);
    });

    // Terapkan tema saat halaman dimuat
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);


    // --- LOGIKA SIDEBAR ---
    const menuBtn = document.getElementById('menu-btn');
    const sidebar = document.getElementById('sidebar');
    const sidebarCloseBtn = document.getElementById('sidebar-close-btn');
    const overlay = document.getElementById('sidebar-overlay');
    const logoutBtn = document.getElementById('sidebar-logout-btn');

    function openSidebar() {
        sidebar.classList.add('open');
        overlay.classList.add('show');
    }

    function closeSidebar() {
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
    }

    menuBtn.addEventListener('click', openSidebar);
    sidebarCloseBtn.addEventListener('click', closeSidebar);
    overlay.addEventListener('click', closeSidebar);

    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        sessionStorage.removeItem('adminAuth');
        sessionStorage.removeItem('creatorRole');
        window.location.href = '/';
    });


    // --- LOGIKA DAFTAR PENGGUNA ---
    const userListTable = document.getElementById('user-list-table');

    async function loadUsersToTable() {
        try {
            const response = await fetch('/api/users');
            const data = await response.json();
            const userListTable = document.getElementById('user-list-table');
            userListTable.innerHTML = ''; // Kosongkan tabel sebelum diisi

            if (data.status && data.usersByRole) {
                Object.entries(data.usersByRole).forEach(([role, users]) => {
                    Object.entries(users).forEach(([username, userData]) => {
                        const tr = document.createElement('tr');

                        let creationTime = "N/A"; // Default jika tidak ada timestamp

                        // Cek apakah userData adalah objek dan punya properti createdAt
                        if (typeof userData === 'object' && userData.createdAt) {
                            // Format waktu ke Waktu Indonesia Barat (WIB)
                            creationTime = new Date(userData.createdAt).toLocaleString('id-ID', {
                                timeZone: 'Asia/Jakarta',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            });
                        }

                        tr.innerHTML = `
                        <td>${username}</td>
                        <td>${role.replace(/_/g, ' ')}</td>
                        <td>${creationTime}</td>
                        <td>
                            <button class="action-btn edit-btn" data-username="${username}" data-role="${role}">Edit</button>
                            <button class="action-btn delete-btn" data-username="${username}" data-role="${role}" ${username === 'admin' ? 'disabled' : ''}>Hapus</button>
                        </td>
                    `;
                        userListTable.appendChild(tr);
                    });
                });
            }
        } catch (error) {
            console.error('Gagal memuat pengguna:', error);
            showToast('Gagal memuat daftar pengguna.', 'error');
        }
    }

    userListTable.addEventListener('click', async (e) => {
        const target = e.target;
        if (target.classList.contains('delete-btn')) {
            const username = target.dataset.username;
            const role = target.dataset.role;
            if (confirm(`Apakah Anda yakin ingin menghapus pengguna "${username}"?`)) {
                try {
                    const response = await fetch('/api/deleteuser', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, role }),
                    });
                    const data = await response.json();
                    showToast(data.message, response.ok ? 'success' : 'error');
                    if (response.ok) {
                        loadUsersToTable(); // Muat ulang tabel
                    }
                } catch (err) {
                    showToast('Terjadi kesalahan jaringan.', 'error');
                }
            }
        } else if (target.classList.contains('edit-btn')) {
            const username = target.dataset.username;
            const role = target.dataset.role;
            window.location.href = `/edit-user?username=${encodeURIComponent(username)}&role=${encodeURIComponent(role)}`;
        }
    });

    // Fungsi showToast (diperlukan untuk notifikasi)
    function showToast(message, type = 'success') {
        const container = document.getElementById('notification-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove());
        }, 5000);
    }

    // Muat data pengguna saat halaman siap
    loadUsersToTable();

    // Tampilkan tahun di footer
    document.getElementById('y').textContent = new Date().getFullYear();
});