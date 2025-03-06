$(document).ready(function () {
    let webamp;
  
    // Initialize Webamp on double-click
    $("#webamp-icon").on("dblclick", function () {
      if (!webamp || webamp.isDisposed()) {
        webamp = new Webamp();
        webamp.renderWhenReady($("#winamp")[0]);
        webamp.onClose(() => {
          webamp = null;
        });
      } else {
        webamp.focus();
      }
    });
  
    // Update the clock
    function updateClock() {
      const now = new Date();
      const time = now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      $(".taskbar-time").text(time);
    }
    setInterval(updateClock, 1000);
    updateClock();
  
    // Select and highlight icons on single-click
    $(".desktop-icon").on("click", function (event) {
      $(".desktop-icon").removeClass("selected");
      $(this).addClass("selected");
      event.stopPropagation();
    });
  
    // Deselect icons when clicking outside
    $("body").on("click", function () {
      $(".desktop-icon").removeClass("selected");
    });
  
    // Window management
    let zIndex = 100;
    const windowContents = {
      biography: {
        title: "Biography",
        content: `<lottie-player src="./assets/body-movin/data.json" background="transparent"
                  speed="1" style="width: 1280px; height: 720px;" loop autoplay></lottie-player>
                 `,
      },
      photos: {
        title: "Photo Gallery",
        content: `<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                            <img src="/api/placeholder/150/150" alt="Photo 1">
                            <img src="/api/placeholder/150/150" alt="Photo 2">
                            <img src="/api/placeholder/150/150" alt="Photo 3">
                            <img src="/api/placeholder/150/150" alt="Photo 4">
                        </div>`,
      },
      resume: {
        title: "Resume",
        content: `<h2>Professional Experience</h2>
                        <p><strong>Senior Developer</strong> - Tech Corp (2020-Present)</p>
                        <p><strong>Web Developer</strong> - Digital Solutions (2018-2020)</p>
                        <h2>Education</h2>
                        <p>B.S. Computer Science - Tech University (2018)</p>`,
      },
    };
  
    window.openWindow = function (id) {
      console.log("Opening window", id);
      if ($(`#window-${id}`).length) {
        const $window = $(`#window-${id}`);
        $window.show().css("z-index", ++zIndex);
        activateTaskbarItem(id);
        return;
      }
  
      const left = 100 + Math.random() * 100;
      const top = 50 + Math.random() * 100;
      let width = 400;
      let height = 300;
      let contentClass = 'window-content';
      let isResizeAble = ''
      let isDisabled = ''
      let isMaximizable = ''
      if (id === "biography") {
        width = 1280;
        height = 720;
        contentClass = 'window-biography-content';
        isResizeAble = 'window-resizeable-none';
        isMaximizable = 'maximize'
        isDisabled = 'disabled';
      }
      
      const windowHtml = `
        <div class="window ${isResizeAble}" id="window-${id}" style="left: ${left}px; top: ${top}px; width: ${width}px; height: ${height}px;">
            <div class="window-header">
                <div class="title-bar">
                    <img src="/api/placeholder/16/16" alt="Icon" class="window-icon">
                    <span>${windowContents[id].title}</span>
                </div>
                <div class="window-controls">
                    <button class="control-button minimize">_</button>
                    <button class="control-button maximize" ${isMaximizable} ${isDisabled}>□</button>
                    <button class="control-button close">x</button>
                </div>
            </div>
            <div class="${contentClass}">
                ${windowContents[id].content}
            </div>
        </div>`;
  
      $("body").append(windowHtml);
      $(`#window-${id}`).show().css("z-index", ++zIndex);
  
      const $window = $(`#window-${id}`);
      const $taskbar = $(".taskbar-icons");
  
      // Add taskbar item if it doesn't already exist
      let taskbarItem = $(`.taskbar-item[data-window="${id}"]`);
      if (!taskbarItem.length) {
        taskbarItem = $(`<div class="taskbar-item" data-window="${id}">
            <img src="/api/placeholder/16/16" style="margin-right: 5px;">
            ${windowContents[id].title}
        </div>`);
        $taskbar.append(taskbarItem);
      }
  
      // Make window draggable
      $window.draggable({
        handle: ".window-header",
        start: function () {
          $(this).css("z-index", ++zIndex);
        },
      });
  
      // Make window resizable
      $window.resizable({
        minWidth: 200,
        minHeight: 150,
      });
  
      // Window controls
      $window.find(".control-button.close").click(function () {
        $window.hide();
        // Hide the taskbar taskbarItem
        taskbarItem.css("display", "none");
        taskbarItem.removeClass("active");
      });
  
      $window.find(".control-button.minimize").click(function () {
        $window.hide();
        taskbarItem.removeClass("active");
      });
  
      $window.find(".control-button.maximize").click(function () {
        if (!$window.hasClass("maximized")) {
          $window.data("original-pos", {
            width: $window.width(),
            height: $window.height(),
            top: $window.css("top"),
            left: $window.css("left"),
          });
          $window
            .css({
              top: "0",
              left: "0",
              width: "100%",
              height: "calc(100vh - 40px)",
            })
            .addClass("maximized");
        } else {
          const pos = $window.data("original-pos");
          $window.css(pos).removeClass("maximized");
        }
      });
  
      // Taskbar item click handler (single-click to restore window)
      taskbarItem.on("click", function () {
        // Set only this taskbar item as active
        $(".taskbar-item").removeClass("active");
        if ($window.is(":visible")) {
          $window.show().css("z-index", ++zIndex);
  
          $(this).addClass("active");
          console.log(this);
          //$window.hide();
          //$(this).removeClass("active");
        } else {
          $window.show().css("z-index", ++zIndex);
          $(this).addClass("active");
        }
      });
  
      // Bring window to front on click
      $window.mousedown(function () {
        $(this).css("z-index", ++zIndex);
        $(".taskbar-item").removeClass("active"); // Remove active from all
        $(`.taskbar-item[data-window="${id}"]`).addClass("active"); // Set active on current
      });
  
      // Set the clicked taskbar item as active
      activateTaskbarItem(id);
    };
  
    // Function to set active taskbar item based on window ID
    function activateTaskbarItem(id) {
      $(".taskbar-item").removeClass("active"); // Remove active from all
      $(`.taskbar-item[data-window="${id}"]`).addClass("active"); // Set active on current
      $(`.taskbar-item[data-window="${id}"]`).css("display", "flex"); // Show the taskbar item
    }
  
    // function addTaskBarItem(id, windowContents) {
    //   const taskbarItem = $(`<div class="taskbar-item" data-window="${id}">
    //       <img src="/api/placeholder/16/16" alt="Icon" style="margin-right: 5px;">
    //       ${windowContents[id].title}
    //   </div>`);
    //   $(".taskbar-icons").append(taskbarItem);
    // }
    // Attach a click event listener to all divs inside #desktop-elements-container
    $(document).ready(function () {
      // Toggle Start Menu visibility on Start Button click
      $(".start-button").click(function (event) {
        $("#start-menu").toggle();
        $(".taskbar-item").removeClass("active");
        event.stopPropagation(); // Prevent event from bubbling up to the body
      });
  
      // Close Start Menu when clicking outside of it
      $(document).click(function () {
        $("#start-menu").hide();
      });
  
      // Prevent Start Menu from closing when clicking inside it
      $("#start-menu").click(function (event) {
        event.stopPropagation(); // Prevent event from bubbling up to the document
      });
  
      $(document).on("click", function (event) {
        const target = $(event.target);
        windowElement = $(target).closest(".window");
        //console.log(windowElement.length);
        if (target.closest(".taskbar-item").length || windowElement.length) {
          console.log("Clicked on a .taskbar-item");
          // Your action for clicks outside `.taskbar-item`
        } else {
          console.log("An element outside of .taskbar-item was clicked.");
          $(".taskbar-item").removeClass("active");
        }
      });
    });
  });