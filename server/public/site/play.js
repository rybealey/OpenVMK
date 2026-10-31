// Play Now opens the game in a window of its own at the stage's real size,
// 800 x 600 (client/client.html), like the original VMK's pop-up. The game page
// keeps it at that size (site/game-window.js).
(function () {
  var NAME = "vmk-game";
  var WIDTH = 800;
  var HEIGHT = 600;

  // A phone, or a screen too small for the window: play in this tab instead.
  function roomForWindow() {
    return (
      !window.matchMedia("(pointer: coarse)").matches &&
      screen.availWidth >= WIDTH + 40 &&
      screen.availHeight >= HEIGHT + 80
    );
  }

  document.addEventListener("click", function (event) {
    var link = event.target.closest && event.target.closest("a[data-play-window]");
    if (!link || event.defaultPrevented || event.button !== 0) return;
    // Ctrl/Cmd/Shift-click keeps its usual meaning (a tab, a window).
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !roomForWindow()) return;

    // Centred over this window. `width`/`height` are the CONTENT size, so the
    // stage gets exactly 800 x 600 whatever the browser's own frame measures.
    var left = Math.max(0, Math.round(window.screenX + (window.outerWidth - WIDTH) / 2));
    var top = Math.max(0, Math.round(window.screenY + (window.outerHeight - HEIGHT) / 2));
    var features =
      "popup=yes,width=" + WIDTH + ",height=" + HEIGHT + ",left=" + left + ",top=" + top +
      ",resizable=no,scrollbars=no,location=no,toolbar=no,menubar=no,status=no";

    // Opened empty first, so an EXISTING game window can be told apart from a
    // new one: loading the game again would drop the player out of their room.
    var game = window.open("", NAME, features);
    if (!game) return; // a pop-up blocker said no: the link opens the game here
    event.preventDefault();
    var fresh = true;
    try {
      fresh = game.location.href === "about:blank";
    } catch (e) {
      // Not readable: not ours to keep, so load the game into it.
    }
    if (fresh) game.location.href = link.href;
    game.focus();
  });
})();
