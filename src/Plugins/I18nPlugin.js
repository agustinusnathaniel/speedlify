// pathPrefix note:
// When using `locale_url` filter with the `url` filter, `locale_url` must run first like
// `| locale_url | url`. If you run `| url | locale_url` it won’t match correctly.

// TODO improvement would be to throw an error if `locale_url` finds a url with the
// path prefix at the beginning? Would need a better way to know `url` has transformed a string
// rather than just raw comparison.
// e.g. --pathprefix=/en/ should return `/en/en/` for `/en/index.liquid`
const { DeepCopy } = require("../Util/Merge");
const bcp47Normalize = require("bcp-47-normalize");

class Comparator {
  // https://en.wikipedia.org/wiki/IETF_language_tag#Relation_to_other_standards
  // Requires a primary language code (before the first -) to be 2 or 3 characters
  static isLangCode(code) {
    let [s] = (code || "").split("-");
    return (s.length === 2 || s.length === 3) && !!bcp47Normalize(code);
  }

  // search for same input path files with only differing locale
  // Matches /en/about.html and /es/about.html
  static matchLanguageFolder(inputpath1, inputpath2) {
    if (inputpath1 === inputpath2) {
      return false;
    }

    let s1 = inputpath1.split("/");
    let s2 = inputpath2.split("/");
    for (let j = 0, k = s1.length; j < k; j++) {
      if (Comparator.isLangCode(s1[j]) && Comparator.isLangCode(s2[j])) {
        continue;
      }
      if (s1[j] !== s2[j]) {
        return false;
      }
    }

    return true;
  }
}

function EleventyPlugin(eleventyConfig, opts = {}) {
  let options = DeepCopy(
    {
      defaultLanguage: "en",
      filters: {
        url: "locale_url",
        links: "locale_links",
      },
    },
    opts
  );

  let extensionMap;
  eleventyConfig.on("eleventy.extensionmap", (map) => {
    extensionMap = map;
  });

  let contentMaps = {};
  eleventyConfig.on(
    "eleventy.contentMap",
    function ({ urlToInputPath, inputPathToUrl }) {
      contentMaps.urls = urlToInputPath;

      // map of input paths => array of localized urls
      let localeMap = {};
      let inputPaths = Object.keys(inputPathToUrl);

      // map of input paths without extensions
      let inputPathsWithoutTemplateExtensionsMap = {};
      for (let path of inputPaths) {
        inputPathsWithoutTemplateExtensionsMap[path] =
          extensionMap?.removeTemplateExtension(path) || path;
      }

      for (let comparisonInputPath of inputPaths) {
        for (let inputPath of inputPaths) {
          // Compare *without* template extensions: `/en/about.liquid` should match `/es/about.11ty.js`
          if (
            Comparator.matchLanguageFolder(
              inputPathsWithoutTemplateExtensionsMap[comparisonInputPath],
              inputPathsWithoutTemplateExtensionsMap[inputPath]
            )
          ) {
            if (!localeMap[comparisonInputPath]) {
              localeMap[comparisonInputPath] = [];
            }

            for (let url of inputPathToUrl[inputPath]) {
              localeMap[comparisonInputPath].push(url);
            }
          }
        }
      }

      contentMaps.localeLinksMap = localeMap;
    }
  );

  // Normalize a theoretical URL based on the current page’s language
  // If a non-localized file exists, returns the URL without a language assigned
  // Fails if no file exists (localized and not localized)
  eleventyConfig.addFilter(options.filters.url, function (url) {
    let pageUrl =
      this.page?.url ||
      this.ctx?.page?.url ||
      this.context?.environments?.page?.url;

    let s = pageUrl.split("/");
    let langCode =
      (s.length > 0 && Comparator.isLangCode(s[1]) ? s[1] : "") ||
      options.defaultLanguage;

    let comparisonUrl = `/${langCode}${url}`;
    if (contentMaps.urls[comparisonUrl]) {
      return comparisonUrl;
    }
    // Support missing trailing slash in url
    if (!comparisonUrl.endsWith("/") && contentMaps.urls[`${comparisonUrl}/`]) {
      return comparisonUrl;
    }

    if (
      contentMaps.urls[url] ||
      (!url.endsWith("/") && contentMaps.urls[`${url}/`])
    ) {
      // do nothing, this is not a localized file (independent of a language code)
    } else {
      // You’re linking to a localized file that doesn’t exist!
      throw new Error(
        `Localized file for URL ${comparisonUrl} not found in your project! You will need to add it if you want to link to it using the \`locale_link\` filter.`
      );
    }

    return url;
  });

  // Find the links that are localized alternates to the inputPath argument
  eleventyConfig.addFilter(options.filters.links, function (inputPath) {
    return contentMaps.localeLinksMap[inputPath] || [];
  });
}

module.exports = EleventyPlugin;
module.exports.Comparator = Comparator;
