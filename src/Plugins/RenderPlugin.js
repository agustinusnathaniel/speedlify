import util from "node:util";
import fs from "graceful-fs";
import { TemplatePath, isPlainObject } from "@11ty/eleventy-utils";

const fsReadFile = util.promisify(fs.readFile);
const fsExists = util.promisify(fs.exists);

// TODO add a first-class Markdown component to expose this using Markdown-only syntax (will need to be synchronous for markdown-it)

import Merge from "../Util/Merge.js";
import { ProxyWrap } from "../Util/ProxyWrap.js";
import TemplateDataInitialGlobalData from "../TemplateDataInitialGlobalData.js";
import EleventyShortcodeError from "../EleventyShortcodeError.js";
import TemplateRender from "../TemplateRender.js";
import TemplateConfig from "../TemplateConfig.js";
import EleventyErrorUtil from "../EleventyErrorUtil.js";
import Liquid from "../Engines/Liquid.js";

async function compile(content, templateLang, { templateConfig, extensionMap } = {}) {
	if (!templateConfig) {
		templateConfig = new TemplateConfig(null, false);
		await templateConfig.init();
	}

	// Breaking change in 2.0+, previous default was `html` and now we default to the page template syntax
	if (!templateLang) {
		templateLang = this.page.templateSyntax;
	}

	let inputDir;

	// templateConfig *may* already be a userconfig
	if (templateConfig.constructor.name === "TemplateConfig") {
		inputDir = templateConfig.getConfig().dir.input;
	} else {
		inputDir = templateConfig?.dir?.input;
	}

	let tr = new TemplateRender(templateLang, inputDir, templateConfig);
	tr.extensionMap = extensionMap;
	if (templateLang) {
		await tr.setEngineOverride(templateLang);
	} else {
		await tr.init();
	}

	// TODO tie this to the class, not the extension
	if (
		tr.engine.name === "11ty.js" ||
		tr.engine.name === "11ty.cjs" ||
		tr.engine.name === "11ty.mjs"
	) {
		throw new Error(
			"11ty.js is not yet supported as a template engine for `renderTemplate`. Use `renderFile` instead!",
		);
	}

	return tr.getCompiledTemplate(content);
}

// No templateLang default, it should infer from the inputPath.
async function compileFile(inputPath, { templateConfig, extensionMap, config } = {}, templateLang) {
	if (!inputPath) {
		throw new Error("Missing file path argument passed to the `renderFile` shortcode.");
	}

	if (!(await fsExists(TemplatePath.normalizeOperatingSystemFilePath(inputPath)))) {
		throw new Error(
			"Could not find render plugin file for the `renderFile` shortcode, looking for: " + inputPath,
		);
	}

	let wasTemplateConfigMissing = false;
	if (!templateConfig) {
		templateConfig = new TemplateConfig(null, false);
		wasTemplateConfigMissing = true;
	}
	if (config && typeof config === "function") {
		await config(templateConfig.userConfig);
	}
	if (wasTemplateConfigMissing) {
		await templateConfig.init();
	}

	let cfg = templateConfig.getConfig();
	let tr = new TemplateRender(inputPath, cfg.dir.input, templateConfig);
	tr.extensionMap = extensionMap;

	if (templateLang) {
		await tr.setEngineOverride(templateLang);
	} else {
		await tr.init();
	}

	if (!tr.engine.needsToReadFileContents()) {
		return tr.getCompiledTemplate(null);
	}

	// TODO we could make this work with full templates (with front matter?)
	let content = await fsReadFile(inputPath, "utf8");
	return tr.getCompiledTemplate(content);
}

async function renderShortcodeFn(fn, data) {
	if (fn === undefined) {
		return;
	} else if (typeof fn !== "function") {
		throw new Error(`The \`compile\` function did not return a function. Received ${fn}`);
	}

	// if the user passes a string or other literal, remap to an object.
	if (!isPlainObject(data)) {
		data = {
			_: data,
		};
	}

	if ("data" in this && isPlainObject(this.data)) {
		// when options.accessGlobalData is true, this allows the global data
		// to be accessed inside of the shortcode as a fallback
		data = ProxyWrap(data, this.data);
	} else {
		// save `page` and `eleventy` for reuse
		data.page = this.page;
		data.eleventy = this.eleventy;
	}

	return fn(data);
}

/**
 * @module 11ty/eleventy/Plugins/RenderPlugin
 */

/**
 * A plugin to add shortcodes to render an Eleventy template
 * string (or file) inside of another template. {@link https://www.11ty.dev/docs/plugins/render/}
 *
 * @since 1.0.0
 * @param {module:11ty/eleventy/UserConfig} eleventyConfig - User-land configuration instance.
 * @param {Object} options - Plugin options
 */
