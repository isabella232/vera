// Copyright (c) 2013, Joyent, Inc. All rights reserved.

var assert = require('assert-plus');
var bunyan = require('bunyan');
var helper = require('./helper.js');
var TaskPipe = require('../lib/task_pipe');
var vasync = require('vasync');



///--- Globals

var test = helper.test;
var LOG = bunyan.createLogger({
    level: (process.env.LOG_LEVEL || 'fatal'),
    name: 'memprops-test',
    stream: process.stdout
});



///--- Tests


test('single task', function (t) {
    var taskLog = [];
    var taskPipe = new TaskPipe({
        'func': function (opts, cb) {
            assert.arrayOfString(opts);
            assert.ok(opts.length === 1);
            taskLog.push(opts[0]);
            process.nextTick(cb);
        }
    });
    vasync.pipeline({
        args: {},
        funcs: [
            function appendOne(_, subcb) {
                taskPipe.append('0', subcb);
            },
            function check(_, subcb) {
                t.equal(1, taskLog.length);
                t.equal('0', taskLog[0]);
                subcb();
            }
        ]
    }, function (err) {
        if (err) {
            t.fail(err);
        }
        t.done();
    });
});


test('multiple tasks', function (t) {
    var taskLog = [];
    var taskPipe = new TaskPipe({
        'func': function (opts, cb) {
            assert.arrayOfString(opts);
            assert.ok(opts.length === 1);
            taskLog.push(opts[0]);
            process.nextTick(cb);
        }
    });
    vasync.pipeline({
        args: {},
        funcs: [
            function appendOne(_, subcb) {
                var done = 0;
                function tryEnd() {
                    ++done;
                    if (done === 4) {
                        subcb();
                    }
                }
                taskPipe.append('0', tryEnd);
                taskPipe.append('1', tryEnd);
                taskPipe.append('2', tryEnd);
                taskPipe.append('3', tryEnd);
            },
            function check(_, subcb) {
                t.equal(4, taskLog.length);
                assert.deepEqual([ '0', '1', '2', '3' ], taskLog);
                subcb();
            }
        ]
    }, function (err) {
        if (err) {
            t.fail(err);
        }
        t.done();
    });
});


test('consume multiple', function (t) {
    var taskLog = [];
    var taskPipe = new TaskPipe({
        'func': function (opts, cb) {
            assert.arrayOfString(opts);
            assert.ok(opts.length === 2);
            taskLog.push(opts);
            process.nextTick(cb);
        },
        'choose': function (arr) {
            return (2);
        }
    });
    vasync.pipeline({
        args: {},
        funcs: [
            function appendOne(_, subcb) {
                var done = 0;
                function tryEnd() {
                    ++done;
                    if (done === 4) {
                        subcb();
                    }
                }
                //The only reason this test works is that multiple are enqueued
                // during the same tick.
                taskPipe.append('0', tryEnd);
                taskPipe.append('1', tryEnd);
                taskPipe.append('2', tryEnd);
                taskPipe.append('3', tryEnd);
            },
            function check(_, subcb) {
                t.equal(2, taskLog.length);
                assert.deepEqual([ [ '0', '1'], ['2', '3' ] ], taskLog);
                subcb();
            }
        ]
    }, function (err) {
        if (err) {
            t.fail(err);
        }
        t.done();
    });
});


test('chain one', function (t) {
    var taskLog = [];
    var taskPipeTwo = new TaskPipe({
        'func': function (opts, cb) {
            assert.arrayOfString(opts);
            t.equal(1, opts.length);
            taskLog.push(opts[0]);
            cb();
        }
    });
    var taskPipeOne = new TaskPipe({
        'func': function (opts, cb) {
            assert.arrayOfString(opts);
            t.equal(1, opts.length);
            taskLog.push(opts[0]);
            cb();
        },
        'next': taskPipeTwo
    });
    vasync.pipeline({
        args: {},
        funcs: [
            function appendOne(_, subcb) {
                taskPipeOne.append('0', subcb);
            },
            function check(_, subcb) {
                t.deepEqual(['0', '0'], taskLog);
                subcb();
            }
        ]
    }, function (err) {
        if (err) {
            t.fail(err);
        }
        t.done();
    });
});


//Unfortunately, this test works by timing.  There's a possibility that it will
// break at some point.  If/when it does, we'll have to rewrite.
test('chain multiple', function (t) {
    var taskLog = [];
    var taskPipeTwo = new TaskPipe({
        'func': function (opts, cb) {
            assert.arrayOfString(opts);
            setTimeout(function () {
                taskLog.push(opts.map(function (x) { return ('2-' + x); }));
                cb();
            }, 7);
        },
        'choose': function (arr) {
            return (1);
        }
    });
    var taskPipeOne = new TaskPipe({
        'func': function (opts, cb) {
            assert.arrayOfString(opts);
            setTimeout(function () {
                taskLog.push(opts.map(function (x) { return ('1-' + x); }));
                cb();
            }, 10);
        },
        'choose': function (arr) {
            return (2);
        },
        'next': taskPipeTwo
    });
    vasync.pipeline({
        args: {},
        funcs: [
            function appendOne(_, subcb) {
                var done = 0;
                function tryEnd() {
                    ++done;
                    if (done === 5) {
                        subcb();
                    }
                }
                taskPipeOne.append('0', tryEnd);
                taskPipeOne.append('1', tryEnd);
                taskPipeOne.append('2', tryEnd);
                taskPipeOne.append('3', tryEnd);
                taskPipeOne.append('4', tryEnd);
            },
            function check(_, subcb) {
                //Explanation:
                t.deepEqual([
                    //10 ms: 0 and 1 from one, enqueue both to two.
                    [ '1-0', '1-1' ],
                    //17 ms: 0 consumed from two.
                    [ '2-0' ],
                    //20 ms: 2 and 3 from one, enqueue both to two.
                    [ '1-2', '1-3' ],
                    //24 ms: 1 consumed from two.
                    [ '2-1' ],
                    //30 ms: 4 from one, enqueue to two.
                    [ '1-4' ],
                    //31 ms: 2 consumed from two.
                    [ '2-2' ],
                    //38 ms: 3 consumed from two.
                    [ '2-3' ],
                    //45 ms: 4 consumed from two.
                    [ '2-4' ]
                ], taskLog);
                subcb();
            }
        ]
    }, function (err) {
        if (err) {
            t.fail(err);
        }
        t.done();
    });
});


test('chain break', function (t) {
    var reachedTwo = false;
    var taskPipeTwo = new TaskPipe({
        'func': function (opts, cb) {
            reachedTwo = true;
            cb();
        }
    });
    var taskPipeOne = new TaskPipe({
        'func': function (opts, cb) {
            var e = new Error('ahhhhhhh!');
            e.name = 'OneError';
            cb(e);
        },
        'next': taskPipeTwo
    });
    vasync.pipeline({
        args: {},
        funcs: [
            function appendOne(_, subcb) {
                taskPipeOne.append('0', subcb);
            }
        ]
    }, function (err) {
        if (!err) {
            t.fail('should have thrown an error!');
        }
        t.equal('OneError', err.name);
        t.ok(reachedTwo === false);
        t.done();
    });
});