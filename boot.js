
$(document).ready(function() {
// Initial setup: Show alert box and hide main content
 $("#alert-box").fadeIn();
 $("#main-content").hide();

 // Handle alert acceptance
 $("#alert-accept").click(function() {
   $("#alert-box").hide();
   $("#main-content").fadeIn();
   $("#win98-startup")[0].play();
   $('.desktop-icon').hide();
   load_third_parties();
 });

 /**
  * Loads third-party elements like desktop icons and Clippy with animations.
  * Desktop icons are shown with a staggered delay, and Clippy is initialized
  * with a greeting animation and periodic animations.
  */
 function load_third_parties() {
   // Show desktop icons with random staggered delay
   $('.desktop-icon').each(function(index, element) {
     const minDelay = 500; // Minimum delay in milliseconds
     const maxDelay = 1000; // Maximum delay in milliseconds
     const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

     setTimeout(() => {
       $(element).show();
     }, randomDelay);
   });
   // Initialize Clippy assistant
   clippy.load('Clippy', function(agent) {
     setTimeout(() => {
       agent.show();
       agent.play('Greeting');
       agent.speak("Hello! My name is Clippy. I'm here purely for nostalgic reasons, bringing back memories of the past.");

       // Play random animations every 10 seconds
       setInterval(() => {
         agent.animate();
       }, 10000);
       }, 1500);
   });
 }
});