# Node.js tools for working with WCM design elements

See readme.md for the Web Developer Toolkit for information on using these tools.

## Testing
[Mocha](https://mochajs.org/) is used for running tests and [Chai](http://chaijs.com/)
is used for assertions. To run the tests, first install Mocha globally,
```
$ npm install -g mocha
```
Then run `$ npm install` from the project's root folder which should install 
Chai as a dev dependency. Then run Mocha from the project's root folder 
(`digexp-toolkit/digexp-wcm-design`):
```
$ mocha
```
Some tests may fail because they took too long. The timeout length can be increased by changing
the value of `LONG_TIMEOUT` in `test/wcmHelper.js`.