/**
 * IsoRoute Entry Point
 */

const pathToRegexp = require('path-to-regexp');

const instances = {};

const defaultOpts = {
    mixins: {},
    strict: false,
    caseSensitive: false,
    instanceKey: null
};

function isOfType(item, type) {
    return Object.prototype.toString.call(item) === `[object ${type}]`;
};

function recursivelyTypeCheckHandlers(handlerList) {
    handlerList.forEach(handler => {
        if (isOfType(handler, 'Function'))
            return;
        if (isOfType(handler, 'Array'))
            return recursivelyTypeCheckHandlers(handler);

        throw new Error(`${handler} is not a function or an array of functions.`);
    });
};

function buildParams(execResult, paramsList = []) {
    let params = {};

    paramsList.forEach((paramConfig, i) => {
        params[paramConfig.name] = execResult[i + 1];
    });

    return params;
};

async function resolveWithHandler(execResult, handler, context = {}, opts = { params: null }) {
    context.params = opts.params || buildParams(execResult, handler.params);

    if (isOfType(handler.action, 'Function')) {
        return await Promise.resolve(handler.action(context));
    } else if (isOfType(handler.action, 'Array')) {
        return await Promise.all(handler.action.map(action => {
            return resolveWithHandler(execResult, { action }, context, { params: context.params });
        }));
    } else {
        throw new Error('Path handler should be a function or an array of functions.');
    }
};

class IsoRoute {
    constructor(opts = {}) {
        if (opts.instanceKey && instances[instanceKey])
            return instances[opts.instanceKey];

        this.opts = Object.assign({}, defaultOpts, opts);

        this._handlersByRegex = {};

        if (opts.instanceKey)
            instances[opts.instanceKey] = this;

        return this;
    }

    handle(path, ...handlerList) {
        // If path is neither string nor regex, assume it's a handler
        // And set path to regex matching all
        if (isOfType(path, 'String') || isOfType(path, 'RegExp')) {
            handlerList.unshift(path);
            path = /.*/;
        }

        recursivelyTypeCheckHandlers(handlerList);

        let params = [];
        const regex = pathToRegexp(path, params, {
            sensitive: this.opts.caseSensitive,
            strict: this.opts.strict
        });
        const key = regex.toString();

        this._handlersByRegex[key] = this._handlersByRegex[key] || { regex };
        this._handlersByRegex[key].handlers = this._handlersByRegex[key].handlers || [];

        handlerList.forEach(handler => {
            this._handlersByRegex[key].handlers.push({
                action: handler,
                params
            });
        });
    }

    async resolve(path, data) {
        let context = Object.assign({}, this.opts.mixins, {
            route: path,
            data
        });

        for (let key in this._handlersByRegex) {
            const handlerConfig = this._handlersByRegex[key];

            const execResult = handlerConfig.regex.exec(path);
            if (execResult) {
                for (let handler of handlerConfig.handlers) {
                    await resolveWithHandler(execResult, handler, context);
                }
            }
        }
    }
};

module.exports = IsoRoute;
