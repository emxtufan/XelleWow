/* Unlock the existing players only from a media control's user gesture. */
let xelleHomePodcastAudio = null;
// Sound is on once the visitor has started it and has not muted it since.
function xelleSoundOn() {
  return ch.isInit && !Cm().audio.isMuted;
}
function xelleEnableAudio() {
  ch.init();
  ch.mute(false);
  no().toggleMute(false);
  Cm().toggleAudioMuted(false);
  if (xelleHomePodcastAudio) {
    xelleHomePodcastAudio.unmute({ duration: 0 });
    void xelleHomePodcastAudio.unlockFromGesture();
  }
}
