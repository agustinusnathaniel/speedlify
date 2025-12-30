module.exports = {
  name: "Experiments", // optional, falls back to object key
  description: "Some experiments",
  // // skip if localhost
  // // skip if this is a new fork of the speedlify (not Zach’s)
  // skip: !process.env.CONTEXT || process.env.SITE_NAME !== "speedlify",
  options: {
    frequency: 30, // max once every 30 minutes
    // Use "run" if the sites don’t share assets on the same origin
    //           and we can reset chrome with each run instead of
    //           each site in every run (it’s faster)
    // Use "site" if sites are all on the same origin and share assets.
    freshChrome: "run",
  },
  urls: [
    "https://my-spotify-astro.sznm.dev",
    "https://my-spotify-nuxt.sznm.dev",
    "https://my-spotify-fresh.sznm.dev",
    "https://leeboor.sznm.dev",
    "https://meal-app.sznm.dev",
    "https://zippy.sznm.dev"
  ],
};
