## WebRTC Record Server

### Build

`git clone https://github.com/classvar/classvar-record-backend`

`docker build . -t seongbin9786/webrtc-record-server:{version}` (npm install not required.)

### Run

환경 변수 `RECORD_SERVER_IP` 와 `RECORD_SERVER_PORT`의 설정이 필요합니다. (기본값: localhost 3000)

IP의 경우 접속 대상이 접속할 수 있는 IP가 필요합니다. (내부 IP일수도, 외부 IP일수도 있음.)

`docker run -d -e RECORD_SERVER_IP=192.168.1.1 -e RECORD_SERVER_PORT=3000 -p 3000:3000 --mount type=bind,source="$(pwd)"/files,target=/classvar-webrtc/files seongbin9786/webrtc-record-server:{version}`

we use `bind mount(--mount)` option to keep files permanent.
