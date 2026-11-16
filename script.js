"use strict";

(function () {
  var video = document.getElementById("player");
  var message = document.getElementById("player-message");
  var year = document.getElementById("year");

  if (year) {
    year.textContent = String(new Date().getFullYear());
  }

  if (!video || !message) {
    return;
  }

  // The "error" event of <source> fires for each failed source.
  // When the last source fails, no source is left to try.
  var sources = video.querySelectorAll("source");
  var lastSource = sources[sources.length - 1];

  if (lastSource) {
    lastSource.addEventListener("error", function () {
      message.hidden = false;
    });
  }

  video.addEventListener("loadeddata", function () {
    message.hidden = true;
  });
})();
