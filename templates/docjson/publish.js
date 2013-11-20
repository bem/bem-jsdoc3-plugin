/*global dump:false*/
'use strict';
exports.publish = function(data, options) {
    data({undocumented: true}).remove();
    var blocks = data({kind: 'block'}).distinct('name');

    if (blocks.length > 1) {
        //TODO: throw an error - only 1 block is supported
        console.log('Error - only 1 block is supported');
        console.log('Blocks in set:');
        console.log(blocks.join('\n'));
        return;
    }

    var docs = genBlockDocs(data, blocks[0]);

    dump(docs);
};


function genBlockDocs(data, blockName) {
    return {
        blockName: blockName,
        description: genEntityDescription(data, 'block', blockName),
        staticMembers: genScopeMembers(data, blockName, 'static'),
        instanceMembers: genScopeMembers(data, blockName, 'instance'),
        mods: genBlockMods(data, blockName),
        events: genBlockEvents(data, blockName)
    };
}
/**
 * Generates description for a bem entity by merging
 * doclets descriptions from all levels
 */
function genEntityDescription(data, kind, entityName) {
    return data({kind: kind, name: entityName}).select('description').join('\n\n');
}

function genScopeMembers(data, blockName, scope) {
    var members = data({memberof: blockName, scope: scope});
    return {
        methods: genMethods(members),
        properties: genProperties(members),
        modHandlers: genModHandlers(members)
    };
}

function genMethods(members) {

    var methods = members.filter({kind: 'function'}),
        publicMethods = methods
            .filter({access: {isUndefined: true}})
            .distinct('name')
            .map(genBlockMethod.bind(null, members)),

        protectedMethods = methods
            .filter({access: 'protected'})
            .distinct('name')
            .map(genBlockMethod.bind(null, members));

    return {
        'public': publicMethods,
        'protected': protectedMethods
    };

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
        fires: [],
        deprecated: false
    };
    members.filter({
        kind: 'function',
        name: name
    }).each(function(doclet) {
        if (doclet.description) {
            res.description += doclet.description + '\n';
        }
        if (res.returns.length === 0) {
            res.returns = genMethodReturns(doclet.returns);
        }

        if (res.params.length === 0) {
            res.params  = genMethodParams(doclet.params);
        }

        if (res.fires.length === 0 && doclet.fires) {
            res.fires = doclet.fires;
        }

        if (doclet.deprecated) {
            res.deprecated = doclet.deprecated;
        }
    });

    return res;
}

function genMethodParams(params) {
    if (!params) {
        return [];
    }
    return params.map(genMethodParam);
}

function genMethodParam(param) {
    var res = {
        name: param.name,
        description: param.description,
        optional: !!param.optional
    };
    if (param.type) {
        res.types = param.type.names;
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
        description: methodReturn.description
    };

    if (methodReturn.type) {
        res.types = methodReturn.type.names;
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
        res.description += doclet.description + '\n';
        if (doclet.deprected) {
            res.deprecated = true;
        }
        if (res.types.length === 0 && doclet.type) {
            res.types = doclet.type.names;
        }
    });

    return res;
}

function genModHandlers(members) {
    return members
        .filter({kind: 'modhandler'})
        .map(genModHandler);
}

function genModHandler(doclet) {
    return {
        name: doclet.name,
        description: doclet.description,
        elemName: doclet.mod.elemName,
        value: doclet.mod.value,
        removal: doclet.mod.removal || false,
        fires: doclet.fires || []
    };
}

function genBlockMods(data, blockName) {
    var modDoclets = data({kind: 'mod', block: blockName});
    return modDoclets.map(genBlockMod.bind(null, data));
}

function genBlockMod(data, doclet) {

    var name = doclet.block + '_' + doclet.mod.name + '_' + doclet.mod.value;
    return {
        name: doclet.mod.name,
        value: doclet.mod.value,
        description: genEntityDescription(data, 'mod', name),
        staticMembers: genScopeMembers(data, name, 'static'),
        instanceMembers: genScopeMembers(data, name, 'instance')
    };
}

function genBlockEvents(data, blockName) {
    return data({
        kind: 'event',
        memberof: blockName
    }).map(genBlockEvent);
}

function genBlockEvent(doclet) {
    var res =  {
        name: doclet.name,
        data: {
            properties: doclet.properties.map(genEventProperty)
        }
    };

    if (doclet.type) {
        res.data.types = doclet.type.names;
    }
    return res;
}

function genEventProperty(property) {
    var res = {
        name: property.name,
        description: property.description
    };

    if (property.type) {
        res.types = property.type.names;
    }

    return res;
}
