"use strict";

const ICE_SERVERS_CONFIG = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
    {
      urls: "stun:stun1.l.google.com:19302",
    },
    {
      urls: "stun:stun2.l.google.com:19302",
    },
    {
      urls: "stun:stun3.l.google.com:19302",
    },
    {
      urls: "stun:stun4.l.google.com:19302",
    },
  ],
};

const OFFER = "offer";

const ANSWER = "answer";

const ICE_CANDIDATE = "icecandidate";

const NEW_PEER_ICE_CANDIDATE = "new_peer_icecandidate";

// websocket!
const IP = "192.168.219.191";
const PORT = 3000;
const socket = io(`https://${IP}:${PORT}/`, { autoConnect: false });

// https://stackoverflow.com/questions/37390574/webrtc-acoustic-echo-cancelation
const AUDIO_CONSTRAINTS = {
  // default to true (근데 별 차이를 모르겠음.)
  echoCancellation: false,
};

/*
  Video Constraints를 아무리 높게 줘도
  전송되는 해상도는 별개의 문제이다.

  시간을 들이면 결국 해당 해상도에 도달한다.
  (느린 시작이라니, 무슨 TCP처럼 동작하냐..)

  프레임 안 맞는건 30fps로 바꾸니까 좀 나아졌다.
*/
// ideal 인데도 스트림 반환을 안 하는 경우가 있다. Why?
const VIDEO_CONSTRAINTS = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 24 },
  facingMode: "user",
};

var startButton = document.getElementById("startButton");
var callButton = document.getElementById("callButton");
var hangupButton = document.getElementById("hangupButton");
callButton.disabled = true;
hangupButton.disabled = true;
startButton.onclick = start;
callButton.onclick = call;
hangupButton.onclick = hangup;

var startTime;
var localVideo = document.getElementById("localVideo");

localVideo.addEventListener("loadedmetadata", function () {
  trace(
    "Local video videoWidth: " +
      this.videoWidth +
      "px,  videoHeight: " +
      this.videoHeight +
      "px"
  );
});

const IS_CALLER = false;

let userMediaStream;
let clientPc;

function start() {
  trace("Requesting local stream");
  startButton.disabled = true;
  navigator.mediaDevices
    .getUserMedia({
      audio: AUDIO_CONSTRAINTS,
      video: VIDEO_CONSTRAINTS,
    })
    .then((stream) => {
      trace("Received local stream");
      localVideo.srcObject = stream;
      userMediaStream = stream;
      callButton.disabled = false;
    })
    //https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling
    .catch((e) => {
      switch (e.name) {
        case "NotFoundError":
          alert(
            "Unable to open your call because no camera and/or microphone" +
              "were found."
          );
          break;
        case "SecurityError":
        case "PermissionDeniedError":
          // Do nothing; this is the same as the user canceling the call.
          break;
        default:
          alert("Error opening your camera and/or microphone: " + e.message);
          break;
      }
      // close video call
      hangup();
    });
}

