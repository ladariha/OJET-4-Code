"use strict";

const git = require("nodegit");
const path = require("path");
const fs = require("fs");

const TMP_DIR = path.join(__dirname, "tmp");
const DIST_DIR = path.join(__dirname, "dist");
const METADATA_DIR = path.join(TMP_DIR, "dist", "metadata", "components");
const TARGET = path.join(DIST_DIR, "tags.json");

const URL_OJET_GITHUB = "https://github.com/oracle/oraclejet";
const MATCH_JSON_FILE = /\.json$/i;
const MATCH_EVENT_NAME = /[A-Z]+[^A-Z]*|[^A-Z]+/g;

function removeDirAsync(dirPath) {
	console.info("Removing dir path: " + dirPath);

	if (!fs.existsSync(dirPath)) {
		console.info("Dir path: " + dirPath + " doesn't exist");
		return Promise.resolve();
	}
	return removeFilesAsync(dirPath)
		.then(() => {
			console.info("Dir path: " + dirPath + " removed");
			return Promise.resolve();
		})
		.catch((e) => {
			console.error("Dir path: " + dirPath + " didn't remove");
			return Promise.reject(e);
		});
};

function removeFilesAsync(dirPath) {
	console.debug("Removing dir: " + dirPath);

	return fs.promises.readdir(dirPath)
		.then((files) => {
			if (files.length == 0) {
				console.debug("Dir: " + dirPath + " empty");
				return Promise.resolve();
			}
			return Promise.all(files.map((file) => {
				file = path.join(dirPath, file);
				return fs.promises.lstat(file)
					.then((stats) => {
						if (stats.isDirectory()) {
							return removeFilesAsync(file);
						}
						return fs.promises.unlink(file)
							.then(() => {
								console.debug("File: " + file + " removed");
								return Promise.resolve();
							});
					});
			}));

		})
		.then(() => {
			return fs.promises.rmdir(dirPath);
		})
		.then(() => {
			console.debug("Dir: " + dirPath + " removed");
			return Promise.resolve();
		});
};

function collectMetadataAsync(directory) {
	console.info("Collecting metadata...");

	return fs.promises.readdir(directory)
		.then((files) => {
			return Promise.all(
				files.filter(file => file.match(MATCH_JSON_FILE))
				.map(file => proccessMetadataFileAsync(path.join(directory, file))));
		})
		.then((tags) => {
			console.info("Metadata collected");
			return Promise.resolve(tags);
		});
};

function proccessMetadataFileAsync(jsonFile) {
	console.debug("Processing metadata file: " + jsonFile);

	return fs.promises.readFile(jsonFile, "utf8")
		.then((data) => {
			let component = JSON.parse(data);

			let result = {
				attributes: []
			};
			result.name = component.name;
			if (component.description) {
				result.description = component.description;
			}

			result.attributes = obtainAttributesFromProperties("", component.properties);
			result.attributes.push(...obtainAttributesFromProperties("on-", component.properties, "-changed"));
			result.attributes.push(...obtainAttributesFromEvents(component.events));

			return Promise.resolve(result);
		})
		.then((result) => {
			console.debug("Metadata file: " + jsonFile + " processed");
			return Promise.resolve(result);
		});

};

function obtainAttributesFromProperties(propertyPrefix, properties, propertySuffix) {
	let attributes = Object.keys(properties || {})
		.map(propertyKey => {
			let name = (propertySuffix) ?
				propertyPrefix.concat(transformUpperName(propertyKey)).concat(propertySuffix) :
				transformUpperName(transformPropertyName(propertyPrefix, propertyKey));
			let property = {
				name
			};
			let description = (propertySuffix) ?
				"Property change listener function for '".concat(propertyKey).concat("' attribute") :
				properties[propertyKey].description;
			if (description) {
				property.description = description;
			}
			if (!propertySuffix && properties[propertyKey].enumValues) {
				property.values = properties[propertyKey].enumValues.map(value => {
					return {
						name: value
					};
				});
			}
			return property;
		});

	if ((!propertySuffix)) {
		Object.keys(properties || {})
			.map(propertyKey => {
				if (properties[propertyKey].properties) {
					attributes.push(...obtainAttributesFromProperties(
						transformPropertyName(propertyPrefix, propertyKey),
						properties[propertyKey].properties));
				}
			});
	}
	return attributes;
}

function transformPropertyName(propertyPrefix, propertyKey) {
	return (propertyPrefix && propertyPrefix.length > 0) ? `${propertyPrefix}.${propertyKey}` : propertyKey;
}

function obtainAttributesFromEvents(events) {
	return Object.keys(events || {})
		.map(eventKey => {
			let event = {
				name: transformEventName(eventKey)
			};
			if (events[eventKey].description) {
				event.description = events[eventKey].description;
			}
			return event;
		});
}

function transformEventName(eventName) {
	return "on-".concat(transformUpperName(eventName));
};

function transformUpperName(attributeName) {
	return attributeName.match(MATCH_EVENT_NAME).join("-").toLowerCase();
};

function writeResultsAsync(directory, file, tags) {
	console.info("Writing results...");

	return fs.promises.mkdir(directory)
		.then(() => {
			return fs.promises.writeFile(file, JSON.stringify({
				version: 1,
				tags
			}));
		})
		.then(() => {
			console.info("Results wrote sucess");
			return Promise.resolve();
		});
}

function cloneRepositoryAsync(url, dirPath) {
	console.info("Cloning repository...");
	console.info("Dir repository: " + dirPath);
	return fs.promises.mkdir(dirPath)
		.then(() => {
			console.info("Repository: " + url);
			return git.Clone(url, dirPath)
		})
		.then(() => {
			console.info("Repository cloned");
			return Promise.resolve();
		})
}

{
	console.log("Init building of Tags");

	Promise.all([removeDirAsync(TMP_DIR), removeDirAsync(DIST_DIR)])
		.then(() => {
			return cloneRepositoryAsync(URL_OJET_GITHUB, TMP_DIR);
		})
		.then(() => {
			return collectMetadataAsync(METADATA_DIR);
		})
		.then((tags) => {
			return writeResultsAsync(DIST_DIR, TARGET, tags);
		})
		.then(() => {
			console.log(`Done, definition file is ${TARGET}`);
		}).catch((e) => {
			console.error("Building of Tags not completed");
			console.error(e.message);
			console.error(e.stack);
		});
}