module.exports = {
  name: "Some Projects", // optional, falls back to object key
  description: "Some Projects",
  // // skip if localhost
  // // skip if this is a new fork of the speedlify (not Zach’s)
  // skip: !process.env.CONTEXT || process.env.SITE_NAME !== "speedlify",
  options: {
    frequency: 60 * 5, // every 6 hours
    // Use "run" if the sites don’t share assets on the same origin
    //           and we can reset chrome with each run instead of
    //           each site in every run (it’s faster)
    // Use "site" if sites are all on the same origin and share assets.
    freshChrome: "run",
  },
  urls: [
    "https://agustinusnathaniel.com/",
    "https://le-cook.sznm.dev/",
    "https://covid19.sznm.dev/",
    "https://sznm.dev/",
    "https://advicegen.sznm.dev/",
    "https://instaprofile.sznm.dev/",
    "https://kapturalumina.sznm.dev/",
    "https://nextchakra-starter.sznm.dev/",
    "https://addtocal.sznm.dev/",
    // "https://igdl.sznm.dev/",
    "https://publicapis.sznm.dev/",
    "https://muvees.sznm.dev/",
    "https://gaas.sznm.dev/",
    "https://spoker.sznm.dev/"
  ],
};
