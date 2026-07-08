// Vibe Server — shared entry point
// Starts both WS (port 3000) and TCP (port 4000) servers
// Single handler registry + connection manager

require('./lib/handler-registry').registerAll()
const cm = require('./lib/connection-manager')

// Kafka consumer for cross-instance push delivery + producer init
cm.startKafkaConsumer()

// Start HTTP auth server (port 2000)
require('./server-http')

// Start WS + TCP servers
require('./server-ws')
require('./server-tcp')
