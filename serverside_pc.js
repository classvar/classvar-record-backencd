const { RTCPeerConnection } = require("wrtc");

let pcServer;

var localStream;
var pcClient;
var pc2;
var offerOptions = {
  offerToReceiveAudio: 1,
  offerToReceiveVideo: 1,
};

function getOtherPc(pc) {
  return pc === pcClient ? pc2 : pcClient;
}

function gotStream(stream) {
  trace("Received local stream");
  localVideo.srcObject = stream;
  localStream = stream;
  callButton.disabled = false;
}

function start() {
  trace("Requesting local stream");
  startButton.disabled = true;
  navigator.mediaDevices
    .getUserMedia({
      audio: true,
      video: true,
    })
    .then(gotStream)
    .catch(function (e) {
      alert("getUserMedia() error: " + e.name);
    });
}

function call() {
  callButton.disabled = true;
  hangupButton.disabled = false;
  trace("Starting call");
  startTime = window.performance.now();
  var videoTracks = localStream.getVideoTracks();
  var audioTracks = localStream.getAudioTracks();
  if (videoTracks.length > 0) {
    trace("Using video device: " + videoTracks[0].label);
  }
  if (audioTracks.length > 0) {
    trace("Using audio device: " + audioTracks[0].label);
  }

  pcClient = new RTCPeerConnection(null);
  trace("Created Client-side RTCPeerConnection");
  pcClient.onicecandidate = function (e) {
    handleIceCandidate(pcClient, e);
  };

  // 1. RTCPeerConnection을 생성한다.
  pcServer = new RTCPeerConnection(null);
  trace("Created Server-side RTCPeerConnection");

  // 2. onicecandidate 콜백을 통해 생성된 RTCPeerConnectionIceEvent를 얻는다.
  // 2-1. RTCPeerConnectionIceEvent에서 내 RTCIceCandidate를 얻는다.
  // 2-2. 내 candidate를 WebSocket을 통해 상대에게 전달한다.
  // 2-3. 상대가 pc.addIceCandidate(내 candidate); 를 수행한다.
  pcServer.onicecandidate = (RTCPeerConnectionIceEvent) => {
    trace("Server-side IceCandidate Generated");
    const candidate = { RTCPeerConnectionIceEvent };
    // TODO: candidate를 websocket으로 전송하기

    // 아래 코드가 수행돼야 한다.
    // pcClient.addIceCandidate(candidate);

    // 위 코드는 실패할 수 있다.
    // .then(function onSuccess() {}, function onFailure(error) {});
    // 성공 여부를 반환해야 한다.
    // 실패 시 retry 로직을 작성해야 할 것이다.
  };

  // 3. 녹화 서버이므로, 일방향으로 설정해야 한다. (즉, recvonly를 SDP에 반영해야 한다.)
  // WHAT
  // sdp 개요 https://brunch.co.kr/@linecard/141
  /*
    3) a= (미디어의 방향)
    RTP 프로토콜이 전달하는 미디어 속성뿐만 아니라 미디어 방향도 표시합니다.   

    a=sendrecv
    단말은 미디어 송신 및 수신 가능 
    예) 전화기로 통화가 가능한 채널

    a=recvonly
    단말은 미디어 수신만 가능 
    예) 전화기로 링백톤 수신만 가능한 채널

    a=sendonly
    단말은 미디어 송신만 가능
    예) 마이크 기능만 있는 단말로 송신만 가능한 채널 

    a=inactive
    단말은 송신 및 수신이 불가능  
    예) 전화기에서 Hold 버튼을 누른 상태 

    별도의 언급이 없을 때는 'a=sendrecv'로 가정합니다. 미디어의 방향은 전화 부가 서비스를 구현 시 유용합니다. 
    예를 들어, 묵음 버튼을 누르면 SDP 협상을 통해 'a=recvonly'로 설정하면 듣기만 가능합니다. 
  */

  // HOW
  // https://stackoverflow.com/questions/50002099/webrtc-one-way-video-call
  // https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpTransceiver
  // https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpTransceiver/direction => 여기에 recvonly, sendrecv, sendonly, inactive 등이 있다!
  // https://niccoloterreri.com/webrtc-with-transceivers

  pcServer.addTransceiver("video");
  pcServer.getTransceivers().forEach((t) => {
    t.direction = "recvonly";
  });
  // createOffer를 할 때 options을 주는 건 대부분의 option이 deprecated돼있다. (createOffer MDN 참조)
  pcServer.createOffer();

  // 4. 먼저 주는 쪽에서 createOffer를 수행한다.
  // Offer를 수행 시 RTCSessionDescription를 생성한다.
  // 근데 sdp가 왜 저따구일까..?
  /*
    RTCSessionDescription {
        sdp: "v=0\r\no=- 3270438221386651336 4 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=extmap-allow-mixed\r\na=msid-semantic: WMS\r\n"
        type: "offer"
    }
  */

  // 5. 받은 쪽에선 createAnswer를 수행한다.
  // Answer를 수행 시 setRemoteDescription(offer)를 수행하지 않으면 아래 오류가 발생한다.
  /* Failed to execute 'createAnswer' on 'RTCPeerConnection': 
     PeerConnection cannot create an answer in a state other than 
     have-remote-offer or have-local-pranswer.
   */
  // Answer는 아래와 같이 생성된다.
  /*
    RTCSessionDescription {
        sdp: "v=0\r\no=- 3270438221386651336 6 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=extmap-allow-mixed\r\na=msid-semantic: WMS\r\n"
        type: "answer"
    }
*/

  pc2.onaddstream = gotRemoteStream;

  trace("Added local stream to pc1");
  pcClient.addStream(localStream);

  trace("pc1 createOffer start");
  pcClient.createOffer(offerOptions).then(onCreateOfferSuccess);
}

function onCreateOfferSuccess(desc) {
  pcClient.setLocalDescription(desc);
  trace("pc2 setRemoteDescription start");

  pc2.setRemoteDescription(desc);
  trace("pc2 createAnswer start");

  // Since the 'remote' side has no media stream we need
  // to pass in the right constraints in order for it to
  // accept the incoming offer of audio and video.
  pc2.createAnswer().then(onCreateAnswerSuccess);
}

function gotRemoteStream(e) {
  remoteVideo.srcObject = e.stream;
  trace("pc2 received remote stream");
}

function onCreateAnswerSuccess(desc) {
  trace("pc2 setLocalDescription start");
  pc2.setLocalDescription(desc);

  trace("pc1 setRemoteDescription start");
  pcClient.setRemoteDescription(desc);
}

function handleIceCandidate(pc, RTCPeerConnectionIceEvent) {
  // 이걸 전달해야 한다.
  // candidate 필드가 RTCIceCandidate 객체이다. (이거 그냥 전달하면 된다.)
  // addIceCandidate가 있다. 오호~
  getOtherPc(pc).addIceCandidate(RTCPeerConnectionIceEvent.candidate);
}

/*
    1. 상대방이 꺼지면 내 pc.close(); 를 수행한다.
    2. 근데 상대방이 꺼지는건 어떻게 알지?
*/
function hangup() {
  trace("Ending call");
  pcClient.close();
  pcClient = null;
  hangupButton.disabled = true;
  callButton.disabled = false;
}

// logging utility
function trace(arg) {
  var now = (window.performance.now() / 1000).toFixed(3);
  console.log(now + ": ", arg);
}
