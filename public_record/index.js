/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

// This code is adapted from
// https://rawgit.com/Miguelao/demos/master/mediarecorder.html

"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const displayZone = document.getElementById("display_zone");
  for (let i = 0; i < 20; i++)
    // 240p는 매우 빠르다.
    // 720p는 꽤 느리다.
    displayZone.innerHTML =
      displayZone.innerHTML +
      `<video playsinline autoplay muted>
      <source src="500_1000kbps.webm" type="video/webm" />
    </video>`;
});

const RECORDER_UPLOAD_TIME_SLICE = 100; // ms

const VIDEO_CONSTRAINTS_MOBILE = {
  width: { ideal: 720 },
  height: { ideal: 1280 },
  frameRate: { min: 24 },
  facingMode: "user",
};

const VIDEO_CONSTRAINTS = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { min: 24 },
  facingMode: "user",
};

// websocket!
const IP = "192.168.219.191";
const PORT = 3000;
const socket = io(`https://${IP}:${PORT}/`);

let recordReady = false;

socket.on("ready", () => {
  console.log("server is ready to record");
  recordReady = true;
});

/* globals MediaRecorder */
let mediaRecorder;
let recordedBlobs;

const codecPreferences = document.querySelector("#codecPreferences");

const errorMsgElement = document.querySelector("span#errorMsg");
const recordedVideo = document.querySelector("video#recorded");
const recordButton = document.querySelector("button#record");
recordButton.addEventListener("click", () => {
  if (recordButton.textContent === "Start Recording") {
    if (!recordReady) {
      socket.emit("start");
      console.log("emitting start event");
      socket.once("ready", startRecording);
    } else {
      startRecording();
    }
  } else {
    stopRecording();
    recordButton.textContent = "Start Recording";
    playButton.disabled = false;
    downloadButton.disabled = false;
    codecPreferences.disabled = false;
    socket.emit("stop");
    recordReady = false;
  }
});

const playButton = document.querySelector("button#play");
playButton.addEventListener("click", () => {
  const mimeType = codecPreferences.options[
    codecPreferences.selectedIndex
  ].value.split(";", 1)[0];
  const superBuffer = new Blob(recordedBlobs, { type: mimeType });
  recordedVideo.src = null;
  recordedVideo.srcObject = null;
  recordedVideo.src = window.URL.createObjectURL(superBuffer);
  recordedVideo.controls = true;
  recordedVideo.play();
});

const downloadButton = document.querySelector("button#download");
downloadButton.addEventListener("click", () => {
  const blob = new Blob(recordedBlobs, { type: "video/webm" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = `record-${Date.now()}.webm`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 100);
});

function handleDataAvailable(event) {
  console.log("handleDataAvailable", event);
  if (event.data && event.data.size > 0) {
    recordedBlobs.push(event.data);
    socket.emit("upload", event.data);
    console.log("data:", event.data);
  }
}

function getSupportedMimeTypes() {
  const possibleTypes = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=h264,opus",
    "video/mp4;codecs=h264,aac",
  ];
  return possibleTypes.filter((mimeType) => {
    return MediaRecorder.isTypeSupported(mimeType);
  });
}

function startRecording() {
  recordedBlobs = [];
  const mimeType =
    codecPreferences.options[codecPreferences.selectedIndex].value;

  const fiveMbps_720p = 5 * 1024 * 1024;
  const twoAndHalfMbps_480p = 2 * 1024 * 1024;
  const oneMbps_360p = 1 * 1024 * 1024; // kilo
  const halfMbps_240p = 600 * 1024; // kilo
  const options = { mimeType };

  try {
    mediaRecorder = new MediaRecorder(window.stream, options);
  } catch (e) {
    console.error("Exception while creating MediaRecorder:", e);
    errorMsgElement.innerHTML = `Exception while creating MediaRecorder: ${JSON.stringify(
      e
    )}`;
    return;
  }

  console.log("Created MediaRecorder", mediaRecorder, "with options", options);
  recordButton.textContent = "Stop Recording";
  playButton.disabled = true;
  downloadButton.disabled = true;
  codecPreferences.disabled = true;
  mediaRecorder.onstop = (event) => {
    console.log("Recorder stopped: ", event);
    console.log("Recorded Blobs: ", recordedBlobs);
  };
  mediaRecorder.ondataavailable = handleDataAvailable;
  mediaRecorder.start(RECORDER_UPLOAD_TIME_SLICE);
  console.log("MediaRecorder started", mediaRecorder);
}

function stopRecording() {
  mediaRecorder.stop();
}

function handleSuccess(stream) {
  recordButton.disabled = false;
  console.log("getUserMedia() got stream:", stream);
  window.stream = stream;

  const gumVideo = document.querySelector("video#gum");
  gumVideo.srcObject = stream;

  getSupportedMimeTypes().forEach((mimeType) => {
    const option = document.createElement("option");
    option.value = mimeType;
    option.innerText = option.value;
    codecPreferences.appendChild(option);
  });
  codecPreferences.disabled = false;
}

async function init(constraints) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    handleSuccess(stream);
  } catch (e) {
    console.error("navigator.getUserMedia error:", e);
    errorMsgElement.innerHTML = `navigator.getUserMedia error:${e.toString()}`;
  }
}

document.querySelector("button#start").addEventListener("click", async () => {
  document.querySelector("button#start").disabled = true;
  const hasEchoCancellation =
    document.querySelector("#echoCancellation").checked;
  const constraints = {
    audio: {
      echoCancellation: { exact: hasEchoCancellation },
    },
    video: VIDEO_CONSTRAINTS,
  };
  console.log("Using media constraints:", constraints);
  await init(constraints);
});
