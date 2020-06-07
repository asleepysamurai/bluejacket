/**
 * Test suite
 */

import * as assert from 'assert';
import Debug from 'debug';
import express from 'express';
import fetch from 'node-fetch';

import { BlueJacket, ObjectWithDynamicKeys } from './router';

function sleep(ms: number, success: boolean = true) {
  return new Promise((resolve, reject) => {
    setTimeout(success ? resolve : reject, ms);
  });
}

function instances() {
  const instance1 = new BlueJacket({
    instanceKey: 'test1',
    caseSensitive: true,
  });

  const instance2 = new BlueJacket({
    instanceKey: 'test2',
    caseSensitive: false,
  });

  const instance3 = new BlueJacket({
    instanceKey: 'test1',
    caseSensitive: false,
  });

  assert.notStrictEqual(instance1, instance2);
  assert.strictEqual(instance1, instance3);
}

function opts() {
  const opts = {
    mixins: {
      test: () => {},
    },
    strict: true,
    caseSensitive: true,
    instanceKey: 'test',
  };

  const instance = new BlueJacket<{ test: () => void }>(opts);

  let instanceOpts: ObjectWithDynamicKeys = {};
  type optKeys = 'mixins' | 'strict' | 'caseSensitive' | 'instanceKey';
  (Object.keys(opts) as optKeys[]).forEach((key: optKeys) => {
    return (instanceOpts[key] = instance[key]);
  });
  assert.deepStrictEqual(instanceOpts, opts);
}

async function successRouteSingle(log: Debug.Debugger) {
  const instance = new BlueJacket();

  instance.handle('/test', () => {
    log('/test');
  });

  await instance.resolve('/test');
}

async function errorRouteSingle(log: Debug.Debugger) {
  const instance = new BlueJacket();
  const errMessage = 'randomly thrown error';

  instance.handle('/test', () => {
    log('/test');
    throw errMessage;
  });

  try {
    await instance.resolve('/test');
  } catch (err) {
    assert.deepStrictEqual(err, errMessage);
  }
}

async function successRouteMultipleSeries(log: Debug.Debugger) {
  const instance = new BlueJacket<{ executedHandlers: string[] }>();

  const handlerMessages = ['handler 1', 'handler 2', 'handler 3'];

  instance.handle('/test', (context) => {
    log(handlerMessages[0]);
    context.executedHandlers = [handlerMessages[0]];
  });

  instance.handle(
    '/test',
    (context) => {
      log(handlerMessages[1]);
      context.executedHandlers.push(handlerMessages[1]);
    },
    (context) => {
      log(handlerMessages[2]);
      context.executedHandlers.push(handlerMessages[2]);
    },
  );

  const context = await instance.resolve('/test');
  assert.deepStrictEqual(context.executedHandlers, handlerMessages);
}

async function errorRouteMultipleSeries(log: Debug.Debugger) {
  const instance = new BlueJacket<{ executedHandlers: string[] }>();

  const handlerMessages = ['handler 1', 'handler 2', 'handler 3'];

  instance.handle('/test', (context) => {
    log(handlerMessages[0]);
    context.executedHandlers = [handlerMessages[0]];
  });

  instance.handle(
    '/test',
    (context) => {
      log(handlerMessages[1]);
      context.executedHandlers.push(handlerMessages[1]);
      throw context.executedHandlers;
    },
    (context) => {
      log(handlerMessages[2]);
      context.executedHandlers.push(handlerMessages[2]);
    },
  );

  try {
    await instance.resolve('/test');
  } catch (err) {
    assert.deepStrictEqual(err, handlerMessages.slice(0, handlerMessages.length - 1));
  }
}

async function successRouteMultipleParallel(log: Debug.Debugger) {
  const instance = new BlueJacket<{ executedHandlers: string[] }>();

  const handlerMessages = ['handler 1', 'handler 2', 'handler 3'];

  instance.handle(
    '/test',
    [
      (context) => {
        log(handlerMessages[0]);
        context.executedHandlers = [handlerMessages[0]];
      },
      (context) => {
        log(handlerMessages[1]);
        context.executedHandlers.push(handlerMessages[1]);
      },
      (context) => {
        log(handlerMessages[2]);
        context.executedHandlers.push(handlerMessages[2]);
      },
    ],
    () => {
      log('series');
    },
  );

  const context = await instance.resolve('/test');
  assert.deepStrictEqual(context.executedHandlers.slice().sort(), handlerMessages);
}

