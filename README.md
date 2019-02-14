### What is BlueJacket?
BlueJacket is a tiny (~125LOC) router, that provides simple, Express Style routing for both the server and the browser. It uses the popular middleware style of the ExpressJS router with a few tweaks for better readabilty.

##### Important:
Please note, BlueJacket does not come with an ES5-ready distribution out of the box. It needs to be transpiled for usage on the browser. It is assumed that you will be doing this as part of the build process for your application.

### Quickstart

To get started install BlueJacket.

```bash
yarn add bluejacket
```
```bash
npm install --save bluejacket
```

Let's create a route `/gists`, which will fetch a list of public gists from Github and display their titles.

```javascript
const BlueJacket = require('bluejacket');
const fetch = require('node-fetch');

const router = new BlueJacket();

// Shared code
router.handle('/gists', async (context) => {
    const gists = await (await fetch('https://api.github.com/gists')).json();

    context.html = `<ul>
            ${gists
                .filter(gist => gist.description && gist.html_url)
                .map(gist => `<li><a href=${gist.html_url}>${gist.description}</a></li>`)
                .join('')}
        </ul>`;
});

// Browser Code
const context = router.resolve('/gists');
document.documentElement.innerHTML = context.html || ''; // Don't actually do this. innerHTML is BAD.

// Server Code
// app is an expressJS app
app.use(function(req, res, next) {
    const context = router.resolve(req.originalUrl);
    res.send(context.html);
});
```

### API

##### `BlueJacket`
Main router class.

1. Constructor

```js
const BlueJacket = require('bluejacket');
const router = new BlueJacket(options);
```

- `options`: [Optional] Options object with properties:
    - `mixins` - An object whose properties get merged into the `context` object passed to the request handlers.
        - Default : `{}`
    - `caseSensitive` - Specify if paths should be treated as case sensitive, while routing.
        - Default: `false`
    - `strict` - Specify if `/path` should be treated as distinct from `/path/`.
        - Default: `false`
    - `instanceKey` - A key used to uniquely identify this router instance. You can call the constructor again, with this instanceKey to get the same router instance. If not specified, instances are not tracked. Ex:

In /planets.js
```js
const router = new BlueJacket({ caseSensitive: true, instanceKey: 'universe-router' });
```

In /stars.js
```js
const router = new BlueJacket({ instanceKey: 'universe-router' });
router.opts.caseSensitive; //true
```

2. `handle` method

```js
router.handle(path, handler[, ...handlers]);
```
- `path` - Optional string or regex denoting an expressJS style path. If none specified all paths will match against this handler.
- `handler` - Function, Array of Functions, or destructured Array of Functions. Function can be async also. Ex:

If single function is provided, it will be triggered when the route matches.
```js
router.handle('/planets', async (context) => {
    context.planets = await fetch('https://universe.example.com/planets').json();
});

```

If list of functions provided, each will be triggered in series:
```js
router.handle('/planets/named', async (context) => {
    context.planets = await fetch('https://universe.example.com/planets').json();
}, async (context) => {
    context.namedPlanets = context.planets.filter(planet => planet.name);
});
```

If any handler in the list is an Array of functions, all those functions will be triggered parallelly:
```js
router.handle('/planets/named', [async (context) => {
    context.celestialBodies = (context.celestialBodies || [])
        .concat(await fetch('https://universe.example.com/planets').json());
}, async (context) => {
    context.celestialBodies = (context.celestialBodies || [])
        .concat(await fetch('https://universe.example.com/stars').json());
}]);
```

You can also mix and match above options as required:
```js
router.handle('/planets/named', [async (context) => {
    context.celestialBodies = (context.celestialBodies || [])
        .concat(await fetch('https://universe.example.com/planets').json());
}, async (context) => {
    context.celestialBodies = (context.celestialBodies || [])
        .concat(await fetch('https://universe.example.com/stars').json());
}], async (context) => {
    context.namedCelestialBodies = context.celestialBodies.filter(item => item.name);
});
```

If a handler function called in series `throw`s, the remaining handlers will not be triggered. If a handler function called in parallel `throw`s, the other parallel handlers will continue execution, but any subsequent serial handlers will not be triggered.

If you wish to skip the handlers after the current handler, you can `throw` the string `route`. Ex:
```js
router.handle('/planets/named', async (context) => {
    context.planets = await fetch('https://universe.example.com/planets').json();
    throw 'route';
}, async (context) => {
    // Will not be executed
    context.namedPlanets = context.planets.filter(planet => planet.name);
});
```

This will cause the resolution of the request to terminate.

Note that, when you throw `route`, it will be implicitly caught by BlueJacket. If you throw anything else, BlueJacket will catch and throw it again.

##### `Context` object

Each handler will be called with a `context` object. The context object is created at the start of the request life-cycle and then passed throught to subsequent handlers. If you wish to pass data between handlers, use the `context` object to do os.
The context object has the following properties:
- `data`: `data` object that the request resolution is requested with.
- `params`: If you have any express style route params, these will be listed here in key value form. Regex capture groups will also appear here.
- `route`: The actual route being resolved.
- `router`: The router instance resolving this request.
- Other properties from the `mixins` option defined on this router. If any mixin has the same name as one of the above properties it will be overwritten.

##### Important:
The `context` object passed to the handlers is the same object. So modifications to the `context` object will impact other routers. Keep this in mind, esp when modifying `context` object in parallelly defined handlers.

3. `resolve` method

```js
router.resolve(path, data);
```

This is the method that is called to actually resolve your request.
- `path` - Request path to resolve.
- `data` - Data to resolve with. This data is made available to your handlers as `data` property on the `context` object.

This method returns:
- `context` - The shared context object that was passed through the request handlers list.

Usage in browser:
```js
router.handle('/planets', async (context) => {
    context.data; // { named: true }
});
const context = router.resolve('/planets', { named: true });
```

Usage on server:
```js
router.handle('/planets', async (context) => {
    context.data; // { named: true }
});

//Assuming you are using express and app is an express app
app.use(function(req, res, next) {
    const context = router.resolve(req.originalUrl, Object.assign({}, req.query, req.body));
});
```

Once all handlers have been executed, or an error thrown by any of the handlers, or any handler `throw`s the string `route`, i.e. once the request resolution has either completed or been terminated, the context object will be made available as the return value of the `resolve` method.

You can then use this `context` object to perform any rendering that you might wish to do.

##### Important:
Please note that, by default, the router does not perform any kind of 'rendering'. It is up to you to render the response from the `context` object returned by `resolve`. Ex:

Browser rendering:
```js
router.handle(...);
router.handle(...);
router.handle(...);

const context = router.resolve('/gists');
document.documentElement.innerHTML = context.html || ''; // Don't actually do this. innerHTML is BAD.
```

Server rendering with ExpressJS
```js
router.handle(...);
router.handle(...);
router.handle(...);

// app is an expressJS app
app.use(function(req, res, next) {
    const context = router.resolve(req.originalUrl);
    res.send(`<html><head>Server Rendered</head><body>${context.html}</body></html>`);
});
```

And that's pretty much it! I'll add a few examples for things like rendering React shortly.
