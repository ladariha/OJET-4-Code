"use strict";

const git = require("nodegit");
const path = require("path");
const fs = require("fs");
const TMP_DIR = path.join(__dirname, "tmp");
const DIST_DIR = path.join(__dirname, "dist");
const METADATA_DIR = path.join(TMP_DIR, "dist", "metadata", "components");
const TARGET = path.join(DIST_DIR, "tags.json");
const JSON_FILE = /\.json$/i;

function removeDir(dirPath) {
    return new Promise((resolve, reject) => {

        if (!fs.existsSync(dirPath)) {
            return resolve();
        }

        fs.readdir(dirPath, (err, files) => {
            if (err) {
                return reject(err);
            }
            Promise.all(files.map(file => removeFile(path.join(dirPath, file)))) // eslint-disable-line no-use-before-define
                .then(() => {
                    fs.rmdir(dirPath, err => err ? reject(err) : resolve());
                })
                .catch(reject);
        });
    });
}

function removeFile(filePath) {
    return new Promise((resolve, reject) => {
        fs.lstat(filePath, (err, stats) => {
            if (err) {
                return reject(err);
            }
            if (stats.isDirectory()) {
                resolve(removeDir(filePath));
            } else {
                fs.unlink(filePath, err => err ? reject(err) : resolve());
            }
        });
    });
}

function transforEventName(eventName) {
    return `on-${eventName.match(/[A-Z]+[^A-Z]*|[^A-Z]+/g).join("-").toLowerCase()}`;
}

function proccessMetadataFile(jsonFile) {
    return new Promise((resolve, reject) => {
        fs.readFile(jsonFile, "utf8", (err, data) => {
            if (err) {
                return reject(err);
            }
            const component = JSON.parse(data);
            const result = {
                attributes: []
            };
            result.label = component.name;
            if (component.description) {
                result.description = component.description;
            }

            result.attributes = Object.keys(component.properties || {}).map(label => {
                const a = {
                    label
                };
                if (component.properties[label].description) {
                    a.description = component.properties[label].description;
                }

                if (component.properties[label].enumValues) {
                    const _enumHelp = `Possible values: ${component.properties[label].enumValues.join(", ")}`;
                    if (a.description) {
                        a.description += ` ${_enumHelp}`;
                    } else {
                        a.description = _enumHelp;
                    }
                }

                return a;
            });

            result.attributes.push(...Object.keys(component.events || {}).map(eventName => {
                const a = {
                    label: transforEventName(eventName)
                };
                if (component.events[eventName].description) {
                    a.description = component.events[eventName].description;
                }

                return a;
            }));

            resolve(result);
        });
    });
}

function collectMetadata() {
    console.log("Collecting metadata...");
    return new Promise((resolve, reject) => {
        fs.readdir(METADATA_DIR, (err, files) => {
            if (err) {
                return reject(err);
            }

            Promise
                .all(
                    files
                    .filter(x => x.match(JSON_FILE))
                    .map(x => proccessMetadataFile(path.join(METADATA_DIR, x)))
                )
                .then(components => resolve(components))
                .catch(reject);

        });
    });
}

function writeResults(tags) {
    return new Promise((resolve, reject) => {
        fs.mkdir(DIST_DIR, err => {
            if (err) {
                return reject(err);
            }

            fs.writeFile(TARGET, JSON.stringify({
                tags
            }), err => {
                err ? reject(err) : resolve();
            });
        });
    });

}

removeDir(TMP_DIR)
    .then(() => removeDir(DIST_DIR))
    .then(() => {
        console.log("Cloning repository...");
        return git.Clone("https://github.com/oracle/oraclejet", TMP_DIR);
    })
    .then(collectMetadata)
    .then(writeResults)
    .then(() => console.log(`Done, definition file is ${TARGET}`))
    .catch(e => {
        console.error(e.message);
        console.error(e.stack);
    });