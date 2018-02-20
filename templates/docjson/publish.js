/**
 * @file Template for outputting doc in json format.
 * Example of output can be seen in output.EXAMPLE.json) file.
 */
'use strict';

var dump = require('jsdoc/util/dumper').dump,
    handle = require('jsdoc/util/error').handle;

exports.publish = function(data, options) {
    data({undocumented: true}).remove();
    var blocks = data({kind: 'block'}).distinct('name');

    if (blocks.length === 0) {
        //Is there a mod JS?
        blocks = data({kind: 'mod'}).distinct('block');
    }

    if (blocks.length > 1) {
        var errMsg = [
            'Error - only 1 block can be documented in one set',
            'Blocks currently in set:',
        ].concat(blocks).join('\n');

        handle(new Error(errMsg));
    }

    var docs = genBlockDocs(data, blocks[0]);

    console.log(dump(docs));
};


function genBlockDocs(data, blockName) {
    var members = data({memberof: blockName, access: {'!is': 'private'}}),
        base = genBlockBase(data, blockName),
        o = {
            blockName: blockName,
            description: genEntityDescription(data, 'block', blockName),
            jsParams: genBlockParams(data, blockName),
            methods: genMethods(members),
            properties: genProperties(members),
            events: genBlockEvents(members),
            mods: genBlockMods(data, blockName)
        };

    if (base.length > 0) {
        o.baseBlock = base;
    }

    return o;
}
/**
 * Generates description for a bem entity by merging
 * doclets descriptions from all levels
 */
function genEntityDescription(data, kind, entityName) {
    return data({kind: kind, name: entityName}).select('description').join('\n\n');
}

function genBlockBase(data, name) {
    return data({kind: 'block', name: name, baseBlock: {isUndefined: false}}).select('baseBlock');
}

function genBlockParams(data, blockName) {
    var params = data({kind: 'block', name: blockName}).first().params || [];
    return params.map(genParam);
}

function genMethods(members) {
    return members.filter({
            kind: 'function',
        })
        .distinct('name')
        .map(genBlockMethod.bind(null, members));
}

/**
 * Generates docs for a method.
 *
 * Descriptions got merged from all levels. Other params
 * will not be merged and first non-empty value will be used
 */
function genBlockMethod(members, name) {
    var res = {
        name: name,
        description: '',
        params: [],
        returns: [],
        deprecated: false,
        final: false
    };
    members.filter({
        kind: 'function',
        name: name
    }).each(function(doclet) {
        if (doclet.description) {
            res.description += doclet.description + '\n';
        }

        if (!res.access) {
            res.access = doclet.access;
        }

        if (!res.scope) {
            res.scope = doclet.scope;
        }

        if (res.returns.length === 0) {
            res.returns = genMethodReturns(doclet.returns);
        }

        if (res.params.length === 0) {
            res.params  = genMethodParams(doclet.params);
        }

        if (doclet.deprecated) {
            res.deprecated = doclet.deprecated;
        }

        if (doclet.final) {
            res.final = doclet.final;
        }
    });

    res.scope = res.scope || 'instance';
    res.access = res.access || 'public';

    return res;
}

function genMethodParams(params) {
    if (!params) {
        return [];
    }
    return params.map(genParam);
}

/**
 * Generates doc for method or event parameter
 */
function genParam(param) {
    var res = {
        name: param.name || '',
        description: param.description || '',
        optional: !!param.optional
    };
    if (param.type) {
        res.types = param.type.names.slice(0);
    }

    if (param.defaultvalue) {
        res['default'] = param.defaultvalue;
    }
    return res;
}

function genMethodReturns(returns) {
    if (!returns) {
        return [];
    }
    return returns.map(genMethodReturn);
}

function genMethodReturn(methodReturn) {
    var res = {
        description: methodReturn.description || ''
    };

    if (methodReturn.type) {
        res.types = methodReturn.type.names.slice(0);
    }
    return res;
}

function genProperties(members) {
    return members
        .filter({kind: 'member'})
        .distinct('name')
        .map(genProperty.bind(null, members));
}

/**
 * Generates docs for a property.
 *
 * Descriptions got merged from all levels. Other params
 * will not be merged and first non-empty value will be used
 */
function genProperty(members, name) {
    var res = {
        name: name,
        deprecated: false,
        description: '',
        types: []
    };

    members.filter({
        kind: 'member',
        name: name
    }).each(function(doclet) {
        if (doclet.description) {
            res.description += doclet.description + '\n';
        }

        if (!res.access) {
            res.access = doclet.access;
        }

        if (!res.scope) {
            res.scope = doclet.scope;
        }

        if (doclet.deprected) {
            res.deprecated = true;
        }
        if (res.types.length === 0 && doclet.type) {
            res.types = doclet.type.names.slice(0);
        }
    });

    res.scope = res.scope || 'instance';
    res.access = res.acccess || 'public';

    return res;
}

function genBlockMods(data, blockName) {
    var modDoclets = data({kind: 'mod', block: blockName});
    return modDoclets.map(genBlockMod.bind(null, data));
}

function genBlockMod(data, doclet) {

    var name = doclet.block + '_' + doclet.mod.name + '_' + doclet.mod.value,
        members = data({memberof: name, access: {'!is': 'private'}});

    return {
        name: doclet.mod.name,
        value: doclet.mod.value,
        methods: genMethods(members),
        properties: genProperties(members),
        events: genBlockEvents(members),
        description: genEntityDescription(data, 'mod', name),
    };
}

function genBlockEvents(members) {
    return members.filter({
        kind: 'event',
    }).map(genBlockEvent);
}

function genBlockEvent(doclet) {
    var params = doclet.params || [],
        res =  {
            name: doclet.name,
            description: doclet.description || '',
            params: params.map(genParam)
        };

    if (doclet.type) {
        res.data.types = doclet.type.names.slice(0);
    }
    return res;
}
