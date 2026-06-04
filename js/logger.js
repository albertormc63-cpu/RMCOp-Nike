(function () {
    // Captura console.log/warn/error y los pinta dentro del panel para ver el flujo sin abrir DevTools.
    const terminal = document.getElementById("terminal");
    const btnClearLog = document.getElementById("btnClearLog");
    const maxLogLines = 180;

    function writeLog(message, className) {
        // Si el HTML no tiene terminal, dejamos que console siga funcionando normal.
        if (!terminal) return;

        const line = document.createElement("div");
        line.textContent = message;

        if (className) {
            line.className = className;
        }

        terminal.appendChild(line);

        while (terminal.childNodes.length > maxLogLines) {
            terminal.removeChild(terminal.firstChild);
        }

        terminal.scrollTop = terminal.scrollHeight;
    }

    // Guardamos las funciones originales para no perder salida real de consola.
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = function () {
        const message = Array.prototype.join.call(arguments, " ");
        writeLog(message, "log-success");
        originalLog.apply(console, arguments);
    };

    console.error = function () {
        const message = Array.prototype.join.call(arguments, " ");
        writeLog(message, "log-error");
        originalError.apply(console, arguments);
    };

    console.warn = function () {
        const message = Array.prototype.join.call(arguments, " ");
        writeLog(message, "log-warning");
        originalWarn.apply(console, arguments);
    };

    if (btnClearLog) {
        btnClearLog.addEventListener("click", function () {
            terminal.innerHTML = "";
        });
    }
})();
