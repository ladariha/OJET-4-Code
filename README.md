# OJET-4-Code
Metadata of Oracle JET components for code completion in Visual Studio Code (1.30+)

## How to use it?
Starting with Visual Studio Code 1.30, there is (at this moment) experimental support for custom elemements/attributes (see [https://code.visualstudio.com/updates/v1_30#_html-custom-tags-attributes-support](https://code.visualstudio.com/updates/v1_30#_html-custom-tags-attributes-support) for details)

This repository contains file `dist/tags.json` that contains OJET components and their attributes:
1. Download this JSON file to your PC
2. Open VS Code settings and reference this file in following way:
```
    "html.experimental.custom.tags": [
        "/path/to/downloaded/file/tags.json"
    ]
```
3. Optionally restart VS 
4. In HTML code, try code completion for OJET components and attributes

## How to get refreshed list of components?
1. Clone this repo
2. Run command
```
    $ cd OJET-4-Code
    $ npm start
```
3. This will create a new file `OJET-4-Code/dist/tags.json` with up to date definitions