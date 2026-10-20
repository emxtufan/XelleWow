/* Unlock the existing players only from a media control's user gesture. */
let xelleHomePodcastAudio = null;
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
