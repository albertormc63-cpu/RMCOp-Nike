module.exports = {
  mode: "local", //usamos "local" para desarrollo y "server" para producción

  paths: {
    // paths for local mode manera local
    local: {
      templatesBase: "/Users/rmlsub1/Documents/pruebas/PATRONES PARA ROLLO/NIKE LACROSSE",
      ordersBase: "/Users/rmlsub1/Documents/pruebas/TO PRINT/NIKE ORDERS"
    },
    // paths for server mode
    server: {
      templatesBase: "/Volumes/Fullsize/PATRONES ACOMODADOS PARA ROLLO/NIKE LACROSSE",
      ordersBase: "/Volumes/Fullsize/TO PRINT/NIKE ORDERS"
    }
  }
};
