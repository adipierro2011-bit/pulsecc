document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const licenseInput = document.getElementById('licenseKeyInput');
  const authSubmitBtn = document.getElementById('authSubmitBtn');
  const btnSpinner = document.getElementById('btnSpinner');
  const btnText = authSubmitBtn.querySelector('.btn-text');
  const authAlert = document.getElementById('authAlert');
  const alertMessage = document.getElementById('alertMessage');
  
  const loginView = document.getElementById('loginView');
  const dashboardView = document.getElementById('dashboardView');
  const adminView = document.getElementById('adminView');
  
  const displayUsername = document.getElementById('displayUsername');
  const infoKeyDisplay = document.getElementById('infoKeyDisplay');
  const infoSubscription = document.getElementById('infoSubscription');
  const infoExpiry = document.getElementById('infoExpiry');
  const infoHwid = document.getElementById('infoHwid');
  const infoLastLogin = document.getElementById('infoLastLogin');
  const downloadClientBtn = document.getElementById('downloadClientBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  const adminAuthBox = document.getElementById('adminAuthBox');
  const adminDashboardBox = document.getElementById('adminDashboardBox');
  const adminLoginForm = document.getElementById('adminLoginForm');
  const adminUserInput = document.getElementById('adminUserInput');
  const adminPassInput = document.getElementById('adminPassInput');
  const adminAuthAlert = document.getElementById('adminAuthAlert');
  const adminAlertMsg = document.getElementById('adminAlertMsg');
  const adminExitBtn = document.getElementById('adminExitBtn');
  const refreshBuildsBtn = document.getElementById('refreshBuildsBtn');
  const buildLogsTableBody = document.getElementById('buildLogsTableBody');

  let adminToken = localStorage.getItem('pulse_admin_token') || null;
  let activeLicenseKey = '';

  const savedSession = localStorage.getItem('pulse_session');
  if (savedSession) {
    try {
      const data = JSON.parse(savedSession);
      populateDashboard(data);
      switchView('dashboard');
    } catch (e) {
      localStorage.removeItem('pulse_session');
    }
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const key = licenseInput.value.trim();
    if (!key) {
      showError('Please enter a valid license key.');
      return;
    }

    setLoading(true);
    hideError();

    try {
      const res = await fetch('/api/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: key })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem('pulse_session', JSON.stringify(data));
        populateDashboard(data);
        switchView('dashboard');
      } else {
        showError(data.message || 'License verification failed.');
      }
    } catch (err) {
      showError('Network error connecting to verification server.');
    } finally {
      setLoading(false);
    }
  });

  downloadClientBtn.addEventListener('click', async () => {
    const downloadIcon = document.getElementById('downloadIcon');
    const downloadSpinner = document.getElementById('downloadSpinner');
    const downloadMainText = document.getElementById('downloadMainText');
    const downloadSubText = document.getElementById('downloadSubText');

    downloadIcon.classList.add('hidden');
    downloadSpinner.classList.remove('hidden');
    downloadMainText.textContent = 'STAMPING POLYMORPHIC BUILD...';
    downloadSubText.textContent = 'Compiling custom binary & generating Build ID...';
    downloadClientBtn.disabled = true;

    try {
      const res = await fetch('/api/build-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: activeLicenseKey || licenseInput.value || 'Pulse-License' })
      });

      if (!res.ok) throw new Error('Build error');

      const blob = await res.blob();
      const contentDisp = res.headers.get('Content-Disposition');
      let filename = 'Pulse_Fortnite_Internal_Setup.exe';
      if (contentDisp && contentDisp.includes('filename=')) {
        filename = contentDisp.split('filename=')[1].replace(/"/g, '');
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to generate build payload. Please try again.');
    } finally {
      downloadIcon.classList.remove('hidden');
      downloadSpinner.classList.add('hidden');
      downloadMainText.textContent = 'DOWNLOAD FORTNITE INTERNAL';
      downloadSubText.textContent = 'Instant Injector & Setup Package (.EXE)';
      downloadClientBtn.disabled = false;
    }
  });

  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('pulse_session');
    licenseInput.value = '';
    activeLicenseKey = '';
    switchView('login');
  });

  async function checkAdminRoute() {
    const rawParam = decodeURIComponent((window.location.hash || window.location.search || '').replace(/^[#?]/, ''));
    if (!rawParam) return;

    try {
      const res = await fetch('/api/admin/verify-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pathQuery: rawParam })
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        switchView('admin');
        if (adminToken) {
          loadAdminDashboard();
        }
      }
    } catch (err) {}
  }

  window.addEventListener('hashchange', checkAdminRoute);
  checkAdminRoute();

  adminExitBtn.addEventListener('click', () => {
    switchView(localStorage.getItem('pulse_session') ? 'dashboard' : 'login');
  });

  adminLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    adminAuthAlert.classList.add('hidden');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: adminUserInput.value.trim(),
          password: adminPassInput.value.trim()
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        adminToken = data.token;
        localStorage.setItem('pulse_admin_token', adminToken);
        loadAdminDashboard();
      } else {
        adminAlertMsg.textContent = data.message || 'Invalid credentials';
        adminAuthAlert.classList.remove('hidden');
      }
    } catch (err) {
      adminAlertMsg.textContent = 'Server connection error';
      adminAuthAlert.classList.remove('hidden');
    }
  });

  refreshBuildsBtn.addEventListener('click', () => {
    loadAdminDashboard();
  });

  async function loadAdminDashboard() {
    adminAuthBox.classList.add('hidden');
    adminDashboardBox.classList.remove('hidden');

    try {
      const res = await fetch('/api/admin/builds', {
        headers: { 'X-Admin-Token': adminToken }
      });
      const data = await res.json();

      if (res.ok && data.success) {
        renderBuildTable(data.logs || []);
      } else {
        adminToken = null;
        localStorage.removeItem('pulse_admin_token');
        adminAuthBox.classList.remove('hidden');
        adminDashboardBox.classList.add('hidden');
      }
    } catch (err) {
      console.error(err);
    }
  }

  function renderBuildTable(logs) {
    if (!logs.length) {
      buildLogsTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">No builds generated yet.</td></tr>`;
      return;
    }

    buildLogsTableBody.innerHTML = logs.map(log => `
      <tr>
        <td style="font-size:0.8rem; color:var(--text-muted);">${log.timestamp}</td>
        <td><span class="key-code">${log.licenseKey}</span></td>
        <td><span style="color:var(--color-success); font-weight:700; font-family:monospace;">${log.buildId}</span></td>
        <td style="font-size:0.8rem;">${(log.fileSize / 1024 / 1024).toFixed(2)} MB</td>
      </tr>
    `).join('');
  }

  function switchView(viewName) {
    loginView.classList.remove('active');
    dashboardView.classList.remove('active');
    adminView.classList.remove('active');

    if (viewName === 'dashboard') {
      dashboardView.classList.add('active');
    } else if (viewName === 'admin') {
      adminView.classList.add('active');
    } else {
      loginView.classList.add('active');
    }
  }

  function populateDashboard(data) {
    const info = data.info || {};
    activeLicenseKey = info.key || licenseInput.value || 'PULSE-KEY-OK';
    displayUsername.textContent = info.username || 'Authenticated User';
    infoKeyDisplay.textContent = activeLicenseKey;
    infoSubscription.textContent = info.subscription || 'Pulse Fortnite Internal';
    infoExpiry.textContent = info.expiry || 'Lifetime';
    infoHwid.textContent = info.hwid || 'Verified';
    infoLastLogin.textContent = new Date().toLocaleDateString('en-US');
  }

  function setLoading(isLoading) {
    if (isLoading) {
      authSubmitBtn.disabled = true;
      btnSpinner.classList.remove('hidden');
      btnText.textContent = 'VERIFYING...';
    } else {
      authSubmitBtn.disabled = false;
      btnSpinner.classList.add('hidden');
      btnText.textContent = 'AUTHENTICATE LICENSE';
    }
  }

  function showError(msg) {
    alertMessage.textContent = msg;
    authAlert.classList.remove('hidden');
  }

  function hideError() {
    authAlert.classList.add('hidden');
  }
});
