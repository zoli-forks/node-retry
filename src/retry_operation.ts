export default class RetryOperation {
  private _originalTimeouts: number[]
  private _timeouts: number[]
  private _cachedTimeouts: number[]
  private _unref: boolean
  private _attempts: number
  private _timeout: Timeout | null
  private _timer: Timeout | null
  private _errors: Error[]
  private _maxRetryTime: number
  private _operationStart: number
  private _operationTimeout: number
  private _operationTimeoutCb: (attempt?: number) => void
  private _fn: (attempt: number) => void
  constructor (
    timeouts: number[],
    options?: {
      forever?: boolean,
      unref?: boolean,
      maxRetryTime?: number,
    }
  ) {
    // Compatibility for the old (timeouts, retryForever) signature
    if (typeof options === 'boolean') {
      options = { forever: options };
    }

    this._originalTimeouts = JSON.parse(JSON.stringify(timeouts));
    this._timeouts = timeouts;
    this._unref = options.unref
    this._maxRetryTime = options && options.maxRetryTime || Infinity;
    this._fn = null;
    this._errors = [];
    this._attempts = 1;
    this._operationTimeout = null;
    this._operationTimeoutCb = null;
    this._timeout = null;
    this._operationStart = null;
    this._timer = null;

    if (options.forever) {
      this._cachedTimeouts = this._timeouts.slice(0);
    }
  }

  reset () {
    this._attempts = 1;
    this._timeouts = this._originalTimeouts;
  }

  stop () {
    if (this._timeout) {
      clearTimeout(this._timeout);
    }
    if (this._timer) {
      clearTimeout(this._timer);
    }

    this._timeouts = [];
    this._cachedTimeouts = null;
  };

  retry (err: Error) {
    if (this._timeout) {
      clearTimeout(this._timeout);
    }

    if (!err) {
      return false;
    }
    var currentTime = new Date().getTime();
    if (err && currentTime - this._operationStart >= this._maxRetryTime) {
      this._errors.unshift(new Error('RetryOperation timeout occurred'));
      return false;
    }

    this._errors.push(err);

    var timeout = this._timeouts.shift();
    if (timeout === undefined) {
      if (this._cachedTimeouts) {
        // retry forever, only keep last error
        this._errors.splice(this._errors.length - 1, this._errors.length);
        this._timeouts = this._cachedTimeouts.slice(0);
        timeout = this._timeouts.shift();
      } else {
        return false;
      }
    }

    this._timer = setTimeout(() => {
      this._attempts++;

      if (this._operationTimeoutCb) {
        this._timeout = setTimeout(function() {
          this._operationTimeoutCb(this._attempts);
        }, this._operationTimeout);

        if (this._unref) {
            this._timeout.unref();
        }
      }

      this._fn(this._attempts);
    }, timeout);

    if (this._unref) {
        this._timer.unref();
    }

    return timeout;
  };

  attempt (
    fn: (attempt: number) => void,
    timeoutOps: {
      cb: (attempt?: number) => void,
      timeout?: number
    }
  ) {
    this._fn = fn;

    if (timeoutOps) {
      if (timeoutOps.timeout) {
        this._operationTimeout = timeoutOps.timeout;
      }
      if (timeoutOps.cb) {
        this._operationTimeoutCb = timeoutOps.cb;
      }
    }

    if (this._operationTimeoutCb) {
      this._timeout = setTimeout(() => {
        this._operationTimeoutCb();
      }, this._operationTimeout);
    }

    this._operationStart = new Date().getTime();

    this._fn(this._attempts);
  };

  errors () {
    return this._errors;
  };

  attempts () {
    return this._attempts;
  };

  mainError () {
    if (this._errors.length === 0) {
      return null;
    }

    var counts = {};
    var mainError = null;
    var mainErrorCount = 0;

    for (var i = 0; i < this._errors.length; i++) {
      var error = this._errors[i];
      var message = error.message;
      var count = (counts[message] || 0) + 1;

      counts[message] = count;

      if (count >= mainErrorCount) {
        mainError = error;
        mainErrorCount = count;
      }
    }

    return mainError;
  }
}
