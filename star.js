(() => {
    const D = window.PORTFOLIO || {};
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const TAU = Math.PI * 2;
    const $ = id => document.getElementById(id);
    const h = (tag, cls, text) => {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text != null) e.textContent = text;
        return e;
    };

    const canvas = $("sky"), ctx = canvas.getContext("2d");
    const flashEl = $("flash"), panel = $("panel"), hud = $("hud");
    const planetsEl = $("planets"), signalsEl = $("signals"), starBtn = $("starbtn");
    const modal = $("modal"), mbody = $("mbody"), mclose = $("mclose"), toastEl = $("toast");
    const planets = D.planets || [];
    const log = D.flightLog || [];
    const signalsData = D.signals || [];

    /* ---------- The six stages ----------
       log: which Flight Log entries (by position in Index.cshtml.cs) show up at that stage */
    const STAGES = [
        { name: "Molecular Cloud", age: "0 yr", temp: "10 K", log: [0, 1],
            blurb: "Somewhere in the dark, a vast cold cloud of gas and dust drifts. Nothing has started yet, but everything is possible.",
            p: { S: 1.0, F: 1.0, spin: 0.03, conc: 1.35, core: 0, heat: 0, alpha: 0.5, cloud: 1, rays: 0, orbit: 0 } },
        { name: "Gravitational Collapse", age: "~100,000 yr", temp: "100 K", log: [2],
            blurb: "Gravity wins. The cloud starts to contract and spin, and gas streams inward.",
            p: { S: 0.8, F: 0.8, spin: 0.08, conc: 1.8, core: 0.02, heat: 0.05, alpha: 0.62, cloud: 0.9, rays: 0, orbit: 0 } },
        { name: "Protostar", age: "~500,000 yr", temp: "10,000 K", log: [3],
            blurb: "A hot, dense core glows inside the dust. It isn't a star yet, but it's heading there.",
            p: { S: 0.62, F: 0.55, spin: 0.14, conc: 2.2, core: 0.05, heat: 0.25, alpha: 0.75, cloud: 0.7, rays: 0, orbit: 0 } },
        { name: "Accretion Disk", age: "~1 million yr", temp: "1,000,000 K", log: [4, 5],
            blurb: "A spinning disk feeds the core. This is the stage where the most material gets gathered.",
            p: { S: 0.6, F: 0.28, spin: 0.22, conc: 1.9, core: 0.075, heat: 0.5, alpha: 0.85, cloud: 0.5, rays: 0.2, orbit: 0 } },
        { name: "Ignition", age: "~10 million yr", temp: "10,000,000 K", log: [6],
            blurb: "The core reaches the temperature where hydrogen fusion begins. The star switches on and blows the dust away.",
            p: { S: 1.05, F: 0.5, spin: 0.14, conc: 1.5, core: 0.12, heat: 1, alpha: 0.3, cloud: 0.15, rays: 1, orbit: 0 } },
        { name: "Planetary System", age: "~50 million yr", temp: "15,000,000 K", log: [7],
            blurb: "Planets condensed from the leftover disk. These are my projects. Click a planet for its report, or the star for its spectrum.",
            p: { S: 0.7, F: 0.36, spin: 0.09, conc: 1.4, core: 0.1, heat: 0.85, alpha: 0.22, cloud: 0.1, rays: 0.8, orbit: 1 } }
    ];
    const LAST = STAGES.length - 1;
    const ORB_F = 0.36;

    /* ---------- Colors ---------- */
    const STOPS = [[0, [110, 70, 200]], [0.25, [255, 95, 60]], [0.5, [255, 165, 80]], [0.75, [255, 220, 160]], [1, [255, 240, 215]]];
    function heatColor(v) {
        v = Math.max(0, Math.min(1, v));
        for (let i = 1; i < STOPS.length; i++) {
            if (v <= STOPS[i][0]) {
                const [a, ca] = STOPS[i - 1], [b, cb] = STOPS[i];
                const t = (v - a) / (b - a);
                return [ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t];
            }
        }
        return STOPS[STOPS.length - 1][1];
    }
    const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
    const COOL = [[205, 170, 255], [180, 165, 255], [150, 170, 255], [125, 190, 255], [110, 215, 250], [125, 235, 235]];

    /* ---------- Planets (projects) ---------- */
    const SKINS = ["ringed", "ocean", "gas", "violet", "golden", "rocky"];
    const BASE = [64, 50, 56, 52, 48, 44];
    const planetEls = [], skinEls = [], orbits = [];
    let hoverIdx = -1;
    const visited = new Set();

    planets.forEach((p, i) => {
        const skin = SKINS[i % SKINS.length];
        const el = h("button", "pl " + skin);
        el.type = "button";
        el.setAttribute("aria-label", "Open mission report: " + p.name);
        const sk = h("span", "skin");
        el.append(sk, h("span", "bname", p.name.split(":")[0]));
        el.addEventListener("pointerenter", () => { hoverIdx = i; });
        el.addEventListener("pointerleave", () => { hoverIdx = -1; });
        el.addEventListener("focus", () => { hoverIdx = i; });
        el.addEventListener("blur", () => { hoverIdx = -1; });
        el.addEventListener("click", () => openReport(i));
        planetsEl.append(el);
        planetEls.push(el);
        skinEls.push(sk);
        const n = planets.length;
        const a = 0.22 + (n > 1 ? i * 0.5 / (n - 1) : 0);
        orbits.push({ a, w: 0.16 * Math.pow(0.22 / a, 1.5), phi: 0.6 + i * 2.4 });
    });

    /* ---------- Hidden signals ---------- */
    const SIG_POS = [[8, 22], [92, 26], [10, 46], [90, 48], [26, 34], [74, 36], [6, 60]];
    const found = new Set();
    signalsData.forEach((text, i) => {
        const b = h("button", "sig");
        b.type = "button";
        b.setAttribute("aria-label", "Faint signal");
        const [x, y] = SIG_POS[i % SIG_POS.length];
        b.style.left = x + "%";
        b.style.top = y + "%";
        b.addEventListener("click", () => {
            found.add(i);
            b.classList.add("found");
            toast("\uD83D\uDCE1 Signal decoded: " + text);
            updateHud();
        });
        signalsEl.append(b);
    });

    /* ---------- State ---------- */
    let cur = 0;
    let T = Object.assign({}, STAGES[0].p);
    const P = Object.assign({}, STAGES[0].p);
    let W = 0, H = 0, cx = 0, cy = 0, maxR = 0, unit = 1, orbX = 1.35, dpr = 1;
    let groups = [], bg = [], blobs = [];
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    let time = 0, last = performance.now(), flashAmt = 0, ring = -1;

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = window.innerWidth; H = window.innerHeight;
        canvas.width = W * dpr; canvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const portrait = W < 700;
        maxR = Math.min(W, H) * (portrait ? 0.5 : 0.46);
        cx = W / 2;
        cy = H * (portrait ? 0.38 : 0.40);
        orbX = portrait ? 1.2 : 1.35;
        unit = Math.max(0.6, Math.min(1.15, Math.min(W, H) / 820));
        planetEls.forEach((el, i) => el.style.setProperty("--s", Math.round(BASE[i % BASE.length] * unit) + "px"));
        if (!bg.length) {
            for (let i = 0; i < 220; i++) bg.push({ x: Math.random(), y: Math.random(), z: 0.3 + Math.random() * 0.9, tw: 0.5 + Math.random() * 1.5, ph: Math.random() * TAU });
        }
    }
    function build() {
        const N = W < 700 ? 800 : 1500;
        groups = [[], [], [], [], [], []];
        for (let i = 0; i < N; i++) {
            const p = { u: Math.random(), th: Math.random() * TAU, ph: Math.random() * TAU, s: 0.6 + Math.random() * 1.1 };
            groups[Math.min(5, Math.floor(p.u * 6))].push(p);
        }
        const hues = [270, 220, 190, 300];
        blobs = [];
        for (let i = 0; i < 9; i++) blobs.push({ a: Math.random() * TAU, d: 0.15 + Math.random() * 0.6, sz: 0.25 + Math.random() * 0.35, h: hues[i % 4] });
    }
    resize();
    build();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", e => { mouse.tx = e.clientX / W - 0.5; mouse.ty = e.clientY / H - 0.5; });

    /* ---------- Drawing helpers ---------- */
    function glow(x, y, r, c, a) {
        const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, rgba(c, a));
        gr.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = gr;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    function frame(now) {
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        time += dt;
        const spinDt = reduce ? 0 : dt;
        const k = reduce ? 1 : 1 - Math.exp(-dt * 1.6);
        for (const key in T) P[key] += (T[key] - P[key]) * k;
        mouse.x += (mouse.tx - mouse.x) * 0.05;
        mouse.y += (mouse.ty - mouse.y) * 0.05;
        flashAmt = Math.max(0, flashAmt - dt * 0.6);

        ctx.globalCompositeOperation = "source-over";
        ctx.clearRect(0, 0, W, H);

        // background stars
        ctx.fillStyle = "#fff";
        for (const s of bg) {
            const x = (((s.x * W - mouse.x * 30 * s.z) % W) + W) % W;
            const y = (((s.y * H - mouse.y * 20 * s.z) % H) + H) % H;
            ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(time * s.tw + s.ph));
            ctx.fillRect(x, y, s.z * 1.8, s.z * 1.8);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "lighter";

        const X = 1 + (1 - P.F) * 0.8;
        const hc = heatColor(P.heat);

        // dust cloud blobs
        for (const b of blobs) {
            const ang = b.a + time * 0.02 / (0.3 + b.d);
            const bx = cx + Math.cos(ang) * b.d * P.S * maxR * X;
            const by = cy + Math.sin(ang) * b.d * P.S * maxR * P.F;
            const br = b.sz * maxR * (0.6 + 0.4 * P.S);
            const hue = b.h + (25 - b.h) * Math.min(1, P.heat * 0.9);
            const al = 0.085 * P.cloud;
            const gr = ctx.createRadialGradient(bx, by, 0, bx, by, br);
            gr.addColorStop(0, `hsla(${hue},80%,60%,${al})`);
            gr.addColorStop(1, `hsla(${hue},80%,40%,0)`);
            ctx.fillStyle = gr;
            ctx.fillRect(bx - br, by - br, br * 2, br * 2);
        }

        // gas and dust particles
        for (let g = 0; g < 6; g++) {
            const m = Math.min(1, P.heat * (1.6 - g * 0.22));
            const c = mixc(COOL[g], hc, m);
            const a = Math.min(1, P.alpha * (0.5 + 0.5 * (1 - g / 5)));
            ctx.fillStyle = rgba(c, a);
            ctx.beginPath();
            const grp = groups[g];
            for (let i = 0; i < grp.length; i++) {
                const p = grp[i];
                const rn = Math.pow(p.u, P.conc) * P.S;
                p.th += spinDt * P.spin * (0.25 + 0.9 / (0.2 + rn));
                const rr = rn * maxR;
                const wob = Math.sin(time * 0.6 + p.ph) * 3;
                const x = cx + Math.cos(p.th) * (rr * X + wob);
                const y = cy + Math.sin(p.th) * (rr + wob) * P.F;
                const s = p.s * (0.75 + 0.6 * (1 - Math.min(rn, 1)));
                ctx.moveTo(x + s, y);
                ctx.arc(x, y, s, 0, TAU);
            }
            ctx.fill();
        }

        // orbit paths
        const o = P.orbit;
        if (o > 0.03) {
            ctx.setLineDash([3, 7]);
            ctx.lineWidth = 1;
            ctx.strokeStyle = `rgba(150,160,255,${0.22 * o})`;
            orbits.forEach(od => {
                const rx = od.a * maxR * orbX * o;
                ctx.beginPath();
                ctx.ellipse(cx, cy, rx, rx * ORB_F, 0, 0, TAU);
                ctx.stroke();
            });
            ctx.setLineDash([]);
        }

        // the star itself
        const coreR = P.core * maxR;
        if (coreR > 1.5) {
            const pulse = 1 + Math.sin(time * 2.1) * 0.035 * P.heat + Math.sin(time * 5.3) * 0.015 * P.heat;
            const R = coreR * pulse;
            glow(cx, cy, R * (6 + 6 * flashAmt), hc, 0.16 + 0.35 * flashAmt);
            glow(cx, cy, R * 2.6, hc, 0.38);
            if (P.rays > 0.03) {
                ctx.lineCap = "round";
                for (let i = 0; i < 12; i++) {
                    const a = time * 0.06 + i * (TAU / 12) + Math.sin(i * 3.1) * 0.25;
                    const len = R * (3.5 + 3.5 * Math.abs(Math.sin(time * 0.7 + i * 1.7))) * P.rays;
                    const ex = cx + Math.cos(a) * len, ey = cy + Math.sin(a) * len;
                    const gr = ctx.createLinearGradient(cx, cy, ex, ey);
                    gr.addColorStop(0, rgba(hc, 0.5));
                    gr.addColorStop(1, rgba(hc, 0));
                    ctx.strokeStyle = gr;
                    ctx.lineWidth = Math.max(1.5, R * 0.1);
                    ctx.beginPath();
                    ctx.moveTo(cx, cy);
                    ctx.lineTo(ex, ey);
                    ctx.stroke();
                }
            }
            glow(cx, cy, R * 1.25, mixc(hc, [255, 255, 255], 0.55), 0.95);
            glow(cx, cy, R * 0.7, [255, 255, 255], 1);
        }

        // ignition shockwave
        if (ring >= 0) {
            ring += dt * 0.5;
            if (ring > 1) {
                ring = -1;
            } else {
                ctx.strokeStyle = `rgba(255,214,160,${(1 - ring) * 0.55})`;
                ctx.lineWidth = 2 + (1 - ring) * 10;
                ctx.beginPath();
                ctx.arc(cx, cy, ring * maxR * 1.6, 0, TAU);
                ctx.stroke();
            }
        }
        ctx.globalCompositeOperation = "source-over";

        // planets follow their orbits
        const starR = coreR;
        planetEls.forEach((el, i) => {
            const od = orbits[i];
            if (i !== hoverIdx) od.phi += spinDt * od.w;
            const rx = od.a * maxR * orbX * o;
            const x = cx + Math.cos(od.phi) * rx;
            const y = cy + Math.sin(od.phi) * rx * ORB_F;
            const depth = Math.sin(od.phi);
            const sc = (0.8 + 0.3 * (depth * 0.5 + 0.5)) * (0.35 + 0.65 * o);
            let op = Math.min(1, o * 1.6);
            if (depth < 0) op *= Math.min(1, Math.max(0, (Math.abs(x - cx) - starR * 0.5) / (starR * 0.9 + 1)));
            el.style.opacity = op.toFixed(3);
            el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${sc.toFixed(3)})`;
        });

        if (cur === LAST) {
            const sz = Math.max(70, starR * 2.8);
            starBtn.style.left = cx + "px";
            starBtn.style.top = cy + "px";
            starBtn.style.width = sz + "px";
            starBtn.style.height = sz + "px";
        }
        requestAnimationFrame(frame);
    }

    /* ---------- Ignition ---------- */
    function ignite() {
        ring = 0;
        flashAmt = 1;
        flashEl.classList.remove("go");
        void flashEl.offsetWidth;
        flashEl.classList.add("go");
    }

    /* ---------- Words that fade in one at a time ---------- */
    function words(el, text, start, step) {
        text.split(" ").forEach((w, i) => {
            const sp = h("span", "w", w);
            sp.style.animationDelay = (start + i * step) + "ms";
            el.append(sp, " ");
        });
        return el;
    }
    function rise(el, delay) {
        el.classList.add("rise");
        el.style.animationDelay = delay + "ms";
        return el;
    }

    /* ---------- Scroll drives the stages ---------- */
    const dotsEl = h("div");
    dotsEl.id = "dots";
    document.body.append(dotsEl);

    const track = h("div");
    track.id = "track";
    document.body.append(track);
    const topEl = $("top");
    let introState = true;
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";

    // one extra screen at the start for the intro
    function sizeTrack() { track.style.height = (STAGES.length + 1) * window.innerHeight + "px"; }
    function maxScroll() { return Math.max(1, document.documentElement.scrollHeight - window.innerHeight); }

    function setStage(i) {
        if (i === cur) return;
        const prev = cur;
        cur = i;
        if (i >= 4 && prev < 4) ignite();
        const final = i === LAST;
        document.body.classList.toggle("born", i >= 4);
        planetEls.forEach((el, k) => {
            skinEls[k].style.transitionDelay = final ? (500 + k * 250) + "ms" : "0ms";
            el.classList.toggle("show", final);
        });
        signalsEl.classList.toggle("on", final);
        starBtn.classList.toggle("show", final);
        renderPanel();
        updateHud();
    }

    function onScroll() {
        const s = window.scrollY / maxScroll() * (LAST + 1);   // 0 to 6, and the first screen is the intro
        const f = Math.max(0, Math.min(LAST, s - 1));
        const a = Math.min(LAST - 1, Math.floor(f));
        const t = f - a;
        for (const key in T) {
            T[key] = STAGES[a].p[key] + (STAGES[a + 1].p[key] - STAGES[a].p[key]) * t;
        }

        // intro fades out as you scroll, and the sky brightens
        const fade = Math.max(0, Math.min(1, 1 - s / 0.75));
        topEl.style.opacity = fade.toFixed(3);
        topEl.style.transform = `translateY(${(-s * 50).toFixed(1)}px)`;
        canvas.style.opacity = (0.4 + 0.6 * Math.min(1, s)).toFixed(3);

        const inIntro = s < 0.8;
        if (introState && !inIntro && cur === 0) renderPanel();   // replays the words when the story begins
        introState = inIntro;
        document.body.classList.toggle("intro", inIntro);

        setStage(Math.min(LAST, Math.round(f)));
    }

    // dots and arrow keys scroll to the right spot
    function goTo(i) {
        i = Math.max(0, Math.min(LAST, i));
        window.scrollTo({ top: (i + 1) / (LAST + 1) * maxScroll(), behavior: reduce ? "auto" : "smooth" });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", () => { sizeTrack(); onScroll(); });
    sizeTrack();
    window.scrollTo(0, 0);
    onScroll();

    /* ---------- Story text: floats over the animation ---------- */
    function renderPanel() {
        const s = STAGES[cur], isLast = cur === LAST;
        panel.replaceChildren();

        panel.append(rise(h("span", "mono tag", `STAGE 0${cur + 1} / 0${STAGES.length}`), 0));
        panel.append(words(h("h2"), s.name, 150, 120));
        panel.append(words(h("p"), s.blurb, 500, 45));

        let t = 500 + s.blurb.split(" ").length * 45 + 250;

        const items = s.log.map(i => log[i]).filter(Boolean);
        if (items.length) {
            const ul = h("ul", "log");
            items.forEach(m => {
                const li = h("li");
                li.append(h("span", "mono yr", m.year), h("b", null, m.title + ". "), h("span", "d", m.detail));
                ul.append(rise(li, t));
                t += 350;
            });
            panel.append(ul);
        }

        if (isLast) {
            const act = h("div", "actions");
            const mk = (label, fn, ghost) => {
                const b = h("button", "btn" + (ghost ? " ghost" : ""), label);
                b.type = "button";
                b.onclick = fn;
                act.append(b);
            };
            mk("Mission briefing", openBriefing, false);
            mk("Read my spectrum", openSpectrum, true);
            mk("Send a signal", openContact, true);
            panel.append(rise(act, t));
        }

        // stage dots on the right edge
        dotsEl.replaceChildren();
        STAGES.forEach((st, i) => {
            const d = h("button", "dot" + (i === cur ? " on" : i < cur ? " done" : ""));
            d.type = "button";
            d.setAttribute("aria-label", `Go to stage ${i + 1}: ${st.name}`);
            d.onclick = () => goTo(i);
            dotsEl.append(d);
        });
    }

    function updateHud() {
        const s = STAGES[cur];
        hud.replaceChildren();
        const add = (label, value) => {
            const sp = h("span");
            sp.append(label + " ", h("b", null, value));
            hud.append(sp);
        };
        add("STAGE", `${cur + 1}/${STAGES.length}`);
        add("AGE", s.age);
        add("CORE", s.temp);
        if (cur === LAST) {
            add("EXPLORED", `${visited.size}/${planets.length}`);
            add("SIGNALS", `${found.size}/${signalsData.length}`);
        }
    }

    /* ---------- Modal, reports, spectrum, contact ---------- */
    function openModal(node) {
        mbody.replaceChildren(node);
        modal.hidden = false;
        document.documentElement.style.overflow = "hidden";   // stop the page scrolling behind the popup
        mclose.focus();
    }
    function closeModal() {
        modal.hidden = true;
        document.documentElement.style.overflow = "";
    }
    mclose.addEventListener("click", closeModal);
    modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });

    let toastT;
    function toast(msg) {
        toastEl.textContent = msg;
        toastEl.classList.add("show");
        clearTimeout(toastT);
        toastT = setTimeout(() => toastEl.classList.remove("show"), 5200);
    }

    function openBriefing() {
        const box = h("div");
        box.append(h("span", "mono tag", "MISSION BRIEFING"), h("h2", null, D.name || "About me"));
        if (D.briefing) box.append(h("p", null, D.briefing));
        if (D.mission) {
            const m = h("div", "mission");
            m.append(h("span", "mono label", "CURRENT MISSION"), h("div", null, D.mission));
            box.append(m);
        }
        openModal(box);
    }

    function openReport(i) {
        const p = planets[i];
        const box = h("div");
        box.append(h("span", "mono tag", "MISSION REPORT"), h("h2", null, p.name));
        [["PROBLEM", p.problem], ["APPROACH", p.approach], ["RESULT", p.result]].forEach(([label, text]) => {
            const row = h("div", "row");
            row.append(h("span", "mono label", label), h("p", null, text));
            box.append(row);
        });
        if (p.tech) box.append(h("p", "mono label", p.tech));
        if (p.link) {
            const a = h("a", "btn", "View on GitHub");
            a.href = p.link;
            a.target = "_blank";
            a.rel = "noopener";
            box.append(a);
        }
        openModal(box);
        visited.add(i);
        planetEls[i].classList.add("visited");
        updateHud();
        if (visited.size === planets.length) setTimeout(() => toast("\uD83D\uDE80 Every planet surveyed. Mission complete!"), 600);
    }

    function openSpectrum() {
        const skills = D.skills || [];
        const box = h("div");
        box.append(
            h("span", "mono tag", "STELLAR SPECTRUM"),
            h("h2", null, "What this star is made of"),
            h("p", null, "Astronomers read a star's composition from the dark lines in its light. Hover or tap a line to see what mine are made of.")
        );
        const spec = h("div", "spectrum");
        const readout = h("div", "readout mono", "\u2192 pick a line");
        const chips = h("div", "chips");
        const lines = [], chipEls = [];
        skills.forEach((s, i) => {
            const ln = h("button", "line");
            ln.type = "button";
            ln.style.left = (4 + 92 * ((i * 0.618034 + 0.13) % 1)).toFixed(1) + "%";
            ln.setAttribute("aria-label", s);
            const chip = h("span", "chip", s);
            const on = () => {
                readout.textContent = "\u25B6 " + s;
                lines.forEach(x => x.classList.remove("on"));
                chipEls.forEach(x => x.classList.remove("on"));
                ln.classList.add("on");
                chip.classList.add("on");
            };
            ["pointerenter", "focus", "click"].forEach(ev => ln.addEventListener(ev, on));
            chip.addEventListener("pointerenter", on);
            lines.push(ln);
            chipEls.push(chip);
            spec.append(ln);
            chips.append(chip);
        });
        box.append(spec, readout, chips);
        openModal(box);
    }
    function openContact() {
        const first = (D.name || "").split(" ")[0] || "there";
        const to = D.email || "";
        const reasons = [
            { label: "Opportunity", subject: "An opportunity for you", line: "I'd like to talk to you about an opportunity." },
            { label: "Collaborate", subject: "Let's collaborate", line: "I'd love to collaborate on something with you." },
            { label: "Feedback", subject: "Feedback on your portfolio", line: "I wanted to share some feedback on your portfolio." },
            { label: "Just saying hi", subject: "Hello from your portfolio", line: "I just wanted to say hello." }
        ];
        let reason = 0;

        const box = h("div");
        box.append(
            h("span", "mono tag", "TRANSMISSION"),
            h("h2", null, "Send a signal"),
            h("p", null, "Pick a topic and add your comments. Your email app opens with the message ready to send.")
        );

        // topic chips
        const topics = h("div", "chips");
        const topicEls = reasons.map((r, i) => {
            const b = h("button", "chip pick" + (i === 0 ? " on" : ""), r.label);
            b.type = "button";
            b.onclick = () => {
                reason = i;
                topicEls.forEach((x, k) => x.classList.toggle("on", k === i));
                update();
            };
            topics.append(b);
            return b;
        });

        const nameIn = h("input", "field");
        nameIn.type = "text";
        nameIn.placeholder = "Your name";
        nameIn.autocomplete = "name";
        nameIn.setAttribute("aria-label", "Your name");

        const msg = h("textarea", "field");
        msg.rows = 4;
        msg.placeholder = "Your comments: what would you like to say?";
        msg.setAttribute("aria-label", "Your comments");

        const preview = h("div", "draft mono");
        preview.setAttribute("aria-label", "Email draft preview");

        function draft() {
            const r = reasons[reason];
            const name = nameIn.value.trim();
            const comments = msg.value.trim();
            const body = [
                `Hi ${first},`,
                "",
                `I found your portfolio and enjoyed watching the star form. ${r.line}`,
                "",
                comments || "[Write your comments here]",
                "",
                "Best regards,",
                name || "[Your name]"
            ].join("\r\n");
            return { subject: r.subject, body };
        }

        const mailA = h("a", "btn", "Open in my email app");
        const gmailA = h("a", "btn ghost", "Gmail");
        const outA = h("a", "btn ghost", "Outlook");
        [gmailA, outA].forEach(a => { a.target = "_blank"; a.rel = "noopener"; });
        const copyB = h("button", "btn ghost", "Copy draft");
        copyB.type = "button";

        function update() {
            const { subject, body } = draft();
            const q = encodeURIComponent;
            mailA.href = `mailto:${to}?subject=${q(subject)}&body=${q(body)}`;
            gmailA.href = `https://mail.google.com/mail/?view=cm&fs=1&to=${q(to)}&su=${q(subject)}&body=${q(body)}`;
            outA.href = `https://outlook.office.com/mail/deeplink/compose?to=${q(to)}&subject=${q(subject)}&body=${q(body)}`;
            preview.replaceChildren();
            const line = (label, text) => {
                const d = h("div");
                d.append(h("b", null, label + " "), text);
                preview.append(d);
            };
            line("To:", to);
            line("Subject:", subject);
            preview.append(h("div", null, "\u00A0"));
            body.split("\r\n").forEach(t => preview.append(h("div", null, t || "\u00A0")));
        }
        copyB.onclick = async () => {
            const { subject, body } = draft();
            const text = `To: ${to}\nSubject: ${subject}\n\n${body.replace(/\r\n/g, "\n")}`;
            try {
                await navigator.clipboard.writeText(text);
                toast("\u2709\uFE0F Draft copied. Paste it into any email.");
            } catch (e) {
                toast("Couldn't copy automatically. Please select the draft text and copy it.");
            }
        };
        nameIn.addEventListener("input", update);
        msg.addEventListener("input", update);

        const act = h("div", "actions");
        if (to) act.append(mailA, gmailA, outA, copyB);

        const links = h("div", "links mono");
        [["LinkedIn", D.linkedin], ["GitHub", D.github]].forEach(([label, href]) => {
            if (!href) return;
            const a = h("a", null, label + " \u2197");
            a.href = href;
            a.target = "_blank";
            a.rel = "noopener";
            links.append(a);
        });

        box.append(h("span", "mono label", "TOPIC"), topics, nameIn, msg,
            h("span", "mono label", "YOUR DRAFT"), preview, act, links);
        update();
        openModal(box);
        msg.focus();
    }


    starBtn.addEventListener("click", openSpectrum);
    window.addEventListener("keydown", e => {
        if (e.key === "Escape") { closeModal(); return; }
        if (!modal.hidden) return;
        if (e.key === "ArrowRight") { e.preventDefault(); goTo(cur + 1); }
        if (e.key === "ArrowLeft") { e.preventDefault(); goTo(cur - 1); }
    });

    /* ---------- Terminal intro ---------- */
    (function terminal() {
        const term = $("term");
        if (!term) return;

        // Your title is split on "·" into separate sentences, then these are added.
        // Edit, add, or remove lines here however you like.
        const fromTitle = (term.dataset.lines || "")
            .split(/\s*[\u00B7|]\s*/)
            .map(s => s.trim())
            .filter(Boolean);
        const extras = [
            "Building Stellar Canvas",
            "Exploring .NET"
        ];
        const phrases = ["whoami", ...fromTitle, ...extras];

        const LOOP = true; // true = repeats forever, false = stops on the last sentence

        const row = h("div", "term-line cmd");
        const prefix = h("span", "prefix", "> ");
        const txt = h("span");
        const caret = h("span", "caret");
        row.append(prefix, txt, caret);
        term.append(row);

        if (reduce) {
            txt.textContent = phrases[1] || phrases[0];
            return;
        }

        let p = 0, i = 0, deleting = false;

        function tick() {
            const word = phrases[p];
            if (!deleting) {
                txt.textContent = word.slice(0, ++i);
                if (i === word.length) {
                    if (!LOOP && p === phrases.length - 1) return;   // stay on the last one
                    deleting = true;
                    return setTimeout(tick, 1400);                   // pause so it can be read
                }
                return setTimeout(tick, 60 + Math.random() * 40);
            }
            txt.textContent = word.slice(0, --i);                // backspacing
            if (i === 0) {
                deleting = false;
                p = (p + 1) % phrases.length;
                return setTimeout(tick, 450);                      // short beat before the next one
            }
            setTimeout(tick, 28);
        }
        setTimeout(tick, 700);
    })();

    /* ---------- Go ---------- */
    renderPanel();
    updateHud();
    requestAnimationFrame(frame);
})();