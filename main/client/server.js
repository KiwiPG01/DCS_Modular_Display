// server.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const DcsBiosListener = require('./udp-listener');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let currentAircraftId = 'FA18C';
let aircraftConfig = loadJson(`config/aircraft/${currentAircraftId}.json`);
let layoutConfig = loadJson(`config/layouts/${currentAircraftId}_default.json`);
let rulesConfig = loadJson(`config/rules/${currentAircraftId}_rules.json`);

let latestState = {}; // DCS-BIOS data mapped by controlId

function loadJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, relPath), 'utf8'));
}

// REST: get current config/layout
app.get('/api/config', (req, res) => {
  res.json({
    aircraft: aircraftConfig,
    layout: layoutConfig,
    rules: rulesConfig
  });
});

// REST: update layout (e.g., after drag/drop)
app.post('/api/layout', express.json(), (req, res) => {
  layoutConfig = req.body;
  fs.writeFileSync(
    path.join(__dirname, `config/layouts/${currentAircraftId}_default.json`),
    JSON.stringify(layoutConfig, null, 2)
  );
  res.json({ ok: true });
});

// WebSocket: push live data + rule effects
wss.on('connection', (ws) => {
  console.log('Client connected');
  ws.send(JSON.stringify({ type: 'init', config: { aircraftConfig, layoutConfig, rulesConfig } }));

  ws.on('close', () => console.log('Client disconnected'));
});

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

// Rule evaluation
function evaluateRules() {
  const effects = [];

  for (const rule of rulesConfig.rules) {
    let match = true;
    for (const cond of rule.conditions) {
      const block = aircraftConfig.blocks.find((b) => b.id === cond.blockId);
      if (!block) continue;

      const value = latestState[block.source.controlId];
      if (!compare(value, cond.operator, cond.value)) {
        match = false;
        break;
      }
    }

    if (match) {
      for (const action of rule.actions) {
        effects.push(action);
      }
    }
  }

  return effects;
}

function compare(a, op, b) {
  switch (op) {
    case '==': return a == b;
    case '!=': return a != b;
    case '>':  return a > b;
    case '<':  return a < b;
    case '>=': return a >= b;
    case '<=': return a <= b;
    default:   return false;
  }
}

// Hook UDP listener
const listener = new DcsBiosListener({ port: 5010 });

listener.on('data', (data) => {
  latestState = { ...latestState, ...data };
  const effects = evaluateRules();

  broadcast({
    type: 'update',
    state: latestState,
    effects
  });
});

const PORT = 8080;
server.listen(PORT, () => {
  console.log(`Web app running on http://localhost:${PORT}`);
});
