const express = require("express");
const app = express();
const fs = require("fs");
// const http = require("http");
const https = require("https");
// const secureServer = http.createServer(app);

const httpsOptions = {
  key: fs.readFileSync("./security/cert.key"),
  cert: fs.readFileSync("./security/cert.pem"),
  // requestCert: false,
  // rejectUnauthorized: false,
};

const secureServer = https.createServer(httpsOptions, app);
const { Server } = require("socket.io");
const io = new Server(secureServer);

app.use(express.static("public"));

/*
TODO:
1. 최초 접속 시 room id를 부여한다. (guid를 쓰면 충분히 안 겹칠듯)

2. 서버는 애초에 WebRTC가 필요가 없다.

3. 서버는 WebSocket으로 record file만 전송한다.
=> 애초에 timeslice를 작게 주면 되겠네. (이러면 RTP보다 더 빠를듯. slice 때문에)

4. 파일 병합 문제

*/

io.on("connection", (socket) => {
  console.log("a user connected");

  let writer = fs.createWriteStream(
    `./files/recorded_${Number(Date.now() / 1000)}.mp4`
  );
  socket.emit("ready");

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });

  socket.on("stop", () => {
    writer.end(); // 굳이 할 필요는 없는듯.
    console.log("user stopped");
  });

  socket.on("start", () => {
    writer = fs.createWriteStream(
      `./files/recorded_${Number(Date.now() / 1000)}.mp4`
    );
    socket.emit("ready");
    console.log("emitting ready event");
  });

  socket.on("upload", (data) => {
    console.log("writing: ", data);
    writer.write(data);
  });
});

secureServer.listen(3000, "0.0.0.0", () => {
  console.log("listening on *:3000");
});
