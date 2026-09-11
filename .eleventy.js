module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy("styles.css");
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("about.html");
  eleventyConfig.addPassthroughCopy("robots.txt");
  eleventyConfig.addPassthroughCopy("sitemap.xml");
  eleventyConfig.addFilter("readableDate", value => new Date(value).toLocaleDateString("en-GB", {day:"numeric", month:"long", year:"numeric", timeZone:"UTC"}));
  eleventyConfig.addFilter("shortDate", value => new Date(value).toLocaleDateString("en-GB", {day:"2-digit", month:"short", timeZone:"UTC"}));
  return { dir: { input: ".", includes: "_includes", output: "_site" } };
};