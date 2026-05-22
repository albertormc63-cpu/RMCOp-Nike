module.exports = {
  // Cambia a "server" cuando el panel deba trabajar contra el volumen compartido.
  mode: "local", //usamos "local" para desarrollo y "server" para producción

  paths: {
    // Rutas locales para pruebas en esta maquina.
    local: {
      templatesBase: "/Users/rmlsub1/Documents/pruebas/PATRONES PARA ROLLO/NIKE LACROSSE",
      ordersBase: "/Users/rmlsub1/Documents/pruebas/TO PRINT/NIKE ORDERS"
    },
    // Rutas finales del servidor/volumen compartido.
    server: {
      templatesBase: "/Volumes/Fullsize/PATRONES ACOMODADOS PARA ROLLO/NIKE LACROSSE",
      ordersBase: "/Volumes/Fullsize/TO PRINT/NIKE ORDERS"
    }
  }
};
