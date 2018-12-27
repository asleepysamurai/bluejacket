/**
 * Test suite
 */

const assert = require('assert');
const logger = require('bows');
const express = require('express');
const fetch = require('node-fetch');

const IsoRoute = require('./');

function sleep(ms, success = true) {
    return new Promise((resolve, reject) => {
        setTimeout(success ? resolve : reject, ms);
    });
};

function instances(log) {
    const instance1 = new IsoRoute({
        instanceKey: 'test1',
        caseSensitive: true
    });

    const instance2 = new IsoRoute({
        instanceKey: 'test2',
        caseSensitive: false
    });

    const instance3 = new IsoRoute({
        instanceKey: 'test1',
        caseSensitive: false
    });

    assert.notStrictEqual(instance1, instance2);
    assert.strictEqual(instance1, instance3);
};

function opts(log) {
    const opts = {
        mixins: {
            test: () => {}
        },
        strict: true,
        caseSensitive: true,
        instanceKey: 'test'
    };

    const instance = new IsoRoute(opts);
    assert.deepStrictEqual(instance.opts, opts);
};

async function successRouteSingle(log) {
    const instance = new IsoRoute();

    instance.handle('/test', (context) => {
        log('/test');
    });

    await instance.resolve('/test');
};

async function errorRouteSingle(log) {
    const instance = new IsoRoute();
    const errMessage = 'randomly thrown error';

    instance.handle('/test', (context) => {
        log('/test');
        throw errMessage;
    });

    try {
        await instance.resolve('/test');
    } catch (err) {
        assert.deepStrictEqual(err, errMessage);
    }
};

async function successRouteMultipleSeries(log) {
    const instance = new IsoRoute();

    const handlerMessages = ['handler 1', 'handler 2', 'handler 3'];

    instance.handle('/test', (context) => {
        log(handlerMessages[0]);
        context.executedHandlers = [handlerMessages[0]];
    });

    instance.handle('/test', (context) => {
        log(handlerMessages[1]);
        context.executedHandlers.push(handlerMessages[1]);
    }, (context) => {
        log(handlerMessages[2]);
        context.executedHandlers.push(handlerMessages[2]);

        assert.deepStrictEqual(context.executedHandlers, handlerMessages);
    });

    await instance.resolve('/test');
};

async function errorRouteMultipleSeries(log) {
    const instance = new IsoRoute();

    const handlerMessages = ['handler 1', 'handler 2', 'handler 3'];

    instance.handle('/test', (context) => {
        log(handlerMessages[0]);
        context.executedHandlers = [handlerMessages[0]];
    });

    instance.handle('/test', (context) => {
        log(handlerMessages[1]);
        context.executedHandlers.push(handlerMessages[1]);
        throw context.executedHandlers;
    }, (context) => {
        log(handlerMessages[2]);
        context.executedHandlers.push(handlerMessages[2]);
    });

    try {
        await instance.resolve('/test');
    } catch (err) {
        assert.deepStrictEqual(err, handlerMessages.slice(0, handlerMessages.length - 1));
    }
};

async function successRouteMultipleParallel(log) {
    const instance = new IsoRoute();

    const handlerMessages = ['handler 1', 'handler 2', 'handler 3'];

    instance.handle('/test', [(context) => {
        log(handlerMessages[0]);
        context.executedHandlers = [handlerMessages[0]];
    }, (context) => {
        log(handlerMessages[1]);
        context.executedHandlers.push(handlerMessages[1]);
    }, (context) => {
        log(handlerMessages[2]);
        context.executedHandlers.push(handlerMessages[2]);
    }], (context) => {
        log('series');
        assert.deepStrictEqual(context.executedHandlers.slice().sort(), handlerMessages);
    });

    await instance.resolve('/test');
};

async function errorRouteMultipleParallel(log) {
    const instance = new IsoRoute();

    const handlerMessages = ['handler 1', 'handler 2', 'handler 3', 'handler 4'];

    instance.handle('/test', [(context) => {
        log(handlerMessages[0]);
        context.executedHandlers = [handlerMessages[0]];
    }, (context) => {
        log(handlerMessages[1]);
        context.executedHandlers.push(handlerMessages[1]);
        throw context.executedHandlers;
    }, (context) => {
        log(handlerMessages[2]);
        context.executedHandlers.push(handlerMessages[2]);
    }], (context) => {
        log('series ' + handlerMessages[3]);
        context.executedHandlers.push(handlerMessages[3]);
    });

    try {
        await instance.resolve('/test');
    } catch (err) {
        return assert.deepStrictEqual(err.slice().sort(), handlerMessages.slice(0, handlerMessages.length - 1));
    }

    throw 'errorRouteMultipleParallel: Expected error to be thrown';
};

