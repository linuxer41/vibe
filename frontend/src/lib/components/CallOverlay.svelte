<script lang="ts">
  import { avatarUrl } from '$lib/helpers';
  import { user, socket, activeCall, showToast } from '$lib/stores';
  import { createPeerConnection, createOffer, createAnswer, setIceCandidate } from '$lib/webrtc';
  import type { User } from '$lib/types';
  import { get } from 'svelte/store';
  import Icon from '$lib/icon/Icon.svelte';

  let usr: User | null = $state(null);
  let sk: any = $state(null);
  let call = $state<any>(null);
  let pc: RTCPeerConnection | null = null;
  let localStream: MediaStream | null = $state(null);
  let remoteStream: MediaStream | null = $state(null);
  let localVideoEl: HTMLVideoElement | undefined = $state();
  let remoteVideoEl: HTMLVideoElement | undefined = $state();
  let timerValue = $state(0);
  let timerInterval: ReturnType<typeof setInterval> | null = null;
  let _initiating = false;
  let _accepting = false;

  user.subscribe((v) => usr = v);
  socket.subscribe((v) => sk = v);
  activeCall.subscribe((v) => call = v);

  $effect(() => {
    if (call?.status === 'active' && !timerInterval) {
      timerValue = 0;
      timerInterval = setInterval(() => timerValue++, 1000);
    }
    if (!call || call.status !== 'active') {
      if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    }
  });

  $effect(() => {
    if (call?.status === 'ended') {
      setTimeout(() => {
        activeCall.set(null);
        cleanup();
      }, 2000);
    }
  });

  $effect(() => {
    if (!sk || _initiating) return;
    if (call?.direction === 'outgoing' && call.status === 'ringing' && !call.callId) {
      _initiating = true;
      doStartCall(call.peerId, call.type);
    }
  });

  $effect(() => {
    if (!sk) return;
    const _onIncoming = (data: any) => {
      activeCall.set({
        callId: data.callId,
        peerId: data.callerId,
        peerName: data.callerName,
        type: data.type,
        direction: 'incoming',
        status: 'ringing',
        muted: false,
        speakerOn: false,
      });
    };
    const _onSignal = async (sigData: any) => {
      const cur = get(activeCall);
      if (!cur || cur.callId !== sigData.callId || _accepting) return;
      if (sigData.type === 'answer') {
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(sigData.data));
          activeCall.update((c: any) => c ? { ...c, status: 'active', startTime: Date.now() } : c);
        }
      } else if (sigData.type === 'ice') {
        if (pc) await setIceCandidate(pc, sigData.data);
      }
    };
    const _onEnded = () => {
      endCall();
    };
    const _onRejected = () => {
      activeCall.update((c: any) => c ? { ...c, status: 'ended' } : c);
      showToast('Llamada rechazada');
    };
    sk.on('incoming_call', _onIncoming);
    sk.on('signal_data', _onSignal);
    sk.on('call_ended', _onEnded);
    sk.on('call_rejected', _onRejected);
    return () => {
      sk.off('incoming_call', _onIncoming);
      sk.off('signal_data', _onSignal);
      sk.off('call_ended', _onEnded);
      sk.off('call_rejected', _onRejected);
    };
  });

  async function doStartCall(peerId: number, type: string) {
    try {
      sk.emit('start_call', { calleeId: peerId, type }, async (res: any) => {
        if (!res?.callId) {
          activeCall.set(null);
          showToast('No se pudo iniciar la llamada', 'error');
          _initiating = false;
          return;
        }
        const cid = res.callId;
        activeCall.update((c: any) => c ? { ...c, callId: cid, status: 'connecting' } : c);
        const stream = await navigator.mediaDevices.getUserMedia(
          type === 'video' ? { audio: true, video: true } : { audio: true }
        );
        localStream = stream;
        const peerConnection = createPeerConnection();
        pc = peerConnection;
        stream.getTracks().forEach(track => pc!.addTrack(track, stream));
        pc.onicecandidate = (e) => {
          if (e.candidate) {
            sk.emit('signal_data', { callId: cid, type: 'ice', data: e.candidate.toJSON() });
          }
        };
        pc.ontrack = (event) => {
          remoteStream = event.streams[0];
        };
        const offer = await createOffer(pc);
        sk.emit('signal_data', { callId: cid, type: 'offer', data: offer });
      });
    } catch (err) {
      showToast('Error al iniciar llamada', 'error');
      cleanup();
      _initiating = false;
    }
  }

  async function acceptCall() {
    if (!sk || !call || _accepting) return;
    _accepting = true;
    const cid = call.callId;
    sk.emit('accept_call', { callId: cid }, async (offer: any) => {
      if (!offer) {
        showToast('Error al aceptar llamada', 'error');
        _accepting = false;
        return;
      }
      activeCall.update((c: any) => c ? { ...c, status: 'connecting' } : c);
      try {
        const stream = await navigator.mediaDevices.getUserMedia(
          call.type === 'video' ? { audio: true, video: true } : { audio: true }
        );
        localStream = stream;
        const peerConnection = createPeerConnection();
        pc = peerConnection;
        stream.getTracks().forEach(track => pc!.addTrack(track, stream));
        pc.onicecandidate = (e) => {
          if (e.candidate) {
            sk.emit('signal_data', { callId: cid, type: 'ice', data: e.candidate.toJSON() });
          }
        };
        pc.ontrack = (event) => {
          remoteStream = event.streams[0];
        };
        const answer = await createAnswer(pc, offer);
        sk.emit('signal_data', { callId: cid, type: 'answer', data: answer });
        activeCall.update((c: any) => c ? { ...c, status: 'active', startTime: Date.now() } : c);
      } catch (err) {
        showToast('Error al conectar llamada', 'error');
        cleanup();
      }
      _accepting = false;
    });
  }

  function rejectCall() {
    if (!sk || !call) return;
    sk.emit('reject_call', { callId: call.callId });
    activeCall.set(null);
  }

  function endCall() {
    if (pc) { pc.close(); pc = null; }
    if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
    remoteStream = null;
    if (call?.callId && sk) {
      sk.emit('end_call', { callId: call.callId });
    }
    activeCall.update((c: any) => c ? { ...c, status: 'ended' } : c);
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }

  function cleanup() {
    if (pc) { pc.close(); pc = null; }
    if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
    remoteStream = null;
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    _initiating = false;
    _accepting = false;
  }

  $effect(() => {
    if (remoteVideoEl && remoteStream) {
      remoteVideoEl.srcObject = remoteStream;
    }
  });

  $effect(() => {
    if (localVideoEl && localStream) {
      localVideoEl.srcObject = localStream;
    }
  });

  function toggleMute() {
    if (localStream) {
      const t = localStream.getAudioTracks()[0];
      if (t) {
        t.enabled = !t.enabled;
        activeCall.update((c: any) => c ? { ...c, muted: !t.enabled } : c);
      }
    }
  }

  function toggleSpeaker() {
    activeCall.update((c: any) => c ? { ...c, speakerOn: !c.speakerOn } : c);
  }

  let show = $derived(call && call.status !== 'ended');

  function formatTimer(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  }
