ui({
  __name: "XelleLoaderMist",
  props: { progress: { type: Function, required: true } },
  setup(props) {
    // The loading screen: a drifting perfume mist condenses into the wordmark at
    // its own steady pace, while the real loading progress runs as a thin line
    // with a percentage below it. A pointer or finger stirs the mist; a click or
    // tap sprays it. The drawing runs in a worker when the browser can hand it the
    // canvas, so it stays fluid while the main thread builds the scenes.
    function engine(scope) {
      const tick = typeof requestAnimationFrame === "function" ? requestAnimationFrame : run => setTimeout(() => run(performance.now()), 16);
      const pointer = { x: -1e4, y: -1e4, t: 0 }, puffs = [], levels = [[], [], [], [], []];
      let canvas, context, logo, width = 0, height = 0, ratio = 1, touch = false, still = false;
      let particles = [], last = 0, start = 0, running = true, target = 0, shown = 0;
      const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      function layout() {
        if (!context) return;
        canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        if (!logo) return;
        const logoWidth = Math.min(560, width * 0.78), logoHeight = logoWidth * logo.height / logo.width;
        const w = Math.ceil(logoWidth), h = Math.ceil(logoHeight);
        const sample = typeof OffscreenCanvas === "function" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h });
        const pen = sample.getContext("2d", { willReadFrequently: true });
        pen.drawImage(logo, 0, 0, w, h);
        const pixels = pen.getImageData(0, 0, w, h).data;
        const step = logoWidth < 400 ? 1.5 : 2, left = (width - logoWidth) / 2, top = height * 0.5 - logoHeight / 2;
        const previous = particles;
        particles = [];
        for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
          if (pixels[(Math.floor(y) * w + Math.floor(x)) * 4 + 3] < 128) continue;
          const tx = left + x + (Math.random() - 0.5) * step, ty = top + y + (Math.random() - 0.5) * step;
          const old = previous[particles.length];
          particles.push({
            tx, ty,
            x: old ? old.x : tx + (Math.random() - 0.5) * Math.min(width, 900) * 0.7,
            y: old ? old.y : ty + (Math.random() - 0.5) * Math.min(height, 600) * 0.6,
            vx: old ? old.vx : 0, vy: old ? old.vy : 0, s: old ? old.s : 0,
            // Roughly left to right, so the word writes itself in.
            at: 0.55 * x / w + 0.45 * Math.random(),
            seed: Math.random() * 100,
          });
        }
      }

      function spray(x, y) {
        if (still) return;
        puffs.push({ x, y, t: performance.now() });
        for (const p of particles) {
          const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy) || 1;
          if (d > 170) continue;
          const kick = (1 - d / 170) * (420 + Math.random() * 380);
          p.vx += dx / d * kick; p.vy += dy / d * kick;
        }
      }

      function frame(now) {
        if (!running) return;
        tick(frame);
        const dt = Math.min((now - (last || now)) / 1000, 0.05);
        last = now;
        // The shown progress glides towards the reported one and never goes back.
        shown = Math.min(1, Math.max(shown, shown + (target - shown) * Math.min(1, dt * 2.5) + (target >= 1 ? dt * 0.6 : 0)));
        context.clearRect(0, 0, width, height);
        if (logo && start) {
          const form = still ? 1 : ease(Math.min(1, (now - start) / 2800)), time = now / 1000;
          for (let i = puffs.length - 1; i >= 0; i--) {
            const age = (now - puffs[i].t) / 900;
            if (age >= 1) { puffs.splice(i, 1); continue; }
            const radius = 30 + 150 * Math.sqrt(age), glow = context.createRadialGradient(puffs[i].x, puffs[i].y, 0, puffs[i].x, puffs[i].y, radius);
            glow.addColorStop(0, `rgba(247,240,230,${0.16 * (1 - age)})`);
            glow.addColorStop(1, "rgba(247,240,230,0)");
            context.fillStyle = glow;
            context.fillRect(puffs[i].x - radius, puffs[i].y - radius, radius * 2, radius * 2);
          }
          // A resting pointer lets the letters close again.
          const stir = Math.max(0, 1 - (now - pointer.t) / 500);
          for (const level of levels) level.length = 0;
          for (const p of particles) {
            if (form >= p.at) p.s = still ? 1 : Math.min(1, p.s + dt * 1.4);
            levels[Math.round(p.s * 4)].push(p);
            if (still) { p.x = p.tx; p.y = p.ty; continue; }
            // Loose, wandering mist that tightens into the letters as it settles.
            const s = p.s, t = time * 0.5 + p.seed, k = 0.8 + 29.2 * s, wander = 60 * (1 - s);
            const bx = p.tx + Math.sin(time * 1.3 + p.seed) * 0.4 * s, by = p.ty + Math.cos(time * 1.1 + p.seed) * 0.4 * s;
            let ax = (bx - p.x) * k + Math.sin(p.y * 0.01 + t) * wander;
            let ay = (by - p.y) * k + Math.cos(p.x * 0.01 + t * 0.8) * wander;
            const dx = p.x - pointer.x, dy = p.y - pointer.y, d2 = dx * dx + dy * dy, reach = touch ? 70 : 90;
            if (stir > 0 && d2 < reach * reach) {
              const d = Math.sqrt(d2) || 1, push = (1 - d / reach) * 2600 * stir;
              ax += dx / d * push; ay += dy / d * push;
            }
            const damping = Math.exp(-dt * (0.9 + 7.1 * s));
            p.vx = (p.vx + ax * dt) * damping; p.vy = (p.vy + ay * dt) * damping;
            p.x += p.vx * dt; p.y += p.vy * dt;
          }
          context.globalAlpha = still ? 1 : Math.min(1, (now - start) / 700);
          levels.forEach((level, index) => {
            const s = index / 4, size = 1.2 + ((touch ? 2 : 1.6) - 1.2) * s;
            context.fillStyle = `rgba(247,240,230,${0.35 + 0.6 * s})`;
            for (const p of level) context.fillRect(p.x - size / 2, p.y - size / 2, size, size);
          });
          context.globalAlpha = 1;
        }
        const barWidth = Math.min(220, width * 0.5), barX = (width - barWidth) / 2, barY = height - 92;
        context.fillStyle = "rgba(247,240,230,.18)";
        context.fillRect(barX, barY, barWidth, 1);
        context.fillStyle = "rgba(247,240,230,.85)";
        context.fillRect(barX, barY, barWidth * shown, 1);
        context.font = "11px Arial, sans-serif";
        context.textAlign = "center";
        context.fillStyle = "rgba(247,240,230,.6)";
        context.fillText(`${Math.floor(shown * 100)}%`, width / 2, barY - 10);
      }

      scope.onmessage = ({ data }) => {
        if (data.type === "init") {
          ({ canvas, width, height, ratio, touch, still } = data);
          context = canvas.getContext("2d");
          layout();
          fetch(data.logo).then(response => response.blob()).then(blob => createImageBitmap(blob)).then(bitmap => {
            logo = bitmap; layout(); start = performance.now();
          }, error => console.warn("[Xellé loader]", error));
          tick(frame);
        } else if (data.type === "resize") { ({ width, height, ratio } = data); layout(); }
        else if (data.type === "progress") target = data.value;
        else if (data.type === "pointer") Object.assign(pointer, { x: data.x, y: data.y, t: performance.now() });
        else if (data.type === "spray") { Object.assign(pointer, { x: data.x, y: data.y, t: performance.now() }); spray(data.x, data.y); }
        else if (data.type === "stop") running = false;
      };
    }

    const uiStore = no();
    const canvas = Pa(null);
    const touch = window.matchMedia("(pointer: coarse)").matches;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let worker = null, local = null, source = "", frame = 0, sent = -1, doneAt = 0;
    const post = (message, transfer) => worker ? worker.postMessage(message, transfer || []) : local && local.onmessage({ data: message });
    const size = () => ({ width: canvas.value.clientWidth, height: canvas.value.clientHeight, ratio: Math.min(window.devicePixelRatio || 1, 2) });

    function feed(now) {
      frame = requestAnimationFrame(feed);
      const value = uiStore.mainLoader.progressComplete ? 1 : props.progress();
      if (value !== sent) { sent = value; post({ type: "progress", value }); }
      if (uiStore.mainLoader.progressComplete) {
        doneAt = doneAt || now;
        if (now - doneAt > 1500) stop();
      }
    }
    const listeners = {
      pointermove: event => post({ type: "pointer", x: event.clientX, y: event.clientY }),
      pointerdown: event => post({ type: "spray", x: event.clientX, y: event.clientY }),
      pointerup: event => { if (event.pointerType !== "mouse") post({ type: "pointer", x: -1e4, y: -1e4 }); },
      pointercancel: () => post({ type: "pointer", x: -1e4, y: -1e4 }),
      pointerout: event => { if (!event.relatedTarget) post({ type: "pointer", x: -1e4, y: -1e4 }); },
      resize: () => post({ type: "resize", ...size() }),
    };
    function stop() {
      cancelAnimationFrame(frame);
      frame = 0;
      for (const name in listeners) window.removeEventListener(name, listeners[name]);
      post({ type: "stop" });
      if (worker) worker.terminate();
      if (source) URL.revokeObjectURL(source);
      worker = local = null;
    }

    Yi(() => {
      const init = { type: "init", touch, still, logo: new URL("/xelle/xelle-wordmark.png", window.location.href).href, ...size() };
      if (canvas.value.transferControlToOffscreen && typeof Worker === "function") {
        source = URL.createObjectURL(new Blob([`(${engine})(self)`], { type: "text/javascript" }));
        try { worker = new Worker(source); } catch (error) { console.warn("[Xellé loader] drawing on the main thread", error); }
      }
      if (worker) {
        const offscreen = canvas.value.transferControlToOffscreen();
        post({ ...init, canvas: offscreen }, [offscreen]);
      } else {
        local = {};
        engine(local);
        post({ ...init, canvas: canvas.value });
      }
      for (const name in listeners) window.addEventListener(name, listeners[name], { passive: true });
      frame = requestAnimationFrame(feed);
    });
    Ts(stop);
    return () => Na("canvas", { ref: canvas, class: "xelle-loader-mist", "aria-hidden": "true" });
  },
})
