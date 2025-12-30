module.exports = {
  name: "Templates", // optional, falls back to object key
  description: "Starter Templates",
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
    "https://nextarter-chakra.sznm.dev/",
    "https://nextarter-tailwind.sznm.dev",
    "https://vite-react-chakra-starter.sznm.dev",
    "https://vite-react-tailwind-starter.sznm.dev",
    "https://vite-antd-dashboard.sznm.dev",
    "https://vite-mantine-dashboard.sznm.dev",
    "https://rsbuild-react-chakra-starter.sznm.dev"
  ],
};
