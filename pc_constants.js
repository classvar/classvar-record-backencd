const PEER_CONNECTION_CONFIG = {
  sdpSemantics: "unified-plan",
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

module.exports = {
  PEER_CONNECTION_CONFIG,
  ICE_CANDIDATE,
  OFFER,
  ANSWER,
  NEW_PEER_ICE_CANDIDATE,
};
