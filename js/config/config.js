module.exports = {
  mode: "local", //usamos "local" para desarrollo y "server" para producción

  paths: {
    // paths for local mode manera local
    local: {
      templatesBase: "/Users/rmlsub1/Documents/pruebas/Nike Lacrosse/Mens",
      ordersBase: "/Users/rmlsub1/Documents/pruebas/TO PRINT/NIKE ORDERS"
    },
    // paths for server mode
    server: {
      templatesBase: "/Volumes/Fullsize/Nike Lacrosse/Mens",
      ordersBase: "/Volumes/Fullsize/TO PRINT/NIKE ORDERS"
    }
  }
};