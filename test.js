const { spawn } = require("child_process");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const VIDEO_OUTPUT_FILE = "./recording.mp4";

const cmd = `${ffmpegPath}`;
const args = [
  "-f",
  "concat",
  "-safe",
  "0",
  "-y",
  "-i",
  "video_list.txt",
  "-c",
  "copy",
  `${VIDEO_OUTPUT_FILE}`,
];
const mergeProcess = spawn(cmd, args);
mergeProcess.stdout.on("data", (data) => {
  console.log(`stdout: ${data}`);
});
mergeProcess.stderr.on("data", (data) => {
  console.log(`stderr: ${data}`);
});
mergeProcess.on("error", (error) => {
  console.log(`error: ${error}`);
});
mergeProcess.on("close", (code) => {
  console.log(`child process exited with code ${code}`);
});
