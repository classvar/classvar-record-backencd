"use strict";

const { ICE_SERVERS_CONFIG, ICE_CANDIDATE } = require("./pc_constants");

// websocket!
const IP = "192.168.219.191";
const PORT = 3000;
const socket = io(`https://${IP}:${PORT}/`);

const VIDEO_CONSTRAINTS = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { min: 24 },
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

let userMediaStream;
let clientPc;

function start() {
  trace("Requesting local stream");
  startButton.disabled = true;
  navigator.mediaDevices
    .getUserMedia(VIDEO_CONSTRAINTS)
    .then((stream) => {
      trace("Received local stream");
      localVideo.srcObject = stream;
      userMediaStream = stream;
      callButton.disabled = false;
    })
    //https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling
    .catch(function handleGetUserMediaError(e) {
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
    socket.emit(ICE_CANDIDATE, event.candidate);
    trace(
      "client: ICE candidate: \n" +
        (event.candidate ? event.candidate.candidate : "(null)")
    );
  };

  clientPc.oniceconnectionstatechange = (event) => {
    trace("client: ICE state: " + pc.iceConnectionState);
    console.log("ICE state change event: ", event);
  };

  clientPc.addStream(userMediaStream);

  trace("client: createOffer start");
  clientPc.createOffer().then((desc) => {
    trace("Offer from client:\n" + desc.sdp);
    trace("client: setLocalDescription");
    clientPc
      .setLocalDescription(desc)
      .then(() => {
        trace("client: setLocalDescription complete");
      })
      .catch((error) => {
        trace("Failed to setLocalDescription: " + error.toString());
      });
  });
}

function hangup() {
  trace("Ending call");
  clientPc.close();
  clientPc = null;
  hangupButton.disabled = true;
  callButton.disabled = false;
}

// logging utility
function trace(arg) {
  const now = (window.performance.now() / 1000).toFixed(3);
  console.log(now + ": ", arg);
}
