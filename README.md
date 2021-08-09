## WebRTC Record Server

### Build

`git clone https://github.com/classvar/classvar-record-backend`

`docker build . -t classvar-webrtc-record` (npm install not required.)

### Run

`docker run -d -p 3000:3000 --mount type=bind,source="$(pwd)"/files,target=/classvar-webrtc/files classvar-webrtc-record`

we use `bind mount(--mount)` option to keep files permanent.
