## WebRTC 녹화 및 P2P 상의 해상도 변경 기능

### 녹화 기능

MediaRecorder을 사용해 video, audio track이 하나로 인코딩된 파일을 timeslice 단위로 chunk 단위 전송을 수행한다.

전송의 경우 WebSocket (https 및 wss) 기반으로 수행한다.

- WebSocket은 TCP 기반으로 순서를 보장하므로 file write에 적절하다.
- 녹화의 경우 latency보다 order가 중요하므로 적절하다.
- 매우 느린 네트워크 (300~400kbps)에서는 WebSocket은 계속 disconnect가 발생했다.
  - 물론 WebRTC도 이 수준의 네트워크는 감당할 수 없을 것이다.
  - 이는 사용자에게 네트워크 최소 조건을 강제함으로써 해결할 수 있을 것이다. (최저 조건은 2Mbps 정도만 나와도 충분할 것이다.)
- WebRTC p2p는 용량 720p 녹화의 경우 핸드폰에서 하기 좀 부담스럽다.
  - 저사양 핸드폰의 경우 렉이 좀 걸린다. (매우 심하진 않지만 걸린다. 볼만하긴 하다.)
  - 240p는 테스트를 좀 해봐야 할 것 같다. 240p로 충분하다면

### 해상도 변경 기능

stable 연결 수립 후, `set{Local|Remote}Description` 함수를 통해 Stream의 constraints를 변경하고 (createOffer를 호출해야 하나?)
