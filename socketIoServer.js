const express = require("express");
const app = express();
const fs = require("fs");
const https = require("https");

const httpsOptions = {
  key: fs.readFileSync("./security/cert.key"),
  cert: fs.readFileSync("./security/cert.pem"),
};

const secureServer = https.createServer(httpsOptions, app);
const { Server } = require("socket.io");
const io = new Server(secureServer);

app.use(express.static(process.env.__public_path__));

// 192.168.219.191 로 오픈할 수가 없다.
secureServer.listen(3000, "0.0.0.0", () => {
  console.log("listening on *:3000");
});

console.log("running - socketIoServer.js");

module.exports = { io };
