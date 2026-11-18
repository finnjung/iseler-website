import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import markdownIt from "markdown-it";

// Inhalte kommen aus src/_data/*.json und werden über das CMS unter /admin gepflegt.
// Alle Texte werden automatisch HTML-escaped (autoescape), Markdown läuft ohne HTML.
const md = markdownIt({ html: false, linkify: true, breaks: false });

export default function (eleventyConfig) {
  eleventyConfig.setNunjucksEnvironmentOptions({ autoescape: true, throwOnUndefined: false });

  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/admin": "admin" });
  eleventyConfig.ignores.add("src/admin/**");
  eleventyConfig.ignores.add("src/_alt_*");

  // Bilder aus dem CMS (auch große Handyfotos) werden beim Bauen verkleinert und als WebP ausgeliefert.
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    formats: ["webp"],
    widths: [800, 1600, 2400],
    urlPath: "img/",
    outputDir: "_site/img/",
    htmlOptions: { imgAttributes: { loading: "lazy", decoding: "async" } },
  });

  eleventyConfig.addFilter("markdown", (s) => md.render(s || ""));
  // "06104 670700" -> "+496104670700"
  eleventyConfig.addFilter("tel", (s) => {
    const d = String(s || "").replace(/[^\d+]/g, "");
    return d.startsWith("+") ? d : d.startsWith("00") ? "+" + d.slice(2) : "+49" + d.replace(/^0/, "");
  });
  // WhatsApp-Format ohne Plus: "496104670700"
  eleventyConfig.addFilter("wa", (s) => {
    const d = String(s || "").replace(/[^\d+]/g, "");
    return (d.startsWith("+") ? d.slice(1) : d.startsWith("00") ? d.slice(2) : "49" + d.replace(/^0/, ""));
  });
  // "08:45" -> Minuten seit Mitternacht
  eleventyConfig.addFilter("minuten", (s) => {
    const [h, m] = String(s || "0:0").split(":").map(Number);
    return h * 60 + (m || 0);
  });
  // "08:45" -> "8:45"
  eleventyConfig.addFilter("uhrzeit", (s) => String(s || "").replace(/^0(\d)/, "$1"));
  eleventyConfig.addFilter("tagnummer", (t) =>
    ({ Sonntag: 0, Montag: 1, Dienstag: 2, Mittwoch: 3, Donnerstag: 4, Freitag: 5, Samstag: 6 })[t] ?? "");
  eleventyConfig.addFilter("absolut", (pfad, basis) => new URL(pfad, basis).href);

  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    templateFormats: ["njk"],
    htmlTemplateEngine: "njk",
  };
}
