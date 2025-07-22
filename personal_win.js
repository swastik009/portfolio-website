$(document).ready(function () {
  // Global z-index counter for layering windows
  let zIndexCounter = 1000;

  // Sound controller
  $("#taskbar-sound-on").on("click", function () {
    $("#taskbar-sound-on").hide();
    $("#taskbar-sound-mute").show();
    $("audio").each(function () {
      this.pause();
      this.currentTime = 0; 
    });
  });

  $("#taskbar-sound-mute").on("click", function () {
    $("#taskbar-sound-mute").hide();
    $("#taskbar-sound-on").show();
  });

  const resumeUrl = "./assets/files/resume.pdf";

  window.downloadResume = function () {
    const link = document.createElement("a");
    link.href = resumeUrl;
    link.download = "Swastik_Resume.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  window.viewResume = function () {
    window.open(resumeUrl, "_blank");
  };

  // **Webamp Initialization (Placeholder)**
  // Adjust this section based on your actual Webamp setup
  let webamp;
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

  // **Clock Update Function**
  function updateClock() {
    const now = new Date();
    const time = now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    $(".taskbar-time").text(time);
  }
  setInterval(updateClock, 1000); // Update every second
  updateClock(); // Initial call

  // Function to set active taskbar item based on window ID
  function activateTaskbarItem(id) {
    $(".taskbar-item").removeClass("active"); // Remove active from all
    $(`.taskbar-item[data-window="${id}"]`).addClass("active"); // Set active on current
    $(`.taskbar-item[data-window="${id}"]`).css("display", "flex"); // Show the taskbar item
  }

  // **Desktop Icon Selection**
  $(".desktop-icon").on("click", function (event) {
    $(".desktop-icon").removeClass("selected"); // Deselect all
    $(this).addClass("selected"); // Select clicked icon
    $(".folder-item").removeClass("selected"); // Deselect on body click
    toggleDocumentFolderElements();
    event.stopPropagation(); // Prevent body click handler
  });

  function toggleDocumentFolderElements() {
    $(".left-pane-content-inactive").show();
    $(".left-pane-content-active").hide();
    $(".status-details-selected").hide();
    $(".status-details-no-selection").show();
  }

  $("body").on("click", function () {
    $(".desktop-icon").removeClass("selected"); // Deselect on body click
    $(".folder-item").removeClass("selected"); // Deselect on body click
    toggleDocumentFolderElements();
  });

  // **Start Menu Handling**
  $(".start-button").click(function (event) {
    $(".folder-item").removeClass("selected"); // Deselect on body click
    toggleDocumentFolderElements();
    $(".window-header").addClass("inactive"); // Deactivate other windows headers
    $("#start-menu").toggle(); // Toggle start menu visibility
    if ($("#start-menu").is(":visible")) {
      $(this).addClass("start-button-active");
    } else {
      $(this).removeClass("start-button-active");
    }
    $(".taskbar-item").removeClass("active"); // Deselect taskbar items when opening start menu
    event.stopPropagation(); // Prevent document click handler
  });

  $(".desktop-icon").click(function () {
    $(".window-header").addClass("inactive"); // Deactivate other windows headers
    $(".taskbar-item").removeClass("active"); // Deselect taskbar items when opening start menu
  });

  $(document).click(function () {
    $(".start-button").removeClass("start-button-active");
    $("#start-menu").hide(); // Hide start menu on outside click
  });

  $("#start-menu").click(function (event) {
    event.stopPropagation(); // Prevent menu click from closing it
  });

  function deactivateWindow(windowHeader) {
    $(".window-header").addClass("inactive"); // Deactivate other windows headers
    windowHeader.removeClass("inactive"); // Activate window header
  }

  function resolveImagePath(id) {
    if (id === "biography") {
      return "/icons/my_computer.png";
    }

    if (id === "resume") {
      return "/icons/docs.png";
    }

    return "/icons/folder.png";
  }

  // **Open Window Function**
  window.openWindow = function (id) {
    // Check if window already exists
    // Fetch content from HTML
    const contentDiv = document.getElementById(`${id}-content`);
    if (!contentDiv) {
      console.error(`Content div for id "${id}" not found.`); // Error if div missing
      return;
    }

    const title = contentDiv.getAttribute("data-title"); // Get title from data attribute
    const content = contentDiv.innerHTML; // Get content from innerHTML

    // Window configuration
    let width = 800;
    let height = 600;
    let contentClass = "window-content";
    let isResizeAble = ""; // Empty string means resizable
    let isDisabled = "";
    let isMaximizable = "";

    // Special settings for 'biography' window
    if (id === "biography") {
      contentClass = "window-biography-content";
      isResizeAble = "window-resizeable-none"; // Non-resizable
      isMaximizable = "maximize";
      isDisabled = "disabled"; // Maximize button disabled
      width = 1280; // Set specific width for biography window
      height = 720; // Set specific height for biography window
    }

    if (id === "resume") {
      contentClass = "window-resume-content";
    }

    let maxLeft = $(window).width() - width;
    let maxTop = $(window).height() - height;

    let left = Math.random() * maxLeft;
    let top = Math.random() * maxTop;

    let imageSrc = resolveImagePath(id);
    // Window HTML template
    const windowHtml = `
      <div class="window ${isResizeAble}" id="window-${id}" style="left: ${left}px; top: ${top}px; width: ${width}px; height: ${height}px; z-index: ${zIndexCounter++};">
        <div class="window-header">
          <div class="title-bar">
            <img src="${imageSrc}" alt="Icon" class="window-icon">
            <span>${title}</span>
          </div>
          <div class="window-controls">
            <button class="control-button minimize"></button>
            <button class="control-button maximize" ${isMaximizable} ${isDisabled}></button>
            <button class="control-button close"></button>
          </div>
        </div>
        <div class="${contentClass}">
          ${content}
        </div>
      </div>`;

    const $existingWindow = $(`#window-${id}`);
    const existingWindowHeader = $(`#window-${id} .window-header`);

    if ($existingWindow.length) {
      $existingWindow.show().css("z-index", zIndexCounter++); // Show and bring to front
      deactivateWindow(existingWindowHeader);
      activateTaskbarItem(id); // Activate taskbar item for existing window
      return;
    }

    // Append window to body and convert to jQuery object
    const $window = $(windowHtml).appendTo("body");

    const folderItemsCount = $window.find(".folder-item").length;
    $(".status-details-selected").hide();
    $(".status-details-no-selection").html(`${folderItemsCount} object(s)`);
    toggleDocumentFolderElements();
    // **Folder Icon Selection**
    $(".folder-item").on("click", function (event) {
      $(".desktop-icon").removeClass("selected"); // Deselect Desktop Items if selected
      $(".folder-item").removeClass("selected"); // Deselect all folder items
      $(this).addClass("selected"); // Select clicked icon
      const currentFolder = $(this);

      let leftPaneContentHeader = currentFolder.data("title");
      let leftPaneCreated = currentFolder.data("created");
      let leftPaneDescription = currentFolder.data("description");

      const $window = $(this).closest(".window");
      const $leftPaneContent = $window.find(".left-pane-content");
      $leftPaneContent
        .find("#left-pane-content-header")
        .html(leftPaneContentHeader);
      $leftPaneContent.find("#left-pane-content-created").html(leftPaneCreated);
      $leftPaneContent
        .find("#left-pane-content-description")
        .html(leftPaneDescription);
      $(".status-details-selected").show();
      $(".status-details-no-selection").hide();
      $(".left-pane-content-inactive").hide();
      $(".left-pane-content-active").show();
      event.stopPropagation(); // Prevent body click handler
    });
    // window header
    const windowHeader = $window.find(".window-header");
    deactivateWindow(windowHeader);

    // **Make Window Draggable**
    $window.draggable({
      handle: ".window-header", // Drag by header
      containment: "window", // Limit to viewport
      stack: ".window", // Manage stacking
    });

    // **Make Window Resizable (if not disabled)**
    if (!isResizeAble) {
      $window.resizable({
        minWidth: 200,
        minHeight: 200,
        containment: "window",
      });
    }

    $window.on("mousedown", function () {
      $window.css("z-index", zIndexCounter++);
      deactivateWindow(windowHeader);
      $(".taskbar-item").removeClass("active"); // Remove active from all taskbar items
      $(`.taskbar-item[data-window="${id}"]`).addClass("active"); // Set active on current window’s taskbar item
    });

    let imgSrc = resolveImagePath(id);
    // **Create Taskbar Item**
    const taskbarItem = $(`<div class="taskbar-item" data-window="${id}">
      <img style="height: 18px; width: 20px; padding-right: 5px;" src="${imgSrc}">
      ${title}
    </div>`).appendTo(".taskbar-icons");

    // **Set Initial Active State for New Window**
    $(".taskbar-item").removeClass("active"); // Remove active from all
    taskbarItem.addClass("active"); // Set active on new window’s taskbar item

    // **Taskbar Item Click Handler (with Active State Management)**
    taskbarItem.on("click", function () {
      $(".taskbar-item").removeClass("active"); // Deselect all taskbar items
      $(this).addClass("active"); // Set this taskbar item as active
      if ($window.is(":visible")) {
        $window.css("z-index", zIndexCounter++); // Bring to front if visible
      } else {
        $window.show().css("z-index", zIndexCounter++); // Show and bring to front if hidden
      }
      deactivateWindow(windowHeader);
    });

    // **Minimize Button (with Active State Removal)**
    $window.find(".minimize").on("click", function () {
      $window.hide(); // Hide window (mimics minimize)
      taskbarItem.removeClass("active"); // Remove active state from taskbar item
      deactivateWindow(windowHeader);
    });

    // **Close Button**
    $window.find(".close").on("click", function () {
      $window.remove(); // Remove window
      taskbarItem.remove(); // Remove taskbar item
    });

    // **Maximize Button**
    $window.find(".maximize:not(:disabled)").on("click", function () {
      if ($window.hasClass("maximized")) {
        // Restore to original size and position
        const original = $window.data("original");
        $window.css({
          left: original.left,
          top: original.top,
          width: original.width,
          height: original.height,
        });
        $window.removeClass("maximized");
      } else {
        // Store current position and size, then maximize
        $window.data("original", {
          left: $window.css("left"),
          top: $window.css("top"),
          width: $window.css("width"),
          height: $window.css("height"),
        });
        $window.css({
          left: 0,
          top: 0,
          width: "100%",
          height: "95%",
        });
        $window.addClass("maximized");
      }
    });
  };
});