function EleventyPlugin(eleventyConfig, options = {}) {
	/**
	 * @typedef {Object} options
	 * @property {string} [tagName] - The shortcode name to render a template string.
	 * @property {string} [tagNameFile] - The shortcode name to render a template file.
	 * @property {module:11ty/eleventy/TemplateConfig} [templateConfig] - Configuration object
	 * @property {boolean} [accessGlobalData] - Whether or not the template has access to the page’s data.
	 */
	let defaultOptions = {
		tagName: "renderTemplate",
		tagNameFile: "renderFile",
		templateConfig: null,
		accessGlobalData: false,
	};
	let opts = Object.assign(defaultOptions, options);

	function liquidTemplateTag(liquidEngine, tagName) {
		// via https://github.com/harttle/liquidjs/blob/b5a22fa0910c708fe7881ef170ed44d3594e18f3/src/builtin/tags/raw.ts
		return {
			parse: function (tagToken, remainTokens) {
				this.name = tagToken.name;
				this.args = tagToken.args;
				this.tokens = [];

				var stream = liquidEngine.parser
					.parseStream(remainTokens)
					.on("token", (token) => {
						if (token.name === "end" + tagName) stream.stop();
						else this.tokens.push(token);
					})
					.on("end", () => {
						throw new Error(`tag ${tagToken.getText()} not closed`);
					});

				stream.start();
			},
			render: function* (ctx) {
				let normalizedContext = {};
				if (ctx) {
					if (opts.accessGlobalData) {
						// parent template data cascade
						normalizedContext.data = ctx.getAll();
					}

					normalizedContext.page = ctx.get(["page"]);
					normalizedContext.eleventy = ctx.get(["eleventy"]);
				}

				let rawArgs = Liquid.parseArguments(null, this.args);
				let argArray = [];
				let contextScope = ctx.getAll();
				for (let arg of rawArgs) {
					let b = yield liquidEngine.evalValue(arg, contextScope);
					argArray.push(b);
				}

				// plaintext paired shortcode content
				let body = this.tokens.map((token) => token.getText()).join("");

				let ret = _renderStringShortcodeFn.call(
					normalizedContext,
					body,
					// templateLang, data
					...argArray,
				);
				yield ret;
				return ret;
			},
		};
	}

	// TODO I don’t think this works with whitespace control, e.g. {%- endrenderTemplate %}
	function nunjucksTemplateTag(NunjucksLib, tagName) {
		return new (function () {
			this.tags = [tagName];

			this.parse = function (parser, nodes) {
				var tok = parser.nextToken();

				var args = parser.parseSignature(true, true);
				const begun = parser.advanceAfterBlockEnd(tok.value);

				// This code was ripped from the Nunjucks parser for `raw`
				// https://github.com/mozilla/nunjucks/blob/fd500902d7c88672470c87170796de52fc0f791a/nunjucks/src/parser.js#L655
				const endTagName = "end" + tagName;
				// Look for upcoming raw blocks (ignore all other kinds of blocks)
				const rawBlockRegex = new RegExp(
					"([\\s\\S]*?){%\\s*(" + tagName + "|" + endTagName + ")\\s*(?=%})%}",
				);
				let rawLevel = 1;
				let str = "";
				let matches = null;

				// Exit when there's nothing to match
				// or when we've found the matching "endraw" block
				while ((matches = parser.tokens._extractRegex(rawBlockRegex)) && rawLevel > 0) {
					const all = matches[0];
					const pre = matches[1];
					const blockName = matches[2];

					// Adjust rawlevel
					if (blockName === tagName) {
						rawLevel += 1;
					} else if (blockName === endTagName) {
						rawLevel -= 1;
					}

					// Add to str
					if (rawLevel === 0) {
						// We want to exclude the last "endraw"
						str += pre;
						// Move tokenizer to beginning of endraw block
						parser.tokens.backN(all.length - pre.length);
					} else {
						str += all;
					}
				}

				let body = new nodes.Output(begun.lineno, begun.colno, [
					new nodes.TemplateData(begun.lineno, begun.colno, str),
				]);
				return new nodes.CallExtensionAsync(this, "run", args, [body]);
			};

			this.run = function (...args) {
				let resolve = args.pop();
				let body = args.pop();
				let [context, ...argArray] = args;

				let normalizedContext = {};
				if (context.ctx && context.ctx.page) {
					normalizedContext.ctx = context.ctx;

					// TODO .data
					// if(opts.accessGlobalData) {
					//   normalizedContext.data = context.ctx;
					// }

					normalizedContext.page = context.ctx.page;
					normalizedContext.eleventy = context.ctx.eleventy;
				}

				body(function (e, bodyContent) {
					if (e) {
						resolve(
							new EleventyShortcodeError(
								`Error with Nunjucks paired shortcode \`${tagName}\`${EleventyErrorUtil.convertErrorToString(
									e,
								)}`,
							),
						);
					}

					Promise.resolve(
						_renderStringShortcodeFn.call(
							normalizedContext,
							bodyContent,
							// templateLang, data
							...argArray,
						),
					)
						.then(function (returnValue) {
							resolve(null, new NunjucksLib.runtime.SafeString(returnValue));
						})
						.catch(function (e) {
							resolve(
								new EleventyShortcodeError(
									`Error with Nunjucks paired shortcode \`${tagName}\`${EleventyErrorUtil.convertErrorToString(
										e,
									)}`,
								),
								null,
							);
						});
				});
			};
		})();
	}

	// This will only work on 1.0.0-beta.5+ but is only necessary if you want to reuse your config inside of template shortcodes.
	// Just rendering raw templates (without filters, shortcodes, etc. from your config) will work fine on old versions.
	let templateConfig;
	eleventyConfig.on("eleventy.config", (cfg) => {
		templateConfig = cfg;
	});

	let extensionMap;
	eleventyConfig.on("eleventy.extensionmap", (map) => {
		extensionMap = map;
	});

	async function _renderStringShortcodeFn(content, templateLang, data = {}) {
		// Default is fn(content, templateLang, data) but we want to support fn(content, data) too
		if (typeof templateLang !== "string") {
			data = templateLang;
			templateLang = false;
		}

		let fn = await compile.call(this, content, templateLang, {
			templateConfig: opts.templateConfig || templateConfig,
			extensionMap,
		});

		return renderShortcodeFn.call(this, fn, data);
	}

	async function _renderFileShortcodeFn(inputPath, data = {}, templateLang) {
		let fn = await compileFile.call(
			this,
			inputPath,
			{
				templateConfig: opts.templateConfig || templateConfig,
				extensionMap,
			},
			templateLang,
		);

		return renderShortcodeFn.call(this, fn, data);
	}

	// Render strings
	if (opts.tagName) {
		// use falsy to opt-out
		eleventyConfig.addJavaScriptFunction(opts.tagName, _renderStringShortcodeFn);

		eleventyConfig.addLiquidTag(opts.tagName, function (liquidEngine) {
			return liquidTemplateTag(liquidEngine, opts.tagName);
		});

		eleventyConfig.addNunjucksTag(opts.tagName, function (nunjucksLib) {
			return nunjucksTemplateTag(nunjucksLib, opts.tagName);
		});
	}

	// Render File
	// use `false` to opt-out
	if (opts.tagNameFile) {
		eleventyConfig.addAsyncShortcode(opts.tagNameFile, _renderFileShortcodeFn);
	}
}

