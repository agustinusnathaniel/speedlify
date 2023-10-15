import test from "ava";
import TemplateRender from "../src/TemplateRender.js";
import TemplateConfig from "../src/TemplateConfig.js";
import EleventyExtensionMap from "../src/EleventyExtensionMap.js";

async function getNewTemplateRender(name, inputDir) {
  let eleventyConfig = new TemplateConfig();
  await eleventyConfig.init();

  let tr = new TemplateRender(name, inputDir, eleventyConfig);
  tr.extensionMap = new EleventyExtensionMap([], eleventyConfig);
  await tr.init();
  return tr;
}

// HTML
test("HTML", async (t) => {
  let tr = await getNewTemplateRender("html");
  t.is(tr.getEngineName(), "html");
});

test("HTML Render", async (t) => {
  let tr = await getNewTemplateRender("html");
  let fn = await tr.getCompiledTemplate("<p>Paragraph</p>");
  t.is(await fn(), "<p>Paragraph</p>");
  t.is(await fn({}), "<p>Paragraph</p>");
});

test("HTML Render: Parses HTML using liquid engine (default, with data)", async (t) => {
  let tr = await getNewTemplateRender("html");
  let fn = await tr.getCompiledTemplate("<h1>{{title}}</h1>");
  t.is((await fn({ title: "My Title" })).trim(), "<h1>My Title</h1>");
});

test("HTML Render: Set HTML engine to false, don’t parse", async (t) => {
  let tr = await getNewTemplateRender("html");
  tr.setHtmlEngine(false);

  let fn = await tr.getCompiledTemplate("<h1>{{title}}</h1>");
  t.is((await fn()).trim(), "<h1>{{title}}</h1>");
});

test("HTML Render: Pass in an override (liquid)", async (t) => {
  let tr = await getNewTemplateRender("html");
  tr.setHtmlEngine("liquid");
  let fn = await tr.getCompiledTemplate("<h1>{{title}}</h1>");

  t.is((await fn({ title: "My Title" })).trim(), "<h1>My Title</h1>");
});