async function errorRouteMultipleParallel(log: Debug.Debugger) {
  const instance = new BlueJacket<{ executedHandlers: string[] }>();

  const handlerMessages = ['handler 1', 'handler 2', 'handler 3', 'handler 4'];

  instance.handle(
    '/test',
    [
      (context) => {
        log(handlerMessages[0]);
        context.executedHandlers = [handlerMessages[0]];
      },
      (context) => {
        log(handlerMessages[1]);
        context.executedHandlers.push(handlerMessages[1]);
        throw context.executedHandlers;
      },
      (context) => {
        log(handlerMessages[2]);
        context.executedHandlers.push(handlerMessages[2]);
      },
    ],
    (context) => {
      log('series ' + handlerMessages[3]);
      context.executedHandlers.push(handlerMessages[3]);
    },
  );

  try {
    await instance.resolve('/test');
  } catch (err) {
    return assert.deepStrictEqual(
      err.slice().sort(),
      handlerMessages.slice(0, handlerMessages.length - 1),
    );
  }

  throw 'errorRouteMultipleParallel: Expected error to be thrown';
}

async function skipRouteSeries(log: Debug.Debugger) {
  const instance = new BlueJacket<{ executedHandlers: string[] }>();

  const handlerMessages = ['handler 1', 'handler 2', 'handler 3'];

  instance.handle('/test', (context) => {
    log(handlerMessages[0]);
    context.executedHandlers = [handlerMessages[0]];
  });

  instance.handle(
    '/test',
    (context) => {
      log(handlerMessages[1]);
      context.executedHandlers.push(handlerMessages[1]);
      throw 'route';
    },
    (context) => {
      log(handlerMessages[2]);
      context.executedHandlers.push(handlerMessages[2]);

      throw 'Skip failed';
    },
  );

  await instance.resolve('/test');
}

async function successRouteMultipleSeriesAsync(log: Debug.Debugger) {
  const instance = new BlueJacket<{ executedHandlers: string[] }>();

  const handlerMessages = ['handler 1', 'handler 2', 'handler 3'];

  instance.handle('/test', async (context) => {
    log(handlerMessages[0]);
    context.executedHandlers = [handlerMessages[0]];
  });

  instance.handle(
    '/test',
    async (context) => {
      log(handlerMessages[1]);
      await sleep(10);
      context.executedHandlers.push(handlerMessages[1]);
    },
    (context) => {
      log(handlerMessages[2]);
      context.executedHandlers.push(handlerMessages[2]);
    },
  );

  const context = await instance.resolve('/test');
  assert.deepStrictEqual(context.executedHandlers, handlerMessages);
}

async function errorRouteMultipleSeriesAsync(log: Debug.Debugger) {
  const instance = new BlueJacket<{ executedHandlers: string[] }>();

  const handlerMessages = ['handler 1', 'handler 2', 'handler 3'];

  instance.handle('/test', async (context) => {
    log(handlerMessages[0]);
    await sleep(10);
    context.executedHandlers = [handlerMessages[0]];
  });

  instance.handle(
    '/test',
    (context) => {
      log(handlerMessages[1]);
      context.executedHandlers.push(handlerMessages[1]);
      throw context.executedHandlers;
    },
    (context) => {
      log(handlerMessages[2]);
      context.executedHandlers.push(handlerMessages[2]);
    },
  );

  try {
    await instance.resolve('/test');
  } catch (err) {
    return assert.deepStrictEqual(err, handlerMessages.slice(0, handlerMessages.length - 1));
  }

  throw 'errorRouteMultipleSeriesAsync: Expected error to be thrown';
}

async function successRouteMultipleParallelAsync(log: Debug.Debugger) {
  const instance = new BlueJacket<{ executedHandlers: string[] }>();

  const handlerMessages = ['handler 1', 'handler 2', 'handler 3'];

  instance.handle('/test', async (context) => {
    log(handlerMessages[0]);
    context.executedHandlers = [handlerMessages[0]];
  });

  instance.handle('/test', [
    async (context) => {
      log(handlerMessages[2]);
      await sleep(10);
      context.executedHandlers.push(handlerMessages[2]);
    },
    (context) => {
      log(handlerMessages[1]);
      context.executedHandlers.push(handlerMessages[1]);
    },
  ]);

  const context = await instance.resolve('/test');
  assert.deepStrictEqual(context.executedHandlers, handlerMessages);
}

async function errorRouteMultipleParallelAsync(log: Debug.Debugger) {
  const instance = new BlueJacket<{ executedHandlers: string[] }>();

  const handlerMessages = ['handler 1', 'handler 2', 'handler 3'];

  instance.handle(
    '/test',
    [
      async (context) => {
        log(handlerMessages[1]);
        context.executedHandlers = [];
        await sleep(10);
        context.executedHandlers.push(handlerMessages[1]);
        throw context.executedHandlers;
      },
      (context) => {
        log(handlerMessages[0]);
        context.executedHandlers.push(handlerMessages[0]);
      },
    ],
    (context) => {
      log(handlerMessages[2]);
      context.executedHandlers.push(handlerMessages[2]);
    },
  );

  try {
    await instance.resolve('/test');
  } catch (err) {
    return assert.deepStrictEqual(err, handlerMessages.slice(0, handlerMessages.length - 1));
  }

  throw 'errorRouteMultipleParallelAsync: Expected error to be thrown';
}