async function skipRouteSeries(log) {
    const instance = new IsoRoute();

    const handlerMessages = ['handler 1', 'handler 2', 'handler 3'];

    instance.handle('/test', (context) => {
        log(handlerMessages[0]);
        context.executedHandlers = [handlerMessages[0]];
    });

    instance.handle('/test', (context) => {
        log(handlerMessages[1]);
        context.executedHandlers.push(handlerMessages[1]);
        throw 'route';
    }, (context) => {
        log(handlerMessages[2]);
        context.executedHandlers.push(handlerMessages[2]);

        throw 'Skip failed';
    });

    await instance.resolve('/test');
};

async function successRouteMultipleSeriesAsync(log) {
    const instance = new IsoRoute();

    const handlerMessages = ['handler 1', 'handler 2', 'handler 3'];

    instance.handle('/test', async (context) => {
        log(handlerMessages[0]);
        context.executedHandlers = [handlerMessages[0]];
    });

    instance.handle('/test', async (context) => {
        log(handlerMessages[1]);
        await sleep(10);
        context.executedHandlers.push(handlerMessages[1]);
    }, (context) => {
        log(handlerMessages[2]);
        context.executedHandlers.push(handlerMessages[2]);

        assert.deepStrictEqual(context.executedHandlers, handlerMessages);
    });

    await instance.resolve('/test');
};

async function errorRouteMultipleSeriesAsync(log) {
    const instance = new IsoRoute();

    const handlerMessages = ['handler 1', 'handler 2', 'handler 3'];

    instance.handle('/test', async (context) => {
        log(handlerMessages[0]);
        await sleep(10);
        context.executedHandlers = [handlerMessages[0]];
    });

    instance.handle('/test', (context) => {
        log(handlerMessages[1]);
        context.executedHandlers.push(handlerMessages[1]);
        throw context.executedHandlers;
    }, (context) => {
        log(handlerMessages[2]);
        context.executedHandlers.push(handlerMessages[2]);
    });

    try {
        await instance.resolve('/test');
    } catch (err) {
        return assert.deepStrictEqual(err, handlerMessages.slice(0, handlerMessages.length - 1));
    }

    throw 'errorRouteMultipleSeriesAsync: Expected error to be thrown';
};

async function successRouteMultipleParallelAsync(log) {
    const instance = new IsoRoute();

    const handlerMessages = ['handler 1', 'handler 2', 'handler 3'];

    instance.handle('/test', async (context) => {
        log(handlerMessages[0]);
        context.executedHandlers = [handlerMessages[0]];
    });

    instance.handle('/test', [async (context) => {
        log(handlerMessages[2]);
        await sleep(10);
        context.executedHandlers.push(handlerMessages[2]);
    }, (context) => {
        log(handlerMessages[1]);
        context.executedHandlers.push(handlerMessages[1]);
    }], (context) => {
        assert.deepStrictEqual(context.executedHandlers, handlerMessages);
    });

    await instance.resolve('/test');
};

async function errorRouteMultipleParallelAsync(log) {
    const instance = new IsoRoute();

    const handlerMessages = ['handler 1', 'handler 2', 'handler 3'];

    instance.handle('/test', [async (context) => {
        log(handlerMessages[1]);
        context.executedHandlers = []
        await sleep(10);
        context.executedHandlers.push(handlerMessages[1]);
        throw context.executedHandlers;
    }, (context) => {
        log(handlerMessages[0]);
        context.executedHandlers.push(handlerMessages[0]);
    }], (context) => {
        log(handlerMessages[2]);
        context.executedHandlers.push(handlerMessages[2]);
    });

    try {
        await instance.resolve('/test');
    } catch (err) {
        return assert.deepStrictEqual(err, handlerMessages.slice(0, handlerMessages.length - 1));
    }

    throw 'errorRouteMultipleParallelAsync: Expected error to be thrown';
};

