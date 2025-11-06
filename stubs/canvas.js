module.exports = {
  createCanvas() {
    throw new Error(
      "The `canvas` package is not available in the browser runtime. This stub should never be invoked."
    );
  },
  Image: class {},
};