async function params(log: Debug.Debugger) {
  const instance = new BlueJacket();

  const handlerMessages = ['handler 1', 'handler 2', 'handler 3'];

  instance.handle(
    '/test/:p1/(p2|p3)',
    () => {
      log(handlerMessages[0]);
    },
    (context) => {
      log(handlerMessages[1]);
      assert.deepStrictEqual(
        context.params,
        context.params?.p1 == 'p1'
          ? {
              p1: 'p1',
              '0': 'p2',
            }
          : {
              p1: 'p2',
              '0': 'p3',
            },
      );
    },
  );

  instance.handle(
    '/test/:test/(p2|p3)',
    () => {
      log(handlerMessages[0]);
    },
    (context) => {
      log(handlerMessages[1]);
      assert.deepStrictEqual(
        context.params,
        context.params?.test == 'p1'
          ? {
              test: 'p1',
              '0': 'p2',
            }
          : {
              test: 'p2',
              '0': 'p3',
            },
      );
    },
  );

  await instance.resolve('/test/p1/p2');
  await instance.resolve('/test/p2/p3');
}

async function data(log: Debug.Debugger) {
  const instance = new BlueJacket<{ routes: string[] }>();
  const data = { hasData: true };

  instance.handle((context) => {
    log('data');
    context.routes = context.routes || [];
    context.routes.push(context.route);

    assert.deepStrictEqual(context.data, data);
  });

  await instance.resolve('/test', data);
}

async function noPath(log: Debug.Debugger) {
  const instance = new BlueJacket<{ routes: string[] }>();

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
}

async function sequence(log: Debug.Debugger) {
  const instance = new BlueJacket<{ routes: string[] }>();

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
}

async function expressResolve(log: Debug.Debugger) {
  const app = express();
  const instance = new BlueJacket<{ routes: string[] }>();

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

  app.use(async (req: express.Request, res: express.Response) => {
    await instance.resolve(req.originalUrl, Object.assign({}, req.query, req.body));
    res.end();
  });

  const port = 5000;
  const server = app.listen(port, async () => {
    await fetch(`http://localhost:${port}/test`);
    server.close();
  });
}

async function preserveMixins(log: Debug.Debugger) {
  const mixins: ObjectWithDynamicKeys = {
    a: 1,
    b: 2,
  };

  const instance = new BlueJacket<ObjectWithDynamicKeys>({
    mixins,
  });

  instance.handle('/test', (context) => {
    log('/test');

    Object.keys(mixins).forEach((key) => {
      return assert.deepStrictEqual(context[key], mixins[key]);
    });
  });

  await instance.resolve('/test');
}

const tests = [
  instances.bind(null, Debug('bluejacket:instances')),
  opts.bind(null, Debug('bluejacket:opts')),
  successRouteSingle.bind(null, Debug('bluejacket:successRouteSingle')),
  errorRouteSingle.bind(null, Debug('bluejacket:errorRouteSingle')),
  successRouteMultipleSeries.bind(null, Debug('bluejacket:successRouteMultipleSeries')),
  errorRouteMultipleSeries.bind(null, Debug('bluejacket:errorRouteMultipleSeries')),
  successRouteMultipleParallel.bind(null, Debug('bluejacket:successRouteMultipleParallel')),
  errorRouteMultipleParallel.bind(null, Debug('bluejacket:errorRouteMultipleParallel')),
  skipRouteSeries.bind(null, Debug('bluejacket:skipRouteSeries')),
  successRouteMultipleSeriesAsync.bind(null, Debug('bluejacket:successRouteMultipleSeriesAsync')),
  errorRouteMultipleSeriesAsync.bind(null, Debug('bluejacket:errorRouteMultipleSeriesAsync')),
  successRouteMultipleParallelAsync.bind(
    null,
    Debug('bluejacket:successRouteMultipleParallelAsync'),
  ),
  errorRouteMultipleParallelAsync.bind(null, Debug('bluejacket:errorRouteMultipleParallelAsync')),
  params.bind(null, Debug('bluejacket:params')),
  data.bind(null, Debug('bluejacket:data')),
  noPath.bind(null, Debug('bluejacket:noPath')),
  sequence.bind(null, Debug('bluejacket:sequence')),
  expressResolve.bind(null, Debug('bluejacket:expressResolve')),
  preserveMixins.bind(null, Debug('bluejacket:preserveMixins')),
];

async function runTests() {
  for (let test of tests) {
    await Promise.resolve(test());
  }
}

runTests();
