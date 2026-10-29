/* Hero data field.
   A dense, quiet grid of market numbers behind the homepage headline. Columns
   keep their own format (price, percent, ratio, volume, delta), values refresh
   in a slow diagonal sweep, and a restrained lens follows the pointer: nearby
   cells brighten, shift a little and take the brand purple. The canvas is
   decorative, never receives pointer events, and is hidden from assistive
   technology. */
(function () {
  var canvas = document.querySelector("[data-number-field]");
  if (!canvas) return;

  var stage = canvas.parentElement;
  var ctx = canvas.getContext("2d");
  if (!ctx || !stage) return;

  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var CELL_W = 56;
  var CELL_H = 18;
  var SPOT_RADIUS = 190;
  var BAND_WIDTH = 150;
  var FONT = '8.5px ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

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

  var FORMATS = [
    { kind: "price" },
    { kind: "percent" },
    { kind: "ratio" },
    { kind: "volume" },
    { kind: "delta" },
    { kind: "price" },
    { kind: "percent" },
    { kind: "ratio" }
  ];

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function commas(value) {
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function value(format) {
    var n;
    if (format.kind === "price") {
      n = rand(8, 950);
      return n.toFixed(2);
    }
    if (format.kind === "percent") {
      n = rand(0.02, 3.4);
      return (Math.random() < 0.5 ? "+" : "-") + n.toFixed(2) + "%";
    }
    if (format.kind === "ratio") {
      n = rand(0.0001, 0.0999);
      return n.toFixed(4);
    }
    if (format.kind === "volume") {
      n = Math.round(rand(100, 12500));
      return commas(n);
    }
    n = rand(0.01, 95);
    return (Math.random() < 0.5 ? "+" : "-") + n.toFixed(2);
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
    var columnFormats = [];
    var columnOpacity = [];
    var hiddenColumns = [];

    for (var c = 0; c < cols; c++) {
      columnFormats[c] = FORMATS[Math.floor(Math.random() * FORMATS.length)];
      columnOpacity[c] = rand(0.55, 1);
      hiddenColumns[c] = Math.random() < 0.15;
    }

    cells = [];
    for (var row = 0; row < rows; row++) {
      for (var col = 0; col < cols; col++) {
        var hidden = hiddenColumns[col] || Math.random() < 0.07;
        var base = hidden
          ? rand(0.008, 0.026)
          : rand(0.035, 0.11) * columnOpacity[col];
        cells.push({
          x: col * CELL_W,
          y: row * CELL_H + CELL_H / 2,
          value: value(columnFormats[col]),
          format: columnFormats[col],
          base: base,
          hidden: hidden,
          depth: rand(0.5, 1.1),
          phase: rand(0, Math.PI * 2),
          speed: rand(0.05, 0.16),
          next: rand(0, 8),
          col: col
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
    var globalX = (mx / width - 0.5) * 10;
    var globalY = (my / height - 0.5) * 7;
    var sweepPos = ((time * 0.14) % 1.35) - 0.15;
    var sweepCoord = sweepPos * (height + width * 0.32);

    if (active > 0.01) {
      var aura = ctx.createRadialGradient(mx, my, 0, mx, my, 230);
      aura.addColorStop(0, "rgba(152,16,250," + (0.03 * active) + ")");
      aura.addColorStop(0.55, "rgba(152,16,250," + (0.012 * active) + ")");
      aura.addColorStop(1, "rgba(152,16,250,0)");
      ctx.fillStyle = aura;
      ctx.fillRect(0, 0, width, height);
    }

    ctx.textAlign = "right";

    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      var dx = cell.x - mx;
      var dy = cell.y - my;
      var d = Math.sqrt(dx * dx + dy * dy);
      var spot = active > 0.01
        ? Math.max(0, 1 - d / SPOT_RADIUS)
        : 0;
      spot = spot * spot * (3 - 2 * spot);
      var band = active > 0.01
        ? Math.exp(-Math.pow((cell.x - mx) / BAND_WIDTH, 2)) * 0.14
        : 0;
      var influence = Math.min(1, spot + band);
      var coord = cell.x * 0.32 + cell.y;
      var sweep = Math.exp(-Math.pow((coord - sweepCoord) / 24, 2));

      if ((sweep > 0.55 || influence > 0.58) && time > cell.next) {
        cell.value = value(cell.format);
        cell.next = time + (influence > 0.58
          ? 2.2 + Math.random() * 2.8
          : 5.5 + Math.random() * 5.5);
      }

      var colPhase = cell.col * 0.65;
      var x = cell.x +
        Math.sin(time * cell.speed + cell.phase) * 1.1 +
        Math.sin(time * 0.12 + colPhase) * 1.2 +
        globalX * cell.depth;
      var y = cell.y +
        Math.cos(time * cell.speed * 0.8 + cell.phase * 1.6) * 0.9 +
        Math.sin(time * 0.16 + colPhase) * 0.9 +
        globalY * cell.depth;

      if (active > 0.01 && d < 170) {
        var push = (1 - d / 170) * 3.2;
        x += (dx / (d || 1)) * push;
        y += (dy / (d || 1)) * push * 0.45;
      }

      var alpha = cell.base + influence * (0.6 - cell.base) + sweep * 0.045;
      if (cell.hidden && influence < 0.08) alpha *= 0.3;
      alpha = Math.max(0, Math.min(0.66, alpha));

      var p = Math.min(1, Math.pow(influence, 1.45));
      var red = Math.round(11 + (152 - 11) * p);
      var green = Math.round(14 + (16 - 14) * p);
      var blue = Math.round(23 + (250 - 23) * p);
      ctx.fillStyle = "rgba(" + red + "," + green + "," + blue + "," + alpha + ")";
      ctx.fillText(cell.value, x + CELL_W - 9, y);
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

  function setLens(x, y) {
    stage.style.setProperty("--mx", x + "px");
    stage.style.setProperty("--my", y + "px");
  }

  function clearLens() {
    stage.style.setProperty("--mx", "-999px");
    stage.style.setProperty("--my", "-999px");
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
      setLens(x, y);
    } else {
      pointer.active = false;
      clearLens();
    }
  }

  function onPointerLeave() {
    pointer.active = false;
    clearLens();
  }

  function onPointerEnd(event) {
    if (event.pointerType === "touch" || event.pointerType === "pen") {
      pointer.active = false;
      clearLens();
    }
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
  window.addEventListener("pointerup", onPointerEnd, { passive: true });
  window.addEventListener("pointercancel", onPointerEnd, { passive: true });
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
