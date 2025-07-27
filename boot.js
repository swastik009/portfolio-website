$(document).ready(function () {
  // Initial setup: Show alert box and hide main content
  $("#alert-box").fadeIn();
  $("#main-content").hide();

  // Handle alert acceptance
  $("#alert-accept").click(function () {
    $("#alert-box").hide();
    $("#main-content").fadeIn();
    $("#win98-startup")[0].play();
    $(".desktop-icon").hide();
    load_third_parties();
  });

  /**
   * Loads third-party elements like desktop icons and Clippy with animations.
   * Desktop icons are shown with a staggered delay, and Clippy is initialized
   * with a greeting animation and periodic animations.
   */
  function load_third_parties() {
    // Show desktop icons with random staggered delay
    $(".desktop-icon").each(function (index, element) {
      const minDelay = 500; // Minimum delay in milliseconds
      const maxDelay = 1000; // Maximum delay in milliseconds
      const randomDelay =
        Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

      setTimeout(() => {
        $(element).show();
      }, randomDelay);
    });
    // Initialize Clippy assistant
    clippy.load("Clippy", function (agent) {
      setTimeout(() => {
        agent.show();
        agent.play("Greeting");
        agent.speak(
          "Hello! My name is Clippy. I'm here purely for nostalgic reasons, bringing back memories of the past."
        );

        // Play random animations every 10 seconds
        setInterval(() => {
          agent.animate();
        }, 10000);
      }, 1500);
    });
  }

  var width = $(window).width();

  if (width <= 1024) {
    $("#alert-accept").hide();

    $("input[name='username']").closest("div").hide();
    $("input[name='password']").closest("div").hide();

    $(".alert-message > div:first").html(
      "Looks like this Windows version wasn’t built for pocket-sized supercomputers.<br>" +
        "For the full retro vibes, try checking it out on a desktop.<br><br>" +
        "But hey, since you made it here, feel free to browse the resume anyway 📄😉"
    );

    $(".alert-header").text("Warning: Your device is smarter than this site");

    $("button:contains('Resume')").css({
      padding: "12px 24px",
      "font-size": "16px",
      "font-weight": "bold",
    });
  }
});
