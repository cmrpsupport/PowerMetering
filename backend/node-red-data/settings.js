/**
 * Node-RED userDir settings.
 * @see https://nodered.org/docs/user-guide/runtime/settings-file
 */
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
