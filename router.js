/**
 * BlueJacket Entry Point
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
        if (isOfType(handler, 'Function') || isOfType(handler, 'AsyncFunction'))
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

    if (isOfType(handler.action, 'Function') || isOfType(handler.action, 'AsyncFunction')) {
        await Promise.resolve(handler.action(context));
    } else if (isOfType(handler.action, 'Array')) {
        return Promise.all(handler.action.map(action => {
            return resolveWithHandler(execResult, { action }, context, { params: context.params });
        }));
    } else {
        throw new Error('Path handler should be a function or an array of functions.');
    }
};

class BlueJacket {
    constructor(opts = {}) {
        if (opts.instanceKey && instances[opts.instanceKey])
            return instances[opts.instanceKey];

        this.opts = Object.assign({}, defaultOpts, opts);

        this._handlerList = [];

        if (opts.instanceKey)
            instances[opts.instanceKey] = this;

        return this;
    }

    handle(path, ...handlerList) {
        // If path is neither string nor regex, assume it's a handler
        // And set path to regex matching all
        if (!(isOfType(path, 'String') || isOfType(path, 'RegExp'))) {
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

        let handlerConfig = {
            regex,
            handlers: handlerList.map(handler => {
                return {
                    action: handler,
                    params
                }
            })
        };

        this._handlerList.push(handlerConfig);
    }

    async resolve(path, data = {}) {
        if (!isOfType(path, 'String'))
            throw 'Path to be resolved must be a string';

        let context = Object.assign({}, this.opts.mixins, {
            route: path,
            data
        });

        try {
            for (let handlerConfig of this._handlerList) {
                const execResult = handlerConfig.regex.exec(path);
                if (execResult) {
                    for (let handler of handlerConfig.handlers) {
                        await resolveWithHandler(execResult, handler, context);
                    }
                }
            }
        } catch (err) {
            if (err !== 'route')
                throw err;
        }

        return context;
    }
};

module.exports = BlueJacket;
