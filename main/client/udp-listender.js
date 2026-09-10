// udp-listener.js
const dgram = require('dgram');
const EventEmitter = require('events');

class DcsBiosListener extends EventEmitter {
  constructor({ port = 5010, host = '0.0.0.0' }) {
    super();
    this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    this.socket.on('message', (msg) => {
      // TODO: parse DCS-BIOS binary export protocol into key/value pairs
      const parsed = this.parseExport(msg);
      this.emit('data', parsed);
    });

    this.socket.on('error', (err) => {
      console.error('UDP error:', err);
    });

    this.socket.bind(port, host, () => {
      console.log(`Listening for DCS-BIOS on ${host}:${port}`);
      // If using multicast from Windows:
      // this.socket.addMembership('239.255.50.10');
    });
  }

  parseExport(buffer) {
    // Placeholder: you’ll implement actual DCS-BIOS parsing here.
    // Return something like: { HUD_AIRSPEED: 275, GEAR_HANDLE: 1, ... }
    return {};
  }
}

module.exports = DcsBiosListener;
