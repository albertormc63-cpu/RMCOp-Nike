const path = require("path");
// Este módulo se encarga de construir las rutas de los templates y los nombres de los archivos de salida basándose en los parámetros proporcionados, como el equipo, la versión, el estilo, el tamaño y el número. Utiliza un archivo de equipos para obtener las siglas correspondientes a cada equipo.
const teams = require("../data/teams");

// Determina el código de versión (A para Away, H para Home) basado en la versión proporcionada.
function getVersionCode(version) {
  return version === "Away" ? "A" : "H";
}
// Determina el código de Nike (PLL o WLL) basado en el estilo proporcionado.
function getNikeCode(style) {
  if (style.includes("1000")) return "PLL";
  if (style.includes("2000")) return "WLL";
  throw new Error(`No se pudo detectar PLL/WLL desde el style: ${style}`);
}
//Construye la ruta del template a partir de los parámetros proporcionados, utilizando las siglas de los equipos y los códigos de versión y estilo.
function buildTemplatePath({ basePath, team, version, style, size }) {
  
  //Sacamos codigo de equipo, version y estilo
  const teamCode = teams[team];
  const versionCode = getVersionCode(version);
  const nikeCode = getNikeCode(style);

  if (!teamCode) {
    throw new Error(`Equipo no registrado: ${team}`);
  }
  // Construimos el nombre del archivo del template utilizando los códigos obtenidos y el tamaño.
  const fileName = `5LM-${nikeCode}-${teamCode}-${versionCode}-ALD ${size}.pdf`;

  return path.join(
    basePath,
    version,
    `${team} ${version}`,
    fileName
  );
}
// Construye el nombre del archivo de salida utilizando los parámetros proporcionados, incluyendo el código de Nike y las siglas del equipo.
function buildOutputName({ wo, team, style, size, number }) {
  const nikeCode = getNikeCode(style);
  return `${wo} ${nikeCode}-${team} ${style} ${size} ${number}.pdf`;
}
// Exportamos las funciones para que puedan ser utilizadas en otros módulos.
module.exports = {
  buildTemplatePath,
  buildOutputName
};