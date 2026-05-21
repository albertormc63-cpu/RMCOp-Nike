(function () {
    window.RMC = window.RMC || {};
    window.RMC.ui = window.RMC.ui || {};

    const catalog = window.RMC.productCatalog;
    const previewView = window.RMC.ui.previewView;

    function render(state, callbacks) {
        const teamGrid = document.getElementById("teamGrid");
        const lineConfig = catalog.getLineConfig(state.selectedLine);

        teamGrid.innerHTML = "";

        catalog.getVisibleTeams(state.selectedLine).forEach(function (team) {
            const button = document.createElement("button");
            const preview = document.createElement("div");
            const name = document.createElement("div");
            const meta = document.createElement("div");

            button.type = "button";
            button.className = "team-card";
            button.setAttribute("data-team", team.name);

            preview.className = "team-preview";
            name.className = "team-name";
            meta.className = "team-meta";

            name.textContent = team.name;
            meta.textContent = `${team.code} · ${lineConfig.label}`;
            previewView.paintPreview(preview, {
                line: state.selectedLine,
                team: team.name,
                variant: state.selectedVariant,
                version: "Overview"
            });

            button.appendChild(preview);
            button.appendChild(name);
            button.appendChild(meta);

            button.addEventListener("click", function () {
                callbacks.onTeamSelected(team.name);
            });

            teamGrid.appendChild(button);
        });
    }

    function markSelected(teamName) {
        document.querySelectorAll(".team-card").forEach(function (card) {
            card.classList.toggle("active", card.getAttribute("data-team") === teamName);
        });
    }

    window.RMC.ui.teamsView = {
        render: render,
        markSelected: markSelected
    };
})();