// Will re-use the same configuration instance both at a top level and across any nested renders
class RenderManager {
	constructor() {
		this.templateConfig = new TemplateConfig(null, false);

		// This is the only plugin running on the Edge
		this.templateConfig.userConfig.addPlugin(EleventyPlugin, {
			templateConfig: this.templateConfig,
			accessGlobalData: true,
		});

		this._hasConfigInitialized = false;
	}

	async init() {
		if (this._hasConfigInitialized) {
			return this._hasConfigInitialized;
		}

		this._hasConfigInitialized = this.templateConfig.init();
		await this._hasConfigInitialized;
		return true;
	}

	// `callback` is async-friendly but requires await upstream
	config(callback) {
		// run an extra `function(eleventyConfig)` configuration callbacks
		if (callback && typeof callback === "function") {
			return callback(this.templateConfig.userConfig);
		}
	}

	get initialGlobalData() {
		if (!this._data) {
			this._data = new TemplateDataInitialGlobalData(this.templateConfig);
		}
		return this._data;
	}

	// because we don’t have access to the full data cascade—but
	// we still want configuration data added via `addGlobalData`
	async getData(...data) {
		await this.init();

		let globalData = await this.initialGlobalData.getData();
		let merged = Merge({}, globalData, ...data);
		return merged;
	}

	async compile(content, templateLang, options = {}) {
		await this.init();

		// Missing here: extensionMap
		options.templateConfig = this.templateConfig;

		// We don’t need `compile.call(this)` here because the Edge always uses "liquid" as the template lang (instead of relying on this.page.templateSyntax)
		// returns promise
		return compile(content, templateLang, options);
	}

	async render(fn, edgeData, buildTimeData) {
		await this.init();

		let mergedData = await this.getData(edgeData);
		// Set .data for options.accessGlobalData feature
		let context = {
			data: mergedData,
		};

		return renderShortcodeFn.call(context, fn, buildTimeData);
	}
}

export default EleventyPlugin;

export { compileFile as File, compile as String, RenderManager };
