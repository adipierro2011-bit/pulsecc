import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import fs from 'fs';
import crypto from 'crypto';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const KEYAUTH_CONFIG = {
  name: process.env.KEYAUTH_NAME || 'Fortnite-Internal',
  ownerid: process.env.KEYAUTH_OWNERID || 'CCOTTw1UCg',
  secret: process.env.KEYAUTH_SECRET || '3e2699000c43cdddd6a90abcd8f378d326939b98908c6338fb24a149e5a635a7',
  version: '1.0'
};

const ADMIN_CREDS = {
  userHash: crypto.createHash('sha256').update('PulseAdmin_99X').digest('hex'),
  passHash: crypto.createHash('sha256').update('@PulseRoot_SecretKey983712!').digest('hex')
};

let keyauthSession = {
  sessionId: null,
  created: 0
};

const LOGS_FILE = path.join(__dirname, 'build_logs.json');
let buildLogs = [];
if (fs.existsSync(LOGS_FILE)) {
  try {
    buildLogs = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8'));
  } catch (e) {
    buildLogs = [];
  }
}
let adminSessions = new Set();

async function initKeyAuthSession() {
  const now = Date.now();
  if (keyauthSession.sessionId && (now - keyauthSession.created < 30 * 60 * 1000)) {
    return keyauthSession.sessionId;
  }

  const initUrl = `https://keyauth.win/api/1.2/?type=init&name=${encodeURIComponent(KEYAUTH_CONFIG.name)}&ownerid=${encodeURIComponent(KEYAUTH_CONFIG.ownerid)}&ver=${encodeURIComponent(KEYAUTH_CONFIG.version)}`;

  try {
    const response = await fetch(initUrl);
    const data = await response.json();

    if (data.success && data.sessionid) {
      keyauthSession.sessionId = data.sessionid;
      keyauthSession.created = Date.now();
      return data.sessionid;
    } else {
      keyauthSession.sessionId = 'session_' + Math.random().toString(36).substring(2);
      keyauthSession.created = Date.now();
      return keyauthSession.sessionId;
    }
  } catch (err) {
    keyauthSession.sessionId = 'session_' + Math.random().toString(36).substring(2);
    keyauthSession.created = Date.now();
    return keyauthSession.sessionId;
  }
}

app.post('/api/authenticate', async (req, res) => {
  const { licenseKey } = req.body;

  if (!licenseKey || typeof licenseKey !== 'string' || licenseKey.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid license key.'
    });
  }

  const key = licenseKey.trim();
  const currentDate = new Date().toLocaleDateString('en-US');

  try {
    const sessionId = await initKeyAuthSession();
    const authUrl = `https://keyauth.win/api/1.2/?type=license&key=${encodeURIComponent(key)}&sessionid=${encodeURIComponent(sessionId)}&name=${encodeURIComponent(KEYAUTH_CONFIG.name)}&ownerid=${encodeURIComponent(KEYAUTH_CONFIG.ownerid)}`;

    const response = await fetch(authUrl);
    const data = await response.json();

    if (data.success) {
      const infoObj = data.info || {};
      infoObj.key = key;
      infoObj.lastlogin = currentDate;
      return res.json({
        success: true,
        message: data.message || 'License authenticated successfully!',
        info: infoObj
      });
    } else {
      return res.status(401).json({
        success: false,
        message: data.message || 'Invalid or expired license key.'
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to contact KeyAuth verification servers. Please try again.'
    });
  }
});

function stampBuildNative(inputFile, outputFile, buildId) {
  if (!fs.existsSync(inputFile)) {
    return false;
  }
  try {
    const data = fs.readFileSync(inputFile);
    const markerBuf = Buffer.from('MARKER_BUILD_ID_START:', 'utf-8');
    const bufferSize = 80;
    const replacementStr = 'MARKER_BUILD_ID_START:' + buildId;
    const replacementBuf = Buffer.alloc(bufferSize, 0);
    replacementBuf.write(replacementStr, 0, 'utf-8');

    let idx = data.indexOf(markerBuf);
    while (idx !== -1) {
      replacementBuf.copy(data, idx, 0, bufferSize);
      idx = data.indexOf(markerBuf, idx + bufferSize);
    }

    const padLen = Math.floor(16 + Math.random() * 49);
    const randomPadding = crypto.randomBytes(padLen);
    const finalBuffer = Buffer.concat([data, randomPadding]);

    fs.writeFileSync(outputFile, finalBuffer);
    return true;
  } catch (err) {
    return false;
  }
}

app.post('/api/build-download', async (req, res) => {
  const { licenseKey } = req.body;
  const key = (licenseKey || 'UNKNOWN_KEY').trim();
  
  const randNum = Math.floor(1000000 + Math.random() * 9000000);
  const buildId = `BLD-${randNum}`;
  const outputFile = `Pulse-Internal-${buildId}.exe`;
  const outputFilePath = path.join(__dirname, outputFile);

  const inputPath = path.join(__dirname, 'injector.exe');
  const success = stampBuildNative(inputPath, outputFilePath, buildId);
  const targetPath = (success && fs.existsSync(outputFilePath)) ? outputFilePath : inputPath;

  const logEntry = {
    licenseKey: key,
    buildId: buildId,
    timestamp: new Date().toLocaleDateString('en-US') + ' ' + new Date().toLocaleTimeString('en-US'),
    fileSize: fs.existsSync(targetPath) ? fs.statSync(targetPath).size : 0
  };
  buildLogs.unshift(logEntry);
  try {
    fs.writeFileSync(LOGS_FILE, JSON.stringify(buildLogs, null, 2));
  } catch (e) {}

  res.download(targetPath, `Pulse_Fortnite_Internal_${buildId}.exe`, (err) => {
    if (targetPath !== inputPath && fs.existsSync(outputFilePath)) {
      setTimeout(() => fs.unlink(outputFilePath, () => {}), 5000);
    }
  });
});

const OBFUSCATED_PATH_HASH = '129f0d54850348c48c5c5c5d3e5b34ddbd84d671006eb67fea7e6161a12e60d8';

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;

  const uHash = crypto.createHash('sha256').update(username || '').digest('hex');
  const pHash = crypto.createHash('sha256').update(password || '').digest('hex');

  if (uHash === ADMIN_CREDS.userHash && pHash === ADMIN_CREDS.passHash) {
    const token = crypto.randomBytes(32).toString('hex');
    adminSessions.add(token);
    return res.json({ success: true, token });
  } else {
    return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
  }
});

app.post('/api/admin/verify-route', (req, res) => {
  const { pathQuery } = req.body;
  const hash = crypto.createHash('sha256').update(pathQuery || '').digest('hex');
  if (hash === OBFUSCATED_PATH_HASH) {
    return res.json({ valid: true });
  }
  return res.status(404).json({ valid: false });
});

app.get('/api/admin/builds', (req, res) => {
  const token = req.headers['x-admin-token'];
  if (!token || !adminSessions.has(token)) {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }

  res.json({
    success: true,
    logs: buildLogs
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    appName: KEYAUTH_CONFIG.name,
    version: KEYAUTH_CONFIG.version,
    serverTime: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  Pulse Software - KeyAuth Dashboard Server Running  `);
  console.log(`  Local URL: http://localhost:${PORT}                `);
  console.log(`====================================================`);
});
