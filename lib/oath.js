
// Since objects only compare === to the same object (i.e. the same reference)
// we can do something like this instead of using integer enums because we can't
// ever accidentally compare these to other values and get a false-positive.
//
// For instance, `rejected === resolved` will be false, even though they are
// both {}.
var rejected = {}, resolved = {}, waiting = {};

// This is a promise. It's a value with an associated temporal
// status. The value might exist or might not, depending on
// the status.
var Promise = function (value, status) {
  this.value = value;
  this.status = status || waiting;

  this._onSuccess = [];
  this._onError = [];
};

// The user-facing way to add functions that want
// access to the value in the promise when the promise
// is resolved.
Promise.prototype.then = function (success, _failure) {
  if (this.status === resolved && !this._onSuccess.length) {
    try {
      var result = success(this.value);
      if (result instanceof Promise) {
        return result;
      } else {
        this.value = result;
      }
    } catch(err) {
      if (this._onError.length) {
        this._onError.shift()(err);
      } else {
        throw err;
      }
    }
  } else {
    success && this._onSuccess.push(success);
    _failure && this._onError.push(_failure);
  }

  return this;
};


// The user-facing way to add functions that should fire on an error. This
// can be called at the end of a long chain of .then()s to catch all .reject()
// calls that happened at any time in the .then() chain. This makes chaining
// multiple failable computations together extremely easy.
Promise.prototype.catch = function (failure) {
  if (this.status === rejected && !this._onError.length) {
    failure(this.value);
  } else {
    this._onError.push(failure);
  }

  return this;
};



// This is the object returned by defer() that manages a promise.
// It provides an interface for resolving and rejecting promises
// and also provides a way to extract the promise it contains.
var Deferred = function (promise) {
  this.promise = promise || new Promise();
};

// Resolve the contained promise with data.
//
// This will be called by the creator of the promise when the data
// associated with the promise is ready.
Deferred.prototype.resolve = function (data) {
  var self = this;

  this.promise.value = data;
  this.promise.status = resolved;

  if (this.promise._onSuccess.length) {
    try {
      var result = this.promise._onSuccess.shift()(data);
      if (result instanceof Promise) {
        this.promise.status = waiting;
        result.then(function(result) {
          self.resolve(result);
        }).catch(function(err) {
          self.reject(err);
        })
      } else {
        this.resolve(result);
      }
    } catch(err) {
      if (this.promise._onError.length) {
        this._onError.shift()(err);
      } else {
        throw err;
      }
    }
  }
};

// Reject the contained promise with an error.
//
// This will be called by the creator of the promise when there is
// an error in getting the data associated with the promise.
Deferred.prototype.reject = function (error) {
  this.promise.value = error;
  this.promise.status = rejected;

  if (this.promise._onError.length) {
    this.promise._onError.shift()(error);
  } else {
    throw error;
  }
};

// The external interface for creating promises
// and resolving them. This returns a Deferred
// object with an empty promise.
var defer = function () {
  var deferred = new Deferred();

  return deferred;
};


var promisify = function(fn) {
  var argumentsLength = fn.length;

  return function() {

    var deferred = defer();

    var args = Array.prototype.slice.call(arguments, 0, argumentsLength);
    while (args.length !== argumentsLength - 1) {
      args.push(null);
    }
    args.push(function(err, data) {
      if (err) {
        deferred.reject(err);
      } else {
        deferred.resolve(data);
      }
    });

    fn.apply(null, args);
    return deferred.promise;
  }
}


module.exports.defer = defer;
module.exports.promisify = promisify;
