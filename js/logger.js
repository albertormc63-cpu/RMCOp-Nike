(function () {
    const terminal = document.getElementById("terminal");
    const btnClearLog = document.getElementById("btnClearLog");

    function writeLog(message, className) {
        if (!terminal) return;

        const line = document.createElement("div");
        line.textContent = message;

        if (className) {
            line.className = className;
        }

        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;
    }

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