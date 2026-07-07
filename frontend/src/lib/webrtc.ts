const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export function createPeerConnection(iceServers?: RTCIceServer[]): RTCPeerConnection {
  return new RTCPeerConnection({
    iceServers: iceServers || DEFAULT_ICE_SERVERS,
  });
}

export async function createOffer(pc: RTCPeerConnection): Promise<RTCSessionDescriptionInit> {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  return offer;
}

export async function createAnswer(pc: RTCPeerConnection, offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  return answer;
}

export async function setIceCandidate(pc: RTCPeerConnection, candidate: RTCIceCandidateInit): Promise<void> {
  await pc.addIceCandidate(new RTCIceCandidate(candidate));
}
