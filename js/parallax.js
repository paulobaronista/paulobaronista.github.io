(function () {
    // Respeita prefers-reduced-motion
    //var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
    //if (mq.matches) return;

    var targets = Array.prototype.slice.call(document.querySelectorAll('.parallax-multi'));
    if (targets.length === 0) return;

    // Util: split por vírgula fora de parênteses (para múltiplos backgrounds)
    function splitLayers(cssList) {
        return (cssList || '').split(/\,(?=(?:[^()]*\([^()]*\))*[^()]*$)/).map(function (s) { return s.trim(); });
    }

    // Converte Y ('px', '%', 'top|center|bottom') em px relativos ao elemento
    function yToPx(raw, el) {
        if (!raw) return 0;
        var h = el.clientHeight || el.offsetHeight || 0;
        var lower = String(raw).toLowerCase();

        if (lower === 'top') return 0;
        if (lower === 'center') return h * 0.5;
        if (lower === 'bottom') return h;

        if (/%$/.test(lower)) {
        var p = parseFloat(lower);
        return (isFinite(p) ? p : 0) / 100 * h;
        }
        if (/px$/.test(lower)) {
        var v = parseFloat(lower);
        return isFinite(v) ? v : 0;
        }
        var n = parseFloat(lower);
        if (isFinite(n)) return n;

        return h * 0.5; // fallback
    }

    // Normaliza X (keyword/valor) para recompor
    function normalizeX(raw) {
        if (!raw) return 'center';
        var lower = String(raw).toLowerCase();
        if (lower === 'left' || lower === 'center' || lower === 'right') return lower;
        if (/%$/.test(lower) || /px$/.test(lower) || isFinite(parseFloat(lower))) return lower;
        return 'center';
    }

    // Lê posições iniciais X/Y por layer
    function readBasePositions(el) {
        var cs = window.getComputedStyle ? getComputedStyle(el) : el.style;
        var bx = cs.backgroundPositionX || '';
        var by = cs.backgroundPositionY || '';
        var xList = splitLayers(bx);
        var yList = splitLayers(by);

        var count = Math.max(xList.length, yList.length);
        var bases = [];
        for (var i = 0; i < count; i++) {
        bases.push({
            xRaw: normalizeX(xList[i] || xList[xList.length - 1] || 'center'),
            yRaw: (yList[i] || yList[yList.length - 1] || 'center')
        });
        }
        return bases;
    }

    // Conta camadas no background-image
    function getLayerCount(el) {
        var bg = (window.getComputedStyle ? getComputedStyle(el).backgroundImage : el.style.backgroundImage) || '';
        return splitLayers(bg).length;
    }

    // Converte string em número, aceitando vírgula decimal
    function toNumber(str) {
        var s = (str || '').replace(',', '.'); // <<< aceita "0,35"
        var n = parseFloat(s);
        return isFinite(n) ? n : null;
    }

    // Parse de attrs configuráveis por layer
    function parseConfigList(attrValue, fallback, count) {
        var list = (attrValue || '').split(',').map(function (s) { return s.trim(); }).filter(function (s) { return !!s; });
        var out = [];
        for (var i = 0; i < count; i++) {
        out[i] = (list[i] !== undefined) ? list[i] : (out[i - 1] !== undefined ? out[i - 1] : fallback);
        }
        return out.slice(0, count);
    }

    // Pré-processa cada elemento alvo
    var elements = (function () {
        var arr = [];
        for (var t = 0; t < targets.length; t++) {
        var el = targets[t];
        var debug = (el.getAttribute('data-debug') || '').toLowerCase() === 'true';
        var layerCount = getLayerCount(el);
        var bases = readBasePositions(el);

        var speedsRaw = parseConfigList(el.getAttribute('data-speeds'), '0.3', layerCount);
        var speeds = [];
        for (var j = 0; j < speedsRaw.length; j++) {
            var num = toNumber(speedsRaw[j]);
            speeds.push(num !== null ? num : 0.3);
        }

        var axesRaw = parseConfigList(el.getAttribute('data-axes'), 'y', layerCount);
        var axes = [];
        for (var k = 0; k < axesRaw.length; k++) {
            axes.push(typeof axesRaw[k] === 'string' ? axesRaw[k].toLowerCase() : 'y');
        }

        var baseYpx = [];
        var baseXraw = [];
        for (var m = 0; m < bases.length; m++) {
            baseYpx.push(yToPx(bases[m].yRaw, el));
            baseXraw.push(normalizeX(bases[m].xRaw));
        }

        if (debug) {
            console.log('[parallax] layers:', layerCount,
            '\nspeeds:', speeds,
            '\naxes:', axes,
            '\nbaseX:', baseXraw,
            '\nbaseY(px):', baseYpx);
        }

        arr.push({ el: el, layerCount: layerCount, speeds: speeds, axes: axes, baseYpx: baseYpx, baseXraw: baseXraw, debug: debug });
        }
        return arr;
    })();

    var ticking = false;

    function update() {
        var y = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;

        for (var e = 0; e < elements.length; e++) {
        var item = elements[e];
        var el = item.el;
        var layerCount = item.layerCount;
        var speeds = item.speeds;
        var axes = item.axes;
        var baseYpx = item.baseYpx;
        var baseXraw = item.baseXraw;

        var positions = [];
        for (var i = 0; i < layerCount; i++) {
            var speed = speeds[i] !== undefined ? speeds[i] : 0.3;
            var axis = axes[i] === 'x' ? 'x' : 'y';
            var offset = -(y * speed);

            if (axis === 'x') {
            // Move em X; preserva Y base em px
            var yPx = (baseYpx[i] !== undefined ? baseYpx[i] : (baseYpx[0] !== undefined ? baseYpx[0] : 0));
            positions.push(offset + 'px ' + yPx + 'px');
            } else {
            // Move em Y; preserva X base (keyword/valor)
            var xRaw = (baseXraw[i] !== undefined ? baseXraw[i] : (baseXraw[0] !== undefined ? baseXraw[0] : 'center'));
            var yPx2 = ((baseYpx[i] !== undefined ? baseYpx[i] : (baseYpx[0] !== undefined ? baseYpx[0] : 0)) + offset);
            positions.push(xRaw + ' ' + yPx2 + 'px');
            }
        }

        el.style.backgroundPosition = positions.join(', ');
        }
    }

    function onScroll() {
        if (!ticking) {
        ticking = true;
        (window.requestAnimationFrame || function (cb) { return setTimeout(cb, 16); })(function () {
            update();
            ticking = false;
        });
        }
    }

    // Inicializa
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', update);
})();