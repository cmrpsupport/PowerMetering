/**
 * Node-RED userDir settings.
 * @see https://nodered.org/docs/user-guide/runtime/settings-file
 */
const path = require('path')

module.exports = {
  /** Use a stable flows file in this repo (default is flows_<hostname>.json) */
  flowFile: 'flows.json',

  /** Editor + runtime HTTP port */
  uiPort: process.env.PORT ? Number(process.env.PORT) : 1880,

  /** Allow the Vite dev server (or any origin) to call HTTP In routes */
  httpNodeCors: {
    origin: '*',
    methods: 'GET,PUT,POST,DELETE,OPTIONS',
  },

  /** Expose selected env vars to Function nodes as env.get('PLC_IP') */
  functionGlobalContext: {
    env: process.env,
    /** Git-tracked alert archive (see enhanced_alerts_archive.json); Function nodes use global.get('alertsArchivePath') */
    alertsArchivePath: path.join(__dirname, 'enhanced_alerts_archive.json'),
    /** Used by alert hydrate / archive write Function nodes (avoids sandbox require restrictions) */
    fs: require('fs'),
  },

  /** Reduce log noise in production */
  logging: {
    console: {
      level: process.env.NODE_RED_LOG_LEVEL || 'info',
      metrics: false,
      audit: false,
    },
  },
}
