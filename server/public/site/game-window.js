// Loaded by /play. In the game's own window (opened by site/play.js), keep it
// at the stage's size: browsers no longer honour `resizable=no`, so a resize is
// put back instead. A game played in an ordinary tab is left alone.
(function () {
  if (window.name !== "vmk-game") return;
  var WIDTH = 800;
  var HEIGHT = 600;
  var timer = 0;

  function snap() {
    // Full screen is the one size change the game offers on purpose.
    if (document.fullscreenElement) return;
    var dw = WIDTH - window.innerWidth;
    var dh = HEIGHT - window.innerHeight;
    if (dw !== 0 || dh !== 0) window.resizeBy(dw, dh);
  }

  window.addEventListener("resize", function () {
    clearTimeout(timer);
    timer = setTimeout(snap, 120);
  });
  // Some browsers size a pop-up's frame, not its content: correct that once.
  window.addEventListener("load", snap);
})();
