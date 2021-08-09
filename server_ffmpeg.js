"use strict";

const { spawn } = require("child_process");
const { PassThrough } = require("stream");
const fs = require("fs");

const { RTCAudioSink, RTCVideoSink } = require("wrtc").nonstandard;

const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffmpeg = require("fluent-ffmpeg");
ffmpeg.setFfmpegPath(ffmpegPath);
const { StreamInput } = require("fluent-ffmpeg-multistream");

const VIDEO_OUTPUT_SIZE = "1280x720";
const VIDEO_OUTPUT_FILE = "./recording.mp4";

// UID 메커니즘은 조금 바꿔야 할 것 같다.
// UID는 파일명 구분에 사용된다.
let UID = 0;

function beforeOffer(peerConnection) {
  const audioTransceiver = peerConnection.addTransceiver("audio");
  const videoTransceiver = peerConnection.addTransceiver("video");

  // RTCVideoSink 계열 API는 node-webrtc의 비표준 API이다.
  const audioSink = new RTCAudioSink(audioTransceiver.receiver.track);
  const videoSink = new RTCVideoSink(videoTransceiver.receiver.track);

  // 아래의 stream 객체를 저장한 배열이다.
  const streams = [];

  // 1. frame 마다 이벤트가 발생한다. (무슨 I420프레임인가..이쪽 계열 지식은 참 어렵다.)
  // 2. PassThrough는 Transform의 일종으로 input => output 해주는 스트림이다.
  videoSink.addEventListener("frame", ({ frame: { width, height, data } }) => {
    const size = width + "x" + height;

    // 이 조건은 해상도 변경을 의미한다.
    // 굳이 이렇게 안 하고 쭉 받아버리면 안 되나?
    // 안 된다 ㅋㅋㅠ... 아니 어차피 cat으로 병합하는데 이게 안 되다니;
    if (!streams[0] || (streams[0] && streams[0].size !== size)) {
      UID++;

      // 임의로 생성한 객체.
      const stream = {
        // 출력할 파일의 이름이다.
        recordPath: "./recording-" + size + "-" + UID + ".mp4",
        size,
        // 즉 얘내는 파일이 아니라 Stream임.
        video: new PassThrough(),
        audio: new PassThrough(),
      };

      const onAudioData = ({ samples: { buffer } }) => {
        if (!stream.end) {
          stream.audio.push(Buffer.from(buffer));
        }
      };

      audioSink.addEventListener("data", onAudioData);

      stream.audio.on("end", () => {
        audioSink.removeEventListener("data", onAudioData);
      });

      // unshift로 하니까, 영상이 조각 났을 때 순서가 거꾸로 간다. 이상하다.
      // 그래서 push로 하니 stream EOF가 떴다.
      // 다시 unshift로 하니 해결됐다. 대체 무슨 원리지..? 단순히 코드 때문인 것 같긴 한데... 아? 일단은 모르겠다.
      streams.unshift(stream);

      streams.forEach((item) => {
        if (item !== stream && !item.end) {
          item.end = true;
          if (item.audio) {
            item.audio.end();
          }
          item.video.end();
        }
      });

      // StreamInput은 뭐하는 앤지 모르겠다.
      // 무슨 UnixSocket인가?를 만들고 있었다.
      // 반환값: unix:./{integer}.sock
      // (ex)
      // 해상도가 바뀔 때마다 새 url도 생성된다. (신기하다 ㅇㅅㅇ)
      // unix:./1.sock
      // ...
      // unix:./4.sock
      // unix:./5.sock
      // 흠;; 이 소켓은 실제로 ./ 경로에 생성이 되는데? 문제가 있다;
      const unixSocketVideoUrl = new StreamInput(stream.video).url;
      const unixSocketAudioUrl = new StreamInput(stream.audio).url;
      console.log(
        "unixSocketUrl: [Audio] ",
        unixSocketVideoUrl,
        unixSocketAudioUrl
      );

      // fmpeg() 은 ffmpeg을 실행하는 함수다.
      // 그냥 실행만 하는 것이다.
      // 일종의 builder처럼 input, inputOptions, output, outputOptions를 명시할 수 있다.
      // 비디오, 오디오를 따로 받는다. WebRTC에서 따로 오기 때문인 듯하다.
      stream.proc = ffmpeg()
        // 비디오 입력 옵션 시작
        // -i url
        // input file url
        // ffmpeg은 하나의 입력을 받는다. 입력은 파일, 이름 패턴(이미지의 경우), 입력 스트림이 가능하다.
        .addInput(unixSocketVideoUrl)
        .addInputOptions([
          // http://underpop.online.fr/f/ffmpeg/help/rawvideo-1.htm.gz
          // -f 옵션은 파일 포멧을 의미함.
          // rawVideo 포멧인 경우 아래 3개의 옵션이 필수로 제공돼야 함.
          // ffmpeg에서의 rawVideo란 비디오 파라미터가 헤더에 없는 것을 말함.

          // https://www.trainingconnection.com/premiere-pro/lessons/video-file-formats.php
          // 보통 rawVideo라 하면 인코딩을 거치지 않은 파일 포멧을 말함. (소니 카메라 계열 등)
          // rawVideo라 하더라도 기존 영상 압축 코덱을 사용해서 압축됐을 수도 있음 (아이폰 계열 등)
          "-f",
          "rawvideo",

          // 픽셀 관련 설정임. yuv420p가 대중적. (기본값이라 빼도 됨.)
          // 기본 값이어서 빼도 되는 줄 알았더니, unspecified pixel format이라며 실패하는 case를 만남.
          "-pix_fmt",
          "yuv420p",

          // -s SIZE
          // WidthxHeight 형식.
          // 이 크기로 비디오가 인코딩됨.
          "-s",
          stream.size,

          // -r frames
          // frame rate임.
          // 프레임이 오를수록 싱크가 맞춰짐.
          "-r",
          "24",
        ])
        // 오디오 입력 옵션 시작
        .addInput(unixSocketAudioUrl)
        // -async 1 이 deprecated긴 하지만 넣으니까 싱크가 맞춰졌다.
        // https://trac.ffmpeg.org/wiki/audio%20types
        // s16le는 위 링크에 명시돼있는 타입 중 하나인데, 꽤 low-level 기술로 별 의미가 없는 듯하다.
        // -ar은 audio bitrate
        // ac는 명확한 정의를 못 찾았는데, 아마 mono, stereo 같이 스피커 개수인듯하다.
        .addInputOptions(["-async 1", "-f s16le", "-ar 48k", "-ac 1"])
        // 출력 옵션 시작
        // .addOutputOptions(["-c:v libvpx", "-b:v 2M", "-c:a libvorbis"])
        .addOutputOptions(["-b:v 2M", "-movflags empty_moov"]) // 2Mbps의 bitrate로 저장하기
        // https://www.ffmpeg.org/ffmpeg-codecs.html#libx264_002c-libx264rgb
        // .videoCodec("libvpx")
        // .videoCodec("libx264") // 위 링크에 따르면 H264 코덱은 추가 라이브러리가 필요하다는데 잘 된다..굿..
        // Fluent-ffmpeg checks for codec availability before actually running the command,
        // and throws an error when a specified video codec is not available.
        .on("start", () => {
          console.log("Start recording >> ", stream.recordPath);
        })
        .on("end", () => {
          stream.recordEnd = true;
          console.log("Stop recording >> ", stream.recordPath);
        })
        .on("error", (err, stdout, stderr) => {
          console.log("Cannot record video: " + err.message);
          console.log(err, stdout, stderr);
        })
        .size(VIDEO_OUTPUT_SIZE)
        .output(stream.recordPath);

      // ffmpeg을 childprocess로 실행하는 것이다.
      stream.proc.run();
    }

    // PassThrough 스트림에 push를 수행한다. (그냥 append이다.)
    // 스트림이니까 이런 저런 기능이 있을텐데 나중에 리뷰하자..

    // stream.push after EOF 뭔데?
    streams[0].video.push(Buffer.from(data));
  });

  const { close } = peerConnection;
  peerConnection.close = function () {
    audioSink.stop();
    videoSink.stop();

    streams.forEach(({ audio, video, end }) => {
      if (!end) {
        if (audio) {
          audio.end();
        }
        video.end();
      }
    });

    /*
      문제 생기면,
      https://github.com/node-webrtc/node-webrtc-examples/blob/master/examples/record-audio-video-stream/server.js
      참고해서 롤백 ㄱ
    */
    // reverse 안 해 놓으면 거꾸로가 맞다.
    streams.reverse();

    console.log("Merge Target: ");
    streams.forEach(({ recordPath }) => {
      console.log(recordPath);
    });

    const videoPaths = [];

    const mergeProc = ffmpeg()
      .on("start", () => {
        console.log("Start merging into " + VIDEO_OUTPUT_FILE);
      })
      .on("end", () => {
        streams.forEach(({ recordPath }) => {
          // 파일을 삭제하는 함수이다.
          // fsPromises
          //   .unlink(recordPath)
          //   .catch((e) => console.log("error with unlink", e));
        });
        console.log("Merge end. You can play " + VIDEO_OUTPUT_FILE);
      })
      .on("error", (err, stdout, stderr) => {
        console.log("Cannot merge video: " + err.message);
        console.log(err, stdout, stderr);
      });

    streams.forEach(({ recordPath }) => {
      // mergeProc.addInput(recordPath);
      videoPaths.push(recordPath);
    });

    try {
      // mergeProc.mergeToFile(VIDEO_OUTPUT_FILE, "./tmp");
    } catch (e) {
      console.log("error while merging: ", e);
    }

    // video_list 파일 작성
    const writer = fs.createWriteStream("video_list.txt");
    videoPaths.forEach((path) => writer.write(`file '${path}'\n`));
    writer.on("finish", () => {
      console.log("writer done");

      // 그냥 concat ( ffmpeg -f concat -i video_list.txt -c copy OUTPUT )은 매우 빠름
      // fluent-ffmpeg으로 위의 속도를 구현할 수는 없는듯.. 흠...
      const cmd = `${ffmpegPath}`;
      // 이거 찾는데 진짜 오래걸렸다 ㅋㅋ
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
      // exec, spawn 둘 다 subprocess로 실행되는 거 같긴 한데 잘 모르겠다.
      // 굳이 spawn을 쓰는 이유:
      // https://stackoverflow.com/questions/42012342/running-ffmpeg-via-nodejs-error
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
    });
    writer.on("error", (e) => console.log("writer err:", e));
    writer.end();

    return close.apply(this, arguments);
  };
}

module.exports = { beforeOffer };