function call() {
  callButton.disabled = true;
  hangupButton.disabled = false;
  trace("Starting call");
  startTime = window.performance.now();
  const videoTracks = userMediaStream.getVideoTracks();
  const audioTracks = userMediaStream.getAudioTracks();
  if (videoTracks.length > 0) {
    trace("Using video device: " + videoTracks[0].label);
  }
  if (audioTracks.length > 0) {
    trace("Using audio device: " + audioTracks[0].label);
  }
  clientPc = new RTCPeerConnection(ICE_SERVERS_CONFIG);
  trace("Created local peer connection object client:");

  clientPc.onicecandidate = (event) => {
    socket.emit(NEW_PEER_ICE_CANDIDATE, event.candidate);
    // trace("ICE candidate:", event.candidate);
  };

  socket.on(NEW_PEER_ICE_CANDIDATE, (candidate) => {
    // trace("receiving new remote Ice Candidate: ");
    clientPc
      .addIceCandidate(candidate)
      .then(() => {
        // trace("client: new Remote Ice Candidate: ");
      })
      .catch((e) => {
        trace("Error adding new Remote Ice Candidate: ", e);
      });
  });

  clientPc.oniceconnectionstatechange = () => {
    clientPc.addEventListener("connectionstatechange", () => {
      switch (clientPc.connectionState) {
        case "connected":
          // The connection has become fully connected
          trace("[WebRTC] User is fully connected");
          break;
        case "disconnected":
        case "failed":
          // One or more transports has terminated unexpectedly or in an error
          trace("[WebRTC] User is unexpectedly disconnected");
          hangup();
          break;
        case "closed":
          // The connection has been closed
          trace("[WebRTC] Connection closed");
          hangup();
          break;
      }
    });
  };

  clientPc.addStream(userMediaStream);

  // 선호 코덱을 가장 위에 배치한 배열을 setCodecPreferences로 넘기는 것.
  const { codecs } = RTCRtpSender.getCapabilities("video");
  const [preferredCodec] = codecs.filter(
    ({ mimeType }) => mimeType == "video/H264"
  );
  const { mimeType, sdpFmtpLine } = preferredCodec;
  const selectedCodecIndex = codecs.findIndex(
    (c) => c.mimeType === mimeType && c.sdpFmtpLine === sdpFmtpLine
  );
  const selectedCodec = codecs[selectedCodecIndex];
  codecs.splice(selectedCodecIndex, 1);
  codecs.unshift(selectedCodec);
  console.log(codecs);
  const transceiver = clientPc
    .getTransceivers()
    .find(
      (t) => t.sender && t.sender.track === userMediaStream.getVideoTracks()[0]
    );
  transceiver.setCodecPreferences(codecs);
  trace("SET Preferred video codec", selectedCodec);

  // Start WebSocket Connect And do Offer/Answer
  socket.connect();
  if (IS_CALLER) {
    // Answer 미리 등록해놓고
    socket.on(ANSWER, (desc) => {
      trace("received answer");
      clientPc
        .setRemoteDescription(desc)
        .then(() => {
          trace("client: setRemoteDescription complete");
          trace("Connection Succeeeded!");
        })
        .catch((error) => {
          trace(
            "[Receive Answer] Failed to setRemoteDescription: " +
              error.toString()
          );
        });
    });

    clientPc
      .createOffer()
      .then((offerDesc) => {
        clientPc.setLocalDescription();
        trace("setLocalDescription");
        return offerDesc;
      })
      .then((offerDesc) => {
        trace("Offer from client");
        socket.emit(OFFER, offerDesc);
      })
      .catch((error) => {
        trace(
          "[Creating Offer] Failed to setLocalDescription: " + error.toString()
        );
      });
  } else {
    socket.on(OFFER, (offerDesc) => {
      trace("received offer");

      clientPc
        .setRemoteDescription(offerDesc)
        .then(() => {
          trace("client: setRemoteDescription complete");
          return clientPc.createAnswer();
        })
        .catch((error) => {
          trace("Failed to setRemoteDescription: " + error.toString());
        })
        .then((answerDesc) => {
          clientPc.setLocalDescription(answerDesc);
          return answerDesc;
        })
        .then((answerDesc) => {
          trace("client: setLocalDescription complete");
          trace("answer from client");
          socket.emit(ANSWER, answerDesc);
          trace("Connection Succeeeded!");
        })
        .catch((error) => {
          trace("Failed to setLocalDescription: " + error.toString());
        });
    });
  }
}

function hangup() {
  trace("Ending call");
  hangupButton.disabled = true;
  callButton.disabled = false;
  socket.close();
  clientPc.close();
  clientPc = null;
}

// logging utility
function trace(arg) {
  const now = (window.performance.now() / 1000).toFixed(3);
  console.log(now + ": ", arg);
}
