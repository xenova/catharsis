/* eslint-disable class-methods-use-this */

const Types = require('./types');

function combineNameAndType(nameString, typeString) {
    const separator = (nameString && typeString) ? ':' : '';

    return nameString + separator + typeString;
}

/**
 * @typedef {object} CatharsisType
 * @property {string} name
 * @property {string} type
 * @property {CatharsisType} expression
 * @property {CatharsisType} [key]
 * @property {CatharsisType} [value]
 * @property {CatharsisType[]} [applications]
 * @property {CatharsisType[]} [elements]
 * @property {CatharsisType[]} [fields]
 * @property {boolean} [optional]
 * @property {boolean} [nullable]
 * @property {boolean} [repeatable]
 */

class Stringifier {
    constructor(options) {
        this._options = options || {};
        this._options.linkClass = this._options.linkClass || this._options.cssClass;
    }

    /**
     * @param {CatharsisType[]} applications - Array of type applications
     * @returns {string}
     */
    applications(applications) {
        if (!applications) {
            return '';
        }
        const inner = applications
          .map(_ => this.type(_))
          .join(', ');
        const bracket = this._options.htmlSafe ? '&lt;' : '<';
        return bracket + inner + '>';
    }

    elements(elements) {
        let result = '';
        const strings = [];

        if (!elements) {
            return result;
        }

        for (let i = 0, l = elements.length; i < l; i++) {
            strings.push(this.type(elements[i]));
        }

        result = `(${strings.join('|')})`;

        return result;
    }

    key(type) {
        return this.type(type);
    }

    name(name) {
        return name || '';
    }

    new(funcNew) {
        return funcNew ? `new:${this.type(funcNew)}` : '';
    }

    nullable(nullable) {
        switch (nullable) {
            case true:
                return '?';
            case false:
                return '!';
            default:
                return '';
        }
    }

    /**
     * 
     * @param {boolean} optional 
     * @returns 
     */
    optional(optional) {
        if (optional === true) {
            return '=';
        } else {
            return '';
        }
    }

    params(params) {
        let result = '';
        const strings = [];

        if (!params || params.length === 0) {
            return result;
        }

        for (let i = 0, l = params.length; i < l; i++) {
            strings.push(this.type(params[i]));
        }

        result = strings.join(', ');

        return result;
    }

    result(result) {
        return result ? `: ${this.type(result)}` : '';
    }

    /**
     * @param {CatharsisType} type 
     * @returns {string}
     */
    stringify(type) {
        return this.type(type);
    }

    /**
     * @param {CatharsisType} funcThis 
     * @returns {string}
     */
    this(funcThis) {
        return funcThis ? `this:${this.type(funcThis)}` : '';
    }

    /**
     * @param {CatharsisType} type 
     * @returns {string}
     */
    type(type) {
        let typeString = '';

        if (!type) {
            return typeString;
        }

        switch (type.type) {
            case Types.AllLiteral:
                typeString = this._formatNameAndType(type, '*');
                break;
            case Types.FunctionType:
                typeString = this._signature(type);
                break;
            case Types.NullLiteral:
                typeString = this._formatNameAndType(type, 'null');
                break;
            case Types.RecordType:
                typeString = this._record(type);
                break;
            case Types.TypeApplication:
                typeString = this.type(type.expression) + this.applications(type.applications);
                break;
            case Types.UndefinedLiteral:
                typeString = this._formatNameAndType(type, 'undefined');
                break;
            case Types.TypeUnion:
                typeString = this.elements(type.elements);
                break;
            case Types.UnknownLiteral:
                typeString = this._formatNameAndType(type, '?');
                break;
            default:
                typeString = this._formatNameAndType(type);
        }

        // add optional/nullable/repeatable modifiers
        if (!this._options._ignoreModifiers) {
            typeString = this._addModifiers(type, typeString);
        }

        return typeString;
    }

    /**
     * 
     * @param {CatharsisType} type 
     * @returns {string}
     */
    _record(type) {
        const fields = this._recordFields(type.fields);

        return `{${fields.join(', ')}}`;
    }

    /**
     * @param {CatharsisType[]} fields 
     * @returns {any[]}
     */
    _recordFields(fields) {
        let field;
        let keyAndValue;

        const result = [];

        if (!fields) {
            return result;
        }

        for (let i = 0, l = fields.length; i < l; i++) {
            field = fields[i];

            keyAndValue = this.key(field.key);
            keyAndValue += field.value ? `: ${this.type(field.value)}` : '';

            result.push(keyAndValue);
        }

        return result;
    }

    /**
     * Adds optional, nullable, and repeatable modifiers if necessary.
     *
     * @param {CatharsisType} type 
     * @param {string} typeString 
     * @returns {string}
     */
    _addModifiers(type, typeString) {
        let combined;

        let optional = '';
        let repeatable = '';

        if (type.repeatable) {
            repeatable = '...';
        }

        combined = this.nullable(type.nullable) + combineNameAndType('', typeString);
        optional = this.optional(type.optional);

        return repeatable + combined + optional;
    }

    /**
     * @param {string} nameString 
     * @returns {string}
     */
    _addLinks(nameString) {
        const href = this._getHrefForString(nameString);
        let link = nameString;
        let linkClass = this._options.linkClass || '';

        if (href) {
            if (linkClass) {
                linkClass = ` class="${linkClass}"`;
            }

            link = `<a href="${href}"${linkClass}>${nameString}</a>`;
        }

        return link;
    }

    _formatNameAndType(type, literal) {
        let nameString = type.name || literal || '';
        const typeString = type.type ? this.type(type.type) : '';

        nameString = this._addLinks(nameString);

        return combineNameAndType(nameString, typeString);
    }

    _getHrefForString(nameString) {
        let href = '';
        const links = this._options.links;

        if (!links) {
            return href;
        }

        // accept a map or an object
        if (links instanceof Map) {
            href = links.get(nameString);
        } else if ({}.hasOwnProperty.call(links, nameString)) {
            href = links[nameString];
        }

        return href;
    }

    _signature(type) {
        let param;
        let prop;
        let signature;

        const params = [];
        // these go within the signature's parens, in this order
        const props = [
            'new',
            'this',
            'params'
        ];

        for (let i = 0, l = props.length; i < l; i++) {
            prop = props[i];
            param = this[prop](type[prop]);
            if (param.length > 0) {
                params.push(param);
            }
        }

        signature = `function(${params.join(', ')})`;
        signature += this.result(type.result);

        return signature;
    }
}

module.exports = (type, options) => new Stringifier(options).stringify(type);
