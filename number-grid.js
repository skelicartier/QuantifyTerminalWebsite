/* Hero data field.
   A quiet grid of market numbers behind the homepage headline. The field
   drifts, occasionally reprices itself, and opens around the pointer: cells
   near the cursor brighten, shift aside and turn brand purple, while a soft
   column follows the pointer from left to right. It is decorative, so it
   never receives pointer events and is hidden from assistive technology. */
(function () {
  var canvas = document.querySelector("[data-number-field]");
  if (!canvas) return;

  var stage = canvas.parentElement;
  var ctx = canvas.getContext("2d");
  if (!ctx || !stage) return;

  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var CELL_W = 92;
  var CELL_H = 32;
  var SPOT_RADIUS = 210;
  var BAND_WIDTH = 145;
  var FONT = '10.5px ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

  var width = 0;
  var height = 0;
  var dpr = 1;
  var cells = [];
  var running = false;
  var raf = 0;
  var lastFrame = 0;
  var resizeFrame = 0;

  var pointer = { x: 0, y: 0, active: false };
  var smooth = { x: 0, y: 0, active: 1 };

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function value() {
    var kind = Math.random();
    if (kind < 0.3) return (Math.random() * 900 + 10).toFixed(2);
    if (kind < 0.52) {
      return (Math.random() < 0.5 ? "+" : "-") +
        (Math.random() * 3.5).toFixed(2) + "%";
    }
    if (kind < 0.68) return (Math.random() * 9 + 0.1).toFixed(2);
    if (kind < 0.82) {
      return (Math.random() * 12000 + 100)
        .toFixed(0)
        .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
    if (kind < 0.92) return (Math.random() * 0.09).toFixed(4);
    return (Math.random() < 0.5 ? "+" : "-") +
      (Math.random() * 120).toFixed(2);
  }

  function build() {
    var rect = stage.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = FONT;
    ctx.textBaseline = "middle";

    var cols = Math.ceil(width / CELL_W) + 1;
    var rows = Math.ceil(height / CELL_H) + 1;
    cells = [];

    for (var row = 0; row < rows; row++) {
      for (var col = 0; col < cols; col++) {
        var hidden = Math.random() < 0.24;
        cells.push({
          x: col * CELL_W + rand(-4, 4),
          y: row * CELL_H + CELL_H / 2 + rand(-3, 3),
          value: value(),
          base: hidden ? rand(0.015, 0.055) : rand(0.07, 0.24),
          hidden: hidden,
          depth: rand(0.45, 1.15),
          phase: rand(0, Math.PI * 2),
          speed: rand(0.08, 0.22),
          next: rand(0, 7)
        });
      }
    }

    if (smooth.x === 0 && smooth.y === 0) {
      smooth.x = width * 0.68;
      smooth.y = height * 0.38;
    }
  }

  function update(now) {
    var targetX = pointer.active ? pointer.x : width * 0.5;
    var targetY = pointer.active ? pointer.y : height * 0.45;
    smooth.x += (targetX - smooth.x) * 0.11;
    smooth.y += (targetY - smooth.y) * 0.11;
    smooth.active += ((pointer.active ? 1 : 0) - smooth.active) * 0.07;

    var time = now / 1000;
    var mx = smooth.x;
    var my = smooth.y;
    var active = smooth.active;
    var globalX = (mx / width - 0.5) * 16;
    var globalY = (my / height - 0.5) * 11;

    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      var d = Math.sqrt(
        (cell.x - mx) * (cell.x - mx) + (cell.y - my) * (cell.y - my)
      );
      var spot = active > 0.01
        ? Math.max(0, 1 - d / SPOT_RADIUS)
        : 0;
      spot = spot * spot * (3 - 2 * spot);
      var band = active > 0.01
        ? Math.exp(-Math.pow((cell.x - mx) / BAND_WIDTH, 2)) * 0.2
        : 0;
      var influence = Math.min(1, spot + band);

      if (time > cell.next) {
        cell.value = value();
        cell.next = time + 1.8 + Math.random() * 5.2 +
          (1 - influence) * 3.2;
      }

      var x = cell.x + Math.sin(time * cell.speed + cell.phase) * 3 +
        globalX * cell.depth;
      var y = cell.y + Math.cos(time * cell.speed * 0.8 + cell.phase * 1.7) * 2 +
        globalY * cell.depth;

      if (active > 0.01 && d < 190) {
        var push = (1 - d / 190) * 8;
        x += ((cell.x - mx) / (d || 1)) * push * 1.4;
        y += ((cell.y - my) / (d || 1)) * push * 0.55;
      }

      var alpha = cell.base + influence * (0.86 - cell.base);
      if (cell.hidden && influence < 0.1) alpha *= 0.55;
      alpha = Math.max(0, Math.min(0.9, alpha));

      var p = Math.min(1, influence * 1.35);
      var red = Math.round(11 + (152 - 11) * p);
      var green = Math.round(14 + (16 - 14) * p);
      var blue = Math.round(23 + (250 - 23) * p);
      ctx.fillStyle = "rgba(" + red + "," + green + "," + blue + "," + alpha + ")";
      ctx.fillText(cell.value, x, y);
    }
  }

  function draw(now) {
    ctx.clearRect(0, 0, width, height);
    if (!cells.length) return;
    update(now);
  }

  function frame(now) {
    if (!running) return;
    if (!lastFrame || now - lastFrame >= 1000 / 45) {
      draw(now);
      lastFrame = now;
    }
    raf = window.requestAnimationFrame(frame);
  }

  function start() {
    if (running || reduceMotion) return;
    var now = performance.now() / 1000;
    for (var i = 0; i < cells.length; i++) {
      if (cells[i].next < now) {
        cells[i].next = now + rand(0.4, 6);
      }
    }
    running = true;
    lastFrame = 0;
    raf = window.requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (raf) window.cancelAnimationFrame(raf);
    raf = 0;
  }

  function onPointerMove(event) {
    var rect = stage.getBoundingClientRect();
    var x = event.clientX - rect.left;
    var y = event.clientY - rect.top;
    if (x >= -80 && x <= rect.width + 80 &&
        y >= -80 && y <= rect.height + 80) {
      pointer.x = x;
      pointer.y = y;
      pointer.active = true;
    } else {
      pointer.active = false;
    }
  }

  function onPointerLeave() {
    pointer.active = false;
  }

  function onVisibilityChange() {
    if (document.hidden) stop();
    else if (visible) start();
  }

  var visible = true;

  build();

  if (reduceMotion) {
    smooth.active = 0;
    draw(0);
    return;
  }

  draw(0);
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("blur", onPointerLeave);
  document.documentElement.addEventListener("pointerleave", onPointerLeave);
  document.addEventListener("visibilitychange", onVisibilityChange);

  if ("ResizeObserver" in window) {
    var observer = new ResizeObserver(function () {
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(function () {
        build();
        draw(performance.now());
      });
    });
    observer.observe(stage);
  } else {
    window.addEventListener("resize", function () {
      build();
      draw(performance.now());
    });
  }

  if ("IntersectionObserver" in window) {
    var seen = new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible && !document.hidden) start();
      else stop();
    }, { threshold: 0.01 });
    seen.observe(stage);
    start();
  } else {
    start();
  }
})();
