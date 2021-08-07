const ICE_SERVERS_CONFIG = {
  iceServers: [
    {
      urls: "stun.l.google.com:19302",
    },
    {
      urls: "stun1.l.google.com:19302",
    },
    {
      urls: "stun2.l.google.com:19302",
    },
    {
      urls: "stun3.l.google.com:19302",
    },
    {
      urls: "stun4.l.google.com:19302",
    },
  ],
};

const OFFER = "offer";

const ANSWER = "answer";

const ICE_CANDIDATE = "icecandidate";

module.exports = { ICE_SERVERS_CONFIG, ICE_CANDIDATE, OFFER, ANSWER };
