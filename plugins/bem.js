'use strict';

exports.defineTags = function(dictionary) {
    dictionary.defineTag('block', {
        canHaveType: false,
        onTagged: function(doclet, tag) {
            doclet.addTag('kind', 'block');
            if (tag.value) {
                doclet.addTag('name', tag.value);
            }
            doclet.block = tag.value;
        }
    });

    dictionary.defineTag('mod', {
        canHaveType: false,
        onTagged: function(doclet, tag) {
            doclet.addTag('kind', 'mod');

            doclet.mod = doclet.mod || {};
            doclet.mod.name = tag.value;
        }
    });

    dictionary.defineTag('val', {
        canHaveType: false,
        onTagged: function(doclet, tag) {
            doclet.mod = doclet.mod || {};
            doclet.mod.value = tag.value;
        }
    });

    dictionary.defineTag('modhandler', {
        mustHaveValue: true,
        canHaveType: false,

        onTagged: function(doclet, tag) {
            var nameVal = tag.value.split(/\s+/),
                mod = {};

            if (nameVal.length >= 3) {
                mod.elemName = nameVal.shift();
            }

            mod.name = nameVal[0];
            mod.value = nameVal[1];

            if (mod.name.charAt(0) === '-') {
                mod.name = mod.name.slice(1);
                mod.removal = true;
            }

            doclet.mod = mod;
            doclet.addTag('name', mod.name);
            doclet.addTag('kind', 'modhandler');
        }
    });
};

exports.astNodeVisitor = {
    visitNode: function(node, e, parser, currentSourceName) {
        if (isBemDomDecl(node)) {
          if (node.arguments.length < 2) {
                return;
            }

            var bemEntity = getEntity(node.arguments[0]),
                name = getEntityName(bemEntity),
                comment = getEntityDocComment(node, bemEntity);

            e.id = node.nodeId;
            e.comment = comment;
            e.filename = currentSourceName;
            e.lineno = node.loc.start.line;
            e.astnode = node;
            e.event = "symbolFound";
            e.code = {
                name: name,
                bemEntity: bemEntity,
                type: "ObjectExpression",
                node: node
            };
            e.finishers = [
                addDocletBemEntity,
                parser.addDocletRef
            ];
        } else if (node.type === "ObjectExpression" && isBemDomDecl(node.parent)) {
            var entityName = getEntityName(getEntity(node.parent.arguments[0])),
                lends = isStaticDecl(node) ? entityName : entityName + '.prototype';

            e.id = node.nodeId;
            e.comment = '/** @lends ' + lends + '*/';
            e.filename = currentSourceName;
            e.lineno = node.loc.start.line;
            e.astnode = node;
            e.event = "symbolFound";
            e.code = {
                name: "____",
                type: "Property",
                node: node
            };

            e.finishers = [
                parser.addDocletRef,
            ];

        }

    }
};

/**
 * Checks if AST node is `BEM.DOM.decl` call
 *
 * @param {Object} node ast node
 */
function isBemDomDecl(node) {
    return astMatch(node, {
        type: "CallExpression",
        callee: {
            type: "MemberExpression",
            object: {
                type: "MemberExpression",
                object: {
                    type: "Identifier",
                    name: "BEM"
                },

                property: {
                    type: "Identifier",
                    name: "DOM"
                }
            },
            property: {
                type: "Identifier",
                name: "decl"
            }
        }
    });
}

/**
 * Compares AST node with pattern
 *
 * Node and pattern match if all patterns primitive values
 * are present in a node.
 */
function astMatch(node, tpl) {
    if (typeof node !== typeof tpl) {
        return false;
    }

    if (isPrimitive(tpl)) {
        return node === tpl;
    }

    return Object.keys(tpl).every(function(key) {
        return astMatch(node[key], tpl[key]);
    });
}

function isPrimitive(value) {
    return typeof value !== "object";
}

/**
 * Constructs a bem entity description
 * from first argument of `BEM.DOM.decl`
 *
 * @param {Object} decl an AST node of a first argument of 
 * BEM.DOM.decl
 * @returns {Object} bem entity description with `block`,
 * `mod`, and `val` keys
 */
function getEntity(decl) {
    if (decl.type === "Literal") {
        return {block: decl.value};
    }

    if (decl.type === "ObjectExpression") {
        return {
            block: getProperty(decl, 'block'),
            mod: getProperty(decl, 'modName'),
            val: getProperty(decl, 'modVal')
        };
    }

}

/**
 * Returns a value of property by name from
 * given object literal AST node
 *
 * @param {Object} objNode an AST node of an object literal
 * (node.type is assumed to be equal to "ObjectExpression")
 * @param {String} name a name of a property to return
 */
function getProperty(objNode, name) {
    for (var i=0; i<objNode.properties.length; i++) {
        if (getKey(objNode.properties[i]) === name) {
            return getValue(objNode.properties[i]);
        }
    }
}

/**
 * Returns a key value of a property expression
 * @param {Object} propNode an AST node of a propery expression
 */
function getKey(propNode) {
    if (propNode.key.type === "Literal") {
        return propNode.key.value;
    }

    if (propNode.key.type === "Identifier") {
        return propNode.key.name;
    }
}

function getValue(propNode) {
    return propNode.value.value;
}

function getEntityName(entity) {
        return entity.block +
            (entity.mod? '_' + entity.mod : '') +
            (entity.val? '_' + entity.val: '');
}

/**
 * Constructs new doc comment by appending
 * custom doc tags (@block, @elem, @mod) to
 * to source doc comment.
 *
 * @param {Object} node AST node to document
 * @param {Object} entity BEM entity, declared by node
 * @returns {String} doc comment for a bem entity
 */
function getEntityDocComment(node, entity) {
    var comment = ['/**'];
    if (node.leadingComments && node.leadingComments[0]) {
        comment.push(node.leadingComments[0].value);
    }

    if (entity.block) {
        comment.push('@block');
    }

    if (entity.mod) {
        comment.push('@mod');
    }

    if (entity.val) {
        comment.push('@val');
    }

    comment.push('*/');
    return comment.join('\n');
}

/**
 * Adds bem entity description to a doclet.
 * This method is called after doclet has
 * been constructed but before it sent to template.
 * Its required, because automatically inserted
 * `@block`, `@elem` and `@mod` keys does not
 * contain names
 */
function addDocletBemEntity(e) {
    var bemEntity = e.code.bemEntity;
    e.doclet.block = bemEntity.block;
    if (bemEntity.mod) {
        e.doclet.mod = {
            name: bemEntity.mod,
            value: bemEntity.val
        };
    }
}

/**
 * Returns true if passed AST node is a static
 * methods declaration of BEM.DOM.decl
 * @param {Object} node an AST node of BEM.DOM.decl argument
 * @returns {Boolean}
 */
function isStaticDecl(node) {
    var parent = node.parent;
    return hasStatic(parent) &&
        parent.arguments[2] === node;
}

/**
 * Returns true if `BEM.DOM.decl` AST node has
 * static methods declaration.
 * @param {Object} node AST node of BEM.DOM.decl`
 * @return {Boolean}
 */
function hasStatic(node) {
    var args = node.arguments;
    if (!args) {
        return false;
    }
    return args.length >= 3 &&
        args[1].type === "ObjectExpression" &&
        args[2].type === "ObjectExpression";
}


