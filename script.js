"use strict";

(function () {
  var video = document.getElementById("player");
  var message = document.getElementById("player-message");
  var year = document.getElementById("year");

  if (year) {
    year.textContent = String(new Date().getFullYear());
  }

  if (!video) {
    return;
  }

  /* ---------- Load error message ---------- */

  // The "error" event of <source> fires for each failed source.
  // When the last source fails, no source is left to try.
  var sources = video.querySelectorAll("source");
  var lastSource = sources[sources.length - 1];

  if (message) {
    if (lastSource) {
      lastSource.addEventListener("error", function () {
        message.hidden = false;
      });
    }
    video.addEventListener("loadeddata", function () {
      message.hidden = true;
    });
  }

  /* ---------- Custom player controls ---------- */

  var frame = document.getElementById("screen");
  var panel = document.getElementById("controls");
  var seek = document.getElementById("seek");
  var timeCurrent = document.getElementById("time-current");
  var timeTotal = document.getElementById("time-total");
  var btnPlay = document.getElementById("btn-play");
  var btnBack = document.getElementById("btn-back");
  var btnForward = document.getElementById("btn-forward");
  var btnSpeed = document.getElementById("btn-speed");
  var btnMute = document.getElementById("btn-mute");
  var volume = document.getElementById("volume");
  var btnLoop = document.getElementById("btn-loop");
  var btnFullscreen = document.getElementById("btn-fullscreen");

  // If anything is missing, keep the browser's native controls.
  if (!frame || !panel || !seek || !timeCurrent || !timeTotal || !btnPlay ||
      !btnBack || !btnForward || !btnSpeed || !btnMute || !volume ||
      !btnLoop || !btnFullscreen) {
    return;
  }

  var RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
  var SKIP_SECONDS = 10;
  var scrubbing = false;

  function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) {
      seconds = 0;
    }
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function setEnabled(enabled) {
    var items = panel.querySelectorAll("button, input");
    for (var i = 0; i < items.length; i++) {
      items[i].disabled = !enabled;
    }
  }

  function togglePlay() {
    if (video.paused || video.ended) {
      var result = video.play();
      if (result && typeof result.catch === "function") {
        result.catch(function () {});
      }
    } else {
      video.pause();
    }
  }

  function skip(delta) {
    var target = video.currentTime + delta;
    if (isFinite(video.duration)) {
      target = Math.min(target, video.duration);
    }
    video.currentTime = Math.max(0, target);
  }

  function updatePlay() {
    if (video.ended) {
      btnPlay.textContent = "إعادة التشغيل";
    } else if (video.paused) {
      btnPlay.textContent = "تشغيل";
    } else {
      btnPlay.textContent = "إيقاف مؤقت";
    }
  }

  function updateDuration() {
    timeTotal.textContent = formatTime(video.duration);
  }

  function updateProgress() {
    timeCurrent.textContent = formatTime(video.currentTime);
    if (!scrubbing && isFinite(video.duration) && video.duration > 0) {
      seek.value = String(Math.round((video.currentTime / video.duration) * 1000));
    }
  }

  function updateSpeed() {
    btnSpeed.textContent = video.playbackRate + "\u00D7";
    btnSpeed.setAttribute("aria-label", "سرعة التشغيل " + video.playbackRate);
  }

  function updateVolume() {
    var silent = video.muted || video.volume === 0;
    btnMute.setAttribute("aria-pressed", String(silent));
    volume.value = String(video.muted ? 0 : video.volume);
  }

  function onReady() {
    setEnabled(true);
    updateDuration();
    updateProgress();
  }

  // Seek bar
  seek.addEventListener("pointerdown", function () {
    scrubbing = true;
  });
  window.addEventListener("pointerup", function () {
    scrubbing = false;
  });
  window.addEventListener("pointercancel", function () {
    scrubbing = false;
  });
  seek.addEventListener("input", function () {
    if (!isFinite(video.duration) || video.duration <= 0) {
      return;
    }
    var target = (Number(seek.value) / 1000) * video.duration;
    video.currentTime = target;
    timeCurrent.textContent = formatTime(target);
  });

  // Buttons
  btnPlay.addEventListener("click", togglePlay);
  video.addEventListener("click", togglePlay);
  btnBack.addEventListener("click", function () { skip(-SKIP_SECONDS); });
  btnForward.addEventListener("click", function () { skip(SKIP_SECONDS); });

  btnSpeed.addEventListener("click", function () {
    var index = RATES.indexOf(video.playbackRate);
    video.playbackRate = RATES[(index + 1) % RATES.length];
  });

  btnMute.addEventListener("click", function () {
    video.muted = !video.muted;
  });

  volume.addEventListener("input", function () {
    var level = Number(volume.value);
    video.volume = level;
    video.muted = level === 0;
  });

  btnLoop.addEventListener("click", function () {
    video.loop = !video.loop;
    btnLoop.setAttribute("aria-pressed", String(video.loop));
  });

  if (!frame.requestFullscreen && !video.webkitEnterFullscreen) {
    btnFullscreen.hidden = true;
  }
  btnFullscreen.addEventListener("click", function () {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (frame.requestFullscreen) {
      var result = frame.requestFullscreen();
      if (result && typeof result.catch === "function") {
        result.catch(function () {});
      }
    } else if (video.webkitEnterFullscreen) {
      video.webkitEnterFullscreen();
    }
  });

  // Keep the UI in sync with the video
  video.addEventListener("play", updatePlay);
  video.addEventListener("pause", updatePlay);
  video.addEventListener("ended", updatePlay);
  video.addEventListener("timeupdate", updateProgress);
  video.addEventListener("durationchange", updateDuration);
  video.addEventListener("loadedmetadata", onReady);
  video.addEventListener("ratechange", updateSpeed);
  video.addEventListener("volumechange", updateVolume);

  // Switch from native to custom controls
  video.controls = false;
  frame.classList.add("custom");
  panel.hidden = false;
  setEnabled(false);
  updatePlay();
  updateSpeed();
  updateVolume();

  if (video.readyState >= 1) {
    onReady();
  }
})();
