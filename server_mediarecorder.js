const fs = require("fs");
const { io } = require("./socketIoServer");

/*
TODO:
1. 최초 접속 시 room id를 부여한다. (guid를 쓰면 충분히 안 겹칠듯)

2. 서버는 애초에 WebRTC가 필요가 없다.

3. 서버는 WebSocket으로 record file만 전송한다.
=> 애초에 timeslice를 작게 주면 되겠네. (이러면 RTP보다 더 빠를듯. slice 때문에)

4. 파일 병합 문제
*/
let writer = fs.createWriteStream(
  `./files/recorded_${Number(Date.now() / 1000)}.mp4`
);

io.on("connection", (socket) => {
  console.log("a user connected");

  socket.emit("ready");

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });

  socket.on("stop", () => {
    // stop 하자마자 writer.end();를 해버리면 문제가 있음.
    // timeout 만큼 기다린 후 end 하는 게 낫다. (마지막 부분이 짤림.)
    writer.end();
    console.log("user stopped");
  });

  socket.on("start", () => {
    // writer = fs.createWriteStream(
    //   `./files/recorded_${Number(Date.now() / 1000)}.webm`
    // );
    socket.emit("ready");
    console.log("emitting ready event");
  });

  socket.on("upload", (data) => {
    console.log("writing: ", data);
    if (writer.writable) writer.write(data);
    else console.log("NOT WRITABLE!");
  });
});