async function params(log) {
    const instance = new IsoRoute();

    const handlerMessages = ['handler 1', 'handler 2', 'handler 3'];

    instance.handle('/test/:p1/(p2|p3)', (context) => {
        log(handlerMessages[0])
    }, (context) => {
        log(handlerMessages[1]);
        assert.deepStrictEqual(context.params, context.params.p1 == 'p1' ? {
            p1: 'p1',
            '0': 'p2'
        } : {
            p1: 'p2',
            '0': 'p3'
        });
    });

    instance.handle('/test/:test/(p2|p3)', (context) => {
        log(handlerMessages[0])
    }, (context) => {
        log(handlerMessages[1]);
        assert.deepStrictEqual(context.params, context.params.test == 'p1' ? {
            test: 'p1',
            '0': 'p2'
        } : {
            test: 'p2',
            '0': 'p3'
        });
    });

    await instance.resolve('/test/p1/p2');
    await instance.resolve('/test/p2/p3');
};

async function data(log) {
    const instance = new IsoRoute();
    const data = { hasData: true };

    instance.handle((context) => {
        log('data');
        context.routes = context.routes || [];
        context.routes.push(context.route);

        assert.deepStrictEqual(context.data, data);
    });

    await instance.resolve('/test', data);
};

async function noPath(log) {
    const instance = new IsoRoute();

    instance.handle((context) => {
        log('all routes 1');
        context.routes = context.routes || [];
        context.routes.push(context.route);

        assert.strictEqual(context.routes.length, 1);
    });

    instance.handle((context) => {
        log('all routes 2');
        context.routes = context.routes || [];
        context.routes.push(context.route);

        assert.strictEqual(context.routes.length, 2);
    });

    await instance.resolve('/test');
};

async function sequence(log) {
    const instance = new IsoRoute();

    instance.handle('/test', (context) => {
        log('/test');
        context.routes = context.routes || [];
        context.routes.push(context.route);

        assert.strictEqual(context.routes[0], context.route);
    });

    instance.handle((context) => {
        log('none');
        context.routes = context.routes || [];
        context.routes.push(context.route);

        assert.strictEqual(context.routes[1], context.route);
    });

    instance.handle('/test', (context) => {
        log('/test');
        context.routes = context.routes || [];
        context.routes.push(context.route);

        assert.strictEqual(context.routes[2], context.route);
    });

    await instance.resolve('/test');
};

async function expressResolve(log) {
    const app = express();
    const instance = new IsoRoute();

    instance.handle('/test', (context) => {
        log('/test');
        context.routes = context.routes || [];
        context.routes.push(context.route);

        assert.strictEqual(context.routes[0], context.route);
    });

    instance.handle((context) => {
        log('none');
        context.routes = context.routes || [];
        context.routes.push(context.route);

        assert.strictEqual(context.routes[1], context.route);
    });

    instance.handle('/test', (context) => {
        log('/test');
        context.routes = context.routes || [];
        context.routes.push(context.route);

        assert.strictEqual(context.routes[2], context.route);
    });

    app.use(async (req, res, next) => {
        await instance.resolve(req.originalUrl, Object.assign({}, req.query, req.body));
    });

    const port = 5000;
    app.listen(port, async () => {
        await fetch(`http://localhost:${port}/test`);
    });
};

const tests = [
    instances.bind(null, logger('instances')),
    opts.bind(null, logger('opts')),
    successRouteSingle.bind(null, logger('successRouteSingle')),
    errorRouteSingle.bind(null, logger('errorRouteSingle')),
    successRouteMultipleSeries.bind(null, logger('successRouteMultipleSeries')),
    errorRouteMultipleSeries.bind(null, logger('errorRouteMultipleSeries')),
    successRouteMultipleParallel.bind(null, logger('successRouteMultipleParallel')),
    errorRouteMultipleParallel.bind(null, logger('errorRouteMultipleParallel')),
    skipRouteSeries.bind(null, logger('skipRouteSeries')),
    successRouteMultipleSeriesAsync.bind(null, logger('successRouteMultipleSeriesAsync')),
    errorRouteMultipleSeriesAsync.bind(null, logger('errorRouteMultipleSeriesAsync')),
    successRouteMultipleParallelAsync.bind(null, logger('successRouteMultipleParallelAsync')),
    errorRouteMultipleParallelAsync.bind(null, logger('errorRouteMultipleParallelAsync')),
    params.bind(null, logger('params')),
    data.bind(null, logger('data')),
    noPath.bind(null, logger('noPath')),
    sequence.bind(null, logger('sequence')),
    expressResolve.bind(null, logger('expressResolve'))
];

async function runTests(log) {
    for (let test of tests) {
        await Promise.resolve(test());
    }
};

runTests();
