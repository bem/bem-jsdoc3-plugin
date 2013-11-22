# JSDoc plugin for BEM

Plugin for [JSDoc3](http://usejsdoc.org/) which extends it for JS code
written using [BEM](http://bem.info/) methodology. 

## Usage

Write [JSDoc config file](http://usejsdoc.org/about-configuring-jsdoc.html) with
enabled plugin:

```javascript
{
    ...
    "plugins": [
        "./path/to/jsdoc-bem/plugins/bem"
    ]
    ...
}
```

Path to plugin should be specified relatively to jsdoc binary directory.

Run using a command:

```
jsdoc -d console -t ./path/to/jsdoc-bem/templates/docjson -c ./path/to/conf.json <your files/directories>
```

Docs will be generated in form of structured JSON and will be printed to STDOUT.
Example of output can be seen in [output.EXAMPLE.json](/output.EXAMPLE.json) file.