</script>

{#if show}
  <div class="call-overlay" class:video={call.type === 'video'} class:incoming={call.direction === 'incoming' && call.status === 'ringing'}>
    {#if call.type === 'video' && remoteStream}
      <video autoplay playsinline bind:this={remoteVideoEl} class="remote-video"></video>
    {:else if call.type === 'video'}
      <div class="remote-video-placeholder">
        <img src={avatarUrl(call.peerId)} alt="" class="call-avatar-lg" />
      </div>
    {/if}

    <div class="call-info">
      <img src={avatarUrl(call.peerId)} alt="" class="call-peer-avatar" />
      <span class="call-peer-name">{call.peerName}</span>
      <span class="call-status-text">
        {#if call.status === 'ringing' && call.direction === 'outgoing'}
          Llamando...
        {:else if call.status === 'ringing' && call.direction === 'incoming'}
          Llamada entrante...
        {:else if call.status === 'connecting'}
          Conectando...
        {:else if call.status === 'active'}
          {formatTimer(timerValue)}
        {/if}
      </span>
    </div>

    {#if call.type === 'video' && localStream}
      <div class="local-video-wrapper">
        <video autoplay playsinline muted bind:this={localVideoEl} class="local-video"></video>
      </div>
    {/if}

    <div class="call-controls">
      {#if call.direction === 'incoming' && call.status === 'ringing'}
        <button class="call-btn reject" onclick={rejectCall} title="Rechazar">
          <Icon name="phone" size={24} />
        </button>
        <button class="call-btn accept" onclick={acceptCall} title="Aceptar">
          <Icon name="phone" size={24} />
        </button>
      {:else if call.status === 'active' || call.status === 'connecting'}
        <button class="call-btn control" onclick={toggleMute} title={call?.muted ? 'Activar micrófono' : 'Silenciar'}>
          <Icon name="mic" size={22} />
        </button>
        <button class="call-btn reject end" onclick={endCall} title="Colgar">
          <Icon name="phone-off" size={24} />
        </button>
        <button class="call-btn control" onclick={toggleSpeaker} title={call?.speakerOn ? 'Altavoz' : 'Altavoz'}>
          <Icon name="volume" size={22} />
        </button>
      {:else if call.status === 'ringing' && call.direction === 'outgoing'}
        <button class="call-btn reject" onclick={endCall} title="Cancelar">
          <Icon name="phone-off" size={24} />
        </button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .call-overlay {
    position: fixed; inset: 0; z-index: 9999;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: var(--bg); animation: fadeIn 0.25s ease-out;
    max-width: 430px; margin: 0 auto;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .call-overlay.video { background: #000; }
  .remote-video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .remote-video-placeholder {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    background: var(--bg-3);
  }
  .call-info {
    display: flex; flex-direction: column; align-items: center; gap: 8px;
    position: relative; z-index: 2;
  }
  .call-peer-avatar { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; }
  .call-avatar-lg { width: 100px; height: 100px; border-radius: 50%; object-fit: cover; }
  .call-peer-name { font-size: 20px; font-weight: 700; color: var(--text); }
  .call-overlay.video .call-peer-name { color: #fff; }
  .call-status-text { font-size: 14px; color: var(--text-2); }
  .call-overlay.video .call-status-text { color: rgba(255,255,255,0.7); }
  .local-video-wrapper {
    position: absolute; top: 60px; right: 16px; z-index: 3;
    width: 120px; height: 160px; border-radius: 12px; overflow: hidden;
    border: 2px solid rgba(255,255,255,0.3); box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  }
  .local-video { width: 100%; height: 100%; object-fit: cover; }
  .call-controls {
    display: flex; align-items: center; gap: 24px;
    position: relative; z-index: 2; margin-top: 40px;
  }
  .call-btn {
    width: 56px; height: 56px; border-radius: 50%; border: none;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;
    color: #fff;
  }
  .call-btn:hover { transform: scale(1.08); }
  .call-btn:active { transform: scale(0.95); }
  .call-btn.reject { background: var(--danger); }
  .call-btn.accept { background: var(--accent); color: #000; }
  .call-btn.control { background: var(--bg-3); color: var(--text); }
  .call-btn.end { width: 64px; height: 64px; }
</style>
