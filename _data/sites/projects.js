module.exports = {
  name: "Projects", // optional, falls back to object key
  description: "Some Projects (Sites, Apps)",
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
    "https://agustinusnathaniel.com/",
    "https://wussh.sznm.dev/",
    "https://wussh.sznm.dev/sozonome",
    "https://wussh.sznm.dev/agustinusnathaniel",
    "https://spoker.dev/home",
    "https://publicapis.sznm.dev/",
    "https://muvees.sznm.dev/",
    "https://gaas.sznm.dev/",
    "https://base.sznm.dev/",
    "https://xtarter.sznm.dev/",
  ],
};
